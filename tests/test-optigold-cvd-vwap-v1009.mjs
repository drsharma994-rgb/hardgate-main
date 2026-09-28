/* HARDGATE — hg-v1009: the confirmation floor's FOURTH and FIFTH families.

   Run: node tests/test-optigold-cvd-vwap-v1009.mjs

   v1006 floored OPTI GOLD's breaks at two-of-three independent families —
   volume, momentum, trend — all read off the same OHLCV tape. This pack adds
   the two families that are NOT another read of the same closes:

     VWAP (family 4) — indicators.js's vwapAt/vwapReclaim, unused on gold
       until now. The STATE read: the break bar's close beyond the rolling
       VWAP-20 on the break's side. Deliberately not the reclaim EVENT —
       counting "no reclaim printed" as failure would penalise the strong
       trend breaks that never pierce the mean. When a reclaim DID print the
       note says so. UNCHECKED where the tape has no usable volume (vwapAt's
       NaN), the same legs where family 1 stands aside.

     CVD (family 5) — omniroute.js's hgOmniCvd, REAL Binance taker flow
       ONLY. The candle-approximated stand-in is derived from the same
       closes the momentum family already reads, so it is not independent
       evidence and does not count. The taker series is sliced at the break
       bar (window stamps <= the bar's open) before the read — a break 200
       bars back is judged on the flow that existed THEN, never on windows
       that had not printed. UNCHECKED without a series, with fewer than 10
       readable windows, or when the read falls back to candles.

   The bar is exactly where v1006 put it: two CHECKED families. What widened
   is the evidence. Every number below was derived by running the real
   indicators on the real tapes (scratch probe, same constructions as
   test-optigold-confirmation-v1006.mjs), never asserted blind. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok —', m); }
                       else { failed++; console.error('  FAIL —', m); } };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'omniroute.js', 'optigold.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

/* the v1006 tapes, byte-identical constructions */
const PAT = [0.45, -0.4, 0.5, -0.5, 0.45];
function upTape(){
  const rows = []; let t = 1700000000, c = 100;
  const bar = (o, h, l, cl, v) => rows.push({ t: (t += 3600), o, h, l, c: cl, v });
  for (let i = 0; i < 55; i++){ const d = PAT[i % 5]; const o = c; c = c + d;
    bar(o, Math.max(o, c) + 0.25, Math.min(o, c) - 0.25, c, i % 2 ? 95 : 105); }
  const o = c; c = c + 0.8; bar(o, c + 0.4, o - 0.3, c, 420);
  return rows;
}
function counterTape(){
  const rows = []; let t = 1700000000, c = 160;
  const bar = (o, h, l, cl, v) => rows.push({ t: (t += 3600), o, h, l, c: cl, v });
  for (let i = 0; i < 55; i++){ const d = -PAT[i % 5]; const o = c; c = c + d;
    bar(o, Math.max(o, c) + 0.25, Math.min(o, c) - 0.25, c, i % 2 ? 90 : 120); }
  const o = c; c = c + 1.1; bar(o, c + 0.4, o - 0.3, c, 85);
  return rows;
}
/* the break bar (i=55) opened at t = 1700000000 + 56*3600 — the tapes stamp
   t AFTER incrementing. A taker window whose stamp EQUALS the bar's open is
   the flow of the bar that broke, known at its close: the inclusive edge. */
const BREAK_T = 1700000000 + 56 * 3600;
function taker(ratio, n, endT){
  const s = [];
  for (let k = n - 1; k >= 0; k--) s.push({ buySellRatio: ratio, t: endT - k * 3600 });
  return { latest: s[s.length - 1], series: s };
}

const W = boot();
const R = (...a) => (typeof W.__ogConfirmRead === 'function') ? W.__ogConfirmRead(...a) : null;
const CH = (s) => (typeof W.__ogConfirmChipHtml === 'function') ? W.__ogConfirmChipHtml(s) : '';

console.log('== family 4, VWAP: the break must HOLD the volume-weighted mean ==');
{
  const r = R(upTape(), { dir: 'long', i: 55 });
  ok(r && r.vwap && r.vwap.ok === true && isFinite(r.vwap.val),
    'the constructed break holds above the rolling VWAP-20');
  ok(r.vwap.note.indexOf('sits behind the break') >= 0, 'the note says the mean is behind the break');
  ok(r.verdict === 'confirmed' && r.checked === 4 && r.agree === 4,
    'and the floor answers CONFIRMED 4/4 without any taker series (CVD stands aside)');

  /* a reclaim printed: bar 53 wicks five deep through the mean — the note
     must name the stronger form of the same evidence */
  const rc = upTape(); rc[53].l = rc[53].c - 5;
  const r2 = R(rc, { dir: 'long', i: 55 });
  ok(r2 && r2.vwap && r2.vwap.ok === true && /probed and defended/.test(r2.vwap.note),
    'a reclaim into the break is named: the mean was probed and defended');

  /* the state read does NOT punish a clean trend break for never piercing */
  ok(r.vwap.ok === true && !/no reclaim/.test(r.vwap.note || ''),
    'no reclaim printed and the family still backs the break — the event\'s absence is not a failure');

  const ct = R(counterTape(), { dir: 'long', i: 55 });
  ok(ct && ct.vwap && ct.vwap.ok === true && ct.verdict === 'unconfirmed' && ct.agree === 1,
    'the countertrend bounce DID reclaim the mean — one genuine family — and one of four still blocks (UNCONFIRMED 1/4)');

  const nv = R(upTape().map(x => Object.assign({}, x, { v: 0 })), { dir: 'long', i: 55 });
  ok(nv && nv.vwap === null && nv.checked === 2 && nv.verdict === 'confirmed',
    'a volume-less tape leaves VWAP UNCHECKED beside family 1 — degradation identical to v1006');
}

console.log('\n== family 5, CVD: real taker flow, sliced at the break bar ==');
{
  const bull = taker(1.25, 40, BREAK_T);            /* buyers lifting offers through the break */
  const r = R(upTape(), { dir: 'long', i: 55 }, { taker: bull });
  ok(r && r.cvd && r.cvd.ok === true && r.cvd.val > 0,
    'taker flow running WITH the break backs it');
  ok(/Binance taker flow over 30 windows to the break bar/.test(r.cvd.note),
    'the note names the source and the window count (hgOmniCvd\'s own 30)');
  ok(r.verdict === 'confirmed' && r.checked === 5 && r.agree === 5, 'five of five — the full board');

  const bear = taker(0.8, 40, BREAK_T);             /* the crowd filled the other side */
  const r2 = R(upTape(), { dir: 'long', i: 55 }, { taker: bear });
  ok(r2 && r2.cvd && r2.cvd.ok === false && /AGAINST/.test(r2.cvd.note),
    'flow running against the break refuses, and names it');
  ok(r2.verdict === 'confirmed' && r2.agree === 4, 'one refusing family still never vetoes alone (4/5)');

  /* THE POINT OF THE PACK: the countertrend break the original three
     families refused outright now CONFIRMS when the mean was reclaimed AND
     real flow backs it — the evidence widened, the bar did not move */
  const ct = R(counterTape(), { dir: 'long', i: 55 }, { taker: bull });
  ok(ct && ct.verdict === 'confirmed' && ct.checked === 5 && ct.agree === 2
      && ct.cvd.ok === true && ct.vwap.ok === true
      && ct.vol.ok === false && ct.mom.ok === false && ct.trend.ok === false,
    'VWAP + real CVD carry the countertrend break to 2/5 — the two new families earn their place');
}

console.log('\n== causality and honesty of the flow read ==');
{
  /* every window stamped AFTER the break bar: the flow did not exist when
     the break printed, so the family must stand aside entirely */
  const fut = taker(1.25, 40, BREAK_T + 41 * 3600);
  const r = R(upTape(), { dir: 'long', i: 55 }, { taker: fut });
  ok(r && r.cvd === null && r.checked === 4 && r.verdict === 'confirmed',
    'windows that had not printed at the break are never read — the family stands aside');

  ok(R(upTape(), { dir: 'long', i: 55 }, { taker: taker(1.25, 5, BREAK_T) }).cvd === null,
    'fewer than hgOmniCvd\'s own 10 readable windows is a guess wearing a number — UNCHECKED');
  ok(R(upTape(), { dir: 'long', i: 55 }, { taker: { series: [] } }).cvd === null
      && R(upTape(), { dir: 'long', i: 55 }, { taker: null }).cvd === null
      && R(upTape(), { dir: 'long', i: 55 }, {}).cvd === null
      && R(upTape(), { dir: 'long', i: 55 }).cvd === null,
    'empty / null / absent / no-third-arg: no series, no family — and old callers behave exactly as v1006 did');

  /* junk ratios: hgOmniCvd falls back to its candle stand-in when fewer
     than 4 windows read — and the candle stand-in is NOT an independent
     family here, so the family stands aside even though a number existed */
  const junk = taker(0, 40, BREAK_T);
  ok(R(upTape(), { dir: 'long', i: 55 }, { taker: junk }).cvd === null,
    'junk ratios fall back to candles, and the candle stand-in does not count — independence is the rule');

  /* the independence rule again, from the other side: NO taker series at
     all means no CVD family, even though hgOmniCvd could approximate one
     from the candles the momentum family already read */
  ok(R(upTape(), { dir: 'long', i: 55 }).cvd === null,
    'candle-approximated CVD never counts — it is the same closes momentum already read');

  /* ms-stamped bars: the reader normalises to the taker series' seconds */
  const msTape = upTape().map(x => Object.assign({}, x, { t: x.t * 1000 }));
  const rm = R(msTape, { dir: 'long', i: 55 }, { taker: taker(1.25, 40, BREAK_T) });
  ok(rm && rm.cvd && rm.cvd.ok === true, 'ms bars align with the seconds-stamped flow — the house convention');

  /* a stale break is judged on the flow of THEN: series that turns bullish
     only AFTER the break bar must not back it */
  const late = taker(0.8, 40, BREAK_T).series
    .map(w => w.t > BREAK_T - 5 * 3600 ? { buySellRatio: 1.3, t: w.t } : w);
  /* windows <= BREAK_T: 36 bearish then the last 5 bullish — hgOmniCvd reads
     the last 30, so the flow at the break is mixed-to-bearish; the honest
     check is that the post-break windows never entered the read at all */
  const rl = R(upTape(), { dir: 'long', i: 55 }, { taker: { series: late } });
  ok(rl && rl.cvd && rl.cvd.ok === false, 'the read ends at the break bar — a late flip in flow does not rescue it');
}

console.log('\n== the floor\'s contract is untouched ==');
{
  ok(CH({ confirm: { verdict: 'unverified', agree: 0, checked: 1 } }).indexOf('CONF UNCHECKED — 1/5 readable') >= 0,
    'the unchecked chip counts against five families now');
  const s = { state: 'waiting', lane: 'scalp', dir: 'long', entry: 99, stop: 94, t1: 109,
              risk: 5, rr: 2, atr: 2, barsLeft: 30,
              confirm: { verdict: 'unconfirmed', agree: 1, checked: 5 } };
  const clean = { state: 'waiting', lane: 'scalp', dir: 'long', entry: 99.5, stop: 94.5, t1: 109.5,
                  risk: 5, rr: 2, atr: 2, barsLeft: 30 };
  const picks = W.__ogTopPicks([s, clean], 100);
  ok(picks.scalp && picks.scalp.setup === clean,
    'an UNCONFIRMED 1/5 loses the slot exactly as an UNCONFIRMED 1/3 did — the predicate reads the verdict, not the count');
  ok(typeof W.__ogConfirmRead === 'function' && typeof W.__ogConfirmBlocked === 'function'
      && typeof W.__ogConfirmChipHtml === 'function',
    'the v1006 seams are the same seams — no parallel copies');
}

console.log('\n== wiring pins — the shipped source, not a copy ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/var OG_VWAP_LOOK = 20;/.test(src) && /var OG_CVD_LOOK = 30;/.test(src) && /var OG_CVD_MIN_WIN = 10;/.test(src),
    'the three family parameters are the house primitives\' own — reused, not refit');
  ok(/got\.source === 'binance-xau'\) \? 'XAUUSDT'/.test(src) && /got\.source === 'binance-paxg'\) \? 'PAXGUSDT'/.test(src),
    'only the Binance gold perp feeds earn a taker fetch, by macro.js\'s own source labels');
  ok(/ogTaker = await ogTkFn\(ogTkSym, L\.interval, 500\)/.test(src),
    'the fetch is per lane, on the lane\'s own interval, 500 windows deep — and cached by binance.js');
  ok(/s\.confirm = ogConfirmRead\(rows, s, \{ taker: ogTaker \}\)/.test(src),
    'the scan hands the series to the reader — which slices it at the break bar itself');
  ok(/of 5 families readable/.test(src) && /'\/5 readable'/.test(src.replace(/\\/g, '')) || /5 readable/.test(src),
    'the head line and the chip both count against five');
  ok(/hg-v1009: the confirmation floor grows its fourth and fifth families/.test(src),
    'the file header documents the pack');
  ok(!/agreeN >= 3/.test(src) && /agreeN >= 2/.test(src),
    'the bar is EXACTLY where v1006 put it — two checked families, never refit to three');
}

console.log('\ntest-optigold-cvd-vwap-v1009: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
