/**
 * hg-v1157 — the dollar / 10-year snapshot the gold swing path demands.
 *
 * Since hg-v1085 (baked into goldind.js / goldswing.js in hg-v1157) a gold
 * candidate on the SWING path — the swing mint, OMNIGOLD's native inst-filter
 * row, GOLD PINE's swing lane, STAR TRADER's gold lane — is DROPPED unless the
 * live dollar AND the live 10-year both trend WITH it over 20 days: a long
 * needs DXY FALLING and US10Y FALLING, a short needs both RISING. FLAT is a
 * lock too ("a quiet feed is not a yes"), and so is an unread feed. GOLD SCALP
 * (scalp with hardReject:false) escapes it by construction.
 *
 * So a fixture that wants the swing mint to FORM must say which side the
 * macro supports. ONE home for that snapshot, so the suite does not carry
 * twenty hand-typed copies of a rule that lives in hgGoldMacroLock.
 */
export const GOLD_MACRO_LONG  = Object.freeze({ dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' });
export const GOLD_MACRO_SHORT = Object.freeze({ dxy: { trend20: 'RISING'  }, tnxTrend: 'RISING'  });
export const GOLD_MACRO_FLAT  = Object.freeze({ dxy: { trend20: 'FLAT'    }, tnxTrend: 'FLAT'    });
/** a fresh (mutable) copy for the side a test expects to form */
export function goldMacroFor(dir){
  const src = dir === 'short' ? GOLD_MACRO_SHORT : GOLD_MACRO_LONG;
  return { dxy: { trend20: src.dxy.trend20 }, tnxTrend: src.tnxTrend };
}
/** merge the aligned legs onto a snapshot a test already carries */
export function withGoldMacro(macro, dir){
  const m = goldMacroFor(dir);
  return Object.assign({}, macro || {}, { dxy: Object.assign({}, (macro && macro.dxy) || {}, m.dxy), tnxTrend: m.tnxTrend });
}
