import { describe, expect, it } from 'vitest'
import { canContinue, initialData } from './logic'

describe('Step 2 asks only about daily power cuts', () => {
  it('continues once the power-cuts answer is given', () => {
    const d = initialData()
    expect(canContinue(d, 2)).toBe(false)
    d.outageHours = '4–8 hrs'
    // The removed "keep running" and "at night" answers are no longer required.
    expect(d.operation).toBe('')
    expect(d.nightEconomy).toBe('')
    expect(canContinue(d, 2)).toBe(true)
  })
})
