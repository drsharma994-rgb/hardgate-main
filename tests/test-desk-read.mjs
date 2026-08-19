/* HARDGATE — the desk could name the blocking gate but not the market
   condition behind it.

   "Why does it show the wrong setups?" was asked four times, and each time
   the answer was recoverable only by reading every gate on every card and
   tallying by hand. The status line named the top blocking GATE — a category,
   not an explanation. The live day this was built from: gold +2.9% in 24
   bars, STRONG TREND up. With-trend entries had no placeable stop — the
   rally never paused long enough to print a pivot, so the nearest structure
   sat 6.8xATR away even at a 6-bar lookback — while every setup WITH
   placeable structure was a counter-trend fade, vetoed by policy. Six
   coherent cards, zero tickets, and no sentence anywhere saying that.

   hgOgDeskRead derives one sentence from the cards already graded — no
   refetch, no recompute — translating the two most common vetoes into the
   market condition they imply, with the 24-bar move for context.

   A HYPOTHESIS TESTED AND DROPPED FIRST: anchoring scalp stops to a shorter
   swing lookback. On the live tape look=6 still put the nearest pivot low at
   6.83xATR — the rally printed no nearby structure at ANY lookback — so a
   per-horizon lookback would have changed nothing and was not shipped.

   Run: node tests/test-desk-read.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

const card = (vetoes) => ({ grade: { ticket: vetoes.length === 0, vetoes: vetoes } });
function rowsWithMove(pct){
  const out = []; let p = 4300;
  for (let i = 0; i < 30; i++){
    p = p * (1 + pct / 100 / 25);
    out.push({ t: 1700000000 + i*3600, o: p, h: p+1, l: p-1, c: p, v: 1000 });
  }
  return out;
}

console.log('== the live condition produces the sentence that was missing ==');
{
  const ranked = [card(['plan-levels']), card(['plan-levels', 'adr-budget']),
                  card(['fade-strength']), card(['plan-levels'])];
  const t = W.hgOgDeskRead(ranked, rowsWithMove(2.9));
  ok(/^DESK READ: /.test(t), 'it leads with its name');
  /* The fixture compounds per bar, so assert the shape rather than a digit
     the fixture happens to land on. */
  ok(/gold has moved \+\d\.\d% in 24 bars/.test(t), 'quoting the move: ' + t.slice(11, 50));
  ok(/no nearby structure to stop against/.test(t), 'and translates plan-levels into the condition');
  ok(/with-trend entries cannot place a stop/.test(t), 'in words about the market, not gate names');
  ok(/Standing aside IS the read/.test(t), 'and says that quiet is the answer, not a failure');
  ok(/consolidation that prints new structure/.test(t), 'with what would change it');
}

console.log('\n== the two most common vetoes drive it, in order ==');
{
  const ranked = [card(['fade-strength']), card(['fade-strength']), card(['fade-strength']),
                  card(['consensus'])];
  const t = W.hgOgDeskRead(ranked, rowsWithMove(1.5));
  ok(/fade a strong trend/.test(t), 'the dominant veto leads');
  ok(/point both ways|two-sided/.test(t), 'the runner-up follows');
  ok(t.indexOf('fade') < t.indexOf('two-sided'), 'in frequency order');
  const single = W.hgOgDeskRead([card(['news-window'])], rowsWithMove(0.1));
  ok(/news blackout is standing the whole desk aside/.test(single), 'a single veto reads alone');
}

console.log('\n== a desk WITH tickets, or nothing to explain, says nothing ==');
{
  ok(W.hgOgDeskRead([card([])], rowsWithMove(1)) === '', 'all-clear cards produce no read');
  ok(W.hgOgDeskRead([], rowsWithMove(1)) === '', 'no cards produce no read');
  ok(W.hgOgDeskRead(null, rowsWithMove(1)) === '', 'null produces no read');
  /* An unknown gate key must not produce a half-sentence. */
  ok(W.hgOgDeskRead([card(['some-future-gate'])], rowsWithMove(1)) === '',
     'a veto with no plain-language mapping stays silent rather than mumbling');
}

console.log('\n== degenerate rows never break it ==');
{
  const ranked = [card(['plan-levels'])];
  for (const rows of [null, [], [{}], [{ c: null }], rowsWithMove(0)]){
    let threw = null, t = null;
    try { t = W.hgOgDeskRead(ranked, rows); } catch (e){ threw = e; }
    ok(!threw, 'rows=' + (rows ? rows.length : 'null') + ' does not throw');
    ok(typeof t === 'string' && !/NaN|undefined/.test(t), '   and never prints NaN');
  }
  /* fin(), not num(): a null close is missing, not price zero. */
  const t = W.hgOgDeskRead(ranked, [{ c: null }, { c: null }]);
  ok(!/%/.test(t) || /the tape/.test(t), 'with no usable closes it says "the tape" instead of a fake move');
}

console.log('\n== it is wired into the no-tickets status line, and only there ==');
{
  ok(/var deskRead = hgOgDeskRead\(ranked,/.test(GOLD), 'the scan computes it');
  ok(GOLD.indexOf('var deskRead = hgOgDeskRead') > GOLD.indexOf("NO TICKETS: ' + top"),
     'inside the no-tickets branch — a desk with tickets needs no apology');
  ok(/if \(deskRead\) __og\.lastStat \+= /.test(GOLD), 'and appends only when there is something to say');
  ok(/window\.hgOgDeskRead = hgOgDeskRead;/.test(GOLD), 'exported so this test exists');
  ok(/no refetch, no recompute/i.test(GOLD) || /cards already\s+graded/.test(GOLD),
     'and documents that it reads the graded cards, costing nothing');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL DESK READ TESTS PASSED');
