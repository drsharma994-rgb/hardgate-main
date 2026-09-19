/* HARDGATE — the GOLD PRO macro ledger does not read a feed it never got.

   GOLD PRO's MACRO LEDGER is seven rows, each stamped BULL / BEAR / NEUT /
   INFO / N/A "for gold", and its own legend says what the stamps mean: NEUT
   and INFO are readings, N/A is the absence of one. Handed four feed objects
   whose fields are all null — which is what a cold desk, or one behind a
   geo-block, actually has — three of the seven printed a reading anyway:

     M1  FRED DTWEXBGS · dollar index (20d trend)  n/a · FLAT (n/a% over 20d)  NEUT
     M2  US 10Y yield (20d trend)                  n/a% · FLAT (n/a% rel. 20d) NEUT
     M4  Gold/Silver ratio  n/a · <70 — silver relatively rich; risk-on regime  INFO

   isFinite(null) is TRUE, so `if (isFinite(gsr))` took the true branch with
   no ratio; a relational compare then coerces null to 0, so `gsr < 70` was
   true and the desk named a macro REGIME out of nothing. M1 went further and
   claimed the FRED series as the source of a number it did not have. All
   three had an else branch directly below them already saying
   "unavailable · N/A", sitting unused. The other four rows were correct.

   goldpro.js already carried this note twice — on M5, and again at the COT
   read further down — both times about the same isFinite(null) trap, both
   times fixed there and nowhere else. The fix is the same strict coercion
   goldind.js got in pack 843, applied to every feed field this panel reads.

   Scope, measured rather than asserted: across six fixtures and seven rows,
   six row-renders changed and thirty-six are byte-identical. Every change is
   an invented reading becoming "unavailable · N/A"; every fixture carrying
   real numbers is untouched, INCLUDING a gold/silver ratio of exactly 0,
   because a real zero is a reading and this fix must not swallow it.

   AND THE LEADER NAMES ITS INSTRUMENT. goldProPlan returned a plan with no
   sym, and that plan goes straight to hgMpPin, whose panel falls back to
   `row.sym || '?'`. So the pinned card read

     MOST PROBABLE SETUP ? LONG · GOOD 72 · GOLDPRO · LEADER
     This is the ranked leader on GOLDPRO. Levels are the live ticket.

   — a live ticket that could not say what it was a ticket for. This desk
   reads gold and nothing else, so the symbol was knowable all along.

   Run: node tests/test-gold-pro-ledger.mjs */
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

/* Comments stripped before the source scan. Four packs have now shipped a
   false positive because a scanner read the string it was hunting out of the
   comment explaining the fix, and the note added above names isFinite(null)
   several times. */
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Intl, Promise, Error, TypeError,
              Set, Map, WeakMap, Symbol, Function, Boolean };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }), addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'goldpro.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}

const S = boot();
const TAGS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];

/** The ledger rendered as {M1: 'the whole row text', ...}. */
function ledger(macro, funding, ls, cot){
  const flat = String(S.goldProMacroPanel(macro, funding, ls, cot))
    .replace(/<[^>]*>/g, '|').replace(/\|+/g, '|')
    .split('|').map(x => x.trim()).filter(Boolean).join(' ');
  const out = {};
  for (const tag of TAGS){
    const i = flat.indexOf(tag + ' ');
    if (i < 0) continue;
    let j = flat.length;
    for (const n of TAGS.concat(['GOLD'])) { const k = flat.indexOf(n + ' ', i + 3); if (k > 0 && k < j) j = k; }
    out[tag] = flat.slice(i, j).trim();
  }
  return out;
}
const unavailable = r => /unavailable/.test(r) && /N\/A/.test(r);

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the seam and the legend');
{
  ok(typeof S.goldProMacroPanel === 'function', 'the ledger is a pure function of its four feeds');
  const html = S.goldProMacroPanel(null, null, null, null);
  ok(/BULL tailwind/.test(html) && /NEUT\/INFO/.test(html) && /N\/A/.test(html),
     'and its own legend distinguishes a reading (BULL / BEAR / NEUT / INFO) from an absence (N/A)');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. every feed absent — nothing is read');
{
  const shapes = [
    ['four nulls', { dxyOfficial: null, dxy: null, tnx: null, tnxTrend: null, tnxChange20Pct: null,
                     realRateHint: null, goldSilverRatio: null },
                   { fundingPct: null }, { latest: { longPct: null } }, { specNetPctOi: null }],
    ['feed objects present, fields empty',
                   { dxyOfficial: { value: null, trend20: null, change20Pct: null },
                     dxy: { value: null }, tnx: null, goldSilverRatio: null },
                   { fundingPct: null }, { latest: { longPct: null } }, { specNetPctOi: null }],
    ['no macro object at all', null, null, null, null],
    ['empty strings, as a parsed CSV hands them',
                   { tnx: '', goldSilverRatio: '', dxy: { value: '' } }, { fundingPct: '' },
                   { latest: { longPct: '' } }, { specNetPctOi: '' }],
    ['text where a number belongs',
                   { tnx: 'n/a', goldSilverRatio: 'unknown', dxy: { value: '--' } }, {}, {}, {}]
  ];
  for (const [label, m, f, l, c] of shapes){
    const rows = ledger(m, f, l, c);
    const lying = TAGS.filter(t => rows[t] && !unavailable(rows[t]));
    ok(lying.length === 0,
       `${label}: all seven rows say unavailable · N/A`
       + (lying.length ? ('\n       ' + lying.map(t => rows[t]).join('\n       ')) : ''));
  }
  const rows = ledger(null, null, null, null);
  ok(TAGS.every(t => rows[t]), 'and all seven rows are still rendered — the panel is not blanked');
  ok(!/risk-on regime|risk-off regime/.test(Object.values(rows).join(' ')),
     'in particular no macro REGIME is named without a ratio to name it from');
  ok(!/FLAT/.test(Object.values(rows).join(' ')),
     'and no trend is called FLAT without a series to measure');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. every feed live — everything is read');
{
  const rows = ledger(
    { dxyOfficial: { value: 103.42, trend20: 'FALLING', change20Pct: -1.8 },
      tnx: 4.21, tnxTrend: 'FALLING', tnxChange20Pct: -3.2, tnxSource: 'FRED DGS10',
      realRateHint: 'TAILWIND', goldSilverRatio: 88.4 },
    { fundingPct: 0.021 }, { latest: { longPct: 64 } },
    { crowding: 'SPEC CROWDED LONG', specNetPctOi: 0.312, reportDate: '2026-09-09' });
  const silent = TAGS.filter(t => unavailable(rows[t]));
  ok(silent.length === 0,
     'all seven rows report their measurement'
     + (silent.length ? (' — these went quiet: ' + silent.join(', ')) : ''));
  ok(/103\.42/.test(rows.M1) && /FALLING/.test(rows.M1) && /FRED DTWEXBGS/.test(rows.M1),
     'M1 names the value, the trend and the FRED series it really came from');
  ok(/4\.21%/.test(rows.M2) && /FRED DGS10/.test(rows.M2), 'M2 prints the yield and its source');
  ok(/TAILWIND/.test(rows.M3), 'M3 prints the real-rate hint');
  ok(/88\.4/.test(rows.M4) && /risk-off regime/.test(rows.M4), 'M4 reads >80 as risk-off');
  ok(/0\.0210%/.test(rows.M5), 'M5 prints the funding rate');
  ok(/64% long/.test(rows.M6) && /contrarian bearish/.test(rows.M6), 'M6 reads retail positioning');
  ok(/SPEC CROWDED LONG/.test(rows.M7) && /31\.2%/.test(rows.M7), 'M7 prints the COT crowding and net/OI');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a real number is never mistaken for an absence');
{
  ok(/64\.2/.test(ledger({ goldSilverRatio: 64.2 }, {}, {}, {}).M4)
     && /risk-on regime/.test(ledger({ goldSilverRatio: 64.2 }, {}, {}, {}).M4),
     'a genuinely low ratio still reads <70 — the branch the bug was faking');
  const zero = ledger({ goldSilverRatio: 0 }, {}, {}, {}).M4;
  ok(!unavailable(zero) && /0\.0/.test(zero),
     'a ratio of exactly 0 is a reading, not an absence — this is the over-correction to avoid');
  ok(/risk-on regime/.test(zero), 'and it is read as <70, because it is');
  const negTrend = ledger({ tnx: 0, tnxTrend: 'FLAT' }, {}, {}, {}).M2;
  ok(!unavailable(negTrend) && /0\.00%/.test(negTrend), 'a yield of 0.00% is likewise a reading');
  const strNum = ledger({ goldSilverRatio: '64.2' }, {}, {}, {}).M4;
  ok(!unavailable(strNum) && /64\.2/.test(strNum), 'and a numeric STRING is read, not discarded');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. nothing in the ledger still guards a feed with a bare isFinite');
{
  const src = stripComments(fs.readFileSync(root + 'goldpro.js', 'utf8'));
  const start = src.indexOf('function renderMacroPanel');
  ok(start > 0, 'renderMacroPanel located in the source');
  const body = src.slice(start, src.indexOf('\nfunction ', start + 10));
  ok(body.length > 500, `and its body is ${body.length} characters, so the slice is real`);
  /* A name is clean if it was itself assigned from gpFin in this body —
     `var gsr = gpFin(...)` then `isFinite(gsr)` is the sanitised form, not a
     hole. The allowance is checked for emptiness below so it cannot quietly
     excuse everything. */
  const sanitised = new Set([...body.matchAll(/var\s+([A-Za-z_$][\w$]*)\s*=\s*gpFin\(/g)].map(m => m[1]));
  ok(sanitised.size > 0,
     `${sanitised.size} local(s) are assigned straight from gpFin (${[...sanitised].join(', ')}), so the allowance below is not vacuous`);
  const bare = [...body.matchAll(/isFinite\(\s*(?!gpFin)([A-Za-z_$][\w$.]*)\s*\)/g)]
    .map(m => m[1]).filter(n => !sanitised.has(n));
  ok(bare.length === 0,
     'every other isFinite in it goes through gpFin'
     + (bare.length ? (' — these do not: ' + bare.join(', ')) : ''));
  ok(/function gpFin/.test(src), 'and gpFin is what rejects null, undefined and the empty string');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the pinned leader names its instrument');
{
  const plan = S.goldProPlan({ dir: 'long', entry: 4322.60, atr: 21.5, swing: 4259 });
  ok(!!plan, 'goldProPlan builds a plan');
  ok(plan.sym === 'XAUUSD', 'and it carries the symbol this desk trades');
  ok(plan.entry === 4322.60 && plan.stop < plan.entry && plan.t1 > plan.entry,
     'with the levels it always had, unchanged');
  const short = S.goldProPlan({ dir: 'short', entry: 4322.60, atr: 21.5, swing: 4400 });
  ok(short && short.sym === 'XAUUSD', 'the short side too');
  /* the fallback this was hitting, read out of the renderer rather than recalled */
  const ui = stripComments(fs.readFileSync(root + 'setup-ui.js', 'utf8'));
  ok(/row\.sym \|\| '\?'/.test(ui),
     'the MOST PROBABLE panel really does fall back to a bare question mark, which is what it was printing');
  const pro = stripComments(fs.readFileSync(root + 'goldpro.js', 'utf8'));
  const pins = [...pro.matchAll(/lvPlan = \{/g)].length;
  ok(pins > 0 && (pro.match(/sym: 'XAUUSD'/g) || []).length >= 2,
     `both plan shapes this desk can pin (${pins} literal + the goldProPlan return) set the symbol`);
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
