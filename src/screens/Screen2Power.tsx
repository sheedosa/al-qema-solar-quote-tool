import type { ReactNode } from 'react'
import { C } from '../theme'
import { Card, CheckOption } from '../components/ui'
import type { QuoteForm } from '../useQuoteForm'

type Opt = { label: string; val: string }

const asOpts = (labels: string[]): Opt[] => labels.map((l) => ({ label: l, val: l }))

const SUPPLY = asOpts(['Public grid', 'Generator', 'Both', 'None'])
const OUTAGE = asOpts(['0–4 hrs', '4–8 hrs', '8–12 hrs', 'More than 12 hrs'])
const PEAK = asOpts(['Daytime (8am–5pm)', 'Night (6pm–7am)', 'All day (~24h)'])
const NIGHT_ECO: Opt[] = [
  { label: 'Yes — essentials only at night', val: 'yes' },
  { label: 'No — I want similar power day and night', val: 'no' },
]
const OPERATION = asOpts([
  'Continuous (fridge, router, cameras)',
  'On and off as needed',
  'Heavy use at specific hours',
])

function Section({
  title,
  opts,
  current,
  onSelect,
  wrap,
}: {
  title: ReactNode
  opts: Opt[]
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
        {opts.map((o) => (
          <CheckOption
            key={o.val}
            label={o.label}
            selected={current === o.val}
            onClick={() => onSelect(o.val)}
            style={wrap ? { flex: '1 1 140px', width: 'auto' } : undefined}
          />
        ))}
      </div>
    </Card>
  )
}

export function Screen2Power({ form }: { form: QuoteForm }) {
  const { data: d, setD } = form

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted,
          marginBottom: 6,
        }}
      >
        Your power use
      </div>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        Your power situation
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Section
          title="Current power supply"
          opts={SUPPLY}
          current={d.supply}
          onSelect={(val) => setD({ supply: val })}
          wrap
        />
        <Section
          title="Average daily power cuts"
          opts={OUTAGE}
          current={d.outageHours}
          onSelect={(val) => setD({ outageHours: val })}
          wrap
        />
        <Section
          title="When do you use the most power?"
          opts={PEAK}
          current={d.peakTime}
          onSelect={(val) => setD({ peakTime: val })}
        />
        <Section
          title="At night, can you run only the essentials to save battery?"
          opts={NIGHT_ECO}
          current={d.nightEconomy}
          onSelect={(val) => setD({ nightEconomy: val })}
        />
        <Section
          title="How do you mostly run things?"
          opts={OPERATION}
          current={d.operation}
          onSelect={(val) => setD({ operation: val })}
        />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: C.muted, textAlign: 'center' }}>
          This helps us size your battery correctly.
        </p>
      </div>
    </div>
  )
}
