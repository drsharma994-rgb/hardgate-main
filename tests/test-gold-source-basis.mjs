/* HARDGATE — "are the gold prices correct according to XM?"

   Asked by someone who trades XM. The honest answer needed three lookups
   across two files, and it was no.

   The status line said:

     source: scalp binance-xau · swing binance-xau

   `binance-xau` is an internal key, and it was the only thing on screen
   telling a reader which instrument produced their entry, stop and target.
   Traced: macro.js getGoldCandles fetches XAUUSDT from BINANCE_FAPI, so it is
   Binance's USD-M XAUUSDT PERPETUAL. Measured live at the time: $4374.58
   against $4369.70 spot — 0.11% above, which on that scan's 21.94-point scalp
   stop is 22% of 1R.

   The trade's SHAPE survives, because entry, stop and target all come from
   the same feed and the R:R is computed within it. What does not survive is
   the printed levels matching what a broker on spot XAUUSD shows. The perp
   also trades 24/7 while spot-gold brokers close Friday night to Sunday
   night, so a weekend scan rests on bars the broker never printed.

   NONE OF THAT IS FIXABLE FROM HERE. Pointing the desk at a broker's own feed
   needs the XM bridge configured — /api/xm/candles answers
   {"ok":false,"reason":"xm_not_configured"} and render.yaml declares
   XM_MT5_URL, XM_MT5_TOKEN and XM_GOLD_SYMBOL with sync:false. That is
   infrastructure, not code, and the fallback chain already prefers the bridge
   the moment it exists.

   What IS fixable is the desk claiming less than it knows. It now names the
   instrument in plain words and states its distance from spot, so the
   question does not need asking again.

   Run: node tests/test-gold-source-basis.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const GOLD = read('omnigold.js');
const SCALP = read('goldscalp.js');
const MACRO = read('macro.js');
const BIN = read('binance.js');

console.log('== the feed really is a Binance perp, not spot ==');
{
  /* Asserted from source so the claim in the header cannot drift from the
     code. getGoldCandles asks binanceKlines for XAUUSDT; binanceKlines hits
     the futures host. */
  ok(/binanceKlines\('XAUUSDT'/.test(MACRO), 'getGoldCandles fetches XAUUSDT');
  ok(/source: 'binance-xau'/.test(MACRO), 'and labels it binance-xau');
  ok(/BINANCE_FAPI \+ '\/fapi\/v1\/klines/.test(BIN), 'binanceKlines uses the USD-M FUTURES host');
  ok(/const BINANCE_FAPI/.test(BIN) || /BINANCE_FAPI\s*=/.test(BIN), 'which is a named constant, not a literal');
}

console.log('\n== the instrument is named in words a reader can act on ==');
{
  ok(/'binance-xau': 'BINANCE XAUUSDT perp'/.test(GOLD), 'binance-xau reads as BINANCE XAUUSDT perp');
  ok(/'xm-xauusd':\s*'XM XAUUSD \(your broker feed\)'/.test(GOLD), 'the bridge feed reads as the broker feed');
  ok(/'binance-paxg':'BINANCE PAXGUSDT \(tokenised gold\)'/.test(GOLD), 'PAXG says it is tokenised gold');
  ok(/function hgOgSrcLabel\(src\)/.test(GOLD), 'through one labelling function');
  ok(/srcNote = 'source: scalp ' \+ hgOgSrcLabel\(res\.scalp\.source\)/.test(GOLD),
     'and the status line uses it rather than the raw key');
  ok(!/'source: scalp ' \+ \(res\.scalp\.source \|\| 'none'\)/.test(GOLD),
     'the raw internal key is no longer what the reader sees');
}

console.log('\n== the basis is stated, not left to be discovered ==');
{
  ok(/NOT a broker feed: /.test(GOLD), 'the line says plainly it is not a broker feed');
  ok(/% vs spot \(\$/.test(GOLD), 'quoting the drift and both prices');
  ok(/not your broker\\?'s XAUUSD/.test(GOLD), 'and what that means for the levels');
  ok(/hgOgSrcIsBroker\(srcKey\)\) return;/.test(GOLD),
     'and says nothing when the feed IS the broker bridge — no false alarm');
  ok(/function hgOgSrcIsBroker\(src\)\{ return String\(src \|\| ''\) === 'xm-xauusd'; \}/.test(GOLD),
     'with only the bridge counting as the broker feed');
}

console.log('\n== the spot reference is shared, not copied ==');
{
  ok(/window\.hgGoldLiveSpot = goldLiveSpotRef;/.test(SCALP), 'goldscalp exports its spot reference');
  ok(/gfn\('hgGoldLiveSpot'\)/.test(GOLD), 'and omnigold looks it up rather than writing a second fetcher');
  ok(/api\.gold-api\.com\/price\/XAU/.test(SCALP), 'it reads real spot XAU');
  /* The app already proxies that host, so this adds no new external dependency. */
  ok(/api\.gold-api\.com/.test(read('api/proxy.js')), 'a host the proxy already allows');
}

console.log('\n== a slow or dead spot feed costs the scan nothing ==');
{
  const i = GOLD.indexOf('NOT a broker feed');
  const before = GOLD.slice(Math.max(0, i - 1600), i);
  ok(/ui\.stat\.textContent = __og\.lastStat \+ warn;/.test(before),
     'the status line is rendered BEFORE the spot lookup starts');
  ok(/Promise\.resolve\(spotFn\(feedPx\)\)\.then/.test(GOLD), 'the lookup is asynchronous');
  ok(/\}\)\.catch\(function\(\)\{\}\);/.test(GOLD), 'a rejection is swallowed');
  ok(/catch \(eB\)\{\}/.test(GOLD), 'and the whole block is guarded');
  ok(/if \(!isFinite\(spot\) \|\| spot <= 0\) return;/.test(GOLD),
     'a nonsense spot price appends nothing rather than printing NaN%');
  ok(/if \(!isFinite\(feedPx\) \|\| feedPx <= 0\) return;/.test(GOLD),
     'and so does a feed with no usable last close');
}

console.log('\n== the labelling is total and safe ==');
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  /* Every source the fetch chain can produce must have a human label. */
  const chain = ['xm-xauusd', 'gold-spot', 'binance-xau', 'binance-paxg'];
  for (const k of chain){
    ok(new RegExp("'" + k + "'").test(GOLD), k + ' appears in the label map or the chain');
  }
  ok(/return OG_SRC_LABEL\[k\] \|\| \(k \|\| 'none'\)/.test(GOLD),
     'an unknown key falls back to the key itself, never to undefined');
  ok(/\|\| \(k \|\| 'none'\)/.test(GOLD), 'and an empty source reads "none"');
}

console.log('\n== the bridge, which is the real fix, is still preferred ==');
{
  /* This change does not paper over the cause: the moment the XM bridge is
     configured the chain takes it first and the disclosure goes quiet. */
  ok(/getXmGoldCandles/.test(GOLD), 'the fetch chain still asks the XM bridge first');
  const legacyStart = GOLD.indexOf('function hgOgFetchRowsLegacy');
  const legacyEnd = GOLD.indexOf('function hgOgFetchRows', legacyStart + 1);
  const legacy = legacyStart >= 0 ? GOLD.slice(legacyStart, legacyEnd) : GOLD;
  const i = legacy.indexOf('getXmGoldCandles');
  const j = legacy.indexOf('getGoldCandles');
  ok(i > 0 && j > 0 && i < j, 'before the spot proxy');
  ok(/xm_not_configured/.test(read('lib/xm-trader-fetch.mjs')),
     'and the bridge reports honestly when it has no configuration');
  ok(/XM_MT5_URL/.test(read('render.yaml')), 'render.yaml declares the variables it needs');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLD SOURCE BASIS TESTS PASSED');
