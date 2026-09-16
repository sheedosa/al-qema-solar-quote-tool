import { describe, expect, it } from 'vitest'
import {
  BULB_VALS,
  BUNDLES,
  INVERTER_VALS,
  OPERATION_VALS,
  OUTAGE_VALS,
  PRIORITY_VALS,
  PROPERTY_VALS,
  ROOF_VALS,
  SHADE_VALS,
  SYSTEM_VALS,
} from '../i18n'
import { PRESET_NAMES } from '../logic'
import { ADMIN_BUNDLES } from './strings'

/**
 * Every leaf path in a bundle, with its kind. Plural forms are a leaf: they are
 * a map whose keys legitimately differ between languages (Arabic has six
 * categories, English two), so the walk stops at any object with `other`.
 */
type Leaf = { path: string; kind: 'string' | 'function' | 'plural' }

function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [{ path, kind: 'string' }]
  if (typeof node === 'function') return [{ path, kind: 'function' }]
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (typeof obj.other === 'string') return [{ path, kind: 'plural' }]
    return Object.keys(obj)
      .sort()
      .flatMap((k) => leaves(obj[k], path ? path + '.' + k : k))
  }
  throw new Error('unexpected leaf at ' + path + ': ' + String(node))
}

describe('1. The Arabic and English admin bundles have identical shape', () => {
  const en = leaves(ADMIN_BUNDLES.en)
  const ar = leaves(ADMIN_BUNDLES.ar)

  it('same paths, same kinds', () => {
    // The type system already guarantees this; the runtime walk is the belt
    // to its braces, and it also catches a value that is an empty string.
    expect(ar.map((l) => l.path + ':' + l.kind)).toEqual(en.map((l) => l.path + ':' + l.kind))
  })

  it('no empty strings in either', () => {
    const empty = (b: unknown) =>
      leaves(b)
        .filter((l) => l.kind === 'string')
        .filter((l) => {
          const v = l.path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], b)
          return String(v).trim() === ''
        })
        .map((l) => l.path)
    expect(empty(ADMIN_BUNDLES.en)).toEqual([])
    expect(empty(ADMIN_BUNDLES.ar)).toEqual([])
  })

  it('every plural has an `other` form and the token in it or a numberless phrase', () => {
    for (const bundle of [ADMIN_BUNDLES.en, ADMIN_BUNDLES.ar]) {
      for (const l of leaves(bundle).filter((x) => x.kind === 'plural')) {
        const forms = l.path
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], bundle) as Record<
          string,
          string
        >
        expect(typeof forms.other).toBe('string')
        // `other` is the fallback for any count, so it must carry the number.
        expect(forms.other).toContain('{n}')
      }
    }
  })
})

describe('2. Every stored form value the admin shows has a label in both languages', () => {
  // The admin renders these through the customer bundle's `opt` maps. A
  // canonical value with no entry would render as its raw code — exactly the
  // "essentials_ac_most on screen" problem this phase removes.
  const cases: [string, string[], keyof (typeof BUNDLES)['en']['opt']][] = [
    ['property', PROPERTY_VALS, 'property'],
    ['outage', OUTAGE_VALS, 'outage'],
    ['operation', OPERATION_VALS, 'operation'],
    ['roof', ROOF_VALS, 'roof'],
    ['shade', SHADE_VALS, 'shade'],
    ['system', SYSTEM_VALS, 'system'],
    ['priority', PRIORITY_VALS, 'priority'],
    ['bulb', BULB_VALS, 'bulb'],
    ['inverter', INVERTER_VALS, 'inverter'],
    ['preset', PRESET_NAMES, 'preset'],
  ]
  for (const [label, values, key] of cases) {
    it(label, () => {
      for (const lang of ['en', 'ar'] as const) {
        for (const v of values) {
          expect(BUNDLES[lang].opt[key][v], `${lang}.opt.${key}[${v}]`).toBeTruthy()
        }
      }
    })
  }

  it('the short property labels cover every property value', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const v of PROPERTY_VALS) {
        expect(ADMIN_BUNDLES[lang].labels.propertyShort[v], `${lang} ${v}`).toBeTruthy()
      }
    }
  })
})
