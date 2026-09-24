// Validation rules (PLAN E4). These MUST stay identical to validate_ in apps-script/Code.gs.
// validate(category, payload) → { 'dot.path': 'message' } ; empty object = valid.
import { cfg } from '../util.js';
import { DISTRICTS, RELATIONS, inStep } from './fields.js';

// Accepts 077 123 4567, 0771234567, +94771234567, 94771234567, 771234567 → '+94771234567' (or null).
export function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('94')) d = d.slice(2);
  else if (d.length === 10 && d.startsWith('0')) d = d.slice(1);
  return /^7\d{8}$/.test(d) ? '+94' + d : null;
}
export const fmtPhone = n => (/^\+947\d{8}$/.test(n) ? `0${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : n);
export const normUpper = s => String(s || '').trim().toUpperCase();

const S = v => String(v == null ? '' : v).trim();
const len = (v, a, b) => v.length >= a && v.length <= b;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_MSG = 'Enter a valid Sri Lankan mobile number, e.g. 077 123 4567.';

export function validate(cat, d) {
  const e = {}, t = d.team || {};
  if (!len(S(t.institution), 2, 80)) e['team.institution'] = cat === 'school' ? 'Enter your school name.' : 'Enter your university name.';
  if (S(t.name) && !/^[\p{L}\p{N} \-_&.']{2,40}$/u.test(S(t.name))) e['team.name'] = "Team name: 2–40 characters (letters, numbers, spaces and - _ & . ').";
  if (cat === 'school') { if (!DISTRICTS.includes(S(t.district))) e['team.district'] = 'Choose your district.'; }
  else if (!len(S(t.faculty), 2, 80)) e['team.faculty'] = 'Enter your faculty name.';

  const { min, max } = cfg.team[cat], m = Array.isArray(d.members) ? d.members : [];
  if (m.length < min || m.length > max) e.members = `A team needs ${min}–${max} members.`;
  const phones = {}, regs = {};
  m.forEach((x, i) => {
    const k = `members.${i}.`;
    if (!len(S(x.name), 2, 80)) e[k + 'name'] = 'Enter the full name (2–80 characters).';
    const ph = normPhone(x.phone);
    if (!ph) e[k + 'phone'] = PHONE_MSG;
    else if (phones[ph] != null) e[k + 'phone'] = `Same phone number as member ${phones[ph] + 1}.`;
    else phones[ph] = i;
    if (cat === 'university') {
      const r = normUpper(x.regNo);
      if (!/^[A-Z0-9\/\-.]{3,30}$/.test(r)) e[k + 'regNo'] = 'Enter a valid registration number, e.g. EG/2022/4501.';
      else if (regs[r] != null) e[k + 'regNo'] = `Same registration number as member ${regs[r] + 1}.`;
      else regs[r] = i;
      const y = Number(x.regYear);
      if (!(Number.isInteger(y) && y >= cfg.uniRegYears.min && y <= cfg.uniRegYears.max)) e[k + 'regYear'] = 'Choose the registration year.';
    }
  });

  if (cat === 'school') {
    const g = d.guardian || {};
    if (!len(S(g.name), 2, 80)) e['guardian.name'] = "Enter the guardian's full name.";
    if (!normPhone(g.phone)) e['guardian.phone'] = PHONE_MSG;
    const nic = normUpper(g.nic);
    if (!/^(\d{9}[VX]|\d{12})$/.test(nic)) e['guardian.nic'] = 'Enter a valid NIC, e.g. 851234567V or 198512345678.';
    if (!RELATIONS.includes(g.relation)) e['guardian.relation'] = 'Choose the relationship.';
    else if (g.relation === 'Other' && !len(S(g.relationOther), 1, 40)) e['guardian.relationOther'] = 'Please specify (max 40 characters).';
    if (!d.file) e.file = "Please upload the principal's verification letter (PDF).";
  }
  if (S(d.email) && !EMAIL.test(S(d.email))) e.email = 'Enter a valid email address, or leave it blank.';
  const c = d.consent || {};
  if (c.accurate !== true) e['consent.accurate'] = 'Please confirm to continue.';
  if (c.rules !== true) e['consent.rules'] = 'Please confirm to continue.';
  return e;
}

export const validateStep = (cat, d, step) =>
  Object.fromEntries(Object.entries(validate(cat, d)).filter(([k]) => inStep(step, k)));
