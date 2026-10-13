/* hg-v1333: the live 4h swing stays on the card. Confirmed swings for the day stay capped at two. */
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
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const ctx = { console, Math, Date, isFinite, Number, String };
vm.createContext(ctx);
vm.runInContext(lift('hgCfDaySwings') + '\nthis.hgCfDaySwings = hgCfDaySwings;', ctx);

const t0 = Date.UTC(2026, 9, 14, 8, 0, 0);
function tape(n, step) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ t: t0 + i * step, o: 100, h: 101, l: 99, c: 100 + i });
  return rows;
}
function formedAt(close) {
  return { formed: true, dir: 'BULL', label: 'LONG SETUP', entry: close, stop: close - 1, tp1: close + 1, tp2: close + 2, parts: 'hammer' };
}

console.log('== two confirmed swings, and no more ==');
{
  const rows = tape(36, 60000);
  let fed = 0;
  ctx.goldCandleForecast = function (slice, macro, tapes) {
    if (tapes) fed++;
    return { dir: 'BULL', close: slice[slice.length - 1].c };
  };
  ctx.hgCfBuildSetup = function (slice, opts, fc) {
    if (opts.tf !== '4h') throw new Error('not a swing');
    return formedAt(fc.close);
  };
  const live = formedAt(999);
  const day = ctx.hgCfDaySwings(rows, { live: live, limit: 2 });
  ok(day.setups.length === 2, 'only two are published (' + day.setups.length + ')');
  ok(day.stoodDown === 4, 'the earlier confirmed swings are stood down (' + day.stoodDown + ')');
  ok(day.setups[1].entry === 999 && day.setups[1].stop === 998, 'the latest keeps the builder prices');
  ok(fed === 0, 'higher frames are not fed into the day walk');
  ok(/Two are enough for the day/.test(day.why), 'the line says two are enough (' + day.why + ')');
  ok(day.setups.every(function (s) { return s.tf === '4h'; }), 'every published setup is a swing');
}

console.log('\n== an unconfirmed read is not a setup ==');
{
  const rows = tape(36, 60000);
  ctx.goldCandleForecast = function () { return { dir: 'BULL' }; };
  ctx.hgCfBuildSetup = function () { return { formed: false, dir: 'BULL', entry: 100, stop: 99, tp1: 101 }; };
  const none = ctx.hgCfDaySwings(rows, { live: { formed: false, dir: 'BULL', entry: 100, stop: 99, tp1: 101 }, limit: 2 });
  ok(none.setups.length === 0, 'nothing unconfirmed is published');
  ok(/Nothing was invented/.test(none.why), 'and nothing is invented (' + none.why + ')');
  const against = ctx.hgCfDaySwings(rows, {
    live: { formed: true, dir: 'BULL', label: 'LONG SETUP', entry: 100, stop: 99, tp1: 101, confluenceView: { familiesAgainst: 1 } },
    limit: 2
  });
  ok(against.setups.length === 0, 'a family against is not a confirmation');
}

console.log('\n== a broken clock does not walk the future ==');
{
  const rows = tape(36, 60000);
  rows[10].t = rows[9].t;
  let calls = 0;
  ctx.goldCandleForecast = function () { calls++; return { dir: 'BULL' }; };
  ctx.hgCfBuildSetup = function () { calls++; return formedAt(100); };
  const live = formedAt(50);
  const day = ctx.hgCfDaySwings(rows, { live: live, limit: 2 });
  ok(calls === 0, 'unordered times are not walked');
  ok(day.setups.length === 1 && day.setups[0].entry === 50, 'only the current confirmed swing remains');
}

console.log('\n== the card ==');
{
  const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(/data-cf-day-swings="1"/.test(tab), 'the card has a confirmed-swing block');
  ok(/two are enough for the day/.test(tab), 'the card says two are enough');
  ok(/data-cf-swing-always="1"/.test(tab), 'the live swing is on the card every scan');
  ok(/shown on every scan/.test(tab), 'the card says the swing is shown on every scan');
  ok(!/it is not shown/.test(tab), 'a swing is not hidden for missing the day list');
  ok(!/NO CONFIRMED SWING/.test(tab), 'the headline is the live swing, not the empty confirmed list');
  ok(/Not published/.test(tab), 'the scalp is not published');
  ok(/hgCfDaySwings\([\s\S]{0,120}forecast\.swing/.test(tab), 'the list is the swing, not the scalp');
  ok(/SCALP AND SWING/.test(tab), 'the horizon heading remains');
  ok(/not the same risk/.test(tab), 'the two stops are still not the same risk');
  ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');
  ok(!/bothBrackets/.test(tab), 'the card does not paint both brackets');
  const iDay = tab.indexOf('hgCfDaySwings(');
  const iRend = tab.indexOf('this.renderResult(resultArea, statusEl, forecast);');
  ok(iDay > 0 && iDay < iRend, 'the day list is built before the card is painted');
  ok(/this\.renderResult\(resultArea, statusEl, forecast\);[\s\S]{0,500}hgUltimateConfluence\(candles\)/.test(tab),
    'the wide tally still paints after the card');
  const body = lift('hgCfDaySwings');
  ok(/goldCandleForecast\(slice, null, null\)/.test(body), 'the day walk passes no higher tape');
  ok(!/limit:\s*[^2\n]/.test(body) || /limit: limit/.test(body), 'the cap is the caller\'s, defaulting to two');
}

console.log('\ntest-candle-forecast-v1330: ' + pass + ' passed');
