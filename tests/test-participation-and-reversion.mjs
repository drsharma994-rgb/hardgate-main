/* HARDGATE — the gold desk's top veto was the clock.

   Live scan, 7 setups, 0 tickets, and the status line shipped in v375 named
   the culprit outright:

     NO TICKETS: participation vetoed 4 of 7 setups (then htf-daily, yield-guard)

   The card it vetoed said this, three lines apart:

     VETO participation  trigger vol 0.39x 20-bar mean
     PASS session        session ASIAN RANGE

   On 1h gold a 20-bar mean spans TWENTY HOURS, so it averages Asia, London
   and New York together. Asian volume is a fraction of London's by
   construction, so an ordinary Asian bar scores ~0.4x and is vetoed for being
   thin when all it is, is three in the morning. The gate was measuring TIME
   OF DAY and calling it participation. Because the desk scans one instrument
   at one moment, that vetoed every card at once.

   The same card carried a second defect. Eleven lines apart, on ONE mechanic:

     VETO    htf-daily      daily EMA10 >= EMA21 - disagrees with the setup
     PASS    regime-fit     a trending tape is what a CONTINUATION mechanic wants
     AGAINST hurst-regime   a REVERSION mechanic against a trending tape

   The mechanic was POC-REVERT. There were THREE definitions of "reversion" in
   omnigold.js and they disagreed: REVERSION_KINDS (a seven-name literal
   written before rounds two, three and four added their detectors), a private
   regex inside hurst-regime, and OG_FAMILY. So VWAP-REVERT, POC-REVERT,
   RSI-DIVERGE and AVWAP-RECLAIM — mechanics whose whole job is fading a move
   — were judged as continuation trades and vetoed by htf-daily and trend for
   disagreeing with the higher timeframe, which is the condition a fade
   REQUIRES.

   The trend gate's own comment already said "vetoing a reversion setup for
   being counter-trend is a category error". The code was right; the
   classification feeding it was wrong.

   Run: node tests/test-participation-and-reversion.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
                   head:{appendChild(){}}, body:{appendChild(){}},
                   documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js',
                   'hg-forward.js', 'hg-gates.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
const gate = (g, k) => (g || []).filter(x => x && x.key === k)[0] || null;

/* A REAL gold session volume profile. This is the whole point: the previous
   tests used uniform random volume, which has no time of day, so the defect
   could not appear in them. */
function sessionMult(hourUTC){
  if (hourUTC < 7)  return 0.35;   /* Asia            */
  if (hourUTC < 13) return 1.50;   /* London          */
  if (hourUTC < 21) return 1.60;   /* New York        */
  return 0.50;                     /* late / rollover */
}
/* Builds N hourly bars ending exactly at `endHour` UTC. lastMult scales the
   FINAL bar against what is normal for its own slot: 1.0 is a perfectly
   ordinary bar for that hour. */
function goldTape(n, endHour, lastMult, seed){
  const out = []; let p = 4350, s = seed || 1;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  /* Anchor so the LAST bar lands on endHour UTC. */
  const endT = Math.floor(1700000000 / 86400) * 86400 + endHour * 3600 + 400 * 86400;
  for (let i = 0; i < n; i++){
    const t = endT - (n - 1 - i) * 3600;
    const h = Math.floor((t % 86400) / 3600);
    p = p * (1 + (rnd() - 0.5) * 0.003);
    const r = p * 0.0018 * (0.5 + rnd());
    let v = 1000 * sessionMult(h) * (0.85 + rnd() * 0.3);
    if (i === n - 1) v = 1000 * sessionMult(h) * lastMult;
    out.push({ t, o: p - r*0.25, h: p + r, l: p - r, c: p, v });
  }
  return out;
}
const HIT = { dir: 'long', kind: 'ORB', mech: 'ORB' };
const part = (rows) => gate(W.hgOgGates(rows, HIT, {}), 'participation');

console.log('== THE DEFECT: an ordinary Asian bar was vetoed for being 3am ==');
{
  /* 03:00 UTC, volume exactly normal FOR 03:00. */
  const rows = goldTape(600, 3, 1.0, 7);
  const flat = (() => {           /* what the old gate computed */
    let s = 0; for (let i = rows.length - 21; i < rows.length - 1; i++) s += rows[i].v;
    return rows[rows.length-1].v / (s / 20);
  })();
  ok(flat < 0.7, 'against a flat 20-bar mean this ordinary bar scores ' + flat.toFixed(2)
    + 'x — under the 0.7 floor, so the old gate VETOED it');
  const p = part(rows);
  ok(p.pass === true, 'against its own time of day it PASSES: ' + p.why);
  ok(/THIS TIME OF DAY/.test(p.why), 'and names the baseline it used');
  ok(/last \d+ sessions/.test(p.why), 'including how many sessions it averaged');
  const ratio = parseFloat(p.why.match(/([\d.]+)×/)[1]);
  ok(Math.abs(ratio - 1.0) < 0.25, 'scoring near 1.00x, which is what "ordinary" means (' + ratio.toFixed(2) + ')');
}

console.log('\n== but a genuinely dead bar is still vetoed, at every hour ==');
{
  for (const [hr, label] of [[3, 'Asia'], [10, 'London'], [15, 'New York']]){
    const p = part(goldTape(600, hr, 0.3, 11));
    ok(p.pass === false, label + ': 0.30x of its OWN slot is still a veto (' + p.why + ')');
  }
}

console.log('\n== and a busy bar passes at every hour, which it did not before ==');
{
  for (const [hr, label] of [[3, 'Asia'], [10, 'London'], [15, 'New York']]){
    const p = part(goldTape(600, hr, 1.2, 13));
    ok(p.pass === true, label + ': 1.20x of its own slot passes');
  }
}

console.log('\n== the correction is not just permissiveness — London is held to London ==');
{
  /* A London bar at 0.6x London is thin. Against a session-mixed mean it
     would look like ~0.9x of the all-hours average and sail through. */
  const rows = goldTape(600, 10, 0.6, 17);
  let s = 0; for (let i = rows.length - 21; i < rows.length - 1; i++) s += rows[i].v;
  const flat = rows[rows.length-1].v / (s / 20);
  ok(flat > 0.7, 'the flat mean scores this thin London bar ' + flat.toFixed(2) + 'x — it would have PASSED');
  ok(part(rows).pass === false, 'against London itself it is correctly vetoed');
}

console.log('\n== too little history falls back, and says so rather than pretending ==');
{
  const p = part(goldTape(12, 3, 1.0, 19));
  ok(p.why.length > 0, 'a short tape still produces a reason');
  ok(!/THIS TIME OF DAY/.test(p.why), 'it does not claim a per-slot baseline it has not got');
  ok(/too little history/.test(p.why) || /no volume/.test(p.why),
     'it says which baseline it fell back to: ' + p.why);
}

console.log('\n== a null volume reads UNCHECKED, not 0.00x — the isFinite(null) trap ==');
{
  const rows = goldTape(600, 10, 1.0, 23);
  rows[rows.length-1].v = null;
  const p = part(rows);
  ok(p.pass !== false, 'a null trigger volume is not a veto (+null is 0 and isFinite(0) is true)');
  ok(!/0\.00×/.test(p.why), 'and it never prints 0.00x as though it measured something');
  ok(/fin\(lastBar\.v\)/.test(GOLD), 'gold reads it with fin, not num');
  ok(/fin\(rows\[rows\.length - 1\]\.v\)/.test(ROUTE), 'and so does omniroute');
}

console.log('\n== both desks got the correction, not just the one that was reported ==');
{
  /* The baseline moved to hg-gates.js — it was byte-identical in both desks
     (1,330 chars, verbatim), which is the whole reason it now lives once. */
  const SHARED = fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  ok(/function hgSlotMeanVol\(rows, want\)/.test(SHARED), 'the shared module has the per-slot baseline');
  ok(/function hgBarSpacingSec\(rows\)/.test(SHARED), 'and derives bar spacing from the tape, not an assumption');
  ok(/n >= 5 && sum > 0/.test(SHARED), 'refusing a baseline built from under five bars');
  ok(/dt >= 86400/.test(SHARED), 'and skipping the correction on daily bars, which have no intraday slot');
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(/w\.hgSlotMeanVol\(rows, want\)/.test(src), n + ' delegates to it');
    ok(!/function hgBarSpacingSec\(rows\)\{?\s*\n\s*if \(!rows/.test(src),
       n + ' keeps no second copy');
  }
}

console.log('\n== ONE definition of reversion, and the three gates now agree ==');
{
  ok(typeof W.hgOgGates === 'function', 'the gold ledger is available');
  ok(!/var REVERSION_KINDS = \{/.test(GOLD), 'the seven-name literal is gone');
  ok(!/\/REVERT\|FADE\|MAGNET\|SWEEP\|JUDAS\|SPRING\//.test(GOLD), "hurst-regime's private regex is gone");
  ok(/function hgOgIsReversion\(kind\)/.test(GOLD), 'there is one derivation');
  ok(/f === 'REVERSION' \|\| f === 'SWEEP'/.test(GOLD), 'taken from the family map consensus already uses');

  /* The four mechanics that were misjudged. */
  const rows = goldTape(600, 10, 1.2, 29);
  for (const kind of ['POC-REVERT', 'VWAP-REVERT', 'RSI-DIVERGE', 'AVWAP-RECLAIM']){
    /* Daily stack UP, setup SHORT: the higher timeframe disagrees, which is
       exactly the condition a fade requires. */
    const g = W.hgOgGates(rows, { dir: 'short', kind: kind, mech: kind },
                          { htf: { e21: 4400, e50: 4300 } });
    const d1 = gate(g, 'htf-daily'), tr = gate(g, 'trend');
    ok(d1.pass !== false, kind + ' is no longer vetoed by htf-daily for being a fade');
    ok(/reversion setup/.test(d1.why), 'and the reason says why: ' + d1.why);
    ok(tr.pass !== false, kind + ' is no longer vetoed by trend either');
    ok(/what this setup IS|trend agrees/.test(tr.why), 'trend calls it context, not a contradiction');
  }
}

console.log('\n== the same card no longer contradicts itself ==');
{
  /* The live failure: htf-daily said continuation, regime-fit said
     continuation, hurst-regime said reversion — one mechanic, one card. */
  const rows = goldTape(600, 10, 1.2, 31);
  const g = W.hgOgGates(rows, { dir: 'short', kind: 'POC-REVERT', mech: 'POC-REVERT' },
                        { htf: { e21: 4400, e50: 4300 } });
  const says = k => String((gate(g, k) || {}).why || '');
  const calls = k => /continuation mechanic/.test(says(k)) ? 'continuation'
                   : /reversion/i.test(says(k)) ? 'reversion' : 'silent';
  const verdicts = ['htf-daily', 'regime-fit', 'hurst-regime'].map(calls).filter(v => v !== 'silent');
  ok(verdicts.length > 0, 'at least one of the three classifies POC-REVERT (' + verdicts.join(', ') + ')');
  ok(verdicts.every(v => v === 'reversion'),
     'and NONE of them calls it a continuation mechanic any more (' + verdicts.join(', ') + ')');
}

console.log('\n== the mechanics that were already right did not change ==');
{
  const rows = goldTape(600, 10, 1.2, 37);
  /* Every name from the old seven-name literal must still read as reversion. */
  for (const kind of ['SPRING', 'UTAD', 'VALUE', 'ABSORB', 'ADR-FADE', 'ROUND-MAGNET', 'KZ-JUDAS']){
    const g = W.hgOgGates(rows, { dir: 'short', kind: kind, mech: kind }, { htf: { e21: 4400, e50: 4300 } });
    ok(gate(g, 'htf-daily').pass !== false, kind + ' still exempt — no regression from the old list');
  }
  /* And a genuine continuation mechanic must STILL be vetoed. */
  for (const kind of ['ORB', 'MMOVE', 'PO3', 'BOS-RETEST']){
    const g = W.hgOgGates(rows, { dir: 'short', kind: kind, mech: kind }, { htf: { e21: 4400, e50: 4300 } });
    ok(gate(g, 'htf-daily').pass === false,
       kind + ' is a continuation mechanic and is STILL vetoed against the daily stack');
  }
}

console.log('\n== the ledger is intact ==');
{
  const g = W.hgOgGates(goldTape(600, 10, 1.2, 41), HIT, {});
  ok(g.length > 25, 'the gold ledger still has ' + g.length + ' gates');
  ok(g.every(x => x && typeof x.key === 'string' && 'pass' in x && 'why' in x), 'each with a key, verdict and reason');
  ok(g.every(x => x.pass === true || x.pass === false || x.pass === null), 'no verdict is undefined');
  ok(g.every(x => !/undefined|NaN/.test(String(x.why))), 'and no reason contains undefined or NaN');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PARTICIPATION AND REVERSION TESTS PASSED');
