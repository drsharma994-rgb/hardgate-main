#!/usr/bin/env node
/* HARDGATE — TREND MATRIX win-rate lab (offline, node ESM).
   Run:  node scripts/trendmx-winrate-lab.mjs [--rebuild] [--passes=N]

   WHAT THIS IS: an add/remove simulation over the desk's OWN replay. Phase A
   walks every closed 4h bar of every symbol and, for BOTH directions, runs
   the desk's own gate / plan / witness chain (the same functions
   scripts/backtest-trendmx.mjs boots, the same fill + settle rules, the same
   0.20% round-trip cost, stop-first on a both-touch bar). Phase B re-settles
   every candidate under a grid of stop/target geometries. Phase C is the
   simulation loop: starting from the desk's shipped configuration it greedily
   adds and removes indicators (composite legs, momentum/volume/chop/candle
   witnesses, session, gate floor, mechanics, geometry), scoring every
   configuration on three disjoint SEARCH windows and keeping a move only
   when it clears the bar below. The loop runs until no move improves (or
   --passes). Phase D confirms the finalists on a fourth HELD-OUT window the
   search never saw.

   THE BAR (mathematically honest, the hg-v922 shape): a move must (1) not
   lower the win rate in ANY of the three search windows, (2) keep at least
   15 settled positions in each, (3) not lower aggregate net R vs the current
   config, and only then ranks on search win rate. Confirmation demands the
   held-out window's win rate AND net R are both at least the baseline's.
   Two-proportion z-test reported; the number of configurations evaluated is
   printed because a search this wide needs its multiple-comparison discount
   said out loud.

   WHAT IT CANNOT SIMULATE, SAID: the taker-flow witness, the fundamental +
   sentiment witness and the SWING post-gate rule read live feeds no bar
   archive carries (forward-only, never guessed); funding is not modelled
   (spot bars stand in for perps); the BTC-structure macro is unset. No
   configuration here can "discover" an edge in those three reads — the
   forward ledger is still their only judge. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boot, cachedKlines, buildRow, DEFAULT_SYMBOLS, MIN_4H, WIN_1D,
  HORIZON_BARS, TM_LIMIT_LIFE, COST_FRAC, CACHE_DIR
} from './backtest-trendmx.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB_CACHE = path.join(CACHE_DIR, 'trendmx-lab-records.json');
const LAB_OUT = path.join(HERE, 'trendmx-winrate-lab-results.json');
const SEC4 = 14400;
const LEG_NAMES = ['d1Trend', 'd1Cross', 'h4Cascade', 'cloud', 'adxPt'];

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };

/* geometry grid: g0 = the plan's own levels (baseline); the rest scale the
   stop and the T1 multiple around the plan entry, in plan-risk units. */
const GEOMS = [{ s: 1, k: null, label: 'plan' }];
for (const s of [0.75, 1, 1.25]) for (const k of [1.5, 2, 2.5, 3]) GEOMS.push({ s, k, label: 'stop' + s + 'x t1 ' + k + 'R' });

/* ---------- Phase A: per (bar, dir) the desk's own verdict ---------- */
function heavyOf(W, rec, dir){
  const row = rec.row;
  const gate = W.trendmxGateEval(row, dir);
  if (!gate) return { skip: 'noGate' };
  if (gate.veto) return { skip: 'gateVeto' };
  const plan = W.trendmxPlan(Object.assign({}, row, { dir }));
  if (!W.tmValidSetup(plan)) return { skip: 'noPlan' };
  const chop = W.trendmxChopState(row);
  const candle = W.tmCandleMarks(row, dir);
  const h = {
    isClean: !!gate.clean7, gatesPassed: +gate.gatesPassed || 0,
    entry: +plan.entry, stop: +plan.stop, t1: +plan.t1,
    mark: isFinite(+plan.mark) ? +plan.mark : +row.price,
    entryType: plan.entryType || (Math.abs(+plan.entry - +row.price) / +row.price < 5e-4 ? 'MARKET' : 'LIMIT'),
    mom: W.trendmxMomState(row, dir), vol: W.trendmxVolState(row, dir),
    chop: chop.state === 'chop',
    perfect: !!W.trendmxPerfectState(row),
    candleAgainst: (dir === 'long' && candle['pattern:bearMajority'] === true) || (dir === 'short' && candle['pattern:bullMajority'] === true),
    reads: W.tmRecordReads(row, dir) || {}
  };
  if (!(isFinite(h.entry) && isFinite(h.stop) && isFinite(h.t1) && Math.abs(h.entry - h.stop) > 0)) return { skip: 'unpriced' };
  return h;
}

async function phaseA(W, symbols, bars, log){
  const out = {};
  for (const sym of symbols){
    const h4 = await cachedKlines(sym, '4h', bars, { log });
    const d1 = await cachedKlines(sym, '1d', Math.ceil(bars / 6) + WIN_1D, { log });
    const recs = [];
    for (let i = MIN_4H - 1; i < h4.length - 1; i++){
      const row = buildRow(W, sym, h4, d1, i);
      if (!row) continue;
      row.candleReads = W.tmCandleRead(row.rows4h);
      const c = row.comps || {};
      const rec = {
        i, t: h4[i].t + SEC4, legs: LEG_NAMES.map(k => (c[k] === 1 ? 1 : (c[k] === -1 ? -1 : 0))),
        score: +row.score || 0, freshCross: row.freshCross || null,
        rsiDivLong: c.rsiDivLong === 1, rsiDivShort: c.rsiDivShort === 1,
        volDivLong: c.volDivLong === 1, volDivShort: c.volDivShort === 1,
        heavy: {}, row
      };
      /* lazy: a direction can only ever be selected if at least two legs point that way */
      const up = rec.legs.filter(x => x === 1).length, dn = rec.legs.filter(x => x === -1).length;
      if (up >= 2) rec.heavy.long = heavyOf(W, rec, 'long');
      if (dn >= 2) rec.heavy.short = heavyOf(W, rec, 'short');
      recs.push(rec);
    }
    out[sym] = { h4, recs };
    log('  ' + sym + ': ' + recs.length + ' bars walked');
  }
  return out;
}

/* ---------- Phase B: settle one candidate under one geometry ---------- */
function settleOne(h4, sigIdx, h, geom){
  const sgn = h.dir === 'long' ? 1 : -1;
  const risk0 = Math.abs(h.entry - h.stop);
  const stop = h.entry - sgn * geom.s * risk0;
  const t1 = geom.k == null ? h.t1 : h.entry + sgn * geom.k * risk0;
  const risk = geom.s * risk0;
  let fillIdx = null, fillPx = null;
  for (let bi = sigIdx + 1; bi < h4.length; bi++){
    const bar = h4[bi];
    if (fillIdx == null){
      if (h.entryType === 'MARKET'){ fillIdx = bi; fillPx = bar.o; }
      else {
        const touched = h.dir === 'long' ? bar.l <= h.entry : bar.h >= h.entry;
        if (touched){ fillIdx = bi; fillPx = h.entry; }
        else if (bi - sigIdx >= TM_LIMIT_LIFE) return { outcome: 'unfilled', liveUntil: sigIdx + TM_LIMIT_LIFE - 1 };
        else continue;
      }
    }
    const rOf = px => sgn * (px - fillPx) / risk;
    const hitStop = h.dir === 'long' ? bar.l <= stop : bar.h >= stop;
    const hitT1 = h.dir === 'long' ? bar.h >= t1 : bar.l <= t1;
    const costR = (h.entry * COST_FRAC) / risk;
    if (hitStop && hitT1) return { outcome: 'stop', r: rOf(stop), net: rOf(stop) - costR, bothTouch: true, liveUntil: bi - 1 };
    if (hitStop) return { outcome: 'stop', r: rOf(stop), net: rOf(stop) - costR, bothTouch: false, liveUntil: bi - 1 };
    if (hitT1) return { outcome: 'target', r: rOf(t1), net: rOf(t1) - costR, bothTouch: false, liveUntil: bi - 1 };
    if (bi - fillIdx >= HORIZON_BARS) return { outcome: 'timeout', r: rOf(bar.c), net: rOf(bar.c) - costR, bothTouch: false, liveUntil: bi - 1 };
  }
  return { outcome: 'unfilled', liveUntil: h4.length };   /* tape ran out — excluded, blocks nothing real */
}

/* ---------- the configuration space ---------- */
function baseConfig(){
  return {
    legs: [1, 1, 1, 1, 1], majority: 2, allowClean: true, allowConv: true, minGates: 0,
    skipMomAgainst: false, skipVolAgainst: false, skipChop: false, skipRsiDiv: false,
    skipVolDiv: false, skipCandleAgainst: false, perfectOnly: false, freshAlign: false,
    score5Only: false, adxWith: false, tqWith: false, volWithReq: false, momWithReq: false,
    cascadeWithReq: false, session: null, geom: 0
  };
}
function subsetScore(rec, legs){
  let s = 0;
  for (let j = 0; j < 5; j++) if (legs[j]) s += rec.legs[j];
  return s;
}
function sessionOk(cfg, t){
  if (!cfg.session) return true;
  const hr = new Date(t * 1000).getUTCHours();
  if (cfg.session === 'OVERLAP') return hr >= 13 && hr < 17;
  if (cfg.session === 'LDN_OVL') return hr >= 8 && hr < 17;
  return true;
}
function selected(cfg, rec, dir, h){
  if (h.skip) return false;
  const s = subsetScore(rec, cfg.legs);
  if (dir === 'long' ? s < cfg.majority : -s < cfg.majority) return false;
  const cleanOk = cfg.allowClean && h.isClean;
  const convOk = cfg.allowConv && Math.abs(s) >= 2;
  if (!cleanOk && !convOk) return false;
  if (h.gatesPassed < cfg.minGates) return false;
  if (cfg.skipMomAgainst && h.mom === 'against') return false;
  if (cfg.skipVolAgainst && h.vol === 'against') return false;
  if (cfg.skipChop && h.chop) return false;
  if (cfg.skipRsiDiv && (dir === 'long' ? rec.rsiDivShort : rec.rsiDivLong)) return false;
  if (cfg.skipVolDiv && (dir === 'long' ? rec.volDivShort : rec.volDivLong)) return false;
  if (cfg.skipCandleAgainst && h.candleAgainst) return false;
  if (cfg.perfectOnly && !h.perfect) return false;
  if (cfg.freshAlign && rec.freshCross !== (dir === 'long' ? 'GOLDEN' : 'DEATH')) return false;
  if (cfg.score5Only && Math.abs(rec.score) !== 5) return false;
  if (cfg.adxWith && h.reads['tm:adx'] !== true) return false;
  if (cfg.tqWith && h.reads.trendQualityWith !== true) return false;
  if (cfg.volWithReq && h.reads.volWith !== true) return false;
  if (cfg.momWithReq && h.reads.momWith !== true) return false;
  if (cfg.cascadeWithReq && h.reads['tm:cascade'] !== true) return false;
  return sessionOk(cfg, rec.t);
}
function describe(cfg){
  const bits = [];
  const dropped = LEG_NAMES.filter((_, j) => !cfg.legs[j]);
  bits.push(dropped.length ? 'legs -' + dropped.join('-') : '5 legs');
  bits.push('maj>=' + cfg.majority);
  bits.push(cfg.allowClean && cfg.allowConv ? 'clean+conv' : (cfg.allowClean ? 'clean only' : 'conv only'));
  if (cfg.minGates) bits.push('gates>=' + cfg.minGates);
  for (const k of ['skipMomAgainst', 'skipVolAgainst', 'skipChop', 'skipRsiDiv', 'skipVolDiv', 'skipCandleAgainst', 'perfectOnly', 'freshAlign', 'score5Only', 'adxWith', 'tqWith', 'volWithReq', 'momWithReq', 'cascadeWithReq'])
    if (cfg[k]) bits.push(k);
  if (cfg.session) bits.push('session:' + cfg.session);
  bits.push('geom:' + GEOMS[cfg.geom].label);
  return bits.join(' · ');
}

/* ---------- evaluate a configuration on the cached records ---------- */
function evalConfig(data, cfg, outcomes){
  const trades = [];
  for (const sym of Object.keys(data)){
    const { recs } = data[sym];
    for (const dir of ['long', 'short']){
      let liveUntil = -1;
      for (const rec of recs){
        const h = rec.heavy[dir];
        if (!h || !selected(cfg, rec, dir, h)) continue;
        if (rec.i <= liveUntil) continue;   /* merged — one position per symbol+dir */
        const key = sym + '|' + rec.i + '|' + dir;
        const oc = (outcomes[key] = outcomes[key] || {});
        const g = (oc[cfg.geom] = oc[cfg.geom] || settleOne(data[sym].h4, rec.i, Object.assign({ dir }, h), GEOMS[cfg.geom]));
        liveUntil = g.liveUntil;
        if (g.outcome === 'unfilled') continue;
        trades.push({ t: rec.t, sym, dir, outcome: g.outcome, r: g.r, net: g.net, bothTouch: g.bothTouch });
      }
    }
  }
  trades.sort((a, b) => a.t - b.t);
  return trades;
}
function windowAgg(trades, t0, t1){
  const s = trades.filter(t => t.t >= t0 && t.t < t1);
  if (!s.length) return { n: 0, win: null, net: null };
  let w = 0, net = 0;
  for (const t of s){ if (t.outcome === 'target') w++; net += t.net; }
  return { n: s.length, win: w / s.length, net: net / s.length };
}

export { heavyOf, phaseA, settleOne, baseConfig, subsetScore, selected, describe, evalConfig, windowAgg, GEOMS, LEG_NAMES, LAB_CACHE, LAB_OUT };

/* ---------- main ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) (async () => {
  const log = console.log;
  const symbols = DEFAULT_SYMBOLS, bars = 2200;
  const W = boot();

  let data;
  if (!has('--rebuild') && fs.existsSync(LAB_CACHE)){
    log('lab cache hit: ' + LAB_CACHE);
    data = JSON.parse(fs.readFileSync(LAB_CACHE, 'utf8'));
    /* the desk's per-bar verdicts are cached; only the raw tapes reload */
    for (const sym of symbols) data[sym].h4 = await cachedKlines(sym, '4h', bars, { log });
  } else {
    log('Phase A — walking every bar x both directions through the desk (this is the slow pass)...');
    data = await phaseA(W, symbols, bars, log);
    const slim = {};
    for (const sym of symbols) slim[sym] = { recs: data[sym].recs.map(r => Object.assign({}, r, { row: undefined })) };
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(LAB_CACHE, JSON.stringify(slim));
    log('  cached -> ' + LAB_CACHE);
  }

  /* Phase B is lazy (outcomes memoized per candidate x geometry on first use). */
  const outcomes = {};

  /* window boundaries: four equal-time buckets over the walked span */
  let tMin = Infinity, tMax = -Infinity;
  for (const sym of symbols) for (const rec of data[sym].recs){ if (rec.t < tMin) tMin = rec.t; if (rec.t > tMax) tMax = rec.t; }
  const W_EDGE = [], span = tMax - tMin;
  for (let w = 0; w <= 4; w++) W_EDGE.push(tMin + Math.floor(span * w / 4));
  const wName = i => new Date(W_EDGE[i] * 1000).toISOString().slice(0, 10) + ' → ' + new Date((W_EDGE[i + 1] - 1) * 1000).toISOString().slice(0, 10);

  const base = baseConfig();
  const baseTrades = evalConfig(data, base, outcomes);
  const baseWin = [0, 1, 2, 3].map(w => windowAgg(baseTrades, W_EDGE[w], W_EDGE[w + 1]));
  const baseAll = windowAgg(baseTrades, -Infinity, Infinity);
  log('\n=== BASELINE (the desk as shipped) ===');
  log('all: n=' + baseAll.n + ' win=' + (100 * baseAll.win).toFixed(1) + '% net=' + baseAll.net.toFixed(3) + 'R');
  for (let w = 0; w < 4; w++) log('  W' + (w + 1) + ' [' + wName(w) + ']: n=' + baseWin[w].n + ' win=' + (baseWin[w].win == null ? '—' : (100 * baseWin[w].win).toFixed(1) + '%') + ' net=' + (baseWin[w].net == null ? '—' : baseWin[w].net.toFixed(3) + 'R'));

  /* the move set: every single-knob deviation from a config */
  const BOOL_KNOBS = ['skipMomAgainst', 'skipVolAgainst', 'skipChop', 'skipRsiDiv', 'skipVolDiv', 'skipCandleAgainst', 'perfectOnly', 'freshAlign', 'score5Only', 'adxWith', 'tqWith', 'volWithReq', 'momWithReq', 'cascadeWithReq'];
  function moves(cfg){
    const out = [];
    for (let j = 0; j < 5; j++){ const c = JSON.parse(JSON.stringify(cfg)); c.legs[j] = c.legs[j] ? 0 : 1; if (c.legs.some(x => x)) out.push([c, (c.legs[j] ? 'add ' : 'remove ') + LEG_NAMES[j]]); }
    for (const m of [2, 3, 4]) if (m !== cfg.majority){ const c = JSON.parse(JSON.stringify(cfg)); c.majority = m; out.push([c, 'majority=' + m]); }
    for (const k of BOOL_KNOBS){ const c = JSON.parse(JSON.stringify(cfg)); c[k] = !c[k]; out.push([c, (c[k] ? '+' : '-') + k]); }
    const mech = [[true, false], [false, true], [true, true]];
    for (const [cl, cv] of mech) if (cl !== cfg.allowClean || cv !== cfg.allowConv){ const c = JSON.parse(JSON.stringify(cfg)); c.allowClean = cl; c.allowConv = cv; out.push([c, cl && cv ? 'clean+conv' : (cl ? 'clean only' : 'conv only')]); }
    for (const g of [0, 6, 7]) if (g !== cfg.minGates){ const c = JSON.parse(JSON.stringify(cfg)); c.minGates = g; out.push([c, 'minGates=' + g]); }
    for (const s of [null, 'OVERLAP', 'LDN_OVL']) if (s !== cfg.session){ const c = JSON.parse(JSON.stringify(cfg)); c.session = s; out.push([c, 'session=' + (s || 'all')]); }
    for (let g = 0; g < GEOMS.length; g++) if (g !== cfg.geom){ const c = JSON.parse(JSON.stringify(cfg)); c.geom = g; out.push([c, 'geom=' + GEOMS[g].label]); }
    return out;
  }

  /* search windows = W1..W3; W4 is held out and never scored here */
  const SEARCH = [0, 1, 2], CONFIRM = 3;
  function scoreOn(cfg, cur){
    const trades = evalConfig(data, cfg, outcomes);
    const ws = SEARCH.map(w => windowAgg(trades, W_EDGE[w], W_EDGE[w + 1]));
    const searchAll = windowAgg(trades, W_EDGE[0], W_EDGE[CONFIRM]);
    return { trades, ws, searchAll };
  }
  function feasible(res, curRes){
    for (let w = 0; w < SEARCH.length; w++){
      if (res.ws[w].n < 15) return false;
      if (res.ws[w].win < curRes.ws[w].win - 1e-12) return false;
    }
    if (res.searchAll.net < curRes.searchAll.net - 1e-12) return false;
    return true;
  }
  /* rank: search win rate, tiebreak net R */
  function better(a, b){
    if (a.searchAll.win !== b.searchAll.win) return a.searchAll.win > b.searchAll.win;
    return a.searchAll.net > b.searchAll.net;
  }

  log('\n=== THE SIMULATION LOOP (greedy add/remove on W1-W3, W4 held out) ===');
  let cur = base, curRes = scoreOn(base, null), evaluated = 1;
  const history = [{ move: 'baseline (desk as shipped)', cfg: JSON.parse(JSON.stringify(cur)), search: curRes.searchAll, ws: curRes.ws.map(x => ({ n: x.n, win: x.win, net: x.net })) }];
  const maxPasses = +opt('--passes', 60);
  for (let pass = 1; pass <= maxPasses; pass++){
    let bestMove = null, bestCfg = null, bestRes = null;
    for (const [c, label] of moves(cur)){
      const res = scoreOn(c, curRes); evaluated++;
      if (!feasible(res, curRes)) continue;
      if (!better(res, curRes)) continue;
      if (!bestRes || better(res, bestRes)){ bestRes = res; bestCfg = c; bestMove = label; }
    }
    if (!bestCfg){ log('pass ' + pass + ': no improving move — converged'); break; }
    cur = bestCfg; curRes = bestRes;
    history.push({ move: bestMove, cfg: JSON.parse(JSON.stringify(cur)), search: curRes.searchAll, ws: curRes.ws.map(x => ({ n: x.n, win: x.win, net: x.net })) });
    log('pass ' + pass + ': ' + bestMove + '  ->  search win ' + (100 * curRes.searchAll.win).toFixed(1) + '% net ' + curRes.searchAll.net.toFixed(3) + 'R (n=' + curRes.searchAll.n + ')');
  }
  log('configurations evaluated: ' + evaluated);

  /* ---------- Phase D: held-out confirmation + statistics ---------- */
  const finalTrades = curRes.trades.concat();   /* search trades */
  const confBase = windowAgg(baseTrades, W_EDGE[CONFIRM], W_EDGE[CONFIRM + 1]);
  const confNew = windowAgg(evalConfig(data, cur, outcomes), W_EDGE[CONFIRM], W_EDGE[CONFIRM + 1]);
  const allNew = windowAgg(evalConfig(data, cur, outcomes), -Infinity, Infinity);
  /* two-proportion z-test, pooled, final vs baseline on ALL windows */
  const bt = baseTrades.filter(t => true), ft = evalConfig(data, cur, outcomes);
  const bw = bt.filter(t => t.outcome === 'target').length, fw = ft.filter(t => t.outcome === 'target').length;
  const p = (bw + fw) / (bt.length + ft.length);
  const z = p > 0 && p < 1 ? (fw / ft.length - bw / bt.length) / Math.sqrt(p * (1 - p) * (1 / bt.length + 1 / ft.length)) : 0;
  const zP = 2 * (1 - normCdf(Math.abs(z)));
  function normCdf(x){ return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function erf(x){ const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }

  const confirmed = confNew.win >= confBase.win - 1e-12 && confNew.net >= confBase.net - 1e-12 && confNew.n >= 10;
  const report = {
    meta: { generated: new Date().toISOString(), symbols, bars, evaluated, windows: [1, 2, 3, 4].map(i => wName(i - 1)), searchWindows: 'W1-W3', heldOut: 'W4', cost: COST_FRAC },
    baseline: { all: baseAll, windows: baseWin },
    path: history,
    final: { config: cur, description: describe(cur), search: curRes.searchAll, heldOut: confNew, heldOutBaseline: confBase, all: allNew, z: +z.toFixed(2), pTwoSided: +zP.toFixed(4), confirmed }
  };
  fs.writeFileSync(LAB_OUT, JSON.stringify(report, (k, v) => (v && v.row ? undefined : v), 1));

  log('\n=== HELD-OUT CONFIRMATION (W4, never searched) ===');
  log('baseline W4: n=' + confBase.n + ' win=' + (confBase.win == null ? '—' : (100 * confBase.win).toFixed(1) + '%') + ' net=' + (confBase.net == null ? '—' : confBase.net.toFixed(3) + 'R'));
  log('final    W4: n=' + confNew.n + ' win=' + (confNew.win == null ? '—' : (100 * confNew.win).toFixed(1) + '%') + ' net=' + (confNew.net == null ? '—' : confNew.net.toFixed(3) + 'R'));
  log('\n=== FINAL CONFIG ===');
  log(describe(cur));
  log('search (W1-W3): n=' + curRes.searchAll.n + ' win=' + (100 * curRes.searchAll.win).toFixed(1) + '% net=' + curRes.searchAll.net.toFixed(3) + 'R');
  log('all windows:    n=' + allNew.n + ' win=' + (100 * allNew.win).toFixed(1) + '% net=' + allNew.net.toFixed(3) + 'R');
  log('vs baseline pooled: z=' + z.toFixed(2) + ' p=' + zP.toFixed(4));
  log(confirmed ? 'CONFIRMED on held-out W4' : 'NOT CONFIRMED on held-out W4 — the search gain did not survive out of sample');
  log('written: ' + LAB_OUT);
})().catch(e => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
