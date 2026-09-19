/* HARDGATE — GOLD PINE reads the gold tape the rest of the family reads.

   Four gold desks share one tape. hgGoldUniformTape in gold-catalog.js
   answers LONG / SHORT / unread from the last close against EMA21 and EMA21
   against EMA50, and GOLD SCALP, GOLD SWING, OMNIGOLD and GOLD DIRECTION all
   call it. AGENTS.md states what they do with the answer: a plan pointing the
   other way is stamped AGAINST GOLD TAPE · HELD, and "against-tape shorts are
   never MOST PROBABLE / SETUP ACTIVATED / CONFIRMED COMBINED".

   GOLD PINE never called it. Found by feeding the whole gold family one
   synthetic tape and reading what each of the sixteen tabs renders — on a
   tape reading SHORT, GOLD PINE pinned:

     MOST PROBABLE SETUP · XAUUSD LONG · GOOD 66 · GOLDPINE · LEADER
     This is the ranked leader on GOLDPINE. Levels are the live ticket.
     ENTRY 3671.14 ...

   and on the mirrored bars, a SHORT leader on a tape reading LONG. Not a
   directional bias — there was no tape anywhere in its path, so its leader
   was whatever scored highest. This is the same tab that shipped SEND TO
   TRADE PLAN and ADD TO BOOK with no reward floor until pack 848: it draws
   the leader furniture without running the checks its siblings run.

   Measured against the pre-fix build over three tapes, the same bars:

     unread tape   HEAD 4123 ch  ->  now 4123 ch   byte-identical
     up tape       HEAD pinned SHORT   ->  now pins LONG
     down tape     HEAD pinned LONG (a full LEADER / live-ticket card)
                                       ->  now pins SHORT (a watch row)

   The down-tape case is the one worth reading twice: what the desk had was a
   live ticket pointing the wrong way, and what it has now is a watch row
   pointing the right way. That is a downgrade, and it is the honest one.

   THE VERDICT LIVES IN THE SCAN, not in the paint. runGoldPineScan stamps
   every row and records result.tape, so goldPineScan() hands the same answer
   to anything that reads it; the tab's render just reads it back. Swing rows
   are judged against the 4H leg and scalp rows against the 15m one — the same
   split hgSmcEnrich already uses in that function, and the same leg each
   sibling desk uses for its own half.

   FAIL-OPEN IS THE WHOLE SAFETY PROPERTY and section 5 pins it: an unread
   tape (flat stack, thin stack, fewer than 55 bars, or gold-catalog.js not
   loaded at all) holds nothing, so this can only ever remove a claim and
   never invent one. On a flat tape the desk behaves exactly as it did.

   Run: node tests/test-gold-pine-tape.mjs */
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

/* Comments are stripped before every source scan here. Three packs have
   shipped a false positive because a scanner read the string it was hunting
   for out of the comment that explained the fix — and the comment added to
   goldpine.js by this pack names hgGoldUniformTape five times. */
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

const SCRIPTS = ['indicators.js', 'indicators2.js', 'setup-ui.js', 'gold-catalog.js',
                 'pinemath.js', 'pinegoldmath.js', 'goldind.js', 'gold-best-levels.js',
                 'goldpine.js'];

function boot(opts){
  opts = opts || {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Intl, Promise, Error, TypeError,
              Set, Map, WeakMap, WeakSet, Symbol, Function, Boolean };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){}, querySelector: () => null }),
                 addEventListener(){}, body: null, head: null };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  const files = opts.without ? SCRIPTS.filter(f => f !== opts.without) : SCRIPTS;
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f }); }
    catch (e) { console.error('  (load failed: ' + f + ' :: ' + e.message.slice(0, 80) + ')'); }
  }
  return s;
}

/* Deterministic bars. D below 0.5 drifts up, above 0.5 drifts down, 0.5 is
   flat enough that the EMA stack disagrees with itself and the tape is
   unread — which is the case the fail-open has to survive. */
function bars(n, tfSec, D){
  let p = 4000, q = 7;
  const rnd = () => { q = (q * 1103515245 + 12345) & 0x7fffffff; return q / 0x7fffffff; };
  const T = 1700000000000, o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - D) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T + i * tfSec * 1000, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1200 });
  }
  return o;
}
function feed(D){
  return { rows4h: bars(200, 14400, D), rows15m: bars(200, 900, D),
           rows1h: bars(200, 3600, D), rows1d: bars(200, 86400, D), source: 'gold-spot' };
}

const S = boot();

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the invariant belongs to the family, not to this test');
{
  const WIRED = ['goldscalp.js', 'goldswing.js', 'omnigold.js', 'golddirection.js', 'goldpine.js'];
  const missing = [];
  for (const f of WIRED){
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    if (!/hgGoldUniformTape/.test(src)) missing.push(f);
  }
  ok(missing.length === 0,
     `all ${WIRED.length} gold desks that pin a ranked leader read hgGoldUniformTape`
     + (missing.length ? (' — these do not: ' + missing.join(', ')) : ''));
  const cat = stripComments(fs.readFileSync(root + 'gold-catalog.js', 'utf8'));
  ok(/function hgGoldUniformTape/.test(cat), 'and one function in gold-catalog.js is the single source of that side');
  const pine = stripComments(fs.readFileSync(root + 'goldpine.js', 'utf8'));
  ok(/hgMpPin\('goldpine', mpList/.test(pine),
     'GOLD PINE hands the MOST PROBABLE pin the filtered list, not every ranked row');
  ok(/mpList = gpTapeAligned\(/.test(pine), 'and mpList is what the tape filter returned');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the verdict travels with the scan, per horizon');
{
  for (const [label, D, want] of [['up', 0.40, 'long'], ['down', 0.60, 'short']]){
    const res = S.runGoldPineScan(feed(D), {});
    ok(res && res.tape && res.tape.swing === want && res.tape.scalp === want,
       `a ${label} tape reads ${want} on both legs (4H ${res.tape.swing}, 15m ${res.tape.scalp})`);
    const rows = res.swing.concat(res.scalp);
    ok(rows.length > 0, `the real pine + goldind stack produced ${rows.length} rows to judge`);
    ok(rows.every(r => r.goldTape === want), 'and every one of them carries that verdict');
    const against = rows.filter(r => String(r.dir).toLowerCase() !== want);
    ok(against.length > 0,
       `${against.length} of them point the other way — so the rule below has something to hold`);
  }
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the chip says the same two things the siblings say');
{
  const chip = S.goldPineTapeChipHtml;
  ok(typeof chip === 'function', 'goldPineTapeChipHtml is reachable');
  ok(/WITH GOLD TAPE/.test(chip({ dir: 'long', goldTape: 'long' })), 'agreeing row: WITH GOLD TAPE');
  const held = chip({ dir: 'long', goldTape: 'short' });
  ok(/AGAINST GOLD TAPE/.test(held) && /HELD/.test(held), 'opposing row: AGAINST GOLD TAPE · HELD');
  ok(chip({ dir: 'long', goldTape: '' }) === '', 'unread tape prints no chip at all');
  ok(chip({ dir: '', goldTape: 'long' }) === '', 'nor does a row with no direction');
  ok(chip(null) === '' && chip(undefined) === '', 'and null is not a verdict');
  /* the wording is the siblings', copied rather than invented */
  const sib = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  ok(sib.indexOf('AGAINST GOLD TAPE') >= 0 && sib.indexOf('WITH GOLD TAPE') >= 0,
     'both strings are GOLD SCALP’s own, so the three desks read alike');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. only an aligned row may lead');
{
  const aligned = S.goldPineTapeAligned;
  ok(typeof aligned === 'function', 'goldPineTapeAligned is reachable');
  const L = { id: 'L', dir: 'long', goldTape: 'short' };
  const S1 = { id: 'S1', dir: 'short', goldTape: 'short' };
  const S2 = { id: 'S2', dir: 'short', goldTape: 'short' };
  /* the against-tape row ranked FIRST — the case that was shipping */
  const out = aligned([L, S1, S2]);
  ok(out.length === 2, 'the against-tape row is dropped from the list the pin may choose from');
  ok(out[0] === S1 && out[1] === S2, 'and the survivors keep their ranked order');
  ok(aligned([L]).length === 0, 'a list of nothing but against-tape rows leaves the pin empty');
  ok(aligned([]).length === 0 && aligned(null).length === 0, 'an empty or absent list is not an error');
  ok(aligned([null, S1]).length === 1, 'a hole in the list is skipped, not thrown on');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. an unread tape holds nothing — the fail-open');
{
  const aligned = S.goldPineTapeAligned;
  const rows = [{ id: 'a', dir: 'long', goldTape: '' }, { id: 'b', dir: 'short', goldTape: '' }];
  const out = aligned(rows);
  ok(out.length === rows.length && out[0] === rows[0] && out[1] === rows[1],
     'with no side read, every row is still eligible and the same objects come back');
  ok(aligned([{ dir: 'long' }]).length === 1, 'a row never stamped at all is eligible too');

  const flat = S.runGoldPineScan(feed(0.50), {});
  ok(flat.tape.swing === '' && flat.tape.scalp === '',
     'a flat stack genuinely reads unread on both legs, so this case is real and not hypothetical');
  ok(flat.swing.concat(flat.scalp).length > 0, 'it still produces rows');
  ok(S.goldPineTapeAligned(flat.swing.concat(flat.scalp)).length
       === flat.swing.concat(flat.scalp).length,
     'and every one of them may still lead — the desk behaves exactly as it did');

  /* and with gold-catalog.js absent entirely */
  const bare = boot({ without: 'gold-catalog.js' });
  ok(typeof bare.hgGoldUniformTape !== 'function', 'without gold-catalog.js there is no tape function');
  const res = bare.runGoldPineScan(feed(0.60), {});
  ok(res.tape.swing === '' && res.tape.scalp === '', 'so the scan records no side');
  const all = res.swing.concat(res.scalp);
  ok(all.length > 0 && bare.goldPineTapeAligned(all).length === all.length,
     'and nothing is held — a missing dependency cannot silence this desk');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the desk is not silenced by the rule');
{
  const res = S.runGoldPineScan(feed(0.60), {});
  const all = res.swing.concat(res.scalp);
  const lead = S.goldPineTapeAligned(all);
  ok(lead.length > 0, `${lead.length} of ${all.length} rows may still lead on a short tape`);
  ok(lead.every(r => String(r.dir).toLowerCase() === 'short'), 'and every one of them is short');
  const heldRows = all.filter(r => String(r.dir).toLowerCase() !== 'short');
  ok(heldRows.length > 0, `the ${heldRows.length} held rows are not deleted — they stay in result.swing/scalp`);
  ok(heldRows.every(r => /AGAINST GOLD TAPE/.test(S.goldPineTapeChipHtml(r))),
     'and each one renders its own reason on the card');
  const pine = stripComments(fs.readFileSync(root + 'goldpine.js', 'utf8'));
  ok(/MOST PROBABLE stands empty/.test(pine),
     'when the filter empties the list the panel says why rather than vanishing');
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
