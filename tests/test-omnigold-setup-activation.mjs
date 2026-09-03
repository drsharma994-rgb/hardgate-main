/* HARDGATE — OMNIGOLD setup activation confirmation.

   Field request: "in omnigold tab it should tell me the setup activated
   or not with confirmation".

   TOP SETUP already either paints a gate-ledger winner or says standing
   aside. That is easy to miss, and WATCH / engine / against-tape cards
   look like a setup even when nothing is activated.

   This pack adds a confirmed verdict:
     SETUP ACTIVATED · CONFIRMED   — gate-passed, formed, level-fresh,
                                     tape-aligned TICKET (same pick TOP
                                     SETUP already uses)
     SETUP NOT ACTIVATED · CONFIRMED — scan ran; no such ticket (or
                                     levels stale / DOA)
     SETUP NOT ACTIVATED · UNCONFIRMED — no scan yet

   Never invents a ticket. Never flips dir. Never loosens the tape rule
   (shorts stay held on an UP tape; longs stay held on a DOWN tape).
   Engine A/B and WATCH rows are not an activation.

   Run: node tests/test-omnigold-setup-activation.mjs */
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
    dir: 'long',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 3390, stop: 3370, t1: 3430, t2: 3460, rr1: 2.0 },
    distAtr: 0.4,
    formation: { formed: true },
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [
      { key: 'level-fresh', pass: true, why: 'level-fresh passed at scan time' },
      { key: 'ema-stack', info: true, pass: true }
    ]
  }, over || {});
}

function check(act, key){
  return (act.checks || []).find(c => c && c.key === key) || null;
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgOgSetupActivation === 'function', 'hgOgSetupActivation exported');
  ok(typeof W.hgOgSetupActivationHtml === 'function', 'hgOgSetupActivationHtml exported');
  ok(typeof W.hgOgTopSetupPanelHtml === 'function', 'TOP SETUP panel still exported');
}

console.log('\n== no scan is NOT ACTIVATED · UNCONFIRMED ==');
{
  const W = boot();
  const act = W.hgOgSetupActivation(null, NaN);
  ok(act && act.activated === false, 'not activated');
  ok(act.state === 'NOT_ACTIVATED', 'state NOT_ACTIVATED');
  ok(act.confirm === 'UNCONFIRMED', 'unconfirmed until a scan runs');
  ok(/no scan/i.test(act.why), 'why names the missing scan: ' + act.why);
  ok(check(act, 'scan') && check(act, 'scan').pass === false, 'scan check fails');
}

console.log('\n== gate-passed fresh ticket is ACTIVATED · CONFIRMED ==');
{
  const W = boot();
  const pick = ticket();
  const act = W.hgOgSetupActivation({ pickScalp: pick, pickSwing: null, tape: 'long', held: null }, 3392);
  ok(act.activated === true, 'activated');
  ok(act.state === 'ACTIVATED', 'state ACTIVATED');
  ok(act.confirm === 'CONFIRMED', 'confirmed');
  ok(act.pick === pick, 'same TOP SETUP pick — no invented ticket');
  ok(/LONG/.test(act.why) && /ORB/.test(act.why), 'why names dir + kind: ' + act.why);
  ok(check(act, 'ticket').pass === true, 'ticket confirmed');
  ok(check(act, 'formed').pass === true, 'formed confirmed');
  ok(check(act, 'level-fresh').pass === true, 'level-fresh confirmed');
  ok(check(act, 'tape').pass === true, 'tape confirmed');
}

console.log('\n== empty scan is NOT ACTIVATED · CONFIRMED (tape named) ==');
{
  const W = boot();
  const act = W.hgOgSetupActivation({ pickScalp: null, pickSwing: null, tape: 'long', held: null }, 3390);
  ok(act.activated === false, 'not activated when nothing cleared');
  ok(act.confirm === 'CONFIRMED', 'the non-activation is confirmed after a scan');
  ok(/going up/.test(act.why) && /SHORT is not the setup/.test(act.why),
     'why reuses the tape stand-aside copy: ' + act.why);
  ok(check(act, 'ticket').pass === false, 'ticket failed');
  ok(check(act, 'tape').pass === true, 'UP tape is a confirmed read, not a missing check');
}

console.log('\n== held opposite-side tickets stay NOT ACTIVATED ==');
{
  const W = boot();
  const held = { n: 2, level: 3410, from: 3390, tf: '1h' };
  const act = W.hgOgSetupActivation({ pickScalp: null, pickSwing: null, tape: 'long', held: held }, 3390);
  ok(act.activated === false, 'held shorts are not an activation on an UP tape');
  ok(/HELD/.test(act.why), 'why names the held queue: ' + act.why);
  ok(!/SETUP ACTIVATED/.test(W.hgOgSetupActivationHtml(act)),
     'banner never says ACTIVATED for a held opposite-side book');
}

console.log('\n== stale / DOA levels are NOT ACTIVATED ==');
{
  const W = boot();
  const stale = ticket({
    gates: [{ key: 'level-fresh', pass: false, info: true, why: 'levels stale at scan time' }]
  });
  const actS = W.hgOgSetupActivation({ pickScalp: stale, pickSwing: null, tape: 'long' }, 3392);
  ok(actS.activated === false, 'stale ticket is not activated');
  ok(actS.confirm === 'CONFIRMED', 'stale non-activation is confirmed');
  ok(check(actS, 'level-fresh').pass === false, 'level-fresh check fails');

  const doa = ticket({
    plan: { entry: 3390, stop: 3370, t1: 3430, t2: 3460, rr1: 2.0 }
  });
  const actD = W.hgOgSetupActivation({ pickScalp: doa, pickSwing: null, tape: 'long' }, 3300);
  ok(actD.activated === false, 'crossed-stop (DOA) is not activated');
  ok(actD.fresh && actD.fresh.doa === true, 'fresh read flags DOA');
}

console.log('\n== not-formed and engine/WATCH are never activated ==');
{
  const W = boot();
  const nf = ticket({ formation: { formed: false } });
  const actNf = W.hgOgSetupActivation({ pickScalp: nf, pickSwing: null, tape: 'long' }, 3392);
  ok(actNf.activated === false && !actNf.pick,
     'not-formed never reaches the activation pick (TOP SETUP already drops it)');

  const watch = ticket({ grade: { ticket: false, vetoes: ['trend'], evaluated: 20, total: 47 } });
  const actW = W.hgOgSetupActivation({ pickScalp: watch, pickSwing: null, tape: 'long' }, 3392);
  ok(actW.activated === false, 'WATCH is not an activation');

  const engine = ticket({
    enginePick: true, engineGrade: 'A',
    grade: { ticket: false, vetoes: [], evaluated: 0, total: 0 }
  });
  const actE = W.hgOgSetupActivation({ pickScalp: engine, pickSwing: null, tape: 'long' }, 3392);
  ok(actE.activated === false, 'gold-engine A is not an OMNIGOLD activation');
}

console.log('\n== banner HTML: loud confirmed yes / no ==');
{
  const W = boot();
  const yes = W.hgOgSetupActivationHtml(
    W.hgOgSetupActivation({ pickScalp: ticket(), pickSwing: null, tape: 'long' }, 3392)
  );
  ok(/data-og-activation="1"/.test(yes), 'banner tagged');
  ok(/data-og-activated="1"/.test(yes), 'activated flag on');
  ok(/SETUP ACTIVATED/.test(yes), 'says SETUP ACTIVATED');
  ok(/CONFIRMED/.test(yes), 'says CONFIRMED');
  ok(/role="status"/.test(yes) && /aria-live="polite"/.test(yes), 'live status for a screen reader');
  ok(/gpip ok/.test(yes), 'ok chip class');

  const no = W.hgOgSetupActivationHtml(
    W.hgOgSetupActivation({ pickScalp: null, pickSwing: null, tape: 'long' }, 3390)
  );
  ok(/SETUP NOT ACTIVATED/.test(no), 'says SETUP NOT ACTIVATED');
  ok(/data-og-activated="0"/.test(no), 'activated flag off');
  ok(/CONFIRMED/.test(no), 'non-activation is still confirmed after a scan');
  ok(!/SETUP ACTIVATED/.test(no.replace('NOT ACTIVATED', '')),
     'does not also claim ACTIVATED');

  const none = W.hgOgSetupActivationHtml(W.hgOgSetupActivation(null, NaN));
  ok(/UNCONFIRMED/.test(none), 'no-scan banner is UNCONFIRMED');
  ok(/SETUP NOT ACTIVATED/.test(none), 'no-scan is not activated');
}

console.log('\n== TOP SETUP panel paints the banner in every branch ==');
{
  const W = boot();
  const empty = W.hgOgTopSetupPanelHtml(null, NaN, NaN);
  ok(/data-og-activation="1"/.test(empty), 'no-scan panel includes the banner');
  ok(/SETUP NOT ACTIVATED/.test(empty) && /UNCONFIRMED/.test(empty),
     'no-scan panel confirms the miss');

  const aside = W.hgOgTopSetupPanelHtml({ pickScalp: null, pickSwing: null, tape: 'long', held: null }, 3390, Date.now());
  ok(/SETUP NOT ACTIVATED/.test(aside) && /CONFIRMED/.test(aside),
     'stand-aside panel confirms NOT ACTIVATED');
  ok(/going up/.test(aside), 'stand-aside still names the UP tape');

  const live = W.hgOgTopSetupPanelHtml(
    { pickScalp: ticket(), pickSwing: null, tape: 'long', held: null }, 3392, Date.now()
  );
  ok(/SETUP ACTIVATED/.test(live) && /CONFIRMED/.test(live),
     'winner panel confirms ACTIVATED');
  ok(/3390/.test(live), 'winner still prints the entry');
  ok(live.indexOf('data-og-activation') < live.indexOf('ENTRY'),
     'confirmation sits above the ticket levels');
}

console.log('\n== wiring + honesty + stamp ==');
{
  ok(/hgOgSetupActivation\(/.test(GOLD) && /hgOgSetupActivationHtml\(/.test(GOLD),
     'activation helpers are called, not just exported');
  ok(/hgOgTopSetupPanelHtml/.test(GOLD) && /hgOgSetupActivationHtml\(act\)/.test(GOLD),
     'TOP SETUP injects the banner');
  ok(!/invent/.test(GOLD.slice(GOLD.indexOf('function hgOgSetupActivation'),
                               GOLD.indexOf('function hgOgSetupActivation') + 800)) ||
     /never invent/i.test(GOLD),
     'activation copy refuses to invent a ticket');
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is a hg-vN version (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\npassed: ' + passed);
