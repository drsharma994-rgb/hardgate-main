/* HARDGATE — the second round of OMNIGOLD mechanics, and the correction that
   makes adding them honest.

   Ten more kinds and five more indicator reads. The mechanics are the easy
   part; the hard part is that the desk now scans 27 of them, and the
   measured-edge gate judged each one against a lone 5% threshold.

   That is the wrong question. Search 27 ways and the best of them clears
   +1.6σ by chance most of the time. The live card that started all of this
   read

     PASS measured-edge 41 samples · 51% T1-first · +0.54R [+1.47σ]

   which, against 27 mechanics, is indistinguishable from noise — and the gate
   printed PASS. The Sidak bar for 27 tries is +2.89σ. Below it the gate now
   reads UNCHECKED and says so, because the ledger's own rule is that what has
   not been established does not read as established.

   The correction is deliberately keyed to OG_MECHANICS.length, the single
   list the pooled table also renders from, so it cannot drift out of step
   with the number of mechanics actually being tried.

   Run: node tests/test-omnigold-round2.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const NEW = ['PWH-SWEEP', 'PWL-SWEEP', 'FVG-FILL', 'BOS-RETEST', 'EQH-SWEEP', 'EQL-SWEEP',
             'SQUEEZE-FIRE', 'RSI-DIVERGE', 'GSR-EXTREME', 'AVWAP-RECLAIM'];
const NEW_GATES = ['adx-trend', 'squeeze-state', 'keltner-pos', 'atr-percentile', 'structure-shift'];

const T0 = 1700000000 - (1700000000 % 86400);
const W = boot();
const D = (rows, opts) => W.hgOgDetect(rows, opts || {});

/* A pseudo-random gold tape. Seeded, so a firing that appears here is
   reproducible rather than a lucky draw. */
function tape(n, seed, px){
  const out = []; let p = px || 3350, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const hr = i % 24, burst = (hr === 15 || hr === 8) ? 3 : 1;
    p = p * (1 + (rnd() - 0.5) * 0.004 * burst);
    const r = p * 0.0014 * burst * (0.4 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 900 });
  }
  return out;
}

console.log('== all ten are registered in all three places ==');
{
  for (const k of NEW){
    ok(new RegExp("'" + k + "':\\s*function\\s*\\(r\\)").test(SRC),
       k + ' has a backtest entry, so it accumulates an in-sample record');
    ok(new RegExp("'" + k + "'").test(SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'))),
       k + ' is in OG_MECHANICS, so it shows on the card and counts toward the correction');
  }
}

console.log('\n== every new mechanic actually fires, and none throws ==');
{
  const found = {};
  let threw = 0;
  for (let seed = 1; seed <= 400; seed++){
    const rows = tape(300, seed);
    W.__hgXagCandles = tape(300, seed * 7 + 3, 41).map(r => ({ ...r }));
    let hits = [];
    try { hits = D(rows, { nowSec: rows[rows.length - 1].t }); } catch (e) { threw++; }
    hits.forEach(h => { found[h.kind] = (found[h.kind] || 0) + 1; });
  }
  ok(threw === 0, 'the detect pass never threw across 400 tapes');
  for (const k of NEW) ok((found[k] || 0) > 0, k + ' fired (' + (found[k] || 0) + ' times in 400 tapes)');
  delete W.__hgXagCandles;
}

console.log('\n== each new mechanic returns a well-formed hit or nothing at all ==');
{
  const CASES = [
    [], [null],
    tape(5, 1),
    tape(300, 2).map(r => ({ ...r, h: null, l: null })),   /* the isFinite(null) trap, in the data */
    tape(300, 3).map(r => ({ ...r, v: 0 })),
    tape(300, 4).map(r => ({ ...r, t: null })),
    tape(300, 5).map(r => ({ ...r, c: undefined })),
    tape(300, 6).map(r => ({ ...r, h: r.l, l: r.h }))
  ];
  for (let i = 0; i < CASES.length; i++){
    let threw = null, out = null;
    try { out = D(CASES[i]); } catch (e) { threw = e; }
    ok(!threw, 'degenerate case #' + i + ' does not throw' + (threw ? ' — ' + threw.message : ''));
    ok(Array.isArray(out), 'and returns an array (#' + i + ')');
    for (const h of out){
      ok(h.dir === 'long' || h.dir === 'short', '#' + i + ' ' + h.kind + ' has a direction');
      ok(isFinite(h.level), '#' + i + ' ' + h.kind + ' has a finite level');
      ok(!/NaN|undefined|null/.test(h.why), '#' + i + ' ' + h.kind + ' has a clean reason: ' + h.why);
    }
  }
}

console.log('\n== the mechanics that can be pinned down, are ==');
{
  /* FVG-FILL: a three-bar imbalance the price comes back into. */
  const fvg = [];
  for (let i = 0; i < 40; i++) fvg.push({ t: T0 + i * 3600, o: 3350, h: 3352, l: 3348, c: 3350, v: 100 });
  fvg.push({ t: T0 + 40 * 3600, o: 3352, h: 3380, l: 3351, c: 3378, v: 900 });   /* the drive */
  fvg.push({ t: T0 + 41 * 3600, o: 3378, h: 3382, l: 3360, c: 3365, v: 400 });   /* gap 3352..3360 */
  fvg.push({ t: T0 + 42 * 3600, o: 3365, h: 3366, l: 3354, c: 3356, v: 400 });   /* back inside */
  const f = D(fvg).filter(h => h.kind === 'FVG-FILL')[0];
  ok(!!f, 'FVG-FILL fires when price returns into an unfilled imbalance');
  ok(f.dir === 'long', 'a bullish imbalance is bought (' + f.dir + ')');
  ok(/unfilled bullish imbalance/.test(f.why), 'and the card names the gap (' + f.why + ')');

  /* PWH-SWEEP: the prior WEEK high, a different pool from the prior day. */
  const wk = [];
  for (let i = 0; i < 168; i++) wk.push({ t: T0 + i * 3600, o: 3350, h: 3360, l: 3340, c: 3350, v: 100 });
  for (let i = 168; i < 215; i++) wk.push({ t: T0 + i * 3600, o: 3350, h: 3354, l: 3346, c: 3350, v: 100 });
  wk.push({ t: T0 + 215 * 3600, o: 3355, h: 3372, l: 3352, c: 3356, v: 500 });
  const pw = D(wk, { nowSec: wk[wk.length - 1].t }).filter(h => h.kind === 'PWH-SWEEP')[0];
  ok(!!pw, 'PWH-SWEEP fires on a prior-week high swept and rejected');
  ok(pw.dir === 'short' && /prior week high/.test(pw.why), 'as a short, naming the weekly level (' + pw.why + ')');

  /* GSR-EXTREME needs the silver leg and refuses to guess without it. */
  const g = tape(300, 11);
  delete W.__hgXagCandles;
  ok(!D(g).filter(h => h.kind === 'GSR-EXTREME')[0],
     'GSR-EXTREME does not fire without a silver series — a ratio needs both legs');
  delete W.__hgXagCandles;
}

console.log('\n== THE CORRECTION: 27 mechanics change what a sigma is worth ==');
{
  const rows = tape(300, 21);
  const edge = (stats, fwd) => W.hgOgGates(rows, { kind: 'ROUND-MAGNET', dir: 'short', level: 3350, why: 't' },
                                           { stats, fwd, minRr: 1.5 }).filter(g => g.key === 'measured-edge')[0];

  /* The exact numbers off the user's live card. */
  const live = edge({ samples: 41, hit: 0.51, expR: 0.54 }, null);
  ok(live.pass !== true, 'the live +1.47σ in-sample read no longer PASSES');
  ok(live.pass === null, 'it reads UNCHECKED — not demonstrated, not disproved');
  ok(/mechanics scanned/.test(live.why), 'and the card explains why (' + live.why.slice(-70) + ')');
  /* The bar itself is NOT hard-coded. It is a Sidak family-wise correction
     over OG_MECHANICS.length, so it moves every time a mechanic is added —
     pinning a leading digit made this test assert the mechanic COUNT by
     accident, and it broke twice as the desk grew 34 -> 40 -> 54.
     What matters is that the card quotes the bar at all, and that the number
     it quotes is the one the ledger actually applied. */
  const quoted = /\+(\d\.\d\d)σ is the bar/.exec(live.why);
  ok(!!quoted, 'quoting the bar it had to clear (' + live.why.slice(-60) + ')');
  const nMech = Number((/(\d+) mechanics scanned/.exec(live.why) || [])[1] || 0);
  ok(nMech > 0, 'and naming how many mechanics that bar is corrected for (' + nMech + ')');
  {
    /* Recomputed here rather than imported, so a change to the correction has
       to be made deliberately in two places instead of drifting in one. */
    const normCdf = z => {
      const t = 1 / (1 + 0.2316419 * Math.abs(z));
      const d = 0.3989422804014327 * Math.exp(-z * z / 2);
      const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
      return z > 0 ? 1 - p : p;
    };
    const target = Math.pow(0.95, 1 / nMech);
    let lo = 0, hi = 8;
    for (let i = 0; i < 64; i++){ const mid = (lo + hi) / 2; if (normCdf(mid) < target) lo = mid; else hi = mid; }
    const expect = (lo + hi) / 2;
    ok(Math.abs(Number(quoted[1]) - expect) < 0.02,
       'the quoted bar (+' + quoted[1] + 'σ) is the Sidak bar for ' + nMech +
       ' mechanics (+' + expect.toFixed(2) + 'σ)');
  }

  const strong = edge({ samples: 200, hit: 0.62, expR: 0.9 }, null);
  ok(strong.pass === true, 'a genuinely strong in-sample read still passes');
  ok(/clears the \d+-mechanic significance bar/.test(strong.why), 'and says it cleared the bar (' + strong.why.slice(-52) + ')');

  /* Precedence is untouched: real out-of-sample evidence still outranks. */
  const good = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0.64, open: 0, expR: 0.6, ticketOnly: { samples: 25, hit: 0.64, open: 0, expR: 0.6 } });
  ok(good.pass === true, 'a good settled forward record still passes on its own merit');
  const bad = edge({ samples: 41, hit: 0.51, expR: 0.54 }, { samples: 25, hit: 0, open: 0, expR: -1, ticketOnly: { samples: 25, hit: 0, open: 0, expR: -1 } });
  ok(bad.pass === false, 'and a bad one still vetoes');

  /* A mechanic that has genuinely not paid is still vetoed, not merely
     downgraded to unchecked. */
  const dead = edge({ samples: 120, hit: 0.15, expR: -0.6 }, null);
  ok(dead.pass === false, 'a significantly-below-breakeven in-sample record still VETOES');
}

console.log('\n== the correction is keyed to the real mechanic count ==');
{
  /* Behavioural: more mechanics must mean a higher bar, never a lower one. */
  const listSrc = SRC.slice(SRC.indexOf('var OG_MECHANICS'), SRC.indexOf('var __og'));
  const count = (listSrc.match(/'[A-Z0-9-]+'/g) || []).length;
  ok(count >= 27, 'OG_MECHANICS lists every scanned mechanic (' + count + ')');
  ok(/hgOgFamilyZ\(OG_MECHANICS\.length\)/.test(SRC),
     'the bar is computed from that same list, so it cannot drift from what is scanned');
  ok(/var keys = OG_MECHANICS\.slice\(\);/.test(SRC),
     'and the pooled table renders from the same list, so the card and the maths agree');

  /* The Sidak bar for 27 tries is ~2.89σ; for one try it is ~1.64σ. */
  const rows = tape(300, 31);
  const g = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: 3350, why: 't' },
                        { stats: { samples: 41, hit: 0.51, expR: 0.54 }, minRr: 1.5 })
             .filter(x => x.key === 'measured-edge')[0];
  const m = /\+(\d\.\d\d)σ is the bar/.exec(g.why);
  ok(!!m, 'the bar is stated numerically on the card');
  ok(parseFloat(m[1]) > 1.64, 'and it is STRICTER than the single-test 1.64σ (' + m[1] + 'σ)');
  ok(parseFloat(m[1]) < 4, 'without being absurd (' + m[1] + 'σ)');
}

console.log('\n== the five new indicator reads all read on real data ==');
{
  const rows = [];
  let p = 3300;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.0022 + Math.cos(i / 4) * 0.0009);
    rows.push({ t: T0 + i * 3600, o: p * 0.9995, h: p * 1.0018, l: p * 0.9982, c: p, v: 800 + (i % 41) * 30 });
  }
  const gs = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: p, why: 't' },
                         { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 });
  for (const k of NEW_GATES){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the ledger');
    ok(g.info === true, k + ' is an INFO gate — it argues, it does not veto');
    ok(g.pass !== null, k + ' returns a real read on a real series (' + g.why + ')');
    ok(!/unavailable|threw/.test(g.why), k + ' is not reporting itself unreadable');
    ok(!/NaN|undefined/.test(g.why), k + ' never puts NaN on the card');
  }
}

console.log('\n== a reversion mechanic is not punished for being reversion ==');
{
  /* The category error the trend gate already refuses: a fade is
     counter-trend and counter-momentum BY DESIGN. */
  const rows = [];
  let p = 3300;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.0022 + Math.cos(i / 4) * 0.0009);
    rows.push({ t: T0 + i * 3600, o: p * 0.9995, h: p * 1.0018, l: p * 0.9982, c: p, v: 800 + (i % 41) * 30 });
  }
  const at = kind => W.hgOgGates(rows, { kind, dir: 'long', level: p, why: 't' },
                                 { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 });
  const rev = at('ROUND-MAGNET'), cont = at('ORB');
  const get = (gs, k) => gs.filter(x => x.key === k)[0];

  ok(get(rev, 'adx-trend').pass === true, 'ADX does not argue against a reversion mechanic for being counter-trend');
  ok(/by design|wants/.test(get(rev, 'adx-trend').why), 'and says why (' + get(rev, 'adx-trend').why + ')');
  ok(get(rev, 'squeeze-state').pass === true, 'nor does the squeeze read for counter-momentum');
  ok(/counter-momentum by design/.test(get(rev, 'squeeze-state').why), 'stating the same reason');
  ok(/fading/.test(get(rev, 'keltner-pos').why) || get(rev, 'keltner-pos').pass === true,
     'and a band stretch is the setup for a fade, not an argument against it');

  /* The same reads still apply to a continuation mechanic. */
  ok(get(cont, 'adx-trend').pass === false, 'a continuation mechanic against the DI IS flagged');
  ok(get(cont, 'squeeze-state').pass === false, 'and against momentum too');
}

console.log('\n== nothing new became a veto ==');
{
  const rows = [];
  let p = 3300;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.0022 + Math.cos(i / 4) * 0.0009);
    rows.push({ t: T0 + i * 3600, o: p * 0.9995, h: p * 1.0018, l: p * 0.9982, c: p, v: 800 + (i % 41) * 30 });
  }
  const gs = W.hgOgGates(rows, { kind: 'ORB', dir: 'long', level: p, why: 't' },
                         { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12 });
  const grade = W.hgOmniGrade(gs);
  const infoKeys = gs.filter(g => g.info).map(g => g.key);
  /* Derived, not hardcoded: the ledger grows most rounds, and a literal here
     just teaches you to bump it without reading it. What must hold is that
     the runtime info gates are exactly the ones declared info in the source. */
  /* The 14 indicator context gates moved to hg-gates.js (hgIndicatorGates)
     so OMNIROUTE carries them too; derivations that read the gold source
     alone undercount the ledger. */
  const SHSRC2 = fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  const shBody2 = SHSRC2.slice(SHSRC2.indexOf('function hgIndicatorGates'), SHSRC2.indexOf('G.hgBarSpacingSec'));
  const declared = ((SRC + shBody2).match(/gates\.push\(\{ key:'([a-z0-9-]+)'[^}]*info:true/g) || [])
    .map(m => /key:'([a-z0-9-]+)'/.exec(m)[1])
    .filter(k => k !== 'context-gates');   /* fallback, never on a healthy ledger */
  ok(infoKeys.length === declared.length,
     'every info gate declared in the source reaches the ledger (' + infoKeys.length + ')');
  ok(infoKeys.every(k => declared.indexOf(k) >= 0), 'and none appeared from anywhere else');
  ok(grade.vetoes.every(k => infoKeys.indexOf(k) === -1),
     'not one of them appears in vetoes (' + (grade.vetoes.join(', ') || 'no vetoes') + ')');
  ok(gs.filter(g => g.info && g.pass === false).every(g => grade.notes.indexOf(g.key) >= 0),
     'every adverse info read is surfaced under notes instead');

  /* 21 gates is a lot to put in front of someone. They must not all be hard. */
  const hard = gs.filter(g => g.hard === true).length;
  /* Declarations across gold + the shared context block; -2 for the two
     fallbacks that never fire on a healthy ledger; the shared-forwarding
     loop's bare gates.push(sh[si]) is not a declaration and is not counted. */
  const shBody2b = SHSRC2.slice(SHSRC2.indexOf('function hgIndicatorGates'), SHSRC2.indexOf('G.hgBarSpacingSec'));
  const pushes = (SRC.match(/gates\.push\(\{ key:/g) || []).length
               + (shBody2b.match(/gates\.push\(\{ key:/g) || []).length - 2;
  ok(gs.length === pushes, 'every gates.push in the source reaches the ledger (' + gs.length + ')');
  ok(hard <= 13, 'only a minority are hard vetoes (' + hard + ' of ' + gs.length + ') — the rest report');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD ROUND-2 TESTS PASSED');
