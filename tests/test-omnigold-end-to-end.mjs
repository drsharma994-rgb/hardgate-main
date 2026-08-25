/* HARDGATE — end to end: every strategy and every indicator reaches the setup.

   The sibling tests check the wiring one joint at a time: full-cover asserts
   the three registrations agree, round6 asserts each new mechanic can fire,
   combined-setup asserts the score reads families and info-gates. All three
   can pass while the PIPELINE still drops something in the middle, because
   each one stubs the stage before it.

   This file runs the real chain — hgOgDetect -> hgOgEvaluate -> hgOgPickFor —
   over both horizons and asserts the two properties that matter:

     1. NOTHING IS LOST BETWEEN DETECT AND EVALUATE. Every mechanic that fires
        must become a candidate. A mechanic that fires and is then silently
        dropped shows up nowhere: no card, no pool row, no error.

     2. EVERY INDICATOR READ IS ON EVERY CANDIDATE. The combined score reads
        info-gates through hgOgInfoNet, so a gate missing from some candidates
        would weight those setups differently for a reason nobody chose.

   THE FIXTURE TRAP THIS FILE EXISTS TO AVOID. The first run of this audit
   reported ZERO swing tickets out of 371 candidates and looked like a serious
   defect. It was the fixture: every swing tape was 320 x 4h bars from one
   base, so all of them ended at the same instant — 1704513600, which is a
   Saturday — and weekend-exposure correctly vetoed all 371. Gold's book is
   shut at the weekend and a swing hold across it is a gap bet.
   The tapes below are therefore STAGGERED across the week, and the test
   asserts both horizons produce tickets, so a future change that quietly
   kills one horizon cannot hide behind a calendar artefact.

   Run: node tests/test-omnigold-end-to-end.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
                   'best-levels.js', 'gold-best-levels.js', 'regime.js',
                   'goldind.js', 'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { throw new Error('FAIL: ' + f + ' did not load — ' + e.message); }
  }
  return ctx;
}
const W = boot();
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const mechStart = SRC.indexOf('var OG_MECHANICS');
const MECHS = (SRC.slice(mechStart, SRC.indexOf('];', mechStart)).match(/'[A-Z0-9][A-Z0-9-]*'/g) || [])
  .map(s => s.slice(1, -1));

const T0 = 1700000000 - (1700000000 % 86400);
function tape(seed, n, tfSec, mode, shiftDays){
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const rows = []; let p = 2000 + rnd() * 400;
  const shift = (shiftDays || 0) * 86400;
  for (let i = 0; i < n; i++){
    let d;
    if (mode === 'trend') d = 1.1;
    else if (mode === 'range') d = Math.sin(i / 11) * 4;
    else if (mode === 'spike') d = (i % 37 === 0) ? (rnd() > 0.5 ? 18 : -18) : Math.sin(i / 8) * 3;
    else d = (rnd() - 0.5) * 9;
    p += d + (rnd() - 0.5) * 4;
    const o = p, c = p + (rnd() - 0.5) * 5;
    rows.push({ t: T0 + shift + i * tfSec, o, h: Math.max(o, c) + rnd() * 6,
                l: Math.min(o, c) - rnd() * 6, c, v: 800 + rnd() * 1800 + ((i % 23 === 0) ? 4500 : 0) });
  }
  return rows;
}
const HZ = {
  SCALP: { label:'SCALP', tf:'1h', minRr:1.5, horizonBars:24, warm:60, minAtrPct:0.05, sessionHard:true },
  SWING: { label:'SWING', tf:'4h', minRr:2.0, horizonBars:20, warm:45, minAtrPct:0.12, sessionHard:false }
};

const fired = {}, becameCand = {};
MECHS.forEach(k => { fired[k] = 0; becameCand[k] = 0; });
const gateSeen = {}, infoKeys = new Set();
let nCand = 0, tickets = { SCALP: 0, SWING: 0 }, gateCounts = [];

for (const hz of ['SCALP', 'SWING']){
  const cfg = HZ[hz], tfSec = hz === 'SCALP' ? 3600 : 14400;
  for (const mode of ['trend', 'range', 'spike', 'rand']){
    for (let s = 1; s <= 6; s++){
      /* staggered by seed so the tapes land on different weekdays — see the
         header note on the weekend artefact */
      const rows = tape(s * 7919 + (hz === 'SWING' ? 13 : 0), 300, tfSec, mode, s);
      let hits = [];
      try { hits = W.hgOgDetect(rows, { nowSec: rows[rows.length - 1].t }); } catch (e) { continue; }
      hits.forEach(h => { if (fired[h.kind] !== undefined) fired[h.kind]++; });
      if (!hits.length) continue;
      const livePx = rows[rows.length - 1].c;
      const extra = { htf: null, killzone: null, macro: null, yieldRows: null,
                      nowSec: rows[rows.length - 1].t, adr: W.hgOgAdr(rows, 14),
                      news: null, stats: null, livePx, zoneCtx: null,
                      paxg: livePx * 1.004, srcId: 'gold-spot' };
      let cands = [];
      try { cands = W.hgOgEvaluate(rows, hits, extra, cfg); } catch (e) { continue; }
      nCand += cands.length;
      cands.forEach(c => {
        if (becameCand[c.kind] !== undefined) becameCand[c.kind]++;
        if (c.grade && c.grade.ticket) tickets[hz]++;
        gateCounts.push((c.gates || []).length);
        (c.gates || []).forEach(g => {
          gateSeen[g.key] = (gateSeen[g.key] || 0) + 1;
          if (g.info === true) infoKeys.add(g.key);
        });
      });
    }
  }
}

console.log('\n== the chain runs ==');
ok(nCand > 100, 'the pipeline produced candidates (' + nCand + ')');
ok(gateCounts.length === nCand, 'every candidate carries a gate ledger');

console.log('\n== nothing is lost between detect and evaluate ==');
{
  const firedKeys = MECHS.filter(k => fired[k] > 0);
  ok(firedKeys.length >= 30,
     'a broad set of mechanics fired on the battery (' + firedKeys.length + ' of ' + MECHS.length + ')');
  const lost = firedKeys.filter(k => becameCand[k] === 0);
  ok(lost.length === 0,
     'every mechanic that fired became a candidate' +
     (lost.length ? ' — LOST: ' + lost.join(', ') : ' (' + firedKeys.length + '/' + firedKeys.length + ')'));
}

console.log('\n== every indicator read is on every candidate ==');
{
  ok(infoKeys.size >= 30, 'the ledger carries a deep indicator layer (' + infoKeys.size + ' info reads)');
  /* Present on EVERY candidate, not most: a gate missing from some would
     weight those setups differently for a reason nobody chose. */
  const partial = [...infoKeys].filter(k => gateSeen[k] !== nCand);
  ok(partial.length === 0,
     'every info read appears on all ' + nCand + ' candidates' +
     (partial.length ? ' — partial: ' + partial.map(k => k + '(' + gateSeen[k] + ')').join(', ') : ''));
  /* The reads added for the gold library specifically. */
  for (const k of ['premium-discount', 'gold-season', 'spot-basis']){
    ok(gateSeen[k] === nCand, k + ' is on all ' + nCand + ' candidates');
    ok(infoKeys.has(k), k + ' reaches the combined score as an info read');
  }
}

console.log('\n== both horizons actually produce setups ==');
{
  ok(tickets.SCALP > 0, 'SCALP produces tickets (' + tickets.SCALP + ')');
  /* The assertion the weekend artefact would have hidden. */
  ok(tickets.SWING > 0, 'SWING produces tickets (' + tickets.SWING + ')');
}

console.log('\n== the weekend veto is real, and dated from the scan clock ==');
{
  /* Directly: the same candidate on a Saturday must be vetoed and on a
     Wednesday must not. This is what made the first audit read zero. */
  const sat = 1704513600;                 /* Sat 06 Jan 2024 04:00 UTC */
  const wed = sat + 4 * 86400;            /* Wed 10 Jan 2024 */
  const rows = tape(7919, 300, 14400, 'trend', 0);
  const hit = { kind:'ORB', dir:'long', level: rows[rows.length-1].c, why:'t' };
  const gAt = t => (W.hgOgGates(rows, hit, { nowSec: t, sessionHard: false }) || [])
    .filter(g => g.key === 'weekend-exposure')[0];
  const gs = gAt(sat), gw = gAt(wed);
  ok(gs && gs.pass === false, 'a swing setup inside the gold weekend is vetoed');
  ok(gw && gw.pass === true, 'the same setup mid-week is not (' + gw.why + ')');
  ok(gs.why !== gw.why, 'and the two say different things');
}

console.log('\nomnigold end-to-end: ' + passed + ' checks passed · ' +
            nCand + ' candidates, ' + infoKeys.size + ' indicator reads on each');
