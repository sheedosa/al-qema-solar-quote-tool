import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PRICING_CONFIG } from '../pricing/config'
import { makeHarness } from './appsScriptHarness'
import type { Harness } from './appsScriptHarness'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const ID2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function lead(id = ID, over: Record<string, unknown> = {}) {
  return {
    action: 'submitLead',
    id,
    row: { name: 'أحمد', whatsapp: '+218912345678', city: 'طرابلس', priceLyd: 8730, package: 'S', ...over },
    summary: { name: 'أحمد', whatsapp: '912345678', tier: 'S', price_from: 8730, is_custom: false, confidence: 'high', lang: 'ar' },
    detail: { form: { name: 'أحمد' }, result: { recommendedTier: 'S' } },
  }
}

const GOOD_CLAIMS = (email = 'staff@alqema.ly') => ({
  aud: 'client-123.apps.googleusercontent.com',
  iss: 'https://accounts.google.com',
  exp: String(Math.floor(Date.now() / 1000) + 3600),
  email,
  email_verified: 'true',
  name: 'Staff Member',
})

let h: Harness
beforeEach(() => {
  h = makeHarness({ tokenInfo: (t) => (t.startsWith('good:') ? { code: 200, body: GOOD_CLAIMS(t.slice(5)) } : { code: 400, body: {} }) })
  h.setup()
  h.addStaff('Staff@AlQema.ly')
})

const signIn = (email = 'staff@alqema.ly') => h.post({ action: 'login', idToken: 'good:' + email })

describe('setup', () => {
  it('creates the seven tabs with headers and a token secret', () => {
    const names = h.value<Record<string, string>>('SHEETS')
    expect([...h.sheets.keys()].sort()).toEqual(Object.values(names).sort())
    const n = h.value<unknown[]>('COLUMNS').length
    const headers = h.sheet('leads').getRange(1, 1, 1, n).getValues()[0]
    expect(headers[0]).toBe('وقت الإرسال\nSubmitted')
    expect(headers[h.col('status') - 1]).toBe('الحالة\nStatus')
    expect(h.sheet('data').hidden).toBe(true)
    expect(h.props.get('TOKEN_SECRET')?.length).toBeGreaterThan(40)
  })

  it('puts the team columns right after the customer and the quote', () => {
    expect(h.col('name')).toBe(2)
    expect(h.col('priceLyd')).toBe(7)
    expect([h.col('status'), h.col('assignedTo'), h.col('followUp'), h.col('teamNotes')]).toEqual([8, 9, 10, 11])
  })

  it('renames the tabs made by the first version, keeping their rows', () => {
    // Simulate the first version's layout: English tab names.
    const first = makeHarness()
    const ss = first.value<{ insertSheet(n: string): { getRange(r: number, c: number, a: number, b: number): { setValues(v: unknown[][]): unknown } } }>(
      'SpreadsheetApp.getActiveSpreadsheet()',
    )
    ss.insertSheet('Staff').getRange(1, 1, 2, 1).setValues([['email'], ['keep@alqema.ly']])
    first.setup()
    expect(first.sheets.has('Staff')).toBe(false)
    expect(first.sheet('staff').getRange(2, 1, 1, 1).getValues()[0][0]).toBe('keep@alqema.ly')
  })

  it('refuses to re-lay-out a Leads tab that already holds rows in another layout', () => {
    const other = makeHarness()
    const ss = other.value<{ insertSheet(n: string): { getRange(r: number, c: number, a: number, b: number): { setValues(v: unknown[][]): unknown } } }>(
      'SpreadsheetApp.getActiveSpreadsheet()',
    )
    ss.insertSheet('Leads').getRange(1, 1, 2, 2).setValues([['Submitted', 'Reference'], ['x', 'y']])
    expect(() => other.setup()).toThrow(/different column layout/)
  })

  it('is safe to run twice', () => {
    const secret = h.props.get('TOKEN_SECRET')
    h.setup()
    expect(h.props.get('TOKEN_SECRET')).toBe(secret)
    expect(h.sheet('leads').getLastRow()).toBe(1)
  })
})

describe('submitLead', () => {
  it('appends one Leads row and one LeadData row', () => {
    expect(h.post(lead())).toEqual({ ok: true })
    const leads = h.sheet('leads')
    expect(leads.getLastRow()).toBe(2)
    const n = h.value<unknown[]>('COLUMNS').length
    const row = leads.getRange(2, 1, 1, n).getValues()[0]
    const at = (k: string) => row[h.col(k) - 1]
    // The script's Date comes from the sandbox realm, so check its tag.
    expect(Object.prototype.toString.call(at('submittedAt'))).toBe('[object Date]')
    expect(at('reference')).toBe(ID)
    expect(at('name')).toBe('أحمد')
    expect(at('priceLyd')).toBe(8730)
    expect(at('status')).toBe('جديد')
    expect(at('assignedTo')).toBe('')
    // A tap on the number opens WhatsApp.
    expect(at('whatsapp')).toBe('=HYPERLINK("https://wa.me/218912345678","+218912345678")')
    const data = h.sheet('data').getRange(2, 1, 1, 4).getValues()[0]
    expect(data[0]).toBe(ID)
    expect(JSON.parse(String(data[3])).form.name).toBe('أحمد')
  })

  it('never appends the same submission twice', () => {
    h.post(lead())
    expect(h.post(lead())).toEqual({ ok: true, duplicate: true })
    expect(h.sheet('leads').getLastRow()).toBe(2)
    expect(h.post(lead(ID2)).ok).toBe(true)
    expect(h.sheet('leads').getLastRow()).toBe(3)
  })

  it('stores anything that looks like a formula as text', () => {
    h.post(lead(ID, { name: '=IMPORTDATA("http://x")', city: '@x', customerNotes: '-1+2', panels: '+1' }))
    const n = h.value<unknown[]>('COLUMNS').length
    const row = h.sheet('leads').getRange(2, 1, 1, n).getValues()[0]
    const at = (k: string) => row[h.col(k) - 1]
    expect(at('name')).toBe('\'=IMPORTDATA("http://x")')
    expect(at('city')).toBe("'@x")
    expect(at('customerNotes')).toBe("'-1+2")
    expect(at('panels')).toBe("'+1")
  })

  it('rejects bad input without writing anything', () => {
    const cases: [string, unknown][] = [
      ['id', { ...lead(), id: 'not-a-uuid' }],
      ['phone', lead(ID, { whatsapp: '+218123' })],
      ['name', lead(ID, { name: 'x' })],
      ['type', lead(ID, { city: { a: 1 } })],
      ['long', lead(ID, { city: 'x'.repeat(1001) })],
      ['no detail', { ...lead(), detail: undefined }],
    ]
    for (const [name, body] of cases) expect(h.post(body).code, name).toBe('invalid')
    expect(h.post('{not json').code).toBe('bad_request')
    expect(h.post({ ...lead(), detail: { big: 'x'.repeat(70 * 1024) } }).code).toBe('too_large')
    expect(h.sheet('leads').getLastRow()).toBe(1)
  })

  it('caps the number of submissions per window', () => {
    const limit = h.value<number>('RATE_LIMIT')
    const bucket = 'rl:' + Math.floor(Date.now() / 1000 / h.value<number>('RATE_WINDOW_S'))
    h.cache.set(bucket, String(limit))
    expect(h.post(lead()).code).toBe('rate_limited')
  })
})

describe('pricing', () => {
  it('serves no config until one is published, then the active one', () => {
    expect(h.get({ action: 'config' })).toEqual({ ok: true, version: null, config: null })
    const tok = signIn().token
    const pub = h.post({ action: 'publishConfig', token: tok, config: PRICING_CONFIG })
    expect(pub.ok).toBe(true)
    expect(pub.version).toMatch(/^pricing-\d{4}-\d{2}-\d{2}\.1$/)
    const live = h.get({ action: 'config' })
    expect(live.version).toBe(pub.version)
    expect(live.config.configVersion).toBe(pub.version)
    expect(live.config.packages).toHaveLength(5)
  })

  it('numbers versions within a day and keeps exactly one active', () => {
    const tok = signIn().token
    const a = h.post({ action: 'publishConfig', token: tok, config: PRICING_CONFIG }).version
    const b = h.post({ action: 'publishConfig', token: tok, config: PRICING_CONFIG }).version
    expect(b.endsWith('.2')).toBe(true)
    const list = h.post({ action: 'listVersions', token: tok }).versions
    expect(list.map((v: { version: string }) => v.version)).toEqual([b, a])
    expect(list.filter((v: { is_active: boolean }) => v.is_active).map((v: { version: string }) => v.version)).toEqual([b])
    expect(list[0].created_by).toBe('staff@alqema.ly')
  })

  it('rolls back, and the public config follows at once (cache cleared)', () => {
    const tok = signIn().token
    const a = h.post({ action: 'publishConfig', token: tok, config: PRICING_CONFIG }).version
    const cheaper = JSON.parse(JSON.stringify(PRICING_CONFIG))
    cheaper.packages[0].priceLyd = 1
    h.post({ action: 'publishConfig', token: tok, config: cheaper })
    expect(h.get({ action: 'config' }).config.packages[0].priceLyd).toBe(1)
    expect(h.post({ action: 'activateConfig', token: tok, id: a }).ok).toBe(true)
    expect(h.get({ action: 'config' }).config.packages[0].priceLyd).toBe(PRICING_CONFIG.packages[0].priceLyd)
    expect(h.post({ action: 'getVersion', token: tok, id: a }).config.configVersion).toBe(a)
    expect(h.post({ action: 'activateConfig', token: tok, id: 'nope' }).code).toBe('not_found')
  })

  it('refuses something that is not a pricing config', () => {
    const tok = signIn().token
    expect(h.post({ action: 'publishConfig', token: tok, config: { packages: [] } }).code).toBe('invalid')
  })
})

describe('staff access', () => {
  it('lets a listed Google account in, case-insensitively', () => {
    const r = signIn('STAFF@alqema.ly')
    expect(r.ok).toBe(true)
    expect(r.email).toBe('staff@alqema.ly')
    expect(r.expiresAt).toBeGreaterThan(Date.now())
  })

  it('refuses an account not on the Staff tab, a bad token, and the wrong app', () => {
    expect(signIn('stranger@gmail.com').code).toBe('not_staff')
    expect(h.post({ action: 'login', idToken: 'forged' }).code).toBe('unauthorized')
    const other = makeHarness({ clientId: 'other-app', tokenInfo: () => ({ code: 200, body: GOOD_CLAIMS() }) })
    other.setup()
    other.addStaff('staff@alqema.ly')
    expect(other.post({ action: 'login', idToken: 'x' }).code).toBe('unauthorized')
  })

  it('says so when the client ID is not configured', () => {
    const bare = makeHarness({ clientId: null })
    bare.setup()
    expect(bare.post({ action: 'login', idToken: 'x' }).code).toBe('not_configured')
  })

  it('guards every staff action', () => {
    for (const action of ['listLeads', 'getLead', 'listVersions', 'getVersion', 'publishConfig', 'activateConfig']) {
      expect(h.post({ action }).code, action).toBe('unauthorized')
      expect(h.post({ action, token: 'abc.def' }).code, action).toBe('unauthorized')
    }
  })

  it('rejects a tampered or expired session, and one whose email was removed', () => {
    const tok: string = signIn().token
    const [payload, sig] = tok.split('.')
    const forged = Buffer.from(JSON.stringify({ e: 'staff@alqema.ly', x: Date.now() + 1e9 })).toString('base64url')
    expect(h.post({ action: 'listLeads', token: forged + '.' + sig }).code).toBe('unauthorized')
    expect(h.post({ action: 'listLeads', token: payload + '.' + sig }).ok).toBe(true)

    const expired = makeHarness({ tokenInfo: () => ({ code: 200, body: GOOD_CLAIMS() }) })
    expired.setup()
    expired.addStaff('staff@alqema.ly')
    // Sign a token that ran out a minute ago with the harness's own secret.
    const secret = expired.props.get('TOKEN_SECRET')!
    const old = Buffer.from(JSON.stringify({ e: 'staff@alqema.ly', x: Date.now() - 60000 })).toString('base64url')
    const oldSig = createHmac('sha256', secret).update(old).digest('base64url')
    expect(expired.post({ action: 'listLeads', token: old + '.' + oldSig }).code).toBe('unauthorized')

    h.sheet('staff').getRange(2, 1, 1, 1).setValues([['']])
    expect(h.post({ action: 'listLeads', token: tok }).code).toBe('unauthorized')
  })
})

describe('leads for the admin panel', () => {
  it('lists newest first with the team status, and opens one', () => {
    h.post(lead(ID))
    h.post(lead(ID2, { name: 'سالم' }))
    h.sheet('leads').getRange(2, h.col('status'), 1, 1).setValues([['تم التواصل']])
    const tok = signIn().token
    const list = h.post({ action: 'listLeads', token: tok }).leads
    expect(list.map((l: { id: string }) => l.id)).toEqual([ID2, ID])
    expect(list[1].status).toBe('تم التواصل')
    expect(list[1].tier).toBe('S')
    expect(typeof list[0].created_at).toBe('string')
    const one = h.post({ action: 'getLead', token: tok, id: ID })
    expect(one.form.name).toBe('أحمد')
    expect(one.status).toBe('تم التواصل')
    expect(h.post({ action: 'getLead', token: tok, id: ID.replace('0f', 'ff') }).code).toBe('not_found')
  })
})
