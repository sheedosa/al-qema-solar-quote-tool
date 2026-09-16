import { useState } from 'react'
import { C, cardStyle, inputStyle } from '../theme'
import { LangToggle } from './controls'
import { useAdminLang } from './i18n'
import { supabase } from './supabaseClient'

/** Email + password sign-in for company staff. No self-signup path exists. */
export function Login() {
  const { t } = useAdminLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setBusy(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.canvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form onSubmit={submit} style={{ ...cardStyle, width: '100%', maxWidth: 380, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 30,
              height: 30,
              flex: 'none',
              borderRadius: 6,
              background: C.red,
              color: C.white,
              fontWeight: 700,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Q
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: C.ink, flex: 1, minWidth: 0 }}>
            {t.app.title}
          </div>
          <LangToggle />
        </div>
        <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          {t.login.email}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          // An address is Latin whatever the page direction.
          dir="ltr"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          {t.login.password}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          dir="ltr"
          style={{ ...inputStyle, marginBottom: 18 }}
        />
        {error && (
          // Server text, in whatever language the server speaks — its own
          // paragraph so it aligns as itself rather than as Arabic prose.
          <div
            dir="auto"
            style={{
              color: C.red,
              fontSize: 13.5,
              fontWeight: 500,
              marginBottom: 12,
              textAlign: 'start',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            minHeight: 48,
            border: 'none',
            borderRadius: 12,
            background: C.red,
            color: C.white,
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {t.login.signIn}
        </button>
      </form>
    </div>
  )
}
