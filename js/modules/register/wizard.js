// Registration wizard (PLAN E4/E5): School (4 steps) / University (3 steps), teams of 2–5, member 1 = leader.
// Loaded lazily by sections.js only when the stage is "open".
import { $, el, cfg, uuid, fmtDate, linkAttrs } from '../util.js';
import { STEPS, DISTRICTS, UNIVERSITIES, OTHER, RELATIONS, emptyData, emptyMember, regYears, stepOfPath } from './fields.js';
import { validate, validateStep, normPhone, fmtPhone, normUpper } from './validate.js';
import { prepareFile, toBase64, accept, fileSize } from './upload.js';
import * as draft from './draft.js';
import { submit, configured } from './api.js';

const sessions = {};                 // one in-memory session per category
let root, tabsEl, bannerEl, body, statusEl, cur, success = false, closedStage = null, submitBtn = null;

const S = v => String(v == null ? '' : v).trim();
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
const fid = (s, p) => `f-${s.cat}-${p.replace(/\./g, '-')}`;
const warn = e => { e.preventDefault(); e.returnValue = ''; };

/* ---------- sessions ---------- */
function session(cat) {
  if (sessions[cat]) return sessions[cat];
  const s = { cat, step: 0, data: emptyData(cat), file: null, sid: uuid(), openedAt: Date.now(), restored: false, dirty: false, sending: false, failed: false };
  const d = draft.load(cat);
  if (d && d.data) {
    const { min, max } = cfg.team[cat];
    s.data = { ...s.data, ...d.data };
    s.data.consent = { accurate: false, rules: false };            // consent is never restored
    if (!Array.isArray(s.data.members) || s.data.members.length < min) s.data.members = emptyData(cat).members;
    s.data.members = s.data.members.slice(0, max);
    s.step = Math.min(d.step || 0, STEPS[cat].length - 1);
    s.sid = d.sid || s.sid; s.restored = true; s.dirty = true;
  }
  return (sessions[cat] = s);
}
const persist = s => draft.save(s.cat, { sid: s.sid, step: s.step, data: s.data });

/* ---------- payload (E5) — normalised, without base64/meta ---------- */
function collect(s) {
  const d = s.data, cat = s.cat, t = d.team;
  const team = cat === 'school'
    ? { name: S(t.name), institution: S(t.institution), district: S(t.district) }
    : { name: S(t.name), institution: S(t.institution), faculty: S(t.faculty) };
  const members = d.members.map(m => {
    const o = { name: S(m.name), phone: normPhone(m.phone) || S(m.phone) };
    if (cat === 'university') { o.regNo = normUpper(m.regNo); o.regYear = parseInt(m.regYear, 10) || 0; }
    return o;
  });
  const out = { team, members, email: S(d.email), consent: { accurate: !!d.consent.accurate, rules: !!d.consent.rules }, file: null };
  if (cat === 'school') {
    const g = d.guardian;
    out.guardian = { name: S(g.name), phone: normPhone(g.phone) || S(g.phone), nic: normUpper(g.nic), relation: g.relation, relationOther: g.relation === 'Other' ? S(g.relationOther) : '' };
    if (s.file) out.file = { name: s.file.name, mimeType: s.file.type || 'application/pdf', size: s.file.size };
  }
  return out;
}

/* ---------- errors ---------- */
function clearErr(path) {
  root.querySelectorAll(`[data-path="${path}"]`).forEach(w => {
    w.classList.remove('invalid');
    w.querySelectorAll('input,select').forEach(i => i.removeAttribute('aria-invalid'));
    const e = w.querySelector('.err'); if (e) e.textContent = '';
  });
}
function applyErrors(errs) {
  Object.entries(errs).forEach(([path, msg]) => {
    if (cur.cat === 'university' && path === 'team.institution' && cur.data.team.uniSel !== OTHER) path = 'team.uniSel';
    root.querySelectorAll(`[data-path="${path}"]`).forEach(w => {
      w.classList.add('invalid');
      w.querySelectorAll('input:not([type=radio]),select').forEach(i => i.setAttribute('aria-invalid', 'true'));
      const e = w.querySelector('.err'); if (e) e.textContent = msg;
    });
  });
}
const focusFirstInvalid = () => body.querySelector('.field.invalid:not([hidden]) input:not([type=radio]),.field.invalid:not([hidden]) select,.field.invalid:not([hidden]) input[type=radio]')?.focus();
function say(msg, kind = '') { statusEl.textContent = msg || ''; statusEl.className = 'status ' + kind; }

/* ---------- field builders ---------- */
function wrap(s, path, label, control, { optional, hint, dp } = {}) {
  const id = fid(s, path);
  return el('div', { class: 'field', 'data-path': dp || path },
    label && el('label', { for: id }, label, optional && el('span', { class: 'opt' }, ' (optional)')),
    control, hint && el('p', { class: 'hint' }, hint), el('p', { class: 'err', id: id + '-err' }));
}
function changed(s, path) { s.dirty = true; clearErr(path); persist(s); }

function input(s, path, label, o = {}) {
  const id = fid(s, path);
  const ctl = el('input', {
    id, name: path, type: o.type || 'text', inputmode: o.inputmode, autocomplete: o.autocomplete || 'off', maxlength: o.maxlength,
    placeholder: o.placeholder, value: get(s.data, path) || '', 'aria-describedby': id + '-err', autocapitalize: o.caps,
    oninput: e => { set(s.data, path, e.target.value); changed(s, path); },
    onchange: o.phone ? e => { const n = normPhone(e.target.value); if (n) { e.target.value = fmtPhone(n); set(s.data, path, e.target.value); persist(s); } } : null
  });
  return wrap(s, path, label, ctl, o);
}
function select(s, path, label, options, o = {}) {
  const id = fid(s, path), val = String(get(s.data, path) ?? '');
  const ctl = el('select', { id, name: path, 'aria-describedby': id + '-err',
    onchange: e => { set(s.data, path, e.target.value); changed(s, path); o.onchange && o.onchange(e.target.value); } },
  el('option', { value: '' }, o.placeholder || 'Select…'),
  options.map(v => el('option', { value: String(v), selected: String(v) === val }, String(v))));
  return wrap(s, path, label, ctl, o);
}
const heading = t => el('h3', { class: 'step-h', tabindex: '-1' }, t);

/* ---------- steps ---------- */
function schoolStep(s) {
  return el('div', { class: 'wstep' }, heading('Your school'),
    input(s, 'team.institution', 'School name', { autocomplete: 'organization' }),
    select(s, 'team.district', 'District', DISTRICTS, { placeholder: 'Choose district' }),
    input(s, 'team.name', 'Team name', { optional: true, maxlength: 40 }));
}

function uniStep(s) {
  const t = s.data.team;
  const other = input(s, 'team.institution', 'University name', { maxlength: 80 });
  other.hidden = t.uniSel !== OTHER;
  const sel = select(s, 'team.uniSel', 'University', [...UNIVERSITIES, OTHER], {
    placeholder: 'Choose university',
    onchange: v => { t.institution = v === OTHER ? '' : v; other.hidden = v !== OTHER; clearErr('team.institution'); persist(s); if (v === OTHER) other.querySelector('input').focus(); }
  });
  return el('div', { class: 'wstep' }, heading('Your university'), sel, other,
    input(s, 'team.faculty', 'Faculty name', { maxlength: 80 }),
    input(s, 'team.name', 'Team name', { optional: true, maxlength: 40 }));
}

function memberCard(s, i) {
  const uni = s.cat === 'university', p = `members.${i}.`;
  return el('div', { class: 'sub member' },
    el('div', { class: 'member-h' },
      el('h4', {}, i === 0 ? 'Team leader' : `Member ${i + 1}`),
      i === 0 && el('span', { class: 'badge' }, 'Leader'),
      i >= cfg.team[s.cat].min && el('button', { type: 'button', class: 'x', 'aria-label': `Remove member ${i + 1}`, onclick: () => removeMember(s, i) }, '×')),
    input(s, p + 'name', 'Full name', { autocomplete: 'off', maxlength: 80 }),
    input(s, p + 'phone', uni ? 'WhatsApp / phone number' : 'Phone number', { type: 'tel', inputmode: 'tel', placeholder: '077 123 4567', phone: true }),
    uni && input(s, p + 'regNo', 'University registration number', { placeholder: 'EG/2022/4501', caps: 'characters', maxlength: 30 }),
    uni && select(s, p + 'regYear', 'Registration year', regYears(), { placeholder: 'Year' }));
}
function membersStep(s) {
  const { min, max } = cfg.team[s.cat], n = s.data.members.length;
  return el('div', { class: 'wstep' }, heading(`Team members (${min}–${max})`),
    el('p', { class: 'muted small' }, 'Member 1 is the team leader.'),
    el('div', { class: 'field', 'data-path': 'members' }, el('p', { class: 'err' })),
    s.data.members.map((_, i) => memberCard(s, i)),
    n < max && el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => addMember(s) }, '+ Add member'),
    s.cat === 'university' && input(s, 'email', 'Contact email', { optional: true, type: 'email', inputmode: 'email', autocomplete: 'email', hint: 'We will send your confirmation here.' }));
}
function addMember(s) {
  if (s.data.members.length >= cfg.team[s.cat].max) return;
  s.data.members.push(emptyMember()); s.dirty = true; persist(s); render();
  $(`#${fid(s, `members.${s.data.members.length - 1}.name`)}`, body)?.focus();
}
function removeMember(s, i) {
  s.data.members.splice(i, 1); s.dirty = true; persist(s); render();
}

function relationField(s) {
  const g = s.data.guardian;
  const other = input(s, 'guardian.relationOther', 'Please specify', { maxlength: 40 });
  other.hidden = g.relation !== 'Other';
  const seg = el('fieldset', { class: 'field seg-wrap', 'data-path': 'guardian.relation' },
    el('legend', {}, 'Relationship to the team'),
    el('div', { class: 'seg' }, RELATIONS.map(r => el('label', {},
      el('input', { type: 'radio', name: 'relation', value: r, checked: g.relation === r,
        onchange: () => { g.relation = r; other.hidden = r !== 'Other'; changed(s, 'guardian.relation'); if (r === 'Other') other.querySelector('input').focus(); } }),
      el('span', {}, r)))),
    el('p', { class: 'err' }));
  return [seg, other];
}

function dropzone(s) {
  const id = fid(s, 'file'), zone = el('div', { class: 'dz-wrap' }), err = el('p', { class: 'err', id: id + '-err' });
  const inp = el('input', { id, type: 'file', accept: accept(), class: 'sr-only', 'aria-describedby': id + '-err', onchange: e => pick(e.target.files[0]) });
  const box = el('div', { class: 'field', 'data-path': 'file' },
    el('label', { for: id }, "Principal's verification letter"), zone, inp,
    el('p', { class: 'hint' }, `${cfg.upload.allowImages ? 'PDF, JPG or PNG' : 'PDF only'}, max ${cfg.upload.maxMB} MB. No scanner? Use Google Drive → Scan, or iPhone Notes → Scan Documents.`),
    s.restored && !s.file && el('p', { class: 'hint warn' }, 'Please re-attach your letter.'), err);
  async function pick(f) {
    if (!f) return;
    const r = await prepareFile(f);
    inp.value = '';
    if (r.error) { s.file = null; paint(); applyErrors({ file: r.error }); return; }
    s.file = r.file; s.dirty = true; clearErr('file'); paint();
  }
  function paint() {
    zone.replaceChildren(s.file
      ? el('div', { class: 'file-card' },
        el('span', { class: 'file-ico', 'aria-hidden': 'true' }, 'PDF'),
        el('div', { class: 'file-meta' }, el('strong', {}, s.file.name), el('span', { class: 'muted small' }, `${fileSize(s.file.size)} · ✓ ready`)),
        el('button', { type: 'button', class: 'x', 'aria-label': 'Remove file', onclick: () => { s.file = null; paint(); } }, '×'))
      : el('label', { class: 'dz', for: id }, el('strong', {}, 'Tap to choose your letter'), el('span', {}, cfg.upload.allowImages ? 'PDF, JPG or PNG' : 'PDF only')));
  }
  ['dragover', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop') pick(e.dataTransfer.files[0]); }));
  paint();
  return box;
}

function guardianStep(s) {
  return el('div', { class: 'wstep' }, heading('Guardian & letter'),
    input(s, 'guardian.name', 'Guardian full name', { maxlength: 80 }),
    input(s, 'guardian.phone', 'Guardian phone', { type: 'tel', inputmode: 'tel', placeholder: '077 123 4567', phone: true }),
    input(s, 'guardian.nic', 'Guardian NIC', { maxlength: 12, caps: 'characters', hint: 'Old format 851234567V or new format 198512345678.' }),
    relationField(s), dropzone(s),
    input(s, 'email', 'Contact email', { optional: true, type: 'email', inputmode: 'email', autocomplete: 'email', hint: 'We will send your confirmation here.' }));
}

function consent(s, key, text) {
  const id = fid(s, 'consent-' + key);
  return el('div', { class: 'field check', 'data-path': 'consent.' + key },
    el('label', { for: id }, el('input', { id, type: 'checkbox', checked: s.data.consent[key], 'aria-describedby': id + '-err',
      onchange: e => { s.data.consent[key] = e.target.checked; clearErr('consent.' + key); } }), el('span', {}, text)),
    el('p', { class: 'err', id: id + '-err' }));
}

function reviewStep(s) {
  const c = collect(s), uni = s.cat === 'university', row = (k, v) => el('div', { class: 'rv-row' }, el('dt', {}, k), el('dd', {}, v || '—'));
  const block = (title, idx, rows) => el('section', { class: 'rv' },
    el('div', { class: 'rv-h' }, el('h4', {}, title), el('button', { type: 'button', class: 'link', onclick: () => go(s, idx) }, 'Edit')), el('dl', {}, rows));
  const blocks = [
    block(uni ? 'University' : 'School', 0, [row(uni ? 'University' : 'School', c.team.institution), row(uni ? 'Faculty' : 'District', uni ? c.team.faculty : c.team.district), row('Team name', c.team.name)]),
    block(`Members (${c.members.length})`, 1, c.members.map((m, i) => row(i === 0 ? 'Leader' : `Member ${i + 1}`,
      `${m.name} · ${fmtPhone(m.phone)}${uni ? ` · ${m.regNo} (${m.regYear})` : ''}`)))
  ];
  if (uni) blocks[1].querySelector('dl').append(row('Contact email', c.email));
  else blocks.push(block('Guardian & letter', 2, [row('Guardian', c.guardian.name), row('Phone', fmtPhone(c.guardian.phone)), row('NIC', c.guardian.nic),
    row('Relationship', c.guardian.relation === 'Other' ? `Other: ${c.guardian.relationOther}` : c.guardian.relation),
    row('Letter', s.file ? `${s.file.name} (${fileSize(s.file.size)})` : ''), row('Contact email', c.email)]));
  return el('div', { class: 'wstep' }, heading('Review & submit'), blocks,
    consent(s, 'accurate', 'I confirm the information is correct.'),
    consent(s, 'rules', uni ? 'I agree to the rules and to event photos being published.' : 'The guardian agrees to the rules and to event photos being published.'),
    el('div', { class: 'hp', 'aria-hidden': 'true' }, el('label', {}, 'Website', el('input', { name: 'website', tabindex: '-1', autocomplete: 'off' }))),
    el('p', { class: 'muted small' }, 'Your details are used only to organise XBOTIX 2026 and are visible only to the organising committee.'));
}

const VIEWS = { school: schoolStep, university: uniStep, members: membersStep, guardian: guardianStep, review: reviewStep };

/* ---------- navigation ---------- */
function progress(s) {
  const st = STEPS[s.cat];
  return el('div', { class: 'prog' },
    el('p', { class: 'prog-label' }, `Step ${s.step + 1} of ${st.length} · `, el('strong', {}, st[s.step].title)),
    el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(st.length), 'aria-valuenow': String(s.step + 1) },
      el('i', { style: `width:${((s.step + 1) / st.length) * 100}%` })));
}
function nav(s) {
  const last = s.step === STEPS[s.cat].length - 1;
  submitBtn = last ? el('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: !!closedStage, onclick: () => send(s) }, s.failed ? 'Retry' : 'Submit registration') : null;
  return el('div', { class: 'wiz-nav' },
    s.step > 0 && el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go(s, s.step - 1) }, 'Back'),
    last ? submitBtn : el('button', { class: 'btn btn-primary', type: 'button', onclick: () => next(s) }, 'Next'));
}

function render() {
  const s = cur;
  body.replaceChildren(el('fieldset', { class: 'lock', disabled: s.sending }, progress(s), VIEWS[STEPS[s.cat][s.step].id](s), nav(s)));
  renderBanner();
}
function go(s, i) {
  s.step = i; persist(s); say(''); render();
  body.querySelector('.step-h')?.focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start' });
}
function next(s) {
  const errs = validateStep(s.cat, collect(s), STEPS[s.cat][s.step]);
  if (Object.keys(errs).length) { applyErrors(errs); focusFirstInvalid(); say('Please fix the highlighted fields.', 'err'); return; }
  go(s, s.step + 1);
}

/* ---------- submit ---------- */
function setSending(on, text) {
  cur.sending = on;
  body.querySelector('fieldset.lock').disabled = on;
  if (submitBtn) { submitBtn.classList.toggle('busy', on); if (text) submitBtn.textContent = text; }
  renderTabs();
}

async function send(s) {
  if (s.sending || closedStage) return;
  const errs = validate(s.cat, collect(s));
  if (Object.keys(errs).length) {
    go(s, Math.min(...Object.keys(errs).map(k => stepOfPath(s.cat, k))));
    applyErrors(errs); focusFirstInvalid(); say('Please fix the highlighted fields.', 'err');
    return;
  }
  if (!configured()) { say("Registration isn't available yet: the server hasn't been connected.", 'err'); return; }

  setSending(true, s.cat === 'school' ? 'Uploading letter…' : 'Saving…');
  say('');
  addEventListener('beforeunload', warn);
  let res;
  try {
    const payload = { action: 'register', submissionId: s.sid, category: s.cat, ...collect(s) };
    if (s.cat === 'school') payload.file.base64 = await toBase64(s.file);
    payload.meta = { hp: S($('[name=website]', body)?.value), elapsedMs: Date.now() - s.openedAt, ua: navigator.userAgent.slice(0, 200), turnstileToken: '' };
    res = await submit(payload);
  } catch { res = { ok: false, code: 'NETWORK', message: 'Something went wrong preparing your registration. Please try again.' }; }
  removeEventListener('beforeunload', warn);
  s.sending = false;

  if (res.ok) { draft.clear(s.cat); showSuccess(s, res.registrationId); return; }
  s.failed = true;
  if (res.code === 'REG_CLOSED' || res.code === 'REG_NOT_OPEN') closedStage = res.code === 'REG_CLOSED' ? 'closed' : 'before-open';
  const f = res.fields || {};
  if (res.code === 'FILE_INVALID' && !f.file) f.file = res.message;
  if ((res.code === 'VALIDATION' || res.code === 'FILE_INVALID') && Object.keys(f).length) {
    s.step = Math.min(...Object.keys(f).map(k => stepOfPath(s.cat, k)));
    render(); renderTabs(); applyErrors(f); focusFirstInvalid();
  } else { render(); renderTabs(); }
  say(res.message || 'Something went wrong. Please try again.', 'err');
}

/* ---------- success ---------- */
function ics() {
  const f = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XBOTIX//2026//EN', 'BEGIN:VEVENT', `UID:xbotix-${cfg.year}@xbotix`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(cfg.dates.competitionStarts)}`, `DTEND:${f(cfg.dates.competitionEnds)}`, `SUMMARY:XBOTIX ${cfg.year} Competition`,
    `LOCATION:${cfg.venue.name}\\, ${cfg.venue.address}`, 'END:VEVENT', 'END:VCALENDAR'];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}

function showSuccess(s, id) {
  success = true; say('');
  const copy = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => {
    try { await navigator.clipboard.writeText(id); copy.textContent = 'Copied ✓'; }
    catch { const r = document.createRange(); r.selectNodeContents($('.rid', body)); getSelection().removeAllRanges(); getSelection().addRange(r); copy.textContent = 'Press Ctrl+C'; }
  } }, 'Copy ID');
  tabsEl.replaceChildren(); bannerEl.replaceChildren();
  body.replaceChildren(el('div', { class: 'success', tabindex: '-1' },
    el('span', { class: 'hex-badge', 'aria-hidden': 'true' }, '✓'),
    el('h3', {}, 'You are registered!'),
    el('p', {}, 'Your Registration ID (keep it safe):'),
    el('p', { class: 'rid' }, id),
    el('p', { class: 'muted small' }, S(s.data.email) ? `A confirmation email is on its way to ${S(s.data.email)}. Check spam if you don't see it.` : 'Take a screenshot of this screen. It is your proof of registration.'),
    el('div', { class: 'cta-row' },
      copy,
      el('a', { class: 'btn btn-ghost btn-sm', href: ics(), download: 'xbotix-2026.ics' }, 'Add to calendar'),
      cfg.links.whatsappGroup && el('a', { class: 'btn btn-primary btn-sm', ...linkAttrs(cfg.links.whatsappGroup) }, 'Join WhatsApp group'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { success = false; delete sessions[s.cat]; cur = session(s.cat); paint(); root.scrollIntoView({ block: 'start' }); } }, 'Register another team'))));
  body.querySelector('.success').focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start' });
}

/* ---------- shell ---------- */
function renderBanner() {
  bannerEl.replaceChildren(...[
    cur.restored && !success && el('div', { class: 'note' }, 'We restored your draft · ', el('button', { class: 'link', type: 'button', onclick: startOver }, 'Start over')),
    closedStage && el('div', { class: 'note warn', role: 'alert' }, closedStage === 'closed' ? 'Registration has closed, so this form can no longer be submitted.' : 'Registration is not open right now.')].filter(Boolean));
}
function startOver() { draft.clear(cur.cat); delete sessions[cur.cat]; cur = session(cur.cat); paint(); }

function renderTabs() {
  const cats = [['school', 'School'], ['university', 'University']];
  tabsEl.replaceChildren(...cats.map(([c, label]) => el('button', {
    type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(cur.cat === c), tabindex: cur.cat === c ? '0' : '-1', disabled: cur.sending,
    onclick: () => switchTo(c),
    onkeydown: e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { switchTo(cats.find(x => x[0] !== c)[0]); tabsEl.querySelector('[aria-selected=true]').focus(); } }
  }, label)));
}
function switchTo(c) { if (cur.sending || c === cur.cat) return; cur = session(c); say(''); paint(); }
function paint() { renderTabs(); render(); }

export function mount(container) {
  root = container; success = false;
  tabsEl = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Registration category' });
  bannerEl = el('div', { class: 'banners' });
  body = el('div', { class: 'wiz', role: 'tabpanel' });
  statusEl = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  root.classList.add('reg-form');
  root.replaceChildren(
    el('h3', { class: 'reg-title' }, 'Register your team'),
    el('p', { class: 'muted small' }, `Registration closes on ${fmtDate(cfg.dates.registrationCloses)}. Teams of ${cfg.team.school.min}–${cfg.team.school.max} members.`),
    tabsEl, bannerEl, body, statusEl);
  // keep the active field visible above the mobile keyboard
  root.addEventListener('focusin', e => {
    if (matchMedia('(max-width: 767px)').matches && e.target.matches('input:not([type=radio]):not([type=checkbox]),select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
  cur = session(cur ? cur.cat : 'school');
  paint();
}

// The form keeps a user's work when the stage flips (server stays the final authority).
export const isActive = () => !!root && (success || Object.values(sessions).some(s => s.dirty || s.sending));
export function notifyStage(stage) { closedStage = stage === 'open' ? null : stage === 'before-open' ? 'before-open' : 'closed'; if (root && !success) render(); }
export function unmount() { if (root) root.classList.remove('reg-form'); root = null; Object.keys(sessions).forEach(k => delete sessions[k]); cur = null; closedStage = null; }
