// Section renderers: stats, key dates, register placeholder, winners, workshops, sponsors, rulebooks, FAQ, contact, footer.
// Every data-driven section hides itself gracefully if its data fails to load.
import { $, $$, el, cfg, fetchJSON, clean, fmtDate, fmtTime, linkAttrs, whatsappUrl, pad2, prefersReduced } from './util.js';
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
// A photo-gallery-style masonry (real image aspect ratios via CSS multi-column, so tiles are never
// uniform) that resizes from one column on a phone up to five on desktop with no JS breakpoints needed.
// Each tile shows just the school name; hovering (or tapping, on touch) lifts it in 3D and reveals the rest.
function wsTile(w) {
  const more = [w.district, w.date && fmtDate(w.date), w.caption].filter(Boolean).join(' · ');
  const fig = el('figure', { class: 'ws-item', tabindex: '0' },
    el('img', { src: w.photo, alt: `${w.school}${w.caption ? ' — ' + w.caption : ''}`, loading: 'lazy' }),
    el('figcaption', {}, el('strong', {}, w.school), more && el('span', { class: 'ws-more' }, more)));
  // Touch has no real :hover, so a tap toggles the reveal directly (closing whichever tile was open).
  fig.addEventListener('click', () => {
    if (matchMedia('(hover: hover)').matches) return;
    const open = fig.classList.toggle('is-open');
    $$('.ws-item.is-open').forEach(o => { if (o !== fig) o.classList.remove('is-open'); });
  });
  return fig;
}

export async function initWorkshops() {
  const body = $('#workshopBody'), on = cfg.features.workshops, skipBtn = $('#wsSkip');
  const teaser = () => body.replaceChildren(el('div', { class: 'card cta-card reveal' },
    el('h3', {}, 'The XBOTIX School Workshop Series is coming soon'),
    el('p', {}, "We're planning hands-on robotics workshops for schools. Want us to visit yours?"),
    el('a', { class: 'btn btn-primary', ...linkAttrs(contactUrl()) }, 'Invite us to your school')));
  if (!on) { teaser(); observe(body); skipBtn.hidden = true; return; }
  try {
    const { items } = await fetchJSON('data/workshops.json');
    if (!items.length) { teaser(); observe(body); skipBtn.hidden = true; return; }
    const grid = el('div', { class: 'ws-grid' }, items.map(wsTile));
    body.replaceChildren(grid);
    skipBtn.hidden = items.length < 3;
    skipBtn.onclick = () => grid.lastElementChild.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
  } catch { section('workshops').hidden = true; skipBtn.hidden = true; }
}

/* ---------- Sponsors (feature-flagged) ---------- */
// Confirmed partners cycle through a "spotlight" one at a time (auto-advance, arrows, dots) — an
// advertising-style rotator rather than a static grid. Ordered by tier (data/sponsors.json → tiers).
// A "coverflow" rotator: the active partner sits large and centered; its immediate neighbours peek in
// half-cut-off at the edges, smaller and faded, so it's obvious there's more to see either side.
function buildSpotlight(items) {
  let i = 0, timer = null;
  const stage = el('div', { class: 'spot-stage' });
  const n = items.length;
  const slides = items.map((p, idx) => el('figure', { class: 'spot-item' },
    el('span', { class: 'logo-plate' }, el('img', { src: p.logo, alt: p.name, loading: idx === 0 ? 'eager' : 'lazy' })),
    el('figcaption', {},
      el('span', { class: 'spot-tier' }, p.tier ? `${p.tier} Partner` : 'Partner'),
      el('strong', {}, p.name),
      p.url && el('a', { class: 'spot-link', ...linkAttrs(p.url) }, 'Visit site'))));
  stage.append(...slides);

  const dotEls = items.map((p, idx) => el('button', { type: 'button', 'aria-label': `Show ${p.name}`, 'aria-current': String(idx === 0), onclick: () => go(idx) }));
  const dots = el('div', { class: 'spot-dots' }, dotEls);
  // el() can't create SVG nodes (document.createElement doesn't know the SVG namespace), so the icon is raw markup.
  const arrow = (dir, label, path) => {
    const b = el('button', { class: `spot-arrow spot-${dir}`, type: 'button', 'aria-label': label, onclick: () => go(i + (dir === 'next' ? 1 : -1)) });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    return b;
  };

  // Positions every slide by its signed distance from the active one (shortest way round the loop),
  // so immediate neighbours land just off-centre and anything further out fades away completely.
  function layout() {
    const peek = parseFloat(getComputedStyle(stage).getPropertyValue('--spot-peek')) || 150;
    slides.forEach((s, idx) => {
      let rel = idx - i;
      if (rel > n / 2) rel -= n; else if (rel < -n / 2) rel += n;
      const active = rel === 0, mag = Math.min(Math.abs(rel), 2);
      s.classList.toggle('is-active', active);
      s.setAttribute('aria-hidden', String(!active));
      s.style.transform = `translateX(${(rel * peek).toFixed(1)}px) scale(${(1 - mag * .22).toFixed(2)})`;
      s.style.opacity = Math.max(0, 1 - mag * .55).toFixed(2);
      s.style.zIndex = String(10 - mag);
    });
  }
  function go(next) { i = (next + n) % n; layout(); dotEls.forEach((d, idx) => d.setAttribute('aria-current', String(idx === i))); }

  const multi = n > 1;
  const root = el('div', { class: 'spotlight' },
    el('div', { class: 'spot-row' }, multi && arrow('prev', 'Previous partner', 'M15 5l-7 7 7 7'), stage, multi && arrow('next', 'Next partner', 'M9 5l7 7-7 7')),
    multi && dots);
  layout();
  if (multi) addEventListener('resize', layout);   // --spot-peek changes at the desktop breakpoint

  if (multi && !prefersReduced) {
    const start = () => { timer = setInterval(() => go(i + 1), 4500); };
    const stop = () => clearInterval(timer);
    root.addEventListener('mouseenter', stop); root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop); root.addEventListener('focusout', start);
    start();
  }
  return root;
}

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
    const ordered = tiers?.length ? [...items].sort((a, b) => tiers.indexOf(a.tier) - tiers.indexOf(b.tier)) : items;
    body.replaceChildren(buildSpotlight(ordered));
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

// Decorative only (desktop): a real, geographically traced Sri Lanka outline (assets/img/venue-map-lk.svg —
// see its header comment for the source/licence) filling the Venue card's leftover height, with a radar
// ping over Galle. The pin's position (25.95%, 96.3%) was computed from Galle's actual lat/long against
// the source map's documented projection bounds, not eyeballed. el() can't create SVG nodes, so the pin
// markup (needs no namespace since it's plain HTML) is built normally, only the ping's ring is CSS.
function venueMapDecor() {
  // .lk-wrap shrink-wraps exactly to the rendered image (no letterboxing), so the pin's percentage
  // position lines up with the actual map regardless of how much height the flex layout gives it.
  const box = el('div', { class: 'venue-map', 'aria-hidden': 'true' },
    el('div', { class: 'lk-wrap' },
      el('img', { src: 'assets/img/venue-map-lk.svg', alt: '', loading: 'lazy' }),
      el('span', { class: 'lk-pin', style: 'left:25.95%;top:96.3%' },
        el('span', { class: 'lk-ping' }), el('span', { class: 'lk-ping d2' }), el('span', { class: 'lk-ping d3' }),
        el('span', { class: 'lk-dot' }), el('span', { class: 'lk-label' }, 'Galle'))));
  return box;
}

export function initContact() {
  const grid = $('#contactGrid'), v = cfg.venue;
  const mapBox = el('div', { class: 'map-box', hidden: true });
  const mapDecor = venueMapDecor();
  const loadMap = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: e => {
    mapBox.replaceChildren(el('iframe', { title: 'Map of the venue', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: `https://maps.google.com/maps?q=${encodeURIComponent(v.name + ' ' + v.address)}&output=embed` }));
    mapBox.hidden = false; mapDecor.hidden = true; e.currentTarget.hidden = true;
  } }, 'Load map');
  grid.append(el('div', { class: 'card venue-card' },
    el('h3', {}, 'Venue'),
    el('p', {}, el('strong', {}, v.name), el('br'), v.address),
    el('div', { class: 'cta-row', style: 'justify-content:flex-start;margin:0' },
      el('a', { class: 'btn btn-primary btn-sm', ...linkAttrs(v.mapUrl) }, 'Open in Maps'), loadMap),
    mapBox, mapDecor));

  // Local display format for a WhatsApp number, e.g. "94715508827" -> "071 550 8827".
  const fmtWaNumber = num => {
    const d = String(num || '').replace(/\D/g, '');
    const local = d.startsWith('94') ? '0' + d.slice(2) : d;
    return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local;
  };
  const people = (cfg.contacts || []).map(p => {
    const wa = whatsappUrl(p.phone);
    return el('div', { class: 'contact-person' },
      el('div', {}, el('strong', {}, p.name), p.role && el('span', { class: 'muted small' }, p.role)),
      el('div', { class: 'socials' },
        wa && el('a', { class: 'btn btn-ghost btn-sm', ...linkAttrs(wa) }, `WhatsApp · ${fmtWaNumber(p.phone)}`),
        p.email && el('a', { class: 'btn btn-ghost btn-sm', href: `mailto:${p.email}` }, p.email)));
  });

  const socials = socialLinks();
  const reach = [
    L.whatsappGroup && el('a', { class: 'btn btn-ghost btn-sm', ...linkAttrs(L.whatsappGroup) }, 'Join WhatsApp group'),
    ...socials
  ].filter(Boolean);

  grid.append(el('div', { class: 'card' }, el('h3', {}, 'Get in touch'),
    people.length ? el('div', { class: 'contact-people' }, people) : el('p', {}, 'Contact details will be announced soon.'),
    reach.length ? el('div', { class: 'socials', style: people.length ? 'margin-top:1rem' : '' }, reach) : null));
  observe(grid);
}

export function initFooter() {
  $('#year').textContent = new Date().getFullYear();
  $('#footerSocials').append(...socialLinks());
}
