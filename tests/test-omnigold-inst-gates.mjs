/* HARDGATE — OMNIGOLD native detectors share GOLD SCALP/SWING institutional
   filters (hgGoldInstFilter) without moving named ENTRY or tightening STOP.

   Execution TF is the desk tape (1h scalp / 4h swing). goldind absent
   fail-opens. 1.5×ATR14 is a FLOOR stamp, not a cap. GOLD_STOP_MAX_PCT stays
   0.025.

   Run: node tests/test-omnigold-inst-gates.mjs */
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
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                 'hg-forward.js','hg-gates.js','hg-plan.js'];
  if (withGoldind) files.push('goldind.js');
  files.push('omniroute.js', 'omnigold.js');
  for (const f of files){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bars(n, start, step, seed){
  const out = []; let p = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.002);
    const r = p * 0.0015 * (0.4 + rnd());
    out.push({ t: 1700000000 + i * step, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}

function emaRows(n, start, drift, step){
  const out = []; let p = start;
  for (let i = 0; i < n; i++){
    const o = p; p = p + drift;
    out.push({ t: 1700000000 + i * step, o: o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
  }
  return out;
}

const NY = Date.UTC(2024, 0, 16, 14, 0, 0);
const ASIA = Date.UTC(2024, 0, 16, 3, 0, 0);
const LON = Date.UTC(2024, 0, 16, 8, 5, 0);
const CFG_SCALP = { tf: '1h', sessionHard: true, minRr: 1.5, label: 'SCALP' };
const CFG_SWING = { tf: '4h', sessionHard: false, minRr: 2.0, label: 'SWING' };

function gate(W, rows, hit, extra){
  return (W.hgOgGates(rows, hit, extra || {}) || []).filter(g => g.key === 'inst-filter')[0];
}

console.log('== kind map + fail-open without goldind ==');
{
  const W = boot(false);
  ok(typeof W.hgOgKindToInstKey === 'function', 'hgOgKindToInstKey exported');
  ok(typeof W.hgOgInstFilterHit === 'function', 'hgOgInstFilterHit exported');
  ok(W.hgOgKindToInstKey('ASIA-BREAK') === 'asian', 'ASIA-BREAK → asian');
  ok(W.hgOgKindToInstKey('OB-RETEST') === 'ob', 'OB-RETEST → ob');
  ok(W.hgOgKindToInstKey('SWEEP-V2') === 'sweep', 'SWEEP-V2 → sweep');
  ok(W.hgOgKindToInstKey('PDL-SWEEP') === 'sweep', 'PDL-SWEEP → sweep');
  ok(W.hgOgKindToInstKey('KZ-JUDAS') === 'sweep', 'KZ-JUDAS → sweep');
  ok(W.hgOgKindToInstKey('ROUND-MAGNET') === 'vwap', 'ROUND-MAGNET stays generic (news/spread/macro/session still run)');
  ok(typeof W.hgGoldInstFilter !== 'function', 'bare harness does not load goldind');
  const rows = bars(80, 2400, 3600, 2);
  const hit = { kind: 'SWEEP-V2', dir: 'long', level: 2400, why: 't' };
  const g = gate(W, rows, hit, { sessionHard: true, nowMs: NY });
  ok(g && g.pass === true && g.hard === false, 'goldind absent → inst-filter fail-open PASS');
  const inst = W.hgOgInstFilterHit(hit, rows, { sessionHard: true, nowMs: NY });
  ok(inst.unchecked === true && inst.dropped === false, 'hgOgInstFilterHit reports unchecked when goldind is missing');
}

console.log('\n== sweep without MSS+IFVG is rejected; OB trap discarded ==');
{
  const W = boot(true);
  ok(typeof W.hgGoldInstFilter === 'function', 'goldind loaded');
  const rows = bars(80, 2400, 3600, 4);
  const sweep = gate(W, rows, { kind: 'SWEEP-V2', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY });
  ok(sweep && sweep.pass === false && /SWEEP BLOCK|MSS|IFVG/i.test(sweep.why),
     'native SWEEP-V2 without confirmation is vetoed (' + ((sweep && sweep.why) || '') + ')');

  const trapRows = bars(40, 2400, 3600, 2);
  trapRows[trapRows.length - 1].v = 50;
  for (let i = trapRows.length - 6; i < trapRows.length - 1; i++) trapRows[i].v = 3000;
  const ob = gate(W, trapRows, { kind: 'OB-RETEST', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY });
  ok(ob && ob.pass === false && /OB TRAP/i.test(ob.why),
     'thin-volume OB-RETEST is discarded (' + ((ob && ob.why) || '') + ')');
}

console.log('\n== session: Asia blocks standard scalp; ASIA-BREAK and swing demote stay ==');
{
  const W = boot(true);
  const rows = bars(80, 2400, 3600, 9);
  const blocked = gate(W, rows, { kind: 'ROUND-MAGNET', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: ASIA });
  ok(blocked && blocked.pass === false && /ASIA BLOCK/i.test(blocked.why),
     'standard scalp in Asia is blocked (' + ((blocked && blocked.why) || '') + ')');
  const asian = gate(W, rows, { kind: 'ASIA-BREAK', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: ASIA });
  ok(asian && asian.pass === true, 'ASIA-BREAK is allowed in its own window');
  const swing = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: false, nowMs: ASIA });
  ok(swing && swing.pass === true, 'Gold Wing / swing demotes Asia instead of killing the signal');
  const lon = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: LON });
  ok(lon && lon.pass === true && /session weight 3/i.test(lon.why),
     'London 08:00 GMT is priority-weighted (' + ((lon && lon.why) || '') + ')');
  const ny = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY });
  ok(ny && ny.pass === true && /session weight 3/i.test(ny.why),
     'NY overlap is priority-weighted');
}

console.log('\n== macro conviction lock, news-gate, spread, MTF ==');
{
  const W = boot(true);
  const rows = bars(40, 2400, 3600, 3);
  const up = emaRows(80, 100, 0.15, 86400);
  const down = emaRows(80, 100, -0.15, 86400);
  const locked = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, dxyRows: up, tnxRows: up });
  ok(locked && locked.pass === false && /CONVICTION LOCK/i.test(locked.why),
     'long + both DXY/TNX bullish kills the native ticket');
  const shortOk = gate(W, rows, { kind: 'ORB', dir: 'short', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, dxyRows: up, tnxRows: up });
  ok(shortOk && shortOk.pass === true, 'short is not killed by a strong dollar/yield tape');
  const mixed = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, dxyRows: up, tnxRows: down });
  ok(mixed && mixed.pass === true, 'one-sided DXY/TNX does not lock');

  const now = NY;
  const ev = (title, offsetMin) => ({
    loaded: true,
    events: [{ title: title, impact: 'high', t: Math.floor((now + offsetMin * 60000) / 1000) }]
  });
  const cpi = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: now, news: ev('US CPI', 20) });
  ok(cpi && cpi.pass === false && /NEWS GATE/i.test(cpi.why),
     'CPI −30/+15 locks new OMNIGOLD minting');
  const pce = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: now, news: ev('US Core PCE', 5) });
  ok(pce && pce.pass === true, 'Core PCE does not hard-lock via inst-filter');

  const spr = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, bid: 2400, ask: 2400.30 });
  ok(spr && spr.pass === false && /SPREAD LOCK/i.test(spr.why),
     'spread > $0.25 locks the native ticket');
  const tight = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, bid: 2400, ask: 2400.10 });
  ok(tight && tight.pass === true, 'tight spread is allowed');

  const bull = emaRows(80, 2000, 1.2, 14400);
  const bear = emaRows(80, 2800, -1.2, 14400);
  const mtfScalp = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: true, nowMs: NY, rows4h: bear, rows1d: bull });
  ok(mtfScalp && mtfScalp.pass === false && /MTF CONFLICT/i.test(mtfScalp.why),
     'HTF conflict locks scalp');
  const mtfSwing = gate(W, rows, { kind: 'ORB', dir: 'long', level: 2400, why: 't' },
    { sessionHard: false, nowMs: NY, rows4h: bear, rows1d: bull });
  ok(mtfSwing && mtfSwing.pass === true, 'Gold Wing stays open on HTF conflict');
}

console.log('\n== named ENTRY + stop floor stamp; never tighten vs hgOgPlanForHit ==');
{
  const W = boot(true);
  const rows = bars(160, 4530, 3600, 7);
  const lvl = Math.round(rows[rows.length - 1].c / 10) * 10;
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'round' };
  const extra = { livePx: lvl + 4, nowMs: NY, sessionHard: true };
  const pre = W.hgOgPlanForHit(hit, rows, extra, CFG_SCALP);
  ok(!!pre && Math.abs(pre.entry - lvl) < 1e-6, 'pre-filter plan ENTRY is hit.level');
  const stop0 = pre.stop;
  const cards = W.hgOgEvaluate(rows, [hit], extra, CFG_SCALP);
  ok(cards && cards.length === 1, 'evaluate still returns the hit (filter does not drop the card)');
  const c = cards[0];
  ok(c.plan && Math.abs(c.plan.entry - lvl) < 1e-6,
     'evaluated ENTRY stays the named round (got ' + (c.plan && c.plan.entry) + ')');
  ok(c.plan.stopFloorAtr === 1.5, 'plan stamps the 1.5×ATR floor (not a cap)');
  ok(!(c.plan.stop > stop0 + 1e-9),
     'LONG STOP is not tighter than hgOgPlanForHit (was ' + stop0 + ', now ' + c.plan.stop + ')');
  const riskPct = Math.abs(c.plan.entry - c.plan.stop) / c.plan.entry;
  ok(riskPct <= 0.025 + 1e-9, 'GOLD_STOP_MAX_PCT 2.5% clip still holds');
  const instG = (c.gates || []).filter(g => g.key === 'inst-filter')[0];
  ok(instG && instG.pass === true, 'ROUND-MAGNET at NY overlap clears inst-filter');

  const swingCards = W.hgOgEvaluate(rows, [hit], extra, CFG_SWING);
  ok(swingCards[0].plan && Math.abs(swingCards[0].plan.entry - lvl) < 1e-6,
     'swing native ENTRY also stays hit.level');
}

console.log('\n== source contracts ==');
{
  const src = read('omnigold.js');
  ok(/hgGoldInstFilter/.test(src), 'omnigold.js calls hgGoldInstFilter rather than forking the math');
  ok(/key:'inst-filter'/.test(src), 'one inst-filter ledger key (not eight new gates)');
  ok(!/surely win|guaranteed win|will surely/i.test(src), 'omnigold never promises a sure win');
  ok(/GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(src), 'gold min-loss stop cap unchanged');
  ok(!/hgApplyGoldBestLevels/.test(src.slice(src.indexOf('function hgOgInstFilterHit'),
      src.indexOf('function hgOgGates'))),
     'inst filter helper does not send native tickets through hgApplyGoldBestLevels');
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is hg-vN (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js matches build-stamp');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD INSTITUTIONAL GATE TESTS PASSED');
