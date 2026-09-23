/**
 * Everything the admin panel asks of the backend, behind one interface.
 *
 * Two implementations: the Google Sheets web app, and a demo double that
 * serves invented leads and keeps published prices in memory. The swap
 * happens here, at the single seam, so no screen knows which it is using.
 * Demo mode (#/admin?demo) never makes a network request.
 */
import { SHEETS_API_URL, GOOGLE_CLIENT_ID } from '../config'
import { callApi } from '../backend/api'
import type { ErrorCode, LeadListItem, VersionRow } from '../backend/protocol'
import { PRICING_CONFIG } from '../pricing/config'
import type { EngineResult, PricingConfig } from '../pricing/types'
import type { FormData } from '../types'
import { DEMO_CONFIG_HISTORY, DEMO_LEADS, DEMO_USER } from './demoData'

/** Demo mode is opt-in via the URL: #/admin?demo (or #/admin/demo). */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return hash.startsWith('#/admin') && /(\?|&|\/)demo\b/.test(hash)
}

export type StaffSession = { email: string; name: string; token: string; expiresAt: number }
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string }
export type LeadDetail = { form: FormData; result: EngineResult; status: string }
export type ActiveConfig = { version: string | null; config: unknown }

export interface AdminBackend {
  readonly demo: boolean
  /** Both the web-app URL and the OAuth client ID are filled in. */
  readonly configured: boolean
  getSession(): StaffSession | null
  /** Called with `null` when the session ends: sign-out, expiry, or revoked. */
  onSessionChange(cb: (s: StaffSession | null, reason?: 'expired') => void): () => void
  signIn(googleIdToken: string): Promise<Result<StaffSession>>
  signOut(): void
  listLeads(): Promise<Result<LeadListItem[]>>
  getLead(id: string): Promise<Result<LeadDetail>>
  listVersions(): Promise<Result<VersionRow[]>>
  getVersion(id: string): Promise<Result<unknown>>
  publish(config: PricingConfig): Promise<Result<{ version: string }>>
  activate(id: string): Promise<Result<{ version: string }>>
  activeConfig(): Promise<Result<ActiveConfig>>
}

/* --------------------------------------------------------------- sheets */

const SESSION_KEY = 'alqema.admin.session.v1'

function readSession(): StaffSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as StaffSession | null
    return s && typeof s.token === 'string' && s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

function makeSheetsBackend(): AdminBackend {
  let session = readSession()
  const listeners = new Set<(s: StaffSession | null, reason?: 'expired') => void>()
  const setSession = (s: StaffSession | null, reason?: 'expired') => {
    session = s
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // blocked storage: the session lasts for this tab only
    }
    listeners.forEach((cb) => cb(s, reason))
  }

  /** A staff call. An `unauthorized` answer ends the session everywhere. */
  async function staff<A extends 'listLeads' | 'getLead' | 'listVersions' | 'getVersion' | 'publishConfig' | 'activateConfig', T>(
    action: A,
    body: object,
    pick: (r: Record<string, unknown>) => T,
  ): Promise<Result<T>> {
    const s = session && session.expiresAt > Date.now() ? session : null
    if (!s) {
      setSession(null, 'expired')
      return { ok: false, code: 'unauthorized', message: 'Session expired' }
    }
    const res = await callApi(action, { ...body, token: s.token }, 30000)
    if (!res.ok) {
      if (res.code === 'unauthorized') setSession(null, 'expired')
      return res
    }
    return { ok: true, data: pick(res as unknown as Record<string, unknown>) }
  }

  return {
    demo: false,
    configured: SHEETS_API_URL !== '' && GOOGLE_CLIENT_ID !== '',
    getSession: () => (session && session.expiresAt > Date.now() ? session : null),
    onSessionChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signIn(idToken) {
      const res = await callApi('login', { idToken }, 30000)
      if (!res.ok) return res
      const s: StaffSession = { email: res.email, name: res.name, token: res.token, expiresAt: res.expiresAt }
      setSession(s)
      return { ok: true, data: s }
    },
    signOut: () => setSession(null),
    listLeads: () => staff('listLeads', {}, (r) => r.leads as LeadListItem[]),
    getLead: (id) =>
      staff('getLead', { id }, (r) => ({ form: r.form as FormData, result: r.result as EngineResult, status: String(r.status ?? '') })),
    listVersions: () => staff('listVersions', {}, (r) => r.versions as VersionRow[]),
    getVersion: (id) => staff('getVersion', { id }, (r) => r.config),
    publish: (config) => staff('publishConfig', { config }, (r) => ({ version: String(r.version) })),
    activate: (id) => staff('activateConfig', { id }, (r) => ({ version: String(r.version) })),
    async activeConfig() {
      // Staff read the same public endpoint the site does.
      const res = await callApi('config', {}, 15000)
      return res.ok ? { ok: true, data: { version: res.version, config: res.config } } : res
    },
  }
}

/* ----------------------------------------------------------------- demo */

const DEMO_STATUSES = ['جديد', 'تم التواصل', 'أُرسل العرض', 'جديد', 'تم البيع', 'جديد', 'لم يتم']

function makeDemoBackend(): AdminBackend {
  // Published prices live in memory: a demo publish shows up in the history
  // and can be rolled back, and a reload puts everything back.
  const versions: (VersionRow & { config: PricingConfig })[] = DEMO_CONFIG_HISTORY.map((v) => ({
    id: v.id,
    version: v.version,
    created_at: v.created_at,
    created_by: DEMO_USER.email,
    is_active: v.is_active,
    config: PRICING_CONFIG,
  }))
  const session: StaffSession = { email: DEMO_USER.email, name: 'Demo', token: 'demo', expiresAt: Date.now() + 864e5 }
  const ok = <T>(data: T): Promise<Result<T>> => Promise.resolve({ ok: true, data })
  const leads: LeadListItem[] = DEMO_LEADS.map((l, i) => ({
    id: l.id,
    created_at: l.created_at,
    name: l.name,
    whatsapp: l.whatsapp,
    city: l.city,
    property_type: l.property_type,
    lang: l.lang,
    config_version: l.config_version,
    tier: l.tier,
    price_from: l.price_from,
    is_custom: l.is_custom,
    confidence: l.confidence,
    status: DEMO_STATUSES[i % DEMO_STATUSES.length],
  }))
  const row = (v: (typeof versions)[number]): VersionRow => ({
    id: v.id,
    version: v.version,
    created_at: v.created_at,
    created_by: v.created_by,
    is_active: v.is_active,
  })

  return {
    demo: true,
    configured: true,
    getSession: () => session,
    onSessionChange: () => () => {},
    signIn: () => ok(session),
    signOut: () => {
      // Leaving demo mode means dropping the flag from the URL.
      window.location.hash = '#/admin'
      window.location.reload()
    },
    listLeads: () => ok(leads),
    getLead(id) {
      const l = DEMO_LEADS.find((x) => x.id === id)
      const s = leads.find((x) => x.id === id)
      return l
        ? ok({ form: l.form, result: l.result, status: s?.status ?? '' })
        : Promise.resolve({ ok: false, code: 'not_found', message: 'No such lead (demo)' })
    },
    listVersions: () => ok(versions.map(row)),
    getVersion(id) {
      const v = versions.find((x) => x.id === id)
      return v ? ok(v.config) : Promise.resolve({ ok: false, code: 'not_found', message: 'No such version (demo)' })
    },
    publish(config) {
      const prefix = 'pricing-' + new Date().toISOString().slice(0, 10) + '.'
      const n = versions.filter((v) => v.version.startsWith(prefix)).length + 1
      const version = prefix + n
      versions.forEach((v) => (v.is_active = false))
      versions.unshift({
        id: version,
        version,
        created_at: new Date().toISOString(),
        created_by: DEMO_USER.email,
        is_active: true,
        config: { ...config, configVersion: version },
      })
      return ok({ version })
    },
    activate(id) {
      const v = versions.find((x) => x.id === id)
      if (!v) return Promise.resolve({ ok: false, code: 'not_found', message: 'No such version (demo)' })
      versions.forEach((x) => (x.is_active = x.id === id))
      return ok({ version: v.version })
    },
    activeConfig() {
      const v = versions.find((x) => x.is_active)
      return ok({ version: v?.version ?? null, config: v?.config ?? null })
    },
  }
}

export const backend: AdminBackend = isDemoMode() ? makeDemoBackend() : makeSheetsBackend()
