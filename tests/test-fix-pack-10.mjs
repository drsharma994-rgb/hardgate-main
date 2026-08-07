/* HARDGATE Fix Pack 10 — conviction mesh. Run: node tests/test-fix-pack-10.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const brainSrc = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
const bCtx = vm.createContext({ window: {}, console, Math, Date, JSON, Array, Object, Number, String, isFinite, parseFloat, setTimeout, Promise });
vm.runInContext(brainSrc, bCtx, { filename: 'brain.js' });
const W = bCtx.window;

console.log('== mean-reversion oppose triggers setup conflict ASIDE ==');
{
  const v = (layer, vote, kind) => ({ layer, vote, kind: kind || 'structural', text: layer });
  const votes = [v('engine', 'long'), v('trend4h', 'long'), v('meanrev', 'short')];
  ok(W.brainSetupConflict(votes) !== null, 'continuation vs MR conflict detected');
  const d = W.brainDecide(votes, { unavailable: [] });
  ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('setup conflict') >= 0, 'conflict demotes to ASIDE');
}

console.log('== bybitpos tailwind dir from funding crowding ==');
{
  ok(W.positioningCrossTailwindDir({ fundingPct: 0.06 }) === 'short', 'positive funding → fade short');
  ok(W.positioningCrossTailwindDir({ fundingPct: -0.07 }) === 'long', 'negative funding → fade long');
  ok(W.positioningCrossTailwindDir({ fundingPct: 0.01 }) === null, 'sub-threshold funding → no tailwind dir');
}

console.log('== smart cross lookup for brain bybitpos ==');
{
  W.__hgSmartResults = {
    results: [{
      sym: 'BTCUSDT',
      fundingPct: 0.06,
      retailLongPct: 70,
      cross: { status: 'confirmed', agree: 2, conflict: 0, notes: ['funding crowding confirmed'] }
    }]
  };
  const pack = W.smartCrossForAliases({ BTCUSDT: 1 });
  ok(pack && pack.cross.status === 'confirmed', 'cross pack found for alias');
}

console.log('== conviction mesh counts agree/oppose/dark/silent ==');
{
  const mesh = W.brainConvictionMesh({
    votes: [
      { layer: 'engine', vote: 'long' },
      { layer: 'oiflow', vote: 'long' },
      { layer: 'meanrev', vote: 'short' },
      { layer: 'news', vote: 'neutral' }
    ],
    unavailable: ['liqs'],
    silent: ['tape', 'carry']
  }, 'long');
  ok(mesh.agree === 2 && mesh.disagree === 1 && mesh.dark === 1 && mesh.silent === 2,
     'mesh tallies ' + JSON.stringify(mesh));
}

console.log('== setup-ui conviction mesh HTML ==');
{
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'setup-ui.js'), 'utf8'), bCtx, { filename: 'setup-ui.js' });
  const html = W.hgSetupConvictionMeshHtml({ agree: 5, disagree: 1, dark: 2, silent: 4 });
  ok(html.indexOf('conviction mesh') >= 0 && html.indexOf('5 agree') >= 0 && html.indexOf('oppose') >= 0,
     'mesh chip renders counts');
}

console.log('== setup-stack FRED macro leg on crypto ==');
{
  const sCtx = vm.createContext({ window: { hgConfirmedCascade: () => null, hgRegimeAllowsSetup: () => ({ allow: true }) }, console, Math, isFinite, parseFloat });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'setup-stack.js'), 'utf8'), sCtx, { filename: 'setup-stack.js' });
  const st = sCtx.window.hgSetupStack({
    dir: 'long', style: 'swing', asset: 'crypto', sym: 'BTCUSDT',
    macro: { dxyOfficial: { value: 120, trend20: 'RISING' }, realYield10Y: 2.1, realYieldTrend: 'RISING' },
    gatesPassed: 7, gatesTotal: 7, clean: true
  });
  const labels = st.fundamental.items.map(i => i.label);
  ok(labels.indexOf('DXY FRED') >= 0, 'FRED DXY leg on crypto stack');
  ok(labels.indexOf('real yield FRED') >= 0, 'FRED real yield leg on crypto stack');
}

console.log('== sw cache bumped for fix pack 10 ==');
{
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const m = sw.match(/const HG_CACHE = 'hg-v(\d+)'/);
  ok(m && +m[1] >= 176, 'sw cache at least hg-v176 (pack 10+)');
}

console.log('\n' + passed + ' passed, 0 failed');
