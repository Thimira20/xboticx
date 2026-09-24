// API client (PLAN E5). text/plain avoids the CORS preflight that Apps Script cannot answer.
import { cfg } from '../util.js';

// https only (the Apps Script URL); plain http is allowed for localhost while developing.
export const configured = () => /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(cfg.api.url || '');

// Always resolves with the server's JSON, or { ok:false, code:'NETWORK' } — never throws.
export async function submit(payload) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), cfg.api.timeoutMs);
  try {
    const r = await fetch(cfg.api.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload), signal: ctl.signal
    });
    try { return await r.json(); }
    catch { return { ok: false, code: 'SERVER', message: 'Unexpected response from the server. Please try again.' }; }
  } catch {
    return { ok: false, code: 'NETWORK', message: "Couldn't reach the server. Your details are saved — tap Retry." };
  } finally { clearTimeout(timer); }
}
