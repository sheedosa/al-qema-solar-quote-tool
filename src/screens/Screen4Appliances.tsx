import { C, inputStyle } from '../theme'
import { Card, SegOption, Stepper, Toggle, Kicker } from '../components/ui'
import { PRESETS } from '../logic'
import { BULB_VALS, HEAVY_DUTY_VALS, useStrings, type Strings } from '../i18n'
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

      {a.pump && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={tinyLabel}>{s.appliances.pumpSize}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['0.5', '1', '1.5', '2'].map((hp) => (
              <SegOption
                key={hp}
                label={hp + s.appliances.hpSuffix}
                selected={a.hp === hp}
                onClick={() => setApp(a.id, { hp })}
                style={{ padding: '6px 8px', fontSize: 13.5 }}
              />
            ))}
          </div>
        </div>
      )}

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={tinyLabel}>{s.appliances.hoursPerDay}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>
            {a.hours} {s.units.h}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={a.hours}
          onChange={(e) => setApp(a.id, { hours: parseInt(e.target.value, 10) || 0 })}
          style={{ width: '100%', height: 32 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={tinyLabel}>{s.appliances.runNight}</div>
        <Toggle on={a.night} onClick={() => setApp(a.id, { night: !a.night })} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={tinyLabel}>
          {s.appliances.watts}{' '}
          <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>
            {s.appliances.optional}
          </span>
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={a.watts}
          onChange={(e) => setApp(a.id, { watts: e.target.value })}
          placeholder={s.appliances.wattsPlaceholder}
          style={{
            minHeight: 44,
            padding: '8px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 500,
            color: C.body,
            width: '100%',
          }}
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
  const { data: d, setLight, addAppliance, setD } = form
  const s = useStrings()
  const lt = d.lighting

  const addedNames = d.appliances.map((a) => a.name)
  const chips = PRESETS.filter((p) => addedNames.indexOf(p.name) === -1)

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
            {chips.map((p) => (
              <ApplianceChip
                key={p.name}
                label={s.opt.preset[p.name] || p.name}
                onClick={() => addAppliance(p)}
              />
            ))}
            <ApplianceChip label={s.appliances.addOther} onClick={() => addAppliance(null)} />
          </div>
        </Card>

        {/* Heavy duty */}
        <div
          style={{
            background: C.canvas,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.muted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flex: 'none', marginTop: 2 }}
            >
              <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 400,
                color: C.muted,
                lineHeight: 1.5,
                textWrap: 'pretty',
              }}
            >
              {s.appliances.heavyIntro}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HEAVY_DUTY_VALS.map((val) => {
              const sel = d.heavyDuty.indexOf(val) !== -1
              return (
                <button
                  key={val}
                  onClick={() =>
                    setD({
                      heavyDuty: sel
                        ? d.heavyDuty.filter((x) => x !== val)
                        : d.heavyDuty.concat([val]),
                    })
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 48,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1.5px solid ${sel ? C.red : C.border}`,
                    background: sel ? C.redTint : C.white,
                    cursor: 'pointer',
                    textAlign: 'start',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `1.5px solid ${sel ? C.red : C.toggleOff}`,
                      background: sel ? C.red : C.white,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: sel ? 1 : 0 }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.body }}>
                    {s.opt.heavyDuty[val]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
