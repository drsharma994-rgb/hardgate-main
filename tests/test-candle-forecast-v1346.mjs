/* HARDGATE — hg-v1346 CANDLE FORECAST closed-bar guard.

   The live Binance kline feed includes the still-forming candle. At the first
   tick that candle can be flat (high === low), and the shared engine correctly
   returns null because no range can be measured. The tab must drop that one
   live bar and forecast from the newest closed bar instead of painting
   "failed closed". If the engine still refuses, it must say why.

   Run: node tests/test-candle-forecast-v1346.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAB = fs.readFileSync(path.join(ROOT, 'gold-candle-forecast.js'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
let pass = 0;
function ok(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
  console.log('  ok - ' + msg);
}

function bootTab() {
  const els = {
    cfStatus: { textContent: '' },
    cfResultArea: { innerHTML: '', className: '' }
  };
  const window = {
    HG_tabs: [],
    HG_BUILD: { version: 'hg-v1346' },
    atr: function () { return [1]; },
    ema: function () { return [1]; }
  };
  const ctx = {
    console,
    window,
    document: { getElementById: id => els[id] || null },
    Date,
    isFinite,
    Math,
    setTimeout,
    Promise
  };
  vm.createContext(ctx);
  vm.runInContext(TAB, ctx, { filename: 'gold-candle-forecast.js' });
  const mod = window.HG_tabs.find(t => t && t.id === 'candle-forecast');
  return { ctx, window, mod, els };
}

function tape(n, endOpenSec) {
  const start = endOpenSec - (n - 1) * 900;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const c = 4100 + i * 0.25;
    rows.push({ t: start + i * 900, o: c - 0.2, h: c + 2, l: c - 2, c, v: 10 });
  }
  return rows;
}

console.log('== 1) the still-forming candle is not the forecast bar ==');
{
  const { mod } = bootTab();
  const nowMs = Date.UTC(2026, 9, 14, 12, 0, 0);
  const rows = tape(35, Math.floor(nowMs / 1000));
  rows[rows.length - 1] = { t: Math.floor(nowMs / 1000), o: 4140, h: 4140, l: 4140, c: 4140, v: 0 };
  const p = mod.prepareRows(rows, '15m', nowMs);
  ok(p.rows.length === 34, 'the live 15m bar is dropped (35 -> ' + p.rows.length + ')');
  ok(/still-forming 15m bar excluded/.test(p.note), 'the card can disclose why one bar was excluded');
  ok(p.rows[p.rows.length - 1].t === Math.floor(nowMs / 1000) - 900,
    'the newest analysed bar is the previous closed candle');
}

console.log('\n== 2) a closed candle stays, and a flat latest closed candle is not repaired ==');
{
  const { mod } = bootTab();
  const nowMs = Date.UTC(2026, 9, 14, 12, 0, 0);
  const rows = tape(35, Math.floor(nowMs / 1000) - 900);
  const kept = mod.prepareRows(rows, '15m', nowMs);
  ok(kept.rows.length === 35, 'a closed non-flat last bar stays');
  const flat = rows.map(r => ({ ...r }));
  flat[flat.length - 1] = { ...flat[flat.length - 1], o: 4140, h: 4140, l: 4140, c: 4140 };
  const cleaned = mod.prepareRows(flat, '15m', nowMs);
  ok(cleaned.rows.length === 34, 'a zero-range latest bar is dropped, never repaired');
  ok(/zero-range latest bar excluded/.test(cleaned.note), 'the zero-range exclusion is named');
}

console.log('\n== 3) the tab scans the closed window, not the live bar ==');
{
  const { window, mod, els } = bootTab();
  const nowMs = Date.now();
  const rows = tape(32, Math.floor(nowMs / 1000));
  let seen = null;
  window.goldCandleForecast = function (r) {
    seen = r;
    const c = r[r.length - 1].c;
    return {
      dir: 'NEUTRAL', close: c, agrees: 0, against: 0, checked: 0,
      reasons: [], patterns: [], advancedPatterns: [], note: 'neutral test read',
      daySwings: { ok: true, setups: [], why: 'none' }
    };
  };
  mod.loadGold15m = async () => ({ rows, source: 'test-live-feed' });
  mod.loadGold = async () => ({ rows: [], source: '' });
  mod.loadTapes = async () => ({});
  mod.loadMacro = async () => null;
  await mod.runForecast();
  ok(Array.isArray(seen) && seen.length === 31, 'the engine received 31 closed bars from a 32-bar live pack');
  ok(seen[seen.length - 1].t < Math.floor(nowMs / 1000), 'the engine did not receive the still-forming bar');
  ok(/test-live-feed/.test(els.cfResultArea.innerHTML), 'the card still names its tape');

  console.log('\n== 4) an engine refusal now says why ==');
  const boot = bootTab();
  boot.window.goldCandleForecast = function () {
    boot.window.goldCandleForecastLastError = 'the latest bar has no measurable range';
    return null;
  };
  boot.mod.loadGold15m = async () => ({ rows: tape(35, Math.floor(Date.now() / 1000) - 900), source: 'test-feed' });
  boot.mod.loadTapes = async () => ({});
  boot.mod.loadMacro = async () => null;
  await boot.mod.runForecast();
  ok(/failed closed/.test(boot.els.cfResultArea.innerHTML), 'the unread state is still honest');
  ok(/latest bar has no measurable range/.test(boot.els.cfResultArea.innerHTML), 'the engine reason is printed');
  ok(boot.els.cfStatus.textContent === 'Unread', 'status remains Unread');
}

console.log('\n== 5) the source pins the fix ==');
{
  ok(/prepareRows[\s\S]*still-forming/.test(TAB), 'gold-candle-forecast.js owns the closed-bar preparation');
  ok(!/var __cfPane = null;[\s\S]{0,120}var __cfPane = null;/.test(TAB), 'the duplicate pane guard declaration is gone');
  ok(/goldCandleForecastLastError/.test(ENGINE), 'the shared engine records the refusal reason');
  ok(/latest bar has no measurable range/.test(ENGINE), 'the flat-bar refusal has a named reason');
}

console.log('\ntest-candle-forecast-v1346: ' + pass + ' passed, 0 failed');
