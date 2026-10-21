/* The fallback engine fills a setup only when goldind is absent.
   It does not invent an ATR, and an unread spread stays unread. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
const code = fs.readFileSync(path.join(root, 'gold_confluence_engine.js'), 'utf8');

function boot(extra) {
  const ctx = { Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'gold_confluence_engine.js' });
  return ctx;
}

function rise(n) {
  const rows = [];
  let p = 2600;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = +(o + 0.8).toFixed(2);
    rows.push({ t: 1760000000 + i * 900, o, h: +(c + 0.3).toFixed(2), l: +(o - 0.2).toFixed(2), c, v: 1000 });
    p = c;
  }
  const prev = rows[n - 2];
  rows[n - 2] = { t: prev.t, o: prev.o, h: prev.o, l: +(prev.o - 0.6).toFixed(2), c: +(prev.o - 0.4).toFixed(2), v: 900 };
  return rows;
}

const ctx = boot();
assert.equal(ctx.hgCfBuildSetup(rise(10), {}, { dir: 'BULL' }), null, 'thin tape');
const flat = Array.from({ length: 24 }, (_, i) => ({ t: i, o: 2650, h: 2650, l: 2650, c: 2650 }));
assert.equal(ctx.hgCfBuildSetup(flat, {}, { dir: 'BULL', macroRead: true }), null, 'no range is not an ATR');

const tape = rise(30);
const bare = ctx.hgCfBuildSetup(tape, {}, { dir: 'BULL', macroRead: true });
assert.ok(bare, 'a rising tape with a flip and a macro read forms');
assert.equal(bare.entry, tape[tape.length - 1].c);
assert.equal(bare.spread, null);
assert.equal(bare.netRr, null);
assert.match(bare.note, /was not read/);
assert.ok(bare.stop < bare.entry && bare.t1 > bare.entry && bare.t2 > bare.t1);

const priced = boot({
  goldspotState: () => ({ spot: 2652.8, xm: 2652.5 })
});
const costed = priced.hgCfBuildSetup(tape, {}, { dir: 'BULL', macroRead: true });
assert.equal(costed.spread, 0.3);
assert.ok(costed.netRr < costed.rr, 'measured spread reduces net R');

const locked = ctx.hgCfBuildSetup(tape, { newsLock: true }, { dir: 'BULL', macroRead: true });
assert.ok(locked.score < bare.score, 'a news lock does not take the macro point');

const day = ctx.hgCfDaySwings(rise(12));
assert.equal(day.ok, false);
const swings = ctx.hgCfDaySwings(tape);
assert.equal(swings.ok, true);
assert.equal(swings.setups.length, 1);
assert.equal(swings.setups[0].side, 'long');
assert.equal(swings.setups[0].crowned, swings.setups[0].rsi >= 52);

const both = ctx.hgCfUltimateConfluence(
  { dir: 'long', score: 3, entry: 2650, stop: 2640, t1: 2670 },
  { dir: 'long', score: 4, entry: 2652, stop: 2642, t1: 2672 }
);
assert.equal(both.agreement, true);
assert.equal(both.entry, 2651);
assert.equal(both.stop, 2641);
assert.equal(both.t1, 2671);

const half = ctx.hgCfUltimateConfluence(
  { dir: 'long', score: 3, entry: 2650, stop: 2640, t1: 2670 },
  { dir: 'long', score: 3 }
);
assert.equal(half.entry, null, 'a missing price is not averaged with zero');

const split = ctx.hgCfUltimateConfluence(
  { dir: 'long', score: 3, entry: 2650, stop: 2640, t1: 2670 },
  { dir: 'short', score: 3, entry: 2650, stop: 2660, t1: 2630 }
);
assert.equal(split.direction, null);
assert.equal(split.entry, null);
assert.equal(split.grade, 'WATCH');

console.log('GOLD CONFLUENCE FALLBACK PASSED');
