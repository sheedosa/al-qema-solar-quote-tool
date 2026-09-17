/**
 * Everything the Pricing page says to the database, behind four functions,
 * plus the pure version-number rule so it can be tested without a client.
 *
 * `pricing_configs.version` is UNIQUE. The old editor derived the next number
 * from the 50 most recent rows it happened to hold, so on a busy day two
 * managers could both compute `.3` and the second insert would fail with a
 * constraint error labelled "Cannot save". The repo asks the database for
 * today's versions immediately before inserting and retries once on 23505.
 */
import type { PricingConfig } from '../../pricing/types'
import { validatePricingConfig } from '../../pricing/validate'
import { supabase } from '../supabaseClient'

export type ConfigRow = { id: string; version: string; created_at: string; is_active: boolean }

/** `pricing-2026-09-17.` — the date part is UTC, as every existing version is. */
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

export async function listVersions(): Promise<ConfigRow[]> {
  const { data } = await supabase
    .from('pricing_configs')
    .select('id, version, created_at, is_active')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data as ConfigRow[] | null) ?? []
}

/** The stored config of one version, unvalidated — callers validate before use. */
export async function fetchConfig(id: string): Promise<unknown> {
  const { data } = await supabase.from('pricing_configs').select('config').eq('id', id).single()
  return data ? (data as { config: unknown }).config : null
}

export type PublishOutcome =
  | { ok: true; version: string }
  /** The candidate failed validation — the page shows these in place. */
  | { ok: false; stage: 'invalid'; errors: string[] }
  /** The insert failed; nothing was saved. */
  | { ok: false; stage: 'insert'; message: string }
  /** The version number was taken twice in a row; nothing was saved. */
  | { ok: false; stage: 'clash'; message: string; version: string }
  /** The row exists but could not be made live — it is in the history, inactive. */
  | { ok: false; stage: 'activate'; message: string; version: string }

/**
 * Save the draft as a new version and make it live. Two round trips before
 * the insert (today's versions, then the insert itself) and one after (the
 * activate RPC), so the outcome names which step failed — "saved but not
 * activated" is a very different situation from "nothing saved".
 */
export async function publish(config: PricingConfig): Promise<PublishOutcome> {
  let lastClash: { message: string; version: string } | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const today = new Date()
    const { data: rows, error: listErr } = await supabase
      .from('pricing_configs')
      .select('version')
      .like('version', versionPrefix(today) + '%')
    if (listErr) return { ok: false, stage: 'insert', message: listErr.message }
    const existing = ((rows as { version: string }[] | null) ?? []).map((r) => r.version)
    const version = nextVersion(existing, today)

    const checked = validatePricingConfig({ ...config, configVersion: version })
    if (!checked.ok) return { ok: false, stage: 'invalid', errors: checked.errors }

    const { data, error } = await supabase
      .from('pricing_configs')
      .insert({ version, config: checked.config, is_active: false })
      .select('id')
      .single()
    if (error || !data) {
      const message = error?.message ?? 'insert failed'
      if (error?.code === '23505') {
        lastClash = { message, version }
        continue
      }
      return { ok: false, stage: 'insert', message }
    }
    const { error: rpcErr } = await supabase.rpc('activate_pricing_config', { target: (data as { id: string }).id })
    if (rpcErr) return { ok: false, stage: 'activate', message: rpcErr.message, version }
    return { ok: true, version }
  }
  return { ok: false, stage: 'clash', message: lastClash?.message ?? '', version: lastClash?.version ?? '' }
}

/** Make an existing version live again. */
export async function activate(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('activate_pricing_config', { target: id })
  return error ? { ok: false, message: error.message } : { ok: true }
}
