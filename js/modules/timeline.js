// Circuit Legacy timeline (PLAN D4, "next-gen" redesign): a zig-zag circuit trace with a scroll-driven electric reveal.
// The connecting trace is a real SVG path measured from each node's actual on-screen position, so the same code
// draws it correctly whether nodes stack vertically (mobile) or run in a row (desktop) — no separate line logic per breakpoint.
import { $, $$, el, fetchJSON, prefersReduced, clamp, pad2, clean } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

function nodeEl(it, side, isNext) {
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

// Gap years (2019–2022, 2024) are no longer drawn as separate entries — the plan asked for "just the editions".
// The trace still runs straight from one held edition to the next; the jump itself tells the gap's story.
export async function initTimeline() {
  const root = $('#timeline');
  if (!root) return;
  let data;
  try { data = await fetchJSON('data/timeline.json'); }
  catch { root.replaceChildren(el('p', { class: 'muted' }, 'The timeline is unavailable right now.')); return; }

  const editions = [...data.editions].sort((a, b) => a.year - b.year);
  const items = data.next ? [...editions, { ...data.next, isNext: true }] : editions;
  let n = 0;
  items.forEach(it => root.append(nodeEl(it, n++ % 2 ? 'down' : 'up', !!it.isNext)));
  root.style.setProperty('--cols', items.map(() => 'minmax(0,1fr)').join(' '));
  const nodes = $$('.tl-node', root);

  // Wrap the list with an SVG trace layer (behind the cards) and a spark that travels it on scroll.
  const wrap = el('div', { class: 'tl-wrap' });
  root.replaceWith(wrap);
  const svg = svgEl('svg', { class: 'tl-svg', 'aria-hidden': 'true' });
  svg.innerHTML = `<defs>
    <linearGradient id="tlGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF4A2E"/><stop offset="1" stop-color="#D30000"/></linearGradient>
    <filter id="tlBlur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path class="tl-path-base" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
  <path class="tl-path-glow" fill="none" stroke="url(#tlGrad)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#tlBlur)"></path>
  <g class="tl-spark">
    <path class="arc" d="M0,0 L11,-7"></path><path class="arc a2" d="M0,0 L-10,-8"></path><path class="arc a3" d="M0,0 L2,12"></path>
    <circle class="spark-halo" r="9"></circle><circle class="spark-core" r="4"></circle>
  </g>`;
  wrap.append(svg, root);

  // Reveal formula shared by render() and the skip button: p reaches 1 once the wrap's bottom nears this fraction
  // of the viewport height (VH_TOP - VH_PAD) above the top of the viewport.
  const VH_TOP = .85, VH_PAD = .25;
  const skipBtn = $('#tlSkip');
  skipBtn?.addEventListener('click', () => {
    const r = wrap.getBoundingClientRect(), vh = innerHeight;
    const desiredTop = vh * (VH_TOP - VH_PAD) - r.height;
    scrollTo({ top: scrollY + (r.top - desiredTop) + 24, behavior: prefersReduced ? 'auto' : 'smooth' });
  });

  const base = svg.querySelector('.tl-path-base'), glow = svg.querySelector('.tl-path-glow'), spark = svg.querySelector('.tl-spark');
  let fracs = [], total = 1, lastActive = -1;

  // Expensive: re-measures every node's real position. Only on mount/resize/late layout shifts — never on scroll.
  function measure() {
    const w = wrap.clientWidth, h = wrap.offsetHeight;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.style.width = w + 'px'; svg.style.height = h + 'px';
    const wr = wrap.getBoundingClientRect();
    const pts = $$('.pad', root).map(p => { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2 - wr.left, y: r.top + r.height / 2 - wr.top }; });
    if (!pts.length) return;
    const d = 'M ' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
    base.setAttribute('d', d); glow.setAttribute('d', d);
    total = glow.getTotalLength() || 1;
    let acc = 0; fracs = [0];
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); fracs.push(acc / total); }
    glow.style.strokeDasharray = String(total);
    render();
  }

  // Cheap: reads current scroll position and updates the reveal, the spark and which pads are lit. Runs every scroll tick.
  function render() {
    const r = wrap.getBoundingClientRect(), vh = innerHeight;
    const p = prefersReduced ? 1 : clamp((vh * VH_TOP - r.top) / (r.height + vh * VH_PAD), 0, 1);
    glow.style.strokeDashoffset = String(total * (1 - p));
    spark.style.opacity = p <= .002 || p >= .998 ? '0' : '1';
    const pt = glow.getPointAtLength(clamp(p, 0, 1) * total);
    spark.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    let active = -1;
    nodes.forEach((nd, i) => {
      const shouldLight = fracs[i] != null && fracs[i] <= p + .0005;
      if (shouldLight) active = i;
      if (shouldLight === nd.classList.contains('lit')) return;
      nd.classList.toggle('lit', shouldLight);
      if (shouldLight && !prefersReduced) { const pad = nd.querySelector('.pad'); pad.classList.remove('zap'); void pad.offsetWidth; pad.classList.add('zap'); }
    });
    if (active !== lastActive) { nodes[lastActive]?.classList.remove('is-current'); nodes[active]?.classList.add('is-current'); lastActive = active; }
  }

  let raf = 0, mraf = 0;
  const queueRender = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
  const queueMeasure = () => { if (!mraf) mraf = requestAnimationFrame(() => { mraf = 0; measure(); }); };
  addEventListener('scroll', queueRender, { passive: true });
  addEventListener('resize', queueMeasure);
  addEventListener('load', queueMeasure);
  $$('img', root).forEach(img => { if (!img.complete) img.addEventListener('load', queueMeasure, { once: true }); });
  measure();
  setTimeout(measure, 400);   // catches late font/layout shifts
}
