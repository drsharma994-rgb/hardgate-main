/* HARDGATE -- hg-v977: the two HOME gold desks judged their own signal on the
   wall clock, and SUPER GOLD's per-candidate instant reader had nothing to read.

   hg-v952 (SUPER GOLD), hg-v963 (GOLD ULTRA / DIRECTION), hg-v973 (GOLD PINE),
   hg-v974 (OMNIGOLD bridge, STAR TRADER) and hg-v975 (the inline GOLD tab)
   each moved a borrowing desk from Date.now() to the signal bar -- and GOLD
   SCALP and GOLD SWING, the desks the mints BELONG to, went on handing
   Date.now() to their own mint (news gate, weekend mark), the killzone stamp,
   the ranker's news caution, the watch list, the best-levels session boost,
   the Part-engine news gates, the A+ cash-open read and the forming stack.
   On GOLD SWING the last closed 4h bar can sit four hours behind the clock.
   Measured on the shipped tree with the same bars: GOLD SCALP read 7 grade-A
   candidates in the NY session with the clock 5 min past the bar and 7 with
   two downgraded to B and every one stamped OFF-SESSION with it 6 h past; a
   CPI 10 min after the bar locked both desks under the first clock and
   neither under the second. And SUPER GOLD's sgCandSec (hg-v952) read
   c.signalT on every candidate and fell back to the wall clock every time,
   because no mint ever wrote that field.

   Sections:
     1) GOLD SCALP driven end to end under two wall clocks: same board, the
        bar's session, the news gate on the bar; the scan stamp keeps the clock
     2) GOLD SWING, the same
     3) the mints stamp signalT; the snapshots carry it
     4) SUPER GOLD reads it: the best-levels instant and the rank instant
     5) the OMNIGOLD engines panel (textual, and says so) and the wall-time
        seats that keep the clock
     6) build stamps
   Run: node tests/test-gold-home-desks-signal-bar.mjs */
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
/* a desk booted under a PATCHED wall clock, with the XM bridge stubbed to
   serve the fixture tapes (so the feed is the broker feed and nothing else
   is fetched) and the news snapshot stubbed */
function boot(files, wall, news, tapes){
  const FakeDate = class extends Date { static now(){ return wall; } };
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
const BASE = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'gold-best-levels.js'];
const CPI = { events: [{ title: 'US CPI m/m', t: WED + 10 * 60000 }] };
const CPI_LATER = { events: [{ title: 'US CPI m/m', t: WED + 3 * 3600000 }] };
/* a high-impact release that is NOT tier-1: it cautions (the ranker's -2 news
   part, grade A -> B) without locking the mint, so the CAUTION instant is
   observable on a board that still forms */
const RETAIL = { events: [{ title: 'US Retail Sales m/m', impact: 'high', t: WED + 10 * 60000 }] };
const newsPart = c => (c.tallyParts || []).filter(p => /high-impact news window/.test(p.label || '')).map(p => p.pts).join(',');
const NEAR = WED + 5 * 60000, FAR = WED + 6 * 3600000;
const desc = cands => cands.map(c => [c.stratKey, c.dir, c.grade, c.killzone || c.session || '', (c.stamps || []).slice().sort().join('/'), c.tally].join('|')).join(' ~ ');
async function drive(files, tabId, snapFn, wall, news, tapes){
  const W = boot(files, wall, news, tapes);
  const tab = (W.HG_tabs || []).find(t => t && t.id === tabId);
  const r = await Promise.race([tab.refresh(), new Promise(res => setTimeout(() => res('TIMEOUT'), 60000))]);
  const snap = (typeof W[snapFn] === 'function') ? W[snapFn]() : null;
  return { r, snap, cands: (snap && snap.cands) || [] };
}

console.log('== 1) GOLD SCALP under two wall clocks ==');
{
  const files = BASE.concat(['goldscalp.js']);
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const a = await drive(files, 'goldscalp', 'goldscalpScan', NEAR, null, tapes);
  const b = await drive(files, 'goldscalp', 'goldscalpScan', FAR, null, tapes);
  assert(a.r === 'refreshed' && a.cands.length > 0, 'REACHABILITY: the headless scan ran and minted (' + a.cands.length + ' candidates)');
  assert(desc(a.cands) === desc(b.cands), 'the board is IDENTICAL with the clock 5 min and 6 h past the bar: stratKey, dir, grade, session, stamps, tally');
  assert(a.cands.every(c => /NY AM/.test(c.killzone || '')) && b.cands.every(c => /NY AM/.test(c.killzone || '')), 'the session stamp is the BAR session (NY AM at 12:00 GMT) under both clocks -- 6 h past the bar it used to read OFF-HOURS and downgrade two to B');
  assert(!b.cands.some(c => (c.stamps || []).indexOf('OFF-SESSION') >= 0), 'no OFF-SESSION demote under the far clock');
  assert(a.snap.at === NEAR && b.snap.at === FAR, 'the scan STAMP keeps the wall clock (it says when the scan ran)');
  const l1 = await drive(files, 'goldscalp', 'goldscalpScan', NEAR, CPI, tapes);
  const l2 = await drive(files, 'goldscalp', 'goldscalpScan', FAR, CPI, tapes);
  assert(l1.cands.length === 0 && l2.cands.length === 0, 'a CPI ten minutes after the bar LOCKS the desk under both clocks (' + l1.cands.length + ' / ' + l2.cands.length + ') -- 6 h past the bar it used to mint 7');
  assert(/NEWS GATE/.test(l2.snap.whySilent || ''), 'and the far-clock scan says why: ' + String(l2.snap.whySilent || '').slice(0, 60));
  const o = await drive(files, 'goldscalp', 'goldscalpScan', FAR, CPI_LATER, tapes);
  assert(o.cands.length === a.cands.length, 'a release three hours out mints again (' + o.cands.length + ') -- a gate that never opens is not a gate');
  assert(a.cands.every(c => c.signalT === WED), 'every published candidate carries signalT = the 15m signal bar');
  const r1 = await drive(files, 'goldscalp', 'goldscalpScan', NEAR, RETAIL, tapes);
  const r2 = await drive(files, 'goldscalp', 'goldscalpScan', FAR, RETAIL, tapes);
  assert(r1.cands.length === a.cands.length && r2.cands.length === a.cands.length, 'a high-impact release that is not tier-1 still mints (' + r1.cands.length + ' / ' + r2.cands.length + ')');
  assert(r1.cands.every(c => newsPart(c) === '-2') && r2.cands.every(c => newsPart(c) === '-2') && desc(r1.cands) === desc(r2.cands), 'the ranker CAUTION (-2 news part, grade A -> B) reads the BAR under both clocks -- 6 h past the bar it used to read no window at all');
}

console.log('== 2) GOLD SWING under two wall clocks ==');
{
  const files = BASE.concat(['goldswing.js']);
  const tapes = { '4h': tapeEnding(WED, 300, 14400, 103, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3), '1h': tapeEnding(WED, 220, 3600, 103, 30) };
  const a = await drive(files, 'goldswing', 'goldswingScan', NEAR, null, tapes);
  const b = await drive(files, 'goldswing', 'goldswingScan', FAR, null, tapes);
  assert(a.r === 'refreshed' && a.cands.length > 0, 'REACHABILITY: the headless swing scan ran and minted (' + a.cands.length + ' candidates)');
  assert(desc(a.cands) === desc(b.cands), 'the swing board is IDENTICAL under both clocks');
  assert(a.cands.every(c => /NY AM/.test(c.session || '')) && b.cands.every(c => /NY AM/.test(c.session || '')), 'the session label is the 4h BAR session under both clocks (' + (b.cands[0] && b.cands[0].session) + ') -- it used to read OFF-HOURS 6 h past the bar');
  assert(a.snap.at === NEAR && b.snap.at === FAR, 'the swing scan stamp keeps the wall clock');
  const l1 = await drive(files, 'goldswing', 'goldswingScan', NEAR, CPI, tapes);
  const l2 = await drive(files, 'goldswing', 'goldswingScan', FAR, CPI, tapes);
  assert(l1.cands.length === 0 && l2.cands.length === 0, 'a CPI ten minutes after the 4h bar LOCKS the swing desk under both clocks (' + l1.cands.length + ' / ' + l2.cands.length + ')');
  const o = await drive(files, 'goldswing', 'goldswingScan', FAR, CPI_LATER, tapes);
  assert(o.cands.length === a.cands.length, 'a release three hours out mints again (' + o.cands.length + ')');
  assert(a.cands.every(c => c.signalT === WED), 'every published swing candidate carries signalT = the 4h signal bar');
  const r1 = await drive(files, 'goldswing', 'goldswingScan', NEAR, RETAIL, tapes);
  const r2 = await drive(files, 'goldswing', 'goldswingScan', FAR, RETAIL, tapes);
  assert(r1.cands.length === a.cands.length && r2.cands.length === a.cands.length && r1.cands.every(c => newsPart(c) === '-2') && r2.cands.every(c => newsPart(c) === '-2') && desc(r1.cands) === desc(r2.cands), 'the swing caution (re-read on the 4h bar once the bars arrive) carries the -2 news part under both clocks (' + r2.cands.map(newsPart).join('/') + ')');
}

console.log('== 3) the mints stamp the instant they judged on ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'goldswing.js'], Date.now(), undefined, null);
  const got = W.goldScalpSetups({ rows15m: tapeEnding(WED, 420, 900, 102, 24), rows1h: tapeEnding(WED, 220, 3600, 103, 30), rows4h: tapeEnding(WED, 140, 14400, 104, 40), now: WED });
  assert(got.length > 0 && got.every(c => c.signalT === WED), 'the scalp mint stamps signalT = inp.now on every candidate (' + got.length + ')');
  const sw = W.goldSwingSetups({ rows4h: tapeEnding(WED, 300, 14400, 103, 40, -0.3), rows1d: tapeEnding(WED, 150, 86400, 106, 60, -0.3), now: WED });
  assert((sw.ranked || []).length > 0 && sw.ranked.every(c => c.signalT === WED), 'the swing mint stamps signalT = inp.now on every candidate (' + (sw.ranked || []).length + ')');
  const src = read('goldscalp.js') + read('goldswing.js');
  assert((src.match(/signalT: \(typeof c\.signalT === 'number' && isFinite\(c\.signalT\)\) \? c\.signalT : null/g) || []).length === 2, 'both publishScan copies carry the field across the publish boundary (the hg-v955 seam), null when the mint wrote none');
}

console.log('== 4) SUPER GOLD reads it ==');
{
  const W = boot(['super-gold.js'], FAR, undefined, null);
  const calls = [];
  W.hgApplyGoldBestLevels = (gc, inp) => { calls.push(inp); return { ok: true }; };
  const rows15 = tapeEnding(WED, 60, 900, 6, 24);
  W.refineSuperGoldLevels(W, { rows15m: rows15, signalT: WED, entry: 2300, stop: 2290, t1: 2320 }, { tier: 'clean', dir: 'long', scanner: 'gold-scalp', entry: 2300, stop: 2290, t1: 2320 });
  assert(calls.length === 1 && calls[0].nowMs === WED, 'the best-levels pass gets the CANDIDATE instant (' + (calls[0] && calls[0].nowMs) + ' = the bar), not the wall clock 6 h later');
  calls.length = 0;
  W.refineSuperGoldLevels(W, { rows15m: rows15, entry: 2300, stop: 2290, t1: 2320 }, { tier: 'clean', dir: 'long', scanner: 'gold-scalp', entry: 2300, stop: 2290, t1: 2320 });
  assert(calls.length === 1 && calls[0].nowMs === FAR, 'a candidate carrying no instant falls back to the wall clock, as before');
  assert(W.sgRankInstant([{ signalT: WED - 3600000 }, { signalT: WED }, {}]) === WED, 'the rank instant is the NEWEST signal bar among the candidates');
  assert(W.sgRankInstant([]) === FAR && W.sgRankInstant(null) === FAR && W.sgRankInstant([{}]) === FAR, 'with no instant among them, the wall clock');
  assert(W.buildGoldRankCtx(W, [{ signalT: WED }]).now === WED && W.buildGoldRankCtx(W).now === FAR, 'buildGoldRankCtx carries it; the old one-argument call still works');
  const seen = [];
  W.goldRankSetups = (cands, ctx) => { seen.push(ctx.now); return { ranked: cands.slice(), best: cands[0] }; };
  W.rankRawGoldCands(W, [{ id: 'a', signalT: WED, dir: 'long' }]);
  assert(seen.length === 1 && seen[0] === WED, 'rankRawGoldCands hands the ranker the candidates\' own instant, not Date.now()');
}

console.log('== 5) the OMNIGOLD engines panel, and the seats that keep the clock ==');
{
  /* deliberately TEXTUAL (hg-v956): the paint lives inside the module's own
     scan state and is not lifted; whether it reads the bar is a property of
     the source */
  const og = read('omnigold.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = og.indexOf('function hgOgPaintGoldEngines(');
  const j = og.indexOf('hgOgGoldEnginesPanelHtml(bridge, tapeDir)', i);
  const blk = og.slice(i, j);
  assert(i > 0 && j > i && /now: hgOgRowsBarMs\(__og\.lastRows\.m15 \|\| __og\.lastRows\.scalp \|\| \[\], Date\.now\(\)\)/.test(blk) && !/now: Date\.now\(\)/.test(blk), 'the forming stack on the OMNIGOLD engines panel reads the 15m signal bar, the wall clock only as the fallback');
  assert(/function hgOgRowsBarMs\(rows, fallback\)\{[\s\S]*?gfn\('hgGoldSignalBarMs'\)/.test(og), 'through the ONE bar reader');
  /* the wall-time seats: conviction age, the scan stamp, the weekend
     exposure countdown and demote -- these ARE wall time and stay on `now` */
  const gs = read('goldscalp.js').replace(/\/\*[\s\S]*?\*\//g, ''), gw = read('goldswing.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/applyConviction\(ranked, venueRows, now, newsVeto\)/.test(gs) && /applyConviction\(ranked, venueRows, now\)/.test(gw), 'conviction age is judged on the wall clock on both desks (a position\'s age is wall time)');
  assert(/publishScan\(display, displayBest, lock\.store\.history, now,/.test(gs) && /publishScan\(display, displayBest, lock\.store\.history, now,/.test(gw), 'the scan stamp is the wall clock on both desks');
  assert(/paintGoldWeekendPanel\(ui, wkRows, now, displayBest\)/.test(gs) && /paintGoldWeekendPanel\(ui, gold\.rows4h, now, displayBest\)/.test(gw) && /wkFn\(ranked, gold\.rows4h, atrW, now\)/.test(gs) && /wkFn\(ranked, gold\.rows4h, atrW, now\)/.test(gw), 'the weekend-exposure countdown and demote read the wall clock (how far the close is from NOW)');
  /* and the signal seats read the bar, on both desks */
  assert(/buildCandidates\(gold, barNow, news, v, sym1, scalpBundle\)/.test(gs) && /buildCandidates\(gold, barNow, newsC, ctx\.macro, sessionTxt, v, sym1, microOpts\)/.test(gw), 'both mints are handed the signal bar');
  assert(/goldApplyBestLevelsBatch\(ranked, venueRows, gold, atrW, barNow\)/.test(gs) && /goldApplyBestLevelsBatch\(ranked, gold, atrW, barNow\)/.test(gw), 'the best-levels session boost is judged on the bar on both desks');
  assert((gw.match(/gfn\('hgGoldNewsGate'\)\(newsRaw, barNow\)/g) || []).length === 9 && !/gfn\('hgGoldNewsGate'\)\(newsRaw, now\)/.test(gw), 'all nine Part-engine news gates on GOLD SWING read the bar');
  /* the DISPLAY seats -- the killzone read behind the A+ panel, the A+
     context, the forming stack, the watch list -- paint HTML the snapshot
     does not carry, so they are asserted TEXTUALLY and say so (hg-v956) */
  assert(/var kz2 = kzFn2\(barNow\)/.test(gs) && /goldBuildAPlusCtx\(ctx, gold, barNow, news\)/.test(gs) && /dxyRows: ctx\.macro && ctx\.macro\.dxyRows, now: barNow,/.test(gs) && /rows4h: rows4h, now: barNow, tf: '15m'/.test(gs), 'GOLD SCALP: the killzone read, the A+ context, the forming stack and the watch list read the bar (textual)');
  assert(/goldBuildAPlusCtx\(ctx, gold, barNow, newsC\)/.test(gw) && /dxyRows: ctx\.macro && ctx\.macro\.dxyRows, now: barNow,/.test(gw) && /buildWatch\(leg, barNow, ctx\.macro, venue\)/.test(gw), 'GOLD SWING: the A+ context, the forming stack and the watch list read the bar (textual)');
}

console.log('== 6) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
