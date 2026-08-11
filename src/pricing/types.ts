/**
 * Types for the sizing & pricing engine.
 *
 * The engine outputs identifiers, never display text — the UI localizes them
 * through i18n, and persistence stores the raw ids for auditability.
 */

export type PackageTier = 'S' | 'M' | 'L' | 'XL' | 'XXL'

export type BatterySpec =
  | { chemistry: 'liquid'; count: number; ampHours: number }
  | { chemistry: 'lithium'; count: number; kwhEach: number }

export type Package = {
  tier: PackageTier
  inverterKva: number
  panel: { count: number; watts: number }
  battery: BatterySpec
  maxAcUnits: number
  /** null = the client has not confirmed a BTU rating — the check is skipped. */
  maxAcBtu: number | null
  /** Fixed contractual price. Looked up, NEVER computed. */
  priceLyd: number
}

export type IncludeId =
  | 'installConnection'
  | 'economyLighting'
  | 'tvScreen'
  | 'fridge'
  | 'freezerOrPump'

export type ApplianceDefault = {
  watts: number
  /** Hours per day. Omit when alwaysOn (treated as 24h). */
  hours?: number
  /** Contributes to the overnight battery load. Implied by alwaysOn. */
  night?: boolean
  alwaysOn?: boolean
  /** High-draw device that needs special handling — triggers a warning. */
  heavy?: boolean
}

/** A component-list line used by the custom-system BOM builder. */
export type BomLineSpec = { component: string; qty: number }

/**
 * How a custom (beyond-packages) system is sized and priced from the retail
 * component list. Ratios are derived from the client's real invoices.
 */
export type CustomBomConfig = {
  panel: { component: string; watts: number }
  battery: { component: string; kwhEach: number }
  inverter: {
    /** Used when the required inverter kW fits a single unit. */
    single: { component: string; maxKw: number }
    /** Otherwise n parallel units of this size. */
    parallel: { component: string; unitKw: number }
  }
  stand: { component: string; panelsPerStand: number }
  /** Quantities multiplied by the panel count (clamps, cable metres…). */
  perPanel: BomLineSpec[]
  /** Quantities multiplied by the inverter count. */
  perInverter: BomLineSpec[]
  /** Flat one-off lines (switches, installation, transport…). */
  fixed: BomLineSpec[]
  /** The subtotal is rounded UP to this increment. */
  roundUpToLyd: number
  /** The custom price never displays below this floor. */
  minimumLyd: number
}

export type CustomBomLine = { name: string; qty: number; unitLyd: number; totalLyd: number }

export type CustomBuild = {
  lines: CustomBomLine[]
  subtotalLyd: number
  /** max(subtotal rounded up, minimumLyd) — what the customer sees. */
  totalLyd: number
  floorApplied: boolean
}

export type PricingConfig = {
  configVersion: string
  currency: 'LYD'
  /**
   * 'strict'  — a package only matches if every AC is within its maxAcBtu.
   * 'advisory' — the BTU cap never blocks a match; exceeding it attaches a
   *              visible warning instead. maxAcUnits is hard in both modes.
   */
  acBtuCapMode: 'advisory' | 'strict'
  packages: Package[]
  includes: IncludeId[]
  addOns: { name: string; priceLyd: number }[]
  batteryLifespanYears: { liquid: number; lithium: number }
  components: Record<string, number>
  customBom: CustomBomConfig
  loadDefaults: {
    acWattsPerBtu: { standard: number; inverter: number }
    assumedAcBtu: number
    btuPerTon: number
    lightingWattsByType: { led: number; regular: number; mixed: number }
    /** Hours/day the lighting runs (also its battery hours). Not user-asked. */
    lightingHours: number
    fridge: { watts: number; duty: number }
    freezer: { watts: number; duty: number }
    fridgeConditionMultiplier: { new: number; old: number }
    defaultFridgeCondition: 'new' | 'old'
    appliancesByName: Record<string, ApplianceDefault>
    futureLoads: { waterHeater: ApplianceDefault; pumpWattsByHp: Record<string, number> }
    customAppliance: { watts: number; hours: number }
  }
  sizing: {
    peakSunHours: number
    systemEfficiency: number
    inverterSafetyFactor: number
    diversityFactor: number
    dodByChemistry: { liquid: number; lithium: number }
    liquidBatteryVoltageV: number
    kvaToKw: number
    alwaysOnNightHours: number
  }
}

export type LoadCategory = 'ac' | 'cold' | 'lighting' | 'appliance'

/** One uniform load record — every form answer normalizes to this shape. */
export type NormalizedLoad = {
  id: string
  label: string
  category: LoadCategory
  /** Effective per-unit watts (duty cycle / condition / inverter-type applied). */
  watts: number
  qty: number
  hoursPerDay: number
  runAtNight: boolean
  alwaysOn: boolean
  heavyDuty: boolean
  /** True when a default replaced missing customer data — lowers confidence. */
  assumed: boolean
  /** ACs only; the assumed value when unknown. */
  btu?: number
}

export type Demand = {
  dailyKwh: number
  nightKwh: number
  peakW: number
  inverterKw: number
  requiredKwp: number
  requiredUsableKwh: number
}

export type ConstraintId = 'inverter' | 'battery' | 'panels' | 'acCount' | 'acBtu'
export type WarningId = 'heavyDutyLoad' | 'acBtuExceeded'
export type AssumptionId = 'acSizeAssumed' | 'lightingAssumed' | 'customApplianceAssumed'

export type SystemSpecs = {
  inverter: { kva: number; kw: number }
  panels: { count: number; watts: number; kwp: number }
  battery: {
    chemistry: 'liquid' | 'lithium'
    nominalKwh: number
    usableKwh: number
    lifespanYears: number
  }
}

export type EngineResult = {
  dailyKwh: number
  nightKwh: number
  peakKw: number
  requiredKwp: number
  recommendedTier: PackageTier | 'CUSTOM'
  /** Package price, or the custom BOM total (never below the config floor). */
  priceFrom: number
  currency: 'LYD'
  specs: SystemSpecs
  includes: IncludeId[]
  addOnsAvailable: { name: string; priceLyd: number }[]
  runtimeNote: string
  confidence: 'high' | 'low'
  assumptionsMade: AssumptionId[]
  warnings: WarningId[]
  constraintsBinding: ConstraintId[]
  isCustom: boolean
  /** Itemized custom build — internal/admin only, never shown to customers. */
  customBuild: CustomBuild | null
  configVersion: string
  /** Full normalized-load audit trail — persisted with the lead. */
  loads: NormalizedLoad[]
}

/** The compact quote summary carried into the WhatsApp message. */
export type WaQuote = {
  tier: string
  priceFrom: number
  dailyKwh: number
  isCustom: boolean
  configVersion: string
}
