/* HARDGATE — the indicators that resume produce what they produced before.

   hg-v843 stopped goldind's __rows re-reading the whole tape on every call and
   the OMNIGOLD scan got 2.4x cheaper. Re-profiling what was left showed no
   single culprit any more but the same SHAPE repeated: a full-array indicator,
   rebuilt from bar zero, called once per bar by the replay. The three largest,
   on a 600-bar scan:

     atr()              3,881ms  16.3%   indicators.js
     hgGoldBvcDelta()   2,292ms   9.7%   goldind.js  (+ most of hgGoldNormCdf's 3.6%)
     hgOgLocalHour()    1,467ms   6.2%   omnigold.js — an Intl.DateTimeFormat
                                         built fresh on every single call

   The first two now resume on an append; the third keeps one formatter per
   timezone. This file is the differential that says resuming changes nothing:
   for each, a series built by appending bar by bar is compared element by
   element against the same series computed in one pass over a SEPARATE array
   of identical bars, which cannot hit the memo.

   Tapes with NaN prices are in the fuzz deliberately. atr() poisons its own
   running average once a bad bar lands and stays NaN for good, and "never
   seeded" and "poisoned" are different states — a resume that confused them
   would revive a series the old code left dead. That case is asserted by
   name, not just fuzzed.

   Run: node tests/test-indicator-resume.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* An Intl that counts how many formatters get built. */
function makeCtx(){
  let built = 0;
  const RealIntl = Intl;
  const CountingIntl = {
    DateTimeFormat: function(loc, opts){
      built++;
      return new RealIntl.DateTimeFormat(loc, opts);
    }
  };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, WeakMap, Set, Map,
                Promise, Error, NaN, Infinity, Intl: CountingIntl,
                setTimeout: f => { try { f && f(); } catch (e) {} return 0; }, clearTimeout: () => {},
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
                document: { getElementById: () => null, querySelector: () => null,
                            createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                            addEventListener(){} },
                fetch: () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}) }) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: '', search: '', hash: '' };
  ctx.navigator = { userAgent: 'node', onLine: true };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return { ctx, formatters: () => built };
}
const { ctx: C, formatters } = makeCtx();

/* A deterministic tape. holeAt injects a bar with a NaN price. */
function tape(n, seed, holeAt){
  let p = 2000, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.5) * 0.01);
    const r = p * 0.003 * (0.4 + rnd());
    const bar = { t: 1700000000 + i * 3600, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 500 + rnd() * 900 };
    if (i === holeAt) bar.h = NaN;
    out.push(bar);
  }
  return out;
}
const copy = rows => rows.map(r => Object.assign({}, r));
const same = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++){
    const x = a[i], y = b[i];
    if (Number.isNaN(x) && Number.isNaN(y)) continue;
    if (x !== y) return false;
  }
  return true;
};

console.log('== the three functions are reachable, and they are the real ones ==');
{
  ok(typeof C.atr === 'function', 'atr is loaded');
  ok(typeof C.hgGoldBvcDelta === 'function', 'hgGoldBvcDelta is exported');
  ok(typeof C.hgOgLocalHour === 'function', 'hgOgLocalHour is exported');
  const a = C.atr(tape(60, 3), 14);
  ok(a.length === 60 && Number.isNaN(a[0]) && Number.isNaN(a[13]) && isFinite(a[14]),
     'atr is NaN until its period fills and finite after — this is Wilder ATR, not a stub');
  ok(isFinite(a[59]) && a[59] > 0, `and it ends at a real value (${a[59].toFixed(4)})`);
}

console.log('== atr: appending bar by bar equals one pass over a fresh tape ==');
{
  let checked = 0;
  for (const [n, seed, hole, p] of [[80, 11, -1, 14], [200, 12, -1, 14], [200, 13, -1, 20],
                                    [120, 14, 40, 14], [120, 15, 5, 14], [90, 16, 89, 14],
                                    [60, 17, 0, 14], [400, 18, -1, 7]]){
    const full = tape(n, seed, hole);
    /* grow ONE array, the way the replay does */
    const view = [];
    let resumed = null;
    for (let i = 0; i < n; i++){ view.push(full[i]); resumed = C.atr(view, p); }
    /* and compute once over a separate array of identical bars */
    const fresh = C.atr(copy(full), p);
    ok(same(resumed, fresh),
       `n=${n} p=${p}${hole >= 0 ? ' hole@' + hole : ''}: ${n} appends give the same ${fresh.length} values as one pass`);
    checked++;
  }
  ok(checked === 8, `${checked} tapes compared element by element, NaNs included`);
}

console.log('== atr: a poisoned series stays poisoned across a resume ==');
{
  /* A bar with a NaN price makes the running average NaN, and the original
     never recovers — every later bar is NaN too. "Never seeded" (null) and
     "poisoned" (NaN) are the two states the memo has to keep apart. */
  const rows = tape(60, 21, 30);
  const one = C.atr(copy(rows), 14);
  ok(isFinite(one[20]) && Number.isNaN(one[40]) && Number.isNaN(one[59]),
     'computed in one pass, the series is finite before the bad bar and NaN forever after it');
  const view = [];
  let res = null;
  for (let i = 0; i < 60; i++){ view.push(rows[i]); res = C.atr(view, 14); }
  ok(same(res, one),
     'and grown one bar at a time it dies at the same bar and stays dead — the resume did not revive it');
  ok(Number.isNaN(res[59]), 'the last value is still NaN, not a re-seeded number');
}

console.log('== atr: period is part of the key, and a non-append rebuilds ==');
{
  const rows = tape(120, 31);
  const a14 = C.atr(rows, 14), a20 = C.atr(rows, 20), a14b = C.atr(rows, 14);
  ok(!same(a14, a20), 'atr(rows,14) and atr(rows,20) are different series over one tape');
  ok(same(a14, a14b), 'and asking for 14 again gives 14, not whatever 20 left behind');
  ok(same(a20, C.atr(copy(rows), 20)), 'each matching the same period computed on a fresh tape');

  const shrink = tape(120, 32);
  C.atr(shrink, 14);
  shrink.length = 60;
  ok(same(C.atr(shrink, 14), C.atr(copy(shrink), 14)),
     'a tape truncated to 60 answers 60 values — shorter is rebuilt, not resumed');

  const swap = tape(80, 33);
  C.atr(swap, 14);
  swap[79] = Object.assign({}, swap[79], { h: swap[79].h * 1.5 });
  ok(same(C.atr(swap, 14), C.atr(copy(swap), 14)),
     'replacing the last bar read rebuilds — the resume checks that bar by identity');
}

console.log('== hgGoldBvcDelta: the same differential, and window is part of the key ==');
{
  let checked = 0;
  for (const [n, seed, hole, w] of [[80, 41, -1, 20], [160, 42, -1, 20], [160, 43, -1, 8],
                                    [120, 44, 33, 20], [100, 45, 0, 12]]){
    const full = tape(n, seed, hole);
    const view = [];
    let resumed = null;
    for (let i = 0; i < n; i++){ view.push(full[i]); resumed = C.hgGoldBvcDelta(view, w); }
    const fresh = C.hgGoldBvcDelta(copy(full), w);
    ok(same(resumed, fresh),
       `n=${n} window=${w}${hole >= 0 ? ' hole@' + hole : ''}: appending gives the same signed volumes as one pass`);
    checked++;
  }
  ok(checked === 5, `${checked} tapes compared`);
  const rows = tape(120, 51);
  const w20 = C.hgGoldBvcDelta(rows, 20), w6 = C.hgGoldBvcDelta(rows, 6);
  ok(!same(w20, w6), 'two windows over one tape are two different series');
  ok(same(w20, C.hgGoldBvcDelta(copy(rows), 20)), 'and each matches its own fresh computation');
  ok(C.hgGoldBvcDelta(null) === null || (C.hgGoldBvcDelta([]) || []).length === 0,
     'an empty or absent tape still answers without throwing');
}

console.log('== hgOgLocalHour: one formatter per timezone, same answers ==');
{
  const before = formatters();
  /* 2024-06-15 12:00 UTC is BST (London +1); 2024-01-15 12:00 UTC is GMT (+0). */
  const summer = Date.UTC(2024, 5, 15, 12, 0, 0) / 1000;
  const winter = Date.UTC(2024, 0, 15, 12, 0, 0) / 1000;
  ok(C.hgOgLocalHour(summer, 'Europe/London') === 13, 'a June noon UTC reads 13:00 in London — BST is applied');
  ok(C.hgOgLocalHour(winter, 'Europe/London') === 12, 'a January noon UTC reads 12:00 — GMT, no shift');
  ok(C.hgOgLocalHour(summer, 'America/New_York') === 8, 'and 08:00 in New York on EDT');
  ok(C.hgOgLocalHour(winter, 'America/New_York') === 7, 'and 07:00 on EST — this is DST-aware, not a fixed offset');

  const spent = formatters() - before;
  ok(spent === 2, `two timezones asked for, ${spent} formatters built`);
  for (let i = 0; i < 500; i++){ C.hgOgLocalHour(summer + i * 3600, 'Europe/London'); }
  ok(formatters() - before === 2,
     '500 more London lookups built no further formatters — the cache is what makes this cheap');
  ok(C.hgOgLocalHour(winter, 'Europe/London') === 12, 'and the cached formatter still answers correctly');

  const badBefore = formatters();
  ok(Number.isNaN(C.hgOgLocalHour(summer, 'Not/AZone')), 'an invalid timezone is NaN, as callers expect');
  for (let i = 0; i < 50; i++) C.hgOgLocalHour(summer, 'Not/AZone');
  ok(formatters() - badBefore === 1,
     'and the failure is remembered too — 51 bad lookups tried construction once, not 51 times');
  ok(Number.isNaN(C.hgOgLocalHour(NaN, 'Europe/London')) && Number.isNaN(C.hgOgLocalHour(summer, '')),
     'a non-finite timestamp and an empty timezone are still NaN without touching Intl');
}

console.log('\n' + passed + ' passed, 0 failed');
