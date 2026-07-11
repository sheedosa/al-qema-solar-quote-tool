export type AcUnit = {
  location: string
  type: '' | 'Split' | 'Window'
  capValue: string
  capUnit: 'btu' | 'ton'
  dontKnow: boolean
  model: string
  photo: string | null
  inverter: '' | 'yes' | 'no' | 'unsure'
  hours: number
  night: boolean
}

export type ColdUnit = {
  on: boolean
  qty: number
  capacityL: string
  condition: 'new' | 'old'
  alwaysOn: boolean
}

export type Lighting = {
  type: '' | 'led' | 'regular' | 'mixed'
  count: number
  watts: string
  nightHours: number
}

export type Appliance = {
  id: number
  name: string
  custom: boolean
  pump: boolean
  hp: string
  qty: number
  hours: number
  night: boolean
  watts: string
  defW: number
}

export type PhotoKey = 'panel' | 'meter' | 'roof' | 'stickers'

export type FormData = {
  name: string
  whatsapp: string
  propertyType: string
  propertyOther: string
  city: string
  supply: string
  outageHours: string
  peakTime: string
  nightEconomy: string
  operation: string
  acUnits: AcUnit[]
  fridge: ColdUnit
  freezer: ColdUnit
  lighting: Lighting
  appliances: Appliance[]
  heavyDuty: string[]
  systemType: string
  priority: string
  priorityAcCount: number
  roofSpace: string
  roofShade: string
  photos: Record<PhotoKey, string | null>
  notes: string
}

export type Estimate = {
  kwp: string
  inv: string
  bat: string
  daily: string
  price: string
}
