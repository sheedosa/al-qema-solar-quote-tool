import type { FormData } from './types'

export type ReviewRow = { k: string; v: string }
export type ReviewGroup = { title: string; step: number; rows: ReviewRow[] }

const dash = (v: string | undefined | null) => v || '—'

const LABEL_MAPS = {
  systemType: {
    hybrid: 'Hybrid',
    offgrid: 'Off-grid',
    ongrid: 'On-grid',
    recommend: 'Recommend for me',
  } as Record<string, string>,
  priority: {
    essentials: 'Essentials only',
    essentials_ac: 'Essentials + AC',
    full: 'Full power',
  } as Record<string, string>,
  nightEconomy: {
    yes: 'Essentials only at night',
    no: 'Similar power day & night',
  } as Record<string, string>,
}

/** Builds the grouped review summary shown on the final review screen. */
export function buildReviewGroups(d: FormData): ReviewGroup[] {
  const coolBits: ReviewRow[] = []
  coolBits.push({ k: 'AC units', v: String(d.acUnits.length) })
  d.acUnits.forEach((u, i) => {
    const cap = u.dontKnow
      ? 'capacity: we’ll check'
      : u.capValue
        ? u.capValue + ' ' + u.capUnit.toUpperCase()
        : 'capacity: —'
    coolBits.push({
      k: 'AC ' + (i + 1) + (u.location ? ' · ' + u.location : ''),
      v: dash(u.type) + ', ' + cap + ', ' + u.hours + 'h' + (u.night ? ', nights' : ''),
    })
  })
  coolBits.push({
    k: 'Fridge',
    v: d.fridge.on
      ? d.fridge.qty + ' × ' + d.fridge.condition + (d.fridge.alwaysOn ? ', always on' : '')
      : 'No',
  })
  coolBits.push({
    k: 'Freezer',
    v: d.freezer.on
      ? d.freezer.qty + ' × ' + d.freezer.condition + (d.freezer.alwaysOn ? ', always on' : '')
      : 'No',
  })

  const lt = d.lighting
  const appBits: ReviewRow[] = [
    {
      k: 'Lighting',
      v: lt.count + ' bulbs (' + dash(lt.type || 'type —') + '), ' + lt.nightHours + 'h at night',
    },
  ]
  d.appliances.forEach((a) =>
    appBits.push({
      k: dash(a.name || 'Custom device'),
      v: a.qty + ' × ' + a.hours + 'h/day' + (a.night ? ', nights' : ''),
    }),
  )
  if (d.heavyDuty.length) appBits.push({ k: 'Heavy-duty', v: d.heavyDuty.length + ' selected' })

  const photoCount = (Object.keys(d.photos) as (keyof FormData['photos'])[]).filter(
    (k) => d.photos[k],
  ).length

  return [
    {
      title: 'Your details',
      step: 1,
      rows: [
        { k: 'Name', v: dash(d.name) },
        { k: 'WhatsApp', v: d.whatsapp ? '+218 ' + d.whatsapp : '—' },
        {
          k: 'Property',
          v: d.propertyType === 'Other' ? dash(d.propertyOther) : dash(d.propertyType),
        },
        { k: 'City / area', v: dash(d.city) },
      ],
    },
    {
      title: 'Power use',
      step: 2,
      rows: [
        { k: 'Supply', v: dash(d.supply) },
        { k: 'Daily cuts', v: dash(d.outageHours) },
        { k: 'Peak time', v: dash(d.peakTime) },
        { k: 'At night', v: dash(LABEL_MAPS.nightEconomy[d.nightEconomy]) },
        { k: 'Usage pattern', v: dash(d.operation) },
      ],
    },
    { title: 'Cooling', step: 3, rows: coolBits },
    { title: 'Appliances', step: 4, rows: appBits },
    {
      title: 'Preferences',
      step: 5,
      rows: [
        { k: 'System type', v: dash(LABEL_MAPS.systemType[d.systemType]) },
        {
          k: 'Cut priority',
          v:
            dash(LABEL_MAPS.priority[d.priority]) +
            (d.priority === 'essentials_ac' ? ' (' + d.priorityAcCount + ' AC)' : ''),
        },
        { k: 'Roof space', v: dash(d.roofSpace) },
        { k: 'Roof shade', v: dash(d.roofShade) },
        { k: 'Photos', v: photoCount + ' of 4 added' },
      ],
    },
  ]
}
