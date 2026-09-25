/* =========================================================================
HARDGATE — hg-forward.js
FORWARD LOG — out-of-sample evidence, accumulated across scans.

WHY THIS EXISTS. Every measurement in the app today is IN-SAMPLE: a tab
replays the same rolling window of candles it just fetched and reports how a
mechanic would have done. Re-scanning tomorrow slides the window and
reshuffles noise; it does not add evidence. OMNIGOLD made the problem
concrete — MMOVE needs ~157 non-overlapping trades to settle at 2 sigma,
fires ~1.1/day, and the window only holds 63 days, so the in-sample number
can never converge no matter how often you press RUN.

This module fixes the shape of the problem rather than the number. When a
tab emits a setup it RECORDS it here, once, keyed to the bar it fired on.
Later scans hand back fresh candles and any record whose outcome is now
knowable gets resolved — T1 before stop, or stop first, or still open.
What accumulates is genuine forward evidence: each trade recorded before its
outcome existed, resolved by bars that had not printed when it was written.

THE RULES IT KEEPS, so a forward number cannot flatter itself:

  ONE RECORD PER FIRING. Keyed by tab + mechanic + symbol + direction + the
  BAR TIMESTAMP it fired on. Re-scanning the same bar cannot record it twice,
  which is what would otherwise turn one setup into a hundred "samples"
  simply by pressing RUN repeatedly.

  NEVER RESOLVE ON THE FIRING BAR. A record is only settled by bars strictly
  after the one it was written on, so a setup can never be resolved by data
  that already existed when it was recorded.

  A BAR SPANNING BOTH COUNTS AS A STOP. Identical to the in-sample walk-
  forward: candles cannot say which printed first, and the optimistic reading
  is how backtests flatter themselves.

  EXPIRY IS NOT A WIN. A record that never reaches either level inside its
  horizon settles as 'expired' and is excluded from the hit rate entirely,
  exactly as an unresolved in-sample trade is.

STORAGE. localStorage under a single key, capped and pruned oldest-first —
the app's existing convention (signallog caps at 500). Nothing here is
authoritative: losing it costs accumulated evidence, not correctness.

Classic script, IIFE. Pure functions are exported for tests and take state
as an argument; the window-level wrappers are the only thing that touches
localStorage. Never throws.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_forward_v1';
  var MAX_RECORDS = 4000;     /* ~1 year of a busy tab; pruned oldest-first */
  /* Bar-open seconds per timeframe. Module scope, because both the recorder
     (deriving the bar a scan fired on) and the staleness check (deriving when
     a record's horizon has demonstrably passed) need it. */
  var TF_SEC = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '1d':86400 };
  /* How far past its own horizon an OPEN record must be before we stop
     calling it live. Settlement needs BARS for that symbol to arrive; if a
     contract is delisted, renamed, or simply drops out of the universe, the
     bars never come and the record stays open for ever. Three horizons is
     well beyond any normal settle: a 4h/20-bar record is stale after ten
     days, a 1h/24-bar one after three. */
  var STALE_HORIZONS = 3;

  /* Module scope on purpose: this file is 'use strict', so a function declared
     inside the `if (typeof window …)` block does NOT escape it — the health
     renderer sits outside that block and could not see it there. */
  /* See omniroute: a required sample size in the tens of thousands is not a
     target, it is the statement that the edge is indistinguishable from
     zero. */
  function hgFwdNeedText(need){
    if (!need || !isFinite(need)) return '';
    if (need > 5000) return ' <span class="dim">(edge too small to confirm at any realistic sample size)</span>';
    return ' <span class="dim">(needs ~' + need + ')</span>';
  }

  function esc(x){
    return String(x == null ? '' : x)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* num() WAS `+v`, AND THIS FILE IS THE EVIDENCE LAYER.

     +null is 0 and isFinite(0) is true, so every `isFinite(num(x))` guard
     below admitted an ABSENT value as a measured zero. Three consequences,
     all of them one-directional:

     A FABRICATED FILL. hgFwdOrderTouched reads l = num(bar.l) and answers
     `l <= entry` for a BUY_LIMIT. A bar with no low gives l = 0, which is
     at or below every entry there has ever been, so a resting order far
     from the market reads as TOUCHED and the record settles as a trade
     that never opened. It is asymmetric: a null HIGH does not fabricate
     the short side, because 0 >= entry is false. So the fill-aware
     population — the one hg-v818's promotion path prefers, "the count that
     describes a trade somebody could have had" — was biased toward long
     limits and short stops.

     A COUNTED NON-OBSERVATION. `isFinite(num(r.bankR))` gates bankN++ and
     bankSum += num(r.bankR), so a settled record carrying no bankR became
     an observation of exactly break-even: sample count up, mean pulled to
     zero. balScore is worse — a missing score lands in the `mid` bucket
     via `bs >= 0`, indexed as if it had been measured.

     A RECORD THAT IS ALWAYS STALE. hgFwdIsStale reads bar = num(rec.barT);
     with no barT that is 0, and `now - 0 > horizon` is true forever.

     Every caller wants the strict reading. The sites that genuinely want a
     zero say so themselves with `num(r.rr) || 0`, and NaN || 0 is still 0,
     so they are unchanged. num is fin now, kept as a name because 29 call
     sites use it. Same defect and same fix as omnigold.js hg-v824. */
  function num(v){ return fin(v); }

  /* ==================== pure core ==================== */

  /* Identity of a firing. The bar timestamp is what makes re-scanning safe:
     the same setup on the same bar is the same trade however many times the
     user presses RUN. */
  function hgFwdKey(rec){
    if (!rec) return '';
    return [rec.tab, rec.mechanic, rec.sym, rec.dir, rec.barT].join('|');
  }

  /* Validate and normalise a candidate record. Returns null when the setup
     cannot be resolved later — a record we could never settle is worse than
     no record, because it would sit in the log looking like pending evidence. */
  function hgFwdNormalize(rec){
    if (!rec || typeof rec !== 'object') return null;
    var entry = fin(rec.entry), stop = fin(rec.stop), t1 = fin(rec.t1), barT = fin(rec.barT);
    if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || !isFinite(barT)) return null;
    if (!rec.tab || !rec.mechanic || !rec.sym) return null;
    var dir = (rec.dir === 'long' || rec.dir === 'short') ? rec.dir : null;
    if (!dir) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    /* target must sit on the correct side of entry, or the record is unsettleable */
    if (dir === 'long' ? !(t1 > entry) : !(t1 < entry)) return null;
    var out = {
      tab: String(rec.tab), mechanic: String(rec.mechanic), sym: String(rec.sym),
      tf: String(rec.tf || ''), dir: dir,
      entry: entry, stop: stop, t1: t1, risk: risk,
      rr: Math.abs(t1 - entry) / risk,
      barT: barT,
      horizonBars: isFinite(fin(rec.horizonBars)) ? fin(rec.horizonBars) : 20,
      /* THE PRICE WHEN THE PLAN FIRED — the one field a fill test needs.

         This log has never modelled a fill. hgFwdSettleOne walks bars after
         barT and tests stop and target immediately, with nothing requiring
         price to have reached `entry`. The in-sample walk DOES require a
         fill and drops 17.8% of its signals as never triggered, and the two
         pools are then compared sigma against sigma inside measured-edge.

         The error is not random. Geometry decides its direction per order
         type, because one side of the plan always sits past the entry:

           entry BELOW mark (a limit, for a long)
             the stop is past the entry, so a loss cannot happen without
             filling — but the target is not, so wins can be recorded for
             trades that never opened.  PHANTOM WINS.

           entry ABOVE mark (a stop entry, for a long)
             the mirror: the target is past the entry, so wins are real, and
             phantom LOSSES are recorded instead.

         Limits are about two thirds of this desk's book, so the net is
         upward — on the very pool that now decides whether anything is ever
         a ticket again.

         `mark` makes the order type recoverable, and without it the record
         simply cannot be settled that way and says so rather than guessing.
         Undefined, never a substitute value: `entry` would read as a market
         order and quietly declare every legacy record filled. */
      mark: (isFinite(fin(rec.mark)) && fin(rec.mark) > 0) ? fin(rec.mark) : undefined,   /* hg-v980: a price, so > 0 -- a mark of zero is the +null trap wearing a number */
      /* THE SCORE THAT ORDERED THE CARD.

         A desk that ranks its setups is making a claim: the one at the top
         is the better bet. OMNIGOLD has ordered gold cards by a composite
         score since it was written and never recorded it, so the claim has
         never been tested. This is the number, at fire time, from the same
         function the renderer sorts on.

         undefined when the tab does not rank, which most do not — a missing
         score must never read as a score of zero, because zero is a real
         and unremarkable value on this scale. */
      balScore: isFinite(fin(rec.balScore)) ? fin(rec.balScore) : undefined,
      /* Whether the gate ledger passed this setup at the time it fired. Not
         used by the stats yet, but recording it now means we can later ask
         the question that actually matters about the gates: do TICKETS
         resolve better than the setups the ledger stood aside? If they do
         not, the ledger is decoration. It cannot be reconstructed after the
         fact, so it has to be written at record time. */
      ticket: rec.ticket === true,
      /* WOULD IT HAVE BEEN A TICKET BUT FOR THE EDGE GATE?

         hg-v756 made measured-edge hard, so a setup with no proven edge
         stands aside and `ticket` is false on every card the desk now
         produces. measured-edge then promotes a mechanic only on twenty
         settled TICKETS — which can never arrive, because the gate itself
         is what stops them being tickets. The gate became the only thing
         that could clear the gate.

         `ticket` stopped being the right population at that moment. This is
         the one that replaced it: every gate passed EXCEPT measured-edge.

         It is not the circularity `ticket` was protecting against. Judging a
         mechanic on ALL its firings condemns it using setups the ledger
         refused for reasons of its own — no trend, wrong regime — and that
         is what emptied both tabs. This population is still only setups the
         ledger cleared; it simply does not ask the gate under test to have
         already passed before its evidence counts.

         undefined when the caller does not say, so a tab that has never
         heard of this cannot be read as having reported false. */
      gateClear: (rec.gateClear === undefined || rec.gateClear === null)
        ? (rec.ticket === true ? true : undefined)      /* a ticket cleared everything, by definition */
        : (rec.gateClear === true),
      /* WAS IT ACTUALLY ON THE SCREEN?

         The same question as `ticket`, one layer further out, and it became
         a different question in hg-v753. Until then a tab recorded roughly
         what it published. OMNIGOLD now forms ~46 plans a day and SHOWS
         about 6: the lane throttle drops a card into a direction/horizon
         whose previous card is still running, because a reader holds one
         gold position and not fifty-five.

         The recording deliberately stays unthrottled — the in-sample pool
         measures the raw mechanic, so the forward pool must measure the
         same thing or the two cannot be compared. But without this flag
         the log can only ever answer "how did the MECHANIC do", never "how
         did the cards I actually saw do", and the second one is the
         question a person has.

         Like `ticket` it cannot be reconstructed after the fact — whether a
         lane was occupied at 09:00 on a Tuesday is not recoverable from the
         record — so it is written at record time and costs one boolean.

         undefined, not false, when the caller does not say: a tab that has
         no concept of throttling has not told us its cards were hidden, and
         defaulting to false would silently claim every one of them was
         shown. */
      shown: (rec.shown === undefined || rec.shown === null) ? undefined : (rec.shown === true),
      /* WAS GOLD EVEN OPEN WHEN THIS FIRED? (hg-v955)

         hg-v952 marked TAURIC's rows, hg-v953 the GOLD SCALP / GOLD SWING
         mints, hg-v954 GOLD DIRECTION's and GOLD ULTRA's ticket rows. Each
         pack said, in as many words, that it marked rather than withheld
         BECAUSE the replay rows need the mark so the population can be
         separated later. Eight files write `goldShut`. Nothing read it —
         and this function, the one place the separation had to happen,
         built its `out` without the field, so every one of those marks was
         discarded at the door. The work was done and dropped on the way out,
         which is hg-v932's finding, and this time in my own packs.

         The precedent is three fields up: `mark` sat accepted-but-never-
         forwarded for exactly the same reason.

         THREE STATES, NOT TWO. Every record written before this exists
         carries no mark, and reading "not shut" as "tradeable" would count
         the entire legacy ledger as gold-open — the same error one layer
         out. undefined means NOT RECORDED and is reported as its own
         bucket, never folded into either side. */
      goldShut: (rec.goldShut === true) ? true
        : (rec.goldShut === false) ? false
        : undefined,   /* anything else is NOT RECORDED -- see below */
      /* ONLY the two booleans. Writing `rec.goldShut === true` alone looks
         equivalent and is not: it turns a truthy non-boolean (a caller
         passing 1) into FALSE, which reads as gold-open — the precise error
         this field exists to prevent, arriving through the coercion instead
         of through the omission. And `!!rec.goldShut` fails the mirror,
         turning a string 'no' into shut. A value that is neither boolean is
         a caller this log does not understand, and the honest record of that
         is the third state, not a guess at one of the first two. */
      /* THE SETUP'S OWN GRADE AT FIRING TIME (A/B/C/D), so the chips can be
         judged out-of-sample. The grade is a CONFLUENCE tally — A is "eight or
         more reads agree" — and confluence has never been shown to predict
         outcome on gold. It plausibly does the opposite: eleven gates measured
         BACKWARDS on the scalp horizon, and every one of them passes when the
         tape is active, which is when a gold move is already spent. An A chip
         that is really a C is worse than no chip.
         It cannot be reconstructed later, so it is written at record time and
         costs one string. */
      grade: (function(g){
        var t = String(g || '').toUpperCase().trim();
        if (t === 'CLEAN') return 'A';
        return (t === 'A' || t === 'B' || t === 'C' || t === 'D') ? t : '';
      })(rec.grade),
      /* HOW MANY OF THE THREE REPLICATED GATES AGREED (0-3, -1 = unknown).
         regime-fit, htf-confirm and hurst-regime are the only gates that
         earned their keep on BOTH horizons in the gate audit. Stacked on top
         of the tape, in-sample on 1,000 PAXG bars:

           SWING @2R   tape alone 31.9%  ->  all three agree 45.0% (n=602)
                       +0.350R, z +5.80 over the tape
           SCALP @2R   tape alone 36.0%  ->  all three agree 38.2% (n=930)
                       z +1.14 — not significant

         That is the strongest result of the whole audit and it is IN-SAMPLE
         on one instrument, which is exactly the evidence this repo refuses to
         trade on. Recording it per firing is how it earns an out-of-sample
         answer instead. */
      stack3: (function(v){
        var n = +v;
        return (isFinite(n) && n >= 0 && n <= 3) ? Math.floor(n) : -1;
      })(rec.stack3),
      /* hg-v979: THE FEED THE LEVELS WERE PRICED ON.

         Every gold desk records sym 'XAUUSD', and hgFwdSettle matches on
         sym + tf, so a record is settled by whichever desk next hands the
         ledger bars of that timeframe -- and the gold desks do not read one
         feed. GOLD SCALP / GOLD SWING price on the XM bridge first;
         GOLD ULTRA / GOLD DIRECTION / GOLD PRO / OPTI GOLD have no XM leg
         and read Binance XAUUSDT, then PAXG. macro.js itself puts PAXG
         "within ~0.5%" of spot, and 91.4% of the stops in GOLD SCALP's
         committed walk (2,605 trades, median 0.219%) are narrower than
         that. A record priced on one feed and settled on another is decided
         by the basis and the trade's direction, not by the tape.

         A string label, exactly as the desk's own feed chain names it
         (xm-xauusd, binance-xau, binance-paxg, delta-xaut, ...). ABSENT
         MEANS ABSENT: a caller that names no feed records none, and such a
         record settles as it always did (hgFwdFeedFits fails open). */
      feed: (typeof rec.feed === 'string' && rec.feed) ? rec.feed : undefined,
      state: 'open', r: null, settledT: null,
      at: isFinite(fin(rec.at)) ? fin(rec.at) : barT
    };
    /* THE 200-PT SOLIDITY SCORE AT FIRING TIME (hg-v533). Optional, three
       tiny scalars: sol (the score), solTier, solV (the stamp version).
       The offline refit judged the score not-predictive (test AUC 0.5192),
       but it judged REPLAY-time stamps that were starved of most pillar
       inputs; since hg-v532 live stamps are scored with the FULL data in
       scope. Whether the full-data score ranks outcomes is therefore an
       open question only forward evidence can answer, and like grade and
       stack3 above, the score cannot be reconstructed later — so it is
       written at record time. ABSENT MEANS ABSENT: a candidate that
       carried no stamp gets no fields, never a fabricated zero. */
    if (isFinite(fin(rec.sol))){
      out.sol = fin(rec.sol);
      out.solTier = String(rec.solTier || '');
      out.solV = String(rec.solV || '');
    }
    return out;
  }

  /* Add a record unless this firing is already logged. Pure: takes and
     returns the list. */
  function hgFwdAdd(list, rec){
    var recs = Array.isArray(list) ? list : [];
    var norm = hgFwdNormalize(rec);
    if (!norm) return { list: recs, added: false, reason: 'unsettleable or malformed' };
    var key = hgFwdKey(norm), i;
    for (i = 0; i < recs.length; i++){
      if (hgFwdKey(recs[i]) === key) return { list: recs, added: false, reason: 'already recorded' };
    }
    var out = recs.concat([norm]);
    /* PRUNE WHAT THE AGGREGATE CAN PRESERVE, BEFORE WHAT IT CANNOT.

       The rule above was "oldest-first, and fold the dropped outcomes into the
       aggregate first, so pruning costs detail and never evidence". That holds
       for a SETTLED record -- its wins/losses/rrSum survive uncapped in the
       aggregate, and only the detail is lost. It does not hold for an OPEN
       one. hgFwdFold folds outcomes, and an open record has none, so pruning
       it does not coarsen the evidence: it destroys it. The trade never
       settles and never counts anywhere.

       Oldest-first is exactly the wrong order for that, because the records
       still waiting are by definition the old ones. CRYPTO SCAN made it
       concrete. It writes one row per setup per 15m bar across the whole
       Delta + CoinDCX universe, and this cap is shared by every instrumented
       tab:

          10 setups/bar     960 rows/day   a record survives ~100h
          20 setups/bar   1,920 rows/day   ~50h
          50 setups/bar   4,800 rows/day   ~20h
         100 setups/bar   9,600 rows/day   ~10h

       against a cap sized, in the comment below, for "a conservative 150
       records/day across ~20 instrumented tabs". A 4h/20-bar gold setup needs
       80 hours of bars before it CAN settle; a 4h/24 desk needs 96; a daily
       desk 240. Driven through the real recorder: one open OMNIGOLD MMOVE
       record, then 3.5 days of CRYPTO SCAN at 50 setups/bar -- the gold record
       is gone and the aggregate is empty. It was not coarsened. It was lost.

       So prune in the order the aggregate can absorb: settled records first
       (evidence preserved), then ones already past their own horizon (nothing
       left to wait for), and only then -- if the cap still is not met -- an
       open record still inside its horizon. Within each group, oldest-first
       as before. No cap, threshold or timeframe changes here; only which row
       is chosen when one has to go. */
    var folded = null;
    if (out.length > MAX_RECORDS){
      var nowSec = Math.floor(Date.now() / 1000);
      /* hgFwdIsPastHorizon answers for BOTH cases: it returns true for a
         settled record (nothing left to wait for) and for an open one whose
         horizon has elapsed. A separate `state` branch here was redundant --
         a mutation that deleted it changed nothing, which is how it was
         found. */
      var giveable = [], owed = [], r, j;
      for (j = 0; j < out.length; j++){
        r = out[j];
        if (!r) continue;
        if (hgFwdIsPastHorizon(r, nowSec)) giveable.push(r);
        else owed.push(r);          /* open, and still inside its own horizon */
      }
      var byBar = function(a, b){ return num(a.barT) - num(b.barT); };
      giveable.sort(byBar);
      owed.sort(byBar);
      var over = (giveable.length + owed.length) - MAX_RECORDS;
      var dropped = [];
      if (over > 0){
        var fromGiveable = Math.min(over, giveable.length);
        dropped = giveable.slice(0, fromGiveable);
        giveable = giveable.slice(fromGiveable);
        over -= fromGiveable;
        /* only if the open-and-still-waiting rows alone exceed the cap */
        if (over > 0){
          dropped = dropped.concat(owed.slice(0, over));
          owed = owed.slice(over);
        }
      }
      /* NOT re-sorted. The old prune left the list in barT order as a side
         effect of how it sliced, but a plain add just concats, so the list
         was only ever sorted immediately after a prune. Restoring that here
         would cost an O(n log n) pass to maintain an invariant that holds
         only sometimes and that no reader relies on -- hgFwdLossStreak orders
         by settledT itself, omnigold.js re-sorts by barT, and the dedup scan
         is order-free. A sometimes-sorted list invites an assumption that
         would be wrong half the time. */
      out = giveable.concat(owed);
      folded = dropped.length ? dropped : null;
    }
    return { list: out, added: true, reason: 'recorded', folded: folded };
  }

  /* Which symbols still have something to settle.

     hgFwdResolve is keyed by SYMBOL and takes the bars, so a desk can only
     settle what it has candles for — and a desk that never calls it records
     evidence that never resolves. CRYPTO SCAN did exactly that: it has
     written 15m records since hg-v735, no desk in the app resolves a crypto
     symbol at 15m (goldultra resolves XAUUSD, everything else runs 4h), and
     hgFwdSettle only matches a record when the timeframes agree. Every one of
     its rows sat open until STALE_HORIZONS turned it into "recorded, then the
     contract went quiet" — which was never true. The bars existed. Nothing
     looked at them.

     Returning the open symbols lets a scanner resolve only what needs it,
     instead of loading the log once per contract across a universe of
     hundreds. Pure. */
  /* SYMBOLS AND RECORDS ARE DIFFERENT UNITS, and a caller needs both.

     hgFwdResolve is keyed by SYMBOL -- it takes one symbol's bars -- but it
     returns the number of RECORDS it settled, and one symbol easily holds
     several: this log writes one record per bar, so a contract that fired on
     three consecutive bars owes three. CRYPTO SCAN divided the record count
     by the symbol count and printed "3/1 open records settled", a ratio that
     can exceed its own denominator. Both counts come off one pass here so a
     caller cannot pick up one and assume the other. */
  function hgFwdOpenTally(list, tab, tf){
    var recs = Array.isArray(list) ? list : [];
    var seen = {}, syms = [], records = 0, i, r;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (!r || r.state !== 'open' || !r.sym) continue;
      if (tab && r.tab !== tab) continue;
      if (tf && r.tf && r.tf !== tf) continue;
      records++;
      if (seen[r.sym]) continue;
      seen[r.sym] = 1;
      syms.push(r.sym);
    }
    return { syms: syms, records: records };
  }

  function hgFwdOpenSyms(list, tab, tf){
    return hgFwdOpenTally(list, tab, tf).syms;
  }

  /* An open record whose bars were never going to arrive.

     NOT a settlement: we do not know the outcome and must never guess one.
     It is reported apart from 'open' because the two mean different things to
     a reader — "still running" and "recorded, then the contract went quiet"
     are not the same evidence, and lumping them together overstates how much
     is still in flight. A live desk showed ~1,200 open records with no way to
     tell which were which. Pure. */
  /* Has an OPEN record's own horizon already elapsed? hgFwdIsStale asks the
     same question with STALE_HORIZONS of slack, because a record is only
     called dead once its bars are well overdue. Pruning needs the tighter
     question: a record whose horizon has passed has nothing left to wait for,
     so it is a better thing to drop than one still inside it. */
  function hgFwdIsPastHorizon(rec, nowSec){
    if (!rec || (rec.state && rec.state !== 'open')) return true;
    var bar = num(rec.barT);
    var hz = num(rec.horizonBars);
    /* a record that cannot say when it fired or how long it needs cannot be
       shown to be still waiting — treat it as droppable rather than pinned */
    if (!isFinite(bar) || !isFinite(hz) || hz <= 0) return true;
    var sec = TF_SEC[rec.tf] || 14400;
    var now = isFinite(num(nowSec)) ? num(nowSec) : Math.floor(Date.now() / 1000);
    return (now - bar) > (hz * sec);
  }

  function hgFwdIsStale(rec, nowSec){
    if (!rec || rec.state !== 'open') return false;
    var bar = num(rec.barT);
    var hz = num(rec.horizonBars);
    if (!isFinite(bar) || !isFinite(hz) || hz <= 0) return false;
    var sec = TF_SEC[rec.tf] || 14400;
    var now = isFinite(num(nowSec)) ? num(nowSec) : Math.floor(Date.now() / 1000);
    return (now - bar) > (hz * sec * STALE_HORIZONS);
  }

  /* Settle one open record against candles. Only bars STRICTLY AFTER the
     firing bar are considered, so a record can never be resolved by data
     that already existed when it was written. Pure.

     SHADOW: BANK HALF AT +1R. Alongside the actual outcome, the same walk
     resolves what "bank half at +1R, stop the rest to breakeven" would have
     done. Why this is measured and not just proposed: on 1,000 PAXG bars per
     horizon, 48% of stopped gold scalps had FIRST reached +1R — a partial
     would have banked them — but that is in-sample, and this repo's standard
     is that strategy changes need out-of-sample evidence. This shadow is how
     that evidence accumulates: every record now carries both outcomes, and in
     a few weeks the forward panel can say which policy actually paid, on
     trades that had not happened when the policy was written down.

     The shadow can only ever settle EARLIER than the actual (its stop
     tightens to breakeven after +1R), so freezing it inside the actual's walk
     is sound: by the time the actual terminates, the shadow already has.
     Ambiguity is resolved against the shadow at every step — a bar touching
     both +1R and the stop is a STOP (candles cannot order intra-bar prints,
     same convention as the actual), and a post-bank bar touching both
     breakeven and T1 banks only the half (+0.5), never the full ride. The
     comparison must not be able to flatter the policy it exists to judge.

       oneR   whether +1R traded before the stop (null while unknowable)
       bankR  the shadow outcome in R; null when the actual expired unsettled
              or T1 sits inside +1R (no banking opportunity — policies equal) */
  /* WHICH ORDER THIS PLAN IS, from where the entry sits against the mark.
     Same rule as the in-sample walk's xmOrderType. Returns null when the
     record carries no mark, because a guess here decides whether a trade
     counted at all. */
  function hgFwdOrderType(rec){
    if (!rec) return null;
    var mark = fin(rec.mark), entry = fin(rec.entry);
    if (!isFinite(mark) || !isFinite(entry) || !(mark > 0)) return null;
    var long = (rec.dir === 'long');
    if (Math.abs(entry - mark) < 1e-9) return long ? 'BUY' : 'SELL';
    if (long) return entry < mark ? 'BUY_LIMIT' : 'BUY_STOP';
    return entry > mark ? 'SELL_LIMIT' : 'SELL_STOP';
  }

  /* hg-v981: THE MARK AND THE BAR, READ OFF THE ROWS A DESK ALREADY HOLDS.
     The crypto desks compose their plans on a series they fetched (the 4h
     tape on SQUEEZE, OI FLOW, EDGE, REVERSAL SNIPER, TRENDMX and the GATES
     tab; the decision bar's series on OMNIROUTE, OMNIPRESENT and DEX
     SCREENER; the signal's own rows on PINE), and the last closed bar of
     that series IS the price when the plan fired and the bar it was judged
     on. One reader, so thirteen record maps do not carry thirteen copies of
     the same two guards (hg-v949). Absent stays absent: a series with no
     readable close or time yields undefined for that field, never zero
     (isFinite(+null) is the +null trap this ledger has met before). */
  function hgFwdLastBar(rows){
    var out = { mark: undefined, barT: undefined };
    try{
      if (!Array.isArray(rows) || !rows.length) return out;
      var b = rows[rows.length - 1];
      if (!b || typeof b !== 'object') return out;
      var c = (typeof b.c === 'number') ? b.c : NaN;
      var t = (typeof b.t === 'number') ? b.t : NaN;
      if (isFinite(c) && c > 0) out.mark = c;
      if (isFinite(t) && t > 0) out.barT = t;
    }catch(e){}
    return out;
  }

  /* hg-v982: WHICH SAMPLE A MEASURED-EDGE JUDGE READS, ONE RULE FOR EVERY
     DESK. A judge is handed the population it chose (tickets, or the
     gate-clear set) and the floor it needs; it reads that population's
     actual tally (samples / hit) -- and when enough of those records know
     whether the order FILLED (fillSamples at or over the same floor), the
     fill-aware tally instead, because that is the one that describes a
     trade somebody could have had: a resting order the tape never reached
     is not a win or a loss, it is nothing. Preferred only when it clears the
     floor on its own, so a log that is mostly legacy records keeps deciding
     exactly as before rather than on a handful of new ones. OMNIGOLD carried
     this rule inline since the fill model shipped; OMNIROUTE, the desk whose
     every order rests (hg-v424) and whose replay never fills 34.3% of what
     it opens, judged on the actual tally alone. Both read this now. */
  function hgFwdJudgeSample(stats, minN){
    var out = { n: NaN, hit: NaN, fillAware: false, unfilled: 0, unprovable: 0 };
    if (!stats || typeof stats !== 'object') return out;
    var floor = fin(minN);
    if (!isFinite(floor) || floor < 0) floor = 0;
    var n = fin(stats.samples), hit = fin(stats.hit);
    if (isFinite(n) && n >= floor && isFinite(hit)){ out.n = n; out.hit = hit; }
    var fn = fin(stats.fillSamples), fh = fin(stats.fillHit);
    if (isFinite(fn) && fn >= floor && isFinite(fh)){
      out.n = fn; out.hit = fh; out.fillAware = true;
      out.unfilled = isFinite(fin(stats.fillUnfilled)) ? fin(stats.fillUnfilled) : 0;
      out.unprovable = isFinite(fin(stats.fillUnprovable)) ? fin(stats.fillUnprovable) : 0;
    }
    return out;
  }

  /* Did this bar reach a resting order? A market order is already filled. */
  function hgFwdOrderTouched(type, bar, entry){
    if (type === 'BUY' || type === 'SELL') return true;
    var h = num(bar.h), l = num(bar.l);
    if (!isFinite(h) || !isFinite(l)) return false;
    if (type === 'BUY_LIMIT' || type === 'SELL_STOP') return l <= entry;
    if (type === 'SELL_LIMIT' || type === 'BUY_STOP') return h >= entry;
    return false;
  }

  /* THE SAME RECORD, SETTLED AS IF THE ORDER HAD TO FILL FIRST.

     Runs beside hgFwdSettleOne and never replaces it. Every record keeps
     the state and R it was settled with, because a log that silently
     restates its own history is worse than one with a known bias — the
     bias can at least be measured against. These are the parallel fields:

       fillState  'filled' | 'unfilled' | 'unprovable' | 'open' | undefined
       stateFill  the fill-aware outcome, same vocabulary as `state`
       rFill      its R

     `unprovable` is the case hg-v756 named in lib/unprovable-fill.mjs: the
     bar that filled the order also touched an exit, and OHLC cannot order
     the two prints, so the position cannot be shown to have existed. It is
     neither a win nor a loss and is excluded rather than guessed.

     undefined everywhere when the record has no mark — a legacy record is
     not evidence about fills in either direction. */
  function hgFwdSettleFill(rec, rows){
    if (!rec || !rows || !rows.length) return null;
    var type = hgFwdOrderType(rec);
    if (!type) return null;                          /* no mark: unknowable */
    /* A MARKET ORDER HAS NO FILL BAR.

       BUY / SELL means entry === mark: the plan enters at the close of
       rec.barT, before the first bar of this walk opened. A resting limit or
       stop is different — it waits for a touch, and if the bar that touches it
       also spans an exit, the order inside that bar is unknown and the row is
       excluded as unprovable. That reasoning does not apply to a market
       order, and applying it anyway treated the bar AFTER the signal as the
       fill bar: every market trade that resolved on its first bar came back
       'unprovable', with the position declared unshowable when it certainly
       existed. Measured over 4,000 synthetic 15m trades, 7.0% of market
       records at CRYPTO SCAN's 1.5R ladder, 8.3% at 1.2R.

       That is not neutral. Unprovable rows are resolved at the cautious end
       (omnigold.js: delete unprovable wins, keep unprovable losses), so the
       mislabel deletes real wins and keeps real losses on a population that
       was never ambiguous. Of the 330 at 1.2R, 52 would have been targets.

       Filled before the loop, the walk resolves from the first bar with the
       same both-in-one-bar -> STOP convention hgFwdSettleOne uses, which is
       the rule this file already states for "the position certainly exists
       and only the exit is unknown". */
    var market = (type === 'BUY' || type === 'SELL');
    var long = (rec.dir === 'long');
    var filled = market, seen = 0, sinceFill = 0, i, t, h, l, hitStop, hitT1;

    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t <= rec.barT) continue;   /* strictly after, as the actual does */
      h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) continue;
      hitStop = long ? (l <= rec.stop) : (h >= rec.stop);
      hitT1   = long ? (h >= rec.t1)   : (l <= rec.t1);

      if (!filled){
        seen++;
        if (!hgFwdOrderTouched(type, rows[i], rec.entry)){
          /* the same window the in-sample walk gives a pending order */
          if (seen >= rec.horizonBars){
            return { fillState: 'unfilled', stateFill: 'unfilled', rFill: null, orderType: type, settledFillT: t };
          }
          continue;
        }
        filled = true;
        /* the fill bar itself carrying an exit is the unprovable case */
        if (hitStop || hitT1){
          return { fillState: 'unprovable', stateFill: null, rFill: null, orderType: type, settledFillT: t };
        }
        continue;                                     /* filled clean; resolve from the next bar */
      }

      sinceFill++;
      /* both in one bar -> STOP, the same convention the actual uses: here
         the position certainly exists and only the exit is unknown */
      if (hitStop) return { fillState: 'filled', stateFill: 'stop', rFill: -1, orderType: type, settledFillT: t };
      if (hitT1)   return { fillState: 'filled', stateFill: 't1', rFill: rec.rr, orderType: type, settledFillT: t };
      if (sinceFill >= rec.horizonBars){
        return { fillState: 'filled', stateFill: 'expired', rFill: null, orderType: type, settledFillT: t };
      }
    }
    return { fillState: filled ? 'open' : 'pending', stateFill: null, rFill: null, orderType: type };
  }

  function hgFwdSettleOne(rec, rows){
    if (!rec || rec.state !== 'open') return rec;
    if (!rows || !rows.length) return rec;
    var i, t, h, l, seen = 0;
    var hitStop, hitT1;
    var long = (rec.dir === 'long');
    var oneLvl = long ? (rec.entry + rec.risk) : (rec.entry - rec.risk);
    var banked = false, shadowR = null;         /* null = not yet resolved */
    var noBank = (rec.rr <= 1);                 /* T1 at/inside +1R: identical policies */
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t <= rec.barT) continue;      /* strictly after */
      seen++;
      h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) continue;
      hitStop = long ? (l <= rec.stop) : (h >= rec.stop);
      hitT1   = long ? (h >= rec.t1)   : (l <= rec.t1);
      /* ---- shadow first, so its state is final before any actual return ---- */
      if (!noBank && shadowR === null){
        if (!banked){
          if (hitStop) shadowR = -1;                          /* stop before +1R */
          else if (long ? (h >= oneLvl) : (l <= oneLvl)){
            banked = true;                                    /* half off at +1R */
            if (hitT1) shadowR = 0.5 + 0.5 * rec.rr;          /* same bar ran on */
            else if (long ? (l <= rec.entry) : (h >= rec.entry)) shadowR = 0.5;  /* conservative: breakeven first */
          }
        } else {
          if (long ? (l <= rec.entry) : (h >= rec.entry)) shadowR = 0.5;         /* breakeven checked first */
          else if (hitT1) shadowR = 0.5 + 0.5 * rec.rr;
        }
      }
      /* ---- actual, unchanged ---- */
      /* both in one bar -> STOP. Candles cannot say which printed first. */
      if (hitStop) return copyWith(rec, { state:'stop', r: -1, settledT: t,
        oneR: banked, bankR: noBank ? -1 : (shadowR !== null ? shadowR : (banked ? 0.5 : -1)) });
      if (hitT1)   return copyWith(rec, { state:'t1',   r: rec.rr, settledT: t,
        oneR: true, bankR: noBank ? rec.rr : (shadowR !== null ? shadowR : 0.5 + 0.5 * rec.rr) });
      if (seen >= rec.horizonBars) return copyWith(rec, { state:'expired', r: null, settledT: t,
        oneR: banked, bankR: null });
    }
    return rec;
  }

  function copyWith(rec, patch){
    var out = {}, k;
    for (k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) out[k] = rec[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    return out;
  }

  /* Settle every open record for one symbol+timeframe. Pure. */
  /* THE BARS HAVE TO BE THE RECORD'S OWN BARS.

     hgFwdSettleOne counts `seen` in the rows it is HANDED and compares that
     count against rec.horizonBars, which is expressed in the RECORD's
     timeframe. Hand it the wrong bars and the horizon silently rescales:

       a 1h record with horizonBars 24 (a day) walked over 4H bars
         gets four days, and a 4H bar that touches stop and target in the
         same bar resolves as STOP, because candles cannot say which
         printed first -- measured over 600 tapes, 5.2% of outcomes flipped
         and EVERY ONE of them was a win turned into a loss;

       a 4H record with horizonBars 20 (over three days) walked over 15m
         bars gets five HOURS -- measured over 600 tapes, 86.3% of outcomes
         changed, 518 of 600 real wins and losses thrown away as premature
         EXPIRY, which the hit rate excludes entirely.

     hgFwdResolve(sym, null, rows) settles EVERY open record for that symbol
     whatever its timeframe, so any gold tab that happened to be open
     settled every other gold tab's records with whichever bars it had
     fetched. Measuring the rows and refusing the mismatch makes the caller's
     mistake impossible rather than merely discouraged. */
  function hgFwdBarSecs(rows){
    if (!Array.isArray(rows) || rows.length < 3) return NaN;
    var gaps = [], i, a, b;
    for (i = 1; i < rows.length && gaps.length < 64; i++){
      a = num(rows[i - 1].t); b = num(rows[i].t);
      if (!isFinite(a) || !isFinite(b) || b <= a) continue;
      gaps.push(b - a);
    }
    if (gaps.length < 2) return NaN;
    /* median, so a weekend gap or one missing bar cannot decide the answer */
    gaps.sort(function(x, y){ return x - y; });
    return gaps[Math.floor(gaps.length / 2)];
  }

  /* Unknown on either side fails OPEN. A record with no timeframe, or bars
     too few or too irregular to measure, settles exactly as it always did:
     refusing those would strand records unsettled for ever, which is the
     louder failure. Only a KNOWN mismatch is refused. */
  function hgFwdBarsFitRec(recTf, barSecs){
    var want = TF_SEC[String(recTf || '')];
    if (!want || !isFinite(barSecs) || barSecs <= 0) return true;
    return Math.abs(barSecs - want) <= want * 0.25;
  }

  /* hg-v979: THE BARS HAVE TO BE THE RECORD'S OWN FEED, TOO.

     The timeframe rule above stops a horizon being rescaled; it says nothing
     about WHOSE PRICES the bars carry. Two desks that fetch the same
     timeframe of XAUUSD from different feeds hand this function bars that
     sit a basis apart, and a stop narrower than that basis is hit -- or a
     target reached -- on the first bar whatever the tape did. Only a KNOWN
     mismatch is refused: a record with no feed, or bars whose caller named
     none, settle exactly as they always did, because refusing what cannot
     be checked would strand records unsettled for ever (the louder
     failure, as the timeframe rule says). A held record is not lost: the
     desk that priced it re-reads its own feed on its next scan and settles
     it there. */
  function hgFwdFeedFits(recFeed, barsFeed){
    var a = (typeof recFeed === 'string' && recFeed) ? recFeed : '';
    var b = (typeof barsFeed === 'string' && barsFeed) ? barsFeed : '';
    if (!a || !b) return true;
    return a === b;
  }

  function hgFwdSettle(list, sym, tf, rows, feed){
    var recs = Array.isArray(list) ? list : [];
    var out = [], changed = 0, heldFeed = 0, i, r;
    var barSecs = hgFwdBarSecs(rows);
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (r.state === 'open' && r.sym === sym && (!tf || !r.tf || r.tf === tf)
          && hgFwdBarsFitRec(r.tf, barSecs)){
        /* hg-v979: a record priced on another feed waits for its own */
        if (!hgFwdFeedFits(r.feed, feed)){ heldFeed++; out.push(r); continue; }
        var s = hgFwdSettleOne(r, rows);
        /* the fill-aware pass runs on the SAME bars in the same call, and is
           written into parallel fields — `state` and `r` are never touched
           by it. A record can be settled by one and still open on the other
           (an order that filled late, say), which is the point: the two
           resolutions are different measurements of the same plan. */
        var f = r.fillState ? null : hgFwdSettleFill(r, rows);
        if (f && f.fillState !== 'pending' && f.fillState !== 'open'){
          s = copyWith(s === r ? r : s, f);
        }
        if (s !== r) changed++;
        out.push(s);
      } else out.push(r);
    }
    return { list: out, changed: changed, heldFeed: heldFeed };
  }

  /* hg-v979: how many of a tab's OPEN records are priced on a feed other
     than the one named -- what a desk whose feed changed would leave
     waiting. Counts only KNOWN mismatches (a record with no feed is not
     waiting for anything). Pure. */
  function hgFwdFeedHeld(list, tab, feed){
    var recs = Array.isArray(list) ? list : [];
    var tabs = null, i, r, out = { held: 0, feeds: {} };
    if (Array.isArray(tab)){ tabs = {}; for (i = 0; i < tab.length; i++) if (tab[i]) tabs[String(tab[i])] = 1; }
    if (typeof feed !== 'string' || !feed) return out;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (!r || r.state !== 'open') continue;
      if (tabs ? !tabs[r.tab] : (tab && r.tab !== tab)) continue;
      if (hgFwdFeedFits(r.feed, feed)) continue;
      out.held++;
      out.feeds[r.feed] = (out.feeds[r.feed] || 0) + 1;
    }
    return out;
  }

  /* Pool settled records into a stat block per mechanic. Mirrors the
     in-sample shape exactly (samples/wins/losses/open/hit/expR) so the same
     verdict helper reads both. 'expired' is excluded from the hit rate — it
     is not a win. Pure. */
  /* ticketOnly stays a boolean for every existing caller, and also accepts
     { ticket, shown } so the log can answer the question hg-v753 created:
     the tab now forms ~46 plans a day and shows about 6, and only the
     record knows which. */
  /* ==================== HOW MUCH OF THIS IS ONE BET? ====================

     A forward record is written per firing bar, so a tab that fires nine
     times in a 4h bar writes nine records — and if each carries a 20-bar
     horizon they are nine views of the same stretch of tape, not nine
     independent trades. omnigold.js corrects its REPLAY intervals with a
     ratio measured on the backtest (hgOgEffN, 0.406). That ratio was
     deliberately NOT applied to forward stats, because importing a constant
     measured on one population into another is the error it exists to fix.

     It does not have to be imported. Every record carries barT, tf and
     horizonBars, which is exactly enough to compute this log's OWN overlap:
     lay each record's [fire, fire + horizon] interval on a line and ask how
     much of the total covered time had more than one open at once.

     effN = n / meanConcurrency, floored at 1 and capped at n. Capped
     because a concurrency below 1 is arithmetic noise, not extra evidence,
     and a sample can never carry more information than it has rows.

     Returns null rather than a guess when the records lack the timing to
     answer — a missing measurement is not a measurement of 1. */
  var TF_SEC = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600,
                 '2h':7200, '4h':14400, '1d':86400 };

  function hgFwdOverlap(list, tab, mechanic, opts){
    var recs = Array.isArray(list) ? list : [];
    /* `tab` takes a list, and `opts.gateClear` narrows to the population a
       promotion is actually judged on — the overlap of the whole log is not
       the overlap of the subset being tested. Same filter vocabulary as
       hgFwdStats so the two cannot describe different populations. */
    var oTabs = null;
    if (Array.isArray(tab)){
      if (tab.length){ oTabs = {}; for (var oi = 0; oi < tab.length; oi++) if (tab[oi]) oTabs[String(tab[oi])] = 1; }
      tab = null;
    }
    var wantGc = !!(opts && opts.gateClear === true);
    var spans = [], i, r, t0, tfs, hb, span;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (!r) continue;
      if (oTabs){ if (!oTabs[String(r.tab)]) continue; }
      else if (tab && r.tab !== tab) continue;
      if (mechanic && r.mechanic !== mechanic) continue;
      if (wantGc && r.gateClear !== true) continue;
      t0 = num(r.barT);
      tfs = TF_SEC[String(r.tf || '')];
      hb = num(r.horizonBars);
      if (!isFinite(t0) || !isFinite(tfs) || !isFinite(hb) || hb <= 0) continue;
      span = tfs * hb;
      if (!(span > 0)) continue;
      spans.push([t0, t0 + span]);
    }
    if (spans.length < 2) return null;

    /* time-weighted mean concurrency: total record-seconds over the seconds
       during which at least one record was open. A union denominator, not a
       sum — quiet stretches must not dilute it. */
    var events = [], k;
    for (k = 0; k < spans.length; k++){ events.push([spans[k][0], 1]); events.push([spans[k][1], -1]); }
    events.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
    var open = 0, prev = events[0][0], covered = 0, weighted = 0;
    for (k = 0; k < events.length; k++){
      var dt = events[k][0] - prev;
      if (dt > 0 && open > 0){ covered += dt; weighted += open * dt; }
      prev = events[k][0];
      open += events[k][1];
    }
    if (!(covered > 0)) return null;
    var meanOpen = weighted / covered;
    if (!(meanOpen > 0)) return null;
    var n = spans.length;
    var effN = n / meanOpen;
    if (!isFinite(effN)) return null;
    effN = Math.max(1, Math.min(n, effN));
    return { n: n, meanConcurrency: meanOpen, effN: effN, coveredSec: covered };
  }

  /* STAMP `shown` ON RECORDS ALREADY WRITTEN.

     A tab records its firings while it evaluates each horizon, and only
     learns which of them reached the screen later, once every horizon is
     collapsed and the lane throttle has run. Rather than restructure that
     order — which would mean recording after the render decision and risk
     losing the record entirely when a render throws — the flag is stamped
     afterwards onto the rows already in the log.

     Write-once: a record that already carries `shown` is left alone, so a
     re-scan of the same bar cannot flip a card from shown to hidden (or
     back) depending on what else happened to be running that minute. Same
     discipline as ONE RECORD PER FIRING at the top of this file.

     `keys` is a set of hgFwdKey strings. Returns how many rows it changed,
     so a caller can tell "nothing to do" from "nothing worked". */
  function hgFwdMarkShown(list, keys, shown){
    var recs = Array.isArray(list) ? list : [];
    var want = (shown === true), changed = 0, i, r, k;
    if (!keys) return 0;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (!r) continue;
      if (r.shown !== undefined) continue;         /* write-once */
      k = hgFwdKey(r);
      if (!k) continue;
      if (Object.prototype.hasOwnProperty.call(keys, k)){ r.shown = want; changed++; }
    }
    return changed;
  }

  /* THE CONSECUTIVE-LOSS STREAK, READ OFF THE LEDGER.

     OMNIGOLD carries a drawdown circuit breaker and an auto-50% sizing
     reduction on three losses in a row. Both read a counter that nothing
     ever wrote: hgOgUpdateDrawdownOnSettle had no call site, so the streak
     was zero forever and the safety control could not fire. The panel was
     honest about it — "Streak: unavailable" — but honest about a control
     that simply did not work.

     This ledger already settles wins and losses. It is the right source,
     and it is the ONLY one available: weekPnl needs account equity and
     risk-per-trade to turn R into %, which no tab in this app has, so that
     half stays unavailable rather than being invented.

     THE RULE, stated because it is a judgement and not an obvious one:

       'stop'     extends the streak. It is a loss.
       't1'       ends it. A winner intervened.
       'expired'  is SKIPPED, neither extending nor ending it. A trade that
                  ran out of horizon is a scratch, not an outcome, and
                  counting it either way would make the control depend on
                  how long a horizon happens to be.

     Ordering is by settledT — when the outcome landed — not barT, which is
     when the setup fired. Two setups written on the same bar can settle days
     apart, and it is the order of OUTCOMES that a streak is about.

     Returns { streak, settled, wins, losses, expired, lastT }. `settled` is
     what separates "measured zero" from "never fed", which is the house rule
     for every number on that tab. */
  function hgFwdLossStreak(list, tab){
    var out = { streak: 0, settled: 0, wins: 0, losses: 0, expired: 0, lastT: NaN };
    var recs = Array.isArray(list) ? list : [];
    var tabList = null, tabName = tab;
    if (Array.isArray(tab)){
      tabName = null;
      if (tab.length){
        tabList = {};
        for (var ti = 0; ti < tab.length; ti++) if (tab[ti]) tabList[String(tab[ti])] = 1;
      }
    }
    var settledRecs = [], i, r;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (!r) continue;
      if (r.state !== 'stop' && r.state !== 't1' && r.state !== 'expired') continue;
      if (tabList && !tabList[String(r.tab)]) continue;
      if (tabName && String(r.tab) !== String(tabName)) continue;
      /* a settled record with no settle time cannot be ordered, and a streak
         is an ordering — it is counted in the totals and left out of the run */
      settledRecs.push({ state: r.state, t: fin(r.settledT), i: i });
      out.settled++;
      if (r.state === 'stop') out.losses++;
      else if (r.state === 't1') out.wins++;
      else out.expired++;
    }
    var ordered = [];
    for (i = 0; i < settledRecs.length; i++) if (isFinite(settledRecs[i].t)) ordered.push(settledRecs[i]);
    if (!ordered.length) return out;
    ordered.sort(function(a, b){ return (a.t - b.t) || (a.i - b.i); });
    out.lastT = ordered[ordered.length - 1].t;
    for (i = ordered.length - 1; i >= 0; i--){
      if (ordered[i].state === 'expired') continue;   /* a scratch decides nothing */
      if (ordered[i].state !== 'stop') break;         /* a winner ends the run */
      out.streak++;
    }
    return out;
  }

  function hgFwdStats(list, tab, mechanic, ticketOnly, agg, nowSec){
    var recs = Array.isArray(list) ? list : [];
    /* `tab` accepts a LIST as well as a name.

       Three tabs run the same mechanics on the same instrument —
       OMNIGOLD:SCALP, GOLDSCALP and SUPER:GOLD — and the settled-evidence
       panel has always pooled them. The gate that decides whether anything
       is a ticket read one, discarding two thirds of its own evidence at
       the exact point where data is the binding constraint.

       Pooling here rather than by summing three stat blocks afterwards,
       because expR and avgRr are ratios: adding them is wrong, and every
       caller that tried would have to carry rrSum to do it right. */
    var tabList = null, tabName = tab;
    if (Array.isArray(tab)){
      tabName = null;                               /* an array is never a name */
      if (tab.length){
        tabList = {};
        for (var ti = 0; ti < tab.length; ti++) if (tab[ti]) tabList[String(tab[ti])] = 1;
      }
      /* an EMPTY list leaves both null, which is "no filter" — the same as
         passing null. An array coerced to a name would compare every record
         against "" and drop the lot. */
    }
    var wantTicket = (ticketOnly && typeof ticketOnly === 'object')
      ? (ticketOnly.ticket === true) : (ticketOnly === true);
    var wantShown = (ticketOnly && typeof ticketOnly === 'object')
      ? (ticketOnly.shown === true) : false;
    /* SETUPS THAT CLEARED EVERY GATE BUT THE EDGE GATE. See `gateClear` in
       hgFwdNormalize: since measured-edge went hard, `ticket` can never
       again be true, so a ticket-only query is a population that has
       stopped growing. This one has not. */
    var wantGateClear = (ticketOnly && typeof ticketOnly === 'object')
      ? (ticketOnly.gateClear === true) : false;
    var wins = 0, losses = 0, open = 0, expired = 0, rrSum = 0, stale = 0, i, r;
    /* MATCHED PAIRS for the bank-half-at-1R shadow: only records carrying a
       finite bankR contribute, and each contributes BOTH its actual and its
       shadow R — comparing the shadow against a different population than the
       actual would be the fill-modelling mistake all over again. */
    var bankN = 0, bankSum = 0, bankActualSum = 0;
    /* the same records settled as if the order had to fill first — see
       hgFwdSettleFill. Counted separately so neither population is hidden. */
    var fillWins = 0, fillLosses = 0, fillUnfilled = 0, fillUnprovable = 0;
    /* Settled outcomes split by the grade the setup carried WHEN IT FIRED, so
       the A/B/C chips can be judged rather than trusted. */
    var byGrade = { A:{n:0,w:0}, B:{n:0,w:0}, C:{n:0,w:0}, D:{n:0,w:0} };
    /* settled outcomes split by how many of the three replicated gates agreed */
    var byStack = { 0:{n:0,w:0}, 1:{n:0,w:0}, 2:{n:0,w:0}, 3:{n:0,w:0} };
    /* Settled outcomes split by the RANK SCORE the desk gave the card, so
       the ordering can be judged rather than trusted. Buckets, not a
       correlation: the score is a composite on an arbitrary scale and the
       only honest question is whether the cards it put near the top did
       better than the ones it put near the bottom. Records with no score —
       every tab that does not rank — land nowhere and are not counted. */
    var byBal = { top:{n:0,w:0}, mid:{n:0,w:0}, low:{n:0,w:0} };
    /* SETTLED OUTCOMES SPLIT BY SIDE, BECAUSE THE IN-SAMPLE BOOK SAYS THEY
       DIFFER AND THE IN-SAMPLE BOOK CANNOT SETTLE IT.

       Four omnigold detectors emit a long label and a short label from one
       function — SPRING/UTAD, PDL/PDH-SWEEP, EQL/EQH-SWEEP, PWL/PWH-SWEEP.
       In the replay the short half is the better half in all four, at every
       bound of the unprovable-fill interval: 12 of 12 comparisons, none
       reversing. That is the only formation cut measured on this walk whose
       SIGN survives the interval; order type, stop distance and session all
       flip.

       It is also not established. Corrected for overlap no pair reaches
       +/-1.9 at any bound, and the four combined peak at -2.15 against a
       family-wise bar of 2.234 — and it is in-sample, on detectors sharing
       an instrument and bars. The only way to find out is to watch it
       forward, which needs the split recorded from now on.

       So: recorded, reported, and used for NOTHING. No filter keys off it,
       no weight reads it, no ordering changed. If it is real it will show
       here in a year; if it was in-sample noise, that will show here too. */
    var byDir = { long:{n:0,w:0}, short:{n:0,w:0} };
    /* Start from any evidence already folded out of the record list. Without
       this, everything pruned would silently vanish from the numbers.
       ticketOnly cannot be answered from the aggregate — it does not keep that
       split — so a ticket-only query deliberately uses live records only and
       is therefore a view of the recent window, not of all time. */
    /* the aggregate keeps no ticket/shown split, so any filtered query is
       deliberately a view of the LIVE window rather than of all time */
    if (agg && !wantTicket && !wantShown && !wantGateClear){
      var aggTabs = tabList ? Object.keys(tabList) : [String(tab || '')];
      for (var ai = 0; ai < aggTabs.length; ai++){
        var a = agg[aggTabs[ai] + '|' + String(mechanic || '')];
        if (a){ wins += (a.wins || 0); losses += (a.losses || 0); expired += (a.expired || 0); rrSum += (a.rrSum || 0);
                bankN += (a.bankN || 0); bankSum += (a.bankSum || 0); bankActualSum += (a.bankActualSum || 0);
                /* the side split rides the same unfiltered path — it exists
                   to be read over years, so it must not be a live-window
                   view of the last four weeks */
                if (a.dir_long){ byDir.long.n += (a.dir_long.n || 0); byDir.long.w += (a.dir_long.w || 0); }
                if (a.dir_short){ byDir.short.n += (a.dir_short.n || 0); byDir.short.w += (a.dir_short.w || 0); } }
      }
    }
    /* The gate-clear split DOES survive pruning now (see hgFwdFold), so a
       gate-clear query reads all time rather than the last few weeks. This
       is the difference between a threshold of twenty being reachable and
       being arithmetic that never lands. Ticket and shown queries stay
       live-window views — no aggregate carries their split. */
    else if (agg && (wantGateClear || wantShown) && !wantTicket && !(wantGateClear && wantShown)){
      /* Both splits are folded now, so either query reads all time. A query
         for BOTH at once has no folded block of its own and stays a live
         view rather than borrowing one of them — an intersection is not
         either of its parts. */
      var gcTabs = tabList ? Object.keys(tabList) : [String(tab || '')];
      for (var gi = 0; gi < gcTabs.length; gi++){
        var ge = agg[gcTabs[gi] + '|' + String(mechanic || '')];
        var ga = ge && (wantGateClear ? ge.gc : ge.sh);
        if (!ga) continue;
        wins += (ga.wins || 0); losses += (ga.losses || 0);
        expired += (ga.expired || 0); rrSum += (ga.rrSum || 0);
        fillWins += (ga.fillWins || 0); fillLosses += (ga.fillLosses || 0);
        fillUnfilled += (ga.fillUnfilled || 0); fillUnprovable += (ga.fillUnprovable || 0);
      }
    }
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (tabList){ if (!tabList[String(r.tab)]) continue; }
      else if (tabName && r.tab !== tabName) continue;
      if (mechanic && r.mechanic !== mechanic) continue;
      if (wantTicket === true && r.ticket !== true) continue;
      /* same rule as `shown`: a record with no gateClear field predates the
         flag and is EXCLUDED rather than assumed either way */
      if (wantGateClear === true && r.gateClear !== true) continue;
      /* shown === true keeps only cards that reached the screen. A record
         with no `shown` field predates the flag (or came from a tab with no
         throttle) and is EXCLUDED from a shown-only query rather than
         assumed — "we never asked" is not "it was shown". */
      if (wantShown === true && r.shown !== true) continue;
      /* Split 'open' before counting it: a record whose bars were never
         going to arrive is not a trade still running. Neither is counted as
         a sample — we do not know the outcome of either. */
      if (r.state === 'open' && hgFwdIsStale(r, nowSec)){ stale++; continue; }
      /* THE FILL-AWARE TALLY, counted beside the actual rather than instead
         of it. Every record contributes to the numbers this function has
         always returned; those with a usable fill resolution ALSO feed
         fillWins/fillLosses, so a caller can compare the two populations
         instead of being handed one and told to trust it.
         'unfilled' is not a loss and 'unprovable' is not an outcome —
         neither counts, and fillUnfilled/fillUnprovable report how many
         were set aside so the gap is visible rather than implied. */
      if (r.stateFill === 't1') fillWins++;
      else if (r.stateFill === 'stop') fillLosses++;
      else if (r.fillState === 'unfilled') fillUnfilled++;
      else if (r.fillState === 'unprovable') fillUnprovable++;
      if (r.state === 't1'){ wins++; rrSum += num(r.rr) || 0; }
      else if (r.state === 'stop') losses++;
      else if (r.state === 'expired') expired++;
      else open++;
      if ((r.state === 't1' || r.state === 'stop') && isFinite(num(r.bankR))){
        bankN++; bankSum += num(r.bankR);
        bankActualSum += (r.state === 't1') ? (num(r.rr) || 0) : -1;
      }
      if ((r.state === 't1' || r.state === 'stop') && byGrade[r.grade]){
        byGrade[r.grade].n++;
        if (r.state === 't1') byGrade[r.grade].w++;
      }
      if ((r.state === 't1' || r.state === 'stop') && byStack[r.stack3]){
        byStack[r.stack3].n++;
        if (r.state === 't1') byStack[r.stack3].w++;
      }
      if ((r.state === 't1' || r.state === 'stop') && isFinite(num(r.balScore))){
        /* cut at the tape term's own size: a card carrying tape agreement
           scores about 100 clear of one that does not, so these thirds are
           "with the tape and agreeing", "one or the other", "neither" */
        var bs = num(r.balScore);
        var slot = bs >= 100 ? 'top' : (bs >= 0 ? 'mid' : 'low');
        byBal[slot].n++;
        if (r.state === 't1') byBal[slot].w++;
      }
      /* a record with no side lands in neither bucket — never a default of
         'long', which would hand one half the other's losses */
      if ((r.state === 't1' || r.state === 'stop') && byDir[r.dir]){
        byDir[r.dir].n++;
        if (r.state === 't1') byDir[r.dir].w++;
      }
    }
    var settled = wins + losses;
    var hit = settled ? wins / settled : NaN;
    /* average reward multiple actually carried by the winners, so expectancy
       reflects the plans recorded rather than an assumed R */
    var avgRr = wins ? (rrSum / wins) : NaN;
    /* With NO winners avgRr is legitimately unknown — there is no winner to
       average — but the EXPECTANCY is not: every settled trade lost 1R, so it
       is exactly -1R and the hit*avgRr term vanishes. Gating expR on
       isFinite(avgRr) printed a dash for the one record that needs no
       inference at all, and a dash reads as "no data" rather than as the
       worst result on the scale. A desk that has never won must not be able
       to hide behind an em dash. */
    var expR;
    if (!settled) expR = NaN;
    else if (!wins) expR = -1;
    else if (isFinite(avgRr)) expR = hit * avgRr - (1 - hit);
    else expR = NaN;
    return { samples: settled, wins: wins, losses: losses, open: open,
             stale: stale, expired: expired, hit: hit, avgRr: avgRr, expR: expR,
             /* the shadow comparison, matched pairs only */
             bankN: bankN,
             bankExpR: bankN ? (bankSum / bankN) : NaN,
             bankActualExpR: bankN ? (bankActualSum / bankN) : NaN,
             /* THE SAME MECHANIC, WITH THE ORDER REQUIRED TO FILL.

                `hit` above assumes you were in the trade from the bar after
                the signal. That is not what a resting order does, and the
                difference is one-directional per order type: a limit can
                record a win it never opened for, a stop entry a loss it
                never opened for. These fields are the honest comparison —
                null when no record carries a mark, because a legacy log is
                not evidence about fills either way. */
             fillSamples: (fillWins + fillLosses) || 0,
             fillWins: fillWins, fillLosses: fillLosses,
             fillHit: (fillWins + fillLosses) ? fillWins / (fillWins + fillLosses) : NaN,
             fillUnfilled: fillUnfilled,
             fillUnprovable: fillUnprovable,
             byGrade: byGrade, byStack: byStack, byBal: byBal, byDir: byDir };
  }

  /* Every mechanic seen for a tab. Pure. */
  function hgFwdPool(list, tab, agg){
    var recs = Array.isArray(list) ? list : [];
    var seen = {}, out = {}, i, k;
    for (i = 0; i < recs.length; i++){
      if (tab && recs[i].tab !== tab) continue;
      seen[recs[i].mechanic] = true;
    }
    /* Mechanics that exist ONLY in the aggregate — every live record pruned —
       must still appear, or a long-running mechanic would drop off the table
       precisely because it had accumulated the most evidence. */
    for (k in (agg || {})) if (Object.prototype.hasOwnProperty.call(agg, k)){
      var parts = k.split('|');
      if (!tab || parts[0] === tab) seen[parts.slice(1).join('|')] = true;
    }
    for (var m in seen) if (Object.prototype.hasOwnProperty.call(seen, m)){
      out[m] = hgFwdStats(recs, tab, m, false, agg);
    }
    return out;
  }

  /* ==================== the aggregate ====================
     The record list is capped, and pruning is oldest-first. On its own that
     quietly destroys the thing this module exists to build: at a conservative
     150 records/day across ~20 instrumented tabs the cap fills in under a
     month, and a mechanic needing ~157 settled trades over ~2.7 months would
     have its earliest evidence pruned before it ever reached significance —
     the same structural failure as the in-sample window, only slower and
     harder to notice.
     So a record is never simply dropped. Before pruning, any SETTLED outcome
     is folded into a per-(tab, mechanic) running aggregate that has no cap.
     Detail is lost; evidence is not. Open and expired records carry no
     outcome, so dropping those costs nothing. */

  var AGG_KEY = 'hg_forward_agg_v1';

  function aggKey(rec){ return String(rec.tab) + '|' + String(rec.mechanic); }

  function loadAgg(){
    try {
      if (typeof localStorage === 'undefined') return {};
      var j = JSON.parse(localStorage.getItem(AGG_KEY) || '{}');
      return (j && typeof j === 'object') ? j : {};
    } catch (e) { return {}; }
  }

  function saveAgg(a){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(AGG_KEY, JSON.stringify(a || {}));
      return true;
    } catch (e) { return false; }
  }

  /* Fold settled records into the aggregate. PURE given the aggregate. */
  function hgFwdFold(agg, recs){
    var out = {}, k;
    for (k in (agg || {})) if (Object.prototype.hasOwnProperty.call(agg, k)) out[k] = agg[k];
    for (var i = 0; i < (recs || []).length; i++){
      var r = recs[i];
      if (!r) continue;
      if (r.state !== 't1' && r.state !== 'stop' && r.state !== 'expired') continue;
      var key = aggKey(r);
      if (!out[key]) out[key] = { wins: 0, losses: 0, expired: 0, rrSum: 0 };
      if (r.state === 't1'){ out[key].wins++; out[key].rrSum += (num(r.rr) || 0); }
      else if (r.state === 'stop') out[key].losses++;
      else out[key].expired++;
      /* the shadow folds too, or pruning would erase exactly the long-run
         evidence this measurement exists to accumulate */
      if ((r.state === 't1' || r.state === 'stop') && isFinite(num(r.bankR))){
        out[key].bankN = (out[key].bankN || 0) + 1;
        out[key].bankSum = (out[key].bankSum || 0) + num(r.bankR);
        out[key].bankActualSum = (out[key].bankActualSum || 0) + ((r.state === 't1') ? (num(r.rr) || 0) : -1);
      }
      /* THE GATE-CLEAR SPLIT FOLDS TOO, OR THE GATE CAN NEVER OPEN.

         Until this existed the aggregate kept no ticket/shown/gateClear
         dimension, so a filtered query could only read live records — and
         the live list is capped at MAX_RECORDS and pruned continuously.
         Since hg-v756 made measured-edge hard, the gate-clear population is
         what promotes a mechanic, and the arithmetic said it could never
         get there: roughly 0.05 usable records per (tab, mechanic) per day
         against a window of about four weeks and a threshold of twenty. It
         asymptotes near three and never moves.

         Detail is still lost — which record, when, at what level. The
         COUNTS survive, and counts are what the threshold reads. Same
         bargain the aggregate was built on.

         The fill-aware counters fold beside them, so the population that
         decides is the one measured on orders that would actually have
         filled rather than the one that assumed they did. */
      var blank = function(){ return { wins: 0, losses: 0, expired: 0, rrSum: 0,
                                       fillWins: 0, fillLosses: 0,
                                       fillUnfilled: 0, fillUnprovable: 0 }; };
      var tally = function(b){
        if (r.state === 't1'){ b.wins++; b.rrSum += (num(r.rr) || 0); }
        else if (r.state === 'stop') b.losses++;
        else b.expired++;
        if (r.stateFill === 't1') b.fillWins++;
        else if (r.stateFill === 'stop') b.fillLosses++;
        else if (r.fillState === 'unfilled') b.fillUnfilled++;
        else if (r.fillState === 'unprovable') b.fillUnprovable++;
      };
      if (r.gateClear === true) tally(out[key].gc || (out[key].gc = blank()));
      /* AND THE CARDS THAT REACHED THE SCREEN.

         `shown` marks the ~6 plans a day the lane throttle publishes out of
         the ~49 formed. It is the only population that answers the question
         a person using this tab actually has — did the cards I SAW pay? —
         as opposed to how the raw unthrottled mechanic did.

         Without this fold that question is answerable only over the live
         window, which the cap keeps at about four weeks. `shown` is the
         throttled subset, so per mechanic it is thinner still: folding it is
         what makes it answerable at all. */
      if (r.shown === true) tally(out[key].sh || (out[key].sh = blank()));
      /* AND THE BARS GOLD ACTUALLY PRINTED (hg-v955).

         hg-v949 measured what pooling these costs: NEW GOLD's whole positive
         reading was the nine of nineteen trades formed while the market was
         shut, and hg-v953 found 26.4% of GOLD SCALP's committed walk in the
         same state. The aggregate could not answer it because the field never
         arrived. It folds here for the reason gateClear and shown fold —
         the live list is capped and pruned, so a split that lives only there
         is unanswerable past about four weeks.

         STRICTLY `=== false`. A record with no mark is not evidence that
         gold was open; it is a record from before anything asked. It lands
         in neither bucket and the reader reports it as its own count. */
      if (r.goldShut === false) tally(out[key].tr || (out[key].tr = blank()));
      if (r.goldShut === true) tally(out[key].wk || (out[key].wk = blank()));
      /* AND THE SIDE, FOR THE SAME REASON THE OTHERS FOLD.

         The long/short split is the slowest measurement on this desk: it
         needs years of settled records per mechanic before it can say
         anything the in-sample walk has not already said badly. Left to the
         live list it would be a rolling four-week view forever, which is
         precisely the window that cannot answer it. Counts only, like the
         rest of the aggregate. */
      if ((r.state === 't1' || r.state === 'stop') && (r.dir === 'long' || r.dir === 'short')){
        var dk = 'dir_' + r.dir;
        if (!out[key][dk]) out[key][dk] = { n: 0, w: 0 };
        out[key][dk].n++;
        if (r.state === 't1') out[key][dk].w++;
      }
    }
    return out;
  }

  /* ==================== health ====================
     Every call site into this module is wrapped in try/catch, because a
     logging failure must never break a scan. But a SILENT logging failure is
     worse than the crash it prevents: evidence stops accumulating, the panel
     keeps saying "nothing recorded yet", and there is no way to tell a quiet
     market from a broken pipeline. That ambiguity is the exact thing this
     workstream exists to remove, so the module reports its own failures.
     Kept in memory plus a small persisted summary, so a fault that happens
     during a scan still shows after a reload. */

  var HEALTH_KEY = 'hg_forward_health_v1';
  var MAX_ERRS = 20;
  var __errs = [];

  function hgFwdWarn(scope, err){
    try {
      var msg = (err && err.message) ? err.message : String(err || 'unknown');
      __errs.push({ scope: String(scope || '?'), msg: msg, at: Date.now() });
      if (__errs.length > MAX_ERRS) __errs = __errs.slice(-MAX_ERRS);
      try {
        if (typeof localStorage !== 'undefined'){
          var prev = null;
          try { prev = JSON.parse(localStorage.getItem(HEALTH_KEY) || 'null'); } catch (e2) { prev = null; }
          var n = (prev && isFinite(+prev.count)) ? (+prev.count + 1) : 1;
          localStorage.setItem(HEALTH_KEY, JSON.stringify({ count: n, scope: String(scope || '?'), msg: msg, at: Date.now() }));
        }
      } catch (e3) { /* storage full or blocked — the in-memory list still holds it */ }
      try { if (typeof console !== 'undefined' && console.warn) console.warn('[hg-forward] ' + scope, err); } catch (e4) {}
    } catch (e) { /* the warner itself must never throw */ }
  }

  function hgFwdHealth(){
    var persisted = null;
    try {
      if (typeof localStorage !== 'undefined') persisted = JSON.parse(localStorage.getItem(HEALTH_KEY) || 'null');
    } catch (e) { persisted = null; }
    return { errors: __errs.slice(), recent: __errs.length, persisted: persisted };
  }

  function hgFwdHealthHTML(){
    var h = hgFwdHealth();
    var n = (h.persisted && isFinite(+h.persisted.count)) ? +h.persisted.count : h.recent;
    if (!n) return '';
    var last = h.errors.length ? h.errors[h.errors.length - 1] : h.persisted;
    return '<div class="note warn"><b>Forward log reported ' + n + ' failure(s).</b> '
         + 'Evidence may be incomplete — a scan that cannot record looks exactly like a quiet market, '
         + 'which is why this says so instead of staying silent.'
         + (last ? ('<br>Last: <b>' + esc(last.scope) + '</b> — ' + esc(last.msg)) : '')
         + '</div>';
  }

  /* ==================== storage (the only impure part) ==================== */

  function load(){
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    } catch (e) { return []; }
  }

  function save(list){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(LS_KEY, JSON.stringify(list || []));
      return true;
    } catch (e) { return false; }   /* quota or private mode — evidence is not correctness */
  }

  /* ==================== window API ==================== */

  if (typeof window !== 'undefined'){
    var W = window;

    /* pure, for tests */
    W.hgFwdKey = hgFwdKey;
    W.hgFwdNormalize = hgFwdNormalize;
    W.hgFwdAdd = hgFwdAdd;
    W.hgFwdSettleOne = hgFwdSettleOne;
    /* the parallel fill-aware resolution, and the order-type rule it uses */
    W.hgFwdSettleFill = hgFwdSettleFill;
    W.hgFwdOrderType = hgFwdOrderType;
    W.hgFwdLastBar = hgFwdLastBar;   /* hg-v981 */
    W.hgFwdJudgeSample = hgFwdJudgeSample;   /* hg-v982 */
    /* exported so a test can drive the fill question directly: a bar with
       no low used to answer "touched" for every resting BUY_LIMIT — see num() */
    W.hgFwdOrderTouched = hgFwdOrderTouched;
    W.hgFwdIsStale = hgFwdIsStale;
    W.hgFwdIsPastHorizon = hgFwdIsPastHorizon;
    W.hgFwdOpenSymsOf = hgFwdOpenSyms;
    W.hgFwdOpenTallyOf = hgFwdOpenTally;
    W.hgFwdSettle = hgFwdSettle;
    W.hgFwdStatsOf = hgFwdStats;
    W.hgFwdLossStreakOf = hgFwdLossStreak;
    W.hgFwdOverlapOf = hgFwdOverlap;
    W.hgFwdMarkShownOf = hgFwdMarkShown;
    W.hgFwdFold = hgFwdFold;
    W.hgFwdAgg = loadAgg;
    W.hgFwdPoolOf = hgFwdPool;
    W.HG_FWD_MAX = MAX_RECORDS;

    /* Record a setup the moment a tab emits it. Safe to call on every scan:
       the same firing on the same bar is recorded once. */
    W.hgFwdRecord = function(rec){
      try {
        var r = hgFwdAdd(load(), rec);
        if (r.added){
          /* Fold BEFORE saving the trimmed list, so a crash between the two
             cannot lose the dropped records' outcomes. */
          if (r.folded && r.folded.length) saveAgg(hgFwdFold(loadAgg(), r.folded));
          save(r.list);
        }
        return r.reason;
      } catch (e) { hgFwdWarn('record', e); return 'error'; }
    };

    /* Hand back fresh candles for a symbol; any open record whose outcome is
       now knowable settles. Call this at the START of a scan, before
       recording the current bar's setups. */
    /* The symbols a scanner still owes bars to. */
    W.hgFwdOpenTally = function(tab, tf){
      try { return hgFwdOpenTally(load(), tab, tf); }
      catch (e){ hgFwdWarn('hgFwdOpenTally', e); return { syms: [], records: 0 }; }
    };
    W.hgFwdOpenSyms = function(tab, tf){
      try { return hgFwdOpenSyms(load(), tab, tf); }
      catch (e){ hgFwdWarn('openSyms', e); return []; }
    };
    /* hg-v979: `feed` names whose prices the bars carry (the desk's own
       feed label for that timeframe). A caller that names none settles as
       it always did; a record priced on a different named feed is HELD for
       its own. hgFwdResolveInfo returns both counts; hgFwdResolve keeps
       returning the settled count every existing caller reads. */
    W.hgFwdResolveInfo = function(sym, tf, rows, feed){
      try {
        var r = hgFwdSettle(load(), sym, tf, rows, feed);
        if (r.changed) save(r.list);
        return { changed: r.changed, heldFeed: r.heldFeed || 0 };
      } catch (e) { return { changed: 0, heldFeed: 0 }; }
    };
    W.hgFwdResolve = function(sym, tf, rows, feed){
      return W.hgFwdResolveInfo(sym, tf, rows, feed).changed;
    };
    W.hgFwdFeedFits = hgFwdFeedFits;
    W.hgFwdFeedHeld = function(tab, feed){
      try { return hgFwdFeedHeld(load(), tab, feed); }
      catch (e) { return { held: 0, feeds: {} }; }
    };

    /* Settle a symbol across SEVERAL timeframes, each against its own bars.

       A desk holds 15m, 1h and 4h candles and its records may sit on any of
       them; resolving once with whichever set happened to be in scope is what
       produced the mismatch above. Pass them all and each record is walked
       over the bars it was written on. */
    W.hgFwdResolveMulti = function(sym, byTf, feedByTf){
      var total = 0, tf;
      if (!byTf) return 0;
      for (tf in byTf) if (Object.prototype.hasOwnProperty.call(byTf, tf)){
        var rows = byTf[tf];
        if (!rows || !rows.length) continue;
        /* hg-v979: one label for every timeframe, or a per-timeframe map
           (the desks' own gold.src shape) -- a timeframe the map does not
           name passes no feed and settles as before */
        var feed = (typeof feedByTf === 'string') ? feedByTf
                 : ((feedByTf && typeof feedByTf === 'object' && typeof feedByTf[tf] === 'string') ? feedByTf[tf] : undefined);
        try { total += (W.hgFwdResolve(sym, tf, rows, feed) || 0); } catch (e) {}
      }
      return total;
    };

    W.hgFwdBarSecs = hgFwdBarSecs;
    W.hgFwdBarsFitRec = hgFwdBarsFitRec;

    /* This log's OWN overlap, measured from its own barT/tf/horizonBars —
       so a forward interval can be widened by what THIS population did,
       never by a ratio borrowed from the backtest. */
    /* stamp which of the already-recorded firings reached the screen */
    W.hgFwdMarkShown = function(keys, shown){
      try {
        var list = load();
        var n = hgFwdMarkShown(list, keys, shown);
        if (n) save(list);
        return n;
      } catch (e){ hgFwdWarn('hgFwdMarkShown', e); return 0; }
    };
    W.hgFwdOverlap = function(tab, mechanic, opts){
      try { return hgFwdOverlap(load(), tab, mechanic, opts); }
      catch (e){ hgFwdWarn('hgFwdOverlap', e); return null; }
    };
    /* Out-of-sample stats, same shape the in-sample pool uses, so
       hgOmniPoolRead() reads either without translation. */
    /* the live streak for a tab or a pooled list of tabs */
    W.hgFwdLossStreak = function(tab){
      try { return hgFwdLossStreak(load(), tab); }
      catch (e) { hgFwdWarn('lossStreak', e);
                  return { streak: 0, settled: 0, wins: 0, losses: 0, expired: 0, lastT: NaN }; }
    };

    W.hgFwdStats = function(tab, mechanic, ticketOnly){
      try { return hgFwdStats(load(), tab, mechanic, ticketOnly, loadAgg()); }
      catch (e) { hgFwdWarn('stats', e); return { samples:0, wins:0, losses:0, open:0, expired:0, hit:NaN, avgRr:NaN, expR:NaN }; }
    };
    W.hgFwdPool = function(tab){
      try { return hgFwdPool(load(), tab, loadAgg()); }
      catch (e) { hgFwdWarn('pool', e); return {}; }
    };

    /* EVERY DESK NAME THE LOG ACTUALLY HOLDS, live records and aggregate both.

       A reader that has to NAME a pool can only ever name the ones it was
       told about, and several desks write a FAMILY of pools rather than one:
       OMNIGOLD:SCALP and OMNIGOLD:SWING, NEWGOLD:1H and NEWGOLD:4H,
       GOLDPINE:scalp and GOLDPINE:swing, CARD:<scanId> per inline scanner.
       Hard-coding those suffixes puts a second list in a second file to drift
       out of step with the first -- which is exactly how a roster ends up
       naming a pool nothing writes. This lets a caller ask the log what is in
       it and resolve a family by its stem. */
    W.hgFwdTabs = function(prefix){
      try {
        var seen = {}, out = [], recs = load(), agg = loadAgg(), i, k, t;
        for (i = 0; i < recs.length; i++){
          t = recs[i] && recs[i].tab;
          if (t && !seen[t]){ seen[t] = 1; out.push(t); }
        }
        for (k in (agg || {})) if (Object.prototype.hasOwnProperty.call(agg, k)){
          t = String(k).split('|')[0];
          if (t && !seen[t]){ seen[t] = 1; out.push(t); }
        }
        if (prefix){
          prefix = String(prefix);
          out = out.filter(function(n){ return n.indexOf(prefix) === 0; });
        }
        out.sort();
        return out;
      } catch (e) { hgFwdWarn('tabs', e); return []; }
    };

    /* Record a whole scan's output in one call — the shape every tab needs.

       WHICH BAR. Flooring NOW to the timeframe names the FORMING bar, and an
       engine votes on CLOSED bars: cryptoultra's closedRows drops the forming
       one, so the bar it actually read is always the one before. Measured on
       15m, the gap is exactly one bar for an instant scan and two when the
       scan straddles a boundary — CRYPTO SCAN walks hundreds of contracts with
       two sequential fetches each and calls this once at the end, so straddles
       are routine.

       Three consequences, all from the same line:

         - the record names a bar that had not closed when the setup was made,
           implying information the engine did not have;
         - settlement walks rows STRICTLY AFTER barT, so the first bar of the
           trade is skipped. A setup entered at the close of 13:45 was settled
           from 14:15, never from 14:00 — and on a 15m scalp that first bar is
           where most fills and stops happen;
         - the dedup rule breaks on the case it exists for. Two scans that
           voted on the SAME closed bar, one ending at 14:58 and one at 15:03,
           get barT 14:45 and 15:00, so one firing becomes two records.

       A caller that knows which bar it read now says so: a finite c.barT wins,
       and nothing else changes. CRYPTO SCAN has always had it — res.bar.t, the
       closed bar the card prints as "closed 15m bar ... UTC". Callers that do
       not pass one keep the floor-of-now behaviour exactly.

       Returns how many NEW trades were recorded. */
    W.hgFwdRecordScan = function(tab, tf, cands, opts){
      try {
        if (!tab || !Array.isArray(cands) || !cands.length) return 0;
        var sec = TF_SEC[tf] || 14400;
        var nowSec = Date.now() / 1000;
        var barT = Math.floor(nowSec / sec) * sec;
        /* the bar a caller says it read, floored to the timeframe and never
           in the future — a future bar is not a bar anything was read on */
        function barOf(c){
          var v = +(c && c.barT);
          /* hg-v978: a candidate carrying the instant its mint judged it on
             (signalT, ms, hg-v977) has said which bar it read. Read when no
             barT was given; absent both, the floor-of-now behaviour exactly.
             Seven gold desks recorded on the floor of now for the whole life
             of this ledger, with every consequence the note above names. */
          if (!(isFinite(v) && v > 0)){
            var st = (c && typeof c.signalT === 'number' && isFinite(c.signalT) && c.signalT > 0) ? c.signalT : NaN;
            if (isFinite(st)) v = (st > 1e12) ? st / 1000 : st;
          }
          if (!isFinite(v) || v <= 0) return barT;
          var f = Math.floor(v / sec) * sec;
          return (f > barT) ? barT : f;
        }
        var o = opts || {};
        var added = 0, i, c;
        for (i = 0; i < cands.length; i++){
          c = cands[i];
          if (!c) continue;
          var r = W.hgFwdRecord({
            tab: tab,
            mechanic: c.mechanic || c.strategy || o.mechanic || tf,
            sym: c.sym || c.symbol,
            tf: tf,
            dir: c.dir,
            entry: c.entry, stop: c.stop, t1: c.t1,
            /* THE PRICE WHEN THE PLAN FIRED. hgFwdNormalize has accepted this
               since the fill model was written, and this entry point never
               forwarded it — so no desk recording through hgFwdRecordScan has
               ever had a mark, hgFwdOrderType returned null on every one of
               their records, and the fill-aware pass stood aside for all of
               them. Absent still means absent: a caller that passes none
               records none, and the fill walk keeps standing aside. */
            mark: c.mark,
            /* hg-v979: the feed the levels were priced on -- per candidate,
               or one label for the scan. Absent stays absent. */
            feed: (typeof c.feed === 'string' && c.feed) ? c.feed
                : ((typeof o.feed === 'string' && o.feed) ? o.feed : undefined),
            barT: barOf(c),
            horizonBars: o.horizonBars || 20,
            ticket: (c.ticket !== undefined) ? c.ticket : (o.ticket === true),
            /* accept the grade wherever the calling desk keeps it */
            grade: c.grade || c.engineGrade || (c.gradeObj && c.gradeObj.letter) || o.grade || '',
            /* stack3 from OMNIROUTE and OMNIGOLD, passed through unchanged */
            stack3: c.stack3,
            /* hg-v955: the gold calendar mark. hg-v954 set this on the rows
               GOLD DIRECTION and GOLD ULTRA hand in, and this entry point
               dropped it — the `mark` defect above, repeated. Absent stays
               absent: a caller that marks nothing records nothing. */
            goldShut: c.goldShut,
            /* solidity stamp fields (hg-v533) ride through untouched;
               hgFwdNormalize attaches them only when sol is finite */
            sol: c.sol, solTier: c.solTier, solV: c.solV
          });
          if (r === 'recorded') added++;
        }
        return added;
      } catch (e) { return 0; }
    };

    /* A drop-in panel any tab can render with one line. Kept here rather than
       in each tab so the wording, the thresholds and the honest empty state
       stay identical everywhere — the alternative is forty tabs each
       describing out-of-sample evidence slightly differently.
       Verdicts come from hgOmniPoolRead when it is loaded; without it the panel
       still lists counts and simply omits verdicts.

       WHICH BAR. This used to say "exactly the same +/-2 sigma bar as the
       in-sample one", and that stopped being true when the in-sample table
       moved its POSITIVE bar to the family-wise threshold. Worse, the call
       passed no bar at all, so after that change every forward panel in the
       app silently inherited omniroute's 27-MECHANIC default — a gold panel
       judged by the crypto count.

       The bar is derived from the rows this panel is actually rendering. That
       is the honest number: a reader looking at a table of N mechanics and
       noticing the best one has searched N ways, whether the numbers are
       in-sample or out. The negative side keeps -2 sigma, because noticing
       that one named mechanic is losing is not a search. */
    W.hgFwdPanelHTML = function(tab, opts){
      try {
        var o = opts || {};
        var pool = W.hgFwdPool(tab) || {};   /* already merges the aggregate */
        var keys = [], k;
        for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
        keys.sort();
        var title = o.title || 'FORWARD — out-of-sample, accumulated across scans';
        var healthHtml = hgFwdHealthHTML();
        if (!keys.length){
          return healthHtml + '<div class="note"><b>' + esc(title) + '</b><br>'
               + 'Nothing recorded yet. This fills as scans run: each setup is logged once when it '
               + 'fires and settled later by bars that had not printed at the time. Unlike every '
               + 'other measurement in the app, it is never re-read from the current window.</div>';
        }
        var readFn = (typeof W.hgOmniPoolRead === 'function') ? W.hgOmniPoolRead : null;
        var minRr = isFinite(+o.minRr) ? +o.minRr : 2;
        /* Correct over the rows THIS panel shows, not over another desk's
           mechanic count. o.barZ lets a caller state its own if it has reason
           to. */
        var barZ = isFinite(+o.barZ) && +o.barZ > 0 ? +o.barZ
                 : ((typeof W.hgOmniFamilyZ === 'function') ? W.hgOmniFamilyZ(Math.max(1, keys.length)) : 2);
        /* ── SETTLED IS NOT INDEPENDENT ──

           This file opens by stating its own target in NON-OVERLAPPING
           trades, and hgFwdOverlap exists to count them. The panel never
           called it: SETTLED was a raw row count, `needs ~N` is derived in
           non-overlapping units, and hgOmniPoolRead's standard error is
           sqrt(p(1-p)/samples) over that same raw count -- so the READ
           column could say "has paid" on concurrency alone.

           It matters most on a CROSS-SECTIONAL desk. CRYPTO SCAN fires on
           every contract in the universe on ONE bar with ONE 24-bar horizon,
           so every row from a scan is perfectly concurrent with every other
           and effN collapses to (bars scanned / horizon), no matter how many
           contracts fired. Measured with hgFwdOverlap on that exact shape:

             200 setups/bar over  100 bars   n = 20,000   effN  5.13
              40 setups/bar over   96 bars   n =  3,840   effN  4.96
              40 setups/bar over  960 bars   n = 38,400   effN 40.96

           A day of scanning is about five independent observations. The
           ~157 this file opens with is ~39 days at that shape, not four bars.

           effN is measured over the rows that still carry barT/tf/horizon.
           Pruned rows are folded into the aggregate, which keeps no timing,
           so this is a LOWER BOUND on all-time independence -- the honest
           direction, and coverage is printed beside it. Where hgFwdOverlap
           cannot answer it returns null and nothing is printed: a missing
           measurement is not a measurement of 1.

           The corrected READ is hgOmniPoolRead run again on the SAME hit rate
           with effN in place of samples -- the same arithmetic and the same
           20-sample floor, no new threshold and no change to any gate. The
           uncorrected read stays visible beside it. */
        var ovFn = (typeof W.hgFwdOverlapOf === 'function') ? W.hgFwdOverlapOf : null;
        var liveList = null;
        try { liveList = load(); } catch (eL){ liveList = null; }

        var h = healthHtml + '<h4>' + esc(title) + '</h4>';
        h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SETTLED</th><th>INDEP</th>'
           + '<th>T1-FIRST</th><th>EXPECTANCY</th><th>OPEN</th><th>READ</th></tr></thead><tbody>';
        var i, p, v, anyOv = false, anyDemoted = false;
        for (i = 0; i < keys.length; i++){
          p = pool[keys[i]];
          v = readFn ? readFn(p, minRr, 20, barZ) : null;

          /* independence for THIS mechanic */
          var ov = null, effN = NaN, liveSettled = NaN;
          if (ovFn && liveList && p.samples){
            try { ov = ovFn(liveList, tab, keys[i], {}); } catch (eO){ ov = null; }
            try {
              var ls = hgFwdStats(liveList, tab, keys[i], false, null);
              liveSettled = ls ? ls.samples : NaN;
            } catch (eS){ liveSettled = NaN; }
          }
          if (ov && isFinite(ov.effN)){ effN = ov.effN; anyOv = true; }

          /* the same read, on the same hit rate, with effN in place of n */
          var vEff = null;
          if (readFn && isFinite(effN) && p.samples){
            try { vEff = readFn({ samples: effN, hit: p.hit }, minRr, 20, barZ); } catch (eR){ vEff = null; }
          }
          /* A mechanic with open trades and none settled has NOT "never
             fired" — it has fired and is waiting. The shared verdict helper
             only speaks about settled samples, so that distinction has to be
             made here or the panel misreports its own pending evidence. */
          var read, cls;
          if (!p.samples){
            read = p.open ? (p.open + ' awaiting settlement')
                          : (p.stale ? 'nothing settled — ' + p.stale + ' stale' : 'never fired');
            cls = '';
          } else if (vEff){
            /* corrected read leads; the uncorrected one is kept beside it so
               nothing is hidden, and flagged when the two disagree */
            read = vEff.read;
            cls = vEff.cls;
            if (v && v.read !== vEff.read){ read += ' (on n: ' + v.read + ')'; anyDemoted = true; }
          } else {
            read = v ? v.read : 'unjudged';
            cls = v ? v.cls : '';
          }
          /* `needs ~N` is derived in NON-OVERLAPPING units, so it belongs
             beside the independent count, not the raw one */
          var need = hgFwdNeedText(vEff ? (vEff.need || (v && v.need)) : (v && v.need));
          var indep;
          if (!p.samples) indep = '<span class="dim">—</span>';
          else if (!isFinite(effN)) indep = '<span class="dim">unmeasured</span>';
          else {
            indep = '<b>' + (effN >= 10 ? effN.toFixed(0) : effN.toFixed(1)) + '</b>' + need;
            if (isFinite(liveSettled) && liveSettled < p.samples){
              indep += ' <span class="dim">(from ' + liveSettled + ' timed)</span>';
            }
          }
          h += '<tr><td><b>' + esc(keys[i]) + '</b></td>'
             + '<td>' + p.samples + '</td>'
             + '<td>' + indep + '</td>'
             + '<td>' + (p.samples ? (p.hit * 100).toFixed(0) + '%' : '—') + '</td>'
             + '<td>' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—') + '</td>'
             + '<td class="dim">' + p.open
             + (p.stale ? (' <span class="dim">/' + p.stale + ' stale</span>') : '')
             + (p.expired ? (' <span class="dim">/' + p.expired + ' exp</span>') : '') + '</td>'
             + '<td><span class="gpip ' + cls + '">' + esc(read) + '</span></td></tr>';
        }
        h += '</tbody></table>';
        if (anyOv){
          h += '<div class="note"><b>INDEP</b> — settled rows are not independent observations. '
            + 'Records that were open at the same time move together, so the standard error behind '
            + 'READ has to be taken over n/mean-concurrency, not over the row count. INDEP is that '
            + 'number, measured from each record\'s own bar and horizon (hgFwdOverlap), and the '
            + '<b>needs ~N</b> target sits beside it because that target was always in '
            + 'non-overlapping units. Rows folded into the all-time aggregate carry no timing, so '
            + 'INDEP is a LOWER BOUND where the counts differ. READ is now judged on INDEP; where '
            + 'the raw count said something else it is shown in brackets'
            + (anyDemoted ? ', which it does above' : '') + '.</div>';
        }
        /* THE SHADOW LINE. Sums the matched pairs across every mechanic shown
           and prints both policies side by side. Nothing is recommended until
           the gap is worth acting on over a real sample — this line is the
           evidence accumulating in public, not a verdict. */
        (function(){
          var bn = 0, bs = 0, ba = 0, bi2;
          for (bi2 = 0; bi2 < keys.length; bi2++){
            var bp = pool[keys[bi2]];
            if (bp && bp.bankN){ bn += bp.bankN; bs += bp.bankN * bp.bankExpR; ba += bp.bankN * bp.bankActualExpR; }
          }
          if (bn > 0){
            var sh = bs / bn, ac = ba / bn;
            h += '<div class="note"><b>SHADOW — bank half at +1R, rest to breakeven</b>: '
              + bn + ' settled pair' + (bn === 1 ? '' : 's') + ' · as traded '
              + (ac >= 0 ? '+' : '') + ac.toFixed(2) + 'R vs shadow '
              + (sh >= 0 ? '+' : '') + sh.toFixed(2) + 'R per trade. '
              + (bn < 30 ? 'Too few pairs to act on — accumulating.'
                         : 'A persistent gap here is out-of-sample evidence; in-sample, 48% of stopped gold scalps had first reached +1R.')
              + '</div>';
          }
        })();
        /* THE GRADE LINE. The A/B/C chips grade by CONFLUENCE COUNT — A means
           eight or more reads agree. Whether that predicts anything on gold is
           an open question and a doubtful one: eleven gates measured backwards
           on the scalp horizon, and they all pass when the tape is active,
           which is when a gold move is already spent. This is where the chips
           get judged on trades recorded before their outcomes existed. */
        (function(){
          var g, tot = 0, gs = { A:{n:0,w:0}, B:{n:0,w:0}, C:{n:0,w:0}, D:{n:0,w:0} };
          for (var gi = 0; gi < keys.length; gi++){
            var gp = pool[keys[gi]];
            if (!gp || !gp.byGrade) continue;
            for (g in gs) if (gp.byGrade[g]){ gs[g].n += gp.byGrade[g].n; gs[g].w += gp.byGrade[g].w; tot += gp.byGrade[g].n; }
          }
          if (!tot) return;
          var parts = [];
          for (g in gs) if (gs[g].n) parts.push(g + ' ' + (100 * gs[g].w / gs[g].n).toFixed(0) + '% (n=' + gs[g].n + ')');
          h += '<div class="note"><b>BY GRADE</b> — T1-first on settled records, split by the grade the '
            + 'setup carried when it fired: ' + esc(parts.join(' · ')) + '. '
            + (tot < 40
                ? 'Too few to judge the chips yet — accumulating.'
                : 'If A does not beat C here, the chips are counting confluence rather than measuring edge.')
            + '</div>';
        })();
        /* THE STACK LINE. Each desk earned its own stack, so the wording is
           per-tab. GOLD: regime-fit + htf-confirm + hurst-regime were the
           only gates that replicated on both horizons — in-sample (close-by-
           close re-measure) the swing horizon went 31.6% on tape alone to
           44.2% with all three, z +5.68. CRYPTO (OMNIROUTE): regime and
           htf-confirm replicated on both 4h and 1h across 10 Binance majors,
           stoch-rsi marginally; gold's other two gates did NOT survive
           there. This is where each claim gets checked against trades
           recorded before their outcomes existed. */
        (function(){
          var isGoldTab = String(tab).indexOf('OMNIGOLD') === 0 || String(tab).indexOf('GOLD') === 0;
          var stackNames = isGoldTab
            ? 'regime-fit, htf-confirm and hurst-regime'
            : 'regime, htf-confirm and stoch-rsi';
          var stackCtx = isGoldTab
            ? 'In-sample the swing horizon ran 31.6% on tape alone against 44.2% with all three; this is the out-of-sample check on that.'
            : 'In-sample (10 Binance majors) BTC-regime-aligned firings ran 32.2% at 2R against 35.0% with htf-confirm stacked on; this is the out-of-sample check on that.';
          var st = { 0:{n:0,w:0}, 1:{n:0,w:0}, 2:{n:0,w:0}, 3:{n:0,w:0} }, tot = 0, k, si;
          for (si = 0; si < keys.length; si++){
            var sp = pool[keys[si]];
            if (!sp || !sp.byStack) continue;
            for (k in st) if (sp.byStack[k]){ st[k].n += sp.byStack[k].n; st[k].w += sp.byStack[k].w; tot += sp.byStack[k].n; }
          }
          if (!tot) return;
          var bits = [];
          for (k in st) if (st[k].n) bits.push(k + '/3 ' + (100 * st[k].w / st[k].n).toFixed(0) + '% (n=' + st[k].n + ')');
          h += '<div class="note"><b>REPLICATED-GATE STACK</b> — T1-first by how many of '
            + stackNames + ' agreed: ' + esc(bits.join(' · ')) + '. '
            + (tot < 40 ? 'Too few to judge yet — accumulating.' : stackCtx)
            + '</div>';
        })();
        h += '<div class="note">Recorded once per firing when it fires, settled later by bars that did '
           + 'not exist at the time. A bar spanning both stop and target counts as a STOP; expiry is '
           + 'excluded rather than counted as a win. This is the only measurement here that accumulates.</div>';
        return h;
      } catch (e) { return ''; }
    };

    /* Every tab's evidence in one table. Most tabs record but have no panel
       of their own, so without this the instrumentation is write-only —
       fifteen tabs banking evidence nobody can read.
       This lives beside SCORECARD's ledger rather than replacing it. That
       ledger dedups by symbol+direction within 24h, which is correct for
       "did this SETUP pay" but collapses distinct mechanics: if two tabs
       both fire long BTC today it keeps one. Measuring which MECHANIC pays
       needs the tab+mechanic+bar key used here, so the two answer different
       questions and both are worth having. */
    W.hgFwdAllHTML = function(opts){
      try {
        var o = opts || {};
        var list = load();
        if (!list.length && !Object.keys(loadAgg()).length){
          return hgFwdHealthHTML() + '<div class="note"><b>FORWARD LEDGER — every tab, out-of-sample</b><br>'
               + 'Nothing recorded yet. Each tab logs a setup once when it fires and settles it later '
               + 'against bars that had not printed at the time. Run the scanners and this fills; '
               + 'unlike every other measurement in the app it is never re-read from the current window.</div>';
        }
        var agg = loadAgg();
        var tabs = {}, i, r, ak;
        for (i = 0; i < list.length; i++){
          r = list[i];
          if (!tabs[r.tab]) tabs[r.tab] = true;
        }
        /* Tabs whose live records have all been pruned still have evidence in
           the aggregate — they must not disappear from the ledger. */
        for (ak in agg) if (Object.prototype.hasOwnProperty.call(agg, ak)) tabs[ak.split('|')[0]] = true;
        var names = [];
        for (var t in tabs) if (Object.prototype.hasOwnProperty.call(tabs, t)) names.push(t);
        names.sort();
        var readFn = (typeof W.hgOmniPoolRead === 'function') ? W.hgOmniPoolRead : null;
        var minRr = isFinite(+o.minRr) ? +o.minRr : 2;
        /* Count the rows before rendering them: this table spans every tab, so
           the search a reader performs over it is wider than any one desk's. */
        var ledgerRows = 0;
        for (var ci = 0; ci < names.length; ci++){
          var cp = hgFwdPool(list, names[ci], agg);
          for (var cm in cp) if (Object.prototype.hasOwnProperty.call(cp, cm)) ledgerRows++;
        }
        var barZ = (typeof W.hgOmniFamilyZ === 'function') ? W.hgOmniFamilyZ(Math.max(1, ledgerRows)) : 2;
        var h = hgFwdHealthHTML() + '<h3>FORWARD LEDGER — every tab, out-of-sample</h3>';
        h += '<table class="tbl"><thead><tr><th>TAB</th><th>MECHANIC</th><th>SETTLED</th>'
           + '<th>T1-FIRST</th><th>EXPECTANCY</th><th>OPEN</th><th>READ</th></tr></thead><tbody>';
        var totS = 0, totW = 0, totO = 0, rowsOut = 0;
        for (i = 0; i < names.length; i++){
          var pool = hgFwdPool(list, names[i], agg);
          var mechs = [];
          for (var m in pool) if (Object.prototype.hasOwnProperty.call(pool, m)) mechs.push(m);
          mechs.sort();
          for (var j = 0; j < mechs.length; j++){
            var p = pool[mechs[j]];
            /* SUPER: tabs are SELECTION layers — they re-present setups their
               source tab already recorded, after a conviction filter. Their own
               numbers are meaningful (does the filter beat the pool?), but they
               are not distinct trades, so they are shown and excluded from the
               totals rather than double-counted. */
            var isSel = names[i].indexOf('SUPER:') === 0;
            if (!isSel){ totS += p.samples; totW += p.wins; totO += p.open; }
            rowsOut++;
            var v = readFn ? readFn(p, minRr, 20, barZ) : null;
            var read = !p.samples ? (p.open ? (p.open + ' awaiting settlement')
                                             : (p.stale ? 'nothing settled — ' + p.stale + ' stale' : 'never fired'))
                                  : (v ? v.read : 'unjudged');
            var cls = !p.samples ? '' : (v ? v.cls : '');
            var need = hgFwdNeedText(v && v.need);
            h += '<tr><td class="dim">' + esc(names[i]) + (isSel ? ' <span class="dim">(selection)</span>' : '')
               + '</td><td><b>' + esc(mechs[j]) + '</b></td>'
               + '<td>' + p.samples + need + '</td>'
               + '<td>' + (p.samples ? (p.hit * 100).toFixed(0) + '%' : '—') + '</td>'
               + '<td>' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—') + '</td>'
               + '<td class="dim">' + p.open + '</td>'
               + '<td><span class="gpip ' + cls + '">' + esc(read) + '</span></td></tr>';
          }
        }
        h += '</tbody></table>';
        h += '<div class="note">' + rowsOut + ' mechanic(s) across ' + names.length + ' tab(s) · '
           + totS + ' settled, ' + totO + ' open <span class="dim">(selection desks excluded from these '
           + 'totals — they re-present setups their source tab already recorded, so counting them again '
           + 'would inflate the trade count; their own rows above still stand)</span>'
           + (totS ? (' · ' + (totW / totS * 100).toFixed(0) + '% T1-first overall') : '')
           + '. Recorded once per firing, settled by bars that did not exist at the time; a bar spanning '
           + 'both stop and target counts as a STOP, and expiry is excluded rather than counted as a win. '
           + 'This sits alongside the SCORECARD ledger below, which dedups by symbol and direction over 24h '
           + '— right for "did this setup pay", but it merges mechanics, so per-mechanic evidence is keyed '
           + 'separately here.</div>';
        return h;
      } catch (e) { return ''; }
    };

    /* ==================== DESK VERDICT + PAID-ONLY (hg-v540) ====================
       Shared builders for the scanner tabs, kept HERE so the wording, the
       judging chain and the honest empty states stay identical across desks.

       BAKED REPLAY VERDICTS — fixed offline replay facts per desk. These are
       NOT live numbers and are never recomputed here: each row is the audited
       offline replay of RAW DETECTIONS for that desk, cited to the JSON
       artifact it came from. Only this replay clause is baked — the forward
       clause of the strip is computed live from the pool at every render.
       PROVENANCE (OMNIROUTE re-read 2026-09-11; others read 2026-09-01):
         OMNIROUTE    scripts/backtest-omniroute-v701-results.json
                      (wallClockRunAt 2026-09-10) aggregates.overall:
                      n=2833, avgNetR=-0.2160 -> ~-0.22R net per raw detection.
                      (The v531-era run, scripts/backtest-omniroute-v531-results.json,
                      measured -0.2424 over n=2832 — the same read.)
         OMNIGOLD     scripts/backtest-omnigold-results.json (2026-08-29)
                      aggregates.overall: n=7270, avgR_net=-1.346; EVERY tier
                      in aggregates.byTier is net-negative (best SCAN WEAK
                      -0.243R, worst ENGINE grade-B-demoted -3.133R).
         OMNIPRESENT  scripts/backtest-omnipresent-results.json
                      (wallClockRunAt 2026-09-01) aggregates.byKind: BOTH kinds
                      net-negative — OP-HIGH-REJECT -0.2182R (n=4204),
                      OP-LOW-REJECT -0.2196R (n=4318). */
    var FWD_REPLAY_BAKED = {
      'OMNIROUTE':   'raw detections replayed NET-NEGATIVE: -0.21R/trade over 2,823 settled (scripts/backtest-omniroute-v701-results.json)',
      'OMNIGOLD':    'raw detections replayed NET-NEGATIVE in EVERY tier: -1.35R/trade over 7,270 settled (scripts/backtest-omnigold-results.json)',
      'OMNIPRESENT': 'raw detections replayed NET-NEGATIVE for BOTH kinds: HIGH-REJECT -0.22R (n=4,204), LOW-REJECT -0.22R (n=4,318) (scripts/backtest-omnipresent-results.json)'
    };
    W.HG_FWD_REPLAY_BAKED = FWD_REPLAY_BAKED;

    function fwdTabList(tab){
      var tabs = [], i;
      if (Object.prototype.toString.call(tab) === '[object Array]'){
        for (i = 0; i < tab.length; i++) if (tab[i]) tabs.push(String(tab[i]));
      } else if (tab) tabs.push(String(tab));
      return tabs;
    }

    /* Live pool sums for one tab or several (gold splits its record across
       OMNIGOLD:SCALP + OMNIGOLD:SWING): settled count, open count, and the
       SHADOW matched-pair as-traded average — the exact bankN /
       bankActualExpR numbers hgFwdPanelHTML's SHADOW line renders, summed
       the same way. Computed from the pool AT CALL TIME, never cached and
       never baked, so the strip moves as pairs settle. */
    function fwdPoolSums(tab){
      var tabs = fwdTabList(tab);
      var settled = 0, open = 0, bn = 0, ba = 0, i, k, pool, p;
      for (i = 0; i < tabs.length; i++){
        pool = null;
        try { pool = W.hgFwdPool(tabs[i]); } catch (eP) { pool = null; }
        if (!pool || typeof pool !== 'object') continue;
        for (k in pool){
          if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
          p = pool[k];
          if (!p) continue;
          settled += num(p.samples) || 0;
          open += num(p.open) || 0;
          if (num(p.bankN) > 0 && isFinite(num(p.bankActualExpR))){
            bn += num(p.bankN);
            ba += num(p.bankN) * num(p.bankActualExpR);
          }
        }
      }
      return { settled: settled, open: open, bankN: bn,
               asTradedR: bn > 0 ? (ba / bn) : NaN };
    }

    W.hgFwdSettledCount = function(tab){
      try { return fwdPoolSums(tab).settled; } catch (e) { return 0; }
    };

    /* The DESK VERDICT strip: live forward record vs the fixed replay fact,
       side by side, plus the variance note. All live numbers are computed
       from the pool at render; only the replay clause comes from the baked
       map above. Null-safe: an empty pool renders honest text, and any
       failure returns '' so a strip can never take a tab down. */
    W.hgFwdDeskVerdictHtml = function(tab){
      try {
        var tabs = fwdTabList(tab);
        if (!tabs.length) return '';
        var s = fwdPoolSums(tabs);
        var fwdTxt;
        if (s.bankN > 0){
          fwdTxt = 'as traded ' + (s.asTradedR >= 0 ? '+' : '') + s.asTradedR.toFixed(2)
                 + 'R/trade over ' + s.bankN + ' settled pair' + (s.bankN === 1 ? '' : 's');
        } else if (s.settled > 0){
          fwdTxt = s.settled + ' settled, no matched shadow pairs yet';
        } else {
          fwdTxt = 'no settled history yet';
        }
        var pref = String(tabs[0]).split(':')[0];
        var replayTxt = FWD_REPLAY_BAKED[pref] || 'no baked replay record for this desk';
        return '<div class="note" data-hg-desk-verdict="' + esc(tabs.join('+')) + '">'
          + '<b>DESK VERDICT</b> — forward (this desk’s settled records, tickets and non-tickets alike): ' + esc(fwdTxt)
          + ' · replay (raw detections): ' + esc(replayTxt)
          + ' · at ~30% win rates, 2 consecutive stops has ~49% probability — expected variance, not malfunction'
          + '</div>';
      } catch (e) { hgFwdWarn('deskverdict', e); return ''; }
    };

    /* Kinds whose forward ledger currently reads 'has paid' for this tab —
       THE SAME judgment chain the FORWARD table renders and the 20X quality
       gates read: hgFwdPool(tab) per mechanic, judged by omniroute's
       exported hgOmniPoolRead at the panel's 20-sample floor and the
       family-wise bar over the mechanics this pool actually holds
       (hgOmniFamilyZ over its key count). Nothing is reimplemented here —
       hgOmniPoolRead / hgOmniFamilyZ are read from window at call time,
       because omniroute.js owns that math and already exports both.
       FAIL CLOSED: absent reader, empty pool, or a throw -> []. */
    W.hgFwdPaidKinds = function(tab, minRr){
      try {
        if (typeof W.hgOmniPoolRead !== 'function') return [];
        var tabs = fwdTabList(tab);
        var out = [], ti, i, k;
        var rr = (isFinite(+minRr) && +minRr > 0) ? +minRr : 2;
        for (ti = 0; ti < tabs.length; ti++){
          var pool = null;
          try { pool = W.hgFwdPool(tabs[ti]); } catch (e1) { pool = null; }
          if (!pool || typeof pool !== 'object') continue;
          var keys = [];
          for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
          if (!keys.length) continue;
          var barZ = (typeof W.hgOmniFamilyZ === 'function')
                   ? W.hgOmniFamilyZ(Math.max(1, keys.length)) : 2;
          for (i = 0; i < keys.length; i++){
            var p = pool[keys[i]];
            if (!p || !(num(p.samples) > 0)) continue;
            var v = null;
            try { v = W.hgOmniPoolRead(p, rr, 20, barZ); } catch (e2) { v = null; }
            if (v && v.read === 'has paid' && out.indexOf(keys[i]) < 0) out.push(keys[i]);
          }
        }
        out.sort();
        return out;
      } catch (e) { hgFwdWarn('paidkinds', e); return []; }
    };

    W.hgFwdWarn = hgFwdWarn;
    W.hgFwdHealth = hgFwdHealth;
    W.hgFwdHealthHTML = hgFwdHealthHTML;

    /* Raw records for one tab (all tabs when tab is falsy) — for analysis
       layers that need per-record fields the stat block deliberately drops
       (the solidity forward-refit monitor reads sol + outcome per record).
       The AGGREGATE is NOT merged in: it keeps counts, not records, so a
       refit cannot use it — evidence pruned into the aggregate is simply
       beyond per-record analysis, and pretending otherwise would fabricate
       rows. load() re-parses storage, so callers get fresh copies. */
    W.hgFwdRecords = function(tab){
      try {
        var l = load(), out = [], i;
        for (i = 0; i < l.length; i++){
          if (!l[i]) continue;
          if (tab && l[i].tab !== tab) continue;
          out.push(l[i]);
        }
        return out;
      } catch (e) { hgFwdWarn('records', e); return []; }
    };

    /* ==================== THE SPLIT THE MARK EXISTS FOR (hg-v955) ====

       A mark nothing reads is ornamental. hg-v952/v953/v954 each justified
       marking rather than withholding on the grounds that a LATER
       MEASUREMENT would need the field to separate the population — so this
       is that measurement, and without it the three packs are just writing
       to a column nobody selects.

       What it answers is hg-v949's question on the LIVE ledger rather than
       on a committed walk: of the records a gold desk has written, how many
       fired on bars XAUUSD never printed, and what does the record look like
       with those removed.

       THREE BUCKETS AND THEY DO NOT MERGE. `shut` and `open` are the marked
       rows. `unmarked` is everything written before the desk carried a
       calendar, or by a desk that still does not — and it is NOT evidence of
       either state. Reading it as open is exactly the error that made
       NEW GOLD's record read positive (hg-v949), so it is counted, named,
       and kept out of both sides.

       Reads live records AND the folded aggregate, because the live list is
       capped and pruned; `agg` is null when the fold holds nothing for this
       tab rather than zero, so an unfolded tab cannot read as a clean one.
       Nothing here gates: it reports. */
    W.hgFwdGoldCalendarSplit = function(tab, opts){
      try {
        var o = opts || {};
        var recs = W.hgFwdRecords(tab) || [];
        var want = (o.settledOnly === false) ? null : 1;
        var out = { tab: tab || null, shut: 0, open: 0, unmarked: 0,
                    shutR: null, openR: null, agg: null };
        var sSum = 0, sN = 0, oSum = 0, oN = 0, i, r;
        for (i = 0; i < recs.length; i++){
          r = recs[i];
          if (!r) continue;
          if (want && r.state !== 't1' && r.state !== 'stop') continue;
          if (r.goldShut === true){
            out.shut++;
            sSum += (r.state === 't1') ? (+r.rr || 0) : -1; sN++;
          } else if (r.goldShut === false){
            out.open++;
            oSum += (r.state === 't1') ? (+r.rr || 0) : -1; oN++;
          } else out.unmarked++;
        }
        if (sN) out.shutR = sSum / sN;
        if (oN) out.openR = oSum / oN;
        /* the folded counts, which outlive the live cap */
        try {
          var a = loadAgg() || {}, k, row, tr = null, wk = null;
          for (k in a){
            if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
            row = a[k];
            if (!row) continue;
            if (tab && String(row.tab || k.split('|')[0]) !== String(tab)) continue;
            if (row.tr){ tr = tr || { wins: 0, losses: 0, expired: 0 };
              tr.wins += row.tr.wins || 0; tr.losses += row.tr.losses || 0; tr.expired += row.tr.expired || 0; }
            if (row.wk){ wk = wk || { wins: 0, losses: 0, expired: 0 };
              wk.wins += row.wk.wins || 0; wk.losses += row.wk.losses || 0; wk.expired += row.wk.expired || 0; }
          }
          if (tr || wk) out.agg = { tradeable: tr, weekend: wk };
        } catch (eA){ out.agg = null; }
        return out;
      } catch (e) { hgFwdWarn('goldCalendarSplit', e); return null; }
    };

    /* One line for any gold panel. Renders NOTHING when no record carries the
       mark — an empty split is not a clean bill, and a panel that says
       "0 weekend trades" on a ledger that never recorded the field would be
       the false reassurance this pack exists to remove. */
    W.hgFwdGoldCalendarHtml = function(tab){
      try {
        var sp = W.hgFwdGoldCalendarSplit(tab);
        if (!sp) return '';
        if (!sp.shut && !sp.open) return '';
        var tot = sp.shut + sp.open;
        var pct = tot ? (100 * sp.shut / tot) : 0;
        var esc = function(x){ return String(x == null ? '' : x)
          .replace(/[&<>"]/g, function(c){ return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'; }); };
        var h = '<div class="note" style="margin:8px 0;padding:8px 10px;border:1px solid #6B7280;border-radius:6px">';
        h += '<b>GOLD CALENDAR SPLIT</b> · ' + sp.shut + ' of ' + tot + ' marked settled records ('
          + pct.toFixed(1) + '%) fired while gold was shut';
        if (sp.openR !== null) h += ' · gold-open ' + (sp.openR >= 0 ? '+' : '') + sp.openR.toFixed(4) + 'R on n=' + sp.open;
        if (sp.shutR !== null) h += ' · weekend ' + (sp.shutR >= 0 ? '+' : '') + sp.shutR.toFixed(4) + 'R on n=' + sp.shut;
        if (sp.unmarked) h += ' · <b>' + sp.unmarked + '</b> carry no mark and are counted as NEITHER — they predate the calendar on this desk, and reading them as open is the error this split exists to avoid';
        h += '. Reported, not gated: nothing is withheld on it.' + esc('');
        h += '</div>';
        return h;
      } catch (e) { return ''; }
    };

    W.hgFwdState = function(){
      try {
        var l = load(), open = 0, settled = 0, i;
        for (i = 0; i < l.length; i++){
          if (l[i].state === 'open') open++;
          else if (l[i].state === 't1' || l[i].state === 'stop') settled++;
        }
        return { total: l.length, open: open, settled: settled, cap: MAX_RECORDS };
      } catch (e) { return null; }
    };
    /* Clear the forward log, optionally for ONE desk only.

       All-or-nothing was the only option, and that is the wrong tool after a
       model change: the gold stop fix invalidated the OMNIGOLD records, while
       the OMNIROUTE, PINE and EDGE pools were recorded under a stop model
       that did not change and are still good evidence. Wiping those to fix
       gold would destroy months of accumulated out-of-sample record for no
       reason.

       Pass a tab prefix to clear just that desk — 'OMNIGOLD' catches both
       'OMNIGOLD:SCALP' and 'OMNIGOLD:SWING'. Pass nothing to clear
       everything, which is what this always did.

       The AGGREGATE is cleared for the same tabs in the same call. It is a
       separate store that survives record pruning by design, so clearing
       records alone would leave the log still reporting trades the user
       believes they deleted — the exact failure this had to avoid.

       Returns what was actually removed rather than a bare true, because
       "I deleted your evidence" deserves a count. */
    W.hgFwdClear = function(tabPrefix){
      try {
        var pref = (tabPrefix === undefined || tabPrefix === null) ? null : String(tabPrefix);
        if (pref === null || pref === ''){
          var allRecs = load().length;
          var allAgg = Object.keys(loadAgg()).length;
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(AGG_KEY);
          return { cleared: 'ALL', records: allRecs, aggregates: allAgg };
        }
        var recs = load();
        var keptRecs = [], droppedRecs = 0, i;
        for (i = 0; i < recs.length; i++){
          if (recs[i] && String(recs[i].tab).indexOf(pref) === 0) droppedRecs++;
          else keptRecs.push(recs[i]);
        }
        save(keptRecs);
        var agg = loadAgg(), keptAgg = {}, droppedAgg = 0, k;
        for (k in agg){
          if (!Object.prototype.hasOwnProperty.call(agg, k)) continue;
          if (String(k).indexOf(pref + '|') === 0) droppedAgg++;
          else keptAgg[k] = agg[k];
        }
        saveAgg(keptAgg);
        return { cleared: pref, records: droppedRecs, aggregates: droppedAgg,
                 recordsKept: keptRecs.length, aggregatesKept: Object.keys(keptAgg).length };
      } catch (e) { hgFwdWarn('clear', e); return { cleared: null, records: 0, aggregates: 0, error: true }; }
    };
  }

})();
