/* HARDGATE — hg-v1418: the OMNIBTC cost-floor stand-down.

   hg-v1421: sister-suite re-pin — the stamp assertions below follow the tree version (now hg-v1421); the pack under test remains hg-v1418.
   hg-v1433: re-pinned again with the GOLD SINGLES bump (hg-v1432 -> hg-v1433); the pack under test remains hg-v1418.
   hg-v1434: re-pinned again with the CRYPTO SINGLES bump (hg-v1433 -> hg-v1434); the pack under test remains hg-v1418.
   hg-v1435: re-pinned again with the PINE/META bump (hg-v1434 -> hg-v1435); the pack under test remains hg-v1418.
   hg-v1445: re-pinned again with the SUPER GOLD / CONFLUENCE bump; the pack under test remains hg-v1418.
   hg-v1432: re-pinned again with the INLINE SCANNERS bump (hg-v1421 -> hg-v1432); the pack under test remains hg-v1418.
   hg-v1420: sister-suite re-pin — the stamp assertions below follow the tree version (now hg-v1420); the pack under test remains hg-v1418.
   hg-v1419: sister-suite re-pin — the stamp assertions below follow the tree version (now hg-v1419); the pack under test remains hg-v1418.
   hg-v1418: sister-suite re-pin — the stamp assertions below follow the tree version (now hg-v1418); the pack under test remains hg-v1418.
   WHAT THIS GUARD PROVES, behaviourally, through the real IIFE:
     1. a tight-stop crown (stop under 4x the 0.20% round-trip taker cost =
        0.80% of entry) DEMOTES to a watch and names COST FLOOR with the
        measured numbers — demote, never hide: the levels survive;
     2. the lever disables it (window + localStorage), an unreadable lever
        is ON (the safe side);
     3. unreadable geometry — missing, non-finite or inverted entry/stop,
        or a zero-width stop — fails OPEN (three-state: an unreadable
        geometry is NOT a verdict);
     4. WITHHOLD-ONLY: when it fires it returns BEFORE the vote vectors
        exist — pineAgree/pineFamilies are simply absent (the hg-v966 trap:
        it can never make a ticket easier);
     5. ORDER: it is SECOND among the stand-downs — a crown failing BOTH
        TAPE REGIME and the floor gets the TAPE REGIME note (the regime
        suite pins the regime veto first);
     6. a wide-stop crown (10%) is untouched on both the loaded-bank path
        (mints clean) and the unloaded-bank path (the /unread/ note stands);
     7. both lever surfaces exist by name (a rename trips here);
     8. the deploy pins moved with the pack (?v= byte-check).

   Measured basis (the hg-v1403 walker, 5000-bar bake, n=4779 settled rows):
   the sub-floor cohort resolved -0.273R, negative in BOTH chronological
   halves (H1 -0.257 / H2 -0.290, n=548, 302 long / 246 short, 68% stop-outs
   vs 43% in the population); -0.616R at the true 0.20% taker round trip the
   walk under-costs. Cross-window (2000-bar walk): -0.248R, both halves.
   Honesty: on the walk the floor vetoes exactly 1 of 72 tickets — a +1.79R
   winner — so walk ticket netR moves +0.0625R -> +0.0382R; the fixture is
   SWING-shaped and the live target is SCALP tight stops. The forward ledger
   decides.

   Mutation proof (run by hand, then revert):
     - delete the stand-down block at the seam -> sections 1, 4, 5 fail;
     - delete the lever read -> section 2 fails;
     - move the block ABOVE the TAPE REGIME block -> section 5 fails.

   Run: node tests/test-omnibtc-cost-floor-v1407.mjs */
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
/* entry 100 / stop 99.5 -> stopPct 0.50%, under the 0.80% floor */
function tightCrown(){
  const c = crown();
  c.row.stop = 99.5;
  return c;
}
/* a bank that WOULD mint, so a demote can only come from the floor */
function armBank(W){
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  W.ema = function(v){ return v.map(function(){ return 1; }); };
  W.macdHist = function(v){ return v.map(function(){ return 1; }); };
  W.donchian = function(rows){ return { up: rows.map(function(){ return 1e9; }), lo: rows.map(function(){ return -1e9; }) }; };
}

console.log('== 1) a tight-stop crown DEMOTES and names COST FLOOR — demote, never hide ==');
{
  const W = boot(); armBank(W);
  const base = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(base.tier === 'clean', 'control: the 10%-stop crown mints with the armed bank (tier ' + base.tier + ')');

  const W2 = boot(); armBank(W2);
  const cut = W2.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(cut.tier === 'near', 'the 0.50%-stop crown stands DOWN to a watch (tier ' + cut.tier + ')');
  ok(/COST FLOOR/.test(cut.row.pineNote || ''), 'the note names the new stand-down (' + cut.row.pineNote + ')');
  ok(/0\.50% of entry/.test(cut.row.pineNote || '') && /0\.20% round-trip/.test(cut.row.pineNote || '')
    && /0\.80%\)/.test(cut.row.pineNote || '') && /0\.25R/.test(cut.row.pineNote || ''),
    'and carries the named numbers: measured stop, the 0.20% round trip, the 0.80% floor, the 0.25R line');
  ok(cut.row.costFloorRefused === true, 'and stamps costFloorRefused on the row for the ledger');
  ok(cut.row.entry === 100 && cut.row.stop === 99.5 && cut.row.t1 === 120,
    'DEMOTE, DO NOT HIDE: the levels survive the refusal (hg-v552 / hg-v572)');
  ok(cut.row.clean === false && cut.row.near === true,
    'and the row is genuinely demoted, not deleted — clean?false near?true');

  /* short side symmetry: entry 100 / stop 100.5 -> 0.50% */
  const W3 = boot(); armBank(W3);
  const short = tightCrown();
  short.row.dir = 'short'; short.row.stop = 100.5; short.row.t1 = 80;
  const cutS = W3.hgObtcApplyPineAccuracy(short, bars(280), []);
  ok(cutS.tier === 'near' && /COST FLOOR/.test(cutS.row.pineNote || ''),
    'a tight-stop SHORT demotes the same way (tier ' + cutS.tier + ')');
}

console.log('\n== 2) the lever disables it, and an unreadable lever is ON ==');
{
  const W = boot(); armBank(W);
  W.HG_OBTC_COST_FLOOR = false;
  const off = W.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(off.tier === 'clean', 'window.HG_OBTC_COST_FLOOR = false turns the floor off (tier ' + off.tier + ')');

  const W2 = boot(); armBank(W2);
  W2.HG_OBTC_COST_FLOOR = true;
  const on = W2.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(on.tier === 'near', 'window.HG_OBTC_COST_FLOOR = true forces it on (tier ' + on.tier + ')');

  const W3 = boot(); armBank(W3);
  W3.localStorage = { getItem: k => (k === 'hg_obtc_cost_floor' ? '0' : null), setItem(){}, removeItem(){} };
  const ls = W3.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(ls.tier === 'clean', "localStorage hg_obtc_cost_floor = '0' turns the floor off (tier " + ls.tier + ')');

  const W4 = boot(); armBank(W4);
  W4.localStorage = { getItem(){ throw new Error('storage denied'); }, setItem(){}, removeItem(){} };
  const bad = W4.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(bad.tier === 'near', 'an UNREADABLE lever leaves the floor ON — the safe side (tier ' + bad.tier + ')');
}

console.log('\n== 3) three-state: unreadable geometry is NOT a verdict ==');
{
  const cases = [
    ['missing stop', c => { delete c.row.stop; }],
    ['missing entry', c => { delete c.row.entry; }],
    ['non-finite stop', c => { c.row.stop = NaN; }],
    ['string stop', c => { c.row.stop = 'abc'; }],
    ['inverted long stop (above entry)', c => { c.row.stop = 100.4; }],
    ['inverted short stop (below entry)', c => { c.row.dir = 'short'; c.row.stop = 99.6; }],
    ['zero-width stop (stop === entry)', c => { c.row.stop = 100; }]
  ];
  for (const [name, mutate] of cases){
    const W = boot(); armBank(W);
    const c = tightCrown();
    mutate(c);
    const r = W.hgObtcApplyPineAccuracy(c, bars(280), []);
    ok(!/COST FLOOR/.test(r.row.pineNote || '') && !r.row.costFloorRefused,
      name + ': the floor invents NO refusal (note ' + JSON.stringify(r.row.pineNote) + ')');
    if (name.indexOf('short') === -1) ok(r.tier === 'clean',
      name + ': and the crown still mints (tier ' + r.tier + ')');
    /* the inverted-SHORT case is demoted by PINE AGAINST instead — the armed
       bank is long — which is exactly the point: some OTHER measured clause
       names itself; the floor stays silent. */
  }
}

console.log('\n== 4) WITHHOLD-ONLY: it returns BEFORE the vote vectors exist ==');
{
  const W = boot(); armBank(W);
  const cut = W.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(cut.row.pineAgree === undefined && cut.row.pineFamilies === undefined,
    'a vetoing floor returns before the vote vectors exist — it cannot add to them');
  ok(cut.row.pineOppose === undefined && cut.row.coreAgree === undefined && cut.row.indAgree === undefined,
    'pineOppose / coreAgree / indAgree are equally absent — no vote vector is touched');
}

console.log('\n== 5) ORDER: TAPE REGIME stays FIRST — a double failure names the regime ==');
{
  const W = boot(); armBank(W);
  W.hgRegimeAllowsSetup = function(){ return { allow: false, reason: 'COMPRESSION — compression chop, wait for expansion' }; };
  const cut = W.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(/TAPE REGIME/.test(cut.row.pineNote || '') && !/COST FLOOR/.test(cut.row.pineNote || ''),
    'a crown failing BOTH the regime and the floor gets the TAPE REGIME note (' + cut.row.pineNote + ')');
  ok(cut.row.regimeRefused === true && !cut.row.costFloorRefused,
    'and only regimeRefused is stamped — the floor never ran');
}

console.log('\n== 6) a wide-stop crown is untouched on the loaded AND the unloaded-bank path ==');
{
  const W = boot(); armBank(W);
  const r = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(r.tier === 'clean' && !/COST FLOOR/.test(r.row.pineNote || ''),
    'loaded bank, 10% stop: the crown mints, no floor note (' + r.row.pineNote + ')');

  const W2 = boot();   /* bank NOT armed -> !book.loaded */
  const r2 = W2.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(/unread/.test(r2.row.pineNote || '') && !/COST FLOOR/.test(r2.row.pineNote || ''),
    'unloaded bank, 10% stop: the existing /unread/ note stands unchanged (' + r2.row.pineNote + ')');

  /* and the floor is NOT masked by the unloaded bank when the stop IS tight */
  const W3 = boot();
  const r3 = W3.hgObtcApplyPineAccuracy(tightCrown(), bars(280), []);
  ok(r3.tier === 'near' && /COST FLOOR/.test(r3.row.pineNote || ''),
    'unloaded bank, 0.50% stop: the floor still fires — an unloaded bank cannot mask it');
}

console.log('\n== 7) both lever surfaces exist by name (a rename trips here) ==');
{
  const src = read('omnibtc.js');
  ok(/function hgObtcCostFloorOn/.test(src) && /HG_OBTC_COST_FLOOR/.test(src) && /hg_obtc_cost_floor/.test(src),
    'hgObtcCostFloorOn + window.HG_OBTC_COST_FLOOR + localStorage hg_obtc_cost_floor all named (hg-v956)');
  ok(/HG_OBTC_COST_RT = 0\.0020/.test(src) && /4 \* HG_OBTC_COST_RT/.test(src),
    'the constants carry their derivation: 0.20% round trip, floor = 4x round trip');
  /* and the floor helper never touches a vote vector */
  const body = (src.match(/function hgObtcCostFloorWhy[\s\S]*?\n  \}/) || [''])[0];
  ok(body && !/fams|agree|oppose|cores|indAgree/.test(body),
    'the floor helper never touches a vote vector (read it: it only returns a reason or null)');
}

console.log('\n== 8) the deploy pins moved with the pack (?v= byte-check) ==');
{
  const bs = (read('build-stamp.js').match(/version:\s*'([^']+)'/) || [])[1];
  ok(bs === 'hg-v1447', 'build-stamp.js carries hg-v1447 (got ' + bs + ')');
  ok(bs === HG_VER, 'and it is the tree version ' + HG_VER);
  const idx = read('index.html');
  ok(idx.indexOf('omnibtc.js?v=1447') !== -1, 'index.html loads omnibtc.js?v=1447');
  ok(!/\?v=1406\b/.test(idx), 'no stale ?v=1406 pin survives in index.html');
}

console.log('\n' + passed + ' passed, 0 failed');
