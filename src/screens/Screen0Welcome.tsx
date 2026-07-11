import { C } from '../theme'

function Badge({ icon, children }: { icon: JSX.Element; children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: C.canvas,
        borderRadius: 999,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 500,
        color: C.body,
      }}
    >
      {icon}
      {children}
    </div>
  )
}

export function Screen0Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        animation: 'stepIn 0.35s ease',
        background: C.white,
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        padding: '40px 28px',
        marginTop: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: '0 auto 20px',
          borderRadius: 16,
          background: C.redTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.red}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      </div>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 26,
          fontWeight: 600,
          color: C.ink,
          lineHeight: 1.3,
          textWrap: 'pretty',
        }}
      >
        Get your solar system estimate
      </h1>
      <p
        style={{
          margin: '0 auto 28px',
          maxWidth: 440,
          fontSize: 16,
          fontWeight: 400,
          color: C.muted,
          lineHeight: 1.6,
          textWrap: 'pretty',
        }}
      >
        Answer a few quick questions about what you'd like to power. You'll get an instant
        estimate, and our team will follow up on WhatsApp with a tailored quote.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <Badge
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.red}
              strokeWidth={2}
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        >
          ~3–4 minutes
        </Badge>
        <Badge
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.red}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          }
        >
          No technical knowledge needed
        </Badge>
        <Badge
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.red}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          }
        >
          Free, no obligation
        </Badge>
      </div>
      <button
        onClick={onStart}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.redHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
        style={{
          width: '100%',
          maxWidth: 340,
          minHeight: 52,
          border: 'none',
          borderRadius: 12,
          background: C.red,
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        Start
      </button>
      <p style={{ margin: '24px 0 0', fontSize: 12.5, fontWeight: 400, color: C.faint }}>
        Trusted by 4,000+ customers · 350+ projects across Libya
      </p>
    </div>
  )
}
