/* HARDGATE — hg-v1304: CANDLE CONTEXT on SETUP CONFIRM.

   THE GAP. This desk's own header said it "never invents levels or fetches market
   data of its own" — it composed other desks' published snapshots and nothing
   else. So CONFIRMED here meant "several desks agree", and NOTHING on the tab had
   ever looked at the tape those desks were reading. A group could crown while
   price sat mid-range after a volatility blow-off and this tab could not tell.

   WHAT THIS GUARD PROVES:
     1. the context reader is a PURE function of the bars — same bars, same read
     2. every structural field is THREE-STATE: a real reading, an explicit
        `against`, or absent on a thin/unreadable tape
     3. it reads the repo's ONE candle seam (W.getCandles) and carries its own
        timeout, so a cold fetch can never hold the scan open
     4. it is a READOUT, not a gate: the tier logic and the blockers never
        consult it
     5. the card renders it, and renders an honest "unread" when there is no tape

   Run: node tests/test-setup-confirm-candles-v1304.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* hg-v967: lift rather than export. BRACE-COUNTED — a non-greedy regex would
   truncate at the first nested block and the guard would measure a half-function. */
function liftFn(src, name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' (renamed or deleted?)');
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
function lift(){
  const src = read('setup-confirm.js');
  const ctx = { Math, Date, isFinite, isNaN, JSON, Array, Object, Number, String, Boolean, RegExp, Error, TypeError, Promise };
  vm.createContext(ctx);
  vm.runInContext('var CF_CANDLE_RES = "4h";', ctx);
  vm.runInContext(liftFn(src, 'cfCandleContext'), ctx, { filename: 'lifted:cfCandleContext' });
  return ctx;
}
/* a synthetic tape: n bars, a linear drift plus a fixed range, controllable */
function tape(n, start, step, range, vol){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    out.push({ t: i, o: c, h: c + range, l: c - range, c: c, v: vol || 100 });
  }
  return out;
}

console.log('== 1) the reader is PURE: same bars, same read ==');
{
  const W = lift();
  const rows = tape(120, 100, 0.5, 2, 100);
  const a = W.cfCandleContext(rows, 'long');
  const b = W.cfCandleContext(rows, 'long');
  ok(a && b, 'a 120-bar tape reads');
  ok(JSON.stringify(a) === JSON.stringify(b), 'and the same bars produce a byte-identical read');
  const before = JSON.stringify(rows);
  W.cfCandleContext(rows, 'long');
  ok(JSON.stringify(rows) === before, 'the reader MUTATES NOTHING on the bars it is handed');
  ok(a.bars === 120 && a.res === '4h', 'the read reports its own bar count and resolution');
}

console.log('\n== 2) THREE-STATE: thin, absent and malformed tapes return null, never a guess ==');
{
  const W = lift();
  ok(W.cfCandleContext(null, 'long') === null, 'null input -> null');
  ok(W.cfCandleContext([], 'long') === null, 'empty array -> null');
  ok(W.cfCandleContext(tape(29, 100, 1, 2), 'long') === null, '29 bars -> null (below the 30-bar floor)');
  ok(W.cfCandleContext(tape(30, 100, 1, 2), 'long') !== null, '30 bars -> reads (the floor is inclusive)');
  const bad = tape(120, 100, 1, 2); bad[10] = null;
  ok(W.cfCandleContext(bad, 'long') === null, 'a null bar -> null rather than a partial read');
  const nan = tape(120, 100, 1, 2); nan[119].c = 'not-a-number';
  ok(W.cfCandleContext(nan, 'long') === null, 'an unparseable close -> null');
}

console.log('\n== 3) the structural reads are correct and dual-ended ==');
{
  const W = lift();
  /* a tape that has risen hard: price should sit at the RANGE HIGH */
  const up = W.cfCandleContext(tape(120, 100, 1, 2), 'long');
  ok(up.rangePos > 0.9, 'a steadily rising tape puts price at the range high (' + up.rangePos.toFixed(2) + ')');
  ok(up.rangeState === 'at the range high', 'and says so (' + up.rangeState + ')');
  ok(up.lean === 'up', 'the tape lean is up (' + up.lean + ')');
  ok(up.leanWith === true, 'a LONG against an up-leaning tape reads WITH');
  ok(up.extended === true, 'and a LONG entering the top of the range is flagged EXTENDED');
  ok(up.lastBarWith === true, 'the last closed bar finished with the long');

  /* the same tape read as a SHORT must be the mirror */
  const mirror = W.cfCandleContext(tape(120, 100, 1, 2), 'short');
  ok(mirror.lean === 'up' && mirror.leanWith === false, 'the same tape reads AGAINST a short');
  ok(mirror.extended === false, 'and a short at the range HIGH is not the wrong-ended entry');
  ok(mirror.lastBarWith === false, 'and the last closed bar finished against the short');

  /* a falling tape flips every one of those */
  const dn = W.cfCandleContext(tape(120, 200, -1, 2), 'short');
  ok(dn.rangeState === 'at the range low', 'a falling tape sits at the range low (' + dn.rangeState + ')');
  ok(dn.lean === 'down' && dn.leanWith === true, 'a SHORT with a down tape reads WITH');
  ok(dn.extended === true, 'and that short is the wrong-ended entry — EXTENDED');

  /* a flat tape is mid-range and leans neither way */
  const flat = W.cfCandleContext(tape(120, 100, 0, 2), 'long');
  ok(flat.rangePos !== null && flat.rangePos > 0.2 && flat.rangePos < 0.8,
    'a flat tape is mid-range (' + flat.rangePos + ')');
  ok(flat.lean === 'flat', 'and leans neither way (' + flat.lean + ')');
  ok(flat.leanWith === null, 'so WITH is null, not a false claim of agreement');
  ok(flat.extended === false, 'and mid-range is never EXTENDED');

  /* an unknown direction must not invent alignment */
  const nodir = W.cfCandleContext(tape(120, 100, 1, 2), null);
  ok(nodir.leanWith === null && nodir.extended === null && nodir.lastBarWith === null,
    'no direction -> WITH / EXTENDED / last-bar all null rather than guessed');
}

console.log('\n== 4) ATR expansion and volume ratio are measured, and absent when unreadable ==');
{
  const W = lift();
  /* calm tape then a violent last 5 bars -> ATR expansion > 1 */
  const rows = tape(120, 100, 0.1, 1, 100);
  for (let i = 115; i < 120; i++){ rows[i].h = rows[i].c + 20; rows[i].l = rows[i].c - 20; }
  const g = W.cfCandleContext(rows, 'long');
  ok(g.atrExpand !== null && g.atrExpand > 1.5,
    'a volatility blow-off reads as ATR expansion (' + (g.atrExpand || 0).toFixed(2) + 'x)');
  ok(g.lines.some(l => /volatility expanding/.test(l)), 'and the disclosed line says so');

  /* volume: last bar heavy vs the prior mean */
  const hv = tape(120, 100, 0.1, 1, 100);
  hv[119].v = 500;
  const gv = W.cfCandleContext(hv, 'long');
  ok(gv.volRatio !== null && gv.volRatio > 1.5,
    'a heavy last bar reads as participation (' + (gv.volRatio || 0).toFixed(2) + 'x)');

  /* absent volume is absent, never zero */
  const nv = tape(120, 100, 0.1, 1, 0);
  nv.forEach(b => { delete b.v; });
  const gn = W.cfCandleContext(nv, 'long');
  ok(gn.volRatio === null, 'no volume anywhere -> volRatio is null, not 0');
  ok(!gn.lines.some(l => /last-bar volume/.test(l)), 'and no volume line is printed at all');
}

console.log('\n== 5) it is a READOUT, not a gate ==');
{
  const src = read('setup-confirm.js');
  /* Assert on the SPECIFIC new identifiers, not on English words: "extended" is a
     legitimate trading term already used by the tier and blocker code, so a loose
     /\bextended\b/ test false-positives on prose that has nothing to do with the
     tape read. Comments are stripped as well — assert against code, not prose. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const NEW = /\bg\.tape\b|\.tape\b|cfCandleContext|cfReadTape|leanWith|rangePos|atrExpand|volRatio|CF_TAPE_MS|CF_CANDLE_/;
  for (const [fn, what] of [['cfAssignTier', 'cannot promote or demote'],
                            ['cfHardBlockers', 'cannot block'],
                            ['cfScoreHit', 'adds no score']]){
    const body = strip(liftFn(src, fn));
    ok(!NEW.test(body), fn + ' never consults the tape read — ' + what);
  }
  const reader = strip(liftFn(src, 'cfCandleContext'));
  ok(!/["']?clean["']?\s*=[^=]/.test(reader) && !/["']?tier["']?\s*=[^=]/.test(reader)
     && !/["']?demoted["']?\s*=[^=]/.test(reader),
    'the reader itself assigns no verdict field');
}

console.log('\n== 6) it reads the ONE candle seam, and cannot hold the scan open ==');
{
  const src = read('setup-confirm.js');
  ok(/gfn\('getCandles'\)/.test(src),
    "the tape read goes through W.getCandles — the same seam book.js and brain.js use (hg-v949, no second fetch path)");
  ok(!/binanceKlines|api\.binance|fetch\(/.test(src),
    'this module opens no network path of its own');
  ok(/cfWithTimeout\(get\(/.test(src), 'the fetch is individually timeout-guarded');
  const to = liftFn(src, 'cfWithTimeout');
  ok(/setTimeout/.test(to) && /resolve\(null\)/.test(to),
    'and a timeout resolves null (an honest absence) rather than rejecting');
  ok(/CF_TAPE_MS\s*=\s*\d+/.test(src), 'the budget is a named constant');
  /* bounded fan-out */
  ok(/tapeable\.slice\(0,\s*\d+\)/.test(src), 'the fan-out is capped, so a wide board cannot storm the network');
  ok(/Promise\.all\(tapeable\.map/.test(src), 'the reads run concurrently, not serially');
}

console.log('\n== 7) the card renders the read, and renders an honest UNREAD ==');
{
  const card = liftFn(read('setup-confirm.js'), 'cfCardHtml');
  ok(/data-cf-tape="1"/.test(card), 'the card carries a tape marker');
  ok(/TAPE CONTEXT/.test(card), 'and labels the block TAPE CONTEXT');
  ok(/data-cf-tape="unread"/.test(card), 'and has a distinct unread marker');
  ok(/closed bars only/.test(card), 'and says the read is built from closed bars');
  ok(/g\.tape\.lines\.map/.test(card), 'it renders the disclosed lines');
  ok(/esc\(/.test(card.slice(card.indexOf('data-cf-tape'))),
    'the tape text is escaped like the rest of the card');
}

console.log('\n' + passed + ' passed, 0 failed');
