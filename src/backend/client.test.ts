import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config', async (orig) => ({
  ...(await orig<typeof import('../config')>()),
  SHEETS_API_URL: 'https://script.google.com/macros/s/TEST/exec',
}))

import { initialData, makeAc, makeAppliance } from '../logic'
import { PRICING_CONFIG } from '../pricing/config'
import { runEngine } from '../pricing/engine'
import { buildQuoteRecord, flushPendingLeads, persistence } from '../pricing/persist'
import { loadActiveConfig, TIMEOUT_NO_CACHE_MS, TIMEOUT_WITH_CACHE_MS } from '../pricing/remoteConfig'
import { makeHarness } from './appsScriptHarness'
import { LEAD_COLUMN_KEYS, leadToSheetRow } from './sheetRow'

function form() {
  const d = initialData()
  d.name = 'أحمد علي'
  d.whatsapp = '0912345678'
  d.city = 'طرابلس'
  d.propertyType = 'Home'
  d.outageHours = '4–8 hrs'
  d.acUnits = [{ ...makeAc(1), capValue: '12000', hours: 6, night: true }]
  d.appliances = [makeAppliance(1, 'TV')]
  d.lighting = { type: 'led', count: 10, watts: '' }
  d.priority = 'essentials'
  d.roofSpace = 'Medium'
  d.roofShade = 'No'
  d.notes = '=HYPERLINK("x")'
  return d
}
const record = () => {
  const d = form()
  return buildQuoteRecord(d, runEngine(d, PRICING_CONFIG), 'ar')
}

/** An in-memory localStorage, fresh per test. */
function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the Leads row', () => {
  it('has exactly the columns the script writes, in its order', () => {
    const h = makeHarness()
    const scriptKeys = h.value<[string, string][]>('LEAD_COLUMNS').map((c) => c[0])
    expect([...LEAD_COLUMN_KEYS]).toEqual(scriptKeys)
    expect(Object.keys(leadToSheetRow(record())).sort()).toEqual([...scriptKeys].sort())
  })

  it('reads in Arabic, with an E.164 number and no bidi control characters', () => {
    const row = leadToSheetRow(record())
    expect(row.whatsapp).toBe('+218912345678')
    expect(row.property).toBe('منزل')
    expect(row.language).toBe('العربية')
    expect(row.dailyCuts).toMatch(/[؀-ۿ]/)
    expect(String(row.acs).startsWith('1 | ')).toBe(true)
    expect(String(row.acs)).toContain('12,000')
    expect(String(row.appliances)).toContain('× 1')
    expect(typeof row.priceLyd).toBe('number')
    for (const v of Object.values(row)) expect(String(v)).not.toMatch(/[⁦-⁩]/)
  })

  it('is accepted by the real script, formula-looking notes included', () => {
    const h = makeHarness()
    h.setup()
    const rec = record()
    const r = h.post({ action: 'submitLead', id: rec.id, row: leadToSheetRow(rec), summary: {}, detail: { form: rec.form, result: rec.result } })
    expect(r).toEqual({ ok: true })
    const line = h.sheet('Leads').getRange(2, 1, 1, 26).getValues()[0]
    expect(line[21]).toBe('\'=HYPERLINK("x")')
  })
})

describe('saving a lead', () => {
  it('gives every submission its own id', () => {
    expect(record().id).toMatch(/^[0-9a-f-]{36}$/)
    expect(record().id).not.toBe(record().id)
  })

  it('retries with the same id, then queues it, then delivers it next visit', async () => {
    vi.useFakeTimers()
    const bodies: { id: string; action: string }[] = []
    let up = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)))
        if (!up) throw new TypeError('offline')
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }),
    )
    const rec = record()
    const saving = persistence.save(rec)
    await vi.runAllTimersAsync()
    await saving
    expect(bodies).toHaveLength(3)
    expect(new Set(bodies.map((b) => b.id))).toEqual(new Set([rec.id]))
    expect(bodies[0].action).toBe('submitLead')
    expect(JSON.parse(localStorage.getItem('alqema.leads.pending.v2')!)).toHaveLength(1)

    up = true
    await flushPendingLeads()
    expect(bodies[3].id).toBe(rec.id)
    expect(localStorage.getItem('alqema.leads.pending.v2')).toBeNull()
  })

  it('does not queue a lead the backend refused on content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, code: 'invalid', message: 'Bad name' }))))
    await persistence.save(record())
    expect(localStorage.getItem('alqema.leads.pending.v2')).toBeNull()
  })

  it('sends text/plain, so the browser makes no CORS preflight', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', f)
    await persistence.save(record())
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/)
  })
})

describe('loading prices at startup', () => {
  const published = { ...PRICING_CONFIG, configVersion: 'pricing-2026-09-23.1' }

  it('uses the published version and caches it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, version: 'v', config: published }))))
    const r = await loadActiveConfig()
    expect(r.source).toBe('remote')
    expect(r.cfg.configVersion).toBe('pricing-2026-09-23.1')
    expect(localStorage.getItem('alqema.pricing.cache.v1')).toContain('pricing-2026-09-23.1')
  })

  it('uses the built-in prices when nothing is published yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, version: null, config: null }))))
    expect((await loadActiveConfig()).source).toBe('bundled')
  })

  it('waits longer for a first-time visitor than for one with a cached copy', async () => {
    const seen: number[] = []
    const realTimeout = globalThis.setTimeout
    vi.stubGlobal('setTimeout', ((fn: () => void, ms?: number) => {
      if (ms && ms >= 1000) seen.push(ms)
      return realTimeout(fn, 0)
    }) as typeof setTimeout)
    // Never answers: the abort from the timer decides.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
      ),
    )
    expect((await loadActiveConfig()).source).toBe('bundled')
    localStorage.setItem('alqema.pricing.cache.v1', JSON.stringify(published))
    expect((await loadActiveConfig()).source).toBe('cache')
    expect(seen).toEqual([TIMEOUT_NO_CACHE_MS, TIMEOUT_WITH_CACHE_MS])
  })

  it('treats Google’s HTML sign-in page as no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Sign in</html>', { status: 200 })))
    expect((await loadActiveConfig()).source).toBe('bundled')
  })
})
