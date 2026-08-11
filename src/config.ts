/**
 * Deployment configuration for the Al Qema Solar quote tool.
 * These mirror the tunable props from the original design prototype.
 */

/** Whether to show the indicative price on the result screen. */
export const SHOW_PRICE = true

/** WhatsApp business number the completed estimate is sent to. */
export const WA_NUMBER = '+218911139113'

/**
 * Supabase backend (live pricing config + lead capture + admin panel).
 * The publishable key is safe to ship — row-level security is the boundary.
 */
export const SUPABASE_URL = 'https://ysfmlshyfooxqnilyuip.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_aPFkaTRZLDTnI7S5uYha7g_dSWOp8Jd'
