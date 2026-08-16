/* HARDGATE — a formed ticket's R:R must match the levels it ships with.

   hgFormTicket starts with `plan = Object.assign({}, hit)`, so the plan
   arrives carrying the hit's rr, rr1 and rr2. It then moves the entry to the
   ranked POI and moves the stop again (sweep stop, structure stop, ledger
   stopScale) — but replaces the targets and ratios only inside `if (tg)`.
   When hgStructureTargets returns nothing, the ticket ships a NEW entry and a
   NEW stop with the ORIGINAL targets and ratios.

   The gold path had three variants of the same hole: the entryMoved branch
   left everything behind when targets were absent; the else branch recomputed
   rr but not rr1 or rr2, though hgStructureStop routinely widens the stop
   there; and the goldScalpLevels branch set rr/rr2 from lv0 just before the
   stop could change again beneath them.

   A stale rr1 is not only a display fault. blValidPlan and gbValidPlan both
   PREFERRED plan.rr1 over deriving one, so the minimum-R:R floor could be
   cleared by a ratio measured against levels the plan no longer had — the
   gate testing a stored number instead of the trade.

   Run: node tests/test-formation-rr-invariant.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js', 'best-levels.js', 'formation.js', 'gold-best-levels.js']){
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const W = ctx;

function rows(n, start, step){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step + Math.sin(i / 7) * step * 2;
    out.push({ t: 1700000000 + i * 14400, o: c, h: c + step * 3, l: c - step * 3, c: c, v: 1000 + i });
  }
  return out;
}

/* The one thing every formed ticket must satisfy. */
function checkInvariant(plan, label){
  const entry = plan.entry, stop = plan.stop;
  const risk = (typeof entry === 'number' && typeof stop === 'number') ? Math.abs(entry - stop) : NaN;
  for (const [tk, rk] of [['t1', 'rr1'], ['t2', 'rr2']]){
    const t = plan[tk], r = plan[rk];
    if (r === null || r === undefined) continue;
    ok(isFinite(risk) && risk > 0, label + ': ' + rk + ' only exists with a real risk distance');
    ok(typeof t === 'number' && isFinite(t), label + ': ' + rk + ' only exists with a real ' + tk);
    ok(near(r, Math.abs(t - entry) / risk), label + ': ' + rk + ' equals |' + tk + ' - entry| / risk');
  }
  if (plan.rr !== null && plan.rr !== undefined && plan.rr1 !== null && plan.rr1 !== undefined){
    ok(near(plan.rr, plan.rr1), label + ': rr and rr1 agree');
  }
}

console.log('== the pipeline is loadable and exports what we test ==');
{
  ok(typeof W.hgFormTicket === 'function', 'hgFormTicket exported');
  ok(typeof W.blValidPlan === 'function' || /function blValidPlan/.test(fs.readFileSync(path.join(ROOT, 'best-levels.js'), 'utf8')),
    'blValidPlan present');
}

console.log('\n== formed crypto tickets satisfy the invariant ==');
{
  const r = rows(220, 100, 0.35);
  const mark = r[r.length - 1].c;
  let formed = 0;
  for (const dir of ['long', 'short']){
    for (const style of ['swing', 'scalp']){
      const res = W.hgFormTicket(
        { dir: dir, sym: 'ETHUSDT', entry: mark, stop: dir === 'long' ? mark - 2 : mark + 2,
          t1: dir === 'long' ? mark + 9 : mark - 9, t2: dir === 'long' ? mark + 15 : mark - 15,
          rr: 99, rr1: 99, rr2: 99, mark: mark },
        { rows: r, style: style }
      );
      if (res && res.ok && res.hit){
        checkInvariant(res.hit, style + '/' + dir);
        ok(res.hit.rr1 !== 99 && res.hit.rr2 !== 99, style + '/' + dir + ': no incoming 99R survived');
        formed++;
      }
    }
  }
  ok(formed > 0, 'at least one ticket actually formed (' + formed + ') — not a vacuous pass');
}

console.log('\n== formed gold tickets satisfy the invariant ==');
{
  const r = rows(260, 3300, 1.2);
  const mark = r[r.length - 1].c;
  let formed = 0;
  for (const dir of ['long', 'short']){
    for (const style of ['gold-swing', 'gold-scalp']){
      const res = W.hgFormTicket(
        { dir: dir, sym: 'XAUUSDT', entry: mark, stop: dir === 'long' ? mark - 8 : mark + 8,
          t1: dir === 'long' ? mark + 40 : mark - 40, t2: dir === 'long' ? mark + 70 : mark - 70,
          rr: 99, rr1: 99, rr2: 99, mark: mark, stratKey: 'ob' },
        { rows: r, rows4h: r, style: style, goldMinRr: 1.2 }
      );
      if (res && res.ok && res.hit){
        checkInvariant(res.hit, style + '/' + dir);
        ok(res.hit.rr1 !== 99, style + '/' + dir + ': no incoming 99R survived');
        formed++;
      }
    }
  }
  ok(formed > 0, 'at least one gold ticket actually formed (' + formed + ')');
}

console.log('\n== reproduction: a widened stop used to leave both ratios behind ==');
{
  /* The gold else-branch (entry NOT moved) recomputed rr but never rr1 or
     rr2, while hgStructureStop widens the stop right above it. Rebuild the
     pre-fix shape from the shipped source and run the two side by side. */
  const form = fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8');
  const g0 = form.indexOf('  plan.rr = isFinite(plan.t1) ? Math.abs(plan.t1 - plan.entry) / risk : null;');
  const g1 = form.indexOf('  var gRr =', g0);
  ok(g0 > 0 && g1 > g0, 'the gold derivation block is where the reproduction expects it');
  const preFix = form.slice(0, g0) + form.slice(g1);

  const old = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  old.window = old; old.globalThis = old;
  old.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(old);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'best-levels.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), old, { filename: f });
  }
  vm.runInContext(preFix, old, { filename: 'formation.prefix.js' });

  const r = rows(260, 3300, 1.1);
  const mark = r[r.length - 1].c;
  const hit = () => ({ dir: 'long', sym: 'XAUUSDT', entry: mark, stop: mark - 8,
                       t1: mark + 40, t2: mark + 70, rr: 5, rr1: 5, rr2: 9,
                       mark: mark, stratKey: 'ob' });
  const cfg = { rows: r, rows4h: r, style: 'gold-swing', goldMinRr: 1.2 };

  const before = old.hgFormTicket(hit(), cfg);
  const after = W.hgFormTicket(hit(), cfg);
  ok(before && before.ok && after && after.ok, 'both builds formed the ticket');

  const bp = before.hit, ap = after.hit;
  ok(bp.stop !== hit().stop, 'the structure stop really did widen the stop under both');
  const trueRr1 = Math.abs(bp.t1 - bp.entry) / Math.abs(bp.entry - bp.stop);
  const trueRr2 = Math.abs(bp.t2 - bp.entry) / Math.abs(bp.entry - bp.stop);

  ok(bp.rr1 === 5 && bp.rr2 === 9, 'pre-fix: the incoming 5R / 9R survived the widened stop');
  ok(!near(bp.rr1, trueRr1), 'pre-fix: shipped rr1 ' + bp.rr1 + ' did not match its own levels (' + trueRr1.toFixed(2) + ')');
  ok(near(ap.rr1, trueRr1) && near(ap.rr2, trueRr2),
    'post-fix: shipped ' + ap.rr1.toFixed(2) + 'R / ' + ap.rr2.toFixed(2) + 'R match the levels exactly');
  ok(ap.rr1 < bp.rr1, 'post-fix reports the SMALLER, true R:R (' + ap.rr1.toFixed(2) + ' vs ' + bp.rr1 + ') - the overstatement is gone');
}


console.log('\n== the min-R:R gates derive rather than trust a stored ratio ==');
{
  const bl = fs.readFileSync(path.join(ROOT, 'best-levels.js'), 'utf8');
  const gb = fs.readFileSync(path.join(ROOT, 'gold-best-levels.js'), 'utf8');
  ok(!/var rr = fin\(\+plan\.rr1\) \? \+plan\.rr1/.test(bl), 'blValidPlan no longer prefers plan.rr1');
  ok(!/var rr = fin\(\+plan\.rr1\) \? \+plan\.rr1/.test(gb), 'gbValidPlan no longer prefers plan.rr1');

  /* A plan whose stored rr1 claims 9R while its levels are worth 1R must be
     rejected by a 2R floor, not admitted on the strength of the label. */
  /* Both predicates are exported so this is a behavioural check, not a regex
     one. A source assertion would have passed while the gate stayed broken. */
  ok(typeof W.blValidPlan === 'function', 'blValidPlan is exported and callable');
  ok(typeof W.gbValidPlan === 'function', 'gbValidPlan is exported and callable');
  const liar = { entry: 100, stop: 98, t1: 102, rr1: 9, rr2: 9 };
  ok(W.blValidPlan(liar, 'swing') === false, 'crypto: a 1R plan claiming 9R is rejected by the swing floor');
  ok(W.gbValidPlan(liar, 2) === false, 'gold: the same plan is rejected by a 2R floor');
  ok(W.gbValidPlan({ entry: 100, stop: 98, t1: 106 }, 2) === true, 'gold: a genuine 3R plan still passes');
  ok(W.blValidPlan({ entry: 100, stop: 98, t1: 106 }, 'swing') === true, 'crypto: a genuine 3R plan still passes');
}

console.log('\n== a null level cannot be read as price zero by the gates ==');
{
  const gb = fs.readFileSync(path.join(ROOT, 'gold-best-levels.js'), 'utf8');
  const bl = fs.readFileSync(path.join(ROOT, 'best-levels.js'), 'utf8');
  ok(/gbNum\(plan\.entry\)/.test(gb), 'gbValidPlan converts through the strict reader');
  ok(/plan\.entry === null \|\| plan\.entry === undefined/.test(bl), 'blValidPlan rejects empty entry before coercing');
  ok(W.gbValidPlan({ entry: 100, stop: null, t1: 106 }, 2) === false, 'gold: a null stop is not price zero');
  ok(W.blValidPlan({ entry: null, stop: 98, t1: 106 }, 'swing') === false, 'crypto: a null entry is not price zero');
}

console.log('\n== the derivation is unconditional in both formation branches ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8');
  ok(/plan\.rr1 = plan\.rr;/.test(src), 'rr1 is kept in step with rr');
  const goldAt = src.indexOf('function hgFormGoldEnrich');
  const goldBlock = src.slice(goldAt, src.indexOf('function hgFormTicket'));
  ok(/plan\.rr2 = isFinite\(plan\.t2\) \? Math\.abs\(plan\.t2 - plan\.entry\) \/ risk : null;/.test(goldBlock),
    'gold branch derives rr2 from the final levels outside every guard');
  const cryptoBlock = src.slice(src.indexOf('function hgFormTicket'));
  ok(/var fRisk = /.test(cryptoBlock), 'crypto branch derives from the final levels');
  ok(/plan\.rr = null; plan\.rr1 = null; plan\.rr2 = null;/.test(cryptoBlock),
    'crypto branch clears rather than inherits when risk is unusable');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FORMATION R:R INVARIANT TESTS PASSED');
