/* hg-v1320: more candle shapes, named not voted, and a higher-timeframe confirm. */
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
ctx.atr = (rows, n) => {
  const trs = rows.map((r, i) => {
    if (!i) return r.h - r.l;
    const q = rows[i - 1];
    return Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
  });
  const out = [];
  for (let i = 0; i < trs.length; i++) {
    if (i < n - 1) { out.push(trs[i]); continue; }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += trs[j];
    out.push(s / n);
  }
  return out;
};
vm.createContext(ctx);
vm.runInContext(['hgCfPack', 'hgCfAdvancedPatterns', 'hgCfStructure', 'aAdvance', 'hgCfHigherFrame', 'hgCfLocatedSide'].map(lift).join('\n'), ctx);
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

const tower = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.4, 2304, 2304.4),
  bar(2304.6, 2305.2, 2304.2, 2304.8),
  bar(2304.8, 2305.4, 2304.4, 2305.0),
  bar(2305.2, 2312.2, 2304.8, 2311.2)
]);
ok(tower.indexOf('tower bottom') >= 0, 'a tower bottom is named (' + tower + ')');

const neck = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.3, 2303.5, 2304),
  bar(2302, 2304.2, 2301.6, 2303.5)
]);
ok(neck.indexOf('on-neck line') >= 0, 'an on-neck line is named (' + neck + ')');

const stars = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2310, 2310.3, 2302, 2306),
  bar(2306, 2306.3, 2303, 2304),
  bar(2304, 2304.2, 2303.1, 2303.2)
]);
ok(stars.indexOf('three stars in the south') >= 0, 'three stars in the south are named (' + stars + ')');

const mat = names([
  bar(2300, 2308.4, 2299.6, 2308),
  bar(2307.2, 2307.8, 2304.4, 2306.2),
  bar(2306.4, 2307.0, 2304.6, 2305.8),
  bar(2306.0, 2306.8, 2304.8, 2306.2),
  bar(2306.2, 2309.4, 2305.6, 2309)
]);
ok(mat.indexOf('mat hold') >= 0, 'a mat hold is named (' + mat + ')');

const hook = names([
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2300, 2301, 2299, 2300),
  bar(2308, 2308.3, 2301.5, 2302),
  bar(2301.2, 2308.8, 2301.0, 2308.5)
]);
ok(hook.indexOf('bullish hook reversal') >= 0, 'a bullish hook is named (' + hook + ')');

ok(!/bulls\s*\+=\s*adv\.|bears\s*\+=\s*adv\./.test(src), 'the new shapes still do not vote');
const unread = ctx.hgCfHigherFrame(null);
ok(unread.bullNames.length === 0 && /unread/.test(unread.line), 'no higher tape stays unread (' + unread.line + ')');

function wave(dir) {
  const rows = [];
  let px = 2000;
  for (let i = 0; i < 20; i++) { px += dir * 2; rows.push(bar(px - dir, px + 1, px - 1, px)); }
  for (let i = 0; i < 12; i++) { px -= dir * 1.5; rows.push(bar(px + dir, px + 1, px - 1, px)); }
  px += dir * 8;
  rows.push(bar(px - dir * 2, px + dir, px - dir, px));
  return rows;
}
const split = ctx.hgCfHigherFrame({ rows4h: wave(1), rows1d: wave(-1) });
ok(split.bullNames.length === 0 && split.bearNames.length === 0,
  'a higher frame with no one-sided structure does not invent a confirm (' + split.line + ')');

console.log('\ntest-candle-forecast-v1320: ' + pass + ' passed');
