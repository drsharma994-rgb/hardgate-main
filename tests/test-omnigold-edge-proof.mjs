/* HARDGATE — a ticket is a claim that the mechanic pays. Now it has to be.

   measured-edge has always vetoed a KNOWN failure. What it did not do was
   stand a setup aside when the answer is UNKNOWN: a soft gate lets a null
   verdict through, so the ticket issued and the card read UNCHECKED. That
   is how every OMNIGOLD ticket has ever been issued, because nothing in the
   ledger clears its bar. The counts and sigmas are read from the code
   rather than restated here: hg-v815 moved the family to all 77 scanned
   mechanics and hg-v818 put every sigma on the effective sample, and a
   header that had pinned "+1.71 sigma against a bar near +2.9" would have
   been wrong twice over while the assertions below stayed green.

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
              localStorage: (function(){ var st = {}; return {
                getItem: k => (k in st ? st[k] : null),
                setItem: (k, v) => { st[k] = String(v); },
                removeItem: k => { delete st[k]; } }; })() };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
/* hg-forward.js included because the panel now reads the live forward log
   for progress; without it hgOgEdgeProgressHtml correctly degrades to '' */
for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                 'hg-gates.js', 'omniroute.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

/* hg-v925: this whole file is about the STRICT mode — the gate hard, the
   ticket column empty, and hgOgEdgeProofPanelHtml explaining why. That mode
   is no longer the default (relaxed on instruction), so turn it on here
   rather than letting the file silently test whatever the default happens to
   be. Everything below is the contract that holds when proof is required. */
if (typeof ctx.hgOgSetEdgeProof === 'function') ctx.hgOgSetEdgeProof(true);

console.log('== the gate is hard, and it is one line to reverse ==');
{
  /* hg-v925 RELAXED THE DEFAULT ON INSTRUCTION, so the switch is now a named
     constant plus a persisted override rather than a literal `= true`. This
     file tests the STRICT MODE, which is one hgOgSetEdgeProof(true) away and
     is still the contract the rest of this suite depends on — so it asserts
     the shape of the switch, not which way it currently points. */
  ok(/var OG_EDGE_PROOF_DEFAULT = (true|false);/.test(SRC), 'the switch is a single named constant');
  ok(/var OG_EDGE_PROOF_REQUIRED = OG_EDGE_PROOF_DEFAULT;/.test(SRC),
     'and the live flag is initialised from it, never from a second literal');
  ok(/function hgOgSetEdgeProof\(on\)/.test(SRC), 'with a setter, so reversing it needs no edit');
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

  /* THIS LOOP USED TO RE-IMPLEMENT THE Z ITSELF, on the RAW row count, and
     never checked the panel agreed with it. So when the panel deflated to
     the effective sample in hg-v818 and this did not, nothing failed: both
     reported 0 clearing, from different numbers. It reads the code's own
     function now, and the panel is checked against it below. */
  const be = 1 / 3;
  let clears = 0, best = null;
  for (const k of keys){
    const z = ctx.hgOgReplayZ(kinds[k], be);
    if (z >= famZ) clears++;
    if (!best || z > best.z) best = { k, z, n: kinds[k][0], hit: kinds[k][1] };
  }
  ok(clears === 0, 'and NOT ONE of them clears it');
  ok(best.z < famZ, 'the best is ' + best.k + ' at +' + best.z.toFixed(2)
     + 'σ — short of the bar, so the ticket column empties');

  /* THE REPLAY POPULATION OVERLAPS. hgOgReplayEdgeVerdict has deflated for
     that since it was measured; this panel read the raw count. */
  const raw = (kinds[best.k][1] - be) / Math.sqrt(be * (1 - be) / kinds[best.k][0]);
  ok(raw > best.z,
     'the raw-count z (' + raw.toFixed(2) + 'σ) overstates the effective one ('
     + best.z.toFixed(2) + 'σ) — 55 positions at once is not 197 draws');
  ok(Math.abs(raw / best.z - 1 / Math.sqrt(ctx.HG_OG_EFF_N_RATIO)) < 1e-9,
     'by exactly 1/sqrt(the measured week-clustered ratio)');

  /* AND THE PANEL MUST QUOTE THE SAME NUMBER. */
  const txt = String(ctx.hgOgEdgeProofPanelHtml()).replace(/<[^>]+>/g, ' ');
  ok(txt.indexOf('+' + best.z.toFixed(2) + 'σ') >= 0,
     'the panel reports the effective-sample σ it just computed');
  ok(txt.indexOf('+' + raw.toFixed(2) + 'σ') < 0, 'and not the raw-count one');
  ok(/after the overlap deflation/.test(txt),
     'printing the deflated count too, so the σ can be reproduced from the page');
  ok(new RegExp(String(Math.round(ctx.hgOgEffN(kinds[best.k][0], true)))).test(txt),
     'and that count is the effective sample, not a rounded guess');
}

console.log('\n== the empty column explains itself ==');
{
  const html = ctx.hgOgEdgeProofPanelHtml();
  ok(html, 'the panel renders while nothing clears the bar');
  ok(/NO TICKETS/.test(html), 'it says plainly that there are none');
  ok(/BY DESIGN, NOT BY FAULT/.test(html), 'and that this is deliberate, not a broken feed');
  ok(/WATCH/.test(html), 'it says the setups are still there as watches');
  ok(/σ/.test(html), 'it quotes the actual bar rather than asserting a conclusion');
  ok(/settled setups that passed every other gate, beating breakeven/.test(html),
     'and says what would refill the column');
  /* hg-v761: and how far that has got, so a reader waiting weeks can tell
     2-of-20 from 19-of-20 — and from a log that stopped recording */
  ok(/SCALP/.test(html) && /SWING/.test(html),
     'with live progress per horizon, where the promise is made');
  ok(/of 20 settled|no cleared setups have settled yet/.test(html),
     'counted against the threshold rather than merely asserted');

  /* IT MUST BE RENDERED ABOVE the numbers a reader would scan for a
     ticket. Asserted by position rather than by proximity: this used to be
     a 200-character window between the two calls, which hg-v766 broke by
     inserting the forward-splits panel between them — a legitimate change
     that a distance check reads as a reordering. Order is the claim; how
     much sits between them is not. */
  const iEdge = SRC.indexOf('+ hgOgEdgeProofPanelHtml()');
  const iBook = SRC.indexOf('+ hgOgBookExperienceHtml()');
  const iSplits = SRC.indexOf('+ hgOgFwdSplitsPanelHtml()');
  ok(iEdge > 0 && iBook > 0, 'both panels are rendered in the same block');
  ok(iEdge < iBook, 'and the edge panel comes before the book-experience numbers');
  ok(iSplits > iEdge && iSplits < iBook,
     'with the forward-splits panel between them — why there are no tickets first, ' +
     'then whether the ordering of what remains is worth anything');

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
