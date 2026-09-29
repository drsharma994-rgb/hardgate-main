/* HARDGATE — hg-v1017: the MTF confluence gate (goldscalp gate 11) asked the
   alignment question of LONGS ONLY.

   hgGoldMtfBias has always read both stacks — px > EMA20 > EMA50 is bull,
   px < EMA20 < EMA50 is bear. But hgGoldMtfMatrix published a one-sided
   verdict: scalpLongOk = both timeframes bull-stacked, while scalpShortOk sat
   at its fail-open initializer on EVERY non-conflict tape, and the one
   consumer (hgGoldInstFilter) only asked about longs:

       mtfBlock = scalpLocked || (dir === 'long' && scalpLongOk === false)

   So a gold scalp SHORT minted into a full H4+Daily BULL stack — the
   strongest bull alignment this desk reads — passed the MTF gate untouched,
   could lead and could be MOST PROBABLE, while a long into the mirror tape
   was demoted (GOLD SCALP soft path) or dropped (OMNIGOLD hard path). The
   same one-sided family as the hg-v1016 macro lock, one gate up the list.

   The mirror is the long side's OWN bar: a scalp short needs H4 and Daily
   both BEAR-stacked to lead, exactly as a long needs both bull-stacked. An
   unstacked tape demotes BOTH directions — halving the bar for shorts would
   be a second rule, not a mirror. Conflict still locks the desk both ways;
   missing feeds still fail open both ways. A TIGHTENING, stated as a prior:
   it only ever demotes or drops, no threshold moves.

   Covers:
     1) the matrix: the mirrored bar, the additive reason, the long side
        byte-identical
     2) conflict and unchecked: unchanged, both ways
     3) the REAL filter: a short into a bull stack is demoted/dropped with the
        short's own reason — and a short into a bear stack is not touched
     4) the long path through the filter is byte-identical
     5) the source says what shipped
   Run: node tests/test-gold-mtf-short-mirror-v1017.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported below */ }
  }
  return ctx;
}

/* monotonic-drift candles stack the EMAs (same shape as test-gold-inst-gates) */
function emaRows(n, start, drift, step){
  const out = []; let p = start;
  for (let i = 0; i < n; i++){
    const o = p; p = p + drift;
    out.push({ t: 1700000000 + i * step, o: o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
  }
  return out;
}
function bars(n, start, step, seed){
  const out = []; let p = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.002);
    const r = p * 0.0015 * (0.4 + rnd());
    out.push({ t: 1700000000 + i * step, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}
const BULL4 = emaRows(80, 2000, 1.2, 14400), BULL1 = emaRows(80, 2000, 1.2, 86400);
const BEAR4 = emaRows(80, 2800, -1.2, 14400), BEAR1 = emaRows(80, 2800, -1.2, 86400);
const FLAT4 = emaRows(80, 2400, 0, 14400), FLAT1 = emaRows(80, 2400, 0, 86400);
const NY = Date.UTC(2024, 0, 16, 14, 0, 0); /* NY overlap — the session gate passes */
const vwap = (dir) => ({ stratKey: 'vwap', dir: dir, id: 'vwap|' + dir + '|2400', strategy: 'VWAP', stamps: [], gateNotes: [] });

console.log('== 1) the matrix: the mirrored bar, the additive reason, the long side byte-identical ==');
{
  const W = boot();
  const bothBull = W.hgGoldMtfMatrix({ rows4h: BULL4, rows1d: BULL1 });
  assert(bothBull.scalpLongOk === true && bothBull.conflict === false,
         'both bull-stacked: longs allowed, as always');
  assert(bothBull.scalpShortOk === false,
         'both bull-stacked: a scalp SHORT no longer passes — the defect fixed');
  assert(/MTF BIAS — scalp shorts need H4 and Daily price < EMA20 < EMA50/.test(bothBull.reasonShort || ''),
         'and the short side gets its own named reason (' + bothBull.reasonShort + ')');
  assert(bothBull.reason === null,
         'the long reason stays null where the long side passes — the short verdict does not leak into it');
  const bothBear = W.hgGoldMtfMatrix({ rows4h: BEAR4, rows1d: BEAR1 });
  assert(bothBear.scalpShortOk === true && bothBear.scalpLongOk === false,
         'both bear-stacked: shorts allowed, longs demoted — the mirror image');
  assert(bothBear.reason === 'MTF BIAS — scalp longs need H4 and Daily price > EMA20 > EMA50',
         'and the long reason text is byte-identical to what it always said');
  assert(bothBear.reasonShort === null, 'the short reason stays null where the short side passes');
  const unstacked = W.hgGoldMtfMatrix({ rows4h: FLAT4, rows1d: FLAT1 });
  assert(unstacked.scalpLongOk === false && unstacked.scalpShortOk === false,
         'an UNSTACKED tape demotes BOTH directions — the long side\'s own bar, mirrored, not a weaker one');
  const halfStack = W.hgGoldMtfMatrix({ rows4h: BEAR4, rows1d: FLAT1 });
  assert(halfStack.scalpShortOk === false && halfStack.conflict === false,
         'one bear stack with the other unstacked is not alignment — shorts do not lead on it');
}

console.log('== 2) conflict and unchecked: unchanged, both ways ==');
{
  const W = boot();
  const conflict = W.hgGoldMtfMatrix({ rows4h: BEAR4, rows1d: BULL1 });
  assert(conflict.conflict === true && conflict.scalpLocked === true
      && conflict.scalpLongOk === false && conflict.scalpShortOk === false
      && /MTF CONFLICT/.test(conflict.reason || ''),
         'HTF conflict still locks the whole scalp desk, both directions, with the same reason');
  const conflict2 = W.hgGoldMtfMatrix({ rows4h: BULL4, rows1d: BEAR1 });
  assert(conflict2.conflict === true && conflict2.scalpLocked === true,
         'and the reverse conflict locks it too');
  const miss = W.hgGoldMtfMatrix({ rows4h: BULL4 });
  assert(miss.unchecked === true && miss.scalpLongOk === true && miss.scalpShortOk === true
      && miss.scalpLocked === false,
         'a missing Daily fails OPEN for shorts exactly as for longs — the desk is not locked on a read it cannot make');
  const missBoth = W.hgGoldMtfMatrix({});
  assert(missBoth.unchecked === true && missBoth.scalpShortOk === true,
         'and both missing fails open both ways');
}

console.log('== 3) the REAL filter: a short into a bull stack answers the bar ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  /* GOLD SCALP soft path: demote, stamp, name the reason — cards still paint */
  const dem = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: BULL4, rows1d: BULL1
  });
  assert(dem && !dem.dropped && dem.demoted === true,
         'a short into a full H4+Daily bull stack is DEMOTED on the scalp soft path');
  assert((dem.stamps || []).indexOf('MTF BIAS') >= 0,
         'stamped MTF BIAS (' + (dem.stamps || []).join(', ') + ')');
  assert(/scalp shorts need H4 and Daily price < EMA20 < EMA50/.test(dem.reason || '')
      || (dem.gateNotes || []).some(g => /scalp shorts need/.test(g)),
         'and the reason names the SHORT side\'s bar, not the long\'s (' + (dem.reason || '') + ')');
  assert(dem.mtf && dem.mtf.scalpShortOk === false,
         'the cand carries the matrix record showing the short verdict');
  /* OMNIGOLD hard path: the drop */
  const hard = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, rows4h: BULL4, rows1d: BULL1
  });
  assert(hard && hard.dropped === true && /MTF BIAS — scalp shorts/.test(hard.reason || ''),
         'the hard path DROPS the same short with the short\'s reason (' + (hard.reason || '') + ')');
  /* a short into a full BEAR stack: the MTF gate has nothing to say */
  const okShort = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, rows4h: BEAR4, rows1d: BEAR1
  });
  assert(okShort && okShort.mtf && okShort.mtf.scalpShortOk === true
      && !/MTF/.test(okShort.reason || ''),
         'a short into a full bear stack is NOT touched by the MTF gate — alignment its way passes');
  /* a short with NO HTF feeds: fail open */
  const noFeed = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true
  });
  assert(noFeed && noFeed.mtf && noFeed.mtf.unchecked === true
      && !/MTF/.test(noFeed.reason || ''),
         'and a short with unreadable HTF feeds fails open, never a fabricated bias');
}

console.log('== 4) the long path through the filter is byte-identical ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  const dem = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: BEAR4, rows1d: BEAR1
  });
  assert(dem && dem.demoted === true
      && dem.reason === 'MTF BIAS — scalp longs need H4 and Daily price > EMA20 > EMA50',
         'a long into a bear stack is demoted with EXACTLY the pre-v1017 reason');
  const okLong = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: BULL4, rows1d: BULL1
  });
  assert(okLong && okLong.mtf && okLong.mtf.scalpLongOk === true && !/MTF/.test(okLong.reason || ''),
         'and a long into a bull stack passes the gate as it always has');
  const conflict = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, rows4h: BEAR4, rows1d: BULL1
  });
  assert(conflict && conflict.dropped === true && /MTF CONFLICT/.test(conflict.reason || ''),
         'a short into a conflict still gets the CONFLICT drop — not the new bias reason');
}

console.log('== 5) the source says what shipped ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/out\.scalpShortOk = !!\(h4\.bear && d1\.bear\);/.test(src),
         'the short bar is computed in the matrix — both timeframes bear-stacked');
  assert(/out\.reason = 'MTF BIAS — scalp longs need H4 and Daily price > EMA20 > EMA50';/.test(src),
         'the long reason string is byte-identical in source');
  assert(/reasonShort = 'MTF BIAS — scalp shorts need H4 and Daily price < EMA20 < EMA50';/.test(src),
         'and the short reason stands beside it');
  assert(/dir === 'short' && mtf\.scalpShortOk === false/.test(src),
         'the filter asks the short question now');
  const GS = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  assert(/scalp shorts require H4 and Daily\s+both bearish/.test(GS),
         'and the desk\'s own gate list documents the mirror (docs follow behavior)');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD MTF SHORT-MIRROR TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
