#!/usr/bin/env node
/* hg-v1416 note: the §version pins ride the current tree stamp again
   (hg-v1414 -> hg-v1416) after the hg-v1416 PURE GOLD admission-floor bump re-stamped
   build-stamp/sw/trendtable — 'Sister suites re-pinned'
   convention. Behavior pins unchanged. */
/* hg-v1403 note: the §version pins were re-pinned hg-v1304 -> hg-v1403 at
   the hg-v1403 restore (the pack lands at hg-v1403). All behavior pins
   unchanged; mutation proof re-run at hg-v1403 (wrong-side plans still
   fail all three sites). */
/* hg-v1404 note: the §version pins ride the current tree stamp again
   (hg-v1403 -> hg-v1404) after the hg-v1404 OMNIGOLD bump re-stamped
   build-stamp/sw/trendtable — 'Sister suites re-pinned' convention.
   Behavior pins unchanged. */
/* hg-v1304 — direction geometry invariant at the three OMNIBTC engine
   ingest sites, closing the hg-v1303 medium-confidence defensive gap (a).

   The user showed a long with TP1 4198.84 BELOW entry 4202.31 — a target
   that can only be hit on a losing move. Three sites admitted it:

   1. hasLevels in omnibtc-engines.js — finite/positive but no direction.
   2. hgObtcHasLevels fallback in omnibtc.js — same, when hgSetupHasLevels
      is not loaded (headless Node, early boot).
   3. hgObtcCandidateFromSignal at the ingest site in omnibtc.js — same,
      so inverted plans entered `all` and were published to
      snap.candidates where every downstream reader (COMBI, SETUP
      CONFIRM, CONTRACT REPORT, forward ledger) could surface them.

   This guard drives each real function via vm sandbox lift (hg-v1022)
   and asserts:
     - every well-formed long/short passes
     - every wrong-side plan is refused
     - unknown direction still passes (picker resolves later)
     - no legitimate plan is regressed

   Mutation pass runs on the shipped source: flip each sign in each
   check, expect caught. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

/* ---------- helpers to lift the three real functions ---------- */

function liftEnginesHasLevels(src){
  /* The function is wrapped in an IIFE; lift fin+dirOf+hasLevels into a
     sandbox that evaluates them stand-alone. */
  const finRe = /function fin\(v\)\{[\s\S]*?\n  \}/;
  const dirRe = /function dirOf\(v\)\{[\s\S]*?\n  \}/;
  const hasRe = /function hasLevels\(r\)\{[\s\S]*?\n  \}/;
  const finM = src.match(finRe); if (!finM) throw new Error('fin not found in engines');
  const dirM = src.match(dirRe); if (!dirM) throw new Error('dirOf not found in engines');
  const hasM = src.match(hasRe); if (!hasM) throw new Error('hasLevels not found in engines');
  const code = finM[0] + '\n' + dirM[0] + '\n' + hasM[0] + '\nreturn hasLevels;';
  return new Function(code)();
}

function liftObtcHasLevels(src){
  /* Lift fin + hgObtcHasLevels. Stub W/gfn so delegation to plans.js is
     disabled — the fallback branch is what we test. */
  const finRe = /function fin\(v\)\{[\s\S]*?\n  \}/;
  const hasRe = /function hgObtcHasLevels\(row\)\{[\s\S]*?\n  \}/;
  const finM = src.match(finRe); if (!finM) throw new Error('fin not found in omnibtc');
  const hasM = src.match(hasRe); if (!hasM) throw new Error('hgObtcHasLevels not found');
  const code =
    'var W = {}; var gfn = function(){ return false; };\n' +
    finM[0] + '\n' + hasM[0] + '\nreturn hgObtcHasLevels;';
  return new Function(code)();
}

function liftCandidateFromSignal(src){
  /* Lift fin + isDerivedSource + hgObtcIsBtc + hgObtcCandidateFromSignal.
     Stub W/gfn to disable live-formation. */
  const finRe = /function fin\(v\)\{[\s\S]*?\n  \}/;
  const isDerRe = /function isDerivedSource\(src\)\{[\s\S]*?\n  \}/;
  const isBtcRe = /function hgObtcIsBtc\(sym\)\{[\s\S]*?\n  \}/;
  const candRe = /function hgObtcCandidateFromSignal\(r, ticker, opts\)\{[\s\S]*?\n  \}/;
  const finM = src.match(finRe); if (!finM) throw new Error('fin not found');
  const derM = src.match(isDerRe); if (!derM) throw new Error('isDerivedSource not found');
  const btcM = src.match(isBtcRe); if (!btcM) throw new Error('hgObtcIsBtc not found');
  const candM = src.match(candRe); if (!candM) throw new Error('hgObtcCandidateFromSignal not found');
  const code =
    'var W = {}; var gfn = function(){ return false; };\n' +
    finM[0] + '\n' + derM[0] + '\n' + btcM[0] + '\n' + candM[0] + '\nreturn hgObtcCandidateFromSignal;';
  return new Function(code)();
}

/* ---------- §1: source-level pins ---------- */
console.log('\n[§1] source-level pins for direction geometry');
{
  const engSrc = read('omnibtc-engines.js');
  const btcSrc = read('omnibtc.js');

  /* engines.js hasLevels pins */
  ok(/if \(dir === 'long'\)\{\s*if \(!\(s < e && t1 > e\)\) return false;/.test(engSrc),
    'engines.js hasLevels: long requires s<e AND t1>e');
  ok(/if \(dir === 'short'\)\{\s*if \(!\(s > e && t1 < e\)\) return false;/.test(engSrc),
    'engines.js hasLevels: short requires s>e AND t1<e');
  ok(/hg-v1304/.test(engSrc), 'engines.js carries hg-v1304 attribution');

  /* omnibtc.js hgObtcHasLevels fallback pins */
  const hasBlock = btcSrc.match(/function hgObtcHasLevels\(row\)\{[\s\S]*?\n  \}/)[0];
  ok(/if \(dir === 'long'\)\{\s*if \(!\(s < e && t1 > e\)\) return false;/.test(hasBlock),
    'hgObtcHasLevels fallback: long requires s<e AND t1>e');
  ok(/if \(dir === 'short'\)\{\s*if \(!\(s > e && t1 < e\)\) return false;/.test(hasBlock),
    'hgObtcHasLevels fallback: short requires s>e AND t1<e');
  ok(/hg-v1304/.test(hasBlock), 'hgObtcHasLevels fallback carries hg-v1304 attribution');

  /* omnibtc.js hgObtcCandidateFromSignal ingest pins */
  const candBlock = btcSrc.match(/function hgObtcCandidateFromSignal\(r, ticker, opts\)\{[\s\S]*?\n  \}/)[0];
  ok(/if \(dir === 'long' && !\(stop < entry && t1 > entry\)\) return null;/.test(candBlock),
    'hgObtcCandidateFromSignal: long requires stop<entry AND t1>entry');
  ok(/if \(dir === 'short' && !\(stop > entry && t1 < entry\)\) return null;/.test(candBlock),
    'hgObtcCandidateFromSignal: short requires stop>entry AND t1<entry');
  ok(/hg-v1304/.test(candBlock), 'hgObtcCandidateFromSignal carries hg-v1304 attribution');
}

/* ---------- §2: engines.js hasLevels behavioural ---------- */
console.log('\n[§2] engines.js hasLevels direction geometry');
{
  const hasLevels = liftEnginesHasLevels(read('omnibtc-engines.js'));

  /* Valid long: s < e < t1 */
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:110 }) === true,
    'valid long passes');
  /* Valid short: s > e > t1 */
  ok(hasLevels({ dir:'short', entry:100, stop:105, t1:90 }) === true,
    'valid short passes');
  /* The user's defect: long with t1 below entry */
  ok(hasLevels({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84 }) === false,
    'user defect refused: long with t1<entry rejected');
  /* Mirror: short with t1 above entry */
  ok(hasLevels({ dir:'short', entry:100, stop:105, t1:110 }) === false,
    'short with t1>entry rejected');
  /* Long with stop above entry (inverted stop) */
  ok(hasLevels({ dir:'long', entry:100, stop:105, t1:110 }) === false,
    'long with stop>entry rejected');
  /* Short with stop below entry (inverted stop) */
  ok(hasLevels({ dir:'short', entry:100, stop:95, t1:90 }) === false,
    'short with stop<entry rejected');
  /* Equal cases (boundary): t1 === entry */
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:100 }) === false,
    'long with t1===entry rejected (strict)');
  ok(hasLevels({ dir:'short', entry:100, stop:105, t1:100 }) === false,
    'short with t1===entry rejected (strict)');
  /* Equal cases: stop === entry (base check catches this) */
  ok(hasLevels({ dir:'long', entry:100, stop:100, t1:110 }) === false,
    'stop===entry rejected (base check)');

  /* t2 geometry */
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:120 }) === true,
    'valid long with t2 passes');
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:98 }) === false,
    'long with t2<entry rejected');
  ok(hasLevels({ dir:'short', entry:100, stop:105, t1:90, t2:85 }) === true,
    'valid short with t2 passes');
  ok(hasLevels({ dir:'short', entry:100, stop:105, t1:90, t2:105 }) === false,
    'short with t2>entry rejected');
  /* t2 at or below zero / NaN is unread, not a veto (per hg-v675 shape) */
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:0 }) === true,
    'long with t2=0 passes (unread, not inverted)');
  ok(hasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:null }) === true,
    'long with t2=null passes (unread)');

  /* Unknown direction passes (picker resolves later) */
  ok(hasLevels({ dir:'', entry:100, stop:95, t1:110 }) === true,
    'unknown dir passes (picker will resolve)');
  ok(hasLevels({ entry:100, stop:95, t1:110 }) === true,
    'missing dir passes');

  /* Side aliases */
  ok(hasLevels({ side:'buy', entry:100, stop:95, t1:110 }) === true,
    'side=buy treated as long');
  ok(hasLevels({ side:'sell', entry:100, stop:95, t1:110 }) === false,
    'side=sell treated as short rejects t1 above entry');

  /* tp alias (engines use t1 OR tp) */
  ok(hasLevels({ dir:'long', entry:100, stop:95, tp:110 }) === true,
    'long reads tp when t1 missing');
  ok(hasLevels({ dir:'long', entry:100, stop:95, tp:95 }) === false,
    'long with tp below entry rejected');

  /* Base-check still catches finite/positive/non-equal */
  ok(hasLevels({ dir:'long', entry:0, stop:95, t1:110 }) === false,
    'entry<=0 rejected');
  ok(hasLevels({ dir:'long', entry:100, stop:null, t1:110 }) === false,
    'null stop rejected');
  ok(hasLevels(null) === false, 'null row rejected');
}

/* ---------- §3: hgObtcHasLevels fallback behavioural ---------- */
console.log('\n[§3] hgObtcHasLevels fallback (plans.js absent) direction geometry');
{
  const hgObtcHasLevels = liftObtcHasLevels(read('omnibtc.js'));

  ok(hgObtcHasLevels({ dir:'long', entry:100, stop:95, t1:110 }) === true,
    'valid long passes');
  ok(hgObtcHasLevels({ dir:'short', entry:100, stop:105, t1:90 }) === true,
    'valid short passes');
  /* User's defect at the fallback level */
  ok(hgObtcHasLevels({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84 }) === false,
    'user defect refused in fallback');
  ok(hgObtcHasLevels({ dir:'short', entry:100, stop:105, t1:110 }) === false,
    'short with t1>entry rejected');
  ok(hgObtcHasLevels({ dir:'long', entry:100, stop:105, t1:110 }) === false,
    'long with stop>entry rejected');
  /* Unknown direction passes */
  ok(hgObtcHasLevels({ entry:100, stop:95, t1:110 }) === true,
    'unknown dir passes');
  /* t2 enforcement */
  ok(hgObtcHasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:120 }) === true,
    'valid long with t2 passes');
  ok(hgObtcHasLevels({ dir:'long', entry:100, stop:95, t1:110, t2:95 }) === false,
    'long with t2<entry rejected');
  /* Null row */
  ok(hgObtcHasLevels(null) === false, 'null row rejected');
}

/* ---------- §4: hgObtcCandidateFromSignal direction geometry at ingest ---------- */
console.log('\n[§4] hgObtcCandidateFromSignal refuses inverted plans at ingest');
{
  const cand = liftCandidateFromSignal(read('omnibtc.js'));
  const tk = { symbol: 'BTCUSD' };

  /* Valid long */
  const r1 = cand({ dir:'long', entry:100, stop:95, t1:110, source:'engine' }, tk);
  ok(r1 && r1.dir === 'long' && r1.entry === 100 && r1.t1 === 110,
    'valid long builds a candidate');

  /* Valid short */
  const r2 = cand({ dir:'short', entry:100, stop:105, t1:90, source:'engine' }, tk);
  ok(r2 && r2.dir === 'short' && r2.t1 === 90,
    'valid short builds a candidate');

  /* User's defect: long with t1 below entry */
  const r3 = cand({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84, source:'engine' },
    { symbol:'BTCUSD' });
  ok(r3 === null,
    'user defect refused at ingest: long with t1<entry returns null');

  /* Mirror cases */
  ok(cand({ dir:'short', entry:100, stop:105, t1:110, source:'engine' }, tk) === null,
    'short with t1>entry rejected');
  ok(cand({ dir:'long', entry:100, stop:105, t1:110, source:'engine' }, tk) === null,
    'long with stop>entry rejected');
  ok(cand({ dir:'short', entry:100, stop:95, t1:90, source:'engine' }, tk) === null,
    'short with stop<entry rejected');

  /* t2 geometry */
  ok(cand({ dir:'long', entry:100, stop:95, t1:110, t2:98, source:'engine' }, tk) === null,
    'long with t2<entry rejected');
  const r4 = cand({ dir:'long', entry:100, stop:95, t1:110, t2:120, source:'engine' }, tk);
  ok(r4 && r4.t1 === 110, 'long with valid t2 passes');

  /* Direction alias */
  const r5 = cand({ side:'buy', entry:100, stop:95, t1:110, source:'engine' }, tk);
  ok(r5 && r5.dir === 'long', 'side=buy resolves to long');
  ok(cand({ side:'buy', entry:100, stop:95, t1:95, source:'engine' }, tk) === null,
    'side=buy with t1<=entry rejected');

  /* Non-BTC still rejected (pre-existing guard) */
  ok(cand({ dir:'long', entry:100, stop:95, t1:110, source:'engine' }, { symbol:'ETHUSD' }) === null,
    'non-BTC rejected by hgObtcIsBtc');

  /* Base validation still fires */
  ok(cand({ dir:'long', entry:0, stop:95, t1:110, source:'engine' }, tk) === null,
    'entry<=0 rejected');
}

/* ---------- §5: no legitimate plan is regressed ---------- */
console.log('\n[§5] no regression on correctly-built plans');
{
  const hasLevels = liftEnginesHasLevels(read('omnibtc-engines.js'));
  const hgObtcHasLevels = liftObtcHasLevels(read('omnibtc.js'));

  /* 100 random well-formed longs: all pass */
  let passLongs = 0;
  for (let i = 0; i < 100; i++){
    const e = 100 + i;
    const row = { dir:'long', entry:e, stop:e - 5, t1:e + 10 };
    if (hasLevels(row) && hgObtcHasLevels(row)) passLongs++;
  }
  ok(passLongs === 100, `all 100 well-formed longs pass (got ${passLongs})`);

  /* 100 random well-formed shorts: all pass */
  let passShorts = 0;
  for (let i = 0; i < 100; i++){
    const e = 100 + i;
    const row = { dir:'short', entry:e, stop:e + 5, t1:e - 10 };
    if (hasLevels(row) && hgObtcHasLevels(row)) passShorts++;
  }
  ok(passShorts === 100, `all 100 well-formed shorts pass (got ${passShorts})`);

  /* 100 inverted longs: all refused */
  let rejectLongs = 0;
  for (let i = 0; i < 100; i++){
    const e = 100 + i;
    const row = { dir:'long', entry:e, stop:e - 5, t1:e - 1 };
    if (!hasLevels(row) && !hgObtcHasLevels(row)) rejectLongs++;
  }
  ok(rejectLongs === 100, `all 100 inverted longs rejected (got ${rejectLongs})`);
}

/* ---------- §6: mutation pass on shipped source ---------- */
console.log('\n[§6] mutation pass on shipped source');
{
  const mutations = [
    /* engines.js hasLevels */
    { file:'omnibtc-engines.js', from:"if (!(s < e && t1 > e)) return false;", to:"if (!(s > e && t1 > e)) return false;", why:'engines: flip long stop sign' },
    { file:'omnibtc-engines.js', from:"if (!(s < e && t1 > e)) return false;", to:"if (!(s < e && t1 < e)) return false;", why:'engines: flip long t1 sign' },
    { file:'omnibtc-engines.js', from:"if (!(s > e && t1 < e)) return false;", to:"if (!(s > e && t1 > e)) return false;", why:'engines: flip short t1 sign' },
    /* omnibtc.js hgObtcHasLevels fallback — same strings in that block */
    { file:'omnibtc.js', from:"if (!(s < e && t1 > e)) return false;", to:"return true;", why:'hgObtcHasLevels: drop long geometry' },
    { file:'omnibtc.js', from:"if (!(s > e && t1 < e)) return false;", to:"return true;", why:'hgObtcHasLevels: drop short geometry' },
    /* omnibtc.js hgObtcCandidateFromSignal ingest */
    { file:'omnibtc.js', from:"if (dir === 'long' && !(stop < entry && t1 > entry)) return null;", to:"", why:'ingest: drop long geometry' },
    { file:'omnibtc.js', from:"if (dir === 'short' && !(stop > entry && t1 < entry)) return null;", to:"", why:'ingest: drop short geometry' },
    { file:'omnibtc.js', from:"if (dir === 'long' && !(stop < entry && t1 > entry)) return null;", to:"if (dir === 'long' && !(stop > entry && t1 > entry)) return null;", why:'ingest: flip long stop sign' },
    { file:'omnibtc.js', from:"if (dir === 'short' && !(stop > entry && t1 < entry)) return null;", to:"if (dir === 'short' && !(stop > entry && t1 > entry)) return null;", why:'ingest: flip short t1 sign' },
  ];

  let caught = 0, total = 0;
  for (const m of mutations){
    total++;
    const original = read(m.file);
    const occurrences = original.split(m.from).length - 1;
    if (occurrences === 0){
      console.log('MUT —', m.why, '→ anchor not found (fixture gap)');
      continue;
    }
    /* Apply only the first occurrence to isolate the behavioural effect. */
    const idx = original.indexOf(m.from);
    const mutated = original.slice(0, idx) + m.to + original.slice(idx + m.from.length);
    fs.writeFileSync(path.join(ROOT, m.file), mutated, 'utf8');
    try {
      /* Re-lift from the mutated source and probe both the user's defect
         and a legitimate plan — a mutation that flips sign will admit the
         user's inverted long; a mutation that drops geometry will admit
         it too. Either admission is "caught". */
      let admittedInverted = false;
      let rejectedValid = false;
      try {
        if (m.file === 'omnibtc-engines.js'){
          const hL = liftEnginesHasLevels(read(m.file));
          if (hL({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84 }) === true) admittedInverted = true;
          if (hL({ dir:'short', entry:100, stop:105, t1:110 }) === true) admittedInverted = true;
          if (hL({ dir:'long', entry:100, stop:95, t1:110 }) === false) rejectedValid = true;
        } else {
          /* omnibtc.js has two sites with the same strings — mutating by
             .indexOf hits the first, which is hgObtcHasLevels. For the
             ingest site, we need to target distinct strings; those
             mutations have unique anchors in the mutations list. */
          const src = read(m.file);
          if (/hgObtcCandidateFromSignal/.test(m.from) ||
              m.from.includes('dir === \'long\' && !(stop') ||
              m.from.includes('dir === \'short\' && !(stop')){
            const cand = liftCandidateFromSignal(src);
            /* Probe both directions — a short-branch mutation would not
               surface on a long probe alone. */
            const rLongInv = cand({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84, source:'engine' }, { symbol:'BTCUSD' });
            if (rLongInv !== null) admittedInverted = true;
            const rShortInv = cand({ dir:'short', entry:100, stop:105, t1:110, source:'engine' }, { symbol:'BTCUSD' });
            if (rShortInv !== null) admittedInverted = true;
            const rLongOk = cand({ dir:'long', entry:100, stop:95, t1:110, source:'engine' }, { symbol:'BTCUSD' });
            if (rLongOk === null) rejectedValid = true;
            const rShortOk = cand({ dir:'short', entry:100, stop:105, t1:90, source:'engine' }, { symbol:'BTCUSD' });
            if (rShortOk === null) rejectedValid = true;
          } else {
            const hL = liftObtcHasLevels(src);
            if (hL({ dir:'long', entry:4202.31, stop:4189.25, t1:4198.84 }) === true) admittedInverted = true;
            if (hL({ dir:'short', entry:100, stop:105, t1:110 }) === true) admittedInverted = true;
            if (hL({ dir:'long', entry:100, stop:95, t1:110 }) === false) rejectedValid = true;
          }
        }
      } catch (e) {
        /* A throw IS a caught mutation (broken syntax after mutation). */
        admittedInverted = false; rejectedValid = false;
      }
      const mutationCaught = admittedInverted || rejectedValid;
      if (mutationCaught){ caught++; console.log('mut ✓ —', m.why); }
      else console.log('MUT SURVIVED —', m.why);
    } finally {
      fs.writeFileSync(path.join(ROOT, m.file), original, 'utf8');
    }
  }
  ok(caught === total, `${caught}/${total} mutations caught`);
}

/* ---------- §7: ship stamps align ---------- */
console.log('\n[§7] ship stamps align');
{
  const bs = read('build-stamp.js');
  const sw = read('sw.js');
  const tt = read('trendtable.js');

  /* hg-v1404: version pins ride the current stamp (re-pinned hg-v1403 ->
     hg-v1404 at the hg-v1404 bump; 'Sister suites re-pinned' convention).
     Behavior pins
     above unchanged. */
  ok(/version:\s*'hg-v1416'/.test(bs), "build-stamp.js version: 'hg-v1416' (re-pinned hg-v1416)");
  ok(/HG_CACHE\s*=\s*'hg-v1416'/.test(sw), "sw.js HG_CACHE = 'hg-v1416' (re-pinned hg-v1416)");
  ok(/hg-v1416/.test(tt), 'trendtable.js stamped hg-v1416 (re-pinned hg-v1416)');
  ok(/\?v=1416/.test(tt), 'trendtable.js uses ?v=1416 (re-pinned hg-v1416)');
}

/* ---------- summary ---------- */
console.log(`\n== hg-v1304 OMNIBTC direction geometry: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
