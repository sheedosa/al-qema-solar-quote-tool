import { useCallback, useEffect, useRef, useState } from 'react'
import { C, cardStyle } from '../theme'
import { formatPhoneE164 } from '../logic'
import type { AssumptionId, ConstraintId, EngineResult, WarningId } from '../pricing/types'
import type { FormData } from '../types'
import { isDemoMode } from './demoClient'
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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: C.muted,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  color: C.body,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
}

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 999,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
  letterSpacing: '0.02em',
}

const leadCardStyle: React.CSSProperties = {
  background: C.white,
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
}

/** Shortened property labels so the card's meta line stays one line at 390px. */
const PROPERTY_SHORT: Record<string, string> = {
  'Office / Company': 'Office',
  Home: 'Home',
  Shop: 'Shop',
  Clinic: 'Clinic',
  Workshop: 'Workshop',
  Other: 'Other',
}

/**
 * Admin-voice labels for the engine's ids.
 *
 * Deliberately NOT imported from i18n.tsx: those strings are customer-facing
 * reassurance ("our engineer will review them with you") and switch with the
 * customer's language. Staff need the terse version, in English, always.
 * Typing these as Record<Id, string> means a new id in pricing/types.ts is a
 * compile error here rather than a silently blank row.
 */
const WARNING_LABEL: Record<WarningId, string> = {
  heavyDutyLoad: 'Heavy appliance in the load list',
  acBtuExceeded: 'An AC exceeds this tier’s BTU cap',
  customFloorApplied: 'Priced at the custom-build floor, not the parts total',
  roofSpaceTight: 'Array may not fit the roof the customer described',
}

const ASSUMPTION_LABEL: Record<AssumptionId, string> = {
  acSizeAssumed: 'AC size (customer did not know)',
  lightingAssumed: 'Bulb wattage',
  customApplianceAssumed: 'Power of a custom device',
  usageHoursAssumed: 'Daily running hours',
}

/**
 * Why the customer landed on this size. Printed raw, these read as code
 * (`acCount`) to a salesperson; the sentence is "Sized by: number of ACs".
 */
const CONSTRAINT_LABEL: Record<ConstraintId, string> = {
  inverter: 'inverter power',
  battery: 'battery storage',
  panels: 'panel count',
  acCount: 'number of ACs',
  acBtu: 'AC size (BTU)',
}

const fmtPrice = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US') + ' LYD')
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { hour12: false })
const fmtNum = (n: number) => n.toLocaleString('en-US')

/**
 * "22 min ago" is the thing that decides which lead to phone first, and the
 * absolute timestamp never answered it. Falls back to the date past a week.
 */
function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + ' min ago'
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago')
  const days = Math.round(hours / 24)
  if (days <= 7) return days + (days === 1 ? ' day ago' : ' days ago')
  return new Date(iso).toLocaleDateString('en-GB')
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

function exportCsv(rows: LeadRow[]) {
  const header = [
    'Date',
    'Name',
    'WhatsApp',
    'City',
    'Property',
    'Language',
    'Tier',
    'Price (LYD)',
    'Custom',
    'Confidence',
    'Pricing ref',
  ]
  const lines = rows.map((r) =>
    [
      fmtDate(r.created_at),
      r.name,
      formatPhoneE164(r.whatsapp),
      r.city,
      r.property_type,
      r.lang,
      r.tier,
      r.price_from ?? '',
      r.is_custom ? 'yes' : 'no',
      r.confidence,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  children: React.ReactNode
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

/** Key/value row. Stacks on a phone; two columns on a desktop. */
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  const isMobile = useIsMobile()
  if (isMobile) {
    // A 130px label against a 190px value produced two words per line. The
    // value gets the full width instead.
    return (
      <div style={{ padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </div>
        {/*
          `dir="auto"` gets the bidi ordering right for an Arabic value, but it
          also makes the element RTL, which flung Arabic city names to the far
          edge while every English value sat at the left. The panel is LTR, so
          pin the alignment and let dir handle ordering only.
        */}
        <div
          dir="auto"
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: C.ink,
            marginTop: 2,
            textAlign: 'left',
            wordBreak: 'break-word',
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
      <span
        dir="auto"
        style={{ color: C.body, fontWeight: 600, textAlign: 'left', wordBreak: 'break-word' }}
      >
        {value}
      </span>
    </div>
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
  const isSurvey = row.tier === 'SURVEY'
  const metaTail = [
    PROPERTY_SHORT[row.property_type] ?? row.property_type,
    row.lang === 'ar' ? 'Arabic' : 'English',
  ]
    .filter(Boolean)
    .join(' · ')

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
          textAlign: 'left',
          background: open ? C.canvas : 'transparent',
          border: 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            dir="auto"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              fontWeight: 700,
              color: C.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.name}
          </span>
          <span style={{ flex: 'none', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
            {fmtRelative(row.created_at)}
          </span>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}
        >
          {isSurvey ? (
            // `fmtPrice(null)` renders "—", which reads like a bug. This is a
            // deliberate outcome, so it says so.
            <span
              style={{ ...pill, background: C.amberTint, color: C.amber, fontSize: 12.5, padding: '5px 10px' }}
            >
              Site visit — no price
            </span>
          ) : (
            <span style={{ fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              {fmtPrice(row.price_from)}
            </span>
          )}
          <span style={{ ...pill, background: C.canvas, color: C.body, border: `1px solid ${C.border}` }}>
            {row.tier}
          </span>
          {/* Only when it adds information — the tier is already "CUSTOM". */}
          {row.is_custom && row.tier !== 'CUSTOM' && (
            <span style={{ ...pill, background: C.redTint, color: C.red }}>custom</span>
          )}
          {row.confidence === 'low' && (
            <span style={{ ...pill, background: C.amberTint, color: C.amber }}>low confidence</span>
          )}
        </div>

        {/*
          dir="ltr" on the row, dir="auto" on the city only. With dir="auto" on
          the whole line, a row starting with an Arabic city name flipped the
          entire line's order, so the fields appeared in a different sequence
          on Arabic rows than on English ones.
        */}
        <div dir="ltr" style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
          {row.city && (
            <>
              <span dir="auto">{row.city}</span>
              {metaTail && ' · '}
            </>
          )}
          {metaTail}
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
        WhatsApp <span dir="ltr">{formatPhoneE164(row.whatsapp)}</span>
      </a>
    </li>
  )
}

/* ----------------------------------------------------------------- detail */

function Detail({ lead }: { lead: LeadRow }) {
  const isMobile = useIsMobile()
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

  if (err) return <div style={{ color: C.red, fontSize: 13.5 }}>{err}</div>
  if (!detail) return <div style={{ color: C.muted, fontSize: 13.5 }}>Loading…</div>

  const { form, result } = detail
  const specs = result.specs
  const hasNotes = result.warnings.length > 0 || result.assumptionsMade.length > 0

  return (
    <>
      {/* What was quoted — first, because it is the first thing said on the call. */}
      <Section title="Recommended system">
        {specs ? (
          <>
            <KV label="Inverter" value={`${specs.inverter.kva} kVA (${specs.inverter.kw} kW)`} />
            <KV
              label="Panels"
              value={`${specs.panels.count} × ${specs.panels.watts} W — ${specs.panels.kwp} kWp`}
            />
            <KV
              label="Battery"
              value={`${specs.battery.chemistry} · ${specs.battery.nominalKwh} kWh (${specs.battery.usableKwh} usable) · ${specs.battery.lifespanYears} yr`}
            />
            <KV
              label="Night runtime"
              value={result.runtimeHours === null ? 'no night load' : result.runtimeHours + ' h'}
            />
          </>
        ) : (
          <Callout tone="amber" title="Site survey required">
            <li>No system was sized and no price was quoted — this one is too large to price from the form.</li>
          </Callout>
        )}
      </Section>

      {(result.confidence === 'low' || hasNotes) && (
        <Callout
          tone="amber"
          title={result.confidence === 'low' ? 'Low confidence — check before quoting' : 'Notes'}
        >
          {result.warnings.map((w) => (
            <li key={w}>{WARNING_LABEL[w] ?? w}</li>
          ))}
          {result.assumptionsMade.length > 0 && (
            <li>
              Assumed: {result.assumptionsMade.map((a) => ASSUMPTION_LABEL[a] ?? a).join(', ')}
            </li>
          )}
        </Callout>
      )}

      {result.constraintsBinding.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.muted }}>
          Sized by: {result.constraintsBinding.map((c) => CONSTRAINT_LABEL[c] ?? c).join(', ')}
        </div>
      )}

      <Section title="Customer">
        <KV
          label="Phone"
          value={
            <a
              className="admin-focusable"
              href={'tel:' + formatPhoneE164(lead.whatsapp)}
              dir="ltr"
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
              {formatPhoneE164(lead.whatsapp)}
            </a>
          }
        />
        <KV label="City" value={lead.city || '—'} />
        <KV
          label="Property"
          value={
            lead.property_type === 'Other'
              ? 'Other — ' + (form.propertyOther || 'unspecified')
              : lead.property_type || '—'
          }
        />
        {/* Decides which language you open the call in. */}
        <KV label="Language" value={lead.lang === 'ar' ? 'Arabic (عربي)' : 'English'} />
      </Section>

      <Section title="Answers">
        <KV label="Daily cuts" value={form.outageHours || '—'} />
        <KV label="Keep running" value={form.operation || '—'} />
        <KV label="Night economy" value={form.nightEconomy || '—'} />
        <KV label="AC units" value={form.acUnits.length} />
        {form.acUnits.map((u, i) => (
          <KV
            key={u.id ?? i}
            label={'AC ' + (i + 1)}
            value={
              (u.dontKnow ? 'unknown size' : u.capValue + ' BTU') +
              ' · ' +
              u.hours +
              'h' +
              (u.night ? ' · nights' : '') +
              (u.inverter ? ' · inverter: ' + u.inverter : '')
            }
          />
        ))}
        <KV
          label="Fridge"
          value={form.fridge.on ? form.fridge.qty + (form.fridge.alwaysOn ? ' · always on' : '') : 'no'}
        />
        <KV
          label="Freezer"
          value={form.freezer.on ? form.freezer.qty + (form.freezer.alwaysOn ? ' · always on' : '') : 'no'}
        />
        <KV label="Lighting" value={form.lighting.count + ' bulbs (' + (form.lighting.type || '—') + ')'} />
        {form.appliances.map((a) => (
          <KV key={a.id} label={a.name || 'Custom device'} value={'× ' + a.qty} />
        ))}
        <KV label="System type" value={form.systemType} />
        <KV
          label="Cut priority"
          value={
            form.priority
              ? form.priority + (form.priority === 'essentials_ac' ? ' (' + form.priorityAcCount + ')' : '')
              : '—'
          }
        />
        <KV label="Roof" value={(form.roofSpace || '—') + ' · shade: ' + (form.roofShade || '—')} />
      </Section>

      {/* The customer's own words, in their own script. Out of KV because it
          can run to several hundred characters of Arabic. */}
      {form.notes && (
        <Section title="Customer notes">
          <div
            dir="auto"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: C.ink,
              background: C.canvas,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {form.notes}
          </div>
        </Section>
      )}

      <Section
        title={`Load audit (${result.dailyKwh} kWh/day · ${result.nightKwh} kWh night · ${result.peakKw} kW peak)`}
      >
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.loads.map((l) => (
              <div key={l.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span
                    dir="auto"
                    style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink }}
                  >
                    {l.label}
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, color: C.body }}>
                    {l.watts} W × {l.qty}
                  </span>
                </div>
                <div
                  style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}
                >
                  <span style={{ fontSize: 12, color: C.muted }}>{l.hoursPerDay} h/day</span>
                  {(l.runAtNight || l.alwaysOn) && (
                    <span style={{ ...pill, background: C.canvas, color: C.body }}>night</span>
                  )}
                  {/* Visual link back to the confidence callout above. */}
                  {l.assumed && (
                    <span style={{ ...pill, background: C.amberTint, color: C.amber }}>assumed</span>
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
                  <th style={th}>Load</th>
                  <th style={th}>Avg W</th>
                  <th style={th}>Peak W</th>
                  <th style={th}>Qty</th>
                  <th style={th}>h/day</th>
                  <th style={th}>Night</th>
                  <th style={th}>Assumed</th>
                </tr>
              </thead>
              <tbody>
                {result.loads.map((l) => (
                  <tr key={l.id}>
                    <td style={td}>{l.label}</td>
                    {/* Labelled "Avg W" now: these are duty-cycle averages, and
                        showing them under a bare "W" made a 60 W fridge look
                        like its nameplate rating to an engineer. */}
                    <td style={td}>{l.watts}</td>
                    <td style={td}>{l.peakWatts}</td>
                    <td style={td}>{l.qty}</td>
                    <td style={td}>{l.hoursPerDay}</td>
                    <td style={td}>{l.runAtNight || l.alwaysOn ? '✓' : ''}</td>
                    <td style={td}>{l.assumed ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {result.customBuild && (
        <Section title="Custom build (internal)">
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.customBuild.lines.map((l) => (
                <div key={l.name} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink }}>{l.name}</span>
                    <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: C.ink }}>
                      {fmtNum(l.totalLyd)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {l.qty} × {fmtNum(l.unitLyd)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-scroll-x">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={th}>Component</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Unit</th>
                    <th style={th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.customBuild.lines.map((l) => (
                    <tr key={l.name}>
                      <td style={td}>{l.name}</td>
                      <td style={td}>{l.qty}</td>
                      <td style={td}>{fmtNum(l.unitLyd)}</td>
                      <td style={td}>{fmtNum(l.totalLyd)}</td>
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
              Parts subtotal {fmtNum(result.customBuild.subtotalLyd)} LYD
            </span>
            <span style={{ fontWeight: 700, color: C.ink }}>
              Quoted {fmtPrice(result.priceFrom)}
            </span>
            {result.customBuild.floorApplied && (
              <span style={{ ...pill, background: C.amberTint, color: C.amber }}>floor applied</span>
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
                right: 0,
                bottom: 0,
                width: 'min(560px, 100vw)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
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
                dir="auto"
                style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}
              >
                {lead.name}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {fmtDate(lead.created_at)} · ref {lead.config_version}
              </div>
            </div>
            <button
              ref={closeRef}
              className="admin-focusable"
              onClick={onClose}
              aria-label="Close lead"
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
                Site visit — no price
              </span>
            ) : (
              <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>
                {fmtPrice(lead.price_from)}
              </span>
            )}
            <span style={{ ...pill, background: C.canvas, color: C.body, border: `1px solid ${C.border}` }}>
              {lead.tier}
            </span>
            {lead.is_custom && lead.tier !== 'CUSTOM' && (
              <span style={{ ...pill, background: C.redTint, color: C.red }}>custom</span>
            )}
            {isDemoMode() && (
              <span style={{ ...pill, background: C.amberTint, color: C.amber }}>DEMO DATA</span>
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
          WhatsApp <span dir="ltr">{formatPhoneE164(lead.whatsapp)}</span>
        </a>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------- list */

function EmptyState() {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>No submissions yet</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
        Leads appear here the moment a customer finishes the wizard.
      </div>
    </div>
  )
}

/** How many cards to render before the "show more" button, on mobile. */
const PAGE = 50

export function Submissions() {
  const isMobile = useIsMobile()
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

  if (loading) return <div style={{ color: C.muted, padding: 20 }}>Loading submissions…</div>
  if (err) return <div style={{ color: C.red, padding: 20 }}>{err}</div>

  const shown = isMobile ? rows.slice(0, visible) : rows

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 0 }}>
          {rows.length} submission{rows.length === 1 ? '' : 's'}
        </div>
        <button
          className="admin-focusable"
          // NOTE: always the full `rows`, never the sliced view.
          onClick={() => exportCsv(rows)}
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
          Export CSV
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
              Show {PAGE} more ({rows.length - visible} remaining)
            </button>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, padding: 0 }} className="admin-scroll-x">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Name</th>
                <th style={th}>WhatsApp</th>
                <th style={th}>City</th>
                <th style={th}>Property</th>
                <th style={th}>Lang</th>
                <th style={th}>Tier</th>
                <th style={th}>Price</th>
                <th style={th}>Confidence</th>
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
                  aria-label={'Open lead ' + r.name}
                  onClick={(e) => openLead(r, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openLead(r, e.currentTarget)
                    }
                  }}
                  style={{ cursor: 'pointer', background: open?.id === r.id ? C.canvas : undefined }}
                >
                  <td style={td} title={fmtDate(r.created_at)}>
                    {fmtRelative(r.created_at)}
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: C.ink }} dir="auto">
                    {r.name}
                  </td>
                  <td style={td}>
                    <a
                      href={waHref(r.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {formatPhoneE164(r.whatsapp)}
                    </a>
                  </td>
                  <td style={td} dir="auto">
                    {r.city}
                  </td>
                  <td style={td}>{PROPERTY_SHORT[r.property_type] ?? r.property_type}</td>
                  <td style={td}>{r.lang === 'ar' ? 'AR' : 'EN'}</td>
                  <td style={td}>
                    {r.tier}
                    {r.is_custom && (
                      <span style={{ ...pill, marginInlineStart: 6, background: C.redTint, color: C.red }}>
                        custom
                      </span>
                    )}
                  </td>
                  <td style={td}>{fmtPrice(r.price_from)}</td>
                  <td style={{ ...td, color: r.confidence === 'low' ? C.amber : C.green }}>
                    {r.confidence}
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
