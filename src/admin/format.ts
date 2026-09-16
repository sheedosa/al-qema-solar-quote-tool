/**
 * Number, date and duration formatting for the admin panel.
 *
 * One place, so the panel stops mixing `en-US` numbers with `en-GB` dates and
 * hand-rolled English plurals. DOM-free on purpose — vitest imports it in Node.
 *
 * Digits are Western (0–9) in BOTH languages. That is the Libyan convention
 * for prices and phone numbers, it is what the customer site does, and it
 * keeps every figure copy-pasteable into WhatsApp and Excel.
 */
import type { Lang } from '../i18n'

/**
 * Numbers are formatted with `en-US` regardless of language: the grouping and
 * decimal symbols are then deterministic (CLDR's `ar` symbols under `latn` are
 * not something to gamble a price on) and match the customer app exactly.
 */
const NUM_LOCALE = 'en-US'

/**
 * Dates are numeric `DD/MM/YYYY HH:mm` in both languages, the Libyan
 * convention. An Arabic-locale date string carries invisible right-to-left
 * marks between its fields and expects an RTL paragraph; rendered inside the
 * LTR isolate every figure in the panel uses, it came out as `2026/09/1511:15`.
 * A purely numeric date has no such dependency and reads the same everywhere.
 */
const DATE_LOCALE = 'en-GB-u-nu-latn'

export const fmtNum = (n: number, maxFrac = 0): string =>
  n.toLocaleString(NUM_LOCALE, { maximumFractionDigits: maxFrac })

/**
 * A plain-text price for CSV cells, `title=` attributes and the clipboard.
 * On screen, use `<Money>` from controls.tsx instead, which isolates only the
 * number so the currency word follows the document direction.
 */
export const fmtPrice = (n: number | null, currency: string, dash = '—'): string =>
  n === null ? dash : fmtNum(n) + ' ' + currency

const dateTimeFormat = () =>
  new Intl.DateTimeFormat(DATE_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `hourCycle`, not `hour12: false`: the latter can emit "24:05" in Chromium.
    hourCycle: 'h23',
  })

const dateFormat = () =>
  new Intl.DateTimeFormat(DATE_LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit' })

/** `lang` is accepted for call-site symmetry with the other helpers. */
export const fmtDateTime = (iso: string, _lang: Lang): string =>
  dateTimeFormat().format(new Date(iso))

export const fmtDate = (iso: string, _lang: Lang): string => dateFormat().format(new Date(iso))

/**
 * "22 minutes ago" / "قبل 22 دقيقة". Beyond a week the exact date is more
 * useful than "9 days ago", so it falls back to `fmtDate`. `now` is injectable
 * so tests are deterministic.
 */
export function fmtRelative(iso: string, lang: Lang, now: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const diffMs = new Date(iso).getTime() - now
  const mins = Math.round(diffMs / 60_000)
  if (Math.abs(mins) < 1) return rtf.format(0, 'second')
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) <= 7) return rtf.format(days, 'day')
  return fmtDate(iso, lang)
}

/**
 * Plural forms as data. Arabic has six categories where English has two, so
 * the bundle supplies whichever it needs and `other` is the guaranteed
 * fallback. `{n}` is replaced with the formatted number.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {}

export function plural(n: number, forms: PluralForms, lang: Lang): string {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang))
  const form = forms[rules.select(n)] ?? forms.other
  return form.replace('{n}', fmtNum(n))
}
