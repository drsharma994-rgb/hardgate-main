/* HARDGATE — scorecard export tests (Node 18+, builtins only).
   Covers the COPY STATS / EXPORT JSON feature:
     A) mount renders + wires both buttons
     B) empty-store export (honest empty state, parseable JSON)
     C) seeded ledger: text summary content + ordering, JSON stats/records
     D) COPY STATS handler: clipboard ok / clipboard blocked -> .txt download
        fallback / both blocked -> honest warn
     E) EXPORT JSON handler: download fired with a dated filename / blocked
     F) corrupt localStorage: export still returns safe strings
   No live network anywhere. Run: node tests/test-scorecard-export.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'scorecard.js'), 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
const sleep = ms => new Promise(function(res){ setTimeout(res, ms); });

/* ---------------- harness (mirrors test-scorecard.mjs) ---------------- */
function makeStorage(init){
  const mem = new Map(init ? Object.entries(init) : []);
  return {
    _mem: mem,
    getItem(k){ return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v){ mem.set(k, String(v)); },
    removeItem(k){ mem.delete(k); },
    clear(){ mem.clear(); }
  };
}
function makeCtx(extra){
  const base = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise
  };
  const ctx = vm.createContext(Object.assign(Object.create(null), base, extra || {}));
  vm.runInContext(SRC, ctx, { filename: 'scorecard.js' });
  return ctx;
}
function stubEl(){
  return {
    innerHTML: '', textContent: '', className: '', style: {}, disabled: false,
    addEventListener(ev, fn){ this['_' + ev] = fn; },
    querySelector(sel){
      if (!this._kids) this._kids = {};
      if (!this._kids[sel]) this._kids[sel] = stubEl();
      return this._kids[sel];
    }
  };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
  return { pane: pane, stubs: stubs };
}
/* DOM/Blob/URL stubs for the download path */
function docStub(track){
  return {
    body: { appendChild(x){ track.appended.push(x); }, removeChild(x){ track.removed.push(x); } },
    documentElement: { appendChild(x){ track.appended.push(x); } },
    createElement(tag){
      if (tag === 'a') return { href: '', download: '', style: {}, parentNode: null,
                                click(){ track.clicked = this; } };
      if (tag === 'textarea') return { value: '', style: {}, focus(){}, select(){} };
      return { style: {} };
    },
    execCommand(){ return false; }
  };
}
const urlStub = { createObjectURL(){ return 'blob:mock'; }, revokeObjectURL(){} };
class BlobMock{ constructor(parts, opts){ this.parts = parts; this.opts = opts; } }

/* ---------------- synthetic candles (seconds, like test-scorecard.mjs) ---------------- */
const T0 = 1700000000;
function bar(i, h, l, c){ return { t: T0 + i * 3600, o: c, h: h, l: l, c: c, v: 1 }; }
function bars(spec){ return spec.map(function(s, i){ return bar(i, s[0], s[1], s[2]); }); }
function neutralBars(n, c){
  const out = [];
  for (let i = 0; i < n; i++) out.push(bar(i, 105, 95, c === undefined ? 102 : c));
  return out;
}

/* ================================================================
   A) mount renders + wires COPY STATS / EXPORT JSON
================================================================ */
{
  const ctx = makeCtx();
  const w = ctx.window;
  const t = w.HG_tabs[0];
  const M = freshPane();
  t.mount(M.pane);
  assert(M.pane._html.indexOf('id="scoreCopy"') >= 0 && M.pane._html.indexOf('COPY STATS') >= 0,
    'A1 COPY STATS button rendered');
  assert(M.pane._html.indexOf('id="scoreExport"') >= 0 && M.pane._html.indexOf('EXPORT JSON') >= 0,
    'A2 EXPORT JSON button rendered');
  assert(M.pane._html.indexOf('id="scoreRun"') >= 0, 'A3 RE-SETTLE button still rendered');
  assert(typeof M.stubs['#scoreCopy']._click === 'function', 'A4 COPY STATS click handler wired');
  assert(typeof M.stubs['#scoreExport']._click === 'function', 'A5 EXPORT JSON click handler wired');
  assert(typeof w.hgScoreExport === 'function', 'A6 hgScoreExport() exposed on window');
}

/* ================================================================
   B) empty-store export
================================================================ */
{
  const ctx = makeCtx();
  const w = ctx.window;
  const ex = w.hgScoreExport();
  assert(typeof ex.text === 'string' && ex.text.indexOf('HARDGATE SCORECARD') === 0,
    'B1 text export starts with the HARDGATE SCORECARD header');
  assert(ex.text.indexOf('0 settled · 0 open') >= 0 && ex.text.indexOf('no records yet') >= 0,
    'B2 empty ledger says so honestly');
  const obj = JSON.parse(ex.json);
  assert(obj.app === 'hardgate-scorecard' && obj.version === 1
      && obj.stats.settled === 0 && Array.isArray(obj.records) && obj.records.length === 0,
    'B3 JSON export parses: app/version/empty stats/empty records');
}

/* ================================================================
   C) seeded ledger — text content, ordering, JSON stats
================================================================ */
{
  const ctx = makeCtx();
  const w = ctx.window;
  w.hgScoreRecord({ source: 'brain', sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
                    entry: 100, stop: 90, t1: 120, t2: 135,
                    layers: ['regime', 'engine', 'oiflow'], at: T0 * 1000 });
  w.hgScoreRecord({ source: 'brain', sym: 'ETHUSDT', dir: 'short', tier: 'HIGH',
                    entry: 100, stop: 110, t1: 80, t2: 65,
                    layers: ['engine', 'squeeze'], at: T0 * 1000 });
  w.hgScoreRecord({ source: 'brain', sym: 'SOLUSDT', dir: 'long', tier: 'PRIME',
                    entry: 100, stop: 90, t1: 120, t2: 135,
                    layers: ['regime', 'engine'], at: T0 * 1000 });
  const res = await w.hgScoreSettle(function(rec){
    if (rec.sym === 'BTCUSDT') return Promise.resolve(bars([[105, 95, 102], [140, 95, 138]])); /* bar1 tags t2 -> T2 +3.5R */
    if (rec.sym === 'ETHUSDT') return Promise.resolve(bars([[111, 95, 105]]));               /* tags stop -> SL -1R */
    return Promise.resolve(neutralBars(10, 102));                                            /* SOL stays OPEN, mtm +0.2R */
  });
  assert(res.settled === 2 && res.open === 1 && res.failed === 0,
    'C1 seeded ledger settles 2, leaves 1 open — got ' + JSON.stringify(res));

  const ex = w.hgScoreExport();
  const tx = ex.text;
  assert(tx.indexOf('ledger: 2 settled · 1 open') >= 0, 'C2 headline counts — got "' + tx.split('\n')[1] + '"');
  assert(tx.indexOf('win rate 50%') >= 0 && tx.indexOf('avg R +1.25R') >= 0,
    'C3 win rate 50% · avg R +1.25R (T2 +3.5R vs SL -1R)');
  assert(tx.indexOf('ANECDOTE — 2 settled, need >= 5') >= 0, 'C4 under MIN_DATA flagged as anecdote');
  assert(tx.indexOf('BY TIER') >= 0 && tx.indexOf('BY DIRECTION') >= 0
      && tx.indexOf('BY LANE') >= 0 && tx.indexOf('BY LAYER — which votes make money') >= 0,
    'C5 all four breakdown sections present');
  assert(tx.indexOf('PRIME  n=1  win 100%  avgR +3.50R') >= 0
      && tx.indexOf('HIGH  n=1  win 0%  avgR -1.00R') >= 0,
    'C6 by-tier rows exact');
  assert(tx.indexOf('ENGINE  n=2') >= 0, 'C7 by-layer counts both settled records with an engine vote');
  assert(tx.indexOf('SETTLED LEDGER — newest first') >= 0 && tx.indexOf('OPEN — unsettled') >= 0,
    'C8 settled + open ledger sections present');
  assert(tx.indexOf('· T2 +3.50R · layers: regime,engine,oiflow') >= 0,
    'C9 settled row carries outcome, R and the agreeing layers verbatim');
  assert(tx.indexOf('· SL -1.00R · layers: engine,squeeze') >= 0,
    'C10 the losing row is exported just as honestly');
  assert(tx.indexOf('SOLUSDT long PRIME') >= 0 && tx.indexOf('mtm +0.20R') >= 0,
    'C11 open row carries its mark-to-market R');
  const iB = tx.indexOf('BTCUSDT long PRIME'), iE = tx.indexOf('ETHUSDT short HIGH'),
        iS = tx.indexOf('SOLUSDT long PRIME'), iSet = tx.indexOf('SETTLED LEDGER'),
        iOpen = tx.indexOf('OPEN — unsettled');
  assert(iSet >= 0 && iB > iSet && iE > iB && iOpen > iE && iS > iOpen,
    'C12 ordering: settled newest-first (BTC closed later), open section last');

  const obj = JSON.parse(ex.json);
  assert(obj.stats.settled === 2 && obj.stats.open === 1 && obj.records.length === 3,
    'C13 JSON stats + full record set');
  assert(obj.stats.byTier.PRIME.n === 1 && obj.stats.byTier.HIGH.n === 1
      && obj.stats.byDir.long.n === 1 && obj.stats.byDir.short.n === 1
      && obj.stats.byLayer.ENGINE.n === 2,
    'C14 JSON breakdowns match the text export');
  const t2r = obj.records.find(function(r){ return r.outcome === 'T2'; });
  const slr = obj.records.find(function(r){ return r.outcome === 'SL'; });
  const opn = obj.records.find(function(r){ return r.status === 'open'; });
  assert(t2r && t2r.r === 3.5 && slr && slr.r === -1 && opn && opn.sym === 'SOLUSDT',
    'C15 record-level outcomes and R survive the export');
}

/* ================================================================
   D) COPY STATS handler
================================================================ */
{
  /* D1: clipboard works */
  let captured = null;
  const ctx1 = makeCtx({ navigator: { clipboard: {
    writeText(t){ captured = t; return Promise.resolve(); } } } });
  const M1 = freshPane();
  ctx1.window.HG_tabs[0].mount(M1.pane);
  M1.stubs['#scoreCopy']._click();
  await sleep(25);
  assert(M1.stubs['#scoreStat'].textContent.indexOf('stats copied') >= 0,
    'D1 clipboard success confirmed on the stat line — got "' + M1.stubs['#scoreStat'].textContent + '"');
  assert(captured && captured.indexOf('HARDGATE SCORECARD') === 0,
    'D1 the clipboard received the export text');

  /* D2: clipboard blocked -> .txt download fallback */
  const track2 = { appended: [], removed: [], clicked: null };
  const ctx2 = makeCtx({
    navigator: { clipboard: { writeText(){ return Promise.reject(new Error('denied')); } } },
    document: docStub(track2), URL: urlStub, Blob: BlobMock });
  const M2 = freshPane();
  ctx2.window.HG_tabs[0].mount(M2.pane);
  M2.stubs['#scoreCopy']._click();
  await sleep(25);
  assert(M2.stubs['#scoreStat'].textContent.indexOf('.txt instead') >= 0,
    'D2 blocked clipboard falls back to a .txt download, honestly named — got "' + M2.stubs['#scoreStat'].textContent + '"');
  assert(track2.clicked && /\.txt$/.test(track2.clicked.download),
    'D2 the fallback download fired with a .txt filename — got ' + (track2.clicked && track2.clicked.download));

  /* D3: no clipboard, no download route -> visible warn, never silent */
  const ctx3 = makeCtx();
  const M3 = freshPane();
  ctx3.window.HG_tabs[0].mount(M3.pane);
  M3.stubs['#scoreCopy']._click();
  await sleep(25);
  assert(M3.stubs['#scoreStat'].textContent.indexOf('both blocked') >= 0
      && M3.stubs['#scoreStat'].className === 'note warn',
    'D3 both routes blocked -> honest warn — got "' + M3.stubs['#scoreStat'].textContent + '"');
}

/* ================================================================
   E) EXPORT JSON handler
================================================================ */
{
  const track = { appended: [], removed: [], clicked: null };
  const ctx1 = makeCtx({ document: docStub(track), URL: urlStub, Blob: BlobMock });
  const M1 = freshPane();
  ctx1.window.HG_tabs[0].mount(M1.pane);
  M1.stubs['#scoreExport']._click();
  assert(track.clicked && /^hardgate-scorecard-\d{8}-\d{4}\.json$/.test(track.clicked.download),
    'E1 download fired with a dated .json filename — got ' + (track.clicked && track.clicked.download));
  assert(M1.stubs['#scoreStat'].textContent.indexOf('ledger downloaded:') >= 0,
    'E2 stat line confirms the download — got "' + M1.stubs['#scoreStat'].textContent + '"');

  const ctx2 = makeCtx();
  const M2 = freshPane();
  ctx2.window.HG_tabs[0].mount(M2.pane);
  M2.stubs['#scoreExport']._click();
  assert(M2.stubs['#scoreStat'].textContent.indexOf('download blocked') >= 0
      && M2.stubs['#scoreStat'].className === 'note warn',
    'E3 blocked download -> honest warn pointing at COPY STATS');
}

/* ================================================================
   F) corrupt localStorage — export still safe
================================================================ */
{
  const ctx = makeCtx({ localStorage: makeStorage({ hg_score_v1: '!!!not json' }) });
  const ex = ctx.window.hgScoreExport();
  assert(typeof ex.text === 'string' && ex.text.indexOf('HARDGATE SCORECARD') === 0,
    'F1 corrupt stored ledger never breaks the text export');
  const obj = JSON.parse(ex.json);
  assert(obj.records.length === 0 && obj.stats.settled === 0,
    'F2 corrupt stored ledger never breaks the JSON export');
}

console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' assertions passed');
process.exit(fail ? 1 : 0);
