/* HARDGATE — OMNIROUTE + OMNIPRESENT tell you the side.

   Ask: "tell me should I take long or short trades according to the
   sentiment of the market."

   Not a composite score. Two gates, same as the rest of the house:

     tape       MARKET PICTURE majority (4H EMA cascade on BTC/ETH/SOL/GOLD)
     sentiment  BIAS S2 Fear & Greed (block fresh longs ≥80, fresh shorts ≤20)

   TAKE LONGS / TAKE SHORTS only when the tape leans and sentiment does not
   veto the chase. Otherwise STAND ASIDE. Cards against the side still
   render, stamped AGAINST TAPE — they are not hidden.

   Run: node tests/test-omni-market-side.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');
const OP = read('omnipresent.js');
const HTML = read('index.html');

function load(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error,
                setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  vm.runInNewContext(ROUTE, ctx);
  return ctx;
}

const pic = (longs, shorts, mixed) => ({ longs, shorts, mixed, total: longs + shorts + mixed });

console.log('== export ==');
{
  const W = load();
  ok(typeof W.hgOmniMarketSide === 'function', 'hgOmniMarketSide exported');
  ok(typeof W.hgOmniMarketSideHtml === 'function', 'hgOmniMarketSideHtml exported');
}

console.log('== tape majority (same rule as MARKET PICTURE) ==');
{
  const W = load();
  const fourLong = W.hgOmniMarketSide(pic(4, 0, 0), { v: 50, c: 'Neutral' });
  ok(fourLong.side === 'long' && fourLong.headline === 'TAKE LONGS',
     '4/4 long cascade → TAKE LONGS (got ' + fourLong.headline + ')');
  const threeShort = W.hgOmniMarketSide(pic(0, 3, 1), { v: 50, c: 'Neutral' });
  ok(threeShort.side === 'short' && threeShort.headline === 'TAKE SHORTS',
     '3 short + 1 mixed → TAKE SHORTS');
  const mixed = W.hgOmniMarketSide(pic(2, 2, 0), { v: 50, c: 'Neutral' });
  ok(mixed.side === 'aside' && mixed.headline === 'STAND ASIDE',
     '2–2 split → STAND ASIDE, not a coin-flip');
  const lean2 = W.hgOmniMarketSide(pic(2, 0, 2), { v: 50, c: 'Neutral' });
  ok(lean2.side === 'aside', '2 longs of 4 is not a majority lean');
}

console.log('== sentiment uses BIAS S2 thresholds ==');
{
  const W = load();
  const greed = W.hgOmniMarketSide(pic(4, 0, 0), { v: 82, c: 'Extreme Greed' });
  ok(greed.side === 'aside', 'F&G 82 blocks fresh longs — STAND ASIDE, not flip to short');
  ok(/80/.test((greed.gates || []).map(g => g.why).join(' ')), 'names the ≥80 long veto');
  const fear = W.hgOmniMarketSide(pic(0, 4, 0), { v: 15, c: 'Extreme Fear' });
  ok(fear.side === 'aside', 'F&G 15 blocks fresh shorts — STAND ASIDE, not flip to long');
  const fearLong = W.hgOmniMarketSide(pic(4, 0, 0), { v: 22, c: 'Extreme Fear' });
  ok(fearLong.side === 'long', 'extreme fear does not veto longs (contrarian is allowed)');
  const greedShort = W.hgOmniMarketSide(pic(0, 4, 0), { v: 75, c: 'Greed' });
  ok(greedShort.side === 'short', 'greed 75 does not veto shorts');
}

console.log('== missing data is UNCHECKED, not a silent pass ==');
{
  const W = load();
  const noPic = W.hgOmniMarketSide(null, { v: 50, c: 'Neutral' });
  ok(noPic.side === 'aside', 'no market picture → STAND ASIDE');
  const tapeGate = (noPic.gates || []).find(g => g.key === 'tape');
  ok(tapeGate && tapeGate.pass !== true, 'unread tape is not PASS');
  const noFng = W.hgOmniMarketSide(pic(4, 0, 0), null);
  ok(noFng.side === 'long', 'missing F&G does not veto a clear tape (same as BIAS S2 N/A)');
  const sent = (noFng.gates || []).find(g => g.key === 'sentiment');
  ok(sent && sent.pass !== true && sent.pass !== false, 'missing F&G reads UNCHECKED');
}

console.log('== not a score; cards against the side still exist ==');
{
  ok(/AGAINST TAPE/.test(ROUTE), 'OMNIROUTE stamps AGAINST TAPE on the other side');
  ok(/AGAINST TAPE/.test(OP), 'OMNIPRESENT stamps AGAINST TAPE on the other side');
  ok(/id="omniSide"/.test(ROUTE), 'OMNIROUTE has a side banner slot');
  ok(/id="opSide"/.test(OP), 'OMNIPRESENT has a side banner slot');
  ok(!/innerHTML = ''/.test(ROUTE.slice(ROUTE.indexOf('function setupCard'), ROUTE.indexOf('function setupCard') + 200)),
     'setupCard does not blank the desk');
}

console.log('== HTML names the call ==');
{
  const W = load();
  const html = W.hgOmniMarketSideHtml(W.hgOmniMarketSide(pic(4, 0, 0), { v: 55, c: 'Greed' }));
  ok(/TAKE LONGS/.test(html), 'banner prints TAKE LONGS');
  ok(/tape/.test(html) && /sentiment|F&G|F&amp;G/.test(html), 'banner shows both gates');
  const aside = W.hgOmniMarketSideHtml(W.hgOmniMarketSide(pic(1, 1, 2), { v: 50, c: 'Neutral' }));
  ok(/STAND ASIDE/.test(aside), 'banner prints STAND ASIDE');
}

console.log('== picture is cached for the desks ==');
{
  ok(/__hgMarketPicture/.test(HTML), 'runMarketPictureUI stores the picture for the omni desks');
  ok(/typeof S !== 'undefined' && S && S\.fng/.test(ROUTE),
     'omniFng reads the lexical S.fng the chip uses, not only window.S');
  ok(!/html\.hg-chrome-min[^{;]*\.omni-side/.test(HTML.replace(/\s+/g, ' ')),
     'chrome-min does not hide the desk side call');
  const pin = HG_VER.replace('hg-v', '');
  ok(new RegExp('omniroute\\.js\\?v=' + pin).test(HTML), 'omniroute.js cache-busted');
  ok(new RegExp('omnipresent\\.js\\?v=' + pin).test(HTML), 'omnipresent.js cache-busted');
}

console.log('== cache stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'cache matches build stamp');
}

console.log('\n' + passed + ' passed');
