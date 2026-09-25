/* HARDGATE -- hg-v969: the spread lock reaches OMNIGOLD and OMNIGOLD 1, and the
   advisory hg-v968 wrote is finally READ.

   hg-v968 fed the gold spread lock on GOLD SCALP and GOLD SWING from the Delta
   perp payload each desk already fetches. OMNIGOLD -- whose institutional
   filter is a HARD ledger row (hg-v551) -- and OMNIGOLD 1 fetch the SAME
   payload and went on reading only the __hgGoldQuote global, which nothing in
   this repo writes. And the advisory verdict v968 wrote onto the candidate
   (cand.spreadLock.advisory) was read by no card: the ornamental field
   hg-v955 names, in my own previous pack.

   Sections:
     1) the shared reader is unchanged and still the ONE reader
     2) OMNIGOLD: the real perp handler is lifted and RUN -- the shared context
        carries the quote, the venue travels, a broker quote on the global wins,
        a half quote leaves nothing, goldind absent throws nothing
     3) OMNIGOLD: driven through hgOgGates -- a wide proxy quote is REPORTED on
        the inst-filter row and does not veto; a wide broker quote still LOCKS;
        a narrow quote says nothing; no quote says nothing
     4) GOLD SCALP / GOLD SWING: the advisory lands on c.notes, which both cards paint
     5) OMNIGOLD 1: the real post-await block is lifted and RUN; the load line
        names the venue; the spread veto needs the 20d average nothing supplies,
        so NO verdict moves -- asserted, not assumed
     6) still zero writers of the globals (the v968 partition holds)
     7) build stamps
   Run: node tests/test-gold-spread-lock-omnigold.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){}
  }
  return ctx;
}
const OG_FILES = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                  'hg-forward.js','hg-gates.js','hg-plan.js','goldind.js','omniroute.js','omnigold.js'];
function bars(n, start, step, seed){
  const out = []; let p = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.002);
    const r = p * 0.0015 * (0.4 + rnd());
    out.push({ t: 1700000000 + i * step, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}
const NY = Date.UTC(2024, 0, 16, 14, 0, 0);
const WIDE = 0.60, NARROW = 0.10;   /* against the unchanged $0.25 bar */

console.log('== 1) one reader, unchanged ==');
{
  const W = boot(OG_FILES);
  assert(typeof W.hgGoldQuoteFromPerp === 'function', 'hgGoldQuoteFromPerp is exported');
  const q = W.hgGoldQuoteFromPerp({ ticker: { bid: 4300.4, ask: 4300.6, spreadUsd: 0.2 } }, 'delta-xaut');
  assert(q && Math.abs(q.spreadUsd - 0.2) < 1e-9 && q.venue === 'delta-xaut', 'reads a full quote and stamps the venue');
  assert(W.hgGoldQuoteFromPerp({ ticker: { bid: 4300.4 } }, 'delta-xaut') === null, 'a half quote is no quote');
  assert(Math.abs(W.HG_GOLD_SPREAD_MAX_USD - 0.25) < 1e-12, 'the $0.25 bar is unchanged');
  /* ONE reader: the three desks reach for the same name and no file grows a second parser */
  for (const f of ['goldscalp.js', 'goldswing.js', 'omnigold.js', 'omnigold1.js']){
    const src = read(f);
    assert((src.match(/hgGoldQuoteFromPerp/g) || []).length >= 1, f + ' asks the shared reader');
    /* comments stripped first: the hg-v968 comment names the two fields it fixed */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/mg, '');
    assert(!/best_bid|best_ask/.test(code), f + ' does not parse the ticker itself');
  }
}

console.log('== 2) OMNIGOLD: the real perp handler, lifted and run ==');
{
  const src = read('omnigold.js');
  const head = '.then(function(pair){\n            __og.perpNative = pair[0] || null;';
  const i = src.indexOf(head);
  assert(i > 0, 'the perp/FOMC pair handler is findable');
  const endMark = '          new Promise(function(r){ setTimeout(r, 8000); })';
  const j = src.indexOf(endMark, i);
  assert(j > i, 'and its end is findable');
  let body = src.slice(i, j);
  body = body.slice(body.indexOf('{', body.indexOf('function(pair)')) + 1);
  body = body.slice(0, body.lastIndexOf('}'));            /* drop the '}),' that closes function(pair) */
  assert(/hgGoldQuoteFromPerp/.test(body), 'it asks the shared reader');
  const W = boot(OG_FILES);
  function run(shared, gfnImpl, pair){
    const __og = {};
    const sb = { __og, shared, gfn: gfnImpl, isFinite, console: { log(){} }, Math, Number, String, Object, JSON };
    vm.createContext(sb);
    vm.runInContext('(function(pair){' + body + '})', sb, { filename: 'omnigold.js:pair' })(pair);
    return __og;
  }
  const perp = { ok: true, ticker: { bid: 4300.40, ask: 4301.00, spreadUsd: WIDE } };
  const shared = { quote: null, news: null };
  const og = run(shared, n => W[n], [perp, null]);
  assert(og.perpNative === perp, 'the perp payload itself still lands');
  assert(Math.abs(shared.spreadUsd - WIDE) < 1e-9, 'shared ctx CARRIES the spread (' + shared.spreadUsd + ')');
  assert(shared.bid === 4300.4 && shared.ask === 4301, 'and both sides');
  assert(shared.spreadVenue === 'delta-xaut', 'stamped with the venue it was measured on');
  /* a named broker quote on the global wins over the proxy */
  const broker = { bid: 4300.5, ask: 4300.6, spreadUsd: 0.1, venue: 'xm' };
  const shared2 = { quote: broker, bid: 4300.5, ask: 4300.6 };
  run(shared2, n => W[n], [perp, null]);
  assert(shared2.spreadUsd === undefined && shared2.bid === 4300.5 && shared2.spreadVenue === undefined,
         'a broker quote already on the global is NOT overwritten by the proxy');
  /* half quote: nothing */
  const shared3 = { quote: null };
  run(shared3, n => W[n], [{ ok: true, ticker: { bid: 4300.4 } }, null]);
  assert(shared3.spreadUsd === undefined && shared3.spreadVenue === undefined, 'a half quote leaves no spread');
  /* goldind absent: nothing, no throw */
  const shared4 = { quote: null };
  const og4 = run(shared4, () => null, [perp, null]);
  assert(shared4.spreadUsd === undefined && og4.perpNative === perp, 'goldind absent: reaches for nothing, throws nothing, perp still lands');
  /* no payload at all */
  const shared5 = { quote: null };
  run(shared5, n => W[n], [null, null]);
  assert(shared5.spreadUsd === undefined, 'no payload: no quote');
}

console.log('== 3) OMNIGOLD: driven through the real ledger ==');
{
  const W = boot(OG_FILES);
  assert(typeof W.hgGoldInstFilter === 'function' && typeof W.hgOgGates === 'function', 'goldind + omnigold booted');
  const rows = bars(80, 2400, 3600, 2);
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: 2400, why: 't' };
  const row = extra => (W.hgOgGates(rows, hit, Object.assign({ sessionHard: false, nowMs: NY }, extra)) || [])
                         .filter(g => g.key === 'inst-filter')[0];
  const base = row({});
  assert(base && base.pass === true, 'baseline: the filter passes this hit with no quote (not vacuous)');
  assert(!/SPREAD/.test(base.why), 'and says nothing about a spread it did not see');
  const proxy = row({ spreadUsd: WIDE, spreadVenue: 'delta-xaut' });
  assert(proxy.pass === true, 'a WIDE quote on the proxy venue does NOT veto');
  assert(/SPREAD WIDE/.test(proxy.why) && /delta-xaut/.test(proxy.why), 'but it is REPORTED on the row, naming the venue');
  assert(/not gated/.test(proxy.why), 'and says it is not gated');
  const broker = row({ spreadUsd: WIDE, spreadVenue: 'xm' });
  assert(broker.pass === false && /SPREAD LOCK/.test(broker.why), 'the same width on the broker venue still LOCKS -- the bar is unchanged');
  const unnamed = row({ spreadUsd: WIDE });
  assert(unnamed.pass === false && /SPREAD LOCK/.test(unnamed.why), 'a quote naming no venue behaves as before (locks)');
  const narrow = row({ spreadUsd: NARROW, spreadVenue: 'delta-xaut' });
  assert(narrow.pass === true && !/SPREAD/.test(narrow.why), 'a narrow proxy quote passes and says nothing');
  /* the whole ledger's other rows are untouched by the note */
  const all = W.hgOgGates(rows, hit, { sessionHard: false, nowMs: NY, spreadUsd: WIDE, spreadVenue: 'delta-xaut' });
  assert(all.filter(g => /SPREAD WIDE/.test(g.why)).length === 1, 'exactly one row carries the note');
  /* Deliberately TEXTUAL, and says so (hg-v956): the shared -> extra -> runEval
     seams live inside the scan closure and are not lifted here; whether the
     venue is carried across them is a property of the source. */
  {
    const og = read('omnigold.js');
    assert(/spreadVenue: shared\.spreadVenue \|\| null,/.test(og), 'the extra built per horizon carries shared.spreadVenue');
    assert(/extra\.spreadVenue = extra\.spreadVenue \|\| shared\.spreadVenue \|\| null;/.test(og), 'and runEval falls back to it');
  }
  /* the venue reaches the filter through the ctx, not through a global */
  const r = W.hgOgInstFilterHit(hit, rows, { sessionHard: false, nowMs: NY, spreadUsd: WIDE, spreadVenue: 'delta-xaut' });
  assert(r.spreadNote && /delta-xaut/.test(r.spreadNote), 'hgOgInstFilterHit returns the note it folds');
  assert(r.cand && r.cand.spreadLock && r.cand.spreadLock.advisory === true, 'and the candidate carries the advisory verdict');
  /* extra.quote.venue is honoured too (the global path, should anything ever write it) */
  const r2 = W.hgOgInstFilterHit(hit, rows, { sessionHard: false, nowMs: NY, quote: { bid: 4300, ask: 4300 + WIDE, venue: 'delta-xaut' } });
  assert(r2.dropped === false && r2.spreadNote, 'a venue on extra.quote is read as well');
}

console.log('== 4) the advisory lands on c.notes (GOLD SCALP and GOLD SWING both paint it) ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  const rows = bars(80, 2400, 900, 3);
  const mk = () => ({ dir: 'long', stratKey: 'vwap', why: 't', stamps: [], gateNotes: [] });
  const ctxOf = extra => Object.assign({ rows, nowMs: NY, scalp: false, hardReject: false }, extra);
  const a = W.hgGoldInstFilter(mk(), ctxOf({ spreadUsd: WIDE, spreadVenue: 'delta-xaut' }));
  assert(a && !a.dropped, 'proxy-wide: not dropped');
  assert(Array.isArray(a.notes) && a.notes.some(n => /SPREAD WIDE/.test(n) && /delta-xaut/.test(n)), 'the advisory is on c.notes');
  const b = W.hgGoldInstFilter(mk(), ctxOf({ spreadUsd: NARROW, spreadVenue: 'delta-xaut' }));
  assert(!b.dropped && !(b.notes || []).some(n => /SPREAD/.test(n)), 'narrow: no note');
  const c = W.hgGoldInstFilter(mk(), ctxOf({}));
  assert(!c.dropped && !(c.notes || []).some(n => /SPREAD/.test(n)), 'no quote: no note');
  const d = W.hgGoldInstFilter(mk(), ctxOf({ spreadUsd: WIDE, spreadVenue: 'xm' }));
  assert(d.dropped === true && /SPREAD LOCK/.test(d.reason), 'broker-wide still drops');
  /* the note is deduplicated when the filter runs twice on one candidate */
  const e = W.hgGoldInstFilter(a, ctxOf({ spreadUsd: WIDE, spreadVenue: 'delta-xaut' }));
  assert(e.notes.filter(n => /SPREAD WIDE/.test(n)).length === 1, 'running twice does not print it twice');
  /* both desks render c.notes */
  for (const f of ['goldscalp.js', 'goldswing.js']){
    assert(/c\.notes && c\.notes\.length/.test(read(f)), f + ' paints c.notes');
  }
}

console.log('== 5) OMNIGOLD 1: the real post-await block, lifted and run ==');
{
  const src = read('omnigold1.js');
  const i = src.indexOf('try{ var q = W.__hgGoldQuote;');
  assert(i > 0, 'the quote block is findable');
  const endMark = '}catch(eQP){}';
  const j = src.indexOf(endMark, i);
  assert(j > i, 'and its end');
  const block = src.slice(i, j + endMark.length);
  assert(/hgGoldQuoteFromPerp/.test(block), 'it asks the shared reader');
  const Wg = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  function run(Wstub, inp){
    const sb = { W: Wstub, inp, isFinite,
      has: x => x != null && x !== '' && typeof x !== 'boolean' && isFinite(+x),
      gfn: n => (typeof Wg[n] === 'function' ? Wg[n] : null), Math, Number, String, Object, JSON };
    vm.createContext(sb);
    vm.runInContext(block, sb, { filename: 'omnigold1.js:quote' });
    return inp;
  }
  const perp = { ok: true, ticker: { bid: 4300.40, ask: 4301.00, spreadUsd: WIDE } };
  const a = run({}, { perpNative: perp });
  assert(Math.abs(a.spreadUsd - WIDE) < 1e-9 && a.bid === 4300.4 && a.ask === 4301, 'inp carries the quote from the perp payload');
  assert(a.spreadVenue === 'delta-xaut', 'and the venue');
  const b = run({ __hgGoldQuote: { bid: 1, ask: 1.1, spreadUsd: 0.1 } }, { perpNative: perp });
  assert(Math.abs(b.spreadUsd - 0.1) < 1e-9 && b.spreadVenue === undefined, 'a quote on the global still wins');
  const c = run({}, { perpNative: { ok: true, ticker: { bid: 4300.4 } } });
  assert(c.spreadUsd === undefined, 'half quote: nothing');
  const d = run({}, {});
  assert(d.spreadUsd === undefined, 'no payload: nothing');

  /* the engine: the load line names the venue, and NO verdict moves */
  const W1 = boot(['gold-seven-step.js', 'omnigold1.js']);
  const H = 3600;
  function series(endMs, n, opts){
    opts = opts || {};
    const rows = [], endSec = Math.floor(endMs / 1000 / H) * H;
    let p = opts.start || 4400;
    for (let k = 0; k < n; k++){
      const t = endSec - (n - k) * H, drift = (opts.trend || 0) + Math.sin(k / 37) * 0.5;
      const o = p, cc = p + drift + ((k * 7) % 5 - 2) * 0.6;
      rows.push({ t, o, h: Math.max(o, cc) + 1.5 + (k % 4), l: Math.min(o, cc) - 1.5 - (k % 3), c: cc, v: 120 + (k % 9) * 15 });
      p = cc;
    }
    return rows;
  }
  const now = Date.UTC(2026, 8, 4, 14, 5);
  const rows = series(Date.UTC(2026, 8, 4, 0, 0), 420, { trend: 0.12, start: 4380 });
  const shift = 4495 - rows[rows.length - 1].c;
  for (const r of rows){ r.o += shift; r.h += shift; r.l += shift; r.c += shift; }
  const d0 = Math.floor(Date.UTC(2026, 8, 4, 0, 0) / 1000);
  for (let k = 0; k < 13; k++) rows.push({ t: d0 + k * H, o: 4494 + (k % 2), h: 4500 - (k % 2), l: 4490 + (k % 2) * 0.5, c: 4496 - (k % 3), v: 150 });
  rows.push({ t: d0 + 13 * H, o: 4494, h: 4497, l: 4486, c: 4493, v: 420 });
  const m15 = [];
  for (let k = 0; k < 200; k++){ const t = Math.floor(now / 1000 / 900) * 900 - (200 - k) * 900; m15.push({ t, o: 4493, h: 4495, l: 4491, c: 4493 + (k % 3) * 0.3, v: 40 }); }
  const base = { rows1h: rows, rows15m: m15, now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const r0 = W1.hgOg1Engine(base);
  const r1 = W1.hgOg1Engine(Object.assign({}, base, { bid: 4300.4, ask: 4301, spreadUsd: WIDE, spreadVenue: 'delta-xaut' }));
  assert(r0.ok && r1.ok, 'engine runs with and without the quote');
  const l0 = r0.sections.s0.load.find(l => /bid\/ask/.test(l.name));
  const l1 = r1.sections.s0.load.find(l => /bid\/ask/.test(l.name));
  assert(l0 && l0.state === 'unavailable' && /no quote/.test(l0.note), 'without it the load line reads no quote');
  assert(l1 && l1.state === 'partial' && /delta-xaut/.test(l1.note) && /gold proxy/.test(l1.note), 'with it the load line is PARTIAL and names the venue as a proxy');
  const v0 = r0.sections.s0.veto.find(v => v.n === 2), v1 = r1.sections.s0.veto.find(v => v.n === 2);
  assert(v0 && v1 && v0.state === v1.state && v1.state !== 'VETO', 'the spread veto needs a 20d average nothing supplies: state unchanged, not VETO');
  assert(r0.sections.s0.clear === r1.sections.s0.clear && r0.sections.s3.score === r1.sections.s3.score, 'NO verdict moves on OMNIGOLD 1');
}

console.log('== 6) still zero writers of the quote globals ==');
{
  const NAMES = ['__hgGoldQuote', '__hgGoldSpreadUsd', '__hgGoldL2Book'];
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  let reads = 0, writes = 0;
  for (const f of files){
    const src = read(f);
    for (const n of NAMES){
      reads += (src.match(new RegExp(n + '(?!\\s*=[^=])', 'g')) || []).length;
      writes += (src.match(new RegExp(n + '\\s*=[^=]', 'g')) || []).length;
    }
  }
  assert(reads > 0, 'the sweep sees the read sites (' + reads + ') -- not an empty sweep');
  assert(writes === 0, 'this pack adds NO writer of the globals -- the feed goes through the ctx');
}

console.log('== 7) build stamps ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
