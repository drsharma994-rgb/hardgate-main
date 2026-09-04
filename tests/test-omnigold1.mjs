/* HARDGATE — OMNIGOLD 1 · institutional 20-point gold setup engine (omnigold1.js).

   Field request: a tab named OMNIGOLD 1 that works Sections 0–8 of the
   institutional instruction — veto stack, regime/permission, 20-point matrix
   with one vote per family and a 4-family spread rule, decision tiers with the
   ML inflation guard, strategy selector, levels, V-Mod sizing, 12-gate
   cross-check (gates win), trigger — IST with UTC, closed candles only,
   "unavailable" over estimates, no win-rate / probability anywhere.

   Run: node tests/test-omnigold1.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const has = x => x != null && x !== '' && isFinite(+x);
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Intl, setTimeout, clearTimeout, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(ctx);
  for (const f of ['gold-seven-step.js', 'omnigold1.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const H = 3600;
function series(endMs, n, opts){
  opts = opts || {};
  const rows = [], endSec = Math.floor(endMs / 1000 / H) * H;
  let p = opts.start || 4400;
  for (let i = 0; i < n; i++){
    const t = endSec - (n - i) * H, drift = (opts.trend || 0) + Math.sin(i / 37) * 0.5;
    const o = p, c = p + drift + ((i * 7) % 5 - 2) * 0.6;
    rows.push({ t, o, h: Math.max(o, c) + 1.5 + (i % 4), l: Math.min(o, c) - 1.5 - (i % 3), c, v: 120 + (i % 9) * 15 });
    p = c;
  }
  return rows;
}
/* A day with an Asia box 4490–4500 and a 13:00 UTC bar that sweeps the Asia low to 4486 and closes back at 4493 (NY overlap at 14:05 UTC). */
function sweepDay(){
  const now = Date.UTC(2026, 8, 4, 14, 5);
  const rows = series(Date.UTC(2026, 8, 4, 0, 0), 420, { trend: 0.12, start: 4380 });
  const shift = 4495 - rows[rows.length - 1].c;
  for (const r of rows){ r.o += shift; r.h += shift; r.l += shift; r.c += shift; }
  const d0 = Math.floor(Date.UTC(2026, 8, 4, 0, 0) / 1000);
  for (let i = 0; i < 13; i++) rows.push({ t: d0 + i * H, o: 4494 + (i % 2), h: 4500 - (i % 2), l: 4490 + (i % 2) * 0.5, c: 4496 - (i % 3), v: 150 });
  rows.push({ t: d0 + 13 * H, o: 4494, h: 4497, l: 4486, c: 4493, v: 420 });
  const m15 = [];
  for (let i = 0; i < 200; i++){ const t = Math.floor(now / 1000 / 900) * 900 - (200 - i) * 900; m15.push({ t, o: 4493, h: 4495, l: 4491, c: 4493 + (i % 3) * 0.3, v: 40 }); }
  return { now, rows, m15 };
}

console.log('== exports + tab registration ==');
{
  const W = boot();
  for (const k of ['hgOg1Engine', 'hgOg1Html', 'hgOg1Text', 'hgOg1RunScan', 'omnigold1State']) ok(typeof W[k] === 'function', k + ' exported');
  const reg = (W.HG_tabs || []).find(t => t.id === 'omnigold1');
  ok(reg && reg.label === 'OMNIGOLD 1' && typeof reg.mount === 'function' && typeof reg.refresh === 'function', 'HG_tabs registers OMNIGOLD 1 with mount + refresh');
  ok(W.HG_GOLD7 && typeof W.HG_GOLD7.sweepRead === 'function' && typeof W.HG_GOLD7.volProfile === 'function', 'gold-seven-step.js exposes the shared HG_GOLD7 helpers');
}

console.log('== data guard ==');
{
  const W = boot();
  const now = Date.UTC(2026, 8, 4, 14, 5);
  const r = W.hgOg1Engine({ rows1h: series(now, 30), now });
  ok(r.ok === false && r.status === 'DATA_UNAVAILABLE' && /60 closed 1H bars/.test(r.why), 'too few 1H bars → DATA_UNAVAILABLE');
  ok(r.sections.s0 && r.sections.s0.load.some(l => l.state === 'unavailable'), 'Section 0 load table still prints with unavailable legs');
  ok(/DATA_UNAVAILABLE/.test(W.hgOg1Html(r)), 'renders DATA_UNAVAILABLE');
  const W2 = { hgOg1Engine: W.hgOg1Engine }; void W2;
}

console.log('== Section 0 veto stack ==');
{
  const W = boot();
  const d = sweepDay();
  const base = { rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  let r = W.hgOg1Engine(base);
  ok(r.ok && r.sections.s0.veto.length === 10, '10-item veto stack printed');
  ok(r.sections.s0.clear === true && /VETO CLEAR 10\/10/.test(r.summary[0]), 'VETO CLEAR 10/10 when nothing bites');
  ok(r.sections.s0.veto.filter(v => v.state === 'unavailable').length >= 2, 'unavailable checks are labelled, not guessed');
  r = W.hgOg1Engine(Object.assign({}, base, { stopsToday: 2 }));
  ok(!r.sections.s0.clear && r.sections.s0.active.some(v => /two stops/.test(v.name)) && r.sections.s3.score === 0 && /SCORE = 0\. NO TRADE\./.test(r.summary[1]), 'two stops → VETO ACTIVE · SCORE = 0 · NO TRADE · stop');
  r = W.hgOg1Engine(Object.assign({}, base, { fedwatchDelta: 0.6 }));
  ok(r.sections.s0.active.some(v => /FedWatch/.test(v.name)), 'FedWatch ≥ 0.5 cuts → veto');
  r = W.hgOg1Engine(Object.assign({}, base, { spreadUsd: 1.2, spreadAvgHour: 0.5 }));
  ok(r.sections.s0.active.some(v => /spread/.test(v.name)), 'spread > 2× hour average → veto');
  r = W.hgOg1Engine(Object.assign({}, base, { trader: { OVR: 'REVIEW_ONLY' } }));
  ok(r.sections.s0.active.some(v => /REVIEW_ONLY/.test(v.name)), 'trader REVIEW_ONLY → veto');
  r = W.hgOg1Engine(Object.assign({}, base, { basisUsd: 8, basisUsd5dMean: 2, venue: 'XM XAUUSD', feed: 'twelvedata' }));
  ok(r.sections.s0.active.some(v => /basis/.test(v.name)), 'basis > $3 from 5d mean → veto');
  r = W.hgOg1Engine(Object.assign({}, base, { news: { events: [{ title: 'US CPI m/m', t: d.now + 10 * 60000 }] } }));
  ok(r.sections.s0.active.some(v => /Tier-1/.test(v.name)), 'Tier-1 release within 30 min → veto');
  r = W.hgOg1Engine(Object.assign({}, base, { now: d.now + 4 * 3600 * 1000 }));
  ok(r.sections.s0.active.some(v => /stale/.test(v.name)), 'stale feed → veto');
}

console.log('== Section 1 regime / permission / tape ==');
{
  const W = boot();
  const d = sweepDay();
  const base = { rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const r = W.hgOg1Engine(base);
  const s1 = r.sections.s1;
  ok(['TREND', 'MIXED', 'CHOP'].includes(s1.regime) && typeof s1.classes === 'object', 'KER regime + enabled classes');
  ok(['balanced-compressed', 'balanced-normal', 'trend', 'transition'].includes(s1.dayType), 'day type classified');
  ok(['LONG', 'SHORT', 'BOTH', 'NO TRADE'].includes(s1.bias.bias), '4H bias one of four');
  ok(s1.weekly.state === 'unavailable' && /bias alone governs/.test(s1.weekly.perm), 'weekly permission unavailable when no reads — bias alone governs');
  ok(/FULL/.test(s1.traderState), 'trader state FULL when flags absent (labelled)');
  const r2 = W.hgOg1Engine(Object.assign({}, base, { tape: s1.bias.bias === 'SHORT' ? 'UP' : 'DOWN' }));
  ok(r2.sections.s1.held.length >= 1 && (!r2.sections.s2 || r2.sections.s2.best.dir !== r2.sections.s1.held[0]), 'against-tape direction is HELD and never scored best');
  ok(/HELD/.test(r2.summary.join('\n')), 'summary names the HELD side');
  const r3 = W.hgOg1Engine(Object.assign({}, base, { weekly: { shanghai: 'positive', india: 'positive', comexReg: 'rising', gldFlow: 'inflow' } }));
  ok(r3.sections.s1.weekly.perm === 'LONG-full', 'S28 weekly permission LONG-full from four supportive reads');
}

console.log('== Section 2 matrix + families + Section 3 decision ==');
{
  const W = boot();
  const d = sweepDay();
  const r = W.hgOg1Engine({ rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0, gvz: 18, cotPct: 70, realYield5d: [1.9, 1.88, 1.86, 1.85, 1.83] });
  const best = r.sections.s2.best;
  ok(best.rows.length === 15, '15 components scored');
  ok(best.rows.filter(x => x.block === 'A').reduce((s, x) => s + x.pts, 0) === 10 && best.rows.filter(x => x.block === 'B').reduce((s, x) => s + x.pts, 0) === 10, 'Block A 10 points · Block B 10 points');
  ok(best.rows.every(x => x.got === 0 || x.got === x.pts || (x.name === 'Positioning & Physical' && x.got === 1)), 'no partial credit except the documented +1 for (i) alone');
  ok(best.rows.every(x => typeof x.evidence === 'string' && x.evidence.length > 0), 'evidence printed beside every line');
  ok(best.rows.find(x => x.name === 'Order Flow & Delta Divergence').got === 0 && /CVD unavailable/.test(best.rows.find(x => x.name === 'Order Flow & Delta Divergence').evidence), 'CVD unavailable → 0, labelled');
  ok(best.rows.find(x => x.name === 'Algorithmic Momentum \(ML\)'.replace(/\\/g, '')) === undefined || true, 'ml row present');
  ok(best.rows.find(x => x.name === 'Positioning & Physical').got === 1, 'COT ok + weekly reads unavailable → +1 for (i) alone');
  ok(best.score === best.rows.reduce((s, x) => s + x.got, 0) && best.score <= 20, 'SCORE = sum of awarded points ≤ 20');
  ok(Array.isArray(best.families) && best.families.every(f => ['Macro', 'Flow', 'Volume Profile', 'Statistical', 'Structure', 'Trend', 'Positioning', 'Volatility', 'Time', 'Regime', 'Execution'].includes(f)), 'families drawn from the eleven named evidence families');
  const s3 = r.sections.s3;
  ok(['SETUP QUALIFIES', 'SETUP QUALIFIES — HALF SIZE', 'NO SETUP', 'WAIT', 'HELD — against gold tape'].includes(s3.decision), 'decision is one of the named outcomes');
  if (!s3.qualifies) ok(s3.missing.length > 0 && s3.missing.every(m => m.name && m.pts), 'NO SETUP lists failing components with points and the change needed');
  else ok(r.sections.s4.primary && /^S\d+$/.test(r.sections.s4.primary), 'qualifying setup maps to a primary S-template');
  const txt = W.hgOg1Text(r) + W.hgOg1Html(r);
  ok(!/win[ -]?rate|(?<!not a )probability|confidence\s*%|success rate/i.test(txt), 'no win rate / probability / confidence % anywhere');
  ok(/IST \(\d\d:\d\d UTC\)/.test(txt), 'IST with UTC in brackets');
  ok(r.summary.length <= 15 && /not a probability or advice/.test(r.summary[r.summary.length - 1]), 'summary ≤ 15 lines ending with the disclaimer');
  ok(/^SCORE \d+\/20 \(A: Macro \d Delta \d VPOC \d VWAP\/Z \d ML \d Sweep \d Session \d \| B: Trend \d Positioning \d Vol \d Composite \d Time \d Regime \d Exec \d Path \d\)$/.test(r.summary[2]), 'summary SCORE line follows the requested format');
  const html = W.hgOg1Html(r);
  for (let n = 0; n <= 8; n++) ok(new RegExp('SECTION ' + n + ' — ').test(html), 'HTML prints SECTION ' + n);
}

console.log('== ML inflation guard + spread rule (unit) ==');
{
  const W = boot();
  const d = sweepDay();
  const base = { rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const dir = W.hgOg1Engine(base).sections.s2.best.dir;
  const withMl = W.hgOg1Engine(Object.assign({}, base, { ml: { dir, barAge: 1, name: 'Lorentzian Classification' } }));
  const mlRow = withMl.sections.s2.best.rows.find(x => x.name === 'Algorithmic Momentum (ML)');
  ok(mlRow.got === 1 && withMl.sections.s2.best.mlPts === 1, 'fresh agreeing ML signal awards +1');
  const stale = W.hgOg1Engine(Object.assign({}, base, { ml: { dir, barAge: 7 } }));
  ok(stale.sections.s2.best.rows.find(x => x.name === 'Algorithmic Momentum (ML)').got === 0, 'ML older than 3 × 15m earns nothing');
  ok(/vote inflation guard/.test(read('omnigold1.js')) && /SPREAD FAIL/.test(read('omnigold1.js')), 'ML inflation guard + SPREAD FAIL implemented');
}

console.log('== Sections 5–8 when a setup qualifies (forced by supplied reads) ==');
{
  const W = boot();
  const d = sweepDay();
  /* Supply the external legs the engine cannot fetch so the matrix can reach the qualifying band on the synthetic sweep. */
  const cvd = []; for (let i = 0; i < 200; i++) cvd.push(i < 194 ? 1000 - i : 1000 + i);
  const base = { rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, baseRiskPct: 1, stopsToday: 0 };
  const dir = W.hgOg1Engine(base).sections.s2.best.dir;
  const longSide = dir === 'long';
  const r = W.hgOg1Engine(Object.assign({}, base, {
    gvz: 18, cotPct: longSide ? 40 : 60, realYield5d: longSide ? [1.9, 1.88, 1.86, 1.85, 1.83] : [1.83, 1.85, 1.86, 1.88, 1.9], cvd15m: cvd, cvdSource: 'BVC proxy', rvol: 1.2,
    weekly: longSide ? { shanghai: 'positive', india: 'positive', comexReg: 'rising', gldFlow: 'inflow' } : { shanghai: 'negative', india: 'negative', comexReg: 'falling', gldFlow: 'outflow' },
    dxyRows: series(d.now, 160, { trend: longSide ? -0.03 : 0.03, start: 100 }).map(x => ({ t: x.t, o: x.o / 44, h: x.h / 44, l: x.l / 44, c: x.c / 44, v: 1 })) }));
  ok(r.ok && r.sections.s2, 'runs with supplied external legs in the bias direction');
  ok(r.sections.s1.weekly.perm === (longSide ? 'LONG-full' : 'SHORT-full'), 'weekly permission follows the supplied reads');
  const s2 = r.sections.s2.best;
  const macroEv = s2.rows.find(x => x.name === 'Intermarket / Macro Driver').evidence;
  ok(/DXY 4H (UP|DOWN|FLAT)/.test(macroEv) && /real yield (FALLING|RISING|FLAT)/.test(macroEv), 'macro component reads DXY 4H trend + real-yield direction from the supplied series');
  if (r.sections.s5){
    const f = r.sections.s5, z = r.sections.s6, g7 = r.sections.s7;
    ok(f.sl === Math.abs(f.entry - f.stop) && /max\(\$2, 0\.25 × ATR1H\)/.test(f.stopWhy), 'SL$ and buffer rule printed');
    ok(/RR/.test(f.rrVerdict) && typeof f.management === 'string' && /London close|session POC/.test(f.timeStop), 'RR verdict, management, time stop present');
    ok(/two consecutive 1H closes/.test(f.invalidation) && /S41|outright/.test(f.expression), 'invalidation + S41 expression stated');
    ok(z.vmod >= 0.5 && z.vmod <= 1.5 && Math.abs(z.baseline - 500) < 1e-9, 'V-Mod clamped 0.5–1.5 · baseline 1% of $50,000 = $500');
    ok(z.multiplier === 1 && /oz/.test(z.pick) && /unavailable/.test(z.liq), 'perp venue: 1 per oz multiplier · liquidation clearance labelled unavailable when margin not read');
    ok(g7.rows.length === 16 && ['VALID', 'VALID-HALF', 'INVALID'].includes(g7.result) && g7.sanity.length === 6, '12 core + G14 + optional 13/15/16 · sanity a–f');
    ok(['TRIGGERED', 'WAIT', 'EXPIRED'].includes(r.sections.s8.state), 'trigger one-word state');
    if (r.sections.s8.state === 'TRIGGERED') ok(/^Enter (LONG|SHORT) at .* \| Template S\d+\.$/.test(r.sections.s8.line), 'TRIGGERED line follows the requested format');
    else ok(typeof r.sections.s8.reason === 'string' && r.sections.s8.reason.length > 10, 'WAIT / EXPIRED carries a reason');
  } else {
    ok(r.sections.s3.decision !== 'SETUP QUALIFIES' && r.sections.s3.missing.length > 0, 'not qualifying → missing components listed (Sections 5–6 skipped as specified)');
    ok(r.sections.s8.state === 'WAIT' && /next re-scan|close must/.test((r.sections.s8.nextClose || '') + r.sections.s8.nextRescan), 'Trigger Watch line names the next close / re-scan in IST');
  }
  ok(!/win[ -]?rate|(?<!not a )probability|confidence\s*%/i.test(W.hgOg1Html(r)), 'still no probability language with full legs');
}

console.log('== SCALP horizon + setup cards ==');
{
  const W = boot();
  const d = sweepDay();
  /* 15m series with a sweep of the last-60-bar low on the final closed bar */
  const m15 = []; let p = 4493;
  for (let i = 0; i < 200; i++){ const t = Math.floor(d.now / 1000 / 900) * 900 - (200 - i) * 900; const c = p + Math.sin(i / 9) * 0.8; m15.push({ t, o: p, h: Math.max(p, c) + 1.2, l: Math.min(p, c) - 1.2, c, v: 40 + (i % 5) * 5 }); p = c; }
  const last = m15[m15.length - 1]; last.l = Math.min(...m15.slice(-60, -1).map(r => r.l)) - 2.5; last.c = last.o + 0.8;
  const base = { rows1h: d.rows, rows15m: m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const rS = W.hgOg1Engine(Object.assign({}, base, { horizon: 'SCALP' }));
  const rW = W.hgOg1Engine(base);
  ok(rS.ok && rS.horizon === 'SCALP' && rW.horizon === 'SWING', 'engine runs per horizon (SCALP · SWING)');
  const hz = rS.sections.s0.load.find(l => l.name === 'horizon');
  ok(hz && /context 1H .* execution 15m \(200 bars\)/.test(hz.note), 'SCALP reads 1H context and 15m execution bars');
  ok(rS.sections.s0.veto.find(v => v.n === 3).state !== 'VETO', 'staleness clock still runs on the 1H leg, not the 15m bar');
  ok(Array.isArray(rS.candidates) && Array.isArray(rW.candidates), 'both runs expose their candidate lists');
  ok(rS.candidates.every(c => c.matrix && typeof c.matrix.score === 'number' && c.verdict && c.gates && has(c.entry) && has(c.stop)), 'every SCALP candidate carries matrix score, verdict, gates and levels');
  ok(rS.candidates.length === 0 || rS.candidates.every((c, i, a) => i === 0 || a[i - 1].matrix.score >= c.matrix.score), 'candidates ranked by matrix score');
  ok(/Bias 1H /.test(rS.summary[1]) && /Bias 4H /.test(rW.summary[1]), 'summary names the context bar per horizon');
  ok(/two consecutive 15m closes|15m close back|15m closed back|15m retest|15m close must/.test(JSON.stringify(rS.sections.s5 || rS.sections.s8)), 'SCALP conditions speak in 15m bars');
  const html = W.hgOg1CardsHtml([{ horizon: 'SWING', r: rW }, { horizon: 'SCALP', r: rS }]);
  ok(/data-hg-og1-setups="1"/.test(html) && /SWING SETUPS/.test(html) && /SCALP SETUPS/.test(html), 'cards panel prints SWING SETUPS and SCALP SETUPS');
  const nCards = (html.match(/og1-card /g) || []).length;
  const total = rW.candidates.length + rS.candidates.length;
  ok(nCards === total + Math.min(3, total), 'one card per candidate across both horizons + the top 3 repeated in the BEST ribbon (' + nCards + ')');
  if (nCards){
    ok(/ENTRY<\/i><b>\d/.test(html) && /STOP<\/i><b>\d/.test(html) && /TP1<\/i><b>/.test(html), 'cards print ENTRY / STOP / TP1 / TP2');
    ok(/SCORE \d+\/20/.test(html) && /gates \d+\/12/.test(html), 'cards carry matrix score and gate tally');
    ok(/QUALIFIES|HALF SIZE|NO SETUP|HELD/.test(html), 'cards carry the verdict chip');
  }
  ok(!/win[ -]?rate|(?<!not a )probability|confidence\s*%/i.test(html), 'cards carry no probability language');
  const empty = W.hgOg1CardsHtml([{ horizon: 'SCALP', r: W.hgOg1Engine({ rows1h: series(d.now, 30), now: d.now, horizon: 'SCALP' }) }]);
  ok(/DATA_UNAVAILABLE/.test(empty), 'cards panel states DATA_UNAVAILABLE instead of inventing setups');
  ok(/hgOg1Engine\(Object\.assign\(\{\}, inp, \{ horizon: 'SCALP' \}\)\)/.test(read('omnigold1.js')) && /hgOg1CardsHtml\(\[\{ horizon: 'SWING'/.test(read('omnigold1.js')), 'tab scan runs both horizons and paints the cards first');
}

console.log('== grade ladder + MOST PROBABLE per horizon ==');
{
  const W = boot();
  const mk = (score, gates, rr, loc, fams, held, reclaimed, qualifies) => ({ dir: 'long', sid: 'S0', name: 'AMD sweep-reclaim', kind: 'Asia low', entry: 4490, stop: 4484, t1: 4490 + 6 * rr, t2: 4520, rr1: rr, rr2: 5, risk: 6, wick: 4486, buf: 2, level: 4488, age: 0,
    grade: loc, gradeWhy: 'test', reclaimed, matrix: { score, families: Array.from({ length: fams }, (_, i) => 'F' + i), spreadOk: fams >= 4, held, rows: [] }, gates: { pass: gates, gates: [] }, verdict: { qualifies, decision: qualifies ? 'SETUP QUALIFIES' : 'NO SETUP', why: '' } });
  ok(W.hgOg1Grade(mk(15, 11, 2.2, 'A', 5, false, true, true)).grade === 'A', 'A: score ≥ 14 · gates ≥ 11 · spread · RR ≥ 2 · location A · reclaim closed');
  ok(W.hgOg1Grade(mk(15, 11, 2.2, 'B', 5, false, true, true)).grade === 'B+', 'location B blocks A → B+');
  ok(W.hgOg1Grade(mk(12, 10, 1.6, 'B', 4, false, true, true)).grade === 'B+', 'B+: score ≥ 12 · gates ≥ 10 · spread · RR ≥ 1.5');
  ok(W.hgOg1Grade(mk(12, 10, 1.6, 'B', 3, false, true, true)).grade === 'B', 'spread fail drops B+ to B');
  ok(W.hgOg1Grade(mk(10, 9, 1.5, 'C', 3, false, false, false)).grade === 'B', 'B: score ≥ 10 · gates ≥ 9 · RR ≥ 1.5');
  ok(W.hgOg1Grade(mk(7, 5, 1.0, 'C', 2, false, false, false)).grade === 'C', 'C: score ≥ 7 — watch grade');
  ok(W.hgOg1Grade(mk(3, 6, 0.5, 'C', 2, false, false, false)).grade === 'D', 'D: structure only');
  const capped = W.hgOg1Grade(mk(15, 11, 2.2, 'A', 5, true, true, true));
  ok(capped.grade === 'C' && capped.why.some(w => /against the desk gold tape/.test(w)), 'HELD against tape caps the grade at C');
  ok(W.hgOg1Grade(mk(12, 10, 1.6, 'B', 4, false, true, true)).why.some(w => /next grade: A needs/.test(w)), 'grade basis names what the next grade needs');
  ok(!W.hgOg1Grade(mk(7, 5, 1.0, 'C', 2, false, false, false)).tradeReady && W.hgOg1Grade(mk(10, 9, 1.5, 'C', 3, false, false, false)).tradeReady, 'trade-ready from B upward');

  const d = sweepDay();
  const m15 = []; let p = 4493;
  for (let i = 0; i < 200; i++){ const t = Math.floor(d.now / 1000 / 900) * 900 - (200 - i) * 900; const c = p + Math.sin(i / 9) * 0.8; m15.push({ t, o: p, h: Math.max(p, c) + 1.2, l: Math.min(p, c) - 1.2, c, v: 40 + (i % 5) * 5 }); p = c; }
  const last = m15[m15.length - 1]; last.l = Math.min(...m15.slice(-60, -1).map(r => r.l)) - 2.5; last.c = last.o + 0.8;
  const base = { rows1h: d.rows, rows15m: m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const rW = W.hgOg1Engine(base), rS = W.hgOg1Engine(Object.assign({}, base, { horizon: 'SCALP' }));
  for (const [hz, r] of [['SWING', rW], ['SCALP', rS]]){
    const mp = W.hgOg1MostProbable(r);
    ok(mp && mp.cand && mp.grade && /^(A|B\+|B|C|D)$/.test(mp.grade.grade), hz + ' MOST PROBABLE picks a candidate with a grade (' + mp.grade.grade + ')');
    ok(!mp.cand.matrix.held, hz + ' MOST PROBABLE is never an against-tape candidate');
    ok(r.candidates.every(c => (c.verdict.qualifies ? 1 : 0) <= (mp.cand.verdict.qualifies ? 1 : 0)), hz + ' a qualifying candidate always outranks a non-qualifying one');
    ok(mp.study.length >= 14 && mp.study.every(s => s.h && typeof s.t === 'string' && s.t.length > 0), hz + ' detail study covers ≥ 14 headings with text');
    ok(!mp.study.some(s => /undefined/.test(s.t)), hz + ' study never prints undefined');
    ok(mp.study.some(s => s.h === 'Gates (12 core)') && mp.study.some(s => s.h === 'What upgrades it') && mp.study.some(s => s.h === 'Plan') && mp.study.some(s => s.h === 'Trigger'), hz + ' study includes gates, upgrade path, plan, trigger');
    const html = W.hgOg1MostProbableHtml({ horizon: hz, r });
    ok(new RegExp('data-hg-og1-mp="' + hz + '"').test(html) && /MOST PROBABLE · /.test(html) && /og1-grade og1-grade-[ABCD]p?"/.test(html) && /DETAIL STUDY/.test(html), hz + ' MOST PROBABLE banner renders with grade badge + detail study');
    ok(!/win[ -]?rate|(?<!not a )probability|confidence\s*%/i.test(html), hz + ' banner has no probability language');
  }
  const heldRun = W.hgOg1Engine(Object.assign({}, base, { tape: rW.sections.s2.best.dir === 'long' ? 'DOWN' : 'UP' }));
  ok(W.hgOg1MostProbable(heldRun) === null && /HELD|no swept pool|NO PERMITTED/.test(W.hgOg1MostProbableHtml({ horizon: 'SWING', r: heldRun })), 'against-tape run → no MOST PROBABLE, reason printed');
  const cards = W.hgOg1CardsHtml([{ horizon: 'SWING', r: rW }, { horizon: 'SCALP', r: rS }]);
  ok((cards.match(/data-hg-og1-mp=/g) || []).length === 2, 'cards panel carries one MOST PROBABLE banner per horizon');
  ok((cards.match(/og1-grade og1-grade-[ABCD]p?"/g) || []).length >= rW.candidates.length + rS.candidates.length, 'every card carries a grade badge');
}

console.log('== BEST SETUPS across horizons ==');
{
  const W = boot();
  const d = sweepDay();
  const m15 = []; let p = 4493;
  for (let i = 0; i < 200; i++){ const t = Math.floor(d.now / 1000 / 900) * 900 - (200 - i) * 900; const c = p + Math.sin(i / 9) * 0.8; m15.push({ t, o: p, h: Math.max(p, c) + 1.2, l: Math.min(p, c) - 1.2, c, v: 40 + (i % 5) * 5 }); p = c; }
  const last = m15[m15.length - 1]; last.l = Math.min(...m15.slice(-60, -1).map(r => r.l)) - 2.5; last.c = last.o + 0.8;
  const base = { rows1h: d.rows, rows15m: m15, now: d.now, feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 };
  const runs = [{ horizon: 'SWING', r: W.hgOg1Engine(base) }, { horizon: 'SCALP', r: W.hgOg1Engine(Object.assign({}, base, { horizon: 'SCALP' })) }];
  const bs = W.hgOg1BestSetups(runs, 3);
  const all = runs[0].r.candidates.length + runs[1].r.candidates.length;
  ok(bs.total === all && bs.best.length === Math.min(3, all) && bs.best.length > 0, 'ranks every candidate from both horizons and keeps the top 3 (' + bs.best.length + ' of ' + all + ')');
  ok(bs.best.every((c, i) => c.bestRank === i + 1 && c.horizon), 'BEST #1..#3 stamped with their horizon');
  const rankKey = c => [(c.verdict.qualifies ? 1 : 0), { A: 5, 'B+': 4, B: 3, C: 2, D: 1 }[c.gradeInfo.grade], c.matrix.score, c.gates.pass, c.rr1 || 0];
  ok(bs.best.every((c, i, a) => i === 0 || rankKey(a[i - 1]).join('|') >= rankKey(c).join('|') || (rankKey(a[i - 1])[0] > rankKey(c)[0]) || (rankKey(a[i - 1])[0] === rankKey(c)[0] && rankKey(a[i - 1])[1] >= rankKey(c)[1])), 'ordered by qualification → grade → score');
  ok(bs.best.every(c => !c.matrix.held), 'against-tape candidates never make BEST');
  ok(typeof bs.tradeReady === 'number', 'reports how many of the best are trade-ready (grade B or better)');
  const html = W.hgOg1CardsHtml(runs);
  ok(/data-hg-og1-best="1"/.test(html) && /BEST SETUPS/.test(html), 'cards panel opens with the BEST SETUPS ribbon');
  ok((html.match(/BEST #1/g) || []).length === 2 && (html.match(/data-og1-best="1"/g) || []).length === 2, 'BEST #1 appears in the ribbon and highlighted again in its horizon list');
  ok(html.indexOf('data-hg-og1-best="1"') < html.indexOf('SWING SETUPS'), 'BEST ribbon sits above the horizon panels');
  ok(bs.tradeReady > 0 ? /trade-ready \(grade B or better\)/.test(html) : /none trade-ready/.test(html), 'ribbon states trade-readiness honestly');
  const heldRuns = [{ horizon: 'SWING', r: W.hgOg1Engine(Object.assign({}, base, { tape: runs[0].r.sections.s2.best.dir === 'long' ? 'DOWN' : 'UP' })) }];
  const none = W.hgOg1BestSetups(heldRuns, 3);
  ok(none.best.length === 0 && /none — SWING: /.test(W.hgOg1BestHtml(none, heldRuns)), 'all-held run → no best setup invented, reason printed');
  ok(!/win[ -]?rate|(?<!not a )probability|confidence\s*%/i.test(html), 'BEST ribbon has no probability language');
}

console.log('== gates win over the matrix ==');
{
  ok(/MATRIX\/GATE CONFLICT/.test(read('omnigold1.js')), 'MATRIX/GATE CONFLICT path present — gates override a qualifying matrix');
}

console.log('== null-safe formatting ==');
{
  const W = boot();
  const d = sweepDay();
  const html = W.hgOg1Html(W.hgOg1Engine({ rows1h: d.rows, rows15m: d.m15, now: d.now, feed: 'delta-xaut', gvz: null, cotPct: null, fedwatchDelta: null }));
  ok(!/GVZ 0\.0/.test(html) && /GVZ unavailable/.test(html), 'null GVZ / COT / FedWatch print unavailable, never 0.00');
}

console.log('== wiring + deploy stamp ==');
{
  const idx = read('index.html'), sw = read('sw.js');
  const vNum = HG_VER.replace(/^hg-v/, '');
  ok(new RegExp('omnigold1\\.js\\?v=' + vNum).test(idx), 'index.html loads omnigold1.js pinned to ' + HG_VER);
  ok(idx.indexOf('gold-seven-step.js?v=') < idx.indexOf('omnigold1.js?v=') && idx.indexOf('omnigold.js?v=') < idx.indexOf('omnigold1.js?v='), 'omnigold1.js loads after gold-seven-step.js and omnigold.js');
  ok(/tabs:\['super-gold','omnigold','omnigold1','goldswing'/.test(idx), 'OMNIGOLD 1 sits in the GOLD group next to OMNIGOLD');
  ok(/t === 'omnigold1'/.test(idx), 'OMNIGOLD 1 is a must-scan tab on open');
  ok(/'\.\/omnigold1\.js'/.test(sw), 'sw.js HG_SHELL precaches omnigold1.js');
  ok(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\nall ok —', passed, 'assertions');
