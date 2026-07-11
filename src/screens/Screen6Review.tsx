import { C } from '../theme'
import { Card, Kicker } from '../components/ui'
import { buildReviewGroups } from '../review'
import { useStrings } from '../i18n'
import type { QuoteForm } from '../useQuoteForm'

export function Screen6Review({
  form,
  onEdit,
}: {
  form: QuoteForm
  onEdit: (step: number) => void
}) {
  const { data: d, setD } = form
  const s = useStrings()
  const groups = buildReviewGroups(d, s)

  return (
    <div style={{ animation: 'stepIn 0.35s ease' }}>
      <Kicker>{s.review.kicker}</Kicker>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 600, color: C.ink }}>
        {s.review.title}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="f-notes" style={{ fontSize: 15, fontWeight: 500 }}>
            {s.review.notesQ}{' '}
            <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>
              {s.review.optional}
            </span>
          </label>
          <textarea
            id="f-notes"
            rows={3}
            value={d.notes}
            onChange={(e) => setD({ notes: e.target.value })}
            placeholder={s.review.notesPlaceholder}
            style={{
              padding: '12px 14px',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 500,
              color: C.body,
              width: '100%',
              resize: 'vertical',
              minHeight: 88,
              fontFamily: "'Tajawal', sans-serif",
            }}
          />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map((g) => (
            <Card key={g.title} style={{ padding: '18px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{g.title}</div>
                <button
                  onClick={() => onEdit(g.step)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: C.red,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 8px',
                    textDecoration: 'underline',
                  }}
                >
                  {s.review.edit}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.rows.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: C.muted, fontWeight: 400, flex: 'none' }}>{row.k}</span>
                    <span style={{ color: C.body, fontWeight: 600, textAlign: 'end' }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
