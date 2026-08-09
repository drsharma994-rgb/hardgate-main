/* HARDGATE — canonical setup fingerprint (pure, no throws).
 * Turns a formation/ticket candidate into a low-cardinality bucket key so the
 * ledger can accumulate a real per-setup-type expectancy table. */

const S = (v, d = 'na') => (v === undefined || v === null || v === '' ? d : String(v).toLowerCase());
const N = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function fpAtrBucket(atrPct) {
  const a = N(atrPct);
  if (a === null) return 'atr-na';
  if (a < 0.35) return 'atr-dead';
  if (a < 0.8) return 'atr-low';
  if (a < 1.6) return 'atr-mid';
  if (a < 3.0) return 'atr-high';
  return 'atr-wild';
}

export function fpSession(tsOrHour) {
  let h = N(tsOrHour);
  if (h === null) return 'sess-na';
  if (h > 24) h = new Date(h).getUTCHours();
  if (h >= 0 && h < 7) return 'sess-asia';
  if (h >= 7 && h < 12) return 'sess-london';
  if (h >= 12 && h < 17) return 'sess-overlap';
  if (h >= 17 && h < 21) return 'sess-ny-pm';
  return 'sess-late';
}

export function fpConflBucket(n) {
  const c = N(n);
  if (c === null) return 'cf-na';
  if (c <= 1) return 'cf-1';
  if (c === 2) return 'cf-2';
  if (c === 3) return 'cf-3';
  return 'cf-4p';
}

export function fpRrBucket(rr) {
  const r = N(rr);
  if (r === null) return 'rr-na';
  if (r < 1.5) return 'rr-lt15';
  if (r < 2.5) return 'rr-15to25';
  if (r < 4) return 'rr-25to4';
  return 'rr-4p';
}

export function fpClass(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (/(XAU|PAXG|XAUT|GOLD)/.test(s)) return 'gold';
  if (/(XAG|SILVER)/.test(s)) return 'silver';
  if (/^(BTC|WBTC)/.test(s)) return 'btc';
  if (/^(ETH|WETH|STETH)/.test(s)) return 'eth';
  return 'alt';
}

/**
 * fingerprint(cand) -> { key, parts }
 */
export function fingerprint(cand = {}) {
  const parts = {
    cls: fpClass(cand.symbol),
    side: S(cand.side, 'flat') === 'short' ? 'short' : 'long',
    poi: S(cand.poiKind, 'poi-na'),
    regime: S(cand.regime, 'reg-na'),
    htf: cand.htfAlign === true ? 'htf-yes' : cand.htfAlign === false ? 'htf-no' : 'htf-na',
    conf: fpConflBucket(cand.confluence),
    atr: fpAtrBucket(cand.atrPct),
    sess: fpSession(cand.ts ?? cand.hour),
    rr: fpRrBucket(cand.rr),
  };
  return { key: Object.values(parts).join('|'), parts };
}

export function fingerprintCoarse(cand = {}) {
  const p = fingerprint(cand).parts;
  return [p.cls, p.side, p.poi, p.regime].join('|');
}
