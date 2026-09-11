/* HARDGATE — GOLD ULTRA backtest harness (offline, node ESM).
   Run:  node scripts/backtest-goldultra.mjs [--smoke] [--bars=N] [--refresh]

   WHAT THIS REPLAYS
   -----------------
   goldultra.js's OWN engine, booted alone in a vm sandbox, per closed 15m
   bar, zero lookahead. The engine sees exactly the 320-bar 15m prefix and the
   closed 1h prefix the live tab would fetch, with now = the bar's close
   instant. Same file, same arithmetic — the VERIFIED panel prints what this
   code produced.

   HOW THE RULE IS CHOSEN, HONESTLY
   --------------------------------
   Every bar records the agreement (pct), decisive count and regime. The
   candidate rules are the grid minPct in {0.55..0.85} x regimeGate {on,off}.
   The IN-SAMPLE window (first 70% of bars) picks the rule with the best
   avg R net @XM at n >= 80; the OUT-OF-SAMPLE window (last 30%, never
   consulted for the choice) is what gets reported and baked. Every cohort's
   IS and OOS rows are written so the reader can see the whole grid, not the
   winner alone.

   OUTCOME RESOLUTION (lib semantics: lib/omnigold-xm-bot-backtest.mjs)
   ---------------------------------------------------------------------
   entry MARKET at the signal close -> fills on bar i+1 at the entry price
   (open gap ignored — stated); first touch stop vs t1 after the fill; both in
   one bar = LOSS; RULE.timeoutBars after the fill -> MTM at close. One live
   trade per (rule, dir) — a re-fire while a same-side trade lives is a
   re-confirmation, counted merged.

   COSTS: XM XAUUSD 0.020% RT primary, PAXG spot 0.26% RT sensitivity.
   DATA: PAXGUSDT Binance spot (shared scripts/.bt-cache — run harnesses
   SERIALLY, never concurrently with --refresh). */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : dflt; };
const SMOKE = has('--smoke'), REFRESH = has('--refresh');
const BARS_15M = +opt('--bars', SMOKE ? 900 : 6000);
const OUT_FILE = path.join(ROOT, 'scripts', SMOKE ? 'backtest-goldultra-smoke-results.json' : 'backtest-goldultra-results.json');
const SYMBOL = 'PAXGUSDT';
const WIN_15M = 320, WIN_1H = 400, MIN_15M = 230;
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100, COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);
const GRID_PCT = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85], GRID_GATE = [true, false];
const MIN_AVAIL = 25, IS_SHARE = 0.70, MIN_N_PICK = 80;
const IV_SEC = { '15m': 900, '1h': 3600 };

async function jget(url){ const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-goldultra-backtest/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url); return r.json(); }
async function fetchKlines(symbol, interval, target){
  const ivMs = IV_SEC[interval] * 1000; let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + lim;
    if (endTime) url += '&endTime=' + endTime;
    const batch = await jget(url); if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out); endTime = batch[0][0] - 1; if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out.filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })).sort((a, b) => a.t - b.t);
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  return rows;
}
async function cachedKlines(symbol, interval, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (!REFRESH && fs.existsSync(file)){
    try{ const j = JSON.parse(fs.readFileSync(file, 'utf8')); const ageH = (Date.now() - j.fetchedAt) / 3.6e6;
      if (j.rows && j.rows.length >= target && ageH < 96){ console.log('  cache hit ' + interval + ': ' + j.rows.length + ' bars (' + ageH.toFixed(1) + 'h old)'); return j.rows.slice(-target); } }catch(e){}
  }
  console.log('  fetching ' + symbol + ' ' + interval + ' x' + target + ' from Binance spot...');
  const rows = await fetchKlines(symbol, interval, target);
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, target, rows }));
  return rows;
}
function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8'), ctx, { filename: 'goldultra.js' });
  if (typeof ctx.goldUltraEngine !== 'function') throw new Error('boot failed: goldUltraEngine missing');
  return ctx;
}

/* ---------- 1. per-bar signal scan (engine run ONCE per bar, rules applied after) ---------- */
let READS = { total: 0, vote: 0 };
function scanBars(W, m15, h1){
  const sigs = []; let h1Ptr = 0; const t0 = Date.now();
  const RULE = W.HG_GOLD_ULTRA_RULE;
  for (let i = MIN_15M - 1; i < m15.length - 1; i++){
    const now = (m15[i].t + 900) * 1000;
    const rows15 = m15.slice(Math.max(0, i - WIN_15M + 1), i + 1);
    while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
    const rows1h = h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr);
    let r;
    try{ r = W.goldUltraEngine({ rows15m: rows15, rows1h, now, allowUnverified: true, venueCost: { venue: 'XM', rtFrac: COST_XM_FRAC },
                                 rule: { minPct: 0, minAvail: 0, regimeGate: false } }); }
    catch(e){ sigs.push({ i, err: String(e && e.message || e) }); continue; }
    if (r.count) READS = { total: r.count.total, vote: r.count.kinds.vote };
    if (!r.ok || !r.fire || !r.plan){ sigs.push({ i, ok: r.ok, pct: r.count ? r.count.pct : 0, decisive: r.count ? r.count.decisive : 0, regime: r.regime, gates: r.gates }); continue; }
    sigs.push({ i, ok: true, pct: r.count.pct, decisive: r.count.decisive, lead: r.count.lead, regime: r.regime, atr: r.atr,
                plan: { entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, stopAtr: r.plan.stopAtr } });
    if ((i - MIN_15M) % 500 === 0) console.log('  bar ' + i + '/' + m15.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  return sigs;
}

/* ---------- 2. trade walk per candidate rule ---------- */
function walkRule(sigs, m15, minPct, gate, timeoutBars){
  const live = { long: null, short: null }, trades = [], counters = { fired: 0, merged: 0 };
  const settle = (tr, exitIdx, outcome, rGross, bothTouch) => {
    const risk = Math.abs(tr.stop - tr.entry);
    tr.outcome = outcome; tr.exitIdx = exitIdx; tr.rGross = rGross; tr.bothTouch = !!bothTouch;
    tr.netR = rGross == null ? null : rGross - (tr.entry * COST_XM_FRAC) / risk;
    tr.netR_paxg = rGross == null ? null : rGross - (tr.entry * COST_PAXG_FRAC) / risk;
    tr.sameBarExit = tr.fillIdx != null && exitIdx === tr.fillIdx;
    trades.push(tr); live[tr.dir] = null;
  };
  for (let bi = MIN_15M; bi < m15.length; bi++){
    const bar = m15[bi];
    for (const dir of ['long', 'short']){
      const tr = live[dir]; if (!tr) continue;
      if (tr.state === 'pending'){
        if (ogXmBarTouchesEntry(tr.orderType, dir, bar, tr.entry)){ tr.state = 'filled'; tr.fillIdx = bi; }
        else { settle(tr, bi, 'unfilled', null); continue; }
      }
      const hitStop = dir === 'long' ? bar.l <= tr.stop : bar.h >= tr.stop;
      const hitT1 = dir === 'long' ? bar.h >= tr.t1 : bar.l <= tr.t1;
      if (hitStop && hitT1) settle(tr, bi, 'loss', -1, true);
      else if (hitStop) settle(tr, bi, 'loss', -1);
      else if (hitT1) settle(tr, bi, 'win', Math.abs(tr.t1 - tr.entry) / Math.abs(tr.stop - tr.entry));
      else if (bi - tr.fillIdx >= timeoutBars){ const risk = Math.abs(tr.stop - tr.entry), mv = dir === 'long' ? bar.c - tr.entry : tr.entry - bar.c; settle(tr, bi, 'timeout', mv / risk); }
    }
    const s = sigs[bi - (MIN_15M - 1)];
    if (!s || !s.plan) continue;
    if (s.pct < minPct || s.decisive < MIN_AVAIL) continue;
    if (gate && s.regime === 'chop') continue;
    counters.fired++;
    if (live[s.lead]){ counters.merged++; continue; }
    live[s.lead] = { dir: s.lead, sigIdx: bi, state: 'pending', fillIdx: null, entry: s.plan.entry, stop: s.plan.stop, t1: s.plan.t1,
                     orderType: s.lead === 'long' ? 'BUY' : 'SELL', pct: s.pct, decisive: s.decisive, regime: s.regime, stopAtr: s.plan.stopAtr,
                     utcHour: new Date(bar.t * 1000).getUTCHours() };
  }
  return { trades, counters };
}
function agg(trades){
  const settled = trades.filter(t => t.netR != null), wins = settled.filter(t => t.outcome === 'win').length, sum = k => settled.reduce((s, t) => s + t[k], 0);
  return { n: settled.length, unfilled: trades.filter(t => t.outcome === 'unfilled').length, winRate: settled.length ? +(wins / settled.length).toFixed(3) : null,
           avgR_gross: settled.length ? +(sum('rGross') / settled.length).toFixed(3) : null, avgR_net_xm: settled.length ? +(sum('netR') / settled.length).toFixed(3) : null,
           avgR_net_paxg: settled.length ? +(sum('netR_paxg') / settled.length).toFixed(3) : null, sumR_net_xm: +sum('netR').toFixed(2),
           bothTouch: settled.filter(t => t.bothTouch).length, timeouts: settled.filter(t => t.outcome === 'timeout').length };
}
function groupAgg(trades, keyFn){ const g = {}; for (const t of trades){ const k = keyFn(t); (g[k] = g[k] || []).push(t); } const out = {}; for (const k of Object.keys(g).sort()) out[k] = agg(g[k]); return out; }
const sessionOf = h => h < 7 ? 'ASIA(00-07)' : h < 12 ? 'LONDON(07-12)' : h < 17 ? 'NY-OVERLAP(12-17)' : 'NY-LATE(17-24)';

/* ---------- 3. main ---------- */
console.log('=== GOLD ULTRA backtest — ' + (SMOKE ? 'SMOKE' : 'FULL') + ' · ' + new Date().toISOString() + ' ===');
const m15 = await cachedKlines(SYMBOL, '15m', BARS_15M);
const h1 = await cachedKlines(SYMBOL, '1h', Math.ceil(BARS_15M / 4) + WIN_1H + 8);
const W = boot();
const RULE = W.HG_GOLD_ULTRA_RULE;
console.log('scanning ' + m15.length + ' x 15m bars (engine once per bar, ' + WIN_15M + '-bar prefix, 1h prefix closed-only)...');
const sigs = scanBars(W, m15, h1);
const errs = sigs.filter(s => s.err);
const withPlan = sigs.filter(s => s.plan);
console.log('  bars scanned ' + sigs.length + ' · engine errors ' + errs.length + ' · bars with a lead+plan ' + withPlan.length);
if (errs.length) console.log('  first error: ' + errs[0].err);
const splitIdx = Math.floor((MIN_15M - 1) + (m15.length - MIN_15M) * IS_SHARE);
const grid = [];
for (const gate of GRID_GATE) for (const minPct of GRID_PCT){
  const { trades, counters } = walkRule(sigs, m15, minPct, gate, RULE.timeoutBars);
  const ins = trades.filter(t => t.sigIdx < splitIdx), oos = trades.filter(t => t.sigIdx >= splitIdx);
  grid.push({ minPct, gate, counters, all: agg(trades), ins: agg(ins), oos: agg(oos), _trades: trades });
}
const eligible = grid.filter(g => g.ins.n >= MIN_N_PICK && g.ins.avgR_net_xm != null);
let chosen = null;
for (const g of eligible) if (!chosen || g.ins.avgR_net_xm > chosen.ins.avgR_net_xm || (g.ins.avgR_net_xm === chosen.ins.avgR_net_xm && g.minPct > chosen.minPct)) chosen = g;
const chosenNote = chosen ? 'best in-sample avg R net @XM at n>=' + MIN_N_PICK : 'NO rule reached n>=' + MIN_N_PICK + ' in-sample — nothing chosen, nothing baked';
let oosT = chosen ? chosen._trades.filter(t => t.sigIdx >= splitIdx) : [];
const cohorts = chosen ? {
  byDirection: groupAgg(oosT, t => t.dir),
  bySession: groupAgg(oosT, t => sessionOf(t.utcHour)),
  byPctBucket: groupAgg(oosT, t => t.pct >= 0.85 ? '>=85%' : t.pct >= 0.75 ? '75-85%' : '<75%'),
  byRegime: groupAgg(oosT, t => t.regime),
  byOutcome: groupAgg(oosT, t => t.outcome)
} : null;
const oosSettled = oosT.filter(t => t.netR != null), sameBarWins = oosSettled.filter(t => t.outcome === 'win' && t.sameBarExit).length;
const span = (a, b) => new Date(m15[a].t * 1000).toISOString().slice(0, 10) + ' .. ' + new Date(m15[b].t * 1000).toISOString().slice(0, 10);
const limitations = [
  'MARKET FILL AT THE SIGNAL CLOSE: the walk fills BUY/SELL on bar i+1 at the entry price (= the signal close), ignoring the i+1 open gap; PAXG 15m gaps are small but weekend proxy bars exist',
  'SAME-BAR FILL->TARGET OPTIMISM: ' + sameBarWins + ' of ' + oosSettled.filter(t => t.outcome === 'win').length + ' OOS wins settle on the fill bar (market fills, so OHLC cannot order open->stop->t1 within it); both-touch bars ARE losses (' + oosSettled.filter(t => t.bothTouch).length + ')',
  'PORTFOLIO STATS NOT ATTAINABLE: one live trade per side, unlimited overlap between sides; read per-trade expectancy only',
  'THE RULE WAS PICKED ON THE FIRST ' + Math.round(IS_SHARE * 100) + '% AND REPORTED ON THE LAST ' + Math.round((1 - IS_SHARE) * 100) + '%: one split, one regime of gold history — a different quarter can measure differently; the grid rows show how sensitive the choice is',
  'PAXGUSDT proxy for XAUUSD: basis ~0.1-0.5%, 24/7 weekend bars a broker never printed; the tab quotes broker XAUUSD at XM costs (primary) with PAXG costs as the sensitivity row',
  'the ' + READS.vote + ' directional reads (of ' + READS.total + ' fed) are heavily correlated (dozens are moving-average variants); agreement % is a count, not an independence-weighted probability — the backtest measures what the count is worth, nothing more'
];
const verdict = !chosen ? 'No rule reached the minimum in-sample sample; nothing is claimed.'
  : (chosen.oos.n < 50 ? 'Out-of-sample n=' + chosen.oos.n + ' is too thin to trust either way — fires are informational, not tickets.'
  : chosen.oos.avgR_net_xm > 0 ? 'Out-of-sample the rule paid +' + chosen.oos.avgR_net_xm.toFixed(3) + 'R per trade after XM costs on n=' + chosen.oos.n + ' (win ' + (100 * chosen.oos.winRate).toFixed(1) + '%) — a small, positive edge; at PAXG costs it reads ' + (chosen.oos.avgR_net_paxg >= 0 ? '+' : '') + chosen.oos.avgR_net_paxg.toFixed(3) + 'R. Size accordingly; it is not an ATM.'
  : 'Out-of-sample the rule did NOT pay after XM costs (' + chosen.oos.avgR_net_xm.toFixed(3) + 'R per trade on n=' + chosen.oos.n + ') — fires print for the record and are NOT tradable tickets.');
const tradable = !!(chosen && chosen.oos.n >= 50 && chosen.oos.avgR_net_xm > 0);
const evidence = chosen ? {
  generated: new Date().toISOString(), symbol: SYMBOL, bars: m15.length, mode: SMOKE ? 'smoke' : 'full',
  rule: { minPct: chosen.minPct, minAvail: MIN_AVAIL, regimeGate: chosen.gate, stopAtr: RULE.stopAtr, t1R: RULE.t1R, t2R: RULE.t2R, timeoutBars: RULE.timeoutBars, costFloorMult: RULE.costFloorMult },
  chosenBy: chosenNote, isShare: Math.round(IS_SHARE * 100) + '%', oosShare: Math.round((1 - IS_SHARE) * 100) + '%',
  isSpan: span(MIN_15M - 1, splitIdx - 1), oosSpan: span(splitIdx, m15.length - 1),
  ins: chosen.ins, oos: chosen.oos, tradable, verdict, limitations,
  rows: [].concat(
    Object.keys(cohorts.byDirection).map(k => ({ label: 'direction ' + k, ...cohorts.byDirection[k] })),
    Object.keys(cohorts.bySession).map(k => ({ label: 'session ' + k, ...cohorts.bySession[k] })),
    Object.keys(cohorts.byPctBucket).map(k => ({ label: 'agreement ' + k, ...cohorts.byPctBucket[k] })),
    Object.keys(cohorts.byRegime).map(k => ({ label: 'regime ' + k, ...cohorts.byRegime[k] })))
} : null;
const out = { meta: { generated: new Date().toISOString(), mode: SMOKE ? 'smoke' : 'full', symbol: SYMBOL, bars: { m15: m15.length, h1: h1.length },
                      span: span(0, m15.length - 1), window: { m15: WIN_15M, h1: WIN_1H }, costs: { xm: COST_XM_FRAC, paxg: COST_PAXG_FRAC },
                      grid: { minPct: GRID_PCT, regimeGate: GRID_GATE, minAvail: MIN_AVAIL, isShare: IS_SHARE, minNPick: MIN_N_PICK }, engineErrors: errs.length,
                      barsWithLead: withPlan.length, limitations },
              grid: grid.map(g => ({ minPct: g.minPct, regimeGate: g.gate, fired: g.counters.fired, merged: g.counters.merged, all: g.all, ins: g.ins, oos: g.oos })),
              chosen: chosen ? { minPct: chosen.minPct, regimeGate: chosen.gate, note: chosenNote } : null,
              oosCohorts: cohorts, evidence,
              trades: chosen ? chosen._trades.map(t => ({ tISO: new Date(m15[t.sigIdx].t * 1000).toISOString(), dir: t.dir, pct: +t.pct.toFixed(3), decisive: t.decisive, regime: t.regime,
                entry: +t.entry.toFixed(2), stop: +t.stop.toFixed(2), t1: +t.t1.toFixed(2), stopAtr: +t.stopAtr.toFixed(2), outcome: t.outcome + (t.bothTouch ? ' (both-touch)' : ''),
                rGross: t.rGross == null ? null : +t.rGross.toFixed(3), netR: t.netR == null ? null : +t.netR.toFixed(3), netR_paxg: t.netR_paxg == null ? null : +t.netR_paxg.toFixed(3),
                oos: t.sigIdx >= splitIdx, utcHour: t.utcHour })) : [] };
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
const rp = (v, w) => String(v === null || v === undefined ? '—' : v).padStart(w);
console.log('\n--- rule grid (IS = first ' + Math.round(IS_SHARE * 100) + '% · OOS = last ' + Math.round((1 - IS_SHARE) * 100) + '%) ---');
console.log('minPct gate  | IS n  win%  netXM  | OOS n  win%  netXM  netPAXG | fired merged');
for (const g of grid) console.log(rp((g.minPct * 100).toFixed(0) + '%', 6) + ' ' + rp(g.gate ? 'on' : 'off', 4) + '  | ' + rp(g.ins.n, 4) + ' ' + rp(g.ins.winRate == null ? '—' : (100 * g.ins.winRate).toFixed(0) + '%', 5) + ' ' + rp(g.ins.avgR_net_xm, 6)
  + '  | ' + rp(g.oos.n, 5) + ' ' + rp(g.oos.winRate == null ? '—' : (100 * g.oos.winRate).toFixed(0) + '%', 5) + ' ' + rp(g.oos.avgR_net_xm, 6) + ' ' + rp(g.oos.avgR_net_paxg, 8) + ' | ' + rp(g.counters.fired, 5) + ' ' + rp(g.counters.merged, 6) + (chosen === g ? '   <== chosen' : ''));
console.log('\nchosen: ' + (chosen ? (chosen.minPct * 100) + '% · gate ' + (chosen.gate ? 'on' : 'off') + ' · ' + chosenNote : chosenNote));
if (cohorts){ for (const k of Object.keys(cohorts)){ console.log('\n--- OOS ' + k + ' ---'); for (const g of Object.keys(cohorts[k])){ const a = cohorts[k][g]; console.log(rp(g, 20) + '  n ' + rp(a.n, 4) + '  win ' + rp(a.winRate == null ? '—' : (100 * a.winRate).toFixed(0) + '%', 5) + '  netXM ' + rp(a.avgR_net_xm, 7) + '  netPAXG ' + rp(a.avgR_net_paxg, 7)); } } }
console.log('\nVERDICT: ' + verdict + (tradable ? '  [tradable]' : '  [NOT tradable]'));
console.log('\nSTATED LIMITATIONS:'); for (const l of limitations) console.log('  * ' + l);
console.log('\nwritten: ' + OUT_FILE);
