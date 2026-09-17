import { ROOF_VALS } from '../../../i18n'
import { C } from '../../../theme'
import { lookup, useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigChoice, ConfigNum, useDraft } from '../bound'

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

export function HouseholdSizing() {
  const { t, opt } = useAdminLang()
  const h = t.pricing.household
  const d = useDraft()
  const cfg = d.draft
  if (!cfg) return null
  const roofKeys = Array.from(new Set([...ROOF_VALS, ...Object.keys(cfg.sizing.roofAreaM2ByAnswer)]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Group title={h.sun}>
        <ConfigNum path="sizing.peakSunHours" label={h.peakSunHours} help={h.peakSunHoursHelp} min={0} />
        <ConfigNum path="sizing.systemEfficiency" label={h.systemEfficiency} help={h.systemEfficiencyHelp} min={0} />
      </Group>
      <Group title={h.battery}>
        <ConfigNum path="sizing.dodByChemistry.liquid" label={h.dodLiquid} min={0} />
        <ConfigNum path="sizing.dodByChemistry.lithium" label={h.dodLithium} min={0} />
        <ConfigNum path="sizing.liquidBatteryVoltageV" label={h.liquidVolts} unit="V" min={0} />
        <ConfigNum path="sizing.alwaysOnNightHours" label={h.nightHours} unit="h" min={0} />
        <ConfigNum path="batteryLifespanYears.liquid" label={`${h.lifespan} — ${t.detail.chemistry.liquid}`} min={0} />
        <ConfigNum path="batteryLifespanYears.lithium" label={`${h.lifespan} — ${t.detail.chemistry.lithium}`} min={0} />
      </Group>
      <Group title={h.inverter}>
        <ConfigNum path="sizing.inverterSafetyFactor" label={h.safetyFactor} help={h.safetyFactorHelp} min={0} />
        <ConfigNum path="sizing.diversityFactor" label={h.diversityFactor} help={h.diversityFactorHelp} min={0} />
        <ConfigNum path="sizing.kvaToKw" label={h.kvaToKw} min={0} />
      </Group>
      <Group title={h.surge}>
        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: C.muted, textAlign: 'start' }}>{h.surgeHelp}</div>
        <ConfigNum path="sizing.surgeFactorByCategory.ac" label={t.pricing.paths.field.ac} min={0} />
        <ConfigNum path="sizing.surgeFactorByCategory.cold" label={t.pricing.paths.field.cold} min={0} />
        <ConfigNum path="sizing.surgeFactorByCategory.lighting" label={t.pricing.paths.field.lighting} min={0} />
        <ConfigNum path="sizing.surgeFactorByCategory.appliance" label={t.pricing.paths.field.appliance} min={0} />
      </Group>
      <Group title={h.ac}>
        <ConfigChoice
          path="acBtuCapMode"
          label={h.acBtuCapMode}
          width={320}
          choices={[
            { value: 'advisory', label: h.acBtuCapModeOptions.advisory },
            { value: 'strict', label: h.acBtuCapModeOptions.strict },
          ]}
        />
      </Group>
      <Group title={h.roof}>
        <ConfigNum path="sizing.panelAreaM2" label={h.panelArea} unit="m²" min={0} />
        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, fontWeight: 500, color: C.muted, textAlign: 'start' }}>
          {h.roofArea} — {h.roofAreaHelp}
        </div>
        {roofKeys.map((k) => (
          <ConfigNum key={k} path={`sizing.roofAreaM2ByAnswer["${k}"]`} label={lookup(opt.roof, k)} unit="m²" min={0} />
        ))}
      </Group>
    </div>
  )
}
