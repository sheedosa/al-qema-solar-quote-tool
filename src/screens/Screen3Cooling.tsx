import { C, inputStyle } from '../theme'
import { Card, SegOption, Stepper, Toggle, CameraIcon } from '../components/ui'
import { fileUrl, type QuoteForm } from '../useQuoteForm'
import type { AcUnit, ColdUnit } from '../types'

const smallLabel: React.CSSProperties = { fontSize: 14, fontWeight: 500 }

function AcRow({
  u,
  index,
  form,
}: {
  u: AcUnit
  index: number
  form: QuoteForm
}) {
  const { setAc, removeAc } = form
  const capPlaceholder = u.capUnit === 'btu' ? 'e.g. 18000' : 'e.g. 1.5'

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              background: C.redTint,
              color: C.red,
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 999,
              padding: '3px 12px',
            }}
          >
            AC {index + 1}
          </div>
        </div>
        <button
          onClick={() => removeAc(index)}
          title="Remove this AC"
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'transparent',
            color: C.faint,
            fontSize: 20,
            cursor: 'pointer',
            borderRadius: 8,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={smallLabel}>Location</label>
        <input
          type="text"
          value={u.location}
          onChange={(e) => setAc(index, { location: e.target.value })}
          placeholder="e.g. Living room"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={smallLabel}>Type</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['Split', 'Window'] as const).map((t) => (
            <SegOption
              key={t}
              label={t}
              selected={u.type === t}
              onClick={() => setAc(index, { type: t })}
            />
          ))}
        </div>
      </div>

      {!u.dontKnow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={smallLabel}>Capacity</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="numeric"
              value={u.capValue}
              onChange={(e) => setAc(index, { capValue: e.target.value })}
              placeholder={capPlaceholder}
              style={{ ...inputStyle, flex: 1 }}
            />
            <div
              style={{
                display: 'flex',
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              {(['btu', 'ton'] as const).map((unit) => {
                const sel = u.capUnit === unit
                return (
                  <button
                    key={unit}
                    onClick={() => setAc(index, { capUnit: unit })}
                    style={{
                      border: 'none',
                      minHeight: 44,
                      padding: '8px 16px',
                      background: sel ? C.red : C.white,
                      color: sel ? C.white : C.muted,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {unit.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            onClick={() => setAc(index, { dontKnow: true, capValue: '' })}
            style={{
              alignSelf: 'flex-start',
              border: 'none',
              background: 'transparent',
              color: C.red,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline',
            }}
          >
            I don't know
          </button>
        </div>
      )}

      {u.dontKnow && (
        <div
          style={{
            background: C.canvas,
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.green,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.green}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            No problem — we'll figure it out for you.
          </div>
          <input
            type="text"
            value={u.model}
            onChange={(e) => setAc(index, { model: e.target.value })}
            placeholder="Model (if you can see it, e.g. LG Dual Inverter)"
            style={{ ...inputStyle, background: C.white }}
          />
          {!u.photo ? (
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                border: `1px dashed ${C.border}`,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                background: C.white,
              }}
            >
              <CameraIcon />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.body }}>
                Add photo of the sticker
              </span>
              <span
                style={{ fontSize: 12, fontWeight: 400, color: C.muted, textAlign: 'center' }}
              >
                Snap the label on the indoor or outdoor unit — we'll read it.
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => fileUrl(e, (url) => setAc(index, { photo: url }))}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 10,
                background: C.white,
              }}
            >
              <img
                src={u.photo}
                alt="AC sticker"
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.green }}>
                Photo added ✓
              </span>
              <button
                onClick={() => setAc(index, { photo: null })}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.faint,
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={smallLabel}>Inverter type AC?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { label: 'Yes', val: 'yes' },
            { label: 'No', val: 'no' },
            { label: 'Not sure', val: 'unsure' },
          ] as const).map((x) => (
            <SegOption
              key={x.val}
              label={x.label}
              selected={u.inverter === x.val}
              onClick={() => setAc(index, { inverter: x.val })}
              style={{ padding: '8px 10px' }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={smallLabel}>Hours per day</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>{u.hours} h</div>
        </div>
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={u.hours}
          onChange={(e) => setAc(index, { hours: parseInt(e.target.value, 10) || 0 })}
          style={{ width: '100%', height: 32 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={smallLabel}>Run at night?</div>
        <Toggle on={u.night} onClick={() => setAc(index, { night: !u.night })} />
      </div>
    </Card>
  )
}

function ColdRow({
  keyName,
  label,
  r,
  form,
}: {
  keyName: 'fridge' | 'freezer'
  label: string
  r: ColdUnit
  form: QuoteForm
}) {
  const { setCold } = form
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        <Toggle on={r.on} onClick={() => setCold(keyName, { on: !r.on })} />
      </div>

      {r.on && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={smallLabel}>How many?</div>
            <Stepper
              value={r.qty}
              onDec={() => setCold(keyName, { qty: Math.max(1, r.qty - 1) })}
              onInc={() => setCold(keyName, { qty: Math.min(10, r.qty + 1) })}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={smallLabel}>
              Capacity in liters{' '}
              <span style={{ color: C.muted, fontWeight: 400, fontSize: 12.5 }}>
                (optional — leave blank if unsure)
              </span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={r.capacityL}
              onChange={(e) => setCold(keyName, { capacityL: e.target.value })}
              placeholder="e.g. 400"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={smallLabel}>Condition</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['New', 'Old'] as const).map((c) => (
                <SegOption
                  key={c}
                  label={c}
                  selected={r.condition === (c.toLowerCase() as ColdUnit['condition'])}
                  onClick={() => setCold(keyName, { condition: c.toLowerCase() as ColdUnit['condition'] })}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={smallLabel}>Always running?</div>
            <Toggle on={r.alwaysOn} onClick={() => setCold(keyName, { alwaysOn: !r.alwaysOn })} />
          </div>
        </div>
      )}
    </div>
  )
}

export function Screen3Cooling({ form }: { form: QuoteForm }) {
  const { data: d, setAcCount } = form

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
        Cooling
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        Air conditioning &amp; refrigeration
      </h2>
      <p
        style={{
          margin: '0 0 24px',
          fontSize: 13,
          fontWeight: 400,
          color: C.muted,
          textWrap: 'pretty',
        }}
      >
        Air conditioners and fridges affect your system size the most — this is the important part.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500, flex: 1, minWidth: 180 }}>
            How many AC units do you want to run on solar?
          </div>
          <Stepper
            value={d.acUnits.length}
            valueWidth={52}
            valueSize={20}
            onDec={() => setAcCount(d.acUnits.length - 1)}
            onInc={() => setAcCount(d.acUnits.length + 1)}
          />
        </Card>

        {d.acUnits.map((u, i) => (
          <AcRow key={i} u={u} index={i} form={form} />
        ))}

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Fridges &amp; freezers</div>
          <ColdRow keyName="fridge" label="Fridge" r={d.fridge} form={form} />
          <ColdRow keyName="freezer" label="Freezer" r={d.freezer} form={form} />
        </Card>
      </div>
    </div>
  )
}
