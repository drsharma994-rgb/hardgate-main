/* HARDGATE — hg-v1297: the OMNIBTC tape-regime stand-down, and the version triad.

   THE GAP THIS CLOSES. `hgRegimeAllowsSetup` (plans.js:114) is a HARD veto every
   other crypto desk already runs on its own 4h tape — setup-stack.js:115,
   supersetup.js:161, chartvision-tab.js:402, contract-report.js:404. A `volatile`
   tape refuses a trend-continuation entry outright; a `compression` tape refuses
   swing/edge/best. OMNIBTC DISPLAYED `atrRegime` on its TECHNICAL line and read
   `efficiency` as one witness, and consulted the veto NOWHERE — measured,
   `hgRegimeAllowsSetup` and `detectRegime` appeared ZERO times in omnibtc.js. So a
   crown could print a ticket on a 4h tape the identical setup would have been
   refused on at every other desk.

   WHAT THIS GUARD PROVES, behaviourally, through the real IIFE:
     1. the desk now calls the shared gate (not a second copy of the regime read);
     2. a vetoing regime DEMOTES the crown and names the shared gate's reason;
     3. a permissive regime does NOT stand the crown down (the gate is a veto, not
        a tax on every setup);
     4. an UNREADABLE regime fails OPEN — three-state, never an invented refusal;
     5. an ABSENT shared gate fails OPEN — the desk never throws or blocks;
     6. a THROWING shared gate fails OPEN;
     7. the lever disables it (window + localStorage), and an unreadable lever is ON;
     8. it is WITHHOLD-ONLY: it adds no vote to fams/agree/oppose, so it cannot make
        a ticket easier (the hg-v966 trap);
     9. the version triad is CONSISTENT — the defect this pack also repaired.

   Run: node tests/test-omnibtc-regime-gate-v1297.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

/* the tape shape the desk reads; content is irrelevant because the regime gate
   is stubbed at the shared boundary — what is under test is whether OMNIBTC
   CALLS it and what it does with the answer, not how the regime is computed. */
function bars(n){
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: i, o: 100, h: 101, l: 99, c: 100, v: 1 });
  return out;
}
function crown(){
  return {
    tier: 'clean',
    row: { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135,
      clean: true, engine: 'SWING clean plan' }
  };
}
/* a bank that WOULD mint, so a demote can only come from the regime gate */
function armBank(W){
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  W.ema = function(v){ return v.map(function(){ return 1; }); };
  W.macdHist = function(v){ return v.map(function(){ return 1; }); };
  W.donchian = function(rows){ return { up: rows.map(function(){ return 1e9; }), lo: rows.map(function(){ return -1e9; }) }; };
}

console.log('== 1) the desk consults the SHARED gate, in one home ==');
{
  const src = read('omnibtc.js');
  ok(/W\.hgRegimeAllowsSetup\s*\(/.test(src),
    'omnibtc.js calls the shared hgRegimeAllowsSetup (one home, not a second regime read)');
  ok(!/function\s+detectRegime/.test(src),
    'omnibtc.js does not carry its own copy of detectRegime');
  const W = boot();
  let called = 0, sawStyle = null, sawRows = null;
  W.hgRegimeAllowsSetup = function(rows, style){ called++; sawRows = rows; sawStyle = style; return { allow: true, reason: null }; };
  W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(called === 1, 'exactly one call per accuracy pass (called ' + called + ')');
  ok(sawStyle === 'swing', "asked for the 'swing' style, matching the other desks (got " + sawStyle + ')');
  ok(Array.isArray(sawRows) && sawRows.length === 280, 'handed the real 4h tape, not a stub');
}

console.log('\n== 2) a vetoing regime demotes the crown and names the shared reason ==');
{
  const W = boot(); armBank(W);
  const base = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  const armedTier = base.tier;
  ok(armedTier === 'clean', 'control: with a permissive regime the armed bank mints (tier ' + armedTier + ')');

  const W2 = boot(); armBank(W2);
  W2.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'VOLATILE EXPANSION — volatile tape, skip trend continuation' }; };
  const cut = W2.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(cut.tier === 'near', 'a volatile tape stands the crown DOWN to a watch (tier ' + cut.tier + ')');
  ok(/TAPE REGIME/.test(cut.row.pineNote || ''), 'the note names the new stand-down (' + cut.row.pineNote + ')');
  ok(/VOLATILE EXPANSION/.test(cut.row.pineNote || ''), 'and carries the shared gate reason VERBATIM, not a paraphrase');
  ok(cut.row.regimeRefused === true, 'and stamps regimeRefused on the row for the ledger');
  ok(cut.row.entry === 100 && cut.row.stop === 90 && cut.row.t1 === 120,
    'DEMOTE, DO NOT HIDE: the levels survive the refusal (hg-v552 / hg-v572)');
  ok(cut.row.clean === false && cut.row.near === true,
    'and the row is genuinely demoted, not deleted — clean?false near?true');
}

console.log('\n== 3) the stand-down is FIRST, so a regime veto cannot be masked ==');
{
  const W = boot(); armBank(W);
  W.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION — compression chop, wait for expansion' }; };
  /* force a pine conflict too: if the regime gate ran second, the pine note would win */
  W.pineRangeFilter = function(){ return { dir: 'short', newLong: true }; };
  const cut = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(/TAPE REGIME/.test(cut.row.pineNote || ''),
    'when the regime AND a pine conflict both fire, the regime names itself (' + cut.row.pineNote + ')');
}

console.log('\n== 4) three-state: an unreadable regime is NOT a verdict ==');
{
  const W = boot(); armBank(W);
  W.hgRegimeAllowsSetup = function(){ return { allow: true, unchecked: true, reason: 'regime check threw: boom' }; };
  const r = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(r.tier === 'clean', 'unchecked:true never demotes — the crown still mints (tier ' + r.tier + ')');
  ok(!/TAPE REGIME/.test(r.row.pineNote || ''), 'and no regime note is written');
  ok(!r.row.regimeRefused, 'and regimeRefused is not stamped');
}

console.log('\n== 5) fail-open when the gate is absent, or throws, or the tape is missing ==');
{
  const W = boot(); armBank(W);
  delete W.hgRegimeAllowsSetup;
  const r = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(r.tier === 'clean', 'an ABSENT shared gate fails open (tier ' + r.tier + ')');

  const W2 = boot(); armBank(W2);
  W2.hgRegimeAllowsSetup = function(){ throw new Error('gate exploded'); };
  const r2 = W2.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(r2.tier === 'clean', 'a THROWING gate fails open, never propagating (tier ' + r2.tier + ')');

  const W3 = boot(); armBank(W3);
  let hit = 0;
  W3.hgRegimeAllowsSetup = function(){ hit++; return { allow: false, reason: 'should not be reached' }; };
  const r3 = W3.hgObtcApplyPineAccuracy(crown(), [], []);
  ok(hit === 0, 'no 4h tape: the gate is not even consulted');
  ok(/pine bank unread/.test(r3.row.pineNote || ''), 'and the existing no-tape note is what stands (unchanged)');
}

console.log('\n== 6) the lever disables it, and an unreadable lever is ON ==');
{
  const W = boot(); armBank(W);
  W.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION' }; };
  W.HG_OBTC_REGIME_GATE = false;
  const off = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(off.tier === 'clean', 'window.HG_OBTC_REGIME_GATE = false turns the gate off (tier ' + off.tier + ')');

  const W2 = boot(); armBank(W2);
  W2.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION' }; };
  W2.HG_OBTC_REGIME_GATE = true;
  const on = W2.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(on.tier === 'near', 'window.HG_OBTC_REGIME_GATE = true forces it on (tier ' + on.tier + ')');

  const W3 = boot(); armBank(W3);
  W3.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION' }; };
  W3.localStorage = { getItem: k => (k === 'hg_obtc_regime_gate' ? '0' : null), setItem(){}, removeItem(){} };
  const ls = W3.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(ls.tier === 'clean', "localStorage hg_obtc_regime_gate = '0' turns the gate off (tier " + ls.tier + ')');

  const W4 = boot(); armBank(W4);
  W4.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION' }; };
  W4.localStorage = { getItem(){ throw new Error('storage denied'); }, setItem(){}, removeItem(){} };
  const bad = W4.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(bad.tier === 'near', 'an UNREADABLE lever leaves the gate ON — the safe side (tier ' + bad.tier + ')');

  const src = read('omnibtc.js');
  ok(/function hgObtcRegimeGateOn/.test(src) && /HG_OBTC_REGIME_GATE/.test(src) && /hg_obtc_regime_gate/.test(src),
    'both lever surfaces exist by name (hg-v956: a rename trips here)');
}

console.log('\n== 7) WITHHOLD-ONLY: it cannot make a ticket easier (the hg-v966 trap) ==');
{
  /* The gate is the FIRST stand-down, so when it fires it returns before the
     vote vectors are even built — they are simply absent, never augmented. */
  const Wcut = boot(); armBank(Wcut);
  Wcut.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION' }; };
  const cut = Wcut.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(cut.row.pineAgree === undefined && cut.row.pineFamilies === undefined,
    'a vetoing gate returns BEFORE the vote vectors exist — it cannot add to them');

  /* With the gate permitting, the vectors must be exactly what the desk builds
     with NO gate stubbed at all. That is the withhold-only property. */
  const Wpass = boot(); armBank(Wpass);
  Wpass.hgRegimeAllowsSetup = function(){ return { allow: true, reason: 'TREND' }; };
  const pass = Wpass.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  const Wnone = boot(); armBank(Wnone);            /* no gate stubbed: desk ships its own */
  const none = Wnone.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(JSON.stringify(pass.row.pineAgree || []) === JSON.stringify(none.row.pineAgree || []),
    'pineAgree with the gate permitting equals pineAgree with no gate at all');
  ok(JSON.stringify(pass.row.pineFamilies || []) === JSON.stringify(none.row.pineFamilies || []),
    'pineFamilies is identical — the gate contributes no family');
  ok(JSON.stringify(pass.row.coreAgree || []) === JSON.stringify(none.row.coreAgree || []),
    'coreAgree is identical — the gate contributes no core witness');
  ok(JSON.stringify(pass.row.indAgree || []) === JSON.stringify(none.row.indAgree || []),
    'indAgree is identical — the gate contributes no indicator');
  ok(pass.tier === 'clean' && cut.tier === 'near',
    'the only tier movement it can cause is clean -> near, never the reverse');
  /* and it is not wired into any vote source by name */
  const src = read('omnibtc.js');
  const gateBody = (src.match(/function hgObtcRegimeWhy[\s\S]*?\n  \}/) || [''])[0];
  ok(!/fams|agree|oppose|cores|indAgree/.test(gateBody),
    'the gate helper never touches a vote vector (read it: it only returns a reason or null)');
}

console.log('\n== 8) the version triad is CONSISTENT (the defect this pack repaired) ==');
{
  const bs = (read('build-stamp.js').match(/version:\s*'([^']+)'/) || [])[1];
  const sw = (read('sw.js').match(/HG_CACHE\s*=\s*'([^']+)'/) || [])[1];
  const ttHeader = (read('trendtable.js').match(/hg-v\d+/) || [])[0];
  const ttLoader = (read('trendtable.js').match(/\?v=(\d+)/) || [])[1];
  const apiV = [...read('hg-api-base.js').matchAll(/data-v',\s*'(\d+)'/g)].map(m => m[1]);
  const apiLoaders = [...read('hg-api-base.js').matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  const pins = {};
  [...read('index.html').matchAll(/\?v=(\d+)/g)].forEach(m => { pins[m[1]] = (pins[m[1]] || 0) + 1; });

  const nums = new Set([String(bs).replace(/^hg-v/, ''), String(sw).replace(/^hg-v/, ''),
    String(ttHeader).replace(/^hg-v/, ''), ttLoader, ...apiV, ...apiLoaders, ...Object.keys(pins)]);
  ok(nums.size === 1,
    'build-stamp / sw / trendtable (header+loader) / hg-api-base (data-v+loaders) / index.html pins all agree — got '
    + JSON.stringify([...nums]));
  ok(bs === HG_VER, 'build-stamp.js is the tree version ' + HG_VER);
  ok(Object.keys(pins).every(v => ('hg-v' + v) === HG_VER),
    'all ' + Object.values(pins)[0] + ' index.html pins carry ' + HG_VER);
  ok(String(ttHeader) === HG_VER && ttLoader === HG_VER.slice(4),
    'trendtable header AND its loader cache-buster both moved (a missed loader serves stale parts from cache)');
  ok(apiV.every(v => v === HG_VER.slice(4)), 'hg-api-base data-v matches');
}

console.log('\n' + passed + ' passed, 0 failed');
