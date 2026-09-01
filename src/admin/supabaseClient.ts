import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { demoClient, isDemoMode } from './demoClient'

/**
 * Admin-only Supabase client. This module (and the whole supabase-js
 * dependency) lives in the lazy admin chunk — customers never download it.
 *
 * In demo mode (#/admin?demo) this is swapped for a double that serves
 * invented leads and discards writes, so the panel can be shown to someone
 * without a login and without putting a real customer on screen. The swap
 * happens here, at the single seam, so no component needs to know.
 */
const real = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const supabase = (isDemoMode() ? demoClient : real()) as ReturnType<typeof real>
