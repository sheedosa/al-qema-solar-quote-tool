import { describe, expect, it } from 'vitest'
import { BUNDLES } from '../i18n'
import { PRICING_CONFIG } from '../pricing/config'
import { setAt } from '../pricing/paths'
import type { PricingConfig } from '../pricing/types'
import { validatePricingConfig } from '../pricing/validate'
import { fieldErrors, isMoneyPath, labelForError, labelForPath, labelParts, sectionOf } from './configLabels'
import { ADMIN_BUNDLES } from './strings'

const clone = (): PricingConfig => JSON.parse(JSON.stringify(PRICING_CONFIG)) as PricingConfig
const en = ADMIN_BUNDLES.en
const ar = ADMIN_BUNDLES.ar

/**
 * One mutation per `bad()` the validator can emit. Driving the real validator
 * (rather than hand-writing messages) means a reworded rule fails here too.
 */
const BREAKS: [string, (c: PricingConfig) => void][] = [
  ['configVersion', (c) => setAt(c, 'configVersion', '')],
  ['currency', (c) => setAt(c, 'currency', 'USD')],
  ['acBtuCapMode', (c) => setAt(c, 'acBtuCapMode', 'x')],
  ['packages array', (c) => setAt(c, 'packages', [])],
  ['package not object', (c) => setAt(c, 'packages[0]', 5)],
  ['tier order', (c) => setAt(c, 'packages[1].tier', 'S')],
  ['inverterKva', (c) => setAt(c, 'packages[0].inverterKva', 0)],
  ['panel spec', (c) => setAt(c, 'packages[0].panel.count', 0)],
  ['battery not object', (c) => setAt(c, 'packages[0].battery', 3)],
  ['liquid battery', (c) => setAt(c, 'packages[0].battery.count', 0)],
  ['lithium battery', (c) => setAt(c, 'packages[2].battery.kwhEach', 0)],
  ['chemistry', (c) => setAt(c, 'packages[0].battery.chemistry', 'gel')],
  ['maxAcUnits', (c) => setAt(c, 'packages[0].maxAcUnits', -1)],
  ['maxAcBtu', (c) => setAt(c, 'packages[0].maxAcBtu', 0)],
  ['price', (c) => setAt(c, 'packages[0].priceLyd', 0)],
  ['price cleared', (c) => setAt(c, 'packages[0].priceLyd', null)],
  ['monotonic', (c) => setAt(c, 'packages[1].priceLyd', 1)],
  ['includes', (c) => setAt(c, 'includes', ['x'])],
  ['addOns', (c) => setAt(c, 'addOns', [{ name: '', priceLyd: 1 }])],
  ['lifespan', (c) => setAt(c, 'batteryLifespanYears.liquid', 0)],
  ['components empty', (c) => setAt(c, 'components', {})],
  ['component empty name', (c) => setAt(c, 'components[""]', 5)],
  ['component negative', (c) => setAt(c, 'components["Jinko 590W"]', -1)],
  ['loadDefaults', (c) => setAt(c, 'loadDefaults', 1)],
  ['acWattsPerBtu', (c) => setAt(c, 'loadDefaults.acWattsPerBtu.standard', 0)],
  ['assumedAcBtu', (c) => setAt(c, 'loadDefaults.assumedAcBtu', 0)],
  ['btuPerTon', (c) => setAt(c, 'loadDefaults.btuPerTon', 0)],
  ['lightingWattsByType', (c) => setAt(c, 'loadDefaults.lightingWattsByType.led', 0)],
  ['lightingHours', (c) => setAt(c, 'loadDefaults.lightingHours', 30)],
  ['fridge duty', (c) => setAt(c, 'loadDefaults.fridge.duty', 2)],
  ['fridge multiplier', (c) => setAt(c, 'loadDefaults.fridgeConditionMultiplier.new', 0)],
  ['fridge condition', (c) => setAt(c, 'loadDefaults.defaultFridgeCondition', 'x')],
  ['appliances not object', (c) => setAt(c, 'loadDefaults.appliancesByName', 1)],
  ['preset missing', (c) => delete c.loadDefaults.appliancesByName['TV']],
  ['appliance watts', (c) => setAt(c, 'loadDefaults.appliancesByName["TV"].watts', 0)],
  ['appliance hours', (c) => setAt(c, 'loadDefaults.appliancesByName["TV"].hours', -1)],
  ['customAppliance', (c) => setAt(c, 'loadDefaults.customAppliance.watts', 0)],
  ['sizing', (c) => setAt(c, 'sizing', 1)],
  ['peakSunHours zero', (c) => setAt(c, 'sizing.peakSunHours', 0)],
  ['peakSunHours range', (c) => setAt(c, 'sizing.peakSunHours', 20)],
  ['systemEfficiency', (c) => setAt(c, 'sizing.systemEfficiency', 2)],
  ['dod', (c) => setAt(c, 'sizing.dodByChemistry.liquid', 2)],
  ['surge', (c) => setAt(c, 'sizing.surgeFactorByCategory.ac', 0)],
  ['panelAreaM2', (c) => setAt(c, 'sizing.panelAreaM2', 30)],
  ['roof areas', (c) => setAt(c, 'sizing.roofAreaM2ByAnswer["Small"]', -1)],
  ['customBom', (c) => setAt(c, 'customBom', 1)],
  ['customBom panel', (c) => setAt(c, 'customBom.panel.component', 'Nope')],
  ['customBom battery', (c) => setAt(c, 'customBom.battery.kwhEach', 0)],
  ['customBom inverter', (c) => setAt(c, 'customBom.inverter.single.maxKw', 0)],
  ['customBom stand', (c) => setAt(c, 'customBom.stand.panelsPerStand', 0)],
  ['customBom list', (c) => setAt(c, 'customBom.perPanel', 1)],
  ['customBom qty', (c) => setAt(c, 'customBom.perPanel[0].qty', 0)],
  ['customBom unknown part', (c) => setAt(c, 'customBom.fixed[4].component', 'Nope')],
  ['customBom roundUp', (c) => setAt(c, 'customBom.roundUpToLyd', 0)],
  ['customBom floor', (c) => setAt(c, 'customBom.minimumLyd', 1)],
  ['commercial', (c) => setAt(c, 'commercial', 1)],
  ['commercial batteryEfficiency', (c) => setAt(c, 'commercial.batteryEfficiency', 2)],
  ['commercial systemEfficiency', (c) => setAt(c, 'commercial.systemEfficiency', 2)],
  ['commercial peakSunHours', (c) => setAt(c, 'commercial.peakSunHours', 20)],
  ['commercial panel', (c) => setAt(c, 'commercial.panel.watts', 0)],
  ['commercial battery', (c) => setAt(c, 'commercial.battery.kwhEach', 0)],
  ['commercial stand', (c) => setAt(c, 'commercial.stand.panelsPerStand', 0)],
  ['ladder empty', (c) => setAt(c, 'commercial.inverterLadder', [])],
  ['ladder rung', (c) => setAt(c, 'commercial.inverterLadder[0].kw', 0)],
  ['ladder order', (c) => setAt(c, 'commercial.inverterLadder[1].kw', 1)],
  ['commercial list', (c) => setAt(c, 'commercial.fixed', 1)],
  ['commercial qty', (c) => setAt(c, 'commercial.fixed[0].qty', 0)],
  ['commercial part name', (c) => setAt(c, 'commercial.fixed[0].component', '')],
  ['commercial roundUp', (c) => setAt(c, 'commercial.roundUpToLyd', 0)],
  ['maxDcAcRatio', (c) => setAt(c, 'commercial.maxDcAcRatio', 0.5)],
  ['takesOverAboveKw', (c) => setAt(c, 'commercial.customerPath.takesOverAboveKw', 1)],
]

function messagesFor(mutate: (c: PricingConfig) => void): string[] {
  const c = clone()
  mutate(c)
  const r = validatePricingConfig(c)
  return r.ok ? [] : r.errors
}

describe('1. Every message the validator can emit gets a human label in both languages', () => {
  it('the table breaks something every time', () => {
    for (const [name, mutate] of BREAKS) expect(messagesFor(mutate).length, name).toBeGreaterThan(0)
  })

  for (const [name, mutate] of BREAKS) {
    it(name, () => {
      for (const msg of messagesFor(mutate)) {
        for (const [lang, t] of [
          ['en', en],
          ['ar', ar],
        ] as const) {
          const e = labelForError(msg, t, BUNDLES[lang].opt)
          expect(e.known, `${lang}: ${msg}`).toBe(true)
          expect(e.path, msg).not.toBe('')
          // No path syntax leaks into what the manager reads.
          expect(e.label, msg).not.toMatch(/[[\]"]/)
          if (/[.[]/.test(e.path)) expect(e.label, msg).not.toContain(e.path)
          expect(e.reason, msg).not.toBe('')
          if (lang === 'ar') {
            expect(e.reason, msg).toMatch(/[؀-ۿ]/)
            // Component names are the manager's own text; everything else is Arabic.
            if (!e.path.startsWith('components[')) expect(e.label, msg).toMatch(/[؀-ۿ]/)
          }
        }
      }
    })
  }

  it('an unknown reason still gets the label, and says so', () => {
    const e = labelForError('sizing.peakSunHours: is simply wrong', en)
    expect(e.known).toBe(false)
    expect(e.label).toBe('Household sizing · peak sun hours (h)')
    expect(e.reason).toBe('is simply wrong')
  })

  it('a message with no path is returned whole', () => {
    const e = labelForError('config: not an object', en)
    expect(e.path).toBe('config')
    const weird = labelForError('something went wrong', en)
    expect(weird.path).toBe('')
    expect(weird.label).toBe('something went wrong')
  })
})

describe('2. Labels read as section · item · field', () => {
  it('English', () => {
    expect(labelForPath('packages[2].priceLyd', en)).toBe('Packages · L package · price (LYD)')
    expect(labelForPath('packages[0].battery.ampHours', en)).toBe('Packages · S package · battery · capacity (Ah)')
    expect(labelForPath('components["Jinko 590W"]', en)).toBe('Component prices · Jinko 590W')
    expect(labelForPath('loadDefaults.appliancesByName["TV"].watts', en)).toBe(
      'Appliance assumptions · TV · watts (W)',
    )
    expect(labelForPath('customBom.fixed[4].component', en)).toBe('Custom build · one-off items · item 5 · part')
    expect(labelForPath('commercial.inverterLadder[1].kw', en)).toBe(
      'Large-system method · inverter sizes · size 2 · size (kW)',
    )
    expect(labelForPath('commercial.customerPath.takesOverAboveKw', en)).toBe(
      'Large-system method · customer quotes · commercial method above (kW)',
    )
  })

  it('Arabic, with customer-facing names for presets and roof answers', () => {
    expect(labelForPath('packages[2].priceLyd', ar)).toBe('الباقات · باقة L · السعر (د.ل)')
    expect(labelForPath('loadDefaults.appliancesByName["TV"].watts', ar, BUNDLES.ar.opt)).toBe(
      'افتراضات الأجهزة · ' + BUNDLES.ar.opt.preset['TV'] + ' · الواط (W)',
    )
    expect(labelForPath('sizing.roofAreaM2ByAnswer["Not sure"]', ar, BUNDLES.ar.opt)).toBe(
      'تحجيم المنازل · مساحة السطح حسب الإجابة (م²) · غير متأكد',
    )
  })

  it('parts let a caller drop the section when grouping', () => {
    expect(labelParts('packages[2].priceLyd', en)).toEqual(['Packages', 'L package', 'price (LYD)'])
    expect(sectionOf('packages[2].priceLyd')).toBe('packages')
    expect(sectionOf('components["Jinko 590W"]')).toBe('components')
  })

  it('knows which paths are money', () => {
    expect(isMoneyPath('packages[2].priceLyd')).toBe(true)
    expect(isMoneyPath('components["Jinko 590W"]')).toBe(true)
    expect(isMoneyPath('customBom.minimumLyd')).toBe(true)
    expect(isMoneyPath('addOns[0].priceLyd')).toBe(true)
    expect(isMoneyPath('sizing.peakSunHours')).toBe(false)
    expect(isMoneyPath('customBom.fixed[0].qty')).toBe(false)
  })

  it('fieldErrors keeps the first message per path', () => {
    const errs = fieldErrors(
      ['packages[1].priceLyd: must be a positive number', 'packages[1].priceLyd: prices must not decrease from S to XXL'],
      en,
    )
    expect(Object.keys(errs)).toEqual(['packages[1].priceLyd'])
    expect(errs['packages[1].priceLyd'].reason).toBe(en.pricing.paths.reason.positive)
  })
})
