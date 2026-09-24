/* HARDGATE — the measured-profitable mechanics the two gold tabs could not form.

   MILLI GOLD's roster is the nine OMNIGOLD mechanics whose GATE-CLEAR record is
   net-positive at XM on at least MIN_SAMPLES firings. It is derived, not chosen
   (scripts/milli-gold-roster.mjs). SIX of those nine have no mechanic on GOLD
   SCALP or GOLD SWING at all, so a trader working from the two tabs could not
   form them whatever the tape did:

     STRUCT-BOS · SQUEEZE-FIRE · CUSUM-SHIFT · MMOVE · TREND-RECLAIM · BOS-RETEST

   WHAT IS AND IS NOT CLAIMED. hg-v937 rebuilt this roster on the earlier part
   of the walk and judged it on what came after: it beat the full OMNIGOLD book
   in 6 of 6 trials and PAID IN 0 OF 6. So the claim is that these six are the
   best-measured mechanics the tabs lack and that they were absent — not that
   adding them makes either desk pay. They mint DEMOTED for that reason.

   NO SECOND COPY. Detection is OMNIGOLD's own hgOgBtDetectors() dispatch — the
   same pure rows->hit|null functions the live pass and the backtest call.
   Re-implementing them here is the copy that drifts (hg-v938). Gating is the
   tab's, in full.

   What this file pins:
     - the roster is READ at call time from HG_MILLI_ROSTER, not copied;
     - coverage is EXHAUSTIVE — every roster kind is ported or has a named
       home, so a re-bake that promotes a tenth mechanic surfaces loudly;
     - a ported key is not a key either tab already mints (no duplicate
       mechanic wearing a second name — the hg-v923 attribution failure);
     - detection DELEGATES (behavioural, not a grep) and fails open;
     - the measured-failure veto still runs on these, so a re-bake that turns
       one negative stops it minting with no edit;
     - GOLD SWING consumes the extras at all, which before this it did not.

   Run: node tests/test-gold-roster-ports.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.self = globalThis;
let STORE = {};
globalThis.localStorage = {
  getItem: k => (k in STORE ? STORE[k] : null),
  setItem: (k, v) => { STORE[k] = String(v); },
  removeItem: k => { delete STORE[k]; } };
globalThis.document = { getElementById: () => null,
  createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                          querySelector: () => null, querySelectorAll: () => [] }),
  querySelector: () => null, querySelectorAll: () => [],
  head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };

const src = f => fs.readFileSync(root + f, 'utf8');
/* milligold first: gold-extra reads HG_MILLI_ROSTER from it, and index.html
   loads them in that order. */
vm.runInThisContext(src('milligold.js'), { filename: 'milligold.js' });
vm.runInThisContext(src('gold-extra-strategies.js'), { filename: 'gold-extra-strategies.js' });

const PORTS  = globalThis.hgGoldRosterPorts;
const ALL    = globalThis.hgGoldRosterAll;
const UNMAP  = globalThis.hgGoldRosterUnmapped;
const STOP   = globalThis.hgGoldRosterStop;
const DETECT = globalThis.hgGoldRosterDetect;
const XTRA   = globalThis.hgGoldExtraDetect;
const HOME   = globalThis.HG_GOLD_ROSTER_HOME;
const KEY    = globalThis.HG_GOLD_ROSTER_KEY;

/* a gently trending series with a real ATR — the detectors are stubbed in the
   behavioural sections, so this only has to be well-formed */
function series(n, px, amp){
  const out = []; let p = px, seed = 99;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const o = p, c = px + Math.sin(i / 9) * amp * 3 + (i / n) * amp * 8 + (rnd() - 0.5) * amp;
    out.push({ t: 1e12 + i * 900000, o: +o.toFixed(2), h: +(Math.max(o, c) + amp).toFixed(2),
               l: +(Math.min(o, c) - amp).toFixed(2), c: +c.toFixed(2), v: 900 });
    p = c;
  }
  return out;
}
const ROWS = series(120, 4500, 2.2);

console.log('\n1. the roster is READ, not copied');
{
  const all = ALL();
  ok(Array.isArray(all) && all.length === globalThis.HG_MILLI_ROSTER.kinds.length,
     'hgGoldRosterAll returns the live HG_MILLI_ROSTER, same length');
  /* behavioural: move the roster and the ports must move with it */
  const saved = globalThis.HG_MILLI_ROSTER;
  globalThis.HG_MILLI_ROSTER = { kinds: [{ kind: 'MMOVE', n: 1 }] };
  const one = PORTS();
  ok(one.length === 1 && one[0].kind === 'MMOVE',
     'a one-kind roster ports exactly that one kind — the list is not baked here');
  globalThis.HG_MILLI_ROSTER = { kinds: [{ kind: 'P5-DRIVE', n: 1 }] };
  ok(PORTS().length === 0, 'a roster of only HOMED kinds ports nothing');
  globalThis.HG_MILLI_ROSTER = undefined;
  ok(ALL().length === 0 && PORTS().length === 0 && DETECT(ROWS, {}).length === 0,
     'no milligold.js at all: no roster, no ports, no throw — the tabs are as before');
  globalThis.HG_MILLI_ROSTER = saved;
}

console.log('\n2. coverage of the roster is EXHAUSTIVE');
{
  const kinds = ALL().map(r => r.kind);
  ok(kinds.length === 9, 'the shipped roster is nine mechanics');
  ok(UNMAP().length === 0,
     'every roster kind is either ported or has a named home — none is silently skipped');
  const ported = PORTS().map(p => p.kind);
  ok(ported.length === 6, 'six are ported: ' + ported.join(' '));
  ok(Object.keys(HOME).length === 3, 'three have a home on the tabs: ' + Object.keys(HOME).join(' '));
  ok(ported.length + Object.keys(HOME).length === kinds.length,
     '  and the two sets PARTITION the roster');
  /* partition needs disjointness too: a kind in BOTH maps would be minted here
     AND already minted by the tab, which is two mechanics under one record */
  ok(ported.every(k => !HOME[k]),
     '  no ported kind is also homed — the two maps are disjoint');
  ok(Object.keys(HOME).every(k => !KEY[k]),
     '  and no homed kind carries a port key either');
  /* the failure this guards: a re-bake promotes a mechanic nobody mapped */
  const saved = globalThis.HG_MILLI_ROSTER;
  globalThis.HG_MILLI_ROSTER = { kinds: [{ kind: 'BRAND-NEW-MECHANIC' }] };
  ok(UNMAP().length === 1 && UNMAP()[0] === 'BRAND-NEW-MECHANIC',
     'an unmapped roster kind is REPORTED, not dropped in silence');
  ok(PORTS().length === 0,
     '  and is NOT ported under an invented key — reporting it is the whole '
     + 'point, guessing a key for it would defeat that');
  globalThis.HG_MILLI_ROSTER = saved;
}

console.log('\n3. a ported key is not a mechanic either tab already mints');
{
  const gi = src('goldind.js');
  /* RUNTIME, not a regex over source. The committed form took a fixed 12,000
     characters after `swing:` and counted `reads:` out of the NEXT literal in
     the file, so it read 15 swing keys where the table holds 14 — it passed
     for the wrong reason, which is the hg-v942 lesson in a second place. A
     block added beside the table put four more foreign keys inside that window
     and made it fail. Read the object the desk actually uses: then nothing
     added nearby can move this count, in either direction. */
  const ectx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} },
    setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                              querySelector: () => null, querySelectorAll: () => [] }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  ectx.window = ectx; ectx.self = ectx; ectx.globalThis = ectx; ectx.HG_tabs = [];
  try { vm.runInContext(gi, ectx, { filename: 'goldind.js' }); } catch (e) {}
  const tbl = ectx.HG_GOLD_SETUP_EDGE;
  /* fatal, never skipped: an unreadable table must not quietly pass the
     collision checks below on two empty sets */
  ok(!!(tbl && tbl.scalp && tbl.swing), 'goldind.js exposes the real edge tables');
  const scalpKeys = new Set(Object.keys((tbl && tbl.scalp) || {}));
  const swingKeys = new Set(Object.keys((tbl && tbl.swing) || {}));
  ok(scalpKeys.size === 27 && swingKeys.size === 14,
     'read the real edge tables off goldind.js — 27 scalp keys, 14 swing');
  for (const p of PORTS()){
    ok(!scalpKeys.has(p.key) && !swingKeys.has(p.key),
       '  ' + p.key + ' is a NEW key — it does not shadow an existing mechanic\'s record');
  }
  /* and each HOME really is a mechanic one of the tabs carries */
  for (const k of Object.keys(HOME)){
    const home = HOME[k];
    ok(scalpKeys.has(home) || swingKeys.has(home) || gi.indexOf("'" + home + "'") > 0,
       '  ' + k + ' is homed on a mechanic that exists: ' + home);
  }
}

console.log('\n4. detection DELEGATES to OMNIGOLD, and there is no second copy');
{
  let asked = 0, calls = [];
  globalThis.hgOgBtDetectors = function(){
    asked++;
    const mk = kind => rows => ({ kind: kind, dir: 'long',
                                  level: rows[rows.length - 1].c, why: kind + ' fired' });
    const D = {};
    for (const p of PORTS()) D[p.kind] = (rows) => { calls.push(p.kind); return mk(p.kind)(rows); };
    return D;
  };
  const hits = DETECT(ROWS, {});
  ok(asked === 1, 'hgOgBtDetectors() is asked for the dispatch table — once per call');
  ok(calls.length === 6, '  and every ported kind is actually invoked through it');
  ok(hits.length === 6, 'six hits come back');
  ok(hits.every(h => h.kind && h.kind.indexOf('og') === 0),
     '  each carrying the tab key, not the OMNIGOLD kind');
  ok(hits.every(h => h.rosterKind && KEY[h.rosterKind] === h.kind),
     '  and naming the OMNIGOLD mechanic it came from');

  /* the copy that drifts: this file must not own the detector logic. A grep
     for the function names is the weak version, so also assert that with the
     dispatch table gone NOTHING is detected — no private fallback. */
  delete globalThis.hgOgBtDetectors;
  ok(DETECT(ROWS, {}).length === 0,
     'with OMNIGOLD absent the block detects NOTHING — there is no local copy to fall back to');
  const ge = src('gold-extra-strategies.js');
  ok(!/function +hgGoldStructBos|function +hgGoldSqueezeFire|function +hgGoldCusumShift/.test(ge),
     '  and no re-implementation is defined in this file');
}

console.log('\n5. it fails open, per mechanic');
{
  globalThis.hgOgBtDetectors = function(){
    const D = {};
    for (const p of PORTS()) D[p.kind] = () => { throw new Error('boom ' + p.kind); };
    D['MMOVE'] = rows => ({ kind: 'MMOVE', dir: 'short', level: rows[rows.length - 1].c, why: 'ok' });
    return D;
  };
  let out = null, threw = false;
  try { out = DETECT(ROWS, {}); } catch (e) { threw = true; }
  ok(!threw, 'five throwing detectors do not throw out of the block');
  ok(out.length === 1 && out[0].kind === 'ogmmove',
     '  a detector that throws costs its own mechanic and nothing else');

  globalThis.hgOgBtDetectors = () => { throw new Error('nope'); };
  ok(DETECT(ROWS, {}).length === 0, 'a throwing dispatch table costs the block, not the scan');
  globalThis.hgOgBtDetectors = () => null;
  ok(DETECT(ROWS, {}).length === 0, 'a null dispatch table is []');
  ok(DETECT([], {}).length === 0 && DETECT(null, {}).length === 0, 'no bars is []');
}

console.log('\n6. the shared stop rule');
{
  const atr = 10;
  const rows = [{ h: 4510, l: 4480, c: 4500 }, { h: 4512, l: 4470, c: 4505 }];
  const sLong = STOP(rows, 'long', 4500, atr);
  ok(sLong < 4500, 'a long stop sits BELOW the level');
  ok(sLong <= 4470 - 0.15 * atr + 1e-9,
     '  beyond the recent low, pushed a further 0.15xATR');
  const sShort = STOP(rows, 'short', 4500, atr);
  ok(sShort > 4500 && sShort >= 4512 + 0.15 * atr - 1e-9,
     'a short stop sits ABOVE the recent high by the same pad');

  /* the floor: an extreme sitting almost on the level must not make a stop
     tighter than 0.35xATR, or the stop-width floor downstream just drops it */
  const tight = [{ h: 4500.2, l: 4499.8, c: 4500 }];
  const sT = STOP(tight, 'long', 4500, atr);
  ok(Math.abs(4500 - sT) >= globalThis.HG_GOLD_ROSTER_MIN_STOP_ATR * atr - 1e-9,
     'a level with no room still gets the 0.35xATR floor');
  ok(!isFinite(STOP(rows, 'long', NaN, atr)) && !isFinite(STOP(rows, 'long', 4500, 0)),
     'an uncomputable stop is NaN — never a guess');
  /* bars with no usable extreme: the rule must NOT fall back to the level
     itself, which would hand the floor a stop the bars never supported */
  const blind = [{ h: null, l: null, c: 4500 }, { h: 'x', l: 'x', c: 4500 }];
  ok(!isFinite(STOP(blind, 'long', 4500, atr)) && !isFinite(STOP(blind, 'short', 4500, atr)),
     'a series with no readable high or low is NaN on both sides');
}

console.log('\n7. ENTRY is the level the mechanic named');
{
  globalThis.hgOgBtDetectors = function(){
    return { 'MMOVE': () => ({ kind: 'MMOVE', dir: 'long', level: 4444.44, why: 'w' }) };
  };
  const h = DETECT(ROWS, {})[0];
  ok(h && h.entry === 4444.44 && h.level === 4444.44,
     'entry is hit.level, not the last close — the ticket IS the setup (hg-v423)');
  ok(h.stop < h.entry, '  and the stop is on the losing side of it');
}

console.log('\n8. the measured-failure veto still runs on these');
{
  /* behavioural: a twin whose record is at or past the veto sigma must never
     reach a card, even though it is on the roster. Nothing on today's roster
     is negative — this is the guard for the re-bake that makes one so. */
  /* the record is keyed by the OMNIGOLD kind and reached through the twin map,
     so this is where a re-bake would actually turn one negative */
  const rec = globalThis.HG_GOLD_SIBLING_RECORD;
  const savedRow = rec['MMOVE'];
  rec['MMOVE'] = Object.assign({}, savedRow, { zBreakeven: -3.1 });
  ok(globalThis.hgGoldSiblingVetoed('ogmmove') === true,
     'a ported kind whose twin measures at -3.1 sigma is vetoed');
  globalThis.hgOgBtDetectors = function(){
    return { 'MMOVE':        () => ({ kind: 'MMOVE', dir: 'long', level: 4500, why: 'w' }),
             'TREND-RECLAIM':() => ({ kind: 'TREND-RECLAIM', dir: 'long', level: 4500, why: 'w' }) };
  };
  const kept = XTRA({ rows: ROWS, now: Date.now() }).map(x => x.kind);
  ok(kept.indexOf('ogmmove') < 0, '  and hgGoldExtraDetect drops it');
  ok(kept.indexOf('ogtrend') >= 0, '  while the one still inside the bar mints');
  rec['MMOVE'] = savedRow;
  ok(globalThis.hgGoldSiblingVetoed('ogmmove') === false,
     'restored: nothing on today\'s roster is vetoed');
}

console.log('\n9. every ported key names its OMNIGOLD twin, and has its record');
{
  const twin = globalThis.HG_GOLD_SIBLING_TWIN;
  const rec  = globalThis.HG_GOLD_SIBLING_RECORD;
  for (const p of PORTS()){
    ok(twin[p.key] === p.kind, p.key + ' -> ' + p.kind + ' in the twin map');
    /* resolved through the twin map, which is where the record lives — a row
       keyed by the tab key would be a SECOND record for the same mechanic */
    const r = globalThis.hgGoldSiblingRecord(p.key);
    ok(r && r.twin === p.kind && r.settled > 0 && isFinite(r.netXm),
       '  and carries the twin\'s gate-clear record (n=' + (r && r.settled) + ')');
    ok(rec[p.key] === undefined,
       '  with no duplicate row under the tab key');
  }
  const note = globalThis.hgGoldExtraUncheckedNote('ogmmove');
  ok(/MMOVE/.test(note) && /OMNIGOLD/.test(note),
     'the card note names the twin AND attributes the record to OMNIGOLD');
  ok(/cannot lead/i.test(note), '  and says the setup cannot lead');
}

console.log('\n10. GOLD SWING consumes the extras at all — before this it did not');
{
  const gs = src('goldswing.js');
  ok(/hgGoldExtraDetect/.test(gs), 'goldswing.js calls hgGoldExtraDetect');
  ok(/rows: rows4/.test(gs.slice(gs.indexOf('hgGoldExtraDetect'))),
     '  on the SWING execution TF (4h), not a second series');
  /* BEHAVIOURAL, not a grep: `/push\(xCandS\)/` also matches the bypass
     `out.push(xCandS)`, so a mutation that skips every gate read as caught.
     Drive the real goldSwingSetups with a stubbed extra whose target is far
     inside its stop — only the desk's own R:R gate can reject that, and only
     push() runs it. */
  const ctx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} },
    setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                              querySelector: () => null, querySelectorAll: () => [] }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'structure-levels.js', 'best-levels.js', 'gold-best-levels.js',
                   'regime.js', 'goldind.js', 'goldswing.js']){
    try { vm.runInContext(src(f), ctx, { filename: f }); } catch (e) {}
  }
  ok(typeof ctx.goldSwingSetups === 'function', '  goldSwingSetups loaded for the drive');

  const h4 = [];
  let px = 4400, sd = 7;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  for (let i = 0; i < 260; i++){
    const o = px, c = 4400 + Math.sin(i / 9) * 26 + (i / 260) * 70 + (rnd() - 0.5) * 9;
    h4.push({ t: 1.7e12 + i * 14400000, o: +o.toFixed(2), h: +(Math.max(o, c) + 9).toFixed(2),
              l: +(Math.min(o, c) - 9).toFixed(2), c: +c.toFixed(2), v: 900 });
    px = c;
  }
  const lastC = h4[h4.length - 1].c;
  /* a stop three ATR away: whatever structure the desk finds above, the first
     target cannot pay 1.2R, so its own R:R floor must reject this */
  ctx.hgGoldExtraDetect = () => ([{ ok: true, dir: 'long', kind: 'ogmmove',
    level: lastC, entry: lastC, stop: lastC - 120,
    why: 'driven probe', invalidates: 'probe' }]);
  let res = null, drove = false;
  try { res = ctx.goldSwingSetups({ rows4h: h4, rows1d: h4, now: 1.7e12 + 260 * 14400000 });
        drove = true; } catch (e) { drove = false; }
  ok(drove && res, '  the swing scan runs with the stubbed extra');
  const ranked = (res && res.ranked) || [];
  const rejected = (res && res.rejected) || [];
  const mine = r => r && r.stratKey === 'ogmmove';
  ok(!ranked.some(mine),
     '  a hopeless extra does NOT reach ranked — it was gated, not waved through');
  ok(rejected.some(mine),
     '  it lands in rejected, which only push() can do — the gates ran on it');
  const why = (rejected.filter(mine)[0] || {}).reason || '';
  ok(why.length > 0, '  carrying the desk\'s own reason: ' + why.slice(0, 60));
  const SW = gs.slice(gs.indexOf('var SW_NAME'), gs.indexOf('var SW_NAME') + 4000);
  for (const p of PORTS()) ok(SW.indexOf(p.key + ':') > 0, '  SW_NAME names ' + p.key);
  for (const k of ['goldfix', 'golddxy', 'goldround', 'goldwopen', 'goldfib'])
    ok(SW.indexOf(k + ':') > 0, '  SW_NAME names the hg-v933/v934 extra ' + k);
}

console.log('\n11. they mint DEMOTED, and the lift is one deliberate call');
{
  /* This read the two source files by slicing a FIXED 2,200 / 2,600 characters
     after `hgGoldExtraDetect` and grepping inside. hg-v945 added lines to the
     swing block and pushed `demoted = true` past the cutoff, turning it red
     with nothing wrong — the same fixed-width fragility hg-v944 corrected in
     section 3 of this file. Bound the slice to the BLOCK instead: from the
     call to the catch that closes it, whatever its length. */
  const blockAt = (text, close) => {
    const a = text.indexOf('hgGoldExtraDetect');
    const b = text.indexOf(close, a);
    ok(a > 0 && b > a, '  located the extras block, ' + close + ' (fatal if not)');
    return text.slice(a, b);
  };
  const blk = blockAt(src('goldind.js'), '}catch(eXtra){}');
  ok(/hgGoldExtraPromotable/.test(blk) && /demoted = true/.test(blk),
     'GOLD SCALP demotes an extra unless promotable');
  const blkSw = blockAt(src('goldswing.js'), '}catch(eXtraSw){}');
  ok(/hgGoldExtraPromotable/.test(blkSw) && /demoted = true/.test(blkSw),
     'GOLD SWING does the same — one rule, both tabs');
  /* and the demote is ATTRIBUTED on both, so a guard can tell which gate fired
     (a row is demoted by several on most tapes — hg-v940, hg-v945) */
  ok(/demotedWhy/.test(blk) && /demotedWhy/.test(blkSw),
     '  both name the record they lack, rather than a bare flag');

  /* BEHAVIOURAL, because a grep cannot see REACHABILITY: wrapping the swing
     demote in `if (false)` leaves `demoted = true` in the source and the two
     assertions above pass unchanged. It survived mutation saying so. Drive the
     real goldSwingSetups and read the row. */
  const dctx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} }, setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                              querySelector: () => null, querySelectorAll: () => [] }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  dctx.window = dctx; dctx.self = dctx; dctx.globalThis = dctx; dctx.HG_tabs = [];
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'structure-levels.js', 'best-levels.js', 'gold-best-levels.js',
                   'regime.js', 'goldind.js', 'goldswing.js']){
    try { vm.runInContext(src(f), dctx, { filename: f }); } catch (e) {}
  }
  const dh = []; let dpx = 4400, dsd = 11;
  const drnd = () => { dsd = (dsd * 1103515245 + 12345) & 0x7fffffff; return dsd / 0x7fffffff; };
  for (let i = 0; i < 260; i++){
    const o = dpx, c = 4400 + Math.sin(i / 9) * 26 + (i / 260) * 70 + (drnd() - 0.5) * 9;
    dh.push({ t: 1.7e12 + i * 14400000, o: +o.toFixed(2), h: +(Math.max(o, c) + 9).toFixed(2),
              l: +(Math.min(o, c) - 9).toFixed(2), c: +c.toFixed(2), v: 900 });
    dpx = c;
  }
  const dlast = dh[dh.length - 1].c, dnow = 1.7e12 + 260 * 14400000;
  const dlvl = +(dlast - 55).toFixed(2);
  const driveExtra = (promotable) => {
    dctx.hgGoldExtraDetect = () => ([{ ok: true, dir: 'long', kind: 'ogmmove',
      level: dlvl, entry: dlvl, stop: +(dlvl - 8).toFixed(2),
      why: 'demote probe', invalidates: 'probe' }]);
    dctx.hgGoldExtraPromotable = () => promotable;
    let r = null;
    try { r = dctx.goldSwingSetups({ rows4h: dh, rows1d: dh, now: dnow }); } catch (e){}
    return [...((r && r.ranked) || []), ...((r && r.rejected) || [])]
      .filter((x) => x.stratKey === 'ogmmove')[0] || null;
  };
  const dDef = driveExtra(false), dPro = driveExtra(true);
  ok(dDef && dDef.demoted === true && /OMNIGOLD/.test(String(dDef.demotedWhy || '')),
     '  driven: a swing extra really is demoted, by THIS rule, naming the record');
  ok(dPro && !dPro.demotedWhy,
     '  and hgGoldExtraPromotable() lifts it — one deliberate call, not a default');
  globalThis.hgGoldExtraSetPromotable(false);
  ok(globalThis.hgGoldExtraPromotable() === false, 'demoted is the default');
  globalThis.hgGoldExtraSetPromotable(true);
  ok(globalThis.hgGoldExtraPromotable() === true, 'and lifting it is one explicit call');
  globalThis.hgGoldExtraSetPromotable(false);
}

console.log('\n' + passed + ' assertions passed');
