import { useEffect, useMemo, useRef, useState } from 'react'
import { C } from './theme'
import { SHOW_PRICE, WA_NUMBER } from './config'
import { useLang } from './i18n'
import { canContinue, whatsappLink } from './logic'
import { runEngine, toWaQuote } from './pricing/engine'
import { buildQuoteRecord, persistence } from './pricing/persist'
import type { PricingConfig } from './pricing/types'
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
  const [step, setStep] = useState(0)
  const { s, lang } = useLang()
  const form = useQuoteForm()
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

  const result = useMemo(() => runEngine(d, cfg), [d, cfg])
  const can = canContinue(d, step)
  const firstName = d.name.trim().split(/\s+/)[0] || s.result.friend
  const waLink = whatsappLink(d, toWaQuote(result), WA_NUMBER, s.whatsappMsg)

  // Persist each completed quote once per result view. The ref guard absorbs
  // StrictMode's double-fired dev effects; leaving step 7 re-arms it so a
  // revised quote is saved again.
  const persisted = useRef(false)
  useEffect(() => {
    if (step === 7 && !persisted.current) {
      persisted.current = true
      void persistence.save(buildQuoteRecord(d, result, lang))
    }
    if (step !== 7) persisted.current = false
  }, [step, d, result, lang])

  const showNav = step >= 1 && step <= 6
  const goto = (next: number) => setStep(Math.max(0, Math.min(7, next)))

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
            onStartOver={() => goto(0)}
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
