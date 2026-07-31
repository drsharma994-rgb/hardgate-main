/* HARDGATE — scorecard.js unit tests (Node 18+, builtins only).
   Loads scorecard.js as a classic script inside vm contexts with a `window`
   stub (exactly like the browser's <script> globals) and asserts:
     A) load never throws; window exports + HG_tabs registration shape
     B) hgScoreWalk — the settlement walk: same-bar stop-first rule, partials
        (T1S / T2), expiry, entry-bar inclusion, deadline boundary, INVALID
     C) hgScoreRecord — validation, 24h dedupe, 200 cap (settled-first
        eviction), corrupt/quota localStorage honesty, never-throws
     D) hgScoreSettle — injected candle fetcher, per-record catch isolation,
        mtm on open records, persistence, never-throws on garbage
     E) hgScoreStats — win/avgR/expectancy math, byTier/byLane/byDir/byLayer,
        null-R exclusion, enoughData threshold
     F) tab mount + refresh contract — mount smoke, honest empty states,
        skipped/busy/refreshed statuses, re-settle on refresh, no-route honesty
   No live network anywhere. Run: node tests/test-scorecard.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'scorecard.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, eps, msg){
  assert(typeof a === 'number' && isFinite(a) && Math.abs(a - b) <= eps,
    msg + ' (got ' + a + ', want ~' + b + ')');
}

/* ---------------- context / stub factories ---------------- */
function makeStorage(init){
  const mem = new Map(init ? Object.entries(init) : []);
  return {
    _mem: mem,
    getItem(k){ return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v){ mem.set(k, String(v)); },
    removeItem(k){ mem.delete(k); },
    clear(){ mem.clear(); }
  };
}
function makeCtx(extra){
  const base = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise
    // NOTE: no localStorage / fetch / candle routes unless `extra` adds them,
    // so load-time feature-checks are exercised too.
  };
  const ctx = vm.createContext(Object.assign(Object.create(null), base, extra || {}));
  vm.runInContext(SRC, ctx, { filename: 'scorecard.js' });
  return ctx;
}
/* minimal DOM stub: mount() uses innerHTML + el.querySelector + {style,
   textContent, disabled, addEventListener} */
function stubEl(){
  return {
    innerHTML: '', textContent: '', style: {}, disabled: false,
    _kids: {},
    addEventListener(ev, fn){ if (ev === 'click') this._click = fn; },
    querySelector(sel){
      if (!this._kids[sel]) this._kids[sel] = stubEl();
      return this._kids[sel];
    }
  };
}

/* ---------------- synthetic candles ---------------- */
const T0 = 1700000000; // seconds — bar 0 opens here
function bar(i, h, l, c){ return { t: T0 + i * 3600, o: c, h: h, l: l, c: c, v: 1 }; }
function bars(spec){ // spec: [[h,l,c], ...] from bar 0
  return spec.map(function(s, i){ return bar(i, s[0], s[1], s[2]); });
}
function neutralBars(n, c){ // 1h bars that never touch a 90/120/135 plan, from bar 0
  return neutralBarsFrom(0, n, c);
}
function neutralBarsFrom(start, n, c){
  const out = [];
  for (let i = 0; i < n; i++) out.push(bar(start + i, 105, 95, c === undefined ? 102 : c));
  return out;
}
/* house long plan: entry 100, stop 90 (risk 10), t1 120 (+2R), t2 135 (+3.5R) */
const LONG = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, at: T0 * 1000 };
/* house short plan: entry 100, stop 110, t1 80 (+2R), t2 65 (+3.5R) */
const SHORT = { dir: 'short', entry: 100, stop: 110, t1: 80, t2: 65, at: T0 * 1000 };
function rec(over){ return Object.assign({}, LONG, over || {}); }

/* ================================================================
   A) load + exports + registration
================================================================ */
{
  const ctx = makeCtx();
  const w = ctx.window;
  assert(typeof w.hgScoreRecord === 'function' && typeof w.hgScoreSettle === 'function'
      && typeof w.hgScoreWalk === 'function' && typeof w.hgScoreStats === 'function',
    'A1 pure + stateful cores exported on window (hgScoreRecord/hgScoreSettle/hgScoreWalk/hgScoreStats)');
  assert(typeof w.hgScoreRecords === 'function' && Array.isArray(w.hgScoreRecords()),
    'A2 hgScoreRecords() returns the ledger array (empty on a fresh store)');
  assert(Array.isArray(w.HG_tabs) && w.HG_tabs.length === 1,
    'A3 exactly one HG_tabs registration');
  const t = w.HG_tabs[0];
  assert(t.id === 'scorecard' && t.label === 'SCORECARD',
    'A4 tab id "scorecard", label "SCORECARD"');
  assert(typeof t.mount === 'function' && typeof t.refresh === 'function',
    'A5 registration carries mount() and refresh() functions');
  assert(w.hgScoreRecords().length === 0,
    'A6 loads cleanly with NO localStorage defined (in-memory ledger, no throw)');
}

/* ================================================================
   B) hgScoreWalk — settlement walk
================================================================ */
{
  const ctx = makeCtx();
  const W = ctx.window.hgScoreWalk;

  let w = W(rec(), bars([[105, 85, 95]]));
  assert(w.state === 'SL' && w.r === -1 && w.bars === 1 && w.closedAt === T0,
    'B1 first bar tags the stop -> SL, exactly -1R, bars/closedAt stamped');

  w = W(rec(), bars([[125, 85, 100]]));
  assert(w.state === 'SL' && w.r === -1,
    'B2 SAME bar touches stop AND t1 -> stop counts first (conservative, intra-bar order unknowable)');

  w = W(rec(), bars([[121, 95, 118], [136, 110, 134]]));
  assert(w.state === 'T2' && w.bars === 2 && w.closedAt === T0 + 3600, 'B3 t1 then t2 -> T2');
  approx(w.r, 3.5, 1e-9, 'B4 T2 scores the full t2 multiple (+3.5R — "T1-then-T2 = full")');

  w = W(rec(), bars([[140, 95, 138]]));
  assert(w.state === 'T2' && w.bars === 1, 'B5 one bar spans t1 AND t2 (no stop) -> T2 fill-through');
  approx(w.r, 3.5, 1e-9, 'B6 fill-through T2 still scores +3.5R');

  w = W(rec(), bars([[121, 95, 118], [110, 85, 92]]));
  assert(w.state === 'T1S' && w.bars === 2, 'B7 t1 then stop -> T1S');
  approx(w.r, 1, 1e-9, 'B8 T1S nets +1R (partial-bank convention: half at t1, runner breakeven)');

  w = W(rec(), bars([[121, 95, 118], [140, 80, 130]]));
  assert(w.state === 'T1S', 'B9 after t1, a bar touching stop AND t2 -> stop still counts first (T1S)');
  approx(w.r, 1, 1e-9, 'B10 T1S same-bar-stop-rule scores +1R, not +3.5R');

  w = W(SHORT, bars([[112, 95, 105]]));
  assert(w.state === 'SL' && w.r === -1, 'B11 short: stop above entry -> SL on first tag');

  w = W(SHORT, bars([[105, 78, 82], [95, 60, 68]]));
  assert(w.state === 'T2', 'B12 short: t1 then t2 -> T2');
  approx(w.r, 3.5, 1e-9, 'B13 short T2 scores +3.5R');

  w = W(SHORT, bars([[105, 78, 82], [112, 85, 108]]));
  assert(w.state === 'T1S', 'B14 short: t1 then stop -> T1S');
  approx(w.r, 1, 1e-9, 'B15 short T1S nets +1R');

  w = W(rec(), neutralBars(400, 102));
  assert(w.state === 'EXPIRED' && w.bars === 336 && w.closedAt === T0 + 335 * 3600,
    'B16 14 days, no touch -> EXPIRED after exactly 336 1h bars, closed at last in-window bar');
  approx(w.r, 0.2, 1e-9, 'B17 EXPIRED is marked to market ((102-100)/10 = +0.2R), never a fabricated outcome');

  w = W(rec(), neutralBars(400, 102).map(function(b, i){
    return (i === 336) ? { t: b.t, o: 102, h: 105, l: 1, c: 102 } : b; // stop ONLY in the bar opening exactly at at+14d
  }));
  assert(w.state === 'EXPIRED' && w.bars === 336,
    'B18 the bar opening exactly at at+14d is OUTSIDE the window — its stop is never seen');

  w = W(rec(), [bar(0, 121, 95, 118)].concat(neutralBarsFrom(1, 399, 110)));
  assert(w.state === 'T1' && w.bars === 336, 'B19 t1 touched, then the 14d window closes -> T1');
  approx(w.r, 2, 1e-9, 'B20 T1 scores the t1 multiple (+2R)');

  w = W(rec(), neutralBars(10, 103));
  assert(w.state === 'OPEN' && w.bars === 10 && w.closedAt === null,
    'B21 rows exhausted before the deadline -> still OPEN, closedAt null');
  approx(w.r, 0.3, 1e-9, 'B22 OPEN carries a provisional mark-to-market R (+0.3R at 103)');

  w = W(rec(), []);
  assert(w.state === 'OPEN' && w.r === null && w.bars === 0,
    'B23 no candles -> OPEN with honest null R (no data, nothing invented)');

  w = W(rec(), bars([[105, 85, 95]]));
  assert(w.state === 'SL' && w.bars === 1,
    'B24 entry exactly at a bar open -> that bar is walked (the fill bar counts)');

  w = W(rec({ at: (T0 + 3600) * 1000 }), bars([[101, 1, 100], [101, 99, 100]]));
  assert(w.state === 'OPEN' && w.bars === 1,
    'B25 a bar closing exactly AT the entry moment is pre-entry — never walked');

  w = W(rec({ dir: 'flat' }), neutralBars(5));
  assert(w.state === 'INVALID' && w.r === null, 'B26 missing/bad dir -> INVALID, never scored');
  w = W(rec({ stop: 100 }), neutralBars(5));
  assert(w.state === 'INVALID', 'B27 entry == stop (zero risk) -> INVALID');
  w = W(rec({ stop: 110 }), neutralBars(5));
  assert(w.state === 'INVALID', 'B28 long with stop above entry -> INVALID');
  w = W(rec({ t1: 90 }), neutralBars(5));
  assert(w.state === 'INVALID', 'B29 long with wrong-side t1 -> INVALID (would false-trigger on bar 1)');

  w = W(rec({ t1: 115, t2: null }), bars([[116, 95, 114], [110, 85, 92]]));
  assert(w.state === 'T1S', 'B30 non-house plan (t1 at 1.5R) still settles T1S');
  approx(w.r, 0.75, 1e-9, 'B31 non-house T1S scores the ACTUAL half-multiple (+0.75R — never the house +1R)');

  w = W(rec(), null);
  assert(w.state === 'OPEN' && w.bars === 0, 'B32 null rows tolerated -> OPEN, bars 0 (never throws)');
}

/* ================================================================
   C) hgScoreRecord — validation, dedupe, cap, storage honesty
================================================================ */
{
  const ctx = makeCtx({ localStorage: makeStorage() });
  const R = ctx.window.hgScoreRecord, ALL = ctx.window.hgScoreRecords;

  let r = R({ source: 'brain', sym: 'btcusdt', dir: 'LONG', tier: 'prime',
              entry: 100, stop: 90, t1: 120, t2: 135, layers: ['OI FLOW', 'regime'], at: 1000 });
  assert(r.ok === true && r.persisted === true, 'C1 a valid record is accepted and persisted');
  assert(ALL().length === 1, 'C2 the record lands in the ledger');
  const s = ALL()[0];
  assert(s.sym === 'BTCUSDT' && s.dir === 'long' && s.tier === 'PRIME' && s.source === 'brain'
      && s.lane === 'crypto' && s.status === 'open' && s.outcome === null,
    'C3 record normalized (sym/tier uppercased, dir lowercased, lane derived, status open)');
  assert(Array.isArray(s.layers) && s.layers.length === 2, 'C4 layer attribution stored');

  assert(R({ sym: 'BTCUSDT', dir: 'flat', entry: 100, stop: 90, t1: 120 }).ok === false,
    'C5 bad dir rejected');
  assert(R({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90 }).ok === false,
    'C6 missing t1 rejected');
  assert(R({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 95 }).ok === false,
    'C7 wrong-side t1 rejected');
  assert(R({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 100, t1: 120 }).ok === false,
    'C8 entry == stop rejected (zero risk, no R unit)');
  assert(R({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 110, t1: 120 }).ok === false,
    'C9 long stop above entry rejected');

  r = R({ source: 'execute', sym: 'ETHUSDT', dir: 'short', tier: 'HIGH',
          entry: 100, stop: 110, t1: 80, t2: 500, at: 2000 });
  assert(r.ok === true && r.record.t2 === null,
    'C10 wrong-side t2 is dropped to null — never invented, record still accepted');

  r = R({ sym: 'BTCUSDT', dir: 'long', entry: 101, stop: 91, t1: 121, at: 1000 + 3600000 });
  assert(r.ok === false && typeof r.reason === 'string' && r.reason.indexOf('duplicate') === 0 && !!r.dupOf,
    'C11 same sym+dir within 24h -> duplicate (with reason + dupOf id)');
  r = R({ sym: 'BTCUSDT', dir: 'short', entry: 101, stop: 111, t1: 81, at: 1000 + 3600000 });
  assert(r.ok === true, 'C12 same sym, OPPOSITE dir within 24h is a different trade — allowed');
  r = R({ sym: 'BTCUSDT', dir: 'long', entry: 102, stop: 92, t1: 122, at: 1000 + 25 * 3600000 });
  assert(r.ok === true, 'C13 same sym+dir AFTER 24h is a new setup — allowed');

  r = R({ sym: 'XAUUSDT', dir: 'long', entry: 2400, stop: 2350, t1: 2500, at: 3000 });
  assert(r.ok === true && r.record.lane === 'gold', 'C14 XAU sym routed to the gold lane');
  r = R({ sym: 'ATOMUSDT', dir: 'long', entry: 10, stop: 9, t1: 12, at: 4000, lane: 'gold' });
  assert(r.ok === true && r.record.lane === 'gold', 'C15 explicit lane hint honored over sym detection');

  let threw = null, bad = [];
  try{
    bad.push(R().ok); bad.push(R(null).ok); bad.push(R('junk').ok); bad.push(R(42).ok);
  }catch(e){ threw = e; }
  assert(threw === null && bad.every(function(x){ return x === false; }),
    'C16 garbage input (undefined/null/string/number) -> ok:false, never throws');
}

/* corrupt / quota storage — fresh contexts */
{
  const ctx = makeCtx({ localStorage: makeStorage({ hg_score_v1: '{not json' }) });
  const w = ctx.window;
  assert(w.hgScoreRecords().length === 0, 'C17 corrupt stored JSON -> empty ledger, no throw at load');
  const r = w.hgScoreRecord({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: 1000 });
  assert(r.ok === true, 'C18 recording still works after a corrupt load');

  const ctx2 = makeCtx({ localStorage: makeStorage({
    hg_score_v1: '[{"sym":"BTCUSDT","dir":"long","entry":100,"stop":90,"t1":120,"at":5},{"junk":1},null]' }) });
  assert(ctx2.window.hgScoreRecords().length === 1,
    'C19 stored junk entries are dropped, valid records kept (1 of 3 survives)');

  const quota = makeStorage();
  quota.setItem = function(){ throw new Error('QuotaExceededError'); };
  const ctx3 = makeCtx({ localStorage: quota });
  const r3 = ctx3.window.hgScoreRecord({ sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: 1000 });
  assert(r3.ok === true && r3.persisted === false && typeof r3.note === 'string' && r3.note.indexOf('memory') !== -1,
    'C20 quota failure -> ok:true, persisted:false, honest in-memory note');
  assert(ctx3.window.hgScoreRecords().length === 1, 'C21 the record survives in memory despite the quota failure');
}

/* 200-record cap — settled evicted before open */
{
  const ctx = makeCtx({ localStorage: makeStorage() });
  const R = ctx.window.hgScoreRecord;
  for (let i = 0; i < 5; i++)
    R({ sym: 'OLD' + i + 'USDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: 1000 + i });
  /* settle the five via an injected SL candle */
  const settle = ctx.window.hgScoreSettle;
  const before = await settle(async function(){ return bars([[105, 85, 95]]); });
  assert(before.settled === 5, 'C22 setup: five records settled via injected candles');
  for (let i = 0; i < 200; i++)
    R({ sym: 'NEW' + i + 'USDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: 10000 + i });
  const all = ctx.window.hgScoreRecords();
  assert(all.length === 200, 'C23 ledger capped at 200 records');
  const st = ctx.window.hgScoreStats(all);
  assert(st.settled === 0 && st.open === 200,
    'C24 the cap evicts oldest SETTLED records first — live trades are never silently dropped');
}

/* ================================================================
   D) hgScoreSettle — injected fetcher, isolation, persistence
================================================================ */
{
  const ctx = makeCtx({ localStorage: makeStorage() });
  const R = ctx.window.hgScoreRecord, SETTLE = ctx.window.hgScoreSettle, ALL = ctx.window.hgScoreRecords;

  R({ sym: 'AAAUSDT', dir: 'long', tier: 'PRIME', entry: 100, stop: 90, t1: 120, t2: 135, at: T0 * 1000 });
  R({ sym: 'BBBUSDT', dir: 'long', tier: 'HIGH', entry: 100, stop: 90, t1: 120, t2: 135, at: T0 * 1000 });
  const out = await SETTLE(async function(record){
    if (record.sym === 'AAAUSDT') return bars([[105, 85, 95]]);                    // stop
    return bars([[121, 95, 118], [136, 110, 134]]);                                // t1 then t2
  });
  assert(out.settled === 2 && out.open === 0 && out.failed === 0,
    'D1 settle summary counts both records, none open, none failed');
  const a = ALL()[0], b = ALL()[1];
  assert(a.status === 'settled' && a.outcome === 'SL' && a.r === -1 && a.closedAt === T0 && !!a.settledAt,
    'D2 SL record settled: outcome, -1R, closedAt (seconds), settledAt stamped');
  assert(b.status === 'settled' && b.outcome === 'T2' && b.r === 3.5 && b.bars === 2,
    'D3 T2 record settled: outcome, +3.5R, bars walked');

  const mem = ctx.localStorage._mem;
  const persisted = JSON.parse(mem.get('hg_score_v1'));
  assert(persisted.length === 2 && persisted[0].outcome === 'SL' && persisted[1].outcome === 'T2',
    'D4 settlement persisted to localStorage(hg_score_v1)');

  /* per-record catch isolation */
  R({ sym: 'CCCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  R({ sym: 'DDDUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  const out2 = await SETTLE(async function(record){
    if (record.sym === 'CCCUSDT') throw new Error('exchange 500');
    return bars([[105, 85, 95]]);
  });
  assert(out2.settled === 1 && out2.failed === 1,
    'D5 one throwing symbol never stops the loop (1 settled, 1 failed)');
  const ccc = ALL().filter(function(r){ return r.sym === 'CCCUSDT'; })[0];
  assert(ccc.status === 'open' && typeof ccc.note === 'string' && ccc.note.indexOf('exchange 500') !== -1,
    'D6 the failed record stays OPEN with an honest visible note naming the failure');

  /* empty rows -> honest open */
  R({ sym: 'EEEUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  const out3 = await SETTLE(async function(record){
    return record.sym === 'EEEUSDT' ? [] : bars([[105, 85, 95]]);
  });
  const eee = ALL().filter(function(r){ return r.sym === 'EEEUSDT'; })[0];
  assert(out3.open === 1 && eee.status === 'open' && typeof eee.note === 'string' && eee.note.indexOf('no candle data') !== -1,
    'D7 empty candle response -> stays OPEN with an honest note, never fabricated as settled');

  /* live mark-to-market on open records */
  R({ sym: 'FFFUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  await SETTLE(async function(record){
    return record.sym === 'FFFUSDT' ? neutralBars(10, 103) : bars([[105, 85, 95]]);
  });
  const fff = ALL().filter(function(r){ return r.sym === 'FFFUSDT'; })[0];
  assert(fff.status === 'open' && typeof fff.mtm === 'number' && Math.abs(fff.mtm - 0.3) < 1e-9 && !!fff.lastCheck,
    'D8 open record carries live mark-to-market R (+0.3R) and a last-check stamp');

  /* no fetcher + no route -> honest total failure, never throws */
  const ctx9 = makeCtx({ localStorage: makeStorage() });
  ctx9.window.hgScoreRecord({ sym: 'GGGUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  const out9 = await ctx9.window.hgScoreSettle('not-a-function');
  const ggg = ctx9.window.hgScoreRecords()[0];
  assert(out9.failed === 1 && out9.notes.length === 1 && /no candle route/.test(out9.notes[0])
      && ggg.status === 'open' && /no candle route/.test(ggg.note),
    'D9 no candle route -> every open record fails honestly (summary + per-record note), never throws');

  /* malformed open record (passes storage validation, fails walk validation) */
  const ctx10 = makeCtx({ localStorage: makeStorage({
    hg_score_v1: '[{"sym":"BADUSDT","dir":"long","entry":100,"stop":90,"t1":50,"at":1000,"status":"open","layers":[]}]' }) });
  const out10 = await ctx10.window.hgScoreSettle(async function(){ return neutralBars(10); });
  const bad = ctx10.window.hgScoreRecords()[0];
  assert(out10.failed === 1 && bad.status === 'open' && /failed validation/.test(bad.note),
    'D10 a record that fails walk validation is flagged honestly and never scored');
}

/* ================================================================
   E) hgScoreStats — math + breakdowns
================================================================ */
{
  const ctx = makeCtx();
  const STATS = ctx.window.hgScoreStats;

  let st = STATS([]);
  assert(st.open === 0 && st.settled === 0 && st.winRate === null && st.avgR === null
      && st.expectancy === null && st.enoughData === false,
    'E1 empty ledger -> zero counts, honest null rates, not-enough-data');
  assert(st.byTier.PRIME.n === 0 && st.byTier.HIGH.n === 0 && st.byLane.crypto.n === 0 && st.byDir.long.n === 0,
    'E2 PRIME/HIGH, crypto, long buckets always present (zeroed)');

  const RS = [
    { status: 'settled', r: 3.5, tier: 'PRIME', lane: 'crypto', dir: 'long',  layers: ['OI FLOW', 'REGIME'] },
    { status: 'settled', r: -1,  tier: 'HIGH',  lane: 'crypto', dir: 'long',  layers: ['OI FLOW'] },
    { status: 'settled', r: 2,   tier: 'PRIME', lane: 'gold',   dir: 'short', layers: ['REGIME'] },
    { status: 'settled', r: -1,  tier: 'PRIME', lane: 'crypto', dir: 'short', layers: ['REGIME'] },
    { status: 'open',    r: null, tier: 'PRIME', lane: 'crypto', dir: 'long', layers: ['OI FLOW'] }
  ];
  st = STATS(RS);
  assert(st.open === 1 && st.settled === 4 && st.wins === 2 && st.losses === 2 && st.counted === 4,
    'E3 open/settled/win/loss counts over mixed outcomes');
  approx(st.winRate, 0.5, 1e-9, 'E4 winRate = wins / r-scored settled (2/4)');
  approx(st.avgR, 0.875, 1e-9, 'E5 avgR = mean R ((3.5-1+2-1)/4)');
  approx(st.expectancy, 0.875, 1e-9, 'E6 expectancy = mean R per settled trade');
  assert(st.enoughData === false, 'E7 four settled < 5 -> still "not enough data"');

  assert(st.byTier.PRIME.n === 3 && st.byTier.PRIME.wins === 2, 'E8 byTier: PRIME n/wins');
  approx(st.byTier.PRIME.winRate, 2 / 3, 1e-9, 'E9 byTier: PRIME winRate');
  approx(st.byTier.PRIME.avgR, 1.5, 1e-9, 'E10 byTier: PRIME avgR ((3.5+2-1)/3)');
  approx(st.byTier.HIGH.avgR, -1, 1e-9, 'E11 byTier: HIGH avgR');
  approx(st.byLane.crypto.avgR, 0.5, 1e-9, 'E12 byLane: crypto avgR ((3.5-1-1)/3)');
  approx(st.byLane.gold.avgR, 2, 1e-9, 'E13 byLane: gold avgR');
  approx(st.byDir.long.avgR, 1.25, 1e-9, 'E14 byDir: long avgR');
  approx(st.byDir.short.avgR, 0.5, 1e-9, 'E15 byDir: short avgR');
  assert(st.byLayer['OI FLOW'].n === 2 && st.byLayer['OI FLOW'].wins === 1,
    'E16 byLayer: OI FLOW attributed to both records it voted for (open record excluded)');
  approx(st.byLayer['OI FLOW'].avgR, 1.25, 1e-9, 'E17 byLayer: OI FLOW avgR — the per-layer edge meter');
  approx(st.byLayer['REGIME'].winRate, 2 / 3, 1e-9, 'E18 byLayer: REGIME winRate');

  st = STATS(RS.concat([{ status: 'settled', r: null, outcome: 'EXPIRED', tier: 'HIGH', lane: 'crypto', dir: 'long', layers: ['OI FLOW'] }]));
  assert(st.settled === 5 && st.counted === 4, 'E19 null-R settlement counts in settled but never in r-math');
  approx(st.winRate, 0.5, 1e-9, 'E20 winRate unchanged by the null-R record (no silent fold-in)');
  assert(st.enoughData === true, 'E21 five settled -> enoughData');
  assert(st.byLayer['OI FLOW'].n === 2, 'E22 null-R record excluded from layer buckets too');

  st = STATS('garbage');
  assert(st.settled === 0 && st.open === 0, 'E23 non-array input -> zeroed stats, never throws');
  st = STATS([null, 42, 'junk', { status: 'settled', r: 1, tier: 'PRIME', lane: 'crypto', dir: 'long', layers: [] }]);
  assert(st.settled === 1 && st.counted === 1, 'E24 junk entries skipped, valid record counted');
}

/* ================================================================
   F) tab mount + refresh contract
================================================================ */
{
  /* mount smoke + honest empty state */
  const ctx = makeCtx({ localStorage: makeStorage() });
  const tab = ctx.window.HG_tabs[0];
  const el = stubEl();
  let threw = null;
  try{ tab.mount(el); }catch(e){ threw = e; }
  assert(threw === null, 'F1 mount() does not throw on a bare stub element');
  assert(el.innerHTML.indexOf('Scorecard') !== -1, 'F2 mount renders the panel');
  assert(el._kids['#scoreSettledWrap'].innerHTML.indexOf('No setups recorded yet') !== -1,
    'F3 empty ledger renders an honest empty state (no fabricated track record)');
  assert(el._kids['#scoreBoard'].innerHTML.indexOf('no settled trades yet') !== -1,
    'F4 scoreboard admits there is no record below the minimum sample');
  const skipped = await tab.refresh();
  assert(skipped === 'skipped: not run yet',
    'F5 refresh before the first user settle -> "skipped: not run yet" (a global refresh never fires a first-time candle sweep)');

  /* click RE-SETTLE with a stubbed xuniverse candle route */
  const calls = {};
  ctx.window.xuUniverse = async function(){
    return [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' },
            { sym: 'SOLUSD', base: 'SOL', exchange: 'delta' }];
  };
  ctx.window.xuCandles = async function(item){
    calls[item.sym] = (calls[item.sym] || 0) + 1;
    if (item.sym === 'BTCUSD') return bars([[105, 85, 95]]);   // stops out
    return neutralBars(10, 103);                                // drifts, stays open
  };
  ctx.window.hgScoreRecord({ source: 'brain', sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
    entry: 100, stop: 90, t1: 120, t2: 135, layers: ['OI FLOW'], at: T0 * 1000 });
  ctx.window.hgScoreRecord({ source: 'execute', sym: 'SOLUSDT', dir: 'long', tier: 'HIGH',
    entry: 100, stop: 90, t1: 120, t2: 135, layers: ['REGIME'], at: T0 * 1000 });
  await el._kids['#scoreRun']._click();
  assert(el._kids['#scoreStat'].textContent.indexOf('settled 1') !== -1,
    'F6 RE-SETTLE settles the stopped record and says so honestly');
  const sw = el._kids['#scoreSettledWrap'].innerHTML;
  assert(sw.indexOf('SL') !== -1 && sw.indexOf('gpip') !== -1 && sw.indexOf('BTCUSDT') !== -1,
    'F7 settled history renders the outcome pip and sym');
  const ow = el._kids['#scoreOpenWrap'].innerHTML;
  assert(ow.indexOf('SOLUSDT') !== -1 && ow.indexOf('+0.30R') !== -1,
    'F8 OPEN table renders live mark-to-market (+0.30R at 103)');
  assert(el._kids['#scoreBreaks'].innerHTML.indexOf('BY LAYER') !== -1
      && el._kids['#scoreBreaks'].innerHTML.indexOf('OI FLOW') !== -1,
    'F9 BY-LAYER edge meter renders with the voted layer names');

  const refreshed = await tab.refresh();
  assert(refreshed === 'refreshed', 'F10 refresh after the first run -> "refreshed"');
  assert(calls.SOLUSD === 2 && calls.BTCUSD === 1,
    'F11 refresh re-settles only OPEN records (SOL refetched, settled BTC not)');

  /* busy guard */
  const ctx2 = makeCtx({ localStorage: makeStorage() });
  const tab2 = ctx2.window.HG_tabs[0];
  let release;
  ctx2.window.xuUniverse = async function(){ return [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }]; };
  ctx2.window.xuCandles = function(){ return new Promise(function(res){ release = function(){ res(bars([[105, 85, 95]])); }; }); };
  ctx2.window.hgScoreRecord({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  const el2 = stubEl();
  tab2.mount(el2);
  const clickP = el2._kids['#scoreRun']._click();       // parks inside the gated candle fetch
  const busy = await tab2.refresh();
  assert(busy === 'busy', 'F12 refresh while a settlement is in flight -> "busy" (no double-fetch)');
  release();
  await clickP;
  const after = await tab2.refresh();
  assert(after === 'refreshed', 'F13 busy flag released — the next refresh runs normally');

  /* no candle route -> honest, never throws */
  const ctx3 = makeCtx({ localStorage: makeStorage() });
  const tab3 = ctx3.window.HG_tabs[0];
  ctx3.window.hgScoreRecord({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, at: T0 * 1000 });
  const el3 = stubEl();
  tab3.mount(el3);
  assert(el3._kids['#scoreWarn'].textContent.indexOf('no candle route') !== -1,
    'F14 mount warns honestly when every candle route is absent');
  await el3._kids['#scoreRun']._click();
  assert(el3._kids['#scoreStat'].textContent.indexOf('no candle route') !== -1,
    'F15 settle with no route says so in the status line — no silent failure');
  let threw3 = null, r3;
  try{ r3 = await tab3.refresh(); }catch(e){ threw3 = e; }
  assert(threw3 === null && typeof r3 === 'string', 'F16 refresh never throws even when settlement cannot run');

  /* mount with a corrupt stored ledger */
  const ctx4 = makeCtx({ localStorage: makeStorage({ hg_score_v1: '{corrupt' }) });
  const el4 = stubEl();
  let threw4 = null;
  try{ ctx4.window.HG_tabs[0].mount(el4); }catch(e){ threw4 = e; }
  assert(threw4 === null && el4._kids['#scoreWarn'].textContent.indexOf('corrupt') !== -1,
    'F17 corrupt stored ledger -> mount survives and the warn line admits it');
}

/* ---------------- G) hgProfitRankHint ---------------- */
console.log('\n== G) hgProfitRankHint ==');
{
  const ctx = makeCtx({ localStorage: makeStorage() });
  const w = ctx.window;
  assert(typeof w.hgProfitRankHint === 'function', 'G1 hgProfitRankHint exported');
  const z = w.hgProfitRankHint({});
  assert(z && z.boost === 0 && z.enough === false, 'G2 empty ledger -> boost 0, enough false');

  const R = w.hgScoreRecord, SETTLE = w.hgScoreSettle;
  for (let i = 0; i < 4; i++){
    R({ source: 'brain', sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
      entry: 100, stop: 90, t1: 120, layers: ['TREND'], at: (T0 + i * 7200) * 1000 });
    const rec = w.hgScoreRecords()[i];
    rec.status = 'settled';
    rec.r = (i < 3) ? 1.5 : -1;
    rec.state = (i < 3) ? 'T1' : 'SL';
  }
  const h = w.hgProfitRankHint({ sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', layers: ['TREND'], lane: 'crypto' });
  assert(h.enough === true && h.boost > 0, 'G3 winning sym+dir history -> positive boost (got ' + h.boost + ')');
  assert(Array.isArray(h.parts) && h.parts.length > 0, 'G4 parts array names contributing buckets');

  for (let j = 0; j < 4; j++){
    R({ source: 'brain', sym: 'ETHUSDT', dir: 'short', tier: 'HIGH',
      entry: 200, stop: 210, t1: 180, layers: ['REGIME'], at: (T0 + 10000 + j * 7200) * 1000 });
  }
  w.hgScoreRecords().forEach(function(rec){
    if (rec && rec.sym === 'ETHUSDT'){ rec.status = 'settled'; rec.r = -1; rec.state = 'SL'; }
  });
  const bad = w.hgProfitRankHint({ sym: 'ETHUSDT', dir: 'short', tier: 'HIGH', lane: 'crypto' });
  assert(bad.enough === true && bad.boost < 0, 'G5 losing sym history -> negative boost (got ' + bad.boost + ')');

  let threw = null;
  try{ w.hgProfitRankHint(null); }catch(e){ threw = e; }
  assert(threw === null, 'G6 null input never throws');
}

/* ---------------- summary ---------------- */
process.on('unhandledRejection', function(){});
await new Promise(function(r){ setTimeout(r, 100); });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL SCORECARD TESTS PASSED');
process.exit(0);
