/* HARDGATE — hg-v1357 CANDLE FORECAST intelligence layer.

   Guards the twelve upgrades that landed in candle-forecast-intel.js and the
   tab wiring in gold-candle-forecast.js:

     1. the intel module loads standalone and fails closed on thin tapes
     2. tfDir names BULL/BEAR/NEUTRAL/UNREAD honestly
     3. fiveTf needs four-of-five with none against
     4. volRegime measures ATR against its own median
     5. feedQuality locks on divergence, flags stale legs, never merges prices
     6. executionCard runs NO-TRADE -> WAIT -> ARMED -> TRIGGERED
        (hg-v1417: the ladder is re-driven on the SWING horizon — the old
        scalp fixtures sit under the measured 0.25% cost floor and are
        NO-TRADE now, which is the pack's own mutation; a wide-stop scalp
        fixture proves a scalp CAN still arm past the floor, and an
        unpublished swing proves the withheld bracket never reaches the card)
     7. blockers name the refusal instead of shrugging
     8. patternPerf is labelled in-sample and never sees the future
     9. the tab renders the intel panel after a scan, with a stub DOM
    10. macro.js carries 5m on every leg of the gold feed chain
    11. the alert path exists in tabalerts and stays silent without a state

   Run: node tests/test-candle-forecast-intel-v1357.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INTEL = fs.readFileSync(path.join(ROOT, 'candle-forecast-intel.js'), 'utf8');
const TAB = fs.readFileSync(path.join(ROOT, 'gold-candle-forecast.js'), 'utf8');
const MACRO = fs.readFileSync(path.join(ROOT, 'macro.js'), 'utf8');
const ALERTS = fs.readFileSync(path.join(ROOT, 'tabalerts.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0;
function ok(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
  console.log('  ok - ' + msg);
}

function bootIntel(extraWindow) {
  const window = Object.assign({}, extraWindow || {});
  const ctx = { console, window, Date, Math, isFinite, JSON };
  vm.createContext(ctx);
  vm.runInContext(INTEL, ctx, { filename: 'candle-forecast-intel.js' });
  return { ctx, window, I: window.hgCfIntel };
}

function tape(n, step, startC) {
  const rows = [];
  const t0 = 1760000000;
  let c = startC || 4100;
  for (let i = 0; i < n; i++) {
    c += (step == null ? 0.25 : step);
    rows.push({ t: t0 + i * 900, o: c - 0.2, h: c + 2, l: c - 2, c, v: 10 });
  }
  return rows;
}

console.log('== 1) the module loads standalone and fails closed ==');
{
  const { I } = bootIntel();
  ok(I && typeof I.tfDir === 'function', 'window.hgCfIntel exposes the read');
  ok(I.tfDir([], '15m').dir === 'UNREAD', 'an empty tape is UNREAD, not guessed');
  ok(I.tfDir(tape(10), '15m').dir === 'UNREAD', 'a thin tape is UNREAD');
  ok(/closed bars/.test(I.tfDir(tape(10), '15m').why), 'the thin-tape refusal is named');
  ok(I.structure([]).ok === false && /closed bars/.test(I.structure([]).why), 'structure fails closed on a thin tape');
  ok(I.volRegime([]).ok === false, 'volRegime fails closed on an empty tape');
  ok(I.news().ok === false && /not loaded/.test(I.news().note), 'news without the shared reader is UNCHECKED, not a clear calendar');
}

console.log('\n== 2) tfDir reads a real tape honestly ==');
{
  const { I } = bootIntel();
  ok(I.tfDir(tape(60, 0.5), '15m').dir === 'BULL', 'a rising tape reads BULL');
  ok(I.tfDir(tape(60, -0.5), '15m').dir === 'BEAR', 'a falling tape reads BEAR');
  const flat = tape(60, 0).map((r, i) => ({ ...r, c: 4100 + (i % 2 ? 0.1 : -0.1), o: 4100, h: 4102, l: 4098 }));
  const d = I.tfDir(flat, '15m').dir;
  ok(d === 'NEUTRAL' || d === 'UNREAD', 'a flat tape never reads a side (got ' + d + ')');
}

console.log('\n== 3) fiveTf needs four of five with none against ==');
{
  const { I } = bootIntel();
  const up = tape(60, 0.5);
  const a = I.fiveTf({ rows5m: up, rows15m: up, rows1h: up, rows4h: up, rows1d: up });
  ok(a.aligned === 'BULL' && a.bull === 5, 'five rising tapes align BULL');
  const b = I.fiveTf({ rows5m: tape(60, -0.5), rows15m: up, rows1h: up, rows4h: up, rows1d: up });
  ok(b.aligned === 'NONE', 'one against breaks the alignment');
  const c = I.fiveTf({ rows5m: null, rows15m: up, rows1h: up, rows4h: up, rows1d: up });
  ok(c.aligned === 'BULL' && c.unread === 1, 'an unread row does not block four-of-five');
  const d = I.fiveTf({ rows5m: null, rows15m: null, rows1h: up, rows4h: up, rows1d: up });
  ok(d.aligned === 'NONE', 'three of five is not alignment');
  ok(/no four-of-five/.test(d.why), 'the refusal is stated');
}

console.log('\n== 4) volRegime measures ATR against its own median ==');
{
  const { I } = bootIntel();
  const calm = tape(80, 0.1).map(r => ({ ...r, h: r.c + 1, l: r.c - 1 }));
  const v = I.volRegime(calm);
  ok(v.ok && isFinite(v.ratio) && v.ratio > 0, 'a steady tape measures a finite ratio');
  ok(/median/.test(v.why), 'the baseline is named');
  const spiky = calm.map((r, i) => i >= calm.length - 10 ? ({ ...r, h: r.c + 30, l: r.c - 30 }) : r);
  const v2 = I.volRegime(spiky);
  ok(v2.ok && (v2.regime === 'EXPANSION' || v2.regime === 'EXTREME'), 'a volatility spike reads expansion or extreme (got ' + v2.regime + ')');
}

console.log('\n== 5) feedQuality locks on divergence and flags stale legs ==');
{
  const { I } = bootIntel();
  const nowMs = 1760000000 * 1000 + 50 * 900 * 1000;
  const good = tape(50, 0.25);
  const legs = [
    { name: 'house', rows: good },
    { name: 'venue-b', rows: good.map(r => ({ ...r })) }
  ];
  const q = I.feedQuality(legs, 900, nowMs);
  ok(q.ok && q.worst === 'OK', 'agreeing fresh feeds read OK');
  ok(!q.lock, 'agreeing feeds do not lock');
  const diverged = [
    { name: 'house', rows: good },
    { name: 'venue-b', rows: good.map(r => ({ ...r, c: r.c * 1.02 })) }
  ];
  const q2 = I.feedQuality(diverged, 900, nowMs);
  ok(q2.lock && q2.worst === 'DIVERGED', 'a 2% divergence locks execution');
  const stale = [
    { name: 'house', rows: good },
    { name: 'venue-b', rows: tape(40, 0.25) }
  ];
  const q3 = I.feedQuality(stale, 900, nowMs);
  ok(q3.legs[1].state === 'STALE', 'a leg a full timeframe behind is STALE');
  const none = I.feedQuality([{ name: 'a', rows: null }], 900, nowMs);
  ok(!none.ok && none.worst === 'UNREAD', 'an empty leg set is UNREAD');
}

console.log('\n== 6) the execution card state machine (hg-v1417: the measured scalp cost floor) ==');
{
  const { I } = bootIntel();
  ok(I.executionCard({}).state === 'NO-TRADE', 'no forecast is NO-TRADE');
  /* hg-v1417: the v1357 scalp fixtures sit at a 5/4095 = 0.122% stop — UNDER
     the measured 0.25% cost floor (sub-floor scalp brackets settled -0.28R at
     XM costs and -3.43R at Binance per trade, negative in both halves at
     both). They are no longer executable: the card is NO-TRADE and names the
     cost, on every rung of the old ladder. */
  const base = {
    close: 4100,
    scalp: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: false, ticket: false }
  };
  const subFloor = I.executionCard(base);
  ok(subFloor.state === 'NO-TRADE', 'a sub-floor scalp bracket is NO-TRADE — the measured cost floor (hg-v1417)');
  ok(/cost floor/.test(subFloor.why) && /0\.122%/.test(subFloor.why), 'the NO-TRADE names the stop size and the cost floor');
  const armed = { close: 4100, scalp: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: true, ticket: true } };
  ok(I.executionCard(armed).state === 'NO-TRADE', 'a formed, ticketed scalp is still NO-TRADE under the floor');
  const trig = { close: 4094, scalp: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: true, ticket: true } };
  ok(I.executionCard(trig).state === 'NO-TRADE', 'even price at the entry does not arm a sub-floor scalp');
  /* the ladder itself is unchanged — it is re-driven on the SWING horizon */
  const swingBase = {
    close: 4100,
    swing: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: false, ticket: false }
  };
  ok(I.executionCard(swingBase).state === 'WAIT', 'a swing side without a ticket is WAIT');
  const swingArmed = { close: 4100, swing: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: true, ticket: true } };
  const ea = I.executionCard(swingArmed);
  ok(ea.state === 'ARMED' && ea.rr === 2, 'a swing ticket away from entry is ARMED with the bracket\'s own R:R');
  const swingTrig = { close: 4094, swing: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: true, ticket: true } };
  ok(I.executionCard(swingTrig).state === 'TRIGGERED', 'price at the swing entry is TRIGGERED');
  /* a scalp CAN still arm — past the floor. 11/4095 = 0.269% of entry. */
  const wideScalp = { close: 4100, scalp: { ok: true, dir: 'BULL', entry: 4095, stop: 4084, tp1: 4117, formed: true, ticket: true } };
  const ew = I.executionCard(wideScalp);
  ok(ew.state === 'ARMED' && ew.horizon === 'SCALP' && ew.rr === 2, 'a scalp at or past the 0.25% floor still arms (the floor is a floor, not a ban)');
  const swingWins = {
    close: 4100,
    scalp: { ok: true, dir: 'BULL', entry: 4095, stop: 4084, tp1: 4117, formed: true, ticket: true },
    swing: { ok: true, dir: 'BEAR', entry: 4110, stop: 4120, tp1: 4080, formed: true, ticket: true }
  };
  const es = I.executionCard(swingWins);
  ok(es.horizon === 'SWING', 'a ticketed swing outranks a ticketed scalp');
  /* hg-v1417: a swing bracket the higher timeframe did not confirm is withheld
     from publication — it never reaches the executable card (the read still
     prints on the swing card; the ledger still records it). */
  const unpub = {
    close: 4100,
    swing: { ok: true, dir: 'BULL', entry: 4095, stop: 4090, tp1: 4105, formed: true, ticket: true, published: false }
  };
  ok(I.executionCard(unpub).state === 'NO-TRADE', 'a swing bracket withheld from publication is NO-TRADE on the executable card (hg-v1417)');
}

console.log('\n== 7) blockers name the refusal ==');
{
  const { I } = bootIntel();
  const b = I.blockers({ dir: 'NEUTRAL', patterns: [], advancedPatterns: [] }, {});
  ok(b.some(x => /no side/.test(x)), 'a neutral engine is a named blocker');
  ok(b.some(x => /no named candlestick pattern/.test(x)), 'a missing pattern is a named blocker');
  const b2 = I.blockers({ dir: 'BULL', patterns: ['hammer'] }, { news: { blackout: true } });
  ok(b2.some(x => /blackout/.test(x)), 'a news blackout is a named blocker');
}

console.log('\n== 8) patternPerf is in-sample and never sees the future ==');
{
  let calls = 0;
  const fake = function (rows) {
    calls++;
    return { dir: rows.length % 2 ? 'BULL' : 'BEAR', patterns: ['test-shape'], advancedPatterns: [] };
  };
  const { I } = bootIntel({ goldCandleForecast: fake });
  const p = I.patternPerf(tape(60, 0.25), { windows: 10 });
  ok(p.ok && p.windows > 0, 'the walk ran');
  ok(/in-sample/.test(p.why), 'the in-sample label is on the sentence');
  ok(p.byPattern['test-shape'] && p.byPattern['test-shape'].n > 0, 'the pattern was tallied');
  const bad = tape(60, 0.25);
  bad[30].t = bad[29].t; /* a repeated bar time lets a walk see the future */
  const p2 = I.patternPerf(bad, { windows: 10 });
  ok(!p2.ok && /not strictly increasing/.test(p2.why), 'a walk that can see the future counts nothing');
}

console.log('\n== 9) the tab renders the intel panel after a scan ==');
{
  const els = {
    cfStatus: { textContent: '' },
    cfResultArea: { innerHTML: '', className: '' }
  };
  const window = { HG_tabs: [], HG_BUILD: { version: 'hg-v1357' } };
  const ctx = {
    console, window,
    document: { getElementById: id => els[id] || null },
    Date, isFinite, Math, setTimeout, Promise, JSON
  };
  vm.createContext(ctx);
  vm.runInContext(INTEL, ctx, { filename: 'candle-forecast-intel.js' });
  vm.runInContext(TAB, ctx, { filename: 'gold-candle-forecast.js' });
  const mod = window.HG_tabs.find(t => t && t.id === 'candle-forecast');
  ok(mod && typeof mod.renderIntel === 'function', 'the tab owns renderIntel');
  ok(typeof mod.armAutoScan === 'function', 'the tab owns the auto-scan armer');
  const rows = tape(50, 0.25);
  window.goldCandleForecast = function (r) {
    const c = r[r.length - 1].c;
    return {
      dir: 'NEUTRAL', close: c, agrees: 0, against: 0, checked: 0,
      reasons: [], patterns: [], advancedPatterns: [], note: 'test read',
      daySwings: { ok: true, setups: [], why: 'none' }
    };
  };
  mod.loadGold = async (tf) => ({ rows: rows, source: 'test-feed ' + tf });
  mod.loadGold15m = async () => ({ rows, source: 'test-feed 15m' });
  mod.loadTapes = async () => ({});
  mod.loadMacro = async () => null;
  await mod.runForecast();
  const html = els.cfResultArea.innerHTML;
  ok(/data-cf-intel="1"/.test(html), 'the intelligence panel painted');
  ok(/EXECUTION/.test(html), 'the execution card painted');
  ok(/FIVE-TIMEFRAME ALIGNMENT/.test(html), 'the five-timeframe matrix painted');
  ok(/VOLATILITY/.test(html), 'the volatility regime painted');
  ok(/NEWS RISK/.test(html), 'the news execution risk painted');
  ok(/FEED QUALITY/.test(html), 'the feed quality panel painted');
  ok(/FORWARD LEDGER/.test(html), 'the forward ledger readout painted');
  ok(/WHY NOTHING FORMED|CAUTIONS ON THIS READ/.test(html), 'the blockers panel painted');
  ok(typeof window.hgCandleForecastAlertState === 'function', 'the alert state function is published');
  ok(window.hgCandleForecastAlertState() === null, 'a neutral read publishes no alert');
}

console.log('\n== 10) macro.js carries 5m on every leg ==');
{
  ok(/GOLD_RES_BINANCE = \{ '5m': '5m'/.test(MACRO), 'Binance carries 5m');
  ok(/GOLD_RES_TD\s*= \{ '5m': '5min'/.test(MACRO), 'Twelve Data carries 5m');
  ok(/'5m':\s*\{ i: '5m'/.test(MACRO), 'Yahoo carries 5m');
  ok(/'5m','15m','1h','2h','4h','1d'/.test(MACRO), 'the loader contract names 5m');
}

console.log('\n== 11) the alert path exists and stays silent without a state ==');
{
  ok(/function collectCandleForecast/.test(ALERTS), 'tabalerts owns the collector');
  ok(/collectCandleForecast\(out\)/.test(ALERTS), 'the collector is wired into the batch');
  ok(/hgCandleForecastAlertState/.test(ALERTS) && /hgCandleForecastAlertState/.test(TAB),
    'both sides of the alert contract exist');
  ok(/candle-forecast-intel\.js\?v=/.test(HTML), 'index.html loads the intel module');
  ok(HTML.indexOf('candle-forecast-intel.js') < HTML.indexOf('gold-candle-forecast.js'),
    'the intel module loads before the tab');
  const ctx = { console, window: {}, document: { getElementById: () => null }, Date, isFinite, Math, setTimeout, Promise, JSON };
  vm.createContext(ctx);
  vm.runInContext(TAB, ctx, { filename: 'gold-candle-forecast.js' });
  ok(typeof ctx.window.hgCandleForecastAlertState === 'undefined',
    'no scan means no alert state — silence, not a stale candidate');
}

console.log('\n== 12) hg-v1358: the forecast cone is a band, not a target ==');
{
  const { I } = bootIntel();
  ok(typeof I.forecastCone === 'function', 'the cone read exists');
  ok(I.forecastCone([], { bars: 3 }).ok === false, 'a thin tape fails the cone closed');
  const rows = tape(60, 0.5);
  const c = I.forecastCone(rows, { bars: 3 });
  ok(c.ok && c.steps.length === 3, 'three cone steps print');
  const last = rows[rows.length - 1].c;
  ok(c.steps[0].low < last && c.steps[0].high > last, 'the cone brackets the last close');
  ok(c.steps[2].high - c.steps[2].mid > c.steps[0].high - c.steps[0].mid, 'the cone widens by sqrt(bars)');
  ok(/not a target and not a stop/.test(c.why), 'the cone says it is not a target');
  ok(Math.abs(c.drift) <= (c.steps[0].high - c.steps[0].mid) / 2 + 1e-9, 'the drift tilt is capped at half an ATR');
}

console.log('\n== 13) hg-v1358: the setup grade is a count of printed checks ==');
{
  const { I } = bootIntel();
  ok(I.setupGrade({}, {}).grade === 'NONE', 'no side grades NONE');
  const good = {
    dir: 'BULL', patterns: ['hammer'], advancedPatterns: [],
    confluence: { ok: true, ticket: true, why: 'families with' }
  };
  const intelOk = {
    structure: { ok: true, items: [{ near: true }] },
    fiveTf: { aligned: 'BULL', why: 'aligned' },
    volRegime: { ok: true, regime: 'NORMAL' },
    feedQuality: { ok: true, lock: false, why: 'agree' },
    news: { ok: true, blackout: false, note: 'clear' }
  };
  const gA = I.setupGrade(good, intelOk);
  ok(gA.grade === 'A' && gA.passed === gA.total, 'a full stack grades A');
  const gLock = I.setupGrade(good, Object.assign({}, intelOk, { feedQuality: { ok: true, lock: true, why: 'diverged' } }));
  ok(gLock.grade === 'C', 'a feed lock caps the grade at C');
  const gB = I.setupGrade(good, { structure: { ok: true, items: [] }, fiveTf: { aligned: 'NONE', why: 'split' }, volRegime: { ok: true, regime: 'EXTREME' }, feedQuality: intelOk.feedQuality, news: intelOk.news });
  ok(gB.passed === 5 && gB.grade === 'B', 'a partial stack grades B (' + gB.passed + ' of ' + gB.total + ')');
  ok(gA.checks.length === 8 && gA.checks.every(c => typeof c.label === 'string'), 'every check is printed');
  ok(/not a probability/.test(gA.why), 'the grade disclaims probability');
}

console.log('\n== 14) hg-v1358: the session clock and the distance read ==');
{
  const { I } = bootIntel();
  ok(I.sessionOverlay().ok === false && /not loaded/.test(I.sessionOverlay().why), 'no session clock is UNREAD, not off-hours');
  const booted = bootIntel({ hgGoldKillzoneRead: () => ({ zone: 'LONDON', weight: 2, label: 'LONDON KILLZONE', hourGMT: 8 }) });
  const so = booted.I.sessionOverlay(Date.UTC(2026, 9, 14, 8, 30));
  ok(so.ok && so.zone === 'LONDON', 'the shared killzone read is composed');
  ok(/high-liquidity/.test(so.why), 'the session meaning is stated');
  const d = I.distanceCard({ close: 4100, rows: tape(40, 0.25) }, { entry: 4095, stop: 4090, tp1: 4105, dir: 'BULL', horizon: 'SCALP' });
  ok(d.ok && d.toEntry === -5 && isFinite(d.toEntryAtr), 'the distance to the bracket is measured in dollars and ATR');
  ok(I.distanceCard({ close: 4100 }, null).ok === false, 'no bracket is a closed refusal');
}

console.log('\n== 15) hg-v1358: the pattern record counts three-bar follow-through ==');
{
  const fake = function (rows) {
    return { dir: rows.length % 2 ? 'BULL' : 'BEAR', patterns: ['test-shape'], advancedPatterns: [] };
  };
  const { I } = bootIntel({ goldCandleForecast: fake });
  const p = I.patternPerf(tape(60, 0.25), { windows: 10 });
  ok(p.ok && p.follow3N > 0, 'the three-bar settle ran');
  ok(/three bars later/.test(p.why), 'the follow-through is stated in the sentence');
  ok(/in-sample/.test(p.why), 'the in-sample label survived');
}

console.log('\ntest-candle-forecast-intel-v1357: ' + pass + ' passed, 0 failed');
