// Scroll-spy for the mobile dock and desktop top bar. Sections opt in via data-spy="<nav id>".
import { $$ } from './util.js';

export function initNav() {
  const sections = $$('[data-spy]');
  const links = $$('[data-nav]');
  if (!sections.length || !('IntersectionObserver' in window)) return;

  const setActive = id => links.forEach(a => {
    const on = a.dataset.nav === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });

  // A section is "current" while it crosses the middle band of the viewport.
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setActive(e.target.dataset.spy); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => io.observe(s));

  // Sections without data-spy (dates, FAQ, …) highlight their own top-bar link only.
  const extra = ['dates', 'faq', 'contact'].map(id => document.getElementById(id)).filter(Boolean);
  const io2 = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  extra.forEach(s => io2.observe(s));
}
