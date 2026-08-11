import { useEffect, useState } from 'react'
import { C, cardStyle } from '../theme'
import type { EngineResult } from '../pricing/types'
import type { FormData } from '../types'
import { supabase } from './supabaseClient'

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

const fmtPrice = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US') + ' LYD')
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { hour12: false })

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
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
      r.whatsapp,
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

/** Key/value block used inside the detail panel. */
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13.5 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.body, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Detail({ id }: { id: string }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    supabase
      .from('leads')
      .select('form, result')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setErr(error.message)
        else setDetail(data as unknown as LeadDetail)
      })
    return () => {
      alive = false
    }
  }, [id])

  if (err) return <div style={{ color: C.red, fontSize: 13.5 }}>{err}</div>
  if (!detail) return <div style={{ color: C.muted, fontSize: 13.5 }}>Loading…</div>

  const { form, result } = detail
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Answers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <KV label="Daily cuts" value={form.outageHours || '—'} />
          <KV label="Keep running" value={form.operation || '—'} />
          <KV label="Night economy" value={form.nightEconomy || '—'} />
          <KV label="AC units" value={form.acUnits.length} />
          {form.acUnits.map((u, i) => (
            <KV
              key={i}
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
            value={
              form.freezer.on ? form.freezer.qty + (form.freezer.alwaysOn ? ' · always on' : '') : 'no'
            }
          />
          <KV
            label="Lighting"
            value={form.lighting.count + ' bulbs (' + (form.lighting.type || '—') + ')'}
          />
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
          {form.notes && <KV label="Notes" value={form.notes} />}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
          Load audit ({result.dailyKwh} kWh/day · {result.nightKwh} kWh night · {result.peakKw} kW
          peak)
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Load</th>
              <th style={th}>W</th>
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
                <td style={td}>{l.watts}</td>
                <td style={td}>{l.qty}</td>
                <td style={td}>{l.hoursPerDay}</td>
                <td style={td}>{l.runAtNight || l.alwaysOn ? '✓' : ''}</td>
                <td style={td}>{l.assumed ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.customBuild && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            Custom build (internal — subtotal {result.customBuild.subtotalLyd.toLocaleString('en-US')}{' '}
            LYD{result.customBuild.floorApplied ? ' · floor applied' : ''})
          </div>
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
                  <td style={td}>{l.unitLyd.toLocaleString('en-US')}</td>
                  <td style={td}>{l.totalLyd.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function Submissions() {
  const [rows, setRows] = useState<LeadRow[]>([])
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div style={{ color: C.muted, padding: 20 }}>Loading submissions…</div>
  if (err) return <div style={{ color: C.red, padding: 20 }}>{err}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
          {rows.length} submission{rows.length === 1 ? '' : 's'} (latest 500)
        </div>
        <button
          onClick={() => exportCsv(rows)}
          disabled={rows.length === 0}
          style={{
            minHeight: 38,
            padding: '0 16px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            color: C.body,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Name</th>
              <th style={th}>WhatsApp</th>
              <th style={th}>City</th>
              <th style={th}>Tier</th>
              <th style={th}>Price</th>
              <th style={th}>Confidence</th>
              <th style={th}>Ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                style={{ cursor: 'pointer', background: openId === r.id ? C.canvas : undefined }}
              >
                <td style={td}>{fmtDate(r.created_at)}</td>
                <td style={{ ...td, fontWeight: 600, color: C.ink }}>{r.name}</td>
                <td style={td}>
                  <a
                    href={'https://wa.me/218' + r.whatsapp.replace(/\D/g, '')}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.whatsapp}
                  </a>
                </td>
                <td style={td}>{r.city}</td>
                <td style={td}>
                  {r.tier}
                  {r.is_custom && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: C.redTint,
                        color: C.red,
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}
                    >
                      custom
                    </span>
                  )}
                </td>
                <td style={td}>{fmtPrice(r.price_from)}</td>
                <td style={{ ...td, color: r.confidence === 'low' ? C.amber : C.green }}>
                  {r.confidence}
                </td>
                <td style={{ ...td, fontSize: 12, color: C.faint }}>{r.config_version}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: C.muted }} colSpan={8}>
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <div style={{ ...cardStyle, padding: 20 }}>
          <Detail id={openId} />
        </div>
      )}
    </div>
  )
}
