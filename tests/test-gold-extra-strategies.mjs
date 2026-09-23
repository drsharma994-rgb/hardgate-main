/* HARDGATE — three gold-native strategies, added on the terms the evidence sets.

   ASKED FOR, AND THE PRIOR IS AGAINST MORE DETECTORS. This desk already runs
   78 OMNIGOLD mechanics and S0-S66 across Parts 4-9, and hg-v922 measured
   that NOTHING either gold desk ranks by separates outcomes on four disjoint
   windows at both fill bounds; hg-v925 measured the cohort freed by relaxing
   the evidence gate at 30.5% against a 33.3% breakeven. So these are added
   with the discipline that follows, and this file pins that discipline
   rather than just the arithmetic:

     - they MINT DEMOTED, because a new mechanic has no record and this desk
       does not let an unmeasured setup lead;
     - they are NOT registered as OMNIGOLD mechanics, because hg-v923 showed
       registering one WIDENS the Sidak bar for every existing mechanic
       (77 -> 78 moved it 3.2091 -> 3.2128 sigma) — three more would make
       every other mechanic's promotion bar stricter on a desk where nothing
       currently clears it;
     - they are BARS ONLY, so none can be UNCHECKED for want of a feed, and
       the dollar leg returns null rather than inventing a correlation.

   What each reads that nothing in the catalog did: the LBMA benchmark
   auctions, the dollar leg that normally prices gold (held today only as a
   one-way veto, never as the anomaly), and the round-dollar levels the metal
   trades around (OMNIGOLD has had them; the two tabs a trader works from
   never did).

   Run: node tests/test-gold-extra-strategies.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                        querySelector: () => null, querySelectorAll: () => [],
                        head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
let STORE = {};
globalThis.localStorage = { getItem: k => (k in STORE ? STORE[k] : null),
                            setItem: (k, v) => { STORE[k] = String(v); },
                            removeItem: k => { delete STORE[k]; } };
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
try { vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' }); } catch (e) {}
vm.runInThisContext(fs.readFileSync(root + 'gold-extra-strategies.js', 'utf8'),
                    { filename: 'gold-extra-strategies.js' });

const W = globalThis;
/* a January instant, so Europe/London is GMT and the fix hours are UTC hours */
const JAN = Date.UTC(2026, 0, 14, 0, 0, 0);
const bar = (tMs, o, h, l, c) => ({ t: Math.floor(tMs / 1000), o, h, l, c, v: 1000 });
/* n bars of 15m ending at `endMs`, each a quiet 2-wide range around `px` */
function quiet(endMs, n, px, stepMs){
  const out = [];
  for (let i = n - 1; i >= 0; i--)
    out.push(bar(endMs - i * (stepMs || 900000), px, px + 1, px - 1, px));
  return out;
}

console.log('\n1. the LBMA fix windows, DST-aware and honest about Intl');
{
  ok(typeof W.hgGoldFixWindow === 'function', 'the window reader is exported');
  ok(JSON.stringify(W.HG_GOLD_FIX_HOURS) === '[10.5,15]',
     'the two auctions are 10:30 and 15:00 LONDON LOCAL, not UTC constants');

  const am = W.hgGoldFixWindow(Date.UTC(2026, 0, 14, 10, 40));
  ok(am && am.phase === 'post' && am.which === 'AM', '10:40 GMT in January is just after the AM fix');
  const pre = W.hgGoldFixWindow(Date.UTC(2026, 0, 14, 10, 0));
  ok(pre && pre.phase === 'pre' && pre.which === 'AM', '10:00 is the run-in to it');
  const pm = W.hgGoldFixWindow(Date.UTC(2026, 0, 14, 15, 10));
  ok(pm && pm.phase === 'post' && pm.which === 'PM', 'and 15:10 is just after the PM fix');
  ok(W.hgGoldFixWindow(Date.UTC(2026, 0, 14, 3, 0)) === null, 'the Asian session is in neither');

  /* DST IS THE WHOLE REASON THIS USES Intl. In July, London is BST, so the
     10:30 auction is 09:30 UTC — a UTC constant would be an hour late for
     seven months of the year. */
  const julyPost = W.hgGoldFixWindow(Date.UTC(2026, 6, 14, 9, 40));
  ok(julyPost && julyPost.phase === 'post' && julyPost.which === 'AM',
     'in July the AM fix sits at 09:40 UTC — BST is handled, not assumed away');
  ok(W.hgGoldFixWindow(Date.UTC(2026, 6, 14, 10, 40)) === null,
     'and 10:40 UTC in July is NOT the fix, which a UTC constant would have got wrong');
}

console.log('\n2. the fix FADE fires on a reversal, never on a continuation');
{
  /* run-in 09:45-10:30 drifting UP, then a bar closing back through the mid */
  const rows = quiet(Date.UTC(2026, 0, 14, 9, 30), 12, 4500);
  const driftEnd = Date.UTC(2026, 0, 14, 10, 30);
  rows.push(bar(Date.UTC(2026, 0, 14, 9, 45), 4500, 4506, 4499, 4505));
  rows.push(bar(Date.UTC(2026, 0, 14, 10, 0), 4505, 4516, 4504, 4515));
  rows.push(bar(Date.UTC(2026, 0, 14, 10, 15), 4515, 4527, 4514, 4526));
  /* post-fix bar closing back BELOW the run-in midpoint (~4513) */
  const rev = rows.concat([bar(Date.UTC(2026, 0, 14, 10, 40), 4526, 4527, 4505, 4507)]);
  const f = W.hgGoldFixFade(rev, { now: Date.UTC(2026, 0, 14, 10, 40) });
  ok(f && f.ok && f.dir === 'short', 'an up-drift into the fix that closes back through mids fades SHORT');
  ok(f.entry === 4507 && f.stop > 4527, 'entering at the close with the stop beyond the run-in extreme');
  ok(/LBMA AM fix/.test(f.why) && /x ATR into the/.test(f.why), 'and the reason names the auction and the drift');

  /* a continuation is NOT a setup here — the desk has other ways to read one */
  const cont = rows.concat([bar(Date.UTC(2026, 0, 14, 10, 40), 4526, 4540, 4525, 4538)]);
  ok(W.hgGoldFixFade(cont, { now: Date.UTC(2026, 0, 14, 10, 40) }) === null,
     'a bar that simply continues the drift mints nothing');

  /* no drift, no fade. A dead-flat run-in is not enough of a test: with the
     drift floor removed it still returns null because the reclaim also fails.
     This one DRIFTS, just not enough, and the post bar DOES close back
     through the midpoint — so only the floor stands between it and a
     ticket. */
  const small = quiet(Date.UTC(2026, 0, 14, 9, 30), 12, 4500);
  small.push(bar(Date.UTC(2026, 0, 14, 9, 45), 4500, 4500.6, 4499.8, 4500.4));
  small.push(bar(Date.UTC(2026, 0, 14, 10, 0), 4500.4, 4501.0, 4500.2, 4500.8));
  small.push(bar(Date.UTC(2026, 0, 14, 10, 15), 4500.8, 4501.4, 4500.6, 4501.2));
  const smallPost = small.concat([bar(Date.UTC(2026, 0, 14, 10, 40), 4501.2, 4501.3, 4499.0, 4499.5)]);
  ok(W.hgGoldFixFade(smallPost, { now: Date.UTC(2026, 0, 14, 10, 40) }) === null,
     'a drift too small to matter is not faded, even when the bar after it reverses');

  /* IT IS A POST-FIX READ. Inside the run-in there is nothing to fade yet —
     the auction has not happened. */
  ok(W.hgGoldFixFade(rev, { now: Date.UTC(2026, 0, 14, 10, 15) }) === null,
     'and it stays silent DURING the run-in, before the auction it fades');

  /* outside the post window it is silent even with a perfect reversal */
  ok(W.hgGoldFixFade(rev, { now: Date.UTC(2026, 0, 14, 13, 0) }) === null,
     'and it only speaks inside the post-fix window');
  ok(W.hgGoldFixFade([], { now: JAN }) === null && W.hgGoldFixFade(null, {}) === null,
     'no bars, no opinion');
}

console.log('\n3. dollar divergence reads the ANOMALY, and needs the leg');
{
  const up = (px, n, step) => { const o = []; for (let i = 0; i < n; i++) o.push(bar(JAN + i * 900000, px + i * step, px + i * step + 1, px + i * step - 1, px + i * step)); return o; };
  const gold = up(4500, 14, 2);      /* +0.62% */
  const dxyUp = up(100, 14, 0.03);   /* +0.39% — SAME sign: the anomaly */
  const d = W.hgGoldDxyDivergence(gold, dxyUp, {});
  ok(d && d.ok && d.dir === 'long', 'gold and DXY rising together reads LONG with the metal');
  ok(/moving TOGETHER/.test(d.why) && /not what is pricing the metal/.test(d.why),
     'and says why that is the informative state');

  const dxyDown = up(100, 14, -0.03);
  ok(W.hgGoldDxyDivergence(gold, dxyDown, {}) === null,
     'the ORDINARY inverse state is not a signal — that is the point');

  /* NO LEG, NO OPINION — never an assumed correlation */
  ok(W.hgGoldDxyDivergence(gold, null, {}) === null, 'missing dollar rows return null');
  ok(W.hgGoldDxyDivergence(gold, [], {}) === null, 'and so does an empty series');
  ok(W.hgGoldDxyDivergence(gold, up(100, 3, 0.03), {}) === null, 'and one too short to measure');
  /* ELEVEN bars is long enough for the percentage move but short of the
     series floor — the case that separates the guard from the arithmetic
     behind it, which a 3-bar series does not. */
  ok(W.hgGoldDxyDivergence(gold, up(100, 11, 0.03), {}) === null,
     'a dollar series below the minimum length is refused even though the move is computable');

  /* magnitude floors on BOTH legs */
  ok(W.hgGoldDxyDivergence(up(4500, 14, 0.05), up(100, 14, 0.03), {}) === null,
     'a gold move too small to matter does not qualify');
  ok(W.hgGoldDxyDivergence(gold, up(100, 14, 0.0005), {}) === null,
     'nor a dollar move too small to matter');

  const dn = W.hgGoldDxyDivergence(up(4500, 14, -2), up(100, 14, -0.03), {});
  ok(dn && dn.dir === 'short', 'both falling together reads SHORT, the mirror case');
}

console.log('\n4. round-dollar rejection — the wick half only');
{
  const base = quiet(JAN, 24, 4490);
  /* a bar that pierced 4500 and closed back under it */
  const rej = base.concat([bar(JAN + 24 * 900000, 4496, 4503, 4495, 4497)]);
  const r = W.hgGoldRoundReject(rej, {});
  ok(r && r.ok && r.dir === 'short' && r.level === 4500, 'a high through $4500 closing back under it is a SHORT');
  ok(r.stop > 4503, 'with the stop beyond the wick');
  ok(/round level/.test(r.why) && /x ATR/.test(r.why), 'and the reason quotes the pierce in ATR');

  const low = quiet(JAN, 24, 4510).concat([bar(JAN + 24 * 900000, 4504, 4505, 4497, 4503)]);
  const rl = W.hgGoldRoundReject(low, {});
  ok(rl && rl.dir === 'long' && rl.level === 4500, 'and the low side is the mirror');

  /* ACCEPTANCE IS NOT REJECTION */
  const thru = base.concat([bar(JAN + 24 * 900000, 4496, 4510, 4495, 4508)]);
  ok(W.hgGoldRoundReject(thru, {}) === null, 'a bar that closed THROUGH the level is not a rejection');

  /* a pierce too small to mean anything */
  const graze = base.concat([bar(JAN + 24 * 900000, 4496, 4500.05, 4495, 4497)]);
  ok(W.hgGoldRoundReject(graze, {}) === null, 'a rounding-artefact graze does not qualify');

  ok(W.hgGoldNearestRound(4527, 25) === 4525, 'the nearest level snaps to the step');
  ok(W.hgGoldNearestRound(4527, 100) === 4500, 'at every step size');
  ok(!isFinite(W.hgGoldNearestRound(4527, 0)), 'and a zero step is not a level');
}

console.log('\n5. THE DISCIPLINE — no record, so it cannot lead');
{
  STORE = {};
  /* BEFORE any init runs — a caller that reads the flag on a cold module
     must not find it already true. The initialiser resets it either way, so
     asserting only after init would pass whatever the declared default is. */
  ok(W.hgGoldExtraPromotable() === false,
     'the module starts NOT promotable, before any init or stored value');
  W.HG_GOLD_EXTRA_PROMOTABLE = undefined;
  ok(W.hgGoldExtraInit() === false, 'promotion is OFF by default');
  ok(W.hgGoldExtraPromotable() === false, 'so a fresh desk cannot crown one of these');
  W.hgGoldExtraSetPromotable(true);
  ok(W.hgGoldExtraPromotable() === true && STORE['hg_gold_extra_promotable'] === '1',
     'lifting it is one explicit call, and it persists');
  W.hgGoldExtraSetPromotable(false);
  ok(W.hgGoldExtraPromotable() === false, 'and it goes back');

  /* hg-v934 REBASED THESE FOUR. They were written against this pack's own claim
     that every one of these detectors has NO MEASURED RECORD — and that claim was
     wrong: goldfix's OMNIGOLD twin LONDON-FIX has 69 settled firings and
     goldround's twin ROUND-MAGNET has 587. The assertions are kept, not deleted,
     because what they were guarding still holds — the card must say it cannot
     lead and why — but they now check the statement that is TRUE. The
     unconditional version is asserted where it is still honest: on golddxy,
     which really has no twin. See tests/test-gold-sibling-records.mjs. */
  const note = W.hgGoldExtraUncheckedNote('goldfix');
  ok(/GOLDFIX/.test(note), 'the card names the mechanic');
  ok(/NO RECORD ON THIS DESK/.test(note),
     'and says it has no record HERE — which is the true statement');
  ok(/LONDON-FIX/.test(note) && /OMNIGOLD/.test(note),
     'naming the twin whose record it quotes, and attributing it');
  ok(/cannot lead/.test(note), 'and what that means for the card');

  const bare = W.hgGoldExtraUncheckedNote('golddxy');
  ok(/NO MEASURED RECORD/.test(bare) && /GOLDDXY/.test(bare),
     'the detector that genuinely has no twin still says it has no record at all');
  ok(/cannot lead until a walk gives it one/.test(bare), 'and what would change that');
  ok(/not a comment on the idea/.test(bare),
     'distinguishing absence of evidence from evidence of absence');

  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/goldfix:\s+'LBMA LONDON FIX FADE/.test(gi) && /golddxy:/.test(gi) && /goldround:/.test(gi),
     'all three are registered as gold strategies');
  ok(/if \(!promo\) xCand\.demoted = true;/.test(gi),
     'and the mint DEMOTES them while promotion is off — the never-observed rule');
  ok(/hgGoldExtraStamp/.test(gi)
     && /String\(xr\.kind\)\.toUpperCase\(\) \+ ' · NO RECORD'/.test(gi),
     'with the reason stamped on the card — record-aware since hg-v934, and still '
     + 'falling back to the plain NO RECORD stamp when that helper is absent');

  /* NOT registered as OMNIGOLD mechanics: that would widen the family bar */
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  for (const k of ['GOLDFIX', 'GOLD-FIX', 'GOLDDXY', 'GOLDROUND'])
    ok(og.indexOf("'" + k + "'") < 0, k + ' is NOT an OMNIGOLD mechanic — that would widen the Sidak bar');
}

console.log('\n6. wired into the page and the offline shell');
{
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/<script src="gold-extra-strategies\.js\?v=\d+"><\/script>/.test(html), 'the page loads it');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  ok(/'\.\/gold-extra-strategies\.js'/.test(sw), 'and the service worker caches it, so offline matches online');

  /* the whole set behind one call, and it must survive junk */
  ok(typeof W.hgGoldExtraDetect === 'function', 'one entry point for all three');
  ok(W.hgGoldExtraDetect({}).length === 0, 'no rows, nothing detected');
  ok(W.hgGoldExtraDetect(null).length === 0, 'and a null input is not a crash');
  ok(W.hgGoldExtraDetect({ rows: quiet(JAN, 30, 4444) }).length === 0,
     'a quiet tape away from any level mints nothing');
}

if (process.exitCode) console.error('\n' + passed + ' passed, but this file FAILED — see above');
else console.log('\n' + passed + ' assertions — all green');
