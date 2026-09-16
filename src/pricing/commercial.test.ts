import { describe, expect, it } from 'vitest'
import { priceCommercialBom, sizeCommercial } from './commercial'
import { PRICING_CONFIG } from './config'
import { validatePricingConfig } from './validate'
import type { CommercialConfig, CommercialSizing, PricingConfig } from './types'

const CM = PRICING_CONFIG.commercial as CommercialConfig

const cmWith = (patch: (c: CommercialConfig) => void): CommercialConfig => {
  const c = JSON.parse(JSON.stringify(CM)) as CommercialConfig
  patch(c)
  return c
}

/** Size, asserting success — the failure path has its own describe block. */
const size = (
  batteryKwh: number,
  dayLoadKw: number,
  peakKw = dayLoadKw,
  cfg: CommercialConfig = CM,
): CommercialSizing => {
  const r = sizeCommercial({ batteryKwh, dayLoadKw, peakKw }, cfg)
  if (!r.ok) throw new Error('expected a sizing, got: ' + r.errors.join('; '))
  return r.sizing
}

describe('1. The client’s worked examples', () => {
  // The three examples in the supplied method document, which is the only
  // acceptance test that matters: if these move, we are no longer running
  // Al Qema's procedure.
  it('Example 1 — 180 kWh of battery usage, 30 kW daytime load', () => {
    const s = size(180, 30)
    expect(s.grossKwh).toBe(225)
    expect(s.batteries).toBe(45)
    expect(s.chargeKw).toBe(45)
    expect(s.arrayNetKw).toBe(75)
    expect(s.arrayKw).toBe(93.75)
    // The paper says "≈152": it truncates 152.44 where the method's own
    // implementation note says to round up. A panel is not divisible.
    expect(s.panels).toBe(153)
    expect(s.inverterKw).toBe(30)
  })

  it('Example 2 — 300 kWh, 50 kW, without the daytime subtraction', () => {
    // The paper subtracts 50 here and nowhere else, mixing kW into a kWh
    // figure, and its own arithmetic does not close (375 − 50 = 325, but it
    // then writes ~310 and finally uses 60). Examples 1 and 3 reproduce
    // exactly without any such step, so this is implemented without it and
    // the discrepancy is an open question for the client.
    const s = size(300, 50)
    expect(s.grossKwh).toBe(375)
    expect(s.batteries).toBe(75)
    expect(s.arrayKw).toBe(156.25)
    expect(s.panels).toBe(255)
    expect(s.inverterKw).toBe(50)
  })

  it('Example 3 — 280 kWh, 80 kW', () => {
    const s = size(280, 80)
    expect(s.grossKwh).toBe(350)
    expect(s.batteries).toBe(70)
    expect(s.chargeKw).toBe(70)
    expect(s.arrayNetKw).toBe(150)
    expect(s.arrayKw).toBe(187.5)
    expect(s.panels).toBe(305) // paper truncates to 304
    expect(s.inverterKw).toBe(80)
  })
})

describe('2. The inverter ladder', () => {
  it('picks the smallest stocked size at or above the peak load', () => {
    expect(size(100, 20, 30).inverterKw).toBe(30)
    expect(size(100, 20, 30.1).inverterKw).toBe(40)
    expect(size(100, 20, 41).inverterKw).toBe(50)
    expect(size(100, 20, 51).inverterKw).toBe(80)
    expect(size(100, 20, 300).inverterKw).toBe(300)
  })

  it('clamps above the largest rung and says so rather than inventing one', () => {
    const s = size(100, 20, 450)
    expect(s.inverterKw).toBe(300)
    expect(s.flags).toContain('aboveLargestInverter')
  })

  it('flags a load that belongs on the household packages', () => {
    const s = size(10, 2, 3)
    expect(s.inverterKw).toBe(30) // the smallest rung, which is absurd here
    expect(s.flags).toContain('residentialScale')
  })

  it('reads the ladder in size order even if the config is out of order', () => {
    // Validation rejects an unordered ladder, but a remote config could carry
    // one before the validator ran; the chooser must not hand back a 300 kW
    // machine for a 30 kW load.
    const jumbled = cmWith((c) => {
      c.inverterLadder = [
        { kw: 300, component: 'c300' },
        { kw: 30, component: 'c30' },
        { kw: 80, component: 'c80' },
      ]
    })
    expect(size(100, 20, 25, jumbled).inverterKw).toBe(30)
  })
})

describe('3. The array is sized to carry the load and recharge the bank', () => {
  it('reports the inverter the method picks and the one the array implies', () => {
    const s = size(180, 30)
    // Example 1 puts a 93.75 kW array behind a 30 kW inverter. Both numbers
    // are shown so an engineer sees the conflict instead of inheriting it.
    expect(s.inverterKw).toBe(30)
    expect(s.inverterKwWithCharging).toBe(80) // 30 kW load + 45 kW charging
    expect(s.dcAcRatio).toBe(3.13)
    expect(s.flags).toContain('dcAcRatioHigh')
  })

  it('does not flag a build whose array and inverter agree', () => {
    // A modest bank behind a large day load: 3 kW of charging against a
    // 50 kW machine, so the array stays close to the inverter.
    const s = size(10, 40, 50)
    expect(s.dcAcRatio).toBe(1.08)
    expect(s.dcAcRatio).toBeLessThanOrEqual(CM.maxDcAcRatio)
    expect(s.flags).not.toContain('dcAcRatioHigh')
  })
})

describe('4. The two 5s are genuinely separate constants', () => {
  // The method's `/5` does double duty as the battery unit size and the sun
  // hours. The client's own implementation note asks for them to be split,
  // and they only look identical because both happen to be 5 today.
  it('fewer sun hours means more array, with the same battery bank', () => {
    const shorterDay = cmWith((c) => (c.peakSunHours = 4))
    const a = size(180, 30)
    const b = size(180, 30, 30, shorterDay)
    expect(b.batteries).toBe(a.batteries)
    expect(b.chargeKw).toBe(56.25) // 225 kWh over 4 h instead of 5
    expect(b.panels).toBeGreaterThan(a.panels)
  })

  it('a bigger battery unit means fewer batteries, same energy stored', () => {
    const bigger = cmWith((c) => (c.battery.kwhEach = 10))
    const s = size(180, 30, 30, bigger)
    expect(s.batteries).toBe(23) // ceil(225 / 10)
    expect(s.chargeKw).toBe(46) // 230 kWh installed over 5 h
  })

  it('charges the bank actually installed, not the raw gross figure', () => {
    // 182 kWh grosses to 227.5, which buys 46 batteries = 230 kWh installed.
    const s = size(182, 0, 30)
    expect(s.batteries).toBe(46)
    expect(s.chargeKw).toBe(46) // not 45.5
  })
})

describe('5. Bad input is refused, never absorbed', () => {
  const cases: [string, { batteryKwh: number; dayLoadKw: number; peakKw: number }][] = [
    ['a non-numeric battery figure', { batteryKwh: NaN, dayLoadKw: 30, peakKw: 30 }],
    ['a negative load', { batteryKwh: 180, dayLoadKw: -5, peakKw: 30 }],
    ['an infinite peak', { batteryKwh: 180, dayLoadKw: 30, peakKw: Infinity }],
    ['a misplaced decimal', { batteryKwh: 180000, dayLoadKw: 30, peakKw: 30 }],
    ['no peak load at all', { batteryKwh: 180, dayLoadKw: 30, peakKw: 0 }],
    ['nothing to power', { batteryKwh: 0, dayLoadKw: 0, peakKw: 30 }],
  ]
  for (const [label, input] of cases) {
    it('rejects ' + label, () => {
      const r = sizeCommercial(input, CM)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
    })
  }

  it('accepts a battery-only system with no daytime load', () => {
    const s = size(180, 0, 45)
    expect(s.arrayNetKw).toBe(45)
    expect(s.panels).toBe(92)
  })
})

describe('6. Pricing the build', () => {
  it('prices what the rate card knows and names what it does not', () => {
    const s = size(180, 30)
    const b = priceCommercialBom(s, PRICING_CONFIG, CM)

    const line = (name: string) => b.lines.find((l) => l.name === name)
    expect(line('Qmax Lithium 5kW')).toMatchObject({ qty: 45, unitLyd: 7500, totalLyd: 337500 })
    expect(line('Alqema Stand')).toMatchObject({ qty: 77 }) // ceil(153 / 2)
    expect(line('Mounting clamp')).toMatchObject({ qty: 306 })

    // The 615 W panel and the commercial inverters have no confirmed price,
    // so they carry a quantity and an open price rather than a borrowed one.
    expect(line('Jinko 615W')).toMatchObject({ qty: 153, unitLyd: null, totalLyd: null })
    expect(b.unpricedComponents).toContain('Jinko 615W')
    expect(b.unpricedComponents).toContain('Commercial inverter 30kW')
  })

  it('never throws on an unknown component, unlike the household BOM', () => {
    const s = size(180, 30)
    const stripped: PricingConfig = { ...PRICING_CONFIG, components: {} }
    const b = priceCommercialBom(s, stripped, CM)
    expect(b.subtotalLyd).toBe(0)
    expect(b.lines.every((l) => l.unitLyd === null)).toBe(true)
    expect(b.unpricedComponents.length).toBeGreaterThan(5)
  })

  it('totals only the priced lines and rounds up', () => {
    const s = size(180, 30)
    const b = priceCommercialBom(s, PRICING_CONFIG, CM)
    const priced = b.lines.reduce((sum, l) => sum + (l.totalLyd ?? 0), 0)
    expect(b.subtotalLyd).toBe(priced)
    expect(b.totalLyd % CM.roundUpToLyd).toBe(0)
    expect(b.totalLyd).toBeGreaterThanOrEqual(b.subtotalLyd)
  })

  it('lands far above the household survey cap, which is why it stays internal', () => {
    const s = size(180, 30)
    const b = priceCommercialBom(s, PRICING_CONFIG, CM)
    // Batteries alone exceed the 250,000 LYD cap above which the customer
    // path refuses to show a price at all.
    expect(b.subtotalLyd).toBeGreaterThan(PRICING_CONFIG.customBom.maximumLyd)
  })
})

describe('7. The commercial block is optional and validated', () => {
  const withCommercial = (patch: (c: CommercialConfig) => void): unknown => {
    const c = JSON.parse(JSON.stringify(PRICING_CONFIG)) as PricingConfig
    patch(c.commercial as CommercialConfig)
    return c
  }

  it('a config without the block is still valid', () => {
    // The live database predates this block. Rejecting it there would drop
    // every customer to bundled prices to protect an internal calculator.
    const { commercial: _omitted, ...rest } = JSON.parse(
      JSON.stringify(PRICING_CONFIG),
    ) as PricingConfig
    expect(validatePricingConfig(rest).ok).toBe(true)
  })

  it('the bundled config passes', () => {
    const v = validatePricingConfig(JSON.parse(JSON.stringify(PRICING_CONFIG)))
    expect(v.ok, v.ok ? '' : v.errors.join('; ')).toBe(true)
  })

  const breakCases: [string, (c: CommercialConfig) => void][] = [
    ['an efficiency above 1', (c) => (c.batteryEfficiency = 1.2)],
    ['a zero system efficiency', (c) => (c.systemEfficiency = 0)],
    ['25 sun hours in a day', (c) => (c.peakSunHours = 25)],
    ['a panel with no watts', (c) => (c.panel.watts = 0)],
    ['an empty inverter ladder', (c) => (c.inverterLadder = [])],
    [
      'a ladder that does not ascend',
      (c) => (c.inverterLadder = [{ kw: 80, component: 'a' }, { kw: 30, component: 'b' }]),
    ],
    ['a BOM line with no quantity', (c) => (c.fixed = [{ component: 'Installation', qty: 0 }])],
    ['a DC:AC flag threshold below 1', (c) => (c.maxDcAcRatio = 0.5)],
  ]
  for (const [label, patch] of breakCases) {
    it('rejects ' + label, () => {
      expect(validatePricingConfig(withCommercial(patch)).ok).toBe(false)
    })
  }

  it('accepts a component name the rate card has never heard of', () => {
    // Deliberate: the commercial rates are unconfirmed, and an unpriced line
    // is a normal state here rather than a broken config.
    const ok = withCommercial((c) => (c.panel.component = 'Some panel nobody priced yet'))
    expect(validatePricingConfig(ok).ok).toBe(true)
  })
})

describe('8. The household path is untouched', () => {
  it('commercial sizing shares no state with the engine config', () => {
    // The constants deliberately differ; consolidating them would silently
    // reprice either the packages or the commercial jobs.
    expect(CM.systemEfficiency).not.toBe(PRICING_CONFIG.sizing.systemEfficiency)
    expect(CM.peakSunHours).not.toBe(PRICING_CONFIG.sizing.peakSunHours)
    expect(CM.panel.watts).not.toBe(PRICING_CONFIG.customBom.panel.watts)
  })
})
