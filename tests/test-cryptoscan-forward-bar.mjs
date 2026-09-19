/* HARDGATE — the forward log stamped every record with the FORMING bar.

   hgFwdRecordScan derived its bar like this:

     var barT = Math.floor((Date.now() / 1000) / sec) * sec;

   That names the bar currently forming. An engine votes on CLOSED bars —
   cryptoultra's closedRows drops the forming one — so the bar it actually
   read is always the one before. Measured on 15m:

     scan start   scan end   bar the engine read   barT stamped   gap
     14:00        14:03      13:45                 14:00          1 bar
     14:14        14:17      13:45                 14:15          2 bars
     14:10        14:25      13:45                 14:15          2 bars

   CRYPTO SCAN walks hundreds of contracts with two sequential fetches each
   and calls the recorder once at the end, so straddling a boundary is routine.

   Three consequences, all from that one line.

   The record names a bar that had not closed when the setup was made, which
   implies information the engine did not have.

   Settlement walks rows STRICTLY AFTER barT, so the first bar of the trade is
   skipped: a setup entered at the close of 13:45 was settled from 14:15,
   never from 14:00 — and on a 15m scalp that first bar is where most fills
   and stops happen.

   And the dedup rule breaks on the case it exists for. Its own comment says
   "re-running a scan inside the same bar records each setup once". Two scans
   that voted on the SAME closed bar, one ending 14:58 and one ending 15:03,
   get barT 14:45 and 15:00 — one firing, two records.

   CRYPTO SCAN has always had the right answer on the setup: res.bar.t, the
   closed bar the card prints as "closed 15m bar ... UTC". It now passes it,
   and callers that pass nothing keep the old behaviour exactly.

   Run: node tests/test-cryptoscan-forward-bar.mjs */
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

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  const store = {};
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;
const hhmm = t => new Date(t * 1000).toISOString().slice(11, 16);

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the arithmetic that made the bar wrong');
{
  /* closedRows keeps t <= now/1000 - ivSec, so the last CLOSED bar is */
  const voted = nowMs => Math.floor(((nowMs / 1000) - SEC) / SEC) * SEC;
  /* and the old recorder stamped */
  const stamped = nowMs => Math.floor((nowMs / 1000) / SEC) * SEC;

  let gaps = new Set();
  for (let m = 0; m < 15; m++){
    const now = Date.UTC(2026, 8, 19, 14, 0, 0) + m * 60000;
    gaps.add((stamped(now) - voted(now)) / SEC);
  }
  ok(gaps.size === 1 && gaps.has(1),
     'at every minute inside a bar the stamp was exactly one bar ahead of the vote');

  const start = Date.UTC(2026, 8, 19, 14, 14, 0), end = Date.UTC(2026, 8, 19, 14, 17, 0);
  ok((stamped(end) - voted(start)) / SEC === 2,
     'a scan that straddles a boundary made it two (' + hhmm(voted(start)) + ' vs ' + hhmm(stamped(end)) + ')');

  const fwd = stripComments(FWD);
  /* the rule lives in BOTH walks — hgFwdSettleFill and hgFwdSettleOne — so
     count them, or a mutation to one hides behind the other */
  const strictly = (fwd.match(/if \(!isFinite\(t\) \|\| t <= rec\.barT\) continue;/g) || []).length;
  ok(strictly === 2,
     'both settlement walks skip rows at or before barT (' + strictly + ' of 2)');
  ok(/\[rec\.tab, rec\.mechanic, rec\.sym, rec\.dir, rec\.barT\]\.join/.test(fwd),
     'and barT is part of the dedup key');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the caller\'s bar is honoured, and nothing else changed');
{
  const fwd = stripComments(FWD);
  ok(/function barOf\(c\)\{/.test(fwd), 'the recorder takes a bar from the candidate');
  ok(/barT: barOf\(c\)/.test(fwd), 'and uses it for the record');
  ok(/if \(!isFinite\(v\) \|\| v <= 0\) return barT;/.test(fwd),
     'a candidate with no bar falls back to the floor-of-now, so other desks are untouched');
  ok(/return \(f > barT\) \? barT : f;/.test(fwd),
     'and a bar in the future is refused — nothing was read on a bar that has not happened');

  const scan = stripComments(SCAN);
  ok(/var barT = \(s\.bar && isFinite\(\+s\.bar\.t\) && \+s\.bar\.t > 0\) \? \+s\.bar\.t : undefined;/.test(scan),
     'csFwdRows reads the closed bar off the setup');
  ok(/new Date\(s\.bar\.t \* 1000\)/.test(scan),
     'which is the same field the card prints as "closed 15m bar ... UTC"');

  const mk = (sym, barT) => ({ sym: sym, dir: 'long', voteTier: 'weak', isHighQuality: false,
                               bar: barT === undefined ? undefined : { t: barT },
                               plan: { entry: 100, stop: 95, t1: 110 } });
  const voted = Math.floor((Date.UTC(2026, 8, 19, 13, 45, 0) / 1000) / SEC) * SEC;
  const rows = S.__csFwdRows([mk('BTCUSDT', voted), mk('ETHUSDT', undefined)]);
  ok(rows.length === 2, 'both rows build');
  ok(rows[0].barT === voted,
     'a setup with a bar carries it (' + (isFinite(rows[0].barT) ? hhmm(rows[0].barT) : String(rows[0].barT)) + ')');
  ok(rows[1].barT === undefined, 'and one without carries nothing, rather than a fabricated bar');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the record now names the bar the engine read');
{
  const voted = Math.floor((Date.UTC(2026, 8, 19, 13, 45, 0) / 1000) / SEC) * SEC;
  const nowBar = Math.floor((Date.now() / 1000) / SEC) * SEC;

  /* read the stored records back, so this asserts what was WRITTEN */
  const LS = (/var LS_KEY = '([^']+)'/.exec(FWD) || [])[1];
  ok(!!LS, 'the store key is discoverable (' + LS + ')');
  const stored = () => JSON.parse(S.localStorage.getItem(LS) || '[]');
  const wipe = () => S.localStorage.removeItem(LS);

  wipe();
  const n = S.hgFwdRecordScan('T1', '15m', [{
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
    mechanic: 'VOTE-WEAK@V4', barT: voted
  }], { horizonBars: 24 });
  ok(n === 1, 'the record is written');
  const got = stored()[0] ? stored()[0].barT : null;
  ok(stored().length === 1 && got === voted,
     'and it carries the bar the engine read (' + (isFinite(got) ? hhmm(got) : String(got))
       + '), not the forming one (' + hhmm(nowBar) + ')');
  ok(stored()[0].barT !== nowBar, 'the two are genuinely different values here');

  /* a candidate with no bar keeps the old floor-of-now, for every other desk */
  wipe();
  S.hgFwdRecordScan('T1b', '15m', [{
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, mechanic: 'M'
  }], { horizonBars: 24 });
  ok(stored()[0].barT === nowBar, 'no bar supplied still floors NOW, unchanged');

  /* a bar in the future is clamped, never stored as given */
  wipe();
  S.hgFwdRecordScan('T2', '15m', [{
    sym: 'ETHUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
    mechanic: 'M', barT: nowBar + 10 * SEC
  }], { horizonBars: 24 });
  ok(stored()[0].barT === nowBar, 'a future bar is clamped to the current one');

  /* a bar that is not aligned to the timeframe is floored to it */
  wipe();
  S.hgFwdRecordScan('T2b', '15m', [{
    sym: 'ETHUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
    mechanic: 'M', barT: voted + 137
  }], { horizonBars: 24 });
  ok(stored()[0].barT === voted, 'an unaligned bar is floored to the timeframe');

  /* two scans on the same voted bar are ONE record, which is the whole rule */
  wipe();
  const row = () => ({ sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
                       mechanic: 'VOTE-WEAK@V4', barT: voted });
  const first = S.hgFwdRecordScan('T3', '15m', [row()], { horizonBars: 24 });
  const again = S.hgFwdRecordScan('T3', '15m', [row()], { horizonBars: 24 });
  ok(first === 1 && again === 0,
     'two scans that voted on the same closed bar record once, whatever the wall clock says');

  /* and two DIFFERENT voted bars are two records, as they should be */
  wipe();
  const a = S.hgFwdRecordScan('T4', '15m', [row()], { horizonBars: 24 });
  const b = S.hgFwdRecordScan('T4', '15m', [Object.assign(row(), { barT: voted + SEC })],
                              { horizonBars: 24 });
  ok(a === 1 && b === 1, 'a genuinely new bar is a genuinely new record');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. settlement starts at the bar after the one that was read');
{
  const voted = 1000 * SEC;                       /* a clean synthetic bar */
  const rec = { tab: 'T', mechanic: 'M', sym: 'X', tf: '15m', dir: 'long',
                entry: 100, stop: 95, t1: 110, barT: voted, horizonBars: 24,
                state: 'open', r: null, settledT: null, at: voted };
  /* the bar immediately after entry hits the target; nothing later does */
  const rows = [
    { t: voted,            h: 101, l: 99,  c: 100 },   /* the entry bar itself */
    { t: voted + SEC,      h: 111, l: 99,  c: 110 },   /* T1 hit here */
    { t: voted + 2 * SEC,  h: 101, l: 99,  c: 100 },
    { t: voted + 3 * SEC,  h: 101, l: 99,  c: 100 }
  ];
  /* run the REAL settlement, once with the bar the engine read and once with
     the bar the old code would have stamped */
  ok(typeof S.hgFwdSettleOne === 'function', 'hgFwdSettleOne is reachable');
  const withTrue = S.hgFwdSettleOne(Object.assign({}, rec), rows);
  const withLate = S.hgFwdSettleOne(Object.assign({}, rec, { barT: voted + SEC }), rows);
  ok(!!withTrue, 'the trade settles when the record names the bar that was read');
  ok(withTrue.state === 't1' && withTrue.oneR === true,
     'and it settles as a WIN — the bar after entry hit T1 (state ' + withTrue.state + ')');
  ok(withTrue.settledT === voted + SEC,
     'settled on that very bar (' + hhmm(withTrue.settledT) + ')');

  ok(withLate.state === 'open' && withLate.settledT === null,
     'stamped one bar late, the SAME trade against the SAME bars never settles at all '
       + '— the winning bar was skipped (state ' + withLate.state + ')');
  ok(withTrue.state !== withLate.state,
     'one bar of offset is the difference between a recorded win and a record left open');

  /* and the loss side, so this is not a one-fixture coincidence */
  const lossRows = [
    { t: voted,           h: 101, l: 99, c: 100 },
    { t: voted + SEC,     h: 101, l: 94, c: 95 },     /* stop hit here */
    { t: voted + 2 * SEC, h: 111, l: 99, c: 110 }     /* T1 later, never reached */
  ];
  const lossTrue = S.hgFwdSettleOne(Object.assign({}, rec), lossRows);
  const lossLate = S.hgFwdSettleOne(Object.assign({}, rec, { barT: voted + SEC }), lossRows);
  ok(lossTrue.state === 'stop', 'a losing trade settles as a stop on the true bar');
  ok(lossLate.state === 't1',
     'and stamped one bar late it settles as a WIN instead, because the stop bar was skipped');

  /* the entry bar itself must stay excluded: the plan enters AT ITS CLOSE, so
     its own high and low happened before there was a position. A walk that
     included it would settle trades on their own signal bar. */
  const ownBarOnly = [
    { t: voted,           h: 111, l: 94, c: 100 },   /* would hit both, but it IS the entry bar */
    { t: voted + SEC,     h: 101, l: 99, c: 100 },
    { t: voted + 2 * SEC, h: 101, l: 99, c: 100 }
  ];
  const own = S.hgFwdSettleOne(Object.assign({}, rec), ownBarOnly);
  ok(own.state === 'open',
     'a trade whose own signal bar touched both levels stays OPEN — the entry bar is not traded');
  ok(own.settledT === null, 'and nothing is settled on it');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
