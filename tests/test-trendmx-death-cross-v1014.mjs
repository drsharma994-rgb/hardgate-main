/* HARDGATE — hg-v1014: THE DEATH CROSS DESK (trendtable.js + tabalerts.js).

   A fresh GOLDEN cross (EMA50/200 crossing up, <=10 daily bars) produced a
   long setup on TREND MATRIX with its own Telegram alert cycle; the same
   tape crossing UNDER — a death cross, the mirror image bar for bar —
   produced nothing. No desk card, no ⚡DEATH chip, no alert. The composite
   scored the decline −5, the majority read short, conviction (post-v1013)
   read |score| — and the cross desk still only looked up.

   The fix is a mirror, not a new mechanic: trendmxDeathCrossSetups applies
   the golden desk's own legs in the bear direction (fresh DEATH + bear
   d1Cross + short majority + conviction + no veto + valid short plan), the
   SMC pass's capped envelope is shared by both desks' tickets, the scan
   snap and trendmxCrossState carry both halves, the alert cycle keys,
   formats and pushes death crosses on their own side — golden keys and the
   golden message body byte-identical to hg-v1011 — and the AI AGENT's
   trend-scout reads both halves of crossState and the rows fallback,
   handing the swarm ranker |composite| (strength, not side) with the
   signed print kept in the note.

   Harness: classic scripts in a vm context (the v1012/v1013 route) for
   trendtable; the module.exports sandbox for tabalerts; a combined boot
   with ai-agent.js for the swarm sections.

   Run: node tests/test-trendmx-death-cross-v1014.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'trendtable.combined.js'];
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of FILES)
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function loadTabAlerts(){
  const sandbox = {
    module: { exports: {} }, console, Math, JSON, Date, Promise,
    isFinite, parseInt, String, Object, Array,
    localStorage: { _m: {}, getItem(k){ return k in this._m ? this._m[k] : null; }, setItem(k,v){ this._m[k]=String(v); } }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tabalerts.js'), 'utf8'), sandbox, { filename: 'tabalerts.js' });
  return sandbox;
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
/* the cross fixtures of test-trendtable.mjs §4/§5, sliced 5 bars after the cross */
const cxAll = lin(240, 300, -0.8).concat((() => { const a = []; for (let i = 1; i <= 80; i++) a.push(108.8 + i * 2.5); return a; })());
const gi = W.crossOver(W.ema(cxAll, 50), W.ema(cxAll, 200)).lastIndexOf(true);
const dxAll = lin(240, 100, 0.8).concat((() => { const a = []; for (let i = 1; i <= 80; i++) a.push(291.2 - i * 2.5); return a; })());
const di = W.crossUnder(W.ema(dxAll, 50), W.ema(dxAll, 200)).lastIndexOf(true);
ok(gi > 0 && di > 0, 'fixtures cross (golden idx ' + gi + ', death idx ' + di + ')');
const gDaily = mkRows(cxAll.slice(0, gi + 1 + 5));
const dDaily = mkRows(dxAll.slice(0, di + 1 + 5));
const up4 = mkRows(lin(120, 100, 0.6), 14400);
const dn4 = mkRows(lin(120, 400, -0.6), 14400);
const tsG = W.trendScore(gDaily, up4), tsD = W.trendScore(dDaily, dn4);
ok(tsG.score === 5 && tsG.freshCross === 'GOLDEN' && tsG.comps.d1Cross === 1, 'golden fixture: +5, fresh GOLDEN, bull cross');
ok(tsD.score === -5 && tsD.freshCross === 'DEATH' && tsD.comps.d1Cross === -1, 'death fixture: −5, fresh DEATH, bear cross');

function mkDeath(sym, opts){
  return Object.assign({
    sym: sym, score: tsD.score, comps: tsD.comps, freshCross: tsD.freshCross, adx: tsD.adx,
    price: dDaily[dDaily.length - 1].c, rows4h: dn4, rows1h: dn4.slice(-60),
    fundingPct: 0.01, gate: { gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: 'trend only', veto: null }
  }, opts || {});
}
function mkGolden(sym, opts){
  return Object.assign({
    sym: sym, score: tsG.score, comps: tsG.comps, freshCross: tsG.freshCross, adx: tsG.adx,
    price: gDaily[gDaily.length - 1].c, rows4h: up4, rows1h: null,
    fundingPct: -0.01, gate: { gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: 'trend only', veto: null }
  }, opts || {});
}

console.log('== the mirrored desk: a fresh death cross is a short setup ==');
{
  ok(typeof W.trendmxDeathCrossSetups === 'function', 'trendmxDeathCrossSetups exported');
  const out = W.trendmxDeathCrossSetups([mkDeath('DTHUSDT')]);
  ok(out.length === 1, 'fresh DEATH cross at −5 yields exactly one short setup');
  const s = out[0];
  ok(s.dir === 'short' && s.freshCross === 'DEATH', 'ticket is a short, stamped DEATH');
  ok(s.stop > s.entry && s.t1 < s.entry, 'mirrored geometry: stop above, T1 below');
  ok(s.rr > 0 && s.conviction === 'STRONG CONVICTION' && s.tier === 'STRONG' && s.prime === true,
     'conviction parity: −5 earns the standing +5 earns');
  ok(s.note.indexOf('⚡DEATH CROSS') === 0 && s.note.indexOf('-5/5') >= 0, 'the note names the cross and the composite');
  ok(W.trendmxGoldenCrossSetups([mkDeath('DTHUSDT')]).length === 0, 'the golden desk still reads the same row and stays long-only');
  ok(W.trendmxDeathCrossSetups([mkGolden('GLDUSDT')]).length === 0, 'and the death desk returns the compliment on a golden row');
}

console.log('== every golden leg is required of the mirror ==');
{
  ok(W.trendmxDeathCrossSetups([mkDeath('X1USDT', { freshCross: 'GOLDEN' })]).length === 0, 'a GOLDEN stamp is not a death cross');
  ok(W.trendmxDeathCrossSetups([mkDeath('X2USDT', { freshCross: null })]).length === 0, 'no fresh cross, no ticket (the <=10-bars window is the desk)');
  ok(W.trendmxDeathCrossSetups([mkDeath('X3USDT', { comps: Object.assign({}, tsD.comps, { d1Cross: 0 }) })]).length === 0,
     'd1Cross must be bearish — a flat cross read is not a death cross');
  ok(W.trendmxDeathCrossSetups([mkDeath('X4USDT', { score: -1 })]).length === 0, 'no bearish majority / no conviction, no ticket (|score| < 2)');
  ok(W.trendmxDeathCrossSetups([mkDeath('X5USDT', { score: 5, comps: tsG.comps })]).length === 0,
     'a long majority with a DEATH stamp is a contradiction, not a setup');
  ok(W.trendmxDeathCrossSetups([mkDeath('X6USDT', { gate: { veto: 'chase block' } })]).length === 0, 'the gate veto is respected both ways');
  ok(W.trendmxDeathCrossSetups([mkDeath('X7USDT', { price: NaN })]).length === 0, 'an unpriceable plan is not a setup');
  ok(W.trendmxDeathCrossSetups(null).length === 0 && W.trendmxDeathCrossSetups([null]).length === 0, 'null rows: empty, never throws');
}

console.log('== the SMC envelope is one cap shared by both desks ==');
{
  const w = boot();
  const calls = [];
  w.hgSmcEnrich = (ticket) => { calls.push(ticket.sym); ticket.smc = { grade: 'A' }; };
  const rows = [];
  for (let i = 0; i < 47; i++){
    rows.push({ sym: 'T' + i + 'USDT', score: 0, comps: {}, rows4h: dn4, gate: { veto: 'probe' } });
  }
  const golden = [], death = [];
  for (let g = 0; g < 12; g++) golden.push({ sym: 'T' + g + 'USDT', dir: 'long' });
  for (let d = 12; d < 42; d++) death.push({ sym: 'T' + d + 'USDT', dir: 'short' });
  w.tmSmcScanPass(rows, golden, death);
  ok(calls.length === 24, 'one capped envelope (TM_SMC_MAX 24) for BOTH desks, not 24 each — got ' + calls.length);
  ok(calls.indexOf('T0USDT') >= 0 && calls.indexOf('T11USDT') >= 0, 'golden tickets enriched');
  ok(calls.indexOf('T12USDT') >= 0 && calls.indexOf('T23USDT') >= 0, 'death tickets share the same envelope');
  ok(calls.indexOf('T24USDT') === -1, 'the 25th ticket across the combined desks is outside the cap');
  ok(calls.indexOf('T42USDT') === -1 && calls.indexOf('T46USDT') === -1, 'vetoed rows are never candidates');
}

console.log('== the scan snap and crossState carry both halves ==');
{
  const w = boot();
  w.hgDeskLoadUniverse = async () => ({ items: [
    { sym: 'GXUSDT', base: 'GX', exchange: 'binance' },
    { sym: 'DXUSDT', base: 'DX', exchange: 'binance' }
  ], rawLen: 2, note: 'probe', source: 'probe', venueCounts: {} });
  w.hgDeskFetchKlines = async (it, tf) => {
    if (it.sym === 'GXUSDT') return tf === '1d' ? gDaily : up4;
    return tf === '1d' ? dDaily : dn4;
  };
  const snap = await w.trendmxScan({ force: true });
  ok(snap.goldenCross.length === 1 && snap.goldenCross[0].sym === 'GXUSDT' && snap.goldenCross[0].dir === 'long',
     'snap.goldenCross: the golden row surfaces as before');
  ok(snap.deathCross.length === 1 && snap.deathCross[0].sym === 'DXUSDT' && snap.deathCross[0].dir === 'short'
     && snap.deathCross[0].freshCross === 'DEATH', 'snap.deathCross: the mirrored half is ON the scan');
  ok(snap.deathCross[0].stop > snap.deathCross[0].entry && snap.deathCross[0].t1 < snap.deathCross[0].entry,
     'the scanned short has mirrored geometry');
  const st = w.trendmxCrossState();
  ok(st && Array.isArray(st.goldenCross) && Array.isArray(st.deathCross), 'crossState exposes both bags');
  ok(st.goldenCross[0].sym === 'GXUSDT' && st.goldenCross[0].freshCross === 'GOLDEN', 'crossState golden half intact');
  ok(st.deathCross[0].sym === 'DXUSDT' && st.deathCross[0].dir === 'short'
     && st.deathCross[0].conviction === 'STRONG CONVICTION' && st.deathCross[0].tier === 'STRONG',
     'crossState hands the alert cycle the death ticket with its conviction');
}

console.log('== alert keys: a death cross never fills the golden dedup slot ==');
{
  const lib = loadTabAlerts().module.exports;
  const gKey = lib.trendmxCrossSetupKey({ sym: 'SOLUSDT', dir: 'long', freshCross: 'GOLDEN' });
  ok(gKey === 'TRENDMX:GOLDEN:SOLUSDT:long', 'golden key byte-identical to hg-v1011');
  ok(lib.trendmxCrossSetupKey({ sym: 'SOLUSDT' }) === 'TRENDMX:GOLDEN:SOLUSDT:long', 'a side-less ticket still keys golden (default unchanged)');
  ok(lib.trendmxCrossSetupKey({ sym: 'SOLUSDT', dir: 'short', freshCross: 'DEATH' }) === 'TRENDMX:DEATH:SOLUSDT:short',
     'death key is per symbol per side');
  ok(lib.trendmxCrossSetupKey({ sym: 'SOLUSDT', dir: 'short' }) === 'TRENDMX:DEATH:SOLUSDT:short',
     'a normalized short (dir carried by pushSetup) keys as death even without the stamp');
  const now = 1_700_000_000_000;
  const g = { sym: 'SOLUSDT', dir: 'long', freshCross: 'GOLDEN' };
  const d = { sym: 'SOLUSDT', dir: 'short', freshCross: 'DEATH' };
  const fr = lib.trendmxCrossFreshKeys({}, [g, d], now, lib.TRENDMX_CROSS_GAP_MS);
  ok(fr.fresh.length === 2, 'the same symbol crossing up AND down are independent setups, both fresh');
  const fr2 = lib.trendmxCrossFreshKeys(fr.keys, [d], now + 60000, lib.TRENDMX_CROSS_GAP_MS);
  ok(fr2.fresh.length === 0, 'the death half dedups on its own key inside the 10-day window');
}

console.log('== the alert message names what it is ==');
{
  const lib = loadTabAlerts().module.exports;
  const g = { sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 117.5,
    score: 4, adx: 28, conviction: 'STRONG CONVICTION', tier: 'STRONG', prime: true,
    freshCross: 'GOLDEN', note: '⚡GOLDEN CROSS test' };
  const gBody = lib.hgTrendmxCrossAlertFormat(g);
  ok(gBody.indexOf('TREND MATRIX GOLDEN CROSS') >= 0 && gBody.indexOf('⚡GOLDEN fresh cross') >= 0
     && gBody.indexOf('SOLUSDT LONG') >= 0 && gBody.indexOf('🔥') === 0, 'golden body: name, stamp, LONG header, prime tag — unchanged');
  ok(gBody.indexOf('DEATH') === -1 && gBody.indexOf(' SHORT') === -1, 'the golden message never wears the mirror’s clothes');
  const d = { sym: 'DTHUSDT', dir: 'short', entry: 150, stop: 153, t1: 144, t2: 139.5,
    score: -5, adx: 30, conviction: 'STRONG CONVICTION', tier: 'STRONG', prime: true,
    freshCross: 'DEATH', note: '⚡DEATH CROSS test' };
  const dBody = lib.hgTrendmxCrossAlertFormat(d);
  ok(dBody.indexOf('TREND MATRIX DEATH CROSS') >= 0, 'death body names the death cross');
  ok(dBody.indexOf('⚡DEATH fresh cross') >= 0 && dBody.indexOf('15-min alert cycle') >= 0, 'death stamp + the same cycle line');
  ok(dBody.indexOf('DTHUSDT SHORT') >= 0, 'the header reads SHORT');
  ok(dBody.indexOf('-5/5 composite') >= 0 && dBody.indexOf('STRONG CONVICTION') >= 0, 'the negative composite prints honestly, conviction carried');
  ok(dBody.indexOf('GOLDEN') === -1, 'no golden language on a death alert');
  const dPlain = lib.hgTrendmxCrossAlertFormat(Object.assign({}, d, { prime: false, tier: 'CONVICTION', conviction: 'CONVICTION' }));
  ok(dPlain.indexOf('📉') === 0, 'a non-prime death cross wears the red chart tag');
}

console.log('== the 15-min cycle pushes both crosses ==');
{
  const TA = loadTabAlerts();
  TA.window.trendmxCrossState = () => ({
    at: Date.now(),
    goldenCross: [{ sym: 'GLDUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, score: 4,
                    conviction: 'STRONG CONVICTION', tier: 'STRONG', freshCross: 'GOLDEN' }],
    deathCross: [{ sym: 'DTHUSDT', dir: 'short', entry: 150, stop: 153, t1: 144, score: -5,
                   conviction: 'STRONG CONVICTION', tier: 'STRONG', freshCross: 'DEATH' }]
  });
  TA.window.sendTelegram = async (t) => { TA._msgs = TA._msgs || []; TA._msgs.push(t); return true; };
  const run = await TA.window.hgTrendmxCrossAlertsRun({ skipWarm: true, window: TA.window });
  ok(run.pushed === 2 && TA._msgs.length === 2, 'one Telegram per fresh cross — golden AND death');
  const bodies = TA._msgs.join('\n====\n');
  ok(bodies.indexOf('TREND MATRIX GOLDEN CROSS') >= 0 && bodies.indexOf('TREND MATRIX DEATH CROSS') >= 0,
     'both crosses are named in the pushed bodies');
  ok(bodies.indexOf('GLDUSDT LONG') >= 0 && bodies.indexOf('DTHUSDT SHORT') >= 0, 'each keeps its own side');

  const TA2 = loadTabAlerts();
  TA2.window.trendmxCrossState = () => ({ at: Date.now(), goldenCross: [], deathCross: [] });
  const run2 = await TA2.window.hgTrendmxCrossAlertsRun({ skipWarm: true, window: TA2.window });
  ok(run2.pushed === 0 && run2.status === 'none-new-fresh-cross', 'an empty desk reports the both-crosses status');
}

console.log('== the swarm reads both crosses too (ai-agent.js, state path) ==');
{
  const sandbox = {
    module: { exports: {} }, console, Math, JSON, Date, Promise, Number, RegExp,
    isFinite, parseInt, parseFloat, String, Object, Array,
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} }
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'ai-agent.js'), 'utf8'), sandbox, { filename: 'ai-agent.js' });
  sandbox.window.trendmxCrossState = () => ({
    at: Date.now(),
    goldenCross: [{ sym: 'GLDUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, score: 4,
                    conviction: 'STRONG CONVICTION', tier: 'STRONG', freshCross: 'GOLDEN' }],
    deathCross: [{ sym: 'DTHUSDT', dir: 'short', entry: 150, stop: 153, t1: 144, score: -5,
                   conviction: 'STRONG CONVICTION', tier: 'STRONG', freshCross: 'DEATH' }]
  });
  const out = await sandbox.module.exports.hgAgentRunOne('trend-scout');
  const srcs = out.findings.map(f => f.src + ':' + f.sym + ':' + f.dir);
  ok(srcs.indexOf('TRENDMX GOLDEN:GLDUSDT:long') >= 0, 'trend-scout still files the golden cross');
  ok(srcs.indexOf('TRENDMX DEATH:DTHUSDT:short') >= 0, 'trend-scout files the death cross as a short');
  const dd = out.findings.filter(f => f.src === 'TRENDMX DEATH')[0];
  ok(dd && dd.score === 5, 'the swarm ranker gets |composite| — strength, not side (got ' + (dd && dd.score) + ')');
  ok(dd && dd.note.indexOf('⚡DEATH') === 0 && dd.note.indexOf('-5') >= 0, 'the signed composite stays honest in the note');
  ok(dd && dd.tier === 'STRONG' && dd.stop > dd.entry && dd.t1 < dd.entry, 'levels, tier and mirrored geometry carried');
}

console.log('== the rows fallback scouts the mirrored desk (ai-agent.js + real scan) ==');
{
  const w = boot();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'ai-agent.js'), 'utf8'), w, { filename: 'ai-agent.js' });
  w.hgDeskLoadUniverse = async () => ({ items: [
    { sym: 'GXUSDT', base: 'GX', exchange: 'binance' },
    { sym: 'DXUSDT', base: 'DX', exchange: 'binance' }
  ], rawLen: 2, note: 'probe', source: 'probe', venueCounts: {} });
  w.hgDeskFetchKlines = async (it, tf) => {
    if (it.sym === 'GXUSDT') return tf === '1d' ? gDaily : up4;
    return tf === '1d' ? dDaily : dn4;
  };
  /* no scan has run: trendmxCrossState is null, so the scout falls through
     to trendmxScan(...).then(rows => FromRows) — the pre-v1014 dead end */
  ok(w.trendmxCrossState() === null, 'pre-scan: crossState empty, the scout takes the rows fallback');
  const out = await w.hgAgentRunOne('trend-scout');
  const srcs = (out.findings || []).map(f => f.src + ':' + f.sym + ':' + f.dir);
  ok(srcs.indexOf('TRENDMX GOLDEN:GXUSDT:long') >= 0, 'rows fallback: golden cross scouted');
  ok(srcs.indexOf('TRENDMX DEATH:DXUSDT:short') >= 0, 'rows fallback: death cross scouted as a short');
  ok(typeof out.summary === 'string' && out.summary.indexOf('cross setup') >= 0, 'the summary names crosses, not one side');
}

console.log('== the swarm desk and the display pool rank the mirror by strength ==');
{
  const w = boot();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'ai-agent.js'), 'utf8'), w, { filename: 'ai-agent.js' });
  w.fetch = async () => ({ ok: true });
  w.hgDeskLoadUniverse = async () => ({ items: [
    { sym: 'GXUSDT', base: 'GX', exchange: 'binance' },
    { sym: 'DXUSDT', base: 'DX', exchange: 'binance' }
  ], rawLen: 2, note: 'probe', source: 'probe', venueCounts: {} });
  w.hgDeskFetchKlines = async (it, tf) => {
    if (it.sym === 'GXUSDT') return tf === '1d' ? gDaily : up4;
    return tf === '1d' ? dDaily : dn4;
  };
  const res = await w.hgAgentSwarmRun(true);
  ok(res && res.ok === true && res.desk, 'swarm runs with the stubbed universe');
  const top = res.desk.topFindings || [];
  const gT = top.filter(f => f.src === 'TRENDMX GOLDEN')[0];
  const dT = top.filter(f => f.src === 'TRENDMX DEATH')[0];
  ok(gT && gT.sym === 'GXUSDT' && gT.score === 5, 'desk top: golden twin at composite +5');
  ok(dT && dT.sym === 'DXUSDT' && dT.dir === 'short' && dT.score === 5,
     'desk top: the −5 death cross ranks exactly where its +5 golden twin ranks');
  const pool = w.hgAgentWorkforceCollect() || [];
  ok(pool.some(f => f.src === 'TRENDMX DEATH' && f.sym === 'DXUSDT' && f.dir === 'short' && f.agentLabel === 'Trend Matrix'),
     'the display pool carries the death cross under the Trend Matrix label');
  ok(pool.some(f => f.src === 'TRENDMX DEATH' && f.sym === 'DXUSDT' && f.agentLabel === 'Trend Scout'),
     'and under the scout’s own findings — both feeds, like the golden twin');
}

console.log('\nPASS — ' + passed + ' assertions');
