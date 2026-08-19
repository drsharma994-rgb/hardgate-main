/* HARDGATE — brain was the last plan-producing tab outside the forward log.

   The forward log is the only measurement in this app that accumulates, and
   every desk's self-knowledge rests on it. Brain produces entry, stop and
   target for PRIME and HIGH calls — plans it builds itself through
   smartSetup, hgPlanLevels, swingTryClean and the gold setup path — and,
   until this change, never found out whether any of them worked.

   It was deliberately left last, and test-engine-forward.mjs named it as
   outstanding rather than quietly done, because brain is not the simple case
   engine was: it PREFERS the gate engine's survivors when they exist, and
   those plans are already recorded under the EXECUTE tab. Recording them
   again under BRAIN would count the same trade twice, and a double-counted
   forward log is worse than none — it is confident noise.

   THE OVERLAP IS RESOLVED BY PROVENANCE. normalizePlan stamps src on every
   plan it returns — 'gate engine', 'smartSetup', 'hgPlanLevels',
   'swingTryClean SWING', 'gold setup'. The recorder skips src === 'gate
   engine' and records everything brain built itself, keyed by that source
   (BRAIN-SMARTSETUP, BRAIN-HGPLANLEVELS, ...) so each plan engine accumulates
   its own record rather than pooling into one undifferentiated number.

   PRIME and HIGH only — the tiers brain presents as actionable. The ticket
   flag marks PRIME, so the log can later separate "brain's strongest calls"
   from "brain's calls".

   Run: node tests/test-brain-forward.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const BRAIN = read('brain.js');

console.log('== the recording exists, in the right place ==');
{
  ok(/hgFwdRecordScan\('BRAIN', '4h', fwdOwn/.test(BRAIN), 'brain records through the shared batch recorder');
  ok(/RECORD WHAT BRAIN CALLED, SO IT CAN BE HELD TO IT/.test(BRAIN), 'and records why');
  ok(BRAIN.indexOf("hgFwdRecordScan('BRAIN'") < BRAIN.indexOf('/* render */'),
     'it runs after planning and re-bucketing, before render');
  ok(/hgFwdWarn\('brain:forward'/.test(BRAIN), 'failures go through the shared warn channel');
  ok(/catch \(eFwdB\)/.test(BRAIN), 'inside its own catch — instrumentation must never break a scan');
}

console.log('\n== the EXECUTE overlap is excluded by provenance ==');
{
  ok(/if \(fp\.src === 'gate engine'\) continue;/.test(BRAIN),
     "src === 'gate engine' is skipped — EXECUTE already holds that trade");
  ok(/EXECUTE already holds it/.test(BRAIN), 'with the reason inline');
  /* The provenance stamp really exists where the plans are made. */
  ok(/normalizePlan\(p, 'gate engine'\)/.test(BRAIN), "normalizePlan stamps 'gate engine' on engine plans");
  ok(/'smartSetup'/.test(BRAIN) && /'hgPlanLevels'/.test(BRAIN), 'and names the fallback engines');
  ok(/src: src,/.test(BRAIN), 'and carries src on every normalized plan');
}

console.log('\n== each of brain\'s own engines accumulates its own record ==');
{
  ok(/mechanic: \('BRAIN-' \+ String\(fp\.src \|\| 'own'\)/.test(BRAIN),
     'the mechanic key is derived from the plan source');
  ok(/toUpperCase\(\)/.test(BRAIN.slice(BRAIN.indexOf("('BRAIN-'"), BRAIN.indexOf("('BRAIN-'") + 300)),
     'normalised to upper case');
  ok(/\.slice\(0, 24\)/.test(BRAIN), 'and capped at the forward log\'s key length');
  ok(/ticket: fr\.dec\.tier === 'PRIME'/.test(BRAIN),
     'PRIME is the ticket flag, so strongest calls are separable later');
}

console.log('\n== the filter admits only placeable, actionable calls ==');
{
  const i = BRAIN.indexOf("hgFwdRecordScan('BRAIN'");
  const block = BRAIN.slice(Math.max(0, i - 1600), i);
  ok(/if \(!fr \|\| !fr\.plan \|\| !fr\.sym \|\| !fr\.dec\) continue;/.test(block),
     'no plan, no symbol or no decision is skipped');
  ok(/fr\.dec\.dir !== 'long' && fr\.dec\.dir !== 'short'/.test(block), 'a direction that is not long/short is skipped');
  ok(/!isFinite\(fe\) \|\| !isFinite\(fs\) \|\| !isFinite\(ft\) \|\| fe === fs/.test(block),
     'and any non-finite level or entry===stop');
  ok(/Array\.isArray\(setups\)/.test(block), 'it iterates setups — PRIME and HIGH, the actionable tiers');
  ok(!/watches/.test(block) && !/asides/.test(block),
     'never the watch list or the aside ledger — considered is not presented');
}

console.log('\n== behavioural: the recorder produces the intended pool ==');
{
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('hg-forward.js'), ctx, { filename: 'hg-forward.js' });

  /* Reproduce exactly what the brain loop builds from a mixed setups list. */
  const setups = [
    { sym: 'BTCUSDT', dec: { dir: 'long', tier: 'PRIME' },
      plan: { src: 'gate engine', entry: 60000, stop: 58000, t1: 64000 } },     /* EXECUTE's */
    { sym: 'ETHUSDT', dec: { dir: 'long', tier: 'PRIME' },
      plan: { src: 'smartSetup', entry: 3000, stop: 2900, t1: 3200 } },
    { sym: 'SOLUSDT', dec: { dir: 'short', tier: 'HIGH' },
      plan: { src: 'hgPlanLevels', entry: 200, stop: 210, t1: 180 } },
    { sym: 'XAU', dec: { dir: 'long', tier: 'HIGH' },
      plan: { src: 'gold setup', entry: 4400, stop: 4360, t1: 4480 } },
    { sym: 'BAD1', dec: { dir: 'long', tier: 'PRIME' }, plan: null },
    { sym: 'BAD2', dec: { dir: 'sideways', tier: 'PRIME' },
      plan: { src: 'smartSetup', entry: 1, stop: 2, t1: 3 } },
    { sym: 'BAD3', dec: { dir: 'long', tier: 'PRIME' },
      plan: { src: 'smartSetup', entry: 5, stop: 5, t1: 6 } }
  ];
  const fwdOwn = [];
  for (const fr of setups){
    if (!fr || !fr.plan || !fr.sym || !fr.dec) continue;
    const fp = fr.plan;
    if (fp.src === 'gate engine') continue;
    if (fr.dec.dir !== 'long' && fr.dec.dir !== 'short') continue;
    const fe = +fp.entry, fs = +fp.stop, ft = +fp.t1;
    if (!isFinite(fe) || !isFinite(fs) || !isFinite(ft) || fe === fs) continue;
    fwdOwn.push({ sym: fr.sym, dir: fr.dec.dir, entry: fe, stop: fs, t1: ft,
      mechanic: ('BRAIN-' + String(fp.src || 'own').toUpperCase()
                  .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')).slice(0, 24),
      ticket: fr.dec.tier === 'PRIME' });
  }
  ok(fwdOwn.length === 3, 'three of seven qualify (' + fwdOwn.length + ') — engine plan and malformed rows excluded');
  const n = ctx.hgFwdRecordScan('BRAIN', '4h', fwdOwn, { horizonBars: 20 });
  ok(n === 3, 'all three record (' + n + ')');
  ok(ctx.hgFwdStats('BRAIN', 'BRAIN-SMARTSETUP', false).open === 1, 'smartSetup has its own pool');
  ok(ctx.hgFwdStats('BRAIN', 'BRAIN-HGPLANLEVELS', false).open === 1, 'hgPlanLevels has its own');
  ok(ctx.hgFwdStats('BRAIN', 'BRAIN-GOLD-SETUP', false).open === 1, 'and the gold path its own');
  ok(ctx.hgFwdStats('BRAIN', null, false).open === 3, 'the tab total is exactly the three');
  /* The EXECUTE trade must NOT be in the BRAIN pool. */
  ok(ctx.hgFwdStats('BRAIN', 'BRAIN-GATE-ENGINE', false).open === 0,
     'nothing recorded under a gate-engine key — no double count');
  /* And a rescan inside the same bar adds nothing. */
  ok(ctx.hgFwdRecordScan('BRAIN', '4h', fwdOwn, { horizonBars: 20 }) === 0,
     'a rescan inside the same bar records nothing');
  /* ticket flag: PRIME separable from HIGH. */
  const tix = ctx.hgFwdStats('BRAIN', null, true);
  ok(tix.open === 1, 'ticket-only view holds just the PRIME call (' + tix.open + ')');
}

console.log('\n== the outstanding-item marker is resolved, honestly ==');
{
  const EF = read('tests/test-engine-forward.mjs');
  ok(/hgFwdRecord/.test(BRAIN), 'brain now records');
  /* test-engine-forward asserted brain did NOT record; that assertion must
     have been updated, not deleted wholesale. */
  ok(!/ok\(!\/hgFwdRecord\/\.test\(BRAIN\)/.test(EF),
     'test-engine-forward no longer asserts brain is unmeasured');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL BRAIN FORWARD-LOG TESTS PASSED');
