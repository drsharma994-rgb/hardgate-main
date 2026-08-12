/* HARDGATE — per-timeframe gold candle provenance (fix pack 16). */

/**
 * Record src[tf] at every assignment; legacy `source` = first 15m or first set.
 */
export function hgGoldSrcInit(extra = {}) {
  return Object.assign({ src: {}, mixed: false, source: null }, extra);
}

export function hgGoldSrcAssign(out, tf, source, rowsKey, rows) {
  if (!out || !tf || !source) return out;
  if (!out.src) out.src = {};
  if (rows && rows.length) {
    if (rowsKey) out[rowsKey] = rows;
    out.src[tf] = source;
  }
  return out;
}

export function hgGoldSrcFinalize(out, legacyTf) {
  if (!out) return out;
  if (!out.src) out.src = {};
  const providers = [];
  for (const k of Object.keys(out.src)) {
    const v = out.src[k];
    if (v && providers.indexOf(v) < 0) providers.push(v);
  }
  out.mixed = providers.length > 1;
  const legTf = legacyTf || '15m';
  out.source = out.src[legTf] || out.src['4h'] || out.src['1d'] || providers[0] || out.source || null;
  return out;
}

export function hgMixedFeedReason(src, tfA, tfB) {
  if (!src || !src[tfA] || !src[tfB]) return null;
  if (src[tfA] === src[tfB]) return null;
  return 'mixed feed — ' + tfA + ' from ' + src[tfA] + ', ' + tfB + ' from ' + src[tfB];
}

export function hgGoldSrcMixedLabel(src) {
  if (!src) return '';
  const parts = [];
  for (const tf of ['15m', '1h', '4h', '1d']) {
    if (src[tf]) parts.push(tf + ' ' + src[tf]);
  }
  return parts.join(' · ');
}
