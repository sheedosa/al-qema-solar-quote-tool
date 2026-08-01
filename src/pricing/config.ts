import type { PricingConfig } from './types'

/**
 * ============================================================================
 * AL QEMA PRICING CONFIG — client-editable data. No logic lives here.
 * ============================================================================
 *
 * Package prices are contractual lookups — they are NEVER computed from
 * component costs (verified: markup ranges 1.11×–1.56× across tiers).
 * To update prices: edit the numbers below, bump `configVersion`, redeploy.
 *
 * ⚠ OPEN QUESTIONS pending client answers — each is a single value below:
 *  1. `sizing.liquidBatteryVoltageV` (12 assumed) — HIGHEST IMPACT: at 12V vs
 *     48V per battery the S/M usable kWh differs 4×, changing tier matching.
 *  2. `loadDefaults` are DRAFT engineering estimates — need Al Qema sign-off.
 *  3. `sizing.peakSunHours` (5.5 assumed) for their service area.
 *  4. M-tier `maxAcBtu` (null = unconfirmed; the check is skipped).
 *  5. `acBtuCapMode` — form offers 24k/32k BTU ACs but no package supports
 *     >18k per unit; 'advisory' prices anyway with a warning.
 *  6. `sizing.kvaToKw` (1.0 assumes power factor 1).
 *  7. `loadDefaults.lightingWattsByType.mixed` (35 = midpoint of LED/regular).
 *  8. Panel stock: packages list 605W/550W panels; the retail list stocks
 *     Jinko 590W — confirm what actually ships.
 *  9. VAT/tax inclusion, price validity dates, and discount rules are
 *     unconfirmed; `configVersion` is the update mechanism.
 * 10. Roof space is advisory only — the engine ignores it (persisted for the
 *     engineer).
 */
export const PRICING_CONFIG: PricingConfig = {
  configVersion: 'pricing-2026-08-01.1',
  currency: 'LYD',
  acBtuCapMode: 'advisory',

  /** Ordered smallest → largest — the order IS the tier-match walk. */
  packages: [
    {
      tier: 'S',
      inverterKva: 3.2,
      panel: { count: 2, watts: 605 },
      battery: { chemistry: 'liquid', count: 2, ampHours: 200 },
      maxAcUnits: 0,
      maxAcBtu: null,
      priceLyd: 8730,
    },
    {
      tier: 'M',
      inverterKva: 3.2,
      panel: { count: 4, watts: 605 },
      battery: { chemistry: 'liquid', count: 4, ampHours: 200 },
      maxAcUnits: 1,
      maxAcBtu: null, // listed only as "1 AC" — BTU rating unconfirmed
      priceLyd: 15417,
    },
    {
      tier: 'L',
      inverterKva: 5.5,
      panel: { count: 8, watts: 605 },
      battery: { chemistry: 'lithium', count: 2, kwhEach: 5 },
      maxAcUnits: 1,
      maxAcBtu: 18000,
      priceLyd: 32247,
    },
    {
      tier: 'XL',
      inverterKva: 6,
      panel: { count: 8, watts: 605 },
      battery: { chemistry: 'lithium', count: 1, kwhEach: 15 },
      maxAcUnits: 2,
      maxAcBtu: 12000,
      priceLyd: 40600,
    },
    {
      tier: 'XXL',
      inverterKva: 11,
      panel: { count: 12, watts: 550 },
      battery: { chemistry: 'lithium', count: 4, kwhEach: 5 },
      maxAcUnits: 2,
      maxAcBtu: 18000,
      priceLyd: 55500,
    },
  ],

  /** Every package runs these (client terms). */
  includes: ['installConnection', 'economyLighting', 'tvScreen', 'fridge', 'freezerOrPump'],
  addOns: [{ name: 'Battery box (2 batteries)', priceLyd: 350 }],
  batteryLifespanYears: { liquid: 4, lithium: 10 },

  /** Retail unit prices — custom/BOM path and invoice reconciliation only. */
  components: {
    'Inverter 1050': 675,
    'Inverter 2000': 810,
    'Growatt 6000W': 4000,
    'Growatt Hommer 5k': 3350,
    'Luminous 1100VA': 950,
    'Luminous 1400VA': 1050,
    'Luminous 1100 Solar': 1200,
    'Lithium 100Ah 12V': 1400,
    'Lithium 100Ah 25.6V': 2750,
    'Lithium 200Ah 12V': 2600,
    'Lithium 100Ah 24V Wall': 3700,
    'Lithium 100Ah 51.2V Wall': 7000,
    'Lithium 15KW': 18500,
    'Lithium 5KW Growatt': 8500,
    'Qmax Lithium 5kW': 7500,
    'Luminous 200Ah': 1700,
    'Luminous 230Ah': 1950,
    'Luminous 320Ah': 2650,
    'Shoto 150Ah 12V': 1900,
    'Jinko 590W': 1100,
    'UPS 1250': 2350,
    'Veichi 2.2KW': 2450,
    'Veichi 7.5KW 3PH': 2500,
    'Veichi 11KW 380V': 3750,
    'Veichi 15KW 380V': 4150,
    'Veichi 110KW': 22000,
    'Delixi 22KW 3PH': 6150,
    'Delixi 30KW 3PH': 6500,
    'Alqema Stand': 550,
    'Mounting clamp': 30,
    'DC Cable 2x6mm': 25,
    'DC Cable 35mm': 55,
    'AC Cable 2x10mm': 40,
    'MTS Switch': 1000,
    'MCCB DC Switch': 850,
    'Busbar': 1000,
    'AC Combiner': 2000,
    'Installation': 2000,
    'Install consumables': 100,
    'Transport & handling': 750,
  },

  /**
   * DRAFT — pending Al Qema engineering approval.
   * Used only where the form doesn't collect a value; customer data wins.
   */
  loadDefaults: {
    acWattsPerBtu: { standard: 0.1, inverter: 0.075 },
    assumedAcBtu: 12000,
    btuPerTon: 12000,
    lightingWattsByType: { led: 10, regular: 60, mixed: 35 },
    fridge: { watts: 150, duty: 0.4 },
    freezer: { watts: 200, duty: 0.45 },
    fridgeConditionMultiplier: { new: 1.0, old: 1.3 },
    defaultFridgeCondition: 'new', // the form no longer asks for condition
    /** Keys are the canonical PRESET_NAMES from src/logic.ts — exactly. */
    appliancesByName: {
      'Router / Internet': { watts: 15, alwaysOn: true },
      'TV': { watts: 100, hours: 5, night: true },
      'Phone / Laptop charger': { watts: 65, hours: 3, night: true },
      'Fan': { watts: 60, hours: 8, night: true },
      'Water pump': { watts: 750, hours: 1 }, // generic form entry → 1 hp
      'Washing machine': { watts: 500, hours: 1 },
      'Dryer': { watts: 2500, hours: 1, heavy: true },
      'Oven / Microwave': { watts: 1200, hours: 0.5, heavy: true },
      'Coffee machine / Kettle': { watts: 1500, hours: 0.5, heavy: true },
      'Security cameras / NVR': { watts: 60, alwaysOn: true },
      'Server / Network': { watts: 300, alwaysOn: true },
    },
    /** Not currently collectable by the form — kept per client spec. */
    futureLoads: {
      waterHeater: { watts: 2000, hours: 2, heavy: true },
      pumpWattsByHp: { '0.5': 370, '1': 750, '1.5': 1100, '2': 1500 },
    },
    customAppliance: { watts: 100, hours: 4 },
  },

  sizing: {
    peakSunHours: 5.5,
    systemEfficiency: 0.75,
    inverterSafetyFactor: 1.25,
    diversityFactor: 0.7,
    dodByChemistry: { liquid: 0.5, lithium: 0.9 },
    liquidBatteryVoltageV: 12,
    kvaToKw: 1.0,
    alwaysOnNightHours: 12, // client's stated max runtime
  },
}
