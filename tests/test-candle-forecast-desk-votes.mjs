/* HARDGATE — hg-v1317: EVERY GOLD DESK VOTES on CANDLE FORECAST.

   WHAT IT IS. The confluence's four families read SHARED series. This layer asks the
   more direct question: what did each gold TAB's own desk engine actually FORM on the
   same tape? Those engines ARE the desks. Until now CANDLE FORECAST never asked them,
   so it could print a long while GOLD SCALP was forming shorts on the identical bars.

   THE INVARIANTS THIS GUARD PROTECTS
     1. A desk that formed NOTHING reads unread. Never agreement. Most desks form
        nothing on any given tape by design, and counting silence as a quorum would
        manufacture a majority out of nothing — the failure this row exists to stop.
     2. ONE DESK COUNTS ONCE, however many candidates it minted, so a chatty engine
        cannot outvote a quiet one (hg-v966: no unmeasured weight).
     3. A desk's side is what it FORMED, compared to the candle read's direction.
     4. It fails open: a missing or throwing engine is named, and the confluence
        survives without it.
     5. It is a READ — nothing in it gates, scores or prices.

   Run: node tests/test-candle-forecast-desk-votes.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('goldind.js');

function liftFn(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name);
  let depth = 0, i = text.indexOf('{', start);
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/'){ while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*'){ i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`'){ const q = c; i++; while (i < text.length && text[i] !== q){ if (text[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
function sandboxWith(desks) {
  const ctx = {
    console, Math, Date, JSON, Number, String, Object, Array, RegExp, Error, TypeError, Promise,
    isFinite, isNaN, parseFloat, parseInt, Infinity, NaN,
    document: { createElement: () => ({ style: {}, innerHTML: '', appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }), getElementById: () => null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(liftFn(SRC, 'hgCfDeskVotes'), ctx, { filename: 'lifted:hgCfDeskVotes' });
  for (const [k, v] of Object.entries(desks || {})) ctx[k] = v;
  return ctx;
}
const bar = (o, h, l, c) => ({ o, h, l, c, v: 1000, t: 0 });
const rows = [];
for (let i = 0; i < 80; i++) { const c = 2300 + (i % 3) * 0.5; rows.push(bar(c - 0.3, c + 0.7, c - 0.8, c)); }

console.log('== 1) a desk that formed NOTHING reads unread — never agreement ==');
{
  const ctx = sandboxWith({
    goldScalpSetups: () => [],                                  /* formed nothing */
    goldSwingSetups: () => [],                                  /* formed nothing */
    goldPineScan: () => null,
    ganeshGoldState: () => null
  });
  const dv = ctx.hgCfDeskVotes(rows, {}, 'BULL');
  ok(dv.with_ === 0, 'no desk voted WITH when none formed a side (with_=' + dv.with_ + ')');
  ok(dv.against === 0, 'and none voted AGAINST');
  ok(dv.unread === dv.desks.length && dv.unread >= 4, 'all four desks read unread (' + dv.unread + ')');
  ok(/no desk formed a side/.test(dv.why), 'and the summary says so rather than implying agreement: ' + dv.why);
}

console.log('\n== 2) a desk votes the side it FORMED, compared to the candle read ==');
{
  const longs = [{ dir: 'long' }, { dir: 'long' }, { dir: 'long' }];
  const shorts = [{ dir: 'short' }, { dir: 'short' }];
  let ctx = sandboxWith({ goldScalpSetups: () => longs, goldSwingSetups: () => [], goldPineScan: () => null, ganeshGoldState: () => null });
  let dv = ctx.hgCfDeskVotes(rows, {}, 'BULL');
  let scalp = dv.desks.find(d => d.desk === 'GOLD SCALP');
  ok(scalp.lean === true, 'three longs vote WITH a BULL candle read');
  ok(scalp.long === 3 && scalp.short === 0, 'and the desk carries its own tallies (' + scalp.long + '/' + scalp.short + ')');

  ctx = sandboxWith({ goldScalpSetups: () => longs, goldSwingSetups: () => [], goldPineScan: () => null, ganeshGoldState: () => null });
  dv = ctx.hgCfDeskVotes(rows, {}, 'BEAR');
  scalp = dv.desks.find(d => d.desk === 'GOLD SCALP');
  ok(scalp.lean === false, 'and the SAME three longs vote AGAINST a BEAR candle read');

  ctx = sandboxWith({ goldScalpSetups: () => shorts, goldSwingSetups: () => [], goldPineScan: () => null, ganeshGoldState: () => null });
  dv = ctx.hgCfDeskVotes(rows, {}, 'BEAR');
  ok(dv.desks.find(d => d.desk === 'GOLD SCALP').lean === true, 'two shorts vote WITH a BEAR read');
}

console.log('\n== 3) ONE DESK COUNTS ONCE — a chatty engine cannot outvote a quiet one ==');
{
  const many = [];
  for (let i = 0; i < 50; i++) many.push({ dir: 'long' });
  const ctx = sandboxWith({
    goldScalpSetups: () => many,                    /* 50 candidates */
    goldSwingSetups: () => [{ dir: 'short' }],      /* 1 candidate */
    goldPineScan: () => null, ganeshGoldState: () => null
  });
  const dv = ctx.hgCfDeskVotes(rows, {}, 'BULL');
  ok(dv.with_ === 1 && dv.against === 1,
    'fifty candidates from one desk count as ONE vote, exactly as one does (' + dv.with_ + ' with / ' + dv.against + ' against)');
  ok(dv.checked === 4, 'and every desk is still represented (' + dv.checked + ')');
}

console.log('\n== 4) an exactly split desk is undecided, not a coin toss ==');
{
  const ctx = sandboxWith({
    goldScalpSetups: () => [{ dir: 'long' }, { dir: 'short' }],
    goldSwingSetups: () => [], goldPineScan: () => null, ganeshGoldState: () => null
  });
  const dv = ctx.hgCfDeskVotes(rows, {}, 'BULL');
  ok(dv.desks.find(d => d.desk === 'GOLD SCALP').lean === null,
    'a desk carrying one long and one short abstains rather than picking a side');
}

console.log('\n== 5) it fails open — a missing or throwing engine is named, never fatal ==');
{
  const ctx = sandboxWith({});   /* no desks loaded at all */
  const dv = ctx.hgCfDeskVotes(rows, {}, 'BULL');
  ok(dv.desks.length >= 4, 'every desk is still reported (' + dv.desks.length + ')');
  ok(dv.desks.every(d => d.lean === null), 'and all read unread');
  ok(dv.desks.some(d => /not loaded/.test(d.why)), 'a missing engine is named as not loaded');
  ok(/no desk formed a side/.test(dv.why), 'and the summary is honest about it');

  const ctx2 = sandboxWith({
    goldScalpSetups: () => { throw new Error('feed down'); },
    goldSwingSetups: () => [], goldPineScan: () => null, ganeshGoldState: () => null
  });
  const dv2 = ctx2.hgCfDeskVotes(rows, {}, 'BULL');
  const s = dv2.desks.find(d => d.desk === 'GOLD SCALP');
  ok(s.lean === null, 'a throwing engine reads unread');
  ok(/feed down/.test(s.why), 'and its CAUSE is reported, not a bare "threw": ' + s.why);

  let threw = false;
  try { ctx.hgCfDeskVotes(null, {}, 'BULL'); } catch (e) { threw = true; }
  ok(!threw, 'null rows never throw');
  const noDir = ctx.hgCfDeskVotes(rows, {}, 'NEUTRAL');
  ok(noDir.desks.length === 0 && /NEUTRAL|no directional/.test(noDir.why),
    'a NEUTRAL candle read drives no desk vote (' + noDir.why + ')');
}

console.log('\n== 6) it is a READ, wired as its own family, and gates nothing ==');
{
  ok(/window\.hgCfDeskVotes\s*=\s*hgCfDeskVotes/.test(SRC), 'the desk reader is exported');
  const conf = liftFn(SRC, 'hgCfConfluence');
  ok(/'desks'/.test(conf), 'the confluence counts desks as a family');
  ok(/voter\('desks'/.test(conf), 'and each desk becomes a named voter');
  ok(/hgCfDeskVotes\(rows, opts, f\.dir\)/.test(conf), 'driven on the tape and the candle direction');
  ok(!/score|weight|points/i.test(liftFn(SRC, 'hgCfDeskVotes').replace(/\/\*[\s\S]*?\*\//g, ' ')),
    'and the desk reader contains no score, weight or points');
  const tab = read('gold-candle-forecast.js');
  ok(/GOLD DESKS ON THIS TAPE/.test(tab), 'the tab prints the desk block');
  ok(/formed nothing/.test(tab), 'and states "formed nothing" rather than leaving it blank');
  ok(/hg-v1317/.test(SRC), 'the pack is identified in the source (hg-v956 textual pin)');
}

console.log('\ntest-candle-forecast-desk-votes: ' + pass + ' passed, 0 failed');
