/* HARDGATE — the 80% accuracy floor, across every instrumented gold and
   crypto desk.

   ASKED FOR: every gold and crypto tab at better than 80% accuracy.

   Accuracy is not a setting, and no edit makes a rule win more often. What an
   edit CAN do is stop a desk presenting itself as better than it has been
   shown to be, and say — per tab, in one line — where it stands against an
   80% standard. That is what this floor is.

   THE ONE DECISION THAT MATTERS: the floor is judged on the WILSON LOWER
   BOUND over INDEPENDENT observations, never on the point estimate. Three
   wins from three is 100%, and reading that as clearing 80% is exactly the
   error that makes an over-fitted backtest look extraordinary. Wilson at
   3-of-3 says 43.8%.

   And the independence correction matters as much. A desk firing on 400
   contracts on one bar with one horizon has written 400 rows and seen ONE
   thing happen; CRYPTO SCAN measured 4.96 independent observations from
   3,840 rows. A floor judged on the raw count would be cleared by
   concurrency alone.

   What it costs to clear, computed rather than asserted:

     observed rate     independent observations needed
         100%                        16
          95%                        28
          90%                        62
          85%                       246
          82%                     1,537

   Run: node tests/test-accuracy-floor.mjs */
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
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const SEC = 900, BAR0 = 1700000000, HZ = 24;

function boot(){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(s);
  for (const f of ['hg-forward.js', 'accuracy-floor.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const AF = fs.readFileSync(root + 'accuracy-floor.js', 'utf8');
const HTML = fs.readFileSync(root + 'index.html', 'utf8');
const LS = 'hg_forward_v1';

function rec(desk, sym, bar, win){
  return { tab: desk, mechanic: 'M', sym: sym, tf: '15m', dir: 'long',
           entry: 100, stop: 95, t1: 110, risk: 5, rr: 2,
           barT: bar, horizonBars: HZ, state: win ? 't1' : 'stop',
           ticket: true, gateClear: true };
}
/* non-overlapping: one record per horizon, so effN tracks the record count */
const spaced = (desk, n, winFn) =>
  Array.from({ length: n }, (_, i) => rec(desk, 'S' + i, BAR0 + i * HZ * SEC, winFn(i)));
const load = rows => S.localStorage.setItem(LS, JSON.stringify(rows));

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the lower bound, not the number on the screen');
{
  ok(S.HG_ACCURACY_FLOOR === 0.80, 'the floor is 80%, in one place');
  ok(typeof S.hgWilsonLower === 'function', 'and Wilson is reachable');

  /* THE CASE THE WHOLE FLOOR EXISTS FOR */
  ok(Math.abs(S.hgWilsonLower(3, 3) - 0.438) < 0.002,
     'three wins from three is a point estimate of 100% and a lower bound of 43.8%');
  ok(S.hgWilsonLower(3, 3) < 0.80, 'which does NOT clear an 80% floor');
  ok(S.hgWilsonLower(1, 1) < 0.5, 'and one win from one clears nothing at all');

  /* the normal approximation would have said otherwise, which is why it is
     not used: its half-width is zero at p = 1 */
  const normalHalfWidth = 1.96 * Math.sqrt(1 * (1 - 1) / 3);
  ok(normalHalfWidth === 0,
     'the normal approximation has zero width at a flawless record — it would call 3-of-3 a certainty');
  ok(S.hgWilsonLower(3, 3) > 0, 'Wilson does not degenerate there');

  /* monotone in the ways it must be */
  ok(S.hgWilsonLower(16, 16) > S.hgWilsonLower(8, 8), 'more evidence at the same rate raises the bound');
  ok(S.hgWilsonLower(8, 10) > S.hgWilsonLower(6, 10), 'a better rate at the same size raises it too');
  ok(S.hgWilsonLower(0, 10) === 0, 'a record of no wins bounds at zero, not below');
  ok(!isFinite(S.hgWilsonLower(1, 0)), 'and no sample has no bound at all');
  ok(!isFinite(S.hgWilsonLower(1, -5)) && !isFinite(S.hgWilsonLower(-1, 5)),
     'nor do nonsense inputs');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. what the claim actually costs, computed not quoted');
{
  ok(S.hgAccuracyMinObs() === 16,
     'a flawless record needs 16 independent observations to claim 80%');
  ok(S.hgWilsonLower(15, 15) < 0.80 && S.hgWilsonLower(16, 16) >= 0.80,
     'and 15 is genuinely not enough while 16 is');

  const need = S.hgAccuracyNeedObs;
  ok(need(1.00) === 16, 'at 100% observed, 16');
  ok(need(0.95) === 28, 'at 95%, 28');
  ok(need(0.90) === 62, 'at 90%, 62');
  ok(need(0.85) === 246, 'at 85%, 246 — the closer to the floor, the more it takes');
  ok(need(0.82) === 1537, 'and at 82%, 1,537');

  /* THE HONEST STOP. Below the floor no sample size helps, and saying "keep
     waiting" would be false comfort. */
  ok(need(0.80) === null, 'at exactly 80% no sample size clears an 80% LOWER bound');
  ok(need(0.60) === null, 'and at 60% none ever will — the rate itself has to be higher');
  ok(need(NaN) === null && need(undefined) === null, 'an unreadable rate needs nothing computed');

  /* the minimum is derived from the floor, so it cannot drift from it */
  ok(S.hgAccuracyMinObs(0.5) < S.hgAccuracyMinObs(0.8),
     'a lower floor is cheaper to clear (' + S.hgAccuracyMinObs(0.5) + ' vs ' + S.hgAccuracyMinObs(0.8) + ')');
  ok(S.hgAccuracyMinObs(0.95) > S.hgAccuracyMinObs(0.8), 'and a higher one dearer');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. independent observations, not raw record count');
{
  /* A CROSS-SECTIONAL BURST: 400 rows, one bar, one horizon. The desk wrote
     400 records and saw one thing happen. */
  load(Array.from({ length: 400 }, (_, i) => rec('CRYPTO SCAN', 'S' + i, BAR0, true)));
  const burst = S.hgAccuracyRead('cryptoscan');
  ok(burst.settled === 400, 'the log holds 400 settled records');
  ok(burst.hit === 1, 'every one of them a win');
  ok(burst.effN < 2,
     'but they are ' + burst.effN.toFixed(2) + ' independent observations — they all ran at once');
  ok(burst.state !== 'clears',
     'so a flawless 400-record burst does NOT clear the floor (' + burst.state + ')');
  ok(S.hgWilsonLower(400, 400) > 0.99,
     'judged on the raw count it would have read ' + (100 * S.hgWilsonLower(400, 400)).toFixed(1)
     + '% — concurrency alone would have cleared it');

  /* the same 400 wins, spread so they do not overlap */
  load(spaced('CRYPTO SCAN', 400, () => true));
  const spread = S.hgAccuracyRead('cryptoscan');
  ok(spread.effN > 100, 'spread out, the same 400 wins are ' + spread.effN.toFixed(0) + ' independent');
  ok(spread.state === 'clears', 'and they do clear the floor');
  ok(spread.settled === burst.settled && spread.hit === burst.hit,
     'with an identical record count and hit rate — only the independence differs');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the four states a desk can be in');
{
  load([]);
  const none = S.hgAccuracyRead('cryptoscan');
  ok(none.state === 'unmeasured', 'no settled records: unmeasured');
  ok(/NOT YET MEASURED/.test(S.hgAccuracyText(none)), 'and it says so');
  ok(/16 independent observations/.test(S.hgAccuracyText(none)), 'naming what it would take');

  load(spaced('CRYPTO SCAN', 3, () => true));
  const thin = S.hgAccuracyRead('cryptoscan');
  ok(thin.state === 'thin', 'a perfect 3-record run is too thin to judge, not a pass');
  ok(/TOO THIN TO JUDGE/.test(S.hgAccuracyText(thin)), 'and says that');
  ok(/100%/.test(S.hgAccuracyText(thin)), 'while still printing what was observed');

  load(spaced('CRYPTO SCAN', 120, i => i % 5 < 3));
  const below = S.hgAccuracyRead('cryptoscan');
  ok(below.state === 'below', '60% over 120 independent records is below the floor');
  ok(/BELOW THE 80% FLOOR/.test(S.hgAccuracyText(below)), 'and says so plainly');
  ok(/no sample size clears/.test(S.hgAccuracyText(below)),
     'and refuses the false comfort that more data would fix it');

  load(spaced('CRYPTO SCAN', 40, () => true));
  const clears = S.hgAccuracyRead('cryptoscan');
  ok(clears.state === 'clears', '40 independent wins clear it');
  ok(/CLEARS THE 80% FLOOR/.test(S.hgAccuracyText(clears)), 'and it says so');
  ok(/lower bound/.test(S.hgAccuracyText(clears)), 'quoting the bound, not just the rate');

  /* a tab nobody instrumented gets no verdict at all */
  const unwired = S.hgAccuracyRead('somethingelse');
  ok(unwired.state === 'unwired', 'a tab outside the roster is unwired');
  ok(S.hgAccuracyText(unwired) === '', 'and gets no sentence — silence beats a made-up verdict');
  ok(S.hgAccuracyFloorHtml('somethingelse') === '', 'and no banner');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the banner, and every desk on one board');
{
  load(spaced('CRYPTO SCAN', 40, () => true));
  const html = S.hgAccuracyFloorHtml('cryptoscan');
  ok(/ACCURACY FLOOR 80%/.test(text(html)), 'the banner names the floor');
  ok(/CRYPTO SCAN/.test(text(html)), 'and the desk it is judging');
  ok(/#166534/.test(html), 'a desk that clears is coloured as such');
  load(spaced('CRYPTO SCAN', 120, i => i % 5 < 3));
  ok(/#991B1B/.test(S.hgAccuracyFloorHtml('cryptoscan')), 'and one below it is not');

  const roster = S.hgAccuracyRoster();
  ok(roster.length >= 10, 'the roster covers ' + roster.length + ' instrumented desks');
  const ids = Object.keys(S.HG_ACCURACY_TABS);
  /* v897 CORRECTION. v896 left OMNIGOLD off and said in its commit message
     that it "records none of its own". That was WRONG. It records under
     OMNIGOLD:SCALP and OMNIGOLD:SWING through a captured local --
     `var fwdRecord = gfn('hgFwdRecord')` -- which the v896 extraction, keyed
     on the literal name at the call site, could not see. The desks that truly
     record nothing are GOLD SPOT (a basis monitor) and GOLD COINT (a context
     ledger): neither mentions entry, stop or t1 anywhere. */
  ok(ids.indexOf('omnigold') >= 0, 'OMNIGOLD is judged — it does record, under two pools');
  ok(ids.indexOf('goldspot') < 0 && ids.indexOf('goldcoint') < 0,
     'while the two gold tabs that mint no setups at all are left off rather than mis-reported');
  ok(ids.indexOf('cryptoscan') >= 0 && ids.indexOf('goldscalp') >= 0,
     'spanning both crypto and gold');
  ok(ids.indexOf('goldscalp') >= 0 && ids.indexOf('goldswing') >= 0
     && ids.indexOf('cryptoverse') >= 0 && ids.indexOf('ninetypercent') >= 0,
     'including the newest desks on both sides');
  ok(roster.every(r => r.state !== 'unwired'), 'every entry on it is actually judged');
  /* a desk that clears sorts above one that does not */
  const states = roster.map(r => r.state);
  const rank = { clears: 0, below: 1, thin: 2, unmeasured: 3 };
  let ordered = true;
  for (let i = 1; i < states.length; i++) if (rank[states[i]] < rank[states[i - 1]]) ordered = false;
  ok(ordered, 'and the board is ordered by verdict, not alphabetically');

  const board = text(S.hgAccuracyRosterHtml());
  ok(/EVERY INSTRUMENTED GOLD AND CRYPTO DESK/.test(board), 'the board says what it covers');
  ok(/lower bound/.test(board), 'carries the lower-bound column');
  ok(/16 of them to claim 80%/.test(board), 'and states the cost of the claim');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. wired to paint on every one of those tabs');
{
  ok(/<script src="accuracy-floor\.js\?v=\d+"><\/script>/.test(HTML), 'the script tag is present');
  ok(/if \(typeof hgAccuracyFloorPaint === 'function'\) hgAccuracyFloorPaint\(t\);/.test(HTML),
     'and showTab paints it for whichever tab was opened');
  const paintAt = HTML.indexOf('hgAccuracyFloorPaint(t)');
  const dayAt = HTML.indexOf('hgTabFormationDayPaint(t)');
  ok(paintAt > 0 && dayAt > 0 && paintAt > dayAt,
     'beside the nightly banner, by the same route');

  const bare = stripComments(AF);
  ok(/W\.document\.getElementById\('tab_' \+ id\)/.test(bare), 'it finds the pane by id');
  ok(/host\.innerHTML = hgAccuracyFloorHtml\(id\) \|\| '';/.test(bare),
     'and REPLACES its host — repainting a tab does not stack a second banner');
  ok(/if \(!HG_ACCURACY_TABS\[id\]\) return null;/.test(bare),
     'a tab outside the roster is never painted');
  ok(/if \(!pane\) return null;/.test(bare), 'and a missing pane is not an error');

  /* the floor never hides anything — it is a disclosure, not a filter */
  ok(!/display *: *none/.test(bare) && !/\.remove\(\)/.test(bare),
     'nothing is hidden or removed: a desk below the floor still shows its setups');
  ok(/does not hide cards/.test(AF), 'which the file states outright');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. it reports, it never invents');
{
  const bare = stripComments(AF);
  /* no hard-coded rate anywhere pretending to be a measurement */
  ok(!/hit: 0\.[89]/.test(bare) && !/lower: 0\.[89]/.test(bare),
     'no rate is hard-coded into a read');
  ok(!/\bfetch\s*\(/.test(AF) && !/XMLHttpRequest/.test(AF), 'nothing is fetched or sent');
  /* the floor is one constant, used everywhere */
  ok((bare.match(/0\.80/g) || []).length === 1,
     'the floor literal appears exactly once — everything else derives from it');
  ok(/floor = isFinite\(\+floor\) \? \+floor : HG_ACCURACY_FLOOR;/.test(bare),
     'and callers can override it without editing the arithmetic');

  /* a desk with records but no overlap reading is thin, never judged */
  load(spaced('CRYPTO SCAN', 1, () => true));
  const one = S.hgAccuracyRead('cryptoscan');
  ok(one.state === 'thin' || one.state === 'unmeasured',
     'a single record yields no overlap reading, so no verdict (' + one.state + ')');
  ok(!isFinite(one.lower) || one.state !== 'clears',
     'and it certainly does not clear the floor');
}

/* ---------------------------------------------------------------- 8 */
console.log('\n8. the edges a survivor found: equality, a missing reading, and who stays on the board');
{
  /* AT OR ABOVE, not above. The floor is a floor — a desk landing exactly on
     it has met the standard. Real data never lands on 0.80 exactly, so the
     distinction is only testable by asking against the bound a desk actually
     has. */
  load(spaced('CRYPTO SCAN', 40, () => true));
  const exact = S.hgAccuracyRead('cryptoscan');
  ok(exact.state === 'clears' && isFinite(exact.lower), 'a clearing desk has a finite bound');
  const onIt = S.hgAccuracyRead('cryptoscan', exact.lower);
  ok(onIt.state === 'clears',
     'and against a floor set to exactly that bound it still clears — the floor is "at or above"');
  const justOver = S.hgAccuracyRead('cryptoscan', exact.lower + 1e-9);
  ok(justOver.state !== 'clears', 'a hair above it, and it does not');

  /* NO OVERLAP READING IS NOT AN EXCUSE TO USE THE RAW COUNT. The raw count
     is the thing the overlap correction exists to fix; falling back to it
     would let the 400-row burst clear the floor after all. */
  const realOverlap = S.hgFwdOverlap;
  load(Array.from({ length: 400 }, (_, i) => rec('CRYPTO SCAN', 'S' + i, BAR0, true)));
  try{
    S.hgFwdOverlap = () => null;
    const gone = S.hgAccuracyRead('cryptoscan');
    ok(gone.settled === 400 && gone.hit === 1, 'the records are still there, still flawless');
    ok(gone.state === 'thin', 'but with no overlap reading the desk is thin, not judged');
    ok(!isFinite(gone.effN), 'no independent count is invented for it');
    ok(gone.state !== 'clears', 'and 400 flawless rows do not clear the floor on the raw count');
    S.hgFwdOverlap = () => ({ effN: NaN });
    ok(S.hgAccuracyRead('cryptoscan').state === 'thin', 'an unreadable effN is treated the same way');
    S.hgFwdOverlap = () => ({ effN: 400 });
    ok(S.hgAccuracyRead('cryptoscan').state === 'clears',
       'while a genuine reading of 400 independent observations does clear it — the guard is the reading, not the verdict');
  } finally { S.hgFwdOverlap = realOverlap; }

  /* WINS ABOVE THE SAMPLE. hgWilsonLower is exported for anyone to call, and
     an uncapped p drives p(1-p) negative and the whole bound to NaN — which
     reads as "no verdict" rather than as the caller error it is. */
  ok(isFinite(S.hgWilsonLower(5, 3)),
     'more wins than observations still yields a bound rather than NaN');
  ok(S.hgWilsonLower(5, 3) === S.hgWilsonLower(3, 3),
     'capped at a flawless record, which is the most it can mean');

  /* THE BOARD SHOWS THE DESKS THAT FAIL. A roster that quietly dropped them
     would read as "every desk clears 80%" — the exact claim this file exists
     to stop anyone making. */
  load(spaced('CRYPTO SCAN', 120, i => i % 5 < 3));
  const board = S.hgAccuracyRoster();
  ok(board.length === Object.keys(S.HG_ACCURACY_TABS).length,
     'the roster lists every instrumented desk, all ' + board.length + ' of them');
  const cs = board.filter(r => r.tab === 'cryptoscan')[0];
  ok(cs && cs.state === 'below', 'including the one that is below the floor');
  ok(/BELOW/.test(text(S.hgAccuracyRosterHtml())), 'and the board prints that verdict');
}

/* ---------------------------------------------------------------- 9 */
console.log('\n9. the roster is checked against the sources, in BOTH directions');
{
  /* WHY THIS GUARD EXISTS, AND WHY v896's VERSION WAS NOT ENOUGH.

     hgFwdPool matches rec.tab with !==, so a roster name that is merely
     plausible pools nothing and the desk reads NOT YET MEASURED for ever —
     a WRONG verdict wearing the clothes of a patient one, invisible because
     that is exactly what a new desk looks like. v896 caught five such names
     (GOLD SCALP for GOLDSCALP, GOLD SWING for GOLDSWING, GOLD ULTRA for
     GOLDULTRA, OI FLOW for OIFLOW, REVERSAL SNIPER for REVERSALSNIPER).

     But it only checked roster -> sources. It could not see a desk that
     records and is simply ABSENT from the roster, and it read call sites by
     the literal name `hgFwdRecord`, so it missed every desk that captures the
     recorder first. OMNIGOLD does exactly that —
     `var fwdRecord = gfn('hgFwdRecord')` — and v896 concluded, wrongly and in
     its commit message, that OMNIGOLD records nothing. So the extraction now
     follows that indirection, and the check runs BOTH ways. */
  const skip = new Set(['hg-forward.js']);
  const byFile = {};
  for (const f of fs.readdirSync(root).filter(n => n.endsWith('.js') && !skip.has(n))){
    const src = fs.readFileSync(root + f, 'utf8');
    /* every local name that aliases one of the two recorders */
    const alias = new Set(['hgFwdRecord', 'hgFwdRecordScan']);
    for (const m of src.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:gfn|W\.?|w\.?)?\s*\(?\s*['"](hgFwdRecord|hgFwdRecordScan)['"]/g))
      alias.add(m[1]);
    for (const m of src.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:W|w|G)\.(hgFwdRecord|hgFwdRecordScan)\b/g))
      alias.add(m[1]);
    const consts = {};
    for (const m of src.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']+)'\s*;/g)) consts[m[1]] = m[2];
    const A = [...alias].join('|');
    const names = new Set();
    /* scan form: NAME('POOL', ...) / NAME(CONST, ...) / NAME('STEM:' + x, ...) */
    for (const m of src.matchAll(new RegExp('(?:' + A + ")\\s*\\(\\s*'([^']+:)'\\s*\\+", 'g'))) names.add('PREFIX:' + m[1]);
    for (const m of src.matchAll(new RegExp('(?:' + A + ")\\s*\\(\\s*(?:'([^']+)'|([A-Za-z_$][\\w$.]*))", 'g'))){
      if (m[1] != null) names.add(m[1]);
      else if (consts[m[2]]) names.add(consts[m[2]]);
    }
    /* object form: NAME({ ... tab: 'POOL' | 'STEM:' + x | CONST ... }) */
    for (const m of src.matchAll(new RegExp('(?:' + A + ")\\s*\\(\\s*\\{[\\s\\S]{0,1200}?tab:\\s*(?:'([^']+)'\\s*\\+|'([^']+)'|([A-Za-z_$][\\w$.]*))", 'g'))){
      if (m[1] != null) names.add('PREFIX:' + m[1]);
      else if (m[2] != null) names.add(m[2]);
      else if (consts[m[3]]) names.add(consts[m[3]]);
    }
    if (names.size) byFile[f] = [...names];
  }
  const recorded = new Set();
  for (const f of Object.keys(byFile)) for (const n of byFile[f]) recorded.add(n);
  ok(recorded.size > 25, 'the sources record under ' + recorded.size + ' desk names');

  /* THE FIX THAT MOTIVATED THIS REWRITE: the indirection is now followed */
  ok((byFile['omnigold.js'] || []).indexOf('PREFIX:OMNIGOLD:') >= 0,
     'OMNIGOLD is seen to record, through a captured local — the v896 extraction could not see this');

  /* ---- direction 1: every roster name is one the sources write ---- */
  const roster = S.HG_ACCURACY_TABS;
  const bad = [];
  for (const tab of Object.keys(roster)){
    for (const e of roster[tab]){
      if (e && e.prefix){
        if (!recorded.has('PREFIX:' + e.prefix)
            && ![...recorded].some(n => typeof n === 'string' && n.indexOf(e.prefix) === 0))
          bad.push(tab + ' -> prefix ' + e.prefix);
        continue;
      }
      if (recorded.has(e)) continue;
      const stem = String(e).replace(/[^:]*$/, '');
      if (stem && recorded.has('PREFIX:' + stem)) continue;
      bad.push(tab + ' -> ' + e);
    }
  }
  ok(bad.length === 0,
     'every roster entry names something the sources actually write'
     + (bad.length ? ' — WRONG: ' + bad.join(', ') : ''));

  /* ---- direction 2: every recording desk tab is ON the roster ---- */
  const rosterStems = new Set();
  for (const tab of Object.keys(roster))
    for (const e of roster[tab]) rosterStems.add(e && e.prefix ? 'PREFIX:' + e.prefix : e);
  /* files that both record AND register a tab in the gold or crypto nav */
  const navGold = HTML.match(/id:'gold',\s*label:'GOLD',\s*tabs:\[([^\]]*)\]/);
  ok(!!navGold, 'the GOLD nav group is readable from index.html');
  const goldTabs = navGold[1].split(',').map(t => t.trim().replace(/^'|'$/g, ''));
  ok(goldTabs.length >= 14, 'it lists ' + goldTabs.length + ' gold tabs');

  const orphan = [];
  for (const f of Object.keys(byFile)){
    const src = fs.readFileSync(root + f, 'utf8');
    if (!/HG_tabs\.push/.test(src)) continue;          /* not a tab, e.g. a report module */
    for (const n of byFile[f]){
      if (rosterStems.has(n)) continue;
      /* an exact pool covered by a roster prefix, or a prefix covered exactly */
      const stem = String(n).replace(/^PREFIX:/, '');
      /* covered exactly, or by a roster prefix, or -- for a recorded family --
         by roster entries that name exact pools under that stem */
      if ([...rosterStems].some(r => typeof r === 'string'
            && (r === stem || r.replace(/^PREFIX:/, '') === stem
                || String(n).indexOf(String(r).replace(/^PREFIX:/, '')) === 0
                || (String(n).indexOf('PREFIX:') === 0 && r.indexOf(stem) === 0)))) continue;
      orphan.push(f + ' -> ' + n);
    }
  }
  ok(orphan.length === 0,
     'every desk that records AND owns a tab is on the roster'
     + (orphan.length ? ' — MISSING: ' + orphan.join(', ') : ''));

  /* THE HOLE THIS STATIC CHECK CANNOT CLOSE, and what does close it.
     OMNIGOLD is claimed by two EXACT pools rather than by a prefix, because
     OMNIGOLD:P80 and OMNIGOLD:TAURIC are separate desks sharing the stem. So
     a third OMNIGOLD: pool added tomorrow would satisfy this check while
     going unjudged. hgAccuracyUnclaimed catches that at run time, against
     the log itself. */
  load([...spaced('OMNIGOLD:SCALP', 3, () => true),
        ...spaced('OMNIGOLD:INTRADAY', 3, () => true),
        ...spaced('CRYPTO SCAN', 3, () => true)]);
  const unclaimed = S.hgAccuracyUnclaimed();
  ok(unclaimed.length === 1 && unclaimed[0] === 'OMNIGOLD:INTRADAY',
     'a pool accumulating records under an unclaimed name is named (' + unclaimed.join(', ') + ')');
  load([...spaced('OMNIGOLD:SCALP', 3, () => true), ...spaced('CRYPTO SCAN', 3, () => true)]);
  ok(S.hgAccuracyUnclaimed().length === 0, 'and a fully claimed log reports nothing');
  load([...spaced('GOLDPINE:anything-new', 3, () => true)]);
  ok(S.hgAccuracyUnclaimed().length === 0,
     'a prefix-claimed family absorbs a new member without complaint — that is what the prefix is for');
  /* and the board says so rather than keeping it to itself */
  load([...spaced('OMNIGOLD:INTRADAY', 3, () => true)]);
  ok(/UNCLAIMED/.test(text(S.hgAccuracyRosterHtml())), 'the board reports an unclaimed pool');
  ok(/OMNIGOLD:INTRADAY/.test(text(S.hgAccuracyRosterHtml())), 'and names it');
  load([...spaced('CRYPTO SCAN', 3, () => true)]);
  ok(!/UNCLAIMED/.test(text(S.hgAccuracyRosterHtml())), 'and stays quiet when there is nothing to report');

  /* the guard is not vacuous: the wrong names are still rejected */
  for (const wrong of ['GOLD SCALP', 'GOLD SWING', 'GOLD ULTRA', 'OI FLOW', 'REVERSAL SNIPER'])
    ok(!recorded.has(wrong), 'the plausible-but-wrong name "' + wrong + '" is still not a recorded pool');
  ok(recorded.has('GOLDSCALP') && recorded.has('OIFLOW') && recorded.has('REVERSALSNIPER'),
     'while the real ones are');

  /* ---- gold coverage, which is what this pack was asked for ---- */
  const ids = Object.keys(roster);
  const judged = goldTabs.filter(t => ids.indexOf(t) >= 0);
  const unjudged = goldTabs.filter(t => ids.indexOf(t) < 0);
  ok(judged.length >= 13,
     judged.length + ' of the ' + goldTabs.length + ' gold tabs are judged against the floor');
  /* and the ones that are not are named, with a reason that holds */
  for (const t of unjudged){
    const file = t === 'gold' ? null : root + t + '.js';
    if (!file || !fs.existsSync(file)){
      ok(t === 'gold', 'unjudged gold tab "' + t + '" is the inline scan, which records under CARD:<scanId>');
      continue;
    }
    const src = fs.readFileSync(file, 'utf8');
    ok(!/\bentry\b/.test(src) && !/\bt1\b/.test(src),
       'unjudged gold tab "' + t + '" mints no setups at all — nothing to measure, so no verdict');
  }
  for (const g of ['omnigold', 'omnigold1', 'goldscalp', 'goldswing', 'goldultra',
                   'goldpro', 'goldpine', 'golddirection', 'newgold', 'optigold',
                   'tauric', '80percent', 'super-gold'])
    ok(ids.indexOf(g) >= 0, 'gold desk ' + g + ' is on the roster');
}

/* ---------------------------------------------------------------- 10 */
console.log('\n10. a desk that writes a FAMILY of pools resolves it from the log');
{
  /* Hard-coding the suffixes of a family puts a second list in a second file
     to drift out of step with the first — which is exactly how a roster ends
     up naming a pool nothing writes. hgFwdTabs lets the floor ask the log. */
  ok(typeof S.hgFwdTabs === 'function', 'hg-forward.js exposes the log\'s own desk names');
  load([...spaced('GOLDPINE:scalp', 20, () => true), ...spaced('GOLDPINE:swing', 20, () => true),
        ...spaced('SOMETHING ELSE', 5, () => true)]);
  const fam = S.hgFwdTabs('GOLDPINE:');
  ok(fam.length === 2 && fam[0] === 'GOLDPINE:scalp' && fam[1] === 'GOLDPINE:swing',
     'a prefix resolves to exactly the pools under it (' + fam.join(', ') + ')');
  ok(S.hgFwdTabs().length === 3, 'and with no prefix it returns every desk in the log');


  const gp = S.hgAccuracyRead('goldpine');
  ok(gp.settled === 40, 'the desk pools both halves of its family (' + gp.settled + ')');
  ok(gp.pools.length === 2, 'having resolved 2 pool names it was never told');
  ok(/2 pools/.test(String(gp.desk)),
     'and the banner says it is pooling more than one (' + gp.desk + ') rather than naming only the first');

  /* INDEPENDENCE ACROSS POOLS IS THE LARGEST, NEVER THE SUM. A desk split by
     horizon trades the same instrument at the same time, so adding the two
     effN counts one market move twice and claims independence it has not
     got. The max understates when the pools really are disjoint, and
     understating is the safe direction for a floor. */
  const half = S.hgFwdOverlap('GOLDPINE:scalp', null, {});
  ok(gp.effN <= half.effN * 1.001,
     'the independent count is the larger pool (' + gp.effN.toFixed(1)
     + '), not the two added (' + (half.effN * 2).toFixed(1) + ')');

  /* A DESK CAN EXIST ONLY IN THE AGGREGATE. hg-forward prunes live records at
     MAX_RECORDS and folds them into hg_forward_agg_v1, so the desks with the
     MOST evidence are exactly the ones whose live rows are gone. Reading only
     the live list would drop them — and a prefix family would silently lose a
     member precisely because it had been running longest. */
  load([...spaced('GOLDPINE:scalp', 3, () => true)]);
  S.localStorage.setItem('hg_forward_agg_v1',
    JSON.stringify({ 'GOLDPINE:ancient|M': { samples: 40, wins: 34, losses: 6 } }));
  const withAgg = S.hgFwdTabs('GOLDPINE:');
  ok(withAgg.indexOf('GOLDPINE:ancient') >= 0,
     'a desk surviving only in the aggregate is still listed (' + withAgg.join(', ') + ')');
  ok(S.hgAccuracyRead('goldpine').settled === 43,
     'and its evidence is pooled, not lost');
  S.localStorage.removeItem('hg_forward_agg_v1');

  /* a family with nothing in the log yet is UNMEASURED, never unwired: the
     tab is instrumented, it simply has not fired */
  load([]);
  const empty = S.hgAccuracyRead('goldpine');
  ok(empty.state === 'unmeasured', 'an unfired family is unmeasured, not unwired');
  ok(String(empty.desk).indexOf('GOLDPINE:') === 0,
     'and the banner still names the desk by its stem (' + empty.desk + ')');

  /* THE TRAP THIS DESIGN HAD TO AVOID. OMNIGOLD:P80 and OMNIGOLD:TAURIC are
     SEPARATE desks that merely share a stem with OMNIGOLD. A prefix entry for
     OMNIGOLD would swallow both and credit their evidence to a tab that did
     not earn it, so OMNIGOLD is listed by its two exact pools instead. */
  load([...spaced('OMNIGOLD:SCALP', 20, () => true),
        ...spaced('OMNIGOLD:P80', 30, () => false),
        ...spaced('OMNIGOLD:TAURIC', 30, () => false)]);
  const og = S.hgAccuracyRead('omnigold');
  ok(og.settled === 20, 'OMNIGOLD counts only its own two pools (' + og.settled + '), not P80 or TAURIC');
  ok(og.hit === 1, 'so its record is its own');
  ok(S.hgAccuracyRead('80percent').settled === 30, 'while 80PERCENT keeps its 30');
  ok(S.hgAccuracyRead('tauric').settled === 30, 'and TAURIC keeps its 30');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
