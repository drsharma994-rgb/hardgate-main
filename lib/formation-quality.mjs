/* HARDGATE — Formation Quality Score (FQS 0..100), pure and explainable. */
import { obbDeskMacroScore } from './openbb-desk-core.mjs';
import { ccxtFundingFormationBoost } from './ccxt-market-core.mjs';

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const FQS_WEIGHTS = {
  structure: 0.22,
  poi: 0.20,
  liquidity: 0.16,
  participation: 0.14,
  timing: 0.12,
  geometry: 0.10,
  macro: 0.06,
};

export const POI_GRADE = {
  'sweep-reclaim': 1.0,
  'avwap-session': 0.92,
  'avwap-swing': 0.88,
  fvg: 0.82,
  'order-block': 0.80,
  edge: 0.72,
  ote: 0.66,
  'range-mid': 0.42,
  ema21: 0.34,
  ema9: 0.24,
  none: 0.1,
};

function poiScore(cand) {
  const kind = String(cand.poiKind || 'none').toLowerCase();
  let base = POI_GRADE[kind] ?? 0.4;
  const taps = num(cand.poiTaps);
  if (taps !== null) base *= taps <= 0 ? 1 : taps === 1 ? 0.85 : 0.6;
  const age = num(cand.poiAgeBars);
  if (age !== null && age > 40) base *= 0.85;
  if (age !== null && age > 120) base *= 0.75;
  return clamp01(base);
}

function structureScore(cand) {
  let s = cand.htfAlign === true ? 0.8 : cand.htfAlign === false ? 0.2 : 0.5;
  if (cand.bos === true) s += 0.15;
  if (cand.chochAgainst === true) s -= 0.25;
  const adx = num(cand.adx);
  if (adx !== null) s += adx >= 22 ? 0.08 : adx < 14 ? -0.12 : 0;
  return clamp01(s);
}

function liquidityScore(cand) {
  let s = 0.4;
  if (cand.sweptLiquidity === true) s += 0.3;
  if (cand.imbalance === true) s += 0.15;
  if (cand.intoOpposingLiquidity === true) s -= 0.3;
  const conf = num(cand.confluence);
  if (conf !== null) s += Math.min(0.2, conf * 0.05);
  return clamp01(s);
}

function participationScore(cand) {
  const oi = String(cand.oiflowState || '').toUpperCase();
  const side = String(cand.side || 'long').toLowerCase();
  let s = 0.5;
  const bullOi = /NEW LONGS|SHORT COVERING/.test(oi);
  const bearOi = /NEW SHORTS|LONG FLUSH/.test(oi);
  if (side === 'long') s += bullOi ? 0.25 : bearOi ? -0.2 : 0;
  else s += bearOi ? 0.25 : bullOi ? -0.2 : 0;
  const rvol = num(cand.rvol);
  if (rvol !== null) s += rvol >= 1.5 ? 0.2 : rvol < 0.7 ? -0.2 : 0;
  const spread = num(cand.spreadBps);
  if (spread !== null && spread > 12) s -= 0.15;
  if (cand.ccxtLeg || cand.fundingRate != null){
    var leg = cand.ccxtLeg || { fundingRate: cand.fundingRate, fundingAnnualPct: cand.fundingAnnualPct };
    var fb = ccxtFundingFormationBoost(side, leg);
    s += fb / 100;
  }
  return clamp01(s);
}

function timingScore(cand) {
  const atr = num(cand.atrPct);
  let s = 0.5;
  if (atr !== null) {
    if (atr < 0.3) s -= 0.3;
    else if (atr <= 1.6) s += 0.2;
    else if (atr <= 3) s += 0.05;
    else s -= 0.2;
  }
  let h = num(cand.hour ?? cand.ts);
  if (h !== null && h > 24) h = new Date(h).getUTCHours();
  if (h !== null) s += h >= 7 && h < 17 ? 0.15 : h >= 0 && h < 5 ? -0.15 : 0;
  if (cand.eventBlackout === true) s -= 0.35;
  return clamp01(s);
}

function geometryScore(cand) {
  const rr = num(cand.rr);
  const stopAtr = num(cand.stopDistAtr);
  let s = 0.4;
  if (rr !== null) s += rr >= 3 ? 0.35 : rr >= 2 ? 0.25 : rr >= 1.5 ? 0.1 : -0.25;
  if (stopAtr !== null) {
    if (stopAtr < 0.4) s -= 0.25;
    else if (stopAtr <= 1.8) s += 0.2;
    else s -= 0.15;
  }
  return clamp01(s);
}

function macroScore(cand) {
  if (cand.desk || cand.riskOnScore != null) {
    return obbDeskMacroScore(cand, cand.desk || { riskOnScore: cand.riskOnScore, realRateHint: cand.realRateHint });
  }
  const hint = String(cand.realRateHint || '').toUpperCase();
  const side = String(cand.side || 'long').toLowerCase();
  if (!hint) return 0.5;
  const tail = hint.includes('TAILWIND');
  const head = hint.includes('HEADWIND');
  if (side === 'long') return tail ? 0.9 : head ? 0.2 : 0.5;
  return head ? 0.9 : tail ? 0.2 : 0.5;
}

export function formationQuality(cand = {}) {
  const pillars = {
    structure: structureScore(cand),
    poi: poiScore(cand),
    liquidity: liquidityScore(cand),
    participation: participationScore(cand),
    timing: timingScore(cand),
    geometry: geometryScore(cand),
    macro: macroScore(cand),
  };
  let total = 0;
  for (const k of Object.keys(FQS_WEIGHTS)) total += FQS_WEIGHTS[k] * pillars[k];
  let fqs = Math.round(total * 100);

  const notes = [];
  if (cand.chochAgainst === true) { fqs = Math.min(fqs, 45); notes.push('cap:choch-against'); }
  if (cand.eventBlackout === true) { fqs = Math.min(fqs, 40); notes.push('cap:event-blackout'); }
  if (pillars.geometry < 0.3) { fqs = Math.min(fqs, 50); notes.push('cap:bad-geometry'); }

  const weakest = Object.entries(pillars).sort((a, b) => a[1] - b[1])[0][0];
  return {
    fqs,
    grade: fqs >= 80 ? 'A' : fqs >= 70 ? 'B' : fqs >= 60 ? 'C' : fqs >= 50 ? 'D' : 'F',
    pillars: Object.fromEntries(Object.entries(pillars).map(([k, v]) => [k, Math.round(v * 100)])),
    weakest,
    notes,
  };
}

export const FQS_FLOOR = { gold: 62, silver: 64, btc: 62, eth: 64, alt: 70 };

export function fqsGate(cand, cls = 'alt', override) {
  const q = formationQuality(cand);
  const floor = Number.isFinite(Number(override)) ? Number(override) : (FQS_FLOOR[cls] ?? 68);
  return {
    ok: q.fqs >= floor,
    reason: q.fqs >= floor
      ? `fqs-ok(${q.fqs}/${floor},${q.grade})`
      : `fqs-low(${q.fqs}<${floor}, weakest=${q.weakest})`,
    quality: q,
    floor,
  };
}
