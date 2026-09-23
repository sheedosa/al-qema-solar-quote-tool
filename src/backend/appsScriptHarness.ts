/**
 * Test-only: runs backend/google-apps-script/Code.gs inside a `vm` context
 * with in-memory stand-ins for the Google services it uses. The script is
 * loaded as text, exactly as it will be pasted into the Apps Script editor,
 * so the tests exercise the real file rather than a copy.
 */
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

const CODE_PATH = new URL('../../backend/google-apps-script/Code.gs', import.meta.url)
export const CODE = readFileSync(CODE_PATH, 'utf8')

type Cell = unknown

/** A permissive stand-in for any Sheets object the tests do not care about. */
function loose(): unknown {
  const target = function () {} as unknown as object
  const p: unknown = new Proxy(target, {
    get: (_t, k) => (k === 'then' ? undefined : () => p),
    apply: () => p,
  })
  return p
}

export class FakeSheet {
  cells: Cell[][] = []
  hidden = false
  constructor(public name: string) {}
  getName() {
    return this.name
  }
  getLastRow() {
    for (let r = this.cells.length - 1; r >= 0; r--) {
      if ((this.cells[r] ?? []).some((c) => c !== '' && c !== undefined && c !== null)) return r + 1
    }
    return 0
  }
  getMaxRows() {
    return 1000
  }
  getMaxColumns() {
    return 26
  }
  getRange(row: number, col: number, rows = 1, cols = 1) {
    if (row < 1 || col < 1 || rows < 1 || cols < 1) throw new Error(`bad range ${row},${col},${rows},${cols}`)
    if (col + cols - 1 > 26) throw new Error('range outside the sheet')
    const sheet = this
    const range = {
      getValues: () =>
        Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => {
            const v = sheet.cells[row - 1 + i]?.[col - 1 + j]
            return v === undefined ? '' : v
          }),
        ),
      setValues: (vals: Cell[][]) => {
        if (vals.length !== rows || vals.some((r) => r.length !== cols)) throw new Error('setValues shape mismatch')
        vals.forEach((r, i) => {
          const line = (sheet.cells[row - 1 + i] ??= [])
          r.forEach((v, j) => (line[col - 1 + j] = v))
        })
        return range
      },
      setNumberFormat: () => range,
      setFontWeight: () => range,
      setDataValidation: () => range,
    }
    return range
  }
  hideSheet() {
    this.hidden = true
  }
  getProtections() {
    return []
  }
  protect() {
    return loose()
  }
  setRightToLeft() {}
  setFrozenRows() {}
  insertColumnsAfter() {}
}

export type Harness = ReturnType<typeof makeHarness>

export function makeHarness(opts: { clientId?: string | null; tokenInfo?: (idToken: string) => { code: number; body: unknown } } = {}) {
  const sheets = new Map<string, FakeSheet>()
  const ss = {
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => {
      const s = new FakeSheet(n)
      sheets.set(n, s)
      return s
    },
    getSheets: () => [...sheets.values()],
    deleteSheet: (s: FakeSheet) => sheets.delete(s.name),
    setActiveSheet: () => {},
    setSpreadsheetTimeZone: () => {},
  }
  const cache = new Map<string, string>()
  const props = new Map<string, string>()
  if (opts.clientId !== null) props.set('GOOGLE_CLIENT_ID', opts.clientId ?? 'client-123.apps.googleusercontent.com')
  const fetched: string[] = []
  const bytes = (b: Buffer) => [...b].map((x) => (x > 127 ? x - 256 : x))
  const toBuf = (v: string | number[]) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v.map((x) => x & 255)))

  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      newDataValidation: () => loose(),
      ProtectionType: { SHEET: 'SHEET' },
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => void cache.set(k, v),
        remove: (k: string) => void cache.delete(k),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => void props.set(k, v),
      }),
    },
    UrlFetchApp: {
      fetch: (url: string) => {
        fetched.push(url)
        const idToken = decodeURIComponent(url.split('id_token=')[1] ?? '')
        const r = opts.tokenInfo ? opts.tokenInfo(idToken) : { code: 400, body: {} }
        return { getResponseCode: () => r.code, getContentText: () => JSON.stringify(r.body) }
      },
    },
    Utilities: {
      base64EncodeWebSafe: (v: string | number[]) => toBuf(v).toString('base64url'),
      base64DecodeWebSafe: (s: string) => bytes(Buffer.from(s, 'base64url')),
      newBlob: (b: number[]) => ({ getDataAsString: () => toBuf(b).toString('utf8') }),
      computeHmacSha256Signature: (value: string, key: string) =>
        bytes(createHmac('sha256', key).update(value).digest()),
      formatDate: (d: Date) => d.toISOString().slice(0, 10),
      getUuid: () => randomUUID(),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this } }),
    },
    Logger: { log: () => {} },
  }
  const ctx = createContext(globals)
  runInContext(CODE, ctx, { filename: 'Code.gs' })
  const g = ctx as unknown as Record<string, (...a: unknown[]) => unknown>

  const unwrap = (out: unknown) => JSON.parse((out as { text: string }).text)
  return {
    sheets,
    cache,
    props,
    fetched,
    setup: () => g.setup(),
    post: (body: unknown) => unwrap(g.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })),
    get: (parameter: Record<string, string>) => unwrap(g.doGet({ parameter })),
    /** Read a top-level `var` from the script. */
    value: <T>(name: string) => runInContext(name, ctx) as T,
    sheet: (n: string) => sheets.get(n)!,
    addStaff: (email: string) => {
      const s = sheets.get('Staff')!
      s.getRange(s.getLastRow() + 1, 1, 1, 1).setValues([[email]])
    },
  }
}
