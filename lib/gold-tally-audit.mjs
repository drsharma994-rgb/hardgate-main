/* HARDGATE — measured gold tally leg audit (fix pack 15). */

import { relGateLift, relGateIC } from './reliability.mjs';

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
