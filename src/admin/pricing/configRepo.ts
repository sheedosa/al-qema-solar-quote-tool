/**
 * Everything the Pricing page says to the backend, plus the version rule used
 * for the "Publish as …" label.
 *
 * The backend assigns the version and makes it live in one locked step
 * (Code.gs `publishConfig`), so a clash or a "saved but not live" version can
 * no longer happen; `nextVersion` here only predicts the label.
 */
import type { VersionRow } from '../../backend/protocol'
import type { PricingConfig } from '../../pricing/types'
import { validatePricingConfig } from '../../pricing/validate'
import { backend } from '../backend'

export type ConfigRow = VersionRow

/** `pricing-2026-09-17.` — the date part is UTC, as the backend's is. */
export const versionPrefix = (today: Date): string => 'pricing-' + today.toISOString().slice(0, 10) + '.'

/** The next free `pricing-YYYY-MM-DD.N` given the versions that already exist. */
export function nextVersion(existing: readonly string[], today: Date): string {
  const prefix = versionPrefix(today)
  const taken = existing
    .filter((v) => v.startsWith(prefix))
    .map((v) => parseInt(v.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  return prefix + (taken.length ? Math.max(...taken) + 1 : 1)
}

/** The version history, or null when the backend could not be read. */
export async function listVersions(): Promise<ConfigRow[] | null> {
  const r = await backend.listVersions()
  return r.ok ? r.data : null
}

/** The stored config of one version, unvalidated — callers validate before use. */
export async function fetchConfig(id: string): Promise<unknown> {
  const r = await backend.getVersion(id)
  return r.ok ? r.data : null
}

export type PublishOutcome =
  | { ok: true; version: string }
  /** The candidate failed validation — the page shows these in place. */
  | { ok: false; stage: 'invalid'; errors: string[] }
  /** The backend refused or could not be reached; nothing was saved. */
  | { ok: false; stage: 'failed'; message: string }

/** Save the draft as a new version and make it live. */
export async function publish(config: PricingConfig): Promise<PublishOutcome> {
  // Validated here with the same rules the site's boot loader applies, so a
  // version the site would reject can never go live.
  const checked = validatePricingConfig(config)
  if (!checked.ok) return { ok: false, stage: 'invalid', errors: checked.errors }
  const r = await backend.publish(checked.config)
  return r.ok ? { ok: true, version: r.data.version } : { ok: false, stage: 'failed', message: r.message }
}

/** Make an existing version live again. */
export async function activate(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await backend.activate(id)
  return r.ok ? { ok: true } : { ok: false, message: r.message }
}
