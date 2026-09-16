import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtNum, fmtPrice, fmtRelative, plural } from './format'

// Intl's Arabic output interleaves U+200F (RLM) between date fields. Tests
// strip it so they assert on the visible characters only.
const visible = (s: string) => s.replace(/‏/g, '')
const EASTERN_DIGITS = /[٠-٩]/

describe('1. Numbers are Western digits with fixed separators in both languages', () => {
  it('groups with a comma and never emits Eastern Arabic digits', () => {
    expect(fmtNum(12000)).toBe('12,000')
    expect(fmtNum(93.75, 2)).toBe('93.75')
    expect(fmtNum(1234567.891, 1)).toBe('1,234,567.9')
  })

  it('formats a price with the caller’s currency word and a dash for null', () => {
    expect(fmtPrice(15417, 'LYD')).toBe('15,417 LYD')
    expect(fmtPrice(15417, 'د.ل')).toBe('15,417 د.ل')
    expect(fmtPrice(null, 'LYD')).toBe('—')
  })
})

describe('2. Dates are numeric day-first with Western digits in both languages', () => {
  const iso = '2026-09-16T00:05:00Z'

  it('English is day-first, 24-hour, and 00:xx is never written as 24:xx', () => {
    const s = fmtDateTime(iso, 'en')
    expect(s).toMatch(/16\/09\/2026/)
    expect(s).toMatch(/00:05/)
    expect(s).not.toMatch(/24:05/)
  })

  it('Arabic is the same numeric form — no locale marks that break inside an LTR run', () => {
    const s = fmtDateTime(iso, 'ar')
    expect(s).not.toMatch(EASTERN_DIGITS)
    expect(s).not.toMatch(/\u200f/)
    expect(s).toBe(fmtDateTime(iso, 'en'))
  })

  it('a bare date has no time component', () => {
    expect(visible(fmtDate(iso, 'en'))).not.toMatch(/:/)
    expect(visible(fmtDate(iso, 'ar'))).not.toMatch(EASTERN_DIGITS)
  })
})

describe('3. Relative time reads naturally in both languages', () => {
  const now = Date.parse('2026-09-16T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('English', () => {
    expect(fmtRelative(ago(20_000), 'en', now)).toBe('now')
    expect(fmtRelative(ago(22 * 60_000), 'en', now)).toBe('22 minutes ago')
    expect(fmtRelative(ago(3 * 3_600_000), 'en', now)).toBe('3 hours ago')
    expect(fmtRelative(ago(24 * 3_600_000), 'en', now)).toBe('yesterday')
    expect(fmtRelative(ago(3 * 86_400_000), 'en', now)).toBe('3 days ago')
  })

  it('Arabic uses Arabic words and Western digits', () => {
    const s = fmtRelative(ago(22 * 60_000), 'ar', now)
    expect(s).toMatch(/قبل/)
    expect(s).toMatch(/22/)
    expect(s).not.toMatch(EASTERN_DIGITS)
  })

  it('falls back to a plain date beyond a week', () => {
    const s = fmtRelative(ago(9 * 86_400_000), 'en', now)
    expect(s).toMatch(/2026/)
    expect(s).not.toMatch(/ago/)
  })
})

describe('4. Plurals follow CLDR categories, not an appended “s”', () => {
  const en = { one: '{n} submission', other: '{n} submissions' }
  const ar = {
    zero: 'لا طلبات',
    one: 'طلب واحد',
    two: 'طلبان',
    few: '{n} طلبات',
    many: '{n} طلبًا',
    other: '{n} طلب',
  }

  it('English has two forms', () => {
    expect(plural(1, en, 'en')).toBe('1 submission')
    expect(plural(0, en, 'en')).toBe('0 submissions')
    expect(plural(12000, en, 'en')).toBe('12,000 submissions')
  })

  it('Arabic selects all six', () => {
    expect(plural(0, ar, 'ar')).toBe('لا طلبات')
    expect(plural(1, ar, 'ar')).toBe('طلب واحد')
    expect(plural(2, ar, 'ar')).toBe('طلبان')
    expect(plural(3, ar, 'ar')).toBe('3 طلبات')
    expect(plural(11, ar, 'ar')).toBe('11 طلبًا')
    expect(plural(100, ar, 'ar')).toBe('100 طلب')
  })

  it('falls back to `other` when a form is missing', () => {
    expect(plural(2, en, 'ar')).toBe('2 submissions')
  })
})
