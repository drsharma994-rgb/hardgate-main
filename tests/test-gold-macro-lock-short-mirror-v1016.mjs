/* HARDGATE — hg-v1016: the gold macro conviction lock ran LONG-ONLY, and the
   mirror it never ran is the same trade in the other direction.

   hgGoldMacroLock stands a gold LONG down when the dollar and the 10-year are
   both bullish — that is hg-v553's rule, hg-v966's rule-in-force. A gold
   SHORT was never evaluated at all: `if (dir !== 'long') return out;`. But a
   dollar and a 10-year both BEARISH is a gold tailwind, and a short minted
   into it fights exactly the tape the long is protected from. The one-sided
   guard protected one direction from a macro fight and waved the other into
   it.

   THE MIRROR IS A TIGHTENING, and it is built out of the same pieces rather
   than a second rule: hgGoldMacroLeg now derives a BEAR verdict from the SAME
   read that decided the bull one (FALLING under the 20-day band, below EMA50
   under the lever, band fallback included), FLAT stays a NON-VERDICT both
   ways — "not rising" is not "falling", and a mirror that fired on FLAT would
   lock shorts the desk never agreed to lock, the same unmeasured change
   hg-v966 refused for longs — both legs must agree, and missing feeds fail
   open exactly as the long side always has. The long path is byte-identical;
   the reason string a short dies with names the bearish tape and the read
   that decided it, and the note (hg-v966's reader) speaks for the side the
   lock evaluated. One fix, every desk: the lock is shared by GOLD SCALP,
   GOLD SWING and the three borrowing desks through hgGoldInstFilter.

   Covers:
     1) the leg: bear verdicts off the same read, FLAT a non-verdict
     2) the short lock on the rule in force, and the mirrored reason
     3) ANTI-OVERFIRE: a bullish tape, a mixed tape, FLAT and absence lock NO short
     4) the ema50 lever mirrors, band fallback included
     5) the alt-rule measurement is side-aware and survives the unchecked return
     6) the note speaks short; a verdict-less object and a pre-v1016 record
     7) the throw path fails open, and a junk direction is not evaluated
     8) the LONG side is byte-identical — the mirror changes nothing it protected
     9) the REAL filter: hgGoldInstFilter drops a short with the mirrored reason
 Run: node tests/test-gold-macro-lock-short-mirror-v1016.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
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
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported below */ }
  }
  return ctx;
}
const GI = ['indicators.js', 'indicators2.js', 'goldind.js'];

/* a close-only series, as a macro index genuinely is (same fixtures as the
   hg-v966 rule test) */
function ser(step, n){ const r = []; let c = 100; for (let i = 0; i < n; i++){ c += step; r.push({ t: i, c: +c.toFixed(4) }); } return r; }
const UP = ser(0.5, 85), DOWN = ser(-0.5, 85);
const JUNK = Array.from({ length: 60 }, (_, i) => ({ t: i, c: NaN }));

/* candle rows for the real filter (same generator shape as test-gold-inst-gates) */
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

console.log('== 1) the leg: bear verdicts off the same read, FLAT a non-verdict ==');
{
  const W = boot(GI);
  assert(typeof W.hgGoldMacroLeg === 'function', 'hgGoldMacroLeg is exported');
  const falling = W.hgGoldMacroLeg(null, 'FALLING');
  assert(falling.bull === false && falling.bear === true && falling.bearVia === 'trend20',
         'a FALLING band is a BEAR verdict by the 20-day trend band');
  const rising = W.hgGoldMacroLeg(null, 'RISING');
  assert(rising.bull === true && rising.bear === false && rising.bearVia === 'trend20',
         'a RISING band is NOT bear — the mirror does not fire on the long side\'s tailwind');
  const flat = W.hgGoldMacroLeg(null, 'FLAT');
  assert(flat.bull === null && flat.bear === null && flat.bearVia === 'none',
         'FLAT is a NON-VERDICT both ways — "not rising" is not "falling"');
  const absent = W.hgGoldMacroLeg(null, null);
  assert(absent.bear === null && absent.altBear === null,
         'and an absent read is no bear verdict either — never a guessed false');
  /* under the LEVER the bear comes off the level test, band fallback included */
  W.HG_GOLD_MACRO_RULE = 'ema50';
  const below = W.hgGoldMacroLeg(DOWN, null);
  assert(below.bear === true && below.bearVia === 'ema50',
         'the ema50 lever: below the level test is bear by EMA50');
  const fellBack = W.hgGoldMacroLeg(JUNK, 'FALLING');
  assert(fellBack.bear === true && fellBack.bearVia === 'trend20',
         'and an unreadable series falls back to the band for the bear verdict too — a corrupt feed refuses nothing the other feed answers');
  const altBear = W.hgGoldMacroLeg(DOWN, 'RISING');
  assert(altBear.bearVia === 'ema50' && altBear.alt === true && altBear.altBear === false,
         'altBear is the OTHER rule\'s bear verdict: below EMA50 but RISING, the band would NOT call it bear');
  W.HG_GOLD_MACRO_RULE = undefined;
}

console.log('== 2) the short lock on the rule in force, and the mirrored reason ==');
{
  const W = boot(GI);
  const m = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  assert(m.lock === true && m.dir === 'short' && m.unchecked === false,
         'DXY FALLING + TNX FALLING stands a gold SHORT down — the mirror of the long kill');
  assert(/CONVICTION LOCK — DXY\+TNX bearish vs gold short/.test(m.reason),
         'and the reason the candidate dies with names the BEARISH tape and the SHORT it killed (' + m.reason + ')');
  assert(/DXY by 20-day trend band/.test(m.reason) && /TNX by 20-day trend band/.test(m.reason),
         'and it names the read that decided each leg, as the long reason always has');
  assert(m.dxyBear === true && m.tnxBear === true && m.dxyBearVia === 'trend20' && m.tnxBearVia === 'trend20',
         'the record carries the bear verdicts and which read produced them');
  assert(m.dxyBull === false && m.tnxBull === false,
         'and the bull fields still say what the tape is — not bullish — one leg, both reads');
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/if \(dir !== 'long' && dir !== 'short'\) return out;/.test(src),
         'the guard in source now evaluates BOTH directions');
  assert(!/if \(dir !== 'long'\) return out;/.test(src),
         'and the long-only guard is GONE — that was the defect, and it does not come back silently');
  assert(/out\.reason = 'CONVICTION LOCK — DXY\+TNX bearish vs gold short'/.test(src),
         'the short reason string is in source beside the long one');
}

console.log('== 3) ANTI-OVERFIRE: bullish, mixed, FLAT and absent lock NO short ==');
{
  const W = boot(GI);
  const bullTape = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(bullTape.lock === false && bullTape.dxyBear === false && bullTape.tnxBear === false,
         'a both-BULLISH tape locks no short — the mirror fires on bearish, not on "not bearish"');
  const mixed = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING' } });
  assert(mixed.lock === false, 'one leg bearish is not a lock — the both-legs bar is the long side\'s own bar');
  const mixed2 = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'FALLING' } });
  assert(mixed2.lock === false, 'and the other way around');
  const flat = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(flat.lock === false && flat.unchecked === true,
         'FLAT + FLAT fails OPEN — a flat tape is no verdict, never a short kill');
  const half = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FLAT' } });
  assert(half.lock === false && half.unchecked === false,
         'one bearish leg with the other FLAT: no lock, and it is not "unchecked" — the FLAT leg answered, and its answer was no verdict');
  const missing = W.hgGoldMacroLock('short', {});
  assert(missing.lock === false && missing.unchecked === true,
         'missing DXY/TNX fail open for shorts exactly as they always did for longs');
  /* and through the level test under the lever: above EMA50 is not bearish */
  W.HG_GOLD_MACRO_RULE = 'ema50';
  const above = W.hgGoldMacroLock('short', { dxyRows: UP, tnxRows: UP });
  W.HG_GOLD_MACRO_RULE = undefined;
  assert(above.lock === false && above.dxyBear === false,
         'under the lever, both ABOVE EMA50 locks no short either');
}

console.log('== 4) the ema50 lever mirrors ==');
{
  const W = boot(GI);
  W.HG_GOLD_MACRO_RULE = 'ema50';
  const m = W.hgGoldMacroLock('short', { dxyRows: DOWN, tnxRows: DOWN });
  assert(m.lock === true && m.dxyBearVia === 'ema50' && m.tnxBearVia === 'ema50',
         'both series below EMA50 lock the short by the level test');
  assert(/bearish vs gold short \(DXY by EMA50 level, TNX by EMA50 level\)/.test(m.reason),
         'and the reason names the level test for both legs (' + m.reason + ')');
  const fellBack = W.hgGoldMacroLock('short', { dxyRows: JUNK, tnxRows: JUNK,
    macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  assert(fellBack.lock === true && fellBack.dxyBearVia === 'trend20',
         'a corrupt series falls back to the band for the short kill too, rather than refusing');
  const oneLeg = W.hgGoldMacroLock('short', { dxyRows: DOWN, tnxRows: UP });
  assert(oneLeg.lock === false, 'only one leg below EMA50 does not lock');
  W.HG_GOLD_MACRO_RULE = undefined;
}

console.log('== 5) the alt-rule measurement is side-aware and survives the unchecked return ==');
{
  const W = boot(GI);
  /* the band silent, the level test clearly bearish: the mirror of the case
     the hg-v966 test drives for longs — the rules are furthest apart exactly
     here, and an early return would throw the measurement away */
  const m = W.hgGoldMacroLock('short', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(m.unchecked === true && m.lock === false,
         'the band cannot answer, so the short verdict is UNCHECKED — fail open, as the long side');
  assert(m.altLock === true && m.altAgrees === false,
         'and the measurement is STILL captured for the SHORT side — the level test WOULD have locked, computed before the unchecked return');
  /* side-awareness: on the same feeds the LONG's alt number is the opposite
     question — altLock for a long asks whether both legs are bullish */
  const l = W.hgGoldMacroLock('long', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(l.altLock === false,
         'the SAME feeds report altLock false for a long — the measurement answers this side\'s question, not one question for both');
  const agree = W.hgGoldMacroLock('short', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  assert(agree.lock === true && agree.altLock === true && agree.altAgrees === true,
         'and when both reads say bearish they agree on the short too — the reporter is not stuck on "disagree"');
}

console.log('== 6) the note speaks short; a verdict-less object and a pre-v1016 record ==');
{
  const W = boot(GI);
  const locked = W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  const n1 = W.hgGoldMacroLockNote(locked);
  assert(/MACRO LOCK — the dollar and the 10-year are both bearish against a gold short/.test(n1),
         'a short lock note names the bearish tape and the gold short');
  assert(/20-day trend band/.test(n1) && !/EMA50 level/.test(n1),
         'and names the read that decided, without claiming one it did not make');
  const okShort = W.hgGoldMacroLockNote(W.hgGoldMacroLock('short', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING' } }));
  assert(/MACRO OK — the dollar and the 10-year are not both bearish against a gold short/.test(okShort),
         'an unlocked short gets MACRO OK in short language');
  const unch = W.hgGoldMacroLockNote(W.hgGoldMacroLock('short', {}));
  assert(/MACRO UNCHECKED/.test(unch) && /gold-short lock/.test(unch) && /fail open/.test(unch),
         'and an unreadable macro says so for the short side, naming that it fails open');
  assert(W.hgGoldMacroLockNote({ dir: 'short', unchecked: false, dxyBear: null, tnxBear: null }) === '',
         'a short-side object with NO verdict renders nothing — never a zero-filled line');
  /* a pre-v1016 record carries no dir and is the long it always was */
  const legacy = W.hgGoldMacroLockNote({ lock: true, dxyBull: true, tnxBull: true, dxyVia: 'trend20', tnxVia: 'trend20' });
  assert(/bullish against a gold long/.test(legacy),
         'a pre-v1016 record (no dir) renders as the long it always was — old ledger rows stay true');
  /* and the disagreement sentence works per side */
  const dis = W.hgGoldMacroLockNote(W.hgGoldMacroLock('short', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } }));
  assert(dis === '' || /MACRO UNCHECKED/.test(dis),
         'an unchecked short note is the UNCHECKED line, not an OK line about reads never made');
  const dis2 = W.hgGoldMacroLock('short', { dxyRows: UP, tnxRows: UP,
    macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  const n2 = W.hgGoldMacroLockNote(dis2);
  assert(/other rule in this file disagrees/.test(n2) && /NOT measured here/.test(n2),
         'a disagreement on the short side is named, and the note still refuses to say which rule is better');
}

console.log('== 7) the throw path fails open, and a junk direction is not evaluated ==');
{
  const W = boot(GI);
  const bomb = { get macro(){ throw new Error('boom'); } };
  const m = W.hgGoldMacroLock('short', bomb);
  assert(m.lock === false && m.unchecked === true,
         'a throwing context fails OPEN for a short — never a fabricated lock');
  for (const d of [undefined, null, '', 'flat', 'LONG', 'Short', 'longs']){
    const r = W.hgGoldMacroLock(d, { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
    assert(r.lock === false && r.unchecked === false && r.dir === null,
           'direction "' + d + '" is not evaluated at all — only the two real sides');
  }
}

console.log('== 8) the LONG side is byte-identical — the mirror changes nothing it protected ==');
{
  const W = boot(GI);
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/out\.reason = 'CONVICTION LOCK — DXY\+TNX bullish vs gold long'/.test(src),
         'the long reason string in source is byte-identical to hg-v966\'s');
  const locked = W.hgGoldMacroLock('long', { macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(locked.lock === true && locked.dir === 'long'
      && /CONVICTION LOCK — DXY\+TNX bullish vs gold long \(DXY by 20-day trend band, TNX by 20-day trend band\)/.test(locked.reason),
         'a both-bullish tape still locks the long with exactly the old reason');
  const bearTape = W.hgGoldMacroLock('long', { macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  assert(bearTape.lock === false,
         'and the SYMMETRIC anti-overfire: a both-bearish tape locks no long — it is the long\'s tailwind');
  const note = W.hgGoldMacroLockNote(locked);
  assert(/MACRO LOCK — the dollar and the 10-year are both bullish against a gold long\. Read by DXY 20-day trend band and TNX 20-day trend band\./.test(note),
         'the long note is byte-identical too');
  const unch = W.hgGoldMacroLockNote(W.hgGoldMacroLock('long', {}));
  assert(/gold-long lock/.test(unch), 'and the long UNCHECKED line still says gold-long');
}

console.log('== 9) the REAL filter: hgGoldInstFilter drops a short with the mirrored reason ==');
{
  const W = boot(GI);
  const rows = bars(80, 2400, 900, 9);
  const tNY = Date.UTC(2024, 0, 16, 14, 0, 0); /* NY overlap — the session gate passes */
  const cand = () => ({ stratKey: 'vwap', dir: 'short', id: 'vwap|short|2400', strategy: 'VWAP', stamps: [], gateNotes: [] });
  const droppedShort = W.hgGoldInstFilter(cand(), {
    rows: rows, nowMs: tNY, scalp: true,
    macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' }
  });
  assert(droppedShort.dropped === true && /CONVICTION LOCK — DXY\+TNX bearish vs gold short/.test(droppedShort.reason || ''),
         'the shared institutional filter DROPS a gold short into a both-bearish dollar/yield tape (' + (droppedShort.reason || '') + ')');
  assert(droppedShort.macroLock && droppedShort.macroLock.lock === true && droppedShort.macroLock.dir === 'short',
         'and the cand carries the macroLock record naming the side');
  /* the same short on a both-BULLISH tape: the macro gate passes it, exactly
     as before the mirror — the live-feed parity pins keep this honest */
  const passedShort = W.hgGoldInstFilter(cand(), {
    rows: rows, nowMs: tNY, scalp: true,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' }
  });
  assert(passedShort.macroLock && passedShort.macroLock.lock === false
      && !/CONVICTION LOCK/.test(passedShort.reason || ''),
         'the same short on a both-bullish tape is NOT touched by the macro gate — the mirror only ever fires on the tape the short fights');
  /* and the long through the same filter still dies on the bullish tape */
  const droppedLong = W.hgGoldInstFilter(
    { stratKey: 'vwap', dir: 'long', id: 'vwap|long|2400', strategy: 'VWAP', stamps: [], gateNotes: [] },
    { rows: rows, nowMs: tNY, scalp: true,
      macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(droppedLong.dropped === true && /CONVICTION LOCK — DXY\+TNX bullish vs gold long/.test(droppedLong.reason || ''),
         'and the long path through the same filter is untouched — bullish tape still kills it');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD MACRO LOCK SHORT-MIRROR TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
