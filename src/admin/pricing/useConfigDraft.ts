/**
 * The Pricing page's state: the live config, the draft being edited, what
 * differs, and what the validator thinks of the draft right now.
 *
 * Validation runs ~300 ms after every change rather than on save, so a bad
 * value is flagged at the field the moment it is typed. Errors are keyed by
 * path (`packages[2].priceLyd`) so a control bound to that path can show its
 * own message, and `errorFor` also looks at the field's containers — the
 * validator attaches "needs a whole-number count above 0 and Ah above 0" to
 * `packages[0].battery`, not to `.count`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { diffConfig } from '../../pricing/diff'
import type { ConfigChange } from '../../pricing/diff'
import { domId, parentPath, setAt } from '../../pricing/paths'
import type { PricingConfig } from '../../pricing/types'
import { validatePricingConfig } from '../../pricing/validate'
import { fieldErrors as labelAll } from '../configLabels'
import type { LabeledError } from '../configLabels'
import { useAdminLang } from '../i18n'

const VALIDATE_DELAY_MS = 300

/**
 * Containers whose errors are about the container itself, not every field
 * inside it: a missing appliance preset is reported on the table, not on the
 * watts of every other appliance.
 */
const NOT_INHERITED = new Set(['loadDefaults.appliancesByName'])

/**
 * The error for a field: its own, else its nearest container's — but never a
 * top-level section's, whose errors are structural and shown at the top.
 */
export function resolveFieldError(errors: Record<string, LabeledError>, path: string): LabeledError | null {
  let p: string | null = path
  while (p !== null) {
    const hit = errors[p]
    if (hit && (p === path || (!NOT_INHERITED.has(p) && parentPath(p) !== null))) return hit
    p = parentPath(p)
  }
  return null
}

/** Scroll a field into view and focus it, if it is on the page. */
export function revealPath(path: string): boolean {
  const el = document.getElementById(domId(path))
  if (!el) return false
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
  return true
}

export type ConfigDraft = {
  live: PricingConfig | null
  draft: PricingConfig | null
  /** Replace both live and draft (after a load or a publish). */
  load: (cfg: PricingConfig) => void
  /** Deep-clone-then-mutate, the editor's one write primitive. */
  patch: (mutate: (draft: PricingConfig) => void) => void
  setPath: (path: string, value: unknown) => void
  discard: () => void
  dirty: boolean
  changes: ConfigChange[]
  /** Raw validator messages for the current draft (debounced). */
  errors: string[]
  /** Labelled, keyed by path. */
  fieldErrors: Record<string, LabeledError>
  errorFor: (path: string) => LabeledError | null
  firstErrorPath: string | null
  /** True while a change is waiting for the validator. */
  validating: boolean
}

export function useConfigDraft(): ConfigDraft {
  const { t, opt } = useAdminLang()
  const [live, setLive] = useState<PricingConfig | null>(null)
  const [draft, setDraft] = useState<PricingConfig | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [validating, setValidating] = useState(false)

  const load = useCallback((cfg: PricingConfig) => {
    setLive(cfg)
    setDraft(cfg)
    setErrors([])
  }, [])

  const patch = useCallback((mutate: (d: PricingConfig) => void) => {
    setDraft((cur) => {
      if (!cur) return cur
      // JSON round-trip: cheap at this size, and it also turns a NaN into
      // null, which is what a cleared number should be.
      const next = JSON.parse(JSON.stringify(cur)) as PricingConfig
      mutate(next)
      return next
    })
  }, [])

  const setPath = useCallback((path: string, value: unknown) => patch((d) => setAt(d, path, value)), [patch])
  const discard = useCallback(() => setDraft(live), [live])

  const changes = useMemo(() => (live && draft ? diffConfig(live, draft) : []), [live, draft])
  const dirty = changes.length > 0

  // Debounced validation. The first run after a load is immediate so a live
  // config that already fails (rows predating a validator rule) is flagged
  // before anyone edits.
  useEffect(() => {
    if (!draft) return
    setValidating(true)
    const run = () => {
      const r = validatePricingConfig(draft)
      setErrors(r.ok ? [] : r.errors)
      setValidating(false)
    }
    if (draft === live) {
      run()
      return
    }
    const id = setTimeout(run, VALIDATE_DELAY_MS)
    return () => clearTimeout(id)
  }, [draft, live])

  // The unload guard the old editor's comment promised and never had.
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const fieldErrors = useMemo(() => labelAll(errors, t, opt), [errors, t, opt])
  const errorFor = useCallback((path: string) => resolveFieldError(fieldErrors, path), [fieldErrors])
  const firstErrorPath = useMemo(() => {
    const first = Object.keys(fieldErrors)[0]
    return first ?? null
  }, [fieldErrors])

  return {
    live,
    draft,
    load,
    patch,
    setPath,
    discard,
    dirty,
    changes,
    errors,
    fieldErrors,
    errorFor,
    firstErrorPath,
    validating,
  }
}
