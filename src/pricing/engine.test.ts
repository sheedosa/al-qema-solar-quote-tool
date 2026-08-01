import { describe, expect, it } from 'vitest'
import { canContinue, initialData, makeAc, makeAppliance, PRESET_NAMES, whatsappLink } from '../logic'
import type { AcUnit, FormData } from '../types'
import { PRICING_CONFIG } from './config'
import { bomTotal, runEngine, toWaQuote } from './engine'
import type { PricingConfig } from './types'

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

describe('4. Ceiling — never price above XXL', () => {
  it('3+ ACs → CUSTOM in both modes, no invented price', () => {
    const d: FormData = {
      ...base(),
      acUnits: [ac({ capValue: '9000' }), ac({ capValue: '9000' }), ac({ capValue: '9000' })],
    }
    for (const cfg of [PRICING_CONFIG, STRICT]) {
      const r = runEngine(d, cfg)
      expect(r.recommendedTier).toBe('CUSTOM')
      expect(r.isCustom).toBe(true)
      expect(r.priceFrom).toBeNull()
      expect(r.specs).toBeNull()
      expect(r.constraintsBinding).toContain('acCount')
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
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]
      const cur = results[i]
      expect(TIER_RANK[cur.recommendedTier]).toBeGreaterThanOrEqual(TIER_RANK[prev.recommendedTier])
      expect(cur.priceFrom ?? Infinity).toBeGreaterThanOrEqual(prev.priceFrom ?? Infinity)
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
