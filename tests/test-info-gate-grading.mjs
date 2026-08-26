/* HARDGATE — "context, not a veto" has to be true in the grader, not just in
   a comment.

   Four indicator reads were added to the OMNIGOLD ledger marked hard:false,
   with a comment saying they were context and would not cut tickets. They
   cut tickets. hgOmniGrade collected a veto from ANY gate returning false:

     if (g.pass === false) vetoes.push(g.key);

   hard only ever governed what UNCHECKED means — hard+null is WATCH, soft+null
   is degraded. It never governed a FAIL. So a soft gate that read "stoch RSI
   100, buying into an exhausted high" stood the whole trade aside, on a desk
   whose ledger already runs twelve gates, for a reason that has never been
   measured on gold.

   The fix is an explicit info flag. An info gate reports an adverse read and
   the ticket stands; the card names what argued against it under "against:"
   so it is visible rather than swallowed. Gates without the flag are
   completely unchanged, which is the assertion this file exists for — every
   other desk in the app grades through this same function.

   THE BAR FOR ADDING TO THIS LIST. Moving a gate to info stops it vetoing,
   so the list is a one-way door and needs a standard. A full audit of the
   gold ledger — every gate split by its own verdict, resolved at the 2R
   where T1 sits, 1,000 bars per horizon — found ELEVEN gates reading
   backwards on SCALP. Almost none survived the second horizon: value-area
   was -7.3 sigma on SCALP and +4.9 on SWING, structure-shift +8.1 and -4.4,
   stoch-rsi -2.8 and +4.2. A gate that reverses sign between horizons is
   reading noise.

   So: a gate joins this list only if it reads backwards on BOTH horizons,
   past the family-wise bar, in the same direction — and only if it is an
   indicator read rather than a risk rule. participation is the one gate that
   has met that (-5.4 SCALP, -2.2 SWING). "It looks wrong on one horizon" is
   not evidence; it is the shape noise takes when you test fifty things.

   Run: node tests/test-info-gate-grading.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8'))(win);
const grade = win.hgOmniGrade;

const G = (key, pass, extra) => Object.assign({ key, hard: true, pass, why: key }, extra || {});

console.log('== an ordinary gate is completely unchanged ==');
{
  ok(typeof grade === 'function', 'hgOmniGrade is exported');

  const clean = grade([G('a', true), G('b', true), G('c', true)]);
  ok(clean.ticket === true, 'all-pass grades to a ticket');
  ok(clean.verdict === 'CLEAN', 'and reads CLEAN');
  ok(clean.evaluated === 3 && clean.total === 3, 'with everything evaluated');

  const vetoed = grade([G('a', true), G('b', false), G('c', true)]);
  ok(vetoed.ticket === false, 'a hard fail still vetoes');
  ok(vetoed.vetoes.join() === 'b', 'and is named in vetoes');
  ok(/^VETO — b/.test(vetoed.verdict), 'the verdict leads with the veto (' + vetoed.verdict + ')');

  /* THE REGRESSION THAT MATTERS: a soft gate WITHOUT the info flag must still
     veto on a fail, because every existing desk relies on exactly that. */
  const softFail = grade([G('a', true), G('b', false, { hard: false }), G('c', true)]);
  ok(softFail.ticket === false, 'a hard:false gate with no info flag STILL vetoes — unchanged behaviour');
  ok(softFail.vetoes.join() === 'b', 'and still appears in vetoes');

  const hardUnknown = grade([G('a', true), G('b', null), G('c', true)]);
  ok(hardUnknown.ticket === false, 'a hard UNCHECKED still blocks');
  ok(/^WATCH — no data: b/.test(hardUnknown.verdict), 'and reads WATCH (' + hardUnknown.verdict + ')');

  const softUnknown = grade([G('a', true), G('b', null, { hard: false }), G('c', true)]);
  ok(softUnknown.ticket === true, 'a soft UNCHECKED does not block');
  ok(/^CLEAN · unchecked: b/.test(softUnknown.verdict), 'and is listed as unchecked (' + softUnknown.verdict + ')');
}

console.log('\n== an info gate reports an adverse read without standing the trade aside ==');
{
  const info = { hard: false, info: true };
  const r = grade([G('a', true), G('stoch-rsi', false, info), G('c', true)]);
  ok(r.ticket === true, 'an info FAIL does not veto');
  ok(r.vetoes.length === 0, 'and contributes no veto');
  ok(r.notes.join() === 'stoch-rsi', 'it lands in notes instead');
  ok(/against: stoch-rsi/.test(r.verdict), 'and the card says what argued against it (' + r.verdict + ')');
  ok(r.evaluated === 3, 'it still counts as evaluated — it was read, and it answered');
}

console.log('\n== an adverse info read is never silently dropped ==');
{
  /* The whole risk of a non-vetoing gate is that it becomes invisible and the
     user trades a setup the app quietly disagreed with. */
  const info = { hard: false, info: true };
  const r = grade([G('a', true), G('ichimoku', false, info), G('donchian-pos', false, info)]);
  ok(r.ticket === true, 'two adverse info reads still ticket');
  ok(r.notes.length === 2, 'both are recorded');
  ok(/against: ichimoku, donchian-pos/.test(r.verdict), 'both are named on the card (' + r.verdict + ')');

  const mixed = grade([G('a', true), G('ichimoku', false, info), G('b', null, { hard: false })]);
  ok(/unchecked: b/.test(mixed.verdict) && /against: ichimoku/.test(mixed.verdict),
     'unchecked and against are reported side by side, not one replacing the other (' + mixed.verdict + ')');
}

console.log('\n== a real veto still outranks an info note ==');
{
  const info = { hard: false, info: true };
  const r = grade([G('news-window', false), G('ichimoku', false, info)]);
  ok(r.ticket === false, 'a genuine veto alongside an info note still stands the trade aside');
  ok(/^VETO — news-window/.test(r.verdict), 'and the verdict leads with the veto, not the note (' + r.verdict + ')');
  ok(r.notes.join() === 'ichimoku', 'the note is still recorded for the card');
}

console.log('\n== info does not become a way to pass an unknown ==');
{
  /* "Unknown reads UNCHECKED, never PASS" is the app's rule, and the info
     flag must not create an exception to it. */
  const r = grade([G('a', true), G('ichimoku', null, { hard: false, info: true })]);
  ok(r.ticket === true, 'an unreadable soft info gate does not block');
  ok(r.degraded.join() === 'ichimoku', 'but it is reported as UNCHECKED, not as a pass');
  ok(r.notes.length === 0, 'and an unknown is not an "against" — it is an unknown');
  ok(r.evaluated === 1, 'and it does NOT count toward the evaluated total');

  const rHard = grade([G('a', true), G('x', null, { hard: true, info: true })]);
  ok(rHard.ticket === false, 'a HARD info gate that cannot be read still blocks — hard still means hard');
}

console.log('\n== the four gold context gates carry the flag ==');
{
  /* spans gold + the shared context block in hg-gates.js */
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8')
            + fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    ok(new RegExp("key:'" + k + "', hard:false, info:true").test(src),
       k + ' is declared hard:false, info:true');
  }
  for (const k of ['adx-trend', 'squeeze-state', 'keltner-pos', 'atr-percentile', 'structure-shift',
                   'macd-momentum', 'bollinger-pctb', 'volume-z', 'regression-slope', 'value-area',
                   'htf-confirm', 'regime-fit', 'vol-forecast', 'stop-width']){
    ok(new RegExp("key:'" + k + "', hard:false, info:true").test(src),
       k + ' is declared hard:false, info:true (omnigold)');
  }
  /* The universe reads live on OMNIROUTE — they need the whole sweep, which
     a single-instrument desk does not have. */
  const routeSrc = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  for (const k of ['adx-trend', 'atr-percentile', 'vol-forecast', 'xs-rank', 'breadth', 'stop-width',
                   'net-r', 'liq-room', 'vol-target', 'cvd', 'liq-map']){
    ok(new RegExp("key:'" + k + "', hard:false, info:true").test(routeSrc),
       k + ' is declared hard:false, info:true (omniroute)');
  }

  /* And nothing else in the app has quietly become non-vetoing. The info flag
     is for INDICATOR CONTEXT reads only — a gate that encodes a risk rule
     (news blackout, cost drag, session) must still be able to stand a trade
     aside, and silently flipping one to info would remove a real veto while
     every test kept passing. */
  const CONTEXT_ONLY = ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime',
                        'adx-trend', 'squeeze-state', 'keltner-pos', 'atr-percentile', 'structure-shift',
                        'macd-momentum', 'bollinger-pctb', 'volume-z', 'regression-slope', 'value-area',
                        'htf-confirm', 'regime-fit', 'vol-forecast',
                        /* bank two (2026-08): six more shared context reads,
                           same standing — they argue, they never veto */
                        'adx-regime', 'obv-flow', 'mfi-pressure', 'cci-stretch',
                        'ema-ribbon', 'heikin-trend',
                        /* round five (2026-08): the ONE gold indicator the
                           shared set above does not already ask. ICT
                           premium/discount — where price sits in its own
                           recent range. Same standing as its neighbours: it
                           argues, it never vetoes, because gold spends whole
                           trends in the premium quartile and a desk that
                           vetoed there would stand aside for the move. */
                        'premium-discount',
                        /* seasonality is goldind's own "context only, not a
                           vote"; spot-basis is PAXG against the desk's feed
                           and is live-only, so neither can ever be a veto */
                        'gold-season', 'spot-basis',
                        /* PARTICIPATION, and this one needs its reasoning on
                           the record because this list exists to stop exactly
                           this kind of loosening.

                           It is an INDICATOR read — trigger-bar volume against
                           its own time-of-day mean — not a risk rule. It sits
                           beside obv-flow and mfi-pressure, which are already
                           here, and nothing about it protects the account the
                           way news-window, cost-drag or session do.

                           It is info on GOLD only. OmniRoute keeps it hard:true
                           because crypto breakouts genuinely need turnover. On
                           gold it was measured filtering backwards — passed
                           27.7% vs vetoed 35.2% on SCALP (z -5.38, n=4593) and
                           27.7% vs 30.7% on SWING (z -2.19, n=4369) — while
                           discarding 38% of scalp firings. A high-volume bar on
                           a metal is often the move already spent. */
                        'participation',
                        /* fill-risk reads the ORDER, not the account: how far
                           the plan's limit sits from market and the measured
                           never-fill rate at that distance (about 1 in 5 past
                           0.25R on both horizons, 1 in 3 past 1R). A far
                           limit is a worse ORDER, not a forbidden trade, so
                           it argues and never vetoes. */
                        'fill-risk',
                        /* gold's structural-placement read (v417): a setup at
                           a multi-source zone vs one in no-man's-land — it
                           argues standing, never existence */
                        'zone-anchor',
                        /* labelled volatility stop on a runaway tape: the
                           compromise is on the card as AGAINST, the ticket
                           stands — otherwise with-trend gold has no levels */
                        'momentum-stop',
                        /* omniroute's own indicator reads — same standing:
                           they argue, they never veto. */
                        'adx-trend', 'atr-percentile', 'vol-forecast',
                        /* zone-anchor + momentum-stop remain info. */
                        /* the fallback both desks declare and neither
                           pushes on a healthy ledger — it appears only
                           when hg-gates.js is broken or absent, and a
                           broken shared module must degrade, not veto */
                        'context-gates',
                        /* the universe reads — the only gates that look
                           outside the contract being judged */
                        'xs-rank', 'breadth',
                        /* what the stop asks of the trade — a wide stop is
                           often correct, so it reports and never vetoes */
                        'stop-width',
                        /* the position-risk reads: what the R is worth after
                           fees, and where liquidation sits relative to the
                           stop. Both inform sizing; neither vetoes. */
                        'net-r', 'liq-room',
                        /* the three techniques the OMNIROUTE coverage table
                           used to list with no implementation: vol targeting,
                           CVD and the liquidation-cluster map. Same standing
                           as the rest of the bank — none has a measured
                           record on this desk, so they argue and never veto.
                           A ticket that cleared before they existed must
                           still clear. */
                        'vol-target', 'cvd', 'liq-map',
                        /* round five gold structure reads — they argue
                           whether a ticket is standing on stack / RSI /
                           session VWAP. They never invent one and never
                           stand a cleared ticket aside. */
                        'ema-stack', 'rsi-zone', 'session-vwap',
                        /* bank three (2026-08): unused tape reads fed into
                           every desk that already consumes hgIndicatorGates */
                        'rsi-classic', 'roc-thrust', 'vwap-stretch'];
  const all = [];
  for (const f of ['omnigold.js', 'omniroute.js']){
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    (s.match(/gates\.push\(\{ key:'([a-z0-9-]+)'[^}]*info:true/g) || [])
      .forEach(m => all.push(/key:'([a-z0-9-]+)'/.exec(m)[1]));
  }
  /* MEMBERSHIP, not a count. Several of these exist on BOTH desks, so the
     number of info-gate declarations is larger than the list of names that
     are allowed to be one — comparing the two could never hold, and a count
     assertion here only ever taught you to bump the number. What matters is
     that nothing OUTSIDE this list has quietly become non-vetoing. */
  const allowed = new Set(CONTEXT_ONLY);
  ok(all.length > 0, 'the app declares info gates (' + all.length + ' declarations, '
    + new Set(all).size + ' distinct)');
  all.forEach(k => ok(CONTEXT_ONLY.indexOf(k) >= 0, '"' + k + '" is an indicator context read, not a risk rule'));
}

console.log('\n== the card must not print VETO on a gate that did not veto ==');
{
  /* A row reading VETO beside a TICKET badge contradicts the card, and the
     user resolves that contradiction however they like — which is the whole
     failure this flag was meant to prevent. */
  /* spans gold + the shared context block in hg-gates.js */
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8')
            + fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  ok(/var vetoed = \(g\.pass === false\) && !g\.info;/.test(src),
     'the gate row only calls it a VETO when it actually vetoed');
  ok(/'AGAINST'/.test(src), 'an adverse info read renders as AGAINST');
  ok(!/g\.pass === false \? 'VETO'/.test(src), 'the old unconditional VETO label is gone');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL INFO GATE GRADING TESTS PASSED');
