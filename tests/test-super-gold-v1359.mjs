/* hg-v1359: Super Gold crowns only when both desks are on the same side.
   A missing desk is unread. Only that one pick is a forward ticket. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

const ctx = {
  console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.document = { head: { appendChild: function () {} }, createElement: function () { return { id: '', textContent: '' }; } };
vm.createContext(ctx);
for (const f of ['goldind.js', 'supersetup.js', 'super-gold.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;
const now = Date.now();

function row(id, dir, entry, tally) {
  return { id: id, sym: 'XAUUSD', dir: dir, grade: 'A', entry: entry, stop: entry - 10, t1: entry + 20, rr: 2, tally: tally };
}

console.log('== one desk is not a merged pick ==');
{
  W.goldscalpScan = function () { return { at: now, cands: [row('sc', 'long', 2400, 9)] }; };
  W.goldswingScan = function () { return null; };
  const snap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
  ok(snap.cands.length === 1, 'the scalp row still shows');
  ok(/GOLD SWING has no fresh scan/.test(W.superGoldBoardNote(snap)), 'the missing desk is named (' + W.superGoldBoardNote(snap) + ')');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === false && /Unread is not agreement/.test(ev.reason), 'an unread desk is not crowned');
}

console.log('\n== a desk that stood aside is not agreement ==');
{
  W.goldscalpScan = function () { return { at: now, cands: [row('sc', 'long', 2400, 9)] }; };
  W.goldswingScan = function () { return { at: now, cands: [] }; };
  const snap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
  ok(/single desk is not a merged pick/.test(W.superGoldBoardNote(snap)), 'an empty fresh desk is named');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === false && ev.entry == null, 'nothing is crowned and no price is invented');
}

console.log('\n== both desks on the same side can be crowned ==');
{
  W.goldscalpScan = function () { return { at: now, cands: [row('sc', 'long', 2400, 9)] }; };
  W.goldswingScan = function () { return { at: now, cands: [row('sw', 'long', 2410, 4)] }; };
  const snap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
  ok(snap.cands.length === 2 && W.superGoldBoardNote(snap) === '', 'agreement adds no hold line');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === true && ev.entry === 2400 && ev.stop === 2390, 'the higher tally keeps its own stop (' + ev.entry + ')');
}

console.log('\n== the forward ticket is only the crowned row ==');
{
  const recorded = [];
  W.hgFwdRecordScan = function (pool, tf, rows) { recorded.push({ pool: pool, rows: rows }); };
  const fresh = {
    at: now, sourceAt: now, scanAt: now,
    audit: { venues: ['gold-scalp', 'gold-swing'] },
    cands: [
      { id: 'a', sym: 'XAUUSD', dir: 'long', scanner: 'gold-scalp', entry: 2400, stop: 2390, t1: 2420, minimalLossPass: true },
      { id: 'b', sym: 'XAUUSD', dir: 'long', scanner: 'gold-swing', entry: 2410, stop: 2400, t1: 2430, minimalLossPass: true }
    ]
  };
  W.mergePublishSuperGoldSnap(fresh);
  ok(recorded.length === 1 && recorded[0].pool === 'SUPER:GOLD', 'the pool is still recorded');
  const tickets = recorded[0].rows.filter(function (r) { return r.ticket === true; });
  ok(tickets.length === 1 && tickets[0].entry === 2400, 'only the first crowned row is a ticket');
  const split = {
    at: now, sourceAt: now,
    cands: [
      { id: 'c', sym: 'XAUUSD', dir: 'long', scanner: 'gold-scalp', entry: 2400, stop: 2390, t1: 2420, minimalLossPass: true },
      { id: 'd', sym: 'XAUUSD', dir: 'short', scanner: 'gold-swing', entry: 2410, stop: 2420, t1: 2390, minimalLossPass: true }
    ]
  };
  recorded.length = 0;
  W.mergePublishSuperGoldSnap(split);
  ok(recorded[0].rows.length === 2 && recorded[0].rows.every(function (r) { return r.ticket === false; }), 'a split records no ticket');
}

console.log('\ntest-super-gold-v1359: ' + pass + ' passed');
