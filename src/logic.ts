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
