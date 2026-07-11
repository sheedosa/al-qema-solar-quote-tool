import { C } from '../theme'
import { Card, CheckOption, Stepper, CameraIcon } from '../components/ui'
import { fileUrl, type QuoteForm } from '../useQuoteForm'
import type { PhotoKey } from '../types'

const SYSTEM = [
  { label: 'Hybrid', val: 'hybrid' },
  { label: 'Off-grid', val: 'offgrid' },
  { label: 'On-grid (if available)', val: 'ongrid' },
  { label: 'Not sure — recommend for me', val: 'recommend' },
]
const PRIORITY = [
  { label: 'Essentials only', val: 'essentials' },
  { label: 'Essentials + AC', val: 'essentials_ac' },
  { label: 'Full power as much as possible', val: 'full' },
]
const ROOF = ['Small', 'Medium', 'Large', 'Not sure']
const SHADE = ['Yes', 'No']

const PHOTO_DEFS: { key: PhotoKey; label: string }[] = [
  { key: 'panel', label: 'Main electrical panel' },
  { key: 'meter', label: 'Meter / supply point' },
  { key: 'roof', label: 'Roof / panel area' },
  { key: 'stickers', label: 'AC / pump stickers' },
]

const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 500 }

export function Screen5Preferences({ form }: { form: QuoteForm }) {
  const { data: d, setD, setPhoto } = form

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted,
          marginBottom: 6,
        }}
      >
        Your preferences
      </div>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        System preferences
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>System type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SYSTEM.map((o) => (
              <CheckOption
                key={o.val}
                label={o.label}
                selected={d.systemType === o.val}
                onClick={() => setD({ systemType: o.val })}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>Priority during a power cut</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRIORITY.map((o) => (
              <CheckOption
                key={o.val}
                label={o.label}
                selected={d.priority === o.val}
                onClick={() => setD({ priority: o.val })}
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
              <div style={{ fontSize: 14, fontWeight: 500 }}>How many ACs during a cut?</div>
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
          <div style={sectionTitle}>Roof space for panels</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ROOF.map((label) => (
              <CheckOption
                key={label}
                label={label}
                selected={d.roofSpace === label}
                onClick={() => setD({ roofSpace: label })}
                style={{ flex: '1 1 140px', width: 'auto' }}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>Any shade on the roof (buildings/trees)?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SHADE.map((label) => (
              <CheckOption
                key={label}
                label={label}
                selected={d.roofShade === label}
                onClick={() => setD({ roofShade: label })}
                style={{ flex: 1, width: 'auto' }}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sectionTitle}>
            Photos{' '}
            <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>
              (optional, speeds up your quote)
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
              gap: 10,
            }}
          >
            {PHOTO_DEFS.map((t) => {
              const v = d.photos[t.key]
              return (
                <div key={t.key}>
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
                        {t.label}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => fileUrl(e, (url) => setPhoto(t.key, url))}
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
                        alt={t.label}
                        style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        onClick={() => setPhoto(t.key, null)}
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
            Optional, but photos help us quote faster and more accurately.
          </div>
        </Card>
      </div>
    </div>
  )
}
