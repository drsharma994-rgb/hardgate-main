/* =========================================================================
tests/test-hg-forward.mjs

FORWARD LOG — the out-of-sample accumulator.

Everything the app measures today is in-sample: a tab replays the window it
just fetched. Pressing RUN again slides the window rather than adding
evidence, so a mechanic needing ~157 non-overlapping trades can never
converge. This module records each firing once, before its outcome exists,
and settles it later against bars that had not printed at the time.

These tests exist to stop a forward number flattering itself. The four
properties that matter:
  · one record per firing, however many times the scan re-runs
  · never settled by the bar it fired on, or any bar before it
  · a bar spanning both levels counts as a STOP
  · expiry is excluded from the hit rate — it is not a win
========================================================================= */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const win = {};
new Function('window', readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'))(win);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.log('FAIL  - ' + msg); }
}

const base = { tab:'OMNIGOLD', mechanic:'MMOVE', sym:'XAUUSD', tf:'1h',
               dir:'long', entry:100, stop:98, t1:104, barT:1000, horizonBars:10 };

/* bars after the firing bar; t ascends */
function bars(spec){
  return spec.map((s, i) => ({ t: 1000 + (i + 1) * 60, o:s.o ?? 100, h:s.h, l:s.l, c:s.c ?? 100, v:1 }));
}

/* ---- normalisation refuses records it could never settle ---- */
{
  ok(win.hgFwdNormalize(base) !== null, 'a well-formed setup normalises');
  ok(win.hgFwdNormalize(null) === null, 'null is refused');
  ok(win.hgFwdNormalize({ ...base, entry:null }) === null, 'a null entry is refused (isFinite(null) is true — the trap)');
  ok(win.hgFwdNormalize({ ...base, stop:100 }) === null, 'zero risk is refused');
  ok(win.hgFwdNormalize({ ...base, t1:99 }) === null, 'a long target below entry is refused — it could never settle as a win');
  ok(win.hgFwdNormalize({ ...base, dir:'sideways' }) === null, 'an unknown direction is refused');
  ok(win.hgFwdNormalize({ ...base, barT:null }) === null, 'a record with no firing bar is refused');
  ok(Math.abs(win.hgFwdNormalize(base).rr - 2) < 1e-9, 'reward multiple is derived from the levels (2R here)');
}

/* ---- one record per firing, no matter how often the scan re-runs ---- */
{
  let list = [];
  for (let i = 0; i < 25; i++) list = win.hgFwdAdd(list, base).list;
  ok(list.length === 1, 'twenty-five re-scans of the same bar record ONE trade (got ' + list.length + ')');

  const later = win.hgFwdAdd(list, { ...base, barT: 2000 });
  ok(later.added && later.list.length === 2, 'the same mechanic firing on a LATER bar is a new trade');

  const otherSym = win.hgFwdAdd(later.list, { ...base, sym:'BTCUSD' });
  ok(otherSym.added, 'the same bar on a different symbol is a different trade');

  const otherDir = win.hgFwdAdd(otherSym.list, { ...base, dir:'short', t1:96 });
  ok(otherDir.added, 'the opposite direction on the same bar is a different trade');

  ok(win.hgFwdAdd(list, base).added === false, 'a duplicate reports added:false rather than throwing');
}

/* ---- never settled by its own bar, or anything before it ---- */
{
  const rec = win.hgFwdNormalize(base);
  /* a bar AT the firing timestamp that would have hit T1 */
  const sameBar = [{ t:1000, o:100, h:110, l:99, c:105, v:1 }];
  ok(win.hgFwdSettleOne(rec, sameBar).state === 'open',
     'a bar at the firing timestamp cannot settle the record');

  const earlier = [{ t:900, o:100, h:110, l:90, c:105, v:1 }];
  ok(win.hgFwdSettleOne(rec, earlier).state === 'open',
     'an earlier bar cannot settle it either');

  const after = bars([{ h:105, l:99 }]);
  ok(win.hgFwdSettleOne(rec, after).state === 't1',
     'a bar strictly after it does settle');
}

/* ---- the conservative rule, identical to the in-sample walk-forward ---- */
{
  const rec = win.hgFwdNormalize(base);
  const both = bars([{ h:105, l:97 }]);          /* spans T1 (104) and stop (98) */
  const s = win.hgFwdSettleOne(rec, both);
  ok(s.state === 'stop' && s.r === -1,
     'a bar spanning BOTH levels counts as a stop, never a win');

  ok(win.hgFwdSettleOne(rec, bars([{ h:103, l:99 }, { h:105, l:99 }])).state === 't1',
     'T1 on a later bar settles as a win');
  ok(win.hgFwdSettleOne(rec, bars([{ h:103, l:99 }, { h:103, l:97 }])).state === 'stop',
     'stop on a later bar settles as a loss');
}

/* ---- expiry is not a win ---- */
{
  const rec = win.hgFwdNormalize({ ...base, horizonBars: 3 });
  const flat = bars([{ h:101, l:99 }, { h:101, l:99 }, { h:101, l:99 }, { h:101, l:99 }]);
  const s = win.hgFwdSettleOne(rec, flat);
  ok(s.state === 'expired' && s.r === null, 'a trade that reaches neither level expires with null R');

  const st = win.hgFwdStatsOf([s], 'OMNIGOLD', 'MMOVE');
  ok(st.samples === 0, 'an expired trade contributes NO sample to the hit rate');
  ok(st.expired === 1, 'but it is counted and visible as expired');
}

/* ---- pooling matches the in-sample stat shape ---- */
{
  const mk = (state, barT, rr) => ({ ...win.hgFwdNormalize({ ...base, barT }), state, r: state === 't1' ? rr : (state === 'stop' ? -1 : null) });
  const list = [ mk('t1',1), mk('t1',2), mk('stop',3), mk('stop',4), mk('open',5), mk('expired',6) ];
  const st = win.hgFwdStatsOf(list, 'OMNIGOLD', 'MMOVE');
  ok(st.samples === 4, 'settled samples exclude open and expired (got ' + st.samples + ')');
  ok(st.wins === 2 && st.losses === 2, 'wins and losses counted');
  ok(st.open === 1 && st.expired === 1, 'open and expired reported separately');
  ok(Math.abs(st.hit - 0.5) < 1e-9, 'hit rate is wins / settled');
  ok(Math.abs(st.expR - 0.5) < 1e-9, 'expectancy uses the reward multiple actually recorded (2R at 50% = +0.5R)');

  const pool = win.hgFwdPoolOf(list, 'OMNIGOLD');
  ok(pool.MMOVE && pool.MMOVE.samples === 4, 'pooling by tab returns a block per mechanic');

  /* the shared verdict helper must read a forward block without translation */
  ok(typeof st.samples === 'number' && typeof st.hit === 'number' && typeof st.expR === 'number',
     'the forward stat block has the same shape the in-sample pool uses');
}

/* ---- settle only touches the matching symbol ---- */
{
  let list = [];
  list = win.hgFwdAdd(list, base).list;
  list = win.hgFwdAdd(list, { ...base, sym:'BTCUSD' }).list;
  const r = win.hgFwdSettle(list, 'XAUUSD', '1h', bars([{ h:105, l:99 }]));
  ok(r.changed === 1, 'only the matching symbol settles');
  ok(r.list.filter(x => x.sym === 'BTCUSD')[0].state === 'open', 'the other symbol is untouched');
}

/* ---- the cap prunes oldest-first ---- */
{
  let list = [];
  for (let i = 0; i < win.HG_FWD_MAX + 50; i++) list = win.hgFwdAdd(list, { ...base, barT: 1000 + i }).list;
  ok(list.length === win.HG_FWD_MAX, 'the log is capped at HG_FWD_MAX (' + win.HG_FWD_MAX + ')');
  const oldest = Math.min(...list.map(r => r.barT));
  ok(oldest > 1000, 'the oldest records were pruned, not the newest');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL FORWARD-LOG TESTS PASSED');
