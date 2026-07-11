import { C } from '../theme'
import { Card, CheckOption, Stepper, CameraIcon, Kicker } from '../components/ui'
import { PRIORITY_VALS, ROOF_VALS, SHADE_VALS, SYSTEM_VALS, useStrings } from '../i18n'
import { fileUrl, type QuoteForm } from '../useQuoteForm'
import type { PhotoKey } from '../types'

const PHOTO_KEYS: PhotoKey[] = ['panel', 'meter', 'roof', 'stickers']
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 500 }

export function Screen5Preferences({ form }: { form: QuoteForm }) {
  const { data: d, setD, setPhoto } = form
  const s = useStrings()

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.preferences.kicker}</Kicker>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.preferences.title}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>{s.preferences.systemType}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SYSTEM_VALS.map((val) => (
              <CheckOption
                key={val}
                label={s.opt.system[val]}
                selected={d.systemType === val}
                onClick={() => setD({ systemType: val })}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>{s.preferences.priority}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRIORITY_VALS.map((val) => (
              <CheckOption
                key={val}
                label={s.opt.priority[val]}
                selected={d.priority === val}
                onClick={() => setD({ priority: val })}
              />
            ))}
          </div>
          {d.priority === 'essentials_ac' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: C.canvas,
                borderRadius: 12,
                padding: '12px 14px',
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500 }}>{s.preferences.priorityAcCount}</div>
              <Stepper
                value={d.priorityAcCount}
                valueWidth={40}
                valueSize={17}
                onDec={() => setD({ priorityAcCount: Math.max(1, d.priorityAcCount - 1) })}
                onInc={() => setD({ priorityAcCount: Math.min(10, d.priorityAcCount + 1) })}
              />
            </div>
          )}
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>{s.preferences.roofSpace}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ROOF_VALS.map((val) => (
              <CheckOption
                key={val}
                label={s.opt.roof[val]}
                selected={d.roofSpace === val}
                onClick={() => setD({ roofSpace: val })}
                style={{ flex: '1 1 140px', width: 'auto' }}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>{s.preferences.shadeQ}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SHADE_VALS.map((val) => (
              <CheckOption
                key={val}
                label={s.opt.shade[val]}
                selected={d.roofShade === val}
                onClick={() => setD({ roofShade: val })}
                style={{ flex: 1, width: 'auto' }}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>
            {s.preferences.photos}{' '}
            <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>
              {s.preferences.photosOptional}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
              gap: 10,
            }}
          >
            {PHOTO_KEYS.map((key) => {
              const v = d.photos[key]
              const label = s.preferences.photoLabels[key]
              return (
                <div key={key}>
                  {!v ? (
                    <label
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.red)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        border: `1px dashed ${C.border}`,
                        borderRadius: 12,
                        padding: '18px 10px',
                        cursor: 'pointer',
                        minHeight: 110,
                        textAlign: 'center',
                      }}
                    >
                      <CameraIcon />
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: C.body, lineHeight: 1.35 }}
                      >
                        {label}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => fileUrl(e, (url) => setPhoto(key, url))}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div
                      style={{
                        position: 'relative',
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        minHeight: 110,
                      }}
                    >
                      <img
                        src={v}
                        alt={label}
                        style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        onClick={() => setPhoto(key, null)}
                        style={{
                          position: 'absolute',
                          top: 6,
                          insetInlineEnd: 6,
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'rgba(45,45,45,0.75)',
                          color: '#fff',
                          fontSize: 15,
                          cursor: 'pointer',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
            {s.preferences.photosHint}
          </div>
        </Card>
      </div>
    </div>
  )
}
