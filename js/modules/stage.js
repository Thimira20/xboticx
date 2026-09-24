// Stage engine — single source of truth for every time-based UI (PLAN D5).
import { cfg } from './util.js';

export const STAGES = ['before-open', 'open', 'closed', 'live', 'ended'];
const T = k => Date.parse(cfg.dates[k]);
export const D = { open: T('registrationOpens'), close: T('registrationCloses'), start: T('competitionStarts'), end: T('competitionEnds') };

export const LABELS = {
  'before-open': 'Registration opens in',
  open: 'Registration closes in',
  closed: 'Competition starts in',
  live: 'LIVE — competition in progress',
  ended: 'XBOTIX 2026 is complete — see you in 2027'
};

const listeners = new Set();
const tickers = new Set();
let offset = 0, current = null, timer = null;

// Debug overrides only shift the UI clock; the server always uses its own clock.
(function applyOverride() {
  if (!cfg.debug) return;
  const q = new URLSearchParams(location.search);
  const asked = Date.parse(q.get('now'));
  if (q.has('now') && !isNaN(asked)) { offset = asked - Date.now(); return; }
  const s = q.get('stage');
  const anchors = {
    'before-open': D.open - 10 * 864e5,
    open: Math.max(D.open + 1000, D.close - 10 * 864e5),
    closed: D.close + (D.start - D.close) / 2,
    live: D.start + (D.end - D.start) / 2,
    ended: D.end + 864e5
  };
  if (anchors[s]) offset = anchors[s] - Date.now();
})();

export const now = () => Date.now() + offset;
export const getStage = () => current;
export const stageAt = t => t < D.open ? 'before-open' : t < D.close ? 'open' : t < D.start ? 'closed' : t < D.end ? 'live' : 'ended';
export const targetOf = s => ({ 'before-open': D.open, open: D.close, closed: D.start, live: D.end, ended: null })[s];
export const isUrgent = t => stageAt(t) === 'open' && D.close - t <= 48 * 36e5;

// fn(stage, prevStage) fires on every stage change (and once immediately if a stage is already known).
export function onStage(fn) { listeners.add(fn); if (current) fn(current, null); }
// fn(nowMs, stage) fires every second while the tab is visible.
export function onTick(fn) { tickers.add(fn); if (current) fn(now(), current); }

function tick() {
  const t = now(), s = stageAt(t);
  if (s !== current) {
    const prev = current;
    current = s;
    document.documentElement.dataset.stage = s;
    listeners.forEach(f => f(s, prev));
    document.dispatchEvent(new CustomEvent('stagechange', { detail: { stage: s, prev } }));
  }
  tickers.forEach(f => f(t, s));
}

export function startStage() {
  const run = () => { clearInterval(timer); timer = setInterval(tick, 1000); };
  tick(); run();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timer); else { tick(); run(); }
  });
}
