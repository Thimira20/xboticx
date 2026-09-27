// Scroll reveals (fade + rise, staggered) and count-up stats. Call observe(root) after rendering dynamic content.
import { $$, prefersReduced } from './util.js';

let io;
function countUp(n) {
  const target = +n.dataset.count, suffix = n.dataset.suffix || '';
  if (prefersReduced) { n.textContent = target + suffix; return; }
  const t0 = performance.now(), dur = 1200;
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    n.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

export function observe(root = document) {
  // stagger children of [data-stagger] containers — capped so a long list (FAQ, a big gallery) doesn't
  // make later items wait an age; everything past the cap reveals together with the capped item.
  // root itself can carry data-stagger too (e.g. observe(grid) where grid IS the [data-stagger] element) —
  // querySelectorAll only matches descendants, so that case is checked separately or it silently no-ops.
  const containers = root.nodeType === 1 && root.matches('[data-stagger]') ? [root, ...$$('[data-stagger]', root)] : $$('[data-stagger]', root);
  containers.forEach(g => [...g.children].forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--d', Math.min(i, 6)); }));
  const items = $$('.reveal:not(.in), [data-count]:not([data-counted])', root);
  if (!('IntersectionObserver' in window)) { items.forEach(reveal); return; }
  io ||= new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    reveal(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .05 });
  items.forEach(i => io.observe(i));
}

function reveal(n) {
  n.classList.add('in');
  if (n.dataset.count != null && !n.dataset.counted) { n.dataset.counted = '1'; countUp(n); }
}
