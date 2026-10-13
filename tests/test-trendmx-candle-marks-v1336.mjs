/* hg-v1336 — TREND MATRIX reads candlestick patterns as a confluence layer
 *
 * The pack ships four things:
 *  1. hgCfCandlePatterns exported from goldind.js (window surface).
 *  2. tmCandleRead(rows) in trendtable.combined.js, calling the one home
 *     through typeof guards, with 6-row floor + atr(rows,14) + a strict
 *     finiteness check on atrLast (hg-v948 `+null === 0` trap). Returns the
 *     engine pack or null — never a fabricated empty.
 *  3. tmCandleMarks(r, dir) folds the engine pack into three-state read
 *     marks: pattern:anyFire + pattern:bullMajority + pattern:bearMajority
 *     + pattern:withTrend. The two majority keys agree with each other by
 *     construction (one true ↔ the other false). hg-v989 absent on tie /
 *     no fire — never a guessed false.
 *  4. tmCandleChipHtml(r) renders a visible green/red/dim chip beside the
 *     gate chip in the matrix row. Nothing when the engine never ran.
 *
 * The parts-vs-combined invariant (hg-v1160) is pinned by the harness
 * (test-trendmx-replay-harness §6); this guard asserts that every ship
 * surface this pack adds — the export, the record wiring, the chip paint —
 * is present in BOTH the combined file and the twelve served parts, so a
 * future pack renaming any of them trips here as well as the parity
 * invariant.
 *
 * The hg-v966 doctrine is asserted structurally: no gate module names any
 * `pattern:*` key or calls hgCfCandlePatterns on a reads bag. The ledger's
 * read split is the ONE route this desk has to measuring whether a pattern
 * read separates winners — out of sample.
 *
 * Behavioural mutations driven by this guard:
 *   M1  — tmCandleRead's 6-row floor dropped: a 5-row rising tape produces a
 *         read instead of null.
 *   M2  — tmCandleRead's isFinite guard on atrLast dropped: a tape that
 *         gives +null ATR last reads as 0 and the engine runs on zero ATR.
 *   M3  — tmCandleMarks sets withTrend on a tie: a tie should record NOTHING
 *         on withTrend (hg-v989 three-state).
 *   M4  — tmCandleMarks sets anyFire on 0/0: a quiet bar should not record
 *         anyFire=true.
 *   M5  — tmCandleMarks writes bullMajority on bearVotes>bullVotes: the two
 *         keys must agree with each other by construction.
 *   M6  — tmRecordReads drops the candle fold entirely: no pattern:* key
 *         rides any record.
 *   M7  — The matrix row never calls tmCandleChipHtml(r): the pattern chip
 *         is invisible.
 *   M8  — The row builder forgets to stamp candleReads on the row.
 *   M9  — tmCandleChipHtml returns a bull-colour chip for a bear majority
 *         (crossed colours).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; }
  else { failed++; console.error('  FAIL: ' + label); }
}

console.log('hg-v1336 — TREND MATRIX candlestick pattern confluence');

/* 1. the one home is exported from goldind.js */
{
  const goldind = read('goldind.js');
  ok(/window\.hgCfCandlePatterns\s*=\s*hgCfCandlePatterns/.test(goldind),
     'goldind.js exports window.hgCfCandlePatterns — the one home (hg-v949)');
  ok(/function\s+hgCfCandlePatterns\s*\(\s*rows\s*,\s*atrLast\s*\)/.test(goldind),
     'hgCfCandlePatterns has the (rows, atrLast) signature the engine was written with');
}

/* 2. tmCandleRead carries the 6-row floor and the strict ATR check */
{
  const combined = read('trendtable.combined.js');
  ok(/function\s+tmCandleRead\s*\(\s*rows\s*\)/.test(combined),
     'tmCandleRead(rows) exists in combined');
  const body = combined.slice(combined.indexOf('function tmCandleRead'), combined.indexOf('function tmCandleRead') + 900);
  ok(/rows\.length\s*<\s*6/.test(body), 'tmCandleRead refuses tapes under 6 rows (M1 pin)');
  ok(/typeof\s+W\.hgCfCandlePatterns\s*!==\s*['"]function['"]/.test(body),
     'tmCandleRead typeof-guards the home');
  ok(/typeof\s+atrLast\s*===\s*['"]number['"]/.test(body) &&
     /isFinite\s*\(\s*atrLast\s*\)/.test(body) && /atrLast\s*>\s*0/.test(body),
     'tmCandleRead strict-checks atrLast (number & isFinite & >0) — hg-v948 +null trap (M2 pin)');
}

/* 3. tmCandleMarks shape — asserted by driving the real function on fixtures */
{
  const src = read('trendtable.combined.js');
  const begin = src.indexOf('function tmCandleRead(');
  const end = src.indexOf('function tmRecordReads(');
  const block = src.slice(begin, end);
  const sandbox = {
    W: {},
    atr: () => [1],
    isFinite: Number.isFinite,
    console
  };
  vm.createContext(sandbox);
  try {
    vm.runInContext(block, sandbox);
  } catch (e) {
    console.error('sandbox eval threw:', e.message);
    failed++;
  }
  const { tmCandleMarks } = sandbox;
  ok(typeof tmCandleMarks === 'function', 'tmCandleMarks is lifted and callable');

  /* bull majority long */
  const bullLong = tmCandleMarks({ candleReads: { bullVotes: 2, bearVotes: 0 } }, 'long');
  ok(bullLong['pattern:anyFire'] === true, 'bull>0 sets anyFire');
  ok(bullLong['pattern:bullMajority'] === true, 'bull>bear sets bullMajority=true');
  ok(bullLong['pattern:bearMajority'] === false, 'bull>bear sets bearMajority=false (keys agree)');
  ok(bullLong['pattern:withTrend'] === true, 'bull majority on long: withTrend=true');

  /* bear majority long */
  const bearLong = tmCandleMarks({ candleReads: { bullVotes: 0, bearVotes: 2 } }, 'long');
  ok(bearLong['pattern:bullMajority'] === false && bearLong['pattern:bearMajority'] === true,
     'bear>bull sets bullMajority=false, bearMajority=true');
  ok(bearLong['pattern:withTrend'] === false, 'bear majority on long: withTrend=false');

  /* bull majority short */
  const bullShort = tmCandleMarks({ candleReads: { bullVotes: 2, bearVotes: 0 } }, 'short');
  ok(bullShort['pattern:withTrend'] === false, 'bull majority on short: withTrend=false');

  /* tie: no majority, no withTrend */
  const tie = tmCandleMarks({ candleReads: { bullVotes: 1, bearVotes: 1 } }, 'long');
  ok(tie['pattern:anyFire'] === true, 'tie: anyFire still true (bull+bear>0)');
  ok(!('pattern:bullMajority' in tie) && !('pattern:bearMajority' in tie),
     'tie: majority keys absent (M3/M5 pin)');
  ok(!('pattern:withTrend' in tie),
     'tie: withTrend absent (hg-v989 three-state — M3 pin)');

  /* quiet bar: no fire */
  const quiet = tmCandleMarks({ candleReads: { bullVotes: 0, bearVotes: 0, notes: ['doji'] } }, 'long');
  ok(!('pattern:anyFire' in quiet) && !('pattern:bullMajority' in quiet) &&
     !('pattern:bearMajority' in quiet) && !('pattern:withTrend' in quiet),
     'quiet bar (0/0): no mark set, hg-v989 three-state (M4 pin)');

  /* no candleReads: null output */
  const dark = tmCandleMarks({ candleReads: null }, 'long');
  ok(Object.keys(dark).length === 0, 'null candleReads: no marks (fail-open)');

  /* no direction: majority still recorded, withTrend absent */
  const noDir = tmCandleMarks({ candleReads: { bullVotes: 2, bearVotes: 0 } }, null);
  ok(noDir['pattern:bullMajority'] === true && !('pattern:withTrend' in noDir),
     'no direction: majority is recorded, withTrend absent');
}

/* 4. tmRecordReads folds the candle marks in */
{
  const combined = read('trendtable.combined.js');
  const begin = combined.indexOf('function tmRecordReads(');
  const end = combined.indexOf('function tmTicketClaim(');
  const body = combined.slice(begin, end);
  ok(/var\s+cm\s*=\s*tmCandleMarks\s*\(/.test(body),
     'tmRecordReads calls tmCandleMarks (M6 pin: deleting the call drops every pattern:* mark)');
  ok(/for\s*\(\s*ck\s+in\s+cm\s*\)/.test(body),
     'tmRecordReads folds the cm bag into rd by iteration');
}

/* 5. row builder stamps candleReads on every row at scan time */
{
  const combined = read('trendtable.combined.js');
  const idx = combined.indexOf('var ts = trendScore(r1c, r4c);');
  ok(idx > 0, 'row-builder anchor present');
  const nextObj = combined.indexOf('var row = {', idx);
  const slab = combined.slice(idx, nextObj + 1200);
  ok(/var\s+candleReads\s*=\s*tmCandleRead\s*\(\s*r4c\s*\)/.test(slab),
     'the row builder stamps candleReads from tmCandleRead(r4c) (M8 pin)');
  /* The literal must carry candleReads AS A LIVE PROPERTY. A commented-out
     line (/*candleReads: candleReads*\/) would still match a bare regex, so
     stripping block comments first forces the pin to assert on live code
     only — a mutation that comments the stamp out trips here (M8 pin). */
  const liveSlab = slab.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(/[,{]\s*candleReads:\s*candleReads\s*[,}]/.test(liveSlab),
     'row literal carries live candleReads: candleReads (not commented out — M8 pin)');
}

/* 6. matrix row paints tmCandleChipHtml beside the gate chip */
{
  const combined = read('trendtable.combined.js');
  ok(/tmPostGateChip\(r\)\s*\+\s*tmCandleChipHtml\(r\)/.test(combined),
     'matrix row paints tmPostGateChip(r) + tmCandleChipHtml(r) (M7 pin)');
}

/* 7. tmCandleChipHtml — lifted and driven on fixtures */
{
  const src = read('trendtable.combined.js');
  /* tmCandleChipHtml sits beside tmVolDivChipHtml above tmBarOpenSec. Lift
     the chip's definition into a sandbox that provides escH. */
  const begin = src.indexOf('function tmCandleChipHtml(');
  const end = src.indexOf('function tmBarOpenSec(');
  const block = src.slice(begin, end);
  const sandbox = {
    escH: s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
    isFinite: Number.isFinite
  };
  vm.createContext(sandbox);
  vm.runInContext(block, sandbox);
  const { tmCandleChipHtml } = sandbox;

  /* no candleReads: empty chip */
  ok(tmCandleChipHtml({}) === '', 'no candleReads → empty (not even a dim chip; engine never ran)');
  ok(tmCandleChipHtml({ candleReads: null }) === '', 'null candleReads → empty');

  /* bull majority: ok class, BULL head */
  const bull = tmCandleChipHtml({ candleReads: { bullVotes: 2, bearVotes: 0, bullNames: ['hammer', 'piercing'], bearNames: [] } });
  ok(/gpip ok/.test(bull) && /BULL/.test(bull) && /hammer/.test(bull),
     'bull majority chip has gpip ok class and names the pattern (M9 pin: bear majority → bad class)');

  /* bear majority: bad class, BEAR head */
  const bear = tmCandleChipHtml({ candleReads: { bullVotes: 0, bearVotes: 2, bullNames: [], bearNames: ['shooting star'] } });
  ok(/gpip bad/.test(bear) && /BEAR/.test(bear) && /shooting star/.test(bear),
     'bear majority chip has gpip bad class');

  /* tie: dim PATTERN · tie */
  const tie = tmCandleChipHtml({ candleReads: { bullVotes: 1, bearVotes: 1, bullNames: ['a'], bearNames: ['b'] } });
  ok(/PATTERN · tie/.test(tie), 'tie chip reads PATTERN · tie');

  /* quiet with notes: PATTERN · no vote */
  const quiet = tmCandleChipHtml({ candleReads: { bullVotes: 0, bearVotes: 0, notes: ['doji'] } });
  ok(/PATTERN · no vote/.test(quiet) && /doji/.test(quiet),
     'quiet-with-note chip reads PATTERN · no vote and names the note');
}

/* 8. the exports are present in combined AND parts (parts-vs-combined invariant
      — the hg-v1160 harness pins their byte identity; this guard pins the
      specific export surfaces exist in both). */
{
  const combined = read('trendtable.combined.js');
  let joined = '';
  for (let i = 0; i < 12; i++) joined += read('trendtable-src-' + i + '.js');
  for (const sym of ['tmCandleRead', 'tmCandleMarks', 'tmCandleChipHtml']){
    ok(new RegExp('W\\.' + sym + '\\s*=\\s*' + sym).test(combined),
       `combined exports W.${sym}`);
    ok(new RegExp('W\\.' + sym + '\\s*=\\s*' + sym).test(joined),
       `parts carry W.${sym}`);
  }
}

/* 9. no gate module reads any pattern:* key or calls hgCfCandlePatterns —
      hg-v966 refuses an unmeasured gate on this desk. */
{
  const gates = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
                 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js', 'hg-forward.js'];
  const keys = ['pattern:bullMajority', 'pattern:bearMajority', 'pattern:withTrend', 'pattern:anyFire'];
  let gateReads = 0;
  for (const g of gates){
    let txt = '';
    try { txt = read(g); } catch(e) { continue; }
    /* comments stripped so a comment NAMING a mark doesn't count as a read */
    const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/hgCfCandlePatterns/.test(stripped)) {
      gateReads++;
      console.error('    unexpected read of hgCfCandlePatterns in ' + g);
    }
    for (const k of keys){
      if (new RegExp("['\"]" + k.replace(':', ':') + "['\"]").test(stripped)){
        gateReads++;
        console.error('    unexpected read of ' + k + ' in ' + g);
      }
    }
  }
  ok(gateReads === 0, 'no gate module names any pattern:* key or calls hgCfCandlePatterns (hg-v966)');
}

/* 10. ship stamps */
{
  ok(HG_VER === 'hg-v1336', 'build-stamp.js is hg-v1336');
  ok(read('sw.js').includes("HG_CACHE = 'hg-v1336'"), 'sw.js HG_CACHE is hg-v1336');
  ok(read('trendtable.js').includes('v=1336'), 'trendtable.js cache-buster is 1336');
  ok(read('hg-api-base.js').includes("'1336'"), 'hg-api-base.js data-v is 1336');
}

console.log(`\n${passed} passed · ${failed} failed`);
if (failed) process.exit(1);
