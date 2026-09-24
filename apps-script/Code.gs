/**
 * XBOTIX 2026 — registration backend (Google Apps Script web app). See README-apps-script.md.
 *
 *   setup()               run ONCE from the editor: creates tabs, headers, Drive folders, Script Properties.
 *   doPost(e)             POST  {action:"register", ...}  (Content-Type: text/plain, JSON body)  — PLAN E5
 *   doGet(e)              GET   ?action=status            → { ok, serverTime, stage, counts }
 *   testRegisterSchool()  / testRegisterUniversity()  run from the editor with sample payloads
 *
 * Secrets (Sheet ID, Drive folder IDs) live ONLY in Script Properties, never in the website code.
 * Validation rules MUST match js/modules/register/validate.js.
 */

var CFG = {
  PREFIX: 'XB26',
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 5,
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MIN_ELAPSED_MS: 8000,          // faster than this = bot
  RATE_LIMIT: 3,                 // attempts per leader phone per category …
  RATE_WINDOW_S: 600,            // … per 10 minutes
  ID_CACHE_S: 6 * 3600,          // CacheService maximum
  STATUSES: ['Pending', 'Verified', 'Rejected', 'Waitlist']
};

var DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];
var RELATIONS = ['Teacher', 'Parent', 'Other'];

/* ============================ column layout (PLAN E6) ============================ */

function memberPrefix_(i) { return i === 0 ? 'Leader' : 'M' + (i + 1); }

function headers_(cat) {
  var h = ['Timestamp', 'Registration ID', 'Status'];
  var i;
  if (cat === 'school') {
    h.push('School', 'District', 'Team Name', 'Member Count');
    for (i = 0; i < CFG.MAX_MEMBERS; i++) h.push(memberPrefix_(i) + ' Name', memberPrefix_(i) + ' Phone');
    h.push('Guardian Name', 'Guardian Phone', 'Guardian NIC', 'Guardian Relation', 'Letter', 'Contact Email', 'Email Sent', 'Submission ID', 'Notes');
  } else {
    h.push('University', 'Faculty', 'Team Name', 'Member Count');
    for (i = 0; i < CFG.MAX_MEMBERS; i++) h.push(memberPrefix_(i) + ' Name', memberPrefix_(i) + ' Phone', memberPrefix_(i) + ' Reg No', memberPrefix_(i) + ' Reg Year');
    h.push('Contact Email', 'Email Sent', 'Submission ID', 'Notes');
  }
  return h;
}

var TAB = { school: 'School', university: 'University' };
var CODE = { school: 'S', university: 'U' };

/* ============================ one-time setup ============================ */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the script from inside the Google Sheet (Extensions → Apps Script).');
  props.setProperty('SHEET_ID', ss.getId());

  ['school', 'university'].forEach(function (cat) { prepareSheet_(ss, TAB[cat], headers_(cat)); });
  prepareSheet_(ss, 'Log', ['Timestamp', 'Code', 'Message', 'Submission ID']);
  buildDashboard_(ss);
  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  // Drive folders are created private (owner only). Never change their sharing.
  if (!props.getProperty('ROOT_FOLDER_ID')) {
    var root = DriveApp.createFolder('XBOTIX 2026');
    var letters = root.createFolder('School letters');
    props.setProperty('ROOT_FOLDER_ID', root.getId());
    props.setProperty('SCHOOL_FOLDER_ID', letters.getId());
  }

  // Defaults — EDIT THESE in Project Settings → Script Properties (must match js/config.js dates).
  var defaults = {
    REG_OPENS: '2026-10-15T00:00:00+05:30', REG_CLOSES: '2026-11-30T23:59:59+05:30',
    ALLOW_IMAGES: 'false', SITE_URL: '', WHATSAPP_GROUP: '', ADMIN_EMAIL: '', COUNTER_S: '0', COUNTER_U: '0'
  };
  Object.keys(defaults).forEach(function (k) { if (props.getProperty(k) === null) props.setProperty(k, defaults[k]); });
  Logger.log('Setup complete. Now check Script Properties (REG_OPENS / REG_CLOSES), then deploy as a web app.');
}

function prepareSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1e1e24').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (name === 'School' || name === 'University') {
    var rows = Math.max(sh.getMaxRows() - 1, 1);
    // everything is stored as text so Sheets never drops the "+" of phone numbers or the zeros of IDs
    sh.getRange(2, 1, rows, headers.length).setNumberFormat('@');
    var letterCol = headers.indexOf('Letter') + 1;
    if (letterCol) sh.getRange(2, letterCol, rows, 1).setNumberFormat('General');
    var statusRange = sh.getRange(2, headers.indexOf('Status') + 1, rows, 1);
    statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CFG.STATUSES, true).setAllowInvalid(false).build());
    var colours = { Pending: '#fff4cc', Verified: '#d9f7e3', Rejected: '#ffdcd9', Waitlist: '#e2e8ff' };
    sh.setConditionalFormatRules(Object.keys(colours).map(function (s) {
      return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(colours[s]).setRanges([statusRange]).build();
    }));
    sh.setColumnWidth(headers.indexOf('Registration ID') + 1, 120);
  }
  return sh;
}

function buildDashboard_(ss) {
  var sh = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard');
  sh.clear();
  sh.getRange('A1').setValue('XBOTIX 2026 — Dashboard').setFontWeight('bold').setFontSize(14);
  sh.getRange('A3:F3').setValues([['Category', 'Total', 'Pending', 'Verified', 'Rejected', 'Waitlist']]).setFontWeight('bold');
  [['School', 4], ['University', 5]].forEach(function (c, i) {
    var r = 4 + i, t = c[0];
    sh.getRange(r, 1, 1, 6).setFormulas([[t, '=COUNTA(' + t + '!B2:B)', '=COUNTIF(' + t + '!C2:C,"Pending")', '=COUNTIF(' + t + '!C2:C,"Verified")', '=COUNTIF(' + t + '!C2:C,"Rejected")', '=COUNTIF(' + t + '!C2:C,"Waitlist")']]);
  });
  sh.getRange('A6').setValue('All').setFontWeight('bold');
  sh.getRange('B6:F6').setFormulas([['=B4+B5', '=C4+C5', '=D4+D5', '=E4+E5', '=F4+F5']]);
  sh.getRange('A9').setValue('School teams per district').setFontWeight('bold');
  sh.getRange('A10').setFormula('=IFERROR(QUERY(School!E2:E,"select E, count(E) where E <> \'\' group by E label count(E) \'Teams\'",0),"No registrations yet")');
  sh.setColumnWidth(1, 200);
}

/* ============================ web app entry points ============================ */

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, code: 'VALIDATION', message: 'Invalid request.' }); }
  var out;
  try { out = handleRegister_(body, {}); }
  catch (err2) {
    log_('SERVER', (err2 && err2.stack) || err2, body && body.submissionId);
    out = { ok: false, code: 'SERVER', message: 'Something went wrong on our side. Please try again in a moment.' };
  }
  return json_(out);
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'status') {
    var p = PropertiesService.getScriptProperties();
    var now = new Date().getTime(), o = new Date(p.getProperty('REG_OPENS')).getTime(), c = new Date(p.getProperty('REG_CLOSES')).getTime();
    return json_({
      ok: true, serverTime: new Date().toISOString(), stage: now < o ? 'before-open' : now < c ? 'open' : 'closed',
      counts: { school: Number(p.getProperty('COUNTER_S') || 0), university: Number(p.getProperty('COUNTER_U') || 0) }
    });
  }
  return json_({ ok: true, service: 'xbotix' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code, message, fields) { var r = { ok: false, code: code, message: message }; if (fields) r.fields = fields; return r; }

/* ============================ registration ============================ */

function handleRegister_(body, opts) {
  opts = opts || {};
  if (!body || typeof body !== 'object' || body.action !== 'register') return fail_('VALIDATION', 'Unknown request.');
  var cat = body.category;
  if (cat !== 'school' && cat !== 'university') return fail_('VALIDATION', 'Unknown category.');
  var sid = String(body.submissionId || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(sid)) return fail_('VALIDATION', 'Invalid submission.');

  // 1. Spam: honeypot filled or form "completed" faster than a human could → pretend success, save nothing.
  var meta = body.meta || {};
  if (String(meta.hp || '') !== '' || !(Number(meta.elapsedMs) >= CFG.MIN_ELAPSED_MS)) {
    return { ok: true, registrationId: CFG.PREFIX + '-' + CODE[cat] + '-000', duplicate: false };
  }

  // 2. Registration window — the server clock is the only authority.
  var props = PropertiesService.getScriptProperties();
  if (!opts.skipWindow) {
    var opens = new Date(props.getProperty('REG_OPENS')).getTime(), closes = new Date(props.getProperty('REG_CLOSES')).getTime();
    if (isNaN(opens) || isNaN(closes)) return fail_('SERVER', 'Registration is not configured yet.');
    var now = new Date().getTime();
    if (now < opens) return fail_('REG_NOT_OPEN', 'Registration has not opened yet.');
    if (now > closes) return fail_('REG_CLOSED', 'Registration has closed.');
  }

  // 3. Idempotency: a retry of an already-saved submission returns the same ID.
  var cache = CacheService.getScriptCache();
  var known = cache.get('sid:' + sid);
  if (known) return { ok: true, registrationId: known, duplicate: true };

  // 4. Validate everything again.
  var c = clean_(body, cat);
  var errs = validate_(cat, c);
  if (Object.keys(errs).length) return fail_('VALIDATION', 'Please check the highlighted fields.', errs);

  // 5. Rate limit per leader phone (counted only for well-formed attempts).
  var rlKey = 'rl:' + cat + ':' + c.members[0].phone, tries = Number(cache.get(rlKey) || 0);
  if (tries >= CFG.RATE_LIMIT) return fail_('RATE_LIMIT', 'Too many attempts. Please wait a few minutes and try again.');
  cache.put(rlKey, String(tries + 1), CFG.RATE_WINDOW_S);

  // 6. School letter: check the bytes, save to the private folder (outside the lock — Drive is slow).
  var file = null, ext = 'pdf';
  if (cat === 'school') {
    var chk = checkFile_(body.file, props.getProperty('ALLOW_IMAGES') === 'true');
    if (chk.error) return fail_('FILE_INVALID', chk.error, { file: chk.error });
    ext = chk.ext;
    var folder = DriveApp.getFolderById(props.getProperty('SCHOOL_FOLDER_ID'));
    file = folder.createFile(Utilities.newBlob(chk.bytes, chk.mime, sid + '_' + safeName_(c.team.institution) + '.' + ext));
  }

  // 7. Everything that must be exclusive: dedupe, cross-team check, ID, row.
  var saved = false, id, row, sheet;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheetByName(TAB[cat]);
    var data = sheet.getDataRange().getValues(), head = data[0];
    var sidCol = head.indexOf('Submission ID'), idCol = head.indexOf('Registration ID');
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][sidCol]) === sid) { cache.put('sid:' + sid, data[r][idCol], CFG.ID_CACHE_S); return { ok: true, registrationId: String(data[r][idCol]), duplicate: true }; }
    }
    var clash = findClash_(head, data, cat, c);
    if (clash) return fail_('VALIDATION', clash.message, clash.fields);

    var key = 'COUNTER_' + CODE[cat], n = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(n));
    id = CFG.PREFIX + '-' + CODE[cat] + '-' + String(n).padStart(3, '0');

    row = sheet.getLastRow() + 1;
    var range = sheet.getRange(row, 1, 1, head.length);
    range.setNumberFormat('@');
    range.setValues([buildRow_(cat, head.length, id, sid, c)]);
    if (file) sheet.getRange(row, head.indexOf('Letter') + 1).setNumberFormat('General').setFormula('=HYPERLINK("' + file.getUrl() + '","Open letter")');
    SpreadsheetApp.flush();
    saved = true;
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* lock was never taken */ }
    if (file && !saved) file.setTrashed(true);      // never leave an orphan letter behind
  }

  // 8. After the lock: remember the ID, tidy the file name, best-effort confirmation email.
  cache.put('sid:' + sid, id, CFG.ID_CACHE_S);
  if (file) file.setName(id + '_' + safeName_(c.team.institution) + '.' + ext);
  if (c.email) {
    var sent = 'N';
    try {
      if (MailApp.getRemainingDailyQuota() > 0) { sendConfirmation_(cat, id, c, props); sent = 'Y'; }
    } catch (mailErr) { log_('MAIL', mailErr, sid); }
    sheet.getRange(row, headers_(cat).indexOf('Email Sent') + 1).setValue(sent);
  }
  return { ok: true, registrationId: id, duplicate: false };
}

/* ---------- normalisation & validation (mirrors js/modules/register/validate.js) ---------- */

function str_(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function normPhone_(s) {
  var d = String(s || '').replace(/\D/g, '');
  if (d.length === 11 && d.indexOf('94') === 0) d = d.slice(2);
  else if (d.length === 10 && d.indexOf('0') === 0) d = d.slice(1);
  return /^7\d{8}$/.test(d) ? '+94' + d : '';
}
function safeName_(s) { return String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'school'; }

function clean_(b, cat) {
  var t = b.team || {}, members = Array.isArray(b.members) ? b.members : [], g = b.guardian || {}, con = b.consent || {};
  var c = {
    team: { name: str_(t.name), institution: str_(t.institution), district: str_(t.district), faculty: str_(t.faculty) },
    members: members.slice(0, 20).map(function (m) {
      m = m || {};
      var o = { name: str_(m.name), phone: normPhone_(m.phone) || str_(m.phone) };
      if (cat === 'university') { o.regNo = str_(m.regNo).toUpperCase(); o.regYear = Number(m.regYear) || 0; }
      return o;
    }),
    guardian: { name: str_(g.name), phone: normPhone_(g.phone) || str_(g.phone), nic: str_(g.nic).toUpperCase(), relation: str_(g.relation), relationOther: str_(g.relationOther) },
    email: str_(b.email),
    consent: { accurate: con.accurate === true, rules: con.rules === true }
  };
  if (c.guardian.relation !== 'Other') c.guardian.relationOther = '';
  return c;
}

function validate_(cat, c) {
  var e = {}, t = c.team, len = function (v, a, b) { return v.length >= a && v.length <= b; };
  if (!len(t.institution, 2, 80)) e['team.institution'] = cat === 'school' ? 'Enter your school name.' : 'Enter your university name.';
  if (t.name && !/^[\p{L}\p{N} \-_&.']{2,40}$/u.test(t.name)) e['team.name'] = "Team name: 2–40 characters (letters, numbers, spaces and - _ & . ').";
  if (cat === 'school') { if (DISTRICTS.indexOf(t.district) < 0) e['team.district'] = 'Choose your district.'; }
  else if (!len(t.faculty, 2, 80)) e['team.faculty'] = 'Enter your faculty name.';

  if (c.members.length < CFG.MIN_MEMBERS || c.members.length > CFG.MAX_MEMBERS) e.members = 'A team needs ' + CFG.MIN_MEMBERS + '–' + CFG.MAX_MEMBERS + ' members.';
  var phones = {}, regs = {}, yMin = Number(PropertiesService.getScriptProperties().getProperty('UNI_REG_YEAR_MIN') || 2018), yMax = Number(PropertiesService.getScriptProperties().getProperty('UNI_REG_YEAR_MAX') || 2026);
  c.members.forEach(function (m, i) {
    var k = 'members.' + i + '.';
    if (!len(m.name, 2, 80)) e[k + 'name'] = 'Enter the full name (2–80 characters).';
    if (!/^\+947\d{8}$/.test(m.phone)) e[k + 'phone'] = 'Enter a valid Sri Lankan mobile number, e.g. 077 123 4567.';
    else if (phones[m.phone] !== undefined) e[k + 'phone'] = 'Same phone number as member ' + (phones[m.phone] + 1) + '.';
    else phones[m.phone] = i;
    if (cat === 'university') {
      if (!/^[A-Z0-9\/\-.]{3,30}$/.test(m.regNo)) e[k + 'regNo'] = 'Enter a valid registration number, e.g. EG/2022/4501.';
      else if (regs[m.regNo] !== undefined) e[k + 'regNo'] = 'Same registration number as member ' + (regs[m.regNo] + 1) + '.';
      else regs[m.regNo] = i;
      if (!(m.regYear >= yMin && m.regYear <= yMax && m.regYear % 1 === 0)) e[k + 'regYear'] = 'Choose the registration year.';
    }
  });

  if (cat === 'school') {
    var g = c.guardian;
    if (!len(g.name, 2, 80)) e['guardian.name'] = "Enter the guardian's full name.";
    if (!/^\+947\d{8}$/.test(g.phone)) e['guardian.phone'] = 'Enter a valid Sri Lankan mobile number, e.g. 077 123 4567.';
    if (!/^(\d{9}[VX]|\d{12})$/.test(g.nic)) e['guardian.nic'] = 'Enter a valid NIC, e.g. 851234567V or 198512345678.';
    if (RELATIONS.indexOf(g.relation) < 0) e['guardian.relation'] = 'Choose the relationship.';
    else if (g.relation === 'Other' && !len(g.relationOther, 1, 40)) e['guardian.relationOther'] = 'Please specify (max 40 characters).';
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) e.email = 'Enter a valid email address, or leave it blank.';
  if (!c.consent.accurate) e['consent.accurate'] = 'Please confirm to continue.';
  if (!c.consent.rules) e['consent.rules'] = 'Please confirm to continue.';
  return e;
}

/* ---------- letter: size + magic bytes ---------- */

function checkFile_(f, allowImages) {
  if (!f || typeof f.base64 !== 'string' || !f.base64) return { error: "Please upload the principal's verification letter (PDF)." };
  var b64 = f.base64.replace(/\s+/g, '');
  if (b64.length > Math.ceil(CFG.MAX_FILE_BYTES * 4 / 3) + 8) return { error: 'The file is larger than 5 MB.' };
  var kind = null;                                   // cheap prefix check before decoding
  if (b64.indexOf('JVBER') === 0) kind = 'pdf';
  else if (allowImages && b64.indexOf('/9j/') === 0) kind = 'jpg';
  else if (allowImages && b64.indexOf('iVBOR') === 0) kind = 'png';
  if (!kind) return { error: allowImages ? 'Please upload a PDF, JPG or PNG file.' : 'Please upload a PDF file.' };
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (err) { return { error: 'The file could not be read. Please upload it again.' }; }
  if (bytes.length > CFG.MAX_FILE_BYTES) return { error: 'The file is larger than 5 MB.' };
  var b = function (i) { return bytes[i] & 255; };
  var ok = kind === 'pdf' ? (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46)
    : kind === 'jpg' ? (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF)
    : (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47);
  if (!ok) return { error: 'That file is not a valid ' + kind.toUpperCase() + '.' };
  return { bytes: bytes, ext: kind, mime: kind === 'pdf' ? 'application/pdf' : kind === 'jpg' ? 'image/jpeg' : 'image/png' };
}

/* ---------- cross-team duplicates (run inside the lock; Rejected teams are ignored) ---------- */

function findClash_(head, data, cat, c) {
  var phoneCols = [], regCols = [];
  head.forEach(function (h, i) {
    if (/^(Leader|M[2-5]) Phone$/.test(h)) phoneCols.push(i);
    if (/^(Leader|M[2-5]) Reg No$/.test(h)) regCols.push(i);
  });
  var st = head.indexOf('Status'), idc = head.indexOf('Registration ID'), phoneMap = {}, regMap = {};
  for (var r = 1; r < data.length; r++) {
    if (data[r][st] === 'Rejected') continue;
    var tid = String(data[r][idc]);
    phoneCols.forEach(function (i) { var v = String(data[r][i] || ''); if (v) phoneMap[v] = tid; });
    regCols.forEach(function (i) { var v = String(data[r][i] || ''); if (v) regMap[v] = tid; });
  }
  var fields = {}, first = '';
  c.members.forEach(function (m, i) {
    if (phoneMap[m.phone]) { fields['members.' + i + '.phone'] = 'This phone number is already registered in team ' + phoneMap[m.phone] + '.'; }
    if (cat === 'university' && regMap[m.regNo]) { fields['members.' + i + '.regNo'] = 'This registration number is already registered in team ' + regMap[m.regNo] + '.'; }
  });
  var keys = Object.keys(fields);
  return keys.length ? { fields: fields, message: fields[keys[0]] } : null;
}

function buildRow_(cat, width, id, sid, c) {
  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var v = [ts, id, 'Pending', c.team.institution, cat === 'school' ? c.team.district : c.team.faculty, c.team.name, String(c.members.length)];
  for (var i = 0; i < CFG.MAX_MEMBERS; i++) {
    var m = c.members[i];
    if (cat === 'school') v.push(m ? m.name : '', m ? m.phone : '');
    else v.push(m ? m.name : '', m ? m.phone : '', m ? m.regNo : '', m ? String(m.regYear) : '');
  }
  if (cat === 'school') {
    var g = c.guardian;
    v.push(g.name, g.phone, g.nic, g.relation === 'Other' ? 'Other: ' + g.relationOther : g.relation, '');   // Letter link is set separately
  }
  v.push(c.email, '', sid, '');
  while (v.length < width) v.push('');
  return v;
}

/* ---------- log & email ---------- */

function log_(code, msg, sid) {
  try {
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    ss.getSheetByName('Log').appendRow([new Date(), code, String(msg).slice(0, 500), sid || '']);   // never log file contents
  } catch (e) { /* logging must never break a request */ }
}

function esc_(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

function sendConfirmation_(cat, id, c, props) {
  var site = String(props.getProperty('SITE_URL') || '').replace(/\/$/, ''), wa = props.getProperty('WHATSAPP_GROUP'), admin = props.getProperty('ADMIN_EMAIL');
  var uni = cat === 'university';
  var rows = [['Registration ID', id], [uni ? 'University' : 'School', c.team.institution], [uni ? 'Faculty' : 'District', uni ? c.team.faculty : c.team.district]];
  if (c.team.name) rows.push(['Team name', c.team.name]);
  c.members.forEach(function (m, i) { rows.push([i === 0 ? 'Team leader' : 'Member ' + (i + 1), m.name]); });
  var td = 'padding:8px 12px;border-bottom:1px solid #2a2a30;font-size:14px;';
  var table = rows.map(function (r) { return '<tr><td style="' + td + 'color:#a1a1aa;">' + esc_(r[0]) + '</td><td style="' + td + 'color:#f5f5f7;">' + esc_(r[1]) + '</td></tr>'; }).join('');
  var links = [];
  if (site) links.push('<a style="color:#ff3b2f;" href="' + esc_(site) + '/assets/rulebooks/' + (uni ? 'university' : 'school') + '-rulebook-v1.0.pdf">Download the rulebook</a>');
  if (wa) links.push('<a style="color:#ff3b2f;" href="' + esc_(wa) + '">Join the WhatsApp group</a>');
  var html = '<div style="background:#0a0a0b;padding:24px;font-family:Arial,sans-serif;"><div style="max-width:560px;margin:auto;background:#16161a;border-radius:14px;overflow:hidden;">' +
    '<div style="background:#0a0a0b;padding:20px 24px;border-bottom:3px solid #e3120b;">' + (site ? '<img src="' + esc_(site) + '/assets/img/logo/logo.png" alt="XBOTIX" height="56" style="display:block;">' : '<b style="color:#fff;font-size:22px;">XBOTIX 2026</b>') + '</div>' +
    '<div style="padding:24px;color:#f5f5f7;"><h2 style="margin:0 0 8px;font-size:20px;">You are registered!</h2>' +
    '<p style="color:#a1a1aa;font-size:14px;margin:0 0 16px;">Keep your Registration ID safe:</p>' +
    '<p style="font:700 30px monospace;letter-spacing:2px;color:#ff3b2f;margin:0 0 20px;">' + esc_(id) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;">' + table + '</table>' +
    '<h3 style="margin:24px 0 8px;font-size:15px;">What happens next</h3><ul style="color:#a1a1aa;font-size:14px;padding-left:18px;line-height:1.6;"><li>The organising committee will review your registration' + (uni ? '' : " and your principal's letter") + '.</li><li>Read your category rulebook and start building!</li><li>Quote your Registration ID in any message to us.</li></ul>' +
    (links.length ? '<p style="font-size:14px;">' + links.join(' &nbsp;·&nbsp; ') + '</p>' : '') + '</div>' +
    '<div style="padding:16px 24px;background:#0a0a0b;color:#6b6b75;font-size:12px;">XBOTIX 2026 · EIES, Faculty of Engineering, University of Ruhuna</div></div></div>';
  var text = 'You are registered for XBOTIX 2026.\nRegistration ID: ' + id + '\n' + rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
  var msg = { to: c.email, subject: 'XBOTIX 2026 registration confirmed — ' + id, body: text, htmlBody: html, name: 'XBOTIX 2026' };
  if (admin) msg.replyTo = admin;
  MailApp.sendEmail(msg);
}

/* ============================ editor test helpers ============================ */

function samplePdfBase64_() {
  return Utilities.base64Encode('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
}
function randPhone_() { return '+947' + String(Math.floor(10000000 + Math.random() * 89999999)); }

// Sample registrations. Use unique random phones/reg numbers each run and skip the date window.
function testRegisterSchool() {
  var out = handleRegister_({
    action: 'register', submissionId: Utilities.getUuid(), category: 'school',
    team: { name: 'Test Team', institution: 'Test College, Galle', district: 'Galle' },
    members: [{ name: 'Test Leader', phone: randPhone_() }, { name: 'Test Member', phone: randPhone_() }, { name: 'Test Member Three', phone: randPhone_() }],
    guardian: { name: 'Test Guardian', phone: randPhone_(), nic: '198512345678', relation: 'Teacher', relationOther: '' },
    email: '', file: { name: 'letter.pdf', mimeType: 'application/pdf', size: 200, base64: samplePdfBase64_() },
    consent: { accurate: true, rules: true }, meta: { hp: '', elapsedMs: 60000 }
  }, { skipWindow: true });
  Logger.log(JSON.stringify(out));
}

function testRegisterUniversity() {
  var n = Math.floor(1000 + Math.random() * 8999);
  var out = handleRegister_({
    action: 'register', submissionId: Utilities.getUuid(), category: 'university',
    team: { name: 'Test Uni Team', institution: 'University of Ruhuna', faculty: 'Faculty of Engineering' },
    members: [{ name: 'Uni Leader', phone: randPhone_(), regNo: 'EG/2022/' + n, regYear: 2022 }, { name: 'Uni Member', phone: randPhone_(), regNo: 'EG/2022/' + (n + 1), regYear: 2022 }],
    email: '', file: null, consent: { accurate: true, rules: true }, meta: { hp: '', elapsedMs: 60000 }
  }, { skipWindow: true });
  Logger.log(JSON.stringify(out));
}
