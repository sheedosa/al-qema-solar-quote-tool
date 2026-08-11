import { useEffect, useState } from 'react'
import { C, cardStyle, inputStyle } from '../theme'
import type { PricingConfig } from '../pricing/types'
import { validatePricingConfig } from '../pricing/validate'
import { supabase } from './supabaseClient'

type ConfigRow = { id: string; version: string; created_at: string; is_active: boolean }

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 10,
}
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.muted }
const numStyle: React.CSSProperties = { ...inputStyle, minHeight: 38, padding: '6px 10px', fontSize: 14 }

function Num({
  value,
  onChange,
  width = 110,
}: {
  value: number | null
  onChange: (n: number | null) => void
  width?: number
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Number(v))
      }}
      style={{ ...numStyle, width }}
    />
  )
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>{name}</span>
      {children}
    </div>
  )
}

/** Deep-clone + mutate helper so section editors stay terse. */
function useConfigState() {
  const [cfg, setCfg] = useState<PricingConfig | null>(null)
  const patch = (mutate: (draft: PricingConfig) => void) => {
    setCfg((cur) => {
      if (!cur) return cur
      const draft = JSON.parse(JSON.stringify(cur)) as PricingConfig
      mutate(draft)
      return draft
    })
  }
  return { cfg, setCfg, patch }
}

export function PricingEditor() {
  const { cfg, setCfg, patch } = useConfigState()
  const [history, setHistory] = useState<ConfigRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newComponent, setNewComponent] = useState('')

  const loadAll = async () => {
    const { data: rows } = await supabase
      .from('pricing_configs')
      .select('id, version, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(50)
    setHistory((rows as ConfigRow[]) ?? [])
    const active = (rows as ConfigRow[])?.find((r) => r.is_active)
    if (active) {
      const { data } = await supabase
        .from('pricing_configs')
        .select('config')
        .eq('id', active.id)
        .single()
      if (data) setCfg(data.config as PricingConfig)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nextVersion = (): string => {
    const today = new Date().toISOString().slice(0, 10)
    const prefix = 'pricing-' + today + '.'
    const taken = history
      .map((r) => r.version)
      .filter((v) => v.startsWith(prefix))
      .map((v) => parseInt(v.slice(prefix.length), 10))
      .filter((n) => Number.isFinite(n))
    return prefix + (taken.length ? Math.max(...taken) + 1 : 1)
  }

  const saveAndActivate = async () => {
    if (!cfg) return
    setBusy(true)
    setNotice('')
    const version = nextVersion()
    const candidate = { ...cfg, configVersion: version }
    const checked = validatePricingConfig(candidate)
    if (!checked.ok) {
      setErrors(checked.errors)
      setBusy(false)
      return
    }
    setErrors([])
    const { data, error } = await supabase
      .from('pricing_configs')
      .insert({ version, config: checked.config, is_active: false })
      .select('id')
      .single()
    if (error || !data) {
      setErrors([error?.message ?? 'insert failed'])
      setBusy(false)
      return
    }
    const { error: rpcErr } = await supabase.rpc('activate_pricing_config', { target: data.id })
    if (rpcErr) {
      setErrors([rpcErr.message])
    } else {
      setNotice('Saved and activated ' + version + ' — live for new visitors immediately.')
      await loadAll()
    }
    setBusy(false)
  }

  const activateExisting = async (id: string, version: string) => {
    setBusy(true)
    setNotice('')
    const { error } = await supabase.rpc('activate_pricing_config', { target: id })
    if (error) setErrors([error.message])
    else {
      setErrors([])
      setNotice('Activated ' + version + '.')
      await loadAll()
    }
    setBusy(false)
  }

  if (!cfg) return <div style={{ color: C.muted, padding: 20 }}>Loading pricing config…</div>

  const componentNames = Object.keys(cfg.components)

  const ComponentSelect = ({
    value,
    onChange,
  }: {
    value: string
    onChange: (name: string) => void
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...numStyle, width: 190 }}>
      {componentNames.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Packages */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Packages</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: '8px 6px' }}>
            <thead>
              <tr>
                {['Tier', 'Price (LYD)', 'Inverter kVA', 'Panels', 'Panel W', 'Battery', 'Max ACs', 'Max AC BTU'].map(
                  (h) => (
                    <th key={h} style={{ ...label, textAlign: 'left' }}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {cfg.packages.map((p, i) => (
                <tr key={p.tier}>
                  <td style={{ fontWeight: 700, color: C.red, fontSize: 15 }}>{p.tier}</td>
                  <td>
                    <Num value={p.priceLyd} onChange={(n) => patch((c) => void (c.packages[i].priceLyd = n ?? 0))} />
                  </td>
                  <td>
                    <Num
                      value={p.inverterKva}
                      width={80}
                      onChange={(n) => patch((c) => void (c.packages[i].inverterKva = n ?? 0))}
                    />
                  </td>
                  <td>
                    <Num
                      value={p.panel.count}
                      width={70}
                      onChange={(n) => patch((c) => void (c.packages[i].panel.count = n ?? 0))}
                    />
                  </td>
                  <td>
                    <Num
                      value={p.panel.watts}
                      width={80}
                      onChange={(n) => patch((c) => void (c.packages[i].panel.watts = n ?? 0))}
                    />
                  </td>
                  <td style={{ fontSize: 13, color: C.body, whiteSpace: 'nowrap' }}>
                    {p.battery.chemistry === 'liquid' ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Num
                          value={p.battery.count}
                          width={56}
                          onChange={(n) =>
                            patch((c) => {
                              const b = c.packages[i].battery
                              if (b.chemistry === 'liquid') b.count = n ?? 0
                            })
                          }
                        />
                        ×
                        <Num
                          value={p.battery.ampHours}
                          width={70}
                          onChange={(n) =>
                            patch((c) => {
                              const b = c.packages[i].battery
                              if (b.chemistry === 'liquid') b.ampHours = n ?? 0
                            })
                          }
                        />
                        Ah liquid
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Num
                          value={p.battery.count}
                          width={56}
                          onChange={(n) =>
                            patch((c) => {
                              const b = c.packages[i].battery
                              if (b.chemistry === 'lithium') b.count = n ?? 0
                            })
                          }
                        />
                        ×
                        <Num
                          value={p.battery.kwhEach}
                          width={70}
                          onChange={(n) =>
                            patch((c) => {
                              const b = c.packages[i].battery
                              if (b.chemistry === 'lithium') b.kwhEach = n ?? 0
                            })
                          }
                        />
                        kWh lithium
                      </span>
                    )}
                  </td>
                  <td>
                    <Num
                      value={p.maxAcUnits}
                      width={60}
                      onChange={(n) => patch((c) => void (c.packages[i].maxAcUnits = n ?? 0))}
                    />
                  </td>
                  <td>
                    <Num
                      value={p.maxAcBtu}
                      width={90}
                      onChange={(n) => patch((c) => void (c.packages[i].maxAcBtu = n))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom BOM */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Custom-system pricing (BOM)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Field name="Minimum price / floor (LYD)">
            <Num
              value={cfg.customBom.minimumLyd}
              width={130}
              onChange={(n) => patch((c) => void (c.customBom.minimumLyd = n ?? 0))}
            />
          </Field>
          <Field name="Round up to (LYD)">
            <Num
              value={cfg.customBom.roundUpToLyd}
              width={90}
              onChange={(n) => patch((c) => void (c.customBom.roundUpToLyd = n ?? 0))}
            />
          </Field>
          <Field name="Panel">
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                value={cfg.customBom.panel.component}
                onChange={(name) => patch((c) => void (c.customBom.panel.component = name))}
              />
              <Num
                value={cfg.customBom.panel.watts}
                width={70}
                onChange={(n) => patch((c) => void (c.customBom.panel.watts = n ?? 0))}
              />
              <span style={label}>W</span>
            </span>
          </Field>
          <Field name="Battery">
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                value={cfg.customBom.battery.component}
                onChange={(name) => patch((c) => void (c.customBom.battery.component = name))}
              />
              <Num
                value={cfg.customBom.battery.kwhEach}
                width={60}
                onChange={(n) => patch((c) => void (c.customBom.battery.kwhEach = n ?? 0))}
              />
              <span style={label}>kWh</span>
            </span>
          </Field>
          <Field name="Single inverter (≤ kW)">
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                value={cfg.customBom.inverter.single.component}
                onChange={(name) => patch((c) => void (c.customBom.inverter.single.component = name))}
              />
              <Num
                value={cfg.customBom.inverter.single.maxKw}
                width={60}
                onChange={(n) => patch((c) => void (c.customBom.inverter.single.maxKw = n ?? 0))}
              />
            </span>
          </Field>
          <Field name="Parallel inverter (kW each)">
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                value={cfg.customBom.inverter.parallel.component}
                onChange={(name) => patch((c) => void (c.customBom.inverter.parallel.component = name))}
              />
              <Num
                value={cfg.customBom.inverter.parallel.unitKw}
                width={60}
                onChange={(n) => patch((c) => void (c.customBom.inverter.parallel.unitKw = n ?? 0))}
              />
            </span>
          </Field>
          <Field name="Panels per stand">
            <Num
              value={cfg.customBom.stand.panelsPerStand}
              width={60}
              onChange={(n) => patch((c) => void (c.customBom.stand.panelsPerStand = n ?? 0))}
            />
          </Field>
        </div>
      </div>

      {/* Component price list */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Component price list (LYD)</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '6px 20px',
          }}
        >
          {componentNames.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.body, flex: 1 }}>{name}</span>
              <Num
                value={cfg.components[name]}
                width={90}
                onChange={(n) => patch((c) => void (c.components[name] = n ?? 0))}
              />
              <button
                title="Remove component"
                onClick={() => patch((c) => void delete c.components[name])}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.faint,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="New component name"
            value={newComponent}
            onChange={(e) => setNewComponent(e.target.value)}
            style={{ ...numStyle, width: 240 }}
          />
          <button
            onClick={() => {
              const name = newComponent.trim()
              if (name) {
                patch((c) => void (c.components[name] = 0))
                setNewComponent('')
              }
            }}
            style={{
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.white,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Appliance defaults */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Appliance assumptions (watts / hours per day)</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '6px 20px',
          }}
        >
          {Object.entries(cfg.loadDefaults.appliancesByName).map(([name, def]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.body, flex: 1 }}>
                {name}
                {def.alwaysOn ? ' (always on)' : ''}
                {def.heavy ? ' ⚡' : ''}
              </span>
              <Num
                value={def.watts}
                width={70}
                onChange={(n) =>
                  patch((c) => void (c.loadDefaults.appliancesByName[name].watts = n ?? 0))
                }
              />
              {!def.alwaysOn && (
                <Num
                  value={def.hours ?? 0}
                  width={60}
                  onChange={(n) =>
                    patch((c) => void (c.loadDefaults.appliancesByName[name].hours = n ?? 0))
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Constants */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Sizing constants</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Field name="AC W per BTU (standard)">
            <Num
              value={cfg.loadDefaults.acWattsPerBtu.standard}
              onChange={(n) => patch((c) => void (c.loadDefaults.acWattsPerBtu.standard = n ?? 0))}
            />
          </Field>
          <Field name="AC W per BTU (inverter)">
            <Num
              value={cfg.loadDefaults.acWattsPerBtu.inverter}
              onChange={(n) => patch((c) => void (c.loadDefaults.acWattsPerBtu.inverter = n ?? 0))}
            />
          </Field>
          <Field name="Assumed AC BTU (unknown)">
            <Num
              value={cfg.loadDefaults.assumedAcBtu}
              onChange={(n) => patch((c) => void (c.loadDefaults.assumedAcBtu = n ?? 0))}
            />
          </Field>
          <Field name="Lighting hours/day">
            <Num
              value={cfg.loadDefaults.lightingHours}
              onChange={(n) => patch((c) => void (c.loadDefaults.lightingHours = n ?? 0))}
            />
          </Field>
          <Field name="Fridge W / duty">
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Num
                value={cfg.loadDefaults.fridge.watts}
                width={70}
                onChange={(n) => patch((c) => void (c.loadDefaults.fridge.watts = n ?? 0))}
              />
              <Num
                value={cfg.loadDefaults.fridge.duty}
                width={60}
                onChange={(n) => patch((c) => void (c.loadDefaults.fridge.duty = n ?? 0))}
              />
            </span>
          </Field>
          <Field name="Freezer W / duty">
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Num
                value={cfg.loadDefaults.freezer.watts}
                width={70}
                onChange={(n) => patch((c) => void (c.loadDefaults.freezer.watts = n ?? 0))}
              />
              <Num
                value={cfg.loadDefaults.freezer.duty}
                width={60}
                onChange={(n) => patch((c) => void (c.loadDefaults.freezer.duty = n ?? 0))}
              />
            </span>
          </Field>
          <Field name="Peak sun hours">
            <Num
              value={cfg.sizing.peakSunHours}
              onChange={(n) => patch((c) => void (c.sizing.peakSunHours = n ?? 0))}
            />
          </Field>
          <Field name="System efficiency (0–1)">
            <Num
              value={cfg.sizing.systemEfficiency}
              onChange={(n) => patch((c) => void (c.sizing.systemEfficiency = n ?? 0))}
            />
          </Field>
          <Field name="Inverter safety factor">
            <Num
              value={cfg.sizing.inverterSafetyFactor}
              onChange={(n) => patch((c) => void (c.sizing.inverterSafetyFactor = n ?? 0))}
            />
          </Field>
          <Field name="Diversity factor (0–1)">
            <Num
              value={cfg.sizing.diversityFactor}
              onChange={(n) => patch((c) => void (c.sizing.diversityFactor = n ?? 0))}
            />
          </Field>
          <Field name="Liquid battery V">
            <Num
              value={cfg.sizing.liquidBatteryVoltageV}
              onChange={(n) => patch((c) => void (c.sizing.liquidBatteryVoltageV = n ?? 0))}
            />
          </Field>
          <Field name="DoD liquid / lithium (0–1)">
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Num
                value={cfg.sizing.dodByChemistry.liquid}
                width={60}
                onChange={(n) => patch((c) => void (c.sizing.dodByChemistry.liquid = n ?? 0))}
              />
              <Num
                value={cfg.sizing.dodByChemistry.lithium}
                width={60}
                onChange={(n) => patch((c) => void (c.sizing.dodByChemistry.lithium = n ?? 0))}
              />
            </span>
          </Field>
          <Field name="Add-on: battery box (LYD)">
            <Num
              value={cfg.addOns[0]?.priceLyd ?? null}
              onChange={(n) =>
                patch((c) => {
                  if (c.addOns[0]) c.addOns[0].priceLyd = n ?? 0
                })
              }
            />
          </Field>
        </div>
      </div>

      {/* Save */}
      <div style={cardStyle}>
        {errors.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>
              Cannot save — fix these first:
            </div>
            {errors.map((e) => (
              <div key={e} style={{ fontSize: 13, color: C.body }}>
                · {e}
              </div>
            ))}
          </div>
        )}
        {notice && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.green, marginBottom: 12 }}>
            {notice}
          </div>
        )}
        <button
          onClick={() => void saveAndActivate()}
          disabled={busy}
          style={{
            minHeight: 46,
            padding: '0 22px',
            borderRadius: 12,
            border: 'none',
            background: C.red,
            color: C.white,
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          Save & activate as {nextVersion()}
        </button>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>
          Changes are validated first and go live for new visitors immediately.
        </div>
      </div>

      {/* History */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Version history</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, width: 210 }}>
                {row.version}
              </span>
              <span style={{ fontSize: 12.5, color: C.muted, flex: 1 }}>
                {new Date(row.created_at).toLocaleString('en-GB', { hour12: false })}
              </span>
              {row.is_active ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>ACTIVE</span>
              ) : (
                <button
                  onClick={() => void activateExisting(row.id, row.version)}
                  disabled={busy}
                  style={{
                    minHeight: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Activate
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
