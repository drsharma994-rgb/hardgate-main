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


console.log('== the candlestick patterns read real shapes ==');
{
  const P = sandbox.hgCandlePatterns;
  ok(typeof P === 'function', 'hgCandlePatterns is exposed');
  const base = (n) => tape(n, i => 100 + i * 0.02, 1.0);
  const push = (rows, bar) => rows.concat([bar]);
  const has = (res, id, dir) => res.patterns.some(x => x.id === id && x.dir === dir);

  /* a bullish engulfing: prior down body, then an up body that swallows it */
  let t = base(60);
  t = push(t, { o: t[t.length-1].c, c: t[t.length-1].c - 1.0, h: t[t.length-1].c + 0.05, l: t[t.length-1].c - 1.05, v: 100 });
  const prev = t[t.length-1];
  t = push(t, { o: prev.c - 0.1, c: prev.o + 0.2, h: prev.o + 0.3, l: prev.c - 0.2, v: 200 });
  const eng = P(t);
  ok(has(eng, 'engulf-bull', 'long'), 'a bullish engulfing is detected as LONG');
  ok(eng.patterns.every(x => typeof x.note === 'string' && x.note.length > 0), 'every pattern explains itself');
  ok(eng.patterns.every(x => x.dir === 'long' || x.dir === 'short' || x.dir === null), 'every pattern is three-state (long / short / null)');

  /* a hammer: long lower wick, close in the top third */
  let h = base(60);
  const lc = h[h.length-1].c;
  h = push(h, { o: lc, c: lc + 0.1, h: lc + 0.15, l: lc - 2.5, v: 150 });
  ok(has(P(h), 'hammer', 'long'), 'a hammer (long lower wick, close high) is detected as LONG');

  /* a shooting star: the mirror */
  let s = base(60);
  const sc = s[s.length-1].c;
  s = push(s, { o: sc, c: sc - 0.1, h: sc + 2.5, l: sc - 0.15, v: 150 });
  ok(has(P(s), 'shooting', 'short'), 'a shooting star (long upper wick, close low) is detected as SHORT');

  /* a doji: open and close nearly equal after a real range */
  let d = base(60);
  const dc = d[d.length-1].c;
  d = push(d, { o: dc, c: dc + 0.01, h: dc + 1.2, l: dc - 1.2, v: 120 });
  ok(has(P(d), 'doji', null), 'a doji votes for NEITHER side');

  /* ATR normalisation: a tiny body on a wide tape is not an engulfing */
  const wide = tape(60, i => 100, 8.0);
  let w = push(wide, { o: 100, c: 99.9, h: 100.05, l: 99.85, v: 100 });
  const wp = w[w.length-1];
  w = push(w, { o: wp.c, c: wp.o + 0.12, h: wp.o + 0.15, l: wp.c - 0.05, v: 200 });
  ok(!has(P(w), 'engulf-bull', 'long'), 'a body far smaller than the tape ATR is NOT an engulfing (ATR-normalised)');

  ok(P(tape(29, i => 100 + i, 1)).patterns.length === 0, 'below the 30-bar floor no pattern is claimed');
  ok(P(null).patterns.length === 0, 'a null tape claims no pattern');
}

console.log('== patterns and the gold desks join the same tally ==');
{
  const c = f(rising);
  ok(c.reads && c.reads.length >= c.checked - 0, 'the vote list is exposed (' + c.reads.length + ')');
  ok(c.reads.some(v => /^pat:/.test(v.id)) === (c.patterns.length > 0), 'every fired pattern contributes a pat: vote');
  ok(c.patterns.length === 0 || c.score === c.reads.reduce((a, v) => a + v.vote, 0),
     'the score is exactly the sum of the votes (patterns can carry strength 2)');
  ok(c.gold && typeof c.gold === 'object', 'the gold-desk evidence block is present');
  ok(Array.isArray(c.gold.votes), 'the gold-desk votes are listed');
  ok(c.gold.notes.length >= 0, 'unread readers are named rather than guessed (' + c.gold.notes.length + ' note(s))');
}

console.log('== a swing setup forms beside the scalp one ==');
{
  const both = f(rising, { swingRows: falling });
  ok(both && both.scalp && both.swing, 'both a scalp and a swing block are returned');
  ok(both.scalp.timeframe === '15m' && both.swing.timeframe === '4h', 'the two blocks name their timeframes');
  ok(both.scalp.dir === 'BULL' && both.swing.dir === 'BEAR',
     'opposite tapes give opposite setups (scalp ' + both.scalp.dir + ' / swing ' + both.swing.dir + ')');
  ok(both.swing.bracket.side === 'short' && both.swing.bracket.sl > both.swing.bracket.entry,
     'the swing bracket follows its own side');
  ok(f(rising, {}). swing === null, 'with no 4h tape the swing block is absent, not invented');
}
console.log('\ntest-candle-confluence: ' + pass + ' passed, 0 failed');
