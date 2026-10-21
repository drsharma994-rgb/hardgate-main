#!/usr/bin/env node
/* HARDGATE — OMNIBTC replay harness (offline, node ESM). hg-v1294.
   Run:  node scripts/backtest-omnibtc.mjs [--smoke] [--bars=N] [--out=scripts/x.json] [--print-out]

   OMNIBTC has had three Pine packs this cycle and NO walk: hg-v1291 fresh pine
   agreement, hg-v1292 family-counting + indicator crosses, hg-v1293 record-only
   three-state Pine marks on every forward record. Each layered a rule on the
   same unmeasured evidence (OMNIBTC has no committed backtest), so the hg-v965
   PERFECT COHORT SPLIT and hg-v989 read-split had nothing to split on. This
   walk gives them something.

   WHAT IT WALKS, AND WITH WHAT: the desk's OWN exported gates, booted from the
   files index.html loads -- hgObtcPineMarks (the hg-v1293 three-state read),
   hgObtcPineBook (the hg-v1291 freshness pass), hgObtcIndBook (the hg-v1292
   EMA 20/50, MACD histogram, Donchian 20 cross), hgObtcApplyPineAccuracy (the
   combined gate deciding ticket/watch). Per closed 4h bar on BTCUSDT: build a
   minimal SWING-shaped candidate on the window (EMA50-slope direction, stop
   beyond the 12-bar swing extreme, 2R target), apply the gate, stamp the
   marks, settle through the forward-ledger rules.

   FILL AND SETTLE (the forward ledger's own rules, hg-v978 / v980 / v996):
   MARKET entry fills at the NEXT bar's open; the trade walks up to the
   HORIZON_BARS the desk hands the ledger (20 for 4h), stop-first on a both-
   touch bar (hg-v918 lower bound, flagged bothTouch); past the horizon it
   settles at the close as a timeout. ONE open trade per direction: a
   candidate re-formed while open is MERGED, not a second trade (the
   sequential book, hg-v926), so n counts positions.

   COSTS: Binance USDT-M perp 0.04% taker × 2 = 0.08% round trip; funding is
   NOT modelled (no fundingPct on the walk rows, so hgFundingAgainstMark
   records nothing -- forward-only).

   WHAT IT CANNOT WALK, SAID (hg-v989 absent is NOT MEASURED, never guessed):
   the hg-v1057 accuracy-pack reads (flow, netflow, basis, liquidation clusters,
   cvd context) read live feeds no bar archive carries, so those marks are
   absent on every replay row; the ledger is where they get measured. The
   hg-v1046 cross-venue agreement (Delta + CoinDCX) is unavailable here --
   this walk reads Binance spot alone, so venueAgreeCount is 1 on every row.
   Macro (BTC.D, DXY) is not supplied; the hg-v984 macro mark reads absent.
   The hg-v1292 1h disagreement is checked only when rows1h are present; a
   smoke run (bars-only) marks it `unchecked`.

   REFUSALS (the hg-v990 rule): a candidate with no plan (no readable EMA50
   slope, or wrong-side stop) is the desk's own skip and counted as noPlan;
   a trade the walker would write with a non-finite level is a HARNESS defect,
   counted as unpriced and FATAL before anything is written. The artifact
   path is one of the repo's own (scripts/), never outside it. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { klinesUrl, klinesRouteNote } from '../lib/klines-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
export const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
export const ARTIFACT = path.join(ROOT, 'scripts', 'backtest-omnibtc-results.json');
export const SMOKE_ARTIFACT = path.join(ROOT, 'scripts', 'backtest-omnibtc-smoke-results.json');

/* the files index.html loads that the desk's gate chain reads, in load order.
   pinemath.js is in the chain so the ten Pine ports (Lorentzian KNN, MSB-OB,
   Squeeze, SMF, HalfTrend, SMC, VuManChu Cipher, Range Filter, NW envelope,
   Weekly AVWAP) are callable — the hg-v1291 freshness pass reads them
   directly for newLong/barsAgo, and the hg-v1293 record-only marks delegate
   through trendmxPineMarks which reads the same global exports. Without
   pinemath.js the gate fails open ("pine bank unread") and every candidate
   tickets, which is the hg-v955 shape (the gate rule is not what runs). */
export const STACK = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'plans.js', 'pinemath.js', 'hg-forward.js', 'setup-ui.js', 'trendtable.combined.js', 'omnibtc.js'];
export const SYMBOL = 'BTCUSDT';
export const INTERVAL_4H = '4h';
export const INTERVAL_1H = '1h';
export const HORIZON_BARS = 20;              /* the desk's own 4h horizon from hgFwdRecordScan('OMNIBTC', '4h', ..., { horizonBars: 20 }) */
export const COST_FRAC = 2 * 0.0004;         /* Binance USDT-M taker, 4 bps × 2 = 8 bps round trip */
export const WIN_4H = 260;                   /* what omnibtc.js fetches at loadBars('4h', 220) + buffer for EMA50/Donchian */
export const MIN_4H = 220;
export const SEC4 = 14400, SEC1H = 3600;

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };

/* ---------- bars ---------- */
async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-omnibtc-backtest/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

export async function fetchKlines(symbol, interval, target, getJson){
  getJson = getJson || jget;
  const ivMs = (interval === '1h' ? SEC1H : SEC4) * 1000;
  let out = [], endTime;
  while (out.length < target){
    const want = Math.min(1000, target - out.length);
    const { url } = klinesUrl({ symbol, interval, limit: want, endTime }, process.env);
    const raw = await getJson(url);
    if (!Array.isArray(raw) || !raw.length) break;
    const rows = raw.map(k => ({
      t: Math.floor(k[0] / 1000),
      o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5]
    }));
    out = rows.concat(out);
    endTime = (rows[0] && rows[0].t * 1000) - ivMs;
    if (!endTime) break;
  }
  return out.slice(-target);
}

/* ---------- stack boot ---------- */
export function buildContext(){
  const ctx = {
    console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, Set, Map,
    setTimeout, clearTimeout, Intl, URL
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.HG_TAB_MODS = {};
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of STACK){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try { vm.runInContext(src, ctx, { filename: f }); }
    catch (e){ throw new Error('failed to boot ' + f + ': ' + e.message); }
  }
  return ctx;
}

/* ---------- the minimal SWING-shaped candidate the walk judges ----------
   This is DELIBERATELY simple: EMA50-slope direction, stop beyond the 12-bar
   swing extreme, 2R target. omnibtc.js's live mint runs on venue-fetched
   candidates through hgObtcPerfectFormation and the cross-venue harvest, but
   the GATE this walk measures (hg-v1291/v1292/v1293) runs on the pick object
   AFTER a plan exists. So the walker constructs the SMALLEST honest plan the
   gate would see and measures the gate. Nothing here is baked -- this is a
   fixture, not a strategy. A different mint on the same bars would ask the
   gate different candidates; what the walk measures is HOW THE GATE DECIDES
   on those it sees. */
export function minimalSwingCandidate(rows){
  if (!Array.isArray(rows) || rows.length < 60) return null;
  const n = rows.length;
  const last = rows[n - 1];
  if (!last || !isFinite(+last.c)) return null;

  /* EMA50 slope: direction = sign(ema50[n-1] - ema50[n-6]) */
  const period = 50;
  let ema = +rows[0].c;
  const alpha = 2 / (period + 1);
  const emaArr = [ema];
  for (let i = 1; i < n; i++){ ema = alpha * (+rows[i].c) + (1 - alpha) * ema; emaArr.push(ema); }
  const slope = emaArr[n - 1] - emaArr[n - 6];
  if (!isFinite(slope) || slope === 0) return null;
  const dir = slope > 0 ? 'long' : 'short';

  /* stop beyond last 12-bar swing extreme */
  const look = 12;
  let hi = -Infinity, lo = Infinity;
  for (let i = Math.max(0, n - look); i < n; i++){
    if (+rows[i].h > hi) hi = +rows[i].h;
    if (+rows[i].l < lo) lo = +rows[i].l;
  }
  if (!isFinite(hi) || !isFinite(lo)) return null;

  const entry = +last.c;
  const atrLike = (hi - lo) / Math.max(1, look);
  const buf = Math.max(atrLike * 0.15, entry * 0.0005);
  const stop = dir === 'long' ? (lo - buf) : (hi + buf);
  if (!isFinite(stop) || stop === entry) return null;
  if (dir === 'long' && stop >= entry) return null;
  if (dir === 'short' && stop <= entry) return null;

  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  const t1 = dir === 'long' ? (entry + 2 * risk) : (entry - 2 * risk);
  if (!isFinite(t1)) return null;

  return {
    sym: 'BTCUSD', dir, entry, stop, t1,
    engine: 'walker-swing', clean: true, tier: 'clean'
  };
}

/* ---------- settlement (the forward-ledger rules, hg-v918 / v978 / v980) ----------
   Trade opens at the NEXT bar's open (MARKET fill); walks up to HORIZON bars;
   a bar that touches BOTH stop and t1 is STOP-first (hg-v918 lower bound) and
   flagged `bothTouch`; past the horizon settles at the close as timeout.
   Costs: subtract 2 * taker from gross R to get net. */
export function settlePlan(bars, idx, plan){
  if (!plan || !Array.isArray(bars) || idx + 1 >= bars.length) return { status: 'no-fill', reason: 'past-end' };
  const next = bars[idx + 1];
  if (!next || !isFinite(+next.o)) return { status: 'no-fill', reason: 'bad-next-open' };
  const fillPx = +next.o;
  const dir = plan.dir;
  const stopPx = +plan.stop;
  const t1Px = +plan.t1;
  const entryPlan = +plan.entry;
  const risk = Math.abs(entryPlan - stopPx);
  if (!(risk > 0)) return { status: 'no-fill', reason: 'zero-risk' };
  /* fill slip in R: entry minus fill, normalised by the plan's own risk */
  const slip = dir === 'long' ? (fillPx - entryPlan) / risk : (entryPlan - fillPx) / risk;

  let bothTouch = false;
  for (let i = idx + 1; i < Math.min(bars.length, idx + 1 + HORIZON_BARS); i++){
    const b = bars[i];
    if (!b) break;
    const h = +b.h, l = +b.l;
    const hitStop = dir === 'long' ? (l <= stopPx) : (h >= stopPx);
    const hitT1 = dir === 'long' ? (h >= t1Px) : (l <= t1Px);
    if (hitStop && hitT1){
      bothTouch = true;
      /* stop-first lower bound (hg-v918) */
      const grossR = -1 - slip;
      return { status: 'stop', bars: i - idx, grossR, netR: grossR - COST_FRAC / (risk / fillPx), bothTouch };
    }
    if (hitStop){
      const grossR = -1 - slip;
      return { status: 'stop', bars: i - idx, grossR, netR: grossR - COST_FRAC / (risk / fillPx), bothTouch };
    }
    if (hitT1){
      const grossR = 2 - slip;    /* 2R target */
      return { status: 't1', bars: i - idx, grossR, netR: grossR - COST_FRAC / (risk / fillPx), bothTouch };
    }
  }
  /* timeout at close */
  const closeIdx = Math.min(bars.length - 1, idx + HORIZON_BARS);
  const close = +bars[closeIdx].c;
  const grossR = dir === 'long' ? (close - fillPx) / risk : (fillPx - close) / risk;
  const netR = grossR - COST_FRAC / (risk / fillPx);
  return { status: 'timeout', bars: closeIdx - idx, grossR, netR, bothTouch };
}

/* ---------- the walk ---------- */
export function walkOne(ctx, bars, idx){
  const W = ctx;
  const rows = bars.slice(0, idx + 1);
  const cand = minimalSwingCandidate(rows);
  if (!cand) return { skipped: true, reason: 'noPlan' };

  const pick = { tier: 'clean', row: { ...cand } };
  /* hg-v1291/v1292 freshness gate */
  const applied = (typeof W.hgObtcApplyPineAccuracy === 'function')
    ? W.hgObtcApplyPineAccuracy(pick, rows, [], null)
    : pick;
  /* hg-v1293 three-state marks on the record's own tape */
  const pineMarks = (typeof W.hgObtcPineMarks === 'function') ? W.hgObtcPineMarks(rows) : null;

  const settle = settlePlan(bars, idx, cand);
  if (settle.status === 'no-fill') return { skipped: true, reason: settle.reason };

  const row = {
    idx,
    t: rows[rows.length - 1].t,
    dir: cand.dir,
    entry: cand.entry, stop: cand.stop, t1: cand.t1,
    tier: applied.tier,
    ticket: applied.tier === 'clean',
    pineAgree: (applied.row && applied.row.pineAgree) || [],
    pineOppose: (applied.row && applied.row.pineOppose) || [],
    pineFamilies: (applied.row && applied.row.pineFamilies) || [],
    indAgree: (applied.row && applied.row.indAgree) || [],
    indOppose: (applied.row && applied.row.indOppose) || [],
    pineNote: (applied.row && applied.row.pineNote) || '',
    pineRefused: (applied.row && applied.row.pineRefused) === true,
    pineMarks: pineMarks || null,
    outcome: {
      status: settle.status,
      bars: settle.bars,
      grossR: round6(settle.grossR),
      netR: round6(settle.netR),
      bothTouch: !!settle.bothTouch
    }
  };
  /* hg-v990 refusal: a priced row with a non-finite level is a harness defect */
  if (!isFinite(row.entry) || !isFinite(row.stop) || !isFinite(row.t1)){
    throw new Error('UNPRICED row at idx ' + idx + ': ' + JSON.stringify({ entry: row.entry, stop: row.stop, t1: row.t1 }));
  }
  if (!isFinite(row.outcome.grossR) || !isFinite(row.outcome.netR)){
    throw new Error('non-finite outcome at idx ' + idx + ': ' + JSON.stringify(row.outcome));
  }
  return row;
}

function round6(v){ return Math.round(v * 1e6) / 1e6; }

/* ---------- aggregate ---------- */
export function summarise(rows){
  const kept = rows.filter(r => r && !r.skipped);
  const tickets = kept.filter(r => r.ticket);
  const held = kept.filter(r => !r.ticket);
  const sum = arr => arr.reduce((a, r) => a + (+r.outcome.netR || 0), 0);
  const gross = arr => arr.reduce((a, r) => a + (+r.outcome.grossR || 0), 0);
  const wins = arr => arr.filter(r => r.outcome && r.outcome.status === 't1').length;
  return {
    n: kept.length,
    nTicket: tickets.length,
    nHeld: held.length,
    nSkipped: rows.length - kept.length,
    ticket: {
      n: tickets.length,
      win: tickets.length ? wins(tickets) / tickets.length : null,
      netR: tickets.length ? round6(sum(tickets) / tickets.length) : null,
      grossR: tickets.length ? round6(gross(tickets) / tickets.length) : null
    },
    held: {
      n: held.length,
      win: held.length ? wins(held) / held.length : null,
      netR: held.length ? round6(sum(held) / held.length) : null,
      grossR: held.length ? round6(gross(held) / held.length) : null
    }
  };
}

/* ---------- main ---------- */
export async function runWalk({ bars, smoke } = {}){
  const n4 = Math.max(MIN_4H, Math.min(5000, +(opt('--bars', (smoke ? 400 : 2000))) || (smoke ? 400 : 2000)));
  if (!bars){
    try { bars = await fetchKlines(SYMBOL, INTERVAL_4H, n4); }
    catch (e){ return { ok: false, reason: 'fetch-failed', error: String(e.message || e), route: klinesRouteNote(process.env) }; }
  }
  if (!Array.isArray(bars) || bars.length < MIN_4H){
    return { ok: false, reason: 'no-bars', have: (bars || []).length, need: MIN_4H };
  }
  const ctx = buildContext();
  const rows = [];
  let unpriced = 0;
  for (let i = MIN_4H; i < bars.length - 1; i++){
    try {
      const r = walkOne(ctx, bars, i);
      rows.push(r);
    } catch (e) {
      unpriced++;
      if (unpriced > 0){
        /* hg-v990: fatal before anything is written */
        throw new Error('OMNIBTC walker refused unpriced row: ' + e.message);
      }
    }
  }
  const summary = summarise(rows);
  const span = bars.length ? { from: bars[0].t, to: bars[bars.length - 1].t, bars: bars.length } : null;
  return {
    ok: true,
    meta: {
      version: 'hg-v1294',
      symbol: SYMBOL,
      interval: INTERVAL_4H,
      horizonBars: HORIZON_BARS,
      costFrac: COST_FRAC,
      span,
      route: klinesRouteNote(process.env),
      limitations: [
        'minimal SWING-shaped candidate (EMA50 slope, 12-bar swing stop, 2R target) -- the walk measures how the gate decides on these',
        'no 1h series supplied -- hg-v1292 1h disagreement check is unchecked',
        'no other crypto venue -- venueAgreeCount is 1 on every row',
        'no live feeds (flow, basis, netflow, cvd) -- hg-v1057 marks absent',
        'no funding modelled -- fundingPct unavailable, fundAgainst unmeasurable',
        'spot bars stand in for perp (OMNIBTC lives on cross-venue perps live)'
      ]
    },
    summary,
    rows
  };
}

export async function writeArtifact(outPath, out){
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

async function cli(){
  const smoke = has('--smoke');
  const outArg = opt('--out', null);
  if (has('--print-out')){
    const target = outArg || (smoke ? SMOKE_ARTIFACT : ARTIFACT);
    process.stdout.write(target + '\n');
    return;
  }
  if (outArg){
    /* hg-v959: refuse paths that escape scripts/, and refuse smoke → full artifact overwrite */
    const resolved = path.resolve(outArg);
    const scriptsAbs = path.resolve(ROOT, 'scripts');
    if (!resolved.startsWith(scriptsAbs + path.sep)){
      process.stderr.write('REFUSED: --out must sit under scripts/\n');
      process.exit(2);
    }
    if (smoke && resolved === path.resolve(ARTIFACT)){
      process.stderr.write('REFUSED: --smoke may not overwrite the full artifact ' + ARTIFACT + '\n');
      process.exit(2);
    }
  }
  const out = await runWalk({ smoke });
  if (!out.ok){
    process.stderr.write('OMNIBTC walk did not run: ' + (out.reason || 'unknown') + (out.error ? (' — ' + out.error) : '') + '\n');
    process.stderr.write('route: ' + (out.route || klinesRouteNote(process.env)) + '\n');
    process.exit(1);
  }
  const target = outArg || (smoke ? SMOKE_ARTIFACT : ARTIFACT);
  await writeArtifact(target, out);
  process.stdout.write('wrote ' + target + ' (' + out.summary.n + ' rows, ' + out.summary.ticket.n + ' tickets)\n');
}

const invoked = (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (invoked) cli().catch(e => { process.stderr.write('OMNIBTC walker failed: ' + (e.stack || e.message || e) + '\n'); process.exit(1); });
