import { C } from '../../../theme'
import { useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigComponentSelect, ConfigNum, useDraft } from '../bound'
import { LineList } from './LineList'

function PartRow({ label, path, ratingPath, unit }: { label: string; path: string; ratingPath?: string; unit?: string }) {
  const isMobile = useMobileValue()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: C.muted, textAlign: 'start' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
        <ConfigComponentSelect path={path} ariaLabel={label} width={220} />
        {ratingPath && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ConfigNum path={ratingPath} label="" unit={unit} width={90} min={0} style={{ gap: 0 }} />
          </div>
        )}
      </div>
    </div>
  )
}

export function CustomBuildRecipe() {
  const { t } = useAdminLang()
  const r = t.pricing.recipe
  const d = useDraft()
  const isMobile = useMobileValue()
  if (!d.draft) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        <PartRow label={r.panel} path="customBom.panel.component" ratingPath="customBom.panel.watts" unit="W" />
        <PartRow label={r.battery} path="customBom.battery.component" ratingPath="customBom.battery.kwhEach" unit="kWh" />
        <PartRow
          label={r.singleInverter}
          path="customBom.inverter.single.component"
          ratingPath="customBom.inverter.single.maxKw"
          unit="kW"
        />
        <PartRow
          label={r.parallelInverter}
          path="customBom.inverter.parallel.component"
          ratingPath="customBom.inverter.parallel.unitKw"
          unit="kW"
        />
        <PartRow label={r.stand} path="customBom.stand.component" ratingPath="customBom.stand.panelsPerStand" unit={r.panelsPerStand} />
      </div>
      <LineList path="customBom.perPanel" title={r.perPanel} />
      <LineList path="customBom.perInverter" title={r.perInverter} />
      <LineList path="customBom.fixed" title={r.fixed} />
    </div>
  )
}
