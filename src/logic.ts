import type { AcUnit, Appliance, FormData } from './types'
import type { WaQuote } from './pricing/types'

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
    lighting: { type: '', count: 10, watts: '' },
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
export function makeAc(id = 1): AcUnit {
  return {
    id,
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
 * Canonical appliance names offered as quick-add chips. These strings are the
 * shared key across the form state, the i18n `opt.preset` labels, and the
 * pricing engine's `loadDefaults.appliancesByName` table.
 */
export const PRESET_NAMES = [
  'Router / Internet',
  'TV',
  'Phone / Laptop charger',
  'Fan',
  'Water pump',
  'Washing machine',
  'Dryer',
  'Oven / Microwave',
  'Coffee machine / Kettle',
  'Security cameras / NVR',
  'Server / Network',
]

/** Build an appliance row from a preset name (or a blank custom row when null). */
export function makeAppliance(id: number, name: string | null): Appliance {
  return {
    id,
    name: name ?? '',
    custom: !name,
    qty: 1,
  }
}

/**
 * Reduce whatever the customer typed to the Libyan national number.
 *
 * The field sits next to a fixed `+218` prefix, but people still type the
 * country code, a leading zero, or both. Storing it raw meant the sales team
 * received ambiguous strings and the admin panel built dead wa.me links by
 * prepending 218 a second time.
 */
export function normalizeLibyanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00218')) digits = digits.slice(5)
  else if (digits.startsWith('218')) digits = digits.slice(3)
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
  return digits.slice(0, 12)
}

/** Libyan mobile numbers are 9 digits and start with 9 (091…, 092…, 094…). */
export function isValidLibyanMobile(raw: string): boolean {
  const n = normalizeLibyanPhone(raw)
  return /^9\d{8}$/.test(n)
}

/** E.164 for display and for the WhatsApp handoff. */
export function formatPhoneE164(raw: string): string {
  return '+218' + normalizeLibyanPhone(raw)
}

/** Whether the current step's required fields are satisfied. */
export function canContinue(d: FormData, step: number): boolean {
  if (step === 1) {
    return (
      d.name.trim().length >= 2 &&
      // Was `digits.length >= 8`, which accepted "0912345678" and turned it
      // into "+218 0912345678" — a number nobody could call.
      isValidLibyanMobile(d.whatsapp) &&
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

/** Build the WhatsApp deep-link for the completed quote. */
export function whatsappLink(
  d: FormData,
  q: WaQuote,
  waNumber: string,
  buildMessage: (name: string, q: WaQuote) => string,
): string {
  const num = waNumber.replace(/\D/g, '')
  const text = encodeURIComponent(buildMessage(d.name || '', q))
  return 'https://wa.me/' + num + '?text=' + text
}
