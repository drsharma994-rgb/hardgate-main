/* hg-v1358: Super Gold does not invent a target, does not crown a split,
   and does not crown a source scan older than 20 minutes. */
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

console.log('== a missing target is not a 2R invention ==');
{
  const row = W.enrichSuperGoldRow(
    { id: 'bare', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2400, stop: 2390, strategy: 'BARE' },
    'clean', { balance: 1000, riskPct: 1 }, { scanner: 'gold-swing' }
  );
  ok(row && row.tp == null && !(row.rr > 0), 'no target and no reward were filled in');
  ok(row.minimalLossPass !== true && W.superGoldDeskPill(row).label !== 'GRADE A PASS', 'a row with no target is not trade-ready');
  ok(row.calc && row.calc.ok === false, 'sizing refuses a row with no target (' + (row.calc && row.calc.reason) + ')');
}

console.log('\n== opposite desks are not crowned ==');
{
  const now = Date.now();
  W.goldscalpScan = function () {
    return { at: now - 60 * 1000, cands: [{ id: 'sc', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2400, stop: 2390, t1: 2420, rr: 2, tally: 8 }] };
  };
  W.goldswingScan = function () {
    return { at: now - 60 * 1000, cands: [{ id: 'sw', sym: 'XAUUSD', dir: 'short', grade: 'A', entry: 2410, stop: 2425, t1: 2380, rr: 2, tally: 8 }] };
  };
  const snap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
  ok(snap.cands.length === 2, 'both rows stay on the board');
  ok(/do not agree/.test(W.superGoldBoardNote(snap)) && /No price was blended/.test(W.superGoldBoardNote(snap)), 'the board says the desks do not agree');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === false && /DO NOT AGREE/.test(ev.reason), 'nothing is crowned (' + ev.reason + ')');
  ok(ev.entry == null && ev.stop == null, 'a split invents no blended price');
  const picked = W.superGoldEvaluate(W, { selectedId: 'sc' });
  ok(picked.ready === true && picked.entry === 2400, 'an opened card can still be read');
}

console.log('\n== a stale source scan is not a fresh pick ==');
{
  const old = Date.now() - 25 * 60 * 60 * 1000;
  W.goldscalpScan = function () {
    return { at: old, cands: [{ id: 'old', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2400, stop: 2390, t1: 2420, rr: 2 }] };
  };
  W.goldswingScan = function () { return null; };
  const hydrated = W.superGoldSyncDesk(W, { balance: 1000, riskPct: 1 });
  ok(hydrated.cands.length === 1, 'the last scan still shows');
  ok(/older than 20 minutes/.test(W.superGoldBoardNote(hydrated)), 'the board says the source is stale');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === false && /SOURCE SCAN STALE/.test(ev.reason), 'a stale scan is not crowned');
}

console.log('\n== the weekend line uses the bar, not the wall clock ==');
{
  var seen = null;
  W.hgInGoldWeekend = function (sec) { seen = sec; return true; };
  const onBar = W.superGoldWeekendLine({ cands: [{ t: 1700000000, dir: 'long', entry: 1, stop: 2 }] });
  ok(seen === 1700000000 && /weekend/i.test(onBar) && !/wall clock/.test(onBar), 'a bar inside the weekend is named from that bar');
  const noBar = W.superGoldWeekendLine({ cands: [{ dir: 'long', entry: 1, stop: 2 }] });
  ok(/wall clock/.test(noBar), 'no bar time says the banner is the wall clock');
  delete W.hgInGoldWeekend;
}

console.log('\n== the pins ==');
{
  const src = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
  ok(!/return \(Number\.isFinite\(rr\) && rr > 0\) \? rr : 2;/.test(src), 'the missing reward is no longer filled in as 2');
  ok(/No target on the source row/.test(src), 'a missing target is named');
  ok(/goldscalpScan/.test(src) && /goldswingScan/.test(src), 'the desk still reads both gold desks');
}

console.log('\ntest-super-gold-v1358: ' + pass + ' passed');
