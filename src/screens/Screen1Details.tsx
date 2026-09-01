import { C, inputStyle } from '../theme'
import { Card, Kicker } from '../components/ui'
import { PROPERTY_ICON_KEY, PropertyIcon } from '../components/PropertyIcon'
import { PROPERTY_VALS, useStrings } from '../i18n'
import { normalizeLibyanPhone } from '../logic'
import { FIELD_LIMITS } from '../pricing/persist'
import type { QuoteForm } from '../useQuoteForm'

const labelStyle: React.CSSProperties = { fontSize: 15, fontWeight: 500 }

export function Screen1Details({ form }: { form: QuoteForm }) {
  const { data: d, setD } = form
  const s = useStrings()
  const req = <span style={{ color: C.red }}>*</span>

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.details.kicker}</Kicker>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.details.title}
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 400, color: C.muted }}>
        {s.details.subtitle}
      </p>

      <Card style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-name" style={labelStyle}>
            {s.details.fullName} {req}
          </label>
          <input
            id="f-name"
            type="text"
            value={d.name}
            onChange={(e) => setD({ name: e.target.value })}
            placeholder={s.details.yourName}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-wa" style={labelStyle}>
            {s.details.whatsapp} {req}
          </label>
          {/* Phone stays LTR regardless of page direction. */}
          <div style={{ display: 'flex', gap: 8 }} dir="ltr">
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
              // Normalise as they type: a pasted +218 or a leading 0 becomes
              // the plain national number rather than reaching the sales team
              // as an uncallable string.
              onChange={(e) => setD({ whatsapp: normalizeLibyanPhone(e.target.value) })}
              placeholder={s.details.waPlaceholder}
              autoComplete="tel-national"
              maxLength={FIELD_LIMITS.whatsapp}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>{s.details.waHelp}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>
            {s.details.propertyType} {req}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
              gap: 8,
            }}
          >
            {PROPERTY_VALS.map((val) => {
              const sel = d.propertyType === val
              return (
                <button
                  key={val}
                  onClick={() => setD({ propertyType: val })}
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
                    <PropertyIcon name={PROPERTY_ICON_KEY[val]} color={sel ? C.red : C.muted} />
                  </span>
                  {s.opt.property[val]}
                </button>
              )
            })}
          </div>
          {d.propertyType === 'Other' && (
            <input
              type="text"
              value={d.propertyOther}
              onChange={(e) => setD({ propertyOther: e.target.value })}
              placeholder={s.details.otherPlaceholder}
              style={inputStyle}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="f-city" style={labelStyle}>
            {s.details.city} {req}
          </label>
          <input
            id="f-city"
            type="text"
            value={d.city}
            onChange={(e) => setD({ city: e.target.value })}
            placeholder={s.details.cityPlaceholder}
            style={inputStyle}
          />
        </div>
      </Card>
    </div>
  )
}
