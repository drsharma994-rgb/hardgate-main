/* HARDGATE — pine.js tab wrapper smoke (mount, refresh, warm, HG_tabs).
   Complements test-pine-scan.mjs (signal math) and test-pine-sub.mjs (sub-tabs).
   Run: node tests/test-pine-tab.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    -', msg); }
  else { fail++; console.error('FAIL  -', msg); }
}

function stubEl(){
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', className: '', disabled: false, value: '',
    style: {},
    classList: {
      add(c){ classes.add(c); },
      remove(c){ classes.delete(c); },
      contains(c){ return classes.has(c); },
    },
    querySelector(sel){
      if (sel === 'i') return { style: { width: '0' } };
      return stubEl();
    },
    addEventListener(ev, fn){
      this._handlers = this._handlers || {};
      this._handlers[ev] = fn;
    },
    _handlers: {},
  };
}

function freshPane(){
  const stubs = {};
  return {
    pane: {
      _html: '',
      set innerHTML(v){ this._html = v; },
      get innerHTML(){ return this._html; },
      querySelector(sel){
        if (!stubs[sel]) stubs[sel] = stubEl();
        return stubs[sel];
      },
    },
    stubs,
  };
}

function mkRows(n, start, step){
  const rows = [];
  let prev = start;
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    rows.push({ t: i * 3600, o: prev, h: Math.max(prev, c) + 1, l: Math.min(prev, c) - 1, c, v: 1000 + i });
    prev = c;
  }
  return rows;
}

async function waitFor(cond, ms){
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < (ms || 15000)) await new Promise(r => setTimeout(r, 25));
  return cond();
}

function makeDocument(){
  const body = {
    _kids: [],
    appendChild(el){ this._kids.push(el); return el; },
    removeChild(el){
      const i = this._kids.indexOf(el);
      if (i >= 0) this._kids.splice(i, 1);
      return el;
    },
  };
  return {
    body,
    createElement(){
      const p = freshPane().pane;
      p.style = {};
      p.remove = function(){ body.removeChild(this); };
      return p;
    },
  };
}

function loadPineTab(extra){
  const ctx = vm.createContext(Object.assign({
    window: {},
    console,
    Math, JSON, Date, isFinite, parseInt, String, Object, Array, Promise,
    setTimeout, clearTimeout,
    localStorage: { getItem(){ return null; }, setItem(){} },
    document: makeDocument(),
  }, extra || {}));
  ctx.window = ctx;
  ctx.globalThis = ctx;
  for (const f of ['pinemath.js', 'pinegate.js', 'setup-stack.js', 'setup-ui.js', 'pine.js']){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

console.log('== registration + catalog ==');
const W = loadPineTab();
{
  ok(Array.isArray(W.HG_tabs) && W.HG_tabs.some(t => t.id === 'pine'), 'HG_tabs registers pine tab');
  ok(Array.isArray(W.HG_warmups) && W.HG_warmups.some(w => w.id === 'pine'), 'HG_warmups registers pine warm');
  ok(Array.isArray(W.PINE_SCRIPTS) && W.PINE_SCRIPTS.length === 10, 'PINE_SCRIPTS lists 10 strategies');
  ok(typeof W.pineWarm === 'function' && typeof W.pineScan === 'function', 'pineWarm + pineScan exported');
}

const tab = W.HG_tabs.find(t => t.id === 'pine');
ok(tab && typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'pine tab mount + refresh hooks');

console.log('== mount smoke ==');
{
  const pane = freshPane();
  W.hgSetupDeskBannerHTML = () => '<div class="desk-banner">PINE desk</div>';
  W.hgSetupInjectStyles = () => {};
  tab.mount(pane.pane);
  ok(pane.pane._html.indexOf('CRYPTO PINE') >= 0, 'mount renders CRYPTO PINE heading');
  ok(pane.pane._html.indexOf('id="pineRun"') >= 0, 'mount includes RUN ALL PINE SCAN button');
  ok(pane.pane._html.indexOf('id="pineOut"') >= 0, 'mount includes pineOut container');
  const desk = pane.stubs['#pineDesk'];
  ok(desk && desk.innerHTML.indexOf('desk-banner') >= 0, 'mount fills setup desk banner');
}

console.log('== refresh before run ==');
{
  const skipped = await tab.refresh();
  ok(skipped === 'skipped: not run yet', 'pineRefresh skips before first scan');
}

console.log('== scan empty universe ==');
{
  const pane = freshPane();
  W.pineGateLive = () => ({ eligible: [], funnel: {}, missing: ['edge-empty'] });
  W.edgeWarm = async () => 'warmed';
  W.cryptoScanWarm = async () => 'warmed';
  W.hgDeskLoadDeltaCoinDCX = async () => ({ items: [] });
  W.hgFunnelPanelHTML = (title) => '<div class="funnel">' + title + '</div>';
  W.pineFunnelRows = () => [];
  tab.mount(pane.pane);
  const btn = pane.stubs['#pineRun'];
  ok(typeof btn._handlers.click === 'function', 'pineRun click handler wired');
  btn._handlers.click();
  ok(await waitFor(() => pane.stubs['#pineStat'].textContent.indexOf('done') >= 0, 5000),
    'empty scan completes (stat reaches done)');
  const out = pane.stubs['#pineOut'];
  ok(out.innerHTML.indexOf('No Pine universe') >= 0, 'empty universe shows honest copy');
  const stat = pane.stubs['#pineStat'];
  ok(stat.textContent.indexOf('0 eligible') >= 0, 'stat line reports 0 eligible');
}

console.log('== scan with gated universe ==');
{
  const pane = freshPane();
  W.pineGateLive = () => ({
    eligible: [{ sym: 'BTCUSD', dir: 'long', edgeTicket: true, gateHits: 3 }],
    funnel: { edge: 1 },
    missing: [],
  });
  W.getCandles = async () => mkRows(300, 100, 0.05);
  W.hgFunnelPanelHTML = (title) => '<div class="funnel">' + title + '</div>';
  W.pineFunnelRows = () => [];
  W.sendTelegram = () => {};
  tab.mount(pane.pane);
  pane.stubs['#pineRun']._handlers.click();
  ok(await waitFor(() => pane.stubs['#pineStat'].textContent.indexOf('done') >= 0, 20000),
    'gated scan completes');
  const out = pane.stubs['#pineOut'];
  ok(typeof out.innerHTML === 'string' && out.innerHTML.length > 0, 'pineOut populated after scan');
  ok(/PINE UNIVERSE|No Pine script match|CLEAN ·|FORMING ·|ALIGNED ·/.test(out.innerHTML),
    'renderPineOut section headers present');
  const snap = W.pineScan();
  ok(snap && Array.isArray(snap.signals), 'pineScan snapshot after run');
  const again = await tab.refresh();
  ok(again === 'refreshed' || again === 'busy', 'pineRefresh reruns after first scan');
}

console.log('== pineWarm headless mount ==');
{
  const warmW = loadPineTab();
  const warmTab = warmW.HG_tabs.find(t => t.id === 'pine');
  warmW.pineGateLive = () => ({
    eligible: [{ sym: 'ETHUSD', dir: 'short', edgeTicket: true }],
    funnel: { edge: 1 },
    missing: [],
  });
  warmW.getCandles = async () => mkRows(280, 200, -0.04);
  warmW.hgFunnelPanelHTML = () => '';
  warmW.pineFunnelRows = () => [];
  warmW.sendTelegram = () => {};
  const warmStatus = await warmW.pineWarm({ quiet: true, force: true });
  ok(warmStatus === 'refreshed' || warmStatus === 'warmed', 'pineWarm completes on headless document pane');
  ok(warmW.pineScan() && warmW.pineScan().signals, 'pineWarm leaves pineScan snapshot');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
