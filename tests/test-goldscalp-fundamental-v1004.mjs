/* HARDGATE — hg-v1004: GOLDSCALP'S LEAD ANSWERS TO THE FUNDAMENTAL STACK.

   The desk's tally always read the fundamental feeds as POINTS (macro
   realRate ±2, COT crowding ∓1, F&G +1). Points let a structurally strong
   card outscore a DECISIVE headwind and be crowned MOST PROBABLE — while
   its own ADD/SEND buttons (the hg-v1003 backstops) said WATCH ONLY.
   v1004 makes the same gate speak where the crown is decided:

     - gsFundamentalScan(ranked): 2+ NET checked votes against demote the
       candidate (stamped FUNDAMENTAL HEADWIND, reason named, can never
       lead — the gsApplyOneAtATime pattern). A tailwind CHIPS only — the
       tally already counts those legs as points. Live locked convictions
       are skipped (the trade you are IN keeps running); dropped/vetoed
       rows are spoken for; a dark board touches nothing.
     - The stack's checked red-folder blackout joins the entry veto beside
       gate 5: no new convictions mint, live ones keep running, and WHY
       SILENT names the window.
     - The full gold board (real rates / COT / calendar / priors) renders
       beside every scan outcome, and the at-scan verdict publishes with
       the snapshot (cand.fund) so SUPER GOLD / OMNIGOLD hold THIS read.

   Harness mirrors test-goldscalp.mjs: classic scripts via
   vm.runInThisContext with globalThis.window = {}. The new functions ride
   the HG_tabs registration (the hg-v967/v968 route) — zero new
   module-scope exports, so the render-integrity guard stays green.

   Run: node tests/test-goldscalp-fundamental-v1004.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

globalThis.window = {};
const W = globalThis.window;
for (const f of ['goldind.js', 'conviction-lock.js', 'fundamental-stack.js', 'goldscalp.js']){
  vm.runInThisContext(read(f), { filename: f });
}

const reg = (W.HG_tabs || []).filter(t => t && t.id === 'goldscalp')[0] || null;

function cand(dir, over){
  return Object.assign({ sym: 'XAUUSD', dir: dir, strategy: 'TEST SETUP', venue: 'TEST',
                         entry: 2400, stop: 2390, t1: 2420, t2: 2430 }, over || {});
}
/* two checked BEAR votes for gold: real-rate HEADWIND + COT crowded long */
function hostileLongBoard(){
  W.getGoldMacroCached = function(){ return { realRateHint: 'HEADWIND', dxy: { value: 106.1, trend20: 'RISING' }, tnxTrend: 'RISING' }; };
  W.__hgGoldCot = { crowding: 'SPEC CROWDED LONG', zScore: 2.6, reportDate: Date.now() };
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [] }; };
}
function darkBoard(){
  delete W.getGoldMacroCached; delete W.__hgGoldCot; delete W.hgNewsRisk; delete W.S;
}

console.log('== reachability — the hg-v967 route, not new window exports ==');
{
  ok(reg && typeof reg.fundamentalScan === 'function' && typeof reg.fundPanelHtml === 'function',
    'the HG_tabs registration carries fundamentalScan + fundPanelHtml');
  ok(typeof W.gsFundamentalScan === 'undefined' && typeof W.gsFundPanelHtml === 'undefined'
      && typeof W.gsFundChipHtml === 'undefined',
    'zero new module-scope exports — the render-integrity guard stays green');
}

console.log('\n== 2+ net checked votes against demote — the card can never lead ==');
{
  hostileLongBoard();
  const c = cand('long');
  const res = reg.fundamentalScan([c]);
  ok(res.demoted === 1 && res.gated === 1, 'the hostile long is counted');
  ok(c.demoted === true && c.stamps.indexOf('FUNDAMENTAL HEADWIND') >= 0,
    'demoted + stamped — the lead invariant now holds it off the banner');
  ok(/fundamental headwind 2v0/i.test((c.gateNotes || []).join(' ')),
    'the gate note names the decisive split');
  ok(c.fundGate && c.fundGate.demote === true
      && c.fundGate.chips.indexOf('FUNDAMENTAL HEADWIND 2v0') >= 0
      && c.fundGate.chips.indexOf('COT EXTREME') >= 0,
    'the stored verdict carries the headwind chip and the COT extreme');

  const s = cand('short');
  const res2 = reg.fundamentalScan([s]);
  ok(res2.demoted === 0 && !s.demoted, 'the same board WITH the short demotes nothing');
  ok(s.fundGate && s.fundGate.chips.indexOf('FUNDAMENTAL TAILWIND 2v0') >= 0,
    'a tailwind chips — and never adds tally points (the tally already counts those legs)');

  const p = cand('long', { sym: 'PAXGUSDT' });
  ok(reg.fundamentalScan([p]).demoted === 1, 'the PAXG instrument answers to the same gold board');
}

console.log('\n== one witness never flips a setup ==');
{
  W.getGoldMacroCached = function(){ return { realRateHint: 'HEADWIND', dxy: { value: 106.1, trend20: 'RISING' } }; };
  delete W.__hgGoldCot;
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [] }; };
  const c = cand('long');
  const res = reg.fundamentalScan([c]);
  ok(res.demoted === 0 && !c.demoted, 'a single bear vote demotes nothing');
  ok(res.gated === 0 && c.fundGate === undefined, 'and with no extreme and no verdict there is nothing to chip');
}

console.log('\n== live convictions keep running; the spoken-for stay spoken for ==');
{
  hostileLongBoard();
  const locked = cand('long', { locked: true, asOf: '09:15' });
  const vetoed = cand('long', { vetoed: true });
  const dropped = cand('long', { dropped: true });
  const res = reg.fundamentalScan([locked, vetoed, dropped]);
  ok(res.demoted === 0 && res.gated === 0, 'locked / vetoed / dropped rows are never re-judged');
  ok(!locked.demoted && locked.fundGate === undefined,
    'the trade you are IN keeps running — gate 5 semantics (the stack re-gates its buttons, never its levels)');
}

console.log('\n== a dark board blocks nothing ==');
{
  darkBoard();
  const c = cand('long');
  const res = reg.fundamentalScan([c]);
  ok(res.demoted === 0 && res.gated === 0 && !c.demoted && c.fundGate === undefined,
    'every feed absent -> untouched, no fake neutral, no invented gate');
}

console.log('\n== the stack absent -> the pass is a no-op, never a throw ==');
{
  hostileLongBoard();
  /* hg-v1005: gsFundamentalScan now delegates to W.hgFundamentalScanCands
     (the shared house pass), which calls the module closure — so "stack
     absent" means the SHARED ENTRY POINT is gone, not only the gate. */
  const saved = W.hgFundamentalGate, savedR = W.hgFundamentalRegime, savedP = W.hgFundamentalPanelHtml,
        savedS = W.hgFundamentalScanCands;
  delete W.hgFundamentalGate; delete W.hgFundamentalRegime; delete W.hgFundamentalPanelHtml;
  delete W.hgFundamentalScanCands;
  let threw = null, res = null;
  try{ res = reg.fundamentalScan([cand('long')]); }catch(e){ threw = e; }
  ok(!threw && res && res.demoted === 0 && res.gated === 0, 'without fundamental-stack.js the desk runs exactly as before');
  ok(reg.fundPanelHtml() === '', 'and the panel renders empty, not an error');
  W.hgFundamentalGate = saved; W.hgFundamentalRegime = savedR; W.hgFundamentalPanelHtml = savedP;
  W.hgFundamentalScanCands = savedS;
}

console.log('\n== the blackout joins the entry veto (wiring pins on the shipped source) ==');
{
  const src = read('goldscalp.js');
  ok(/var fundBlackout = false;/.test(src)
      && /entryVeto = newsVeto \|\| fundBlackout/.test(src)
      && /applyConviction\(ranked, venueRows, now, entryVeto\)/.test(src),
    'the checked blackout ORs into the no-mint veto — gate 5 semantics, live convictions untouched');
  ok(/fundGateProbe\('XAUUSD', 'long', \{ scanner: 'goldscalp' \}\)/.test(src),
    'the probe asks the gold board once, direction-free (the gate checks blackout before direction)');
  ok(/EVENT BLACKOUT — no fresh setup forms into a red-folder macro print/.test(src),
    'vetoed candidates render the BLACKOUT reason line, not a mislabelled NEWS GATE');
  ok(/else if \(fundBlackout\) legs\.push\('EVENT BLACKOUT/.test(src),
    'the scan stat line names the blackout');
  ok(/else if \(o\.fundBlackout\) lead = 'EVENT BLACKOUT/.test(src) && /fundBlackout: fundBlackout,/.test(src),
    'WHY SILENT names the window when the blackout empties the board');
  const callIdx = src.indexOf('fundScan = gsFundamentalScan(ranked)');
  const leadIdx = src.indexOf('best = goldPickSpotAlignedBest(ranked, spotRef)');
  ok(callIdx > 0 && leadIdx > 0 && callIdx < leadIdx,
    'the demote pass runs BEFORE the leader is picked — a headwind can never be crowned');
  ok(src.indexOf('+ gsFundChipHtml(c)') > 0 && /gsFundChipHtml\(best\)/.test(src),
    'the chip renders on every card AND on the banner of the crowned one');
  ok((src.match(/mixedBanner \+ fundPanelHtml \+ aplusPack\.panel \+ uniHtml/g) || []).length === 2
      && (src.match(/mixedBanner \+ fundPanelHtml \+ uniHtml/g) || []).length === 1
      && (src.match(/basisHtml \+ fundPanelHtml \+ uniHtml/g) || []).length === 1,
    'the gold board renders on all four assembly paths (cards / held-back / empty / vision refresh)');
  ok(/fund: \(c\.fundGate && typeof c\.fundGate === 'object'\)/.test(src),
    'the at-scan verdict publishes with the snapshot — SUPER GOLD holds THIS read');
  ok(/fundamentalScan: gsFundamentalScan, fundPanelHtml: gsFundPanelHtml/.test(src),
    'the registration route is the shipped one the test drove above');
}

console.log('\n== the gold board renders beside every outcome ==');
{
  hostileLongBoard();
  const html = reg.fundPanelHtml();
  ok(/FUNDAMENTAL REGIME/.test(html) && /GOLD/.test(html) && /CFTC COT/.test(html) && /REAL RATES/.test(html),
    'the panel names the regime, the asset, the COT leg and the real-rate leg');
  ok(/BEARISH/.test(html), 'the hostile board reads BEARISH — the desk shows the board it answers to');
  W.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{}] }; };
  ok(/BLACKOUT/.test(reg.fundPanelHtml()), 'a red-folder window says BLACKOUT on the panel');
  ok(W.hgFundamentalGate('XAUUSD', 'long', {}).refuse === true,
    'and the gate refuses — the exact read the entry-veto probe makes');
  darkBoard();
  const dark = reg.fundPanelHtml();
  ok(/FUNDAMENTAL REGIME — UNKNOWN/.test(dark), 'a dark board renders UNKNOWN — never a guessed regime');
}

console.log('\npassed: ' + passed);
