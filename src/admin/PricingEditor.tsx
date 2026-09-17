import { useEffect, useState } from 'react'
import { C, cardStyle } from '../theme'
import { Auto, ComponentSelect, Field, Ltr, Num, label, numStyle, sectionTitle, thText } from './controls'
import type { PricingConfig } from '../pricing/types'
import { validatePricingConfig } from '../pricing/validate'
import { fmtDateTime, plural } from './format'
import { lookup, useAdminLang } from './i18n'
import { supabase } from './supabaseClient'
import { MobileContext, useIsMobile } from './useIsMobile'

type ConfigRow = { id: string; version: string; created_at: string; is_active: boolean }

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
  const [baseline, setBaseline] = useState('')
  // One slot, so opening a confirm on another row cancels the first.
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const { t, lang, opt } = useAdminLang()
  const pr = t.pricing

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
      if (data) {
        setCfg(data.config as PricingConfig)
        // Baseline for the dirty check, so the action bar can say whether
        // there is anything to publish — and so publishing a brand-new
        // version number when nothing changed is no longer possible.
        setBaseline(JSON.stringify(data.config))
      }
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
      setErrors([error?.message ?? pr.insertFailed])
      setBusy(false)
      return
    }
    const { error: rpcErr } = await supabase.rpc('activate_pricing_config', { target: data.id })
    if (rpcErr) {
      setErrors([rpcErr.message])
    } else {
      setNotice(pr.savedNotice(version))
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
      setNotice(pr.activatedNotice(version))
      await loadAll()
    }
    setBusy(false)
  }

  if (!cfg) return <div style={{ color: C.muted, padding: 20 }}>{pr.loading}</div>

  const componentNames = Object.keys(cfg.components)
  // Cheap at this config size, and it drives the bar's label, the button's
  // disabled state, and the unload warning.
  const dirty = JSON.stringify(cfg) !== baseline

  return (
    <MobileContext.Provider value={isMobile}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/*
        Errors and the success notice live at the TOP now. They used to sit in
        the save card, two thirds of the way down a ~2,400px page, so a
        validation failure appeared far from both the button that caused it and
        the field that needs fixing.
      */}
      {errors.length > 0 && (
        <div style={{ ...cardStyle, borderInlineStart: `3px solid ${C.red}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>
            {pr.cannotSave}
          </div>
          {/* Validator text comes from the pricing module in English. Each line
              is its own paragraph so it aligns as itself, not as Arabic prose. */}
          {errors.map((e) => (
            <div key={e} dir="auto" style={{ fontSize: 13, color: C.body, lineHeight: 1.5, textAlign: 'start' }}>
              · {e}
            </div>
          ))}
        </div>
      )}
      {notice && (
        <div style={{ ...cardStyle, borderInlineStart: `3px solid ${C.green}` }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.green }}>{notice}</div>
        </div>
      )}

      {/* Packages */}
      <div style={cardStyle}>
        <div style={sectionTitle}>{pr.packages}</div>
        <div className="admin-scroll-x">
          <table style={{ borderCollapse: 'separate', borderSpacing: '8px 6px' }}>
            <thead>
              <tr>
                {[
                  pr.cols.tier,
                  pr.cols.price,
                  pr.cols.inverterKva,
                  pr.cols.panels,
                  pr.cols.panelW,
                  pr.cols.battery,
                  pr.cols.maxAcs,
                  pr.cols.maxAcBtu,
                ].map((h) => (
                  // Editable numbers keep start alignment: only read-only
                  // figures end-align, and every cell here is an input.
                  <th key={h} style={{ ...thText, padding: '0 0 4px', borderBottom: 'none' }}>
                    {h}
                  </th>
                ))}
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
                        {pr.unitAhLiquid}
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
                        {pr.unitKwhLithium}
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
        <div style={sectionTitle}>{pr.customBom}</div>
        <div
          style={{
            display: 'grid',
            // One field per row on a phone; even columns on desktop. `flex-wrap`
            // packed by intrinsic width, which made the rows ragged.
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <Field name={pr.minimumPrice}>
            <Num
              value={cfg.customBom.minimumLyd}
              width={130}
              onChange={(n) => patch((c) => void (c.customBom.minimumLyd = n ?? 0))}
            />
          </Field>
          <Field name={pr.roundUpTo}>
            <Num
              value={cfg.customBom.roundUpToLyd}
              width={90}
              onChange={(n) => patch((c) => void (c.customBom.roundUpToLyd = n ?? 0))}
            />
          </Field>
          <Field name={pr.panel}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                options={componentNames}
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
          <Field name={pr.battery}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                options={componentNames}
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
          <Field name={pr.singleInverter}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                options={componentNames}
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
          <Field name={pr.parallelInverter}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <ComponentSelect
                options={componentNames}
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
          <Field name={pr.panelsPerStand}>
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
        <div style={sectionTitle}>{pr.componentList}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '6px 20px',
          }}
        >
          {componentNames.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.body, flex: 1, minWidth: 0, textAlign: 'start' }}>
                <Auto>{name}</Auto>
              </span>
              <Num
                value={cfg.components[name]}
                width={90}
                onChange={(n) => patch((c) => void (c.components[name] = n ?? 0))}
              />
              {/*
                Was a bare 16px × glyph on a transparent background — roughly a
                10×19px target — that deleted a price line instantly with no
                confirmation and no undo. Now a real 44px target with a
                two-tap confirm. Not window.confirm: unstyleable, and blocked
                in some in-app webviews.
              */}
              {confirmDel === name ? (
                <>
                  <button
                    className="admin-focusable"
                    onClick={() => setConfirmDel(null)}
                    style={{
                      flex: 'none',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: C.white,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    className="admin-focusable"
                    onClick={() => {
                      patch((c) => void delete c.components[name])
                      setConfirmDel(null)
                    }}
                    style={{
                      flex: 'none',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: C.red,
                      color: C.white,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t.common.delete}
                  </button>
                </>
              ) : (
                <button
                  className="admin-focusable"
                  aria-label={pr.removeComponent(name)}
                  title={pr.removeComponent(name)}
                  onClick={() => setConfirmDel(name)}
                  style={{
                    flex: 'none',
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    color: C.muted,
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            className="admin-input"
            placeholder={pr.newComponentPlaceholder}
            value={newComponent}
            onChange={(e) => setNewComponent(e.target.value)}
            dir="auto"
            style={{ ...numStyle, width: isMobile ? '100%' : 240, minWidth: 0, fontSize: isMobile ? 16 : 14 }}
          />
          <button
            onClick={() => {
              const name = newComponent.trim()
              if (name) {
                patch((c) => void (c.components[name] = 0))
                setNewComponent('')
              }
            }}
            className="admin-focusable"
            style={{
              // 44px like every other control; this one was 38.
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.white,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.common.add}
          </button>
        </div>
      </div>

      {/* Appliance defaults */}
      <div style={cardStyle}>
        <div style={sectionTitle}>{pr.applianceAssumptions}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '6px 20px',
          }}
        >
          {Object.entries(cfg.loadDefaults.appliancesByName).map(([name, def]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.body, flex: 1, minWidth: 0, textAlign: 'start' }}>
                {lookup(opt.preset, name)}
                {def.alwaysOn ? ' ' + pr.alwaysOnSuffix : ''}
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
        <div style={sectionTitle}>{pr.sizingConstants}</div>
        <div
          style={{
            display: 'grid',
            // One field per row on a phone; even columns on desktop. `flex-wrap`
            // packed by intrinsic width, which made the rows ragged.
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <Field name={pr.fields.acWattsStandard}>
            <Num
              value={cfg.loadDefaults.acWattsPerBtu.standard}
              onChange={(n) => patch((c) => void (c.loadDefaults.acWattsPerBtu.standard = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.acWattsInverter}>
            <Num
              value={cfg.loadDefaults.acWattsPerBtu.inverter}
              onChange={(n) => patch((c) => void (c.loadDefaults.acWattsPerBtu.inverter = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.assumedAcBtu}>
            <Num
              value={cfg.loadDefaults.assumedAcBtu}
              onChange={(n) => patch((c) => void (c.loadDefaults.assumedAcBtu = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.lightingHours}>
            <Num
              value={cfg.loadDefaults.lightingHours}
              onChange={(n) => patch((c) => void (c.loadDefaults.lightingHours = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.fridgeWDuty}>
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
          <Field name={pr.fields.freezerWDuty}>
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
          <Field name={pr.fields.peakSunHours}>
            <Num
              value={cfg.sizing.peakSunHours}
              onChange={(n) => patch((c) => void (c.sizing.peakSunHours = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.systemEfficiency}>
            <Num
              value={cfg.sizing.systemEfficiency}
              onChange={(n) => patch((c) => void (c.sizing.systemEfficiency = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.inverterSafetyFactor}>
            <Num
              value={cfg.sizing.inverterSafetyFactor}
              onChange={(n) => patch((c) => void (c.sizing.inverterSafetyFactor = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.diversityFactor}>
            <Num
              value={cfg.sizing.diversityFactor}
              onChange={(n) => patch((c) => void (c.sizing.diversityFactor = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.liquidBatteryV}>
            <Num
              value={cfg.sizing.liquidBatteryVoltageV}
              onChange={(n) => patch((c) => void (c.sizing.liquidBatteryVoltageV = n ?? 0))}
            />
          </Field>
          <Field name={pr.fields.dod}>
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
          {cfg.commercial && (
            <Field name={pr.fields.takesOverAboveKw}>
              <Num
                value={cfg.commercial.customerPath.takesOverAboveKw}
                onChange={(n) =>
                  patch((c) => {
                    if (c.commercial) c.commercial.customerPath.takesOverAboveKw = n ?? 0
                  })
                }
              />
            </Field>
          )}
          <Field name={pr.fields.addOnBatteryBox}>
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

      {/* History */}
      <div style={cardStyle}>
        <div style={sectionTitle}>{pr.versionHistory}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, width: 210 }}>
                <Ltr>{row.version}</Ltr>
              </span>
              <span style={{ fontSize: 12.5, color: C.muted, flex: 1 }}>
                <Ltr>{fmtDateTime(row.created_at, lang)}</Ltr>
              </span>
              {row.is_active ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{t.common.active}</span>
              ) : (
                <button
                  onClick={() => void activateExisting(row.id, row.version)}
                  disabled={busy}
                  className="admin-focusable"
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.common.activate}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/*
        Spacer so the last card clears the fixed bar below. `main`'s own bottom
        padding is not enough once the bar is overlaying the viewport.
      */}
      <div style={{ height: 88 }} />

      {/*
        The publish control was card 6 of 7 on a ~2,400px page, so the primary
        action of the whole screen required scrolling past everything — with
        version history still below it.

        Fixed, not sticky: a sticky element only sticks while its own parent
        box is in view, so on a column this tall it would appear only once you
        had already scrolled to the bottom. zIndex sits under the header's 50.
      */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: C.white,
          borderTop: `1px solid ${C.border}`,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          padding: `10px ${isMobile ? 14 : 20}px calc(10px + env(safe-area-inset-bottom))`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            fontWeight: 600,
            color: errors.length > 0 ? C.red : dirty ? C.amber : C.muted,
          }}
        >
          {errors.length > 0
            ? plural(errors.length, pr.problemsSeeTop, lang)
            : dirty
              ? pr.unsaved
              : pr.noChanges}
        </div>
        <button
          className="admin-focusable"
          onClick={() => void saveAndActivate()}
          disabled={busy || !dirty}
          style={{
            flex: 'none',
            minHeight: 48,
            padding: '0 20px',
            borderRadius: 12,
            border: 'none',
            background: C.red,
            color: C.white,
            fontSize: 15,
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy || !dirty ? 0.55 : 1,
          }}
        >
          {busy ? (
            pr.saving
          ) : isMobile ? (
            pr.saveActivate
          ) : (
            <>
              {pr.saveActivateAs} <Ltr>{nextVersion()}</Ltr>
            </>
          )}
        </button>
      </div>
    </div>
    </MobileContext.Provider>
  )
}
