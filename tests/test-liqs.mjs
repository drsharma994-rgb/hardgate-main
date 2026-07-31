/* HARDGATE — liqs.js unit tests (Node 18+, builtins only).
   Loads liqs.js as a classic script (vm.runInThisContext, like the
   browser's <script> tag) with NOTHING but a window stub present, then:
     A) load + HG_tabs registration + export hygiene
     B) liqParse — side mapping (BUY=short-liq, SELL=long-liq), $ = p×q,
        string/array input, malformed messages ignored
     C) liqAgg basics — totals, validation, add() contract
     D) rolling window roll-off (window stays, since keeps everything)
     E) imbalance ratio + classification boundaries both sides + balanced
     F) per-symbol totals, ordering, biggest print
     G) top-N ordering + cap
     H) spike threshold (default + custom + boundary)
     I) mount(el) smoke test (UI scaffold, wiring, no-WebSocket degradation)
     J) liqFlushSetup — trigger (>=2x imbalance + extreme spike), direction
        logic, stop beyond the flush wick (ATR + % fallback), 2R/3.5R
        targets, NaN-safety, SETUPS panel in the mount markup
   No live network, no sockets. Run: node tests/test-liqs.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

/* ---- load the module in a pristine global scope: only a window stub ---- */
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'liqs.js', 'utf8'), { filename: 'liqs.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const nearly = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

/* ================= A) load + registration ================= */
console.log('== load + registration ==');
ok(typeof globalThis.window.liqParse === 'function', 'window.liqParse exposed');
ok(typeof globalThis.window.liqAgg === 'function', 'window.liqAgg exposed');
ok(Array.isArray(globalThis.window.HG_tabs) && globalThis.window.HG_tabs.length === 1, 'HG_tabs array created with one entry');
const tab = globalThis.window.HG_tabs[0];
ok(tab.id === 'liqs' && tab.label === 'LIQS' && typeof tab.mount === 'function',
   'HG_tabs entry = {id:liqs, label:LIQS, mount}');
ok(globalThis.window.liqParseOne === undefined && globalThis.window.startStream === undefined
   && globalThis.window.renderTape === undefined && globalThis.window.connect === undefined,
   'only liqParse + liqAgg + HG_tabs leak onto window');

const P = globalThis.window.liqParse;
const AGG = globalThis.window.liqAgg;

/* ================= B) liqParse ================= */
console.log('== liqParse: side mapping, $ = p×q, inputs ==');
let p = P({ o: { s: 'BTCUSDT', S: 'BUY', p: '42000.5', q: '0.25', T: 1700000000000 } });
ok(p && p.sym === 'BTCUSDT' && p.side === 'short', 'BUY = short liquidated (forced buy)');
ok(nearly(p.usd, 42000.5 * 0.25), '$ value = price × qty');
ok(p.t === 1700000000000, 'event time T preserved');

p = P({ o: { s: 'ETHUSDT', S: 'SELL', p: 2200, q: 4, T: 1700000001000 } });
ok(p && p.side === 'long' && nearly(p.usd, 8800), 'SELL = long liquidated (forced sell)');

p = P(JSON.stringify({ o: { s: 'SOLUSDT', S: 'BUY', p: '100', q: '10', T: 1700000002000 } }));
ok(p && p.sym === 'SOLUSDT' && p.side === 'short' && nearly(p.usd, 1000), 'raw JSON string accepted');

let arr = P([
  { o: { s: 'AAAUSDT', S: 'BUY', p: '1', q: '100', T: 1 } },
  { o: { s: 'BAD' } },
  { o: { s: 'BBBUSDT', S: 'SELL', p: '2', q: '50', T: 2 } }
]);
ok(Array.isArray(arr) && arr.length === 2 && arr[0].sym === 'AAAUSDT' && arr[1].sym === 'BBBUSDT',
   'array input -> valid prints kept, malformed dropped');

p = P({ e: 'forceOrder', E: 1700000003000, o: { s: 'XRPUSDT', S: 'SELL', p: '0.5', q: '2000', T: 1700000003000 } });
ok(p && p.sym === 'XRPUSDT' && p.side === 'long' && nearly(p.usd, 1000), 'full forceOrder envelope parsed');

console.log('== liqParse: malformed messages ignored ==');
ok(P(null) === null, 'null -> null');
ok(P('') === null, 'empty string -> null');
ok(P('{not json') === null, 'broken JSON string -> null, no throw');
ok(P('{}') === null, 'object without o -> null');
ok(P({ o: {} }) === null, 'o without fields -> null');
ok(P({ o: { s: 'BTCUSDT', S: 'HOLD', p: '1', q: '1', T: 1 } }) === null, 'unknown side S -> null');
ok(P({ o: { s: 'BTCUSDT', S: 'BUY', p: 'abc', q: '1', T: 1 } }) === null, 'non-numeric price -> null');
ok(P({ o: { s: 'BTCUSDT', S: 'BUY', p: '1', q: '-5', T: 1 } }) === null, 'negative qty -> null');
ok(P({ o: { s: 'BTCUSDT', S: 'BUY', p: '0', q: '1', T: 1 } }) === null, 'zero price -> null');
ok(P({ o: { s: '', S: 'BUY', p: '1', q: '1', T: 1 } }) === null, 'empty symbol -> null');
ok(P(42) === null, 'bare number -> null');
p = P({ o: { s: 'BTCUSDT', S: 'BUY', p: '1', q: '1', T: 'junk' } });
ok(p && isFinite(p.t) && p.t > 1700000000000, 'non-numeric T falls back to now');

/* ================= C) liqAgg basics ================= */
console.log('== liqAgg: totals, validation, add() contract ==');
let a = AGG();
let r = a.add({ sym: 'BTCUSDT', side: 'short', usd: 150000, t: 1000000000000 });
ok(r && r.print && r.print.sym === 'BTCUSDT' && r.spike === false, 'add returns {print, spike}');
a.add({ sym: 'ETHUSDT', side: 'long', usd: 250000, t: 1000000001000 });
let s = a.snapshot(1000000002000);
ok(s.since.longUsd === 250000 && s.since.shortUsd === 150000 && s.since.count === 2,
   'since totals accumulate long/short separately');
ok(s.window.longUsd === 250000 && s.window.shortUsd === 150000 && s.window.count === 2,
   'fresh window mirrors since totals');

ok(a.add(null) === null, 'add(null) -> null');
ok(a.add({}) === null, 'add({}) -> null');
ok(a.add({ sym: 'X', side: 'sideways', usd: 5, t: 1 }) === null, 'unknown side rejected');
ok(a.add({ sym: 'X', side: 'long', usd: NaN, t: 1 }) === null, 'NaN usd rejected');
ok(a.add({ sym: 'X', side: 'long', usd: -10, t: 1 }) === null, 'negative usd rejected');
ok(a.add({ sym: '', side: 'long', usd: 10, t: 1 }) === null, 'empty symbol rejected');
ok(a.snapshot(1000000002000).since.count === 2, 'rejected prints never touch the totals');

r = a.add({ sym: 'DOGEUSDT', side: 'long', usd: 5000 });
ok(r && isFinite(r.print.t) && r.print.t > 0, 'missing t falls back to now');

/* ================= D) window roll-off ================= */
console.log('== rolling window roll-off ==');
a = AGG({ windowMs: 60000 });
const t0 = 1700000000000;
a.add({ sym: 'BTCUSDT', side: 'long', usd: 100000, t: t0 - 120000 }); // 2 min old
a.add({ sym: 'BTCUSDT', side: 'long', usd: 200000, t: t0 - 61000 });  // just outside 60s
a.add({ sym: 'BTCUSDT', side: 'short', usd: 300000, t: t0 - 30000 }); // inside
a.add({ sym: 'ETHUSDT', side: 'short', usd: 400000, t: t0 });         // inside
s = a.snapshot(t0);
ok(s.since.count === 4 && nearly(s.since.longUsd, 300000) && nearly(s.since.shortUsd, 700000),
   'since keeps every print regardless of age');
ok(s.window.count === 2 && s.window.longUsd === 0 && nearly(s.window.shortUsd, 700000),
   'window drops prints older than windowMs');
ok(s.window.ms === 60000, 'snapshot exposes the configured window');
s = a.snapshot(t0 + 61000);
ok(s.window.count === 0 && s.since.count === 4, 'window empties as time passes; since persists');

/* ================= E) imbalance ratio + classification ================= */
console.log('== imbalance ratio + flush classification ==');
function imb(longUsd, shortUsd, opts){
  const g = AGG(opts);
  const now = 1700000000000;
  if (longUsd > 0)  g.add({ sym: 'L', side: 'long',  usd: longUsd,  t: now });
  if (shortUsd > 0) g.add({ sym: 'S', side: 'short', usd: shortUsd, t: now });
  return g.snapshot(now).imbalance;
}
let im = imb(640000, 320000);
ok(im.cls === 'long-flush' && nearly(im.ratio, 2) && im.text.indexOf('LONG FLUSH 2.0×') === 0
   && im.text.indexOf('capitulation conditions') > 0,
   'ratio exactly 2.0 (boundary) -> LONG FLUSH 2.0× — capitulation');
im = imb(3200000, 1000000);
ok(im.cls === 'long-flush' && im.text.indexOf('LONG FLUSH 3.2×') === 0, 'ratio 3.2 -> LONG FLUSH 3.2× (spec example)');
im = imb(638000, 320000);
ok(im.cls === 'balanced' && nearly(im.ratio, 1.99375), 'ratio 1.99 -> balanced (below 2× threshold)');
im = imb(320000, 640000);
ok(im.cls === 'short-flush' && nearly(im.ratio, 0.5) && im.text.indexOf('SHORT FLUSH 2.0×') === 0
   && im.text.indexOf('short-squeeze conditions') > 0,
   'ratio exactly 0.5 (boundary) -> SHORT FLUSH 2.0× — squeeze');
im = imb(328000, 640000);
ok(im.cls === 'balanced' && im.ratio > 0.5, 'ratio 0.5125 -> balanced (above 0.5 threshold)');
im = imb(100000, 0);
ok(im.cls === 'long-flush' && im.ratio === Infinity && im.text.indexOf('LONG FLUSH ∞×') === 0,
   'only longs in window -> ∞ ratio -> LONG FLUSH');
im = imb(0, 100000);
ok(im.cls === 'short-flush' && im.ratio === 0 && im.text.indexOf('SHORT FLUSH ∞×') === 0,
   'only shorts in window -> 0 ratio -> SHORT FLUSH ∞×');
im = imb(0, 0);
ok(im.cls === 'balanced' && im.ratio === null && im.text.indexOf('BALANCED') === 0,
   'empty window -> null ratio, balanced, no fabrication');
im = imb(500000, 200000, { flushRatio: 3 });
ok(im.cls === 'balanced' && nearly(im.ratio, 2.5), 'custom flushRatio 3 -> 2.5× is balanced');
im = imb(600000, 200000, { flushRatio: 3 });
ok(im.cls === 'long-flush', 'custom flushRatio 3 -> 3.0× fires (boundary, inclusive)');

/* ================= F) per-symbol totals ================= */
console.log('== per-symbol totals, ordering, biggest print ==');
a = AGG();
a.add({ sym: 'ETHUSDT', side: 'long',  usd: 500000, t: 1 });
a.add({ sym: 'BTCUSDT', side: 'short', usd: 900000, t: 2 });
a.add({ sym: 'ETHUSDT', side: 'short', usd: 300000, t: 3 });
a.add({ sym: 'BTCUSDT', side: 'long',  usd: 200000, t: 4 });
a.add({ sym: 'SOLUSDT', side: 'long',  usd: 100000, t: 5 });
s = a.snapshot(1700000000000);
ok(s.perSymbol.length === 3, 'one row per symbol');
ok(s.perSymbol[0].sym === 'BTCUSDT' && s.perSymbol[1].sym === 'ETHUSDT' && s.perSymbol[2].sym === 'SOLUSDT',
   'sorted by total liquidated desc (1.1M, 800K, 100K)');
const b = s.perSymbol[0];
ok(b.longUsd === 200000 && b.shortUsd === 900000 && b.count === 2 && b.biggestUsd === 900000,
   'per-symbol long/short split, count, biggest print');

/* ================= G) top-N ordering ================= */
console.log('== top-N ordering + cap ==');
a = AGG({ topN: 3 });
a.add({ sym: 'A', side: 'long',  usd: 50000,  t: 1 });
a.add({ sym: 'B', side: 'short', usd: 900000, t: 2 });
a.add({ sym: 'C', side: 'long',  usd: 300000, t: 3 });
a.add({ sym: 'D', side: 'short', usd: 120000, t: 4 });
a.add({ sym: 'E', side: 'long',  usd: 10000,  t: 5 });
s = a.snapshot(1700000000000);
ok(s.top.length === 3, 'top capped at topN');
ok(s.top[0].sym === 'B' && s.top[1].sym === 'C' && s.top[2].sym === 'D', 'top sorted by usd desc');
ok(s.top.every(function(x){ return x.usd >= 120000; }), 'small prints never enter the top list');
a.add({ sym: 'F', side: 'long', usd: 120000, t: 6 });
s = a.snapshot(1700000000000);
ok(s.top.length === 3 && s.top[2].sym === 'D', 'print equal to the cutoff does not bump (strict >)');
a.add({ sym: 'G', side: 'long', usd: 120001, t: 7 });
s = a.snapshot(1700000000000);
ok(s.top[2].sym === 'G', 'print above the cutoff enters the top list');

/* ================= H) spike threshold ================= */
console.log('== spike threshold ==');
a = AGG();
r = a.add({ sym: 'BTCUSDT', side: 'long', usd: 2000000, t: 1 });
ok(r.spike === true, 'print at exactly $2M (boundary) spikes');
r = a.add({ sym: 'BTCUSDT', side: 'long', usd: 1999999, t: 2 });
ok(r.spike === false, 'print just under $2M does not spike');
s = a.snapshot(1700000000000);
ok(s.spikes === 1 && s.spikeUsd === 2000000, 'snapshot counts spikes + exposes threshold');
a = AGG({ spikeUsd: 500 });
r = a.add({ sym: 'X', side: 'short', usd: 500, t: 1 });
ok(r.spike === true, 'custom spikeUsd boundary is inclusive');
r = a.add({ sym: 'X', side: 'short', usd: 499, t: 2 });
ok(r.spike === false, 'custom spikeUsd: under threshold does not spike');

/* ================= I) mount(el) smoke test ================= */
console.log('== mount(el) smoke test ==');
const stubs = {};
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           addEventListener: function(ev, fn){ this._handler = fn; } };
}
const pane = {
  _html: '',
  set innerHTML(v){ this._html = v; },
  get innerHTML(){ return this._html; },
  querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
};
/* hide the WebSocket global (Node >=22 ships one) so the degradation path
   is exercised exactly like a browser without WebSocket support */
const __hadWS = globalThis.WebSocket;
globalThis.WebSocket = undefined;
tab.mount(pane);
ok(pane._html.indexOf('class="panel"') >= 0 && pane._html.indexOf('<h2>LIQS') >= 0,
   'mount builds .panel with h2 title');
ok(pane._html.indexOf('id="liqsStart"') >= 0 && pane._html.indexOf('id="liqsStop"') >= 0
   && pane._html.indexOf('btn ghost') >= 0, 'START .btn + STOP .btn.ghost present');
ok(pane._html.indexOf('id="liqsStat"') >= 0, 'status .note present');
ok(pane._html.indexOf('id="liqsTape"') >= 0 && pane._html.indexOf('id="liqsSyms"') >= 0
   && pane._html.indexOf('id="liqsGauge"') >= 0 && pane._html.indexOf('id="liqsImb"') >= 0,
   'tape, per-symbol table, gauge + interpretation containers present');
ok(pane._html.indexOf('WS-only — history starts when you open this tab') >= 0,
   'honest WS-only scope note rendered');
ok(typeof stubs['#liqsStart']._handler === 'function', 'START wired to a click handler');
ok(typeof stubs['#liqsStop']._handler === 'function', 'STOP wired to a click handler');
ok(stubs['#liqsStart'].disabled === true, 'no WebSocket in scope -> START disabled');
ok(stubs['#liqsStat'].className === 'note warn'
   && stubs['#liqsStat'].textContent.indexOf('WebSocket unavailable') >= 0,
   'graceful .note.warn when WebSocket is missing');
let threw = null;
try{ stubs['#liqsStart']._handler(); }catch(e){ threw = e; }
ok(!threw, 'START click without WebSocket does not throw');
threw = null;
try{ stubs['#liqsStop']._handler(); }catch(e){ threw = e; }
ok(!threw, 'STOP click with no open socket does not throw');
tab.mount(pane); // second mount must not throw either
ok(true, 'mount is idempotent (second call does not throw)');
tab.mount(null);
ok(true, 'mount(null) tolerated without throwing');
globalThis.WebSocket = __hadWS; // restore the real global

/* ================= J) liqFlushSetup — flush-reversal setups ================= */
console.log('== liqFlushSetup: trigger, direction, stop, NaN-safety ==');
const FS = globalThis.window.liqFlushSetup;
ok(typeof FS === 'function', 'window.liqFlushSetup exposed');
ok(globalThis.window.liqFlushRows === undefined && globalThis.window.liqFlushCandle === undefined
   && globalThis.window.setupCardHTML === undefined && globalThis.window.renderSetups === undefined,
   'flush-setup internals do not leak onto window');

const J_NOW = Date.now(); /* live clock — liqFlushSetup defaults opts.now to Date.now() */
function jSnap(prints, aggOpts, snapNow){
  const g = AGG(aggOpts);
  for (const x of prints) g.add(x);
  return g.snapshot(snapNow === undefined ? J_NOW : snapNow);
}
/* 10 x 1h candles, t in SECONDS (index.html convention), last close 109 */
function jRows(){
  const tSec = J_NOW / 1000;
  const rows = [];
  for (let i = 0; i < 10; i++)
    rows.push({ t: tSec - (9 - i) * 3600, o: 100 + i, h: 105 + i, l: 95 + i, c: 100 + i, v: 1 });
  return rows;
}
/* long-flush with an extreme spike: 3.64M long vs 320K short, biggest long print $3M */
function jFlushSnap(){
  return jSnap([
    { sym: 'BTCUSDT', side: 'long',  usd: 640000,  t: J_NOW - 2000 },
    { sym: 'BTCUSDT', side: 'long',  usd: 3000000, t: J_NOW - 1000 },
    { sym: 'ETHUSDT', side: 'short', usd: 320000,  t: J_NOW - 1000 }
  ]);
}

/* ---- trigger: BOTH the >=2x imbalance AND the extreme spike are required ---- */
ok(FS(jSnap([{ sym: 'L', side: 'long', usd: 100000, t: J_NOW - 500 },
             { sym: 'S', side: 'short', usd: 100000, t: J_NOW - 500 }])) === null,
   'balanced 1h tape -> null (no flush)');
ok(FS(jSnap([{ sym: 'L', side: 'long',  usd: 640000, t: J_NOW - 500 },
             { sym: 'L', side: 'long',  usd: 700000, t: J_NOW - 400 },
             { sym: 'S', side: 'short', usd: 320000, t: J_NOW - 400 }])) === null,
   'flush imbalance (4.2x) but every print < $2M spike floor -> null (side not extreme)');
ok(FS(jSnap([{ sym: 'L', side: 'long',  usd: 3000000, t: J_NOW - 500 },
             { sym: 'S', side: 'short', usd: 3000000, t: J_NOW - 500 }])) === null,
   'extreme spike prints but 1.0x balanced -> null (no flush)');
ok(FS(jSnap([{ sym: 'L', side: 'long', usd: 3000000, t: J_NOW - 3600000 },
             { sym: 'S', side: 'short', usd: 100000,  t: J_NOW - 500 }])) === null,
   'spike at exactly the window edge (t == cut) is excluded -> null');
let j = FS(jFlushSnap());
ok(j !== null, 'flush >=2x + spike >= $2M inside the window -> setup fires');
ok(j && j.type === 'FLUSH-REVERSAL', 'setup type tag FLUSH-REVERSAL');

/* ---- direction logic: fade the flushed side ---- */
ok(j.dir === 'short' && j.flushSide === 'long', 'long flush -> SHORT setup (fade the flushed longs)');
j = FS(jSnap([{ sym: 'BTCUSDT', side: 'short', usd: 2500000, t: J_NOW - 1000 },
              { sym: 'BTCUSDT', side: 'short', usd: 900000,  t: J_NOW - 900 },
              { sym: 'ETHUSDT', side: 'long',  usd: 800000,  t: J_NOW - 900 }]));
ok(j && j.dir === 'long' && j.flushSide === 'short', 'short flush -> LONG setup (fade the flushed shorts)');
ok(j.sym === 'BTCUSDT', 'setup symbol = symbol of the biggest same-side spike in the window');
j = FS(jSnap([{ sym: 'AAAUSDT', side: 'long', usd: 2100000, t: J_NOW - 900 },
              { sym: 'BBBUSDT', side: 'long', usd: 2900000, t: J_NOW - 800 },
              { sym: 'CCCUSDT', side: 'long', usd: 2500000, t: J_NOW - 700 }]));
ok(j && j.sym === 'BBBUSDT' && nearly(j.flushUsd, 2900000),
   'multiple spikes -> the biggest same-side print wins (symbol + $)');
ok(j && j.spikeUsd === 2000000 && j.ratio === Infinity, 'only-longs window: ratio Infinity passthrough, spikeUsd exposed');

/* ---- custom flushRatio / spike floor ---- */
ok(FS(jSnap([{ sym: 'L', side: 'long',  usd: 2500000, t: J_NOW - 500 },
             { sym: 'S', side: 'short', usd: 1000000, t: J_NOW - 500 }], { flushRatio: 3 })) === null,
   'custom flushRatio 3: 2.5x imbalance + spike -> still null');
j = FS(jSnap([{ sym: 'L', side: 'long',  usd: 3000000, t: J_NOW - 500 },
              { sym: 'S', side: 'short', usd: 1000000, t: J_NOW - 500 }], { flushRatio: 3 }));
ok(j !== null, 'custom flushRatio 3: 3.0x boundary + spike -> fires (inclusive)');
j = FS(jSnap([{ sym: 'L', side: 'long',  usd: 640000, t: J_NOW - 500 },
              { sym: 'L', side: 'long',  usd: 700000, t: J_NOW - 400 },
              { sym: 'S', side: 'short', usd: 320000, t: J_NOW - 400 }]), null, { minSpikeUsd: 600000 });
ok(j && j.flushUsd === 700000, 'opts.minSpikeUsd override: $700K print fires at a $600K floor');

/* ---- levels: ENTRY = last close, STOP beyond the flush wick +/- 0.5xATR ---- */
const __hadAtr = globalThis.atr;
globalThis.atr = function(){ return [1,1,1,1,1,1,1,1,1,4]; }; // ATR14 = 4
j = FS(jFlushSnap(), jRows());
ok(j && j.entry === 109, 'ENTRY = last 1h close (current mark)');
ok(j.stop === 113 + 0.5 * 4 && j.stop > 113,
   'short setup: STOP = flush-candle (the one containing the spike) high + 0.5xATR14, strictly beyond the wick');
let jrisk = Math.abs(j.entry - j.stop);
ok(nearly(j.t1, j.entry - 2 * jrisk) && nearly(j.t2, j.entry - 3.5 * jrisk)
   && j.rr1 === 2 && j.rr2 === 3.5 && nearly(j.riskPct, jrisk / j.entry * 100),
   'short: T1 = ENTRY - 2R, T2 = ENTRY - 3.5R, riskPct = risk/entry*100');
j = FS(jSnap([{ sym: 'BTCUSDT', side: 'short', usd: 2500000, t: J_NOW - 1000 },
              { sym: 'ETHUSDT', side: 'long',  usd: 800000,  t: J_NOW - 900 }]), jRows());
ok(j && j.dir === 'long' && j.stop === 103 - 0.5 * 4 && j.stop < 103,
   'long setup: STOP = flush-candle low - 0.5xATR14, strictly below the wick');
jrisk = Math.abs(j.entry - j.stop);
ok(nearly(j.t1, j.entry + 2 * jrisk) && nearly(j.t2, j.entry + 3.5 * jrisk),
   'long: T1 = ENTRY + 2R, T2 = ENTRY + 3.5R');
ok(j.note.indexOf('0.5xATR14') >= 0, 'note documents the ATR buffer');

/* ---- flush candle = the candle CONTAINING the spike print, not the last one ---- */
{
  const tSec = J_NOW / 1000;
  const rows = jRows();
  rows[3].h = 250; rows[3].l = 90; // spike lands inside candle #3
  const spikeT = (tSec - 6 * 3600 + 120) * 1000; // candle #3 covers [tSec-6h, tSec-5h)
  const agg8h = { windowMs: 8 * 3600e3 }; // wide window so the 6h-old spike still counts
  j = FS(jSnap([{ sym: 'BTCUSDT', side: 'long',  usd: 3000000, t: spikeT },
                { sym: 'ETHUSDT', side: 'short', usd: 320000,  t: J_NOW - 500 }], agg8h), rows);
  ok(j && j.dir === 'short' && j.stop === 250 + 0.5 * 4,
     'stop is placed beyond the spike candle\'s high (250), not the last candle\'s (114)');
  j = FS(jSnap([{ sym: 'BTCUSDT', side: 'short', usd: 3000000, t: spikeT },
                { sym: 'ETHUSDT', side: 'long',  usd: 320000,  t: J_NOW - 500 }], agg8h), rows);
  ok(j && j.dir === 'long' && j.stop === 90 - 0.5 * 4,
     'mirrored: long stop beyond the spike candle\'s low (90)');
}

/* ---- % fallback when atr is unavailable ---- */
globalThis.atr = undefined;
j = FS(jFlushSnap(), jRows());
ok(j && j.stop === 113 + 0.005 * 109 && j.stop > 113,
   'atr absent -> stop = wick + 0.5% of entry (documented % fallback), still beyond the wick');
ok(j.note.indexOf('fallback') >= 0, 'note documents the % fallback');
globalThis.atr = function(){ throw new Error('boom'); };
j = FS(jFlushSnap(), jRows());
ok(j && j.entry === 109 && j.stop === 113 + 0.005 * 109,
   'throwing atr degrades to the % fallback instead of breaking the setup');
globalThis.atr = __hadAtr;

/* ---- kline context missing or degenerate: honest null levels, never NaN ---- */
j = FS(jFlushSnap());
ok(j && j.entry === null && j.stop === null && j.t1 === null && j.t2 === null && j.riskPct === null
   && j.note.indexOf('kline context unavailable') >= 0,
   'no rows -> setup kept, levels null with an honest note (nothing fabricated)');
j = FS(jFlushSnap(), [{ t: 1, o: 100, h: NaN, l: 95, c: 100 }, { t: 2, o: 100, h: 105, l: 95, c: NaN }]);
ok(j && j.entry === null, 'rows with NaN h/c are dropped -> levels null');
j = FS(jFlushSnap(), 'not-an-array');
ok(j && j.entry === null, 'non-array rowsOpt tolerated -> levels null');
{
  globalThis.atr = function(){ return [4]; };
  j = FS(jFlushSnap(), [{ t: J_NOW / 1000, o: 100, h: 50, l: 40, c: 100 }]); // wick far below entry
  ok(j && j.entry === null && j.note.indexOf('degenerate') >= 0,
     'crossed levels (stop under entry on a short) -> no plan emitted');
  globalThis.atr = __hadAtr;
}

/* ---- garbage inputs ---- */
ok(FS(null) === null && FS(undefined) === null && FS({}) === null
   && FS({ imbalance: {} }) === null && FS({ imbalance: { cls: 'long-flush' } }) === null
   && FS({ imbalance: { cls: 'up-only' }, top: [] }) === null,
   'null/garbage/unknown-cls snapshots -> null, never throws');
ok(FS(jFlushSnap(), jRows(), { now: NaN }) !== null,
   'NaN opts.now falls back to Date.now() -> setup still fires, never throws');
j = FS(jFlushSnap(), jRows(), { now: J_NOW });
ok(j && j.entry === 109, 'explicit opts.now drives the window cutoff deterministically');

/* ---- mount: SETUPS panel scaffold + empty state ---- */
console.log('== mount: FLUSH-REVERSAL SETUPS panel ==');
ok(pane._html.indexOf('FLUSH-REVERSAL SETUPS') >= 0 && pane._html.indexOf('id="liqsSetups"') >= 0,
   'mount markup includes the FLUSH-REVERSAL SETUPS panel + container');
ok(typeof globalThis.getCandles !== 'function', 'test scope has no getCandles (degrade path exercised)');
ok(stubs['#liqsSetups'].innerHTML.indexOf('no flush-reversal setup') >= 0,
   'empty tape renders the honest empty state, no crash without getCandles');

/* ================= K) HARD REFRESH contract ================= */
console.log('== hard refresh: registration, status paths, WS reconnect ==');
const __unhandledL = [];
process.on('unhandledRejection', function(e){ __unhandledL.push(e); });

ok(typeof tab.refresh === 'function', 'refresh: HG_tabs registration exposes refresh() as the 4th field');
ok(globalThis.window.refreshLiqs === undefined && globalThis.window.reconnectNow === undefined,
   'refresh internals do not leak onto window');

/* a pristine module whose tape was never started -> honest skip */
const ctxK = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(root + 'liqs.js', 'utf8'), ctxK, { filename: 'liqs.js' });
let rk = await ctxK.window.HG_tabs[0].refresh();
ok(rk === 'skipped: not run yet', 'refresh on a never-started tape -> "skipped: not run yet" (got "' + rk + '")');

/* live session against a stubbed WebSocket */
const wsMade = [];
function StubWS(url){ this.url = url; this.readyState = 0; wsMade.push(this); }
StubWS.prototype.close = function(){ this.readyState = 3; if (this.onclose) this.onclose(); };
const __hadWS2 = globalThis.WebSocket;
globalThis.WebSocket = StubWS;

stubs['#liqsStart']._handler(); /* START — opens stub socket #1 */
ok(wsMade.length === 1 && wsMade[0].url.indexOf('forceOrder') > -1, 'START opens the forceOrder socket');
rk = await tab.refresh();
ok(rk === 'refreshed' && wsMade.length === 1,
   'refresh while CONNECTING -> "refreshed", no extra socket opened (got "' + rk + '")');

wsMade[0].onopen(); /* socket goes live */
wsMade[0].onmessage({ data: JSON.stringify({ o: { s: 'BTCUSDT', S: 'SELL', p: '50000', q: '4', T: Date.now() } }) });
stubs['#liqsTape'].innerHTML = ''; /* wipe the pane: refresh must recompute it from the buffer */
rk = await tab.refresh();
ok(rk === 'refreshed' && stubs['#liqsTape'].innerHTML.indexOf('BTCUSDT') > -1
   && stubs['#liqsTape'].innerHTML.indexOf('LONG LIQ') > -1,
   'refresh always recomputes the tape/aggregate panels from the current buffer');

/* socket silently CLOSED -> refresh reconnects immediately, stale socket detached */
wsMade[0].readyState = 3;
rk = await tab.refresh();
ok(rk === 'refreshed' && wsMade.length === 2,
   'refresh on a CLOSED socket reconnects immediately (socket #2, got "' + rk + '")');
ok(wsMade[0].onclose === null && wsMade[0].onmessage === null && wsMade[0].onopen === null,
   'the stale socket is detached before reconnect (no ghost retry from a belated onclose)');

/* socket dropped mid-session (onclose fired, bounded backoff pending) -> refresh accelerates the retry */
wsMade[1].onclose(); /* module handler: status 'reconnecting', retry scheduled ~1s out */
rk = await tab.refresh();
ok(rk === 'refreshed' && wsMade.length === 3,
   'refresh during reconnect-backoff reconnects NOW instead of waiting (socket #3)');

/* explicit STOP: panels recompute, but no reconnect against the operator's choice */
stubs['#liqsStop']._handler();
rk = await tab.refresh();
ok(rk === 'refreshed' && wsMade.length === 3,
   'refresh after STOP -> panels recomputed, NO reconnect (manual close respected)');

/* never throws: a failing socket constructor on the reconnect path */
globalThis.WebSocket = function(){ throw new Error('no sockets'); };
stubs['#liqsStart']._handler(); /* START again — connect() catches, bounded retry scheduled */
let threwK = null;
try { rk = await tab.refresh(); } catch(e){ threwK = e; }
ok(!threwK && rk === 'refreshed',
   'refresh never throws even when the socket constructor fails (got "' + rk + '")');
stubs['#liqsStop']._handler(); /* clear the pending bounded retry + tick interval */
globalThis.WebSocket = __hadWS2;

await new Promise(r => setTimeout(r, 100));
ok(__unhandledL.length === 0, 'no unhandled rejections on any refresh path');

/* ================= L) BRAIN warm-up: socket auto-start ================= */
console.log('== warm-up: auto-start, double-start guard, reuse, honesty ==');

/* the exported warm hook keeps its name + signature byte-identical for brain.js */
const warmG = globalThis.window.HG_warmups.filter(function(h){ return h && h.id === 'liqs'; })[0];
ok(warmG && warmG.label === 'LIQS' && typeof warmG.run === 'function',
   'HG_warmups entry {id:liqs, label:LIQS, run} registered');
ok(warmG.run.length === 0 && warmG.run.constructor.name === 'AsyncFunction',
   'warm hook signature unchanged: zero-arg async function (brain.js calls it unchanged)');

/* fresh vm context per scenario: real timers (startStream owns an interval),
   a stubbed WebSocket mirroring section K, no network ever touched */
function mkWarmCtx(WS, localStorage){
  const ctx = vm.createContext({
    window: { localStorage: localStorage || null },
    WebSocket: WS,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval
  });
  return ctx;
}
function mkStubWS(made){
  function StubWS(url){ this.url = url; this.readyState = 0; made.push(this); }
  StubWS.prototype.close = function(){ this.readyState = 3; if (this.onclose) this.onclose(); };
  return StubWS;
}
function mkPane(stubs){
  return {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
}
function loadLiqs(ctx){
  vm.runInContext(fs.readFileSync(root + 'liqs.js', 'utf8'), ctx, { filename: 'liqs.js' });
  return ctx.window.HG_warmups[0].run;
}

/* ---- L1: idle layer — warm itself opens the socket via the shared starter ---- */
{
  const made = [];
  const ctx = mkWarmCtx(mkStubWS(made));
  const warm = loadLiqs(ctx);

  let r = await warm();
  ok(r === 'socket started — accumulating liquidations' && made.length === 1
     && made[0].url.indexOf('forceOrder') > -1,
     'warm on an idle layer starts the forceOrder socket — got "' + r + '"');

  r = await warm();
  ok(r === 'socket connecting — accumulating liquidations' && made.length === 1,
     'double-warm while CONNECTING opens no second socket — got "' + r + '"');

  made[0].onopen(); /* socket live, no prints yet */
  r = await warm();
  ok(r === 'socket live — 0 events in window' && made.length === 1,
     'warm on a live-but-empty stream reports a real 0, still no new socket — got "' + r + '"');

  made[0].onmessage({ data: JSON.stringify({ o: { s: 'BTCUSDT', S: 'SELL', p: '50000', q: '4', T: Date.now() } }) });
  r = await warm();
  ok(r === 'socket live — 1 event in window' && made.length === 1,
     'warm reports the REAL accumulated window count (1 print ingested) — got "' + r + '"');

  /* tab mounted AFTER the auto-start reflects the running state */
  const stubsL = {}, paneL = mkPane(stubsL);
  ctx.window.HG_tabs[0].mount(paneL);
  ok(stubsL['#liqsStat'].textContent.indexOf('LIVE') > -1,
     'tab mounted after auto-start shows the live status — got "' + stubsL['#liqsStat'].textContent + '"');
  ok(stubsL['#liqsStart'].disabled === true && stubsL['#liqsStart'].textContent === 'RUNNING',
     'START reflects the auto-started socket: disabled + RUNNING');
  stubsL['#liqsStart']._handler(); /* pressed anyway — the shared starter guards */
  ok(made.length === 1, 'START pressed while live is a guarded no-op — never a second socket');

  stubsL['#liqsStop']._handler(); /* explicit STOP — also clears tick/retry timers */
  ok(made.length === 1 && made[0].readyState === 3, 'STOP closes the auto-started socket');
  ok(stubsL['#liqsStart'].disabled === false && stubsL['#liqsStart'].textContent === 'START',
     'START re-arms after STOP');
  r = await warm();
  ok(r.indexOf('skipped') === 0 && r.indexOf('operator') > -1 && made.length === 1,
     'warm never restarts against an explicit operator STOP — got "' + r + '"');
}

/* ---- L2: warm after the tab's own START reuses the live session ---- */
{
  const made = [];
  const ctx = mkWarmCtx(mkStubWS(made));
  loadLiqs(ctx);
  const stubs2 = {}, pane2 = mkPane(stubs2);
  ctx.window.HG_tabs[0].mount(pane2);
  stubs2['#liqsStart']._handler(); /* operator START — fresh session */
  made[0].onopen();
  made[0].onmessage({ data: JSON.stringify({ o: { s: 'ETHUSDT', S: 'BUY', p: '3000', q: '100', T: Date.now() } }) });
  made[0].onmessage({ data: JSON.stringify({ o: { s: 'SOLUSDT', S: 'SELL', p: '100', q: '1000', T: Date.now() } }) });
  const r = await ctx.window.HG_warmups[0].run();
  ok(r === 'socket live — 2 events in window' && made.length === 1,
     'warm after tab START reuses the live socket — real count 2, no reset, no second socket — got "' + r + '"');
  stubs2['#liqsStop']._handler(); /* clear tick timer */
}

/* ---- L3: no WebSocket in the environment — honest skip, never throws ---- */
{
  const ctx = mkWarmCtx(undefined);
  const warm = loadLiqs(ctx);
  let r = null, threw = null;
  try{ r = await warm(); }catch(e){ threw = e; }
  ok(!threw && r === 'skipped: stream unavailable — no WebSocket in this environment',
     'no-WebSocket environment -> honest skip string, nothing thrown — got "' + r + '"');
}

/* ---- L4: the start itself fails — honest skip naming why ---- */
{
  const ctx = mkWarmCtx(function(){ throw new Error('no sockets'); });
  const warm = loadLiqs(ctx);
  let r = null, threw = null;
  try{ r = await warm(); }catch(e){ threw = e; }
  ok(!threw && typeof r === 'string' && r.indexOf('skipped') === 0 && r.indexOf('fail') > -1,
     'socket constructor failure -> honest skip naming the failure — got "' + r + '"');
  const stubs4 = {}, pane4 = mkPane(stubs4);
  ctx.window.HG_tabs[0].mount(pane4);
  stubs4['#liqsStop']._handler(); /* clear the pending bounded retry + tick */
}

/* ---- L5: live status but silently-dead socket — immediate bounded reconnect ---- */
{
  const made = [];
  const ctx = mkWarmCtx(mkStubWS(made));
  const warm = loadLiqs(ctx);
  await warm();                    /* auto-start socket #1 */
  made[0].onopen();                /* live */
  made[0].readyState = 3;          /* silently dead — no onclose fired */
  const r = await warm();
  ok(made.length === 2 && r.indexOf('reconnect') > -1,
     'warm on a silently-dead socket reconnects immediately (socket #2) — got "' + r + '"');
  const stubs5 = {}, pane5 = mkPane(stubs5);
  ctx.window.HG_tabs[0].mount(pane5);
  stubs5['#liqsStop']._handler(); /* clear tick timer + close socket #2 */
}

await new Promise(r => setTimeout(r, 100));
ok(__unhandledL.length === 0, 'no unhandled rejections on any warm-up path');

console.log('== liqs session persist ==');
{
  const store = new Map();
  const ls = {
    getItem: function(k){ return store.has(k) ? store.get(k) : null; },
    setItem: function(k, v){ store.set(k, String(v)); },
    removeItem: function(k){ store.delete(k); }
  };
  const ctx = mkWarmCtx(mkStubWS([]), ls);
  loadLiqs(ctx);
  const agg = ctx.window.liqAgg();
  agg.add({ sym: 'BTCUSDT', side: 'long', usd: 2e6, t: Date.now() });
  ctx.window.liqsState = ctx.window.liqsState || (function(){
    return { snap: agg.snapshot(), setup: null, at: Date.now(), live: false };
  });
  /* replay path via module state — hydrate by reloading with saved payload */
  const payload = store.get('hg_liqs_session_v1');
  ok(!payload, 'fresh module before ingest persist throttle — may be absent immediately');
  const ctx2 = mkWarmCtx(mkStubWS([]), ls);
  store.set('hg_liqs_session_v1', JSON.stringify({
    v: 1, at: Date.now(), manualClose: false,
    prints: [{ sym: 'ETHUSDT', side: 'short', usd: 1500000, t: Date.now() }]
  }));
  loadLiqs(ctx2);
  const st = ctx2.window.liqsState();
  ok(st && st.snap && st.snap.window.count >= 1, 'hydrated session restores rolling window for BRAIN');
}

console.log('\nALL ' + passed + ' LIQS ASSERTIONS PASSED');
