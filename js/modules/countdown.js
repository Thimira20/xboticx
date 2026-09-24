// Countdown UI bound to the stage engine. Fills every [data-countdown-slot] from the template.
import { $, $$, pad2, prefersReduced, el } from './util.js';
import { onStage, onTick, targetOf, isUrgent, LABELS } from './stage.js';

export function initCountdown() {
  const tpl = $('#tpl-countdown');
  $$('[data-countdown-slot]').forEach(slot => slot.replaceChildren(tpl.content.cloneNode(true)));

  // Stage label changes are announced (aria-live); the ticking digits are not.
  onStage(stage => {
    $$('[data-stage-label]').forEach(n => {
      if (stage === 'live') n.replaceChildren(el('span', { class: 'live-dot' }), LABELS.live);
      else n.textContent = LABELS[stage];
    });
    // Live/ended show the label only, so the tiles are hidden.
    $$('.countdown').forEach(c => { c.hidden = stage === 'live' || stage === 'ended'; });
  });

  onTick((t, stage) => {
    const target = targetOf(stage);
    const urgent = isUrgent(t);
    document.documentElement.toggleAttribute('data-urgent-on', urgent);
    $$('[data-urgent]').forEach(n => { n.hidden = !urgent; });
    if (target == null) return;
    const diff = Math.max(0, target - t);
    const parts = { d: Math.floor(diff / 864e5), h: Math.floor(diff / 36e5) % 24, m: Math.floor(diff / 6e4) % 60, s: Math.floor(diff / 1e3) % 60 };
    $$('.cd-num').forEach(n => {
      const u = n.dataset.u, v = u === 'd' ? String(parts.d).padStart(2, '0') : pad2(parts[u]);
      if (n.textContent === v) return;
      n.textContent = v;
      if (u === 's' && !prefersReduced && n.animate) n.animate([{ transform: 'translateY(-35%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 150, easing: 'ease-out' });
    });
  });
}
