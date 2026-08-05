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

console.log('== evidence sig without col.votes ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  ok(W.hgBrainLayerSigFromRow({ col: { votes: [] } }) === '', 'layerSigFromRow empty when no votes');
  var evSig = 'REGIME: risk-on · OIFLOW: long';
  W.hgBrainBookLayerRecord({ sym: 'ADAUSDT', dir: 'long', tier: 'HIGH', layerSig: evSig });
  ok(W.hgBrainInvAlertsFromRows([
    { sym: 'ADAUSDT', dir: 'long', tier: 'HIGH', evidence: ['REGIME: risk-off', 'OIFLOW: short'] },
  ]) === 1, 'evidence-only drift (no col.votes) fires alert');
}

console.log('== PRIME tier suppresses layer drift ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'BNBUSDT', dir: 'long', tier: 'PRIME', layerSig: 'a|b' });
  ok(W.hgBrainInvAlertsFromRows([
    { sym: 'BNBUSDT', dir: 'long', tier: 'PRIME', layerSig: 'c|d', evidence: ['changed'] },
  ]) === 0, 'PRIME tier with layer sig drift does not fire drift alert');
  ok(sent.length === 0, 'no telegram when PRIME drift suppressed');
}

console.log('== fund-scoped snapshots ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  W.hgBrainBookLayerRecord({ sym: 'BTCUSDT', dir: 'long', fund: 'main', tier: 'PRIME', layerSig: 'm' });
  W.hgBrainBookLayerRecord({ sym: 'ETHUSDT', dir: 'long', fund: 'alt', tier: 'PRIME', layerSig: 'a' });
  var raw = globalThis.localStorage.getItem('hg_brain_book_layers_v1');
  ok(raw && raw.indexOf('main|BTCUSDT|long') >= 0 && raw.indexOf('alt|ETHUSDT|long') >= 0,
    'fund keys persist separately in snapshot store');
  ok(W.hgBrainInvAlertsFromRows([]) === 2, 'main and alt booked rows both alert when scan empty');
  ok(sent[0].indexOf('BTCUSDT') >= 0 && sent[0].indexOf('ETHUSDT') >= 0,
    'both fund-scoped symbols in drop batch');
}

console.log('== hgTelegramFormat + sendAlertPush ==');
{
  var fmtIn = null;
  var tgSent = [];
  var pushSent = [];
  const W = loadBrainInv({
    sendTelegram: function(t){ tgSent.push(t); },
    sendAlertPush: function(title, text, opts){ pushSent.push({ title: title, text: text, opts: opts }); },
  });
  W.hgTelegramFormat = function(o){ fmtIn = o; return 'FORMATTED:' + (o.body || ''); };
  W.hgBrainBookLayerRecord({ sym: 'MATICUSDT', dir: 'long', tier: 'PRIME', layerSig: 'x' });
  ok(W.hgBrainInvAlertsFromRows([{ sym: 'MATICUSDT', dir: 'long', tier: 'ASIDE' }]) === 1,
    'ASIDE demotion fires for push/telegram path');
  ok(fmtIn && fmtIn.headline && fmtIn.tab === 'BRAIN tab', 'hgTelegramFormat receives structured payload');
  ok(tgSent[0] === 'FORMATTED:' + fmtIn.body, 'sendTelegram gets hgTelegramFormat output');
  ok(pushSent.length === 1 && pushSent[0].title.indexOf('invalidation') >= 0 && pushSent[0].opts.priority === 5,
    'sendAlertPush invoked with title and priority 5');
}

console.log('== batch cap (max 8 lines) ==');
{
  var sent = [];
  const W = loadBrainInv({ sendTelegram: function(t){ sent.push(t); } });
  for (var i = 0; i < 10; i++){
    W.hgBrainBookLayerRecord({ sym: 'SYM' + i, dir: 'long', tier: 'PRIME', layerSig: 's' + i });
  }
  var rows = [];
  for (var j = 0; j < 10; j++){
    rows.push({ sym: 'SYM' + j, dir: 'long', tier: 'ASIDE' });
  }
  ok(W.hgBrainInvAlertsFromRows(rows) === 10, 'returns full line count even when batch capped');
  var body = sent[0];
  var lineCount = body.split('\n').filter(function(l){ return l.indexOf('ASIDE') >= 0; }).length;
  ok(lineCount <= 8, 'telegram body caps ASIDE lines at 8');
}

console.log('\n' + pass + ' passed');
