import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { C, cardStyle } from '../theme'
import { formatPhoneE164 } from '../logic'
import type { EngineResult } from '../pricing/types'
import type { FormData } from '../types'
import { Auto, Ltr, Money, TdNum, tdNum, tdText, thNum, thText } from './controls'
import { isDemoMode } from './demoClient'
import { fmtDateTime, fmtNum, fmtRelative, plural } from './format'
import { lookup, useAdminLang } from './i18n'
import type { AdminStrings } from './strings'
import type { Lang, Strings } from '../i18n'
import { supabase } from './supabaseClient'
import { useIsMobile } from './useIsMobile'

type LeadRow = {
  id: string
  created_at: string
  name: string
  whatsapp: string
  city: string
  property_type: string
  lang: string
  config_version: string
  tier: string
  price_from: number | null
  is_custom: boolean
  confidence: string
}

type LeadDetail = { form: FormData; result: EngineResult }

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 999,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
}

const leadCardStyle: React.CSSProperties = {
  background: C.white,
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
}

/** wa.me wants digits only, with the country code exactly once. */
const waHref = (raw: string) => 'https://wa.me/' + formatPhoneE164(raw).replace(/\D/g, '')

/**
 * RFC 4180 quoting, plus neutralisation of spreadsheet formulas.
 *
 * `name` and `city` are free text from an anonymous, unauthenticated endpoint,
 * and this export is opened in Excel (hence the BOM below). A lead submitted
 * as `=HYPERLINK("http://evil/","Invoice")` used to land in the file verbatim
 * and Excel would offer to run it — a remote attack that only needed someone
 * on the sales team to click Export. Prefixing with an apostrophe makes the
 * cell inert text while still displaying the original characters.
 */
function csvEscape(v: unknown): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  // \r matters as well as \n: rows are joined with \n, so a lone carriage
  // return in a name used to corrupt the row structure for strict parsers.
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/**
 * The export follows the UI language for its headers and its labels, so an
 * Arabic team gets an Arabic spreadsheet. The price stays a bare number for
 * Excel; the filename stays ASCII.
 */
function exportCsv(rows: LeadRow[], lang: Lang, t: AdminStrings, opt: Strings['opt']) {
  const c = t.csv
  const header = [
    c.date,
    c.name,
    c.whatsapp,
    c.city,
    c.property,
    c.language,
    c.tier,
    c.priceLyd,
    c.custom,
    c.confidence,
    c.pricingRef,
  ]
  const lines = rows.map((r) =>
    [
      fmtDateTime(r.created_at, lang),
      r.name,
      formatPhoneE164(r.whatsapp),
      r.city,
      lookup(opt.property, r.property_type),
      lookup(t.common.langName, r.lang),
      lookup(t.labels.tier, r.tier),
      r.price_from ?? '',
      r.is_custom ? t.common.yes : t.common.no,
      lookup(t.labels.confidence, r.confidence),
      r.config_version,
    ]
      .map(csvEscape)
      .join(','),
  )
  // BOM prefix so Excel opens Arabic text correctly.
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'alqema-leads-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ----------------------------------------------------------------- layout */

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  )
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: 'amber' | 'green'
  title?: string
  children: ReactNode
}) {
  const fg = tone === 'amber' ? C.amber : C.green
  const bg = tone === 'amber' ? C.amberTint : C.greenTint
  return (
    <div
      style={{
        background: bg,
        borderInlineStart: `3px solid ${fg}`,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{title}</div>}
      <ul style={{ margin: title ? '6px 0 0' : 0, paddingInlineStart: 18, fontSize: 13, color: C.body }}>
        {children}
      </ul>
    </div>
  )
}

/**
 * Key/value row. Stacks on a phone; two columns on a desktop.
 *
 * The value is a plain block that follows the document direction. Callers
 * wrap customer-typed text in `<Auto>` and figures in `<Ltr>`; putting `dir`
 * on the block itself is what used to fling Arabic values to the far edge.
 */
function KV({ label, value }: { label: string; value: ReactNode }) {
  const isMobile = useIsMobile()
  if (isMobile) {
    // A 130px label against a 190px value produced two words per line. The
    // value gets the full width instead.
    return (
      <div style={{ padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>{label}</div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: C.ink,
            marginTop: 2,
            textAlign: 'start',
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </div>
      </div>
    )
  }
  // Adjacent columns. `space-between` used to fling the label and value to
  // opposite ends of a 1060px card with nothing connecting them.
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, fontSize: 13.5, padding: '3px 0' }}
    >
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.body, fontWeight: 600, textAlign: 'start', overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </div>
  )
}

/** "12,000 BTU · 8h · nights" — parts joined by a neutral separator. */
function Dots({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  return (
    <>
      {shown.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </>
  )
}

/* ------------------------------------------------------------- lead card */

function LeadCard({
  row,
  open,
  onOpen,
}: {
  row: LeadRow
  open: boolean
  onOpen: (row: LeadRow, trigger: HTMLElement) => void
}) {
  const { t, lang } = useAdminLang()
  const isSurvey = row.tier === 'SURVEY'

  return (
    <li style={{ ...leadCardStyle, outline: open ? `2px solid ${C.red}` : 'none' }}>
      {/*
        Two separate targets, never nested. The old pattern was a div with
        onClick wrapping an anchor with stopPropagation, which mis-taps on a
        phone and is invisible to a keyboard.
      */}
      <button
        className="admin-focusable"
        onClick={(e) => onOpen(row, e.currentTarget)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'start',
          background: open ? C.canvas : 'transparent',
          border: 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {/* The flex item is a plain block; `dir` sits on the inline name
              inside it, so an English name in an Arabic panel still starts
              at the start edge instead of hugging the timestamp. */}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              fontWeight: 700,
              color: C.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'start',
            }}
          >
            <Auto>{row.name}</Auto>
          </span>
          <span style={{ flex: 'none', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
            {fmtRelative(row.created_at, lang)}
          </span>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}
        >
          {isSurvey ? (
            // A dash here reads like a bug. This is a deliberate outcome, so
            // it says so.
            <span
              style={{ ...pill, background: C.amberTint, color: C.amber, fontSize: 12.5, padding: '5px 10px' }}
            >
              {t.leads.siteVisitNoPrice}
            </span>
          ) : (
            <Money n={row.price_from} style={{ fontSize: 19, fontWeight: 700, color: C.ink }} />
          )}
          <span style={{ ...pill, background: C.canvas, color: C.body, border: `1px solid ${C.border}` }}>
            {lookup(t.labels.tier, row.tier)}
          </span>
          {/* Only when it adds information — the tier is already "Custom". */}
          {row.is_custom && row.tier !== 'CUSTOM' && (
            <span style={{ ...pill, background: C.redTint, color: C.red }}>{t.leads.customPill}</span>
          )}
          {row.confidence === 'low' && (
            <span style={{ ...pill, background: C.amberTint, color: C.amber }}>
              {t.leads.lowConfidencePill}
            </span>
          )}
        </div>

        {/*
          No `dir` on this line. The city is an isolate, so it is one opaque
          token to the surrounding text whatever its script, and the field
          order follows the panel's language — the same on every row.
        */}
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
          <Dots
            parts={[
              row.city ? <Auto>{row.city}</Auto> : null,
              lookup(t.labels.propertyShort, row.property_type),
              lookup(t.common.langName, row.lang),
            ]}
          />
        </div>
      </button>

      <a
        className="admin-focusable"
        href={waHref(row.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 46,
          borderTop: `1px solid ${C.border}`,
          background: C.greenTint,
          color: C.green,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        {/* The number is shown, not just an icon: staff read it aloud. */}
        {t.leads.whatsapp} <Ltr>{formatPhoneE164(row.whatsapp)}</Ltr>
      </a>
    </li>
  )
}

/* ----------------------------------------------------------------- detail */

function Detail({ lead }: { lead: LeadRow }) {
  const isMobile = useIsMobile()
  const { t, opt, units, lang } = useAdminLang()
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setDetail(null)
    setErr('')
    supabase
      .from('leads')
      .select('form, result')
      .eq('id', lead.id)
      .single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setErr(error.message)
        else setDetail(data as unknown as LeadDetail)
      })
    return () => {
      alive = false
    }
  }, [lead.id])

  if (err) {
    return (
      <div dir="auto" style={{ color: C.red, fontSize: 13.5, textAlign: 'start' }}>
        {err}
      </div>
    )
  }
  if (!detail) return <div style={{ color: C.muted, fontSize: 13.5 }}>{t.common.loading}</div>

  const { form, result } = detail
  const d = t.detail
  const specs = result.specs
  const hasNotes = result.warnings.length > 0 || result.assumptionsMade.length > 0
  const dash = t.common.dash

  return (
    <>
      {/* What was quoted — first, because it is the first thing said on the call. */}
      <Section title={d.recommendedSystem}>
        {specs ? (
          <>
            <KV
              label={d.inverter}
              value={
                <>
                  <Ltr>{specs.inverter.kva} kVA</Ltr> (<Ltr>{specs.inverter.kw} kW</Ltr>)
                </>
              }
            />
            <KV
              label={d.panels}
              value={
                <>
                  <Ltr>
                    {specs.panels.count} × {specs.panels.watts} W
                  </Ltr>{' '}
                  — <Ltr>{specs.panels.kwp} kWp</Ltr>
                </>
              }
            />
            <KV
              label={d.battery}
              value={
                <Dots
                  parts={[
                    d.chemistry[specs.battery.chemistry],
                    <>
                      <Ltr>{specs.battery.nominalKwh} kWh</Ltr> (<Ltr>{specs.battery.usableKwh}</Ltr>{' '}
                      {d.usable})
                    </>,
                    <>
                      <Ltr>{specs.battery.lifespanYears}</Ltr> {d.yearsShort}
                    </>,
                  ]}
                />
              }
            />
            <KV
              label={d.nightRuntime}
              value={
                result.runtimeHours === null ? (
                  d.noNightLoad
                ) : (
                  <>
                    <Ltr>{result.runtimeHours}</Ltr> {units.h}
                  </>
                )
              }
            />
          </>
        ) : (
          <Callout tone="amber" title={d.surveyTitle}>
            <li>{d.surveyBody}</li>
          </Callout>
        )}
      </Section>

      {(result.confidence === 'low' || hasNotes) && (
        <Callout tone="amber" title={result.confidence === 'low' ? d.lowConfidenceTitle : d.notesTitle}>
          {result.warnings.map((w) => (
            <li key={w}>{t.labels.warning[w] ?? w}</li>
          ))}
          {result.assumptionsMade.length > 0 && (
            <li>
              {d.assumed}: {result.assumptionsMade.map((a) => t.labels.assumption[a] ?? a).join(lang === 'ar' ? '، ' : ', ')}
            </li>
          )}
        </Callout>
      )}

      {/* Which arm priced it, so a large quote's provenance is on the record. */}
      <div style={{ fontSize: 12.5, color: C.muted }}>
        {d.sizingMethod}: {d.method[result.sizingMethod ?? 'packages']}
      </div>
      {(result.commercialFlags?.length ?? 0) > 0 && (
        <Callout tone="amber" title={d.engineeringNotes}>
          {result.commercialFlags.map((f) => (
            <li key={f}>{t.labels.flag[f]}</li>
          ))}
        </Callout>
      )}

      {result.constraintsBinding.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.muted }}>
          {d.sizedBy}:{' '}
          {result.constraintsBinding
            .map((c) => t.labels.constraint[c] ?? c)
            .join(lang === 'ar' ? '، ' : ', ')}
        </div>
      )}

      <Section title={d.customer}>
        <KV
          label={d.phone}
          value={
            <a
              className="admin-focusable"
              href={'tel:' + formatPhoneE164(lead.whatsapp)}
              style={{
                // Inline text is a 16px-tall tap target; padding brings it to
                // the 44px floor without turning it into a button.
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 2px',
                fontWeight: 700,
              }}
            >
              <Ltr>{formatPhoneE164(lead.whatsapp)}</Ltr>
            </a>
          }
        />
        <KV label={d.city} value={lead.city ? <Auto>{lead.city}</Auto> : dash} />
        <KV
          label={d.property}
          value={
            lead.property_type === 'Other' ? (
              <>
                {d.otherPrefix}
                {form.propertyOther ? <Auto>{form.propertyOther}</Auto> : d.unspecified}
              </>
            ) : (
              lookup(opt.property, lead.property_type) || dash
            )
          }
        />
        {/* Decides which language you open the call in. */}
        <KV label={d.language} value={lookup(t.common.langName, lead.lang)} />
      </Section>

      <Section title={d.answers}>
        <KV label={d.dailyCuts} value={lookup(opt.outage, form.outageHours) || dash} />
        <KV label={d.keepRunning} value={lookup(opt.operation, form.operation) || dash} />
        <KV label={d.nightEconomy} value={lookup(opt.nightEconomyFull, form.nightEconomy) || dash} />
        <KV label={d.acUnits} value={<Ltr>{form.acUnits.length}</Ltr>} />
        {form.acUnits.map((u, i) => (
          <KV
            key={u.id ?? i}
            label={d.ac(String(i + 1))}
            value={
              <Dots
                parts={[
                  u.dontKnow ? d.unknownSize : <Ltr>{lookup(opt.acCapacity, u.capValue) || u.capValue + ' BTU'}</Ltr>,
                  <>
                    <Ltr>{u.hours}</Ltr>
                    {units.h}
                  </>,
                  u.night ? d.nights : null,
                  u.inverter ? d.inverterAc + ': ' + lookup(opt.inverter, u.inverter) : null,
                ]}
              />
            }
          />
        ))}
        <KV
          label={d.fridge}
          value={
            form.fridge.on ? (
              <Dots parts={[<Ltr>{form.fridge.qty}</Ltr>, form.fridge.alwaysOn ? d.alwaysOn : null]} />
            ) : (
              t.common.no
            )
          }
        />
        <KV
          label={d.freezer}
          value={
            form.freezer.on ? (
              <Dots parts={[<Ltr>{form.freezer.qty}</Ltr>, form.freezer.alwaysOn ? d.alwaysOn : null]} />
            ) : (
              t.common.no
            )
          }
        />
        <KV
          label={d.lighting}
          value={
            <>
              {plural(form.lighting.count, d.bulbs, lang)} ({lookup(opt.bulb, form.lighting.type) || dash})
            </>
          }
        />
        {form.appliances.map((a) => (
          <KV
            key={a.id}
            label={a.name ? lookup(opt.preset, a.name) : d.customDevice}
            value={<Ltr>× {a.qty}</Ltr>}
          />
        ))}
        <KV label={d.systemType} value={lookup(opt.system, form.systemType) || dash} />
        <KV
          label={d.cutPriority}
          value={
            form.priority ? (
              <>
                {lookup(opt.priority, form.priority)}
                {form.priority === 'essentials_ac' && (
                  <>
                    {' '}
                    (<Ltr>{form.priorityAcCount}</Ltr>)
                  </>
                )}
              </>
            ) : (
              dash
            )
          }
        />
        <KV
          label={d.roof}
          value={
            <Dots
              parts={[
                lookup(opt.roof, form.roofSpace) || dash,
                d.shade + ': ' + (lookup(opt.shade, form.roofShade) || dash),
              ]}
            />
          }
        />
      </Section>

      {/* The customer's own words, in their own script. Out of KV because it
          can run to several hundred characters. `plaintext` resolves each
          paragraph's direction on its own, where `dir="auto"` decides once for
          the whole block. */}
      {form.notes && (
        <Section title={d.customerNotes}>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: C.ink,
              background: C.canvas,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
              whiteSpace: 'pre-wrap',
              unicodeBidi: 'plaintext',
              textAlign: 'start',
            }}
          >
            {form.notes}
          </div>
        </Section>
      )}

      <Section
        title={
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0 8px', alignItems: 'baseline' }}>
            <span>{d.loadAudit}</span>
            <span style={{ fontWeight: 500, color: C.muted, fontSize: 12.5 }}>
              <Dots
                parts={[
                  <>
                    <Ltr>{result.dailyKwh}</Ltr> {d.perDay}
                  </>,
                  <>
                    <Ltr>{result.nightKwh}</Ltr> {d.nightKwh}
                  </>,
                  <>
                    <Ltr>{result.peakKw}</Ltr> {d.peakKw}
                  </>,
                ]}
              />
            </span>
          </span>
        }
      >
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.loads.map((l) => (
              <div key={l.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink, textAlign: 'start' }}>
                    <Auto>{l.label}</Auto>
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: C.body }}>
                    <Ltr>
                      {l.watts} W × {l.qty}
                    </Ltr>
                  </span>
                </div>
                <div
                  style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}
                >
                  <span style={{ fontSize: 12, color: C.muted }}>
                    <Ltr>{l.hoursPerDay}</Ltr> {d.hoursPerDay}
                  </span>
                  {(l.runAtNight || l.alwaysOn) && (
                    <span style={{ ...pill, background: C.canvas, color: C.body }}>{d.nightPill}</span>
                  )}
                  {/* Visual link back to the confidence callout above. */}
                  {l.assumed && (
                    <span style={{ ...pill, background: C.amberTint, color: C.amber }}>{d.assumedPill}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-scroll-x">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thText}>{d.loadCols.load}</th>
                  <th style={thNum}>{d.loadCols.avgW}</th>
                  <th style={thNum}>{d.loadCols.peakW}</th>
                  <th style={thNum}>{d.loadCols.qty}</th>
                  <th style={thNum}>{d.loadCols.hoursPerDay}</th>
                  <th style={{ ...thText, textAlign: 'center' }}>{d.loadCols.night}</th>
                  <th style={{ ...thText, textAlign: 'center' }}>{d.loadCols.assumed}</th>
                </tr>
              </thead>
              <tbody>
                {result.loads.map((l) => (
                  <tr key={l.id}>
                    <td style={tdText}>
                      <Auto>{l.label}</Auto>
                    </td>
                    {/* Labelled "Avg W": these are duty-cycle averages, and
                        showing them under a bare "W" made a 60 W fridge look
                        like its nameplate rating to an engineer. */}
                    <TdNum>{l.watts}</TdNum>
                    <TdNum>{l.peakWatts}</TdNum>
                    <TdNum>{l.qty}</TdNum>
                    <TdNum>{l.hoursPerDay}</TdNum>
                    <td style={{ ...tdText, textAlign: 'center' }}>{l.runAtNight || l.alwaysOn ? '✓' : ''}</td>
                    <td style={{ ...tdText, textAlign: 'center' }}>{l.assumed ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {result.customBuild && (
        <Section title={d.customBuild}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.customBuild.lines.map((l) => (
                <div key={l.name} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, textAlign: 'start' }}>
                      <Auto>{l.name}</Auto>
                    </span>
                    <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: C.ink }}>
                      <Ltr>{fmtNum(l.totalLyd)}</Ltr>
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    <Ltr>
                      {l.qty} × {fmtNum(l.unitLyd)}
                    </Ltr>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-scroll-x">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={thText}>{d.bomCols.component}</th>
                    <th style={thNum}>{d.bomCols.qty}</th>
                    <th style={thNum}>{d.bomCols.unit}</th>
                    <th style={thNum}>{d.bomCols.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.customBuild.lines.map((l) => (
                    <tr key={l.name}>
                      <td style={tdText}>
                        <Auto>{l.name}</Auto>
                      </td>
                      <TdNum>{l.qty}</TdNum>
                      <TdNum>{fmtNum(l.unitLyd)}</TdNum>
                      <TdNum>{fmtNum(l.totalLyd)}</TdNum>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* `totalLyd` — what the customer was actually shown — was never
              rendered anywhere; only the parts subtotal was. */}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: C.muted }}>
              {d.partsSubtotal} <Money n={result.customBuild.subtotalLyd} />
            </span>
            <span style={{ fontWeight: 700, color: C.ink }}>
              {d.quoted} <Money n={result.priceFrom} />
            </span>
            {result.customBuild.floorApplied && (
              <span style={{ ...pill, background: C.amberTint, color: C.amber }}>{d.floorApplied}</span>
            )}
          </div>
        </Section>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ sheet */

function LeadSheet({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const isMobile = useIsMobile()
  const { t, lang } = useAdminLang()
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus moves into the dialog so Esc has a target and a screen reader isn't
  // left reading the list behind it.
  useEffect(() => {
    closeRef.current?.focus()
  }, [lead.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)' }}
      />
      {/*
        `position: fixed` is the whole answer to the old bug where the detail
        rendered as a sibling after the table and therefore appeared thousands
        of pixels below the viewport with lead #500 open. A fixed element is
        laid out against the viewport, so its position in the DOM is
        irrelevant — no scrollIntoView needed, and it behaves identically at
        both breakpoints.

        It anchors to the INLINE-END edge: the right in English, the left in
        Arabic, where the eye finishes reading the row that opened it. The
        shadow is symmetric so it does not encode a side.

        Caveat: if any ancestor ever gains a transform/filter/will-change it
        becomes the containing block and this breaks. Switch to a portal then.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-sheet-title"
        style={{
          position: 'fixed',
          zIndex: 71,
          background: C.white,
          display: 'flex',
          flexDirection: 'column',
          ...(isMobile
            ? { inset: 0 }
            : {
                top: 0,
                bottom: 0,
                insetInlineEnd: 0,
                width: 'min(560px, 100vw)',
                boxShadow: '0 0 32px rgba(0,0,0,0.18)',
              }),
        }}
      >
        <div
          style={{
            flex: 'none',
            borderBottom: `1px solid ${C.border}`,
            padding: isMobile ? '10px 14px 12px' : '14px 20px',
            paddingTop: isMobile ? 'calc(10px + env(safe-area-inset-top))' : 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Rendered from the row we already hold, so it appears before
                  the form/result fetch resolves — the old panel showed a bare
                  "Loading…" with no clue whose lead you had opened. */}
              <div
                id="lead-sheet-title"
                style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.3, textAlign: 'start' }}
              >
                <Auto>{lead.name}</Auto>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                <Dots
                  parts={[
                    <Ltr>{fmtDateTime(lead.created_at, lang)}</Ltr>,
                    <>
                      {t.leads.ref} <Ltr>{lead.config_version}</Ltr>
                    </>,
                  ]}
                />
              </div>
            </div>
            <button
              ref={closeRef}
              className="admin-focusable"
              onClick={onClose}
              aria-label={t.leads.closeLead}
              style={{
                flex: 'none',
                width: 44,
                height: 44,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: C.body,
                fontSize: 20,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {lead.tier === 'SURVEY' ? (
              <span style={{ ...pill, background: C.amberTint, color: C.amber, fontSize: 12.5 }}>
                {t.leads.siteVisitNoPrice}
              </span>
            ) : (
              <Money n={lead.price_from} style={{ fontSize: 20, fontWeight: 700, color: C.ink }} />
            )}
            <span style={{ ...pill, background: C.canvas, color: C.body, border: `1px solid ${C.border}` }}>
              {lookup(t.labels.tier, lead.tier)}
            </span>
            {lead.is_custom && lead.tier !== 'CUSTOM' && (
              <span style={{ ...pill, background: C.redTint, color: C.red }}>{t.leads.customPill}</span>
            )}
            {isDemoMode() && (
              <span style={{ ...pill, background: C.amberTint, color: C.amber }}>{t.leads.demoPill}</span>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            padding: isMobile ? 14 : '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <Detail lead={lead} />
        </div>

        <a
          className="admin-focusable"
          href={waHref(lead.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 50,
            background: C.green,
            color: C.white,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
            borderTop: `1px solid ${C.border}`,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {t.leads.whatsapp} <Ltr>{formatPhoneE164(lead.whatsapp)}</Ltr>
        </a>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------- list */

function EmptyState() {
  const { t } = useAdminLang()
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{t.leads.emptyTitle}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{t.leads.emptyBody}</div>
    </div>
  )
}

/** How many cards to render before the "show more" button, on mobile. */
const PAGE = 50

export function Submissions() {
  const isMobile = useIsMobile()
  const { t, opt, lang } = useAdminLang()
  const [rows, setRows] = useState<LeadRow[]>([])
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<LeadRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(PAGE)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    supabase
      .from('leads')
      .select(
        'id, created_at, name, whatsapp, city, property_type, lang, config_version, tier, price_from, is_custom, confidence',
      )
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else setRows((data as LeadRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  const openLead = useCallback((row: LeadRow, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setOpen(row)
  }, [])

  const closeLead = useCallback(() => {
    setOpen(null)
    // Return focus to whatever opened the sheet.
    triggerRef.current?.focus()
  }, [])

  if (loading) return <div style={{ color: C.muted, padding: 20 }}>{t.leads.loadingList}</div>
  if (err) {
    return (
      <div dir="auto" style={{ color: C.red, padding: 20, textAlign: 'start' }}>
        {err}
      </div>
    )
  }

  const shown = isMobile ? rows.slice(0, visible) : rows

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 0 }}>
          {plural(rows.length, t.leads.count, lang)}
        </div>
        <button
          className="admin-focusable"
          // NOTE: always the full `rows`, never the sliced view.
          onClick={() => exportCsv(rows, lang, t, opt)}
          disabled={rows.length === 0}
          style={{
            flex: 'none',
            minHeight: 44,
            minWidth: 44,
            padding: '0 16px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            color: C.body,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
        >
          {t.leads.exportCsv}
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={cardStyle}>
          <EmptyState />
        </div>
      ) : isMobile ? (
        <>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {shown.map((r) => (
              <LeadCard key={r.id} row={r} open={open?.id === r.id} onOpen={openLead} />
            ))}
          </ul>
          {visible < rows.length && (
            <button
              className="admin-focusable"
              onClick={() => setVisible((v) => v + PAGE)}
              style={{
                minHeight: 44,
                width: '100%',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: C.body,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.leads.showMore(fmtNum(PAGE), fmtNum(rows.length - visible))}
            </button>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, padding: 0 }} className="admin-scroll-x">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thText}>{t.leads.cols.when}</th>
                <th style={thText}>{t.leads.cols.name}</th>
                <th style={thText}>{t.leads.cols.whatsapp}</th>
                <th style={thText}>{t.leads.cols.city}</th>
                <th style={thText}>{t.leads.cols.property}</th>
                <th style={thText}>{t.leads.cols.lang}</th>
                <th style={thText}>{t.leads.cols.tier}</th>
                <th style={thNum}>{t.leads.cols.price}</th>
                <th style={thText}>{t.leads.cols.confidence}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  // The row is the trigger, so it has to be reachable and
                  // activatable by keyboard — it was neither before.
                  tabIndex={0}
                  role="button"
                  aria-label={t.leads.openLead(r.name)}
                  onClick={(e) => openLead(r, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openLead(r, e.currentTarget)
                    }
                  }}
                  style={{ cursor: 'pointer', background: open?.id === r.id ? C.canvas : undefined }}
                >
                  <td style={{ ...tdText, whiteSpace: 'nowrap' }} title={fmtDateTime(r.created_at, lang)}>
                    {fmtRelative(r.created_at, lang)}
                  </td>
                  <td style={{ ...tdText, fontWeight: 600, color: C.ink }}>
                    <Auto>{r.name}</Auto>
                  </td>
                  <td style={{ ...tdText, whiteSpace: 'nowrap' }}>
                    <a
                      href={waHref(r.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      // A bare link was a 16px target inside a 44px row.
                      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
                    >
                      <Ltr>{formatPhoneE164(r.whatsapp)}</Ltr>
                    </a>
                  </td>
                  <td style={tdText}>
                    <Auto>{r.city}</Auto>
                  </td>
                  <td style={{ ...tdText, whiteSpace: 'nowrap' }}>
                    {lookup(t.labels.propertyShort, r.property_type)}
                  </td>
                  <td style={{ ...tdText, whiteSpace: 'nowrap' }}>{lookup(t.common.langName, r.lang)}</td>
                  <td style={{ ...tdText, whiteSpace: 'nowrap' }}>
                    {lookup(t.labels.tier, r.tier)}
                    {r.is_custom && r.tier !== 'CUSTOM' && (
                      <span style={{ ...pill, marginInlineStart: 6, background: C.redTint, color: C.red }}>
                        {t.leads.customPill}
                      </span>
                    )}
                  </td>
                  {/* `<Money>` rather than `<TdNum>`: only the figure is isolated,
                      so the currency word follows the document like everywhere else. */}
                  <td style={tdNum} data-num="">
                    <Money n={r.price_from} />
                  </td>
                  <td
                    style={{
                      ...tdText,
                      whiteSpace: 'nowrap',
                      color: r.confidence === 'low' ? C.amber : C.green,
                    }}
                  >
                    {lookup(t.labels.confidence, r.confidence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <LeadSheet lead={open} onClose={closeLead} />}
    </div>
  )
}
