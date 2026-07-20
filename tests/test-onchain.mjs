/* HARDGATE — onchain.js unit tests (Node 18+, builtins only).
   Loads onchain.js as a classic script inside vm contexts with a `window`
   stub (exactly like the browser's <script> globals) and asserts:
     1) HG_tabs registration: {id:'onchain', label:'ON-CHAIN', mount, refresh}
        — refresh present per the house hard-refresh contract
     2) pure parsers: mempool / fees / difficulty / hashrate / tipHeight,
        incl. partial input, numeric strings, garbage -> null
     3) buildSnap: full raw -> full snap; empty raw -> 5 honest notes
     4) onchainSignal: fee-spike math (>=3x economy, boundary, zero/null
        economy), congestion thresholds (empty/normal/busy/clogged +
        boundaries), capitulation requires BOTH negative retarget AND
        falling hashrate, healthy = rising both, composite bias tally,
        evidence uses real numbers only, never throws on garbage
     5) fetch layer: 5 legs via stubbed fetch, full success, per-leg 500
        degradation with honest notes, all-legs-fail, rejecting fetch,
        fetch unavailable, 5-min cache, force bypass
     6) refresh contract: 'skipped: not run yet' cold (and does NOT fetch),
        'refreshed' when armed, 'busy' on overlap, never throws,
        'degraded: no leg succeeded' when every leg fails
     7) mount() smoke on a stub DOM + auto-fetch on first mount
   No live network. Run: node tests/test-onchain.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'onchain.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function makeCtx(extra){
  const base = {
    window: {},
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController,
    Date, JSON, Math
  };
  return vm.createContext(Object.assign(Object.create(null), base, extra || {}));
}
function loadModule(ctx){
  vm.runInContext(SRC, ctx, { filename: 'onchain.js' });
  return ctx.window;
}
function stubEl(){
  return {
    innerHTML: '', textContent: '', style: {}, disabled: false,
    firstElementChild: { style: {} },
    _kids: {},
    addEventListener(ev, fn){ this._click = fn; },
    querySelector(sel){
      if (!this._kids[sel]) this._kids[sel] = stubEl();
      return this._kids[sel];
    }
  };
}

/* ---------------- fixtures ---------------- */
const RAW_OK = {
  mempool:   { count: 42310, vsize: 25e6, total_fee: 3.2e8 },
  fees:      { fastestFee: 12, halfHourFee: 10, hourFee: 8, economyFee: 5, minimumFee: 1 },
  difficulty:{ progressPercent: 45.6, difficultyChange: 1.25,
               estimatedRetargetDate: Date.now() + 9 * 86400e3, remainingBlocks: 1100 },
  hashrate:  { hashrates: [ { timestamp: 1000, avgHashrate: 6.0e20 },
                            { timestamp: 2000, avgHashrate: 6.3e20 } ] }, // +5% w/w
  tipHeight: '850123'
};

function respFor(url, raw){
  raw = raw || RAW_OK;
  const j = body => ({ ok: true, status: 200,
    json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  if (url.indexOf('/api/mempool') !== -1)                  return Promise.resolve(j(raw.mempool));
  if (url.indexOf('/api/v1/fees/recommended') !== -1)      return Promise.resolve(j(raw.fees));
  if (url.indexOf('/api/v1/difficulty-adjustment') !== -1) return Promise.resolve(j(raw.difficulty));
  if (url.indexOf('/api/v1/mining/hashrate/1w') !== -1)    return Promise.resolve(j(raw.hashrate));
  if (url.indexOf('/api/blocks/tip/height') !== -1)        return Promise.resolve(j(raw.tipHeight));
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
}
const failResp = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => '' });

/* ======================================================================
   1) registration (fresh context, no fetch — load must never throw)
====================================================================== */
let loadErr = null;
let W;
try{
  const ctxA = makeCtx();          // deliberately NO fetch global
  W = loadModule(ctxA);
  globalThis.__ctxA = ctxA;
}catch(e){ loadErr = e; }
assert(!loadErr, 'onchain.js loads without throwing (no fetch present)' + (loadErr ? ' — got: ' + loadErr.message : ''));
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'window.HG_tabs has exactly 1 registration');
const tab = W.HG_tabs[0];
assert(tab.id === 'onchain' && tab.label === 'ON-CHAIN', 'registration id "onchain" + label "ON-CHAIN"');
assert(typeof tab.mount === 'function', 'registration carries mount()');
assert(typeof tab.refresh === 'function', 'registration carries refresh() (house hard-refresh contract)');

/* ======================================================================
   2) pure parsers
====================================================================== */
const mp = W.onchainParseMempool(RAW_OK.mempool);
assert(mp && mp.count === 42310 && mp.vsize === 25e6 && mp.totalFee === 3.2e8,
  'parseMempool: valid leg -> count/vsize/totalFee numbers');
const mpStr = W.onchainParseMempool({ count: '100', vsize: '5000000', total_fee: '250' });
assert(mpStr && mpStr.count === 100 && mpStr.vsize === 5e6 && mpStr.totalFee === 250,
  'parseMempool: numeric strings coerced');
assert(W.onchainParseMempool(null) === null && W.onchainParseMempool('x') === null
    && W.onchainParseMempool(42) === null,
  'parseMempool: null/string/number input -> null');
assert(W.onchainParseMempool({ count: 'abc' }) === null,
  'parseMempool: object with no finite fields -> null');
const mpPart = W.onchainParseMempool({ vsize: 12e6 });
assert(mpPart && mpPart.vsize === 12e6 && mpPart.count === null && mpPart.totalFee === null,
  'parseMempool: partial object kept, missing fields null (no fabrication)');

const fe = W.onchainParseFees(RAW_OK.fees);
assert(fe && fe.fastestFee === 12 && fe.halfHourFee === 10 && fe.hourFee === 8 && fe.economyFee === 5,
  'parseFees: valid leg -> all four tiers');
const fePart = W.onchainParseFees({ fastestFee: 20 });
assert(fePart && fePart.fastestFee === 20 && fePart.economyFee === null,
  'parseFees: partial leg kept, economyFee null');
assert(W.onchainParseFees({}) === null && W.onchainParseFees([1,2]) === null
    && W.onchainParseFees(undefined) === null,
  'parseFees: empty object / array / undefined -> null');

const df = W.onchainParseDifficulty(RAW_OK.difficulty);
assert(df && df.progressPercent === 45.6 && df.difficultyChange === 1.25 && df.remainingBlocks === 1100,
  'parseDifficulty: valid leg parsed (incl. positive change)');
const dfNeg = W.onchainParseDifficulty({ difficultyChange: -1.83, estimatedRetargetDate: 1.9e9 });
assert(dfNeg && dfNeg.difficultyChange === -1.83 && dfNeg.estimatedRetargetDate === 1.9e12,
  'parseDifficulty: negative change kept; seconds ETA coerced to ms');
assert(W.onchainParseDifficulty('nope') === null && W.onchainParseDifficulty({}) === null,
  'parseDifficulty: garbage -> null');

const hr = W.onchainParseHashrate(RAW_OK.hashrate);
assert(hr && hr.points === 2 && hr.first === 6.0e20 && hr.last === 6.3e20 && Math.abs(hr.trendPct - 5) < 1e-9,
  'parseHashrate: two points -> first/last/+5% w/w trend');
const hrUnsorted = W.onchainParseHashrate({ hashrates: [ { timestamp: 2000, avgHashrate: 6.3e20 },
                                                         { timestamp: 1000, avgHashrate: 6.0e20 } ] });
assert(hrUnsorted && hrUnsorted.trendPct > 0,
  'parseHashrate: out-of-order timestamps sorted before trending');
const hr1 = W.onchainParseHashrate({ hashrates: [ { timestamp: 1, avgHashrate: 6e20 } ] });
assert(hr1 && hr1.points === 1 && hr1.trendPct === 0,
  'parseHashrate: single point -> trend 0 (flat, not fabricated)');
assert(W.onchainParseHashrate({ hashrates: [] }) === null
    && W.onchainParseHashrate({ hashrates: [ { timestamp: 1 } ] }) === null
    && W.onchainParseHashrate(null) === null,
  'parseHashrate: empty/invalid/missing -> null');

assert(W.onchainParseTipHeight('850123') === 850123 && W.onchainParseTipHeight(850124) === 850124,
  'parseTipHeight: bare numeric string or number accepted');
assert(W.onchainParseTipHeight('soon™') === null && W.onchainParseTipHeight({ h: 1 }) === null,
  'parseTipHeight: garbage/object -> null');

/* ======================================================================
   3) buildSnap
====================================================================== */
const snapOk = W.onchainBuildSnap(RAW_OK);
assert(snapOk.mempool && snapOk.fees && snapOk.difficulty && snapOk.hashrate
    && snapOk.tipHeight === 850123 && snapOk.notes.length === 0,
  'buildSnap: full raw -> all legs parsed, zero notes');
const snapEmpty = W.onchainBuildSnap({});
assert(!snapEmpty.mempool && !snapEmpty.fees && !snapEmpty.difficulty && !snapEmpty.hashrate
    && snapEmpty.tipHeight === null && snapEmpty.notes.length === 5,
  'buildSnap: empty raw -> all legs null + 5 honest notes');
const snapPart = W.onchainBuildSnap({ mempool: RAW_OK.mempool, fees: null });
assert(snapPart.mempool && !snapPart.fees && snapPart.notes.length === 4,
  'buildSnap: partial raw degrades per leg');

/* ======================================================================
   4) onchainSignal — pure logic branches
====================================================================== */
function sigFor(raw){ return W.onchainSignal(W.onchainBuildSnap(raw)); }

/* congestion thresholds */
assert(sigFor({ mempool: { vsize: 5e6 } }).flags.congestion === 'empty',
  'congestion: 5 MvB -> empty');
assert(sigFor({ mempool: { vsize: 10e6 } }).flags.congestion === 'normal',
  'congestion: exactly 10 MvB -> normal (boundary)');
assert(sigFor({ mempool: { vsize: 100e6 } }).flags.congestion === 'busy',
  'congestion: 100 MvB -> busy');
assert(sigFor({ mempool: { vsize: 150e6 } }).flags.congestion === 'clogged',
  'congestion: exactly 150 MvB -> clogged (boundary)');
assert(W.onchainCongestion(-1) === null && W.onchainCongestion('x') === null,
  'congestionOf: negative/garbage -> null');

/* fee spike math */
assert(sigFor({ fees: { fastestFee: 9, economyFee: 3 } }).flags.feeSpike === true,
  'fee spike: fastest exactly 3x economy -> spike (>= boundary)');
assert(sigFor({ fees: { fastestFee: 8.9, economyFee: 3 } }).flags.feeSpike === false,
  'fee spike: fastest 2.97x economy -> no spike');
assert(sigFor({ fees: { fastestFee: 50, economyFee: 0 } }).flags.feeSpike === false,
  'fee spike: economy 0 -> no spike, no divide-by-zero');
assert(sigFor({ fees: null }).flags.feeSpike === false,
  'fee spike: fees leg missing -> flag false');
const spikeSig = sigFor({ fees: { fastestFee: 12, economyFee: 4 } });
assert(spikeSig.flags.feeSpike === true
    && spikeSig.evidence.some(e => e.side === 'bear' && e.text.indexOf('12 sat/vB') !== -1 && e.text.indexOf('4 sat/vB') !== -1),
  'fee spike evidence cites the REAL tier numbers (12 and 4 sat/vB)');

/* capitulation: BOTH conditions required */
const capRaw = { difficulty: { difficultyChange: -1.2 }, hashrate: { hashrates: [ { timestamp: 1, avgHashrate: 6.3e20 }, { timestamp: 2, avgHashrate: 6.0e20 } ] } }; // -4.76%
assert(sigFor(capRaw).flags.capitulation === true,
  'capitulation: negative retarget AND falling hashrate -> true');
assert(sigFor({ difficulty: { difficultyChange: -1.2 }, hashrate: RAW_OK.hashrate }).flags.capitulation === false,
  'capitulation: negative retarget but RISING hashrate -> false');
assert(sigFor({ difficulty: { difficultyChange: 1.2 }, hashrate: capRaw.hashrate }).flags.capitulation === false,
  'capitulation: falling hashrate but POSITIVE retarget -> false');
const flatHr = { hashrates: [ { timestamp: 1, avgHashrate: 6.0e20 }, { timestamp: 2, avgHashrate: 6.02e20 } ] }; // +0.33%
assert(sigFor({ difficulty: { difficultyChange: -1.2 }, hashrate: flatHr }).flags.capitulation === false,
  'capitulation: flat hashrate (+0.33%, inside ±1% band) -> false');
assert(sigFor({ difficulty: { difficultyChange: -1.2 } }).flags.capitulation === false,
  'capitulation: hashrate leg missing -> false (both conditions required)');

/* healthy miners */
const healthySig = sigFor({ difficulty: RAW_OK.difficulty, hashrate: RAW_OK.hashrate });
assert(healthySig.healthyMiners === true && healthySig.flags.capitulation === false,
  'healthy: positive retarget AND rising hashrate -> healthyMiners true');

/* composite bias tally */
assert(sigFor(capRaw).bias === 'bullish',
  'bias: capitulation watch alone -> bullish (contrarian accumulation)');
assert(healthySig.bias === 'bullish',
  'bias: healthy miners alone -> bullish');
assert(sigFor({ fees: { fastestFee: 12, economyFee: 4 } }).bias === 'bearish',
  'bias: fee spike alone -> bearish');
assert(sigFor({ mempool: { vsize: 200e6 } }).bias === 'bearish',
  'bias: clogged mempool alone -> bearish');
assert(sigFor({ mempool: { vsize: 5e6 } }).bias === 'neutral',
  'bias: empty mempool alone -> neutral (info evidence only)');
const mixed = sigFor({ fees: { fastestFee: 12, economyFee: 4 },
                       difficulty: capRaw.difficulty, hashrate: capRaw.hashrate });
assert(mixed.bias === 'neutral' && mixed.flags.capitulation && mixed.flags.feeSpike,
  'bias: capitulation + fee spike (1 bull vs 1 bear) -> neutral tie');
const emptySig = W.onchainSignal(null);
assert(emptySig.bias === 'neutral' && emptySig.evidence.length === 0
    && emptySig.flags.congestion === null && typeof emptySig.note === 'string',
  'bias: null snap -> neutral, no evidence, honest note');
const bullSetup = sigFor(capRaw);
assert(bullSetup.setupColor === 'on-chain supports longs',
  'setupColor: bullish -> "on-chain supports longs"');
assert(sigFor({ fees: { fastestFee: 12, economyFee: 4 } }).setupColor.indexOf('stand aside') === 0,
  'setupColor: bearish -> "stand aside …"');
let threw = null;
try{ W.onchainSignal({ mempool: 'x', fees: 42, difficulty: [], hashrate: 'zz' }); }catch(e){ threw = e; }
assert(!threw, 'onchainSignal never throws on garbage legs');

/* ======================================================================
   5) fetch layer (stubbed fetch, per-leg degradation, cache)
====================================================================== */
const ctxB = makeCtx();
const WB = loadModule(ctxB);
let fetchCount = 0;
ctxB.fetch = (url) => { fetchCount++; return respFor(url); };

let st = await WB.onchainFetch(true);
assert(st.loaded === true && fetchCount === 5,
  'onchainFetch: full success -> loaded, exactly 5 leg calls');
assert(st.snap && st.snap.fees && st.snap.fees.economyFee === 5
    && st.snap.tipHeight === 850123 && st.errors.length === 0,
  'onchainFetch: snapshot populated from all legs, no notes');
assert(W.onchainSignal(st.snap).bias === 'bullish',
  'onchainFetch: healthy fixture -> composite bullish end-to-end');

fetchCount = 0;
st = await WB.onchainFetch(false);
assert(fetchCount === 0 && st.loaded === true,
  'cache: second call within 5 min -> zero new fetches');
st = await WB.onchainFetch(true);
assert(fetchCount === 5,
  'cache: force=true bypasses the 5-min cache');

/* per-leg failure tolerance */
WB.__onchainReset();
ctxB.fetch = (url) => {
  fetchCount++;
  if (url.indexOf('/api/v1/fees/recommended') !== -1) return failResp();
  return respFor(url);
};
st = await WB.onchainFetch(true);
assert(st.loaded === true && !st.snap.fees && st.snap.mempool
    && st.errors.some(n => n.indexOf('fee') !== -1),
  'per-leg failure: fees 500 -> leg null, honest note, other legs live');
assert(W.onchainSignal(st.snap).flags.feeSpike === false
    && typeof W.onchainSignal(st.snap).bias === 'string',
  'per-leg failure: signal still computes on the degraded snap');

/* all legs fail */
WB.__onchainReset();
ctxB.fetch = () => failResp();
st = await WB.onchainFetch(true);
assert(st.loaded === false && st.errors.length === 5,
  'all legs 500 -> not loaded, 5 honest notes');
assert(W.onchainSignal(st.snap || {}).bias === 'neutral',
  'all legs fail -> signal neutral, nothing fabricated');

/* fetch itself throws (network down) */
WB.__onchainReset();
ctxB.fetch = async () => { throw new Error('socket hang up'); };
let fetchThrew = null;
try{ st = await WB.onchainFetch(true); }catch(e){ fetchThrew = e; }
assert(!fetchThrew && st.loaded === false && st.errors.length === 5,
  'rejecting fetch -> resolves (never throws), not loaded, notes recorded');

/* fetch unavailable entirely */
{
  const ctxC = makeCtx();           // no fetch global
  const WC = loadModule(ctxC);
  const stC = await WC.onchainFetch(true);
  assert(stC.loaded === false && stC.errors.some(n => n.indexOf('fetch unavailable') !== -1),
    'no fetch global -> honest "fetch unavailable" note, no throw');
}

/* ======================================================================
   6) refresh contract
====================================================================== */
/* cold tab: skip, and do NOT fetch */
const ctxD = makeCtx();
const WD = loadModule(ctxD);
let dCount = 0;
ctxD.fetch = (url) => { dCount++; return respFor(url); };
const tabD = WD.HG_tabs[0];
let r = await tabD.refresh();
assert(r === 'skipped: not run yet' && dCount === 0,
  'refresh cold -> "skipped: not run yet" and zero fetches (no first-time scan from global refresh)');

/* armed tab: force refresh */
await WD.onchainFetch(true);
dCount = 0;
r = await tabD.refresh();
assert(r === 'refreshed' && dCount === 5,
  'refresh armed -> "refreshed", 5 leg calls (bypasses cache)');

/* busy guard: overlapping invocations never double-fetch */
WD.__onchainReset();
WD.__onchainSeed(WD.onchainBuildSnap(RAW_OK));
let gate;
const gateP = new Promise(res => { gate = res; });
let gCount = 0;
ctxD.fetch = (url) => { gCount++; return gateP.then(() => respFor(url)); };
const p1 = tabD.refresh();
const r2 = await tabD.refresh();
assert(r2 === 'busy', 'refresh overlap -> second call returns "busy"');
gate();
const r1 = await p1;
assert(r1 === 'refreshed' && gCount === 5,
  'busy guard: first refresh completes once, exactly 5 fetches (no double-fetch)');

/* every leg failing on refresh -> degraded, never throws */
ctxD.fetch = async () => { throw new Error('boom'); };
WD.__onchainSeed(WD.onchainBuildSnap(RAW_OK));
let refreshThrew = null, r3;
try{ r3 = await tabD.refresh(); }catch(e){ refreshThrew = e; }
assert(!refreshThrew && r3 === 'degraded: no leg succeeded',
  'refresh with all legs failing -> "degraded: no leg succeeded", never throws');

/* ======================================================================
   7) mount smoke + auto-fetch on first mount
====================================================================== */
{
  const ctxE = makeCtx();
  const WE = loadModule(ctxE);
  let eCount = 0;
  ctxE.fetch = (url) => { eCount++; return respFor(url); };
  const el = stubEl();
  let mountThrew = null;
  try{ WE.HG_tabs[0].mount(el); }catch(e){ mountThrew = e; }
  assert(!mountThrew && el.innerHTML.indexOf('ON-CHAIN') !== -1 && el.innerHTML.indexOf('MEMPOOL') !== -1,
    'mount() renders header + MEMPOOL panel without throwing');
  await new Promise(res => setTimeout(res, 30));
  assert(eCount === 5 && el.innerHTML.indexOf('sat/vB') !== -1,
    'mount auto-fetches the 5 legs once, then re-renders live data');
}

/* mount without fetch: renders honest empty states, no throw */
{
  const ctxF = makeCtx();
  const WF = loadModule(ctxF);
  const el = stubEl();
  let mountThrew = null;
  try{ WF.HG_tabs[0].mount(el); }catch(e){ mountThrew = e; }
  assert(!mountThrew && el.innerHTML.indexOf('not loaded') !== -1,
    'mount without fetch -> honest "not loaded" state, no throw');
}

/* ---------------- summary ---------------- */
process.on('unhandledRejection', () => {});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL ONCHAIN TESTS PASSED');
process.exit(0);
