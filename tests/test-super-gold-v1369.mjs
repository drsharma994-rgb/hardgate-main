/* hg-v1369: with no structure nearby, the entry uses the 61.8-70.5 band and VWAP.
   Structure still wins when it is close. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

function boot() {
  const ctx = {
    console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat,
    setTimeout, Promise
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { head: { appendChild: function () {} }, createElement: function () { return { id: '', textContent: '' }; } };
  vm.createContext(ctx);
  for (const f of ['goldind.js', 'supersetup.js', 'super-gold.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

function swingRows() {
  const rows = [
    { o: 2690, h: 2700, l: 2690, c: 2695, v: 1 },
    { o: 2605, h: 2605, l: 2600, c: 2602, v: 1 }
  ];
  for (let i = 0; i < 22; i++) rows.push({ o: 2682, h: 2690, l: 2680, c: 2685, v: 10 });
  return rows;
}

const W = boot();
const intel = { volRegime: { ok: true, regime: 'NORMAL', atrNow: 14 }, structure: { ok: true, items: [] }, rows15: swingRows() };

console.log('== below the band snaps to the 70.5% edge ==');
{
  const prec = W.sgPrecisionGoldLevels({ dir: 'long', entry: 2624, stop: 2610, t1: 2660 }, intel);
  ok(prec.ok && prec.unread !== true, 'the tape was measured');
  ok(prec.entry === 2629.5, 'entry is the 70.5% edge (2629.50), got ' + prec.entry);
  ok(/OTE 61\.8-70\.5/.test(prec.entryReason) && !/VWAP/.test(prec.entryReason), 'the reason names the band, not VWAP (' + prec.entryReason + ')');
  ok(prec.rawEntry === 2624, 'the desk entry is kept beside it');
}

console.log('\n== inside the band, VWAP pulls the entry ==');
{
  const rows = [
    { o: 2690, h: 2700, l: 2690, c: 2695, v: 1 },
    { o: 2605, h: 2610, l: 2600, c: 2605, v: 1 }
  ];
  for (let i = 0; i < 22; i++) rows.push({ o: 2630, h: 2636, l: 2628, c: 2632, v: 100 });
  const prec = W.sgPrecisionGoldLevels(
    { dir: 'long', entry: 2634, stop: 2620, t1: 2660 },
    { volRegime: { ok: true, regime: 'NORMAL', atrNow: 4 }, structure: { ok: true, items: [] }, rows15: rows }
  );
  ok(prec.entry === 2633.01, 'entry is the midpoint of the desk price and VWAP, got ' + prec.entry);
  ok(/with VWAP/.test(prec.entryReason), 'the reason names VWAP (' + prec.entryReason + ')');
}

console.log('\n== structure still beats the band ==');
{
  const prec = W.sgPrecisionGoldLevels(
    { dir: 'long', entry: 2650.5, stop: 2640, t1: 2669.2 },
    { volRegime: { ok: true, regime: 'NORMAL', atrNow: 4 }, structure: { ok: true, items: [{ label: '15m OB', px: 2650 }] }, rows15: swingRows() }
  );
  ok(prec.entry === 2650.25, 'a close order block still sets 2650.25, got ' + prec.entry);
}

console.log('\ntest-super-gold-v1369: ' + pass + ' passed');
