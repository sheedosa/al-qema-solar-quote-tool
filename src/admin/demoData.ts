import { PRICING_CONFIG } from '../pricing/config'
import { runEngine } from '../pricing/engine'
import { initialData, makeAc, makeAppliance } from '../logic'
import type { FormData } from '../types'

/**
 * Fabricated leads for demo mode.
 *
 * Every name, number and city here is invented. Nothing in this file is read
 * from, or written to, the real database — that is the entire point: the admin
 * panel can be shown to someone without exposing a single real customer.
 *
 * The `form` and `result` payloads are produced by running the REAL pricing
 * engine over the fixtures, so the load audit and BOM tables show genuine
 * output rather than hand-written numbers that would drift from the code.
 */

export type DemoLead = {
  id: string
  created_at: string
  name: string
  whatsapp: string
  city: string
  property_type: string
  lang: 'ar' | 'en'
  config_version: string
  tier: string
  price_from: number | null
  is_custom: boolean
  confidence: string
  form: FormData
  result: ReturnType<typeof runEngine>
}

const ac = (over: Partial<ReturnType<typeof makeAc>>, id: number) => ({ ...makeAc(id), ...over })

/** Build one lead by actually pricing it. */
function lead(
  id: string,
  createdAt: string,
  who: { name: string; whatsapp: string; city: string; property: string; lang: 'ar' | 'en' },
  shape: (d: FormData) => void,
): DemoLead {
  const d = initialData()
  d.name = who.name
  d.whatsapp = who.whatsapp
  d.city = who.city
  d.propertyType = who.property
  d.outageHours = '4–8 hrs'
  d.nightEconomy = 'yes'
  d.operation = 'essentials'
  shape(d)
  const result = runEngine(d, PRICING_CONFIG)
  return {
    id,
    created_at: createdAt,
    name: who.name,
    whatsapp: who.whatsapp,
    city: who.city,
    property_type: who.property,
    lang: who.lang,
    config_version: result.configVersion,
    tier: result.recommendedTier,
    price_from: result.priceFrom,
    is_custom: result.isCustom,
    confidence: result.confidence,
    form: { ...d, photos: { panel: null, meter: null, roof: null, stickers: null } },
    result,
  }
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

export const DEMO_LEADS: DemoLead[] = [
  lead(
    'demo-1',
    hoursAgo(2),
    { name: 'محمد الصويعي', whatsapp: '913344551', city: 'طرابلس', property: 'Home', lang: 'ar' },
    (d) => {
      d.acUnits = [ac({ capValue: '12000', hours: 6, night: true }, 1)]
      d.lighting = { type: 'led', count: 14, watts: '' }
      d.appliances = [makeAppliance(1, 'TV'), makeAppliance(2, 'Router / Internet')]
      d.roofSpace = 'Medium'
      d.roofShade = 'No'
    },
  ),
  lead(
    'demo-2',
    hoursAgo(9),
    { name: 'Yousef Ben Amer', whatsapp: '925501020', city: 'Benghazi', property: 'Shop', lang: 'en' },
    (d) => {
      d.acUnits = [
        ac({ capValue: '18000', hours: 8, night: true }, 1),
        ac({ capValue: '18000', hours: 8, night: true }, 2),
      ]
      d.freezer = { on: true, qty: 2, alwaysOn: true }
      d.lighting = { type: 'mixed', count: 22, watts: '' }
      d.roofSpace = 'Large'
      d.roofShade = 'No'
      d.notes = 'Shop closes at 10pm. Freezers must never go off.'
    },
  ),
  lead(
    'demo-3',
    hoursAgo(26),
    { name: 'فاطمة القذافي', whatsapp: '946677889', city: 'الزاوية', property: 'Home', lang: 'ar' },
    (d) => {
      d.acUnits = [
        ac({ capValue: '18000', hours: 8, night: true }, 1),
        ac({ capValue: '18000', hours: 6, night: true }, 2),
        ac({ capValue: '12000', hours: 5, dontKnow: true }, 3),
      ]
      d.freezer = { on: true, qty: 1, alwaysOn: true }
      d.lighting = { type: 'mixed', count: 18, watts: '' }
      d.appliances = [makeAppliance(1, 'Water pump'), makeAppliance(2, 'Washing machine')]
      d.priority = 'essentials_ac'
      d.priorityAcCount = 1
      d.roofSpace = 'Medium'
      d.roofShade = 'Yes'
      d.notes = 'نرجو التركيب قبل نهاية الشهر. السطح فيه خزان ماء كبير.'
    },
  ),
  lead(
    'demo-4',
    hoursAgo(31),
    { name: 'Ali Mahmoud', whatsapp: '918889990', city: 'Sabha', property: 'Home', lang: 'en' },
    (d) => {
      d.lighting = { type: 'led', count: 8, watts: '' }
      d.roofSpace = 'Small'
    },
  ),
  lead(
    'demo-5',
    hoursAgo(50),
    { name: 'خالد بن سعيد', whatsapp: '927654321', city: 'طرابلس', property: 'Office / Company', lang: 'ar' },
    (d) => {
      d.acUnits = [
        ac({ capValue: '24000', hours: 9, night: false }, 1),
        ac({ capValue: '24000', hours: 9, night: false }, 2),
      ]
      d.appliances = [makeAppliance(1, 'Server / Network'), makeAppliance(2, 'Security cameras / NVR')]
      d.lighting = { type: 'led', count: 40, watts: '' }
      d.roofSpace = 'Large'
    },
  ),
  lead(
    'demo-6',
    hoursAgo(73),
    { name: 'Salem Aboud', whatsapp: '911002003', city: 'Misrata', property: 'Workshop', lang: 'en' },
    (d) => {
      d.acUnits = Array.from({ length: 6 }, (_, i) =>
        ac({ capValue: '32000', hours: 12, night: true }, i + 1),
      )
      d.appliances = [makeAppliance(1, 'Dryer')]
      d.lighting = { type: 'regular', count: 60, watts: '' }
      d.roofSpace = 'Large'
      d.notes = 'Metal workshop, three-phase supply available.'
    },
  ),
]

export const DEMO_CONFIG_HISTORY = [
  {
    id: 'demo-cfg-1',
    version: PRICING_CONFIG.configVersion,
    created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    is_active: true,
  },
  {
    id: 'demo-cfg-0',
    version: 'pricing-demo-previous',
    created_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    is_active: false,
  },
]

export const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'demo@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
