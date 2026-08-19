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
/* hg-gates.js holds the gate logic that was identical in both desks. */
new Function('window', readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8'))(win);
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

  /* Full context grades to a clean ticket.
     The series needs real two-way movement, not the straight line above: a
     strictly monotonic tape has RSI pinned at 100, so the stochastic RSI has
     no range to normalise against and genuinely has no value. That is the
     indicator being honest, not a gate failing, but it makes the
     every-gate-evaluated assertion below untestable on a straight line. */
  const wavy = [];
  {
    let p = 2000;
    for (let i = 0; i < 200; i++){
      const o = p;
      p = p * (1 + Math.sin(i / 9) * 0.0018 + 0.0004);
      wavy.push({ t: i * 3600, o, h: Math.max(o, p) + 2, l: Math.min(o, p) - 2, c: p, v: 100 });
    }
  }
  const full = win.hgOgGates(wavy, hit, {
    htf:{e21:10,e50:9}, killzone:{zone:'LONDON',label:'LONDON OPEN'},
    macro:{realRateHint:'TAILWIND', dxy:{trend20:'DOWN'}}, yield:{valid:true},
    adr:{usedPct:45}, news:{risk:'low',note:''}, minRr:1.5,
    stats:{samples:120,hit:0.45,expR:0.12},
    planRisk: 12   /* a wide-enough stop that cost drag is immaterial */
  });
  const gFull = win.hgOmniGrade(full);
  ok(gFull.ticket === true, 'a fully supported gold setup grades to a ticket');

  /* This harness loads each module with new Function('window', src), which
     gives every file its own scope — so indicators.js, indicators2.js and
     fixpack14-core.js are not loaded here at all, and the four gates that
     read them (ichimoku, donchian, stoch RSI, Hurst) correctly report that
     they could not be computed. In the browser those are classic scripts and
     their declarations are on window, so the reads do happen; that they
     produce real values on a real series is proved against a shared context
     in test-omnigold-mechanics.mjs.

     What belongs HERE is that the rest of the ledger is fully evaluated, and
     that the gates which cannot run say so rather than passing quietly. */
  /* Every gate that reads the indicator library, derived from the source so
     this does not need editing each time one is added. Plus measured-edge,
     which reads UNCHECKED here on purpose (45% over 120 samples is +1.1σ, and
     against 27 scanned mechanics the bar is +2.89σ), and consensus, which is
     soft-UNCHECKED when no scan is supplied. */
  /* The context gates live in hg-gates.js now; deriving from gold alone
     misses them and every runtime UNCHECKED then fails membership. */
  const ogSrc = readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8')
              + readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  const INFO_GATES = (ogSrc.match(/gates\.push\(\{ key:'([a-z0-9-]+)'[^}]*info:true/g) || [])
    .map(m => /key:'([a-z0-9-]+)'/.exec(m)[1])
    /* context-gates is the fallback both sides declare and neither pushes on
       a healthy ledger — it exists only when hg-gates.js is broken/absent. */
    .filter(k => k !== 'context-gates');
  /* plan-levels reads UNCHECKED here for the same reason stop-width does:
     this harness supplies no plan, and the gate deliberately distinguishes
     an absent plan KEY (nothing to judge) from an explicitly null plan
     (the engine ran and produced no levels, which IS a veto). */
  /* level-fresh joins for the same reason: no live price is supplied here,
     and unknown reads UNCHECKED. When a price IS supplied and the market has
     crossed the stop, it vetoes — asserted in test-level-fresh.mjs. */
  const INDICATOR_GATES = INFO_GATES.concat(['measured-edge', 'consensus', 'plan-levels', 'level-fresh']);
  const unchecked = full.filter(g => g.pass === null).map(g => g.key);
  ok(unchecked.every(k => INDICATOR_GATES.indexOf(k) >= 0),
     'every gate that can run in this harness is evaluated (unchecked: ' + (unchecked.join(', ') || 'none') + ')');
  ok(gFull.evaluated === gFull.total - unchecked.length, 'and the evaluated count matches');
  INDICATOR_GATES.forEach(k => {
    const g = full.filter(x => x.key === k)[0];
    ok(!!g, 'gate "' + k + '" is on the gold ledger');
    ok(g.pass !== true, k + ' does not pass on evidence it has not got (' + g.why + ')');
  });
  /* measured-edge is NOT an info gate: a mechanic proven to lose must still be
     able to veto. Only the indicator context reads are non-vetoing. */
  /* consensus is a HARD veto and measured-edge can veto: both are excluded
     from the info check on purpose. A structural contradiction between the
     desk's own mechanics, and a mechanic proven to lose, must both be able to
     stand a trade aside. */
  /* plan-levels joins them. It is UNCHECKED in this harness only because no
     plan key is supplied; when the engine actually returns null it must
     VETO, because a ticket with no entry, stop or target is a trade that
     cannot be placed. Making it info would restore the exact defect it
     was added to close. */
  INDICATOR_GATES.filter(k => k !== 'measured-edge' && k !== 'consensus' && k !== 'plan-levels' && k !== 'level-fresh').forEach(k => {
    ok(full.filter(x => x.key === k)[0].info === true,
       k + ' is INFO: it reports an adverse read, it does not veto');
  });
  ok(full.filter(x => x.key === 'measured-edge')[0].info !== true,
     'measured-edge is NOT info — a mechanic that has demonstrably not paid still vetoes');
  ok(full.filter(x => x.key === 'consensus')[0].info !== true,
     'consensus is NOT info — a two-sided tape must be able to stand the trade aside');

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

/* ---- horizon-aware gates, all three from the first live gold scan ---- */
{
  const flat = [];
  let px = 4384;
  for (let i = 0; i < 200; i++){ const o = px, c = px + 0.15; flat.push({ t:i*3600, o, h:Math.max(o,c)+0.6, l:Math.min(o,c)-0.6, c, v:100 }); px = c; }
  const hit = { kind:'MMOVE', dir:'long', level:1, why:'t' };

  /* vol floor scales with bar length: ATR% goes as sqrt(bar length), so
     holding 1h bars to a 4h floor vetoed live setups as "too dead". */
  const volWhy = f => win.hgOgGates(flat, hit, { minAtrPct: f }).filter(g => g.key === 'vol-alive')[0].why;
  ok(/floor 0.05%/.test(volWhy(0.05)), 'the scalp horizon states its own ATR floor');
  ok(/floor 0.12%/.test(volWhy(0.12)), 'the swing horizon states a different floor');

  /* session is decisive intraday, contextual on swing — the first build
     vetoed 4h structures for the clock. */
  const sess = hard => win.hgOgGates(flat, hit, { killzone:{ zone:'OFF', label:'OFF-HOURS' }, sessionHard: hard })
                          .filter(g => g.key === 'session')[0];
  ok(sess(true).pass === false, 'off-hours VETOES on the scalp horizon');
  ok(sess(false).pass === true, 'off-hours does NOT veto on the swing horizon');
  ok(/context only at swing horizon/.test(sess(false).why), 'and the swing card says it is context only');

  /* yield guard reads tnxTrend — getGoldMacro exposes no US10Y candle rows,
     which is why the first build reported this gate UNCHECKED on every card. */
  const yg = (trend, dir) => win.hgOgGates(flat, { kind:'MMOVE', dir, level:1, why:'t' }, { macro:{ tnxTrend: trend } })
                                .filter(g => g.key === 'yield-guard')[0];
  ok(yg('RISING', 'long').pass === false,  'rising US10Y is a headwind for a gold long');
  ok(yg('RISING', 'short').pass === true,  'rising US10Y supports a gold short');
  ok(yg('FALLING', 'long').pass === true,  'falling US10Y supports a gold long');
  ok(yg('FLAT', 'long').pass === true,     'a flat yield trend blocks nothing');
  ok(win.hgOgGates(flat, hit, {}).filter(g => g.key === 'yield-guard')[0].pass === null,
     'with no macro at all the yield gate stays UNCHECKED');
}

/* ---- cost drag: a structurally correct stop can still be untradeable ----
   The walk-forward measures GROSS outcomes. On the first live scalp card a
   3.16-point stop meant a $0.30 gold spread was ~19% of 1R round-trip,
   turning a measured +0.38R into roughly +0.19R net. Six scalp mechanics
   reading "has paid" gross is exactly where that difference matters. */
{
  const flat = [];
  let px = 4384;
  for (let i = 0; i < 200; i++){ const o = px, c = px + 0.15; flat.push({ t:i*3600, o, h:Math.max(o,c)+0.6, l:Math.min(o,c)-0.6, c, v:100 }); px = c; }
  const hit = { kind:'MMOVE', dir:'long', level:1, why:'t' };
  const cost = r => win.hgOgGates(flat, hit, { planRisk: r }).filter(g => g.key === 'cost-drag')[0];

  ok(cost(1.5).pass === false, 'a $1.50 stop is vetoed — the spread would eat most of 1R');
  ok(cost(3.16).pass === true, 'the live 3.16-point stop passes but is flagged');
  ok(/material drag/.test(cost(3.16).why), 'and says the drag is material rather than staying silent');
  ok(!/material drag/.test(cost(40).why), 'a wide swing stop carries no drag warning');
  ok(/% of 1R/.test(cost(8).why), 'the card always states the cost as a share of 1R');
  ok(cost(NaN).pass === null, 'with no plan risk the gate stays UNCHECKED rather than guessing');

  ok(win.hgOgGates(flat, hit, {}).map(g => g.key).indexOf('cost-drag') >= 0,
     'cost-drag is part of the gold ledger');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL OMNIGOLD TESTS PASSED');
