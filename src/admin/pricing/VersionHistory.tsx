import { C } from '../../theme'
import { Badge, Btn, Ltr, SectionCard } from '../controls'
import { fmtDateTime } from '../format'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'
import type { ConfigRow } from './configRepo'

export function VersionHistory({ rows, busy, onActivate }: { rows: ConfigRow[]; busy: boolean; onActivate: (row: ConfigRow) => void }) {
  const { t, lang } = useAdminLang()
  const h = t.pricing.history
  const isMobile = useMobileValue()
  return (
    <SectionCard title={h.title} id="history">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, minWidth: isMobile ? 0 : 210, flex: isMobile ? '1 1 100%' : 'none' }}>
              <Ltr>{row.version}</Ltr>
            </span>
            <span style={{ fontSize: 12.5, color: C.muted, flex: 1, minWidth: 0 }}>
              <Ltr>{fmtDateTime(row.created_at, lang)}</Ltr>
            </span>
            {row.is_active ? (
              <Badge tone="green">{h.liveNow}</Badge>
            ) : (
              <Btn onClick={() => onActivate(row)} disabled={busy} testId={'activate-' + row.id}>
                {h.activate}
              </Btn>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
