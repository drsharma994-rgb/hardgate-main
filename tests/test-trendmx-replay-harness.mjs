/* HARDGATE — hg-v1160: TREND MATRIX gets a replay of its own, judged through
   the one factor-separation core, with the verdict literal generated from the
   artifact and honest about not having run.

   OMNIROUTE (v531), OMNIPRESENT and CRYPTO ULTRA each have a committed walk;
   TREND MATRIX had none, so every read the desk records (hg-v1159) could be
   asked only of the forward ledger, which is weeks deep at best. The harness
   (scripts/backtest-trendmx.mjs) walks the desk's OWN functions -- trendScore,
   tmDirOf, trendmxGateEval on the real cryptogates matrix, trendmxConviction,
   trendmxPlan, trendmxRowTier, tmRecordReads, trendmxPerfectState -- per
   closed 4h bar, fills and settles under the forward ledger's own rules (market
   at the next open, a resting entry within 6 bars or unfilled, stop-first on a
   both-touch bar, 20-bar horizon, one position per symbol and direction), and
   refuses to write a trade with no geometry. scripts/trendmx-factor-separation.mjs
   is a config over scripts/factor-sep-core.mjs whose factors are derived from
   the rows; its literal HG_TM_FACTOR_SEP in trendtable.combined.js reads
   measured:false today -- no bar can be fetched from the environment that wrote
   it (403 on every route) -- and the desk says so under its measured book
   instead of rendering an empty table.

   Sections:
     1) zero drift, fatal markers, the committed literal is honestly unmeasured
     2) the harness end to end on synthetic bars (injected fetch): the desk's own
        row, gate, plan, tier, reads and ticket ride every trade
     3) the fill and settle rules, on a hand-built tape
     4) the config: factors derived from the rows, three states as two factors,
        a measured literal splices in and the committed one splices back
     5) the tab: the unmeasured note, the delegated render, fail-open, read nowhere else
     6) one home: the parts are the combined file; scripts, ignore, the route
     7) build stamps

   Run: node tests/test-trendmx-replay-harness.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { boot, run as walkRun, scanSymbol, buildRow, candidateOf, walkCandidates, assertPriced, agg, resolveOut, STACK, HORIZON_BARS, TM_LIMIT_LIFE, ARTIFACT as WALK_ARTIFACT, SMOKE_ARTIFACT } from '../scripts/backtest-trendmx.mjs';
import { run, literal, splice, loadRows, factors, inventory, BEGIN, END, ARTIFACT, NOT_MEASURED_NOTE, WINDOWS, MIN_SIDE } from '../scripts/trendmx-factor-separation.mjs';
import { klinesRouteNote } from '../lib/klines-source.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond){ passed++; console.log('  ok —', label); } else { failed++; console.error('  FAIL —', label); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
const SEC4 = 14400, SEC1D = 86400;
const settledOf = (trades) => trades.filter(t => t.outcome === 'target' || t.outcome === 'stop' || t.outcome === 'timeout');

/* a seeded tape with slow sinusoidal drift and noise: trends form and turn */
function tape(n, step, endT, seed){
  let x = seed || 1; const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const rows = []; let c = 100; const t0 = endT - (n - 1) * step;
  for (let i = 0; i < n; i++){ const drift = 0.25 * Math.sin(i / 120) + 0.05; c = Math.max(5, c + drift + (rnd() - 0.5) * 1.2); rows.push({ t: t0 + i * step, o: c - (rnd() - 0.5) * 0.4, h: c + rnd() * 0.8, l: c - rnd() * 0.8, c, v: 1000 + rnd() * 300 }); }
  return rows;
}
const now = Math.floor(Date.now() / 1000);
const END4 = Math.floor(now / SEC4) * SEC4 - SEC4, END1 = Math.floor(now / SEC1D) * SEC1D - SEC1D;

console.log('1. zero drift, fatal markers, the committed literal is honestly unmeasured');
{
  const src = read('trendtable.combined.js');
  ok(src.indexOf(BEGIN) >= 0 && src.indexOf(END) > src.indexOf(BEGIN), 'trendtable.combined.js carries the BEGIN/END markers');
  const res = run();
  ok(splice(src, literal(res)) === src, 'HG_TM_FACTOR_SEP equals the generator output on the committed tree (zero drift)');
  ok(!fs.existsSync(ARTIFACT) && res.measured === false && res.n === 0 && res.rows.length === 0 && res.note === NOT_MEASURED_NOTE, 'no artifact is committed and the literal says NOT MEASURED with the note, an empty row set and no verdict');
  ok(/measured: false/.test(literal(res)) && /does not exist/.test(literal(res)) && !/verdict: "/.test(literal(res)), 'the committed literal reads measured:false and carries no verdict row');
  ok(Array.isArray(res.forwardOnly) && res.forwardOnly.join() === 'takerFlowWith,fundWith,postgate:veto', 'the three forward-only reads are named on the literal');
  let threw = null; try { splice('x', literal(res)); } catch (e) { threw = e; }
  ok(threw && /BEGIN marker not found in trendtable\.combined\.js/.test(threw.message), 'a missing marker is fatal and names the file');
  ok(res.windows === WINDOWS && WINDOWS === 4 && MIN_SIDE === 20, 'four disjoint windows, twenty a side — the core bars, not restated');
  ok(loadRows() === null, 'loadRows reads null (not an empty list) when the artifact does not exist — unmeasured is not zero');
}

console.log('\n2. the harness end to end on synthetic bars: the desk rides every trade');
let RES = null, W = null;
{
  W = boot();
  ok(typeof W.trendScore === 'function' && typeof W.tmValidSetup === 'function' && typeof W.tmRecordReads === 'function' && typeof W.trendmxRowTier === 'function', 'the walk boots the desk from the files index.html loads and the desk exports what the walk calls');
  const bars = { '4h': tape(520, SEC4, END4, 7), '1d': tape(400, SEC1D, END1, 11) };
  const fetched = [];
  RES = await walkRun({ W, symbols: ['AAAUSDT', 'BBBUSDT'], bars: 520, fetchRows: async (sym, tf) => { fetched.push(sym + ':' + tf); return bars[tf]; }, log: () => {}, route: 'injected' });
  const T = RES.trades, S = settledOf(T);
  ok(fetched.length === 4 && RES.meta.route === 'injected' && RES.meta.horizonBars === HORIZON_BARS && HORIZON_BARS === 20, 'both timeframes are fetched per symbol through the injected fetch; the horizon is the desk\'s own 20 bars');
  ok(RES.meta.candidates > 50 && S.length > 10, 'the tape forms candidates and the walk settles positions (' + RES.meta.candidates + ' candidates, ' + S.length + ' settled)');
  ok(T.every(t => t.outcome === 'unfilled' || (isFinite(t.entry) && isFinite(t.stop) && isFinite(t.t1) && Math.abs(t.entry - t.stop) > 0 && isFinite(t.netR) && isFinite(t.rMultiple))), 'every settled trade carries finite geometry and a finite R');
  ok(assertPriced(T) === 0 && RES.meta.unpriced === 0, 'the refusal passes on a priced walk');
  ok(T.every(t => t.reads && typeof t.reads === 'object' && ['tm:d1Trend', 'tm:cross', 'tm:cascade', 'tm:cloud', 'tm:adx'].some(k => k in t.reads)), 'every trade carries the hg-v1159 reads bag with at least one composite leg');
  ok(T.every(t => !('takerFlowWith' in t.reads) && !('fundWith' in t.reads) && !('postgate:veto' in t.reads)), 'the three forward-only reads are ABSENT on every replay row — never guessed');
  ok(T.every(t => t.ticket === (t.tier === 'clean')) && T.every(t => t.mechanic === (t.isClean ? 'TM-CLEAN7' : 'TM-CONVICTION')), 'the ticket claim is the board tier and the mechanic splits on clean7, as the live record does');
  ok(T.every(t => !t.heldBy || (t.heldBy === 'mom' && t.reads.momWith === false) || (t.heldBy === 'vol' && t.reads.volWith === false) || (t.heldBy === 'chop' && t.reads.trendQualityWith === false)), 'a held-off row names the witness and that witness mark reads false');
  ok(T.every(t => Math.abs(t.score) >= 2 && (t.dir === 'long') === (t.score > 0)), 'every trade is a majority row and its direction is the composite\'s sign');
  /* one position per symbol and direction: no trade opens before the previous one in its lane exits */
  let overlap = 0;
  for (const lane of ['AAAUSDT:long', 'AAAUSDT:short', 'BBBUSDT:long', 'BBBUSDT:short']){
    const L = S.filter(t => t.sym + ':' + t.dir === lane).sort((a, b) => a.barT - b.barT);
    for (let i = 1; i < L.length; i++){ const prevExit = L[i - 1].barT + (L[i - 1].fillBars + L[i - 1].exitBars) * SEC4; if (L[i].barT < prevExit) overlap++; }
  }
  ok(overlap === 0 && RES.meta.merged > 0 && RES.meta.fired === RES.meta.merged + T.length, 'one open position per symbol and direction: re-forms while open are merged, and fired = merged + positions');
  ok(RES.meta.limitations.length === 5 && RES.meta.forwardOnlyReads.join() === 'takerFlowWith,fundWith,postgate:veto' && RES.aggregates.all.n === S.length, 'the meta names the five limitations and the forward-only reads; the aggregate counts the settled rows');
  ok(T.every(t => t.outcome === 'unfilled' || typeof t.fillSlipR === 'number'), 'the gap between the plan entry and the fill rides every filled trade (fillSlipR)');
  ok(T.every(t => t.outcome === 'unfilled' || Math.abs(t.costR - (t.entry * 0.002) / Math.abs(t.entry - t.stop)) < 1e-12), 'cost is 0.20% round trip in PLAN-risk units');
}

console.log('\n2b. the candidate map on crafted rows: a CLEAN row tickets, a witness-held CLEAN row does not, an invalid plan is the desk\'s own skip');
{
  const bars4 = tape(520, SEC4, END4, 7), bars1 = tape(400, SEC1D, END1, 11);
  const row = (() => { for (let i = bars4.length - 2; i >= 300; i--){ const r = buildRow(W, 'AAAUSDT', bars4, bars1, i); if (r && W.tmDirOf(r)) return r; } return null; })();
  ok(row && W.tmDirOf(row), 'the tape yields a majority row to craft on');
  const dir = W.tmDirOf(row);
  const savedClean = W.swingTryClean, savedPlan = W.trendmxPlan;
  W.swingTryClean = (rows, ticker) => { const c = rows[rows.length - 1].c; return dir === 'long'
    ? { dir, entry: c, stop: c * 0.97, t1: c * 1.06, t2: c * 1.09, rr: 2, clean: true, passed: 7, mark: c }
    : { dir, entry: c, stop: c * 1.03, t1: c * 0.94, t2: c * 0.91, rr: 2, clean: true, passed: 7, mark: c }; };
  const r1 = Object.assign({}, row, { rsi: dir === 'long' ? 55 : 45, volDiv: null, volConf: null });
  const c1 = candidateOf(W, r1);
  ok(!c1.skip && c1.isClean === true && c1.mechanic === 'TM-CLEAN7' && c1.gatesPassed === 7 && c1.tier === 'clean' && c1.ticket === true && c1.heldBy === null, 'a 7/7 CLEAN row with every witness quiet is a TM-CLEAN7 candidate whose ticket claim is true');
  const r2 = Object.assign({}, row, { rsi: dir === 'long' ? 30 : 70, volDiv: null, volConf: null });
  const c2 = candidateOf(W, r2);
  ok(!c2.skip && c2.isClean === true && c2.tier === 'near' && c2.ticket === false && c2.heldBy === 'mom' && c2.reads.momWith === false, 'the same CLEAN row with the momentum witness against is held: isClean stays true, the tier is NEAR, the ticket claim is false, heldBy names the witness and the mark reads false');
  const r3 = Object.assign({}, row, { rsi: dir === 'long' ? 55 : 45, volDiv: dir === 'long' ? 'bear' : 'bull', volConf: null });
  const c3 = candidateOf(W, r3);
  ok(!c3.skip && c3.heldBy === 'vol' && c3.ticket === false && c3.reads.volWith === false, 'the volume witness against names itself the same way');
  W.trendmxPlan = () => ({ dir, entry: 100, stop: NaN, t1: 104 });
  const c4 = candidateOf(W, r1);
  ok(c4.skip === 'noPlan', 'a plan the desk\'s own validity rule refuses (a NaN stop) is the desk\'s skip, counted as noPlan — never a trade');
  W.swingTryClean = savedClean; W.trendmxPlan = savedPlan;
}

console.log('\n3. the fill and settle rules on a hand-built tape');
{
  const flat = (n) => { const r = []; for (let i = 0; i < n; i++) r.push({ t: 1e9 + i * SEC4, o: 100, h: 100.4, l: 99.6, c: 100, v: 1 }); return r; };
  const cand = (i, extra) => Object.assign({ i, sym: 'X', dir: 'long', entry: 100, stop: 98, t1: 104, entryType: 'MARKET', reads: {}, tISO: 'x', barT: 1e9 + i * SEC4, isClean: false, tier: 'forming', ticket: false }, extra);
  /* a MARKET plan fills at the next open (with its gap) and the target is read off the fill in plan-risk units */
  let h4 = flat(40); h4[6].o = 100.2; h4[8].h = 104.5;
  let w = walkCandidates([cand(5)], h4);
  let t = w.trades[0];
  ok(t && t.outcome === 'target' && t.fillBars === 1 && Math.abs(t.fillSlipR - 0.1) < 1e-9 && Math.abs(t.rMultiple - 1.9) < 1e-9 && Math.abs(t.netR - (1.9 - 100 * 0.002 / 2)) < 1e-9, 'MARKET: fills at the next open 0.1R above the plan, hits the target at +1.9R, net of 0.1R cost in plan-risk units');
  /* a LIMIT plan fills when the tape trades through it; never touched within 6 bars it is UNFILLED and excluded */
  h4 = flat(40); h4[9].l = 98.9; h4[12].h = 104.5;
  w = walkCandidates([cand(5, { entry: 99, stop: 97, entryType: 'LIMIT' })], h4); t = w.trades[0];
  ok(t && t.outcome === 'target' && t.fillBars === 4 && t.fillPx === 99 && t.fillSlipR === 0 && Math.abs(t.rMultiple - 2.5) < 1e-9, 'LIMIT: fills at the level when the tape trades through it, R off that fill');
  h4 = flat(40);
  w = walkCandidates([cand(5, { entry: 99, stop: 97, entryType: 'LIMIT' })], h4); t = w.trades[0];
  ok(t && t.outcome === 'unfilled' && w.counters.unfilled === 1 && TM_LIMIT_LIFE === 6 && settledOf(w.trades).length === 0 && agg(w.trades).n === 0, 'LIMIT never touched within the desk\'s 6-bar life is UNFILLED, counted and excluded from every aggregate');
  /* both-touch settles as the stop (lower bound) and is flagged */
  h4 = flat(40); h4[7].l = 97; h4[7].h = 105;
  w = walkCandidates([cand(5)], h4); t = w.trades[0];
  ok(t && t.outcome === 'stop' && t.bothTouch === true && Math.abs(t.rMultiple - (-1)) < 1e-9, 'a bar that touches both levels settles as the stop, flagged bothTouch');
  /* the horizon: 20 bars after the fill with neither level touched is a timeout at the close */
  h4 = flat(60); h4[26].c = 101;
  w = walkCandidates([cand(5)], h4); t = w.trades[0];
  ok(t && t.outcome === 'timeout' && t.exitBars === 20 && Math.abs(t.rMultiple - 0.5) < 1e-9, 'twenty bars after the fill the trade settles at the close as a timeout (+0.5R here)');
  /* one position per lane: a second candidate while the first is open is merged, a different direction is not */
  h4 = flat(60);
  w = walkCandidates([cand(5), cand(7), cand(8, { dir: 'short', entry: 100, stop: 102, t1: 96 })], h4);
  ok(w.counters.fired === 3 && w.counters.merged === 1 && w.trades.length === 2 && w.trades.some(x => x.dir === 'short'), 'a re-form in an open lane is merged; the other direction opens its own position');
  /* a plan with no risk is unpriced and the refusal is fatal */
  h4 = flat(40);
  w = walkCandidates([cand(5, { stop: 100 })], h4);
  let threw = null; try { assertPriced(w.trades); } catch (e) { threw = e; }
  ok(w.counters.unpriced === 1 && threw && /no usable geometry/.test(threw.message), 'a plan whose stop equals its entry is unpriced and assertPriced refuses, naming the defect');
  ok(assertPriced([{ outcome: 'unfilled' }]) === 0, 'an unfilled row is not a geometry defect');
}

console.log('\n4. the config: factors derived from the rows, three states as two factors');
{
  const S = settledOf(RES.trades);
  const inv = inventory(S);
  ok(inv.reads.length >= 6 && inv.reads.indexOf('tm:cascade') >= 0 && inv.reads.indexOf('takerFlowWith') < 0, 'the read inventory is derived from the rows (' + inv.reads.length + ' keys) and carries no forward-only read');
  const F = factors(S).factors;
  const keys = F.map(f => f.key);
  ok(inv.reads.every(k => keys.indexOf('read:' + k + '=with') >= 0 && keys.indexOf('read:' + k + '=against') >= 0), 'every read is two factors: WITH against the rest and AGAINST against the rest');
  const withF = F.find(f => f.key === 'read:momWith=with'), agF = F.find(f => f.key === 'read:momWith=against');
  ok(withF && agF && withF.pick({ reads: { momWith: true } }) && !withF.pick({ reads: { momWith: false } }) && !withF.pick({ reads: {} }) && agF.pick({ reads: { momWith: false } }) && !agF.pick({ reads: {} }), 'absent is in neither cohort — the third state is never a guessed false');
  ok(['pop:clean7', 'pop:ticket', 'pop:held', 'pop:perfect', 'pop:score5', 'pop:gates6', 'pop:long', 'pop:strong', 'geom:limit', 'geom:stopLt1', 'geom:stopGe2', 'geom:bothTouch'].every(k => keys.indexOf(k) >= 0), 'the population and geometry factors are present');
  const R = run(S);
  ok(R.measured === true && R.n === S.length && R.tab === 'TRENDMX' && Array.isArray(R.rows) && R.rows.length === F.length && /both-touch/.test(R.bound), 'on walked rows the result is measured, judged through the core, and names the bound');
  const src = read('trendtable.combined.js');
  const lit2 = literal(R);
  ok(/measured: true/.test(lit2) && splice(src, lit2) !== src && splice(splice(src, lit2), literal(run(null))) === src, 'a measured literal splices in and the committed unmeasured literal splices back byte for byte');
  /* a synthetic artifact: loadRows keeps settled rows only */
  const tmp = path.join(ROOT, 'scripts', '.tm-guard-artifact.json');
  const unfilledRow = { sym: 'ZZZUSDT', dir: 'long', tISO: '2026-01-01T00:00:00.000Z', outcome: 'unfilled', entry: 1, stop: 0.9, t1: 1.2, reads: {} };
  fs.writeFileSync(tmp, JSON.stringify({ trades: RES.trades.concat([unfilledRow]) }));
  try { const L = loadRows(tmp); ok(L.length === S.length && L.every(r => r.outcome !== 'unfilled'), 'loadRows keeps the settled rows and drops an unfilled one (the walk\'s own exclusion, read again at the judge)'); } finally { fs.unlinkSync(tmp); }
  ok(inventory([{ reads: { a: true, b: 'yes', c: null, d: 1, e: false } }, { reads: null }, {}]).reads.join() === 'a,e', 'the inventory counts only the two booleans — a string, a null or a number in a reads bag is not a mark');
}

console.log('\n5. the tab: the unmeasured note, the delegated render, fail-open, read nowhere else');
{
  const T = W.HG_TM_FACTOR_SEP;
  ok(T && T.measured === false && typeof W.tmFactorSepHtml === 'function', 'the tab exports the generated literal and the panel');
  const h = W.tmFactorSepHtml();
  ok(/NOT YET MEASURED/.test(h) && /does not exist/.test(h) && /takerFlowWith, fundWith, postgate:veto/.test(h) && /data-tm-replay="unmeasured"/.test(h), 'unmeasured: the panel says the walk has not run and names the forward-only reads, in place of an empty table');
  /* a measured literal with the renderer present delegates; without it renders nothing */
  const S = settledOf(RES.trades); const R = run(S);
  let got = null; W.hgOmniFactorSepHtml = (X) => { got = X; return '<i>sep</i>'; };
  ok(W.tmFactorSepHtml(R) === '<i>sep</i>' && got && got.measured === true && got.n === S.length, 'measured: the panel delegates to OMNIROUTE\'s one renderer with the literal (handed in on the renderer\'s own seam)');
  ok(/NOT YET MEASURED/.test(W.tmFactorSepHtml()) && got.n === S.length, 'with no literal handed in the panel still reads the committed one');
  delete W.hgOmniFactorSepHtml;
  ok(W.tmFactorSepHtml(R) === '', 'measured with the renderer absent renders nothing rather than a second renderer');
  const src = strip(read('trendtable.combined.js'));
  const paint = src.slice(src.indexOf('function trendmxPaintFwd('), src.indexOf('function trendmxPaintFwd(') + 900);
  ok((paint.match(/\+ tmFactorSepHtml\(\)/g) || []).length === 2, 'the panel rides under the measured book on both paint branches (textual: the paint reads refs the harness does not build)');
  ok((src.match(/HG_TM_FACTOR_SEP/g) || []).length === 4, 'the literal is declared once, read by the panel, exported (both sides of the assignment) — and read by nothing else in the desk');
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && !/^trendtable-src-\d+\.js$/.test(f) && f !== 'trendtable.combined.js' && f !== 'build-stamp.js');
  ok(files.filter(f => /HG_TM_FACTOR_SEP|tmFactorSepHtml/.test(strip(read(f)))).length === 0, 'no other module names the literal or the panel');
  ok(!/HG_TM_FACTOR_SEP/.test(strip(read('hg-gates.js'))) && !/HG_TM_FACTOR_SEP/.test(strip(read('cryptogates.js'))), 'no gate module reads the replay literal — a verdict here is a measurement, not a gate');
}

console.log('\n6. one home: the parts are the combined file; scripts, ignore, the route');
{
  if (process.env.HG_MUT_PARTS_SKIP === '1'){ ok(true, 'parts check skipped under the mutation pass (it edits the combined file alone)'); }
  else {
    const combined = read('trendtable.combined.js').split('\n').filter(l => l.trim() !== '').join('\n');
    let joined = '';
    for (let i = 0; i < 12; i++) joined += read('trendtable-src-' + i + '.js') + '\n';
    ok(joined.split('\n').filter(l => l.trim() !== '').join('\n') === combined, 'the twelve trendtable-src-N.js parts the server serves ARE the combined file');
  }
  const pkg = read('package.json');
  ok(/"tm:replay": "node scripts\/backtest-trendmx\.mjs"/.test(pkg) && /"tm:factor-sep": "node scripts\/trendmx-factor-separation\.mjs"/.test(pkg), 'npm run tm:replay walks, npm run tm:factor-sep is the drift check');
  ok(/scripts\/\.bt-cache\//.test(read('.gitignore')), 'the bar cache the walk writes is ignored');
  ok(/backtest-trendmx-results\.json$/.test(WALK_ARTIFACT) && WALK_ARTIFACT === ARTIFACT && /smoke-results\.json$/.test(SMOKE_ARTIFACT), 'the walk writes the artifact the config reads, and a smoke run writes its own');
  let bad = null; try { resolveOut('../x.json', false); } catch (e) { bad = e; }
  let bad2 = null; try { resolveOut('scripts/backtest-trendmx-results.json', true); } catch (e) { bad2 = e; }
  ok(bad && /inside scripts/.test(bad.message) && bad2 && /smoke run may not overwrite/.test(bad2.message) && resolveOut(null, true) === SMOKE_ARTIFACT, 'the artifact lands in scripts/ and a smoke run never overwrites the full artifact');
  ok(/klines route: https:\/\/mirror\.example/.test(klinesRouteNote({ HG_KLINES_BASE: 'https://mirror.example' })), 'the walk fetches through lib/klines-source.mjs, so a geo-blocked host is one env var away');
  const hs = strip(read('scripts/backtest-trendmx.mjs'));
  ok(/assertPriced\(all\);/.test(hs) && /const isMain = /.test(hs) && hs.indexOf('assertPriced(all);') < hs.indexOf('writeFileSync(out'), 'the walk refuses before it writes (textual: main is gated behind isMain)');
  let dark = null; try { await walkRun({ W, symbols: ['AAAUSDT'], bars: 300, fetchRows: async () => { throw new Error('HTTP 403'); }, log: () => {}, route: 'blocked' }); } catch (e) { dark = e; }
  ok(dark && /no symbol yielded bars/.test(dark.message) && /blocked/.test(dark.message), 'a walk that fetched no bars refuses to write (the environment that wrote this pack: 403 on every route) rather than leaving an empty artifact that reads as a measured empty book');
  ok(STACK.indexOf('cryptogates.js') >= 0 && STACK.indexOf('trendtable.combined.js') === STACK.length - 1, 'the walk boots the real gate matrix and the combined desk file');
}

console.log('\n7. build stamps');
ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp');

console.log('\n' + (failed ? 'FAILED ' + failed + ' / ' : 'PASSED ') + (passed + failed) + ' assertions');
process.exit(failed ? 1 : 0);
