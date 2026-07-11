import type { Strings } from './i18n'
import type { FormData } from './types'

export type ReviewRow = { k: string; v: string }
export type ReviewGroup = { title: string; step: number; rows: ReviewRow[] }

/** Builds the grouped, localized review summary shown on the final review screen. */
export function buildReviewGroups(d: FormData, s: Strings): ReviewGroup[] {
  const R = s.review
  const dash = (v: string | undefined | null) => v || R.dash

  const coolBits: ReviewRow[] = []
  coolBits.push({ k: R.keys.acUnits, v: String(d.acUnits.length) })
  d.acUnits.forEach((u, i) => {
    const cap = u.dontKnow
      ? R.capWeCheck
      : u.capValue
        ? u.capValue + ' ' + u.capUnit.toUpperCase()
        : R.capDash
    const typeLabel = u.type ? s.opt.acType[u.type] : R.typeDash
    coolBits.push({
      k: R.acPrefix + ' ' + (i + 1) + (u.location ? ' · ' + u.location : ''),
      v: typeLabel + R.sep + cap + R.sep + u.hours + R.hUnit + (u.night ? R.nights : ''),
    })
  })
  const coldValue = (r: FormData['fridge']) =>
    r.on ? r.qty + ' × ' + s.reviewMap.condition[r.condition] + (r.alwaysOn ? R.alwaysOn : '') : R.no
  coolBits.push({ k: R.keys.fridge, v: coldValue(d.fridge) })
  coolBits.push({ k: R.keys.freezer, v: coldValue(d.freezer) })

  const lt = d.lighting
  const lightType = lt.type ? s.opt.bulb[lt.type] : R.typeWord
  const appBits: ReviewRow[] = [
    {
      k: R.keys.lighting,
      v:
        lt.count +
        ' ' +
        R.bulbsWord +
        ' (' +
        lightType +
        ')' +
        R.sep +
        lt.nightHours +
        R.hUnit +
        ' ' +
        R.atNightSuffix,
    },
  ]
  d.appliances.forEach((a) => {
    const name = a.custom ? a.name || R.customDevice : s.opt.preset[a.name] || a.name
    appBits.push({
      k: name,
      v: a.qty + ' × ' + a.hours + R.hUnit + R.perDay + (a.night ? R.nights : ''),
    })
  })
  if (d.heavyDuty.length)
    appBits.push({ k: R.keys.heavyDuty, v: d.heavyDuty.length + ' ' + R.selectedSuffix })

  const photoCount = (Object.keys(d.photos) as (keyof FormData['photos'])[]).filter(
    (k) => d.photos[k],
  ).length

  return [
    {
      title: R.groups.details,
      step: 1,
      rows: [
        { k: R.keys.name, v: dash(d.name) },
        { k: R.keys.whatsapp, v: d.whatsapp ? '‎+218 ' + d.whatsapp : R.dash },
        {
          k: R.keys.property,
          v:
            d.propertyType === 'Other'
              ? dash(d.propertyOther)
              : dash(s.opt.property[d.propertyType]),
        },
        { k: R.keys.city, v: dash(d.city) },
      ],
    },
    {
      title: R.groups.power,
      step: 2,
      rows: [
        { k: R.keys.supply, v: dash(s.opt.supply[d.supply]) },
        { k: R.keys.dailyCuts, v: dash(s.opt.outage[d.outageHours]) },
        { k: R.keys.peakTime, v: dash(s.opt.peak[d.peakTime]) },
        { k: R.keys.atNight, v: dash(s.reviewMap.nightEconomy[d.nightEconomy]) },
        { k: R.keys.usagePattern, v: dash(s.opt.operation[d.operation]) },
      ],
    },
    { title: R.groups.cooling, step: 3, rows: coolBits },
    { title: R.groups.appliances, step: 4, rows: appBits },
    {
      title: R.groups.preferences,
      step: 5,
      rows: [
        { k: R.keys.systemType, v: dash(s.reviewMap.system[d.systemType]) },
        {
          k: R.keys.cutPriority,
          v:
            dash(s.reviewMap.priority[d.priority]) +
            (d.priority === 'essentials_ac'
              ? ' (' + d.priorityAcCount + ' ' + s.reviewMap.acSuffix + ')'
              : ''),
        },
        { k: R.keys.roofSpace, v: dash(s.opt.roof[d.roofSpace]) },
        { k: R.keys.roofShade, v: dash(s.opt.shade[d.roofShade]) },
        { k: R.keys.photos, v: photoCount + ' ' + R.ofFourAdded },
      ],
    },
  ]
}
