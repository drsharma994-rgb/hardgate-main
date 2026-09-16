/* HARDGATE — a baked number is about the code that produced it.

   hg-v754 shipped a drawdown panel computed from a walk generated
   2026-09-12 — before GOLD_STOP_MIN_PCT and the hard venue-priced cost gate
   landed on 2026-09-16. It overstated the hole 2.2x at XM (18.3R against
   8.2R) and 8.5x at PAXG (83R against 9.8R), and NOTHING could have caught
   it: no test, no assertion, no line on the card. The number was simply
   about a different system than the one running.

   Two things here. The panel now quotes the ticket book with the CURRENT
   gates applied and labels itself a proxy. And the gate ledger's key list
   is baked alongside the evidence, so the next time a gate is added or
   removed the tab says so instead of quietly meaning something else.

   Run: node tests/test-omnigold-evidence-staleness.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, addEventListener(){} };
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'hg-plan.js', 'hg-gates.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

console.log('== the baked fingerprint IS this build\'s gate ledger ==');
{
  const live = [...SRC.matchAll(/gates\.push\(\s*\{\s*key\s*:\s*.([a-z0-9-]+)./g)].map(m => m[1]).sort();
  const baked = ctx.HG_OG_EVIDENCE_GATESET;
  ok(baked && Array.isArray(baked.keys), 'the fingerprint is exported');
  ok(live.length > 20, 'the ledger really has ' + live.length + ' gates');
  ok(baked.count === live.length, 'the baked count matches the live ledger (' + baked.count + ')');

  const added = live.filter(k => baked.keys.indexOf(k) < 0);
  const removed = baked.keys.filter(k => live.indexOf(k) < 0);
  if (added.length || removed.length){
    console.error('   added: ' + added.join(', '));
    console.error('   removed: ' + removed.join(', '));
  }
  ok(added.length === 0 && removed.length === 0,
     'and every key matches — if this fails, re-bake rather than editing the list');

  /* the two gates whose arrival caused the v754 defect must be IN it */
  ok(baked.keys.indexOf('stop-floor') >= 0, 'stop-floor is in the baked ledger');
  ok(baked.keys.indexOf('cost-drag') >= 0, 'cost-drag is too');
}

console.log('\n== the detector fires when the ledger moves, and only then ==');
{
  const S = ctx.hgOgEvidenceStale;
  const baked = ctx.HG_OG_EVIDENCE_GATESET.keys;

  ok(S(baked.slice()) === null, 'an identical ledger is not stale');
  ok(S(baked.slice().reverse()) === null, 'and order does not matter');

  const added = S(baked.concat(['brand-new-gate']));
  ok(added && added.added.indexOf('brand-new-gate') >= 0, 'an ADDED gate is detected');
  ok(added.removed.length === 0, 'without inventing a removal');

  const removed = S(baked.filter(k => k !== 'stop-floor'));
  ok(removed && removed.removed.indexOf('stop-floor') >= 0, 'a REMOVED gate is detected');
  ok(removed.added.length === 0, 'without inventing an addition');

  /* a missing observation is not a mismatch */
  ok(S(null) === null, 'no live ledger yields no claim');
  ok(S([]) === null, 'and neither does an empty one — silence, not a false alarm');
}

console.log('\n== the banner says what changed, and stays quiet today ==');
{
  ok(ctx.hgOgEvidenceStaleHtml() === '', 'with no live ledger captured yet the banner is silent');

  ok(typeof ctx.hgOgEvidenceStaleHtml === 'function', 'the renderer is exported');

  const st = ctx.hgOgEvidenceStale(ctx.HG_OG_EVIDENCE_GATESET.keys.concat(['new-gate']));
  ok(st && st.bakedFrom, 'a stale verdict names the walk it was baked from — ' + st.bakedFrom);
  ok(st.added.indexOf('new-gate') >= 0, 'and names the gate that appeared');
}

console.log('\n== the drawdown panel quotes the CURRENT gate set ==');
{
  const E = ctx.HG_OG_BOOK_EXPERIENCE;
  ok(E, 'the panel data is exported');
  ok(E.proxy === true, 'and marks itself a proxy rather than a measurement');
  ok(/v752/.test(E.gateSet), 'naming the gate set it belongs to — ' + E.gateSet);

  /* the v754 numbers were 18.3R at XM and 83R at PAXG, from the OLD ticket
     flag. Under the gates that actually run they are 8.2R and 9.8R. */
  ok(Math.abs(E.ticketsXm[2] - 8.21) < 0.05, 'XM drawdown is 8.2R, not the 18.3R v754 shipped');
  ok(Math.abs(E.ticketsPaxg[2] - 9.81) < 0.05, 'PAXG drawdown is 9.8R, not 83R');
  ok(E.ticketsXm[4] === 58, 'on 58 trades, not the 105 the old ticket flag counted');
  ok(E.ticketsPaxg[4] === 34, 'and 34 at PAXG');
  ok(E.ticketsXm[2] < 18.3 && E.ticketsPaxg[2] < 83,
     'both are SMALLER — the old numbers overstated the hole');

  const html = ctx.hgOgBookExperienceHtml();
  ok(/WHAT HOLDING IT FELT LIKE/.test(html), 'the panel renders');
  ok(/Proxy/.test(html), 'and says on the card that it is a proxy');
  ok(/not a re-walk/.test(html), 'naming precisely what it is not');
}

console.log('\n== the bake carries the same fingerprint ==');
{
  const j = JSON.parse(execFileSync(process.execPath,
    [path.join(ROOT, 'scripts', 'omnigold-evidence-bake.mjs'), '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  ok(j.gateFingerprint, 'the bake records a gate fingerprint');
  ok(j.gateFingerprint.count === ctx.HG_OG_EVIDENCE_GATESET.count,
     'and it agrees with the constant shipped in omnigold.js');
  ok(j.walkGenerated, 'the bake also records which walk it read — ' + String(j.walkGenerated).slice(0, 10));

  const cg = j.experience.sequentialTicketsCurrentGates;
  ok(cg && /PROXY/.test(cg.note), 'the current-gates book is labelled a proxy in the bake too');
  ok(Math.abs(cg.xm.maxDrawdownR - ctx.HG_OG_BOOK_EXPERIENCE.ticketsXm[2]) < 0.05,
     'and the shipped constant is the number the bake computes');
}

console.log('\n' + passed + ' passed, 0 failed');
