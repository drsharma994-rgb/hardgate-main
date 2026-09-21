/* HARDGATE — a locked conviction is the card most likely to be stale, and it
   was the one card that could not say so.

   gsxGeoLine puts hgPlanMarketGeometry's verdict on every GOLD SCALP card:
   TARGET BEHIND PRICE, price already through the stop, and the rest. It reads
   c.mark, and hgPlanGeometryLineHtml deliberately "stays silent when the mark
   is unreachable rather than claiming the plan is fine" — correct on its own
   terms.

   THE GAP. convictionCardFromLiveRec rebuilds a locked card from the stored
   record with entry, stop, targets, anchor and atr — but no mark, because the
   record has no idea what price is now. mergeLiveConvictionCards pushes it
   into the display AFTER the venue loop that stamps marks on freshly built
   candidates. So it arrived with mark === undefined and the geometry line
   stayed silent, on exactly the setups that have survived rescans while price
   walked away from them.

   VERIFIED ON THE REAL MERGE before the fix: a stored record for entry 2400,
   stop 2394, T1 2412 came back with mark undefined and a geometry line of "".
   Given a mark of 2415 the same plan reads "TARGET BEHIND PRICE: T1 2412 sits
   between the market and the entry — the retest crosses TP1 before the fill".

   THE FIX. One named rule, gsDeskMark — live goldspot, else the last closed
   15m close — with two callers: the venue loop that stamps fresh candidates,
   and gsStampMergedMarks after the merge. Two copies of that rule would be
   two things to drift.

   IT STAMPS; IT DOES NOT GATE. A card that already carries a mark keeps it, a
   card with no finite desk mark is left silent, and nothing is held back or
   released by any of it.

   Run: node tests/test-goldscalp-locked-mark.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
const GS = fs.readFileSync(root + 'goldscalp.js', 'utf8');
const CL = fs.readFileSync(root + 'conviction-lock.js', 'utf8');

function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const F = new Function('isFinite',
  grab(GS, 'gsDeskMark') + grab(GS, 'gsStampMergedMarks')
  + 'return { gsDeskMark, gsStampMergedMarks };')(isFinite);

/* the real merge and the real geometry rule */
const ctx = { window: {}, console: { log(){}, warn(){}, error(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['hg-plan.js', 'conviction-lock.js'])
  vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
const W = ctx.window;
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const REC = { id: 'sweep|long|2400', dir: 'long', strategy: 'SCALP SETUP', stratKey: 'sweep',
              entry: 2400, stop: 2394, t1: 2412, t2: 2420, venue: 'delta', sym: 'XAUUSD',
              grade: 'B', agree: 2, oppose: 0, issuedAt: Date.now() - 3600e3, atr: 4 };
const merged = () => W.mergeLiveConvictionCards([], { live: { k1: JSON.parse(JSON.stringify(REC)) } },
                                                { strategyDefault: 'SCALP SETUP' });

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the defect: a locked card arrives with no mark');
{
  ok(typeof W.mergeLiveConvictionCards === 'function', 'the real merge is reachable');
  ok(typeof W.hgPlanGeometryLineHtml === 'function', 'and the real geometry rule');

  const d = merged();
  ok(d.length === 1, 'the stored record comes back as one card');
  ok(d[0].entry === 2400 && d[0].stop === 2394 && d[0].t1 === 2412,
     'carrying its levels verbatim, which is the point of the lock');
  ok(!isFinite(+d[0].mark), 'but with NO mark — the record cannot know what price is now');

  /* and so the warning that exists cannot fire */
  ok(W.hgPlanGeometryLineHtml({ dir: 'long', entry: 2400, stop: 2394, t1: 2412 }, d[0].mark, {}) === '',
     'so the geometry line is silent, however far price has walked');
  ok(!/mark:/.test(grab(CL, 'convictionCardFromLiveRec')),
     'convictionCardFromLiveRec sets no mark — the gap is there, not in the merge');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the warning works — it was only ever missing its input');
{
  const plan = { dir: 'long', entry: 2400, stop: 2394, t1: 2412 };
  const behind = text(W.hgPlanGeometryLineHtml(plan, 2415, {}));
  ok(/TARGET BEHIND PRICE/.test(behind),
     'price past T1 reads TARGET BEHIND PRICE (' + behind.slice(0, 60) + '…)');
  ok(/2412/.test(behind), 'naming the level it crossed');

  /* the same plan, price still short of entry, has nothing to complain about */
  const fine = text(W.hgPlanGeometryLineHtml(plan, 2398, {}));
  ok(fine === '' || !/BEHIND/.test(fine), 'while a plan price has not reached stays quiet');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the fix: one rule, and the locked card can speak');
{
  ok(typeof F.gsDeskMark === 'function' && typeof F.gsStampMergedMarks === 'function',
     'both helpers are lifted from goldscalp.js');

  /* the rule: live spot first, else the last closed 15m close */
  ok(F.gsDeskMark({ spot: { spotPx: 2415 } }, null) === 2415, 'live goldspot wins');
  ok(F.gsDeskMark(null, { rows15m: [{ c: 2401 }, { c: 2409 }] }) === 2409,
     'else the last CLOSED 15m close — the bar the gates already judged');
  ok(!isFinite(F.gsDeskMark(null, null)), 'and with neither, no mark at all');
  ok(!isFinite(F.gsDeskMark({ spot: { spotPx: 0 } }, null)), 'a zero spot is not a price');

  const d = merged();
  const n = F.gsStampMergedMarks(d, F.gsDeskMark({ spot: { spotPx: 2415 } }, null));
  ok(n === 1, 'the locked card is stamped');
  ok(d[0].mark === 2415, 'with the same mark the fresh candidates got');
  const after = text(W.hgPlanGeometryLineHtml(
    { dir: 'long', entry: 2400, stop: 2394, t1: 2412 }, d[0].mark, {}));
  ok(/TARGET BEHIND PRICE/.test(after), 'and now the card says price walked through the plan');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. it stamps; it does not gate, and it invents nothing');
{
  /* a card that already has a mark is the fresh kind — leave it alone */
  const keep = [{ mark: 2401 }, { mark: NaN }, { mark: undefined }];
  const n = F.gsStampMergedMarks(keep, 2415);
  ok(keep[0].mark === 2401, 'a card that already carries a mark keeps its own');
  ok(keep[1].mark === 2415 && keep[2].mark === 2415, 'only the ones without get stamped');
  ok(n === 2, 'and the count reports exactly that (' + n + ')');

  /* NO DESK MARK MEANS NO STAMP. An invented mark would be worse than none:
     the geometry line would then speak with authority about a price nobody
     read. */
  const none = [{}, {}];
  ok(F.gsStampMergedMarks(none, NaN) === 0, 'no desk mark stamps nothing');
  ok(F.gsStampMergedMarks(none, 0) === 0, 'and neither does a zero');
  ok(!isFinite(+none[0].mark), 'the cards stay markless, so the line stays honestly silent');
  ok(F.gsStampMergedMarks(null, 2415) === 0, 'no display at all is not an error');

  const body = grab(GS, 'gsStampMergedMarks') + grab(GS, 'gsDeskMark');
  ok(!/\.dropped\s*=/.test(body) && !/\.demoted\s*=/.test(body) && !/\.vetoed\s*=/.test(body),
     'nothing in either helper writes dropped, demoted or vetoed');
  ok(!/\.entry\s*=|\.stop\s*=|\.t1\s*=/.test(body),
     'and neither touches a level — the lock restores those verbatim');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. one rule, two callers — not two copies to drift');
{
  ok(/var __gsxMark = gsDeskMark\(ctx, gold\);/.test(GS),
     'the venue loop uses the shared rule for fresh candidates');
  ok(/gsStampMergedMarks\(display, gsDeskMark\(ctx, gold\)\);/.test(GS),
     'and the merge stamps locked ones with the same rule');
  /* count CALLS, not the definition — `function gsDeskMark(ctx, gold){` matches
     the same shape and would inflate this to three. */
  const calls = (GS.match(/(?<!function )gsDeskMark\(ctx, gold\)/g) || []).length;
  ok(calls === 2, 'exactly two callers (' + calls + ')');

  /* the inline copy is gone */
  ok(!/var __sp = ctx && ctx\.spot && \+ctx\.spot\.spotPx;/.test(GS),
     'the venue loop no longer carries its own copy of the rule');

  /* and the stamp runs AFTER the merge, or it would miss the locked cards */
  const mergeAt = GS.indexOf('var display = mergeFn ?');
  /* again: skip the definition, find the CALL */
  const stampAt = GS.indexOf('\n    gsStampMergedMarks(display,');
  ok(mergeAt > 0 && stampAt > mergeAt,
     'the stamp runs after the merge — before it, the locked cards do not exist yet');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
