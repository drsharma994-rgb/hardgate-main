/* HARDGATE — OMNIGOLD loss floor.

   The desk was logically busy and still issued tickets a gold book should
   not take: a mechanic whose own walk-forward said "has not paid", a fade
   into a daily rally, a volatility stop inside session noise, a yield
   verdict computed for LONG then reused on shorts, and a swing hold across
   the Friday close.

   Min-loss policy (hard gates unchanged; these sit AFTER them):
     1. yield is judged per setup DIRECTION
     2. a below-breakeven mechanic at 20+ samples VETOES (no 20–29 free pass)
     3. fading the daily stack is enough to stand the trade aside
     4. a MOMENTUM / volatility stop is AGAINST (info) — the ticket stands,
        otherwise a runaway tape has no placeable structure and the desk
        shows no TICKET. STRONGEST prefers a structural ticket, then falls
        back to the labelled vol-stop rather than leaving the desk empty.
     5. gold weekend is a veto when the scan says it is in the closure
     6. scalp cost-drag ceiling stays 0.15R (sessionHard)

   Run: node tests/test-omnigold-min-loss.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');

function boot(extraFiles){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                 'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']
                 .concat(extraFiles || []);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const W = boot();

function tape(n, seed, drift){
  const out = []; let p = 4000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - drift) * 0.004);
    const r = p * 0.0012 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
}
const ROWS = tape(400, 3, 0.50);
const U = (y, m, d, h) => Math.floor(Date.UTC(y, m, d, h) / 1000);
const gate = (key, hit, extra) =>
  (W.hgOgGates(ROWS, hit, extra || {}) || []).filter(g => g && g.key === key)[0];

console.log('== 1. yield is judged per direction, never a shared LONG verdict ==');
{
  const longSpike = { valid: false, reason: 'MACRO VETO: US10Y Yields are spiking. Do not buy Gold.' };
  ok(gate('yield-guard', { dir: 'short', kind: 'MMOVE' }, { yield: longSpike }).pass === false,
     'the old shared LONG yield object still reads as a boolean when supplied');

  const rows10yUp = [];
  let y = 4.2;
  for (let i = 0; i < 10; i++){ y += 0.05; rows10yUp.push({ t: 1700000000 + i * 86400, o: y, h: y, l: y, c: y, v: 1 }); }
  const gLong = gate('yield-guard', { dir: 'long', kind: 'MMOVE' }, { yieldRows: rows10yUp });
  const gShort = gate('yield-guard', { dir: 'short', kind: 'MMOVE' }, { yieldRows: rows10yUp });
  ok(gLong && gLong.pass === false, 'rising yields VETO a gold LONG (got ' + (gLong && gLong.pass) + ')');
  ok(gShort && gShort.pass === true, 'rising yields SUPPORT a gold SHORT — the same rows, opposite side');
  ok(/validateYieldCorrelation/.test(GOLD) === false || /yieldRows/.test(GOLD),
     'the scan no longer freezes a long-only yieldGuard for every setup');
  ok(/us10yRows, 'long'/.test(GOLD) === false, 'runScan does not call validateYieldCorrelation(..., "long")');
}

console.log('\n== 2. a losing mechanic at 20+ samples VETOES, it does not TICKET ==');
{
  const thin = gate('measured-edge', { dir: 'long', kind: 'POC-REVERT' },
                    { stats: { samples: 22, hit: 0.18, expR: -0.45 }, minRr: 1.5 });
  ok(thin.pass === false, '22 samples at -2σ is a VETO (was info AGAINST that still ticketed)');
  ok(thin.info !== true, 'it is NOT an info gate — info cannot stop a ticket');
  ok(/has not paid|below breakeven/.test(thin.why), 'and says the mechanic has not paid: ' + thin.why.slice(0, 90));

  const tiny = gate('measured-edge', { dir: 'long', kind: 'POC-REVERT' },
                    { stats: { samples: 10, hit: 0.18, expR: -0.45 }, minRr: 1.5 });
  ok(tiny.pass === null, 'under 20 samples stays UNCHECKED — too few to judge, not a fabricated pass');

  const clean = [{ key: 'trend', hard: true, pass: true, why: 'ok' },
                 { key: 'vol-alive', hard: true, pass: true, why: 'ok' }];
  ok(W.hgOmniGrade(clean.concat([thin])).ticket === false,
     'hgOmniGrade will not TICKET a 22-sample losing mechanic');
}

console.log('\n== 3. fading the daily stack is enough to stand aside ==');
{
  const g = gate('fade-strength', { dir: 'short', kind: 'POC-REVERT' },
                 { htf: { e21: 4400, e50: 4300 } });
  ok(g.pass === false, 'POC-REVERT SHORT against a rising daily stack is VETOED');
  ok(/daily stack/.test(g.why), 'naming the daily rally, which is what "shorts in a rally" means: ' + g.why.slice(0, 90));

  const withDaily = gate('fade-strength', { dir: 'long', kind: 'POC-REVERT' },
                         { htf: { e21: 4400, e50: 4300 } });
  ok(withDaily.pass !== false, 'the same daily UP does not veto a LONG fade — it is not fighting the rally');
}

console.log('\n== 4. a volatility stop is AGAINST — the continuation ticket still stands ==');
{
  const m = gate('momentum-stop', { dir: 'long', kind: 'ORB' },
                 { plan: { entry: 4300, stop: 4270, t1: 4345, momentumStop: true } });
  ok(m.pass === false && m.info === true, 'momentum-stop is an AGAINST note, not a ticket-killer');
  const graded = W.hgOmniGrade([
    { key: 'trend', hard: true, pass: true, why: 'ok' },
    { key: 'vol-alive', hard: true, pass: true, why: 'ok' },
    { key: 'momentum-stop', hard: false, info: m.info, pass: false, why: m.why }
  ]);
  ok(graded.ticket === true, 'a labelled volatility-stop plan can still grade TICKET');
  ok(graded.notes && graded.notes.indexOf('momentum-stop') >= 0,
     'the compromise is named on the ticket (got notes=' + JSON.stringify(graded.notes) + ')');

  const ranked = [
    { horizon: 'SCALP', kind: 'ORB', dir: 'long', grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
      plan: { entry: 4300, stop: 4270, t1: 4345, momentumStop: true },
      consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] } },
    { horizon: 'SCALP', kind: 'MMOVE', dir: 'long', grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
      plan: { entry: 4300, stop: 4240, t1: 4420 },
      consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] } }
  ];
  const pick = W.hgOgPickFor(ranked, 'SCALP');
  ok(pick && pick.kind === 'MMOVE', 'STRONGEST pick prefers the structural ticket over a vol-stop');

  /* v420 left the desk empty on a runaway gold trend: fades vetoed by
     daily-stack, continuation vetoed (and then skipped) because the only
     placeable stop was a labelled vol stop. The user then saw "no setup
     with ticket". When the only remaining ticket IS that continuation,
     pick it — empty is the defect. */
  const onlyVol = [
    { horizon: 'SWING', kind: 'ORB', dir: 'long', grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
      plan: { entry: 4300, stop: 4270, t1: 4345, momentumStop: true },
      consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] } },
    { horizon: 'SWING', kind: 'POC-REVERT', dir: 'short', grade: { ticket: false, vetoes: ['fade-strength'], evaluated: 40, total: 47 },
      plan: { entry: 4300, stop: 4320, t1: 4240 },
      consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] } }
  ];
  const swingPick = W.hgOgPickFor(onlyVol, 'SWING');
  ok(swingPick && swingPick.kind === 'ORB' && swingPick.plan.momentumStop === true,
     'when the only ticket is a labelled vol-stop continuation, STRONGEST still picks it');
  ok(/labelled VOLATILITY \/ MOMENTUM stop/.test(GOLD),
     'STRONGEST card names the vol-stop compromise so the reader is not sold a structural stop');
}

console.log('\n== 5. gold weekend is a veto when the scan is inside the closure ==');
{
  const wk = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' },
                  { nowSec: U(2026, 7, 8, 12), sessionHard: false });
  ok(wk && wk.pass === false, 'Saturday 12:00 UTC VETOES a swing ticket');
  ok(/weekend|closure|closed/i.test(wk.why), 'and says it is the gold weekend: ' + (wk.why || '').slice(0, 90));

  const scalpWk = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' },
                       { nowSec: U(2026, 7, 8, 12), sessionHard: true });
  ok(scalpWk && scalpWk.pass === false, 'the same closure also vetoes a scalp — spot is not live');

  const thu = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' },
                   { nowSec: U(2026, 7, 6, 14), sessionHard: false });
  ok(thu && thu.pass === true, 'Thursday afternoon is not the weekend');

  const friSwing = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' },
                        { nowSec: U(2026, 7, 7, 20), sessionHard: false });
  ok(friSwing && friSwing.pass === false, 'Friday 20:00 UTC VETOES a swing — the close is inside one 4h bar');
  const friScalp = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' },
                        { nowSec: U(2026, 7, 7, 20), sessionHard: true });
  ok(friScalp && friScalp.pass === true, 'Friday 20:00 scalp still has a live book for two hours');

  const none = gate('weekend-exposure', { dir: 'long', kind: 'MMOVE' }, {});
  ok(none && none.pass === null, 'with no clock the gate is UNCHECKED, never a quiet pass');

  ok(/hgOgDetect\(rows,\s*\{\s*nowSec:\s*shared\.nowSec\s*\}\)/.test(GOLD),
     'detect uses the scan clock so Asia/prior-day boxes are not dated off a stale last bar');
}

console.log('\n== 6. scalp cost-drag vetoes a stop the spread would eat ==');
{
  const tight = gate('cost-drag', { dir: 'long', kind: 'MMOVE' },
                     { planRisk: 3.16, sessionHard: true });
  ok(tight.pass === false, 'the live 3.16-point scalp stop is vetoed — 19% of 1R was paying the spread');
  const swing = gate('cost-drag', { dir: 'long', kind: 'MMOVE' },
                    { planRisk: 3.16, sessionHard: false });
  ok(swing.pass === true, 'the same stop on SWING still passes (wider horizon, different cost bar)');
  const wide = gate('cost-drag', { dir: 'long', kind: 'MMOVE' },
                   { planRisk: 12, sessionHard: true });
  ok(wide.pass === true, 'a $12 scalp stop still clears cost-drag');
}

console.log('\n== 7. ShieldGuard, when loaded, can veto; when absent it is UNCHECKED ==');
{
  const absent = gate('shield-guard', { dir: 'long', kind: 'MMOVE' }, {});
  ok(absent && absent.pass === null, 'without ShieldGuard the gate is UNCHECKED, not a pass');
  ok(/not loaded|not judged|unavailable/i.test(absent.why), 'and says why: ' + absent.why);
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD MIN-LOSS TESTS PASSED');
