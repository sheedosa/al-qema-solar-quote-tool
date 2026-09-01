import { PRICING_CONFIG } from '../pricing/config'
import { DEMO_CONFIG_HISTORY, DEMO_LEADS, DEMO_USER } from './demoData'

/**
 * A stand-in for the Supabase client, used only in demo mode.
 *
 * Why a client double rather than a "skip the login" flag: skipping auth alone
 * would leave the panel pointed at the real database, so a demo would put real
 * customers' names and phone numbers on screen. This serves invented data and
 * accepts writes without sending them anywhere, so there is nothing real to
 * leak and nothing real to break.
 *
 * It implements exactly the call shapes `Submissions.tsx` and
 * `PricingEditor.tsx` already use, so no component code changes for demo mode.
 */

/** Demo mode is opt-in via the URL: #/admin?demo (or #/admin/demo). */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return hash.startsWith('#/admin') && /(\?|&|\/)demo\b/.test(hash)
}

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string } | null }

/**
 * Chainable query stub. Every method returns `this`, and the object is
 * thenable, so both `await q` and `q.then(...)` resolve to {data, error}.
 */
class Query implements PromiseLike<Result> {
  private rows: Row[]
  private wantOne = false

  constructor(rows: Row[]) {
    this.rows = rows
  }

  select(cols?: string) {
    // The detail panel asks for `form, result`; the list asks for scalars. The
    // demo rows carry both, so only the single-row flag matters here.
    void cols
    return this
  }
  order() {
    return this
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n)
    return this
  }
  eq(col: string, val: unknown) {
    this.rows = this.rows.filter((r) => r[col] === val)
    return this
  }
  maybeSingle() {
    this.wantOne = true
    return this
  }
  single() {
    this.wantOne = true
    return this
  }

  private settle(): Result {
    if (this.wantOne) {
      const row = this.rows[0]
      return row
        ? { data: row, error: null }
        : { data: null, error: { message: 'No rows found (demo)' } }
    }
    return { data: this.rows, error: null }
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.settle()).then(onfulfilled, onrejected)
  }
}

/** Config rows carry the whole config so the editor can load it. */
const configRows = () =>
  DEMO_CONFIG_HISTORY.map((r) => ({ ...r, config: PRICING_CONFIG }))

type AuthCallback = (event: string, session: unknown) => void

const demoSession = {
  access_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'demo',
  user: DEMO_USER,
}

export const demoClient = {
  auth: {
    // Already "signed in", so the login screen is skipped entirely.
    getSession: async () => ({ data: { session: demoSession }, error: null }),
    getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
    signInWithPassword: async () => ({ data: { session: demoSession }, error: null }),
    onAuthStateChange: (cb: AuthCallback) => {
      // Fire once so any listener settles, then hand back an inert unsubscribe.
      setTimeout(() => cb('SIGNED_IN', demoSession), 0)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    signOut: async () => {
      // Leaving demo mode means dropping the flag from the URL.
      window.location.hash = '#/admin'
      window.location.reload()
      return { error: null }
    },
  },

  from(table: string) {
    const rows: Row[] = table === 'leads' ? [...DEMO_LEADS] : configRows()
    const q = new Query(rows)
    return Object.assign(q, {
      // Writes are accepted and discarded — publishing in a demo must not
      // pretend to fail, but must not persist either.
      insert: (_row: unknown) => {
        void _row
        return new Query([{ id: 'demo-cfg-new' }])
      },
      update: (_row: unknown) => {
        void _row
        return new Query([])
      },
      delete: () => new Query([]),
    })
  },

  rpc: async (_fn: string, _args?: unknown) => {
    void _fn
    void _args
    return { data: null, error: null }
  },
}
