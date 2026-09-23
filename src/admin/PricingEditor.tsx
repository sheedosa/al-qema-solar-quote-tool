/**
 * The Pricing tab's shell: load, draft, the review state machine, the bar.
 *
 * The page opens on prices only — five package rows, the custom-build floor
 * and round-up, add-ons, and the component price list. Hardware, appliance
 * assumptions and sizing constants sit under Advanced, collapsed. Publishing
 * always goes through the review sheet, which shows what changed and what it
 * does to seven reference households before anything goes live.
 */
import { useCallback, useEffect, useState } from 'react'
import { revealPath } from './pricing/useConfigDraft'
import { useConfigDraft } from './pricing/useConfigDraft'
import type { PricingConfig } from '../pricing/types'
import { PRICING_CONFIG } from '../pricing/config'
import { validatePricingConfig } from '../pricing/validate'
import { C, cardStyle } from '../theme'
import { labelForError } from './configLabels'
import { Auto } from './controls'
import { useAdminLang } from './i18n'
import { MobileContext, useIsMobile } from './useIsMobile'
import { ActionBar } from './pricing/ActionBar'
import { AdvancedPanel, sectionForPath } from './pricing/AdvancedPanel'
import type { AdvancedSection } from './pricing/AdvancedPanel'
import { packageCardId } from './pricing/advanced/PackageHardware'
import { DraftProvider } from './pricing/bound'
import { ComponentPrices } from './pricing/ComponentPrices'
import { activate, fetchConfig, listVersions, nextVersion, publish } from './pricing/configRepo'
import type { ConfigRow } from './pricing/configRepo'
import { PricesPanel } from './pricing/PricesPanel'
import { PublishReview } from './pricing/PublishReview'
import type { ReviewMode } from './pricing/PublishReview'
import { VersionHistory } from './pricing/VersionHistory'

type Outcome = { tone: 'green' | 'red' | 'amber'; text: string; detail?: string }

type Review =
  | { kind: 'publish' }
  | { kind: 'rollback'; row: ConfigRow; config: PricingConfig; invalidErrors: string[] }

export function PricingEditor() {
  const d = useConfigDraft()
  const [history, setHistory] = useState<ConfigRow[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [unpublished, setUnpublished] = useState(false)
  const [section, setSection] = useState<AdvancedSection>('hardware')
  const isMobile = useIsMobile()
  const { t, opt } = useAdminLang()
  const pr = t.pricing

  const loadAll = useCallback(async () => {
    const rows = await listVersions()
    if (rows === null) {
      // Never fall back to the built-in prices here: offering to "publish"
      // them over a history we simply failed to read would be destructive.
      setLoadError(true)
      return
    }
    setLoadError(false)
    setHistory(rows)
    const active = rows.find((r) => r.is_active)
    const cfg = active ? await fetchConfig(active.id) : null
    const checked = cfg ? validatePricingConfig(cfg) : null
    // Nothing published yet: the site runs on the built-in prices, so those
    // are what "live" means, and the first publish seeds the sheet.
    d.load(checked?.ok ? checked.config : cfg ? (cfg as PricingConfig) : PRICING_CONFIG)
    setUnpublished(!active)
  }, [d.load]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Open Advanced on the section a path belongs to and scroll to the field.
  const reveal = useCallback(
    (path: string) => {
      const s = sectionForPath(path)
      if (s) {
        setAdvancedOpen(true)
        setSection(s)
      }
      // The field may not be mounted until Advanced renders.
      setTimeout(() => {
        if (!revealPath(path) && s) document.getElementById('advanced')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    },
    [],
  )

  const editHardware = (tier: string) => {
    setAdvancedOpen(true)
    setSection('hardware')
    setTimeout(() => document.getElementById(packageCardId(tier))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const confirmPublish = async () => {
    if (!d.draft) return
    setBusy(true)
    setOutcome(null)
    const res = await publish(d.draft)
    setBusy(false)
    setReview(null)
    if (res.ok) {
      setOutcome({ tone: 'green', text: pr.outcome.published(res.version) })
      await loadAll()
      return
    }
    if (res.stage === 'invalid') setOutcome({ tone: 'red', text: pr.outcome.invalid })
    else setOutcome({ tone: 'red', text: pr.outcome.failed, detail: res.message })
  }

  const openRollback = async (row: ConfigRow) => {
    setBusy(true)
    const raw = await fetchConfig(row.id)
    setBusy(false)
    const checked = validatePricingConfig(raw)
    setReview({
      kind: 'rollback',
      row,
      config: checked.ok ? checked.config : (raw as PricingConfig),
      invalidErrors: checked.ok ? [] : checked.errors,
    })
  }

  const confirmRollback = async () => {
    if (review?.kind !== 'rollback') return
    setBusy(true)
    setOutcome(null)
    const res = await activate(review.row.id)
    setBusy(false)
    setReview(null)
    if (res.ok) {
      setOutcome({ tone: 'green', text: pr.outcome.activated(review.row.version) })
      await loadAll()
    } else {
      setOutcome({ tone: 'red', text: pr.outcome.activateFailed, detail: res.message })
    }
  }

  if (loadError) {
    return (
      <div role="alert" style={{ ...cardStyle, borderInlineStart: `3px solid ${C.red}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.red, textAlign: 'start' }}>{pr.loadFailed}</div>
        <button
          type="button"
          className="admin-focusable"
          onClick={() => void loadAll()}
          style={{ marginTop: 10, minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontWeight: 600, cursor: 'pointer' }}
        >
          {pr.retry}
        </button>
      </div>
    )
  }
  if (!d.draft || !d.live) return <div style={{ color: C.muted, padding: 20 }}>{pr.loading}</div>

  const version = nextVersion(
    history.map((r) => r.version),
    new Date(),
  )
  const problems = d.errors.length

  const reviewMode: ReviewMode | null =
    review === null
      ? null
      : review.kind === 'publish'
        ? { kind: 'publish', version }
        : { kind: 'rollback', version: review.row.version, unsavedEdits: d.dirty, invalidErrors: review.invalidErrors }

  return (
    <MobileContext.Provider value={isMobile}>
      <DraftProvider value={d}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13.5, color: C.muted, margin: 0, lineHeight: 1.6, textAlign: 'start' }}>{pr.intro}</p>

          {unpublished && (
            <div data-testid="unpublished" style={{ ...cardStyle, borderInlineStart: `3px solid ${C.amber}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.amber, textAlign: 'start' }}>{pr.unpublishedTitle}</div>
              <p style={{ fontSize: 13, color: C.body, margin: '4px 0 10px', lineHeight: 1.5, textAlign: 'start' }}>{pr.unpublishedBody}</p>
              <button
                type="button"
                className="admin-focusable"
                data-testid="publish-builtin"
                onClick={() => setReview({ kind: 'publish' })}
                disabled={busy || d.errors.length > 0}
                style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: C.red, color: C.white, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {pr.publishBuiltIn}
              </button>
            </div>
          )}

          {outcome && (
            <div
              role="status"
              data-testid="outcome"
              style={{ ...cardStyle, borderInlineStart: `3px solid ${C[outcome.tone]}` }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C[outcome.tone], textAlign: 'start' }}>{outcome.text}</div>
              {outcome.detail && (
                <div style={{ fontSize: 12.5, color: C.body, marginTop: 4, textAlign: 'start' }} dir="ltr">
                  {outcome.detail}
                </div>
              )}
            </div>
          )}

          {/* Structural problems (a section that is not an object) have no
              field to sit under, so they are listed here; field problems show
              at their field and are counted in the bar. */}
          {d.errors.length > 0 && (
            <div style={{ ...cardStyle, borderInlineStart: `3px solid ${C.red}` }} data-testid="problems-card">
              <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6, textAlign: 'start' }}>{pr.problemsTitle}</div>
              {d.errors.map((e) => {
                const le = labelForError(e, t, opt)
                return (
                  <button
                    key={e}
                    type="button"
                    className="admin-focusable"
                    onClick={() => reveal(le.path)}
                    style={{ display: 'block', width: '100%', textAlign: 'start', background: 'none', border: 'none', padding: '6px 0', minHeight: 36, fontSize: 13, color: C.body, lineHeight: 1.5, cursor: 'pointer' }}
                  >
                    · <Auto>{le.label}</Auto>
                    {le.reason && (
                      <>
                        {' — '}
                        <span dir={le.known ? undefined : 'ltr'}>{le.reason}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <PricesPanel onEditHardware={editHardware} />
          <ComponentPrices />
          <AdvancedPanel open={advancedOpen} section={section} onToggle={() => setAdvancedOpen((o) => !o)} onSection={setSection} />
          <VersionHistory rows={history} busy={busy} onActivate={(row) => void openRollback(row)} />

          {/* Clears the fixed bar below. */}
          <div style={{ height: 88 }} />

          <ActionBar
            changes={d.changes.length}
            problems={problems}
            busy={busy}
            nextVersion={version}
            onReview={() => setReview({ kind: 'publish' })}
            onDiscard={d.discard}
            onShowProblem={() => d.firstErrorPath && reveal(d.firstErrorPath)}
          />

          {reviewMode && review && (
            <PublishReview
              mode={reviewMode}
              live={d.live}
              candidate={review.kind === 'publish' ? d.draft : review.config}
              errors={review.kind === 'publish' ? d.errors : []}
              busy={busy}
              onConfirm={() => void (review.kind === 'publish' ? confirmPublish() : confirmRollback())}
              onDiscardAndContinue={() => {
                d.discard()
                void confirmRollback()
              }}
              onClose={() => setReview(null)}
              onReveal={(path) => {
                setReview(null)
                reveal(path)
              }}
            />
          )}
        </div>
      </DraftProvider>
    </MobileContext.Provider>
  )
}
