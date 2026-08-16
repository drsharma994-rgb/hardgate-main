/* HARDGATE — the nine PINE sub-tabs, none of which had ever been loaded.

   Found by measuring which app modules are named by NO test: nine of 116, and
   all nine are PINE sub-tabs — roughly 800 lines and nine tabs the user can
   press RUN on, with zero verification behind them. They are also the files
   where v331 found an unguarded R:R division, fixed centrally in
   pine-sub.js; that central fix only holds because every module computes its
   raw sig.rr BEFORE handing the signal to pineSubEnrichSignal, which
   overwrites it. Nothing was checking that ordering.

   This loads all nine for real and pins what a sub-tab must satisfy:
     - it registers exactly one tab, with a unique id and a mount
     - mount() renders and does not throw, twice, and tolerates a torn DOM
     - its detector name resolves to a real function in pinemath.js — a typo
       there means pineSubRunScript silently returns null forever and the tab
       just never finds anything
     - its raw sig.rr assignment precedes the enrich call, so the central
       Infinity guard is not bypassed

   Run: node tests/test-pine-subtabs.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SUBTABS = [
  { file: 'pineavwap.js',  scan: 'pineAvwapScan',  detector: 'pineWeeklyAvwap' },
  { file: 'pinecipher.js', scan: 'pineCipherScan', detector: 'pineVumanchuCipher' },
  { file: 'pineht.js',     scan: 'pineHtScan',     detector: 'pineHalfTrend' },
  { file: 'pinemsb.js',    scan: 'pineMsbScan',    detector: 'pineMsbOb' },
  { file: 'pinenw.js',     scan: 'pineNwScan',     detector: 'pineNwEnvelope' },
  { file: 'pinerf.js',     scan: 'pineRfScan',     detector: 'pineRangeFilter' },
  { file: 'pinesmc.js',    scan: 'pineSmcScan',    detector: 'pineSmcCore' },
  { file: 'pinesmf.js',    scan: 'pineSmfScan',    detector: 'pineSmartMoneyFlow' },
  { file: 'pinesqz.js',    scan: 'pineSqzScan',    detector: 'pineSqueezeMomentum' }
];

/* A DOM small enough to run a mount() against, real enough that a mount which
   queries for its own controls finds them. */
function fakeEl(){
  const el = {
    _html: '', children: [],
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); },
    querySelector(){ return fakeControl(); },
    querySelectorAll(){ return []; },
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){}, removeEventListener(){},
    setAttribute(){}, getAttribute(){ return null; },
    style: {}, classList: { add(){}, remove(){}, contains(){ return false; } },
    textContent: '', disabled: false, dataset: {}
  };
  return el;
}
function fakeControl(){
  return {
    innerHTML: '', textContent: '', style: {}, disabled: false, dataset: {},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return fakeControl(); }, querySelectorAll(){ return []; },
    appendChild(c){ return c; }, classList: { add(){}, remove(){}, contains(){ return false; } }
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
    createElement: () => fakeEl(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild(){} },
    documentElement: { appendChild(){} },
    addEventListener(){}
  };
  ctx.HG_tabs = [];
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'pinemath.js', 'pine-sub.js']){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== every sub-tab loads, registers, and mounts ==');
{
  const ctx = boot();
  const before = ctx.HG_tabs.length;
  for (const s of SUBTABS){
    const src = fs.readFileSync(path.join(ROOT, s.file), 'utf8');
    let threw = null;
    try { vm.runInContext(src, ctx, { filename: s.file }); } catch (e) { threw = e; }
    ok(!threw, s.file + ' loads without throwing' + (threw ? ' (' + threw.message + ')' : ''));
    ok(typeof ctx[s.scan] === 'function', s.file + ' exports ' + s.scan);
  }
  const added = ctx.HG_tabs.length - before;
  ok(added === SUBTABS.length, 'all nine registered a tab (' + added + '/' + SUBTABS.length + ')');

  const ids = ctx.HG_tabs.map(t => t && t.id);
  ok(ids.every(Boolean), 'every registered tab has an id');
  ok(new Set(ids).size === ids.length, 'tab ids are unique — no sub-tab shadows another (' + ids.join(', ') + ')');

  for (const t of ctx.HG_tabs){
    ok(typeof t.mount === 'function', t.id + ': mount is a function');
    ok(typeof t.label === 'string' && t.label.length > 0, t.id + ': has a label');
  }
}

console.log('\n== mount renders, survives a second call, and tolerates a torn DOM ==');
{
  const ctx = boot();
  for (const s of SUBTABS) vm.runInContext(fs.readFileSync(path.join(ROOT, s.file), 'utf8'), ctx, { filename: s.file });

  for (const t of ctx.HG_tabs){
    const el = fakeEl();
    let threw = null;
    try { t.mount(el); } catch (e) { threw = e; }
    ok(!threw, t.id + ': mount does not throw' + (threw ? ' (' + threw.message + ')' : ''));
    ok(el.innerHTML.length > 50, t.id + ': mount actually rendered (' + el.innerHTML.length + ' chars)');
    ok(/RUN/i.test(el.innerHTML), t.id + ': rendered a run control');

    /* Mounting twice is what the tab switcher does. */
    let threw2 = null;
    try { t.mount(el); } catch (e) { threw2 = e; }
    ok(!threw2, t.id + ': second mount does not throw');

    /* A torn element — querySelector finds nothing — must not take the tab out. */
    const torn = fakeEl();
    torn.querySelector = () => null;
    let threw3 = null;
    try { t.mount(torn); } catch (e) { threw3 = e; }
    ok(!threw3, t.id + ': mount tolerates missing controls');
  }
}

console.log('\n== every detector name resolves to a real function ==');
{
  /* A typo here is invisible at runtime: pineSubRunScript returns null when
     the name does not resolve, so the tab scans, finds nothing, and reports
     an empty universe forever. */
  const ctx = boot();
  for (const s of SUBTABS){
    ok(typeof ctx[s.detector] === 'function', s.file + ' detector ' + s.detector + ' exists in pinemath.js');
  }

  /* And the name each module actually asks for matches what it declares. */
  for (const s of SUBTABS){
    const src = fs.readFileSync(path.join(ROOT, s.file), 'utf8');
    const m = src.match(/fn:\s*'([A-Za-z_]\w*)'/);
    ok(m && m[1] === s.detector, s.file + " declares fn: '" + s.detector + "'" + (m ? '' : ' (none found)'));
  }
}

console.log('\n== the central R:R guard is not bypassed by any of the nine ==');
{
  /* v331 defused an unguarded `Math.abs(t1-entry)/Math.abs(entry-stop)` — which
     is Infinity when entry === stop — once, inside pineSubEnrichSignal. That
     only works while each module assigns its raw sig.rr BEFORE calling enrich.
     If one ever reordered, the Infinity would survive again. */
  for (const s of SUBTABS){
    const src = fs.readFileSync(path.join(ROOT, s.file), 'utf8');
    const rrAt = src.search(/\bsig\.rr\s*=/);
    const enrichAt = src.search(/pineSubEnrichSignal\s*\(/);
    if (rrAt < 0){
      ok(true, s.file + ': computes no raw sig.rr of its own — nothing to bypass');
      continue;
    }
    ok(enrichAt > rrAt, s.file + ': raw sig.rr is computed BEFORE enrich, so the central guard overwrites it');
  }

  /* The guard itself, exercised through the shared entry point. */
  const ctx = boot();
  const degenerate = ctx.pineSubEnrichSignal(
    { sym: 'X', dir: 'long', entry: 100, stop: 100, t1: 110, isNew: true,
      rr: Math.abs(110 - 100) / Math.abs(100 - 100) },
    { gates: [] }, { newLong: true }
  );
  /* Stronger than it was: entry === stop no longer merely loses its R:R, the
     whole signal is dropped, because a trade with no risk distance is not a
     trade. The Infinity can no longer reach anything at all. */
  ok(degenerate === null, 'a signal carrying an Infinity R:R is dropped outright');
  const real = ctx.pineSubEnrichSignal(
    { sym: 'X', dir: 'long', entry: 100, stop: 98, t1: 104, isNew: true, rr: 999 },
    { gates: [] }, { newLong: true }
  );
  ok(Math.abs(real.rr - 2) < 1e-9, 'and a real signal is re-derived to its true 2R, not left at 999');
}

console.log('\n== a signal with unusable levels is dropped, not rendered ==');
{
  /* Six sub-tabs build their plan through pineSubBuildPlan, which always
     returns finite levels. Three — ht, msb, smc — read the detector's own
     res.entry / res.stop straight through, so they depend on a detector never
     naming a direction without real numbers behind it. It does.

     With opts.includeContext — exactly what the app passes via PINE_SCAN_OPTS
     — pineHalfTrend returns dir 'long' with NaN targets on a flat series, and
     dir 'short' with entry === null when closes are null. My first version of
     this block probed with {} instead and produced no direction at all in 30
     tries: a test that could not have failed, which is the thing
     tests/test-suite-not-vacuous.mjs exists to catch. */
  const ctx = boot();
  const APP_OPTS = { includeContext: true, recentBars: 5 };
  function mk(n, gen){ const o = []; for (let i = 0; i < n; i++) o.push(gen(i)); return o; }
  const CASES = {
    'flat':        mk(200, i => ({ t: i, o: 100, h: 100, l: 100, c: 100, v: 0 })),
    'zero volume': mk(200, i => ({ t: i, o: 100 + i, h: 101 + i, l: 99 + i, c: 100 + i, v: 0 })),
    'null closes': mk(200, i => ({ t: i, o: 100, h: 101, l: 99, c: null, v: 10 })),
    'NaN highs':   mk(200, i => ({ t: i, o: 100, h: NaN, l: 99, c: 100, v: 10 })),
    'negative':    mk(200, i => ({ t: i, o: -5, h: -4, l: -6, c: -5, v: 10 })),
    'trend':       mk(200, i => ({ t: i, o: 100 + i * 0.5, h: 101 + i * 0.5, l: 99 + i * 0.5, c: 100 + i * 0.5, v: 500 }))
  };

  let dirTotal = 0, dirWithBadLevels = 0;
  for (const [name, rows] of Object.entries(CASES)){
    let res = null, threw = null;
    try { res = ctx.pineHalfTrend(rows, APP_OPTS); } catch (e) { threw = e; }
    ok(!threw, 'pineHalfTrend / ' + name + ': does not throw');
    if (!res || !res.dir) continue;
    dirTotal++;
    const usable = typeof res.entry === 'number' && isFinite(res.entry)
                && typeof res.stop === 'number' && isFinite(res.stop)
                && res.entry !== res.stop;
    if (!usable) dirWithBadLevels++;

    const sig = ctx.pineSubEnrichSignal(
      { sym: 'X', dir: res.dir, scriptId: 'half-trend', entry: res.entry, stop: res.stop,
        t1: res.t1, t2: res.t2, isNew: true },
      { gates: [] }, res
    );
    if (usable){
      ok(sig !== null, 'pineHalfTrend / ' + name + ': a signal with real levels survives enrichment');
    } else {
      ok(sig === null, 'pineHalfTrend / ' + name + ': dir ' + res.dir + ' with entry '
        + String(res.entry) + ' is DROPPED, not rendered as a card');
    }
  }
  ok(dirTotal > 0, 'the detector actually named a direction on these inputs (' + dirTotal + ') — the block is not vacuous');
  ok(dirWithBadLevels > 0, 'and at least one of those had unusable levels (' + dirWithBadLevels + '), which is the case being guarded');

  const good = ctx.pineSubEnrichSignal(
    { sym: 'X', dir: 'long', scriptId: 'half-trend', entry: 100, stop: 98, t1: 104, isNew: true },
    { gates: [] }, { newLong: true }
  );
  ok(good !== null, 'the guard does not eat a signal with real levels');
  ok(Math.abs(good.rr - 2) < 1e-9, 'and it still carries its true 2R');

  const flat = ctx.pineSubEnrichSignal(
    { sym: 'X', dir: 'long', scriptId: 'half-trend', entry: 100, stop: 100, t1: 104, isNew: true },
    { gates: [] }, { newLong: true }
  );
  ok(flat === null, 'entry === stop is dropped too — no risk distance means no trade');

  for (const f of ['pineht.js', 'pinemsb.js', 'pinesmc.js']){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(/!res\.dir/.test(src), f + ' returns early when the detector names no direction');
  }
}


console.log('\n== the shared plan builder never emits a plan that cannot be traded ==');
{
  const ctx = boot();
  function rows(n, base, step){
    const out = [];
    let c = base;
    for (let i = 0; i < n; i++){
      c = c + step + Math.sin(i / 6) * step * 2;
      out.push({ t: 1700000000 + i * 14400, o: c - step, h: c + step * 2, l: c - step * 2, c: c, v: 900 + i });
    }
    return out;
  }
  let built = 0;
  for (const dir of ['long', 'short']){
    for (const r of [rows(120, 100, 0.4), rows(60, 3300, 2), rows(40, 5, 0.01)]){
      const px = r[r.length - 1].c;
      const plan = ctx.pineSubBuildPlan(dir, px, r);
      ok(plan && typeof plan === 'object', dir + ': a plan was returned');
      ok(isFinite(plan.entry) && isFinite(plan.stop) && isFinite(plan.t1), dir + ': entry, stop and t1 are all real numbers');
      ok(plan.entry !== plan.stop, dir + ': entry and stop differ, so risk is defined');
      const stopSide = dir === 'long' ? plan.stop < plan.entry : plan.stop > plan.entry;
      ok(stopSide, dir + ': the stop sits on the losing side of entry');
      const tgtSide = dir === 'long' ? plan.t1 > plan.entry : plan.t1 < plan.entry;
      ok(tgtSide, dir + ': the target sits on the winning side of entry');
      built++;
    }
  }
  ok(built === 6, 'six plans were actually built and checked (' + built + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PINE SUB-TAB TESTS PASSED');
