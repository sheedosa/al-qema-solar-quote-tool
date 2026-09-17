/**
 * The appliance table (a card per appliance on a phone), the bulb wattages,
 * fridge/freezer, AC watts-per-BTU, and the default for a device the customer
 * types in — the single most impactful hidden default.
 */
import { C } from '../../../theme'
import { Badge, FieldError, thText } from '../../controls'
import { lookup, useAdminLang } from '../../i18n'
import { useMobileValue } from '../../useIsMobile'
import { ConfigCell, ConfigCheck, ConfigNum, useDraft } from '../bound'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const isMobile = useMobileValue()
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 8, textAlign: 'start' }}>{title}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ApplianceAssumptions() {
  const { t, opt } = useAdminLang()
  const a = t.pricing.appliances
  const d = useDraft()
  const isMobile = useMobileValue()
  const cfg = d.draft
  if (!cfg) return null
  const names = Object.keys(cfg.loadDefaults.appliancesByName)
  const tableErr = d.fieldErrors['loadDefaults.appliancesByName']
  const at = (n: string) => `loadDefaults.appliancesByName["${n}"]`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {names.map((n) => {
              const def = cfg.loadDefaults.appliancesByName[n]
              return (
                <div key={n} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 8, textAlign: 'start' }}>
                    {lookup(opt.preset, n)} {def.heavy && <Badge tone="amber">{a.heavy}</Badge>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <ConfigNum path={`${at(n)}.watts`} label={a.watts} unit="W" min={0} />
                    {!def.alwaysOn && (
                      <ConfigNum path={`${at(n)}.hours`} label={a.hoursPerDay} min={0} emptyAs="undefined" />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: C.body }}>
                      <ConfigCheck path={`${at(n)}.night`} ariaLabel={a.night} /> {a.night}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: C.body }}>
                      <ConfigCheck path={`${at(n)}.alwaysOn`} ariaLabel={a.alwaysOn} /> {a.alwaysOn}
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thText}>{a.appliance}</th>
                <th style={thText}>{a.watts}</th>
                <th style={thText}>{a.hoursPerDay}</th>
                <th style={{ ...thText, textAlign: 'center' }}>{a.night}</th>
                <th style={{ ...thText, textAlign: 'center' }}>{a.alwaysOn}</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const def = cfg.loadDefaults.appliancesByName[n]
                return (
                  <tr key={n}>
                    <td style={{ padding: '6px 12px', fontSize: 14, color: C.body, textAlign: 'start' }}>
                      {lookup(opt.preset, n)} {def.heavy && <Badge tone="amber">{a.heavy}</Badge>}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <ConfigCell path={`${at(n)}.watts`} width={90} min={0} ariaLabel={`${lookup(opt.preset, n)} — ${a.watts}`} />
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      {def.alwaysOn ? (
                        <span style={{ fontSize: 13, color: C.faint }}>24</span>
                      ) : (
                        <ConfigCell
                          path={`${at(n)}.hours`}
                          width={80}
                          min={0}
                          emptyAs="undefined"
                          ariaLabel={`${lookup(opt.preset, n)} — ${a.hoursPerDay}`}
                        />
                      )}
                    </td>
                    <td style={{ padding: 0, textAlign: 'center' }}>
                      <ConfigCheck path={`${at(n)}.night`} ariaLabel={`${lookup(opt.preset, n)} — ${a.night}`} />
                    </td>
                    <td style={{ padding: 0, textAlign: 'center' }}>
                      <ConfigCheck path={`${at(n)}.alwaysOn`} ariaLabel={`${lookup(opt.preset, n)} — ${a.alwaysOn}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {tableErr && <FieldError>{tableErr.reason}</FieldError>}
      </div>

      <Group title={a.otherDevice}>
        <ConfigNum path="loadDefaults.customAppliance.watts" label={a.watts} unit="W" min={0} />
        <ConfigNum path="loadDefaults.customAppliance.hours" label={a.hoursPerDay} min={0} />
      </Group>

      <Group title={a.lighting}>
        <ConfigNum path="loadDefaults.lightingWattsByType.led" label={a.bulbWatts.led} unit="W" min={0} />
        <ConfigNum path="loadDefaults.lightingWattsByType.regular" label={a.bulbWatts.regular} unit="W" min={0} />
        <ConfigNum path="loadDefaults.lightingWattsByType.mixed" label={a.bulbWatts.mixed} unit="W" min={0} />
        <ConfigNum path="loadDefaults.lightingHours" label={a.lightingHours} min={0} />
      </Group>

      <Group title={a.cold}>
        <ConfigNum path="loadDefaults.fridge.watts" label={a.fridgeWatts} unit="W" min={0} />
        <ConfigNum path="loadDefaults.fridge.duty" label={a.duty} min={0} />
        <ConfigNum path="loadDefaults.freezer.watts" label={a.freezerWatts} unit="W" min={0} />
        <ConfigNum path="loadDefaults.freezer.duty" label={a.duty} min={0} />
      </Group>

      <Group title={a.ac}>
        <ConfigNum path="loadDefaults.acWattsPerBtu.standard" label={a.acStandard} min={0} />
        <ConfigNum path="loadDefaults.acWattsPerBtu.inverter" label={a.acInverter} min={0} />
        <ConfigNum path="loadDefaults.assumedAcBtu" label={a.assumedAcBtu} unit="BTU" min={0} />
      </Group>
    </div>
  )
}
