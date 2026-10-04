/* HARDGATE — hg-v1065: THE PERFECT COHORT + WORLD TILT SPLITS.

   The normalize comment has waited since hg-v1030 for the split that asks
   whether the PERFECT / PERFECT+ cohort settles differently from the rest.
   Now it exists — plus the WORLD TILT split over the macro-tilt marks the
   world-feeds pack (hg-v1064) writes. Both render on the shared forward
   panel of every recording desk, and both are reported, never gated.

   Run: node tests/test-omnibtc-perfect-split-v1065.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  vm.runInContext(read('hg-forward.js'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

console.log('== the PERFECT cohort split measures the badges, not the promise ==');
{
  const W = boot();
  const recs = [
    { state: 't1', rr: 2, perfect: true, perfectPlus: true },
    { state: 't1', rr: 2, perfect: true, perfectPlus: true },
    { state: 'stop', rr: 2, perfect: true, perfectPlus: true },
    { state: 't1', rr: 1.5, perfect: true },
    { state: 'stop', rr: 1.5, perfect: true },
    { state: 't1', rr: 2 },
    { state: 'stop', rr: 2 },
    { state: 'expired', rr: 2, perfect: true }   /* excluded: not settled t1/stop */
  ];
  const html = W.hgFwdPerfectSplitHtml(recs);
  ok(html.indexOf('PERFECT COHORT') >= 0, 'the panel prints');
  ok(/PERFECT\+ - n 3 \. hit 67% \. \+1\.00R/.test(html), 'the PERFECT+ cell counts and grades correctly (2W/1L)');
  ok(/PERFECT - n 2 \. hit 50% \. \+0\.25R/.test(html), 'the PERFECT cell grades separately');
  ok(html.indexOf('REST - n 2') >= 0, 'the unmarked rest is its own bucket');
  ok(html.indexOf('of 7 settled records') >= 0, 'the settled total excludes the expired row');
  ok(html.indexOf('Reported, not gated') >= 0, 'the honesty line prints');
}

console.log('== the world tilt split reads the fire-time marks ==');
{
  const W = boot();
  const recs = [
    { state: 't1', rr: 2, macroTilt: 'RISK-ON' },
    { state: 'stop', rr: 2, macroTilt: 'RISK-ON' },
    { state: 't1', rr: 2, macroTilt: 'RISK-OFF' },
    { state: 'stop', rr: 2, macroTilt: 'RISK-OFF' },
    { state: 't1', rr: 2 }
  ];
  const html = W.hgFwdMacroTiltSplitHtml(recs);
  ok(html.indexOf('WORLD TILT ODDS') >= 0, 'the panel prints');
  ok(/RISK-ON - n 2 \. hit 50% \. \+0\.50R/.test(html), 'the RISK-ON cell grades correctly');
  ok(/RISK-OFF - n 2 \. hit 50% \. \+0\.50R/.test(html), 'the RISK-OFF cell grades correctly');
  ok(html.indexOf('NEITHER - n 1') >= 0, 'the unmarked record is named NEITHER');
}

console.log('== honest empties ==');
{
  const W = boot();
  ok(W.hgFwdPerfectSplitHtml([{ state: 't1', rr: 2 }]) === '', 'no mark, no panel - an absent measurement, not a clean bill');
  ok(W.hgFwdMacroTiltSplitHtml([{ state: 't1', rr: 2 }]) === '', 'same for the tilt');
}

console.log('== wiring pins ==');
{
  const src = read('hg-forward.js');
  ok(src.indexOf('function hgFwdPerfectSplit') >= 0 && src.indexOf('function hgFwdMacroTiltSplit') >= 0, 'both splits are defined');
  ok(src.indexOf("W.hgFwdPerfectSplitHtml(tab)") >= 0 && src.indexOf("W.hgFwdMacroTiltSplitHtml(tab)") >= 0, 'both render on the shared forward panel');
  ok(src.indexOf('macroTilt: (rec.macroTilt === \'RISK-ON\'') >= 0, 'the tilt mark survives normalization (enum whitelist)');
  ok(src.indexOf('wmMacroVerdict: (typeof rec.wmMacroVerdict') >= 0, 'the WM verdict mark survives normalization');
}

console.log('\ntest-omnibtc-perfect-split-v1065: ' + passed + ' passed, 0 failed');
