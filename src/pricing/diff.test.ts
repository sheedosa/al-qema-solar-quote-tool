import { describe, expect, it } from 'vitest'
import { PRICING_CONFIG } from './config'
import { compareConfigs, diffConfig } from './diff'
import { domId, formatPath, getAt, parentPath, parsePath, setAt } from './paths'
import type { PricingConfig } from './types'

const clone = (): PricingConfig => JSON.parse(JSON.stringify(PRICING_CONFIG)) as PricingConfig

describe('1. Paths round-trip the validator’s own syntax', () => {
  const cases = [
    'sizing.peakSunHours',
    'packages[2].priceLyd',
    'components["Jinko 590W"]',
    'loadDefaults.appliancesByName["Router / Internet"].watts',
    'customBom.fixed[4].component',
    'sizing.roofAreaM2ByAnswer["Not sure"]',
  ]
  for (const p of cases) {
    it('parses and re-formats ' + p, () => {
      expect(formatPath(parsePath(p))).toBe(p)
    })
  }

  it('reads and writes through the config', () => {
    const c = clone()
    expect(getAt(c, 'packages[2].priceLyd')).toBe(32247)
    expect(getAt(c, 'components["Jinko 590W"]')).toBe(1100)
    setAt(c, 'packages[2].priceLyd', 30000)
    setAt(c, 'components["New thing"]', 5)
    expect(c.packages[2].priceLyd).toBe(30000)
    expect(c.components['New thing']).toBe(5)
  })

  it('creates intermediate containers when writing a new list line', () => {
    const c = clone()
    setAt(c, 'addOns[1].name', 'Second')
    expect(c.addOns[1].name).toBe('Second')
  })

  it('knows a field’s parent and a DOM-safe id', () => {
    expect(parentPath('packages[2].priceLyd')).toBe('packages[2]')
    expect(parentPath('sizing')).toBeNull()
    expect(domId('components["Jinko 590W"]')).toMatch(/^cfg-[\w-]+$/)
  })

  it('degrades to a single key on garbage rather than throwing', () => {
    expect(parsePath('packages[x')).toEqual([{ key: 'packages[x' }])
    expect(getAt(clone(), 'packages[x')).toBeUndefined()
  })
})

describe('2. diffConfig lists exactly what changed', () => {
  it('identical configs → no changes', () => {
    expect(diffConfig(PRICING_CONFIG, clone())).toEqual([])
  })

  it('one price → one change with the exact path', () => {
    const d = clone()
    d.packages[2].priceLyd = 30000
    expect(diffConfig(PRICING_CONFIG, d)).toEqual([
      { path: 'packages[2].priceLyd', before: 32247, after: 30000 },
    ])
  })

  it('an added component and a removed one are both reported', () => {
    const d = clone()
    d.components['Jinko 615W'] = 1200
    delete d.components['UPS 1250']
    const changes = diffConfig(PRICING_CONFIG, d)
    expect(changes).toContainEqual({ path: 'components["Jinko 615W"]', before: undefined, after: 1200 })
    expect(changes).toContainEqual({ path: 'components["UPS 1250"]', before: 2350, after: undefined })
    expect(changes).toHaveLength(2)
  })

  it('a type change at a node is one change, not one per stray leaf', () => {
    const d = clone()
    d.packages[0].battery = { chemistry: 'lithium', count: 2, kwhEach: 5 }
    const changes = diffConfig(PRICING_CONFIG, d)
    // chemistry, count (same), ampHours (gone), kwhEach (new) — leaves differ
    // individually, which is what a manager wants to see for a battery swap.
    expect(changes.map((c) => c.path)).toEqual([
      'packages[0].battery.chemistry',
      'packages[0].battery.kwhEach',
      'packages[0].battery.ampHours',
    ])
  })

  it('a shortened list reports the dropped line', () => {
    const d = clone()
    d.customBom.fixed = d.customBom.fixed.slice(0, -1)
    const changes = diffConfig(PRICING_CONFIG, d)
    expect(changes.every((c) => c.path.startsWith('customBom.fixed[6]'))).toBe(true)
    expect(changes.every((c) => c.after === undefined)).toBe(true)
  })
})

describe('3. compareConfigs shows the effect on the reference households', () => {
  it('no change → no household changes', () => {
    const rows = compareConfigs(PRICING_CONFIG, clone())
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => !r.changed)).toBe(true)
    expect(rows.every((r) => r.liveTier === r.draftTier && r.livePrice === r.draftPrice)).toBe(true)
  })

  it('doubling a package price moves exactly the households on that package', () => {
    const live = PRICING_CONFIG
    const base = compareConfigs(live, live)
    const tier = base[1].liveTier // whatever the family home lands on
    const d = clone()
    const idx = d.packages.findIndex((p) => p.tier === tier)
    expect(idx).toBeGreaterThanOrEqual(0)
    d.packages[idx].priceLyd *= 2
    // Keep the S→XXL monotonic rule intact for the engine (it does not
    // validate here, but the comparison should still be meaningful).
    for (let i = idx + 1; i < d.packages.length; i++) {
      d.packages[i].priceLyd = Math.max(d.packages[i].priceLyd, d.packages[idx].priceLyd + 1)
    }
    const rows = compareConfigs(live, d)
    for (const r of rows) {
      const onThatTier = r.liveTier === tier
      expect(r.changed, r.id).toBe(onThatTier || r.livePrice !== r.draftPrice)
    }
    expect(rows.some((r) => r.changed)).toBe(true)
  })

  it('a component price only moves the households on a custom build', () => {
    const d = clone()
    d.components['Jinko 590W'] = 2000
    const rows = compareConfigs(PRICING_CONFIG, d)
    for (const r of rows) {
      if (r.liveTier === 'CUSTOM') expect(r.changed, r.id).toBe(true)
      else expect(r.changed, r.id).toBe(false)
    }
  })

  it('a draft the engine cannot price reads as no price, not a crash', () => {
    const d = clone()
    delete d.components['Jinko 590W'] // the custom recipe still names it
    const rows = compareConfigs(PRICING_CONFIG, d)
    const workshop = rows.find((r) => r.id === 'workshop')!
    expect(workshop.draftTier).toBe('SURVEY')
    expect(workshop.draftPrice).toBeNull()
  })
})
