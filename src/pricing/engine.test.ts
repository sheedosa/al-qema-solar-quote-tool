import { describe, expect, it } from 'vitest'
import { canContinue, initialData, makeAc, makeAppliance, PRESET_NAMES, whatsappLink } from '../logic'
import type { AcUnit, FormData } from '../types'
import { PRICING_CONFIG } from './config'
import { bomTotal, priceCustomBom, runEngine, toWaQuote } from './engine'
import { validatePricingConfig } from './validate'
import type { Demand, PricingConfig } from './types'

/** Base fixture: fresh form + known LED lighting (fridge on, freezer off). */
const base = (): FormData => {
  const d = initialData()
  return { ...d, lighting: { ...d.lighting, type: 'led' } }
}

const ac = (over: Partial<AcUnit> = {}): AcUnit => ({ ...makeAc(), ...over })

const STRICT: PricingConfig = { ...PRICING_CONFIG, acBtuCapMode: 'strict' }

const TIER_RANK: Record<string, number> = { S: 0, M: 1, L: 2, XL: 3, XXL: 4, CUSTOM: 5 }

describe('1. BOM reconciliation — client quotation of 16/07/2026', () => {
  it('rebuilds the invoice to exactly 84,300 LYD from component rates', () => {
    const total = bomTotal(
      [
        { name: 'Growatt 6000W', qty: 3 },
        { name: 'Qmax Lithium 5kW', qty: 2 },
        { name: 'Jinko 590W', qty: 30 },
        { name: 'Alqema Stand', qty: 15 },
        { name: 'Mounting clamp', qty: 60 },
        { name: 'DC Cable 2x6mm', qty: 120 },
        { name: 'DC Cable 35mm', qty: 10 },
        { name: 'AC Cable 2x10mm', qty: 30 },
        { name: 'MTS Switch', qty: 1 },
        { name: 'MCCB DC Switch', qty: 3 },
        { name: 'Busbar', qty: 1 },
        { name: 'AC Combiner', qty: 1 },
        { name: 'Installation', qty: 1 },
        { name: 'Install consumables', qty: 2 },
        { name: 'Transport & handling', qty: 1 },
      ],
      PRICING_CONFIG,
    )
    expect(total).toBe(84300)
  })

  it('throws on an unknown component name instead of silently zeroing it', () => {
    expect(() => bomTotal([{ name: 'No Such Part', qty: 1 }], PRICING_CONFIG)).toThrow()
  })
})

describe('2. Package prices are exact lookups', () => {
  it('returns the five listed prices with no arithmetic', () => {
    const prices = Object.fromEntries(PRICING_CONFIG.packages.map((p) => [p.tier, p.priceLyd]))
    expect(prices).toEqual({ S: 8730, M: 15417, L: 32247, XL: 40600, XXL: 55500 })
  })
})

describe('3. AC gating', () => {
  it('0 ACs + base loads → S', () => {
    const r = runEngine(base(), PRICING_CONFIG)
    expect(r.recommendedTier).toBe('S')
    expect(r.priceFrom).toBe(8730)
    expect(r.confidence).toBe('high')
    expect(r.dailyKwh).toBeCloseTo(1.94, 2)
    expect(r.nightKwh).toBeCloseTo(1.22, 2)
    expect(r.constraintsBinding).toEqual([])
  })

  it('1 × 12,000 BTU AC (6h, nights) → L, bound by battery', () => {
    const r = runEngine({ ...base(), acUnits: [ac({ capValue: '12000' })] }, PRICING_CONFIG)
    expect(r.dailyKwh).toBeCloseTo(9.14, 2)
    expect(r.nightKwh).toBeCloseTo(8.42, 2)
    expect(r.recommendedTier).toBe('L')
    expect(r.priceFrom).toBe(32247)
    expect(r.constraintsBinding).toContain('battery')
  })

  it('2 × 18,000 BTU (3h, no nights): advisory → XL + warning, strict → XXL', () => {
    const d: FormData = {
      ...base(),
      acUnits: [
        ac({ capValue: '18000', hours: 3, night: false }),
        ac({ capValue: '18000', hours: 3, night: false }),
      ],
    }
    const advisory = runEngine(d, PRICING_CONFIG)
    expect(advisory.recommendedTier).toBe('XL')
    expect(advisory.priceFrom).toBe(40600)
    expect(advisory.warnings).toContain('acBtuExceeded')

    const strict = runEngine(d, STRICT)
    expect(strict.recommendedTier).toBe('XXL')
    expect(strict.priceFrom).toBe(55500)
    expect(strict.constraintsBinding).toContain('acBtu')
  })
})

describe('4. Custom pricing + floor', () => {
  it('3+ ACs → CUSTOM with a BOM price, floored at the config minimum', () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '9000' }), ac({ capValue: '9000' }), ac({ capValue: '9000' })],
    }
    for (const cfg of [PRICING_CONFIG, STRICT]) {
      const r = runEngine(d, cfg)
      expect(r.recommendedTier).toBe('CUSTOM')
      expect(r.isCustom).toBe(true)
      // 8 panels 8,800 + 4 batteries 30,000 + Hommer 3,350 + BoS = 54,300
      expect(r.customBuild!.subtotalLyd).toBe(54300)
      expect(r.customBuild!.floorApplied).toBe(true)
      expect(r.priceFrom).toBe(55500) // rounded 54,500 → floored to the minimum
      expect(r.specs.panels.count).toBe(8)
      expect(r.specs.battery.nominalKwh).toBe(20)
      expect(r.specs.battery.chemistry).toBe('lithium')
      expect(r.constraintsBinding).toContain('acCount')
      expect(r.includes).toEqual([])
    }
  })
})

describe('5. Monotonicity — more load never yields a smaller tier or price', () => {
  it('holds along an increasing-load ladder', () => {
    const ladder: FormData[] = [
      base(),
      { ...base(), appliances: [makeAppliance(1, 'Fan')] },
      { ...base(), acUnits: [ac({ capValue: '12000' })] },
      {
        ...base(),
        acUnits: [
          ac({ capValue: '18000', hours: 3, night: false }),
          ac({ capValue: '18000', hours: 3, night: false }),
        ],
      },
      {
        ...base(),
        acUnits: [ac({ capValue: '18000' }), ac({ capValue: '18000' })],
      },
    ]
    const results = ladder.map((d) => runEngine(d, PRICING_CONFIG))
    expect(results.map((r) => r.recommendedTier)).toEqual(['S', 'S', 'L', 'XL', 'CUSTOM'])
    // The CUSTOM rung now carries a real BOM price: 10 panels + 6 batteries + Hommer.
    expect(results[4].priceFrom).toBe(72500)
    expect(results[4].customBuild!.floorApplied).toBe(false)
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]
      const cur = results[i]
      expect(TIER_RANK[cur.recommendedTier]).toBeGreaterThanOrEqual(TIER_RANK[prev.recommendedTier])
      expect(cur.priceFrom).toBeGreaterThanOrEqual(prev.priceFrom)
    }
  })
})

describe('6. Unknown-input safety', () => {
  it('an all-unknown submission returns a valid tier with low confidence', () => {
    const d: FormData = {
      ...initialData(), // lighting type '' = unanswered
      acUnits: [ac({ dontKnow: true, inverter: 'unsure' })],
    }
    const r = runEngine(d, PRICING_CONFIG)
    expect(r.recommendedTier).toBe('L') // assumed 12,000 BTU behaves like the known case
    expect(r.confidence).toBe('low')
    expect(r.assumptionsMade).toContain('acSizeAssumed')
    expect(r.assumptionsMade).toContain('lightingAssumed')
  })

  it('a named custom appliance is assumed, never a crash', () => {
    const d: FormData = { ...base(), appliances: [{ ...makeAppliance(1, null), name: 'مضخة بئر' }] }
    const r = runEngine(d, PRICING_CONFIG)
    expect(r.confidence).toBe('low')
    expect(r.assumptionsMade).toContain('customApplianceAssumed')
  })
})

describe('7. Existing flow regression', () => {
  it('canContinue gates are unchanged', () => {
    const d = initialData()
    expect(canContinue(d, 1)).toBe(false)
    const filled: FormData = {
      ...d,
      name: 'Ahmed Ben Ali',
      whatsapp: '91 234 5678',
      propertyType: 'Home',
      city: 'Tripoli',
    }
    expect(canContinue(filled, 1)).toBe(true)
    expect(canContinue(filled, 2)).toBe(false)
    expect(
      canContinue(
        { ...filled, outageHours: '8–12 hrs', nightEconomy: 'yes', operation: 'essentials' },
        2,
      ),
    ).toBe(true)
    for (const step of [3, 4, 5, 6]) expect(canContinue(filled, step)).toBe(true)
  })

  it('whatsappLink carries the number and the auditable config version', () => {
    const q = toWaQuote(runEngine(base(), PRICING_CONFIG))
    const url = whatsappLink(base(), q, '+218911139113', (_name, qq) => 'Ref: ' + qq.configVersion)
    expect(url).toContain('wa.me/218911139113')
    expect(url).toContain(encodeURIComponent(PRICING_CONFIG.configVersion))
  })
})

describe('8. Config integrity', () => {
  it('every preset chip has a load-defaults entry under the same canonical name', () => {
    for (const name of PRESET_NAMES) {
      expect(PRICING_CONFIG.loadDefaults.appliancesByName[name], name).toBeDefined()
    }
  })
})

describe('9. Custom BOM composition', () => {
  const demand = (over: Partial<Demand>): Demand => ({
    dailyKwh: 0,
    nightKwh: 0,
    peakW: 0,
    inverterKw: 0,
    requiredKwp: 0,
    requiredUsableKwh: 0,
    ...over,
  })

  it('reproduces the client invoice for the matching demand', () => {
    const { build } = priceCustomBom(
      demand({ inverterKw: 15, requiredKwp: 17.5, requiredUsableKwh: 8 }),
      PRICING_CONFIG,
    )
    const byName = Object.fromEntries(build.lines.map((l) => [l.name, l.qty]))
    expect(byName).toEqual({
      'Jinko 590W': 30,
      'Qmax Lithium 5kW': 2,
      'Growatt 6000W': 3,
      'Alqema Stand': 15,
      'Mounting clamp': 60,
      'DC Cable 2x6mm': 120,
      'AC Cable 2x10mm': 30,
      'MCCB DC Switch': 3,
      'DC Cable 35mm': 10,
      'MTS Switch': 1,
      'Busbar': 1,
      'AC Combiner': 1,
      'Installation': 1,
      'Install consumables': 2,
      'Transport & handling': 1,
    })
    expect(build.subtotalLyd).toBe(84300) // exactly the 16/07/2026 quotation
    expect(build.totalLyd).toBe(84500) // rounded up to 500
    expect(build.floorApplied).toBe(false)
  })

  it('always includes at least one panel and one battery', () => {
    const { build, specs } = priceCustomBom(demand({}), PRICING_CONFIG)
    expect(specs.panels.count).toBe(1)
    expect(specs.battery.nominalKwh).toBe(5)
    expect(build.totalLyd).toBe(PRICING_CONFIG.customBom.minimumLyd)
  })

  it('selects the single inverter at or below its kW limit', () => {
    const single = priceCustomBom(demand({ inverterKw: 5 }), PRICING_CONFIG)
    expect(single.build.lines.some((l) => l.name === 'Growatt Hommer 5k')).toBe(true)
    const parallel = priceCustomBom(demand({ inverterKw: 5.1 }), PRICING_CONFIG)
    expect(parallel.build.lines.some((l) => l.name === 'Growatt 6000W' && l.qty === 1)).toBe(true)
  })
})

describe('10. Power-cut priority drives battery sizing', () => {
  it("'essentials' excludes ACs from the battery → smaller tier", () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '12000' })],
      priority: 'essentials',
    }
    const r = runEngine(d, PRICING_CONFIG)
    expect(r.nightKwh).toBeCloseTo(1.22, 2) // AC no longer counts at night
    expect(r.dailyKwh).toBeCloseTo(9.14, 2) // …but still counts by day
    expect(r.recommendedTier).toBe('M')
    expect(r.priceFrom).toBe(15417)
  })

  it("'essentials_ac' keeps only the N largest ACs on the battery", () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '9000' }), ac({ capValue: '18000' })],
      priority: 'essentials_ac',
      priorityAcCount: 1,
    }
    const r = runEngine(d, PRICING_CONFIG)
    expect(r.nightKwh).toBeCloseTo(12.02, 2) // 1.22 + the 18k unit (1800W × 6h)
    expect(r.recommendedTier).toBe('XL')

    const full = runEngine({ ...d, priority: 'full' }, PRICING_CONFIG)
    expect(full.nightKwh).toBeCloseTo(17.42, 2)
    expect(full.recommendedTier).toBe('XXL')
  })

  it('unanswered priority behaves exactly like full power', () => {
    const d: FormData = { ...base(), acUnits: [ac({ capValue: '12000' })] }
    const unanswered = runEngine({ ...d, priority: '' }, PRICING_CONFIG)
    const full = runEngine({ ...d, priority: 'full' }, PRICING_CONFIG)
    expect(unanswered).toEqual(full)
  })

  it("3 ACs with 'essentials' is still CUSTOM — the AC-count cap is hard", () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '9000' }), ac({ capValue: '9000' }), ac({ capValue: '9000' })],
      priority: 'essentials',
    }
    expect(runEngine(d, PRICING_CONFIG).recommendedTier).toBe('CUSTOM')
  })
})

describe('11. Config validator', () => {
  const clone = (): unknown => JSON.parse(JSON.stringify(PRICING_CONFIG))

  it('accepts the bundled config', () => {
    expect(validatePricingConfig(clone()).ok).toBe(true)
  })

  const breakCases: [string, (c: any) => void][] = [
    ['4 packages only', (c) => c.packages.pop()],
    ['tiers out of order', (c) => ([c.packages[2], c.packages[3]] = [c.packages[3], c.packages[2]])],
    ['negative price', (c) => (c.packages[0].priceLyd = -1)],
    ['NaN panel watts', (c) => (c.packages[1].panel.watts = NaN)],
    ['decreasing prices', (c) => (c.packages[4].priceLyd = 1)],
    ['unknown BOM component', (c) => (c.customBom.fixed[0].component = 'No Such Part')],
    ['zero floor', (c) => (c.customBom.minimumLyd = 0)],
    ['missing lightingHours', (c) => delete c.loadDefaults.lightingHours],
    ['liquid battery missing ampHours', (c) => delete c.packages[0].battery.ampHours],
  ]
  for (const [label, mutate] of breakCases) {
    it('rejects: ' + label, () => {
      const c = clone() as any
      mutate(c)
      const v = validatePricingConfig(c)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.errors.length).toBeGreaterThan(0)
    })
  }
})

describe('12. WhatsApp custom price', () => {
  it('the custom quote carries its price into the message summary', () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '9000' }), ac({ capValue: '9000' }), ac({ capValue: '9000' })],
    }
    const q = toWaQuote(runEngine(d, PRICING_CONFIG))
    expect(q.isCustom).toBe(true)
    expect(q.priceFrom).toBe(55500)
  })
})
