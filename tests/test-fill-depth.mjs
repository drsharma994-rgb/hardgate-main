/* HARDGATE — how much of the walk's fill rate is an extreme-tick touch.

   ogXmBarTouchesEntry fills a resting order the instant the bar's extreme
   reaches it. A bar whose low is EXACTLY the limit price therefore fills
   every time in the walk, and in a real book that is one print at the
   extreme tick with a queue ahead of it. hg-v754 measured how OFTEN limits
   fill (HG_OG_FILL_RATES: BUY_LIMIT 0.792, BUY_STOP 0.437) but not how many
   of those fills were that kind — so "79% of buy limits fill" could be
   carrying any amount of that inside it and nobody could tell.

   ogXmFillDepth answers it: how far price traded THROUGH the order before
   the walk called it filled. Depth 0 is a kiss; a large depth is a fill
   nobody would dispute. Recorded per row as fillDepthR (in the trade's own
   risk units) and fillDepthBar (as a fraction of the fill bar's range).

   Measurement only — nothing in the walk branches on it. This test pins the
   arithmetic and the null semantics, because a fill depth that silently
   reads 0 when it means "not applicable" would rank every market order as
   the worst possible fill.

   Run: node tests/test-fill-depth.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ogXmFillDepth, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const bar = (o, h, l, c) => ({ o, h, l, c });

console.log('== depth is how far price traded THROUGH the resting order ==');
{
  /* a buy limit at 4700: the bar dipped to 4695, so price traded $5 through */
  ok(near(ogXmFillDepth('BUY_LIMIT', 'long', bar(4710, 4712, 4695, 4705), 4700), 5),
     'a buy limit filled $5 deep reads 5');
  /* the same order on a bar that stopped exactly at it */
  ok(near(ogXmFillDepth('BUY_LIMIT', 'long', bar(4710, 4712, 4700, 4705), 4700), 0),
     'a bar whose low IS the limit reads 0 — the kiss this exists to find');

  ok(near(ogXmFillDepth('SELL_LIMIT', 'short', bar(4690, 4705, 4688, 4700), 4700), 5),
     'a sell limit is measured from the high');
  ok(near(ogXmFillDepth('BUY_STOP', 'long', bar(4690, 4705, 4688, 4700), 4700), 5),
     'a buy stop triggers upward, so it is measured from the high too');
  ok(near(ogXmFillDepth('SELL_STOP', 'short', bar(4710, 4712, 4695, 4705), 4700), 5),
     'and a sell stop from the low');
}

console.log('\n== a reading that does not apply is null, never 0 ==');
{
  /* 0 means "the worst possible fill". A market order has no queue at all,
     so reporting 0 for it would rank it alongside an extreme-tick limit. */
  ok(ogXmFillDepth('BUY', 'long', bar(4700, 4712, 4695, 4705), 4700) === null,
     'a market BUY has no depth — it fills at the open');
  ok(ogXmFillDepth('SELL', 'short', bar(4700, 4712, 4695, 4705), 4700) === null,
     'and neither does a market SELL');

  ok(ogXmFillDepth('BUY_LIMIT', 'long', null, 4700) === null, 'no bar yields null');
  ok(ogXmFillDepth('BUY_LIMIT', 'long', bar(4710, 4712, 4705, 4708), 0) === null,
     'no entry price yields null');
  ok(ogXmFillDepth('BUY_LIMIT', 'long', { h: NaN, l: NaN }, 4700) === null,
     'an unusable bar yields null rather than NaN');
}

console.log('\n== depth and the fill test agree about what filled ==');
{
  /* the two functions must never disagree: anything the walk calls a fill
     must have a depth, and anything it does not must not */
  const cases = [
    ['BUY_LIMIT', 'long', bar(4710, 4712, 4695, 4705), 4700],
    ['BUY_LIMIT', 'long', bar(4710, 4712, 4705, 4708), 4700],   /* never reached */
    ['SELL_LIMIT', 'short', bar(4690, 4705, 4688, 4700), 4700],
    ['SELL_LIMIT', 'short', bar(4690, 4695, 4688, 4692), 4700], /* never reached */
    ['BUY_STOP', 'long', bar(4690, 4705, 4688, 4700), 4700],
    ['SELL_STOP', 'short', bar(4710, 4712, 4695, 4705), 4700]
  ];
  for (const [type, dir, b, e] of cases){
    const touched = ogXmBarTouchesEntry(type, dir, b, e);
    const depth = ogXmFillDepth(type, dir, b, e);
    ok(touched === (depth != null),
       type + (touched ? ' fills and has a depth' : ' does not fill and has none'));
  }
}

console.log('\n== the walk records it, normalised two ways ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold.mjs'), 'utf8');
  ok(/tr\.fillDepth = ogXmFillDepth\(/.test(src), 'the walk measures depth at the moment of fill');
  ok(/fillDepthR:/.test(src), 'and emits it in risk units');
  ok(/fillDepthBar:/.test(src), 'and as a fraction of the fill bar range');
  /* division by a zero range or zero risk must produce null, not Infinity */
  ok(/!\(Math\.abs\(tr\.stop - tr\.entry\) > 0\)/.test(src),
     'a zero-risk row yields null rather than dividing by it');
  ok(/!\(tr\.fillBarRange > 0\)/.test(src), 'and so does a zero-range bar');
}

console.log('\n== the current artifact cannot answer it yet, and says so ==');
{
  /* the honest state: the shipped walk predates this field. The test asserts
     that rather than pretending the question is answered. */
  const walk = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
  const withDepth = walk.trades.filter(r => typeof r.fillDepthR === 'number');
  ok(withDepth.length === 0,
     'no row in the shipped artifact carries fill depth — it was generated before this existed');
  ok(walk.trades.length > 1000,
     'so the question stands open on ' + walk.trades.length + ' rows until the next walk runs');
}

console.log('\n' + passed + ' passed, 0 failed');
