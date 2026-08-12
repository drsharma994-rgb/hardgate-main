/* HARDGATE — pattern rarity from sweep coarse signatures (fix pack 15). */

const S = (v) => String(v || '').toLowerCase();

export function coarseSignature(cand = {}) {
  const dir = S(cand.dir || cand.side) === 'short' ? 'short' : 'long';
  const fam = S(cand.triggerFamily || cand.stratKey || cand.strategy || cand.poiKind || 'na');
  return dir + '|' + fam;
}

/**
 * Count universe members sharing coarse signature this sweep.
 */
export function hgSignalRarity(candidates = [], universeSize = 0, cand = null) {
  const list = Array.isArray(candidates) ? candidates : [];
  const uSize = Math.max(list.length, Number(universeSize) || list.length || 1);
  const target = cand || (list[0] || {});
  const sig = coarseSignature(target);
  let shared = 0;
  for (let i = 0; i < list.length; i++) {
    if (coarseSignature(list[i]) === sig) shared++;
  }
  const rarityPct = shared / uSize;
  let label = 'NORMAL';
  if (rarityPct <= 0.05) label = 'IDIOSYNCRATIC';
  else if (rarityPct >= 0.25) label = 'COMMON';
  const note = label === 'COMMON'
    ? shared + '/' + uSize + ' symbols show this — you are long beta, not a setup'
    : (label === 'IDIOSYNCRATIC' ? shared + '/' + uSize + ' — idiosyncratic' : shared + '/' + uSize);
  return { sharedCount: shared, universeSize: uSize, rarityPct, label, note, signature: sig };
}
