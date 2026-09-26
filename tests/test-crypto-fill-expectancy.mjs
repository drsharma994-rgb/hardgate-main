/* HARDGATE -- hg-v983: the solidity grader's measured-edge gates judged on the
   actual-tally expectancy, and no fill-aware expectancy existed for them to read.

   hgSolGateMeasuredEdge (G6, veto under -0.25R) and hgSolGateMeasuredWinning
   (G7, promotion at or over +0.5R) grade the cards on OMNIROUTE, REVERSAL
   SNIPER, DEX SCREENER, OMNIGOLD, NEW GOLD and GOLD PINE from hgFwdStats'
   expR -- the expectancy of the actual tally, which settles a resting order
   the tape never reached as a win or a loss. hg-v981 gave those records a
   mark, hg-v982 gave the two mechanic judges one fill-aware rule -- and the
   ledger carried a fill-aware HIT and no fill-aware EXPECTANCY, so the one
   gate that judges expectancy had nothing to read (said in hg-v982, wired
   here). hgFwdStats now carries fillExpR (mirroring expR term for term,
   through the aggregate fold too), the shared judge carries the expectancy
   of whichever sample it chose, and G6 / G7 read it.

   Run: node tests/test-crypto-fill-expectancy.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0;
function assert(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function strip(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
function boot(files, clock){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Intl, parseInt, parseFloat,
              NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map };
  s.Date = clock ? new Proxy(Date, { construct(T, a){ return a.length ? new T(...a) : new T(clock.now); },
                                     get(T, k){ return k === 'now' ? () => clock.now : T[k]; } }) : Date;
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){} }),
                 head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}
const WED = Date.UTC(2026, 3, 8, 12, 0, 0), SEC = WED / 1000;
function tape(n, o){
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: SEC + (i + 1) * 3600, o: o.o, h: i >= 3 ? o.hHi : o.h, l: i >= 3 ? (o.lLo || o.l) : o.l, c: o.c, v: 1 });
  return out;
}
const close = (a, b) => Math.abs(a - b) < 1e-9;
/* OMNIROUTE-shaped resting longs: level 100 under a mark of 102, stop 98, target 106 (rr 3) */
const rec = (i, x) => Object.assign({ sym: 'S' + i, dir: 'long', entry: 100, stop: 98, t1: 106, mechanic: 'FVG-FILL', barT: SEC, mark: 102 }, x || {});
const never  = tape(30, { o: 102.5, h: 103, hHi: 107, l: 101, c: 102.4 });                 /* never reaches 100, reaches 106 */
const fillWin = tape(30, { o: 102.5, h: 103, hHi: 107, l: 99.5, c: 102.4 });              /* dips to the level, then reaches 106 */
const fillLoss = tape(30, { o: 102.5, h: 103, hHi: 103, l: 99.5, lLo: 97, c: 102.4 });    /* dips to the level, then to the stop */

console.log('== 1) the ledger carries the expectancy of the orders that opened, and it differs from the actual one ==');
{
  const W = boot(['hg-forward.js'], { now: WED + 5 * 60000 });
  const rows = []; for (let i = 0; i < 12; i++) rows.push(rec(i));
  assert(W.hgFwdRecordScan('OMNIROUTE', '1h', rows, { horizonBars: 20 }) === 12, 'REACHABILITY: 12 resting records');
  for (let i = 0; i < 12; i++) W.hgFwdResolve('S' + i, '1h', i < 4 ? fillWin : (i < 8 ? fillLoss : never), undefined);
  const st = W.hgFwdStats('OMNIROUTE', 'FVG-FILL', false);
  assert(st.samples === 12 && st.wins === 8 && st.losses === 4, 'the actual tally settles all 12: 8 target hits (4 of them orders that never opened) and 4 stops');
  assert(close(st.expR, (8 / 12) * 3 - (4 / 12)), 'actual expectancy reads +' + st.expR.toFixed(3) + 'R -- inflated by four wins nobody could have had');
  assert(st.fillSamples === 8 && st.fillWins === 4 && st.fillLosses === 4 && st.fillUnfilled === 4, 'the fill-aware tally: 4 filled and won, 4 filled and lost, 4 never filled');
  assert(isFinite(st.fillExpR) && close(st.fillExpR, 0.5 * 3 - 0.5), 'fillExpR is the expectancy of the orders that opened: +' + st.fillExpR.toFixed(3) + 'R against +' + st.expR.toFixed(3) + 'R actual');
  assert(close(st.fillAvgRr, 3), 'fillAvgRr is the R the fill walk booked on its winners');
  /* mirrors expR term for term on the edge cases */
  const W2 = boot(['hg-forward.js'], { now: WED + 5 * 60000 });
  W2.hgFwdRecordScan('X', '1h', [rec(0), rec(1)], { horizonBars: 20 });
  W2.hgFwdResolve('S0', '1h', fillLoss, undefined); W2.hgFwdResolve('S1', '1h', never, undefined);
  const s2 = W2.hgFwdStats('X', 'FVG-FILL', false);
  assert(s2.fillExpR === -1 && s2.fillSamples === 1, 'no fill-aware winner -> exactly -1R, the same rule expR states (every order that opened lost 1R)');
  const W3 = boot(['hg-forward.js'], { now: WED + 5 * 60000 });
  W3.hgFwdRecordScan('Y', '1h', [rec(0, { mark: undefined })], { horizonBars: 20 });
  W3.hgFwdResolve('S0', '1h', fillWin, undefined);
  const s3 = W3.hgFwdStats('Y', 'FVG-FILL', false);
  assert(s3.samples === 1 && s3.fillSamples === 0 && isNaN(s3.fillExpR) && isNaN(s3.fillAvgRr), 'a legacy record (no mark) has no fill-aware expectancy: NaN, never zero');
}

console.log('== 2) the aggregate fold carries it, so pruned records keep deciding ==');
{
  const W = boot(['hg-forward.js']);
  const settled = [
    { tab: 'T', mechanic: 'M', state: 't1', rr: 3, stateFill: 't1', rFill: 3, gateClear: true, shown: true },
    { tab: 'T', mechanic: 'M', state: 't1', rr: 2, stateFill: 't1', rFill: 2, gateClear: true, shown: true },
    { tab: 'T', mechanic: 'M', state: 'stop', rr: 3, stateFill: 'stop', rFill: -1, gateClear: true, shown: true },
    { tab: 'T', mechanic: 'M', state: 't1', rr: 3, fillState: 'unfilled', gateClear: true, shown: true }
  ];
  const agg = W.hgFwdFold({}, settled);
  const gc = agg['T|M'] && agg['T|M'].gc;
  assert(!!gc && gc.fillWins === 2 && gc.fillLosses === 1 && gc.fillUnfilled === 1, 'REACHABILITY: the fold counts the fill split');
  assert(gc.fillRrSum === 5, 'and sums the R the fill walk booked on its winners (3 + 2)');
  assert(agg['T|M'].sh && agg['T|M'].sh.fillRrSum === 5, 'on the shown bucket too');
  /* a stats read over the aggregate alone (no live records) reproduces it */
  const st = W.hgFwdStatsOf([], 'T', 'M', { gateClear: true }, agg);
  assert(st && st.fillSamples === 3 && close(st.fillExpR, (2 / 3) * 2.5 - (1 / 3)), 'a gate-clear read from the aggregate alone carries fillExpR (' + (st && st.fillExpR && st.fillExpR.toFixed(3)) + 'R)');
  /* the legacy aggregate shape (no fillRrSum) reads as no fill expectancy, never as a fabricated one */
  const legacy = { 'T|M': { gc: { wins: 4, losses: 16, expired: 0, rrSum: 8, fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 } } };
  const sl = W.hgFwdStatsOf([], 'T', 'M', { gateClear: true }, legacy);
  assert(sl && sl.samples === 20 && isNaN(sl.fillExpR), 'an aggregate written before this pack reads NaN for the fill expectancy');
}

console.log('== 3) the shared judge carries the expectancy of the sample it chose ==');
{
  const W = boot(['hg-forward.js']);
  const J = W.hgFwdJudgeSample;
  const a = J({ samples: 30, hit: 0.5, expR: 0.4 }, 20);
  assert(a.fillAware === false && a.expR === 0.4, 'the actual tally: its own expectancy');
  const f = J({ samples: 30, hit: 0.5, expR: 0.4, fillSamples: 22, fillHit: 0.2, fillExpR: -0.4, fillUnfilled: 8 }, 20);
  assert(f.fillAware === true && f.expR === -0.4 && f.n === 22, 'the fill-aware tally: the fill-aware expectancy');
  const thin = J({ samples: 30, hit: 0.5, expR: 0.4, fillSamples: 19, fillHit: 0.2, fillExpR: -0.4 }, 20);
  assert(thin.fillAware === false && thin.expR === 0.4, 'under the floor the actual expectancy stands');
  const nan = J({ samples: 30, hit: 0.5, expR: 0.4, fillSamples: 22, fillHit: 0.2, fillExpR: null }, 20);
  assert(nan.fillAware === true && isNaN(nan.expR), 'a fill-aware sample with no readable expectancy hands back NaN, not zero');
  assert(isNaN(J({ samples: 10, hit: 0.5, expR: 0.4 }, 20).expR), 'and an actual tally under the floor carries none');
}

console.log('== 4) the solidity grader: G6 and G7 judge on the sample the rule chooses ==');
{
  const W = boot(['hg-forward.js', 'hg-solidity.js']);
  const p = { dir: 'long', rr1: 3.0, minRr: 2.0, consensus: { nAgree: 3 }, liveGrade: 'fresh', tape: 'long', stopWidened: false };
  const grade = stats => { W.hgFwdStats = () => stats; return W.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' }); };
  /* the actual tally alone: 47 settled at +0.30R -- G6 passes */
  const legacy = grade({ samples: 47, expR: 0.30, hit: 0.5 });
  assert(legacy.gates.measuredEdge.pass === true && legacy.gates.measuredEdge.source === 'measured' && legacy.gates.measuredEdge.fill === false && legacy.gates.measuredEdge.samples === 47,
    'REACHABILITY: 47 settled at +0.30R pass G6 on the actual tally, exactly as before');
  /* THE DEFECT: of those 47, 25 opened and those 25 read -0.40R; 12 never filled
     and were settled as wins -- the actual tally still says +0.30R */
  const judged = grade({ samples: 47, expR: 0.30, hit: 0.5, fillSamples: 25, fillHit: 0.2, fillExpR: -0.40, fillUnfilled: 12 });
  const g6 = judged.gates.measuredEdge;
  assert(g6.pass === false && g6.source === 'measured' && g6.fill === true && g6.samples === 25 && close(g6.expR, -0.40),
    'with the fill-aware expectancy G6 VETOES: the orders that opened lost -0.40R over 25');
  const r = W.hgSolidityReasons(judged);
  assert(/✗ measured-edge: measured -0\.40R over 25 FILLED samples/.test(r) && /12 never filled, excluded/.test(r), 'and the reason line says FILLED and how many were excluded: ' + (r.match(/measured-edge:[^\n]*/) || [''])[0]);
  /* under the floor the actual tally decides and nothing is labelled FILLED */
  const thin = grade({ samples: 47, expR: 0.30, hit: 0.5, fillSamples: 19, fillHit: 0.2, fillExpR: -0.40, fillUnfilled: 12 });
  assert(thin.gates.measuredEdge.pass === true && thin.gates.measuredEdge.fill === false && !/FILLED/.test(W.hgSolidityReasons(thin)), '19 fill-aware records are under the floor: the actual tally decides, no FILLED label');
  /* a fill-aware sample with no readable expectancy falls back to the actual one */
  const nanF = grade({ samples: 47, expR: 0.30, hit: 0.5, fillSamples: 25, fillHit: 0.2, fillExpR: null });
  assert(nanF.gates.measuredEdge.pass === true && nanF.gates.measuredEdge.fill === false, 'a fill-aware tally with no readable expectancy is not preferred');
  /* G7: the actual tally promotes at +0.72R, the orders that opened made +0.30R -> no promotion */
  const g7a = grade({ samples: 60, expR: 0.72, hit: 0.6 }).gates.measuredWinning;
  assert(g7a.pass === true && g7a.fill === false, 'REACHABILITY: 60 settled at +0.72R promote on the actual tally');
  const g7b = grade({ samples: 60, expR: 0.72, hit: 0.6, fillSamples: 40, fillHit: 0.45, fillExpR: 0.30, fillUnfilled: 15 }).gates.measuredWinning;
  assert(g7b.pass === false && g7b.fill === true && g7b.samples === 40 && close(g7b.expR, 0.30), 'the same book judged on the 40 that opened (+0.30R) does NOT promote');
  const g7c = grade({ samples: 60, expR: 0.72, hit: 0.6, fillSamples: 40, fillHit: 0.6, fillExpR: 0.9 }).gates.measuredWinning;
  assert(g7c.pass === true && g7c.fill === true, 'and a fill-aware book that pays promotes, labelled FILLED');
  assert(/measured-winning: measured 0\.90R over 40 FILLED samples/.test(W.hgSolidityReasons(grade({ samples: 60, expR: 0.72, hit: 0.6, fillSamples: 40, fillHit: 0.6, fillExpR: 0.9 }))), 'the G7 reason line labels it');
  /* with hg-forward absent the grader reads the actual tally exactly as it always did */
  const W0 = boot(['hg-solidity.js']);
  W0.hgFwdStats = () => ({ samples: 47, expR: 0.30, hit: 0.5, fillSamples: 25, fillHit: 0.2, fillExpR: -0.40 });
  const g0 = W0.hgSolidityGrade(p, { tab: 'OMNIROUTE', kind: 'FVG' }).gates.measuredEdge;
  assert(g0.pass === true && g0.fill === false && g0.samples === 47, 'with no shared rule loaded the grader falls back to the actual tally (fail-open, as before)');
}

console.log('== 5) the KIND PERFORMANCE panel prints the fill-aware expectancy beside the hit ==');
{
  const W = boot(['hg-forward.js', 'hg-perf-panel.js']);
  const h = W.hgPerfFillHtml({ fillWins: 3, fillLosses: 2, fillUnfilled: 4, fillExpR: 0.42 });
  assert(/fill 5 \(3W\/2L 60%\) \+0\.42R/.test(h), 'prints the fill-aware expectancy after the split: ' + h.replace(/<[^>]+>/g, ''));
  assert(/fill 5 \(3W\/2L 60%\) -1\.00R/.test(W.hgPerfFillHtml({ fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillWins: 3, fillLosses: 2, fillExpR: -1 })), 'a negative one prints signed');
  assert(!/R<\/span>|\dR/.test(W.hgPerfFillHtml({ fillWins: 3, fillLosses: 2 })), 'no fill-aware expectancy, no figure (a stat written before this pack)');
}

console.log('== 6) one rule: neither the grader nor the two desk judges compute a fill expectancy of their own ==');
{
  const sol = strip(read('hg-solidity.js'));
  assert(/hgFwdJudgeSample\(stats, HG_SOL_MIN_EDGE_SAMPLES\)/.test(sol), 'the grader asks the shared rule with its own sample floor');
  assert((sol.match(/= hgSolJudge\(W, stats\)/g) || []).length === 2, 'and both gates go through the one local seam');
  assert(!/fillExpR|fillRrSum/.test(sol), 'the grader reads no fill field itself');
  assert(!/fillExpR|fillRrSum/.test(strip(read('omniroute.js'))) && !/fillExpR|fillRrSum/.test(strip(read('omnigold.js'))), 'nor do OMNIROUTE or OMNIGOLD');
  const fwd = strip(read('hg-forward.js'));
  assert((fwd.match(/fillRrSum \+= /g) || []).length === 3 && /fillRrSum: 0/.test(fwd), 'the ledger sums it in the live pass, reads it off the fold and sums it in the fold, and the fold blank carries it');
}

console.log('== 7) the stamp ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
  assert(/hg-v983/.test(read('AGENTS.md')), 'AGENTS.md records hg-v983');
}
console.log('\n' + (process.exitCode ? 'FAILED' : 'PASSED') + ' ' + passed + ' assertions');
