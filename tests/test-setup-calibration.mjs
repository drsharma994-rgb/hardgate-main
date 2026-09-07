/* HARDGATE — setup-calibration Increment 2 tests */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  scBuildProfileFromSources, scProfileAnnotate, scRegimeConditionalGate,
  scVolAdaptiveRr, scConfluenceTier, scCrossVenueSwingGate, scTripleWitnessGate,
  scGoldBasisGate, scTimeStopMaxBars, scMacroRegimeBucket
} from '../lib/setup-calibration-core.mjs';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, msg){ if (cond){ pass++; console.log('  ok —', msg); } else { fail++; console.error('  FAIL —', msg); } }

globalThis.__scAtr = function(rows, len){
  len = len || 14;
  const out = new Array(rows.length).fill(NaN);
  for (let i = len; i < rows.length; i++){
    let s = 0;
    for (let j = i - len + 1; j <= i; j++){
      const tr = Math.max(rows[j].h - rows[j].l, Math.abs(rows[j].h - rows[j].c), Math.abs(rows[j].l - rows[j].c));
      s += tr;
    }
    out[i] = s / len;
  }
  return out;
};
globalThis.__scEma = function(arr, n){
  const out = new Array(arr.length).fill(NaN);
  let k = 2 / (n + 1), prev = arr[0];
  out[0] = prev;
  for (let i = 1; i < arr.length; i++){ prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
};

ok(swCacheOk(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw.js matches ' + HG_VER);

const logs = [
  { kind: 'swing', status: 'tp', rr: 2, regimeScore: 4, filledTs: 0, doneTs: 14400 * 10, res: '4h' },
  { kind: 'swing', status: 'sl', rr: 2, regimeScore: 4, filledTs: 0, doneTs: 14400 * 5, res: '4h' },
  { kind: 'swing', status: 'tp', rr: 2, regimeScore: -4, filledTs: 0, doneTs: 14400 * 8, res: '4h' },
  { kind: 'swing', status: 'tp', rr: 2, regimeScore: 0, filledTs: 0, doneTs: 14400 * 6, res: '4h' },
];
for (let i = 0; i < 18; i++){
  logs.push({ kind: 'swing', status: i % 3 === 0 ? 'sl' : 'tp', rr: 2, regimeScore: 4, filledTs: 0, doneTs: 14400 * 4, res: '4h' });
}

const profile = scBuildProfileFromSources(logs, [], { minSample: 20 });
ok(profile.setups.swing && profile.setups.swing['risk-on'].n >= 20, 'profile builds risk-on swing bucket with sample');

const posAnn = scProfileAnnotate(profile, 'swing', 4);
ok(posAnn.allowBest === true && posAnn.n >= 20, 'positive EV regime allows BEST');

const negProfile = scBuildProfileFromSources(
  Array.from({ length: 25 }, (_, i) => ({ kind: 'swing', status: 'sl', rr: 2, regimeScore: 0 })),
  [], { minSample: 20 }
);
const negAnn = scProfileAnnotate(negProfile, 'swing', 0);
ok(negAnn.tag === 'negative-ev-regime' && negAnn.allowBest === false, 'negative EV regime blocks BEST');

const regimeCfg = JSON.parse(fs.readFileSync(path.join(root, 'data/regime-profile.json'), 'utf8'));
const swingVeto = scRegimeConditionalGate(regimeCfg, 'swing', 0, 'compression', 7);
ok(swingVeto.allow === false, 'swing vetoed in chop regime (|score| < 1)');

const meanAllow = scRegimeConditionalGate(regimeCfg, 'meanrev', 0, 'compression', 7);
ok(meanAllow.allow === true, 'meanrev allowed in chop');

ok(scVolAdaptiveRr(85, 1.3, { stopMult: 1, rrMin: 2 }).rrMin >= 2.5, 'high ATR rank raises rrMin');
ok(scVolAdaptiveRr(15, 0.7, { stopMult: 1, rrMin: 2 }).rrMin <= 1.8, 'low ATR rank lowers rrMin');
ok(scConfluenceTier(2) === 1 && scConfluenceTier(1) === 2 && scConfluenceTier(0) === 3, 'confluence tiers');

function trendRows(n, step){
  const r = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * step;
    r.push({ t: i, o: c - step, h: c + 1, l: c - 1, c, v: 1000 });
  }
  return r;
}
const up = trendRows(80, 0.5);
const cv = scCrossVenueSwingGate('long', up, up);
ok(cv.pass === true, 'cross-venue aligned on matching cascades');

const tw = scTripleWitnessGate('long', 50, 60, 1.1);
ok(tw.pass === true && tw.witnesses >= 2, 'triple witness gate passes long');

const gb = scGoldBasisGate('long', 2650, 2640);
ok(gb.pass === false, 'gold basis dislocation vetoes');

const medBars = scTimeStopMaxBars('swing', { medianWinBars: 10 }, { timeStopDefaults: { swing: { bars: 60 } } });
ok(medBars === 20, 'time stop = 2 × median winner bars');

ok(scMacroRegimeBucket(4) === 'risk-on' && scMacroRegimeBucket(-4) === 'risk-off', 'macro regime buckets');

/* browser bridge smoke */
const ctx = vm.createContext({ window: {}, console, document: { readyState: 'complete', addEventListener: function(){} },
  fetch: async () => ({ ok: false }) });
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'setup-calibration.js'), 'utf8'), ctx, { filename: 'setup-calibration.js' });
ok(typeof ctx.hgSetupCalibrationEval === 'function', 'setup-calibration.js exports hgSetupCalibrationEval');
ok(typeof ctx.hgSetupTimeStopBars === 'function', 'setup-calibration.js exports hgSetupTimeStopBars');

const src = fs.readFileSync(path.join(root, 'setup-calibration.js'), 'utf8');
ok(src.indexOf('hgSetupProfileRefresh') >= 0, 'profile refresh wired');
ok(fs.existsSync(path.join(root, 'data/setup-profile.json')), 'setup-profile.json exists');
ok(fs.existsSync(path.join(root, 'data/regime-profile.json')), 'regime-profile.json exists');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('setup-calibration.js') >= 0, 'index.html loads setup-calibration.js');
ok(html.indexOf('hgSetupCalibrationEval') >= 0, 'BEST pipeline calls calibration eval');

const pb = fs.readFileSync(path.join(root, 'lib/paperbook-core.mjs'), 'utf8');
ok(pb.indexOf('time_stop') >= 0 && pb.indexOf('timeStop') >= 0, 'paperbook time-stop rule');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
