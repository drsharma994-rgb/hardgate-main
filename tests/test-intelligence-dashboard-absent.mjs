/* HARDGATE — Setup Intelligence dashboard: an absent figure never renders
   as a measurement.

   THE BUG THIS PINS. getAllTabsPerformance returns, per tab:

     winRate:       settled > 0 ? '54.5%' : null
     avgRiskReward: rrN     > 0 ? '1.50'  : null      <-- independent of settled
     dataPoints:    settled

   getTopPerformersAcrossAllTabs then does parseFloat() on both and keeps any
   tab with dataPoints > 0. Because dataPoints IS settled, winRate is safe
   there — but avgRiskReward is null whenever no winner has reported its R,
   which can happen with plenty of settled trades. parseFloat(null) is NaN,
   and the renderer called .toFixed(2) on it, printing the string

     "NaN:1 R/R"

   on a trading card. renderTabsPerformance had always guarded this case with
   an em dash; renderTopPerformers did not. Same rule as
   test-null-formatting.mjs, on a file that test does not reach: an absent
   value reads as absent, never as a number.

   Run: node tests/test-intelligence-dashboard-absent.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* A result a reader would take for a real measurement — same test as
   test-null-formatting.mjs uses. */
function leaksAValue(s){
  return /\bNaN\b/i.test(s) || /\bnull\b/i.test(s) || /\bundefined\b/i.test(s);
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, setInterval, clearInterval, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { addEventListener(){}, getElementById: () => null,
                   querySelector: () => null, createElement: () => ({ style: {}, innerHTML: '' }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hardgate-setup-intelligence-dashboard.js'), 'utf8'),
                  ctx, { filename: 'hardgate-setup-intelligence-dashboard.js' });
  return new ctx.HardgateSetupIntelligenceDashboard(ctx);
}

const d = boot();

console.log('== num() refuses to invent a number ==');
{
  ok(d.num(null) === null, 'null is absent');
  ok(d.num(undefined) === null, 'undefined is absent');
  ok(d.num('') === null, 'empty string is absent');
  ok(d.num(parseFloat(null)) === null, 'a NaN from parseFloat(null) is absent');
  ok(d.num('54.5%') === 54.5, 'a real percentage still parses');
  ok(d.num(0) === 0, 'a REAL zero is still zero, not absent');
}

console.log('\n== the row that used to print "NaN:1 R/R" ==');
{
  /* settled trades, but no winner ever reported a reward multiple */
  const html = d.renderTopPerformers([
    { tabName: 'GOLD SCALP', winRate: 54.5, avgRiskReward: parseFloat(null), closedSetups: 31 }
  ]);
  ok(!leaksAValue(html), 'no NaN / null / undefined reaches the card');
  ok(/—/.test(html), 'the absent R:R renders as an em dash');
  ok(/54\.5%/.test(html), 'the win rate that IS known still renders');
  ok(/31 settled/.test(html), 'the settled count still renders');
}

console.log('\n== every renderer holds the same line ==');
{
  const absent = { winRate: null, avgRiskReward: null, closedSetups: 0, totalSetups: 4, dataPoints: 2 };
  const perTab = d.renderTabsPerformance({ 'SWING SCAN': absent });
  ok(!leaksAValue(perTab), 'per-tab row leaks nothing');

  const summary = d.renderSummary({ totalSetups: 4, closedSetups: 0, openSetups: 4,
                                    overallWinRate: null, overallRiskReward: null });
  ok(!leaksAValue(summary), 'summary tiles leak nothing');
  ok(/no settled trades yet/.test(summary), 'summary says why the figure is absent');

  const top = d.renderTopPerformers([]);
  ok(!leaksAValue(top), 'empty top performers leaks nothing');
  ok(/Nothing to rank/.test(top), 'empty top performers explains itself');

  const consensus = d.renderConsensusSignals([]);
  ok(!leaksAValue(consensus), 'empty consensus leaks nothing');

  const insights = d.renderInsights([]);
  ok(!leaksAValue(insights), 'empty insights leaks nothing');
}

console.log('\n== the percent string round-trips (the old "0%%" / 100x bugs) ==');
{
  /* summary.overallWinRate arrives from the factory as a PERCENT STRING
     ("40.0%") or "—". It was once parsed as a fraction and re-multiplied by
     100, and the template appended a second '%'. Both stay fixed here. */
  const real = d.renderSummary({ totalSetups: 25, closedSetups: 20, openSetups: 5,
                                 overallWinRate: '40.0%', overallRiskReward: '1.50' });
  ok(/40\.0%/.test(real), 'a percent string renders at its own value');
  ok(!/%%/.test(real), 'and never doubles the percent sign');
  ok(!/4000/.test(real), 'and is not inflated 100x');
  ok(/1\.50:1/.test(real), 'R:R renders with its ratio suffix');

  const dash = d.renderSummary({ totalSetups: 12, closedSetups: 0, openSetups: 12,
                                 overallWinRate: '—', overallRiskReward: '—' });
  ok(!leaksAValue(dash), 'the factory em dash passes through without leaking');
  ok(!/%%/.test(dash), 'and still no doubled percent');
}

console.log('\n== an absent win rate is never coloured as a good one ==');
{
  /* "—" painted green would read as a pass at a glance */
  ok(d.wrColor(null).indexOf('--long') === -1, 'absent is not green');
  ok(d.wrColor(90).indexOf('--long') !== -1, '90% is green');
  ok(d.wrColor(20).indexOf('--short') !== -1, '20% is red');
}

console.log('\n== styled from the app tokens, not a hardcoded dark palette ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'hardgate-setup-intelligence-dashboard.js'), 'utf8');
  /* Comments may still NAME the old colours — that is history, not styling.
     Only what the file can actually paint counts. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/#0f1419|#1a2235|#e8ecef|#ffd700/.test(code), 'the old dark palette no longer paints anything');
  ok(/var\(--panel/.test(code) && /var\(--txt/.test(code), 'it reads the app CSS variables');
  ok(/#0f1419/.test(src), 'and the comment still records what it used to be');
}

console.log('\n== the bootstrap report no longer fabricates a zero ==');
{
  /* setup-intelligence.js falls back to `: 0` for winRate and avgRiskReward,
     so a young log handed this panel a real 0 that it printed as "0.0%" —
     right beside the other panel correctly saying "no settled trades yet". */
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, setInterval, clearInterval, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { addEventListener(){}, getElementById: () => null, querySelector: () => null,
                   createElement: () => ({ style: {}, innerHTML: '' }) };
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hardgate-setup-intelligence-bootstrap.js'), 'utf8'),
                  ctx, { filename: 'hardgate-setup-intelligence-bootstrap.js' });

  const Boot = ctx.HardgateSetupIntelligenceBootstrap || ctx.SetupIntelligenceBootstrap;
  ok(typeof Boot === 'function', 'bootstrap class is reachable for testing');

  const b = Object.create(Boot.prototype);
  b.setupIntelligence = { getClosedSetups: () => [] };

  ok(b.ratio(0, 0, 1, '%', 100) === '—', 'a rate over zero settled is an em dash, not 0.0%');
  ok(b.ratio(0.55, 20, 1, '%', 100) === '55.0%', 'a real rate over real trades still prints');
  ok(b.ratio(null, 5, 2) === '—', 'a null value is an em dash even with settled trades');
  ok(b.rateColor(0, 0).indexOf('--long') === -1, 'an unmeasured rate is not painted green');

  const html = b.generateDashboardHTML({
    today: { totalSetups: 6, closedSetups: 0, openSetups: 6, winRate: 0 },
    historical: { overallWinRate: 0, avgRiskReward: 0 },
    insights: [], topPerformers: []
  });
  ok(!/0\.0%/.test(html), 'a young log does not report a 0.0% win rate');
  ok(!leaksAValue(html), 'and leaks no NaN / null / undefined');
  ok(/unmeasured, not zero/.test(html), 'it says why the figure is absent');

  /* generateIntelligenceReport spreads a null analysis into `{date, ...null}`,
     producing a TRUTHY object whose every metric is undefined. The old
     `if (today)` passed and printed "undefined" into each cell. */
  const empty = b.generateDashboardHTML({
    today: { date: '2026-09-15' },      // exactly what a day with no setups yields
    historical: null,
    insights: [], topPerformers: []
  });
  ok(!leaksAValue(empty), 'a day with no setups prints no "undefined"');
  ok(/No setup recorded today/.test(empty), 'it says there is nothing today');
  ok(/Nothing recorded yet/.test(empty), 'and history explains itself rather than standing empty');
}

console.log('\nintelligence dashboard absent-value handling: ' + passed + ' checks passed');
