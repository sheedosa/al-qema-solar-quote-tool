import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { C } from '../theme'
import { Login } from './Login'
import { PricingEditor } from './PricingEditor'
import { Submissions } from './Submissions'
import { supabase } from './supabaseClient'

/**
 * Internal company panel at #/admin. English/LTR by design — it deliberately
 * does not use the customer i18n layer.
 */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'submissions' | 'pricing'>('submissions')

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
    minHeight: 38,
    padding: '0 18px',
    borderRadius: 10,
    border: active ? 'none' : `1px solid ${C.border}`,
    background: active ? C.red : C.white,
    color: active ? C.white : C.body,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.canvas }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: C.white,
          boxShadow: `0 1px 0 ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
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
          <div style={{ fontWeight: 700, fontSize: 17, color: C.ink, flex: 1 }}>
            Al Qema — Admin
          </div>
          <button style={tabStyle(tab === 'submissions')} onClick={() => setTab('submissions')}>
            Submissions
          </button>
          <button style={tabStyle(tab === 'pricing')} onClick={() => setTab('pricing')}>
            Pricing
          </button>
          <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 8 }}>
            {session.user.email}
          </span>
          <button
            onClick={() => void supabase.auth.signOut()}
            style={{
              minHeight: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.body,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {tab === 'submissions' ? <Submissions /> : <PricingEditor />}
      </main>
    </div>
  )
}
