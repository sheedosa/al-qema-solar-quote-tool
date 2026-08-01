import type { FormData } from '../types'
import type { EngineResult } from './types'

/**
 * Quote persistence. Today this is a no-op stub — the project has no backend.
 * To add one (e.g. Supabase): implement `save` below. Nothing else changes.
 */

export type QuoteRecord = {
  createdAt: string
  configVersion: string
  /** Full input payload (photos stripped — blob URLs die with the tab). */
  form: FormData
  /** Full computed output, including the normalized-load audit trail. */
  result: EngineResult
}

export interface QuotePersistence {
  save(record: QuoteRecord): Promise<void>
}

/** Assemble the auditable record for one completed quote. */
export function buildQuoteRecord(d: FormData, result: EngineResult): QuoteRecord {
  return {
    createdAt: new Date().toISOString(),
    configVersion: result.configVersion,
    form: { ...d, photos: { panel: null, meter: null, roof: null, stickers: null } },
    result,
  }
}

export const persistence: QuotePersistence = {
  async save() {
    // No backend yet. Swap this implementation for Supabase/API when ready.
  },
}
