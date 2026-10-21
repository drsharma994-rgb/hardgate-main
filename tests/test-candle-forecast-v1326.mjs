/* hg-v1326: pattern roles, the remaining classic shapes, and the feed board.
   The new shapes are disclosure. News and the macro feeds are listed and
   do not cast a second vote. */
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
vm.runInContext(['hgCfPack', 'hgCfCandlePatterns', 'hgCfAdvancedPatterns', 'aAdvance', 'hgCfFeedBoard'].map(lift).join('\n'), ctx);
const ATR = 2;
const bar = (o, h, l, c) => ({ o, h, l, c, t: 0, v: 100 });
function tape(tail) {
  const out = [];
  for (let i = 0; i < 30; i++) out.push(bar(2300, 2301, 2299, 2300));
  return out.concat(tail);
}
function read(tail) { return ctx.hgCfAdvancedPatterns(tape(tail), ATR); }
function names(tail) { return read(tail).names.join(' | '); }

console.log('== 1) the shapes still missing are named, and they do not vote ==');
{
  const atk = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2310, 2310.2, 2304, 2304.4),
    bar(2303.2, 2304.6, 2303.0, 2304.35)
  ];
  ok(names(atk).indexOf('bullish counterattack') >= 0, 'a bullish counterattack is named (' + names(atk) + ')');

  const star = [
    bar(2300, 2301, 2299, 2300),
    bar(2310, 2310.4, 2303.6, 2304),
    bar(2302.2, 2302.5, 2302.0, 2302.22),
    bar(2302.4, 2308.4, 2302.2, 2308.2)
  ];
  ok(names(star).indexOf('morning doji star') >= 0, 'a morning doji star is named (' + names(star) + ')');

  const tak = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2302.2, 2302.55, 2300.2, 2302.5)
  ];
  ok(names(tak).indexOf('takuri line') >= 0, 'a takuri line is named (' + names(tak) + ')');

  const maru = [
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2300, 2301, 2299, 2300),
    bar(2304, 2306.05, 2303.5, 2306)
  ];
  ok(names(maru).indexOf('bullish closing marubozu') >= 0, 'a bullish closing marubozu is named (' + names(maru) + ')');

  const gap = [
    bar(2300, 2304, 2299.6, 2303.8),
    bar(2305.2, 2306, 2305, 2305.6),
    bar(2305.5, 2306.1, 2305.3, 2305.9),
    bar(2305.8, 2306.4, 2305.6, 2306.2)
  ];
  ok(names(gap).indexOf('high-price gapping play') >= 0, 'a high-price gapping play is named (' + names(gap) + ')');
}

console.log('\n== 2) a continuation is described as a continuation, and that sentence does not name the setup ==');
{
  const f = bar(2300, 2307.0, 2299.6, 2306.6);
  const e1 = bar(2304.0, 2304.7, 2303.9, 2304.6);
  const sm1 = bar(2304.2, 2304.9, 2304.0, 2304.8);
  const sm2 = bar(2304.4, 2305.1, 2304.2, 2305.0);
  const sm3 = bar(2304.6, 2305.3, 2304.4, 2305.2);
  const dl = bar(2305.2, 2308.6, 2305.0, 2308.4);
  const r = read([f, e1, sm1, sm2, sm3, dl]);
  ok(r.names.indexOf('rising three methods') >= 0, 'rising three methods still names');
  const sense = (r.notes || []).filter(function (n) { return /Understanding: rising three methods is a continuation/.test(n); });
  ok(sense.length === 1, 'the role line says it is a continuation (' + sense.join(' | ') + ')');
  ok(/does not add a vote/.test(sense[0] || ''), 'and it says it does not add a vote');
  ok(sense[0].indexOf('rising three methods') !== 0, 'the role line does not start with the pattern name');
  ok(sense[0].indexOf('where this pattern means something') < 0, 'the role line does not reuse the setup-namer phrase');
}

console.log('\n== 3) news and the macro feeds are listed and do not vote ==');
{
  const dark = ctx.hgCfFeedBoard({});
  ok(dark && dark.dark === true, 'a page with no news engine and no macro is dark');
  ok(/news calendar unread/.test(dark.why), 'the calendar is named unread (' + dark.why.slice(0, 80) + ')');
  ok(/gold macro feed unread/.test(dark.why), 'the macro feed is named unread');
  ok(/fear and greed unread/.test(dark.why) && /headlines unread/.test(dark.why), 'fear and greed and headlines are named unread');
  ok(/COT unread/.test(dark.why) && /funding unread/.test(dark.why), 'COT and funding are named unread');

  ctx.hgNewsRisk = function () {
    return { unchecked: false, blackout: true, risk: 'high', events: [{ title: 'CPI' }] };
  };
  ctx.hgNewsState = function () {
    return { fng: { value: 82, classification: 'Extreme Greed' }, headlines: [{ title: 'Gold bid', sentiment: 'bullish' }] };
  };
  const hot = ctx.hgCfFeedBoard({
    macro: { realRateHint: 'HEADWIND', dxy: { trend20: 'RISING' }, silverTrend: 'FALLING', vixTrend: 'RISING' }
  });
  ok(/news BLACKOUT/.test(hot.why), 'a red-folder window is named (' + hot.why.slice(0, 120) + ')');
  ok(/CPI/.test(hot.why), 'the calendar event is named');
  ok(/fear and greed 82/.test(hot.why), 'fear and greed is the cached value');
  ok(/headlines 1 bullish/.test(hot.why), 'a headline lean is counted, not voted');
  ok(/real rates HEADWIND/.test(hot.why) && /DXY RISING/.test(hot.why), 'the cached macro legs are named');
  ok(/gold\/silver unread/.test(hot.why), 'a macro leg that was not in the snapshot stays unread');
  ok(hot.dark === false, 'a live calendar is not a dark board');
}

console.log('\n== 4) the advanced layer still does not vote, and the disclosure phrase stays ==');
{
  const call = src.slice(src.indexOf('var adv = hgCfAdvancedPatterns'), src.indexOf('var adv = hgCfAdvancedPatterns') + 420);
  ok(!/bulls\s*\+=\s*adv\./.test(call), 'advanced leans are not added to bulls');
  ok(!/rawStop[^\n]*adv\./.test(call), 'advanced stops are not the trade stop');
  ok(/DISCLOSURE, NOT WEIGHT/.test(src), 'the advanced layer is still disclosure, not weight');
  const body = lift('hgCfConfluence').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/score|weight|points|rating/i.test(body), 'the confluence composer still has no score');
  ok(/out\.ticket = !!\(nPat > 0 && famWith >= 2 && famAgainst === 0\)/.test(body), 'the ticket line is unchanged');
  ok(/voter\('feeds', 'news and free feeds', null/.test(src), 'the feed board is wired as unread');
  const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(/do not cast a second vote/.test(tab), 'the card says the feeds do not cast a second vote');
  ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');
}

console.log('\ntest-candle-forecast-v1326: ' + pass + ' passed');
