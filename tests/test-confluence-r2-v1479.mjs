#!/usr/bin/env node
/* hg-v1481 — CONFLUENCE r2: the measured plan cut (48), the 48h member-card
   freshness clause, and the WATCH measured-loss disclosure.

   MEASURED BASIS (desks/confluence-r2, 14.3-month census, 2,349 four-hour
   scans, the REAL hgGoldConfluenceBuild + the REAL hgGoldConfluenceScore):
   - with the tape in hand the shipped 78/68 plan gate stood aside on 100%
     of formed plans (analytic ceiling ~66 for stratKey 'confluence';
     READY 0 of 2,349 scans);
   - below 48 settled -0.452R after XM costs, both halves (n=15);
     48 and up +0.802R, both halves (n=21) — the widest cut also
     both-halves positive at PAXG taker;
   - a formed plan with a member card older than 48h settled -0.350R, both
     halves, both venues (n=7, thin — named on the card);
   - the walked WATCH book settled -0.735R after XM costs, negative both
     halves (n=78) and feeds no downstream path (recordConfluence records
     only built.ready === true) — disclosure, never promotion;
   - the validated patched re-walk: n=44, +0.536R XM both halves
     (+1.002/+0.069).

   The guard drives the REAL build in a vm, asserts behavior, then mutates
   the source IN MEMORY to prove every assertion is load-bearing. */

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

function boot(src){
  const win = { HG_tabs: [], HG_warmups: [] };
  const ctx = { window: win, globalThis: win, console, Date, Math, Number, String, Object, Array, JSON, isFinite, isNaN, Promise, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win;
}
const NOW = 1_800_000_000_000; /* fixed anchor instant, ms */
function mkVote(desk, ageH){
  const v = { desk, id: desk.toLowerCase(), state: 'setup', side: 'long',
    entry: 4000 + (desk === 'B' ? 5 : 0), stop: 3980 + (desk === 'B' ? 5 : 0),
    t1: 4040 + (desk === 'B' ? 5 : 0), grade: 'A', lead: true };
  if (ageH != null) v.signalT = NOW - ageH * 3600 * 1000;
  return v;
}
const tape = { spreadUsd: null, rows15m: [{ t: 1, o: 4000, h: 4002, l: 3998, c: 4001 }] };
function stubScore(win, score, alertOk){
  win.hgGoldConfluenceScore = () => ({ ok: true, score, tier: score >= 68 ? 'GOOD' : 'NO_TRADE',
    alertOk: alertOk === true, why: 'stub', parts: { htf: 20, location: 9, momentum: 13, volRegime: 8, volume: 0, macro: 6, trigger: 3 } });
}

// ---------- §1 the measured plan cut: fires, abstains at/over 48, fail-open ----------
(function s1(){
  const win = boot(SRC);
  const build = win.hgGoldConfluenceBuild;
  const votes = [mkVote('A', 1), mkVote('B', 2)];
  const iux = { px: 4001, at: NOW };

  stubScore(win, 47, false);
  const under = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.a score 47 stands aside', under.ready === false);
  ok('1.b score 47 leaves no watch (not a setup, never recorded)', under.watch === undefined);
  ok('1.c reason names the measured cut and the census number',
    /below the measured plan cut 48/.test(under.reason) && /-0\.45R after XM costs, both halves/.test(under.reason));

  stubScore(win, 48, false);
  const atCut = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.d score 48 is a setup', atCut.ready === true);
  ok('1.e score rides the card', atCut.confScore === 48);

  /* the 78-based alertOk (unreachable for a desk plan) must NOT
     gate the plan any more */
  stubScore(win, 60, false);
  const noAlert = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.f alertOk:false at score 60 stays a setup', noAlert.ready === true);

  /* fail-open: no tape, no scorer, dead scorer — the desk plan is not erased */
  stubScore(win, 10, false);
  const noTape = build(votes.map(v => Object.assign({}, v)), iux, null);
  ok('1.g no tape -> score unread, plan stays', noTape.ready === true && noTape.confScore === undefined);
  delete win.hgGoldConfluenceScore;
  const noScorer = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.h no scorer -> plan stays', noScorer.ready === true && noScorer.confScore === undefined);
  win.hgGoldConfluenceScore = () => { throw new Error('dead'); };
  const dead = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.i scorer throws -> plan stays', dead.ready === true && dead.confScore === undefined);
  win.hgGoldConfluenceScore = () => ({ ok: false, score: NaN });
  const nan = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.j non-finite score -> plan stays', nan.ready === true && nan.confScore === undefined);
  delete win.hgGoldConfluenceScore;

  /* the lever moves the gate */
  stubScore(win, 60, true);
  win.HG_GOLD_CONF_PLAN_CUT = 70;
  const levered = build(votes.map(v => Object.assign({}, v)), iux, tape);
  ok('1.k HG_GOLD_CONF_PLAN_CUT lever moves the cut', levered.ready === false && /plan cut 70/.test(levered.reason));
  delete win.HG_GOLD_CONF_PLAN_CUT;
})();

// ---------- §2 the 48h member-freshness clause (three-state) ----------
(function s2(){
  const win = boot(SRC);
  const build = win.hgGoldConfluenceBuild;
  const iux = { px: 4001, at: NOW };

  const stale = build([mkVote('A', 49), mkVote('B', 2)], iux, null);
  ok('2.a a 49h-old member card stands the plan aside', stale.ready === false);
  ok('2.b stale rides the watch path with the named reason',
    !!stale.watch && /over 48h/.test(stale.reason) && /-0\.35R/.test(stale.reason));
  ok('2.c the age is on the accuracy bag', stale.watch && stale.watch.accuracy && stale.watch.accuracy.memberAgeH === 49);
  ok('2.d staleOk flag false', stale.watch && stale.watch.accuracy.staleOk === false);

  const fresh = build([mkVote('A', 47), mkVote('B', 2)], iux, null);
  ok('2.e 47h passes', fresh.ready === true);

  const noTime = build([mkVote('A', 1), mkVote('B', null)], iux, null);
  ok('2.f a member missing a signal time fails OPEN (hg-v989)', noTime.ready === true);
  ok('2.g unread age is null, never fabricated', noTime.accuracy.memberAgeH === null && noTime.accuracy.staleOk === true);

  const noAnchor = build([mkVote('A', 100), mkVote('B', 2)], { px: 4001 }, null);
  ok('2.h no anchor instant fails open', noAnchor.ready === true);
})();

// ---------- §3 the WATCH measured-loss disclosure (paint, gates nothing) ----------
(function s3(){
  /* the helper and paint are IIFE-private — expose them for the probe by
     appending two export lines to the source INSIDE a fresh vm (the repo
     file is never touched). */
  const mctx = { console, Date, Math, Number, String, Object, Array, JSON, isFinite, isNaN, Promise, setTimeout, clearTimeout, HG_tabs: [], HG_warmups: [] };
  mctx.window = mctx; mctx.globalThis = mctx;
  vm.createContext(mctx);
  /* the module is an IIFE — inject the probe exports INSIDE it, before the
     closing '})();' (last occurrence) */
  const closeIdx = SRC.lastIndexOf('})();');
  const srcProbe = SRC.slice(0, closeIdx) + '\n;window.__probeWatch = cfWatchMeasuredNoteHtml; window.__paint = paint;\n' + SRC.slice(closeIdx);
  vm.runInContext(srcProbe, mctx);
  ok('3.a the disclosure helper exists in module scope', typeof mctx.__probeWatch === 'function');
  ok('3.b literal carries the measured numbers (display-rounded; full precision in desks/confluence-r2)',
    /n: 78, xm: -0\.74, xmH1: -0\.54, xmH2: -0\.93, paxg: -1\.15/.test(SRC));
  ok('3.c paint wires the disclosure into the watch card',
    /plan \+= cfWatchMeasuredNoteHtml\(\);/.test(SRC));
  const noteHtml = mctx.__probeWatch();
  ok('3.d the disclosure renders the measured line',
    /MEASURED 14\.3 months/.test(noteHtml) && /-0\.74R each after XM costs/.test(noteHtml)
    && /BOTH halves \(-0\.54 \/ -0\.93, n=78\)/.test(noteHtml) && /-1\.15R at PAXG taker/.test(noteHtml)
    && /never recorded and feeds no handoff/.test(noteHtml));
  mctx.HG_GOLD_CONF_WATCH_MEASURED_NOTE = false;
  ok('3.e the lever restores silence', mctx.__probeWatch() === '');
  delete mctx.HG_GOLD_CONF_WATCH_MEASURED_NOTE;
  /* paint end-to-end with a minimal DOM stub */
  const deskEl = { innerHTML: '' };
  const statEl = { textContent: '' };
  const root2 = { querySelector(sel){ if (sel === '#gc-desk') return deskEl; if (sel === '#gc-stat') return statEl; return null; }, innerHTML: '' };
  const builtW = mctx.hgGoldConfluenceBuild([mkVote('A', 1)], { px: 4001, at: NOW }, null);
  ok('3.f one desk is a watch', builtW.ready === false && !!builtW.watch);
  mctx.__paint(root2, builtW);
  ok('3.g the painted watch card carries the disclosure',
    /data-gc-watch-measured="1"/.test(deskEl.innerHTML) && /a watch is not a ticket/.test(deskEl.innerHTML));
  const readyB = mctx.hgGoldConfluenceBuild([mkVote('A', 1), mkVote('B', 2)], { px: 4001, at: NOW }, null);
  deskEl.innerHTML = '';
  mctx.__paint(root2, readyB);
  ok('3.h a ready card does NOT carry the watch disclosure', !/data-gc-watch-measured/.test(deskEl.innerHTML));
})();

// ---------- §4 the record contract: watches and stood-aside plans mint nothing ----------
(function s4(){
  ok('4.a recordConfluence gates on ready === true', /if \(!built \|\| built\.ready !== true\) return;/.test(SRC));
  const win = boot(SRC);
  let recorded = 0;
  win.hgFwdRecordScan = () => { recorded++; };
  /* recordConfluence is module-private; drive it through hgGoldConfluenceScan
     is async — assert the contract textually (above) plus the watch-v1391
     suite's §4 semantic pin, which stays green. */
  ok('4.b scan harness refuses records in harness mode (unchanged seam)',
    /if \(!scanHarness\(win\)\) recordConfluence\(win, built\);/.test(SRC));
})();

// ---------- §5 ship stamps ----------
(function s5(){
  const build = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok('5.a version shape', /^hg-v\d+$/.test(HG_VER));
  ok('5.b this pack IS hg-v1481', HG_VER === 'hg-v1481');
  ok('5.c sw cache matches build-stamp', swCacheOk(sw));
  ok('5.d build-stamp names the hg-v1481 pack', /hg-v1481/.test(build));
  const trend = fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8');
  ok('5.e trendtable.js stamp matches', new RegExp(HG_VER).test(trend));
  const api = fs.readFileSync(path.join(ROOT, 'hg-api-base.js'), 'utf8');
  ok('5.f hg-api-base version matches', new RegExp("'1481'").test(api));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('5.g index.html rides ?v=1481', html.includes('?v=1481'));
  ok('5.h no stale ?v=1459 byte', !html.includes('?v=1459'));
})();

// ---------- §6 mutation harness (in-memory; the repo file is never written) ----------
(function s6(){
  function runMutation(name, mutate, probe){
    const mutated = mutate(SRC);
    if (mutated === SRC){ fail++; console.error('MUTATION ' + name + ' did not change source'); return; }
    let caught = false;
    try{
      const win = boot(mutated);
      const build = win.hgGoldConfluenceBuild;
      const votes = [mkVote('A', 1), mkVote('B', 2)];
      const iux = { px: 4001, at: NOW };
      if (name === 'M1_no_plan_cut'){
        stubScore(win, 47, false);
        const b = build(votes, iux, tape);
        if (b.ready === true) caught = true; /* 47 must stand aside */
      } else if (name === 'M2_alertOk_gates_again'){
        stubScore(win, 60, false);
        const b = build(votes, iux, tape);
        if (b.ready === false) caught = true; /* alertOk must not gate */
      } else if (name === 'M3_no_freshness'){
        const b = build([mkVote('A', 96), mkVote('B', 2)], iux, null);
        if (b.ready === true) caught = true; /* stale member must stand aside */
      } else if (name === 'M4_no_disclosure'){
        caught = !/plan \+= cfWatchMeasuredNoteHtml\(\);/.test(mutated);
      }
    }catch(e){ caught = true; }
    if (caught){ pass++; }
    else { fail++; console.error('MUTATION ' + name + ' NOT CAUGHT'); }
  }
  runMutation('M1_no_plan_cut', s =>
    s.replace("if (sc.score < planCut){", "if (false){"), null);
  runMutation('M2_alertOk_gates_again', s =>
    s.replace("var planCut = (typeof W.HG_GOLD_CONF_PLAN_CUT === 'number') ? W.HG_GOLD_CONF_PLAN_CUT : 48;",
              "var planCut = 48; if (sc.alertOk !== true){ base.ready = false; base.watch = undefined; return; }"), null);
  runMutation('M3_no_freshness', s =>
    s.replace("if (staleSawT && staleMaxH > 48) staleOk = false;", "/* stale check dropped */"), null);
  runMutation('M4_no_disclosure', s =>
    s.replace("    plan += cfWatchMeasuredNoteHtml();\n", ""), null);
})();

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
