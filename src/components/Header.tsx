import { useState } from 'react'
import { C } from '../theme'

export function Header({
  showProgress,
  progressPct,
  stepNum,
  stepTitle,
}: {
  showProgress: boolean
  progressPct: string
  stepNum: number
  stepTitle: string
}) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
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
          maxWidth: 680,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
        }}
      >
        {logoFailed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: C.red,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Q
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: C.ink,
                letterSpacing: '0.01em',
              }}
            >
              Al Qema
            </span>
          </div>
        ) : (
          <img
            src="https://alqema.ly/assets/img/logo.png"
            alt="Al Qema"
            onError={() => setLogoFailed(true)}
            style={{ height: 32, display: 'block' }}
          />
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <button
            style={{
              border: 'none',
              background: C.red,
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              padding: '5px 14px',
              cursor: 'pointer',
              minHeight: 30,
            }}
          >
            EN
          </button>
          <button
            title="العربية — coming soon"
            style={{
              border: 'none',
              background: 'transparent',
              color: C.muted,
              fontWeight: 600,
              fontSize: 14,
              padding: '5px 14px',
              cursor: 'pointer',
              minHeight: 30,
            }}
          >
            ع
          </button>
        </div>
      </div>

      {showProgress && (
        <>
          <div style={{ height: 4, background: C.border, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                insetBlock: 0,
                insetInlineStart: 0,
                background: C.red,
                borderRadius: 999,
                transition: 'width 0.4s ease',
                width: progressPct,
              }}
            />
          </div>
          <div
            style={{
              maxWidth: 680,
              margin: '0 auto',
              padding: '6px 20px 8px',
              fontSize: 12,
              fontWeight: 600,
              color: C.muted,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Step {stepNum} of 6 · {stepTitle}
          </div>
        </>
      )}
    </header>
  )
}
