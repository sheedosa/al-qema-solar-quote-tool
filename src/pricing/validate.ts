import type { PricingConfig } from './types'

/**
 * Structural validator for a pricing config arriving from outside the bundle
 * (the remote database, the local cache, or the admin editor). Collects every
 * problem instead of bailing at the first, so the admin sees a full list.
 *
 * Shared by the boot-time loader and the admin panel's save path — the same
 * checks gate both, so an admin can never activate a config the app would
 * refuse to load.
 */

export type ValidationResult =
  | { ok: true; config: PricingConfig }
  | { ok: false; errors: string[] }

const TIER_ORDER = ['S', 'M', 'L', 'XL', 'XXL']
const INCLUDE_IDS = ['installConnection', 'economyLighting', 'tvScreen', 'fridge', 'freezerOrPump']

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const finitePos = (x: unknown): x is number => typeof x === 'number' && isFinite(x) && x > 0
const finiteNonNeg = (x: unknown): x is number => typeof x === 'number' && isFinite(x) && x >= 0
const posInt = (x: unknown): x is number => finitePos(x) && Number.isInteger(x)
const nonNegInt = (x: unknown): x is number => finiteNonNeg(x) && Number.isInteger(x)
const fraction = (x: unknown): x is number => finitePos(x) && x <= 1
const nonEmptyString = (x: unknown): x is string => typeof x === 'string' && x.length > 0

export function validatePricingConfig(x: unknown): ValidationResult {
  const errors: string[] = []
  const bad = (path: string, why: string) => errors.push(path + ': ' + why)

  if (!isRecord(x)) return { ok: false, errors: ['config: not an object'] }

  if (!nonEmptyString(x.configVersion)) bad('configVersion', 'must be a non-empty string')
  if (x.currency !== 'LYD') bad('currency', "must be 'LYD'")
  if (x.acBtuCapMode !== 'advisory' && x.acBtuCapMode !== 'strict') {
    bad('acBtuCapMode', "must be 'advisory' or 'strict'")
  }

  // --- packages -----------------------------------------------------------
  const pkgs = x.packages
  if (!Array.isArray(pkgs) || pkgs.length !== 5) {
    bad('packages', 'must be an array of exactly 5 packages')
  } else {
    let prevPrice = 0
    pkgs.forEach((p: unknown, i: number) => {
      const at = 'packages[' + i + ']'
      if (!isRecord(p)) return bad(at, 'not an object')
      if (p.tier !== TIER_ORDER[i]) bad(at + '.tier', 'must be ' + TIER_ORDER[i] + ' (in order)')
      if (!finitePos(p.inverterKva)) bad(at + '.inverterKva', 'must be a positive number')
      const panel = p.panel
      if (!isRecord(panel) || !posInt(panel.count) || !finitePos(panel.watts)) {
        bad(at + '.panel', 'needs integer count > 0 and watts > 0')
      }
      const b = p.battery
      if (!isRecord(b)) {
        bad(at + '.battery', 'not an object')
      } else if (b.chemistry === 'liquid') {
        if (!posInt(b.count) || !finitePos(b.ampHours)) {
          bad(at + '.battery', 'liquid needs integer count > 0 and ampHours > 0')
        }
      } else if (b.chemistry === 'lithium') {
        if (!posInt(b.count) || !finitePos(b.kwhEach)) {
          bad(at + '.battery', 'lithium needs integer count > 0 and kwhEach > 0')
        }
      } else {
        bad(at + '.battery.chemistry', "must be 'liquid' or 'lithium'")
      }
      if (!nonNegInt(p.maxAcUnits)) bad(at + '.maxAcUnits', 'must be an integer ≥ 0')
      if (p.maxAcBtu !== null && !finitePos(p.maxAcBtu)) {
        bad(at + '.maxAcBtu', 'must be null or a positive number')
      }
      if (!finitePos(p.priceLyd)) {
        bad(at + '.priceLyd', 'must be a positive number')
      } else {
        if ((p.priceLyd as number) < prevPrice) {
          bad(at + '.priceLyd', 'prices must not decrease from S to XXL')
        }
        prevPrice = p.priceLyd as number
      }
    })
  }

  // --- includes / add-ons / lifespans ------------------------------------
  if (!Array.isArray(x.includes) || x.includes.some((i) => !INCLUDE_IDS.includes(i as string))) {
    bad('includes', 'must only contain known include ids')
  }
  if (
    !Array.isArray(x.addOns) ||
    x.addOns.some((a: unknown) => !isRecord(a) || !nonEmptyString(a.name) || !finitePos(a.priceLyd))
  ) {
    bad('addOns', 'each add-on needs a name and a positive priceLyd')
  }
  const life = x.batteryLifespanYears
  if (!isRecord(life) || !finitePos(life.liquid) || !finitePos(life.lithium)) {
    bad('batteryLifespanYears', 'liquid and lithium must be positive numbers')
  }

  // --- components ---------------------------------------------------------
  const comps = x.components
  if (!isRecord(comps) || Object.keys(comps).length === 0) {
    bad('components', 'must be a non-empty name → price map')
  } else {
    for (const [name, price] of Object.entries(comps)) {
      if (!nonEmptyString(name)) bad('components', 'contains an empty component name')
      if (!finiteNonNeg(price)) bad('components["' + name + '"]', 'price must be a number ≥ 0')
    }
  }
  const hasComponent = (name: unknown): boolean =>
    nonEmptyString(name) && isRecord(comps) && comps[name] !== undefined

  // --- loadDefaults -------------------------------------------------------
  const ld = x.loadDefaults
  if (!isRecord(ld)) {
    bad('loadDefaults', 'not an object')
  } else {
    const acRate = ld.acWattsPerBtu
    if (!isRecord(acRate) || !finitePos(acRate.standard) || !finitePos(acRate.inverter)) {
      bad('loadDefaults.acWattsPerBtu', 'standard and inverter must be positive numbers')
    }
    if (!finitePos(ld.assumedAcBtu)) bad('loadDefaults.assumedAcBtu', 'must be positive')
    if (!finitePos(ld.btuPerTon)) bad('loadDefaults.btuPerTon', 'must be positive')
    const lw = ld.lightingWattsByType
    if (!isRecord(lw) || !finitePos(lw.led) || !finitePos(lw.regular) || !finitePos(lw.mixed)) {
      bad('loadDefaults.lightingWattsByType', 'led/regular/mixed must be positive numbers')
    }
    if (!finiteNonNeg(ld.lightingHours) || (ld.lightingHours as number) > 24) {
      bad('loadDefaults.lightingHours', 'must be a number between 0 and 24')
    }
    for (const key of ['fridge', 'freezer'] as const) {
      const c = ld[key]
      if (!isRecord(c) || !finitePos(c.watts) || !fraction(c.duty)) {
        bad('loadDefaults.' + key, 'needs watts > 0 and duty in (0, 1]')
      }
    }
    const mult = ld.fridgeConditionMultiplier
    if (!isRecord(mult) || !finitePos(mult.new) || !finitePos(mult.old)) {
      bad('loadDefaults.fridgeConditionMultiplier', 'new and old must be positive')
    }
    if (ld.defaultFridgeCondition !== 'new' && ld.defaultFridgeCondition !== 'old') {
      bad('loadDefaults.defaultFridgeCondition', "must be 'new' or 'old'")
    }
    const apps = ld.appliancesByName
    if (!isRecord(apps)) {
      bad('loadDefaults.appliancesByName', 'not an object')
    } else {
      for (const [name, def] of Object.entries(apps)) {
        const at = 'loadDefaults.appliancesByName["' + name + '"]'
        if (!isRecord(def) || !finitePos(def.watts)) bad(at, 'needs watts > 0')
        else if (def.hours !== undefined && !finiteNonNeg(def.hours)) bad(at + '.hours', '≥ 0')
      }
    }
    const custom = ld.customAppliance
    if (!isRecord(custom) || !finitePos(custom.watts) || !finiteNonNeg(custom.hours)) {
      bad('loadDefaults.customAppliance', 'needs watts > 0 and hours ≥ 0')
    }
  }

  // --- sizing -------------------------------------------------------------
  const sz = x.sizing
  if (!isRecord(sz)) {
    bad('sizing', 'not an object')
  } else {
    for (const key of [
      'peakSunHours',
      'inverterSafetyFactor',
      'liquidBatteryVoltageV',
      'kvaToKw',
      'alwaysOnNightHours',
    ]) {
      if (!finitePos(sz[key])) bad('sizing.' + key, 'must be a positive number')
    }
    for (const key of ['systemEfficiency', 'diversityFactor']) {
      if (!fraction(sz[key])) bad('sizing.' + key, 'must be in (0, 1]')
    }
    const dod = sz.dodByChemistry
    if (!isRecord(dod) || !fraction(dod.liquid) || !fraction(dod.lithium)) {
      bad('sizing.dodByChemistry', 'liquid and lithium must be in (0, 1]')
    }
  }

  // --- customBom ----------------------------------------------------------
  const cb = x.customBom
  if (!isRecord(cb)) {
    bad('customBom', 'not an object')
  } else {
    const panel = cb.panel
    if (!isRecord(panel) || !hasComponent(panel.component) || !finitePos(panel.watts)) {
      bad('customBom.panel', 'needs a known component name and watts > 0')
    }
    const battery = cb.battery
    if (!isRecord(battery) || !hasComponent(battery.component) || !finitePos(battery.kwhEach)) {
      bad('customBom.battery', 'needs a known component name and kwhEach > 0')
    }
    const inv = cb.inverter
    if (
      !isRecord(inv) ||
      !isRecord(inv.single) ||
      !hasComponent(inv.single.component) ||
      !finitePos(inv.single.maxKw) ||
      !isRecord(inv.parallel) ||
      !hasComponent(inv.parallel.component) ||
      !finitePos(inv.parallel.unitKw)
    ) {
      bad('customBom.inverter', 'single and parallel need known components and positive kW')
    }
    const stand = cb.stand
    if (!isRecord(stand) || !hasComponent(stand.component) || !posInt(stand.panelsPerStand)) {
      bad('customBom.stand', 'needs a known component and integer panelsPerStand > 0')
    }
    for (const listKey of ['perPanel', 'perInverter', 'fixed'] as const) {
      const list = cb[listKey]
      if (!Array.isArray(list)) {
        bad('customBom.' + listKey, 'must be an array')
        continue
      }
      list.forEach((item: unknown, i: number) => {
        const at = 'customBom.' + listKey + '[' + i + ']'
        if (!isRecord(item) || !finitePos(item.qty)) bad(at, 'needs qty > 0')
        else if (!hasComponent(item.component)) {
          bad(at + '.component', 'not found in the component list')
        }
      })
    }
    if (!finitePos(cb.roundUpToLyd)) bad('customBom.roundUpToLyd', 'must be positive')
    if (!finitePos(cb.minimumLyd)) bad('customBom.minimumLyd', 'must be positive')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, config: x as unknown as PricingConfig }
}
