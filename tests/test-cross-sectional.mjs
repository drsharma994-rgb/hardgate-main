/* HARDGATE — the one read a 530-contract sweep can make and a single-symbol
   tab structurally cannot.

   Asked for more indicators and strategies a fifth time. The live pool is the
   argument against another price pattern: twenty-two mechanics, roughly four
   thousand in-sample firings, and not one clears breakeven —

     SPRING -0.17R (-2.14σ)   MMOVE -0.20R (-2.96σ)
     VWAP-REVERT -0.27R (-3.59σ)   PIN-REJECT -0.19R (-2.31σ)

   — with the remainder sitting in noise. A twenty-third candle formation is
   measurably not the missing piece.

   What was missing is that every mechanic judged a contract ALONE, which is
   the same question a single-symbol tab asks. The sweep already fetched 530
   contracts and threw away everything that did not fire. Keeping four numbers
   per symbol costs no network and makes the universe readable: where does
   this contract rank, and which way is everything else going?

   XS-LEADER, XS-LAGGARD, xs-rank and breadth are the result. They are
   FORWARD-ONLY for the same reason the positioning mechanics are — the
   walk-forward replays one symbol's candles, and a past bar's cross-section
   cannot be reconstructed from them. They earn an out-of-sample record and
   the pooled table says so.

   Run: node tests/test-cross-sectional.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

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
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'hg-gates.js', 'omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
function tape(n, seed, drift){
  const out = []; let p = 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48 + (drift || 0)) * 0.006);
    const r = p * 0.0025 * (0.5 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1500 });
  }
  return out;
}
/* A universe with a genuine spread of strength, weakest to strongest. */
function universe(n){
  const u = [];
  for (let k = 0; k < n; k++) u.push({ sym: 'SYM' + k, rows: tape(200, k + 1, (k - n / 2) / 300) });
  return u;
}

console.log('== the summary is four numbers from bars already in hand ==');
{
  ok(typeof W.hgOmniXsSummary === 'function', 'hgOmniXsSummary is exported');
  const s = W.hgOmniXsSummary('BTC', tape(200, 3));
  ok(s && s.sym === 'BTC', 'it names the contract');
  ok(isFinite(s.ret20) && isFinite(s.ret60), 'and carries 20- and 60-bar returns');
  ok(isFinite(s.last) && s.last > 0, 'and the last price');
  /* No network, no state: same rows twice must give the same summary. */
  const rows = tape(200, 3);
  ok(JSON.stringify(W.hgOmniXsSummary('BTC', rows)) === JSON.stringify(W.hgOmniXsSummary('BTC', rows)),
     'it is pure — the same bars give the same answer');
  for (const bad of [null, undefined, [], tape(5, 1)]){
    ok(W.hgOmniXsSummary('X', bad) === null, 'too little history returns null rather than a guess');
  }
  ok(W.hgOmniXsSummary(null, tape(200, 3)) === null, 'and an unnamed contract cannot be ranked');
}

console.log('\n== a percentile of a handful is not a percentile ==');
{
  const u = universe(60);
  const sums = u.map(x => W.hgOmniXsSummary(x.sym, x.rows)).filter(Boolean);
  ok(sums.length === 60, 'sixty summaries built');
  ok(W.hgOmniXsRanks(sums.slice(0, 20)) === null, 'a 20-name sweep refuses to rank');
  ok(W.hgOmniXsRanks(sums.slice(0, 29)) === null, 'and so does 29 — the floor is 30');
  const xs = W.hgOmniXsRanks(sums);
  ok(!!xs, 'sixty names ranks');
  ok(xs.n === 60, 'reporting how many it ranked (' + xs.n + ')');
  ok(isFinite(xs.breadthUp) && xs.breadthUp >= 0 && xs.breadthUp <= 1,
     'with breadth as a fraction (' + (xs.breadthUp * 100).toFixed(0) + '% up)');

  /* The ranking must actually order by strength, not by insertion. */
  const bySym = {};
  sums.forEach(s => { bySym[s.sym] = s.ret20; });
  const syms = Object.keys(xs.rank);
  let inverted = 0;
  for (const a of syms) for (const b of syms){
    if (bySym[a] > bySym[b] && xs.rank[a] < xs.rank[b]) inverted++;
  }
  ok(inverted === 0, 'every stronger contract ranks above every weaker one');
  const strongest = sums.slice().sort((p, q) => q.ret20 - p.ret20)[0];
  const weakest = sums.slice().sort((p, q) => p.ret20 - q.ret20)[0];
  ok(xs.rank[strongest.sym] === 1, 'the strongest is at the 100th percentile');
  ok(xs.rank[weakest.sym] === 0, 'and the weakest at the 0th');

  for (const bad of [null, undefined, [], [null], [{}]]){
    let threw = null;
    try { W.hgOmniXsRanks(bad); } catch (e) { threw = e; }
    ok(!threw, 'ranking ' + JSON.stringify(bad) + ' does not throw');
  }
}

console.log('\n== XS-LEADER and XS-LAGGARD fire only at the extremes ==');
{
  const u = universe(60);
  const xs = W.hgOmniXsRanks(u.map(x => W.hgOmniXsSummary(x.sym, x.rows)).filter(Boolean));
  let lead = 0, lag = 0, mid = 0;
  for (const x of u){
    const d = W.hgOmniXsLeader(x.rows, xs, x.sym);
    if (!d) { mid++; continue; }
    if (d.kind === 'XS-LEADER'){ lead++; ok(d.dir === 'long', 'a leader is long'); }
    if (d.kind === 'XS-LAGGARD'){ lag++; ok(d.dir === 'short', 'a laggard is short'); }
  }
  ok(lead > 0 && lead <= 12, 'leaders fired on the top decile only (' + lead + ' of 60)');
  ok(lag > 0 && lag <= 12, 'laggards fired on the bottom decile only (' + lag + ' of 60)');
  ok(mid >= 36, 'and the middle of the universe fired nothing (' + mid + ')');

  const strongest = u.slice().sort((a, b) =>
    W.hgOmniXsSummary(b.sym, b.rows).ret20 - W.hgOmniXsSummary(a.sym, a.rows).ret20)[0];
  const d = W.hgOmniXsLeader(strongest.rows, xs, strongest.sym);
  ok(!!d && d.kind === 'XS-LEADER', 'the strongest contract is a leader');
  ok(/percentile of 60 contracts/.test(d.why), 'and the card states its rank (' + d.why + ')');
  ok(!/top 0%/.test(d.why), 'never "top 0%", which reads as none of them');

  /* Without the universe it cannot fire at all — that is the whole point. */
  ok(W.hgOmniXsLeader(strongest.rows, null, strongest.sym) === null, 'no universe, no cross-sectional read');
  ok(W.hgOmniXsLeader(strongest.rows, xs, 'NOT-IN-UNIVERSE') === null, 'an unranked contract does not fire');
}

console.log('\n== rank alone is not enough: it must still be going that way ==');
{
  /* Buying whatever has run furthest is not the effect; the EMA check is
     what stops this being a pure chase. */
  ok(/last > e21/.test(SRC), 'a leader must still be above its 21-EMA');
  ok(/last < e21/.test(SRC), 'and a laggard below it');
  const u = universe(60);
  const xs = W.hgOmniXsRanks(u.map(x => W.hgOmniXsSummary(x.sym, x.rows)).filter(Boolean));
  const strongest = u.slice().sort((a, b) =>
    W.hgOmniXsSummary(b.sym, b.rows).ret20 - W.hgOmniXsSummary(a.sym, a.rows).ret20)[0];
  /* Break the trend on the strongest name: same rank, no longer trending. */
  const rolled = strongest.rows.slice();
  const px = rolled[rolled.length - 1].c;
  for (let k = rolled.length - 6; k < rolled.length; k++){
    rolled[k] = { ...rolled[k], c: px * 0.80, h: px * 0.81, l: px * 0.79, o: px * 0.805 };
  }
  ok(W.hgOmniXsLeader(rolled, xs, strongest.sym) === null,
     'the top-ranked contract stops being a leader once it loses its 21-EMA');
}

console.log('\n== the two universe gates ==');
{
  const u = universe(60);
  const xs = W.hgOmniXsRanks(u.map(x => W.hgOmniXsSummary(x.sym, x.rows)).filter(Boolean));
  const strongest = u.slice().sort((a, b) =>
    W.hgOmniXsSummary(b.sym, b.rows).ret20 - W.hgOmniXsSummary(a.sym, a.rows).ret20)[0];
  const gate = (dir, extra) => W.hgOmniGates(strongest.rows, { kind: 'ORB', dir, level: 60000, why: 't' }, null,
    Object.assign({ stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, xs, sym: strongest.sym }, extra || {}));

  const shortG = gate('short').filter(g => g.key === 'xs-rank')[0];
  ok(!!shortG, 'xs-rank is on the ledger');
  ok(shortG.info === true, 'as an INFO gate — it argues, it does not veto');
  ok(shortG.pass === false, 'and selling the strongest of the universe is flagged');
  ok(/selling the strongest/.test(shortG.why), 'in those words (' + shortG.why + ')');
  ok(gate('long').filter(g => g.key === 'xs-rank')[0].pass === true, 'while buying it is fine');

  const br = gate('long').filter(g => g.key === 'breadth')[0];
  ok(!!br, 'breadth is on the ledger');
  ok(br.info === true, 'also info');
  ok(/% of 60 contracts are up over 20 bars/.test(br.why), 'stating the breadth (' + br.why + ')');

  /* A sweep too small to rank must read UNCHECKED, not invent a percentile. */
  const noXs = W.hgOmniGates(strongest.rows, { kind: 'ORB', dir: 'long', level: 60000, why: 't' }, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2 });
  for (const k of ['xs-rank', 'breadth']){
    const g = noXs.filter(x => x.key === k)[0];
    ok(g.pass === null, k + ' reads UNCHECKED without a universe');
    ok(/too small|unavailable/.test(g.why), 'and says why (' + g.why + ')');
  }
  const grade = W.hgOmniGrade(gate('short'));
  ok(grade.vetoes.indexOf('xs-rank') === -1 && grade.vetoes.indexOf('breadth') === -1,
     'neither universe gate can veto');
}

console.log('\n== registered as forward-only, and honest about it ==');
{
  ok(/'XS-LEADER','XS-LAGGARD'/.test(SRC), 'both are declared forward-only');
  const bt = W.hgOmniBacktestAll(tape(400, 3), { rMult: 2, horizon: 20, warm: 45 });
  ok(!('XS-LEADER' in bt) && !('XS-LAGGARD' in bt),
     'and correctly absent from the walk-forward — a past cross-section cannot be replayed');
  const famSrc = SRC.slice(SRC.indexOf('var OMNI_FAMILY'), SRC.indexOf('function hgOmniFamilyOf'));
  ok(/'XS-LEADER':'CROSS-SECTIONAL'/.test(famSrc), 'XS-LEADER is its own family');
  ok(/'XS-LAGGARD':'CROSS-SECTIONAL'/.test(famSrc), 'and so is XS-LAGGARD');
  /* They read the universe, which no price mechanic does, so they must not be
     merged into an existing family. */
  ok(!/'XS-LEADER':'TREND'/.test(famSrc), 'not folded into TREND, which reads only this symbol');
  /* And they count toward the significance bar like every other search. */
  const g = W.hgOmniGates(tape(400, 3), { kind: 'ORB', dir: 'long', level: 60000, why: 't' }, null,
    { stats: { samples: 41, hit: 0.46, expR: 0.1 }, minRr: 2 }).filter(x => x.key === 'measured-edge')[0];
  const m = /\+(\d\.\d\d)σ is the bar/.exec(g.why);
  ok(!!m, 'the significance bar is on the card');
  ok(/\b27 mechanics scanned/.test(g.why), 'counting all 27 including the un-replayable ones (' + m[1] + 'σ)');
}

console.log('\n== the sweep collects the universe without extra network ==');
{
  ok(/var xsSum = hgOmniXsSummary\(item\.sym, rows\);/.test(SRC),
     'pass 1 summarises every contract, fired or not');
  ok(/xsAll\.push\(xsSum\)/.test(SRC), 'accumulating them');
  ok(/xsRanks = hgOmniXsRanks\(xsAll\)/.test(SRC), 'and ranks once pass 1 has seen everything');
  ok(/xs: xsRanks,/.test(SRC), 'the ranks reach pass 2');
  ok(SRC.indexOf('var xsSum = hgOmniXsSummary') < SRC.indexOf('xsRanks = hgOmniXsRanks'),
     'and the ranks are computed AFTER the sweep, never during it');
  /* No fetch was added: the summary is built from rows pass 1 already had. */
  /* Boundary by a marker that exists: the enrichment slice was renamed when
     the cap became merit-ordered, and indexOf returning -1 quietly turned
     this into a scan of almost the whole file. */
  const endMark = 'WHICH 120 GET THE FULL LEDGER';
  ok(SRC.indexOf(endMark) > 0, 'the end-of-pass-1 marker exists');
  const passOne = SRC.slice(SRC.indexOf('PASS 1: detect over EVERY contract'), SRC.indexOf(endMark));
  ok(!/xuCandles\(|binance\w+\(/.test(passOne.replace(/W\.xuCandles\(item, TF, BARS\)/, '')),
     'pass 1 gained no new network call');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL CROSS-SECTIONAL TESTS PASSED');
