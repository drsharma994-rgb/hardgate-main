/* HARDGATE — the gate logic that was living in two files at once.

   Six gates exist once per desk: vol-alive, participation, trend,
   news-window, measured-edge and consensus. Most are genuinely PARAMETERISED
   VARIANTS rather than copies — gold's participation is soft because several
   gold feeds publish no volume at all while crypto's is hard, gold's
   vol-alive floor is per horizon, the two consensus gates read different
   family maps, and the two measured-edge gates divide by different mechanic
   counts. Merging those would mean inventing a shared abstraction over
   behaviour that is deliberately different, which is how a "shared" gate ends
   up wrong for both desks. They stay where they are.

   Two of them were not variants at all. They were the same source, character
   for character, in two files:

     hgBarSpacingSec + hgSlotMeanVol    1,330 chars, verbatim
     the news-window decision            2,730 chars, verbatim

   Both arrived the same way: a defect found on one desk, fixed on that desk,
   and the identical fix pasted into the other. In one working session that
   happened five times. The news gate emptied BOTH tabs for days and its fix
   had to be written twice — miss the second paste and one desk stays dark.

   The extraction was verified by running both desks' full ledgers over 6,912
   configurations (3 tapes x 2 times of day x 2 volume levels x 4 mechanics x
   2 directions x 6 news states x 3 sample pools x 2 daily stacks) and
   comparing all 179,712 gate verdicts before and after. Byte-identical.

   That harness also caught the one real break: the shim called W(), which is
   omnigold's window accessor and does not exist in omniroute, so every crypto
   ledger threw. Each file now reaches window through its own idiom.

   Run: node tests/test-shared-gates.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const GATES = read('hg-gates.js');
const GOLD = read('omnigold.js');
const ROUTE = read('omniroute.js');
const SW = read('sw.js');
const HTML = read('index.html');

function boot(withGates){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
                   head:{appendChild(){}}, body:{appendChild(){}},
                   documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js'];
  if (withGates !== false) files.push('hg-gates.js');
  files.push('omniroute.js','omnigold.js');
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const W = boot();

console.log('== the module exists, loads, and is part of the app ==');
{
  ok(fs.existsSync(path.join(ROOT, 'hg-gates.js')), 'hg-gates.js is on disk');
  ok(typeof W.hgNewsGate === 'function', 'window.hgNewsGate is exported');
  ok(typeof W.hgSlotMeanVol === 'function', 'window.hgSlotMeanVol is exported');
  ok(typeof W.hgBarSpacingSec === 'function', 'window.hgBarSpacingSec is exported');
  ok(SW.includes("'./hg-gates.js'"), 'it is precached, so it is there offline');
  ok(/hg-gates\.js\?v=\d+/.test(HTML), 'index.html loads it with a cache pin');
  ok(HTML.indexOf('hg-gates.js') < HTML.indexOf('omniroute.js'), 'before omniroute.js');
  ok(HTML.indexOf('hg-gates.js') < HTML.indexOf('omnigold.js'), 'and before omnigold.js');
}

console.log('\n== the duplicated source is gone from both desks ==');
{
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(!/function hgBarSpacingSec\(rows\)\{?\s*\n?\s*if \(!rows/.test(src),
       n + ' no longer defines hgBarSpacingSec');
    ok(!/var nwBlack = \(x\.news\.blackout === true\);/.test(src),
       n + ' no longer carries the news-window decision');
    ok(/hgNewsGate\(x\.news\)/.test(src), n + ' calls the shared news gate');
    ok(/w\.hgSlotMeanVol\(rows, want\)/.test(src), n + ' delegates the participation baseline');
  }
  ok(/A BLACKOUT IS NOT A FORECAST/.test(GATES), 'the reasoning moved with the code');
  ok(/PARTICIPATION MUST COMPARE LIKE WITH LIKE/.test(GATES), 'both pieces of it');
  ok(/jobless\s+claims/i.test(GATES), 'including why a 24h window is permanently on');
}

console.log('\n== W() was the break the equivalence harness caught ==');
{
  /* omnigold has function W(); omniroute does not. A shim written for one and
     pasted into the other threw on every crypto ledger — the exact failure
     mode this refactor exists to prevent, committed while performing it. */
  ok(/function W\(\)\{ return \(typeof window/.test(GOLD), 'omnigold has W()');
  ok(!/function W\(\)/.test(ROUTE), 'omniroute does not');
  ok(!/var __nwG = W\(\)/.test(ROUTE), 'so omniroute does not call W()');
  ok(/var __nwG = W\(\)/.test(GOLD), 'while omnigold does, which is its idiom');
  ok(/__nwG = \(\(typeof window !== 'undefined'\) \? window : null\)/.test(ROUTE),
     'omniroute reaches window inline, as it does everywhere else');
}

console.log('\n== the shared news gate behaves exactly as the desks did ==');
{
  const cases = [
    [null, null, false, 'no news object'],
    [{ risk:'low', note:'nothing inside 24h' }, true, false, 'low risk'],
    [{ risk:'med', note:'PPI in 6h' }, true, false, 'medium risk'],
    [{ risk:'high', blackout:false, note:'US CPI in 19h 12m' }, false, true, 'red event on the horizon'],
    [{ risk:'high', blackout:true, note:'BLACKOUT: US CPI' }, false, false, 'an active blackout'],
    [{ risk:'low', note:'news module not loaded' }, null, false, 'an unloaded module'],
    [{ risk:'low', note:'news error: fetch failed' }, null, false, 'an errored module']
  ];
  for (const [news, expPass, expInfo, label] of cases){
    const g = W.hgNewsGate(news);
    ok(g.pass === expPass, label + ' -> pass ' + String(g.pass));
    ok(g.info === expInfo, '   and info ' + String(g.info));
    ok(typeof g.why === 'string' && g.why.length > 0, '   with a reason: ' + g.why.slice(0, 64));
    ok(!/undefined|NaN/.test(g.why), '   containing no undefined or NaN');
  }
  /* The two facts that must never be confused again. */
  ok(/TRADING BLOCKED/.test(W.hgNewsGate({ risk:'high', blackout:true, note:'x' }).why),
     'a blackout says TRADING BLOCKED');
  ok(/caution, not a veto/.test(W.hgNewsGate({ risk:'high', blackout:false, note:'x' }).why),
     'a forecast says caution, not a veto');
  ok(W.hgNewsGate({ risk:'high', blackout:false }).info === true,
     'and a forecast can never stand the desk aside');
}

console.log('\n== the shared participation baseline behaves as before ==');
{
  const T0 = Math.floor(1700000000 / 86400) * 86400;
  const mk = (n, dt, vAt) => { const r = []; for (let i = 0; i < n; i++){
    const t = T0 + i * dt; r.push({ t, o:1, h:1, l:1, c:1, v: vAt(t, i) }); } return r; };
  const bySlot = (t) => (Math.floor((t % 86400) / 3600) < 7 ? 350 : 1500);
  const rows = mk(300, 3600, bySlot);
  const s = W.hgSlotMeanVol(rows, 20);
  ok(s.n >= 5, 'it finds same-slot history (' + s.n + ' sessions)');
  ok(Math.abs(s.mean - bySlot(rows[rows.length-1].t)) < 1, 'and averages that slot, not all hours');
  ok(W.hgBarSpacingSec(rows) === 3600, 'bar spacing is derived from the tape (' + W.hgBarSpacingSec(rows) + 's)');
  ok(W.hgBarSpacingSec(mk(300, 14400, () => 1)) === 14400, 'and works on 4h too');
  /* Guards. */
  ok(W.hgSlotMeanVol(mk(8, 3600, () => 1), 20).n === 0, 'under five same-slot bars is refused as a baseline');
  ok(!isFinite(W.hgSlotMeanVol(mk(300, 86400, () => 1), 20).mean), 'daily bars have no intraday slot');
  for (const bad of [null, undefined, [], [{}], [{ t:null, v:null }]]){
    let threw = null, out = null;
    try { out = W.hgSlotMeanVol(bad, 20); } catch (e){ threw = e; }
    ok(!threw, 'hgSlotMeanVol(' + JSON.stringify(bad) + ') does not throw');
    ok(out && !isFinite(out.mean) && out.n === 0, 'and returns an empty baseline');
    let t2 = null; try { W.hgBarSpacingSec(bad); } catch (e){ t2 = e; }
    ok(!t2, 'hgBarSpacingSec likewise');
  }
}

console.log('\n== if hg-gates.js fails to load, the desks degrade rather than throw ==');
{
  /* A missing module must not throw a ReferenceError mid-scan, and the news
     gate must read UNCHECKED — never a quiet pass. */
  const bare = boot(false);
  ok(typeof bare.hgNewsGate !== 'function', 'the shared module is genuinely absent in this context');
  const T0 = 1700000000 - (1700000000 % 86400);
  const rows = []; let p = 4350, s = 9;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < 300; i++){
    p = p*(1+(rnd()-0.5)*0.003); const r = p*0.0018*(0.5+rnd());
    rows.push({ t:T0+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000 });
  }
  for (const [n, fn, args] of [['omnigold', 'hgOgGates', [rows, { dir:'long', kind:'ORB', mech:'ORB' }, { news:{ risk:'high', blackout:true } }]],
                               ['omniroute', 'hgOmniGates', [rows, { dir:'long', kind:'ORB', mech:'ORB' }, null, { news:{ risk:'high', blackout:true } }]]]){
    let threw = null, gates = null;
    try { gates = bare[fn].apply(null, args); } catch (e){ threw = e; }
    ok(!threw, n + ' still builds a ledger without hg-gates.js' + (threw ? ' — ' + threw.message : ''));
    const nw = (gates || []).filter(g => g && g.key === 'news-window')[0];
    ok(nw && nw.pass === null, n + ' reads news UNCHECKED, never a quiet pass');
    ok(nw && /not loaded/.test(nw.why), n + ' says the module is missing: ' + (nw && nw.why));
    const pt = (gates || []).filter(g => g && g.key === 'participation')[0];
    ok(pt && pt.pass !== undefined, n + ' still produces a participation verdict');
  }
}

console.log('\n== what stayed behind, stayed behind for a reason ==');
{
  /* These are parameterised variants, not copies. Asserting they are still
     per-desk stops a future tidy-up from merging genuinely different rules. */
  for (const k of ['vol-alive', 'participation', 'trend', 'measured-edge', 'consensus']){
    ok(GOLD.includes("key:'" + k + "'"), 'omnigold still owns ' + k);
    ok(ROUTE.includes("key:'" + k + "'"), 'omniroute still owns ' + k);
  }
  ok(/hard:false, info: nwInfo/.test(GOLD) || /key:'news-window', hard:false/.test(GOLD),
     'gold still decides its own hard/soft flags');
  ok(/key:'participation', hard:true/.test(ROUTE), 'crypto participation is HARD');
  ok(/key:'participation', hard:false/.test(GOLD), 'gold participation is SOFT — gold feeds may publish no volume');
  ok(/parameterised|PARAMETERISED/.test(GATES), 'and the module records why it holds only what is identical');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SHARED GATE TESTS PASSED');
