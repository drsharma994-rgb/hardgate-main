/* HARDGATE — the forward log has never checked whether the order filled.

   hgFwdSettleOne walks the bars after barT and tests stop and target
   immediately. Nothing requires price to have reached `entry`. The
   in-sample walk DOES require a fill and drops 17.8% of its signals as
   never triggered, and measured-edge then compares the two pools sigma
   against sigma.

   The error is not noise, it is geometry, and it runs one way per order
   type because one side of the plan always sits past the entry:

     entry BELOW mark (a long limit)
       the stop is beyond the entry, so a loss cannot be booked without
       filling — but the target is not, so a WIN can be booked for a trade
       that never opened.

     entry ABOVE mark (a long stop entry)
       the mirror: wins are real, and phantom LOSSES are booked instead.

   Limits are about two thirds of this desk's book, so the net runs upward —
   on the one pool that now decides whether anything is ever a ticket again.

   hgFwdSettleFill resolves each record a second way, into parallel fields.
   It never touches `state` or `r`: a log that silently restates its own
   history is worse than one with a known bias, because the bias can at
   least be measured against.

   Run: node tests/test-forward-fill-model.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, setTimeout: () => 0, clearTimeout: () => {},
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });

const H = 3600;
const T0 = 1700000000;
/* a long: entry 4700, stop 4670, target 4760. mark decides the order type. */
const rec = o => ctx.hgFwdNormalize(Object.assign({
  tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
  entry: 4700, stop: 4670, t1: 4760, barT: T0, horizonBars: 24
}, o));
const bar = (i, h, l) => ({ t: T0 + i * H, o: (h + l) / 2, h, l, c: (h + l) / 2 });

console.log('== the order type comes off the mark ==');
{
  const O = ctx.hgFwdOrderType;
  ok(O(rec({ mark: 4720 })) === 'BUY_LIMIT', 'a long entry BELOW the mark is a limit');
  ok(O(rec({ mark: 4680 })) === 'BUY_STOP', 'a long entry ABOVE the mark is a stop entry');
  ok(O(rec({ mark: 4700 })) === 'BUY', 'an entry AT the mark is a market order');
  ok(O(rec({ dir: 'short', entry: 4700, stop: 4730, t1: 4640, mark: 4680 })) === 'SELL_LIMIT',
     'and the short side mirrors it');
  ok(O(rec({})) === null, 'no mark yields null — the question cannot be answered, not guessed');
}

console.log('\n== THE PHANTOM WIN: a limit whose target prints without it filling ==');
{
  /* mark 4720, entry 4700: the order rests BELOW. Price rallies straight to
     the target and never comes back to 4700. The old settler books +2R. */
  const r = rec({ mark: 4720 });
  const rows = [bar(1, 4735, 4718), bar(2, 4765, 4740)];

  const actual = ctx.hgFwdSettleOne(r, rows);
  ok(actual.state === 't1', 'the existing resolution books a WIN');
  ok(actual.r === r.rr, 'at full R, for a trade that never opened');

  const fill = ctx.hgFwdSettleFill(r, rows);
  ok(fill.fillState === 'open' || fill.fillState === 'pending',
     'the fill-aware pass has no position at all — the order was never touched');
  ok(fill.stateFill === null, 'so it books no outcome');
  ok(fill.orderType === 'BUY_LIMIT', 'and says which order it was waiting on');
}

console.log('\n== THE PHANTOM LOSS: a stop entry whose stop prints first ==');
{
  /* mark 4680, entry 4700: the order rests ABOVE. Price falls to 4670 and
     never trades up to 4700. The old settler books -1R. */
  const r = rec({ mark: 4680 });
  const rows = [bar(1, 4685, 4675), bar(2, 4682, 4665)];

  const actual = ctx.hgFwdSettleOne(r, rows);
  ok(actual.state === 'stop', 'the existing resolution books a LOSS');

  const fill = ctx.hgFwdSettleFill(r, rows);
  ok(fill.stateFill === null, 'the fill-aware pass books nothing — the entry was never reached');
  ok(fill.orderType === 'BUY_STOP', 'on a stop entry, which is where phantom losses come from');
}

console.log('\n== a real trade resolves the same both ways ==');
{
  const r = rec({ mark: 4720 });
  /* price comes down through the limit, then runs to target */
  const rows = [bar(1, 4722, 4695), bar(2, 4765, 4740)];
  const actual = ctx.hgFwdSettleOne(r, rows);
  const fill = ctx.hgFwdSettleFill(r, rows);
  ok(actual.state === 't1' && fill.stateFill === 't1', 'both book the win');
  ok(fill.rFill === r.rr, 'at the same R');
  ok(fill.fillState === 'filled', 'and the record says the order filled');

  const lost = ctx.hgFwdSettleFill(r, [bar(1, 4722, 4695), bar(2, 4698, 4665)]);
  ok(lost.stateFill === 'stop' && lost.rFill === -1, 'and a real loss books -1R both ways');
}

console.log('\n== unfilled is not a loss, and an unprovable fill is not an outcome ==');
{
  const r = rec({ mark: 4720, horizonBars: 2 });
  /* never reaches the limit inside the window */
  const never = ctx.hgFwdSettleFill(r, [bar(1, 4730, 4715), bar(2, 4735, 4718)]);
  ok(never.fillState === 'unfilled', 'an order untouched inside its window is UNFILLED');
  ok(never.stateFill === 'unfilled' && never.rFill === null, 'which is not a loss and carries no R');

  /* the bar that fills the order also touches the target: hg-v756's case */
  const amb = ctx.hgFwdSettleFill(rec({ mark: 4720 }), [bar(1, 4765, 4695)]);
  ok(amb.fillState === 'unprovable',
     'a bar that both fills the order AND touches an exit is UNPROVABLE');
  ok(amb.stateFill === null && amb.rFill === null, 'and is counted as neither');

  /* the same asymmetry must not creep back in on the loss side */
  const ambLoss = ctx.hgFwdSettleFill(rec({ mark: 4720 }), [bar(1, 4722, 4665)]);
  ok(ambLoss.fillState === 'unprovable', 'a fill bar touching the STOP is refused too');
}

console.log('\n== the actual resolution is never touched ==');
{
  const r = rec({ mark: 4720 });
  const rows = [bar(1, 4735, 4718), bar(2, 4765, 4740)];
  const out = ctx.hgFwdSettle([r], 'XAUUSD', '1h', rows);
  const s = out.list[0];
  ok(s.state === 't1', 'the record keeps the state it was always settled with');
  ok(s.r === r.rr, 'and the R it was always given');
  ok(s.fillState === undefined || s.fillState === 'open' || s.fillState === 'pending',
     'the fill pass adds its verdict without rewriting history');

  /* a legacy record — no mark — must gain nothing rather than be assumed */
  const legacy = ctx.hgFwdSettle([rec({})], 'XAUUSD', '1h', rows);
  ok(legacy.list[0].state === 't1', 'a legacy record still settles as before');
  ok(legacy.list[0].fillState === undefined,
     'and gains NO fill verdict — a log without marks is not evidence about fills');
}

console.log('\n== the stats report both populations ==');
{
  const mk = (i, o) => Object.assign(rec({ barT: T0 + i * H, mark: 4720 }), o);
  const list = [
    mk(0, { state: 't1', stateFill: 't1', fillState: 'filled' }),
    mk(1, { state: 'stop', stateFill: 'stop', fillState: 'filled' }),
    /* the phantom: booked a win, never opened */
    mk(2, { state: 't1', fillState: 'unfilled', stateFill: 'unfilled' }),
    /* and one the bars cannot order */
    mk(3, { state: 'stop', fillState: 'unprovable', stateFill: null })
  ];
  const s = ctx.hgFwdStatsOf(list, 'OMNIGOLD:SCALP', 'MMOVE', false, null);

  ok(s.samples === 4, 'the existing numbers count every settled record, unchanged');
  ok(Math.abs(s.hit - 0.5) < 1e-9, 'and its hit rate is 50% as it always was');

  ok(s.fillSamples === 2, 'the fill-aware count keeps only the two that really opened');
  ok(s.fillWins === 1 && s.fillLosses === 1, 'one win and one loss');
  ok(s.fillUnfilled === 1, 'and reports the phantom it set aside');
  ok(s.fillUnprovable === 1, 'and the one it could not order');
  ok(s.fillSamples + s.fillUnfilled + s.fillUnprovable === s.samples,
     'nothing vanishes between the two populations');

  /* a log with no marks reports nothing rather than a flattering zero */
  const legacy = ctx.hgFwdStatsOf([mk(0, { state: 't1' })], 'OMNIGOLD:SCALP', 'MMOVE', false, null);
  ok(legacy.fillSamples === 0 && !isFinite(legacy.fillHit),
     'a legacy-only log reports no fill-aware hit rate at all');
}

console.log('\n== the desk records the mark, and the gate prefers the filled count ==');
{
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/mark: \(function\(\)\{/.test(og), 'omnigold stamps a mark on every forward record');
  ok(/judgeSrc\.fillSamples/.test(og), 'and measured-edge reads the fill-aware count');
  ok(/fillN >= FWD_MIN_JUDGE/.test(og),
     'preferring it only when it stands on its own, so a legacy log decides as before');
  ok(/never filled, excluded/.test(og), 'and the card says how many were dropped');
}


console.log('\n== an absent bar field is not a price of zero (hg-v825) ==');
{
  /* This file is the evidence layer, and num() was `+v`. +null is 0 and
     isFinite(0) is true, so every isFinite(num(x)) guard here admitted an
     ABSENT value as a measured zero. Three consequences, each driven below.

     The first is the worst, and it is one-directional. */
  const touched = ctx.hgFwdOrderTouched;
  ok(typeof touched === 'function', 'the fill question is reachable');

  /* a bar that traded 4005-4010, and orders resting nowhere near it */
  const good  = { h: 4010, l: 4005, c: 4008 };
  ok(touched('BUY_LIMIT', good, 3900) === false,
     'a BUY_LIMIT at 3900 is NOT touched by a bar whose low is 4005');
  ok(touched('SELL_LIMIT', good, 4200) === false, 'nor a SELL_LIMIT at 4200');

  for (const empty of [null, undefined, '']){
    ok(touched('BUY_LIMIT', { h: 4010, l: empty, c: 4008 }, 3900) === false,
       `a bar with l=${String(empty)} does not fabricate a BUY_LIMIT fill 105 points away`);
    ok(touched('SELL_STOP', { h: 4010, l: empty, c: 4008 }, 3900) === false,
       `nor a SELL_STOP — the same l <= entry test, the same absent low`);
    ok(touched('SELL_LIMIT', { h: empty, l: 4005, c: 4008 }, 4200) === false,
       `and a bar with h=${String(empty)} still does not fabricate the short side`);
  }
  /* the real touches must survive the fix */
  ok(touched('BUY_LIMIT', good, 4006) === true, 'a BUY_LIMIT inside the bar IS touched');
  ok(touched('SELL_LIMIT', good, 4008) === true, 'and a SELL_LIMIT inside it');
  ok(touched('BUY', { h: null, l: null }, 1) === true,
     'a market order is filled without consulting the bar at all');

  /* THE ARITHMETIC IT USED TO USE, so these cannot pass vacuously */
  const loose = (type, bar, entry) => {
    const h = +bar.h, l = +bar.l;
    if (!isFinite(h) || !isFinite(l)) return false;
    if (type === 'BUY_LIMIT' || type === 'SELL_STOP') return l <= entry;
    return h >= entry;
  };
  ok(loose('BUY_LIMIT', { h: 4010, l: null, c: 4008 }, 3900) === true,
     'the +v reading really did report that fill — so the assertions above bite');
  ok(loose('SELL_LIMIT', { h: null, l: 4005, c: 4008 }, 4200) === false,
     'and really was one-sided, which is why the bias pointed at long limits');

  /* A COUNTED NON-OBSERVATION: a settled record with no bankR used to be
     an observation of exactly break-even — sample up, mean pulled to zero. */
  const statsOf = ctx.hgFwdStatsOf;
  ok(typeof statsOf === 'function', 'the aggregation is reachable with a list');
  const settled = (st, bank) => ({ tab: 'T', mechanic: 'M', sym: 'X', tf: '1h', dir: 'long',
    state: st, rr: 2, bankR: bank, barT: T0, horizonBars: 5 });

  /* two real measurements at +1R, and two settled records carrying no
     bankR at all — the shape a legacy record has */
  const measured = statsOf([settled('t1', 1), settled('t1', 1)], 'T', null, false);
  ok(measured.bankN === 2 && Math.abs(measured.bankExpR - 1) < 1e-9,
     'two measured records give bankN 2 at +1.00R');
  const withGaps = statsOf(
    [settled('t1', 1), settled('t1', 1), settled('t1', null), settled('stop', undefined)],
    'T', null, false);
  ok(withGaps.bankN === 2,
     `the two records carrying no bankR are not counted as observations (bankN ${withGaps.bankN})`);
  ok(Math.abs(withGaps.bankExpR - 1) < 1e-9,
     `and the mean is unmoved at ${withGaps.bankExpR.toFixed(2)}R — it used to be dragged to 0.50R `
     + 'by two non-observations of exactly break-even');

  /* A RECORD THAT IS ALWAYS STALE: no barT read as epoch zero. */
  const stale = ctx.hgFwdIsStale;
  ok(typeof stale === 'function', 'the staleness question is reachable');
  ok(stale({ state: 'open', barT: null, horizonBars: 5, tf: '1h' }, T0) === false,
     'a record with no barT is not declared stale — "cannot tell" is not "expired"');
  ok(stale({ state: 'open', barT: T0 - 10, horizonBars: 5, tf: '1h' }, T0) === false,
     'a fresh record is not stale');
  ok(stale({ state: 'open', barT: T0 - 5 * 3600 * 99, horizonBars: 5, tf: '1h' }, T0) === true,
     'and a genuinely old one still is');
}

console.log('\n' + passed + ' passed, 0 failed');
