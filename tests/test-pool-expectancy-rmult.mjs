/* HARDGATE — the pooled expectancy is priced at the R multiple it was
   MEASURED at, not at whatever constant the pooling module happens to hold.

   THE DEFECT. hgOmniPoolStats recomputed expectancy from the pooled hit rate
   as `hit * MIN_RR - (1 - hit)`, using omniroute's own constant (2.0)
   unconditionally. hgOmniBacktestOne already takes opts.rMult, and OMNIGOLD
   passes its horizon's floor: 1.5R on SCALP, 2.0R on SWING. So every scalp
   mechanic was measured at 1.5R and then had its expectancy re-priced at 2.0.

   Caught on live gold bars, not in the abstract. STOCHRSI-TURN on the 1h
   horizon: 12 wins of 29 settled, hit 41.4%.

     measured at 1.5R (what the desk actually trades)   +0.034R
     re-priced at 2.0R (what the pool printed)          +0.241R

   Seven times larger, and it was the number on the card and the number
   measured-edge reasoned about. Breakeven at 1.5R is 40%, so the mechanic
   sits a whisker above a coin flip; at 2.0R breakeven is 33.3% and 41.4%
   looks like a real edge. Same trades, same wins — only the multiple the
   winners were paid at was wrong.

   SWING never showed it, because its floor happens to equal MIN_RR. That is
   exactly the shape of bug that survives: wrong on one horizon, invisible on
   the other, and the wrong horizon is the one that trades more often.

   Run: node tests/test-pool-expectancy-rmult.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8'))(win);
const pool = win.hgOmniPoolStats;
ok(typeof pool === 'function', 'hgOmniPoolStats is exported');

/* The live case that exposed it: 12 wins, 17 losses, 29 settled. */
const LIVE = { 'STOCHRSI-TURN': { samples: 29, wins: 12, losses: 17, open: 4, hit: 12 / 29, expR: NaN } };
const exp = (hit, r) => hit * r - (1 - hit);
const hit = 12 / 29;

console.log('\n== the multiple the caller measured at is the one used ==');
{
  const at15 = pool([LIVE], 1.5)['STOCHRSI-TURN'];
  const at20 = pool([LIVE], 2.0)['STOCHRSI-TURN'];
  ok(Math.abs(at15.hit - hit) < 1e-12, 'the hit rate is unchanged by the multiple (41.4%)');
  ok(Math.abs(at15.expR - exp(hit, 1.5)) < 1e-12,
     '1.5R prices it at ' + at15.expR.toFixed(3) + 'R — what the scalp desk actually trades');
  ok(Math.abs(at20.expR - exp(hit, 2.0)) < 1e-12,
     '2.0R prices it at ' + at20.expR.toFixed(3) + 'R');
  ok(at20.expR > at15.expR * 5,
     'the difference is not cosmetic (' + at15.expR.toFixed(3) + 'R vs ' + at20.expR.toFixed(3) + 'R)');
  /* The regression itself: 1.5R must NOT return the 2.0R number. */
  ok(Math.abs(at15.expR - exp(hit, 2.0)) > 0.2,
     'a 1.5R pool never returns the 2.0R expectancy — the original defect');
  ok(at15.rMult === 1.5 && at20.rMult === 2.0, 'the pool records which multiple it priced at');
}

console.log('\n== omniroute\'s own call is unchanged ==');
{
  /* It passes no multiple and backtests at MIN_RR, so the default must stay
     exactly what it was or this fix breaks the crypto desk to fix gold. */
  const dflt = pool([LIVE])['STOCHRSI-TURN'];
  ok(Math.abs(dflt.expR - exp(hit, 2.0)) < 1e-12,
     'omitting the multiple still prices at MIN_RR = 2 (' + dflt.expR.toFixed(3) + 'R)');
  ok(dflt.rMult === 2, 'and records it as 2');
}

console.log('\n== a bad multiple falls back rather than pricing at zero ==');
{
  /* isFinite(null) is true in JS and +null is 0 — the trap this repo has hit
     before. A caller passing null must not price every winner at 0R, which
     would make every mechanic look catastrophic. */
  for (const bad of [null, undefined, '', 0, -1, NaN, 'x']){
    const r = pool([LIVE], bad)['STOCHRSI-TURN'];
    ok(Math.abs(r.expR - exp(hit, 2.0)) < 1e-12,
       'rMult=' + JSON.stringify(bad) + ' falls back to MIN_RR rather than pricing at ' +
       (Number(bad) || 0) + 'R');
  }
}

console.log('\n== pooling across symbols still sums the samples ==');
{
  const a = { M: { samples: 10, wins: 4, losses: 6, open: 0 } };
  const b = { M: { samples: 10, wins: 6, losses: 4, open: 2 } };
  const p = pool([a, b], 1.5).M;
  ok(p.samples === 20 && p.wins === 10 && p.losses === 10 && p.open === 2,
     'samples, wins, losses and opens are summed across symbols');
  ok(Math.abs(p.hit - 0.5) < 1e-12, 'the pooled hit rate is over the pooled samples');
  ok(Math.abs(p.expR - exp(0.5, 1.5)) < 1e-12, 'and expectancy uses the pooled hit at the given multiple');
}

console.log('\n== zero samples stay NaN, not a fabricated zero ==');
{
  const p = pool([{ M: { samples: 0, wins: 0, losses: 0, open: 3 } }], 1.5).M;
  ok(!isFinite(p.hit), 'no samples means no hit rate');
  ok(!isFinite(p.expR), 'and no expectancy — an unmeasured mechanic reads unknown, not breakeven');
}

console.log('\n== the gold desk passes the R its samples were MEASURED at ==');
{
  /* This assertion originally pinned cfg.minRr. It was right about the
     principle and wrong about the value: cfg.minRr is a plan-ACCEPTANCE
     floor, while the samples are measured wherever T1 is placed — OG_T1_R.
     Passing the floor priced SCALP expectancy at a 1.5R the plan never
     targets, which is the defect test-omnigold-t1-r.mjs was added for.

     Pinning the literal is what let this test bless the intermediate state,
     so it now asserts the invariant instead: whatever multiple the desk
     chooses, the pool and the walk-forward must use the SAME one. If they
     diverge, the hit rate and the expectancy on the card describe two
     different trades. */
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(!/poolFn\(\[stats\]\)/.test(og), 'omnigold never calls the pooler without a multiple');
  const poolArg = /poolFn\(\[stats\],\s*([A-Za-z_$][\w.$]*)\)/.exec(og);
  ok(!!poolArg, 'omnigold passes an explicit multiple to the pooler');
  const btArg = /rMult:\s*([A-Za-z_$][\w.$]*)/.exec(og);
  ok(!!btArg, 'omnigold passes an explicit multiple to the walk-forward');
  ok(poolArg[1] === btArg[1],
     'the pool prices at the SAME multiple the walk-forward measured at (both ' +
     poolArg[1] + ')');
}

console.log('\npool expectancy rMult: ' + passed + ' checks passed');
