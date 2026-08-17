/* HARDGATE — the seven mechanics and four indicator reads added to OMNIGOLD.

   Asked to widen the gold desk with more indicators and strategies. The risk
   in that request is not that a detector is wrong — it is that a detector
   ships UNMEASURED. A mechanic that fires, produces a ticket, and has no
   in-sample history and no out-of-sample record is worse than no mechanic at
   all, because it still costs money and nothing in the app can ever judge it.

   So the load-bearing assertions here are the REGISTRATION ones. Each kind
   must appear in three places:

     1. the live detect pass          -> it can fire
     2. the walk-forward backtest map -> it gets an in-sample record
     3. the renderPooled key list     -> that record is on the card

   Miss (2) and the measured-edge gate has nothing to read. Miss (3) and the
   user cannot see what they are trading. Both fail silently.

   The firing tests are deliberately built so each mechanic fires on a fixture
   constructed for it: a first pass over 300 random series left LONDON-FIX and
   SMT-DIVERGE at zero firings, which turned out to be fixture artefacts (the
   generator never ended a series in the 15:00 hour, and never made the metals
   disagree). A test that cannot distinguish "never fires" from "my fixture
   never asked it to" is not a test.

   Run: node tests/test-omnigold-mechanics.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-forward.js',
                   'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const NEW = ['PDH-SWEEP', 'PDL-SWEEP', 'LONDON-FIX', 'VWAP-REVERT', 'NR7-BREAK',
             'SMT-DIVERGE', 'TREND-RECLAIM'];

/* A day-aligned origin, so bar i sits at hour i%24 UTC. */
const T0 = 1700000000 - (1700000000 % 86400);
const bar = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });
/* A flat, well-behaved base series: no mechanic should fire on it by accident. */
function flat(n, p0){
  const out = []; let p = p0 === undefined ? 3350 : p0;
  for (let i = 0; i < n; i++) out.push(bar(i, p, p * 1.0008, p * 0.9992, p));
  return out;
}

const W = boot();
const D = (rows, opts) => W.hgOgDetect(rows, opts || {});
const kinds = (rows, opts) => D(rows, opts).map(h => h.kind);
const one = (rows, kind, opts) => D(rows, opts).filter(h => h.kind === kind)[0] || null;

console.log('== all seven are registered in ALL THREE places ==');
{
  ok(typeof W.hgOgDetect === 'function', 'hgOgDetect is exported');

  /* (2) the walk-forward backtest map — the source of the in-sample record. */
  for (const k of NEW){
    const re = new RegExp("'" + k + "':\\s*function\\s*\\(r\\)");
    ok(re.test(SRC), k + ' has a backtest entry, so it accumulates an in-sample record');
  }

  /* (3) OG_MECHANICS — the single list the pooled table renders from AND the
     measured-edge multiple-comparisons bar is computed from. A mechanic
     missing here would both hide from the card and understate the
     correction, so it is one list rather than two. */
  const listSrc = SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'));
  ok(listSrc.length > 0, 'OG_MECHANICS was found');
  for (const k of NEW) ok(listSrc.indexOf("'" + k + "'") >= 0, k + ' is in OG_MECHANICS');
  ok(/var keys = OG_MECHANICS\.slice\(\);/.test(SRC), 'the pooled table renders from that list');

  /* (1) the detect pass is proven behaviourally below — a regex would pass on
     a call that is dead code. */
}

console.log('\n== a flat series fires nothing new: the fixtures below are not vacuous ==');
{
  const base = flat(300);
  const fired = kinds(base).filter(k => NEW.includes(k));
  ok(fired.length === 0, 'no new mechanic fires on a flat tape (' + (fired.join(',') || 'none') + ')');
}

console.log('\n== PDH-SWEEP / PDL-SWEEP: the prior day level, swept and rejected ==');
{
  /* 48 bars = two full days. Day one sets the range; the last bar of day two
     pokes through it and closes back inside. */
  function sweep(dir){
    const rows = [];
    for (let i = 0; i < 24; i++) rows.push(bar(i, 3350, 3360, 3340, 3350));   /* PDH 3360, PDL 3340 */
    for (let i = 24; i < 47; i++) rows.push(bar(i, 3350, 3354, 3346, 3350));
    /* NOTE: the poke must be >=20% of the bar range to count as a sweep. */
    if (dir === 'high') rows.push(bar(47, 3355, 3372, 3352, 3356));           /* above 3360, closes below */
    else                rows.push(bar(47, 3345, 3348, 3328, 3344));           /* below 3340, closes above */
    return rows;
  }
  const hi = one(sweep('high'), 'PDH-SWEEP');
  ok(!!hi, 'PDH-SWEEP fires when the prior day high is swept and rejected');
  ok(hi.dir === 'short', 'and it is a SHORT — the sweep failed (' + hi.dir + ')');
  ok(Math.abs(hi.level - 3360) < 1e-6, 'anchored to the prior day high (' + hi.level + ')');
  ok(/prior day high/.test(hi.why), 'and says so on the card');

  const lo = one(sweep('low'), 'PDL-SWEEP');
  ok(!!lo, 'PDL-SWEEP fires on the mirror case');
  ok(lo.dir === 'long', 'and it is a LONG (' + lo.dir + ')');
  ok(Math.abs(lo.level - 3340) < 1e-6, 'anchored to the prior day low');

  /* A clean break that HOLDS is continuation, not a sweep. It must not fire. */
  const held = sweep('high').slice(0, 47).concat([bar(47, 3355, 3375, 3354, 3374)]);
  ok(!one(held, 'PDH-SWEEP'), 'a break that closes ABOVE the level is not a sweep, and does not fire');

  /* A poke too shallow to be a sweep. */
  const graze = sweep('high').slice(0, 47).concat([bar(47, 3355, 3360.4, 3350, 3356)]);
  ok(!one(graze, 'PDH-SWEEP'), 'a graze of under 20% of the bar range does not count');
}

console.log('\n== LONDON-FIX: only in the fix hour, and only on a decisive bar ==');
{
  /* The last bar must land on the target hour AND the series must clear the
     40-bar minimum hgOgDetect requires, so walk the index forward whole days
     until both hold. */
  function atHour(hr, last){
    let idx = hr;
    while (idx < 44) idx += 24;
    const rows = [];
    for (let i = 0; i < idx; i++) rows.push(bar(i, 3350, 3352, 3348, 3350));
    rows.push({ t: T0 + idx * 3600, ...last });
    return rows;
  }
  const up = atHour(15, { o: 3350, h: 3366, l: 3349, c: 3364, v: 3000 });
  const g = one(up, 'LONDON-FIX');
  ok(!!g, 'LONDON-FIX fires on a decisive bar in the 15:00 hour');
  ok(g.dir === 'long', 'up bar reads long (' + g.dir + ')');
  ok(/15:00 London fix/.test(g.why), 'and names the window (' + g.why + ')');

  /* Must close below the PRIOR bar too, not merely below its own open: a red
     bar that still closes at yesterday's level has not driven anywhere. */
  const dn = atHour(16, { o: 3364, h: 3365, l: 3344, c: 3346, v: 3000 });
  ok((one(dn, 'LONDON-FIX') || {}).dir === 'short', 'a down bar in the 16:00 hour reads short');

  /* THE POINT OF THE MECHANIC: the hour is the signal. Same bar, wrong hour. */
  const wrong = atHour(9, { o: 3350, h: 3366, l: 3349, c: 3364, v: 3000 });
  ok(!one(wrong, 'LONDON-FIX'), 'the identical bar at 09:00 does NOT fire — the hour is the mechanic');

  /* An indecisive bar in the right hour is noise, not a fix drive. */
  const doji = atHour(15, { o: 3356, h: 3366, l: 3346, c: 3357, v: 3000 });
  ok(!one(doji, 'LONDON-FIX'), 'a doji in the fix hour does not fire — it needs a body');
}

console.log('\n== VWAP-REVERT: two standard deviations from session VWAP ==');
{
  const rows = flat(60);
  /* Drive the last bar far above the recent mean. */
  const p = 3350 * 1.02;
  rows[rows.length - 1] = bar(59, 3350, p * 1.001, 3349, p);
  const s = one(rows, 'VWAP-REVERT');
  ok(!!s, 'VWAP-REVERT fires on a stretched close');
  ok(s.dir === 'short', 'a stretch ABOVE VWAP is faded short (' + s.dir + ')');
  ok(/SD above session VWAP/.test(s.why), 'and states the stretch in SD (' + s.why + ')');
  ok(isFinite(s.level) && s.level > 0, 'with a finite VWAP level to target (' + s.level.toFixed(2) + ')');

  const dn = flat(60);
  dn[dn.length - 1] = bar(59, 3350, 3351, 3350 * 0.979, 3350 * 0.98);
  ok((one(dn, 'VWAP-REVERT') || {}).dir === 'long', 'and a stretch below is bought');

  ok(!one(flat(60), 'VWAP-REVERT'), 'a series sitting on its VWAP does not fire');
}

console.log('\n== NR7-BREAK: narrowest of seven, then real expansion ==');
{
  function nr7(expand){
    const rows = flat(40);
    /* Seven bars back from the last: widen six, pinch the one before last. */
    for (let k = 8; k >= 2; k--){
      const i = rows.length - k, p = 3350;
      rows[i] = bar(i, p, p + 12, p - 12, p);
    }
    const iN = rows.length - 2;
    rows[iN] = bar(iN, 3350, 3351, 3349, 3350);            /* the narrow bar: range 2 */
    const iL = rows.length - 1;
    rows[iL] = expand ? bar(iL, 3350, 3360, 3349, 3358)    /* range 11 > 1.5x2, closes above 3351 */
                      : bar(iL, 3350, 3352, 3349.5, 3351.5);
    return rows;
  }
  const b = one(nr7(true), 'NR7-BREAK');
  ok(!!b, 'NR7-BREAK fires on expansion out of the narrowest bar');
  ok(b.dir === 'long', 'breaking above reads long (' + b.dir + ')');
  ok(/narrowest bar in seven/.test(b.why), 'and explains the compression');
  ok(!one(nr7(false), 'NR7-BREAK'), 'without real expansion it does not fire — compression alone is not a trade');
}

console.log('\n== SMT-DIVERGE: needs the second leg, and will not guess without it ==');
{
  function leg(n, start, dir){
    const out = []; let p = start;
    for (let i = 0; i < n; i++){ p = p * (1 + (i > n - 12 ? dir * 0.004 : 0.0001)); out.push(bar(i, p, p * 1.001, p * 0.999, p)); }
    return out;
  }
  const gold = leg(60, 3350, +1);

  /* THE HONESTY CASE, and the reason this mechanic is worth having at all:
     with no silver series it returns null rather than inventing a read. */
  delete W.__hgXagCandles;
  ok(!one(gold, 'SMT-DIVERGE'), 'with no silver series it does not fire — a one-legged pair has no signal');

  W.__hgXagCandles = leg(60, 41, -1);
  const s = one(gold, 'SMT-DIVERGE');
  ok(!!s, 'with silver present and disagreeing, SMT-DIVERGE fires');
  ok(s.dir === 'short', 'gold up against silver down fades the gold leg (' + s.dir + ')');
  ok(/the metals disagree/.test(s.why), 'and says which way each leg went (' + s.why + ')');

  W.__hgXagCandles = leg(60, 41, +1);
  ok(!one(gold, 'SMT-DIVERGE'), 'when both metals agree there is no divergence, and nothing fires');

  /* A silver series too short to read must not throw or half-fire. */
  W.__hgXagCandles = leg(5, 41, -1);
  ok(!one(gold, 'SMT-DIVERGE'), 'a silver series too short to measure is treated as absent');
  delete W.__hgXagCandles;
}

console.log('\n== TREND-RECLAIM: a stack, a pullback through it, and a reclaim ==');
{
  const rows = [];
  let p = 3200;
  for (let i = 0; i < 80; i++){ p = p * 1.0012; rows.push(bar(i, p, p * 1.001, p * 0.999, p)); }
  /* Dip the second-to-last close under the 21-EMA, then close back above it. */
  const n = rows.length;
  rows[n - 2] = bar(n - 2, p, p * 1.001, p * 0.97, p * 0.975);
  rows[n - 1] = bar(n - 1, p * 0.975, p * 1.004, p * 0.974, p * 1.003);
  const t = one(rows, 'TREND-RECLAIM');
  ok(!!t, 'TREND-RECLAIM fires on a pullback reclaimed inside an up stack');
  ok(t.dir === 'long', 'and follows the stack, not the dip (' + t.dir + ')');
  ok(/21-EMA/.test(t.why), 'naming the level it reclaimed');

  /* A pullback that does NOT reclaim is just a pullback. */
  const failing = rows.slice(0, n - 1).concat([bar(n - 1, p * 0.975, p * 0.98, p * 0.96, p * 0.965)]);
  ok(!one(failing, 'TREND-RECLAIM'), 'a pullback that keeps falling does not fire');
}

console.log('\n== every new detector survives degenerate input without throwing ==');
{
  const CASES = [
    [], [null], [undefined],
    flat(3),
    [bar(0, NaN, NaN, NaN, NaN)],
    flat(60).map(r => ({ ...r, h: null, l: null })),        /* the isFinite(null) trap, in the data */
    flat(60).map(r => ({ ...r, c: undefined })),
    flat(60).map(r => ({ ...r, t: null })),
    flat(60).map(r => ({ ...r, v: 0 })),                    /* zero volume: VWAP must not divide by zero */
    flat(60).map(r => ({ ...r, h: r.l, l: r.h })),          /* inverted bars */
    flat(60).map((r, i) => (i % 2 ? { ...r, o: 'x', c: 'y' } : r))
  ];
  for (let i = 0; i < CASES.length; i++){
    let threw = null, out = null;
    try { out = D(CASES[i]); } catch (e) { threw = e; }
    ok(!threw, 'detect on degenerate case #' + i + ' does not throw' + (threw ? ' — ' + threw.message : ''));
    ok(Array.isArray(out), 'and returns an array (#' + i + ')');
    for (const h of out){
      ok(h && typeof h.kind === 'string' && h.kind, 'every hit has a kind (#' + i + ')');
      ok(h.dir === 'long' || h.dir === 'short', 'every hit has a direction (#' + i + ')');
      ok(isFinite(h.level), 'every hit has a finite level (#' + i + ': ' + h.kind + ' ' + h.level + ')');
      ok(typeof h.why === 'string' && !/NaN|undefined|null/.test(h.why),
        'and a clean reason with no NaN on the card (#' + i + ': ' + h.why + ')');
    }
  }
}

console.log('\n== nowSec: null must not silently disable the prior-day mechanics ==');
{
  /* isFinite(null) is TRUE. Reading nowSec with isFinite would set the day
     boundary to epoch zero, no bars would fall in the prior day window, and
     PDH/PDL-SWEEP would go quiet with no error anywhere. This is the seventh
     time this trap has turned up in this codebase. */
  const rows = [];
  for (let i = 0; i < 24; i++) rows.push(bar(i, 3350, 3360, 3340, 3350));
  for (let i = 24; i < 47; i++) rows.push(bar(i, 3350, 3354, 3346, 3350));
  rows.push(bar(47, 3355, 3372, 3352, 3356));

  const withUndef = kinds(rows, {});
  ok(withUndef.includes('PDH-SWEEP'), 'with nowSec absent the sweep is detected');
  for (const bad of [null, '', NaN, undefined, 'x']){
    const got = kinds(rows, { nowSec: bad });
    ok(got.includes('PDH-SWEEP'),
      'nowSec=' + JSON.stringify(bad) + ' falls back to the last bar rather than epoch zero');
  }
  ok(!/var ref = isFinite\(nowSec\)/.test(SRC), 'and the unsafe isFinite(nowSec) read is gone from the source');
}

console.log('\n== the four indicator reads are gates, and unknown reads UNCHECKED ==');
{
  /* NOTE: OMNIGOLD builds its OWN ledger in hgOgGates. omniroute's
     hgOmniGates is a different function on a different desk — testing that
     one would have proved nothing about the tab these gates render on, the
     same trap the measured-edge fix hit. */
  const G = W.hgOgGates;
  ok(typeof G === 'function', 'the gold desk gate builder is reachable');
  const rows = flat(300);
  const HIT = { kind: 'ROUND-MAGNET', dir: 'short', level: 3350, why: 'test' };
  const gs = G(rows, HIT, { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
  const by = k => gs.filter(g => g.key === k)[0];

  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    const g = by(k);
    ok(!!g, k + ' is on the ledger');
    ok(g.hard === false, k + ' is CONTEXT, not a hard veto — it has no measured record on this desk');
    ok(typeof g.why === 'string' && g.why.length > 0, k + ' always states a reason');
    ok(!/NaN|undefined/.test(g.why), k + ' never puts NaN on the card (' + g.why.slice(0, 48) + ')');
    ok(g.pass === true || g.pass === false || g.pass === null,
      k + ' is pass, fail, or UNCHECKED — never a truthy object');
  }
}

console.log('\n== THE ONE THAT MATTERS: each gate actually READS on real data ==');
{
  /* A gate wired to a return shape the indicator does not have reads
     UNCHECKED forever and looks, on the card, exactly like an indicator that
     merely could not be computed. Three of these four were written against
     shapes that do not exist — ichimokuState returns .priceVsCloud, not
     .state; donchian returns { up, lo } as ARRAYS, not { upper, lower }
     scalars. Nothing failed, nothing threw, and four permanent "unavailable"
     lines would have shipped. Assert the read, not just the presence. */
  const rows = [];
  let p = 3300;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.0022 + Math.cos(i / 4) * 0.0008);
    rows.push(bar(i, p, p * 1.0016, p * 0.9984, p, 900 + (i % 37) * 20));
  }
  const gs = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: p, why: 't' },
                         { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    const g = gs.filter(x => x.key === k)[0];
    ok(g.pass !== null, k + ' returns a real read on a real series (' + g.why + ')');
    ok(!/unavailable|threw/.test(g.why), k + ' is not reporting itself unreadable');
  }
  /* and the numbers on the card are the indicator's, not placeholders */
  const don = gs.filter(x => x.key === 'donchian-pos')[0];
  ok(/% of the 20-bar range|broken (ABOVE|BELOW) the 20-bar range/.test(don.why),
    'donchian states the actual position (' + don.why + ')');
  ok(!/-\d*% of/.test(don.why), 'and never prints a negative percentage of a range');
  const ich = gs.filter(x => x.key === 'ichimoku')[0];
  ok(/cloud/.test(ich.why), 'ichimoku states the cloud read (' + ich.why + ')');
  const hu = gs.filter(x => x.key === 'hurst-regime')[0];
  ok(/Hurst \d/.test(hu.why), 'hurst states the exponent (' + hu.why + ')');
  const st = gs.filter(x => x.key === 'stoch-rsi')[0];
  ok(/stoch RSI \d/.test(st.why), 'stoch RSI states its value (' + st.why + ')');
}

console.log('\n== an indicator that cannot be computed reads UNCHECKED, never PASS ==');
{
  /* Boot a context where the four indicator functions are missing entirely,
     which is exactly what a partial script load looks like in the browser. */
  const W2 = boot();
  /* NOT delete: a top-level function declaration in a vm context is a
     non-configurable global, delete silently does nothing, and this whole
     section then tests the fully-loaded app while claiming otherwise. It did
     exactly that until the assertion below caught it. */
  for (const fn of ['ichimokuState', 'donchian', 'stochRsi', 'hgHurstRS']){
    W2[fn] = undefined;
    ok(typeof W2[fn] !== 'function', fn + ' is genuinely gone from this context');
  }
  const gs = W2.hgOgGates(flat(300), { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
                          { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is still on the ledger when its indicator is missing');
    ok(g.pass === null, k + ' reads UNCHECKED rather than PASS (' + g.why + ')');
    ok(/unavailable|threw/.test(g.why), 'and says why it could not be read');
  }
}

console.log('\n== an indicator that THROWS is caught and reported, not swallowed ==');
{
  const W3 = boot();
  W3.donchian = () => { throw new Error('boom'); };
  const gs = W3.hgOgGates(flat(300), { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
                          { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
  const g = gs.filter(x => x.key === 'donchian-pos')[0];
  ok(g.pass === null, 'a throwing indicator reads UNCHECKED');
  ok(/threw/.test(g.why), 'and the card says it threw (' + g.why + ')');
}

console.log('\n== the new gates do not quietly become a wall of vetoes ==');
{
  /* Four more HARD gates on a twelve-gate ledger would cut tickets to almost
     nothing, and the cut would be arbitrary. They must stay soft until they
     have a record of their own. */
  const hardKeys = (SRC.match(/gates\.push\(\{ key:'[a-z-]+', hard:true/g) || []).length;
  const total = (SRC.match(/gates\.push/g) || []).length;
  /* Not a hardcoded number: the ledger grows, and a count assertion that has
     to be edited every time teaches you to edit it without thinking. What
     matters is that the source and the runtime agree. */
  const live = W.hgOgGates(flat(300), { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
                           { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
  ok(total === live.length, 'every gates.push in the source reaches the ledger (' + total + ')');
  ok(live.length >= 16, 'and the ledger has not shrunk (' + live.length + ')');
  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    const re = new RegExp("key:'" + k + "', hard:false");
    ok(re.test(SRC), k + ' is declared hard:false in the source');
  }
}

console.log('\n== hurst-regime only flags the mismatch it was added to catch ==');
{
  const W4 = boot();
  const rows = flat(300);
  const gate = (kind, H) => {
    W4.hgHurstRS = () => ({ hurst: H });
    const gs = W4.hgOgGates(rows, { kind, dir: 'long', level: 3350, why: 't' },
                            { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 });
    return gs.filter(x => x.key === 'hurst-regime')[0];
  };
  const bad = gate('VWAP-REVERT', 0.72);
  ok(bad.pass === false, 'a reversion mechanic in a trending tape is flagged');
  ok(/reversion mechanic against a trending tape/.test(bad.why), 'and the reason names the mismatch');

  ok(gate('TREND-RECLAIM', 0.72).pass === true, 'a trend mechanic in a trending tape is fine');
  ok(gate('VWAP-REVERT', 0.38).pass === true, 'a reversion mechanic in a mean-reverting tape is fine');
  ok(gate('VWAP-REVERT', 0.50).pass === true, 'and a random walk is not held against either');
}

console.log('\n== every new mechanic starts with NO record, and the card must say so ==');
{
  /* The whole point. A brand-new mechanic has zero samples in-sample and zero
     settled trades out-of-sample. measured-edge must not report an edge. */
  const gs = W.hgOgGates(flat(300), { kind: 'NR7-BREAK', dir: 'long', level: 3350, why: 't' },
                         { stats: { samples: 0, hit: NaN, expR: NaN }, fwd: null, minRr: 1.5 });
  const me = gs.filter(g => g.key === 'measured-edge')[0];
  ok(!!me, 'measured-edge is on the ledger for a new mechanic');
  ok(me.pass !== true, 'and it does NOT pass on a mechanic with no record (' + me.pass + ')');
  ok(!/NaN/.test(me.why), 'with no NaN on the card (' + me.why + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD MECHANICS TESTS PASSED');
