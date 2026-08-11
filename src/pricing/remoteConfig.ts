import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { PRICING_CONFIG } from './config'
import type { PricingConfig } from './types'
import { validatePricingConfig } from './validate'

/**
 * Boot-time pricing-config loader. Resolution order:
 *   1. the active row in the database (3s timeout),
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

export async function loadActiveConfig(timeoutMs = 3000): Promise<LoadedConfig> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/pricing_configs?is_active=eq.true&select=config&limit=1',
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (res.ok) {
      const rows: { config?: unknown }[] = await res.json()
      const checked = validatePricingConfig(rows[0]?.config)
      if (checked.ok) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(checked.config))
        } catch {
          // storage full/blocked — cache is best-effort
        }
        return { cfg: checked.config, source: 'remote' }
      }
    }
  } catch {
    // network failure / timeout — fall through
  }

  const cached = fromCache()
  if (cached) return { cfg: cached, source: 'cache' }
  return { cfg: PRICING_CONFIG, source: 'bundled' }
}
