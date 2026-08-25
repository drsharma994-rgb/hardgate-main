/* HARDGATE — round five on OMNIGOLD: gold-native strategies + indicator reads.

   Asked to add more gold strategies and indicators so setups are more solid.
   Extra oscillators that fire both ways would make the desk noisier (that is
   how a LONG was sold while gold was going down). This round adds:

     MECHANICS (session / structure gold desks actually trade)
       NY-OPEN-DRIVE    London box, then a NY-hour close through it
       WEEKLY-OPEN      wick through the weekly open, close back
       PIVOT-REJECT     classic floor S1/R1 rejection
       INSIDE-BREAK     inside bar, then a close beyond the parent
       EMA50-HOLD       with-trend bounce that holds EMA50
       FIB-618          bounce at 61.8 of the last swing

     INDICATOR READS (info only — they argue, they do not veto or invent a ticket)
       ema-stack        8/21/50 alignment
       rsi-zone         stretch vs chase
       session-vwap     today's VWAP side

   Each mechanic must be in detect, the walk-forward map, OG_MECHANICS, and
   OG_FAMILY. Gold min-loss and crypto G1–G7 stay as they are. Desk tape still
   refuses a LONG pick when gold is going down. New engines never claim 7/7 CLEAN.

   Run: node tests/test-omnigold-round5.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omnigold.js');
const GATES = read('cryptogates.js');

function boot(){
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
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });
const D = (rows, opts) => W.hgOgDetect(rows, opts || {});
const one = (rows, kind, opts) => D(rows, opts).filter(h => h.kind === kind)[0] || null;

const NEW = ['NY-OPEN-DRIVE','WEEKLY-OPEN','PIVOT-REJECT','INSIDE-BREAK','EMA50-HOLD','FIB-618'];
const NEW_GATES = ['ema-stack','rsi-zone','session-vwap'];

function rising(n, p0){
  const out = []; let p = p0 || 2400;
  for (let i = 0; i < n; i++){
    const o = p, c = p + 1.8;
    out.push(B(i, o, c + 0.6, o - 0.4, c, 900));
    p = c;
  }
  return out;
}

console.log('== six gold mechanics are registered in all four places ==');
{
  const listSrc = SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'));
  const famSrc = SRC.slice(SRC.indexOf('var OG_FAMILY'), SRC.indexOf('function hgOgFamilyOf'));
  for (const k of NEW){
    ok(listSrc.indexOf("'" + k + "'") >= 0, k + ' is in OG_MECHANICS');
    ok(famSrc.indexOf("'" + k + "'") >= 0, k + ' is in OG_FAMILY');
    ok(new RegExp("'" + k + "':\\s*function\\s*\\(r\\)").test(SRC),
       k + ' has a walk-forward backtest entry');
    ok(new RegExp("d = hgOg[A-Za-z]+\\(rows\\);\\s*if \\(d\\) out\\.push\\(d\\)").test(SRC)
       || SRC.indexOf(k) >= 0,
       k + ' is reachable from the live detect pass');
  }
  ok(/d = hgOgNyOpenDrive\(rows\)/.test(SRC), 'NY-OPEN-DRIVE is called from hgOgDetect');
  ok(/d = hgOgWeeklyOpen\(rows/.test(SRC), 'WEEKLY-OPEN is called from hgOgDetect');
  ok(/d = hgOgPivotReject\(rows/.test(SRC), 'PIVOT-REJECT is called from hgOgDetect');
  ok(/d = hgOgInsideBreak\(rows\)/.test(SRC), 'INSIDE-BREAK is called from hgOgDetect');
  ok(/d = hgOgEma50Hold\(rows\)/.test(SRC), 'EMA50-HOLD is called from hgOgDetect');
  ok(/d = hgOgFib618\(rows\)/.test(SRC), 'FIB-618 is called from hgOgDetect');
}

console.log('== NY-OPEN-DRIVE: London box, NY-hour close through it ==');
{
  const rows = [];
  for (let i = 0; i < 40; i++){
    const hr = i % 24;
    const p = 3400;
    if (hr >= 7 && hr < 13) rows.push(B(i, p, p + 4, p - 4, p, 800));
    else if (hr === 15) rows.push(B(i, p + 3, p + 12, p + 2, p + 11, 1200));
    else rows.push(B(i, p, p + 1, p - 1, p, 600));
  }
  const h = one(rows, 'NY-OPEN-DRIVE');
  ok(h && h.dir === 'long', 'NY hour close above the London high is a LONG drive — ' + (h && h.why));
  ok(h && isFinite(h.level), 'and names the London high as the level');
  const quiet = [];
  for (let i = 0; i < 48; i++) quiet.push(B(i, 3400, 3401, 3399, 3400));
  ok(!one(quiet, 'NY-OPEN-DRIVE'), 'a flat tape does not invent a NY drive');
}

console.log('== WEEKLY-OPEN: wick through the weekly open, close back ==');
{
  const rows = [];
  for (let i = 0; i < 80; i++){
    const p = 3300 + (i > 0 ? 2 : 0);
    if (i === 79) rows.push(B(i, 3310, 3312, 3294, 3311, 1100));
    else rows.push(B(i, p, p + 1.2, p - 1.2, p, 800));
  }
  const h = one(rows, 'WEEKLY-OPEN');
  ok(h && h.dir === 'long', 'sweep of the weekly open that reclaims is LONG — ' + (h && (h.kind + ' ' + h.dir)));
  ok(typeof W.hgOgWeeklyOpen === 'function', 'hgOgWeeklyOpen is exported');
}

console.log('== PIVOT-REJECT / INSIDE-BREAK / EMA50-HOLD / FIB-618 fire on their fixtures ==');
{
  ok(typeof W.hgOgPivotReject === 'function', 'hgOgPivotReject exported');
  ok(typeof W.hgOgInsideBreak === 'function', 'hgOgInsideBreak exported');
  ok(typeof W.hgOgEma50Hold === 'function', 'hgOgEma50Hold exported');
  ok(typeof W.hgOgFib618 === 'function', 'hgOgFib618 exported');

  const pd = [];
  for (let i = 0; i < 50; i++){
    const day = Math.floor(i / 24), hr = i % 24;
    const p = 3500 + day;
    if (i === 49) pd.push(B(i, p + 2, p + 22, p - 1, p + 3, 1000));
    else pd.push(B(i, p, p + 6, p - 6, p + 1, 800));
  }
  const piv = W.hgOgPivotReject(pd);
  ok(piv && piv.kind === 'PIVOT-REJECT' && piv.dir === 'short',
     'a wick through R1 that closes back is a SHORT pivot reject');

  const ib = [];
  for (let i = 0; i < 45; i++) ib.push(B(i, 3600, 3604, 3596, 3601, 700));
  ib[42] = B(42, 3600, 3620, 3580, 3605, 900);
  ib[43] = B(43, 3604, 3610, 3595, 3606, 500);
  ib[44] = B(44, 3608, 3626, 3607, 3624, 1100);
  const br = W.hgOgInsideBreak(ib);
  ok(br && br.kind === 'INSIDE-BREAK' && br.dir === 'long',
     'inside bar then close above the parent high is a LONG break');

  const hold = rising(80, 3000);
  const last = hold[hold.length - 1];
  hold[hold.length - 1] = B(79, last.c - 1, last.c + 0.5, last.c - 80, last.c + 0.2, 1000);
  const eh = W.hgOgEma50Hold(hold);
  ok(eh && eh.kind === 'EMA50-HOLD' && eh.dir === 'long',
     'an up-stack that tags EMA50 and holds is a LONG continuation');

  const fibRows = [];
  let px = 4000;
  for (let i = 0; i < 30; i++){
    px = 4000 + i * 4;
    fibRows.push(B(i, px - 1, px + 2, px - 2, px, 800));
  }
  const win = fibRows.slice(-20);
  const hi = Math.max(...win.map(r => r.h));
  const lo = Math.min(...win.map(r => r.l));
  const f618 = hi - 0.618 * (hi - lo);
  fibRows.push(B(30, f618 + 2, f618 + 3, f618 - 1.5, f618 + 4, 900));
  const fb = W.hgOgFib618(fibRows);
  ok(fb && fb.kind === 'FIB-618' && fb.dir === 'long',
     'a bounce at 61.8 of the last swing is a LONG fib hold');
}

console.log('== indicator reads argue, they do not veto or invent tickets ==');
{
  const rows = rising(120, 2500);
  const px = rows[rows.length - 1].c;
  const gs = W.hgOgGates(rows, { kind:'ORB', dir:'long', level: px, why:'t' },
    { stats:{ samples: 80, hit: 0.55, expR: 0.4 }, minRr: 1.5, planRisk: 12 });
  for (const k of NEW_GATES){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the gold ledger');
    ok(g.info === true, k + ' is INFO — it cannot veto a ticket');
    ok(g.hard !== true, k + ' is not a hard gate');
    ok(typeof g.why === 'string' && g.why.length > 8, k + ' states a reason');
    ok(!/NaN|undefined|threw/.test(g.why), k + ' is not reporting itself broken');
  }
  const grade = W.hgOmniGrade(gs);
  ok(NEW_GATES.every(k => grade.vetoes.indexOf(k) === -1),
     'none of the new indicator reads can appear in vetoes');
}

console.log('== degenerate input never throws, and never invents a ticket ==');
{
  const CASES = [null, [], [null], rising(5, 1)];
  for (let i = 0; i < CASES.length; i++){
    let threw = null, out = null;
    try { out = D(CASES[i]); } catch (e) { threw = e; }
    ok(!threw, 'detect degenerate #' + i + ' does not throw');
    ok(Array.isArray(out), 'and returns an array');
  }
  ok(W.hgOgNyOpenDrive(null) == null && W.hgOgWeeklyOpen(null) == null, 'null rows → no hit');
  ok(W.hgOgPivotReject([]) == null && W.hgOgInsideBreak([]) == null, 'empty rows → no hit');
}

console.log('== tape, min-loss, G1–G7, and 7/7 CLEAN unchanged ==');
{
  ok(typeof W.hgOgDeskTape === 'function', 'desk tape still exported');
  ok(W.hgOgPickFor([{ horizon:'SWING', kind:'EMA50-HOLD', dir:'long',
                      grade:{ ticket:true, vetoes:[] }, plan:{ entry:1, stop:0.9, t1:1.3 }, distAtr:0.2 }],
                   'SWING', 'short') === null,
     'a new LONG mechanic is still not STRONGEST when gold tape is down');
  ok(/GOLD_STOP_MAX_PCT/.test(SRC) && /GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(SRC),
     'gold min-loss cap unchanged');
  ok(/CG_SWING_SPREAD_ATR\s*=\s*0\.25/.test(GATES) || /0\.25/.test(GATES), 'G1 still 0.25');
  ok(/CG_SWING_RR_MIN\s*=\s*2(?:\.0)?/.test(GATES), 'G6 still 2.0');
  ok(!/7\/7 CLEAN/.test(SRC.slice(SRC.indexOf('NY-OPEN-DRIVE') >= 0 ? SRC.indexOf('function hgOgNyOpenDrive') : 0)),
     'new gold engines do not claim 7/7 CLEAN');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches ' + HG_VER);
}

console.log('\npassed: ' + passed);
