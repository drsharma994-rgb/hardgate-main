/* HARDGATE — in-memory per-IP rate limiter for the public /api/* routes (task #11).
 *
   The API is same-origin and auth where it matters already fails closed
   (lib/api-auth.mjs), but every route was still wide open to volume abuse:
   a single scripted client could hammer the market-data proxies (burning
   provider API keys) or flood the mutating routes with 401s. This is a
   fixed-window per-IP limiter with two budgets:
     - reads  (GET/HEAD):  generous — a live multi-tab terminal stays far below
     - writes (everything else): tight — legit traffic is rare (secret-gated)
   Loopback is exempt (server self-calls), and everything is env-tunable or
   disable-able because a trading terminal must never be DoS-ed by its own
   guard. No external state: one process, one Map, pruned as it goes. */

const WINDOW_MS_DEFAULT = 60 * 1000;
/* hg-v1170: reads default raised 300 -> 1200 (20/s). Deployed at 300/min the
   live terminal's own legitimate polling saturated a shared bucket within
   minutes (Render's proxy chain did not expose a per-client first hop), so
   real users were 429-ed. 1200/min still caps an abuser hard while a dozen
   power users behind one NAT never feel it. Writes stay tight: they are
   fail-closed by HARDGATE_API_SECRET anyway. */
const READS_MAX_DEFAULT = 1200;
const WRITES_MAX_DEFAULT = 30;
const MAX_TRACKED_IPS = 10000;

function num(v, dflt){ const n = +(v); return Number.isFinite(n) && n >= 0 ? n : dflt; }

/** Best-effort client IP behind Render's proxy, loopback-aware.
 *
 * LAST hop, not first: X-Forwarded-For is client-appendable, so the first
 * entry is attacker-controlled (a spoofer rotates fake first hops to dodge
 * the budget or frame someone else). Render's edge APPENDS the true client
 * IP, so the last entry is the one the trusted proxy vouches for. A spoofed
 * header therefore lands the request in the SPOOFER's own bucket — the
 * attack costs them their own budget. */
export function hgClientIp(req){
  const h = req.headers || {};
  const fwd = h['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()){
    const hops = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isLoopback(ip){
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

export function hgRateLimitConfig(env){
  env = env || process.env;
  return {
    windowMs: num(env.HG_RATE_WINDOW_MS, WINDOW_MS_DEFAULT),
    readsMax: num(env.HG_RATE_MAX, READS_MAX_DEFAULT),
    writesMax: num(env.HG_RATE_MUTATING_MAX, WRITES_MAX_DEFAULT),
    enabled: env.HG_RATE_LIMIT !== '0',
  };
}

/** One shared budget map per process. key: `${ip}|${kind}` */
const buckets = new Map();

function prune(now){
  if (buckets.size < MAX_TRACKED_IPS) return;
  for (const [k, b] of buckets){
    if (b.resetAt <= now) buckets.delete(k);
  }
  if (buckets.size >= MAX_TRACKED_IPS){
    /* still full after pruning (single-window flood): drop the oldest */
    let oldest = null;
    for (const [k, b] of buckets){ if (!oldest || b.resetAt < oldest[1].resetAt) oldest = [k, b]; }
    if (oldest) buckets.delete(oldest[0]);
  }
}

/**
 * Check one request against the budget. Mutating methods share a separate
 * per-IP budget from reads.
 * @returns {{allowed:true}} | {{allowed:false, retryAfterSec:number}}
 */
export function hgRateLimitCheck(req, env){
  const cfg = hgRateLimitConfig(env);
  if (!cfg.enabled || cfg.readsMax === 0 && cfg.writesMax === 0) return { allowed: true };
  const ip = hgClientIp(req);
  if (isLoopback(ip)) return { allowed: true };

  const kind = (req.method === 'GET' || req.method === 'HEAD') ? 'read' : 'write';
  const max = kind === 'read' ? cfg.readsMax : cfg.writesMax;
  if (max === 0) return { allowed: true };

  const key = ip + '|' + kind;
  const now = Date.now();
  prune(now);

  let b = buckets.get(key);
  if (!b || b.resetAt <= now){
    b = { count: 0, resetAt: now + cfg.windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > max){
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}

/** Test hook: clear all budgets. */
export function hgRateLimitReset(){ buckets.clear(); }

/** Server-side wiring helper: writes the 429 and returns true when blocked. */
export function hgApiRateLimit(req, res){
  const r = hgRateLimitCheck(req);
  if (r.allowed) return false;
  try{
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', String(r.retryAfterSec));
    res.statusCode = 429;
    res.end(JSON.stringify({ error: 'rate_limited', retryAfterSec: r.retryAfterSec }));
  }catch(e){ /* response already gone — nothing to do */ }
  return true;
}
