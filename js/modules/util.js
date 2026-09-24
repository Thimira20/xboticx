// Shared helpers.
export const cfg = window.XBOTIX_CONFIG;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const pad2 = n => String(n).padStart(2, '0');

// el('a', {class:'x', href:'#', onclick:fn, dataset:{k:'v'}}, 'text', node, [more])
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return n;
}

export async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

// Unconfirmed facts are marked "[CONFIRM ...]" in data. Visitors never see the marker (debug mode does).
export function clean(text) {
  if (cfg.debug) return text || '';
  const out = String(text || '').replace(/\s*\[CONFIRM[^\]]*\]/g, '').trim();
  return out;
}

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', ...opts });
export const fmtDate = iso => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const fmtTime = iso => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

// Attributes for a link, opening external URLs in a new tab.
export function linkAttrs(href) {
  return /^https?:/i.test(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };
}

export const whatsappUrl = num => (/^\d{9,15}$/.test(num || '') ? `https://wa.me/${num}` : '');
export const hide = (node, yes = true) => { if (node) node.hidden = yes; };
