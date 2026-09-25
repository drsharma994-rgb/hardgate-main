/* HARDGATE -- hg-v972: the macro snapshot reaches the three desks that borrow
   the gold mints, and the yield guard nothing feeds is reported, not fed.

   hg-v971 gave GOLD PINE, GOLD ULTRA and GOLD DIRECTION one shared live feed
   for the borrowed GOLD SCALP / GOLD SWING mints. It carried the quote, the
   book and the perp payload -- and NOT the macro snapshot. Those three desks
   handed the mints no `macro` at all (GOLD PINE fetched one for its own
   scoring and dropped it at the mint seam), so hgGoldMacroLock -- the DXY+TNX
   gold-long kill, a HARD DROP on both filter paths -- and the forming
   regime's dollar / real-yield reads ran UNCHECKED there on every scan, while
   the two desks the mints belong to have applied that lock since hg-v553.

   Sections:
     1) hgGoldApplyLiveFeed: fills `macro` only where absent, and NOTHING else
     2) hgGoldLiveFeed: the macro leg -- same reader, same timer, cached on a
        timeout, null on every failure, perp legs untouched
     3) the REAL mints: RISING/RISING drops every gold LONG with CONVICTION
        LOCK, leaves every short; FLAT or one leg moves NO board
     4) the borrowing desks: each lane, lifted and RUN, hands the snapshot to
        the mint; GOLD PINE's own fetch wins over the shared feed
     5) the yield guard: live at the top-level field, unreachable through the
        snapshot, and macro.js supplies no such series -- so it stays UNFED,
        and the applier is asserted never to feed it
     6) build stamps
   Run: node tests/test-gold-live-feed-macro.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
const BASE  = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js'];
const SWING = BASE.concat(['goldswing.js']);
const lv = (p, s) => ({ price: p, size: s });
const BOOK = { bids: [lv(4300.4, 10), lv(4300.3, 10)], asks: [lv(4300.6, 10), lv(4300.7, 10)] };
const PERP = { ok: true, ticker: { bid: 4300.40, ask: 4300.50, spreadUsd: 0.10 }, l2: BOOK, oi: [], funding: [] };
const LOCK = { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' };
const FLAT = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' };
const HALF = { dxy: { trend20: 'RISING' }, tnxTrend: 'FALLING' };

console.log('== 1) the applier fills macro only where absent, and nothing else ==');
{
  const W = boot(BASE);
  const a = W.hgGoldApplyLiveFeed({}, { macro: LOCK });
  assert(a.macro === LOCK, 'an empty input takes the snapshot by reference');
  const own = { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' };
  const b = W.hgGoldApplyLiveFeed({ macro: own }, { macro: LOCK });
  assert(b.macro === own, 'a snapshot already there WINS -- the desk that fetched its own keeps it');
  const c = W.hgGoldApplyLiveFeed({}, { macro: null });
  assert(!('macro' in c), 'a null leg writes nothing (no `macro: null` key invented)');
  const d = W.hgGoldApplyLiveFeed({}, { macro: 'RISING' });
  assert(!('macro' in d), 'a non-object leg is ignored');
  const rows10y = [{ t: 1, o: 4, h: 4, l: 4, c: 4, v: 0 }];
  const e = W.hgGoldApplyLiveFeed({}, { macro: Object.assign({ us10yCandles: rows10y }, LOCK) });
  assert(e.macro && e.us10yCandles === undefined, 'the applier NEVER writes inp.us10yCandles, even from a snapshot that carries one');
  assert(Object.keys(e).join(',') === 'macro', 'with a macro-only feed the applier writes exactly one key: ' + Object.keys(e).join(','));
  const full = W.hgGoldApplyLiveFeed({}, { quote: { spreadUsd: 0.1, bid: 4300.4, ask: 4300.5, venue: 'delta-xaut' }, l2: BOOK, perp: PERP, macro: FLAT });
  assert(full.macro === FLAT && full.l2OrderBook === BOOK && full.perpNative === PERP && Math.abs(full.spreadUsd - 0.1) < 1e-9, 'the hg-v971 legs still land beside it');
}

console.log('== 2) the loader: the macro leg ==');
{
  const W = boot(BASE);
  const src = read('goldind.js');
  const i = src.indexOf('function hgGoldLiveFeed(');
  const body = src.slice(i, src.indexOf('\nfunction hgGoldApplyLiveFeed', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/W\.getGoldMacro\b/.test(body) && /getGoldMacroCached/.test(body), 'the loader reads the SAME getGoldMacro every fed desk reads (and its cache), not a second macro reader');
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve(PERP) });
  const drive = async (macroFn, cachedFn, opts, fetchImpl) => {
    W.fetch = fetchImpl || okFetch;
    if (macroFn) W.getGoldMacro = macroFn; else delete W.getGoldMacro;
    if (cachedFn) W.getGoldMacroCached = cachedFn; else delete W.getGoldMacroCached;
    return W.hgGoldLiveFeed(opts || {});
  };
  const r = await drive(() => Promise.resolve(LOCK), null);
  assert(r.macro === LOCK, 'a resolving getGoldMacro lands the snapshot on the feed');
  assert(r.quote && Math.abs(r.quote.spreadUsd - 0.10) < 1e-9 && r.l2 && r.perp === PERP, 'and the perp legs are untouched beside it');
  const r2 = await drive(() => Promise.resolve(LOCK), null, {}, () => Promise.reject(new Error('down')));
  assert(r2.macro === LOCK && r2.quote === null && r2.l2 === null && !(r2.perp && r2.perp.ok), 'a dead perp route does not cost the macro leg (and vice versa below)');
  const r3 = await drive(() => Promise.reject(new Error('macro down')), null);
  assert(r3.macro === null && r3.quote && r3.perp === PERP, 'a rejecting getGoldMacro: null macro, perp legs intact, no throw');
  const r4 = await drive(() => 'RISING', null);
  assert(r4.macro === null, 'a non-object snapshot is null, not attached');
  const CACHED = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT', cached: true };
  const r5 = await drive(() => new Promise(() => {}), () => CACHED, { timeoutMs: 30 });
  assert(r5.macro === CACHED, 'a HANGING getGoldMacro falls back to the last cached snapshot after the timeout');
  const r6 = await drive(() => new Promise(() => {}), null, { timeoutMs: 30 });
  assert(r6.macro === null, 'hanging with no cache: null -- never a snapshot invented here');
  const r7 = await drive(() => new Promise(() => {}), () => { throw new Error('cache broken'); }, { timeoutMs: 30 });
  assert(r7.macro === null, 'a throwing cache reader is null, no throw');
  const r8 = await drive(null, () => CACHED);
  assert(r8.macro === null && r8.perp === PERP, 'with no getGoldMacro at all the macro leg is null and the perp legs still load');
  const r9 = await drive(() => Promise.resolve(LOCK), null, { timeoutMs: 30 }, () => new Promise(() => {}));
  assert(r9.macro === LOCK && r9.perp === null, 'a hanging PERP route still returns the macro leg after the timeout');
  delete W.getGoldMacro; delete W.getGoldMacroCached;
}

const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
function tapeEnding(endMs, n, stepSec, seed, amp, drift){
  let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = 2300;
  const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
    const o = c; c = o + (drift || 0) * (stepSec / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
  }
  return rows;
}
const scalpInp = (seed, extra) => Object.assign({ rows15m: tapeEnding(WED, 420, 900, seed, 24), rows1h: tapeEnding(WED, 220, 3600, seed + 1, 30),
  rows4h: tapeEnding(WED, 140, 14400, seed + 2, 40), dailyCandles: tapeEnding(WED, 120, 86400, seed + 3, 60), now: WED, news: null, candleSource: 'binance-paxg' }, extra || {});
const swingInp = (seed, extra) => Object.assign({ rows4h: tapeEnding(WED, 300, 14400, seed, 40, -0.3), rows1d: tapeEnding(WED, 150, 86400, seed + 3, 60, -0.3), now: WED, news: null }, extra || {});
const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, !!c.vetoed, (c.stamps || []).join('+')].join('|');
const same = (a, b) => a.length === b.length && a.map(board).join('~') === b.map(board).join('~');

console.log('== 3) the REAL mints: the lock drops LONGS, leaves shorts, and FLAT moves nothing ==');
{
  const C = boot(BASE);
  /* seed 106 mints one LONG through the scalp path, seed 102 seven SHORTS (the hg-v970 seed) */
  const longNone = C.goldScalpSetups(scalpInp(106)) || [];
  assert(longNone.length > 0 && longNone.every(c => c.dir === 'long'), 'REACHABILITY: the scalp mint forms a LONG with no macro (' + longNone.map(c => c.stratKey).join(', ') + ')');
  const longLock = C.goldScalpSetups(scalpInp(106, { macro: LOCK })) || [];
  const cl = (longLock.rejected || []).filter(r => /CONVICTION LOCK/.test(r.reason || ''));
  assert(longLock.length === 0 && cl.length >= longNone.length, 'GOLD SCALP mint: DXY RISING + TNX RISING drops every long with CONVICTION LOCK (' + cl.length + ' rejected)');
  assert(cl.every(r => /DXY by 20-day|DXY by/.test(r.reason)), 'and the reason names the read that decided');
  assert(same(C.goldScalpSetups(scalpInp(106, { macro: FLAT })) || [], longNone), 'a FLAT snapshot moves NO board -- feeding the field is not itself a policy');
  assert(same(C.goldScalpSetups(scalpInp(106, { macro: HALF })) || [], longNone), 'one leg bullish is not a lock (the pre-existing rule)');
  const shortNone = C.goldScalpSetups(scalpInp(102)) || [];
  assert(shortNone.length > 0 && shortNone.every(c => c.dir === 'short'), 'REACHABILITY: seed 102 forms shorts only (' + shortNone.length + ')');
  assert(same(C.goldScalpSetups(scalpInp(102, { macro: LOCK })) || [], shortNone), 'GOLD SCALP mint: the lock is LONG-only -- ' + shortNone.length + ' shorts identical under RISING/RISING');

  const S = boot(SWING);
  const swNone = (S.goldSwingSetups(swingInp(105)) || {}).ranked || [];
  assert(swNone.length > 0 && swNone.every(c => c.dir === 'long'), 'REACHABILITY: the swing mint forms a LONG with no macro (' + swNone.map(c => c.stratKey).join(', ') + ')');
  const swLock = S.goldSwingSetups(swingInp(105, { macro: LOCK })) || {};
  const swCl = (swLock.rejected || []).filter(r => /CONVICTION LOCK/.test(r.reason || ''));
  assert((swLock.ranked || []).length === 0 && swCl.length >= swNone.length, 'GOLD SWING mint: the same snapshot drops every long with CONVICTION LOCK (' + swCl.length + ' rejected)');
  assert(same((S.goldSwingSetups(swingInp(105, { macro: FLAT })) || {}).ranked || [], swNone), 'GOLD SWING mint: FLAT moves no board');
  const swShort = (S.goldSwingSetups(swingInp(103)) || {}).ranked || [];
  assert(swShort.length > 0 && swShort.every(c => c.dir === 'short'), 'REACHABILITY: seed 103 forms shorts (' + swShort.length + ')');
  assert(same((S.goldSwingSetups(swingInp(103, { macro: LOCK })) || {}).ranked || [], swShort), 'GOLD SWING mint: shorts identical under RISING/RISING');
  /* and through the APPLIER, the way the borrowing desks reach it */
  const viaApplier = C.goldScalpSetups(C.hgGoldApplyLiveFeed(scalpInp(106), { macro: LOCK })) || [];
  assert(viaApplier.length === 0 && (viaApplier.rejected || []).some(r => /CONVICTION LOCK/.test(r.reason || '')), 'the lock is reached THROUGH the applier -- the seam the three desks use');
}

console.log('== 4) the borrowing desks: each lane, lifted and RUN, hands the snapshot to the mint ==');
{
  const W = boot(BASE);
  const feed = { quote: null, l2: null, perp: null, macro: LOCK, venue: 'delta-xaut' };
  function lift(file, head){
    const src = read(file);
    const i = src.indexOf(head);
    assert(i > 0, file + ': ' + head.trim() + ' is findable');
    const j = src.indexOf('\n}\n', i);
    return src.slice(i, j + 2);
  }
  function sandbox(rec, extra){
    const sb = Object.assign({ console: { log(){} }, isFinite, isNaN, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
      gfn: n => (n === 'goldScalpSetups' || n === 'goldSwingSetups') ? rec : (n === 'hgGoldApplyLiveFeed' ? W.hgGoldApplyLiveFeed : null),
      heldLine: () => '', gdNewsCtx: () => ({ at: Date.now(), snap: null }), normCand: () => ({}), setupFromNative: () => null }, extra || {});
    vm.createContext(sb);
    /* hg-v973: the lane reads the signal bar through a module helper; lift the
       real one rather than stub it */
    { const gp = read('goldpine.js'); const gi = gp.indexOf('function gpMintBarMs(rows, fallback){');
      vm.runInContext(gp.slice(gi, gp.indexOf('\n}\n', gi) + 2), sb, { filename: 'goldpine.js:gpMintBarMs' }); }
    return sb;
  }
  const rows = [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }];
  const gold = { rows15m: rows, rows1h: rows, rows4h: rows, rows1d: rows, live: feed };
  const recScalp = calls => inp => { calls.push(inp); const out = []; out.rejected = []; return out; };
  const recSwing = calls => inp => { calls.push(inp); return { ranked: [], rejected: [] }; };
  {
    const calls = []; const sb = sandbox(recScalp(calls));
    vm.runInContext(lift('golddirection.js', 'async function laneGoldScalp(gold, now){'), sb, { filename: 'golddirection.js:laneGoldScalp' });
    await sb.laneGoldScalp(gold, Date.now());
    assert(calls.length === 1 && calls[0].macro === LOCK, 'GOLD DIRECTION scalp lane: the mint input CARRIES the snapshot');
    const calls2 = []; const sb2 = sandbox(recScalp(calls2));
    vm.runInContext(lift('golddirection.js', 'async function laneGoldScalp(gold, now){'), sb2, { filename: 'golddirection.js:laneGoldScalp2' });
    await sb2.laneGoldScalp(Object.assign({}, gold, { live: null }), Date.now());
    assert(calls2.length === 1 && calls2[0].macro === undefined, 'GOLD DIRECTION scalp lane: with no feed, no macro -- exactly as before');
  }
  {
    const calls = []; const sb = sandbox(recSwing(calls));
    vm.runInContext(lift('golddirection.js', 'function laneGoldSwing(gold, now){'), sb, { filename: 'golddirection.js:laneGoldSwing' });
    sb.laneGoldSwing(gold, Date.now());
    assert(calls.length === 1 && calls[0].macro === LOCK, 'GOLD DIRECTION swing lane: the mint input carries the snapshot');
  }
  {
    const calls = []; const sb = sandbox(recScalp(calls));
    vm.runInContext(lift('goldultra.js', 'async function laneGoldScalp(gold, now){'), sb, { filename: 'goldultra.js:laneGoldScalp' });
    await sb.laneGoldScalp(gold, Date.now());
    assert(calls.length === 1 && calls[0].macro === LOCK, 'GOLD ULTRA scalp lane: the mint input carries the snapshot');
  }
  {
    const OWN = { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING', own: true };
    const bars = { rows15m: new Array(40).fill(rows[0]), rows1h: rows, rows4h: rows, live: feed };
    const calls = []; const sb = sandbox(recScalp(calls));
    vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb, { filename: 'goldpine.js:collectNativeScalp' });
    sb.collectNativeScalp(bars, { now: Date.now(), news: null, macro: OWN }, 'test');
    assert(calls.length === 1 && calls[0].macro === OWN, 'GOLD PINE native scalp: the desk\'s OWN macro fetch reaches the mint (it was dropped at this seam before) and WINS over the shared feed');
    const calls2 = []; const sb2 = sandbox(recScalp(calls2));
    vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb2, { filename: 'goldpine.js:collectNativeScalp2' });
    sb2.collectNativeScalp(bars, { now: Date.now(), news: null, macro: null }, 'test');
    assert(calls2.length === 1 && calls2[0].macro === LOCK, 'GOLD PINE native scalp: with no own read the shared feed fills it');
    const calls3 = []; const sb3 = sandbox(recScalp(calls3));
    vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb3, { filename: 'goldpine.js:collectNativeScalp3' });
    sb3.collectNativeScalp(Object.assign({}, bars, { live: null }), { now: Date.now(), news: null }, 'test');
    assert(calls3.length === 1 && !calls3[0].macro, 'GOLD PINE native scalp: with neither, none');
    /* the desk's own fetch feeds the scan context the lift reads -- the seam
       above it, asserted textually (hg-v956): runGoldPineScan is DOM-bound */
    const src = read('goldpine.js');
    assert(/var scanCtx = \{ macro: macro,/.test(src) && /collectNativeScalp\(bars, scanCtx, source\)/.test(src), 'GOLD PINE: scanCtx.macro is the desk\'s own getGoldMacro read and is what collectNativeScalp receives');
  }
}

console.log('== 5) the yield guard: live, unreachable through the snapshot, unfed by macro.js -- and left so ==');
{
  const C = boot(BASE);
  const ris = tapeEnding(WED, 60, 3600, 7, 1, 0).map((r, i) => { const y = 4.0 + (i > 54 ? (i - 54) * 0.05 : 0); return { t: r.t, o: y, h: y, l: y, c: y, v: 0 }; });
  const none = C.goldScalpSetups(scalpInp(106)) || [];
  const top = C.goldScalpSetups(scalpInp(106, { us10yCandles: ris })) || [];
  assert(top.length === none.length && top.some(c => (c.stamps || []).indexOf('MACRO YIELD') >= 0) && !none.some(c => (c.stamps || []).indexOf('MACRO YIELD') >= 0), 'the 5-bar yield guard IS live: a rising 10-year on the TOP-LEVEL field stamps MACRO YIELD on the long');
  const inMacro = C.goldScalpSetups(scalpInp(106, { macro: Object.assign({ us10yCandles: ris }, FLAT) })) || [];
  assert(same(inMacro, none), 'the same series INSIDE the snapshot is unreachable -- the mint reads the field only at the top level, so a snapshot cannot feed it');
  const M = boot(['macro.js']);
  const m = await M.getGoldMacro();
  assert(m && typeof m === 'object' && !('us10yCandles' in m) && 'tnxTrend' in m && 'tnxRows' in m, 'getGoldMacro supplies tnxTrend / tnxRows for the 20-day band and NO us10yCandles -- the field has never been written');
  assert(!/us10yCandles/.test(read('macro.js')), 'no writer of that field anywhere in macro.js');
  const src = read('goldind.js');
  const ai = src.indexOf('function hgGoldApplyLiveFeed(');
  const abody = src.slice(ai, src.indexOf('\n}\n', ai)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert(!/us10yCandles\s*=/.test(abody) && !/tnxRows\s*=/.test(abody) && !/dxyRows\s*=/.test(abody), 'the applier writes inp.macro and no macro sub-field: a different rule from the band is not fed by this pack (the hg-v966 trap)');
  /* the two fed desks read the field from the snapshot -- which never carries it */
  assert(/ctx\.macro && ctx\.macro\.us10yCandles/.test(read('goldscalp.js')) && /ctx\.macro && ctx\.macro\.us10yCandles/.test(read('goldswing.js')), 'GOLD SCALP and GOLD SWING copy us10yCandles from the snapshot, so the guard is unfed on the fed desks too -- reported here, unchanged');
}

console.log('== 6) build stamps ==');
{
  const W = boot(BASE);
  assert(Math.abs(W.HG_GOLD_SPREAD_MAX_USD - 0.25) < 1e-12, 'the $0.25 bar is unchanged');
  assert(W.HG_GOLD_MACRO_RULE === undefined || W.hgGoldMacroRule() === 'trend20', 'the macro rule in force is still the 20-day band');
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
