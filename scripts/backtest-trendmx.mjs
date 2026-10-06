#!/usr/bin/env node
/* HARDGATE — TREND MATRIX replay harness (offline, node ESM). hg-v1160.
   Run:  node scripts/backtest-trendmx.mjs [--smoke] [--bars=N] [--symbols=A,B] [--refresh] [--out=scripts/x.json] [--print-out]

   The desk has recorded its board into the forward ledger since hg-v1039 and,
   since hg-v1159, every witness state and composite leg as a three-state read
   mark -- and it has NO replay: no artifact in the repo ever walked a TREND
   MATRIX plan to an outcome, so the forward ledger is the only evidence the
   desk has and it is weeks deep at best. OMNIROUTE (v531), OMNIPRESENT and
   CRYPTO ULTRA each have one. This is the desk's.

   WHAT IT WALKS, AND WITH WHAT: the desk's OWN functions, booted from the
   files index.html loads -- trendScore (the five legs), tmDirOf (the |2|
   majority), trendmxGateEval (the real cryptogates swing matrix on the 4h
   series), trendmxConviction, trendmxPlan (the desk's own plan chain),
   trendmxRowTier (the tier the board shows), tmRecordReads (the hg-v1159
   marks), trendmxPerfectState. Same code, same arithmetic; nothing here
   restates a rule. Per closed 4h bar, per symbol: the row the scan would have
   built on that bar (its 260 closed 4h bars and the daily bars closed by
   then), the direction, the gate, the plan, the tier, the reads.

   WHAT IT CANNOT WALK, SAID: the taker-flow witness (hg-v1012), the
   fundamental + sentiment witness (hg-v1034) and the SWING post-gate rule
   (hg-v1154) read live feeds that no bar archive carries -- those marks are
   ABSENT on every replay row (the hg-v989 third state), never guessed, and
   the forward ledger is the only place they can be measured. The BTC
   structure macro (tmAltLongBlockedByBtc) is unset in the replay, so no alt
   long is blocked by it here; the live desk may block some.

   FILL AND SETTLE (the forward ledger's own rules, hg-v978 / v980 / v996):
   a MARKET plan (entry at the mark) fills at the NEXT bar's open; a resting
   plan (entry away from the mark -- the fresh-cross EMA limit, a structure
   entry) fills when the next bars trade through it within TM_LIMIT_LIFE bars
   or is UNFILLED and excluded; the trade is then walked up to HORIZON_BARS
   (the 20 the desk hands the ledger), stop-first on a bar that touches both
   levels (the lower bound, hg-v918 -- flagged bothTouch so the other bound
   can be read); past the horizon it settles at the close as a timeout. ONE
   open trade per symbol and direction: a candidate the desk re-forms on the
   next bar while the first is open is MERGED, not a second trade (the
   sequential book, hg-v926), so n counts positions, not re-paints.

   COSTS: Binance spot 0.10% each side (0.20% round trip), the same model
   CRYPTO ULTRA's walk uses on the same bars. Spot bars stand in for the perp
   tapes the desk reads (funding is NOT modelled -- the row's fundingPct is
   null, so hgFundingAgainstMark records nothing). Said in meta.limitations.

   REFUSALS (the hg-v990 rule): a plan the desk itself refused (tmValidSetup
   false) is the desk's own skip and counted as noPlan; a trade the walk would
   write with a non-finite level is a HARNESS defect, counted as unpriced and
   FATAL before anything is written. The artifact path is one of the repo's
   own (scripts/), never outside it. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { klinesUrl, klinesRouteNote } from '../lib/klines-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
export const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
export const ARTIFACT = path.join(ROOT, 'scripts', 'backtest-trendmx-results.json');
export const SMOKE_ARTIFACT = path.join(ROOT, 'scripts', 'backtest-trendmx-smoke-results.json');
/* the files index.html loads that the desk's row/gate/plan chain reads, in load order */
export const STACK = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'cryptogates.js', 'plans.js', 'hg-forward.js', 'setup-ui.js', 'trendtable.combined.js'];
export const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'LTCUSDT', 'NEARUSDT'];
export const HORIZON_BARS = 20;      /* the desk's own: hgFwdRecordScan('TRENDMX', '4h', ..., { horizonBars: 20 }) */
export const TM_LIMIT_LIFE = 6;      /* the desk's own: "the limit dies if it is not tagged within 6 four-hour bars" */
export const WIN_4H = 260, WIN_1D = 260, MIN_4H = 210;   /* what trendmxScanCore fetches and demands */
export const COST_FRAC = 2 * 0.0010;
const SEC4 = 14400, SEC1D = 86400;

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };

/* ---------- bars ---------- */
async function jget(url){ const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-trendmx-backtest/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url); return r.json(); }
export async function fetchKlines(symbol, interval, target, getJson){
  getJson = getJson || jget;
  const ivMs = (interval === '1d' ? SEC1D : SEC4) * 1000; let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    const params = { symbol, interval, limit: lim };
    if (endTime) params.endTime = endTime;
    const batch = await getJson(klinesUrl(params).url); if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out); endTime = batch[0][0] - 1; if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out.filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })).sort((a, b) => a.t - b.t);
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();   /* the forming bar never counts */
  return rows;
}
export async function cachedKlines(symbol, interval, target, o){
  o = o || {};
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (!o.refresh && fs.existsSync(file)){
    try{ const j = JSON.parse(fs.readFileSync(file, 'utf8')); const ageH = (Date.now() - j.fetchedAt) / 3.6e6;
      if (j.rows && j.rows.length >= target && ageH < 96){ (o.log || console.log)('  cache hit ' + symbol + ' ' + interval + ': ' + j.rows.length + ' bars (' + ageH.toFixed(1) + 'h old)'); return j.rows.slice(-target); } }catch(e){}
  }
  (o.log || console.log)('  fetching ' + symbol + ' ' + interval + ' x' + target + ' ...');
  const rows = await fetchKlines(symbol, interval, target, o.getJson);
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, target, rows }));
  return rows;
}

/* ---------- the desk, booted ---------- */
export function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild(){} }, addEventListener(){} };
  const store = {}; s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  vm.createContext(s);
  for (const f of STACK) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), s, { filename: f });
  for (const fn of ['trendScore', 'tmDirOf', 'trendmxGateEval', 'trendmxConviction', 'trendmxPlan', 'trendmxRowTier', 'tmRecordReads', 'tmTicketClaim', 'trendmxPerfectState', 'trendmxChopState', 'tmValidSetup'])
    if (typeof s[fn] !== 'function') throw new Error('boot failed: ' + fn + ' missing -- the desk must export it for the walk to call it');
  return s;
}

/* ---------- 1. the row the scan would have built on bar i ---------- */
/* daily bars CLOSED by the 4h bar's close: open + 1d <= close of the 4h bar */
export function dailyClosedBy(d1, closeSec){
  const out = [];
  for (let i = 0; i < d1.length; i++){ if (d1[i].t + SEC1D <= closeSec) out.push(d1[i]); else break; }
  return out.slice(-WIN_1D);
}
export function buildRow(W, sym, h4, d1, i){
  const rows4h = h4.slice(Math.max(0, i - WIN_4H + 1), i + 1);
  if (rows4h.length < MIN_4H) return null;
  const closeSec = h4[i].t + SEC4;
  const rows1d = dailyClosedBy(d1, closeSec);
  if (!rows1d.length) return null;
  const ts = W.trendScore(rows1d, rows4h);
  return {
    sym, base: sym.replace(/USDT$/, ''), exchange: 'binance',
    score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx, rsi: ts.rsi, volDiv: ts.volDiv, volConf: ts.volConf,
    price: rows4h[rows4h.length - 1].c, rows4h, rows1d, rows1h: null, fundingPct: null, turnoverUsd: null, mark: null
  };
}
/* the candidate the desk's class partition (trendmxLimitClasses) would have kept on this bar, or the reason it would not */
export function candidateOf(W, row){
  const dir = W.tmDirOf(row);
  if (!dir) return { skip: 'noDir' };
  row.gate = W.trendmxGateEval(row, dir);
  if (!row.gate || row.gate.veto) return { skip: row.gate ? 'gateVeto' : 'noGate' };
  const isClean = !!row.gate.clean7;
  const conv = isClean ? null : W.trendmxConviction(row);
  if (!isClean && !conv) return { skip: 'noConviction' };
  const plan = W.trendmxPlan(Object.assign({}, row, { dir }));
  if (!W.tmValidSetup(plan)) return { skip: 'noPlan' };
  const tier = W.trendmxRowTier(row, plan);
  const chop = W.trendmxChopState(row);
  let heldBy = null;
  if (W.trendmxMomState(row, dir) === 'against') heldBy = 'mom';
  else if (W.trendmxVolState(row, dir) === 'against') heldBy = 'vol';
  else if (chop && chop.state === 'chop') heldBy = 'chop';
  return {
    sym: row.sym, dir, isClean, mechanic: isClean ? 'TM-CLEAN7' : 'TM-CONVICTION', convTier: conv ? conv.tier : null,
    gatesPassed: row.gate.gatesPassed, tier, ticket: W.tmTicketClaim(row, plan), heldBy,
    score: row.score, comps: Object.assign({}, row.comps), adx: row.adx, rsi: row.rsi, freshCross: row.freshCross,
    volDiv: row.volDiv, volConf: row.volConf, chop: chop ? chop.chop : null, er: chop ? chop.er : null,
    perfect: !!W.trendmxPerfectState(row),
    reads: W.tmRecordReads(row, dir) || {},
    entry: +plan.entry, stop: +plan.stop, t1: +plan.t1, t2: isFinite(+plan.t2) ? +plan.t2 : null, mark: isFinite(+plan.mark) ? +plan.mark : +row.price,
    entryType: plan.entryType || (Math.abs(+plan.entry - +row.price) / +row.price < 5e-4 ? 'MARKET' : 'LIMIT'),
    planSrc: plan.planSrc || null
  };
}
export function scanSymbol(W, sym, h4, d1, o){
  const cands = [], skips = { noDir: 0, noGate: 0, gateVeto: 0, noConviction: 0, noPlan: 0 };
  const from = Math.max(MIN_4H - 1, (o && o.from) || 0);
  for (let i = from; i < h4.length - 1; i++){
    const row = buildRow(W, sym, h4, d1, i);
    if (!row) continue;
    const c = candidateOf(W, row);
    if (c.skip){ skips[c.skip]++; continue; }
    c.i = i; c.tISO = new Date((h4[i].t + SEC4) * 1000).toISOString(); c.barT = h4[i].t;
    cands.push(c);
  }
  return { cands, skips };
}

/* ---------- 2. the walk: fill, then settle, one position per symbol+dir ---------- */
export function walkCandidates(cands, h4, o){
  const horizon = (o && o.horizonBars) || HORIZON_BARS, life = (o && o.limitLife) || TM_LIMIT_LIFE, cost = (o && typeof o.costFrac === 'number') ? o.costFrac : COST_FRAC;
  const trades = [], live = { long: null, short: null }, counters = { candidates: cands.length, fired: 0, merged: 0, unfilled: 0, unpriced: 0 };
  const byBar = {};
  for (const c of cands) (byBar[c.i] = byBar[c.i] || []).push(c);
  /* R is in PLAN-risk units (|plan entry - plan stop|), the forward ledger's own
     denominator (hg-v980 judges on the plan's levels): the gap between the plan
     entry and the price the walk actually got rides as fillSlipR, so a market
     fill that opened against the plan is a worse trade, never a smaller risk.
     Re-basing risk on the fill would let a fill near the stop read as a 50R
     loss and a 6R cost -- the first cut did exactly that. */
  const settle = (tr, bi, outcome, rGross, bothTouch) => {
    tr.outcome = outcome; tr.exitIdx = bi; tr.exitBars = bi - tr.fillIdx; tr.rMultiple = rGross; tr.bothTouch = !!bothTouch;
    tr.costR = (tr.entry * cost) / tr.riskPlan;
    tr.netR = rGross - tr.costR;
    delete tr.state; trades.push(tr); live[tr.dir] = null;
  };
  const first = cands.length ? Math.min.apply(null, cands.map(c => c.i)) : h4.length;
  /* a candidate registers on its own bar (nothing is live there yet) and fills from the next */
  for (let bi = first; bi < h4.length; bi++){
    const bar = h4[bi];
    for (const dir of ['long', 'short']){
      const tr = live[dir]; if (!tr) continue;
      if (tr.state === 'pending'){
        if (tr.entryType === 'MARKET'){ tr.fillIdx = bi; tr.fillPx = bar.o; tr.state = 'filled'; }
        else {
          const touched = dir === 'long' ? bar.l <= tr.entry : bar.h >= tr.entry;
          if (touched){ tr.fillIdx = bi; tr.fillPx = tr.entry; tr.state = 'filled'; }
          else if (bi - tr.sigIdx >= life){ counters.unfilled++; tr.outcome = 'unfilled'; delete tr.state; trades.push(tr); live[dir] = null; continue; }
          else continue;
        }
        tr.fillBars = tr.fillIdx - tr.sigIdx;
      }
      const risk = tr.riskPlan;
      if (!(risk > 0) || !isFinite(tr.fillPx)){ counters.unpriced++; tr.outcome = 'unpriced'; delete tr.state; trades.push(tr); live[dir] = null; continue; }
      const sgn = dir === 'long' ? 1 : -1;
      if (tr.fillSlipR == null) tr.fillSlipR = sgn * (tr.fillPx - tr.entry) / risk;   /* + paid up, - got a better price */
      const rOf = (px) => sgn * (px - tr.fillPx) / risk;
      const hitStop = dir === 'long' ? bar.l <= tr.stop : bar.h >= tr.stop;
      const hitT1 = dir === 'long' ? bar.h >= tr.t1 : bar.l <= tr.t1;
      if (hitStop && hitT1) settle(tr, bi, 'stop', rOf(tr.stop), true);
      else if (hitStop) settle(tr, bi, 'stop', rOf(tr.stop));
      else if (hitT1) settle(tr, bi, 'target', rOf(tr.t1));
      else if (bi - tr.fillIdx >= horizon) settle(tr, bi, 'timeout', rOf(bar.c));
    }
    const here = byBar[bi] || [];
    for (const c of here){
      counters.fired++;
      if (live[c.dir]){ counters.merged++; continue; }
      live[c.dir] = Object.assign({}, c, { sigIdx: bi, state: 'pending', fillIdx: null, fillPx: null, riskPlan: Math.abs(c.entry - c.stop) });
    }
  }
  return { trades, counters };
}
/* hg-v990: a trade the walk would write with no geometry is a harness defect, fatal before the write */
export function assertPriced(trades){
  const bad = (trades || []).filter(t => t && t.outcome !== 'unfilled' && (t.outcome === 'unpriced' || !isFinite(t.entry) || !isFinite(t.stop) || !isFinite(t.t1) || !(Math.abs(t.entry - t.stop) > 0))).length;
  if (bad > 0) throw new Error('TREND MATRIX walk: ' + bad + ' trade(s) carried no usable geometry -- a harness defect, not a market outcome. Nothing written.');
  return 0;
}
export function agg(trades){
  const s = trades.filter(t => t.outcome === 'target' || t.outcome === 'stop' || t.outcome === 'timeout');
  if (!s.length) return { n: 0, win: null, gross: null, net: null, bothTouch: 0 };
  let w = 0, g = 0, net = 0, bt = 0;
  for (const t of s){ if (t.outcome === 'target') w++; g += t.outcome === 'timeout' ? 0 : t.rMultiple; net += t.netR; if (t.bothTouch) bt++; }
  return { n: s.length, win: w / s.length, gross: g / s.length, net: net / s.length, bothTouch: bt };
}

/* ---------- 3. run ---------- */
export async function run(o){
  o = o || {};
  const W = o.W || boot();
  const symbols = o.symbols || DEFAULT_SYMBOLS;
  const bars = o.bars || 2200;
  const log = o.log || console.log;
  const fetchRows = o.fetchRows || ((sym, tf, n) => cachedKlines(sym, tf, n, { refresh: o.refresh, getJson: o.getJson, log }));
  const all = [], perSym = {}, skipsAll = { noDir: 0, noGate: 0, gateVeto: 0, noConviction: 0, noPlan: 0 };
  let counters = { candidates: 0, fired: 0, merged: 0, unfilled: 0, unpriced: 0 };
  for (const sym of symbols){
    let h4, d1;
    try{ h4 = await fetchRows(sym, '4h', bars); d1 = await fetchRows(sym, '1d', Math.ceil(bars / 6) + WIN_1D); }
    catch(e){ log('  ' + sym + ': bars unavailable -- ' + (e && e.message || e)); perSym[sym] = { error: String(e && e.message || e) }; continue; }
    if (!h4 || h4.length < MIN_4H + 2 || !d1 || !d1.length){ perSym[sym] = { error: 'too few bars', h4: h4 ? h4.length : 0, d1: d1 ? d1.length : 0 }; continue; }
    const { cands, skips } = scanSymbol(W, sym, h4, d1);
    const { trades, counters: c } = walkCandidates(cands, h4, { horizonBars: HORIZON_BARS });
    for (const k in skips) skipsAll[k] += skips[k];
    for (const k in c) counters[k] += c[k];
    for (const t of trades){ delete t.i; delete t.sigIdx; delete t.fillIdx; delete t.exitIdx; all.push(t); }
    perSym[sym] = { h4: h4.length, d1: d1.length, span: [new Date(h4[0].t * 1000).toISOString().slice(0, 10), new Date(h4[h4.length - 1].t * 1000).toISOString().slice(0, 10)], candidates: cands.length, trades: trades.length, skips };
    log('  ' + sym + ': ' + h4.length + ' x 4h, ' + cands.length + ' candidates, ' + trades.length + ' positions');
  }
  /* a walk that fetched no bars at all walked nothing: refuse to write an artifact that would read as a measured empty book */
  if (!Object.keys(perSym).some(k => !perSym[k].error)) throw new Error('TREND MATRIX walk: no symbol yielded bars (' + (o.route || klinesRouteNote()) + ') -- nothing walked, nothing written');
  assertPriced(all);
  const settled = all.filter(t => t.outcome !== 'unfilled');
  const span = settled.length ? [settled.reduce((a, t) => t.tISO < a ? t.tISO : a, settled[0].tISO).slice(0, 10), settled.reduce((a, t) => t.tISO > a ? t.tISO : a, settled[0].tISO).slice(0, 10)] : null;
  return {
    meta: {
      generated: new Date().toISOString(), desk: 'TRENDMX', mode: o.smoke ? 'smoke' : 'full', symbols, bars, route: o.route || klinesRouteNote(),
      horizonBars: HORIZON_BARS, limitLife: TM_LIMIT_LIFE, costs: { binanceSpotRt: COST_FRAC }, span,
      candidates: counters.candidates, fired: counters.fired, merged: counters.merged, unfilled: counters.unfilled, unpriced: counters.unpriced, skips: skipsAll,
      perSymbol: perSym,
      forwardOnlyReads: ['takerFlowWith', 'fundWith', 'postgate:veto'],
      limitations: [
        'SPOT BARS FOR A PERP DESK: Binance spot klines stand in for the perp tapes the desk reads; funding is not modelled and fundingPct is null on every row.',
        'THREE READS ARE FORWARD-ONLY: the taker-flow witness, the fundamental + sentiment witness and the SWING post-gate rule read live feeds no bar archive carries; their marks are absent on every replay row and only the forward ledger measures them.',
        'STOP-FIRST ON A BOTH-TOUCH BAR: a 4h bar that trades through stop and target is settled as the stop (the lower bound, hg-v918); bothTouch flags those rows so the other bound can be read.',
        'ONE POSITION PER SYMBOL AND DIRECTION: a candidate the desk re-forms while the first is open is merged, so n counts positions, not the per-bar records the forward ledger keeps.',
        'NO BTC-STRUCTURE MACRO: tmAltLongBlockedByBtc reads a macro snapshot the replay does not build, so no alt long is blocked by it here.'
      ]
    },
    aggregates: { all: agg(settled), clean7: agg(settled.filter(t => t.isClean)), conviction: agg(settled.filter(t => !t.isClean)), ticket: agg(settled.filter(t => t.ticket === true)), held: agg(settled.filter(t => t.heldBy)) },
    trades: all
  };
}

/* the artifact lands in scripts/ and nowhere else; a smoke run never overwrites the full artifact */
export function resolveOut(outArg, smoke){
  if (!outArg) return smoke ? SMOKE_ARTIFACT : ARTIFACT;
  const p = path.resolve(ROOT, outArg);
  if (!p.startsWith(path.join(ROOT, 'scripts') + path.sep)) throw new Error('--out must stay inside scripts/: ' + outArg);
  if (smoke && p === ARTIFACT) throw new Error('a smoke run may not overwrite the full artifact');
  return p;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const smoke = has('--smoke');
  const out = resolveOut(opt('--out', null), smoke);
  if (has('--print-out')){ console.log(out); process.exit(0); }
  console.log('TREND MATRIX replay -- ' + klinesRouteNote());
  const symbols = opt('--symbols', null) ? opt('--symbols', '').split(',').map(s => s.trim()).filter(Boolean) : (smoke ? DEFAULT_SYMBOLS.slice(0, 2) : DEFAULT_SYMBOLS);
  run({ smoke, symbols, bars: +opt('--bars', smoke ? 600 : 2200), refresh: has('--refresh') }).then(res => {
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    const a = res.aggregates.all;
    console.log('\nsettled ' + a.n + (a.n ? ' · win ' + (100 * a.win).toFixed(1) + '% · gross ' + a.gross.toFixed(3) + 'R · net ' + a.net.toFixed(3) + 'R · both-touch ' + a.bothTouch : ''));
    console.log('written: ' + out);
  }).catch(e => { console.error('FATAL: ' + (e && e.message || e)); process.exit(1); });
}
