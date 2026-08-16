/* HARDGATE — the five fixpack cores: 69 exported helpers, none ever executed.

   Continuing the coverage measurement from v339/v340. fixpack13..17-core.js
   are ~1,890 lines exporting 69 helpers that the desks call, and no test had
   ever run a line of them.

   Executing all 69 against degenerate inputs found one defect that reaches a
   user-visible panel, and a lot of noise that does not:

   THE DEFECT. hgFamilyLiftLine reported "measured: no settled samples yet"
   for a family with forty settled samples. liftR is null whenever EITHER side
   of the comparison is empty, so a gate family that agreed on all 40 settled
   trades and never once disagreed has nWith 40, nWithout 0, liftR null — and
   the ledger denied the samples existed. That is the COMMON early state, not
   an edge case: a family that keeps passing has nothing to be measured
   against until the first disagreeing trade settles. It is reachable —
   index.html calls hgRenderFamilyLiftTable and hgRenderScalpFamilyLedger, and
   both build their text through this function.

   THE NOISE. Twenty-six helpers throw on inputs like null or {}. Nearly all
   of them have no live caller at all, or are only reached with an object
   their caller has just constructed. hgGoldSrcFinalize is the one with real
   external callers (goldscalp, goldswing) and at both sites `out` is a local
   object dereferenced on the line above, so the null path cannot be taken.
   None of those are fixed here, because a fix wants a reachable fault, and
   inventing one would be worse than leaving them.

   Run: node tests/test-fixpack-cores.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const CORES = ['fixpack13-core.js', 'fixpack14-core.js', 'fixpack15-core.js',
               'fixpack16-core.js', 'fixpack17-core.js'];

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array,
                Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
                   head: { appendChild(){} }, documentElement: { appendChild(){} },
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', ...CORES]){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();

console.log('== all five cores load and export what they claim ==');
{
  const declared = [];
  for (const f of CORES){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/^G\.(\w+) =/gm)) declared.push([m[1], f]);
  }
  ok(declared.length >= 60, 'the cores declare a real surface (' + declared.length + ' exports)');
  const missing = declared.filter(([n]) => typeof W[n] !== 'function' && W[n] === undefined);
  ok(missing.length === 0, 'every declared export actually landed on the global ('
    + missing.map(([n]) => n).join(', ') + ')');
}

console.log('\n== THE DEFECT: forty settled samples reported as none ==');
{
  const L = W.hgFamilyLiftLine;
  ok(typeof L === 'function', 'hgFamilyLiftLine is callable');

  /* A family that agreed on every settled trade. liftR is null because there
     is nothing to compare against — NOT because there is no evidence. */
  const agreedOnly = L({ nWith: 40, nWithout: 0, liftR: null, effectiveN: 31.5, verdict: 'UNPROVEN' });
  ok(!/no settled samples yet/.test(agreedOnly),
    'a family with 40 settled samples is no longer told it has none');
  ok(/40/.test(agreedOnly), 'the line states how many samples there actually are');
  ok(/none disagreeing/.test(agreedOnly), 'and says what is missing — a trade that settled the other way');

  const disagreedOnly = L({ nWith: 0, nWithout: 15, liftR: null, verdict: 'UNPROVEN' });
  ok(/15/.test(disagreedOnly) && /none agreeing/.test(disagreedOnly), 'the mirror case reads correctly too');

  /* The genuinely empty case must still say so. */
  const empty = L({ nWith: 0, nWithout: 0, liftR: null, verdict: 'UNPROVEN' });
  ok(/no settled samples yet/.test(empty), 'a family with no samples still reports none');

  /* A real measurement is unchanged. */
  const real = L({ nWith: 40, nWithout: 12, liftR: 0.32, effectiveN: 31.5, verdict: 'CARRIES' });
  ok(/\+0\.32R/.test(real), 'a real lift still prints its value');
  ok(/40 agree \/ 12 disagree/.test(real), 'with both sample counts');
  ok(/eff n 31\.5/.test(real), 'and the effective-N correction for overlap');
  ok(/CARRIES/.test(real), 'and the verdict');

  const negative = L({ nWith: 20, nWithout: 20, liftR: -0.11, verdict: 'NOISE' });
  ok(/-0\.11R/.test(negative), 'a NEGATIVE lift is reported as negative, not hidden');

  /* Whatever it is handed, it must not throw — it renders into a panel. */
  for (const bad of [null, undefined, {}, { nWith: 5, nWithout: 3 }, { liftR: NaN, nWith: 4, nWithout: 4 }]){
    let threw = null, outStr = '';
    try { outStr = L(bad); } catch (e) { threw = e; }
    ok(!threw, 'hgFamilyLiftLine(' + JSON.stringify(bad) + ') does not throw');
    ok(typeof outStr === 'string', 'and returns a string');
    ok(!/NaN|undefined/.test(outStr), 'and never renders NaN or undefined into the panel (' + outStr + ')');
  }
}

console.log('\n== the line is reachable from a real panel ==');
{
  /* If this stops being true the fix above is decoration, so it is asserted
     rather than assumed. */
  const f17 = fs.readFileSync(path.join(ROOT, 'fixpack17-core.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sites = (f17.match(/hgFamilyLiftLine\(/g) || []).length;
  ok(sites >= 2, 'hgFamilyLiftLine is used by the renderers inside its own core (' + sites + ' sites)');
  ok(/hgRenderFamilyLiftTable/.test(html), 'index.html renders the swing family lift table');
  ok(/hgRenderScalpFamilyLedger/.test(html), 'index.html renders the scalp family ledger');
}

console.log('\n== hgFamilyLift builds rows in the shape the line expects ==');
{
  const lift = W.hgFamilyLift([], W.hgScalpGateFamilies ? undefined : undefined);
  ok(lift && Array.isArray(lift.familyLift), 'hgFamilyLift on an empty ledger returns a row set');
  ok(lift.nSettled === 0, 'and reports zero settled');
  let checked = 0;
  for (const row of lift.familyLift){
    ok(typeof row.family === 'string' && row.family.length > 0, row.family + ': has a family key');
    ok(typeof row.nWith === 'number' && isFinite(row.nWith), row.family + ': nWith is a real number');
    ok(typeof row.nWithout === 'number' && isFinite(row.nWithout), row.family + ': nWithout is a real number');
    ok(row.liftR === null || (typeof row.liftR === 'number' && isFinite(row.liftR)),
      row.family + ': liftR is a real number or null, never undefined or NaN');
    const line = W.hgFamilyLiftLine(row);
    ok(typeof line === 'string' && !/NaN|undefined/.test(line), row.family + ': renders cleanly (' + line + ')');
    checked++;
  }
  ok(checked > 0, 'rows were actually produced and checked (' + checked + ')');
}

console.log('\n== the helpers with live callers survive their real inputs ==');
{
  /* hgGoldSrcFinalize is the one export in these cores with external callers
     (goldscalp.js and goldswing.js), both passing a locally-built object. */
  ok(typeof W.hgGoldSrcFinalize === 'function', 'hgGoldSrcFinalize is callable');
  const out = { src: { '15m': 'binance-paxg', '4h': 'binance-paxg' }, rows15m: [], rows4h: [] };
  const fin1 = W.hgGoldSrcFinalize(out, '15m');
  ok(fin1.mixed === false, 'one provider across timeframes is not a mixed feed');
  ok(fin1.source === 'binance-paxg', 'and the source is that provider');

  const mixed = W.hgGoldSrcFinalize({ src: { '15m': 'xm-xauusd', '4h': 'binance-paxg' } }, '15m');
  ok(mixed.mixed === true, 'two providers ARE reported as a mixed feed');
  ok(mixed.source === 'xm-xauusd', 'and the legacy timeframe decides the headline source');

  const none = W.hgGoldSrcFinalize({}, '15m');
  ok(none.mixed === false && none.source === null, 'no sources at all reports no source rather than inventing one');

  ok(typeof W.hgGoldSrcAssign === 'function', 'hgGoldSrcAssign is callable');
  ok(W.hgGoldSrcAssign(null, '4h', 'x', 'rows4h', [1]) === null, 'assign on a null target returns it untouched');
  const asg = W.hgGoldSrcAssign({ src: {} }, '4h', 'binance-paxg', 'rows4h', [{ c: 1 }]);
  ok(asg.src['4h'] === 'binance-paxg' && asg.rows4h.length === 1, 'a real assignment lands both source and rows');
  const noRows = W.hgGoldSrcAssign({ src: {} }, '4h', 'binance-paxg', 'rows4h', []);
  ok(!noRows.src['4h'], 'an empty row set does not claim a source it has no data for');
}

console.log('\n== exports with no caller anywhere are named, not silently carried ==');
{
  /* Not a defect — but 16 of 69 exported helpers are referenced by no other
     file, which is why nothing was testing them and why their throw-on-null
     behaviour is not worth chasing. Recorded so the number is visible. */
  const files = fs.readdirSync(ROOT).filter(f => (f.endsWith('.js') || f.endsWith('.html')) && f !== 'sw.js');
  const blob = {};
  for (const f of files) blob[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const declared = [];
  for (const f of CORES){
    for (const m of blob[f].matchAll(/^G\.(\w+) =/gm)) declared.push(m[1]);
  }
  const unreferenced = declared.filter(n =>
    !files.some(f => !CORES.includes(f) && blob[f].includes(n)));
  ok(declared.length === 69, 'the export count is what the header says (' + declared.length + ')');
  ok(unreferenced.length <= 16,
    'unreferenced exports have not grown beyond the 16 recorded here (' + unreferenced.length + ': ' + unreferenced.join(', ') + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FIXPACK CORE TESTS PASSED');
