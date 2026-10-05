/* HARDGATE — hg-v1015: TWO CROSS DESKS (trendtable.js).

   v1014 put both crosses on one FRESH CROSS DESK panel with named halves.
   The operator's ask: the bull desk and the bear desk stand on their own.
   Now: trendmxGoldenDeskHTML renders only golden tickets into
   data-r="golden", trendmxDeathDeskHTML renders only death tickets into
   data-r="death", and trendmxPaintDeskSections routes each bag to its own
   container. The card renderer stays the shared dir-aware one; the 4-card
   cap per desk is the cap each half already had — presentation changed,
   exposure did not.

   Harness: classic scripts in a vm context (the v1012/v1013/v1014 route).

   Run: node tests/test-trendmx-cross-desks-v1015.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* hg-v1150: the cross builders now run the REAL closed 7-gate matrix
   (trendmxClosedGate -> swingGateMatrix), require a TRADE grade and an
   EMA tag (dip-and-reclaim within the last 6 closed bars). A boot without
   cryptogates.js can never produce a gate >= 6/7, and a linear ramp can
   never clear G3 (RSI pins at the band edge) / G5 (no volume or wick
   commitment) / G6 (structure stop too far for R:R) — the same lesson
   test-cryptogates.mjs learned in its own gatedRows note. cryptogates +
   plans join the boot, the house gate stubs ride with them (the exact
   test-cryptogates route), and the 4h tapes below are the gated
   pullback-reclaim shape. */
const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'cryptogates.js', 'plans.js', 'trendtable.combined.js'];
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of FILES)
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  /* the house test-cryptogates stubs — same route, same file */
  ctx.hgStructureGate = () => ({ veto: false, bos: true });
  ctx.detectRegime = () => ({ regime: 'trend', label: 'trend' });
  return ctx;
}

function lin(n, start, step){ const a = []; for (let i = 0; i < n; i++) a.push(start + i * step); return a; }
function mkRows(closes, tfSec){
  const rows = []; let prev = closes[0];
  for (let i = 0; i < closes.length; i++){
    const c = closes[i], o = prev;
    rows.push({ t: i * (tfSec || 86400), o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 });
    prev = c;
  }
  return rows;
}

const W = boot();
/* the v1014 cross fixtures, sliced 5 bars after the cross */
const cxAll = lin(240, 300, -0.8).concat((() => { const a = []; for (let i = 1; i <= 80; i++) a.push(108.8 + i * 2.5); return a; })());
const gi = W.crossOver(W.ema(cxAll, 50), W.ema(cxAll, 200)).lastIndexOf(true);
const dxAll = lin(240, 100, 0.8).concat((() => { const a = []; for (let i = 1; i <= 80; i++) a.push(291.2 - i * 2.5); return a; })());
const di = W.crossUnder(W.ema(dxAll, 50), W.ema(dxAll, 200)).lastIndexOf(true);
const gDaily = mkRows(cxAll.slice(0, gi + 1 + 5));
const dDaily = mkRows(dxAll.slice(0, di + 1 + 5));
/* the gated pullback-reclaim tapes (fresh timestamps, all bars closed):
   trend -> shallow pullback -> reclaim bar closing at the extreme on
   expanded volume — the shape the 7 gates were written to find. The SHORT
   tape is the exact mirror (falling drift, upward pullback, reclaim at
   the low on expanded volume). */
const NOW = Math.floor(Date.now() / 1000);
function gatedLong(cfg, n){
  const out = []; let c = 50000;
  const t0 = Math.floor(NOW / 14400) * 14400 - (n + 1) * 14400;
  for (let i = 0; i < n; i++){
    const k = n - 1 - i; let vol = 1000;
    if (k >= cfg.pullBars + cfg.recBars) c = c * (1 + cfg.drift);
    else if (k >= cfg.recBars)           c = c * (1 - cfg.pullPct);
    else                                 { c = c * (1 + cfg.recPct); vol = 1000 * cfg.volPop; }
    const rng = c * 0.006; const nearHigh = k < cfg.recBars;
    out.push({ t: t0 + i * 14400, o: c - rng * (nearHigh ? 0.7 : 0.3), h: c + rng * (nearHigh ? 0.08 : 0.5), l: c - rng * (nearHigh ? 0.9 : 0.5), c, v: vol });
  }
  return out;
}
function gatedShort(cfg, n){
  const out = []; let c = 50000;
  const t0 = Math.floor(NOW / 14400) * 14400 - (n + 1) * 14400;
  for (let i = 0; i < n; i++){
    const k = n - 1 - i; let vol = 1000;
    if (k >= cfg.pullBars + cfg.recBars) c = c * (1 - cfg.drift);
    else if (k >= cfg.recBars)           c = c * (1 + cfg.pullPct);
    else                                 { c = c * (1 - cfg.recPct); vol = 1000 * cfg.volPop; }
    const rng = c * 0.006; const nearLow = k < cfg.recBars;
    out.push({ t: t0 + i * 14400, o: c + rng * (nearLow ? 0.7 : 0.3), h: c + rng * (nearLow ? 0.9 : 0.5), l: c - rng * (nearLow ? 0.08 : 0.5), c, v: vol });
  }
  return out;
}
const CLEAN_CFG = { drift: 0.005, pullPct: 0.003, pullBars: 12, recBars: 2, recPct: 0.004, volPop: 2 };
const up4 = gatedLong(CLEAN_CFG, 240);
const dn4 = gatedShort(CLEAN_CFG, 240);
const tsG = W.trendScore(gDaily, up4), tsD = W.trendScore(dDaily, dn4);
ok(tsG.freshCross === 'GOLDEN' && tsD.freshCross === 'DEATH', 'fixtures carry fresh crosses (probed in v1014)');

function mkGolden(sym){
  return { sym: sym, score: tsG.score, comps: tsG.comps, freshCross: tsG.freshCross, adx: tsG.adx,
    price: gDaily[gDaily.length - 1].c, rows4h: up4, rows1h: null, fundingPct: -0.01,
    gate: { gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: 'trend only', veto: null } };
}
function mkDeath(sym){
  return { sym: sym, score: tsD.score, comps: tsD.comps, freshCross: tsD.freshCross, adx: tsD.adx,
    price: dDaily[dDaily.length - 1].c, rows4h: dn4, rows1h: dn4.slice(-60), fundingPct: 0.01,
    gate: { gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: 'trend only', veto: null } };
}
const GT = W.trendmxGoldenCrossSetups([mkGolden('GLDUSDT')]);
const DT = W.trendmxDeathCrossSetups([mkDeath('DTHUSDT')]);
ok(GT.length === 1 && DT.length === 1, 'both builders mint a ticket for the desk test');

console.log('== each desk renders only its own cross ==');
{
  ok(typeof W.trendmxGoldenDeskHTML === 'function' && typeof W.trendmxDeathDeskHTML === 'function',
     'both desk builders exported');
  const g = W.trendmxGoldenDeskHTML(GT);
  ok(g.indexOf('⚡ GOLDEN CROSS DESK') >= 0, 'the bull desk is titled GOLDEN CROSS DESK');
  ok(g.indexOf('GLDUSDT') >= 0 && g.indexOf('⚡GOLDEN') >= 0, 'golden ticket on the bull desk with its stamp');
  ok(g.indexOf('>LONG<') >= 0, 'the bull desk wears the LONG stamp');
  ok(g.indexOf('DTHUSDT') === -1 && g.indexOf('⚡DEATH') === -1 && g.indexOf('>SHORT<') === -1,
     'no bear language leaks onto the bull desk');
  const d = W.trendmxDeathDeskHTML(DT);
  ok(d.indexOf('⚡ DEATH CROSS DESK') >= 0, 'the bear desk is titled DEATH CROSS DESK');
  ok(d.indexOf('DTHUSDT') >= 0 && d.indexOf('⚡DEATH') >= 0, 'death ticket on the bear desk with its stamp');
  ok(d.indexOf('>SHORT<') >= 0, 'the bear desk wears the SHORT stamp');
  ok(d.indexOf('#b91c1c') >= 0, 'the bear desk wears the red palette');
  ok(d.indexOf('GLDUSDT') === -1 && d.indexOf('⚡GOLDEN') === -1 && d.indexOf('>LONG<') === -1,
     'no bull language leaks onto the bear desk');
  /* hg-v1150: the shipped golden desk renders its HONEST EMPTY STATE (the
     full-stack note naming every layer that has to agree) instead of a blank
     panel; the death desk still renders nothing when empty. Pin the shipped
     contract per desk. */
  ok(W.trendmxGoldenDeskHTML([]).indexOf('No golden setup') >= 0 && W.trendmxGoldenDeskHTML(null).indexOf('No golden setup') >= 0
     && W.trendmxDeathDeskHTML([]) === '' && W.trendmxDeathDeskHTML(undefined) === '',
     'a desk with no tickets renders the honest empty state, no cards');
}

console.log('== the 4-card cap is the cap each half already had ==');
{
  const six = [];
  for (let i = 0; i < 6; i++) six.push(GT[0] && Object.assign({}, GT[0], { sym: 'G' + i + 'USDT' }));
  const g6 = W.trendmxGoldenCrossSetups(six.map(t => mkGolden(t.sym)));
  /* count the stamp spans, not the string — each card also carries the
     cross name in its note text */
  const html = W.trendmxGoldenDeskHTML(g6);
  const cards = (html.match(/⚡GOLDEN</g) || []).length;
  ok(g6.length === 6 && cards === 4, 'six fresh golden crosses, four cards — the standing cap, unchanged');
  const sixD = [];
  for (let i = 0; i < 6; i++) sixD.push(mkDeath('D' + i + 'USDT'));
  const htmlD = W.trendmxDeathDeskHTML(W.trendmxDeathCrossSetups(sixD));
  ok((htmlD.match(/⚡DEATH</g) || []).length === 4, 'same cap on the bear desk');
}

console.log('== the tab mounts two containers, bull over bear ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  ok(src.indexOf('data-r="golden"') >= 0 && src.indexOf('data-r="death"') >= 0, 'both desk containers exist');
  ok(src.indexOf('data-r="golden"') < src.indexOf('data-r="death"'), 'the bear desk stands right under the bull desk');
  ok(/GOLDEN CROSS DESK/.test(src) && /DEATH CROSS DESK/.test(src), 'both desk titles wired');
}

console.log('== the paint routes each bag to its own container ==');
{
  const refs = { summary: {}, golden: {}, death: {}, cards: {}, near: {}, forming: {}, limit: {}, out: {}, status: {} };
  W.trendmxPaintDeskSections(refs, { rows: [], golden: GT, death: DT, venueCounts: null });
  ok(refs.golden.innerHTML.indexOf('GLDUSDT') >= 0 && refs.golden.innerHTML.indexOf('DTHUSDT') === -1,
     'golden container: golden tickets only');
  ok(refs.death.innerHTML.indexOf('DTHUSDT') >= 0 && refs.death.innerHTML.indexOf('GLDUSDT') === -1,
     'death container: death tickets only');
  ok(refs.golden.innerHTML.indexOf('GOLDEN CROSS DESK') >= 0 && refs.death.innerHTML.indexOf('DEATH CROSS DESK') >= 0,
     'each container got its own desk title');

  /* venue filter: the death ticket's row is on delta; filtering to binance
     must empty the bear desk while the bull desk (binance row) stays */
  const refs2 = { summary: {}, golden: {}, death: {}, cards: {}, near: {}, forming: {}, limit: {}, out: {}, status: {} };
  const rows = [
    { sym: 'GLDUSDT', exchange: 'binance', score: 0, comps: {}, rows4h: null, gate: null },
    { sym: 'DTHUSDT', exchange: 'delta',   score: 0, comps: {}, rows4h: null, gate: null }
  ];
  W.trendmxPaintDeskSections(refs2, { rows: rows, golden: GT, death: DT, venue: 'binance', venueCounts: null });
  ok(refs2.golden.innerHTML.indexOf('GLDUSDT') >= 0, 'venue filter: the binance golden stays on its desk');
  ok(refs2.death.innerHTML === '', 'venue filter: the delta death leaves the bear desk — the desks route independently');
}

console.log('\nPASS — ' + passed + ' assertions');
