/* hg-v990 — CRYPTO ULTRA GATED ITSELF "MEASURED NOT TRADABLE" ON A WALK THAT
   MEASURED NOTHING: EVERY REPLAY HARNESS HANDED THE ENGINE A RULE WITHOUT
   GEOMETRY, EVERY PLAN WAS PRICED AT STOP NULL / TARGET NULL, AND ZERO SETTLED
   TRADES WAS READ AS AN ARCHITECTURAL VERDICT.

   The committed artifact (scripts/backtest-cryptoultra-results.json): 14 grid
   cells, 1,628 fires at the loosest, ZERO settled trades in every cell,
   `chosen: null`, `evidence: null`. The hand-typed literal in cryptoultra.js
   said `measured: true` and diagnosed "architectural failure ... long and
   short always fire on identical bars, canceling each other". The cause was
   the harness: `rule: { minPct: 0, minAvail: 0, regimeGate: false }` REPLACED
   the rule (`inp.rule || RULE`), so stopAtr / t1R / timeoutBars were undefined
   and every plan carried a NaN stop and target that no bar could ever hit.

   This pack:
     - the engine merges an override over RULE, and refuses a plan whose stop
       distance is not a positive finite number (a named gate, plan null)
     - the walk counts unpriced plans and refuses to write an artifact while
       any exist (fatal, never skipped)
     - the evidence literal is GENERATED from the artifact: measured:false with
       the artifact's own account when nothing was chosen, measured:true from
       the artifact's own figures when a rule was
   Nothing loosens: NOT YET MEASURED is record-only exactly as MEASURED NOT
   TRADABLE was; no fire, no ticket.

   Run: node tests/test-cryptoultra-evidence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { loadArtifact, evidenceFrom, literal, splice, BEGIN, END, ARTIFACT } from '../scripts/cryptoultra-evidence-literal.mjs';
import { boot as walkBoot, scanBars, walkRule, agg, assertPriced, READS } from '../scripts/backtest-cryptoultra.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');

function bootTab(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  vm.createContext(ctx);
  vm.runInContext(read('cryptoultra.js'), ctx, { filename: 'cryptoultra.js' });
  return ctx;
}
const now = Math.floor(Date.now() / 1000);
function tape(n, sec, seed, drift, px0){ let s = seed, p = px0 || 60000; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const t0 = Math.floor(now / sec) * sec - n * sec; const out = [];
  for (let i = 0; i < n; i++){ p = p * (1 + ((rnd() - 0.5) * 0.004 + drift)); const r = p * 0.002 * (0.5 + rnd()); out.push({ t: t0 + i * sec, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 300 }); }
  return out; }
const WALK_OVERRIDE = { minPct: 0, minAvail: 0, regimeGate: false };   /* verbatim from the three harnesses */
const VC = { venue: 'Binance', rtFrac: 0.002 };

console.log('1. the committed artifact measured nothing');
{
  const a = loadArtifact();
  ok(/backtest-cryptoultra-results\.json$/.test(ARTIFACT) && a.grid.length === 14, 'fourteen grid cells');
  ok(a.grid.every(g => g.all.n === 0 && g.ins.n === 0 && g.oos.n === 0) && Math.max.apply(null, a.grid.map(g => g.fired)) === 1628, 'every cell settled ZERO trades while the loosest fired 1,628 times');
  ok(a.chosen === null && a.evidence === null, 'no rule was chosen and the artifact carries no evidence block');
  ok(a.meta.unpriced === undefined, 'the artifact predates the unpriced counter (nothing said how many plans had no geometry)');
}

console.log('\n2. the defect, reproduced on the real engine');
{
  const T = bootTab();
  /* the OLD seam, lifted: what `inp.rule || RULE` handed the plan pricer */
  const oldRule = WALK_OVERRIDE;
  ok(oldRule.stopAtr === undefined && oldRule.t1R === undefined && oldRule.timeoutBars === undefined, 'the harness override names no stopAtr, t1R or timeoutBars -- as the whole rule, it has no geometry');
  ok(!isFinite(oldRule.stopAtr * 100) && !isFinite(Math.max(NaN, 60000 * 0.002 * oldRule.costFloorMult)), 'so rawStop and the cost floor were both NaN, and Math.max of them is NaN: a stop distance no bar can hit');
  let planned = 0, finite = 0, gated = 0, refused = 0;
  for (let seed = 1; seed <= 30; seed++){
    const m15 = tape(330, 900, seed, 0.0006), h1 = tape(420, 3600, seed * 7, 0.0006);
    const nowMs = (m15[m15.length - 1].t + 900) * 1000;
    const r = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: WALK_OVERRIDE });
    if (r.plan){ planned++; if (isFinite(r.plan.stop) && isFinite(r.plan.t1) && Math.abs(r.plan.entry - r.plan.stop) > 0) finite++; }
    else gated++;
    if ((r.gates || []).some(g => /plan geometry unreadable/.test(g))) refused++;
  }
  ok(planned >= 20 && finite === planned, 'with the harness override MERGED over RULE, every plan the engine prices has a finite stop and target (' + finite + '/' + planned + ' on 30 tapes; ' + gated + ' gated, ' + refused + ' refused)');
  const m15 = tape(330, 900, 3, 0.0006), h1 = tape(420, 3600, 21, 0.0006), nowMs = (m15[m15.length - 1].t + 900) * 1000;
  const a = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: WALK_OVERRIDE });
  const b = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC });
  ok(a.plan && b.plan && a.plan.entry === b.plan.entry && a.plan.stop === b.plan.stop && a.plan.t1 === b.plan.t1 && a.plan.t2 === b.plan.t2, 'the override changes only what it names: the plan under the override equals the plan under RULE (same stop, same targets)');
  const c = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { stopAtr: 3.0 } });
  ok(c.plan && Math.abs(c.plan.stopAtr - Math.max(3.0, b.plan.stopAtr)) < 1e-9 && c.plan.rr1 === b.plan.rr1, 'an override that names stopAtr moves the stop and inherits the target ladder');
  const strict = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { minPct: 0.99 } });
  ok(strict.fire === false && strict.gates.some(g => /< 99%/.test(g)), 'an override that names minPct still gates on it (the existing contract)');
  const nan = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { stopAtr: null, costFloorMult: null } });
  ok(nan.plan === null && nan.fire === false && nan.gates.some(g => /plan geometry unreadable: stop distance 0 \(stopAtr null, costFloorMult null\)/.test(g)), 'a rule whose geometry reads null is REFUSED as a named gate with plan null (+null is 0: a zero stop distance is no stop) -- never a plan whose stop equals its entry');
  const nanU = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { stopAtr: undefined } });
  ok(nanU.plan === null && nanU.gates.some(g => /stopAtr undefined/.test(g)), 'an override that names a geometry key as undefined is refused (Object.assign copies the undefined; an unreadable key is not inherited silently)');
  const nanL = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { t1R: null } });
  ok(nanL.plan === null && nanL.gates.some(g => /t1R null/.test(g)), 'a null target ladder is refused too (isFinite(null) is true; the check reads a positive number)');
  const nanT = T.cryptoUltraEngine({ rows15m: m15, rows1h: h1, now: nowMs, venueCost: VC, rule: { t1R: 'x' } });
  ok(nanT.plan === null && nanT.gates.some(g => /t1R x/.test(g)), 'an unreadable target ladder is refused the same way');
  ok(a.recordOnly === true && a.fire === false && a.gates.some(g => /NOT YET MEASURED/.test(g)), 'and every priced plan is RECORD ONLY under the NOT YET MEASURED gate -- nothing loosens');
}

console.log('\n3. the walk, driven on synthetic bars through the real engine');
{
  const W = walkBoot();
  const m15 = tape(430, 900, 11, 0.0004), h1 = tape(520, 3600, 77, 0.0004);   /* 200 walked bars: enough to fire, fill and exit, cheap enough to run under mutation */
  READS.unpriced = 0;
  const sigs = scanBars(W, m15, h1);
  const withPlan = sigs.filter(s => s.plan);
  ok(sigs.length === m15.length - 230 && withPlan.length > 30, 'one row per bar after the warm-up, ' + withPlan.length + ' with a lead and a plan');
  ok(withPlan.every(s => isFinite(s.plan.stop) && isFinite(s.plan.t1) && Math.abs(s.plan.entry - s.plan.stop) > 0), 'every plan the walk kept has a finite stop and target');
  ok((READS.unpriced || 0) === 0 && assertPriced(sigs) === 0 && !sigs.some(s => s.unpriced), 'no plan was unpriced, and the refusal passes');
  const { trades, counters } = walkRule(sigs, m15, 0.55, false, 24);
  const A = agg(trades);
  ok(counters.fired > 0 && A.n > 0 && A.n === trades.filter(t => t.netR != null && isFinite(t.netR)).length, 'the walk settles trades with finite net R (' + A.n + ' settled of ' + counters.fired + ' fired, ' + counters.merged + ' merged)');
  ok(A.n === trades.length, 'and EVERY settled trade counts -- none is dropped for a NaN R (' + A.n + ' of ' + trades.length + ')');
  ok(trades.every(t => t.outcome === 'win' || t.outcome === 'loss' || t.outcome === 'timeout') && trades.some(t => t.outcome !== 'timeout'), 'outcomes are won, lost or timed out, and not every trade merely times out (' + trades.filter(t => t.outcome !== 'timeout').length + ' exited on price)');
  /* the defect through the walk's own code: a stub engine that prices no stop */
  const stub = { HG_CRYPTO_ULTRA_RULE: W.HG_CRYPTO_ULTRA_RULE, cryptoUltraEngine: (inp) => ({ ok: true, count: { pct: 0.9, decisive: 40, lead: 'long', total: 100, kinds: { vote: 50 } }, regime: 'trend', atr: 10, plan: { entry: 100, stop: NaN, t1: NaN, stopAtr: NaN } }) };
  READS.unpriced = 0;
  const bad = scanBars(stub, m15.slice(0, 260), h1);
  ok(bad.length === 30 && bad.every(s => s.unpriced === true && !s.plan) && READS.unpriced === 30, 'a plan with a NaN stop is counted UNPRICED and kept out of the walk (' + READS.unpriced + ' of 30)');
  let threw = null; try { assertPriced(bad); } catch (e) { threw = e; }
  ok(threw && /30 plan\(s\) carried no stop or target/.test(threw.message) && /Nothing written/.test(threw.message), 'and the walk refuses to write: fatal, naming the count and the seam');
  let one = null; try { assertPriced([{ i: 1, plan: { entry: 1, stop: 0.9, t1: 1.2 } }, { i: 2, unpriced: true }]); } catch (e) { one = e; }
  ok(one && /1 plan\(s\) carried no stop or target/.test(one.message), 'ONE unpriced plan is enough to refuse -- a single NaN plan is a harness defect, not noise');
  const { trades: none } = walkRule(bad, m15.slice(0, 260), 0.55, false, 24);
  ok(none.length === 0, 'unpriced rows never become trades (the old path let them live for 24 bars and time out with NaN R)');
  READS.unpriced = 0;
}

console.log('\n4. the evidence literal writes itself from the artifact');
{
  const src = read('cryptoultra.js');
  ok(src.indexOf(BEGIN) >= 0 && src.indexOf(END) > src.indexOf(BEGIN), 'cryptoultra.js carries the BEGIN/END markers');
  ok(splice(src, literal(evidenceFrom(loadArtifact()))) === src, 'HG_CRYPTO_ULTRA_EVIDENCE equals the generator output on the committed artifact (zero drift)');
  let threw = null; try { splice('x', 'y'); } catch (e) { threw = e; }
  ok(threw && /BEGIN marker not found in cryptoultra\.js/.test(threw.message), 'a missing marker is fatal and names the file');
  const ev = evidenceFrom(loadArtifact());
  ok(ev.measured === false && ev.tradable === false && ev.isN === 0 && ev.oosN === 0 && ev.rule === null && ev.verdict === null, 'on the committed artifact: NOT measured, not tradable, no populations, no rule, no verdict');
  ok(ev.walk.cells === 14 && ev.walk.fired === 1628 && ev.walk.settled === 0 && ev.walk.barsWithLead === 1768 && ev.walk.unpriced === undefined, 'the walk counts are the artifact\'s own (14 cells, 1,628 fired, 0 settled, 1,768 bars with a lead, unpriced not recorded)');
  ok(/^NOT YET MEASURED/.test(ev.note) && /fired 1628 times at its loosest cell and settled 0 trades in every one of its 14 cells/.test(ev.note) && /defect of the walk, not a verdict on the strategy/.test(ev.note), 'the note is derived: the counts, and that a zero here is a defect of the walk');
  ok(!/architectural|canceling|correlated/i.test(ev.note) && !/architectural/i.test(JSON.stringify(ev.limitations)), 'no hand-typed diagnosis survives: the artifact never said "architectural failure" and neither does the literal');
  ok(ev.limitations.length === 6 && ev.limitations[0] === loadArtifact().meta.limitations[0], 'the limitations are the artifact\'s own six, verbatim');
  /* the branch a future bake takes: a rule chosen, evidence carried */
  const a2 = JSON.parse(JSON.stringify(loadArtifact()));
  a2.meta.unpriced = 0;
  a2.grid[3].all.n = 120; a2.grid[3].ins.n = 84; a2.grid[3].oos.n = 36;
  a2.evidence = { rule: { minPct: 0.7, minAvail: 25, regimeGate: true, stopAtr: 1.5, t1R: 1.5, t2R: 2.5, timeoutBars: 24, costFloorMult: 8 },
                  ins: { n: 84, winRate: 0.44, avgR_net: 0.11 }, oos: { n: 36, winRate: 0.39, avgR_net: -0.05 }, tradable: false, verdict: 'Out-of-sample n=36 is too thin to trust either way — fires are informational, not tickets.' };
  const ev2 = evidenceFrom(a2);
  ok(ev2.measured === true && ev2.isN === 84 && ev2.isAvgR === 0.11 && ev2.isWin === 0.44 && ev2.oosN === 36 && ev2.oosAvgR === -0.05 && ev2.oosWin === 0.39 && ev2.tradable === false && /too thin/.test(ev2.verdict) && ev2.note === null, 'when a bake chooses a rule the literal is measured, with the artifact\'s own figures and verdict');
  ok(ev2.walk.unpriced === 0 && ev2.walk.settled === 120 && ev2.rule.minPct === 0.7, 'and carries the walk counts and the rule the artifact chose');
  const a3 = JSON.parse(JSON.stringify(loadArtifact())); a3.evidence = { rule: { minPct: 0.7 }, ins: { n: 84 }, oos: { n: 36 }, tradable: 'yes' };
  ok(evidenceFrom(a3).tradable === false, 'tradable is the boolean true or it is false -- never a coerced string');
  const lit2 = literal(ev2);
  ok(/measured: true/.test(lit2) && /oosN: 36/.test(lit2) && splice(src, lit2) !== src && splice(splice(src, lit2), literal(ev)) === src, 'the measured literal splices in and the committed literal splices back byte for byte');
  const a4 = JSON.parse(JSON.stringify(loadArtifact())); a4.grid.forEach(g => { g.fired = 0; g.merged = 0; });
  ok(/fired nothing at any cell/.test(evidenceFrom(a4).note), 'a walk that fired nothing says so, a different sentence from one that fired and priced nothing');
  const a5 = JSON.parse(JSON.stringify(loadArtifact())); a5.grid[0].all.n = 30;
  ok(/settled 30 trades across 14 cells and no cell reached the in-sample floor \(80\)/.test(evidenceFrom(a5).note), 'a walk that settled too few for the floor says so, naming the floor');
  const a6 = JSON.parse(JSON.stringify(loadArtifact())); a6.meta.unpriced = 1768;
  ok(/1768 of its plans carried no stop or target/.test(evidenceFrom(a6).note), 'a re-run that recorded its unpriced count quotes it instead of the hg-v990 account');
}

console.log('\n5. the tab reads the generated literal, and nothing loosens');
{
  const T = bootTab();
  const E = T.HG_CRYPTO_ULTRA_EVIDENCE;
  ok(E && E.measured === false && E.walk && E.walk.settled === 0, 'the tab exports the generated literal');
  const stubs = {}; const el = { innerHTML: '', querySelector: s => (stubs[s] = stubs[s] || { innerHTML: '', textContent: '', style: {}, disabled: false, addEventListener(){} }) };
  T.HG_tabs.find(t => t.id === 'cryptoultra').mount(el);
  const cards = stubs['#cuCards'].innerHTML;
  ok(/VERIFIED/.test(cards) && /NOT YET MEASURED/.test(cards) && /settled 0 trades in every one of its 14 cells/.test(cards) && !/MEASURED NOT TRADABLE/.test(cards) && !/architectural/i.test(cards), 'the VERIFIED panel prints the derived note and no verdict the walk never reached');
  const code = stripComments(read('cryptoultra.js'));
  ok(/var rule = inp\.rule \? Object\.assign\(\{\}, RULE, inp\.rule\) : RULE;/.test(code) && !/rule = inp\.rule \|\| RULE/.test(code), 'the engine merges an override over RULE (the old `inp.rule || RULE` is gone)');
  for (const f of ['scripts/backtest-crypto-multisymbol.mjs', 'scripts/backtest-cryptoscan-improved.mjs', 'scripts/backtest-cryptoultra.mjs']){
    ok(/rule: \{ minPct: 0, minAvail: 0, regimeGate: false \}/.test(read(f)), f + ' passes the partial override, and now inherits the geometry through the merge (textual)');
  }
  ok(/assertPriced\(sigs\);/.test(read('scripts/backtest-cryptoultra.mjs')) && /unpriced: READS\.unpriced \|\| 0/.test(read('scripts/backtest-cryptoultra.mjs')), 'the ULTRA walk refuses before writing and records the unpriced count in meta (textual: main is gated behind isMain)');
  ok(/"cu:evidence": "node scripts\/cryptoultra-evidence-literal\.mjs"/.test(read('package.json')), 'npm run cu:evidence is the drift check');
  ok(!/measured: true/.test(code.split('BEGIN GENERATED HG_CRYPTO_ULTRA_EVIDENCE')[0]) && (code.match(/HG_CRYPTO_ULTRA_EVIDENCE/g) || []).length === 5, 'the literal is declared once, read by the engine gate and the panel, exported (both sides) -- and typed nowhere');
}

console.log('\n6. version stamps');
{
  /* the version is READ, never pinned: a guard that names its own pack's number
     turns red on the next pack with nothing wrong (the hg-v989 guard did exactly
     that on the hg-v990 suite run) */
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v) && parseInt(v.slice(4), 10) >= 989, 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
