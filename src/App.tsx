import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { C } from './theme'
import { SHOW_PRICE, WA_NUMBER } from './config'
import { useLang } from './i18n'
import { canContinue, whatsappLink } from './logic'
import { runEngine, toWaQuote } from './pricing/engine'
import { buildQuoteRecord, persistence } from './pricing/persist'
import type { PricingConfig } from './pricing/types'
import { clearSession, loadSession, saveSession } from './session'
import { useQuoteForm } from './useQuoteForm'
import { Header } from './components/Header'
import { FooterNav } from './components/FooterNav'
import { Screen0Welcome } from './screens/Screen0Welcome'
import { Screen1Details } from './screens/Screen1Details'
import { Screen2Power } from './screens/Screen2Power'
import { Screen3Cooling } from './screens/Screen3Cooling'
import { Screen4Appliances } from './screens/Screen4Appliances'
import { Screen5Preferences } from './screens/Screen5Preferences'
import { Screen6Review } from './screens/Screen6Review'
import { Screen7Result } from './screens/Screen7Result'

export default function App({ cfg }: { cfg: PricingConfig }) {
  // Restored once, synchronously, so the first paint is already the right step
  // rather than flashing the welcome screen before jumping.
  const restored = useRef(loadSession()).current
  const [step, setStep] = useState(restored?.step ?? 0)
  const { s, lang } = useLang()
  const form = useQuoteForm(restored?.data)
  const d = form.data

  const stepTitles = [
    '',
    s.header.titles.aboutYou,
    s.header.titles.powerUse,
    s.header.titles.cooling,
    s.header.titles.appliances,
    s.header.titles.preferences,
    s.header.titles.review,
  ]

  // Reset scroll position when the step changes.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } catch {
      window.scrollTo(0, 0)
    }
  }, [step])

  // Keep progress across a reload or a tab eviction. Four minutes of answers
  // used to vanish on refresh.
  useEffect(() => {
    saveSession(step, d)
  }, [step, d])

  /**
   * `stepRef` mirrors `step` so navigation can compare against the current
   * value without a dependency. The history push must NOT live inside the
   * setState updater: React double-invokes updaters in StrictMode, which
   * pushed two entries per navigation and left the back button appearing to
   * do nothing (it returned to the duplicate entry for the same step).
   */
  const stepRef = useRef(step)
  stepRef.current = step

  /**
   * Give each step its own history entry so the device back button walks the
   * wizard instead of leaving the site. Without this, Android back at step 5
   * abandoned the form entirely.
   */
  useEffect(() => {
    window.history.replaceState({ alqemaStep: step }, '')
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { alqemaStep?: number } | null)?.alqemaStep
      const next = typeof target === 'number' ? target : 0
      stepRef.current = next
      setStep(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // Runs once: the handler reads the event, not the closed-over step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const result = useMemo(() => runEngine(d, cfg), [d, cfg])
  const can = canContinue(d, step)
  const firstName = d.name.trim().split(/\s+/)[0] || s.result.friend
  const waLink = whatsappLink(d, toWaQuote(result, d), WA_NUMBER, s.whatsappMsg)

  /**
   * Persist each completed quote once. The guard is keyed on the quote's own
   * content rather than a boolean: a plain flag was re-armed every time the
   * customer left step 7, so "Start over" followed by walking forward again
   * inserted a second, duplicate lead for the same person.
   */
  const persistedKey = useRef<string | null>(null)
  useEffect(() => {
    if (step !== 7) return
    const key = d.whatsapp + '|' + d.name + '|' + result.recommendedTier + '|' + result.priceFrom
    if (persistedKey.current === key) return
    persistedKey.current = key
    void persistence.save(buildQuoteRecord(d, result, lang))
  }, [step, d, result, lang])

  const showNav = step >= 1 && step <= 6

  const goto = useCallback((next: number) => {
    const target = Math.max(0, Math.min(7, next))
    if (target === stepRef.current) return
    window.history.pushState({ alqemaStep: target }, '')
    stepRef.current = target
    setStep(target)
  }, [])

  /**
   * Start over must actually start over. It used to call goto(0) alone, so on
   * a shared or showroom device the next customer walked into the previous
   * one's name, phone number and answers.
   */
  const startOver = useCallback(() => {
    form.reset()
    clearSession()
    persistedKey.current = null
    goto(0)
  }, [form, goto])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.canvas,
      }}
    >
      <Header
        showProgress={step >= 1 && step <= 6}
        progressPct={Math.round((step / 6) * 100) + '%'}
        stepNum={step}
        stepTitle={stepTitles[step] || ''}
      />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 680,
          margin: '0 auto',
          padding: '24px 20px 120px',
        }}
      >
        {step === 0 && <Screen0Welcome onStart={() => goto(1)} />}
        {step === 1 && <Screen1Details form={form} />}
        {step === 2 && <Screen2Power form={form} />}
        {step === 3 && <Screen3Cooling form={form} />}
        {step === 4 && <Screen4Appliances form={form} />}
        {step === 5 && <Screen5Preferences form={form} />}
        {step === 6 && <Screen6Review form={form} onEdit={goto} />}
        {step === 7 && (
          <Screen7Result
            result={result}
            firstName={firstName}
            priceVisible={SHOW_PRICE}
            waLink={waLink}
            onStartOver={startOver}
          />
        )}
      </main>

      {showNav && (
        <FooterNav
          backVisible={step > 1}
          onBack={() => goto(step - 1)}
          onContinue={() => {
            if (can) goto(step + 1)
          }}
          disabled={!can}
          label={step === 6 ? s.nav.getEstimate : s.nav.continue}
        />
      )}
    </div>
  )
}
