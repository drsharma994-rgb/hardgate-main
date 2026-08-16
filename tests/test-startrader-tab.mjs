/* HARDGATE — STAR TRADER, 966 lines that no test had ever executed.

   v339 measured which modules no test NAMES. This measures the weaker form of
   the same gap: modules a test names but only ever reads as TEXT. A module
   "covered" by a source grep is not covered at all. Twenty-one of 116 modules
   — about 4,700 lines — are never executed, and startradertab.js is the
   largest of them at 966 lines, grepped by four tests and run by none.

   Probing it did NOT turn up a live defect, which is worth stating plainly
   rather than dressing up:

     - stSynthesize can return a WATCH-tier setup with plan === null on chop
       data. That is intended, and cardHTML guards every level, the book
       button and the trade button behind `entry != null && stop != null`, so
       no untradeable card is offered. Pinned below so it stays that way.

     - stDropForming assumed second-resolution timestamps. Every feed this tab
       uses today reports seconds (binanceKlines divides by 1000, Yahoo
       reports seconds), so it was correct — but engine.js normalises
       milliseconds anyway, because both forms exist in this codebase. Without
       it a millisecond stamp makes `now - t` hugely negative, which is always
       < sec, so the newest CLOSED bar would be dropped on every scan and the
       tab would run a bar stale forever. Latent, not live; closed now, and
       the same one-line gap closed in omniroute's copy.

   Run: node tests/test-startrader-tab.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function fakeEl(){
  return {
    _html: '',
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); },
    querySelector(){ return fakeEl(); }, querySelectorAll(){ return []; },
    appendChild(c){ return c; }, addEventListener(){}, removeEventListener(){},
    setAttribute(){}, getAttribute(){ return null; },
    style: {}, classList: { add(){}, remove(){}, contains(){ return false; } },
    textContent: '', disabled: false, dataset: {}
  };
}

function boot(){
  const ctx = {
    console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, setTimeout, clearTimeout, encodeURIComponent
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => fakeEl(), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){}
  };
  ctx.HG_tabs = [];
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js',
                   'best-levels.js', 'formation.js', 'cryptogates.js', 'edge.js',
                   'squeeze.js', 'meanrev.js', 'startradertab.js']){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function gen(n, base, mode){
  const out = [];
  let c = base;
  for (let i = 0; i < n; i++){
    const k = n - 1 - i;
    if (mode === 'up') c = c * 1.005;
    else if (mode === 'down') c = c * 0.995;
    else if (mode === 'pullback') c = k < 3 ? c * 1.01 : (k < 12 ? c * 0.996 : c * 1.006);
    else c = c * (1 + (i % 2 ? 0.003 : -0.0029));
    const r = c * 0.006;
    out.push({ t: 1700000000 + i * 14400, o: c - r * 0.3, h: c + r, l: c - r, c: c,
               v: 1000 + (i > n - 8 ? 3000 : 0) });
  }
  return out;
}

console.log('== the tab loads and registers ==');
const W = boot();
{
  ok(W.HG_tabs.some(t => t && t.id === 'startrader'), 'startradertab registers the startrader tab');
  const tab = W.HG_tabs.find(t => t.id === 'startrader');
  ok(typeof tab.mount === 'function', 'it has a mount');
  ok(tab.label === 'STAR TRADER', 'it carries its label');
  ok(typeof W.stDropForming === 'function', 'stDropForming exported');
  ok(typeof W.stSynthesize === 'function', 'stSynthesize exported');
  ok(typeof W.stTierRank === 'function', 'stTierRank exported');

  const el = fakeEl();
  let threw = null;
  try { tab.mount(el); } catch (e) { threw = e; }
  ok(!threw, 'mount does not throw' + (threw ? ' (' + threw.message + ')' : ''));
  ok(el.innerHTML.length > 100, 'mount rendered (' + el.innerHTML.length + ' chars)');
  let threw2 = null;
  try { tab.mount(el); } catch (e) { threw2 = e; }
  ok(!threw2, 'a second mount does not throw');
}

console.log('\n== stDropForming drops a forming bar and keeps a closed one ==');
{
  const sec = 14400;
  const now = 1800000000;
  const closed = [{ t: now - sec * 3 }, { t: now - sec * 2 }, { t: now - sec }];
  ok(W.stDropForming(closed, '4h', now).length === 3, 'a bar exactly one interval old is CLOSED and kept');

  const forming = [{ t: now - sec * 3 }, { t: now - sec * 2 }, { t: now - 60 }];
  ok(W.stDropForming(forming, '4h', now).length === 2, 'a bar 60s old is still forming and is dropped');

  ok(W.stDropForming(closed, 'nope', now).length === 3, 'an unknown timeframe drops nothing');
  ok(W.stDropForming([], '4h', now).length === 0, 'an empty series is returned empty, not thrown on');
  ok(Array.isArray(W.stDropForming(null, '4h', now)), 'null rows return an array');
}

console.log('\n== a millisecond stamp does not discard the newest closed bar ==');
{
  const sec = 14400, now = 1800000000;
  /* Same three bars, stamped in ms. Before the fix now - t was hugely
     negative, always < sec, so the last CLOSED bar was dropped every time. */
  const closedMs = [{ t: (now - sec * 3) * 1000 }, { t: (now - sec * 2) * 1000 }, { t: (now - sec) * 1000 }];
  ok(W.stDropForming(closedMs, '4h', now).length === 3, 'ms-stamped closed bars are all kept');

  const formingMs = [{ t: (now - sec * 3) * 1000 }, { t: (now - sec * 2) * 1000 }, { t: (now - 60) * 1000 }];
  ok(W.stDropForming(formingMs, '4h', now).length === 2, 'and an ms-stamped forming bar is still dropped');

  const junk = [{ t: 'nonsense' }, { t: 0 }];
  ok(W.stDropForming(junk, '4h', now).length === 2, 'an unreadable stamp drops nothing rather than guessing');
}

console.log('\n== stSynthesize never throws, whatever the shape of the data ==');
{
  let built = 0, calls = 0;
  const setups = [];
  for (const mode of ['up', 'down', 'pullback', 'chop']){
    for (const klass of ['crypto', 'gold', 'forex']){
      const r4 = gen(260, 100, mode), r1 = gen(260, 100, mode), r15 = gen(260, 100, mode);
      const contract = { sym: 'TESTUSDT', base: 'TEST', klass: klass, label: 'TEST' };
      const tk = { symbol: 'TESTUSDT', fundingPct: klass === 'crypto' ? 0.01 : null, mark: r4[r4.length - 1].c };
      let s = null, threw = null;
      try { s = W.stSynthesize(contract, r4, r1, r15, tk); } catch (e) { threw = e; }
      calls++;
      ok(!threw, mode + '/' + klass + ': does not throw' + (threw ? ' (' + threw.message + ')' : ''));
      if (s){ built++; setups.push([mode + '/' + klass, s]); }
    }
  }
  ok(calls === 12, 'every combination was actually exercised (' + calls + ')');
  ok(built > 0, 'at least one setup was produced (' + built + ') — the block is not vacuous');

  /* Degenerate input must decline, not improvise. */
  const shorts = [[], gen(10, 100, 'up'), gen(209, 100, 'up')];
  for (const r of shorts){
    let threw = null, s = null;
    try { s = W.stSynthesize({ sym: 'X', klass: 'crypto' }, r, r, r, null); } catch (e) { threw = e; }
    ok(!threw, 'too-short history (' + r.length + ' bars): does not throw');
    ok(s === null, 'too-short history (' + r.length + ' bars): declines rather than synthesising');
  }

  console.log('\n== whatever it returns is either fully levelled or not levelled at all ==');
  for (const [tag, s] of setups){
    ok(s.dir === 'long' || s.dir === 'short', tag + ': names a direction');
    ok(['PRIME', 'HIGH', 'WATCH'].indexOf(s.tier) >= 0, tag + ': tier is one of PRIME/HIGH/WATCH (' + s.tier + ')');
    ok(Array.isArray(s.votes) && s.votes.length > 0, tag + ': carries the votes behind it');
    ok(s.votes.every(v => v.dir === s.dir), tag + ': every counted vote agrees with the direction');

    const p = s.plan;
    if (!p){
      /* Legitimate: a WATCH row with no plan. What matters is that nothing
         downstream offers it as a trade. */
      ok(s.tier === 'WATCH', tag + ': a setup with no plan is only ever WATCH tier (' + s.tier + ')');
      continue;
    }
    for (const k of ['entry', 'stop', 't1']){
      ok(typeof p[k] === 'number' && isFinite(p[k]), tag + ': plan.' + k + ' is a real number');
    }
    ok(p.entry !== p.stop, tag + ': entry and stop differ, so risk is defined');
    const stopSide = s.dir === 'long' ? p.stop < p.entry : p.stop > p.entry;
    ok(stopSide, tag + ': the stop sits on the losing side of entry');
    const tgtSide = s.dir === 'long' ? p.t1 > p.entry : p.t1 < p.entry;
    ok(tgtSide, tag + ': the target sits on the winning side of entry');
    if (p.dir) ok(p.dir === s.dir, tag + ': the plan agrees with the setup direction');
  }
}

console.log('\n== the card refuses to offer a trade it has no levels for ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'startradertab.js'), 'utf8');
  ok(/var entry = p && isFinite\(p\.entry\) \? p\.entry : null;/.test(src), 'entry is null unless the plan supplies one');
  ok(/bookBtn = \(!draft && entry != null && stop != null/.test(src), 'the BOOK button requires entry and stop');
  ok(/tradeOnclick = \(!draft && entry != null && stop != null/.test(src), 'the SEND TO TRADE PLAN button requires them too');
  ok(/if \(entry != null && stop != null && typeof W\.planBlock/.test(src), 'the levels block requires them as well');
}

console.log('\n== stTierRank orders the tiers the way the desk reads them ==');
{
  /* The desk sorts DESCENDING (stTierRank(b) - stTierRank(a)), so a higher
     rank is a better tier. My first version of this block asserted the
     opposite convention and failed — the test was wrong, not the ranking. */
  const r = t => W.stTierRank(t);
  ok(r('PRIME') > r('HIGH'), 'PRIME outranks HIGH (' + r('PRIME') + ' > ' + r('HIGH') + ')');
  ok(r('HIGH') > r('WATCH'), 'HIGH outranks WATCH (' + r('HIGH') + ' > ' + r('WATCH') + ')');
  ok(r('WATCH') > r('nonsense'), 'a real tier outranks an unrecognised one');
  ok(isFinite(r('nonsense')), 'an unknown tier returns a finite rank rather than NaN, so it sorts last instead of poisoning the sort');
  const sorted = ['WATCH', 'PRIME', 'HIGH'].sort((a, b) => r(b) - r(a));
  ok(sorted.join(',') === 'PRIME,HIGH,WATCH', 'the desk sort really does put PRIME first (' + sorted.join(',') + ')');
}

console.log('\n== omniroute got the same millisecond fix ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  ok(/if \(lastT > 1e12\) lastT = Math\.floor\(lastT \/ 1000\);/.test(src), 'hgOmniDropForming normalises milliseconds too');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL STAR TRADER TESTS PASSED');
