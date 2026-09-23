/**
 * Deployment configuration for the Al Qema Solar quote tool.
 * These mirror the tunable props from the original design prototype.
 */

/** Whether to show the indicative price on the result screen. */
export const SHOW_PRICE = true

/** WhatsApp business number the completed estimate is sent to. */
export const WA_NUMBER = '+218911139113'

/**
 * The backend: one Google Sheet with an Apps Script deployed as a web app
 * (backend/google-apps-script/). All three values are public — the script
 * decides who may do what, not these strings.
 *
 * Fill them in from the setup guide (backend/README.md, step 6) before
 * deploying. While SHEETS_API_URL is empty the site prices with the built-in
 * config and keeps submissions queued on the customer's device.
 */
/** The web app URL, ending in /exec. */
const SHEETS_API_URL_VALUE = ''
/** The OAuth web client ID staff sign in with (…apps.googleusercontent.com). */
const GOOGLE_CLIENT_ID_VALUE = ''

// A local `.env` (VITE_SHEETS_API_URL / VITE_GOOGLE_CLIENT_ID) overrides the
// two above — for a test copy of the sheet, or the browser checks.
export const SHEETS_API_URL: string = import.meta.env.VITE_SHEETS_API_URL || SHEETS_API_URL_VALUE
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID_VALUE
/** The spreadsheet itself, for the admin panel's "Open Google Sheet" button. */
export const SHEET_URL = ''

/**
 * The language of the values written to the Leads sheet. Headers are always
 * Arabic / English; values follow this so the team can sort and filter.
 */
export const SHEET_LANG: 'ar' | 'en' = 'ar'
