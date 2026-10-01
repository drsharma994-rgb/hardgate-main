/* HARDGATE — hg-v1020: GATE 18, THE VWAP STRETCH witness (GOLD SCALP side).
   Gate 17 watches the MOMENTUM axis (H4 RSI at its range extreme); this
   watches the PRICE axis the scalper actually fills on: distance from the
   session's volume-weighted mean, read through the desk's OWN definitions
   (goldSessionAnchor + goldVWAP — one definition, two users). A scalp
   minted at 2.5+ volume-sigmas above the session VWAP is buying the day's
   extension extreme — the chase fill — and it arrives on grind days where
   RSI sits in the 70s and gate 17 has nothing to say (different quantities:
   an oscillator extreme vs a mean-extension extreme).

   AGAINST demotes on the GOLD SCALP soft path (stamped VWAP STRETCH, the
   reason names the stretch) and drops on the OMNIGOLD hard path — the
   gate-11/17 split exactly; OK passes silently; NA (a young anchor window,
   a zero sigma, a missing feed) fails open and never bites.

   Covers:
     1) the witness: the stretch bands, both directions, one-sided verdicts
     2) the fail-open states: young anchors, zero sigma, short tapes
     3) the REAL filter: a stretched long is demoted/dropped by gate 18
        ALONE (gates 11 and 17 both pass it — that is the hole)
     4) the short side, mirrored
     5) what passes: mid-range tapes, swing context, thin tapes
     6) the source says what shipped
   Run: node tests/test-gold-vwap-stretch-v1020.mjs */

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

/* fixtures — one UTC day of 15m bars (D0 = a midnight): the anchor fallback
   lands at the day start, 96 bars in the window */
const D0 = 1699920000; /* 2023-11-14 00:00:00 UTC */
function spikeTape(from, to, flatN, spikeN){
  const rows = []; let p = from;
  for (let i = 0; i < flatN + spikeN; i++){
    const o = p;
    if (i >= flatN) p = from + (to - from) * (i - flatN + 1) / spikeN;
    rows.push({ t: D0 + i * 900, o, h: Math.max(o, p) + 0.5, l: Math.min(o, p) - 0.5, c: p, v: 1000 });
  }
  return rows;
}
const UP_SPIKE = spikeTape(2400, 2500, 80, 16);   /* flat day, then +4.2% into the close */
const DN_SPIKE = spikeTape(2600, 2500, 80, 16);   /* mirrored */
function bars(n, start, step, seed){
  const out = []; let q = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    q = q * (1 + (rnd() - 0.48) * 0.002);
    const r = q * 0.0015 * (0.4 + rnd());
    out.push({ t: D0 + i * step, o: q - r * 0.2, h: q + r, l: q - r, c: q, v: 800 + rnd() * 200 });
  }
  return out;
}
/* the sawtooth 4h: EMAs bull-stacked, RSI mid — gates 11 and 17 BOTH pass,
   so anything that bites here is gate 18's own work */
function saw4h(){
  const out = []; let p = 2000;
  for (let i = 0; i < 80; i++){
    const o = p; p += (i % 4 === 3) ? -2 : 3;
    out.push({ t: 1700000000 + i * 14400, o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
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
/* the short-side mirror is NOT the exact mirror of SAW4: (-3,-3,-3,+2) sits
   H4 RSI at ~18 and gate 17 would eat the short before gate 18 is reached —
   the isolation would be someone else's work. (-2.5,-2.5,-2.5,+3) keeps the
   H4 tape bear-stacked (net -4.5 per 4 bars) with RSI ~31 — gates 11 AND 17
   both pass the short, so what bites here is gate 18's alone. */
function saw4hDn(){
  const out = []; let p = 2000;
  for (let i = 0; i < 80; i++){
    const o = p; p += (i % 4 === 3) ? 3 : -2.5;
    out.push({ t: 1700000000 + i * 14400, o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p, v: 1000 });
  }
  return out;
}
const SAW4 = saw4h(), SAW4DN = saw4hDn(), BULL1 = emaRows(80, 2000, 1.2, 86400), BEAR1 = emaRows(80, 2800, -1.2, 86400);
const NY = Date.UTC(2024, 0, 16, 14, 0, 0);
const vwap = (dir) => ({ stratKey: 'vwap', dir: dir, id: 'vwap|' + dir + '|2400', strategy: 'VWAP', stamps: [], gateNotes: [] });

console.log('== 1) the witness: the stretch bands, both directions, one-sided verdicts ==');
{
  const W = boot();
  const up = W.hgGoldVwapStretch(UP_SPIKE, 'long');
  assert(up.state === 'against' && up.stretch >= 2.5
      && /VWAP STRETCH — price \d+\.\d×σ above the session VWAP/.test(up.reason),
         'a flat day spiking into the close: the long is ' + up.stretch.toFixed(1) + '×σ stretched — AGAINST (' + up.reason + ')');
  assert(W.hgGoldVwapStretch(UP_SPIKE, 'short').state === 'ok',
         '…and the same tape says NOTHING against the short — one-sided verdicts, never both');
  const dn = W.hgGoldVwapStretch(DN_SPIKE, 'short');
  assert(dn.state === 'against' && dn.stretch <= -2.5
      && /×σ below the session VWAP/.test(dn.reason),
         'the mirrored tape: the short is ' + Math.abs(dn.stretch).toFixed(1) + '×σ stretched below — AGAINST');
  assert(W.hgGoldVwapStretch(DN_SPIKE, 'long').state === 'ok',
         '…and nothing against the long on it');
  const mid = W.hgGoldVwapStretch(bars(96, 2400, 900, 3), 'long');
  assert(mid.state === 'ok' && Math.abs(mid.stretch) < 2.5,
         'a mid-range tape (' + mid.stretch.toFixed(1) + '×σ) passes — the witness only bites at the extension extreme');
  assert(W.hgGoldVwapStretch(UP_SPIKE, 'x').state === 'na' && W.hgGoldVwapStretch(null, 'long').state === 'na',
         'no direction, no tape -> NA');
}

console.log('== 2) the fail-open states: young anchors, zero sigma, short tapes ==');
{
  const W = boot();
  /* 80 bars yesterday + 10 bars today: the anchor lands at midnight (bar 80),
     and 10 bars is no stable sigma — the read cannot speak. The timestamps
     must straddle the UTC midnight or the anchor falls to bar 0 and the
     window is 90 bars — a full session, not a young one. */
  const young = [];
  for (let i = 0; i < 90; i++){
    const today = i >= 80, p = today ? 2500 : 2400;
    young.push({ t: D0 - 80 * 900 + i * 900, o: p, h: p + 0.5, l: p - 0.5, c: p, v: 1000 });
  }
  const y = W.hgGoldVwapStretch(young, 'long');
  assert(y.state === 'na' && y.bars === 0 || (y.state === 'na' && y.bars < 20),
         'a young anchor window (' + (y.bars || '<20') + ' bars past the anchor) is NA — even a +4% overnight jump cannot be judged');
  const flat = W.hgGoldVwapStretch(spikeTape(2400, 2400, 96, 0), 'long');
  assert(flat.state === 'na',
         'a perfectly flat tape has zero sigma: the extension question cannot be asked — NA, never a fabricated stretch');
  assert(W.hgGoldVwapStretch(UP_SPIKE.slice(0, 10), 'long').state === 'na',
         'fewer than 20 bars at all: NA');
}

console.log('== 3) the REAL filter: a stretched long is demoted/dropped by gate 18 ALONE ==');
{
  const W = boot();
  const dem = W.hgGoldInstFilter(vwap('long'), {
    rows: UP_SPIKE, nowMs: NY, scalp: true, hardReject: false, rows4h: SAW4, rows1d: BULL1
  });
  assert(dem && !dem.dropped && dem.demoted === true,
         'GOLD SCALP soft path: the chase-fill long is DEMOTED, the card still paints');
  assert((dem.stamps || []).indexOf('VWAP STRETCH') >= 0,
         'stamped VWAP STRETCH (' + (dem.stamps || []).join(', ') + ')');
  assert(dem.mtf && dem.mtf.scalpLongOk === true
      && dem.momRegime && dem.momRegime.state === 'ok',
         'gates 11 AND 17 both passed this long — the demote is gate 18\'s alone, not a restated bar');
  assert(dem.vwapStretch && dem.vwapStretch.state === 'against' && dem.vwapStretch.stretch >= 2.5,
         'the cand carries the witness record (stretch ' + (dem.vwapStretch && dem.vwapStretch.stretch.toFixed(1)) + '×σ)');
  assert(/VWAP STRETCH/.test(dem.reason || '') && (dem.gateNotes || []).some(g => /VWAP STRETCH/.test(g)),
         'and the reason names the stretch on the card and in the gate notes');
  const hard = W.hgGoldInstFilter(vwap('long'), {
    rows: UP_SPIKE, nowMs: NY, scalp: true, rows4h: SAW4, rows1d: BULL1
  });
  assert(hard && hard.dropped === true && /VWAP STRETCH — price/.test(hard.reason || ''),
         'OMNIGOLD hard path: the same long is DROPPED with the witness\'s reason');
}

console.log('== 4) the short side, mirrored ==');
{
  const W = boot();
  /* SAW4DN, not SAW4: the up-sawtooth's H4 reads bull, the BEAR1 daily reads
     bear, and the MTF bar locks the scalp short before gate 18 — the witness
     would never be reached and the drop would wear someone else's reason. */
  const dem = W.hgGoldInstFilter(vwap('short'), {
    rows: DN_SPIKE, nowMs: NY, scalp: true, hardReject: false, rows4h: SAW4DN, rows1d: BEAR1
  });
  assert(dem && !dem.dropped && dem.demoted === true
      && (dem.stamps || []).indexOf('VWAP STRETCH') >= 0
      && /below the session VWAP/.test(dem.reason || ''),
         'a short minted ' + Math.abs(dem.vwapStretch.stretch).toFixed(1) + '×σ below the session mean is DEMOTED with the mirrored reason');
  assert(dem.mtf && dem.mtf.scalpShortOk === true
      && dem.momRegime && dem.momRegime.state === 'ok'
      && (dem.stamps || []).length === 1,
         'gates 11 AND 17 both passed this short — the demote is gate 18\'s alone, one stamp, no one else\'s work');
  const hard = W.hgGoldInstFilter(vwap('short'), {
    rows: DN_SPIKE, nowMs: NY, scalp: true, rows4h: SAW4DN, rows1d: BEAR1
  });
  assert(hard && hard.dropped === true && /VWAP STRETCH/.test(hard.reason || ''),
         'and the hard path drops it the same way');
}

console.log('== 5) what passes: mid-range tapes, swing context, thin tapes ==');
{
  const W = boot();
  const okL = W.hgGoldInstFilter(vwap('long'), {
    rows: bars(96, 2400, 900, 3), nowMs: NY, scalp: true, hardReject: false, rows4h: SAW4, rows1d: BULL1
  });
  assert(okL && okL.vwapStretch && okL.vwapStretch.state === 'ok'
      && (okL.stamps || []).indexOf('VWAP STRETCH') < 0,
         'a mid-range stretch (' + okL.vwapStretch.stretch.toFixed(1) + '×σ) never draws the stamp');
  const swing = W.hgGoldInstFilter(vwap('long'), {
    rows: UP_SPIKE, nowMs: NY, scalp: false, hardReject: false, rows4h: SAW4, rows1d: BULL1
  });
  assert(swing && swing.vwapStretch === undefined,
         'the swing path is not the scalp\'s business — no witness record at all');
  const thin = W.hgGoldInstFilter(vwap('long'), {
    rows: UP_SPIKE.slice(0, 10), nowMs: NY, scalp: true, hardReject: false, rows4h: SAW4, rows1d: BULL1
  });
  assert(thin && thin.vwapStretch && thin.vwapStretch.state === 'na'
      && !/VWAP STRETCH/.test(thin.reason || ''),
         'a thin tape fails open inside the filter — the witness cannot speak and holds nothing');
}

console.log('== 6) the source says what shipped ==');
{
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  assert(/var HG_GOLD_VWAP_STRETCH_SD = 2\.5;/.test(gi),
         'the stretch bar is the stated prior: 2.5×σ');
  assert(/W\.hgGoldVwapStretch = hgGoldVwapStretch;/.test(gi) && typeof boot().hgGoldVwapStretch === 'function',
         'the witness is exported');
  assert(/18\) VWAP STRETCH \(hg-v1020/.test(gs),
         'goldscalp.js documents gate 18 (docs follow behavior)');
  assert(gi.indexOf('hgGoldVwapStretch(rows, dir)') > gi.indexOf('hgGoldMomRegime(ctx.rows4h, dir)'),
         'gate 18 rides INSIDE the scalp block, one witness past the momentum bar');
  assert(/goldSessionAnchor\(rows\)[\s\S]{0,200}goldVWAP\(rows, anchor\)/.test(gi.split('function hgGoldVwapStretch')[1].split('function hgGoldEma50Above')[0]),
         'the witness reuses the desk\'s OWN anchor and VWAP — one definition, two users');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD VWAP-STRETCH TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
