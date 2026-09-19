/* HARDGATE — a gold alert does not claim a gate tally the gold desks never kept.

   Every GOLD Telegram push HARDGATE has ever sent ended its row like this:

     🔥 XAUUSD LONG
       Tab/source: GOLD SCALP
       ENTRY: 4,530 · STOP LOSS: 4,520 · TAKE PROFIT 1: 4,560
       lev ~4x · tally +9 · GRADE A LOCK · 3.00R · 7/7 CLEAN

   The last three words were not true, and not sometimes: GOLD SCALP and GOLD
   SWING do not run G1-G7 at all. Section 1 below reads the four gold modules
   and finds ZERO places where any of them puts gatesPassed, clean or clean7
   on a setup row, so no gold row has ever carried a seven-gate tally to
   report. Grade A is a TALLY floor (>= 8 on a different ladder); the desks'
   own standing is `goldConvicted`, which is what actually let the row out.

   collectGold said `clean7: true` unconditionally and then, on the very next
   line, tested honestly whether the row had a gate count before recording
   one — a branch that has never once fired on the live path. The flag bought
   nothing: goldConvicted already carries a gold row through every
   eligibility filter, and hgTabAlertsRunGold does not even apply one
   (cleanOnly:false). Its only consequences were claims:

     - the Telegram row line, above;
     - the batch Signal line, when gold shares a batch with crypto:
       "7/7 gate-clean tickets" over a set where one row kept no gates;
     - the AI AGENT tab, where runGoldSmith copies clean7 onto its finding
       and the card chip reads `f.clean7 ? '7/7 CLEAN' : ...`;
     - and the workforce ranking, where clean7 is worth a flat +100.

   tabalerts.js already had the principle written down, for 80PERCENT:
   "Marking those rows clean7 to get them through would print '7/7 CLEAN'
   beside a gate count that desk does not keep." GOLD is named in that same
   note as the precedent for the honest version. It was not following it.

   The fix splits the two questions that `clean7` had been answering at once.
   setupIsClean7 still answers "may this row go out?" and still says yes to
   gold on goldConvicted — eligibility is unchanged, which section 3 pins.
   The new setupBacksSevenGates answers "can this row BACK a 7/7 claim with a
   gate count it kept?", and that is what the printed strings now read. A
   gold row that did keep a gate count still prints 7/7 CLEAN (section 4);
   so does a crypto CLEAN row (section 5).

   Dropping a false label should not cost a true one, so runGoldSmith now
   carries the row's tier onto the finding: the chip reads GRADE A LOCK or
   MOST PROBABLE, which the desk had already worked out and was burying in
   `note`. Section 6.

   NOT IN SCOPE, and stated because it is the same shape: collectOiflow and
   collectSqueeze SYNTHESISE a gate count — `gatesPassed: clean ? 7 : 6` —
   for two crypto layer desks that do not run seven gates either. Fixing
   those changes which crypto rows clear the 6/7 NEAR floor, which is a
   crypto behaviour change and not this pack's. Section 7 records the two
   sites so the next reader finds them already counted.

   Run: node tests/test-gold-alert-gate-claim.mjs */
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

/* Comments are stripped before every source scan in this file. Three earlier
   packs shipped a false positive because a scanner read the string it was
   hunting for out of the comment that explained the fix. */
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function loadTabAlerts(){
  const s = { module: { exports: {} }, exports: {}, console, Math, JSON, Date, Promise,
              isFinite, parseInt, parseFloat, String, Object, Array, Number, setTimeout };
  s.window = s; s.globalThis = s;
  vm.createContext(s);
  s.localStorage = { getItem: () => null, setItem: () => {} };
  vm.runInContext(fs.readFileSync(root + 'tabalerts.js', 'utf8'), s, { filename: 'tabalerts.js' });
  return s;
}

/* A GOLD SCALP row as the desk actually produces one: locked, grade A,
   tally 9, and no gate stack of any kind. */
const PLAIN = { id: 'g1', sym: 'XAUUSD', dir: 'long', entry: 4530, stop: 4520, t1: 4560,
                rr: 3, tally: 9, grade: 'A', locked: true };
/* The same shape if some future gold desk DID keep a seven-gate count. */
const GATED = { id: 'g2', sym: 'XAUUSD', dir: 'short', entry: 4600, stop: 4612, t1: 4570,
                rr: 2.5, tally: 11, grade: 'A', locked: true,
                clean: true, gatesPassed: 7, gatesTotal: 7 };

function collectGoldRows(sb, rows){
  sb.goldscalpScan = () => ({ setups: rows, bestId: null });
  sb.goldswingScan = () => null;
  return sb.module.exports.hgTabAlertsCollectGold(sb);
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. no gold module keeps a seven-gate count on a setup row');
{
  const GOLD_MODULES = ['goldscalp.js', 'goldswing.js', 'goldind.js', 'gold-best-levels.js'];
  const sites = [];
  let scanned = 0;
  for (const f of GOLD_MODULES){
    const p = root + f;
    if (!fs.existsSync(p)) continue;
    const src = stripComments(fs.readFileSync(p, 'utf8'));
    scanned++;
    for (const m of src.matchAll(/\b(gatesPassed|clean7)\b\s*[:=]/g)) sites.push(f + ' :: ' + m[0]);
    for (const m of src.matchAll(/[{,]\s*clean\s*:/g)) sites.push(f + ' :: ' + m[0].trim());
  }
  ok(scanned === GOLD_MODULES.length, `${scanned} gold modules read (${GOLD_MODULES.join(', ')})`);
  ok(sites.length === 0,
     'none of them sets gatesPassed, clean or clean7 on a row — there is no gate tally to report'
     + (sites.length ? ('\n       ' + sites.join('\n       ')) : ''));
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the two questions are separate functions');
{
  const lib = loadTabAlerts().module.exports;
  ok(typeof lib.setupBacksSevenGates === 'function', 'setupBacksSevenGates is exported');
  ok(typeof lib.setupIsClean7 === 'function', 'setupIsClean7 is still exported');
  const gold = { goldConvicted: true, sym: 'XAUUSD', dir: 'long' };
  ok(lib.setupIsClean7(gold) === true, 'a gold-convicted row is ELIGIBLE');
  ok(lib.setupBacksSevenGates(gold) === false, 'and it does NOT back a seven-gate claim');
  ok(lib.setupBacksSevenGates({ gatesPassed: 7, gatesTotal: 7 }) === true,
     'a row with 7/7 gates does back one');
  ok(lib.setupBacksSevenGates({ passed: 7 }) === true,
     'so does one carrying the older `passed` field');
  ok(lib.setupBacksSevenGates({ gatesPassed: 6, gatesTotal: 7 }) === false, '6/7 does not');
  ok(lib.setupBacksSevenGates({ gatesPassed: 7, gatesTotal: 7, nearClean: true }) === false,
     'a NEAR row never does, whatever its count says');
  ok(lib.setupBacksSevenGates({ gatesPassed: 7, gatesTotal: 7, watch: true }) === false,
     'nor does a watch row');
  ok(lib.setupBacksSevenGates(null) === false, 'and null is not a claim');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the live gold row: claim gone, row unchanged in every other way');
{
  const sb = loadTabAlerts();
  const lib = sb.module.exports;
  const out = collectGoldRows(sb, [PLAIN]);
  ok(out.length === 1, 'the grade-A locked row is collected');
  const r = out[0];
  ok(r.clean7 === false, 'it is not stamped clean7');
  ok(r.goldConvicted === true, 'it still carries the desk standing that lets it out');
  ok(lib.setupIsClean7(r) === true, 'so it is still Telegram-eligible — the push still sends');
  ok(lib.tabAlertsFilterClean7([r]).length === 1,
     'and it still survives the default-on clean-only filter');
  ok(r.gatesPassed === null, 'no gate count was invented for it');

  const body = lib.hgTabAlertsFormat(out);
  ok(body.indexOf('7/7 CLEAN') < 0, 'the push body makes no 7/7 claim anywhere');
  ok(body.indexOf('tally +9') >= 0, 'it still reports the tally it does keep');
  ok(body.indexOf('GRADE A LOCK') >= 0, 'it still reports the grade it does keep');
  ok(body.indexOf('3.00R') >= 0, 'it still reports the R:R');
  ok(body.indexOf('ENTRY: 4,530') >= 0 && body.indexOf('STOP LOSS: 4,520') >= 0
     && body.indexOf('TAKE PROFIT 1: 4,560') >= 0, 'and all three levels are intact');
  ok(body.split('\n')[0].indexOf('GOLD CONVICTION SETUP') >= 0,
     'the header was already honest and is untouched');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a gold row that DID keep a gate count still prints the claim');
{
  const sb = loadTabAlerts();
  const lib = sb.module.exports;
  const out = collectGoldRows(sb, [GATED]);
  ok(out.length === 1, 'collected');
  ok(out[0].clean7 === true, 'clean7 rides with the gate count');
  ok(out[0].gatesPassed === 7 && out[0].gatesTotal === 7, 'and the count is recorded');
  ok(lib.setupBacksSevenGates(out[0]) === true, 'it backs the claim');
  ok(lib.hgTabAlertsFormat(out).indexOf('7/7 CLEAN') >= 0, 'so the push prints 7/7 CLEAN');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. crypto CLEAN rows are untouched, and a mixed batch stops overclaiming');
{
  const sb = loadTabAlerts();
  const lib = sb.module.exports;
  sb.swingScan = () => ({ cands: [{ sym: 'BTCUSD', dir: 'long', entry: 100000, stop: 98000,
                                    t1: 106000, rr: 3, tally: 7 }], bestId: null });
  const all = lib.hgTabAlertsCollect(sb) || [];
  const swing = all.filter(x => x.src.indexOf('SWING') >= 0);
  ok(swing.length === 1, 'a crypto SWING CLEAN row is collected');
  ok(swing[0].clean7 === true && swing[0].gatesPassed === 7,
     'it carries 7/7 because swingTryClean returns 7/7 CLEAN only');
  ok(lib.setupBacksSevenGates(swing[0]) === true, 'so it backs the claim');
  ok(lib.hgTabAlertsFormat(swing).indexOf('7/7 CLEAN') >= 0, 'and still prints it');

  const mixed = collectGoldRows(sb, [PLAIN]).concat(swing);
  ok(mixed.length === 2, 'gold and crypto share one batch (hgAlertGoldSeparate=0)');
  const body = lib.hgTabAlertsFormat(mixed);
  const signal = body.split('\n').filter(l => l.indexOf('Signal:') === 0)[0] || '';
  ok(signal.indexOf('gate-clean') < 0,
     'the batch no longer describes itself as gate-clean tickets — one row kept no gates'
     + '\n       ' + signal);
  const rowLines = body.split('\n').filter(l => l.indexOf('7/7 CLEAN') >= 0);
  ok(rowLines.length === 1, 'exactly one of the two rows prints the claim');
  ok(rowLines[0].indexOf('tally +7') >= 0, 'and it is the crypto one');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the AI AGENT gold card');
{
  async function goldSmithFinding(tier){
    const s = { module: { exports: {} }, exports: {}, console, Math, JSON, Date, Promise,
                isFinite, parseInt, parseFloat, String, Object, Array, Number, setTimeout };
    s.window = s; s.globalThis = s;
    vm.createContext(s);
    s.localStorage = { getItem: () => null, setItem: () => {} };
    vm.runInContext(fs.readFileSync(root + 'tabalerts.js', 'utf8'), s, { filename: 'tabalerts.js' });
    const row = Object.assign({}, PLAIN);
    const scan = { setups: [row], bestId: (tier === 'MOST PROBABLE') ? row.id : null };
    s.goldscalpScan = () => scan;
    s.goldswingScan = () => null;
    s.module = { exports: {} };
    vm.runInContext(fs.readFileSync(root + 'ai-agent.js', 'utf8'), s, { filename: 'ai-agent.js' });
    const res = await s.hgAgentRunOne('gold-smith');
    return (res && res.findings && res.findings[0]) || null;
  }
  /* the chip expression, copied from renderSetupDetailCards in ai-agent.js */
  const chip = f => f.clean7 ? '7/7 CLEAN' : (f.nearClean ? '6/7 NEAR' : (f.tier || 'SETUP'));

  const lock = await goldSmithFinding('GRADE A LOCK');
  ok(!!lock, 'Gold Smith produces a finding from the gold alert rows');
  ok(lock.clean7 === false, 'the finding is not marked clean7');
  ok(lock.goldConvicted === true, 'it keeps the gold standing');
  ok(lock.score === 14, 'and the score gold conviction earns — the highest any finding gets');
  ok(chip(lock) === 'GRADE A LOCK',
     'the card chip reads the grade the desk assigned, not a gate count it never had');

  const mp = await goldSmithFinding('MOST PROBABLE');
  ok(chip(mp) === 'MOST PROBABLE', 'a MOST PROBABLE gold row carries that label onto the card');
  ok(chip(mp) !== 'SETUP' && chip(lock) !== 'SETUP',
     'so neither falls back to the nameless SETUP chip');

  const src = stripComments(fs.readFileSync(root + 'ai-agent.js', 'utf8'));
  const bonus = [...src.matchAll(/clean7\s*\?\s*100\s*:\s*0/g)].length;
  ok(bonus === 4,
     `the +100 clean7 ranking bonus is still there (${bonus} sites: both sides of two sorts, `
     + 'collectSetupsForDisplay and the top-findings rank) — a gold row simply no longer '
     + 'collects it, and keeps its score of 14 instead');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the same shape, left alone on purpose');
{
  const src = stripComments(fs.readFileSync(root + 'tabalerts.js', 'utf8'));
  const synth = [...src.matchAll(/gatesPassed:\s*\w+\s*\?\s*7\s*:\s*6/g)].length;
  ok(synth === 2,
     `collectOiflow and collectSqueeze still synthesise a gate count (${synth} sites) — `
     + 'two crypto layer desks that do not run seven gates either. Out of scope for a gold '
     + 'pack: changing them moves which crypto rows clear the 6/7 NEAR floor.');
  ok(src.indexOf('clean7: true') < 0 || !/goldConvicted:\s*true,\s*\n\s*tier: tier,\s*\n\s*clean7: true/.test(src),
     'and collectGold no longer stamps the flag unconditionally');
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
