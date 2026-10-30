/* HARDGATE — SONA / HG Gold 81 prints.
   Both prints still arm the bar. The stop is one tick beyond the wick,
   inside 1.5×ATR and 3.5×ATR and at least 4× the 0.02% round trip.
   The target is 1.5R. A live plan is held. It writes no forward row.
   Run: node tests/test-sona.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const ctx = {
  console: { log(){}, warn(){}, error(){} },
  Math, Date, Number, String, Object, Array, JSON, isFinite, isNaN, parseFloat, parseInt
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'sona.js'), 'utf8'), ctx, { filename: 'sona.js' });

const SPEC = ctx.HG_SONA_SPEC;
const STEP = 15 * 60 * 1000;

function cents(x){ return Math.round(x / SPEC.mintick); }
function divRound(n, d){ return Math.floor((n + Math.floor(d / 2)) / d); }

function baseRows(n, signalMs){
  const t0 = signalMs - n * STEP;
  const rows = [];
  let p = 2300;
  for (let i = 0; i < n; i++){
    p += 0.45;
    const o = p - 0.8;
    const c = p;
    const h = c + 1.2;
    const l = o - 2.2;
    rows.push({ t: Math.floor((t0 + i * STEP) / 1000), o: o, h: h, l: l, c: c, v: 1000 });
  }
  return rows;
}

function floorPx(x){ return Math.floor(x / SPEC.mintick + 1e-8) * SPEC.mintick; }
function ceilPx(x){ return Math.ceil(x / SPEC.mintick - 1e-8) * SPEC.mintick; }

/* The wick has to clear 1.5× the ATR this bar itself prints, and stay
   inside 3.5× that ATR. A fixed poke under the line is the spread when
   the line sits near the close. Solve the wick so the risk lands near
   2× the ATR the bar will print, then keep it past both lines. */
function craftLong(rows){
  const ser = ctx.hgSonaSeries(rows);
  const i = rows.length - 1;
  const emaF = ser.emaFast[i];
  const emaS = ser.emaSlow[i];
  const atr = ser.atr[i];
  const vwap = ser.vwap[i];
  ok(emaF > emaS, 'the uptrend stacks EMA 24 above EMA 120 (' + emaF.toFixed(2) + ' / ' + emaS.toFixed(2) + ')');
  ok(isFinite(atr) && atr > 0, 'ATR is ready');
  const look = ser.vwap[i - (SPEC.vwLook - 1)];
  ok(vwap > look, 'UTC VWAP is rising into the touch bar');
  const prevC = rows[i].c;
  const close = ctx.hgSonaTick(Math.max(emaF, vwap) + Math.max(0.5, 0.12 * atr));
  const k = 2 / SPEC.atrLen;
  const anchor = Math.max(prevC, close);
  let low = (close + SPEC.mintick - k * ((SPEC.atrLen - 1) * atr + anchor)) / (1 - k);
  low = floorPx(low);
  const tag = floorPx(Math.min(emaF, vwap) - SPEC.mintick);
  if (low > tag) low = tag;
  const body = ceilPx(Math.max(0.25 * atr, 1.2));
  let open = ctx.hgSonaTick(close - body);
  if (!(open > low)) open = floorPx(low + body);
  const high = ceilPx(close + 0.3);
  const ms = rows[i].t * 1000 + STEP;
  rows.push({
    t: Math.floor(ms / 1000),
    o: open,
    h: Math.max(high, open, close),
    l: Math.min(low, open, close),
    c: close,
    v: 1
  });
  return { ms: ms, emaF: emaF, atr: atr };
}

console.log('== a closed bar where both prints agree is a long setup ==');
{
  const signalMs = Date.UTC(2026, 0, 7, 3, 0, 0);
  const rows = baseRows(200, signalMs);
  const built = craftLong(rows);
  ok(built.ms === signalMs, 'the touch bar is the bar under test');
  const read = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const sig = read.signals.filter(s => s.ms === signalMs)[0];
  ok(!!sig && sig.dir === 1 && sig.side === 'LONG', 'both prints on a closed bar arm a LONG');
  ok(read.live && read.live.ms === signalMs, 'that setup is live — nothing after it has resolved it');
  const riskC = cents(sig.risk);
  const entryC = cents(sig.entry);
  const stopC = cents(sig.stop);
  const tpC = cents(sig.tp);
  const lowC = Math.floor(rows[rows.length - 1].l / SPEC.mintick + 1e-8);
  const beyond = lowC >= rows[rows.length - 1].l / SPEC.mintick - 1e-6 ? lowC - 1 : lowC;
  ok(stopC === beyond, 'stop is one tick beyond the pullback low');
  ok(entryC - stopC === riskC && riskC >= 1, 'risk is the ticked distance from entry to that stop');
  ok(riskC * SPEC.mintick + 1e-9 >= SPEC.stopAtrMin * sig.atr, 'risk clears the 1.0×ATR floor (the studied band)');
  ok(riskC * SPEC.mintick + 1e-9 >= SPEC.rtFrac * SPEC.rtMult * sig.entry, 'risk clears 4× the 0.02% round trip');
  ok(riskC * SPEC.mintick <= SPEC.stopAtrMax * sig.atr + 1e-9, 'risk is not wider than the 2.5×ATR ceiling (the studied band)');
  ok(tpC - entryC === divRound(riskC * 3, 2) && tpC > entryC, 'take profit is 1.5 of that risk, rounded to the 0.01 tick');
  ok(Math.abs(sig.realizedR - (tpC - entryC) / riskC) < 1e-12, 'booked R is the ratio of the three published prices');
  ok(Math.abs(sig.realizedR - 1.5) <= 0.5 / riskC + 1e-12, 'the tick round moves R by at most half a cent of risk');
  ok(sig.breakeven < 0.45, 'breakeven before cost is under 45%, not the old 74%');
  ok(Math.abs(sig.breakeven - riskC / (riskC + (tpC - entryC))) < 1e-12, 'breakeven is the barrier share of this risk');
  ok(Math.abs(sig.costR - (SPEC.rtFrac * sig.entry) / sig.risk) < 1e-9, 'the 0.02% round trip is priced as a fraction of this risk');
  ok(sig.hour === 3, '03:00 UTC is recorded and is not a filter');
  ok(sig.stop < sig.entry && sig.tp > sig.entry, 'long stop is below entry and take profit is above');
  const html = ctx.hgSonaHtml(read, { feed: 'binance-xau' });
  ok(html.indexOf('ENTRY') >= 0 && html.indexOf('STOP LOSS') >= 0 && html.indexOf('TAKE PROFIT') >= 0, 'the card names entry, stop loss and take profit');
  ok(html.indexOf(sig.entry.toFixed(2)) >= 0 && html.indexOf(sig.stop.toFixed(2)) >= 0 && html.indexOf(sig.tp.toFixed(2)) >= 0, 'and prints those three prices');
  ok(!/\bNaN\b|\bundefined\b|\[object Object\]/.test(html), 'the card does not print an unread value');

  const forming = ctx.hgSonaEval(rows, signalMs + 60 * 1000, { tf: '15m', sessOnly: false });
  ok(!forming.signals.some(s => s.ms === signalMs), 'the same bar, still forming, is not a setup');

  const shut = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: true });
  ok(!shut.signals.some(s => s.ms === signalMs), '03:00 UTC is outside 07:00–17:00, so the session filter stands aside');
  ok(shut.reason === 'outside session' || (shut.last && shut.last.ms !== signalMs), 'the 03:00 print is not the live setup');
}

console.log('\n== the same print inside 07:00–17:00 UTC is allowed when the filter is on ==');
{
  const signalMs = Date.UTC(2026, 0, 7, 12, 0, 0);
  const rows = baseRows(200, signalMs);
  craftLong(rows);
  const read = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: true });
  const sig = read.signals.filter(s => s.ms === signalMs)[0];
  ok(!!sig && sig.dir === 1, '12:00 UTC passes the session filter');
  ok(read.live && read.live.ms === signalMs, 'and it is the live setup');
}

console.log('\n== a bar that trades both stop and target is not called a winner ==');
{
  const signalMs = Date.UTC(2026, 0, 7, 12, 0, 0);
  const rows = baseRows(200, signalMs);
  craftLong(rows);
  const armed = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const sig = armed.signals.filter(s => s.ms === signalMs)[0];
  ok(!!sig, 'setup exists before the resolving bar');
  const next = signalMs + STEP;
  rows.push({
    t: Math.floor(next / 1000),
    o: sig.entry,
    h: sig.tp + 1,
    l: sig.stop - 1,
    c: sig.entry,
    v: 1000
  });
  const done = ctx.hgSonaEval(rows, next + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const was = done.signals.filter(s => s.ms === signalMs)[0];
  ok(was && was.state === 'both', 'stop and target in one bar stay unresolved — state is both');
  ok(!done.live || done.live.ms !== signalMs, 'that setup is not still live');
}

console.log('\n== the prices are the trade, and a slope is a real span of bars ==');
{
  ok(Math.round(ctx.hgSonaTick(1.005) * 100) === 101, '1.005 rounds to 1.01, not down through the binary 0.01 error');
  ok(Math.round(ctx.hgSonaTick(2400.004) * 100) === 240000, 'a sub-tick close publishes the nearest 0.01');
  ok(Math.round(ctx.hgSonaTick(2400.006) * 100) === 240001, '2400.006 rounds up to the next tick');

  const weighted = [
    { t: Math.floor(Date.UTC(2026, 0, 8, 12, 0, 0) / 1000), o: 100, h: 100, l: 100, c: 100, v: 1000 },
    { t: Math.floor(Date.UTC(2026, 0, 8, 12, 15, 0) / 1000), o: 110, h: 110, l: 110, c: 110, v: 1 }
  ];
  const wSer = ctx.hgSonaSeries(weighted);
  const wExpect = (100 * 1000 + 110 * 1) / 1001;
  ok(Math.abs(wSer.vwap[1] - wExpect) < 1e-9, 'two positive volumes stay volume-weighted');

  const mixed = [
    { t: weighted[0].t, o: 100, h: 100, l: 100, c: 100, v: 1000 },
    { t: weighted[1].t, o: 110, h: 110, l: 110, c: 110, v: 0 }
  ];
  const mSer = ctx.hgSonaSeries(mixed);
  ok(Math.abs(mSer.vwap[1] - 105) < 1e-9, 'a zero-volume bar does not keep a weight of 1 beside a real volume');

  const signalMs = Date.UTC(2026, 0, 7, 12, 0, 0);
  const gapped = baseRows(200, signalMs);
  craftLong(gapped);
  gapped[gapped.length - 1].t = Math.floor((signalMs + 4 * STEP) / 1000);
  const hole = ctx.hgSonaEval(gapped, signalMs + 4 * STEP + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  ok(!hole.signals.some(s => s.ms === signalMs + 4 * STEP), 'a missing bar is not a six-bar VWAP slope');
  ok(hole.reason === 'vwap gap' || hole.reason === 'ema gap' || !hole.live || hole.live.ms !== signalMs + 4 * STEP,
    'the gapped bar is not the live setup');

  const dirty = baseRows(200, signalMs);
  craftLong(dirty);
  dirty.splice(10, 0, { t: dirty[10].t - 1, o: 1, h: 1, l: 2, c: 1, v: 1 });
  const cleaned = ctx.hgSonaEval(dirty, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  ok(!!cleaned.signals.some(s => s.ms === signalMs), 'one impossible bar is dropped; the closed print still stands');

  const signal2 = Date.UTC(2026, 0, 7, 12, 15, 0);
  const repl = baseRows(200, signalMs);
  craftLong(repl);
  const armed = ctx.hgSonaEval(repl, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const first = armed.signals.filter(s => s.ms === signalMs)[0];
  ok(!!first, 'the first setup exists before the replacement bar');
  const emaNow = ctx.hgSonaSeries(repl);
  const i = repl.length - 1;
  const cap = first.tp - 0.02;
  const close2 = Math.min(Math.max(emaNow.emaFast[i], emaNow.vwap[i]) + 0.6, cap);
  const open2 = close2 - Math.max(SPEC.bodyMin * emaNow.atr[i] * 3, 1.5);
  repl.push({
    t: Math.floor(signal2 / 1000),
    o: open2,
    h: close2 + 0.2,
    l: Math.min(first.stop, emaNow.vwap[i]) - 0.15,
    c: close2,
    v: 1
  });
  const after = ctx.hgSonaEval(repl, signal2 + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const was = after.signals.filter(s => s.ms === signalMs)[0];
  const nxt = after.signals.filter(s => s.ms === signal2)[0];
  ok(!!nxt && nxt.dir === 1, 'the bar that trades the old stop is itself a long setup (' + after.reason + (after.diag && after.diag.block ? ', ' + after.diag.block : '') + ')');
  ok(was && was.state === 'stopped', 'that bar stops the open setup; it does not call it replaced');

  const html = ctx.hgSonaHtml(armed, { feed: '<script>' });
  const escaped = '&' + 'lt;script&' + 'gt;';
  ok(html.indexOf('<script>') < 0 && html.indexOf(escaped) >= 0, 'a feed name is escaped');
  ok(!/\bNaN\b|\bundefined\b|\[object Object\]/.test(html), 'the card still prints no unread value');
}

console.log('\n== a later agreement that does not trade the stop is not a second plan ==');
{
  const signalMs = Date.UTC(2026, 0, 7, 12, 0, 0);
  const rows = baseRows(200, signalMs);
  craftLong(rows);
  const armed = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const first = armed.signals.filter(s => s.ms === signalMs)[0];
  ok(!!first && first.state === 'live', 'one plan is live before the later bar');
  const ser = ctx.hgSonaSeries(rows);
  const i = rows.length - 1;
  const close2 = ctx.hgSonaTick(Math.max(ser.emaFast[i], ser.vwap[i]) + 0.8);
  const open2 = ctx.hgSonaTick(close2 - Math.max(1.5, SPEC.bodyMin * ser.atr[i] * 3));
  const low2 = floorPx(Math.min(ser.emaFast[i], ser.vwap[i]) - 0.05);
  ok(low2 > first.stop, 'this wick tags the lines and stays above the open stop');
  const next = signalMs + STEP;
  rows.push({ t: Math.floor(next / 1000), o: open2, h: close2 + 0.2, l: low2, c: close2, v: 1 });
  const held = ctx.hgSonaEval(rows, next + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  ok(held.signals.length === 1, 'the agreement does not arm a second setup');
  ok(held.live && held.live.ms === signalMs && held.live.state === 'live', 'the first plan is still the live one');
  ok(held.diag && held.diag.block === 'position open', 'the bar is named position open');
}

console.log('\n== a wick under the floor or wider than the ceiling is not a setup ==');
{
  function shallow(hour){
    const signalMs = Date.UTC(2026, 0, 7, hour, 0, 0);
    const rows = baseRows(200, signalMs);
    /* hg-v1476: flatten the last 24 bars so the day VWAP rides the price at
       ANY hour — the fixture pins the FLOOR, not the distance to a VWAP */
    /* hg-v1476: 54 flat bars then a 6-bar rise — the EMA(24) and the day
       VWAP both hug the price at ANY hour (so the prints can agree), while
       the VWAP still slopes up over the six-bar lookback */
    const pf = rows[rows.length - 1].c;
    for (let k = rows.length - 60; k < rows.length; k++){
      const from6 = rows.length - 7;
      const q = k <= from6 ? (pf - 0.10) : (pf - 0.10) + 0.10 * (k - from6) / 6;
      rows[k] = { t: rows[k].t, o: q, h: q + 0.3, l: q - 0.3, c: q, v: 1000 };
    }
    const ser = ctx.hgSonaSeries(rows);
    const i = rows.length - 1;
    /* hg-v1476: the flat tail puts every line at the price, and the crafted
       bar sits just above it with a 0.3-wide body and a wick hugging the
       lines — a sub-1.0xATR risk that still touches both prints at ANY hour */
    const p0 = rows[i].c;
    const close = ctx.hgSonaTick(p0 + 0.1);
    const open = ctx.hgSonaTick(close - 0.3);
    const low = floorPx(Math.min(open - 0.02, ser.emaFast[i] - 0.02, ser.vwap[i] - 0.02));
    rows.push({ t: Math.floor(signalMs / 1000), o: open, h: close + 0.3, l: low, c: close, v: 1 });
    return ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  }
  const under = shallow(3);
  ok(!under.signals.length && under.reason === 'stop under floor', 'a wick inside the 1.0xATR floor is the spread, not a stop (' + under.reason + ')');
  const underNoon = shallow(12);
  ok(!underNoon.signals.length && underNoon.reason === 'stop under floor', 'noon is the same floor (' + underNoon.reason + ')');

  const signalMs = Date.UTC(2026, 0, 7, 12, 0, 0);
  const wideRows = baseRows(200, signalMs);
  const ser = ctx.hgSonaSeries(wideRows);
  const i = wideRows.length - 1;
  const close = ctx.hgSonaTick(Math.max(ser.emaFast[i], ser.vwap[i]) + 0.6);
  const open = ctx.hgSonaTick(close - 1.5);
  const low = floorPx(close - 3.2 * ser.atr[i]);
  wideRows.push({ t: Math.floor(signalMs / 1000), o: open, h: close + 0.3, l: low, c: close, v: 1 });
  const wide = ctx.hgSonaEval(wideRows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  ok(!wide.signals.length && wide.reason === 'stop wide', 'a wick wider than the 2.5xATR ceiling is not the pullback (' + wide.reason + ')');
}

console.log('\n== the same prices on a short, and 5m is not a book ==');
{
  const signalMs = Date.UTC(2026, 0, 7, 3, 0, 0);
  const t0 = signalMs - 200 * STEP;
  const rows = [];
  let p = 2500;
  for (let n = 0; n < 200; n++){
    p -= 0.45;
    const c = p;
    const o = p + 0.8;
    const l = c - 1.2;
    const h = o + 2.2;
    rows.push({ t: Math.floor((t0 + n * STEP) / 1000), o: o, h: h, l: l, c: c, v: 1000 });
  }
  const ser = ctx.hgSonaSeries(rows);
  const i = rows.length - 1;
  ok(ser.emaFast[i] < ser.emaSlow[i], 'the downtrend stacks EMA 24 under EMA 120');
  ok(ser.vwap[i] < ser.vwap[i - (SPEC.vwLook - 1)], 'UTC VWAP is falling into the touch bar');
  const prevC = rows[i].c;
  const atr = ser.atr[i];
  const close = ctx.hgSonaTick(Math.min(ser.emaFast[i], ser.vwap[i]) - Math.max(0.5, 0.12 * atr));
  const k = 2 / SPEC.atrLen;
  const anchor = Math.min(prevC, close);
  let high = (close - SPEC.mintick + k * ((SPEC.atrLen - 1) * atr - anchor)) / (1 - k);
  high = ceilPx(high);
  const tag = ceilPx(Math.max(ser.emaFast[i], ser.vwap[i]) + SPEC.mintick);
  if (high < tag) high = tag;
  const body = ceilPx(Math.max(0.25 * atr, 1.2));
  let open = ctx.hgSonaTick(close + body);
  if (!(open < high)) open = ceilPx(high - body);
  const low = floorPx(close - 0.3);
  rows.push({
    t: Math.floor(signalMs / 1000),
    o: open,
    h: Math.max(high, open, close),
    l: Math.min(low, open, close),
    c: close,
    v: 1
  });
  const read = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '15m', sessOnly: false });
  const sig = read.signals.filter(s => s.ms === signalMs)[0];
  ok(!!sig && sig.dir === -1 && sig.side === 'SHORT', 'both prints on a closed bar arm a SHORT (' + read.reason + (read.diag && read.diag.block ? ', ' + read.diag.block : '') + ')');
  const riskC = cents(sig.risk);
  const entryC = cents(sig.entry);
  const stopC = cents(sig.stop);
  const tpC = cents(sig.tp);
  ok(stopC > entryC && tpC < entryC, 'short stop is above entry and take profit is below');
  ok(stopC - entryC === riskC, 'short risk is the ticked distance from entry to that stop');
  ok(riskC * SPEC.mintick + 1e-9 >= SPEC.stopAtrMin * sig.atr, 'short risk clears 1.5×ATR');
  ok(riskC * SPEC.mintick <= SPEC.stopAtrMax * sig.atr + 1e-9, 'short risk is not wider than 3.5×ATR');
  ok(entryC - tpC === divRound(riskC * 3, 2), 'short take profit is 1.5 of that risk');
  ok(sig.breakeven < 0.45, 'short breakeven before cost is under 45%');
  const as5 = ctx.hgSonaEval(rows, signalMs + 16 * 60 * 1000, { tf: '5m', sessOnly: false });
  ok(as5.tf === '15m' && !!as5.signals.filter(s => s.ms === signalMs)[0], '5m is not a book; the read stays 15m');
}
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, 'sona.js'), 'utf8');
  ok(html.indexOf('sona.js?v=') >= 0, 'index.html loads sona.js');
  ok(/\{ id:'gold',\s*label:'GOLD',\s*tabs:\[[^\]]*'sona'/.test(html), 'SONA is in the GOLD nav group');
  ok(sw.indexOf('./sona.js') >= 0, 'the shell precaches sona.js');
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'sona');
  ok(!!tab && tab.label === 'SONA', 'it registers as SONA');
  ok(typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'mount and refresh are both there');
  ok(!/hgFwdRecord|hgFwdRecordScan|recordForward/.test(src), 'it writes no forward row');
  ok(!/\bt1\b/.test(src), 'the card does not speak in the other desks\' target field');
  ok(!/value="5m"/.test(src) && /value="15m"/.test(src) && /value="4h"/.test(src), 'the book is 15m, 1h and 4h');
}

console.log('\n' + passed + ' passed, 0 failed');
