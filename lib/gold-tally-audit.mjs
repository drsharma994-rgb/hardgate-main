/* HARDGATE — measured gold tally leg audit (fix pack 15 + deep gate extension pack 16). */

import { relGateLift, relGateIC } from './reliability.mjs';
import { hgEffectiveN } from './sample-uniqueness.mjs';
import { HG_DEEP_GATE_META, HG_DEEP_FAMILY_ORDER, HG_DEEP_FAMILY_LABELS } from './gate-families.mjs';

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function settled(records) {
  return (Array.isArray(records) ? records : []).filter(
    (r) => r && r.status === 'settled' && num(r.r) !== null
  );
}

function withLeg(records, legKey, present) {
  const key = String(legKey || '').toLowerCase();
  return settled(records).filter((r) => {
    const parts = Array.isArray(r.tallyParts) ? r.tallyParts : [];
    const has = parts.some((p) => String(p.leg || p.label || '').toLowerCase().includes(key));
    return present ? has : !has;
  });
}

function avgR(records) {
  const list = settled(records);
  if (!list.length) return null;
  let sum = 0;
  for (let i = 0; i < list.length; i++) sum += list[i].r;
  return sum / list.length;
}

/**
 * Audit tally legs from gold ledger records stamped with tallyParts[].
 * Falls back to relGateLift on layer tags when tallyParts absent.
 */
export function hgTallyLegAudit(records, legDefs = []) {
  const defs = legDefs.length ? legDefs : [
    { leg: 'killzone', match: 'killzone' },
    { leg: 'news', match: 'news' },
    { leg: 'macro', match: 'macro' },
    { leg: 'paxg', match: 'paxg' },
    { leg: 'seasonality', match: 'seasonal' },
    { leg: 'crypto fng', match: 'fear' },
    { leg: 'reads', match: 'agreeing read' },
  ];

  const out = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const withRecs = withLeg(records, def.match, true);
    const withoutRecs = withLeg(records, def.match, false);
    const nWith = withRecs.length;
    const nWithout = withoutRecs.length;
    const avgWith = avgR(withRecs);
    const avgWithout = avgR(withoutRecs);
    const liftR = (avgWith !== null && avgWithout !== null) ? avgWith - avgWithout : null;

    let verdict = 'UNPROVEN';
    if (nWith >= 12 && liftR !== null) {
      if (liftR >= 0.15) verdict = 'CARRIES';
      else if (liftR <= -0.05) verdict = 'NOISE';
      else verdict = 'NEUTRAL';
    } else if (nWith >= 8 && liftR !== null && liftR <= -0.04) {
      verdict = 'NOISE';
    }

    out.push({
      leg: def.leg,
      nWith,
      nWithout,
      liftR: liftR !== null ? Math.round(liftR * 1000) / 1000 : null,
      ic: null,
      verdict,
    });
  }

  if (!out.some((r) => r.nWith > 0)) {
    const lift = relGateLift(records);
    for (let j = 0; j < lift.length; j++) {
      out.push({
        leg: lift[j].layer,
        nWith: lift[j].nWith,
        nWithout: lift[j].nWithout,
        liftR: lift[j].liftR,
        ic: null,
        verdict: lift[j].verdict === 'DRAG' ? 'NOISE' : lift[j].verdict,
      });
    }
  }

  const ic = relGateIC(records);
  for (let k = 0; k < out.length; k++) {
    const row = out[k];
    const icRow = ic.find((x) => String(x.layer || '').toLowerCase() === String(row.leg).toLowerCase());
    if (icRow) row.ic = icRow.ic;
    if (icRow && Math.abs(icRow.tStat || 0) < 2 && row.verdict !== 'CARRIES') row.verdict = 'NOISE';
  }

  return out;
}

export function hgTallyLegCarries(audit, leg) {
  const row = (Array.isArray(audit) ? audit : []).find((r) => r.leg === leg);
  return row && row.verdict === 'CARRIES';
}

export function hgTallyExcludedLegs(audit) {
  return (Array.isArray(audit) ? audit : []).filter((r) => r.verdict === 'NOISE' || r.verdict === 'UNPROVEN').map((r) => r.leg);
}

function gatePassRecords(records, gateId, pass) {
  return settled(records).filter((r) => {
    const gs = r.gateStates || r.deepGates || null;
    if (!gs) return false;
    const st = gs[gateId];
    if (st === 'na' || st === undefined) return false;
    return pass ? st === 'pass' : st !== 'pass';
  });
}

function liftVerdict(nWith, liftR) {
  if (nWith < 8 || liftR === null) return 'UNPROVEN';
  if (nWith >= 12 && liftR >= 0.15) return 'CARRIES';
  if (liftR <= -0.05) return 'NOISE';
  if (nWith >= 8 && liftR <= -0.04) return 'NOISE';
  return 'NEUTRAL';
}

/**
 * Per-gate measured lift from records stamped with gateStates / deepGates.
 */
export function hgDeepGateAudit(records) {
  const ids = Object.keys(HG_DEEP_GATE_META);
  const effN = hgEffectiveN(settled(records));
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const withRecs = gatePassRecords(records, id, true);
    const withoutRecs = gatePassRecords(records, id, false);
    const nWith = withRecs.length;
    const nWithout = withoutRecs.length;
    const avgWith = avgR(withRecs);
    const avgWithout = avgR(withoutRecs);
    const liftR = (avgWith !== null && avgWithout !== null) ? avgWith - avgWithout : null;
    out.push({
      gate: id,
      label: HG_DEEP_GATE_META[id].label,
      family: HG_DEEP_GATE_META[id].family,
      nWith,
      nWithout,
      effectiveN: effN,
      liftR: liftR !== null ? Math.round(liftR * 1000) / 1000 : null,
      verdict: liftVerdict(nWith, liftR),
      primary: false,
    });
  }
  return out;
}

/**
 * Family-level lift is primary; per-gate lift is diagnostic only.
 */
export function hgDeepFamilyAudit(records) {
  const gateAudit = hgDeepGateAudit(records);
  const effN = hgEffectiveN(settled(records));
  const byFam = {};
  for (let i = 0; i < gateAudit.length; i++) {
    const g = gateAudit[i];
    if (!byFam[g.family]) byFam[g.family] = { lifts: [], nWith: 0, nWithout: 0 };
    if (g.liftR !== null) byFam[g.family].lifts.push(g.liftR);
    byFam[g.family].nWith += g.nWith;
  }
  const out = [];
  for (let j = 0; j < HG_DEEP_FAMILY_ORDER.length; j++) {
    const fam = HG_DEEP_FAMILY_ORDER[j];
    const bucket = byFam[fam];
    if (!bucket) continue;
    const avgLift = bucket.lifts.length
      ? bucket.lifts.reduce((a, b) => a + b, 0) / bucket.lifts.length
      : null;
    out.push({
      family: fam,
      label: HG_DEEP_FAMILY_LABELS[fam] || fam,
      liftR: avgLift !== null ? Math.round(avgLift * 1000) / 1000 : null,
      nWith: bucket.nWith,
      effectiveN: effN,
      verdict: liftVerdict(bucket.nWith, avgLift),
      primary: true,
      gates: gateAudit.filter((g) => g.family === fam),
    });
  }
  return { familyAudit: out, gateAudit };
}

export function hgDeepGateAuditLine(row) {
  if (!row) return '';
  const lift = row.liftR !== null ? ((row.liftR >= 0 ? '+' : '') + row.liftR.toFixed(2) + 'R') : 'n/a';
  const n = row.nWith || 0;
  const eff = row.effectiveN != null ? ' · eff n ' + row.effectiveN : '';
  return '[measured: ' + lift + ' over ' + n + ' samples · eff n ' + (row.effectiveN ?? '—') + ' — ' + row.verdict + ']' + eff;
}
