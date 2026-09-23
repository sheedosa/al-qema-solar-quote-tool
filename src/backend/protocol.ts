/**
 * The wire contract with backend/google-apps-script/Code.gs. Every answer is
 * `{ ok: true, … }` or `{ ok: false, code, message }`; Apps Script always
 * replies HTTP 200, so the body is the only place a failure shows.
 */
import type { EngineResult, PricingConfig } from '../pricing/types'
import type { FormData } from '../types'
import type { LeadColumnKey } from './sheetRow'

export type ErrorCode =
  | 'bad_request'
  | 'invalid'
  | 'too_large'
  | 'rate_limited'
  | 'busy'
  | 'unauthorized'
  | 'not_staff'
  | 'not_configured'
  | 'not_found'
  | 'server'
  /** Client-side: no answer, or not the script answering. */
  | 'network'
  | 'bad_response'

export type ApiError = { ok: false; code: ErrorCode; message: string }

/** Canonical values for the admin list, stored beside each Leads row. */
export type LeadSummary = {
  name: string
  whatsapp: string
  city: string
  property_type: string
  lang: string
  config_version: string
  tier: string
  price_from: number | null
  is_custom: boolean
  confidence: string
}

export type SubmitLeadRequest = {
  action: 'submitLead'
  id: string
  row: Partial<Record<LeadColumnKey, string | number>>
  summary: LeadSummary
  detail: { form: FormData; result: EngineResult }
}

export type LeadListItem = LeadSummary & { id: string; created_at: string; status: string }
export type VersionRow = { id: string; version: string; created_at: string; created_by: string; is_active: boolean }

export type Responses = {
  submitLead: { duplicate?: boolean }
  config: { version: string | null; config: unknown }
  login: { token: string; email: string; name: string; expiresAt: number }
  listLeads: { leads: LeadListItem[] }
  getLead: { form: FormData; result: EngineResult; status: string }
  listVersions: { versions: VersionRow[] }
  getVersion: { version: string; config: unknown }
  publishConfig: { version: string }
  activateConfig: { version: string }
}

export type Action = keyof Responses
export type ApiResult<A extends Action> = ({ ok: true } & Responses[A]) | ApiError

export type { PricingConfig }
