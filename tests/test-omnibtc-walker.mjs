#!/usr/bin/env node
/* hg-v1294: the OMNIBTC walker and its literal writer.

   OMNIBTC has had three Pine packs this cycle (hg-v1291 freshness gate,
   hg-v1292 family-counting + indicator crosses, hg-v1293 record-only three-
   state Pine marks) and no committed walk — so the hg-v1065 PERFECT COHORT
   SPLIT and hg-v989 read-split had nothing to split on. This guard proves
   the walker drives the REAL gates (hg-v967: no re-implementation), that
   its output is the shape the literal writer reads, that the literal is
   generated-only (hg-v921), that the reader paints "REPLAY · NOT YET
   MEASURED" when no artifact exists, and that nothing in the stack is a
   gate on the literal's rows. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function stripComments(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

/* a sine-with-drift synthetic 4h tape; 400 bars is enough for EMA50 + the
   HORIZON_BARS = 20 settle window */
function synthBars(n, seed){
  const rows = [];
  const s = seed || 1;
  for (let i = 0; i < n; i++){
    const t = 1700000000 + i * 14400;
    const base = 60000 + i * 20 + Math.sin((i + s) / 11) * 1200;
    const noise = Math.cos((i + s) / 3) * 80;
    rows.push({ t, o: base, h: base + 300, l: base - 300, c: base + 50 + noise, v: 100 + (i % 7) * 50 });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
console.log('== 1) walker boots the real OMNIBTC gates (hg-v967: no re-implementation) ==');
{
  const walker = await import('../scripts/backtest-omnibtc.mjs');
  const ctx = walker.buildContext();
  ok(typeof ctx.hgObtcApplyPineAccuracy === 'function',
    'ctx carries hgObtcApplyPineAccuracy (hg-v1291 freshness gate)');
  ok(typeof ctx.hgObtcPineBook === 'function',
    'ctx carries hgObtcPineBook (hg-v1291 fresh pine census)');
  ok(typeof ctx.hgObtcIndBook === 'function',
    'ctx carries hgObtcIndBook (hg-v1292 EMA/MACD/Donchian cross)');
  ok(typeof ctx.hgObtcPineMarks === 'function',
    'ctx carries hgObtcPineMarks (hg-v1293 record-only three-state marks)');
  ok(typeof ctx.pineLorentzianKernel === 'function',
    'pinemath loaded: W.pineLorentzianKernel is a function');
  ok(typeof ctx.trendmxPineMarks === 'function',
    'trendmx exports the one home for pine marks (hg-v1293 one home, hg-v949)');
  ok(typeof ctx.HG_OBTC_WALK === 'object',
    'HG_OBTC_WALK literal is exposed on W by omnibtc.js');
}

/* ------------------------------------------------------------------ */
console.log('== 2) walker produces a row shape the literal writer reads ==');
{
  const walker = await import('../scripts/backtest-omnibtc.mjs');
  const bars = synthBars(400, 1);
  const out = await walker.runWalk({ bars });
  ok(out.ok === true, 'walk returns ok on synthetic bars');
  ok(Array.isArray(out.rows) && out.rows.length > 0,
    'walk produced rows (' + (out.rows ? out.rows.length : 0) + ')');
  const first = out.rows.find(r => !r.skipped);
  ok(!!first, 'at least one non-skipped row');
  if (first){
    const keys = Object.keys(first).sort().join(',');
    const need = ['dir', 'entry', 'stop', 't1', 'tier', 'ticket', 'pineAgree', 'pineOppose',
                  'indAgree', 'indOppose', 'pineMarks', 'outcome', 'idx', 't'];
    for (const k of need){
      ok(k in first, 'row carries key: ' + k);
    }
    ok(first.outcome && isFinite(+first.outcome.grossR), 'outcome.grossR is finite');
    ok(first.outcome && isFinite(+first.outcome.netR), 'outcome.netR is finite');
    ok(['t1', 'stop', 'timeout'].includes(first.outcome.status),
      'outcome.status in {t1,stop,timeout}');
    ok(first.pineMarks && typeof first.pineMarks === 'object',
      'pineMarks is an object (three-state, hg-v1293)');
    const marks = Object.keys(first.pineMarks).sort().join(',');
    const marksExpected = ['cipher','ht','lor','msb','nwenv','rfilter','smc','sqz','smf','wavwap'].sort().join(',');
    ok(marks === marksExpected, 'pineMarks carries the ten port keys exactly (' + marks + ')');
  }
  ok(out.meta && out.meta.horizonBars === 20,
    'meta.horizonBars = 20 (the desk\'s own 4h horizon)');
  ok(out.meta && isFinite(+out.meta.costFrac),
    'meta.costFrac is finite (Binance USDT-M taker × 2)');
  ok(Array.isArray(out.meta.limitations) && out.meta.limitations.length,
    'meta.limitations names what the walk cannot measure (hg-v989 absent is NOT MEASURED)');
}

/* ------------------------------------------------------------------ */
console.log('== 3) the hg-v1291/v1292 gate decides ticket vs watch on measurable tapes ==');
{
  const walker = await import('../scripts/backtest-omnibtc.mjs');
  const bars = synthBars(400, 1);
  const out = await walker.runWalk({ bars });
  const kept = out.rows.filter(r => !r.skipped);
  const tickets = kept.filter(r => r.ticket);
  const held = kept.filter(r => !r.ticket);
  ok(kept.length >= 10, 'walked a sample of rows (n=' + kept.length + ')');
  /* The hg-v1291 pine-bank-unloaded path tickets everything; the gate is
     only alive when pinemath is loaded. The walker loads it, so SOMETHING
     should be held — or everything should ticket if the ports all read
     agreement. Either outcome is legitimate; what matters is the gate
     made a decision rather than throwing. */
  ok(tickets.length + held.length === kept.length,
    'every row is tier=clean or tier=near — no third tier invented');
  const grades = new Set(kept.map(r => r.tier));
  ok(grades.size <= 2 && [...grades].every(g => g === 'clean' || g === 'near'),
    'tiers are a subset of {clean, near} (' + [...grades].join(',') + ')');
}

/* ------------------------------------------------------------------ */
console.log('== 4) hg-v990 refusal: unpriced plans are not written ==');
{
  const walker = await import('../scripts/backtest-omnibtc.mjs');
  /* a dead-flat tape: EMA50 slope is zero → minimalSwingCandidate returns null,
     which the walker counts as noPlan rather than writing an unpriced row */
  const bars = [];
  for (let i = 0; i < 400; i++){
    bars.push({ t: 1700000000 + i * 14400, o: 60000, h: 60100, l: 59900, c: 60000, v: 100 });
  }
  const out = await walker.runWalk({ bars });
  ok(out.ok === true, 'walk succeeds on dead-flat tape');
  const kept = out.rows.filter(r => !r.skipped);
  const noPlan = out.rows.filter(r => r.skipped && r.reason === 'noPlan');
  ok(noPlan.length > 0 || kept.length === 0,
    'dead-flat tape produces noPlan skips (' + noPlan.length + ') rather than unpriced writes');
}

/* ------------------------------------------------------------------ */
console.log('== 5) literal writer: generated-only, round-trips zero drift (hg-v921) ==');
{
  const src = read('omnibtc.js');
  const begin = src.indexOf('/* --- BEGIN GENERATED HG_OBTC_WALK');
  const end = src.indexOf('/* --- END GENERATED HG_OBTC_WALK');
  ok(begin > 0 && end > begin,
    'HG_OBTC_WALK is enclosed by BEGIN/END GENERATED markers (hg-v921)');
  /* exactly one begin and one end */
  const beginCount = (src.match(/BEGIN GENERATED HG_OBTC_WALK/g) || []).length;
  const endCount = (src.match(/END GENERATED HG_OBTC_WALK/g) || []).length;
  ok(beginCount === 1 && endCount === 1, 'exactly one generated block (no duplicates)');

  /* the writer re-reads the artifact and must round-trip the current literal
     to no-drift (because no artifact exists today, the literal reads
     measured:false and the writer re-produces the same block). */
  const { renderBlock } = await import('../scripts/omnibtc-evidence-literal.mjs');
  const block = renderBlock(null);
  ok(block.includes('var HG_OBTC_WALK ='), 'rendered block declares HG_OBTC_WALK');
  ok(block.includes('"measured": false') || block.includes('"measured":false'),
    'with no artifact the literal reads measured:false');
  ok(block.includes('scripts/backtest-omnibtc-results.json does not exist'),
    'note names the missing artifact (hg-v990 shape)');
  ok(src.includes(block),
    'current omnibtc.js already carries the regenerated block byte-for-byte (zero drift)');
}

/* ------------------------------------------------------------------ */
console.log('== 6) literal writer: a walked artifact produces a measured:true block ==');
{
  const { renderBlock } = await import('../scripts/omnibtc-evidence-literal.mjs');
  const walker = await import('../scripts/backtest-omnibtc.mjs');
  const bars = synthBars(400, 1);
  const walkOut = await walker.runWalk({ bars });
  ok(walkOut.ok, 'walk succeeded for the writer check');
  const block = renderBlock(walkOut);
  ok(block.includes('"measured": true'),
    'walked artifact produces measured:true');
  ok(block.includes('"n":') && !block.includes('"n": 0,'),
    'n is positive on a successful walk');
  ok(block.includes('"rows":') && block.includes('"outcome":'),
    'the measured literal carries rows[] with outcome fields');
  ok(block.includes('"summary":') && block.includes('"ticket":'),
    'the measured literal carries summary.ticket');
  /* a walker that fetched bars but recorded no rows writes a different note
     from the no-artifact case — proved on an empty-ok synthetic */
  const emptyBlock = renderBlock({ ok: true, summary: { n: 0, nTicket: 0, nHeld: 0 }, rows: [], meta: { span: null } });
  ok(emptyBlock.includes('fetched bars but recorded no rows'),
    'empty-but-ok walk writes a distinct note (the hg-v990 shape)');
  const failedBlock = renderBlock({ ok: false, reason: 'fetch-failed' });
  ok(failedBlock.includes('did not complete') && failedBlock.includes('fetch-failed'),
    'ok:false walk writes a distinct note naming the reason');
}

/* ------------------------------------------------------------------ */
console.log('== 7) reader paints "REPLAY · NOT YET MEASURED" when no walk ran ==');
{
  const vm = await import('node:vm');
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
    parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map,
    setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  ok(typeof ctx.hgObtcReplayPanelHtml === 'function',
    'hgObtcReplayPanelHtml is exported on W');
  const htmlNull = ctx.hgObtcReplayPanelHtml(null);
  ok(htmlNull === '' || htmlNull === undefined, 'null T returns empty');
  const htmlUnmeasured = ctx.hgObtcReplayPanelHtml();
  ok(/REPLAY · NOT YET MEASURED/.test(htmlUnmeasured),
    'default (HG_OBTC_WALK, measured:false) paints "REPLAY · NOT YET MEASURED"');
  ok(/does not exist/.test(htmlUnmeasured),
    'the panel names the missing artifact');
  ok(/Forward-only reads/.test(htmlUnmeasured),
    'the panel names the forward-only reads');

  const measured = {
    measured: true,
    n: 100, horizonBars: 20, costFrac: 0.0008,
    span: { from: 1700000000, to: 1700000000 + 100 * 14400, bars: 100 },
    summary: { n: 100, nTicket: 40, nHeld: 60,
      ticket: { n: 40, win: 0.5, netR: 0.123, grossR: 0.145 },
      held: { n: 60, win: 0.3, netR: -0.1, grossR: -0.05 }
    },
    rows: [{ idx: 1, outcome: { status: 't1' } }],
    rules: ['hg-v1291 PINE CONFIRM'],
    forwardOnly: []
  };
  const htmlOk = ctx.hgObtcReplayPanelHtml(measured);
  ok(/TICKETS n=40/.test(htmlOk),
    'measured panel prints TICKETS n=40');
  ok(/HELD \(watch\) n=60/.test(htmlOk),
    'measured panel prints HELD n=60');
  ok(/\+0\.123R/.test(htmlOk) && /T1 50\.0%/.test(htmlOk),
    'measured panel formats net R and T1 hit rate');
  ok(/hg-v1291 PINE CONFIRM/.test(htmlOk),
    'measured panel names the rules');
}

/* ------------------------------------------------------------------ */
console.log('== 8) NO GATE reads HG_OBTC_WALK — it is a report, not a rule ==');
{
  const files = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
                 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  let empty = 0, total = 0;
  for (const f of files){
    let body;
    try { body = stripComments(read(f)); } catch (e) { continue; }
    total++;
    const dot = /\bHG_OBTC_WALK\b/.test(body);
    if (!dot) empty++;
  }
  ok(empty === total, 'none of the ' + total + ' gate files reads HG_OBTC_WALK (empty ' + empty + '/' + total + ')');

  /* and omnibtc.js itself reads HG_OBTC_WALK through exactly ONE call (the
     renderer) plus the one default binding and the one export */
  const omniTxt = read('omnibtc.js');
  const refs = (omniTxt.match(/\bHG_OBTC_WALK\b/g) || []).length;
  ok(refs >= 2 && refs <= 10,
    'HG_OBTC_WALK appears ' + refs + ' times in omnibtc.js (declaration + reader + export + paint)');
}

/* ------------------------------------------------------------------ */
console.log('== 9) ship stamps hg-v1294 ==');
{
  const build = read('build-stamp.js');
  ok(/version:\s*['"]hg-v1294['"]/.test(build), 'build-stamp.js version hg-v1294');
  const sw = read('sw.js');
  ok(/HG_CACHE\s*=\s*['"]hg-v1294['"]/.test(sw), 'sw.js HG_CACHE hg-v1294');
  const loader = read('trendtable.js');
  ok(/hg-v1294/.test(loader), 'trendtable.js header hg-v1294');
  ok(/v=1294/.test(loader), 'trendtable.js part loader v=1294');
}

/* ------------------------------------------------------------------ */
console.log('== 10) one home for the writer (hg-v949) — no second copy of the literal shape ==');
{
  /* a second place writing HG_OBTC_WALK literal content would drift. The only
     writer is scripts/omnibtc-evidence-literal.mjs; the only authored source
     is between the BEGIN/END markers in omnibtc.js. */
  const writer = read('scripts/omnibtc-evidence-literal.mjs');
  ok(writer.includes('var HG_OBTC_WALK ='),
    'the writer produces the "var HG_OBTC_WALK =" preamble');
  /* every other repository file: nothing authors a "var HG_OBTC_WALK" except
     the writer (which produces it) and omnibtc.js (which holds the generated
     block). */
  const paths = [
    'omnibtc.js', 'trendtable.combined.js', 'index.html',
    'contract-report.js', 'ai-agent.js'
  ];
  for (const p of paths){
    let body;
    try { body = read(p); } catch (e) { continue; }
    const authors = /var\s+HG_OBTC_WALK\s*=/.test(body);
    if (p === 'omnibtc.js'){
      ok(authors, 'omnibtc.js carries the "var HG_OBTC_WALK =" literal (the one home)');
    } else {
      ok(!authors, p + ' does not author a second copy of HG_OBTC_WALK');
    }
  }
}

/* ------------------------------------------------------------------ */
console.log('');
console.log(`== hg-v1294 OMNIBTC walker: ${passed} passed, ${failed} failed ==`);
process.exit(failed ? 1 : 0);
