/* HARDGATE — GOLD PRO judged setups on a candle that was still changing.

   An audit for the dead-levels bug class found its inverse. The tabs that
   drop the forming candle (the OMNI desks, EDGE) price entries off stale
   closes — fixed in v395-v397. The tabs that DON'T drop it compute their
   indicators on a bar that is minutes old and still moving. GOLD PRO was the
   gold-desk offender: its 4H EMA20/50/100 cascade — the read that DECIDES
   whether a setup exists — plus ATR and the swing stop were computed on rows
   containing the forming candle, and its daily EMA50/200 structure reads had
   the same flaw at daily scale.

   That is repainting. A cascade read LONG at 14:05 can be MIXED by the 16:00
   close: the tab shows a setup that later was never there. "The app shows
   wrong setups" is exactly what that produces, and the app's own OMNI desks
   document closed-bars-only as the convention for precisely this reason.

   THE SPLIT, same as the OMNI desks: the forming close is kept apart as the
   LIVE price — the right number for the entry and the dead-on-arrival check,
   the wrong number for every indicator.

     indicators (cascade, ATR, swing, daily structure)  <- closed bars only
     entry                                              <- the live price
     stop                                               <- closed-bar structure
     market already beyond that stop                    <- no plan, says why

   Run: node tests/test-goldpro-closed-bars.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PRO = read('goldpro.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout, fetch: () => Promise.reject(new Error('offline')),
                AbortController };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','goldpro.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

console.log('== the closed-bars helper behaves ==');
{
  ok(/function goldProClosed\(rows, tf\)/.test(PRO), 'goldProClosed exists');
  ok(/window\.hgOmniDropForming === 'function'/.test(PRO),
     'and prefers the shared sanitiser when it is loaded');
  /* No skip branch: the export exists precisely so this block always runs —
     the vacuity guard caught the first version silently skipping. */
  ok(typeof W.goldProClosed === 'function', 'goldProClosed is exported');
  const helper = W.goldProClosed;
  {
    const now = Math.floor(Date.now() / 1000);
    const closed = { t: now - 14400 * 3, o:1, h:2, l:0.5, c:1.5, v:1 };
    const forming = { t: now - 600, o:1, h:2, l:0.5, c:1.6, v:1 };   /* 10 min into a 4h bar */
    const out = helper([closed, forming], '4h');
    ok(out.length === 1, 'the forming 4h candle is dropped (' + out.length + ' of 2 kept)');
    ok(out[0].t === closed.t, 'and the closed one survives');
    const old = { t: now - 14400 * 2, o:1, h:2, l:0.5, c:1.5, v:1 };
    ok(helper([closed, old], '4h').length === 2, 'a fully closed pair is untouched');
    ok(helper([], '4h').length === 0, 'an empty series does not throw');
    ok(helper(null, '4h').length === 0, 'nor does null');
    const dailyForming = { t: now - 3600 * 5, o:1, h:2, l:0.5, c:1.6, v:1 };
    ok(helper([closed, dailyForming], '1d').length === 1, 'a 5-hour-old daily candle is forming and dropped');
  }
}

console.log('\n== indicators read closed bars; the entry reads the live price ==');
{
  ok(/var lvLive = \+lvRows\[lvRows\.length - 1\]\.c;/.test(PRO),
     'the live close is captured first');
  ok(PRO.indexOf('var lvLive =') < PRO.indexOf("lvRows = goldProClosed(lvRows, '4h')"),
     'BEFORE the series is closed, or it would be gone');
  ok(/lvRows = goldProClosed\(lvRows, '4h'\);/.test(PRO),
     'then every indicator reads the closed series');
  const cascadeIdx = PRO.indexOf('lvCascade = (lclose > le20');
  ok(cascadeIdx > PRO.indexOf("goldProClosed(lvRows, '4h')"),
     'the cascade is computed after the close, so it cannot repaint intrabar');
  ok(/var lvEntry = \(isFinite\(lvLive\) && lvLive > 0\) \? lvLive : lclose;/.test(PRO),
     'the entry is the live price, falling back to the last closed close');
  ok(/entry: lvEntry/.test(PRO), 'and the plan uses it');
  ok(/invalidation is structure,\s*\n?\s*not the old close/.test(PRO) || /stop stays on closed-bar structure/i.test(PRO),
     'while the stop stays on closed-bar structure, with the reason recorded');
}

console.log('\n== dead on arrival produces no plan, and says why ==');
{
  ok(/var lvDead = \(lvCascade === 'long'\) \? \(lvLive <= \+lvPlan\.stop\) : \(lvLive >= \+lvPlan\.stop\);/.test(PRO),
     'the check is direction-aware');
  ok(/levels dead on arrival — the market \(/.test(PRO), 'the reason quotes the market price');
  ok(/already beyond the structural stop/.test(PRO), 'and names the stop it crossed');
  ok(/lvPlan = null;/.test(PRO), 'and the plan is withdrawn rather than drawn');
}

console.log('\n== daily structure is judged on closed bars too ==');
{
  ok(/structureState\(goldProClosed\(g1d\.rows, '1d'\), goldProClosed\(g4h\.rows, '4h'\)\)/.test(PRO),
     'structureState receives closed daily and 4h series');
  ok(!/structureState\(g1d\.rows, g4h\.rows\)/.test(PRO), 'the raw-rows call is gone');
  ok(/forming daily candle can\s*\n?\s*put price on the other side of the 50\/200/.test(PRO),
     'with the failure mode recorded inline');
}

console.log('\n== the reason this landed is recorded ==');
{
  ok(/CLOSED CANDLES ONLY/.test(PRO), 'the convention is named');
  ok(/repaints/.test(PRO), 'and the repainting failure mode');
  ok(/Same split the OMNI desks use/.test(PRO), 'tying it to the house convention');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLDPRO CLOSED-BARS TESTS PASSED');
