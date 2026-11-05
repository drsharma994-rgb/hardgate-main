#!/usr/bin/node
/* HARDGATE — OMNIGOLD win-rate lab (offline, node ESM).
   Run:  node scripts/omnigold-winrate-lab.mjs [--passes=N]

   WHAT THIS IS: the add/remove simulation the TREND MATRIX (hg-v1484) and
   GOLD SCALP (hg-v1488) desks got, pointed at OMNIGOLD. It works from the
   COMMITTED walk artifact (scripts/backtest-omnigold-results.json — every
   candidate the shipped pipeline minted, with its gate ledger as two hex
   bitmasks over meta.gateKeyOrder, its fire-time confluence tier, its plan
   levels and its mark-at-fire) plus the cached 1h/4h tapes, and runs the
   same four phases:

     A. every settled row becomes a candidate the lab can admit or refuse;
     B. each candidate is re-settled under a grid of stop/target geometries
        (the plan's own levels, plus stop-scale x target-R around plan risk)
        on its OWN horizon grid (SCALP = 1h bars / 24-bar trigger window,
        SWING = 4h bars / 20-bar), the lib walk semantics verbatim: fill
        required, first touch stop vs target, both-touch = LOSS, 96 bars
        after fill -> timeout at close, 0.26% PAXG round trip on the
        geometry's own risk;
     C. greedy add/remove over the admission clauses — per-kind on/off,
        direction, horizon, source, confluence tier/score floors, ticket,
        the GATE LEDGER itself (require-passed / skip-when-failed per gate
        key: the add/remove axis for this desk's INDICATORS, each one a
        participation vote the artifact can answer for), killzone family
        (recomputed from the row's own clock through goldind's
        goldKillzone), and geometry — scored on three disjoint SEARCH
        windows, kept only when it clears the bar;
     D. confirmation on a fourth HELD-OUT window the search never saw;
     E. a LEAVE-ONE-OUT postmortem on the confirmed config, naming the
        clauses the held-out window refuses.

   THE BAR (the hg-v1488 tightened shape): a move must (1) not lower the win
   rate in ANY of the three search windows, (2) keep at least 100 settled
   positions in each — this book is four times the scalp desk's, so the
   floor scales with it — (3) keep at least 35% of the baseline cohort, and
   (4) not lower aggregate net R. Confirmation demands the held-out window's
   win rate AND net R both at least the baseline's, n >= 50 there. Two-
   proportion z vs the baseline pooled book; configurations evaluated
   printed, because a search this wide needs its multiple-comparison
   discount said out loud.

   STATED DEVIATIONS: confluence scores are the SHIPPED walk's own fire-time
   values (the wilson evidence chain as shipped) — a differently admitted
   book would shift them slightly, and the lab holds them frozen rather
   than re-running the feedback loop per config. The candidate STREAM is the
   shipped walk's: the walk skipped 28,755 candidates on the kind|dir
   overlap lock and those were never priced, so a clause that frees slots
   cannot measure the candidates that would have filled them — bounded by
   that counter, stated, not hidden. Unfilled rows are carried for lock
   fidelity and excluded from every rate, exactly as the walk's own
   aggregates do.

   This script MEASURES. It ships nothing: a clause enters the desk only
   through the measured-edge doctrine (hg-v966 both-halves / held-out), and
   the shipped walk re-run is the arbiter.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { xmOrderType, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';
import { decodeGateVerdict } from '../lib/gate-mask.mjs';
import { klinesRouteNote } from '../lib/klines-source.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const HERE = path.join(ROOT, 'scripts');
const LAB_OUT = path.join(HERE, 'omnigold-winrate-lab-results.json');
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const ARTIFACT = path.join(HERE, 'backtest-omnigold-results.json');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };
const PASSES = +opt('--passes', 8);

const SYMBOL = 'PAXGUSDT';
const COST_RT_FRAC = 2 * (0.0010 + 0.0003);   /* 0.26% PAXG RT — the walk's own cost model */
const TIMEOUT_BARS = 96;
const FILL_WINDOW = { SCALP: 24, SWING: 20 };  /* bars on the horizon's own grid */

const GEOMS = [{ s: 1, k: null, label: 'plan' }];
for (const s of [0.75, 1, 1.25]) for (const k of [1, 1.5, 2, 2.5, 3]) GEOMS.push({ s, k, label: 'stop' + s + 'x t' + k + 'R' });

const TIER_MIN = { off: 0, 'fair+': 50, 'strong+': 70, 'exceptional': 85 };
const CONF_MIN = { off: 0, 50: 50, 65: 65, 74: 74 };

async function cachedKlines(interval, target){
  const file = path.join(CACHE_DIR, SYMBOL + '-' + interval + '.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(file)){
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j && j.target >= target && Array.isArray(j.rows) && j.rows.length >= target) return j.rows.slice(-target);
  }
  console.log('  fetching ' + SYMBOL + ' ' + interval + ' x' + target + ' — ' + klinesRouteNote());
  const rows = [];
  let end = null;
  while (rows.length < target){
    const { klinesUrl } = await import('../lib/klines-source.mjs');
    const params = { symbol: SYMBOL, interval, limit: Math.min(1000, target - rows.length) };
    if (end) params.endTime = end;
    const res = await fetch(klinesUrl(params, process.env).url);
    if (!res.ok) throw new Error('klines ' + res.status);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.unshift(...batch.map(b => ({ t: Math.floor(b[0] / 1000), o: +b[1], h: +b[2], l: +b[3], c: +b[4], v: +b[5] })));
    end = batch[0][0] - 1;
    if (batch.length < params.limit) break;
  }
  fs.writeFileSync(file, JSON.stringify({ target, rows }));
  return rows.slice(-target);
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                   'goldind.js', 'goldswing.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (typeof ctx.goldKillzone !== 'function') throw new Error('boot failed: goldKillzone');
  return ctx;
}

/* ---------- Phase A: the committed artifact IS the candidate stream ---------- */
function loadCandidates(){
  const j = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const keyOrder = j.meta.gateKeyOrder;
  const rows = j.trades.map((t, i) => ({
    idx: i, tISO: t.tISO, t: Date.parse(t.tISO),
    source: t.source, horizon: t.horizon, kind: t.kind, dir: t.dir,
    entry: t.entry, stop: t.stop, t1: t.t1,
    ticket: !!t.ticket, confluence: t.confluence, tier: t.tier,
    engineAgainstTape: !!t.engineAgainstTape, engineLowGrade: !!t.engineLowGrade,
    outcome: t.outcome, netR: t.netR, rMultiple: t.rMultiple,
    gatesPass: t.gatesPass, gatesFail: t.gatesFail,
    orderType: t.orderType, markAtFire: t.markAtFire
  }));
  return { rows, keyOrder, meta: j.meta };
}

/* ---------- Phase B: settle under one geometry, lib semantics verbatim ---------- */
function settleOne(grids, r, geom){
  const grid = grids[r.horizon] || grids.SCALP;
  const i0 = grid.index.get(Math.floor(Date.parse(r.tISO) / 1000));
  if (i0 == null) return { outcome: 'offgrid', liveUntil: Infinity };
  const dir = r.dir, sgn = dir === 'long' ? 1 : -1;
  const risk0 = Math.abs(r.entry - r.stop);
  const entry = r.entry;
  const stop = entry - sgn * geom.s * risk0;
  const t1 = geom.k == null ? r.t1 : entry + sgn * geom.k * risk0;
  const risk = geom.s * risk0;
  if (!(risk > 0)) return { outcome: 'unpriced', liveUntil: Infinity };
  const orderType = xmOrderType(dir, entry, r.markAtFire).name;
  const fillWindow = FILL_WINDOW[r.horizon] || 24;
  let state = 'pending', waitBars = 0, fillIdx = null;
  for (let bi = i0 + 1; bi < grid.rows.length; bi++){
    const bar = grid.rows[bi];
    if (state === 'pending'){
      if (ogXmBarTouchesEntry(orderType, dir, bar, entry)){ state = 'filled'; fillIdx = bi; }
      else { if (++waitBars >= fillWindow) return { outcome: 'unfilled', liveUntil: bi }; continue; }
    }
    const hitStop = dir === 'long' ? +bar.l <= stop : +bar.h >= stop;
    const hitT1 = dir === 'long' ? +bar.h >= t1 : +bar.l <= t1;
    if (hitStop && hitT1) return { outcome: 'loss', liveUntil: bi, rGross: -1 };
    if (hitStop) return { outcome: 'loss', liveUntil: bi, rGross: -1 };
    if (hitT1) return { outcome: 'win', liveUntil: bi, rGross: Math.abs(t1 - entry) / risk };
    if (bi - fillIdx >= TIMEOUT_BARS){
      const mv = dir === 'long' ? (+bar.c - entry) : (entry - +bar.c);
      return { outcome: 'timeout', liveUntil: bi, rGross: mv / risk };
    }
  }
  return { outcome: 'open', liveUntil: grid.rows.length - 1 };
}

/* ---------- Phase C: the shipped configuration and the clauses ---------- */
function baseConfig(rows){
  const on = {};
  for (const r of rows) on[r.kind] = true;
  return {
    on, dirLong: true, dirShort: true,
    horizons: { SCALP: true, SWING: true },
    srcEngine: true, skipEngineAgainstTape: false, skipEngineLowGrade: false,
    tierMin: 0, confMin: 0, ticketOnly: false,
    gates: {},                    /* 'require:<key>' / 'skipfail:<key>' -> true */
    kz: {},                       /* 'skip OFF-HOURS' / 'only LONDON+NY' / 'skip OVERLAP' */
    geom: 0
  };
}
function selected(cfg, r, kzOf){
  if (!cfg.on[r.kind]) return false;
  if (r.dir === 'long' && !cfg.dirLong) return false;
  if (r.dir === 'short' && !cfg.dirShort) return false;
  if (!cfg.horizons[r.horizon]) return false;
  if (r.source === 'ENGINE'){
    if (!cfg.srcEngine) return false;
    if (cfg.skipEngineAgainstTape && r.engineAgainstTape) return false;
    if (cfg.skipEngineLowGrade && r.engineLowGrade) return false;
  }
  if (cfg.tierMin > 0){
    const rank = { WEAK: 0, FAIR: 1, STRONG: 2, EXCEPTIONAL: 3 };
    if (!(rank[r.tier] >= cfg.tierMin)) return false;
  }
  if (cfg.confMin > 0 && !(r.confluence >= cfg.confMin)) return false;
  if (cfg.ticketOnly && !r.ticket) return false;
  for (const key of Object.keys(cfg.gates)){
    if (!cfg.gates[key]) continue;
    const gk = key.slice(key.indexOf(':') + 1);
    const v = gateVerdictCached(r, gk);
    if (key.indexOf('require:') === 0 && v !== true) return false;
    if (key.indexOf('skipfail:') === 0 && v === false) return false;
  }
  const kz = kzOf(r);
  if (cfg.kz['skip OFF-HOURS'] && /OFF-HOURS/i.test(kz)) return false;
  if (cfg.kz['skip OVERLAP'] && /OVERLAP/i.test(kz)) return false;
  if (cfg.kz['only LONDON+NY'] && !(/LONDON/i.test(kz) || /NY AM/i.test(kz))) return false;
  return true;
}
/* gate verdict via the artifact's own masks; the key order is per-run */
let KEYORDER = null;
function gateVerdictCached(r, key){ return decodeGateVerdict(r, key, KEYORDER); }

function describe(cfg){
  const bits = [];
  const off = Object.keys(cfg.on).filter(k => !cfg.on[k]);
  if (off.length) bits.push('kinds -' + off.join('-'));
  if (!cfg.dirLong || !cfg.dirShort) bits.push(cfg.dirLong ? 'long only' : (cfg.dirShort ? 'short only' : 'NO DIR'));
  const hz = Object.keys(cfg.horizons).filter(k => !cfg.horizons[k]);
  if (hz.length) bits.push('horizons -' + hz.join('-'));
  if (!cfg.srcEngine) bits.push('no ENGINE');
  if (cfg.skipEngineAgainstTape) bits.push('skip againstTape');
  if (cfg.skipEngineLowGrade) bits.push('skip lowGrade');
  if (cfg.tierMin) bits.push('tier>=' + cfg.tierMin);
  if (cfg.confMin) bits.push('conf>=' + cfg.confMin);
  if (cfg.ticketOnly) bits.push('ticket only');
  for (const k of Object.keys(cfg.gates)) if (cfg.gates[k]) bits.push(k);
  for (const k of Object.keys(cfg.kz)) if (cfg.kz[k]) bits.push(k);
  bits.push('geom:' + GEOMS[cfg.geom].label);
  return bits.join(' · ');
}
function evalConfig(data, cfg){
  const trades = [];
  const liveScan = new Map(), liveEng = new Map();
  for (const r of data.rows){
    if (!selected(cfg, r, data.kzOf)) continue;
    const lock = (r.source === 'ENGINE') ? liveEng : liveScan;
    const key = r.horizon + '|' + r.kind + '|' + r.dir;
    if (lock.has(key) && r.t < lock.get(key)) continue;
    const ck = r.idx + '|' + cfg.geom;
    const s = data.settled.get(ck) || (data.settled.set(ck, settleOne(data.grids, r, GEOMS[cfg.geom])), data.settled.get(ck));
    lock.set(key, (s.liveUntil === Infinity ? Date.parse(data.meta.span.to) : barTime(data, r.horizon, s.liveUntil)));
    if (s.outcome === 'unfilled' || s.outcome === 'open' || s.outcome === 'offgrid' || s.outcome === 'unpriced') continue;
    const risk = GEOMS[cfg.geom].s * Math.abs(r.entry - r.stop);
    const net = s.rGross - (r.entry * COST_RT_FRAC) / risk;
    trades.push({ t: r.t, outcome: s.outcome, net });
  }
  trades.sort((a, b) => a.t - b.t);
  return trades;
}
function barTime(data, horizon, barIdx){
  const grid = data.grids[horizon] || data.grids.SCALP;
  const b = grid.rows[barIdx];
  return b ? b.t * 1000 : Date.parse(data.meta.span.to);
}
function windowAgg(trades, t0, t1){
  const s = trades.filter(t => t.t >= t0 && t.t < t1);
  if (!s.length) return { n: 0, win: null, net: null };
  let w = 0, net = 0;
  for (const t of s){ if (t.outcome === 'win') w++; net += t.net; }
  return { n: s.length, win: w / s.length, net: net / s.length };
}

/* exported for a sensitivity driver */
export { boot, cachedKlines, loadCandidates, settleOne, baseConfig, selected, describe, evalConfig, windowAgg, GEOMS, COST_RT_FRAC, FILL_WINDOW };

/* ---------- main ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) (async () => {
  const log = console.log;
  log('=== OMNIGOLD win-rate lab · ' + new Date().toISOString() + ' ===');
  log('artifact rows + cached tapes · ' + COST_RT_FRAC * 100 + '% RT · route ' + klinesRouteNote());
  const W = boot();
  const loaded = loadCandidates();
  KEYORDER = loaded.keyOrder;
  log('  candidates: ' + loaded.rows.length + ' · gate keys: ' + KEYORDER.length + ' · span ' + loaded.meta.span.from + ' .. ' + loaded.meta.span.to);

  const need1h = Math.ceil((Date.parse(loaded.meta.span.to) - Date.parse(loaded.meta.span.from)) / 3600000) + 1600;
  const need4h = Math.ceil(need1h / 4) + 200;
  const rows1h = await cachedKlines('1h', need1h);
  const rows4h = await cachedKlines('4h', need4h);
  const grids = {
    SCALP: { rows: rows1h, index: new Map(rows1h.map((b, i) => [b.t, i])) },
    SWING: { rows: rows4h, index: new Map(rows4h.map((b, i) => [b.t, i])) }
  };
  const kzCache = new Map();
  const kzOf = (r) => {
    let k = kzCache.get(r.t);
    if (k === undefined){
      try { const kz = W.goldKillzone(r.t); k = String(kz && (kz.name || kz.label || kz) || ''); }
      catch (e) { k = ''; }
      kzCache.set(r.t, k);
    }
    return k;
  };
  const data = { rows: loaded.rows, grids, settled: new Map(), meta: loaded.meta, kzOf };

  const spanT0 = Date.parse(loaded.meta.span.from), spanT1 = Date.parse(loaded.meta.span.to);
  const winBars = [0, 1, 2, 3].map(w => [spanT0 + (spanT1 - spanT0) * w / 4, spanT0 + (spanT1 - spanT0) * (w + 1) / 4]);
  const wName = i => 'W' + (i + 1) + ' ' + new Date(winBars[i][0]).toISOString().slice(0, 10) + '..' + new Date(winBars[i][1]).toISOString().slice(0, 10);

  const cur = baseConfig(data.rows);
  const score = (cfg) => {
    const trades = evalConfig(data, cfg);
    const win = [0, 1, 2, 3].map(i => windowAgg(trades, winBars[i][0], winBars[i][1]));
    const sn = win[0].n + win[1].n + win[2].n;
    const searchAll = { n: sn,
      win: (win[0].win * win[0].n + win[1].win * win[1].n + win[2].win * win[2].n) / Math.max(1, sn),
      net: (win[0].net * win[0].n + win[1].net * win[1].n + win[2].net * win[2].n) / Math.max(1, sn) };
    return { win, searchAll, all: windowAgg(trades, winBars[0][0], winBars[3][1]) };
  };

  log('\nPhase C — greedy add/remove from the SHIPPED configuration');
  log('baseline: ' + describe(cur));
  let base = score(cur);
  log('baseline search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('baseline all:            n=' + base.all.n + ' win=' + (100 * base.all.win).toFixed(1) + '% net=' + base.all.net.toFixed(3) + 'R');

  /* the move set */
  const kinds = Object.keys(cur.on).sort();
  const gateCov = {};
  for (const r of data.rows){
    for (const k of KEYORDER){
      const v = decodeGateVerdict(r, k, KEYORDER);
      if (v === true) gateCov[k] = gateCov[k] || { p: 0, f: 0 };
      if (v === true) gateCov[k].p++;
      if (v === false) (gateCov[k] = gateCov[k] || { p: 0, f: 0 }).f++;
    }
  }
  const covered = Object.keys(gateCov).filter(k => gateCov[k].p + gateCov[k].f >= 200);
  log('  gates with enough coverage to search (>=200 judged rows): ' + covered.length + ' of ' + KEYORDER.length);
  const moves = [];
  for (const k of kinds) moves.push({ label: 'kind ' + (cur.on[k] ? '-' : '+') + k, apply: c => { c.on[k] = !c.on[k]; } });
  moves.push({ label: 'long only', apply: c => { c.dirLong = true; c.dirShort = false; } });
  moves.push({ label: 'short only', apply: c => { c.dirLong = false; c.dirShort = true; } });
  moves.push({ label: 'both dirs', apply: c => { c.dirLong = true; c.dirShort = true; } });
  for (const hz of ['SCALP', 'SWING']) moves.push({ label: 'horizon toggle ' + hz, apply: c => { c.horizons[hz] = !c.horizons[hz]; } });
  moves.push({ label: 'no ENGINE', apply: c => { c.srcEngine = false; } });
  moves.push({ label: 'skip againstTape', apply: c => { c.skipEngineAgainstTape = true; } });
  moves.push({ label: 'skip lowGrade', apply: c => { c.skipEngineLowGrade = true; } });
  for (const t of ['fair+', 'strong+', 'exceptional']) moves.push({ label: 'tier>=' + t, apply: c => { c.tierMin = TIER_MIN[t]; } });
  moves.push({ label: 'tier off', apply: c => { c.tierMin = 0; } });
  for (const c0 of ['50', '65', '74']) moves.push({ label: 'conf>=' + c0, apply: c => { c.confMin = CONF_MIN[c0]; } });
  moves.push({ label: 'conf off', apply: c => { c.confMin = 0; } });
  moves.push({ label: 'ticket only', apply: c => { c.ticketOnly = !c.ticketOnly; } });
  for (const k of covered){
    moves.push({ label: 'require:' + k, apply: c => { c.gates['require:' + k] = !c.gates['require:' + k]; } });
    moves.push({ label: 'skipfail:' + k, apply: c => { c.gates['skipfail:' + k] = !c.gates['skipfail:' + k]; } });
  }
  for (const k of ['skip OFF-HOURS', 'skip OVERLAP', 'only LONDON+NY'])
    moves.push({ label: k, apply: c => { c.kz[k] = !c.kz[k]; } });
  moves.push({ label: 'geom next', apply: c => { c.geom = (c.geom + 1) % GEOMS.length; } });
  moves.push({ label: 'geom prev', apply: c => { c.geom = (c.geom + GEOMS.length - 1) % GEOMS.length; } });
  moves.push({ label: 'geom plan', apply: c => { c.geom = 0; } });

  const okMove = (res) => res.win.every((w, i) => i < 3 ? (w.win != null && w.n >= 100 && w.win >= base.win[i].win - 1e-12) : true)
    && res.searchAll.n >= 0.35 * base.searchAll.n
    && res.searchAll.net >= base.searchAll.net - 1e-12;

  let evaluated = 0;
  const history = [];
  for (let pass = 0; pass < PASSES; pass++){
    let bestMove = null, bestRes = null;
    for (const mv of moves){
      const cand = JSON.parse(JSON.stringify(cur));
      mv.apply(cand);
      if (describe(cand) === describe(cur)) continue;
      const res = score(cand);
      evaluated++;
      if (!okMove(res)) continue;
      if (!bestRes || res.searchAll.win > bestRes.searchAll.win + 1e-12){ bestMove = mv; bestRes = res; }
    }
    if (!bestMove){ log('pass ' + (pass + 1) + ': no improving move — search converged'); break; }
    bestMove.apply(cur);
    base = bestRes;
    history.push({ pass: pass + 1, move: bestMove.label, description: describe(cur), search: base.searchAll, windows: base.win.slice(0, 3) });
    log('pass ' + (pass + 1) + ': ' + bestMove.label + '  ->  win ' + (100 * base.searchAll.win).toFixed(1) + '% net ' + base.searchAll.net.toFixed(3) + 'R (n=' + base.searchAll.n + ')  [' + describe(cur) + ']');
  }

  log('\nPhase D — held-out confirmation (' + wName(3) + ', never searched)');
  const confNew = base.win[3], confBase = score(baseConfig(data.rows)).win[3];
  log('baseline W4: n=' + confBase.n + ' win=' + (confBase.win == null ? '—' : (100 * confBase.win).toFixed(1) + '%') + ' net=' + (confBase.net == null ? '—' : confBase.net.toFixed(3) + 'R'));
  log('final    W4: n=' + confNew.n + ' win=' + (confNew.win == null ? '—' : (100 * confNew.win).toFixed(1) + '%') + ' net=' + (confNew.net == null ? '—' : confNew.net.toFixed(3) + 'R'));

  const bAll = score(baseConfig(data.rows)).all, fAll = base.all;
  const p1 = bAll.win || 0, n1 = bAll.n, p2 = fAll.win || 0, n2 = fAll.n;
  const pPool = (p1 * n1 + p2 * n2) / Math.max(1, n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, n1) + 1 / Math.max(1, n2)));
  const z = se > 0 ? (p2 - p1) / se : 0;
  function normCdf(x){ let t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return x >= 0 ? 1 - p : p; }
  const zP = 2 * (1 - normCdf(Math.abs(z)));

  const confirmed = confNew.win != null && confNew.win >= confBase.win - 1e-12 && confNew.net >= confBase.net - 1e-12 && confNew.n >= 50;

  let postmortem = null;
  if (confirmed){
    const variants = [];
    const relax = (name, mutate) => {
      const c = JSON.parse(JSON.stringify(cur)); mutate(c);
      const w = score(c).win;
      variants.push({ relax: name, heldOut: w[3], windows: w });
    };
    relax('both dirs (direction clause off)', c => { c.dirLong = true; c.dirShort = true; });
    for (const hz of ['SCALP', 'SWING']) if (!cur.horizons[hz]) relax('horizon ' + hz + ' back in', c => { c.horizons[hz] = true; });
    if (!cur.srcEngine) relax('ENGINE back in', c => { c.srcEngine = true; });
    if (cur.skipEngineAgainstTape) relax('keep againstTape', c => { c.skipEngineAgainstTape = false; });
    if (cur.skipEngineLowGrade) relax('keep lowGrade', c => { c.skipEngineLowGrade = false; });
    if (cur.tierMin) relax('no tier floor', c => { c.tierMin = 0; });
    if (cur.confMin) relax('no conf floor', c => { c.confMin = 0; });
    if (cur.ticketOnly) relax('not ticket-only', c => { c.ticketOnly = false; });
    for (const k of Object.keys(cur.gates)) if (cur.gates[k]) relax('drop ' + k, c => { c.gates[k] = false; });
    for (const k of Object.keys(cur.kz)) if (cur.kz[k]) relax('no ' + k, c => { c.kz[k] = false; });
    for (const k of kinds) if (!cur.on[k]) relax('+' + k + ' back in', c => { c.on[k] = true; });
    postmortem = {
      note: 'leave-one-out on the confirmed config: a variant that BEATS the full config on the held-out window names a clause the search added for its own windows — refused for shipping',
      baseline: confNew, variants,
      refused: variants.filter(v => v.heldOut.win != null && confNew.win != null && v.heldOut.win > confNew.win + 1e-12).map(v => v.relax)
    };
    for (const v of variants)
      log('  LOO ' + v.relax.padEnd(38) + ' W4: n=' + v.heldOut.n + ' win=' + (v.heldOut.win == null ? '—' : (100 * v.heldOut.win).toFixed(1) + '%') + ' net=' + (v.heldOut.net == null ? '—' : v.heldOut.net.toFixed(3) + 'R'));
    if (postmortem.refused.length) log('  REFUSED for shipping (the held-out window reads BETTER without them): ' + postmortem.refused.join(', '));
  }

  /* Phase F — the DIRECTION COHORT, measured (not searched): the per-direction
     book at BOTH cost models across the four disjoint windows. The XM column
     is the venue the desk actually quotes (0.020% RT); PAXG is the walk's own
     cost model (0.26% RT). This section is what a direction clause would ship
     on — gross-negative means signal quality, not venue cost. */
  const dirCohort = { note: 'measured, not searched: the per-direction cohort at both cost models, four disjoint calendar windows of the walk\u2019s own span',
    xmCostFrac: 0.0002, paxgCostFrac: 0.0026, windows: [0, 1, 2, 3].map(wName), directions: {} };
  const xmNet = (r) => r.rMultiple - (r.entry * 0.0002) / Math.abs(r.stop - r.entry);
  for (const dir of ['long', 'short']){
    const list = data.rows.filter(r => r.outcome !== 'unfilled' && r.outcome !== 'open' && r.dir === dir);
    const wins = list.filter(r => r.outcome === 'win').length;
    const d = { n: list.length, win: +(wins / list.length).toFixed(3),
      gross: +(list.reduce((s, r) => s + r.rMultiple, 0) / list.length).toFixed(3),
      netXm: +(list.reduce((s, r) => s + xmNet(r), 0) / list.length).toFixed(3),
      netPaxg: +(list.reduce((s, r) => s + r.netR, 0) / list.length).toFixed(3), windows: [] };
    let pos = 0;
    for (let w = 0; w < 4; w++){
      const seg = list.filter(r => r.t >= winBars[w][0] && r.t < winBars[w][1]);
      const g = seg.reduce((s, r) => s + r.rMultiple, 0) / seg.length;
      d.windows.push({ n: seg.length, gross: +g.toFixed(3), netXm: +(seg.reduce((s, r) => s + xmNet(r), 0) / seg.length).toFixed(3) });
      if (g > 0) pos++;
    }
    d.grossPositiveWindows = pos;
    dirCohort.directions[dir] = d;
  }

  const report = {
    meta: { generated: new Date().toISOString(), artifact: 'scripts/backtest-omnigold-results.json',
      span: [loaded.meta.span.from, loaded.meta.span.to], windows: [0, 1, 2, 3].map(wName),
      searchWindows: 'W1-W3', heldOut: 'W4', cost: COST_RT_FRAC, evaluated,
      deviations: [
        'confluence scores are the shipped walk\u2019s own fire-time values (wilson evidence chain frozen)',
        'the candidate stream is the shipped walk\u2019s: ' + (loaded.meta.counters ? loaded.meta.counters.skippedOverlap : '?') + ' candidates were skipped on the kind|dir overlap lock and were never priced \u2014 a clause that frees slots cannot measure them',
        'ENGINE picks are absent from this artifact (the grade-gated bridge formed none offline); the source clauses are structural no-ops here'
      ] },
    baseline: { all: score(baseConfig(data.rows)).all, description: describe(baseConfig(data.rows)) },
    path: history,
    final: { config: cur, description: describe(cur), search: base.searchAll, heldOut: confNew, heldOutBaseline: confBase, all: fAll, z: +z.toFixed(2), pTwoSided: +zP.toFixed(4), confirmed },
    postmortem,
    directionCohort: dirCohort
  };
  log('Phase F — the direction cohort (measured, both cost models):');
  for (const dir of ['long', 'short']){
    const d = dirCohort.directions[dir];
    log('  ' + dir.padEnd(6) + ' n=' + d.n + ' win=' + (100 * d.win).toFixed(1) + '% gross=' + d.gross.toFixed(3) + 'R net@XM=' + d.netXm.toFixed(3) + 'R net@PAXG=' + d.netPaxg.toFixed(3) + 'R — gross-positive windows: ' + d.grossPositiveWindows + '/4');
  }
  fs.writeFileSync(LAB_OUT, JSON.stringify(report, null, 1));

  log('\n=== FINAL CONFIG ===');
  log(describe(cur));
  log('search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('all windows:    n=' + fAll.n + ' win=' + (100 * fAll.win).toFixed(1) + '% net=' + fAll.net.toFixed(3) + 'R');
  log('vs baseline pooled: z=' + z.toFixed(2) + ' p=' + zP.toFixed(4) + ' (configurations evaluated: ' + evaluated + ' — the multiple-comparison discount applies)');
  log(confirmed ? 'CONFIRMED on held-out W4' : 'NOT CONFIRMED on held-out W4 — the search gain did not survive out of sample');
  log('written: ' + LAB_OUT);
})().catch(e => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
