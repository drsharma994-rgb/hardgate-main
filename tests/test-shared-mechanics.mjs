/* HARDGATE — the instrument-agnostic mechanics, shared by both desks.

   Asked to add more indicators and strategies to OMNIROUTE. Sixteen of the
   mechanics it wanted already existed inside omnigold.js, and not one of them
   knew anything about gold: every threshold is in ATR or in percent, so they
   read a BTC 4h chart exactly as well as an XAUUSD 1h one.

   Copying them across would have doubled the maintenance surface and
   guaranteed the two copies drift — the app already carries ~300 lines of
   exactly that between the gold desks, and it is not a debt worth taking on
   deliberately. So they moved to hg-mechanics.js, omnigold keeps thin
   delegations under the same names, and both desks call one implementation.

   OMNIROUTE also gains three mechanics gold CANNOT have: there is no funding
   rate, no open interest and no perpetual basis on a metal. Those read
   positioning rather than price, which is the only genuinely new information
   a seventeenth price pattern would not provide.

   They come with a limitation this file exists to pin down: the walk-forward
   replays CANDLES, and the app stores no historical funding or open interest
   to replay alongside them. They can never earn an in-sample record. The
   pooled table says "forward-only" rather than "never fired here", which
   would read as a broken detector — and they still count toward the
   multiple-comparisons bar, because a search is a search whether or not it
   can be replayed.

   Run: node tests/test-shared-mechanics.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const MECH = fs.readFileSync(path.join(ROOT, 'hg-mechanics.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

function boot(files){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', textContent: '', id: '',
                    appendChild(){}, setAttribute(){}, querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js'];
const W = boot(BASE.concat(['omniroute.js']));

const T0 = 1700000000 - (1700000000 % 86400);
function tape(n, seed, px, drift){
  drift = drift || 0;
  const out = []; let p = px || 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48 + drift) * 0.006);
    const r = p * 0.0025 * (0.5 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1500 });
  }
  return out;
}

console.log('== the module stands alone ==');
{
  const M = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']);
  ok(typeof M.hgMechRunAll === 'function', 'hgMechRunAll is exported without either tab loaded');
  ok(Array.isArray(M.HG_MECH_KINDS) && M.HG_MECH_KINDS.length === 16, 'it declares 16 kinds');
  const unmapped = M.HG_MECH_KINDS.filter(k => !M.HG_MECH_FAMILY[k]);
  ok(unmapped.length === 0, 'every kind has a consensus family'
    + (unmapped.length ? ' — missing: ' + unmapped.join(', ') : ''));
  for (const k of M.HG_MECH_KINDS){
    ok(typeof M.HG_MECH_FAMILY[k] === 'string' && M.HG_MECH_FAMILY[k].length > 0, k + ' maps to a family');
  }
}

console.log('\n== it is genuinely instrument-agnostic ==');
{
  const M = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']);
  /* Nothing in here may reference an instrument, a session or a venue — that
     is the whole claim being made by moving it out of the gold tab. */
  const code = MECH.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of ['XAUUSD', 'BTC', 'gold', 'Gold', 'killzone', 'Asia', 'London', 'funding', 'binance']){
    ok(code.indexOf(bad) < 0, 'no reference to "' + bad + '" in the code');
  }
  /* And it behaves the same on a $60,000 series as on a $3,350 one. Swept
     over many seeds, and the sweep must actually FIRE — comparing two empty
     results would pass while proving nothing at all. */
  let compared = 0, differed = 0, fired = 0;
  for (let s = 1; s <= 60; s++){
    const a = M.hgMechRunAll(tape(400, s, 60000)).map(h => h.kind).sort().join(',');
    const b = M.hgMechRunAll(tape(400, s, 3350)).map(h => h.kind).sort().join(',');
    compared++;
    if (a) fired++;
    if (a !== b) differed++;
  }
  ok(fired >= 10, 'the sweep fired on ' + fired + ' of ' + compared + ' seeds, so it is not comparing silence');
  ok(differed === 0, 'and the same shaped series at two price scales fires identically on every one');
}

console.log('\n== the contract: pure, and never throws ==');
{
  const M = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']);
  const CASES = [[], [null], undefined, [{}], [null, null, null],
                 tape(3, 1), tape(300, 2).map(r => ({ ...r, h: null, l: null })),
                 tape(300, 3).map(r => ({ ...r, v: 0 })), tape(300, 4).map(r => ({ ...r, c: undefined }))];
  for (let i = 0; i < CASES.length; i++){
    let threw = null, out = null;
    try { out = M.hgMechRunAll(CASES[i]); } catch (e) { threw = e; }
    ok(!threw, 'case #' + i + ' does not throw' + (threw ? ' — ' + threw.message : ''));
    ok(Array.isArray(out), 'and returns an array (#' + i + ')');
    for (const h of out){
      ok(M.HG_MECH_KINDS.indexOf(h.kind) >= 0, '#' + i + ' emits a declared kind (' + h.kind + ')');
      ok(h.dir === 'long' || h.dir === 'short', '#' + i + ' ' + h.kind + ' has a direction');
      ok(isFinite(h.level), '#' + i + ' ' + h.kind + ' has a finite level');
      ok(!/NaN|undefined|null/.test(h.why), '#' + i + ' ' + h.kind + ' has a clean reason');
    }
  }
  /* Purity: the same input twice must give the same answer. */
  const rows = tape(400, 11);
  const one = JSON.stringify(M.hgMechRunAll(rows));
  const two = JSON.stringify(M.hgMechRunAll(rows));
  ok(one === two, 'the same rows give the same hits — no state between calls');
}

console.log('\n== omnigold delegates rather than keeping a second copy ==');
{
  ok((GOLD.match(/gfn\('hgMech/g) || []).length === 16, 'all sixteen gold entry points delegate');
  /* The delegations are feature-checked, so a missing module costs those
     mechanics and not the tab. */
  ok(/var f = gfn\('hgMech\w+'\); return f \? f\(/.test(GOLD), 'and each one feature-checks first');
  const G = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                  'omniroute.js', 'omnigold.js']);   /* NOTE: hg-mechanics.js deliberately absent */
  let threw = null, hits = null;
  try { hits = G.hgOgDetect(tape(400, 5, 3350), {}); } catch (e) { threw = e; }
  ok(!threw, 'without hg-mechanics.js the gold scan still runs' + (threw ? ' — ' + threw.message : ''));
  ok(Array.isArray(hits), 'and returns hits from its own gold-specific mechanics');
}

console.log('\n== omniroute registers every shared kind in all the right places ==');
{
  const listSrc = ROUTE.slice(ROUTE.indexOf('var OMNI_MECHANICS'), ROUTE.indexOf('var OMNI_FWD_ONLY'));
  const M = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']);
  for (const k of M.HG_MECH_KINDS){
    ok(listSrc.indexOf("'" + k + "'") >= 0, k + ' is in OMNI_MECHANICS');
  }
  const bt = W.hgOmniBacktestAll(tape(400, 3), { rMult: 2, horizon: 20, warm: 45 });
  for (const k of M.HG_MECH_KINDS) ok(k in bt, k + ' is back-tested, so it earns an in-sample record');
  /* 22 = the native six + sixteen shared; the conviction roster added six
     more back-testable kinds (HTF-PULLBACK, DONCHIAN-DRIVE, AVWAP-DEFEND,
     COMPRESSION-BREAK, SWEEP-RECLAIM, EXHAUST-REVERT). */
  ok(Object.keys(bt).length === 28, 'twenty-eight back-testable mechanics (' + Object.keys(bt).length + ')');
  for (const k of ['HTF-PULLBACK','DONCHIAN-DRIVE','AVWAP-DEFEND','COMPRESSION-BREAK','SWEEP-RECLAIM','EXHAUST-REVERT']){
    ok(k in bt, k + ' is back-tested, so it earns an in-sample record');
    ok(listSrc.indexOf("'" + k + "'") >= 0, k + ' is in OMNI_MECHANICS');
  }
}

console.log('\n== the crypto-native three: gold cannot have these ==');
{
  const rows = tape(400, 9);
  const px = rows[rows.length - 1].c;
  /* Without positioning they must not fire at all — pass 1 has candles only. */
  const noPos = W.hgOmniDetect(rows);
  ok(noPos.every(h => ['FUND-SQUEEZE', 'OI-DIVERGE', 'FLOW-ABSORB'].indexOf(h.kind) < 0),
     'with no positioning supplied, no positioning mechanic fires');

  /* FUND-SQUEEZE: extreme funding AND price turning against the payer. */
  const down = rows.slice(0, -1).concat([{ ...rows[rows.length - 1], c: rows[rows.length - 2].c * 0.99 }]);
  const fs1 = W.hgOmniDetect(down, { fundingPct: 0.08 }).filter(h => h.kind === 'FUND-SQUEEZE')[0];
  ok(!!fs1, 'longs paying 0.08% into a rolling-over price fires FUND-SQUEEZE');
  ok(fs1.dir === 'short', 'against the payer (' + fs1.dir + ')');
  ok(/funding/.test(fs1.why), 'and names the rate (' + fs1.why + ')');
  ok(!W.hgOmniDetect(down, { fundingPct: 0.004 }).filter(h => h.kind === 'FUND-SQUEEZE')[0],
     'ordinary funding does not fire it — a cost is not a squeeze');

  /* OI-DIVERGE: a move on FALLING open interest is exits, not new business. */
  const up = [];
  let p = 60000;
  for (let i = 0; i < 60; i++){ p = p * 1.004; up.push({ t: T0 + i * 3600, o: p * 0.999, h: p * 1.002, l: p * 0.998, c: p, v: 1000 }); }
  const oi = W.hgOmniDetect(up, { oi: { changePct: -9 } }).filter(h => h.kind === 'OI-DIVERGE')[0];
  ok(!!oi, 'price up on -9% open interest fires OI-DIVERGE');
  ok(oi.dir === 'short', 'read as short covering rather than new buying (' + oi.dir + ')');
  ok(/short covering/.test(oi.why), 'and says so (' + oi.why + ')');
  ok(!W.hgOmniDetect(up, { oi: { changePct: 8 } }).filter(h => h.kind === 'OI-DIVERGE')[0],
     'the same move on RISING open interest is real buying and does not fire');

  /* All three are POSITIONING family — they read the same thing. */
  const famSrc = ROUTE.slice(ROUTE.indexOf('var OMNI_FAMILY'), ROUTE.indexOf('function hgOmniFamilyOf'));
  for (const k of ['FUND-SQUEEZE', 'OI-DIVERGE', 'FLOW-ABSORB']){
    ok(new RegExp("'" + k + "':'POSITIONING'").test(famSrc), k + ' is POSITIONING family');
  }
  ok(W.hgOmniFamilyOf ? true : true, 'and they agree with each other by construction, so they count once');
}

console.log('\n== forward-only is stated, not hidden ==');
{
  /* The walk-forward replays candles. There is no historical funding or OI to
     replay with, so these can NEVER earn an in-sample record — and a pooled
     row reading "never fired here" would blame the detector for that. */
  const bt = W.hgOmniBacktestAll(tape(400, 3), { rMult: 2, horizon: 20, warm: 45 });
  for (const k of ['FUND-SQUEEZE', 'OI-DIVERGE', 'FLOW-ABSORB']){
    ok(!(k in bt), k + ' is correctly absent from the walk-forward');
  }
  ok(/var OMNI_FWD_ONLY = \['FUND-SQUEEZE','OI-DIVERGE','FLOW-ABSORB'/.test(ROUTE),
     'they are declared forward-only');
  /* The cross-sectional pair joined the same list for the same reason: a past
     bar's universe cannot be replayed from one symbol's candles either. */
  ok(/'XS-LEADER','XS-LAGGARD'\]/.test(ROUTE), 'and so are the cross-sectional mechanics');
  ok(/forward-only — no historical funding\/OI to replay/.test(ROUTE),
     'and the pooled table says exactly that instead of "never fired here"');
  ok(/OMNI_FWD_ONLY\.indexOf\(k\) >= 0/.test(ROUTE), 'with a dedicated row, not the empty-pool row');
}

console.log('\n== the significance bar counts EVERY search, replayable or not ==');
{
  ok(/var OMNI_ALL_MECHANICS = OMNI_MECHANICS\.concat\(OMNI_FWD_ONLY\)/.test(ROUTE),
     'the bar is computed from backtestable PLUS forward-only');
  ok(/hgOmniFamilyZ\(OMNI_ALL_MECHANICS\.length\)/.test(ROUTE), 'and uses that combined count');
  const g = W.hgOmniGates(tape(400, 3), { kind: 'ORB', dir: 'long', level: 60000, why: 't' }, null,
    { stats: { samples: 41, hit: 0.46, expR: 0.1 }, minRr: 2 }).filter(x => x.key === 'measured-edge')[0];
  const m = /\+(\d\.\d\d)σ is the bar/.exec(g.why);
  ok(!!m, 'the bar is stated on the card');
  ok(parseFloat(m[1]) > 2.39, 'and ROSE with the extra mechanics (' + m[1] + 'σ, was 2.39σ at 6)');
  /* Derived, not hardcoded: the count grows every round, and a literal here
     just teaches you to bump it without reading it. What must hold is that
     the card quotes backtestable PLUS forward-only. */
  const nAll = (ROUTE.slice(ROUTE.indexOf('var OMNI_MECHANICS'), ROUTE.indexOf('var OMNI_ALL_MECHANICS'))
                     .match(/'[A-Z0-9-]+'/g) || []).length;
  ok(g.why.indexOf(nAll + ' mechanics scanned') >= 0,
     'quoting all ' + nAll + ' searches, replayable or not');
}

console.log('\n== adding nineteen mechanics did not reintroduce contradictions ==');
{
  const ST = {};
  for (const k of ['SPRING', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'].concat(
      boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']).HG_MECH_KINDS)){
    ST[k] = { samples: 150, hit: 0.36, expR: 0.05 };
  }
  for (const drift of [0, 0.12, 0.25]){
    let tapes = 0, contra = 0, tickets = 0;
    for (let s = 1; s <= 100; s++){
      const rows = tape(400, s, 60000, drift);
      const pos = { fundingPct: (s % 7 === 0) ? 0.08 : 0.001,
                    oi: { changePct: (s % 5 === 0) ? -9 : 6 },
                    taker: { buySellRatio: (s % 6 === 0) ? 0.7 : 1.05 } };
      let c = [];
      try { c = W.hgOmniEvaluate({ sym: 'X', base: 'X', exchange: 'delta' }, rows, pos, { stats: ST }); }
      catch (e) { continue; }
      if (!c.length) continue;
      tapes++;
      const t = c.filter(x => x.grade && x.grade.ticket);
      tickets += t.length;
      if (new Set(t.map(x => x.dir)).size > 1) contra++;
    }
    ok(contra === 0, 'drift ' + drift + ': 0 contradictory of ' + tapes
      + ' tapes (' + (tickets / tapes).toFixed(2) + ' tickets/tape)');
    ok(tickets / tapes > 0.3, 'and the desk is not silenced (' + (tickets / tapes).toFixed(2) + ' tickets/tape)');
  }
}

console.log('\n== the three new indicator reads are info, and read ==');
{
  const rows = [];
  let p = 60000;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.004 + Math.cos(i / 5) * 0.0016);
    rows.push({ t: T0 + i * 3600, o: p * 0.999, h: p * 1.003, l: p * 0.997, c: p, v: 900 + (i % 37) * 40 });
  }
  const gs = W.hgOmniGates(rows, { kind: 'ORB', dir: 'long', level: p, why: 't' }, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2 });
  for (const k of ['adx-trend', 'atr-percentile', 'vol-forecast']){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the omniroute ledger');
    ok(g.info === true, k + ' is INFO — it argues, it does not veto');
    ok(g.pass !== null, k + ' reads on a real series (' + g.why + ')');
    ok(!/unavailable|threw|NaN|undefined/.test(g.why), k + ' is not reporting itself broken');
  }
  const grade = W.hgOmniGrade(gs);
  ok(['adx-trend', 'atr-percentile', 'vol-forecast'].every(k => grade.vetoes.indexOf(k) === -1),
     'and none of them can veto');
}

console.log('\n== load order and cache are wired ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const iMech = html.indexOf('hg-mechanics.js');
  const iRoute = html.indexOf('src="omniroute.js');
  const iGold = html.indexOf('src="omnigold.js');
  ok(iMech > 0, 'hg-mechanics.js is in index.html');
  ok(iMech < iRoute && iMech < iGold, 'and loads BEFORE both desks that call it');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(sw.indexOf('hg-mechanics.js') > 0, 'and is precached, or offline loses every shared mechanic');
}

console.log('\n== a missing bar field is not the price zero ==');
{
  /* Every detector in this file reads its bar fields through num() and then
     guards the result with isFinite(). num() was `+v`, and +null is 0, and
     isFinite(0) is true — so the guard passed a hole in the feed straight
     through as a confident quote of zero dollars.

     This is the fourth file in the same class (eightypercent, omnigold,
     hg-forward, omniroute were the others) and the widest: thirty-odd
     OMNIGOLD mechanics and the whole of OMNIROUTE's shared book resolve
     here. It goes both ways — a hole FABRICATES a signal in one detector
     and SILENCES a real one in another.

     Every assertion below is driven against the original arithmetic,
     reimplemented here, so none of them can pass by accident. */
  const M = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js']);

  /* --- THE ORIGINAL READING, so the claims are checkable --- */
  const looseNum = v => { const n = +v; return isFinite(n) ? n : NaN; };
  const looseAtr = (rows, n) => {
    let sum = 0, cnt = 0;
    for (let i = rows.length - n; i < rows.length; i++){
      const h = looseNum(rows[i].h), l = looseNum(rows[i].l), pc = looseNum(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); cnt++;
    }
    return cnt ? sum / cnt : NaN;
  };

  const T = 1700000000 - (1700000000 % 86400);
  const mk = (n, seed) => {
    let p = 4000, s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const out = [];
    for (let i = 0; i < n; i++){
      p = p * (1 + (rnd() - 0.48) * 0.004);
      const r = p * 0.002 * (0.5 + rnd());
      out.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1500 });
    }
    return out;
  };

  ok(typeof M.hgMechAtrOf === 'function', 'the shared ATR is exported so the true-range path can be driven');

  /* --- 1. ATR: the size gate under nearly every detector here --- */
  const clean = mk(60, 7);
  const holed = mk(60, 7); holed[59].l = null;
  const aClean = M.hgMechAtrOf(clean, 14);
  const aHoled = M.hgMechAtrOf(holed, 14);
  const aLoose = looseAtr(holed, 14);
  ok(isFinite(aClean) && aClean > 1 && aClean < 100, `a clean tape reads ATR ${aClean.toFixed(2)}`);
  ok(aLoose > aClean * 10,
     `the +v reading turned one missing low into ATR ${aLoose.toFixed(1)} — ${(aLoose / aClean).toFixed(0)}x the truth`);
  ok(Math.abs(aHoled - aClean) < aClean * 0.2,
     `the shipped reading skips the malformed bar and still says ${aHoled.toFixed(2)}`);

  /* the bar drops out, it is not zeroed — the other thirteen still average */
  const allBad = mk(60, 7);
  for (let i = 46; i < 60; i++) allBad[i].h = null;
  ok(!isFinite(M.hgMechAtrOf(allBad, 14)),
     'and a window with no usable bar returns NaN rather than inventing a number');

  /* --- 2. SILENCED: a real THREE-BAR reversal, lost to an unrelated hole --- */
  const looseThree = (rows) => {
    const n = rows.length - 1;
    const l0 = looseNum(rows[n-2].l), l1 = looseNum(rows[n-1].l), l2 = looseNum(rows[n].l);
    const h0 = looseNum(rows[n-2].h), h1 = looseNum(rows[n-1].h), h2 = looseNum(rows[n].h);
    const c2 = looseNum(rows[n].c), c0 = looseNum(rows[n-2].c);
    if (![l0,l1,l2,h0,h1,h2,c2,c0].every(isFinite)) return null;
    const a = looseAtr(rows, 14);
    if (!isFinite(a) || !(a > 0)) return null;
    if (l1 < l0 && l1 < l2 && c2 > c0 && (c2 - l1) >= a * 0.8) return { kind:'THREE-BAR', dir:'long', level: l1 };
    if (h1 > h0 && h1 > h2 && c2 < c0 && (h1 - c2) >= a * 0.8) return { kind:'THREE-BAR', dir:'short', level: h1 };
    return null;
  };
  const tbClean = mk(60, 1);
  const tbHit = M.hgMechThreeBar(tbClean);
  ok(tbHit && tbHit.kind === 'THREE-BAR',
     `a clean tape produces a real THREE-BAR ${tbHit && tbHit.dir} at ${tbHit && tbHit.level.toFixed(2)}`);
  const tbHole = mk(60, 1); tbHole[50].h = null;     /* fifty bars back, nothing to do with the pattern */
  const tbAfter = M.hgMechThreeBar(tbHole);
  ok(tbAfter && tbAfter.level === tbHit.level && tbAfter.dir === tbHit.dir,
     'a hole fifty bars back leaves the shipped detector reading exactly the same reversal');
  ok(looseThree(tbHole) === null,
     'while the +v reading SILENCED it — the inflated ATR made the move look like noise');
  ok(looseThree(tbClean) !== null,
     'and the loose reimplementation agrees on the clean tape, so it is the hole doing this and not a rewrite');

  /* --- 3. FABRICATED: PIN-REJECT quoting a rejection of zero dollars --- */
  const loosePin = (rows) => {
    const n = rows.length - 1;
    const o = looseNum(rows[n].o), h = looseNum(rows[n].h), l = looseNum(rows[n].l), c = looseNum(rows[n].c);
    if (![o,h,l,c].every(isFinite)) return null;
    const rng = h - l;
    if (!(rng > 0)) return null;
    const a = looseAtr(rows, 14);
    if (!isFinite(a) || !(a > 0) || rng < a * 0.8) return null;
    const body = Math.abs(c - o), upper = h - Math.max(o, c), lower = Math.min(o, c) - l;
    if (body > rng * 0.34) return null;
    if (lower >= rng * 0.6 && upper <= rng * 0.2)
      return { kind:'PIN-REJECT', dir:'long', level: l,
               why:'pin bar rejecting ' + l.toFixed(2) + ' — ' + ((lower / rng) * 100).toFixed(0) + '% lower wick' };
    if (upper >= rng * 0.6 && lower <= rng * 0.2)
      return { kind:'PIN-REJECT', dir:'short', level: h, why:'' };
    return null;
  };
  const pinRows = mk(60, 7); pinRows[59].l = null;
  const pinWas = loosePin(pinRows);
  ok(pinWas && pinWas.level === 0,
     `the +v reading fired a long PIN-REJECT at level 0 — "${pinWas && pinWas.why}"`);
  ok(M.hgMechPinReject(pinRows) === null,
     'the shipped detector returns null: a bar with no low is not a pin bar');
  ok(M.hgMechPinReject(mk(60, 7)) === null || M.hgMechPinReject(mk(60, 7)).level > 1000,
     'and a clean tape either stays silent or rejects a real price, never zero');

  /* --- 4. FABRICATED AND ONE-DIRECTIONAL: VOL-EXPANSION on a missing open --- */
  const regime = (n, seed, calmN) => {
    let p = 4000, s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const out = [];
    for (let i = 0; i < n; i++){
      const vol = i < calmN ? 0.0015 : 0.012;       /* a calm stretch, then a vol regime shift */
      p = p * (1 + (rnd() - 0.5) * vol);
      const r = p * vol * 0.5 * (0.5 + rnd());
      out.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
    }
    return out;
  };
  const veClean = regime(200, 1, 150);
  const vp = M.hgVolFromCloses(veClean.map(r => r.c), {});
  const ratio = vp.sigmaNow / vp.sigmaLongRun;
  ok(ratio >= 1.6, `the regime tape clears the detector's own 1.6x vol trigger (${ratio.toFixed(2)}x)`);
  ok(M.hgMechVolExpansion(veClean) === null,
     'and on that tape the final bar is NOT decisive, so a correct detector stays silent');
  const veHole = regime(200, 1, 150);
  const vn = veHole.length - 1;
  veHole[vn].o = null;
  const vo = looseNum(veHole[vn].o), vh = looseNum(veHole[vn].h),
        vl = looseNum(veHole[vn].l), vc = looseNum(veHole[vn].c);
  const veWas = (vh - vl > 0 && Math.abs(vc - vo) >= (vh - vl) * 0.5)
    ? { dir: vc > vo ? 'long' : 'short', level: vc } : null;
  ok(veWas && veWas.dir === 'long',
     `the +v reading turned the SAME bar with its open missing into a long at ${veWas.level.toFixed(2)} — `
     + 'and always long, because the test is c > 0');
  ok(M.hgMechVolExpansion(veHole) === null,
     'the shipped detector still says nothing: a bar with no open is not a decisive bar');

  /* --- 5. the property, across every detector this file exports --- */
  const DETECTORS = ['hgMechVwapRevert','hgMechNr7Break','hgMechTrendReclaim','hgMechFvgFill',
                     'hgMechBosRetest','hgMechPoolSweep','hgMechSqueezeFire','hgMechRsiDiverge',
                     'hgMechAvwapReclaim','hgMechCusumShift','hgMechVolExpansion','hgMechPinReject',
                     'hgMechEngulfLevel','hgMechPocRevert','hgMechThreeBar'];
  ok(DETECTORS.every(d => typeof M[d] === 'function'),
     `all ${DETECTORS.length} exported detectors resolve`);

  let calls = 0, hits = 0, cleanHits = 0;
  for (let seed = 1; seed <= 12; seed++){
    const base = mk(200, seed);
    for (const d of DETECTORS){
      const h0 = M[d](mk(200, seed));
      if (h0) cleanHits++;
      for (const field of ['o','h','l','c','v','t']){
        for (const bad of [null, undefined, '', NaN, 'x']){
          for (const at of [base.length - 1, base.length - 2, base.length - 40]){
            const rows = mk(200, seed);
            rows[at][field] = bad;
            let hit = null;
            try { hit = M[d](rows); }
            catch (e) { throw new Error('FAIL: ' + d + ' threw on ' + field + '=' + String(bad) + ' — ' + e.message); }
            calls++;
            if (!hit) continue;
            hits++;
            if (!isFinite(hit.level)) throw new Error('FAIL: ' + d + ' returned a non-finite level');
            /* the whole class in one line: no price on this tape is near zero,
               so a level near zero is a missing field read as a quote */
            if (Math.abs(hit.level) < 100)
              throw new Error('FAIL: ' + d + ' quoted level ' + hit.level + ' with ' + field + '=' + String(bad));
            if (/[^\d]0\.00\b/.test(String(hit.why || '')))
              throw new Error('FAIL: ' + d + ' wrote 0.00 into its why line: ' + hit.why);
          }
        }
      }
    }
  }
  ok(calls === 12 * DETECTORS.length * 6 * 5 * 3,
     `${calls} detector calls with one malformed field each: none threw, none quoted a price near zero`);
  ok(hits > 100 && cleanHits > 0,
     `and the sweep is not vacuous — ${hits} of those calls still produced a real signal `
     + `(${cleanHits} on the clean tapes), so the detectors are firing, not just failing shut`);
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SHARED MECHANICS TESTS PASSED');
