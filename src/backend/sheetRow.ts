/**
 * One submission as a row of the team's Leads sheet: readable values in the
 * sheet's language, built from the same labels the customer saw on the
 * review screen. The keys must match LEAD_COLUMNS in Code.gs; a test pins
 * that, so client and script cannot drift.
 */
import { SHEET_LANG } from '../config'
import { BUNDLES } from '../i18n'
import { formatPhoneE164 } from '../logic'
import type { QuoteRecord } from '../pricing/persist'
import type { SizingMethod } from '../pricing/types'
import { buildReviewGroups } from '../review'
import type { LeadSummary } from './protocol'

export const LEAD_COLUMN_KEYS = [
  'submittedAt',
  'reference',
  'name',
  'whatsapp',
  'city',
  'property',
  'language',
  'package',
  'priceLyd',
  'sizingMethod',
  'confidence',
  'dailyCuts',
  'acs',
  'fridge',
  'freezer',
  'lighting',
  'appliances',
  'systemType',
  'cutPriority',
  'roof',
  'shade',
  'customerNotes',
  'warnings',
  'pricingVersion',
] as const
export type LeadColumnKey = (typeof LEAD_COLUMN_KEYS)[number]

/**
 * Labels the customer bundle does not carry (they live in the admin bundle,
 * which customers never download). Small and fixed, so kept here.
 */
const SHEET_WORDS = {
  ar: {
    lang: { ar: 'العربية', en: 'الإنجليزية' },
    tier: { CUSTOM: 'مخصّص', SURVEY: 'تعذّر الحساب' } as Record<string, string>,
    method: {
      packages: 'باقة قياسية',
      residentialBom: 'تركيبة مخصّصة — مكوّنات منزلية',
      commercial: 'الطريقة التجارية',
    } satisfies Record<SizingMethod, string>,
    confidence: { high: 'عالية', low: 'منخفضة' } as Record<string, string>,
    other: 'أخرى — ',
  },
  en: {
    lang: { ar: 'Arabic', en: 'English' },
    tier: { CUSTOM: 'Custom', SURVEY: 'Could not calculate' } as Record<string, string>,
    method: {
      packages: 'Standard package',
      residentialBom: 'Custom build — household components',
      commercial: 'Commercial method',
    } satisfies Record<SizingMethod, string>,
    confidence: { high: 'High', low: 'Low' } as Record<string, string>,
    other: 'Other — ',
  },
}

/** Bidi isolates help on screen; in a spreadsheet cell they are clutter. */
const clean = (s: string) => s.replace(/[⁦-⁩]/g, '').trim()

export function leadToSheetRow(record: QuoteRecord): Record<LeadColumnKey, string | number> {
  const s = BUNDLES[SHEET_LANG]
  const w = SHEET_WORDS[SHEET_LANG]
  const f = record.form
  const r = record.result
  const R = s.review
  const groups = buildReviewGroups(f, s)
  const rows = (step: number) => groups.find((g) => g.step === step)?.rows ?? []
  const value = (step: number, key: string) => clean(rows(step).find((x) => x.k === key)?.v ?? '')

  const cooling = rows(3)
  const acs = cooling.filter((x) => x.k.startsWith(R.acPrefix + ' '))
  const appliances = rows(4).filter((x) => x.k !== R.keys.lighting)

  return {
    submittedAt: '',
    reference: record.id,
    name: f.name,
    whatsapp: formatPhoneE164(f.whatsapp),
    city: f.city,
    property: f.propertyType === 'Other' ? w.other + f.propertyOther : (s.opt.property[f.propertyType] ?? f.propertyType),
    language: w.lang[record.lang],
    package: w.tier[r.recommendedTier] ?? r.recommendedTier,
    priceLyd: r.priceFrom ?? '',
    sizingMethod: w.method[r.sizingMethod],
    confidence: w.confidence[r.confidence] ?? r.confidence,
    dailyCuts: value(2, R.keys.dailyCuts),
    acs: [String(f.acUnits.length), ...acs.map((x) => clean(x.k + ': ' + x.v))].join(' | '),
    fridge: value(3, R.keys.fridge),
    freezer: value(3, R.keys.freezer),
    lighting: value(4, R.keys.lighting),
    appliances: appliances.map((x) => clean(x.k) + ' × ' + clean(x.v)).join(' | '),
    systemType: value(5, R.keys.systemType),
    cutPriority: value(5, R.keys.cutPriority),
    roof: value(5, R.keys.roofSpace),
    shade: value(5, R.keys.roofShade),
    customerNotes: f.notes,
    warnings: r.warnings.map((id) => s.result.warnings[id]).join(' | '),
    pricingVersion: record.configVersion,
  }
}

/** The canonical fields the admin list shows and filters on. */
export function leadSummary(record: QuoteRecord): LeadSummary {
  const f = record.form
  const r = record.result
  return {
    name: f.name,
    whatsapp: f.whatsapp,
    city: f.city,
    property_type: f.propertyType,
    lang: record.lang,
    config_version: record.configVersion,
    tier: r.recommendedTier,
    price_from: r.priceFrom,
    is_custom: r.isCustom,
    confidence: r.confidence,
  }
}
