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

/* WHAT THE STOP CAME FROM, and what the 1.5R target has to pay for.

   THE CARD HEAD PRINTED "R:R 1.5" ON EVERY CARD. cryptoultra prices
   t1 = entry +/- |entry - stop| * RULE.t1R, so the ratio is RULE.t1R exactly,
   for every setup, forever. Measured over 359 plans across five price scales,
   two venues and a wide volatility sweep: ONE distinct value, 1.500000. The
   footer already said an R:R test "is true for every setup by construction and
   filters nothing" -- the card head went on printing it in the one row a
   reader scans across five hundred contracts.

   WHAT DOES VARY IS WHERE THE STOP CAME FROM. The engine takes
   stopDist = max(RULE.stopAtr * ATR14, price * rtFrac * RULE.costFloorMult),
   so the fee floor wins exactly when

     ATR14 / price  <  (costFloorMult / stopAtr) * rtFrac

   which with the shipped 8 and 1.5 is 0.800% on Delta (rtFrac 0.0015) and
   1.067% on CoinDCX and Binance (0.002). That is a derivation, not a
   simulation. Below those ratios -- which is most liquid perps most of the
   time on a 15m bar -- the invalidation level is eight times the round-trip
   fee and has nothing to do with the chart. Over the sweep above the floor
   bound on 39% of plans and pushed stops to 15.15x ATR at the extreme, with a
   median of 1.50x and a p90 of 3.67x.

   AND THE DRAG IS EXACT TOO. Round-trip cost over risk is
   rtFrac * price / stopDist, so when the floor binds it is 1 / costFloorMult
   = 0.125R for every venue and every contract, and when it does not bind it is
   strictly less. Of a 1.5R target, that is up to 8.3% paid to the exchange
   before the trade can be right. Nothing here changes a threshold -- the floor
   and the ladder are the engine's -- the card just stops showing the one
   number that cannot vary and shows the two that do. */
function csStopProvenance(s){
  var p = s && s.plan;
  if (!p || !isFinite(+p.entry) || !isFinite(+p.stop)) return null;
  var rule = W.HG_CRYPTO_ULTRA_RULE || {};
  var baseAtr = isFinite(+rule.stopAtr) ? +rule.stopAtr : NaN;
  var mult = isFinite(+rule.costFloorMult) ? +rule.costFloorMult : NaN;
  var atrMult = isFinite(+p.stopAtr) ? +p.stopAtr : NaN;
  var risk = Math.abs(+p.entry - +p.stop);
  var vc = s.item ? costFor(s.item) : null;
  var rt = vc && isFinite(+vc.rtFrac) ? +vc.rtFrac : NaN;
  var price = isFinite(+s.price) && +s.price > 0 ? +s.price : NaN;
  /* absent means absent: no venue cost, no drag -- never a fabricated zero */
  var dragR = (isFinite(rt) && isFinite(price) && risk > 0) ? (rt * price) / risk : NaN;
  /* the floor bound iff the stop is wider than the volatility stop would be.
     floorNote says so in prose; this is the same fact as a number, and it
     survives a plan that carries no note. */
  var byFloor = isFinite(atrMult) && isFinite(baseAtr) && atrMult > baseAtr + 1e-9;
  return {
    atrMult: atrMult,
    baseAtr: baseAtr,
    byFloor: byFloor,
    source: byFloor ? 'fee floor' : (isFinite(atrMult) ? 'volatility' : null),
    dragR: dragR,
    rtFrac: rt,
    venue: vc ? vc.venue : null,
    /* the ATR/price below which the fee floor takes over on THIS venue */
    bindPct: (isFinite(rt) && isFinite(mult) && isFinite(baseAtr) && baseAtr > 0)
      ? (mult / baseAtr) * rt : NaN
  };
}

/* One line for the card head, in place of the constant it replaces. */
function csStopNote(s){
  var pv = csStopProvenance(s);
  if (!pv || !isFinite(pv.atrMult)) return '';
  var out = 'stop ' + pv.atrMult.toFixed(2) + '×ATR';
  out += pv.byFloor ? ' (fee floor, not volatility)' : ' (volatility)';
  if (isFinite(pv.dragR)) out += ' · fees ' + pv.dragR.toFixed(3) + 'R of the 1.5R';
  return out;
}

/* rr() lived here to feed the card head's "R:R" slot and had no other caller.
   It computed |t1 - entry| / |entry - stop| on a plan whose t1 IS
   |entry - stop| * RULE.t1R, so it returned RULE.t1R every time. Kept as an
   exported probe rather than deleted, because the test that proves the ratio
   is a constant needs to compute it, and computing it in the test instead
   would let the claim drift away from the code. */
function rr(entry, stop, t1){
  if (!isFinite(+entry) || !isFinite(+stop) || !isFinite(+t1) || +entry === +stop) return null;
  var risk = Math.abs(+entry - +stop), reward = Math.abs(+t1 - +entry);
  return risk > 0 ? +(reward / risk).toFixed(2) : null;
}

/* ── CLOSED BARS FOR EVERY LAYER, ALIGNED TO THE BAR LAYER 1 VOTED ON ──

   cryptoultra.js drops the forming bar (closedRows) before a single one of its
   470 reads runs, so layer 1's direction, its `pct`, and res.bar all describe
   one CLOSED bar. The SMC block below already trimmed its tape to that same
   bar for exactly this reason, and said so: "so SMC grades the same bar".

   Layer 2 did not. hgOrderFlowScore was handed the raw fetch, forming bar and
   all, and layer 2 carries 35% of the confidence, sets layerAgreement, and
   pays the +15% / -20% multiplier against layer 1.

   Two things follow, and both are defects rather than preferences.

   LOOKAHEAD. The forward record is keyed at res.bar.t (pack 873) and
   hgFwdSettle walks bars STRICTLY AFTER it, so the forming bar is inside the
   trade's own settlement window. A tier computed partly from it has read the
   trade's future. That tier is the forward log's pooling key, so the one
   question the log exists to answer -- do this desk's tiers separate? -- was
   being asked of labels that had peeked.

   A CLOCK IS NOT A MARKET FACT. A forming bar holds a fraction of its
   eventual volume, and hgSweepPattern compares exactly that number against an
   average of complete bars: volRatio = f x fullVol / avgVol against a 1.5
   gate, so the read needs f >= 1.5 x avgVol / fullVol and an ordinary bar
   (fullVol ~ avgVol) needs f >= 1.5, which cannot happen. On one fixed tape
   with one fixed forming bar, moving only the moment the scan ran:

     scanned 0-50% into the bar   layer 2 = +0.7224   3 reads   no sweep
     scanned 75% in               layer 2 = +0.2821   4 reads   sweep fires
     scanned 97% in               layer 2 = +0.2236   4 reads   sweep fires

   Same market, same bar, 0.51 of layer-2 score -- 0.18 of confidence at the
   0.35 weight -- decided by the clock. Trimmed, it is +0.7224 at every one of
   those moments.

   Swept over 495 tapes (9 drifts x 5 vols x 11 elapsed fractions), 476 of
   which produce a layer-1 direction:

     layer-2 score differs        405 / 495   (81.8%)
     layer-2 direction differs     10 / 495   (2.0%)
     voteTier differs              34 / 476   (7.1%)   <- the log's pooling key
     shouldTrade differs           27 / 476   (5.7%)
     PROFESSIONAL-GRADE differs     9 / 476   (1.9%)   <- the log's ticket split
     sweep read fired    raw 3/495, and all three at 0.99 elapsed
                         closed 8/495, spread across the grid

   No threshold, weight or multiplier is touched here. The 0.2 direction band,
   the 0.35 weight and the +15% / -20% agreement multiplier are calibration and
   stay the desk's call. Both layers are simply shown the same bars. */

/* Trim to the bar the engine reported. Absent bar -> drop the last row, which
   is what the engine's own rule does when nothing else is droppable. */
function csTrimToBar(rows, barT){
  if (!Array.isArray(rows) || !rows.length) return [];
  if (barT !== null && barT !== undefined && isFinite(+barT)){
    for (var i = rows.length - 1; i >= 0; i--){
      if (+rows[i].t === +barT) return rows.slice(0, i + 1);
    }
  }
  return rows.slice(0, -1);
}

/* cryptoultra.js closedRows, for a tape the engine reports no bar for (it
   ignores the 1h leg entirely, so there is no res.bar to align to). A bar
   opening at t closes at t + ivSec; keep it only once that has passed. The
   trailing slice mirrors the engine: if nothing was droppable the feed is
   assumed to have handed us a forming bar anyway. */
function csClosedRows(rows, ivSec, nowMs){
  if (!Array.isArray(rows) || !rows.length) return [];
  var cutoff = (nowMs / 1000) - ivSec, out = [], i, t;
  for (i = 0; i < rows.length; i++){
    /* +null, +undefined and +'' are all 0, and 0 <= cutoff, so a stamp-less
       row would be KEPT as a bar that closed in 1970 -- the exact trap
       fixpack14-core.js documents. Absent means absent: a row that cannot say
       when it opened cannot be shown to have closed. cryptoultra's own
       closedRows lets such a row through (it adds ivSec to both sides and
       never tests the stamp); this diverges only there, and section 2 pins
       parity on every well-formed tape. */
    t = (rows[i] && rows[i].t !== null && rows[i].t !== undefined && rows[i].t !== '')
      ? +rows[i].t : NaN;
    if (isFinite(t) && t <= cutoff) out.push(rows[i]);
  }
  return out.length < rows.length ? out : rows.slice(0, -1);
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
     v5  pack 877 - layer 2 reads the same CLOSED bars layer 1 voted on
         instead of the raw fetch. 34 of 476 swept cells changed tier and 27
         changed shouldTrade, and the v1-v4 labels had additionally read a bar
         inside their own record's settlement window.

   Records written under v1 are still in a live tab's localStorage, pooling
   with v4 records under identical keys, and nothing marked them. This repo
   already knows the answer: hg-forward.js writes `solV`, "the stamp version",
   beside the solidity score for exactly this reason. So the version goes into
   the mechanic, which IS the pooling key, and old labels stop contaminating
   new ones instead of being silently averaged with them.

   Bump this whenever the label pipeline changes. tests/test-cryptoscan-label-
   version.mjs hashes that pipeline and fails if it moves without a bump, so
   the decision is made on purpose rather than forgotten. */
var CS_LABEL_V = 5;

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
    /* THE PRICE WHEN THE PLAN FIRED. hg-forward runs a second, fill-aware
       settlement beside the naive one, and it needs this field to recover the
       order type — without it hgFwdOrderType returns null and the fill walk
       never runs, so every CRYPTO SCAN record sat outside the pool that exists
       precisely because the naive walk is biased.

       This desk enters at the close (cryptoultra prices entry = res.price and
       stamps the plan BUY / SELL), so mark === entry and the order is a
       MARKET one. Passing it does not assume that — it lets the log derive it,
       and if a later change ever snaps entry away from the live price the
       record will correctly read as a limit or a stop instead. Absent means
       absent: no price, no mark, and the fill walk stands aside as before. */
    var mk = isFinite(+s.price) && +s.price > 0 ? +s.price : undefined;
    out.push({
      sym: String(s.sym), dir: s.dir,
      entry: en, stop: st, t1: tp,
      mark: mk,
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
  /* a contract whose BARS were read and whose engine ran, but whose scoring
     threw. A subset of `read`, not a sibling of it — see the loop. */
  var scoreFailed = Math.max(0, +(run && run.scoreFailed) || 0);
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
    scoreFailed: scoreFailed,
    scoreWhy: (run && run.scoreWhy && typeof run.scoreWhy === 'object') ? run.scoreWhy : {},
    read: read, signals: signals,
    offered: offered, droppedTurnover: dTurn, droppedVenue: dVenue, droppedNoTicker: dNoTick,
    dropped: dTurn + dVenue + dNoTick,
    minTurnover: Math.max(0, +(run && run.minTurnover) || 0),
    pct: universe > 0 ? read / universe : null,
    /* against what the source actually offered, which is the honest ceiling */
    pctOffered: offered > 0 ? read / offered : null,
    partial: (skipped + errors + unread + scoreFailed) > 0,
    known: universe > 0 || scanned > 0
  };
}

/* A BOUNDED LABEL FOR A SCORING CRASH.

   The message on a thrown Error is unbounded and can carry anything a
   dependency put in it, and it lands in the COVERAGE panel. Take the
   constructor name and a short slice of the message, so a hundred contracts
   failing the same way tally as one line instead of a hundred, and a long or
   hostile message cannot run away with the panel. Escaping still happens at
   render; this only bounds the key. */
function csScoreFailKey(err){
  var name = (err && err.name) ? String(err.name) : 'Error';
  var msg = (err && err.message) ? String(err.message) : '';
  msg = msg.replace(/\s+/g, ' ').trim().slice(0, 60);
  return msg ? (name + ': ' + msg) : name;
}

/** "TypeError: ... (3)" joined for whatever scoring failures were recorded */
function csScoreWhyText(cov){
  var why = (cov && cov.scoreWhy) || {}, parts = [], k;
  var keys = Object.keys(why).sort(function(a, b){ return why[b] - why[a]; });
  for (var i = 0; i < keys.length; i++){
    k = keys[i];
    if (!why[k]) continue;
    parts.push(k + ' (' + why[k] + ')');
  }
  return parts.join(' · ');
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
  if (c.errors) txt += ' · ' + c.errors + ' threw before their bars could be read';
  /* Read and voted on, then OUR scoring threw. Worth separating from `errors`
     for the same reason pack 870 separated `unread` from `skipped`: one is a
     fact about the feed, the other is a bug in this app, and a reader cannot
     act on the second if it is reported as the first. */
  if (c.scoreFailed){
    var sw = csScoreWhyText(c);
    txt += ' · ' + c.scoreFailed + ' read and voted, then scoring threw'
      + (sw ? ': ' + sw : '');
  }
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

/* WHICH GATE ACTUALLY CLOSED THE BLOCK.

   Pack 868 built csBlockerTally and the ONLY-blocker column to answer this,
   and the footer consulted it for exactly one of five gates. Every other
   outcome fell through to a hardcoded "most signals lack sufficient
   confluence" — a phrase naming nothing in this pipeline, since the gates are
   confidence, regime, session, voting and sentiment, and "confluence" is not
   among them. Measured by handing the footer 25 setups blocked by exactly one
   gate, once per gate:

     confidence   blames confluence
     regime       blames confluence
     session      NAMED
     voting       blames confluence
     sentiment    blames confluence

   One of five. And it is worse than one in five in practice: the session gate
   passes 07:00-17:00 UTC, so during those ten hours session can never be a
   blocker, clockSole is 0 by construction, and the footer reaches the
   confluence line whatever actually happened.

   csTopBlocker returns the largest ONLY-blocker (a gate that, alone, stopped a
   setup that was otherwise pro-ready), falling back to the pro-grade stamp,
   then to the most common gate among setups with several open — labelled so
   the reader knows which of the three they are being told. */
function csTopBlocker(tally){
  if (!tally) return null;
  var k, best = null, n;
  for (k in (tally.sole || {})) if (Object.prototype.hasOwnProperty.call(tally.sole, k)){
    n = tally.sole[k] || 0;
    if (n > 0 && (!best || n > best.n)) best = { key: k, n: n, kind: 'sole' };
  }
  if (best) return best;
  if (tally.proBlocked > 0) return { key: 'pro', n: tally.proBlocked, kind: 'pro' };
  for (k in (tally.byGate || {})) if (Object.prototype.hasOwnProperty.call(tally.byGate, k)){
    n = tally.byGate[k] || 0;
    if (n > 0 && (!best || n > best.n)) best = { key: k, n: n, kind: 'multi' };
  }
  return best;
}

/* WHAT THE FORWARD LOG ACTUALLY SAYS, so the footer stops asserting it.

   The closing note claimed the engine "produces high volume but low accuracy"
   two sentences above "no win rate is claimed" — an accuracy claim beside a
   promise not to make one, flagged in pack 876 and left standing because
   nothing could answer it yet. Pack 878's INDEP correction can: this reads the
   tab's own settled records, pools them, and corrects the sample for overlap
   exactly as the panel below does, using the same hgOmniPoolRead, the same
   1.5R breakeven and the same family bar. Returns null when nothing has
   settled, so the footer says that rather than inventing a verdict. */
function csFwdVerdict(){
  try{
    if (typeof W.hgFwdPool !== 'function') return null;
    var pool = W.hgFwdPool('CRYPTO SCAN') || {};
    var keys = [], k;
    for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
    if (!keys.length) return null;
    var wins = 0, settled = 0, open = 0, i, p;
    for (i = 0; i < keys.length; i++){
      p = pool[keys[i]];
      if (!p) continue;
      wins += (p.wins || 0);
      settled += (p.samples || 0);
      open += (p.open || 0);
    }
    var out = { settled: settled, open: open, mechanics: keys.length,
                hit: settled ? wins / settled : NaN, effN: NaN, read: null };
    if (!settled) return out;
    var ov = (typeof W.hgFwdOverlap === 'function')
      ? W.hgFwdOverlap('CRYPTO SCAN', null, {}) : null;
    if (ov && isFinite(ov.effN)) out.effN = ov.effN;
    if (isFinite(out.effN) && typeof W.hgOmniPoolRead === 'function'){
      var barZ = (typeof W.hgOmniFamilyZ === 'function')
        ? W.hgOmniFamilyZ(Math.max(1, keys.length)) : 2;
      out.read = W.hgOmniPoolRead({ samples: out.effN, hit: out.hit },
                                  CS_FWD_MIN_RR, 20, barZ);
    }
    return out;
  }catch(e){ return null; }
}

/* The blocker sentence. Each kind is worded differently because they are
   different claims: a SOLE blocker is the thing that, alone, stopped a setup
   that was otherwise pro-ready; the pro-grade stamp is what stops a setup with
   every gate clear; and a MULTI count is only the commonest gate among setups
   with several open, which is not the same as the reason any one of them
   failed. Saying which is which is the point. */
function csBlockerSentence(top){
  if (!top || !top.n) return '';
  var label = CS_GATE_LABELS[top.key] || top.key;
  var many = top.n === 1 ? ' setup' : ' setups';
  /* the session gate's own arithmetic is a fact about the gate, not a guess */
  var clock = top.key === 'session'
    ? ' That window is 10 of 24 hours, so for 14 a day nothing here can be high-quality.' : '';
  if (top.kind === 'sole'){
    return 'The block above is empty because of one gate — ' + esc(label) + ' — not the reads: '
      + top.n + many + ' cleared everything else.' + clock + ' ';
  }
  if (top.kind === 'pro'){
    return 'Every quality gate was clear on ' + top.n + many
      + '; what stopped them was the pro-grade stamp itself '
      + '(three-layer confidence, layer agreement). ';
  }
  return 'No single gate closed the block — every setup had more than one open. '
    + 'The commonest was ' + esc(label) + ', on ' + top.n + many + '.' + clock + ' ';
}

/* The accuracy sentence, MEASURED rather than asserted. See csFwdVerdict. */
function csAccuracySentence(fwd){
  if (!fwd || !fwd.settled){
    return 'Whether this engine is accurate is not asserted here: nothing of its own has '
      + 'settled yet' + (fwd && fwd.open ? ' (' + fwd.open + ' still open)' : '') + '. ';
  }
  var pooled = Math.round(fwd.hit * 100) + '%';
  var be = Math.round(100 / (1 + CS_FWD_MIN_RR)) + '%';
  if (!isFinite(fwd.effN)){
    return 'Its own settled records so far: ' + fwd.settled + ' at ' + pooled
      + ' T1-first against a ' + be + ' breakeven, too few to measure their overlap. ';
  }
  var eff = fwd.effN >= 10 ? fwd.effN.toFixed(0) : fwd.effN.toFixed(1);
  var verdict = (fwd.read && fwd.read.read) ? fwd.read.read : 'unjudged';
  return 'Its own settled records: ' + fwd.settled + ' at ' + pooled
    + ' T1-first against a ' + be + ' breakeven, which after correcting for overlap is '
    + eff + ' independent observation' + (eff === '1' ? '' : 's') + ' — ' + verdict + '. ';
}

/* Lifted out of renderCards and exported for the same reason csBlockerTally
   is: a branch that only renderCards can reach is a branch a test can only
   grep for, and a source scan passed a mutation that pinned the condition to
   false. `fwd` is passed in rather than read here so the note stays pure. */
function csFooterNote(setups, hqCount, tally, fwd){
  var n = Array.isArray(setups) ? setups.length : 0;
  hqCount = +hqCount || 0;
  tally = tally || csBlockerTally(setups);
  var top = hqCount ? null : csTopBlocker(tally);
  return '<div class="cs-note">CRYPTO SCAN — FILTERED FOR QUALITY. Out of ' + n
    + ' total signals, ' + hqCount + ' clear every quality gate AND the pro-grade stamp '
    + '(three-layer confidence 75%+, price and order flow agreeing). Risk-reward is not among '
    + 'those standards: the plan ladder is a fixed 1.5R, so an R:R test on it is true for every '
    + 'setup by construction and filters nothing. '
    + 'Lower-quality signals shown for reference but not recommended for trading. '
    + csBlockerSentence(top)
    + 'Professional traders only trade the strongest setups. This tab shows why: signal quantity '
    + '≠ signal quality. No invented thresholds. '
    + csAccuracySentence(fwd)
    /* "No win rates claimed" was true while nothing was ever settled. The
       forward panel below now prints a measured T1-FIRST column, so the
       sentence has to distinguish the two: no rate is asserted FROM THE SCAN
       WINDOW, which is the claim that would be circular, and the settled
       outcomes below are evidence rather than a claim — which is why the panel
       reads "unjudged" until the sample supports a verdict. */
    + 'No win rate is claimed from the scan window; the forward panel below reports only '
    + 'outcomes settled by bars that had not printed when the setup fired.</div>';
}

/* ---- THE FORWARD PANEL, which this tab has never shown ----

   hg-forward.js ships hgFwdPanelHTML as "a drop-in panel any tab can render
   with one line. Kept here rather than in each tab so the wording, the
   thresholds and the honest empty state stay identical everywhere". Five desks
   render it — REVERSALSNIPER, SQUEEZE, OIFLOW, OMNIGOLD, OMNIROUTE. CRYPTO
   SCAN never did, so everything it recorded went into localStorage and stayed
   there: no reader of this tab has ever seen whether one of its own setups
   paid.

   That is the last leg of the chain. Pack 873 gave the records the bar the
   engine actually read, 874 let the fill model settle them, 875 made the scan
   settle them at all — and none of it was visible. Meanwhile the closing note
   asserts the engine "produces high volume but low accuracy" without ever
   showing the evidence for it.

   minRr is the tab's OWN ladder, not the helper's default of 2: cryptoultra
   prices T1 at RULE.t1R = 1.5, so the breakeven hit rate this pool has to beat
   is 1/(1+1.5) = 40%, and judging it against a 2R bar would test a plan the
   desk does not place. The panel derives everything else — including its own
   multiple-comparison bar — from the rows it renders.

   The mechanics it tabulates are the versioned vote tiers from pack 872, so
   the table answers the question that instrumentation was for: do this desk's
   own confidence tiers separate?

   READ ITS `INDEP` COLUMN BEFORE ITS `SETTLED` ONE (pack 878). This desk is
   the app's only fully CROSS-SECTIONAL one: it fires on every contract in the
   universe on ONE bar with ONE 24-bar horizon, so every row a scan writes is
   perfectly concurrent with every other, and the independent-observation count
   collapses to roughly (bars scanned / 24) no matter how many contracts fired.
   Measured on that exact shape with hgFwdOverlap: 40 setups a bar for 96 bars
   is n = 3,840 and effN = 4.96 — a day of scanning is about five independent
   observations. The panel used to print the raw count and let hgOmniPoolRead
   compute its standard error over it, which on this desk's shape can read
   "has paid" out of concurrency alone. It now judges READ on INDEP and keeps
   the raw-count verdict visible in brackets. */
var CS_FWD_MIN_RR = 1.5;              /* cryptoultra RULE.t1R */

function csFwdPanelHTML(){
  try{
    if (typeof W.hgFwdPanelHTML !== 'function') return '';
    return W.hgFwdPanelHTML('CRYPTO SCAN', {
      minRr: CS_FWD_MIN_RR,
      title: 'FORWARD — do this desk\'s own confidence tiers separate?'
    }) || '';
  }catch(e){ return ''; }
}

function csPaintFwd(){
  try{
    if (!__ui || !__ui.fwd) return;
    __ui.fwd.innerHTML = csFwdPanelHTML();
  }catch(e){}
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

/* WHAT "470 READS" IS ACTUALLY MADE OF.

   The tab invites you to audit 470 reads by eye, and the one summary number it
   surfaced was the least informative of them. Counted from the engine's own
   output rather than written down (the composition is identical on every tape
   and every symbol, but a hand-kept number is the thing that drifts):

     127  can vote LONG / SHORT / neutral
      30  are regime reads — of which FOUR decide (see csRegimeNote)
      35  are prints: "identical information to X — counted once"
     278  are n/a: "needs UTXO-level on-chain data — never faked"

   278 of 470 is 59% of the table, and no feed in this app can answer any of
   them. That is not a flaw in the engine — every one of those rows says what
   it needs and refuses to fake it, which is the right behaviour — but a
   reader told "470-read vote engine" and nothing else will not guess it. */
function csVoteComposition(votes){
  var out = { total: 0, vote: 0, regime: 0, print: 0, na: 0, regimeCounted: 0, naGroups: 0 };
  if (!Array.isArray(votes)) return out;
  var counted = W.HG_CRYPTO_ULTRA_REGIME_COUNTED, seen = {}, i, v;
  for (i = 0; i < votes.length; i++){
    v = votes[i];
    if (!v) continue;
    out.total++;
    if (v.kind === 'vote') out.vote++;
    else if (v.kind === 'regime'){
      out.regime++;
      if (Array.isArray(counted) && counted.indexOf(v.id) >= 0) out.regimeCounted++;
    }
    else if (v.kind === 'print') out.print++;
    else if (v.kind === 'n/a'){
      out.na++;
      if (v.group && !seen[v.group]){ seen[v.group] = 1; out.naGroups++; }
    }
  }
  return out;
}

function csCompositionNote(c){
  if (!c || !c.total) return '';
  return c.total + ' reads — <b>' + c.vote + '</b> can vote · ' + c.regime + ' regime ('
    + c.regimeCounted + ' of them decide) · ' + c.print
    + ' duplicates counted once · <b>' + c.na + '</b> need a feed this app does not have'
    + (c.naGroups ? ' (' + c.naGroups + ' groups)' : '');
}

/* csRegimeNote — the regime chip on the card head.

   regimeSummaryVote has three outcomes and the engine folded the middle one
   into TREND, so a reading nothing had established printed as a measured one
   on about one scan in five (58 of 300 random tapes; chop 18, trend by a real
   reading 224). It now says UNDECIDED, and the chip says how many of the
   regime reads were consulted to get there. */
function csRegimeNote(s){
  var rc = s && s.regimeCounts;
  if (!rc || !rc.emitted) return '';
  return ' (' + rc.counted + ' of ' + rc.emitted + ' regime reads decide)';
}

function voteTableHTML(votes){
  if (!votes || !votes.length) return '';
  var counted = W.HG_CRYPTO_ULTRA_REGIME_COUNTED;
  var groups = [], h = '';
  /* The card body already prints the same breakdown ("470 reads fed: 127 vote
     · 30 regime · 35 print-only · 278 not applicable") a few lines above, and
     pack 880 put a second copy here. One statement of a fact is enough; the
     per-row counted/not-counted marks below are what this table adds. */
  h += '<table class="cs-vtbl"><tr><th>read</th><th>value</th><th>kind</th><th>vote</th><th>rule</th></tr>';
  for (var i = 0; i < votes.length; i++) if (groups.indexOf(votes[i].group) < 0) groups.push(votes[i].group);
  for (var g = 0; g < groups.length; g++){
    h += '<tr><td class="cs-grp" colspan="5">' + esc(groups[g]) + '</td></tr>';
    for (var k = 0; k < votes.length; k++){
      var v = votes[k]; if (v.group !== groups[g]) continue;
      var vt = v.kind === 'vote' ? (v.vote > 0 ? 'LONG' : v.vote < 0 ? 'SHORT' : 'neutral') : v.kind === 'regime' ? (v.regime < 0 ? 'chop' : v.regime > 0 ? 'trend' : '—') : v.kind === 'n/a' ? 'n/a' : '—';
      /* a regime read that nothing consults looks exactly like one that
         decides, unless it is marked */
      var kindTxt = v.kind;
      if (v.kind === 'regime'){
        kindTxt += (Array.isArray(counted) && counted.indexOf(v.id) >= 0) ? ' · counted' : ' · not counted';
      }
      h += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.read) + '</td><td style="font-weight:700;letter-spacing:.06em;font-size:9px">' + esc(kindTxt) + '</td><td class="cs-v' + (v.kind === 'vote' ? v.vote : 0) + '">' + vt + '</td><td>' + esc(v.why) + '</td></tr>';
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
  var p = s.plan, K = s.count ? s.count.kinds : {};
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
  h += '<span class="cs-card-meta">' + pct(s.pct) + ' agree · ' + (s.count ? s.count.decisive : '—') + ' decisive · regime ' + esc((s.regime || '—').toUpperCase()) + esc(csRegimeNote(s));
  if (p) h += '<br>entry ' + fmt(p.entry) + ' · SL ' + fmt(p.stop) + ' · TP1 ' + fmt(p.t1)
    + (csStopNote(s) ? ' · ' + esc(csStopNote(s)) : '');
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
  /* the placeholder hard-coded 470 and the word "indicator", which reads as
     470 things that indicate. Count the reads this setup actually carries and
     lead with how many of them can vote. */
  var vcomp = csVoteComposition(s.votes);
  h += '<div id="cs_v_' + idx + '" class="cs-votes-placeholder">▸ vote table — '
    + (vcomp.total ? (vcomp.total + ' reads, ' + vcomp.vote + ' of them voting') : 'no reads recorded')
    + ' — loading on expand…</div>';

  h += '</div></div>';
  return h;
}

/* test seam: the card is the thing that claims, so a test about what a card
   says should render one rather than grep for the string it would contain.
   A source scan for the UNCHECKED line survived a mutation that made its
   branch unreachable, because the regex matched the dead body. */
W.__csSetupCardHTML = setupCardHTML;
W.csBlockerTally = csBlockerTally;
/* the gate key -> human label map the footer and the WHY EMPTY panel share,
   exported so a test can assert the note names EVERY gate rather than
   re-spelling five strings that could drift apart from the code */
W.CS_GATE_LABELS = CS_GATE_LABELS;
W.csWhyEmptyHTML = csWhyEmptyHTML;
W.csFooterNote = csFooterNote;
W.csFwdPanelHTML = csFwdPanelHTML;
W.CS_FWD_MIN_RR = CS_FWD_MIN_RR;
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

  h += csFooterNote(setups, hqSetups.length, csBlockerTally(setups), csFwdVerdict());
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

    var setups = [], scanned = 0, errors = 0, skipped = 0, unread = 0, scoreFailed = 0;
    var unreadWhy = {}, scoreWhy = {};
    var now = Date.now();

    /* SETTLE WHAT WE ALREADY RECORDED.

       This tab has written forward records since hg-v735 and has never
       resolved one. hgFwdResolve is keyed by symbol and needs the bars, and no
       desk in the app resolves a crypto symbol at 15m — goldultra resolves
       XAUUSD, everything else runs 4h, and hgFwdSettle will not match a record
       whose timeframe differs. So every row sat open until STALE_HORIZONS
       relabelled it "recorded, then the contract went quiet", which was never
       what happened: the bars existed, this scan fetches them every cycle, and
       nothing looked at them. hg-forward.js says the principle itself — "a
       scan that cannot record looks exactly like a quiet market" — and an
       unsettled log is the same lie one step later.

       Only the symbols that still owe bars are resolved, so the log is loaded
       once rather than once per contract across a universe of hundreds. */
    var owed = {}, owedN = 0, resolved = 0;
    try{
      if (typeof W.hgFwdOpenSyms === 'function'){
        var openList = W.hgFwdOpenSyms('CRYPTO SCAN', '15m') || [];
        for (var oi = 0; oi < openList.length; oi++){ owed[openList[oi]] = 1; owedN++; }
      }
    }catch(eOpen){}
    /* hgDeskFetchKlines resolves to an array whatever went wrong, so a
       network outage and a three-bar contract both arrive as length < 230.
       The result form says which; fall back to the array form if an older
       desk-scan-universe.js is loaded. */
    var fetchRes = W.hgDeskFetchKlinesResult;

    for (var i = 0; i < items.length; i++){
      var item = items[i];
      /* ONE CONTRACT, ONE TICK. scanned++ used to run after the engine call and
         then AGAIN in the catch, so any throw in the ~165 lines of scoring
         below counted the same contract twice. Driven through the real
         runScan with layer 2 rigged to throw on one of three contracts:

           scanned 4 of a 3-contract universe · progress bar 133.3%
           status line "scanned 4/3"

         Reset per iteration; the catch only counts a contract the body never
         reached. */
      var scannedThis = false;
      try{
        var got15 = fetchRes
          ? await fetchRes(item, '15m', KL_15M)
          : { rows: (await fetchKl(item, '15m', KL_15M)) || [], ok: true, reason: null };
        if (!got15.ok){
          unread++; unreadWhy[got15.reason || 'unknown'] = (unreadWhy[got15.reason || 'unknown'] || 0) + 1;
          scannedThis = true; scanned++; setProgress((scanned / items.length) * 100); continue;
        }
        var rows15m = got15.rows;
        /* the bars are in hand and fresh — settle anything still open on this
           symbol before deciding whether it produces a new setup, and do it
           even when it does not, because a record from an earlier scan needs
           bars whether or not the contract fires again */
        if (owedN && owed[item.sym] && rows15m && rows15m.length
            && typeof W.hgFwdResolve === 'function'){
          try{ resolved += (W.hgFwdResolve(item.sym, '15m', rows15m) || 0); }catch(eRes){}
        }
        if (!rows15m || rows15m.length < 230){ skipped++; scannedThis = true; scanned++; setProgress((scanned / items.length) * 100); continue; }
        var rows1h = await fetchKl(item, '1h', KL_1H);

        var res = engine({ rows15m: rows15m, rows1h: rows1h || [], now: now, venueCost: costFor(item), allowUnverified: true });
        scannedThis = true;
        scanned++;
        setProgress((scanned / items.length) * 100);

        /* SCORING GETS ITS OWN BOUNDARY.

           Everything above is about the contract and the feed: whether bars
           arrived, whether there are enough of them. Everything below is OUR
           code scoring a setup -- order flow, sentiment, external risk, the
           three-layer blend, the pro-grade stamp, SMC. A failure there is a
           bug in this app, not a fact about the market, and pack 870 already
           drew that line once for the fetch (unread vs skipped). Folding
           scoring crashes into `errors` alongside network failures said
           nothing about which, and the reader was told a contract errored
           when its bars had in fact been read and its engine had run. */
        try{
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

          /* The same closed bars layer 1 voted on. See csTrimToBar above for
             the lookahead and the clock dependence this removes; the trimmed
             15m tape is reused by the SMC block at the bottom of the loop,
             which has always wanted exactly this. */
          var closed15 = csTrimToBar(rows15m, res.bar ? res.bar.t : null);
          var closed1h = csClosedRows(rows1h || [], 3600, now);

          /* Layer 2: candle-derived order-flow proxies (order-flow.js) */
          var orderFlow = {};
          var orderFlowDir = 'neutral';
          if (typeof hgOrderFlowScore === 'function'){
            orderFlow = hgOrderFlowScore(item.sym, closed15, closed1h);
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
            regimeCounts: res.regimeCounts,
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
             (the engine drops the forming bar via closedRows) so SMC grades the same bar --
             csTrimToBar, which layer 2 now shares. */
          var smcRows = closed15;
          var smcRow = { sym: item.sym, dir: res.dir, entry: res.plan.entry, stop: res.plan.stop, t1: res.plan.t1 };
          try{ if (typeof W.hgSmcEnrich === 'function') W.hgSmcEnrich(smcRow, { rows: smcRows, tab: 'CRYPTO SCAN' }); }catch(eSmc){}
          if (smcRow.smc) setup.smc = smcRow.smc;

          setups.push(setup);
        }
        }catch(eScore){
          scoreFailed++;
          var sk = csScoreFailKey(eScore);
          scoreWhy[sk] = (scoreWhy[sk] || 0) + 1;
        }

        if (scanned % 5 === 0){
          setStat('scanned ' + scanned + '/' + items.length + ' · ' + setups.length + ' setup(s) so far…');
        }
      }catch(e){
        errors++;
        if (!scannedThis){
          scanned++;
          setProgress((scanned / items.length) * 100);
        }
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
                  scoreFailed: scoreFailed, scoreWhy: scoreWhy,
                  owed: owedN, resolved: resolved,
                  offered: +pack.rawLen || 0,
                  droppedTurnover: +pack.droppedTurnover || 0,
                  droppedVenue: +pack.droppedVenue || 0,
                  droppedNoTicker: +pack.droppedNoTicker || 0,
                  minTurnover: +pack.minTurnover || 0 };
    renderCards(setups, __results);
    csPaintFwd();          /* this scan may have settled records; repaint */
    setStat(setups.length + ' setup(s) from ' + scanned + ' scanned · ' + skipped + ' skipped (too few bars) · '
      + unread + ' unread (fetch) · ' + errors + ' errors'
      + (owedN ? ' · ' + resolved + '/' + owedN + ' open records settled' : '')
      + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC', false);
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
      + '<h2 class="cs-hdr">CRYPTO SCAN <span>· all Delta + CoinDCX futures · CRYPTO ULTRA 470-read engine (127 of them vote) · record only</span></h2>'
      + '<div style="margin:8px 0"><button class="btn" id="csRun">SCAN ALL FUTURES</button> <span class="cs-stat" id="csStat">idle — scans every futures contract (Delta + CoinDCX) through the unverified CRYPTO ULTRA engine. Each card carries its full read table with a composition line: how many of the reads can vote, how many are duplicates counted once, and how many need a feed this app does not have. All setups are record only, not for trading.</span></div>'
      + '<div class="cs-bar"><div class="cs-bar-fill" id="csBar" style="width:0%"></div></div>'
      + '<div id="csCards"></div>'
      /* OUTSIDE the cards host, so an empty scan does not hide the one part of
         this tab that is not computed from the window it just fetched */
      + '<div id="csFwd" style="margin-top:14px"></div>'
      + '</div>';
    var cards = el.querySelector('#csCards');
    var stat = el.querySelector('#csStat');
    var btn = el.querySelector('#csRun');
    var bar = el.querySelector('#csBar');
    var fwd = el.querySelector('#csFwd');
    __ui = { cards: cards, stat: stat, btn: btn, bar: bar, fwd: fwd };
    if (btn) btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results && __results.setups) renderCards(__results.setups, __results);
    /* on every mount, whether or not a scan has run in this session — the
       evidence outlives the session and the panel says so when it is empty */
    csPaintFwd();
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
W.__csTrimToBar = csTrimToBar;
W.__csClosedRows = csClosedRows;
W.__csTopBlocker = csTopBlocker;
W.__csVoteComposition = csVoteComposition;
W.__csStopProvenance = csStopProvenance;
W.__csScoreFailKey = csScoreFailKey;
W.__csScoreWhyText = csScoreWhyText;
W.__csStopNote = csStopNote;
W.__csRR = rr;
W.__csCompositionNote = csCompositionNote;
W.__csRegimeNote = csRegimeNote;
W.__csVoteTableHTML = voteTableHTML;
W.__csBlockerSentence = csBlockerSentence;
W.__csAccuracySentence = csAccuracySentence;
W.csFwdVerdict = csFwdVerdict;
W.__csFwdHorizon = csFwdHorizon;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CRYPTO SCAN', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'CRYPTO SCAN', run: async function(){ if (!__ui) return 'unavailable: not mounted'; return runScan(__ui); } });

})();
