import type { AcUnit, Appliance, Estimate, FormData } from './types'

/** Initial, empty form state — mirrors the design prototype's default state. */
export function initialData(): FormData {
  return {
    name: '',
    whatsapp: '',
    propertyType: '',
    propertyOther: '',
    city: '',
    outageHours: '',
    nightEconomy: '',
    operation: '',
    acUnits: [],
    fridge: { on: true, qty: 1, alwaysOn: true },
    freezer: { on: false, qty: 1, alwaysOn: true },
    lighting: { type: '', count: 10, watts: '', nightHours: 5 },
    appliances: [],
    systemType: 'recommend',
    priority: '',
    priorityAcCount: 1,
    roofSpace: '',
    roofShade: '',
    photos: { panel: null, meter: null, roof: null, stickers: null },
    notes: '',
  }
}

/** A fresh AC unit row. */
export function makeAc(): AcUnit {
  return {
    capValue: '',
    dontKnow: false,
    model: '',
    photo: null,
    inverter: '',
    hours: 6,
    night: true,
  }
}

/**
 * Preset appliances offered as quick-add chips.
 *
 * The customer only ever chooses a quantity, so `w` (watts), `h` (hours run per
 * day) and `night` (contributes to the overnight battery load) are hidden sizing
 * assumptions. Changing any of them changes every quote.
 */
export type Preset = { name: string; w: number; h: number; night?: boolean }

export const PRESETS: Preset[] = [
  { name: 'Router / Internet', w: 15, h: 24, night: true },
  { name: 'TV', w: 100, h: 4, night: true },
  { name: 'Phone / Laptop charger', w: 60, h: 4, night: true },
  { name: 'Fan', w: 70, h: 8, night: true },
  { name: 'Water pump', w: 750, h: 1 },
  { name: 'Washing machine', w: 500, h: 2 },
  { name: 'Dryer', w: 2000, h: 1.5 },
  { name: 'Oven / Microwave', w: 1500, h: 1 },
  { name: 'Coffee machine / Kettle', w: 1200, h: 0.5 },
  { name: 'Security cameras / NVR', w: 60, h: 24, night: true },
  { name: 'Server / Network', w: 150, h: 24, night: true },
]

/** Build an appliance row from a preset (or a blank custom row when null). */
export function makeAppliance(id: number, p: Preset | null): Appliance {
  return {
    id,
    name: p ? p.name : '',
    custom: !p,
    qty: 1,
    hours: p ? p.h : 4,
    night: p ? !!p.night : false,
    defW: p ? p.w : 100,
  }
}

/**
 * Core sizing model. Ported verbatim from the design prototype so estimates
 * match the mockup exactly. Returns display-ready strings.
 */
export function estimate(d: FormData): Estimate {
  let daily = 0
  let night = 0
  let peak = 0

  d.acUnits.forEach((u) => {
    let tons = 1.25
    const v = parseFloat(u.capValue)
    if (!u.dontKnow && v > 0) tons = v / 12000
    let w = tons * 1200
    if (u.inverter === 'yes') w *= 0.75
    peak += w
    daily += (w * (u.hours || 0)) / 1000
    if (u.night) night += ((w * Math.min(u.hours || 0, 8)) / 1000) * 0.6
  })

  if (d.fridge.on) {
    daily += 1.2 * d.fridge.qty
    night += 0.5 * d.fridge.qty
    peak += 200 * d.fridge.qty
  }
  if (d.freezer.on) {
    daily += 1.5 * d.freezer.qty
    night += 0.6 * d.freezer.qty
    peak += 300 * d.freezer.qty
  }

  const bw =
    parseFloat(d.lighting.watts) ||
    (d.lighting.type === 'regular' ? 60 : d.lighting.type === 'mixed' ? 30 : 10)
  const lkwh = (d.lighting.count * bw * (d.lighting.nightHours || 0)) / 1000
  daily += lkwh
  night += lkwh
  peak += d.lighting.count * bw

  d.appliances.forEach((a) => {
    const w = a.defW
    const kwh = (w * a.qty * (a.hours || 0)) / 1000
    daily += kwh
    peak += w * a.qty
    if (a.night) night += kwh * 0.5
  })

  daily = Math.max(daily, 2)
  night = Math.max(Math.min(night, daily), 1)
  if (d.nightEconomy === 'yes') night *= 0.7

  const kwpLo = Math.max(1, Math.round((daily / 5.5) * 2) / 2)
  const kwpHi = Math.max(kwpLo + 0.5, Math.round((daily / 4.2) * 2) / 2)
  const sizes = [3, 5, 6, 8, 10, 12, 15, 20, 25, 30]
  const need = (peak / 1000) * 0.75
  const inv = sizes.find((s) => s >= need) || 30
  const batLo = Math.max(5, Math.round(night * 1.25))
  const batHi = Math.max(batLo + 2, Math.round(night * 1.8))
  const kwpMid = (kwpLo + kwpHi) / 2
  const price =
    Math.round((kwpMid * 3800 + ((batLo + batHi) / 2) * 1500 + inv * 800) / 500) * 500

  return {
    kwp: kwpLo.toFixed(1) + '–' + kwpHi.toFixed(1),
    inv: String(inv),
    bat: batLo + '–' + batHi,
    dailyKwh: Math.round(daily),
    priceLyd: price,
  }
}

/** Whether the current step's required fields are satisfied. */
export function canContinue(d: FormData, step: number): boolean {
  if (step === 1) {
    const digits = d.whatsapp.replace(/\D/g, '')
    return (
      d.name.trim().length >= 2 &&
      digits.length >= 8 &&
      d.propertyType !== '' &&
      (d.propertyType !== 'Other' || d.propertyOther.trim() !== '') &&
      d.city.trim() !== ''
    )
  }
  if (step === 2) {
    return !!(d.outageHours && d.nightEconomy && d.operation)
  }
  return true
}

/** Build the WhatsApp deep-link for the completed estimate. */
export function whatsappLink(
  d: FormData,
  est: Estimate,
  waNumber: string,
  buildMessage: (name: string, kwp: string, inv: string, bat: string) => string,
): string {
  const num = waNumber.replace(/\D/g, '')
  const text = encodeURIComponent(buildMessage(d.name || '', est.kwp, est.inv, est.bat))
  return 'https://wa.me/' + num + '?text=' + text
}
