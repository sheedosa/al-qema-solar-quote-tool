import { C, inputStyle } from '../theme'
import { Card, SegOption, Stepper, Toggle, CameraIcon, Kicker } from '../components/ui'
import { INVERTER_VALS, useStrings, type Strings } from '../i18n'
import { fileUrl, type QuoteForm } from '../useQuoteForm'
import type { AcUnit, ColdUnit } from '../types'

const smallLabel: React.CSSProperties = { fontSize: 14, fontWeight: 500 }

function AcRow({
  u,
  index,
  form,
  s,
}: {
  u: AcUnit
  index: number
  form: QuoteForm
  s: Strings
}) {
  const { setAc, removeAc } = form
  const capPlaceholder = u.capUnit === 'btu' ? s.cooling.capBtuPlaceholder : s.cooling.capTonPlaceholder

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
            {s.cooling.acLabel} {index + 1}
          </div>
        </div>
        <button
          onClick={() => removeAc(index)}
          title={s.cooling.removeAc}
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
        <label style={smallLabel}>{s.cooling.location}</label>
        <input
          type="text"
          value={u.location}
          onChange={(e) => setAc(index, { location: e.target.value })}
          placeholder={s.cooling.locationPlaceholder}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={smallLabel}>{s.cooling.type}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['Split', 'Window'] as const).map((t) => (
            <SegOption
              key={t}
              label={s.opt.acType[t]}
              selected={u.type === t}
              onClick={() => setAc(index, { type: t })}
            />
          ))}
        </div>
      </div>

      {!u.dontKnow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={smallLabel}>{s.cooling.capacity}</div>
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
            {s.cooling.dontKnow}
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
            {s.cooling.noProblem}
          </div>
          <input
            type="text"
            value={u.model}
            onChange={(e) => setAc(index, { model: e.target.value })}
            placeholder={s.cooling.modelPlaceholder}
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
                {s.cooling.addPhoto}
              </span>
              <span
                style={{ fontSize: 12, fontWeight: 400, color: C.muted, textAlign: 'center' }}
              >
                {s.cooling.addPhotoHint}
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
                alt=""
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.green }}>
                {s.cooling.photoAdded}
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
        <div style={smallLabel}>{s.cooling.inverterQ}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {INVERTER_VALS.map((val) => (
            <SegOption
              key={val}
              label={s.opt.inverter[val]}
              selected={u.inverter === val}
              onClick={() => setAc(index, { inverter: val as AcUnit['inverter'] })}
              style={{ padding: '8px 10px' }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={smallLabel}>{s.cooling.hoursPerDay}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>
            {u.hours} {s.units.h}
          </div>
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
        <div style={smallLabel}>{s.cooling.runNight}</div>
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
  s,
}: {
  keyName: 'fridge' | 'freezer'
  label: string
  r: ColdUnit
  form: QuoteForm
  s: Strings
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
            <div style={smallLabel}>{s.cooling.howMany}</div>
            <Stepper
              value={r.qty}
              onDec={() => setCold(keyName, { qty: Math.max(1, r.qty - 1) })}
              onInc={() => setCold(keyName, { qty: Math.min(10, r.qty + 1) })}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={smallLabel}>
              {s.cooling.capacityL}{' '}
              <span style={{ color: C.muted, fontWeight: 400, fontSize: 12.5 }}>
                {s.cooling.capacityLOptional}
              </span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={r.capacityL}
              onChange={(e) => setCold(keyName, { capacityL: e.target.value })}
              placeholder={s.cooling.capacityLPlaceholder}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={smallLabel}>{s.cooling.condition}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['new', 'old'] as const).map((c) => (
                <SegOption
                  key={c}
                  label={s.opt.condition[c]}
                  selected={r.condition === c}
                  onClick={() => setCold(keyName, { condition: c })}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={smallLabel}>{s.cooling.alwaysRunning}</div>
            <Toggle on={r.alwaysOn} onClick={() => setCold(keyName, { alwaysOn: !r.alwaysOn })} />
          </div>
        </div>
      )}
    </div>
  )
}

export function Screen3Cooling({ form }: { form: QuoteForm }) {
  const { data: d, setAcCount } = form
  const s = useStrings()

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.cooling.kicker}</Kicker>
      <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.cooling.title}
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
        {s.cooling.intro}
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
            {s.cooling.acCount}
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
          <AcRow key={i} u={u} index={i} form={form} s={s} />
        ))}

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{s.cooling.fridgesTitle}</div>
          <ColdRow keyName="fridge" label={s.cooling.fridge} r={d.fridge} form={form} s={s} />
          <ColdRow keyName="freezer" label={s.cooling.freezer} r={d.freezer} form={form} s={s} />
        </Card>
      </div>
    </div>
  )
}
