/* HARDGATE — setup activation dot tests.
   Run: node tests/test-setup-activation.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

function loadChain(files, extra){
  const sandbox = Object.assign({
    window: {},
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    JSON,
    Math,
    document: { readyState: 'complete', addEventListener: function(){} },
    localStorage: { _s: {}, getItem(k){ return this._s[k] || null; }, setItem(k,v){ this._s[k]=String(v); } }
  }, extra || {});
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox.window;
}

console.log('== setup-activation exports ==');
const W = loadChain(['plans.js', 'book.js', 'setup-activation.js']);
ok(typeof W.hgSetupIsActivated === 'function', 'hgSetupIsActivated exported');
ok(typeof W.hgSetupActivatedDotHtml === 'function', 'hgSetupActivatedDotHtml exported');
ok(typeof W.hgSetupActivationRefreshDom === 'function', 'hgSetupActivationRefreshDom exported');

console.log('== activation logic ==');
ok(W.hgSetupIsActivated('BTCUSD', 'long', 100, 95, { inZone: true }) === true, 'meta.inZone activates');
ok(W.hgSetupIsActivated('BTCUSD', 'long', 100, 95, { status: 'TRIGGERED' }) === true, 'TRIGGERED status activates');
ok(W.hgSetupIsActivated('BTCUSD', 'long', 100, 95, {}, 100) === true, 'mark inside entry zone activates');
ok(W.hgSetupIsActivated('BTCUSD', 'long', 100, 95, {}, 90) === false, 'mark below entry zone does not activate');

W.__hgBookOpenKeys = { 'main:BTCUSD:long': true };
ok(W.hgSetupIsActivated('BTCUSD', 'long', 100, 95, {}) === true, 'IN BOOK activates');

console.log('== dot HTML ==');
const html = W.hgSetupActivatedDotHtml('ETHUSD', 'short', 2000, 2050, { triggered: true });
ok(html.indexOf('hg-setup-activated-dot') >= 0, 'activated dot markup present');
ok(html.indexOf('hg-setup-activation-slot') >= 0, 'activation slot wrapper present');
ok(W.hgSetupActivatedDotHtml('ETHUSD', 'short', 2000, 2050, {}).indexOf('hg-setup-activated-dot') < 0, 'idle slot has no dot');

console.log('== wiring ==');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(indexHtml.indexOf('setup-activation.js') >= 0, 'index.html loads setup-activation.js');
ok(indexHtml.indexOf('hgSetupActivatedDotHtml') >= 0, 'cardHTML uses hgSetupActivatedDotHtml');
const ui = fs.readFileSync(path.join(root, 'setup-ui.js'), 'utf8');
ok(ui.indexOf('hgSetupActivatedDotHtml') >= 0, 'hgSetupCardHead uses activation dot');
const css = fs.readFileSync(path.join(root, 'bright.css'), 'utf8');
ok(css.indexOf('hg-setup-activated-dot') >= 0, 'bright.css has activation dot styles');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(sw.indexOf('setup-activation.js') >= 0, 'sw.js precaches setup-activation.js');

console.log('\nsetup-activation: ' + n + ' passed');
