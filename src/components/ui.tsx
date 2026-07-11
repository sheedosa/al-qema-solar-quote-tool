import type { CSSProperties, ReactNode } from 'react'
import { C, cardStyle } from '../theme'

/** White rounded card surface. */
export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>
}

/** Small red checkmark used to indicate a selected option. */
export function Check({ size = 16, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.red}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/** Shared selected/unselected pill styling for choice buttons. */
export function selBg(sel: boolean): CSSProperties {
  return {
    background: sel ? C.redTint : C.white,
    border: `1.5px solid ${sel ? C.red : C.border}`,
    color: sel ? C.red : C.body,
  }
}

/**
 * A choice button that shows a check on the right when selected.
 * Used for single-select lists across the wizard.
 */
export function CheckOption({
  label,
  selected,
  onClick,
  style,
}: {
  label: ReactNode
  selected: boolean
  onClick: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        minHeight: 48,
        padding: '10px 16px',
        borderRadius: 12,
        ...selBg(selected),
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'start',
        width: '100%',
        ...style,
      }}
    >
      {label}
      <Check opacity={selected ? 1 : 0} />
    </button>
  )
}

/**
 * A compact segmented option button (no check icon). Used for inline
 * choices like AC type, inverter, condition, bulb type and pump size.
 */
export function SegOption({
  label,
  selected,
  onClick,
  style,
}: {
  label: ReactNode
  selected: boolean
  onClick: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 44,
        padding: '8px 14px',
        borderRadius: 12,
        ...selBg(selected),
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

/** −/value/+ quantity stepper. */
export function Stepper({
  value,
  onDec,
  onInc,
  valueWidth = 44,
  valueSize = 18,
}: {
  value: ReactNode
  onDec: () => void
  onInc: () => void
  valueWidth?: number
  valueSize?: number
}) {
  const btn: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.white,
    color: C.body,
    fontSize: 20,
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={onDec} style={btn}>
        −
      </button>
      <div
        style={{
          width: valueWidth,
          textAlign: 'center',
          fontSize: valueSize,
          fontWeight: 700,
          color: C.ink,
        }}
      >
        {value}
      </div>
      <button onClick={onInc} style={btn}>
        +
      </button>
    </div>
  )
}

/** Pill toggle switch. */
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: on ? C.red : C.toggleOff,
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        padding: 3,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: C.white,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          display: 'block',
        }}
      />
    </button>
  )
}

/** Uppercase kicker label above section titles. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: C.muted,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

/** Camera / add-photo glyph. */
export function CameraIcon({ size = 22, stroke = C.muted }: { size?: number; stroke?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
