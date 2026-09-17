import { C } from '../../../theme'
import { Ltr } from '../../controls'
import { fmtNum } from '../../format'
import { useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigComponentSelect, ConfigNum, useDraft } from '../bound'
import { PriceStatus } from '../ComponentPrices'
import { LineList } from './LineList'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const isMobile = useMobileValue()
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 8, textAlign: 'start' }}>{title}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function CommercialMethod() {
  const { t } = useAdminLang()
  const cm = t.pricing.commercial
  const d = useDraft()
  const cfg = d.draft
  if (!cfg || !cfg.commercial) return null
  const c = cfg.commercial
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Group title={cm.handOver}>
        <ConfigNum path="commercial.customerPath.takesOverAboveKw" label={cm.handOver} unit="kW" help={cm.handOverHelp} min={0} />
      </Group>
      <Group title={cm.constants}>
        <ConfigNum path="commercial.batteryEfficiency" label={cm.batteryEfficiency} min={0} />
        <ConfigNum path="commercial.systemEfficiency" label={cm.systemEfficiency} min={0} />
        <ConfigNum path="commercial.peakSunHours" label={cm.peakSunHours} min={0} />
        <ConfigNum path="commercial.maxDcAcRatio" label={cm.maxDcAcRatio} min={0} />
      </Group>
      <Group title={cm.parts}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12.5, color: C.muted, textAlign: 'start' }}>{cm.panel}</span>
          <ConfigComponentSelect path="commercial.panel.component" ariaLabel={cm.panel} width={220} />
          <ConfigNum path="commercial.panel.watts" label="" unit="W" width={90} min={0} style={{ gap: 0 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12.5, color: C.muted, textAlign: 'start' }}>{cm.battery}</span>
          <ConfigComponentSelect path="commercial.battery.component" ariaLabel={cm.battery} width={220} />
          <ConfigNum path="commercial.battery.kwhEach" label="" unit="kWh" width={90} min={0} style={{ gap: 0 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12.5, color: C.muted, textAlign: 'start' }}>{cm.stand}</span>
          <ConfigComponentSelect path="commercial.stand.component" ariaLabel={cm.stand} width={220} />
          <ConfigNum path="commercial.stand.panelsPerStand" label="" unit={t.pricing.recipe.panelsPerStand} width={90} min={0} style={{ gap: 0 }} />
        </div>
      </Group>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 8, textAlign: 'start' }}>{cm.ladder}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {c.inverterLadder.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                fontSize: 14,
                color: C.body,
              }}
            >
              <Ltr style={{ minWidth: 70, fontWeight: 600 }}>{fmtNum(r.kw)} kW</Ltr>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'start' }} dir="auto">
                {r.component}
              </span>
              <PriceStatus name={r.component} cfg={cfg} />
            </div>
          ))}
        </div>
      </div>
      <LineList path="commercial.perPanel" title={t.pricing.recipe.perPanel} readOnly />
      <LineList path="commercial.perInverter" title={t.pricing.recipe.perInverter} readOnly />
      <LineList path="commercial.fixed" title={t.pricing.recipe.fixed} readOnly />
      <div style={{ fontSize: 12, color: C.faint, textAlign: 'start' }}>{cm.quantitiesFixed}</div>
    </div>
  )
}
