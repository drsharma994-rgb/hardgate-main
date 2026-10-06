/* hg-v1154 (ported from the hg-v998 branch onto the split matrix) — TREND MATRIX FORMED ITS CLEAN TICKETS AND LIMIT BOARD FROM PRICE
   ALONE, WHILE THE FREE POSITIONING FEEDS AND THE RULE THAT READS THEM WERE
   ALREADY IN THE REPO.

   Five indicator legs on 1d/4h bars and swingTryClean's 7/7 gates -- and
   nothing else. SWING, whose gates those are, has run every CLEAN hit through
   hgPostGateSetupVeto since hg-v197: the flow trap (Binance taker ratio, depth
   imbalance, spot taker flow, Bybit positioning cross), BTC relative strength,
   stale momentum, the regime overlay, the on-chain alt gate and calibration,
   every leg a free public feed the data layer already fetches and caches. And
   G4 on a CoinDCX contract read no funding unless the ticker carried the
   Binance twin (hgEnrichTickerFundingTwin). TREND MATRIX did neither, so a TM
   "7/7 CLEAN" was a weaker claim than SWING's under the same label.

   This pack: every directional row is fed the funding twin BEFORE its gates
   and, when it has a gate hit, judged by the shared post-gate rule on its own
   4h series. A vetoed row keeps its levels, moves to the watch tier (no
   handoff), leaves the LIMIT BOARD, and is still RECORDED with ticket:false
   and reads['postgate:veto'] = true so the ledger can measure the veto on
   this desk; a passed row records false; unchecked records nothing. The
   snapshot carries the verdict and CONTRACT REPORT reads it. With the shared
   readers absent the board reads exactly as before. No threshold moves.

   The matrix ships as trendtable.combined.js (served as the twelve trendtable-src-N.js
   parts); this guard boots the combined file, which is what the parts concatenate to.

   Run: node tests/test-trendmx-free-feeds.mjs */
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

function boot(files, extra){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }), head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  const warns = []; const rw = s.hgFwdWarn; s.hgFwdWarn = function(a, e){ warns.push(a + ': ' + (e && e.message || e)); return rw && rw.apply(this, arguments); }; s.__warns = warns;
  return s;
}
const SEC4 = 14400;
const now = Date.now() / 1000;
/* a tape whose last closed bar sits one 4h bar behind the clock */
function tape(n, step, slope, endT){
  const rows = []; let c = 100; const t0 = endT - (n - 1) * step;
  for (let i = 0; i < n; i++){ c += slope; rows.push({ t: t0 + i * step, o: c, h: c + 0.3, l: c - 0.3, c, v: 1000 }); }
  return rows;
}
const LAST4H = Math.floor(now / SEC4) * SEC4 - SEC4;
const UP = { '4h': tape(300, SEC4, 0.3, LAST4H), '1d': tape(300, 86400, 1, Math.floor(now / 86400) * 86400 - 86400), '1h': tape(300, 3600, 0.1, Math.floor(now / 3600) * 3600 - 3600) };
const STACK = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'setup-ui.js', 'trendtable.combined.js', 'contract-report.js'];
const ITEMS = [
  { sym: 'ETHUSDT', base: 'ETH', exchange: 'binance', fundingPct: null, turnoverUsd: 1e8, mark: 190 },   /* no venue funding: the twin supplies it */
  { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', fundingPct: 0.02, turnoverUsd: 1e8, mark: 190 },     /* Delta reports funding */
  { sym: 'ADAUSDT', base: 'ADA', exchange: 'coindcx', fundingPct: null, turnoverUsd: 1e8, mark: 190 },   /* CoinDCX reports none and the twin has none either */
  { sym: 'DOGEUSDT', base: 'DOGE', exchange: 'binance', fundingPct: 0.01, turnoverUsd: 1e8, mark: 190 }  /* directional row with NO gate hit */
];
/* the recording stubs: the writers under test are this desk's wiring; the two shared rules have their own guards */
function wire(S, o){
  o = o || {};
  S.hgDeskLoadUniverse = async () => ({ items: ITEMS, rawLen: ITEMS.length });
  S.hgDeskFetchKlines = (it, tf) => Promise.resolve(UP[tf]);
  S.binanceKlines = async (sym, tf) => UP[tf];
  /* the mount's load check names the binance universe layer; hgDeskLoadUniverse above supplies the items */
  S.binancePerpUniverse = async () => []; S.binanceTickers24h = async () => ({});
  S.toTrade = () => {};
  S.__gateSaw = {}; S.__pgCalls = []; S.__applyCalls = [];
  if (!o.noTwin) S.hgEnrichTickerFundingTwin = async (t) => {
    if (t && t.symbol === 'ETHUSDT' && (t.fundingPct === null || t.fundingPct === undefined)) return Object.assign({}, t, { fundingPct: 0.0123, fundingTwin: 'ETHUSDT' });
    return t;   /* ADA: no twin rate; SOL/DOGE: already carry one */
  };
  S.swingTryClean = (rows, ticker) => {
    S.__gateSaw[ticker.symbol] = ticker.fundingPct;
    if (ticker.symbol === 'DOGEUSDT') return null;
    const c = rows[rows.length - 1].c;
    return { dir: 'long', entry: c, stop: c * 0.97, t1: c * 1.06, t2: c * 1.09, rr: 2, clean: true, passed: 7, mark: c };
  };
  if (!o.noPostGate) S.hgPostGateSetupVeto = async (ticker, hit, rows, style, getC) => {
    S.__pgCalls.push({ sym: ticker && ticker.symbol, hit, rows, style, getC, fundingPct: ticker && ticker.fundingPct });
    if (o.throwOn && ticker.symbol === o.throwOn) throw new Error('legs exploded');
    if (ticker.symbol === 'ETHUSDT') return { ok: false, reason: 'flow trap', tag: 'flow', flowDetail: 'CVD ✗ · OBI ✗ · SPOT —' };
    if (ticker.symbol === 'SOLUSDT') return { ok: true, unchecked: false, flowOk: true, flowDetail: 'CVD ✓ · OBI ✓ · SPOT ✓', rsEdge: 0.4 };
    return { ok: true, unchecked: true, uncheckedReasons: ['flow trap: FLOW N/A — no Binance twin for ADAUSDT'] };
  };
  S.hgApplyCryptoPostGate = (hit, qv) => { S.__applyCalls.push({ hit, qv }); hit.postGate = qv; };
  return S;
}
const mk = () => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, querySelector(){ return mk(); }, querySelectorAll(){ return []; }, addEventListener(ev, fn){ this._handler = fn; } });
async function runTab(S){
  const nodes = {};
  const el = { innerHTML: '', querySelector(sel){ if (!nodes[sel]) nodes[sel] = mk(); return nodes[sel]; }, querySelectorAll(){ return []; } };
  const tab = S.HG_tabs.filter(t => t.id === 'trendmx')[0];
  tab.mount(el);
  nodes['[data-r="run"]']._handler();
  const t0 = Date.now();
  while (Date.now() - t0 < 8000){ const t = nodes['[data-r="status"]'].textContent || ''; if (t.indexOf('scanned') > -1 || t.indexOf('Scan failed') > -1) break; await new Promise(r => setTimeout(r, 25)); }
  /* the full scan rows (the published snapshot is a reduced copy): the cached scan result inside its 5-min window */
  try { S.__rows = (await S.trendmxScan({})).rows; } catch (e) { S.__rows = []; }
  return nodes;
}
const rowOf = (S, sym) => (S.__rows || []).find(r => r.sym === sym);

console.log('1. the shared verdict, read into three states');
{
  const S = boot(['indicators.js', 'indicators2.js', 'trendtable.combined.js']);
  const R = S.tmPostGateRead, M = S.tmPostGateReads;
  ok(typeof R === 'function' && typeof M === 'function', 'tmPostGateRead and tmPostGateReads are exported');
  ok(R(null) === undefined && R(undefined) === undefined && R('ok') === undefined && R(7) === undefined, 'no verdict object: the read is ABSENT (the rule did not run)');
  const v = R({ ok: false, reason: 'lagging BTC', tag: 'rs', flowDetail: 'x' });
  ok(v && v.state === 'veto' && v.reason === 'lagging BTC' && v.tag === 'rs' && v.flowDetail === 'x', 'ok:false reads VETO with the rule\'s own reason and tag');
  ok(R({ ok: false }).reason === 'post-gate veto' && R({ ok: false }).tag === null, 'a veto with no reason still names itself');
  const u = R({ ok: true, unchecked: true, uncheckedReasons: ['flow trap: no legs'] });
  ok(u && u.state === 'unchecked' && u.reasons.length === 1 && /no legs/.test(u.reasons[0]), 'ok + unchecked reads UNCHECKED carrying the reasons');
  ok(R({ ok: true, unchecked: true }).reasons.length === 0, 'unchecked with no reasons list: an empty list, never a throw');
  const p = R({ ok: true, unchecked: false, flowDetail: 'CVD ✓', rsEdge: 0.3 });
  ok(p && p.state === 'pass' && p.flowDetail === 'CVD ✓' && p.rsEdge === 0.3, 'ok and tested reads PASS with the flow detail and the RS edge');
  ok(R({ ok: true, rsEdge: '0.3' }).rsEdge === null && R({ ok: true, rsEdge: NaN }).rsEdge === null && R({ ok: true }).rsEdge === null, 'a string or NaN RS edge is not a read');
  ok(R({ ok: true, unchecked: 1 }).state === 'pass' && R({ ok: 0 }).state === 'pass', 'only the two booleans decide: unchecked:1 is not unchecked, ok:0 is not a veto (the ledger shape, never coerced)');
  ok(JSON.stringify(M({ postGate: { state: 'veto' } })) === '{"postgate:veto":true}', 'a vetoed row marks postgate:veto TRUE');
  ok(JSON.stringify(M({ postGate: { state: 'pass' } })) === '{"postgate:veto":false}', 'a passed row marks FALSE');
  ok(M({ postGate: { state: 'unchecked' } }) === undefined && M({}) === undefined && M(null) === undefined, 'unchecked or un-run marks NOTHING -- absent, never false');
}

console.log('\n2. driven through the real scan and the real tab: feed, gate, post-gate, board, cards, records, report');
{
  const S = wire(boot(STACK));
  const nodes = await runTab(S);
  ok(/scanned/.test(nodes['[data-r="status"]'].textContent), 'the scan completed (' + nodes['[data-r="status"]'].textContent.slice(0, 60) + ')');
  const eth = rowOf(S, 'ETHUSDT'), sol = rowOf(S, 'SOLUSDT'), ada = rowOf(S, 'ADAUSDT'), doge = rowOf(S, 'DOGEUSDT');
  ok(eth && sol && ada && doge && [eth, sol, ada, doge].every(r => S.tmDirOf(r) === 'long'), 'REACHABILITY: four directional rows formed');
  /* the funding twin lands BEFORE the gates read it */
  ok(S.__gateSaw.ETHUSDT === 0.0123 && S.__gateSaw.SOLUSDT === 0.02 && S.__gateSaw.ADAUSDT === null, 'the gate matrix read the Binance twin on ETH (0.0123), the venue\'s own on SOL (0.02), and nothing on ADA where neither exists (' + JSON.stringify(S.__gateSaw) + ')');
  ok(eth.fundingPct === 0.0123 && eth.fundingTwin === 'ETHUSDT' && sol.fundingPct === 0.02 && sol.fundingTwin === undefined && ada.fundingPct === null, 'the row carries the twin rate and names the twin; a venue rate is left as it was; no rate stays null');
  /* the shared post-gate ran on the rows with a gate hit, and only those */
  ok(S.__pgCalls.length === 3 && !S.__pgCalls.some(c => c.sym === 'DOGEUSDT'), 'the post-gate ran on the three rows with a gate hit and NOT on the directional row without one (' + S.__pgCalls.map(c => c.sym).join(',') + ')');
  const pe = S.__pgCalls.find(c => c.sym === 'ETHUSDT');
  ok(pe.style === 'swing' && pe.rows === eth.rows4h && pe.hit === eth.gate.hit && typeof pe.getC === 'function' && pe.fundingPct === 0.0123, 'it was handed the SWING style, the row\'s own 4h series, the gate\'s own hit, a candle fetcher for the BTC leg, and the enriched ticker');
  ok(eth.postGate && eth.postGate.state === 'veto' && eth.postGate.reason === 'flow trap' && eth.postGate.tag === 'flow', 'ETH reads VETO (flow trap)');
  ok(sol.postGate && sol.postGate.state === 'pass' && sol.postGate.rsEdge === 0.4, 'SOL reads PASS');
  ok(ada.postGate && ada.postGate.state === 'unchecked' && /no Binance twin/.test(ada.postGate.reasons[0]), 'ADA reads UNCHECKED, naming the leg that could not run');
  ok(doge.postGate === undefined, 'DOGE carries no verdict at all');
  ok(S.__applyCalls.length === 2 && S.__applyCalls.every(c => c.hit !== eth.gate.hit), 'hgApplyCryptoPostGate stamped the two hits the rule let through and not the vetoed one (SWING\'s own applier)');
  /* the board */
  const table = nodes['[data-r="out"]'].innerHTML;
  ok((table.match(/PG VETO/g) || []).length === 1 && (table.match(/PG ✓/g) || []).length === 1 && (table.match(/PG \?/g) || []).length === 1, 'the GATES column carries one PG VETO, one PG ✓ and one PG ? -- and nothing on the row the rule did not run on');
  ok(/title="flow trap"/.test(table), 'the veto chip names its reason');
  /* the tiers and the cards */
  const cards = nodes['[data-r="cards"]'].innerHTML, near = nodes['[data-r="near"]'].innerHTML;
  ok(/SOLUSDT/.test(cards) && /ADAUSDT/.test(cards) && !/ETHUSDT/.test(cards), 'CLEAN TICKETS carry SOL and ADA; the vetoed ETH is NOT a clean card');
  ok(/ETHUSDT/.test(near) && /POST-GATE VETO · flow trap — watch only, not a ticket/.test(text(near)) && /levels kept, handoffs withheld, recorded for the ledger/.test(text(near)), 'ETH sits on the watch tier and its NOTE names the veto and what was withheld (the gate chip alone does not satisfy this)');
  const ethCard = near.slice(near.indexOf('ETHUSDT') - 400, near.indexOf('ETHUSDT') + 2500);
  ok(!/SEND TO TRADE PLAN/.test(ethCard.replace(/watch only[^<]*/g, '')) && !/toTrade/.test(ethCard), 'the vetoed card prints NO handoff (the shared card withholds both below the clean tier)');
  ok(/POST-GATE PASS/.test(text(cards)) && /POST-GATE UNCHECKED/.test(text(cards)), 'the clean cards carry their own post-gate chip, PASS and UNCHECKED');
  const gc = nodes['[data-r="gateclean"]'].innerHTML;
  ok(/SOLUSDT/.test(gc) && /ADAUSDT/.test(gc) && !/ETHUSDT/.test(gc), 'the GATE-CLEAN desk shows SOL and ADA and not the vetoed ETH');
  ok(/held off/.test(text(gc)) && /SWING post-gate rule refused the row/.test(text(gc)) && /recorded, not shown/.test(text(gc)), 'the desk names the fifth witness that held ETH off, and says it is recorded');
  /* the expanded plan block: levels kept, handoffs withheld with the reason */
  const pb = S.trendmxPlanBlock(eth);
  ok(/ENTRY|entry/i.test(pb) && /POST-GATE VETO · flow trap/.test(text(pb)) && /handoffs withheld/.test(text(pb)) && !/toTrade|ADD TO BOOK/.test(pb), 'the expanded ETH plan keeps its levels, names the veto, and prints the reason where the two handoffs were');
  ok(!/handoffs withheld/.test(S.trendmxPlanBlock(sol)) && /POST-GATE PASS/.test(text(S.trendmxPlanBlock(sol))), 'the SOL plan block keeps its handoffs and names PASS');
  /* the records */
  const all = S.hgFwdRecords('TRENDMX');
  /* main records at two sites with the mechanic in the key: the class desks (TM-CLEAN7 / TM-CONVICTION) and the crown recorder (CLEAN / PERFECT) */
  const recs = all.filter(r => r.mechanic === 'TM-CLEAN7' || r.mechanic === 'TM-CONVICTION');
  const re = recs.find(r => r.sym === 'ETHUSDT'), rs = recs.find(r => r.sym === 'SOLUSDT'), ra = recs.find(r => r.sym === 'ADAUSDT');
  const rdg = recs.find(r => r.sym === 'DOGEUSDT');
  ok(recs.length === 4 && re && rs && ra && rdg, 'four class-desk records: the three gate-clean rows, the vetoed one INCLUDED, and the conviction-only row the board always recorded (' + recs.map(r => r.sym + ':' + r.mechanic).join(',') + ')');
  ok(rdg.mechanic === 'TM-CONVICTION' && rdg.ticket === false && !(rdg.reads && 'postgate:veto' in rdg.reads) && rdg.fundingPct === 0.01, 'the row with no gate hit records as TM-CONVICTION, no ticket, no post-gate mark (the rule did not run on it), the venue funding riding');
  const crown = all.filter(r => r.mechanic === 'CLEAN' || r.mechanic === 'PERFECT');
  const ce = crown.find(r => r.sym === 'ETHUSDT'), cs = crown.find(r => r.sym === 'SOLUSDT');
  ok(ce && ce.ticket === false && ce.reads && ce.reads['postgate:veto'] === true && cs && cs.ticket === true && cs.reads && cs.reads['postgate:veto'] === false, 'the crown recorder (the second record site) carries the same verdict: the vetoed row is no ticket there either');
  ok(re.ticket === false && re.reads && re.reads['postgate:veto'] === true && re.mechanic === 'TM-CLEAN7', 'the vetoed row is recorded with ticket:false and postgate:veto TRUE under its own mechanic (the fifth witness is the one that is recorded)');
  ok(rs.ticket === true && rs.reads && rs.reads['postgate:veto'] === false, 'the passed row records ticket:true and postgate:veto FALSE');
  ok(ra.ticket === true && !(ra.reads && 'postgate:veto' in ra.reads), 'the unchecked row records ticket:true and NO post-gate mark -- absent, never false');
  ok(re.fundingPct === 0.0123 && re.fundAgainst === false && rs.fundingPct === 0.02 && rs.fundAgainst === false && ra.fundingPct === undefined && ra.fundAgainst === undefined, 'funding rides: the twin on ETH, the venue\'s on SOL, NOT RECORDED on ADA (never a zero)');
  ok(recs.every(r => r.barT === LAST4H && r.mark > 0), 'every record is still dated on the last closed 4h bar with its mark');
  ok(S.__warns.length === 0, 'nothing thrown into the ledger warn log');
  /* the snapshot and the report */
  const snap = S.trendmxState().rows;
  const se = snap.find(r => r.sym === 'ETHUSDT'), ss = snap.find(r => r.sym === 'SOLUSDT'), sa = snap.find(r => r.sym === 'ADAUSDT'), sd = snap.find(r => r.sym === 'DOGEUSDT');
  ok(se.postGate === 'veto' && se.postGateReason === 'flow trap' && ss.postGate === 'pass' && ss.postGateReason === undefined && sa.postGate === 'unchecked' && sd.postGate === undefined, 'the published snapshot carries the verdict per row, the reason only on a veto');
  const rep = sym => { const r = S.hgContractReportRun({ sym, venue: 'binance', rows4h: UP['4h'], rows1h: UP['1h'], rows15m: [], ticker: { symbol: sym, mark: 190 } }); return r.sections.flatMap(s => s.rows).find(x => x.name === 'TREND MATRIX'); };
  ok(/post-gate VETO \(flow trap\)/.test(rep('ETHUSDT').detail), 'CONTRACT REPORT reads the veto and its reason off the desk\'s row');
  ok(/post-gate PASS/.test(rep('SOLUSDT').detail) && /post-gate UNCHECKED/.test(rep('ADAUSDT').detail) && !/post-gate/.test(rep('DOGEUSDT').detail), 'and PASS / UNCHECKED / nothing on the other three');
  /* settled, the split can ask whether the veto separates */
  const later = UP['4h'].concat([{ t: LAST4H + SEC4, o: 190, h: 260, l: 189, c: 255, v: 1000 }]);
  for (const sym of ['ETHUSDT', 'SOLUSDT', 'ADAUSDT']) S.hgFwdResolve(sym, '4h', later);
  const sp = S.hgFwdReadSplit('TRENDMX');
  /* two record sites on this desk (the class desks and the crown recorder), so each of the three settled rows settles twice */
  const pgs = sp && sp.reads['postgate:veto'];
  ok(sp && sp.settled === 6 && pgs && pgs.yes.n === 2 && pgs.no.n === 2 && pgs.unmarked === 2, 'settled, the hg-v989 read split can ask whether the post-gate veto separates on this desk: vetoed 2 / passed 2 / unmarked 2 across the two record sites (got ' + JSON.stringify(pgs) + ')');
}

console.log('\n3. fails open: readers absent, or throwing');
{
  const S0 = wire(boot(STACK), { noTwin: true, noPostGate: true });
  const n0 = await runTab(S0);
  const eth0 = rowOf(S0, 'ETHUSDT');
  ok(eth0.postGate === undefined && eth0.fundingTwin === undefined && eth0.fundingPct === null && S0.__gateSaw.ETHUSDT === null, 'with both shared readers absent the row is unmarked and the gate read the venue funding exactly as before');
  ok(!/PG /.test(n0['[data-r="out"]'].innerHTML) && /ETHUSDT/.test(n0['[data-r="cards"]'].innerHTML) && /ETHUSDT/.test(n0['[data-r="gateclean"]'].innerHTML) && !/post-gate/.test(text(n0['[data-r="gateclean"]'].innerHTML)), 'no PG chip, ETH is a CLEAN card and on the GATE-CLEAN desk, no witness named -- the board reads as before');
  const recs0 = S0.hgFwdRecords('TRENDMX').filter(r => r.mechanic === 'TM-CLEAN7' || r.mechanic === 'TM-CONVICTION');
  const clean0 = recs0.filter(r => r.mechanic === 'TM-CLEAN7');
  ok(recs0.length === 4 && clean0.length === 3 && clean0.every(r => r.ticket === true) && recs0.every(r => !(r.reads && 'postgate:veto' in r.reads)), 'three CLEAN7 tickets and one conviction row recorded with no post-gate mark, as before');
  ok(recs0.find(r => r.sym === 'SOLUSDT').fundingPct === 0.02 && recs0.find(r => r.sym === 'ETHUSDT').fundingPct === undefined, 'the venue funding the row had still rides; none is invented');
  /* a throwing post-gate is UNCHECKED, never a veto and never a pass */
  const S1 = wire(boot(STACK), { throwOn: 'SOLUSDT' });
  const n1 = await runTab(S1);
  const sol1 = rowOf(S1, 'SOLUSDT');
  ok(sol1.postGate && sol1.postGate.state === 'unchecked' && /legs exploded/.test(sol1.postGate.reasons[0]), 'a post-gate that throws reads UNCHECKED, naming the throw');
  const rs1 = S1.hgFwdRecords('TRENDMX').find(r => r.sym === 'SOLUSDT' && r.mechanic === 'TM-CLEAN7');
  ok(rs1.ticket === true && !(rs1.reads && 'postgate:veto' in rs1.reads) && /SOLUSDT/.test(n1['[data-r="cards"]'].innerHTML), 'the row still forms, still tickets, and records no post-gate mark');
}

console.log('\n4. the real shared rule accepts the call this desk makes');
{
  const S = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'cryptogates.js', 'plans.js', 'trendtable.combined.js']);
  ok(typeof S.hgPostGateSetupVeto === 'function' && typeof S.hgEnrichTickerFundingTwin === 'function', 'plans.js exports both readers this desk calls');
  const rows = UP['4h']; const c = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: c, stop: c * 0.97, t1: c * 1.06, rr: 2, clean: true, passed: 7 };
  const qv = await S.hgPostGateSetupVeto({ symbol: 'ETHUSDT', fundingPct: 0.01, mark: c }, hit, rows, 'swing', null);
  const rd = S.tmPostGateRead(qv);
  ok(qv && typeof qv.ok === 'boolean' && rd && (rd.state === 'unchecked' || rd.state === 'pass' || rd.state === 'veto'), 'with no flow legs loaded the real rule answers in the shape this desk reads (' + rd.state + (rd.reasons ? ': ' + rd.reasons.join(' | ') : '') + ')');
  const tk = await S.hgEnrichTickerFundingTwin({ symbol: 'ETHUSDT', fundingPct: null, mark: c });
  ok(tk && tk.fundingPct === null, 'with no funding layer the twin enricher hands the ticker back unchanged (nothing invented)');
}

console.log('\n5. wired where it must be, one home, nothing read back');
{
  const src = strip(read('trendtable.combined.js'));
  ok((src.match(/hgEnrichTickerFundingTwin\(/g) || []).length === 1 && (src.match(/hgPostGateSetupVeto\(/g) || []).length === 1, 'one call to each shared reader (the rules are not restated here)');
  const feed = src.slice(src.indexOf('async function tmFeedRow('), src.indexOf('function tmPostGateVeto('));
  ok(feed.indexOf('await tmEnrichFunding(row)') < feed.indexOf('trendmxGateEval(row, dir)') && feed.indexOf('trendmxGateEval(row, dir)') < feed.indexOf('hgPostGateSetupVeto('), 'the funding twin lands before the gates read it, and the post-gate runs after the gates');
  ok(/return tmFeedRow\(row, dir, r4c\)\.then\(function\(\)\{ return row; \}\);/.test(src), 'the scan loop feeds every directional row through it');
  ok(/out\.heldWhy\.clean\.postgate\+\+/.test(src) && /concat\(out\.heldPostGate\)/.test(src), 'the vetoed row is the fifth witness hold-off AND rides into the record');
  /* the twelve served parts concatenate to the combined file this guard booted (blank boundary lines aside) */
  let parts = ''; for (let i = 0; i < 12; i++) parts += read('trendtable-src-' + i + '.js');
  const norm = t => t.split('\n').filter(l => l !== '').join('\n');
  /* skipped only under the mutation pass (HG_MUT_PARTS_SKIP=1), which edits the
     combined file alone -- otherwise every mutation would be "caught" here and
     the pass would measure nothing */
  if (process.env.HG_MUT_PARTS_SKIP !== '1')
    ok(norm(parts) === norm(read('trendtable.combined.js')), 'the twelve trendtable-src-N.js parts the server serves ARE the combined file (the browser runs what the suite tested)');
  const feedBlock = src.slice(src.indexOf('function tmGetCandlesFn('), src.indexOf('function tmPostGateChip('));
  ok(!/binanceTakerRatio|binanceDepth|bybitPositioningSnapshot|binanceLongShort|binanceOIHistory|hgRelStrength|hgStaleMomentumVeto/.test(feedBlock), 'the post-gate feed layer fetches none of the legs itself and restates no rule: it calls the shared reader');
  ok(!/hgFwdRecords|hgFwdStats|hgFwdPool|hgFwdReadSplit/.test(src), 'the desk reads nothing back from the ledger: no gate is fed by the record');
  for (const f of ['hg-gates.js', 'hg-solidity.js', 'cryptogates.js', 'engine.js', 'plans.js']) ok(!/postgate:veto/.test(strip(read(f))), f + ' knows nothing of the mark');
  ok(/'trendtable\.combined\.js'/.test(read('tests/test-crypto-funding-mark.mjs').split('const want = ')[1].split(';')[0]), 'the funding census counts the combined matrix as a carrier');
}

console.log('\n6. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(v && parseInt(v.slice(4), 10) >= 1154, 'build-stamp at or past hg-v1154 (' + v + ')');
  const loaderV = (read('trendtable.js').match(/\?v=(\d+)/) || [])[1];
  ok(loaderV === String(parseInt(v.slice(4), 10)), 'the loader fetches its parts under the current version (' + loaderV + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches the build stamp');
}

console.log('\n' + passed + ' assertions passed');
