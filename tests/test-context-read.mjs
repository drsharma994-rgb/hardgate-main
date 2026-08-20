/* HARDGATE — every setup-forming desk reads the shared indicator context.

   The 2026-08 audit asked one question of every tab: are the indicators
   and strategies this app carries actually used to form the setups? The
   answer was no for every desk except the two ledger desks. GOLD SCALP,
   GOLD SWING, GOLD PRO, EDGE, SQUEEZE, TRENDTABLE, OI FLOW and STAR
   TRADER all graded by hand-summed tallies that consulted none of the 14
   shared context gates; OI FLOW's entire quality grade was one EMA20/50
   test; GOLD PRO printed a literal "7/7 gates" with no gates behind it.

   The fix is one helper, hgContextRead (hg-gates.js), wired into the two
   chokepoints every one of those desks routes through (hgBestLevels for
   squeeze/trendtable/oiflow, hgBestLevelsGold for the two gold tabs) plus
   the three desks with their own seams (edge tally, star-trader vote,
   goldpro panel). Its contract:

     CLOSED BARS — the last bar is dropped whenever it is younger than
       the tape's own bar spacing, so forming-candle feeds cannot repaint
       the verdicts (five of six crypto desks feed forming bars);
     INFO ONLY — nothing here vetoes; an adverse majority costs rank
       (the same -8 a failing walk-forward edge costs), never existence;
     HONEST COUNTS — withN/againstN count only gates that evaluated.

   Run: node tests/test-context-read.mjs */
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
                 'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']
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
const CTX14 = ['ichimoku','donchian-pos','stoch-rsi','hurst-regime','squeeze-state','keltner-pos',
  'structure-shift','macd-momentum','bollinger-pctb','volume-z','regression-slope','value-area',
  'htf-confirm','regime-fit'];

console.log('== the helper: honest, closed-bars, info-only ==');
{
  const up = tape(400, +0.16, 7);
  const cx = W.hgContextRead(up, 'long', 'test', false);
  ok(!!cx && Array.isArray(cx.gates), 'a read comes back on a healthy tape');
  const keys = cx.gates.map(g => g && g.key);
  ok(CTX14.every(k => keys.indexOf(k) >= 0), 'all 14 shared context gates are present');
  ok(cx.withN + cx.againstN + cx.na === cx.gates.length, 'withN + againstN + n/a covers every gate — nothing double-counted');
  ok(cx.gates.every(g => g && !(g.hard === true && g.pass === false)), 'info-only: no gate returned here can hard-veto');
  ok(new RegExp('indicator context ' + cx.withN + ' with / ' + cx.againstN + ' against').test(cx.read),
     'the read states its own counts: "' + cx.read + '"');
  ok(cx.withN > cx.againstN, 'a long on a strong uptrend reads majority WITH (' + cx.withN + ' vs ' + cx.againstN + ')');

  /* The adverse case is a SHORT into the same strong uptrend. Note the
     shape: half of these gates are permissive location reads that rarely
     object, so even a short into a rally never reads a with/against
     MAJORITY against — what it does read is a pile of OBJECTIONS from
     every trend gate at once. The policy thresholds below count those. */
  const cxAdv = W.hgContextRead(up, 'short', 'test', false);
  ok(!!cxAdv && cxAdv.adverse === true, 'a short into a strong uptrend reads ADVERSE — a third of the panel objecting (' + cxAdv.againstN + ' of ' + cxAdv.gates.length + ')');
  ok(cx.adverse !== true, 'while the aligned long stays under the scaled objection bar (' + cx.againstN + ' of ' + cx.gates.length + ')');
  ok(cxAdv.gates.length >= 20, 'the shared bank now carries 20+ reads — bank two included');
  for (const k2 of ['adx-regime','obv-flow','mfi-pressure','cci-stretch','ema-ribbon','heikin-trend'])
    ok(cxAdv.gates.some(g => g && g.key === k2), 'bank two gate present: ' + k2);

  ok(W.hgContextRead(up.slice(0, 40), 'long', 't', false) === null, 'too little history -> null, never a guess');
  ok(W.hgContextRead(up, 'sideways', 't', false) === null, 'no direction -> null');
}

console.log('\n== closed bars are enforced by the helper itself ==');
{
  /* A tape whose last bar is stamped NOW is a forming bar. The helper must
     read the same verdicts as a direct call on the tape minus that bar. */
  const rows = tape(400, +0.16, 11);
  const nowSec = Math.floor(Date.now() / 1000);
  for (let i = 0; i < rows.length; i++) rows[i] = { ...rows[i], t: nowSec - (rows.length - 1 - i) * 3600 };
  rows[rows.length - 1] = { ...rows[rows.length - 1], c: rows[rows.length - 1].c * 1.2 }; /* wild forming print */
  const viaHelper = W.hgContextRead(rows, 'long', 't', false);
  const direct = W.hgIndicatorGates(rows.slice(0, -1), { dir: 'long', kind: 't' }, {}, false);
  const mapOf = gs => JSON.stringify(gs.map(g => [g.key, g.pass === null ? 'N' : (g.pass ? 'T' : 'F')]).sort());
  ok(!!viaHelper && mapOf(viaHelper.gates) === mapOf(direct),
     'a forming last bar is dropped: helper verdicts equal a direct read on the closed tape');
}

console.log('\n== hgBestLevels (squeeze / trendtable / oiflow chokepoint) ==');
{
  const up = tape(400, +0.16, 7);
  const withIt = W.hgBestLevels({ dir: 'long', rows4h: up, style: 'swing', tab: 'test' });
  ok(withIt && withIt.ok && withIt.plan, 'a plan forms on the uptrend');
  ok(Array.isArray(withIt.plan.contextGates) && withIt.plan.contextGates.length >= 14,
     'the plan carries the full context ledger');
  ok(typeof withIt.plan.contextRead === 'string' && /indicator context/.test(withIt.plan.contextRead),
     'and the one-line read for the card');
  ok(withIt.plan.contextWarn !== true, 'aligned context does not warn');

  const against = W.hgBestLevels({ dir: 'short', rows4h: up, style: 'swing', tab: 'test' });
  ok(against && against.ok && against.plan, 'ADVERSE MAJORITY does not veto — the plan still exists');
  ok(against.plan.contextWarn === true, 'but it is named: contextWarn set at 5+ objections');
  ok(typeof against.plan.formationScore === 'number'
     && against.plan.formationScore <= (withIt.plan.formationScore != null ? withIt.plan.formationScore : 0),
     'and it costs rank, not existence (-8 formation points)');
}

console.log('\n== source contracts on the five seams behavior cannot cheaply drive ==');
{
  const GBL = read('gold-best-levels.js');
  ok(/hgContextRead\(formRows, dir, hit\.stratKey \|\| style, skRev\)/.test(GBL),
     'gold refiner: reversion strategies graded as reversion, trend as trend');
  ok(/gc\.contextRead = plan\.contextRead;/.test(GBL),
     'gold refiner: the read reaches the CANDIDATE the tabs render');
  ok(/plan\.contextWarn && !gc\.demoted/.test(GBL),
     'gold refiner: adverse context demotes with its reason, never silently');

  const EDGE = read('edge.js');
  ok(/hgContextRead\(rows, dir, sig\.edge \|\| 'edge', false\)/.test(EDGE), 'edge: wired into the tally');
  ok(/cxE\.adverse \? -2 : \(cxE\.clean \? 1 : 0\)/.test(EDGE),
     'edge: scored by the SCALED objection bar, capped at ±2 — one opinion, however many reads');

  const STAR = read('startradertab.js');
  ok(/hgContextRead\(rows4h, dir, 'startrader', false\)/.test(STAR), 'star trader: wired as a vote');
  ok(/dir === 'long' \? 'short' : 'long'/.test(STAR),
     'star trader: the context can vote AGAINST the working direction');

  const GP = read('goldpro.js');
  ok(!/gatesPassed: 7, gatesTotal: 7/.test(GP), 'goldpro: the invented 7/7 gate count is gone');
  ok(/gatesPassed: cx \? cx\.withN : undefined/.test(GP),
     'goldpro: real counts or none — undefined, because isFinite(null) is true and null renders 0/0');
  ok(/hgContextRead\(lvRows, lvCascade, 'gp-cascade', false\)/.test(GP), 'goldpro: read on closed lvRows');

  for (const f of ['squeeze.js', 'trendtable.js', 'oiflow.js']){
    ok(/contextRead/.test(read(f)) && /context AGAINST this direction/.test(read(f)),
       f + ': the read and its warning render on the card');
  }
}

console.log('\npassed: ' + passed);
