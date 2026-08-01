import { C, inputStyle } from '../theme'
import { Card, SegOption, Stepper, Kicker } from '../components/ui'
import { PRESET_NAMES } from '../logic'
import { BULB_VALS, useStrings, type Strings } from '../i18n'
import type { QuoteForm } from '../useQuoteForm'
import type { Appliance } from '../types'

const smallLabel: React.CSSProperties = { fontSize: 14, fontWeight: 500 }
const tinyLabel: React.CSSProperties = { fontSize: 13.5, fontWeight: 500 }

function ApplianceRow({ a, form, s }: { a: Appliance; form: QuoteForm; s: Strings }) {
  const { setApp, removeApp } = form
  const displayName = a.custom ? a.name : s.opt.preset[a.name] || a.name

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {a.custom ? (
          <input
            type="text"
            value={a.name}
            onChange={(e) => setApp(a.id, { name: e.target.value })}
            placeholder={s.appliances.deviceName}
            style={{
              flex: 1,
              minHeight: 44,
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              color: C.ink,
              width: '100%',
            }}
          />
        ) : (
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{displayName}</div>
        )}
        <button
          onClick={() => removeApp(a.id)}
          title={s.appliances.remove}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'transparent',
            color: C.faint,
            fontSize: 20,
            cursor: 'pointer',
            borderRadius: 8,
            flex: 'none',
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={tinyLabel}>{s.appliances.quantity}</div>
        <Stepper
          value={a.qty}
          valueWidth={40}
          valueSize={17}
          onDec={() => setApp(a.id, { qty: Math.max(1, a.qty - 1) })}
          onInc={() => setApp(a.id, { qty: Math.min(20, a.qty + 1) })}
        />
      </div>
    </div>
  )
}

function ApplianceChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.red
        e.currentTarget.style.color = C.red
        e.currentTarget.style.background = C.redTint
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border
        e.currentTarget.style.color = C.body
        e.currentTarget.style.background = C.white
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${C.border}`,
        background: C.white,
        color: C.body,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <span style={{ color: C.red, fontWeight: 700 }}>+</span>
      {label}
    </button>
  )
}

export function Screen4Appliances({ form }: { form: QuoteForm }) {
  const { data: d, setLight, addAppliance } = form
  const s = useStrings()
  const lt = d.lighting

  const addedNames = d.appliances.map((a) => a.name)
  const chips = PRESET_NAMES.filter((name) => addedNames.indexOf(name) === -1)

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.appliances.kicker}</Kicker>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.appliances.title}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Lighting */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{s.appliances.lighting}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={smallLabel}>{s.appliances.bulbType}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {BULB_VALS.map((val) => (
                <SegOption
                  key={val}
                  label={s.opt.bulb[val]}
                  selected={lt.type === val}
                  onClick={() => setLight({ type: val as typeof lt.type })}
                  style={{ padding: '8px 12px' }}
                />
              ))}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={smallLabel}>{s.appliances.numberBulbs}</div>
            <Stepper
              value={lt.count}
              onDec={() => setLight({ count: Math.max(0, lt.count - 1) })}
              onInc={() => setLight({ count: Math.min(200, lt.count + 1) })}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={smallLabel}>
              {s.appliances.wattsPerBulb}{' '}
              <span style={{ color: C.muted, fontWeight: 400, fontSize: 12.5 }}>
                {s.appliances.optional}
              </span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={lt.watts}
              onChange={(e) => setLight({ watts: e.target.value })}
              placeholder={s.appliances.notSure}
              style={inputStyle}
            />
            <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
              {s.appliances.bulbHint}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={smallLabel}>{s.appliances.hoursNight}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>
                {lt.nightHours} {s.units.h}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={lt.nightHours}
              onChange={(e) => setLight({ nightHours: parseInt(e.target.value, 10) || 0 })}
              style={{ width: '100%', height: 32 }}
            />
          </div>
        </Card>

        {/* Appliance builder */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
              {s.appliances.appliancesTitle}
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>
              {s.appliances.appliancesHint}
            </div>
          </div>

          {d.appliances.map((a) => (
            <ApplianceRow key={a.id} a={a} form={form} s={s} />
          ))}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((name) => (
              <ApplianceChip
                key={name}
                label={s.opt.preset[name] || name}
                onClick={() => addAppliance(name)}
              />
            ))}
            <ApplianceChip label={s.appliances.addOther} onClick={() => addAppliance(null)} />
          </div>
        </Card>
      </div>
    </div>
  )
}
