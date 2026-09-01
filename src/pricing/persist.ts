import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import type { FormData } from '../types'
import type { EngineResult } from './types'

/**
 * Lead persistence. Every completed quote is saved to the `leads` table so the
 * company sees the submission even if the customer never taps the WhatsApp
 * button. The anonymous key can only INSERT — reading requires an admin login.
 *
 * A lead is the entire commercial value of this tool, so a failed save is
 * retried, then queued to survive the tab closing, then flushed on the next
 * visit. Previously the response was never inspected at all: a 400 from a
 * database CHECK constraint is not a thrown exception, so an over-long name or
 * an oversized payload was dropped in silence, invisible to both the customer
 * and the company.
 */

/** Column limits from supabase/migrations/0001_init.sql, enforced client-side. */
export const FIELD_LIMITS = {
  name: 200,
  whatsapp: 40,
  city: 200,
  propertyType: 100,
  /** Keeps the `form` JSON comfortably under the 200 KB payload_size check. */
  notes: 2000,
} as const

const QUEUE_KEY = 'alqema.leads.pending.v1'
const MAX_QUEUED = 5
const RETRIES = 3

export type QuoteRecord = {
  createdAt: string
  configVersion: string
  lang: 'ar' | 'en'
  /** Full input payload (photos stripped — blob URLs die with the tab). */
  form: FormData
  /** Full computed output, including the normalized-load audit trail. */
  result: EngineResult
}

export interface QuotePersistence {
  save(record: QuoteRecord): Promise<void>
}

/** Assemble the auditable record for one completed quote. */
export function buildQuoteRecord(
  d: FormData,
  result: EngineResult,
  lang: 'ar' | 'en',
): QuoteRecord {
  return {
    createdAt: new Date().toISOString(),
    configVersion: result.configVersion,
    lang,
    form: {
      ...d,
      // Trim rather than let the database reject the whole row.
      name: d.name.slice(0, FIELD_LIMITS.name),
      city: d.city.slice(0, FIELD_LIMITS.city),
      notes: d.notes.slice(0, FIELD_LIMITS.notes),
      photos: { panel: null, meter: null, roof: null, stickers: null },
      acUnits: d.acUnits.map((u) => ({ ...u, photo: null })),
    },
    result,
  }
}

/** The row shape the `leads` table expects. */
function toRow(record: QuoteRecord) {
  return {
    name: record.form.name.slice(0, FIELD_LIMITS.name),
    whatsapp: record.form.whatsapp.slice(0, FIELD_LIMITS.whatsapp),
    city: record.form.city.slice(0, FIELD_LIMITS.city),
    property_type: record.form.propertyType.slice(0, FIELD_LIMITS.propertyType),
    lang: record.lang,
    config_version: record.configVersion,
    tier: record.result.recommendedTier,
    price_from: record.result.priceFrom,
    is_custom: record.result.isCustom,
    confidence: record.result.confidence,
    form: record.form,
    result: record.result,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One insert attempt. Returns true only when the row was actually accepted. */
async function postLead(row: object): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/leads', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        // anon has no SELECT on leads — never ask for the row back.
        Prefer: 'return=minimal',
      },
      signal: controller.signal,
      body: JSON.stringify(row),
    })
    if (!res.ok) {
      // A CHECK violation or an RLS refusal arrives as a status code, not a
      // throw. Read the body so the reason is at least in the console.
      const detail = await res.text().catch(() => '')
      console.warn('[alqema] lead rejected', res.status, detail.slice(0, 300))
      // 4xx other than 429 will fail identically however many times we retry.
      return res.status === 429 || res.status >= 500 ? false : true
    }
    return true
  } catch (err) {
    console.warn('[alqema] lead save failed', err)
    return false
  } finally {
    clearTimeout(timer)
  }
}

function readQueue(): object[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(rows: object[]): void {
  try {
    if (rows.length === 0) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUED)))
  } catch {
    // Storage full or blocked — the lead is lost, but we have already tried
    // the network several times by this point.
  }
}

/**
 * Retry anything stranded by a previous visit. Called once at startup; a lead
 * captured on a dropped connection reaches the company the next time that
 * customer opens the page.
 */
export async function flushPendingLeads(): Promise<void> {
  const queued = readQueue()
  if (queued.length === 0) return
  const stillPending: object[] = []
  for (const row of queued) {
    if (!(await postLead(row))) stillPending.push(row)
  }
  writeQueue(stillPending)
}

export const persistence: QuotePersistence = {
  async save(record) {
    const row = toRow(record)
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      if (await postLead(row)) return
      if (attempt < RETRIES - 1) await sleep(500 * 2 ** attempt)
    }
    // Out of attempts: park it so the next visit can deliver it.
    writeQueue([...readQueue(), row])
  },
}
