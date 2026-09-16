/**
 * Commercial sizing — the client's own method for large installations.
 *
 * This is a SECOND sizing path, not an extension of the household one. The
 * wizard derives everything from an appliance checklist and tops out at an
 * 11 kVA package; this method starts where a 30 kW inverter is the smallest
 * thing that fits, and takes its three inputs from a bill or a site survey
 * instead. Nothing here is reachable from the customer app.
 *
 * The procedure, verbatim:
 *
 *   grossKwh   = batteryKwh / batteryEfficiency
 *   batteries  = ceil(grossKwh / batteryKwhEach)
 *   chargeKw   = installed bank kWh / peakSunHours
 *   arrayKw    = (dayLoadKw + chargeKw) / systemEfficiency
 *   panels     = ceil(arrayKw * 1000 / panelWatts)
 *   inverter   = the smallest stocked size at or above the peak load
 *
 * Two departures from the paper, both documented in docs/commercial-sizing.md:
 * panel counts are rounded UP (the worked examples truncate, the method's own
 * implementation note says round up), and the daytime subtraction that appears
 * in Example 2 alone is not implemented — it is the only step that does not
 * reproduce, and it subtracts a kW figure from a kWh one.
 */
import type {
  CommercialBomLine,
  CommercialBuild,
  CommercialConfig,
  CommercialFlag,
  CommercialInput,
  CommercialSizing,
  PricingConfig,
} from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Bounds on what an engineer can type. Beyond these it is a typo, not a job. */
const INPUT_BOUNDS = {
  batteryKwh: 5000,
  dayLoadKw: 1000,
  peakKw: 1000,
} as const

export type CommercialResult =
  | { ok: true; sizing: CommercialSizing }
  | { ok: false; errors: string[] }

/**
 * Reject anything that cannot produce a real system.
 *
 * Kept as a hard refusal rather than a clamp for the same reason the engine
 * guards `finiteDemand`: `x < NaN` is false, so a bad number does not fail
 * comparisons — it sails through them and comes out the other side looking
 * like an answer.
 */
function validateInput(input: CommercialInput): string[] {
  const errors: string[] = []
  const check = (label: string, v: number, max: number, allowZero: boolean) => {
    if (!Number.isFinite(v)) errors.push(label + ' must be a number')
    else if (v < 0) errors.push(label + ' cannot be negative')
    else if (!allowZero && v === 0) errors.push(label + ' is required')
    else if (v > max) errors.push(label + ' looks wrong — over ' + max.toLocaleString('en-US'))
  }
  check('Daily battery energy', input.batteryKwh, INPUT_BOUNDS.batteryKwh, true)
  check('Daytime load', input.dayLoadKw, INPUT_BOUNDS.dayLoadKw, true)
  check('Peak load', input.peakKw, INPUT_BOUNDS.peakKw, false)
  if (errors.length === 0 && input.batteryKwh === 0 && input.dayLoadKw === 0) {
    errors.push('Enter a daily battery energy, a daytime load, or both')
  }
  return errors
}

/** The stocked size at or above `kw`, or the largest one if nothing covers it. */
function ladderRungFor(kw: number, ladder: CommercialConfig['inverterLadder']): number {
  const ascending = ladder.slice().sort((a, b) => a.kw - b.kw)
  const fit = ascending.find((r) => r.kw >= kw)
  return fit ? fit.kw : ascending[ascending.length - 1].kw
}

export function sizeCommercial(input: CommercialInput, cfg: CommercialConfig): CommercialResult {
  const errors = validateInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const grossKwh = input.batteryKwh / cfg.batteryEfficiency
  const batteries = Math.ceil(grossKwh / cfg.battery.kwhEach)

  // Charging power comes from the bank actually installed, not from the raw
  // gross figure: you refill what you bought. At 5 kWh over 5 hours the two
  // readings coincide, which is why the client's examples reproduce either
  // way — but they stop coinciding the moment either constant is edited.
  const chargeKw = (batteries * cfg.battery.kwhEach) / cfg.peakSunHours
  const arrayNetKw = input.dayLoadKw + chargeKw
  const arrayKw = arrayNetKw / cfg.systemEfficiency
  const panels = Math.ceil((arrayKw * 1000) / cfg.panel.watts)

  const inverterKw = ladderRungFor(input.peakKw, cfg.inverterLadder)
  const inverterKwWithCharging = ladderRungFor(input.peakKw + chargeKw, cfg.inverterLadder)
  const dcAcRatio = arrayKw / inverterKw

  const sizes = cfg.inverterLadder.map((r) => r.kw)
  const flags: CommercialFlag[] = []
  if (input.peakKw < Math.min(...sizes)) flags.push('residentialScale')
  if (input.peakKw > Math.max(...sizes)) flags.push('aboveLargestInverter')
  if (dcAcRatio > cfg.maxDcAcRatio) flags.push('dcAcRatioHigh')

  return {
    ok: true,
    sizing: {
      grossKwh: round2(grossKwh),
      batteries,
      chargeKw: round2(chargeKw),
      arrayNetKw: round2(arrayNetKw),
      arrayKw: round2(arrayKw),
      panels,
      inverterKw,
      inverterKwWithCharging,
      dcAcRatio: round2(dcAcRatio),
      flags,
    },
  }
}

/**
 * Price the sized system from the retail component list.
 *
 * Unlike `priceCustomBom`, a component missing from the rate card does NOT
 * throw. The commercial rates have never been confirmed, so an unpriced line
 * is the expected state, and the useful output is the quantity with the price
 * still open — not an exception, and certainly not a subtotal that silently
 * leaves out the inverters.
 */
export function priceCommercialBom(
  sizing: CommercialSizing,
  cfg: PricingConfig,
  commercial: CommercialConfig,
): CommercialBuild {
  const lines: CommercialBomLine[] = []
  const unpriced: string[] = []

  const add = (name: string, qty: number) => {
    const unitLyd = cfg.components[name]
    if (unitLyd === undefined) {
      if (!unpriced.includes(name)) unpriced.push(name)
      lines.push({ name, qty, unitLyd: null, totalLyd: null })
      return
    }
    lines.push({ name, qty, unitLyd, totalLyd: unitLyd * qty })
  }

  const rung = commercial.inverterLadder.find((r) => r.kw === sizing.inverterKw)

  add(commercial.panel.component, sizing.panels)
  add(commercial.battery.component, sizing.batteries)
  // One unit of the chosen size: the ladder is a choice of machine, not a
  // count of parallel units the way the household BOM stacks 6 kW Growatts.
  if (rung) add(rung.component, 1)
  add(commercial.stand.component, Math.ceil(sizing.panels / commercial.stand.panelsPerStand))
  for (const item of commercial.perPanel) add(item.component, item.qty * sizing.panels)
  for (const item of commercial.perInverter) add(item.component, item.qty)
  for (const item of commercial.fixed) add(item.component, item.qty)

  const subtotalLyd = lines.reduce((sum, l) => sum + (l.totalLyd ?? 0), 0)
  const totalLyd = Math.ceil(subtotalLyd / commercial.roundUpToLyd) * commercial.roundUpToLyd

  return { lines, subtotalLyd, totalLyd, unpricedComponents: unpriced }
}
