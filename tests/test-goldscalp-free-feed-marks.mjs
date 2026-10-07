/* HARDGATE — hg-v1155: GOLD SCALP records the free-feed legs it already scores by.

   goldRankSetups has scored ten FREE internet feeds into this desk's tally
   since they shipped — silver (Yahoo SI=F), the gold/silver ratio, VIX,
   USDJPY, the crypto Fear & Greed index, the PAXG perp funding print, the
   PAXG basis, the FRED / Yahoo real-rate tilt, the 4h EMA50/200 structure
   and the Delta gold-perp leverage cycle — and the forward record carried
   NONE of those verdicts, so the ledger could never ask which of them
   separates winners on this desk (applied, never measured: the hg-v955
   shape, the same gap hg-v1154 closed on TREND MATRIX for the post-gate).

   Each leg now marks ONE boolean (true WITH the plan, false AGAINST, absent
   when the feed was flat or unread — hg-v989's third state), the ranked row
   carries `freeReads` + `fundingPct`, GOLD SCALP's publish copy and record
   map carry them onto the ledger (`reads`, `fundingPct`), and the desk's own
   forward note prints the read split. Marks only: tally, grade, every gate
   untouched.

   Sections:
     1) the ranker, driven directly: every leg's three states, per direction
     2) end to end through the real GOLD SCALP tab with the feeds stubbed:
        records carry the marks and the funding; settled, the split can ask;
        the desk's note prints it
     3) fails open: no feed, no mark, record still written
     4) one home: the marks are written in the ranker and read nowhere else
        in goldind; the publish copy and the record map carry them; no gate
        module reads them
     5) build stamps

   Run: node tests/test-goldscalp-free-feed-marks.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
function boot(files, clock, tapes, extra){
  const FakeDate = clock ? class extends Date { static now(){ return clock.now; } } : Date;
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
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}
const RANK_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];
const TAB_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                  'goldind.js', 'gold-best-levels.js', 'goldscalp.js', 'accuracy-floor.js'];
const FREE_KEYS = ['free:silver', 'free:gsRatio', 'free:vix', 'free:usdjpy', 'free:fearGreed',
                   'free:perpFunding', 'free:paxgBasis', 'free:macroTilt', 'free:structure4h', 'free:leverageExtended'];

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the ranker marks every free-feed leg, three states, per direction ==');
{
  const W = boot(RANK_BASE);
  assert(typeof W.goldRankSetups === 'function', 'goldRankSetups exported');
  /* the PERFECT predicate stubbed so its two evidence legs are reachable */
  W.hgPerfectFormation = () => ({ perfect: false, plus: false, why: [] });
  const T4H = 14400;
  const rows4h = (slope, n) => { const o = []; for (let i = 0; i < n; i++){ const c = 2300 + i * slope; o.push({ t: 1760000000 - (n - 1 - i) * T4H, o: c, h: c + 1, l: c - 1, c, v: 100 }); } return o; };
  const NOW = Math.floor(Date.now() / 1000);
  const oiSeries = (startVal, endVal, hours) => { const o = []; const half = Math.floor(hours / 2); for (let i = 0; i < hours; i++){ const v = (i < half) ? startVal : (startVal + (endVal - startVal) * ((i - half) / (hours - 1 - half))); o.push({ t: NOW - (hours - 1 - i) * 3600, o: v, h: v, l: v, c: v, v: 0 }); } return o; };
  const fundSeries = pct => { const o = []; for (let i = 0; i < 30; i++) o.push({ t: NOW - (29 - i) * 3600, o: pct, h: pct, l: pct, c: pct, v: 0 }); return o; };
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback',
    entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  const macroAll = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                     realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };
  const ctxOf = over => Object.assign({ scanner: 'GOLDSCALP', now: Date.now(), news: { caution: false },
    rows15m: [], rows4h: [], rows1h: [] }, over || {});
  const full = dir => W.goldRankSetups([cand(dir)], ctxOf({
    macro: macroAll, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 },
    rows4h: rows4h(2, 220), perpNative: { oi: oiSeries(1000, 1200, 48), funding: fundSeries(0.05) }
  })).ranked[0];
  const L = full('long'), S = full('short');
  assert(L && S && L.freeReads && S.freeReads, 'REACHABILITY: both directions rank and carry freeReads');
  const exp = { long: { 'free:silver': true, 'free:gsRatio': true, 'free:vix': true, 'free:usdjpy': true, 'free:fearGreed': true,
                        'free:perpFunding': true, 'free:paxgBasis': true, 'free:macroTilt': true, 'free:structure4h': true, 'free:leverageExtended': true },
                short: { 'free:silver': false, 'free:gsRatio': false, 'free:vix': false, 'free:usdjpy': false, 'free:fearGreed': false,
                         'free:perpFunding': false, 'free:paxgBasis': false, 'free:macroTilt': false, 'free:structure4h': false, 'free:leverageExtended': true } };
  for (const k of FREE_KEYS){
    assert(L.freeReads[k] === exp.long[k], 'LONG ' + k + ' reads ' + exp.long[k] + ' (got ' + L.freeReads[k] + ')');
    assert(S.freeReads[k] === exp.short[k], 'SHORT ' + k + ' reads ' + exp.short[k] + ' (got ' + S.freeReads[k] + ')');
  }
  assert(Object.keys(L.freeReads).length === FREE_KEYS.length && Object.keys(L.freeReads).every(k => FREE_KEYS.indexOf(k) >= 0),
    'exactly the ten named legs, no stowaway key (' + Object.keys(L.freeReads).join(',') + ')');
  const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:_. -]{0,47}$/;
  assert(FREE_KEYS.every(k => KEY_RE.test(k)) && FREE_KEYS.length <= 16, 'every key passes the ledger normaliser (shape and the 16-per-record cap)');
  assert(L.fundingPct === -0.05 && S.fundingPct === -0.05, 'the PAXG funding rate the ranker read rides the row as a NUMBER (' + L.fundingPct + ')');
  /* the marks are marks: the tally is still the sum of its parts and the grade follows it */
  const sum = r => r.tallyParts.reduce((a, p) => a + (+p.pts || 0), 0);
  assert(L.tally === sum(L) && S.tally === sum(S), 'the tally is still exactly the sum of its parts (' + L.tally + ' / ' + S.tally + ') — a mark moves nothing');
  /* the third state: FLAT or unread marks nothing */
  const flat = W.goldRankSetups([cand('long')], ctxOf({
    macro: { silverTrend: 'FLAT', gsRatioTrend: 'FLAT', vixTrend: 'FLAT', usdjpyTrend: 'FLAT', realRateHint: null },
    fundingRate: 0.0, fng: { v: 50 }
  })).ranked[0];
  assert(flat && flat.freeReads && Object.keys(flat.freeReads).join(',') === 'free:fearGreed',
    'FLAT trends, no tilt, a funding print inside the band and no basis mark NOTHING; a readable non-extreme Fear & Greed reads false (' + JSON.stringify(flat.freeReads) + ')');
  assert(flat.freeReads['free:fearGreed'] === false, 'Fear & Greed at 50 is a READ that favoured nothing — false, not absent');
  assert(flat.fundingPct === 0, 'a funding rate of exactly zero is a READ zero on the row');
  const bare = W.goldRankSetups([cand('long')], ctxOf({})).ranked[0];
  assert(bare && bare.freeReads === undefined && bare.fundingPct === undefined, 'no free feed at all -> no freeReads and no fundingPct (absent, never a false)');
  /* funding: the sign is the direction's */
  const fL = W.goldRankSetups([cand('long')], ctxOf({ fundingRate: 0.05 })).ranked[0];
  const fS = W.goldRankSetups([cand('short')], ctxOf({ fundingRate: 0.05 })).ranked[0];
  assert(fL.freeReads['free:perpFunding'] === false && fS.freeReads['free:perpFunding'] === true, 'hot positive funding is AGAINST a long and WITH a short');
  const fTiny = W.goldRankSetups([cand('long')], ctxOf({ fundingRate: 0.0001 })).ranked[0];
  assert(fTiny.fundingPct === 0.01 && fTiny.freeReads === undefined, 'a fraction-style rate is normalised to percent (0.0001 -> 0.01) and, inside the band, marks nothing');
  /* VIX falling is the other branch: risk-on weighs on gold */
  const vL = W.goldRankSetups([cand('long')], ctxOf({ macro: { vixTrend: 'FALLING' } })).ranked[0];
  const vS = W.goldRankSetups([cand('short')], ctxOf({ macro: { vixTrend: 'FALLING' } })).ranked[0];
  assert(vL.freeReads['free:vix'] === false && vS.freeReads['free:vix'] === true, 'VIX FALLING reads AGAINST a long and WITH a short');
  /* basis: crowding is read against the crowd */
  const bL = W.goldRankSetups([cand('long')], ctxOf({ spot: { verdict: 'longs-crowding' } })).ranked[0];
  assert(bL.freeReads['free:paxgBasis'] === false, 'longs crowding the PAXG basis reads AGAINST a long');
  const bU = W.goldRankSetups([cand('long')], ctxOf({ spot: { verdict: 'unavailable' } })).ranked[0];
  assert(bU.freeReads === undefined, 'an unavailable basis verdict marks nothing');
  /* structure and leverage need the PERFECT predicate loaded; without it nothing is marked (the leg is not computed) */
  const W2 = boot(RANK_BASE);
  const noPf = W2.goldRankSetups([cand('long')], ctxOf({ rows4h: rows4h(2, 220), perpNative: { oi: oiSeries(1000, 1200, 48), funding: fundSeries(0.05) } })).ranked[0];
  assert(noPf.freeReads === undefined, 'with the PERFECT predicate absent the structure and leverage legs are not computed and mark nothing');
  const resetL = W.goldRankSetups([cand('long')], ctxOf({ perpNative: { oi: oiSeries(1000, 880, 48), funding: fundSeries(0.01) } })).ranked[0];
  assert(resetL.freeReads && resetL.freeReads['free:leverageExtended'] === false, 'a RESET leverage cycle reads false (not extended), never absent');
  const downL = W.goldRankSetups([cand('long')], ctxOf({ rows4h: rows4h(-2, 220) })).ranked[0];
  assert(downL.freeReads && downL.freeReads['free:structure4h'] === false, 'a falling 4h structure reads AGAINST a long');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) end to end: the real GOLD SCALP tab records the marks and the funding, the split can ask, the note prints it ==');
async function runTab(stubs){
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const clock = { now: WED + 16 * 60000 };   /* hg-v1156: the WED bar must be CLOSED — the desk strips a forming bar */
  const W = boot(TAB_BASE, clock, tapes, stubs);
  const tab = (W.HG_tabs || []).find(t => t && t.id === 'goldscalp');
  const r1 = await tab.refresh();
  const snap = W.goldscalpScan();
  return { W, r1, tapes, cands: (snap && snap.cands) || [], recs: W.hgFwdRecords('GOLDSCALP') };
}
{
  const macro = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                  realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };
  const r = await runTab({ getGoldMacro: async () => macro, binanceFunding: async () => ({ fundingPct: -0.05 }), S: { fng: { v: 20 } } });
  assert(r.r1 === 'refreshed' && r.cands.length > 0 && r.recs.length > 0, 'REACHABILITY: the headless scan ran, minted (' + r.cands.length + ') and recorded (' + r.recs.length + ')');
  const longs = r.recs.filter(x => x.dir === 'long'), shorts = r.recs.filter(x => x.dir === 'short');
  assert(longs.length + shorts.length === r.recs.length && r.recs.length >= 2, 'records in both directions or several in one (' + longs.length + ' long / ' + shorts.length + ' short)');
  assert(r.recs.every(x => x.reads && typeof x.reads === 'object'), 'EVERY record carries a reads bag');
  for (const k of ['free:silver', 'free:gsRatio', 'free:vix', 'free:usdjpy', 'free:fearGreed', 'free:perpFunding', 'free:macroTilt']){
    assert(longs.every(x => x.reads[k] === true) && shorts.every(x => x.reads[k] === false), k + ' rides every record: WITH on longs, AGAINST on shorts');
  }
  assert(r.recs.every(x => !('free:paxgBasis' in x.reads) && !('free:leverageExtended' in x.reads)), 'the two feeds this run never had (basis, leverage) are ABSENT on every record, not false');
  assert(r.recs.every(x => x.fundingPct === -0.05), 'the PAXG funding rate rides every record (-0.05)');
  assert(longs.every(x => x.fundAgainst === false) && shorts.every(x => x.fundAgainst === true),
    'and the ledger derived the SWING G4 verdict from it through the one rule in hg-setup-core.js: -0.05%/interval is not against a long and IS against a short (shorts pay it)');
  assert(r.recs.every(x => x.barT === SEC && x.sym === 'XAUUSD'), 'the records are still dated on the 15m signal bar and keyed on XAUUSD — nothing else moved');
  /* settle on the next bars, through the resolver the desk uses, under the record feed */
  const last = r.tapes['15m'][r.tapes['15m'].length - 1];
  const later = r.tapes['15m'].concat([
    { t: last.t + 900, o: last.c, h: last.c + 80, l: last.c - 80, c: last.c + 40, v: 1000 },
    { t: last.t + 1800, o: last.c + 40, h: last.c + 120, l: last.c - 120, c: last.c, v: 1000 }
  ]);
  r.W.hgFwdResolve('XAUUSD', '15m', later, 'xm-xauusd');
  const sp = r.W.hgFwdReadSplit('GOLDSCALP');
  assert(sp && sp.settled === r.recs.length && sp.marked === r.recs.length, 'settled, every record counts in the split with a mark (' + sp.settled + ' settled, ' + sp.marked + ' marked)');
  const sv = sp.reads['free:silver'];
  assert(sv && sv.yes.n === longs.length && sv.no.n === shorts.length, 'the split asks WITH vs AGAINST on free:silver (' + (sv && sv.yes.n) + ' / ' + (sv && sv.no.n) + ')');
  assert(!sp.reads['free:paxgBasis'], 'an unread leg has no cell — nothing is invented for it');
  const note = r.W.hgGoldFwdNote('goldscalp', undefined, 'xm-xauusd');
  assert(/FREE-FEED LEGS/.test(note) && /REPLAY READ SPLIT/.test(note) && /free:silver/.test(note) && /free:vix/.test(note), 'the desk\'s own note prints the free-feed lead and the split with the legs named');
  assert(/gates nothing/.test(note), 'and says plainly that it gates nothing');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) fails open: no feed, no mark, the record is still written ==');
{
  const r = await runTab({});
  assert(r.r1 === 'refreshed' && r.recs.length > 0, 'REACHABILITY: the scan recorded with no free feed loaded (' + r.recs.length + ')');
  assert(r.recs.every(x => x.reads === undefined && x.fundingPct === undefined && x.fundAgainst === undefined), 'no feed -> no reads bag, no funding, no verdict — absent, never false');
  const note = r.W.hgGoldFwdNote('goldscalp', undefined, 'xm-xauusd');
  assert(!/FREE-FEED LEGS/.test(note), 'the note prints no free-feed split while no record carries a mark — an empty split is not a clean bill');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) one home: written in the ranker, carried by the two seams, read by no gate ==');
{
  const gi = strip(read('goldind.js')), gs = strip(read('goldscalp.js')), gf = strip(read('gold-forward-read.js'));
  const writes = (gi.match(/freeMark\(/g) || []).length;
  /* hg-v1158: the indicator-stack loop hands the `ind:` marks through the
     SAME helper, which is the point. hg-v1162: the eight free-feed legs mark
     through ONE loop over the one home's verdicts (hgGoldFreeFeedVerdicts),
     so the sites are: that loop, the two PERFECT legs, the ind: loop. */
  assert(writes === 5, 'the ranker writes its marks through one helper at four sites (the free-feed verdict loop, structure4h, leverageExtended, the ind: loop) — ' + (writes - 1) + ' call sites + the definition');
  assert(/var fv = hgGoldFreeFeedVerdicts\(ctx, c\.dir\)/.test(gi), 'hg-v1162: the free-feed verdicts come from the one home');
  assert(/rc\.freeReads = freeReads;/.test(gi) && /rc\.fundingPct = fundRate;/.test(gi), 'the ranked row carries freeReads and the funding rate');
  assert(!/c\.freeReads|rc\.freeReads\s*[^=]/.test(gi.replace('rc.freeReads = freeReads;', '')), 'goldind READS freeReads nowhere — the marks gate nothing in the ranker');
  assert(/freeReads: \(c\.freeReads && typeof c\.freeReads === 'object'\) \? c\.freeReads : undefined,/.test(gs), 'GOLD SCALP publish copy carries freeReads (the hg-v955 seam)');
  assert(/fundingPct: \(typeof c\.fundingPct === 'number' && isFinite\(c\.fundingPct\)\) \? c\.fundingPct : undefined,/.test(gs), 'and the funding rate, as a number only');
  assert(/reads: c\.freeReads,\s*fundingPct: c\.fundingPct,/.test(gs), 'the record map hands both to the ledger by property access (the lifted-map test stays self-contained)');
  assert(/hgFwdReadSplitHtml\(rdPools\[ri\]\)/.test(gf) && /FREE-FEED LEGS/.test(gf), 'the gold note renders the read split per pool');
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f));
  /* hg-v1162: GOLD PINE and 80PERCENT CARRY and RENDER the marks (their
     own guard proves neither gates on them); no other file touches them */
  const CARRIERS = ['goldpine.js', 'eightypercent.js', 'omnigold.js', 'ganeshgold.js'];   /* hg-v1163: two more carriers */
  const readers = files.filter(f => f !== 'goldind.js' && f !== 'goldscalp.js' && CARRIERS.indexOf(f) < 0 && /freeReads/.test(strip(read(f))));
  assert(readers.length === 0, 'no file beyond the two hg-v1162 carriers reads freeReads (' + readers.join(', ') + ')');
  for (const g of ['hg-gates.js', 'cryptogates.js', 'gold-formation.js', 'hg-solidity.js', 'conviction-lock.js', 'hg-forward.js'])
    assert(!/free:(silver|gsRatio|vix|usdjpy|fearGreed|perpFunding|paxgBasis|macroTilt|structure4h|leverageExtended)/.test(strip(read(g))), g + ' names none of the free-feed marks');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
