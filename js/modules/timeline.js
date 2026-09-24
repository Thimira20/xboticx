// Circuit Legacy timeline (PLAN D4): vertical trace on mobile, horizontal on ≥1024px.
// Trace "powers on" with scroll progress (--p); pads light when the trace reaches them.
import { $, $$, el, cfg, fetchJSON, prefersReduced, clamp, pad2, clean } from './util.js';

function buildItems(data) {
  const eds = [...data.editions].sort((a, b) => a.year - b.year);
  const items = [];
  eds.forEach((e, i) => {
    items.push({ type: 'ed', ...e });
    const nextYear = eds[i + 1] ? eds[i + 1].year : data.next?.year;
    if (nextYear && nextYear - e.year > 1) {           // gaps are computed from the years
      const from = e.year + 1, to = nextYear - 1;
      const label = (data.gaps || []).find(g => g.from === from && g.to === to)?.label || 'Offline';
      items.push({ type: 'gap', from, to, label });
    }
  });
  if (data.next) items.push({ type: 'next', ...data.next });
  return items;
}

function nodeEl(it, side) {
  const isNext = it.type === 'next';
  const title = clean(it.title), hl = clean(it.highlight);
  const card = el('div', { class: 'tl-card' },
    el('p', { class: 'yr' }, String(it.year)),
    el('p', { class: 'ed' }, `Edition ${pad2(it.edition)}${isNext && it.label ? ' · ' + it.label : ''}`),
    title && el('h3', {}, title),
    hl && el('p', {}, hl),
    it.photo && el('img', { src: it.photo, alt: `XBOTIX ${it.year} winners`, width: 447, height: 447, loading: 'lazy' }),
    it.link && el('a', { class: 'more', href: it.link }, isNext ? 'Register →' : 'See winners →')
  );
  return el('li', { class: `tl-node ${side}${it.photo ? ' is-photo' : ''}${isNext ? ' is-next' : ''}` },
    el('span', { class: 'pad', 'aria-hidden': 'true' }, pad2(it.edition)), card);
}

export async function initTimeline() {
  const root = $('#timeline');
  if (!root) return;
  let data;
  try { data = await fetchJSON('data/timeline.json'); }
  catch { root.replaceChildren(el('p', { class: 'muted' }, 'The timeline is unavailable right now.')); return; }

  const items = buildItems(data);
  let n = 0;
  items.forEach(it => {
    if (it.type === 'gap') {
      const yrs = it.from === it.to ? it.from : `${it.from}–${it.to}`;
      root.append(el('li', { class: 'tl-gap' }, el('span', {}, `${yrs} · ${it.label}`)));
    } else root.append(nodeEl(it, n++ % 2 ? 'down' : 'up'));
  });
  root.style.setProperty('--cols', items.map(i => i.type === 'gap' ? '1.2fr' : i.type === 'next' ? '1.2fr' : '1fr').map(f => `minmax(0,${f})`).join(' '));

  const nodes = $$('.tl-node', root);
  const desktop = matchMedia('(min-width: 1024px)');
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = root.getBoundingClientRect(), vh = innerHeight;
    const p = prefersReduced ? 1 : clamp((vh * .85 - r.top) / (r.height + vh * .25), 0, 1);
    root.style.setProperty('--p', p.toFixed(4));
    nodes.forEach(nd => {
      const c = desktop.matches ? (nd.offsetLeft + nd.offsetWidth / 2) / root.offsetWidth : (nd.offsetTop + 26) / root.offsetHeight;
      nd.classList.toggle('lit', c <= p + .001);
    });
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
