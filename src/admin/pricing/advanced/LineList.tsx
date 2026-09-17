/** An editable list of `{ component, qty }` lines, shared by the two recipes. */
import { C } from '../../../theme'
import { Btn, FieldError } from '../../controls'
import { useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigCell, ConfigComponentSelect, useDraft } from '../bound'
import { getAt } from '../../../pricing/paths'

export function LineList({ path, title, readOnly = false }: { path: string; title: string; readOnly?: boolean }) {
  const { t } = useAdminLang()
  const r = t.pricing.recipe
  const d = useDraft()
  const isMobile = useMobileValue()
  const lines = (getAt(d.draft, path) as { component: string; qty: number }[] | undefined) ?? []
  const listErr = d.fieldErrors[path]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, flex: 1, textAlign: 'start' }}>{title}</div>
        {!readOnly && (
          <Btn
            onClick={() =>
              d.patch((c) => {
                const list = getAt(c, path) as { component: string; qty: number }[]
                list.push({ component: Object.keys(c.components)[0] ?? '', qty: 1 })
              })
            }
          >
            + {r.addLine}
          </Btn>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'flex-start',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {readOnly ? (
                <div style={{ fontSize: 14, color: C.body, lineHeight: '44px', textAlign: 'start' }} dir="auto">
                  {line.component}
                </div>
              ) : (
                <ConfigComponentSelect path={`${path}[${i}].component`} ariaLabel={r.part} width={260} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {readOnly ? (
                <div style={{ fontSize: 14, color: C.body, lineHeight: '44px' }}>× {line.qty}</div>
              ) : (
                <>
                  <div style={{ flex: isMobile ? 1 : 'none' }}>
                    <ConfigCell path={`${path}[${i}].qty`} width={90} min={0} ariaLabel={r.qty} />
                  </div>
                  <Btn
                    ariaLabel={r.removeLine}
                    title={r.removeLine}
                    onClick={() =>
                      d.patch((c) => {
                        const list = getAt(c, path) as unknown[]
                        list.splice(i, 1)
                      })
                    }
                    style={{ width: 44, padding: 0, fontSize: 18, color: C.muted }}
                  >
                    ×
                  </Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {listErr && <FieldError>{listErr.reason}</FieldError>}
    </div>
  )
}
