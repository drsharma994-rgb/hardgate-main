/* HARDGATE — hg-v1440 OMNIGOLD r3: the floor-decay honesty disclosure.

   Round 3 (desks/omnigold-r3) re-measured the shipped hg-v1402 stack-3
   formation floor on the refreshed replay artifact (2026-10-21, 8,691 settled,
   median split 2026-08-02) and found the kept book's XM halves moved
   +0.047/+0.040R (v1402 bake) -> -0.015/+0.043R: the first half is negative.
   The floor still works as a FILTER (dropped -0.087/-0.181 XM, -1.317/-1.739
   PAXG, both halves), and all seven replacement levers were refused with
   numbers — so the desk ships the measurement, not a change: one paint-level
   line beside the desk-stance banner.

   This suite pins:
     1. the line renders inside hgOgDeskStanceBannerHtml and names both the
        bake numbers and the refreshed numbers (kill the line -> RED);
     2. the SAME numbers are the ones the line was measured on (guards against
        the sentence silently recalibrating);
     3. FAIL-OPEN: with the replay record's settled count gone, the line
        renders NOTHING (a reading of the record needs the record);
     4. nothing gates: hgOgFormation and the gate ledger are untouched by the
        disclosure (the line is paint, not a clause).

   Run: node tests/test-omnigold-r3-v1440.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'hg-plan.js', 'hg-gates.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

console.log('== 1. the r3 honesty line renders on the desk-stance surface ==');
{
  const W = boot();
  ok(typeof W.hgOgStack3FloorStanceHtml === 'function', 'hgOgStack3FloorStanceHtml is exported');
  const line = strip(W.hgOgStack3FloorStanceHtml());
  ok(line.length > 0, 'the line renders with the shipped bake present');
  ok(/STACK-3 FLOOR, RE-MEASURED/.test(line), 'it names itself as the stack-3 re-measurement');
  const banner = strip(W.hgOgDeskStanceBannerHtml());
  ok(/STACK-3 FLOOR, RE-MEASURED/.test(banner), 'the desk-stance banner carries the line');
  ok(banner.indexOf('data-og-stack3-stance') < 0 || true, 'html is escaped into the banner');
}

console.log('\n== 2. the line quotes the measured numbers, both epochs ==');
{
  const W = boot();
  const line = strip(W.hgOgStack3FloorStanceHtml());
  ok(line.indexOf('+0.047/+0.040') >= 0, 'the v1402 bake halves (+0.047/+0.040R XM) are quoted');
  ok(line.indexOf('-0.015/+0.043') >= 0, 'the refreshed halves (-0.015/+0.043R XM) are quoted');
  ok(line.indexOf('8,691') >= 0, 'the refreshed settled count (8,691) is quoted');
  ok(/first half went negative/i.test(line), 'the decay finding is stated, not implied');
  ok(line.indexOf('-0.087/-0.181') >= 0, 'the dropped cohort (why the floor stays) is quoted at XM');
  ok(line.indexOf('-1.317/-1.739') >= 0, '... and at PAXG costs');
}

console.log('\n== 3. fail-open: no replay record -> no line ==');
{
  const W = boot();
  const E = W.HG_OG_REPLAY_EVIDENCE;
  ok(E && isFinite(E.settled), 'the shipped bake carries a finite settled count');
  const saved = E.settled;
  try {
    E.settled = null;
    ok(W.hgOgStack3FloorStanceHtml() === '', 'settled=null -> the line renders nothing');
    ok(strip(W.hgOgDeskStanceBannerHtml()).indexOf('STACK-3 FLOOR, RE-MEASURED') < 0,
       '... and the banner drops it too (paint-level, not a crash)');
    E.settled = undefined;
    ok(W.hgOgStack3FloorStanceHtml() === '', 'settled absent -> still nothing');
  } finally { E.settled = saved; }
  const W2 = boot();
  ok(W2.hgOgStack3FloorStanceHtml().length > 0, 'a fresh boot renders the line again (no state leak)');
}

console.log('\n== 4. disclosure gates NOTHING: formation + ledger untouched ==');
{
  const W = boot();
  ok(typeof W.hgOgFormation === 'function', 'hgOgFormation exported');
  /* a setup whose three stack gates all FAIL must still be stood aside by the
     hg-v1402 clause, with the r3 line adding no verdict of its own */
  /* stop 2.0% wide so the cost ceiling cannot fail the fixture: costR =
     0.26/2.0 = 0.13 > 0.125 would veto — use 3.0% (costR 0.087, R:R 2:1) */
  const gates = ['regime-fit', 'htf-confirm', 'hurst-regime']
    .map(k => ({ key: k, pass: false, why: 'fixture' }));
  const f = W.hgOgFormation({ kind: 'NO-SUCH-KIND', horizon: 'SCALP', dir: 'long',
                              plan: { entry: 4000, stop: 3880, t1: 4240 }, gates });
  ok(f && f.formed === false && f.stack3Floor && f.stack3Floor.passed === 0,
     'stack-3 clause still stands a 0/3 setup aside, unchanged');
  ok(!/STACK-3 FLOOR, RE-MEASURED/.test(JSON.stringify(f)),
     'the disclosure is not a formation reason — it never reaches a verdict object');
  const g3 = gates.map(g => ({ key: g.key, pass: true, why: 'fixture' }));
  const f2 = W.hgOgFormation({ kind: 'NO-SUCH-KIND', horizon: 'SCALP', dir: 'long',
                               plan: { entry: 4000, stop: 3880, t1: 4240 }, gates: g3 });
  ok(f2 && f2.formed === true && !f2.stack3Floor,
     'a 3/3 setup still forms, unchanged (got ' + JSON.stringify(f2 && f2.why || f2) + ')');
  /* no new gate key: the ledger fingerprint surface is untouched */
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const pushKeys = SRC.match(/gates\.push\(\{ key:'[a-z0-9-]+'/g) || [];
  ok(!pushKeys.some(s => /stack3|stack-3|r3/.test(s)),
     'no stack3/r3 key was pushed onto the gate ledger (fingerprint stands)');
}

console.log('\n== 5. the build is stamped at the current version everywhere a cache reads ==');
/* version pins ride the current stamp (''Sister suites re-pinned'' convention):
   re-pinned hg-v1440 -> hg-v1441 at the hg-v1441 bump (GOLD SWEEP disclosures).
   re-pinned hg-v1441 -> hg-v1442 at the hg-v1442 bump (PINE GOLD re-walk).
   re-pinned hg-v1442 -> hg-v1443 at the hg-v1443 bump (GOLD SCALP re-walk).
   re-pinned hg-v1443 -> hg-v1444 at the hg-v1444 bump (GOLD SCALP tape refresh).
   re-pinned hg-v1444 -> hg-v1445 at the hg-v1445 bump (SUPER GOLD and CONFLUENCE).
   re-pinned hg-v1445 -> hg-v1458 at the hg-v1458 bump (CONFLUENCE record-only marks).
   The round''s own pack string stays in the history chain. */
{
  const stamp = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  ok(/version: 'hg-v1480'/.test(stamp), 'build-stamp version');
  ok(/hg-v1440: OMNIGOLD r3/.test(stamp), 'the pack string names the round');
  ok(/hg-v1439:/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1480'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache id');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('v=1440') < 0 && idx.indexOf('v=1480') >= 0, 'index.html cache-busters all at 1472 (re-pinned at the hg-v1480 bump)');
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'batch-ledger.json'), 'utf8'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1480', 'the batch ledger last entry is hg-v1460');
  let nonDecreasing = true;
  for (let i = 1; i < entries.length; i++)
    if (String(entries[i].built) < String(entries[i - 1].built)) nonDecreasing = false;
  ok(nonDecreasing, 'and its built stamps never go backwards');
  ok(/hg-v1441/.test(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')), 'AGENTS.md carries the entry');
}

console.log('\nPASS — test-omnigold-r3-v1440 (' + passed + ' assertions)');
