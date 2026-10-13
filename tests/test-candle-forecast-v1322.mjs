/* hg-v1322: the rest of the classic candle set, still disclosure. */
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
const ctx = { console, Math, isFinite, isNaN, Infinity };
vm.createContext(ctx);
vm.runInContext(['hgCfPack', 'hgCfCandlePatterns', 'hgCfAdvancedPatterns', 'aAdvance'].map(lift).join('\n'), ctx);
const ATR = 2;
const bar = (o, h, l, c) => ({ o, h, l, c, t: 0, v: 100 });
function tape(tail) {
  const out = [];
  for (let i = 0; i < 30; i++) out.push(bar(2300, 2301, 2299, 2300));
  return out.concat(tail);
}
function read(tail) { return ctx.hgCfAdvancedPatterns(tape(tail), ATR); }
function names(tail) { return read(tail).names.join(' | '); }

ok(names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.4, 2303.6, 2304),
  bar(2306, 2306.2, 2305.8, 2306.02)
]).indexOf('bullish harami cross') >= 0, 'a bullish harami cross is named');

ok(names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2300.4, 2299.7, 2300.02),
  bar(2302.2, 2302.6, 2301.9, 2302.22),
  bar(2300, 2300.3, 2299.8, 2300.02)
]).indexOf('tri-star top') >= 0, 'a tri-star top is named (' + names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2300.4, 2299.7, 2300.02),
  bar(2302.2, 2302.6, 2301.9, 2302.22),
  bar(2300, 2300.3, 2299.8, 2300.02)
]) + ')');

const north = [
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2312, 2299.6, 2304),
  bar(2304, 2308, 2303.6, 2306),
  bar(2305.2, 2306.4, 2304.8, 2306)
];
ok(names(north).indexOf('three stars in the north') >= 0, 'three stars in the north are named (' + names(north) + ')');

ok(names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2308, 2299.6, 2307.6),
  bar(2307.4, 2316, 2307.2, 2315.6),
  bar(2312, 2316.8, 2311.6, 2313)
]).indexOf('stalled pattern') >= 0, 'a stalled pattern is named');

ok(names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.4, 2303.2, 2304),
  bar(2303.6, 2307.2, 2303.4, 2306.2)
]).indexOf('thrusting line') >= 0, 'a thrusting line is named');

ok(names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2308, 2299.6, 2307.6),
  bar(2309, 2309.4, 2306.2, 2306.6),
  bar(2308.2, 2308.6, 2302, 2304)
]).indexOf('two crows') >= 0, 'two crows are named');

ok(names([
  bar(2310, 2310.4, 2302, 2302.4),
  bar(2301.2, 2301.6, 2298.4, 2298.8),
  bar(2301.3, 2301.7, 2298.5, 2298.9),
  bar(2299, 2299.4, 2298.6, 2299.2)
]).indexOf('side-by-side black lines') >= 0, 'side-by-side black lines are named');

const fry = [];
let lo = 2299.2;
for (let i = 0; i < 7; i++) {
  fry.push(bar(lo + 0.3, lo + 0.6, lo, lo + 0.4));
  lo += 0.4;
}
const prev = fry[fry.length - 1];
fry.push(bar(prev.h + 0.8, prev.h + 2.2, prev.h + 0.4, prev.h + 2));
ok(names(fry).indexOf('frypan bottom') >= 0, 'a frypan bottom is named (' + names(fry) + ')');

const hiDoji = read([bar(2320, 2320.3, 2319.8, 2320.02)]);
ok(hiDoji.names.indexOf('northern doji') >= 0, 'a doji at the range high is a northern doji');
const leg = names([bar(2304, 2306, 2302, 2304.05)]);
ok(leg.indexOf('long-legged doji') >= 0, 'a long-legged doji is named (' + leg + ')');

const call = src.slice(src.indexOf('var adv = hgCfAdvancedPatterns'), src.indexOf('var adv = hgCfAdvancedPatterns') + 420);
ok(!/bulls|bears|checked|rawStop/.test(call), 'the advanced call still touches no vote or stop');
ok(!/bulls\s*\+=\s*adv\.|bears\s*\+=\s*adv\./.test(src), 'the new shapes do not vote');
ok(/DISCLOSURE, NOT WEIGHT/.test(src), 'the advanced layer is still disclosure, not weight');
ok(/Master Catalog frame', null/.test(src), 'the catalog frame still does not vote a side');

const ago = read([
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.4, 2303.4, 2304),
  bar(2303.6, 2311.2, 2303.2, 2310.8),
  bar(2310.6, 2311, 2310.2, 2310.4)
]);
ok(ago.notes.some(n => /one bar ago:/.test(n) && /does not name the setup/.test(n)),
  'a pattern on the previous bar is disclosed and does not name this bar (' + ago.notes.join(' | ') + ')');
ok(!ago.leans.some(L => /one bar ago/.test(L.name)), 'that previous bar is not a lean');

const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
ok(/data-cf-swing="1"/.test(tab), 'the swing still prints its own confluence');
ok(/GOLD DESKS ON THE 4h TAPE/.test(tab), 'and the 4h desks stay on the card');
ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');

console.log('\ntest-candle-forecast-v1322: ' + pass + ' passed');
