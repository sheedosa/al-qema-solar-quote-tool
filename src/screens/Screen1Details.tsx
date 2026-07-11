import { C, inputStyle } from '../theme'
import { Card, Kicker } from '../components/ui'
import { PROPERTY_ICON_KEY, PropertyIcon } from '../components/PropertyIcon'
import type { QuoteForm } from '../useQuoteForm'

const PROPERTY_OPTS = Object.keys(PROPERTY_ICON_KEY)

const labelStyle: React.CSSProperties = { fontSize: 15, fontWeight: 500 }
const req = <span style={{ color: C.red }}>*</span>

export function Screen1Details({ form }: { form: QuoteForm }) {
  const { data: d, setD } = form

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>About you</Kicker>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        Let's start with your details
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 400, color: C.muted }}>
        Takes about 3–4 minutes. You don't need to know technical details — we'll help.
      </p>

      <Card style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-name" style={labelStyle}>
            Full name {req}
          </label>
          <input
            id="f-name"
            type="text"
            value={d.name}
            onChange={(e) => setD({ name: e.target.value })}
            placeholder="Your name"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-wa" style={labelStyle}>
            WhatsApp number {req}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: C.canvas,
                fontSize: 16,
                fontWeight: 600,
                color: C.muted,
              }}
            >
              +218
            </div>
            <input
              id="f-wa"
              type="tel"
              inputMode="tel"
              value={d.whatsapp}
              onChange={(e) => setD({ whatsapp: e.target.value })}
              placeholder="91 123 4567"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
            We'll send your detailed quote here.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>Property type {req}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
              gap: 8,
            }}
          >
            {PROPERTY_OPTS.map((label) => {
              const sel = d.propertyType === label
              return (
                <button
                  key={label}
                  onClick={() => setD({ propertyType: label })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '14px 8px',
                    borderRadius: 12,
                    border: `1.5px solid ${sel ? C.red : C.border}`,
                    background: sel ? C.redTint : C.white,
                    color: sel ? C.red : C.body,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <span style={{ display: 'flex' }}>
                    <PropertyIcon
                      name={PROPERTY_ICON_KEY[label]}
                      color={sel ? C.red : C.muted}
                    />
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
          {d.propertyType === 'Other' && (
            <input
              type="text"
              value={d.propertyOther}
              onChange={(e) => setD({ propertyOther: e.target.value })}
              placeholder="Tell us what kind of place it is"
              style={inputStyle}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-city" style={labelStyle}>
            City / area {req}
          </label>
          <input
            id="f-city"
            type="text"
            value={d.city}
            onChange={(e) => setD({ city: e.target.value })}
            placeholder="e.g. Tripoli, Hay Al-Andalus"
            style={inputStyle}
          />
        </div>
      </Card>
    </div>
  )
}
