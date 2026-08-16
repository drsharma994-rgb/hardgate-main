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
  ok(rep.sections.length === 6, 'six sections: gates, pine, structure, vetoes, formation, measured');
  const ids = rep.sections.map(s => s.id).join(',');
  ok(ids === 'gates,pine,structure,gatesveto,formation,measured', 'section order is stable (' + ids + ')');
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

console.log('\n== MEASURED TRACK RECORD: what the app has actually measured ==');
{
  /* The report shows what the engines SEE. This section shows what has been
     MEASURED — the out-of-sample forward log, the scorecard's edge lookup,
     the meta-label and the formation-quality score. It will mostly read "no
     settled samples yet", and that is the correct answer rather than a
     failure of the panel: the forward log only counts firings recorded on a
     bar and settled later against bars that had not printed. A confident hit
     rate with four samples behind it would be worse than an empty one. */
  const ctx = boot(ENGINES.concat(['fixpack15-core.js', 'meta-label.js', 'hg-forward.js',
                                   'scorecard.js', 'supersetup.js']));
  const r4 = gen(260, 50000, 'pullback');
  const rep = ctx.hgContractReportRun({ sym: 'BTCUSD', rows4h: r4, rows1h: gen(260, 50000, 'pullback'),
    rows15m: gen(260, 50000, 'pullback'),
    ticker: { symbol: 'BTCUSD', fundingPct: 0.01, mark: r4[r4.length - 1].c } });

  const m = rep.sections.filter(s => s.id === 'measured')[0];
  ok(!!m, 'the measured section exists');
  ok(m.rows.length >= 3, 'it carries several measurements (' + m.rows.length + ')');
  ok(/MEASURED TRACK RECORD/.test(m.label), 'and is labelled as measurement, not opinion');

  const names = m.rows.map(r => r.name).join(' | ');
  ok(/Meta-label/.test(names), 'the meta-label take/skip is included');
  ok(/Measured edge|scorecard/.test(names), 'the scorecard edge lookup is included');
  ok(/Forward log|forward log/i.test(names), 'the out-of-sample forward log is included');

  /* An empty ledger must read as empty, never as a result. */
  for (const r of m.rows){
    ok(r.state !== 'signal' || !/no settled|no records/.test(r.detail),
      r.name + ': does not report a signal while saying it has no samples');
    ok(!/NaN|undefined/.test(r.detail), r.name + ': no NaN in the detail (' + r.detail.slice(0, 50) + ')');
  }
  const fwd = m.rows.filter(r => /Forward log/i.test(r.name));
  for (const f of fwd){
    if (f.state === 'signal'){
      ok(/settled/.test(f.detail), f.name + ': a reported record states its sample count');
    } else {
      ok(/no settled|not loaded|no desk fired/.test(f.detail),
        f.name + ': an empty ledger says so plainly (' + f.detail.slice(0, 60) + ')');
    }
  }

  /* A small sample must be labelled as one rather than read as a verdict. */
  const small = m.rows.filter(r => r.why && /not enough|a count, not a verdict/.test(r.why));
  ok(small.length === 0 || small.every(r => r.state === 'signal'),
    'a small-sample caveat only appears where a number was actually reported');

  const html = ctx.hgContractReportHTML(rep);
  ok(/MEASURED TRACK RECORD/.test(html), 'the section renders');
  ok(!/NaN|undefined/.test(html), 'and the page still has no NaN in it');
}

console.log('\n== FLOW & POST-GATE: network engines, appended without blocking ==');
{
  const ctx = boot(ENGINES);
  const r4 = gen(260, 50000, 'pullback');
  const rep = ctx.hgContractReportRun({ sym: 'BTCUSD', rows4h: r4, rows1h: gen(260, 50000, 'pullback'),
    rows15m: gen(260, 50000, 'pullback'),
    ticker: { symbol: 'BTCUSD', fundingPct: 0.01, mark: r4[r4.length - 1].c } });

  ok(typeof ctx.hgContractReportEnrich === 'function', 'hgContractReportEnrich is exported');
  const extra = await ctx.hgContractReportEnrich(rep, { ticker: { symbol: 'BTCUSD', fundingPct: 0.01 }, rows4h: r4 });
  ok(Array.isArray(extra) && extra.length === 2, 'it returns the flow and post-gate rows (' + extra.length + ')');
  for (const r of extra){
    ok(['signal', 'idle', 'unchecked', 'error'].indexOf(r.state) >= 0, r.name + ': carries a real state');
    ok(typeof r.detail === 'string', r.name + ': carries a detail');
    ok(!/NaN|undefined/.test(r.detail), r.name + ': no NaN in the detail');
  }
  const flow = extra.filter(r => /Flow trap/.test(r.name))[0];
  ok(!!flow, 'the flow trap is reported');
  ok(flow.state !== 'signal' || !/N\/A/.test(flow.detail),
    'flow N/A is never reported as a passed flow leg');

  /* With no plan there is nothing to gate — it must say so, not pass. */
  const bare = ctx.hgContractReportRun({ sym: 'X', rows4h: [], rows1h: [], rows15m: [], ticker: { symbol: 'X' } });
  const none = await ctx.hgContractReportEnrich(bare, { ticker: { symbol: 'X' }, rows4h: [] });
  ok(none.length === 2, 'both rows still appear with no plan');
  ok(none.every(r => r.state === 'unchecked'), 'and both read UNCHECKED rather than passing');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/hgContractReportEnrich\(rep/.test(html), 'SEARCH calls the async enrichment');
  ok(/FLOW & POST-GATE \(network\)/.test(html), 'and appends it as its own section');
  ok(/the synchronous report stands on its own/.test(html), 'a failed enrichment leaves the report intact');
}


console.log('\n== the report records its own plan, kept apart from the desks ==');
{
  /* Every desk records its firings so evidence accumulates. This panel
     produced a concrete levelled plan and recorded nothing, so it could show
     "no settled samples yet" forever while generating setups it never
     counted.

     It records under its OWN tab id, and that separation is the point. A desk
     scan is systematic — it fires on whatever the universe throws up. A FULL
     REPORT fires on a contract the reader chose to type in. Pooling the two
     would let a habit of only checking symbols that already look good flatter
     the desk numbers: the log would be measuring the choosing, not the
     strategy. */
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ENGINES.concat(['hg-forward.js'])){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)){ try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) {} }
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'contract-report.js'), 'utf8'), ctx, { filename: 'contract-report.js' });

  ok(typeof ctx.hgContractReportRecord === 'function', 'hgContractReportRecord is exported');
  ok(typeof ctx.hgFwdStats === 'function', 'the forward log is available to record into');

  const r4 = gen(260, 50000, 'pullback');
  const mk = () => ctx.hgContractReportRun({ sym: 'BTCUSD', rows4h: r4, rows1h: gen(260, 50000, 'pullback'),
    rows15m: gen(260, 50000, 'pullback'),
    ticker: { symbol: 'BTCUSD', fundingPct: 0.01, mark: r4[r4.length - 1].c } });

  const rep = mk();
  ok(rep.plan.ok, 'the fixture produced a plan to record — the block is not vacuous');

  const first = ctx.hgContractReportRecord(rep);
  ok(first === 1, 'the plan is recorded once (' + first + ')');
  const second = ctx.hgContractReportRecord(rep);
  ok(second === 0, 'pressing FULL REPORT again in the same bar records nothing (' + second + ')');

  const own = ctx.hgFwdStats('SEARCH-REPORT', null, false);
  ok(own.open === 1, 'the plan sits open in the panel own pool (' + own.open + ')');
  ok(own.samples === 0, 'and counts as nothing settled until it resolves');

  /* The whole point: the desks must be untouched. */
  for (const desk of ['CRYPTOGATES', 'EDGE', 'PINE', 'SQUEEZE', 'TRENDTABLE']){
    const d = ctx.hgFwdStats(desk, null, false);
    ok(d.samples === 0 && d.open === 0, desk + ' pool is untouched by a user-chosen lookup');
  }

  const pool = ctx.hgFwdPool('SEARCH-REPORT');
  const mechs = Object.keys(pool);
  ok(mechs.length === 1, 'exactly one mechanic was recorded (' + mechs.join(',') + ')');
  ok(/FORMED-TICKET|DERIVED-STRUCTURE|[A-Z]/.test(mechs[0]),
    'the mechanic is the SOURCE of the levels, not the symbol (' + mechs[0] + ')');
  ok(!/BTCUSD/.test(mechs[0]), 'the coin is not the mechanic — the log must say which KIND of plan works');

  /* A plan that cannot be recorded honestly must not be. */
  const noPlan = { plan: { ok: false } };
  ok(ctx.hgContractReportRecord(noPlan) === 0, 'a report with no plan records nothing');
  ok(ctx.hgContractReportRecord({ plan: { ok: true, entry: 100, stop: 100, t1: 110, dir: 'long' } }) === 0,
    'a plan with no risk distance records nothing');
  ok(ctx.hgContractReportRecord(null) === 0, 'a null report records nothing and does not throw');

  /* And the panel reports its own record with the bias stated. */
  const rep2 = mk();
  const m = rep2.sections.filter(s => s.id === 'measured')[0];
  const ownRow = m.rows.filter(r => /selection-biased/.test(r.name))[0];
  ok(!!ownRow, 'the panel reports its own pool as a distinct row');
  ok(/selection-biased/.test(ownRow.name), 'and names the bias in the row title');
  ok(/never poolable|not plans a desk generated/.test(ownRow.why || ''),
    'and explains why it cannot be pooled with the desks');
  ok(/1 plan open/.test(ownRow.detail), 'and reflects the plan just recorded (' + ownRow.detail.slice(0, 40) + ')');

  const html = ctx.hgContractReportHTML(rep2);
  ok(/selection-biased/.test(html), 'the bias is visible to the reader, not only in the data');
  ok(!/NaN|undefined/.test(html), 'and the page still has no NaN');
}

console.log('\n== SEARCH records the plan after rendering it ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/hgContractReportRecord\(rep\)/.test(html), 'the SEARCH handler records the plan');
  const renderAt = html.indexOf('out.innerHTML = hgContractReportHTML(rep);');
  const recordAt = html.indexOf('hgContractReportRecord(rep)');
  ok(renderAt > 0 && recordAt > renderAt, 'it records AFTER the page is on screen, so recording never delays the report');
  ok(/must never be pooled with the desk/.test(html), 'the separation is documented where it is wired');
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
