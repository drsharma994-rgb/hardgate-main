/* hg-v984 — THE CRYPTO MACRO ALT FILTER IS APPLIED ON SIX DESKS, ASKED BY NONE
   OF THE DESKS THAT RECORD MOST, AND MEASURED NOWHERE; THE LEDGER NOW RECORDS
   ITS VERDICT ON EVERY CRYPTO RECORD, AND THE TWO PURE-PRICE DESKS SAY SO.

   hgMacroAllowsCrypto (plans.js) blocks an alt long while BTC.D > 55% or the
   dollar is rising. SWING, SCALP, EDGE, BEST, SETUP CONFIRM and SUPER SETUP
   apply it. OMNIROUTE, OMNIPRESENT, SQUEEZE, OI FLOW, DEX SCREENER, CRYPTO
   SCAN, CRYPTOVERSE and 90PERCENT do not -- and no artifact in the repo
   records the filter's verdict beside an outcome, so nobody can say whether
   it pays. Wiring it onto those desks unmeasured is the hg-v966 trap; leaving
   it unmeasured forever is the hg-v955 one. So: one rule (hgMacroAltMark,
   three states), stamped on every crypto record at the ledger's entry point,
   folded in the aggregate, read by the shared forward panel, and read on the
   cards of the two desks that read price alone. Nothing is gated on it.

   And the nearest measured crypto-macro gate -- OMNIROUTE's regime row, whose
   verdict the v701 replay recorded on every walked trade -- is measured on
   four disjoint windows and carries NO verdict, which is why no regime veto
   is fed to the desks that lack one either.

   Run: node tests/test-crypto-macro-mark.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { report, separate, loadRows, COHORTS } from '../scripts/omniroute-regime-separation.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const SEC = 900;
const AGG_KEY = 'hg_forward_agg_v1';

function boot(files){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of files) vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const CORE = ['indicators.js', 'indicators2.js', 'pinemath.js', 'cryptogates.js', 'plans.js', 'hg-forward.js'];

/* the same per-bar-draw generator the two desk tests use */
function tape(sd, n, opts){
  opts = opts || {};
  let s2 = sd;
  const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
  const drift = (opts.drift !== undefined) ? opts.drift : (r() - 0.5) * 0.25;
  const vol = (opts.vol !== undefined) ? opts.vol : 0.006 + r() * 0.018;
  const out = []; let px = opts.px0 || 100;
  const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - n * SEC;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (r() - 0.5 + drift) * vol);
    out.push({ t: t0 + i * SEC, o: o, c: c,
               h: Math.max(o, c) * (1 + vol * 1.2 * r()), l: Math.min(o, c) * (1 - vol * 1.2 * r()),
               v: 1000 + r() * 4000 });
    px = c;
  }
  return out;
}
function fakeEl(){
  const nodes = {};
  return {
    _html: '',
    set innerHTML(v){ this._html = String(v); },
    get innerHTML(){ return this._html; },
    querySelector(sel){
      const id = String(sel).replace(/^#/, '');
      if (this._html.indexOf('id="' + id + '"') < 0) return null;
      if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '', disabled: false,
                                    addEventListener(){}, classList: { toggle(){}, contains(){ return false; } } };
      return nodes[id];
    },
    _node(id){ return nodes[id] || null; }
  };
}
const barOf = (tfSec, back) => Math.floor(Date.now() / 1000 / tfSec) * tfSec - (back || 1) * tfSec;
const RISK_OFF = () => ({ btcdPct: 58.1, dxyTrend: 'FLAT' });
const BENIGN = () => ({ btcdPct: 50.0, dxyTrend: 'FLAT' });
const DARK = () => ({ btcdPct: null, dxyTrend: null });

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the rule: three states, from the one macro filter in force');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js']);
  ok(typeof S.hgMacroAltMark === 'function' && typeof S.hgIsGoldLaneSym === 'function', 'plans.js exports hgMacroAltMark and hgIsGoldLaneSym');
  S.regimeState = () => null;
  ok(S.hgMacroAltMark('DOGEUSDT', 'long').block === undefined, 'no regime snapshot at all -> NOT RECORDED');
  S.regimeState = DARK;
  ok(S.hgMacroAltMark('DOGEUSDT', 'long').block === undefined, 'a snapshot with BOTH gauges dark -> NOT RECORDED (not "allowed")');
  ok(S.hgBtcdPct() === null, 'hgBtcdPct reads a null gauge as null, not as 0% (+null is 0)');
  ok(S.hgMacroAllowsCrypto('DOGEUSDT', 'long').allow === true, 'and the GATE still fails open on the same dark snapshot -- unchanged');
  S.regimeState = RISK_OFF;
  const b = S.hgMacroAltMark('DOGEUSDT', 'long');
  ok(b.block === true && /BTC\.D 58\.1%/.test(b.why), 'alt long under BTC.D 58.1% -> BLOCKED, naming the read (' + b.why + ')');
  ok(S.hgMacroAltMark('DOGEUSDT', 'short').block === false, 'the same alt SHORT -> allowed');
  ok(S.hgMacroAltMark('BTCUSDT', 'long').block === false && S.hgMacroAltMark('ETHUSDT', 'long').block === false
     && S.hgMacroAltMark('SOLUSDT', 'long').block === false, 'majors -> allowed, as the filter exempts them');
  ok(S.hgMacroAltMark('XAUUSD', 'long').block === undefined && S.hgMacroAltMark('PAXGUSDT', 'long').block === undefined
     && S.hgMacroAltMark('XAUTUSD', 'long').block === undefined, 'gold-lane symbols -> NOT RECORDED: a crypto dominance rule has nothing to say about gold');
  ok(S.hgMacroAltMark('DOGEUSDT', '').block === undefined && S.hgMacroAltMark('DOGEUSDT', null).block === undefined, 'no direction -> NOT RECORDED');
  S.regimeState = () => ({ btcdPct: 50, dxyTrend: 'UP' });
  const d = S.hgMacroAltMark('LINKUSDT', 'long');
  ok(d.block === true && /DXY/.test(d.why), 'alt long under a rising dollar -> BLOCKED on the DXY leg');
  S.regimeState = () => ({ btcdPct: null, dxyTrend: 'UP' });
  ok(S.hgMacroAltMark('LINKUSDT', 'long').block === true, 'one leg dark and the other readable is a READ, and it blocks');
  S.regimeState = BENIGN;
  ok(S.hgMacroAltMark('LINKUSDT', 'long').block === false, 'alt long under BTC.D 50 / DXY FLAT -> allowed');
  /* parity: the mark is the gate's verdict, never a second rule */
  const cases = [['DOGEUSDT', 'long'], ['DOGEUSDT', 'short'], ['BTCUSDT', 'long'], ['LINKUSDT', 'long'], ['WIFUSDT', 'short']];
  let agree = 0;
  for (const rs of [RISK_OFF, BENIGN, () => ({ btcdPct: 40, dxyTrend: 'UP' }), () => ({ btcdPct: 70, dxyTrend: 'DOWN' })]){
    S.regimeState = rs;
    for (const [sym, dir] of cases){
      const m = S.hgMacroAltMark(sym, dir), g = S.hgMacroAllowsCrypto(sym, dir);
      if (m.block === (g.allow === false)) agree++;
    }
  }
  ok(agree === 20, 'on 20 readable cases the mark equals NOT the gate verdict, case for case (' + agree + '/20)');
  /* the `unchecked` shape hgMacroAllowsCrypto returns from its own catch is
     unreachable through the mark on the shipped tree -- a symbol that throws
     on String() is caught by the mark's own guards first -- so the mark's
     guard on it is defensive, and the mutation pass reports it EQUIVALENT
     rather than counting it caught */
  const boom = { toString(){ throw new Error('boom'); } };
  ok(S.hgMacroAltMark(boom, 'long').block === undefined, 'a symbol that throws yields NOT RECORDED, not a verdict');
  ok(S.hgIsGoldLaneSym('XAUUSD') && S.hgIsGoldLaneSym('PAXGUSDT') && S.hgIsGoldLaneSym('xautusd') && S.hgIsGoldLaneSym('GOLD'),
     'the gold-lane predicate names the gold symbols');
  ok(!S.hgIsGoldLaneSym('BTCUSDT') && !S.hgIsGoldLaneSym('DOGEUSDT') && !S.hgIsGoldLaneSym(''), 'and not the crypto ones, nor an empty one');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the normaliser keeps only the two booleans');
{
  const S = boot(['hg-forward.js']);
  const base = { tab: 'T', mechanic: 'M', sym: 'ALTUSDT', dir: 'long', entry: 100, stop: 99, t1: 102, barT: barOf(900) };
  const norm = v => S.hgFwdNormalize(Object.assign({}, base, { macroBlock: v }));
  ok(norm(true).macroBlock === true && norm(false).macroBlock === false, 'true and false survive');
  ok(norm(undefined).macroBlock === undefined && norm(null).macroBlock === undefined, 'absent and null are NOT RECORDED');
  ok(norm(1).macroBlock === undefined && norm(0).macroBlock === undefined, '1 and 0 are NOT RECORDED -- not coerced onto a side');
  ok(norm('no').macroBlock === undefined && norm('').macroBlock === undefined && norm({}).macroBlock === undefined,
     'a string or an object is a caller this log does not understand -> NOT RECORDED');
  ok(Object.prototype.hasOwnProperty.call(norm(undefined), 'macroBlock'), 'the field exists on every record (undefined, not missing)');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the entry point: the desk read wins, the shared rule fills the rest, gold and absence stay unmarked');
{
  const S = boot(CORE);
  const cand = (over) => Object.assign({ sym: 'ALTUSDT', dir: 'long', entry: 100, stop: 99, t1: 102, barT: barOf(14400) }, over || {});
  S.regimeState = RISK_OFF;
  ok(S.hgFwdRecordScan('SQUEEZE', '4h', [cand()], {}) === 1, 'a crypto candidate with no mark records');
  ok(S.hgFwdRecords('SQUEEZE')[0].macroBlock === true, 'and the ledger stamped BLOCKED from the shared rule -- no desk edit needed');
  ok(S.hgFwdRecordScan('OIFLOW', '4h', [cand({ dir: 'short', t1: 98, stop: 101 })], {}) === 1
     && S.hgFwdRecords('OIFLOW')[0].macroBlock === false, 'a short on the same snapshot stamps allowed');
  ok(S.hgFwdRecordScan('DEX', '4h', [cand({ sym: 'PEPEUSDT', macroBlock: false })], {}) === 1
     && S.hgFwdRecords('DEX')[0].macroBlock === false, 'a desk-supplied false WINS over the shared read (the card and the record agree by construction)');
  ok(S.hgFwdRecordScan('DEX2', '4h', [cand({ sym: 'WIFUSDT', dir: 'short', t1: 98, stop: 101, macroBlock: true })], {}) === 1
     && S.hgFwdRecords('DEX2')[0].macroBlock === true, 'and a desk-supplied true wins the other way');
  ok(S.hgFwdRecordScan('DEX3', '4h', [cand({ sym: 'BONKUSDT', macroBlock: 1 })], {}) === 1
     && S.hgFwdRecords('DEX3')[0].macroBlock === true, 'a desk handing in a non-boolean is ignored and the shared rule decides (1 is not a verdict)');
  ok(S.hgFwdRecordScan('DEX4', '4h', [cand({ sym: 'FARTUSDT', macroBlock: 0 })], {}) === 1
     && S.hgFwdRecords('DEX4')[0].macroBlock === true, 'a desk 0 on a long the filter blocks: the shared read (BLOCKED) decides, not the coerced 0');
  ok(S.hgFwdRecordScan('DEX5', '4h', [cand({ sym: 'GOATUSDT', dir: 'short', t1: 98, stop: 101, macroBlock: 'no' })], {}) === 1
     && S.hgFwdRecords('DEX5')[0].macroBlock === false, "a desk 'no' on a short the filter allows: the shared read (allowed) decides, not the truthy string");
  ok(S.hgFwdRecordScan('GOLDSCALP', '15m', [cand({ sym: 'XAUUSD', barT: barOf(900) })], {}) === 1
     && S.hgFwdRecords('GOLDSCALP')[0].macroBlock === undefined, 'a gold record stays NOT RECORDED under the same risk-off snapshot');
  S.regimeState = DARK;
  ok(S.hgFwdRecordScan('SQZ2', '4h', [cand({ sym: 'FLOKIUSDT' })], {}) === 1
     && S.hgFwdRecords('SQZ2')[0].macroBlock === undefined, 'a dark snapshot stamps NOT RECORDED, never allowed');
  S.regimeState = RISK_OFF;
  const keep = S.hgMacroAltMark;
  S.hgMacroAltMark = () => { throw new Error('boom'); };
  ok(S.hgFwdRecordScan('SQZ3', '4h', [cand({ sym: 'TRUMPUSDT' })], {}) === 1
     && S.hgFwdRecords('SQZ3')[0].macroBlock === undefined, 'a throwing rule leaves the record unmarked and still recorded');
  /* a host-side delete does not reach the vm's inner global; unset it INSIDE */
  vm.runInContext('window.hgMacroAltMark = undefined;', S);
  ok(S.hgFwdRecordScan('SQZ4', '4h', [cand({ sym: 'PUMPUSDT' })], {}) === 1
     && S.hgFwdRecords('SQZ4')[0].macroBlock === undefined, 'with plans.js absent the ledger records exactly as before, unmarked');
  S.hgMacroAltMark = keep;
  /* the dedup key is untouched: the same candidate twice is one record */
  ok(S.hgFwdRecordScan('SQUEEZE', '4h', [cand()], {}) === 0, 'the mark does not enter the dedup key -- the same firing is still one record');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the aggregate folds the two buckets, and unmarked lands in neither');
{
  const S = boot(['hg-forward.js']);
  const rec = (i, mb, state) => ({ tab: 'T', mechanic: 'M', sym: 'S' + i, dir: 'long', entry: 100, stop: 99, t1: 102, rr: 2,
                                   state, macroBlock: mb, gateClear: true });
  const recs = [rec(1, true, 't1'), rec(2, true, 'stop'), rec(3, false, 't1'), rec(4, false, 't1'), rec(5, undefined, 't1'),
                rec(6, null, 'stop'), rec(7, true, 'open'), rec(8, 1, 't1')];
  const agg = S.hgFwdFold({}, recs);
  const row = agg['T|M'];
  ok(!!row && !!row.mb && !!row.ma, 'the fold carries mb (blocked) and ma (allowed) buckets');
  ok(row.mb.wins === 1 && row.mb.losses === 1, 'blocked: 1 win, 1 loss (the open one is not settled)');
  ok(row.ma.wins === 2 && row.ma.losses === 0, 'allowed: 2 wins');
  ok(row.wins === 5 && row.losses === 2, 'the unfiltered tally counts all seven settled (the open one excluded)');
  ok((row.mb.wins + row.mb.losses) + (row.ma.wins + row.ma.losses) === 4, 'the two buckets hold four of the seven -- the two unmarked (undefined, null) and the coerced 1 fold into NEITHER');
  ok(row.gc && row.gc.wins === 5, 'the gate-clear bucket is untouched beside them');
  const legacy = S.hgFwdFold({}, [Object.assign(rec(9, undefined, 't1'), { macroBlock: undefined })]);
  ok(!legacy['T|M'].mb && !legacy['T|M'].ma, 'a fold of unmarked records creates no bucket -- an aggregate written before this pack has none');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the split reader and its line');
{
  const S = boot(CORE);
  ok(S.hgFwdMacroSplitHtml('CRYPTOVERSE') === '', 'an empty ledger renders NOTHING');
  S.regimeState = RISK_OFF;
  const mk = (i, dir, mb) => ({ sym: 'C' + i + 'USDT', dir, entry: 100, stop: dir === 'long' ? 99 : 101, t1: dir === 'long' ? 102 : 98,
                                barT: barOf(900, 6), macroBlock: mb });
  S.hgFwdRecordScan('CRYPTOVERSE', '15m', [mk(1, 'long', true), mk(2, 'long', true), mk(3, 'long', true), mk(4, 'short', false), mk(5, 'short', false)], { horizonBars: 24 });
  /* a legacy record on the same desk: no mark */
  S.hgFwdRecord({ tab: 'CRYPTOVERSE', mechanic: '15m', sym: 'L9USDT', dir: 'long', tf: '15m', entry: 100, stop: 99, t1: 102, barT: barOf(900, 6), horizonBars: 24 });
  ok(S.hgFwdRecords('CRYPTOVERSE').length === 6, 'six open records');
  ok(S.hgFwdMacroSplitHtml('CRYPTOVERSE') === '', 'open records are not settled evidence: still nothing');
  /* settle: C1 wins, C2 and C3 stop, C4 wins, C5 stops, L9 wins */
  const settle = (sym, win) => {
    const r = S.hgFwdRecords('CRYPTOVERSE').filter(x => x.sym === sym)[0];
    const bars = []; for (let i = 1; i <= 4; i++){ const px = win ? (r.dir === 'long' ? r.t1 * 1.01 : r.t1 * 0.99) : (r.dir === 'long' ? r.stop * 0.99 : r.stop * 1.01);
      bars.push({ t: r.barT + i * 900, o: px, h: px * 1.001, l: px * 0.999, c: px }); }
    S.hgFwdResolve(sym, '15m', bars);
  };
  settle('C1USDT', true); settle('C2USDT', false); settle('C3USDT', false); settle('C4USDT', true); settle('C5USDT', false); settle('L9USDT', true);
  const sp = S.hgFwdMacroSplit('CRYPTOVERSE');
  ok(sp && sp.blocked === 3 && sp.allowed === 2 && sp.unmarked === 1, 'settled split: 3 blocked, 2 allowed, 1 unmarked (' + JSON.stringify([sp.blocked, sp.allowed, sp.unmarked]) + ')');
  ok(Math.abs(sp.blockedR - (2 - 1 - 1) / 3) < 1e-9 && Math.abs(sp.blockedHit - 1 / 3) < 1e-9, 'blocked reads 0.000R at 33% (one 2R win, two stops)');
  ok(Math.abs(sp.allowedR - (2 - 1) / 2) < 1e-9 && Math.abs(sp.allowedHit - 0.5) < 1e-9, 'allowed reads +0.500R at 50%');
  const html = text(S.hgFwdMacroSplitHtml('CRYPTOVERSE'));
  ok(/MACRO ALT FILTER SPLIT/.test(html) && /3 of 5 marked settled records \(60\.0%\)/.test(html), 'the line names the share the filter would have removed');
  ok(/blocked \+0\.000R at 33% on n=3/.test(html) && /allowed \+0\.500R at 50% on n=2/.test(html), 'and each bucket with its own R and hit');
  ok(/1 carry no mark and are counted as NEITHER/.test(html), 'the unmarked record is named as its own bucket');
  ok(/Reported, not gated/.test(html), 'and the line says nothing is withheld on it');
  ok(S.hgFwdMacroSplitHtml('GOLDSCALP') === '' && S.hgFwdMacroSplit('GOLDSCALP').blocked === 0, 'another tab reads its own records only');
  /* the folded counts outlive the live list */
  S.__store[AGG_KEY] = JSON.stringify({ 'CRYPTOVERSE|15m': { tab: 'CRYPTOVERSE', wins: 9, losses: 9, expired: 0, rrSum: 18,
    mb: { wins: 2, losses: 5, expired: 0, rrSum: 4 }, ma: { wins: 7, losses: 4, expired: 0, rrSum: 14 } } });
  const sp2 = S.hgFwdMacroSplit('CRYPTOVERSE');
  ok(sp2.agg && sp2.agg.blocked.wins === 2 && sp2.agg.blocked.losses === 5 && sp2.agg.allowed.wins === 7, 'the folded buckets are read back beside the live split');
  S.__store[AGG_KEY] = JSON.stringify({ 'OMNIROUTE|X': { tab: 'OMNIROUTE', wins: 1, losses: 1, expired: 0, rrSum: 2 } });
  ok(S.hgFwdMacroSplit('CRYPTOVERSE').agg === null, 'an aggregate row from before this pack, or for another tab, contributes nothing');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the shared forward panel carries the line, and stays silent where nothing is marked');
{
  const S = boot(CORE);
  S.regimeState = RISK_OFF;
  const mk = (i, mb) => ({ sym: 'P' + i + 'USDT', dir: 'long', entry: 100, stop: 99, t1: 102, barT: barOf(900, 6), macroBlock: mb });
  S.hgFwdRecordScan('OIFLOW', '15m', [mk(1, true), mk(2, false)], { horizonBars: 24 });
  for (const sym of ['P1USDT', 'P2USDT']){
    const r = S.hgFwdRecords('OIFLOW').filter(x => x.sym === sym)[0];
    const bars = []; for (let i = 1; i <= 4; i++){ const px = r.t1 * 1.01; bars.push({ t: r.barT + i * 900, o: px, h: px * 1.001, l: px * 0.999, c: px }); }
    S.hgFwdResolve(sym, '15m', bars);
  }
  const p = text(S.hgFwdPanelHTML('OIFLOW', { minRr: 2, title: 'F' }));
  ok(/MACRO ALT FILTER SPLIT/.test(p) && /1 of 2 marked settled records \(50\.0%\)/.test(p), 'the OI FLOW forward panel prints the split');
  ok(!/MACRO ALT FILTER SPLIT/.test(text(S.hgFwdPanelHTML('GOLDSCALP', { minRr: 1.5, title: 'G' }))), 'a gold panel prints no such line');
  ok(!/MACRO ALT FILTER SPLIT/.test(text(S.hgFwdPanelHTML('SQUEEZE', { minRr: 2, title: 'S' }))), 'nor does a crypto desk with no record yet');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. CRYPTOVERSE, through the real tab: the read lands on the card and the record, and moves no board');
{
  async function runCv(regime){
    const S = boot(CORE.concat(['cryptoverse.js']));
    S.regimeState = regime;
    const SEEDS = [24, 247, 249, 3, 5, 8];   /* the first three fire on this generator */
    const SY = SEEDS.map((k, i) => ({ sym: 'ALT' + i + 'USDT', exchange: i % 2 ? 'coindcx' : 'delta', base: 'ALT' + i }));
    const T = {}, H1 = {};
    SY.forEach((it, i) => { T[it.sym] = tape(101 + SEEDS[i] * 7919, 460); H1[it.sym] = tape(9 + SEEDS[i], 240); });
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null,
      venueCounts: { delta: 3, coindcx: 3, binance: 0, startrader: 0, other: 0 }, droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
    S.hgDeskFetchKlinesResult = async (it, tf) => ({ rows: tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice(), ok: true, reason: null, error: null });
    S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice());
    const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoverse')[0];
    const el = fakeEl(); tab.mount(el);
    const out = await tab.refresh();
    const st = S.cryptoverseState();
    const cards = el._node('cvCards');
    return { S, out, st, html: cards ? cards.innerHTML : '', recs: S.hgFwdRecords('CRYPTOVERSE') };
  }
  const off = await runCv(RISK_OFF);
  ok(off.out === 'refreshed' && off.st.errors === 0, 'the scan runs clean');
  ok(off.st.setups.length >= 1, 'the fixture fires ' + off.st.setups.length + ' setup(s) -- reachability first');
  const longs = off.st.setups.filter(s => s.setup.dir === 'long').length;
  ok(longs >= 1, 'at least one of them is a long (' + longs + '), the side the filter can block');
  ok(off.st.setups.every(s => s.macro && (s.macro.block === (s.setup.dir === 'long'))), 'every row carries the read: longs BLOCKED, shorts allowed');
  ok((off.html.match(/MACRO FILTER WOULD BLOCK/g) || []).length === longs, 'the chip lands on each long card and no other (' + longs + ')');
  ok(/THE SHARED CRYPTO MACRO FILTER WOULD HAVE BLOCKED THIS/.test(text(off.html)) && /Reported, not gated/.test(text(off.html)), 'the note names the filter and says it is not gated here');
  ok(off.recs.length === off.st.setups.length && off.recs.every(r => r.macroBlock === (r.dir === 'long')), 'each record carries the same verdict as its card');

  const benign = await runCv(BENIGN);
  ok(benign.st.setups.length === off.st.setups.length, 'the same tape under a benign read forms the SAME number of setups (' + benign.st.setups.length + ') -- nothing was gated');
  const lv = st => st.setups.map(s => s.sym + ':' + s.setup.dir + ':' + s.setup.entry + ':' + s.setup.stop + ':' + s.setup.t1).join('|');
  ok(lv(benign.st) === lv(off.st), 'with identical entry, stop and target on every one');
  ok(!/MACRO FILTER WOULD BLOCK/.test(benign.html), 'no chip when the filter would allow');
  ok(benign.recs.every(r => r.macroBlock === false), 'and every record reads allowed');

  const dark = await runCv(() => null);
  ok(dark.st.setups.length === off.st.setups.length && !/MACRO FILTER WOULD BLOCK/.test(dark.html), 'with no snapshot the board is the same and no chip claims a read');
  ok(dark.recs.every(r => r.macroBlock === undefined), 'and every record is NOT RECORDED');
  ok(typeof off.S.__cvMacroMark === 'function' && off.S.__cvMacroMark('ALT0USDT', 'long').block === true, 'the desk reader is exported and reads the risk-off snapshot that context still holds');
  const S2 = boot(['indicators.js', 'indicators2.js', 'pinemath.js', 'hg-forward.js', 'cryptoverse.js']);
  ok(S2.__cvMacroMark('ALT0USDT', 'long') === null, 'with plans.js absent the desk reads null and claims nothing');
}

/* ---------------------------------------------------------------- 8 */
console.log('\n8. 90PERCENT, through the real tab');
{
  const NP_CORE = ['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'hg-forward.js', 'ninetypercent.js'];
  async function runNp(regime){
    const S = boot(NP_CORE);
    S.regimeState = regime;
    const SEEDS = [1, 87, 96, 194, 196, 199, 2, 4];   /* the first six fire on this generator */
    const SY = SEEDS.map((k, i) => ({ sym: 'MEME' + i + 'USDT', exchange: i % 2 ? 'coindcx' : 'delta', base: 'MEME' + i }));
    const T = {}; SY.forEach((it, i) => { T[it.sym] = tape(7 + SEEDS[i] * 3571, 400); });
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null,
      venueCounts: { delta: 4, coindcx: 4, binance: 0, startrader: 0, other: 0 }, droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
    S.hgDeskFetchKlines = async (it) => T[it.sym].slice();
    S.hgDeskFetchKlinesResult = async (it) => ({ rows: T[it.sym].slice(), ok: true, reason: null, error: null });
    const tab = (S.HG_tabs || []).filter(t => t && t.id === 'ninetypercent')[0];
    const el = fakeEl(); tab.mount(el);
    const out = await tab.refresh();
    const st = S.ninetyPercentState();
    const cards = el._node('npCards');
    return { S, out, st, html: cards ? cards.innerHTML : '', recs: S.hgFwdRecords('90PERCENT') };
  }
  const off = await runNp(RISK_OFF);
  ok(off.out === 'refreshed' && off.st.errors === 0, 'the scan runs clean');
  const longs = off.st.setups.filter(s => s.setup.dir === 'long').length, shorts = off.st.setups.length - longs;
  ok(longs >= 1 && shorts >= 1, 'the fixture fires both sides (' + longs + ' long, ' + shorts + ' short) -- reachability first');
  ok(off.st.setups.every(s => s.macro && (s.macro.block === (s.setup.dir === 'long'))), 'every row carries the read: longs BLOCKED, shorts allowed');
  ok((off.html.match(/MACRO FILTER WOULD BLOCK/g) || []).length === longs, 'the chip lands on each long card and no short (' + longs + ')');
  ok(off.recs.length === off.st.setups.length && off.recs.every(r => r.macroBlock === (r.dir === 'long')), 'each record carries the same verdict as its card');
  const benign = await runNp(BENIGN);
  const lv = st => st.setups.map(s => s.sym + ':' + s.setup.dir + ':' + s.setup.entry + ':' + s.setup.stop + ':' + s.setup.t1).join('|');
  ok(lv(benign.st) === lv(off.st) && !/MACRO FILTER WOULD BLOCK/.test(benign.html), 'the benign read forms the identical board with no chip');
  ok(benign.recs.every(r => r.macroBlock === false), 'and every record reads allowed');
  const dark = await runNp(() => null);
  ok(lv(dark.st) === lv(off.st) && dark.recs.every(r => r.macroBlock === undefined), 'no snapshot: same board, records NOT RECORDED');
}

/* ---------------------------------------------------------------- 9 */
console.log('\n9. the nearest measured crypto-macro gate: OMNIROUTE regime on four disjoint windows');
{
  const rows = loadRows();
  ok(rows.length === 2833, 'the v701 replay walked 2,833 rows (' + rows.length + ')');
  const rep = report(rows);
  const c = rep.cohorts;
  ok(c.regimeAdverseVeto.whole.in.n === 691 && c.regimeAdverseVeto.verdict === 'none',
     'adverse-veto (n=691) carries NO verdict: worse in ' + c.regimeAdverseVeto.worse.net + ' of 4 windows on net');
  ok(c.regimeAdverseAny.verdict === 'none' && c.againstRegimeLabel.verdict === 'none',
     'nor does any adverse read (' + c.regimeAdverseAny.worse.net + '/4) or the label against the trade (' + c.againstRegimeLabel.worse.net + '/4)');
  ok(c.withTrendFalse.verdict === 'none', 'symbol-trend misalignment carries no verdict either (' + c.withTrendFalse.worse.win + '/' + c.withTrendFalse.worse.gross + '/' + c.withTrendFalse.worse.net + ')');
  ok(c.kindDemoted.verdict === 'worse' && c.kindDemoted.worse.win === 4 && c.kindDemoted.worse.gross === 4 && c.kindDemoted.worse.net === 4,
     'the module own baked demotion DOES separate 4/4 -- the method is not blind on this book');
  ok(c.kindDemoted.inSample === true && /fitted on an overlapping window/.test(c.kindDemoted.verdictNote || ''),
     'and it is flagged IN-SAMPLE with the reason, not offered as confirmation');
  ok(!c.regimeAdverseVeto.inSample && !c.regimeAdverseVeto.verdictNote, 'the regime cohorts carry no such flag');
  ok(Math.abs(c.regimeAdverseVeto.whole.in.net - (-0.232)) < 0.002 && Math.abs(c.regimeAdverseVeto.whole.out.net - (-0.211)) < 0.002,
     'whole-book: inside -0.232R against outside -0.211R (' + c.regimeAdverseVeto.whole.in.net.toFixed(3) + ' / ' + c.regimeAdverseVeto.whole.out.net.toFixed(3) + ')');
  /* the rule itself, on rows built to a known answer */
  const syn = (n, f) => { const out = []; for (let i = 0; i < n; i++) out.push(f(i)); return out; };
  const T0 = Date.parse('2026-01-01T00:00:00Z');
  const row = (i, inC, win) => ({ tISO: new Date(T0 + i * 3600e3).toISOString(), dir: 'long', outcome: win ? 'target' : 'stop', rMultiple: 2, netR: win ? 1.9 : -1.05, flag: inC });
  /* cohort loses 20%, complement wins 60%, in every window */
  const allWorse = syn(800, i => row(i, i % 2 === 0, (i % 2 === 0) ? (i % 10 < 2) : (i % 10 < 6)));
  ok(separate(allWorse, r => r.flag, 4).verdict === 'worse', 'a cohort worse in all four windows reads WORSE');
  ok(separate(allWorse, r => !r.flag, 4).verdict === 'better', 'and its complement reads BETTER');
  /* the same, but the cohort wins the last window */
  const threeOfFour = allWorse.map((r, i) => (i >= 600 && r.flag) ? Object.assign({}, r, { outcome: 'target', netR: 1.9 }) : r);
  const s3 = separate(threeOfFour, r => r.flag, 4);
  ok(s3.verdict === 'none' && s3.worse.net === 3, 'worse in three of four is NO verdict (' + s3.worse.net + '/4)');
  const thin = separate(allWorse.slice(0, 60), r => r.flag, 4);
  ok(thin.verdict === 'none' && thin.thin === 4 && thin.judged === 0, 'windows too thin to judge yield no verdict, and say how many were thin and how many judged (0)');
  /* a window is thin when the cohort (or its complement) has under 20 rows in
     it, not when the window is short: a late stretch with no cohort rows */
  const lateNoCohort = syn(200, i => row(600 + i, false, i % 10 < 6));
  const mixedThin = separate(allWorse.slice(0, 600).concat(lateNoCohort), r => r.flag, 4);
  ok(mixedThin.judged === 3 && mixedThin.thin === 1 && mixedThin.verdict === 'none', 'three judgeable windows and a thin fourth read judged=3, thin=1, and no verdict');
  /* ALL THREE figures, not net alone: a cohort with MORE wins at a smaller R
     is worse on gross and net and better on win rate, and that is no verdict */
  const winMoreEarnLess = syn(800, i => { const inC = i % 2 === 0; const win = inC ? (i % 10 < 5) : (i % 10 < 4);
    return { tISO: new Date(T0 + i * 3600e3).toISOString(), dir: 'long', outcome: win ? 'target' : 'stop',
             rMultiple: inC ? 1 : 3, netR: win ? (inC ? 0.9 : 2.9) : -1.05, flag: inC }; });
  const wme = separate(winMoreEarnLess, r => r.flag, 4);
  ok(wme.worse.net === 4 && wme.worse.gross === 4 && wme.worse.win === 0 && wme.verdict === 'none',
     'worse on net and gross in all four but BETTER on win rate in all four is NO verdict (' + wme.worse.win + '/' + wme.worse.gross + '/' + wme.worse.net + ')');
  /* TIME order, not file order: the same rows handed in grouped by outcome
     must still be judged on four windows that share no time */
  /* cohort wins 40% against 60%, worse in every time window; handed in with
     every cohort WIN first, a file-order first quarter is 160 cohort wins
     against ~20 complement rows and reads the cohort BETTER there */
  const worse40 = syn(800, i => row(i, i % 2 === 0, (i % 2 === 0) ? (i % 10 < 4) : (i % 10 < 6)));
  ok(separate(worse40, r => r.flag, 4).verdict === 'worse', 'the 40%-against-60% cohort reads WORSE in time order');
  const grouped = worse40.slice().sort((a, b) => (a.flag && a.outcome === 'target' ? -1 : 0) - (b.flag && b.outcome === 'target' ? -1 : 0));
  ok(grouped.some((r, i) => i > 0 && r.tISO < grouped[i - 1].tISO), 'the fixture really is out of time order');
  ok(separate(grouped, r => r.flag, 4).verdict === 'worse', 'and the rule sorts it back onto time before cutting windows -> still WORSE');
  /* a TIMEOUT is 0R in gross, not a loss: a cohort that times out where its
     complement stops must read better on gross, never worse */
  const timeouts = syn(800, i => { const inC = i % 2 === 0; const win = inC ? (i % 10 < 3) : (i % 100 < 35);   /* cohort 40% (even i under 3 is two of five), complement 36% at 3R */
    return { tISO: new Date(T0 + i * 3600e3).toISOString(), dir: 'long',
             outcome: win ? 'target' : (inC ? 'timeout' : 'stop'), rMultiple: inC ? 2 : 3,
             netR: win ? (inC ? 1.9 : 2.9) : (inC ? 0 : -1.05), flag: inC }; });
  const to = separate(timeouts, r => r.flag, 4);
  ok(to.verdict === 'better' && to.better.gross === 4, 'a cohort that times out rather than stops reads BETTER on gross in all four (' + to.better.gross + '/4)');
  ok(COHORTS.filter(c => c.inSample).map(c => c.key).join() === 'kindDemoted', 'exactly one cohort is declared in-sample');
}

/* ---------------------------------------------------------------- 10 */
console.log('\n10. the seams, read for what they are (textual, and said to be)');
{
  const fwd = stripComments(fs.readFileSync(root + 'hg-forward.js', 'utf8'));
  const plans = stripComments(fs.readFileSync(root + 'plans.js', 'utf8'));
  const cv = stripComments(fs.readFileSync(root + 'cryptoverse.js', 'utf8'));
  const np = stripComments(fs.readFileSync(root + 'ninetypercent.js', 'utf8'));
  ok(/macroBlock: macroMarkOf\(c\),/.test(fwd), 'the entry point stamps the mark through one local reader');
  ok(/W\.hgFwdMacroSplitHtml\(tab\)/.test(fwd.slice(fwd.indexOf('W.hgFwdPanelHTML = function'))), 'the shared panel calls the split line');
  const tfg = plans.slice(plans.indexOf('function hgTicketFinalGates'), plans.indexOf('function hgTicketFinalGates') + 600);
  ok(/hgIsGoldLaneSym\(plan\.sym\)/.test(tfg) && !/XAU\|PAXG\|GOLD/.test(tfg), 'hgTicketFinalGates reads the gold lane through the one predicate, no inline copy');
  ok((plans.match(/\/\(XAU\|PAXG\|GOLD\)\/i/g) || []).length === 1, 'the gold-lane regex appears exactly once in plans.js');
  ok(/macroBlock: \(s\.macro && \(s\.macro\.block === true \|\| s\.macro\.block === false\)\) \? s\.macro\.block : undefined/.test(cv), 'CRYPTOVERSE hands the card read to the record');
  ok(/macroBlock: \(s\.macro && \(s\.macro\.block === true \|\| s\.macro\.block === false\)\) \? s\.macro\.block : undefined/.test(np), '90PERCENT hands the card read to the record');
  ok(!/hgMacroAllowsCrypto/.test(cv) && !/hgMacroAllowsCrypto/.test(np), 'neither desk calls the GATE -- they read the mark, and gate on nothing');
  ok(!/hgPostGateSetupVeto|hgRegimeAllowsSetup/.test(cv + np), 'and neither wires a regime or post-gate veto: none is measured');
}

/* ---------------------------------------------------------------- 11 */
console.log('\n11. stamp');
{
  ok(swCacheOk(fs.readFileSync(root + 'sw.js', 'utf8')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed' + (process.exitCode ? ' — WITH FAILURES' : ''));
