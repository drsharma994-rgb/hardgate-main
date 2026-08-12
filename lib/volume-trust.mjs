/* HARDGATE — gold volume trust (fix pack 16). Default deny unknown providers. */

const UNTRUSTED = new Set([
  'binance-paxg',
  'binance-xaut',
  'binance-xau',
  'paxg',
  'xaut',
]);

const TRUSTED = new Set([
  'xm-xauusd',
  'twelvedata',
  'yahoo',
  'fred',
  'delta-xaut',
  'spot',
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
