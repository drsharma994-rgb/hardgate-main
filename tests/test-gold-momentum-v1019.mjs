/* HARDGATE — hg-v1019: GATE 17, THE MOMENTUM EXHAUSTION witness (GOLD SCALP
   side). Gate 11 asks where price SITS (the H4/Daily EMA20/50 stacks) — and
   it answers with the SAME recent closes an RSI range-break would read, so
   a momentum-regime bar would mostly restate gate 11. What gate 11
   structurally cannot see is a PERFECT stack at its exhaustion extreme: the
   canonical Cardwell ranges put bull momentum at RSI 40–80 and bear
   momentum at 20–60, so an H4 RSI(14) >= 80 is stretched past even the
   healthy bull range (a blow-off) and <= 20 past the bear range
   (capitulation) — arriving with gate 11 fully stacked and smiling. A scalp
   is a bet on the next few bars: buying the blow-off / shorting the
   capitulation is the classic bad fill.

   Gate 17 closes exactly that hole: hgGoldMomRegime reads the H4 RSI the
   candidate's own filter context already carries; AGAINST demotes on the
   GOLD SCALP soft path (stamped MOM EXHAUSTION, the reason names the RSI)
   and drops on the OMNIGOLD hard path — the gate-11 split exactly. OK and
   unreadable tapes pass silently; the witness only ever removes.

   Covers:
     1) the witness: the exhaustion bands, both directions
     2) the fail-open states: short tapes, NaN tails, no direction
     3) the REAL filter: a stacked long at RSI 100 is demoted/dropped by
        gate 17 ALONE (gate 11 passes it — that is the hole)
     4) the short side, mirrored — a stacked short at RSI ~0
     5) what passes: mid-range tapes, swing context, missing feeds
     6) the source says what shipped
   Run: node tests/test-gold-momentum-v1019.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported below */ }
  }
  return ctx;
}

/* the v1017 fixture shapes: monotonic-drift candles stack the EMAs AND pin
   RSI at its extreme — which is exactly the gate-17 scenario: gate 11 fully
   stacked, momentum past the range edge */
function emaRows(n, start, drift, step){
  const out = []; let p = start;
  for (let i = 0; i < n; i++){
    const o = p; p = p + drift;
    out.push({ t: 1700000000 + i * step, o: o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
  }
  return out;
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
const BULL4 = emaRows(80, 2000, 1.2, 14400), BULL1 = emaRows(80, 2000, 1.2, 86400);
const BEAR4 = emaRows(80, 2800, -1.2, 14400), BEAR1 = emaRows(80, 2800, -1.2, 86400);
const NY = Date.UTC(2024, 0, 16, 14, 0, 0); /* NY overlap — the session gate passes */
const vwap = (dir) => ({ stratKey: 'vwap', dir: dir, id: 'vwap|' + dir + '|2400', strategy: 'VWAP', stamps: [], gateNotes: [] });

console.log('== 1) the witness: the exhaustion bands, both directions ==');
{
  const W = boot();
  const bullL = W.hgGoldMomRegime(BULL4, 'long');
  assert(bullL.state === 'against' && bullL.rsi >= 80
      && /MOMENTUM EXHAUSTION — H4 RSI \d+\.\d ≥ 80/.test(bullL.reason),
         'a stacked bull tape at H4 RSI ' + bullL.rsi.toFixed(1) + ': the long is AGAINST — buying the blow-off');
  const bullS = W.hgGoldMomRegime(BULL4, 'short');
  assert(bullS.state === 'ok' && bullS.reason === null,
         'the same tape says NOTHING against the short — one-sided verdicts, never both');
  const bearS = W.hgGoldMomRegime(BEAR4, 'short');
  assert(bearS.state === 'against' && bearS.rsi <= 20
      && /MOMENTUM EXHAUSTION — H4 RSI \d+\.\d ≤ 20/.test(bearS.reason),
         'a stacked bear tape at H4 RSI ' + bearS.rsi.toFixed(1) + ': the short is AGAINST — shorting the capitulation');
  const bearL = W.hgGoldMomRegime(BEAR4, 'long');
  assert(bearL.state === 'ok', 'and that tape says nothing against the long either');
  const mid = W.hgGoldMomRegime(bars(80, 2400, 14400, 3), 'long');
  assert(mid.state === 'ok' && mid.rsi > 20 && mid.rsi < 80,
         'a mid-range tape (RSI ' + mid.rsi.toFixed(1) + ') passes both ways — the witness only bites at the extremes');
}

console.log('== 2) the fail-open states: short tapes, NaN tails, no direction ==');
{
  const W = boot();
  assert(W.hgGoldMomRegime(emaRows(10, 2000, 1, 14400), 'long').state === 'na'
      && W.hgGoldMomRegime([], 'long').state === 'na'
      && W.hgGoldMomRegime(null, 'short').state === 'na',
         'fewer than 16 clean closes, an empty tape, a missing feed: NA — it never bites');
  const nanTail = emaRows(40, 2000, 1.2, 14400); nanTail[nanTail.length - 1] = { t: 1, o: NaN, h: NaN, l: NaN, c: NaN, v: 1000 };
  const st = W.hgGoldMomRegime(nanTail, 'long');
  assert(st.bars === 39 && st.state === 'against',
         'a NaN tail is SKIPPED, not poisoned — 39 clean closes still read (' + st.bars + ' bars, ' + st.state + ' on a monotone tape)');
  const allNan = emaRows(40, 2000, 1.2, 14400).map(r => ({ t: r.t, o: NaN, h: NaN, l: NaN, c: NaN, v: 1000 }));
  assert(W.hgGoldMomRegime(allNan, 'long').state === 'na',
         'a tape with NO clean closes is NA — it never bites');
  assert(W.hgGoldMomRegime(BULL4, 'sideways').state === 'na' && W.hgGoldMomRegime(BULL4, null).state === 'na',
         'no direction -> no verdict');
}

console.log('== 3) the REAL filter: a stacked long at RSI 100 is demoted/dropped by gate 17 ALONE ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  /* gate 11 PASSES this long — BULL4 + BULL1 both bull-stacked — so anything
     that bites here is gate 17's own work: the hole it exists for */
  const dem = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: BULL4, rows1d: BULL1
  });
  assert(dem && !dem.dropped && dem.demoted === true,
         'GOLD SCALP soft path: the blow-off long is DEMOTED, the card still paints');
  assert((dem.stamps || []).indexOf('MOM EXHAUSTION') >= 0,
         'stamped MOM EXHAUSTION (' + (dem.stamps || []).join(', ') + ')');
  assert(/MOMENTUM EXHAUSTION — H4 RSI/.test(dem.reason || '')
      && (dem.gateNotes || []).some(g => /MOMENTUM EXHAUSTION/.test(g)),
         'and the reason names the witness and the print (' + (dem.reason || '') + ')');
  assert(dem.momRegime && dem.momRegime.state === 'against' && dem.momRegime.rsi >= 80,
         'the cand carries the witness record (state against, RSI ' + (dem.momRegime && dem.momRegime.rsi.toFixed(1)) + ')');
  assert(dem.mtf && dem.mtf.scalpLongOk === true,
         'gate 11 passed this long — the demote is gate 17\'s alone, not a restated stack');
  const hard = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, rows4h: BULL4, rows1d: BULL1
  });
  assert(hard && hard.dropped === true && /MOMENTUM EXHAUSTION — H4 RSI/.test(hard.reason || ''),
         'OMNIGOLD hard path: the same long is DROPPED with the witness\'s reason');
}

console.log('== 4) the short side, mirrored — a stacked short at RSI ~0 ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  const dem = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: BEAR4, rows1d: BEAR1
  });
  assert(dem && !dem.dropped && dem.demoted === true
      && (dem.stamps || []).indexOf('MOM EXHAUSTION') >= 0
      && /≤ 20/.test(dem.reason || ''),
         'a capitulation-hole short is DEMOTED with the mirrored reason (' + (dem.reason || '') + ')');
  assert(dem.mtf && dem.mtf.scalpShortOk === true,
         'gate 11 passed this short too — the mirror hole is gate 17\'s own');
  const hard = W.hgGoldInstFilter(vwap('short'), {
    rows: rows, nowMs: NY, scalp: true, rows4h: BEAR4, rows1d: BEAR1
  });
  assert(hard && hard.dropped === true && /MOMENTUM EXHAUSTION/.test(hard.reason || ''),
         'and the hard path drops it the same way');
}

console.log('== 5) what passes: mid-range tapes, swing context, missing feeds ==');
{
  const W = boot();
  const rows = bars(40, 2400, 900, 3);
  const mid4 = bars(80, 2400, 14400, 3);
  const okL = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false, rows4h: mid4, rows1d: BULL1
  });
  assert(okL && okL.momRegime && okL.momRegime.state === 'ok'
      && (okL.stamps || []).indexOf('MOM EXHAUSTION') < 0,
         'a mid-range H4 RSI (' + okL.momRegime.rsi.toFixed(1) + ') never draws the stamp');
  const swing = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: false, hardReject: false, rows4h: BULL4, rows1d: BULL1
  });
  assert(swing && swing.momRegime === undefined,
         'the swing path is not the scalp\'s business — no witness record at all');
  const noFeed = W.hgGoldInstFilter(vwap('long'), {
    rows: rows, nowMs: NY, scalp: true, hardReject: false
  });
  assert(noFeed && noFeed.momRegime && noFeed.momRegime.state === 'na'
      && !/MOMENTUM/.test(noFeed.reason || ''),
         'missing H4 feeds fail open — the witness cannot speak and holds nothing');
}

console.log('== 6) the source says what shipped ==');
{
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  assert(/var HG_GOLD_MOM_EXH_LONG = 80, HG_GOLD_MOM_EXH_SHORT = 20;/.test(gi),
         'the exhaustion bars are the stated priors: 80 / 20');
  assert(/W\.hgGoldMomRegime = hgGoldMomRegime;/.test(gi) && typeof boot().hgGoldMomRegime === 'function',
         'the witness is exported');
  assert(/17\) MOMENTUM EXHAUSTION \(hg-v1019/.test(gs),
         'goldscalp.js documents gate 17 (docs follow behavior)');
  assert(gi.indexOf('hgGoldMomRegime(ctx.rows4h, dir)') > gi.indexOf('hgGoldMtfMatrix({'),
         'the gate rides INSIDE the scalp block, one witness past the alignment bar');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD MOMENTUM-EXHAUSTION TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
