// Draft autosave (text fields only — never the letter). One draft per category, kept for 7 days.
const key = c => `xbotix-draft-${c}`;
const timers = {};

export function load(cat) {
  try {
    const d = JSON.parse(localStorage.getItem(key(cat)));
    return d && d.v === 1 && Date.now() - d.ts < 7 * 864e5 ? d : null;
  } catch { return null; }
}

export function save(cat, obj) {
  clearTimeout(timers[cat]);
  timers[cat] = setTimeout(() => {
    try { localStorage.setItem(key(cat), JSON.stringify({ v: 1, ts: Date.now(), ...obj })); } catch { /* storage full / blocked */ }
  }, 500);
}

export function clear(cat) {
  clearTimeout(timers[cat]);
  try { localStorage.removeItem(key(cat)); } catch { /* ignore */ }
}
