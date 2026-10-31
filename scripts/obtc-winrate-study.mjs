#!/usr/bin/env node
/* scripts/obtc-winrate-study.mjs — the OMNIBTC variation study (research harness).
 *
 * Uses the desk's OWN exported replay walk (backtest-omnibtc.mjs: buildContext,
 * walkOne, settlePlan — the exact hgObtc gate chain on a minimal SWING-shaped
 * BTCUSDT 4h candidate, filled at the next open, settle via the forward-ledger
 * rules). Walks TWO real windows of BTCUSDT 4h:
 *   window 1 (newest ~5000 bars) = in-sample, split into two halves H1/H2;
 *   window 2 (older ~5000 bars)  = out-of-sample, never studied.
 *
 * VARIATION GRID, all measured on the walked rows:
 *   A. TARGET R in {1.25, 1.5, 2, 2.5, 3}: re-settle each candidate plan at
 *      that R multiple (win rate falls as R rises — the structural lever).
 *   B. TICKET PREDICATES on the walked gate fields: baseline clean-tier vs
 *      clean AND pineFamilies>=1/>=2, clean AND indAgree>=1, clean AND
 *      (families+ind)>=2/>=3, LONG-only, SHORT-only, clean AND !pineRefused.
 *      Win rate AND net R must BOTH be non-negative on netR, in BOTH halves,
 *      to be a candidate; then confirmed out-of-sample.
 *
 * A filter is only a recommendation when it improves win rate AND keeps net R
 * positive in both halves, and then survives window 2. Reported honestly.
 *
 * Run: node scripts/obtc-winrate-study.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { klinesUrl } from '../lib/klines-source.mjs';
import { buildContext, walkOne, settlePlan, summarise, MIN_4H, SYMBOL, INTERVAL_4H, fetchKlines, CACHE_DIR, WIN_4H } from './backtest-omnibtc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SEC4 = 14400;

function jget(url){ return fetch(url).then(r => r.json()); }
async function jgot(url, tries = 4){
  for (let i = 0; i < tries; i++){
    try { const j = await jget(url); if (Array.isArray(j) && j.length) return j; } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('fetch failed after ' + tries + ' tries: ' + url);
}

async function fetchOlderWindow(target, startEndMs){
  /* a second window strictly OLDER than the live one (starts at startEndMs) */
  const out = []; let endTime = startEndMs;
  while (out.length < target){
    const want = Math.min(1000, target - out.length);
    const { url } = klinesUrl({ symbol: SYMBOL, interval: INTERVAL_4H, limit: want, endTime }, process.env);
    const raw = await jgot(url);
    if (!Array.isArray(raw) || !raw.length) break;
    const rows = raw.map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    out.unshift(...rows);
    endTime = (rows[0] && rows[0].t * 1000) - SEC4 * 1000;
    if (raw.length < 1000) break;
  }
  return out;
}

function settleRows(bars, rows, targetR){
  /* re-settle each row's plan at targetR (the desk's t1 is overwritten by entry
     +/- k*risk; fill + horizon are the forward-ledger rules). Returns the same
     row list with `outR` (net R at this R) and `status`. */
  const n = rows.length;
  for (let i = 0; i < n; i++){
    const r = rows[i];
    if (r.skipped || !r || !r.plan) { r.outR = NaN; continue; }
    const risk = r.plan.risk;
    const t1 = r.dir === 'long' ? r.plan.entry + targetR * risk : r.plan.entry - targetR * risk;
    const st = settlePlan(bars, r.idx, { dir: r.dir, entry: r.plan.entry, stop: r.plan.stop, t1, risk });
    r.outR = (st && st.status === 'no-fill') ? NaN : (st ? st.netR : NaN);
    r.statusR = st && st.status;
  }
  return rows;
}

function planFromRow(r){
  const risk = Math.abs(r.entry - r.stop);
  if (!(risk > 0)) return null;
  return { entry: r.entry, stop: r.stop, risk };
}

/* re-walk a window, carrying per-row gate fields + the plan + original settle */
function walkWindow(bars){
  const ctx = buildContext();
  const rows = [];
  for (let idx = MIN_4H; idx < bars.length - 1; idx++){
    try {
      const w = walkOne(ctx, bars, idx);
      if (w.skipped){ rows.push({ idx, skipped: true, reason: w.reason }); continue; }
      const plan = planFromRow(w);
      w.plan = plan;                 // plan needed for re-settle at other R
      w.outR = w.outcome ? w.outcome.netR : NaN; // the desk's 2R settle
      w.outStatus = w.outcome && w.outcome.status;
      rows.push(w);
    } catch (e){ rows.push({ idx, skipped: true, reason: 'err:' + (e && e.message || '').slice(0, 40) }); }
  }
  return rows;
}

function agg(sel){
  const kept = sel.filter(r => !r.skipped && isFinite(r.outR));
  if (!kept.length) return { n: 0, win: null, netR: null };
  const wins = kept.filter(r => r.statusR === 't1').length;
  const netR = kept.reduce((a, r) => a + r.outR, 0) / kept.length;
  return { n: kept.length, win: 100 * wins / kept.length, netR: netR };
}

const fmt = a => a.n ? `n=${String(a.n).padStart(4)} win=${a.win.toFixed(1).padStart(5)}% net=${a.netR >= 0 ? '+' : ''}${a.netR.toFixed(4)}R` : 'n=0';

/* ---------- predicates on the walked rows ---------- */
function applyPred(rows, pred){
  return rows.map(r => ({ ...r, __sel: !r.skipped && pred(r) }));
}

const BASELINE = () => ({ n: 0, win: null, netR: null, label: 'BASELINE clean-tier 2R' });
const label = (name, R) => `${name} @ ${R}R`;

async function main(){
  /* in-sample window (newest) */
  console.log('fetching window 1 (newest 5000 bars)…');
  const bars1 = await fetchKlines(SYMBOL, INTERVAL_4H, 5000, jgot);
  if (bars1.length < MIN_4H) { console.log('window1 short'); return; }
  const rows1 = walkWindow(bars1);
  console.log('window1 walked:', rows1.length, 'rows,', bars1.length, 'bars; oldest', new Date(bars1[0].t * 1000).toISOString(), '->', new Date(bars1[bars1.length - 1].t * 1000).toISOString());

  /* out-of-sample window (older, before window 1) */
  const startEnd = bars1[0].t * 1000 - SEC4 * 1000;
  console.log('fetching window 2 (older 5000 bars)…');
  const bars2 = await fetchOlderWindow(5000, startEnd);
  const rows2 = walkWindow(bars2);
  console.log('window2 walked:', rows2.length, 'rows; oldest', new Date(bars2[0].t * 1000).toISOString(), '->', new Date(bars2[bars2.length - 1].t * 1000).toISOString());

  /* time midpoint of window 1 for H1/H2 */
  const midT = bars1[Math.floor(bars1.length / 2)].t;
  const h1 = rows1.filter(r => !r.skipped && r.t < midT);
  const h2 = rows1.filter(r => !r.skipped && r.t >= midT);

  const RES = [];
  const record = (name, targetR, all, a, b, oos) => {
    RES.push({ name, targetR, ...agg(all), h1: agg(a).win, h1net: agg(a).netR, h2: agg(b).win, h2net: agg(b).netR, oos: agg(oos).win, oosnet: agg(oos).netR });
  };

  const RS = [1.25, 1.5, 2, 2.5, 3];
  const PREDS = {
    'clean-tier': r => r.ticket === true,
    'clean+fam>=1': r => r.ticket === true && r.pineFamilies && r.pineFamilies.length >= 1,
    'clean+fam>=2': r => r.ticket === true && r.pineFamilies && r.pineFamilies.length >= 2,
    'clean+ind>=1': r => r.ticket === true && r.indAgree && r.indAgree.length >= 1,
    'clean+fi>=2': r => r.ticket === true && (((r.pineFamilies||[]).length) + ((r.indAgree||[]).length)) >= 2,
    'clean+fi>=3': r => r.ticket === true && (((r.pineFamilies||[]).length) + ((r.indAgree||[]).length)) >= 3,
    'clean+LONG': r => r.ticket === true && r.dir === 'long',
    'clean+SHORT': r => r.ticket === true && r.dir === 'short',
    'ALL+LONG': r => r.dir === 'long',
    'ALL+SHORT': r => r.dir === 'short'
  };

  /* settle a full row-set at targetR, then apply a predicate */
  function atR(rowsFull, targetR){
    // settle uses plan.risk; clone rows so we don't share mutations
    const rs = rowsFull.map(r => r.skipped ? { ...r } : { ...r, plan: r.plan });
    settleRows(bars1, rs.filter(q => !q.skipped), targetR);
    return rs;
  }

  /* Build per-R row sets once, then slice by predicate for both windows.
     Window2 uses its own bars for settle. */
  for (const targetR of RS){
    const r1 = atR(rows1, targetR);
    // window 2 settle with bars2
    const r2 = rows2.map(r => r.skipped ? { ...r } : { ...r, plan: planFromRow(r) });
    settleRows(bars2, r2.filter(q => !q.skipped), targetR);
    // apply every predicate on both windows
    for (const [pname, pred] of Object.entries(PREDS)){
      const all = r1.filter(r => !r.skipped && pred(r));
      const a = all.filter(r => r.t < midT);
      const b = all.filter(r => r.t >= midT);
      const oos = r2.filter(r => !r.skipped && pred(r));
      record(pname, targetR, all, a, b, oos);
    }
  }

  /* ranked report, best netR in-sample with BOTH halves positive */
  const scored = RES.map(r => {
    const bothHalves = r.h1net >= 0 && r.h2net >= 0;
    const oosOK = r.oosnet >= 0;
    return { ...r, score: (r.h1net >= 0 && r.h2net >= 0 && r.h1 > 0 && r.h2 > 0) ? (r.netR || 0) : -1e9, bothHalves, oosOK };
  }).sort((a, b) => b.score - a.score);

  console.log('\n=== ranked (in-sample netR, both halves positive to score) ===');
  for (const r of scored.slice(0, 20)){
    console.log(
      r.name.padEnd(16), String(r.targetR).padEnd(5) + 'R',
      '|', fmt({ n: r.n, win: r.win, netR: r.netR }),
      '| H1 %', r.h1.toFixed(1), 'net', (r.h1net >= 0 ? '+' : '') + r.h1net.toFixed(3),
      '| H2 %', r.h2.toFixed(1), 'net', (r.h2net >= 0 ? '+' : '') + r.h2net.toFixed(3),
      '| OOS %', (r.oos || 0).toFixed(1), 'net', (r.oosnet >= 0 ? '+' : '') + (r.oosnet || 0).toFixed(3),
      r.bothHalves ? '★BOTH' : '', r.oosOK ? '★OOS' : '');
  }

  /* the finalists: both halves positive AND OOS positive */
  const finalists = scored.filter(r => r.bothHalves && r.oosOK);
  console.log('\n=== CONFIRMED (win-rate + net-R positive in H1, H2 AND OOS) ===');
  if (!finalists.length) console.log('none — no configuration cleared in-sample AND out-of-sample (the honest result).');
  else for (const r of finalists.slice(0, 10)){
    console.log(r.name.padEnd(16), String(r.targetR).padEnd(5) + 'R', '| win', r.win.toFixed(1) + '%', '| netR', (r.netR >= 0 ? '+' : '') + r.netR.toFixed(4), '| OOS net', (r.oosnet >= 0 ? '+' : '') + r.oosnet.toFixed(4), '| n', r.n, '| oos n', r.oosn || '');
  }
}

main().catch(e => { console.error('study failed:', e && e.message || e); process.exit(1); });
