/* HARDGATE — gstack-brain.js unit tests (Node 18+, builtins only).
   Loads gstack-brain.js then exercises office-hours, sprint review, row
   enrichment, dashboard, and HTML render helpers. No live network.
   Run: node tests/test-gstack-brain.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok — ' + m); } else { fail++; console.error('  FAIL — ' + m); } }

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'gstack-brain.js', 'utf8'), { filename: 'gstack-brain.js' });
const W = globalThis.window;

function primeRow(){
  return {
    sym: 'BTCUSDT',
    dec: { tier: 'PRIME', dir: 'long', agree: 5, disagree: 0, hasStructural: true, hasPositioning: true, reasons: ['5 layers agree'] },
    col: { votes: [], silent: [], unavailable: [] },
    plan: { dir: 'long', entry: 100, stop: 95, t1: 110, t2: 120, entryType: 'limit', cancelIf: 94, rr1: 2 }
  };
}

console.log('== load + exports ==');
ok(typeof W.gstackOfficeHours === 'function', 'gstackOfficeHours exposed');
ok(typeof W.gstackSprintReview === 'function', 'gstackSprintReview exposed');
ok(typeof W.gstackBrainApplyRows === 'function', 'gstackBrainApplyRows exposed');
ok(Array.isArray(W.GSTACK_ETHOS) && W.GSTACK_ETHOS.length >= 4, 'GSTACK_ETHOS defined');
ok(Array.isArray(W.GSTACK_ROLES) && W.GSTACK_ROLES.length >= 10, 'GSTACK_ROLES mapped');

console.log('== office hours ==');
{
  const oh = W.gstackOfficeHours(primeRow());
  ok(oh.verdict === 'BUILD', 'PRIME row with plan passes office hours');
  ok(oh.passCount >= 5, 'passCount >= 5 for strong row');
  ok(oh.questions.length === 6, 'six forcing questions');
}

console.log('== sprint review + ship gate ==');
{
  const rev = W.gstackSprintReview(primeRow());
  ok(rev.ship && rev.ship.ready === true, 'PRIME + complete plan is ship-ready');
  ok(rev.ceo.mode === 'SELECTIVE EXPANSION', 'CEO scope for PRIME');
  ok(rev.qa.healthAfter >= 70, 'QA health passes');
  ok(rev.classification && Array.isArray(rev.classification.taste), 'classification object');
}

console.log('== apply rows + sovereignty ==');
{
  const rows = [primeRow(), {
    sym: 'ETHUSDT',
    dec: { tier: 'ASIDE', dir: 'long', agree: 1, reasons: ['thin'] },
    col: { votes: [], silent: [], unavailable: ['tape'] },
    plan: null
  }];
  const tierBefore = rows[0].dec.tier;
  const res = W.gstackBrainApplyRows(rows);
  ok(res.enriched === 1, 'only WATCH+ rows enriched');
  ok(res.shipReady === 1, 'one ship-ready row');
  ok(rows[0].dec.tier === tierBefore, 'brain tier unchanged (user sovereignty)');
  ok(rows[0].gstackRecommend === 'SHIP', 'gstackRecommend SHIP');
  ok(!rows[1].gstack, 'ASIDE row skipped');
  ok(W.__hgGstackLast && W.__hgGstackLast.counts.shipReady === 1, '__hgGstackLast dashboard');
}

console.log('== render helpers ==');
{
  const row = primeRow();
  W.gstackBrainEnrichRow(row);
  const mini = W.gstackBrainRenderMini(row);
  ok(mini.indexOf('GSTACK') >= 0, 'mini HTML mentions GSTACK');
  ok(mini.indexOf('SHIP READY') >= 0, 'mini shows ship ready');
  const dash = W.gstackBrainRenderDashboard([row]);
  ok(dash.indexOf('GSTACK BRAIN') >= 0, 'dashboard header');
  ok(dash.indexOf('ship-ready') >= 0, 'dashboard counts ship-ready');
}

console.log('== shell wiring ==');
{
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const idx = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/hg-v249/.test(sw), 'cache hg-v249');
  ok(sw.indexOf('gstack-brain.js') >= 0, 'sw precaches gstack-brain.js');
  ok(/gstack-brain\.js/.test(idx) && /brain\.js/.test(idx)
    && idx.indexOf('src="gstack-brain.js"') < idx.indexOf('src="brain.js"'),
    'index loads gstack-brain.js before brain.js');
  const brain = fs.readFileSync(root + 'brain.js', 'utf8');
  ok(/applyGstackBrain/.test(brain), 'brain.js calls applyGstackBrain');
  ok(/brainGstackWrap/.test(brain), 'brain tab has gstack panel');
  ok(/gstackBrainRenderMini/.test(brain), 'brain card uses gstack mini render');
}

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exit(1);
