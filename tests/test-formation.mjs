/* HARDGATE — unified formation pipeline (POI → stop → structure TP → fill gate).
   Run: node tests/test-formation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise, localStorage: { _m: {}, getItem(k){ return this._m[k] || null; }, setItem(k,v){ this._m[k]=v; } } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'scorecard.js', 'formation.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx;

function synthRows(n, start, step){
  step = step || 0.15;
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step + Math.sin(i / 12) * 0.05;
    out.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c: c, v: 1000 + i * 5 });
  }
  return out;
}

console.log('== formation.js exports ==');
{
  ok(typeof W.hgFormTicket === 'function', 'hgFormTicket');
  ok(typeof W.hgRankEntryPOI === 'function', 'hgRankEntryPOI');
  ok(typeof W.hgStructureTargets === 'function', 'hgStructureTargets');
  ok(typeof W.hgFillProbability === 'function', 'hgFillProbability');
  ok(typeof W.hgFormationParams === 'function', 'hgFormationParams');
  ok(typeof W.hgSaveFormationParams === 'function', 'hgSaveFormationParams');
}

console.log('== POI rank returns EMA fallback on trend tape ==');
{
  const rows = synthRows(80, 100);
  const mark = rows[rows.length - 1].c;
  const a4 = 1.2;
  const poi = W.hgRankEntryPOI(rows, 'long', 'swing', mark, a4, {});
  ok(poi && isFinite(poi.entry), 'POI candidate has entry');
  ok(/ema|sweep|ote|fvg/i.test(poi.poi + poi.label), 'POI type labeled');
}

console.log('== structure targets respect min R ==');
{
  const rows = synthRows(120, 100);
  const a4 = 1.5;
  const entry = rows[rows.length - 1].c;
  const stop = entry - 2;
  const tg = W.hgStructureTargets('long', entry, stop, rows, a4, { minRr: 2 });
  ok(tg && tg.rr1 >= 2, 'T1 at least 2R');
  ok(tg.t1Source, 'T1 source named');
}

console.log('== fill probability on synthetic limits ==');
{
  const rows = synthRows(100, 100, 0.05);
  const entry = rows[50].c;
  const fill = W.hgFillProbability(rows, entry, 'long', { lo: entry - 0.1, hi: entry + 0.1 }, 12);
  ok(fill.prob != null && fill.pct >= 0, 'fill rate computed: ' + fill.note);
}

console.log('== hgFormTicket shapes a swing hit ==');
{
  const rows = synthRows(120, 100);
  const mark = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: mark, stop: mark - 4, t1: mark + 8, rr: 2, mark: mark,
    margins: [], tightCount: 0, planSrc: 'swingTryClean', entryType: 'LIMIT @ EMA21' };
  const fm = W.hgFormTicket(hit, { rows, style: 'swing', a4: 1.2, skipPoi: true });
  ok(fm.ok === true, 'formation accepts valid hit (' + (fm.reason || 'ok') + ')');
  ok(fm.hit && isFinite(fm.hit.entry) && isFinite(fm.hit.stop) && isFinite(fm.hit.t1), 'levels present');
  ok(fm.hit.formationScore >= 0, 'formation score stamped');
}

console.log('== wiring in index.html ==');
{
  ok(/formation\.js/.test(html), 'formation.js script tag');
  ok(/hgFormTicket\(hit/.test(html), 'scan calls hgFormTicket');
  ok(/hgSaveFormationParams/.test(html), 'CALIBRATE saves formation params');
  ok(/formationScore/.test(html), 'rank uses formationScore');
  ok(/walkforward-ui\.js/.test(html), 'walkforward-ui.js script tag');
  ok(/hgAnchorIndex|hgAnchoredVWAP/.test(fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8')), 'formation exports aVWAP helpers');
}

console.log('== sw.js shell ==');
{
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/formation\.js/.test(sw), 'HG_SHELL includes formation.js');
  ok(/walkforward-ui\.js/.test(sw), 'HG_SHELL includes walkforward-ui.js');
  ok(/hg-v205/.test(sw), 'cache hg-v205');
}

console.log('\n' + passed + ' passed, 0 failed');
