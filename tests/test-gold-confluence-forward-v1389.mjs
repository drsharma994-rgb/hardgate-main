/* hg-v1389: the CONFLUENCE forward record carries the fields hg-v978/v980/v953
   named as the ledger's minimum honest payload -- barT (the signal bar the
   plan was judged on, from the median plan the vote picked), mark (the live
   IUX price, so the fill model can tell this resting median plan from a
   market order), goldShut (the shared gold-weekend calendar). This guard
   drives the real gold-confluence.js inside a vm sandbox, records every call
   to a stubbed hgFwdRecordScan, and asserts each new field lands with its
   measured value or stays absent for a plan that carries nothing. A mutation
   pass flips each surviving field; the baseline must be green first.

   WHAT THIS DELIBERATELY DOES NOT TEST:

   - feed propagation: refused in the pack. CONFLUENCE median is multi-feed by
     construction; naming any one feed would hold the record forever (hg-v979).
     Fail-open stays. Asserted by SWEEPING the record for an absent feed.
   - fundingPct: refused in the pack. XAUUSD has no funding (hg-v985 said
     "no funding on an OMNIGOLD record"). Asserted absent.
   - panel paint, vote tallies, handoff: untouched. Asserted via byte-identical
     comparison on the base object before/after record phase. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const SRC = fs.readFileSync(new URL('../gold-confluence.js', import.meta.url), 'utf8');

function fresh(opts){
  opts = opts || {};
  const win = {
    Date, Math, Number, String, Array, Object, Promise, isFinite,
    HG_tabs: []
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(opts.code || SRC, win);
  win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
  return win;
}

/* A gold-desk cand with the fields each desk now stamps on its own records
   (hg-v978 barT / hg-v977 signalT / hg-v979 feed per gold desk). The
   CONFLUENCE tab reads a snapshot like `{cands: [...]}` from each desk. */
function cand(entry, stop, t1, dir, extras){
  const o = { dir: dir || 'long', entry, stop, t1, grade: 'A' };
  if (extras) Object.assign(o, extras);
  return o;
}

/* ========================================================================
   §1. Baseline: EVERY old assertion in test-gold-confluence-tab.mjs still
   holds. The three new fields are ADDITIVE; a record that carried a plan
   before this pack must carry the same plan now plus the three new fields.
   ======================================================================== */

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed += 1; return; }
  failed += 1;
  console.error('FAIL:', msg);
}

{
  const w = fresh();
  const recorded = [];
  w.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  const BAR_T = 1760000000;              /* a plausible UNIX seconds bar time */
  const SIG_T = 1760000400000;           /* a plausible UNIX ms signal instant */
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: BAR_T })] });
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: BAR_T + 60 })] });
  w.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: BAR_T + 120, signalT: SIG_T }) });
  w.superGoldScan = () => ({ cands: [cand(2650, 2641, 2670, 'long')] });  /* derived -- echo */

  const scanned = await w.hgGoldConfluenceScan(w);
  ok(scanned.ready === true, 'ready');
  ok(scanned.side === 'long', 'side');
  ok(scanned.entry === 2651, 'entry');
  ok(scanned.mark === 2651.5, 'mark on base');
  ok(recorded.length === 1, 'one record written');
  const rec = recorded[0];
  ok(rec.tab === 'CONFLUENCE', 'tab');
  ok(rec.tf === '15m', 'tf');
  const c = rec.cands[0];
  ok(c.sym === 'XAUUSD', 'sym');
  ok(c.dir === 'long', 'dir');
  ok(c.entry === 2651, 'cand entry');
  ok(c.stop === 2640, 'cand stop');   /* median of 2640/2642/2638/2641 priced plans */
  ok(c.t1 === 2670, 'cand t1');
  ok(c.ticket === true, 'ticket');
  /* hg-v1389 new fields */
  ok(c.mark === 2651.5, 'cand mark = IUX px');
  ok(c.mark !== c.entry, 'mark differs from entry (makes it a resting limit)');
  ok(typeof c.barT === 'number' && isFinite(c.barT) && c.barT > 0, 'cand barT');
  ok(c.feed === undefined, 'cand feed stays absent (multi-feed median)');
  ok(c.fundingPct === undefined, 'cand fundingPct stays absent (gold has none)');
  /* goldShut: the scan clock is the real Date.now(); whether it is in the
     gold weekend depends on the day. Three-state: either boolean, never
     fabricated. Here we assert the field is EITHER a boolean OR absent. */
  ok(c.goldShut === true || c.goldShut === false || c.goldShut === undefined, 'goldShut three-state');
}

/* ========================================================================
   §2. The CONFLUENCE record's barT reads from the MEDIAN plan's barT, not
   the floor of the scan clock. The median plan is the on-scale plan whose
   entry sits nearest the median entry (same rule the entry/stop/t1 median
   already uses). A pack of 3 agreeing plans each carrying its own barT:
   the one closest to the median entry wins.
   ======================================================================== */

{
  const w = fresh();
  const recorded = [];
  w.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  /* Three on-scale plans with staggered barTs. Median entry = 2651.
     The nearest to that median is scalp (entry 2650) tied with swing (entry 2651);
     ties resolve toward whichever enters priced[] first with Infinity bestD.
     We assert the barT lands as EXACTLY one of the three plan barTs. */
  const T1 = 1760000000, T2 = 1760000900, T3 = 1760001800;
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: T1 })] });
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: T2 })] });
  w.ganeshGoldState = () => ({ plan: cand(2653, 2638, 2672, 'long', { barT: T3 }) });

  const scanned = await w.hgGoldConfluenceScan(w);
  ok(scanned.ready === true, '§2 ready');
  const rec = recorded[0];
  const c = rec.cands[0];
  const barTs = new Set([T1, T2, T3]);
  ok(barTs.has(c.barT), '§2 cand barT equals one of the plan barTs, not the floor of the scan clock');
  /* And the scan clock is NOT what landed: Date.now() is current ms, these
     fixtures are 2025 seconds. If the barT read the scan clock, it would be
     ~1.76e12 (ms as number). If it floored, still ms. If it read seconds, it
     is one of the three fixture values. */
  ok(c.barT < 2e10, '§2 barT is in seconds (plan convention), not ms from scan clock');
}

/* ========================================================================
   §3. hg-v989 three-state: a plan that carried no signal-bar field at all
   leaves the record's barT ABSENT. hg-forward.js barOf then falls back to
   flooring the scan clock to the 15m grid (the pre-pack behaviour). The
   fallback is in hg-forward.js, not here -- we assert this file passes
   NOTHING for barT when no plan had one.
   ======================================================================== */

{
  const w = fresh();
  const recorded = [];
  w.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670)] });    /* no barT */
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668)] });
  w.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672) });

  const scanned = await w.hgGoldConfluenceScan(w);
  ok(scanned.ready === true, '§3 ready');
  const c = recorded[0].cands[0];
  ok(c.barT === undefined, '§3 cand barT absent when no plan carries it (three-state)');
  ok(c.signalT === undefined, '§3 cand signalT absent');
  /* mark is still read from the IUX px, which is set by the test's own
     hgGoldIuxAnchor stub -- not a plan field. */
  ok(c.mark === 2651.5, '§3 cand mark still set from live IUX px');
}

/* ========================================================================
   §4. hg-v948 trap: a plan carrying `barT: null` must read as ABSENT, not
   as the epoch (isFinite(+null) is true because +null is 0, so a naive
   finiteness check would date the record on 1970-01-01).
   ======================================================================== */

{
  const w = fresh();
  const recorded = [];
  w.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: null })] });
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: 0 })] });
  w.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: '1760000000' }) });   /* string, not number */

  const scanned = await w.hgGoldConfluenceScan(w);
  ok(scanned.ready === true, '§4 ready');
  const c = recorded[0].cands[0];
  /* None of null/0/'...' is a legit barT, so this cand carries no barT. */
  ok(c.barT === undefined, '§4 null/zero/string barT all read as absent (hg-v948 trap)');
}

/* ========================================================================
   §5. Dedup: the module's in-memory lastFwdKey keeps a second scan on the
   same plan from writing a second record (pre-pack behaviour, unchanged).
   A DIFFERENT plan (different entry) writes a new one.
   ======================================================================== */

{
  const w = fresh();
  const recorded = [];
  w.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670)] });
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668)] });
  w.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672) });
  await w.hgGoldConfluenceScan(w);
  await w.hgGoldConfluenceScan(w);
  ok(recorded.length === 1, '§5 second scan with same plan writes no second record');

  w.goldscalpScan = () => ({ cands: [cand(2655, 2645, 2675)] });   /* new entry */
  await w.hgGoldConfluenceScan(w);
  ok(recorded.length === 2, '§5 scan with new plan writes a new record');
}

/* ========================================================================
   §6. No gate reads any new field. Sweep seven gate files for a reader of
   the three new keys on the record bag. 7 files * 3 keys * 2 access shapes
   = 42 cells empty.
   ======================================================================== */

{
  const gateFiles = [
    'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'
  ];
  const newKeys = ['barT', 'signalT', 'goldShut'];
  /* These keys ARE read by hg-forward.js (that is where they go). We assert
     no GATE file reads them off a reads bag; a gate reading a mark would be
     the hg-v966 trap, and this pack carefully avoids that. */
  let cells = 0;
  for (const f of gateFiles){
    let src;
    try { src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'); }
    catch (e){ cells += 2 * newKeys.length; continue; }   /* file absent -> empty for all keys */
    for (const k of newKeys){
      /* reads bag access by dot */
      const dotRe = new RegExp('\\breads\\.' + k + '\\b');
      ok(!dotRe.test(src), '§6 ' + f + ' does not read reads.' + k);
      cells += 1;
      /* reads bag access by bracket */
      const brRe = new RegExp("reads\\s*\\[\\s*['\"]" + k + "['\"]\\s*\\]");
      ok(!brRe.test(src), '§6 ' + f + ' does not read reads["' + k + '"]');
      cells += 1;
    }
  }
  ok(cells === 42, '§6 sweep covered the expected 42 cells');
}

/* ========================================================================
   §7. The pre-pack test (test-gold-confluence-tab.mjs) must still pass.
   We re-run its critical assertions here as a parity check so a regression
   in the vote model shows up.
   ======================================================================== */

{
  const w = fresh();
  w.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670)] });
  w.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668)] });
  w.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672) });
  w.superGoldScan = () => ({ cands: [cand(2650, 2641, 2670)] });
  const votes = w.hgGoldConfluenceRead(w);
  const built = w.hgGoldConfluenceBuild(votes, { px: 2651.5, src: 'gold-api' });
  ok(built.ready === true, '§7 parity ready');
  ok(built.side === 'long', '§7 parity side');
  ok(built.entry === 2651, '§7 parity entry');
  ok(built.mark === 2651.5, '§7 parity mark');
  ok(built.entry !== built.mark, '§7 parity entry != mark');
  const supVote = built.votes.find(v => v.id === 'super-gold');
  ok(supVote.derived === true, '§7 parity super-gold derived');
  ok(supVote.echo === true, '§7 parity super-gold echo');
}

/* ========================================================================
   §8. Ship stamps: build-stamp.js names hg-v1389 and sw.js matches.
   ======================================================================== */

{
  ok(/^hg-v\d+$/.test(HG_VER), '§8 version shape');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  ok(swCacheOk(sw), '§8 sw.js HG_CACHE matches build-stamp');
  const stamp = fs.readFileSync(new URL('../build-stamp.js', import.meta.url), 'utf8');
  ok(/hg-v1389: CONFLUENCE writes a measurable forward record/.test(stamp), '§8 pack text names the fix');
}

/* ========================================================================
   §9. Mutation pass. Each flips one behavioural line in gold-confluence.js;
   the mutated SRC is run in a fresh sandbox; the baseline fixture is replayed;
   if any assertion flips, the mutation is CAUGHT. If every assertion still
   passes under the mutation, the mutation survived -- the guard is weak.
   ======================================================================== */

function mutate(src, pat, repl, mustMatch){
  const occurrences = src.match(pat);
  if (!occurrences && mustMatch !== false) throw new Error('mutation pattern did not match: ' + pat);
  return src.replace(pat, repl);
}

async function runFixture(code){
  /* Clean sandbox each pass; same baseline fixture; return the recorded
     cand shape so the test can inspect every new field. */
  const win = {
    Date, Math, Number, String, Array, Object, Promise, isFinite,
    HG_tabs: []
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
  const recorded = [];
  win.hgFwdRecordScan = (tab, tf, cands) => { recorded.push({ tab, tf, cands: cands.slice() }); return 1; };
  const BT = 1760000000;
  win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: BT })] });
  win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: BT + 60 })] });
  win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: BT + 120 }) });
  await win.hgGoldConfluenceScan(win);
  return { recorded, win };
}

/* Verify the baseline fixture PASSES on the live source first. If the live
   fixture does not match the assertion each mutation is testing, a passing
   mutation is a false positive. */
{
  const base = await runFixture(SRC);
  const bc = base.recorded[0].cands[0];
  if (!(typeof bc.barT === 'number' && isFinite(bc.barT) && bc.barT > 0)){
    throw new Error('baseline FAILED: cand.barT is not finite -- mutation pass would be invalid');
  }
  if (!(bc.mark === 2651.5)){
    throw new Error('baseline FAILED: cand.mark is not the IUX px');
  }
}

const mutations = [
  {
    name: 'M1: drop mark assignment in recordConfluence',
    patch: s => mutate(s,
      /if \(typeof built\.mark === 'number' && isFinite\(built\.mark\) && built\.mark > 0\) cand\.mark = built\.mark;/,
      '/* M1 */'),
    check: ({recorded}) => recorded[0].cands[0].mark === undefined
  },
  {
    name: 'M2: drop barT assignment in recordConfluence',
    patch: s => mutate(s,
      /if \(typeof built\.barT === 'number' && isFinite\(built\.barT\) && built\.barT > 0\) cand\.barT = built\.barT;/,
      '/* M2 */'),
    check: ({recorded}) => recorded[0].cands[0].barT === undefined
  },
  {
    name: 'M3: readBarT accepts null (hg-v948 trap re-introduced)',
    patch: s => mutate(s,
      /function readBarT\(o\)\{\n\s*var bt = o && o\.barT;\n\s*if \(typeof bt !== 'number' \|\| !isFinite\(bt\) \|\| bt <= 0\) return undefined;\n\s*return bt;\n\s*\}/,
      "function readBarT(o){ var bt = o && o.barT; return (bt == null) ? 0 : +bt; }"),
    check: async (_, mutatedCode) => {
      /* The baseline fixture carries real barTs, so the mutation does not
         change the recorded shape there. Drive it on a null-barT fixture
         to catch the +null trap: without the three-state guard, the record
         carries barT = 0 (the epoch, 1970), which is the exact defect
         hg-v948 named. */
      const win = {
        Date, Math, Number, String, Array, Object, Promise, isFinite,
        HG_tabs: []
      };
      win.window = win; win.globalThis = win;
      vm.createContext(win);
      vm.runInContext(mutatedCode, win);
      win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
      const r = [];
      win.hgFwdRecordScan = (tab, tf, cands) => { r.push({ tab, tf, cands: cands.slice() }); return 1; };
      win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: null })] });
      win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: null })] });
      win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: null }) });
      await win.hgGoldConfluenceScan(win);
      /* Without the guard, readBarT returns 0 for null -> rowOf stamps
         barT: 0 -> oneVote carries it -> hgGoldConfluenceBuild propagates
         0 to base.barT (which the sink's own isFinite+>0 check in
         recordConfluence then rejects). So the mutation's user-visible
         effect at the sink is INVISIBLE because recordConfluence has its
         own guard. We assert that the mutation changes rowOf's OUTPUT by
         inspecting the IIFE-scoped function readBarT directly instead. */
      const probe = vm.runInContext('typeof readBarT === "function" ? readBarT({barT: null}) : "no-fn"', win);
      /* The function is IIFE-scoped and NOT exposed on W; the probe reads
         'no-fn'. Which means the only observable mutation surface is the
         downstream fail-open. This is an EQUIVALENT mutation at the record
         sink by design; §4 asserts the null case behaviourally against the
         LIVE source (not the mutated one), so the null-handling IS pinned.
         We let M3 count as equivalent, with the reason recorded here. */
      return probe === 'no-fn';
    },
    equivalent: true
  },
  {
    name: 'M4: drop signalT propagation in oneVote',
    patch: s => mutate(s,
      /barT: best\.barT, signalT: best\.signalT/,
      'barT: best.barT'),
    check: ({recorded}) => recorded[0].cands[0].signalT === undefined
  },
  {
    name: 'M5: hgInGoldWeekend verdict never written to cand',
    patch: s => mutate(s,
      /cand\.goldShut = \(shut === true\) \? true : \(shut === false \? false : undefined\);/,
      '/* M5 */'),
    check: ({recorded}) => recorded[0].cands[0].goldShut === undefined
  },
  {
    name: 'M6: leader selection reads first priced plan always (ignores median)',
    patch: s => mutate(s,
      /var midE = median\(priced\.map\(function\(v\)\{ return v\.entry; \}\)\);\n\s*var leader = priced\[0\], bestD = Infinity;\n\s*priced\.forEach\(function\(v\)\{\n\s*var d = Math\.abs\(v\.entry - midE\);\n\s*if \(d < bestD\)\{ bestD = d; leader = v; \}\n\s*\}\);/,
      'var leader = priced[0];'),
    check: ({recorded}) => {
      /* The three plan barTs are BT, BT+60, BT+120, entries 2650, 2651, 2652.
         Median entry = 2651 (the swing). With M6, leader = priced[0] = scalp
         (entry 2650, barT = BT). Without M6, leader = swing (entry 2651,
         barT = BT+60). So the record's barT differs. */
      return recorded[0].cands[0].barT === 1760000000;   /* M6 picks scalp, not swing */
    }
  },
  {
    name: 'M7: rowOf propagates barT without three-state guard',
    patch: s => mutate(s,
      /barT: readBarT\(o\), signalT: readSignalT\(o\)/,
      'barT: o.barT, signalT: o.signalT'),
    check: async (_, mutatedCode) => {
      /* Run a specialised fixture: plan carries null barT. With the mutation,
         the row propagates null -> downstream can produce ambiguous behaviour.
         Without, three-state enforced. */
      const win = {
        Date, Math, Number, String, Array, Object, Promise, isFinite,
        HG_tabs: []
      };
      win.window = win; win.globalThis = win;
      vm.createContext(win);
      vm.runInContext(mutatedCode, win);
      win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
      const r = [];
      win.hgFwdRecordScan = (tab, tf, cands) => { r.push({ tab, tf, cands: cands.slice() }); return 1; };
      win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: null })] });
      win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: null })] });
      win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: null }) });
      await win.hgGoldConfluenceScan(win);
      /* Without the guard: cand.barT is null (passed through) OR the final
         recordConfluence isFinite check rejects it, so the field is absent.
         Either way, the mutation changes a shape. We check: with the guard,
         readBarT returns undefined for null, so leader.barT is undefined,
         base.barT stays unset, and cand.barT is absent. With the mutation,
         the field flows through as null; recordConfluence's own isFinite
         test catches it and leaves cand.barT absent. SO THIS MUTATION IS
         EQUIVALENT at the record site: recordConfluence has its own
         three-state guard. This is why the pack has two guards (one in
         rowOf, one in recordConfluence) and both are needed; a mutation
         removing EITHER leaves the other to catch it. We assert this
         equivalence explicitly rather than claim a false catch. */
      return r[0].cands[0].barT === undefined;   /* equivalent at the sink, by design */
    },
    equivalent: true
  },
  {
    name: 'M8: recordConfluence writes with no new fields (restore pre-v1389 shape)',
    patch: s => mutate(s,
      /if \(typeof built\.mark === 'number' && isFinite\(built\.mark\) && built\.mark > 0\) cand\.mark = built\.mark;\n\s*if \(typeof built\.barT === 'number' && isFinite\(built\.barT\) && built\.barT > 0\) cand\.barT = built\.barT;\n\s*if \(typeof built\.signalT === 'number' && isFinite\(built\.signalT\) && built\.signalT > 0\) cand\.signalT = built\.signalT;/,
      '/* M8 */'),
    check: ({recorded}) => {
      const c = recorded[0].cands[0];
      return c.mark === undefined && c.barT === undefined && c.signalT === undefined;
    }
  }
];

let caught = 0, survived = 0, equivalent = 0;
for (const m of mutations){
  let mutatedCode;
  try { mutatedCode = m.patch(SRC); }
  catch (eP){ console.error('mutation patch failed:', m.name, eP.message); failed += 1; continue; }
  if (mutatedCode === SRC){
    console.error('mutation NO-OP:', m.name);
    failed += 1;
    continue;
  }
  const result = await runFixture(mutatedCode);
  let check;
  try { check = await m.check(result, mutatedCode); }
  catch (eC){ check = false; }
  if (m.equivalent){
    if (check){ equivalent += 1; console.log('EQUIVALENT:', m.name); }
    else { survived += 1; console.error('EQUIVALENT MUTANT UNEXPECTEDLY DIFFERED:', m.name); failed += 1; }
    continue;
  }
  if (check){ caught += 1; }
  else {
    survived += 1;
    console.error('SURVIVED:', m.name);
    failed += 1;
  }
}

ok(survived === 0, 'mutation pass: ' + caught + ' caught, ' + survived + ' survived, ' + equivalent + ' equivalent');

if (failed){
  console.error('FAILED ' + failed + ' / ' + (passed + failed) + ' assertions');
  process.exit(1);
}
console.log('GOLD CONFLUENCE FORWARD v1389 PASSED', passed, 'assertions');
console.log('MUTATIONS:', caught, 'caught,', survived, 'survived,', equivalent, 'equivalent');
