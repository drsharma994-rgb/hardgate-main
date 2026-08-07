/* HARDGATE — funding is charged AT settlements, not per hour held.
   THE DEFECT. hgFundingCostR counted periods with Math.ceil(hold / 8h), which
   bills by DURATION. Any position held for even a second was charged a full
   funding period:
       hold      ceil()   settlements expected   over-charge
       15 min      1            0.031               32x
       1 hour      1            0.125                8x
       4 hours     1            0.500                2x
       9 hours     2            1.125              1.8x
   Every 15m scalp was billed a full 8h of funding. That pushes net R
   PESSIMISTIC exactly where the fee model already bites hardest, and a working
   scalp book abandoned on a measurement artefact is the same kind of error as
   a losing one kept alive by a phantom fill.
   Delta settles on the 8h UTC grid (00:00 / 08:00 / 16:00). Unix epoch 0 is
   00:00 UTC, so floor(t / 28800) buckets align with that grid exactly and a
   crossing count is just a bucket difference.
   Run: node tests/test-funding-settlements.mjs                               */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const S = html.indexOf('const HG_FEE_TAKER_PCT');
const E = html.indexOf("const LOG_KEY='hardgate_log_v1';");
if (S < 0 || E < 0) throw new Error('FAIL: cost/stats helper block not found');
const ctx = { console, Math, isFinite, parseFloat, localStorage: { getItem: () => null } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(html.slice(S, E), ctx, { filename: 'cost-block' });
const H = 3600, DAY = 86400;
/* 2026-08-06 00:00:00 UTC is exactly on the grid */
const T0 = Math.floor(Date.UTC(2026, 7, 6, 0, 0, 0) / 1000);
ok(T0 % 28800 === 0, 'fixture epoch sits exactly on an 8h settlement boundary');
console.log('== settlements are BOUNDARY CROSSINGS, not elapsed hours ==');
{
  const f = ctx.hgFundingSettlements;
  ok(f(T0 + 1 * H, T0 + 7 * H) === 0, '01:00 to 07:00 crosses nothing → 0');
  ok(f(T0 + 7 * H, T0 + 9 * H) === 1, '07:00 to 09:00 crosses 08:00 → 1');
  ok(f(T0 + 1 * H, T0 + 23 * H) === 2, '01:00 to 23:00 crosses 08:00 and 16:00 → 2');
  ok(f(T0, T0 + DAY) === 3, 'a full day crosses exactly 3');
  ok(f(T0 + 7 * H, T0 + 7 * H + 60) === 0, 'a 1-minute scalp inside a period → 0, not 1');
  ok(f(T0 + 7 * H + 59 * 60, T0 + 8 * H + 60) === 1, 'a 2-minute scalp that straddles 08:00 → 1');
}
console.log('== the guard rails hold ==');
{
  const f = ctx.hgFundingSettlements;
  ok(f(T0 + 100, T0) === null, 'end before start → null');
  ok(f(T0, T0) === null, 'zero-length hold → null');
  ok(f(NaN, T0) === null, 'non-finite input → null');
}
console.log('== a 15m scalp is no longer billed a full 8h period ==');
{
  /* entry 100, stop 99.65 = a 0.35% stop; funding 0.03%/8h */
  const args = [100, 99.65, 'long', 0.03];
  const inside = ctx.hgFundingCostR(...args, T0 + 1 * H, T0 + 1 * H + 900);
  const across = ctx.hgFundingCostR(...args, T0 + 7 * H + 55 * 60, T0 + 8 * H + 5 * 60);
  ok(inside === 0, 'a 15m scalp crossing no settlement pays 0R (was 0.086R)');
  ok(across > 0.08 && across < 0.09, 'a 15m scalp that DOES straddle 08:00 pays the real ~0.086R');
  ok(across > inside, 'the charge now depends on WHEN, not just how long');
}
console.log('== direction decides who pays ==');
{
  const long  = ctx.hgFundingCostR(100, 99.65, 'long',  0.03, T0 + 7 * H, T0 + 9 * H);
  const short = ctx.hgFundingCostR(100, 99.65, 'short', 0.03, T0 + 7 * H, T0 + 9 * H);
  ok(long > 0, 'positive funding is a COST to a long');
  ok(short < 0, 'and a CREDIT to a short');
  ok(Math.abs(long + short) < 1e-12, 'the two are exact mirrors');
  const negLong = ctx.hgFundingCostR(100, 99.65, 'long', -0.03, T0 + 7 * H, T0 + 9 * H);
  ok(negLong < 0, 'negative funding pays the long — the same case G4 stopped vetoing');
}
console.log('== a tight stop is bitten harder, as with fees ==');
{
  const tight = ctx.hgFundingCostR(100, 99.65, 'long', 0.03, T0, T0 + DAY);
  const wide  = ctx.hgFundingCostR(100, 97.00, 'long', 0.03, T0, T0 + DAY);
  ok(tight > wide * 8, 'a 0.35% stop pays ~8.5x the R that a 3% stop pays over the same day');
}
console.log('== a legacy duration call is unbiased, never rounded up ==');
{
  /* 5-arg shape: fromSec carries a DURATION and toSec is absent */
  const legacy = ctx.hgFundingCostR(100, 99.65, 'long', 0.03, 900);
  const full   = ctx.hgFundingCostR(100, 99.65, 'long', 0.03, T0 + 7 * H, T0 + 9 * H);
  ok(legacy > 0, 'a duration-only call still returns a charge');
  ok(legacy < full / 30, 'but it is the 15m EXPECTATION (~1/32 of a period), not a whole one');
  ok(ctx.hgFundingCostR(100, 99.65, 'long', 0.03, 0) === 0, 'zero duration → 0');
}
console.log('== net R uses the fill window, not the signal window ==');
{
  const row = { status: 'tp', rr: 2, entry: 100, stop: 99.65, dir: 'long',
                fundingPct: 0.03, filledTs: T0 + 1 * H, doneTs: T0 + 7 * H };
  const noCross = ctx.hgNetR(row);
  const crossed = ctx.hgNetR(Object.assign({}, row, { doneTs: T0 + 9 * H }));
  ok(noCross > crossed, 'the row that crossed a settlement nets less');
  ok(noCross < 2, 'both still pay the fee legs');
}
console.log('\n' + passed + ' passed, 0 failed');
