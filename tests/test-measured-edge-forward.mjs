/* HARDGATE — the measured-edge gate ignored the out-of-sample record.

   From a live OMNIGOLD card. The ticket carried:

     PASS measured-edge 41 samples · 51% T1-first · +0.54R [+1.47σ vs breakeven]

   for ROUND-MAGNET on the 1h horizon, while the FORWARD table on the same
   page, for that same mechanic on that same horizon, read 0 wins in 5
   settled trades. Across both horizons the desk's out-of-sample record was
   0 for 13 — a 0.16% outcome if the mechanics were merely at breakeven.

   The gate read only x.stats: the walk-forward pool, re-read from the same
   window on every scan. The forward log exists precisely because that number
   cannot be trusted, and the gate never looked at it. A gate that calls
   itself measured-edge cannot quote the figure the ledger was built to
   distrust and ignore the ledger.

   Precedence now:
     - enough settled out-of-sample trades  -> the forward record IS the
       verdict, and a significant shortfall VETOES however good in-sample is
     - too few to judge, but CONTRADICTING a positive in-sample read
       -> UNCHECKED, never PASS: the evidence is in conflict and the card
          says so instead of quoting the agreeable half
     - agreeing, or absent -> in-sample stands, now labelled "in-sample" so
       it can never be mistaken for realised results

   Run: node tests/test-measured-edge-forward.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
function bars(n){
  const out = [];
  let p = 4400;
  for (let i = 0; i < n; i++){
    p = p * (1 + Math.sin(i / 7) * 0.001);
    out.push({ t: 1700000000 + i * 3600, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1000 });
  }
  return out;
}

const W = boot();
const G = W.hgOmniGates;
const ROWS = bars(300);
const HIT = { kind: 'ROUND-MAGNET', dir: 'short', level: 4400, why: 'test' };
const edge = (stats, fwd, minRr) => {
  const gs = G(ROWS, HIT, null, { stats, fwd, minRr: minRr === undefined ? 1.5 : minRr });
  return gs.find(g => g.key === 'measured-edge');
};

console.log('== the gate is reachable and still reports in-sample when alone ==');
{
  ok(typeof G === 'function', 'hgOmniGates is exported');
  const g = edge({ samples: 41, hit: 0.51, expR: 0.54 }, null);
  ok(g.pass === true, 'a positive in-sample pool with no forward record still passes');
  ok(/^in-sample /.test(g.why), 'and the text now says IN-SAMPLE up front (' + g.why.slice(0, 40) + ')');
}

console.log('\n== THE LIVE CASE: in-sample +σ, out-of-sample 0 of 5 ==');
{
  /* Exactly the numbers off the card. */
  const g = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 5, hit: 0, open: 4, expR: -1 });
  ok(g.pass !== true, 'it no longer PASSES on the in-sample number');
  ok(g.pass === null, 'it reads UNCHECKED — unknown, never pass (the rest of the ledger rule)');
  ok(/CONTRADICTORY/.test(g.why), 'the card says the evidence is contradictory');
  ok(/5 settled out-of-sample/.test(g.why), 'and states the out-of-sample count');
  ok(/0% T1-first/.test(g.why), 'and that none of them won');
  ok(/41 samples/.test(g.why), 'while still showing the in-sample figure it used to cite alone');
}

console.log('\n== a conclusive out-of-sample record outranks in-sample ==');
{
  const bad = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0, open: 0, expR: -1 });
  ok(bad.pass === false, 'a significant out-of-sample shortfall VETOES');
  ok(/outranked|outranks/.test(bad.why), 'and says the in-sample pool was outranked');
  ok(/25 settled out-of-sample/.test(bad.why), 'quoting the settled count');

  const good = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0.64, open: 0, expR: 0.6 });
  ok(good.pass === true, 'a good out-of-sample record passes');
  ok(/measured out-of-sample/.test(good.why), 'and is labelled as measured out-of-sample');
  ok(!/in-sample 41/.test(good.why), 'the in-sample number is no longer the headline once real evidence exists');

  /* A conclusive forward record beats a NEGATIVE in-sample read too. */
  const rescue = edge({ samples: 41, hit: 0.20, expR: -0.5 }, { samples: 25, hit: 0.64, open: 0, expR: 0.6 });
  ok(rescue.pass === true, 'and it works in the other direction: good forward beats bad in-sample');
}

console.log('\n== a thin but agreeing record does not block ==');
{
  const g = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 5, hit: 0.6, open: 0, expR: 0.5 });
  ok(g.pass === true, 'a small forward sample that agrees still passes');
  ok(/too few to judge/.test(g.why), 'and is honest that it is too few to judge');
  ok(/in-sample/.test(g.why), 'with the in-sample figure still shown');
}

console.log('\n== open trades are surfaced rather than silent ==');
{
  const g = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 0, hit: NaN, open: 6, expR: NaN });
  ok(g.pass === true, 'nothing settled yet does not block');
  ok(/6 out-of-sample trades still open/.test(g.why), 'but the open count is on the card (' + g.why.slice(0, 45) + ')');
}

console.log('\n== the breakeven basis follows the desk, not a module default ==');
{
  /* OMNIGOLD scalp runs a 1.5R floor: breakeven 40%, not the 33% of a 2R
     desk. Judging a 1.5R mechanic against 33% overstates its significance. */
  const at40 = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0.40, open: 0, expR: 0 }, 1.5);
  ok(at40.pass === true, 'a 1.5R mechanic sitting exactly on its 40% breakeven is not vetoed');
  const at40on2R = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0.40, open: 0, expR: 0 }, 2);
  ok(at40on2R.pass === true, 'and on a 2R desk 40% is comfortably above its 33% breakeven');
  const src = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  ok(/var edMinRr = isFinite\(fin\(x\.minRr\)\)/.test(src), 'the gate reads the desk R floor when supplied');
}

console.log('\n== degenerate input never throws ==');
{
  for (const fwd of [null, undefined, {}, { samples: NaN }, { samples: null }, { samples: 5, hit: NaN }]){
    let threw = null, g = null;
    try { g = edge({ samples: 41, hit: 0.51, expR: 0.54 }, fwd); } catch (e) { threw = e; }
    ok(!threw, 'forward record ' + JSON.stringify(fwd) + ' does not throw');
    ok(g && typeof g.why === 'string', 'and still yields a stated reason');
    ok(!/NaN|undefined/.test(g.why), 'with no NaN on the card (' + g.why.slice(0, 40) + ')');
  }
}

console.log('\n== OMNIGOLD carries its own copy, and it got the same fix ==');
{
  /* This is the one that actually renders on the gold tab: omnigold.js has
     its own measured-edge gate, so fixing omniroute alone would have changed
     nothing for the desk the report came from. */
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/OUT-OF-SAMPLE OVERRIDE/.test(og), 'omnigold has the override too');
  ok(/CONTRADICTORY/.test(og), 'including the contradiction case');
  ok(/FWD_MIN_JUDGE/.test(og), 'and its own judge threshold');
  ok(/function hgOgFwdFor\(tab, mechanic\)/.test(og), 'with a per-mechanic forward lookup');
  ok(/ex\.fwd = hgOgFwdFor\(ex\.fwdTab, statKey\)/.test(og), 'wired per candidate by mechanic');
  ok(/ex\.fwdTab = 'OMNIGOLD:' \+ cfg\.label/.test(og), 'against the pool that horizon records into');

  /* UTAD is measured under SPRING in the pool; the forward lookup must use
     the same key or it would silently find nothing. */
  ok(/var statKey = \(hit\.kind === 'UTAD'\) \? 'SPRING' : hit\.kind;/.test(og),
    'and uses the same family key the stats pool does');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL MEASURED-EDGE FORWARD TESTS PASSED');
