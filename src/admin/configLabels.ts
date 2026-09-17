/**
 * Human labels for pricing-config paths and validator reasons.
 *
 * The validator emits `packages[2].priceLyd: must be a positive number`. That
 * is exact and useless to a sales manager. This module turns the path into
 * "Packages · L package · price (LYD)" and the reason into "must be a number
 * above 0", in either language, by composing small bilingual parts from the
 * admin bundle rather than translating whole sentences.
 *
 * Pure: the same functions label a field, an error, and a line in the review
 * sheet's list of changes.
 */
import { parsePath } from '../pricing/paths'
import type { Seg } from '../pricing/paths'
import { TIER_ORDER } from '../pricing/validate'
import type { Strings } from '../i18n'
import type { AdminStrings } from './strings'

type Paths = AdminStrings['pricing']['paths']
type Opt = Strings['opt']

const key = (s: Seg | undefined): string | null => (s && 'key' in s ? s.key : null)

/**
 * The label as parts, section first: `['Packages', 'L package', 'price (LYD)']`.
 * A caller grouping by section drops the first part.
 */
export function labelParts(path: string, t: AdminStrings, opt?: Opt): string[] {
  const p: Paths = t.pricing.paths
  const segs = parsePath(path)
  const parts: string[] = []
  segs.forEach((seg, i) => {
    const prev = key(segs[i - 1])
    if ('index' in seg) {
      if (prev === 'packages') parts.push(p.packageItem(TIER_ORDER[seg.index] ?? String(seg.index + 1)))
      else if (prev === 'inverterLadder') parts.push(p.ladderItem(seg.index + 1))
      else parts.push(p.listItem(seg.index + 1))
      return
    }
    if (i === 0) {
      parts.push(p.section[seg.key] ?? seg.key)
      return
    }
    // "Appliance assumptions · appliances · TV" says appliances twice; the
    // preset name alone is the item. The bare key (a missing-preset error)
    // still gets its field label.
    if (seg.key === 'appliancesByName' && key(segs[i + 1]) !== null) return
    // Map keys are names, not fields: a component, an appliance preset or a
    // roof answer. Presets and roof answers have customer-facing labels.
    if (prev === 'components') parts.push(seg.key)
    else if (prev === 'appliancesByName') parts.push(opt?.preset[seg.key] ?? seg.key)
    else if (prev === 'roofAreaM2ByAnswer') parts.push(opt?.roof[seg.key] ?? seg.key)
    else parts.push(p.field[seg.key] ?? seg.key)
  })
  return parts
}

export const labelForPath = (path: string, t: AdminStrings, opt?: Opt): string =>
  labelParts(path, t, opt).join(' · ')

/** The top-level config key a path belongs to. */
export function sectionOf(path: string): string {
  const first = parsePath(path)[0]
  return first && 'key' in first ? first.key : path
}

/** Paths whose value is money, so the review sheet formats them as such. */
export const isMoneyPath = (path: string): boolean =>
  /(^|\.)(priceLyd|roundUpToLyd|minimumLyd)$/.test(path) || /^components\[/.test(path)

type Reasons = Paths['reason']
type Rule = [RegExp, (m: RegExpMatchArray, r: Reasons) => string]

/**
 * Ordered: the first matching rule wins, so the specific phrases sit above the
 * generic ones ('needs watts > 0 and duty…' before 'needs watts > 0').
 */
const RULES: Rule[] = [
  [/^must be between (\S+) and (\S+)(?: kW)?$/, (m, r) => r.between(m[1], m[2])],
  [/^must be a number between 0 and 24$/, (_, r) => r.hours24],
  [/^must be at least the XXL price \((\d+)\)/, (m, r) => r.floorBelowXxl(m[1])],
  [/^missing '(.+)' — the form offers it/, (m, r) => r.missingPreset(m[1])],
  [/^prices must not decrease/, (_, r) => r.monotonic],
  [/^must be null or a positive number$/, (_, r) => r.positiveOrEmpty],
  [/^must be an integer ≥ 0$/, (_, r) => r.wholeNumber],
  [/^must be in \(0, 1\]$/, (_, r) => r.fraction],
  [/^liquid and lithium must be in \(0, 1\]$/, (_, r) => r.dodPair],
  [/^liquid and lithium must be positive numbers$/, (_, r) => r.lifespanPair],
  [/^standard and inverter must be positive numbers$/, (_, r) => r.pairPositive],
  [/^(led\/regular\/mixed must be positive numbers|new and old must be positive)$/, (_, r) => r.allPositive],
  [/^ac\/cold\/lighting\/appliance must each be between 1 and 10$/, (_, r) => r.surge],
  [/^must be a positive number of m² under 20$/, (_, r) => r.panelArea],
  [/^every entry must be a non-negative number of m²$/, (_, r) => r.roofAreas],
  [/^liquid needs integer count > 0 and ampHours > 0$/, (_, r) => r.liquidBattery],
  [/^lithium needs integer count > 0 and kwhEach > 0$/, (_, r) => r.lithiumBattery],
  [/^needs integer count > 0 and watts > 0$/, (_, r) => r.panelSpec],
  [/^needs watts > 0 and duty in \(0, 1\]$/, (_, r) => r.wattsDuty],
  [/^needs watts > 0 and hours ≥ 0$/, (_, r) => r.wattsHours],
  [/^needs watts > 0$/, (_, r) => r.watts],
  [/^needs (a known |a )?component name and watts > 0$/, (_, r) => r.componentAndWatts],
  [/^needs (a known |a )?component name and kwhEach > 0$/, (_, r) => r.componentAndKwh],
  [/^single and parallel need known components and positive kW$/, (_, r) => r.inverterParts],
  [/^needs a (known )?component( name)? and integer panelsPerStand > 0$/, (_, r) => r.standParts],
  [/^not found in the component list$/, (_, r) => r.unknownComponent],
  [/^needs qty > 0$/, (_, r) => r.qty],
  [/^needs kw > 0 and a component name$/, (_, r) => r.kwAndName],
  [/^sizes must ascend$/, (_, r) => r.ascending],
  [/^needs at least one size$/, (_, r) => r.atLeastOne],
  [/^needs a name$/, (_, r) => r.needsName],
  [/^contains an empty component name$/, (_, r) => r.emptyName],
  [/^each add-on needs a name and a positive priceLyd$/, (_, r) => r.addOn],
  [/^must be 'liquid' or 'lithium'$/, (_, r) => r.chemistry],
  [/^must be 'advisory' or 'strict'$/, (_, r) => r.acBtuCapMode],
  [/^must be 'new' or 'old'$/, (_, r) => r.newOrOld],
  [/^must be at least 1$/, (_, r) => r.ratio],
  [/^(price must be a number ≥ 0|≥ 0)$/, (_, r) => r.nonNegative],
  [/^(must be a positive number|must be positive)$/, (_, r) => r.positive],
  [
    /^(not an object|must be an array|must be an array of exactly 5 packages|must be a non-empty string|must be 'LYD'|must only contain known include ids|must be \w+ \(in order\)|must be a non-empty name → price map)$/,
    (_, r) => r.structural,
  ],
]

export type LabeledError = {
  /** The config path the validator attached the message to. */
  path: string
  /** `Section · item · field`, human. */
  label: string
  /** The reason in the admin's language. */
  reason: string
  /** False when no rule matched and `reason` is the validator's raw English. */
  known: boolean
}

// A path is dotted identifiers, `[n]` and `["name"]` segments; the name may
// contain anything but a double quote. The first `: ` after it starts the why.
const MESSAGE = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\]|\["[^"]*"\])*): (.*)$/s

/** Turn one validator message into a labelled, translated error. */
export function labelForError(message: string, t: AdminStrings, opt?: Opt): LabeledError {
  const m = message.match(MESSAGE)
  if (!m) return { path: '', label: message, reason: '', known: false }
  const [, path, why] = m
  const r = t.pricing.paths.reason
  for (const [re, make] of RULES) {
    const hit = why.match(re)
    if (hit) return { path, label: labelForPath(path, t, opt), reason: make(hit, r), known: true }
  }
  return { path, label: labelForPath(path, t, opt), reason: why, known: false }
}

/** Every validator message, labelled, keyed by path — the first message per path wins. */
export function fieldErrors(messages: readonly string[], t: AdminStrings, opt?: Opt): Record<string, LabeledError> {
  const out: Record<string, LabeledError> = {}
  for (const msg of messages) {
    const e = labelForError(msg, t, opt)
    if (e.path && !(e.path in out)) out[e.path] = e
  }
  return out
}
