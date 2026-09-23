import { fetchActiveConfig } from '../backend/api'
import { PRICING_CONFIG } from './config'
import type { PricingConfig } from './types'
import { validatePricingConfig } from './validate'

/**
 * Boot-time pricing-config loader. Resolution order:
 *   1. the active version in the backend's Pricing tab,
 *   2. the last good copy cached in localStorage,
 *   3. the config bundled with the app.
 * Whichever wins is used for the WHOLE session — the price a customer sees,
 * the configVersion on screen, and the persisted lead always agree.
 * Never throws.
 */

const CACHE_KEY = 'alqema.pricing.cache.v1'

export type LoadedConfig = { cfg: PricingConfig; source: 'remote' | 'cache' | 'bundled' }

function fromCache(): PricingConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = validatePricingConfig(JSON.parse(raw))
    return parsed.ok ? parsed.config : null
  } catch {
    return null
  }
}

/**
 * How long to wait for the backend. Apps Script can take a few seconds to
 * wake up, and a first-time visitor has no cached copy — falling back to the
 * bundled prices there would quote them figures the team may have changed.
 * A returning visitor already holds the last published version, so a slow
 * backend costs them less.
 */
export const TIMEOUT_NO_CACHE_MS = 6000
export const TIMEOUT_WITH_CACHE_MS = 3000

export async function loadActiveConfig(timeoutMs?: number): Promise<LoadedConfig> {
  const cached = fromCache()
  const wait = timeoutMs ?? (cached ? TIMEOUT_WITH_CACHE_MS : TIMEOUT_NO_CACHE_MS)
  try {
    const res = await fetchActiveConfig(wait)
    // `config: null` means nothing has been published yet: the bundled
    // prices ARE the prices, so it is not a failure and the cache stays.
    if (res.ok && res.config !== null) {
      const checked = validatePricingConfig(res.config)
      if (checked.ok) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(checked.config))
        } catch {
          // storage full/blocked — cache is best-effort
        }
        return { cfg: checked.config, source: 'remote' }
      }
      console.warn('[alqema] published config failed validation', checked.errors.slice(0, 3))
    }
  } catch {
    // fetchActiveConfig never throws; belt and braces for the first render.
  }

  if (cached) return { cfg: cached, source: 'cache' }
  return { cfg: PRICING_CONFIG, source: 'bundled' }
}
