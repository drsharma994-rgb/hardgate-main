/* CRYPTO SCAN — multi-symbol scanner for Delta Exchange + CoinDCX futures.
   Runs the CRYPTO ULTRA 470-read vote engine on every futures contract and
   shows setups with entry / SL / TP1 / TP2.

   Each setup renders the FULL CRYPTO ULTRA card: vote count line, plan with
   levels, and the complete 470-indicator vote table (lazy-loaded on expand)
   so every read can be audited by eye — same architecture as cryptoultra.js.

   Depends: desk-scan-universe.js (universe + kline fetch), cryptoultra.js
   (cryptoUltraEngine). Both must load before this file.

   ALL SETUPS ARE RECORD ONLY — the engine is measured NOT TRADABLE on BTCUSDT
   (rule is self-canceling: ~3,600 candidates merge/dedupe to 0 settled trades).
   Engine has never been backtested on any other symbol. These are what the
   470-read vote rule WOULD say, printed for the record so the count can be
   audited. NOT FOR TRADING.                                                    */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'cryptoscan';
var KL_15M = 320, KL_1H = 400;

var VENUE_COSTS = {
  delta:   { venue: 'Delta',   rtFrac: 0.0015 },
  coindcx: { venue: 'CoinDCX', rtFrac: 0.002  },
  cdcx:    { venue: 'CoinDCX', rtFrac: 0.002  },
  binance: { venue: 'Binance', rtFrac: 0.002  }
};

function costFor(item){
  var ex = item && item.exchange ? String(item.exchange).toLowerCase() : 'binance';
  return VENUE_COSTS[ex] || VENUE_COSTS.binance;
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n, d){ if (n == null || !isFinite(+n)) return '—'; d = d != null ? d : (Math.abs(+n) >= 100 ? 2 : Math.abs(+n) >= 1 ? 4 : 6); return (+n).toFixed(d); }
function pct(n){ return n != null && isFinite(+n) ? Math.round(+n * 100) + '%' : '—'; }

var CS_CSS = ''
  + '.cs-wrap{padding:10px;font-family:system-ui,-apple-system,sans-serif}'
  + '.cs-hdr{margin:0 0 6px;font-size:15px;font-weight:800;letter-spacing:.05em;color:#1E293B}'
  + '.cs-hdr span{font-weight:400;font-size:11px;color:#64748B;letter-spacing:0}'
  + '.cs-stat{font-size:11px;color:#64748B;margin:4px 0 8px}'
  + '.cs-bar{width:100%;height:4px;background:#E2E8F0;border-radius:2px;margin:6px 0 10px;overflow:hidden}'
  + '.cs-bar-fill{height:100%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:2px;transition:width .3s}'
  + '.cs-summary{font-size:12px;color:#1E293B;font-weight:600;margin:10px 0 4px}'
  + '.cs-empty{font-size:12px;color:#64748B;padding:20px 0}'
  + '.cs-note{font-size:10px;color:#94A3B8;margin:8px 0;line-height:1.5}'
  + '.cs-card{border:1px solid #E2E8F0;border-radius:8px;margin:10px 0;overflow:hidden}'
  + '.cs-card.cs-long-card{border-left:4px solid #166534}'
  + '.cs-card.cs-short-card{border-left:4px solid #DC2626}'
  + '.cs-card-head{padding:10px 12px;cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;background:#FAFBFC}'
  + '.cs-card-head:hover{background:#F1F5F9}'
  + '.cs-card-num{font-size:10px;color:#94A3B8;font-weight:700;min-width:22px}'
  + '.cs-card-sym{font-size:14px;font-weight:800;color:#1E293B;letter-spacing:.04em}'
  + '.cs-chip{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.08em;padding:1px 5px;border-radius:3px;margin-left:4px}'
  + '.cs-chip-d{background:#EDE9FE;color:#6D28D9}'
  + '.cs-chip-c{background:#FEF3C7;color:#92400E}'
  + '.cs-chip-b{background:#DBEAFE;color:#1D4ED8}'
  + '.cs-dir{font-size:12px;font-weight:800;letter-spacing:.06em;padding:2px 8px;border-radius:4px}'
  + '.cs-dir-long{background:#DCFCE7;color:#166534}'
  + '.cs-dir-short{background:#FEE2E2;color:#DC2626}'
  + '.cs-card-meta{font-size:10px;color:#64748B;margin-left:auto;text-align:right;line-height:1.5}'
  + '.cs-card-arrow{font-size:14px;color:#94A3B8;transition:transform .2s}'
  + '.cs-card-arrow.cs-open{transform:rotate(90deg)}'
  + '.cs-card-body{display:none;padding:0 12px 12px;border-top:1px solid #F1F5F9}'
  + '.cs-card-body.cs-show{display:block}'
  + '.cs-count{font-size:12px;line-height:1.6;color:#1E293B;padding:8px 0}'
  + '.cs-count small{display:block;font-size:10px;color:#64748B;margin-top:4px;line-height:1.5}'
  + '.cs-plan{font-size:11px;line-height:1.7;color:#1E293B;padding:8px 10px;border:1px solid rgba(147,130,34,.5);border-radius:6px;background:rgba(250,240,137,.12);margin:8px 0}'
  + '.cs-gate{font-size:10px;color:#DC2626;padding:6px 10px;border:1px solid rgba(220,38,38,.35);border-radius:6px;margin:6px 0;background:rgba(220,38,38,.04)}'
  + '.cs-vtbl{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0}'
  + '.cs-vtbl th{text-align:left;padding:3px 6px;border-bottom:2px solid #CBD5E1;font-weight:700;letter-spacing:.06em;color:#334155}'
  + '.cs-vtbl td{padding:3px 6px;border-bottom:1px solid #F1F5F9;color:#475569}'
  + '.cs-vtbl .cs-grp{font-weight:800;letter-spacing:.1em;color:#1E293B;padding-top:10px;font-size:10px;background:#F8FAFC}'
  + '.cs-vtbl .cs-v1{color:#166534;font-weight:700}.cs-vtbl .cs-v-1{color:#DC2626;font-weight:700}.cs-vtbl .cs-v0{color:#94A3B8}'
  + '.cs-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:8px 0}'
  + '.cs-lv{text-align:center;padding:6px 8px;border-radius:6px;background:#F8FAFC;border:1px solid #E2E8F0}'
  + '.cs-lv b{display:block;font-size:13px;color:#1E293B}'
  + '.cs-lv small{font-size:9px;color:#64748B;letter-spacing:.06em}'
  + '.cs-votes-placeholder{font-size:10px;color:#94A3B8;padding:8px 0;cursor:pointer}'
  + '.cs-votes-placeholder:hover{color:#2563EB}'
  + '.cs-sentiment{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.05em;cursor:help}'
  + '.cs-sentiment.sentiment-bullish{background:#DCFCE7;color:#166534;border:1px solid #86EFAC}'
  + '.cs-sentiment.sentiment-mildly-bullish{background:#FEF3C7;color:#92400E;border:1px solid #FCD34D}'
  + '.cs-sentiment.sentiment-bearish{background:#FEE2E2;color:#DC2626;border:1px solid #FECACA}'
  + '.cs-sentiment.sentiment-mildly-bearish{background:#FED7AA;color:#EA580C;border:1px solid #FDBA74}'
  + '.cs-sentiment.sentiment-neutral{background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1}'
  + '.cs-sentiment.sentiment-stale{background:#E0E7FF;color:#4F46E5;border:1px dashed #A5B4FC;font-style:italic}';

function venueChip(ex){
  var e = String(ex || '').toLowerCase();
  if (e === 'delta') return '<span class="cs-chip cs-chip-d">DELTA</span>';
  if (e === 'coindcx' || e === 'cdcx') return '<span class="cs-chip cs-chip-c">COINDCX</span>';
  if (e === 'binance') return '<span class="cs-chip cs-chip-b">BINANCE</span>';
  return '';
}

function symLabel(item){
  if (!item) return '—';
  if (item.base) return item.base;
  var s = String(item.sym || '');
  return s.replace(/USDT?$/, '').replace(/^B-/, '').replace(/_USDT$/, '');
}

function rr(entry, stop, t1){
  if (!isFinite(+entry) || !isFinite(+stop) || !isFinite(+t1) || +entry === +stop) return null;
  var risk = Math.abs(+entry - +stop), reward = Math.abs(+t1 - +entry);
  return risk > 0 ? +(reward / risk).toFixed(2) : null;
}

/* SMC rank — ORDERING ONLY, deliberately not a gate. The grade is dominated by
   STRUCT_WITH/AGAINST, and that same structural fact is already voted inside pct
   by the 470-read engine (cryptoultra.js CHoCH/FVG/liq_sweep reads), which then
   feeds the 75% gate and 40% of the confidence score. Letting it also veto would
   penalise one fact a third time — and on the slowest copy of it, since a swing
   needs swingLength bars to close on its right (~2.5h at 15m) against a ~6h plan
   horizon. So structure breaks ties between cards the trader reads as equally
   confident; it never removes one. Missing smc ranks identically to NEUTRAL, so
   ordering cannot shift with smc-lib.js load order. */
function csSmcRank(s){
  var g = s && s.smc && s.smc.grade;
  if (g === 'STRONG') return 2;
  if (g === 'WITH') return 1;
  if (g === 'AGAINST') return -1;
  return 0;
}

/* Primary key is the confidence the card actually PRINTS (whole percent — see
   pct() and the Math.round in the card head), because two setups shown as "82%"
   are tied to the reader even when their floats differ. SMC breaks that tie; raw
   pct is the final key so order stays deterministic. renderCards re-partitions
   by isHighQuality AFTER this with filter, which preserves order, so nothing can
   cross the quality boundary here. */
function csSortSetups(arr){
  if (!Array.isArray(arr)) return arr;
  arr.sort(function(a, b){
    var pa = (a && a.pct) || 0, pb = (b && b.pct) || 0;
    var ba = Math.round(pa * 100), bb = Math.round(pb * 100);
    if (bb !== ba) return bb - ba;
    var ra = csSmcRank(a), rb = csSmcRank(b);
    if (rb !== ra) return rb - ra;
    return pb - pa;
  });
  return arr;
}

/* THE VERSION OF THE LABEL, not of the file.

   hg-forward.js pools settled records by tab + mechanic (hgFwdKey, hgFwdStats),
   and `ticketOnly` splits inside a mechanic. So "VOTE-PROFESSIONAL, n=40,
   +0.3R" is only evidence about one thing if all forty rows were labelled by
   the same rule.

   They were not. The pipeline that produces voteTier and isHighQuality changed
   three times in one week, and every change moved which setups land in which
   bucket:

     v1  the original three-layer blend
     v2  pack 863 - sentiment taken relative to the trade. Shorts had been
         scored with the raw market sign, so a bullish read PROMOTED a short;
         37 of 200 swept shorts held the pro-grade bar only on that.
     v3  pack 864 - order flow taken relative to the trade, and a neutral
         reading stopped counting as dissent. 166 of 6,840 swept cells changed
         tier and shouldTrade.
     v4  pack 865 - a sentiment row past its own ttl scores 0 and no longer
         gates. 144 of 280 BTC/ETH/SOL cells changed tier.

   Records written under v1 are still in a live tab's localStorage, pooling
   with v4 records under identical keys, and nothing marked them. This repo
   already knows the answer: hg-forward.js writes `solV`, "the stamp version",
   beside the solidity score for exactly this reason. So the version goes into
   the mechanic, which IS the pooling key, and old labels stop contaminating
   new ones instead of being silently averaged with them.

   Bump this whenever the label pipeline changes. tests/test-cryptoscan-label-
   version.mjs hashes that pipeline and fails if it moves without a bump, so
   the decision is made on purpose rather than forgotten. */
var CS_LABEL_V = 4;

/* v735: forward-log row builder, kept PURE and exported for the same reason
   csSmcRank is — everything else in the scan path lives inside runScan, which
   cannot be reached without live network, so a behaviour test is impossible
   unless the decision is liftable. The previous SMC activation shipped as dead
   code precisely because nothing could exercise it. */
function csFwdRows(setups){
  if (!Array.isArray(setups)) return [];
  /* +null, +undefined and +'' are 0, and isFinite(0) is true, so coercing
     before the finite test would let a MISSING level through AS ZERO — which
     records a fabricated 100%-risk trade rather than dropping the row. Same
     trap fixpack14-core.js documents in hgCoint; my own test caught it here. */
  function lvl(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
  var out = [], i;
  for (i = 0; i < setups.length; i++){
    var s = setups[i], p = s && s.plan;
    if (!s || !s.sym || !s.dir || !p) continue;
    var en = lvl(p.entry), st = lvl(p.stop), tp = lvl(p.t1);
    if (!isFinite(en) || !isFinite(st) || !isFinite(tp)) continue;
    /* a zero-risk plan cannot be scored in R and would divide by zero downstream */
    if (en === st) continue;
    /* The CLOSED bar the engine voted on, which the card prints as
       "closed 15m bar ... UTC". Without it hg-forward floors NOW to the
       timeframe and names the FORMING bar instead — one bar ahead of the one
       the engine read, two when the scan straddles a boundary, which sends
       settlement past the first bar of the trade and breaks the dedup rule
       across a bar edge. Absent means absent: no bar, no claim, and the
       recorder falls back to its own floor. */
    var barT = (s.bar && isFinite(+s.bar.t) && +s.bar.t > 0) ? +s.bar.t : undefined;
    out.push({
      sym: String(s.sym), dir: s.dir,
      entry: en, stop: st, t1: tp,
      barT: barT,
      /* mechanic is the VOTE TIER, not a constant, so the log answers the
         question worth asking — do this desk's own confidence tiers actually
         separate — rather than pooling everything into one bag. The @vN suffix
         is the label version: hg-forward pools on this string, so a tier
         computed by an older rule can no longer average into a newer one.
         hgFwdNormalize keeps 28 characters and the longest tier fits. */
      mechanic: ('VOTE-' + String(s.voteTier || 'weak') + '@v' + CS_LABEL_V).toUpperCase().slice(0, 28),
      /* marks the HIGH-QUALITY cohort (no quality gates AND pro-grade). Not a
         claim these are tradeable — the cards say RECORD ONLY — it is the split
         that lets someone later ask whether the tab's strongest claim paid. */
      ticket: !!s.isHighQuality
    });
  }
  return out;
}

/* ---- COVERAGE: how much of the universe the scan actually read ----

   The empty state was one sentence for four different outcomes:

     "No setups found — no contracts generated signals."

   It said that whether every contract was read and none had a directional
   signal, or every contract failed to fetch, or every contract was dropped for
   having fewer than 230 closed 15m bars (the engine's MIN_15M — CoinDCX
   carries young and thin contracts that never reach it), or some mixture. The
   first is a finding about the market. The other three are a finding about the
   scan, and the tab reported them as the market.

   The counts existed — runScan tracks scanned / skipped / errors — but they
   only ever reached the transient status line, which the next scan overwrites
   and which the card block never mentions. They belong with the cards, where
   the claim is made.

   Pure and exported for the same reason csBlockerTally is: a decision that
   lives inside runScan cannot be reached without live network. */
/* Why a contract never reached the engine, in the words the fetch uses. */
var CS_UNREAD_LABELS = {
  'fetch-failed': 'the request failed',
  'bad-shape':    'the venue returned something that was not candles',
  'no-symbol':    'no symbol could be derived for the venue',
  'no-source':    'no candle source is wired for the venue',
  'unknown':      'reason not recorded'
};

function csCoverage(run){
  var universe = Math.max(0, +(run && run.universe) || 0);
  var scanned  = Math.max(0, +(run && run.scanned)  || 0);
  var skipped  = Math.max(0, +(run && run.skipped)  || 0);
  var errors   = Math.max(0, +(run && run.errors)   || 0);
  /* unread is a fact about the FETCH; skipped is a fact about the contract.
     They were one counter until pack 870, and a Binance 451 for every symbol
     read out as "fewer than 230 closed 15m bars". */
  var unread   = Math.max(0, +(run && run.unread)   || 0);
  var signals  = Array.isArray(run && run.setups) ? run.setups.length : 0;
  /* what the universe loader was offered, before its own two filters */
  var offered  = Math.max(0, +(run && run.offered) || 0);
  var dTurn    = Math.max(0, +(run && run.droppedTurnover) || 0);
  var dVenue   = Math.max(0, +(run && run.droppedVenue) || 0);
  var dNoTick  = Math.max(0, +(run && run.droppedNoTicker) || 0);
  var why = (run && run.unreadWhy && typeof run.unreadWhy === 'object') ? run.unreadWhy : {};
  /* what the engine actually got to look at */
  var read = Math.max(0, scanned - skipped - errors - unread);
  return {
    universe: universe, scanned: scanned, skipped: skipped, errors: errors,
    unread: unread, unreadWhy: why,
    read: read, signals: signals,
    offered: offered, droppedTurnover: dTurn, droppedVenue: dVenue, droppedNoTicker: dNoTick,
    dropped: dTurn + dVenue + dNoTick,
    minTurnover: Math.max(0, +(run && run.minTurnover) || 0),
    pct: universe > 0 ? read / universe : null,
    /* against what the source actually offered, which is the honest ceiling */
    pctOffered: offered > 0 ? read / offered : null,
    partial: (skipped + errors + unread) > 0,
    known: universe > 0 || scanned > 0
  };
}

/** "the request failed (140)" joined for whatever causes were recorded */
function csUnreadWhyText(cov){
  var why = (cov && cov.unreadWhy) || {}, parts = [], k;
  var keys = Object.keys(why).sort(function(a, b){ return why[b] - why[a]; });
  for (var i = 0; i < keys.length; i++){
    k = keys[i];
    if (!why[k]) continue;
    parts.push((CS_UNREAD_LABELS[k] || k) + ' (' + why[k] + ')');
  }
  return parts.join(', ');
}

function csCoverageHTML(run){
  var c = csCoverage(run);
  if (!c.known) return '';
  var txt = c.read + ' of ' + c.universe + ' contracts read'
    + (c.pct != null ? ' (' + Math.round(100 * c.pct) + '%)' : '');
  if (c.unread){
    var whyTxt = csUnreadWhyText(c);
    txt += ' · ' + c.unread + ' never fetched' + (whyTxt ? ': ' + whyTxt : '');
  }
  if (c.skipped) txt += ' · ' + c.skipped + ' skipped, fewer than 230 closed 15m bars';
  if (c.errors) txt += ' · ' + c.errors + ' threw during the scan';
  /* the universe was filtered before the scan ever saw it — say so, or "100%
     read" reads as "everything", which it is not */
  if (c.dropped){
    var pre = [];
    if (c.droppedTurnover) pre.push(c.droppedTurnover + ' under the $'
      + (c.minTurnover >= 1e6 ? (c.minTurnover / 1e6) + 'M' : c.minTurnover) + ' turnover floor');
    if (c.droppedVenue) pre.push(c.droppedVenue + ' on other venues');
    if (c.droppedNoTicker) pre.push(c.droppedNoTicker + ' with no ticker');
    txt += ' · ' + c.dropped + ' of ' + c.offered + ' never offered to the scan: ' + pre.join(', ')
      + (c.pctOffered != null ? ' — ' + Math.round(100 * c.pctOffered) + '% of the source universe' : '');
  }
  return '<div style="font-size:10px;color:' + (c.partial ? '#92400E' : '#64748B')
    + ';margin:4px 0 2px">COVERAGE · ' + esc(txt) + '</div>';
}

function csEmptyHTML(run){
  var c = csCoverage(run);
  if (!c.known){
    return '<div class="cs-empty">No setups — the scan has not run in this session yet.</div>';
  }
  var why;
  if (!c.read){
    why = 'none of the ' + c.universe + ' contracts could be read, so the engine never ran. '
        + 'This is a finding about the scan, not about the market.'
        + (c.unread ? ' ' + c.unread + ' were never fetched: ' + csUnreadWhyText(c) + '.' : '');
  } else if (c.partial){
    why = c.read + ' of ' + c.universe + ' contracts reached the engine and none produced a '
        + 'directional signal. The other ' + (c.skipped + c.errors + c.unread) + ' were never read, so '
        + 'nothing is claimed about them.';
  } else {
    why = 'all ' + c.read + ' contracts were read and none produced a directional signal.';
  }
  return '<div class="cs-empty">No setups — ' + esc(why) + '</div>' + csCoverageHTML(run);
}

/* ---- WHY EMPTY: which gate actually closed the HIGH-QUALITY block ----

   An empty block used to be explained entirely in terms of signal quality
   ("most signals lack sufficient confluence"), and for 14 hours of every day
   that is not what emptied it: the session gate admits 07:00-17:00 UTC, so
   58% of the day nothing can qualify whatever its confluence. Same shape as
   the SWING tab's WHY EMPTY panel and cgSoleBlocker, which this follows.

   Kept PURE and exported for the same reason csFwdRows and csSmcRank are:
   everything else in the scan path lives inside runScan and cannot be reached
   without live network, so a decision that is not lifted out cannot be tested.

   `sole` is the column worth reading — setups where relaxing exactly ONE gate
   would have produced a HIGH-QUALITY signal, which is what tells you whether
   the clock, the regime or the reads are what you are waiting on. */
var CS_GATE_LABELS = {
  confidence: 'price agreement under 75%',
  regime:     'regime reads CHOP',
  session:    'outside 07:00-17:00 UTC',
  voting:     'three-layer voting gate',
  sentiment:  'major sentiment conflict'
};

/** would this setup be pro-grade if its quality gates were all clear? */
function csProReady(s){
  if (!s) return false;
  var conf = +s.threeLayerConfidence;
  if (!isFinite(conf) || conf < 0.75) return false;
  if (s.layerAgreement !== 2) return false;
  if (s.externalRisk && s.externalRisk.cascadeImminent) return false;
  return true;
}

function csBlockerTally(setups){
  var out = { n: 0, hq: 0, byGate: {}, sole: {}, proReady: 0, proBlocked: 0, clean: 0 };
  if (!Array.isArray(setups)) return out;
  for (var i = 0; i < setups.length; i++){
    var s = setups[i];
    if (!s) continue;
    out.n++;
    if (s.isHighQuality){ out.hq++; continue; }
    var keys = Array.isArray(s.gateKeys) ? s.gateKeys : [];
    var ready = csProReady(s);
    if (ready) out.proReady++;
    for (var k = 0; k < keys.length; k++){
      out.byGate[keys[k]] = (out.byGate[keys[k]] || 0) + 1;
    }
    /* exactly one gate open, and nothing else standing in the way */
    if (keys.length === 1 && ready) out.sole[keys[0]] = (out.sole[keys[0]] || 0) + 1;
    /* every gate clear, so what stopped it was the pro-grade stamp itself */
    if (!keys.length){ out.clean++; if (!ready) out.proBlocked++; }
  }
  return out;
}

/* The closing note used to attribute an empty block entirely to confluence.
   One of the gates is a clock that shuts for 14 hours a day, so that
   explanation is wrong more often than it is right — defer to the tally.

   Lifted out of renderCards and exported for the same reason csBlockerTally
   is: a branch that only renderCards can reach is a branch a test can only
   grep for, and a source scan passed a mutation that pinned the condition to
   false. */
function csFooterNote(setups, hqCount, tally){
  var n = Array.isArray(setups) ? setups.length : 0;
  hqCount = +hqCount || 0;
  tally = tally || csBlockerTally(setups);
  var clockSole = (tally.sole && tally.sole.session) || 0;
  var clockOnly = !hqCount && clockSole > 0;
  return '<div class="cs-note">CRYPTO SCAN — FILTERED FOR QUALITY. Out of ' + n
    + ' total signals, ' + hqCount + ' clear every quality gate AND the pro-grade stamp '
    + '(three-layer confidence 75%+, price and order flow agreeing). Risk-reward is not among '
    + 'those standards: the plan ladder is a fixed 1.5R, so an R:R test on it is true for every '
    + 'setup by construction and filters nothing. '
    + 'Lower-quality signals shown for reference but not recommended for trading. '
    + (clockOnly
        ? 'The block above is empty because of the SESSION GATE, not the reads: ' + clockSole
          + ' setup' + (clockSole === 1 ? '' : 's') + ' cleared everything else. That gate passes '
          + '07:00-17:00 UTC, 10 of 24 hours. '
        : 'The 470-indicator voting engine produces high volume but low accuracy — '
          + 'most signals lack sufficient confluence. ')
    + 'Professional traders only trade the strongest setups. This tab shows why: signal quantity '
    + '≠ signal quality. No win rates claimed. No invented thresholds.</div>';
}

function csWhyEmptyHTML(tally){
  if (!tally || !tally.n) return '';
  var keys = Object.keys(tally.byGate);
  if (!keys.length && !tally.proBlocked) return '';
  keys.sort(function(a, b){ return tally.byGate[b] - tally.byGate[a]; });

  var h = '<div style="margin:10px 0;padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;background:#F8FAFC">'
    + '<div style="font-size:11px;font-weight:700;color:#334155;letter-spacing:.06em">WHY THE HIGH-QUALITY BLOCK IS '
    + (tally.hq ? 'THIS SIZE' : 'EMPTY') + '</div>'
    + '<div style="font-size:10px;color:#64748B;margin:2px 0 6px">' + tally.n + ' signal'
    + (tally.n === 1 ? '' : 's') + ' scanned · ' + tally.hq + ' high-quality · counts below are per gate, '
    + 'so one setup can appear in more than one row</div>'
    + '<table class="cs-vtbl"><tr><th>gate</th><th>blocked</th><th>ONLY blocker</th></tr>';
  for (var i = 0; i < keys.length; i++){
    var k = keys[i], sole = tally.sole[k] || 0;
    h += '<tr><td>' + esc(CS_GATE_LABELS[k] || k) + '</td><td>' + tally.byGate[k] + '</td><td'
      + (sole ? ' style="font-weight:700;color:#92400E"' : '') + '>' + sole + '</td></tr>';
  }
  if (tally.proBlocked){
    h += '<tr><td>' + esc('pro-grade stamp (confidence / layer agreement / cascade)')
      + '</td><td>' + tally.proBlocked + '</td><td>' + tally.proBlocked + '</td></tr>';
  }
  h += '</table>';
  if (tally.sole.session){
    h += '<div style="font-size:10px;color:#92400E;margin-top:6px">' + tally.sole.session
      + ' setup' + (tally.sole.session === 1 ? ' was' : 's were') + ' held back by the CLOCK alone. '
      + 'The session gate passes 07:00-17:00 UTC, which is 10 of 24 hours — outside it nothing '
      + 'can be high-quality whatever its confluence.</div>';
  }
  return h + '</div>';
}

/* the plan's own expiry, so a record cannot outlive the setup it describes;
   the card prints it as "expires after N bars" */
function csFwdHorizon(setups){
  var s = Array.isArray(setups) ? setups[0] : null;
  var n = s && s.plan ? +s.plan.timeoutBars : NaN;
  return (isFinite(n) && n > 0) ? n : 24;
}

function voteTableHTML(votes){
  if (!votes || !votes.length) return '';
  var groups = [], h = '<table class="cs-vtbl"><tr><th>read</th><th>value</th><th>kind</th><th>vote</th><th>rule</th></tr>';
  for (var i = 0; i < votes.length; i++) if (groups.indexOf(votes[i].group) < 0) groups.push(votes[i].group);
  for (var g = 0; g < groups.length; g++){
    h += '<tr><td class="cs-grp" colspan="5">' + esc(groups[g]) + '</td></tr>';
    for (var k = 0; k < votes.length; k++){
      var v = votes[k]; if (v.group !== groups[g]) continue;
      var vt = v.kind === 'vote' ? (v.vote > 0 ? 'LONG' : v.vote < 0 ? 'SHORT' : 'neutral') : v.kind === 'regime' ? (v.regime < 0 ? 'chop' : v.regime > 0 ? 'trend' : '—') : v.kind === 'n/a' ? 'n/a' : '—';
      h += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.read) + '</td><td style="font-weight:700;letter-spacing:.06em;font-size:9px">' + esc(v.kind) + '</td><td class="cs-v' + (v.kind === 'vote' ? v.vote : 0) + '">' + vt + '</td><td>' + esc(v.why) + '</td></tr>';
    }
  }
  h += '</table>';
  return h;
}

/* ---- vote data store: votes are kept in JS, rendered lazily on first expand ---- */
var __voteStore = {};

function csToggleCard(idx){
  var body = document.getElementById('cs_' + idx);
  var arrow = document.getElementById('cs_' + idx + '_a');
  if (!body) return;
  var opening = !body.classList.contains('cs-show');
  body.classList.toggle('cs-show');
  if (arrow) arrow.classList.toggle('cs-open');
  if (opening){
    var vhost = document.getElementById('cs_v_' + idx);
    if (vhost && !vhost.dataset.rendered && __voteStore[idx]){
      vhost.innerHTML = voteTableHTML(__voteStore[idx]);
      vhost.dataset.rendered = '1';
    }
  }
}
W.__csToggleCard = csToggleCard;

function setupCardHTML(s, idx){
  var p = s.plan, K = s.count ? s.count.kinds : {}, rrv = p ? rr(p.entry, p.stop, p.t1) : null;
  var cardCls = s.dir === 'long' ? 'cs-long-card' : 'cs-short-card';
  var dirCls = s.dir === 'long' ? 'cs-dir-long' : 'cs-dir-short';
  var id = 'cs_' + idx;

  var h = '<div class="cs-card ' + cardCls + '">';
  h += '<div class="cs-card-head" onclick="__csToggleCard(' + idx + ')">';
  h += '<span class="cs-card-num">#' + (idx + 1) + '</span>';
  h += '<span class="cs-card-sym">' + esc(s.label) + '</span>';
  h += venueChip(s.exchange);
  h += ' <span class="cs-dir ' + dirCls + '">' + (s.dir || '—').toUpperCase() + '</span>';
  try{ if (typeof W.hgSmcChipHtml === 'function') h += (W.hgSmcChipHtml(s) || ''); }catch(eSmc){}
  h += '<span class="cs-card-meta">' + pct(s.pct) + ' agree · ' + (s.count ? s.count.decisive : '—') + ' decisive · regime ' + esc((s.regime || '—').toUpperCase());
  if (p) h += '<br>entry ' + fmt(p.entry) + ' · SL ' + fmt(p.stop) + ' · TP1 ' + fmt(p.t1) + ' · R:R ' + (rrv != null ? rrv.toFixed(1) : '—');
  h += '</span>';
  h += '<span class="cs-card-arrow" id="' + id + '_a">&#9654;</span>';
  h += '</div>';

  h += '<div class="cs-card-body" id="' + id + '">';

  h += '<div class="cs-count">' + esc(s.line);
  h += '<small>' + (s.count ? s.count.total : '—') + ' reads fed: ' + (K.vote || 0) + ' vote · ' + (K.regime || 0) + ' regime · ' + (K.print || 0) + ' print-only · ' + (K.na || 0) + ' not applicable';
  if (s.bar) h += ' · closed 15m bar ' + new Date(s.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  h += ' · close $' + fmt(s.price) + ' · ATR14 $' + fmt(s.atr) + '</small>';

  /* All three layers voting breakdown (v3 complete) */
  var layerText = '';

  /* Layer 1: Price */
  layerText += '<small>🔵 Price: ' + Math.round(s.pct * 100) + '% (' + (s.dir || 'N/A').toUpperCase() + ') · ';

  /* Layer 2: Order Flow */
  /* "Flow" is candle arithmetic, not order flow: every read in order-flow.js
     comes off the same OHLCV bars layer 1 votes on, and it agreed with layer 1
     on 53 of 56 measured tapes. Say so on the card rather than implying a book
     the tab has never seen. */
  if (s.orderFlow && s.orderFlow.direction){
    var ofEmoji = s.orderFlow.direction === 'long' ? '🟢' : s.orderFlow.direction === 'short' ? '🔴' : '⚪';
    layerText += ofEmoji + ' Flow: ' + (s.orderFlow.direction || 'N').toUpperCase()
      + (s.orderFlow.proxyOnly ? ' (candle proxy)' : '') + ' · ';
  }

  /* Layer 3: Sentiment. A stale row is printed — it is what was read — but
     labelled, and it contributed 0 to the confidence above. */
  if (s.sentiment && s.sentiment.score !== undefined){
    if (s.sentiment.stale){
      layerText += '⏱️ Senti: ' + s.sentiment.score.toFixed(2) + ' ('
        + (s.sentiment.missing ? 'no data' :
            ((typeof hgSentimentAgeLabel === 'function' ? hgSentimentAgeLabel(s.sentiment) : 'stale')
             + ' old, ttl ' + s.sentiment.ttl + 's'))
        + ' — not scored)';
    } else {
      var sentEmoji = s.sentiment.score > 0.3 ? '🟢' : s.sentiment.score < -0.3 ? '🔴' : '🟡';
      layerText += sentEmoji + ' Senti: ' + s.sentiment.score.toFixed(2);
    }
  }
  layerText += '</small>';

  /* Agreement + Confidence */
  if (s.layerAgreement !== undefined){
    var agreeEmoji = s.layerAgreement === 2 ? '✅' : s.layerAgreement === 1 ? '⚠️' : '❌';
    layerText += '<br><small>' + agreeEmoji + ' Agreement: ';
    if (s.layerAgreement === 2) layerText += 'All Layers Agree';
    else if (s.layerAgreement === 1) layerText += 'Partial Agreement';
    else layerText += 'Layer Divergence';
    layerText += ' · Confidence ' + (s.threeLayerConfidence || 0).toFixed(2) + ' · Tier: ' + (s.voteTier || 'weak').toUpperCase() + '</small>';
  }

  /* External Risk Flags (Phase 2). None of these could ever fire: every reader
     in liquidation-intelligence.js is an unwired placeholder, so the layer
     returns one identical object for every symbol. An empty risk line read as
     "no risk found" when nothing had looked, so say which it is. */
  if (s.externalRisk){
    var riskFlags = [];
    if (s.externalRisk.cascadeImminent) riskFlags.push('⚡ CASCADE');
    if (s.externalRisk.whaleActive) riskFlags.push('🐋 WHALE');
    if (s.externalRisk.fundingExtreme) riskFlags.push('📊 FUNDING');
    if (riskFlags.length > 0){
      layerText += '<br><small style="color:#DC2626;font-weight:700">⚠️ RISK: ' + riskFlags.join(' + ') + '</small>';
    } else if (s.externalRisk.unchecked){
      layerText += '<br><small style="color:#94A3B8">○ EXTERNAL RISK UNCHECKED — no '
        + esc((s.externalRisk.uncheckedSources || []).join(' / ') || 'external')
        + ' feed wired; cascade and whale gates cannot fire</small>';
    }
  }

  /* Pro-Grade Stamp (Phase 3) */
  if (s.isPro){
    layerText += '<br><small style="color:#166534;font-weight:700;background:#DCFCE7;padding:2px 4px;border-radius:3px">✅ PROFESSIONAL-GRADE</small>';
  }

  if (layerText) h += '<div style="font-size:9px;color:#64748B;margin-top:4px">' + layerText + '</div>';

  h += '<small>RECORD ONLY — engine measured NOT TRADABLE; this is what the rule would say</small></div>';

  /* Sentiment context and warnings */
  if (s.sentiment && typeof hgSentimentCardHTML === 'function'){
    h += '<div style="margin:6px 0">' + hgSentimentCardHTML(s.sym) + '</div>';
  }

  if (p){
    h += '<div class="cs-levels">';
    h += '<div class="cs-lv"><small>ENTRY</small><b>' + fmt(p.entry) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(220,38,38,.4)"><small>STOP LOSS</small><b style="color:#DC2626">' + fmt(p.stop) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(22,101,52,.4)"><small>TP1 (' + p.rr1 + 'R)</small><b style="color:#166534">' + fmt(p.t1) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(22,101,52,.4)"><small>TP2 (' + p.rr2 + 'R)</small><b style="color:#166534">' + fmt(p.t2) + '</b></div>';
    h += '</div>';
    h += '<div class="cs-plan"><b>RECORD ONLY — NOT A TICKET</b><br>' + esc(p.orderType) + ' at the close <b>$' + esc(fmt(p.entry)) + '</b> · STOP <b>$' + esc(fmt(p.stop)) + '</b> (' + esc(fmt(p.stopAtr, 2)) + '×ATR) · TP1 <b>$' + esc(fmt(p.t1)) + '</b> (' + p.rr1 + 'R) · TP2 <b>$' + esc(fmt(p.t2)) + '</b> (' + p.rr2 + 'R) · expires after ' + p.timeoutBars + ' bars (6h)';
    h += '<br>At TP1 close 50%, stop to breakeven ($' + esc(fmt(p.entry)) + '); runner to TP2. A 15m close beyond the stop kills the idea.';
    if (p.floorNote) h += '<br>' + esc(p.floorNote);
    h += '</div>';
  }

  if (s.qualityGates && s.qualityGates.length) h += '<div style="font-size:9px;color:#F59E0B;padding:6px 8px;border:1px solid rgba(245,158,11,.3);border-radius:4px;margin:6px 0;background:rgba(245,158,11,.05)">Quality flags: ' + esc(s.qualityGates.join(' · ')) + '</div>';

  if (s.gates && s.gates.length) h += '<div class="cs-gate">' + esc(s.gates.join(' · ')) + '</div>';

  /* vote table placeholder — rendered lazily on first expand */
  h += '<div id="cs_v_' + idx + '" class="cs-votes-placeholder">▸ 470-indicator vote table — loading on expand…</div>';

  h += '</div></div>';
  return h;
}

/* test seam: the card is the thing that claims, so a test about what a card
   says should render one rather than grep for the string it would contain.
   A source scan for the UNCHECKED line survived a mutation that made its
   branch unreachable, because the regex matched the dead body. */
W.__csSetupCardHTML = setupCardHTML;
W.csBlockerTally = csBlockerTally;
W.csWhyEmptyHTML = csWhyEmptyHTML;
W.csFooterNote = csFooterNote;
W.CS_LABEL_V = CS_LABEL_V;
W.csCoverage = csCoverage;
W.csUnreadWhyText = csUnreadWhyText;
W.csCoverageHTML = csCoverageHTML;
W.csEmptyHTML = csEmptyHTML;
W.csProReady = csProReady;

var __ui = null, __results = null, __busy = false;

function setStat(txt, bad){
  try{
    if (__ui && __ui.stat){ __ui.stat.textContent = txt; __ui.stat.style.color = bad ? '#DC2626' : ''; }
  }catch(e){}
}
function setProgress(pctV){
  try{ if (__ui && __ui.bar) __ui.bar.style.width = Math.min(100, Math.max(0, pctV)) + '%'; }catch(e){}
}

function renderCards(setups, run){
  if (!__ui || !__ui.cards) return;
  __voteStore = {};
  if (!setups || !setups.length){
    __ui.cards.innerHTML = csEmptyHTML(run || (setups ? { setups: setups } : null));
    return;
  }
  var hq = setups.filter(function(s){ return s.isHighQuality; });
  var longs = hq.filter(function(s){ return s.dir === 'long'; }).length;
  var shorts = hq.length - longs;
  var allLongs = setups.filter(function(s){ return s.dir === 'long'; }).length;
  var allShorts = setups.length - allLongs;
  /* The label used to read "(75%+ confidence, trend, liquid hours)", which is
     three of the conditions out of seven. isHighQuality is qualityGates.length
     === 0 AND proGradeCheck.isPro, so it also needs the voting gate, no major
     sentiment conflict, three-layer confidence >= 0.75, price and order flow
     pointing the same way, and no liquidation cascade. Under-describing it was
     worst at zero: "0 HIGH-QUALITY setups (75%+ confidence, trend, liquid
     hours)" reads as "nothing cleared 75% agreement", when the thing that
     emptied the block is usually one of the four conditions not named. */
  var h = '<div class="cs-summary"><b>' + hq.length + ' HIGH-QUALITY</b> setup' + (hq.length === 1 ? '' : 's') + ' (every quality gate clear · three-layer confidence 75%+ · price and flow agree) — '
    + longs + ' LONG · ' + shorts + ' SHORT<br>'
    + '<span style="font-weight:400;font-size:10px;color:#64748B">' + setups.length + ' total signals (includes ' + (setups.length - hq.length) + ' lower-quality). Click to expand vote table.</span></div>';
  var hqSetups = setups.filter(function(s){ return s.isHighQuality; });
  var lqSetups = setups.filter(function(s){ return !s.isHighQuality; });

  /* say how much of the universe was read before saying anything about it */
  h += csCoverageHTML(run || { setups: setups });
  /* then name the gate that closed the block, before blaming the reads */
  h += csWhyEmptyHTML(csBlockerTally(setups));

  if (hqSetups.length > 0){
    h += '<div style="margin:10px 0;font-size:11px;font-weight:700;color:#166534;padding:6px 8px;background:#DCFCE7;border-radius:6px">HIGH-QUALITY SIGNALS'
      + '<br><span style="font-weight:400;font-size:10px;color:#166534">every quality gate clear (75%+ price agreement · trend regime · liquid hours · voting gate · no sentiment conflict) AND pro-grade (three-layer confidence 75%+ · price and order flow agree · no liquidation cascade)</span></div>';
    for (var i = 0; i < hqSetups.length; i++){
      __voteStore[setups.indexOf(hqSetups[i])] = hqSetups[i].votes;
      h += setupCardHTML(hqSetups[i], setups.indexOf(hqSetups[i]));
    }
  }

  if (lqSetups.length > 0){
    h += '<div style="margin:10px 0;font-size:10px;font-weight:600;color:#64748B;padding:4px 6px;background:#F1F5F9;border-radius:4px">Lower-quality signals (' + lqSetups.length + ') — expand to see reason</div>';
    for (var i = 0; i < lqSetups.length; i++){
      __voteStore[setups.indexOf(lqSetups[i])] = lqSetups[i].votes;
      h += setupCardHTML(lqSetups[i], setups.indexOf(lqSetups[i]));
    }
  }

  h += csFooterNote(setups, hqSetups.length, csBlockerTally(setups));
  __ui.cards.innerHTML = h;
}

async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  var engine = W.cryptoUltraEngine;
  if (typeof engine !== 'function'){
    setStat('cryptoUltraEngine not loaded — load the CRYPTO ULTRA tab first', true);
    __busy = false;
    return 'error: engine missing';
  }
  var loadUni = W.hgDeskLoadDeltaCoinDCX || W.hgDeskLoadUniverse;
  var fetchKl = W.hgDeskFetchKlines;
  if (typeof loadUni !== 'function' || typeof fetchKl !== 'function'){
    setStat('desk-scan-universe.js not loaded — universe helpers missing', true);
    __busy = false;
    return 'error: universe missing';
  }

  /* Load sentiment data for enrichment */
  if (typeof hgSentimentLoad === 'function'){
    try{
      await hgSentimentLoad();
    }catch(e){
      console.warn('[cryptoscan] sentiment load failed:', e);
    }
  }

  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat('loading universe (Delta + CoinDCX futures)…');
    setProgress(0);
    var pack = await loadUni({ minTurnover: 0, includeUnknown: true });
    var items = pack.items || [];
    if (!items.length){ setStat('universe empty — no contracts above $5M turnover', true); return 'error: empty universe'; }
    var vc = pack.venueCounts || {};
    setStat('scanning ' + items.length + ' contracts (Delta ' + (vc.delta || 0) + ' · CoinDCX ' + (vc.coindcx || 0) + ')…');

    var setups = [], scanned = 0, errors = 0, skipped = 0, unread = 0;
    var unreadWhy = {};
    var now = Date.now();
    /* hgDeskFetchKlines resolves to an array whatever went wrong, so a
       network outage and a three-bar contract both arrive as length < 230.
       The result form says which; fall back to the array form if an older
       desk-scan-universe.js is loaded. */
    var fetchRes = W.hgDeskFetchKlinesResult;

    for (var i = 0; i < items.length; i++){
      var item = items[i];
      try{
        var got15 = fetchRes
          ? await fetchRes(item, '15m', KL_15M)
          : { rows: (await fetchKl(item, '15m', KL_15M)) || [], ok: true, reason: null };
        if (!got15.ok){
          unread++; unreadWhy[got15.reason || 'unknown'] = (unreadWhy[got15.reason || 'unknown'] || 0) + 1;
          scanned++; setProgress((scanned / items.length) * 100); continue;
        }
        var rows15m = got15.rows;
        if (!rows15m || rows15m.length < 230){ skipped++; scanned++; setProgress((scanned / items.length) * 100); continue; }
        var rows1h = await fetchKl(item, '1h', KL_1H);

        var res = engine({ rows15m: rows15m, rows1h: rows1h || [], now: now, venueCost: costFor(item), allowUnverified: true });
        scanned++;
        setProgress((scanned / items.length) * 100);

        if (res.ok && res.dir && res.plan){
          var pct = res.count ? res.count.pct : 0;
          var h = new Date(now).getUTCHours();
          /* The two ranges were decorative: (h>=7 && h<12) || (h>=12 && h<17)
             has no gap, so it is one 10-hour block, 07:00-17:00 UTC.

             It is also FIXED UTC, and summer-anchored. Read as local sessions
             (Intl, 2026): in summer it is London 08:00-18:00 and New York
             03:00-13:00; in winter it is London 07:00-17:00 and New York
             02:00-12:00. London is off the offset this window assumes on 155
             days of the year (42%), New York on 127 (35%). Which local hours
             the author meant is not recorded, so the window is NOT moved here
             — picking an anchor is a trading decision, the same call made for
             the gold session-weight table in pack 860. What is no longer left
             implicit is the consequence below.

             Ten of 24 hours pass, so for 14 hours a day — 58% — no setup can
             be HIGH-QUALITY whatever its confluence, and the footer used to
             explain that emptiness entirely in terms of signal quality. The
             blocker tally now says which gate actually closed the block. */
          var liquidHour = (h >= 7 && h < 17);
          var qualityGates = [], gateKeys = [];
          function addGate(key, text){ gateKeys.push(key); qualityGates.push(text); }
          if (pct < 0.75) addGate('confidence', 'confidence ' + Math.round(pct * 100) + '% < 75%');
          if (res.regime === 'chop') addGate('regime', 'regime: CHOP');
          if (!liquidHour) addGate('session', 'session: low liquidity (outside 07:00-17:00 UTC)');

          /* Layer 2: Order Flow Voting (decorrelates from price action) */
          var orderFlow = {};
          var orderFlowDir = 'neutral';
          if (typeof hgOrderFlowScore === 'function'){
            orderFlow = hgOrderFlowScore(item.sym, rows15m, rows1h || []);
            orderFlowDir = orderFlow.direction;
          }

          /* Layer 3: Sentiment + External Risk Scoring */
          var sentiment = {};
          var sentimentGate = null;
          var externalRisk = {};
          if (typeof hgSentimentGet === 'function'){
            sentiment = hgSentimentGet(item.sym);
          }
          if (typeof hgExternalRiskScore === 'function'){
            externalRisk = hgExternalRiskScore(item.sym);
          }
          /* hgSentimentScoreSignal applies the same staleness rule internally */
          var sentimentAdjusted = pct;
          if (typeof hgSentimentScoreSignal === 'function' && sentiment.score !== undefined){
            sentimentAdjusted = hgSentimentScoreSignal(item.sym, pct, res.dir);
          }

          /* Layer Agreement Check */
          var layerAgreement = 0;
          if (orderFlowDir === 'neutral'){
            layerAgreement = 1;
          } else if (orderFlowDir === res.dir){
            layerAgreement = 2;
          } else {
            layerAgreement = 0;
          }

          /* Phase 3: Three-Layer Consensus Logic (v3 final) */
          var voteResult = { shouldTrade: true };
          /* A sentiment row past its own ttl is not a reading, so it must not
             carry 25% of the confidence that sets this card's tier and its
             PROFESSIONAL-GRADE stamp. hgSentimentGet now reports that (it is a
             port of scripts/sentiment-engine.py's is_cache_fresh); the raw
             score stays on the setup so the card can print what was read and
             how old it is. */
          var sentimentLive = (sentiment && sentiment.stale) ? 0 : (sentiment.score || 0);
          if (typeof hgComputeThreeLayerConfidence === 'function'){
            voteResult = hgComputeThreeLayerConfidence(
              { pct: pct, dir: res.dir },
              { score: orderFlow.score || 0, dir: orderFlowDir },
              { sentiment: sentimentLive },
              externalRisk
            );
          }

          /* Apply voting result to quality gates */
          if (!voteResult.shouldTrade){
            addGate('voting', 'VOTING_GATE: ' + (voteResult.gateReasons || []).join(' + '));
          }

          /* Sentiment conflict detection */
          if (typeof hgSentimentGate === 'function'){
            sentimentGate = hgSentimentGate(item.sym, res.dir, pct);
            if (!sentimentGate.shouldTrade && sentimentGate.conflictLevel === 'major'){
              addGate('sentiment', 'sentiment: ' + res.dir + ' vs ' + (sentiment.score > 0 ? 'bullish' : 'bearish'));
            }
          }

          /* Final three-layer confidence */
          var threeLayerConfidence = voteResult.confidence || 0;

          /* Check if professional-grade (all gates passed + high confluence) */
          var proGradeCheck = { isPro: false };
          if (typeof hgIsProGradeSetup === 'function'){
            proGradeCheck = hgIsProGradeSetup({
              threeLayerConfidence: threeLayerConfidence,
              layerAgreement: layerAgreement,
              externalRisk: externalRisk,
              qualityGates: qualityGates,
              plan: res.plan
            });
          }

          var setup = {
            item: item,
            label: symLabel(item),
            sym: item.sym,
            exchange: item.exchange,
            dir: res.dir,
            pct: pct,
            threeLayerConfidence: Math.max(0, Math.min(1, threeLayerConfidence)),
            voteResult: voteResult,
            voteTier: voteResult.tier || 'weak',
            sentimentAdjusted: sentimentAdjusted,
            sentiment: sentiment,
            sentimentLive: sentimentLive,
            orderFlow: orderFlow,
            orderFlowDir: orderFlowDir,
            layerAgreement: layerAgreement,
            externalRisk: externalRisk,
            isPro: proGradeCheck.isPro,
            regime: res.regime,
            atr: res.atr,
            price: res.price,
            plan: res.plan,
            line: res.line,
            count: res.count,
            fire: res.fire,
            recordOnly: res.recordOnly,
            gates: res.gates,
            votes: res.votes,
            bar: res.bar,
            qualityGates: qualityGates,
            gateKeys: gateKeys,
            isHighQuality: qualityGates.length === 0 && proGradeCheck.isPro
          };

          /* SMC context — ACTIVE on sort order as of v732 (record-only before that).
             setup.smc feeds csSortSetups below; it still does not gate, tier or change
             which cards are high-quality. See csSmcRank for why it ranks but never vetoes.
             Levels live on res.plan, so a synthetic row carries them to the enricher and the
             result is copied back. The tape is trimmed to the closed bar the engine voted on
             (the engine drops the forming bar via closedRows) so SMC grades the same bar. */
          var smcRows = rows15m.slice(0, -1);
          if (res.bar && res.bar.t != null){
            for (var bi = rows15m.length - 1; bi >= 0; bi--){
              if (rows15m[bi].t === res.bar.t){ smcRows = rows15m.slice(0, bi + 1); break; }
            }
          }
          var smcRow = { sym: item.sym, dir: res.dir, entry: res.plan.entry, stop: res.plan.stop, t1: res.plan.t1 };
          try{ if (typeof W.hgSmcEnrich === 'function') W.hgSmcEnrich(smcRow, { rows: smcRows, tab: 'CRYPTO SCAN' }); }catch(eSmc){}
          if (smcRow.smc) setup.smc = smcRow.smc;

          setups.push(setup);
        }

        if (scanned % 5 === 0){
          setStat('scanned ' + scanned + '/' + items.length + ' · ' + setups.length + ' setup(s) so far…');
        }
      }catch(e){
        errors++;
        scanned++;
        setProgress((scanned / items.length) * 100);
      }
    }

    csSortSetups(setups);

    /* v735: FORWARD LOG. Until now this desk measured nothing about itself —
       every number on its cards came from the same rolling window it had just
       fetched, so re-scanning reshuffled noise rather than adding evidence, and
       CRYPTO SCAN was absent from Setup Intelligence entirely because that
       dashboard reads hg-forward.js and nothing here wrote to it.

       Recorded per scan, once per bar: hgFwdAdd keys on tab+mechanic+sym+dir+
       barT, so pressing SCAN repeatedly inside one 15m bar cannot turn a single
       setup into a hundred samples. Resolution happens later, from candles that
       had not printed when the record was written.

       mechanic is the VOTE TIER, not a constant, so the log answers the
       question worth asking — whether the tab's own confidence tiers actually
       separate — instead of pooling everything into one undifferentiated bag.

       `ticket` marks the HIGH-QUALITY cohort (the green block: no quality gates
       AND pro-grade). That is not a claim these are tradeable — the cards say
       RECORD ONLY — it is the split that lets someone later ask whether the
       tab's strongest claim paid better than its weakest. */
    try{
      if (typeof W.hgFwdRecordScan === 'function'){
        var fwdRows = csFwdRows(setups);
        if (fwdRows.length) W.hgFwdRecordScan('CRYPTO SCAN', '15m', fwdRows, { horizonBars: csFwdHorizon(setups) });
      }
    }catch(eFwd){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('cryptoscan', eFwd); }catch(eW){} }

    /* universe is the list the scan was HANDED, which two filters already
       shrank. Carry the funnel so COVERAGE can quote both. */
    __results = { at: now, setups: setups, scanned: scanned, errors: errors, skipped: skipped,
                  unread: unread, unreadWhy: unreadWhy, universe: items.length,
                  offered: +pack.rawLen || 0,
                  droppedTurnover: +pack.droppedTurnover || 0,
                  droppedVenue: +pack.droppedVenue || 0,
                  droppedNoTicker: +pack.droppedNoTicker || 0,
                  minTurnover: +pack.minTurnover || 0 };
    renderCards(setups, __results);
    setStat(setups.length + ' setup(s) from ' + scanned + ' scanned · ' + skipped + ' skipped (too few bars) · '
      + unread + ' unread (fetch) · ' + errors + ' errors · ' + new Date().toISOString().slice(11, 19) + ' UTC', false);
    setProgress(100);
    return 'refreshed';
  }catch(e){
    setStat('scan failed: ' + ((e && e.message) || e), true);
    return 'error: ' + ((e && e.message) || e);
  }finally{
    __busy = false;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + CS_CSS + '</style>'
      + '<div class="cs-wrap">'
      + '<h2 class="cs-hdr">CRYPTO SCAN <span>· all Delta + CoinDCX futures · 470-read vote engine · full indicator breakdown · record only</span></h2>'
      + '<div style="margin:8px 0"><button class="btn" id="csRun">SCAN ALL FUTURES</button> <span class="cs-stat" id="csStat">idle — scans every futures contract (Delta + CoinDCX) through the unverified CRYPTO ULTRA 470-read vote engine. All setups are record only, not for trading. Full indicator breakdown on each card.</span></div>'
      + '<div class="cs-bar"><div class="cs-bar-fill" id="csBar" style="width:0%"></div></div>'
      + '<div id="csCards"></div>'
      + '</div>';
    var cards = el.querySelector('#csCards');
    var stat = el.querySelector('#csStat');
    var btn = el.querySelector('#csRun');
    var bar = el.querySelector('#csBar');
    __ui = { cards: cards, stat: stat, btn: btn, bar: bar };
    if (btn) btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results && __results.setups) renderCards(__results.setups, __results);
  }catch(e){}
}

function refresh(){
  return runScan(__ui);
}

function cryptoScanState(){
  return __results || null;
}

W.cryptoScanState = cryptoScanState;
/* Exported so the SMC ordering can actually be tested: everything else in the
   scan path sits inside runScan, which is unreachable without a live network,
   so a behaviour test is impossible unless the decision is a pure function. */
W.__csSmcRank = csSmcRank;
W.__csSortSetups = csSortSetups;
W.__csFwdRows = csFwdRows;
W.__csFwdHorizon = csFwdHorizon;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CRYPTO SCAN', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'CRYPTO SCAN', run: async function(){ if (!__ui) return 'unavailable: not mounted'; return runScan(__ui); } });

})();
