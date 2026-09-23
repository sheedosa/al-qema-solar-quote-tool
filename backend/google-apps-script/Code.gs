/**
 * Al Qema Solar — the whole backend, as an Apps Script bound to one Google Sheet.
 *
 * Deployed as a web app ("Execute as: Me", "Who has access: Anyone"), its URL
 * is the only server the quote tool talks to:
 *
 *   GET  ?action=config           → the active pricing config (public)
 *   POST {action:'submitLead',…}  → one customer submission (public)
 *   POST {action:'login', idToken} → a staff session token (Google sign-in)
 *   POST {action:…, token, …}     → staff actions: leads, pricing versions
 *
 * Every POST body is JSON sent as text/plain, so browsers make a "simple"
 * request with no CORS preflight. Every answer is `{ ok: true, … }` or
 * `{ ok: false, code, message }` — Apps Script always replies HTTP 200.
 *
 * Tabs (created by `setup`):
 *   Leads     the team's working sheet: one row per submission, plus Status
 *             and Team notes columns the team edits freely.
 *   LeadData  hidden + protected: the full form and result JSON behind each
 *             lead, for the admin panel's detail view.
 *   Pricing   protected: every published pricing version, one active.
 *   Staff     protected: the Google emails allowed into the admin panel.
 *   Log       rejected requests and errors, for diagnosis. No customer data.
 *
 * Script properties: GOOGLE_CLIENT_ID (the OAuth web client's ID, set by
 * hand) and TOKEN_SECRET (created by `setup`, never shown to anyone).
 */

/* ------------------------------------------------------------ constants */

var SHEETS = { leads: 'Leads', data: 'LeadData', pricing: 'Pricing', staff: 'Staff', log: 'Log' }

/**
 * The Leads columns, in order: [key, header]. The quote tool sends a row as
 * `{ key: value }`; unknown keys are ignored, missing ones left blank. A test
 * pins the client's key set to this list.
 */
var LEAD_COLUMNS = [
  ['submittedAt', 'وقت الإرسال / Submitted'],
  ['reference', 'المرجع / Reference'],
  ['name', 'الاسم / Name'],
  ['whatsapp', 'واتساب / WhatsApp'],
  ['city', 'المدينة / City'],
  ['property', 'نوع العقار / Property'],
  ['language', 'لغة العميل / Language'],
  ['package', 'الباقة / Package'],
  ['priceLyd', 'السعر (د.ل) / Price (LYD)'],
  ['sizingMethod', 'طريقة التحجيم / Sizing method'],
  ['confidence', 'الثقة / Confidence'],
  ['dailyCuts', 'الانقطاع اليومي / Daily cuts'],
  ['acs', 'المكيفات / ACs'],
  ['fridge', 'الثلاجة / Fridge'],
  ['freezer', 'الفريزر / Freezer'],
  ['lighting', 'الإنارة / Lighting'],
  ['appliances', 'الأجهزة / Appliances'],
  ['systemType', 'نوع النظام / System type'],
  ['cutPriority', 'الأولوية عند الانقطاع / Cut priority'],
  ['roof', 'السطح / Roof'],
  ['shade', 'الظل / Shade'],
  ['customerNotes', 'ملاحظات العميل / Customer notes'],
  ['warnings', 'تنبيهات / Warnings'],
  ['pricingVersion', 'إصدار الأسعار / Pricing version'],
]
/** Edited by the team in the sheet; the script only ever writes their defaults. */
var TEAM_COLUMNS = [
  ['status', 'الحالة / Status'],
  ['teamNotes', 'ملاحظات الفريق / Team notes'],
]
var STATUS_VALUES = ['جديد', 'تم التواصل', 'أُرسل العرض', 'تم البيع', 'لم يتم']

var DATA_HEADERS = ['id', 'createdAt', 'summary', 'detail…']
var PRICING_HEADERS = ['version', 'createdAt', 'createdBy', 'active', 'config…']
var STAFF_HEADERS = ['email', 'name (optional)']
var LOG_HEADERS = ['time', 'action', 'code', 'message']

/** A cell holds at most 50,000 characters; JSON is split across cells below that. */
var CHUNK = 45000
var MAX_CHUNKS = 8
/** Largest request body accepted, in characters. A real lead is ~10–25 KB. */
var MAX_BODY = 64 * 1024
var MAX_CONFIG = 200 * 1024
/** At most this many submissions per window, across all visitors. */
var RATE_LIMIT = 120
var RATE_WINDOW_S = 600
var SESSION_HOURS = 12
var CONFIG_CACHE_S = 600
var LEADS_LIST_LIMIT = 500
var VERSIONS_LIST_LIMIT = 50

/* ---------------------------------------------------------------- entry */

function doGet(e) {
  var p = (e && e.parameter) || {}
  try {
    if (p.action === 'config') return json_(getActiveConfig_())
    return json_({ ok: true, service: 'alqema' })
  } catch (x) {
    log_('config', 'server', x)
    return json_(fail_('server', 'Unexpected error'))
  }
}

function doPost(e) {
  var raw = e && e.postData ? String(e.postData.contents || '') : ''
  if (raw.length > MAX_BODY + MAX_CONFIG) return json_(fail_('too_large', 'Request too large'))
  var body
  try {
    body = JSON.parse(raw)
  } catch (x) {
    return json_(fail_('bad_request', 'Body is not JSON'))
  }
  if (!isObject_(body) || typeof body.action !== 'string') return json_(fail_('bad_request', 'No action'))
  try {
    return json_(route_(body, raw.length))
  } catch (x) {
    if (x && x.alqema) {
      if (x.code !== 'unauthorized') log_(body.action, x.code, x.message)
      return json_(fail_(x.code, x.message))
    }
    log_(body.action, 'server', x)
    return json_(fail_('server', 'Unexpected error'))
  }
}

function route_(body, size) {
  switch (body.action) {
    case 'submitLead':
      if (size > MAX_BODY) throw err_('too_large', 'Submission too large')
      return submitLead_(body)
    case 'config':
      return getActiveConfig_()
    case 'login':
      return login_(body)
    case 'listLeads':
      requireStaff_(body.token)
      return listLeads_()
    case 'getLead':
      requireStaff_(body.token)
      return getLead_(body)
    case 'listVersions':
      requireStaff_(body.token)
      return listVersions_()
    case 'getVersion':
      requireStaff_(body.token)
      return getVersion_(body)
    case 'publishConfig':
      return publishConfig_(body, requireStaff_(body.token))
    case 'activateConfig':
      requireStaff_(body.token)
      return activateConfig_(body)
    default:
      throw err_('bad_request', 'Unknown action')
  }
}

/* ---------------------------------------------------------------- leads */

var ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
var PHONE_RE = /^\+2189\d{8}$/

function submitLead_(body) {
  var id = String(body.id || '')
  if (!ID_RE.test(id)) throw err_('invalid', 'Bad id')
  var row = body.row
  var summary = body.summary
  var detail = body.detail
  if (!isObject_(row) || !isObject_(summary) || !isObject_(detail)) throw err_('invalid', 'Missing row, summary or detail')

  var values = {}
  for (var i = 0; i < LEAD_COLUMNS.length; i++) {
    var key = LEAD_COLUMNS[i][0]
    var v = row[key]
    if (v === undefined || v === null) v = ''
    if (typeof v !== 'string' && typeof v !== 'number') throw err_('invalid', key + ' has the wrong type')
    if (typeof v === 'number' && !isFinite(v)) throw err_('invalid', key + ' is not a finite number')
    if (typeof v === 'string' && v.length > (key === 'customerNotes' ? 2000 : 1000)) throw err_('invalid', key + ' too long')
    values[key] = v
  }
  if (typeof values.name !== 'string' || values.name.trim().length < 2 || values.name.length > 200) {
    throw err_('invalid', 'Bad name')
  }
  if (!PHONE_RE.test(String(values.whatsapp))) throw err_('invalid', 'Bad WhatsApp number')

  var lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) throw err_('busy', 'Busy, try again')
  try {
    // Idempotent: a retry or a queued resend of the same submission is
    // acknowledged, never appended twice.
    var dataSheet = sheet_(SHEETS.data)
    if (findRow_(dataSheet, 1, id) > 0) return { ok: true, duplicate: true }

    var cache = CacheService.getScriptCache()
    var bucket = 'rl:' + Math.floor(Date.now() / 1000 / RATE_WINDOW_S)
    var count = Number(cache.get(bucket) || 0)
    if (count >= RATE_LIMIT) throw err_('rate_limited', 'Too many submissions, try again later')
    cache.put(bucket, String(count + 1), RATE_WINDOW_S)

    var now = new Date()
    values.submittedAt = now
    values.reference = id

    var leads = sheet_(SHEETS.leads)
    var line = []
    for (var c = 0; c < LEAD_COLUMNS.length; c++) line.push(safe_(values[LEAD_COLUMNS[c][0]]))
    line.push(STATUS_VALUES[0], '')
    leads.getRange(leads.getLastRow() + 1, 1, 1, line.length).setValues([line])

    var cleanSummary = pick_(summary, [
      'name', 'whatsapp', 'city', 'property_type', 'lang', 'config_version',
      'tier', 'price_from', 'is_custom', 'confidence',
    ])
    cleanSummary.created_at = now.toISOString()
    var chunks = chunk_(JSON.stringify(detail))
    if (chunks.length > MAX_CHUNKS) throw err_('too_large', 'Submission detail too large')
    var dataLine = [id, now.toISOString(), JSON.stringify(cleanSummary)].concat(chunks)
    dataSheet.getRange(dataSheet.getLastRow() + 1, 1, 1, dataLine.length).setValues([dataLine.map(safe_)])
    return { ok: true }
  } finally {
    lock.releaseLock()
  }
}

function listLeads_() {
  var dataSheet = sheet_(SHEETS.data)
  var last = dataSheet.getLastRow()
  var out = []
  if (last < 2) return { ok: true, leads: out }
  var first = Math.max(2, last - LEADS_LIST_LIMIT + 1)
  var rows = dataSheet.getRange(first, 1, last - first + 1, 3).getValues()
  var status = statusById_()
  for (var i = rows.length - 1; i >= 0; i--) {
    var id = String(rows[i][0])
    if (!id) continue
    var s = parseJson_(rows[i][2]) || {}
    s.id = id
    s.status = status[id] || ''
    out.push(s)
  }
  return { ok: true, leads: out }
}

function getLead_(body) {
  var id = String(body.id || '')
  var dataSheet = sheet_(SHEETS.data)
  var r = findRow_(dataSheet, 1, id)
  if (r < 0) throw err_('not_found', 'No such lead')
  var line = dataSheet.getRange(r, 1, 1, 3 + MAX_CHUNKS).getValues()[0]
  var detail = parseJson_(line.slice(3).join(''))
  if (!detail) throw err_('server', 'Lead detail is unreadable')
  return { ok: true, form: detail.form, result: detail.result, status: statusById_()[id] || '' }
}

/** Status per lead id, read from the team's Leads sheet. */
function statusById_() {
  var leads = sheet_(SHEETS.leads)
  var last = leads.getLastRow()
  var map = {}
  if (last < 2) return map
  var refCol = 2
  var statusCol = LEAD_COLUMNS.length + 1
  var width = statusCol - refCol + 1
  var rows = leads.getRange(2, refCol, last - 1, width).getValues()
  for (var i = 0; i < rows.length; i++) map[String(rows[i][0])] = String(rows[i][width - 1] || '')
  return map
}

/* -------------------------------------------------------------- pricing */

function getActiveConfig_() {
  var cache = CacheService.getScriptCache()
  var hit = cache.get('active_config')
  if (hit) return JSON.parse(hit)
  var pricing = sheet_(SHEETS.pricing)
  var last = pricing.getLastRow()
  var answer = { ok: true, version: null, config: null }
  if (last >= 2) {
    var rows = pricing.getRange(2, 1, last - 1, 4 + MAX_CHUNKS).getValues()
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i][3] === true || String(rows[i][3]).toUpperCase() === 'TRUE') {
        answer = { ok: true, version: String(rows[i][0]), config: parseJson_(rows[i].slice(4).join('')) }
        break
      }
    }
  }
  var text = JSON.stringify(answer)
  // CacheService values are capped at 100 KB; a larger config is simply re-read.
  if (text.length < 95000) cache.put('active_config', text, CONFIG_CACHE_S)
  return answer
}

function listVersions_() {
  var pricing = sheet_(SHEETS.pricing)
  var last = pricing.getLastRow()
  var out = []
  if (last < 2) return { ok: true, versions: out }
  var first = Math.max(2, last - VERSIONS_LIST_LIMIT + 1)
  var rows = pricing.getRange(first, 1, last - first + 1, 4).getValues()
  for (var i = rows.length - 1; i >= 0; i--) {
    out.push({
      id: String(rows[i][0]),
      version: String(rows[i][0]),
      created_at: toIso_(rows[i][1]),
      created_by: String(rows[i][2] || ''),
      is_active: rows[i][3] === true || String(rows[i][3]).toUpperCase() === 'TRUE',
    })
  }
  return { ok: true, versions: out }
}

function getVersion_(body) {
  var pricing = sheet_(SHEETS.pricing)
  var r = findRow_(pricing, 1, String(body.id || ''))
  if (r < 0) throw err_('not_found', 'No such version')
  var line = pricing.getRange(r, 1, 1, 4 + MAX_CHUNKS).getValues()[0]
  return { ok: true, version: String(line[0]), config: parseJson_(line.slice(4).join('')) }
}

/**
 * Save a config as the next version of today and make it the only active
 * one, in one locked step — so there is no version clash and no "saved but
 * not live" state. The admin validates the config with the same rules the
 * site uses before sending it; this only checks it is the right kind of thing.
 */
function publishConfig_(body, email) {
  var cfg = body.config
  if (!isObject_(cfg) || !Array.isArray(cfg.packages) || cfg.packages.length !== 5 || !isObject_(cfg.components)) {
    throw err_('invalid', 'Not a pricing config')
  }
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) throw err_('busy', 'Busy, try again')
  try {
    var pricing = sheet_(SHEETS.pricing)
    var last = pricing.getLastRow()
    var prefix = 'pricing-' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd') + '.'
    var n = 0
    var existing = last >= 2 ? pricing.getRange(2, 1, last - 1, 1).getValues() : []
    for (var i = 0; i < existing.length; i++) {
      var v = String(existing[i][0])
      if (v.indexOf(prefix) === 0) {
        var k = parseInt(v.slice(prefix.length), 10)
        if (isFinite(k) && k > n) n = k
      }
    }
    var version = prefix + (n + 1)
    cfg.configVersion = version
    var text = JSON.stringify(cfg)
    if (text.length > MAX_CONFIG) throw err_('too_large', 'Config too large')
    var chunks = chunk_(text)
    if (chunks.length > MAX_CHUNKS) throw err_('too_large', 'Config too large')
    setActiveFlags_(pricing, null)
    var line = [version, new Date(), email, true].concat(chunks)
    pricing.getRange(last + 1, 1, 1, line.length).setValues([line])
    CacheService.getScriptCache().remove('active_config')
    return { ok: true, version: version }
  } finally {
    lock.releaseLock()
  }
}

function activateConfig_(body) {
  var id = String(body.id || '')
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) throw err_('busy', 'Busy, try again')
  try {
    var pricing = sheet_(SHEETS.pricing)
    if (findRow_(pricing, 1, id) < 0) throw err_('not_found', 'No such version')
    setActiveFlags_(pricing, id)
    CacheService.getScriptCache().remove('active_config')
    return { ok: true, version: id }
  } finally {
    lock.releaseLock()
  }
}

/** Mark exactly `activeId` active (or none, when null). */
function setActiveFlags_(pricing, activeId) {
  var last = pricing.getLastRow()
  if (last < 2) return
  var ids = pricing.getRange(2, 1, last - 1, 1).getValues()
  var flags = ids.map(function (r) {
    return [String(r[0]) === activeId]
  })
  pricing.getRange(2, 4, flags.length, 1).setValues(flags)
}

/* ----------------------------------------------------------------- auth */

/**
 * Exchange a Google ID token for a session. The ID token is checked by
 * Google's own tokeninfo endpoint (signature and expiry), then its audience
 * against our OAuth client and its email against the Staff tab.
 */
function login_(body) {
  var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID')
  if (!clientId) throw err_('not_configured', 'GOOGLE_CLIENT_ID is not set in Script properties')
  var idToken = String(body.idToken || '')
  if (!idToken || idToken.length > 4096) throw err_('unauthorized', 'No Google token')
  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true },
  )
  if (res.getResponseCode() !== 200) throw err_('unauthorized', 'Google did not accept the sign-in')
  var c = parseJson_(res.getContentText()) || {}
  var iss = String(c.iss || '')
  if (c.aud !== clientId) throw err_('unauthorized', 'Sign-in was for a different app')
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') throw err_('unauthorized', 'Bad issuer')
  if (!(Number(c.exp) * 1000 > Date.now())) throw err_('unauthorized', 'Sign-in expired')
  if (String(c.email_verified) !== 'true') throw err_('unauthorized', 'Email not verified')
  var email = String(c.email || '').trim().toLowerCase()
  if (!isStaff_(email)) {
    log_('login', 'not_staff', 'refused ' + email)
    throw err_('not_staff', 'This Google account is not on the staff list')
  }
  var expiresAt = Date.now() + SESSION_HOURS * 3600 * 1000
  return { ok: true, token: makeToken_(email, expiresAt), email: email, name: String(c.name || ''), expiresAt: expiresAt }
}

function makeToken_(email, expiresAt) {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ e: email, x: expiresAt }))
  return payload + '.' + sign_(payload)
}

function sign_(payload) {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET')
  if (!secret) throw err_('not_configured', 'Run setup first')
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret))
}

/** The staff email behind a valid session token, or an `unauthorized` error. */
function requireStaff_(token) {
  var t = String(token || '')
  var dot = t.indexOf('.')
  if (dot < 1) throw err_('unauthorized', 'Sign in again')
  var payload = t.slice(0, dot)
  if (sign_(payload) !== t.slice(dot + 1)) throw err_('unauthorized', 'Sign in again')
  var claims = parseJson_(Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString())
  if (!claims || !(Number(claims.x) > Date.now())) throw err_('unauthorized', 'Session expired')
  // Re-checked on every call, so removing someone from Staff locks them out
  // at once rather than when their session runs out.
  if (!isStaff_(claims.e)) throw err_('unauthorized', 'No longer on the staff list')
  return claims.e
}

function isStaff_(email) {
  if (!email) return false
  var staff = sheet_(SHEETS.staff)
  var last = staff.getLastRow()
  if (last < 2) return false
  var rows = staff.getRange(2, 1, last - 1, 1).getValues()
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email) return true
  }
  return false
}

/* ---------------------------------------------------------------- setup */

/**
 * Run once from the editor (select `setup`, press Run, allow access). Safe to
 * run again: it only creates what is missing and re-applies formatting.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.setSpreadsheetTimeZone('Africa/Tripoli')
  var headers = LEAD_COLUMNS.concat(TEAM_COLUMNS).map(function (c) {
    return c[1]
  })

  var leads = ensureSheet_(ss, SHEETS.leads, headers)
  leads.setRightToLeft(true)
  var col = function (key) {
    for (var i = 0; i < LEAD_COLUMNS.length; i++) if (LEAD_COLUMNS[i][0] === key) return i + 1
    return -1
  }
  // Plain text everywhere a customer typed or a label goes, so nothing is
  // ever read as a formula, a date or a number ("+218…" included).
  leads.getRange(2, 2, leads.getMaxRows() - 1, headers.length - 1).setNumberFormat('@')
  leads.getRange(2, col('submittedAt'), leads.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm')
  leads.getRange(2, col('priceLyd'), leads.getMaxRows() - 1, 1).setNumberFormat('#,##0')
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_VALUES, true).setAllowInvalid(false).build()
  leads.getRange(2, LEAD_COLUMNS.length + 1, leads.getMaxRows() - 1, 1).setDataValidation(statusRule)

  var data = ensureSheet_(ss, SHEETS.data, DATA_HEADERS)
  var pricing = ensureSheet_(ss, SHEETS.pricing, PRICING_HEADERS)
  var staff = ensureSheet_(ss, SHEETS.staff, STAFF_HEADERS)
  var log = ensureSheet_(ss, SHEETS.log, LOG_HEADERS)
  ;[data, pricing, staff, log].forEach(protect_)
  data.hideSheet()

  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1')
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank)
  ss.setActiveSheet(leads)

  var props = PropertiesService.getScriptProperties()
  if (!props.getProperty('TOKEN_SECRET')) {
    props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid())
  }
  var missing = props.getProperty('GOOGLE_CLIENT_ID') ? '' : ' Next: set GOOGLE_CLIENT_ID in Project settings → Script properties.'
  Logger.log('Al Qema backend is set up.' + missing)
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name)
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns())
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
  sh.setFrozenRows(1)
  return sh
}

/** Only the owner (the account running the script) may edit these tabs. */
function protect_(sh) {
  var p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || sh.protect()
  p.setDescription('Managed by the Al Qema quote tool')
  p.removeEditors(p.getEditors())
  if (p.canDomainEdit()) p.setDomainEdit(false)
}

/* -------------------------------------------------------------- helpers */

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
  if (!sh) throw err_('not_configured', 'Missing tab ' + name + ' — run setup')
  return sh
}

/** 1-based row of `value` in column `col` below the header, or -1. */
function findRow_(sh, col, value) {
  var last = sh.getLastRow()
  if (!value || last < 2) return -1
  var rows = sh.getRange(2, col, last - 1, 1).getValues()
  for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === value) return i + 2
  return -1
}

/**
 * A string that starts with = + - @ is written by Sheets as a FORMULA. From
 * an anonymous form that is an attack (IMPORTDATA can leak the sheet), so it
 * is stored as text with a leading apostrophe, which the cell hides.
 */
function safe_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v
  return v
}

function chunk_(text) {
  var out = []
  for (var i = 0; i < text.length; i += CHUNK) out.push(text.slice(i, i + CHUNK))
  return out.length ? out : ['']
}

function pick_(obj, keys) {
  var out = {}
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]]
    if (typeof v === 'string') out[keys[i]] = v.slice(0, 300)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[keys[i]] = v
  }
  return out
}

function parseJson_(text) {
  try {
    return JSON.parse(String(text || ''))
  } catch (x) {
    return null
  }
}

function toIso_(v) {
  return v instanceof Date ? v.toISOString() : String(v || '')
}

function isObject_(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function err_(code, message) {
  return { alqema: true, code: code, message: message }
}

function fail_(code, message) {
  return { ok: false, code: code, message: message }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/** Diagnosis only. Never customer data beyond what the message says. */
function log_(action, code, x) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.log)
    if (!sh) return
    var msg = x && x.message ? x.message : String(x)
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues([[new Date(), String(action).slice(0, 40), code, safe_(msg.slice(0, 500))]])
  } catch (ignored) {
    // Logging must never turn a handled error into an unhandled one.
  }
}
