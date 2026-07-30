/* HARDGATE — core-fix regression tests (Fix & Fuel build, AGENT CORE scope).
   Covers index.html only:
     1. proxy repoint: CDCX_PROXY is the same-origin /api/proxy?url= mapper,
        corsproxy.io gone, order direct → /api/proxy → public backups
     2. ntfy.sh push: sendAlertPush contract (silent skip without topic,
        correct POST with topic) + settings row + prefill wiring
     3. email failure visibility: window.__hgLastEmail on mocked emailjs
        success AND failure + 'ALERT EMAIL FAILED: ' line in the setup log
     4. mobile nav CSS: overflow-x:auto / nowrap / flex:none
     5. S.alertBusy guards on all 10 scan entry points
     6. Delta WS reconnect: exponential backoff variables, cap, jitter, reset
     7. checkOutcomes: isGold branch BEFORE the exchange guard (index order)
     8. macdGold: nanEmaLocal first-finite seed, no forced-zero warmup
     9. mini-charts engine: CDN tag order, hgChartAvailable, hgMiniChart
        null-safety (no lib / bad rows / missing el → remove + null, no throw),
        recorder-stubbed LightweightCharts mapping (series types, EMA overlays,
        ENTRY/STOP/T1/T2 price lines) + card wiring anchors
    10. GOLD SETUP composite: panel/button/runGoldSetup existence +
        goldSetupDecision pure logic (aside-on-misalignment matrix, entry/
        stop/target geometry, STRONG/MODERATE/WEAK confidence)
   Run: node tests/test-core-fixes.mjs */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- inline script extraction (pattern from extract-inline.mjs) ---------------- */
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = re.exec(html)) !== null){ if (m[1].trim()) blocks.push(m[1]); }
assert(blocks.length === 3, 'index.html still yields exactly 3 inline <script> blocks (got ' + blocks.length + ')');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-core-'));
let syntaxFail = 0;
blocks.forEach((body, i) => {
  const f = path.join(dir, 'block' + (i + 1) + '.js');
  fs.writeFileSync(f, body);
  try{ execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch(e){ syntaxFail++; }
});
fs.rmSync(dir, { recursive: true, force: true });
assert(syntaxFail === 0, 'all inline blocks pass node --check after the fixes');

/* grab one top-level function body: opens at col 0, first closing } at col 0 ends it */
function grabFn(name){
  const reFn = new RegExp('(?:async )?function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}');
  const mm = html.match(reFn);
  if (!mm) throw new Error('extraction failed: ' + name);
  return mm[0];
}

/* ================= 1. proxy repoint ================= */
assert(html.includes("const CDCX_PROXY = u => '/api/proxy?url=' + encodeURIComponent(u);"),
  'CDCX_PROXY is the same-origin /api/proxy?url= mapper');
assert(!html.includes('corsproxy.io'), 'corsproxy.io no longer appears anywhere (paywalled, 403)');
assert(!html.includes('hardgate-proxy.onrender.com'), 'dead Render proxy host fully removed (hardgate-main.onrender.com hosting is fine)');
assert(html.includes('allorigins.win') && html.includes('codetabs.com'),
  'allorigins + codetabs kept as last-resort public backups');
{
  const cg = grabFn('cdcxGet');
  const iDirect = cg.indexOf('await fetch(url)');
  const iApi = cg.indexOf('await fetch(CDCX_PROXY(url))');
  const iPublic = cg.indexOf('CDCX_PUBLIC_PROXIES');
  assert(iDirect !== -1 && iApi !== -1 && iPublic !== -1 && iDirect < iApi && iApi < iPublic,
    'cdcxGet fallback order: direct → /api/proxy → public backups');
}

/* ================= 2. ntfy.sh push ================= */
assert(html.includes("https://ntfy.sh/' + encodeURIComponent(topic)"),
  'sendAlertPush posts to https://ntfy.sh/<topic>');
assert(html.includes("localStorage.getItem('hg_ntfy_topic')") && html.includes("localStorage.setItem('hg_ntfy_topic', v)"),
  'hg_ntfy_topic persisted + read');
assert(html.includes('free push via ntfy.sh — pick an unguessable topic'),
  'settings row carries the unguessable-topic note');
assert(html.includes("id=\"ntfyTopic\"") && html.includes('saveNtfyTopic()'),
  'ntfy topic input + SAVE row present near the alert bell');
assert(html.includes("$('ntfyTopic').value = t"), 'ntfy topic prefilled on load (initAlerts)');
{
  const rac = grabFn('runAlertCycle');
  const iEmail = rac.indexOf('await sendAlertEmail(w, ex);');
  const iPush1 = rac.indexOf('await sendAlertPush(', iEmail);
  const iGoldEmail = rac.indexOf('await sendGoldAlertEmail(g);');
  const iPush2 = rac.indexOf('await sendAlertPush(', iGoldEmail);
  assert(iEmail !== -1 && iPush1 > iEmail, 'best-setup alert path: sendAlertPush fires alongside sendAlertEmail');
  assert(iGoldEmail !== -1 && iPush2 > iGoldEmail, 'gold STRONG alert path: sendAlertPush fires alongside sendGoldAlertEmail');
}

/* ================= 3. email failure visibility (functional, mocked emailjs) ================= */
{
  const code = [grabFn('emailErrStr'), grabFn('logAlertLine'), grabFn('sendAlertPush'), grabFn('sendAlertEmail'), grabFn('sendGoldAlertEmail')].join('\n');
  const savedLogs = [];
  const fetchCalls = [];
  const loggedSetups = [];
  let emailShouldFail = false;
  const storeMem = new Map();
  const sandbox = {
    console, Date, Math, JSON, String, Number, Boolean, isFinite, encodeURIComponent, Promise, Error,
    S: { exchange: 'delta' },
    px: n => 'PX(' + n + ')',
    fmt: (n, d) => 'FMT(' + n + ')',
    nowSec: () => Math.floor(Date.now() / 1000),
    loadLog: () => [],
    saveLog: l => { savedLogs.push(l); },
    renderLogBadge(){},
    logSetup(...a){ loggedSetups.push(a); },
    localStorage: {
      getItem: k => (storeMem.has(k) ? storeMem.get(k) : null),
      setItem: (k, v) => storeMem.set(k, String(v)),
      removeItem: k => storeMem.delete(k)
    },
    fetch: async (url, opts) => { fetchCalls.push({ url: url, opts: opts }); return { ok: true, status: 200 }; },
    emailjs: { send: async () => { if (emailShouldFail) throw new Error('smtp down'); return { status: 200, text: 'OK' }; } }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'alert-fns.js' });
  const run = c => vm.runInContext(c, sandbox);

  const w = { t: { symbol: 'BTCUSD' }, dir: 'long', entry: 100, stop: 90, t1: 120, risk: 10, famScore: 5, robScore: 2, rr: 2 };
  sandbox.__w = w;
  const g = { dir: 'long', entry: 2000, stop: 1990, t1: 2020, gates: [['GS1', 'x', 'pass'], ['GS2', 'y', 'veto']] };
  sandbox.__g = g;

  /* best-setup email — success */
  emailShouldFail = false;
  await run('sendAlertEmail(window.__w, "delta")');
  assert(sandbox.__hgLastEmail && sandbox.__hgLastEmail.ok === true && sandbox.__hgLastEmail.err === null && typeof sandbox.__hgLastEmail.ts === 'number',
    '__hgLastEmail = {ok:true, err:null, ts} on emailjs success (best-setup)');
  assert(loggedSetups.length === 1 && loggedSetups[0][2] === 'alert-delta', 'successful best-setup email still logs the setup');

  /* best-setup email — failure */
  emailShouldFail = true;
  await run('sendAlertEmail(window.__w, "delta")');
  assert(sandbox.__hgLastEmail && sandbox.__hgLastEmail.ok === false && /smtp down/.test(sandbox.__hgLastEmail.err) && typeof sandbox.__hgLastEmail.ts === 'number',
    '__hgLastEmail = {ok:false, err, ts} on emailjs failure (best-setup)');
  assert(savedLogs.some(l => l.some(e => e.status === 'note' && /^ALERT EMAIL FAILED: /.test(e.note || ''))),
    "setup LOG gains an 'ALERT EMAIL FAILED: ' line on best-setup email failure");

  /* gold STRONG email — success then failure */
  emailShouldFail = false;
  await run('sendGoldAlertEmail(window.__g)');
  assert(sandbox.__hgLastEmail && sandbox.__hgLastEmail.ok === true, '__hgLastEmail ok on emailjs success (gold)');
  emailShouldFail = true;
  await run('sendGoldAlertEmail(window.__g)');
  assert(sandbox.__hgLastEmail && sandbox.__hgLastEmail.ok === false && /smtp down/.test(sandbox.__hgLastEmail.err),
    '__hgLastEmail = {ok:false, err, ts} on emailjs failure (gold)');
  assert(savedLogs.filter(l => l.some(e => e.status === 'note' && /^ALERT EMAIL FAILED: /.test(e.note || ''))).length >= 2,
    'gold email failure also logs an ALERT EMAIL FAILED line');

  /* ntfy push — silent skip without topic */
  const before = fetchCalls.length;
  await run('sendAlertPush("T", "B")');
  assert(fetchCalls.length === before, 'sendAlertPush silently skips when no hg_ntfy_topic is set (no fetch)');

  /* ntfy push — full POST contract with topic */
  storeMem.set('hg_ntfy_topic', 'hg-secret-42');
  await run('sendAlertPush("My Title", "My Body")');
  const call = fetchCalls[fetchCalls.length - 1];
  assert(call && call.url === 'https://ntfy.sh/hg-secret-42', 'push posts to https://ntfy.sh/<topic>');
  assert(call && call.opts && call.opts.method === 'POST', 'push uses POST');
  assert(call && call.opts.headers['Title'] === 'My Title'
      && call.opts.headers['Priority'] === '4'
      && call.opts.headers['Tags'] === 'chart_with_upwards_trend'
      && call.opts.headers['Click'] === 'https://hardgate-main.onrender.com/',
    'push headers: Title / Priority 4 / Tags / Click');
  assert(call && call.opts.body === 'My Body', 'push sends the plain-text body');

  /* email failure never throws out of the senders, push failure neither */
  let threw = null;
  sandbox.fetch = async () => { throw new Error('net down'); };
  try { await run('sendAlertPush("T", "B")'); } catch(e){ threw = e; }
  assert(!threw, 'sendAlertPush swallows network errors (per-call failure tolerance)');
}

/* ================= 4. mobile nav CSS ================= */
assert(/nav\{[^}]*overflow-x\s*:\s*auto/.test(html), 'nav CSS: overflow-x:auto (row 2 = tab buttons)');
assert(/nav\{[^}]*flex-wrap\s*:\s*nowrap/.test(html), 'nav CSS: flex-wrap:nowrap');
assert(html.includes('-webkit-overflow-scrolling:touch'), 'nav CSS: -webkit-overflow-scrolling:touch');
assert(/nav button\{[^}]*flex\s*:\s*none/.test(html), 'nav buttons: flex:none');
assert(/header\{[^}]*flex-wrap\s*:\s*wrap/.test(html), 'header row: flex-wrap:wrap (belt-and-braces)');
assert((html.match(/@media/g) || []).length === 1, 'still exactly one @media query in the file');

/* ================= 4b. grouped two-tier nav ================= */
assert(html.includes('class="navgroups" id="navGroups"'), 'group row container (#navGroups.navgroups) present above the nav');
assert(/\.navgroups\{[^}]*overflow-x\s*:\s*auto/.test(html), 'group row CSS: overflow-x:auto (mobile-safe)');
assert(/\.navgroups button\.on\{[^}]*background\s*:\s*var\(--gold\)/.test(html), 'active group chip styled like the xtoggle chips (gold fill)');
assert(html.includes('const HG_NAV_GROUPS = ['), 'HG_NAV_GROUPS group model defined inline');
assert(html.includes("'strats','meanrev','best','carry'"), 'STRATEGIES group pre-maps strats/meanrev before those modules land');
assert(html.includes("const HG_TAB_GROUP = {}") && html.includes("HG_TAB_GROUP[t] = g.id"),
  'HG_TAB_GROUP id→group map built from the model');
assert(/function setHgGroup\(gid, openFirst\)/.test(html), 'setHgGroup(gid, openFirst) group switcher present');
assert(/localStorage\.setItem\(HG_GROUP_KEY, gid\)/.test(html), 'active group persisted to localStorage');
assert(/'hg_active_group'/.test(html), 'persistence key hg_active_group');
assert(html.includes('GATES, NOT SCORES · 23+ TOOLS'), 'brand small-text carries the tool count');

/* ================= 5. alertBusy auto-wait guard on all 10 scan entry points (v53) ================= */
const GUARDED = ['runGold', 'runSmcScan', 'runObScan', 'runCoilScan', 'runApexScan',
                 'runTrapScan', 'runBias', 'runDivScan', 'runExpansionCheck', 'runBasisScan'];
for (const name of GUARDED){
  const fnStart = html.indexOf('async function ' + name + '()');
  assert(fnStart !== -1 && html.slice(fnStart, fnStart + 320).indexOf('waitAlertIdle') !== -1,
    name + ' opens with the waitAlertIdle auto-wait guard (no more bounce-and-retry)');
}
assert((html.match(/alert cycle is running — try again in a few seconds/g) || []).length === 0,
  'the old bounce message is gone from every scan entry point');
assert((html.match(/await waitAlertIdle\(/g) || []).length >= 12,
  'waitAlertIdle auto-wait guard wired at 12+ scan entry points');
assert(/async function waitAlertIdle\(statEl\)/.test(html), 'waitAlertIdle helper defined');
assert(/Date\.now\(\) - t0 < 60000/.test(html), 'waitAlertIdle waits bounded (60s), never hangs a scan forever');

/* ================= 6. Delta WS reconnect backoff ================= */
assert(/let wsRetryMs = 1000;/.test(html), 'wsRetryMs backoff state declared (starts at 1s)');
assert(/onopen = function\(\)\{\s*wsRetryMs = 1000;/.test(html), 'backoff resets on successful open');
assert(/Math\.min\(wsRetryMs\*2, 30000\)/.test(html), 'backoff doubles, capped at 30s');
assert(/0\.8 \+ Math\.random\(\)\*0\.4/.test(html), '±20% jitter on the reconnect wait');
assert(!html.includes('setTimeout(initDeltaWS, 5000)'), 'fixed 5s reconnect removed');
assert(html.includes("name:'ticker', symbols: symbols") && html.includes("name:'funding_rate', symbols:['all']"),
  'resubscribe logic on open preserved');

/* ================= 7. checkOutcomes: gold branch before exchange guard ================= */
{
  const co = grabFn('checkOutcomes');
  const iGold = co.indexOf('const isGold');
  const iGuard = co.indexOf('e.ex!==S.exchange');
  assert(iGold !== -1 && iGuard !== -1 && iGold < iGuard,
    'isGold computed BEFORE the exchange guard (index ' + iGold + ' < ' + iGuard + ')');
  assert(/if \(!isGold && e\.ex!==S\.exchange\)\{ skipped\+\+; continue; \}/.test(co),
    'exchange guard exempts gold entries (graded exchange-agnostic via getXAUCandles)');
  assert(co.indexOf('getXAUCandles(res, want)') !== -1, 'gold grading still routes through getXAUCandles');
}

/* ================= 8. macdGold first-finite seed ================= */
{
  const mg = grabFn('macdGold');
  assert(mg.includes('nanEmaLocal(line,9)'), 'macdGold signal line seeded via nanEmaLocal (first-finite seed)');
  assert(!mg.includes('isNaN(v)?0:v'), 'forced-zero signal warmup removed from macdGold');
  const nl = grabFn('nanEmaLocal');
  assert(/e = \(e===null\) \? v : v\*k \+ e\*\(1-k\);/.test(nl),
    'nanEmaLocal ported inline: seeds from the first finite value (matches indicators.js macdHist)');
}

/* ================= 9. mini-charts engine (lightweight-charts v4) ================= */
assert(html.includes('https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'),
  'lightweight-charts 4.2.0 CDN script tag present');
assert(html.indexOf('@emailjs/browser@4') < html.indexOf('lightweight-charts@4.2.0'),
  'lightweight-charts tag loads AFTER EmailJS in <head>');
assert(/\.hgchart\{[^}]*height\s*:\s*190px/.test(html), '.hgchart CSS: 190px chart slot');
assert(html.includes('function hgMiniChart(el, rows, plan, opts){') && html.includes('function hgChartAvailable(){'),
  'hgMiniChart + hgChartAvailable defined inline');
assert(html.includes('window.hgMiniChart = hgMiniChart;') && html.includes('window.hgChartAvailable = hgChartAvailable;'),
  'both chart helpers explicitly exposed on window');
/* card wiring (charts below the plan box, mounted after insertion) */
assert(html.includes("'hgc-swing-'"), 'SWING scan cards carry a chart container id + mount');
assert(html.includes("hgMiniChart($('bestChart')"), 'BEST card mounts hgMiniChart on w.rows');
assert(html.includes("hgMiniChart($('goldSwingChart'), h4, gsPlan)"), 'GOLD quick ledger mounts hgMiniChart on h4 + the GS plan');
assert(html.includes("'hgchart-smart-'"), 'SMART $ setup cards carry a chart container id + mount');
assert(html.includes("hgMiniChart($('goldSetupChart')"), 'GOLD SETUP composite mounts hgMiniChart');
{
  const code = [grabFn('hgChartAvailable'), grabFn('hgMiniChart')].join('\n');
  const rec = { created: 0, charts: [] };
  const mkStub = () => ({
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
    createChart(el, opts){
      rec.created++;
      const chartRec = { el: el, opts: opts, candleOpts: null, candles: null, lines: [], priceLines: [], fitted: 0, applied: [], removed: 0 };
      rec.charts.push(chartRec);
      return {
        addCandlestickSeries(o){
          chartRec.candleOpts = o;
          return { setData(d){ chartRec.candles = d; }, createPriceLine(pl){ chartRec.priceLines.push(pl); } };
        },
        addLineSeries(o){
          const lineRec = { opts: o, data: null };
          chartRec.lines.push(lineRec);
          return { setData(d){ lineRec.data = d; } };
        },
        timeScale(){ return { fitContent(){ chartRec.fitted++; } }; },
        applyOptions(o){ chartRec.applied.push(o); },
        remove(){ chartRec.removed++; }
      };
    }
  });
  const mkEl = () => {
    const el = { clientWidth: 300, removedVia: null,
                 parentNode: { removeChild(c){ if (c === el) el.removedVia = 'parent'; } },
                 remove(){ el.removedVia = 'self'; } };
    return el;
  };
  const sandbox = { console, Math, JSON, Number, String, Boolean, Array, Object, isFinite, NaN };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'charts-engine.js' });
  const run = c => vm.runInContext(c, sandbox);

  /* availability flag */
  assert(run('hgChartAvailable()') === false, 'hgChartAvailable() false when the CDN lib is absent');
  sandbox.LightweightCharts = mkStub();
  assert(run('hgChartAvailable()') === true, 'hgChartAvailable() true when LightweightCharts.createChart exists');

  /* no-lib null-safety: element removed, null returned, no throw */
  sandbox.LightweightCharts = undefined;
  let el = mkEl();
  let threw = null, ret = 'unset';
  sandbox.__el = el;
  try{ ret = run('hgMiniChart(window.__el, [{t:1,o:1,h:1,l:1,c:1}], null)'); }catch(e){ threw = e; }
  assert(!threw, 'hgMiniChart never throws with the lib missing');
  assert(ret === null, 'hgMiniChart returns null when the lib is missing');
  assert(el.removedVia === 'parent', 'lib missing → chart container is removed from the DOM');

  /* bad rows null-safety */
  sandbox.LightweightCharts = mkStub();
  el = mkEl(); sandbox.__el = el;
  threw = null; ret = 'unset';
  try{ ret = run('hgMiniChart(window.__el, "not-an-array", null)'); }catch(e){ threw = e; }
  assert(!threw && ret === null && el.removedVia === 'parent', 'non-array rows → removed + null, no throw');
  el = mkEl(); sandbox.__el = el;
  threw = null; ret = 'unset';
  try{ ret = run('hgMiniChart(window.__el, [{t:1,o:1,h:1,l:1,c:1},{t:"x",o:1,h:1,l:1,c:1}], null)'); }catch(e){ threw = e; }
  assert(!threw && ret === null && el.removedVia === 'parent', 'too few clean bars (<10) → removed + null, no throw');

  /* missing element → plain null, no throw */
  threw = null; ret = 'unset';
  try{ ret = run('hgMiniChart(null, [], null)'); }catch(e){ threw = e; }
  assert(!threw && ret === null, 'missing el → null, no throw');

  /* happy path: recorder asserts the full mapping contract */
  const rows = [];
  for (let i = 0; i < 150; i++){
    const base = 100 + i * 0.5;
    rows.push({ t: 1700000000 + i * 14400, o: base, h: base + 2, l: base - 2, c: base + 1 });
  }
  sandbox.__rows = rows;
  el = mkEl(); sandbox.__el = el;
  rec.created = 0; rec.charts = [];
  ret = run('hgMiniChart(window.__el, window.__rows, {dir:"long", entry:150, stop:140, t1:170, t2:185})');
  assert(ret && ret.chart, 'happy path returns {chart, destroy()}');
  assert(rec.created === 1 && rec.charts[0].el === el, 'createChart called once with the container element');
  const cr = rec.charts[0];
  assert(cr.opts && cr.opts.layout && cr.opts.layout.textColor === '#6B7A90', 'chart theme: muted blue-gray text');
  assert(cr.candleOpts && cr.candleOpts.upColor === '#35C08E' && cr.candleOpts.downColor === '#E4586B'
      && cr.candleOpts.wickUpColor === '#35C08E' && cr.candleOpts.wickDownColor === '#E4586B',
    'candle series: --long/--short bodies AND wicks');
  assert(Array.isArray(cr.candles) && cr.candles.length === 120, 'plots the last ~120 bars');
  assert(cr.candles[0].time === rows[30].t && cr.candles[0].open === rows[30].o
      && cr.candles[0].high === rows[30].h && cr.candles[0].low === rows[30].l && cr.candles[0].close === rows[30].c,
    'row {t,o,h,l,c} → {time,open,high,low,close} mapping (t seconds = UTCTimestamp)');
  let sorted = true;
  for (let i = 1; i < cr.candles.length; i++){ if (cr.candles[i].time <= cr.candles[i-1].time){ sorted = false; break; } }
  assert(sorted, 'candle times strictly ascending');
  assert(cr.lines.length === 2 && cr.lines.every(l => Array.isArray(l.data) && l.data.length === 120),
    'EMA20 + EMA50 line overlays, one point per visible bar');
  assert(cr.lines[0].data.every(p => isFinite(p.value) && typeof p.time === 'number'), 'EMA points are {time, value}');
  assert(cr.priceLines.length === 4, 'plan → 4 price lines (ENTRY/STOP/T1/T2)');
  assert(cr.priceLines[0].price === 150 && cr.priceLines[0].color === '#D9A441' && cr.priceLines[0].lineStyle === 0 && cr.priceLines[0].title === 'ENTRY',
    'ENTRY line: gold solid with title');
  assert(cr.priceLines[1].price === 140 && cr.priceLines[1].color === '#E4586B' && cr.priceLines[1].lineStyle === 2 && cr.priceLines[1].title === 'STOP',
    'STOP line: red dashed with title');
  assert(cr.priceLines[2].price === 170 && cr.priceLines[3].price === 185
      && cr.priceLines[2].color === '#35C08E' && cr.priceLines[3].color === '#35C08E'
      && cr.priceLines[2].lineStyle === 1 && cr.priceLines[3].lineStyle === 1
      && cr.priceLines[2].title === 'T1' && cr.priceLines[3].title === 'T2',
    'T1/T2 lines: green dotted with titles');
  assert(cr.fitted === 1, 'timeScale().fitContent() called');
  ret.destroy();
  assert(cr.removed === 1, 'destroy() removes the chart');

  /* plan absent / partial → no price lines / only the finite ones */
  el = mkEl(); sandbox.__el = el;
  rec.charts = [];
  ret = run('hgMiniChart(window.__el, window.__rows, null)');
  assert(ret && rec.charts[0].priceLines.length === 0, 'no plan → candlesticks + EMAs only, zero price lines');
  el = mkEl(); sandbox.__el = el;
  rec.charts = [];
  ret = run('hgMiniChart(window.__el, window.__rows, {dir:"long", entry:150, stop:140, t1:170})');
  assert(ret && rec.charts[0].priceLines.length === 3, 'plan without t2 → 3 price lines');

  /* out-of-order + duplicate timestamps are repaired before setData */
  const messy = rows.slice(-30).reverse().concat([rows[rows.length - 1]]);
  sandbox.__messy = messy;
  el = mkEl(); sandbox.__el = el;
  rec.charts = [];
  ret = run('hgMiniChart(window.__el, window.__messy, null)');
  const mc = ret && rec.charts[0].candles;
  let mSorted = true, mDup = false;
  for (let i = 1; mc && i < mc.length; i++){ if (mc[i].time < mc[i-1].time) mSorted = false; if (mc[i].time === mc[i-1].time) mDup = true; }
  assert(ret && mSorted && !mDup && mc.length === 30, 'out-of-order/duplicate rows → sorted, deduped, chart still built');
}

/* ================= 10. GOLD SETUP composite (goldSetupDecision / runGoldSetup) ================= */
assert(html.includes('id="goldSetupRun"') && html.includes('BUILD GOLD SETUP') && html.includes('id="goldSetupOut"'),
  'GOLD SETUP panel: button + output container present');
assert(html.indexOf('id="goldSetupRun"') > html.indexOf('id="tab_gold"') && html.indexOf('id="goldSetupRun"') < html.indexOf('id="goldRun"'),
  'GOLD SETUP panel sits at the TOP of the GOLD tab pane (before EVALUATE GOLD)');
assert(html.includes('function goldSetupDecision(inp){'), 'goldSetupDecision pure function defined');
assert(html.includes('async function runGoldSetup(){') && html.includes('window.runGoldSetup = runGoldSetup;'),
  'runGoldSetup defined + exposed on window');
assert(html.includes('binanceFunding(\'XAUUSDT\')') && html.includes('binanceLongShort(\'XAUUSDT\''),
  'XAUUSDT funding/retail positioning legs feature-checked in runGoldSetup');
assert(html.includes('__hgGoldDeepVerdict'), 'deep-scan verdict state exposed for the composite');
assert(html.includes('NO SOLID SETUP — STAND ASIDE'), 'honest stand-aside card copy present');
{
  const code = grabFn('goldSetupDecision');
  const sandbox = { console, Math, JSON, Number, String, Boolean, Array, Object, isFinite, NaN };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'gold-setup-decision.js' });
  const D = inp => vm.runInContext('goldSetupDecision(' + JSON.stringify(inp) + ')', sandbox);
  const base = {
    casc: 'long', spreadOk: true, dSide: 'long', r4: 55,
    gsVeto: false, gsVetoGates: null,
    macroHint: 'TAILWIND', dxyTrend: 'FALLING', tnxTrend: 'FALLING',
    fundingPct: 0.01, retailLongPct: 52,
    session: 'NY KZ (kill zone)',
    price: 2400, a4: 12, e20: 2392, swingStop: 2380,
    weekRange: { hi: 2450, lo: 2380 }
  };

  /* fully aligned → actionable LONG, STRONG */
  let d = D(base);
  assert(d.aside === false && d.dir === 'long', 'aligned inputs → LONG, not aside');
  assert(d.confidence === 'STRONG', 'direction + macro hint + cascade all agree → STRONG');
  assert(d.entry === 2400 && /MARKET/.test(d.entryType), 'entry = last 4H close (market) when within 1 ATR of EMA20');
  assert(d.stop === 2377, 'stop = wider of structure (2380 − 0.25×ATR = 2377, 23 away) vs 1.5×ATR (18) → 2377');
  assert(d.t1 === 2446 && Math.abs(d.t2 - 2480.5) < 1e-9, 'T1 = 2R, T2 = 3.5R');
  assert(d.t3 === 2470, 'T3 = weekly-range projection (entry + 70 range)');
  assert(Math.abs(d.riskPct - 23/2400*100) < 1e-9 && d.rr1 === 2, 'risk % + R:R emitted');
  assert(Array.isArray(d.stamps) && d.stamps.length === 8, 'stamp row of the 8 decisive inputs (no deep scan yet)');
  assert(d.stamps.some(s => s.k === 'DXY 20D' && s.v === 'FALLING') && d.stamps.some(s => s.k === 'REAL RATES' && s.v === 'TAILWIND'),
    'stamps carry DXY trend + real-rate hint');

  /* aside-on-misalignment matrix */
  d = D({ ...base, casc: 'mixed' });
  assert(d.aside === true && d.dir === null && /mixed/.test(d.reason), 'mixed 4H cascade → ASIDE with reason');
  d = D({ ...base, dSide: 'short' });
  assert(d.aside === true && /disagree/.test(d.reason), '4H vs 1D disagreement → ASIDE with honest reason');
  d = D({ ...base, spreadOk: false });
  assert(d.aside === true && /thin/.test(d.reason), 'thin cascade spread → ASIDE (chop guard)');
  d = D({ ...base, r4: 72 });
  assert(d.aside === true && /exhausted/.test(d.reason), 'RSI exhaustion → ASIDE');
  d = D({ ...base, gsVeto: true, gsVetoGates: 'GS2' });
  assert(d.aside === true && /veto/.test(d.reason) && d.reason.includes('GS2'), 'quick-ledger veto → ASIDE naming the gate');
  d = D({ ...base, macroHint: 'HEADWIND', dxyTrend: 'RISING', tnxTrend: 'RISING' });
  assert(d.aside === true && /HEADWIND/.test(d.reason) && /disagree/.test(d.reason), 'macro against structure → ASIDE (gates disagree)');
  d = D(null);
  assert(d.aside === true && d.reason.length > 0, 'null input → ASIDE, no throw');

  /* pullback limit when price ran >1 ATR from 4H EMA20 */
  d = D({ ...base, e20: 2380, price: 2400 });
  assert(d.aside === false && d.entry === 2380 && /LIMIT @ 4H EMA20/.test(d.entryType),
    'entry switches to a labeled EMA20 pullback LIMIT beyond 1 ATR');
  assert(d.stop === 2362, 'pullback stop: 1.5×ATR wins when structure (3 away) is tighter');

  /* confidence degradation */
  d = D({ ...base, fundingPct: 0.06 });
  assert(d.aside === false && d.confidence === 'MODERATE' && /crowded/.test(d.reason),
    'macro agrees but funding crowded → MODERATE with the warning spelled out');
  d = D({ ...base, macroHint: 'NEUTRAL', dxyTrend: null, tnxTrend: null, retailLongPct: 70 });
  assert(d.aside === false && d.confidence === 'WEAK', 'macro neutral + retail crowded → WEAK');
  d = D({ ...base, macroHint: 'NEUTRAL', dxyTrend: null, tnxTrend: null });
  assert(d.aside === false && d.confidence === 'MODERATE', 'macro neutral, positioning clean → MODERATE');

  /* short mirror */
  d = D({ ...base, casc: 'short', dSide: 'short', macroHint: 'HEADWIND', dxyTrend: 'RISING', tnxTrend: 'RISING',
          swingStop: 2420, e20: 2408 });
  assert(d.aside === false && d.dir === 'short' && d.confidence === 'STRONG', 'aligned short → SHORT STRONG');
  assert(d.entry === 2400 && d.stop === 2423 && d.stop > d.entry, 'short stop above entry (structure side)');
  assert(d.t1 === 2354 && d.t1 < d.entry && d.t3 === 2330, 'short targets project downward');

  /* weekly range absent → T3 null, still a full plan */
  d = D({ ...base, weekRange: null });
  assert(d.aside === false && d.t3 === null && d.t1 === 2446, 'no weekly range → T3 omitted, plan intact');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL CORE-FIX TESTS PASSED');
process.exit(0);
