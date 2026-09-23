import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'
import { C, cardStyle } from '../theme'
import { backend } from './backend'
import { LangToggle } from './controls'
import { useAdminLang } from './i18n'

/**
 * Staff sign in with Google. Google proves who they are; the backend then
 * checks the email against the sheet's Staff tab, so there is no password to
 * manage and no self-signup path. Google's own 2-step verification applies.
 */

type Gsi = {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean }): void
      renderButton(el: HTMLElement, o: Record<string, unknown>): void
      disableAutoSelect(): void
    }
  }
}
declare global {
  interface Window {
    google?: Gsi
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise: Promise<Gsi> | null = null

/** Load Google Identity Services once; it lives in the admin chunk only. */
function loadGsi(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!gsiPromise) {
    gsiPromise = new Promise<Gsi>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = GSI_SRC
      el.async = true
      el.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('gsi')))
      el.onerror = () => reject(new Error('gsi'))
      document.head.appendChild(el)
    }).catch((e) => {
      gsiPromise = null
      throw e
    })
  }
  return gsiPromise
}

export function Login({ expired = false }: { expired?: boolean }) {
  const { t, lang } = useAdminLang()
  const L = t.login
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(expired ? L.expired : '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!backend.configured) {
      setError(L.notConfigured)
      return
    }
    let alive = true
    loadGsi()
      .then((g) => {
        if (!alive || !buttonRef.current) return
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          callback: async (r) => {
            if (!r.credential) {
              setError(L.failed)
              return
            }
            setBusy(true)
            setError('')
            const res = await backend.signIn(r.credential)
            setBusy(false)
            if (res.ok) return
            setError(
              res.code === 'not_staff'
                ? L.notStaff
                : res.code === 'not_configured'
                  ? L.notConfigured
                  : res.code === 'network' || res.code === 'bad_response'
                    ? L.unreachable
                    : L.failed,
            )
          },
        })
        buttonRef.current.innerHTML = ''
        // Google draws the button in the admin's language.
        g.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 300,
          locale: lang,
        })
      })
      .catch(() => alive && setError(L.googleUnavailable))
    return () => {
      alive = false
    }
    // Re-render the button when the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

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
      <div style={{ ...cardStyle, width: '100%', maxWidth: 380, padding: 28 }}>
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
          <div style={{ fontWeight: 700, fontSize: 18, color: C.ink, flex: 1, minWidth: 0 }}>{t.app.title}</div>
          <LangToggle />
        </div>
        <p style={{ fontSize: 14, color: C.body, lineHeight: 1.5, margin: '0 0 16px', textAlign: 'start' }}>{L.prompt}</p>
        {/* Google renders its button here; min height keeps the card steady while it loads. */}
        <div
          ref={buttonRef}
          data-testid="google-button"
          style={{ minHeight: 44, display: 'flex', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
        />
        {busy && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 12, textAlign: 'center' }}>{L.signingIn}</div>}
        {error && (
          <div role="alert" style={{ color: C.red, fontSize: 13.5, fontWeight: 500, marginTop: 14, lineHeight: 1.5, textAlign: 'start' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
