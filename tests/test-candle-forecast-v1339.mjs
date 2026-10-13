/* hg-v1339: key reversal, pipe, runaway gap, and the rest of the cached
   free gold feeds. Disclosure. The feeds stay unread as a family. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };
const src = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
function lift(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const ctx = { console, Math, isFinite, isNaN, Infinity, Number, String, Object, Array, RegExp, Error };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(['hgCfPack', 'hgCfCandlePatterns', 'hgCfAdvancedPatterns', 'aAdvance', 'hgCfLocatedSide', 'hgCfFeedBoard'].map(lift).join('\n'), ctx);
const ATR = 2;
const bar = (o, h, l, c) => ({ o, h, l, c, t: 0, v: 100 });
function tape(tail) {
  const out = [];
  for (let i = 0; i < 30; i++) out.push(bar(2300, 2301, 2299, 2300));
  return out.concat(tail);
}
function read(tail) { return ctx.hgCfAdvancedPatterns(tape(tail), ATR); }
function names(tail) { return read(tail).names.join(' | '); }

console.log('== 1) the shapes the classic set did not name ==');
{
  const key = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2304, 2298, 2303),
    bar(2297.5, 2303.8, 2296, 2303.6)
  ];
  ok(names(key).indexOf('bullish key reversal') >= 0, 'a bullish key reversal is named (' + names(key) + ')');
  ok(names(key).indexOf('bullish outside key reversal') < 0, 'a one-sided extreme is not called outside');

  const outside = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2304, 2298, 2303),
    bar(2297.2, 2304.4, 2296.2, 2304.1)
  ];
  ok(names(outside).indexOf('bullish outside key reversal') >= 0, 'an outside key reversal is named (' + names(outside) + ')');

  const pipe = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2304, 2298, 2303.2),
    bar(2301, 2305, 2298.1, 2304.5)
  ];
  ok(names(pipe).indexOf('pipe bottom') >= 0, 'a pipe bottom is named (' + names(pipe) + ')');

  const run = [
    bar(2302, 2306, 2299, 2305),
    bar(2304, 2305.2, 2303.6, 2304.8),
    bar(2304, 2305, 2303.5, 2304.5),
    bar(2306, 2307, 2305.2, 2306.5)
  ];
  const rr = read(run);
  ok(rr.names.indexOf('runaway gap up') >= 0, 'a runaway gap is named (' + rr.names.join(' | ') + ')');
  const sense = (rr.notes || []).filter(function (n) { return /Understanding: runaway gap up is a continuation/.test(n); });
  ok(sense.length === 1, 'the runaway gap is a continuation (' + (sense[0] || '') + ')');
  ok(/does not add a vote/.test(sense[0] || ''), 'and it does not add a vote');
  const loc = ctx.hgCfLocatedSide(rr);
  ok(loc.bull.indexOf('runaway gap up') >= 0, 'a runaway gap that agrees with the drift can name the shape');
  ok(loc.clash === false, 'one continuation is not a clash');
}

console.log('\n== 2) disclosure stays disclosure ==');
{
  const call = src.slice(src.indexOf('var adv = hgCfAdvancedPatterns'), src.indexOf('var adv = hgCfAdvancedPatterns') + 420);
  ok(!/bulls\s*\+=\s*adv\./.test(call), 'advanced leans are not added to bulls');
  ok(!/rawStop[^\n]*adv\./.test(call), 'advanced stops are not the trade stop');
  ok(/DISCLOSURE, NOT WEIGHT/.test(src), 'the layer is still disclosure, not weight');
  const body = lift('hgCfConfluence').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/score|weight|points|rating/i.test(body), 'the confluence composer still has no score');
  ok(/out\.ticket = !!\(nPat > 0 && famWith >= 2 && famAgainst === 0\)/.test(body), 'the ticket line is unchanged');
  ok(/voter\('feeds', 'news and free feeds', null/.test(src), 'the feed family still does not lean');
}

console.log('\n== 3) the cached free feeds and sentiment are listed, not a side ==');
{
  const dark = ctx.hgCfFeedBoard({});
  ok(/sentiment unread/.test(dark.why), 'a missing sentiment print is unread');
  ok(/gold macro feed unread/.test(dark.why), 'no macro is still unread');
  const hot = ctx.hgCfFeedBoard({
    macro: { realRateHint: 'HEADWIND', dxy: { trend20: 'RISING' }, silverTrend: 'FALLING', vixTrend: 'RISING' }
  });
  ok(/USDJPY unread/.test(hot.why), 'USDJPY stays unread when the cache did not measure it');
  ok(/gold\/copper unread/.test(hot.why), 'gold/copper stays unread');
  ok(/gold-SPX 20d corr unread/.test(hot.why), 'a missing correlation is not given a band');
  ok(/gold\/silver unread/.test(hot.why), 'a leg that was already unread stays unread');
  ok(/sentiment unread/.test(hot.why), 'sentiment is unread until a fresh print exists');
  ctx.hgSentimentGet = function () {
    return { fresh: true, missing: false, sourceCount: 3, score: 0.42 };
  };
  const sent = ctx.hgCfFeedBoard({ macro: { realRateHint: 'TAILWIND', goldSpxCorr20: 0.2, goldBtcCorr20: -0.15 } });
  ok(/sentiment 0\.42 from 3 sources/.test(sent.why), 'a fresh sentiment print is listed (' + sent.why.slice(0, 80) + ')');
  ok(/listed, not a side/.test(sent.why), 'the print says it is not a side');
  ok(/gold-SPX 20d corr 0\.20/.test(sent.why), 'the cached correlation is the number, not a vote');
  ctx.hgSentimentGet = function () { return { fresh: false, missing: false, sourceCount: 3, score: 0.9 }; };
  const stale = ctx.hgCfFeedBoard({ macro: { realRateHint: 'NEUTRAL' } });
  ok(/sentiment unread/.test(stale.why), 'a stale sentiment print is unread');
}

console.log('\ntest-candle-forecast-v1339: ' + pass + ' passed');
