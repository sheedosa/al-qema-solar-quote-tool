import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { C, cardStyle } from '../theme'
import { priceCommercialBom, sizeCommercial } from '../pricing/commercial'
import { PRICING_CONFIG } from '../pricing/config'
import type { CommercialConfig, CommercialSizing, PricingConfig } from '../pricing/types'
import { Auto, Field, Ltr, Money, Num, TdNum, label, sectionTitle, tdNum, tdText, thNum, thText } from './controls'
import { fmtNum, fmtPrice, plural } from './format'
import { useAdminLang } from './i18n'
import type { AdminStrings } from './strings'
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

const num = (n: number) => fmtNum(n, 2)

function Stat({ value, unit, caption }: { value: string; unit: string; caption: ReactNode }) {
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
      {/* Value and unit are two isolates: "× 5 kWh" starts with a neutral and
          would otherwise jump to the other side of the number in Arabic. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, color: C.ink, lineHeight: 1.15 }}>
        <Ltr style={{ fontSize: 22, fontWeight: 700 }}>{value}</Ltr>
        <Ltr style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{unit}</Ltr>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{caption}</div>
    </div>
  )
}

/**
 * One line of the arithmetic, so an engineer can check it against paper. The
 * maths is an LTR monospace run in both languages; the note follows the
 * document. Mixing the two in one string is what scrambled under RTL.
 */
function Step({ math, note }: { math: string; note: string }) {
  return (
    <li style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
      <Ltr style={{ fontFamily: 'ui-monospace, monospace', whiteSpace: 'normal' }}>{math}</Ltr>
      <span style={{ marginInlineStart: 8 }}>— {note}</span>
    </li>
  )
}

function summaryText(
  s: CommercialSizing,
  cm: CommercialConfig,
  priced: string,
  t: AdminStrings['sizing']['summary'],
): string {
  return [
    t.title,
    '',
    `${t.batteries}: ${s.batteries} × ${cm.battery.kwhEach} kWh (${num(s.grossKwh)} kWh ${t.gross})`,
    `${t.panels}: ${s.panels} × ${cm.panel.watts} W (${num(s.arrayKw)} kW ${t.array})`,
    `${t.inverter}: ${s.inverterKw} kW`,
    priced,
  ].join('\n')
}

export function SizingCalculator() {
  const isMobile = useIsMobile()
  const { t, lang } = useAdminLang()
  const z = t.sizing
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

  const effectivePeak = peakKw ?? dayLoadKw ?? 0

  const result = useMemo(
    () =>
      sizeCommercial(
        {
          batteryKwh: batteryKwh ?? 0,
          dayLoadKw: dayLoadKw ?? 0,
          // The peak defaults to the daytime load, as the method specifies.
          peakKw: effectivePeak,
        },
        commercial,
      ),
    [batteryKwh, dayLoadKw, effectivePeak, commercial],
  )

  const build = useMemo(
    () => (result.ok ? priceCommercialBom(result.sizing, cfg, commercial) : null),
    [result, cfg, commercial],
  )

  const copy = () => {
    if (!result.ok || !build) return
    const total = fmtPrice(build.totalLyd, t.common.currency)
    const priced =
      build.unpricedComponents.length > 0
        ? `${z.summary.partsTotal}: ${total} (${plural(build.unpricedComponents.length, z.summary.stillUnpriced, lang)})`
        : `${z.summary.partsTotal}: ${total}`
    void navigator.clipboard?.writeText(summaryText(result.sizing, commercial, priced, z.summary))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const gridCols = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const compact = { padding: '7px 8px', fontSize: 13 } as const
  const compactTh = { padding: '6px 8px', fontSize: 11.5, borderBottom: 'none' } as const

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
          {z.banner}
        </div>

        <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
          <div style={sectionTitle}>{z.job}</div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 14 }}>
            <Field name={z.batteryKwh}>
              <Num value={batteryKwh} onChange={setBatteryKwh} width={150} />
            </Field>
            <Field name={z.dayLoadKw}>
              <Num value={dayLoadKw} onChange={setDayLoadKw} width={150} />
            </Field>
            <Field name={z.peakKw}>
              <Num value={peakKw} onChange={setPeakKw} width={150} />
            </Field>
          </div>
          <div style={{ ...label, marginTop: 10, lineHeight: 1.6 }}>
            {z.help}
            {peakKw === null && dayLoadKw ? (
              <>
                {' '}
                {z.usingPeak} <Ltr>{num(dayLoadKw)} kW</Ltr>.
              </>
            ) : null}
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
            <div style={{ fontWeight: 700, color: C.red, fontSize: 14, marginBottom: 6 }}>{z.checkNumbers}</div>
            {/* Messages come from the pricing module in English; each is its
                own paragraph so it aligns as itself. */}
            <ul style={{ margin: 0, paddingInlineStart: 18, color: C.body, fontSize: 13 }}>
              {result.errors.map((e) => (
                <li key={e} dir="auto" style={{ textAlign: 'start' }}>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.ok && (
          <>
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
              <div style={sectionTitle}>{z.system}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Stat
                  value={String(result.sizing.batteries)}
                  unit={'× ' + commercial.battery.kwhEach + ' kWh'}
                  caption={z.batteries}
                />
                <Stat
                  value={String(result.sizing.panels)}
                  unit={'× ' + commercial.panel.watts + ' W'}
                  caption={
                    <>
                      <Ltr>{num(result.sizing.arrayKw)} kW</Ltr> {z.arrayCaption}
                    </>
                  }
                />
                <Stat value={String(result.sizing.inverterKw)} unit="kW" caption={z.inverter} />
              </div>

              <ul style={{ margin: '14px 0 0', paddingInlineStart: 18 }}>
                <Step
                  math={`${num(batteryKwh ?? 0)} ÷ ${commercial.batteryEfficiency} = ${num(result.sizing.grossKwh)} kWh → ÷ ${commercial.battery.kwhEach} = ${result.sizing.batteries}`}
                  note={z.steps.gross}
                />
                <Step
                  math={`${result.sizing.batteries} × ${commercial.battery.kwhEach} ÷ ${commercial.peakSunHours} h = ${num(result.sizing.chargeKw)} kW`}
                  note={z.steps.recharge}
                />
                <Step
                  math={`${num(dayLoadKw ?? 0)} + ${num(result.sizing.chargeKw)} = ${num(result.sizing.arrayNetKw)} kW ÷ ${commercial.systemEfficiency} = ${num(result.sizing.arrayKw)} kW → ÷ ${commercial.panel.watts} W = ${result.sizing.panels}`}
                  note={z.steps.array}
                />
                <Step
                  math={`${num(effectivePeak)} kW → ${result.sizing.inverterKw} kW`}
                  note={`${z.steps.inverter} (${z.loadPlusCharging} ${result.sizing.inverterKwWithCharging} kW)`}
                />
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
                {copied ? t.common.copied : t.common.copy}
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
                  {z.checkBeforeQuoting}
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
                    <li key={f}>{t.labels.flag[f]}</li>
                  ))}
                </ul>
              </div>
            )}

            {build && (
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
                <div style={sectionTitle}>{z.partsList}</div>
                {/*
                  The table scrolls inside its card rather than bursting out of
                  it — four nowrap columns do not fit 390px.
                */}
                <div className="admin-scroll-x">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thText, ...compactTh, paddingInlineStart: 0 }}>{z.cols.item}</th>
                        <th style={{ ...thNum, ...compactTh }}>{z.cols.qty}</th>
                        <th style={{ ...thNum, ...compactTh }}>{z.cols.unit}</th>
                        <th style={{ ...thNum, ...compactTh, paddingInlineEnd: 0 }}>{z.cols.total}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {build.lines.map((l) => (
                        <tr key={l.name}>
                          <td style={{ ...tdText, ...compact, paddingInlineStart: 0, borderBottom: 'none', borderTop: `1px solid ${C.border}` }}>
                            <Auto>{l.name}</Auto>
                          </td>
                          <TdNum style={{ ...compact, borderBottom: 'none', borderTop: `1px solid ${C.border}` }}>
                            {l.qty}
                          </TdNum>
                          {l.unitLyd === null ? (
                            <td
                              style={{
                                ...tdNum,
                                ...compact,
                                borderBottom: 'none',
                                borderTop: `1px solid ${C.border}`,
                                color: C.amber,
                                fontWeight: 600,
                              }}
                            >
                              {z.noPrice}
                            </td>
                          ) : (
                            <TdNum style={{ ...compact, borderBottom: 'none', borderTop: `1px solid ${C.border}` }}>
                              {fmtNum(l.unitLyd)}
                            </TdNum>
                          )}
                          <TdNum
                            style={{
                              ...compact,
                              paddingInlineEnd: 0,
                              borderBottom: 'none',
                              borderTop: `1px solid ${C.border}`,
                              fontWeight: 600,
                              color: l.totalLyd === null ? C.faint : C.ink,
                            }}
                          >
                            {l.totalLyd === null ? t.common.dash : fmtNum(l.totalLyd)}
                          </TdNum>
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
                  <span style={{ fontSize: 13, color: C.muted }}>{z.pricedRounded}</span>
                  <Money n={build.totalLyd} style={{ fontSize: 20, fontWeight: 700, color: C.ink }} />
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
                    {plural(build.unpricedComponents.length, z.unpricedNote, lang)}{' '}
                    {build.unpricedComponents.map((n, i) => (
                      <span key={n}>
                        {i > 0 && (lang === 'ar' ? '، ' : ', ')}
                        <Auto>{n}</Auto>
                      </span>
                    ))}
                    . {z.unpricedHint}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ ...label, lineHeight: 1.6 }}>
          {z.method}: <Ltr>{commercial.batteryEfficiency}</Ltr> {z.methodParts.batteryEff} ·{' '}
          <Ltr>{commercial.systemEfficiency}</Ltr> {z.methodParts.systemEff} ·{' '}
          <Ltr>{commercial.peakSunHours}</Ltr> {z.methodParts.sunHours} ·{' '}
          <Ltr>{commercial.panel.watts}</Ltr> {z.methodParts.panels} ·{' '}
          <Ltr>{commercial.battery.kwhEach}</Ltr> {z.methodParts.batteries}.
          {usingBundledMethod ? ' ' + z.builtInFigures : ''}
          {source === 'bundled' ? ' ' + z.builtInPrices : ''}
        </div>
      </div>
    </MobileContext.Provider>
  )
}
