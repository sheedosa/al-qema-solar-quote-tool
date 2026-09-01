import type { FormData } from '../types'
import type {
  AssumptionId,
  ConstraintId,
  CustomBomLine,
  CustomBuild,
  Demand,
  EngineResult,
  NormalizedLoad,
  Package,
  PricingConfig,
  SystemSpecs,
  WaQuote,
  WarningId,
} from './types'

/**
 * Pure, deterministic sizing & tier-matching pipeline. No side effects, no
 * network, no dates — same input always yields the same output. Prices come
 * exclusively from config lookups.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Guard for every number that reaches a comparison. `x < NaN` is false, so an
 * unguarded NaN demand fails ZERO constraints and silently matches the
 * cheapest package — the worst possible failure mode for a pricing tool.
 */
const finite = (n: number): boolean => Number.isFinite(n)

/** A quantity from form state, coerced to a safe non-negative number. */
const safeQty = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0)

/** A load's peak draw, recovering true watts from the duty-cycle average. */
function peakOf(watts: number, category: NormalizedLoad['category'], cfg: PricingConfig): number {
  return watts * cfg.sizing.surgeFactorByCategory[category]
}

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
    const watts = btu * rate
    loads.push({
      id: 'ac-' + (i + 1),
      label: 'AC ' + (i + 1),
      category: 'ac',
      watts,
      peakWatts: peakOf(watts, 'ac', cfg),
      qty: 1,
      hoursPerDay: safeQty(u.hours),
      runAtNight: u.night,
      alwaysOn: false,
      heavyDuty: false,
      assumed: !known,
      btu,
    })
  })

  // The condition multiplier is a FRIDGE figure and applies to the fridge
  // only. It used to be applied to the freezer too, which was harmless while
  // the multiplier sat at 1.0 and silently wrong the moment it changed.
  const condMult = ld.fridgeConditionMultiplier[ld.defaultFridgeCondition]
  if (d.fridge.on) {
    const watts = ld.fridge.watts * ld.fridge.duty * condMult
    loads.push({
      id: 'fridge',
      label: 'Fridge',
      category: 'cold',
      watts,
      peakWatts: peakOf(watts, 'cold', cfg),
      qty: safeQty(d.fridge.qty),
      hoursPerDay: 24,
      runAtNight: d.fridge.alwaysOn,
      alwaysOn: d.fridge.alwaysOn,
      heavyDuty: false,
      assumed: false,
    })
  }
  if (d.freezer.on) {
    const watts = ld.freezer.watts * ld.freezer.duty
    loads.push({
      id: 'freezer',
      label: 'Freezer',
      category: 'cold',
      watts,
      peakWatts: peakOf(watts, 'cold', cfg),
      qty: safeQty(d.freezer.qty),
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
      peakWatts: peakOf(watts, 'lighting', cfg),
      qty: safeQty(d.lighting.count),
      hoursPerDay: ld.lightingHours,
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
        peakWatts: peakOf(def.watts, 'appliance', cfg),
        qty: safeQty(a.qty),
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
        peakWatts: peakOf(ld.customAppliance.watts, 'appliance', cfg),
        qty: safeQty(a.qty),
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

/**
 * Steps 2–5 — energy demand, peak power, battery and array requirements.
 * `nightExcludedIds` removes loads from the BATTERY sizing only (the customer
 * won't run them during a cut) — their daily energy and peak power still count.
 */
export function computeDemand(
  loads: NormalizedLoad[],
  cfg: PricingConfig,
  nightExcludedIds?: ReadonlySet<string>,
): Demand {
  const sz = cfg.sizing
  let dailyKwh = 0
  let nightKwh = 0
  let acPeakW = 0
  let otherPeakW = 0

  for (const l of loads) {
    dailyKwh += (l.watts * l.qty * l.hoursPerDay) / 1000
    if ((l.runAtNight || l.alwaysOn) && !nightExcludedIds?.has(l.id)) {
      const nightHours = l.alwaysOn
        ? sz.alwaysOnNightHours
        : Math.min(l.hoursPerDay, sz.alwaysOnNightHours)
      nightKwh += (l.watts * l.qty * nightHours) / 1000
    }
    // A load set to zero hours a day draws nothing and must not size the
    // inverter — three never-used AC rows used to push a customer to CUSTOM.
    if (l.hoursPerDay <= 0) continue
    // ACs count at full peak — they genuinely run together. Everything else
    // is diversified.
    if (l.category === 'ac') acPeakW += l.peakWatts * l.qty
    else otherPeakW += l.peakWatts * l.qty
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

/**
 * Which loads the power-cut priority answer removes from BATTERY sizing.
 * 'essentials' → all ACs; 'essentials_ac' → all but the N largest-BTU
 * night-running ACs (conservative: the biggest units count); 'full' or
 * unanswered → nothing (undefined).
 */
export function nightPriorityExclusions(
  d: FormData,
  loads: NormalizedLoad[],
): ReadonlySet<string> | undefined {
  const acs = loads.filter((l) => l.category === 'ac')
  if (d.priority === 'essentials') {
    return new Set(acs.map((l) => l.id))
  }
  if (d.priority === 'essentials_ac') {
    const keep = Math.max(1, d.priorityAcCount)
    const nightAcs = acs
      .filter((l) => l.runAtNight)
      .slice()
      .sort((a, b) => (b.btu ?? 0) - (a.btu ?? 0))
    return new Set(nightAcs.slice(keep).map((l) => l.id))
  }
  return undefined
}

/**
 * Size and price a custom (beyond-packages) system as a bill of materials
 * from the retail component list. Throws on a component name missing from
 * `cfg.components` — the config validator prevents that in practice.
 */
export function priceCustomBom(
  demand: Demand,
  cfg: PricingConfig,
): { build: CustomBuild; specs: SystemSpecs } {
  const cb = cfg.customBom
  const rate = (name: string): number => {
    const r = cfg.components[name]
    if (r === undefined) throw new Error('Unknown component: ' + name)
    return r
  }

  // `Math.max(1, …)` is not a NaN guard — Math.max(1, NaN) is NaN — so the
  // counts are clamped through a helper that rejects non-finite input.
  const atLeastOne = (n: number) => (Number.isFinite(n) && n > 1 ? Math.ceil(n) : 1)

  const panels = atLeastOne((demand.requiredKwp * 1000) / cb.panel.watts)
  const usablePerBattery = cb.battery.kwhEach * cfg.sizing.dodByChemistry.lithium
  const batteries = atLeastOne(demand.requiredUsableKwh / usablePerBattery)
  const single = demand.inverterKw <= cb.inverter.single.maxKw
  const inverterCount = single ? 1 : atLeastOne(demand.inverterKw / cb.inverter.parallel.unitKw)
  const inverterName = single ? cb.inverter.single.component : cb.inverter.parallel.component
  const inverterKw = single ? cb.inverter.single.maxKw : inverterCount * cb.inverter.parallel.unitKw
  const stands = atLeastOne(panels / cb.stand.panelsPerStand)

  const lines: CustomBomLine[] = []
  const add = (name: string, qty: number) => {
    const unitLyd = rate(name)
    lines.push({ name, qty, unitLyd, totalLyd: unitLyd * qty })
  }

  add(cb.panel.component, panels)
  add(cb.battery.component, batteries)
  add(inverterName, inverterCount)
  add(cb.stand.component, stands)
  for (const item of cb.perPanel) add(item.component, item.qty * panels)
  for (const item of cb.perInverter) add(item.component, item.qty * inverterCount)
  for (const item of cb.fixed) add(item.component, item.qty)

  const subtotalLyd = lines.reduce((sum, l) => sum + l.totalLyd, 0)
  const rounded = Math.ceil(subtotalLyd / cb.roundUpToLyd) * cb.roundUpToLyd
  const totalLyd = Math.max(rounded, cb.minimumLyd)

  return {
    build: { lines, subtotalLyd, totalLyd, floorApplied: rounded < cb.minimumLyd },
    specs: {
      inverter: {
        kw: inverterKw,
        kva: round2(inverterKw / cfg.sizing.kvaToKw),
      },
      panels: {
        count: panels,
        watts: cb.panel.watts,
        kwp: round2((panels * cb.panel.watts) / 1000),
      },
      battery: {
        chemistry: 'lithium',
        nominalKwh: round2(batteries * cb.battery.kwhEach),
        usableKwh: round2(batteries * usablePerBattery),
        lifespanYears: cfg.batteryLifespanYears.lithium,
      },
    },
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

/**
 * Assumptions that mean we genuinely did not know something the customer could
 * have told us. `usageHoursAssumed` is deliberately absent: it applies to
 * nearly every quote, so treating it as a confidence hit would flag everything
 * and tell the sales team nothing.
 */
const CONFIDENCE_LOWERING: readonly AssumptionId[] = [
  'acSizeAssumed',
  'lightingAssumed',
  'customApplianceAssumed',
]

const lowersConfidence = (made: AssumptionId[]): boolean =>
  made.some((a) => CONFIDENCE_LOWERING.includes(a))

/** Package specs in the shared output shape. */
function packageSpecs(p: Package, cfg: PricingConfig): SystemSpecs {
  return {
    inverter: { kva: p.inverterKva, kw: round2(p.inverterKva * cfg.sizing.kvaToKw) },
    panels: { count: p.panel.count, watts: p.panel.watts, kwp: round2(packageKwp(p)) },
    battery: {
      chemistry: p.battery.chemistry,
      nominalKwh: round2(packageBatteryNominalKwh(p, cfg)),
      usableKwh: round2(packageBatteryUsableKwh(p, cfg)),
      lifespanYears: cfg.batteryLifespanYears[p.battery.chemistry],
    },
  }
}

/**
 * Hours the battery actually covers the customer's night load. Previously the
 * result screen claimed a flat "up to 12h" for every system regardless of
 * headroom; this derives it. null when there is no night load to cover.
 */
function runtimeHoursFor(specs: SystemSpecs, demand: Demand, cfg: PricingConfig): number | null {
  if (!finite(demand.nightKwh) || demand.nightKwh <= 0) return null
  const avgNightKw = demand.nightKwh / cfg.sizing.alwaysOnNightHours
  if (!finite(avgNightKw) || avgNightKw <= 0) return null
  const hours = specs.battery.usableKwh / avgNightKw
  if (!finite(hours)) return null
  // Never advertise more than a night; the figure is a floor, not a promise.
  return Math.min(round2(hours), 24)
}

/** A result we cannot price: too large, or the inputs made no sense. */
function surveyResult(
  loads: NormalizedLoad[],
  demand: Demand,
  cfg: PricingConfig,
  warnings: WarningId[],
  assumptionsMade: AssumptionId[],
  binding: ConstraintId[],
  customBuild: CustomBuild | null,
): EngineResult {
  const num = (n: number) => (finite(n) ? round2(n) : 0)
  return {
    dailyKwh: num(demand.dailyKwh),
    nightKwh: num(demand.nightKwh),
    peakKw: num(demand.peakW / 1000),
    requiredKwp: num(demand.requiredKwp),
    recommendedTier: 'SURVEY',
    priceFrom: null,
    currency: cfg.currency,
    specs: null,
    includes: [],
    addOnsAvailable: [],
    runtimeHours: null,
    confidence: 'low',
    assumptionsMade,
    warnings,
    constraintsBinding: binding,
    isCustom: true,
    customBuild,
    configVersion: cfg.configVersion,
    loads,
  }
}

/** Steps 6–8 — tier match, custom fallback, guardrails. */
export function runEngine(d: FormData, cfg: PricingConfig): EngineResult {
  const loads = normalizeLoads(d, cfg)
  const demand = computeDemand(loads, cfg, nightPriorityExclusions(d, loads))
  // A zero-hour AC draws nothing and must not consume an AC slot either.
  const acLoads = loads.filter((l) => l.category === 'ac' && l.hoursPerDay > 0)

  const warnings: WarningId[] = []
  if (loads.some((l) => l.heavyDuty)) warnings.push('heavyDutyLoad')

  const assumptionsMade: AssumptionId[] = []
  if (acLoads.some((l) => l.assumed)) assumptionsMade.push('acSizeAssumed')
  if (loads.some((l) => l.category === 'lighting' && l.assumed)) {
    assumptionsMade.push('lightingAssumed')
  }
  if (loads.some((l) => l.category === 'appliance' && l.assumed)) {
    assumptionsMade.push('customApplianceAssumed')
  }
  // Running hours per device are never asked — every quote rests on them, so
  // they belong in the disclosure list. They do NOT lower confidence: they
  // apply to virtually every submission, and a signal that is always on tells
  // the sales team nothing.
  if (loads.some((l) => l.category === 'appliance' || l.category === 'lighting')) {
    assumptionsMade.push('usageHoursAssumed')
  }

  // Nothing downstream may compare against a non-finite number: `x < NaN` is
  // false, so a NaN demand would fail zero constraints and match the CHEAPEST
  // package. Bail to a survey instead.
  const demandIsSane =
    finite(demand.dailyKwh) &&
    finite(demand.nightKwh) &&
    finite(demand.inverterKw) &&
    finite(demand.requiredKwp) &&
    finite(demand.requiredUsableKwh)
  if (!demandIsSane) {
    return surveyResult(loads, demand, cfg, warnings, assumptionsMade, [], null)
  }

  let matched: Package | null = null
  const binding: ConstraintId[] = []
  for (const p of cfg.packages) {
    const failed = failedConstraints(p, demand, acLoads, cfg)
    if (failed.length === 0) {
      matched = p
      break
    }
    // Accumulate, so `constraintsBinding` really is everything that stood in
    // the way rather than whatever the last-checked package happened to fail.
    for (const id of failed) if (!binding.includes(id)) binding.push(id)
  }

  if (
    matched &&
    matched.maxAcBtu !== null &&
    acLoads.some((a) => (a.btu ?? 0) > (matched.maxAcBtu as number))
  ) {
    warnings.push('acBtuExceeded') // advisory mode only — strict gates this
  }

  // Custom fallback: size and price a bespoke build from the component list.
  const custom = matched ? null : priceCustomBom(demand, cfg)

  // Too big to quote unseen. Without this the form's own maximum inputs
  // produce a seven-figure price with no feasibility check behind it.
  if (custom && custom.build.totalLyd > cfg.customBom.maximumLyd) {
    return surveyResult(loads, demand, cfg, warnings, assumptionsMade, binding, custom.build)
  }

  const specs = matched ? packageSpecs(matched, cfg) : custom!.specs

  if (custom?.build.floorApplied) warnings.push('customFloorApplied')

  // Roof feasibility is advisory: warn, never block. 0 m² means "not sure",
  // which disables the check rather than guessing.
  const roofM2 = cfg.sizing.roofAreaM2ByAnswer[d.roofSpace] ?? 0
  if (roofM2 > 0 && specs.panels.count * cfg.sizing.panelAreaM2 > roofM2) {
    warnings.push('roofSpaceTight')
  }

  return {
    dailyKwh: round2(demand.dailyKwh),
    nightKwh: round2(demand.nightKwh),
    peakKw: round2(demand.peakW / 1000),
    requiredKwp: round2(demand.requiredKwp),
    recommendedTier: matched ? matched.tier : 'CUSTOM',
    priceFrom: matched ? matched.priceLyd : custom!.build.totalLyd,
    currency: cfg.currency,
    specs,
    // A custom build bills for installation like any package, so claiming
    // nothing is included was simply wrong.
    includes: cfg.includes,
    addOnsAvailable: cfg.addOns.map((a) => ({ name: a.name, priceLyd: a.priceLyd })),
    runtimeHours: runtimeHoursFor(specs, demand, cfg),
    confidence: lowersConfidence(assumptionsMade) ? 'low' : 'high',
    assumptionsMade,
    warnings,
    constraintsBinding: binding,
    isCustom: !matched,
    customBuild: custom ? custom.build : null,
    configVersion: cfg.configVersion,
    loads,
  }
}

/** Compact summary for the WhatsApp message. */
export function toWaQuote(r: EngineResult): WaQuote {
  return {
    tier: r.recommendedTier,
    priceFrom: r.priceFrom,
    // One decimal: Math.round() sent "0 kWh" for a 0.4 kWh/day quote.
    dailyKwh: Math.round(r.dailyKwh * 10) / 10,
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
