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
  /**
   * Above this total the system is too large to quote unseen: the engine
   * returns a SURVEY result with NO price rather than an eye-watering number.
   */
  maximumLyd: number
}

/**
 * The client's own method for sizing large (commercial) installations, which
 * is a different procedure from the household one — not a bigger version of
 * it. Its worked examples land on 45–75 batteries, 150–305 panels and 30–80 kW
 * inverters, where the packages top out at 11 kVA.
 *
 * Its constants deliberately differ from `sizing`: 0.8 battery efficiency
 * rather than a 0.9 lithium DoD, 0.8 system efficiency rather than 0.75,
 * 5 peak sun hours rather than 5.5, and a 615 W panel rather than the 590 W
 * Jinko. Keeping them in their own block is the point — changing the
 * household figures must never move a commercial quote, or the reverse.
 */
export type CommercialConfig = {
  /** Usable share of a battery's nameplate energy. */
  batteryEfficiency: number
  /** Array derating for losses, temperature and wiring. */
  systemEfficiency: number
  /**
   * Hours the array has to both carry the day load and refill the bank.
   * Held separately from the battery unit size even though both are 5 today:
   * the method's `/5` does double duty, and the client's own implementation
   * note asks for the two to be split so either can move alone.
   */
  peakSunHours: number
  battery: { component: string; kwhEach: number }
  panel: { component: string; watts: number }
  /**
   * The standard inverter sizes actually stocked, ascending. The smallest rung
   * at or above the peak load is chosen — there is no interpolation.
   */
  inverterLadder: { kw: number; component: string }[]
  stand: { component: string; panelsPerStand: number }
  perPanel: BomLineSpec[]
  perInverter: BomLineSpec[]
  fixed: BomLineSpec[]
  roundUpToLyd: number
  /**
   * Array kW ÷ inverter kW above which the build is flagged for review. The
   * method sizes the inverter from the day load alone while sizing the array
   * to carry that load AND recharge the bank, so the two can disagree by 3×.
   */
  maxDcAcRatio: number
}

/** What the engineer types in. Every figure comes from a bill or a survey. */
export type CommercialInput = {
  /** Daily energy that must come out of the batteries, kWh. */
  batteryKwh: number
  /** Load the array carries directly during the day, kW. */
  dayLoadKw: number
  /** Peak load the inverter must cover, kW. Defaults to the day load. */
  peakKw: number
}

export type CommercialFlag =
  /** Peak load is below the smallest rung — the packages are the right tool. */
  | 'residentialScale'
  /** Peak load exceeds the largest rung; the size shown is clamped. */
  | 'aboveLargestInverter'
  /** The array is far larger than the inverter the method selects. */
  | 'dcAcRatioHigh'

export type CommercialSizing = {
  /** batteryKwh ÷ batteryEfficiency. */
  grossKwh: number
  batteries: number
  /** Power needed to refill the installed bank within the sun window. */
  chargeKw: number
  /** dayLoadKw + chargeKw, before losses. */
  arrayNetKw: number
  /** The DC array after losses. */
  arrayKw: number
  panels: number
  /** The ladder rung chosen from the peak load, as the method specifies. */
  inverterKw: number
  /** What the rung would be if the inverter also carried the charging. */
  inverterKwWithCharging: number
  dcAcRatio: number
  flags: CommercialFlag[]
}

/**
 * A BOM line that may not have a price yet.
 *
 * The household BOM throws on an unknown component, which is right when a
 * customer is waiting for a number. Here it is wrong: the commercial rate card
 * does not exist yet, and the honest output is "priced, with three items still
 * to price" rather than a total that quietly omits them.
 */
export type CommercialBomLine = {
  name: string
  qty: number
  unitLyd: number | null
  totalLyd: number | null
}

export type CommercialBuild = {
  lines: CommercialBomLine[]
  /** Sum of the lines that have a price. */
  subtotalLyd: number
  /** subtotalLyd rounded up to roundUpToLyd. */
  totalLyd: number
  /** Components with no entry in the rate card, in line order. */
  unpricedComponents: string[]
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
  /**
   * Optional, and deliberately so: this validator also gates the customer
   * boot path, so making the block mandatory would invalidate the live config
   * and drop every visitor to bundled prices. Absent, the sizing calculator
   * falls back to the bundled constants; present, it is validated in full.
   */
  commercial?: CommercialConfig
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
    /**
     * Running watts → peak draw. `watts` on a load is a duty-cycle AVERAGE
     * (a fridge averages 60 W but its compressor pulls 150 W and surges
     * higher), so sizing an inverter from it under-sizes systematically.
     * Each category's average is multiplied by this to get its peak.
     */
    surgeFactorByCategory: { ac: number; cold: number; lighting: number; appliance: number }
    /** Roof area one panel occupies, for the feasibility check. */
    panelAreaM2: number
    /** Usable roof area per answer, for the feasibility check. */
    roofAreaM2ByAnswer: Record<string, number>
  }
}

export type LoadCategory = 'ac' | 'cold' | 'lighting' | 'appliance'

/** One uniform load record — every form answer normalizes to this shape. */
export type NormalizedLoad = {
  id: string
  label: string
  category: LoadCategory
  /**
   * Per-unit watts for ENERGY only — duty cycle, condition and inverter-type
   * applied, so it is an average across the hours the load runs. Never use it
   * to size an inverter; use `peakWatts`.
   */
  watts: number
  /** Per-unit draw at peak, for inverter sizing. Always >= `watts`. */
  peakWatts: number
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
export type WarningId =
  | 'heavyDutyLoad'
  | 'acBtuExceeded'
  /** The custom build costs less than the floor, so the floor is what we quote. */
  | 'customFloorApplied'
  /** The array needed is larger than the roof the customer described. */
  | 'roofSpaceTight'
export type AssumptionId =
  | 'acSizeAssumed'
  | 'lightingAssumed'
  | 'customApplianceAssumed'
  /** Hours/day per appliance and for lighting are never asked. */
  | 'usageHoursAssumed'

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
  /**
   * SURVEY = too large (or too uncertain) to price unseen. `priceFrom` is null
   * and the UI routes the customer to a site visit instead of showing a number.
   */
  recommendedTier: PackageTier | 'CUSTOM' | 'SURVEY'
  /**
   * Package price, or the custom BOM total (never below the config floor).
   * null for SURVEY — we never invent a price we would not honour.
   */
  priceFrom: number | null
  currency: 'LYD'
  specs: SystemSpecs | null
  includes: IncludeId[]
  addOnsAvailable: { name: string; priceLyd: number }[]
  /**
   * Hours the recommended battery actually covers the customer's night load.
   * null when there is no night load, or for SURVEY. Derived, never hardcoded.
   */
  runtimeHours: number | null
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
  /** null for SURVEY — the message asks for a visit instead of quoting. */
  priceFrom: number | null
  dailyKwh: number
  isCustom: boolean
  configVersion: string
  /** Context the sales engineer needs before calling back. */
  city: string
  propertyType: string
  acCount: number
  /** The customer's own free text. Collected on the review screen and, until
   *  now, never carried anywhere the engineer would read it. */
  notes: string
}
