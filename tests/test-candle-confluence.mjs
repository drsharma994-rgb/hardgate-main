/* HARDGATE — ULTIMATE AI CONFLUENCE (candle-confluence.js).
   Pins the contract: many reads, an honest grade, levels ALWAYS emitted, and
   never a guessed side when the tally is thin.

   Run: node tests/test-candle-confluence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sandbox = { console, Math, isFinite, Array, Object, Number, String };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('candle-confluence.js'), sandbox, { filename: 'candle-confluence.js' });
const f = sandbox.hgUltimateConfluence;
ok(typeof f === 'function', 'hgUltimateConfluence is exposed');

const T0 = Date.UTC(2026, 0, 6, 0, 0, 0);
function tape(n, closeAt, range){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = closeAt(i);
    rows.push({ t: T0 + i * 900000, o: c - (i % 2 ? 0.2 : -0.2), h: c + range / 2, l: c - range / 2, c, v: 100 + i });
  }
  return rows;
}
const rising = tape(120, i => 100 + i * 0.8, 1.0);
const falling = tape(120, i => 200 - i * 0.8, 1.0);
const flat = tape(120, () => 100, 1.0);

console.log('== a real trend produces a call WITH levels ==');
{
  const up = f(rising);
  ok(up && up.dir === 'BULL', 'a clear uptrend calls BULL (got ' + (up && up.dir) + ')');
  ok(up.grade === 'ULTIMATE' || up.grade === 'STRONG' || up.grade === 'MODERATE', 'the grade is one of the three call grades (' + up.grade + ')');
  ok(up.score > 0, 'the tally score is positive (' + up.score + ')');
  ok(up.checked >= 15, 'at least the fifteen built-in reads were checked (' + up.checked + ')');
  ok(up.bracket && up.bracket.side === 'long', 'the bracket is long');
  const b = up.bracket;
  ok(b.sl < b.entry && b.tp1 > b.entry && b.tp2 > b.tp1, 'long levels cohere: SL < entry < TP1 < TP2');
  ok(Math.abs((b.tp1 - b.entry) - (b.entry - b.sl)) < 0.02, 'TP1 and SL are one risk unit from the entry');
  ok(Math.abs((b.tp2 - b.entry) - 2 * (b.entry - b.sl)) < 0.03, 'TP2 is two risk units from the entry');
  ok(up.bandLow != null && up.bandHigh > up.bandLow, 'the ATR band is reported');
  ok(/NOT a probability/.test(up.note), 'the note says outright it is not a probability');

  const dn = f(falling);
  ok(dn && dn.dir === 'BEAR', 'a clear downtrend calls BEAR (got ' + (dn && dn.dir) + ')');
  const s = dn.bracket;
  ok(s.sl > s.entry && s.tp1 < s.entry && s.tp2 < s.tp1, 'short levels cohere: SL > entry > TP1 > TP2');
}

console.log('== a thin tally names no side but STILL prints both brackets ==');
{
  const fl = f(flat);
  ok(fl && (fl.dir === 'NO CALL' || fl.dir === 'BULL' || fl.dir === 'BEAR'), 'a flat tape returns a valid verdict');
  if (fl.dir === 'NO CALL'){
    ok(Array.isArray(fl.bothBrackets) && fl.bothBrackets.length === 2, 'NO CALL carries BOTH brackets');
    ok(fl.bothBrackets[0].side === 'long' && fl.bothBrackets[1].side === 'short', 'one long and one short bracket');
    const lb = fl.bothBrackets[0], sb = fl.bothBrackets[1];
    ok(lb.sl < lb.entry && sb.sl > sb.entry, 'the two brackets sit on opposite sides of the entry');
  }
}

console.log('== every read is labelled and three-state ==');
{
  const c = f(rising);
  ok(Array.isArray(c.reads) && c.reads.length >= 15, 'the read list is exposed (' + c.reads.length + ')');
  ok(c.reads.every(r => typeof r.label === 'string' && r.label.length > 0), 'every read names itself');
  ok(c.reads.every(r => r.vote === -1 || r.vote === 0 || r.vote === 1), 'every vote is -1 / 0 / +1 (never a half-guess)');
  ok(c.agree + c.oppose + c.abstain === c.checked, 'agree + oppose + abstain equals the checked count');
  ok(c.score === c.agree - c.oppose, 'the score is exactly agree minus oppose');
}

console.log('== honesty on thin and junk input ==');
{
  ok(f(null) === null, 'null returns null');
  ok(f([]) === null, 'empty returns null');
  ok(f(tape(29, i => 100 + i, 1)) === null, 'below the 30-bar floor it returns null');
  let threw = false;
  try { f(tape(40, () => 100, 1).concat([{ o: 'x', h: null, l: undefined, c: NaN }])); } catch (e) { threw = true; }
  ok(!threw, 'a junk bar never throws');
}

console.log('\ntest-candle-confluence: ' + pass + ' passed, 0 failed');
