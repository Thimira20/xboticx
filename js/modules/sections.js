// Section renderers: stats, key dates, register placeholder, winners, workshops, sponsors, rulebooks, FAQ, contact, footer.
// Every data-driven section hides itself gracefully if its data fails to load.
import { $, el, cfg, fetchJSON, clean, fmtDate, fmtTime, linkAttrs, whatsappUrl, pad2 } from './util.js';
import { onStage, getStage } from './stage.js';
import { observe } from './reveal.js';

const section = id => document.getElementById(id);
const L = cfg.links;
const contactUrl = () => whatsappUrl(L.whatsappContact) || (L.email ? `mailto:${L.email}` : '#contact');

/* ---------- Stats ---------- */
export function initStats() {
  const grid = $('#statGrid');
  const stats = cfg.stats.filter(s => s.value > 0 || cfg.debug);   // unconfirmed (0) stats stay hidden
  if (!stats.length) { section('stats').hidden = true; return; }
  stats.forEach(s => grid.append(el('div', { class: 'stat' },
    el('span', { class: 'num', 'data-count': s.value, 'data-suffix': s.suffix || '' }, '0' + (s.suffix || '')),
    el('span', { class: 'lab' }, s.label))));
}

/* ---------- Key dates stepper ---------- */
export function initDates() {
  const list = $('#stepper');
  const steps = [
    { key: 'opens', title: 'Registration opens', at: cfg.dates.registrationOpens },
    { key: 'closes', title: 'Registration closes', at: cfg.dates.registrationCloses },
    { key: 'event', title: 'Competition day', at: cfg.dates.competitionStarts, end: cfg.dates.competitionEnds }
  ];
  steps.forEach((s, i) => list.append(el('li', { class: 'step' },
    el('span', { class: 'pin', 'aria-hidden': 'true' }, pad2(i + 1)),
    el('h3', {}, s.title),
    el('p', { class: 'when' }, `${fmtDate(s.at)} · ${fmtTime(s.at)}${s.end ? ' – ' + fmtTime(s.end) : ''}`))));
  const doneAt = { 'before-open': 0, open: 1, closed: 2, live: 2, ended: 3 };
  onStage(stage => {
    const done = doneAt[stage];
    [...list.children].forEach((li, i) => {
      li.classList.toggle('done', i < done);
      li.classList.toggle('current', i === done && stage !== 'ended');
    });
  });
}

/* ---------- Register: stage-aware panel; the wizard (lazy-loaded) owns the panel while the stage is open ---------- */
export function initRegister() {
  const panel = $('#regPanel');
  const wa = L.whatsappGroup;
  const btn = (text, href, cls = 'btn-primary') => el('a', { class: `btn ${cls} btn-lg`, ...linkAttrs(href) }, text);
  const cd = () => el('div', { 'data-countdown-slot': '' });
  const views = {
    'before-open': () => [el('h3', {}, 'Registration opens soon'),
      el('p', {}, `Registration opens on ${fmtDate(cfg.dates.registrationOpens)}. Get the rulebook ready and gather your team.`),
      cd(), el('div', { class: 'cta-row' }, btn(wa ? 'Get notified on WhatsApp' : 'Read the rulebooks', wa || '#rules'))],
    closed: () => [el('h3', {}, 'Registration is closed'),
      el('p', {}, 'Thank you to every team that registered. See you at the competition!'),
      cd(), el('div', { class: 'cta-row' }, btn('Contact us', contactUrl()))],
    live: () => [el('h3', {}, 'The competition is live'),
      el('p', {}, 'Robots are in the arena right now. Follow along on our socials.'),
      el('div', { class: 'cta-row' }, btn('Follow live', L.facebook || L.instagram || '#contact'))],
    ended: () => [el('h3', {}, 'See you in 2027'),
      el('p', {}, 'XBOTIX 2026 is complete. Thank you to every team, mentor and supporter.'),
      el('div', { class: 'cta-row' }, btn('See the winners', '#winners'))]
  };
  let wiz = null;
  const show = stage => {
    panel.classList.remove('reg-form');
    panel.replaceChildren(...views[stage]());
    document.dispatchEvent(new CustomEvent('countdown:refresh'));   // the new countdown slot needs its template
  };
  onStage(async stage => {
    if (stage === 'open') {
      if (wiz) { wiz.notifyStage(stage); return; }
      panel.replaceChildren(el('p', { class: 'muted' }, 'Loading the registration form…'));
      try {
        wiz = await import('./register/wizard.js');
        if (getStage() !== 'open') { wiz = null; show(getStage()); return; }
        wiz.mount(panel);
      } catch (err) {
        console.error('[xbotix] registration form failed to load', err);
        panel.replaceChildren(el('h3', {}, 'Registration form unavailable'), el('p', {}, 'Please refresh the page, or contact us if this keeps happening.'),
          el('div', { class: 'cta-row' }, btn('Contact us', contactUrl())));
      }
      return;
    }
    // stage moved on: keep a user's in-progress work (banner + disabled submit); otherwise swap the panel
    if (wiz && wiz.isActive()) { wiz.notifyStage(stage); return; }
    if (wiz) { wiz.unmount(); wiz = null; }
    show(stage);
  });
}

/* ---------- Winners ---------- */
export async function initWinners() {
  const sec = section('winners'), grid = $('#winnerGrid');
  try {
    const list = await fetchJSON('data/winners.json');
    if (!list.length) throw new Error('empty');
    list.forEach(w => grid.append(el('article', { class: 'card winner' },
      el('img', { src: w.photo, alt: w.alt || `${w.team} — ${w.award}`, width: 447, height: 447, loading: 'lazy' }),
      el('div', { class: 'winner-body' },
        el('span', { class: 'badge' }, `${w.year} · ${w.category}`),
        el('p', { class: 'award' }, w.award),
        el('p', { class: 'team' }, w.team),
        el('p', {}, w.institution),
        w.prize && el('p', { class: 'prize' }, w.prize)))));
    observe(grid);
  } catch { sec.hidden = true; }
}

/* ---------- Workshops (feature-flagged) ---------- */
export async function initWorkshops() {
  const body = $('#workshopBody'), on = cfg.features.workshops;
  const teaser = () => body.replaceChildren(el('div', { class: 'card cta-card reveal' },
    el('h3', {}, 'The XBOTIX School Workshop Series is coming soon'),
    el('p', {}, "We're planning hands-on robotics workshops for schools. Want us to visit yours?"),
    el('a', { class: 'btn btn-primary', ...linkAttrs(contactUrl()) }, 'Invite us to your school')));
  if (!on) { teaser(); observe(body); return; }
  try {
    const { items } = await fetchJSON('data/workshops.json');
    if (!items.length) { teaser(); observe(body); return; }
    body.replaceChildren(el('div', { class: 'ws-grid' }, items.map(w => el('figure', {},
      el('img', { src: w.photo, alt: w.caption || `Workshop at ${w.school}`, width: 800, height: 600, loading: 'lazy' }),
      el('figcaption', {}, `${w.school}${w.district ? ', ' + w.district : ''}${w.caption ? ' — ' + w.caption : ''}`)))));
  } catch { section('workshops').hidden = true; }
}

/* ---------- Sponsors (feature-flagged) ---------- */
export async function initSponsors() {
  const body = $('#partnerBody'), on = cfg.features.sponsors;
  const cta = () => body.replaceChildren(el('div', { class: 'card cta-card reveal' },
    el('h3', {}, 'Partner with XBOTIX 2026'),
    el('p', {}, 'Put your brand in front of the country’s brightest young engineers, their schools and families. Get in touch to become a partner.'),
    el('a', { class: 'btn btn-primary', ...linkAttrs(contactUrl()) }, 'Become a partner')));
  if (!on) { cta(); observe(body); return; }
  try {
    const { tiers, items } = await fetchJSON('data/sponsors.json');
    if (!items.length) { cta(); observe(body); return; }
    body.replaceChildren(...tiers.map(t => {
      const inTier = items.filter(i => i.tier === t);
      if (!inTier.length) return null;
      return el('div', { class: 'partner-tier' }, el('h3', {}, t),
        el('div', { class: 'logo-wall' }, inTier.map(i => {
          const img = el('img', { src: i.logo, alt: i.name, loading: 'lazy' });
          return i.url ? el('a', { ...linkAttrs(i.url), 'aria-label': i.name }, img) : el('div', {}, img);
        })));
    }));
  } catch { section('partners').hidden = true; }
}

/* ---------- Rulebooks ---------- */
export function initRulebooks() {
  const grid = $('#ruleGrid');
  cfg.rulebooks.forEach(r => grid.append(el('article', { class: 'card rule' },
    el('h3', {}, r.title),
    el('div', { class: 'meta' },
      el('span', { class: 'badge' }, `v${r.version}`),
      r.updated && el('span', { class: 'badge' }, `Updated ${fmtDate(r.updated)}`),
      r.size && el('span', { class: 'badge' }, r.size)),
    el('div', { class: 'actions' },
      el('a', { class: 'btn btn-primary btn-sm', href: r.file, target: '_blank', rel: 'noopener' }, 'View'),
      el('a', { class: 'btn btn-ghost btn-sm', href: r.file, download: '' }, 'Download')))));
}

/* ---------- FAQ ---------- */
export async function initFAQ() {
  const list = $('#faqList');
  try {
    const faq = await fetchJSON('data/faq.json');
    faq.forEach(f => list.append(el('details', {},
      el('summary', {}, f.q),
      el('div', { class: 'ans' }, el('p', {}, clean(f.a) || 'To be announced.')))));
  } catch { section('faq').hidden = true; }
}

/* ---------- Contact & footer ---------- */
const SOCIAL = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube' };
function socialLinks(cls) {
  return Object.entries(SOCIAL).filter(([k]) => L[k]).map(([k, name]) => el('a', { class: `btn btn-ghost btn-sm ${cls || ''}`, ...linkAttrs(L[k]) }, name));
}

export function initContact() {
  const grid = $('#contactGrid'), v = cfg.venue;
  const mapBox = el('div', { class: 'map-box', hidden: true });
  const loadMap = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: e => {
    mapBox.replaceChildren(el('iframe', { title: 'Map of the venue', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: `https://maps.google.com/maps?q=${encodeURIComponent(v.name + ' ' + v.address)}&output=embed` }));
    mapBox.hidden = false; e.currentTarget.hidden = true;
  } }, 'Load map');
  grid.append(el('div', { class: 'card' },
    el('h3', {}, 'Venue'),
    el('p', {}, el('strong', {}, v.name), el('br'), v.address),
    el('div', { class: 'cta-row', style: 'justify-content:flex-start;margin:0' },
      el('a', { class: 'btn btn-primary btn-sm', ...linkAttrs(v.mapUrl) }, 'Open in Maps'), loadMap),
    mapBox));

  const wa = whatsappUrl(L.whatsappContact), socials = socialLinks();
  const reach = [
    wa && el('a', { class: 'btn btn-primary btn-sm', ...linkAttrs(wa) }, 'WhatsApp us'),
    L.email && el('a', { class: 'btn btn-ghost btn-sm', href: `mailto:${L.email}` }, L.email),
    L.whatsappGroup && el('a', { class: 'btn btn-ghost btn-sm', ...linkAttrs(L.whatsappGroup) }, 'Join WhatsApp group'),
    ...socials
  ].filter(Boolean);
  grid.append(el('div', { class: 'card' }, el('h3', {}, 'Get in touch'),
    reach.length ? el('div', { class: 'socials' }, reach) : el('p', {}, 'Contact details will be announced soon.')));
  observe(grid);
}

export function initFooter() {
  $('#year').textContent = new Date().getFullYear();
  $('#footerSocials').append(...socialLinks());
}
