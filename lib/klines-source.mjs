/**
 * hg-v921 — where the replay harnesses fetch their bars.
 *
 * Both gold backtests hardcoded https://api.binance.com. That is fine on a
 * machine Binance answers, and AGENTS.md documents that many do not:
 *
 *   "Binance geo-blocking (HTTP 451): Cloud VMs may not reach fapi.binance.com."
 *
 * So the one command that could refresh the evidence was unrunnable on exactly
 * the hosts this project is normally developed on, and the only workaround was
 * to edit the harness. This makes the route a parameter.
 *
 *   HG_KLINES_BASE   an alternate origin exposing the same /api/v3/klines
 *                    shape (data-api.binance.vision, a regional mirror, a
 *                    self-hosted cache)
 *   HG_KLINES_PROXY  a HARDGATE origin whose /api/proxy will fetch it for you
 *                    — the same escape hatch scripts/edge-diagnose.mjs uses
 *                    via HARDGATE_SITE
 *
 * Unset, the behaviour is byte-identical to before: straight to Binance spot.
 * Nothing here changes a bar, a price or a rule — only which host is asked.
 */

export const DEFAULT_BASE = 'https://api.binance.com';

/** Trim one trailing slash so a base with or without it behaves the same. */
const trim = (s) => String(s || '').replace(/\/+$/, '');

/**
 * Build the klines URL for one request.
 * Returns { url, via } — `via` names the route so the harness can print it and
 * the bake's meta can record which host the evidence came from.
 */
export function klinesUrl(params, env){
  const e = env || process.env;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)){
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const base = trim(e.HG_KLINES_BASE) || DEFAULT_BASE;
  const direct = base + '/api/v3/klines?' + q.toString();

  const proxy = trim(e.HG_KLINES_PROXY || e.HARDGATE_PROXY_SITE);
  if (proxy){
    /* HARDGATE's /api/proxy takes the whole upstream URL as one encoded param.
       Encode the direct URL rather than re-assembling it, so a base override
       and a proxy compose instead of fighting. */
    return { url: proxy + '/api/proxy?url=' + encodeURIComponent(direct),
             via: proxy + '/api/proxy -> ' + base };
  }
  return { url: direct, via: base };
}

/** One line for the harness banner and for the bake's meta. */
export function klinesRouteNote(env){
  const e = env || process.env;
  const { via } = klinesUrl({ symbol: 'X', interval: '1h', limit: 1 }, e);
  const overridden = !!(trim(e.HG_KLINES_BASE) || trim(e.HG_KLINES_PROXY) || trim(e.HARDGATE_PROXY_SITE));
  return overridden
    ? ('klines route: ' + via + ' (overridden — set HG_KLINES_BASE / HG_KLINES_PROXY)')
    : ('klines route: ' + via + ' (default; set HG_KLINES_BASE or HG_KLINES_PROXY if this host is geo-blocked)');
}
