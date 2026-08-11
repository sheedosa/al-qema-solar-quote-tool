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

  const panels = Math.max(1, Math.ceil((demand.requiredKwp * 1000) / cb.panel.watts))
  const usablePerBattery = cb.battery.kwhEach * cfg.sizing.dodByChemistry.lithium
  const batteries = Math.max(1, Math.ceil(demand.requiredUsableKwh / usablePerBattery))
  const single = demand.inverterKw <= cb.inverter.single.maxKw
  const inverterCount = single ? 1 : Math.ceil(demand.inverterKw / cb.inverter.parallel.unitKw)
  const inverterName = single ? cb.inverter.single.component : cb.inverter.parallel.component
  const inverterKw = single ? cb.inverter.single.maxKw : inverterCount * cb.inverter.parallel.unitKw
  const stands = Math.ceil(panels / cb.stand.panelsPerStand)

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

/** Steps 6–8 — tier match, custom fallback, guardrails. */
export function runEngine(d: FormData, cfg: PricingConfig): EngineResult {
  const loads = normalizeLoads(d, cfg)
  const demand = computeDemand(loads, cfg, nightPriorityExclusions(d, loads))
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

  // Custom fallback: size and price a bespoke build from the component list.
  const custom = matched ? null : priceCustomBom(demand, cfg)

  return {
    dailyKwh: round2(demand.dailyKwh),
    nightKwh: round2(demand.nightKwh),
    peakKw: round2(demand.peakW / 1000),
    requiredKwp: round2(demand.requiredKwp),
    recommendedTier: matched ? matched.tier : 'CUSTOM',
    priceFrom: matched ? matched.priceLyd : custom!.build.totalLyd,
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
      : custom!.specs,
    includes: matched ? cfg.includes : [],
    addOnsAvailable: matched
      ? cfg.addOns.map((a) => ({ name: a.name, priceLyd: a.priceLyd }))
      : [],
    runtimeNote: 'upTo12h',
    confidence: assumptionsMade.length > 0 ? 'low' : 'high',
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
