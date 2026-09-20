/* HARDGATE — the forward panel counted rows, not observations.

   hg-forward.js opens by stating its own target in NON-OVERLAPPING trades
   ("MMOVE needs ~157 non-overlapping trades to settle at 2 sigma"), and it
   ships hgFwdOverlap to count them: lay each record's [fire, fire + horizon]
   interval on a line, measure mean concurrency, and effN = n / concurrency.
   Only omnigold.js ever called it, and only on its promotion path.

   hgFwdPanelHTML -- the drop-in panel six desks render, CRYPTO SCAN among
   them since pack 876 -- never did. SETTLED was a raw row count, the
   `needs ~N` figure beside it is derived in non-overlapping units, and
   hgOmniPoolRead's standard error is sqrt(p(1-p)/samples) over that same raw
   count. So READ could say "has paid" on concurrency alone.

   IT MATTERS MOST HERE. CRYPTO SCAN is the app's only fully CROSS-SECTIONAL
   desk: it fires on every contract in the universe on ONE bar with ONE 24-bar
   horizon, so every row from a scan is perfectly concurrent with every other.
   Measured with the real hgFwdOverlap on that exact shape:

     200 setups/bar over  100 bars   n = 20,000   effN  5.13
      40 setups/bar over   96 bars   n =  3,840   effN  4.96
      40 setups/bar over  960 bars   n = 38,400   effN 40.96

   effN tracks (bars / horizon) and is flat in the number of contracts. A day
   of scanning is about five independent observations; the ~157 that file
   opens with is ~39 days at this shape, not four bars.

   Worked end to end below: 1,800 settled rows at 55% against a 40% breakeven
   read "has paid" on the raw count and "too few to judge" on effN = 3.5.

   The fix changes no gate. hgOmniPoolRead is untouched; the corrected READ is
   that same function run again on the SAME hit rate with effN in place of
   samples, so the 20-sample floor and the sigma bar are its own. Rows folded
   into the all-time aggregate carry no timing, so effN is reported as a LOWER
   BOUND with its coverage printed, and where hgFwdOverlap cannot answer it
   returns null and nothing is claimed.

   Run: node tests/test-cryptoscan-independence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'omniroute.js', 'hg-forward.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900, HB = 24;

function wipe(){ S.localStorage.removeItem('hg_forward_v1'); S.localStorage.removeItem('hg_forward_agg_v1'); }
function readRaw(){
  const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  return j.rows || (Array.isArray(j) ? j : []);
}
/* CRYPTO SCAN's real shape: k contracts fired on each of `bars` consecutive
   15m bars, every one carrying the same 24-bar horizon. */
function crossSection(kPerBar, bars, mechanic, winEvery){
  wipe();
  const t0 = Math.floor(Date.now() / 1000 / SEC) * SEC - (bars + HB + 2) * SEC;
  for (let b = 0; b < bars; b++){
    const batch = [];
    for (let k = 0; k < kPerBar; k++)
      batch.push({ sym: 'S' + k, dir: 'long', mechanic: mechanic,
                   entry: 100, stop: 95, t1: 107.5, mark: 100, barT: t0 + b * SEC });
    S.hgFwdRecordScan('CRYPTO SCAN', '15m', batch, { horizonBars: HB });
  }
  const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  const arr = j.rows || j;
  let i = 0;
  for (const r of arr){
    const win = (i++ % 20) < winEvery;
    r.state = win ? 't1' : 'stop';
    r.rr = win ? 1.5 : 0;
  }
  S.localStorage.setItem('hg_forward_v1', JSON.stringify(j));
  return arr;
}

/* ---------------------------------------------------------------- 1
   The shape itself: effN is flat in the number of contracts. */
{
  const OV = S.hgFwdOverlapOf;
  ok(typeof OV === 'function', 'hgFwdOverlap is exported');

  const sim = (k, bars) => {
    const recs = [], t0 = 1789000000;
    for (let b = 0; b < bars; b++) for (let i = 0; i < k; i++)
      recs.push({ tab: 'CRYPTO SCAN', mechanic: 'M', tf: '15m', sym: 'S' + i, dir: 'long',
                  barT: t0 + b * SEC, horizonBars: HB });
    return OV(recs, 'CRYPTO SCAN', 'M', {});
  };

  const a = sim(1, 96), b = sim(40, 96), c = sim(200, 96);
  ok(a.n === 96 && b.n === 3840 && c.n === 19200, 'raw n scales with contracts as expected');
  ok(Math.abs(a.effN - b.effN) < 0.01 && Math.abs(b.effN - c.effN) < 0.01,
     'but effN is IDENTICAL at 1, 40 and 200 contracts a bar ('
     + a.effN.toFixed(2) + ' / ' + b.effN.toFixed(2) + ' / ' + c.effN.toFixed(2) + ')');
  ok(c.n / c.effN > 3800,
     '200 contracts over 96 bars: ' + c.n + ' rows is ' + c.effN.toFixed(2)
     + ' observations, a ' + Math.round(c.n / c.effN) + 'x inflation');

  /* effN is driven by bars/horizon, not by breadth */
  const grid = [24, 48, 96, 240, 480, 960].map(bars => ({ bars, eff: sim(40, bars).effN }));
  ok(grid.every(g => Math.abs(g.eff - (g.bars / HB + 1)) < 0.05),
     'effN tracks bars/horizon + 1 across the grid ('
     + grid.map(g => g.bars + 'b=' + g.eff.toFixed(2)).join(' ') + ')');
  ok(grid[grid.length - 1].eff > grid[0].eff,
     'so it grows with TIME scanned, which is the only thing that adds evidence');

  /* the module's own stated target, in this desk's units */
  const daysFor157 = 157 * HB * SEC / 86400;
  ok(daysFor157 > 35 && daysFor157 < 45,
     'the ~157 non-overlapping trades this file opens with is ~'
     + daysFor157.toFixed(0) + ' days at this shape, not ' + Math.ceil(157 / 40) + ' bars');

  /* the module's own rule: no timing, no answer */
  ok(OV([{ tab: 'T', mechanic: 'M', tf: '15m', barT: 1 }], 'T', 'M', {}) === null,
     'one record cannot measure concurrency, and returns null rather than 1');
  ok(OV([{ tab: 'T', mechanic: 'M', barT: 1, horizonBars: 4 },
         { tab: 'T', mechanic: 'M', barT: 2, horizonBars: 4 }], 'T', 'M', {}) === null,
     'records with no timeframe return null, not a guess');
}

/* ---------------------------------------------------------------- 2
   THE PANEL. A mechanic that reads "has paid" on rows reads honestly on
   observations. */
let panelTxt = '';
{
  crossSection(30, 60, 'VOTE-STRONG@V5', 11);      /* 1,800 rows at 55% */
  const html = S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' });
  panelTxt = text(html);

  ok(/<th>SETTLED<\/th><th>INDEP<\/th>/.test(html),
     'the panel has an INDEP column header, beside SETTLED');
  ok((String(html).match(/<th>/g) || []).length === 7,
     'seven columns, one more than before');
  ok(/1800/.test(panelTxt), 'it still reports all 1800 settled rows');
  ok(/55%/.test(panelTxt), 'and the hit rate over them');

  /* 55% against a 1.5R breakeven of 40% over 1800 rows is a huge z */
  const raw = S.hgOmniPoolRead({ samples: 1800, hit: 0.55 }, 1.5, 20, 2);
  ok(raw.read === 'has paid', 'on the RAW count this mechanic reads "has paid"');

  const ov = S.hgFwdOverlapOf(readRaw(), 'CRYPTO SCAN', 'VOTE-STRONG@V5', {});
  ok(ov && ov.effN < 10,
     'its measured independent count is ' + (ov ? ov.effN.toFixed(1) : '?'));
  const eff = S.hgOmniPoolRead({ samples: ov.effN, hit: 0.55 }, 1.5, 20, 2);
  ok(eff.read === 'too few to judge', 'on that count the same function reads "too few to judge"');

  ok(/too few to judge/.test(panelTxt),
     'and the panel leads with the corrected read');
  ok(/\(on n: has paid\)/.test(panelTxt),
     'keeping the raw-count verdict visible in brackets, not hidden');
  ok(panelTxt.indexOf('too few to judge') < panelTxt.indexOf('(on n: has paid)'),
     'corrected first, raw second');

  ok(/LOWER BOUND/.test(panelTxt), 'the note says effN is a lower bound where rows were folded');
  ok(/non-overlapping units/.test(panelTxt),
     'and that the needs ~N target was always in those units');

  /* PER MECHANIC, not per tab. Two mechanics in one log with very different
     firing shapes must get very different INDEP figures — computing the
     overlap over the whole tab would hand both the same number. */
  wipe();
  const t0 = Math.floor(Date.now() / 1000 / SEC) * SEC - 300 * SEC;
  for (let b = 0; b < 120; b++){
    const batch = [];
    /* WIDE fires 25 contracts every bar; NARROW fires one every 8th bar */
    for (let k = 0; k < 25; k++)
      batch.push({ sym: 'W' + k, dir: 'long', mechanic: 'WIDE@V5',
                   entry: 100, stop: 95, t1: 107.5, mark: 100, barT: t0 + b * SEC });
    if (b % 8 === 0)
      batch.push({ sym: 'N0', dir: 'long', mechanic: 'NARROW@V5',
                   entry: 100, stop: 95, t1: 107.5, mark: 100, barT: t0 + b * SEC });
    S.hgFwdRecordScan('CRYPTO SCAN', '15m', batch, { horizonBars: HB });
  }
  const jj = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  const aa = jj.rows || jj;
  let ii = 0;
  for (const r of aa){ const w = (ii++ % 20) < 11; r.state = w ? 't1' : 'stop'; r.rr = w ? 1.5 : 0; }
  S.localStorage.setItem('hg_forward_v1', JSON.stringify(jj));

  const rows = readRaw();
  const wide = S.hgFwdOverlapOf(rows, 'CRYPTO SCAN', 'WIDE@V5', {});
  const narrow = S.hgFwdOverlapOf(rows, 'CRYPTO SCAN', 'NARROW@V5', {});
  const tabWide = S.hgFwdOverlapOf(rows, 'CRYPTO SCAN', null, {});
  ok(wide && narrow && wide.n > narrow.n * 10,
     'WIDE holds ' + wide.n + ' rows, NARROW ' + narrow.n);
  ok(Math.abs(wide.meanConcurrency - narrow.meanConcurrency) > 10,
     'and their mean concurrencies differ sharply ('
     + wide.meanConcurrency.toFixed(1) + ' vs ' + narrow.meanConcurrency.toFixed(1) + ')');
  ok(Math.abs(narrow.meanConcurrency - tabWide.meanConcurrency) > 10,
     'so a tab-wide overlap would misdescribe NARROW ('
     + tabWide.meanConcurrency.toFixed(1) + ')');

  const rowsHtml = String(S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' }))
    .split('<tr>').filter(x => /@V5/.test(x));
  const cell = name => {
    const tr = rowsHtml.filter(x => x.indexOf(name) >= 0)[0] || '';
    const tds = tr.split('<td>');
    return text(tds[3] || '');           /* MECHANIC, SETTLED, INDEP */
  };
  const wCell = cell('WIDE@V5'), nCell = cell('NARROW@V5');
  ok(wCell && nCell && wCell !== nCell,
     'and the panel prints a DIFFERENT INDEP for each (' + wCell + ' vs ' + nCell + ')');
  /* Per ROW is where the two separate: WIDE buys almost nothing with its 3,000
     rows, NARROW buys nearly one observation per row it writes. Absolute effN
     is similar because both mechanics span the same 120 bars, and it is TIME
     that carries independence here, not breadth — which is the whole point. */
  const wPer = wide.effN / wide.n, nPer = narrow.effN / narrow.n;
  ok(nPer > wPer * 50,
     'per row the sparser mechanic buys ' + (nPer / wPer).toFixed(0)
     + 'x more independent evidence (' + nPer.toFixed(3) + ' vs ' + wPer.toFixed(5) + ')');
  ok(Math.abs(wide.effN - narrow.effN) < 3 && wide.n / narrow.n > 100,
     'while their absolute effN is within '
     + Math.abs(wide.effN - narrow.effN).toFixed(1) + ' despite a '
     + Math.round(wide.n / narrow.n) + 'x difference in rows');
}

/* ---------------------------------------------------------------- 2b
   The concurrency denominator is a UNION, not a sum — the code says "quiet
   stretches must not dilute it", and a log with a real gap is the only thing
   that can tell the two apart. */
{
  const OV = S.hgFwdOverlapOf;
  const t0 = 1789000000;
  const burst = (at, k) => {
    const out = [];
    for (let i = 0; i < k; i++)
      out.push({ tab: 'T', mechanic: 'M', tf: '15m', sym: 'S' + i, dir: 'long',
                 barT: at, horizonBars: HB });
    return out;
  };
  /* two bursts of 20, a month apart: dense while open, silent between */
  const gapped = burst(t0, 20).concat(burst(t0 + 30 * 86400, 20));
  const o = OV(gapped, 'T', 'M', {});
  ok(o && Math.abs(o.meanConcurrency - 20) < 0.001,
     'concurrency over the gapped log is ' + o.meanConcurrency.toFixed(2)
     + ' — the 20 that were actually open together');
  ok(o && Math.abs(o.effN - 2) < 0.001,
     'so 40 rows in two bursts is ' + o.effN.toFixed(2) + ' observations, one per burst');
  /* a sum denominator would divide by the whole month and collapse the figure */
  const monthSec = 30 * 86400;
  ok(o.coveredSec === 2 * HB * SEC,
     'and the covered window is exactly the ' + (o.coveredSec / 3600).toFixed(0)
     + 'h the two bursts were open, not the ' + (monthSec / 3600) + 'h the log spans');
  ok(o.coveredSec / monthSec < 0.02,
     'which is ' + (100 * o.coveredSec / monthSec).toFixed(1)
     + '% of the span — a sum denominator would report a concurrency near '
     + (o.meanConcurrency * o.coveredSec / monthSec).toFixed(3) + ' and invert the correction');

  /* contiguous firing has no gap, so it cannot distinguish the two — which is
     why the fixture above exists */
  const solid = [];
  for (let b = 0; b < 40; b++) solid.push(
    { tab: 'T', mechanic: 'M', tf: '15m', sym: 'X', dir: 'long', barT: t0 + b * SEC, horizonBars: HB });
  const os = OV(solid, 'T', 'M', {});
  ok(os && os.coveredSec === (40 - 1 + HB) * SEC,
     'a contiguous log covers every second it spans, so union and sum agree there');

  /* The invariant the union denominator guarantees: weighted and covered are
     both summed only while open > 0, so meanConcurrency >= 1 and effN <= n
     always. The Math.min(n, ...) cap in hgFwdOverlap is therefore unreachable
     while that holds -- a deliberately equivalent mutation of it survives, and
     should. It is defence against a future change to the denominator, which is
     exactly the change the gapped fixture above guards. */
  ok(o.effN <= o.n && os.effN <= os.n,
     'effN never exceeds n on any fixture here — the union denominator makes '
     + 'mean concurrency at least 1 by construction');
}

/* ---------------------------------------------------------------- 3
   It does not fabricate a correction it cannot measure. */
{
  wipe();
  /* one settled record: hgFwdOverlap returns null for a single span */
  const t0 = Math.floor(Date.now() / 1000 / SEC) * SEC - 60 * SEC;
  S.hgFwdRecordScan('CRYPTO SCAN', '15m',
    [{ sym: 'ONE', dir: 'long', mechanic: 'VOTE-WEAK@V5', entry: 100, stop: 95, t1: 107.5,
       mark: 100, barT: t0 }], { horizonBars: HB });
  const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  const arr = j.rows || j;
  arr[0].state = 't1'; arr[0].rr = 1.5;
  S.localStorage.setItem('hg_forward_v1', JSON.stringify(j));

  const t = text(S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' }));
  ok(/unmeasured/.test(t),
     'a pool too small to measure concurrency prints "unmeasured", not a 1');
  ok(!/LOWER BOUND/.test(t),
     'and the note that explains the correction is absent when nothing was corrected');

  /* the empty state is untouched */
  wipe();
  const e = text(S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' }));
  ok(/Nothing recorded yet/.test(e), 'the empty state still reads as before');
  ok(!/INDEP/.test(e), 'with no table and no note');
}

/* ---------------------------------------------------------------- 4
   Where the correction does NOT bite, the panel says what it always said.
   The bracket has to be able NOT to appear, or it is decoration. */
{
  /* a mechanic strong enough to clear the bar on BOTH counts: one firing per
     bar over 480 bars puts effN past the 20-sample floor, and an 85% hit rate
     clears the sigma bar at that size too */
  crossSection(1, 480, 'VOTE-PRO@V5', 17);        /* 17/20 = 85% */
  const ov = S.hgFwdOverlapOf(readRaw(), 'CRYPTO SCAN', 'VOTE-PRO@V5', {});
  ok(ov && ov.n === 480, 'a one-per-bar desk records 480 rows');
  ok(ov && ov.effN >= 20,
     'and its effN is ' + ov.effN.toFixed(1) + ' — past the 20-sample floor');

  const rawRead = S.hgOmniPoolRead({ samples: 480, hit: 0.85 }, 1.5, 20, 2);
  const effRead = S.hgOmniPoolRead({ samples: ov.effN, hit: 0.85 }, 1.5, 20, 2);
  ok(rawRead.read === 'has paid' && effRead.read === 'has paid',
     'both counts reach the same verdict here (' + rawRead.read + ')');

  const t = text(S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' }));
  ok(/INDEP/.test(t), 'the column is there');
  ok(/has paid/.test(t), 'the verdict survives the correction');
  ok(!/\(on n:/.test(t),
     'and because the two agree, NO bracket is printed — so the bracket in '
     + 'section 2 was a real disagreement, not boilerplate');
  ok(new RegExp('\\b' + Math.round(ov.effN) + '\\b').test(t)
     || new RegExp(ov.effN.toFixed(1).replace('.', '\\.')).test(t),
     'and the measured effN is printed, not just implied');

  /* the milder case: still 480 rows, but a 55% edge that the raw count calls
     settled and the corrected one does not */
  crossSection(1, 480, 'VOTE-MID@V5', 11);        /* 11/20 = 55% */
  const t2 = text(S.hgFwdPanelHTML('CRYPTO SCAN', { minRr: 1.5, title: 'FORWARD' }));
  const raw2 = S.hgOmniPoolRead({ samples: 480, hit: 0.55 }, 1.5, 20, 2);
  const ov2 = S.hgFwdOverlapOf(readRaw(), 'CRYPTO SCAN', 'VOTE-MID@V5', {});
  const eff2 = S.hgOmniPoolRead({ samples: ov2.effN, hit: 0.55 }, 1.5, 20, 2);
  ok(raw2.read !== eff2.read,
     'a 55% edge over the same 480 rows reads "' + raw2.read + '" raw and "'
     + eff2.read + '" on ' + ov2.effN.toFixed(1) + ' observations');
  ok(/\(on n:/.test(t2), 'so there the bracket does appear');
}

/* ---------------------------------------------------------------- 5
   No gate moved. */
{
  const bare = stripComments(FWD);
  ok(!/function hgOmniPoolRead/.test(FWD),
     'hgOmniPoolRead is not redefined here');
  ok(/readFn\(\{ samples: effN, hit: p\.hit \}, minRr, 20, barZ\)/.test(bare),
     'the corrected read reuses that function, the same hit rate and the same 20-sample floor');
  ok(/readFn\(p, minRr, 20, barZ\)/.test(bare),
     'and the uncorrected read is still computed, not removed');

  /* the correction is display-only: nothing outside the panel consumes it */
  const OMNI = fs.readFileSync(root + 'omniroute.js', 'utf8');
  const pr = OMNI.slice(OMNI.indexOf('function hgOmniPoolRead'));
  ok(/var se = Math\.sqrt\(pBreak \* \(1 - pBreak\) \/ Math\.max\(1, p\.samples\)\)/.test(pr),
     'hgOmniPoolRead still takes its own standard error over whatever samples it is handed');

  /* and CRYPTO SCAN says why this matters most on its own shape */
  ok(/READ ITS `INDEP` COLUMN BEFORE ITS `SETTLED` ONE/.test(SCAN),
     'cryptoscan.js tells the reader which column to read first');
  ok(/CROSS-SECTIONAL/.test(SCAN), 'and names the shape that makes it necessary');
  ok(/effN = 4\.96/.test(SCAN), 'with the measured figure for its own firing shape');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
