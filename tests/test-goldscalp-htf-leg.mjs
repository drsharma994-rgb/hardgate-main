/* HARDGATE — GOLD SCALP and its higher-timeframe leg.

   TWO THINGS, ONE CAUSE: the 4H feed can fail silently.

   fetchGoldKlines walks a cascade of providers per timeframe and wraps every
   leg in its own bare catch, so a 4H fetch that fails leaves rows4h empty and
   says nothing. gold.src already records the source of each leg that
   SUCCEEDED, so the absence was knowable — it was simply never reported.

   (1) THE FIX. hgGoldSweepOb called hgGoldHtfBias(opts.rows4h || rows, ...)
   where `rows` is the 15m EXECUTION tape. hgGoldHtfBias already falls back
   correctly on its own — __rows(rows4h) || __rows(rows1h) — so a missing 4H
   drops to the 1H bars, still a higher timeframe than the 15m. Substituting
   `rows` handed it the execution bars, so it saw a non-empty first argument,
   never reached its own fallback, and returned a "higher timeframe" verdict
   computed from 15m candles.

   MEASURED over 800 tapes with the 4H leg dropped: the 15m substitute and the
   1H fallback gave a DIFFERENT verdict 122 times (15.3%), including outright
   direction flips — long where the 1H said short.

   (2) THE DISCLOSURE. Measured over 600 synthetic scans, dropping the 4H leg
   moved 46 of 485 setup identities (22 appeared only without it, 24 only with
   it) and took COUNTER-TREND demotions from 16 to 44 — that gate reads
   `D.stack4 !== 'bull'` and an absent 4H stack counts as not-disagreeing, so
   it demotes. Live setup count barely moved (485 vs 483) and the direction is
   NOT one-way, so this is not a claim that a missing leg inflates the board.
   It is a claim that the reader could not tell what the board was scored on.

   Run: node tests/test-goldscalp-htf-leg.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}

const gsSrc = fs.readFileSync(root + 'goldscalp.js', 'utf8');
const giSrc = fs.readFileSync(root + 'goldind.js', 'utf8');

/* lift the two feed helpers out of the tab without booting the desk */
function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = new Function('esc', grab(gsSrc, 'gsFeedLegs') + grab(gsSrc, 'gsFeedLegNote')
  + 'return { gsFeedLegs, gsFeedLegNote };')(esc);
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* goldind, for the real hgGoldHtfBias */
function loadGoldind(){
  const ctx = { window: {}, console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
                Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
                parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error,
                setTimeout: () => 0, clearTimeout: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'structure-levels.js',
                   'gold-session.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); } catch (e) {}
  }
  return ctx.window;
}
const W = loadGoldind();

function tape(seed, n, sec, t0, drift){
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const r = [];
  let c = 2400;
  for (let i = 0; i < n; i++){
    const o = c; c = o + (rnd() - 0.5) * 4 + (drift || 0);
    r.push({ t: t0 + i * sec, o, h: Math.max(o, c) + rnd() * 1.8, l: Math.min(o, c) - rnd() * 1.8, c, v: 900 });
  }
  return r;
}
const NOW = Math.floor(Date.now() / 1000);

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the higher-timeframe read is not made of execution bars');
{
  ok(typeof W.hgGoldHtfBias === 'function', 'hgGoldHtfBias is reachable');

  /* the function's OWN fallback is the correct one: 4H, else 1H */
  const r1h = tape(3, 400, 3600, NOW - 400 * 3600, 0.4);
  const r4h = tape(9, 400, 14400, NOW - 400 * 14400, 1.6);
  const viaBoth = W.hgGoldHtfBias(r4h, r1h);
  const via1h = W.hgGoldHtfBias(undefined, r1h);
  ok(viaBoth && via1h, 'it answers with 4H present and with only 1H');
  ok(W.hgGoldHtfBias(undefined, undefined).dir === null,
     'and with neither it says no HTF bias — absent, not invented');

  /* THE DEFECT: substituting the 15m tape changes the verdict */
  let differ = 0, flips = 0, n = 0;
  for (let seed = 1; seed <= 800; seed++){
    const drift = [0, 0.35, -0.35, 0.15, -0.15][seed % 5];
    const r15 = tape(seed, 400, 900, NOW - 400 * 900, drift);
    const h1 = tape(seed + 5, 400, 3600, NOW - 400 * 3600, drift * 4);
    const wrong = W.hgGoldHtfBias(r15, h1);        /* what the old call did */
    const fixed = W.hgGoldHtfBias(undefined, h1);  /* what it does now */
    n++;
    if (wrong.dir !== fixed.dir){
      differ++;
      if (wrong.dir && fixed.dir) flips++;         /* both had an opinion, opposite ones */
    }
  }
  ok(n === 800, 'measured over 800 tapes');
  ok(differ > 80,
     'the 15m substitute disagreed with the 1H fallback ' + differ + ' times ('
     + (100 * differ / n).toFixed(1) + '%)');
  ok(flips > 40, 'and ' + flips + ' of those were outright direction flips, not just one side going quiet');

  /* the call site passes rows4h through */
  ok(/var htf = hgGoldHtfBias\(opts\.rows4h, opts\.rows1h\);/.test(giSrc),
     'hgGoldSweepOb now passes rows4h through, letting the function fall back itself');
  ok(!/hgGoldHtfBias\(opts\.rows4h \|\| rows,/.test(giSrc),
     'and no longer substitutes the execution tape for the higher timeframe');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. which legs were read is knowable, and now reported');
{
  const R = n => Array.from({ length: n }, () => ({ t: 1, o: 1, h: 1, l: 1, c: 1 }));
  const full = { rows15m: R(3), rows1h: R(3), rows4h: R(3), src: {} };

  const legs = F.gsFeedLegs(full);
  ok(legs.ok === true && legs.missing.length === 0, 'all three legs read: nothing missing');
  ok(F.gsFeedLegNote(full) === '', 'and no banner — a full stack needs no caveat');

  const no4h = F.gsFeedLegs({ rows15m: R(3), rows1h: R(3), rows4h: [] });
  ok(no4h.ok === false && no4h.missing.join() === '4h', 'an empty 4h leg is detected as missing');
  ok(no4h.read.join() === '15m,1h', 'and the two that were read are named');

  const t1 = text(F.gsFeedLegNote({ rows15m: R(3), rows1h: R(3), rows4h: [] }));
  ok(/HTF LEG UNREAD/.test(t1), 'the banner says the leg is unread');
  ok(/the 4h feed did not come back/.test(t1), 'names which one');
  ok(/scored on 15m \+ 1h alone/.test(t1), 'and what the board WAS scored on');
  ok(/16 to 44/.test(t1), 'quoting the measured effect on counter-trend demotions');
  ok(/one setup in ten/.test(t1), 'and on how many setups move');
  ok(/Nothing here is wrong/.test(t1),
     'while saying plainly that a missing leg is not the same as a wrong board');

  /* plural reads correctly — a banner that says "the 1h and 4h feed did" is
     the kind of seam that makes a reader doubt the rest of it */
  const t2 = text(F.gsFeedLegNote({ rows15m: R(3) }));
  ok(/HTF LEGS UNREAD/.test(t2) && /the 1h and 4h feeds did not/.test(t2),
     'two missing legs read as plural throughout');
  ok(/scored on 15m alone/.test(t2), 'and the note says only 15m was read');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the banner keeps quiet when it has nothing to say');
{
  const R = n => Array.from({ length: n }, () => ({ t: 1, o: 1, h: 1, l: 1, c: 1 }));
  ok(F.gsFeedLegNote(null) === '',
     'no feed object at all is not an unread leg — the scan never ran, and the status line says so');
  ok(F.gsFeedLegNote(undefined) === '', 'and neither is nothing at all');

  /* 15m missing but the HTF legs present is not an HTF problem */
  ok(F.gsFeedLegNote({ rows1h: R(3), rows4h: R(3) }) === '',
     'a missing EXECUTION leg raises no HTF caveat — that is a different failure, reported elsewhere');

  ok(F.gsFeedLegNote({ rows15m: R(3), rows1h: R(3), rows4h: R(3) }) === '',
     'and a complete stack stays silent');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. wired where the other feed caveat already goes');
{
  ok(/var mixedBanner = gsFeedLegNote\(gold\) \+ goldMixedFeedBannerHtml\(gold\);/.test(gsSrc),
     'the unread-leg line rides with the mixed-feed banner');
  /* which means it reaches every path that banner reaches */
  const uses = (gsSrc.match(/mixedBanner/g) || []).length;
  ok(uses >= 3, 'and that banner is rendered on ' + (uses - 1) + ' paths');

  ok(/W\.gsFeedLegs = gsFeedLegs;/.test(gsSrc), 'gsFeedLegs is exported so the split is checkable');
  /* gsFeedLegNote returns HTML, so it stays internal for the same reason
     gsGateFamily does: everything on window is fuzzed as a renderer by
     test-gold-render-integrity.mjs, and this one is lifted from source here */
  ok(!/W\.gsFeedLegNote\s*=/.test(gsSrc),
     'the HTML helper stays internal, lifted from source rather than exposed');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. it reports; it does not gate');
{
  const body = grab(gsSrc, 'gsFeedLegs') + grab(gsSrc, 'gsFeedLegNote');
  ok(!/\.dropped\s*=/.test(body) && !/\.demoted\s*=/.test(body) && !/\.vetoed\s*=/.test(body),
     'nothing in the feed note writes dropped, demoted or vetoed');
  ok(!/rows4h\s*=/.test(body) && !/rows1h\s*=/.test(body),
     'and it never substitutes a leg it found missing');
  const why = text(F.gsFeedLegNote({ rows15m: [{}], rows1h: [{}] }));
  ok(/not-disagreeing/.test(why) && /demotes more, not less/.test(why),
     'the note explains WHY an absent 4H stack demotes rather than releases');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
