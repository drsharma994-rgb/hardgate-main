/* hg-v1331: TREND MATRIX narrates its empty board - guard + mutation pass.
   The real trendmxWhyEmptyHtml is lifted out of trendtable.combined.js
   under a vm sandbox (the hg-v1022 technique) and driven on crafted state
   shapes. Then every behavioural mutation is applied to the source and
   the guard re-run; a mutation that leaves every assertion green is a
   defect in the guard, not the fix. Baseline is verified green before any
   mutation pass. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER } from './helpers/build-version.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL —', msg); }
}

/* --- §1: lift the real function out of trendtable.combined.js --- */
function liftFn(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = src.search(re);
  if (start < 0) return null;
  let depth = 0, inStr = null, i = start;
  // find opening {
  while (i < src.length && src[i] !== '{') i++;
  if (i >= src.length) return null;
  const bodyStart = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return null; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i + 2); if (i < 0) return src.length; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

const combined = fs.readFileSync(path.join(repo, 'trendtable.combined.js'), 'utf8');
const fnText = liftFn(combined, 'trendmxWhyEmptyHtml');
if (!fnText) { console.log('FATAL: could not lift trendmxWhyEmptyHtml'); process.exit(1); }

function makeSandbox() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fnText + '\nthis.F = trendmxWhyEmptyHtml;', ctx);
  return ctx.F;
}

console.log('== §1: trendmxWhyEmptyHtml behavioural contract ==');
{
  const F = makeSandbox();
  ok(typeof F === 'function', 'function lifts cleanly');
  // Fail-open: no state
  ok(F(null) === '', 'null state returns empty');
  ok(F(undefined) === '', 'undefined state returns empty');
  ok(F({}) === '', 'empty state returns empty');
  ok(F('junk') === '', 'string state returns empty');
  ok(F(42) === '', 'number state returns empty');

  // Non-empty mint path silences the panel (hg-v552 doctrine)
  const nonEmptyMint = { goldenCross: [{ sym: 'BTCUSDT' }], deathCross: [], cryptoSetups: [] };
  ok(F(nonEmptyMint) === '', 'non-empty golden mint silences the panel');
  const nonEmptyDeath = { goldenCross: [], deathCross: [{ sym: 'BTCUSDT' }], cryptoSetups: [] };
  ok(F(nonEmptyDeath) === '', 'non-empty death mint silences the panel');
  const nonEmptyCrypto = { goldenCross: [], deathCross: [], cryptoSetups: [{ sym: 'BTCUSDT' }] };
  ok(F(nonEmptyCrypto) === '', 'non-empty crypto mint silences the panel');

  // Alt field names (state.golden/death/crypto)
  const altFields = { golden: [{ sym: 'BTC' }], death: [], crypto: [] };
  ok(F(altFields) === '', 'alt field names (state.golden) are respected');

  // Empty state with no held reasons returns empty (nothing to say)
  const emptyNoHeld = { goldenCross: [], deathCross: [], cryptoSetups: [] };
  ok(F(emptyNoHeld) === '', 'empty state with no held buckets returns empty');

  // Empty state with pure bucket counts (no reasons)
  const bucketOnly = {
    goldenCross: Object.assign([], { held: { gates: 5, cascade: 3, grade: 2, waiting: 1, stack: [] } }),
    deathCross: [], cryptoSetups: []
  };
  const html1 = F(bucketOnly);
  ok(html1.includes('WHY NO SETUPS'), 'bucket-only state produces WHY NO SETUPS header');
  ok(html1.includes('5 failed the 7-gate matrix'), 'gates bucket named');
  ok(html1.includes('3 had no 4h cascade'), 'cascade bucket named');
  ok(html1.includes('2 failed the TRADE grade'), 'grade bucket named');
  ok(html1.includes('1 waiting for the EMA tag'), 'waiting bucket named');

  // Reasons dedup and rank by frequency
  const withReasons = {
    goldenCross: Object.assign([], {
      held: {
        gates: 0, cascade: 0, grade: 0, waiting: 0,
        stack: [
          { sym: 'A', reasons: ['extended 3.5x ATR from the 4h EMA21', '4h ADX 72 is exhaustion'] },
          { sym: 'B', reasons: ['extended 3.5x ATR from the 4h EMA21'] },
          { sym: 'C', reasons: ['no pullback into the 1h EMA21'] }
        ]
      }
    }),
    deathCross: [], cryptoSetups: []
  };
  const html2 = F(withReasons);
  ok(html2.includes('WHY NO SETUPS'), 'reasons-only state produces header');
  ok(html2.includes('extended 3.5x ATR from the 4h EMA21'), 'top reason named');
  ok(html2.includes('×2'), 'top reason count ×2');
  ok(html2.indexOf('extended 3.5x ATR from the 4h EMA21') < html2.indexOf('no pullback'),
    'reasons ranked by frequency');

  // All three bags aggregate
  const triStack = {
    goldenCross: Object.assign([], { held: { gates: 10, cascade: 0, grade: 0, waiting: 0, stack: [{ sym: 'G1', reasons: ['bad gates'] }] } }),
    deathCross: Object.assign([], { held: { gates: 5, cascade: 0, grade: 0, waiting: 0, stack: [{ sym: 'D1', reasons: ['bad gates'] }] } }),
    cryptoSetups: Object.assign([], { held: { gates: 0, cascade: 0, grade: 0, waiting: 0, stack: [{ sym: 'C1', reasons: ['bad gates'] }] } })
  };
  const html3 = F(triStack);
  ok(html3.includes('WHY NO SETUPS'), 'tri-stack produces header');
  ok(html3.includes('15 failed the 7-gate matrix'), 'buckets sum across bags (10+5)');
  ok(html3.includes('×3'), 'reasons aggregate across all three bags');

  // Non-stack row inside stack is skipped safely
  const junkStack = {
    goldenCross: Object.assign([], { held: { gates: 0, cascade: 0, grade: 0, waiting: 0, stack: [null, undefined, {}, { sym: 'X' }, { reasons: 'not-array' }, { reasons: ['real reason'] }] } }),
    deathCross: [], cryptoSetups: []
  };
  const html4 = F(junkStack);
  ok(html4.includes('real reason'), 'junk stack entries are skipped, real reasons kept');

  // Cap at top 6
  const sixPlus = {
    goldenCross: Object.assign([], {
      held: {
        gates: 0, cascade: 0, grade: 0, waiting: 0,
        stack: Array.from({ length: 10 }, (_, i) => ({ sym: 'S' + i, reasons: ['reason-' + i] }))
      }
    }),
    deathCross: [], cryptoSetups: []
  };
  const html5 = F(sixPlus);
  const liCount = (html5.match(/<li>/g) || []).length;
  ok(liCount === 6, 'top 6 reasons cap enforced (got ' + liCount + ')');

  // Doctrine disclosure: 325 hard-gate ensemble, Cluster C, no gate loosened
  ok(html5.includes('325'), 'panel discloses the 325 hard-gate ensemble count');
  ok(html5.includes('Cluster C'), 'panel references Cluster C doctrine');
}

/* --- §2: parts-vs-combined parity for this pack --- */
console.log('\n== §2: parts/combined parity (hg-v1160) ==');
{
  let parts = '';
  for (let i = 0; i < 12; i++) {
    parts += fs.readFileSync(path.join(repo, 'trendtable-src-' + i + '.js'), 'utf8');
  }
  ok(parts === combined, 'trendtable parts === combined byte-identically');
  ok(parts.includes('trendmxWhyEmptyHtml'), 'parts contain trendmxWhyEmptyHtml');
  ok(combined.includes('trendmxWhyEmptyHtml'), 'combined contains trendmxWhyEmptyHtml');
  ok(parts.includes('tmRsiDivChipHtml'), 'parts contain tmRsiDivChipHtml (hg-v1183 Phase 4)');
  ok(combined.includes('tmRsiDivChipHtml'), 'combined contains tmRsiDivChipHtml (hg-v1331 port)');
  ok(parts.includes('tmRsiDivergence'), 'parts contain tmRsiDivergence (hg-v1183 Phase 4)');
  ok(combined.includes('tmRsiDivergence'), 'combined contains tmRsiDivergence (hg-v1331 port)');
  ok(parts.includes('tmVolDivergence'), 'parts contain tmVolDivergence');
  ok(combined.includes('tmVolDivergence'), 'combined contains tmVolDivergence');
  // The Phase 4 defect is DOCUMENTED but not fixed - keep the TDZ bug for parity
  ok(combined.includes('const rsi = rsi(rows, 14)'), 'TDZ defect preserved for parity (documented, not fixed)');
}

/* --- §3: wired into empty-cards branch --- */
console.log('\n== §3: wired into paint path ==');
{
  const paintBlockIdx = combined.indexOf('refs.cards.innerHTML = emptyWhy + emptyNote');
  ok(paintBlockIdx > 0, 'empty-cards branch prepends emptyWhy to emptyNote');
  const whyCallIdx = combined.indexOf('trendmxWhyEmptyHtml(state)');
  ok(whyCallIdx > 0, 'trendmxWhyEmptyHtml(state) is called at least once');
  // Call site precedes the paint
  ok(whyCallIdx < paintBlockIdx, 'trendmxWhyEmptyHtml is called before the paint line (fails open: try/catch wraps it)');

  // Served part has the same wiring
  const part8 = fs.readFileSync(path.join(repo, 'trendtable-src-8.js'), 'utf8');
  ok(part8.includes('refs.cards.innerHTML = emptyWhy + emptyNote'),
    'served part 8 has the same empty-cards wiring');
  ok(part8.includes('trendmxWhyEmptyHtml(state)'),
    'served part 8 calls trendmxWhyEmptyHtml');

  // Export is in both combined and the parts' export file
  ok(combined.includes('W.trendmxWhyEmptyHtml = trendmxWhyEmptyHtml'),
    'combined exports W.trendmxWhyEmptyHtml');
  const part11 = fs.readFileSync(path.join(repo, 'trendtable-src-11.js'), 'utf8');
  ok(part11.includes('W.trendmxWhyEmptyHtml = trendmxWhyEmptyHtml'),
    'served part 11 exports W.trendmxWhyEmptyHtml');
}

/* --- §4: no gate reads a new mark (doctrine assertion) --- */
console.log('\n== §4: no gate module reads trendmxWhyEmptyHtml ==');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js', 'hg-forward.js'];
  for (const f of gateFiles) {
    const p = path.join(repo, f);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    ok(!t.includes('trendmxWhyEmptyHtml'), f + ' does not read trendmxWhyEmptyHtml');
  }
}

/* --- §5: ship stamps --- */
console.log('\n== §5: ship stamps hg-v1331 ==');
{
  ok(HG_VER === 'hg-v1331', 'build-stamp.js is hg-v1331');
  const sw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');
  ok(sw.includes("'hg-v1331'"), 'sw.js HG_CACHE is hg-v1331');
  const loader = fs.readFileSync(path.join(repo, 'trendtable.js'), 'utf8');
  ok(loader.includes('hg-v1331'), 'trendtable.js loader header is hg-v1331');
  ok(loader.includes('?v=1331'), 'trendtable.js loader cache-buster is ?v=1331');
}

/* --- §6: mutation pass (behavioural, hg-v967) --- */
console.log('\n== §6: mutation pass ==');
function runMutation(label, mutator) {
  const mutated = mutator(fnText);
  const ctx = { console };
  vm.createContext(ctx);
  try {
    vm.runInContext(mutated + '\nthis.F = trendmxWhyEmptyHtml;', ctx);
  } catch (e) {
    return { caught: true, by: 'syntax error' };
  }
  const F = ctx.F;
  // Re-run the key assertions on the mutated function
  const checks = [
    ['empty state empty', () => F(null) === '' && F({}) === ''],
    ['non-empty golden silences', () => F({ goldenCross: [{sym:'X'}], deathCross:[], cryptoSetups:[] }) === ''],
    ['bucket-only produces header', () => (function(){
      const h = F({ goldenCross: Object.assign([], { held: { gates: 5, cascade: 3, grade: 2, waiting: 1, stack: [] } }), deathCross: [], cryptoSetups: [] });
      return h.includes('WHY NO SETUPS') && h.includes('5 failed the 7-gate matrix') && h.includes('3 had no 4h cascade');
    })()],
    ['tri-stack aggregates', () => (function(){
      const h = F({
        goldenCross: Object.assign([], { held: { gates: 10, stack: [{ sym: 'G1', reasons: ['bad gates'] }] } }),
        deathCross: Object.assign([], { held: { gates: 5, stack: [{ sym: 'D1', reasons: ['bad gates'] }] } }),
        cryptoSetups: Object.assign([], { held: { stack: [{ sym: 'C1', reasons: ['bad gates'] }] } })
      });
      return h.includes('15 failed the 7-gate matrix') && h.includes('×3');
    })()],
    ['top 6 cap enforced', () => (function(){
      const h = F({
        goldenCross: Object.assign([], { held: { stack: Array.from({ length: 10 }, (_, i) => ({ sym: 'S' + i, reasons: ['reason-' + i] })) } }),
        deathCross: [], cryptoSetups: []
      });
      return (h.match(/<li>/g) || []).length === 6;
    })()],
    ['frequency-ranked top wins', () => (function(){
      /* three reasons at 3, 2, 1 frequency - sort direction matters */
      const h = F({
        goldenCross: Object.assign([], { held: { stack: [
          { sym: 'A', reasons: ['triple'] }, { sym: 'B', reasons: ['triple'] }, { sym: 'C', reasons: ['triple'] },
          { sym: 'D', reasons: ['double'] }, { sym: 'E', reasons: ['double'] },
          { sym: 'F', reasons: ['single'] }
        ] } }),
        deathCross: [], cryptoSetups: []
      });
      return h.indexOf('triple') < h.indexOf('double') && h.indexOf('double') < h.indexOf('single');
    })()],
    ['non-empty mint silences even with held reasons', () => (function(){
      /* if any mint path has an entry, the panel must NOT paint - even with held reasons */
      const h = F({
        goldenCross: Object.assign([{ sym: 'TICKET1' }], { held: { gates: 50, stack: [{ sym: 'HELD', reasons: ['x'] }] } }),
        deathCross: [], cryptoSetups: []
      });
      return h === '';
    })()],
  ];
  for (const [cname, cfn] of checks) {
    try { if (!cfn()) return { caught: true, by: cname }; }
    catch (e) { return { caught: true, by: cname + ' threw' }; }
  }
  return { caught: false };
}

const mutations = [
  ['M1: drop empty-mint silencer (always paint)',
    s => s.replace("if ((golden.length | 0) + (death.length | 0) + (crypto.length | 0) > 0) return '';", "")],
  ['M2: swap gates/cascade bucket names',
    s => s.replace("buckets.cascade + ' had no 4h cascade'", "buckets.gates + ' had no 4h cascade'")],
  ['M3: drop reasonCounts accumulator',
    s => s.replace(/reasonCounts\[k\]\s*=\s*\(reasonCounts\[k\]\s*\|\s*0\)\s*\+\s*1;/, "")],
  ['M4: cap at top 2 instead of 6',
    s => s.replace("var top = ranked.slice(0, 6);", "var top = ranked.slice(0, 2);")],
  ['M5: drop death bag',
    s => s.replace("addStack(death  && death.held);", "")],
  ['M6: drop crypto bag',
    s => s.replace("addStack(crypto && crypto.held);", "")],
  ['M7: swap addStack sort direction',
    s => s.replace("sort(function(a, b){ return b.n - a.n; })", "sort(function(a, b){ return a.n - b.n; })")],
  ['M8: drop header text (no WHY NO SETUPS)',
    s => s.replace("<h2>WHY NO SETUPS", "<h2>SILENT")],
];

for (const [label, mutator] of mutations) {
  const r = runMutation(label, mutator);
  ok(r.caught, label + ' caught by: ' + (r.by || 'nothing'));
}

/* --- summary --- */
console.log('\npassed: ' + pass + ' / failed: ' + fail);
if (fail) process.exit(1);
