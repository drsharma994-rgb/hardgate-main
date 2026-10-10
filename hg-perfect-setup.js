/* =========================================================================
HARDGATE — hg-perfect-setup.js
THE PERFECT SETUP FORMATION tier, shared across every setup-forming desk.

One honest predicate — hgPerfectFormation(c, reads) — that says a candidate
is a PERFECT / max-confluence setup ONLY when every ALWAYS-COMPUTABLE leg
passes AND no READABLE evidence leg runs against it. It is a FILTER, never a
gate: it cannot demote, move or drop a candidate, and it cannot mint one. It
only earns a ★ PERFECT badge and a `perfect` read-mark the forward ledger
measures against the rest — exactly as the MOST PROBABLE cohort already is.

Two tiers of legs, stated plainly:

  ALWAYS-COMPUTABLE (must pass — a candidate that fails one is simply not
  perfect, and the `why` array names the leg):
    1. not demoted and not vetoed (it leads on its own merit)
    2. top grade (grade A / S / AA — the desk's own max)
    3. nothing on the books opposes it (oppose === 0)
    4. strictly positive, readable confluence tally
    5. R:R clears the desk's floor (when entry/stop/t1 are readable)

  EVIDENCE (only disqualifies when an explicitly AGAINST read is present;
  an UNREADABLE read never confirms and never disqualifies — the honest
  third state):
    - taker flow verdict === 'against' (an 'against-absorbed' read — flow
      opposing but price HOLDING against it — is absorption, not
      distribution, and does NOT disqualify; hg-v1057, the JDK spot-CVD
      context research)
    - funding mark against the direction
    - volatility regime BLOWOFF (a move already spent)
    - structure trend against the direction (a confirmed opposite)
    - news calendar in BLACKOUT (a scheduled high-impact event)
    - session floor THIN (dead tape, no participation)
    - volume witness AGAINST (RVOL below the participation floor)
    - trend-quality CHOP (chop high AND efficiency low — a trend setup on a
      tape with no trend to ride; hg-v1057)
    - leverage cycle EXTENDED (OI up hard AND funding hot — crowded
      positioning; hg-v1057)
    - on-chain veto (exchange-flow z-spike against the direction;
      hg-v1057)
    - spot-vs-perp CVD context AGAINST / PERP-ONLY (both books oppose, or a
      leverage-driven move with spot not participating; hg-v1057)
    - fundamental/sentiment verdict AGAINST (a decisive tailwind for the
      OTHER side from the free sentiment stack — Fear & Greed, retail
      long/short, hashrate, NVT, OI divergence; fed by the BTC crown so the
      perfect tier reads the same combined read the card prints)

The reason it never *requires* the evidence legs to be READABLE is honesty:
a missing feed must not be able to either mint or deny a PERFECT. A candidate
with every evidence leg readable-and-WITH is the headline tier; a candidate
whose evidence is simply unreadable passes the always-computable bar only,
and the ledger splits those two cohorts apart.

  THE HEADLINE TIER (hg-v1030): a candidate whose PERFECT and whose every
  readable evidence leg is explicitly WITH is marked `plus` — ★ PERFECT⁺.
  It is the max-confluence setup: nothing unknown, everything favourable.
  `plus` is earned, never minted, and the forward ledger records it as its
  own read-mark so PERFECT⁺ is measured against PERFECT and the rest.

Loaded early (before the desks) and attached to window/globalThis, guarded so
vm test contexts without a window stub still load cleanly.
   ========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var TOP_GRADES = { A: 1, S: 1, AA: 1 };
var DEFAULT_RR_FLOOR = 0.25;   /* a perfect formation still has to pay for the trip */
/* hg-v1030: the participation floor below which a "volume witness" reads
   AGAINST (dead tape). RVOL is relative to the desk's own 20-bar average, so
   0.6 means the fire bar traded 40% below its recent norm — a setup printing
   on a tape no one is trading. */
var VOLUME_AGAINST = 0.6;
var VOLUME_WITH = 1.0;

/* hg-v1291: A GATE THAT COULD NOT RUN IS NOT A GATE THAT PASSED, and a gate
   that is UNREADABLE is neither WITH nor against. The gold institutional stack
   (hgGoldInstFilter) stamps a handful of veto-shaped results on every gold
   candidate — sweep confirmation, order-block volume, the DXY/TNX macro lock,
   the MTF matrix, the session gate, the spread lock, the news gate.

   THE GATES DO NOT SHARE A POLARITY, so this reads each one on its OWN terms
   rather than guessing from a flag name:
     - `positive` gates pass by being TRUE  (sweepConfirm.ok)
     - `negative` gates refuse by being TRUE (spreadLock.lock, obVol.trap)
     - `reject` gates refuse on one flag but only warn on another
       (sessionGate: `reject` stands a candidate down, `demote` does not)
   `unchecked` means the feed was missing and nothing was decided: the gate is
   unreadable, so it neither passes nor fails. An absent pass-flag is the same
   no-verdict, never a silent refusal. */
function hgGateReadable(g, kind){
  if (!g || typeof g !== 'object') return { blocked: false, readable: false, why: '' };
  if (g.unchecked === true) return { blocked: false, readable: false, why: '' };
  var why = String(g.reason || '');
  if (kind === 'positive'){
    /* an explicit `ok: false` means the gate RAN and did not confirm — a
       refusal. A missing `ok` is the no-verdict state: this gate never spoke. */
    if (g.ok === true) return { blocked: false, readable: true, why: '' };
    if (g.ok === false) return { blocked: true, readable: true, why: why };
    return { blocked: false, readable: false, why: '' };
  }
  if (kind === 'reject'){
    if (g.reject === true) return { blocked: true, readable: true, why: why };
    /* `demote` is a warning, not a refusal — the desk still lets it print */
    return { blocked: false, readable: (g.reject === false), why: '' };
  }
  /* negative: refuses when the named lock/trap flag is TRUE */
  if (g[kind] === true) return { blocked: true, readable: true, why: why };
  return { blocked: false, readable: (g[kind] === false), why: '' };
}

/* hgPerfectFormation(c, reads) -> { perfect: bool, plus: bool, why: string[] } */
function hgPerfectFormation(c, reads){
  var out = { perfect: false, plus: false, why: [] };
  try{
    if (!c) return out;

    /* ---- always-computable legs ---- */
    if (c.demoted || c.vetoed){
      out.why.push('demoted or vetoed');
      return out;
    }
    if (!TOP_GRADES[c.grade]){
      out.why.push('grade ' + (c.grade == null ? 'unread' : c.grade) + ' (needs top)');
      return out;
    }
    if (c.oppose !== 0){
      out.why.push(c.oppose == null ? 'opposing reads unread' : (c.oppose + ' opposing read' + (c.oppose === 1 ? '' : 's')));
      return out;
    }
    if (!(typeof c.tally === 'number' && isFinite(c.tally) && c.tally > 0)){
      out.why.push('tally not strictly positive');
      return out;
    }
    /* R:R floor — only when the numbers are all readable */
    if (isFinite(c.entry) && isFinite(c.stop) && isFinite(c.t1)){
      var rr = (c.dir === 'short')
        ? (c.entry - c.t1) / Math.abs(c.entry - c.stop)
        : (c.t1 - c.entry) / Math.abs(c.entry - c.stop);
      var floor = (isFinite(c.rrFloor) && c.rrFloor > 0) ? c.rrFloor : DEFAULT_RR_FLOOR;
      if (!isFinite(rr) || rr < floor){
        out.why.push('R:R ' + (isFinite(rr) ? rr.toFixed(2) : 'unread') + ' below floor ' + floor.toFixed(2));
        return out;
      }
    }

    /* ---- hg-v1291: THE GOLD INSTITUTIONAL GATES ---------------------------------
       A gold candidate carries the result of hgGoldInstFilter's own stack — the
       confirmations that historically stood a gold trade ASIDE (the hg-v1272
       lesson: a sweep must clear its level and reclaim, a body gap must still be
       open, an order block must show displacement, DXY+TNX must not be fighting
       the trade, the MTF stack must not conflict, the session must not hard-reject,
       the quote must not be wider than the spread lock, the calendar must not be
       locked). Those stamped results were NEVER read here, so a candidate that
       survived the stack WITH A DEMOTION could still wear PERFECT — the badge
       claiming a confirmation the desk had explicitly withheld.

       Every field below is read from the candidate and every one is optional, so
       a crypto desk (which carries none of them) is byte-identical to before —
       the bar only ever tightens for a desk that actually stamps these.

       MEASURED, AND SAID PLAINLY: every one of these gates already either DROPS
       the candidate upstream (sweepConfirm, obVol, macroLock, spreadLock,
       newsGate — goldind.js sets `cand.dropped` and returns) or sets `demoted`
       (mtf, sessionGate with hardReject:false), and the always-computable bar
       ALREADY rejects a demoted candidate. So this is DEFENSE IN DEPTH, not the
       live defense — it cannot become a hole if that upstream ordering changes,
       and it is not where the accuracy gain comes from. */
    var goldGates = [
      ['sweepConfirm', 'positive', 'sweep not confirmed (no MSS/displacement/IFVG)'],
      ['obVol',        'trap',     'order-block volume trap'],
      ['macroLock',    'lock',     'DXY/TNX macro lock against the trade'],
      ['mtf',          'conflict', 'MTF conflict — H4 and Daily disagree'],
      ['sessionGate',  'reject',   'session hard-reject'],
      ['spreadLock',   'lock',     'spread lock — quote wider than the desk cap'],
      ['newsGate',     'lock',     'news gate — high-impact event lock']
    ];
    var goldReadableCount = 0;
    for (var gi = 0; gi < goldGates.length; gi++){
      var gKey = goldGates[gi][0], gKind = goldGates[gi][1], gWhy = goldGates[gi][2];
      var gate = c[gKey];
      if (!gate || typeof gate !== 'object') continue;      /* absent: not this desk */
      var gr = hgGateReadable(gate, gKind);
      if (!gr.readable) continue;                            /* unreadable: no verdict */
      goldReadableCount++;
      if (gr.blocked){
        out.why.push(gWhy + (gr.why ? ' — ' + gr.why : ''));
        return out;
      }
    }
    /* The whole stack readable and none of it refused is itself a favourable
       witness — the institutional read the gold desks earn leg by leg. Readable
       only when at least one gate actually ran, so an all-missing stack is
       absent rather than a pass (never mint, never deny). */
    var goldConfWith = (goldReadableCount > 0);
    var goldConfReadable = (goldReadableCount > 0);

    /* ---- evidence legs: an explicit AGAINST disqualifies; an unreadable leg
       neither confirms nor disqualifies. Each leg also reports whether it is
       WITH, so the `plus` (max-confluence) tier can be computed below. ---- */
    reads = reads || {};
    var leg = {};

    var flow = reads.takerFlowVerdict != null ? reads.takerFlowVerdict : c.takerFlowVerdict;
    /* hg-v1057: only the plain 'against' disqualifies. 'against-absorbed' —
       taker flow opposing but the last three closed bars still advancing in
       the plan's direction — is absorption, not distribution (the JDK
       spot-CVD research: the same CVD signature means opposite things
       depending on price acceptance). It stays readable, it just is not
       WITH, so it can never earn PERFECT⁺ either. */
    if (flow === 'against'){ out.why.push('taker flow against'); return out; }
    leg.flowWith = (flow === 'with');
    leg.flowReadable = (flow != null);

    var fund = reads.fundingAgainst != null ? reads.fundingAgainst : c.fundingAgainst;
    if (fund === true){ out.why.push('funding crowded/against'); return out; }
    leg.fundWith = (fund === false);
    leg.fundReadable = (fund != null);

    var atr = reads.atrRegime != null ? reads.atrRegime : c.atrRegime;
    if (atr === 'BLOWOFF'){ out.why.push('volatility regime blowoff'); return out; }
    leg.atrWith = (atr === 'HEALTHY');
    leg.atrReadable = (atr != null);

    var struc = reads.structureTrend != null ? reads.structureTrend : c.structureTrend;
    if (struc && c.dir && struc !== 'range'){
      var opp = (c.dir === 'long') ? 'down' : 'up';
      if (struc === opp){ out.why.push('structure trend against'); return out; }
    }
    leg.strucWith = (struc && c.dir && struc === (c.dir === 'long' ? 'up' : 'down'));
    leg.strucReadable = (struc != null);

    var nw = reads.newsRisk != null ? reads.newsRisk : c.newsRisk;
    if (nw === 'blackout'){ out.why.push('news blackout'); return out; }
    leg.newsWith = (nw === 'low');
    leg.newsReadable = (nw != null);

    var sess = reads.sess != null ? reads.sess : c.sess;
    if (sess === 'thin'){ out.why.push('thin/dead tape'); return out; }
    leg.sessWith = (sess === 'participating');
    leg.sessReadable = (sess != null);

    var rvol = reads.volumeRvol != null ? +reads.volumeRvol : (c.volumeRvol != null ? +c.volumeRvol : NaN);
    if (isFinite(rvol) && rvol < VOLUME_AGAINST){ out.why.push('volume witness against (RVOL ' + rvol.toFixed(2) + ')'); return out; }
    leg.volWith = (isFinite(rvol) && rvol >= VOLUME_WITH);
    leg.volReadable = isFinite(rvol);

    /* hg-v1057: TREND-QUALITY — the Dreiss Choppiness Index and the Kaufman
       efficiency ratio, read together off the winner's own tape. CHOP means
       BOTH chop is high AND efficiency is low: a trend setup on a tape with
       no trend to ride. TREND is the with-state; an unreadable tape is no
       verdict, exactly like every other leg. */
    var tq = reads.trendQuality != null ? reads.trendQuality : c.trendQuality;
    if (tq === 'CHOP'){ out.why.push('chop tape — no trend to ride (trend-quality against)'); return out; }
    leg.tqWith = (tq === 'TREND');
    leg.tqReadable = (tq != null);

    /* hg-v1057: LEVERAGE CYCLE — OI change plus the last funding prints.
       EXTENDED (OI up hard AND funding hot) is crowded positioning and
       disqualifies; RESET (deleveraging — the Gate Research rebound
       condition) is the with-state; FLAT is readable-neutral. */
    var lv = reads.leverageState != null ? reads.leverageState : c.leverageState;
    if (lv === 'EXTENDED'){ out.why.push('leverage extended (crowded positioning)'); return out; }
    leg.levWith = (lv === 'RESET');
    leg.levReadable = (lv != null);

    /* hg-v1057: ON-CHAIN — the exchange-netflow z gate against the pick's
       direction. A veto (heavy inflow against a long / outflow squeeze
       against a short) disqualifies; a readable non-veto is WITH. Absent
       data is no verdict — fail open. */
    var ocv = reads.onchainVeto != null ? reads.onchainVeto : c.onchainVeto;
    if (ocv === true){ out.why.push('on-chain distribution/squeeze veto'); return out; }
    leg.onchainWith = (ocv === false);
    leg.onchainReadable = (ocv != null);

    /* hg-v1057: SPOT-VS-PERP CVD CONTEXT — the JDK venue comparison. AGAINST
       (both books oppose) and PERP-ONLY (a leverage-driven move spot is not
       participating in) disqualify; BOTH-WITH and SPOT-ONLY (genuine spot
       participation) are the with-states. */
    var cvd = reads.cvdContext != null ? reads.cvdContext : c.cvdContext;
    if (cvd === 'AGAINST'){ out.why.push('spot + perp flow both against'); return out; }
    if (cvd === 'PERP-ONLY'){ out.why.push('perp-only move — leverage-driven, spot not participating'); return out; }
    leg.cvdWith = (cvd === 'BOTH-WITH' || cvd === 'SPOT-ONLY');
    leg.cvdReadable = (cvd != null);

    /* hg-v1291: THE GOLD FREE-FEED WITNESS — every free internet resource the
       gold desk already scores, as ONE leg. The desk's own verdict map is
       already oriented to the candidate's direction (true = with this trade,
       false = against it, absent = the series never loaded), so the whole set
       reduces to two facts: did anything answer, and did anything object. Any
       single readable series against the trade is enough to stand the PERFECT
       down — one contradicting resource is evidence, not noise. Nothing
       readable is no verdict, so a cold feed can never deny the badge. */
    var gfw = c.goldFreeWitness;
    if (gfw && typeof gfw === 'object' && gfw.readable === true){
      if (gfw.against === true){ out.why.push('a free gold feed is against this trade (' + (gfw.names || 'unnamed') + ')'); return out; }
      leg.goldFreeWith = true;
      leg.goldFreeReadable = true;
    }
    /* hg-v1295: FUNDAMENTAL / SENTIMENT VERDICT — the directional tailwind
       read off the free sentiment stack (Fear & Greed, BTC retail long/short,
       hashrate stress, NVT, OI divergence). 'against' is a decisive headwind
       for the OTHER side and disqualifies; 'with' is a decisive tailwind and
       earns the max-confluence tier only if nothing else readable is neutral.
       Absent (no decisive checked vote) stays UNREAD — it neither confirms
       nor denies. Most desks do not feed it, so it stays null for them and
       the tier is unchanged. */
    var sent = reads.fundamentalVerdict != null ? reads.fundamentalVerdict : c.fundamentalVerdict;
    if (sent === 'against'){ out.why.push('fundamental/sentiment stack against'); return out; }
    leg.sentWith = (sent === 'with');
    leg.sentReadable = (sent === 'with' || sent === 'against');

    out.perfect = true;

    /* ---- the headline tier (hg-v1030): PERFECT⁺ is earned when AT LEAST ONE
       evidence leg is readable AND every readable leg is WITH — nothing
       readable is merely neutral, let alone against. An UNREADABLE leg does
       not block the WITH-check (a missing feed is absent, not unfavourable),
       so PERFECT⁺ means "we have a favourable witness, and nothing we can
       read says otherwise". The any-readable guard is what stops the tier
       minting on a candidate whose evidence is entirely silent — a max-
       confluence badge on zero evidence is a coerced story, not a read mark.
       It also keeps the tier meaningful for desks that feed a subset (e.g.
       gold feeds news + volume, not the trend-matrix witnesses). ---- */
    var anyReadable = !!(leg.flowReadable || leg.fundReadable || leg.atrReadable
      || leg.strucReadable || leg.newsReadable || leg.sessReadable || leg.volReadable
      || leg.tqReadable || leg.levReadable || leg.onchainReadable || leg.cvdReadable
      || goldConfReadable || leg.goldFreeReadable || leg.sentReadable);
    /* hg-v1291: `plus` is coerced to a STRICT boolean. It was assigned only on
       the success path and the OR chain could collapse to `undefined`, so a
       caller asserting `plus === false` read a three-state leak. Two suites
       (test-gold-perfect-plus-v1030, test-omnibtc-perfect-v1035) assert it
       strictly and caught it the moment a new leg perturbed the path. */
    out.plus = !!(anyReadable && (!leg.flowReadable || leg.flowWith)
             && (!leg.fundReadable || leg.fundWith)
             && (!leg.atrReadable || leg.atrWith)
             && (!leg.strucReadable || leg.strucWith)
             && (!leg.newsReadable || leg.newsWith)
             && (!leg.sessReadable || leg.sessWith)
             && (!leg.volReadable || leg.volWith)
             && (!leg.tqReadable || leg.tqWith)
             && (!leg.levReadable || leg.levWith)
             && (!leg.onchainReadable || leg.onchainWith)
             && (!leg.cvdReadable || leg.cvdWith)
             && (!goldConfReadable || goldConfWith)
             && (!leg.goldFreeReadable || leg.goldFreeWith)
             && (!leg.sentReadable || leg.sentWith));

    return out;
  }catch(e){
    return out;
  }
}

/* The ★ PERFECT badge — PERFECT⁺ when every evidence leg is on and WITH,
   plain PERFECT when the always-computable bar is cleared with nothing
   against. Empty string when not perfect — every desk wraps its own
   "most probable" line with it, so a screenshot keeps the tier legible. */
function hgPerfectStamp(c, reads){
  var r = hgPerfectFormation(c, reads);
  if (!r.perfect) return '';
  /* prefer the ranker's own verdict when it has travelled on the row (so the
     banner agrees with what the ledger recorded), else recompute from c. */
  var plus = (c && c.perfectPlus === true) ? true : r.plus;
  var title = plus
    ? 'perfect setup formation ★ PLUS — max confluence, every readable evidence leg WITH'
    : 'perfect setup formation: max confluence, every readable evidence leg WITH, nothing against — a filter, not a promise';
  if (r.why && r.why.length) title += ' · passed: ' + r.why.join(', ');
  title = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  var label = plus ? '\u2605 PERFECT\u207A' : '\u2605 PERFECT';
  var bg = plus ? '#FFFBEB' : '#FEF3C7', border = plus ? '#D97706' : '#F59E0B', color = plus ? '#92400E' : '#92400E';
  return '<span style="display:inline-block;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.12em;color:' + color + ';background:' + bg + ';padding:2px 7px;border-radius:4px;border:1px solid ' + border + ';vertical-align:middle" title="' + title + '">' + label + '</span>';
}

/* The forward-ledger read-mark: true when perfect, undefined otherwise — the
   split by which the PERFECT cohort's outcome is measured against the rest. */
function hgPerfectLedgerMark(c, reads){
  return hgPerfectFormation(c, reads).perfect ? true : undefined;
}

/* The PERFECT⁺ read-mark (hg-v1030): true when the headline max-confluence
   tier fired (every evidence leg readable AND WITH), undefined otherwise. */
function hgPerfectPlusLedgerMark(c, reads){
  return hgPerfectFormation(c, reads).plus ? true : undefined;
}

G.hgPerfectFormation = hgPerfectFormation;
G.hgPerfectStamp = hgPerfectStamp;
G.hgPerfectLedgerMark = hgPerfectLedgerMark;
G.hgPerfectPlusLedgerMark = hgPerfectPlusLedgerMark;

})();
