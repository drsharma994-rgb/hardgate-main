/* HARDGATE — no gate may answer a fault with a pass.

   Found by sweeping for the SHAPE, the way v335 was: every catch block in the
   app whose body returns a pass-like value — `return true`, `{ ok: true }`,
   `{ veto: false }`, `{ allow: true }`. The sweep returns 19. Seven are
   localStorage preference readers (tabAlertsShouldRun, bookAutoOn and
   friends) where defaulting to enabled is a UX choice, not a trade decision;
   those are left alone deliberately. Two were already fixed in v329. The rest
   are gates, and the worst is hgFormTicket:

       }catch(e){ return { ok: true, hit: hit, formationScore: 0 }; }

   `hit` is the RAW input. On any exception the formation pipeline reported
   SUCCESS and handed back the thing it was asked to form — no POI entry, no
   sweep or structure stop, no structure targets, no fill gate, and no
   hgTicketFinalGates run against it — and all four callers read ok:true as
   "formation succeeded".

   Run: node tests/test-gates-fail-open.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function load(files, extra){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of files){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  if (extra) vm.runInContext(extra, ctx, { filename: 'extra' });
  return ctx;
}

const W = load(['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js', 'best-levels.js', 'formation.js']);

console.log('== THE BIG ONE: a thrown formation is not a formed ticket ==');
{
  /* Make the pipeline throw where it cannot be caught internally: a rows
     array whose length is real but whose bars explode on access. */
  const landmine = { length: 300, get 299(){ throw new Error('rows exploded'); } };
  for (let i = 0; i < 299; i++) landmine[i] = { t: i, o: 1, h: 1, l: 1, c: 1, v: 1 };

  const hit = { dir: 'long', sym: 'ETHUSDT', entry: 100, stop: 98, t1: 110, t2: 120, rr1: 9, mark: 100 };
  const res = W.hgFormTicket(hit, { rows: landmine, style: 'swing' });

  ok(res && typeof res === 'object', 'hgFormTicket still returns an object rather than throwing');
  if (res.ok === false){
    ok(true, 'a thrown formation reports ok:false (' + String(res.reason).slice(0, 60) + ')');
    ok(res.tag === 'formation', 'and tags itself as a formation failure');
  } else {
    /* It got far enough to form legitimately — then the invariant still holds. */
    ok(res.hit !== hit, 'if it succeeded it returned a formed plan, not the raw input object');
  }

  const src = fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8');
  ok(!/\}catch\(e\)\{ return \{ ok: true, hit: hit, formationScore: 0 \}; \}/.test(src),
    'the ok:true-with-raw-hit catch is gone from the source');
  ok(/return \{ ok: false, reason: 'formation threw: '/.test(src),
    'the catch now reports the failure it actually had');
}

console.log('\n== all four callers already handle a declined formation ==');
{
  /* The fix is only safe because every caller has a !ok path. Pin that. */
  const callers = {
    'best-levels.js': /if \(fm && fm\.ok && fm\.hit && blValidPlan/,
    'gold-best-levels.js': /if \(!gfm \|\| !gfm\.ok \|\| !gfm\.hit\)/,
    'squeeze.js': /if \(fm && fm\.ok && fm\.hit && sqValidSetup/,
    'trendtable.js': /if \(fm && fm\.ok && fm\.hit && tmValidSetup/
  };
  for (const [f, re] of Object.entries(callers)){
    ok(re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f + ' guards on fm.ok before using the plan');
  }
}

console.log('\n== the final gates report UNCHECKED rather than a clean pass ==');
{
  const landmine = { get dir(){ throw new Error('plan exploded'); } };
  const res = W.hgTicketFinalGates(landmine, {});
  ok(res && res.ok === true, 'a fault does not veto the ticket');
  ok(res.unchecked === true, 'but it reports UNCHECKED (was a bare ok:true)');
  ok((res.chips || []).indexOf('FINAL GATES UNCHECKED') >= 0, 'and carries a chip the card can show');
  ok(/plan exploded/.test(res.uncheckedReason || ''), 'the real fault reaches the reason');

  const good = W.hgTicketFinalGates({ dir: 'long', sym: 'ETHUSDT', entry: 100, stop: 98, t1: 106 }, {});
  ok(good && good.ok === true && !good.unchecked, 'a gate that genuinely ran is not marked unchecked');
}

console.log('\n== permission gates say when they could not check ==');
{
  const boom = { get length(){ throw new Error('rows exploded'); } };
  const r1 = W.hgRegimeAllowsSetup(boom, 'swing');
  ok(r1 && r1.allow === true, 'regime gate does not block on a fault');
  ok(r1.unchecked === true, 'regime gate reports UNCHECKED');
  ok(/threw/.test(r1.reason || ''), 'and names the fault');
}

console.log('\n== ShieldGuard: a veto that could not run is not "no veto" ==');
{
  const boom = { length: 50, get 49(){ throw new Error('bar exploded'); } };
  for (let i = 0; i < 49; i++) boom[i] = { o: 1, h: 1, l: 1, c: 1, v: 1 };
  const res = W.hgShieldGuardVeto ? W.hgShieldGuardVeto(boom, 'long', 1) : null;
  if (res){
    ok(res.veto === false, 'a fault does not fabricate a veto');
    ok(res.unchecked === true || res.checked === true, 'the result says whether the check actually ran');
  }
  const src = fs.readFileSync(path.join(ROOT, 'structure-levels.js'), 'utf8');
  ok(!/\}catch\(e\)\{ return \{ veto: false \}; \}/.test(src), 'the bare veto:false catch is gone');
  ok(/unchecked: true,\s*\n\s*reason: 'ShieldGuard threw/.test(src), 'it reports the fault instead');
}

console.log('\n== flow assessors distinguish "disagreed" from "never ran" ==');
{
  const sp = fs.readFileSync(path.join(ROOT, 'spot-perp.js'), 'utf8');
  const br = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
  ok(/veto: false, unchecked: true, reason: '', spotPerpAligned: false/.test(sp), 'spotPerpFlowAssess marks unchecked');
  ok(/veto: false, unchecked: true, reason: '', cvdAligned: false/.test(br), 'flowTrapAssess marks unchecked');
}

console.log('\n== permissive booleans are no longer silent about it ==');
{
  /* These keep their permissive verdict on purpose — failing closed on a
     transient fault would suppress real setups — but the fault is now
     recorded rather than swallowed. */
  const edge = fs.readFileSync(path.join(ROOT, 'edge.js'), 'utf8');
  const brob = fs.readFileSync(path.join(ROOT, 'brainrobust.js'), 'utf8');
  ok(/setup admitted unchecked/.test(edge), 'isCorrectivePullback records that it admitted a setup unchecked');
  ok(/hgFwdWarn/.test(edge), 'and routes it through the warning channel');
  ok(/row treated as confirmed/.test(brob), 'brainRowPlanConfirmed records the same');
}

console.log('\n== the sweep itself: no NEW gate may fail open silently ==');
{
  /* Re-run the sweep over shipped source and hold the count. Preference
     readers are named explicitly so a new one has to be added deliberately. */
  const ALLOWED = new Set([
    'shouldRun', 'bookAutoOn', 'tabAlertsShouldRun', 'tabAlertsGoldSeparateEnabled',
    'tabAlertsGoldConvictedOnlyEnabled', 'tabAlertsCryptoConvictedOnlyEnabled',
    'tabAlertsCleanOnlyEnabled', 'familyEvOk'
  ]);
  const catchRe = /catch\s*\(\s*\w*\s*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*?)\}/g;
  const passRe = /return\s+(true\b|\{[^}]*\b(?:ok|pass|allow|valid|clean)\s*:\s*true|\{[^}]*\bveto\s*:\s*false)/;
  const offenders = [];
  let scanned = 0;
  for (const f of fs.readdirSync(ROOT).filter(x => x.endsWith('.js') && x !== 'sw.js')){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let m;
    catchRe.lastIndex = 0;
    while ((m = catchRe.exec(src))){
      const body = m.group ? m.group(1) : m[1];
      if (!passRe.test(body)) continue;
      scanned++;
      if (/unchecked/.test(body) || /hgFwdWarn/.test(body)) continue;   /* honest about it */
      const names = src.slice(0, m.index).match(/function\s+(\w+)\s*\(/g) || [];
      const fn = names.length ? names[names.length - 1].replace(/function\s+/, '').replace(/\s*\($/, '') : '?';
      if (ALLOWED.has(fn)) continue;
      offenders.push(f + ':' + (src.slice(0, m.index).split('\n').length) + ' ' + fn);
    }
  }
  ok(scanned >= 15, 'the sweep reached the catch blocks (' + scanned + ' pass-shaped) — not vacuous');
  if (offenders.length) console.error('\n  gates answering a fault with a silent pass:\n    ' + offenders.join('\n    '));
  ok(offenders.length === 0, 'no gate answers a fault with a silent pass (' + offenders.length + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FAIL-OPEN GATE TESTS PASSED');
