/* v688: Kind Performance Panel for omniroute + omnigold.

   Why. The forward log has been recording outcomes since v680. G6
   (v685) vetoes measured losers, G7 (v687) promotes measured winners.
   But the raw evidence — which kinds are actually winning, which are
   actually losing — has never been shown to the user directly. They
   have to trust that the veto/promotion is working without seeing the
   underlying data.

   New hg-perf-panel.js renders a compact panel per tab: top 5 winning
   kinds and top 5 losing kinds, each row showing sample count / hit
   rate / expR. Reads only from hgFwdPool() and hgFwdStats(); adds no
   new scans, no new writes, no ranking changes.

   Wired into:
     * omniroute MP section (right before </section>)
     * omnigold MP section (per horizon: OMNIGOLD:SCALP + OMNIGOLD:SWING)
   Skipped for reversalsniper — it already has the full-table forward
   panel via hgFwdPanelHTML at #rsFwd from an earlier ship. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- 1. helper file exists + expected shape --- */
const src = readFileSync(resolve(ROOT, 'hg-perf-panel.js'), 'utf8');
assert.ok(/HG_PERF_PANEL_VERSION = 'v688'/.test(src), 'version stamp v688');
assert.ok(/function hgPerfGradeKind\(stats\)/.test(src), 'grader defined');
assert.ok(/function hgPerfRows\(tab\)/.test(src), 'rows fetcher defined');
assert.ok(/function hgPerfSummary\(tab\)/.test(src), 'summary fetcher defined');
assert.ok(/function hgPerfRowHtml\(row\)/.test(src), 'row renderer defined');
assert.ok(/function hgPerfPanelHtml\(tab, opts\)/.test(src), 'panel renderer defined');
assert.ok(/HG_PERF_MIN_SAMPLES = 20/.test(src), 'sample threshold 20');
assert.ok(/HG_PERF_TOP_N = 5/.test(src), 'top N = 5');
assert.ok(/HG_PERF_EDGE_PRIME = 0\.5/.test(src), 'prime floor 0.5');
assert.ok(/HG_PERF_EDGE_FLOOR = -0\.25/.test(src), 'veto floor -0.25');

/* --- 2. loads via index.html AFTER hg-forward.js (so hgFwdPool exists) --- */
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const posFwd = idx.indexOf('hg-forward.js');
const posPerf = idx.indexOf('hg-perf-panel.js');
assert.ok(posPerf > 0, 'hg-perf-panel.js loaded');
assert.ok(posPerf > posFwd, 'perf panel loads AFTER hg-forward.js');

/* --- 3. omniroute wires the panel into its MP section --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
assert.ok(/v688: kind performance panel/.test(omniroute),
  'omniroute has v688 wire comment');
assert.ok(/Wp\.hgPerfPanelHtml\('OMNIROUTE'/.test(omniroute),
  'omniroute calls hgPerfPanelHtml with OMNIROUTE tab');

/* --- 4. omnigold wires per-horizon panels --- */
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
assert.ok(/v688: kind performance panels per horizon/.test(omnigold),
  'omnigold has v688 wire comment');
assert.ok(/Wp\.hgPerfPanelHtml\('OMNIGOLD:SCALP'/.test(omnigold),
  'omnigold calls hgPerfPanelHtml with OMNIGOLD:SCALP');
assert.ok(/Wp\.hgPerfPanelHtml\('OMNIGOLD:SWING'/.test(omnigold),
  'omnigold calls hgPerfPanelHtml with OMNIGOLD:SWING');

/* --- 5. runtime: eval helper with a mock forward log --- */
const fakeG = {};
fakeG.hgFwdPool = function(tab){
  if (tab === 'OMNIROUTE') {
    return {
      /* winners */
      'FVG': { samples: 40, hit: 0.72, expR: 0.85 },
      'OB':  { samples: 30, hit: 0.65, expR: 0.42 },
      /* losers */
      'MSS-LONG': { samples: 47, hit: 0.35, expR: -0.31 },
      /* thin */
      'THIN-KIND': { samples: 8, hit: 0.5, expR: 0.1 }
    };
  }
  return {};
};
const buildFn = new Function('window', `
  var globalThis = window;
  ${src}
  return window;
`);
const api = buildFn(fakeG);
assert.equal(typeof api.hgPerfPanelHtml, 'function');
assert.equal(api.HG_PERF_PANEL_VERSION, 'v688');

/* --- Case A: grading a mechanic --- */
{
  assert.equal(api.hgPerfGradeKind({ samples: 40, expR: 0.85 }).label, 'PRIME');
  assert.equal(api.hgPerfGradeKind({ samples: 40, expR: 0.3 }).label, 'SOLID');
  assert.equal(api.hgPerfGradeKind({ samples: 40, expR: -0.1 }).label, 'MIXED');
  assert.equal(api.hgPerfGradeKind({ samples: 40, expR: -0.5 }).label, 'LOSER');
  assert.equal(api.hgPerfGradeKind({ samples: 8, expR: 0.85 }).label, 'THIN');
  assert.equal(api.hgPerfGradeKind({ samples: 0, expR: 0 }).label, 'THIN');
  assert.equal(api.hgPerfGradeKind(null).label, 'THIN');
}

/* --- Case B: rows sorted with sample-eligible first --- */
{
  const rows = api.hgPerfRows('OMNIROUTE');
  assert.equal(rows.length, 4);
  /* Sample-eligible (samples>=20) first, sorted by expR desc.
     FVG (0.85) > OB (0.42) > MSS-LONG (-0.31). Then THIN-KIND (< 20). */
  assert.equal(rows[0].kind, 'FVG');
  assert.equal(rows[1].kind, 'OB');
  assert.equal(rows[2].kind, 'MSS-LONG');
  assert.equal(rows[3].kind, 'THIN-KIND');
}

/* --- Case C: summary buckets winners and losers correctly --- */
{
  const sum = api.hgPerfSummary('OMNIROUTE');
  assert.equal(sum.totalKinds, 4);
  assert.equal(sum.eligibleKinds, 3, 'THIN-KIND excluded from eligible');
  assert.equal(sum.winners.length, 2, 'FVG + OB');
  assert.deepEqual(sum.winners.map(r => r.kind), ['FVG', 'OB']);
  assert.equal(sum.losers.length, 1, 'only MSS-LONG loses');
  assert.equal(sum.losers[0].kind, 'MSS-LONG');
  assert.equal(sum.minSamples, 20);
}

/* --- Case D: panel HTML renders winners + losers + subtitle --- */
{
  const html = api.hgPerfPanelHtml('OMNIROUTE');
  assert.ok(/KIND PERFORMANCE.*OMNIROUTE/.test(html), 'title present');
  assert.ok(/TOP WINNERS/.test(html), 'winners header');
  assert.ok(/TOP LOSERS/.test(html), 'losers header');
  assert.ok(/FVG/.test(html), 'FVG in winners');
  assert.ok(/OB/.test(html), 'OB in winners');
  assert.ok(/MSS-LONG/.test(html), 'MSS-LONG in losers');
  assert.ok(/PRIME/.test(html), 'PRIME chip for top winner');
  assert.ok(/LOSER/.test(html), 'LOSER chip for MSS-LONG');
  assert.ok(/measured over 3\/4 kinds/.test(html), 'subtitle counts');
}

/* --- Case E: empty pool -> empty-state message --- */
{
  const html = api.hgPerfPanelHtml('EMPTY_TAB');
  assert.ok(/No kinds have reached 20 recorded outcomes/.test(html),
    'empty-state message when no eligible kinds');
}

/* --- Case F: missing hgFwdPool -> empty rows, empty panel gracefully --- */
{
  const noPoolG = {};
  const noPoolApi = new Function('window', `
    var globalThis = window;
    ${src}
    return window;
  `)(noPoolG);
  const rows = noPoolApi.hgPerfRows('OMNIROUTE');
  assert.deepEqual(rows, []);
  const html = noPoolApi.hgPerfPanelHtml('OMNIROUTE');
  /* Empty-state still renders (no crash) */
  assert.ok(/No kinds have reached/.test(html));
}

/* --- Case G: hgFwdPool throws -> graceful empty --- */
{
  const throwG = { hgFwdPool: function(){ throw new Error('boom'); } };
  const throwApi = new Function('window', `
    var globalThis = window;
    ${src}
    return window;
  `)(throwG);
  const rows = throwApi.hgPerfRows('OMNIROUTE');
  assert.deepEqual(rows, [], 'error contained -> empty rows');
}

/* --- Case H: HTML escaping in kind names --- */
{
  const escG = {
    hgFwdPool: function(){
      return { '<script>alert(1)</script>': { samples: 30, hit: 0.5, expR: 0.3 } };
    }
  };
  const escApi = new Function('window', `
    var globalThis = window;
    ${src}
    return window;
  `)(escG);
  const html = escApi.hgPerfPanelHtml('OMNIROUTE');
  assert.ok(!/<script>alert/.test(html), 'raw <script> not injected');
  assert.ok(/&lt;script&gt;/.test(html), 'kind name is escaped');
}

/* --- Case I: hit rate and expR display formatting --- */
{
  const rowHtml = api.hgPerfRowHtml({
    kind: 'FVG',
    stats: { samples: 40, hit: 0.725, expR: 0.856 },
    grade: { label: 'PRIME', cls: 'ok' }
  });
  assert.ok(/n=40/.test(rowHtml), 'samples shown');
  assert.ok(/72%|73%/.test(rowHtml), 'hit rate rounded to percent');
  assert.ok(/\+0\.86R/.test(rowHtml), 'expR with sign, 2 decimals');
  assert.ok(/gpip ok/.test(rowHtml), 'PRIME uses ok class');
}

/* --- 6. version + cache-buster --- */
assert.ok(/^hg-v(?:688|689|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v688',
  'HG_VER must be >= hg-v688');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('hg-perf-panel\\.js\\?v=' + qv).test(idx),
  'index.html hg-perf-panel.js cache-buster must be ?v=' + qv);

console.log('OK - v688: Kind Performance Panel for omniroute + omnigold');
console.log('  * A: grade buckets (PRIME/SOLID/MIXED/LOSER/THIN)');
console.log('  * B: rows sorted eligible-first by expR desc');
console.log('  * C: summary buckets winners/losers correctly');
console.log('  * D: panel HTML has winners, losers, subtitle');
console.log('  * E: empty pool -> empty-state message');
console.log('  * F: missing hgFwdPool -> graceful empty');
console.log('  * G: hgFwdPool throws -> error contained');
console.log('  * H: HTML escaping in kind names');
console.log('  * I: hit rate + expR formatting');
console.log('  * version bumped to ' + HG_VER);
