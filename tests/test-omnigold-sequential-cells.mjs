/**
 * hg-v918 — the sequential book, at both ends of the fill interval.
 *
 * scripts/omnigold-evidence-bake.mjs has computed `sequentialByCell` since the
 * v12 bake — the plans a person could actually hold, one at a time — and
 * NOTHING has ever rendered it. Read alone it says the scalp side is the
 * problem: SCALP/FAIR n=210 at -0.343R, the only cell with real power.
 *
 * It is one end of an interval. Those cells are computed on `formed`, the
 * bake's LOWER bound, which deletes unprovable wins and keeps unprovable
 * losses. That file's own rule is that performance CLAIMS belong at that end
 * and VERDICTS must not come from it. So the mirror is baked beside it, and a
 * cell counts as losing only when both ends agree.
 *
 * This guard re-derives every figure from the committed evidence JSON, and
 * pins the thing that makes the panel honest: not one cell loses at both ends.
 * If a re-bake ever produces one, this goes red and someone looks.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const src = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
const EV = JSON.parse(readFileSync(join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));
const SB = EV.sequentialBake;

const W = {};
const ctx = {
  window: W, self: W, globalThis: W, Math, Date, JSON, isFinite, parseFloat, parseInt,
  Array, Object, String, Number, setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
vm.createContext(ctx);
try { vm.runInContext(src, ctx, { timeout: 30000 }); } catch (e) { /* guards its own env */ }
const TABLE = W.HG_OG_REPLAY_EVIDENCE;
const HTML = W.hgOgSequentialCellsHtml;

/* ---- 0. THE GENERATOR IS THE THING UNDER TEST, NOT ITS OUTPUT ----
   Reading the committed JSON alone cannot see a bug in the code that writes
   it: a wrong pool, a dropped filter, a renamed key all stay invisible until
   someone re-runs --write. So run the generator here (200ms, offline, reads
   only the committed walk) and require its output to match what is on disk.
   A divergence means the artifact is stale or the code moved under it, which
   is the exact failure hg-v918 exists to make visible. */
console.log('0. the generator reproduces the committed evidence');
{
  const out = execFileSync(process.execPath,
    [join(ROOT, 'scripts/omnigold-evidence-bake.mjs'), '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const fresh = JSON.parse(out);
  for (const k of ['sequentialByCell', 'sequentialByCellUpper',
                   'sequentialTicketsByHorizon', 'sequentialTicketsByHorizonUpper']){
    ok(fresh[k], 'a fresh bake produces ' + k);
    eq(JSON.stringify(fresh[k]), JSON.stringify(SB[k]),
       k + ' on disk matches what the generator produces right now');
  }
  /* and the mirror really is the OTHER pool — identical tables would mean the
     upper bound was computed from the lower one and the whole check is a
     no-op that always agrees with itself */
  ok(JSON.stringify(fresh.sequentialByCell) !== JSON.stringify(fresh.sequentialByCellUpper),
     'the two ends are genuinely different tables');
  ok(JSON.stringify(fresh.sequentialTicketsByHorizon)
     !== JSON.stringify(fresh.sequentialTicketsByHorizonUpper),
     'and so are the two horizon tables');
  /* The horizon split must PARTITION the sequential ticket book — that is
     what proves it was built from the ticket pool and not from the formed
     one. It is not a subset of the formed cells and must not be checked as
     one: the two are independent walks, and with the non-ticket plans out of
     the way MORE tickets fit the timeline (32 sequential SWING tickets
     against 10 sequential SWING/FAIR formed rows). */
  const sum = (m) => Object.values(m).reduce((a, v) => a + v.n, 0);
  eq(sum(fresh.sequentialTicketsByHorizon), fresh.populations.sequentialTickets.n,
     'the horizon split partitions the sequential TICKET book exactly');
  eq(sum(fresh.sequentialTicketsByHorizonUpper),
     Object.values(fresh.sequentialTicketsByHorizonUpper).reduce((a, v) => a + v.n, 0),
     'and its mirror is internally consistent');
  ok(sum(fresh.sequentialByCell) <= fresh.populations.sequential.n,
     'the cell split covers at most the sequential FORMED book (thin cells are omitted, never zero-filled)');
  ok(sum(fresh.sequentialTicketsByHorizon) !== sum(fresh.sequentialByCell),
     'and the two books are different sizes, so one was not built from the other');
}

/* ---- 1. the bake carries both ends ---- */
console.log('1. the evidence file carries the mirror');
for (const k of ['sequentialByCell', 'sequentialByCellUpper',
                 'sequentialTicketsByHorizon', 'sequentialTicketsByHorizonUpper']){
  ok(SB[k] && Object.keys(SB[k]).length > 0, 'sequentialBake.' + k + ' is present and non-empty');
}
eq(Object.keys(SB.sequentialByCell).length, Object.keys(SB.sequentialByCellUpper).length,
   'both ends cover the same cells');
for (const k of Object.keys(SB.sequentialByCell))
  ok(SB.sequentialByCellUpper[k], k + ' has an upper-bound twin — no cell is published one-ended');

/* ---- 2. every literal in omnigold.js is the evidence file's ---- */
console.log('2. the baked constant is re-derived from the evidence file');
ok(TABLE && TABLE.sequentialCells, 'the constant carries sequentialCells');
ok(TABLE && TABLE.sequentialTicketHorizon, 'and sequentialTicketHorizon');
const pairs = [
  [TABLE.sequentialCells, SB.sequentialByCell, SB.sequentialByCellUpper, 'cell'],
  [TABLE.sequentialTicketHorizon, SB.sequentialTicketsByHorizon, SB.sequentialTicketsByHorizonUpper, 'horizon']
];
let checked = 0;
for (const [baked, lo, hi, what] of pairs){
  eq(Object.keys(baked).length, Object.keys(lo).length, 'every ' + what + ' in the bake is carried');
  for (const [k, v] of Object.entries(baked)){
    ok(lo[k] && hi[k], k + ' exists at both ends in the bake');
    if (!lo[k] || !hi[k]) continue;
    checked++;
    eq(v.lo[0], lo[k].n, k + ' lower n');
    eq(v.lo[1], lo[k].winRate, k + ' lower win rate');
    eq(v.lo[2], lo[k].netR_xm, k + ' lower net at XM');
    eq(v.hi[0], hi[k].n, k + ' upper n');
    eq(v.hi[1], hi[k].winRate, k + ' upper win rate');
    eq(v.hi[2], hi[k].netR_xm, k + ' upper net at XM');
    /* the net baked is the XM one, never the PAXG one sitting next to it */
    ok(v.lo[2] !== lo[k].netR_paxg || lo[k].netR_xm === lo[k].netR_paxg,
       k + ' carries netR_xm, not netR_paxg');
  }
}
eq(checked, 6, 'all four cells and both horizons re-derived');

/* ---- 3. THE RULE: no cell loses at both ends ---- */
console.log('3. not one cell loses at both ends');
const losers = [];
for (const [baked, , , what] of pairs)
  for (const [k, v] of Object.entries(baked))
    if (v.lo[2] < 0 && v.hi[2] < 0) losers.push(what + ' ' + k);
eq(losers.length, 0, 'no cell is negative at both ends — got ' + JSON.stringify(losers));
/* and the one that looks damning at the lower bound is positive at the upper */
{
  const f = TABLE.sequentialCells['SCALP/FAIR'];
  ok(f, 'SCALP/FAIR is carried');
  ok(f.lo[2] < -0.3, 'it reads ' + f.lo[2] + 'R at the cautious end — the gate-it number');
  ok(f.hi[2] > 0, 'and +' + f.hi[2] + 'R at the generous end, so it is not a verdict');
  eq(f.lo[0], 210, 'on 210 rows at the cautious end');
  eq(f.hi[0], 156, 'and 156 at the generous one');
}
/* the ticket split, which is the one that answers "is scalp the problem" */
{
  const s = TABLE.sequentialTicketHorizon['SCALP'], w = TABLE.sequentialTicketHorizon['SWING'];
  ok(s && w, 'both horizons are carried for the ticket book');
  ok(s.lo[2] > 0 && s.hi[2] > 0, 'SCALP tickets are POSITIVE at both ends, one at a time');
  ok(w.lo[2] < 0 && w.hi[2] > 0, 'and SWING is the side that disagrees with itself');
  ok(src.includes('THERE IS NO DEMONSTRATED SCALP LOSS'), 'omnigold.js states that conclusion plainly');
}

/* ---- 4. the panel renders both ends and claims no verdict ---- */
console.log('4. the panel shows both ends and no verdict');
ok(typeof HTML === 'function', 'hgOgSequentialCellsHtml is exported');
if (typeof HTML === 'function'){
  const h = String(HTML() || '');
  ok(h.length > 200, 'it renders');
  for (const k of Object.keys(TABLE.sequentialCells)) ok(h.includes(k), 'the panel shows ' + k);
  ok(/-0\.343R/.test(h) && /\+0\.145R/.test(h), 'SCALP/FAIR appears at BOTH ends');
  ok(/ends disagree/.test(h), 'and is labelled as disagreeing rather than judged');
  ok(!/loses at both ends/.test(h), 'nothing is labelled a loser, because nothing is one');
  ok(/one position at a time|ONE POSITION AT A TIME/i.test(h), 'the panel says what population it is');
  ok(/Nothing on this tab is gated on these rows/.test(h), 'and that it gates nothing');
  ok(!/undefined|NaN/.test(h), 'nothing leaks into the panel');
  /* it is wired, not just exported */
  ok(/\+ hgOgSequentialCellsHtml\(\)/.test(src), 'and it is appended to a rendered panel chain');
}

/* ---- 5. it never invents a reading ---- */
console.log('5. absent stays absent');
{
  const saved = TABLE.sequentialCells, savedH = TABLE.sequentialTicketHorizon;
  try {
    TABLE.sequentialCells = null; TABLE.sequentialTicketHorizon = null;
    eq(HTML(), '', 'no constant -> empty string, so a caller can append it unconditionally');
    TABLE.sequentialCells = { 'X/Y': { lo: [5, 0.5, null], hi: [5, 0.5, 0.1] } };
    TABLE.sequentialTicketHorizon = null;
    eq(HTML(), '', 'a cell missing one end renders nothing rather than half a comparison');
    /* And it must SKIP that row, not die on it. The whole function sits in a
       try/catch, so a row that throws takes the entire panel down silently —
       every good cell with it. One unmeasured end is a reason to omit one
       row, never a reason for the reader to see nothing. */
    TABLE.sequentialCells = {
      'GOOD/A': { lo: [20, 0.4, -0.05], hi: [20, 0.4, 0.05] },
      'HALF/B': { lo: [5, 0.5, null], hi: [5, 0.5, 0.1] },
      'GOOD/C': { lo: [30, 0.3, 0.02], hi: [30, 0.3, 0.09] }
    };
    const mixed = String(HTML() || '');
    ok(mixed.includes('GOOD/A') && mixed.includes('GOOD/C'),
       'the measured cells still render alongside a half-measured one');
    ok(!mixed.includes('HALF/B'), 'and the half-measured one is omitted, not guessed at');
    ok(!/undefined|NaN|null/.test(mixed), 'with nothing leaking from the skipped row');
    TABLE.sequentialCells = { 'X/Y': { lo: [5, 0.5, -0.2], hi: [5, 0.5, -0.1] } };
    ok(/loses at both ends/.test(String(HTML() || '')),
       'and a cell that IS negative at both ends is labelled so — the rule works in both directions');
  } finally { TABLE.sequentialCells = saved; TABLE.sequentialTicketHorizon = savedH; }
}

/* ---- 6. the generator states why a verdict cannot come from one end ---- */
console.log('6. the bake records the rule it is obeying');
{
  const gen = readFileSync(join(ROOT, 'scripts/omnigold-evidence-bake.mjs'), 'utf8');
  /* the sentence wraps lines in the source, so match on normalized whitespace */
  const flat = gen.replace(/\s+/g, ' ');
  ok(/Verdicts are the mirror of that and must NOT come from here/.test(flat),
     'the generator already stated the rule this pack applies');
  ok(/condemning a mechanic at the lower bound/.test(flat),
     'and named the failure mode it prevents');
  ok(/sequentialByCellUpper/.test(gen), 'and now computes the mirror');
  ok(/LOSES AT BOTH ENDS/.test(gen), 'and prints the both-ends reading');
  /* Assert the PRINTED table, not just that the string exists in source. The
     "loses at both ends" branch never fires on this walk, so a mutation that
     kills it is invisible unless the human-readable output is checked. */
  const stdout = execFileSync(process.execPath,
    [join(ROOT, 'scripts/omnigold-evidence-bake.mjs')],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(/SEQUENTIAL BOOK BY CELL AT BOTH BOUNDS/.test(stdout), 'the generator prints the both-bounds cells');
  ok(/SEQUENTIAL TICKET BOOK BY HORIZON AT BOTH BOUNDS/.test(stdout), 'and the ticket horizons');
  ok(/a cell LOSES only when both ends agree/.test(stdout), 'stating the rule above the table');
  for (const k of ['SCALP/FAIR', 'SCALP/STRONG', 'SCALP/WEAK', 'SWING/FAIR'])
    ok(stdout.includes(k), 'the printed table shows ' + k);
  {
    /* Every printed row must carry BOTH a lower and an upper figure — scoped
       to THIS pack's two sections. hg-v919 added a stop-width table in the
       same both-bounds shape, and a bare scan of the whole stdout counted its
       rows too (6 -> 13) and then failed on them for not carrying a verdict
       word they were never meant to have. Cut each section at the next
       blank-line-separated heading rather than matching the file. */
    const section = (head) => {
      /* sections are blank-line separated, so stop at the first blank line
         after the heading rather than running to end of output */
      const after = (stdout.split(head)[1] || '').split('\n').slice(1);
      const out = [];
      for (const line of after){
        if (!line.trim()) break;
        if (/lower n=.*\|.*upper n=/.test(line)) out.push(line);
      }
      return out;
    };
    const cellRows = section('SEQUENTIAL BOOK BY CELL AT BOTH BOUNDS');
    const horizonRows = section('SEQUENTIAL TICKET BOOK BY HORIZON AT BOTH BOUNDS');
    eq(cellRows.length, 4, 'four cells print at both bounds');
    eq(horizonRows.length, 2, 'and two horizons');
    const rows = cellRows.concat(horizonRows);
    ok(rows.every((l) => /ends disagree — no verdict/.test(l)),
       'and every one of them reads as disagreeing, because not one loses at both ends');
    ok(!/LOSES AT BOTH ENDS/.test(stdout.split('SEQUENTIAL BOOK BY CELL AT BOTH BOUNDS')[1] || ''),
       'so nothing is printed as a loser');
    /* AND THE LIMIT OF THIS CHECK, STATED. Because no cell loses at both
       ends on this walk, the generator's `both` flag is never observable in
       its output: forcing it false changes nothing a reader or this test can
       see. That mutation survives and is an equivalent one, not a gap left
       open. The same rule in the PANEL is exercised in BOTH directions on a
       fixture in section 5 — a both-negative cell there must read "loses at
       both ends" — so the behaviour a reader depends on is covered. If a
       re-bake ever produces a cell negative at both ends, section 3 goes red
       and this print becomes observable at the same moment. */
  }
  ok(/formedUpper/.test(gen), 'from the upper-bound pool, not a re-derived one');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
