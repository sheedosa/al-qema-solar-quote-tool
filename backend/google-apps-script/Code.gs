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
 * Tabs (created by `setup`), in this order:
 *   دليل الاستخدام Guide   how to use the sheet, in Arabic and English.
 *   ملخص Summary           live counts: leads this week, by status, overdue
 *                          follow-ups, sales value, by package.
 *   الطلبات Leads          the team's working sheet. One row per submission,
 *                          in four colour-coded sections: the customer and
 *                          quote, the team's follow-up (Status, Assigned to,
 *                          Follow-up date, Team notes), the quoted system,
 *                          and the customer's answers.
 *   الموظفون Staff         the Google emails allowed into the admin panel.
 *   الأسعار Pricing        every published pricing version, one active.
 *   السجل Log              rejected requests and errors. No customer data.
 *   LeadData               hidden: the full form and result behind each lead,
 *                          for the admin panel's detail view.
 *
 * Script properties: GOOGLE_CLIENT_ID (the OAuth web client's ID, set by
 * hand) and TOKEN_SECRET (created by `setup`, never shown to anyone).
 */

/* ------------------------------------------------------------ constants */

var SHEETS = {
  guide: 'دليل الاستخدام Guide',
  summary: 'ملخص Summary',
  leads: 'الطلبات Leads',
  staff: 'الموظفون Staff',
  pricing: 'الأسعار Pricing',
  log: 'السجل Log',
  data: 'LeadData',
}
/** Names used by the first version of this script; `setup` renames them. */
var OLD_NAMES = { leads: 'Leads', staff: 'Staff', pricing: 'Pricing', log: 'Log' }

/**
 * The Leads sheet, column by column, in order:
 *   [key, Arabic header, English header, width px, section, kind, note]
 * Sections colour the header; kinds decide format and validation. `team`
 * columns are the team's to edit; every other column is written once, by
 * the script, when the customer submits.
 */
var COLUMNS = [
  ['submittedAt', 'وقت الإرسال', 'Submitted', 125, 'main', 'date', 'وقت وصول الطلب (توقيت ليبيا).'],
  ['name', 'الاسم', 'Name', 150, 'main', 'text', 'اسم العميل كما كتبه.'],
  ['whatsapp', 'واتساب', 'WhatsApp', 135, 'main', 'phone', 'اضغط على الرقم لفتح محادثة واتساب مع العميل.'],
  ['city', 'المدينة', 'City', 105, 'main', 'text', ''],
  ['property', 'نوع العقار', 'Property', 105, 'main', 'text', ''],
  ['package', 'الباقة', 'Package', 75, 'main', 'center', 'الباقة المقترحة (S إلى XXL) أو «مخصّص» عندما لا تناسب أي باقة.'],
  ['priceLyd', 'السعر', 'Price', 105, 'main', 'money', 'السعر الذي رآه العميل، بالدينار الليبي.'],
  ['status', 'الحالة', 'Status', 115, 'team', 'status', 'اختر من القائمة: جديد، تم التواصل، أُرسل العرض، تم البيع، لم يتم.'],
  ['assignedTo', 'المسؤول', 'Assigned to', 115, 'team', 'assignee', 'من يتابع هذا العميل. الأسماء تأتي من ورقة الموظفين.'],
  ['followUp', 'موعد المتابعة', 'Follow-up', 105, 'team', 'followup', 'تاريخ المتابعة القادمة. يظهر باللون الأحمر عندما يحين موعده.'],
  ['teamNotes', 'ملاحظات الفريق', 'Team notes', 220, 'team', 'wrap', 'أي ملاحظات داخلية للفريق.'],
  ['inverter', 'الإنفرتر', 'Inverter', 95, 'system', 'text', 'حجم الإنفرتر في النظام المقترح.'],
  ['panels', 'الألواح', 'Panels', 150, 'system', 'text', 'عدد الألواح × قدرتها = إجمالي القدرة.'],
  ['battery', 'البطاريات', 'Battery', 150, 'system', 'text', 'السعة القابلة للاستخدام ونوع البطارية.'],
  ['sizingMethod', 'طريقة التسعير', 'Pricing method', 150, 'system', 'text', 'باقة قياسية، أو نظام مخصّص محسوب من أسعار المكوّنات.'],
  ['confidence', 'دقة التقدير', 'Confidence', 85, 'system', 'center', '«منخفضة» تعني أن العميل لم يعرف بعض التفاصيل واستُخدمت قيم نموذجية — تأكّد منها عند التواصل.'],
  ['warnings', 'تنبيهات', 'Warnings', 220, 'system', 'wrap', 'ما عُرض على العميل من ملاحظات.'],
  ['dailyCuts', 'الانقطاع اليومي', 'Daily power cuts', 105, 'answers', 'text', ''],
  ['acs', 'المكيفات', 'ACs', 220, 'answers', 'wrap', 'العدد، ثم كل مكيف: الحجم والساعات.'],
  ['fridge', 'الثلاجة', 'Fridge', 85, 'answers', 'text', ''],
  ['freezer', 'الفريزر', 'Freezer', 85, 'answers', 'text', ''],
  ['lighting', 'الإنارة', 'Lighting', 135, 'answers', 'text', ''],
  ['appliances', 'الأجهزة', 'Appliances', 220, 'answers', 'wrap', ''],
  ['systemType', 'نوع النظام', 'System type', 95, 'answers', 'text', ''],
  ['cutPriority', 'الأولوية عند الانقطاع', 'Cut priority', 150, 'answers', 'text', ''],
  ['roof', 'مساحة السطح', 'Roof space', 95, 'answers', 'text', ''],
  ['shade', 'الظل', 'Shade', 65, 'answers', 'center', ''],
  ['customerNotes', 'ملاحظات العميل', 'Customer notes', 220, 'answers', 'wrap', ''],
  ['language', 'لغة العميل', 'Language', 85, 'answers', 'text', ''],
  ['reference', 'رقم المرجع', 'Reference', 270, 'ref', 'text', 'معرّف الطلب. لا تعدّله.'],
  ['pricingVersion', 'إصدار الأسعار', 'Pricing version', 165, 'ref', 'text', 'إصدار الأسعار الذي حُسب به العرض.'],
]
var TEAM_KEYS = ['status', 'assignedTo', 'followUp', 'teamNotes']
/** The keys the quote tool sends. A test pins the site's list to this one. */
var CLIENT_KEYS = COLUMNS.map(function (c) {
  return c[0]
}).filter(function (k) {
  return TEAM_KEYS.indexOf(k) < 0
})
var STATUS_VALUES = ['جديد', 'تم التواصل', 'أُرسل العرض', 'تم البيع', 'لم يتم']
/** [background, text] per status, and per header section. */
var STATUS_COLORS = {
  'جديد': ['#E8F0FE', '#1A56DB'],
  'تم التواصل': ['#FEF3C7', '#B45309'],
  'أُرسل العرض': ['#EDE9FE', '#6D28D9'],
  'تم البيع': ['#E7F3ED', '#1E7E4F'],
  'لم يتم': ['#F1F3F5', '#6C757D'],
}
var SECTION_COLORS = {
  main: ['#BD202F', '#FFFFFF'],
  team: ['#1E7E4F', '#FFFFFF'],
  system: ['#2D2D2D', '#FFFFFF'],
  answers: ['#6C757D', '#FFFFFF'],
  ref: ['#CED4DA', '#2D2D2D'],
}

var DATA_HEADERS = ['id', 'createdAt', 'summary', 'detail…']
var PRICING_HEADERS = ['الإصدار\nVersion', 'وقت النشر\nPublished', 'نشره\nPublished by', 'ساري\nActive', 'الإعدادات\nConfig (managed by the admin panel)']
var STAFF_HEADERS = ['البريد الإلكتروني (Google)\nGoogle email', 'الاسم\nName']
var LOG_HEADERS = ['الوقت\nTime', 'العملية\nAction', 'الرمز\nCode', 'الرسالة\nMessage']

/** 1-based column of a Leads key. */
function colOf_(key) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return i + 1
  throw new Error('No column ' + key)
}

/** A1 letter(s) of a 1-based column. */
function letter_(n) {
  var s = ''
  while (n > 0) {
    var m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

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
  for (var i = 0; i < CLIENT_KEYS.length; i++) {
    var key = CLIENT_KEYS[i]
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
    var line = COLUMNS.map(function (col) {
      var k = col[0]
      if (k === 'status') return STATUS_VALUES[0]
      if (TEAM_KEYS.indexOf(k) >= 0) return ''
      // Built here from a number already checked against PHONE_RE, so this
      // is the one formula the script writes on purpose: a tap opens WhatsApp.
      if (k === 'whatsapp') return '=HYPERLINK("https://wa.me/' + values.whatsapp.slice(1) + '","' + values.whatsapp + '")'
      return safe_(values[k])
    })
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
  var ids = leads.getRange(2, colOf_('reference'), last - 1, 1).getValues()
  var status = leads.getRange(2, colOf_('status'), last - 1, 1).getValues()
  for (var i = 0; i < ids.length; i++) map[String(ids[i][0])] = String(status[i][0] || '')
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
 * run again: it creates what is missing and re-applies the layout. It never
 * deletes a submission — if the Leads tab already holds rows in a different
 * column layout, it stops and says so.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.setSpreadsheetTimeZone('Africa/Tripoli')
  // Tabs made by the first version of this script keep their data.
  for (var k in OLD_NAMES) {
    var old = ss.getSheetByName(OLD_NAMES[k])
    if (old && !ss.getSheetByName(SHEETS[k])) old.setName(SHEETS[k])
  }

  var staff = setupStaff_(ss)
  var leads = setupLeads_(ss, staff)
  setupPricing_(ss)
  setupLog_(ss)
  var data = plainSheet_(ss, SHEETS.data, DATA_HEADERS)
  protect_(data)
  setupSummary_(ss)
  setupGuide_(ss)

  // Tab order: Guide, Summary, Leads, Staff, Pricing, Log. LeadData is left
  // out: activating a hidden tab would show it again.
  var order = [SHEETS.guide, SHEETS.summary, SHEETS.leads, SHEETS.staff, SHEETS.pricing, SHEETS.log]
  for (var i = 0; i < order.length; i++) {
    ss.setActiveSheet(ss.getSheetByName(order[i]))
    ss.moveActiveSheet(i + 1)
  }
  data.hideSheet()
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1') || ss.getSheetByName('الورقة1')
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank)
  ss.setActiveSheet(leads)

  var props = PropertiesService.getScriptProperties()
  if (!props.getProperty('TOKEN_SECRET')) {
    props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid())
  }
  var missing = props.getProperty('GOOGLE_CLIENT_ID') ? '' : ' Next: set GOOGLE_CLIENT_ID in Project settings → Script properties.'
  Logger.log('Al Qema backend is set up.' + missing)
}

function setupLeads_(ss, staff) {
  var sh = ss.getSheetByName(SHEETS.leads) || ss.insertSheet(SHEETS.leads)
  var n = COLUMNS.length
  var headers = COLUMNS.map(function (c) {
    return c[1] + '\n' + c[2]
  })
  // Widen first: a new tab has 26 columns and the layout needs more.
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns())
  if (sh.getLastRow() > 1) {
    var current = sh.getRange(1, 1, 1, n).getValues()[0]
    for (var h = 0; h < n; h++) {
      if (String(current[h]) !== headers[h]) {
        throw new Error(
          'The Leads tab already holds submissions in a different column layout. ' +
            'Rename that tab (for example to "Leads old"), run setup again, then copy the rows across.',
        )
      }
    }
  }
  var rows = sh.getMaxRows() - 1
  var body = sh.getRange(2, 1, rows, n)
  // Start clean, so a second run never stacks rules on top of the first.
  body.clearDataValidations()
  sh.clearConditionalFormatRules()
  sh.getBandings().forEach(function (b) {
    b.remove()
  })
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    p.remove()
  })

  sh.setRightToLeft(true)
  sh.setTabColor(SECTION_COLORS.main[0])

  // Header: two lines (Arabic over English), coloured by section, with a
  // note on each explaining the column.
  var head = sh.getRange(1, 1, 1, n)
  head.setValues([headers]).setFontWeight('bold').setFontSize(10).setWrap(true)
  head.setVerticalAlignment('middle').setHorizontalAlignment('center')
  sh.setRowHeight(1, 46)
  for (var i = 0; i < n; i++) {
    var c = COLUMNS[i]
    var cell = sh.getRange(1, i + 1)
    cell.setBackground(SECTION_COLORS[c[4]][0]).setFontColor(SECTION_COLORS[c[4]][1])
    cell.setNote(c[6] || '')
    sh.setColumnWidth(i + 1, c[3])
  }
  sh.setFrozenRows(1)
  sh.setFrozenColumns(2)

  // Body: readable defaults, then one format per kind of column.
  body.setVerticalAlignment('top').setFontSize(10).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
  // Alternating row shades on the body only, so the header keeps its colours.
  body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
  for (var j = 0; j < n; j++) {
    var kind = COLUMNS[j][5]
    var col = sh.getRange(2, j + 1, rows, 1)
    if (kind === 'date') col.setNumberFormat('yyyy-mm-dd  hh:mm')
    else if (kind === 'money') col.setNumberFormat('#,##0 "د.ل"').setFontWeight('bold')
    else if (kind === 'followup') col.setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center')
    else if (kind === 'phone') col.setNumberFormat('@')
    else col.setNumberFormat('@')
    if (kind === 'wrap') col.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    if (kind === 'center' || kind === 'status') col.setHorizontalAlignment('center')
  }
  // A phone cell holds the HYPERLINK formula the script writes; plain-text
  // format would show the formula instead of the number.
  sh.getRange(2, colOf_('whatsapp'), rows, 1).setNumberFormat('General')
  sh.getRange(2, colOf_('name'), rows, 1).setFontWeight('bold')

  // Team columns: dropdowns and a date picker.
  var statusCol = colOf_('status')
  sh.getRange(2, statusCol, rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUS_VALUES, true).setAllowInvalid(false)
      .setHelpText('اختر الحالة من القائمة.').build(),
  ).setFontWeight('bold')
  sh.getRange(2, colOf_('assignedTo'), rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(staff.getRange('B2:B'), true).setAllowInvalid(true)
      .setHelpText('الأسماء من ورقة الموظفين (عمود الاسم).').build(),
  )
  sh.getRange(2, colOf_('followUp'), rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('اختر تاريخًا (انقر مرتين لفتح التقويم).').build(),
  )

  // Colours: each status its own; an overdue follow-up in red.
  var rules = []
  var statusRange = sh.getRange(2, statusCol, rows, 1)
  for (var st in STATUS_COLORS) {
    rules.push(
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(st)
        .setBackground(STATUS_COLORS[st][0]).setFontColor(STATUS_COLORS[st][1])
        .setRanges([statusRange]).build(),
    )
  }
  var f = letter_(colOf_('followUp'))
  var s = letter_(statusCol)
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + f + '2<>"",$' + f + '2<=TODAY(),$' + s + '2<>"تم البيع",$' + s + '2<>"لم يتم")')
      .setBackground('#FBEAEC').setFontColor('#BD202F').setBold(true)
      .setRanges([sh.getRange(2, colOf_('followUp'), rows, 1)]).build(),
  )
  sh.setConditionalFormatRules(rules)

  // Filter on the header, so anyone can sort and filter by clicking it.
  if (!sh.getFilter()) sh.getRange(1, 1, rows + 1, n).createFilter()

  // The reference columns fold away behind a "+" above the sheet.
  try {
    var refFrom = colOf_('reference')
    var refRange = sh.getRange(1, refFrom, 1, n - refFrom + 1)
    if (sh.getColumnGroupDepth(refFrom) === 0) refRange.shiftColumnGroupDepth(1)
    sh.getColumnGroup(refFrom, 1).collapse()
  } catch (ignored) {
    // Column groups are cosmetic; an older Sheets build without them is fine.
  }

  // Only the team columns are meant to be typed in. Everything else shows a
  // warning first, so an accidental edit is caught but nobody is locked out.
  var p = sh.protect().setDescription('بيانات العميل تُكتب تلقائيًا — عدّل أعمدة الفريق فقط / Customer data is written by the quote tool')
  p.setWarningOnly(true)
  p.setUnprotectedRanges([sh.getRange(2, colOf_('status'), rows, TEAM_KEYS.length)])
  return sh
}

function setupStaff_(ss) {
  var sh = plainSheet_(ss, SHEETS.staff, STAFF_HEADERS)
  sh.setColumnWidth(1, 280)
  sh.setColumnWidth(2, 180)
  sh.getRange(1, 1).setNote('ضع بريد Google لكل موظف مسموح له بدخول لوحة الإدارة، واحدًا في كل صف. حذف الصف يمنع الدخول فورًا.')
  sh.getRange(1, 2).setNote('الاسم يظهر في قائمة «المسؤول» في ورقة الطلبات.')
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('@')
  sh.setTabColor('#1E7E4F')
  protect_(sh)
  return sh
}

function setupPricing_(ss) {
  var sh = plainSheet_(ss, SHEETS.pricing, PRICING_HEADERS)
  sh.setColumnWidth(1, 170)
  sh.setColumnWidth(2, 140)
  sh.setColumnWidth(3, 200)
  sh.setColumnWidth(4, 60)
  sh.setColumnWidth(5, 300)
  sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd  hh:mm')
  sh.getRange(1, 1).setNote('تُنشر الأسعار وتُسترجع من صفحة «الأسعار» في لوحة الإدارة فقط. لا تعدّل هذه الورقة يدويًا.')
  sh.setTabColor('#6C757D')
  protect_(sh)
}

function setupLog_(ss) {
  var sh = plainSheet_(ss, SHEETS.log, LOG_HEADERS)
  sh.setColumnWidth(1, 140)
  sh.setColumnWidth(2, 120)
  sh.setColumnWidth(3, 120)
  sh.setColumnWidth(4, 460)
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd  hh:mm')
  sh.setTabColor('#CED4DA')
  protect_(sh)
}

/** Live counts, all formulas over the Leads tab — nothing to maintain. */
function setupSummary_(ss) {
  var sh = ss.getSheetByName(SHEETS.summary) || ss.insertSheet(SHEETS.summary)
  sh.clear()
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    p.remove()
  })
  sh.setRightToLeft(true)
  sh.setTabColor('#1A56DB')
  var L = "'" + SHEETS.leads + "'!"
  var colRange = function (key) {
    var c = letter_(colOf_(key))
    return L + c + '2:' + c
  }
  var date = colRange('submittedAt')
  var status = colRange('status')
  var pkg = colRange('package')
  var price = colRange('priceLyd')
  var follow = colRange('followUp')
  var rows = [
    ['ملخص الطلبات', 'Leads summary', ''],
    ['', '', ''],
    ['إجمالي الطلبات', 'All leads', '=COUNTA(' + colRange('name') + ')'],
    ['آخر 7 أيام', 'Last 7 days', '=COUNTIF(' + date + ',">="&(TODAY()-7))'],
    ['هذا الشهر', 'This month', '=COUNTIF(' + date + ',">="&(EOMONTH(TODAY(),-1)+1))'],
    ['متابعات حان موعدها', 'Follow-ups due', '=COUNTIFS(' + follow + ',"<="&TODAY(),' + status + ',"<>تم البيع",' + status + ',"<>لم يتم")'],
    ['', '', ''],
    ['حسب الحالة', 'By status', ''],
  ]
  STATUS_VALUES.forEach(function (st) {
    rows.push([st, '', '=COUNTIF(' + status + ',"' + st + '")'])
  })
  rows.push(['قيمة المبيعات (د.ل)', 'Sold value (LYD)', '=SUMIF(' + status + ',"تم البيع",' + price + ')'])
  rows.push(['', '', ''])
  rows.push(['حسب الباقة', 'By package', ''])
  ;['S', 'M', 'L', 'XL', 'XXL', 'مخصّص'].forEach(function (t) {
    rows.push([t, '', '=COUNTIF(' + pkg + ',"' + t + '")'])
  })
  sh.getRange(1, 1, rows.length, 3).setValues(rows)
  sh.getRange(1, 1, 1, 3).setFontSize(16).setFontWeight('bold').setFontColor('#BD202F')
  // Section headings: "By status" and "By package".
  sh.getRange(8, 1, 1, 2).setFontWeight('bold').setBackground('#F1F3F5')
  sh.getRange(8 + STATUS_VALUES.length + 3, 1, 1, 2).setFontWeight('bold').setBackground('#F1F3F5')
  sh.getRange(3, 3, rows.length - 2, 1).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center').setNumberFormat('#,##0')
  sh.getRange(6, 1, 1, 3).setFontColor('#BD202F')
  sh.setColumnWidth(1, 200)
  sh.setColumnWidth(2, 160)
  sh.setColumnWidth(3, 120)
  sh.setFrozenRows(1)
  protect_(sh)
}

/** A plain-language guide for the team, in Arabic and English. */
function setupGuide_(ss) {
  var sh = ss.getSheetByName(SHEETS.guide) || ss.insertSheet(SHEETS.guide)
  sh.clear()
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    p.remove()
  })
  sh.setRightToLeft(true)
  sh.setTabColor('#BD202F')
  var rows = [
    ['دليل استخدام جدول طلبات القمة', 'Al Qema quote sheet — how to use it'],
    ['', ''],
    ['ما هذا الجدول؟', 'What is this?'],
    ['كل عميل يكمل نموذج عرض السعر على الموقع يظهر هنا تلقائيًا كصف جديد في ورقة «الطلبات». لا حاجة لإدخال أي شيء يدويًا.',
      'Every customer who completes the quote form on the website appears here automatically, as a new row in the Leads tab. Nothing is typed in by hand.'],
    ['', ''],
    ['ورقة الطلبات', 'The Leads tab'],
    ['الأعمدة مقسّمة إلى أربعة أقسام بألوان مختلفة:', 'The columns come in four colour-coded sections:'],
    ['• أحمر — العميل والعرض: الوقت، الاسم، واتساب، المدينة، الباقة والسعر.', '• Red — the customer and the quote: time, name, WhatsApp, city, package and price.'],
    ['• أخضر — متابعة الفريق: الحالة، المسؤول، موعد المتابعة، ملاحظات الفريق. هذه الأعمدة فقط للكتابة.', '• Green — the team’s follow-up: status, assigned to, follow-up date, team notes. These are the only columns to type in.'],
    ['• أسود — النظام المقترح: الإنفرتر، الألواح، البطاريات، وطريقة التسعير.', '• Black — the quoted system: inverter, panels, battery and how it was priced.'],
    ['• رمادي — إجابات العميل في النموذج: الانقطاع، المكيفات، الأجهزة، السطح، وملاحظاته.', '• Grey — the customer’s answers: power cuts, ACs, appliances, roof and notes.'],
    ['مرّر الفأرة فوق عنوان أي عمود لرؤية شرحه.', 'Hover over any column header to see what it means.'],
    ['', ''],
    ['كيف أتابع العميل؟', 'How do I follow a lead up?'],
    ['1. اضغط رقم واتساب لفتح المحادثة مباشرة.', '1. Tap the WhatsApp number to open a chat straight away.'],
    ['2. غيّر «الحالة» من القائمة: جديد ← تم التواصل ← أُرسل العرض ← تم البيع أو لم يتم.', '2. Change the Status from the dropdown: New → Contacted → Quote sent → Sold or Lost.'],
    ['3. اختر «المسؤول» من القائمة (الأسماء من ورقة الموظفين).', '3. Pick who is responsible under Assigned to (names come from the Staff tab).'],
    ['4. ضع «موعد المتابعة». عندما يحين الموعد يصبح التاريخ أحمر.', '4. Set a Follow-up date. It turns red when the day arrives.'],
    ['5. اكتب أي ملاحظة في «ملاحظات الفريق».', '5. Write anything else in Team notes.'],
    ['', ''],
    ['البحث والتصفية', 'Searching and filtering'],
    ['اضغط أيقونة التصفية في عنوان أي عمود لترتيب الطلبات أو عرض حالة معيّنة فقط (مثلًا: جديد).', 'Click the filter icon in any header to sort, or to show only one status (for example, New).'],
    ['', ''],
    ['الأوراق الأخرى', 'The other tabs'],
    ['• ملخص — أرقام تُحدَّث تلقائيًا: عدد الطلبات، حسب الحالة والباقة، والمتابعات المستحقة.', '• Summary — live numbers: leads, by status and package, and follow-ups due.'],
    ['• الموظفون — من يُسمح له بدخول لوحة الإدارة، وأسماؤهم لقائمة «المسؤول».', '• Staff — who may sign in to the admin panel, and the names for Assigned to.'],
    ['• الأسعار — كل إصدارات الأسعار المنشورة. تُدار من صفحة «الأسعار» في لوحة الإدارة فقط.', '• Pricing — every published price version. Managed only from the admin panel’s Pricing page.'],
    ['• السجل — أخطاء تقنية للمطوّر. يمكن تجاهله.', '• Log — technical errors for the developer. Safe to ignore.'],
    ['', ''],
    ['تنزيل كملف Excel', 'Download as Excel'],
    ['ملف ← تنزيل ← Microsoft Excel (.xlsx).', 'File → Download → Microsoft Excel (.xlsx).'],
    ['', ''],
    ['مهم', 'Important'],
    ['لا تحذف الصفوف ولا تغيّر ترتيب الأعمدة أو أسماء الأوراق — لوحة الإدارة تعتمد عليها.', 'Do not delete rows, reorder columns or rename tabs — the admin panel relies on them.'],
  ]
  sh.getRange(1, 1, rows.length, 2).setValues(rows).setWrap(true).setVerticalAlignment('top').setFontSize(11)
  sh.getRange(1, 1, 1, 2).setFontSize(16).setFontWeight('bold').setFontColor('#BD202F')
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    var isHeading = i > 0 && r[0] && rows[i - 1][0] === '' && rows[i + 1] && rows[i + 1][0] !== ''
    if (isHeading) sh.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#F1F3F5').setFontSize(12)
  }
  sh.setColumnWidth(1, 520)
  sh.setColumnWidth(2, 520)
  sh.setFrozenRows(1)
  protect_(sh)
}

/** A tab with a styled header row, frozen; created if missing. */
function plainSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name)
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns())
  sh.setRightToLeft(true)
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(true)
    .setBackground('#2D2D2D').setFontColor('#FFFFFF').setVerticalAlignment('middle')
  sh.setRowHeight(1, 42)
  sh.setFrozenRows(1)
  return sh
}

/** Only the owner (the account running the script) may edit these tabs. */
function protect_(sh) {
  var p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || sh.protect()
  p.setDescription('يُدار تلقائيًا من أداة عروض القمة / Managed by the Al Qema quote tool')
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
