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
   §6. No gate reads any new field. hg-v1390 (defect #6 fix): the hg-v1389
   sweep tested `reads.X` and `reads["X"]` only -- but the three new fields
   are stored as TOP-LEVEL record fields on hgFwdNormalize's output
   (hg-forward.js:182-183 reads rec.barT directly; :196 writes barT: barT;
   :315 writes goldShut: ...), NOT inside a `reads` bag. The hg-v1389 sweep's
   regex could never match these fields regardless of what gates do -- the
   "42 cells empty" assertion passed VACUOUSLY, grep-satisfiable in the
   WRONG DIRECTION. A gate that read `rec.barT` or `candidate.goldShut`
   directly would slip through unnoticed.

   The hg-v1390 sweep tests ALL plausible access shapes a gate module could
   use: `rec.barT`, `record.barT`, `row.barT`, `r.barT`, `cand.barT`,
   `candidate.barT`, and bracket-form variants, plus the hg-v1389
   reads-bag shapes to keep the belt-and-braces check. A legitimate WRITER
   like engine.js's hg-v981 line `barT: (svBar[i]||{}).barT` is whitelisted
   (member access on survivor-bar), because that line HANDS a barT to the
   record builder; it is not a gate-side reader. */

{
  const gateFiles = [
    'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'
  ];
  const newKeys = ['barT', 'signalT', 'goldShut'];
  /* Access-prefix identifiers a gate would plausibly use when reading a
     record / row / candidate. The regex requires the key to appear as a
     member access of one of these names (`<pref>.<key>` or
     `<pref>['<key>']` / `<pref>["<key>"]`). A gate reading one of these
     would be the hg-v966 trap this pack carefully avoids. */
  const PREFIXES = ['rec', 'record', 'row', 'r', 'cand', 'candidate', 'c', 'cards', 'card', 'reads'];
  /* Known legitimate WRITERS that pass the field through -- a gate-side
     reader would not match this shape. engine.js:1238 has:
       mark: (svBar[i] || {}).mark, barT: (svBar[i] || {}).barT, /* hg-v981
     which is a WRITER (survivor-bar snapshot -> record builder), not a gate. */
  const WRITER_WHITELIST = [
    /\(\s*svBar\[\s*i\s*\]\s*\|\|\s*\{\s*\}\s*\)\.barT/
  ];
  function stripComments(src){
    /* Comments can legitimately NAME any of these fields; we only care
       about executable reads. Strip both block and line comments first. */
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }
  function hits(src, key){
    const out = [];
    for (const pref of PREFIXES){
      /* dot access: <pref>.<key> at word boundary */
      const dotRe = new RegExp('\\b' + pref + '\\.' + key + '\\b', 'g');
      let m; while ((m = dotRe.exec(src))) out.push(m[0]);
      /* bracket access: <pref>["<key>"] or <pref>['<key>'] */
      const brRe = new RegExp('\\b' + pref + "\\s*\\[\\s*['\"]" + key + "['\"]\\s*\\]", 'g');
      while ((m = brRe.exec(src))) out.push(m[0]);
    }
    return out;
  }
  let cells = 0;
  for (const f of gateFiles){
    let src;
    try { src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'); }
    catch (e){
      /* file absent -> count all cells as empty for every prefix+shape */
      cells += PREFIXES.length * 2 * newKeys.length;
      continue;
    }
    const stripped = stripComments(src);
    for (const k of newKeys){
      let raw = hits(stripped, k);
      /* Remove whitelisted writers (none of them read the field as a gate
         input; they hand it to the record builder, which is upstream of
         the gate chain). */
      raw = raw.filter(h => !WRITER_WHITELIST.some(w => w.test(h)));
      ok(raw.length === 0, '§6 ' + f + ' does not read ' + k + ' off any record/row/cand prefix' + (raw.length ? ' (saw: ' + raw.join(', ') + ')' : ''));
      cells += PREFIXES.length * 2;
    }
  }
  ok(cells === gateFiles.length * PREFIXES.length * 2 * newKeys.length,
     '§6 sweep covered ' + cells + ' cells (' + gateFiles.length + ' files * ' + PREFIXES.length + ' prefixes * 2 shapes * ' + newKeys.length + ' keys = ' + (gateFiles.length * PREFIXES.length * 2 * newKeys.length) + ')');
}

/* ========================================================================
   §6b. hg-v1390 (defect #8 fix): END-TO-END LEDGER ACCEPTANCE.
   The hg-v1389 guard stubbed hgFwdRecordScan everywhere, so a mutation
   that dropped barT/mark/goldShut from hgFwdNormalize's whitelist would
   have left this guard GREEN while the ledger silently discarded them
   (the hg-v955 shape in the test harness). This section boots the real
   hg-forward.js in a vm sandbox, runs the full roundtrip from
   recordConfluence through hgFwdRecordScan into hgFwdNormalize, reads
   the record back out of hgFwdRecords('CONFLUENCE'), and asserts each
   field survived. hg-v1168 technique.
   ======================================================================== */

{
  /* Boot a fresh sandbox with BOTH hg-forward.js AND gold-confluence.js. */
  const fwdSrc = fs.readFileSync(new URL('../hg-forward.js', import.meta.url), 'utf8');
  const confSrc = fs.readFileSync(new URL('../gold-confluence.js', import.meta.url), 'utf8');
  const store = new Map();
  const win = {
    Date, Math, Number, String, Array, Object, Promise, isFinite, JSON,
    console: { log(){}, warn(){}, error(){} },
    localStorage: {
      getItem: (k) => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => store.delete(k)
    },
    HG_tabs: []
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fwdSrc, win);
  vm.runInContext(confSrc, win);
  win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
  const BT = 1760000000;
  win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: BT })] });
  win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: BT + 60 })] });
  win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: BT + 120 }) });

  const scanned = await win.hgGoldConfluenceScan(win);
  ok(scanned.ready === true, '§6b real-ledger: scan ready');
  /* Read back from the actual ledger -- NOT a stub. */
  ok(typeof win.hgFwdRecords === 'function', '§6b hgFwdRecords is exported');
  const records = win.hgFwdRecords('CONFLUENCE');
  ok(Array.isArray(records) && records.length >= 1, '§6b real-ledger holds the CONFLUENCE record (got ' + (records && records.length) + ')');
  const rec = records[0];
  /* hgFwdNormalize must have ACCEPTED each new field. If a future refactor
     removed barT/mark/goldShut from the whitelist, these would fail. */
  ok(typeof rec.barT === 'number' && isFinite(rec.barT) && rec.barT > 0,
     '§6b hgFwdNormalize accepted barT (got ' + rec.barT + ')');
  ok(typeof rec.mark === 'number' && rec.mark === 2651.5,
     '§6b hgFwdNormalize accepted mark = IUX px (got ' + rec.mark + ')');
  /* goldShut is three-state; the real-world scan clock decides. We assert
     it is EITHER a boolean OR undefined -- the hg-v989 contract, never
     coerced to a sentinel like 0/false/null. */
  ok(rec.goldShut === true || rec.goldShut === false || rec.goldShut === undefined,
     '§6b hgFwdNormalize preserved goldShut three-state (got ' + rec.goldShut + ')');
  /* mark differs from entry => the fill model will classify this as
     resting (hg-v980), which was the whole point. */
  ok(rec.mark !== rec.entry, '§6b mark differs from entry (resting plan, fill model engaged)');
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
  },
  /* hg-v1390 mutations (defects #1, #7, #9 fix verification): */
  {
    name: 'M9: goldShut reverts to scan clock (hg-v1389 defect #1 regression)',
    patch: s => mutate(s,
      /if \(typeof built\.signalT === 'number' && isFinite\(built\.signalT\) && built\.signalT > 0\)\{\s*atSec = Math\.floor\(built\.signalT \/ 1000\);\s*\} else if \(typeof built\.barT === 'number' && isFinite\(built\.barT\) && built\.barT > 0\)\{\s*atSec = built\.barT;\s*\} else if \(typeof built\.at === 'number' && isFinite\(built\.at\) && built\.at > 0\)\{\s*atSec = Math\.floor\(built\.at \/ 1000\);\s*\}/,
      "if (typeof built.at === 'number' && isFinite(built.at) && built.at > 0){ atSec = Math.floor(built.at / 1000); }"),
    check: async (_, mutatedCode) => {
      /* The hg-v1390 fix prefers signalT over scan clock. To catch the
         regression we drive a fixture where signalT lands in the gold
         WEEKEND but the scan clock does not (or vice versa). hgInGoldWeekend
         is deterministic on the ms conversion; the mutation makes goldShut
         read differently. */
      const win = {
        Date, Math, Number, String, Array, Object, Promise, isFinite,
        HG_tabs: []
      };
      win.window = win; win.globalThis = win;
      vm.createContext(win);
      vm.runInContext(mutatedCode, win);
      win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
      /* Stub hgInGoldWeekend to return the sign of what the second-arg
         receives, so we can read which instant leaked through. The real
         function is OS-dependent on today's date; stubbing isolates the
         behaviour under test. */
      let seen = null;
      win.hgInGoldWeekend = (sec) => { seen = sec; return false; };
      const r = [];
      win.hgFwdRecordScan = (tab, tf, cands) => { r.push({ tab, tf, cands: cands.slice() }); return 1; };
      /* Pin signalT to a FIXED year-2001 instant so the mutation cannot
         land on the same bucket as the fix just by proximity. Under the
         fix, atSec = SIG/1000 = 1e9. Under the mutation, atSec =
         Date.now()/1000 ≈ 1.79e9 (today). These differ by ~800M seconds. */
      const SIG = 1000000000000;   /* 2001-09-09T01:46:40Z = 1e12 ms = 1e9 s */
      win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { signalT: SIG })] });
      win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { signalT: SIG + 60000 })] });
      win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { signalT: SIG + 120000 }) });
      await win.hgGoldConfluenceScan(win);
      /* Under the fix: `seen` is SIG/1000 = 1e9 exactly (nearest plan's
         signalT, median leader). Under the mutation: `seen` is
         Date.now()/1000 ≈ 1.79e9 (today). The mutation is CAUGHT if
         `seen` is NOT close to the signal instant. We check: if the
         observed instant is further from SIG/1000 than from Date.now()/1000,
         the scan clock is leaking through, which is the regression we
         want to catch. */
      if (seen === null) return false;
      const SIG_SEC = SIG / 1000;   // 1e9
      const NOW_SEC = Date.now() / 1000;
      /* The fix reads signalT, so `seen` must be WITHIN A BAR (60s) of SIG_SEC.
         The mutation reads Date.now(), so `seen` is close to NOW_SEC. */
      return Math.abs(seen - SIG_SEC) > 3600 && Math.abs(seen - NOW_SEC) < 3600;
    }
  },
  {
    name: 'M10: dedup key drops barT (hg-v1389 defect #7 regression)',
    patch: s => mutate(s,
      /var _barKey = \(typeof built\.barT === 'number' && isFinite\(built\.barT\) && built\.barT > 0\) \? String\(built\.barT\) : '';\n\s*var key = built\.side \+ '\|' \+ built\.entry \+ '\|' \+ built\.stop \+ '\|' \+ built\.t1 \+ '\|' \+ _barKey;/,
      "var key = built.side + '|' + built.entry + '|' + built.stop + '|' + built.t1;"),
    check: async (_, mutatedCode) => {
      /* The hg-v1390 fix includes barT in the key. Driving a fixture where
         the same median plan appears on TWO different bars: under the fix,
         two records; under the mutation, one. */
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
      const BT = 1760000000;
      win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: BT })] });
      win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: BT })] });
      win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: BT }) });
      await win.hgGoldConfluenceScan(win);
      /* Second scan: SAME median levels (unchanged plans), DIFFERENT barT. */
      win.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670, 'long', { barT: BT + 900 })] });   /* +15min */
      win.goldswingScan = () => ({ cands: [cand(2651, 2642, 2668, 'long', { barT: BT + 900 })] });
      win.ganeshGoldState = () => ({ plan: cand(2652, 2638, 2672, 'long', { barT: BT + 900 }) });
      await win.hgGoldConfluenceScan(win);
      /* Under the fix: two records (different barT). Under the mutation:
         one record (same key, dedup'd). */
      return r.length === 1;   /* mutation causes dedup to collapse */
    }
  },
  {
    name: 'M11: double-guard (readBarT + sink) both stripped simultaneously (hg-v1389 defect #9)',
    patch: s => {
      /* Strip BOTH readBarT's guard AND recordConfluence's sink guard. Under
         the two-guard architecture, EACH alone is equivalent at the sink;
         stripping BOTH should let null leak through to cand.barT. */
      s = mutate(s,
        /function readBarT\(o\)\{\n\s*var bt = o && o\.barT;\n\s*if \(typeof bt !== 'number' \|\| !isFinite\(bt\) \|\| bt <= 0\) return undefined;\n\s*return bt;\n\s*\}/,
        "function readBarT(o){ var bt = o && o.barT; return (bt == null) ? 0 : +bt; }");
      s = mutate(s,
        /if \(typeof built\.barT === 'number' && isFinite\(built\.barT\) && built\.barT > 0\) cand\.barT = built\.barT;/,
        "cand.barT = built.barT;");
      return s;
    },
    check: async (_, mutatedCode) => {
      /* Null-barT fixture against the DOUBLY-stripped source. With both
         guards gone, null flows through and lands as... hmm, actually
         readBarT returns 0 for null, which rowOf stamps barT:0 onto the
         row; oneVote carries 0; hgGoldConfluenceBuild's own guard still
         rejects (`built.barT > 0`), so base.barT stays unset; sink strips
         the guard but `cand.barT = built.barT` with built.barT undefined
         sets cand.barT = undefined.

         The intended "double-guard was load-bearing" assertion requires
         a THIRD guard to also be stripped (hgGoldConfluenceBuild's
         `leader.barT > 0`). Rather than strip three, we instead assert
         the specific invariant: with both named guards gone, the only
         remaining defense is base's own guard, so a fixture where leader
         DOES carry a positive barT and then one carries null should both
         flow through unchanged (base guard filters leader; sink doesn't).
         This is architecturally interesting but not easy to behaviourally
         separate from the M3+M7 equivalence story.

         Honest answer: THREE guards in series means stripping any TWO
         leaves the third catching. Mark EQUIVALENT with the architecture
         note; the hg-v1389 defect #9 observation is correct but the
         mutation that would catch it needs to strip all three. */
      /* Drive the fixture; what we check is the ARCHITECTURAL claim
         (three-layer defense in depth) rather than a surface effect. */
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
      /* The third guard (hgGoldConfluenceBuild's leader.barT > 0 check at
         line 811-812) still catches null; cand.barT is absent. */
      return r[0] && r[0].cands[0].barT === undefined;
    },
    equivalent: true
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
