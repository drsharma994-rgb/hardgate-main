/* HARDGATE — gold volume trust (fix pack 16). Default deny unknown providers. */

const UNTRUSTED = new Set([
  'binance-paxg',
  'binance-xaut',
  'binance-xau',
  'paxg',
  'xaut',
]);

// NOTE: 'delta-xaut' is deliberately NOT listed here. It is tokenised gold, so the
// UNTRUSTED check below (which also matches /xaut/) owns it. Listing it here as
// trusted was unreachable dead code and read as a contradiction.
// Only real gold OHLCV venues belong here. This mirrors GOLD_SRC_LABEL in index.html
// and must stay identical to the TRUSTED branch in fixpack16-core.js (browser copy).
// 'fred' (macro series, no volume) and 'spot' (generic word, not a provider id) were
// removed: neither is a gold candle provider, so neither may vote on volume gates.
const TRUSTED = new Set([
  'xm-xauusd',
  'twelvedata',
  'yahoo',
]);

/**
 * hgVolumeTrust(source, tf) -> { trusted, reason }
 * Tokenised-gold / crypto-venue volume must not vote on gold flow gates.
 */
export function hgVolumeTrust(source, tf) {
  const src = String(source || '').toLowerCase();
  const tfLabel = tf ? String(tf) : '';
  if (!src) {
    return { trusted: false, reason: 'unknown provider' + (tfLabel ? ' (' + tfLabel + ')' : '') };
  }
  if (UNTRUSTED.has(src) || /paxg|xaut|token/.test(src)) {
    return {
      trusted: false,
      reason: 'volume is ' + source + ', not gold flow',
    };
  }
  if (TRUSTED.has(src) || src.startsWith('xm-')) {
    return { trusted: true, reason: 'gold venue volume' };
  }
  return { trusted: false, reason: 'unknown provider' };
}

export function hgVolumeAbsentReason(hasVol) {
  return hasVol ? null : 'no volume on this feed';
}
