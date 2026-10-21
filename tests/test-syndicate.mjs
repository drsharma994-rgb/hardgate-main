/* SYNDICATE — the CoinDCX relay stands by when a stage is unread, and it
   never turns a headline or a missing liquidation map into a price.
   Run: node tests/test-syndicate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {
  console, Math, Date, JSON, Number, String, Array, Object, RegExp,
  isFinite, isNaN, parseFloat, parseInt
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'syndicate.js'), 'utf8'), ctx, { filename: 'syndicate.js' });

let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

function longTape(){
  const n = 19;
  const H = Array(n).fill(106);
  const L = Array(n).fill(104);
  const C = Array(n).fill(105);
  function set(i, h, l, c){ H[i] = h; L[i] = l; C[i] = c; }
  set(2, 106, 103, 105);
  set(4, 108, 104, 106);
  set(6, 105, 98, 100);
  set(8, 112, 104, 108);
  set(10, 107, 99.5, 102);
  set(12, 108, 103, 106);
  set(13, 109, 101, 105);
  set(14, 130, 112, 120);
  set(15, 118, 110, 114);
  set(16, 114, 112, 113);
  set(17, 117, 113, 115);
  set(18, 117, 115.5, 116.5);
  for (let i = 0; i < n; i++){
    if (H[i] < C[i]) H[i] = C[i];
    if (L[i] > C[i]) L[i] = C[i];
  }
  return C.map((c, i) => ({ t: i + 1, o: c, h: H[i], l: L[i], c: c, v: 1 }));
}
function calm15(){
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ t: i + 1, o: 116, h: 116.4, l: 115.6, c: 116, v: 1 });
  return rows;
}
const NOW = Date.parse('2026-01-05T12:00:00Z');
function baseInput(extra){
  const tape = longTape();
  return Object.assign({
    pair: 'B-BTC_USDT',
    nowMs: NOW,
    bars: { '4h': tape, '1h': tape, '15m': calm15() },
    headlines: [],
    whale: null,
    events: [],
    memory: []
  }, extra || {});
}

console.log('== the desk states its own rules ==');
{
  const S = ctx.HG_SYNDICATE_SPEC;
  ok(S.feeRt === 0.002, 'house CoinDCX round-trip is 0.20%');
  ok(S.minNetRr === 2.2 && S.atrStopMult === 1.5 && S.atrLen === 14, 'stop is 1.5 ATR and the net floor is 2.2');
  ok(S.btcdAltLong === 55 && S.majors.BTC === 1, 'alt longs use the house 55% BTC.D line; BTC is a major');
  ok(!fs.readFileSync(path.join(ROOT, 'syndicate.js'), 'utf8').includes('/api/execute'), 'the file has no order endpoint');
}

console.log('\n== a long blueprint, and what is not allowed to move it ==');
{
  const live = ctx.hgSyndicateRead(baseInput());
  ok(live.status === 'blueprint' && live.dir === 'long', '4h long with a 1h agreement is a blueprint (' + live.reason + ')');
  ok(live.leverage == null && live.blueprint.leverage == null, 'leverage is not suggested');
  ok(live.blueprint.entry1 === 114 && near(live.blueprint.entry2, 114.75), 'entries are the two limits inside the gap, not the close');
  ok(live.blueprint.entry1 !== live.stages.architect.h4.close, 'the signal close is not the entry');
  ok(near(live.blueprint.stop, 114 - 1.5 * 0.8), 'stop is the zone low minus 1.5 ATR (' + live.blueprint.stop + ')');
  ok(live.blueprint.t1 === 130 && live.blueprint.t2 == null, 'TP1 is the 4h swing above; TP2 is unread rather than invented');
  ok(live.blueprint.rr >= 2.2, 'net R clears 2.2');
  ok(live.agreed === 3 && live.of === 5, 'three stages agreed and the two unread ones were not counted in');
  ok(live.lines.some(l => l.indexOf('zone is not moved') >= 0), 'the sniper says the zone was not moved');
  const funded = ctx.hgSyndicateRead(baseInput({ fundingPct: 0.08 }));
  ok(funded.blueprint.entry1 === live.blueprint.entry1 && funded.blueprint.stop === live.blueprint.stop,
    'a funding print without a liquidation map does not slide the entry');
  const html = ctx.hgSyndicateHtml(live);
  ok(html.indexOf('STATUS BLUEPRINT') >= 0 && html.indexOf('Not the live print') >= 0, 'the card names the fill and says it is not the live print');
  ok(html.indexOf('not suggested') >= 0 && !/NaN|undefined/.test(html), 'the card prints neither a leverage guess nor NaN');
}

console.log('\n== news can stand a setup down, and cannot mint one ==');
{
  const against = ctx.hgSyndicateRead(baseInput({
    headlines: [{ title: 'Bitcoin whale dump crashes the market', sentiment: 'bearish', impact: 'high' }]
  }));
  ok(against.status === 'standby' && against.blueprint == null, 'a bearish bitcoin headline blocks the long');
  ok(against.reason.indexOf('bearish') >= 0, 'the reason is the lean, not a made-up short');
  const other = ctx.hgSyndicateRead(baseInput({
    headlines: [{ title: 'ETH hack drains a whale wallet', sentiment: 'bearish', impact: 'high' }]
  }));
  ok(other.status === 'blueprint', 'an ETH headline does not vote on BTC (' + other.reason + ')');
  const none = ctx.hgSyndicateRead({ pair: 'B-BTC_USDT', headlines: null, whale: null, bars: {} });
  ok(none.status === 'standby' && none.blueprint == null && none.stages.news.unread === true, 'unread news is unread');
  ok(none.blueprint == null && none.dir == null, 'unread news does not create a direction');
  const both = ctx.hgSyndicateRead(baseInput({
    headlines: [{ title: 'Bitcoin rally', sentiment: 'bullish', impact: 'high' }],
    whale: { vetoDistribution: true, accumulateAlt: false }
  }));
  ok(both.status === 'standby' && both.reason.indexOf('disagree') >= 0, 'a bullish headline and a whale deposit stand aside');
}

console.log('\n== the quant will not widen a target, and memory will not invent an offset ==');
{
  const thin = ctx.synQuant('long', { lo: 100, hi: 101 }, 10, 102, 0.002);
  ok(thin.ok === false && thin.leverage == null && /below 2\.2/.test(thin.reason), 'a close structural target stays below 2.2 (' + thin.reason + ')');
  const noTarget = ctx.synQuant('short', { lo: 100, hi: 110 }, 1, NaN, 0.002);
  ok(noTarget.ok === false && noTarget.reason === 'no structural target', 'no swing means no target');
  const deep = ctx.hgSyndicateRead(baseInput({
    memory: [{ pair: 'B-BTC_USDT', dir: 'long', kind: 'fvg', reaction: 'MISSED_BY_TICKS', offsetPct: 1 }]
  }));
  ok(deep.status === 'blueprint' && near(deep.blueprint.entry1, 114 * 0.99), 'a logged 1% miss lowers the long zone by 1% (' + deep.blueprint.entry1 + ')');
  const bare = ctx.hgSyndicateRead(baseInput({
    memory: [{ pair: 'B-BTC_USDT', dir: 'long', kind: 'fvg', reaction: 'STOPPED_OUT', offsetPct: null }]
  }));
  ok(bare.blueprint.entry1 === 114, 'a reaction with no percent does not move the zone');
  const wild = ctx.hgSyndicateRead(baseInput({
    memory: [{ pair: 'B-BTC_USDT', dir: 'long', kind: 'fvg', reaction: 'MISSED_BY_TICKS', offsetPct: 50 }]
  }));
  ok(wild.blueprint.entry1 === 114 && wild.lines.some(l => l.indexOf('rejected') >= 0), 'a 50% "lesson" is rejected');
}

console.log('\n== timing and the alt macro fail closed ==');
{
  const eventMs = Math.floor(NOW / 1000);
  const black = ctx.hgSyndicateRead(baseInput({ events: [{ title: 'CPI', impact: 'high', t: eventMs }] }));
  ok(black.status === 'standby' && black.reason.indexOf('CPI') >= 0, 'a high-impact event inside the hour stands by');
  const calm = calm15();
  calm[calm.length - 1] = { t: 30, o: 116, h: 130, l: 100, c: 116, v: 1 };
  const shock = ctx.hgSyndicateRead(baseInput({ bars: { '4h': longTape(), '1h': longTape(), '15m': calm } }));
  ok(shock.status === 'standby' && shock.reason.indexOf('2 ATR') >= 0, 'a BTC bar wider than 2 ATR refuses the timing');
  const alt = ctx.hgSyndicateRead(baseInput({ pair: 'B-DOGE_USDT', btcBars15: calm15(), btcDominance: null, dxyTrend: null }));
  ok(alt.status === 'standby' && alt.reason.indexOf('alt macro unread') >= 0, 'an alt with no BTC.D and no DXY is not called safe');
  const hot = ctx.hgSyndicateRead(baseInput({ pair: 'B-DOGE_USDT', btcBars15: calm15(), btcDominance: 60, dxyTrend: 'FLAT' }));
  ok(hot.status === 'standby' && hot.reason.indexOf('BTC.D') >= 0, 'BTC.D above 55 refuses the alt long');
  const rising = ctx.hgSyndicateRead(baseInput({ pair: 'B-DOGE_USDT', btcBars15: calm15(), btcDominance: 40, dxyTrend: 'RISING' }));
  ok(rising.status === 'standby' && rising.reason.indexOf('DXY') >= 0, 'a regime DXY of RISING is the same refusal as UP');
  const okAlt = ctx.hgSyndicateRead(baseInput({ pair: 'B-DOGE_USDT', btcBars15: calm15(), btcDominance: 40, dxyTrend: 'FLAT' }));
  ok(okAlt.status === 'blueprint' && okAlt.blueprint.pair === 'B-DOGE_USDT', 'an alt long with BTC.D at 40 can pass (' + okAlt.reason + ')');
}

console.log('\n== unread tape, bad pair, forming bar ==');
{
  const bad = ctx.hgSyndicateRead({ pair: 'BTCUSDT' });
  ok(bad.status === 'standby' && bad.blueprint == null, 'a pair that is not B-<ASSET>_USDT or INR is refused');
  const empty = ctx.hgSyndicateRead(baseInput({ bars: { '4h': [], '1h': [], '15m': [] } }));
  ok(empty.status === 'standby' && empty.blueprint == null, 'an empty tape is not a setup');
  const atr = ctx.synAtr(calm15(), 14);
  ok(!Number.isFinite(atr[13]) && near(atr[14], 0.8), 'ATR is unread before the seed and the seed is the mean true range');
  const open = NOW - 5 * 60 * 1000;
  const dropped = ctx.synDropForming([{ t: open / 1000, o: 1, h: 2, l: 0.5, c: 1.5 }], '15m', NOW);
  ok(dropped.length === 0, 'a 15m bar that has not closed is not a signal bar');
  const aside = ctx.hgSyndicateHtml({ status: 'standby', reason: 'tape unread', lines: ['Aggregator → Consolidator: headlines unread.'], agreed: 0, of: 5 });
  ok(aside.indexOf('STATUS STANDBY') >= 0 && aside.indexOf('tape unread') >= 0 && !/NaN|undefined/.test(aside), 'standby names the wait and invents no number');
  const nasty = ctx.hgSyndicateHtml({ status: 'standby', reason: '<script>', lines: ['<b>'], agreed: 0, of: 5 });
  ok(nasty.indexOf('<script>') < 0 && nasty.indexOf('&lt;script&gt;') >= 0, 'a reason cannot become markup');
}

console.log('\n== wired into the crypto group ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/<script src="syndicate\.js\?v=\d+"><\/script>/.test(html), 'index.html loads syndicate.js');
  ok(/'ninetypercent','syndicate'\]/.test(html), 'SYNDICATE is at the end of the CRYPTO group');
  ok(sw.indexOf("'./syndicate.js'") >= 0, 'the shell precaches syndicate.js');
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'syndicate');
  ok(tab && tab.label === 'SYNDICATE' && typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'it registers as SYNDICATE');
}

console.log('\n' + passed + ' passed, 0 failed');
