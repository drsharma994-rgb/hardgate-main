#!/usr/bin/env node
/* HARDGATE — hg-v1435 PINE/META wave-D pins.

   1. SHIVA GOLD nav registration (HG_NAV_GROUPS gold) + sw.js HG_SHELL
      membership + the hg-api-base.js comment tells the truth now.
   2. SHIVA GOLD behavior (the desk had ZERO logic pins before this suite):
      tab registration + mount, the scalp mint's EVIDENCE-only framing
      (measured -1.89R @XM both halves; chain stays, levels suppressed;
      lever restores), and its first forward-ledger seam
      (shivaRecordForward: SHIVAGOLD 15m/4h, 96/20 horizons, ticket:false,
      deduped, fail-open).
   3. PINE mirror + composite evidence paint (pooled -0.083R taker /
      -0.021R maker, composite -0.101R / -0.038R, both halves negative) and
      the ticket:false record demotion, with msb-ob's decay and cipher's
      divergence-only zero named.
   4. GANESH GOLD's first bake: HG_GANESH_WALK literal measured:true with
      the honesty stamp (0 scalp tickets / 1 swing ticket; WATCH book scalp
      -0.067R vs swing +0.28R @XM), the artifact on disk, the evidence-
      literal chain in sync, and the walker preserving measured bakes.
   5. BRAIN member-freshness labels: ~20 member snapshots get a
      fresh/aging/stale/no-clock/dark line; labels only, nothing gates.
   6. ?v= byte-check on the v1435 bump surfaces.

   Run: node tests/test-pinemeta-v1425.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };

/* ---------- minimal classic-script vm (mirrors the census boot) ---------- */
function bootCtx(files){
  const store = {};
  const el = () => ({ style: {}, innerHTML: '', textContent: '', value: '', disabled: false,
    appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add(){}, remove(){}, toggle(){} }, dataset: {} });
  const ctx = { console, Math, Date, Number, String, Object, Array, JSON, Error, TypeError,
    Promise, RegExp, Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, NaN, Infinity,
    setTimeout: (fn) => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} }, addEventListener(){}, removeEventListener(){},
    visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

console.log('== 1) SHIVA GOLD nav registration + precache + comment truth ==');
{
  const idx = read('index.html');
  const grp = idx.slice(idx.indexOf('HG_NAV_GROUPS'), idx.indexOf('HG_NAV_GROUPS') + 4000);
  const goldLine = (grp.match(/\{ id:'gold'[^}]*\}/) || [''])[0];
  ok(goldLine.includes("'shivagold'"), "HG_NAV_GROUPS gold group carries 'shivagold' statically");
  ok(goldLine.indexOf("'ganeshgold'") >= 0 && goldLine.indexOf("'shivagold'") > goldLine.indexOf("'ganeshgold'"),
    'shivagold sits beside ganeshgold in the GOLD group');
  const sw = read('sw.js');
  ok(sw.includes("'./shivagold.js'"), 'sw.js HG_SHELL precaches shivagold.js');
  ok(sw.includes("'./shiva-nav.js'"), 'sw.js HG_SHELL precaches shiva-nav.js');
  const api = read('hg-api-base.js');
  ok(api.includes("add('hgShivaDesk', 'shivagold.js?v=1451')") && api.includes("add('hgShivaNav', 'shiva-nav.js?v=1451')"),
    'hg-api-base shiva loaders carry ?v=1451');
  ok(api.includes('USED to claim'), 'the hg-api-base comment names its own earlier lie (honesty repair)');
  const nav = read('shiva-nav.js');
  ok(nav.includes("g.tabs.indexOf('shivagold') < 0"), 'shiva-nav splice guards on presence — no double-add against the static group');
}

console.log('== 2) SHIVA GOLD behavior: mount + evidence framing + ledger seam ==');
{
  const ctx = bootCtx(['shivagold.js']);
  ok(Array.isArray(ctx.HG_tabs) && ctx.HG_tabs.some(t => t && t.id === 'shivagold'),
    'shivagold.js registers its tab');
  ok(typeof ctx.hgShivaRender === 'function', 'hgShivaRender seam exported (first logic pin surface)');
  ok(typeof ctx.hgShivaRecordForward === 'function', 'hgShivaRecordForward seam exported');

  /* mount paints the panel (drive the tab's own mount) */
  const pane = { innerHTML: '' };
  ctx.HG_tabs.find(t => t.id === 'shivagold').mount(pane);
  ok(pane.innerHTML.includes('SHIVA GOLD TRADING FIRM') && pane.innerHTML.includes('shivaOut'),
    'mount paints the desk panel with #shivaOut');

  /* the scalp mint is EVIDENCE-only with the measured numbers, levels suppressed */
  const setupScalp = { status: 'setup', name: 'SCALP', side: 'long', lead: true,
    entry: 4100.5, stop: 4098.2, t1: { level: 4106.0, name: 'PDH' }, t2: { level: 4110, name: 'swing' },
    r1: 2.41, why: 'sweep → displacement → shift', steps: [['bias', 'yes']], htf: 'long', session: 'london' };
  const scalpHtml = ctx.hgShivaRender(setupScalp);
  ok(scalpHtml.includes('EVIDENCE ONLY') && scalpHtml.includes('-1.89R') && scalpHtml.includes('both halves'),
    'scalp setup card carries the EVIDENCE stamp with the measured numbers');
  ok(scalpHtml.includes('523 of 528'), 'the 523/528 cost-floor fact is named in the reason');
  ok(!/Entry \d/.test(scalpHtml), 'scalp card prints NO entry/stop/target block (demote-not-hide)');
  ok(scalpHtml.includes('sweep → displacement → shift'), 'the chain text still paints (evidence, not hidden)');

  /* the swing lane is untouched (n=10 — too thin to judge) */
  const setupSwing = Object.assign({}, setupScalp, { name: 'SWING' });
  const swingHtml = ctx.hgShivaRender(setupSwing);
  ok(/Entry \d/.test(swingHtml) && swingHtml.includes('Stop'), 'swing setup card keeps its levels');
  ok(!swingHtml.includes('EVIDENCE ONLY'), 'swing card carries no evidence demotion');

  /* every level-printing card reaches the house geometry-verdict line
     (the test-geometry-tab-coverage rule), fail-open when the seam is absent */
  ok(!swingHtml.includes('GEO-STUB'), 'no geometry line when the seam is absent (fail-open)');
  ctx.hgPlanGeometryLineHtml = () => '<div>GEO-STUB</div>';
  ok(ctx.hgShivaRender(setupSwing).includes('GEO-STUB'),
    'level-printing cards reach the geometry-verdict line (coverage rule)');
  delete ctx.hgPlanGeometryLineHtml;

  /* lever restores the old scalp card for the ledger comparison */
  ctx.HG_SHIVA_SCALP_EVIDENCE = false;
  const restored = ctx.hgShivaRender(setupScalp);
  ok(/Entry \d/.test(restored), 'HG_SHIVA_SCALP_EVIDENCE=false restores the scalp levels');
  delete ctx.HG_SHIVA_SCALP_EVIDENCE;

  /* the desk header carries the measured stamp */
  ok(read('shivagold.js').includes('hg-v1435 measured'), 'desk header names the census stamp');

  /* the first ledger seam: ticket:false, own tape, own horizons, deduped, fail-open */
  const captured = [];
  ctx.hgFwdRecordScan = (desk, tf, rows, opts) => { captured.push({ desk, tf, rows, opts }); };
  const bars15 = [{ t: 1000, o: 1, h: 1, l: 1, c: 1 }];
  const bars4 = [{ t: 2000, o: 1, h: 1, l: 1, c: 1 }];
  const okScalp = { status: 'setup', name: 'SCALP', side: 'short', entry: 4102, stop: 4105, t1: { level: 4096 }, r1: 2 };
  const okSwing = { status: 'setup', name: 'SWING', side: 'long', entry: 4090, stop: 4080, t1: { level: 4110 }, t2: { level: 4125 }, r1: 2 };
  const did = ctx.hgShivaRecordForward(okScalp, okSwing, bars15, bars4, 4101, 4095);
  ok(did === true && captured.length === 2, 'both lanes record on a setup');
  const [sc, sw2] = captured;
  ok(sc.desk === 'SHIVAGOLD' && sc.tf === '15m' && sc.opts.horizonBars === 96,
    'scalp records on the desk own 15m tape with its 96-bar horizon');
  ok(sw2.desk === 'SHIVAGOLD' && sw2.tf === '4h' && sw2.opts.horizonBars === 20,
    'swing records on the desk own 4h tape with its 20-bar horizon');
  ok(sc.rows[0].ticket === false && sc.rows[0].mechanic === 'SHIVA-SCALP',
    'the record is ticket:false under mechanic SHIVA-SCALP (evidence, not a call)');
  ok(String(sc.rows[0].evidence).includes('-1.89R'), 'the record row names the measured reason');
  ok(sc.rows[0].barT === 1000 && sw2.rows[0].barT === 2000, 'barT anchored at the last closed bar');
  ctx.hgShivaRecordForward(okScalp, okSwing, bars15, bars4, 4101, 4095);
  ok(captured.length === 2, 'the same setup on the same bar+levels dedups (90s refresh safety)');
  ctx.hgShivaRecordForward({ status: 'watch', name: 'SCALP' }, { status: 'none', name: 'SWING' }, bars15, bars4, 1, 1);
  ok(captured.length === 2, 'non-setups never record');
  delete ctx.hgFwdRecordScan;
  ok(ctx.hgShivaRecordForward(okScalp, okSwing, bars15, bars4, 1, 1) === false,
    'missing ledger fails open (returns false, never throws)');
}

console.log('== 3) PINE evidence paint + ticket:false demotion ==');
{
  const ctx = bootCtx(['pine-sub.js']);
  ok(typeof ctx.pineSubEvidenceBannerHTML === 'function', 'evidence banner seam exported');
  const b = ctx.pineSubEvidenceBannerHTML('MSB-OB');
  ok(b.includes('EVIDENCE') && b.includes('-0.083R') && b.includes('-0.021R') && b.includes('both halves'),
    'banner carries the pooled mirror numbers, both halves');
  ok(b.includes('+0.018R') && b.includes('decays'), "msb-ob's only-positive-and-decaying fact is named");
  ok(b.includes('divergence-only'), "cipher's zero-flip is named as divergence-only by design");
  ok(b.includes('n=14,147'), 'the pooled n is named');
  ctx.HG_PINE_MIRROR_EVIDENCE = false;
  ok(ctx.pineSubEvidenceBannerHTML('MSB-OB') === '', 'lever HG_PINE_MIRROR_EVIDENCE=false hides the banner');
  const sub = read('pine-sub.js');
  ok(sub.includes('ticket: ev ? false : !!sg.edgeTicket'),
    'pine-sub records demote to ticket:false under the lever');
  ok(sub.includes('pineSubEvidenceBannerHTML(statLabel) + pineSubRenderOut'),
    'the banner paints above every mirror scan output');
  ok(sub.includes('edgeTicket: !!sg.edgeTicket'), 'the gate provenance is preserved on the row');
  const comp = read('pine.js');
  ok(comp.includes('ticket: ev ? false : !!sg.edgeTicket') && comp.includes('-0.101R taker'),
    'the composite demotes the same way with its own pooled numbers');
  ok(comp.includes('lorentzian-kernel (composite-only) settled -0.137R'),
    'the composite banner names the composite-only script number');
}

console.log('== 4) GANESH GOLD first bake (measured:true) + walker guard ==');
{
  const art = JSON.parse(read('scripts/backtest-ganeshgold-results.json'));
  ok(art.measured === true, 'the walker artifact is measured:true');
  ok(Array.isArray(art.trades) && art.trades.length > 6000, 'the artifact carries the walked population (n>6000)');
  ok(art.meta && String(art.meta.note).includes('ZERO tickets') && String(art.meta.note).includes('+0.28R'),
    'the artifact note carries the honesty stamp (0 scalp tickets; swing WATCH +0.28R @XM)');
  ok(art.meta.cohorts && art.meta.cohorts.scalp && art.meta.cohorts.swing,
    'per-lane cohorts are baked for the next reader');
  const gg = read('ganeshgold.js');
  const begin = gg.indexOf('BEGIN GENERATED HG_GANESH_WALK');
  const end = gg.indexOf('END GENERATED HG_GANESH_WALK');
  ok(begin > 0 && end > begin, 'the hg-v921 marker pair is intact');
  const lit = gg.slice(begin, end);
  ok(lit.includes('measured: true'), 'the spliced literal reads measured:true');
  ok(lit.includes('hg-v1435 FIRST BAKE'), 'the literal names the first bake');
  ok(lit.includes('ZERO tickets') && lit.includes('POSITIVE BOTH HALVES'),
    'the literal carries the ticket truth and the swing WATCH-book truth');
  const walker = read('scripts/backtest-ganeshgold.mjs');
  ok(walker.includes('existingMeasuredBake') && walker.includes('preserved'),
    'the walker preserves a measured bake instead of clobbering it with measured:false');
  ok(walker.includes('const bake = existingMeasuredBake();'),
    'the guard is WIRED into writeUnmeasured (a disconnected helper would ship silently)');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/ganeshgold-evidence-literal.mjs')],
    { timeout: 15000 });
  ok(r.status === 0 && /up to date/.test(String(r.stdout)), 'the evidence-literal chain is in sync (no drift)');
}

console.log('== 5) BRAIN member-freshness labels ==');
{
  const ctx = bootCtx(['brain.js']);
  ok(typeof ctx.hgBrainMemberFreshness === 'function', 'hgBrainMemberFreshness seam exported');
  const now = Date.now();
  const snap = {
    newsState: { at: now - 5 * 60000 }, regime: { at: now - 4 * 60000, label: 'mixed' },
    engine: { at: now - 41 * 60000 }, oiflow: { at: now - 7 * 3600000 },
    tape: null, macro: { asOf: 'garbage-no-clock' }, fng: { v: 12 }
  };
  const f = ctx.hgBrainMemberFreshness(snap, now);
  ok(f && Array.isArray(f.rows) && f.rows.length >= 20, '~20 member snapshots get a freshness row');
  const by = Object.fromEntries(f.rows.map(r => [r.layer, r]));
  ok(by['regime'] && by['regime'].state === 'fresh' && by['regime'].ageMin === 4, 'a 4m regime read is fresh');
  ok(by['gate engine'] && by['gate engine'].state === 'aging' && by['gate engine'].ageMin === 41,
    'a 41m engine snapshot is aging');
  ok(by['oi flow'] && by['oi flow'].state === 'stale', 'a 7h oi-flow snapshot is stale');
  ok(by['tape'] && by['tape'].state === 'dark', 'a missing member is dark, never invented');
  ok(by['gold macro'] && by['gold macro'].state === 'no clock', 'a member with no readable clock says so');
  ok(typeof f.line === 'string' && f.line.includes('regime 4m') && f.line.includes('DARK'),
    'the paint line carries per-member ages and dark members');
  const junk = ctx.hgBrainMemberFreshness(null, now);
  ok(junk && Array.isArray(junk.rows) && junk.rows.every(r => r.state === 'dark'),
    'null snap degrades to all-dark, never throws');
  ok(f.rows.every(r => !('tier' in r) && !('dir' in r) && !('gate' in r)),
    'freshness rows carry NO tier/dir/gate fields — labels only by contract');
  const src = read('brain.js');
  ok(src.includes('id="brainMemberFresh"'), 'the ticket panel mounts the freshness strip');
  ok(src.includes("querySelector('#brainMemberFresh')"), 'paintEntryTickets paints the strip');
  ok(src.includes('labels only, nothing gates on them (hg-v1435)'), 'the paint says labels-only in words');
  ok((src.match(/__memberFresh = brainMemberFreshness/g) || []).length >= 1,
    'the synthesis stashes freshness from the SAME snap the votes read');
}

console.log('== 6) ?v= byte-check (live stamp; pack under test remains v1435) ==');
{
  const idx = read('index.html');
  ok(idx.includes('?v=1451') && !idx.includes('?v=1434'), 'index.html pins are all ?v=1451');
  const bs = read('build-stamp.js');
  ok(/version:\s*'hg-v1451'/.test(bs), 'build-stamp version is hg-v1451');
  ok(bs.includes('hg-v1435: PINE/META'), 'build-stamp pack names the wave');
  const sw = read('sw.js');
  ok(sw.includes("HG_CACHE = 'hg-v1451'"), 'sw.js cache id is hg-v1451');
  const tt = read('trendtable.js');
  ok(tt.includes('hg-v1451.') && tt.includes('?v=1451'), 'trendtable header + loader carry v1451');
  const api = read('hg-api-base.js');
  ok(api.includes("setAttribute('data-v', '1451')"), 'hg-api-base data-v is 1451');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const list = ledger.batches || ledger.entries || ledger;
  const arr = Array.isArray(list) ? list : Object.values(list)[0];
  ok(arr[arr.length - 1].version === 'hg-v1451', 'batch ledger last entry is hg-v1451');
}

console.log('\ntest-pinemeta-v1425: ' + passed + ' passed, 0 failed');
