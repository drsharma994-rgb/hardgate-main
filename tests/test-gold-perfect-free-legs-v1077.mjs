/* HARDGATE — hg-v1150: THE FREE-FEED EVIDENCE LEGS ON THE GOLD RANKER.

   goldRankSetups feeds the shared PERFECT predicate (hgPerfectFormation) a
   reads bag. Before v1077 that bag carried three legs (newsRisk / sess /
   volumeRvol). The scan ALREADY fetched three more free feeds it never fed
   the predicate — zero new requests, all positioning/structure reads:

     structureTrend — EMA50/200 off the desk's own 4h tape (220 bars)
     fundingAgainst — the PAXG perp funding print (ctx.fundingRate)
     leverageState — the Delta gold-perp OI 24h change + its last funding
                     prints: RESET / EXTENDED / FLAT (house thresholds)

   Unreadable stays absent — never mint or deny on a missing feed. Evidence,
   never a gate: the legs only earn / deny the PERFECT and PERFECT+ tiers.

   Also pins the GOLD SCALP banner's additive ★ PERFECT+ badge (the shared
   hgPerfectStamp fired only when the ranker's evidence-enriched PLUS verdict
   travelled on the row).

   Run: node tests/test-gold-perfect-free-legs-v1077.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
              'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
              'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of BASE){ try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}

const W = boot();
assert(typeof W.goldRankSetups === 'function', 'goldRankSetups exported');

/* capture the reads bag the ranker hands the shared predicate */
let captured = null;
W.hgPerfectFormation = (c, reads) => { captured = reads; return { perfect: true, plus: false }; };

const T4H = 14400;
function rows(slope, n){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = 2300 + i * slope;
    out.push({ t: 1760000000 - (n - 1 - i) * T4H, o: c, h: c + 1, l: c - 1, c, v: 100 });
  }
  return out;
}
/* Delta perp OI series: {t, c} candles, 1h apart, last point now. FLAT at
   startVal for the first half, then ramping to endVal over the second — so
   the value exactly 24h ago is startVal and the measured 24h change is the
   full startVal -> endVal move. */
function oiSeries(nowSec, startVal, endVal, hours){
  const out = [];
  const n = hours;
  const half = Math.floor(n / 2);
  for (let i = 0; i < n; i++){
    const v = (i < half) ? startVal : (startVal + (endVal - startVal) * ((i - half) / (n - 1 - half)));
    out.push({ t: nowSec - (n - 1 - i) * 3600, o: v, h: v, l: v, c: v, v: 0 });
  }
  return out;
}
function fundSeries(nowSec, pct){
  const out = [];
  for (let i = 0; i < 30; i++) out.push({ t: nowSec - (29 - i) * 3600, o: pct, h: pct, l: pct, c: pct, v: 0 });
  return out;
}
const NOW = Math.floor(Date.now() / 1000);
const cand = () => ({ sym: 'XAUUSD', dir: 'long', stratKey: 'TREND', strategy: 'trend-pullback',
  entry: 2300, stop: 2290, t1: 2320, agree: 5, killzoneWeight: 0 });
const ctxOf = (over) => Object.assign({ scanner: 'GOLDSCALP', now: Date.now(),
  news: { caution: false }, rows15m: [], rows4h: [], rows1h: [] }, over || {});

console.log('== the three free-feed legs ride the reads bag ==');
{
  captured = null;
  const oi = oiSeries(NOW, 1000, 880, 48);          /* -12% over 24h+ of history */
  const fu = fundSeries(NOW, 0.01);                  /* +0.01% funding prints */
  const rk = W.goldRankSetups([cand()], ctxOf({
    rows4h: rows(2, 220),                            /* clean rising 4h tape */
    fundingRate: 0.01,
    perpNative: { oi: oi, funding: fu }
  }));
  assert(Array.isArray(rk.ranked) && rk.ranked.length === 1, 'one ranked row');
  assert(captured && captured.structureTrend === 'up', 'structureTrend reads up off the 4h EMA50/200 (rising tape)');
  assert(captured && captured.fundingAgainst === false, 'fundingAgainst reads false (PAXG +0.01% is not crowded for a long)');
  assert(captured && isFinite(captured.oiChgPct) && captured.oiChgPct <= -11.9 && captured.oiChgPct >= -12.1,
    'the OI 24h change rides the bag at ~-12% (got ' + (captured && captured.oiChgPct) + ')');
  assert(captured && captured.leverageState === 'RESET', 'OI -12%/24h reads RESET (the house deleveraging threshold)');
  assert(captured && isFinite(captured.fundLatestPct) && captured.fundLatestPct === 0.01, 'the last funding print rides the bag in percent units');
}

console.log('== the against reads ==');
{
  captured = null;
  const oi = oiSeries(NOW, 1000, 1200, 48);         /* +20% over 24h+ */
  const fu = fundSeries(NOW, 0.05);                  /* hot funding */
  W.goldRankSetups([cand()], ctxOf({
    rows4h: rows(-2, 220),                          /* falling 4h tape */
    fundingRate: 0.05,
    perpNative: { oi: oi, funding: fu }
  }));
  assert(captured && captured.structureTrend === 'down', 'a falling 4h tape reads structureTrend down');
  assert(captured && captured.fundingAgainst === true, 'PAXG funding +0.05% is crowded against a long');
  assert(captured && captured.leverageState === 'EXTENDED', 'OI +20%/24h with hot funding reads EXTENDED');
}

console.log('== honest absence: a desk that holds no feeds feeds no legs ==');
{
  captured = null;
  W.goldRankSetups([cand()], ctxOf({}));
  assert(captured && captured.structureTrend === undefined, 'no 4h tape -> structureTrend absent (never minted)');
  assert(captured && captured.fundingAgainst === undefined, 'no funding print -> fundingAgainst absent');
  assert(captured && captured.leverageState === undefined && captured.oiChgPct === undefined,
    'no perp-native payload -> the leverage cycle stays unread');
}

console.log('== the banner pins (source wiring) ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  assert(/var perfectBadge = gsxPerfect\(best\)/.test(src), 'the pinned gsxPerfect badge keeps its own semantics');
  assert(/best\.perfectPlus === true && typeof W\.hgPerfectStamp === 'function'/.test(src),
    'the PERFECT+ badge fires only on the ranker evidence-enriched PLUS verdict');
  assert(/perfectBadge \+ perfectPlusBadge/.test(src), 'the PLUS badge rides the banner eye beside the pinned badge');
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(gi.indexOf('pfReads.structureTrend') >= 0 && gi.indexOf('pfReads.fundingAgainst') >= 0,
    'the ranker feeds the structure + funding legs to the shared predicate');
  assert(gi.indexOf("pfReads.leverageState = 'RESET'") >= 0 && gi.indexOf("pfReads.leverageState = 'EXTENDED'") >= 0,
    'the ranker feeds the leverage cycle with the house thresholds');
  assert(gi.indexOf('ctx.perpNative.oi') >= 0 && gi.indexOf('ctx.perpNative.funding') >= 0,
    'the leverage leg reads the Delta gold-perp payload the scan already fetched (zero new requests)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
console.log('ALL GOLD PERFECT FREE-LEG TESTS PASSED');
