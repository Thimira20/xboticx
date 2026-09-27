// Circuit background. The faint trace grid itself is pure CSS (.circuit-bg); this lays out the parts
// that need to know the viewport: PCB components sitting on the grid intersections, the traces linking
// them, and the pulses that run between them.
//
// Everything animates via CSS (transform + opacity only, so it stays on the compositor) — there is no
// per-frame JS here. Each link shares one duration/delay between its trace pulse and the glow on the
// components at both ends, which is what makes a component light up exactly as its pulse departs or
// lands, without any JS timing.
import { $, prefersReduced } from './util.js';

const TYPES = ['cb-chip', 'cb-res', 'cb-cap', 'cb-conn'];
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

// Component artwork, all centred on the origin so a translate() places them by their middle.
const SYMBOLS = `
  <g id="cb-chip" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="-16" y="-11" width="32" height="22" rx="2"/>
    <path d="M-16,-6H-22M-16,0H-22M-16,6H-22M16,-6H22M16,0H22M16,6H22"/>
    <circle cx="-11" cy="-6" r="1.4" fill="currentColor" stroke="none"/>
  </g>
  <g id="cb-res" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="-7" y="-4.5" width="14" height="9" rx="1"/>
    <path d="M-7,0H-16M7,0H16"/>
  </g>
  <g id="cb-cap" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M-15,0H-3.5M3.5,0H15"/>
    <path d="M-3.5,-7.5V7.5M3.5,-7.5V7.5" stroke-width="1.8"/>
  </g>
  <g id="cb-conn" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="-20" y="-7" width="40" height="14" rx="1.5"/>
    <rect x="-15" y="-3" width="5" height="6" fill="currentColor" stroke="none"/>
    <rect x="-6" y="-3" width="5" height="6" fill="currentColor" stroke="none"/>
    <rect x="3" y="-3" width="5" height="6" fill="currentColor" stroke="none"/>
    <rect x="12" y="-3" width="5" height="6" fill="currentColor" stroke="none"/>
  </g>
  <g id="cb-via" fill="none" stroke="currentColor" stroke-width="1.2">
    <circle r="4.5"/><circle r="1.6" fill="currentColor" stroke="none"/>
  </g>`;

// A component: a dim always-on copy plus a bright copy whose opacity is animated (no filters, so the
// "lights up" costs nothing more than a compositor opacity change).
const comp = (type, x, y, role, dur, delay) =>
  `<g class="cb-comp ${role}" style="--cb-dur:${dur}s;--cb-delay:${delay}s" transform="translate(${x},${y})">
     <use href="#${type}" class="cb-part"/><use href="#${type}" class="cb-glow"/>
   </g>`;

export function initCircuit() {
  const layer = $('.circuit-bg');
  if (!layer) return;

  const build = () => {
    const grid = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cb-grid')) || 120;
    const W = innerWidth, H = innerHeight;
    const cols = Math.max(2, Math.floor(W / grid)), rows = Math.max(2, Math.floor(H / grid));
    // "subtle": a handful of linked component pairs, scaled to how many grid cells actually fit
    const links = Math.min(4, Math.max(2, Math.round((cols * rows) / 12)));

    const svg = [], pulses = [], taken = new Set();
    const free = (c, r) => !taken.has(`${c},${r}`);
    const take = (c, r) => taken.add(`${c},${r}`);
    const types = shuffle([...TYPES, ...TYPES]);

    for (let i = 0; i < links; i++) {
      const span = 2 + Math.floor(Math.random() * 2);          // 2–3 cells apart
      let horizontal = Math.random() < 0.55;
      // A phone is only ~3 grid cells wide, so a horizontal run doesn't fit — fall back to the other
      // axis rather than dropping the link, which would leave narrow screens with a bare board.
      if (horizontal && cols - span < 2) horizontal = false;
      else if (!horizontal && rows - span < 2) horizontal = true;
      const along = horizontal ? cols : rows, across = horizontal ? rows : cols;
      if (along - span < 2) continue;                          // genuinely no room on either axis
      const a = 1 + Math.floor(Math.random() * (along - span - 1));
      const b = a + span;
      const fixed = 1 + Math.floor(Math.random() * Math.max(1, across - 1));
      const [c1, r1] = horizontal ? [a, fixed] : [fixed, a];
      const [c2, r2] = horizontal ? [b, fixed] : [fixed, b];
      if (!free(c1, r1) || !free(c2, r2)) continue;
      take(c1, r1); take(c2, r2);

      const x1 = c1 * grid, y1 = r1 * grid, x2 = c2 * grid, y2 = r2 * grid;
      const dur = rand(7, 12).toFixed(1), delay = (-rand(0, 10)).toFixed(1);

      svg.push(`<path class="cb-trace" d="M${x1},${y1} L${x2},${y2}"/>`);
      svg.push(comp(types[i * 2] || pickOne(TYPES), x1, y1, 'cb-out', dur, delay));
      svg.push(comp(types[i * 2 + 1] || pickOne(TYPES), x2, y2, 'cb-in', dur, delay));
      pulses.push(`<span class="cb-pulse ${horizontal ? 'cb-h' : 'cb-v'}" style="--x1:${x1}px;--y1:${y1}px;--x2:${x2}px;--y2:${y2}px;--cb-dur:${dur}s;--cb-delay:${delay}s"></span>`);
    }

    // scattered vias — tiny, so they add board detail without adding visual weight
    for (let i = 0; i < 5; i++) {
      const c = 1 + Math.floor(Math.random() * Math.max(1, cols - 1));
      const r = 1 + Math.floor(Math.random() * Math.max(1, rows - 1));
      if (!free(c, r)) continue;
      take(c, r);
      svg.push(`<g class="cb-comp" transform="translate(${c * grid},${r * grid})"><use href="#cb-via" class="cb-part"/></g>`);
    }

    // a couple of free-running pulses across the wider field, so the board isn't motionless
    // everywhere except the linked pairs
    for (let i = 0; i < 2; i++) {
      const horizontal = i % 2 === 0;
      const line = (1 + Math.floor(Math.random() * Math.max(1, (horizontal ? rows : cols) - 1))) * grid;
      const dur = rand(9, 15).toFixed(1), delay = (-rand(0, 12)).toFixed(1);
      const [x1, y1, x2, y2] = horizontal ? [-120, line, W + 120, line] : [line, -120, line, H + 120];
      pulses.push(`<span class="cb-pulse ${horizontal ? 'cb-h' : 'cb-v'} cb-sweep" style="--x1:${x1}px;--y1:${y1}px;--x2:${x2}px;--y2:${y2}px;--cb-dur:${dur}s;--cb-delay:${delay}s"></span>`);
    }

    layer.innerHTML =
      `<svg class="cb-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
         <defs>${SYMBOLS}</defs>${svg.join('')}
       </svg>` + (prefersReduced ? '' : pulses.join(''));
  };

  build();
  // Rebuild on resize so components stay on the grid lines. Debounced — this is layout, not animation.
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 250); });

  // Nothing should animate while the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    const state = document.hidden ? 'paused' : '';
    layer.querySelectorAll('.cb-pulse, .cb-glow').forEach(n => { n.style.animationPlayState = state; });
  });
}
