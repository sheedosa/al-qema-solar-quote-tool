export type AcUnit = {
  /**
   * Stable identity for React keys. Rows hold an uncontrolled file input, so
   * keying by array index made a removed row hand its DOM node — and its stale
   * file selection — to the row that shifted into its place.
   */
  id: number
  /** '' | '9000' | '12000' | '18000' | '24000' | '32000' — BTU, chosen from fixed options. */
  capValue: string
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
  alwaysOn: boolean
}

export type Lighting = {
  type: '' | 'led' | 'regular' | 'mixed'
  count: number
  watts: string
}

export type Appliance = {
  id: number
  name: string
  custom: boolean
  qty: number
}

export type PhotoKey = 'panel' | 'meter' | 'roof' | 'stickers'

export type FormData = {
  name: string
  whatsapp: string
  propertyType: string
  propertyOther: string
  city: string
  outageHours: string
  nightEconomy: string
  operation: string
  acUnits: AcUnit[]
  fridge: ColdUnit
  freezer: ColdUnit
  lighting: Lighting
  appliances: Appliance[]
  systemType: string
  priority: string
  priorityAcCount: number
  roofSpace: string
  roofShade: string
  photos: Record<PhotoKey, string | null>
  notes: string
}

