/* HARDGATE — every tab that publishes a PENDING plan asks the geometry
   question, and the ones that do not are named.

   v750's commit message said "every desk in the book". It was not true: a
   per-tab audit found four tabs still publishing ENTRY / STOP / T1 with no
   verdict — OPTI GOLD (whose every ticket is a resting limit, so a retest
   by construction), COMBI, SETUP CONFIRM and DEX SCREENER. The claim was
   made from a per-FILE count, which is not the same thing as a per-TAB
   one, and nothing in the suite could tell the difference.

   This test is that difference. It walks HG_NAV_GROUPS — the definitive
   tab list — resolves each tab id to the module that registers it, and
   requires every tab that renders a plan to reach the rule either directly
   or through a shared renderer.

   THE EXCLUSION LIST BELOW IS THE POINT. A tab may only sit out if it is
   retrospective: a record of what was already taken or already settled.
   "The target is behind price" on a filled position is called profit. Any
   tab not on that list, and not obviously plan-free, fails this test —
   which is what should have happened before that commit message was
   written.

   Run: node tests/test-geometry-tab-coverage.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

/* Tabs that publish levels but are RECORDS, not pending plans. Each entry
   carries the reason, because a bare list rots into a place to hide a tab
   somebody could not be bothered to wire. */
const RETROSPECTIVE = {
  book:      'the paper book — positions already taken, not orders waiting to fill',
  signallog: 'a journal of signals already recorded, newest first',
  scorecard: 'settled outcomes: every row has already resolved',
  strats:    'STRATEGY LAB — backtests over history, with historical entries'
};

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('== the tab list ==');
const groups = [...html.matchAll(/\{ id:'([a-z]+)',\s+label:'([A-Z ]+)',\s+tabs:\[([^\]]+)\]/g)]
  .map(m => ({ id: m[1], label: m[2].trim(), tabs: m[3].split(',').map(s => s.trim().replace(/'/g, '')) }));
ok(groups.length === 5, 'HG_NAV_GROUPS still has five groups — ' + groups.map(g => g.label).join(', '));
const tabs = [].concat(...groups.map(g => g.tabs));
ok(tabs.length > 60, 'and ' + tabs.length + ' tabs between them');
ok(new Set(tabs).size === tabs.length, 'with no tab listed in two groups');

console.log('\n== each tab resolves to the module that registers it ==');
const jsFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
const owner = {};
for (const f of jsFiles){
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(/HG_tabs\.push\(\s*\{\s*id:\s*'([a-z0-9-]+)'/g)) owner[m[1]] = f;
  /* several tabs register under a module-level AB_ID constant */
  const ab = s.match(/AB_ID\s*=\s*'([a-z0-9-]+)'/);
  if (ab && /HG_tabs\.push\(\{\s*id:\s*AB_ID/.test(s)) owner[ab[1]] = f;
}
const unresolved = tabs.filter(t => !owner[t]);
/* the rest are inline in index.html, which is a module for this purpose */
for (const t of unresolved) owner[t] = 'index.html';
ok(tabs.every(t => owner[t]), 'every tab id resolves to a file');

const read = f => { try{ return fs.readFileSync(path.join(ROOT, f), 'utf8'); }catch(e){ return ''; } };
const RULE   = /hgPlanGeometryLineHtml|hgPlanMarketGeometry/;
const SHARED = /hgMpPin|hgMostProbablePanelHTML|hgSetupCardHTML|hgSetupPanelHTML|cardHTML\(/;
/* a tab "publishes a plan" when its module handles both a stop and a T1 */
const PLAN   = s => /\.t1\b/.test(s) && /\.stop\b/.test(s);

const state = {};
for (const t of tabs){
  const s = read(owner[t]);
  state[t] = { file: owner[t], plan: PLAN(s),
               how: RULE.test(s) ? 'direct' : (SHARED.test(s) ? 'shared' : 'none') };
}

console.log('\n== no tab publishes a pending plan without the verdict ==');
{
  const gaps = tabs.filter(t => state[t].how === 'none' && state[t].plan && !RETROSPECTIVE[t]);
  if (gaps.length){
    for (const t of gaps) console.error('   GAP — ' + t + ' (' + state[t].file + ')');
  }
  ok(gaps.length === 0,
     'every plan-publishing tab reaches the rule, or is a named record — '
     + gaps.length + ' unexplained');

  const covered = tabs.filter(t => state[t].how !== 'none');
  ok(covered.length >= 68, covered.length + ' of ' + tabs.length + ' tabs reach the rule');
}

console.log('\n== the four v750 missed are wired now ==');
for (const t of ['optigold', 'combi', 'setupconfirm', 'dexscreener']){
  ok(tabs.indexOf(t) >= 0, t + ' is still a registered tab');
  ok(state[t].how === 'direct', t + ' reaches the rule directly (' + state[t].file + ')');
}

console.log('\n== OPTI GOLD asks only while the order is pending ==');
{
  /* every OPTI GOLD ticket is a resting limit, so it is a retest by
     construction — but once filled the entry is history and a
     target-behind-price warning would be describing a profit */
  const s = read('optigold.js');
  ok(/!filled && typeof W\.hgPlanGeometryLineHtml/.test(s),
     'the verdict is gated on the order not having filled');
}

console.log('\n== the exclusions are reasoned, not just listed ==');
for (const [t, why] of Object.entries(RETROSPECTIVE)){
  ok(tabs.indexOf(t) >= 0, t + ' is a real tab, so the exclusion is not stale');
  ok(typeof why === 'string' && why.length > 25, t + ': ' + why);
}

console.log('\n== a new tab cannot quietly skip the rule ==');
{
  /* the guard that makes this test worth running: prove it FAILS on a tab
     that publishes a plan, reaches nothing, and is not excused */
  const fake = { file: 'not-a-real-desk.js', plan: true, how: 'none' };
  const withFake = Object.assign({}, state, { 'ghostdesk': fake });
  const fakeTabs = tabs.concat(['ghostdesk']);
  const gaps = fakeTabs.filter(t => withFake[t].how === 'none' && withFake[t].plan && !RETROSPECTIVE[t]);
  ok(gaps.length === 1 && gaps[0] === 'ghostdesk',
     'an unwired plan-publishing tab is detected — the check has teeth');
}

console.log('\n' + passed + ' passed, 0 failed');
