/* HARDGATE — CHART VISION tab wiring + gate filter helpers (offline). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tabJs = fs.readFileSync(path.join(root, 'chartvision-tab.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

console.log('== chartvision tab wiring ==');
{
  ok(html.indexOf('chartvision-tab.js') >= 0, 'index loads chartvision-tab.js');
  ok(/chartvision-tab\.js/.test(sw), 'sw shell lists chartvision-tab.js');
  ok(/hg-v248/.test(sw), 'cache hg-v248');
  ok(/chartvision/.test(html) && html.indexOf("'chartvision'") >= 0, 'HG_NAV_GROUPS includes chartvision');
  ok(/HG_tabs\.push\(\{ id: 'chartvision'/.test(tabJs), 'registers chartvision tab');
  ok(/cvEvalSwing/.test(tabJs) && /m\.passed < 6/.test(tabJs), 'filters below 6/7');
  ok(/hgChartVisionEnrichDeskRows/.test(tabJs), 'async chart vision enrich');
  ok(/sequential:\s*true/.test(tabJs), 'sequential chart vision enrich');
  ok(/shown\.length/.test(tabJs) && !/VISION_LIMIT/.test(tabJs), 'enriches all shown cards');
  ok(/hgChartVisionSvgBlock|visionSvg/.test(tabJs), 'tab shows server vision chart');
  ok(/6\/7 NEAR \+ 7\/7 CLEAN/.test(tabJs), 'tab describes gate tiers');
}

console.log('== mount smoke ==');
{
  const sandbox = {
    console, setTimeout, clearTimeout,
    document: {
      querySelector: function(){ return null; },
      createElement: function(){ return { style: {}, appendChild: function(){}, setAttribute: function(){}, addEventListener: function(){} }; }
    },
    HG_tabs: []
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'chart-vision-desk.js'), 'utf8'), ctx, { filename: 'chart-vision-desk.js' });
  vm.runInContext(tabJs, ctx, { filename: 'chartvision-tab.js' });
  ok(Array.isArray(sandbox.HG_tabs) && sandbox.HG_tabs.some(function(t){ return t && t.id === 'chartvision'; }),
    'HG_tabs includes chartvision after load');
  const mod = sandbox.HG_tabs.find(function(t){ return t && t.id === 'chartvision'; });
  const el = {
    innerHTML: '', querySelector: function(sel){
      if (sel === '#cvRun') return { addEventListener: function(){}, disabled: false };
      if (sel === '#cvStat') return { textContent: '', className: 'note' };
      if (sel === '#cvCards') return { innerHTML: '' };
      if (sel === '#cvEmpty') return { style: { display: 'none' } };
      if (sel === '#cvFunnel') return { innerHTML: '' };
      if (sel === '#cvProg') return { style: { display: 'none' }, firstElementChild: { style: {} } };
      if (sel === '#cvStyle') return { value: 'swing' };
      if (sel === '#cvVenue') return { value: 'ALL' };
      return null;
    }
  };
  let threw = null;
  try{ mod.mount(el); }catch(e){ threw = e; }
  ok(!threw, 'mount does not throw');
  ok(typeof mod.refresh === 'function', 'refresh exported');
}

console.log('\n' + pass + ' passed, 0 failed');
