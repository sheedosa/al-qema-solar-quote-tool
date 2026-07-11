import { C } from '../theme'
import { useStrings } from '../i18n'

export function FooterNav({
  backVisible,
  onBack,
  onContinue,
  disabled,
  label,
}: {
  backVisible: boolean
  onBack: () => void
  onContinue: () => void
  disabled: boolean
  label: string
}) {
  const s = useStrings()
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 50,
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        {backVisible ? (
          <button
            onClick={onBack}
            style={{
              minHeight: 48,
              padding: '0 24px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.body,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {s.nav.back}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onContinue}
          disabled={disabled}
          style={{
            flex: 1,
            maxWidth: 320,
            minHeight: 48,
            padding: '0 24px',
            borderRadius: 12,
            border: 'none',
            background: C.red,
            color: C.white,
            fontSize: 16,
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            transition: 'background 0.15s, opacity 0.2s',
          }}
        >
          {label}
        </button>
      </div>
    </div>
  )
}
