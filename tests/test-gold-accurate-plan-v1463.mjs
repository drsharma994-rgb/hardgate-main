#!/usr/bin/env node
/* hg-v1463 — the max-accuracy plan on GOLD SCALP and GOLD PINE.
   Entry is the next open ± cost. The signal close is not the fill.
   Stop is beyond the swept wick. Target is the desk multiple of that risk.
   A gap through the stop, a same-bar stop, a hit target, and a stop pulled
   in to the ATR ceiling do not print. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  FAIL ' + m); } };

const window = {};
vm.createContext(window);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gold-best-levels.js'), 'utf8'), window, { filename: 'gold-best-levels.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib/hg-gold-accurate-plan.js'), 'utf8'), window, { filename: 'hg-gold-accurate-plan.js' });
const planOf = window.hgGoldAccuratePlan;
ok(typeof planOf === 'function', 'hgGoldAccuratePlan is exported');

function bar(t, o, h, l, c){ return { t: t, o: o, h: h, l: l, c: c }; }
function tape(){
  const t0 = 1760000000;
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push(bar(t0 + i * 900, 100, 101.2, 99.6, 100.4));
  const spike = rows.length - 1;
  rows[spike] = bar(rows[spike].t, 100, 108, 99.6, 100.5);
  const sigT = rows[rows.length - 1].t + 900;
  const signal = bar(sigT, 100.1, 100.8, 99.2, 100.2);
  const form = bar(sigT + 900, 100.3, 100.7, 100.25, 100.45);
  return { rows: rows.concat([signal, form]), signal: signal, form: form, nowMs: (sigT + 900 + 40) * 1000 };
}

const spec = { cost: 0.30, swingBars: 8, securityAtr: 0.25, triggerLookback: 2,
  minRiskAtr: 0.5, maxRiskAtr: 3.5, rewardR: 1.5, rewardR2: 2.5, minRr: 1.2, chaseFrac: 0.85 };

console.log('== a reclaim fills at the next open, not the signal close ==');
{
  const t = tape();
  const p = planOf(t.rows, Object.assign({ nowMs: t.nowMs }, spec));
  ok(p && p.ok === true, 'plan ok (' + (p && p.reason) + ')');
  ok(p.dir === 'long', 'long');
  ok(p.entry !== t.signal.c, 'entry is not the signal close');
  ok(Math.abs(p.entry - Math.round((t.form.o + 0.30) * 100) / 100) < 1e-9, 'entry is the next open plus cost, on the tick');
  ok(p.stop < t.signal.l, 'stop is beyond the swept wick');
  ok(p.stop < p.entry && p.t1 > p.entry, 'long geometry');
  const risk = p.entry - p.stop;
  ok(Math.abs(p.t1 - (p.entry + 1.5 * risk)) < 1e-6, 'TP1 is exactly 1.5R');
  ok(Math.abs(p.t2 - (p.entry + 2.5 * risk)) < 1e-6, 'TP2 is exactly 2.5R');
  ok(Math.abs(p.rr - 1.5) < 1e-6, 'published R is 1.5');
  ok(p.geometryOk === true, 'sealed');
  ok(p.signalClose === t.signal.c, 'the signal close is recorded and is not the entry');
}

console.log('== pine 2R is its own multiple, and a gap through the stop is not a trade ==');
{
  const t = tape();
  const pine = planOf(t.rows, Object.assign({}, spec, { nowMs: t.nowMs, rewardR: 2, rewardR2: null, maxRiskAtr: 3, minRr: 1.2 }));
  ok(pine && pine.ok === true, 'pine plan ok (' + (pine && pine.reason) + ')');
  ok(Math.abs(pine.rr - 2) < 1e-6, 'pine target is exactly 2R');
  ok(pine.t2 == null, 'pine does not invent a second target');
  const gapped = t.rows.slice();
  gapped[gapped.length - 1] = bar(t.form.t, 90, 90.2, 89, 90.1);
  const g = planOf(gapped, Object.assign({ nowMs: t.nowMs }, spec));
  ok(g && g.ok === false && /gap through the stop/.test(g.reason || ''), 'gap through the stop does not print (' + (g && g.reason) + ')');
}

console.log('== no next open, a stop already traded, and a ceiling clamp do not print ==');
{
  const t = tape();
  const closed = t.rows.slice(0, -1);
  const unread = planOf(closed, Object.assign({ nowMs: (closed[closed.length - 1].t + 5000) * 1000 }, spec));
  ok(unread && unread.ok === false && /next open unread/.test(unread.reason || ''), 'next open unread (' + (unread && unread.reason) + ')');
  ok(unread.entry == null, 'no fabricated entry');
  const stopped = t.rows.slice();
  const f = stopped[stopped.length - 1];
  stopped[stopped.length - 1] = bar(f.t, f.o, f.h, 1, f.c);
  const s = planOf(stopped, Object.assign({ nowMs: t.nowMs }, spec));
  ok(s && s.ok === false && /through the stop/.test(s.reason || ''), 'same-bar stop does not print (' + (s && s.reason) + ')');
  const wide = t.rows.slice();
  const sig = wide[wide.length - 2];
  wide[wide.length - 2] = bar(sig.t, sig.o, sig.h, 40, sig.c);
  const w = planOf(wide, Object.assign({ nowMs: t.nowMs }, spec));
  ok(w && w.ok === false && /not pulled in/.test(w.reason || ''), 'a stop past the ATR ceiling is not clamped (' + (w && w.reason) + ')');
}

console.log('== a short is the mirror, and the signal close is still not the fill ==');
{
  const t0 = 1760000000;
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push(bar(t0 + i * 900, 100, 100.8, 99.2, 100.1));
  const spike = rows.length - 1;
  rows[spike] = bar(rows[spike].t, 100, 100.8, 92, 99.8);
  const sigT = rows[rows.length - 1].t + 900;
  const signal = bar(sigT, 100.2, 101.4, 99.9, 100.3);
  const form = bar(sigT + 900, 100.6, 100.7, 100.2, 100.4);
  const p = planOf(rows.concat([signal, form]), Object.assign({ nowMs: (sigT + 900 + 40) * 1000 }, spec));
  ok(p && p.ok === true, 'short ok (' + (p && p.reason) + ')');
  ok(p.dir === 'short', 'short');
  ok(Math.abs(p.entry - Math.round((form.o - 0.30) * 100) / 100) < 1e-9, 'short entry is the next open minus cost');
  ok(p.stop > signal.h && p.stop > p.entry && p.t1 < p.entry, 'short geometry');
  ok(Math.abs(p.rr - 1.5) < 1e-6, 'short R is 1.5');
}

console.log('== the desks call this plan and do not un-demote the measured losers ==');
{
  const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  const gp = fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8');
  ok(/function gsApplyAccurateLead\(/.test(gs), 'scalp applies the accuracy plan');
  ok(/maxRiskAtr: 3\.5, rewardR: 1\.5, rewardR2: 2\.5/.test(gs), 'scalp keeps 1.5R / 2.5R and the 3.5×ATR ceiling');
  ok(/if \(displayBest && \(displayBest\.demoted \|\| displayBest\.vetoed\)\) displayBest = null;/.test(gs),
    'a demoted detector is still not the lead');
  ok(/stratKey: 'accurate'/.test(gs), 'the structure plan is its own card, not a promoted detector');
  ok(!/asian[\s\S]{0,80}demoted = false/.test(gs), 'Asian cards are not un-demoted here');
  ok(/function gpAccuratePack\(/.test(gp), 'pine builds the accuracy plan');
  ok(/maxRiskAtr: 3, rewardR: 2/.test(gp), 'pine targets 2R and drops risk wider than 3×ATR');
  ok(/gpAdmissionFloor\(s\)/.test(gp.slice(gp.indexOf('function gpAccuratePack'), gp.indexOf('function gpSgnR'))),
    'a pine scalp plan still faces the 0.3% admission floor before it can lead');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.includes('lib/hg-gold-accurate-plan.js?v='), 'index loads the planner');
}

console.log(fail ? ('FAIL ' + fail + ' / ' + (pass + fail)) : ('PASS ' + pass));
process.exit(fail ? 1 : 0);
