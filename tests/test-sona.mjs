/* HARDGATE — SONA / HG Gold 81 every bar.
   The desk is the Pine script: both prints, the body, the slope, the
   tick-rounded stop and 0.35R target, the forming-bar rule, the session
   filter. It writes no forward row.
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

function tick(x){ return Math.round(x / SPEC.mintick) * SPEC.mintick; }
function near(a, b){ return Math.abs(a - b) < 1e-6; }

function baseRows(n, signalMs){
  const t0 = signalMs - n * STEP;
  const rows = [];
  let p = 2300;
  for (let i = 0; i < n; i++){
    p += 0.45;
    const o = p - 0.2;
    const c = p;
    const h = c + 0.25;
    const l = o - 0.2;
    rows.push({ t: Math.floor((t0 + i * STEP) / 1000), o: o, h: h, l: l, c: c, v: 1000 });
  }
  return rows;
}

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
  const close = Math.max(emaF, vwap) + Math.max(atr, 1);
  const open = close - Math.max(SPEC.bodyMin * atr, 0.05) - 0.2;
  const low = Math.min(emaF, vwap) - 0.5;
  const high = close + 0.1;
  const ms = rows[i].t * 1000 + STEP;
  rows.push({ t: Math.floor(ms / 1000), o: open, h: high, l: low, c: close, v: 1 });
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
  const risk = tick(SPEC.atrMult * sig.atr);
  ok(near(sig.stop, tick(sig.entry - risk)), 'stop is the close minus 2.5×ATR, on the 0.01 tick');
  ok(near(sig.tp, tick(sig.entry + SPEC.rewardR * risk)), 'take profit is 0.35R from the close, on the 0.01 tick');
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

console.log('\n== the tab is wired into the gold group and writes no forward row ==');
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
}

console.log('\n' + passed + ' passed, 0 failed');
