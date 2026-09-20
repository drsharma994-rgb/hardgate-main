/* HARDGATE — one scoring crash counted a contract twice, and was reported as
   a fetch error.

   THE DOUBLE COUNT. The scan loop incremented `scanned` right after the engine
   call, then ran ~165 lines of scoring -- order flow, sentiment, external
   risk, the three-layer blend, the pro-grade stamp, SMC -- and the single
   catch around the whole body incremented it AGAIN. Driven through the real
   runScan with layer 2 rigged to throw on one of three contracts:

     scanned 4 of a 3-contract universe
     progress bar 133.3%
     status line "scanned 4/3"

   None of the scoring calls is individually guarded, so any of them throwing
   on a malformed row reaches that catch.

   THE MISREPORT. Pack 870 drew a line between `unread` (a fact about the
   fetch) and `skipped` (a fact about the contract), because a Binance 451 for
   every symbol had been reading as "fewer than 230 closed 15m bars". The same
   line was never drawn on the other half of the loop. A crash in this app's
   own scoring landed in `errors` beside a network failure, so the reader was
   told a contract errored when its bars had in fact arrived and its engine had
   voted -- and had no way to tell the two apart or act on either.

   scanned now ticks exactly once per contract, the scoring block has its own
   boundary, and COVERAGE reports "read and voted, then scoring threw" with a
   bounded label per cause.

   Run: node tests/test-cryptoscan-scan-count.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'sentiment.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;

function fakeEl(){
  const nodes = {};
  return {
    _html: '',
    set innerHTML(v){ this._html = String(v); },
    get innerHTML(){ return this._html; },
    querySelector(sel){
      const id = String(sel).replace(/^#/, '');
      if (this._html.indexOf('id="' + id + '"') < 0) return null;
      if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '',
                                    disabled: false, addEventListener(){},
                                    classList: { toggle(){}, contains(){ return false; } } };
      return nodes[id];
    },
    _node(id){ return nodes[id] || null; }
  };
}

let seed = 3;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = 300, r15 = []; let px = 100;
const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - N * SEC;
for (let i = 0; i < N; i++){
  const o = px, c = px * (1 + (rnd() - 0.5 + 0.08) * 0.010);
  r15.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
             l: Math.min(o, c) * 0.999, v: 1000 + rnd() * 1000 });
  px = c;
}
const H = Math.floor(Date.now() / 1000 / 3600) * 3600, r1h = [];
for (let i = 199; i >= 0; i--) r1h.push({ t: H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });

const realFlow = S.hgOrderFlowScore;
const realFetchRes = S.hgDeskFetchKlinesResult;

/** run the real runScan over `syms`, with optional sabotage */
async function scan(syms, opts){
  const o = opts || {};
  const items = syms.map(x => ({ sym: x, exchange: 'delta', base: x }));
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items, venueCounts: { delta: items.length, coindcx: 0 },
                                            rawLen: items.length });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? r15.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) => {
    if (o.fetchThrow && o.fetchThrow.indexOf(it.sym) >= 0) throw new Error('fetch exploded');
    if (o.fetchBad && o.fetchBad.indexOf(it.sym) >= 0)
      return { rows: [], ok: false, reason: 'fetch-failed', error: null };
    if (o.thinBars && o.thinBars.indexOf(it.sym) >= 0)
      return { rows: r15.slice(0, 40), ok: true, reason: null, error: null };
    return { rows: tf === '15m' ? r15.slice() : r1h.slice(), ok: true, reason: null, error: null };
  };
  S.hgSentimentLoad = async () => ({});
  S.hgOrderFlowScore = function(sym, a, b){
    if (o.scoreThrow && o.scoreThrow.indexOf(sym) >= 0) throw new (o.errCls || Error)(o.errMsg || 'layer-2 blew up');
    return realFlow.call(this, sym, a, b);
  };
  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  const el = fakeEl();
  tab.mount(el);
  const out = await tab.refresh();
  S.hgOrderFlowScore = realFlow;
  S.hgDeskFetchKlinesResult = realFetchRes;
  return { out: out, r: S.cryptoScanState(), el: el };
}

/* ---------------------------------------------------------------- 1
   scanned ticks once per contract, whatever happens to it. */
{
  const clean = await scan(['AAA', 'BBB', 'CCC']);
  ok(clean.out === 'refreshed', 'a clean scan runs');
  ok(clean.r.scanned === 3, 'three contracts, scanned 3');

  const crash = await scan(['AAA', 'BBB', 'CCC'], { scoreThrow: ['BBB'] });
  ok(crash.r.universe === 3, 'the universe is still 3');
  ok(crash.r.scanned === 3,
     'with a scoring crash on one of them, scanned is ' + crash.r.scanned + ' — not 4');
  ok(crash.r.scanned <= crash.r.universe, 'scanned never exceeds the universe');
  ok((crash.r.scanned / crash.r.universe) * 100 <= 100,
     'so the progress bar cannot read over 100%');

  /* every failure mode, one tick each */
  const mixed = await scan(['A', 'B', 'C', 'D', 'E'],
    { scoreThrow: ['A'], fetchThrow: ['B'], fetchBad: ['C'], thinBars: ['D'] });
  ok(mixed.r.scanned === 5,
     'one scoring crash, one fetch throw, one bad fetch, one thin contract and one clean: scanned '
     + mixed.r.scanned);
  ok(mixed.r.errors === 1, 'the fetch THROW is the error (' + mixed.r.errors + ')');
  ok(mixed.r.unread === 1, 'the bad fetch is unread (' + mixed.r.unread + ')');
  ok(mixed.r.skipped === 1, 'the thin contract is skipped (' + mixed.r.skipped + ')');
  ok(mixed.r.scoreFailed === 1, 'and the scoring crash is its own count (' + mixed.r.scoreFailed + ')');
  ok(mixed.r.errors + mixed.r.unread + mixed.r.skipped + 1 + 1 === mixed.r.scanned,
     'and the four failure modes plus the clean one account for every tick');
}

/* ---------------------------------------------------------------- 2
   A SCORING CRASH IS NOT A FETCH ERROR. */
{
  const crash = await scan(['AAA', 'BBB', 'CCC'], { scoreThrow: ['BBB'] });
  ok(crash.r.errors === 0,
     'a contract whose bars arrived and whose engine voted is NOT an error');
  ok(crash.r.scoreFailed === 1, 'it is a scoring failure');
  ok(crash.r.unread === 0 && crash.r.skipped === 0, 'and neither unread nor skipped');
  ok(crash.r.setups.length === 2, 'the other two still produce setups');

  const cov = S.csCoverage(crash.r);
  ok(cov.read === 3, 'COVERAGE counts all three as read — because they were');
  ok(cov.scoreFailed === 1, 'with one of them scored-and-crashed');
  ok(cov.partial === true, 'and the run is flagged partial, not silently whole');

  const line = text(S.csCoverageHTML(crash.r));
  ok(/read and voted, then scoring threw/.test(line),
     'the panel says what actually happened: "' + line + '"');
  ok(!/threw before their bars could be read/.test(line),
     'and does not also claim a fetch error');
  ok(/layer-2 blew up/.test(line), 'naming the cause');

  /* the fetch-throw wording is still there for real fetch errors */
  const fetchBad = await scan(['AAA', 'BBB'], { fetchThrow: ['BBB'] });
  const fline = text(S.csCoverageHTML(fetchBad.r));
  ok(/threw before their bars could be read/.test(fline), 'a real fetch throw reads as one');
  ok(!/scoring threw/.test(fline), 'and is not reported as a scoring crash');
}

/* ---------------------------------------------------------------- 3
   The cause label is bounded, and tallies. */
{
  const K = S.__csScoreFailKey;
  ok(typeof K === 'function', 'csScoreFailKey is exported');
  ok(K(new TypeError('x is not a function')) === 'TypeError: x is not a function',
     'name and message');
  ok(K(new Error('')) === 'Error', 'an empty message gives the name alone');
  ok(K(null) === 'Error' && K(undefined) === 'Error', 'and a missing error does not throw');

  const long = K(new Error('y'.repeat(500)));
  ok(long.length <= 'Error: '.length + 60,
     'a 500-character message is cut to 60 (' + long.length + ' chars total)');
  ok(K(new Error('a\n\n  b\tc')) === 'Error: a b c', 'whitespace is collapsed, so one cause is one key');

  /* the same crash on many contracts is ONE line with a count, not many */
  const many = await scan(['A', 'B', 'C', 'D'], { scoreThrow: ['A', 'B', 'C'] });
  ok(many.r.scoreFailed === 3, 'three contracts crashed the same way');
  ok(Object.keys(many.r.scoreWhy).length === 1, 'and they tally under one key');
  const t = S.__csScoreWhyText(S.csCoverage(many.r));
  ok(/\(3\)/.test(t), 'reported with its count: "' + t + '"');
  ok(many.r.scanned === 4, 'and scanned is still 4');

  /* different causes stay apart, ordered by how many hit */
  const two = await scan(['A', 'B'], { scoreThrow: ['A'], errCls: TypeError, errMsg: 'bad row' });
  ok(Object.keys(two.r.scoreWhy)[0] === 'TypeError: bad row',
     'a different error class is a different key');
  ok(S.__csScoreWhyText({ scoreWhy: { a: 1, b: 5, c: 3 } }) === 'b (5) · c (3) · a (1)',
     'and the text is ordered by count');
  ok(S.__csScoreWhyText(null) === '' && S.__csScoreWhyText({}) === '',
     'no failures, no text');
}

/* ---------------------------------------------------------------- 4
   Source: the boundary exists and the catch is conditional. */
{
  const bare = stripComments(SCAN);
  ok(/var scannedThis = false;/.test(bare), 'the per-contract flag exists');
  ok(/if \(!scannedThis\)\{\s*scanned\+\+;/.test(bare),
     'and the catch only counts a contract the body never reached');
  ok(!/errors\+\+;\s*scanned\+\+;/.test(bare), 'the unconditional double-tick is gone');
  ok(/catch \(eScore\)|catch\(eScore\)/.test(bare), 'scoring has its own catch');
  ok(/scoreFailed\+\+;/.test(bare), 'which counts separately');
  /* the scoring catch must sit INSIDE the outer one, or a fetch throw would
     be miscounted as a scoring failure */
  ok(bare.indexOf('var scannedThis') < bare.indexOf('catch(eScore)'),
     'and inside the outer boundary');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
