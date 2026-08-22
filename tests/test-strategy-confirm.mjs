/* HARDGATE — every scan tab stamps the same indicator confirmation.

   Tabs were forming tickets from local pattern gates and then skipping the
   shared 20-gate context bank. The result: a trap/SMC/OB/DIV/SMART card
   could print CLEAN levels while the tape objected, and MOST PROBABLE had
   no rank signal to prefer the aligned one.

   One helper, hgStrategyRefine (plans.js), is the chokepoint:

     NEVER invent levels or flip direction
     NEVER widen a stop
     NEVER delete a plan (adverse demotes rank, same -8 as contextWarn)
     Level changes OFF by default (refineLevels: true is opt-in)
     Reversion (fade / trap / meanrev) is graded as reversion — not
       punished for cascade oppose the way a trend ticket is
     Gold / XAU / PAXG skipped (those desks already run hgBestLevelsGold)
     G1–G7 literals stay exactly where they are

   Run: node tests/test-strategy-confirm.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extraFiles){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                 'hg-forward.js','hg-gates.js','hg-plan.js']
    .concat(extraFiles || []);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

/* Historical tape (old timestamps -> nothing is "forming"). */
function tape(n, drift, seed){
  const out = []; let p = 4350, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p*(1+(rnd()-0.5+drift)*0.003);
    const r = p*0.0016*(0.5+rnd());
    out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v: 900+rnd()*300 });
  }
  return out;
}

const W = boot(['best-levels.js']);
const PLANS = read('plans.js');
const PLANJS = read('hg-plan.js');
const HTML = read('index.html');
const BL = read('best-levels.js');
const ENG = read('engine.js');
const CG = read('cryptogates.js');

console.log('== the helper exists and is safe on junk ==');
{
  ok(typeof W.hgStrategyRefine === 'function', 'hgStrategyRefine is exported');
  ok(W.hgStrategyRefine(null, [], {}) === null, 'null plan stays null');
  ok(W.hgStrategyRefine(undefined, tape(80, 0.1, 1), {}) == null, 'undefined plan stays empty');
  const bare = { foo: 1 };
  ok(W.hgStrategyRefine(bare, tape(80, 0.1, 1), {}) === bare && bare.foo === 1,
     'object without dir is returned unchanged');
  const noLv = { dir: 'long' };
  const out = W.hgStrategyRefine(noLv, tape(80, 0.16, 7), {});
  ok(out === noLv, 'missing levels still returns the same object (never invents entry/stop/t1)');
  ok(out.entry == null && out.stop == null && out.t1 == null, 'and does not fill levels');
}

console.log('== attaches shared indicator context on a healthy tape ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const plan = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.97, t1: entry * 1.06, t2: entry * 1.09 };
  const stop0 = plan.stop, t10 = plan.t1;
  const out = W.hgStrategyRefine(plan, rows, { style: 'swing' });
  ok(out === plan, 'mutates in place / returns the same object');
  ok(out.dir === 'long' && out.entry === entry && out.stop === stop0 && out.t1 === t10,
     'default refine does not move levels');
  ok(typeof out.contextRead === 'string' && /indicator context/.test(out.contextRead),
     'stamps contextRead from hgContextRead');
  ok(Array.isArray(out.contextGates) && out.contextGates.length >= 14,
     'stamps the full context ledger');
  ok(out.strategyConfirm === 'CLEAN' || out.strategyConfirm === 'MIXED' || out.strategyConfirm === 'ADVERSE',
     'strategyConfirm is CLEAN / MIXED / ADVERSE');
  ok(isFinite(out.strategyWith) && isFinite(out.strategyAgainst),
     'stamps strategyWith / strategyAgainst counts');
  ok(out.strategyConfirm !== 'ADVERSE', 'aligned long on an uptrend is not ADVERSE');
  ok(out.contextWarn !== true, 'aligned context does not warn');
}

console.log('== adverse demotes rank and keeps the ticket ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const plan = { dir: 'short', type: 'SWING', entry: entry, stop: entry * 1.03, t1: entry * 0.94, t2: entry * 0.91,
                 formationScore: 20 };
  const stop0 = plan.stop, t10 = plan.t1;
  const out = W.hgStrategyRefine(plan, rows, { style: 'swing' });
  ok(out && out.dir === 'short' && out.entry === entry && out.stop === stop0 && out.t1 === t10,
     'ADVERSE does not delete or rewrite levels');
  ok(out.strategyConfirm === 'ADVERSE' || out.contextWarn === true,
     'named ADVERSE / contextWarn');
  ok(out.strategyDemoted === true, 'strategyDemoted flag set');
  ok(out.formationScore === 12, 'formationScore drops by 8 (20 → 12)');
  const again = W.hgStrategyRefine(out, rows, { style: 'swing' });
  ok(again.formationScore === 12, 'second pass does not demote again');
}

console.log('== reversion is not cascade-punished like a trend ticket ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const trend = W.hgStrategyRefine(
    { dir: 'short', type: 'SWING', entry: entry, stop: entry * 1.03, t1: entry * 0.94 },
    rows, { style: 'swing' });
  const fade = W.hgStrategyRefine(
    { dir: 'short', type: 'FADE', entry: entry, stop: entry * 1.03, t1: entry * 0.94 },
    rows, { style: 'fade', reversion: true });
  ok(trend.strategyAgainst >= 0 && fade.strategyAgainst >= 0, 'both reads produce counts');
  ok(fade.strategyAgainst < trend.strategyAgainst,
     'short fade on an uptrend draws fewer objections than a short trend ticket ('
     + fade.strategyAgainst + ' < ' + trend.strategyAgainst + ')');
}

console.log('== never widens a stop; tighten only when asked and R:R holds ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const tight = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.995, t1: entry * 1.02, t2: entry * 1.03 };
  const tightStop = tight.stop;
  W.hgStrategyRefine(tight, rows, { style: 'swing', refineLevels: true, minRr: 1.2 });
  ok(tight.stop === tightStop || tight.stop >= tightStop,
     'refineLevels never moves a long stop further from entry (never widens)');
  /* Wide stop + structure closer + R:R still above floor → may tighten. */
  const wide = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.90, t1: entry * 1.25, t2: entry * 1.40 };
  const wideStop = wide.stop;
  W.hgStrategyRefine(wide, rows, { style: 'swing', refineLevels: true, minRr: 2 });
  ok(wide.stop >= wideStop - 1e-12, 'when it does move, the long stop only rises (tighter)');
  ok(wide.dir === 'long' && wide.entry === entry && isFinite(wide.t1),
     'tighten never flips direction or invents a new entry');
}

console.log('== gold / XAU / PAXG skipped ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const gold = { dir: 'long', type: 'SWING', sym: 'XAUUSD', entry: entry, stop: entry * 0.97, t1: entry * 1.06 };
  W.hgStrategyRefine(gold, rows, { style: 'swing' });
  ok(!gold.strategyConfirm, 'XAUUSD is left to hgBestLevelsGold — no crypto cascade stamp');
  const paxg = { dir: 'long', type: 'SWING', symbol: 'PAXGUSDT', entry: entry, stop: entry * 0.97, t1: entry * 1.06 };
  W.hgStrategyRefine(paxg, rows, { style: 'goldscalp' });
  ok(!paxg.strategyConfirm, 'gold style / PAXG also skipped');
}

console.log('== applyExactEntry / hgApplyExactEntry stamp confirm ==');
{
  const rows = tape(80, +0.12, 3);
  const entry = rows[rows.length - 1].c;
  const plan = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.97, t1: entry * 1.06, t2: entry * 1.09 };
  const exact = W.hgApplyExactEntry(plan, rows, { style: 'swing', preferEdge: false });
  ok(exact && (exact.strategyConfirm === 'CLEAN' || exact.strategyConfirm === 'MIXED' || exact.strategyConfirm === 'ADVERSE'),
     'hgApplyExactEntry stamps strategyConfirm');
  const viaWrap = W.applyExactEntry(
    { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.97, t1: entry * 1.06, t2: entry * 1.09 },
    rows, { style: 'swing', preferEdge: false });
  ok(viaWrap && viaWrap.strategyConfirm,
     'applyExactEntry wrapper also surfaces strategyConfirm');
  ok(/hgStrategyRefine/.test(PLANJS) || /hgApplyExactEntry/.test(PLANJS),
     'hg-plan.js still forwards through hgApplyExactEntry (refine lives in plans.js)');
}

console.log('== hgBestLevels uses the same refine, not a second -8 ==');
{
  ok(/hgStrategyRefine/.test(BL), 'best-levels.js calls hgStrategyRefine');
  const rows = tape(400, +0.16, 7);
  const withIt = W.hgBestLevels({ dir: 'long', rows4h: rows, style: 'swing', tab: 'test' });
  ok(withIt && withIt.ok && withIt.plan && withIt.plan.strategyConfirm,
     'hgBestLevels plan carries strategyConfirm');
  const against = W.hgBestLevels({ dir: 'short', rows4h: rows, style: 'swing', tab: 'test' });
  ok(against && against.ok && against.plan, 'adverse still forms a plan');
  ok(against.plan.strategyConfirm === 'ADVERSE' || against.plan.contextWarn === true,
     'adverse named on the hgBestLevels plan');
}

console.log('== G1–G7 literals unchanged ==');
{
  const num = (src, re, label) => {
    const m = src.match(re);
    if (!m) throw new Error('FAIL: could not read ' + label);
    return parseFloat(m[1]);
  };
  ok(num(ENG, /var SPREAD_MIN_ATR\s*=\s*([\d.]+)/, 'engine G1') === 0.25, 'engine G1 spread 0.25');
  ok(num(CG, /var CG_G1_SPREAD_ATR\s*=\s*([\d.]+)/, 'cg G1') === 0.25, 'cryptogates G1 spread 0.25');
  ok(num(PLANS, /var HG_SPREAD_MIN_ATR\s*=\s*([\d.]+)/, 'plans G1') === 0.25, 'plans G1 spread 0.25');
  ok(num(ENG, /var VOLZ_MIN\s*=\s*([\d.]+)/, 'engine G5') === 0.5, 'engine G5 volZ 0.5');
  ok(num(CG, /var CG_G5_VZ_MIN\s*=\s*([\d.]+)/, 'cg G5') === 0.5, 'cryptogates G5 volZ 0.5');
  ok(num(ENG, /var ANCHOR_MAX_ATR\s*=\s*([\d.]+)/, 'engine ANCHOR') === 1.5, 'engine ANCHOR 1.5');
  ok(num(CG, /var CG_SWING_ANCHOR_ATR\s*=\s*([\d.]+)/, 'cg ANCHOR') === 1.5, 'cryptogates ANCHOR 1.5');
  ok(/CG_SWING_RR_MIN\s*=\s*2(?:\.0)?/.test(CG) || /R:R ≥ 2\.0/.test(CG) || /rr\s*>=\s*2/.test(CG),
     'swing G6 floor still 2.0 (not loosened)');
}

console.log('== inline scanners pass confirm onto the card ==');
{
  ok(/strategyConfirm:\s*trapPl\.strategyConfirm/.test(HTML), 'TRAP card gets strategyConfirm');
  ok(/strategyConfirm:\s*smcPl\.strategyConfirm/.test(HTML), 'SMC card gets strategyConfirm');
  ok(/strategyConfirm:\s*obPl\.strategyConfirm/.test(HTML), 'OB card gets strategyConfirm');
  ok(/strategyConfirm:\s*plObj\.strategyConfirm/.test(HTML), 'DIV card gets strategyConfirm');
  ok(/refineLevels:\s*true/.test(HTML), 'inline scanners opt into closer-structure tighten');
  ok(/hgStrategyConfirmChipHtml/.test(HTML), 'cardHTML renders the indicator confirm chip');
  ok(/function hgStrategyConfirmChipHtml/.test(PLANS), 'chip helper lives in plans.js (no new script)');
}

console.log('== named indicator keys ride on the plan ==');
{
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const plan = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.97, t1: entry * 1.06, t2: entry * 1.09 };
  W.hgStrategyRefine(plan, rows, { style: 'swing' });
  ok(typeof plan.strategyApplied === 'string' && /swing/i.test(plan.strategyApplied),
     'strategyApplied names the native strategy');
  ok(Array.isArray(plan.strategyWithKeys) && plan.strategyWithKeys.length >= 4,
     'strategyWithKeys lists the agreeing indicator names');
  ok(Array.isArray(plan.strategyAgainstKeys), 'strategyAgainstKeys is an array (may be empty)');
  ok(!plan.strategyWithKeys.includes('context-gates'), 'meta context-gates key is not listed');
}

console.log('== trade-detail HTML names the applied bank ==');
{
  ok(typeof W.hgStrategyTradeDetailHtml === 'function', 'hgStrategyTradeDetailHtml is exported');
  ok(W.hgStrategyTradeDetailHtml(null) === '', 'null source is empty');
  ok(W.hgStrategyTradeDetailHtml({}) === '', 'empty object is empty');
  const rows = tape(400, +0.16, 7);
  const entry = rows[rows.length - 1].c;
  const plan = { dir: 'long', type: 'SWING', entry: entry, stop: entry * 0.97, t1: entry * 1.06 };
  const stop0 = plan.stop, t10 = plan.t1;
  W.hgStrategyRefine(plan, rows, { style: 'swing' });
  const html = W.hgStrategyTradeDetailHtml(plan);
  ok(plan.entry === entry && plan.stop === stop0 && plan.t1 === t10,
     'detail helper does not move levels');
  ok(/STRATEGY APPLIED/.test(html), 'detail names the strategy');
  ok(/INDICATORS/.test(html) || /indicator context/.test(html), 'detail shows the indicator bank');
  ok(/gpip/.test(html), 'detail renders gate chips');
  ok(typeof W.hgStrategyBookFields === 'function', 'hgStrategyBookFields is exported');
  const bf = W.hgStrategyBookFields(plan);
  ok(bf.strategyConfirm === plan.strategyConfirm && Array.isArray(bf.strategyWithKeys),
     'book fields copy confirm + named keys');
}

console.log('== primary scan cards forward and render the detail ==');
{
  ok(/hgStrategyBookFields\(hit\)/.test(HTML), 'SWING/SCALP bookMeta pulls strategy fields from the hit');
  ok(/hgStrategyBookFields\(hit\)/.test(HTML) && /renderFadeSetupCard/.test(HTML),
     'FADE renderer is in the same file as the book-field helper');
  ok(/hgStrategyTradeDetailHtml\(bookMeta/.test(HTML), 'shared cardHTML renders the trade-detail block');
  ok(/hgStrategyTradeDetailHtml\(w\)/.test(HTML), 'BEST MOST PROBABLE panel renders the trade-detail block');
  ok(/function hgStrategyTradeDetailHtml/.test(PLANS), 'detail helper lives in plans.js (no new script)');
  ok(/strategyApplied: pl\.strategyApplied/.test(PLANJS) || /strategyWithKeys: pl\.strategyWithKeys/.test(PLANJS),
     'hg-plan.js forwards the named strategy fields (not another dropped-field bug)');
}

console.log('== module scan tabs apply and show the same bank ==');
{
  const EDGE = read('edge.js');
  const ENGJS = read('engine.js');
  const ST = read('startradertab.js');
  const OR = read('omniroute.js');
  const LIQ = read('liqs.js');
  const SUI = read('setup-ui.js');
  const GS = read('goldscalp.js');
  const GW = read('goldswing.js');
  const GBL = read('gold-best-levels.js');
  ok(/hgStrategyRefine/.test(EDGE), 'EDGE runs hgStrategyRefine on the plan');
  ok(/hgStrategyTradeDetailHtml/.test(EDGE), 'EDGE card shows the trade-detail block');
  ok(/hgStrategyTradeDetailHtml/.test(ENGJS), 'EXECUTE/GATES card shows the trade-detail block');
  ok(/hgStrategyRefine/.test(ST), 'STAR TRADER refines the confluence plan');
  ok(/hgStrategyTradeDetailHtml/.test(ST), 'STAR TRADER card shows the trade-detail block');
  ok(/hgStrategyTradeDetailHtml/.test(OR), 'OMNIROUTE card shows the trade-detail block');
  ok(/hgStrategyRefine/.test(LIQ), 'LIQS applies the indicator bank to the fade plan');
  ok(/hgStrategyTradeDetailHtml/.test(LIQ), 'LIQS card shows the trade-detail block');
  ok(/hgStrategyTradeDetailHtml/.test(SUI), 'pine/setup panel shows the trade-detail block');
  ok(/strategyConfirm/.test(GBL), 'gold best-levels stamps confirm counts from hgContextRead');
  ok(/hgStrategyTradeDetailHtml/.test(GS), 'GOLD SCALP card shows the indicator bank');
  ok(/hgStrategyTradeDetailHtml/.test(GW), 'GOLD SWING card shows the indicator bank');
}

console.log('\n' + passed + ' passed, 0 failed');
