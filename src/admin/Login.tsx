import { useState } from 'react'
import { C, cardStyle, inputStyle } from '../theme'
import { supabase } from './supabaseClient'

/** Email + password sign-in for company staff. No self-signup path exists. */
export function Login() {
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
          <div style={{ fontWeight: 700, fontSize: 18, color: C.ink }}>Al Qema — Admin</div>
        </div>
        <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ ...inputStyle, marginBottom: 18 }}
        />
        {error && (
          <div style={{ color: C.red, fontSize: 13.5, fontWeight: 500, marginBottom: 12 }}>
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
          Sign in
        </button>
      </form>
    </div>
  )
}
