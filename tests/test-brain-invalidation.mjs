/* HARDGATE — braininvalidation.js unit tests (offline, no network).
   Run: node tests/test-brain-invalidation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

function memStore(){
  const m = {};
  return {
    getItem(k){ return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; },
    _map: m,
  };
}

function loadBrainInv(opts){
  opts = opts || {};
  globalThis.window = {};
  globalThis.localStorage = memStore();
  const W = globalThis.window;
  W.brainInvAlertsOn = opts.invOn !== false ? function(){ return true; } : function(){ return false; };
  W.sendTelegram = opts.sendTelegram || function(){};
  W.sendAlertPush = opts.sendAlertPush || function(){};
  vm.runInThisContext(fs.readFileSync(root + 'braininvalidation.js', 'utf8'), { filename: 'braininvalidation.js' });
  return W;
}

console.log('== layer signatures ==');
{
  const W = loadBrainInv();
  var sig = W.hgBrainLayerSigFromRow({
    col: { votes: [{ layer: 'regime', vote: 'long' }, { layer: 'oiflow', vote: 'long' }] },
  });
  ok(sig.indexOf('oiflow:long') >= 0 && sig.indexOf('regime:long') >= 0, 'layerSigFromRow sorts layer votes');
}

console.log('== book layer snapshot ==');
{
  const W = loadBrainInv();
  W.hgBrainBookLayerRecord({
    sym: 'BTCUSDT', dir: 'long', fund: 'main', tier: 'PRIME',
    layerSig: 'regime:long|oiflow:long', layers: ['regime', 'oiflow'],
  });
  var raw = globalThis.localStorage.getItem('hg_brain_book_layers_v1');
  ok(raw && raw.indexOf('BTCUSDT') >= 0 && raw.indexOf('PRIME') >= 0, 'hgBrainBookLayerRecord persists snapshot');
}

console.log('== invalidation alerts ==');
{
  var sent = [];
  const W = loadBrainInv({
    sendTelegram: function(t){ sent.push(t); },
  });
  W.hgBrainBookLayerRecord({ sym: 'BTCUSDT', dir: 'long', fund: 'main', tier: 'PRIME', layerSig: 'a' });
  W.hgBrainBookLayerRecord({ sym: 'ETHUSDT', dir: 'short', fund: 'main', tier: 'HIGH', layerSig: 'b' });
  var n = W.hgBrainInvAlertsFromRows([
    { sym: 'BTCUSDT', dir: 'long', tier: 'WATCH', layerSig: 'a', evidence: ['REGIME: risk-on'] },
    { sym: 'ETHUSDT', dir: 'long', tier: 'HIGH', layerSig: 'b', evidence: ['REGIME: flip'] },
  ]);
  ok(n === 2, 'fires on PRIME→WATCH demotion and direction flip');
  ok(sent.length === 1 && sent[0].indexOf('BTCUSDT') >= 0 && sent[0].indexOf('ETHUSDT') >= 0,
    'single Telegram batch includes both invalidation lines');
}

console.log('== alert gate ==');
{
  const W = loadBrainInv({ invOn: false });
  W.hgBrainBookLayerRecord({ sym: 'SOLUSDT', dir: 'long', tier: 'PRIME', layerSig: 'x' });
  ok(W.hgBrainInvAlertsFromRows([{ sym: 'SOLUSDT', dir: 'long', tier: 'ASIDE' }]) === 0,
    'brainInvAlertsOn false suppresses alerts');
}

console.log('== hgBrainInvAlertsFromLast ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'XRPUSDT', dir: 'long', tier: 'PRIME', layerSig: 'z' });
  W.__hgBrainLast = function(){
    return { rows: [{ sym: 'XRPUSDT', dir: 'long', tier: 'ASIDE', evidence: [] }] };
  };
  ok(W.hgBrainInvAlertsFromLast() === 1 && sent.length === 1, 'fromLast reads __hgBrainLast rows');
}

console.log('== PRIME→HIGH demotion ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'AVAXUSDT', dir: 'short', tier: 'PRIME', layerSig: 'p' });
  ok(W.hgBrainInvAlertsFromRows([{ sym: 'AVAXUSDT', dir: 'short', tier: 'HIGH', layerSig: 'p' }]) === 1,
    'PRIME→HIGH demotion fires tighten alert');
  ok(sent.length === 1 && sent[0].indexOf('PRIME → HIGH') >= 0, 'demotion text in telegram body');
}

console.log('== symbol dropped from scan ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'DOGEUSDT', dir: 'long', tier: 'HIGH', layerSig: 'd' });
  ok(W.hgBrainInvAlertsFromRows([]) === 1, 'missing sym in fresh rows triggers review alert');
  ok(sent[0].indexOf('no longer in BRAIN scan') >= 0, 'drop copy in telegram body');
}

console.log('== layer evidence drift ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'LINKUSDT', dir: 'long', tier: 'HIGH', layerSig: 'regime:long' });
  ok(W.hgBrainInvAlertsFromRows([
    { sym: 'LINKUSDT', dir: 'long', tier: 'HIGH', evidence: ['REGIME: risk-off'] },
  ]) === 1, 'layer sig drift on non-PRIME tier fires review stop');
  ok(sent[0].indexOf('layer evidence shifted') >= 0, 'drift copy in telegram body');
}

console.log('\n' + pass + ' passed');
