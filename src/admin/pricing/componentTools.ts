/**
 * Helpers for the component price list: a display-only grouping inferred from
 * the name, which builds reference a component, and a rename that follows
 * every reference so a renamed part cannot orphan a recipe line.
 */
import { commercialComponents } from '../../pricing/commercial'
import type { PricingConfig } from '../../pricing/types'

export type ComponentCategory =
  | 'commercialInverters'
  | 'inverters'
  | 'batteries'
  | 'panels'
  | 'mounting'
  | 'services'
  | 'misc'

export const CATEGORY_ORDER: readonly ComponentCategory[] = [
  'commercialInverters',
  'inverters',
  'batteries',
  'panels',
  'mounting',
  'services',
  'misc',
]

/**
 * Heuristic, for reading only — a wrong group changes nothing about how a
 * part is priced. Rules are ordered: Ah/lithium before the inverter brands,
 * because "Luminous 200Ah" is a battery and "Luminous 1100VA" is not.
 */
const RULES: [RegExp, ComponentCategory][] = [
  [/\d\s*ah\b|lithium|shoto|battery/i, 'batteries'],
  [/inverter|growatt|luminous|veichi|delixi|\bups\b|\bva\b|hommer/i, 'inverters'],
  [/jinko|\b\d{3}\s*w\b|panel/i, 'panels'],
  [/stand|clamp|cable|busbar|switch|combiner|mccb|\bmts\b/i, 'mounting'],
  [/install|transport|consumable|handling/i, 'services'],
]

export function categorize(name: string, cfg: PricingConfig): ComponentCategory {
  if (cfg.commercial && cfg.commercial.inverterLadder.some((r) => r.component === name)) return 'commercialInverters'
  for (const [re, cat] of RULES) if (re.test(name)) return cat
  return 'misc'
}

/** The household custom build's component names. */
export function householdComponents(cfg: PricingConfig): string[] {
  const cb = cfg.customBom
  return [
    cb.panel.component,
    cb.battery.component,
    cb.inverter.single.component,
    cb.inverter.parallel.component,
    cb.stand.component,
    ...cb.perPanel.map((l) => l.component),
    ...cb.perInverter.map((l) => l.component),
    ...cb.fixed.map((l) => l.component),
  ]
}

export type UsedBy = { household: boolean; commercial: boolean }

export function usedBy(name: string, cfg: PricingConfig): UsedBy {
  return {
    household: householdComponents(cfg).includes(name),
    commercial: cfg.commercial ? commercialComponents(cfg.commercial).includes(name) : false,
  }
}

/**
 * Rename a component everywhere: the price key (kept in place, so the list
 * does not jump) and every recipe line that names it. No-op if the target
 * name is taken or empty.
 */
export function renameComponent(draft: PricingConfig, from: string, to: string): boolean {
  const target = to.trim()
  if (!target || target === from || target in draft.components || !(from in draft.components)) return false
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(draft.components)) next[k === from ? target : k] = v
  draft.components = next
  const swap = (o: { component: string }) => {
    if (o.component === from) o.component = target
  }
  const cb = draft.customBom
  swap(cb.panel)
  swap(cb.battery)
  swap(cb.inverter.single)
  swap(cb.inverter.parallel)
  swap(cb.stand)
  cb.perPanel.forEach(swap)
  cb.perInverter.forEach(swap)
  cb.fixed.forEach(swap)
  const cm = draft.commercial
  if (cm) {
    swap(cm.panel)
    swap(cm.battery)
    swap(cm.stand)
    cm.inverterLadder.forEach(swap)
    cm.perPanel.forEach(swap)
    cm.perInverter.forEach(swap)
    cm.fixed.forEach(swap)
  }
  return true
}

/** Split a search string into terms; every term must appear in the name. */
export function matchesSearch(name: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hay = name.toLowerCase()
  return terms.every((term) => hay.includes(term))
}
