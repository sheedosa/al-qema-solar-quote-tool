import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { C } from '../theme'
import { Login } from './Login'
import { PricingEditor } from './PricingEditor'
import { Submissions } from './Submissions'
import { isDemoMode } from './demoClient'
import { supabase } from './supabaseClient'
import { useIsMobile } from './useIsMobile'

/**
 * Internal company panel at #/admin. English/LTR by design — it deliberately
 * does not use the customer i18n layer.
 */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'submissions' | 'pricing'>('submissions')
  const isMobile = useIsMobile()

  useEffect(() => {
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
    document.title = 'Al Qema — Admin'
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />

  const tabStyle = (active: boolean): React.CSSProperties => ({
    // 44px is the minimum comfortable touch target; the old 38px was below it.
    minHeight: 44,
    padding: isMobile ? '0 12px' : '0 18px',
    // Equal share of the row on mobile so the two tabs read as one control.
    flex: isMobile ? 1 : 'none',
    borderRadius: 10,
    // A transparent border rather than `none` when inactive: swapping between
    // `none` and `1px` shifted the button by 2px and reflowed its neighbours
    // on every tab change.
    border: `1px solid ${active ? C.red : C.border}`,
    background: active ? C.red : C.white,
    color: active ? C.white : C.body,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  })

  return (
    <div className="admin-root" style={{ minHeight: '100vh', background: C.canvas }}>
      {isDemoMode() && (
        // Unmissable, and above the sticky header so it cannot scroll away.
        // Someone shown this screen must never mistake the rows for real
        // customers, or think a price change they make here went live.
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            background: C.amberTint,
            color: C.amber,
            borderBottom: `1px solid ${C.amber}33`,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            padding: '8px 16px',
          }}
        >
          DEMO MODE — sample data only. These are not real customers, and
          nothing you change here is saved.
        </div>
      )}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: C.white,
          boxShadow: `0 1px 0 ${C.border}`,
        }}
      >
        {/*
          On a phone this is two rows: identity, then the tabs as a full-width
          segmented control. As one non-wrapping row it needed ~565px of
          min-content against a 390px screen, which made the whole DOCUMENT
          scroll sideways — and since the header is sticky rather than fixed,
          it slid away with it.
        */}
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 10 : 12,
            padding: isMobile ? '10px 14px' : '12px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 26,
                height: 26,
                flex: 'none',
                borderRadius: 6,
                background: C.red,
                color: C.white,
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Q
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: isMobile ? 15 : 17,
                color: C.ink,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Al Qema — Admin
            </div>
            {/*
              The signed-in email is a ~130px unbreakable string and was the
              main cause of the mobile overflow. It tells a salesperson nothing
              they need hourly, so on a phone it gives way to Sign out.
            */}
            {!isMobile && (
              <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 8 }}>
                {session.user.email}
              </span>
            )}
            <button
              className="admin-focusable"
              onClick={() => void supabase.auth.signOut()}
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: '0 14px',
                flex: 'none',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.body,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Admin sections"
            style={{ display: 'flex', gap: 8, flex: isMobile ? 'none' : 1, justifyContent: 'flex-end' }}
          >
            <button
              className="admin-focusable"
              role="tab"
              aria-selected={tab === 'submissions'}
              style={tabStyle(tab === 'submissions')}
              onClick={() => setTab('submissions')}
            >
              Submissions
            </button>
            <button
              className="admin-focusable"
              role="tab"
              aria-selected={tab === 'pricing'}
              style={tabStyle(tab === 'pricing')}
              onClick={() => setTab('pricing')}
            >
              Pricing
            </button>
          </div>
        </div>
      </header>
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: isMobile
            ? '16px 14px calc(32px + env(safe-area-inset-bottom))'
            : '24px 20px 80px',
        }}
      >
        {/*
          Both stay MOUNTED and are hidden with `display`, rather than swapped.
          Swapping unmounted PricingEditor, so switching to Submissions to
          check something silently discarded every unsaved price edit. Keeping
          them mounted also hides the pricing action bar and any open lead
          sheet when their panel is inactive, which is the behaviour we want.

          An inline `display` style, not the `hidden` attribute: `hidden` is a
          UA `display: block` rule and loses to any inline display.
        */}
        <div style={{ display: tab === 'submissions' ? 'block' : 'none' }}>
          <Submissions />
        </div>
        <div style={{ display: tab === 'pricing' ? 'block' : 'none' }}>
          <PricingEditor />
        </div>
      </main>
    </div>
  )
}
