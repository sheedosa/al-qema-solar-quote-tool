/**
 * Controls bound to a config PATH. Each reads its value from the draft,
 * writes back through `setPath`, carries `id = domId(path)` so an error can
 * scroll to it, and shows its own validation message. The panels never
 * touch the config's nesting — they say `path="packages[2].priceLyd"`.
 */
import { createContext, useContext } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { C } from '../../theme'
import { domId, getAt } from '../../pricing/paths'
import { FieldError, LabeledControl, Num, label as labelStyle, numStyle } from '../controls'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'
import type { ConfigDraft } from './useConfigDraft'

const DraftContext = createContext<ConfigDraft | null>(null)
export const DraftProvider = DraftContext.Provider

export function useDraft(): ConfigDraft {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside the Pricing editor')
  return ctx
}

const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A labelled number field bound to a path. */
export function ConfigNum({
  path,
  label,
  unit,
  help,
  width = 120,
  min,
  step,
  emptyAs = 'null',
  style,
}: {
  path: string
  label: ReactNode
  unit?: ReactNode
  help?: ReactNode
  width?: number
  min?: number
  step?: number | 'any'
  /** What a cleared field stores: `null` (flagged as required) or removed. */
  emptyAs?: 'null' | 'undefined'
  style?: CSSProperties
}) {
  const d = useDraft()
  const id = domId(path)
  const err = d.errorFor(path)
  return (
    <LabeledControl
      htmlFor={id}
      label={label}
      unit={unit}
      help={help}
      error={err?.reason}
      errorId={id + '-err'}
      style={style}
    >
      <Num
        id={id}
        value={asNum(getAt(d.draft, path))}
        onChange={(n) => d.setPath(path, n === null && emptyAs === 'undefined' ? undefined : n)}
        invalid={err !== null}
        describedBy={err ? id + '-err' : undefined}
        width={width}
        min={min}
        step={step}
      />
    </LabeledControl>
  )
}

/** A bare number field for a table cell or an inline row; its error goes below. */
export function ConfigCell({
  path,
  width = 90,
  ariaLabel,
  min,
  step,
  emptyAs = 'null',
  placeholder,
}: {
  path: string
  width?: number
  ariaLabel: string
  min?: number
  step?: number | 'any'
  emptyAs?: 'null' | 'undefined'
  placeholder?: string
}) {
  const d = useDraft()
  const id = domId(path)
  const err = d.errorFor(path)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <Num
        id={id}
        value={asNum(getAt(d.draft, path))}
        onChange={(n) => d.setPath(path, n === null && emptyAs === 'undefined' ? undefined : n)}
        invalid={err !== null}
        describedBy={err ? id + '-err' : undefined}
        width={width}
        min={min}
        step={step}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
      />
      {err && <FieldError id={id + '-err'}>{err.reason}</FieldError>}
    </div>
  )
}

/** A checkbox bound to a boolean path; unchecked removes the key. */
export function ConfigCheck({ path, ariaLabel }: { path: string; ariaLabel: string }) {
  const d = useDraft()
  const id = domId(path)
  const on = getAt(d.draft, path) === true
  return (
    <input
      id={id}
      type="checkbox"
      className="admin-focusable"
      aria-label={ariaLabel}
      checked={on}
      onChange={(e) => d.setPath(path, e.target.checked ? true : undefined)}
      style={{ width: 22, height: 22, margin: 11, accentColor: C.red, cursor: 'pointer' }}
    />
  )
}

export type Choice = { value: string; label: string }

/** A select bound to a string path, with a fixed list of choices. */
export function ConfigChoice({
  path,
  label,
  help,
  choices,
  width = 260,
  onChange,
}: {
  path: string
  label: ReactNode
  help?: ReactNode
  choices: Choice[]
  width?: number
  /** Override the write — a battery type change swaps the whole object. */
  onChange?: (value: string) => void
}) {
  const d = useDraft()
  const isMobile = useMobileValue()
  const id = domId(path)
  const err = d.errorFor(path)
  const value = String(getAt(d.draft, path) ?? '')
  return (
    <LabeledControl htmlFor={id} label={label} help={help} error={err?.reason} errorId={id + '-err'}>
      <select
        id={id}
        className="admin-input admin-focusable"
        value={value}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? id + '-err' : undefined}
        onChange={(e) => (onChange ? onChange(e.target.value) : d.setPath(path, e.target.value))}
        style={{
          ...numStyle,
          width: isMobile ? '100%' : width,
          minWidth: 0,
          background: C.white,
          fontSize: isMobile ? 16 : 14,
          ...(err ? { borderColor: C.red } : null),
        }}
      >
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </LabeledControl>
  )
}

/** A text field bound to a string path (an add-on's name). */
export function ConfigText({
  path,
  ariaLabel,
  width = 220,
  placeholder,
}: {
  path: string
  ariaLabel: string
  width?: number
  placeholder?: string
}) {
  const d = useDraft()
  const isMobile = useMobileValue()
  const id = domId(path)
  const err = d.errorFor(path)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
      <input
        id={id}
        className="admin-input"
        type="text"
        dir="auto"
        aria-label={ariaLabel}
        aria-invalid={err ? true : undefined}
        placeholder={placeholder}
        value={String(getAt(d.draft, path) ?? '')}
        onChange={(e) => d.setPath(path, e.target.value)}
        style={{
          ...numStyle,
          width: isMobile ? '100%' : width,
          minWidth: 0,
          fontSize: isMobile ? 16 : 14,
          ...(err ? { borderColor: C.red } : null),
        }}
      />
      {err && <FieldError id={id + '-err'}>{err.reason}</FieldError>}
    </div>
  )
}

/**
 * A component picker bound to a `...component` path. A current value that is
 * not in the price list is still shown — suffixed "(no price)" — instead of
 * the select silently displaying the first option while the config says
 * something else.
 */
export function ConfigComponentSelect({
  path,
  ariaLabel,
  width = 200,
}: {
  path: string
  ariaLabel: string
  width?: number
}) {
  const d = useDraft()
  const isMobile = useMobileValue()
  const { t } = useAdminLang()
  const id = domId(path)
  const err = d.errorFor(path)
  const value = String(getAt(d.draft, path) ?? '')
  const names = d.draft ? Object.keys(d.draft.components) : []
  const missing = value !== '' && !names.includes(value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <select
        id={id}
        className="admin-input admin-focusable"
        value={value}
        aria-label={ariaLabel}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? id + '-err' : undefined}
        onChange={(e) => d.setPath(path, e.target.value)}
        style={{
          ...numStyle,
          width: isMobile ? '100%' : width,
          minWidth: 0,
          background: C.white,
          fontSize: isMobile ? 16 : 14,
          ...(err ? { borderColor: C.red } : null),
        }}
      >
        {missing && (
          <option value={value} dir="auto">
            {value} ({t.pricing.noPrice})
          </option>
        )}
        {names.map((n) => (
          <option key={n} value={n} dir="auto">
            {n}
          </option>
        ))}
      </select>
      {err && <FieldError id={id + '-err'}>{err.reason}</FieldError>}
    </div>
  )
}

/** A read-only derived figure with a small caption, for "1.2 kWp · 2.4 kWh usable". */
export function Readout({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...labelStyle, fontSize: 13, color: C.body, ...style }}>{children}</span>
}
