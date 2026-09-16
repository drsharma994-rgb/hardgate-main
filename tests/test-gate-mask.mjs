/* HARDGATE — a gate tuned on this walk, re-testable against it.

   Several gates were pointed by splitting the walk on their own verdict.
   The participation gate was re-pointed on exactly that — "SCALP passed
   27.7% (n=2856), vetoed 35.2% (n=1737), z = -5.38" — and it is a
   legitimate way to find a mis-pointed gate.

   It is also the method that produced the stop floor's "-9,768R ->
   -1,092R", which turned out to be the lower bound of the unprovable-fill
   interval and reverses sign at the upper. Every split of that shape needs
   re-running across the interval, and NOT ONE of them could be, because
   the artifact recorded outcomes and never verdicts. Those numbers had to
   be taken on trust, and the one case that was re-tested did not survive.

   The walk now records, per row, which gates passed and which failed.

   The case this file cares about most is the third one: a gate that did
   not judge a row. Absent and UNCHECKED both mean "this row says nothing
   about that gate", and counting them as failures is how a gate gets
   re-pointed on rows it never looked at.

   Run: node tests/test-gate-mask.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateKeyOrder, encodeGateMask, decodeGateVerdict,
         splitByGate, gateCoverage } from '../lib/gate-mask.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const g = (key, pass) => ({ key, pass });

console.log('== the key order is the ledger, not the arrival order ==');
{
  const a = gateKeyOrder(['trend', 'cost-drag', 'vol-alive', 'trend']);
  const b = gateKeyOrder(['vol-alive', 'trend', 'cost-drag']);
  ok(a.length === 3, 'duplicates collapse');
  ok(a.join() === b.join(), 'and two runs seeing the same keys agree on the order');
  ok(a.join() === 'cost-drag,trend,vol-alive', 'sorted, so it changes only when the ledger does');
  ok(gateKeyOrder([]).length === 0 && gateKeyOrder(null).length === 0, 'and nothing yields nothing');
}

console.log('\n== a verdict survives the round trip ==');
{
  const order = gateKeyOrder(['trend', 'vol-alive', 'cost-drag', 'measured-edge']);
  const row = {};
  const m = encodeGateMask([g('trend', true), g('vol-alive', false),
                            g('measured-edge', null)], order);
  row.gatesPass = m.pass; row.gatesFail = m.fail;

  ok(decodeGateVerdict(row, 'trend', order) === true, 'a pass reads back as pass');
  ok(decodeGateVerdict(row, 'vol-alive', order) === false, 'a fail reads back as fail');
}

console.log('\n== ABSENT IS NOT FALSE — the case this exists for ==');
{
  const order = gateKeyOrder(['trend', 'vol-alive', 'cost-drag', 'measured-edge']);
  const m = encodeGateMask([g('trend', true), g('measured-edge', null)], order);
  const row = { gatesPass: m.pass, gatesFail: m.fail };

  ok(decodeGateVerdict(row, 'measured-edge', order) === null,
     'a gate that ran and reported UNCHECKED reads null, not false');
  ok(decodeGateVerdict(row, 'cost-drag', order) === null,
     'a gate that never pushed on this row reads null, not false');
  /* if either read as false, a split would re-point a gate using rows it
     never judged — which is the failure this whole file is about */
  ok(decodeGateVerdict(row, 'cost-drag', order) !== false, 'neither is counted as a veto');

  ok(decodeGateVerdict(row, 'no-such-gate', order) === null, 'an unknown key reads null');
  ok(decodeGateVerdict(null, 'trend', order) === null, 'and a missing row does too');
  ok(decodeGateVerdict({}, 'trend', order) === null, 'a row with no masks judged nothing');
}

console.log('\n== the ledger is bigger than 32 bits and must not wrap ==');
{
  /* bitwise operators in JS truncate to 32 bits, which would silently lose
     every gate past the 32nd — and this ledger has 35 */
  const order = gateKeyOrder(Array.from({ length: 40 }, (_, i) => 'gate-' + String(i).padStart(2, '0')));
  ok(order.length === 40, 'a 40-key ledger');
  const m = encodeGateMask([g('gate-00', true), g('gate-35', true), g('gate-39', false)], order);
  const row = { gatesPass: m.pass, gatesFail: m.fail };
  ok(decodeGateVerdict(row, 'gate-00', order) === true, 'the first key survives');
  ok(decodeGateVerdict(row, 'gate-35', order) === true, 'and so does the 36th — past the 32-bit edge');
  ok(decodeGateVerdict(row, 'gate-39', order) === false, 'and the 40th');
  ok(decodeGateVerdict(row, 'gate-20', order) === null, 'while an unjudged one in between stays null');
}

console.log('\n== splitting keeps the silent rows out of both sides ==');
{
  const order = gateKeyOrder(['participation', 'trend']);
  const mk = v => {
    const m = encodeGateMask(v === null ? [] : [g('participation', v)], order);
    return { gatesPass: m.pass, gatesFail: m.fail, outcome: 'win' };
  };
  const rows = [mk(true), mk(true), mk(false), mk(null), mk(null), mk(null)];
  const s = splitByGate(rows, 'participation', order);
  ok(s.passed.length === 2 && s.failed.length === 1, 'two passed, one failed');
  ok(s.silent.length === 3, 'and three the gate never judged are returned apart');
  ok(s.passed.length + s.failed.length + s.silent.length === rows.length, 'nothing is lost');

  const cov = gateCoverage(rows, order);
  const part = cov.filter(c => c.key === 'participation')[0];
  ok(part.passed === 2 && part.failed === 1 && part.silent === 3, 'coverage reports all three counts');
  /* a gate that judged almost nothing cannot be tuned on this walk however
     good its split looks, and coverage is what says so */
  const tr = cov.filter(c => c.key === 'trend')[0];
  ok(tr.passed + tr.failed === 0, 'a gate that judged nothing shows zero coverage');
  ok(cov[0].key === 'participation', 'and coverage ranks by how much was actually judged');
}

console.log('\n== the walk records it, and says how to read it ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold.mjs'), 'utf8');
  ok(/gates: c\.gates \|\| null/.test(src), 'the scan path carries the ledger onto the trade');
  ok(/meta\.gateKeyOrder = keyOrder/.test(src), 'the key order is written once into meta');
  ok(/delete r\.__gates/.test(src), 'and the raw ledger is dropped before the artifact is written');
  ok(/must be DROPPED from a split/.test(src),
     'the artifact tells its reader that unjudged rows are not failures');
  ok(/if \(m\.pass !== '0'\) r\.gatesPass/.test(src),
     'an all-zero mask is omitted rather than stored ten thousand times');
}

console.log('\n== the shipped artifact cannot answer it yet, and says so ==');
{
  const walk = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
  const withGates = walk.trades.filter(r => r.gatesPass || r.gatesFail);
  ok(withGates.length === 0,
     'no row in the shipped walk carries gate verdicts — it predates this');
  ok(!walk.meta.gateKeyOrder, 'and its meta has no key order');
  /* so the participation split, and every other gate tuned the same way,
     stays unverifiable until the next walk runs */
  ok(walk.trades.length > 1000,
     'which leaves every gate tuned on these ' + walk.trades.length
     + ' rows taken on trust until then');
}

console.log('\n' + passed + ' passed, 0 failed');
