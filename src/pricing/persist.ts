import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import type { FormData } from '../types'
import type { EngineResult } from './types'

/**
 * Lead persistence. Every completed quote is saved to the `leads` table so the
 * company sees the submission even if the customer never taps the WhatsApp
 * button. The anonymous key can only INSERT — reading requires an admin login.
 */

export type QuoteRecord = {
  createdAt: string
  configVersion: string
  lang: 'ar' | 'en'
  /** Full input payload (photos stripped — blob URLs die with the tab). */
  form: FormData
  /** Full computed output, including the normalized-load audit trail. */
  result: EngineResult
}

export interface QuotePersistence {
  save(record: QuoteRecord): Promise<void>
}

/** Assemble the auditable record for one completed quote. */
export function buildQuoteRecord(
  d: FormData,
  result: EngineResult,
  lang: 'ar' | 'en',
): QuoteRecord {
  return {
    createdAt: new Date().toISOString(),
    configVersion: result.configVersion,
    lang,
    form: { ...d, photos: { panel: null, meter: null, roof: null, stickers: null } },
    result,
  }
}

export const persistence: QuotePersistence = {
  async save(record) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      await fetch(SUPABASE_URL + '/rest/v1/leads', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          // anon has no SELECT on leads — never ask for the row back.
          Prefer: 'return=minimal',
        },
        signal: controller.signal,
        body: JSON.stringify({
          name: record.form.name,
          whatsapp: record.form.whatsapp,
          city: record.form.city,
          property_type: record.form.propertyType,
          lang: record.lang,
          config_version: record.configVersion,
          tier: record.result.recommendedTier,
          price_from: record.result.priceFrom,
          is_custom: record.result.isCustom,
          confidence: record.result.confidence,
          form: record.form,
          result: record.result,
        }),
      })
      clearTimeout(timer)
    } catch (err) {
      // Fire-and-forget: a failed save must never break the result screen.
      console.warn('lead save failed', err)
    }
  },
}
