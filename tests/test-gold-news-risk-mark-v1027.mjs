/* HARDGATE — hg-v1027: the gold desks now write the USD-macro calendar read.

   The forward ledger has run a NEWS CALENDAR SPLIT since v992 — it classifies
   settled records by the calendar read at fire time (blackout / high / med /
   low). The crypto desks wrote that mark; the GOLD desks (SCALP / SWING) never
   did, so the PERFECT and MOST-PROBABLE gold cohorts could not be split by
   session/news quality.

   This closes that gap: both gold desks read hgNewsMark('XAUUSD') once per
   scan (the USD-macro calendar that drives gold), stamp it on each cand, and
   forward it on the record. The mark is SET AS A PROPERTY, not computed inside
   the lifted record map, so test-gold-forward-calendar.mjs keeps working.

   Run: node tests/test-gold-news-risk-mark-v1027.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const assert = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };

/* ---- the forward ledger keeps the four classes, three-state ---- */
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON,
                Date, parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  ctx.setTimeout = () => 0; ctx.clearTimeout = () => {};
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   createElement: () => ({ style: {}, appendChild(){} }), head: { appendChild(){} } };
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  const norm = ctx.hgFwdNormalize;
  assert(typeof norm === 'function', 'hgFwdNormalize exported');
  const base = { tab: 'GOLDSCALP', mechanic: 'X', sym: 'XAUUSD', tf: '15m', dir: 'long',
                 entry: 100, stop: 99, t1: 101.5, barT: Date.now()/1000 };
  assert(norm(Object.assign({}, base, { newsRisk: 'blackout' })).newsRisk === 'blackout', 'blackout is kept');
  assert(norm(Object.assign({}, base, { newsRisk: 'high' })).newsRisk === 'high', 'high is kept');
  assert(norm(Object.assign({}, base, { newsRisk: 'med' })).newsRisk === 'med', 'med is kept');
  assert(norm(Object.assign({}, base, { newsRisk: 'low' })).newsRisk === 'low', 'low is kept');
  assert(norm(base).newsRisk === undefined, 'absent → undefined (NOT RECORDED, never coerced low)');
  assert(norm(Object.assign({}, base, { newsRisk: 'bogus' })).newsRisk === undefined, 'an unknown class → undefined');
}

/* ---- both gold desks read the mark and forward it ---- */
{
  const sc = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8');
  assert(/hgNewsMark\(['"]XAUUSD['"]\)/.test(sc), 'GOLD SCALP reads hgNewsMark(XAUUSD) once per scan');
  assert(/newsRisk:\s*c\.newsRisk/.test(sc), 'and forwards it on the record (property access, lifted-map-safe)');
  assert(/hgNewsMark\(['"]XAUUSD['"]\)/.test(sw), 'GOLD SWING reads hgNewsMark(XAUUSD) once per scan');
  assert(/newsRisk:\s*c\.newsRisk/.test(sw), 'and forwards it on the record (property access, lifted-map-safe)');
  /* the mark is stamped on the cand before the map, not computed in it */
  assert(/newsRisk:\s*__nwRiskSc/.test(sc), 'GOLD SCALP stamps the mark on the cand (outside the record map)');
  assert(/newsRisk:\s*__nwRiskSw/.test(sw), 'GOLD SWING stamps the mark on the cand (outside the record map)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
