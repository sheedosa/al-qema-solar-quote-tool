/** One card per package — never a table. A battery-type change swaps the object to a valid default shape. */
import { packageBatteryUsableKwh, packageKwp } from '../../../pricing/engine'
import type { Package } from '../../../pricing/types'
import { C } from '../../../theme'
import { Badge, Dots, Ltr } from '../../controls'
import { fmtNum } from '../../format'
import { useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigChoice, ConfigNum, Readout, useDraft } from '../bound'

export const packageCardId = (tier: string) => 'adv-pkg-' + tier

function Card({ p, i }: { p: Package; i: number }) {
  const { t } = useAdminLang()
  const h = t.pricing.hardware
  const d = useDraft()
  const isMobile = useMobileValue()
  const cfg = d.draft!
  const at = `packages[${i}]`
  const kwp = packageKwp(p)
  const usable = packageBatteryUsableKwh(p, cfg)
  const invKw = p.inverterKva * cfg.sizing.kvaToKw
  const fin = (n: number, f = 1) => (Number.isFinite(n) ? fmtNum(n, f) : t.common.dash)
  return (
    <div
      id={packageCardId(p.tier)}
      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, scrollMarginTop: 80 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge tone="red" style={{ fontSize: 14, minWidth: 40, textAlign: 'center' }}>
          {p.tier}
        </Badge>
        <Readout>
          <Dots
            parts={[
              <>
                <Ltr>{fin(kwp, 2)} kWp</Ltr> {h.array}
              </>,
              <>
                <Ltr>{fin(usable)} kWh</Ltr> {t.pricing.usable}
              </>,
              <>
                <Ltr>{fin(invKw, 2)} kW</Ltr> {h.inverterKw}
              </>,
            ]}
          />
        </Readout>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <ConfigNum path={`${at}.inverterKva`} label={h.inverter} unit="kVA" width={100} min={0} />
        <ConfigNum path={`${at}.panel.count`} label={h.panels} width={100} min={0} step={1} />
        <ConfigNum path={`${at}.panel.watts`} label={h.panelWatts} unit="W" width={100} min={0} />
        <ConfigChoice
          path={`${at}.battery.chemistry`}
          label={h.batteryType}
          width={160}
          choices={[
            { value: 'liquid', label: t.detail.chemistry.liquid },
            { value: 'lithium', label: t.detail.chemistry.lithium },
          ]}
          onChange={(v) =>
            d.patch((c) => {
              const b = c.packages[i].battery
              c.packages[i].battery =
                v === 'lithium'
                  ? { chemistry: 'lithium', count: b.count, kwhEach: 5 }
                  : { chemistry: 'liquid', count: b.count, ampHours: 200 }
            })
          }
        />
        <ConfigNum path={`${at}.battery.count`} label={h.batteries} width={100} min={0} step={1} />
        {p.battery.chemistry === 'liquid' ? (
          <ConfigNum path={`${at}.battery.ampHours`} label={h.ahEach} unit="Ah" width={100} min={0} />
        ) : (
          <ConfigNum path={`${at}.battery.kwhEach`} label={h.kwhEach} unit="kWh" width={100} min={0} />
        )}
        <ConfigNum path={`${at}.maxAcUnits`} label={h.maxAcs} width={100} min={0} step={1} />
        <ConfigNum path={`${at}.maxAcBtu`} label={h.maxAcBtu} unit="BTU" help={h.maxAcBtuHelp} width={110} min={0} />
      </div>
    </div>
  )
}

export function PackageHardware() {
  const d = useDraft()
  const cfg = d.draft
  if (!cfg) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cfg.packages.map((p, i) => (
        <Card key={p.tier} p={p} i={i} />
      ))}
    </div>
  )
}
