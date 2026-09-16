/* HARDGATE — hg-v756 emptied six surfaces and explained one of them.

   Making measured-edge hard was the intent. What went untraced was
   everything keyed on grade.ticket, which switched off with it:

     hgOgMpRow        the MOST PROBABLE rows
     hgOgPickFor      the pick selector
     hgOgXmSlim       the XM bot payload
     hgOgActivation   the activation row
     plus the coverage and demotion readouts

   Every one of those is correct behaviour and none of them said why. The
   explanation sat in the evidence panel further down the tab, so a reader
   on MOST PROBABLE got an empty box — which reads as a broken feed, and a
   reader who concludes that goes looking for tickets somewhere less
   careful.

   Worse, the empty states that DID have wording blamed the wrong thing:
   "no ticket cleared; best WITH-tape level read below is gate-blocked
   (VETO)" and "gold is going up — a SHORT is not the setup" both point a
   reader at a tape that will never bring the tickets back.

   One sentence, rendered wherever the gate is the actual reason, and
   silent whenever it is not.

   Run: node tests/test-omnigold-edge-silence.mjs */
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
for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                 'hg-gates.js', 'omniroute.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

console.log('== the note says the true reason ==');
{
  const n = ctx.hgOgEdgeSilenceNote();
  ok(n, 'it renders while the gate is the reason');
  ok(/measured edge/.test(n), 'and names the gate');
  ok(/WATCH/.test(n), 'and says the setups are still there');
  ok(/rather than imply one/.test(n), 'framing it as a choice, not a fault');
  ok(n.indexOf('<') < 0, 'it is a plain sentence, so it drops into any surface');
}

console.log('\n== and goes quiet the moment it is not the reason ==');
{
  /* a ledger with something proven in it: the gate is no longer why the
     column is empty, so this must say nothing rather than mislead */
  const saved = ctx.HG_OG_REPLAY_EVIDENCE.kinds;
  try {
    ctx.HG_OG_REPLAY_EVIDENCE.kinds = { 'PROVEN-THING': [400, 0.60, 0, 0, 0] };
    ok(ctx.hgOgEdgeSilenceNote() === '', 'with a mechanic clearing its bar the note is silent');
    ok(ctx.hgOgMpNoneWhy('long', null) !== ctx.hgOgEdgeSilenceNote(),
       'and the tape reasoning comes back');
    ok(/SHORT is not the setup/.test(ctx.hgOgMpNoneWhy('long', null)),
       'saying what it always said');
  } finally { ctx.HG_OG_REPLAY_EVIDENCE.kinds = saved; }

  ok(ctx.hgOgEdgeSilenceNote() !== '', 'and it returns when the ledger is restored');
}

console.log('\n== it is APPENDED to the tape copy, never substituted for it ==');
{
  /* A first pass at this returned the gate note INSTEAD of the tape copy
     and threw away the thing a reader most wants — which side is even
     eligible. Five existing tests caught it. Both facts answer different
     questions and both belong. */
  const why = ctx.hgOgMpNoneWhy('long', null);
  ok(/SHORT is not the setup/.test(why), 'the tape reasoning survives intact');
  ok(/measured edge/.test(why), 'and the gate reason is added to it');
  ok(why.indexOf('SHORT is not the setup') < why.indexOf('measured edge'),
     'tape first, gate second — which side, then why no side is a ticket');

  /* and with the gate silent it must be byte-identical to the old copy */
  const saved = ctx.HG_OG_REPLAY_EVIDENCE.kinds;
  try {
    ctx.HG_OG_REPLAY_EVIDENCE.kinds = { 'PROVEN-THING': [400, 0.60, 0, 0, 0] };
    ok(ctx.hgOgMpNoneWhy('long', null) === ctx.hgOgMpNoneWhyTape('long', null),
       'with nothing to add it collapses to exactly the copy that shipped before');
  } finally { ctx.HG_OG_REPLAY_EVIDENCE.kinds = saved; }

  ok(/return edge \? \(base \+ ' ' \+ edge\) : base;/.test(SRC),
     'the wrapper appends rather than replaces');
}

console.log('\n== the activation row gives a reason, not a restatement ==');
{
  /* "not a TICKET" is true of every card on this desk now, so it carries
     no information at all */
  ok(/cleared every gate except measured-edge — no proven edge, so no ticket/.test(SRC),
     'a gate-clear pick says exactly what stood it aside');
  ok(/hgOgGateClear\(pick\.grade\) === true/.test(SRC),
     'decided from the grade rather than assumed');
}

console.log('\n== one source, so the surfaces cannot drift apart ==');
{
  const uses = (SRC.match(/hgOgEdgeSilenceNote\(\)/g) || []).length;
  ok(uses >= 3, 'the note is called from several surfaces (' + uses + ')');
  ok(/window\.hgOgEdgeSilenceNote = hgOgEdgeSilenceNote;/.test(SRC), 'and it is exported');
  /* the long form and the one-liner must agree about WHEN to speak */
  ok(/if \(hgOgEdgeProofPanelHtml\(\) === ''\) return '';/.test(SRC),
     'it defers to the evidence panel for whether the gate is the reason — one rule, not two');
}

console.log('\n' + passed + ' passed, 0 failed');
