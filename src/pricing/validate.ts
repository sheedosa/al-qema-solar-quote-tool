import { PRESET_NAMES } from '../logic'
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

/** Package order, S to XXL. Exported so the admin labels a row by tier, not index. */
export const TIER_ORDER = ['S', 'M', 'L', 'XL', 'XXL']
const INCLUDE_IDS = ['installConnection', 'economyLighting', 'tvScreen', 'fridge', 'freezerOrPump']

/**
 * Sane ranges for the sizing constants, as [key, min, max]. Type checks alone
 * let a typo through: every value below is physically bounded, so the bound is
 * part of the contract rather than a matter of taste.
 */
const SIZING_BOUNDS: readonly [string, number, number][] = [
  ['peakSunHours', 1, 12], // more than 12 h of usable sun is not a place on Earth
  ['inverterSafetyFactor', 1, 3], // below 1 would size the inverter under peak
  ['liquidBatteryVoltageV', 2, 240],
  ['kvaToKw', 0.5, 1], // power factor; above 1 would invent capacity
  ['alwaysOnNightHours', 1, 24],
]

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
      // Every chip the form offers must have a power figure. A renamed or
      // deleted key fails nowhere: the engine silently falls back to the
      // 100 W / 4 h "custom device" default, so every customer tapping that
      // chip gets a quietly wrong quote.
      for (const preset of PRESET_NAMES) {
        if (!isRecord(apps[preset])) {
          bad(
            'loadDefaults.appliancesByName',
            "missing '" + preset + "' — the form offers it, so it needs a power figure",
          )
        }
      }
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
    // Plausibility bounds, not just "is a number". Every one of these was
    // previously unbounded, so a misplaced decimal published silently:
    // peakSunHours 55 under-sizes every array, kvaToKw 100 disables the
    // inverter check entirely, and 0.01 forces every customer to CUSTOM.
    for (const [key, min, max] of SIZING_BOUNDS) {
      const v = sz[key]
      if (!finitePos(v)) bad('sizing.' + key, 'must be a positive number')
      else if (v < min || v > max) {
        bad('sizing.' + key, 'must be between ' + min + ' and ' + max)
      }
    }
    for (const key of ['systemEfficiency', 'diversityFactor']) {
      if (!fraction(sz[key])) bad('sizing.' + key, 'must be in (0, 1]')
    }
    const dod = sz.dodByChemistry
    if (!isRecord(dod) || !fraction(dod.liquid) || !fraction(dod.lithium)) {
      bad('sizing.dodByChemistry', 'liquid and lithium must be in (0, 1]')
    }
    const surge = sz.surgeFactorByCategory
    if (
      !isRecord(surge) ||
      !(['ac', 'cold', 'lighting', 'appliance'] as const).every(
        (k) => finitePos(surge[k]) && (surge[k] as number) >= 1 && (surge[k] as number) <= 10,
      )
    ) {
      bad('sizing.surgeFactorByCategory', 'ac/cold/lighting/appliance must each be between 1 and 10')
    }
    if (!finitePos(sz.panelAreaM2) || (sz.panelAreaM2 as number) > 20) {
      bad('sizing.panelAreaM2', 'must be a positive number of m² under 20')
    }
    const roof = sz.roofAreaM2ByAnswer
    if (!isRecord(roof) || !Object.values(roof).every((v) => finiteNonNeg(v))) {
      bad('sizing.roofAreaM2ByAnswer', 'every entry must be a non-negative number of m²')
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
    // The floor must not undercut the largest package, or a strictly bigger
    // requirement could be quoted below XXL. Today that holds only because the
    // two numbers were hand-matched; here it becomes a rule.
    if (finitePos(cb.minimumLyd) && Array.isArray(pkgs) && pkgs.length === 5) {
      const top = pkgs[4]
      if (isRecord(top) && finitePos(top.priceLyd) && cb.minimumLyd < top.priceLyd) {
        bad(
          'customBom.minimumLyd',
          'must be at least the XXL price (' + top.priceLyd + ') or custom builds undercut it',
        )
      }
    }
  }

  // --- commercial (optional) ----------------------------------------------
  // Absent is legal. This validator gates the customer boot path as well as
  // the admin save, so requiring a block the live config predates would take
  // every visitor down to bundled prices to protect an internal calculator.
  if (x.commercial !== undefined) {
    const cm = x.commercial
    if (!isRecord(cm)) {
      bad('commercial', 'not an object')
    } else {
      if (!fraction(cm.batteryEfficiency)) {
        bad('commercial.batteryEfficiency', 'must be between 0 and 1')
      }
      if (!fraction(cm.systemEfficiency)) {
        bad('commercial.systemEfficiency', 'must be between 0 and 1')
      }
      if (!finitePos(cm.peakSunHours) || cm.peakSunHours > 12) {
        bad('commercial.peakSunHours', 'must be between 0 and 12')
      }
      // Component names are NOT required to exist in the rate card here: the
      // commercial prices have not been confirmed, and the calculator reports
      // an unpriced line rather than refusing to load the whole config.
      const panel = cm.panel
      if (!isRecord(panel) || !nonEmptyString(panel.component) || !finitePos(panel.watts)) {
        bad('commercial.panel', 'needs a component name and watts > 0')
      }
      const battery = cm.battery
      if (!isRecord(battery) || !nonEmptyString(battery.component) || !finitePos(battery.kwhEach)) {
        bad('commercial.battery', 'needs a component name and kwhEach > 0')
      }
      const stand = cm.stand
      if (!isRecord(stand) || !nonEmptyString(stand.component) || !posInt(stand.panelsPerStand)) {
        bad('commercial.stand', 'needs a component name and integer panelsPerStand > 0')
      }
      const ladder = cm.inverterLadder
      if (!Array.isArray(ladder) || ladder.length === 0) {
        bad('commercial.inverterLadder', 'needs at least one size')
      } else {
        let prevKw = 0
        ladder.forEach((rung: unknown, i: number) => {
          const at = 'commercial.inverterLadder[' + i + ']'
          if (!isRecord(rung) || !finitePos(rung.kw) || !nonEmptyString(rung.component)) {
            bad(at, 'needs kw > 0 and a component name')
            return
          }
          // The chooser takes the first rung at or above the load, so an
          // out-of-order ladder would hand back the wrong machine.
          if (rung.kw <= prevKw) bad(at + '.kw', 'sizes must ascend')
          prevKw = rung.kw
        })
      }
      for (const listKey of ['perPanel', 'perInverter', 'fixed'] as const) {
        const list = cm[listKey]
        if (!Array.isArray(list)) {
          bad('commercial.' + listKey, 'must be an array')
          continue
        }
        list.forEach((item: unknown, i: number) => {
          const at = 'commercial.' + listKey + '[' + i + ']'
          if (!isRecord(item) || !finitePos(item.qty)) bad(at, 'needs qty > 0')
          else if (!nonEmptyString(item.component)) bad(at + '.component', 'needs a name')
        })
      }
      if (!finitePos(cm.roundUpToLyd)) bad('commercial.roundUpToLyd', 'must be positive')
      if (!finitePos(cm.maxDcAcRatio) || cm.maxDcAcRatio < 1) {
        bad('commercial.maxDcAcRatio', 'must be at least 1')
      }
      const cp = cm.customerPath
      if (
        !isRecord(cp) ||
        !finitePos(cp.takesOverAboveKw) ||
        cp.takesOverAboveKw < 5 ||
        cp.takesOverAboveKw > 300
      ) {
        bad('commercial.customerPath.takesOverAboveKw', 'must be between 5 and 300 kW')
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, config: x as unknown as PricingConfig }
}
