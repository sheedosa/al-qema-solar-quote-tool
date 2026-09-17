/**
 * The page a sales manager opens to: five package prices, the custom-build
 * floor and round-up, and the add-ons. No table at any breakpoint — a row per
 * package with the derived summary and ONE input.
 */
import { bomTotal } from '../../pricing/engine'
import type { PricingConfig } from '../../pricing/types'
import { TIER_ORDER } from '../../pricing/validate'
import { C } from '../../theme'
import { Badge, Btn, Money, SectionCard } from '../controls'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'
import { ConfigCell, ConfigNum, ConfigText, useDraft } from './bound'
import { PackageSummary } from './PackageSummary'

/** Sum a recipe list at the draft's prices; null if a part has no price. */
function safeTotal(items: { component: string; qty: number }[], cfg: PricingConfig): number | null {
  try {
    return bomTotal(
      items.map((l) => ({ name: l.component, qty: l.qty })),
      cfg,
    )
  } catch {
    return null
  }
}

export function PricesPanel({ onEditHardware }: { onEditHardware: (tier: string) => void }) {
  const { t } = useAdminLang()
  const pr = t.pricing
  const d = useDraft()
  const isMobile = useMobileValue()
  const cfg = d.draft
  if (!cfg) return null

  const cb = cfg.customBom
  const oneOff = safeTotal(cb.fixed, cfg)
  const panelUnit = cfg.components[cb.panel.component]
  const standUnit = cfg.components[cb.stand.component]
  const perPanel =
    panelUnit !== undefined && standUnit !== undefined && safeTotal(cb.perPanel, cfg) !== null
      ? panelUnit + standUnit / Math.max(1, cb.stand.panelsPerStand) + (safeTotal(cb.perPanel, cfg) as number)
      : null
  const invUnit = cfg.components[cb.inverter.parallel.component]
  const perInverter =
    invUnit !== undefined && safeTotal(cb.perInverter, cfg) !== null
      ? invUnit + (safeTotal(cb.perInverter, cfg) as number)
      : null

  return (
    <>
      <SectionCard title={pr.packagePrices} blurb={pr.packagePricesBlurb} id="prices-packages">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cfg.packages.map((p, i) => (
            <div
              key={p.tier}
              data-testid={'package-row-' + p.tier}
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: isMobile ? 8 : 16,
                padding: '12px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <Badge tone="red" style={{ fontSize: 14, minWidth: 40, textAlign: 'center' }}>
                  {p.tier}
                </Badge>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
                  <div style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>
                    <PackageSummary p={p} cfg={cfg} />
                  </div>
                  <button
                    type="button"
                    className="admin-focusable"
                    onClick={() => onEditHardware(p.tier)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0',
                      minHeight: 44,
                      color: C.red,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {pr.editHardware}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                <div style={{ flex: isMobile ? 1 : 'none' }}>
                  <ConfigCell
                    path={`packages[${i}].priceLyd`}
                    width={130}
                    min={0}
                    ariaLabel={`${TIER_ORDER[i]} — ${pr.paths.field.priceLyd}`}
                  />
                </div>
                <span style={{ fontSize: 13, color: C.muted, flex: 'none' }}>{t.common.currency}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={pr.customSystems} blurb={pr.customSystemsBlurb} id="prices-custom">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          <ConfigNum path="customBom.minimumLyd" label={pr.minimumPrice} unit={t.common.currency} width={140} min={0} />
          <ConfigNum path="customBom.roundUpToLyd" label={pr.roundUpHousehold} unit={t.common.currency} width={140} min={0} />
          {cfg.commercial && (
            <ConfigNum path="commercial.roundUpToLyd" label={pr.roundUpCommercial} unit={t.common.currency} width={140} min={0} />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 24px',
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            fontSize: 13,
            color: C.muted,
          }}
        >
          <span>
            {pr.oneOffItems}: <Money n={oneOff} style={{ color: C.body, fontWeight: 600 }} />
          </span>
          <span>
            {pr.perPanelAllIn}: <Money n={perPanel} style={{ color: C.body, fontWeight: 600 }} />
          </span>
          <span>
            {pr.perInverterAllIn}: <Money n={perInverter} style={{ color: C.body, fontWeight: 600 }} />
          </span>
        </div>
      </SectionCard>

      <AddOnsEditor />
    </>
  )
}

function AddOnsEditor() {
  const { t } = useAdminLang()
  const pr = t.pricing
  const d = useDraft()
  const isMobile = useMobileValue()
  const cfg = d.draft
  if (!cfg) return null
  const listErr = d.fieldErrors['addOns']
  return (
    <SectionCard
      title={pr.addOns}
      blurb={pr.addOnsBlurb}
      id="prices-addons"
      end={
        <Btn
          onClick={() => d.patch((c) => void c.addOns.push({ name: '', priceLyd: 0 }))}
          testId="add-addon"
        >
          + {pr.addAddOn}
        </Btn>
      }
    >
      {cfg.addOns.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>{pr.noAddOns}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cfg.addOns.map((a, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'flex-start',
              gap: 8,
            }}
          >
            <ConfigText path={`addOns[${i}].name`} ariaLabel={pr.addOnName} placeholder={pr.addOnName} width={280} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: isMobile ? 1 : 'none' }}>
                <ConfigCell path={`addOns[${i}].priceLyd`} width={120} min={0} ariaLabel={pr.paths.field.priceLyd} />
              </div>
              <span style={{ fontSize: 13, color: C.muted, lineHeight: '44px', flex: 'none' }}>{t.common.currency}</span>
              <Btn
                ariaLabel={pr.removeAddOn(a.name)}
                title={pr.removeAddOn(a.name)}
                onClick={() => d.patch((c) => void c.addOns.splice(i, 1))}
                style={{ width: 44, padding: 0, fontSize: 18, color: C.muted }}
              >
                ×
              </Btn>
            </div>
          </div>
        ))}
      </div>
      {listErr && (
        <div role="alert" style={{ fontSize: 12.5, color: C.red, marginTop: 8, textAlign: 'start' }}>
          {listErr.reason}
        </div>
      )}
    </SectionCard>
  )
}
