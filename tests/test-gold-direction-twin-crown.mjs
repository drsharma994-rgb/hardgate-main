/* HARDGATE — hg-v947: GOLD DIRECTION crowns ONLY measured-proven candidates,
   and its proven set admitted every HG_GOLD_SETUP_EDGE prefer row without
   asking whether that row's exact OMNIGOLD twin is past the measured-failure
   bar. hg-v943 withholds the rank boost on GOLD SCALP / GOLD SWING for
   exactly that, and hg-v946 withholds the crown on GOLD ULTRA -- this desk
   went on crowning.

   Behavioural throughout: the real golddirection.js scan is driven against
   the real goldind.js table and the real omnigold.js replay evidence, and
   the crowned pick is read out of the published snapshot. Nothing greps the
   source for a rule.

   Covers:
     1) the defect's population -- which prefer rows have a vetoed twin
     2) a vetoed-twin prefer row is NOT crowned, on either horizon
     3) it is NOT demoted, suppressed or removed -- levels, prefer tier and
        its place on the board all stand; only the crown is withheld
     4) a prefer row whose twin is NOT past the bar still crowns (specific,
        not blanket)
     5) the set never silently shrinks: the withheld rows are counted, named
        and published (hg-v940)
     6) hgGoldSetTwinCheck(false) -- ONE lever, not a third switch
     7) fails OPEN: no reader / no verdict / a throwing reader -> crowned
     8) the card names the twin, BOTH samples and what is withheld
     9) the NOT-CROWNED header tells a silent candidate apart from a
        twin-withheld one (two causes, two messages)
    10) scope: omnigold-prefer and live-paid proof are untouched
   Run: node tests/test-gold-direction-twin-crown.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '',
           style: {}, firstElementChild: { style: {} }, _handlers: {},
           addEventListener: function(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
  return { pane, stubs };
}
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; }, _map: m };
}

const PINNED = Date.UTC(2024, 0, 16, 14, 30, 0);
const T0 = Date.UTC(2024, 0, 1) / 1000;
function seedRows(n, step, base, inc){
  const rows = [];
  for (let i = 0; i < n; i++){ const o = base + i * inc, c = o + inc * 0.8;
    rows.push({ t: T0 + i * step, o, h: c + 1, l: o - 1, c, v: 1000 }); }
  return rows;
}

/* One boot: real omnigold.js (the twin's record) + real goldind.js (the
   table and the verdict) + real golddirection.js. `withOmnigold:false` boots
   without the replay evidence so the fail-open path is the REAL absence of
   a reader, not a stubbed one. */
function boot(opts){
  const o = opts || {};
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  if (o.withOmnigold !== false)
    vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const W = globalThis.window;
  const rows1h = seedRows(80, 3600, 2300, 0.5);
  const rows4h = seedRows(80, 14400, 2300, 1.5);
  W.getGoldCandles = async (tf) => (tf === '1h') ? { rows: rows1h.map(r => ({ ...r })), source: 'seed' }
    : (tf === '4h') ? { rows: rows4h.map(r => ({ ...r })), source: 'seed' }
    : { rows: [], source: 'seed' };
  /* every other lane silent, so the only candidates are the ones seeded */
  W.goldScalpSetups = () => ({ ranked: [], rejected: [] });
  W.goldSwingSetups = () => ({ ranked: [], rejected: [] });
  W.hgOgDetect = () => [];
  W.hgOgEvaluate = () => [];
  return { W, ls };
}

/* a candidate shaped exactly as hgGoldSetupEdgeApply leaves a prefer row */
function preferCand(stratKey, strategy, row, over){
  return Object.assign({
    dir: 'long', strategy: strategy, stratKey: stratKey, grade: 'A',
    entry: 2300, stop: 2280, t1: 2340, t2: 2360, rr: 2, rr2: 3,
    confScore: 60, stamps: [], gateNotes: [],
    edge: { action: 'prefer', n: row.n, gross: row.gross, net: row.net, why: row.why || '' }
  }, over || {});
}

async function scan(W, sideBtn){
  const tab = W.HG_tabs.find(t => t.id === 'golddirection');
  const M = freshPane();
  tab.mount(M.pane);
  M.stubs[sideBtn || '#gdLong']._handler();
  const r = await M.stubs['#gdRun']._handler();
  return { M, r, snap: W.goldDirectionScan() };
}

const realNow = Date.now;
Date.now = () => PINNED;

/* =========================================================================
   1) the population -- which prefer rows this rule actually touches
========================================================================= */
console.log('== 1) the defect population ==');
let VETOED = [], CLEAR = [];
{
  const { W } = boot();
  const tbl = W.HG_GOLD_SETUP_EDGE;
  assert(!!(tbl && tbl.scalp && tbl.swing), 'the real HG_GOLD_SETUP_EDGE is readable (fatal if not)');
  assert(typeof W.hgGoldTwinVerdict === 'function' && typeof W.hgGoldTwinCheckOn === 'function',
         'goldind exposes hgGoldTwinVerdict + hgGoldTwinCheckOn (hg-v946)');
  for (const hz of ['scalp', 'swing']){
    for (const k of Object.keys(tbl[hz])){
      const row = tbl[hz][k];
      if (!row || row.action !== 'prefer') continue;
      const v = W.hgGoldTwinVerdict(k);
      (v && v.vetoed ? VETOED : CLEAR).push({ hz: hz.toUpperCase(), key: k, row, v });
    }
  }
  console.log('      prefer rows: ' + (VETOED.length + CLEAR.length)
    + ' — vetoed twin: ' + VETOED.map(x => x.hz + ':' + x.key).join(', ')
    + ' | twin clear: ' + CLEAR.map(x => x.hz + ':' + x.key).join(', '));
  assert(VETOED.length > 0, 'at least one live prefer row HAS a vetoed twin — the rule is not dead code');
  assert(CLEAR.length > 0, 'at least one live prefer row does NOT — the rule can be shown to be specific');
  assert(VETOED.every(x => x.v.z <= -2 && x.v.n > 0 && isFinite(x.v.netXm)),
         'every vetoed verdict carries a real twin record (n, netXm, z past -2)');
}
const VKEY = VETOED[0].key, VROW = VETOED[0].row, VV = VETOED[0].v;
const CKEY = CLEAR[0].key, CROW = CLEAR[0].row;

/* =========================================================================
   2-3) the vetoed-twin prefer row is NOT crowned, and NOT removed
========================================================================= */
console.log('== 2-3) crown withheld, nothing else ==');
{
  const { W } = boot();
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  const { M, r, snap } = await scan(W);
  assert(r === 'refreshed', 'scan completes (got "' + r + '")');
  assert(!snap.swing.pick, 'the vetoed-twin prefer row is NOT crowned — no SWING pick');
  const u = snap.swing.unproven.find(x => x.stratKey === VKEY);
  assert(!!u, 'it lands on unproven[] — lead-eligible, simply not crowned');
  assert(u && u.demoted !== true, 'it is NOT demoted');
  assert(!snap.swing.held.some(h => h.strategy === 'VETOED TWIN MECH')
      && !snap.swing.rejected.some(h => h.strategy === 'VETOED TWIN MECH'),
         'it is NOT held, vetoed, suppressed or rejected');
  const html = M.stubs['#gdCards'].innerHTML;
  assert(html.indexOf('VETOED TWIN MECH') >= 0, 'it still PAINTS as a full card on the board');
  assert(u && u.entry === 2300 && u.stop === 2280 && u.t1 === 2340,
         'it keeps its ENTRY / STOP / T1 in the snapshot — the levels are untouched');
  assert(html.indexOf('ENTRY <b>$2,300</b>') >= 0 && html.indexOf('STOP <b>$2,280</b>') >= 0,
         'and prints them on the card, unchanged');
  assert(u && u.twinWithheld && u.twinWithheld.twin === VV.twin && u.twinWithheld.n === VV.n,
         'the snapshot row names the twin and its sample');
  assert(u && /CROWN is withheld/.test(u.reason) && /levels, prefer tier and board place all stand/.test(u.reason),
         'the snapshot REASON says crown-withheld, not "not measured-proven" (two states, two reasons)');
  assert((html.match(/gdx-banner-in/g) || []).length === 0,
         'no execution banner: a withheld crown is not a quiet crown');
  /* the published proven set excludes it, and the withheld list names it */
  assert(!snap.provenSet.some(e => e.source === 'replay-prefer' && e.key === VKEY),
         'the proven set does not carry the withheld row');
  assert(Array.isArray(snap.twinWithheld) && snap.twinWithheld.some(x => x.key === VKEY),
         'hg-v940: the withheld row is PUBLISHED, so the set cannot quietly shrink');
  const w = snap.twinWithheld.find(x => x.key === VKEY);
  assert(w && w.twin && w.twin.twin === VV.twin && w.twin.n === VV.n,
         'the published withholding carries the twin NAME and the twin SAMPLE, read not retyped');
  assert(w && w.n === VROW.n && w.net === VROW.net,
         'and this desk\'s own n/net beside it — both records, never one');
  assert(/withheld/.test(M.stubs['#gdStat'].textContent)
      && M.stubs['#gdStat'].textContent.indexOf(VV.twin) >= 0,
         'the stat line names the withholding and the twin (count never shrinks in silence)');
}

/* =========================================================================
   4) specific, not blanket -- a twin-clear prefer row still crowns
========================================================================= */
console.log('== 4) a twin-clear prefer row still crowns ==');
{
  const { W } = boot();
  W.goldSwingSetups = () => ({ ranked: [
    preferCand(VKEY, 'VETOED TWIN MECH', VROW, { confScore: 90 }),
    preferCand(CKEY, 'CLEAR TWIN MECH', CROW, { confScore: 40, entry: 2310, stop: 2290, t1: 2350 })
  ], rejected: [] });
  const { M, snap } = await scan(W);
  assert(!!snap.swing.pick && snap.swing.pick.stratKey === CKEY,
         'the LOWER-ranked twin-clear row is crowned over the higher-ranked withheld one');
  assert(snap.swing.pick.provenBy && snap.swing.pick.provenBy.source === 'replay-prefer',
         'it is crowned on its own prefer row, proof source named');
  assert(snap.swing.unproven.some(x => x.stratKey === VKEY),
         'the withheld row is still on the board beside it, uncrowned');
  assert((M.stubs['#gdCards'].innerHTML.match(/gdx-banner-in/g) || []).length === 1,
         'exactly one execution banner — the crowned one');
}

/* =========================================================================
   5) ONE lever -- hgGoldSetTwinCheck(false) restores the crown
========================================================================= */
console.log('== 5) one lever, not a third switch ==');
{
  const { W } = boot();
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  assert(W.hgGoldTwinCheckOn() === true, 'the check is ON by default');
  W.hgGoldSetTwinCheck(false);
  assert(W.hgGoldTwinCheckOn() === false, 'hgGoldSetTwinCheck(false) is READ by hgGoldTwinCheckOn (hg-v946)');
  const off = await scan(W);
  assert(!!off.snap.swing.pick && off.snap.swing.pick.stratKey === VKEY,
         'with the lever off the same row IS crowned — the same switch, not a new one');
  assert(!off.snap.twinWithheld.length, 'and nothing is reported withheld');
  W.hgGoldSetTwinCheck(true);
  const on = await scan(W);
  assert(!on.snap.swing.pick, 'switching it back on withholds the crown again');
}

/* =========================================================================
   6) fails OPEN -- a missing verdict is not a negative one
========================================================================= */
console.log('== 6) fails open ==');
{
  /* the REAL absence: omnigold.js never loaded, so there is no replay
     evidence for hgGoldTwinVerdict to read */
  const { W } = boot({ withOmnigold: false });
  assert(W.hgGoldTwinVerdict(VKEY) === null,
         'with OMNIGOLD absent the verdict is null — no record, no veto');
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  const { snap } = await scan(W);
  assert(!!snap.swing.pick && snap.swing.pick.stratKey === VKEY,
         'no twin record -> the prefer row crowns as before (fails OPEN)');
  assert(!snap.twinWithheld.length, 'nothing reported withheld on an absent record');
}
{
  const { W } = boot();
  W.hgGoldTwinVerdict = function(){ throw new Error('reader blew up'); };
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  const { r, snap } = await scan(W);
  assert(r === 'refreshed' && !!snap.swing.pick && snap.swing.pick.stratKey === VKEY,
         'a THROWING verdict reader does not break the scan and does not withhold');
}
{
  const { W } = boot();
  delete W.hgGoldTwinVerdict;
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  const { snap } = await scan(W);
  assert(!!snap.swing.pick, 'an ABSENT verdict reader does not withhold either');
}

/* =========================================================================
   7) the card says it, with both samples
========================================================================= */
console.log('== 7) the disclosure on the card ==');
{
  const { W } = boot();
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW)], rejected: [] });
  const { M } = await scan(W);
  const html = M.stubs['#gdCards'].innerHTML;
  assert(html.indexOf('CROWN WITHHELD') >= 0, 'the card carries a CROWN WITHHELD chip');
  assert(html.indexOf(VV.twin) >= 0, 'it NAMES the twin');
  assert(html.indexOf(String(VV.n)) >= 0 && html.indexOf(String(VROW.n)) >= 0,
         'it prints BOTH samples — the twin\'s and this desk\'s');
  assert(/OMNIGOLD gates on a 1h horizon/.test(html),
         'it attributes the foreign record to OMNIGOLD\'s gates and its 1h horizon');
  assert(/the only thing withheld is the CROWN/.test(html),
         'it says WHAT is withheld — the crown, not a rank boost (this desk has none)');
  assert(/keeps its levels, its prefer tier and its place on this board/.test(html),
         'and says what is NOT withheld');
  assert(html.indexOf('NOT MEASURED-PROVEN') < 0,
         'it does NOT read as unmeasured — the edge table is not silent about this row');
}

/* =========================================================================
   8) two causes, two messages (the hg-v940 rule, in the header)
========================================================================= */
console.log('== 8) silent vs withheld are told apart ==');
{
  const { W } = boot();
  const silent = { dir: 'long', strategy: 'NEVER MEASURED THING', stratKey: 'mystery',
    entry: 2320, stop: 2300, t1: 2360, t2: 2380, rr: 2, rr2: 3, confScore: 10,
    stamps: [], gateNotes: [] };
  W.goldSwingSetups = () => ({ ranked: [preferCand(VKEY, 'VETOED TWIN MECH', VROW), silent], rejected: [] });
  const { M, snap } = await scan(W);
  assert(snap.swing.unproven.length === 2, 'both land on unproven[] — neither is crowned');
  const uSil = snap.swing.unproven.find(x => x.stratKey === 'mystery');
  const uTw  = snap.swing.unproven.find(x => x.stratKey === VKEY);
  assert(uSil && uSil.twinWithheld === null && /not measured-proven/.test(uSil.reason),
         'the silent one keeps the silent reason and carries no twin');
  assert(uTw && uTw.twinWithheld && /CROWN is withheld/.test(uTw.reason),
         'the withheld one carries the twin and the crown-withheld reason');
  const html = M.stubs['#gdCards'].innerHTML;
  assert(/no measured paid record at all/.test(html),
         'the header still says SILENT for the candidate whose surfaces are silent');
  assert(/exact OMNIGOLD twin is past the measured-failure bar/.test(html),
         'and says TWIN-WITHHELD for the one carrying a prefer row');
  assert(html.indexOf('NOT MEASURED-PROVEN — paints, not crowned') >= 0,
         'the silent candidate keeps the NOT MEASURED-PROVEN chip');
  assert(/1 with no measured paid record at all/.test(html) && /1 carrying a prefer row/.test(html),
         'the header COUNTS each cause separately rather than pooling them');
}

/* =========================================================================
   9) scope -- omnigold-prefer and live-paid proof are untouched
========================================================================= */
console.log('== 9) the rule is scoped to the baked replay-prefer rows ==');
{
  const { W } = boot();
  /* the same key, proven by this tab's OWN live forward ledger: a third
     population, measured live on this desk's gates. A stale twin does not
     speak for it, and v947 deliberately does not reach it. */
  W.hgFwdPaidKinds = (tab) => (tab === 'GOLDDIRECTION') ? [VKEY.toUpperCase()] : [];
  W.hgFwdPool = () => ({});
  W.goldSwingSetups = () => ({ ranked: [
    { dir: 'long', strategy: 'LEDGER PROVEN', stratKey: VKEY, entry: 2300, stop: 2280,
      t1: 2340, t2: 2360, rr: 2, rr2: 3, confScore: 60, stamps: [], gateNotes: [] }
  ], rejected: [] });
  const { snap } = await scan(W);
  assert(!!snap.swing.pick && snap.swing.pick.provenBy
      && snap.swing.pick.provenBy.source === 'live-paid',
         'live-paid proof still crowns the same key — the rule touches the BAKED rows only');
}
{
  const { W } = boot();
  W.hgOgSwingPrefer = (kind, hz) => String(hz).toUpperCase() === 'SWING' && String(kind).toUpperCase() === 'P9-VOLBAR';
  W.hgOgHorizonCfg = (label) => ({ label });
  W.hgOgDetect = () => [{ k: 1 }];
  W.hgOgEvaluate = (rows, hits, extra, cfg) => (cfg && cfg.label === 'SWING')
    ? [{ kind: 'P9-VOLBAR', dir: 'long', formation: { formed: true },
         plan: { entry: 2400, stop: 2380, t1: 2440, t2: 2460, rr1: 2, rr2: 3 } }] : [];
  const { snap } = await scan(W);
  assert(snap.provenSet.some(e => e.source === 'omnigold-prefer'),
         'omnigold-prefer proof is untouched — it IS the OMNIGOLD record, with nothing to disagree with');
}

Date.now = realNow;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
