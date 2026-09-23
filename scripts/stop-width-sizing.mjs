#!/usr/bin/env node
/**
 * hg-v931 — stop width as a SIZE, not as a reject.
 *
 * hg-v922 judged twenty signal-time factors on four disjoint windows at both
 * fill bounds and found exactly one that separates outcomes: STOP WIDTH.
 * `stop >= 0.28%` and `>= 0.50%` held on GOLD SCALP at both bounds, `>= 0.50%`
 * on OMNIGOLD, and 69% of the scalp net gap was GROSS, so it is not hg-v919's
 * cost arithmetic restated. No threshold shipped, for a good reason: the
 * unanimity pattern ran 0.20 no · 0.24 no · 0.28 YES · 0.32 no · 0.40 no ·
 * 0.50 YES · 0.60 YES, which is the shape of a bar being searched for rather
 * than found.
 *
 * EVERY TEST SO FAR TREATED IT AS A REJECT. That is one of two things you can
 * do with a factor, and the other has never been measured: keep the trade and
 * SIZE IT by the factor. A reject throws away the trade's information along
 * with its risk; a weight keeps both. If the relationship is real and graded,
 * a ramp should beat a cliff, and both should beat flat.
 *
 * WHAT IS MEASURED. Each trade already risks exactly 1R by construction — R is
 * normalised to the stop — so "size" here is a WEIGHT w on account risk. The
 * portfolio figure is return per unit of risk actually deployed,
 *
 *     E = sum(w_i * R_i) / sum(w_i)
 *
 * which is the quantity a trader cares about and which flat weighting (every
 * w=1) reduces to the plain mean. A scheme that only helps by deploying less
 * risk is not an improvement, and this denominator is what stops it looking
 * like one.
 *
 * THE BAR. A scheme counts only if it beats flat in ALL FOUR disjoint windows
 * at BOTH fill bounds — the hg-v920 procedure that replaced nested splits, and
 * the hg-v918 rule that a verdict must not come from the conservative end
 * alone. Anything less is reported as directional and NOT acted on.
 *
 * Re-derive: node scripts/stop-width-sizing.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { splitDisjoint } from './disjoint-windows.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCALP_REPLAY = 'backtest-goldscalp-results-floor.json';
export const OG_REPLAY = 'backtest-omnigold-results.json';
export const WINDOWS = 4;
/* the same venue the rest of the gold evidence is quoted at */
export const XM_RT_PCT = 0.020;

function load(name){
  return JSON.parse(readFileSync(join(HERE, name), 'utf8'));
}

/** stop distance as a percentage of entry — the factor under test */
export function stopPct(t){
  const e = +t.entry, s = +t.stop;
  if (!isFinite(e) || !isFinite(s) || !(e > 0)) return NaN;
  return Math.abs(e - s) / e * 100;
}

/** cost in R at XM: rtCost / stopPct exactly, the hg-v919 identity */
export function costRxm(t){
  const sp = stopPct(t);
  return (isFinite(sp) && sp > 0) ? (XM_RT_PCT / sp) : NaN;
}

/**
 * One settled row reduced to { t, sp, gross, net }.
 * `end` picks the fill bound: 'lower' demotes an unprovable same-bar win to a
 * loss, 'upper' takes the walk as recorded. A both-touch bar is exactly that
 * ambiguity, which is why it is the row the bound moves.
 */
export function book(rows, end, grossKey){
  const out = [];
  for (const t of rows){
    if (!t) continue;
    const o = String(t.outcome || '');
    if (/unfilled/i.test(o)) continue;
    const sp = stopPct(t);
    if (!isFinite(sp) || !(sp > 0)) continue;
    let g = +t[grossKey];
    if (!isFinite(g)) continue;
    /* the conservative end also refuses to credit a same-bar win it cannot
       prove; the walk already resolves both-touch stop-first, so the bound
       that moves here is the optimistic one crediting it as a win */
    if (end === 'upper' && /both-touch/.test(o)) g = Math.abs(g);
    const c = costRxm(t);
    out.push({ iso: t.tISO || '', sp, gross: g, net: g - (isFinite(c) ? c : 0) });
  }
  out.sort((a, b) => String(a.iso).localeCompare(String(b.iso)));
  return out;
}

/* ---- the weighting schemes ------------------------------------------- */

/** every scheme is w(stopPct) -> weight in [0,1]; flat is the baseline */
export const SCHEMES = [
  { key: 'flat',      label: 'flat (every trade 1 unit)',        w: () => 1 },
  { key: 'cliff028',  label: 'REJECT below 0.28% (v922 bar)',    w: sp => (sp >= 0.28 ? 1 : 0) },
  { key: 'cliff050',  label: 'REJECT below 0.50% (v922 bar)',    w: sp => (sp >= 0.50 ? 1 : 0) },
  { key: 'ramp050',   label: 'RAMP 0.25->1 over 0..0.50%',       w: sp => Math.max(0.25, Math.min(1, sp / 0.50)) },
  { key: 'ramp028',   label: 'RAMP 0.25->1 over 0..0.28%',       w: sp => Math.max(0.25, Math.min(1, sp / 0.28)) },
  { key: 'halfTight', label: 'HALF SIZE below 0.28%',            w: sp => (sp >= 0.28 ? 1 : 0.5) },
  { key: 'sqrt050',   label: 'SQRT ramp over 0..0.50%',          w: sp => Math.max(0.25, Math.min(1, Math.sqrt(sp / 0.50))) }
];

/** return per unit of risk deployed — the denominator is the point */
export function expectancy(rows, w, key){
  let num = 0, den = 0, n = 0;
  for (const r of rows){
    const wt = w(r.sp);
    if (!(wt > 0)) continue;
    num += wt * r[key];
    den += wt;
    n++;
  }
  return { e: den > 0 ? num / den : NaN, risk: den, n };
}

/**
 * A scheme HOLDS only when it beats flat in every window, on gross AND net,
 * at both bounds. Reported with the count so a near-miss is visible rather
 * than rounded to a no.
 */
export function judge(rowsByEnd, scheme){
  const per = [];
  let wins = 0, total = 0;
  for (const end of ['lower', 'upper']){
    for (const win of splitDisjoint(rowsByEnd[end], WINDOWS)){
      for (const key of ['gross', 'net']){
        const a = expectancy(win, scheme.w, key);
        const b = expectancy(win, SCHEMES[0].w, key);
        const ok = isFinite(a.e) && isFinite(b.e) && a.e > b.e;
        total++; if (ok) wins++;
        per.push({ end, key, n: a.n, scheme: a.e, flat: b.e, delta: a.e - b.e, ok });
      }
    }
  }
  return { wins, total, unanimous: wins === total, per };
}

export function run(){
  const desks = [
    { name: 'GOLD SCALP', file: SCALP_REPLAY, grossKey: 'rGross' },
    { name: 'OMNIGOLD',   file: OG_REPLAY,    grossKey: 'rMultiple' }
  ];
  const report = {};
  for (const d of desks){
    const raw = load(d.file).trades;
    const rowsByEnd = { lower: book(raw, 'lower', d.grossKey), upper: book(raw, 'upper', d.grossKey) };
    const base = {};
    for (const end of ['lower', 'upper'])
      for (const key of ['gross', 'net'])
        base[end + ':' + key] = expectancy(rowsByEnd[end], SCHEMES[0].w, key);
    const rows = [];
    for (const s of SCHEMES.slice(1)){
      const v = judge(rowsByEnd, s);
      const whole = {};
      for (const end of ['lower', 'upper'])
        for (const key of ['gross', 'net'])
          whole[end + ':' + key] = expectancy(rowsByEnd[end], s.w, key);
      rows.push({ key: s.key, label: s.label, wins: v.wins, total: v.total,
                  unanimous: v.unanimous, whole, riskKept: whole['lower:net'].risk / base['lower:net'].risk });
    }
    report[d.name] = { n: rowsByEnd.lower.length, base, rows };
  }
  return report;
}

function fmt(x, d = 4){ return (x >= 0 ? '+' : '') + Number(x).toFixed(d); }

if (process.argv[1] && process.argv[1].endsWith('stop-width-sizing.mjs')){
  const rep = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(rep, null, 2)); }
  else {
    for (const desk of Object.keys(rep)){
      const r = rep[desk];
      console.log('\n=== ' + desk + ' — n=' + r.n + ' settled, ' + WINDOWS + ' disjoint windows x 2 fill bounds x gross+net = 16 tests ===');
      console.log('  flat baseline   lower gross ' + fmt(r.base['lower:gross'].e) + '  net ' + fmt(r.base['lower:net'].e)
                + '   |  upper gross ' + fmt(r.base['upper:gross'].e) + '  net ' + fmt(r.base['upper:net'].e));
      for (const row of r.rows){
        console.log('  ' + row.key.padEnd(10) + String(row.wins).padStart(3) + '/' + row.total
          + (row.unanimous ? '  HOLDS  ' : '         ')
          + ' lower net ' + fmt(row.whole['lower:net'].e)
          + '  upper net ' + fmt(row.whole['upper:net'].e)
          + '  risk kept ' + (100 * row.riskKept).toFixed(0) + '%'
          + '   ' + row.label);
      }
      const held = r.rows.filter(x => x.unanimous);
      console.log('  VERDICT: ' + (held.length ? held.map(x => x.key).join(', ') + ' hold' : 'NOTHING is unanimous — no sizing rule ships'));
    }
  }
}
