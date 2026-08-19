/* HARDGATE — round four on OMNIGOLD: robustness, and two defects it exposed.

   Asked a fourth time for more indicators and strategies, this time for
   ROBUST setups. At 27 mechanics, more detectors alone buy less than they
   cost: each one raises the multiple-comparisons bar for every other and
   makes a two-sided tape more likely. So this round is weighted toward reads
   that make an existing setup more trustworthy — higher-timeframe agreement,
   regime fit, and a volatility FORECAST — with seven new mechanics chosen for
   being different in kind rather than for the count.

   Two things this round caught, both mine:

   1. CUSUM-SHIFT shipped against the library default k=1. That is the CUSUM
      decision interval in units of ONE BAR's return sigma, so the threshold
      is crossed almost every bar: swept over 300 tapes it reported a fresh
      structural shift on 299 of them. As a TREND-family mechanic it would
      have swamped the consensus vote on every single scan. k=12 puts it at
      11%, which is what a structural mean shift should be.

   2. The consensus gate passed BOTH directions when every family was split.
      nAgree=0 and nAgainst=0 fell into the "nothing firing against it"
      branch and printed "0 families agree, nothing firing against it".
      Nothing agreeing is not the same as nothing disagreeing. A latent hole
      since the split rule landed in v357; round four made splits common
      enough to hit it, and it had restored the exact long-and-short-at-once
      defect v356 existed to remove.

   Run: node tests/test-omnigold-round4.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
/* The instrument-agnostic detectors moved to hg-mechanics.js so OMNIROUTE
   could use them without a second copy. omnigold keeps thin delegations under
   the same names, so behaviour is unchanged — but assertions about the
   detector SOURCE have to read the file it now lives in. */
const MECH = fs.readFileSync(path.join(ROOT, 'hg-mechanics.js'), 'utf8');
const BOTH = SRC + '\n' + MECH;

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', textContent: '', id: '',
                    appendChild(){}, setAttribute(){}, querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });
const D = rows => W.hgOgDetect(rows, {});
const one = (rows, kind) => D(rows).filter(x => x.kind === kind)[0] || null;

const NEW = ['CUSUM-SHIFT', 'VOL-EXPANSION', 'PIN-REJECT', 'ENGULF-LEVEL',
             'POC-REVERT', 'COINT-SPREAD', 'THREE-BAR'];
const NEW_GATES = ['htf-confirm', 'regime-fit', 'vol-forecast'];

function tape(n, seed, px){
  const out = []; let p = px || 3350, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const hr = i % 24, b = (hr >= 13 && hr <= 17) ? 2.4 : (hr >= 8 && hr <= 12 ? 1.5 : 0.7);
    p = p * (1 + (rnd() - 0.48) * 0.0034 * b);
    const r = p * 0.0015 * b * (0.4 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 700 + rnd() * 1400 });
  }
  return out;
}

console.log('== all seven are registered in all four places ==');
{
  const listSrc = SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'));
  const famSrc = SRC.slice(SRC.indexOf('var OG_FAMILY'), SRC.indexOf('function hgOgFamilyOf'));
  for (const k of NEW){
    ok(new RegExp("'" + k + "':\\s*function\\s*\\(r\\)").test(SRC), k + ' has a backtest entry');
    ok(listSrc.indexOf("'" + k + "'") >= 0, k + ' is in OG_MECHANICS');
    ok(famSrc.indexOf("'" + k + "'") >= 0, k + ' is mapped to a consensus family');
  }
}

console.log('\n== THE DEFECT: a mechanic that fires on 99.7% of tapes is not a signal ==');
{
  ok(/f\(closes, 12\)/.test(BOTH), 'CUSUM runs at k=12, not the library default of 1');
  ok(/reported a fresh shift on 299 of them/.test(BOTH), 'and the source records why');

  /* Behavioural, not just the constant: sweep it. */
  let fires = 0, tapes = 0;
  for (let s = 1; s <= 120; s++){
    const rows = tape(400, s);
    tapes++;
    if (one(rows, 'CUSUM-SHIFT')) fires++;
  }
  const pct = fires / tapes * 100;
  ok(pct < 30, 'CUSUM-SHIFT fires on ' + pct.toFixed(0) + '% of tapes, not ~100%');
  ok(pct > 1, 'but it has not been tuned into silence either (' + pct.toFixed(0) + '%)');
}

console.log('\n== each new mechanic fires on a fixture that genuinely meets it ==');
{
  /* PIN-REJECT: a bar that is overwhelmingly lower wick. The random tape
     above cannot make one — its bars are symmetric by construction — so a
     zero there would mean nothing. Build the condition explicitly. */
  let r = [];
  for (let i = 0; i < 60; i++) r.push(B(i, 3350, 3352, 3348, 3350));
  r.push(B(60, 3350, 3351, 3320, 3348, 3000));
  const pin = one(r, 'PIN-REJECT');
  ok(!!pin, 'PIN-REJECT fires on a 90% lower-wick bar');
  ok(pin.dir === 'long' && Math.abs(pin.level - 3320) < 1e-6, 'long, anchored to the wick low');
  ok(/lower wick/.test(pin.why), 'and quotes the wick share (' + pin.why + ')');

  /* A big body is not a pin, however long the wick looks. */
  const body = r.slice(0, 60).concat([B(60, 3350, 3351, 3320, 3324, 3000)]);
  ok(!one(body, 'PIN-REJECT'), 'a mostly-body bar is not a pin');

  /* ENGULF-LEVEL: must take the prior extreme, not merely close past it. */
  r = [];
  for (let i = 0; i < 60; i++) r.push(B(i, 3350, 3353, 3347, 3350));
  r.push(B(60, 3350, 3351, 3336, 3338, 2000));
  r.push(B(61, 3338, 3364, 3334, 3362, 4000));
  const eng = one(r, 'ENGULF-LEVEL');
  ok(!!eng, 'ENGULF-LEVEL fires when the engulfing bar takes the prior low');
  ok(eng.dir === 'long' && Math.abs(eng.level - 3336) < 1e-6, 'long, anchored to the prior low');

  const noTake = r.slice(0, 61).concat([B(61, 3338, 3364, 3337, 3362, 4000)]);
  ok(!one(noTake, 'ENGULF-LEVEL'), 'an engulfing bar that never traded through the prior low does not fire');

  /* VOL-EXPANSION: needs a real volatility regime shift, which the random
     tape has no mechanism to produce. */
  r = []; let p = 3350;
  for (let i = 0; i < 200; i++){ p = p * (1 + ((i % 2) ? 0.0004 : -0.00035)); r.push(B(i, p, p * 1.0006, p * 0.9994, p)); }
  for (let i = 200; i < 230; i++){ p = p * (1 + ((i % 2) ? 0.006 : -0.0055)); r.push(B(i, p * 0.994, p * 1.008, p * 0.992, p)); }
  p = p * 1.012; r.push(B(230, p * 0.988, p * 1.002, p * 0.987, p * 1.001, 5000));
  const vx = one(r, 'VOL-EXPANSION');
  ok(!!vx, 'VOL-EXPANSION fires when volatility genuinely breaks out of its long-run level');
  ok(/x its long-run level/.test(vx.why), 'and states the multiple (' + vx.why + ')');

  /* The others do fire on ordinary tapes. */
  const found = {};
  for (let s = 1; s <= 120; s++) D(tape(400, s)).forEach(h => { found[h.kind] = (found[h.kind] || 0) + 1; });
  for (const k of ['POC-REVERT', 'THREE-BAR', 'CUSUM-SHIFT']){
    ok((found[k] || 0) > 0, k + ' fires on ordinary tapes (' + (found[k] || 0) + '/120)');
  }
}

console.log('\n== COINT-SPREAD refuses to trade a pair that is not cointegrated ==');
{
  const g = tape(300, 5);
  delete W.__hgXagCandles;
  ok(!one(g, 'COINT-SPREAD'), 'no silver series, no spread trade');
  /* An uncointegrated spread has no mean to revert to; trading it as though
     it did is the classic way to lose money on a pairs trade. */
  ok(/co\.cointegrated !== true/.test(SRC), 'the mechanic requires cointegrated === true');
  ok(/hl > 40/.test(SRC), 'and refuses a half-life longer than the horizon can wait for');
  delete W.__hgXagCandles;
}

console.log('\n== THE OTHER DEFECT: every family split must not pass BOTH ways ==');
{
  const rows = tape(300, 21);
  const px = rows[rows.length - 1].c;
  const hit = (kind, dir) => ({ kind, dir, level: px, why: 't' });
  const con = (h, all) => W.hgOgGates(rows, h, { stats: { samples: 200, hit: 0.62, expR: 0.9 },
    minRr: 1.5, planRisk: 12, allHits: all }).filter(g => g.key === 'consensus')[0];

  /* SWEEP split, TREND split, nothing else — the shape that slipped through. */
  const all = [hit('ROUND-MAGNET', 'long'), hit('THREE-BAR', 'short'),
               hit('MMOVE', 'long'), hit('TREND-RECLAIM', 'short')];
  const L = con(all[0], all), S = con(all[1], all);
  ok(L.pass === false, 'the long side is vetoed');
  ok(S.pass === false, 'and so is the short side — both, not neither');
  ok(/no directional opinion at all/.test(L.why), 'the card says the desk has no opinion (' + L.why + ')');
  ok(!/nothing firing against it/.test(L.why), 'and never claims "nothing firing against it" with zero agreeing');
  ok(!/^0 famil/.test(L.why), 'no "0 families agree" text can reach the card');

  /* The genuine no-opposition case still passes. */
  const clean = [hit('ORB', 'long'), hit('FVG-FILL', 'long')];
  const C = con(clean[0], clean);
  ok(C.pass === true, 'families agreeing with nothing against still passes');
  ok(/nothing firing against it/.test(C.why), 'and that wording is reserved for when something IS agreeing');
}

console.log('\n== htf-confirm: the read that actually adds robustness ==');
{
  const rows = tape(400, 9);
  const px = rows[rows.length - 1].c;
  const gs = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: px, why: 't' },
    { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 });
  const g = gs.filter(x => x.key === 'htf-confirm')[0];
  ok(!!g, 'htf-confirm is on the ledger');
  ok(g.info === true, 'as an info read — a counter-trend trade is a real choice, not a fault');
  ok(g.pass !== null, 'and it reads on a real series (' + g.why + ')');
  ok(/4x timeframe is (up|down)/.test(g.why), 'naming the higher-timeframe direction');
  ok(/EMA21 .* vs EMA50/.test(g.why), 'with the numbers behind it');

  /* Resampling must be built from the bars in hand, not a second fetch. */
  ok(/function hgOgResample\(rows, factor\)/.test(BOTH), 'the higher timeframe is resampled');
  ok(/hgOgResample\(rows, 4\)/.test(SRC), 'at 4x the scan timeframe');

  /* A reversion mechanic is counter-trend on every timeframe by design. */
  const rev = W.hgOgGates(rows, { kind: 'ROUND-MAGNET', dir: 'long', level: px, why: 't' },
    { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 })
    .filter(x => x.key === 'htf-confirm')[0];
  ok(rev.pass === true, 'and it does not argue against a fade for being counter-trend');
}

console.log('\n== the resampler is honest about the bars it builds ==');
{
  /* The REAL function, not a re-parsed copy: lifting it out of the IIFE
     drops its closure over num()/fin() and would test a different thing. */
  const src = W.hgOgResample;
  ok(typeof src === 'function', 'hgOgResample is exported for testing');
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push(B(i, 100 + i, 110 + i, 90 + i, 105 + i, 10));
  const out = src(rows, 4);
  ok(out.length === 3, '12 bars at 4x gives 3 (' + out.length + ')');
  ok(out[0].o === rows[0].o, 'open comes from the first bar of the group');
  ok(out[0].c === rows[3].c, 'close from the last');
  ok(out[0].h === Math.max(rows[0].h, rows[1].h, rows[2].h, rows[3].h), 'high is the group high');
  ok(out[0].l === Math.min(rows[0].l, rows[1].l, rows[2].l, rows[3].l), 'low is the group low');
  ok(out[0].v === 40, 'volume sums across the group');
  ok(out[0].t === rows[0].t, 'and the timestamp is the group open');

  /* A ragged tail would silently mis-date every bar, so the partial group is
     dropped from the OLD end, keeping the most recent bars aligned. */
  const ragged = rows.slice(0, 11);
  const out2 = src(ragged, 4);
  ok(out2.length === 2, 'a ragged series drops the partial group (' + out2.length + ')');
  ok(out2[out2.length - 1].c === ragged[ragged.length - 1].c,
     'and the NEWEST bar is preserved — dropping from the recent end would misprice the live read');

  for (const bad of [null, [], undefined]) ok(src(bad, 4) === null, 'degenerate input returns null');
  ok(src(rows, 0) === null, 'and a factor of 0 does not divide by zero');
}

console.log('\n== regime-fit and vol-forecast read, and never veto ==');
{
  const rows = tape(400, 11);
  const px = rows[rows.length - 1].c;
  const gs = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: px, why: 't' },
    { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 });
  for (const k of ['regime-fit', 'vol-forecast']){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the ledger');
    ok(g.info === true, k + ' is an info read');
    ok(g.pass !== null, k + ' reads on a real series (' + g.why + ')');
    ok(!/NaN|undefined|unavailable|threw/.test(g.why), k + ' is not reporting itself broken');
  }
  const grade = W.hgOmniGrade(gs);
  ok(NEW_GATES.every(k => grade.vetoes.indexOf(k) === -1), 'none of the new gates can veto');
}

console.log('\n== nothing new throws on degenerate input ==');
{
  const CASES = [[], [null], tape(5, 1),
    tape(300, 2).map(r => ({ ...r, h: null, l: null })),
    tape(300, 3).map(r => ({ ...r, v: 0 })),
    tape(300, 4).map(r => ({ ...r, c: undefined })),
    tape(300, 5).map(r => ({ ...r, t: null }))];
  for (let i = 0; i < CASES.length; i++){
    let threw = null, out = null;
    try { out = D(CASES[i]); } catch (e) { threw = e; }
    ok(!threw, 'detect #' + i + ' does not throw' + (threw ? ' — ' + threw.message : ''));
    ok(Array.isArray(out), 'and returns an array (#' + i + ')');
    for (const h of out){
      ok(isFinite(h.level), '#' + i + ' ' + h.kind + ' has a finite level');
      ok(!/NaN|undefined|null/.test(h.why), '#' + i + ' ' + h.kind + ' has a clean reason');
    }
    let gThrew = null;
    try { W.hgOgGates(CASES[i], { kind: 'ORB', dir: 'long', level: 3350, why: 't' }, { minRr: 1.5 }); }
    catch (e) { gThrew = e; }
    ok(!gThrew, 'the ledger survives case #' + i + (gThrew ? ' — ' + gThrew.message : ''));
  }
}

console.log('\n== the correction still tracks the real mechanic count ==');
{
  const listSrc = SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'));
  const count = (listSrc.match(/'[A-Z0-9-]+'/g) || []).length;
  ok(count >= 34, 'OG_MECHANICS now lists ' + count + ' mechanics');
  const rows = tape(300, 31);
  const g = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
    { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 }).filter(x => x.key === 'measured-edge')[0];
  const m = /\+(\d\.\d\d)σ is the bar/.exec(g.why);
  ok(!!m, 'the significance bar is stated on the card');
  ok(parseFloat(m[1]) > 2.89, 'and it ROSE with the extra mechanics (' + m[1] + 'σ, was 2.89σ at 27)');
  ok(new RegExp('\\b' + count + ' mechanics scanned').test(g.why), 'quoting the real count (' + count + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD ROUND-4 TESTS PASSED');
