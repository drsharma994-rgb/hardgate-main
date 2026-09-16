/* HARDGATE — a ticket is a claim that the mechanic pays. Now it has to be.

   measured-edge has always vetoed a KNOWN failure. What it did not do was
   stand a setup aside when the answer is UNKNOWN: a soft gate lets a null
   verdict through, so the ticket issued and the card read UNCHECKED. That
   is how every OMNIGOLD ticket has ever been issued, because nothing in the
   ledger clears its bar — 54 mechanics, 0 clearing the 54-comparison
   significance bar, the best at +1.71 sigma against a bar near +2.9.

   OG_EDGE_PROOF_REQUIRED makes the gate hard, so unknown stands the setup
   aside like any other missing evidence. THE TICKET COLUMN EMPTIES. That is
   the intended effect and these tests pin it, along with the panel that
   explains the emptiness — an unexplained empty tab reads as a broken desk,
   and a reader who concludes that will go looking for the tickets
   somewhere less careful.

   Run: node tests/test-omnigold-edge-proof.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
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
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'hg-plan.js', 'hg-gates.js',
                 'omniroute.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

console.log('== the gate is hard, and it is one line to reverse ==');
{
  ok(/var OG_EDGE_PROOF_REQUIRED = true;/.test(SRC), 'the switch is a single named constant');
  ok(/key:'measured-edge', hard: OG_EDGE_PROOF_REQUIRED/.test(SRC),
     'and measured-edge takes its hardness from it rather than a literal');
  /* the rest of the ledger must not have been swept along with it */
  const hardKeys = [...SRC.matchAll(/key:'([a-z0-9-]+)', hard:\s*true/g)].map(m => m[1]);
  ok(hardKeys.indexOf('measured-edge') < 0, 'it is not ALSO hard-coded hard somewhere');
}

console.log('\n== what hard actually changes, through the real grader ==');
{
  const G = ctx.hgOmniGrade;
  ok(typeof G === 'function', 'hgOmniGrade is the shared grader, loaded from omniroute');

  const base = [{ key: 'trend', hard: true, pass: true, why: '' }];
  const withUnknown = h => base.concat([{ key: 'measured-edge', hard: h, pass: null, why: '' }]);

  ok(G(withUnknown(false)).ticket === true,
     'SOFT + unknown issued a ticket — that is how every ticket has ever been issued');
  ok(G(withUnknown(true)).ticket === false,
     'HARD + unknown does not');
  ok(G(withUnknown(true)).unknown.indexOf('measured-edge') >= 0,
     'and the card names it as missing data rather than dropping the setup silently');
  ok(/WATCH/.test(G(withUnknown(true)).verdict),
     'the setup reads WATCH — it keeps its levels and its reasoning');

  /* the half that did NOT change: a known failure always vetoed */
  const fail = h => base.concat([{ key: 'measured-edge', hard: h, pass: false, why: '' }]);
  ok(G(fail(false)).ticket === false && G(fail(true)).ticket === false,
     'a KNOWN failure vetoed before and vetoes now — hardness was never what did that');

  /* and a mechanic that proves itself still tickets */
  const pass = base.concat([{ key: 'measured-edge', hard: true, pass: true, why: '' }]);
  ok(G(pass).ticket === true, 'a mechanic that clears its bar still issues a ticket');
}

console.log('\n== the ledger, measured rather than asserted ==');
{
  const kinds = ctx.HG_OG_REPLAY_EVIDENCE.kinds;
  const keys = Object.keys(kinds);
  const famZ = ctx.hgOgFamilyZ(keys.length);
  ok(keys.length > 40, 'the ledger holds ' + keys.length + ' mechanics');
  ok(famZ > 2.5, 'searching ' + keys.length + ' ways sets the bar at +' + famZ.toFixed(2) + 'σ');

  const be = 1 / 3;
  let clears = 0, best = null;
  for (const k of keys){
    const [n, hit] = kinds[k];
    const z = (hit - be) / Math.sqrt(be * (1 - be) / n);
    if (z >= famZ) clears++;
    if (!best || z > best.z) best = { k, z, n, hit };
  }
  ok(clears === 0, 'and NOT ONE of them clears it');
  ok(best.z < famZ, 'the best is ' + best.k + ' at +' + best.z.toFixed(2)
     + 'σ — short of the bar, so the ticket column empties');
}

console.log('\n== the empty column explains itself ==');
{
  const html = ctx.hgOgEdgeProofPanelHtml();
  ok(html, 'the panel renders while nothing clears the bar');
  ok(/NO TICKETS/.test(html), 'it says plainly that there are none');
  ok(/BY DESIGN, NOT BY FAULT/.test(html), 'and that this is deliberate, not a broken feed');
  ok(/WATCH/.test(html), 'it says the setups are still there as watches');
  ok(/σ/.test(html), 'it quotes the actual bar rather than asserting a conclusion');
  ok(/forward log/.test(html), 'and says what would refill the column');

  /* it must be rendered ABOVE the numbers a reader would scan for a ticket */
  ok(/hgOgEdgeProofPanelHtml\(\)[\s\S]{0,200}hgOgBookExperienceHtml\(\)/.test(SRC),
     'and it is rendered before the book-experience numbers, not after them');

  /* and it must stop talking the moment it stops being true */
  const saved = ctx.HG_OG_REPLAY_EVIDENCE.kinds;
  try {
    /* a mechanic at 60% on 400 trades clears any bar this ledger can set */
    ctx.HG_OG_REPLAY_EVIDENCE.kinds = { 'PROVEN-THING': [400, 0.60, 0, 0, 0] };
    ok(ctx.hgOgEdgeProofPanelHtml() === '',
       'a ledger with something proven in it renders NOTHING — the panel is not a slogan');
  } finally { ctx.HG_OG_REPLAY_EVIDENCE.kinds = saved; }

  ok(ctx.hgOgEdgeProofPanelHtml() !== '', 'and it comes back when the ledger is restored');
}

console.log('\n== the card says why, in the gate row itself ==');
{
  ok(/NO TICKET: this desk now requires a measured edge/.test(SRC),
     'an unknown verdict appends the reason to the gate row a reader opens');
  ok(/stands as a WATCH with its levels intact/.test(SRC),
     'and tells them the setup is still usable, not deleted');
}

console.log('\n' + passed + ' passed, 0 failed');
