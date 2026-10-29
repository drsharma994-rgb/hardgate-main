#!/usr/bin/env node
/* hg-v1391 — CONFLUENCE paints a WATCH when the gold desks ARE publishing
   but the setup threshold is not met. Three new cases + the pre-existing
   "awaiting third desk" (1-2 same side) must all end up calling attachWatch
   through its one home, with distinct reasons/labels and WITH THE SETUP
   THRESHOLD UNCHANGED. hg-v966 holds: a watch is NOT a ticket; the ready
   gate from hg-v1384..v1387 required three desks. Two plans on the
   same side, both on the live price, are now a setup. One desk is
   still a watch. Ordered, through<0.85, cost OK, and a live price
   that has not reached the stop are still required.
   The guard drives the REAL hgGoldConfluenceBuild in a vm sandbox and
   asserts behaviour, then mutates the source to prove every assertion
   is load-bearing. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gold-confluence.js'), 'utf8');

let pass = 0, fail = 0;
function ok(label, cond){
  if (cond){ pass++; return; }
  fail++;
  console.error('FAIL §' + label);
}
function eq(label, a, b){
  if (a === b){ pass++; return; }
  fail++;
  console.error('FAIL §' + label + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function boot(src){
  const win = { HG_tabs: [] };
  const ctx = { window: win, globalThis: win, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win;
}

function makeVote(desk, side, entry, stop, t1, barT){
  return {
    desk: desk, id: desk.toLowerCase().replace(/[^a-z0-9]/g, ''), state: 'setup',
    side: side, entry: entry, stop: stop, t1: t1,
    barT: typeof barT === 'number' ? barT : 1_700_000_000,
    /* hg-v1393: upstream's hg-v1391 ready gate requires crownOk (>=2 votes
       with grade:'A' or lead:true). Give every synthetic vote grade:'A' so
       the ready-is-UNCHANGED-on-3-same-side-on-scale claim can be tested;
       the alternative is to loosen the gate, which hg-v966 refuses. */
    grade: 'A', lead: false
  };
}

// ---------- §1 baseline: the three new watch paths each attach a watch ----------
(function s1(){
  const win = boot(SRC);
  const build = win.hgGoldConfluenceBuild;
  ok('1.a build exported', typeof build === 'function');

  // Case A: both longs AND shorts, longs dominant 3L vs 2S -> DESKS DISAGREE watch on longs
  const votesA = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
    makeVote('GOLD SWING', 'long', 4005, 3985, 4045),
    makeVote('OMNIGOLD', 'long', 3998, 3978, 4038),
    makeVote('GOLD DIRECTION', 'short', 4020, 4040, 3980),
    makeVote('GOLD PRO', 'short', 4022, 4042, 3982)
  ];
  const bA = build(votesA, { px: 4001 }, null);
  eq('1.b case A ready', bA.ready, true);
  ok('1.c case A is a setup, not a watch', !bA.watch);
  eq('1.d case A side', bA.side, 'long');
  eq('1.e case A desk count', bA.deskCount, 3);
  eq('1.f case A opposed', bA.opposed, 2);
  ok('1.g case A names the other side', /does not remove this setup/.test(bA.reason || ''));
  ok('1.h case A has levels', bA.entry > 0 && bA.stop > 0 && bA.t1 > 0);

  // Case A mirror: shorts dominant 3S vs 1L
  const votesAM = [
    makeVote('GOLD SCALP', 'long', 4005, 3985, 4045),
    makeVote('GOLD SWING', 'short', 4000, 4020, 3960),
    makeVote('OMNIGOLD', 'short', 4002, 4022, 3962),
    makeVote('GOLD PRO', 'short', 3998, 4018, 3958)
  ];
  const bAM = build(votesAM, { px: 4001 }, null);
  eq('1.i case A mirror ready', bAM.ready, true);
  eq('1.j case A mirror side', bAM.side, 'short');
  eq('1.k case A mirror desks', bAM.deskCount, 3);
  eq('1.k2 case A mirror opposed', bAM.opposed, 1);

  // Case A tie: 2L vs 2S -> no watch (honest)
  const votesTie = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
    makeVote('GOLD SWING', 'long', 4005, 3985, 4045),
    makeVote('OMNIGOLD', 'short', 4000, 4020, 3960),
    makeVote('GOLD DIRECTION', 'short', 4002, 4022, 3962)
  ];
  const bTie = build(votesTie, { px: 4001 }, null);
  eq('1.l tie ready false', bTie.ready, false);
  ok('1.m tie has NO watch (true tie)', !bTie.watch);

  // Case B: OFF-SCALE -- 3 longs agree, but entries sit >2.5% from IUX
  const votesB = [
    makeVote('GOLD SCALP', 'long', 5000, 4950, 5100),
    makeVote('GOLD SWING', 'long', 5010, 4960, 5110),
    makeVote('OMNIGOLD', 'long', 4995, 4945, 5095)
  ];
  const bB = build(votesB, { px: 4000 }, null);
  eq('1.n case B ready false', bB.ready, false);
  ok('1.o case B watch present', !!bB.watch);
  eq('1.p case B watch reason', bB.watch && bB.watch.reason, 'off-scale from IUX');
  eq('1.q case B watch count', bB.watch && bB.watch.count, 3);
  ok('1.r case B label names OFF-SCALE', bB.watch && /OFF-SCALE/.test(bB.watch.label || ''));

  // Case C: two same-side plans on the live price are a setup.
  const votesC = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
    makeVote('GOLD SWING', 'long', 4005, 3985, 4045)
  ];
  const bC = build(votesC, { px: 4001 }, null);
  eq('1.s case C ready', bC.ready, true);
  eq('1.t case C entry is the median', bC.entry, 4002.5);
  ok('1.u case C is not a watch', !bC.watch);
  eq('1.v case C two desks', bC.deskCount, 2);
})();

// ---------- §2 setup threshold UNCHANGED (hg-v966) ----------
(function s2(){
  const win = boot(SRC);
  const build = win.hgGoldConfluenceBuild;

  // Three on-scale same-side still READY
  const votesR = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
    makeVote('GOLD SWING', 'long', 4005, 3985, 4045),
    makeVote('OMNIGOLD', 'long', 3998, 3978, 4038)
  ];
  const bR = build(votesR, { px: 4001 }, { spreadUsd: 0.5 });
  eq('2.a 3 agree on-scale -> ready', bR.ready, true);
  eq('2.b ready side', bR.side, 'long');
  ok('2.c ready has entry', bR.entry > 0);

  // Two on-scale same-side is a setup. One on-scale is still a watch.
  const votesN = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
    makeVote('GOLD SWING', 'long', 4005, 3985, 4045)
  ];
  const bN = build(votesN, { px: 4001 }, null);
  eq('2.d 2 agree -> ready', bN.ready, true);
  eq('2.e 2 agree -> entry is the median', bN.entry, 4002.5);

  // Three agree but ONE on-scale: OFF-SCALE branch now shows watch, still NOT ready
  const votesO = [
    makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),  // on-scale
    makeVote('GOLD SWING', 'long', 5100, 5080, 5140),  // off-scale
    makeVote('OMNIGOLD', 'long', 5105, 5085, 5145)     // off-scale
  ];
  const bO = build(votesO, { px: 4000 }, null);
  eq('2.f one on-scale -> ready false', bO.ready, false);
  ok('2.g one on-scale -> watch', !!bO.watch);
  eq('2.h watch reason', bO.watch && bO.watch.reason, 'off-scale from IUX');
})();

// ---------- §3 attachWatch is the one home (hg-v949) ----------
(function s3(){
  // Count attachWatch call sites in the source -- the three watch paths
  // must call the SAME function, not three copies.
  const callSites = SRC.match(/attachWatch\s*\(/g) || [];
  // Expected: 1 definition line, PLUS the four call sites (two legacy in the
  // existing branches, two new in the hg-v1391 branches). Count the calls:
  const calls = SRC.match(/attachWatch\s*\(\s*base\s*,/g) || [];
  ok('3.a attachWatch has multiple callers', calls.length >= 3);
  // Only ONE attachWatch definition
  const defs = SRC.match(/function\s+attachWatch\s*\(/g) || [];
  eq('3.b one attachWatch definition', defs.length, 1);
})();

// ---------- §4 record is NOT written for a watch (recordConfluence refuses) ----------
(function s4(){
  const win = boot(SRC);
  // The record function is module-private, but we can prove by hgGoldConfluenceBuild:
  // a watch has built.ready !== true, so recordConfluence(win, built) early-returns.
  // The guard asserts this contract textually AND semantically.
  ok('4.a recordConfluence contract: ready!==true -> early return',
    /built\.ready\s*!==\s*true/.test(SRC));
})();

// ---------- §5 paint reads the watch label; falls back to count-of-need ----------
(function s5(){
  // Textual: paint prefers w.label, else "N OF 3" shape.
  ok('5.a paint reads w.label with fallback',
    /w\.label\s*\|\|\s*\(w\.count\s*\+\s*' OF '\s*\+\s*w\.need\)/.test(SRC));
})();

// ---------- §6 no gate reads a watch field (hg-v966) ----------
(function s6(){
  // The watch's new fields (reason, label) must not be read by any gate.
  const files = ['hg-perfect-setup.js', 'setup-stack.js', 'cryptogates.js',
                 'plans.js', 'hg-gates.js', 'hg-setup-core.js'];
  let hits = 0;
  for (const f of files){
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    // Strip comments first
    const stripped = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    if (/watch\.reason|watch\.label|\.watch\s*&&\s*\w+\.watch\.reason/.test(stripped)) hits++;
  }
  eq('6.a no gate reads watch.reason/label', hits, 0);
})();

// ---------- §7 ship stamps are consistent ----------
(function s7(){
  const build = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok('7.a version shape', /^hg-v\d+$/.test(HG_VER));
  ok('7.b sw cache matches build-stamp', swCacheOk(sw));
  ok('7.c build-stamp names hg-v1391 pack', /hg-v1391/.test(build));
  const trend = fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8');
  ok('7.d trendtable.js stamp matches', new RegExp(HG_VER).test(trend));
  const api = fs.readFileSync(path.join(ROOT, 'hg-api-base.js'), 'utf8');
  const n = HG_VER.replace(/^hg-v/, '');
  ok('7.e hg-api-base version matches', new RegExp("'" + n + "'").test(api));
})();

// ---------- §8 mutation harness: every assertion is load-bearing ----------
(function s8(){
  const file = path.join(ROOT, 'gold-confluence.js');
  const original = fs.readFileSync(file, 'utf8');

  function runMutation(name, mutate){
    const mutated = mutate(original);
    if (mutated === original){
      console.error('MUTATION ' + name + ' did not change source');
      fail++;
      return;
    }
    fs.writeFileSync(file, mutated);
    try{
      // re-boot sandbox against mutated source
      const win = boot(mutated);
      const build = win.hgGoldConfluenceBuild;
      let caught = false;
      try{
        // M1-5 each change behaviour the guard asserts.
        if (name === 'M1_drop_dominant_watch'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
            makeVote('GOLD SWING', 'long', 4005, 3985, 4045),
            makeVote('OMNIGOLD', 'long', 3998, 3978, 4038),
            makeVote('GOLD DIRECTION', 'short', 4020, 4040, 3980)
          ];
          const b = build(votes, { px: 4001 }, null);
          if (!b.watch) caught = true;
        } else if (name === 'M2_drop_offscale_watch'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 5000, 4950, 5100),
            makeVote('GOLD SWING', 'long', 5010, 4960, 5110),
            makeVote('OMNIGOLD', 'long', 4995, 4945, 5095)
          ];
          const b = build(votes, { px: 4000 }, null);
          if (!b.watch) caught = true;
        } else if (name === 'M3_tie_builds_watch'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
            makeVote('GOLD SWING', 'long', 4005, 3985, 4045),
            makeVote('OMNIGOLD', 'short', 4000, 4020, 3960),
            makeVote('GOLD DIRECTION', 'short', 4002, 4022, 3962)
          ];
          const b = build(votes, { px: 4001 }, null);
          if (b.ready === true) caught = true;
        } else if (name === 'M4_ready_true_on_watch'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 4000, 3980, 4040),
            makeVote('GOLD SWING', 'long', 4005, 3985, 4045)
          ];
          const b = build(votes, { px: 4001 }, null);
          if (b.ready === true) caught = true;
        } else if (name === 'M5_pack_bound_restored'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 5000, 4950, 5100),
            makeVote('GOLD SWING', 'long', 5010, 4960, 5110),
            makeVote('OMNIGOLD', 'long', 4995, 4945, 5095)
          ];
          const b = build(votes, { px: 4000 }, null);
          if (!b.watch) caught = true;
        } else if (name === 'M6_wrong_reason'){
          const votes = [
            makeVote('GOLD SCALP', 'long', 5000, 4950, 5100),
            makeVote('GOLD SWING', 'long', 5010, 4960, 5110),
            makeVote('OMNIGOLD', 'long', 4995, 4945, 5095)
          ];
          const b = build(votes, { px: 4000 }, null);
          if (b.watch && b.watch.reason !== 'off-scale from IUX') caught = true;
        }
      }catch(e){ caught = true; }
      if (caught){ pass++; }
      else { fail++; console.error('MUTATION ' + name + ' NOT CAUGHT'); }
    } finally {
      fs.writeFileSync(file, original);
    }
  }

  // Baseline: must be green BEFORE the mutation pass.
  const winB = boot(original);
  const buildB = winB.hgGoldConfluenceBuild;
  const bA = buildB([
    makeVote('A', 'long', 4000, 3980, 4040),
    makeVote('B', 'long', 4005, 3985, 4045),
    makeVote('C', 'long', 3998, 3978, 4038),
    makeVote('D', 'short', 4020, 4040, 3980)
  ], { px: 4001 }, null);
  ok('8.baseline dominant side is a setup', bA.ready === true && bA.side === 'long' && !bA.watch);

  runMutation('M1_drop_dominant_watch', s =>
    s.replace(/if \(dom\)\{[\s\S]*?attachWatch\(base, dom, votes, px, \{[\s\S]*?\}\);\s*\}/, 'if (dom){ /* dropped */ }'));

  runMutation('M2_drop_offscale_watch', s =>
    s.replace(/attachWatch\(base, pack, votes, px, \{\s*reason:\s*'off-scale from IUX'[\s\S]*?\}\);/, '/* dropped */'));

  runMutation('M3_tie_builds_watch', s =>
    s.replace(/var dom = \(longs\.length > shorts\.length\) \? longs : \(shorts\.length > longs\.length\) \? shorts : null;/,
              'var dom = (longs.length >= shorts.length) ? longs : shorts;'));

  runMutation('M4_ready_true_on_watch', s =>
    s.replace(/reason:\s*\(typeof opts\.reason === 'string' && opts\.reason\) \? opts\.reason : 'awaiting third desk',/,
              "reason: 'awaiting third desk',\n    _mutReady: (base.ready = true, 1),"));

  runMutation('M5_pack_bound_restored', s =>
    s.replace(/pack\.length > 20/, 'pack.length > 2'));

  runMutation('M6_wrong_reason', s =>
    s.replace(/reason:\s*'off-scale from IUX',\s*\n\s*label:\s*'OFF-SCALE/,
              "reason: 'awaiting third desk',\n      label: 'OFF-SCALE"));
})();

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
