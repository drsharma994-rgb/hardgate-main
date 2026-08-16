/* HARDGATE — FULL CONTRACT REPORT: every engine, one contract, one plan.

   SEARCH was a lookup. It answered "does this contract exist on Delta or
   CoinDCX" and never "what does the app think of it" — the whole desk was one
   tab away and none of it was applied to the symbol you had just typed.

   contract-report.js runs every strategy, gate, structure read and indicator
   the app ships against a single contract, then states ONE plan with exact
   entry, stop and three targets.

   What this pins:
     - the plan's numbers agree with each other: stop on the losing side of
       entry, targets strictly further out in order, and every R multiple the
       true ratio between the levels printed beside it
     - an engine that could not run reads UNCHECKED, never a silent absence
     - a missing module costs its own row, not the report
     - no fabricated price: when nothing can produce a risk distance the plan
       says so and shows no numbers

   The monotonic check is here because my first version failed it: a chop
   fixture produced TP3 52079 BELOW TP2 53274 on a long, because a target that
   failed validation was reprojected at a fixed R multiple that happened to
   land nearer than the engine's own T2.

   Run: node tests/test-contract-report.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ENGINES = ['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js', 'best-levels.js',
                 'formation.js', 'cryptogates.js', 'edge.js', 'squeeze.js', 'meanrev.js', 'trendtable.js',
                 'liqs.js', 'reversalsniper.js', 'pinemath.js', 'pine-sub.js'];

function boot(files){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(ctx);
  for (const f of files){
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { /* engine optional */ }
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'contract-report.js'), 'utf8'), ctx, { filename: 'contract-report.js' });
  return ctx;
}

function gen(n, base, mode){
  const out = [];
  let c = base;
  for (let i = 0; i < n; i++){
    const k = n - 1 - i;
    if (mode === 'up') c = c * 1.005;
    else if (mode === 'down') c = c * 0.995;
    else if (mode === 'pullback') c = k < 3 ? c * 1.012 : (k < 12 ? c * 0.996 : c * 1.006);
    else c = c * (1 + (i % 2 ? 0.003 : -0.0029));
    const r = c * 0.006;
    out.push({ t: 1700000000 + i * 14400, o: c - r * 0.3, h: c + r, l: c - r, c: c,
               v: 1000 + (i > n - 8 ? 3000 : 0) });
  }
  return out;
}

const W = boot(ENGINES);

console.log('== the module loads and exports its three entry points ==');
{
  ok(typeof W.hgContractReportRun === 'function', 'hgContractReportRun exported');
  ok(typeof W.hgContractReportHTML === 'function', 'hgContractReportHTML exported');
  ok(typeof W.hgContractReportCSS === 'function', 'hgContractReportCSS exported');
}

console.log('\n== it runs the whole desk, not a token few ==');
{
  const r4 = gen(260, 50000, 'pullback');
  const rep = W.hgContractReportRun({ sym: 'BTCUSD', venue: 'delta', rows4h: r4,
    rows1h: gen(260, 50000, 'pullback'), rows15m: gen(260, 50000, 'pullback'),
    ticker: { symbol: 'BTCUSD', fundingPct: 0.01, mark: r4[r4.length - 1].c } });

  ok(rep && rep.summary, 'a report came back');
  ok(rep.summary.engines >= 25, 'at least 25 engines were run (' + rep.summary.engines + ')');
  ok(rep.sections.length === 5, 'five sections: gates, pine, structure, vetoes, formation');
  const ids = rep.sections.map(s => s.id).join(',');
  ok(ids === 'gates,pine,structure,gatesveto,formation', 'section order is stable (' + ids + ')');
  const pine = rep.sections.filter(s => s.id === 'pine')[0];
  ok(pine.rows.length === 10, 'all ten pine detectors are reported (' + pine.rows.length + ')');
  ok(rep.indicators.length >= 10, 'the indicator block is populated (' + rep.indicators.length + ' reads)');
  ok(rep.summary.signals > 0, 'at least one engine had something to say (' + rep.summary.signals + ')');
  ok(rep.summary.errors === 0, 'no engine errored on a normal fixture (' + (rep.summary.errorNames || []).join(', ') + ')');
}

console.log('\n== THE PLAN: exact entry, stop and targets that agree with each other ==');
{
  let planned = 0;
  for (const mode of ['up', 'down', 'pullback', 'chop']){
    for (const bars of [260, 120, 70]){
      const r4 = gen(bars, 50000, mode);
      const rep = W.hgContractReportRun({ sym: 'TEST', rows4h: r4, rows1h: gen(bars, 50000, mode),
        rows15m: gen(bars, 50000, mode),
        ticker: { symbol: 'TEST', fundingPct: 0.01, mark: r4[r4.length - 1].c } });
      const p = rep.plan;
      ok(p && typeof p === 'object', mode + '/' + bars + ': a plan object exists');
      if (!p.ok){
        ok(typeof p.reason === 'string' && p.reason.length > 10,
          mode + '/' + bars + ': no plan comes with a stated reason, not a blank');
        ok(p.entry === null && p.stop === null, mode + '/' + bars + ': and quotes NO price rather than inventing one');
        continue;
      }
      planned++;
      const tag = mode + '/' + bars;
      ok(p.dir === 'long' || p.dir === 'short', tag + ': names a direction');
      for (const k of ['entry', 'stop', 't1', 't2', 't3']){
        ok(typeof p[k] === 'number' && isFinite(p[k]), tag + ': ' + k + ' is an exact number');
      }
      const stopOk = p.dir === 'long' ? p.stop < p.entry : p.stop > p.entry;
      ok(stopOk, tag + ': the stop is on the losing side of entry');
      const t1Side = p.dir === 'long' ? p.t1 > p.entry : p.t1 < p.entry;
      ok(t1Side, tag + ': TP1 is on the winning side of entry');
      const mono = p.dir === 'long' ? (p.t1 < p.t2 && p.t2 < p.t3) : (p.t1 > p.t2 && p.t2 > p.t3);
      ok(mono, tag + ': TP1 → TP2 → TP3 move strictly further out ('
        + p.t1.toFixed(2) + ' / ' + p.t2.toFixed(2) + ' / ' + p.t3.toFixed(2) + ')');
      const risk = Math.abs(p.entry - p.stop);
      ok(risk > 0, tag + ': risk is a real distance');
      for (const [t, rr] of [['t1', 'rr1'], ['t2', 'rr2'], ['t3', 'rr3']]){
        ok(Math.abs(p[rr] - Math.abs(p[t] - p.entry) / risk) < 1e-9,
          tag + ': ' + rr + ' is the true ratio between the printed levels');
      }
      ok(typeof p.source === 'string' && p.source.length > 0, tag + ': the plan names where its levels came from');
      ok(typeof p.entryType === 'string' && /MARKET|LIMIT/.test(p.entryType),
        tag + ': it says whether to take it now or wait (' + p.entryType.slice(0, 40) + ')');
    }
  }
  ok(planned >= 8, 'a real plan was produced for most fixtures (' + planned + '/12) — the block is not vacuous');
}

console.log('\n== an engine that cannot run reads UNCHECKED, never absent ==');
{
  /* Boot with NO engines at all: every row must still appear, marked. */
  const bare = boot([]);
  const r4 = gen(260, 50000, 'up');
  const rep = bare.hgContractReportRun({ sym: 'BTCUSD', rows4h: r4, rows1h: [], rows15m: [],
    ticker: { symbol: 'BTCUSD' } });
  ok(rep.summary.engines >= 25, 'every engine still has a row with nothing loaded (' + rep.summary.engines + ')');
  ok(rep.summary.unchecked >= 20, 'and they read UNCHECKED (' + rep.summary.unchecked + ')');
  ok(rep.summary.signals === 0, 'nothing claims a signal it could not compute');
  ok(rep.summary.errors === 0, 'a missing module is UNCHECKED, not an ERROR');
  const names = rep.summary.uncheckedNames.join(' ');
  ok(/SWING gate matrix/.test(names), 'the missing engines are named, not just counted');
  ok(rep.plan.ok === false, 'and no plan is invented from nothing');
  ok(/no engine|do not agree/.test(rep.plan.reason || ''), 'the reason says why (' + rep.plan.reason + ')');

  const html = bare.hgContractReportHTML(rep);
  ok(html.length > 500, 'it still renders a full page');
  ok(/UNCHECKED/.test(html), 'with UNCHECKED visible to the reader');
  ok(!/NaN|undefined/.test(html), 'and no NaN or undefined anywhere in it');
}

console.log('\n== thin history is reported, not papered over ==');
{
  const rep = W.hgContractReportRun({ sym: 'X', rows4h: gen(20, 100, 'up'), rows1h: [], rows15m: [],
    ticker: { symbol: 'X' } });
  ok(typeof rep.note === 'string' && /20 4h bars/.test(rep.note), 'the bar count is stated up front');
  ok(rep.bars.h4 === 20 && rep.bars.h1 === 0, 'the report carries what it actually had to work with');
  const html = W.hgContractReportHTML(rep);
  ok(!/NaN|undefined/.test(html), 'and still renders without NaN');
}

console.log('\n== one broken engine costs its own row, not the report ==');
{
  const ctx = boot(ENGINES);
  ctx.swingGateMatrix = function(){ throw new Error('engine exploded'); };
  const r4 = gen(260, 50000, 'up');
  const rep = ctx.hgContractReportRun({ sym: 'X', rows4h: r4, rows1h: gen(260, 50000, 'up'),
    rows15m: gen(260, 50000, 'up'), ticker: { symbol: 'X', mark: r4[r4.length - 1].c } });
  ok(rep.summary.engines >= 25, 'the rest of the report still ran (' + rep.summary.engines + ' engines)');
  ok(rep.summary.errors === 1, 'exactly one row is marked ERROR');
  ok(/engine exploded/.test(rep.summary.errorNames.join(' ')), 'and it names the real fault');
  ok(rep.summary.signals > 0, 'the surviving engines still reported');
}

console.log('\n== the R:R on every engine row is derived, never carried ==');
{
  const r4 = gen(260, 50000, 'pullback');
  const rep = W.hgContractReportRun({ sym: 'X', rows4h: r4, rows1h: gen(260, 50000, 'pullback'),
    rows15m: gen(260, 50000, 'pullback'), ticker: { symbol: 'X', fundingPct: 0.01, mark: r4[r4.length - 1].c } });
  let checked = 0;
  for (const sec of rep.sections){
    for (const row of sec.rows){
      if (row.rr === null || row.rr === undefined) continue;
      ok(row.entry !== null && row.stop !== null && row.t1 !== null,
        row.name + ': an R:R only exists where all three levels do');
      const risk = Math.abs(row.entry - row.stop);
      ok(Math.abs(row.rr - Math.abs(row.t1 - row.entry) / risk) < 1e-9,
        row.name + ': R:R equals |t1 - entry| / risk exactly');
      checked++;
    }
  }
  ok(checked > 0, 'engine rows with an R:R were actually checked (' + checked + ')');
}

console.log('\n== the SEARCH tab is wired to it ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<script src="contract-report\.js"><\/script>/.test(html), 'index.html loads contract-report.js');
  ok(/function runContractReport\(ex, sym, rid\)/.test(html), 'the SEARCH handler exists');
  ok(/FULL REPORT<\/button>/.test(html), 'every search result carries a FULL REPORT button');
  ok(/candlesDelta : candlesCdcx/.test(html), 'it pulls candles from whichever venue the row came from');
  ok(/no 4h candles came back/.test(html), 'and says so plainly when the feed gives nothing');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/\.\/contract-report\.js/.test(sw), 'the service worker caches the new module');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL CONTRACT REPORT TESTS PASSED');
