/**
 * What a draft config changes — as a list of fields, and as its effect on a
 * set of reference households.
 *
 * Both are pure so the review sheet and the tests use the same code. The
 * household comparison is the accuracy guard of the redesigned Pricing page:
 * a manager does not need to read a depth-of-discharge to know a change is
 * wrong when the table says the family home just moved from L to XL.
 */
import { runEngine } from './engine'
import { formatPath } from './paths'
import type { Seg } from './paths'
import { REFERENCE_CASES } from './referenceCases'
import type { ReferenceCase, ReferenceCaseId } from './referenceCases'
import type { EngineResult, PricingConfig } from './types'

export type ConfigChange = { path: string; before: unknown; after: unknown }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Leaf-wise diff. Arrays compare by index, objects by key (draft's key order,
 * then anything only the live config has). When a node changes TYPE — a
 * battery switching from liquid to lithium replaces the whole object — one
 * change is emitted for the node rather than one per stray leaf.
 */
export function diffConfig(live: unknown, draft: unknown): ConfigChange[] {
  const out: ConfigChange[] = []
  const walk = (a: unknown, b: unknown, segs: Seg[]) => {
    if (Object.is(a, b)) return
    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length)
      for (let i = 0; i < n; i++) walk(a[i], b[i], [...segs, { index: i }])
      return
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      const keys = [...Object.keys(b), ...Object.keys(a).filter((k) => !(k in b))]
      for (const k of keys) walk(a[k], b[k], [...segs, { key: k }])
      return
    }
    out.push({ path: formatPath(segs), before: a, after: b })
  }
  walk(live, draft, [])
  return out
}

export type CaseComparison = {
  id: ReferenceCaseId
  liveTier: EngineResult['recommendedTier']
  livePrice: number | null
  draftTier: EngineResult['recommendedTier']
  draftPrice: number | null
  changed: boolean
}

/**
 * A half-edited draft can make the engine throw (a component the recipe
 * names but the price list no longer has). That is a validation problem the
 * sheet reports separately; here it reads as "no price" rather than a crash.
 */
function safeRun(form: ReferenceCase['form'], cfg: PricingConfig) {
  try {
    const r = runEngine(form, cfg)
    return { tier: r.recommendedTier, price: r.priceFrom }
  } catch {
    return { tier: 'SURVEY' as const, price: null }
  }
}

export function compareConfigs(
  live: PricingConfig,
  draft: PricingConfig,
  cases: readonly ReferenceCase[] = REFERENCE_CASES,
): CaseComparison[] {
  return cases.map((c) => {
    const a = safeRun(c.form, live)
    const b = safeRun(c.form, draft)
    return {
      id: c.id,
      liveTier: a.tier,
      livePrice: a.price,
      draftTier: b.tier,
      draftPrice: b.price,
      changed: a.tier !== b.tier || a.price !== b.price,
    }
  })
}
