import { Component, type ErrorInfo, type ReactNode } from 'react'
import { C } from '../theme'
import { WA_NUMBER } from '../config'

/**
 * Last line of defence for the customer.
 *
 * `runEngine` runs during render and the pricing config it reads is edited by
 * staff, so a bad publish could throw at the final step — after the customer
 * had spent four minutes filling the form — and leave them on a blank white
 * page with no way to reach anyone. Anything that throws now lands here, and
 * the WhatsApp number is the escape hatch.
 *
 * Deliberately not internationalised through the i18n context: this component
 * has to work when the tree below it (context providers included) is broken,
 * so it carries both languages inline.
 */
type Props = { children: ReactNode }
type State = { failed: boolean }

const wa = 'https://wa.me/' + WA_NUMBER.replace(/\D/g, '')

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is wired to a reporting service yet (Phase 6). Logging keeps the
    // failure visible in the console and in any future log drain.
    console.error('[alqema] render failure', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        dir="auto"
        style={{
          minHeight: '100vh',
          background: C.canvas,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            background: C.white,
            borderRadius: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            padding: 28,
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.ink }}>
            عذراً، حدث خطأ غير متوقع
          </h1>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: C.body, lineHeight: 1.6 }}>
            لم نتمكن من إكمال التقدير. تواصل معنا مباشرة على واتساب وسنساعدك فوراً.
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Something went wrong on our side. Message us on WhatsApp and we’ll help you straight
            away.
          </p>
          <a
            href={wa}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 52,
              borderRadius: 12,
              background: C.red,
              color: C.white,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            WhatsApp {WA_NUMBER}
          </a>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 10,
              width: '100%',
              minHeight: 48,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.body,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            إعادة المحاولة / Try again
          </button>
        </div>
      </div>
    )
  }
}
