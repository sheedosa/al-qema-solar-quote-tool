/**
 * The read-only line beside a package: what it contains and what that means
 * for the tier match — kWp, usable kWh, AC allowance. Derived live from the
 * draft via the engine's own helpers, so an edit under Advanced shows here at
 * once. Every figure guards non-finite input and shows a dash.
 */
import { packageBatteryUsableKwh, packageKwp } from '../../pricing/engine'
import type { Package, PricingConfig } from '../../pricing/types'
import { Dots, Ltr } from '../controls'
import { fmtNum, plural } from '../format'
import { useAdminLang } from '../i18n'

const fin = (n: number, frac = 1): string | null => (Number.isFinite(n) ? fmtNum(n, frac) : null)

export function PackageSummary({ p, cfg }: { p: Package; cfg: PricingConfig }) {
  const { t, lang } = useAdminLang()
  const pr = t.pricing
  const kwp = fin(packageKwp(p), 2)
  const usable = fin(packageBatteryUsableKwh(p, cfg), 1)
  const batt =
    p.battery.chemistry === 'liquid'
      ? `${fmtNum(p.battery.count)} × ${fmtNum(p.battery.ampHours)} Ah`
      : `${fmtNum(p.battery.count)} × ${fmtNum(p.battery.kwhEach)} kWh`
  const acs =
    p.maxAcUnits <= 0
      ? pr.noAc
      : plural(p.maxAcUnits, pr.upToAcs, lang) +
        (p.maxAcBtu !== null && Number.isFinite(p.maxAcBtu) ? ` · ≤ ${fmtNum(p.maxAcBtu)} BTU` : '')
  return (
    <Dots
      parts={[
        <Ltr>{fmtNum(p.inverterKva, 1)} kVA</Ltr>,
        <>
          <Ltr>
            {fmtNum(p.panel.count)} × {fmtNum(p.panel.watts)} W
          </Ltr>
          {kwp && (
            <>
              {' = '}
              <Ltr>{kwp} kWp</Ltr>
            </>
          )}
        </>,
        <>
          <Ltr>{batt}</Ltr> {t.detail.chemistry[p.battery.chemistry]}
          {usable && (
            <>
              {' = '}
              <Ltr>{usable} kWh</Ltr> {pr.usable}
            </>
          )}
        </>,
        p.maxAcUnits <= 0 ? acs : <Ltr>{acs}</Ltr>,
      ]}
    />
  )
}
