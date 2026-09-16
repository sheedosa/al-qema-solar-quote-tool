/**
 * Shared form primitives for the admin panel.
 *
 * Lifted out of `PricingEditor` when the sizing calculator arrived and needed
 * the same controls: the number field's mobile behaviour is subtle enough
 * (see below) that a second copy would have drifted from it immediately.
 */
import { C, inputStyle } from '../theme'
import { useMobileValue } from './useIsMobile'

export const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 10,
}
export const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.muted }
export const numStyle: React.CSSProperties = {
  ...inputStyle,
  // 44px is the touch floor the rest of the admin now uses; this was 38.
  minHeight: 44,
  padding: '8px 12px',
}

export function Num({
  value,
  onChange,
  width = 110,
}: {
  value: number | null
  onChange: (n: number | null) => void
  width?: number
}) {
  const isMobile = useMobileValue()
  return (
    <input
      className="admin-input"
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Number(v))
      }}
      // `width` is the DESKTOP width only. On a phone every field fills its
      // column — a 110px input in a ~320px card left 200px of dead space, and
      // `inputStyle`'s own `width: 100%` was being defeated at ~40 call sites.
      //
      // fontSize is set HERE rather than in the .admin-input class: an inline
      // style beats a stylesheet rule, so the class could never win. iOS zooms
      // the whole page when a focused input is under 16px.
      style={{
        ...numStyle,
        width: isMobile ? '100%' : width,
        minWidth: 0,
        fontSize: isMobile ? 16 : 14,
      }}
    />
  )
}

export function Field({ name, children }: { name: string; children: React.ReactNode }) {
  // minWidth: 0 — without it a width:100% input inside a flex/grid item
  // overflows its track instead of shrinking.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={label}>{name}</span>
      {children}
    </div>
  )
}

/**
 * Hoisted out of `PricingEditor`'s body, where it was previously declared.
 *
 * A component declared inside another has a new function identity on every
 * render, so React treated each <select> as a different component TYPE and
 * unmounted/remounted its DOM node whenever anything in the config changed.
 * The visible symptom: an open dropdown snapped shut, and the select could
 * not hold focus. Passing `options` as a prop is what makes hoisting
 * possible — the closure over the component list was the reason it was inline.
 */
export function ComponentSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (name: string) => void
}) {
  const isMobile = useMobileValue()
  return (
    <select
      className="admin-input admin-focusable"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...numStyle,
        width: isMobile ? '100%' : 190,
        minWidth: 0,
        background: C.white,
        fontSize: isMobile ? 16 : 14,
      }}
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}
