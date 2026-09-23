import type { ReactNode } from 'react'
import { C } from '../theme'
import { Card, CheckOption, Kicker } from '../components/ui'
import { OUTAGE_VALS, useStrings } from '../i18n'
import type { QuoteForm } from '../useQuoteForm'

function Section({
  title,
  vals,
  labelOf,
  current,
  onSelect,
  wrap,
}: {
  title: ReactNode
  vals: string[]
  labelOf: (val: string) => string
  current: string
  onSelect: (val: string) => void
  wrap?: boolean
}) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
      <div
        style={{
          display: 'flex',
          flexWrap: wrap ? 'wrap' : undefined,
          flexDirection: wrap ? undefined : 'column',
          gap: 8,
        }}
      >
        {vals.map((val) => (
          <CheckOption
            key={val}
            label={labelOf(val)}
            selected={current === val}
            onClick={() => onSelect(val)}
            style={wrap ? { flex: '1 1 140px', width: 'auto' } : undefined}
          />
        ))}
      </div>
    </Card>
  )
}

export function Screen2Power({ form }: { form: QuoteForm }) {
  const { data: d, setD } = form
  const s = useStrings()

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.power.kicker}</Kicker>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.power.title}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Section
          title={s.power.outageTitle}
          vals={OUTAGE_VALS}
          labelOf={(v) => s.opt.outage[v]}
          current={d.outageHours}
          onSelect={(val) => setD({ outageHours: val })}
          wrap
        />
        {/* "What to keep running" and "essentials only at night" were asked
            here too. The engine never read them, and Step 5's power-cut
            priority asks the same thing precisely, so they were removed. */}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: C.muted, textAlign: 'center' }}>
          {s.power.footer}
        </p>
      </div>
    </div>
  )
}
