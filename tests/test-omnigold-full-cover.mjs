/* HARDGATE — OMNIGOLD runs every mechanic it claims, on every scan.

   THE QUESTION THIS ANSWERS. Asked whether the desk really uses all its
   strategies and indicators, the honest audit of the sibling tab found the
   header over-claiming: mechanics named at the top that no code path ever
   invoked. That is not a typo class of bug — it is invisible from the UI,
   invisible from the console, and it makes the tab's own description a lie
   the user trades on.

   So this file does not test that detectors are CORRECT. It tests that the
   three registrations agree, which is the thing that fails silently:

     1. OG_MECHANICS          the key list the pooled table and the
                              significance correction are both built from
     2. hgOgDetect            the live pass — miss this and the mechanic can
                              never fire, however good it is
     3. the backtest fns map  miss this and the mechanic fires with NO
                              in-sample record, so the measured-edge gate has
                              nothing to read and waves it through

   Any one of the three missing is a real defect, and all three are quiet.
   A mechanic in (1) and (3) but not (2) shows a track record on the card for
   something that can never fire. A mechanic in (2) and (3) but not (1) is
   traded and measured and never shown. A mechanic in (1) and (2) but not (3)
   is the worst: it produces tickets and the gate that exists to veto unproven
   mechanics cannot see it.

   The last assertion is the significance correction. OG_MECHANICS.length
   feeds a Sidak family-wise bar, so ADDING mechanics must RAISE the per-
   mechanic hurdle. If someone ever hard-codes that count, the correction
   silently stops tracking reality and every added mechanic makes the desk
   more permissive instead of less — exactly backwards.

   Run: node tests/test-omnigold-full-cover.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

/* Comments are stripped before ANY scan below. Three separate tests in this
   repo have previously passed by matching their own explanatory prose — a
   sweep that reads comments cannot tell "wired up" from "mentioned". */
function stripComments(s){
  let out = '', i = 0;
  while (i < s.length){
    const two = s.slice(i, i + 2);
    if (two === '/*'){ const e = s.indexOf('*/', i + 2); i = (e === -1) ? s.length : e + 2; continue; }
    if (two === '//'){ const e = s.indexOf('\n', i); i = (e === -1) ? s.length : e; continue; }
    out += s[i]; i++;
  }
  return out;
}
const CODE = stripComments(SRC);

/* ---- 1. OG_MECHANICS, read from the source rather than from a copy ---- */
const mechStart = CODE.indexOf('OG_MECHANICS');
ok(mechStart > 0, 'OG_MECHANICS is declared in omnigold.js');
const mechEnd = CODE.indexOf('];', mechStart);
ok(mechEnd > mechStart, 'OG_MECHANICS array terminates');
const MECHANICS = (CODE.slice(mechStart, mechEnd).match(/'[A-Z0-9][A-Z0-9-]*'/g) || [])
  .map(s => s.slice(1, -1));
ok(MECHANICS.length >= 55, 'OG_MECHANICS holds at least 55 keys (found ' + MECHANICS.length + ')');
ok(new Set(MECHANICS).size === MECHANICS.length, 'no duplicate keys in OG_MECHANICS');

/* ---- 2. the backtest fns map ----
   Hoisted out of scanHorizon in pack 830 so its clock invariant could be
   tested from outside (see test-omnigold-replay-clock.mjs). It reads the
   same way here: the map body is still a single brace-balanced literal,
   now returned by hgOgBtDetectors instead of assigned to a local. */
const btStart = CODE.indexOf('function hgOgBtDetectors()');
ok(btStart > 0, 'the walk-forward fns map is present');
/* Brace-matched rather than regex-terminated: the map body contains nested
   object literals and function bodies, so the first '}' is not the end. */
function braceBlock(code, from){
  let depth = 0, i = code.indexOf('{', from);
  const start = i;
  for (; i < code.length; i++){
    if (code[i] === '{') depth++;
    else if (code[i] === '}'){ depth--; if (!depth) return code.slice(start, i + 1); }
  }
  return '';
}
/* the function's own body is the first brace block; the map literal is the
   second, so step past `return {` to land on it */
const BT_RETURN = CODE.indexOf('return {', btStart);
ok(BT_RETURN > btStart, 'hgOgBtDetectors returns the map literal');
const BT_BLOCK = braceBlock(CODE, BT_RETURN);
ok(BT_BLOCK.length > 0, 'the fns map block is brace-balanced');
/* Keys appear either quoted ('ICHI-KUMO':) or bare (SPRING:). */
const BT_KEYS = new Set();
for (const m of BT_BLOCK.matchAll(/(?:^|[{,]\s*)'([A-Z0-9][A-Z0-9-]*)'\s*:/gm)) BT_KEYS.add(m[1]);
for (const m of BT_BLOCK.matchAll(/(?:^|[{,]\s*)([A-Z][A-Z0-9]*)\s*:/gm)) BT_KEYS.add(m[1]);

/* ---- 3. the live detect pass ---- */
const dStart = CODE.indexOf('function hgOgDetect(rows');
ok(dStart > 0, 'hgOgDetect is present');
const DETECT = braceBlock(CODE, dStart);
ok(DETECT.length > 0, 'hgOgDetect body is brace-balanced');

/* Which hgOg* detector functions does the live pass actually invoke? */
const CALLED = new Set();
for (const m of DETECT.matchAll(/\b(hgOg[A-Za-z0-9_]+)\s*\(/g)) CALLED.add(m[1]);
/* And which does the backtest map invoke? */
const BT_CALLED = new Set();
for (const m of BT_BLOCK.matchAll(/\b(hgOg[A-Za-z0-9_]+)\s*\(/g)) BT_CALLED.add(m[1]);

/* ---- the load-bearing cross-checks ---- */

/* (1) -> (3): every advertised key has an in-sample record. */
const missingBt = MECHANICS.filter(k => !BT_KEYS.has(k));
ok(missingBt.length === 0,
   'every OG_MECHANICS key is in the walk-forward map' +
   (missingBt.length ? ' — missing: ' + missingBt.join(', ') : ''));

/* (3) -> (1): nothing is measured that the card cannot show. */
const orphanBt = [...BT_KEYS].filter(k => !MECHANICS.includes(k));
ok(orphanBt.length === 0,
   'the walk-forward map measures nothing absent from OG_MECHANICS' +
   (orphanBt.length ? ' — orphans: ' + orphanBt.join(', ') : ''));

/* (2): every detector the backtest replays is also reachable live. This is
   the check that catches a mechanic which is measured but can never fire —
   the map and the live pass must call the SAME functions. Detectors the live
   pass reaches through a helper (hgOgPdSweep via hgOgPrevDay, and the like)
   are matched by name, which is why both sets are function names rather than
   keys. */
/* NOT A DETECTOR, AND NAMED RATHER THAN PATTERN-MATCHED. hgOgBtLastSec reads
   the last bar's timestamp so the replay can tell each detector when it is;
   the live pass has the wall clock and does not need it. It is exempt because
   it detects nothing, and it is listed here by name so the exemption cannot
   quietly widen into "anything starting with hgOgBt". */
const BT_HELPERS = ['hgOgBtLastSec'];
ok(BT_HELPERS.every(h => CODE.indexOf('function ' + h + '(') > 0),
   'every exempted backtest helper actually exists — a stale exemption is a hole');
const btOnly = [...BT_CALLED].filter(f => !CALLED.has(f) && BT_HELPERS.indexOf(f) < 0);
ok(btOnly.length === 0,
   'every detector in the walk-forward map is also called by hgOgDetect' +
   (btOnly.length ? ' — backtest-only: ' + btOnly.join(', ') : ''));

/* The fourteen library mechanics specifically, named so a regression points
   at the right place rather than at a count. */
const ROUND5 = ['ICHI-KUMO','STOCHRSI-TURN','CCI-EXTREME','RIBBON-PULLBACK',
                'HA-FLIP','VWAP-BAND','PD-EQUILIBRIUM','ER-IGNITION',
                'STRUCT-BOS','SWEEP-V2','OB-RETEST','OU-REVERT',
                'MFI-SQUAT','DI-CROSS','FVG-HVN'];
for (const k of ROUND5){
  ok(MECHANICS.includes(k) && BT_KEYS.has(k), k + ' is registered in both the key list and the backtest map');
}

/* ---- the goldind / pinegoldmath functions are actually reached ---- */
const LIB = ['goldIchimoku','goldStochRSI','goldCCI','goldRibbon','goldHeikinAshi',
             'goldVWAPBands','goldPremiumDiscount','calculateKaufmanER',
             'goldMarketStructure','goldSweepV2','goldOrderBlockRetest',
             'goldActiveOrderBlocks','pineGoldOuZscore','goldMFI','goldADX',
             'goldFVGV2'];
for (const fn of LIB){
  ok(CODE.includes("gfn('" + fn + "')"), 'omnigold reaches ' + fn + '() from the gold library');
}

/* Those functions must exist where we claim they do, or the feature check
   silently disables the mechanic forever and the pooled table just shows a
   permanent zero — which reads as "never set up" rather than "never wired". */
const GOLDIND = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
const PINEGOLD = fs.readFileSync(path.join(ROOT, 'pinegoldmath.js'), 'utf8');
for (const fn of LIB){
  const found = new RegExp('\\b(?:W|G|window)\\.' + fn + '\\s*=').test(GOLDIND + PINEGOLD);
  ok(found, fn + ' is exported by goldind.js or pinegoldmath.js');
}

/* Both libraries must be in the page, or none of the above matters at runtime. */
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/src=["']goldind\.js/.test(INDEX), 'goldind.js is loaded by index.html');
ok(/src=["']pinegoldmath\.js/.test(INDEX), 'pinegoldmath.js is loaded by index.html');

/* And in the service-worker shell, or the offline app loses them silently. */
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok(SW.includes("'./goldind.js'"), 'goldind.js is in the service-worker shell');
ok(SW.includes("'./pinegoldmath.js'"), 'pinegoldmath.js is in the service-worker shell');

/* ---- every gold-library call is bounded ----

   The walk-forward calls each detector once per bar over a GROWING prefix, so
   an O(n) library read becomes O(n^2) across the replay. Measured: OB-RETEST
   handed the full 1,500-bar prefix took 360 SECONDS for one horizon, against
   5.5s for the twenty-four mechanics that predate round five COMBINED. It was
   invisible until timed — nothing throws, nothing warns, the scan just stops
   finishing.

   A wall-clock assertion would be flaky on shared CI, so the guard is
   structural: no round-six detector may hand `rows` straight to a gold
   library function. Everything goes through ogTail(rows, N). */
const R5_FNS = ['hgOgIchiKumo','hgOgStochTurn','hgOgCciExtreme','hgOgRibbonPullback',
                'hgOgHaFlip','hgOgVwapBand','hgOgPdEquilibrium','hgOgErIgnition',
                'hgOgStructBos','hgOgSweepV2','hgOgObRetest','hgOgOuRevert',
                'hgOgMfiSquat','hgOgDiCross','hgOgFvgHvn'];
ok(/function ogTail\s*\(/.test(CODE), 'the ogTail bounding helper exists');
for (const name of R5_FNS){
  const at = CODE.indexOf('function ' + name);
  ok(at > 0, name + ' is defined');
  const body = braceBlock(CODE, at);
  /* The library call is always `f(...)`, `zf(...)` or `sf(...)` — the local
     handle returned by gfn(). Passing the raw `rows` to one of those is the
     unbounded form. */
  const unbounded = /\b(?:f|zf|sf)\s*\(\s*rows\s*[,)]/.test(body);
  ok(!unbounded, name + ' never hands the full prefix to a gold library call');
  ok(body.includes('ogTail('), name + ' bounds its history with ogTail');
}

/* ---- the significance correction still tracks the count ---- */
ok(!/hgOgFamilyZ\(\s*\d+\s*\)/.test(CODE),
   'the family-wise bar is never called with a hard-coded mechanic count');
ok(/hgOgFamilyZ\(\s*OG_MECHANICS\.length\s*\)/.test(CODE),
   'the family-wise bar is derived from OG_MECHANICS.length');

/* Sidak: the per-test bar must RISE as the family grows. Recomputed here with
   the same formula rather than asserting a magic number, so this stays true
   if the confidence level is ever changed. */
function normCdf(z){
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}
function familyZ(k){
  const target = Math.pow(0.95, 1 / k);
  let lo = 0, hi = 8;
  for (let i = 0; i < 64; i++){ const mid = (lo + hi) / 2; if (normCdf(mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/* ---- (4) THE REGISTRY NOBODY COMPARED: WHAT THE DETECTOR EMITS ----

   The three cross-checks above are static list against static list —
   OG_MECHANICS, the fns map, the detector call-set. None of them looks at
   the `kind` strings hgOgDetect actually produces, so a detector emitting a
   label absent from every list slips through silently, which is precisely
   the failure the file header says this test prevents.

   Three had: UTAD (106 firings in the walk), DONCHIAN-DRIVE (3) and
   COMPRESSION-BREAK (1). The walk artifact records `kind` per row, so it
   is the one place the emitted set can be read without a network call.

   ALIAS-AWARE, AND THE ALIAS MAP IS NOW EMPTY. SPRING and UTAD are one
   detector under two direction labels (hgOmniSpring returns SPRING on a
   swept low and UTAD on a swept high, confirmed 123/123 long and 106/106
   short). hg-v764 folded them; this file used to assert that fold. It no
   longer holds: the two halves settle 19 points of win rate apart and a
   pooled record describes neither, so each label is registered and judged
   on its own. UTAD is therefore expected to be PRESENT in OG_MECHANICS —
   the opposite of what this block used to require, and the reason it is
   rewritten rather than renumbered.

   The map is still read from omnigold.js rather than copied, so the day a
   genuinely interchangeable pair appears this check follows it. An empty
   map is a valid state and must not read as a parse failure — the two are
   told apart by whether the declaration was found at all. */
{
  const ALIAS = {};
  const aliasMatch = CODE.match(/var OG_KIND_ALIAS = \{([^}]*)\}/);
  const aliasSrc = (aliasMatch || [])[1] || '';
  for (const m of aliasSrc.matchAll(/'([A-Z0-9-]+)'\s*:\s*'([A-Z0-9-]+)'/g)) ALIAS[m[1]] = m[2];
  ok(!!aliasMatch, 'the alias map declaration is readable from source');
  ok(Object.keys(ALIAS).length === 0,
     'and nothing folds today (' + JSON.stringify(ALIAS) + ') — a found-but-empty map, not a failed parse');
  ok(MECHANICS.includes('UTAD'),
     'so UTAD is registered in its own right rather than judged on SPRING\'s record');
  ok(MECHANICS.includes('SPRING'), 'and SPRING still is too — un-pooling adds a mechanic, it removes none');

  const walkPath = path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');
  if (fs.existsSync(walkPath)){
    const walk = JSON.parse(fs.readFileSync(walkPath, 'utf8'));
    const emitted = new Set((walk.trades || [])
      .filter(t => t.source === 'SCAN')            /* engine picks are not omnigold mechanics */
      .map(t => t.kind));
    ok(emitted.size > 40, 'the walk emitted ' + emitted.size + ' distinct SCAN kinds');

    const canon = k => (Object.prototype.hasOwnProperty.call(ALIAS, k) ? ALIAS[k] : k);
    const unregistered = [...emitted].filter(k => !MECHANICS.includes(canon(k)));

    /* TWO DECLARED GAPS, and they are declared rather than hidden.

       hgOgDetect calls hgOmniDetect — OmniRoute's WHOLE detect pass — so
       this desk consumes a superset of what OG_MECHANICS lists, and the
       header's claim to be "the single source of truth" is not quite true.
       Two OmniRoute CV detectors reach the gold book through it:

         DONCHIAN-DRIVE     3 firings in 9,897 rows
         COMPRESSION-BREAK  1 firing

       Registering them properly means adding them to the fns map too, and
       a key in that map with no replay row fails the check above it — so
       the real fix needs a walk, and the walk needs Binance klines that
       are a gateway policy denial from this environment.

       Named here with their counts so the gap is visible, and asserted to
       be EXACTLY these two: a third one, or either of these growing into a
       real share of the book, fails this test immediately. That is the
       property that matters — the guard was blind, and it is not now. */
    const DECLARED_GAPS = ['DONCHIAN-DRIVE', 'COMPRESSION-BREAK'];
    const undeclared = unregistered.filter(k => DECLARED_GAPS.indexOf(k) < 0);
    ok(undeclared.length === 0,
       'every kind the detector emits is registered or declared' +
       (undeclared.length ? ' — UNREGISTERED: ' + undeclared.join(', ') : ''));

    /* the declared ones must stay rare; they are tolerated because they are
       negligible, not because they are allowed */
    const rows = (walk.trades || []).filter(t => t.source === 'SCAN');
    for (const g of DECLARED_GAPS){
      const n = rows.filter(t => t.kind === g).length;
      ok(n <= 10, g + ' is still negligible (' + n + ' of ' + rows.length + ' SCAN rows)');
    }
    ok(DECLARED_GAPS.every(g => unregistered.indexOf(g) >= 0 || !emitted.has(g)),
       'and every declared gap is still a real one — a fixed gap must leave this list');
  }

  /* (5) and the baked ledger the gate actually reads */
  const ledger = new Set();
  const ledStart = CODE.indexOf('kinds: {', CODE.indexOf('HG_OG_REPLAY_EVIDENCE'));
  if (ledStart > 0){
    const block = braceBlock(CODE, ledStart);
    for (const m of block.matchAll(/'([A-Z0-9][A-Z0-9-]*)'\s*:\s*\[/g)) ledger.add(m[1]);
    ok(ledger.size > 40, 'the baked ledger holds ' + ledger.size + ' rows');
    const canon2 = k => (Object.prototype.hasOwnProperty.call(ALIAS, k) ? ALIAS[k] : k);
    const orphanLedger = [...ledger].filter(k => !MECHANICS.includes(canon2(k)));
    ok(orphanLedger.length === 0,
       'the ledger measures nothing the card cannot name' +
       (orphanLedger.length ? ' — ORPHANS: ' + orphanLedger.join(', ') : ''));
  }
}

const z34 = familyZ(34), zNow = familyZ(MECHANICS.length);
ok(zNow > z34,
   'adding mechanics raised the per-mechanic significance bar (' +
   z34.toFixed(2) + 'σ → ' + zNow.toFixed(2) + 'σ at ' + MECHANICS.length + ' mechanics)');

console.log('\nomnigold full-cover: ' + passed + ' checks passed · ' +
            MECHANICS.length + ' mechanics, all three registrations agree');
