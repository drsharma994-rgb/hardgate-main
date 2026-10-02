/* HARDGATE — hg-v1030: THE PERFECT⁺ TIER + the three evidence legs it rides on. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function bootPerfect(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, TypeError, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-perfect-setup.js'), 'utf8'), ctx, { filename: 'hg-perfect-setup.js' });
  return ctx;
}

function store(){ const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; }
function bootForward(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.Date = Date;
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = store(); ctx.sessionStorage = store();
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

const W = bootPerfect();
const PF = W.hgPerfectFormation;

function perfect(d, over){
  over = over || {};
  const long = d === 'long';
  return Object.assign({
    dir: long ? 'long' : 'short', grade: 'A', demoted: false, vetoed: false,
    oppose: 0, tally: 6,
    entry: 2300, stop: long ? 2290 : 2310, t1: long ? 2313 : 2287
  }, over);
}

console.log('== the three NEW evidence legs (fail-open) ==');
assert(PF(perfect('long')).perfect === true, 'baseline: evidence-silent long is PERFECT');
assert(PF(perfect('long'), { newsRisk: 'low' }).perfect === true, 'news LOW → still perfect');
assert(PF(perfect('long'), { newsRisk: 'high' }).perfect === true, 'news HIGH is caution, not a perfect-denier');
assert(PF(perfect('long'), { newsRisk: 'blackout' }).perfect === false, 'news BLACKOUT → not perfect');
assert(PF(perfect('long'), { newsRisk: null }).perfect === true, 'news unread → NOT a disqualifier (third state)');
assert(PF(perfect('long'), { sess: 'participating' }).perfect === true, 'session participating → still perfect');
assert(PF(perfect('long'), { sess: 'thin' }).perfect === false, 'thin/dead tape → not perfect');
assert(PF(perfect('long'), { sess: null }).perfect === true, 'session unread → NOT a disqualifier');
assert(PF(perfect('long'), { volumeRvol: 1.4 }).perfect === true, 'RVOL 1.4 (with) → still perfect');
assert(PF(perfect('long'), { volumeRvol: 0.5 }).perfect === false, 'RVOL 0.5 (below floor) → volume witness against');
assert(PF(perfect('long'), { volumeRvol: null }).perfect === true, 'RVOL unread → NOT a disqualifier');
assert(PF(perfect('short'), { newsRisk: 'blackout' }).perfect === false, 'short + blackout → not perfect (direction parity)');

console.log('== the `plus` headline tier: readable legs are WITH ==');
assert(PF(perfect('long')).plus === false, 'evidence-silent: NOT plus (nothing readable said WITH)');
assert(PF(perfect('long'), { newsRisk: 'low' }).plus === true, 'news LOW is readable-and-WITH → plus');
assert(PF(perfect('long'), { newsRisk: 'low', volumeRvol: 1.2 }).plus === true, 'two WITH reads → plus');
assert(PF(perfect('long'), { newsRisk: 'low', volumeRvol: 0.5 }).plus === false, 'one WITH + one AGAINST → not plus (and not perfect)');
assert(PF(perfect('long'), { newsRisk: 'high' }).plus === false, 'news HIGH is readable-but-not-WITH → not plus (still perfect)');
assert(PF(perfect('long'), { sess: 'participating', newsRisk: 'low' }).plus === true, 'sess WITH + news WITH → plus');
assert(PF(perfect('long'), { takerFlowVerdict: 'with' }).plus === true, 'flow WITH → plus even without news');
assert(PF(perfect('long'), { takerFlowVerdict: 'with', structureTrend: 'up' }).plus === true, 'flow WITH + structure up → plus');
assert(PF(perfect('long'), { takerFlowVerdict: 'with', structureTrend: 'down' }).plus === false, 'flow WITH + structure down → against → not perfect (and not plus)');

console.log('== the PERFECT⁺ ledger mark + stamp ==');
assert(typeof W.hgPerfectPlusLedgerMark === 'function', 'hgPerfectPlusLedgerMark exported');
assert(W.hgPerfectPlusLedgerMark(perfect('long')) === undefined, 'plus mark undefined when not plus');
assert(W.hgPerfectPlusLedgerMark(perfect('long'), { newsRisk: 'low' }) === true, 'plus mark true when every readable leg is WITH');
assert(W.hgPerfectPlusLedgerMark(perfect('long', { tally: 0 })) === undefined, 'plus mark undefined when not even perfect');
assert(W.hgPerfectStamp(perfect('long', { perfectPlus: true })).indexOf('PERFECT\u207A') >= 0, 'the stamp renders ★ PERFECT⁺ when c.perfectPlus travelled');
assert(W.hgPerfectStamp(perfect('long')).indexOf('PERFECT\u207A') < 0, 'no PERFECT⁺ when not marked plus');
assert(W.hgPerfectStamp(perfect('long')).indexOf('\u2605 PERFECT') >= 0, 'plain ★ PERFECT for the non-plus lead');

console.log('== the self-audit: hgPerfectCohortEdge reads the live ledger ==');
{
  const F = bootForward();
  assert(typeof F.hgPerfectCohortEdge === 'function', 'hgPerfectCohortEdge exported');
  assert(typeof F.hgFwdRecord === 'function' && typeof F.hgFwdRecords === 'function', 'record/records exported');
  const BAR = Math.floor(Date.UTC(2026, 3, 8, 12, 0, 0) / 1000);
  const rec = over => Object.assign({ tab: 'GOLDSCALP', mechanic: 'PROBE', sym: 'XAUUSD', tf: '15m',
    dir: 'long', entry: 2300, stop: 2290, t1: 2315, barT: BAR, horizonBars: 96 }, over || {});

  F.hgFwdRecord(rec({ mechanic: 'A', perfect: true, perfectPlus: true }));
  F.hgFwdRecord(rec({ mechanic: 'B', perfect: true, perfectPlus: true }));
  F.hgFwdRecord(rec({ mechanic: 'C', perfect: true }));
  F.hgFwdRecord(rec({ mechanic: 'D' }));
  F.hgFwdRecord(rec({ mechanic: 'E', perfect: true }));

  const LS_KEY = 'hg_forward_v1';
  const marks = { A: { state: 't1', rr: 1.5 }, B: { state: 'stop' },
                  C: { state: 't1', rr: 2.0 }, D: { state: 't1', rr: 9.9 },
                  E: { state: 'stop' } };
  const raw = JSON.parse(F.localStorage.getItem(LS_KEY) || '[]');
  for (const r of raw){ const m = marks[r.mechanic]; if (!m) continue; r.state = m.state; r.rr = m.rr; }
  F.localStorage.setItem(LS_KEY, JSON.stringify(raw));

  const e = F.hgPerfectCohortEdge('GOLDSCALP');
  assert(e.settled === 4, 'REACHABILITY: four PERFECT records settled, D excluded (' + e.settled + ')');
  assert(e.wins === 2 && e.losses === 2, 'PERFECT cohort: 2 wins / 2 losses (A,C win; B,E lose)');
  assert(Math.abs(e.expR - 0.375) < 1e-9, 'PERFECT expR = (1.5+2.0 - 2)/4 = 0.375 (' + e.expR + ')');
  assert(e.plusSettled === 2, 'PERFECT⁺ cohort holds exactly A+B (' + e.plusSettled + ')');
  assert(Math.abs(e.plusExpR - 0.25) < 1e-9, 'PERFECT⁺ expR = (1.5 - 1)/2 = 0.25 (' + e.plusExpR + ')');
  const dRec = F.hgFwdRecords('GOLDSCALP').find(r => r.mechanic === 'D');
  assert(!dRec || dRec.perfect !== true, 'a non-perfect record stays out of the PERFECT cohort');
}

console.log('== source contract: gold desks forward sess/orb/session/costR/perfectPlus ==');
{
  const cases = [['goldscalp.js', "W.hgFwdRecordScan('GOLDSCALP'"], ['goldswing.js', "W.hgFwdRecordScan('GOLDSWING'"]];
  for (const [file, needle] of cases){
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const at = src.indexOf(needle);
    assert(at > 0, file + ': the record call is locatable');
    const mapAt = src.indexOf('.map(function(c){', at);
    const retAt = src.indexOf('return {', mapAt);
    const endAt = src.indexOf('};', retAt);
    const body = src.slice(retAt, endAt + 2);
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext('this.mk = function(c){ ' + body + ' };', sandbox, { filename: file + '-lift' });
    const cand = { dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'k',
                   sess: 'participating', orb: 'with', killzone: 'London · 08:00 GMT',
                   session: 'London · 08:00 GMT', costR: 0.5, perfectPlus: true, newsRisk: 'low' };
    const r = sandbox.mk(cand);
    assert(r.perfectPlus === true, file + ': PERFECT⁺ read-mark travels');
    assert(r.newsRisk === 'low', file + ': news-risk read-mark travels');
    assert(r.costR === 0.5, file + ': costR (fraction of R) travels (' + r.costR + ')');
    assert(r.session === 'London · 08:00 GMT', file + ': the killzone session label travels (' + r.session + ')');
    if (file === 'goldscalp.js'){
      assert(r.sess === 'participating' && r.orb === 'with', file + ': sess + orb travel (scalp intraday)');
    }
  }
  for (const file of ['goldscalp.js', 'goldswing.js']){
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert(/0\.020\s*\/\s*__stopPct/.test(src), file + ': costR is rtCostPct / stopPct (0.020 inlined, lifted-map-safe)');
  }
  {
    const F = bootForward();
    const BAR = Math.floor(Date.UTC(2026, 3, 8, 12) / 1000);
    F.hgFwdRecord({ tab: 'GOLDSCALP', mechanic: 'COSTR', sym: 'XAUUSD', tf: '15m', dir: 'long',
                    entry: 2300, stop: 2290, t1: 2315, barT: BAR, horizonBars: 96,
                    perfect: true, perfectPlus: true, costR: 0.5, session: 'London · 08:00 GMT', sess: 'participating', orb: 'with' });
    const got = F.hgFwdRecords('GOLDSCALP').find(r => r.mechanic === 'COSTR');
    assert(got && got.costR === 0.5, 'NORMALIZE: a finite costR ≥ 0 stores');
    assert(got.perfectPlus === true && got.session === 'London · 08:00 GMT' && got.sess === 'participating' && got.orb === 'with',
      'NORMALIZE: perfectPlus + session + sess + orb all store');
    F.hgFwdRecord({ tab: 'GOLDSCALP', mechanic: 'BADCOST', sym: 'XAUUSD', tf: '15m', dir: 'long',
                    entry: 2300, stop: 2290, t1: 2315, barT: BAR, horizonBars: 96, costR: -1 });
    const bad = F.hgFwdRecords('GOLDSCALP').find(r => r.mechanic === 'BADCOST');
    assert(bad && bad.costR === undefined, 'NORMALIZE: a negative costR reads as NOT RECORDED, never coerced');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
