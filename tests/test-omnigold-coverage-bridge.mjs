/* HARDGATE — OMNIGOLD scan coverage + GOLD SCALP/SWING engine bridge.

   Run: node tests/test-omnigold-coverage-bridge.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== coverage counts fired vs silent ==');
{
  const W = boot();
  const cov = W.hgOgBuildScanCoverage({
    cfg: { label: 'SCALP', tf: '1h' },
    cands: [
      { kind: 'ORB', dir: 'short', grade: { ticket: false, vetoes: ['consensus'] } },
      { kind: 'MMOVE', dir: 'short', grade: { ticket: true, vetoes: [] } }
    ]
  });
  ok(cov.firedCount === 2, 'two mechanics fired');
  ok(cov.tickets === 1 && cov.vetoes === 1, 'ticket and veto tallied');
  ok(cov.silentCount > 50, 'most mechanics silent on a quiet bar');
  const html = W.hgOgScanCoveragePanelHtml(cov, null);
  ok(/SCAN COVERAGE/.test(html), 'panel titled');
  ok(/ORB/.test(html), 'fired mechanic named');
}

console.log('\n== gold engine bridge uses tab engines ==');
{
  const W = boot({
    goldScalpSetups: () => [{ dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL', stratKey: 'sweep',
      entry: 2600, stop: 2590, t1: 2615, rr: 1.5, grade: 'A', tally: 6 }],
    goldRankSetups: (cands) => ({ ranked: cands, best: cands[0], rejected: [] }),
    goldSwingSetups: () => ({ ranked: [{ dir: 'short', strategy: 'BOS ALIGNMENT', entry: 2605, stop: 2620, t1: 2585, grade: 'B', tally: 4 }],
      best: { dir: 'short', strategy: 'BOS ALIGNMENT', entry: 2605, stop: 2620, t1: 2585, grade: 'B', tally: 4 }, rejected: [] })
  });
  W.hgOgFetchRows = () => Promise.resolve({ rows: [{ t: 1, o: 1, h: 2, l: 1, c: 1.5, v: 1 }], source: 'test' });
  const bridge = await W.hgOgRunGoldTabEngines({}, [{ c: 2600 }], [{ c: 2600 }]);
  ok(bridge.ok, 'bridge ok');
  ok(bridge.scalp.best.strategy.includes('SWEEP'), 'scalp engine best present');
  ok(bridge.swing.best.strategy.includes('BOS'), 'swing engine best present');
  const panel = W.hgOgGoldEnginesPanelHtml(bridge);
  ok(/GOLD SCALP \/ SWING ENGINES/.test(panel), 'engines panel titled');
}

console.log('\n== mount wiring ==');
{
  const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/id="ogCoverage"/.test(GOLD), 'coverage host div');
  ok(/id="ogGoldEngines"/.test(GOLD), 'gold engines host div');
  ok(/id="ogSettledExec"/.test(GOLD), 'settled execute host div');
  ok(/hgOgPaintOgPostScan/.test(GOLD), 'post-scan paint bundles all panels');
}

console.log('\nomnigold coverage bridge: ' + passed + ' checks passed');
