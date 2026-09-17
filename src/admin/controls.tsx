/**
 * Shared form primitives, direction primitives and table-cell styles for the
 * admin panel.
 *
 * Direction rule for the whole admin, so it is written once: the document is
 * RTL or LTR as a whole, following the chosen language. Inside it exactly two
 * exceptions exist and both are components in this file — `<Auto>` for text a
 * customer typed, which takes its own direction, and `<Ltr>` for numbers with
 * units, which never reorder. `dir` goes on INLINE spans, never on a block or
 * a flex item whose alignment matters: a `dir="auto"` block aligns to its own
 * resolved direction, which is how an Arabic city name once ended up flung to
 * the far edge of an otherwise English row.
 */
import type { CSSProperties, ReactNode } from 'react'
import { C, cardStyle, inputStyle } from '../theme'
import type { Lang } from '../i18n'
import { fmtNum } from './format'
import { useAdminLang } from './i18n'
import { useMobileValue } from './useIsMobile'

export const sectionTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 10,
}
export const label: CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.muted }
export const numStyle: CSSProperties = {
  ...inputStyle,
  // 44px is the touch floor the rest of the admin now uses; this was 38.
  minHeight: 44,
  padding: '8px 12px',
}

/* ------------------------------------------------------------ direction */

/**
 * A number, a phone, a version string, "12,000 BTU", "93.75 kW": anything that
 * must read left-to-right whatever the document does. Isolated so the
 * surrounding paragraph treats it as one opaque token — without the isolate,
 * an RTL paragraph reorders the neutrals between two digits and "6 × 550"
 * comes out as "550 × 6".
 */
export function Ltr({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  )
}

/** Text the customer typed — a name, a city, a device — in its own script. */
export function Auto({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span dir="auto" style={{ unicodeBidi: 'isolate', ...style }}>
      {children}
    </span>
  )
}

/**
 * A price on screen. Only the FIGURE is isolated; the currency word follows
 * the document, which is what puts د.ل after the number in Arabic and LYD
 * after it in English without any per-language branching.
 */
export function Money({ n, style }: { n: number | null; style?: CSSProperties }) {
  const { t } = useAdminLang()
  if (n === null) return <span style={style}>{t.common.dash}</span>
  return (
    <span style={{ whiteSpace: 'nowrap', ...style }}>
      <Ltr>{fmtNum(n)}</Ltr> {t.common.currency}
    </span>
  )
}

/* ---------------------------------------------------------------- tables */

/**
 * One convention for every table in the panel, in both languages: text
 * columns start-aligned and allowed to wrap, numeric columns end-aligned in
 * tabular figures and never wrapped. Header alignment follows its column.
 * No `textTransform: uppercase` (a no-op on Arabic) and no `letterSpacing`
 * (which breaks Arabic cursive joining) — headers are weight and colour.
 */
const cellBase: CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${C.border}`,
}
export const thText: CSSProperties = {
  ...cellBase,
  textAlign: 'start',
  fontSize: 12,
  fontWeight: 600,
  color: C.muted,
  whiteSpace: 'nowrap',
}
export const thNum: CSSProperties = { ...thText, textAlign: 'end' }
export const tdText: CSSProperties = {
  ...cellBase,
  textAlign: 'start',
  fontSize: 14,
  color: C.body,
  overflowWrap: 'anywhere',
}
export const tdNum: CSSProperties = {
  ...cellBase,
  textAlign: 'end',
  fontSize: 14,
  color: C.body,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

/** A numeric cell: end-aligned, LTR-isolated, flagged for the browser check. */
export function TdNum({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <td style={{ ...tdNum, ...style }} data-num="">
      <Ltr>{children}</Ltr>
    </td>
  )
}

/* ------------------------------------------------------------------ form */

export function Num({
  value,
  onChange,
  width = 110,
  id,
  invalid = false,
  describedBy,
  placeholder,
  step,
  min,
  ariaLabel,
}: {
  value: number | null
  onChange: (n: number | null) => void
  width?: number
  /** A DOM id so an error message or a label can point at this field. */
  id?: string
  /** Red ring + aria-invalid; the message itself is the caller's. */
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  step?: number | 'any'
  min?: number
  ariaLabel?: string
}) {
  const isMobile = useMobileValue()
  const { isRtl } = useAdminLang()
  return (
    <input
      className="admin-input"
      type="number"
      inputMode="decimal"
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      placeholder={placeholder}
      step={step ?? 'any'}
      min={min}
      // Pinned LTR: a mirrored number input renders "-5" as "5-" and flips
      // the spinner. The alignment is physical on purpose — the digits hug
      // the document's start edge, which is the right in Arabic.
      dir="ltr"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        // A cleared field is `null`, never 0: the validator then says
        // "required" for a price rather than "must be above 0" for a zero the
        // manager never typed.
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
        textAlign: isRtl ? 'right' : 'left',
        ...(invalid ? { borderColor: C.red, boxShadow: `0 0 0 2px ${C.redTint}` } : null),
      }}
    />
  )
}

export function Field({ name, children }: { name: string; children: ReactNode }) {
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
        // Component names are staff-typed text and may be Arabic.
        <option key={n} value={n} dir="auto">
          {n}
        </option>
      ))}
    </select>
  )
}

/* ----------------------------------------------------------- primitives */

/** "12,000 BTU · 8h · nights" — parts joined by a neutral separator. */
export function Dots({ parts }: { parts: ReactNode[] }) {
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

/** The message under an invalid field. `id` lets the field point at it. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} role="alert" style={{ fontSize: 12.5, color: C.red, lineHeight: 1.4, textAlign: 'start' }}>
      {children}
    </div>
  )
}

export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red'
const BADGE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: C.canvas, fg: C.muted },
  green: { bg: C.greenTint, fg: C.green },
  amber: { bg: C.amberTint, fg: C.amber },
  red: { bg: C.redTint, fg: C.red },
}

/** A small tinted label: a tier letter, "used by household build", "no price". */
export function Badge({ tone = 'neutral', children, style }: { tone?: BadgeTone; children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        background: BADGE[tone].bg,
        color: BADGE[tone].fg,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/**
 * A card with a title, an optional one-sentence explanation of what the
 * section changes, and an optional end slot (a count, a button).
 */
export function SectionCard({
  title,
  blurb,
  end,
  children,
  style,
  id,
}: {
  title: ReactNode
  blurb?: ReactNode
  end?: ReactNode
  children: ReactNode
  style?: CSSProperties
  id?: string
}) {
  return (
    <section id={id} style={{ ...cardStyle, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: blurb ? 4 : 12 }}>
        <h2 style={{ ...sectionTitle, marginBottom: 0, flex: 1, minWidth: 0, textAlign: 'start' }}>{title}</h2>
        {end}
      </div>
      {blurb && (
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: '0 0 14px', textAlign: 'start' }}>{blurb}</p>
      )}
      {children}
    </section>
  )
}

/**
 * Label · control · unit · help · error, stacked. The label is a real <label>
 * pointing at the control's id, so tapping it focuses the field.
 */
export function LabeledControl({
  htmlFor,
  label: text,
  unit,
  help,
  error,
  errorId,
  children,
  style,
}: {
  htmlFor?: string
  label: ReactNode
  unit?: ReactNode
  help?: ReactNode
  error?: ReactNode
  errorId?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
      <label htmlFor={htmlFor} style={{ ...label, textAlign: 'start' }}>
        {text}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {unit && <span style={{ ...label, flex: 'none' }}>{unit}</span>}
      </div>
      {help && <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.4, textAlign: 'start' }}>{help}</div>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

export type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost'

/** One button style for the whole panel; 44px minimum, focus ring via class. */
export function btnStyle(kind: BtnKind, disabled = false): CSSProperties {
  const base: CSSProperties = {
    minHeight: 44,
    padding: '0 14px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
    flex: 'none',
  }
  switch (kind) {
    case 'primary':
      return { ...base, border: 'none', background: C.red, color: C.white }
    case 'danger':
      return { ...base, border: 'none', background: C.red, color: C.white }
    case 'ghost':
      return { ...base, border: 'none', background: 'transparent', color: C.red, padding: '0 8px' }
    default:
      return { ...base, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontWeight: 600 }
  }
}

export function Btn({
  kind = 'secondary',
  onClick,
  disabled,
  children,
  ariaLabel,
  title,
  style,
  testId,
  type = 'button',
  ariaExpanded,
}: {
  kind?: BtnKind
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  ariaLabel?: string
  title?: string
  style?: CSSProperties
  testId?: string
  type?: 'button' | 'submit'
  ariaExpanded?: boolean
}) {
  return (
    <button
      type={type}
      className="admin-focusable"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      title={title}
      data-testid={testId}
      style={{ ...btnStyle(kind, disabled), ...style }}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------- language */

const OTHER: Record<Lang, Lang> = { ar: 'en', en: 'ar' }

/**
 * The language switch. Two 44px segments on desktop and the Login card; on a
 * phone a single 44×44 button showing the OTHER language, because the header
 * row already carries the logo, title and Sign out against 390px.
 */
export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, t, setLang } = useAdminLang()

  if (compact) {
    const other = OTHER[lang]
    return (
      <button
        className="admin-focusable"
        onClick={() => setLang(other)}
        aria-label={t.common.switchTo[other]}
        title={t.common.switchTo[other]}
        data-testid="admin-lang-toggle"
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: C.white,
          color: C.body,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {t.common.langShort[other]}
      </button>
    )
  }

  const seg = (active: boolean): CSSProperties => ({
    minWidth: 44,
    minHeight: 44,
    padding: '0 12px',
    border: 'none',
    background: active ? C.red : 'transparent',
    color: active ? C.white : C.body,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: active ? 'default' : 'pointer',
    borderRadius: 7,
  })

  return (
    <div
      role="group"
      aria-label={t.common.switchTo[OTHER[lang]]}
      data-testid="admin-lang-toggle"
      style={{
        display: 'inline-flex',
        flex: 'none',
        padding: 2,
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        background: C.white,
      }}
    >
      {(['ar', 'en'] as const).map((l) => (
        <button
          key={l}
          className="admin-focusable"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={t.common.langName[l]}
          style={seg(lang === l)}
        >
          {t.common.langShort[l]}
        </button>
      ))}
    </div>
  )
}
