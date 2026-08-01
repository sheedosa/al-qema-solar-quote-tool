import type { FormData } from '../types'
import type {
  AssumptionId,
  ConstraintId,
  Demand,
  EngineResult,
  NormalizedLoad,
  Package,
  PricingConfig,
  WaQuote,
  WarningId,
} from './types'

/**
 * Pure, deterministic sizing & tier-matching pipeline. No side effects, no
 * network, no dates — same input always yields the same output. Prices come
 * exclusively from config lookups.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/** Total panel capacity of a package in kWp. */
export function packageKwp(p: Package): number {
  return (p.panel.count * p.panel.watts) / 1000
}

/** Nominal battery energy in kWh (liquid uses the configured string voltage). */
export function packageBatteryNominalKwh(p: Package, cfg: PricingConfig): number {
  return p.battery.chemistry === 'liquid'
    ? (p.battery.count * p.battery.ampHours * cfg.sizing.liquidBatteryVoltageV) / 1000
    : p.battery.count * p.battery.kwhEach
}

/** Usable battery energy after depth-of-discharge. */
export function packageBatteryUsableKwh(p: Package, cfg: PricingConfig): number {
  return packageBatteryNominalKwh(p, cfg) * cfg.sizing.dodByChemistry[p.battery.chemistry]
}

/**
 * Step 1 — map every form answer to a uniform load record. Customer-supplied
 * values always win; gaps fall back to config defaults and set `assumed`.
 * Never throws on missing data.
 */
export function normalizeLoads(d: FormData, cfg: PricingConfig): NormalizedLoad[] {
  const ld = cfg.loadDefaults
  const loads: NormalizedLoad[] = []

  d.acUnits.forEach((u, i) => {
    const v = parseFloat(u.capValue)
    const known = !u.dontKnow && v > 0
    const btu = known ? v : ld.assumedAcBtu
    const rate = u.inverter === 'yes' ? ld.acWattsPerBtu.inverter : ld.acWattsPerBtu.standard
    loads.push({
      id: 'ac-' + (i + 1),
      label: 'AC ' + (i + 1),
      category: 'ac',
      watts: btu * rate,
      qty: 1,
      hoursPerDay: u.hours || 0,
      runAtNight: u.night,
      alwaysOn: false,
      heavyDuty: false,
      assumed: !known,
      btu,
    })
  })

  const condMult = ld.fridgeConditionMultiplier[ld.defaultFridgeCondition]
  if (d.fridge.on) {
    loads.push({
      id: 'fridge',
      label: 'Fridge',
      category: 'cold',
      watts: ld.fridge.watts * ld.fridge.duty * condMult,
      qty: d.fridge.qty,
      hoursPerDay: 24,
      runAtNight: d.fridge.alwaysOn,
      alwaysOn: d.fridge.alwaysOn,
      heavyDuty: false,
      assumed: false,
    })
  }
  if (d.freezer.on) {
    loads.push({
      id: 'freezer',
      label: 'Freezer',
      category: 'cold',
      watts: ld.freezer.watts * ld.freezer.duty * condMult,
      qty: d.freezer.qty,
      hoursPerDay: 24,
      runAtNight: d.freezer.alwaysOn,
      alwaysOn: d.freezer.alwaysOn,
      heavyDuty: false,
      assumed: false,
    })
  }

  if (d.lighting.count > 0) {
    const userWatts = parseFloat(d.lighting.watts)
    const bulbType = d.lighting.type === '' ? 'led' : d.lighting.type
    const typeKnown = d.lighting.type !== ''
    const watts = userWatts > 0 ? userWatts : ld.lightingWattsByType[bulbType]
    loads.push({
      id: 'lighting',
      label: 'Lighting',
      category: 'lighting',
      watts,
      qty: d.lighting.count,
      hoursPerDay: d.lighting.nightHours || 0,
      runAtNight: true,
      alwaysOn: false,
      heavyDuty: false,
      assumed: !(userWatts > 0) && !typeKnown,
    })
  }

  d.appliances.forEach((a) => {
    const def = a.custom ? undefined : ld.appliancesByName[a.name]
    if (def) {
      const alwaysOn = !!def.alwaysOn
      loads.push({
        id: 'appliance-' + a.id,
        label: a.name,
        category: 'appliance',
        watts: def.watts,
        qty: a.qty,
        hoursPerDay: alwaysOn ? 24 : def.hours ?? 0,
        runAtNight: alwaysOn || !!def.night,
        alwaysOn,
        heavyDuty: !!def.heavy,
        assumed: false,
      })
    } else {
      // Custom device (or defensively, an unknown preset name).
      loads.push({
        id: 'appliance-' + a.id,
        label: a.name || 'Custom device',
        category: 'appliance',
        watts: ld.customAppliance.watts,
        qty: a.qty,
        hoursPerDay: ld.customAppliance.hours,
        runAtNight: false,
        alwaysOn: false,
        heavyDuty: false,
        assumed: true,
      })
    }
  })

  return loads
}

/** Steps 2–5 — energy demand, peak power, battery and array requirements. */
export function computeDemand(loads: NormalizedLoad[], cfg: PricingConfig): Demand {
  const sz = cfg.sizing
  let dailyKwh = 0
  let nightKwh = 0
  let acPeakW = 0
  let otherPeakW = 0

  for (const l of loads) {
    dailyKwh += (l.watts * l.qty * l.hoursPerDay) / 1000
    if (l.runAtNight || l.alwaysOn) {
      const nightHours = l.alwaysOn
        ? sz.alwaysOnNightHours
        : l.category === 'lighting'
          ? l.hoursPerDay // the lighting slider IS the night-hours question
          : Math.min(l.hoursPerDay, sz.alwaysOnNightHours)
      nightKwh += (l.watts * l.qty * nightHours) / 1000
    }
    // ACs count at full watts — they genuinely run together. Everything else
    // is diversified.
    if (l.category === 'ac') acPeakW += l.watts * l.qty
    else otherPeakW += l.watts * l.qty
  }

  const peakW = acPeakW + sz.diversityFactor * otherPeakW
  return {
    dailyKwh,
    nightKwh,
    peakW,
    inverterKw: (peakW * sz.inverterSafetyFactor) / 1000,
    requiredKwp: dailyKwh / (sz.peakSunHours * sz.systemEfficiency),
    requiredUsableKwh: nightKwh,
  }
}

/** Constraint ids a package fails for the given demand. Empty = match. */
function failedConstraints(
  p: Package,
  demand: Demand,
  acLoads: NormalizedLoad[],
  cfg: PricingConfig,
): ConstraintId[] {
  const failed: ConstraintId[] = []
  if (p.inverterKva * cfg.sizing.kvaToKw < demand.inverterKw) failed.push('inverter')
  if (packageBatteryUsableKwh(p, cfg) < demand.requiredUsableKwh) failed.push('battery')
  if (packageKwp(p) < demand.requiredKwp) failed.push('panels')
  if (p.maxAcUnits < acLoads.length) failed.push('acCount')
  if (
    cfg.acBtuCapMode === 'strict' &&
    p.maxAcBtu !== null &&
    acLoads.some((a) => (a.btu ?? 0) > (p.maxAcBtu as number))
  ) {
    failed.push('acBtu')
  }
  return failed
}

/** Steps 6–8 — tier match, custom fallback, guardrails. */
export function runEngine(d: FormData, cfg: PricingConfig): EngineResult {
  const loads = normalizeLoads(d, cfg)
  const demand = computeDemand(loads, cfg)
  const acLoads = loads.filter((l) => l.category === 'ac')

  let matched: Package | null = null
  let binding: ConstraintId[] = []
  for (const p of cfg.packages) {
    const failed = failedConstraints(p, demand, acLoads, cfg)
    if (failed.length === 0) {
      matched = p
      break
    }
    binding = failed
  }

  const warnings: WarningId[] = []
  if (loads.some((l) => l.heavyDuty)) warnings.push('heavyDutyLoad')
  if (
    matched &&
    matched.maxAcBtu !== null &&
    acLoads.some((a) => (a.btu ?? 0) > (matched.maxAcBtu as number))
  ) {
    warnings.push('acBtuExceeded') // advisory mode only — strict gates this
  }

  const assumptionsMade: AssumptionId[] = []
  if (acLoads.some((l) => l.assumed)) assumptionsMade.push('acSizeAssumed')
  if (loads.some((l) => l.category === 'lighting' && l.assumed)) {
    assumptionsMade.push('lightingAssumed')
  }
  if (loads.some((l) => l.category === 'appliance' && l.assumed)) {
    assumptionsMade.push('customApplianceAssumed')
  }

  return {
    dailyKwh: round2(demand.dailyKwh),
    nightKwh: round2(demand.nightKwh),
    peakKw: round2(demand.peakW / 1000),
    requiredKwp: round2(demand.requiredKwp),
    recommendedTier: matched ? matched.tier : 'CUSTOM',
    priceFrom: matched ? matched.priceLyd : null,
    currency: cfg.currency,
    specs: matched
      ? {
          inverter: {
            kva: matched.inverterKva,
            kw: round2(matched.inverterKva * cfg.sizing.kvaToKw),
          },
          panels: {
            count: matched.panel.count,
            watts: matched.panel.watts,
            kwp: round2(packageKwp(matched)),
          },
          battery: {
            chemistry: matched.battery.chemistry,
            nominalKwh: round2(packageBatteryNominalKwh(matched, cfg)),
            usableKwh: round2(packageBatteryUsableKwh(matched, cfg)),
            lifespanYears: cfg.batteryLifespanYears[matched.battery.chemistry],
          },
        }
      : null,
    includes: matched ? cfg.includes : [],
    addOnsAvailable: matched ? cfg.addOns.map((a) => a.name) : [],
    runtimeNote: 'upTo12h',
    confidence: assumptionsMade.length > 0 ? 'low' : 'high',
    assumptionsMade,
    warnings,
    constraintsBinding: binding,
    isCustom: !matched,
    configVersion: cfg.configVersion,
    loads,
  }
}

/** Compact summary for the WhatsApp message. */
export function toWaQuote(r: EngineResult): WaQuote {
  return {
    tier: r.recommendedTier,
    priceFrom: r.priceFrom,
    dailyKwh: Math.round(r.dailyKwh),
    isCustom: r.isCustom,
    configVersion: r.configVersion,
  }
}

/**
 * Price a bill of materials from the retail component list (custom path /
 * invoice reconciliation). Throws on an unknown component name so a renamed
 * config entry can't silently zero out a line item.
 */
export function bomTotal(items: { name: string; qty: number }[], cfg: PricingConfig): number {
  return items.reduce((sum, item) => {
    const rate = cfg.components[item.name]
    if (rate === undefined) throw new Error('Unknown component: ' + item.name)
    return sum + rate * item.qty
  }, 0)
}
