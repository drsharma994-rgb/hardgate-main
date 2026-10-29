/* HARDGATE — hg-v1433: the GOLD SINGLES wave-C floor pack (OPTI GOLD HTF
   hg-v1434: sister-suite re-pin — the stamp assertions below follow the tree
   version (now hg-v1434, riding the CRYPTO SINGLES bump); the pack under test
   remains hg-v1433. Behavior pins unchanged.
   hg-v1435: re-pinned again with the PINE/META bump (hg-v1434 -> hg-v1435);
   the pack under test remains hg-v1433. Behavior pins unchanged.
   stand-aside + scalp gold-weekend stand-aside + ER(20) record-only marks;
   SUPER GOLD sign-flip halves label; GOLD DIRECTION 0-crown disclosure).

   Run: node tests/test-goldsingles-floor-v1423.mjs

   MEASURED BASIS (the wave-C census, /mnt/agents/output/desks/goldsingles —
   14.2 months PAXGUSDT spot, each desk's OWN seam replayed, desk's own walk,
   XM 0.020% RT primary / PAXG taker 0.26% RT venue-true, both chronological
   halves throughout):
     ① HTF-STRUCTURE CONFIRMATION (4h close vs EMA-50, sliced at the break
        bar). Breaks AGAINST the 4h side: scalp dropped cohort n=335 −0.213R
        @XM (−0.232 / −0.194 by half), intraday n=64 −0.348R (−0.295 /
        −0.401) — negative in BOTH halves on BOTH lanes; kept improves
        (scalp −0.133→−0.068, intraday −0.029→+0.146). Demote-not-hide at
        ogTopPicks; swing lane never bars (its own timeframe IS the 4h).
     ② SCALP GOLD-WEEKEND STAND-ASIDE. Admitted weekend cohort −0.155R @XM
        both halves (n=185: −0.195 / −0.115) and PASSED the hg-v944 4-window
        protocol on the population the gate actually bars (the admitted
        cohort): −0.028 / −0.517 / −0.180 / +0.014 — 3/4 negative, none
        above +0.02R. The raw minted population fails window 1 (+0.061R) —
        named here and in the desk header because the gate reads the
        admitted population, and the clause is marginal by construction.
        Scalp lane only (intraday refused: h1 +0.201R; swing: n=2).
     ③ ER(20) RECORD-ONLY MARKS. The programme's chop veto re-verified: for
        the first time on a gold desk the dropped cohort is negative in both
        halves (scalp n=531 −0.139R: −0.130 / −0.147; intraday n=120 −0.087R:
        −0.078 / −0.095) — but the kept cohort stays negative (−0.120R) and
        every prior gold desk refuted it, so og:er20ok rides the reads bag
        (the hg-v1420 gp:er20ok shape) and gates NOTHING anywhere.
     Refused with numbers (in the brief, named in the build stamp): every
     4×PAXG-taker floor (keeps 41/746, 4/91, 71/1637 — the whole-book
     verdict), vol-cone suppression (vetoing winners), 4×XM on scalp
     (h2 +0.177R).

   WHAT THIS GUARD PROVES, behaviourally, through the real IIFE:
     1. the seams exist by name (a rename trips here);
     2. ogEr20Ok / ogHtfMark stamp true/false on deterministic tapes and
        fail OPEN (null) on thin or unreadable tapes — third state;
     3. ogHtfBlocked / ogWeekendBlocked fire on the stamped cohorts, bar
        only their own lanes, abstain on unstamped setups, and the levers
        HG_OG_HTF_FLOOR / HG_OG_WEEKEND_FLOOR restore the old board;
     4. ogTopPicks BEHAVIOURAL PIN: a stamped-against setup never takes a
        TOP PICK slot, the input array is untouched (demote-not-hide), and
        a lever-off board seats it again;
     5. the marks ride the forward ledger row (reads bag + goldShut flag),
        absent when unstamped;
     6. the card chips name the stand-asides;
     7. the honesty displays are present and paint-level (super-gold
        sign-flip halves +0.184/−0.170; golddirection 0-crown disclosure);
     8. the deploy pins moved with the pack (?v= byte-check);
     9. MUTATION PROOFS: neutering each predicate flips the matching pin. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok —', m); }
                       else { failed++; console.error('  FAIL —', m); } };

const OG_SRC = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
function boot(mutate, globals){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, Map, Set, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  Object.assign(ctx, globals || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  vm.runInContext(mutate ? mutate(OG_SRC) : OG_SRC, ctx, { filename: 'optigold.js' });
  return ctx;
}
const W = boot(null);

/* deterministic tapes */
function trend(ivSec, n, step){                     /* persistent grind — ER high */
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < n; i++){ const o = c; c = c + step;
    rows.push({ t: (t += ivSec), o, h: c + 0.1, l: o - 0.1, c, v: 100 }); }
  return rows;
}
function chop(ivSec, n){                            /* alternating ±0.05 — ER ~0 */
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < n; i++){ const cc = c + (i % 2 ? 0.05 : -0.05);
    rows.push({ t: (t += ivSec), o: c, h: cc + 0.4, l: cc - 0.4, c: cc, v: 100 }); c = cc; }
  return rows;
}
const mk = (lane, entry, extra) => Object.assign(
  { state: 'waiting', lane, dir: 'long', entry, stop: entry - 5,
    t1: entry + 10, risk: 5, rr: 2, atr: 2, barsLeft: 30, i: 59, t: 1700000000 + 60 * 900 }, extra || {});

console.log('== 1. the seams exist by name ==');
{
  ok(typeof W.__ogEr20Ok === 'function', '__ogEr20Ok exported');
  ok(typeof W.__ogHtfMark === 'function', '__ogHtfMark exported');
  ok(typeof W.__ogHtfBlocked === 'function', '__ogHtfBlocked exported');
  ok(typeof W.__ogWeekendBlocked === 'function', '__ogWeekendBlocked exported');
  ok(typeof W.__ogHtfChipHtml === 'function', '__ogHtfChipHtml exported');
  ok(typeof W.__ogWeekendChipHtml === 'function', '__ogWeekendChipHtml exported');
  ok(typeof W.__ogTopPicks === 'function', '__ogTopPicks still exported');
  ok(typeof W.__ogFwdRows === 'function', '__ogFwdRows still exported');
}

console.log('== 2. the stamps read deterministic tapes, fail open on thin ones ==');
{
  const up = trend(900, 60, 0.5), ch = chop(900, 60);
  ok(W.__ogEr20Ok(up, { i: 59 }) === true, 'ogEr20Ok: persistent grind reads >= 0.30');
  ok(W.__ogEr20Ok(ch, { i: 59 }) === false, 'ogEr20Ok: alternating chop reads < 0.30');
  ok(W.__ogEr20Ok(up.slice(-10), { i: 9 }) === null, 'ogEr20Ok: 10-bar tape is unread (null, fail-open)');
  ok(W.__ogEr20Ok(up, {}) === null && W.__ogEr20Ok(null, { i: 1 }) === null, 'ogEr20Ok: missing shape/rows unread');
  const up4 = trend(14400, 80, 0.5);
  const tB = up4[up4.length - 1].t;
  ok(W.__ogHtfMark(up4, { dir: 'long', t: tB }).with === true, 'ogHtfMark: long break over a rising 4h EMA-50 is WITH');
  ok(W.__ogHtfMark(up4, { dir: 'short', t: tB }).with === false, 'ogHtfMark: short break against the rising 4h is AGAINST');
  ok(W.__ogHtfMark(up4.slice(-40), { dir: 'long', t: tB }) === null, 'ogHtfMark: 40-bar 4h tape unread (fail-open)');
  ok(W.__ogHtfMark(up4, { dir: 'long' }) === null, 'ogHtfMark: missing break-bar time unread (fail-open)');
  /* slicing: a mark stamped BEFORE the trend flips must not see the flip */
  const mid = up4[59].t;
  ok(W.__ogHtfMark(up4, { dir: 'long', t: mid }).with === true, 'ogHtfMark: evidence stops at the break bar');
}

console.log('== 3. the predicates fire on their own lanes, abstain elsewhere, levers restore ==');
{
  const against = mk('scalp', 100, { htf: { with: false } });
  ok(W.__ogHtfBlocked(against) === true, 'ogHtfBlocked fires on a scalp HTF-against break');
  ok(W.__ogHtfBlocked(mk('intraday', 100, { htf: { with: false } })) === true, 'ogHtfBlocked fires on intraday');
  ok(W.__ogHtfBlocked(mk('swing', 100, { htf: { with: false } })) === false, 'ogHtfBlocked never bars the swing lane');
  ok(W.__ogHtfBlocked(mk('scalp', 100, { htf: { with: true } })) === false, 'ogHtfBlocked abstains when WITH');
  ok(W.__ogHtfBlocked(mk('scalp', 100)) === false, 'ogHtfBlocked abstains when unstamped (fail-open)');
  const off = boot(null, { HG_OG_HTF_FLOOR: false });
  ok(off.__ogHtfBlocked(against) === false, 'HG_OG_HTF_FLOOR=false restores the old board');
  ok(W.__ogWeekendBlocked(mk('scalp', 100, { goldShut: { inWeekend: true } })) === true, 'ogWeekendBlocked fires on a scalp gold-weekend break');
  ok(W.__ogWeekendBlocked(mk('swing', 100, { goldShut: { inWeekend: true } })) === false, 'ogWeekendBlocked never bars the swing lane');
  ok(W.__ogWeekendBlocked(mk('scalp', 100, { goldShut: { inWeekend: false } })) === false, 'ogWeekendBlocked abstains outside the weekend');
  ok(W.__ogWeekendBlocked(mk('scalp', 100)) === false, 'ogWeekendBlocked abstains when unstamped (fail-open)');
  const off2 = boot(null, { HG_OG_WEEKEND_FLOOR: false });
  ok(off2.__ogWeekendBlocked(mk('scalp', 100, { goldShut: { inWeekend: true } })) === false, 'HG_OG_WEEKEND_FLOOR=false restores the old board');
}

console.log('== 4. ogTopPicks behavioural pin — barred never seats, board untouched, lever-off seats ==');
{
  const clean = mk('scalp', 100);
  ok(!!W.__ogTopPicks([clean], 100).scalp, 'an unstamped scalp break takes the slot');
  const against = mk('scalp', 100, { htf: { with: false } });
  const best = W.__ogTopPicks([against], 100);
  ok(!best.scalp, 'an HTF-against scalp break never takes the slot');
  ok(best.scalp === null && W.__ogTopPicks([against, mk('scalp', 101)], 100).scalp !== null,
     'a clean rival seats beside the barred one (demote, never hide — the barred card stays in the array)');
  ok(against.state === 'waiting' && against.entry === 100, 'the barred setup is untouched (demote-not-hide)');
  const off = boot(null, { HG_OG_HTF_FLOOR: false });
  ok(!!off.__ogTopPicks([mk('scalp', 100, { htf: { with: false } })], 100).scalp, 'lever off: the HTF-against break seats again');
  ok(!W.__ogTopPicks([mk('scalp', 100, { goldShut: { inWeekend: true } })], 100).scalp, 'a gold-weekend scalp break never takes the slot');
  const offW = boot(null, { HG_OG_WEEKEND_FLOOR: false });
  ok(!!offW.__ogTopPicks([mk('scalp', 100, { goldShut: { inWeekend: true } })], 100).scalp, 'weekend lever off: the break seats again');
  /* er20ok is record-only: an er20ok:false setup is NEVER barred by it */
  ok(!!W.__ogTopPicks([mk('scalp', 100, { er20ok: false })], 100).scalp, 'er20ok:false never bars a slot (record-only mark)');
}

console.log('== 5. the marks ride the ledger row, absent when unstamped ==');
{
  const rows = trend(900, 80, 0.5);
  const stamped = mk('scalp', 100, { i: 70, t: rows[70].t, htf: { with: false }, er20ok: true, goldShut: { inWeekend: true } });
  const r1 = W.__ogFwdRows([stamped], 'scalp', rows, 'PAXGUSDT');
  ok(r1.length === 1 && r1[0].reads && r1[0].reads['og:er20ok'] === true, 'row.reads carries og:er20ok');
  ok(r1[0].reads['og:htfwith'] === false, 'row.reads carries og:htfwith=false');
  ok(r1[0].goldShut === true, 'row carries the goldShut flag');
  ok(r1[0].ticket === false, 'still never a ticket');
  const r2 = W.__ogFwdRows([mk('scalp', 100, { i: 70, t: rows[70].t })], 'scalp', rows, 'PAXGUSDT');
  ok(r2.length === 1 && !r2[0].reads && r2[0].goldShut === undefined, 'an unstamped setup invents no marks');
}

console.log('== 6. the card chips name the stand-asides ==');
{
  const h1 = W.__ogHtfChipHtml(mk('scalp', 100, { htf: { with: false } }));
  ok(h1.indexOf('HTF AGAINST') !== -1 && h1.indexOf('never a TOP PICK') !== -1, 'HTF-against chip names the bar');
  ok(W.__ogHtfChipHtml(mk('scalp', 100, { htf: { with: true } })).indexOf('HTF WITH IT') !== -1, 'HTF-with chip speaks');
  ok(W.__ogHtfChipHtml(mk('scalp', 100)) === '', 'no chip when unstamped');
  ok(W.__ogHtfChipHtml(mk('swing', 100, { htf: { with: false } })) === '', 'no HTF chip on the swing lane');
  const w1 = W.__ogWeekendChipHtml(mk('scalp', 100, { goldShut: { inWeekend: true } }));
  ok(w1.indexOf('GOLD SHUT') !== -1 && w1.indexOf('never a TOP PICK') !== -1, 'gold-weekend chip names the bar');
  ok(W.__ogWeekendChipHtml(mk('intraday', 100, { goldShut: { inWeekend: true } })) === '', 'weekend chip is scalp-only');
}

console.log('== 7. the honesty displays are present and paint-level ==');
{
  const sg = fs.readFileSync(path.join(ROOT, 'super-gold.js'), 'utf8');
  ok(sg.indexOf('hg-v1433 census') !== -1, 'super-gold carries the hg-v1433 census label');
  ok(sg.indexOf('sign-flip') !== -1 && sg.indexOf('+0.184') !== -1, 'super-gold names the sign-flip halves (+0.184 / −0.170)');
  ok(sg.indexOf('−0.170') !== -1 && sg.indexOf('−0.740R') !== -1, 'super-gold names the −0.170 second half and the PAXG-taker truth');
  const gd = fs.readFileSync(path.join(ROOT, 'golddirection.js'), 'utf8');
  ok(gd.indexOf('hg-v1433 census') !== -1, 'golddirection carries the hg-v1433 census disclosure');
  ok(gd.indexOf('<b>0 picks</b>') !== -1 && gd.indexOf('EDGE table') !== -1, 'golddirection names the 0-crown / all-demoted measurement');
}

console.log('== 8. deploy pins moved with the pack (?v= byte-check) ==');
{
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('optigold.js?v=1459') !== -1, 'index.html loads optigold.js?v=1459');
  ok(idx.indexOf('super-gold.js?v=1459') !== -1, 'index.html loads super-gold.js?v=1459');
  ok(idx.indexOf('golddirection.js?v=1459') !== -1, 'index.html loads golddirection.js?v=1459');
  ok(idx.indexOf('?v=1432') === -1, 'no ?v=1432 pin survives');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(sw.indexOf("HG_CACHE = 'hg-v1459'") !== -1, 'sw.js cache moved to v1457');
}

console.log('== 9. MUTATION PROOFS — the pins read the real seams ==');
{
  const mHtf = boot(src => src.replace('return ogHtfFloorOn()', 'return false && ogHtfFloorOn() /* mutant */'));
  ok(mHtf.__ogHtfBlocked(mk('scalp', 100, { htf: { with: false } })) === false
     && !!mHtf.__ogTopPicks([mk('scalp', 100, { htf: { with: false } })], 100).scalp,
     'mutant ogHtfBlocked: the barred setup seats — section 3/4 pins flip red on the pre-fix tree');
  const mWk = boot(src => src.replace('return ogWeekendFloorOn()', 'return false && ogWeekendFloorOn() /* mutant */'));
  ok(mWk.__ogWeekendBlocked(mk('scalp', 100, { goldShut: { inWeekend: true } })) === false,
     'mutant ogWeekendBlocked: the weekend bar goes silent — the pins read the seam');
  ok(OG_SRC.indexOf("row.reads['og:er20ok']") !== -1 && OG_SRC.indexOf("row.reads['og:htfwith']") !== -1,
     'the ledger mark keys exist in the shipped source (a rename trips here)');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
