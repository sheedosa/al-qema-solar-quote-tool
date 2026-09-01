import { initialData } from './logic'
import type { FormData } from './types'

/**
 * Wizard progress kept across a reload.
 *
 * The form takes three to four minutes to fill. Before this, every one of
 * those answers lived only in React state: a refresh, an iOS Safari tab
 * eviction while the customer was in the camera app, or the Android back
 * button all discarded the lot and the lead was gone.
 *
 * sessionStorage (not localStorage) is deliberate — progress should survive a
 * reload of *this* tab, not reappear next week on a shared showroom device.
 */

const KEY = 'alqema.wizard.v1'

/** Bump when FormData changes shape, so stale sessions are dropped not merged. */
const SHAPE = 2

export type Session = { step: number; data: FormData }

/**
 * Photos are `blob:` URLs owned by the page that created them. They are dead
 * the moment the document reloads, so they are never persisted — a restored
 * session shows the photo slots empty rather than four broken images.
 */
function stripPhotos(d: FormData): FormData {
  return {
    ...d,
    photos: { panel: null, meter: null, roof: null, stickers: null },
    acUnits: d.acUnits.map((u) => ({ ...u, photo: null })),
  }
}

export function saveSession(step: number, data: FormData): void {
  try {
    // Step 0 is the welcome screen — nothing worth restoring, and writing it
    // would resurrect a finished session on the next visit to the tab.
    if (step <= 0) return clearSession()
    sessionStorage.setItem(KEY, JSON.stringify({ shape: SHAPE, step, data: stripPhotos(data) }))
  } catch {
    // Private mode, quota, or storage disabled — progress saving is a bonus,
    // never a requirement.
  }
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { shape?: number; step?: number; data?: unknown }
    if (parsed.shape !== SHAPE) return null
    if (typeof parsed.step !== 'number' || parsed.step < 1 || parsed.step > 7) return null
    if (typeof parsed.data !== 'object' || parsed.data === null) return null
    // Merge over a fresh object so a field added since the session was written
    // is present with its default rather than undefined.
    return { step: parsed.step, data: { ...initialData(), ...(parsed.data as FormData) } }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
