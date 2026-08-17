/* HARDGATE — the gold stop was truncated short of the level that invalidates it.

   Follow-up to a report that OMNIGOLD and SUPER GOLD kept hitting stops, and
   a correction to my own previous fix.

   v350 changed the CRYPTO stop path (hgStructureStop) and wired OMNIGOLD to
   it. That was not where the gold desks get their stops. GOLD SWING and GOLD
   SCALP build levels in their own functions — __swLevels in goldswing.js and
   __gsLevels in goldind.js — and each hard-capped the stop at 2xATR no matter
   where the structure sat:

     var want = d + 0.25*a;
     if (want > 2*a) want = 2*a;        // truncated, regardless of structure

   Gold routinely travels 2-3 ATR through a session open or a release. Swept
   across structure distances of 0.6 to 4.5 ATR, the cap bound on 63% of
   cases and the stop was placed short of invalidation — inside ordinary
   noise. The note read "stop beyond structure ... capped 2x", which
   describes a stop past the structure while placing one in front of it.

   Truncating a stop does not reduce risk, it relocates it: the loss is
   smaller and far likelier, and the 1.5R/2.5R/4R ladder is then measured
   against a risk that never reached invalidation.

   After: 13% (only the cases past a 4x sanity ceiling for broken structure),
   stops 1.64x wider on average, and the note says what it actually did.

   Run: node tests/test-gold-stop-model.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* Lift each level builder out of its IIFE so it can be exercised directly. */
function extract(file, fn){
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const i = s.indexOf('function ' + fn + '(');
  if (i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for (; j < s.length; j++){
    if (s[j] === '{') d++;
    else if (s[j] === '}'){ d--; if (!d) break; }
  }
  return s.slice(i, j + 1);
}
function boot(src, name){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext('var HG_GOLD_T1_R=1.5,HG_GOLD_T2_R=2.5,HG_GOLD_T3_R=4.0;' + src, ctx, { filename: name });
  return ctx;
}

const SW = extract('goldswing.js', '__swLevels');
const GS = extract('goldind.js', '__gsLevels');

console.log('== both gold level builders were found ==');
{
  ok(!!SW, 'goldswing __swLevels extracted');
  ok(!!GS, 'goldind __gsLevels extracted');
  ok(/GOLD_STOP_MAX_ATR/.test(SW), 'the swing builder has a named sanity ceiling, not a bare 2x');
  ok(/GOLD_STOP_MAX_ATR/.test(GS), 'and so does the scalp builder');
  ok(!/if \(want > 2\*a4\) want = 2\*a4;/.test(SW), 'the hard 2x truncation is gone from swing');
  ok(!/if \(want > 2\*a15\) want = 2\*a15;/.test(GS), 'and from scalp');
}

console.log('\n== THE DEFECT: the stop now clears the structure ==');
{
  const now = boot(SW + ';this.__f=__swLevels;', 'sw-now');
  const old = boot(SW.replace(/if \(want > GOLD_STOP_MAX_ATR\*a4\) want = GOLD_STOP_MAX_ATR\*a4;/,
                              'if (want > 2*a4) want = 2*a4;') + ';this.__f=__swLevels;', 'sw-old');
  const entry = 3350, a4 = 12;

  let oldShort = 0, newShort = 0, widened = [], n = 0;
  for (let k = 0; k < 400; k++){
    const structAtr = 0.6 + (k % 40) * 0.1;              /* 0.6 .. 4.5 ATR */
    const structStop = entry - structAtr * a4;           /* long */
    const o = old.__f('long', entry, a4, structStop, null);
    const w = now.__f('long', entry, a4, structStop, null);
    n++;
    if ((entry - o.stop) < structAtr * a4) oldShort++;
    if ((entry - w.stop) < structAtr * a4) newShort++;
    if ((entry - w.stop) > (entry - o.stop)) widened.push((entry - w.stop) / (entry - o.stop));
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  ok(n === 400, 'the sweep ran over 400 structure distances');
  ok(oldShort > 200, 'BEFORE: the stop sat short of invalidation on ' + oldShort + ' of ' + n
    + ' (' + (oldShort / n * 100).toFixed(0) + '%)');
  ok(newShort < oldShort / 3, 'AFTER: only ' + newShort + ' (' + (newShort / n * 100).toFixed(0)
    + '%), and those are past the sanity ceiling');
  ok(widened.length > 200, 'the stop widened on ' + widened.length + ' cases');
  ok(avg(widened) > 1.4, 'by ' + avg(widened).toFixed(2) + 'x on average');
}

console.log('\n== a stop that clears structure is what "behind" means ==');
{
  const now = boot(SW + ';this.__f=__swLevels;', 'sw2');
  const entry = 3350, a4 = 12;
  for (const structAtr of [0.8, 1.5, 2.4, 3.2, 3.9]){
    const structStop = entry - structAtr * a4;
    const r = now.__f('long', entry, a4, structStop, null);
    ok((entry - r.stop) >= structAtr * a4 - 1e-9,
      'structure at ' + structAtr + 'xATR: the stop is behind it (' + ((entry - r.stop) / a4).toFixed(2) + 'xATR)');
  }
  /* A short is the mirror. */
  const rs = now.__f('short', entry, a4, entry + 3.0 * a4, null);
  ok((rs.stop - entry) >= 3.0 * a4 - 1e-9, 'and a short stop clears structure above entry');
}

console.log('\n== the note describes what it actually did ==');
{
  const now = boot(SW + ';this.__f=__swLevels;', 'sw3');
  const entry = 3350, a4 = 12;
  const normal = now.__f('long', entry, a4, entry - 3.2 * a4, null);
  ok(/BEHIND structure/.test(normal.stopNote), 'a cleared stop says BEHIND (' + normal.stopNote + ')');
  ok(!/capped 2×/.test(normal.stopNote), 'and no longer claims a cap that is not applied');

  const ceiling = now.__f('long', entry, a4, entry - 9 * a4, null);
  ok(/sanity ceiling/.test(ceiling.stopNote), 'a ceiling case says so plainly (' + ceiling.stopNote + ')');
  ok(/structure may be broken/.test(ceiling.stopNote), 'and names why the structure is not being trusted');

  const floor = now.__f('long', entry, a4, entry - 0.5 * a4, null);
  ok(/1\.5×ATR/.test(floor.stopNote), 'a very close structure still respects the 1.5xATR floor');
  ok((entry - floor.stop) >= 1.5 * a4 - 1e-9, 'so the stop is never tighter than the floor');
}

console.log('\n== the R ladder is measured against the real risk ==');
{
  const now = boot(SW + ';this.__f=__swLevels;', 'sw4');
  const entry = 3350, a4 = 12;
  for (const structAtr of [1.0, 2.5, 3.8]){
    const r = now.__f('long', entry, a4, entry - structAtr * a4, null);
    const risk = entry - r.stop;
    ok(Math.abs((r.t1 - entry) / risk - 1.5) < 1e-9, structAtr + 'xATR: T1 is 1.5R of the ACTUAL risk');
    ok(Math.abs((r.t2 - entry) / risk - 2.5) < 1e-9, structAtr + 'xATR: T2 is 2.5R');
    ok(Math.abs((r.t3 - entry) / risk - 4.0) < 1e-9, structAtr + 'xATR: T3 is 4R');
    ok(Math.abs(r.rr - 1.5) < 1e-9, structAtr + 'xATR: the reported rr matches T1 (' + r.rr.toFixed(2) + ')');
  }
}

console.log('\n== the scalp builder got the same treatment ==');
{
  const now = boot(GS + ';this.__f=__gsLevels;', 'gs');
  const entry = 3350, a15 = 3;
  const r = now.__f('long', entry, a15, entry - 3.0 * a15, null);
  ok((entry - r.stop) >= 3.0 * a15 - 1e-9, 'the scalp stop clears structure too');
  ok(/BEHIND structure/.test(r.stopNote), 'with the same honest note');
  const ceil = now.__f('long', entry, a15, entry - 8 * a15, null);
  ok(/sanity ceiling/.test(ceil.stopNote), 'and its own ceiling (' + ceil.stopNote.slice(-45) + ')');
  ok((entry - ceil.stop) <= 3.5 * a15 + 1e-9, 'capped at 3.5xATR for the faster timeframe');
}

console.log('\n== degenerate input still behaves ==');
{
  const now = boot(SW + ';this.__f=__swLevels;', 'sw5');
  const entry = 3350, a4 = 12;
  const noStruct = now.__f('long', entry, a4, NaN, null);
  ok((entry - noStruct.stop) === 1.5 * a4, 'no structure falls back to the 1.5xATR floor');
  const wrongSide = now.__f('long', entry, a4, entry + 5, null);
  ok((entry - wrongSide.stop) === 1.5 * a4, 'a structure on the wrong side is ignored, not inverted');
  ok(wrongSide.stop < entry, 'and the stop still sits below entry for a long');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLD STOP MODEL TESTS PASSED');
