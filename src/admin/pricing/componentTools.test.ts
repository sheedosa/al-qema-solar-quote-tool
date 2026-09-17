import { describe, expect, it } from 'vitest'
import { PRICING_CONFIG } from '../../pricing/config'
import type { PricingConfig } from '../../pricing/types'
import { validatePricingConfig } from '../../pricing/validate'
import { categorize, matchesSearch, renameComponent, usedBy } from './componentTools'

const clone = (): PricingConfig => JSON.parse(JSON.stringify(PRICING_CONFIG)) as PricingConfig

describe('categorize', () => {
  it('groups every bundled component as a reader would expect', () => {
    const want: Record<string, string> = {
      'Growatt 6000W': 'inverters',
      'Growatt Hommer 5k': 'inverters',
      'Luminous 1100VA': 'inverters',
      'Luminous 1100 Solar': 'inverters',
      'Inverter 1050': 'inverters',
      'UPS 1250': 'inverters',
      'Veichi 7.5KW 3PH': 'inverters',
      'Delixi 30KW 3PH': 'inverters',
      'Luminous 200Ah': 'batteries',
      'Lithium 15KW': 'batteries',
      'Qmax Lithium 5kW': 'batteries',
      'Shoto 150Ah 12V': 'batteries',
      'Jinko 590W': 'panels',
      'Alqema Stand': 'mounting',
      'Mounting clamp': 'mounting',
      'DC Cable 2x6mm': 'mounting',
      'MTS Switch': 'mounting',
      'MCCB DC Switch': 'mounting',
      Busbar: 'mounting',
      'AC Combiner': 'mounting',
      Installation: 'services',
      'Install consumables': 'services',
      'Transport & handling': 'services',
    }
    for (const [name, cat] of Object.entries(want)) expect(categorize(name, PRICING_CONFIG), name).toBe(cat)
  })

  it('every bundled component lands somewhere other than "misc"', () => {
    for (const name of Object.keys(PRICING_CONFIG.components)) {
      expect(categorize(name, PRICING_CONFIG), name).not.toBe('misc')
    }
  })

  it('ladder rungs are large-system inverters even without a price', () => {
    expect(categorize('Commercial inverter 30kW', PRICING_CONFIG)).toBe('commercialInverters')
  })
})

describe('usedBy', () => {
  it('knows which build references a part', () => {
    expect(usedBy('Jinko 590W', PRICING_CONFIG)).toEqual({ household: true, commercial: false })
    expect(usedBy('Jinko 615W', PRICING_CONFIG)).toEqual({ household: false, commercial: true })
    expect(usedBy('Alqema Stand', PRICING_CONFIG)).toEqual({ household: true, commercial: true })
    expect(usedBy('UPS 1250', PRICING_CONFIG)).toEqual({ household: false, commercial: false })
  })
})

describe('renameComponent', () => {
  it('moves the price and every reference, keeping the list order', () => {
    const d = clone()
    const before = Object.keys(d.components)
    expect(renameComponent(d, 'Jinko 590W', 'Jinko 590 W Tiger')).toBe(true)
    expect(d.components['Jinko 590 W Tiger']).toBe(1100)
    expect(d.components['Jinko 590W']).toBeUndefined()
    expect(d.customBom.panel.component).toBe('Jinko 590 W Tiger')
    expect(Object.keys(d.components).indexOf('Jinko 590 W Tiger')).toBe(before.indexOf('Jinko 590W'))
    expect(validatePricingConfig(d).ok).toBe(true)
  })

  it('refuses an empty, identical or taken name', () => {
    const d = clone()
    expect(renameComponent(d, 'Jinko 590W', '')).toBe(false)
    expect(renameComponent(d, 'Jinko 590W', 'Jinko 590W')).toBe(false)
    expect(renameComponent(d, 'Jinko 590W', 'Busbar')).toBe(false)
    expect(renameComponent(d, 'Nope', 'X')).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('is case-insensitive and needs every term', () => {
    expect(matchesSearch('Growatt 6000W', 'gro')).toBe(true)
    expect(matchesSearch('Growatt 6000W', 'growatt 6000')).toBe(true)
    expect(matchesSearch('Growatt 6000W', 'growatt 5000')).toBe(false)
    expect(matchesSearch('Anything', '   ')).toBe(true)
  })
})
