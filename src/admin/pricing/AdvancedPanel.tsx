/**
 * Collapsed by default. One section open at a time; a chip row on desktop,
 * stacked headers on a phone. Only the open section renders — the whole
 * Advanced area is ~80 controls, and nobody needs them mounted while
 * changing a price.
 */
import { useEffect } from 'react'
import { C, cardStyle } from '../../theme'
import { Badge, Btn } from '../controls'
import { fmtNum } from '../format'
import { useAdminLang } from '../i18n'
import { useMobileValue } from '../useIsMobile'
import { sectionOf } from '../configLabels'
import { useDraft } from './bound'
import { ApplianceAssumptions } from './advanced/ApplianceAssumptions'
import { CommercialMethod } from './advanced/CommercialMethod'
import { CustomBuildRecipe } from './advanced/CustomBuildRecipe'
import { HouseholdSizing } from './advanced/HouseholdSizing'
import { PackageHardware } from './advanced/PackageHardware'

export type AdvancedSection = 'hardware' | 'recipe' | 'appliances' | 'household' | 'commercial'
const ORDER: AdvancedSection[] = ['hardware', 'recipe', 'appliances', 'household', 'commercial']

/** Which Advanced section a config path lives in. */
export function sectionForPath(path: string): AdvancedSection | null {
  switch (sectionOf(path)) {
    case 'packages':
      return 'hardware'
    case 'customBom':
      return 'recipe'
    case 'loadDefaults':
      return 'appliances'
    case 'sizing':
    case 'batteryLifespanYears':
    case 'acBtuCapMode':
      return 'household'
    case 'commercial':
      return 'commercial'
    default:
      return null
  }
}

export function AdvancedPanel({
  open,
  section,
  onToggle,
  onSection,
}: {
  open: boolean
  section: AdvancedSection
  onToggle: () => void
  onSection: (s: AdvancedSection) => void
}) {
  const { t } = useAdminLang()
  const pr = t.pricing
  const d = useDraft()
  const isMobile = useMobileValue()
  const hasCommercial = d.draft?.commercial !== undefined
  const sections = ORDER.filter((s) => s !== 'commercial' || hasCommercial)

  // Problem counts per section, so a closed Advanced still says where to look.
  const counts: Record<AdvancedSection, number> = { hardware: 0, recipe: 0, appliances: 0, household: 0, commercial: 0 }
  for (const path of Object.keys(d.fieldErrors)) {
    const s = sectionForPath(path)
    if (s) counts[s]++
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (section === 'commercial' && !hasCommercial) onSection('hardware')
  }, [section, hasCommercial, onSection])

  const body = {
    hardware: <PackageHardware />,
    recipe: <CustomBuildRecipe />,
    appliances: <ApplianceAssumptions />,
    household: <HouseholdSizing />,
    commercial: <CommercialMethod />,
  }[section]

  return (
    <section id="advanced" style={{ ...cardStyle, scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>
            {pr.advanced} {total > 0 && <Badge tone="red">{fmtNum(total)}</Badge>}
          </h2>
          <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0', lineHeight: 1.5 }}>{pr.advancedBlurb}</p>
        </div>
        <Btn onClick={onToggle} testId="advanced-toggle" ariaExpanded={open}>
          {open ? pr.hide : pr.show}
        </Btn>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <div
            role="tablist"
            aria-label={pr.advanced}
            style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {sections.map((s) => {
              const active = s === section
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="admin-focusable"
                  onClick={() => onSection(s)}
                  data-testid={'advanced-tab-' + s}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 999,
                    border: `1px solid ${active ? C.red : C.border}`,
                    background: active ? C.redTint : C.white,
                    color: active ? C.red : C.body,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'start',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span>{pr.sections[s]}</span>
                  {counts[s] > 0 && <Badge tone="red">{fmtNum(counts[s])}</Badge>}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px', lineHeight: 1.5, textAlign: 'start' }}>
              {pr.sectionBlurb[section]}
            </p>
            {body}
          </div>
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.faint, textAlign: 'start' }}>
            {pr.notEditable}
          </div>
        </div>
      )}
    </section>
  )
}
