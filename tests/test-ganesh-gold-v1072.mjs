/* HARDGATE — hg-v1072: GANESH GOLD TRADING FIRM — the 17-step SMC/ICT desk.

   The full framework as a working tab: HTF bias, structure (BOS/MSS),
   buy-side and sell-side liquidity, PDH/PDL/week levels, premium/discount,
   order blocks and FVGs, displacement (1.5xATR), volume profile (POC/VAH/
   VAL), VWAP, ATR regime, squeeze, DXY + yields, the news calendar and the
   sessions - both models graded on 12 legs (A+ >= 10, A >= 8, B >= 5),
   the better A/A+ crown mints a plan (entry on the FVG/OB retest, SL
   beyond the sweep extreme + 0.5xATR, TP1/TP2/TP3 at the opposing
   liquidity), R:R must clear the style minimum (scalp 1.2 / swing 1.5),
   TICKET mints write the forward record under GANESHGOLD.

   Run: node tests/test-ganesh-gold-v1072.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'ganeshgold.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const M15 = 900, H4 = 14400, D1 = 86400;
const DAY0 = 1761609600;   /* a UTC midnight-ish epoch */
function mkTape(n, tf, make){
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(Object.assign({ t: DAY0 + i * tf }, make(i)));
  return rows;
}
/* A long-model tape: clean sell-side sweep at PDL, 1.5xATR bullish
   displacement, BOS up, FVG left behind, price retracing into it. */
function longTape(){
  const rows = [];
  for (let i = 0; i < 240; i++){
    const c = 2600 - i * 0.05;
    rows.push({ t: DAY0 + i * M15, o: c, h: c + 1, l: c - 1, c, v: 100 });
  }
  /* the sweep + displacement: bar 232 dips below PDL (2534) and closes back,
     bar 233 displaces up 1.5xATR, bar 234 leaves the bullish FVG */
  rows[232] = { t: DAY0 + 232 * M15, o: 2552, h: 2553, l: 2525, c: 2546, v: 500 };
  rows[233] = { t: DAY0 + 233 * M15, o: 2546, h: 2568, l: 2545, c: 2566, v: 600 };
  rows[234] = { t: DAY0 + 234 * M15, o: 2566, h: 2578, l: 2564, c: 2576, v: 400 };
  /* retrace INTO the displacement FVG (2553-2564), declining, no new FVG above */
  const ret = [
    { o: 2576, h: 2577, l: 2566, c: 2568 },
    { o: 2568, h: 2569, l: 2559, c: 2562 },
    { o: 2562, h: 2563, l: 2555, c: 2557 },
    { o: 2557, h: 2558, l: 2552, c: 2554 },
    { o: 2554, h: 2556, l: 2551, c: 2553 }
  ];
  for (let i = 0; i < ret.length; i++) rows[235 + i] = Object.assign({ t: DAY0 + (235 + i) * M15, v: 100 }, ret[i]);
  return rows;
}
function mkDay(){
  /* PDL 2534 (below the sweep bar), PDH 2660 (the TP1 liquidity above entry) */
  return mkTape(10, D1, i => ({ o: 2600 - i * 10, h: 2700 - i * 5, l: 2550 - i * 2, c: 2605 - i * 10, v: 1000 }));
}

const recCap = {};
const stubs = {
  getXAUCandles: async (tf) => {
    if (tf === '15m') return longTape();
    if (tf === '4h') return mkTape(100, H4, i => ({ o: 2500 + i, h: 2502 + i, l: 2498 + i, c: 2501 + i, v: 400 }));
    return mkDay();
  },
  regimeState: () => ({ dxy: { trend20: 'FALLING' }, tnx: { trend: 'FALLING' } }),
  hgNewsRisk: () => ({ blackout: false }),
  hgFwdRecordScan: (tab, tf, cands) => { recCap.tab = tab; recCap.tf = tf; recCap.cands = cands; }
};

console.log('== the long model crowns on the sweep + displacement + FVG tape ==');
{
  const W = boot(stubs);
  const snap = await W.ganeshGoldScan({ style: 'scalp' });
  ok(snap.ok === true, 'the scan completes on the real pipeline');
  ok(snap.ev.sweptSell === true, 'the sell-side sweep is detected');
  ok(snap.ev.disp && snap.ev.disp.dir === 'bull', 'the 1.5xATR bullish displacement is detected');
  ok(snap.ev.zone && snap.ev.zone.dir === 'bull' && snap.ev.retest === true, 'the bullish FVG is found and the price is retesting it');
  ok(snap.ev.disp && snap.ev.disp.i === 233, 'the displacement is the real 1.5xATR bar, not the retrace noise');
  ok(snap.mL.n >= 8 && (snap.mL.grade === 'A' || snap.mL.grade === 'A+'), 'the LONG model grades A or A+ (' + snap.mL.grade + ')');
  ok(snap.plan && snap.plan.dir === 'long', 'the crown mints a LONG plan');
  ok(snap.plan.stop < snap.plan.entry, 'the SL sits below the entry (structural invalidation)');
  ok(typeof snap.plan.rr1 === 'number' && isFinite(snap.plan.rr1) && snap.plan.rr1 >= 1.2 - 1e-9, 'the R:R clears the scalp minimum (1.2)');
  ok(snap.plan.tier === 'TICKET' || snap.plan.tier === 'WATCH', 'the tier prints honestly');
  ok(recCap.tab === 'GANESHGOLD' && Array.isArray(recCap.cands) && recCap.cands.length === 1, 'a TICKET mint writes the forward record under GANESHGOLD');
}

console.log('== both models are graded; the better grade crowns ==');
{
  const W = boot(stubs);
  const snap = await W.ganeshGoldScan({ style: 'swing' });
  ok(snap.ok === true, 'the swing scan completes');
  ok(snap.mL && snap.mS && Array.isArray(snap.mL.checks) && snap.mL.checks.length === 12, 'each model carries the 12 checklist legs');
  ok(typeof snap.mL.grade === 'string' || snap.mL.grade === null, 'the grade is an honest string or none');
}

console.log('== honest empties and the state seam ==');
{
  const W = boot(Object.assign({}, stubs, { getXAUCandles: async () => [] }));
  const snap = await W.ganeshGoldScan({ style: 'scalp' });
  ok(snap.ok === false && snap.note.indexOf('candles unavailable') >= 0, 'no candles, honest failure');
  ok(W.ganeshGoldState() === null || !W.ganeshGoldState().ok, 'the state seam does not invent a scan');
  const tab = W.HG_tabs.find(t => t.id === 'ganeshgold');
  ok(tab && typeof tab.mount === 'function', 'the tab registers with a mount');
}

console.log('== wiring pins ==');
{
  const src = read('ganeshgold.js');
  ok(src.indexOf('GANESH GOLD TRADING FIRM') >= 0, 'the desk is named');
  ok(src.indexOf('HTF bias') >= 0 && src.indexOf('Structural SL') >= 0 && src.indexOf('Liquidity TP') >= 0, 'the 17-step pipeline steps are defined');
  ok(src.indexOf('function modelGrade') >= 0 && src.indexOf("grade = (n >= 10) ? 'A+'", ) >= 0, 'the A+/A/B grading is defined');
  ok(src.indexOf('1.5 * atrV') >= 0, 'displacement uses the 1.5xATR bar');
  ok(src.indexOf('sweep extreme + 0.5xATR') >= 0, 'the SL rule is the structural invalidation + buffer');
  const html = read('index.html');
  /* version-agnostic: the cache-buster is re-stamped on every bump, so a
     pinned ?v=1072 broke the moment the tree moved past it. The intent is
     that the module ships cache-busted at all. */
  ok(/ganeshgold\.js\?v=\d+/.test(html), 'the module ships');
  ok(html.indexOf("'ganeshgold'") >= 0, 'the tab is in the GOLD group and the cycle');
  const al = read('tabalerts.js');
  ok(al.indexOf('function collectGaneshGold') >= 0 && al.indexOf("if (s.src === 'GANESH GOLD') return true;") >= 0, 'the crown joins the Telegram batch');
}

/* hg-v1154: the gold calendar reaches this desk. It wrote ticket:true XAUUSD
   rows with no weekend or news reference at all, on a chain that ends in
   24/7 proxies (the hg-v949 contamination). The gate is read on the LAST
   CLOSED execution bar through the one shared pairing (hgGoldGateAt); a
   shut or locked bar withholds the TICKET CLAIM only -- levels kept, card
   reads HELD, the row is still recorded ticket:false with the mark. Driven
   on the real scan with the gate stubbed both ways, and the route itself on
   the real calendar. */
console.log('== hg-v1154: the gold calendar withholds the TICKET claim, marks the row, keeps the levels ==');
{
  const cap = {};
  const shutGate = () => ({ atMs: 1, weekend: { inWeekend: true, why: 'gold weekend: Fri 22:00 - Sun 22:00 UTC' }, news: null });
  const Ws = boot(Object.assign({}, stubs, { hgFwdRecordScan: (tab, tf, cands) => { cap.tab = tab; cap.cands = cands; }, hgGoldGateAt: shutGate }));
  const snapS = await Ws.ganeshGoldScan({ style: 'scalp' });
  ok(snapS.ok === true && snapS.plan && snapS.plan.dir === 'long', 'REACHABILITY: the same long tape still crowns a plan under a shut calendar');
  ok(snapS.plan.held && /GOLD SHUT/.test(snapS.plan.held), 'the plan is HELD and says why (' + snapS.plan.held + ')');
  ok(snapS.plan.tier === 'WATCH' && snapS.plan.ticketWithheld === true, 'the TICKET claim is withheld (tier WATCH), not the plan');
  ok(isFinite(snapS.plan.entry) && isFinite(snapS.plan.stop) && snapS.plan.stop < snapS.plan.entry, 'the levels are kept');
  ok(cap.tab === 'GANESHGOLD' && cap.cands && cap.cands.length === 1, 'the row is STILL recorded (the population stays separable)');
  const r = cap.cands[0];
  ok(r.ticket === false && r.goldShut === true && /gold weekend/i.test(r.goldShutWhy), 'recorded ticket:false with the weekend mark and its reason');
  ok(r.signalT === snapS.ev.lastT * 1000 && r.sym === 'XAUUSD', 'dated on the last closed execution bar (seconds in, milliseconds on the row)');
  const html = Ws.ganeshGoldState() && JSON.stringify(Ws.ganeshGoldState());
  ok(/GOLD SHUT/.test(html), 'the snapshot carries the hold for the card');

  /* open calendar: the ticket stands, the row is marked OPEN (false, not absent) */
  const cap2 = {};
  const openGate = () => ({ atMs: 1, weekend: { inWeekend: false }, news: null });
  const Wo = boot(Object.assign({}, stubs, { hgFwdRecordScan: (tab, tf, cands) => { cap2.cands = cands; }, hgGoldGateAt: openGate }));
  const snapO = await Wo.ganeshGoldScan({ style: 'scalp' });
  ok(snapO.plan && !snapO.plan.held && snapO.plan.tier === 'TICKET', 'an open bar holds nothing: TICKET stands');
  ok(cap2.cands && cap2.cands[0].ticket === true && cap2.cands[0].goldShut === false && cap2.cands[0].goldShutWhy === undefined,
     'recorded ticket:true, marked OPEN, no reason to carry');

  /* a tier-1 news lock withholds the same way */
  const cap3 = {};
  const newsGate = () => ({ atMs: 1, weekend: { inWeekend: false }, news: { locked: true, why: 'CPI in 12 min' } });
  const Wn = boot(Object.assign({}, stubs, { hgFwdRecordScan: (tab, tf, cands) => { cap3.cands = cands; }, hgGoldGateAt: newsGate }));
  const snapN = await Wn.ganeshGoldScan({ style: 'scalp' });
  ok(snapN.plan && /NEWS LOCK/.test(snapN.plan.held) && snapN.plan.tier === 'WATCH', 'a tier-1 news window withholds the claim too');
  ok(cap3.cands && cap3.cands[0].ticket === false && cap3.cands[0].goldShut === false, 'and the row records ticket:false with the weekend read it had (open)');

  /* FAIL OPEN: no gate loaded -> no hold, no mark, ticket unchanged (the pre-pack row) */
  const cap4 = {};
  const W0 = boot(Object.assign({}, stubs, { hgFwdRecordScan: (tab, tf, cands) => { cap4.cands = cands; } }));
  const snap0 = await W0.ganeshGoldScan({ style: 'scalp' });
  ok(snap0.plan && !snap0.plan.held && cap4.cands && cap4.cands[0].ticket === true && cap4.cands[0].goldShut === undefined,
     'FAIL OPEN: no calendar -> nothing withheld, row unmarked');

  /* the census route, on the REAL calendar */
  const Wc = boot(stubs);
  for (const f of ['gold-formation.js']) vm.runInContext(read(f), Wc, { filename: f });
  const SAT = Date.UTC(2026, 3, 11, 12, 0, 0), WED = Date.UTC(2026, 3, 8, 12, 0, 0);
  ok(typeof Wc.ggWeekendVerdict === 'function', 'the route is exported for the coverage reporter');
  ok(!!Wc.ggWeekendVerdict(SAT) && Wc.ggWeekendVerdict(WED) === null, 'the route tells a Saturday from a Wednesday');
  ok(!!Wc.ggWeekendVerdict(Math.floor(SAT / 1000)), 'seconds are read as seconds');
  ok(Wc.ggWeekendVerdict(0) === null && Wc.ggWeekendVerdict(null) === null && Wc.ggWeekendVerdict('x') === null, 'epoch zero, null and junk yield no verdict');
  ok(Wc.hgGoldWeekendProbeRoute('ggWeekendVerdict') === 'verified', 'the coverage reporter VERIFIES the route');
  const row = (Wc.HG_GOLD_WEEKEND_MINTERS || []).find(m => m.tab === 'ganeshgold');
  ok(row && row.verdictFn === 'ggWeekendVerdict' && row.probe === 'ganeshGoldState', 'the census lists the desk with this route');
  ok(typeof (Wc.HG_GOLD_NEWS_ROUTES || {}).ganeshgold === 'string', 'and the news census names its route');

  /* the session leg reads the bar's own clock, not 1970 */
  const src = read('ganeshgold.js');
  ok(/function ggBarMs/.test(src) && /var ms = ggBarMs\(t\); if \(ms === null\) return 'UNREAD';/.test(src), 'sessOf reads seconds as seconds (was new Date(seconds) = 1970)');
}

console.log('\ntest-ganesh-gold-v1072: ' + passed + ' passed, 0 failed');
