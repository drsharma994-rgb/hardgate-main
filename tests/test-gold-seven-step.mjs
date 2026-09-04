/* HARDGATE — Gold 7-step setup engine (gold-seven-step.js).

   Field request: apply the Gold Playbook 7-step instruction inside OMNIGOLD,
   GOLD SCALP and GOLD SWING — indicators → bias → candidates → best fit →
   levels → checklist → TRIGGERED / WAIT / EXPIRED, IST with UTC in brackets,
   closed candles only, "unavailable" over estimates, no win-rate / probability.

   Run: node tests/test-gold-seven-step.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(withGoldind){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
                Promise, RegExp, Intl, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener(){} };
  vm.createContext(ctx);
  if (withGoldind){
    for (const f of ['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js']) vm.runInContext(read(f), ctx, { filename: f });
  }
  vm.runInContext(read('gold-seven-step.js'), ctx, { filename: 'gold-seven-step.js' });
  return ctx;
}

const H = 3600;
/** Closed 1H series ending at the bar that closes at `endMs` (exclusive of forming bar). */
function series(endMs, n, opts){
  opts = opts || {};
  const rows = [];
  const endSec = Math.floor(endMs / 1000 / H) * H;
  let p = opts.start || 4400;
  for (let i = 0; i < n; i++){
    const t = endSec - (n - i) * H;
    const drift = (opts.trend || 0) + Math.sin(i / 37) * 0.5;
    const o = p, c = p + drift + ((i * 7) % 5 - 2) * 0.6;
    const h = Math.max(o, c) + 1.5 + (i % 4), l = Math.min(o, c) - 1.5 - (i % 3);
    rows.push({ t, o, h, l, c, v: 120 + (i % 9) * 15 });
    p = c;
  }
  return rows;
}

console.log('== exports ==');
{
  const W = boot(false);
  for (const k of ['hgGoldSevenStep', 'hgGoldSevenStepHtml', 'hgGoldSevenStepText', 'hgGoldSevenStepPanel',
                   'hgGoldSevenStepLoad1h', 'hgGoldSevenStepClosedRows', 'hgGoldSevenStepDerive4h', 'hgGoldSevenStepSession', 'hgGoldSevenStepIst'])
    ok(typeof W[k] === 'function', k + ' exported');
}

console.log('== closed candles only ==');
{
  const W = boot(false);
  const now = Date.UTC(2026, 8, 4, 9, 20);
  const rows = series(now, 80);
  const lastClosedT = rows[rows.length - 1].t;
  rows.push({ t: lastClosedT + H, o: 1, h: 2, l: 0.5, c: 1.5, v: 1 }); /* forming 09:00 bar */
  const closed = W.hgGoldSevenStepClosedRows(rows, H, now);
  ok(closed.length === 80 && closed[closed.length - 1].t === lastClosedT, 'forming 1H bar dropped; last closed bar kept');
  const ms = rows.map(r => ({ t: r.t * 1000, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }));
  ok(W.hgGoldSevenStepClosedRows(ms, H, now).length === 80, 'ms timestamps normalised to seconds');
}

console.log('== 4H derived from 1H aligned to 22:00 UTC ==');
{
  const W = boot(false);
  const now = Date.UTC(2026, 8, 4, 9, 20);
  const rows = series(now, 200);
  const r4 = W.hgGoldSevenStepDerive4h(rows, now);
  ok(r4.length >= 40, 'derived 4H bars (' + r4.length + ')');
  ok(r4.every(b => ((b.t - 22 * H) % (4 * H) + 4 * H) % (4 * H) === 0), 'every 4H bucket opens at 22:00 / 02:00 / 06:00 / 10:00 / 14:00 / 18:00 UTC');
  ok(r4[r4.length - 1].t + 4 * H <= Math.floor(now / 1000), 'last derived 4H bucket is closed');
  const b = r4[5];
  const src = rows.filter(r => r.t >= b.t && r.t < b.t + 4 * H);
  ok(src.length === 4 && b.o === src[0].o && b.c === src[3].c && b.h === Math.max(...src.map(r => r.h)) && b.l === Math.min(...src.map(r => r.l)), 'OHLC aggregation exact');
}

console.log('== sessions with DST + IST formatting ==');
{
  const W = boot(false);
  const S = W.hgGoldSevenStepSession;
  ok(S(Date.UTC(2026, 6, 1, 7, 30)).key === 'LONDON_OPEN', 'Jul 07:30 UTC = 08:30 BST → LONDON OPEN');
  ok(S(Date.UTC(2026, 0, 15, 8, 30)).key === 'LONDON_OPEN', 'Jan 08:30 UTC = 08:30 GMT → LONDON OPEN');
  ok(S(Date.UTC(2026, 0, 15, 7, 30)).key === 'ASIA', 'Jan 07:30 UTC = 07:30 GMT → still ASIA (DST handled)');
  ok(S(Date.UTC(2026, 6, 1, 13, 0)).key === 'NY_OPEN', 'Jul 13:00 UTC = 09:00 EDT → NY OPEN');
  ok(S(Date.UTC(2026, 6, 1, 15, 0)).key === 'NY_OVERLAP', 'Jul 15:00 UTC → NY OVERLAP (London still open)');
  ok(S(Date.UTC(2026, 6, 1, 17, 0)).key === 'NY_PM' && S(Date.UTC(2026, 6, 1, 17, 0)).tradeable === false, 'Jul 17:00 UTC → NY AFTERNOON manage-only');
  ok(S(Date.UTC(2026, 6, 1, 2, 0)).key === 'ASIA', '02:00 UTC → ASIA');
  ok(W.hgGoldSevenStepIst(Date.UTC(2026, 6, 1, 13, 0)) === '18:30 IST (13:00 UTC)', 'IST printed with UTC in brackets');
  const lc = S(Date.UTC(2026, 6, 1, 9, 0)).londonCloseMs;
  ok(W.hgGoldSevenStepIst(lc) === '21:30 IST (16:00 UTC)', 'summer time stop = London close 21:30 IST');
  const lcW = S(Date.UTC(2026, 0, 15, 9, 0)).londonCloseMs;
  ok(W.hgGoldSevenStepIst(lcW) === '22:30 IST (17:00 UTC)', 'winter time stop = London close 22:30 IST');
}

console.log('== DATA_UNAVAILABLE guards ==');
{
  const W = boot(false);
  const now = Date.UTC(2026, 8, 4, 9, 20);
  let r = W.hgGoldSevenStep({ rows1h: series(now, 30), now });
  ok(r.ok === false && r.status === 'DATA_UNAVAILABLE' && /60 closed 1H bars/.test(r.why), 'too few 1H bars → DATA_UNAVAILABLE');
  r = W.hgGoldSevenStep({ rows1h: series(now - 5 * 3600 * 1000, 300), now });
  ok(r.ok === false && /stale/.test(r.why), 'last closed bar > 2h old → DATA_UNAVAILABLE (stale)');
  r = W.hgGoldSevenStep({ rows1h: series(now, 300), now, basisPct: 2.4, venue: 'Delta XAUTUSD' });
  ok(r.ok === false && /basis abnormal/.test(r.why), 'abnormal venue basis → DATA_UNAVAILABLE');
  const gap = series(now, 300); gap.splice(150, 80);
  r = W.hgGoldSevenStep({ rows1h: gap, now });
  ok(r.ok === false && /missing a day/.test(r.why), 'day-sized hole → DATA_UNAVAILABLE');
  r = W.hgGoldSevenStep({ now });
  ok(r.ok === false && r.summary.length === 2 && /Rule-based checklist, not advice/.test(r.summary[1]), 'no bars → stops with disclaimer');
  const html = W.hgGoldSevenStepHtml(r);
  ok(/DATA_UNAVAILABLE/.test(html) && /data-hg-gold-seven="1"/.test(html), 'DATA_UNAVAILABLE renders as its own panel');
}

console.log('== full run on a live series (no engines) ==');
{
  const W = boot(false);
  const now = Date.UTC(2026, 8, 4, 9, 20); /* Fri 09:20 UTC = LONDON LATE */
  const rows = series(now, 500, { trend: 0.15 });
  const r = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau', equity: 50000 });
  ok(r.ok && r.status === 'OK', 'engine runs');
  ok(r.feed.derived4h === true && r.feed.bars4h > 40, '4H derived when no 4H leg supplied');
  const s1 = r.steps.s1;
  ok(s1.vp && isFinite(s1.vp.poc) && isFinite(s1.vp.vah) && isFinite(s1.vp.val) && s1.vp.vah > s1.vp.val, 'STEP 1 VP POC / VAH / VAL from the 4H dealing range');
  ok(Array.isArray(s1.vp.hvn) && Array.isArray(s1.vp.lvn), 'STEP 1 HVN / LVN zones');
  ok(s1.sessionPocs.length >= 2 && ['UP', 'DOWN', 'FLAT'].includes(s1.pocStep), 'STEP 1 session POCs + stepping read');
  ok(s1.asia && s1.asia.hi > s1.asia.lo, 'STEP 1 Asia range');
  ok(s1.pd && s1.pw && s1.pd.hi > s1.pd.lo && s1.pw.hi > s1.pw.lo, 'STEP 1 prior day + prior week levels');
  ok(isFinite(s1.atr1h) && isFinite(s1.atr4h) && ['compressed', 'normal', 'expanded'].includes(s1.atrRegime), 'STEP 1 ATR + regime');
  ok(isFinite(s1.adr.used), 'STEP 1 ADR(10) used %');
  ok(isFinite(s1.rsi4h) && isFinite(s1.ker) && ['UP', 'DOWN', 'FLAT'].includes(s1.emaSlope), 'STEP 1 RSI / KER / EMA slope');
  ok(s1.session.key === 'LONDON_LATE', 'STEP 1 session detected');
  ok(s1.dxy.state === 'unavailable' && s1.funding.state === 'unavailable' && s1.gvz.state === 'unavailable' && s1.cot.state === 'unavailable' && s1.shanghai.state === 'unavailable', 'STEP 1 macro legs labelled unavailable when not supplied (never invented)');
  ok(s1.news.available === false, 'STEP 1 news calendar labelled unavailable');
  const ids = s1.eligible.map(e => e.id);
  ok(ids.includes('S0') && ids.includes('S20') && ids.includes('S1') && ids.includes('S2'), 'STEP 1 live set S0 / S20 eligible + S1 / S2 as targets');
  ok(s1.disabled.some(d => d.id === 'S8' && /fix window|catalog freeze/.test(d.why)), 'STEP 1 S8 disabled with a stated reason');
  ok(s1.disabled.some(d => d.id === 'S3' || d.id === 'S5'), 'STEP 1 KER / session gated leads listed as disabled');
  ok(['LONG', 'SHORT', 'BOTH', 'NO TRADE'].includes(r.steps.s2.bias), 'STEP 2 bias is one of LONG / SHORT / BOTH / NO TRADE');
  ok(/none|veto active|unavailable/.test(r.steps.s2.rsiVeto), 'STEP 2 RSI veto status stated');
  ok(r.steps.s3.rankName === 'RULE-BASED CONFLUENCE RANK', 'STEP 3 rank named rule-based confluence rank');
  ok(typeof r.steps.s4.nextRescan === 'string' && /IST/.test(r.steps.s4.nextRescan), 'STEP 4 next re-scan printed in IST');
  ok(['TRIGGERED', 'WAIT', 'EXPIRED'].includes(r.steps.s7.state), 'STEP 7 one-word state');
  ok(r.summary.length <= 15 && /Rule-based checklist, not advice/.test(r.summary[r.summary.length - 1]), 'summary ≤ 15 lines ending with the disclaimer');
  const text = W.hgGoldSevenStepText(r) + W.hgGoldSevenStepHtml(r);
  ok(!/win[ -]?rate|probability|confidence\s*%|success rate/i.test(text), 'no win rate / probability / confidence % anywhere');
  const html = W.hgGoldSevenStepHtml(r);
  for (let n = 1; n <= 7; n++) ok(new RegExp('STEP ' + n + ' — ').test(html), 'HTML prints STEP ' + n + ' heading');
  ok(/IST \(\d\d:\d\d UTC\)/.test(html), 'HTML times are IST with UTC in brackets');
}

console.log('== sweep → reclaim candidate, levels, tape rule ==');
{
  const W = boot(false);
  /* Build a day: Asia box 4490–4500 (00:00–07:00 UTC), London bar 08:00 sweeps 4486 and closes 4493. Now 09:05 UTC. */
  const now = Date.UTC(2026, 8, 4, 9, 5);
  const rows = series(Date.UTC(2026, 8, 4, 0, 0), 420, { trend: 0.12, start: 4380 });
  const lastC = rows[rows.length - 1].c;
  const shift = 4495 - lastC;
  for (const r of rows){ r.o += shift; r.h += shift; r.l += shift; r.c += shift; }
  const d0 = Math.floor(Date.UTC(2026, 8, 4, 0, 0) / 1000);
  for (let i = 0; i < 8; i++){
    const o = 4494 + (i % 2), c = 4496 - (i % 3);
    rows.push({ t: d0 + i * H, o, h: 4500 - (i % 2), l: 4490 + (i % 2) * 0.5, c, v: 150 });
  }
  rows.push({ t: d0 + 8 * H, o: 4494, h: 4497, l: 4486, c: 4493, v: 420 }); /* 08:00 sweep of Asia low + reclaim close */
  const r = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau', equity: 50000, venue: 'Delta XAUTUSD', basisPct: 0.12 });
  ok(r.ok, 'engine runs on the sweep day');
  const cands = r.steps.s3.candidates;
  const long = cands.find(c => c.dir === 'long' && /Asia low/.test(c.kind));
  ok(!!long, 'S0 LONG candidate from the Asia-low sweep');
  ok(long.gates.find(g => g.n === 4).pass && long.gates.find(g => g.n === 5).pass, 'G4 pool swept + G5 reclaim closed ≤ 3 bars with displacement pass');
  ok(long.sweep && long.sweep.displacementAtr >= 0.5 && /displacement \d/.test(long.gates.find(g => g.n === 5).note), 'G5 note prints the reclaim displacement (× ATR)');
  {
    /* same day, but the reclaim bar closes only 0.4 above the pool — a wick-and-close-back with no follow-through */
    const weak = rows.map(x => Object.assign({}, x));
    const lw = weak[weak.length - 1]; lw.o = 4490.2; lw.h = 4491; lw.l = 4488.5; lw.c = 4490.4; /* wick→close 1.9 ≈ 0.23 × ATR */
    const rw = W.hgGoldSevenStep({ rows1h: weak, now, feed: 'synthetic-xau', equity: 50000 });
    const wc = rw.steps.s3.candidates.find(c => c.dir === 'long' && /Asia low/.test(c.kind));
    ok(wc && wc.sweep.displacementAtr < 0.5 && !wc.gates.find(g => g.n === 5).pass && /weak — no follow-through/.test(wc.gates.find(g => g.n === 5).note), 'reclaim without ≥ 0.5 × ATR displacement fails G5 and says why (2-month replay: 47/59 such trades stopped)');
  }
  ok(long.age === 0 && long.reclaimed === true, 'sweep age 0 on the last closed bar, reclaim closed');
  ok(long.wick === 4486 && long.stop < 4486, 'stop sits beyond the sweep wick (4486) with buffer');
  ok(Math.abs(long.stop - (4486 - Math.max(2, 0.25 * r.steps.s1.atr1h))) < 1e-9, 'buffer = max($2, 0.25 × 1H ATR)');
  ok(long.entry > 4490 && long.entry <= 4490 + Math.max(2, 0.1 * r.steps.s1.atr1h) + 1e-9, 'entry named just inside the reclaimed pool');
  ok(long.families.total >= 4 && long.families.votes.length === 7 && long.families.votes.every(v => ['agree', 'oppose', 'neutral', 'unavailable'].includes(v.state)), 'seven evidence families, one vote each');
  ok(long.families.votes.find(v => v.name === 'macro').state === 'unavailable', 'macro family abstains when DXY unavailable (no double counting, no invention)');
  ok(long.gates.length === 12 && long.gatesPass <= 12, '12 core gates evaluated');
  ok(r.steps.s7.state !== 'EXPIRED', 'fresh reclaim is not EXPIRED');
  const txt = W.hgGoldSevenStepText(r);
  ok(/STEP 7  (TRIGGERED|WAIT)/.test(txt), 'STEP 7 answers TRIGGERED / WAIT first');

  /* tape rule: desk tape DOWN → LONG candidates are HELD and can never be best fit */
  const r2 = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau', equity: 50000, tape: 'DOWN' });
  const held = r2.steps.s3.candidates.find(c => c.dir === 'long' && /Asia low/.test(c.kind));
  ok(held && held.held === true && held.vetoes.some(v => /against gold tape DOWN/.test(v)), 'against-tape LONG stamped HELD');
  ok(!r2.steps.s4.best || r2.steps.s4.best.dir !== 'long', 'against-tape candidate is never the best fit');
  /* with tape UP the same long is not held */
  const r3 = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau', equity: 50000, tape: 'UP' });
  const free = r3.steps.s3.candidates.find(c => c.dir === 'long' && /Asia low/.test(c.kind));
  ok(free && free.held === false, 'with-tape LONG is not held');

  /* venue conversion + sizing when a best fit exists, else NO SETUP lists closest with next-close condition */
  if (r.steps.s5){
    ok(r.steps.s5.venue && Math.abs(r.steps.s5.venue.entry - r.steps.s5.entry * 1.0012) < 1e-6, 'levels converted to venue with the stated basis');
    ok(/GC|MGC|sub-lot/.test(r.steps.s5.size.pick) && Math.abs(r.steps.s5.size.riskUsd - 500) < 1e-9, '1% of $50,000 = $500 risk sized to contracts');
    ok(/21:30 IST|22:30 IST/.test(r.steps.s5.timeStop), 'time stop = London close in IST');
    ok(/two 1H closes below/.test(r.steps.s5.invalidation), 'invalidation = acceptance (two 1H closes beyond the pool)');
    ok(r.steps.s6.rows.length === 16 && r.steps.s6.rows.some(x => x.gate === 'G14') && r.steps.s6.rows.some(x => x.gate === 'G13' && x.result === 'unavailable'), 'STEP 6 table: 12 core + G14 + optional 13/15/16 with unavailable labelled');
    ok(['VALID', 'VALID-HALF', 'INVALID'].includes(r.steps.s6.result) && r.steps.s6.sanity.length === 6, 'STEP 6 result + sanity a–f');
  } else {
    ok(r.steps.s4.noSetup === true && r.steps.s4.closest.length >= 1, 'NO SETUP lists the closest candidates');
    ok(/on the \d\d:\d\d IST \(\d\d:\d\d UTC\) close/.test(r.steps.s4.closest[0].nextClose), 'closest candidate says what the next 1H close must do, in IST');
  }
  /* account size missing → asks, never guesses */
  const r4 = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau' });
  if (r4.steps.s5) ok(/account size missing/.test(r4.steps.s5.size.pick) && /per \$10,000/.test(r4.steps.s5.size.per10k), 'size asks for account size when missing');
  else ok(r4.steps.s4.noSetup === true && r4.steps.s4.closest.length >= 1 && !/GC×|MGC×|\boz\b/.test(JSON.stringify(r4.steps)), 'no best fit → NO SETUP path, no size invented');
  /* null-safe formatting: absent values print "unavailable", never 0.00 */
  const htmlNull = W.hgGoldSevenStepHtml(W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau', gvz: null, cotPct: null }));
  ok(!/GVZ 0\.0/.test(htmlNull) && /GVZ .*unavailable/.test(htmlNull), 'null GVZ / COT print unavailable, not 0.00');
}

console.log('== EXPIRED on acceptance + S37 second chance ==');
{
  const W = boot(false);
  const now = Date.UTC(2026, 8, 4, 10, 5);
  const rows = series(Date.UTC(2026, 8, 4, 0, 0), 420, { trend: 0.1, start: 4380 });
  const shift = 4495 - rows[rows.length - 1].c;
  for (const r of rows){ r.o += shift; r.h += shift; r.l += shift; r.c += shift; }
  const d0 = Math.floor(Date.UTC(2026, 8, 4, 0, 0) / 1000);
  for (let i = 0; i < 7; i++) rows.push({ t: d0 + i * H, o: 4495, h: 4500, l: 4490, c: 4496, v: 150 });
  rows.push({ t: d0 + 7 * H, o: 4494, h: 4496, l: 4485, c: 4488, v: 400 }); /* sweep, closes below Asia low */
  rows.push({ t: d0 + 8 * H, o: 4488, h: 4490, l: 4483, c: 4486, v: 380 }); /* second close below = acceptance */
  rows.push({ t: d0 + 9 * H, o: 4486, h: 4489, l: 4482, c: 4484, v: 300 });
  const r = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau' });
  ok(r.ok, 'runs');
  ok(r.steps.s1.eligible.some(e => e.id === 'S37'), 'S37 failed-sweep continuation becomes eligible after acceptance');
  const s37 = r.steps.s3.candidates.find(c => c.sid === 'S37');
  ok(s37 && s37.dir === 'short', 'S37 candidate is the continuation (SHORT through the accepted Asia low)');
  ok(/S37/.test(r.steps.s7.s37 || ''), 'STEP 7 states S37 second-chance eligibility');
}

console.log('== with the real gold engines loaded ==');
{
  const W = boot(true);
  const now = Date.UTC(2026, 8, 4, 9, 20);
  const rows = series(now, 500, { trend: 0.1 });
  const r = W.hgGoldSevenStep({ rows1h: rows, now, feed: 'synthetic-xau' });
  ok(r.ok, 'runs with goldind.js + gold-catalog.js present');
  ok(r.steps.s1.vp && isFinite(r.steps.s1.vp.poc), 'VP via goldVolumeProfile');
  const html = W.hgGoldSevenStepPanel({ rows1h: rows, now, feed: 'synthetic-xau' });
  ok(/GOLD 7-STEP SETUP ENGINE/.test(html), 'panel helper renders');
  ok(W.hgGoldSevenStepPanel(null) === '' || /DATA_UNAVAILABLE/.test(W.hgGoldSevenStepPanel(null)), 'panel helper never throws on null');
}

console.log('== vision repaint keeps the 7-STEP + FORMING LAYERS block ==');
{
  /* hgChartVisionRefreshGoldCards rebuilds the card container a few seconds
     after every GOLD SCALP / SWING scan. It used to drop FORMING LAYERS (and
     would have dropped this panel) because nobody handed it the block. */
  const ctx = { console, Math, Date, isFinite, isNaN, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.document = { createElement: () => ({ style: {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(ctx);
  vm.runInContext(read('chart-vision-desk.js'), ctx, { filename: 'chart-vision-desk.js' });
  ok(typeof ctx.hgChartVisionRefreshGoldCards === 'function', 'hgChartVisionRefreshGoldCards exported');
  const cards = { innerHTML: 'OLD' };
  ctx.hgChartVisionRefreshGoldCards({
    ui: { cards }, display: [{ id: 1 }], displayBest: { id: 1 },
    basisHtml: '<b>basis</b>', bannerHTML: () => '<i>banner</i>', cardHTML: () => '<div class="card">card</div>',
    formingLayersHTML: () => '<div data-hg-gold-seven="1">seven</div><div data-hg-gold-forming="1">forming</div>',
    formingNowHTML: () => '<div>forming-now</div>', rejectedHTML: () => '', historyHTML: () => ''
  });
  ok(/data-hg-gold-seven="1"/.test(cards.innerHTML) && /data-hg-gold-forming="1"/.test(cards.innerHTML), 'repaint carries the 7-STEP + FORMING LAYERS block');
  ok(cards.innerHTML.indexOf('class="card"') < cards.innerHTML.indexOf('data-hg-gold-seven') && cards.innerHTML.indexOf('data-hg-gold-seven') < cards.innerHTML.indexOf('forming-now'), 'block sits between the cards and FORMING NOW, same as the desk render');
  const cards2 = { innerHTML: 'OLD' };
  ctx.hgChartVisionRefreshGoldCards({ ui: { cards: cards2 }, display: [{ id: 1 }], cardHTML: () => 'c', formingLayersHTML: () => { throw new Error('boom'); } });
  ok(cards2.innerHTML === 'c', 'a throwing layers block does not blank the cards');
  const gs = read('goldscalp.js'), gw = read('goldswing.js');
  ok(/formingLayersHTML:\s*formingLayersHtml/.test(gs) && /formingLayersHTML:\s*formingLayersHtml/.test(gw), 'GOLD SCALP + GOLD SWING hand the block to the vision repaint');
  ok(/var seven = sevenStepHtml\(\);[\s\S]*?return seven \+ forming;/.test(gs) && /var seven = sevenStepHtml\(\);[\s\S]*?return seven \+ forming;/.test(gw), 'seven-step render is isolated from a forming-stack throw on both desks');
  ok(/basisHtml \+ uniHtml \+ sevenStepHtml\(\)/.test(gs) && /basisHtml \+ uniHtml \+ sevenStepHtml\(\)/.test(gw), 'feeds-failed / nothing-armed branch still prints the 7-step readout');
}

console.log('== desks wired + deploy stamp ==');
{
  const og = read('omnigold.js'), gs = read('goldscalp.js'), gw = read('goldswing.js'), idx = read('index.html'), sw = read('sw.js');
  ok(/hgGoldSevenStep/.test(og), 'OMNIGOLD calls the seven-step engine');
  ok(/hgGoldSevenStep/.test(gs), 'GOLD SCALP calls the seven-step engine');
  ok(/hgGoldSevenStep/.test(gw), 'GOLD SWING calls the seven-step engine');
  const vNum = HG_VER.replace(/^hg-v/, '');
  ok(new RegExp('gold-seven-step\\.js\\?v=' + vNum).test(idx), 'index.html loads gold-seven-step.js pinned to ' + HG_VER);
  ok(idx.indexOf('gold-seven-step.js') < idx.indexOf('goldscalp.js?v='), 'gold-seven-step.js loads before the gold desks');
  ok(/'\.\/gold-seven-step\.js'/.test(sw), 'sw.js HG_SHELL precaches gold-seven-step.js');
  ok(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\nall ok —', passed, 'assertions');
