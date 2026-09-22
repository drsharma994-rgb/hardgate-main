/* HARDGATE — THE COST GATE REJECTS, BECAUSE A DEMOTE NEVER STOPPED A TRADE.

   GOLD SCALP demoted any setup whose stop sat under 8x the venue round trip
   (0.16% of entry at XM's 0.020%). The reasoning on the line was that the
   cohort is GROSS-POSITIVE, so it should paint and simply never lead.

   The cohort IS gross-positive. MEASURED on the tab's own 15m replay, live
   rows only (the harness's shadow book excluded), net R at XM:

     whole live book                       n=2193  -0.148R  t=-5.71
     stop under the 0.16% bar              n= 671  -0.363R  t=-7.54
     what remains once they are rejected   n=1522  -0.053R  t=-1.75

   671 trades — 31% of the book — carried -243.3R of its -324.3R total loss.
   A demote stopped none of them: it only stopped them leading, so they
   painted and they ran. The setups are not wrong; the geometry cannot pay
   for them.

   Rejecting removes three quarters of the bleeding and keeps 69% of the
   volume. What remains is still negative (-0.053R, t=-1.75) — this is where
   the bleeding stops, not where an edge begins, and the file says so rather
   than dressing it up.

   THE SWING LANE IS UNAFFECTED: 0 of its 244 settled trades sit under the
   bar, because 4h stops are rarely that tight. The shared gate is the same
   one, so goldswing's push() reads its verdict too, and a test forces the
   wire with a venue override absurd enough to bind a 4h stop.

   WHY THIS WAS NOT OBVIOUS. The gate was already firing — 650 of the 787
   rows under the bar carry its demote. But the replay harness recorded
   c.stamps.slice(0, 6), and COST-HEAVY is the 13th stamp the scalp pipeline
   can add, so on any card with six earlier stamps it was cut from the
   record. The evidence showed a working gate firing zero times. The cap is
   now 24 and a test holds it there.

   Run: node tests/test-gold-cost-reject.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const S = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = f => JSON.parse(S(f));

const ctx = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, Date, Intl, RegExp,
              parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'goldind.js'])
  vm.runInContext(S(f), ctx, { filename: f });
const GATE = ctx.hgGoldScalpCostGate;

const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const tstat = v => {
  const m = mean(v);
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
  return m / (sd / Math.sqrt(v.length));
};
const riskPct = t => {
  const e = t.entry, s = t.stop;
  return (typeof e === 'number' && typeof s === 'number' && e > 0) ? Math.abs(e - s) / e * 100 : null;
};

console.log('== the cohort is real, and it is where the book bleeds ==');
{
  /* LIVE rows only. The harness also replays a shadow book of EDGE-suppressed
     candidates that no reader ever sees; counting those would inflate the
     cohort by 116 trades and the claim with it. */
  const all = J('scripts/backtest-goldscalp-results-floor.json').trades
    .filter(t => typeof t.netR === 'number' && !t.shadow);
  ok(all.length === 2193, `${all.length} live settled scalp trades`);

  const BAR = 0.16;
  const heavy = all.filter(t => (riskPct(t) ?? 9) < BAR).map(t => t.netR);
  const keep  = all.filter(t => (riskPct(t) ?? 0) >= BAR).map(t => t.netR);
  ok(heavy.length === 671 && keep.length === 1522,
     `${heavy.length} sit under the 0.16% bar, ${keep.length} at or above it`);
  ok(Math.abs(mean(all.map(t => t.netR)) + 0.148) < 0.001, `the whole live book is ${mean(all.map(t => t.netR)).toFixed(3)}R`);
  ok(Math.abs(mean(heavy) + 0.363) < 0.001, `the cohort under the bar is ${mean(heavy).toFixed(3)}R`);
  ok(Math.abs(mean(keep) + 0.053) < 0.001, `what remains is ${mean(keep).toFixed(3)}R`);
  ok(tstat(heavy) < -7, `and the cohort's loss is not noise: t=${tstat(heavy).toFixed(2)}`);

  const lossAll = all.reduce((a, t) => a + t.netR, 0);
  const lossHeavy = heavy.reduce((a, b) => a + b, 0);
  ok(Math.abs(lossHeavy / lossAll - 0.75) < 0.02,
     `${(100 * heavy.length / all.length).toFixed(0)}% of the trades carry ${(100 * lossHeavy / lossAll).toFixed(0)}% of the loss`);

  /* The argument the old contract rested on, stated and then answered. */
  const grossHeavy = all.filter(t => (riskPct(t) ?? 9) < BAR)
    .filter(t => typeof t.rGross === 'number').map(t => t.rGross);
  ok(mean(grossHeavy) > 0,
     `the cohort really is GROSS-positive (${mean(grossHeavy).toFixed(3)}R) — which is why it survived as a demote`);

  /* And the honest limit of the fix. */
  ok(mean(keep) < 0 && tstat(keep) < 0,
     'what remains is still negative — this is where the bleeding stops, not where an edge begins');
}

console.log('\n== the gate rejects now, with a clean boundary ==');
{
  const at = pct => {
    const c = { dir: 'long', entry: 4000, stop: 4000 - 4000 * pct / 100, t1: 4010, stamps: [] };
    GATE(c);
    return c;
  };
  ok(at(0.05).dropped === true, 'a 0.05% stop is rejected');
  ok(at(0.159).dropped === true, 'so is 0.159%, just under the bar');
  ok(!at(0.16).dropped, 'exactly 0.16% passes — the bar is >=, not >');
  ok(!at(0.5).dropped, 'and a 0.5% stop passes comfortably');

  const c = at(0.05);
  ok(c.costHeavy === true && (c.stamps || []).indexOf('COST-HEAVY') >= 0, 'the rejected card is stamped COST-HEAVY');
  ok(/0\.125R/.test(String(c.reason || '')), 'and its reason names the fee share of the risk');
  ok(/rejected, not demoted/.test((c.gateNotes || []).join(' ')),
     'the gate note says outright that this is a rejection');

  /* It must not reject anything it cannot judge. */
  for (const bad of [{ dir: 'long', entry: 0, stop: 1 }, { dir: 'long', entry: 4000, stop: NaN },
                     { dir: 'x', entry: 4000, stop: 3998 }, null, undefined]){
    const r = GATE(bad);
    ok(!(r && r.dropped), `unreadable geometry is left alone rather than rejected (${JSON.stringify(bad)})`);
  }
  const already = { dir: 'long', entry: 4000, stop: 3998, dropped: true, reason: 'earlier gate' };
  GATE(already);
  ok(already.reason === 'earlier gate', 'and an already-dropped card keeps the FIRST reason it was dropped for');
}

console.log('\n== both desks honour the verdict ==');
{
  const gi = S('goldind.js'), gw = S('goldswing.js');
  ok(/hgGoldScalpCostGate\(c, inp\.rtCostPct\);[\s\S]{0,400}?if \(c\.dropped\)\{ rejected\.push\(c\); return; \}/.test(gi),
     'the scalp push() reads c.dropped after the gate — without it the rejection reached the board anyway');
  ok(/costFn\(c, microOpts && microOpts\.rtCostPct, \{ demoteOnly: true \}\)/.test(gw),
     'while the swing push() passes demoteOnly — the split is the evidence, not a preference');
  ok(/if \(c\.dropped\)\{ out\.rejected\.push\(c\); return; \}/.test(gw),
     'and still honours a rejection from an EARLIER gate');
  ok(/c\.dropped = true;/.test(gi.slice(gi.indexOf('function hgGoldScalpCostGate'), gi.indexOf('function hgGoldScalpStopFloor'))),
     'the gate body sets dropped, not demoted');
  const body = gi.slice(gi.indexOf('function hgGoldScalpCostGate'), gi.indexOf('function hgGoldScalpStopFloor'));
  ok(/var reject = !\(opts && opts\.demoteOnly\);/.test(body),
     'and the lane chooses: absent opts the caller is the scalp lane, the one with a measurement');
  /* The split is only defensible while the swing replay really is empty of
     these, so that is asserted from the file and not from memory. */
  const swAll = J('scripts/backtest-goldswing-results.json').trades.filter(t => typeof t.netR === 'number');
  ok(swAll.filter(t => (riskPct(t) ?? 9) < 0.16).length === 0,
     'the swing replay still contains 0 trades under the bar — the moment it does not, this split needs re-deciding');
}

console.log('\n== the swing lane is untouched in practice, and that is measured ==');
{
  const sw = J('scripts/backtest-goldswing-results.json').trades.filter(t => typeof t.netR === 'number');
  const under = sw.filter(t => (riskPct(t) ?? 9) < 0.16);
  ok(sw.length === 244 && under.length === 0,
     `0 of ${sw.length} settled swing trades sit under the bar — 4h stops are rarely that tight`);
  /* But "rarely" is not "never", and the engine is not the replay: a 4h
     order-block retest anchored just beyond the OB base produces a stop
     around 0.03% of entry. test-goldswing.mjs mints exactly that, which is
     how this pack learned the difference. */
  ok(/demoteOnly: true/.test(S('goldswing.js')),
     'so swing demotes rather than rejects — the replay is silent here, and silence is not evidence');
  ok(mean(sw.map(t => t.netR)) > 0,
     `so the change costs the swing lane nothing; its book stays ${mean(sw.map(t => t.netR)).toFixed(3)}R`);
}

console.log('\n== the record no longer hides which gate fired ==');
{
  const h = S('scripts/backtest-goldscalp.mjs');
  ok(/c\.stamps\.slice\(0, 24\)/.test(h), 'the scalp harness records up to 24 stamps');
  ok(!/c\.stamps\.slice\(0, 6\)/.test(h), 'and no longer truncates at 6');
  /* Why it mattered: the truncation is what made a working gate read as dead. */
  const old = J('scripts/backtest-goldscalp-results-floor.json').trades;
  const heavyRows = old.filter(t => (riskPct(t) ?? 9) < 0.16);
  const stamped = heavyRows.filter(t => (t.stamps || []).indexOf('COST-HEAVY') >= 0).length;
  const demoted = heavyRows.filter(t => t.demoted === true).length;
  ok(stamped === 0 && demoted > 600,
     `in the OLD bake ${stamped} of ${heavyRows.length} carry the stamp while ${demoted} carry the demote — the gate fired, the record lost it`);
}

console.log(`\n${passed} passed, 0 failed`);
