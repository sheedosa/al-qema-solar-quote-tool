/**
 * The review sheet: what changed, what it does to the reference households,
 * any remaining problems, then one confirm. The same sheet guards publishing
 * a draft and activating an older version (compared against live).
 *
 * Same mechanics as the lead sheet: fixed to the inline-end edge, full-screen
 * on a phone, Escape closes, focus moves in and back out.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { compareConfigs, diffConfig } from '../../pricing/diff'
import type { ConfigChange } from '../../pricing/diff'
import { REFERENCE_CASES } from '../../pricing/referenceCases'
import type { PricingConfig } from '../../pricing/types'
import { C } from '../../theme'
import { isMoneyPath, labelForError, labelParts } from '../configLabels'
import { Auto, Badge, Btn, Ltr, Money, thNum, thText } from '../controls'
import { fmtNum } from '../format'
import { useAdminLang } from '../i18n'
import { useIsMobile } from '../useIsMobile'

export type ReviewMode =
  | { kind: 'publish'; version: string }
  | { kind: 'rollback'; version: string; unsavedEdits: boolean; invalidErrors: string[] }

function Value({ v, money }: { v: unknown; money: boolean }) {
  const { t } = useAdminLang()
  if (v === undefined || v === null || v === '') return <span style={{ color: C.faint }}>{t.pricing.review.empty}</span>
  if (typeof v === 'number') return money ? <Money n={v} /> : <Ltr>{fmtNum(v, 3)}</Ltr>
  if (typeof v === 'boolean') return <span>{v ? t.common.yes : t.common.no}</span>
  return <Auto>{String(v)}</Auto>
}

function ChangeList({ changes }: { changes: ConfigChange[] }) {
  const { t, opt } = useAdminLang()
  const groups = useMemo(() => {
    const m = new Map<string, { item: string; c: ConfigChange }[]>()
    for (const c of changes) {
      const [section, ...rest] = labelParts(c.path, t, opt)
      const list = m.get(section) ?? []
      list.push({ item: rest.join(' · '), c })
      m.set(section, list)
    }
    return m
  }, [changes, t, opt])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...groups.entries()].map(([section, rows]) => (
        <div key={section}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 4, textAlign: 'start' }}>{section}</div>
          {rows.map(({ item, c }) => (
            <div
              key={c.path}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', padding: '6px 0', borderTop: `1px solid ${C.border}`, fontSize: 13.5, color: C.body }}
            >
              <span style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'start' }}>{item || section}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <Value v={c.before} money={isMoneyPath(c.path)} /> {t.pricing.review.arrow}{' '}
                <b>
                  <Value v={c.after} money={isMoneyPath(c.path)} />
                </b>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Households({ live, draft }: { live: PricingConfig; draft: PricingConfig }) {
  const { t } = useAdminLang()
  const r = t.pricing.review
  const isMobile = useIsMobile()
  const rows = useMemo(() => compareConfigs(live, draft, REFERENCE_CASES), [live, draft])
  const moved = rows.filter((x) => x.changed).length
  const tierText = (tier: string, price: number | null) =>
    price === null ? (
      <span style={{ color: C.amber }}>{r.cannotPrice}</span>
    ) : (
      <>
        <Badge tone={tier === 'CUSTOM' ? 'amber' : 'neutral'}>{tier}</Badge> <Money n={price} />
      </>
    )
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, textAlign: 'start' }}>
        {moved === 0 ? r.noneChange : r.changedCount(fmtNum(moved), fmtNum(rows.length))}
      </div>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((x) => (
            <div
              key={x.id}
              data-testid={'household-' + x.id}
              data-changed={x.changed ? '' : undefined}
              style={{ border: `1px solid ${x.changed ? C.amber : C.border}`, background: x.changed ? C.amberTint : C.white, borderRadius: 10, padding: 12 }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6, textAlign: 'start' }}>{t.pricing.referenceCase[x.id]}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 13.5, color: C.body }}>
                <span>{tierText(x.liveTier, x.livePrice)}</span>
                <span>{r.arrow}</span>
                <span style={{ fontWeight: x.changed ? 700 : 400 }}>{x.changed ? tierText(x.draftTier, x.draftPrice) : r.noChange}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="households-table">
          <thead>
            <tr>
              <th style={thText}>{r.household}</th>
              <th style={thNum}>{r.live}</th>
              <th style={thNum}>{r.draft}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} data-testid={'household-' + x.id} data-changed={x.changed ? '' : undefined} style={{ background: x.changed ? C.amberTint : undefined }}>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.body, textAlign: 'start' }}>
                  {t.pricing.referenceCase[x.id]}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.body, textAlign: 'end', whiteSpace: 'nowrap' }}>
                  {tierText(x.liveTier, x.livePrice)}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.body, textAlign: 'end', whiteSpace: 'nowrap', fontWeight: x.changed ? 700 : 400 }}>
                  {x.changed ? tierText(x.draftTier, x.draftPrice) : <span style={{ color: C.faint }}>{r.noChange}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Block({ title, blurb, children }: { title: string; blurb?: string; children: ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 4px', textAlign: 'start' }}>{title}</h3>
      {blurb && <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.5, textAlign: 'start' }}>{blurb}</p>}
      {children}
    </div>
  )
}

export function PublishReview({
  mode,
  live,
  candidate,
  errors,
  busy,
  onConfirm,
  onDiscardAndContinue,
  onClose,
  onReveal,
}: {
  mode: ReviewMode
  live: PricingConfig
  candidate: PricingConfig
  /** Raw validator messages blocking the action (draft problems). */
  errors: string[]
  busy: boolean
  onConfirm: () => void
  /** Rollback only: the manager accepts losing their edits. */
  onDiscardAndContinue?: () => void
  onClose: () => void
  /** Close and scroll to a problem field. */
  onReveal: (path: string) => void
}) {
  const { t, opt } = useAdminLang()
  const r = t.pricing.review
  const isMobile = useIsMobile()
  const closeRef = useRef<HTMLButtonElement>(null)
  const changes = useMemo(() => diffConfig(live, candidate), [live, candidate])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])
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

  const rollbackInvalid = mode.kind === 'rollback' && mode.invalidErrors.length > 0
  const needsDiscard = mode.kind === 'rollback' && mode.unsavedEdits
  const blocked = errors.length > 0 || rollbackInvalid || busy
  const title = mode.kind === 'publish' ? r.title : r.rollbackTitle

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        data-testid="review-sheet"
        style={{
          position: 'fixed',
          zIndex: 71,
          background: C.white,
          display: 'flex',
          flexDirection: 'column',
          ...(isMobile
            ? { inset: 0 }
            : { top: 0, bottom: 0, insetInlineEnd: 0, width: 'min(640px, 100vw)', boxShadow: '0 0 32px rgba(0,0,0,0.18)' }),
        }}
      >
        <div style={{ flex: 'none', borderBottom: `1px solid ${C.border}`, padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 12px' : '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
            <div id="review-title" style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
              {title}
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              {mode.kind === 'publish' ? (
                <>
                  {r.publishAs} <Ltr>{mode.version}</Ltr>
                </>
              ) : (
                r.compareTo(mode.version)
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-focusable"
            onClick={onClose}
            aria-label={r.close}
            style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 20, cursor: 'pointer', flex: 'none' }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {needsDiscard && (
            <div role="alert" style={{ padding: 12, borderRadius: 10, background: C.amberTint, borderInlineStart: `3px solid ${C.amber}`, fontSize: 13.5, color: C.body, textAlign: 'start' }}>
              {r.unsavedWarning}
            </div>
          )}
          {rollbackInvalid && (
            <div role="alert" style={{ padding: 12, borderRadius: 10, background: C.redTint, borderInlineStart: `3px solid ${C.red}`, fontSize: 13.5, color: C.body, textAlign: 'start' }}>
              {r.invalidVersion}
              <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: 12.5 }}>
                {mode.kind === 'rollback' &&
                  mode.invalidErrors.map((e) => {
                    const le = labelForError(e, t, opt)
                    return (
                      <li key={e}>
                        {le.label} — {le.reason}
                      </li>
                    )
                  })}
              </ul>
            </div>
          )}
          {errors.length > 0 && (
            <Block title={r.problems} blurb={r.problemsBlurb}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {errors.map((e) => {
                  const le = labelForError(e, t, opt)
                  return (
                    <button
                      key={e}
                      type="button"
                      className="admin-focusable"
                      onClick={() => onReveal(le.path)}
                      style={{ textAlign: 'start', background: C.redTint, border: 'none', borderRadius: 8, padding: '10px 12px', minHeight: 44, cursor: 'pointer', fontSize: 13.5, color: C.body }}
                    >
                      <b>{le.label}</b> — {le.reason}
                    </button>
                  )
                })}
              </div>
            </Block>
          )}
          <Block title={r.whatChanged}>
            {changes.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>{t.pricing.noChanges}</div> : <ChangeList changes={changes} />}
          </Block>
          <Block title={r.effect} blurb={r.effectBlurb}>
            <Households live={live} draft={candidate} />
          </Block>
        </div>

        <div style={{ flex: 'none', borderTop: `1px solid ${C.border}`, padding: isMobile ? '10px 14px calc(10px + env(safe-area-inset-bottom))' : '12px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Btn>
          {needsDiscard && onDiscardAndContinue ? (
            <Btn kind="danger" onClick={onDiscardAndContinue} disabled={blocked} testId="discard-and-continue">
              {r.discardAndContinue}
            </Btn>
          ) : (
            <Btn kind="primary" onClick={onConfirm} disabled={blocked} testId="confirm-publish" style={{ minHeight: 48 }}>
              {busy
                ? mode.kind === 'publish'
                  ? r.publishing
                  : r.activating
                : mode.kind === 'publish'
                  ? (
                    <>
                      {r.publishAs} <Ltr>{mode.version}</Ltr>
                    </>
                  )
                  : r.activate}
            </Btn>
          )}
        </div>
      </div>
    </>
  )
}
