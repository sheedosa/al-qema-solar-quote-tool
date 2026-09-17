/**
 * Reference households: seven fixed customers the Pricing page re-prices before
 * every publish, so a manager sees what a change does to real quotes instead
 * of reading constants. They double as a regression net — a test pins the
 * package each one lands on at the bundled config, and a future edit that
 * moves one fails the build on purpose.
 *
 * Built with the same helpers as the wizard, so they are exactly the shape a
 * real submission has.
 */
import { initialData, makeAc, makeAppliance } from '../logic'
import type { AcUnit, FormData } from '../types'

export type ReferenceCaseId =
  | 'smallFlat'
  | 'familyHomeOneAc'
  | 'homeAcAndFreezer'
  | 'homeTwoAcs'
  | 'shop'
  | 'largeVilla'
  | 'workshop'

export type ReferenceCase = { id: ReferenceCaseId; form: FormData }

/**
 * Ordered small → large. At the bundled config they land on S, M, L, XL, XXL
 * and two custom builds (a household one and a large one), so every price on
 * the Prices page moves at least one row of the review table.
 */
export const REFERENCE_CASE_IDS: readonly ReferenceCaseId[] = [
  'smallFlat',
  'familyHomeOneAc',
  'homeAcAndFreezer',
  'homeTwoAcs',
  'shop',
  'largeVilla',
  'workshop',
]

const ac = (id: number, over: Partial<AcUnit>): AcUnit => ({ ...makeAc(id), ...over })

function build(id: ReferenceCaseId, shape: (d: FormData) => void): ReferenceCase {
  const d = initialData()
  // A complete step-2 so the fixture is a form the wizard would accept.
  d.name = 'Reference'
  d.whatsapp = '911234567'
  d.city = 'Tripoli'
  d.propertyType = 'Home'
  d.outageHours = '4–8 hrs'
  d.nightEconomy = 'yes'
  d.operation = 'essentials'
  d.roofSpace = 'Medium'
  d.roofShade = 'No'
  shape(d)
  return { id, form: d }
}

export const REFERENCE_CASES: readonly ReferenceCase[] = [
  build('smallFlat', (d) => {
    d.lighting = { type: 'led', count: 8, watts: '' }
    d.appliances = [makeAppliance(1, 'TV'), makeAppliance(2, 'Router / Internet')]
    d.roofSpace = 'Small'
  }),
  build('familyHomeOneAc', (d) => {
    d.acUnits = [ac(1, { capValue: '12000', inverter: 'no', hours: 2, night: true })]
    d.lighting = { type: 'led', count: 10, watts: '' }
    d.appliances = [
      makeAppliance(1, 'TV'),
      makeAppliance(2, 'Router / Internet'),
      makeAppliance(3, 'Phone / Laptop charger'),
    ]
    d.operation = 'essentials_fans_ac_part'
  }),
  build('homeAcAndFreezer', (d) => {
    d.acUnits = [ac(1, { capValue: '12000', inverter: 'no', hours: 4, night: true })]
    d.freezer = { on: true, qty: 1, alwaysOn: true }
    d.lighting = { type: 'led', count: 14, watts: '' }
    d.appliances = [
      makeAppliance(1, 'TV'),
      makeAppliance(2, 'Router / Internet'),
      makeAppliance(3, 'Phone / Laptop charger'),
      makeAppliance(4, 'Water pump'),
    ]
    d.operation = 'essentials_fans_ac_part'
  }),
  build('homeTwoAcs', (d) => {
    d.acUnits = [
      ac(1, { capValue: '12000', inverter: 'yes', hours: 3, night: true }),
      ac(2, { capValue: '12000', inverter: 'no', hours: 3, night: true }),
    ]
    d.freezer = { on: true, qty: 1, alwaysOn: true }
    d.lighting = { type: 'mixed', count: 16, watts: '' }
    d.appliances = [
      makeAppliance(1, 'TV'),
      makeAppliance(2, 'Router / Internet'),
      makeAppliance(3, 'Washing machine'),
    ]
    d.operation = 'essentials_ac_most'
    d.priority = 'essentials_ac'
    d.priorityAcCount = 1
  }),
  build('shop', (d) => {
    d.propertyType = 'Shop'
    d.acUnits = [
      ac(1, { capValue: '12000', inverter: 'no', hours: 6, night: false }),
      ac(2, { capValue: '12000', inverter: 'no', hours: 6, night: false }),
    ]
    d.fridge = { on: true, qty: 1, alwaysOn: true }
    d.freezer = { on: true, qty: 1, alwaysOn: true }
    d.lighting = { type: 'mixed', count: 20, watts: '' }
    d.appliances = [makeAppliance(1, 'Security cameras / NVR'), makeAppliance(2, 'Router / Internet')]
    d.nightEconomy = 'no'
    d.operation = 'everything'
    d.priority = 'full'
  }),
  // Beyond every package: the household custom build, where a COMPONENT
  // price edit is visible.
  build('largeVilla', (d) => {
    d.acUnits = [
      ac(1, { capValue: '18000', inverter: 'yes', hours: 8, night: true }),
      ac(2, { capValue: '18000', inverter: 'yes', hours: 8, night: true }),
      ac(3, { capValue: '12000', inverter: 'no', hours: 6, night: true }),
    ]
    d.freezer = { on: true, qty: 1, alwaysOn: true }
    d.lighting = { type: 'led', count: 30, watts: '' }
    d.appliances = [
      makeAppliance(1, 'TV'),
      makeAppliance(2, 'Router / Internet'),
      makeAppliance(3, 'Water pump'),
      makeAppliance(4, 'Washing machine'),
    ]
    d.roofSpace = 'Large'
    d.operation = 'essentials_ac_most'
    d.priority = 'essentials_ac'
    d.priorityAcCount = 1
  }),
  // Lands on the custom build like the villa, but far past the hand-over kW:
  // the row that switches to the commercial method the day its parts are
  // priced.
  build('workshop', (d) => {
    d.propertyType = 'Workshop'
    d.acUnits = Array.from({ length: 6 }, (_, i) =>
      ac(i + 1, { capValue: '32000', inverter: 'no', hours: 12, night: false }),
    )
    d.lighting = { type: 'regular', count: 60, watts: '' }
    d.appliances = [makeAppliance(1, 'Dryer'), makeAppliance(2, 'Server / Network')]
    d.roofSpace = 'Large'
    d.nightEconomy = 'no'
    d.operation = 'everything'
    d.priority = 'full'
  }),
]
