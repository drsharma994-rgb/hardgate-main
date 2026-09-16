/* HARDGATE — one geometry rule, rendered once, with a mark that is real.

   v748 put hgPlanMarketGeometry in the shared layer and then wired it into
   eight gold desks by copying the same twelve render lines into each of
   them. This covers the two pieces that stop that happening thirty more
   times for the rest of the book:

     hgPlanGeometryNote   (hg-plan.js) — the verdict as markup, once
     hgMpMarkOf           (plans.js)   — where price NOW comes from

   The second is the one worth being paranoid about. A missing mark costs a
   verdict. A WRONG mark buys a confident wrong verdict — a card shouting
   TARGET BEHIND PRICE at a perfectly live plan — and that is strictly worse
   than silence. So the field list is short on purpose and the tests below
   spend most of their time proving what is NOT read.

   Run: node tests/test-plan-geometry-shared.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const ctx = { console, Math, isFinite, isNaN, parseFloat, Number, String, Object, Array, JSON, Date, RegExp };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'plans.js', 'hg-plan.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const note = ctx.hgPlanGeometryNote;
const lineHtml = ctx.hgPlanGeometryLineHtml;
const markOf = ctx.hgMpMarkOf;
const normalize = ctx.hgNormalizeSetupRow;

/* the plan that was reported from the desk, and is now the fixture */
const DEAD = { dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 };
const DEAD_MARK = 4282.70;

console.log('== the note carries the verdict, not a second copy of the rule ==');
{
  const n = note(DEAD, DEAD_MARK);
  ok(n && n.code === 'target-crossed', 'the reported plan still reads target-crossed through the note');
  ok(n.label === 'TARGET BEHIND PRICE', 'and is labelled in words, not in a code');
  ok(n.mark === DEAD_MARK, 'and reports the mark it judged against');
  ok(/between the market and the entry/.test(n.why), 'and keeps the why the shared rule wrote');
  ok(n.html.indexOf('TARGET BEHIND PRICE') > -1, 'the html says it too');

  const breach = note({ dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 }, 4330.00);
  ok(breach && breach.label === 'STOP ALREADY BREACHED', 'a breached stop gets its own label');
}

console.log('\n== nothing to say renders nothing, never an empty box ==');
{
  ok(note(DEAD, 4320.00) === null, 'a live plan gets no note at all');
  ok(note(DEAD, NaN) === null, 'an unknown mark gets no note — not a guess either way');
  ok(note(DEAD, 0) === null, 'a zero mark is not a price and gets no note');
  ok(note(null, DEAD_MARK) === null, 'no plan, no note');
  ok(note({ dir: 'sideways', entry: 1, stop: 2, t1: 3 }, 1.5) === null, 'an unknown direction is unjudgeable, so silent');
  ok(lineHtml(DEAD, 4320.00) === '', 'and the line helper returns empty string, which concatenates cleanly');
  ok(lineHtml(DEAD, DEAD_MARK).length > 0, 'while a dead plan does produce a line');
}

console.log('\n== the caller keeps its own look ==');
{
  const n = note(DEAD, DEAD_MARK, { cls: 'gu-gate', style: 'margin-top:4px' });
  ok(/class="gu-gate"/.test(n.html), 'the class the desk passes is the class that renders');
  ok(/style="margin-top:4px"/.test(n.html), 'and so is its style');
  const d = note(DEAD, DEAD_MARK);
  ok(/class="note warn"/.test(d.html), 'with the app default when the desk passes nothing');
  const evil = note(DEAD, DEAD_MARK, { cls: '"><script>x()</script>' });
  ok(evil.html.indexOf('<script>') === -1, 'a class is escaped, not trusted');
}

console.log('\n== where price NOW comes from ==');
{
  const nest = {};
  ok(markOf({ mark: 4282.70 }, {}, nest) === 4282.70, 'mark is read — the convention 38 files already use');
  ok(markOf({ pxNow: 101 }, {}, nest) === 101, 'pxNow is read');
  ok(markOf({ livePx: 102 }, {}, nest) === 102, 'livePx is read');
  ok(markOf({ lastPx: 103 }, {}, nest) === 103, 'lastPx is read');
  ok(markOf({ spot: 104 }, {}, nest) === 104, 'spot is read');
  ok(markOf({}, { mark: 105 }, nest) === 105, 'a nested plan/setup mark is read');
  ok(markOf({ mark: 1 }, { mark: 2 }, { mark: 3 }) === 1, 'and the outermost wins when several disagree');
}

console.log('\n== what is deliberately NOT read ==');
{
  /* `price` means the ENTRY price about as often as the live one in this
     repo. Reading it would turn every such row into a confident wrong
     verdict, so it stays off the list — this test is the reason why. */
  ok(!isFinite(markOf({ price: 4316.20 }, {}, {})), 'price is not a mark — it is the entry as often as not');
  ok(!isFinite(markOf({ entry: 4316.20 }, {}, {})), 'an entry is certainly not a mark');
  ok(!isFinite(markOf({ t1: 4296.51, stop: 4326.05 }, {}, {})), 'neither is a target or a stop');
  ok(!isFinite(markOf({ mark: 0 }, {}, {})), 'zero is not a price');
  ok(!isFinite(markOf({ mark: -5 }, {}, {})), 'nor is a negative one');
  ok(!isFinite(markOf({ mark: 'n/a' }, {}, {})), 'nor is a string that is not a number');
  ok(!isFinite(markOf({}, {}, {})), 'and an empty row yields NaN, which renders no verdict');
}

console.log('\n== the last close is the last resort, not the first choice ==');
{
  const bars = [{ c: 90 }, { c: 95 }, { c: 99 }];
  ok(markOf({ rows: bars }, {}, {}) === 99, 'the last candle close stands in when no price field exists');
  ok(markOf({ candles: [{ close: 88 }] }, {}, {}) === 88, 'close is accepted as well as c');
  ok(markOf({ mark: 42, rows: bars }, {}, {}) === 42, 'but a real mark always outranks the bars');
  ok(!isFinite(markOf({ rows: [] }, {}, {})), 'an empty bar array yields nothing');
  ok(!isFinite(markOf({ rows: [{ o: 1, h: 2 }] }, {}, {})), 'and a bar with no close yields nothing');
}

console.log('\n== the mark survives the whitelist and reaches the card ==');
{
  /* this is the bug the whole change exists to fix: the row normalizer is a
     whitelist, and every price-now field fell outside it */
  const row = normalize({ sym: 'XAUUSD', dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51, mark: DEAD_MARK });
  ok(row, 'the reported plan normalizes to a row');
  ok(row.mark === DEAD_MARK, 'and the row now carries the mark it used to drop');

  const g = note({ dir: row.dir, entry: row.entry, stop: row.stop, t1: row.t1 }, row.mark);
  ok(g && g.code === 'target-crossed', 'so a shared renderer holding only the row can reach the verdict');

  const noMark = normalize({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110 });
  ok(noMark && !('mark' in noMark), 'a row with no knowable mark carries no mark key at all — absent is not zero');

  const fromBars = normalize({ sym: 'ETHUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, rows: [{ c: 98 }] });
  ok(fromBars.mark === 98, 'and a row that only has bars still gets its mark from the last close');
  ok(!('rows' in fromBars), 'while the bars themselves stay out of the row, which desks JSON-clone into state');
}

console.log('\n== a mark equal to the entry cannot manufacture an alarm ==');
{
  /* cryptogates.js falls back to `m.mark || m.entry`, so this shape reaches
     the renderer for real. It must read as fine, not as dead. */
  const g = note({ dir: 'long', entry: 100, stop: 95, t1: 110 }, 100);
  ok(g === null, 'mark === entry is silent on a long');
  const s = note({ dir: 'short', entry: 100, stop: 105, t1: 90 }, 100);
  ok(s === null, 'and on a short');
}

console.log('\n' + passed + ' passed, 0 failed');
