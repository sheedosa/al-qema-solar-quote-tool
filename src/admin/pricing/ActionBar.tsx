/**
 * The fixed bottom bar. Its state line says one of three things — N problems
 * (tap to go to the first), N changes, or no changes — and its one primary
 * button opens the review. Nothing publishes from here.
 */
import { C } from '../../theme'
import { Btn, Ltr } from '../controls'
import { plural } from '../format'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'

export function ActionBar({
  changes,
  problems,
  busy,
  nextVersion,
  onReview,
  onDiscard,
  onShowProblem,
}: {
  changes: number
  problems: number
  busy: boolean
  nextVersion: string
  onReview: () => void
  onDiscard: () => void
  onShowProblem: () => void
}) {
  const { t, lang } = useAdminLang()
  const pr = t.pricing
  const isMobile = useMobileValue()
  const canReview = changes > 0 && problems === 0 && !busy
  return (
    <div
      data-testid="action-bar"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
        padding: `10px ${isMobile ? 14 : 20}px calc(10px + env(safe-area-inset-bottom))`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: problems > 0 ? C.red : changes > 0 ? C.amber : C.muted, textAlign: 'start' }}>
        {problems > 0 ? (
          <button
            type="button"
            className="admin-focusable"
            onClick={onShowProblem}
            data-testid="show-problem"
            style={{ background: 'none', border: 'none', padding: 0, minHeight: 44, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'start' }}
          >
            {plural(problems, pr.problemsCount, lang)} · {pr.showProblem}
          </button>
        ) : changes > 0 ? (
          <span>
            {plural(changes, pr.changesCount, lang)}
            {!isMobile && (
              <>
                {' · '}
                {pr.review.publishAs} <Ltr>{nextVersion}</Ltr>
              </>
            )}
          </span>
        ) : (
          pr.noChanges
        )}
      </div>
      {changes > 0 && !isMobile && (
        <Btn onClick={onDiscard} disabled={busy} testId="discard">
          {pr.discard}
        </Btn>
      )}
      <Btn kind="primary" onClick={onReview} disabled={!canReview} testId="review-changes" style={{ minHeight: 48, padding: '0 20px', fontSize: 15 }}>
        {changes > 0 ? plural(changes, pr.reviewChanges, lang) : pr.reviewLabel}
      </Btn>
    </div>
  )
}
