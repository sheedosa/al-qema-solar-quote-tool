import type { ReactNode } from 'react'
import { C } from '../theme'
import { Card, CheckOption, Kicker } from '../components/ui'
import { OPERATION_VALS, OUTAGE_VALS, useStrings } from '../i18n'
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
        {/* The ladder comes before the night question, which refines it. */}
        <Section
          title={s.power.operationTitle}
          vals={OPERATION_VALS}
          labelOf={(v) => s.opt.operation[v]}
          current={d.operation}
          onSelect={(val) => setD({ operation: val })}
        />
        <Section
          title={s.power.nightTitle}
          vals={['yes', 'no']}
          labelOf={(v) => s.opt.nightEconomyFull[v]}
          current={d.nightEconomy}
          onSelect={(val) => setD({ nightEconomy: val })}
        />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: C.muted, textAlign: 'center' }}>
          {s.power.footer}
        </p>
      </div>
    </div>
  )
}
