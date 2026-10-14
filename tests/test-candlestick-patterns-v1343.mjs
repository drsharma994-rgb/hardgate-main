/* HARDGATE — hg-v1343: THE CANDLESTICK ENGINE READS THE NEWEST SHAPE ONLY.
   candlestick_patterns.js is the shared engine the TREND MATRIX's candle
   confluence desk reads through the hgCfCandlePatterns seam. It used to loop
   over EVERY bar of the tape and accumulate votes across all history — 18
   permissive patterns over 120 bars meant both sides nearly always carried
   votes, and the doji rule added a vote to BOTH sides per doji, so the desk's
   tie check landed on CLASH for row after row (160 clashed on the live board
   — the desk the user saw was empty by construction, not by market).

   The contract now:
     - the engine reads the NEWEST complete 3-bar triad only (prev, curr,
       next — curr = the bar before the last closed slot... the triad whose
       pattern completes at the newest closed bar). History does not vote.
     - a doji votes NEITHER side: indecision is not agreement. (The old
       paired +1/+1 per doji guaranteed exact ties, and the desk's tie check
       reports a CLASH.)
     - a tweezer needs a defended close: the bottom needs a bullish close off
       the matched low, the top needs a bearish close off the matched high —
       three near-identical bars must not fire both tweezers at once (the
       other guaranteed-tie generator).
     - the named shapes still work: a bullish engulfing triad reads 1 bull /
       0 bear; a bearish engulfing triad reads 0 / 1.
     - the module attaches to globalThis (the old `globalthis` typo made the
       module a no-op outside a browser).

   Run: node tests/test-candlestick-patterns-v1343.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
  JSON, Error, isFinite, isNaN, parseFloat, parseInt };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('candlestick_patterns.js'), ctx, { filename: 'candlestick_patterns.js' });
const P = ctx.hgCfCandlePatterns;
assert(typeof P === 'function', 'hgCfCandlePatterns is exported on globalThis (the old globalthis typo is gone)');
assert(typeof ctx.hgCfAdvancedPatterns === 'function', 'hgCfAdvancedPatterns is exported too (the advanced seam stays wired)');

function triadTape(triad, historyBars){
  const rows = []; let c = 2600; const t0 = Date.now() / 1000 - (historyBars + 3) * 14400;
  for (let i = 0; i < historyBars; i++){
    const o = c; c = c * 1.001;
    rows.push({ t: t0 + i * 14400, o, h: Math.max(o, c) + 3, l: Math.min(o, c) - 3, c, v: 1000 });
  }
  rows.push(triad[0]); rows.push(triad[1]); rows.push(triad[2]);
  return rows;
}

console.log('== 1) history does not vote: only the newest triad is read ==');
{
  /* a bearish engulfing TWENTY bars before the end, then a clean quiet triad */
  const hist = [];
  let c = 2600; const t0 = Date.now() / 1000 - 40 * 14400;
  for (let i = 0; i < 18; i++){
    const o = c; c = c * 1.001;
    hist.push({ t: t0 + i * 14400, o, h: Math.max(o, c) + 3, l: Math.min(o, c) - 3, c, v: 1000 });
  }
  /* the old pattern: a bearish engulfing in history */
  hist.push({ t: t0 + 18 * 14400, o: c + 4, h: c + 6, l: c - 6, c: c - 5, v: 1000 });           /* prior bull-ish */
  hist.push({ t: t0 + 19 * 14400, o: c + 3, h: c + 4, l: c - 8, c: c - 7, v: 1000 });           /* the engulf */
  for (let i = 20; i < 38; i++){
    const o = c; c = c * 1.001;
    hist.push({ t: t0 + i * 14400, o, h: Math.max(o, c) + 3, l: Math.min(o, c) - 3, c, v: 1000 });
  }
  const tape = hist.concat([
    { t: t0 + 38 * 14400, o: 2600, h: 2604, l: 2596, c: 2602 },
    { t: t0 + 39 * 14400, o: 2602, h: 2606, l: 2600, c: 2604 },
    { t: t0 + 40 * 14400, o: 2604, h: 2608, l: 2602, c: 2606 }
  ]);
  const p = P(tape);
  assert(p.bullVotes === 0 && p.bearVotes === 0,
    'a bearish engulfing twenty bars back votes NOTHING now (' + p.bullVotes + '/' + p.bearVotes + ') — history is not a vote');
}

console.log('== 2) a doji triad votes neither side — no paired +1/+1, no guaranteed tie ==');
{
  const tape = triadTape([
    { o: 2600, h: 2606, l: 2594, c: 2600.2 },
    { o: 2600.1, h: 2607, l: 2593, c: 2600.1 },
    { o: 2600, h: 2606, l: 2594, c: 2600.1 }
  ]);
  const p = P(tape);
  assert(p.bullVotes === 0 && p.bearVotes === 0,
    'a doji triad reads 0/0 — indecision is not a vote for both sides (' + p.bullVotes + '/' + p.bearVotes + ')');
  assert(p.bullNames.length === 0 && p.bearNames.length === 0, 'and names no shape on either side');
}

console.log('== 3) the tweezers need a defended close — three similar bars fire nothing ==');
{
  /* three near-identical bars with a NEUTRAL close: the old engine fired a
     tweezer bottom AND a tweezer top on this — a guaranteed tie, a guaranteed
     clash, for a bar that says nothing at all */
  const tape = triadTape([
    { o: 2600, h: 2605.8, l: 2593, c: 2600.05 },
    { o: 2600.05, h: 2605.9, l: 2593.1, c: 2600.05 },
    { o: 2600.05, h: 2605.85, l: 2593.2, c: 2600.05 }
  ]);
  const p = P(tape);
  assert(p.bullVotes === 0 && p.bearVotes === 0,
    'three identical bars with a neutral close read 0/0 — no tweezer, no clash (' + p.bullVotes + '/' + p.bearVotes + ')');
  /* and a DEFENDED bottom reads one side only */
  const defended = triadTape([
    { o: 2604, h: 2606, l: 2596, c: 2600 },
    { o: 2600, h: 2605.8, l: 2593, c: 2600.6 },
    { o: 2600.5, h: 2605.9, l: 2592, c: 2601.5 }
  ]);
  const pd = P(defended);
  assert(pd.bullVotes >= 1 && pd.bearVotes === 0,
    'a tweezer bottom with a bullish close reads one side (' + pd.bullVotes + '/' + pd.bearVotes + ')');
}

console.log('== 4) the named shapes still work, one side at a time ==');
{
  const bull = P(triadTape([
    { o: 2600, h: 2601, l: 2592, c: 2593 },
    { o: 2592, h: 2603, l: 2591, c: 2602 },
    { o: 2602, h: 2605, l: 2600, c: 2604 }
  ]));
  assert(bull.bullVotes >= 1 && bull.bearVotes === 0 && /Bullish Engulfing/.test(bull.bullNames.join(',')),
    'a bullish engulfing triad reads bull-only (' + bull.bullVotes + '/' + bull.bearVotes + ' ' + bull.bullNames.join(',') + ')');
  const bear = P(triadTape([
    { o: 2600, h: 2604, l: 2596, c: 2602 },
    { o: 2605, h: 2606, l: 2594, c: 2595 },
    { o: 2595, h: 2598, l: 2593, c: 2596 }
  ]));
  assert(bear.bearVotes >= 1 && bear.bullVotes === 0 && /Bearish Engulfing/.test(bear.bearNames.join(',')),
    'a bearish engulfing triad reads bear-only (' + bear.bullVotes + '/' + bear.bearVotes + ' ' + bear.bearNames.join(',') + ')');
}

console.log('== 5) honesty: thin and junk tapes form nothing and never throw ==');
{
  assert(P(null).bullVotes === 0 && P([]).bullVotes === 0, 'null and empty tapes read 0/0');
  assert(P([{ o: 1, h: 1, l: 1, c: 1 }]).bullVotes === 0, 'a one-bar tape reads 0/0');
  let threw = false;
  try { P([{ o: 'x', h: null, l: undefined, c: NaN }, { o: 1, h: 2, l: 0.5, c: 1.5 }, { o: 1.5, h: 2, l: 1, c: 1.8 }]); }
  catch (e) { threw = true; }
  assert(!threw, 'a junk triad never throws');
}

console.log('== 6) the source says what shipped ==');
{
  const src = read('candlestick_patterns.js');
  assert(!/for \(var i = 1; i < n - 1; i\+\+\)/.test(src), 'the whole-tape accumulation loop is gone');
  assert(/var i = n - 2;/.test(src), 'the engine reads the newest complete triad (i = n - 2)');
  assert(!/res\.bullVotes\+\+;[\s\S]{0,40}res\.bearVotes\+\+[\s\S]{0,40}res\.bullNames\.push\('Doji'\)/.test(src),
    'the doji no longer votes both sides');
  assert(/curr\.c < curr\.o;/.test(src) && /curr\.c > curr\.o;/.test(src),
    'the tweezers require a defended close (bull close for the bottom, bear for the top)');
  assert(!/globalthis\b/.test(src), 'the globalThis typo is gone');
}

console.log('\n' + (fail === 0
  ? 'ALL CANDLESTICK-ENGINE TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
