/* HARDGATE -- hg-v980: the forward ledger's fill model never received a mark
   from eleven of the twelve gold desks that record.

   hgFwdSettleFill settles a record AS IF THE ORDER HAD TO FILL FIRST: a
   resting limit that price never reached is `unfilled`, a fill bar that also
   touched an exit is `unprovable`, and only a filled order is judged. It
   needs one field to tell a resting order from a market one -- `mark`, the
   price when the plan fired -- and hgFwdOrderType returns null without it,
   so the fill-aware pass stands aside. hgFwdRecordScan was fixed to forward
   `mark` (its own comment records that no desk had ever had one) -- and the
   record maps of GOLD SCALP, GOLD SWING, SUPER GOLD, GOLD DIRECTION, GOLD
   ULTRA, GOLD PRO, OPTI GOLD, NEW GOLD, OMNIGOLD 1, TAURIC, 80PERCENT and
   GOLD PINE never passed one. Only OMNIGOLD stamps a mark on its record. In
   GOLD SCALP's committed walk 561 of 2,605 plans (21.5%) are resting orders
   (285 BUY_LIMIT, 243 SELL_LIMIT, 24 BUY_STOP, 9 SELL_STOP) and 90 of 2,193
   settled plans never filled -- every one of those, in the live ledger, was
   settled as a market order and could record a win it never opened for
   (a limit) or a loss it never opened for (a stop entry).

   Every gold desk forwards the mark it already has now, and the gold desk
   note reads the fill split it makes possible (hg-v955: a field nothing
   reads is ornamental). Absent stays absent.

   Sections:
     1) the ledger rule, driven directly, the defect reproduced first
     2) GOLD SCALP end to end: every record carries the mark it was sized
        against, and the fill model settles them
     3) the other desks: what can be driven is driven, the rest is textual
        and says so (hg-v956)
     4) the census, derived from source: every gold writer carries a mark
     5) the reader
     6) build stamps
   Run: node tests/test-gold-ledger-fill-mark.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/mg, '');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
const SEC = WED / 1000;
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
/* a continuation from the last close, starting one step after WED */
function future(lastClose, n, stepSec, seed, amp){
  let s = seed, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = lastClose; const t0 = SEC + stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * amp : 0;
    const o = c; c = o + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 1000 });
  }
  return rows;
}
const shift = (rows, b) => rows.map(r => ({ t: r.t, o: r.o * (1 + b), h: r.h * (1 + b), l: r.l * (1 + b), c: r.c * (1 + b), v: r.v }));

function boot(files, clock, news, tapes, feed){
  const FakeDate = class extends Date { static now(){ return clock.now; } };
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const el = () => ({ style: {}, innerHTML: '', textContent: '', appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => el(), querySelectorAll: () => [], classList: { add(){}, remove(){}, toggle(){} }, dataset: {} });
  const byId = {};
  ctx.document = { createElement: el, getElementById: id => (byId[id] || (byId[id] = el())), querySelector: () => el(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  if (tapes){
    ctx.getXmGoldCandles = async tf => ({ rows: tapes[tf] || [], source: feed || 'xm-xauusd' });
    ctx.getGoldCandles = async () => ({ rows: [], source: null });
  }
  if (news !== undefined) ctx.hgNewsState = () => news;
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
/* the four desks below are IIFE-wrapped: their helpers are lifted out of the
   file and RUN under stubs (the hg-v951 technique) */
function lift(file, head){
  const src = read(file);
  const i = src.indexOf(head);
  assert(i > 0, file + ': ' + head.trim() + ' is findable');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}
function sandbox(extra){
  const sb = Object.assign({ Math, Number, String, Object, Array, JSON, Promise, isFinite, isNaN, parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } }, extra || {});
  sb.gfn = n => (typeof sb[n] === 'function' ? sb[n] : null);
  vm.createContext(sb);
  return sb;
}
const BASE = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'gold-best-levels.js', 'hg-forward.js', 'gold-forward-read.js'];


console.log('== 1) the ledger rule, driven directly ==');
{
  const clock = { now: WED + 5 * 60000 };
  const W = boot(['hg-forward.js'], clock, undefined, null);
  const recs = tab => W.hgFwdRecords(tab);
  /* a long limit: entry 2300 sits BELOW a mark of 2310; a tape that never
     dips to 2300 and reaches the target 2320 */
  const row = x => Object.assign({ sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2320, mechanic: 'M', signalT: WED }, x || {});
  const never = future(2310, 40, 900, 7, 0).map((r, i) => ({ t: r.t, o: 2312, h: i >= 3 ? 2325 : 2315, l: 2306, c: 2314, v: 1 }));
  assert(W.hgFwdRecordScan('LEGACY', '15m', [row()], { horizonBars: 20 }) === 1 && recs('LEGACY')[0].mark === undefined, 'REACHABILITY: a row with no mark records with mark undefined (every gold record before this pack)');
  W.hgFwdResolve('XAUUSD', '15m', never, undefined);
  const leg = recs('LEGACY')[0];
  assert(leg.state === 't1' && leg.fillState === undefined && leg.stateFill === undefined, 'THE DEFECT: the feedless limit is settled as a market order -- a TARGET HIT on a tape that never reached its entry, and no fill verdict at all');
  assert(W.hgFwdRecordScan('A', '15m', [row({ mark: 2310 })], { horizonBars: 20 }) === 1 && recs('A')[0].mark === 2310, 'c.mark is recorded on the row');
  W.hgFwdResolve('XAUUSD', '15m', never, undefined);
  const a = recs('A')[0];
  assert(a.state === 't1' && a.fillState === 'unfilled' && a.orderType === 'BUY_LIMIT', 'with the mark the SAME record is a BUY_LIMIT that never filled (the actual tally is untouched by design: state stays t1, fillState says unfilled)');
  assert(W.hgFwdRecordScan('B', '15m', [row({ mark: 2300 })], { horizonBars: 20 }) === 1, 'a mark AT the entry is a market order');
  W.hgFwdResolve('XAUUSD', '15m', never, undefined);
  assert(recs('B')[0].orderType === 'BUY' && recs('B')[0].stateFill === 't1', 'and a market order fills at once and settles t1 both ways');
  for (const junk of [0, -1, 'x', null, '']){
    const tab = 'J' + String(junk);
    W.hgFwdRecordScan(tab, '15m', [row({ mark: junk })]);
    assert(recs(tab)[0] && recs(tab)[0].mark === undefined, 'junk mark (' + JSON.stringify(junk) + ') is absent, never a mark of zero');
  }
}

async function scanOnce(files, tabId, tapes, clock){
  const W = boot(files, clock, null, tapes);
  const tab = (W.HG_tabs || []).find(t => t && t.id === tabId);
  const r = await tab.refresh();
  const snap = W[tabId + 'Scan']();
  return { W, r, cands: (snap && snap.cands) || [], recs: W.hgFwdRecords(tabId === 'goldscalp' ? 'GOLDSCALP' : 'GOLDSWING') };
}

console.log('== 2) GOLD SCALP end to end ==');
{
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  /* accuracy-floor.js carries the roster the desk note resolves its pools from */
  const r = await scanOnce(BASE.concat(['accuracy-floor.js', 'goldscalp.js']), 'goldscalp', tapes, { now: WED + 5 * 60000 });
  assert(r.r === 'refreshed' && r.recs.length >= 5, 'REACHABILITY: a headless scan ran and recorded (' + r.recs.length + ')');
  const n = r.recs.length;
  assert(r.recs.every(x => typeof x.mark === 'number' && isFinite(x.mark) && x.mark > 0), 'every GOLD SCALP record carries the mark it was sized against');
  assert(r.recs.every(x => x.mark === r.cands.find(c => c.dir === x.dir && +c.entry === x.entry).mark), 'and it is the snapshot\'s own mark, not a re-read');
  /* on this synthetic tape every candidate mints AT the mark (the real walk
     is 21.5% resting orders) -- said rather than implied, and the resting
     case is driven on OPTI GOLD below, whose orders rest by construction */
  console.log('  info - resting on this tape: ' + r.recs.filter(x => Math.abs(x.entry - x.mark) > 1e-9).length + '/' + n + ' (the mint priced every candidate at the last close here)');
  const W = r.W, raw = W.localStorage.getItem('hg_forward_v1');
  const fut = future(tapes['15m'][tapes['15m'].length - 1].c, 130, 900, 1002, 24);
  W.hgFwdResolveInfo('XAUUSD', '15m', fut, 'xm-xauusd');
  const settled = W.hgFwdRecords('GOLDSCALP');
  assert(settled.filter(x => typeof x.orderType === 'string').length === n && settled.every(x => ['filled', 'unfilled', 'unprovable'].indexOf(x.fillState) >= 0), 'the fill model ran on all ' + n + ' (' + settled.map(x => x.orderType + ':' + x.fillState).join(', ') + ')');
  /* the pre-pack record: strip the mark, settle the same seven */
  W.localStorage.setItem('hg_forward_v1', JSON.stringify(JSON.parse(raw).map(x => { const y = Object.assign({}, x); delete y.mark; return y; })));
  W.hgFwdResolveInfo('XAUUSD', '15m', fut, 'xm-xauusd');
  const legacy = W.hgFwdRecords('GOLDSCALP');
  assert(legacy.every(x => x.fillState === undefined && x.orderType === undefined) && legacy.filter(x => x.state !== 'open').length === n, 'THE DEFECT ON THESE RECORDS: stripped of the mark, all ' + n + ' settle as market orders and none carries a fill verdict');
  assert(!/FILL-AWARE/.test(W.hgGoldFwdNote('goldscalp')), 'and the desk note prints no fill split on a ledger whose records carry no mark (a legacy log is not evidence about fills)');
  /* the reader, on the marked records */
  W.localStorage.setItem('hg_forward_v1', raw);
  W.hgFwdResolveInfo('XAUUSD', '15m', fut, 'xm-xauusd');
  const note = W.hgGoldFwdNote('goldscalp');
  const w = settled.filter(x => x.stateFill === 't1').length, l = settled.filter(x => x.stateFill === 'stop').length;
  assert(/FILL-AWARE/.test(note) && new RegExp('\\b' + (w + l) + ' filled and settled \\(' + w + 'W / ' + l + 'L').test(note), 'the desk note prints the fill split (' + w + 'W / ' + l + 'L)');
  assert(W.hgGoldFwdFillHtml(null) === '' && W.hgGoldFwdFillHtml({ fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 }) === '' && /2W \/ 1L, 66\.7% hit/.test(W.hgGoldFwdFillHtml({ fillWins: 2, fillLosses: 1, fillUnfilled: 3, fillUnprovable: 0 })) && /3 never filled/.test(W.hgGoldFwdFillHtml({ fillWins: 0, fillLosses: 0, fillUnfilled: 3, fillUnprovable: 0 })), 'hgGoldFwdFillHtml: nothing on no counts, the split otherwise, unfilled alone still prints');
}

console.log('== 2c) OPTI GOLD end to end: resting orders by construction ==');
{
  const seed = 150;
  const tapes = { '15m': tapeEnding(WED, 600, 900, seed, 24, 0.4), '1h': tapeEnding(WED, 600, 3600, seed + 1, 30, 0.2), '4h': tapeEnding(WED, 500, 14400, seed + 2, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const W = boot(['hg-forward.js', 'optigold.js'], { now: WED + 5 * 60000 }, null, null);
  W.getGoldCandles = async (tf, n) => ({ rows: (tapes[tf] || []).slice(-n), source: 'binance-xau' });
  const tab = W.HG_tabs.find(t => t && t.id === 'optigold');
  tab.mount(W.document.createElement('div'));
  let rr = 'busy', i = 0; while (i++ < 200){ await new Promise(res => setTimeout(res, 25)); rr = await tab.refresh(); if (rr !== 'busy') break; }
  const recs = W.hgFwdRecords('OPTI GOLD');
  assert(recs.length >= 2, 'REACHABILITY: OPTI GOLD mounted, scanned and recorded (' + recs.length + ')');
  assert(recs.every(x => typeof x.mark === 'number' && x.mark > 0 && Math.abs(x.entry - x.mark) > 1e-9), 'every OPTI GOLD record carries the break bar\'s close as its mark, and every one RESTS away from it');
  for (const tf of ['15m', '1h', '4h']){
    if (!recs.some(x => x.tf === tf)) continue;
    W.hgFwdResolveInfo('XAUUSD', tf, future(tapes[tf][tapes[tf].length - 1].c, 130, { '15m': 900, '1h': 3600, '4h': 14400 }[tf], 900 + seed, 24), 'binance-xau');
  }
  const s = W.hgFwdRecords('OPTI GOLD');
  assert(s.every(x => /LIMIT|STOP/.test(String(x.orderType)) && ['filled', 'unfilled', 'unprovable'].indexOf(x.fillState) >= 0), 'the fill model types every one as a resting order and resolves it (' + s.map(x => x.orderType + ':' + x.fillState).join(', ') + ')');
  const unfilled = s.filter(x => x.fillState === 'unfilled');
  console.log('  info - ' + s.length + ' resting records: ' + s.filter(x => x.fillState === 'filled').length + ' filled, ' + unfilled.length + ' never filled; actual tally settled ' + s.filter(x => x.state !== 'open').length + ' of them regardless');
  assert(unfilled.every(x => x.state !== 'open'), 'a record that never filled was still SETTLED by the actual tally -- the outcome the fill-aware pass now sets aside (' + unfilled.map(x => x.state).join(', ') + ')');
}

console.log('== 2b) GOLD SWING ==');
{
  const tapes = { '4h': tapeEnding(WED, 300, 14400, 103, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3), '1h': tapeEnding(WED, 220, 3600, 103, 30) };
  const r = await scanOnce(BASE.concat(['goldswing.js']), 'goldswing', tapes, { now: WED + 5 * 60000 });
  assert(r.r === 'refreshed' && r.recs.length >= 1 && r.recs.every(x => typeof x.mark === 'number' && x.mark > 0), 'GOLD SWING records carry the mark (' + r.recs.length + ')');
}

console.log('== 3) the other desks ==');
{
  /* OPTI GOLD: the break bar close, driven */
  const og = sandbox({ window: { hgGoldSignalBarMs: rows => rows[rows.length - 1].t * 1000 } });
  og.W = og.window;
  vm.runInContext(lift('optigold.js', 'function ogBreakBarSec(rows, s){') + '\n' + lift('optigold.js', 'function ogBreakBarClose(rows, s){') + '\n' + lift('optigold.js', 'function ogFwdRows(setups, lane, rows, feed){'), og);
  const ogRows = vm.runInContext('ogFwdRows', og), ogClose = vm.runInContext('ogBreakBarClose', og);
  const rows = tapeEnding(WED, 30, 900, 9, 24);
  const setups = [{ dir: 'long', state: 'waiting', entry: 2300, stop: 2290, t1: 2320, i: 3 }];
  assert(ogRows(setups, 'M15', rows, null)[0].mark === rows[3].c, 'OPTI GOLD stamps the close of the BREAK bar as the mark (a resting order placed against it)');
  assert(ogClose(rows, { i: 99 }) === null && ogClose(rows, {}) === null && ogClose(null, { i: 1 }) === null && ogClose([{ c: null }], { i: 0 }) === null && ogClose([{ c: 0 }], { i: 0 }) === null, 'an unreadable or zero close is no mark');
  assert(!('mark' in ogRows(setups, 'M15', [{ t: 1, c: null }, { t: 2, c: null }, { t: 3, c: null }, { t: 4, c: null }], null)[0]), 'and the row carries none then');

  /* GOLD PINE: the detector's mark, driven against the real ledger */
  const gpx = sandbox({ W: {}, fin: v => isFinite(+v), hgGpKind: s => 'PINE-' + s.dir });
  const gpLed = boot(['hg-forward.js'], { now: WED + 5 * 60000 }, undefined, null);
  gpx.hgFwdRecordScan = gpLed.hgFwdRecordScan;
  gpx.W.hgGoldSignalBarMs = rows => rows[rows.length - 1].t * 1000;
  vm.runInContext(lift('goldpine.js', 'function hgGpRecord(list, mode, bars){'), gpx);
  const gpRec = vm.runInContext('hgGpRecord', gpx);
  const gpBars = { rows15m: tapeEnding(WED, 40, 900, 3, 24), rows4h: tapeEnding(WED - 4 * 3600000, 40, 14400, 4, 40), srcByTf: { '15m': 'binance-xau', '4h': 'binance-paxg' } };
  assert(gpRec([{ dir: 'long', entry: 2300, stop: 2290, t1: 2320, price: 2305 }], 'scalp', gpBars) === 1 && gpLed.hgFwdRecords('GOLDPINE:scalp')[0].mark === 2305, 'GOLD PINE records the detector\'s mark (s.price)');
  assert(gpRec([{ dir: 'short', entry: 2300, stop: 2310, t1: 2280, price: null }], 'scalp', gpBars) === 1 && gpLed.hgFwdRecords('GOLDPINE:scalp').pop().mark === undefined, 'and none when the setup carries none');

  /* 80PERCENT: the signal bar's close */
  const p8 = boot(['hg-forward.js', 'eightypercent.js'], { now: WED }, undefined, null);
  const sig = { dir: 'long', tf: '1h', tfSec: 3600, t: SEC, close: 2304.5, plan: { entry: 2300, stop: 2290, t1: 2320 }, mech: 'P80' };
  assert(p8.hg80Record(sig, null, 'binance-xau').ok === true && p8.hgFwdRecords('OMNIGOLD:P80').pop().mark === 2304.5, '80PERCENT records the signal bar\'s close as the mark');
  assert(p8.hg80Record(Object.assign({}, sig, { t: SEC - 3600, close: undefined }), null).ok === true && p8.hgFwdRecords('OMNIGOLD:P80').pop().mark === undefined, 'and none without a close');

  /* TAURIC: the last close the plan was priced on */
  const ta = boot(['hg-forward.js', 'tauric.js'], { now: WED }, undefined, null);
  const rec = ta.hgTauricRecord({ state: 'directional', dir: 'long', label: 'buy' }, { ok: true, plan: { entry: 2300, stop: 2290, t1: 2320 }, lastClose: 2301.25 });
  assert(rec.ok === true && ta.hgFwdRecords('OMNIGOLD:TAURIC').pop().mark === 2301.25, 'TAURIC records the last close it priced on');

  /* OMNIGOLD 1: the candidate's own mark */
  const o1 = boot(['omnigold1.js'], { now: WED }, undefined, null);
  const seen1 = [];
  o1.hgFwdRecordScan = (tab, tf, rows) => { seen1.push(...rows); return rows.length; };
  const cand = { dir: 'long', entry: 2300, stop: 2290, t1: 2320, sid: 'S0', mark: 2307, verdict: { qualifies: true }, gradeInfo: { grade: 'A', tradeReady: true } };
  o1.hgOg1ForwardRecord([{ horizon: 'SWING', r: { ok: true, candidates: [cand], sections: { s0: { clear: true } } } }], 'delta-xaut');
  assert(seen1.length === 1 && seen1[0].mark === 2307, 'OMNIGOLD 1 forwards the candidate\'s mark');

  /* textual, inside scan closures (hg-v956) */
  const S = f => strip(read(f));
  assert(/if \(gdFeed\) row\.feed = gdFeed;[\s\S]{0,300}if \(isFinite\(fin\(c\.mark\)\) && fin\(c\.mark\) > 0\) row\.mark = fin\(c\.mark\);/.test(S('golddirection.js')), 'GOLD DIRECTION forwards the mint\'s mark on its pick');
  assert(/if \(typeof sel\.pick\.mark === 'number' && isFinite\(sel\.pick\.mark\) && sel\.pick\.mark > 0\) guRow\.mark = sel\.pick\.mark;/.test(S('goldultra.js')), 'GOLD ULTRA forwards the pick\'s mark (textual, inside the scan closure: the whole guarded statement, after a bare-assignment match let an if (false) survive)');
  assert(/mark: \(lvRows && lvRows\.length && isFinite\(\+lvRows\[lvRows\.length - 1\]\.c\)/.test(S('goldpro.js')), 'GOLD PRO records the last close of the series its plan was composed on (its own note: the bars ARE the mark)');
  assert(/mark: \(r\.setup && typeof r\.setup\.mark === 'number'/.test(S('newgold.js')), 'NEW GOLD forwards the setup\'s mark');
  assert(/feed: c\.feed,\s*mark: c\.mark \}/.test(S('super-gold.js')), 'SUPER GOLD forwards the source desk\'s mark');
  assert(/feed: c\.feed,\s*mark: c\.mark,/.test(S('goldscalp.js')) && /feed: c\.feed,\s*mark: c\.mark,/.test(S('goldswing.js')), 'the two home desks forward the snapshot mark across the record map');
  assert(/mark: \(function\(\)\{/.test(S('omnigold.js')), 'OMNIGOLD already stamped a mark, and still does');
}

console.log('== 4) the census, derived from source ==');
{
  function spanFrom(s, i){
    let d = 0, q = null;
    for (let k = i; k < s.length; k++){
      const ch = s[k];
      if (q){ if (ch === '\\') k++; else if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`'){ q = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}'){ d--; if (d === 0) return s.slice(i, k + 1); }
    }
    return s.slice(i);
  }
  function calls(s, names){
    const out = [], re = new RegExp('\\b(' + names.join('|') + ')\\s*\\(', 'g');
    let m;
    while ((m = re.exec(s))) out.push(spanFrom(s, m.index + m[0].length - 1));
    return out;
  }
  const aliasesOf = (s, entry) => {
    const names = [entry], re = new RegExp("(?:var|let|const)\\s+(\\w+)\\s*=\\s*(?:gfn\\('" + entry + "'\\)|W\\." + entry + "|window\\." + entry + ")", 'g');
    let m; while ((m = re.exec(s))) names.push(m[1]);
    return names;
  };
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f));
  const writers = [], bare = [];
  for (const f of files){
    const s = strip(read(f));
    const w = calls(s, aliasesOf(s, 'hgFwdRecordScan').concat(aliasesOf(s, 'hgFwdRecord')));
    if (!w.length || !(/sym:\s*'XAUUSD'/.test(s) || /SUPER:GOLD/.test(s))) continue;
    writers.push(f);
    if (!(w.some(sp => /\bmark\s*:/.test(sp)) || /\.mark = /.test(s) || /\bmark:\s*\(/.test(s) || /\bmark:\s*c\.mark/.test(s))) bare.push(f);
  }
  const EXP = ['eightypercent.js', 'golddirection.js', 'goldpine.js', 'goldpro.js', 'goldscalp.js', 'goldswing.js', 'goldultra.js', 'newgold.js', 'omnigold.js', 'omnigold1.js', 'optigold.js', 'super-gold.js', 'tauric.js'].sort();
  assert(JSON.stringify(writers.sort()) === JSON.stringify(EXP), 'the thirteen gold writers (' + writers.join(', ') + ')');
  assert(bare.length === 0, 'every one carries a mark on its record path' + (bare.length ? ' -- BARE: ' + bare.join(', ') : ''));
}

console.log('== 5) build stamps ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
  assert(/hg-v980/.test(read('AGENTS.md')), 'AGENTS.md carries the hg-v980 entry');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
