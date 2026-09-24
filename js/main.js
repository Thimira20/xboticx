// XBOTIX 2026 — entry point. Boots every module; one failing module never blocks the rest.
import { initCountdown } from './modules/countdown.js';
import { startStage } from './modules/stage.js';
import { initNav } from './modules/nav.js';
import { initHero } from './modules/hero.js';
import { initTimeline } from './modules/timeline.js';
import { observe } from './modules/reveal.js';
import * as S from './modules/sections.js';

const safe = (name, fn) => { try { return fn(); } catch (err) { console.error(`[xbotix] ${name} failed`, err); } };

// Order matters: sections that render stage-aware markup subscribe before the first tick.
safe('countdown', initCountdown);
safe('hero', initHero);
safe('stats', S.initStats);
safe('dates', S.initDates);
safe('register', S.initRegister);
safe('rulebooks', S.initRulebooks);
safe('contact', S.initContact);
safe('footer', S.initFooter);
safe('nav', initNav);
safe('winners', S.initWinners);
safe('workshops', S.initWorkshops);
safe('sponsors', S.initSponsors);
safe('faq', S.initFAQ);
safe('timeline', initTimeline);

// The register panel rebuilds its countdown slot on every stage change.
document.addEventListener('countdown:refresh', () => {
  const tpl = document.getElementById('tpl-countdown');
  document.querySelectorAll('[data-countdown-slot]:empty').forEach(s => s.replaceChildren(tpl.content.cloneNode(true)));
});

safe('stage', startStage);
safe('reveal', observe);
