/* HARDGATE — PAID-ONLY MODE + DESK VERDICT across the scanner tabs (hg-v540).

   THE CLAIMS UNDER TEST:

     1. hgFwdPaidKinds(tab) names EXACTLY the mechanics whose live forward
        ledger reads 'has paid' — the same hgOmniPoolRead chain the FORWARD
        table renders — and FAILS CLOSED (empty array) when that chain is
        not loaded.
     2. hgFwdDeskVerdictHtml(tab) computes its forward clause LIVE from the
        pool at render (mutate the pool, the strip changes), bakes ONLY the
        replay clause, and cites the replay artifacts.
     3. Each tab's PAID-ONLY view keeps exactly the paid-mechanic cards and
        summarizes the hidden rest honestly; an empty pool produces the
        honest 'no mechanic has paid yet (pool: X settled)' text.
     4. The toggle persists per tab in localStorage, and ALL mode restores
        the captured render BYTES verbatim — nothing deleted. OMNIPRESENT is
        proven end-to-end through the real scan loop.

   Run: node tests/test-paid-only-desk-verdict.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FULL_FILES = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                    'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js'];

function boot(files){
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of (files || FULL_FILES)) vm.runInContext(read(f), ctx, { filename: f });
  ctx.__store = store;
  return ctx;
}

const NOW = Math.floor(Date.now() / 1000);

/* One settled WIN: entry 100, stop 98, T1 104 (2R); the walk banks the +1R
   shadow then rides to T1, so the record carries bankR (a matched pair). */
function seedWin(W, tab, mech, sym, i){
  W.hgFwdRecord({ tab, mechanic: mech, sym, tf: '4h', dir: 'long',
                  entry: 100, stop: 98, t1: 104, barT: NOW - (600 + i) * 3600, horizonBars: 20 });
  const bars = [];
  for (let k = 1; k <= 6; k++)
    bars.push({ t: NOW - (600 + i) * 3600 + k * 4 * 3600, o: 100, h: k === 3 ? 105 : 101, l: 99, c: 100, v: 1 });
  W.hgFwdResolve(sym, '4h', bars);
}
/* One settled STOP: first bar trades through 98 before anything else. */
function seedLoss(W, tab, mech, sym, i){
  W.hgFwdRecord({ tab, mechanic: mech, sym, tf: '4h', dir: 'long',
                  entry: 100, stop: 98, t1: 104, barT: NOW - (600 + i) * 3600, horizonBars: 20 });
  const bars = [{ t: NOW - (600 + i) * 3600 + 4 * 3600, o: 100, h: 99, l: 97, c: 98, v: 1 }];
  W.hgFwdResolve(sym, '4h', bars);
}

console.log('== hgFwdPaidKinds: the shared read, fail-closed ==');
{
  /* Without omniroute.js the judging chain (hgOmniPoolRead) is absent —
     a winning pool must still return NOTHING, never a pass. */
  const W = boot(['hg-forward.js']);
  for (let i = 0; i < 40; i++) seedWin(W, 'T', 'GOOD', 'A' + i, i);
  ok(Array.isArray(W.hgFwdPaidKinds('T', 2)) && W.hgFwdPaidKinds('T', 2).length === 0,
     'no hgOmniPoolRead loaded -> [] even over a 40-win pool (fail closed)');
  ok(W.hgFwdPaidKinds(null).length === 0, 'null tab -> []');
}
{
  const W = boot();
  ok(W.hgFwdPaidKinds('NOSUCHTAB', 2).length === 0, 'an empty pool -> []');
  for (let i = 0; i < 40; i++) seedWin(W, 'T', 'GOOD', 'A' + i, i);
  for (let i = 0; i < 25; i++) seedLoss(W, 'T', 'BAD', 'B' + i, i);
  const paid = W.hgFwdPaidKinds('T', 2);
  ok(paid.length === 1 && paid[0] === 'GOOD',
     'exactly the has-paid mechanic is named: ' + JSON.stringify(paid));
  /* the same stats through the FORWARD table read agree — nothing reimplemented */
  const pool = W.hgFwdPool('T');
  const barZ = W.hgOmniFamilyZ(2);
  ok(W.hgOmniPoolRead(pool.GOOD, 2, 20, barZ).read === 'has paid', 'GOOD reads has paid at the family-wise bar');
  ok(W.hgOmniPoolRead(pool.BAD, 2, 20, barZ).read === 'has not paid', 'BAD reads has not paid');
}

console.log('\n== DESK VERDICT: baked replay clauses, cited to their artifacts ==');
{
  const W = boot();
  const or = W.hgFwdDeskVerdictHtml('OMNIROUTE');
  ok(/no settled history yet/.test(or), 'fresh pool -> honest forward clause');
  ok(/-0\.24R/.test(or) && /backtest-omniroute-v531-results\.json/.test(or),
     'OMNIROUTE replay clause: -0.24R net, cited to its JSON');
  ok(/~49% probability|has ~49% probability/.test(or) && /expected variance, not malfunction/.test(or),
     'the variance note is on the strip');
  const og = W.hgFwdDeskVerdictHtml(['OMNIGOLD:SCALP', 'OMNIGOLD:SWING']);
  ok(/EVERY tier/.test(og) && /-1\.35R/.test(og) && /backtest-omnigold-results\.json/.test(og),
     'OMNIGOLD replay clause: every tier negative, cited');
  const op = W.hgFwdDeskVerdictHtml('OMNIPRESENT');
  ok(/BOTH kinds/.test(op) && /backtest-omnipresent-results\.json/.test(op),
     'OMNIPRESENT replay clause: both kinds negative, cited');
  ok(W.hgFwdDeskVerdictHtml(null) === '', 'no tab -> empty string, never a throw');
  /* the baked numbers match the artifacts on disk — the citation is real */
  const orJson = JSON.parse(read('scripts/backtest-omniroute-v531-results.json'));
  ok(Math.abs(orJson.aggregates.overall.avgNetR - (-0.2424)) < 1e-4 && orJson.aggregates.overall.n === 2832,
     'omniroute artifact really says -0.2424R over n=2832');
  const opJson = JSON.parse(read('scripts/backtest-omnipresent-results.json'));
  ok(opJson.aggregates.byKind['OP-HIGH-REJECT'].avgNetR < 0 && opJson.aggregates.byKind['OP-LOW-REJECT'].avgNetR < 0,
     'omnipresent artifact really says both kinds net-negative');
}

console.log('\n== DESK VERDICT: the forward clause is LIVE — mutate the pool, the strip changes ==');
{
  const W = boot();
  for (let i = 0; i < 40; i++) seedWin(W, 'OMNIROUTE', 'SPRING', 'W' + i, i);
  const s1 = W.hgFwdDeskVerdictHtml('OMNIROUTE');
  ok(/as traded \+2\.00R\/trade over 40 settled pairs/.test(s1),
     'after 40 wins: as traded +2.00R over 40 pairs');
  for (let i = 0; i < 10; i++) seedLoss(W, 'OMNIROUTE', 'SPRING', 'L' + i, i);
  const s2 = W.hgFwdDeskVerdictHtml('OMNIROUTE');
  ok(/as traded \+1\.40R\/trade over 50 settled pairs/.test(s2),
     'after 10 more stops: +1.40R over 50 pairs — the strip moved with the pool');
  ok(s1 !== s2, 'the two renders differ — live numbers, not baked');
}

console.log('\n== OMNIROUTE: PAID-ONLY keeps exactly the paid cards ==');
{
  const W = boot();
  for (let i = 0; i < 40; i++) seedWin(W, 'OMNIROUTE', 'SPRING', 'W' + i, i);
  const paid = W.hgOmniPaidKinds();
  ok(paid.length === 1 && paid[0] === 'SPRING', 'the desk names SPRING paid');
  const cand = (sym, kind) => ({ sym, base: sym, exchange: 'delta', kind, dir: 'long',
    why: 'synthetic', level: 100,
    plan: { entry: 100, stop: 98, t1: 104, t2: 106, rr1: 2, riskPct: 2 },
    grade: { ticket: true, vetoes: [], evaluated: 5, total: 5 }, gates: [] });
  const html = W.hgOmniPaidCardsHtml([cand('AAAUSD', 'SPRING'), cand('BBBUSD', 'ORB')], null, paid);
  ok(/AAAUSD/.test(html), 'the paid-mechanic card renders');
  ok(!/BBBUSD/.test(html), 'the unpaid-mechanic card does not');
  ok(/1 setup\(s\) hidden by PAID-ONLY — mechanics without a paid forward record/.test(html),
     'the hidden count is summarized honestly');
  ok(/20X and APEX below keep their own gates/.test(html), 'and the 20X/APEX no-double-filter rule is stated');
  /* empty paid set -> honest summary with the live settled count */
  const none = W.hgOmniPaidCardsHtml([cand('AAAUSD', 'ORB')], null, []);
  ok(/no mechanic on this tab currently reads/.test(none) && /pool: 40 settled/.test(none),
     'no paid mechanic -> honest text with the live settled count');
  ok(/no PAID-ONLY setup this scan/.test(none), 'and an explicit empty state');
  /* apply-mode before any scan is a safe no-op */
  const fakeUi = { cards: { innerHTML: 'UNTOUCHED' }, mp: { innerHTML: 'MP' } };
  W.hgOmniShowModeSet('PAID');
  W.hgOmniApplyShowMode(fakeUi);
  ok(fakeUi.cards.innerHTML === 'UNTOUCHED', 'PAID mode before any scan leaves the desk alone');
}

console.log('\n== OMNIGOLD: paid per horizon pool, demotions untouched ==');
{
  const W = boot();
  for (let i = 0; i < 40; i++) seedWin(W, 'OMNIGOLD:SCALP', 'ASIA-BREAK', 'G' + i, i);
  const sets = W.hgOgPaidSets();
  ok(sets.SCALP.indexOf('ASIA-BREAK') >= 0, 'ASIA-BREAK paid in the SCALP pool');
  ok(sets.SWING.length === 0, 'and NOT in the SWING pool — horizons never merge');
  ok(W.hgOgKindPaid({ kind: 'ASIA-BREAK', horizon: 'SCALP' }, sets) === true, 'a SCALP card passes');
  ok(W.hgOgKindPaid({ kind: 'ASIA-BREAK', horizon: 'SWING' }, sets) === false,
     'the same kind on SWING does not — judged against its own horizon');
  const gc = (kind, horizon) => ({ kind, horizon, dir: 'long', why: 'synthetic',
    plan: { entry: 2400, stop: 2395, t1: 2410, t2: 2420, rr1: 2, riskPct: 0.2 },
    grade: { ticket: true, vetoes: [], evaluated: 5, total: 5 }, gates: [] });
  const html = W.hgOgPaidCardsHtml([gc('ASIA-BREAK', 'SCALP'), gc('MMOVE', 'SWING')], sets);
  ok(/ASIA-BREAK/.test(html), 'the paid SCALP card renders');
  ok(/1 setup\(s\) hidden by PAID-ONLY/.test(html) && !/MMOVE [A-Z]* ?LONG.*ENTRY/.test(html),
     'the unpaid SWING card is hidden and counted');
  ok(/Demoted kinds remain stood aside exactly as under ALL/.test(html),
     'the summary states demotions are unchanged');
  /* fresh boot, empty pools -> the honest empty summary */
  const W2 = boot();
  const none = W2.hgOgPaidCardsHtml([gc('MMOVE', 'SWING')], W2.hgOgPaidSets());
  ok(/no mechanic on this desk currently reads/.test(none) && /pool: 0 settled across SCALP\+SWING/.test(none),
     'empty pools -> honest text with the live settled count');
}

console.log('\n== toggle persistence: per-tab keys, round-trip ==');
{
  const W = boot();
  W.hgOmniShowModeSet('PAID'); W.hgOgShowModeSet('PAID'); W.opShowModeSet('PAID');
  ok(W.__store['hg_paidonly_OMNIROUTE'] === '1', 'omniroute persists under its own key');
  ok(W.__store['hg_paidonly_OMNIGOLD'] === '1', 'omnigold under its own');
  ok(W.__store['hg_paidonly_OMNIPRESENT'] === '1', 'omnipresent under its own');
  ok(W.hgOmniShowMode() === 'PAID' && W.hgOgShowMode() === 'PAID' && W.opShowMode() === 'PAID',
     'all three read back PAID');
  W.hgOmniShowModeSet('ALL'); W.hgOgShowModeSet('ALL'); W.opShowModeSet('ALL');
  ok(!('hg_paidonly_OMNIROUTE' in W.__store) && !('hg_paidonly_OMNIGOLD' in W.__store)
     && !('hg_paidonly_OMNIPRESENT' in W.__store), 'ALL removes the keys — default state stores nothing');
  ok(W.hgOmniShowMode() === 'ALL' && W.hgOgShowMode() === 'ALL' && W.opShowMode() === 'ALL',
     'and all three read back ALL');
}

console.log('\n== OMNIPRESENT end-to-end: scan, filter, restore BYTE-IDENTICAL ==');
{
  const W = boot();
  /* the same explicit double-top tape test-omnipresent drives the scan with */
  function topTape(n){
    const out = []; let s = 5;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < n; i++){
      let p;
      const tail = n - i;
      if (tail > 70) p = 95 + Math.sin(i / 9) * 3 + (rnd() - 0.5) * 0.6;
      else if (tail > 50) p = 96 + (70 - tail) * 0.72;
      else if (tail > 40) p = 110.4 - (50 - tail) * 0.42;
      else if (tail > 30) p = 106.2 + (40 - tail) * 0.40;
      else p = 110.2 - (30 - tail) * 0.06 - Math.sin(i / 5) * 0.2;
      out.push({ t: 1700000000 + i * 3600, o: p - 0.2, h: p + 0.35, l: p - 0.55, c: p, v: 700 + rnd() * 200 });
    }
    return out;
  }
  const UNI = [];
  for (let i = 0; i < 8; i++) UNI.push({ sym: 'OP' + i + 'USD', base: 'OP' + i, exchange: 'delta' });
  W.xuUniverse = () => Promise.resolve(UNI);
  W.xuCandles = () => Promise.resolve(topTape(360));
  const mk = () => ({ innerHTML: '', textContent: '', disabled: false, style: {}, addEventListener(){} });
  const ui = { btn: mk(), stat: mk(), cards: mk(), x20: mk(), verdict: mk(), showMode: mk() };
  await W.hgOpRunScan(ui);
  const bytesAll = ui.cards.innerHTML;
  const bytesX20 = ui.x20.innerHTML;
  ok(bytesAll.length > 100, 'the scan painted the ALL view');
  ok(/DESK VERDICT/.test(ui.verdict.innerHTML) && /BOTH kinds/.test(ui.verdict.innerHTML),
     'the verdict strip painted after the scan, replay clause included');
  ok(/no settled history yet|settled/.test(ui.verdict.innerHTML), 'with a live forward clause');
  /* flip to PAID: the young pool hides everything, and says so */
  W.opShowModeSet('PAID');
  W.opApplyShowMode(ui);
  ok(/data-op-paidonly/.test(ui.cards.innerHTML), 'PAID-ONLY view applied');
  ok(/no mechanic on this tab has a paid forward record yet \(pool: \d+ settled\)/.test(ui.cards.innerHTML),
     'the young-pool summary is the honest one, with the live settled count');
  ok(/geometry-only tier is hidden/.test(ui.cards.innerHTML), 'and states the 20X geometry-tier rule');
  ok(ui.cards.innerHTML !== bytesAll, 'the view actually changed');
  /* flip back to ALL: the exact bytes come back — NOTHING DELETED */
  W.opShowModeSet('ALL');
  W.opApplyShowMode(ui);
  ok(ui.cards.innerHTML === bytesAll, 'ALL restores the card bytes VERBATIM');
  ok(ui.x20.innerHTML === bytesX20, 'and the 20X bytes');
  /* a scan run while PAID persists applies the filter by itself */
  W.opShowModeSet('PAID');
  await W.hgOpRunScan(ui);
  ok(/data-op-paidonly/.test(ui.cards.innerHTML), 'a scan under persisted PAID mode lands filtered');
  W.opShowModeSet('ALL');
  W.opApplyShowMode(ui);
  ok(/<div class="card">/.test(ui.cards.innerHTML), 'and ALL brings the cards back');
}

console.log('\n== the 20X section: opts is inert unless the flag is true ==');
{
  const W = boot();
  ok(W.opX20SectionHtml([]) === W.opX20SectionHtml([], {}),
     'an empty opts object renders byte-identically to no opts');
  ok(W.opX20SectionHtml([]) === W.opX20SectionHtml([], { hideGeomTier: false }),
     'and so does an explicit false');
  const SRC = read('omnipresent.js');
  ok(/opts && opts\.hideGeomTier === true/.test(SRC),
     'the hide branch is reachable only through the explicit flag');
}

console.log('\n== OMNIROUTE PAID-ONLY: a paid mechanic does not revive dead levels ==');
{
  const W = boot();
  for (let i = 0; i < 40; i++) seedWin(W, 'OMNIROUTE', 'SPRING', 'W' + i, i);
  const paid = W.hgOmniPaidKinds();
  ok(paid.indexOf('SPRING') >= 0, 'SPRING is paid');
  const dead = { sym: 'DEADUSD', base: 'DEADUSD', exchange: 'delta', kind: 'SPRING', dir: 'long',
    why: 'synthetic', level: 100,
    plan: { entry: 100, stop: 98, t1: 104, t2: 106, rr1: 2, riskPct: 2 },
    grade: { ticket: false, vetoes: ['level-fresh'], evaluated: 4, total: 5 },
    gates: [{ key: 'level-fresh', hard: false, info: false, pass: false,
              why: 'DEAD ON ARRIVAL — market moved past the level' }] };
  const live = { sym: 'LIVEUSD', base: 'LIVEUSD', exchange: 'delta', kind: 'SPRING', dir: 'long',
    why: 'synthetic', level: 100,
    plan: { entry: 100, stop: 98, t1: 104, t2: 106, rr1: 2, riskPct: 2 },
    grade: { ticket: true, vetoes: [], evaluated: 5, total: 5 }, gates: [] };
  const html = W.hgOmniPaidCardsHtml([dead, live], null, paid);
  ok(/LIVEUSD/.test(html), 'the live paid card renders in full');
  ok(/DEADUSD SPRING LONG — levels dead on arrival · card not rendered/.test(html),
     'the dead-level paid card collapses to the ALL view\'s one-line treatment');
  ok(/DEAD LEVELS — priced off a closed bar/.test(html), 'under the same DEAD LEVELS header the ALL view uses');
  /* the dead card's tradable numbers must NOT print — that full-size render
     is the exact bug the ALL view collapsed */
  const deadIdx = html.indexOf('DEADUSD');
  ok(deadIdx >= 0 && html.indexOf('DEADUSD', deadIdx + 1) < 0,
     'the dead setup appears exactly once — the dim line, never a card');
}

console.log('\n== empty scans refresh the show-mode snapshot — no stale-card resurrection ==');
{
  const OR = read('omniroute.js'), OG = read('omnigold.js');
  /* Each desk's empty-scan branch must reset the snapshot: lastAllView to
     the fresh empty bytes and lastView to null, so the toggle can never
     restore a previous scan's setups over an honest empty result. */
  const orEmpty = OR.indexOf('no setup fired on any contract');
  const orNull = OR.indexOf('__omni.lastView = null');
  ok(orEmpty > 0 && orNull > orEmpty && (orNull - orEmpty) < 2500,
     'omniroute empty branch nulls lastView beside the empty-state paint');
  ok(OR.indexOf('__omni.lastAllView = { cards: ui.cards.innerHTML', orEmpty) > 0
     && OR.indexOf('__omni.lastAllView = { cards: ui.cards.innerHTML', orEmpty) < orNull,
     'and recaptures the fresh empty bytes for the ALL restore');
  const ogEmpty = OG.indexOf('no gold setup fired on either horizon');
  const ogNull = OG.indexOf('__og.lastView = null');
  ok(ogEmpty > 0 && ogNull > ogEmpty && (ogNull - ogEmpty) < 2500,
     'omnigold empty branch nulls lastView beside the empty-state paint');
  ok(OG.indexOf('__og.lastAllView = { cards: ui.cards.innerHTML', ogEmpty) > 0
     && OG.indexOf('__og.lastAllView = { cards: ui.cards.innerHTML', ogEmpty) < ogNull,
     'and recaptures the fresh empty bytes for the ALL restore');
  /* with lastView null, PAID mode leaves the honest empty state alone */
  const W = boot();
  const fakeUi = { cards: { innerHTML: 'EMPTY-STATE' }, mp: { innerHTML: 'MP' } };
  W.hgOmniShowModeSet('PAID');
  W.hgOmniApplyShowMode(fakeUi);
  ok(fakeUi.cards.innerHTML === 'EMPTY-STATE', 'PAID over a null snapshot leaves the empty state untouched');
}

console.log('\n== structure: capture the ALL bytes BEFORE applying the mode, every tab ==');
{
  const OR = read('omniroute.js'), OG = read('omnigold.js'), OP = read('omnipresent.js');
  ok(/__omni\.lastAllView = \{ cards: ui\.cards\.innerHTML/.test(OR)
     && OR.indexOf('__omni.lastAllView = { cards: ui.cards.innerHTML') < OR.indexOf('hgOmniApplyShowMode(ui);'),
     'omniroute captures, then applies');
  ok(/__og\.lastAllView = \{ cards: ui\.cards\.innerHTML/.test(OG), 'omnigold captures the ALL bytes');
  ok(/__op\.lastAllView = \{ cards: ui\.cards\.innerHTML/.test(OP), 'omnipresent captures the ALL bytes');
  ok(/ui\.cards\.innerHTML = __omni\.lastAllView\.cards/.test(OR), 'omniroute ALL restores the captured bytes');
  ok(/ui\.cards\.innerHTML = __og\.lastAllView\.cards/.test(OG), 'omnigold too');
  ok(/ui\.cards\.innerHTML = __op\.lastAllView\.cards/.test(OP), 'omnipresent too');
  /* the verdict strip refreshes after each scan, empty scans included */
  ok((OR.match(/hgOmniPaintVerdict\(ui\)/g) || []).length >= 3, 'omniroute paints the strip at mount + both scan branches');
  ok((OG.match(/hgOgPaintDeskVerdict\(ui\)/g) || []).length >= 3, 'omnigold likewise');
  ok((OP.match(/opPaintVerdict\(ui\)/g) || []).length >= 2, 'omnipresent likewise');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PAID-ONLY / DESK VERDICT TESTS PASSED');
process.exit(0);
