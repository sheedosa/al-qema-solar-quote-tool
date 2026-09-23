import { callApi, isRetryable } from '../backend/api'
import type { SubmitLeadRequest } from '../backend/protocol'
import { leadSummary, leadToSheetRow } from '../backend/sheetRow'
import type { FormData } from '../types'
import type { EngineResult } from './types'

/**
 * Lead persistence. Every completed quote is sent to the backend (a Google
 * Sheet, see backend/) so the company sees the submission even if the
 * customer never taps the WhatsApp button. Only the backend can read leads
 * back — a staff sign-in is required.
 *
 * A lead is the entire commercial value of this tool, so a failed save is
 * retried, then queued to survive the tab closing, then flushed on the next
 * visit. Each submission carries its own id and the backend ignores an id it
 * has already stored, so a retry after a timeout that actually succeeded can
 * never produce a second row.
 */

/** Field limits, mirrored by the backend's own checks (Code.gs). */
export const FIELD_LIMITS = {
  name: 200,
  whatsapp: 40,
  city: 200,
  propertyType: 100,
  /** Keeps a submission comfortably under the backend's 64 KB request cap. */
  notes: 2000,
} as const

const QUEUE_KEY = 'alqema.leads.pending.v2'
/** Rows queued for the previous backend; their shape no longer fits. */
const LEGACY_QUEUE_KEY = 'alqema.leads.pending.v1'
const MAX_QUEUED = 5
const RETRIES = 3

export type QuoteRecord = {
  /** Identity of this submission — the backend's duplicate check keys on it. */
  id: string
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
    id: newId(),
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

/** A v4 UUID; `randomUUID` is missing on older phones' browsers. */
function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** The request the backend's `submitLead` expects. */
export function toRequest(record: QuoteRecord): SubmitLeadRequest {
  return {
    action: 'submitLead',
    id: record.id,
    row: leadToSheetRow(record),
    summary: leadSummary(record),
    detail: { form: record.form, result: record.result },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * One delivery attempt. True when the lead is stored — or when retrying could
 * never help (the backend refused its content), so it is not queued forever.
 */
async function postLead(req: SubmitLeadRequest): Promise<boolean> {
  const res = await callApi('submitLead', req, 15000)
  if (res.ok) return true
  console.warn('[alqema] lead not saved', res.code, res.message)
  return !isRetryable(res.code)
}

function readQueue(): SubmitLeadRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(rows: SubmitLeadRequest[]): void {
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
  try {
    localStorage.removeItem(LEGACY_QUEUE_KEY)
  } catch {
    // blocked storage — nothing to clean
  }
  const queued = readQueue()
  if (queued.length === 0) return
  const stillPending: SubmitLeadRequest[] = []
  for (const row of queued) {
    if (!(await postLead(row))) stillPending.push(row)
  }
  writeQueue(stillPending)
}

export const persistence: QuotePersistence = {
  async save(record) {
    const req = toRequest(record)
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      if (await postLead(req)) return
      if (attempt < RETRIES - 1) await sleep(500 * 2 ** attempt)
    }
    // Out of attempts: park it so the next visit can deliver it. Same id, so
    // if an earlier attempt did land, the backend drops the resend.
    writeQueue([...readQueue().filter((q) => q.id !== req.id), req])
  },
}
