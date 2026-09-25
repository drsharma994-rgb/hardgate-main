/* HARDGATE -- hg-v975: the SEVENTH route into the gold mints, the inline GOLD
   tab's engine bridge, ran unfed -- and the census that let hg-v974 call
   OMNIGOLD and STAR TRADER "the last two borrowers" could not see it.

   hgGoldInlineBridge (goldind.js) calls goldScalpSetups and goldSwingSetups
   directly, and the inline runGold() in index.html handed it bars, macro and
   Date.now(): no news under the key the mint reads (the hg-v963 literal, in an
   EIGHTH place), no feed label (so the mint TRUSTED proxy volume the GOLD
   SCALP desk distrusts), no live quote or book (spread lock and DOM rule
   unchecked), and the wall clock for both lanes. The scalp leader it printed
   on the stat line was therefore one the fed mint might have locked; the swing
   result it computed was never printed at all (hg-v932). hg-v974's census was
   a grep for gfn() lookups, which cannot see a direct call inside goldind.js
   itself -- so this pack derives the borrower census from source and requires
   it to agree with a declared list in BOTH directions (hg-v954).

   Sections:
     1) the real mints through the real bridge: the news gate locks on the
        signal bar even when the caller passes the wall clock; an unnamed wide
        quote locks, a proxy quote reports; the PAXG label drops the proxy
        volume votes; a broker quote on the input still wins; the swing lane
        locks on ITS bar alone
     2) the runGold bridge block, lifted out of index.html and RUN: news, the
        15m label, the live feed, the macro, no wall clock; fails open
     3) the stat line: a lane that formed and can crown none says so, the
        swing lane is printed, a null tally prints nothing
     4) the borrower census, DERIVED from source, agrees with the declared
        list both ways
     5) build stamps
   Run: node tests/test-gold-inline-bridge-fed.mjs */
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
const SWING = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'goldswing.js'];
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
const CPI = WED + 10 * 60000;
const SNAP = { events: [{ title: 'US CPI m/m', t: CPI }] };
const SNAP_LATER = { events: [{ title: 'US CPI m/m', t: WED + 3 * 3600000 }] };
const WIDE_UNNAMED = { quote: { spreadUsd: 0.60, bid: 4300.0, ask: 4300.6, venue: null }, l2: null, perp: null, macro: null };
const WIDE_PROXY = { quote: { spreadUsd: 0.60, bid: 4300.0, ask: 4300.6, venue: 'delta-xaut' }, l2: null, perp: null, macro: null };

console.log('== 1) the real mints through the real bridge ==');
{
  const W = boot(SWING);
  assert(typeof W.hgGoldInlineBridge === 'function' && typeof W.goldScalpSetups === 'function' && typeof W.goldSwingSetups === 'function', 'the bridge and both mints are loaded');
  const R4 = tapeEnding(WED, 300, 14400, 103, 40, -0.3), D1 = tapeEnding(WED, 150, 86400, 106, 60, -0.3);
  const inp = (seed, extra) => Object.assign({ rows15m: tapeEnding(WED, 420, 900, seed, 24), rows1h: tapeEnding(WED, 220, 3600, seed + 1, 30), rows4h: R4, rows1d: D1 }, extra || {});
  const B = W.hgGoldInlineBridge(inp(102));
  assert(B && B.scalp && B.scalp.count > 0, 'seed 102: the scalp lane forms through the bridge (' + (B && B.scalp && B.scalp.count) + ')');
  assert(B && B.swing && B.swing.count > 0, 'seed 102: the swing lane forms through the bridge (' + (B && B.swing && B.swing.count) + ') -- and its count is reported even with no crownable best (best=' + (B && B.swing && B.swing.best) + ')');
  const nS = B.scalp.count, nW = B.swing.count;

  /* the news gate, on the signal bar, with the caller passing the WALL CLOCK
     (months after the tape) -- exactly what index.html used to pass */
  const L = W.hgGoldInlineBridge(inp(102, { now: Date.now(), news: SNAP }));
  assert(L.scalp && L.scalp.count === 0, 'a CPI ten minutes after the last 15m bar LOCKS the scalp lane through the bridge, wall clock or not (' + nS + ' -> ' + L.scalp.count + ')');
  assert(L.swing && L.swing.count === 0, '... and the swing lane (' + nW + ' -> ' + L.swing.count + ')');
  const direct = W.goldSwingSetups({ rows4h: R4, rows1d: D1, now: Date.now(), news: SNAP });
  assert(direct && (direct.ranked || []).length === nW, 'the mint itself, handed the wall clock and the same snapshot, mints ' + (direct.ranked || []).length + ' -- so it is the BRIDGE that chose the signal bar, not the mint');
  const R = W.hgGoldInlineBridge(inp(102, { news: SNAP_LATER }));
  assert(R.scalp.count === nS && R.swing.count === nW, 'a release three hours out mints again on both lanes -- a gate that never opens is not a gate');

  /* the live feed through the ONE applier: unnamed wide quote locks, proxy reports */
  const U = W.hgGoldInlineBridge(inp(102, { live: WIDE_UNNAMED }));
  assert(U.scalp.count === 0 && U.swing.count === 0, 'a wide UNNAMED quote on the live feed locks both lanes (' + U.scalp.count + ' / ' + U.swing.count + ')');
  const P = W.hgGoldInlineBridge(inp(102, { live: WIDE_PROXY }));
  assert(P.scalp.count === nS && P.swing.count === nW, 'the same width naming delta-xaut moves NO board (hg-v968 venue rule, reached through this route)');
  const G = W.hgGoldInlineBridge(inp(102, { spreadUsd: 0.05, bid: 4300.0, ask: 4300.05, spreadVenue: 'xm-xauusd', live: WIDE_UNNAMED }));
  assert(G.scalp.count === nS && G.swing.count === nW, 'a broker quote already on the input WINS over the live feed (the applier fills only what is empty)');

  /* the feed label: PAXG volume is distrusted only when the feed is named */
  const B120 = W.hgGoldInlineBridge(inp(120));
  assert(B120.scalp.count > 0, 'seed 120 forms through the bridge unnamed (' + B120.scalp.count + ')');
  const X120 = W.hgGoldInlineBridge(inp(120, { candleSource: 'binance-paxg' }));
  assert(X120.scalp.count === 0, 'named binance-paxg, the volume votes are withheld and the board empties (' + B120.scalp.count + ' -> ' + X120.scalp.count + ') -- parity with GOLD SCALP, which has always named its feed');
  const M120 = W.hgGoldInlineBridge(inp(120, { candleSource: 'xm-xauusd' }));
  assert(M120.scalp.count === B120.scalp.count, 'the broker label keeps every candidate (' + M120.scalp.count + ')');

  /* two instants, one per lane: a 4h tape ending three hours before the 15m
     tape, a release ten minutes after the 4h bar */
  const last4h = WED - 3 * 3600000;
  const R4b = tapeEnding(last4h, 300, 14400, 103, 40, -0.3);
  const twoA = W.hgGoldInlineBridge(inp(102, { rows4h: R4b }));
  const twoB = W.hgGoldInlineBridge(inp(102, { rows4h: R4b, news: { events: [{ title: 'US NFP', t: last4h + 10 * 60000 }] } }));
  assert(twoA.swing.count > 0 && twoB.swing.count === 0, 'a release ten minutes after the 4h bar locks the SWING lane (' + twoA.swing.count + ' -> ' + twoB.swing.count + ')');
  assert(twoA.scalp.count > 0 && twoB.scalp.count === twoA.scalp.count, '... and leaves the scalp lane, whose own bar is three hours later, untouched (' + twoA.scalp.count + ') -- two instants, one per lane');

  /* fails open */
  const F = W.hgGoldInlineBridge(inp(102, { live: 'junk', news: null, candleSource: null }));
  assert(F.scalp.count === nS && F.swing.count === nW, 'junk on every new seam reads exactly like nothing on it');
}

console.log('== 2) the runGold bridge block, lifted out of index.html and RUN ==');
{
  const HTML = read('index.html');
  const i = HTML.indexOf("    var tabBridge = '';");
  const j = HTML.indexOf('if (typeof hgMpPin', i);
  const k = HTML.lastIndexOf('try', j);
  assert(i > 0 && j > i && k > i, 'the bridge block is located inside runGold');
  const block = HTML.slice(i, k);
  const helper = HTML.match(/function hgInlineGoldBridgeLine\(bridge\)\{[\s\S]*?\n\}\n/);
  assert(!!helper, 'hgInlineGoldBridgeLine is defined in the shell');
  const MAC = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' };
  const LIVE = { quote: null, l2: null, perp: null, macro: null, __marker: 'live' };
  const m15 = [{ t: 1 }], h1 = [{ t: 2 }], h4 = [{ t: 3 }], d1 = [{ t: 4 }];
  async function run(over){
    const calls = [];
    const ctx = Object.assign({
      console, Math, Date, Number, String, Object, Array, JSON, Error, Promise, isFinite, isNaN,
      __macroP: Promise.resolve(MAC), goldProState: () => ({ gp: 1 }),
      m15, h1, h4, d1,
      S: { goldDataSource: 'delta-xaut', goldSrcByTf: { '15m': 'binance-paxg', '4h': 'delta-xaut' } },
      hgGoldLiveFeed: () => Promise.resolve(LIVE),
      hgGoldNewsSnapshot: () => SNAP,
      hgGoldInlineBridge: (inp) => { calls.push(inp); return { scalp: { count: 7, best: { dir: 'short', strategy: 'hvn', tally: 7 } }, swing: { count: 2, best: null } }; }
    }, over || {});
    vm.createContext(ctx);
    vm.runInContext(helper[0], ctx, { filename: 'index.html:helper' });
    const text = await vm.runInContext('(async function(){\n' + block + '\nreturn tabBridge; })()', ctx, { filename: 'index.html:bridge' });
    return { calls, text };
  }
  const a = await run();
  assert(a.calls.length === 1, 'the bridge is called once');
  const inp = a.calls[0] || {};
  assert(inp.news === SNAP, 'the news snapshot is handed under `news`, the key the mint reads');
  assert(inp.candleSource === 'binance-paxg', 'the 15m feed label is named (the scalp mint judges 15m volume), not the last-fetched TF (' + inp.candleSource + ')');
  assert(inp.live === LIVE, 'the shared live feed is awaited and handed to the bridge');
  assert(inp.macro === MAC, 'the desk own macro read still rides');
  assert(inp.rows15m === m15 && inp.rows1h === h1 && inp.rows4h === h4 && inp.rows1d === d1, 'all four legs still ride');
  assert(!('now' in inp) || inp.now === undefined, 'no wall clock is passed -- the bridge judges each lane on its own signal bar (hygiene: the bridge would ignore it, the caller must not re-teach it)');
  assert(a.text === ' · tab scalp: SHORT hvn tally +7 · tab swing: 2 formed, none can lead', 'the stat line prints both lanes: ' + JSON.stringify(a.text));
  const b = await run({ hgGoldLiveFeed: () => Promise.reject(new Error('dead')) });
  assert(b.calls.length === 1 && b.calls[0].live === null && b.calls[0].news === SNAP, 'a rejecting live feed fails OPEN: the bridge still runs, live null, news intact');
  const c = await run({ hgGoldLiveFeed: undefined, hgGoldNewsSnapshot: undefined });
  assert(c.calls.length === 1 && c.calls[0].live === null && c.calls[0].news === null, 'no feed and no snapshot fail OPEN: live null, news null');
  const d = await run({ S: { goldDataSource: 'delta-xaut' } });
  assert(d.calls[0].candleSource === 'delta-xaut', 'with no per-TF map the whole-desk label is named');
  const e = await run({ S: {} });
  assert(e.calls[0].candleSource === undefined, 'no label at all invents none');
}

console.log('== 3) the stat line ==');
{
  const HTML = read('index.html');
  const helper = HTML.match(/function hgInlineGoldBridgeLine\(bridge\)\{[\s\S]*?\n\}\n/);
  const ctx = { isFinite, String, Object }; vm.createContext(ctx);
  vm.runInContext(helper[0], ctx);
  const line = b => vm.runInContext('hgInlineGoldBridgeLine', ctx)(b);
  assert(line(null) === '' && line({}) === '' && line({ scalp: null, swing: null }) === '', 'nothing formed -> nothing printed');
  assert(line({ scalp: { count: 3, best: null } }) === ' · tab scalp: 3 formed, none can lead', 'formed-and-withheld reads as such, not like nothing (hg-v940)');
  assert(line({ swing: { count: 2, best: { dir: 'long', strategy: 'p6comp', tally: 5 } } }) === ' · tab swing: LONG p6comp tally +5', 'the swing lane is printed (hg-v932: computed and dropped before)');
  assert(line({ scalp: { count: 1, best: { dir: 'short', strategy: 'bos', tally: null } } }) === ' · tab scalp: SHORT bos', 'a null tally prints NO tally -- isFinite(null) is true, and the old line would have printed "tally +null"');
  assert(line({ scalp: { count: 0, best: null } }) === '', 'a zero count prints nothing');
}

console.log('== 4) the borrower census, DERIVED from source ==');
{
  /* hg-v974 said "the last two borrowers" on a grep for gfn() lookups. This
     derives every call site of either mint by its call SHAPE (direct call,
     property read, lookup), comments stripped, and requires the set to agree
     with the declared routes in both directions -- a new borrower must declare
     itself here, or the guard names it (hg-v954). */
  const CALL = /\b(?:W|window|ctx|G|C|S|g)\.goldS(?:calp|wing)Setups\b|\bgoldS(?:calp|wing)Setups\s*\(|gfn\(\s*['"]goldS(?:calp|wing)Setups['"]\s*\)/;
  const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  const DECLARED = {
    'goldind.js': 'defines goldScalpSetups; hgGoldInlineBridge (the inline GOLD tab route) -- fed hg-v975',
    'goldswing.js': 'defines goldSwingSetups; goldswingCollectCandidates delegates -- fed hg-v973',
    'goldscalp.js': 'the GOLD SCALP desk itself (hg-v968 / v971)',
    'golddirection.js': 'GOLD DIRECTION lanes -- fed hg-v971..v973',
    'goldpine.js': 'GOLD PINE lanes -- fed hg-v971..v973',
    'goldultra.js': 'GOLD ULTRA lane -- fed hg-v971..v973',
    'omnigold.js': 'OMNIGOLD engine bridge -- fed hg-v974',
    'startradertab.js': 'STAR TRADER gold lane -- fed hg-v974',
    'scripts/backtest-goldscalp.mjs': 'replay harness: passes the closed bar cutoff as now (hg-v953)',
    'scripts/backtest-goldswing.mjs': 'replay harness (hg-v953)',
    'scripts/backtest-omnigold.mjs': 'replay harness (hg-v953)'
  };
  const files = []
    .concat(fs.readdirSync(ROOT).filter(f => f.endsWith('.js') && f !== 'build-stamp.js'))   /* build-stamp carries the changelog string */
    .concat(['index.html'])
    .concat(fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => /\.(mjs|cjs|js)$/.test(f)).map(f => 'scripts/' + f))
    .concat(fs.readdirSync(path.join(ROOT, 'lib')).filter(f => /\.(mjs|cjs|js)$/.test(f)).map(f => 'lib/' + f));
  const found = files.filter(f => CALL.test(strip(read(f)))).sort();
  const declared = Object.keys(DECLARED).sort();
  assert(found.length >= 10, 'the sweep sees the borrowers (' + found.length + ' files)');
  const undeclared = found.filter(f => !DECLARED[f]);
  const stale = declared.filter(f => found.indexOf(f) < 0);
  assert(undeclared.length === 0, 'every file that calls a gold mint is a declared route (undeclared: ' + (undeclared.join(', ') || 'none') + ')');
  assert(stale.length === 0, 'every declared route still calls a mint (stale: ' + (stale.join(', ') || 'none') + ')');
  assert(CALL.test('var got = goldScalpSetups(scInp);') && CALL.test("gfn('goldSwingSetups')") && CALL.test('W.goldSwingSetups(inp)') && !CALL.test("probe: 'goldScalpSetups'") && !CALL.test('goldScalpSetups / goldSwingSetups was fed'), 'the call-shape regex sees calls and lookups and ignores a reporter probe or prose');
}

console.log('== 5) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
