/* test-chartvision-forward.mjs — hg-v1434 pins the CHARTVISION ledger seam.
   Before hg-v1434 the desk recorded NOTHING: crowns published via
   cvPublishState and died there (Wave B inventory + census). The seam:
   cvRecordForward at the cvRunScan publish (chartvision-tab.js), recording
   every 6/7+ crown through hgFwdRecordScan('CHARTVISION', '4h'|'15m', rows,
   {horizonBars: 20|24}) in the house row shape — swing on its 4h tape with a
   20-bar horizon, scalp on 15m with 24, demote-not-hide ticket flags
   (7/7 CLEAN and unfloored => ticket=true; NEAR or floored => ticket=false).

   The fixtures below are real closed windows (Binance spot) at which the
   Wave B census captured crowns through this exact code path:
     DOTUSDT 4h ending 2025-12-21T12:00Z (swing, 7/7 CLEAN short -> wait, long)
     LTCUSDT 1h/15m ending 2025-10-26T19:30Z (scalp, tight-stop -> floored)
   Arrays are [t, o, h, l, c, v] and get inflated to row objects at serve. */
import fs from 'node:fs';
import vm from 'node:vm';
import { swCacheOk } from './helpers/build-version.mjs';

let pass = 0, fail = 0;
const fails = [];
function ok(c, m){ if (c){ pass++; } else { fail++; fails.push(m); console.error('not ok —', m); } }

const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/chartvision-forward-fixture.json', import.meta.url), 'utf8'));
const toRows = a => a.map(b => ({ t: b[0], o: b[1], h: b[2], l: b[3], c: b[4], v: b[5] }));
const SWING4H = toRows(FIXTURE.swing4h), SCALP1H = toRows(FIXTURE.scalp1h), SCALP15M = toRows(FIXTURE.scalp15m);

const STACK = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'cryptogates.js', 'plans.js',
  'setup-stack.js', 'hg-plan.js', 'backtest-tab-params.js', 'structure-core.js',
  'crypto-singles-floor.js', 'chartvision-tab.js'];

function E(){
  const stubs = {};
  const mk = sel => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, _h: {}, value: '',
    addEventListener(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); },
    classList: { toggle(){}, add(){}, remove(){}, contains: () => false }, getAttribute: () => sel, setAttribute(){} });
  return { innerHTML: '', querySelector(sel){ return stubs[sel] || (stubs[sel] = mk(sel)); }, querySelectorAll: () => [], _stubs: stubs };
}
function boot(deskParams){
  const s = { console, Math, JSON, Date, Intl, isFinite, isNaN, NaN, Infinity, Array, Object, String, Number, Boolean, Promise, RegExp, Error, TypeError, Map, Set, parseFloat, parseInt, encodeURIComponent, decodeURIComponent, URL, URLSearchParams,
    setTimeout: (fn) => setTimeout(fn, 0), clearTimeout, setInterval: () => 0, clearInterval(){}, AbortController, queueMicrotask, TextEncoder, TextDecoder,
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} }, sessionStorage: null,
    fetch: async (u) => {
      if (String(u).includes('desk-tab-params')) return { ok: true, json: async () => JSON.parse(JSON.stringify(deskParams || {})), text: async () => '{}' };
      return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
    },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null }), head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} },
    navigator: {}, location: { href: 'x' }, alert(){}, WebSocket: function(){} };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  vm.createContext(s);
  for (const f of STACK) vm.runInContext(fs.readFileSync(f, 'utf8'), s, { filename: f });
  vm.runInContext(`
    window.__caps = [];
    hgFwdRecordScan = function(tab, tf, rows, opts){
      window.__caps.push({ tab: tab, tf: tf, horizon: (opts && opts.horizonBars) || 0, rows: JSON.parse(JSON.stringify(rows)) });
      return rows.length;
    };
    hgFwdResolve = function(){ return 0; };
    hgDeskLoadUniverse = async function(){
      return { items: [
        { sym: 'DOTUSDT', base: 'DOT', exchange: 'delta', turnoverUsd: 5e8, mark: window.__fx.swing4h[window.__fx.swing4h.length - 1].c, fundingPct: 0.01 },
        { sym: 'LTCUSDT', base: 'LTC', exchange: 'delta', turnoverUsd: 4e8, mark: window.__fx.scalp15m[window.__fx.scalp15m.length - 1].c, fundingPct: 0.01 }
      ], venueCounts: { delta: 2 } };
    };
    hgDeskFetchKlines = async function(item, tf, n){
      var sym = String((item && (item.sym || item.symbol)) || item);
      if (sym === 'DOTUSDT' && tf === '4h') return window.__fx.swing4h.slice(-n);
      return (tf === '1h' ? window.__fx.scalp1h : window.__fx.scalp15m).slice(-n);
    };
  `, s);
  s.__fx = { swing4h: SWING4H, scalp1h: SCALP1H, scalp15m: SCALP15M };
  return s;
}
async function runStyle(s, style){
  const tab = s.HG_tabs.find(t => t.id === 'chartvision');
  const el = E();
  tab.mount(el);
  if (style) el._stubs['#cvStyle'].value = style;
  const btn = el._stubs['#cvRun'];
  await btn._h.click[0]();
  await new Promise(r => setTimeout(r, 80));
  return el;
}
const deskParams = { tabs: { chartvision: { minGates: 6, minRR: 2 } } };

/* ---- 1. the swing seam records through hgFwdRecordScan in the house shape ---- */
{
  const s = boot(deskParams);
  await s.hgBacktestParamsLoad(true);
  await runStyle(s, 'swing');
  const caps = s.__caps.filter(c => c.tab === 'CHARTVISION');
  ok(caps.length === 1, 'swing scan records exactly one CHARTVISION forward batch (got ' + caps.length + ')');
  const cap = caps[0];
  ok(cap.tf === '4h', 'swing crowns settle on their own 4h tape (got ' + cap.tf + ')');
  ok(cap.horizon === 20, 'swing crowns carry the 20-bar horizon (got ' + cap.horizon + ')');
  ok(cap.rows.length >= 1, 'swing fixture mints at least one recorded crown (got ' + cap.rows.length + ')');
  const r = cap.rows.find(x => x.sym === 'DOTUSDT') || cap.rows[0];
  ok(r && typeof r.sym === 'string' && r.sym.length > 0, 'row carries sym');
  ok(r.dir === 'long' || r.dir === 'short', 'row carries dir (got ' + r.dir + ')');
  ok(isFinite(r.entry) && isFinite(r.stop) && isFinite(r.t1) && r.entry > 0 && r.stop > 0 && r.t1 > 0, 'row carries finite entry/stop/t1');
  ok(Math.abs(r.t1 - r.entry) > 0 && Math.abs(r.entry - r.stop) > 0, 'row geometry is non-degenerate');
  ok((r.dir === 'long') === (r.t1 > r.entry), 't1 sits on the dir side of entry');
  ok((r.dir === 'long') === (r.stop < r.entry), 'stop sits against the dir side of entry');
  ok(isFinite(r.mark) && r.mark > 0, 'row carries a mark for settlement');
  ok(Number.isInteger(r.barT) && r.barT > 1e9 && r.barT < 1e10, 'row carries barT in seconds (the settlement anchor, got ' + r.barT + ')');
  ok(r.barT === SWING4H[SWING4H.length - 1].t, 'barT anchors to the last closed 4h bar');
  ok(r.mechanic === 'CV-SWING', 'mechanic names the desk lane (got ' + r.mechanic + ')');
  ok(r.ticket === true, 'a 7/7 CLEAN unfloored crown records ticket=true');
  ok(r.reads && typeof r.reads === 'object', 'row carries the reads bag');
  const st = s.chartVisionState();
  ok(st && Array.isArray(st.results) && st.results.length === cap.rows.length, 'publish seam and ledger seam see the same population');
}

/* ---- 2. the scalp seam records on 15m with a 24-bar horizon, floored rows demoted ---- */
{
  const s = boot(deskParams);
  await s.hgBacktestParamsLoad(true);
  await runStyle(s, 'scalp');
  const caps = s.__caps.filter(c => c.tab === 'CHARTVISION');
  ok(caps.length === 1, 'scalp scan records exactly one CHARTVISION forward batch (got ' + caps.length + ')');
  const cap = caps[0];
  ok(cap.tf === '15m', 'scalp crowns settle on their own 15m tape (got ' + cap.tf + ')');
  ok(cap.horizon === 24, 'scalp crowns carry the 24-bar horizon (got ' + cap.horizon + ')');
  ok(cap.rows.length >= 1, 'scalp fixture mints at least one recorded crown (got ' + cap.rows.length + ')');
  const r = cap.rows[0];
  ok(r.mechanic === 'CV-SCALP', 'mechanic names the scalp lane (got ' + r.mechanic + ')');
  /* the fixture scalp plan has a 0.29% stop — under the 0.80% cost floor
     (cohort -0.648R/-1.271R both halves) so demote-not-hide must flag it */
  const tight = cap.rows.filter(x => Math.abs(x.entry - x.stop) / x.entry < 0.008);
  ok(tight.length >= 1, 'fixture exercises the cost-floor cohort');
  ok(tight.every(x => x.ticket === false), 'floored crowns record ticket=false — demote-not-hide, levels intact');
  ok(cap.rows.every(x => isFinite(x.entry) && isFinite(x.stop) && isFinite(x.t1)), 'every scalp row keeps finite levels');
}

/* ---- 3. lever off restores the pre-v1434 admission ---- */
{
  const s = boot(deskParams);
  s.HG_CSINGLES_FLOOR = false;
  await s.hgBacktestParamsLoad(true);
  const el = await runStyle(s, 'scalp');
  const caps = s.__caps.filter(c => c.tab === 'CHARTVISION');
  ok(caps.length === 1, 'lever-off scalp still records its batch');
  const tight = caps[0].rows.filter(x => Math.abs(x.entry - x.stop) / x.entry < 0.008);
  ok(tight.length >= 1 && tight.every(x => x.ticket === true), 'HG_CSINGLES_FLOOR=false restores pre-v1434 tickets (no demote)');
}

/* ---- 4. an empty tape records nothing (seam stays silent, not noisy) ---- */
{
  const s = boot(deskParams);
  vm.runInContext('hgDeskLoadUniverse = async function(){ return { items: [], venueCounts: {} }; };', s);
  await s.hgBacktestParamsLoad(true);
  await runStyle(s, 'swing');
  ok(s.__caps.filter(c => c.tab === 'CHARTVISION').length === 0, 'no crowns -> no ledger write');
}

/* ---- 5. wiring: the floor ships and loads before the desk; sw caches it ---- */
{
  const idx = fs.readFileSync('index.html', 'utf8');
  ok(idx.includes('crypto-singles-floor.js'), 'index.html loads crypto-singles-floor.js');
  ok(idx.indexOf('crypto-singles-floor.js') < idx.indexOf('chartvision-tab.js'), 'floor loads before chartvision-tab.js');
  const sw = fs.readFileSync('sw.js', 'utf8');
  ok(sw.includes('crypto-singles-floor.js'), 'sw.js precaches crypto-singles-floor.js');
  ok(sw.includes('chartvision-tab.js'), 'sw.js precaches chartvision-tab.js');
  ok(swCacheOk(sw), 'service-worker cache key tracks the build stamp');
  const src = fs.readFileSync('chartvision-tab.js', 'utf8');
  ok(/cvRecordForward\(results/.test(src), 'cvRunScan calls cvRecordForward at the publish');
  ok(src.indexOf('cvPublishState(results, { style') < src.indexOf('cvRecordForward(results, style);   /* hg-v1434'), 'the ledger write rides the publish, not a second path');
  ok(/hgFwdRecordScan\('CHARTVISION'/.test(src), 'the seam records under the CHARTVISION tab key');
}

console.log('test-chartvision-forward:', pass, 'passed,', fail, 'failed');
if (fail){ console.error('FAILURES:', fails); process.exit(1); }
