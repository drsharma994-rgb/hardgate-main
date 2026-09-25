/* HARDGATE -- hg-v978: seven gold desks never told the forward ledger which
   bar they read, so every one of their records was dated on the floor of the
   scan clock.

   hg-forward.js has documented this exact defect since the CRYPTO SCAN fix:
   a record dated on the floor of now names a bar that had not closed when the
   setup was made; settlement walks rows STRICTLY AFTER barT, so the first bar
   of the trade -- on a 15m scalp, where most fills and stops happen -- is
   skipped; and the dedup key carries barT, so two scans that voted on the
   SAME closed bar in different clock minutes become two records. Its remedy
   was `c.barT`, and GOLD SCALP, GOLD SWING, GOLD DIRECTION, GOLD ULTRA, GOLD
   PRO, OPTI GOLD and SUPER GOLD never passed one. hg-v977 made every mint
   candidate carry `signalT`, the instant it was judged on; this pack makes the
   ledger read it, forwards it across the record maps that rebuild rows (the
   hg-v955 seam), and has the four desks whose rows come from elsewhere say
   which bar they read through the bar reader each already has.

   Sections:
     1) the ledger rule, driven directly: signalT dates the record, barT still
        wins, the clock is the fallback, the future is clamped, junk is junk,
        and one firing is ONE record across clock bars
     2) GOLD SCALP end to end across two clock bars: seven candidates, seven
        records, every one dated on the signal bar (it was fourteen)
     3) GOLD SWING, the same
     4) the four desks with their own bar reader, lifted and run, and the two
        record maps that forward the instant (textual where the site sits
        inside a scan closure, and says so)
     5) build stamps
   Run: node tests/test-gold-ledger-dated-on-the-bar.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

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
/* a context under a MUTABLE wall clock (clock.now), persistent localStorage,
   the XM bridge stubbed to serve fixture tapes */
function boot(files, clock, news, tapes){
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
    ctx.getXmGoldCandles = async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' });
    ctx.getGoldCandles = async () => ({ rows: [], source: null });
  }
  if (news !== undefined) ctx.hgNewsState = () => news;
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
function lift(file, head){
  const src = read(file);
  const i = src.indexOf(head);
  assert(i > 0, file + ': ' + head.trim() + ' is findable');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}
const BASE = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'gold-best-levels.js', 'hg-forward.js'];
const SEC = WED / 1000;

console.log('== 1) the ledger rule, driven directly ==');
{
  const clock = { now: WED + 6 * 3600000 };
  const W = boot(['hg-forward.js'], clock, undefined, null);
  const row = x => Object.assign({ sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2320, mechanic: 'M' }, x || {});
  const rec = tab => W.hgFwdRecords(tab);
  assert(W.hgFwdRecordScan('A', '15m', [row({ signalT: WED })]) === 1 && rec('A')[0].barT === SEC, 'signalT (ms) dates the record on the signal bar (' + rec('A')[0].barT + '), not the floor of a clock 6 h later');
  assert(W.hgFwdRecordScan('B', '15m', [row({ signalT: WED, barT: SEC - 900 })]) === 1 && rec('B')[0].barT === SEC - 900, 'a caller that says barT still wins over signalT');
  const wallBar = Math.floor(clock.now / 1000 / 900) * 900;
  assert(W.hgFwdRecordScan('C', '15m', [row()]) === 1 && rec('C')[0].barT === wallBar, 'with neither, the floor of now exactly as before (' + rec('C')[0].barT + ')');
  assert(W.hgFwdRecordScan('D', '15m', [row({ signalT: SEC })]) === 1 && rec('D')[0].barT === SEC, 'signalT in seconds is read too');
  assert(W.hgFwdRecordScan('E', '15m', [row({ signalT: clock.now + 2 * 3600000 })]) === 1 && rec('E')[0].barT === wallBar, 'a signalT in the future is clamped to the clock bar (a future bar is not a bar anything was read on)');
  for (const junk of ['x', null, 0, -5, '', {}]){
    const tab = 'J' + String(junk);
    W.hgFwdRecordScan(tab, '15m', [row({ signalT: junk })]);
    assert(rec(tab)[0] && rec(tab)[0].barT === wallBar, 'junk signalT (' + JSON.stringify(junk) + ') falls back to the clock bar, never a bar invented');
  }
  assert(W.hgFwdRecordScan('F', '4h', [row({ signalT: WED + 3 * 3600000 })]) === 1 && rec('F')[0].barT === Math.floor((SEC + 3 * 3600) / 14400) * 14400, 'floored to the record timeframe (4h)');
  /* one firing, one record: the same candidate recorded from two scans on
     DIFFERENT clock bars */
  clock.now = WED + 5 * 60000;
  const n1 = W.hgFwdRecordScan('G', '15m', [row({ signalT: WED })]);
  clock.now = WED + 20 * 60000;
  const n2 = W.hgFwdRecordScan('G', '15m', [row({ signalT: WED })]);
  assert(n1 === 1 && n2 === 0 && rec('G').length === 1, 'one firing seen by two scans on different clock bars is ONE record (' + n1 + ' + ' + n2 + ')');
  clock.now = WED + 5 * 60000;
  const m1 = W.hgFwdRecordScan('H', '15m', [row()]);
  clock.now = WED + 20 * 60000;
  const m2 = W.hgFwdRecordScan('H', '15m', [row()]);
  assert(m1 === 1 && m2 === 1 && rec('H').length === 2, 'REACHABILITY of the defect: the same row with no instant is TWO records across those clock bars (' + m1 + ' + ' + m2 + ') -- what every gold desk without a bar produced');
}

const desc = rs => rs.map(r => [r.mechanic, r.dir, r.barT].join('|')).sort().join(' ~ ');
async function twoScans(files, tabId, tapes, clock, secondWall){
  const W = boot(files, clock, null, tapes);
  const tab = (W.HG_tabs || []).find(t => t && t.id === tabId);
  const r1 = await tab.refresh();
  clock.now = secondWall;
  const r2 = await tab.refresh();
  const snap = W[tabId + 'Scan']();
  return { r1, r2, cands: (snap && snap.cands) || [], recs: W.hgFwdRecords(tabId === 'goldscalp' ? 'GOLDSCALP' : 'GOLDSWING') };
}

console.log('== 2) GOLD SCALP end to end across two clock bars ==');
{
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const clock = { now: WED + 5 * 60000 };
  const r = await twoScans(BASE.concat(['goldscalp.js']), 'goldscalp', tapes, clock, WED + 20 * 60000);
  assert(r.r1 === 'refreshed' && r.r2 === 'refreshed' && r.cands.length > 0, 'REACHABILITY: two headless scans ran and minted (' + r.cands.length + ' candidates)');
  const levelled = r.cands.filter(c => isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1)).length;
  assert(r.recs.length > 0 && r.recs.length === levelled, 'two scans on two clock bars record each levelled candidate ONCE (' + r.recs.length + ' records for ' + levelled + ' candidates) -- it was twice, keyed on the clock bar');
  assert(r.recs.every(x => x.barT === SEC), 'every record is dated on the 15m SIGNAL bar (' + SEC + '), not the floor of the scan clock (' + Math.floor(clock.now / 1000 / 900) * 900 + ')');
}

console.log('== 3) GOLD SWING end to end across two clock bars ==');
{
  const tapes = { '4h': tapeEnding(WED, 300, 14400, 103, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3), '1h': tapeEnding(WED, 220, 3600, 103, 30) };
  const clock = { now: WED + 5 * 60000 };
  const r = await twoScans(BASE.concat(['goldswing.js']), 'goldswing', tapes, clock, WED + 5 * 3600000);
  assert(r.r1 === 'refreshed' && r.r2 === 'refreshed' && r.cands.length > 0, 'REACHABILITY: two headless swing scans ran and minted (' + r.cands.length + ' candidates)');
  const levelled = r.cands.filter(c => isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1)).length;
  assert(r.recs.length > 0 && r.recs.length === levelled, 'each levelled swing candidate is recorded ONCE across two 4h clock bars (' + r.recs.length + ' for ' + levelled + '; the record carries ticket:false for a grade C, it is still one record)');
  assert(r.recs.every(x => x.barT === SEC), 'every swing record is dated on the 4h SIGNAL bar');
}

console.log('== 4) the other five desks say which bar they read ==');
{
  /* GOLD PRO and OPTI GOLD: their bar readers, lifted and RUN */
  const sb = { window: { hgGoldSignalBarMs: rows => rows[rows.length - 1].t * 1000 }, Math, isFinite, Number, String };
  vm.createContext(sb);
  vm.runInContext(lift('goldpro.js', 'function gpProBarSec(rows){') + '\n' + lift('optigold.js', 'function ogBreakBarSec(rows, s){'), sb);
  const rows = tapeEnding(WED, 30, 14400, 9, 40);
  assert(vm.runInContext('gpProBarSec', sb)(rows) === SEC, 'GOLD PRO reads the last closed bar of the series in hand, in seconds (' + SEC + ')');
  assert(vm.runInContext('gpProBarSec', sb)([]) === null && vm.runInContext('gpProBarSec', sb)(null) === null, 'GOLD PRO: no series -> null, the ledger keeps its own behaviour');
  const ob = vm.runInContext('ogBreakBarSec', sb);
  assert(ob(rows, { i: 3 }) === rows[3].t && ob(rows.map(r => Object.assign({}, r, { t: r.t * 1000 })), { i: 3 }) === rows[3].t, 'OPTI GOLD reads the BREAK bar of each setup (rows[s.i]), seconds or ms');
  assert(ob(rows, { i: 99 }) === null && ob(rows, { i: -1 }) === null && ob(rows, {}) === null && ob(null, { i: 1 }) === null && ob([{ t: null }], { i: 0 }) === null, 'OPTI GOLD: an unreadable break bar -> null, never a bar invented');
  /* the record sites sit inside scan closures; asserted TEXTUALLY (hg-v956) */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const gd = strip(read('golddirection.js')), gu = strip(read('goldultra.js')), gp = strip(read('goldpro.js')), og = strip(read('optigold.js')), sg = strip(read('super-gold.js')), gs = strip(read('goldscalp.js')), gw = strip(read('goldswing.js'));
  assert(/var gdBarSec = gdSignalSec\(gold\);[\s\S]{0,400}if \(gdBarSec\) row\.barT = gdBarSec;/.test(gd), 'GOLD DIRECTION dates its rows on its own 1h signal bar (gdSignalSec, the weekend mark\'s instant)');
  /* hg-v979 widened the gaps: the feed stamp now sits between these lines */
  assert(/var guSec = guSignalSec\(f\);\s*if \(guSec\) guRow\.barT = guSec;[\s\S]{0,400}W\.hgFwdRecordScan\('GOLDULTRA'/.test(gu), 'GOLD ULTRA dates its row on its own 15m signal bar (guSignalSec)');
  assert(/var gpBarSec = gpProBarSec\(lvRows\);\s*W\.hgFwdRecordScan\('GOLDPRO', '4h', \[\{[\s\S]{0,200}barT: gpBarSec \|\| undefined,/.test(gp), 'GOLD PRO passes the bar it composed on');
  assert(/ogFwdRows\(setups, L\.key, rows[,)]/.test(og) && /var bt = ogBreakBarSec\(rows, s\);\s*if \(bt\) row\.barT = bt;/.test(og), 'OPTI GOLD passes each setup\'s break bar');
  assert(/mechanic: 'CONVICTION-PICK', ticket: true,\s*barT: c\.barT, signalT: c\.signalT[,\s]/.test(sg), 'SUPER GOLD forwards the source desk\'s bar and instant across its record map');
  assert(/goldShut: c\.goldShut,\s*signalT: c\.signalT,/.test(gs) && /goldShut: c\.goldShut,\s*signalT: c\.signalT,/.test(gw), 'GOLD SCALP and GOLD SWING forward signalT across the record map that rebuilds the row (the hg-v955 seam)');
  /* the census, derived: every gold desk that records through the ledger
     now names a bar or forwards the instant */
  const goldFiles = fs.readdirSync(ROOT).filter(f => /gold|tauric|eightypercent|optigold|super-gold/.test(f) && f.endsWith('.js'));
  const recorders = goldFiles.filter(f => /hgFwdRecordScan\(/.test(strip(read(f))));
  const bare = recorders.filter(f => !/barT|signalT/.test(strip(read(f))));
  const EXPECTED = ['golddirection.js', 'goldpro.js', 'goldscalp.js', 'goldswing.js', 'goldultra.js', 'newgold.js', 'optigold.js', 'super-gold.js'];
  assert(recorders.slice().sort().join(',') === EXPECTED.join(','), 'the gold files that record through this entry point are exactly the eight expected (OMNIGOLD, TAURIC and 80PERCENT write records by another route): ' + recorders.sort().join(', '));
  assert(bare.length === 0, 'every one of them names a bar or forwards the instant (bare: ' + (bare.join(', ') || 'none') + ')');
}

console.log('== 5) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
