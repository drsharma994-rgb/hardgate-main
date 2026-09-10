/* HARDGATE — hg-v702 NEW GOLD loosened fire windows (user-directed).

   The original Pine fire demanded all three legs on ONE closed bar; the
   replay measured that coincidence at ~9 fires in 5.5 months. Two loosened
   knobs, both bounded, both printed on any fire that used them:
     NG_RSI_CROSS_BARS=3  a cross within the last 3 closed bars triggers,
                          provided RSI still HOLDS the crossed side now; a
                          more recent opposite cross kills the window.
     NG_FVG_EDGE_ATR=0.25 a close within 0.25 ATR of the zone's NEAR edge
                          counts (inside still counts; the far/stop side
                          never does). No readable ATR -> tolerance 0.
   NOT loosened: mitigation, VWMA side, session-htf class, composed stop
   floor, MIN_RR. The rules live in the exported pure functions
   ngRsiWindowFromSeries / ngFvgNearFrom (ngLegRead is their only production
   caller — detector and checklist inherit them through it), so this suite
   drives the exact boundaries with explicit series, plus the fail-closed
   no-ATR path and the loosened honesty text on confirmations.
   Run: node tests/test-newgold-loosen.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'newgold.js', 'utf8'), { filename: 'newgold.js' });
const W = globalThis.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* Build rsi/sma series with a controlled cross history. Base: RSI riding
   ABOVE its SMA. A dip segment puts RSI below SMA, then an up-cross exactly
   `age` bars before the end; `hold` keeps RSI above SMA through the tail
   (false drops it back under on the LAST bar without a fresh cross read —
   engineered so prev<=smaPrev is false on that bar). */
function mkSeries(opts){
  opts = opts || {};
  const n = 60, rsi = [], sma = [];
  for (let i = 0; i < n; i++){ rsi.push(60); sma.push(55); }         /* above, no cross */
  const age = opts.age | 0;
  const crossIdx = n - 1 - age;
  /* dip below the SMA for 4 bars before the cross */
  for (let i = crossIdx - 4; i < crossIdx; i++){ rsi[i] = 48; sma[i] = 52; }
  /* the cross bar: prev(48)<=smaPrev(52), now above */
  rsi[crossIdx] = 58; sma[crossIdx] = 54;
  /* tail after the cross: held above, or (hold:false) drift to just UNDER
     the sma with prev ALSO under (no fresh bear-cross read on the last bar
     pair — prev >= smaPrev fails) */
  for (let i = crossIdx + 1; i < n; i++){
    if (opts.hold === false){ rsi[i] = 50; sma[i] = 53; }
    else { rsi[i] = 61; sma[i] = 55; }
  }
  if (opts.laterOpposite){
    /* a bear cross AFTER the bull cross: prev>=smaPrev && now<sma on n-2 */
    rsi[n - 2] = 56; sma[n - 2] = 54;   /* above */
    rsi[n - 1] = 50; sma[n - 1] = 53;   /* crossed down on the last bar */
  }
  return { rsi, sma };
}

console.log('== 1) RSI window boundaries (pure rule, explicit series) ==');
{
  for (const age of [0, 1, 2]){
    const s = mkSeries({ age });
    const r = W.ngRsiWindowFromSeries(s.rsi, s.sma);
    assert(r.bullCrossWin === true && r.bullCrossAge === age,
      'up-cross ' + age + ' bars ago, still held -> window LIVE with age recorded (' + r.bullCrossAge + ')');
    assert(r.bearCrossWin === false, '...and the bear window stays dead');
  }
  const s3 = mkSeries({ age: 3 });
  const r3 = W.ngRsiWindowFromSeries(s3.rsi, s3.sma);
  assert(r3.bullCrossWin === false && r3.bullCrossAge === null
      && r3.lastCross && r3.lastCross.dir === 'up' && r3.lastCross.barsAgo === 3,
    'up-cross 3 bars ago is OUTSIDE the <=3-bar window (ages 0..2) — context kept, trigger dead');
  const sh = mkSeries({ age: 2, hold: false });
  const rh = W.ngRsiWindowFromSeries(sh.rsi, sh.sma);
  assert(rh.bullCrossWin === false,
    'a cross inside the window whose side is NOT held now does not trigger (still-held guard)');
  const so = mkSeries({ age: 2, laterOpposite: true });
  const ro = W.ngRsiWindowFromSeries(so.rsi, so.sma);
  assert(ro.bullCrossWin === false && ro.lastCross && ro.lastCross.dir === 'down',
    'a more recent OPPOSITE cross kills the bull window (most-recent-cross rule)');
  assert(ro.bearCrossWin === true && ro.bearCrossAge === 0,
    '...and legitimately opens the bear window at age 0');
  const rg = W.ngRsiWindowFromSeries(null, undefined);
  assert(rg.bullCrossWin === false && rg.bearCrossWin === false && rg.lastCross === null,
    'garbage series -> all windows dead, never throws');
}

console.log('== 2) FVG near-edge rule (pure rule, DIAL-AWARE — expectations from W.NG_LOOSEN) ==');
{
  const DIAL = W.NG_LOOSEN.fvgEdgeAtr;
  assert(isFinite(DIAL) && DIAL >= 0, 'shipped dial readable from W.NG_LOOSEN (fvgEdgeAtr=' + DIAL + ')');
  /* hg-v702 measured dial: the 0.25 trial replay put every edge-tag cohort
     NEGATIVE (edge-only n=17 −0.29, window+edge n=41 −0.24 net at XM) while
     inside-the-zone windowed fires ran n=9 +0.58 — the dial shipped at 0.
     These asserts compute from the dial so a future re-raise re-tests the
     tolerance math instead of failing on a stale pin. */
  const fvgs = { bullTop: 4002, bullBot: 4000, bearTop: 4020, bearBot: 4018 };
  const atr = 4;
  const tol = DIAL * atr;
  let r = W.ngFvgNearFrom(fvgs, 4001, atr);
  assert(r.inBull === true && r.nearBull === true && r.bullEdgeAtr === 0,
    'close INSIDE the bull gap -> near read live with edge distance 0 (the strict read always fires)');
  r = W.ngFvgNearFrom(fvgs, 4002 + Math.max(tol * 0.9, 0.9), atr);
  if (DIAL > 0){
    assert(r.inBull === false && r.nearBull === true && isFinite(r.bullEdgeAtr) && r.bullEdgeAtr <= DIAL + 1e-9,
      'close inside the tolerance band above the near edge -> edge tag LIVE, distance recorded');
  } else {
    assert(r.inBull === false && r.nearBull === false && !isFinite(r.bullEdgeAtr),
      'dial 0: a close above the zone NEVER edge-tags — inside-only (the measured-negative tag is off)');
  }
  r = W.ngFvgNearFrom(fvgs, 4002 + tol + 0.2, atr);
  assert(r.nearBull === false, 'beyond the tolerance band never tags (dial ' + DIAL + ')');
  r = W.ngFvgNearFrom(fvgs, 3999.5, atr);
  assert(r.nearBull === false,
    'the FAR (stop) side never counts — a close below bullBot is not a tag');
  r = W.ngFvgNearFrom(fvgs, 4018 - Math.max(tol * 0.9, 0.9), atr);
  if (DIAL > 0){
    assert(r.inBear === false && r.nearBear === true && isFinite(r.bearEdgeAtr) && r.bearEdgeAtr <= DIAL + 1e-9,
      'short mirror: a close inside the band below bearBot tags the bear zone');
  } else {
    assert(r.inBear === false && r.nearBear === false,
      'short mirror at dial 0: below bearBot never tags — inside-only');
  }
  r = W.ngFvgNearFrom(fvgs, 4021, atr);
  assert(r.nearBear === false, 'short mirror far side (above bearTop) never counts');
  r = W.ngFvgNearFrom(fvgs, 4002.9, NaN);
  assert(r.nearBull === false,
    'NO readable ATR -> tolerance 0 regardless of dial: the edge tag cannot fire (fail closed)');
  r = W.ngFvgNearFrom(fvgs, 4001, NaN);
  assert(r.inBull === true && r.nearBull === true && r.bullEdgeAtr === 0,
    'no-ATR inside-the-gap still reads (the strict path is never loosened away)');
  r = W.ngFvgNearFrom(null, 4001, atr);
  assert(r.nearBull === false && r.nearBear === false, 'garbage fvgs -> dead, never throws');
}

console.log('== 3) loosened honesty text on confirmations (handcrafted setup) ==');
{
  const mk = (loosened) => ({
    dir: 'long', kind: 'TRIPLE-CONF',
    fvg: { top: 4002, bot: 4000, ageBars: 6, mitigationChecked: true },
    ml: { baseline: 3990, regime: 'bullish' },
    rsi: { now: 58, sma: 54 },
    loosened
  });
  const conf1 = W.ngConfirmations(mk({ rsiCrossAge: 2, fvgEdgeAtr: null, used: true }), 'long',
    { rows: [], tape: { dir: '', src: '' } });
  const rsiDetail = (conf1.find(x => /RSI\(14\)/.test(x.name)) || {}).detail || '';
  assert(/cross 2 bars ago, still held \(loosened window ≤ 3 bars, hg-v702\)/.test(rsiDetail),
    'windowed-cross fire PRINTS its age + the loosened window (v536: labels print what happened)');
  const conf2 = W.ngConfirmations(mk({ rsiCrossAge: 0, fvgEdgeAtr: 0.18, used: true }), 'long',
    { rows: [], tape: { dir: '', src: '' } });
  const stDetail = (conf2.find(x => x.cls === 'structure' && /FVG/.test(x.name)) || {}).detail || '';
  const edgeRe = new RegExp('edge tag 0\\.18 ATR outside the zone \\(loosened window ≤ '
    + String(W.NG_LOOSEN.fvgEdgeAtr).replace('.', '\\.') + ' ATR, hg-v702\\)');
  assert(edgeRe.test(stDetail),
    'edge-tag honesty text prints the distance + the SHIPPED tolerance (dial-aware)');
  const conf3 = W.ngConfirmations(mk({ rsiCrossAge: 0, fvgEdgeAtr: 0, used: false }), 'long',
    { rows: [], tape: { dir: '', src: '' } });
  const strict = conf3.map(x => x.detail || '').join(' | ');
  assert(!/loosened/.test(strict),
    'a strict same-bar inside-zone fire prints NO loosened text — nothing claimed that did not happen');
}

console.log('== 4) ngLegRead wiring: the pure rules are what the reader publishes ==');
{
  /* one deterministic tape: flat then a gap-up FVG; assert the fvg fields on
     ngLegRead equal ngFvgNearFrom recomputed from the reader's OWN inputs —
     wiring identity, no fixture cleverness needed. */
  const rows = [];
  const t0 = Math.floor(Date.UTC(2026, 2, 9, 0, 0, 0) / 1000);
  let c = 4000;
  for (let i = 0; i < 70; i++){ const o = c; c += 0.5; rows.push({ t: t0 + i * 3600, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1200 }); }
  rows.push({ t: t0 + 70 * 3600, o: c, h: c + 0.5, l: c - 0.4, c: c + 0.2, v: 1200 }); c += 0.2;
  rows.push({ t: t0 + 71 * 3600, o: c, h: c + 3.0, l: c - 0.1, c: c + 2.8, v: 2000 }); c += 2.8;
  rows.push({ t: t0 + 72 * 3600, o: c, h: c + 1.0, l: c - 0.4, c: c + 0.8, v: 1500 }); c += 0.8;
  const leg = W.ngLegRead(rows);
  assert(leg.ok === true, 'leg read ok on the wiring tape');
  const fvgs = W.ngDetectLastFvgs(rows);
  const re = W.ngFvgNearFrom(fvgs, leg.lastClose, leg.atr);
  assert(leg.fvg.inBull === re.inBull && leg.fvg.nearBull === re.nearBull
      && ((isNaN(leg.fvg.bullEdgeAtr) && isNaN(re.bullEdgeAtr)) || leg.fvg.bullEdgeAtr === re.bullEdgeAtr),
    'ngLegRead.fvg fields === ngFvgNearFrom recomputed from the reader\'s own inputs (single source)');
  assert(typeof leg.rsi.bullCrossWin === 'boolean' && 'bullCrossAge' in leg.rsi,
    'ngLegRead.rsi carries the windowed fields from ngRsiWindowFromSeries');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
