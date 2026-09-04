/* HARDGATE — OMNIGOLD opposite-side tickets are shown, not erased.

   Field report (TOP SETUP on an UP tape):
     "No gate-passed setup at current price — standing aside. gold is
      going up — a SHORT is not the setup. Standing aside is the
      position when no long ticket cleared., why short setups are
      not shown?"

   THE RULE DOES NOT CHANGE. Against-tape shorts are not MOST PROBABLE
   and are never SETUP ACTIVATED (with-tape +0.121R vs against-tape
   −0.280R, z +9.79). What changes is visibility:

     - if SHORT tickets cleared the ledger, TOP SETUP lists them as
       HELD · NOT ACTIVATED with ENTRY / STOP / T1
     - if none cleared, the card says so — shorts are not hidden

   Never invents a short. Never flips dir. Never loosens G1–G7.

   Run: node tests/test-omnigold-opposite-shown.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function ticket(over){
  return Object.assign({
    horizon: 'SCALP',
    kind: 'ORB',
    dir: 'short',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 3410, stop: 3430, t1: 3370, t2: 3340, rr1: 2.0 },
    distAtr: 0.4,
    formation: { formed: true },
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [{ key: 'level-fresh', pass: true, why: 'level-fresh passed at scan time' }]
  }, over || {});
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgOgHeldCards === 'function', 'hgOgHeldCards exported');
  ok(typeof W.hgOgOppositeAsideHtml === 'function', 'hgOgOppositeAsideHtml exported');
  ok(typeof W.hgOgTopSetupPanelHtml === 'function', 'TOP SETUP still exported');
  ok(typeof W.hgOgPickFor === 'function', 'hgOgPickFor still exported');
}

console.log('\n== heldCards: opposite-side tickets only ==');
{
  const W = boot();
  const shortT = ticket();
  const longT = ticket({ dir: 'long', kind: 'MMOVE', plan: { entry: 3390, stop: 3370, t1: 3430, t2: 3460, rr1: 2 } });
  const watch = ticket({ dir: 'short', kind: 'PIN', grade: { ticket: false, vetoes: ['trend'], evaluated: 10, total: 47 } });
  const nf = ticket({ dir: 'short', kind: 'DEAD', formation: { formed: false } });
  const held = W.hgOgHeldCards([shortT, longT, watch, nf], 'long');
  ok(held.length === 1 && held[0] === shortT, 'UP tape holds the SHORT ticket only');
  ok(W.hgOgHeldCards([shortT, longT], 'short').length === 1
     && W.hgOgHeldCards([shortT, longT], 'short')[0] === longT,
     'DOWN tape holds the LONG ticket only');
  ok(W.hgOgHeldCards([shortT], '').length === 0, 'unread tape holds nothing (no side invented)');
  ok(W.hgOgHeldCards(null, 'long').length === 0, 'null list is empty, not a throw');
  ok(W.hgOgPickFor([shortT], 'SCALP', 'long') === null,
     'hgOgPickFor still refuses the short as the setup on an UP tape');
}

console.log('\n== empty opposite side is named, not implied ==');
{
  const W = boot();
  const why = W.hgOgMpNoneWhy('long', null);
  ok(/going up/.test(why) && /SHORT is not the setup/.test(why),
     'tape rule still named: ' + why);
  ok(/not hidden/i.test(why) && /No SHORT ticket cleared either/.test(why),
     'empty opposite side says shorts are not hidden: ' + why);
  ok(!/HELD/.test(why), 'does not invent a held count');

  const whyS = W.hgOgMpNoneWhy('short', null);
  ok(/No LONG ticket cleared either/.test(whyS) && /not hidden/i.test(whyS),
     'symmetric for longs on a DOWN tape');

  const heldWhy = W.hgOgMpNoneWhy('long', { n: 2, level: 3410, from: 3390, tf: '1h' });
  ok(/HELD/.test(heldWhy) && /all SHORT/.test(heldWhy),
     'when shorts exist the held count still prints');
  ok(!/not hidden/.test(heldWhy), 'does not claim they are missing when they are held');
}

console.log('\n== TOP SETUP lists held shorts with levels ==');
{
  const W = boot();
  const shortT = ticket();
  const html = W.hgOgTopSetupPanelHtml({
    pickScalp: null, pickSwing: null, tape: 'long',
    held: { n: 1, level: 3420, from: 3390, tf: '1h' },
    heldCards: [shortT]
  }, 3392, Date.now());
  ok(/SETUP NOT ACTIVATED/.test(html), 'still not activated');
  ok(/data-og-opposite="1"/.test(html), 'opposite-side panel tagged');
  ok(/HELD/.test(html) && /NOT ACTIVATED/.test(html), 'held shorts are labeled HELD / not activated');
  ok(/3410/.test(html) && /3430/.test(html) && /3370/.test(html),
     'ENTRY / STOP / T1 of the short are printed');
  ok(/ORB/.test(html) && /SHORT/.test(html), 'mechanic and side are named');
  ok(!/SETUP ACTIVATED/.test(html.replace(/NOT ACTIVATED/g, '')),
     'does not also claim ACTIVATED');
}

console.log('\n== TOP SETUP with no shorts says they are not hidden ==');
{
  const W = boot();
  const html = W.hgOgTopSetupPanelHtml({
    pickScalp: null, pickSwing: null, tape: 'long', held: null, heldCards: []
  }, 3390, Date.now());
  ok(/SETUP NOT ACTIVATED/.test(html), 'not activated');
  ok(/NO SHORT TICKET THIS SCAN|not hidden/i.test(html),
     'honest empty: shorts are not hidden');
  ok(!/3410/.test(html), 'does not invent a short entry');
}

console.log('\n== a live LONG still shows held shorts underneath ==');
{
  const W = boot();
  const longT = ticket({
    dir: 'long', kind: 'MMOVE',
    plan: { entry: 3390, stop: 3370, t1: 3430, t2: 3460, rr1: 2 }
  });
  const shortT = ticket();
  const html = W.hgOgTopSetupPanelHtml({
    pickScalp: longT, pickSwing: null, tape: 'long',
    held: { n: 1, level: 3420, from: 3390, tf: '1h' },
    heldCards: [shortT]
  }, 3392, Date.now());
  ok(/SETUP ACTIVATED/.test(html), 'LONG ticket is still the activation');
  ok(/MMOVE/.test(html) && /3390/.test(html), 'LONG levels remain the setup');
  ok(/3410/.test(html) && /HELD/.test(html), 'the short is still listed as held');
}

console.log('\n== card grid paints opposite-side tickets as cards ==');
{
  ok(!/String\(cCard\.dir \|\| ''\)\.toLowerCase\(\) !== deskTape/.test(GOLD),
     'card loop no longer skips opposite-side tickets');
  ok(/h \+= setupCard\(cCard\)/.test(GOLD), 'surviving cards still go through setupCard');
  const loop = GOLD.slice(GOLD.indexOf('var deadLines'), GOLD.indexOf('MEASURED-NEGATIVE KINDS'));
  ok(!/hgOgHeldQueueHtml\(heldCards/.test(loop),
     'card grid does not re-list held tickets as a dim queue once they are cards');
  const W = boot();
  ok(typeof W.hgOgSetupCard === 'function', 'setupCard is exported for the opposite-side card');
  const html = W.hgOgSetupCard(ticket(), 'long');
  ok(/AGAINST GOLD TAPE/.test(html), 'SHORT card on an UP tape is stamped AGAINST GOLD TAPE');
  ok(/3410/.test(html) && /3430/.test(html) && /3370/.test(html),
     'SHORT card prints ENTRY / STOP / T1');
  ok(/SHORT/.test(html) && /ORB/.test(html), 'SHORT mechanic is named on the card');
  ok(W.hgOgPickFor([ticket()], 'SCALP', 'long') === null,
     'painting the SHORT card does not make it the SCALP pick');
}

console.log('\n== wiring + honesty + stamp ==');
{
  ok(/heldCards:\s*hgOgHeldCards/.test(GOLD) || /heldCards:\s*hgOgHeldCards\(/.test(GOLD),
     'scan stamps heldCards onto the TOP SETUP view');
  ok(/ogHeld\.n = heldCards\.length/.test(GOLD),
     'held count matches the opposite-side list TOP SETUP paints');
  ok(/hgOgOppositeAsideHtml\(/.test(GOLD), 'TOP SETUP calls the opposite-side renderer');
  ok(/if \(!aligned\.length\) return null;/.test(GOLD),
     'hgOgPickFor still refuses to invent the other side');
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is a hg-vN version (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\npassed: ' + passed);
