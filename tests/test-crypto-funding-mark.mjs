/* hg-v985 — THE DIRECTIONAL FUNDING RULE IS APPLIED BY THE SWING/SCALP MATRICES,
   ASKED BY NONE OF THE CRYPTO DESKS THAT RECORD MOST, AND MEASURED NOWHERE;
   EVERY CRYPTO RECORD THAT HAD FUNDING IN HAND NOW CARRIES IT AND THE RULE'S
   VERDICT, AND THE TWO PURE-PRICE DESKS SAY SO. And on the way: hg-v981's
   SQUEEZE mark never landed, because the published row carries no candles.

   fundingGateDirectional (hg-setup-core.js) vetoes a plan whose funding runs
   against the trade at or beyond 0.04%/interval; OMNIROUTE's own soft gate
   reads the same figure at 0.05 (crowded). CRYPTOVERSE and 90PERCENT had the
   venue's rate on every universe item and read price alone; OMNIROUTE,
   SQUEEZE, OI FLOW, EDGE, CRYPTO SCAN and the GATES tab had it in hand at the
   record site and recorded none of it. No artifact records funding beside an
   outcome. One rule (hgFundingAgainstMark, three states), the raw rate beside
   it, the fold, a split at both bars on the shared forward panel, and nothing
   gated.

   Run: node tests/test-crypto-funding-mark.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

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
const SEC = 900, H4 = 14400;
const AGG_KEY = 'hg_forward_agg_v1';

function boot(files, extra){
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
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const CORE = ['indicators.js', 'indicators2.js', 'pinemath.js', 'hg-setup-core.js', 'cryptogates.js', 'plans.js', 'hg-forward.js'];

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
    out.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + vol * 1.2 * r()), l: Math.min(o, c) * (1 - vol * 1.2 * r()), v: 1000 + r() * 4000 });
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
/* a pane whose querySelector hands back capturing stubs (the SQUEEZE / OI FLOW tests' shape) */
function stubPane(){
  const stubs = {};
  const mk = () => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {},
                      firstElementChild: { style: {} }, querySelectorAll(){ return []; },
                      addEventListener(ev, fn){ this._handler = fn; } });
  const pane = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
                 querySelector(sel){ if (!stubs[sel]) stubs[sel] = mk(); return stubs[sel]; },
                 querySelectorAll(){ return []; } };
  return { pane, stubs };
}
const barOf = (tfSec, back) => Math.floor(Date.now() / 1000 / tfSec) * tfSec - (back || 1) * tfSec;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the rule: three states, delegating to the gate it sits beside');
{
  const S = boot(['hg-setup-core.js']);
  const M = S.hgFundingAgainstMark, G = S.hgFundingGateDirectional;
  ok(typeof M === 'function' && typeof G === 'function', 'hg-setup-core exports the mark beside the gate');
  ok(M(0.06, 'long').against === true && M(0.06, 'long').fundingPct === 0.06, 'a long paying 0.06% -> AGAINST, rate carried');
  ok(M(0.06, 'short').against === false, 'the same rate on a short -> with the trade');
  ok(M(-0.06, 'long').against === false && M(-0.06, 'short').against === true, 'and the mirror on negative funding');
  ok(M(0.04, 'long').against === true && M(0.039, 'long').against === false, 'the bar is the gate own 0.04, inclusive');
  ok(M(null, 'long').against === undefined && M(undefined, 'long').against === undefined && M(NaN, 'long').against === undefined,
     'no funding -> NOT RECORDED, not a veto (gateResult would degrade n/a to veto)');
  ok(M(0.5, 'long').against === undefined && /out of range/.test(M(0.5, 'long').why), 'a feed reading out of range (>0.30) is not a read -> NOT RECORDED, and says why');
  ok(M(0.02, '').against === undefined && M(0.02, null).against === undefined, 'no direction -> NOT RECORDED');
  /* parity: on every readable input the mark IS the gate verdict */
  let agree = 0, n = 0;
  for (const f of [-0.2, -0.05, -0.04, -0.039, -0.01, 0, 0.01, 0.039, 0.04, 0.05, 0.2]) for (const d of ['long', 'short']){
    n++; if (M(f, d).against === (G(f, d, {}).state === 'veto')) agree++;
  }
  ok(agree === n, 'the mark equals the gate verdict on ' + n + ' readable inputs (' + agree + ')');
  ok(M(0, 'long').against === false && M(0, 'long').fundingPct === 0, 'a funding of exactly zero is a READ rate of zero, not an absence');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the normaliser: a number for the rate, the two booleans for the verdict');
{
  const S = boot(['hg-forward.js']);
  const base = { tab: 'T', mechanic: 'M', sym: 'ALTUSDT', dir: 'long', entry: 100, stop: 99, t1: 102, barT: barOf(SEC) };
  const norm = o => S.hgFwdNormalize(Object.assign({}, base, o));
  ok(norm({ fundingPct: 0.06 }).fundingPct === 0.06 && norm({ fundingPct: 0 }).fundingPct === 0, 'a finite rate survives, zero included');
  ok(norm({ fundingPct: null }).fundingPct === undefined && norm({ fundingPct: '0.06' }).fundingPct === undefined
     && norm({ fundingPct: NaN }).fundingPct === undefined && norm({}).fundingPct === undefined, 'null, a string, NaN and absence are NOT RECORDED -- never coerced (+null is 0, a real rate)');
  ok(norm({ fundAgainst: true }).fundAgainst === true && norm({ fundAgainst: false }).fundAgainst === false, 'the verdict keeps true and false');
  ok(norm({ fundAgainst: 1 }).fundAgainst === undefined && norm({ fundAgainst: 0 }).fundAgainst === undefined
     && norm({ fundAgainst: 'no' }).fundAgainst === undefined && norm({}).fundAgainst === undefined, 'and nothing else');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the entry point: the desk verdict wins, the rate goes to the shared rule, absence stays absent');
{
  const S = boot(CORE);
  const cand = over => Object.assign({ sym: 'ALTUSDT', dir: 'long', entry: 100, stop: 99, t1: 102, barT: barOf(H4) }, over || {});
  ok(S.hgFwdRecordScan('A', '4h', [cand({ fundingPct: 0.06 })], {}) === 1 && S.hgFwdRecords('A')[0].fundingPct === 0.06 && S.hgFwdRecords('A')[0].fundAgainst === true,
     'a long with 0.06% in hand records the rate and AGAINST from the shared rule');
  ok(S.hgFwdRecordScan('B', '4h', [cand({ dir: 'short', stop: 101, t1: 98, fundingPct: 0.06 })], {}) === 1 && S.hgFwdRecords('B')[0].fundAgainst === false, 'a short on the same rate records with');
  ok(S.hgFwdRecordScan('C', '4h', [cand({ fundingPct: null })], {}) === 1 && S.hgFwdRecords('C')[0].fundingPct === undefined && S.hgFwdRecords('C')[0].fundAgainst === undefined,
     'no funding (CoinDCX) records neither');
  ok(S.hgFwdRecordScan('D', '4h', [cand({ fundingPct: 0.06, fundAgainst: false })], {}) === 1 && S.hgFwdRecords('D')[0].fundAgainst === false,
     'a desk-supplied verdict WINS over the shared read');
  ok(S.hgFwdRecordScan('E', '4h', [cand({ fundingPct: 0.06, fundAgainst: 1 })], {}) === 1 && S.hgFwdRecords('E')[0].fundAgainst === true,
     'a non-boolean desk verdict is ignored and the shared rule decides');
  ok(S.hgFwdRecordScan('F', '4h', [cand({ fundingPct: '0.06' })], {}) === 1 && S.hgFwdRecords('F')[0].fundingPct === undefined && S.hgFwdRecords('F')[0].fundAgainst === undefined,
     'a string rate is not a rate: neither field');
  ok(S.hgFwdRecordScan('G', '4h', [cand({ fundingPct: 0.5 })], {}) === 1 && S.hgFwdRecords('G')[0].fundingPct === 0.5 && S.hgFwdRecords('G')[0].fundAgainst === undefined,
     'an out-of-range feed keeps the raw figure and no verdict');
  const keep = S.hgFundingAgainstMark;
  S.hgFundingAgainstMark = () => { throw new Error('boom'); };
  ok(S.hgFwdRecordScan('H', '4h', [cand({ fundingPct: 0.06 })], {}) === 1 && S.hgFwdRecords('H')[0].fundingPct === 0.06 && S.hgFwdRecords('H')[0].fundAgainst === undefined,
     'a throwing rule leaves the verdict unmarked and the rate recorded');
  vm.runInContext('window.hgFundingAgainstMark = undefined;', S);
  ok(S.hgFwdRecordScan('I', '4h', [cand({ fundingPct: 0.06 })], {}) === 1 && S.hgFwdRecords('I')[0].fundingPct === 0.06 && S.hgFwdRecords('I')[0].fundAgainst === undefined,
     'with hg-setup-core absent the rate still records and the verdict is NOT RECORDED');
  S.hgFundingAgainstMark = keep;
  ok(S.hgFwdRecordScan('A', '4h', [cand({ fundingPct: 0.06 })], {}) === 0, 'neither field enters the dedup key');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the aggregate folds fa / fw, and unmarked lands in neither');
{
  const S = boot(['hg-forward.js']);
  const rec = (i, fa, state) => ({ tab: 'T', mechanic: 'M', sym: 'S' + i, dir: 'long', entry: 100, stop: 99, t1: 102, rr: 2, state, fundAgainst: fa, gateClear: true });
  const agg = S.hgFwdFold({}, [rec(1, true, 't1'), rec(2, true, 'stop'), rec(3, false, 't1'), rec(4, undefined, 't1'), rec(5, 1, 'stop'), rec(6, true, 'open')]);
  const row = agg['T|M'];
  ok(row.fa && row.fa.wins === 1 && row.fa.losses === 1, 'against: 1 win, 1 loss');
  ok(row.fw && row.fw.wins === 1 && row.fw.losses === 0, 'with: 1 win');
  ok(row.wins === 3 && row.losses === 2, 'the unfiltered tally counts all five settled');
  ok(!S.hgFwdFold({}, [rec(9, undefined, 't1')])['T|M'].fa, 'an unmarked fold creates no bucket');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the split reader: the rule bar, the crowded bar, and the line');
{
  const S = boot(CORE);
  ok(S.hgFwdFundingSplitHtml('SQUEEZE') === '', 'an empty ledger renders nothing');
  const mk = (i, dir, f) => ({ sym: 'C' + i + 'USDT', dir, entry: 100, stop: dir === 'long' ? 99 : 101, t1: dir === 'long' ? 102 : 98, barT: barOf(SEC, 6), fundingPct: f });
  /* longs at 0.045 (against at 0.04, NOT crowded at 0.05), 0.06 (against and crowded), shorts at 0.06 (with), one unmarked */
  S.hgFwdRecordScan('SQUEEZE', '15m', [mk(1, 'long', 0.045), mk(2, 'long', 0.06), mk(3, 'short', 0.06), mk(4, 'short', 0.01), mk(5, 'long', null)], { horizonBars: 24 });
  const settle = (sym, win) => {
    const r = S.hgFwdRecords('SQUEEZE').filter(x => x.sym === sym)[0];
    const bars = []; for (let i = 1; i <= 4; i++){ const px = win ? (r.dir === 'long' ? r.t1 * 1.01 : r.t1 * 0.99) : (r.dir === 'long' ? r.stop * 0.99 : r.stop * 1.01);
      bars.push({ t: r.barT + i * SEC, o: px, h: px * 1.001, l: px * 0.999, c: px }); }
    S.hgFwdResolve(sym, '15m', bars);
  };
  settle('C1USDT', false); settle('C2USDT', true); settle('C3USDT', true); settle('C4USDT', false); settle('C5USDT', true);
  const sp = S.hgFwdFundingSplit('SQUEEZE');
  ok(sp.against === 2 && sp.with === 2 && sp.unmarked === 1, 'at the rule bar: 2 against, 2 with, 1 unmarked');
  ok(Math.abs(sp.againstR - 0.5) < 1e-9 && Math.abs(sp.withR - 0.5) < 1e-9, 'against +0.500R (one 2R win, one stop) and with +0.500R');
  ok(sp.crowded.bar === 0.05 && sp.crowded.n === 1 && sp.crowded.rest === 3, 'at the crowded bar only the 0.06 long is crowded (1 vs 3) -- the 0.045 long is against the rule and not crowded');
  ok(Math.abs(sp.crowded.r - 2) < 1e-9 && Math.abs(sp.crowded.restR - (2 - 1 - 1) / 3) < 1e-9, 'crowded +2.000R, the rest 0.000R');
  const html = text(S.hgFwdFundingSplitHtml('SQUEEZE'));
  ok(/FUNDING RULE SPLIT/.test(html) && /2 of 4 marked settled records \(50\.0%\) fired with funding AGAINST/.test(html), 'the line names the share the rule would have removed');
  ok(/against \+0\.500R at 50% on n=2/.test(html) && /with \+0\.500R at 50% on n=2/.test(html), 'and each bucket');
  ok(/crowded bar \(0\.05\): 1 crowded \+2\.000R vs 3 not \+0\.000R/.test(html), 'and the crowded-bar split, live records only');
  ok(/1 carry no mark and are counted as NEITHER/.test(html) && /Reported, not gated/.test(html), 'the unmarked record is named and nothing is withheld');
  S.__store[AGG_KEY] = JSON.stringify({ 'SQUEEZE|15m': { tab: 'SQUEEZE', wins: 1, losses: 1, expired: 0, rrSum: 2, fa: { wins: 3, losses: 9, expired: 0, rrSum: 6 }, fw: { wins: 8, losses: 4, expired: 0, rrSum: 16 } } });
  const sp2 = S.hgFwdFundingSplit('SQUEEZE');
  ok(sp2.agg && sp2.agg.against.losses === 9 && sp2.agg.with.wins === 8, 'the folded buckets are read back');
  ok(S.hgFwdFundingSplit('OIFLOW').agg === null && S.hgFwdFundingSplitHtml('OIFLOW') === '', 'another tab reads nothing of it');
  const p = text(S.hgFwdPanelHTML('SQUEEZE', { minRr: 2, title: 'F' }));
  ok(/FUNDING RULE SPLIT/.test(p) && /MACRO ALT FILTER SPLIT/.test(p) === false, 'the shared forward panel carries the funding line (and no macro line: these records carry no macro mark)');
  ok(!/FUNDING RULE SPLIT/.test(text(S.hgFwdPanelHTML('GOLDSCALP', { minRr: 1.5, title: 'G' }))), 'a gold panel prints no such line');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. CRYPTOVERSE, through the real tab: the venue rate lands on the card and the record, and moves no board');
{
  async function runCv(fundDelta){
    const S = boot(CORE.concat(['cryptoverse.js']));
    S.regimeState = () => null;
    /* seeds found THROUGH the tab path (its 1h leg drops the forming bars, so
       the direct-evaluate seeds differ): 150 / 288 fire longs and 361 a short
       on the Delta rows, 247 / 311 fire longs on the CoinDCX rows */
    const SEEDS = [150, 247, 288, 311, 361, 3];
    const SY = SEEDS.map((k, i) => ({ sym: 'ALT' + i + 'USDT', exchange: i % 2 ? 'coindcx' : 'delta', base: 'ALT' + i,
                                      fundingPct: i % 2 ? null : fundDelta }));
    const T = {}, H1 = {};
    SY.forEach((it, i) => { T[it.sym] = tape(101 + SEEDS[i] * 7919, 460); H1[it.sym] = tape(9 + SEEDS[i], 240); });
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null, venueCounts: { delta: 3, coindcx: 3, binance: 0, startrader: 0, other: 0 },
      droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
    S.hgDeskFetchKlinesResult = async (it, tf) => ({ rows: tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice(), ok: true, reason: null, error: null });
    S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice());
    const tab = S.HG_tabs.filter(t => t && t.id === 'cryptoverse')[0];
    const el = fakeEl(); tab.mount(el);
    const out = await tab.refresh();
    const st = S.cryptoverseState();
    const cards = el._node('cvCards');
    return { S, out, st, html: cards ? cards.innerHTML : '', recs: S.hgFwdRecords('CRYPTOVERSE') };
  }
  const hot = await runCv(0.07);
  ok(hot.out === 'refreshed' && hot.st.errors === 0 && hot.st.setups.length >= 2, 'the scan runs clean and fires ' + hot.st.setups.length + ' setups');
  const deltaLongs = hot.st.setups.filter(s => s.exchange === 'delta' && s.setup.dir === 'long');
  const cdcx = hot.st.setups.filter(s => s.exchange !== 'delta');
  ok(deltaLongs.length >= 1 && cdcx.length >= 1, 'the fixture reaches a Delta long (' + deltaLongs.length + ') and a CoinDCX row (' + cdcx.length + ')');
  ok(deltaLongs.every(s => s.funding && s.funding.against === true && s.funding.fundingPct === 0.07), 'every Delta long reads AGAINST at 0.07%');
  ok(cdcx.every(s => s.funding === null), 'every CoinDCX row reads nothing: the venue reports no funding');
  ok((hot.html.match(/FUNDING AGAINST 0\.0700%/g) || []).length === deltaLongs.length, 'the chip lands on each Delta long card and no other');
  ok(/FUNDING RUNS AGAINST THIS TRADE/.test(text(hot.html)) && /Reported, not gated/.test(text(hot.html)), 'the note names the rule and says it is not gated here');
  ok(hot.recs.filter(r => r.fundAgainst === true).length === deltaLongs.length && hot.recs.filter(r => r.fundingPct === undefined && r.fundAgainst === undefined).length === cdcx.length,
     'the records carry the same reads: Delta longs AGAINST, CoinDCX rows NOT RECORDED');
  const cool = await runCv(0.01);
  const lv = st => st.setups.map(s => s.sym + ':' + s.setup.dir + ':' + s.setup.entry + ':' + s.setup.stop + ':' + s.setup.t1).join('|');
  ok(lv(cool.st) === lv(hot.st) && !/FUNDING AGAINST/.test(cool.html), 'the same tape at 0.01% forms the identical board with no chip');
  ok(cool.recs.filter(r => r.exchange !== 'x').every(r => r.fundAgainst !== true) && cool.recs.some(r => r.fundAgainst === false && r.fundingPct === 0.01), 'and the Delta records read with the trade at 0.01%');
  const S2 = boot(['indicators.js', 'indicators2.js', 'pinemath.js', 'hg-forward.js', 'cryptoverse.js']);
  ok(S2.__cvFundingMark({ fundingPct: 0.07 }, 'long') === null, 'with hg-setup-core absent the desk reads null and claims nothing');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. 90PERCENT, through the real tab');
{
  async function runNp(fundDelta){
    const S = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'cryptogates.js', 'plans.js', 'hg-forward.js', 'ninetypercent.js']);
    S.regimeState = () => null;
    /* seeds found THROUGH the tab path under each venue cost (the closed-row
       read drops one bar, so the direct-evaluate seeds differ): Delta rows
       87 (long), 194 and 0 (shorts); CoinDCX rows 94 and 205 (longs) */
    const SEEDS = [87, 94, 194, 205, 0, 4, 3, 5];
    const SY = SEEDS.map((k, i) => ({ sym: 'MEME' + i + 'USDT', exchange: i % 2 ? 'coindcx' : 'delta', base: 'MEME' + i, fundingPct: i % 2 ? null : fundDelta }));
    const T = {}; SY.forEach((it, i) => { T[it.sym] = tape(7 + SEEDS[i] * 3571, 400); });
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null, venueCounts: { delta: 4, coindcx: 4, binance: 0, startrader: 0, other: 0 },
      droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
    S.hgDeskFetchKlines = async (it) => T[it.sym].slice();
    S.hgDeskFetchKlinesResult = async (it) => ({ rows: T[it.sym].slice(), ok: true, reason: null, error: null });
    const tab = S.HG_tabs.filter(t => t && t.id === 'ninetypercent')[0];
    const el = fakeEl(); tab.mount(el);
    const out = await tab.refresh();
    const st = S.ninetyPercentState();
    const cards = el._node('npCards');
    return { S, out, st, html: cards ? cards.innerHTML : '', recs: S.hgFwdRecords('90PERCENT') };
  }
  const hot = await runNp(-0.07);   /* negative: AGAINST the shorts, with the longs */
  ok(hot.out === 'refreshed' && hot.st.errors === 0, 'the scan runs clean');
  const dShorts = hot.st.setups.filter(s => s.exchange === 'delta' && s.setup.dir === 'short');
  const dLongs = hot.st.setups.filter(s => s.exchange === 'delta' && s.setup.dir === 'long');
  ok(dShorts.length >= 1 && dLongs.length >= 1, 'the fixture reaches Delta shorts (' + dShorts.length + ') and Delta longs (' + dLongs.length + ')');
  ok(dShorts.every(s => s.funding && s.funding.against === true) && dLongs.every(s => s.funding && s.funding.against === false), 'at -0.07% the shorts read AGAINST and the longs read with');
  ok((hot.html.match(/FUNDING AGAINST -0\.0700%/g) || []).length === dShorts.length, 'the chip lands on each Delta short and no long (' + dShorts.length + ')');
  ok(hot.recs.every(r => (r.exchange, true) && (r.dir === 'short' ? (r.fundAgainst === true || r.fundAgainst === undefined) : (r.fundAgainst === false || r.fundAgainst === undefined))), 'the records agree with the cards');
  const cool = await runNp(0.0);
  const lv = st => st.setups.map(s => s.sym + ':' + s.setup.dir + ':' + s.setup.entry + ':' + s.setup.stop + ':' + s.setup.t1).join('|');
  ok(lv(cool.st) === lv(hot.st) && !/FUNDING AGAINST/.test(cool.html), 'the same tape at 0.00% forms the identical board with no chip');
  ok(cool.recs.some(r => r.fundingPct === 0 && r.fundAgainst === false), 'and a zero rate records as a READ rate of zero, with the trade');
}

/* ---------------------------------------------------------------- 8 */
console.log('\n8. SQUEEZE, through a real FIRED scan: the hg-v981 mark lands at last, and the funding beside it');
{
  const S = boot(['indicators.js', 'indicators2.js', 'desk-scan-universe.js', 'hg-setup-core.js', 'hg-forward.js', 'squeeze.js'], { setTimeout, clearTimeout });
  /* the SQUEEZE test's own firing tape (60 pinned bars then a 30-bar drive), on real 4h timestamps */
  const t0 = barOf(H4, 90);
  const flat = [], drive = [];
  for (let i = 0; i < 60; i++) flat.push({ t: t0 + i * H4, o: 50, h: 51, l: 49, c: 50, v: 1000 });
  for (let i = 0; i < 30; i++){ const c = 50 + (i + 1), o = c - 1; drive.push({ t: t0 + (60 + i) * H4, o, h: c + 0.3, l: o - 0.3, c, v: 1000 }); }
  const full = flat.concat(drive);
  const fired = S.ttmSqueeze(full).fired, fIdx = fired.findIndex(Boolean);
  ok(fIdx > 59, 'premise: the tape fires at bar ' + fIdx);
  const rows4h = full.slice(0, fIdx + 1);
  const dUp = []; for (let i = 0; i < 120; i++){ const c = 80 + (i + 1) * 0.5, o = c - 0.5; dUp.push({ t: barOf(86400, 120) + i * 86400, o, h: c + 0.3, l: o - 0.3, c, v: 1000 }); }
  S.binancePerpUniverse = async () => ['FIREUSDT'];
  S.binanceTickers24h = async () => ({ FIREUSDT: { mark: rows4h[rows4h.length - 1].c, chg24: 1, turnoverUsd: 500e6, fundingPct: 0.06 } });
  S.binanceKlines = async (sym, tf) => (tf === '1d' ? dUp.slice() : rows4h.slice());
  const tab = S.HG_tabs.filter(t => t && t.id === 'squeeze')[0];
  const { pane, stubs } = stubPane();
  tab.mount(pane);
  stubs['#sqRun']._handler();
  const tStart = Date.now();
  while (stubs['#sqRun'].disabled && Date.now() - tStart < 8000) await new Promise(r => setTimeout(r, 25));
  const st = S.squeezeState ? S.squeezeState() : null;
  const firedRows = ((S.HG_squeezeResults || {}).results || []).filter(r => r.kind === 'fired');
  ok(firedRows.length === 1 && firedRows[0].dir === 'long', 'the real scan publishes one FIRED long (' + firedRows.length + ')');
  const recs = S.hgFwdRecords('SQUEEZE');
  ok(recs.length === 1 && recs[0].mechanic === 'SQZ-FIRED', 'and one forward record under SQZ-FIRED');
  const last = rows4h[rows4h.length - 1];
  ok(recs.length === 1 && recs[0].mark === last.c && recs[0].barT === last.t, 'the record carries the last closed bar as mark and bar -- hg-v981 wired this and it never landed, because the published row holds no candles');
  ok(recs.length === 1 && recs[0].fundingPct === 0.06 && recs[0].fundAgainst === true, 'and the venue funding with the rule verdict: 0.06% on a long is AGAINST');
}

/* ---------------------------------------------------------------- 9 */
console.log('\n9. OI FLOW, through a real scan');
{
  const S = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'oiflow.js'], { setTimeout, clearTimeout });
  const mkRows = (n, base, step) => { const rows = []; const t0 = barOf(H4, n); for (let i = 0; i < n; i++){ const c = base + step * i; rows.push({ t: t0 + i * H4, o: c - 0.5, h: c + 1, l: c - 1, c, v: 1000 }); } return rows; };
  const CFG = { BTCUSDT: { mark: 100, chg24: 2, turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50, fund: 0.06 },
                ETHUSDT: { mark: 50, chg24: -2, turnover: 300e6, oi: [100, 103], taker: 0.8, longPct: 50, fund: 0.06 } };
  S.binancePerpUniverse = async () => Object.keys(CFG);
  S.binanceTickers24h = async () => { const m = {}; Object.keys(CFG).forEach(s => { m[s] = { mark: CFG[s].mark, chg24: CFG[s].chg24, turnoverUsd: CFG[s].turnover }; }); return m; };
  S.binanceFunding = async (sym) => ({ markPrice: CFG[sym].mark, fundingPct: CFG[sym].fund });
  S.binanceOIHistory = async (sym) => ({ series: CFG[sym].oi.map(oi => ({ oi })) });
  S.binanceTakerRatio = async (sym) => ({ series: [{ buySellRatio: CFG[sym].taker }] });
  S.binanceLongShort = async (sym) => ({ latest: { longPct: CFG[sym].longPct } });
  S.binanceKlines = async (sym, tf, limit) => mkRows(limit || 120, 100, 0.1);
  S.smartSetup = (cls) => String(cls.dir).toLowerCase() === 'long'
    ? { type: 'SWING', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 117.5, rr1: 2, rr2: 3.5, riskPct: 5, confirmed: true, note: '' }
    : { type: 'SCALP', dir: 'short', entry: 50, stop: 53, t1: 44, t2: 39.5, rr1: 2, rr2: 3.5, riskPct: 6, confirmed: false, note: '' };
  S.toTrade = () => {}; S.hgMiniChart = () => ({});
  const tab = S.HG_tabs.filter(t => t && t.id === 'oiflow')[0];
  const { pane, stubs } = stubPane();
  tab.mount(pane);
  stubs['#oiflowRun']._handler();
  const tStart = Date.now();
  while (stubs['#oiflowRun'].disabled && Date.now() - tStart < 8000) await new Promise(r => setTimeout(r, 25));
  const pub = ((S.HG_oiflowResults || {}).results || []);
  ok(pub.length === 2 && pub.every(r => r.dir === 'LONG' || r.dir === 'SHORT'), 'premise: the classifier publishes its direction in UPPER case (' + pub.map(r => r.dir).join('/') + ')');
  const recs = S.hgFwdRecords('OIFLOW');
  ok(recs.length === 2, 'the real scan writes two records (' + recs.length + ') -- it had written NONE since the log was wired: the normaliser accepts only lower-case directions');
  ok(recs.every(r => r.dir === 'long' || r.dir === 'short') && recs.every(r => isFinite(r.mark) && r.mark > 0), 'lower-cased on the record, and the hg-v981 mark rides at last');
  ok(/FORWARD/.test(text(stubs['#oiflowFwd'].innerHTML)) && /OI-/.test(text(stubs['#oiflowFwd'].innerHTML)), 'and the FORWARD panel paints on the tab, listing the OI regimes -- it never had, for the same undefined alias');
  const btc = recs.filter(r => r.sym === 'BTCUSDT')[0], eth = recs.filter(r => r.sym === 'ETHUSDT')[0];
  ok(btc && btc.dir === 'long' && btc.fundingPct === 0.06 && btc.fundAgainst === true, 'the BTC long at 0.06% records AGAINST');
  ok(eth && eth.dir === 'short' && eth.fundingPct === 0.06 && eth.fundAgainst === false, 'the ETH short at 0.06% records with');
}

/* ---------------------------------------------------------------- 10 */
console.log('\n10. the census, derived by call shape: which record writers carry the funding they had in hand');
{
  function literalAround(t, idx){
    let d = 0, i = idx;
    for (; i >= 0; i--){ const ch = t[i]; if (ch === '}') d++; else if (ch === '{'){ if (d === 0) break; d--; } }
    const start = Math.max(0, i); d = 0; let j = start;
    for (; j < t.length; j++){ const ch = t[j]; if (ch === '{') d++; else if (ch === '}'){ d--; if (d === 0) break; } }
    return t.slice(start, j + 1);
  }
  const files = fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f));
  const carriers = [], bare = [];
  for (const f of files){
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    const re = /hgFwdRecordScan\s*\(/g; let m;
    while ((m = re.exec(src))){
      if (/hgFwdRecordScan = function/.test(src.slice(m.index, m.index + 40))) continue;
      const span = src.slice(m.index, m.index + 900);
      const tab = (span.match(/\(\s*('[^']+'|[A-Za-z_$][\w$]*)/) || [])[1];
      const pre = src.slice(Math.max(0, m.index - 3000), m.index);
      const spread = /\.\.\.c\b/.test(span);
      const arg3 = (span.match(/^hgFwdRecordScan\s*\(\s*[^,]+,\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*,/) || [])[1];
      let region, li = -1;
      if (arg3){
        const asg = pre.match(new RegExp('\\b' + arg3 + '\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\('));
        const at = asg ? src.indexOf('function ' + asg[1] + '(') : -1;
        region = at >= 0 ? src.slice(at, at + 3000) : pre;
        for (const em of region.matchAll(/\bentry\s*:/g)) li = em.index;
      } else {
        region = span;
        const em = region.match(/\bentry\s*:/); li = em ? em.index : -1;
      }
      if (li < 0 && !spread) continue;
      const lit = li >= 0 ? literalAround(region, li) : '';
      const key = f + ' -> ' + tab;
      if (/\bfundingPct\s*:/.test(lit) || spread) carriers.push(key); else bare.push(key);
    }
  }
  /* the spread case (index.html BEST:kind) carries funding only because
     hgCryptoCandRow puts it on the candidate row it spreads */
  const idx = stripComments(fs.readFileSync(root + 'index.html', 'utf8'));
  const candRow = idx.slice(idx.indexOf('function hgCryptoCandRow'), idx.indexOf('function hgCryptoCandRow') + 900);
  ok(/fundingPct: \(t && typeof t\.fundingPct === 'number' && isFinite\(t\.fundingPct\)\) \? t\.fundingPct : undefined/.test(candRow),
     'hgCryptoCandRow puts the ticker funding on the candidate row the SWING/SCALP publish spreads');
  /* contract-report.js joined the carriers in hg-v986: the figure was never at
     its record site, and the plan site one function up had it all along */
  const want = ['cryptoverse.js', 'ninetypercent.js', 'squeeze.js', 'oiflow.js', 'edge.js', 'omniroute.js', 'cryptoscan.js', 'engine.js', 'contract-report.js'];
  for (const w of want) ok(carriers.some(c => c.startsWith(w + ' ')), w + ' hands its funding in');
  ok(carriers.some(c => c.startsWith('index.html ')), 'the SWING/SCALP publish spread carries it');
  /* the ones that do NOT, named rather than remembered: none of these has a
     funding figure in reach at its record site today */
  const byDesign = ['omnipresent.js', 'dex-screener.js', 'reversalsniper.js', 'brain.js', 'trendtable.js', 'pine.js', 'pine-sub.js', 'super-best.js', 'super-sniper.js'];
  for (const b of byDesign) ok(bare.some(c => c.startsWith(b + ' ')), b + ' records without funding (no figure in reach at its record site) -- reported');
  const unexplained = bare.filter(c => !byDesign.some(b => c.startsWith(b + ' ')) && !/^index\.html /.test(c) && !/^gold|^omnigold|^newgold|^optigold|^tauric|^eightypercent|^super-gold|^milligold/.test(c));
  ok(unexplained.length === 0, 'every other bare writer is a gold desk or the inline CARD site' + (unexplained.length ? ' -- UNEXPLAINED: ' + unexplained.join(', ') : ''));
  ok(carriers.length + bare.length >= 27, 'the census sees the record writers (' + (carriers.length + bare.length) + ')');
}

/* ---------------------------------------------------------------- 11 */
console.log('\n11. the seams, read for what they are (textual, and said to be)');
{
  const fwd = stripComments(fs.readFileSync(root + 'hg-forward.js', 'utf8'));
  const omni = stripComments(fs.readFileSync(root + 'omniroute.js', 'utf8'));
  const eng = stripComments(fs.readFileSync(root + 'engine.js', 'utf8'));
  const edge = stripComments(fs.readFileSync(root + 'edge.js', 'utf8'));
  const cs = stripComments(fs.readFileSync(root + 'cryptoscan.js', 'utf8'));
  const sq = stripComments(fs.readFileSync(root + 'squeeze.js', 'utf8'));
  ok(/fundingPct: fundingOf\(c\),\s*fundAgainst: fundMarkOf\(c\),/.test(fwd), 'the entry point stamps both fields through its two local readers');
  ok(/W\.hgFwdFundingSplitHtml\(tab\)/.test(fwd.slice(fwd.indexOf('W.hgFwdPanelHTML = function'))), 'the shared panel calls the funding line');
  ok(/fundingPct: \(ex\.positioning && typeof ex\.positioning\.fundingPct === 'number'/.test(omni), 'OMNIROUTE hands in the same positioning funding its own gate read');
  ok(/fundingPct: \(svBar\[i\] \|\| \{\}\)\.fundingPct/.test(eng) && /\{ fundingPct: \(typeof rec\.fundingPct === 'number'/.test(eng), 'the GATES tab carries the candidate funding beside the state row, not on it');
  ok(/fundingPct: \(f\.item && typeof f\.item\.fundingPct === 'number'/.test(edge), 'EDGE hands in the item funding its enricher scored');
  ok(/fundingPct: \(s\.item && typeof s\.item\.fundingPct === 'number'/.test(cs), 'CRYPTO SCAN hands in the universe item funding it only ever read as a flag');
  ok(/pubSrc\.push\(r\);/.test(sq) && /var fsrc = pubSrc\[fi\] \|\| \{\};/.test(sq) && /hgFwdLastBar\(fsrc\.rows4h\)/.test(sq), 'SQUEEZE reads mark, bar and funding off the source result kept beside the published row');
  ok(!/hgFwdLastBar\(fr\.rows4h\)/.test(sq), 'and no longer off the published row, which carries no candles');
  const oi = stripComments(fs.readFileSync(root + 'oiflow.js', 'utf8'));
  ok(/dir: String\(fr\.cls\.dir \|\| ''\)\.toLowerCase\(\), entry: \+fs\.entry/.test(oi), 'OI FLOW lower-cases the direction at the record site');
  ok(!/\bW\.hgFwd/.test(oi) && (oi.match(/\bG\.hgFwd/g) || []).length >= 4, 'and reads the ledger through the alias this file defines (G), nowhere through W');
}

/* ---------------------------------------------------------------- 12 */
console.log('\n12. stamp');
{
  ok(swCacheOk(fs.readFileSync(root + 'sw.js', 'utf8')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed' + (process.exitCode ? ' — WITH FAILURES' : ''));
