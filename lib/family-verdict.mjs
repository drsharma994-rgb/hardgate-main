/* HARDGATE — family-count verdict for DEEP SCAN (fix pack 16). */

import { HG_DEEP_FAMILY_ORDER } from './gate-families.mjs';

const TIMING_GATES = new Set(['G29', 'G30']);

/**
 * @param {ReturnType<import('./gate-families.mjs').hgFamilyRollup>} rollup
 * @param {{ legacyScore?: number, structuralRrVeto?: boolean, structuralRrPass?: boolean }} opts
 */
export function hgFamilyVerdict(rollup, opts = {}) {
  opts = opts || {};
  let agree = 0;
  let oppose = 0;
  let dark = 0;
  let split = 0;
  const blockers = [];
  const darkFamilies = [];
  const splitFamilies = [];

  for (let i = 0; i < rollup.length; i++) {
    const fam = rollup[i];
    if (fam.verdict === 'AGREE') agree++;
    else if (fam.verdict === 'OPPOSE') oppose++;
    else if (fam.verdict === 'DARK') {
      dark++;
      darkFamilies.push(fam.label);
    } else if (fam.verdict === 'SPLIT') {
      split++;
      splitFamilies.push(fam.label);
    }
    for (let j = 0; j < fam.members.length; j++) {
      const m = fam.members[j];
      if (TIMING_GATES.has(m.id) && m.state === 'veto') blockers.push(m.id);
    }
  }

  if (opts.structuralRrVeto) blockers.push('GS7/GC6');
  const timingVeto = blockers.some((b) => b === 'G29' || b === 'G30');
  const total = HG_DEEP_FAMILY_ORDER.length;
  const effectiveN = agree + oppose + split;

  let label = 'BIAS ONLY';
  let why = 'Direction exists; family agreement insufficient.';
  let tier = 'bias';

  if (timingVeto) {
    label = 'TIMING VETO';
    why = 'Hard timing veto (' + blockers.filter((b) => b === 'G29' || b === 'G30').join(', ') + ') — overrides family count.';
    tier = 'veto';
  } else if (opts.structuralRrVeto) {
    label = 'STRUCTURAL VETO';
    why = 'Structural R:R < 2 — trade not worth taking regardless of family agreement.';
    tier = 'veto';
  } else if (agree >= 10 && oppose === 0 && dark <= 1 && split === 0) {
    label = 'STRONG';
    why = agree + ' of ' + total + ' families agree · oppose 0 · dark ' + dark;
    tier = 'strong';
  } else if (agree >= 8 && oppose <= 1 && split <= 1) {
    label = 'MODERATE';
    why = agree + ' of ' + total + ' families agree · oppose ' + oppose;
    tier = 'moderate';
  } else if (agree >= 6) {
    label = 'WEAK';
    why = agree + ' of ' + total + ' families agree · oppose ' + oppose + ' · split ' + split;
    tier = 'weak';
  }

  const headline = agree + ' of ' + total + ' families agree'
    + (dark ? ' · ' + dark + ' DARK (' + darkFamilies.join(', ') + ')' : '')
    + (split ? ' · ' + split + ' SPLIT (' + splitFamilies.join(', ') + ')' : '');

  return {
    agree,
    oppose,
    dark,
    split,
    total,
    effectiveN,
    label,
    why,
    tier,
    blockers,
    timingVeto,
    headline,
    legacyScore: opts.legacyScore ?? null,
    rareNote: 'STRONG now requires 10 of 12 INDEPENDENT families, not 30 of 37 overlapping gates. Fewer STRONG reads is the fix working.',
  };
}

/** Decisive gate ids for render block (revisable after PATCH 6 measurement). */
export function hgDeepDecisiveIds() {
  return ['G27', 'STRUCT_RR', 'G11', 'G29', 'G30', 'G12', 'G13', 'G28', 'G37'];
}
