// Hero: hex-logo assembly, pointer parallax, stage-aware CTAs, season journey bar.
import { $, $$, cfg, prefersReduced, clamp, linkAttrs } from './util.js';
import { onStage, onTick, D } from './stage.js';

function assemble() {
  const mark = $('#heroMark');
  if (!mark) return;
  const seen = (() => { try { return sessionStorage.getItem('xb-hero'); } catch { return null; } })();
  if (prefersReduced || seen) { mark.classList.add('is-assembled'); return; }
  $$('.hx', mark).forEach((h, i) => {
    h.style.setProperty('--i', i);
    h.style.setProperty('--dx', (Math.random() * 500 - 250).toFixed(0));
    h.style.setProperty('--dy', (Math.random() * 400 - 200).toFixed(0));
    h.style.setProperty('--r', (Math.random() * 180 - 90).toFixed(0) + 'deg');
  });
  mark.classList.add('will-fly');
  // two frames so the scattered start state is painted before the transition begins
  requestAnimationFrame(() => requestAnimationFrame(() => {
    mark.classList.remove('will-fly');
    mark.classList.add('is-assembled');
  }));
  try { sessionStorage.setItem('xb-hero', '1'); } catch { /* private mode */ }
}

// Subtle parallax on fine pointers only — none on touch (battery).
function parallax() {
  const hero = $('#home'), mark = $('#heroMark');
  if (prefersReduced || !matchMedia('(pointer: fine)').matches || !hero) return;
  let raf = 0;
  hero.addEventListener('pointermove', e => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      mark.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5) * 14 + 'px');
      mark.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5) * 10 + 'px');
    });
  });
}

const CTA = {
  'before-open': () => [['Get notified', cfg.links.whatsappGroup || '#register'], ['Rulebooks', '#rules']],
  open:          () => [['Register your team', '#register'], ['Rulebooks', '#rules']],
  closed:        () => [['View rulebooks', '#rules'], ['About the event', '#about']],
  live:          () => [['Follow live', cfg.links.facebook || cfg.links.instagram || '#contact'], ['Rulebooks', '#rules']],
  ended:         () => [['See the winners', '#winners'], ['Our legacy', '#history']]
};

function applyCTA(stage) {
  const [p, s] = CTA[stage]();
  [['primary', p], ['secondary', s]].forEach(([k, [text, href]]) => {
    const a = $(`[data-cta="${k}"]`);
    if (!a) return;
    a.textContent = text;
    ['target', 'rel'].forEach(x => a.removeAttribute(x));
    Object.entries(linkAttrs(href)).forEach(([n, v]) => a.setAttribute(n, v));
  });
}

function journey() {
  const segs = $$('[data-journey] .j-seg');
  const spans = [[D.open, D.close], [D.close, D.start], [D.start, D.end]];
  onTick(t => segs.forEach((seg, i) => {
    const f = clamp((t - spans[i][0]) / (spans[i][1] - spans[i][0]), 0, 1);
    seg.style.setProperty('--f', f.toFixed(3));
  }));
}

export function initHero() {
  assemble();
  parallax();
  journey();
  onStage(applyCTA);
}
