/* HARDGATE — hg-v1159: TREND MATRIX records the four witness hold-offs and the
   composite's five legs as read marks; the ticket claim is the board's own tier.

   Four witnesses have held rows off the class desks since hg-v1012 (taker flow),
   v1019 (1D RSI momentum), v1020 (OBV volume) and v1034 (fundamental +
   sentiment) — and the record map only ever saw the rows they let through,
   marked `true`. The ledger could compare WITH against SILENT and never
   against AGAINST, so what the hold-offs remove was unmeasurable by
   construction: the hg-v966 trap, four times. The composite rode every record
   as one number (tmScore, hg-v995) and never as its five legs. And the crown
   recorder (hg-v1039) claimed ticket:true on every 7/7 row, including rows the
   board itself caps at NEAR under a witness or the chop read.

   One reads helper (tmRecordReads) serves both record sites: every witness as
   a three-state mark (true WITH, false AGAINST / REFUSE / CHOP, absent when it
   abstained or could not read), the hg-v1154 post-gate verdict, the five legs
   (tm:d1Trend · tm:cross · tm:cascade · tm:cloud · tm:adx), the ADX >= 25 bar
   and the fresh cross. Held-off rows are kept with their plan and recorded
   with ticket:false (as hg-v1154 did for the post-gate veto). The ticket claim
   is trendmxRowTier === 'clean' at both sites (tmTicketClaim). Marks only:
   no tier, plan or desk moves.

   Sections:
     1) the legs: sign follows the direction, zero is absent, the ADX bar, the cross
     2) the witnesses: three states each, through the one helper
     3) the class partition, driven directly: held rows keep their plan and are
        recorded with ticket:false; counts unchanged; the first witness names
        the hold-off; a held row with no plan is counted and not recorded
     4) end to end through the real tab: both record sites, the board unchanged,
        the split can ask
     5) fails open: no witness readable, records as before
     6) one home: both sites call the helper, the parts are the combined file,
        no gate names a mark, the set fits the ledger
     7) build stamps

   Run: node tests/test-trendmx-witness-marks.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond){ passed++; console.log('  ok —', label); } else { failed++; console.error('  FAIL —', label); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');

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
function tape(n, step, slope, endT){
  const rows = []; let c = 100; const t0 = endT - (n - 1) * step;
  for (let i = 0; i < n; i++){ c += slope; rows.push({ t: t0 + i * step, o: c, h: c + 0.3, l: c - 0.3, c, v: 1000 }); }
  return rows;
}
/* a zigzag tape: every bar reverses the last, so the Kaufman ER reads ~0 and the Choppiness index saturates — the CHOP read */
function zigzag(n, step, endT){
  const rows = []; const t0 = endT - (n - 1) * step;
  for (let i = 0; i < n; i++){ const c = 100 + ((i % 2) ? 1 : -1); rows.push({ t: t0 + i * step, o: 100, h: 101.3, l: 98.7, c, v: 1000 }); }
  return rows;
}
const LAST4H = Math.floor(now / SEC4) * SEC4 - SEC4;
const UP = { '4h': tape(300, SEC4, 0.3, LAST4H), '1d': tape(300, 86400, 1, Math.floor(now / 86400) * 86400 - 86400), '1h': tape(300, 3600, 0.1, Math.floor(now / 3600) * 3600 - 3600) };
const STACK = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'setup-ui.js', 'trendtable.combined.js'];
const ITEMS = [
  { sym: 'ETHUSDT', base: 'ETH', exchange: 'binance', fundingPct: null, turnoverUsd: 1e8, mark: 190 },
  { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', fundingPct: 0.02, turnoverUsd: 1e8, mark: 190 },
  { sym: 'ADAUSDT', base: 'ADA', exchange: 'coindcx', fundingPct: null, turnoverUsd: 1e8, mark: 190 },
  { sym: 'DOGEUSDT', base: 'DOGE', exchange: 'binance', fundingPct: 0.01, turnoverUsd: 1e8, mark: 190 }   /* directional row with NO gate hit */
];
/* the fundamental stack is the one witness a harness can steer per symbol; the stub reads a map the test edits */
function wire(S, o){
  o = o || {};
  S.hgDeskLoadUniverse = async () => ({ items: ITEMS, rawLen: ITEMS.length });
  S.hgDeskFetchKlines = (it, tf) => Promise.resolve(UP[tf]);
  S.binanceKlines = async (sym, tf) => UP[tf];
  S.binancePerpUniverse = async () => []; S.binanceTickers24h = async () => ({});
  S.toTrade = () => {};
  S.swingTryClean = (rows, ticker) => {
    if (ticker.symbol === 'DOGEUSDT') return null;
    const c = rows[rows.length - 1].c;
    return { dir: 'long', entry: c, stop: c * 0.97, t1: c * 1.06, t2: c * 1.09, rr: 2, clean: true, passed: 7, mark: c };
  };
  S.__fund = o.fund || {};
  if (!o.noFund) S.hgFundamentalGate = (sym, dir) => S.__fund[sym] || null;
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
  try { S.__rows = (await S.trendmxScan({})).rows; } catch (e) { S.__rows = []; }
  return nodes;
}
const rowOf = (S, sym) => (S.__rows || []).find(r => r.sym === sym);
const FUND_AGAINST = { demote: true, refuse: false, chips: ['HEADWIND'], regime: { checked: true } };
const FUND_REFUSE = { demote: false, refuse: true, chips: [], regime: { checked: true } };
const FUND_WITH = { demote: false, refuse: false, chips: ['TAILWIND x'], regime: { checked: true } };
const FUND_FLAT = { demote: false, refuse: false, chips: [], regime: { checked: true } };
const LEGS = ['tm:d1Trend', 'tm:cross', 'tm:cascade', 'tm:cloud', 'tm:adx'];
const WIT = ['takerFlowWith', 'momWith', 'volWith', 'fundWith', 'trendQualityWith'];

console.log('1. the legs: sign follows the direction, zero is absent, the ADX bar, the cross');
{
  const S = boot(['indicators.js', 'indicators2.js', 'trendtable.combined.js']);
  ok(typeof S.tmLegReads === 'function' && typeof S.tmRecordReads === 'function' && typeof S.tmTicketClaim === 'function', 'the three helpers are exported');
  const full = { comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 1, adxPt: 1 }, adx: 30, freshCross: 'GOLDEN' };
  const L = S.tmLegReads(full, 'long'), Sh = S.tmLegReads(full, 'short');
  ok(LEGS.every(k => L[k] === true) && L['tm:adxStrong'] === true && L['tm:freshCross'] === true, 'a +5 composite with ADX 30 and a GOLDEN cross marks every leg WITH a long, the bar strong, the cross with');
  ok(LEGS.every(k => Sh[k] === false) && Sh['tm:adxStrong'] === true && Sh['tm:freshCross'] === false, 'the same row against a short: every leg AGAINST, the ADX bar is a state (still true), the GOLDEN cross is against a short');
  const mixed = S.tmLegReads({ comps: { d1Trend: -1, d1Cross: 0, h4Cascade: 1, cloud: 0, adxPt: 0 }, adx: 18, freshCross: null }, 'long');
  ok(mixed['tm:d1Trend'] === false && mixed['tm:cascade'] === true && !('tm:cross' in mixed) && !('tm:cloud' in mixed) && !('tm:adx' in mixed), 'a zero leg marks NOTHING (absent, never false); the signed legs follow their sign');
  ok(mixed['tm:adxStrong'] === false && !('tm:freshCross' in mixed), 'ADX 18 reads the strength bar false; no fresh cross marks nothing');
  ok(S.tmLegReads({ comps: { d1Trend: 1 }, adx: 25 }, 'long')['tm:adxStrong'] === true && S.tmLegReads({ comps: {}, adx: 24.99 }, 'long')['tm:adxStrong'] === false, 'the ADX bar is the composite\'s own 25');
  ok(S.tmLegReads({ comps: { d1Trend: 1 }, adx: NaN }, 'long')['tm:adxStrong'] === undefined && S.tmLegReads({ comps: { d1Trend: '1' } }, 'long')['tm:d1Trend'] === undefined, 'a NaN ADX and a string leg are not reads (never coerced)');
  ok(S.tmLegReads({ freshCross: 'DEATH', comps: {} }, 'short')['tm:freshCross'] === true && S.tmLegReads({ freshCross: 'DEATH', comps: {} }, 'long')['tm:freshCross'] === false, 'a DEATH cross is WITH a short and AGAINST a long');
  ok(Object.keys(S.tmLegReads(full, 'LONG')).length === 0 && Object.keys(S.tmLegReads(null, 'long')).length === 0 && Object.keys(S.tmLegReads({}, 'long')).length === 0, 'a direction in the wrong case, no row or a row with no comps marks nothing');
}

console.log('\n2. the witnesses: three states each, through the one helper');
{
  const S = boot(['indicators.js', 'indicators2.js', 'trendtable.combined.js']);
  const base = () => ({ sym: 'XUSDT', score: 5, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 1, adxPt: 1 }, adx: 40, rows4h: UP['4h'] });
  const R = (over, dir) => S.tmRecordReads(Object.assign(base(), over || {}), dir || 'long') || {};
  /* flow */
  ok(R({ flow: { verdict: 'with' } }).takerFlowWith === true && R({ flow: { verdict: 'against' } }).takerFlowWith === false, 'taker flow WITH marks true, AGAINST marks false');
  ok(!('takerFlowWith' in R({ flow: { verdict: 'unreadable' } })) && !('takerFlowWith' in R({})), 'an unreadable or absent flow marks nothing');
  /* momentum: the desk's own bars (bull floor 40 / mid 50 / bear ceiling 60) */
  ok(R({ rsi: 65 }).momWith === true && R({ rsi: 35 }).momWith === false && !('momWith' in R({ rsi: 45 })) && !('momWith' in R({ rsi: NaN })), 'RSI 65 is WITH a long, 35 AGAINST (turned), 45 is the abstain zone and marks nothing, NaN marks nothing');
  ok(R({ rsi: 35 }, 'short').momWith === true && R({ rsi: 65 }, 'short').momWith === false, 'the same RSI reads the other way for a short');
  /* volume */
  ok(R({ volDiv: null, volConf: 'up' }).volWith === true && R({ volDiv: 'bear', volConf: null }).volWith === false && !('volWith' in R({ volDiv: null, volConf: null })) && !('volWith' in R({ volDiv: null, volConf: 'down' })), 'OBV confirmation marks true, bearish divergence marks false under a long, a flat read or an unreadable tape marks nothing');
  /* fundamental, through the real trendmxFundState on a stubbed stack */
  let gate = null; S.hgFundamentalGate = () => gate;
  gate = FUND_WITH; ok(R({}).fundWith === true, 'a TAILWIND chip marks fundWith true');
  gate = FUND_AGAINST; ok(R({}).fundWith === false, 'a 2+ net headwind (demote) marks false');
  gate = FUND_REFUSE; ok(R({}).fundWith === false, 'a red-folder REFUSE marks false too — a refusal is against, not silence');
  gate = FUND_FLAT; ok(!('fundWith' in R({})), 'a checked board with no decisive vote marks nothing');
  gate = null; ok(!('fundWith' in R({})), 'a dark board marks nothing');
  /* trend quality, through the real trendmxChopState on the row's own 4h tape */
  ok(R({}).trendQualityWith === true, 'a clean trending 4h tape reads TREND — trendQualityWith true');
  const zz = R({ rows4h: zigzag(120, SEC4, LAST4H) });
  ok(zz.trendQualityWith === false, 'a zigzag 4h tape reads CHOP — trendQualityWith false (' + JSON.stringify(S.trendmxChopState(Object.assign(base(), { rows4h: zigzag(120, SEC4, LAST4H) }))) + ')');
  ok(!('trendQualityWith' in R({ rows4h: UP['4h'].slice(-10) })), 'a tape under 25 bars cannot be read: absent');
  /* the post-gate rides unchanged */
  ok(R({ postGate: { state: 'veto' } })['postgate:veto'] === true && R({ postGate: { state: 'pass' } })['postgate:veto'] === false && !('postgate:veto' in R({ postGate: { state: 'unchecked' } })), 'the hg-v1154 post-gate mark rides the same bag unchanged');
  /* the legs ride beside */
  const all = R({ flow: { verdict: 'with' }, rsi: 65, volConf: 'up', freshCross: 'GOLDEN' });
  ok(LEGS.every(k => all[k] === true) && all['tm:adxStrong'] === true && all['tm:freshCross'] === true, 'the five legs, the bar and the cross ride the same bag');
  ok(S.tmRecordReads(null, 'long') === undefined, 'no row: undefined, never an empty bag');
  const bareRow = S.tmRecordReads({ sym: 'X', score: 0, comps: { d1Trend: 0, d1Cross: 0, h4Cascade: 0, cloud: 0, adxPt: 0 }, adx: NaN }, 'long');
  ok(bareRow === undefined, 'a row with nothing readable marks nothing at all (undefined, the ledger records no bag)');
  /* the ticket claim is the board's tier */
  const plan = S.trendmxPlan(Object.assign(base(), { gate: { clean7: true, hit: {}, gatesPassed: 7 }, dir: 'long' }));
  ok(plan && S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {}, gatesPassed: 7 } }), plan) === true, 'REACHABILITY: a 7/7 row with a plan and no witness against claims a ticket');
  ok(S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {} }, flow: { verdict: 'against' } }), plan) === false, 'flow AGAINST: no ticket (the board caps it at NEAR)');
  ok(S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {} }, rsi: 35 }), plan) === false && S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {} }, volDiv: 'bear' }), plan) === false, 'momentum or volume AGAINST: no ticket');
  ok(S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {} }, rows4h: zigzag(120, SEC4, LAST4H) }), plan) === false, 'a CHOP tape: no ticket — the hg-v1057 cap the crown recorder used to ignore');
  ok(S.tmTicketClaim(Object.assign(base(), { gate: { clean7: true, hit: {} }, postGate: { state: 'veto' } }), plan) === false && S.tmTicketClaim(Object.assign(base(), { gate: { clean7: false, nearClean: true } }), plan) === false, 'a post-gate veto or a 6/7 row: no ticket, as before');
}

console.log('\n3. the class partition, driven directly: held rows keep their plan and are recorded');
{
  const S = wire(boot(STACK), { fund: { SOLUSDT: FUND_WITH } });
  await runTab(S);
  const sol = rowOf(S, 'SOLUSDT'), eth = rowOf(S, 'ETHUSDT');
  ok(sol && eth && sol.gate && sol.gate.clean7, 'REACHABILITY: real scan rows in hand');
  /* a row clone that forgets the memoised fund gate so the stub decides again */
  const clone = (r, over) => { const c = Object.assign({}, r, over || {}); delete c._fundGate; delete c._fundGateShort; return c; };
  const recorded = []; S.hgFwdRecordScan = (tab, tf, cands) => { recorded.push(...cands); return cands.length; };
  const rows = [
    clone(sol),                                                                   /* clean, fund WITH */
    clone(eth, { sym: 'FLOWUSDT', flow: { verdict: 'against' } }),                /* flow against */
    clone(eth, { sym: 'MOMUSDT', rsi: 35 }),                                      /* momentum against */
    clone(eth, { sym: 'VOLUSDT', volDiv: 'bear', volConf: null }),                /* volume against */
    clone(eth, { sym: 'FUNDUSDT' }),                                              /* fund against (stub below) */
    clone(eth, { sym: 'BOTHUSDT', flow: { verdict: 'against' }, rsi: 35 }),       /* flow AND momentum against: the FIRST witness names it, once */
    clone(eth, { sym: 'FLOWFUNDUSDT', flow: { verdict: 'against' } }),            /* flow against AND fund against: counted once, under flow */
    clone(eth, { sym: 'NOPLANUSDT', flow: { verdict: 'against' }, rows4h: [] })   /* held, and no plan prices: counted, not recorded */
  ];
  S.__fund.FUNDUSDT = FUND_AGAINST; S.__fund.FLOWFUNDUSDT = FUND_AGAINST;
  const out = S.trendmxLimitClasses(rows);
  ok(out.clean.length === 1 && out.clean[0].row.sym === 'SOLUSDT' && out.conv.length === 0, 'one clean row reaches the desk; every held row stays off it');
  ok(out.heldClean === 7 && JSON.stringify(out.heldWhy.clean) === JSON.stringify({ flow: 4, mom: 1, vol: 1, fund: 1, postgate: 0 }), 'the hold-off COUNTS are the hg-v1019 counts: each held row counted ONCE under the first witness that fired (' + JSON.stringify(out.heldWhy.clean) + ')');
  ok(Array.isArray(out.heldWitness) && out.heldWitness.length === 6 && out.heldWitness.every(h => h.plan && isFinite(h.plan.entry) && isFinite(h.plan.stop) && isFinite(h.plan.t1)), 'six held rows are KEPT with a priced plan (the seventh had no tape to price on)');
  ok(!out.heldWitness.some(h => h.row.sym === 'NOPLANUSDT'), 'the held row with no plan is counted and NOT kept — a record needs levels');
  const by = {}; out.heldWitness.forEach(h => { by[h.row.sym] = h.heldBy; });
  ok(by.FLOWUSDT === 'flow' && by.MOMUSDT === 'mom' && by.VOLUSDT === 'vol' && by.FUNDUSDT === 'fund' && by.BOTHUSDT === 'flow' && by.FLOWFUNDUSDT === 'flow', 'each kept row names the witness that held it, the first one when two fire (' + JSON.stringify(by) + ')');
  /* the record */
  const rec = {}; recorded.forEach(r => { rec[r.sym] = r; });
  ok(recorded.length === 7 && rec.SOLUSDT && rec.FLOWUSDT && rec.MOMUSDT && rec.VOLUSDT && rec.FUNDUSDT && rec.BOTHUSDT && rec.FLOWFUNDUSDT && !rec.NOPLANUSDT, 'seven records: the clean row and the six held rows with a plan');
  ok(rec.SOLUSDT.ticket === true && rec.SOLUSDT.reads.fundWith === true && rec.SOLUSDT.reads.momWith === true && rec.SOLUSDT.reads.volWith === true, 'the clean row is a ticket with its witnesses marked WITH');
  ok(['FLOWUSDT', 'MOMUSDT', 'VOLUSDT', 'FUNDUSDT', 'BOTHUSDT', 'FLOWFUNDUSDT'].every(s => rec[s].ticket === false), 'every held row is recorded with ticket:false');
  ok(rec.FLOWUSDT.reads.takerFlowWith === false && rec.MOMUSDT.reads.momWith === false && rec.VOLUSDT.reads.volWith === false && rec.FUNDUSDT.reads.fundWith === false, 'and the witness that held it is marked FALSE — the complement the ledger never had');
  ok(rec.BOTHUSDT.reads.takerFlowWith === false && rec.BOTHUSDT.reads.momWith === false && rec.FLOWFUNDUSDT.reads.takerFlowWith === false && rec.FLOWFUNDUSDT.reads.fundWith === false, 'a row two witnesses stood against carries BOTH marks false, whichever one held it');
  ok(rec.FLOWUSDT.reads.momWith === true && rec.FLOWUSDT.reads.volWith === true && !('fundWith' in rec.FLOWUSDT.reads), 'the other witnesses on a held row are marked on their own state (WITH here; the dark fund board marks nothing)');
  ok(recorded.every(r => LEGS.every(k => r.reads[k] === true) && r.reads['tm:adxStrong'] === true && r.reads['trendQualityWith'] === true), 'every record carries the five legs, the ADX bar and the trend-quality read of its own tape');
  ok(recorded.every(r => r.mechanic === 'TM-CLEAN7' && r.barT === LAST4H && isFinite(r.entry) && isFinite(r.stop) && isFinite(r.t1)), 'held records carry the same mechanic, bar and levels as the clean ones');
  ok(Object.keys(rec.BOTHUSDT.reads).length <= 32 && Object.keys(rec.BOTHUSDT.reads).every(k => /^[A-Za-z0-9][A-Za-z0-9:_. -]{0,47}$/.test(k)), 'the whole bag fits the ledger normaliser (' + Object.keys(rec.BOTHUSDT.reads).length + ' keys)');
  /* the fund stack is asked ONCE per row (memoised on the row) — for the mark on a held row, never for a second hold-off */
  let fundCalls = 0; const fg = S.hgFundamentalGate; S.hgFundamentalGate = (sym, dir) => { fundCalls++; return fg(sym, dir); };
  const o2 = S.trendmxLimitClasses([clone(eth, { sym: 'FLOW2USDT', flow: { verdict: 'against' } })]);
  ok(fundCalls === 1 && o2.heldWhy.clean.fund === 0 && o2.heldWhy.clean.flow === 1, 'a flow-held row asks the fundamental stack once, for its mark, and is never counted under fund');
}

console.log('\n4. end to end through the real tab: both record sites, the board unchanged, the split can ask');
{
  const S = wire(boot(STACK), { fund: { ADAUSDT: FUND_AGAINST, SOLUSDT: FUND_WITH } });
  const nodes = await runTab(S);
  ok(/scanned/.test(nodes['[data-r="status"]'].textContent), 'the scan completed');
  const ada = rowOf(S, 'ADAUSDT'), sol = rowOf(S, 'SOLUSDT'), eth = rowOf(S, 'ETHUSDT'), doge = rowOf(S, 'DOGEUSDT');
  ok(ada && sol && eth && doge && [ada, sol, eth].every(r => r.gate && r.gate.clean7), 'REACHABILITY: three 7/7 rows and one conviction-only row');
  /* the board: unchanged by the marks */
  const cards = nodes['[data-r="cards"]'].innerHTML, near = nodes['[data-r="near"]'].innerHTML;
  ok(/SOLUSDT/.test(cards) && /ETHUSDT/.test(cards) && !/ADAUSDT/.test(cards) && /ADAUSDT/.test(near), 'the fund-held ADA sits on the watch tier, SOL and ETH are clean cards — the board the hg-v1034 witness always painted');
  const lc = S.trendmxLimitClasses(S.__rows);
  ok(lc.clean.length === 2 && lc.heldClean === 1 && lc.heldWhy.clean.fund === 1 && lc.heldWitness.length === 1 && lc.heldWitness[0].row.sym === 'ADAUSDT', 'the class partition: two clean, one held under fund, and that one kept for the record');
  /* the records, both sites */
  const all = S.hgFwdRecords('TRENDMX');
  const cls = all.filter(r => r.mechanic === 'TM-CLEAN7' || r.mechanic === 'TM-CONVICTION');
  const crown = all.filter(r => r.mechanic === 'CLEAN' || r.mechanic === 'PERFECT');
  const ca = cls.find(r => r.sym === 'ADAUSDT'), cs = cls.find(r => r.sym === 'SOLUSDT'), ce = cls.find(r => r.sym === 'ETHUSDT'), cd = cls.find(r => r.sym === 'DOGEUSDT');
  ok(cls.length === 4 && ca && cs && ce && cd, 'four class-desk records: the two clean rows, the HELD row included, and the conviction row (' + cls.map(r => r.sym).join(',') + ')');
  ok(ca.ticket === false && ca.reads && ca.reads.fundWith === false && ca.mechanic === 'TM-CLEAN7', 'the held ADA is recorded with ticket:false and fundWith FALSE under its own mechanic — the witness is measurable at last');
  ok(cs.ticket === true && cs.reads.fundWith === true && ce.ticket === true && !('fundWith' in ce.reads), 'SOL records a ticket with fundWith TRUE; ETH (dark board) a ticket with no fund mark');
  ok(cd.ticket === false && cd.mechanic === 'TM-CONVICTION', 'the conviction row is no ticket, as before');
  ok(cls.every(r => LEGS.every(k => r.reads[k] === true) && r.reads['tm:adxStrong'] === true && r.reads.momWith === true && r.reads.volWith === true && r.reads.trendQualityWith === true), 'every record carries the five legs WITH (an UP tape under a long), the ADX bar, and the momentum / volume / trend-quality reads of its own tape');
  const ka = crown.find(r => r.sym === 'ADAUSDT'), ks = crown.find(r => r.sym === 'SOLUSDT');
  ok(ka && ka.ticket === false && ka.reads.fundWith === false, 'THE CROWN RECORDER: the 7/7 ADA the board caps at NEAR is recorded there with ticket:false — it claimed ticket:true on it before this pack');
  ok(ks && ks.ticket === true && ks.reads.fundWith === true && LEGS.every(k => ks.reads[k] === true), 'and the crown record of SOL carries the ticket, the fund mark and the legs');
  ok(S.__warns.length === 0, 'nothing thrown into the ledger warn log');
  /* settled, the split can ask whether the fundamental witness separates */
  const later = UP['4h'].concat([{ t: LAST4H + SEC4, o: 190, h: 260, l: 189, c: 255, v: 1000 }]);
  for (const sym of ['ETHUSDT', 'SOLUSDT', 'ADAUSDT']) S.hgFwdResolve(sym, '4h', later);
  const sp = S.hgFwdReadSplit('TRENDMX');
  const fw = sp && sp.reads.fundWith;
  ok(fw && fw.yes.n === 2 && fw.no.n === 2 && fw.unmarked === 2, 'settled, the read split asks WITH vs AGAINST on fundWith: 2 / 2 across the two record sites, the dark-board ETH records NEITHER (' + JSON.stringify(fw && { yes: fw.yes.n, no: fw.no.n, unmarked: fw.unmarked }) + ')');
  ok(sp.reads['tm:d1Trend'] && sp.reads['tm:d1Trend'].yes.n === 6 && sp.reads.momWith && sp.reads.momWith.yes.n === 6, 'and a cell per leg and per witness, counting every settled record');
}

console.log('\n5. fails open: no witness readable, records as before');
{
  const S = wire(boot(STACK), { noFund: true });
  const nodes = await runTab(S);
  const all = S.hgFwdRecords('TRENDMX');
  const cls = all.filter(r => r.mechanic === 'TM-CLEAN7' || r.mechanic === 'TM-CONVICTION');
  ok(cls.length === 4 && cls.filter(r => r.ticket === true).length === 3, 'with no fundamental stack three 7/7 tickets and one conviction row record — the hg-v1154 counts');
  ok(cls.every(r => !('fundWith' in r.reads) && !('takerFlowWith' in r.reads)), 'the dark fund board and the unread flow mark NOTHING — absent, never false');
  ok(cls.filter(r => r.mechanic === 'TM-CLEAN7').every(r => r.reads.momWith === true && r.reads.volWith === true && LEGS.every(k => r.reads[k] === true)), 'the reads the tape itself carries still mark');
  const lc = S.trendmxLimitClasses(S.__rows);
  ok(lc.heldClean === 0 && lc.heldWitness.length === 0 && lc.clean.length === 3, 'nothing held, nothing kept');
  ok(/ADAUSDT/.test(nodes['[data-r="cards"]'].innerHTML), 'ADA is a clean card when nothing stands against it');
}

console.log('\n6. one home: both sites call the helper, the parts are the combined file, no gate names a mark');
{
  const src = strip(read('trendtable.combined.js'));
  ok((src.match(/reads: tmRecordReads\(/g) || []).length === 2 && (src.match(/ticket: tmTicketClaim\(/g) || []).length === 2, 'both record sites read the ONE reads helper and the ONE ticket rule');
  ok(!/reads: tmPostGateReads\(/.test(src) && !/ticket: !tmPostGateVeto\(/.test(src), 'the old per-site reads and the old ticket rule are gone');
  ok((src.match(/rd\.takerFlowWith = true/g) || []).length === 1 && (src.match(/rd\.fundWith = false/g) || []).length === 1, 'each witness mark is written in one place');
  ok(/\.concat\(out\.heldWitness\)/.test(src) && /out\.heldWitness\.push\(/.test(src), 'the held rows ride into the record and nowhere else');
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && !/^trendtable-src-\d+\.js$/.test(f));
  // build-stamp.js carries the pack prose, which names the helpers by name; it is text, not a reader.
  const namers = files.filter(f => f !== 'trendtable.combined.js' && f !== 'build-stamp.js' && /trendQualityWith|'tm:d1Trend'|'tm:adxStrong'|tmRecordReads|tmTicketClaim/.test(strip(read(f))));
  ok(namers.length === 0, 'no other file names the new marks or the helpers (' + namers.join(', ') + ')');
  for (const g of ['hg-gates.js', 'cryptogates.js', 'plans.js', 'hg-solidity.js', 'conviction-lock.js', 'hg-forward.js', 'setup-stack.js'])
    ok(!/trendQualityWith|tm:d1Trend|tm:cascade|momWith|volWith|fundWith|takerFlowWith/.test(strip(read(g))), g + ' names none of the witness marks');
  /* the matrix reads none of them back: the only readers of the bag are the two record literals */
  ok(!/reads\['tm:|reads\.momWith|reads\.fundWith|reads\.volWith|reads\.takerFlowWith|reads\.trendQualityWith/.test(src), 'trendtable reads no mark back — the marks gate nothing');
  /* the twelve served parts ARE the combined file */
  let parts = ''; for (let i = 0; i < 12; i++) parts += read('trendtable-src-' + i + '.js');
  const norm = s => s.split('\n').filter(l => l.trim() !== '').join('\n');
  if (process.env.HG_MUT_PARTS_SKIP !== '1') ok(norm(parts) === norm(read('trendtable.combined.js')), 'the twelve trendtable-src-N.js parts the server serves ARE the combined file');
  else console.log('  (skipped under the mutation pass: the parts are regenerated after it)');
  ok(/trendmxRowTier\(r, plan\) === 'clean'/.test(src), 'the ticket claim is the board\'s own tier rule, called');
}

console.log('\n7. build stamps');
ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp');

console.log('\n' + (failed ? 'FAILED ' + failed + ' / ' : 'PASSED ') + (passed + failed) + ' assertions');
process.exit(failed ? 1 : 0);
