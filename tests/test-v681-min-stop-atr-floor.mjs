/* v681: minimum stop distance floor in ATR units at hgPlanFromRisk.

   Why. Every plan-builder path in plans.js flows through hgPlanFromRisk
   (line ~1157). Before v681 nothing prevented risk = 0.1 * ATR — a
   hair-trigger stop that any normal 4H wick or spread-widening tick
   clips. This is the single most common way structurally correct plans
   lose money: not because the thesis was wrong, but because the stop
   was too tight to survive normal noise.

   Fix. When the caller supplies opts.atr or opts.rows (from which ATR
   is derived), enforce risk >= 0.5 * ATR. When violated, WIDEN the stop
   away from entry to reach the floor and set stopWidened=true. Downstream
   minRr gate then decides if the widened plan is still tradeable, so
   marginal plans get rejected downstream rather than trading with a
   dangerous stop. Backward-compatible: callers that pass neither atr
   nor rows get old behavior. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'plans.js'), 'utf8');

/* --- structural: constant + rationale + widen (not tighten) --- */
assert.ok(/var HG_MIN_STOP_ATR = 0\.5;/.test(src),
  'HG_MIN_STOP_ATR constant must be 0.5');
assert.ok(/v681: minimum stop distance in ATR units/.test(src),
  'v681 rationale must be present at the constant');
assert.ok(/stop = \(dir === 'long'\) \? \(entry - minStopDist\) : \(entry \+ minStopDist\);/.test(src),
  'must WIDEN stop (long: entry - minStopDist; short: entry + minStopDist)');
assert.ok(/stopWidened: stopWidened,\s*\n\s*stopFloorAtr: stopFloorAtr/.test(src),
  'return value must include stopWidened + stopFloorAtr');

/* --- structural: all 4 callsites forward rows/m15/rows4h --- */
const v681CommentCount = (src.match(/v681: enables minimum-stop-distance ATR floor/g) || []).length;
assert.ok(v681CommentCount === 4,
  'exactly 4 hgPlanFromRisk callsites must carry v681 comment. saw ' + v681CommentCount);
/* And each site must forward some rows arg */
const rowsFwdCount = (src.match(/rows: (rows|m15|rows4h)/g) || []).length;
assert.ok(rowsFwdCount >= 4,
  'at least 4 rows-forwarding occurrences. saw ' + rowsFwdCount);

/* --- runtime: extract hgPlanFromRisk and exercise it --- */
const fnMatch = src.match(/function hgPlanFromRisk\(dir, entry, stop, opts\)\{[\s\S]*?\n\}/);
assert.ok(fnMatch, 'must find hgPlanFromRisk source');
const fnSrc = fnMatch[0];

/* Build a sandbox with the constants and helpers the function reads. */
const sandbox = {
  HG_T1_R: 2.0,
  HG_T2_R: 3.5,
  HG_MIN_RR_DEFAULT: 2.0,
  HG_MIN_STOP_ATR: 0.5,
  fin: function(x){ x = +x; return isFinite(x) ? x : NaN; },
  atr: function(rows, len){
    /* stub: return an ATR series where the last value is the "high" of\n       the row range, so tests can seed it deterministically by picking\n       rows with a fixed range. */
    if (!Array.isArray(rows) || !rows.length) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++){
      out.push(rows[i]._atr !== undefined ? rows[i]._atr : 100);
    }
    return out;
  }
};
const buildFn = new Function('deps', `
  var HG_T1_R = deps.HG_T1_R;
  var HG_T2_R = deps.HG_T2_R;
  var HG_MIN_RR_DEFAULT = deps.HG_MIN_RR_DEFAULT;
  var HG_MIN_STOP_ATR = deps.HG_MIN_STOP_ATR;
  var fin = deps.fin;
  var atr = deps.atr;
  ${fnSrc}
  return hgPlanFromRisk;
`);
const hgPlanFromRisk = buildFn(sandbox);

/* Case A: risk BELOW floor with opts.atr → stop widened to exactly floor */
{
  const p = hgPlanFromRisk('long', 30000, 29970, { atr: 100 });
  /* risk 30 < 0.5*100=50, so stop → 30000 - 50 = 29950 */
  assert.ok(p, 'plan returned');
  assert.equal(p.stop, 29950, 'stop widened to 29950 (entry - 0.5*ATR)');
  assert.equal(p.stopWidened, true, 'stopWidened flag set');
  assert.equal(p.stopFloorAtr, 0.5, 'stopFloorAtr reported');
  assert.equal(p.risk, 50, 'risk reflects widened stop');
}

/* Case B: risk ABOVE floor with opts.atr → stop unchanged */
{
  const p = hgPlanFromRisk('long', 30000, 29900, { atr: 100 });
  /* risk 100 > 50; no widen */
  assert.equal(p.stop, 29900, 'stop unchanged');
  assert.equal(p.stopWidened, false, 'not widened');
  assert.equal(p.risk, 100);
}

/* Case C: SHORT direction, risk below floor → stop widened UP */
{
  const p = hgPlanFromRisk('short', 30000, 30030, { atr: 100 });
  /* short, risk 30 < 50, stop → 30000 + 50 = 30050 */
  assert.equal(p.stop, 30050, 'short stop widened to entry + floor');
  assert.equal(p.stopWidened, true);
  assert.equal(p.risk, 50);
}

/* Case D: no atr AND no rows → old behavior (no widen) */
{
  const p = hgPlanFromRisk('long', 30000, 29999, {});
  /* risk 1, no floor available, plan returned as-is */
  assert.equal(p.stop, 29999);
  assert.equal(p.stopWidened, false);
  assert.equal(p.risk, 1);
}

/* Case E: opts.rows fallback → ATR pulled from atr() helper */
{
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push({ o: 30000, h: 30100, l: 29900, c: 30000, _atr: 100 });
  const p = hgPlanFromRisk('long', 30000, 29990, { rows: rows });
  /* atr helper returns 100 as last; risk 10 < 50, widen */
  assert.equal(p.stop, 29950, 'rows fallback: stop widened to 29950');
  assert.equal(p.stopWidened, true);
}

/* Case F: opts.atr wins over opts.rows when both supplied */
{
  const rows = [{ _atr: 999 }];
  const p = hgPlanFromRisk('long', 30000, 29970, { atr: 100, rows: rows });
  /* atr:100 takes precedence, floor=50, stop widened to 29950 */
  assert.equal(p.stop, 29950, 'opts.atr wins');
}

/* Case G: t1/t2 recomputed from the WIDENED risk */
{
  const p = hgPlanFromRisk('long', 30000, 29970, { atr: 100 });
  /* risk now 50, t1R=2, t2R=3.5, so t1=30000+100=30100, t2=30000+175=30175 */
  assert.equal(p.risk, 50);
  assert.equal(p.t1, 30100, 't1 = entry + 2R × widened risk');
  assert.equal(p.t2, 30175, 't2 = entry + 3.5R × widened risk');
}

/* Case H: exactly AT the floor → no widen, no flag */
{
  const p = hgPlanFromRisk('long', 30000, 29950, { atr: 100 });
  /* risk exactly 50, cur < min? 50 < 50 false; no widen */
  assert.equal(p.stop, 29950);
  assert.equal(p.stopWidened, false);
}

/* Case I: bad atr (NaN, 0, negative) → skip check, old behavior */
{
  const p1 = hgPlanFromRisk('long', 30000, 29999, { atr: NaN });
  assert.equal(p1.stop, 29999, 'NaN atr: no check');
  assert.equal(p1.stopWidened, false);
  const p2 = hgPlanFromRisk('long', 30000, 29999, { atr: 0 });
  assert.equal(p2.stop, 29999, '0 atr: no check');
  const p3 = hgPlanFromRisk('long', 30000, 29999, { atr: -50 });
  assert.equal(p3.stop, 29999, 'negative atr: no check');
}

/* Case J: extremely tight stop (0.02 ATR) widens dramatically */
{
  const p = hgPlanFromRisk('long', 30000, 29998, { atr: 100 });
  /* risk 2, floor 50, stop → 29950. massive widen. this is exactly the\n     scenario v681 is here to catch: a "structurally correct" plan whose\n     stop is a hair trigger. */
  assert.equal(p.stop, 29950);
  assert.equal(p.stopWidened, true);
  assert.equal(p.risk, 50, '25× the input risk');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:681|68[2-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v681',
  'HG_VER must be >= hg-v681 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('plans\\.js\\?v=' + qv).test(idx),
  'index.html plans.js cache-buster must be ?v=' + qv);

console.log('OK - v681: minimum stop distance ATR floor at hgPlanFromRisk');
console.log('  * Case A: risk below floor + opts.atr -> widened to exactly 0.5*ATR');
console.log('  * Case B: risk above floor -> unchanged');
console.log('  * Case C: SHORT direction widens UP correctly');
console.log('  * Case D: no atr no rows -> backward-compatible (no widen)');
console.log('  * Case E: opts.rows fallback derives ATR');
console.log('  * Case F: opts.atr wins over opts.rows when both supplied');
console.log('  * Case G: t1/t2 recomputed from widened risk');
console.log('  * Case H: exactly at floor -> no widen (no false flag)');
console.log('  * Case I: bad atr (NaN/0/negative) -> old behavior');
console.log('  * Case J: hair-trigger stop (0.02 ATR) widens 25x');
console.log('  * version bumped to ' + HG_VER);
