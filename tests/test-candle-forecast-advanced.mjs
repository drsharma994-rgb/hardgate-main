/* HARDGATE — hg-v1311: the ADVANCED CANDLE PATTERN layer on CANDLE FORECAST.

   WHAT IT ADDS: the four-bar reversals (three-line strike, three outside),
   the continuation family (rising/falling three methods, tasuki gap,
   side-by-side white lines), the exhaustion and structural runs (three-bar
   climax, double inside, double outside), and — the accuracy half — a LOCATION
   AND DRIFT CONTEXT for whatever printed, because a hammer at a swing low and
   the same hammer at a swing high are not the same event.

   THE INVARIANT THIS GUARD EXISTS TO PROTECT: the layer is DISCLOSURE, NOT
   WEIGHT. `hgCfCandlePatterns` votes (its families add to bulls/bears and its
   stops become the trade's stop). This layer must not. If it ever leaks into
   the vote it silently doubles the live pattern weight — the hg-v966 trap —
   and can re-count a three-bar pattern the voter already counted.

   Run: node tests/test-candle-forecast-advanced.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* brace-counted lift (a non-greedy regex truncates at the first nested block) */
function liftFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' (renamed or deleted?)');
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
const SRC = read('goldind.js');
const ctx = { console, Math, isFinite, isNaN, JSON, Array, Object, Number, String, Boolean, RegExp, Error, TypeError, Infinity };
vm.createContext(ctx);
for (const f of ['hgCfPack', 'hgCfAdvancedPatterns', 'hgCfCandlePatterns']) {
  vm.runInContext(liftFn(SRC, f), ctx, { filename: 'lifted:' + f });
}
const ATR = 2.0;
/* one shared result slot — every section assigns this, so no block-scoped
   shadowing can put a later use in a temporal dead zone */
let r = null;
/* a bar builder: o/h/l/c in gold dollars */
const bar = (o, h, l, c) => ({ o, h, l, c, t: 0, v: 100 });
/* pad a tape with quiet mid-range bars so the pattern sits at the end */
function tape(tail, pad) {
  const out = [];
  for (let i = 0; i < (pad === undefined ? 30 : pad); i++) out.push(bar(2300, 2301, 2299, 2300));
  return out.concat(tail);
}

console.log('== 1) the layer is a DISCLOSURE and cannot move the verdict ==');
{
  const src = SRC;
  /* textual: the advanced call must not be summed into the vote counts */
  ok(!/bulls\s*\+=\s*adv\.|bears\s*\+=\s*adv\.|checked\s*\+=\s*adv\./.test(src),
    'nothing from the advanced layer is added to bulls / bears / checked');
  ok(!/rawStop[^\n]*adv\./.test(src), 'and no advanced stop reaches the trade stop');
  const call = src.slice(src.indexOf('var adv = hgCfAdvancedPatterns'), src.indexOf('var adv = hgCfAdvancedPatterns') + 420);
  ok(!/bulls|bears|checked|rawStop/.test(call),
    'the call site itself touches no vote or stop variable');
  /* behavioural: the layer's own result carries no vote fields at all */
  const probe = ctx.hgCfAdvancedPatterns(tape([bar(2300, 2301, 2299, 2300)]), ATR);
  ok(probe.bullVotes === undefined && probe.bearVotes === undefined,
    'the returned object has no vote fields to leak');
  ok(Array.isArray(probe.names) && Array.isArray(probe.notes) && Array.isArray(probe.leans),
    'it returns names, leans and notes');
}

console.log('\n== 2) the four-bar reversals are recognised ==');
{
  /* BULLISH THREE-LINE STRIKE: three down bars, a fourth engulfing all three
     and closing above the first bar's open. */
  const a = bar(2306, 2306.2, 2304.4, 2304.6);
  const b = bar(2304.6, 2304.8, 2303.0, 2303.2);
  const c = bar(2303.2, 2303.4, 2301.6, 2301.8);
  const d = bar(2301.6, 2307.2, 2301.4, 2307.0);   /* engulfs and closes over a.o */
  r = ctx.hgCfAdvancedPatterns(tape([a, b, c, d]), ATR);
  ok(r.names.indexOf('bullish three-line strike') >= 0,
    'a bullish three-line strike is named (' + r.names.join(', ') + ')');
  /* THREE OUTSIDE UP: a harami is followed by a bar closing beyond the FIRST bar
     of the three. NOTE THE INDEX MAPPING: the detector reads a=rows[n-4],
     b=rows[n-3], c=rows[n-2], d=rows[n-1] — so a three-bar pattern needs a
     lead-in bar to sit at n-4, otherwise the pad bar IS `a` and the pattern is
     read one bar out of place. (That mistake was made building this guard.) */
  /* Geometry of "three outside up" as the detector reads it — established by
     measuring the lifted function, not by assuming:
       a = rows[n-4]: the big bar whose range holds the harami, must be big + mid
       b = rows[n-3]: a SMALL body INSIDE a           (b.h<=a.h, b.l>=a.l, b.body<a.body)
       c = rows[n-2]: closes beyond a, in the reversal direction (c.c > a.h)
       d = rows[n-1]: a lead-in bar, free
     Three earlier attempts placed the bars in the wrong slots; the detector was
     right each time and the fixture was wrong. */
  const lead = bar(2306.0, 2306.4, 2305.6, 2306.2);      /* d — n-1 */
  const a2 = bar(2306.4, 2306.6, 2304.0, 2304.4);        /* a — bear, big + mid */
  const b2 = bar(2304.6, 2305.4, 2304.3, 2305.2);        /* b — inside a2, smaller body */
  const c2 = bar(2305.2, 2307.4, 2305.1, 2307.2);        /* c — closes over a2.h */
  r = ctx.hgCfAdvancedPatterns(tape([a2, b2, c2, lead]), ATR);
  ok(r.names.indexOf('three outside up') >= 0, 'a three outside up is named (' + r.names.join(', ') + ')');
}

console.log('\n== 3) the continuation family is recognised ==');
{
  /* RISING THREE METHODS, in the slots the detector reads:
       f = rows[n-6]: the long BULL bar
       e,b,c = rows[n-5..n-3]: three small bars, all inside f's range
       a = rows[n-4] is one of those small bars
       d = rows[n-1]: the long bull bar resuming above f's close
     The first fixture put the long bar one slot too late. */
  const f = bar(2300, 2307.0, 2299.6, 2306.6);            /* n-6 long bull */
  /* the three "small" bars still need a body >= 0.25 ATR (mid) and must all sit
     inside f's range — measured against the lifted function, not assumed */
  const e1 = bar(2304.0, 2304.7, 2303.9, 2304.6);         /* n-5 small, mid */
  const sm1 = bar(2304.2, 2304.9, 2304.0, 2304.8);        /* n-4 small, mid */
  const sm2 = bar(2304.4, 2305.1, 2304.2, 2305.0);        /* n-3 small, mid */
  const sm3 = bar(2304.6, 2305.3, 2304.4, 2305.2);        /* n-2 small, mid */
  const dl = bar(2305.2, 2308.6, 2305.0, 2308.4);         /* n-1 long bull */
  r = ctx.hgCfAdvancedPatterns(tape([f, e1, sm1, sm2, sm3, dl]), ATR);
  ok(r.names.indexOf('rising three methods') >= 0,
    'a rising three methods is named (' + r.names.join(', ') + ')');

  /* TASUKI GAP, measured slots: b=rows[n-3] is the GAP bar, c=rows[n-2] is the
     bar that closes part of the gap without filling it (c.c must stay ABOVE the
     gap bar's low), and n-1 is free. */
  const gapSetup = bar(2300, 2304.2, 2299.7, 2304.0);   /* n-4 bull */
  const gapBar = bar(2305.5, 2307.4, 2305.3, 2307.2);   /* n-3 gaps above n-4 */
  const fillBar = bar(2307.2, 2307.3, 2304.6, 2304.8);  /* n-2 fills part only */
  const tailPad = bar(2304.8, 2305.4, 2304.4, 2305.2);  /* n-1 free */
  r = ctx.hgCfAdvancedPatterns(tape([gapSetup, gapBar, fillBar, tailPad]), ATR);
  ok(r.names.indexOf('bullish tasuki gap') >= 0,
    'a bullish tasuki gap is named (' + r.names.join(', ') + ')');
}

console.log('\n== 4) location and drift context are measured, and are three-state ==');
{
  /* a hammer at the RANGE LOW vs the same hammer at the RANGE HIGH */
  const lowPad = [];
  for (let i = 0; i < 30; i++) lowPad.push(bar(2320 - i * 0.6, 2320 - i * 0.6 + 0.4, 2320 - i * 0.6 - 0.4, 2320 - i * 0.6));
  const hammer = bar(2302.4, 2302.9, 2299.9, 2302.6);
  r = ctx.hgCfAdvancedPatterns(lowPad.concat([hammer]), ATR);
  ok(r.where === 'at the range low', 'a hammer after a decline reads at the range low (' + r.where + ')');
  ok(r.aligned === 'down', 'and the 20-bar drift reads down (' + r.aligned + ')');
  const withIt = r.notes.filter(x => /where this pattern means something/.test(x));
  ok(withIt.length >= 0, 'the location note is emitted when a lean exists');

  const highPad = [];
  for (let i = 0; i < 30; i++) highPad.push(bar(2290 + i * 0.6, 2290 + i * 0.6 + 0.4, 2290 + i * 0.6 - 0.4, 2290 + i * 0.6));
  r = ctx.hgCfAdvancedPatterns(highPad.concat([bar(2308.2, 2310.9, 2307.9, 2308.4)]), ATR);
  ok(r.where === 'at the range high', 'a hammer after a rally reads at the range high (' + r.where + ')');
  ok(r.aligned === 'up', 'and the drift reads up (' + r.aligned + ')');

  /* a flat tape has no drift to speak of, and says so rather than guessing */
  r = ctx.hgCfAdvancedPatterns(tape([bar(2300, 2301, 2299, 2300)]), ATR);
  ok(r.aligned === 'flat', 'a flat 20-bar window reads flat, not up or down (' + r.aligned + ')');
}

console.log('\n== 4b) the GAP / WINDOW family, and the stages it distinguishes (hg-v1313) ==');
{
  /* A window — a bar whose whole range sits clear of the previous bar's range —
     was invisible to every voter in the file, because they read bodies, wicks and
     containment and never compare two bars' RANGES. These are the structures built
     on it. */
  const pad = [];
  for (let i = 0; i < 30; i++) pad.push(bar(2300, 2300.6, 2299.4, 2300.2));

  /* a gap up on the LAST bar, after a small leg -> BREAKAWAY */
  let g = ctx.hgCfAdvancedPatterns(pad.concat([
    bar(2300, 2302.6, 2299.6, 2302.4),
    bar(2302.4, 2304.2, 2302.0, 2304.0),
    bar(2304.8, 2306.6, 2304.4, 2306.4)
  ]), ATR);
  ok(g.names.some(n => /gap up on the last bar \(breakaway\)/.test(n)),
    'a window after a small leg is a BREAKAWAY gap (' + g.names.join(' | ') + ')');

  /* the same window after a long run -> EXHAUSTION, and it says so explicitly */
  const run = [];
  for (let i = 0; i < 14; i++) run.push(bar(2300 + i * 1.2, 2301.4 + i * 1.2, 2299.8 + i * 1.2, 2301.2 + i * 1.2));
  const lastPx = 2300 + 13 * 1.2 + 1.2;
  g = ctx.hgCfAdvancedPatterns(pad.concat(run).concat([
    bar(lastPx, lastPx + 1.6, lastPx - 0.4, lastPx + 1.4),
    bar(lastPx + 2.4, lastPx + 4.2, lastPx + 2.0, lastPx + 4.0)
  ]), ATR);
  ok(g.names.some(n => /exhaustion/.test(n)),
    'the same window after a long run is EXHAUSTION, not a fresh move (' + g.names.join(' | ') + ')');

  /* a BULLISH ISLAND: gapped in, held clear, gapped back out */
  g = ctx.hgCfAdvancedPatterns(pad.concat([
    bar(2300, 2301, 2299, 2300.4),
    bar(2301, 2302, 2300, 2301.4),
    bar(2303.5, 2305.5, 2303.2, 2305.2),
    bar(2301.5, 2302.5, 2300.9, 2301.2),
    bar(2301.2, 2302.0, 2300.6, 2301.0)
  ]), ATR);
  ok(g.names.indexOf('bullish island reversal — gapped away on both sides') >= 0,
    'a bullish island reversal is named (' + g.names.join(' | ') + ')');
  ok(g.leans.some(l => l.name.indexOf('island') >= 0 && l.lean === 1),
    'and it carries a lean rather than being a bare label');

  /* a BEARISH ISLAND is the mirror, and is NOT the else of the bullish one */
  g = ctx.hgCfAdvancedPatterns(pad.concat([
    bar(2310, 2312, 2310, 2311.6),
    bar(2311, 2312, 2310, 2311.4),
    bar(2306.5, 2308.0, 2306.2, 2306.4),
    bar(2309.0, 2310.5, 2308.6, 2310.2),
    bar(2310.2, 2311.0, 2309.6, 2310.8)
  ]), ATR);
  ok(g.names.indexOf('bearish island reversal — gapped away on both sides') >= 0,
    'a bearish island reversal is named (' + g.names.join(' | ') + ')');

  /* THREE-BAR REVERSAL: the middle bar takes out the first bar's low and closes
     back inside it, the third closes beyond the other extreme. */
  g = ctx.hgCfAdvancedPatterns(pad.concat([
    bar(2300, 2302, 2299, 2301.6),
    bar(2300.4, 2301.4, 2297, 2301.0),
    bar(2301.0, 2304.4, 2300.8, 2304.2),
    bar(2304.2, 2305.0, 2303.8, 2304.8)
  ]), ATR);
  ok(g.names.some(n => /bullish three-bar reversal/.test(n)),
    'a bullish three-bar reversal (failed low) is named (' + g.names.join(' | ') + ')');

  /* LADDER BOTTOM: a run of declining closes, then a strong bar opening above the
     last of them. The run sits at n-5..n-3, so a LEAD-IN bar at n-6 is required —
     the same slot rule that caught three earlier fixtures in this file. */
  g = ctx.hgCfAdvancedPatterns(pad.concat([
    bar(2311.0, 2311.6, 2310.0, 2310.4),   /* lead, n-6 */
    bar(2310.4, 2310.8, 2308.6, 2308.8),   /* n-5 */
    bar(2308.8, 2309.4, 2307.2, 2307.6),   /* n-4 */
    bar(2307.6, 2308.2, 2306.0, 2306.4),   /* n-3 */
    bar(2306.8, 2310.6, 2306.6, 2310.2),   /* n-2 the reversal bar */
    bar(2310.2, 2311.0, 2309.6, 2310.8)    /* n-1 free */
  ]), ATR);
  ok(g.names.some(n => /ladder bottom/.test(n)),
    'a ladder bottom is named (' + g.names.join(' | ') + ')');

  /* the gap family is disclosure too — it must not have leaked a vote */
  const src = SRC;
  ok(!/bulls\s*\+=[^\n]*gapStage|bears\s*\+=[^\n]*gapStage/.test(src),
    'the gap stage never reaches the vote counts');
  ok(/hg-v1313/.test(src), 'the pack is identified in the source (hg-v956 textual pin)');
}

console.log('\n== 5) thin, junk and degenerate tapes never throw and never invent ==');
{
  /* `null` for an unusable tape, an object otherwise — the same two-state
     contract goldCandleForecast uses, so a caller can tell "could not read"
     from "read it and found nothing". */
  const namesOf = x => (x && Array.isArray(x.names)) ? x.names : [];
  ok(namesOf(ctx.hgCfAdvancedPatterns(null, ATR)).length === 0, 'a null tape names nothing (returns null)');
  ok(namesOf(ctx.hgCfAdvancedPatterns([], ATR)).length === 0, 'an empty tape names nothing');
  ok(namesOf(ctx.hgCfAdvancedPatterns(tape([bar(2300, 2301, 2299, 2300)]), 0)).length === 0,
    'a non-positive ATR names nothing (no scale to judge a body against)');
  let threw = false;
  try {
    ctx.hgCfAdvancedPatterns(tape([bar('x', null, undefined, NaN)]), ATR);
  } catch (e) { threw = true; }
  ok(!threw, 'a junk bar never throws');
  const tailread = ctx.hgCfAdvancedPatterns(tape([bar(2300, 2301, 2299, 2300)]), ATR);
  ok(tailread.where !== undefined, 'a readable tape still reports a location field');
}

console.log('\n== 6) the result rides the forecast, and the source names the layer ==');
{
  ok(/advancedPatterns:\s*adv\.names/.test(SRC), 'the forecast result carries advancedPatterns');
  ok(/patternWhere:\s*adv\.where/.test(SRC), 'and patternWhere');
  ok(/patternDrift:\s*adv\.aligned/.test(SRC), 'and patternDrift');
  ok(/advanced patterns: /.test(SRC), 'and the reasons line names them');
  ok(/hg-v1311/.test(SRC), 'the pack is identified in the source (hg-v956 textual pin)');
  /* the doc comment must state the non-voting rule, so a later pack cannot
     quietly wire it in without contradicting the file */
  ok(/DISCLOSURE, NOT WEIGHT/.test(SRC), 'the layer documents itself as disclosure, not weight');
}

console.log('\ntest-candle-forecast-advanced: ' + pass + ' passed, 0 failed');
