/* HARDGATE — OMNIROUTE was contradicting itself too, and the tie rule that
   fixed gold was wrong for both.

   Asked how to improve the tab. Measured first, over 300 synthetic tapes:

     29% of contracts fired both directions
     12% graded a LONG and a SHORT TICKET at the same moment
     avg 0.95 tickets per tape

   Same defect as OMNIGOLD (which was 42%), same cause: seven detectors each
   asking "is my own setup sound?" and none asking whether anything else
   disagreed. Runtime was measured too and is NOT the problem — detect is
   0.48ms/symbol, the walk-forward 5.54ms, gates 0.05ms, under 1s of CPU for a
   whole scan. The tab is network-bound, not compute-bound.

   Two ports from gold: the consensus gate, and the family-wise significance
   bar (at 6 measured mechanics the honest threshold is +2.39 sigma, not the
   +1.64 a lone test implies — at 41 samples on a 2R floor that is 50.9% hit
   rate required rather than 45.4%). Six, not seven: UTAD is measured under
   SPRING, so it is not a separate test and must not inflate the correction.

   AND A DESIGN FLAW IN THE GATE ITSELF, found here and fixed on both desks:

   A tie between TREND and REVERSION is not a contradiction. It is what those
   two families ARE — in any trending tape the continuation mechanics fire
   with the move and the fades fire against it, every single time. Vetoing
   both made the tab go quiet exactly when there was a trend to trade:

     random walk   36% of candidates vetoed by consensus
     trending      56% vetoed, 87% of them ties

   The veto rate RISING with trend strength is the gate misreading its own
   design. The structural regime already says which family belongs, so it now
   breaks the tie. Only one side can win, so no contradictory pair can return.

     after:  31-36% across all regimes, and tickets rise with trend
     gold:   ties were ~60% of every consensus veto; 1.49 -> 1.95 tickets per
             tape on a trending tape, contradictions still 0

   Run: node tests/test-omniroute-consensus.mjs */
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
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-forward.js', 'omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
function tape(n, seed, drift){
  drift = drift || 0;
  const out = []; let p = 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48 + drift) * 0.006);
    const r = p * 0.0025 * (0.5 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1500 });
  }
  return out;
}
const STATS = {};
['SPRING', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'].forEach(k => { STATS[k] = { samples: 120, hit: 0.45, expR: 0.2 }; });
const evaluate = rows => W.hgOmniEvaluate({ sym: 'X', base: 'X', exchange: 'delta' }, rows, null, { stats: STATS });

const ROWS = tape(400, 3);
const PX = ROWS[ROWS.length - 1].c;
const hit = (kind, dir) => ({ kind, dir, level: PX, why: 't' });
const con = (h, all) => W.hgOmniGates(ROWS, h, null,
  { stats: { samples: 120, hit: 0.45, expR: 0.2 }, minRr: 2, allHits: all }).filter(g => g.key === 'consensus')[0];

console.log('== the gate exists, and it is a real veto ==');
{
  const g = con(hit('ORB', 'long'), [hit('ORB', 'long'), hit('VALUE', 'short')]);
  ok(!!g, 'consensus is on the omniroute ledger');
  ok(g.info !== true, 'it is not an info gate — it can stand a trade aside');
  ok(g.hard === true, 'and it is hard when it has the scan to read');
}

console.log('\n== THE DEFECT: no contract can ticket both ways any more ==');
{
  for (const drift of [0, 0.12, 0.25]){
    let tapes = 0, contra = 0, tickets = 0;
    for (let s = 1; s <= 150; s++){
      let c = [];
      try { c = evaluate(tape(400, s, drift)); } catch (e) { continue; }
      if (!c.length) continue;
      tapes++;
      const t = c.filter(x => x.grade && x.grade.ticket);
      tickets += t.length;
      if (new Set(t.map(x => x.dir)).size > 1) contra++;
    }
    ok(contra === 0, 'drift ' + drift + ': 0 contradictory tapes of ' + tapes
      + ' (' + (tickets / tapes).toFixed(2) + ' tickets/tape)');
  }
}

console.log('\n== THE TIE FLAW: trend vs reversion is not a disagreement ==');
{
  /* One TREND family firing one way and one REVERSION family the other is
     the NORMAL shape of a trending tape, not a contradiction. */
  const all = [hit('ORB', 'long'), hit('VALUE', 'short')];
  const L = con(all[0], all), S = con(all[1], all);
  ok(L.pass !== null && S.pass !== null, 'both sides get a definite read');
  ok(!(L.pass === true && S.pass === true), 'they are never BOTH passed');
  ok(L.pass === true || S.pass === true || /no regime read/.test(L.why),
     'and one side wins unless there is no regime to break it (' + L.why + ')');
  if (L.pass === true || S.pass === true){
    ok(/broken by the .* regime/.test(L.why + S.why), 'the winner says the regime broke the tie');
    ok(/favours the other side/.test(L.why + S.why), 'and the loser says which side it favoured');
  }
}

console.log('\n== the veto rate must not RISE with trend strength ==');
{
  /* The symptom that exposed the flaw: a gate that gets stricter the more
     tradeable the tape becomes is misreading its own design. */
  const rate = drift => {
    let vetoed = 0, total = 0;
    for (let s = 1; s <= 150; s++){
      let c = [];
      try { c = evaluate(tape(400, s, drift)); } catch (e) { continue; }
      for (const x of c){
        total++;
        const g = x.gates.filter(y => y.key === 'consensus')[0];
        if (g && g.pass === false) vetoed++;
      }
    }
    return total ? vetoed / total : 0;
  };
  const flat = rate(0), trend = rate(0.25);
  ok(trend <= flat + 0.05, 'a trending tape is not vetoed MORE than a random walk ('
    + (flat * 100).toFixed(0) + '% flat vs ' + (trend * 100).toFixed(0) + '% trending)');
  ok(flat < 0.6, 'and the gate is not simply vetoing everything (' + (flat * 100).toFixed(0) + '%)');
}

console.log('\n== a split family votes for neither side ==');
{
  /* SPRING and UTAD are one idea seen from either side of a range. */
  const all = [hit('SPRING', 'long'), hit('UTAD', 'short'), hit('ORB', 'long')];
  const g = con(all[0], all);
  ok(/SWEEP is split and counted for neither/.test(g.why), 'SWEEP is reported as split (' + g.why + ')');
  ok(!/agree \(.*SWEEP.*\).*against \(.*SWEEP/.test(g.why), 'and never appears on both sides at once');
  ok(g.pass === true, 'leaving TREND to carry the vote unopposed');
}

console.log('\n== every family split still vetoes BOTH ==');
{
  const all = [hit('SPRING', 'long'), hit('UTAD', 'short'), hit('ORB', 'long'), hit('MMOVE', 'short')];
  const L = con(all[0], all), S = con(all[1], all);
  ok(L.pass === false && S.pass === false, 'no side has a single undivided family, so neither trades');
  ok(/no directional opinion at all/.test(L.why), 'and the card says so (' + L.why + ')');
}

console.log('\n== with no scan supplied the gate goes soft ==');
{
  const g = W.hgOmniGates(ROWS, hit('ORB', 'long'), null,
    { stats: { samples: 120, hit: 0.45, expR: 0.2 }, minRr: 2 }).filter(x => x.key === 'consensus')[0];
  ok(g.hard === false, 'soft, not hard');
  ok(g.pass === null, 'and UNCHECKED rather than inventing agreement');
  /* hard + UNCHECKED is WATCH, which would kill every ticket from any caller
     that cannot supply the other hits. */
  ok(W.hgOmniGrade([{ key: 'consensus', hard: false, pass: null, why: 'x' }]).ticket === true,
     'so a caller without the scan is not silently blocked');
}

console.log('\n== degenerate scans never throw ==');
{
  for (const bad of [null, undefined, [], [null], [{}], [{ kind: 'ORB' }], 'nonsense', 42]){
    let threw = null, g = null;
    try { g = con(hit('ORB', 'long'), bad); } catch (e) { threw = e; }
    ok(!threw, 'allHits=' + JSON.stringify(bad) + ' does not throw');
    ok(g && typeof g.why === 'string' && g.why.length > 0, 'and still states a reason');
    ok(!/NaN|undefined|null/.test(g.why), 'with nothing broken on the card');
  }
}

console.log('\n== THE SIGNIFICANCE BAR: six mechanics, not one ==');
{
  const edge = (stats, fwd) => W.hgOmniGates(ROWS, hit('ORB', 'long'), null,
    { stats, fwd, minRr: 2 }).filter(g => g.key === 'measured-edge')[0];

  const thin = edge({ samples: 41, hit: 0.46, expR: 0.1 }, null);
  ok(thin.pass !== true, 'a read that clears only the single-test bar no longer PASSES');
  ok(thin.pass === null, 'it reads UNCHECKED — not demonstrated, not disproved');
  ok(/mechanics scanned/.test(thin.why), 'and the card explains why (' + thin.why.slice(-64) + ')');
  ok(/\+2\.\d\dσ is the bar/.test(thin.why), 'quoting the bar it had to clear');

  const strong = edge({ samples: 400, hit: 0.48, expR: 0.4 }, null);
  ok(strong.pass === true, 'a genuinely strong in-sample read still passes');
  ok(/clears the \d+-mechanic significance bar/.test(strong.why), 'and says it cleared it');

  /* Out-of-sample precedence is untouched. */
  const good = edge({ samples: 41, hit: 0.46, expR: 0.1 }, { samples: 25, hit: 0.60, open: 0, expR: 0.6 });
  ok(good.pass === true, 'a settled forward record still passes on its own merit');
  const bad = edge({ samples: 41, hit: 0.46, expR: 0.1 }, { samples: 25, hit: 0, open: 0, expR: -1 });
  ok(bad.pass === false, 'and a bad one still vetoes');
  const dead = edge({ samples: 400, hit: 0.20, expR: -0.5 }, null);
  ok(dead.pass === false, 'a significantly-below-breakeven pool still VETOES rather than going unchecked');
}

console.log('\n== the bar is keyed to the real mechanic count ==');
{
  ok(/var OMNI_MECHANICS = /.test(SRC), 'there is one mechanic list');
  ok(/var keys = OMNI_MECHANICS\.slice\(\)/.test(SRC), 'the pooled table renders from it');
  ok(/hgOmniFamilyZ\(OMNI_MECHANICS\.length\)/.test(SRC), 'and the bar is computed from it');
  const listSrc = SRC.slice(SRC.indexOf('var OMNI_MECHANICS'), SRC.indexOf('var OMNI_FAMILY'));
  const count = (listSrc.match(/'[A-Z0-9-]+'/g) || []).length;
  ok(count === 6, 'six measured mechanics — UTAD is measured under SPRING, so it is not a separate test (' + count + ')');

  const g = W.hgOmniGates(ROWS, hit('ORB', 'long'), null,
    { stats: { samples: 41, hit: 0.46, expR: 0.1 }, minRr: 2 }).filter(x => x.key === 'measured-edge')[0];
  const m = /\+(\d\.\d\d)σ is the bar/.exec(g.why);
  ok(!!m, 'the bar is stated numerically');
  ok(parseFloat(m[1]) > 1.64, 'and is stricter than a single test (' + m[1] + 'σ)');
  ok(parseFloat(m[1]) < 2.97, 'while below the 34-mechanic gold bar — fewer tries, lower bar (' + m[1] + 'σ)');
}

console.log('\n== every mechanic the desk detects has a family ==');
{
  const kinds = Array.from(new Set((SRC.match(/kind:'([A-Z0-9-]+)'/g) || [])
    .map(m => /kind:'([A-Z0-9-]+)'/.exec(m)[1])));
  const famSrc = SRC.slice(SRC.indexOf('var OMNI_FAMILY'), SRC.indexOf('function hgOmniFamilyOf'));
  const unmapped = kinds.filter(k => famSrc.indexOf("'" + k + "'") < 0);
  ok(kinds.length >= 7, 'read the detector kinds (' + kinds.length + ')');
  ok(unmapped.length === 0, 'all mapped to a family'
    + (unmapped.length ? ' — missing: ' + unmapped.join(', ') : ''));
}

console.log('\n== the ranker uses consensus, and crypto candidates now carry it ==');
{
  const c = evaluate(tape(400, 3));
  ok(c.length > 0, 'the tape produced candidates (' + c.length + ')');
  ok(c.every(x => 'consensus' in x), 'every candidate carries its consensus');
  ok(c.every(x => 'family' in x), 'and its family');
  const ranked = W.hgOmniRank(c);
  ok(Array.isArray(ranked) && ranked.length === c.length, 'the ranker still returns them all');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE CONSENSUS TESTS PASSED');
