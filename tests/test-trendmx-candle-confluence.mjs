/* hg-v1337: TREND MATRIX reads the shared candlestick engine.
   A setup prints only when that read names one side and the row's own trend
   side is the same side. Prices are trendmxPlan. The pattern stop is not
   copied. Unread, a clash, and a pattern against the trend form nothing.
   Run: node tests/test-trendmx-candle-confluence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const s = {
    console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
    parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map,
    encodeURIComponent, setTimeout, clearTimeout
  };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){} }), head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'trendtable.combined.js']) vm.runInContext(read(f), s, { filename: f });
  return s;
}

const SEC = 14400;
const end = Math.floor(Date.now() / 1000 / SEC) * SEC - SEC;
function tape(n){
  const rows = [];
  let c = 100;
  for (let i = 0; i < n; i++){
    const o = c;
    c = c + 0.2 + ((i % 5) - 2) * 0.08;
    rows.push({ t: end - (n - 1 - i) * SEC, o, h: Math.max(o, c) + 0.45, l: Math.min(o, c) - 0.45, c, v: 1000 });
  }
  return rows;
}
function row(score, rows4h){
  const px = rows4h[rows4h.length - 1].c;
  return { sym: 'ETHUSDT', base: 'ETH', score: score, price: px, rows4h: rows4h, comps: { d1Trend: score > 0 ? 1 : -1, d1Cross: score > 0 ? 1 : -1, h4Cascade: score > 0 ? 1 : -1, cloud: score > 0 ? 1 : -1, adxPt: 1 } };
}
const SENTINEL = 0.01;
function voter(bull, bear, names){
  return { bullVotes: bull, bearVotes: bear, names: names || [], bullNames: bull ? (names || []) : [], bearNames: bear ? (names || []) : [], longStop: SENTINEL, shortStop: SENTINEL };
}

const S = boot();
ok(typeof S.trendmxCandleRead === 'function' && typeof S.trendmxCandleSetups === 'function', 'candle read and setups are exported');
ok(typeof S.trendmxPlan === 'function', 'trendmxPlan is still the bracket builder');

const rows4h = tape(80);
const longRow = row(4, rows4h);

S.hgCfCandlePatterns = () => voter(1, 0, ['bull marubozu']);
S.hgCfAdvancedPatterns = () => ({ names: [], leans: [], notes: [], aligned: null });
S.hgCfLocatedSide = () => ({ bull: [], bear: [], clash: false });

const agreed = S.trendmxCandleSetups([longRow]);
ok(agreed.length === 1, 'agreement mints one setup (got ' + agreed.length + ')');
ok(agreed[0].dir === 'long' && agreed[0].sym === 'ETHUSDT', 'the setup keeps the trend side');
ok(agreed[0].source === 'voter' && agreed[0].names[0] === 'bull marubozu', 'the 3-bar name is the shape');
const plan = S.trendmxPlan(Object.assign({}, longRow, { dir: 'long', rows4h: rows4h }));
ok(plan && S.trendmxCandleSetups && agreed[0].entry === plan.entry && agreed[0].stop === plan.stop && agreed[0].t1 === plan.t1 && agreed[0].t2 === plan.t2, 'prices are the trend plan, not a new bracket');
ok(agreed[0].stop !== SENTINEL && agreed[0].entry !== SENTINEL && agreed[0].t1 !== SENTINEL, 'the pattern stop was not copied');
const html = S.trendmxCandleDeskHTML(agreed);
ok(html.indexOf('data-tm-candles="1"') >= 0 && html.indexOf('ETHUSDT') >= 0 && html.indexOf('ENTRY') >= 0, 'the desk prints the agreed setup');
ok(html.indexOf('>0.01<') < 0 && html.indexOf('CANDLE') >= 0, 'the card is a candle confluence, not the sentinel stop');

S.hgCfCandlePatterns = () => voter(0, 1, ['bearish engulfing']);
const against = S.trendmxCandleSetups([longRow]);
ok(against.length === 0 && against.held.against === 1, 'a pattern against the trend is not a setup');
ok(S.trendmxCandleDeskHTML(against).indexOf('ENTRY') < 0, 'an against row prints no prices');

S.hgCfCandlePatterns = () => voter(1, 1, ['bull marubozu', 'bearish engulfing']);
const clash = S.trendmxCandleSetups([longRow]);
ok(clash.length === 0 && clash.held.clash === 1, 'a clash is not a setup');

S.hgCfCandlePatterns = () => voter(0, 0, []);
S.hgCfLocatedSide = () => ({ bull: ['mat hold'], bear: [], clash: false });
const adv = S.trendmxCandleSetups([longRow]);
ok(adv.length === 1 && adv[0].source === 'advanced' && adv[0].names[0] === 'mat hold', 'an empty voter can use a one-sided advanced lean');
ok(adv[0].stop === plan.stop && adv[0].entry === plan.entry, 'the advanced lean does not move the trend plan');

S.hgCfLocatedSide = () => ({ bull: [], bear: [], clash: false });
const empty = S.trendmxCandleSetups([longRow]);
ok(empty.length === 0 && empty.held.none === 1, 'no named shape forms nothing');

S.hgCfLocatedSide = () => ({ bull: ['mat hold'], bear: ['thrusting'], clash: true });
const advClash = S.trendmxCandleSetups([longRow]);
ok(advClash.length === 0 && advClash.held.clash === 1, 'advanced leans on both sides are a clash');

const noDir = S.trendmxCandleSetups([row(0, rows4h)]);
S.hgCfCandlePatterns = () => voter(1, 0, ['bull marubozu']);
S.hgCfLocatedSide = () => ({ bull: [], bear: [], clash: false });
const flat = S.trendmxCandleSetups([row(0, rows4h)]);
ok(flat.length === 0 && flat.held.noDir === 1, 'no trend side is not a setup');

const shortTape = S.trendmxCandleSetups([row(4, tape(12))]);
ok(shortTape.length === 0 && shortTape.held.unread === 1, 'a short tape stays unread');

S.hgCfCandlePatterns = () => { throw new Error('engine down'); };
const threw = S.trendmxCandleSetups([longRow]);
ok(threw.length === 0 && threw.held.unread === 1, 'a throwing engine is unread, not a side');

delete S.hgCfCandlePatterns;
delete S.hgCfAdvancedPatterns;
delete S.hgCfLocatedSide;
const missing = S.trendmxCandleSetups([longRow]);
ok(missing.length === 0 && /Unread is not agreement/.test(missing.why || ''), 'a missing engine forms nothing and says unread is not agreement');
ok(S.trendmxCandleRead(rows4h).state === 'unread', 'the read itself stays unread when the engine is gone');

const bearRow = row(-4, rows4h);
S.hgCfCandlePatterns = () => voter(0, 1, ['bearish engulfing']);
S.hgCfAdvancedPatterns = () => ({ names: [], leans: [], notes: [] });
S.hgCfLocatedSide = () => ({ bull: [], bear: [], clash: false });
const shortAgree = S.trendmxCandleSetups([bearRow]);
ok(shortAgree.length === 1 && shortAgree[0].dir === 'short', 'a short trend plus a short shape is a setup');
ok(shortAgree[0].stop !== SENTINEL && shortAgree[0].stop > shortAgree[0].entry, 'the short stop stays on the trend-plan side of entry');

{
  const norm = t => t.split('\n').filter(l => l !== '').join('\n');
  let parts = '';
  for (let i = 0; i < 12; i++) parts += read('trendtable-src-' + i + '.js');
  ok(norm(parts) === norm(read('trendtable.combined.js')), 'served parts and the combined file are the same text');
  for (const f of ['trendtable-src-2.js', 'trendtable.combined.js']){
    const src = read(f);
    const body = src.slice(src.indexOf('function trendmxCandleRead'), src.indexOf('function tmSmcOn'));
    ok(body.indexOf('hgCfCandlePatterns') >= 0 && body.indexOf('hgCfAdvancedPatterns') >= 0 && body.indexOf('hgCfLocatedSide') >= 0, f + ' calls the shared engine');
    ok(!/function hgCfCandlePatterns|function hgCfAdvancedPatterns|function hgCfLocatedSide/.test(body), f + ' does not redefine the engine');
    ok(!/tasuki\|side-by-side|where this pattern means something/.test(body), f + ' does not copy the located-side rule');
    ok(!/longStop|shortStop/.test(body), f + ' does not read the pattern stop');
    ok(!/stop\s*=\s*[^=]/.test(body) && !/tp1\s*=/.test(body), f + ' does not mint a stop or a target');
  }
  ok(read('trendtable-src-10.js').indexOf('data-r="candles"') >= 0, 'the mount has a candle desk');
  const gold = read('goldind.js');
  ok(gold.indexOf('DISCLOSURE, NOT WEIGHT') >= 0 && gold.indexOf('hg-v1311') >= 0 && gold.indexOf('hg-v1313') >= 0, 'the advanced layer stays disclosure, not weight');
  const at = gold.indexOf('var adv = hgCfAdvancedPatterns');
  const after = gold.slice(at, at + 420);
  ok(at >= 0 && !/bulls|bears|checked|rawStop/.test(after), 'the 420 chars after the advanced call still do not vote');
  ok(!/bulls\s*\+=\s*adv\./.test(gold) && !/rawStop[^\n]*adv\./.test(gold), 'the advanced layer is still not added to a vote or a stop');
}

console.log('\n' + passed + ' passed');
void noDir;
