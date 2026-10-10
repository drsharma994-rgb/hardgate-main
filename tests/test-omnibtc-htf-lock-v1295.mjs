#!/usr/bin/env node
/* HARDGATE — hg-v1295: the OMNIBTC higher-timeframe accuracy lock.

   THE ASK: "Use multiple pine scripts, indicators and core strategies to
   update the omnibtc tab to make most accurate setups only."

   THE AUDIT, said first because it decides everything below. OMNIBTC already
   ran ten voting pine cores, three house indicator reads, ~20 engines, the
   full fundamental stack and the hg-v1292 two-family agreement gate. The one
   real gap was TIMEFRAME COVERAGE: the pine and indicator books read the 4h
   and 1h tapes only. The desk loads a 1d tape and stashes it on every
   candidate (`c._rows1d`), and `hgObtcTapeDir` already reads all four tapes
   for the display line — but `hgObtcApplyPineAccuracy` was handed only
   `(rows4h, cands, rows1h)`. So a crown whose 4h confluence fought the daily
   tape still printed as a full ticket.

   THE FIX IS OPPOSING-ONLY, and that is the whole safety argument:
   - a daily core that DISAGREES demotes the crown to a watch ("1d PINE
     AGAINST") — it can only ever withhold a ticket, never mint one;
   - a daily core that AGREES is disclosed in the note (`1d agrees: ...`) and
     counted NOWHERE, so it cannot grow `fams` and cannot make the hg-v1292
     two-family ticket easier;
   - the 15m tape is DISCLOSED as a three-state read and is never a veto (a
     15m EMA9/21 wiggle must not stand down a 4h swing).
   The existing 4h/1h ticket, oppose and three-way promotion paths are
   unchanged — asserted here by driving the pre-existing paths verbatim.

   WHY NO MEASUREMENT IS OWED FOR THE LOCK (and would be owed for a promote):
   the repo's hg-v966 trap is unmeasured weight that can BOTH flood the ticket
   side and veto. This lock has no promote side at all, which is the same
   asymmetry the gold desks' MTF conjunction (hg-v1016/v1017) has always had.
   The read marks it records are still stamped for the ledger so an eventual
   measurement can settle the daily-vs-4h interaction out of sample.

   Run: node tests/test-omnibtc-htf-lock-v1295.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* hg-v956: ask the ONE helper for the build version instead of hardcoding the
   cache string. The v1291..v1293 ships hardcoded it in their guards and left
   `test-gold-confirmed-lever-flipped.mjs` / `test-gold-unmeasured-and-stale-hold.mjs`
   red on every later bump; this guard must not repeat that defect. */
import { HG_VER, swCacheOk, hgVerGte } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omnibtc.js');

/* Run the real module IIFE (hg-v1022 technique: lift in-context rather than
   exporting a symbol just to test it, hg-v967). */
function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

/* A tape whose bars say which timeframe they came from. */
function bars(kind, n = 320){
  const rows = [];
  for (let i = 0; i < n; i++){
    const drift = kind === 'up' ? 0.004 : kind === 'down' ? -0.004 : 0;
    const px = 100 * Math.pow(1 + drift, i);
    rows.push({ t: 1700000000 + i * 14400, o: px, h: px * 1.002, l: px * 0.998, c: px, v: 100, __kind: kind });
  }
  return rows;
}

function crown(dir = 'long'){
  return {
    tier: 'clean',
    row: {
      sym: 'BTCUSD', dir, entry: 100, stop: 90, t1: 120, t2: 135,
      clean: true, engine: 'SWING clean plan'
    }
  };
}

/* Two fresh cores in two independent families, both reading the bar's own
   label. `dailyDir` decides what the 1d tape says. */
function arm(W, { dailyDir, m15Dir = 'up', h1Dir = null }){
  const want = (rows, d) => (rows && rows[0] && rows[0].__kind === 'day') ? d : (rows && rows[0] && rows[0].__kind === 'h1' && h1Dir ? h1Dir : 'long');
  W.pineHalfTrend = function(rows){ return { dir: want(rows, dailyDir), newLong: true, newShort: false }; };
  W.pineSqueezeMomentum = function(rows){ return { dir: want(rows, dailyDir), newLong: true }; };
  void m15Dir;
}

console.log('== 1) the lever: default ON, reversible, read live ==');
{
  const W = boot();
  ok(typeof W.hgObtcHtfLockOn === 'function', 'hgObtcHtfLockOn is exported for the console and this guard');
  ok(W.hgObtcHtfLockOn() === true, 'the default is ON with no override and no store');
  W.HG_OBTC_HTF_LOCK = false;
  ok(W.hgObtcHtfLockOn() === false, 'window.HG_OBTC_HTF_LOCK = false turns the lock OFF');
  W.HG_OBTC_HTF_LOCK = true;
  ok(W.hgObtcHtfLockOn() === true, 'window.HG_OBTC_HTF_LOCK = true turns it back ON');
  delete W.HG_OBTC_HTF_LOCK;
  W.localStorage.getItem = k => (k === 'hg_obtc_htf_lock' ? '0' : null);
  ok(W.hgObtcHtfLockOn() === false, "localStorage hg_obtc_htf_lock = '0' turns the lock OFF");
  W.localStorage.getItem = k => (k === 'hg_obtc_htf_lock' ? '1' : null);
  ok(W.hgObtcHtfLockOn() === true, "localStorage hg_obtc_htf_lock = '1' leaves it ON");
  /* a throwing store must fail to the SAFE side, never to a crash */
  W.localStorage.getItem = () => { throw new Error('store gone'); };
  ok(W.hgObtcHtfLockOn() === true, 'a throwing store leaves the lock ON (never throws, never fails open)');
}

console.log('== 2) a fresh DAILY core the other way demotes the crown ==');
{
  const W = boot();
  arm(W, { dailyDir: 'short' });
  const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), bars('m15'));
  ok(pick.tier === 'near' && pick.row.clean === false, 'the 4h ticket is stood down by the daily read');
  ok(pick.row.pineRefused === true, 'the stand-down is stamped as a refusal, not a silent drop');
  ok(/1d PINE AGAINST/.test(pick.row.pineNote || ''), 'the note names the daily conflict (' + pick.row.pineNote + ')');
  ok(/HalfTrend/.test(pick.row.pineNote || '') && /Squeeze/.test(pick.row.pineNote || ''),
    'the note names the opposing daily cores');
  ok(Array.isArray(pick.row.htfOppose) && pick.row.htfOppose.length === 2, 'both opposing cores are listed');
  ok(pick.row.htfLock === true, 'the row records that the lock was ON at scan time');
}

console.log('== 3) daily AGREEMENT is disclosed and counts NOWHERE ==');
{
  const W = boot();
  arm(W, { dailyDir: 'long' });
  /* ONE fresh 4h family only: under hg-v1292 this is a watch. If the daily
     agreement were allowed to vote, it would grow `fams` to 2 and mint a
     ticket — that is exactly the promote this pack must not create. So the
     second core must be fresh on the DAILY tape only, never on the 4h. */
  W.pineSqueezeMomentum = function(rows){
    var daily = !!(rows && rows[0] && rows[0].__kind === 'day');
    return daily ? { dir: 'long', newLong: true } : { dir: 'long', newLong: false, barsAgo: 99 };
  };
  const oneFam = crown('long');
  const pick = W.hgObtcApplyPineAccuracy(oneFam, bars('up'), [], null, bars('day'), bars('m15'));
  const fams = pick.row.pineFamilies || [];
  ok(fams.length === 1, 'the 4h book still counts ONE family (' + fams.join(',') + ')');
  ok(!fams.includes('htf') && !fams.includes('daily') && !fams.includes('1d'),
    'the daily read never becomes a family');
  ok(pick.tier === 'near', 'one 4h family stays a watch even with the daily agreeing — the daily mints nothing');
  /* the watch note explains its OWN reason ("only HalfTrend..."), and the lock
     must NOT have fired on an agreeing daily tape */
  ok(!/1d PINE AGAINST/.test(pick.row.pineNote || ''), 'no daily-against lock fires when the daily agrees');
  ok(!(pick.row.htfOppose || []).length, 'nothing is stamped as daily opposition');
  ok(Array.isArray(pick.row.htfAgree) && pick.row.htfAgree.length >= 1, 'the agreeing daily cores are stamped for the ledger');
  /* and on a TICKET the agreement is disclosed in the note — that is where the
     disclosure belongs (a watch is not tradeable, so it is not told).
     NOTE: pineRangeFilter is a TREND core, the same family as HalfTrend — two
     trend cores are ONE vote (that dedupe is the hg-v1292 gate's whole point),
     so the second family here must be FLOW. */
  W.pineSmartMoneyFlow = function(){ return { dir: 'long', newLong: true }; };
  const ticketed = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), null);
  ok(ticketed.tier === 'clean', 'two 4h families (trend + flow) mint a ticket with the daily agreeing');
  ok(/1d agrees/.test(ticketed.row.pineNote || ''), 'the ticket discloses the daily agreement (' + ticketed.row.pineNote + ')');
  const noDaily = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, null);
  ok(noDaily.tier === 'clean', 'the same crown still mints with no daily tape at all');
  ok(/1d tape too thin to read/.test(noDaily.row.pineNote || ''),
    'a ticket on a tape with no daily read says so honestly (' + noDaily.row.pineNote + ')');
}

console.log('== 4) a thin, absent or unreadable daily tape fails OPEN ==');
{
  const W = boot();
  arm(W, { dailyDir: 'short' });
  const noD = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, null);
  ok(noD.tier === 'clean', 'a missing 1d tape leaves the ticket standing (fail open)');
  ok(noD.row.htfRan === 0, 'no daily core is claimed to have run');
  const thin = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day', 100), null);
  ok(thin.tier === 'clean', 'a 100-bar daily tape is below the reader floor and stands nothing down');
  const junk = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, 'not an array', null);
  ok(junk.tier === 'clean', 'junk in place of the daily tape leaves the ticket standing');
  /* a daily book whose ports throw must not refuse the crown */
  W.pineHalfTrend = function(){ throw new Error('daily port exploded'); };
  W.pineSqueezeMomentum = function(){ throw new Error('daily port exploded'); };
  const threw = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), null);
  ok(threw.tier === 'near' || threw.tier === 'clean',
    'a throwing daily port never throws out of the gate (' + threw.tier + ')');
}

console.log('== 5) the lever OFF restores the pre-hg-v1295 board exactly ==');
{
  const W = boot();
  arm(W, { dailyDir: 'short' });
  W.HG_OBTC_HTF_LOCK = false;
  const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), bars('m15'));
  ok(pick.tier === 'clean' && pick.row.clean === true,
    'with the lock OFF a daily-against crown keeps its ticket (the lever is real)');
  ok(!/^1d PINE AGAINST/.test(pick.row.pineNote || ''),
    'the daily stand-down does not fire when the lever is off — it keeps its ticket, not a watch');
  ok(pick.row.htfLock === false, 'the row records the lock was OFF at scan time');
  /* THE HONESTY CASE: with the lever off and the daily OPPOSING, the note must
     say the daily fired and the LEVER withheld it. Reporting "none fresh" would
     be false — the cores did fire. This is the hg-v966 class of defect: a
     disclosure that reads as evidence when it is really the absence of a rule. */
  ok(/1d PINE AGAINST/.test(pick.row.pineNote || '') && /lock OFF/.test(pick.row.pineNote || ''),
    'the lever-OFF disclosure names the daily conflict AND the lever (' + pick.row.pineNote + ')');
  ok(!/none fresh/.test(pick.row.pineNote || ''),
    'the lever-OFF note never claims the daily cores did not fire');
  /* the lever must not be a second, hidden gate: the 4h/1h rules still fire.
     The daily conflict is still DISCLOSED (that is the honesty case above), so
     this asserts the 4h rule's own opening words rather than the absence of 1d. */
  delete W.HG_OBTC_HTF_LOCK;
  W.pineSmartMoneyFlow = function(){ return { dir: 'short', newShort: true }; };
  const still = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), null);
  ok(/^PINE AGAINST/.test(still.row.pineNote || ''),
    'the 4h oppose rule is untouched and still names itself first (' + still.row.pineNote + ')');
}

console.log('== 6) the pre-existing 4h/1h paths are byte-identical ==');
{
  const W = boot();
  /* the exact two-core confirm from the hg-v1292 guard, with NO daily tape */
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true, newShort: false }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  const both = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(both.tier === 'clean' && both.row.clean === true, 'two fresh longs still keep the ticket');
  ok(/PINE CONFIRM/.test(both.row.pineNote || ''), 'the confirm wording is unchanged (' + both.row.pineNote + ')');
  /* the h1 opposing read still stands a crown down, and still names itself */
  W.pineSmartMoneyFlow = function(rows){ return (rows && rows[0] && rows[0].__kind === 'h1')
    ? { dir: 'short', newShort: true } : { dir: 'long', newShort: false, newLong: false }; };
  const h1 = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], bars('h1'), null, null);
  ok(h1.tier === 'near' && /1h PINE AGAINST/.test(h1.row.pineNote || ''),
    'the 1h oppose rule is untouched (' + h1.row.pineNote + ')');
  /* one family + one core still promotes */
  W.pineRangeFilter = function(){ return { dir: 'long', newLong: true }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: false }; };
  const other = { sym: 'BTCUSD', dir: 'long', entry: 101, stop: 91, t1: 121, engine: 'SQUEEZE fired' };
  const core = W.hgObtcApplyPineAccuracy(crown(), bars(280), [other], null, bars('day'), null);
  ok(/PINE \+ CORE/.test(core.row.pineNote || ''), 'the one-family + one-core promotion is untouched');
}

console.log('== 7) the 15m tape is DISCLOSED and is never a veto ==');
{
  const W = boot();
  arm(W, { dailyDir: 'long' });
  const with15 = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, bars('down'));
  ok(with15.tier === 'clean', 'a 15m tape the other way does NOT stand the crown down');
  ok(with15.row.pine15m === 'against', 'the 15m disagreement is stamped as a three-state read (against)');
  const ok15 = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, bars('up'));
  ok(ok15.row.pine15m === 'with', 'a 15m tape the same way stamps with');
  const none = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, null);
  ok(none.row.pine15m === undefined, 'no 15m tape stamps nothing rather than a guessed side');
  const thin = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, bars('m15', 10));
  ok(thin.row.pine15m === undefined || thin.row.pine15m === 'unread',
    'a thin 15m tape is unread, never a side');
}

console.log('== 8) the new marks gate NOTHING, and no gate module reads them ==');
{
  /* the seven gate modules must not name any new key, in either access shape */
  const KEYS = ['htfAgree', 'htfOppose', 'htfRan', 'htfLock', 'htfLocked', 'pine15m', 'HG_OBTC_HTF_LOCK', 'hgObtcHtfLockOn'];
  for (const f of ['hg-perfect-setup.js', 'setup-stack.js', 'cryptogates.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js']){
    const src = read(f);
    for (const k of KEYS){
      ok(!src.includes('.' + k), f + ' does not read .' + k + ' on a reads bag');
      ok(!src.includes("['" + k + "']"), f + " does not read ['" + k + "'] on a reads bag");
    }
  }
  /* and the accuracy gate itself must not feed them into a vote vector */
  const g0 = SRC.indexOf('function hgObtcApplyPineAccuracy');
  const endMark = SRC.indexOf("return hgObtcDemoteWatch(pick, 'no fresh pine script", g0);
  const gate = SRC.slice(g0, SRC.indexOf('\n  }', endMark));
  ok(/fams = hgObtcFamilies\(agreeItems\)/.test(gate), 'fams still comes from the 4h agreeItems only');
  const voteAssign = gate.split('\n').filter(l => /^\s*(var\s+)?(fams|agree|agreeItems|oppose|indAgree|indOppose|h1Agree|h1Oppose|cores)\s*=/.test(l));
  for (const l of voteAssign){
    /* Whole-word matches only. `indAgree` CONTAINS `dAgree` as a substring
       (in-dAgree), so a naive /dAgree/ reports a false positive on the
       legitimate 4h indicator vector — the boundary is what makes this check
       mean anything. Same reasoning for the bare `htf` prefix. */
    ok(!/(?:^|[^A-Za-z])dAgree|(?:^|[^A-Za-z])dOppose|\.htfAgree|\.htfOppose|\.htfLock|\.htfRan|(?:^|[^A-Za-z])pine15m/.test(l),
      'a 4h/1h vote vector is built without the HTF reads: ' + l.trim());
  }
  ok(voteAssign.length >= 5, 'the vote vectors are still built (' + voteAssign.length + ')');
  /* the `indAgree` alternative must not be a prefix match on `dAgree`: the
     filter above has to actually SEE the dAgree line for its check to mean
     anything. Pin that the daily locals are outside the vote-vector set. */
  const dLocals = gate.split('\n').filter(l => /^\s*var dAgree\b/.test(l));
  ok(dLocals.length === 1, 'the daily split is its own local, not a vote vector');
  ok(!voteAssign.some(l => /^\s*var dAgree\b/.test(l)), 'dAgree is not mis-classified as a vote vector');
}

console.log('== 9) the lock is opposing-only BY CONSTRUCTION ==');
{
  /* the daily split may reach exactly two places: the note and the stand-down.
     A promote branch cannot exist, because every `clean`-preserving return
     mentions the daily read only through `dNote`. */
  const g0 = SRC.indexOf('function hgObtcApplyPineAccuracy');
  const g1 = SRC.indexOf('function hgObtcPerfectCandidate', g0);
  const fn = SRC.slice(g0, g1);
  ok(/if \(htfOn && dOppose\.length\)\{/.test(fn), 'the stand-down is guarded by the lever AND an opposing daily read');
  ok(/return hgObtcDemoteWatch\(pick, '1d PINE AGAINST/.test(fn), 'the stand-down is a demote, never a promote');
  ok(!/dAgree\.length\s*\+/.test(fn) && !/fams\.push/.test(fn),
    'the daily agreement is never added to a family count');
  /* hg-v1295 folds the disclosure into `extra`, which every surviving branch
     already consumes — one construction, three readers. Assert BOTH: dNote is
     built once from the daily split, and it reaches all three survivors. */
  const survivors = fn.split('\n').filter(l => /pick\.row\.pineNote = 'PINE/.test(l));
  ok(survivors.length === 3, 'three surviving ticket paths remain (' + survivors.length + ')');
  ok(/var dNote = '';/.test(fn), 'the daily disclosure sentence is built once');
  /* dNote reaches all three survivors: `extra` folds it in (and the CONFIRM
     and +CORE branches consume `extra`), the INDICATOR branch does not consume
     `extra` so it appends dNote itself. Exactly two direct appends + `extra`;
     three would print the daily read twice on the two `extra` branches. */
  const dNoteAppends = fn.split('\n').filter(l => /\+ dNote;/.test(l) && !/dNote =/.test(l));
  ok(dNoteAppends.length === 2, 'the INDICATOR branch appends the disclosure directly (found ' + dNoteAppends.length + ')');
  ok(/^\s*\+ dNote;$/.test(fn.split('\n').filter(l => /\+ dNote;/.test(l) && !/dNote =/.test(l))[0]),
    'the disclosure is folded into `extra` for the other two branches (no double print)');
  const extraLine = fn.split('\n').filter(l => /var extra =/.test(l))[0] || '';
  ok(extraLine.length > 0, 'the shared `extra` line exists');
  ok(fn.split('\n').some(l => /^\s*\+ dNote;$/.test(l)), '`extra` folds dNote in exactly once');
  ok((fn.match(/\+ extra/g) || []).length === 2, 'exactly two branches consume `extra`');
  /* and the daily locals are built BEFORE the vote vectors, so the hg-v1293
     ordering invariant still holds (asserted in § 10 too) */
  ok(fn.indexOf('var dNote') < fn.indexOf('var cores ='), 'the daily disclosure is built before the vote vectors');
  /* and the agreement is stamped for the ledger, never returned as a verdict */
  ok(/pick\.row\.htfAgree = dAgree\.length/.test(fn), 'the agreeing daily cores are stamped on the row for the ledger');
}

console.log('== 10) every record-bank use still precedes every vote assignment ==');
{
  /* the hg-v1293 guard asserts this ordering; the new HTF reads must not
     break it (they are stamped before the vote vectors are built). */
  const g0 = SRC.indexOf('function hgObtcApplyPineAccuracy');
  const endMark = SRC.indexOf("return hgObtcDemoteWatch(pick, 'no fresh pine script", g0);
  const lines = SRC.slice(g0, SRC.indexOf('\n  }', endMark)).split('\n');
  const recLines = [], voteLines = [];
  lines.forEach((l, i) => {
    if (l.includes('pineRecord') || l.includes('recBook') || l.includes('htfRan') || l.includes('htfAgree') || l.includes('htfOppose') || l.includes('pine15m')) recLines.push(i + 1);
    if (/^\s*(var\s+)?(fams|agree|agreeItems|oppose|indAgree|indOppose|h1Agree|h1Oppose|cores)\s*=/.test(l)) voteLines.push(i + 1);
  });
  ok(recLines.length > 0 && voteLines.length > 0, 'both line sets are locatable');
  ok(Math.max(...recLines) < Math.min(...voteLines),
    'every read-bank stamp (' + recLines.join(',') + ') precedes every vote vector (' + voteLines.join(',') + ')');
}

console.log('== 11) textual pins (hg-v956: a rename trips here) ==');
{
  ok(/hg-v1295/.test(SRC), 'omnibtc.js names the hg-v1295 pack');
  ok(/var htfOn = hgObtcHtfLockOn\(\);/.test(SRC), 'the lever is read into htfOn at scan time');
  ok(/if \(rows1d && rows1d\.length >= 120\) dBook = hgObtcPineBook\(rows1d\);/.test(SRC),
    'the daily book is read through the SAME hgObtcPineBook (hg-v949 one home)');
  ok(/hgObtcApplyPineAccuracy\(pick, winnerRows, all, match && match\._rows1, match && match\._rows1d, match && match\._rows15\)/.test(SRC),
    'the live call site hands over the 1d and 15m tapes');
  /* the daily book must not be a second copy of the ports */
  const dIdx = SRC.indexOf('dBook = hgObtcPineBook(rows1d)');
  ok(dIdx > 0 && !/W\[spec\.fn\]\(rows1d/.test(SRC), 'the daily read calls no port directly');
  /* the header documents the new contract (the hg-v1293 lesson: the header is normative) */
  const head = SRC.slice(0, SRC.indexOf("'use strict';"));
  ok(/HTF ACCURACY LOCK/.test(head), 'the header documents the HTF lock');
  ok(/OPPOSING-ONLY/.test(head), 'the header says the lock is opposing-only');
  ok(/hg_obtc_htf_lock/.test(head), 'the header names the localStorage lever');
}

console.log('== 12) ship stamps (via the ONE build-version helper, hg-v956) ==');
{
  ok(hgVerGte(HG_VER, 'hg-v1295'), 'the tree is at or past hg-v1295 (at ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js cache id matches build-stamp.js (' + HG_VER + ')');
  const header = read('trendtable.js').slice(0, 400);
  ok(header.includes(HG_VER), 'the trendtable.js header comment carries ' + HG_VER);
  const api = read('hg-api-base.js');
  ok(api.includes(HG_VER.slice(4)), 'hg-api-base.js carries the numeric cache-buster ' + HG_VER.slice(4));
  ok(/version:\s*'hg-v1295'/.test(SRC) === false, 'omnibtc.js does not itself pin the build version');
  /* and the stamp must not be a literal pin anywhere in THIS guard */
  const self = read('tests/test-omnibtc-htf-lock-v1295.mjs');
  ok(!/version:\s*'hg-v1295'/.test(self), 'this guard does not hardcode the stamp regex (hg-v956)');
}

console.log('== 13) behavioural mutations are caught (the pack must be able to fail) ==');
{
  /* Each mutation edits the real source in memory, boots it, and asserts the
     BEHAVIOUR changed. A guard that cannot fail is not a guard. */
  const mutate = (from, to) => {
    if (!SRC.includes(from)) throw new Error('mutation anchor missing: ' + from);
    return SRC.replace(from, to);
  };
  const bootSrc = (src) => {
    const ctx = {
      console: { log(){}, warn(){}, error(){} },
      Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
      Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
    };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
    ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
    ctx.document = {
      createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
        addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      head: { appendChild(){} }, body: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){}
    };
    vm.createContext(ctx);
    for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js']){
      vm.runInContext(read(f), ctx, { filename: f });
    }
    vm.runInContext(src, ctx, { filename: 'omnibtc.js' });
    return ctx;
  };
  const twoFamilies = (W) => {
    W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };          /* trend */
    W.pineSmartMoneyFlow = function(){ return { dir: 'long', newLong: true }; };     /* flow  */
  };

  /* M1: remove the lever from the stand-down condition -> a daily-against crown
     mints a ticket. This is the mutation that would silently disable the pack. */
  {
    const W = bootSrc(mutate('if (htfOn && dOppose.length){', 'if (dOppose.length){'));
    W.pineHalfTrend = function(rows){ return { dir: (rows[0].__kind === 'day' ? 'short' : 'long'), newLong: true }; };
    W.pineSmartMoneyFlow = function(rows){ return { dir: (rows[0].__kind === 'day' ? 'short' : 'long'), newLong: true }; };
    W.HG_OBTC_HTF_LOCK = false;
    const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), null);
    ok(pick.tier === 'near', 'M1: dropping the lever from the condition lets the lock fire with the lever OFF — caught');
  }
  /* M2: make the daily agreement vote by adding it to the family list -> a
     one-family crown mints fraudulently. The promote this pack forbids. */
  {
    const W = bootSrc(mutate('var fams = hgObtcFamilies(agreeItems);',
      'var fams = hgObtcFamilies(agreeItems); if (dAgree.length) fams.push("htf");'));
    twoFamilies(W);
    W.pineSmartMoneyFlow = function(){ return { dir: 'short', newShort: false, newLong: false, barsAgo: 99 }; };
    const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day'), null);
    ok((pick.row.pineFamilies || []).includes('htf'),
      'M2: pushing the daily read into `fams` is observable — the promote vector is real and is caught');
  }
  /* M3: drop the thin-tape floor -> a 100-bar daily tape is read and can lock. */
  {
    const W = bootSrc(mutate('if (rows1d && rows1d.length >= 120) dBook = hgObtcPineBook(rows1d);',
      'if (rows1d && rows1d.length >= 1) dBook = hgObtcPineBook(rows1d);'));
    W.pineHalfTrend = function(rows){ return { dir: (rows[0].__kind === 'day' ? 'short' : 'long'), newLong: true }; };
    W.pineSqueezeMomentum = function(rows){ return { dir: (rows[0].__kind === 'day' ? 'short' : 'long'), newLong: true }; };
    const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, bars('day', 100), null);
    ok(pick.row.htfRan > 0, 'M3: lowering the daily floor makes a 100-bar tape readable — caught');
  }
  /* M4: let the 15m tape veto instead of disclosing. */
  {
    const W = bootSrc(mutate("    var dNote = '';",
      "    if (m15 && m15 !== String(pick.row.dir || '').toLowerCase()) return hgObtcDemoteWatch(pick, '15m against');\n    var dNote = '';"));
    twoFamilies(W);
    const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, bars('down'));
    ok(pick.tier === 'near', 'M4: turning the 15m disclosure into a veto is observable — caught');
  }
  /* M5: make a MISSING daily tape fail CLOSED (the opposite defect to M1). The
     mutation refuses any crown whose daily tape is absent, which is the
     "no confirmed setups" failure mode this desk has already been bitten by. */
  {
    const W = bootSrc(mutate('var dNote = \'\';',
      'if (!rows1d) return hgObtcDemoteWatch(pick, \'no daily tape\');\n    var dNote = \'\';'));
    twoFamilies(W);
    const pick = W.hgObtcApplyPineAccuracy(crown('long'), bars('up'), [], null, null, null);
    ok(pick.tier === 'near', 'M5: making a missing daily tape fail CLOSED is observable — caught');
  }
}

console.log('\ntest-omnibtc-htf-lock-v1295: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
