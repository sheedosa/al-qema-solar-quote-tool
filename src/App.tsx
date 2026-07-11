import { useEffect, useMemo, useState } from 'react'
import { C } from './theme'
import { SHOW_PRICE, WA_NUMBER } from './config'
import { canContinue, estimate, whatsappLink } from './logic'
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

const STEP_TITLES = ['', 'About you', 'Power use', 'Cooling', 'Appliances', 'Preferences', 'Review']

export default function App() {
  const [step, setStep] = useState(0)
  const form = useQuoteForm()
  const d = form.data

  // Reset scroll position when the step changes.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } catch {
      window.scrollTo(0, 0)
    }
  }, [step])

  const est = useMemo(() => estimate(d), [d])
  const can = canContinue(d, step)
  const firstName = d.name.trim().split(/\s+/)[0] || 'friend'
  const waLink = whatsappLink(d, est, WA_NUMBER)

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
        stepTitle={STEP_TITLES[step] || ''}
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
            est={est}
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
          label={step === 6 ? 'Get my estimate' : 'Continue'}
        />
      )}
    </div>
  )
}
