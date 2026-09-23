/* HARDGATE — the measurement that was taken and thrown away.

   scripts/backtest-omnigold.mjs has computed tr.mfe and tr.mae on every
   filled bar since the 2R work, under a comment that states exactly why:

     "Answering 'would 1R have paid better?' needs to know how far the trade
      ran BEFORE it resolved, and no artifact recorded that."

   ...and settleRecord never emitted them. The work was done and dropped on
   the way out, so the artifact still could not answer the question its own
   comment poses. backtest-goldscalp.mjs did not track them at all. The result
   is that on gold, every exit question — is the fixed target right? would a
   breakeven move pay? is the stop wider than it needs to be? — has been not
   unresolved but UNMEASURABLE, while crypto has had hgHeatProfile and
   hgStopSweep since hg-v182.

   THE CONSERVATIVE RULE IS THE POINT, and why the rule is SHARED rather than
   copied: a bar that touches the stop contributes NOTHING to the favourable
   excursion, because intrabar order is unknown and the walk resolves a
   both-touch bar as a loss. Crediting the high of the bar that stopped the
   trade out would let the sweep invent gains no real fill ever saw — and two
   copies of that rule drift, with the drifting copy flattering its own desk.

   Run: node tests/test-gold-excursions.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { excursionStep, excursionR } from '../lib/gold-excursions.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

console.log('\n1. the favourable and adverse sides, in price then in R');
{
  const tr = {};
  excursionStep(tr, { h: 105, l: 98 }, 'long', 100, 95, false);
  ok(tr.mfe === 5 && tr.mae === 2, 'a long records +5 in favour and 2 against');
  const r = excursionR(tr, 100, 95);
  ok(r.mfeR === 1 && r.maeR === 0.4, 'and normalises both by the 5-point risk: 1.00R and 0.40R');

  const sh = {};
  excursionStep(sh, { h: 102, l: 93 }, 'short', 100, 105, false);
  ok(sh.mfe === 7 && sh.mae === 2, 'a short is the mirror image, not a sign flip of the long');
  ok(excursionR(sh, 100, 105).mfeR === 1.4, 'and normalises by its own risk');
}

console.log('\n2. it keeps the EXTREME across bars, not the last one');
{
  const tr = {};
  excursionStep(tr, { h: 108, l: 99 }, 'long', 100, 95, false);
  excursionStep(tr, { h: 103, l: 96 }, 'long', 100, 95, false);
  ok(tr.mfe === 8, 'a later, smaller favourable bar does not erase the high-water mark');
  ok(tr.mae === 4, 'and the adverse side takes the deepest of the two');
  /* THE ADVERSE SIDE NEEDS ITS OWN ORDER TEST. Above, the deeper adverse bar
     is also the LAST one, so "keep the extreme" and "keep the latest" agree
     and neither is really tested. Here the deeper one comes first. */
  const adv = {};
  excursionStep(adv, { h: 101, l: 90 }, 'long', 100, 95, false);
  excursionStep(adv, { h: 102, l: 99 }, 'long', 100, 95, false);
  ok(adv.mae === 10, 'a deeper adverse bar is not erased by a shallower one after it');
  ok(adv.mfe === 2, 'while the favourable side still takes its own later, larger value');
  const tr2 = {};
  excursionStep(tr2, { h: 101, l: 99 }, 'long', 100, 95, false);
  excursionStep(tr2, { h: 112, l: 91 }, 'long', 100, 95, false);
  ok(tr2.mfe === 12 && tr2.mae === 9, 'and a later, larger bar does replace it');
}

console.log('\n3. THE CONSERVATIVE RULE — a stop bar contributes nothing');
{
  const tr = {};
  /* a bar that ran to 110 in favour AND touched the stop at 95: crediting the
     110 would be inventing a gain the fill never saw */
  excursionStep(tr, { h: 110, l: 94 }, 'long', 100, 95, true);
  ok(tr.mfe == null && tr.mae == null,
     'the bar that stopped the trade out is excluded entirely, both sides');
  const r = excursionR(tr, 100, 95);
  ok(r.mfeR === null && r.maeR === null,
     'so a trade stopped on its first bar reports NULL, not a flattering zero');

  /* and the exclusion must not leak backwards */
  const tr2 = {};
  excursionStep(tr2, { h: 106, l: 99 }, 'long', 100, 95, false);
  excursionStep(tr2, { h: 110, l: 94 }, 'long', 100, 95, true);
  ok(tr2.mfe === 6, 'an earlier clean bar keeps its excursion when a later bar stops out');
  ok(tr2.mae === 1, 'on both sides');
}

console.log('\n4. it refuses to invent a number');
{
  /* A RECORDED EXCURSION WITH NO RISK TO DIVIDE BY. The earlier version of
     this asserted on a trade whose excursions were themselves null, so it
     passed whether or not the zero-risk guard existed — 5/0 is Infinity, and
     an Infinity R multiple in the book is worse than a missing one. */
  ok(excursionR({ mae: 5, mfe: 7 }, 100, 100).maeR === null,
     'a recorded excursion with zero risk is null, not Infinity');
  ok(excursionR({ mae: 5, mfe: 7 }, 100, 100).mfeR === null, 'on both sides');
  ok(excursionR({}, 100, 100).maeR === null, 'a zero-risk trade has no R to normalise by');
  ok(excursionR({}, 100, 95).maeR === null, 'nothing recorded is null, which is not the same as 0.00R');
  ok(excursionR({ mae: -3 }, 100, 95).maeR === 0,
     'a negative excursion is clamped to zero — "how far against" cannot be below none');
  const tr = {};
  excursionStep(tr, null, 'long', 100, 95, false);
  ok(tr.mfe == null, 'a missing bar changes nothing rather than throwing mid-walk');
  ok(excursionStep(null, { h: 1, l: 1 }, 'long', 100, 95, false) === null, 'and a missing trade is returned as-is');
}

console.log('\n5. both harnesses use the SHARED rule and EMIT it');
{
  const og = fs.readFileSync(root + 'scripts/backtest-omnigold.mjs', 'utf8');
  const gs = fs.readFileSync(root + 'scripts/backtest-goldscalp.mjs', 'utf8');
  for (const [name, src] of [['backtest-omnigold', og], ['backtest-goldscalp', gs]]){
    ok(/import \{ excursionStep, excursionR \} from '\.\.\/lib\/gold-excursions\.mjs';/.test(src),
       name + ' imports the shared rule');
    ok(/excursionStep\(tr, bar, dir, entry, stop, hitStop\);/.test(src),
       '  and folds every bar through it');
    ok(/\.\.\.excursionR\(tr, tr\.entry, tr\.stop\),/.test(src),
       '  and EMITS the pair — the half that was missing');
  }
  /* the old inline copy must be gone, or the shared rule is decorative */
  ok(!/tr\.mfe = fav/.test(og) && !/tr\.mae = adv/.test(og),
     'OMNIGOLD no longer carries its own inline copy of the rule');
  ok(!/tr\.mfe = fav/.test(gs), 'and GOLD SCALP never gets one');
  ok((og.match(/excursionStep\(/g) || []).length === 1,
     'each harness folds through it in exactly one place');
}

console.log('\n6. and the artifacts will carry it on the next bake');
{
  /* the committed books predate this, which is the finding, not a failure */
  const og = JSON.parse(fs.readFileSync(root + 'scripts/backtest-omnigold-results.json', 'utf8'));
  const has = Object.keys(og.trades[0]).some(k => /^ma[ef]R$/.test(k));
  ok(!has, 'the COMMITTED OMNIGOLD book has no excursions — that is what this pack fixes, '
         + 'and it stays true until a re-bake can fetch');
}

if (process.exitCode) console.error('\n' + passed + ' passed, but this file FAILED — see above');
else console.log('\n' + passed + ' assertions — all green');
