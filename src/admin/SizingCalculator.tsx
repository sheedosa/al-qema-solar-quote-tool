import { useEffect, useMemo, useState } from 'react'
import { C, cardStyle } from '../theme'
import { priceCommercialBom, sizeCommercial } from '../pricing/commercial'
import { PRICING_CONFIG } from '../pricing/config'
import type {
  CommercialConfig,
  CommercialFlag,
  CommercialSizing,
  PricingConfig,
} from '../pricing/types'
import { Field, Num, label, sectionTitle } from './controls'
import { supabase } from './supabaseClient'
import { MobileContext, useIsMobile } from './useIsMobile'

/**
 * Commercial sizing, for an engineer quoting a large job.
 *
 * Internal tool: it takes three figures off a bill or a survey and applies the
 * client's own written method (docs/commercial-sizing.md). Deliberately not
 * wired to the customer wizard, which derives everything from a household
 * appliance checklist and cannot reach this scale.
 */

const FLAG_TEXT: Record<CommercialFlag, string> = {
  residentialScale:
    'This is a household-sized load. The smallest stocked inverter is far bigger than it needs — quote it from the packages instead.',
  aboveLargestInverter:
    'The peak load is above the largest stocked inverter, so the size shown is capped. This job needs multiple units and an engineer.',
  dcAcRatioHigh:
    'The array is much larger than the inverter the method selects. The method sizes the inverter from the daytime load alone, but the array also has to recharge the battery bank — confirm whether the inverter carries the charging, or whether separate charge controllers do.',
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
const fmtLyd = (n: number) => n.toLocaleString('en-US') + ' LYD'

function Stat({ value, unit, caption }: { value: string; unit: string; caption: string }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 0,
        padding: '12px 14px',
        borderRadius: 10,
        background: C.canvas,
        border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginInlineStart: 4 }}>
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{caption}</div>
    </div>
  )
}

/** One step of the arithmetic, so an engineer can check it against paper. */
function Step({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{children}</span>
    </li>
  )
}

function summaryText(s: CommercialSizing, cm: CommercialConfig, priced: string): string {
  return [
    'Indicative sizing — not a customer quote',
    '',
    `Batteries: ${s.batteries} × ${cm.battery.kwhEach} kWh (${fmt(s.grossKwh)} kWh gross)`,
    `Panels: ${s.panels} × ${cm.panel.watts} W (${fmt(s.arrayKw)} kW array)`,
    `Inverter: ${s.inverterKw} kW`,
    priced,
  ].join('\n')
}

export function SizingCalculator() {
  const isMobile = useIsMobile()
  const [cfg, setCfg] = useState<PricingConfig>(PRICING_CONFIG)
  const [source, setSource] = useState<'bundled' | 'live'>('bundled')
  const [batteryKwh, setBatteryKwh] = useState<number | null>(180)
  const [dayLoadKw, setDayLoadKw] = useState<number | null>(30)
  const [peakKw, setPeakKw] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Component prices come from the live config so a rate the team added in
    // the Pricing tab is used here immediately. The bundled config is the
    // fallback, not an error state — the calculator must work on day one.
    const load = async () => {
      const { data } = await supabase
        .from('pricing_configs')
        .select('config')
        .eq('is_active', true)
        .limit(1)
      const row = (data as { config: PricingConfig }[] | null)?.[0]
      if (row?.config) {
        setCfg(row.config)
        setSource('live')
      }
    }
    void load()
  }, [])

  /**
   * The live config predates this block, so fall back to the bundled
   * constants rather than disabling the tool until someone republishes.
   */
  const commercial: CommercialConfig = cfg.commercial ?? (PRICING_CONFIG.commercial as CommercialConfig)
  const usingBundledMethod = cfg.commercial === undefined

  const result = useMemo(
    () =>
      sizeCommercial(
        {
          batteryKwh: batteryKwh ?? 0,
          dayLoadKw: dayLoadKw ?? 0,
          // The peak defaults to the daytime load, as the method specifies.
          peakKw: peakKw ?? dayLoadKw ?? 0,
        },
        commercial,
      ),
    [batteryKwh, dayLoadKw, peakKw, commercial],
  )

  const build = useMemo(
    () => (result.ok ? priceCommercialBom(result.sizing, cfg, commercial) : null),
    [result, cfg, commercial],
  )

  const copy = () => {
    if (!result.ok || !build) return
    const priced =
      build.unpricedComponents.length > 0
        ? `Indicative parts total: ${fmtLyd(build.totalLyd)} (${build.unpricedComponents.length} item(s) still unpriced)`
        : `Indicative parts total: ${fmtLyd(build.totalLyd)}`
    void navigator.clipboard?.writeText(summaryText(result.sizing, commercial, priced))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const gridCols = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'

  return (
    <MobileContext.Provider value={isMobile}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/*
          Permanent, not dismissible. Every figure below is an engineering
          estimate built on constants the client has not signed off, and the
          totals here are several times the 250,000 LYD above which the
          customer-facing path refuses to show a price at all.
        */}
        <div
          style={{
            ...cardStyle,
            padding: 14,
            background: C.amberTint,
            border: `1px solid ${C.amber}33`,
            color: C.amber,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Internal estimate — not a customer quote. Sized with Al Qema’s commercial
          method; prices are indicative and every figure needs an engineer’s sign-off.
        </div>

        <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
          <div style={sectionTitle}>The job</div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 14 }}>
            <Field name="Daily battery energy (kWh)">
              <Num value={batteryKwh} onChange={setBatteryKwh} width={150} />
            </Field>
            <Field name="Daytime load (kW)">
              <Num value={dayLoadKw} onChange={setDayLoadKw} width={150} />
            </Field>
            <Field name="Peak load (kW)">
              <Num value={peakKw} onChange={setPeakKw} width={150} />
            </Field>
          </div>
          <div style={{ ...label, marginTop: 10, lineHeight: 1.6 }}>
            Battery energy is what has to come out of the bank overnight. Daytime load is
            what the panels carry directly. Peak defaults to the daytime load
            {peakKw === null && dayLoadKw ? ' — using ' + fmt(dayLoadKw) + ' kW' : ''}.
          </div>
        </div>

        {!result.ok && (
          <div
            style={{
              ...cardStyle,
              padding: 16,
              border: `1px solid ${C.red}`,
              background: C.redTint,
            }}
          >
            <div style={{ fontWeight: 700, color: C.red, fontSize: 14, marginBottom: 6 }}>
              Check the numbers
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18, color: C.body, fontSize: 13 }}>
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {result.ok && (
          <>
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
              <div style={sectionTitle}>System</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Stat
                  value={String(result.sizing.batteries)}
                  unit={'× ' + commercial.battery.kwhEach + ' kWh'}
                  caption="batteries"
                />
                <Stat
                  value={String(result.sizing.panels)}
                  unit={'× ' + commercial.panel.watts + ' W'}
                  caption={fmt(result.sizing.arrayKw) + ' kW array'}
                />
                <Stat
                  value={String(result.sizing.inverterKw)}
                  unit="kW"
                  caption="inverter"
                />
              </div>

              <ul style={{ margin: '14px 0 0', paddingInlineStart: 18 }}>
                <Step>
                  {fmt(batteryKwh ?? 0)} ÷ {commercial.batteryEfficiency} ={' '}
                  {fmt(result.sizing.grossKwh)} kWh gross → ÷ {commercial.battery.kwhEach} ={' '}
                  {result.sizing.batteries} batteries
                </Step>
                <Step>
                  {result.sizing.batteries} × {commercial.battery.kwhEach} ÷{' '}
                  {commercial.peakSunHours} h = {fmt(result.sizing.chargeKw)} kW to recharge
                </Step>
                <Step>
                  {fmt(dayLoadKw ?? 0)} + {fmt(result.sizing.chargeKw)} ={' '}
                  {fmt(result.sizing.arrayNetKw)} kW ÷ {commercial.systemEfficiency} ={' '}
                  {fmt(result.sizing.arrayKw)} kW → ÷ {commercial.panel.watts} W ={' '}
                  {result.sizing.panels} panels
                </Step>
                <Step>
                  peak {fmt(peakKw ?? dayLoadKw ?? 0)} kW → {result.sizing.inverterKw} kW (load +
                  charging would be {result.sizing.inverterKwWithCharging} kW)
                </Step>
              </ul>

              <button
                className="admin-focusable"
                onClick={copy}
                style={{
                  marginTop: 14,
                  minHeight: 44,
                  padding: '0 16px',
                  width: isMobile ? '100%' : 'auto',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  color: C.body,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copied' : 'Copy summary'}
              </button>
            </div>

            {result.sizing.flags.length > 0 && (
              <div
                style={{
                  ...cardStyle,
                  padding: 16,
                  background: C.amberTint,
                  border: `1px solid ${C.amber}33`,
                }}
              >
                <div style={{ fontWeight: 700, color: C.amber, fontSize: 14, marginBottom: 6 }}>
                  Check before quoting
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingInlineStart: 18,
                    color: C.body,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {result.sizing.flags.map((f) => (
                    <li key={f}>{FLAG_TEXT[f]}</li>
                  ))}
                </ul>
              </div>
            )}

            {build && (
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
                <div style={sectionTitle}>Indicative parts list</div>
                {/*
                  The table scrolls inside its card rather than bursting out of
                  it — four nowrap columns do not fit 390px.
                */}
                <div className="admin-scroll-x">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11.5 }}>
                        <th style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>ITEM</th>
                        <th style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          QTY
                        </th>
                        <th style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          UNIT
                        </th>
                        <th style={{ padding: '6px 0 6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {build.lines.map((l) => (
                        <tr key={l.name} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: '7px 8px 7px 0', color: C.body }}>{l.name}</td>
                          <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{l.qty}</td>
                          <td
                            style={{
                              padding: '7px 8px',
                              whiteSpace: 'nowrap',
                              color: l.unitLyd === null ? C.amber : C.body,
                              fontWeight: l.unitLyd === null ? 600 : 400,
                            }}
                          >
                            {l.unitLyd === null ? 'no price' : fmt(l.unitLyd)}
                          </td>
                          <td
                            style={{
                              padding: '7px 0 7px 8px',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                              color: l.totalLyd === null ? C.faint : C.ink,
                            }}
                          >
                            {l.totalLyd === null ? '—' : fmt(l.totalLyd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, color: C.muted }}>Priced items, rounded up</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>
                    {fmtLyd(build.totalLyd)}
                  </span>
                </div>

                {build.unpricedComponents.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12.5,
                      color: C.amber,
                      lineHeight: 1.6,
                      fontWeight: 600,
                    }}
                  >
                    {build.unpricedComponents.length} item(s) are not in the price list, so the
                    total above is incomplete: {build.unpricedComponents.join(', ')}. Add them in
                    Pricing → Component price list and this fills in.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ ...label, lineHeight: 1.6 }}>
          Method: {commercial.batteryEfficiency} battery efficiency ·{' '}
          {commercial.systemEfficiency} system efficiency · {commercial.peakSunHours} peak sun
          hours · {commercial.panel.watts} W panels · {commercial.battery.kwhEach} kWh batteries.
          {usingBundledMethod
            ? ' These are the built-in figures — publish the pricing config once to make them editable.'
            : ''}
          {source === 'bundled' ? ' Component prices are the built-in list.' : ''}
        </div>
      </div>
    </MobileContext.Provider>
  )
}
