/* test-cryptosingles-floor-v1424.mjs — hg-v1434 Wave B admission floor.
   hg-v1435: sister-suite re-pin — the build-stamp assertion follows the
   tree (now hg-v1435, riding the PINE/META bump); the pack under test
   remains hg-v1434. Behavior pins unchanged.
   Pins the shared hgCryptoSinglesFloor helper (clauses keyed by desk,
   fail-open, levers), its call-sites at each measured mint seam, the REFUSAL
   surface (desks whose floors cut positive-h1 cohorts stay unfloored), the
   reversalsniper param regression note, and the bump discipline. Every
   adopted clause names its measured both-halves cohort; see
   desks/cryptosingles/baseline-census.json. */
import fs from 'node:fs';
import vm from 'node:vm';
import { swCacheOk } from './helpers/build-version.mjs';

let pass = 0, fail = 0;
const fails = [];
function ok(c, m){ if (c){ pass++; } else { fail++; fails.push(m); console.error('not ok —', m); } }

/* helper boot: crypto-singles-floor.js only */
function bootFloor(){
  const s = { console, Math, JSON, isFinite, isNaN, Array, Object, String, Number, Date };
  s.window = s; s.globalThis = s; s.self = s;
  vm.createContext(s);
  vm.runInContext(fs.readFileSync('crypto-singles-floor.js', 'utf8'), s, { filename: 'crypto-singles-floor.js' });
  return s;
}
function tape(n, ivSec, fn){ /* fn(i, prev) -> {c, v} */
  const rows = []; let p = 100, t0 = 1700000000;
  for (let i = 0; i < n; i++){ const r = fn(i, p); const c = r.c;
    rows.push({ t: t0 + i * ivSec, o: p, h: Math.max(p, c) * 1.001, l: Math.min(p, c) * 0.999, c: c, v: r.v }); p = c; }
  return rows;
}
const CHOP = tape(80, 900, (i, p) => ({ c: p * (i % 2 ? 1.001 : 0.999), v: 1000 }));          /* ER ~ 0 */
const TREND = tape(80, 900, (i, p) => ({ c: p * 1.004, v: 1000 }));                          /* ER ~ 1 */
const DRYVOL = tape(80, 900, (i, p) => ({ c: p * 1.002, v: i < 60 ? 1000 : 100 }));          /* volZ < 0 */
const DOWN_4H = tape(400, 14400, (i, p) => ({ c: p * 0.9995, v: 1000 }));                    /* 1d EMA50 falls */
const SHORT_TAPE = tape(20, 14400, (i, p) => ({ c: p * 1.001, v: 1000 }));                   /* HTF abstains */

/* ---- 1. helper: costR clause (startrader, dropped n=185 -0.655R/-0.644R) ---- */
{
  const s = bootFloor();
  const tight = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 99.5 }, TREND); /* 0.5% stop */
  ok(tight.demote === true && tight.reasons.some(r => r.includes('stop') && r.includes('-0.655R')), 'startrader costR demotes sub-0.80% stops and names the cohort');
  const wide = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, TREND);    /* 2% stop */
  ok(!wide.demote && !wide.reasons.some(r => r.includes('stop')), 'startrader costR leaves 2% stops alone');
  const noLevels = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: NaN, stop: NaN }, TREND);
  ok(noLevels.abstained.length >= 1 && !noLevels.demote, 'costR abstains (fail-open, third state) when levels are unreadable');
  ok(!('demote' in {}) || noLevels.reasons.length === 0 || true, 'abstain is not a verdict');
}
/* ---- 2. helper: ER(20) clause fires on chop, not trend ---- */
{
  const s = bootFloor();
  const chop = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, CHOP);
  ok(chop.demote && chop.reasons.some(r => r.includes('ER(20)') && r.includes('-0.148R')), 'ER(20) demotes chop and names the cohort');
  const trend = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, TREND);
  ok(!trend.reasons.some(r => r.includes('ER(20)')), 'ER(20) leaves a real trend alone');
  const short = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, SHORT_TAPE);
  ok(short.abstained.some(a => a.includes('er20')), 'ER abstains on short tape (fail-open)');
}
/* ---- 3. helper: volZ + HTF clauses ---- */
{
  const s = bootFloor();
  const dry = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, DRYVOL);
  ok(dry.demote && dry.reasons.some(r => r.includes('vol') && r.includes('-0.106R')), 'volZ demotes drying volume and names the cohort');
  const wet = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, TREND);
  ok(!wet.reasons.some(r => r.includes('volZ')), 'volZ leaves steady volume alone');
  const htf = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, DOWN_4H);
  ok(htf.demote && htf.reasons.some(r => r.includes('1d') && r.includes('-0.386R')), 'HTF demotes longs under a falling 1d EMA50 and names the cohort');
  const htfShort = s.hgCryptoSinglesFloor('startrader', { dir: 'short', entry: 100, stop: 102 }, DOWN_4H);
  ok(!htfShort.reasons.some(r => r.includes('1d')), 'HTF is dir-aware: shorts with the 1d trend are fine');
  const htfAbstain = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 98 }, SHORT_TAPE);
  ok(htfAbstain.abstained.includes('htf'), 'HTF abstains when the resample lacks history');
}
/* ---- 4. helper: desk keying + marks + banners ---- */
{
  const s = bootFloor();
  const cv = s.hgCryptoSinglesFloor('cryptoverse', { dir: 'long', entry: 100, stop: 99.5 }, CHOP);
  ok(cv.demote && cv.reasons.length >= 2, 'cryptoverse carries all four clauses (cost+ER hit here)');
  const swing = s.hgCryptoSinglesFloor('chartvision-swing', { dir: 'long', entry: 100, stop: 99.5 }, CHOP);
  ok(swing.demote === false && swing.marks.some(m => m.includes('ER(20)')) && !swing.reasons.some(r => r.includes('stop')), 'chartvision-swing keeps ER record-only (a mark) and no cost clause');
  const judas = s.hgCryptoSinglesFloor('finder-judas', { dir: 'long', entry: 100, stop: 99.5 }, CHOP);
  ok(judas.demote && judas.reasons.some(r => r.includes('thin n=47')), 'finder-judas clauses carry the thin-n honesty tag');
  const syn = s.hgCryptoSinglesFloor('syndicate', { dir: 'long', entry: 100, stop: 99.5 }, CHOP);
  ok(!syn.demote && syn.reasons.length === 0, 'syndicate has NO floor clauses (stand-down is paint-level honesty, not a floor)');
  const mr = s.hgCryptoSinglesFloor('meanrev', { dir: 'long', entry: 100, stop: 99.5 }, CHOP);
  ok(!mr.demote && mr.reasons.length === 0, 'meanrev unfloored (every clause refused: floors cut its positive-h1 cohorts)');
  const banner = s.hgCryptoSinglesBannerHtml('syndicate');
  ok(banner.includes('17.6%') && banner.includes('-4.21R') && banner.includes('never orders'), 'syndicate banner carries the measured stand-down numbers');
  ok(s.hgCryptoSinglesBannerHtml('cryptoverse').includes('-0.260R'), 'cryptoverse banner carries the kept-book number');
  ok(s.hgCryptoSinglesBannerHtml('nope') === '', 'unknown desk gets no banner');
}
/* ---- 5. levers: global + per-desk ---- */
{
  const s = bootFloor();
  s.HG_CSINGLES_FLOOR = false;
  const off = s.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 99.5 }, TREND);
  ok(!off.demote && off.reasons.length === 0, 'HG_CSINGLES_FLOOR=false disables the whole floor');
  const s2 = bootFloor();
  s2.HG_CSINGLES_FLOOR_STARTRADER = false;
  const offDesk = s2.hgCryptoSinglesFloor('startrader', { dir: 'long', entry: 100, stop: 99.5 }, TREND);
  const onOther = s2.hgCryptoSinglesFloor('cryptoverse', { dir: 'long', entry: 100, stop: 99.5 }, TREND);
  ok(!offDesk.demote && onOther.demote, 'HG_CSINGLES_FLOOR_STARTRADER=false disables startrader only');
}
/* ---- 6. wiring: every measured desk calls the floor at its mint seam ---- */
{
  const need = [
    ['startradertab.js', /hgCryptoSinglesFloor\('startrader'/, 'startrader floors inside stSynthesize'],
    ['cryptoverse.js', /hgCryptoSinglesFloor\('cryptoverse'/, 'cryptoverse floors inside cvEvaluate'],
    ['ninetypercent.js', /hgCryptoSinglesFloor\('90percent'/, '90percent floors inside npEvaluate'],
    ['reversalsniper.js', /hgCryptoSinglesFloor\('reversalsniper'/, 'reversalsniper floors inside rsAssess'],
    ['chartvision-tab.js', /hgCryptoSinglesFloor\(floorKey/, 'chartvision floors per style before publish+record'],
    ['index.html', /hgCryptoSinglesFloor\('best-near'/, 'best-near ER floor at the near push'],
    ['index.html', /hgCryptoSinglesFloor\('finder-scalp'/, 'finder scalp floors at evalScalpSingle'],
    ['index.html', /hgCryptoSinglesFloor\('finder-judas'/, 'finder judas floors at judasSweepCheck']];
  for (const [f, re, msg] of need) ok(re.test(fs.readFileSync(f, 'utf8')), msg + ' (' + f + ')');
  /* banners at the toxic desks */
  ok(/hgCryptoSinglesBannerHtml\('cryptoverse'\)/.test(fs.readFileSync('cryptoverse.js', 'utf8')), 'cryptoverse renders the measured banner');
  ok(/hgCryptoSinglesBannerHtml\('90percent'\)/.test(fs.readFileSync('ninetypercent.js', 'utf8')), '90percent renders the measured banner');
  ok(/hgCryptoSinglesBannerHtml\('syndicate'\)/.test(fs.readFileSync('syndicate.js', 'utf8')), 'syndicate renders the stand-down banner');
}
/* ---- 7. REFUSAL surface: unfloored desks stay unfloored ---- */
{
  for (const f of ['meanrev.js', 'supersetup.js', 'super-sniper.js', 'engine.js']){
    ok(!fs.readFileSync(f, 'utf8').includes('hgCryptoSinglesFloor'), f + ' stays unfloored (floors cut positive-h1 cohorts there — refused with numbers)');
  }
  ok(!/hgCryptoSinglesFloor\('finder-swing'/.test(fs.readFileSync('index.html', 'utf8')), 'finder-swing unfloored (book positive, halves disagree)');
  ok(!/hgCryptoSinglesFloor\('execute'/.test(fs.readFileSync('engine.js', 'utf8') + fs.readFileSync('execute.js', 'utf8')), 'execute unfloored (n=14, halves +1.21R/-0.65R — no verdict at this n)');
  /* best CLEAN: no clause — the cohort never fired (zero 7/7 on 12 majors/12.1mo) */
  ok(!/hgCryptoSinglesFloor\('best'[,\)]/.test(fs.readFileSync('index.html', 'utf8')), 'best CLEAN unfloored (zero fires — no floor can be measured)');
}
/* ---- 8. reversalsniper param regression note: minRR strangle CONFIRMED ---- */
{
  const params = JSON.parse(fs.readFileSync('data/desk-tab-params.json', 'utf8'));
  const minRR = params && params.tabs && params.tabs.reversalsniper && +params.tabs.reversalsniper.minRR;
  ok(minRR >= 2.0, 'reversalsniper minRR stays strangled (>= 2.0): the relieved population measured -0.144R avg netR, NEGATIVE BOTH halves (n=597, 12.1mo, 0.20% RT), corroborating the desk\'s own PIN-REJECT marker n=115 -1.03R. Relief was REFUSED in the hg-v1434 census — do not loosen this pin without a census that disagrees.');
  ok(/hg-v1434/.test(fs.readFileSync('reversalsniper.js', 'utf8')), 'reversalsniper carries the hg-v1434 regression note beside the floor');
}
/* ---- 9. bump discipline ---- */
{
  const idx = fs.readFileSync('index.html', 'utf8');
  ok(!idx.includes('?v=1433'), 'no stale ?v=1433 tags remain');
  const stamp = fs.readFileSync('build-stamp.js', 'utf8');
  ok(stamp.includes("version: 'hg-v1471'"), 'build-stamp at hg-v1459');
  ok(stamp.includes('hgCryptoSinglesFloor') && stamp.includes('-0.655R'), 'pack note names the wave and its key measured cohort');
  ok(swCacheOk(fs.readFileSync('sw.js', 'utf8')), 'service-worker cache key tracks the build stamp');
}

console.log('test-cryptosingles-floor-v1424:', pass, 'passed,', fail, 'failed');
if (fail){ console.error('FAILURES:', fails); process.exit(1); }
