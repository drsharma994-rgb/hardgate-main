/* HARDGATE — unified hgBestLevels + structure-levels phases (offline). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function synthUptrend(n){
  var out = [], p = 100;
  for (var i = 0; i < n; i++){
    p += 0.35 + (i % 3 === 0 ? -0.1 : 0.15);
    out.push({ t: i * 14400, o: p - 0.2, h: p + 0.5, l: p - 0.6, c: p, v: 1000 + i * 10 });
  }
  return out;
}

function loadSandbox(extra){
  var sandbox = Object.assign({
    console, setTimeout, clearTimeout, Math, JSON, Array, Object, String, Number, isFinite, Infinity,
    CG_SWING_LOOK: 20, CG_SWING_RR_MIN: 2, CG_SWING_ANCHOR_ATR: 1.5,
    HG_tabs: [],
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  var ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'cryptogates.js'), 'utf8'), ctx, { filename: 'cryptogates.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'plans.js'), 'utf8'), ctx, { filename: 'plans.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'structure-levels.js'), 'utf8'), ctx, { filename: 'structure-levels.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'formation.js'), 'utf8'), ctx, { filename: 'formation.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'freqtrade-formation.js'), 'utf8'), ctx, { filename: 'freqtrade-formation.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'best-levels.js'), 'utf8'), ctx, { filename: 'best-levels.js' });
  return sandbox;
}

console.log('== structure-levels phase 2 ==');
{
  var sb = loadSandbox();
  ok(typeof sb.hgSwingLook === 'function' && sb.hgSwingLook() === 20, 'hgSwingLook = CG_SWING_LOOK 20');
  ok(typeof sb.hgDetectOrderBlock === 'function', 'order block detector');
  ok(typeof sb.hgDetectFvg === 'function', 'FVG detector');
  ok(typeof sb.hgShieldGuardVeto === 'function', 'ShieldGuard veto');
  var rows = synthUptrend(80);
  var ob = sb.hgDetectOrderBlock(rows, 'long');
  ok(ob === null || (ob.entry && ob.poi === 'ob'), 'OB scan returns null or valid OB');
}

console.log('== hgBestLevels phase 1 ==');
{
  var sb2 = loadSandbox();
  var rows = synthUptrend(120);
  var bl = sb2.hgBestLevels({ dir: 'long', rows4h: rows, style: 'swing', tab: 'test', skipShield: true });
  ok(bl && bl.ok && bl.plan, 'hgBestLevels returns plan on uptrend');
  ok(bl.plan.entry && bl.plan.stop && bl.plan.t1, 'plan has entry/stop/t1');
  ok(Math.abs(bl.plan.t1 - bl.plan.entry) >= Math.abs(bl.plan.entry - bl.plan.stop) * 1.99, 'min R:R ~2');
}

console.log('== wiring ==');
{
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(html.indexOf('structure-levels.js') >= 0 && html.indexOf('best-levels.js') >= 0, 'index loads best-levels stack');
  ok(/structure-levels\.js/.test(sw) && /best-levels\.js/.test(sw), 'sw shell lists modules');
  ok(/hg-v256/.test(sw), 'cache hg-v256');
  ok(/hgBestLevels/.test(fs.readFileSync(path.join(root, 'squeeze.js'), 'utf8')), 'squeeze uses hgBestLevels');
  ok(/hgBestLevels/.test(fs.readFileSync(path.join(root, 'trendtable.js'), 'utf8')), 'trendmx uses hgBestLevels');
  ok(/hgBestLevels/.test(fs.readFileSync(path.join(root, 'oiflow.js'), 'utf8')), 'oiflow uses hgBestLevels');
  ok(/hgDetectOrderBlock/.test(fs.readFileSync(path.join(root, 'formation.js'), 'utf8')), 'formation POI uses OB');
}

console.log('\n' + pass + ' passed, 0 failed');
