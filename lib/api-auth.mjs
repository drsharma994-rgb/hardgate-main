/* HARDGATE — shared-secret gate for mutating API routes. Fail CLOSED: with no
   secret configured, mutating routes are disabled rather than open. */
import { timingSafeEqual } from 'node:crypto';

export function apiSecret(){
  return process.env.HARDGATE_API_SECRET || '';
}

function eq(a, b){
  var A = Buffer.from(String(a));
  var B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  try { return timingSafeEqual(A, B); } catch (e) { return false; }
}

/** @returns {{ ok:true } | { ok:false, status:number, reason:string }} */
export function checkApiAuth(req){
  var secret = apiSecret();
  if (!secret){
    return { ok: false, status: 503,
      reason: 'mutating API disabled — set HARDGATE_API_SECRET on the server' };
  }
  var h = (req.headers || {});
  var got = h['x-hardgate-key'] || h['authorization'] || '';
  if (Array.isArray(got)) got = got[0];
  got = String(got).replace(/^Bearer\s+/i, '');
  if (!eq(got, secret)) return { ok: false, status: 401, reason: 'unauthorized' };
  return { ok: true };
}

export function apiAuthHeaders(extra){
  var secret = apiSecret();
  var h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  if (secret) h['X-Hardgate-Key'] = secret;
  return h;
}
