import { useState } from 'react'
import { C } from '../theme'
import { useLang } from '../i18n'

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
  const { s, lang, setLang } = useLang()

  const langBtn = (active: boolean): React.CSSProperties => ({
    border: 'none',
    background: active ? C.red : 'transparent',
    color: active ? '#fff' : C.muted,
    fontWeight: 600,
    fontSize: 13,
    padding: '5px 14px',
    cursor: 'pointer',
    minHeight: 30,
  })

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
              {s.header.brand}
            </span>
          </div>
        ) : (
          <img
            src="https://alqema.ly/assets/img/logo.png"
            alt={s.header.brand}
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
            title={s.header.enTitle}
            onClick={() => setLang('en')}
            style={langBtn(lang === 'en')}
          >
            EN
          </button>
          <button
            title={s.header.arTitle}
            onClick={() => setLang('ar')}
            style={{ ...langBtn(lang === 'ar'), fontSize: 14 }}
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
            {s.header.stepWord} {stepNum} {s.header.ofWord} 6 · {stepTitle}
          </div>
        </>
      )}
    </header>
  )
}
