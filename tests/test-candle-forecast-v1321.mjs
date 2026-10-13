/* hg-v1321: more candle shapes, named not voted, and both horizons carry the confluence. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };
const src = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
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
const ctx = { console, Math, isFinite, isNaN, Infinity, Object, String, Array };
vm.createContext(ctx);
vm.runInContext(['hgCfPack', 'hgCfAdvancedPatterns', 'hgCfLocatedSide'].map(lift).join('\n'), ctx);
const ATR = 2;
const bar = (o, h, l, c) => ({ o, h, l, c, t: 0, v: 100 });
function tape(tail) {
  const out = [];
  for (let i = 0; i < 30; i++) out.push(bar(2300, 2301, 2299, 2300));
  return out.concat(tail);
}
function names(tail) {
  return ctx.hgCfAdvancedPatterns(tape(tail), ATR).names.join(' | ');
}

const pigeon = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.2, 2304.2, 2304.6),
  bar(2306.2, 2306.4, 2305.4, 2305.6)
]);
ok(pigeon.indexOf('homing pigeon') >= 0, 'a homing pigeon is named (' + pigeon + ')');

const hawk = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2284, 2290.4, 2283.6, 2290),
  bar(2285.2, 2287.2, 2285, 2287)
]);
ok(hawk.indexOf('descending hawk') >= 0, 'a descending hawk is named (' + hawk + ')');

const hik = names([
  bar(2300, 2308, 2299.6, 2306),
  bar(2302, 2306, 2302.2, 2304),
  bar(2303, 2304.2, 2300.4, 2303.2),
  bar(2303.4, 2307.2, 2303, 2306.8)
]);
ok(hik.indexOf('bullish hikkake') >= 0, 'a bullish hikkake is named (' + hik + ')');

const gapping = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.2, 2303.6, 2304),
  bar(2302, 2302.2, 2297.4, 2298)
]);
ok(gapping.indexOf('two black gapping') >= 0, 'two black gapping is named (' + gapping + ')');

const crows = names([
  bar(2300, 2301, 2299, 2300),
  bar(2312, 2312.2, 2307.6, 2308),
  bar(2308, 2308.2, 2303.6, 2304),
  bar(2304, 2304.2, 2299.6, 2300)
]);
ok(crows.indexOf('identical three crows') >= 0, 'identical three crows are named (' + crows + ')');

const gaps = names([
  bar(2290, 2292, 2289.6, 2291.5),
  bar(2293.2, 2295, 2293, 2294.6),
  bar(2296.2, 2298, 2296, 2297.6),
  bar(2299.2, 2301.2, 2299, 2300.8)
]);
ok(gaps.indexOf('three gaps up') >= 0, 'three gaps up are named (' + gaps + ')');

const brk = names([
  bar(2320, 2320.2, 2309.5, 2310),
  bar(2308, 2308.8, 2303.4, 2304),
  bar(2304, 2304.2, 2301.2, 2302),
  bar(2302.2, 2303, 2301.6, 2302.4),
  bar(2306, 2314, 2305.6, 2312)
]);
ok(brk.indexOf('bullish breakaway') >= 0, 'a bullish breakaway is named (' + brk + ')');

const river = names([
  bar(2300, 2301, 2299, 2300),
  bar(2312, 2312.2, 2303.5, 2304),
  bar(2305, 2305.2, 2301, 2303.8),
  bar(2303.2, 2304.4, 2303, 2304.2)
]);
ok(river.indexOf('unique three river bottom') >= 0, 'a unique three river bottom is named (' + river + ')');

const wave = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2304, 2306, 2302, 2304.4)
]);
ok(wave.indexOf('high wave') >= 0, 'a high wave is named (' + wave + ')');

const call = src.slice(src.indexOf('var adv = hgCfAdvancedPatterns'), src.indexOf('var adv = hgCfAdvancedPatterns') + 420);
ok(!/bulls|bears|checked|rawStop/.test(call), 'the advanced call still touches no vote or stop');
ok(!/bulls\s*\+=\s*adv\.|bears\s*\+=\s*adv\./.test(src), 'the new shapes do not vote');
ok(/DISCLOSURE, NOT WEIGHT/.test(src), 'the advanced layer is still disclosure, not weight');

const down = [];
let px = 2400;
for (let i = 0; i < 24; i++) { px -= 1.2; down.push(bar(px + 1.2, px + 1.4, px - 0.2, px)); }
down.push(bar(px, px + 0.2, px - 6.4, px - 6));
down.push(bar(px - 8, px - 7.6, px - 12, px - 11));
const adv = ctx.hgCfAdvancedPatterns(down, ATR);
const located = ctx.hgCfLocatedSide(adv);
ok(adv.names.indexOf('two black gapping') >= 0, 'the declining tape names two black gapping (' + adv.names.join(', ') + ')');
ok(located.bear.indexOf('two black gapping') >= 0 && located.bull.length === 0,
  'a continuation that agrees with the drift can name the short (' + located.bear.join(', ') + ')');

ok(/confluenceView/.test(src), 'the bracket carries the confluence the horizon already computed');
ok(/data-cf-swing="1"/.test(tab), 'the card prints the swing confluence on its own');
ok(/GOLD DESKS ON THE 4h TAPE/.test(tab), 'and names every gold desk on the 4h tape');
ok(/indicator stack context/.test(src), 'the rest of the indicator bag is disclosed as context');
ok(/Master Catalog frame', null/.test(src), 'the catalog frame still does not vote a side');
ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');

console.log('\ntest-candle-forecast-v1321: ' + pass + ' passed');
