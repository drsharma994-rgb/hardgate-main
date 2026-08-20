/* HARDGATE — OMNIPRESENT: the anticipation desk, held to its own claims.

   The tab promises to hold the reversal LEVEL before the market arrives
   (ARMED), name the exact trigger and when it can fire (1h bar closes),
   enter at the live price once the sweep rejects (TRIGGERED), keep the
   stop squeezed just beyond the zone, and stretch the target to the
   opposite zone. Every claim is a gate, every gate is tested here, and
   the scan is driven END-TO-END through the real runScan against a
   stubbed universe — the same discipline as test-scan-stability.

   What this desk must NEVER do: manufacture a ticket. A level with no
   exhaustion evidence is a level, not a setup (hard veto); a fade against
   a running ADX trend with thin evidence is vetoed; a stop the market
   already crossed is dead on arrival.

   Run: node tests/test-omnipresent.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

/* An explicit double-top: range, rally to ~110.4, pull back, second high
   ~110.2, then a pullback to ~107 that ends the tape AWAY from the zone.
   Two swing highs + round 110 + Donchian upper cluster into one overhead
   zone the last bars never touch — the ARMED state, by construction. */
function topTape(n){
  const out = []; let s = 5;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    let p;
    const tail = n - i;              /* bars remaining */
    if (tail > 70) p = 95 + Math.sin(i / 9) * 3 + (rnd() - 0.5) * 0.6;
    else if (tail > 50) p = 96 + (70 - tail) * 0.72;            /* rally leg 1 -> ~110.4 */
    else if (tail > 40) p = 110.4 - (50 - tail) * 0.42;         /* pull back -> ~106.2 */
    else if (tail > 30) p = 106.2 + (40 - tail) * 0.40;         /* rally leg 2 -> ~110.2 */
    else p = 110.2 - (30 - tail) * 0.06 - Math.sin(i / 5) * 0.2; /* drift away -> ~108.4, inside the 3xATR arm window */
    out.push({ t: 1700000000 + i * 3600, o: p - 0.2, h: p + 0.35, l: p - 0.55, c: p, v: 700 + rnd() * 200 });
  }
  return out;
}

console.log('== pure pieces hold their contracts ==');
{
  ok(W.opRoundStep(4512) === 100, 'round step scales: gold-sized prices cluster on hundreds');
  ok(W.opRoundStep(85) === 1, 'mid prices on whole numbers');
  ok(Math.abs(W.opRoundStep(0.42) - 0.01) < 1e-12, 'sub-dollar contracts on cents');

  const piv = W.opPivots(topTape(300), 3);
  ok(piv.hi.length > 0 && piv.lo.length > 0, 'fractal pivots found on a wavy tape');

  const atr = 1.0, live = 100;
  /* opZones returns every zone, nearest first — the assess loop walks them */
  const zs = W.opZones([{px:104.8,src:'swing high'},{px:105.1,src:'round number'},{px:105.05,src:'value-area high'},
                        {px:112,src:'prior-day high'}], atr, live, 'above');
  ok(Array.isArray(zs) && zs.length === 1, 'a lone far level is not a zone; the cluster is (got ' + (zs && zs.length) + ')');
  const z = zs[0];
  ok(z && z.confluence === 3, 'three sources within a third of an ATR cluster into one zone');
  ok(z.lo <= 104.8 && z.hi >= 105.1, 'the zone spans its members');
  ok(z.distAtr < 6 && Math.abs(z.distAtr - 4.8) < 0.2, 'distance measured from the zone edge in ATRs');

  const closes = W.opNextCloses(Date.UTC(2026, 7, 20, 10, 15), 3);
  ok(closes.length === 3 && /^11:00 UTC \(16:30 IST\)$/.test(closes[0]),
     'the exact trigger times are bar closes, in UTC and IST: ' + closes[0]);
}

console.log('\n== ARMED before the market arrives, TRIGGERED after the rejection ==');
{
  const rows = topTape(360);
  const live = rows[rows.length - 1].c;
  const cands = W.opAssess(rows, live);
  const short = cands.filter(c => c.dir === 'short')[0];
  ok(!!short, 'a short candidate forms under the overhead zone');
  ok(short.status === 'ARMED', 'and it is ARMED — the zone has not been swept');
  ok(short.entry >= short.zone.lo - 1e-9 && short.entry <= short.zone.hi + 1e-9,
     'armed entry rests at the zone edge (' + short.entry.toFixed(2) + ')');
  ok(short.stop > short.zone.hi, 'the squeezed stop sits just beyond the zone extreme');
  ok((short.stop - short.zone.hi) / short.atr < 0.5, 'and it IS squeezed — under half an ATR of pad');
  ok(short.t1 < short.entry && short.t2 < short.t1, 'targets stack away from the entry');
  ok(short.rr2 >= 5, 'TP2 is BIG: at least 5R, stretching to the opposite zone up to 10R (' + short.rr2.toFixed(1) + 'R)');
  ok(short.rr2 <= 10, 'and capped at 10R — wide is a policy, unbounded is a fantasy');
  ok(/CLOSES back below/.test(short.trigger), 'the trigger rule is written on the card: ' + short.trigger.slice(0, 60));

  /* Sweep and reject: a bar tags the zone and the next closes back under it. */
  const t0 = rows[rows.length - 1].t;
  const swept = rows.concat([
    { t: t0 + 3600, o: live, h: short.zone.hi + 0.2, l: live - 0.3, c: short.zone.lo + 0.05, v: 2400 },
    { t: t0 + 7200, o: short.zone.lo, h: short.zone.lo + 0.2, l: short.zone.lo - 1.1, c: short.zone.lo - 0.9, v: 1900 }
  ]);
  const liveNow = short.zone.lo - 1.0;
  const after = W.opAssess(swept, liveNow).filter(c => c.dir === 'short')[0];
  ok(!!after && after.status === 'TRIGGERED', 'after the sweep-and-reject the candidate reads TRIGGERED');
  ok(Math.abs(after.entry - liveNow) < 1e-9, 'and the entry is the LIVE price, not a level behind the market');
}

console.log('\n== the ledger: no evidence, no setup; dead stops veto; thin zones read AGAINST ==');
{
  const rows = topTape(360);
  const live = rows[rows.length - 1].c;
  const c = W.opAssess(rows, live).filter(x => x.dir === 'short')[0];

  const noEv = Object.assign({}, c, { evidence: [] });
  const g1 = W.opGates(rows, noEv, live, 'TESTUSD');
  const ex = g1.filter(g => g.key === 'exhaustion')[0];
  ok(ex && ex.pass === false && ex.info !== true, 'zero exhaustion evidence is a HARD veto — a level is not a setup');

  const dead = Object.assign({}, c);
  const g2 = W.opGates(rows, dead, dead.stop + 1, 'TESTUSD');
  const lf = g2.filter(g => g.key === 'level-fresh')[0];
  ok(lf && lf.pass === false && /DEAD ON ARRIVAL/.test(lf.why), 'a stop the market has crossed is DOA');

  const thin = Object.assign({}, c, { zone: Object.assign({}, c.zone, { confluence: 2, srcs: ['a', 'b'] }) });
  const g3 = W.opGates(rows, thin, live, 'TESTUSD');
  const cf = g3.filter(g => g.key === 'confluence')[0];
  ok(cf && cf.pass === false && cf.info !== true, 'a two-source zone is a HARD veto — 3+ sources is a zone');

  const g4 = W.opGates(rows, c, live, 'TESTUSD');
  ok(g4.some(g => g.key === 'context-gates'), 'the 14 shared context gates read every candidate');
  ok(g4.some(g => g.key === 'trend-guard'), 'and the running-trend fade guard is on the ledger');
  ok(g4.every(g => g && typeof g.why === 'string' && g.why.length > 0), 'every gate states its why');
}

console.log('\n== end-to-end through the real scan loop ==');
{
  const W2 = boot();
  const UNI = [];
  for (let i = 0; i < 14; i++) UNI.push({ sym: 'OP' + i + 'USD', base: 'OP' + i, exchange: 'delta' });
  W2.xuUniverse = () => Promise.resolve(UNI);
  W2.xuCandles = () => Promise.resolve(topTape(360));
  const mk = () => ({ innerHTML: '', textContent: '', disabled: false, style: {}, addEventListener(){} });
  const ui = { btn: mk(), stat: mk(), cards: mk() };
  await W2.hgOpRunScan(ui);
  ok(ui.btn.disabled === false, 'the scan ends and re-enables the button');
  ok(/zone\(s\) across 14 contracts/.test(ui.stat.textContent), 'the status reports the sweep: "' + ui.stat.textContent.slice(0, 80) + '"');
  const cards = (ui.cards.innerHTML.match(/<div class="card">/g) || []).length;
  ok(cards > 0 && cards <= 6, 'only the most probable render — top ' + cards + ', capped at 6');
  ok(/Triggers evaluate at 1h bar closes/.test(ui.cards.innerHTML), 'the entry times lead the page');
  ok(/ARMED|TRIGGERED/.test(ui.cards.innerHTML), 'every card declares its lifecycle state');
  ok(/Anticipation, not prophecy/.test(read('omnipresent.js')), 'and the desk states what it is on the tab itself');
  const snap = W2.hgOpState();
  ok(snap && Array.isArray(snap.rows) && snap.rows.length >= cards, 'every zone found is retained in the snapshot, shown or not');
}

console.log('\npassed: ' + passed);
