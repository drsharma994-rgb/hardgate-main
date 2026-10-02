/* HARDGATE — hg-v1029: the diversification throttle primitive.

   hgCorrMatrix / hgPortfolioConcentration quantify HOW concentrated a book is,
   but nothing said WHICH positions are the redundant shadows of a correlated
   cluster. hgCorrelationRedundancy names them: for each direction, positions
   sort by riskPct descending and are greedily kept; a position is `redundant`
   when its correlation to an already-kept same-direction position is at or
   above maxCorr (default 0.8). It is a read-mark, never a gate — nothing is
   dropped or moved, so the forward ledger can measure whether the shadows pay
   differently from the heads.

   Run: node tests/test-correlation-redundancy-v1029.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const assert = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };

const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const R = ctx.hgCorrelationRedundancy;
assert(typeof R === 'function', 'hgCorrelationRedundancy exported');

/* 22 daily candle rows → 21 returns. `up` is a monotone rise; `flat` is a
   constant close (zero-variance returns → corr 0 with anything, i.e. independent). */
const up   = Array.from({ length: 22 }, (_, i) => ({ c: 100 + i }));
const flat = Array.from({ length: 22 }, () => ({ c: 100 }));

console.log('== the cluster head survives, the shadows are redundant ==');
{
  const res = R(
    [ { sym: 'SOL', dir: 'long', riskPct: 0.02 }, { sym: 'AVAX', dir: 'long', riskPct: 0.015 },
      { sym: 'LINK', dir: 'long', riskPct: 0.01 }, { sym: 'XAU', dir: 'long', riskPct: 0.008 },
      { sym: 'BTC', dir: 'short', riskPct: 0.006 } ],
    { SOL: up, AVAX: up, LINK: up, XAU: flat, BTC: flat }
  );
  assert(res.redundant.AVAX === true, 'AVAX (corr 1 with SOL) is redundant');
  assert(res.redundant.LINK === true, 'LINK (corr 1 with SOL) is redundant');
  assert(res.redundant.SOL !== true, 'the biggest bet (SOL) is the head, never redundant');
  assert(res.redundant.XAU !== true, 'the independent XAU is kept, not redundant');
  assert(res.redundant.BTC !== true, 'the short BTC is in its own direction cluster, kept');
  assert(res.kept.indexOf('SOL') >= 0 && res.kept.indexOf('XAU') >= 0 && res.kept.indexOf('BTC') >= 0,
    'the kept set holds the head of each independent bet');
}

console.log('== direction is respected: a short mirror is not a shadow ==');
{
  const res = R(
    [ { sym: 'SOL', dir: 'long', riskPct: 0.02 }, { sym: 'SOLS', dir: 'short', riskPct: 0.02 } ],
    { SOL: up, SOLS: up }   /* same series, opposite direction */
  );
  assert(res.redundant.SOLS !== true, 'a short with the same series is not a shadow of the long');
}

console.log('== maxCorr is tunable ==');
{
  const tight = R(
    [ { sym: 'SOL', dir: 'long', riskPct: 0.02 }, { sym: 'AVAX', dir: 'long', riskPct: 0.015 } ],
    { SOL: up, AVAX: up }, { maxCorr: 1.01 }
  );
  assert(tight.redundant.AVAX !== true, 'a maxCorr above 1.0 suppresses the flag (corr 1.0 < 1.01)');
}

console.log('== degenerate inputs never throw ==');
assert(R([], {}).kept.length === 0, 'no positions → empty kept, no throw');
assert(R([{ sym: 'SOL', dir: 'long', riskPct: 0.02 }], { SOL: up.slice(0, 5) }).kept.length === 0,
  'a single symbol with too-few bars → no throw, nothing resolved');
assert(R(null, null).note.length > 0, 'null in → a note, no throw');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
