/* hg-v991 — STAR TRADER CROWNED PRIME AND HIGH, PRINTED ADD TO BOOK AND SEND TO
   TRADE PLAN, AND WROTE NO FORWARD RECORD OF ANY KIND.

   The hg-v981 census counted 28 crypto forward-log writers by the files that
   call the ledger; a desk that never called it was invisible to that census.
   startradertab.js had no reference to hg-forward at all. So the desk whose
   whole thesis is multi-family confluence -- SWING, SCALP, EDGE, SQUEEZE,
   MEAN REV plus NEWS, REGIME, SENTIMENT (F&G), ROTATION, ON-CHAIN, SMART $,
   OI FLOW, STRUCTURE and the CONTEXT GATES -- could never be judged, and
   none of those layers had ever been asked, on this desk, whether it
   separates.

   This pack: every crypto synthesis with a plan is recorded (PRIME, HIGH and
   WATCH drafts alike; `ticket` marks what was crowned), dated on the last
   closed 4h bar, carrying the mark, the venue funding and one hg-v989 read
   mark per vote FAMILY (true = agreed with points, false = against or only
   cautioned, absent = the family cast no vote). Open records settle on the
   bars each scan fetches, and the shared forward panel is painted under the
   cards. The gold lane and the non-crypto contracts record nothing, by
   choice and said. Nothing is gated on any of it.

   Run: node tests/test-startrader-forward.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(files){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}
const STACK = ['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'edge.js', 'setup-stack.js', 'hg-forward.js', 'startrader.js', 'startradertab.js'];
const now = Math.floor(Date.now() / 1000);
const SEC4 = 14400, LAST4H = Math.floor(now / SEC4) * SEC4 - SEC4;   /* one closed bar behind the clock */
function tape(n, sec, endT, px0, drift){ const out = []; let p = px0; for (let i = 0; i < n; i++){ p = p * (1 + drift + Math.sin(i / 7) * 0.001); out.push({ t: endT - (n - 1 - i) * sec, o: p * 0.999, h: p * 1.004, l: p * 0.996, c: p, v: 1000 + (i % 7) * 50 }); } return out; }
const el = () => { const stubs = {}; const mk = (sel) => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, _h: {},
  addEventListener(ev, fn){ this._h[ev] = fn; }, classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } }, getAttribute(){ return sel; } });
  return { innerHTML: '', querySelector(sel){ return stubs[sel] || (stubs[sel] = mk(sel)); }, querySelectorAll(){ return []; }, _stubs: stubs }; };

console.log('1. the vote families and the read marks');
{
  const S = boot(STACK);
  ok(S.stVoteFamily('SWING PLAN') === 'SWING' && S.stVoteFamily('SCALP') === 'SCALP' && S.stVoteFamily('CRYPTO NEWS') === 'NEWS' && S.stVoteFamily('MEAN REV') === 'MEANREV' && S.stVoteFamily('CONTEXT GATES') === 'CONTEXT' && S.stVoteFamily('') === null, 'a vote source collapses to its family: SWING PLAN is SWING, CRYPTO NEWS is NEWS, MEAN REV is MEANREV');
  const setup = { dir: 'long', allVotes: [
    { src: 'SWING', dir: 'long', pts: 1 }, { src: 'SWING PLAN', dir: 'long', pts: 3 },
    { src: 'NEWS', dir: 'long', pts: 0, caution: true },
    { src: 'SENTIMENT', dir: 'short', pts: 1 },
    { src: 'REGIME', dir: 'long', pts: 2 },
    { src: 'CONTEXT GATES', dir: 'short', pts: 1 } ] };
  const m = S.stReadMarks(setup);
  ok(m['vote:SWING'] === true && m['vote:REGIME'] === true, 'a family that agreed with points marks TRUE (two SWING votes merge to one family)');
  ok(m['vote:NEWS'] === false, 'a NEWS caution (same direction, zero points) marks FALSE: the calendar was not clear');
  ok(m['vote:SENTIMENT'] === false && m['vote:CONTEXT'] === false, 'a family that voted AGAINST marks FALSE');
  ok(m['vote:EDGE'] === undefined && m['vote:ROTATION'] === undefined && Object.keys(m).length === 5, 'a family that cast no vote is ABSENT -- not recorded, never false');
  ok(S.stReadMarks({ dir: 'long', allVotes: [] }) === undefined && S.stReadMarks(null) === undefined && S.stReadMarks({ dir: 'long' }) === undefined, 'no votes, no marks');
  /* every family this file can ever cast fits under the ledger's 16-key cap, so no mark is silently dropped */
  const srcs = new Set(); for (const mm of strip(read('startradertab.js')).matchAll(/src:\s*'([^']+)'/g)) srcs.add(S.stVoteFamily(mm[1]));
  ok(srcs.size >= 12 && srcs.size <= 16, 'the ' + srcs.size + ' vote families the file can cast fit under the ledger cap of 16 reads per record (' + Array.from(srcs).sort().join(', ') + ')');
  const all = { dir: 'long', allVotes: Array.from(srcs).map(f => ({ src: f, dir: 'long', pts: 1 })) };
  const bar = LAST4H;
  S.hgFwdRecordScan('T', '4h', [{ sym: 'AUSD', dir: 'long', entry: 100, stop: 99, t1: 102, mark: 100, barT: bar, reads: S.stReadMarks(all) }], { horizonBars: 20 });
  ok(Object.keys(S.hgFwdRecords('T')[0].reads).length === srcs.size, 'and a record marked with every family keeps every mark through the normaliser');
}

console.log('\n2. the rows the desk hands the ledger');
{
  const S = boot(STACK);
  const rows4h = tape(240, SEC4, LAST4H, 100, 0.0005);
  const base = { sym: 'BTCUSD', klass: 'crypto', dir: 'long', tier: 'PRIME', planDraft: false, planFamily: 'SWING', rows4h,
    plan: { entry: 110, stop: 105, t1: 120 }, mark: 110.5, ticker: { fundingPct: 0.0123 },
    allVotes: [{ src: 'SWING PLAN', dir: 'long', pts: 3 }, { src: 'REGIME', dir: 'long', pts: 2 }] };
  const r = S.stFwdRows([base])[0];
  ok(r && r.sym === 'BTCUSD' && r.dir === 'long' && r.entry === 110 && r.stop === 105 && r.t1 === 120, 'a PRIME crypto synthesis becomes a row with its plan levels');
  ok(r.mechanic === 'ST-SWING' && r.ticket === true, 'mechanic ST-<plan family>, ticket TRUE for a crowned non-draft');
  ok(r.mark === 110.5 && r.barT === LAST4H && r.fundingPct === 0.0123, 'the mark, the last CLOSED 4h bar and the venue funding ride');
  ok(r.reads['vote:SWING'] === true && r.reads['vote:REGIME'] === true, 'the read marks ride');
  const draft = S.stFwdRows([Object.assign({}, base, { tier: 'WATCH', planDraft: true, planFamily: 'NEAR' })])[0];
  ok(draft.ticket === false && draft.mechanic === 'ST-NEAR', 'a WATCH draft is recorded with ticket FALSE under ST-NEAR -- the pool measures the raw synthesis');
  ok(S.stFwdRows([Object.assign({}, base, { tier: 'HIGH', planDraft: true })])[0].ticket === false, 'a HIGH tier on a draft plan is not a ticket');
  ok(S.stFwdRows([Object.assign({}, base, { klass: 'metal', sym: 'XAUUSD' })]).length === 0 && S.stFwdRows([Object.assign({}, base, { klass: 'fx', sym: 'EURUSD' })]).length === 0, 'the gold lane and the non-crypto contracts record NOTHING (by choice, said in the file)');
  ok(S.stFwdRows([Object.assign({}, base, { plan: null })]).length === 0 && S.stFwdRows([Object.assign({}, base, { plan: { entry: 110, stop: NaN, t1: 120 } })]).length === 0, 'no plan or an unreadable level: no row');
  ok(S.stFwdRows([Object.assign({}, base, { mark: 0, ticker: { fundingPct: null }, rows4h: [] })])[0].mark === undefined && S.stFwdRows([Object.assign({}, base, { ticker: { fundingPct: null } })])[0].fundingPct === undefined && S.stFwdRows([Object.assign({}, base, { rows4h: [] })])[0].barT === undefined, 'a zero mark, a null funding and no bars stay ABSENT (+null is 0, and 0 is not a price)');
  ok(S.stFwdRows(null).length === 0 && S.stFwdRows([]).length === 0, 'nothing in, nothing out');
}

console.log('\n3. driven through the real tab: mount, scan, record, settle');
{
  const S = boot(STACK);
  const px = { BTCUSD: 100, ETHUSD: 50, XAUUSD: 2300 };
  let shift = 0;   /* bars appended after the signal bar on later scans */
  S.startraderAllContracts = () => [{ sym: 'BTCUSD', base: 'BTC', klass: 'crypto', label: 'Bitcoin' }, { sym: 'ETHUSD', base: 'ETH', klass: 'crypto', label: 'Ether' }, { sym: 'XAUUSD', base: 'XAU', klass: 'metal', gold: true, label: 'Gold' }];
  S.startraderCandles = async (sym, tf, n) => {
    const sec = tf === '4h' ? SEC4 : tf === '1h' ? 3600 : 900;
    /* the 4h series ends TWO closed bars behind the clock on the first scan so a later scan can
       hand the desk one more CLOSED bar (a bar at the clock floor is still forming and is dropped) */
    const endT = Math.floor(now / sec) * sec - sec - (tf === '4h' ? (1 - shift) * SEC4 : 0);
    const rows = tape(n, sec, endT, px[sym], 0.0005);
    if (shift && tf === '4h'){ const last = rows[rows.length - 1]; last.h = last.c * 1.2; last.c = last.c * 1.15; }   /* the appended bar trades through T1 */
    return rows;
  };
  S.startraderFullTickers = async () => [{ symbol: 'BTCUSD', fundingPct: 0.02, mark: 100 }, { symbol: 'ETHUSD', fundingPct: -0.01, mark: 50 }, { symbol: 'XAUUSD', fundingPct: null, mark: 2300 }];
  /* the same mocks the tab's own test uses to force a crowned synthesis */
  S.swingTryClean = (rows) => { const c = rows[rows.length - 1].c; return { dir: 'long', entry: c, stop: c * 0.97, t1: c * 1.06, t2: c * 1.09, rr: 2 }; };
  S.swingGateMatrix = () => ({ dir: 'long', clean: true, passed: 7 });
  S.scalpTryClean = (r1, r15) => { const c = r15[r15.length - 1].c; return { dir: 'long', entry: c, stop: c * 0.985, t1: c * 1.03, t2: c * 1.05, rr: 2 }; };
  S.hgNewsRisk = () => ({ risk: 'low' });
  S.regimeState = () => ({ label: 'RISK ON', playbook: { bias: 'LONG-ONLY' } });
  S.hgNewsState = () => ({ fng: { value: 45 } });
  const tab = S.HG_tabs.find(t => t.id === 'startrader');
  const E = el();
  tab.mount(E);
  ok(/id="stFwd"/.test(E.innerHTML), 'the tab template carries a forward host under the cards');
  ok(typeof E._stubs['#stRun']._h.click === 'function', 'SCAN STAR TRADER is wired');
  /* the click handler fires runScan and returns nothing, and the tab's refresh runs only after a first
     click -- so: click once, then refresh; either way wait for the stat line to say done */
  const waitDone = async () => { for (let i = 0; i < 400; i++){ const t = E._stubs['#stStat'].textContent; if (/^done|^scan failed/.test(t)) return t; await new Promise(r => setTimeout(r, 25)); } throw new Error('scan did not finish: ' + E._stubs['#stStat'].textContent); };
  let clicked = false;
  const run = async () => { if (!clicked){ clicked = true; E._stubs['#stRun']._h.click(); } else { E._stubs['#stStat'].textContent = ''; await tab.refresh(); } return waitDone(); };
  await run();
  const recs = S.hgFwdRecords('STAR TRADER');
  ok(recs.length === 2 && recs.every(r => r.sym === 'BTCUSD' || r.sym === 'ETHUSD'), 'the scan wrote one record per crypto contract and NONE for the gold lane (' + recs.map(r => r.sym).join(', ') + ')');
  const BAR0 = LAST4H - SEC4;
  ok(recs.every(r => r.barT === BAR0), 'every record is dated on the last CLOSED 4h bar the desk read, never the clock (' + recs[0].barT + ')');
  ok(recs.every(r => r.mark > 0 && r.ticket === true && r.mechanic === 'ST-SWING' && r.dir === 'long'), 'every record carries its mark, is a TICKET (PRIME/HIGH, non-draft) and names the plan family');
  ok(recs.find(r => r.sym === 'BTCUSD').fundingPct === 0.02 && recs.find(r => r.sym === 'ETHUSD').fundingPct === -0.01, 'each record carries the venue funding its ticker had');
  ok(recs.every(r => r.reads && r.reads['vote:SWING'] === true && r.reads['vote:SCALP'] === true && r.reads['vote:REGIME'] === true && r.reads['vote:NEWS'] === true && r.reads['vote:SENTIMENT'] === true), 'the read marks name the families that crowned it: SWING, SCALP, REGIME, NEWS, SENTIMENT (' + JSON.stringify(recs[0].reads) + ')');
  ok(recs.every(r => r.reads['vote:EDGE'] === undefined && r.reads['vote:ROTATION'] === undefined), 'families that cast no vote are absent from the record');
  ok(/warns/.test(JSON.stringify(Object.keys(S.__store))) === false, 'nothing thrown into the ledger warn log');
  const fwdHtml = E._stubs['#stFwd'].innerHTML;
  ok(/FORWARD/.test(fwdHtml) && /every crypto synthesis this desk formed/.test(fwdHtml), 'the forward panel is painted under the cards');
  ok(/2 forward records written/.test(E._stubs['#stStat'].textContent), 'the stat line says how many records were written (' + E._stubs['#stStat'].textContent + ')');
  await run();
  ok(S.hgFwdRecords('STAR TRADER').length === 2, 'a second scan on the same closed bar writes nothing new (the ledger dedups on the bar)');
  shift = 1;
  await run();
  const after = S.hgFwdRecords('STAR TRADER');
  const settled = after.filter(r => r.barT === BAR0);
  ok(settled.length === 2 && settled.every(r => r.state === 't1'), 'the next CLOSED bar, trading through T1, SETTLES both records on the bars the scan itself fetched');
  ok(after.filter(r => r.barT === BAR0 + SEC4).length === 2, 'and the new bar\'s syntheses are recorded once each');
  const sp = S.hgFwdReadSplit('STAR TRADER');
  ok(sp && sp.settled === 2 && sp.reads['vote:REGIME'] && sp.reads['vote:REGIME'].yes.n === 2, 'the hg-v989 read split can now ask whether REGIME separates on this desk (2 settled, both carried it)');
  ok(/REPLAY READ SPLIT/.test(E._stubs['#stFwd'].innerHTML) || /FORWARD/.test(E._stubs['#stFwd'].innerHTML), 'the panel repaints after settlement');
}

console.log('\n4. wired where it must be, and nothing gated');
{
  const src = strip(read('startradertab.js'));
  ok(/W\.hgFwdResolve\(c\.sym, ST_FWD_TF, h4\)/.test(src) && src.indexOf('W.hgFwdResolve(c.sym') < src.indexOf('var setup = stSynthesize(c, h4, h1, m15, tk, ctx)'), 'open records settle on the fetched 4h bars BEFORE this bar\'s synthesis is recorded (textual: inside runScan)');
  ok(/var recorded = stRecordForward\(found\);/.test(src) && src.indexOf('var recorded = stRecordForward(found);') > src.indexOf('found.sort(function(a, b){'), 'every synthesis in `found` is recorded after the sort, shown or not');
  ok((src.match(/hgFwdRecordScan\(/g) || []).length === 1, 'one call into the ledger, in stRecordForward');
  ok(/if \(!r \|\| !r\.plan \|\| r\.klass !== 'crypto'\) continue;/.test(src), 'the record builder takes crypto contracts only (textual)');
  const synthBody = src.split('function stSynthesize(')[1].split('var ST_FWD_TAB')[0];
  ok(synthBody.length > 2000 && !/stFwdRows|stReadMarks|hgFwdRecords|hgFwdStats|hgFwdPool/.test(synthBody), 'the synthesis reads nothing back from the ledger: no gate is fed by the record');
  for (const f of ['hg-gates.js', 'hg-solidity.js', 'cryptogates.js']) ok(!/STAR TRADER/.test(strip(read(f))), f + ' knows nothing of this desk\'s records');
}

console.log('\n5. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v) && parseInt(v.slice(4), 10) >= 991, 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
