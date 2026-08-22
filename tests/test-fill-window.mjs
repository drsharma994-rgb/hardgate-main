/* HARDGATE — one fill window, and every UNFILLED verdict carries its evidence.

   WHY THIS EXISTS.
   A HARDGATE entry is a LIMIT, so a plan whose price never traded is not a
   trade and must never be scored. Two places decide that: hgScoreWalk in
   scorecard.js and the LOG walk inline in index.html. Both hard-coded 12, and
   scorecard.js carried a comment saying "FILL_BARS matches the LOG's fill
   window in index.html" — a promise with nothing enforcing it. Change one and
   the LOG and the SCORECARD silently disagree about whether the same setup
   was ever a trade, which is the same drift class that let the connect-src
   allowlist diverge between server.mjs and vercel.json.

   THE SECOND HALF IS EVIDENCE. Declaring UNFILLED removes a setup from
   expectancy altogether, so the verdict should say how close the market
   actually came, not just how many bars passed. Measured on the deployed
   ledger, 24 of 25 settled records came back UNFILLED — and whether that
   means "missed by a hair" or "never in the neighbourhood" decides whether
   the 12-bar window is right. nearR makes that answerable from data instead
   of opinion. It is deliberately NOT used to change the window here: the 24
   records came from a single scan inside a 0.6-hour spread and were all
   longs, which is one market event, not 24 observations.

   Run: node tests/test-fill-window.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const SRC = fs.readFileSync(root + 'scorecard.js', 'utf8');
const html = fs.readFileSync(root + 'index.html', 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function ctxWith(extra){
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    window: {}, console, setTimeout, clearTimeout, Promise
  }, extra || {}));
  vm.runInContext(SRC, ctx, { filename: 'scorecard.js' });
  return ctx;
}

/* ---------- 1) the window is exported, and the LOG reads it ---------- */
{
  const ctx = ctxWith();
  const exported = ctx.window.HG_FILL_BARS;
  assert(exported === 12, 'scorecard.js exports HG_FILL_BARS (got ' + exported + ')');

  assert(/window\.HG_FILL_BARS/.test(html),
    'the inline LOG reads window.HG_FILL_BARS rather than owning a second window');

  /* the only literal left in the LOG must be the absent-module fallback, and
     it must agree with the exported value */
  const m = html.match(/\+window\.HG_FILL_BARS\s*:\s*(\d+);/);
  assert(!!m, 'the LOG keeps a numeric fallback for scorecard.js being absent');
  assert(m && +m[1] === exported,
    'the LOG fallback equals the exported window (' + (m && m[1]) + ' vs ' + exported + ')');

  /* and no stray second definition anywhere in the inline app */
  const hard = (html.match(/const FILL_BARS\s*=\s*\d+\s*;/g) || []).length;
  assert(hard === 0,
    'no inline block hard-codes its own FILL_BARS literal (found ' + hard + ')');
}

/* ---------- 2) UNFILLED carries how close the market came ---------- */
const T0 = 1700000000;
function bar(i, h, l, c){ return { t: T0 + i * 3600, h: h, l: l, c: c }; }

{
  const ctx = ctxWith();
  const walk = ctx.window.hgScoreWalk;
  const LONG = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, at: T0 * 1000 };

  /* never fills, but hovers a tenth of the risk above the limit.
     risk = 10, closest low = 101 -> nearR = 0.1 */
  const near = [];
  for (let i = 0; i < 20; i++) near.push(bar(i, 108, i === 5 ? 101 : 104, 105));
  const wNear = walk(LONG, near);
  assert(wNear.state === 'UNFILLED', 'a limit that never trades is UNFILLED, not a win');
  assert(wNear.nearR === 0.1,
    'UNFILLED records the closest approach in R (expected 0.1, got ' + wNear.nearR + ')');

  /* never remotely close: closest low = 130 -> nearR = 3 */
  const far = [];
  for (let i = 0; i < 20; i++) far.push(bar(i, 140, 130, 135));
  const wFar = walk(LONG, far);
  assert(wFar.state === 'UNFILLED', 'a plan never in the neighbourhood is UNFILLED too');
  assert(wFar.nearR === 3,
    'and the distance says so plainly (expected 3, got ' + wFar.nearR + ')');

  /* the two are distinguishable — the whole point */
  assert(wNear.nearR < wFar.nearR,
    'a near miss and a mispriced plan are told apart, not both just "unfilled"');

  /* SHORT mirrors: entry 100, stop 110; highs peak at 99 -> nearR = 0.1 */
  const SHORT = { dir: 'short', entry: 100, stop: 110, t1: 80, t2: 65, at: T0 * 1000 };
  const shortBars = [];
  for (let i = 0; i < 20; i++) shortBars.push(bar(i, i === 5 ? 99 : 96, 92, 94));
  const wS = walk(SHORT, shortBars);
  assert(wS.state === 'UNFILLED' && wS.nearR === 0.1,
    'short side mirrors exactly (got ' + wS.state + ' ' + wS.nearR + ')');
}

/* ---------- 3) evidence must never leak into scoring ---------- */
{
  const ctx = ctxWith();
  const walk = ctx.window.hgScoreWalk;
  const LONG = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, at: T0 * 1000 };
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push(bar(i, 108, 104, 105));
  const w = walk(LONG, rows);
  assert(w.r === null,
    'an UNFILLED setup still scores null R — nearR is evidence, never a result');

  /* a filled trade is unaffected by the new tracking */
  const fills = [bar(0, 108, 99, 100), bar(1, 121, 99, 120)];
  const wf = walk(LONG, fills);
  assert(wf.state === 'T1' || wf.state === 'T2' || wf.state === 'OPEN' || wf.state === 'SL',
    'a genuinely filled plan still walks to a real outcome (' + wf.state + ')');
  assert(wf.nearR === undefined || wf.nearR === null,
    'a filled trade carries no near-miss distance — it did not miss');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL FILL-WINDOW TESTS PASSED');
