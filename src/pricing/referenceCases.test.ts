import { describe, expect, it } from 'vitest'
import { canContinue } from '../logic'
import { PRICING_CONFIG } from './config'
import { runEngine } from './engine'
import { REFERENCE_CASES, REFERENCE_CASE_IDS } from './referenceCases'
import { TIER_ORDER } from './validate'

describe('Reference households', () => {
  it('there are seven, in the declared order', () => {
    expect(REFERENCE_CASES).toHaveLength(7)
    expect(REFERENCE_CASES.map((c) => c.id)).toEqual(REFERENCE_CASE_IDS)
  })

  it('each is a form the wizard would accept through the power step', () => {
    for (const c of REFERENCE_CASES) {
      expect(canContinue(c.form, 1), c.id).toBe(true)
      expect(canContinue(c.form, 2), c.id).toBe(true)
    }
  })

  it('each prices to a finite number at the bundled config', () => {
    for (const c of REFERENCE_CASES) {
      const r = runEngine(c.form, PRICING_CONFIG)
      expect(r.recommendedTier, c.id).not.toBe('SURVEY')
      expect(Number.isFinite(r.priceFrom), c.id).toBe(true)
    }
  })

  it('they cover every package and the custom build, so every price on the Prices page moves a row', () => {
    const tiers = REFERENCE_CASES.map((c) => runEngine(c.form, PRICING_CONFIG).recommendedTier)
    for (const t of TIER_ORDER) expect(tiers, t).toContain(t)
    expect(tiers).toContain('CUSTOM')
    // Ordered small → large, as the review table shows them.
    const prices = REFERENCE_CASES.map((c) => runEngine(c.form, PRICING_CONFIG).priceFrom ?? 0)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('golden: the package and price each household lands on', () => {
    // A deliberate regression net. If a config change moves one of these,
    // this fails on purpose; update the snapshot only when the move is meant.
    const golden = Object.fromEntries(
      REFERENCE_CASES.map((c) => {
        const r = runEngine(c.form, PRICING_CONFIG)
        return [c.id, `${r.recommendedTier} ${r.priceFrom}`]
      }),
    )
    expect(golden).toMatchSnapshot()
  })
})
