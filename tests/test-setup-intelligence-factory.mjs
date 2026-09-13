/* Setup Intelligence — the all-tabs factory report must terminate.

   v727 shipped getUnifiedPerformanceReport() → generateInsights() →
   getUnifiedPerformanceReport() … a RangeError on every page load that took
   the factory, the dashboard and the monitor down with it ("Initialization
   failed: Maximum call stack size exceeded"). setup-activation.js also carried
   a demo block calling recordSetup on the CLASS, an uncaught TypeError on
   every load. Both fixed in hg-v728; this keeps them fixed.

   Run: node tests/test-setup-intelligence-factory.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){} }, Math, Date, Number, String, Object, Array, isFinite, isNaN, parseFloat, parseInt, JSON, Error, RangeError, Map, Set, Promise, setTimeout, clearTimeout, setInterval, clearInterval };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { readyState: 'complete', addEventListener(){}, getElementById(){ return null; }, querySelector(){ return null; }, createElement(){ return { style: {}, appendChild(){}, setAttribute(){} }; }, body: { appendChild(){} } };
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hardgate-all-tabs-integration-factory.js'), 'utf8'), ctx, { filename: 'hardgate-all-tabs-integration-factory.js' });
  return ctx;
}

console.log('== unified report terminates on a fresh factory ==');
{
  const W = boot();
  const Factory = W.HardgateAllTabsIntegrationFactory || vm.runInContext('typeof HardgateAllTabsIntegrationFactory === "function" ? HardgateAllTabsIntegrationFactory : null', W);
  ok(typeof Factory === 'function', 'factory class reachable');
  const f = new Factory(W);
  let report = null, err = null;
  try{ report = f.getUnifiedPerformanceReport(); }catch(e){ err = e; }
  ok(!err, 'getUnifiedPerformanceReport does not throw (' + (err && err.message) + ')');
  ok(report && report.summary && typeof report.summary.overallWinRate === 'string', 'summary present with win rate string');
  ok(Array.isArray(report.insights), 'insights is an array');
  ok(Array.isArray(f.generateInsights({}, report.summary)), 'generateInsights takes the summary it is handed');
}

console.log('== source guards ==');
{
  const factory = fs.readFileSync(path.join(ROOT, 'hardgate-all-tabs-integration-factory.js'), 'utf8');
  const body = factory.slice(factory.indexOf('generateInsights('), factory.indexOf('exportAllTabsData('));
  ok(body.indexOf('getUnifiedPerformanceReport()') < 0, 'generateInsights never calls getUnifiedPerformanceReport');
  const act = fs.readFileSync(path.join(ROOT, 'setup-activation.js'), 'utf8');
  ok(act.indexOf('HardgateSetupIntelligence.recordSetup') < 0, 'setup-activation.js no longer calls recordSetup on the class');
  ok(act.indexOf('window.addEventListener(') < 0, 'setup-activation.js has no bare window.addEventListener (mount test stub)');
}

console.log('\nOK - Setup Intelligence factory report terminates; activation demo block gone (' + passed + ' checks)');
