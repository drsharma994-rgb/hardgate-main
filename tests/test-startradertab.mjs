/* HARDGATE — startradertab.js runtime tests (offline, mocked deps).
   Complements test-startrader.mjs (catalog/xuniverse). Run: node tests/test-startradertab.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeCtx(extra){
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    window: {}, console, setTimeout, clearTimeout, Promise, Math, JSON, String, Object, Array, Date, isFinite, parseInt,
  }, extra || {}));
  ctx.globalThis = ctx.window;
  return ctx;
}

function loadStack(ctx, files){
  for (const f of files){
    vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    -', msg); }
  else { fail++; console.error('FAIL  -', msg); }
}

function trendRows(n, stepSec){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * 0.05;
    rows.push({ t: 1700000000 + i * stepSec, o: c, h: c + 0.2, l: c - 0.2, c, v: 1000 });
  }
  return rows;
}

console.log('== load + exports ==');
const ctx = makeCtx();
loadStack(ctx, ['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js']);
const W = ctx.window;

{
  ok(typeof W.stDropForming === 'function', 'stDropForming exported');
  ok(typeof W.stSynthesize === 'function', 'stSynthesize exported');
  ok(typeof W.stTierRank === 'function', 'stTierRank exported');
  ok(typeof W.stEdgeScanList === 'function', 'stEdgeScanList exported');
  ok(typeof W.stEdgeHasCore === 'function', 'stEdgeHasCore exported');
  ok(typeof W.stBuildContext === 'function', 'stBuildContext exported');
  ok(typeof W.stContextVotes === 'function', 'stContextVotes exported');
  ok(typeof W.cardHTML === 'function', 'cardHTML exported');
  ok(Array.isArray(W.HG_tabs) && W.HG_tabs.some(t => t.id === 'startrader'), 'HG_tabs registers startrader tab');
}

console.log('== stDropForming / stTierRank ==');
{
  const rows = [{ t: 1000, c: 1 }, { t: 5000, c: 2 }];
  const realNow = Date.now;
  Date.now = () => (5000 + 60) * 1000;
  ok(W.stDropForming(rows, '4h').length === 1, 'stDropForming drops in-progress 4h bar');
  Date.now = () => (5000 + 20000) * 1000;
  ok(W.stDropForming(rows, '4h').length === 2, 'stDropForming keeps closed 4h bar');
  Date.now = realNow;

  ok(W.stTierRank('PRIME') > W.stTierRank('HIGH'), 'stTierRank PRIME > HIGH');
  ok(W.stTierRank('HIGH') > W.stTierRank('WATCH'), 'stTierRank HIGH > WATCH');
  ok(W.stTierRank('UNKNOWN') === 0, 'stTierRank unknown => 0');
}

console.log('== stSynthesize ==');
{
  W.swingTryClean = () => ({ dir: 'long', entry: 110, stop: 105, t1: 120, t2: 125, rr: 2 });
  W.scalpTryClean = () => ({ dir: 'long', entry: 110, stop: 108, t1: 114, t2: 118, rr: 1.6 });
  const rows4h = trendRows(240, 14400);
  const rows1h = rows4h.slice(-120);
  const rows15m = rows4h.slice(-80);
  const setup = W.stSynthesize(
    { sym: 'BTCUSD', base: 'BTC', klass: 'crypto', label: 'Bitcoin' },
    rows4h, rows1h, rows15m, { symbol: 'BTCUSD', fundingPct: 0.01, mark: 110 });
  ok(setup && setup.dir === 'long' && setup.tier === 'HIGH', 'stSynthesize mocked swing+scalp -> HIGH long');
  ok(setup.rows4h.length === rows4h.length, 'stSynthesize carries rows4h');
  ok(W.stSynthesize({ sym: 'X', klass: 'crypto' }, rows4h.slice(0, 100), rows1h, rows15m, {}) === null,
    'stSynthesize returns null when 4h history too short');

  setup.plan = { dir: 'long', entry: 110, stop: 105, t1: 120, t2: 125 };
  const card = W.cardHTML(setup);
  ok(card.indexOf('hg-stack-row') >= 0, 'cardHTML renders FTS stack when setup-stack loaded');
  ok(card.indexOf('BTCUSD') >= 0 || card.indexOf('Bitcoin') >= 0, 'cardHTML includes symbol/label');
  ok(card.indexOf('HIGH') >= 0, 'cardHTML includes tier chip');

  W.edgeSwingBias = () => true;
  W.edgeSignal = () => ({ dir: 'long' });
  W.edgeAssess = () => ({
    sig: { dir: 'long' }, tally: 5,
    plan: { entry: 110, stop: 105, t1: 120, t2: 125, rr: 2.5 },
  });
  W.swingGateMatrix = () => ({ dir: 'long', clean: true, passed: 7 });
  W.hgNewsRisk = () => ({ risk: 'low' });
  const primeCtx = {
    regime: { label: 'RISK ON', playbook: { bias: 'LONG-ONLY' } },
    newsState: { fng: { value: 45 } },
  };
  const prime = W.stSynthesize(
    { sym: 'BTCUSD', base: 'BTC', klass: 'crypto', label: 'Bitcoin' },
    rows4h, rows1h, rows15m, { symbol: 'BTCUSD', fundingPct: 0.01, mark: 110 }, primeCtx);
  ok(prime && prime.tier === 'PRIME', 'stSynthesize swing+scalp+edge+regime -> PRIME');
  ok(prime.points >= 7, 'PRIME setup agreePts >= 7');
  ok(W.cardHTML(prime).indexOf('prime') >= 0, 'cardHTML PRIME tier class');
}

console.log('== stSynthesize real cryptogates path ==');
{
  function synthRows(n, start, stepSec){
    const out = [];
    for (let i = 0; i < n; i++){
      const c = start + i * 10;
      out.push({ t: 1700000000 + i * stepSec, o: c, h: c + 5, l: c - 5, c: c, v: 1000 });
    }
    return out;
  }
  const deep = makeCtx();
  loadStack(deep, [
    'indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js',
    'edge.js', 'setup-stack.js', 'startradertab.js',
  ]);
  const DW = deep.window;
  const rows4h = synthRows(260, 50000, 14400);
  const rows1h = synthRows(120, 50000, 3600);
  const rows15m = synthRows(80, 50000, 900);
  const ticker = { symbol: 'BTCUSD', fundingPct: 0.01, mark: rows4h[rows4h.length - 1].c };
  const rawMatrix = DW.swingGateMatrix(rows4h, ticker);
  ok(rawMatrix && rawMatrix.dir === 'long' && rawMatrix.passed >= 1,
    'cryptogates uptrend fixture yields directional swing matrix');

  let matrixCalls = 0;
  const origSwing = DW.swingGateMatrix;
  DW.swingGateMatrix = function(r, t){
    matrixCalls++;
    const m = origSwing(r, t);
    if (m && m.dir && m.passed >= 1 && m.passed < 6) return Object.assign({}, m, { passed: 6 });
    return m;
  };
  const hit = DW.stSynthesize(
    { sym: 'BTCUSD', base: 'BTC', klass: 'crypto', label: 'Bitcoin' },
    rows4h, rows1h, rows15m, ticker);
  ok(matrixCalls >= 1, 'stSynthesize invokes real swingGateMatrix');
  ok(hit && hit.dir === 'long', 'real matrix-backed synthesis yields long setup');
  ok(hit.allVotes.some(v => v.src === 'SWING'), 'SWING vote from cryptogates matrix');
  ok(['WATCH', 'HIGH', 'PRIME'].includes(hit.tier), 'real path assigns tier label');
}

console.log('== stSynthesize squeeze + meanrev families ==');
{
  const rows4h = trendRows(240, 14400);
  const rows1h = rows4h.slice(-120);
  const rows15m = rows4h.slice(-80);
  W.swingTryClean = () => ({ dir: 'long', entry: 110, stop: 105, t1: 120, rr: 2 });
  W.scalpTryClean = () => ({ dir: 'long', entry: 110, stop: 108, t1: 114, rr: 1.6 });
  W.squeezeClassify = () => ({ state: 'FIRED_LONG' });
  W.mrSignal = () => ({ dir: 'long', kind: 'MR dip' });
  const fam = W.stSynthesize(
    { sym: 'BTCUSD', klass: 'crypto' }, rows4h, rows1h, rows15m, { mark: 110 });
  ok(fam && fam.allVotes.some(v => v.src === 'SQUEEZE'), 'stSynthesize wires squeezeClassify vote');
  ok(fam.allVotes.some(v => v.src === 'MEAN REV'), 'stSynthesize wires mrSignal vote');
  ok(fam.votes.filter(v => v.dir === fam.dir).length >= 3, 'squeeze+MR agree with majority dir');
}

console.log('== stSynthesize context veto ==');
{
  const vctx = makeCtx();
  loadStack(vctx, ['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js']);
  const VW = vctx.window;
  VW.swingTryClean = () => ({ dir: 'long', entry: 110, stop: 105, t1: 120, rr: 2 });
  VW.hgNewsRisk = () => ({ blackout: true, note: 'macro event' });
  const rows = trendRows(240, 14400);
  ok(VW.stSynthesize(
    { sym: 'BTCUSD', klass: 'crypto' },
    rows, rows.slice(-120), rows.slice(-80),
    { mark: 100 },
    { regime: { playbook: { bias: 'BOTH' } } },
  ) === null, 'stSynthesize returns null when context veto fires');
}

console.log('== stContextVotes / stBuildContext ==');
{
  const rows = trendRows(80, 14400);
  W.hgNewsRisk = () => ({ blackout: true, note: 'NFP window' });
  const veto = W.stContextVotes({ sym: 'BTCUSD', klass: 'crypto' }, 'long', {}, { mark: 100 }, rows, rows, rows);
  ok(veto.veto === true && veto.reason.indexOf('NFP') >= 0, 'stContextVotes news blackout vetoes');

  W.hgNewsRisk = () => ({ risk: 'low' });
  W.regimeState = () => ({ label: 'RISK ON', playbook: { bias: 'LONG-ONLY' } });
  const ctxVotes = W.stContextVotes({ sym: 'BTCUSD', klass: 'crypto' }, 'long',
    W.stBuildContext(), { mark: 100 }, rows, rows, rows);
  ok(!ctxVotes.veto && ctxVotes.votes.some(v => v.src === 'REGIME'), 'stContextVotes adds regime vote');

  W.__hgGoldSetupDecision = { dir: 'long', reason: 'composite gold' };
  const gold = W.stContextVotes({ sym: 'XAUUSD', klass: 'metal', gold: true }, 'long',
    W.stBuildContext(), {}, rows, rows, rows);
  ok(gold.votes.some(v => v.src === 'GOLD SETUP'), 'stContextVotes gold lane uses setup decision');
}

console.log('== stEdge helpers ==');
{
  ok(W.stEdgeHasCore(), 'stEdgeHasCore true when edge.js loaded');
  delete W.edgeScanList;
  delete W.edgeCardHTML;
  ok(W.stEdgeHasCore(), 'stEdgeHasCore still true without edgeScanList export');

  const fallbackCard = W.stEdgeScanList ? null : null;
  void fallbackCard;
  const mockRow = {
    item: { sym: 'ETHUSD' }, sym: 'ETHUSD', tally: 5,
    sig: { dir: 'long', edge: 'EDGE', rr: 2 },
    plan: { entry: 100, stop: 98, t1: 104 },
  };
  W.edgeCardHTML = undefined;
  const edgeOnly = makeCtx();
  loadStack(edgeOnly, ['startradertab.js']);
  const cardFn = edgeOnly.window.stEdgeScanList;
  ok(typeof cardFn === 'function', 'stEdgeScanList available on minimal load');
  const html = edgeOnly.window.cardHTML
    ? edgeOnly.window.cardHTML({ sym: 'ETHUSD', dir: 'long', tier: 'WATCH', klass: 'crypto', plan: mockRow.plan, votes: [] })
    : '';
  ok(typeof html === 'string', 'cardHTML callable on tab exports');

  W.edgeSwingBias = () => true;
  W.edgeSignal = () => ({ dir: 'long' });
  W.edgeAssess = () => ({ sig: { dir: 'long' }, tally: 5, plan: { entry: 50, stop: 48, t1: 55 } });
  W.edgeBacktest = () => ({ expR: 1.2 });
  const list = [{ sym: 'SOLUSD', base: 'SOL', exchange: 'startrader', turnoverUsd: 1e8 }];
  const fetchCandles = async () => ({
    rows: trendRows(220, 14400),
    src: 'mock',
  });
  const scan = await W.stEdgeScanList(list, fetchCandles, { maxUniverse: 1, minTurnover: 0 });
  ok(scan && scan.found.length === 1 && scan.found[0].sym === 'SOLUSD', 'stEdgeScanList finds setup with mocked edge core');
  ok(scan.stats.skipped === 0 || scan.found.length > 0, 'stEdgeScanList completes scan pass');
}

console.log('== startrader gold sub-tabs ==');
{
  const tabHtml = readFileSync(path.join(root, 'startradertab.js'), 'utf8');
  ok(/stPaneGoldScalp/.test(tabHtml) && /stPaneGoldSwing/.test(tabHtml), 'startradertab mounts gold scalp and swing panes');
  ok(/goldscalpMountSection/.test(tabHtml) && /goldswingMountSection/.test(tabHtml), 'startradertab wires gold mount helpers');
  const goldCtx = makeCtx();
  loadStack(goldCtx, ['goldind.js', 'goldscalp.js', 'goldswing.js']);
  ok(typeof goldCtx.window.goldscalpMountSection === 'function', 'goldscalpMountSection exported');
  ok(typeof goldCtx.window.goldswingMountSection === 'function', 'goldswingMountSection exported');
  const host = { innerHTML: '', querySelector: function(sel){ return null; } };
  /* mountInto needs real DOM-ish el — use minimal stub that returns null from querySelector until innerHTML set */
  var stubEl = {
    innerHTML: '',
    querySelector: function(){ return null; }
  };
  var sec = goldCtx.window.goldscalpMountSection(stubEl);
  ok(sec && typeof sec.refresh === 'function' && sec.scanSt, 'goldscalpMountSection returns refreshable section');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
