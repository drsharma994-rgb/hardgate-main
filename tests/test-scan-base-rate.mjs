/* HARDGATE — is zero normal? The UI could not say, so I assumed it was not.
   ON 2026-08-08 the pipeline ran clean for the first time in two days —
   pack 23's degraded counter reset to 0, setups.at moved off 2026-08-06 — and
   reported ZERO setups. That zero was, finally, real evidence.
   It is also completely unremarkable. Measured at CG_SWING_LOOK 20 over 6,000
   independent symbol snapshots, the chance that any one symbol is a live
   ticket at any one instant is 0.500%:
       universe   expected tickets/scan   P(scan returns ZERO)
           40            0.20                    81.8%
           87            0.43                    64.7%
          200            1.00                    36.7%
   On a Delta-sized universe ZERO IS THE SINGLE MOST LIKELY OUTCOME of any
   given scan. A selective system showing nothing is the normal state, and a UI
   that prints a bare "0" invites reading it as breakage. It invited exactly
   that from me for six fix packs, across which I argued about gate thresholds
   using a number that meant "this is a Tuesday".
   So the panel now converts the count into a bounded statement built from the
   scan's OWN numbers — a Wilson interval on the observed rate — rather than
   from the synthetic constant alone. With 0 of 87, "the true per-scan rate is
   at most ~4%" is a fact. "The funnel is broken" was not.
   Run: node tests/test-scan-base-rate.mjs                                    */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
/* hgWilson lives in index.html; load the cost/stats block so the note can use it */
const S = html.indexOf('const HG_FEE_TAKER_PCT');
const E = html.indexOf("const LOG_KEY='hardgate_log_v1';");
vm.runInContext(html.slice(S, E), ctx, { filename: 'cost-block' });
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
console.log('== the base rate is a named, measured constant ==');
{
  ok(ctx.CG_SYNTHETIC_TICKET_RATE === 0.005, 'the 0.500% measured rate is a constant, not inlined');
  ok(typeof ctx.cgScanRateNote === 'function', 'cgScanRateNote is exported');
  ok(ctx.CG_SWING_LOOK === 20, 'and it was measured at the shipped lookback, not a different one');
}
console.log('== zero on a real universe is reported as NORMAL ==');
{
  const n = ctx.cgScanRateNote(87, 0);
  ok(/observed 0\/87/.test(n), 'it states what was actually seen');
  ok(/95% CI/.test(n), 'with a confidence interval rather than a bare count');
  ok(/ZERO on 6[0-9]% of scans/.test(n), 'and the P(zero) for this universe size: ' + n.match(/ZERO on \d+% of scans/)[0]);
  ok(/MOST LIKELY outcome, not a fault/.test(n), 'and says plainly that zero is not a fault');
}
console.log('== but zero on a LARGE universe is not excused ==');
{
  const big = ctx.cgScanRateNote(2000, 0);
  ok(!/MOST LIKELY outcome, not a fault/.test(big),
     'on 2000 symbols P(zero) is tiny, so the reassurance is correctly withheld');
  ok(/observed 0\/2000/.test(big), 'it still reports the observation');
  const small = ctx.cgScanRateNote(40, 0);
  ok(/MOST LIKELY outcome, not a fault/.test(small), 'and on 40 symbols it is restored');
}
console.log('== the interval tightens with evidence ==');
{
  const a = ctx.cgScanRateNote(87, 0);
  const b = ctx.cgScanRateNote(87, 5);
  const hi = (s) => parseFloat(s.match(/–([\d.]+)%/)[1]);
  ok(hi(a) < 10, '0 of 87 bounds the true rate under 10% (' + hi(a).toFixed(1) + '%)');
  ok(hi(b) > hi(a), '5 of 87 shifts the interval upward');
  const c = ctx.cgScanRateNote(500, 0);
  ok(hi(c) < hi(a), 'a bigger clean-zero sample bounds it tighter (' + hi(c).toFixed(2) + '%)');
}
console.log('== it degrades rather than inventing a number ==');
{
  ok(ctx.cgScanRateNote(0, 0) === '', 'an empty universe returns nothing at all');
  ok(ctx.cgScanRateNote(null, 0) === '', 'null universe -> empty');
  ok(ctx.cgScanRateNote(NaN, 5) === '', 'NaN universe -> empty');
  ok(ctx.cgScanRateNote(87, -3).indexOf('0/87') >= 0, 'a negative clean count is floored at 0, not propagated');
  ok(ctx.cgScanRateNote(87, null).length > 0, 'a null clean count still produces the base-rate half');
}
console.log('== the scan actually counts clean setups now ==');
{
  ok(/let audit = \{ cascade: 0, clean: 0,/.test(html), 'audit carries a clean counter');
  ok(/if \(m\.clean\) audit\.clean = \(audit\.clean \|\| 0\) \+ 1;/.test(html), 'and the scan increments it');
  ok(/cgScanRateNote\(audit\.cascade, audit\.clean \|\| 0\)/.test(html), 'the panel is fed cascade and clean');
  ok(/Is zero normal\?/.test(html), 'and the row asks the question the number was silently raising');
}
console.log('\n' + passed + ' passed, 0 failed');
