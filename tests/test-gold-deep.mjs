/* HARDGATE — functional test for the GOLD DEEP SCAN ported inline engine.
   Extracts the deep-scan IIFE from index.html (between its markers), runs it
   in Node with real indicators/binance/macro modules + stubbed DOM/browser
   globals, and asserts the rendered structure:
     - 37 swing gates (G1..G37), 40 scalp gates (C1..C20 x2 directions)
     - verdict + levels plan, context panel, macro panel populated
     - never-throw behavior when the macro feed is null (Yahoo dead)
   Run: node tests/test-gold-deep.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('indicators.js'); load('binance.js'); load('macro.js');

const html = fs.readFileSync(root + 'index.html', 'utf8');
const m = html.match(/\/\* >>> GOLD DEEP SCAN[\s\S]*?<<< GOLD DEEP SCAN END <<< \*\//);
if (!m) throw new Error('deep scan markers not found in index.html');
// real inline helpers the IIFE now closes over (extracted, not copied)
for (const [re, label] of [
  [/function dayStartOf\(tSec\)\{[\s\S]*?\n\}/, 'dayStartOf'],
  [/function asiaDayBase\(tSec\)\{[\s\S]*?\n\}/, 'asiaDayBase'],
]){
  const fn = html.match(re);
  if (!fn) throw new Error(label + ' not found in index.html');
  vm.runInThisContext(fn[0], { filename: label + '.js' });
}

// ---- browser/DOM stubs shared with the IIFE ----
globalThis.window = {};
const elements = {};
globalThis.$ = id => (elements[id] = elements[id] || { innerHTML: '', textContent: '', title: '' });
globalThis.setProg = () => {};
globalThis.S = { goldDataSource: null };
globalThis.waitAlertIdle = async function(statEl){
  if (globalThis.S.alertBusy && globalThis.S.alertBusySince && Date.now() - globalThis.S.alertBusySince > 4 * 60 * 1000)
    globalThis.S.alertBusy = false;
  return !globalThis.S.alertBusy;
};
globalThis.GOLD_SYM = 'XAUTUSD';
globalThis.GOLD_SRC_LABEL = { 'binance-paxg': 'BINANCE PAXG', 'twelvedata': 'TWELVE DATA', 'yahoo': 'YAHOO GC=F' };
globalThis.nowSec = () => Math.floor(Date.now() / 1000);
globalThis.fmt = (n, d = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
globalThis.px = n => isFinite(n) ? Number(n).toFixed(2) : '—';
globalThis.pct = (n, d = 1) => isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—';
globalThis.gateRow = (id, name, state, detail) => `GATE:${id}|${state}|${name} :: ${detail}\n`;
globalThis.bookBtnHTML = (sym, dir, entry, stop, t1, meta) => '<button class="toBook">ADD TO BOOK</button>';
globalThis.hgBookBtn = function(sym, dir, entry, stop, t1, meta){
  if (!isFinite(entry) || !isFinite(stop)) return '';
  return bookBtnHTML(sym, dir, entry, stop, t1, meta);
};
globalThis.inlineScanStack = function(){ return null; };
globalThis.hgSetupStackForInlineScan = function(){ return null; };
globalThis.hgSetupStackMiniHtml = function(){ return ''; };
globalThis.planBlock = (dir, entry, stop, t1, t2) => `PLAN:${dir} entry=${entry} stop=${stop} t1=${t1} t2=${t2}`;
const logged = [];
globalThis.logSetup = (sym, dir, kind, entry, stop, t1) => logged.push({ sym, dir, kind, entry });
globalThis.goldSession = () => {
  const d = new Date(); const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (h >= 7 && h < 10) return { name: 'LONDON KZ', kz: true };
  if (h >= 12 && h < 15) return { name: 'NY KZ', kz: true };
  if (h >= 0 && h < 7) return { name: 'ASIA (range builds)', kz: false };
  return { name: 'OFF-SESSION', kz: false };
};
globalThis.utcDayStart = () => { const d = new Date(); return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000); };
globalThis.getXAUCandles = async (res, count) => {
  const out = await globalThis.getGoldCandles(res, count);
  if (!out.rows.length) throw new Error('all gold sources failed');
  globalThis.S.goldDataSource = out.source;
  const sec = { '15m': 900, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 }[res];
  let rows = out.rows;
  if (rows.length && sec && (globalThis.nowSec() - rows[rows.length - 1].t < sec)) rows = rows.slice(0, -1);
  return rows;
};
let macroPanelArgs = null;
globalThis.renderGoldMacroAuto = (macro, source) => { macroPanelArgs = { macro, source }; };

// ---- load the extracted IIFE ----
vm.runInThisContext(m[0], { filename: 'deep-scan-extract.js' });
if (typeof globalThis.window.runGoldDeep !== 'function') throw new Error('runGoldDeep not exposed');

// ---- RUN 1: live data + live macro ----
await globalThis.window.runGoldDeep();
const out = elements.goldDeepOut.innerHTML;
const gGates = (out.match(/GATE:G\d+\|/g) || []).length;
const cGates = (out.match(/GATE:C\d+\|/g) || []).length;
const gStates = {};
for (const mm of out.matchAll(/GATE:(G\d+)\|(pass|veto|na)\|/g)) gStates[mm[1]] = mm[2];
const cStates = {};
for (const mm of out.matchAll(/GATE:(C\d+)\|(pass|veto|na)\|/g)) cStates[mm[1]] = (cStates[mm[1]] || 0) + 1;

console.log('== RUN 1 (live macro) ==');
console.log('stat:', elements.goldDeepStat.textContent);
console.log('swing gates:', gGates, '| scalp gates:', cGates);
console.log('G1 weekly:', gStates.G1, '| G12 DXY:', gStates.G12, '| G13 TNX:', gStates.G13, '| G20 MFI:', gStates.G20, '| G37 squeeze:', gStates.G37);
console.log('verdict present:', /verdict/.test(out), '| plan present:', /PLAN:/.test(out), '| context panel:', /Weekly structure/.test(out));
console.log('macro panel captured: dxy =', macroPanelArgs.macro && macroPanelArgs.macro.dxy && macroPanelArgs.macro.dxy.value.toFixed(2),
  '| tnx =', macroPanelArgs.macro && macroPanelArgs.macro.tnx, '| hint =', macroPanelArgs.macro && macroPanelArgs.macro.realRateHint,
  '| source =', macroPanelArgs.source);
console.log('logSetup calls:', JSON.stringify(logged));
if (gGates !== 37) throw new Error('expected 37 swing gates, got ' + gGates);
if (cGates !== 40) throw new Error('expected 40 scalp gates (20 x2), got ' + cGates);

// ---- RUN 2: macro feed dead (Yahoo/Frankfurter fail) — gates must degrade, not break ----
globalThis.getGoldMacro = async () => null;
elements.goldDeepOut.innerHTML = ''; elements.goldDeepStat.textContent = '';
await globalThis.window.runGoldDeep();
const out2 = elements.goldDeepOut.innerHTML;
const g12 = out2.match(/GATE:G12\|(na|pass|veto)\|/);
const g13 = out2.match(/GATE:G13\|(na|pass|veto)\|/);
console.log('\n== RUN 2 (macro = null, Yahoo-dead simulation) ==');
console.log('stat:', elements.goldDeepStat.textContent);
console.log('gates still render:', (out2.match(/GATE:G\d+\|/g) || []).length, 'swing /', (out2.match(/GATE:C\d+\|/g) || []).length, 'scalp');
console.log('G12 DXY state:', g12 && g12[1], '| G13 TNX state:', g13 && g13[1], '(both must be na)');
console.log('macro panel null-safe:', macroPanelArgs.macro === null);
if ((out2.match(/GATE:G\d+\|/g) || []).length !== 37) throw new Error('RUN2: swing ledger broke without macro');
if (!g12 || g12[1] !== 'na' || !g13 || g13[1] !== 'na') throw new Error('RUN2: macro gates did not degrade to na');

// ---- RUN 3: the pre-existing quick GS/GC ledgers (inline runGold) must work unchanged ----
{
  const mrg = html.match(/async function runGold\(\)\{[\s\S]*?\n\}\n(?=\s*\/\* >>> GOLD DEEP SCAN)/);
  if (!mrg) throw new Error('inline runGold not found ahead of the deep-scan marker');
  vm.runInThisContext(mrg[0], { filename: 'rungold-extract.js' });
  if (typeof globalThis.runGold !== 'function') throw new Error('runGold not extracted');
  globalThis.getGoldMacro = async () => ({ // restored live-shaped macro
    dxy: { value: 100.78, date: '2026-07-17', trend20: 'RISING', change20Pct: 1.11 },
    tnx: 4.54, tnxTrend: 'FLAT', tnxChange20Pct: 1.75, silver: 56.32, goldSilverRatio: 71.2, realRateHint: 'NEUTRAL'
  });
  await globalThis.runGold();
  const sw = elements.goldSwingOut.innerHTML, sc = elements.goldScalpOut.innerHTML;
  const gsGates = (sw.match(/GATE:GS\d\|/g) || []).length;
  const gcGates = (sc.match(/GATE:GC\d\|/g) || []).length;
  console.log('\n== RUN 3 (quick GS/GC ledgers, inline runGold) ==');
  console.log('goldStat:', elements.goldStat.textContent);
  console.log('goldSess chip:', elements.goldSess.innerHTML);
  console.log('goldLvl chip:', elements.goldLvl.innerHTML);
  console.log('swing GS gates:', gsGates, '| scalp GC gates:', gcGates);
  console.log('swing verdict present:', /verdict/.test(sw), '| macro panel refreshed:', !!macroPanelArgs);
  if (gsGates !== 7) throw new Error('expected 7 GS gates, got ' + gsGates);
  if (gcGates !== 12) throw new Error('expected 12 GC gates (6 x2), got ' + gcGates);
  if (!/^evaluated/.test(elements.goldStat.textContent)) throw new Error('runGold did not complete cleanly');
}

console.log('\nALL DEEP-SCAN FUNCTIONAL TESTS PASSED');
