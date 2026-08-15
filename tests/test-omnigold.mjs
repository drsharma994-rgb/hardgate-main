/* =========================================================================
tests/test-omnigold.mjs

OMNIGOLD — gold desk setups on the OmniRoute engine.

The tab deliberately REUSES omniroute.js's detectors, walk-forward, grading,
plan derivation and ranking rather than copying them, so these tests load
both and assert the gold layer on top: the session/ADR/round-level mechanics,
and a gate ledger that drops the perp gates (no funding, OI, retail or taker
exists on spot gold) in favour of session, real-rate macro, DXY inverse,
yield guard and ADR budget.
========================================================================= */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const win = {};
new Function('window', readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8'))(win);
new Function('window', readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8'))(win);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.log('FAIL  - ' + msg); }
}

/* 1h bars across whole UTC days. Asia (23:00-07:00 UTC) is deliberately
   quiet, London/NY wide — the shape the session detectors expect. */
function sessionBars(days){
  const out = []; let px = 2000;
  for (let d = 0; d < days; d++){
    for (let hr = 0; hr < 24; hr++){
      const t = d * 86400 + hr * 3600;
      const amp = (hr >= 23 || hr < 7) ? 1.5 : 6;
      const o = px, c = px + ((hr % 3) - 1) * amp * 0.3;
      out.push({ t, o, h: Math.max(o,c) + amp, l: Math.min(o,c) - amp, c, v: 100 + hr });
      px = c;
    }
  }
  return out;
}
const rows = sessionBars(10);

/* ---- registration ---- */
ok(win.HG_tabs.filter(t => t.id === 'omnigold').length === 1, 'HG_tabs omnigold registered exactly once');
ok(typeof win.HG_tabs.filter(t => t.id === 'omnigold')[0].refresh === 'function', 'omnigold exposes the refresh contract');

/* ---- Asia session range ---- */
{
  const a = win.hgOgAsiaRange(rows);
  ok(a && a.bars === 8, 'Asia range spans exactly the 8 hours 23:00-07:00 UTC (got ' + (a ? a.bars : 0) + ')');
  ok(a && a.hi > a.lo, 'Asia range high is above its low');
  ok(win.hgOgAsiaRange(null) === null, 'Asia range is null-safe');
  ok(win.hgOgAsiaRange(rows.slice(0, 3)) === null, 'too few bars refuses rather than inventing a range');
}

/* ---- Asia break ---- */
{
  const a = win.hgOgAsiaRange(rows);
  const up = rows.concat([{ t: rows[rows.length-1].t + 3600, o: a.hi - 1, h: a.hi + 5, l: a.hi - 2, c: a.hi + 4, v: 200 }]);
  const brk = win.hgOgAsiaBreak(up, a);
  ok(brk && brk.kind === 'ASIA-BREAK' && brk.dir === 'long', 'a close above the Asia high is a long ASIA-BREAK');

  const inside = rows.concat([{ t: rows[rows.length-1].t + 3600, o: a.lo + 1, h: a.hi - 1, l: a.lo + 0.5, c: a.lo + 2, v: 200 }]);
  ok(win.hgOgAsiaBreak(inside, a) === null, 'a bar inside the range is not a break');
}

/* ---- killzone Judas: the session gate is the whole point ---- */
{
  const a = win.hgOgAsiaRange(rows);
  const swept = rows.concat([{ t: rows[rows.length-1].t + 3600, o: a.lo + 1, h: a.lo + 3, l: a.lo - 6, c: a.lo + 2, v: 300 }]);
  const inKz = win.hgOgKzJudas(swept, a, () => ({ zone:'LONDON', label:'LONDON OPEN' }));
  ok(inKz && inKz.kind === 'KZ-JUDAS' && inKz.dir === 'long', 'a swept-and-reclaimed Asia low inside a killzone is a long KZ-JUDAS');
  ok(win.hgOgKzJudas(swept, a, () => ({ zone:'OFF' })) === null, 'the same sweep OUTSIDE a killzone is not claimed');
  ok(win.hgOgKzJudas(swept, a, null) === null, 'with no killzone function the setup is refused, not guessed');
}

/* ---- ADR + fade ---- */
{
  const adr = win.hgOgAdr(rows, 7);
  ok(adr && isFinite(adr.adr) && adr.adr > 0, 'ADR computes a positive average daily range');
  ok(win.hgOgAdr([], 7) === null, 'ADR is null-safe on empty input');
  ok(win.hgOgAdrFade(rows, { usedPct: 40, todayHi: 2010, todayLo: 2000 }) === null,
     'a day that has used only 40% of ADR is not a fade');
}

/* ---- round-number magnet ---- */
{
  const rej = win.hgOgRoundMagnet(rows.concat([{ t: 9e5, o: 1998, h: 2007, l: 1997, c: 1996, v: 100 }]));
  ok(rej && rej.kind === 'ROUND-MAGNET' && rej.dir === 'short' && rej.level === 2000,
     'a wick through $2000 closing back below is a short ROUND-MAGNET');
  ok(win.hgOgRoundMagnet(null) === null, 'round magnet is null-safe');
}

/* ---- the gold ledger: perp gates absent, gold gates present ---- */
{
  const flat = [];
  let px = 2000;
  for (let i = 0; i < 200; i++){ const o = px, c = px + 0.4; flat.push({ t: i*3600, o, h: Math.max(o,c)+2, l: Math.min(o,c)-2, c, v: 100 }); px = c; }
  const hit = { kind:'ASIA-BREAK', dir:'long', level:2000, why:'t' };
  const keys = win.hgOgGates(flat, hit, {}).map(g => g.key);

  ['funding','oi-build','retail-contrarian','taker-flow','book-depth'].forEach(k => {
    ok(keys.indexOf(k) === -1, 'perp gate "' + k + '" is absent — it has no meaning on spot gold');
  });
  ['session','macro-realrate','dxy-inverse','yield-guard','adr-budget'].forEach(k => {
    ok(keys.indexOf(k) >= 0, 'gold gate "' + k + '" is present');
  });

  /* participation must be CONDITIONAL on gold: several feeds publish no volume */
  const part = win.hgOgGates(flat, hit, {}).filter(g => g.key === 'participation')[0];
  ok(part.hard === false, 'participation is conditional on gold (feeds without volume must not be disqualified)');
  const noVol = flat.map(r => ({ ...r, v: null }));
  const partNoVol = win.hgOgGates(noVol, hit, {}).filter(g => g.key === 'participation')[0];
  ok(partNoVol.pass === null, 'a volumeless gold feed reads UNCHECKED, never a silent pass');

  /* full context grades to a clean ticket */
  const full = win.hgOgGates(flat, hit, {
    htf:{e21:10,e50:9}, killzone:{zone:'LONDON',label:'LONDON OPEN'},
    macro:{realRateHint:'TAILWIND', dxy:{trend20:'DOWN'}}, yield:{valid:true},
    adr:{usedPct:45}, news:{risk:'low',note:''}, minRr:1.5,
    stats:{samples:120,hit:0.45,expR:0.12}
  });
  const gFull = win.hgOmniGrade(full);
  ok(gFull.ticket === true, 'a fully supported gold setup grades to a ticket');
  ok(gFull.evaluated === gFull.total, 'and reports every gate evaluated');

  /* hostile context vetoes on the gold-specific gates */
  const hostile = win.hgOgGates(flat, hit, {
    macro:{realRateHint:'HEADWIND', dxy:{trend20:'UP'}},
    yield:{valid:false, reason:'yields rising'}, adr:{usedPct:140},
    news:{risk:'high', blackout:true, note:''}, minRr:1.5
  });
  const vet = win.hgOmniGrade(hostile).vetoes;
  ['macro-realrate','dxy-inverse','yield-guard','adr-budget','news-window'].forEach(k => {
    ok(vet.indexOf(k) >= 0, 'hostile ' + k + ' vetoes the setup');
  });

  /* an unloaded news module must not read as low risk — same rule as omniroute */
  const nw = win.hgOgGates(flat, hit, { news:{ risk:'low', blackout:false, note:'news not loaded' } })
                .filter(g => g.key === 'news-window')[0];
  ok(nw.pass === null, 'an unloaded news module reads UNCHECKED on gold too');

  /* a reversion mechanic is not vetoed for being counter-trend */
  const dn = [];
  let p2 = 2100;
  for (let i = 0; i < 120; i++){ const o = p2, c = p2 - 0.9; dn.push({ t:i*3600, o, h:Math.max(o,c)+1, l:Math.min(o,c)-1, c, v:100 }); p2 = c; }
  const fadeTrend = win.hgOgGates(dn, { kind:'ADR-FADE', dir:'long', level:1, why:'t' }, {})
                       .filter(g => g.key === 'trend')[0];
  ok(fadeTrend.pass !== false && fadeTrend.hard === false,
     'ADR-FADE long in a downtrend is not vetoed on trend (reversion family)');
}

/* ---- detection composes omniroute's six with the gold four ---- */
{
  const hits = win.hgOgDetect(rows, { kzFn: () => ({ zone:'LONDON', label:'LONDON OPEN' }) });
  ok(Array.isArray(hits), 'hgOgDetect always returns an array');
  ok(win.hgOgDetect(null).length === 0, 'detection on null input is empty, not a throw');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL OMNIGOLD TESTS PASSED');
