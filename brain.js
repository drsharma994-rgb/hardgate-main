/* =========================================================================
HARDGATE — brain.js
BRAIN tab: the meta-intelligence layer. Reads EVERY intelligence layer in
the terminal (news, regime, rotation, on-chain, gate engine, OI flow,
squeeze, liquidations, gold lane) and surfaces only high-probability setups.

Philosophy: gates, not scores — evidence, not signals. There is NO numeric
confluence score anywhere in this file. Conviction is INDEPENDENT LAYERS
AGREEING, each speaking with a human-readable evidence string:

  PRIME = 5+ layers agree, incl. >=1 structural AND >=1 positioning,
          zero vetoes, news clear
  HIGH  = 4 layers agree, zero vetoes
  WATCH = 3 layers agree, or exactly one soft disagreement
  ASIDE = any veto / a tie / contested / thin — with the killing reason

Missing layers never fabricate conviction: every absent/unrun layer is
named in the ledger and CAPS the tier (1-2 dark layers -> cap HIGH,
3+ -> cap WATCH).

Pure core, no DOM, fully vm-testable:
  window.brainCollect(inputs) -> {sym, lane, votes, unavailable, silent}
    inputs  = {sym, lane:'crypto'|'gold', aliases?, news, regime, rotation,
               onchain, engine, oiflow, squeeze, liq, gold}
    vote    = {layer, vote:'long'|'short'|'neutral'|'veto', text,
               kind:'structural'|'positioning'|'context', caution?, strong?}
  window.brainDecide(votes, meta?) -> {tier, dir, agree, disagree,
    longCount, shortCount, vetoes, reasons, hasStructural, hasPositioning,
    newsCaution, cappedFrom}
  window.brainUniverse(xuList, {venue}?) -> pure combined-universe builder:
    {mode:'combined', candidates:[{sym, base, exchange, turnoverUsd, xu,
    alsoOn, aliases}], counts:{total, delta, cdcx}, venue, note}

FULL-COMBINED-UNIVERSE CANDIDATE MODEL (xuniverse.js contract, both
feature-checked; ABSENT -> today's legacy behavior is byte-identical):
  window.xuUniverse(force) -> Promise<[{sym, base, exchange, turnoverUsd,
    mark, fundingPct, alsoOn}]>  — the combined Delta Exchange India +
    CoinDCX futures universe, already deduplicated by base asset and
    liquidity-gated by xuniverse.js (brain never truncates silently:
    every item it receives gets voted).
  window.xuCandles(item, tf, n) -> Promise<rows {t,o,h,l,c,v} ascending>
    — 4h rows for one combined-universe item, routed to its exchange.

Candidate universe (combined mode): BTC/ETH/SOL mapped onto their xu
entries when present (a BTC candidate deduped to the CoinDCX listing
B-BTC_USDT stays ONE candidate and its candles route through CoinDCX)
+ EVERY alt in the xu list (no top-10 cap) + the XAU gold lane
(unchanged). Vote assembly is CPU-cheap, so every candidate is voted on
the non-candle layers. CANDLE-FETCHING is lazy and bounded: 4h rows are
fetched (xuCandles for xu items, else the inline getCandles router, else
binanceKlines) ONLY for candidates reaching WATCH-or-better on the
non-candle layers, highest-evidence first, CHUNK_SIZE 5, per-symbol
catch isolation, 12s per-fetch timeout, capped at FETCH_CAP (40)
fetches/scan — when the cap binds the status line says so honestly
('+37 more watch candidates — raise evidence to fetch'). Plans remain
PRIME/HIGH-only and come from the gate engine / smartSetup /
hgPlanLevels exactly as before — in combined mode smartSetup receives []
for 1h rows (4h-only fetch budget), an input it already tolerates.
Layer states keyed by Binance-style syms ('BTCUSDT') still vote for xu
candidates via alias matching (sym, base+'USDT', base). An xu candidate
whose xuCandles leg fails never silently reroutes to Binance — it gets
no rows and an honest 'levels unavailable'.

Venue filter: ALL/DELTA/CDCX <select> beside RUN SYNTHESIS, persisted in
localStorage 'hgEngineVenue' — the key is SHARED with the EXECUTE engine
(lowercase 'all'/'delta'/'cdcx' on disk; brain normalizes case on read and
writes lowercase back, so one filter choice drives both tabs). The select is
visible only when the combined feed is present. BTC/ETH/SOL are always
scanned; the filter selects which exchange listing feeds their candles (a
base absent from the filtered listings falls back to the legacy candle
route and is shown exchange-less). xuniverse.js emits exchange
'delta'|'coindcx' — candidates normalize to 'delta'|'cdcx' (engine's keys)
while cand.xu always keeps the ORIGINAL item so xuCandles routes on
item.exchange correctly.

MARKET READ header + the run summary gain combined counts:
'universe 412 (delta 187 + cdcx 225) · 8 prime/high · 21 watch'.
Fetch progress: 'X/Y candidates · delta n · cdcx m'.

Layer state contracts consumed (ALL feature-checked; any may be absent):
  window.hgNewsRisk(sym) -> {risk:'low'|'med'|'high', blackout, events, note}
  window.hgNewsState()   -> news cache snapshot (market read only)
  window.regimeState()   -> {label, score, playbook:{bias,size,sizeNote}} | null
  window.rotationState() -> {season:'alt'|'btc'|'mixed', altPct, evidence[]} | null
  window.onchainState()  -> {bias, evidence, flags} | null
  window.engineState()   -> {survivors:[{sym,dir,conviction,plan}],
                             rejected:[{sym,vetoGate}], at} | null
  window.oiflowState()   -> {results:[{sym,dir,evidence,cls}]} | null
  window.squeezeState()  -> {results:[{sym,kind,dir,cls}]} | null
  window.liqAgg()        -> {snapshot()} ; window.liqFlushSetup(snap, rows?)
  window.goldspotState() -> {basisPct, verdict} | null
  window.__hgGoldDeepVerdict -> {label, score, dir, ts}
  window.__hgGoldSetupDecision -> goldSetupDecision output (when the GOLD tab
                             has run; optional, layer degrades honestly)
  plans via window.smartSetup / window.hgPlanLevels only — never invented.

QUICK RESCAN (button beside RUN): re-votes + refetches candles ONLY for
candidates that were WATCH-or-better last scan plus any NEW listings; every
other candidate keeps its prior verdict rendered with an 'AS OF HH:MM' age
stamp. The universe is CACHE-READ ONLY — never an exchange refetch: the xu
cache is consulted only when xuState() proves it fresh (< 15 min), so
xuUniverse(false) is a guaranteed cache hit; stale/absent cache skips
new-listing detection with an honest note. Stat line:
'quick rescan: N checked · M unchanged · Xs'.

SCORECARD HOOK: after every successful scan (full or quick), every PRIME /
HIGH card is reported to window.hgScoreRecord({source:'brain', sym, dir,
tier, entry, stop, t1, t2, layers:[agreeing layer names], at}) — feature-
checked, per-card try-caught, fire-and-forget (promise rejections
swallowed), never blocking render. Plan-less cards record null levels.

SILENT-FIREWALL (the 'click reveals nothing' fix): mount wires the RUN and
QUICK listeners FIRST, in isolation from the deps/venue wiring, and retries
a failed mount itself (3 attempts) — index.html latches HG_MOUNTED before
mount() returns, so a failed mount would otherwise never re-run and the
button would stay silently dead forever. Every failure path (hostile pane,
missing elements, throwing render, hung feed) leaves a VISIBLE honest
message — never a silent empty pane. Every awaited leg carries the 12s
timeout (incl. binanceTickers24h / binanceKlines / getXAUCandles), and a
scan-level watchdog (default 150s) stops launching new work when tripped,
renders partial results with a 'scan timed out' note, and always releases
__busy. window.brainTunables = {fetchMs, scanMs} is the documented vm-test
seam; production never touches it.

Classic script, no build step. Loads after every module it reads; absence of
any module degrades honestly. Registers via
  window.HG_tabs.push({id:'brain', label:'BRAIN', mount, refresh})
refresh(): async, never throws, returns 'refreshed' | 'skipped: not run yet'
| 'busy' | 'error', busy-guarded, and never fires a first-time synthesis
from a global hard refresh.
========================================================================= */(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables ---------------- */
var BASE_SYMS   = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];   /* always in the universe */
var TOP_ALTS    = 10;                                   /* extra alts by 24h turnover (legacy mode) */
var KLINES_4H   = 120;
var KLINES_1H   = 120;
var PLAN_MIN_TIER = 'HIGH';                             /* plans only for PRIME/HIGH cards */
/* fiat/stable + metal perps are not alts for the rotation universe */
var ALT_BLOCK   = { USDCUSDT:1, FDUSDUSDT:1, TUSDUSDT:1, BUSDUSDT:1, USDPUSDT:1,
                    DAIUSDT:1, EURUSDT:1, GBPUSDT:1, XAUUSDT:1, PAXGUSDT:1 };

/* ---- combined-universe tunables (xuniverse.js present) ---- */
var BASES       = ['BTC', 'ETH', 'SOL'];  /* BASE_SYMS as base assets */
var BASE_BLOCK  = { USDC:1, FDUSD:1, TUSD:1, BUSD:1, USDP:1,
                    DAI:1, EUR:1, GBP:1, XAU:1, PAXG:1, /* base-asset mirror of ALT_BLOCK */
                    /* non-crypto contracts Delta India lists as perps — metals,
                       energy, index, FX, agri. Crypto layers can never vote on
                       them, so they would sit 0L/0S ASIDE forever. xuniverse's
                       contract is "never drop, consumers gate" — this is the gate. */
                    XAUT:1, XAG:1, SLVON:1, XPT:1, XPD:1,
                    CL:1, BZ:1, WTI:1, BRENT:1, NATGAS:1, GASOIL:1,
                    SPX:1, NDX:1, DJI:1, US30:1, US100:1, US500:1, US2000:1, NAS100:1,
                    DAX:1, GER40:1, FTSE:1, UK100:1, CAC:1, FRA40:1, EU50:1, STOXX50:1,
                    N225:1, JP225:1, HSI:1, HK50:1, AUS200:1,
                    NIFTY:1, NIFTY50:1, BANKNIFTY:1, BANK:1, FINNIFTY:1, MIDCPNIFTY:1,
                    SENSEX:1, INDIA50:1, VIX:1,
                    DXY:1, EURUSD:1, GBPUSD:1, USDJPY:1, USDINR:1, EURINR:1, GBPINR:1, JPYINR:1,
                    AUDUSD:1, NZDUSD:1, USDCAD:1, USDCHF:1, USDSGD:1, USDZAR:1, USDMXN:1,
                    CORN:1, WHEAT:1, SOY:1, SOYBEAN:1, SUGAR:1, COFFEE:1, COCOA:1, COTTON:1 };
var FETCH_CAP   = 40;      /* max 4h candle fetches per scan — documented, honest when it binds */
var CHUNK_SIZE  = 5;       /* candle fetches in flight per chunk */
var FETCH_MS    = 12000;   /* per-fetch + universe-feed abort timeout */
var SCAN_MS     = 150000;  /* scan-level watchdog — guarantees __busy always releases */
var XU_CACHE_MS = 15 * 60 * 1000; /* mirror of xuniverse.js CACHE_MS (its documented contract) */
/* vm-test seam: suites may shorten timeouts; production never touches this */
var TUN = { fetchMs: FETCH_MS, scanMs: SCAN_MS };
/* the seam is this SAME object by reference — mutating window.brainTunables
   mutates what every withTimeout/watchdog reads */
G.brainTunables = TUN;
var VENUE_KEY   = 'hgEngineVenue';  /* venue filter persistence — SHARED with engine.js
                                       (lowercase 'all'/'delta'/'cdcx' on disk; brain
                                       normalizes case on read, writes lowercase back) */

/* layer kind map — structural vs positioning vs context. PRIME requires at
   least one agreeing structural AND one agreeing positioning vote. */
var LAYER_KIND = {
  engine: 'structural', squeeze: 'structural',
  goldsetup: 'structural', golddeep: 'structural',
  oiflow: 'positioning', liqs: 'positioning', goldbasis: 'positioning',
  news: 'context', regime: 'context', rotation: 'context', onchain: 'context'
};
var TIER_RANK = { ASIDE: 0, WATCH: 1, HIGH: 2, PRIME: 3 };

/* ---------------- formatters: reuse index.html helpers when present ---------------- */
function _fmtFb(n, d){ d = (d === undefined) ? 2 : d; return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
function _pxFb(n){ if (n === null || n === undefined || !isFinite(n)) return '—'; var a = Math.abs(n); var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8; return Number(n).toLocaleString('en-US', { maximumFractionDigits: d }); }
var PX  = (typeof px  === 'function') ? px  : _pxFb;
var FMT = (typeof fmt === 'function') ? fmt : _fmtFb;

function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function __last(a){ return (a && a.length) ? a[a.length - 1] : NaN; }
function isDir(d){ return d === 'long' || d === 'short'; }
function isDirUp(d){ return d === 'LONG' || d === 'SHORT'; }
function errMsg(e){ return (e && e.message) ? e.message : String(e); }

/* =========================================================================
PURE VOTE COLLECTOR — one candidate's raw layer outputs in, votes out.
undefined/null layer input = that layer is dark (getter absent, threw, or
never ran) -> named in `unavailable`, conviction capped downstream.
A layer that is live but has nothing to say about THIS symbol lands in
`silent` (reported honestly, never counted as dark, never fabricated).
========================================================================= */
function brainCollect(inputs){
  var inp = (inputs && typeof inputs === 'object') ? inputs : {};
  var sym  = (typeof inp.sym === 'string') ? inp.sym : '';
  var lane = (inp.lane === 'gold') ? 'gold' : 'crypto';
  var votes = [], unavailable = [], silent = [];

  /* alias matching — layer states keyed by Binance-style syms ('BTCUSDT')
     still vote for combined-universe candidates ('B-BTC_USDT'): a layer row
     matches when its sym is the candidate sym OR one of its aliases
     (base+'USDT', base). No aliases -> exact match only (legacy behavior). */
  var aliasSet = {}; aliasSet[sym] = 1;
  if (Array.isArray(inp.aliases)){
    for (var ai = 0; ai < inp.aliases.length; ai++){
      if (typeof inp.aliases[ai] === 'string' && inp.aliases[ai]) aliasSet[inp.aliases[ai]] = 1;
    }
  }
  function named(s){ return typeof s === 'string' && aliasSet[s] === 1; }

  /* BTC-ness gates rotation neutrality + the on-chain layer. A combined
     candidate's sym is venue-native ('B-BTC_USDT' — prefix check FAILS), so
     test the base asset through the alias set; legacy syms ('BTCUSDT')
     still match the prefix. */
  var isBtc = sym.toUpperCase().indexOf('BTC') === 0
           || aliasSet['BTC'] === 1 || aliasSet['BTCUSDT'] === 1;

  function push(layer, vote, text, extra){
    var v = { layer: layer, vote: vote, text: String(text || ''),
              kind: LAYER_KIND[layer] || 'context' };
    if (extra){ for (var k in extra){ if (Object.prototype.hasOwnProperty.call(extra, k)) v[k] = extra[k]; } }
    votes.push(v);
  }

  /* ---- NEWS (both lanes) — blackout / high-impact = hard veto ---- */
  if (!inp.news || typeof inp.news !== 'object'){ unavailable.push('news'); }
  else{
    var n = inp.news;
    var note = (typeof n.note === 'string' && n.note) ? n.note : '';
    if (n.blackout === true)
      push('news', 'veto', 'NEWS BLACKOUT — ' + (note || 'inside a high-impact event window'));
    else if (n.risk === 'high')
      push('news', 'veto', 'high-impact event risk — ' + (note || 'red event inside the risk window'));
    else if (n.risk === 'med')
      push('news', 'neutral', 'caution: ' + (note || 'medium-impact event approaching'), { caution: true });
    else
      push('news', 'neutral', 'news clear' + (note ? ' — ' + note : ''));
  }

  /* ================= GOLD LANE ================= */
  if (lane === 'gold'){
    var g = (inp.gold && typeof inp.gold === 'object') ? inp.gold : null;
    if (!g){ unavailable.push('goldsetup', 'golddeep', 'goldbasis'); }
    else{
      /* gold setup decision (goldSetupDecision output, stashed when GOLD ran) */
      if (!g.setup || typeof g.setup !== 'object'){ unavailable.push('goldsetup'); }
      else{
        var gs = g.setup;
        if (gs.aside === true || !isDir(gs.dir))
          push('goldsetup', 'neutral', 'GOLD SETUP aside — ' + (gs.reason || 'no composite edge'), { caution: true });
        else
          push('goldsetup', gs.dir,
               'GOLD SETUP ' + gs.dir.toUpperCase() + ' · ' + (gs.confidence || 'n/a') + ' confidence — ' + (gs.reason || ''),
               { strong: gs.confidence === 'STRONG' });
      }
      /* gold deep scan verdict (37-gate ledger) */
      if (!g.deep || typeof g.deep !== 'object'){ unavailable.push('golddeep'); }
      else{
        var gd = g.deep;
        if (isDir(gd.dir))
          push('golddeep', gd.dir,
               'GOLD DEEP ' + gd.dir.toUpperCase() + ' · ' + (gd.label || '')
               + (isFinite(gd.score) ? ' · score ' + Math.round(gd.score) + '%' : ''));
        else
          push('golddeep', 'neutral', 'GOLD DEEP ' + (gd.label || 'mixed') + ' — timeframes disagree, no directional verdict');
      }
      /* goldspot basis — crowding read, fade the crowded side */
      if (!g.basis || typeof g.basis !== 'object'){ unavailable.push('goldbasis'); }
      else{
        var bs = g.basis;
        var bTxt = 'perp basis ' + (isFinite(bs.basisPct) ? (bs.basisPct >= 0 ? '+' : '') + FMT(bs.basisPct, 3) + '%' : 'n/a');
        if (bs.verdict === 'longs-crowding')
          push('goldbasis', 'short', bTxt + ' — leveraged longs crowding, squeeze-down risk');
        else if (bs.verdict === 'shorts-crowding')
          push('goldbasis', 'long', bTxt + ' — leveraged shorts crowding, squeeze-up risk');
        else
          push('goldbasis', 'neutral', bTxt + ' — positioning balanced');
      }
    }
    return { sym: sym, lane: lane, votes: votes, unavailable: unavailable, silent: silent };
  }

  /* ================= CRYPTO LANE ================= */

  /* ---- REGIME playbook ---- */
  if (!inp.regime || typeof inp.regime !== 'object'){ unavailable.push('regime'); }
  else{
    var rg = inp.regime, pb = (rg.playbook && typeof rg.playbook === 'object') ? rg.playbook : {};
    var rl = (typeof rg.label === 'string' && rg.label) ? rg.label : 'regime';
    var sc = isFinite(rg.score) ? ' (' + (rg.score > 0 ? '+' : '') + rg.score + ')' : '';
    var sz = (typeof pb.sizeNote === 'string' && pb.sizeNote) ? pb.sizeNote
           : ((typeof pb.size === 'string' && pb.size) ? 'size ' + pb.size : '');
    /* playbook.bias comes as 'LONG-ONLY'/'SHORT-ONLY'/'BOTH'/'STAND-ASIDE'
       from regime.js (raw 'long'/'short' also accepted per contract) */
    var rb = (typeof pb.bias === 'string') ? pb.bias.toUpperCase() : '';
    if (rb === 'LONG' || rb === 'LONG-ONLY')  push('regime', 'long',  rl + sc + ' — playbook: longs' + (sz ? ' · ' + sz : ''));
    else if (rb === 'SHORT' || rb === 'SHORT-ONLY') push('regime', 'short', rl + sc + ' — playbook: shorts' + (sz ? ' · ' + sz : ''));
    else push('regime', 'neutral', rl + sc + ' — playbook has no directional edge' + (sz ? ' · ' + sz : ''));
  }

  /* ---- ROTATION season ---- */
  if (!inp.rotation || typeof inp.rotation !== 'object'){ unavailable.push('rotation'); }
  else{
    var ro = inp.rotation;
    var ap = isFinite(ro.altPct) ? Math.round(ro.altPct) + '%' : 'n/a';
    if (ro.season === 'alt'){
      if (isBtc) push('rotation', 'neutral', 'alt season (' + ap + ') — capital rotating to alts, BTC the relative laggard');
      else       push('rotation', 'long', 'alt season (' + ap + ') — alts favored');
    }else if (ro.season === 'btc'){
      if (isBtc) push('rotation', 'long', 'BTC season (' + ap + ') — BTC leading the tape');
      else       push('rotation', 'neutral', 'BTC season (' + ap + ') — alts out of favor');
    }else{
      push('rotation', 'neutral', 'mixed rotation (' + ap + ') — no season edge');
    }
  }

  /* ---- ON-CHAIN (BTC lane only — alts simply skip this layer) ---- */
  if (isBtc){
    if (!inp.onchain || typeof inp.onchain !== 'object'){ unavailable.push('onchain'); }
    else{
      var oc = inp.onchain;
      var ocEv = '';
      if (Array.isArray(oc.evidence) && oc.evidence.length){
        var e0 = oc.evidence[0];
        ocEv = (typeof e0 === 'string') ? e0 : ((e0 && typeof e0.text === 'string') ? e0.text : '');
      }
      if (oc.bias === 'bullish')     push('onchain', 'long',  'on-chain bullish' + (ocEv ? ' — ' + ocEv : ''));
      else if (oc.bias === 'bearish') push('onchain', 'short', 'on-chain bearish' + (ocEv ? ' — ' + ocEv : ''));
      else push('onchain', 'neutral', 'on-chain neutral' + (ocEv ? ' — ' + ocEv : ''));
    }
  }

  /* ---- GATE ENGINE — survivor = strong vote, rejection = veto w/ gate ---- */
  if (!inp.engine || typeof inp.engine !== 'object'){ unavailable.push('engine'); }
  else{
    var en = inp.engine, enHit = false, ei;
    var surv = Array.isArray(en.survivors) ? en.survivors : [];
    for (ei = 0; ei < surv.length; ei++){
      var sv = surv[ei];
      if (sv && named(sv.sym) && isDir(sv.dir)){
        push('engine', sv.dir,
             'ENGINE SURVIVOR · ' + (sv.conviction || 'n/a') + ' conviction'
             + (sv.plan ? ' · plan ready' : ' · no plan'),
             { strong: true });
        enHit = true; break;
      }
    }
    if (!enHit){
      var rej = Array.isArray(en.rejected) ? en.rejected : [];
      for (ei = 0; ei < rej.length; ei++){
        var rj = rej[ei];
        if (rj && named(rj.sym)){
          push('engine', 'veto', 'engine veto' + (rj.vetoGate ? ' @ ' + rj.vetoGate : ''));
          enHit = true; break;
        }
      }
    }
    if (!enHit) silent.push('engine');   /* engine ran, this symbol not gated */
  }

  /* ---- OI FLOW / SMART classification ---- */
  if (!inp.oiflow || typeof inp.oiflow !== 'object'){ unavailable.push('oiflow'); }
  else{
    var ofRes = Array.isArray(inp.oiflow.results) ? inp.oiflow.results : [], ofHit = false;
    for (var oi = 0; oi < ofRes.length; oi++){
      var or = ofRes[oi];
      if (or && named(or.sym) && isDirUp(or.dir)){
        /* oiflowState rows: evidence = score (number), cls = regime/lead string;
           a raw {evidence:[strings]} shape is also accepted */
        var oEv = '';
        if (Array.isArray(or.evidence) && or.evidence.length) oEv = String(or.evidence[0]);
        else if (typeof or.cls === 'string' && or.cls) oEv = or.cls;
        var oScore = (typeof or.evidence === 'number' && isFinite(or.evidence)) ? ' · ' + or.evidence + ' reads' : '';
        push('oiflow', or.dir.toLowerCase(), 'OI FLOW ' + or.dir + (oEv ? ' — ' + oEv : '') + oScore);
        ofHit = true; break;
      }
    }
    if (!ofHit) silent.push('oiflow');
  }

  /* ---- SQUEEZE ---- */
  if (!inp.squeeze || typeof inp.squeeze !== 'object'){ unavailable.push('squeeze'); }
  else{
    var sqRes = Array.isArray(inp.squeeze.results) ? inp.squeeze.results : [], sqHit = false;
    for (var si = 0; si < sqRes.length; si++){
      var sr = sqRes[si];
      if (sr && named(sr.sym)){
        sqHit = true;
        if (isDir(sr.dir) && sr.kind === 'fired')
          push('squeeze', sr.dir, 'SQUEEZE fired ' + sr.dir.toUpperCase() + ' — compression released');
        else if (isDir(sr.dir) && sr.kind === 'break')
          push('squeeze', sr.dir, 'Donchian break ' + sr.dir.toUpperCase() + ' — momentum continuation');
        else
          push('squeeze', 'neutral', 'squeeze building — compression without a fire yet');
        break;
      }
    }
    if (!sqHit) silent.push('squeeze');
  }

  /* ---- LIQS flush-reversal (one market-wide setup; must name this symbol) ---- */
  if (inp.liq === undefined || inp.liq === null){ silent.push('liqs'); if (inp.liq === undefined) unavailable.push('liqs'); }
  else if (typeof inp.liq === 'object'){
    var lf = inp.liq;
    if (isDir(lf.dir) && (!lf.sym || named(lf.sym)))
      push('liqs', lf.dir,
           'LIQS flush-reversal — ' + (lf.flushSide || '?') + ' flush'
           + (isFinite(lf.flushUsd) ? ' $' + FMT(lf.flushUsd / 1e6, 1) + 'M' : '')
           + ' · fade to ' + lf.dir.toUpperCase());
    else silent.push('liqs');
  }
  else silent.push('liqs');

  return { sym: sym, lane: lane, votes: votes, unavailable: unavailable, silent: silent };
}

/* =========================================================================
PURE TIER DECIDER — evidence agreement only, never a fabricated score.
========================================================================= */
function brainDecide(votes, meta){
  votes = Array.isArray(votes) ? votes : [];
  meta = (meta && typeof meta === 'object') ? meta : {};
  var unavailable = Array.isArray(meta.unavailable) ? meta.unavailable : [];

  var vetoes = [], longs = [], shorts = [], newsCaution = null;
  for (var i = 0; i < votes.length; i++){
    var v = votes[i];
    if (!v) continue;
    if (v.vote === 'veto') vetoes.push(v);
    else if (v.vote === 'long') longs.push(v);
    else if (v.vote === 'short') shorts.push(v);
    if (v.caution === true && v.layer === 'news' && !newsCaution) newsCaution = v;
  }

  var out = { tier: 'ASIDE', dir: null, agree: 0, disagree: 0,
              longCount: longs.length, shortCount: shorts.length,
              vetoes: vetoes, reasons: [], hasStructural: false, hasPositioning: false,
              newsCaution: !!newsCaution, cappedFrom: null };

  /* veto overrides everything — the killing reason is the product */
  if (vetoes.length){
    out.reasons.push('VETO — ' + vetoes[0].text
      + (vetoes.length > 1 ? ' (+' + (vetoes.length - 1) + ' more veto)' : ''));
    if (unavailable.length) out.reasons.push('dark layers: ' + unavailable.join(', '));
    return out;
  }

  if (!longs.length && !shorts.length){
    out.reasons.push('no directional evidence — every layer is neutral, silent or dark');
    if (unavailable.length) out.reasons.push('dark layers: ' + unavailable.join(', '));
    return out;
  }
  if (longs.length === shorts.length){
    out.reasons.push('tie: ' + longs.length + ' long vs ' + shorts.length + ' short — layers disagree, no edge');
    if (unavailable.length) out.reasons.push('dark layers: ' + unavailable.join(', '));
    return out;
  }

  var dir = longs.length > shorts.length ? 'long' : 'short';
  var agree = Math.max(longs.length, shorts.length);
  var disagree = Math.min(longs.length, shorts.length);
  var agreeing = dir === 'long' ? longs : shorts;
  var hasStruct = false, hasPos = false;
  for (var a = 0; a < agreeing.length; a++){
    if (agreeing[a].kind === 'structural') hasStruct = true;
    if (agreeing[a].kind === 'positioning') hasPos = true;
  }
  out.dir = dir; out.agree = agree; out.disagree = disagree;
  out.hasStructural = hasStruct; out.hasPositioning = hasPos;

  var tier, why;
  if (disagree >= 2){
    tier = 'ASIDE';
    why = 'contested: ' + agree + ' ' + dir.toUpperCase() + ' vs ' + disagree
      + ' against — layers fight each other, stand aside';
  }else if (agree >= 5 && disagree === 0 && hasStruct && hasPos && !newsCaution){
    tier = 'PRIME';
    why = agree + ' layers agree ' + dir.toUpperCase()
      + ' · structural + positioning present · zero vetoes · news clear';
  }else if (agree >= 5 && disagree === 0 && hasStruct && hasPos && newsCaution){
    tier = 'HIGH';
    why = agree + ' layers agree ' + dir.toUpperCase()
      + ' but news caution — ' + newsCaution.text;
  }else if (agree >= 5 && disagree === 0){
    tier = 'HIGH';
    why = agree + ' layers agree ' + dir.toUpperCase() + ' but no agreeing '
      + (!hasStruct ? 'structural' : 'positioning') + ' layer — capped at HIGH';
  }else if (agree >= 4 && disagree === 0){
    tier = 'HIGH';
    why = agree + ' layers agree ' + dir.toUpperCase() + ' · zero vetoes';
  }else if (agree >= 3){
    tier = 'WATCH';
    why = (disagree === 1)
      ? agree + ' layers agree ' + dir.toUpperCase() + ' but one soft disagreement — watch, do not chase'
      : agree + ' layers agree ' + dir.toUpperCase() + ' — one short of HIGH';
  }else if (agree === 2 && disagree === 0){
    /* radar tier — two independent layers agree and NOTHING fights it. Across
       a 500+ contract universe the strict 3-vote bar reads as a wall of ASIDE
       in quiet regimes; the desk answer is a thin-but-honest radar list whose
       reason names exactly why it is not conviction yet. disagree===1 stays
       ASIDE (contested-lite), PRIME/HIGH bars unchanged. */
    tier = 'WATCH';
    why = '2 layers agree ' + dir.toUpperCase()
        + ' — radar only: thin but uncontested, one more agreeing layer builds conviction';
  }else{
    tier = 'ASIDE';
    why = 'thin evidence — only ' + agree + ' layer' + (agree === 1 ? '' : 's') + ' point ' + dir.toUpperCase();
  }

  /* degradation cap — dark layers cap conviction, honestly */
  var cap = unavailable.length >= 3 ? 'WATCH' : (unavailable.length >= 1 ? 'HIGH' : null);
  if (cap && TIER_RANK[tier] > TIER_RANK[cap]){
    out.cappedFrom = tier;
    why += ' · CAPPED from ' + tier + ': ' + unavailable.length
      + ' layer' + (unavailable.length === 1 ? '' : 's') + ' unavailable (' + unavailable.join(', ') + ')';
    tier = cap;
  }
  out.tier = tier;
  out.reasons.push(why);
  if (unavailable.length) out.reasons.push('dark layers: ' + unavailable.join(', '));
  return out;
}

/* =========================================================================
Impure layer snapshot — every getter feature-checked, every call try-caught.
Returns plain data for brainCollect inputs + the market read. Never throws.
========================================================================= */
function snapshotLayers(){
  var o = { regime: undefined, rotation: undefined, onchain: undefined,
            engine: undefined, oiflow: undefined, squeeze: undefined,
            liqSnap: undefined, liqSetup: undefined,
            goldDeep: undefined, goldSetup: undefined, goldBasis: undefined,
            newsState: undefined, fng: null };
  function grab(key){ return function(){ return (typeof G[key] === 'function') ? G[key]() : undefined; }; }
  var getters = { regime: 'regimeState', rotation: 'rotationState', onchain: 'onchainState',
                  engine: 'engineState', oiflow: 'oiflowState', squeeze: 'squeezeState',
                  goldBasis: 'goldspotState', newsState: 'hgNewsState' };
  for (var k in getters){
    if (!Object.prototype.hasOwnProperty.call(getters, k)) continue;
    try{ o[k] = grab(getters[k])(); }catch(e){ o[k] = undefined; }
  }
  /* legacy on-chain shape tolerance: {snap} cache -> derive the signal */
  try{
    if (o.onchain && typeof o.onchain === 'object' && o.onchain.bias === undefined
        && o.onchain.snap && typeof G.onchainSignal === 'function'){
      o.onchain = G.onchainSignal(o.onchain.snap);
    }
  }catch(e){ o.onchain = undefined; }
  /* liqs: fresh snapshot from the exported aggregator factory; a flush setup
     only exists when the window imbalance classifies as a flush */
  try{
    if (typeof G.liqAgg === 'function'){
      var agg = G.liqAgg();
      if (agg && typeof agg.snapshot === 'function'){
        o.liqSnap = agg.snapshot();
        var cls = o.liqSnap && o.liqSnap.imbalance && o.liqSnap.imbalance.cls;
        if ((cls === 'long-flush' || cls === 'short-flush') && typeof G.liqFlushSetup === 'function')
          o.liqSetup = G.liqFlushSetup(o.liqSnap, null) || null;
        else o.liqSetup = null;
      }
    }
  }catch(e){ o.liqSnap = undefined; o.liqSetup = undefined; }
  /* gold lane verdicts stashed by the GOLD tab (both optional) */
  try{ o.goldDeep = G.__hgGoldDeepVerdict || undefined; }catch(e){ o.goldDeep = undefined; }
  try{ o.goldSetup = G.__hgGoldSetupDecision || undefined; }catch(e){ o.goldSetup = undefined; }
  /* fear & greed from the inline app state (const S — lexical global, not window.S) */
  try{ if (typeof S !== 'undefined' && S && S.fng) o.fng = S.fng; }catch(e){ o.fng = null; }
  return o;
}

function newsFor(sym){
  try{
    if (typeof G.hgNewsRisk !== 'function') return undefined;
    var r = G.hgNewsRisk(sym);
    return (r && typeof r === 'object') ? r : undefined;
  }catch(e){ return undefined; }
}

/* ---------------- candidates + candidate universe ---------------- */
function legacyCand(sym){
  return { sym: sym, base: String(sym).replace(/USDT$/, ''), exchange: null,
           turnoverUsd: null, xu: null, alsoOn: null, aliases: [sym] };
}
function candOf(c){ return (typeof c === 'string') ? legacyCand(c) : c; }

/* =========================================================================
PURE COMBINED-UNIVERSE BUILDER — xuniverse.js list in, candidates out.
xuList items: {sym, base, exchange:'delta'|'cdcx', turnoverUsd, mark,
fundingPct, alsoOn}. Defensively deduped by base (highest turnover kept),
BTC/ETH/SOL mapped onto their entries first, every other non-blocked base
appended by turnover — NO top-N cap, nothing silently dropped.
========================================================================= */
function brainUniverse(xuList, opts){
  opts = (opts && typeof opts === 'object') ? opts : {};
  var venue = normVenue(opts.venue);
  var items = [];
  if (Array.isArray(xuList)){
    for (var i = 0; i < xuList.length; i++){
      var it = xuList[i];
      if (!it || typeof it !== 'object') continue;
          var sym = (typeof it.sym === 'string') ? it.sym : '';
      var base = (typeof it.base === 'string') ? it.base.toUpperCase() : '';
      /* xuniverse.js emits 'delta'|'coindcx'; normalize to engine's keys
         ('delta'|'cdcx'). cand.xu keeps the ORIGINAL item — xuCandles routes
         on item.exchange ('coindcx'), never hand it the normalized key. */
      var exRaw = (typeof it.exchange === 'string') ? it.exchange.toLowerCase() : '';
      var ex = (exRaw === 'delta') ? 'delta' : ((exRaw === 'coindcx' || exRaw === 'cdcx') ? 'cdcx' : '');
      if (!sym || !base || !ex) continue;
      items.push({ sym: sym, base: base, exchange: ex,
                   turnoverUsd: (typeof it.turnoverUsd === 'number' && isFinite(it.turnoverUsd)) ? it.turnoverUsd : null,
                   alsoOn: (it.alsoOn === undefined ? null : it.alsoOn), xu: it });
    }
  }
  if (venue !== 'ALL')
    items = items.filter(function(it){ return it.exchange === venue.toLowerCase(); });
  /* dedupe by base — highest turnover wins (xu promises deduped; belt+braces) */
  items.sort(function(a, b){
    return ((b.turnoverUsd === null ? -1 : b.turnoverUsd) - (a.turnoverUsd === null ? -1 : a.turnoverUsd));
  });
  var byBase = {}, order = [];
  for (var d = 0; d < items.length; d++){
    if (!byBase[items[d].base]){ byBase[items[d].base] = items[d]; order.push(items[d].base); }
  }
  function xuCand(it){
    var aliases = [], seen = {};
    var cand = { sym: it.sym, base: it.base, exchange: it.exchange,
                 turnoverUsd: it.turnoverUsd, xu: it.xu, alsoOn: it.alsoOn, aliases: aliases };
    var raw = [it.sym, it.base + 'USDT', it.base];
    for (var a = 0; a < raw.length; a++){
      if (raw[a] && !seen[raw[a]]){ seen[raw[a]] = 1; aliases.push(raw[a]); }
    }
    return cand;
  }
  /* BTC/ETH/SOL first — mapped onto their combined-universe entry when
     present (candles route via xuCandles), else a legacy-route candidate */
  var candidates = [];
  for (var b = 0; b < BASES.length; b++){
    if (byBase[BASES[b]]){ candidates.push(xuCand(byBase[BASES[b]])); delete byBase[BASES[b]]; }
    else candidates.push(legacyCand(BASES[b] + 'USDT'));
  }
  /* EVERY remaining non-blocked base — no cap */
  for (var k = 0; k < order.length; k++){
    var bb = order[k];
    if (!byBase[bb] || BASE_BLOCK[bb]) continue;
    candidates.push(xuCand(byBase[bb]));
  }
  var nDelta = 0, nCdcx = 0;
  for (var c = 0; c < candidates.length; c++){
    if (candidates[c].exchange === 'delta') nDelta++;
    else if (candidates[c].exchange === 'cdcx') nCdcx++;
  }
  return { mode: 'combined', candidates: candidates,
           counts: { total: candidates.length, delta: nDelta, cdcx: nCdcx },
           venue: venue,
           note: 'BTC/ETH/SOL + ' + Math.max(0, candidates.length - BASES.length)
               + ' combined alts (delta ' + nDelta + ' + cdcx ' + nCdcx + ') + XAU gold lane' };
}

/* ---------------- venue filter (persisted) ---------------- */
function normVenue(v){
  v = String(v === null || v === undefined ? '' : v).toUpperCase();
  return (v === 'DELTA' || v === 'CDCX') ? v : 'ALL';
}
function lsGet(k){
  try{
    var L = (typeof localStorage !== 'undefined') ? localStorage : (G && G.localStorage);
    if (L && typeof L.getItem === 'function') return L.getItem(k);
  }catch(e){}
  return null;
}
function lsSet(k, v){
  try{
    var L = (typeof localStorage !== 'undefined') ? localStorage : (G && G.localStorage);
    if (L && typeof L.setItem === 'function') L.setItem(k, v);
  }catch(e){}
}
var __venue = null;  /* module-local cache; localStorage is the source of truth across loads */
function getVenue(){ if (__venue) return __venue; __venue = normVenue(lsGet(VENUE_KEY)); return __venue; }
function setVenue(v){
  __venue = normVenue(v);
  /* persist in engine.js's lowercase format so both tabs share one filter */
  lsSet(VENUE_KEY, __venue.toLowerCase());
}

/* ---------------- promise timeout (12s, never rejects) ---------------- */
function withTimeout(p, ms){
  ms = (typeof ms === 'number' && ms > 0) ? ms : TUN.fetchMs;
  return new Promise(function(resolve){
    var done = false;
    var timer = setTimeout(function(){ if (!done){ done = true; resolve(null); } }, ms);
    Promise.resolve(p).then(
      function(v){ if (!done){ done = true; clearTimeout(timer); resolve(v); } },
      function(){ if (!done){ done = true; clearTimeout(timer); resolve(null); } });
  });
}

/* legacy universe — today's behavior, byte-identical when xuniverse.js is absent */
async function legacyUniverse(){
  var out = { mode: 'legacy', candidates: BASE_SYMS.map(legacyCand), ticks: null,
              counts: null, venue: 'ALL', xuNote: null,
              note: 'BTC/ETH/SOL only — Binance turnover feed unavailable, top-10 alts skipped' };
  try{
    if (typeof G.binanceTickers24h !== 'function') return out;
    var ticks = await withTimeout(G.binanceTickers24h(), TUN.fetchMs); /* hung feed degrades, never parks the scan */
    if (!ticks || typeof ticks !== 'object') return out;
    var base = {}; for (var b = 0; b < BASE_SYMS.length; b++) base[BASE_SYMS[b]] = 1;
    var arr = [];
    for (var k in ticks){
      if (!Object.prototype.hasOwnProperty.call(ticks, k)) continue;
      var t = ticks[k];
      var sym = (t && typeof t.symbol === 'string') ? t.symbol : k;
      if (base[sym] || ALT_BLOCK[sym]) continue;
      if (!/USDT$/.test(sym)) continue;
      if (!t || !isFinite(t.turnoverUsd)) continue;
      arr.push({ sym: sym, turnoverUsd: t.turnoverUsd });
    }
    arr.sort(function(a, b){ return b.turnoverUsd - a.turnoverUsd; });
    var alts = arr.slice(0, TOP_ALTS).map(function(x){ return x.sym; });
    out.candidates = BASE_SYMS.concat(alts).map(legacyCand);
    out.ticks = ticks;
    out.note = alts.length
      ? 'BTC/ETH/SOL + top-' + alts.length + ' alts by 24h turnover + XAU gold lane'
      : 'BTC/ETH/SOL only — no alt turnover data';
    return out;
  }catch(e){ return out; }
}

async function buildUniverse(){
  if (typeof G.xuUniverse === 'function'){
    var failed = false, list = null;
    try{ list = await withTimeout(G.xuUniverse(false), TUN.fetchMs); }
    catch(e){ failed = true; }
    if (Array.isArray(list) && list.length) return brainUniverse(list, { venue: getVenue() });
    /* feed present but failed/empty — honest legacy fallback, noted on the stat line */
    var leg = await legacyUniverse();
    leg.xuNote = 'combined universe feed ' + (failed ? 'failed' : 'empty') + ' — legacy Binance fallback';
    return leg;
  }
  return legacyUniverse();
}

/* 4h rows for one candidate — xuCandles for xu items, else the inline
   getCandles router, else binanceKlines. Never throws; null on failure.
   An xu candidate whose xu leg fails never silently reroutes to Binance. */
async function fetch4h(cand){
  try{
    if (cand.xu){
      if (typeof G.xuCandles === 'function'){
        var rx = await withTimeout(G.xuCandles(cand.xu, '4h', KLINES_4H));
        if (rx && rx.length) return rx;
      }
      return null;
    }
    if (typeof G.getCandles === 'function'){
      var rg = await withTimeout(G.getCandles(cand.sym, '4h', KLINES_4H));
      if (rg && rg.length) return rg;
    }
    if (typeof G.binanceKlines === 'function'){
      var rb = await withTimeout(G.binanceKlines(cand.sym, '4h', KLINES_4H));
      if (rb && rb.length) return rb;
    }
  }catch(e){}
  return null;
}

/* bounded lazy 4h fetching for a WATCH-or-better row set: tier/evidence
   order, CHUNK_SIZE in flight, per-symbol catch isolation, FETCH_CAP/scan,
   and a scan-level watchdog (TUN.scanMs) that stops LAUNCHING new work when
   tripped — partial coverage is reported honestly, never silently. */
async function fetchCandleQueue(rows, uni, stat, t0){
  var out = { capNote: '', watchNote: '', fetched: 0, total: 0, timedOut: false };
  var queue = [];
  for (var qi = 0; qi < rows.length; qi++){
    if (rows[qi].lane === 'crypto') queue.push(rows[qi]);
  }
  queue.sort(function(a, b){
    return (TIER_RANK[b.dec.tier] - TIER_RANK[a.dec.tier])
        || (b.dec.agree - a.dec.agree)
        || ((b.turnoverUsd || 0) - (a.turnoverUsd || 0))
        || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0);
  });
  var overflow = [];
  if (queue.length > FETCH_CAP){ overflow = queue.slice(FETCH_CAP); queue = queue.slice(0, FETCH_CAP); }
  var settle = (typeof Promise.allSettled === 'function')
    ? function(ps){ return Promise.allSettled(ps); }
    : function(ps){ return Promise.all(ps.map(function(p){
        return p.then(function(v){ return { status: 'fulfilled', value: v }; },
                      function(e){ return { status: 'rejected', reason: e }; });
      })); };
  for (var fi = 0; fi < queue.length; fi += CHUNK_SIZE){
    if (Date.now() - t0 > TUN.scanMs){ out.timedOut = true; break; } /* watchdog: stop launching */
    var chunk = queue.slice(fi, fi + CHUNK_SIZE);
    try{ stat.textContent = fi + '/' + queue.length + ' candidates · delta '
      + uni.counts.delta + ' · cdcx ' + uni.counts.cdcx; }catch(e){}
    await settle(chunk.map(function(crow){
      return fetch4h(crow).then(function(r4){ crow.rows4h = r4; },
                                function(){ crow.rows4h = null; });
    }));
    out.fetched += chunk.length;
  }
  out.total = queue.length;
  if (out.timedOut)
    out.watchNote = ' · scan timed out — partial candle coverage (' + out.fetched + '/' + queue.length + ')';
  if (overflow.length){
    var allWatch = true;
    for (var ow = 0; ow < overflow.length; ow++){
      if (overflow[ow].dec.tier !== 'WATCH'){ allWatch = false; break; }
    }
    out.capNote = allWatch
      ? ' · +' + overflow.length + ' more watch candidates — raise evidence to fetch'
      : ' · +' + overflow.length + ' more candidates unfetched (fetch cap ' + FETCH_CAP + ')';
  }
  return out;
}

/* ---------------- collect + decide for one candidate ---------------- */
function judgeCrypto(cand, snap){
  cand = candOf(cand);
  var col = brainCollect({
    sym: cand.sym, aliases: cand.aliases, lane: 'crypto',
    news: newsFor(cand.sym),
    regime: snap.regime, rotation: snap.rotation, onchain: snap.onchain,
    engine: snap.engine, oiflow: snap.oiflow, squeeze: snap.squeeze,
    liq: (snap.liqSetup === undefined ? undefined : snap.liqSetup)
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  return { sym: cand.sym, base: cand.base, exchange: cand.exchange,
           turnoverUsd: cand.turnoverUsd, xu: cand.xu, alsoOn: cand.alsoOn,
           aliases: cand.aliases, lane: 'crypto', col: col, dec: dec };
}

function judgeGold(snap){
  var col = brainCollect({
    sym: 'XAU', lane: 'gold',
    news: newsFor('XAUUSDT'),
    gold: { setup: snap.goldSetup, deep: snap.goldDeep, basis: snap.goldBasis }
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  return { sym: 'XAU', base: 'XAU', exchange: null, turnoverUsd: null,
           xu: null, alsoOn: null, aliases: ['XAU', 'XAUUSDT'], lane: 'gold', col: col, dec: dec };
}

/* ---------------- plans — smartSetup / hgPlanLevels ONLY, never invented ---------------- */
function normalizePlan(p, src, note){
  if (!p || !isDir(p.dir)) return null;
  var e = +p.entry, s = +p.stop, t1 = +p.t1, t2 = +p.t2;
  if (!isFinite(e) || !isFinite(s) || !isFinite(t1)) return null;
  if (Math.abs(e - s) <= 0) return null;
  return { dir: p.dir, entry: e, stop: s, t1: t1, t2: (isFinite(t2) ? t2 : null),
           rr1: isFinite(p.rr1) ? p.rr1 : Math.abs(t1 - e) / Math.abs(e - s),
           rr2: isFinite(p.rr2) ? p.rr2 : (isFinite(t2) ? Math.abs(t2 - e) / Math.abs(e - s) : null),
           riskPct: isFinite(p.riskPct) ? p.riskPct : Math.abs(e - s) / e * 100,
           confirmed: p.confirmed === true, type: p.type || null,
           note: ((p.note || '') + (note ? (p.note ? ' · ' : '') + note : '')) || '',
           src: src };
}

function enginePlanFor(row, snap){
  try{
    var en = snap.engine;
    if (!en || !Array.isArray(en.survivors)) return null;
    var aliasSet = {}; aliasSet[row.sym] = 1;
    if (Array.isArray(row.aliases)){
      for (var a = 0; a < row.aliases.length; a++){
        if (typeof row.aliases[a] === 'string' && row.aliases[a]) aliasSet[row.aliases[a]] = 1;
      }
    }
    for (var i = 0; i < en.survivors.length; i++){
      var sv = en.survivors[i];
      /* engineState survivor plan is {entry,stop,t1,t2} — dir lives on the
         survivor record, so inject it before normalizing */
      if (sv && aliasSet[sv.sym] === 1 && sv.plan){
        var p = {}, k;
        for (k in sv.plan){ if (Object.prototype.hasOwnProperty.call(sv.plan, k)) p[k] = sv.plan[k]; }
        if (!isDir(p.dir)) p.dir = sv.dir;
        return normalizePlan(p, 'gate engine');
      }
    }
  }catch(e){}
  return null;
}

async function klineRows(sym){
  var out = { rows4h: null, rows1h: null };
  if (typeof G.binanceKlines !== 'function') return out;
  try{ var r4 = await withTimeout(G.binanceKlines(sym, '4h', KLINES_4H), TUN.fetchMs); out.rows4h = (r4 && r4.length) ? r4 : null; }catch(e){}
  try{ var r1 = await withTimeout(G.binanceKlines(sym, '1h', KLINES_1H), TUN.fetchMs); out.rows1h = (r1 && r1.length) ? r1 : null; }catch(e){}
  return out;
}

/* plan for a crypto PRIME/HIGH card: engine survivor plan -> smartSetup ->
   hgPlanLevels -> honest 'levels unavailable'. */
async function cryptoPlan(row, snap){
  var ep = enginePlanFor(row, snap);
  if (ep) return { plan: ep, rows: null };
  var kl = await klineRows(row.sym);
  var rows = kl.rows4h || kl.rows1h;
  if (!rows) return { plan: null, rows: null };
  if (typeof G.smartSetup === 'function' && kl.rows4h && kl.rows4h.length >= 60){
    try{
      var agreeing = row.col.votes.filter(function(v){ return v.vote === row.dec.dir; });
      var contra   = row.col.votes.filter(function(v){ return v.vote === (row.dec.dir === 'long' ? 'short' : 'long'); });
      var cls = { dir: row.dec.dir,
                  longEv: row.dec.dir === 'long' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  shortEv: row.dec.dir === 'short' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  score: row.dec.agree, total: row.dec.agree + row.dec.disagree, regime: [] };
      var sp = G.smartSetup(cls, kl.rows4h, kl.rows1h || []);
      var np = normalizePlan(sp, sp && sp.type ? 'smartSetup ' + sp.type : 'smartSetup');
      if (np) return { plan: np, rows: kl.rows4h };
    }catch(e){ /* fall through to hgPlanLevels */ }
  }
  if (typeof G.hgPlanLevels === 'function'){
    try{
      var pl = G.hgPlanLevels(row.dec.dir, rows);
      var hp = normalizePlan(pl, 'hgPlanLevels');
      if (hp) return { plan: hp, rows: rows };
    }catch(e){}
  }
  return { plan: null, rows: rows };
}

/* combined-mode crypto plan: same precedence as cryptoPlan (engine survivor
   plan -> smartSetup -> hgPlanLevels) but consumes the lazily pre-fetched 4h
   rows instead of fetching ad hoc. smartSetup gets [] for 1h rows — the
   fetch budget is 4h-only, an input it already tolerates. */
async function cryptoPlanXu(row, snap){
  var ep = enginePlanFor(row, snap);
  if (ep) return { plan: ep, rows: null };
  var rows = (row.rows4h && row.rows4h.length) ? row.rows4h : null;
  if (!rows) return { plan: null, rows: null };
  if (typeof G.smartSetup === 'function' && rows.length >= 60){
    try{
      var agreeing = row.col.votes.filter(function(v){ return v.vote === row.dec.dir; });
      var contra   = row.col.votes.filter(function(v){ return v.vote === (row.dec.dir === 'long' ? 'short' : 'long'); });
      var cls = { dir: row.dec.dir,
                  longEv: row.dec.dir === 'long' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  shortEv: row.dec.dir === 'short' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  score: row.dec.agree, total: row.dec.agree + row.dec.disagree, regime: [] };
      var sp = G.smartSetup(cls, rows, []);
      var np = normalizePlan(sp, sp && sp.type ? 'smartSetup ' + sp.type : 'smartSetup');
      if (np) return { plan: np, rows: rows };
    }catch(e){ /* fall through to hgPlanLevels */ }
  }
  if (typeof G.hgPlanLevels === 'function'){
    try{
      var hp = normalizePlan(G.hgPlanLevels(row.dec.dir, rows), 'hgPlanLevels');
      if (hp) return { plan: hp, rows: rows };
    }catch(e){}
  }
  return { plan: null, rows: rows };
}

/* gold lane plan: the stashed goldSetupDecision levels -> XAU 4h fallback */
async function goldPlan(row, snap){
  var gs = snap.goldSetup;
  var gp = normalizePlan(gs, 'gold setup');
  if (gp) return { plan: gp, rows: null };
  var rows = null;
  try{
    if (typeof G.getXAUCandles === 'function'){
      var h4 = await withTimeout(G.getXAUCandles('4h', KLINES_4H), TUN.fetchMs); /* hung gold feed must not park the scan */
      rows = (h4 && h4.length) ? h4 : null;
    }
  }catch(e){ rows = null; }
  if (rows && typeof G.hgPlanLevels === 'function'){
    try{
      var hp = normalizePlan(G.hgPlanLevels(row.dec.dir, rows), 'hgPlanLevels · XAU 4h');
      if (hp) return { plan: hp, rows: rows };
    }catch(e){}
  }
  return { plan: null, rows: rows };
}

/* ---------------- market read ---------------- */
function marketRead(snap){
  var bits = [], dark = [];
  if (snap.regime && typeof snap.regime.label === 'string' && snap.regime.label){
    bits.push(snap.regime.label + ' regime'
      + (isFinite(snap.regime.score) ? ' (score ' + (snap.regime.score > 0 ? '+' : '') + snap.regime.score + ')' : ''));
  }else dark.push('regime');
  if (snap.rotation && typeof snap.rotation.season === 'string'){
    var ap = isFinite(snap.rotation.altPct) ? ' ' + Math.round(snap.rotation.altPct) + '%' : '';
    bits.push(snap.rotation.season === 'mixed' ? 'mixed rotation' + ap
            : snap.rotation.season + ' season' + ap);
  }else dark.push('rotation');
  if (snap.onchain && typeof snap.onchain.bias === 'string'){
    bits.push('on-chain ' + snap.onchain.bias);
  }else dark.push('on-chain');
  if (snap.fng && isFinite(snap.fng.v)) bits.push('F&G ' + snap.fng.v + ' ' + (snap.fng.c || ''));
  var bn = newsFor('BTCUSDT');
  if (bn && typeof bn === 'object'){
    bits.push((bn.blackout === true || bn.risk === 'high') ? 'RED NEWS: ' + (bn.note || 'high-impact window')
            : (bn.note || 'news clear'));
  }else dark.push('news');
  var txt = bits.length ? bits.join(' · ') + '.' : 'no market context available — every context layer is dark.';
  if (dark.length) txt += ' (dark: ' + dark.join(', ') + ')';
  return txt;
}

/* ---------------- rendering ---------------- */
function votePip(v, decidedDir){
  var cls = 'gpip', label = v.layer.toUpperCase();
  if (v.vote === 'veto')
    return '<span class="gpip" style="color:var(--short);border-color:rgba(228,88,107,.5);background:rgba(228,88,107,.08)">'
      + label + ': ' + esc(v.text) + '</span>';
  if (v.vote === 'neutral')
    return '<span class="gpip">' + label + ': ' + esc(v.text) + '</span>';
  if (decidedDir && v.vote === decidedDir)
    return '<span class="gpip ok">' + label + ': ' + esc(v.text) + '</span>';
  return '<span class="gpip" style="color:var(--short);border-color:rgba(228,88,107,.5);background:rgba(228,88,107,.08)">'
    + label + ': ' + esc(v.text) + '</span>';
}

function planLine(plan){
  if (!plan) return 'levels unavailable — size down';
  var risk = Math.abs(plan.entry - plan.stop);
  return 'ENTRY <b>' + PX(plan.entry) + '</b> · STOP <b>' + PX(plan.stop) + '</b>'
    + ' · T1 <b>' + PX(plan.t1) + '</b> (' + FMT(plan.rr1, 1) + 'R)'
    + (plan.t2 !== null ? ' · T2 <b>' + PX(plan.t2) + '</b> (' + FMT(plan.rr2, 1) + 'R)' : '')
    + ' · risk ' + FMT(plan.riskPct, 2) + '%'
    + (plan.src ? ' — ' + esc(plan.src) : '')
    + (plan.note ? ' · ' + esc(plan.note) : '');
}

function cardHTML(row){
  var dec = row.dec, dir = dec.dir;
  var plan = row.plan || null;
  var silentTxt = row.col.silent.length ? row.col.silent.join(', ') + ' silent' : '';
  var darkTxt = row.col.unavailable.length ? row.col.unavailable.join(', ') + ' dark' : '';
  var venueStamp = (row.exchange === 'delta') ? ' <span class="stamp na">DELTA</span>'
                 : (row.exchange === 'cdcx') ? ' <span class="stamp na">COINDCX</span>' : '';
  var tradeBtn = (plan && typeof G.toTrade === 'function')
    ? '<button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(row.lane === 'gold' ? 'XAUTUSD' : row.sym) + ',' + JSON.stringify(dir) + ','
         + plan.entry + ',' + plan.stop + ',' + plan.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  var chartBox = (plan && row.rows)
    ? '<div class="hgchart brainChart" data-sym="' + esc(row.sym) + '" style="height:190px;margin-top:8px"></div>' : '';
  return '<div class="card ' + dir + '">'
    + '<div class="chead"><span class="sym">' + esc(row.lane === 'gold' ? 'XAU · GOLD' : row.sym) + '</span>'
    + '<span class="dir"><span class="stamp pass">' + dir.toUpperCase() + '</span> ' + dec.tier
    + ' · ' + dec.agree + ' LAYER' + (dec.agree === 1 ? '' : 'S') + venueStamp + '</span></div>'
    + '<div class="mini">'
    + '<span class="k">verdict</span><span>' + esc(dec.reasons[0] || '') + '</span>'
    + '<span class="k">structure check</span><span>'
    + (dec.hasStructural ? '✓ structural' : '✗ structural') + ' · '
    + (dec.hasPositioning ? '✓ positioning' : '✗ positioning') + '</span>'
    + '<span class="k">layers</span><span>' + dec.longCount + ' long · ' + dec.shortCount + ' short · '
    + row.col.votes.filter(function(v){ return v.vote === 'neutral'; }).length + ' neutral'
    + (silentTxt ? ' · ' + esc(silentTxt) : '') + (darkTxt ? ' · ' + esc(darkTxt) : '') + '</span>'
    + '</div>'
    + '<div class="gates">' + row.col.votes.map(function(v){ return votePip(v, dir); }).join('') + '</div>'
    + '<div class="plan">' + planLine(plan) + '</div>'
    + chartBox
    + tradeBtn
    + '</div>';
}

/* ledger display name: gold -> XAU, otherwise the base asset (BTC), falling
   back to the legacy sym strip — identical output for legacy candidates */
function displaySym(row){
  if (row.lane === 'gold' || row.sym === 'XAU') return 'XAU';
  return row.base || String(row.sym).replace(/USDT$/, '');
}

function watchRowHTML(row){
  var age = row.ageStamp ? ' <span class="stamp na">' + esc(String(row.ageStamp).toUpperCase()) + '</span>' : '';
  return '<div class="lrow">'
    + '<span class="gid">' + esc(displaySym(row)) + '</span>'
    + '<span class="gname">' + (row.dec.dir ? row.dec.dir.toUpperCase() + ' bias — ' : '')
    + esc(row.dec.reasons[0] || '') + '</span>'
    + '<span class="gdetail">' + row.dec.agree + ' agree' + (row.dec.disagree ? ' · ' + row.dec.disagree + ' contra' : '')
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '') + '</span>'
    + '<span class="stamp na">WATCH</span>' + age + '</div>';
}

function asideRowHTML(row){
  var vetoed = row.dec.vetoes && row.dec.vetoes.length;
  var age = row.ageStamp ? ' <span class="stamp na">' + esc(String(row.ageStamp).toUpperCase()) + '</span>' : '';
  return '<div class="lrow">'
    + '<span class="gid">' + esc(displaySym(row)) + '</span>'
    + '<span class="gname">' + esc(row.dec.reasons[0] || 'aside') + '</span>'
    + '<span class="gdetail">' + row.dec.longCount + 'L/' + row.dec.shortCount + 'S'
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '') + '</span>'
    + '<span class="stamp ' + (vetoed ? 'veto' : 'na') + '">' + (vetoed ? 'VETO' : 'ASIDE') + '</span>' + age + '</div>';
}

function paintCharts(cardsEl, rows){
  try{
    if (typeof G.hgMiniChart !== 'function' || !cardsEl || typeof cardsEl.querySelectorAll !== 'function') return;
    var nodes = cardsEl.querySelectorAll('.brainChart');
    if (!nodes || !nodes.length) return;
    var bySym = {};
    for (var i = 0; i < rows.length; i++) bySym[rows[i].sym] = rows[i];
    for (var k = 0; k < nodes.length; k++){
      try{
        var r = bySym[nodes[k].getAttribute('data-sym')];
        if (!r || !r.plan || !r.rows) continue;
        G.hgMiniChart(nodes[k], r.rows, { dir: r.plan.dir, entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, t2: r.plan.t2 });
      }catch(e){ /* one chart failing never kills the rest */ }
    }
  }catch(e){ /* charting is best-effort */ }
}

function depStatus(){
  var need = ['hgNewsRisk', 'hgNewsState', 'regimeState', 'rotationState', 'onchainState',
              'engineState', 'oiflowState', 'squeezeState', 'liqAgg', 'liqFlushSetup',
              'goldspotState', 'smartSetup', 'hgPlanLevels', 'hgMiniChart', 'toTrade',
              'binanceTickers24h', 'binanceKlines'];
  var missing = [];
  for (var i = 0; i < need.length; i++){
    if (typeof G[need[i]] !== 'function') missing.push(need[i]);
  }
  return missing;
}

/* ---------------- silent-firewall helpers ---------------- */
/* age stamp for verdicts carried over unchanged by a quick rescan */
function ageOf(at){
  if (!isFinite(at)) return 'as of ?';
  try{ return 'as of ' + new Date(at).toTimeString().slice(0, 5); }catch(e){ return 'as of ?'; }
}

/* every failure path ends VISIBLE: stat line -> empty block -> a note
   appended to the pane itself. Never a silent empty pane. */
function paintFatal(el, msg){
  try{
    var stat = el && el.querySelector ? el.querySelector('#brainStat') : null;
    if (stat){ stat.className = 'note warn'; stat.textContent = msg; return; }
  }catch(e){}
  try{
    var empty = el.querySelector('#brainEmpty');
    if (empty){ empty.style.display = 'block'; empty.textContent = msg; return; }
  }catch(e){}
  try{ el.insertAdjacentHTML('beforeend', '<div class="note warn">' + esc(msg) + '</div>'); }
  catch(e){ try{ el.textContent = msg; }catch(e2){} }
}

/* one bad row must never blank the whole render — it becomes an honest row */
function safeCardHTML(row){
  try{ return cardHTML(row); }
  catch(e){
    return '<div class="card"><div class="chead"><span class="sym">' + esc(row && row.sym) + '</span>'
      + '<span class="dir"><span class="stamp veto">RENDER FAILED</span></span></div>'
      + '<div class="plan">card render failed: ' + esc(errMsg(e)) + ' — the verdict was computed, the display failed</div></div>';
  }
}
function safeWatchRowHTML(row){
  try{ return watchRowHTML(row); }
  catch(e){ return '<div class="lrow"><span class="gid">' + esc(row && row.sym) + '</span><span class="gname">row render failed: '
    + esc(errMsg(e)) + '</span><span class="gdetail"></span><span class="stamp na">WATCH</span></div>'; }
}
function safeAsideRowHTML(row){
  try{ return asideRowHTML(row); }
  catch(e){ return '<div class="lrow"><span class="gid">' + esc(row && row.sym) + '</span><span class="gname">row render failed: '
    + esc(errMsg(e)) + '</span><span class="gdetail"></span><span class="stamp na">ASIDE</span></div>'; }
}

/* scorecard hook — PRIME/HIGH cards only, fire-and-forget, never blocking
   render; a missing/throwing/rejecting recorder changes nothing */
function scoreRecord(setups){
  try{
    if (typeof G.hgScoreRecord !== 'function') return;
    for (var i = 0; i < setups.length; i++){
      (function(row){
        try{
          var dec = row && row.dec;
          if (!dec || (dec.tier !== 'PRIME' && dec.tier !== 'HIGH') || !isDir(dec.dir)) return;
          var agreeing = [];
          var votes = (row.col && Array.isArray(row.col.votes)) ? row.col.votes : [];
          for (var a = 0; a < votes.length; a++){
            if (votes[a] && votes[a].vote === dec.dir) agreeing.push(votes[a].layer);
          }
          var p = row.plan || null;
          var ret = G.hgScoreRecord({
            source: 'brain', sym: row.sym, dir: dec.dir, tier: dec.tier,
            entry: p ? p.entry : null, stop: p ? p.stop : null,
            t1: p ? p.t1 : null, t2: p ? p.t2 : null,
            layers: agreeing, at: Date.now()
          });
          if (ret && typeof ret.then === 'function') ret.then(null, function(){});
        }catch(e){ /* one card's record must never break the rest */ }
      })(setups[i]);
    }
  }catch(e){ /* recording is best-effort */ }
}

/* ---------------- tab state + hard-refresh contract ---------------- */
var __busy = false;
var __hasRun = false;
var __mountedEl = null;
var __lastResult = null;  /* {rows, uni, at} — quick rescan rechecks this, never the wire */

async function brainRefresh(){
  try{
    if (__busy) return 'busy';
    if (!__hasRun || !__mountedEl) return 'skipped: not run yet';
    await runBrain(__mountedEl);
    return 'refreshed';
  }catch(e){ return 'error'; }
}

async function runBrain(el){
  var btn = el.querySelector('#brainRun'), stat = el.querySelector('#brainStat'),
      read = el.querySelector('#brainRead'), readWrap = el.querySelector('#brainReadWrap'),
      cards = el.querySelector('#brainCards'), watch = el.querySelector('#brainWatch'),
      watchWrap = el.querySelector('#brainWatchWrap'),
      aside = el.querySelector('#brainAside'), asideWrap = el.querySelector('#brainAsideWrap'),
      empty = el.querySelector('#brainEmpty');
  if (!btn || !stat || !cards || !watch || !aside || !empty){
    /* used to be a silent return — the reported "click does nothing". Now the
       failure is always VISIBLE, with the missing element named. */
    var miss = [];
    if (!btn) miss.push('#brainRun');
    if (!stat) miss.push('#brainStat');
    if (!cards) miss.push('#brainCards');
    if (!watch) miss.push('#brainWatch');
    if (!aside) miss.push('#brainAside');
    if (!empty) miss.push('#brainEmpty');
    paintFatal(el, 'brain pane incomplete — ' + miss.join(', ') + ' unavailable — remount the tab');
    return;
  }
  if (__busy) return;
  __busy = true;
  var t0 = Date.now();
  try{
    btn.disabled = true;
    cards.innerHTML = ''; watch.innerHTML = ''; aside.innerHTML = '';
    if (read) read.textContent = '';
    empty.style.display = 'none';
    stat.className = 'note';
    stat.textContent = 'reading every intelligence layer…';

    var snap = snapshotLayers();
    var uni = await buildUniverse();
    var combined = (uni.mode === 'combined');

    /* venue select is only meaningful with the combined feed — keep it hidden
       in legacy mode (absent xu -> today's behavior, byte-identical) */
    var vsel = el.querySelector('#brainVenue');
    if (vsel){
      vsel.style.display = combined ? '' : 'none';
      if (combined) vsel.value = uni.venue;
    }

    /* collect + decide — fully synchronous once layers are snapshotted;
       CPU-cheap, so EVERY candidate gets voted (no universe truncation) */
    var rows = [];
    for (var i = 0; i < uni.candidates.length; i++) rows.push(judgeCrypto(uni.candidates[i], snap));
    rows.push(judgeGold(snap));
    for (var rj = 0; rj < rows.length; rj++) rows[rj].judgedAt = t0; /* quick rescan ages verdicts from this */

    /* bucket: PRIME/HIGH cards, WATCH list, ASIDE ledger */
    var primes = [], highs = [], watches = [], asides = [];
    for (var r = 0; r < rows.length; r++){
      var row = rows[r], t = row.dec.tier;
      if (t === 'PRIME') primes.push(row);
      else if (t === 'HIGH') highs.push(row);
      else if (t === 'WATCH') watches.push(row);
      else asides.push(row);
    }
    var byAgree = function(a, b){ return (b.dec.agree - a.dec.agree) || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0); };
    primes.sort(byAgree); highs.sort(byAgree); watches.sort(byAgree);

    var setups = primes.concat(highs);
    var capNote = '';

    if (combined){
      /* lazy, bounded candle fetching: 4h rows ONLY for crypto candidates at
         WATCH-or-better on the non-candle layers — the shared queue helper
         owns ordering, chunking, the fetch cap and the scan watchdog.
         The gold lane keeps its own candle path (goldPlan, unchanged). */
      var fq = await fetchCandleQueue(primes.concat(highs, watches), uni, stat, t0);
      capNote = fq.capNote + fq.watchNote;
      /* plans only for PRIME/HIGH — engine plans first, prefetched 4h rows */
      for (var sx = 0; sx < setups.length; sx++){
        if (Date.now() - t0 > TUN.scanMs){ capNote += ' · planning timed out — some levels unavailable'; break; }
        stat.textContent = 'planning ' + (sx + 1) + '/' + setups.length + ' · ' + setups[sx].sym;
        try{
          var gotx = (setups[sx].lane === 'gold') ? await goldPlan(setups[sx], snap)
                                                  : await cryptoPlanXu(setups[sx], snap);
          setups[sx].plan = gotx.plan; setups[sx].rows = gotx.rows;
        }catch(e){ setups[sx].plan = null; setups[sx].rows = null; }
      }
    }else{
      /* legacy mode — today's flow, unchanged: bounded kline fetches per setup */
      for (var s = 0; s < setups.length; s++){
        if (Date.now() - t0 > TUN.scanMs){ capNote += ' · planning timed out — some levels unavailable'; break; }
        stat.textContent = 'planning ' + (s + 1) + '/' + setups.length + ' · ' + setups[s].sym;
        try{
          var got = (setups[s].lane === 'gold') ? await goldPlan(setups[s], snap)
                                                : await cryptoPlan(setups[s], snap);
          setups[s].plan = got.plan; setups[s].rows = got.rows;
        }catch(e){ setups[s].plan = null; setups[s].rows = null; }
      }
    }

    /* render */
    if (read && readWrap){
      read.textContent = marketRead(snap);
      readWrap.style.display = 'block';
    }
    var readUni = el.querySelector('#brainReadUni');
    if (readUni){
      readUni.textContent = combined
        ? 'universe ' + uni.counts.total + ' (delta ' + uni.counts.delta + ' + cdcx ' + uni.counts.cdcx
          + ') · ' + setups.length + ' prime/high · ' + watches.length + ' watch'
        : '';
    }
    /* safe* wrappers: one bad row becomes an honest RENDER FAILED row,
       never blanks the whole 500-row render */
    cards.innerHTML = setups.map(safeCardHTML).join('');
    paintCharts(cards, setups);
    watch.innerHTML = watches.map(safeWatchRowHTML).join('');
    watchWrap.style.display = watches.length ? 'block' : 'none';
    aside.innerHTML = asides.map(safeAsideRowHTML).join('');
    asideWrap.style.display = asides.length ? 'block' : 'none';
    if (!setups.length && !watches.length) empty.style.display = 'block';

    /* scorecard hook — PRIME/HIGH only, fire-and-forget, after plans land */
    scoreRecord(setups);
    /* quick-rescan baseline: full row set + universe + scan time */
    __lastResult = { rows: rows, uni: uni, at: Date.now() };

    if (combined){
      stat.textContent = 'done · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
        + watches.length + ' watch · ' + asides.length + ' aside · universe '
        + uni.counts.total + ' (delta ' + uni.counts.delta + ' + cdcx ' + uni.counts.cdcx + ') + XAU · '
        + setups.length + ' prime/high · ' + watches.length + ' watch'
        + (uni.venue !== 'ALL' ? ' · venue ' + uni.venue : '')
        + capNote + ' · '
        + ((Date.now() - t0) / 1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    }else{
      stat.textContent = 'done · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
        + watches.length + ' watch · ' + asides.length + ' aside · universe '
        + uni.candidates.length + ' + XAU (' + uni.note + ')'
        + (uni.xuNote ? ' · ' + uni.xuNote : '') + capNote + ' · '
        + ((Date.now() - t0) / 1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    }
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'brain synthesis failed: ' + (e && e.message ? e.message : e);
  }finally{
    __busy = false;
    __hasRun = true;
    btn.disabled = false;
  }
}

/* ---------------- QUICK RESCAN ----------------
   Rechecks ONLY what the last full scan already saw: the WATCH-or-better
   set is re-judged against a FRESH layer snapshot (regime flips move
   candidates honestly), ASIDE verdicts carry over with an AS OF age stamp,
   and the universe is a CACHE read (never a forced exchange refetch) used
   solely to detect new listings, which get judged on arrival. */
async function runQuick(el){
  var btn, qbtn, stat, read, readWrap, cards, watch, watchWrap, aside, asideWrap, empty;
  try{ btn = el.querySelector('#brainRun'); }catch(e){}
  try{ qbtn = el.querySelector('#brainQuick'); }catch(e){}
  try{ stat = el.querySelector('#brainStat'); }catch(e){}
  try{ read = el.querySelector('#brainRead'); }catch(e){}
  try{ readWrap = el.querySelector('#brainReadWrap'); }catch(e){}
  try{ cards = el.querySelector('#brainCards'); }catch(e){}
  try{ watch = el.querySelector('#brainWatch'); }catch(e){}
  try{ watchWrap = el.querySelector('#brainWatchWrap'); }catch(e){}
  try{ aside = el.querySelector('#brainAside'); }catch(e){}
  try{ asideWrap = el.querySelector('#brainAsideWrap'); }catch(e){}
  try{ empty = el.querySelector('#brainEmpty'); }catch(e){}
  if (!btn || !stat || !cards || !watch || !aside || !empty){
    var miss = [];
    if (!btn) miss.push('#brainRun');
    if (!stat) miss.push('#brainStat');
    if (!cards) miss.push('#brainCards');
    if (!watch) miss.push('#brainWatch');
    if (!aside) miss.push('#brainAside');
    if (!empty) miss.push('#brainEmpty');
    paintFatal(el, 'brain pane incomplete — ' + miss.join(', ') + ' unavailable — remount the tab');
    return;
  }
  if (__busy) return;
  if (!__lastResult){
    stat.className = 'note warn';
    stat.textContent = 'quick rescan needs a full synthesis first — hit RUN SYNTHESIS once; '
      + 'quick mode only rechecks what the last scan already saw';
    return;
  }
  __busy = true;
  var t0 = Date.now();
  try{
    btn.disabled = true;
    if (qbtn) qbtn.disabled = true;
    stat.className = 'note';
    stat.textContent = 'quick recheck — fresh layers over the last scan’s watch set…';

    var snap = snapshotLayers();
    var last = __lastResult;
    var lastRows = (last && Array.isArray(last.rows)) ? last.rows : [];
    var combined = !!(last.uni && last.uni.mode === 'combined');
    var newNote = '';

    /* universe: CACHE read only, solely for new-listing detection */
    var freshCands = null;
    if (combined){
      var xuAt = NaN;
      try{ var xs = (typeof G.xuState === 'function') ? G.xuState() : null; xuAt = xs && xs.at; }catch(e){}
      if (isFinite(xuAt) && (Date.now() - xuAt) > XU_CACHE_MS){
        newNote = ' · new-listing check skipped (universe cache stale — run a full synthesis)';
      }else{
        try{
          var list = await withTimeout(G.xuUniverse(false), TUN.fetchMs); /* cache read, never forced */
          if (Array.isArray(list) && list.length){
            var fu = brainUniverse(list, { venue: last.uni.venue || getVenue() });
            freshCands = fu.candidates;
            last.uni = fu;
          }else{
            newNote = ' · new-listing check skipped (universe cache unreadable)';
          }
        }catch(e){ newNote = ' · new-listing check skipped (universe cache unreadable)'; }
      }
    }else{
      newNote = ' · legacy mode — new-listing check needs the combined feed';
    }

    /* recheck set: last scan's WATCH-or-better rows (crypto + gold lane) */
    var recheck = [], unchanged = [];
    for (var i = 0; i < lastRows.length; i++){
      var lr = lastRows[i];
      if (lr && lr.dec && TIER_RANK[lr.dec.tier] >= TIER_RANK.WATCH) recheck.push(lr);
      else unchanged.push(lr);
    }
    /* new listings: in the cached universe but unseen by the last scan */
    var newCands = [];
    if (freshCands){
      var seen = {};
      for (var s2 = 0; s2 < lastRows.length; s2++) seen[lastRows[s2].sym] = 1;
      for (var f2 = 0; f2 < freshCands.length; f2++){
        if (!seen[freshCands[f2].sym]) newCands.push(freshCands[f2]);
      }
      if (newCands.length)
        newNote = ' · ' + newCands.length + ' new listing' + (newCands.length > 1 ? 's' : '') + ' — judged on arrival';
    }

    /* re-judge against the FRESH snapshot — flips move candidates honestly */
    var rows = [], ri;
    for (ri = 0; ri < recheck.length; ri++){
      rows.push(recheck[ri].lane === 'gold' ? judgeGold(snap) : judgeCrypto(recheck[ri], snap));
    }
    for (ri = 0; ri < newCands.length; ri++) rows.push(judgeCrypto(newCands[ri], snap));
    for (ri = 0; ri < rows.length; ri++) rows[ri].judgedAt = t0;
    var checked = rows.length;

    /* bucket */
    var primes = [], highs = [], watches = [], asides = [];
    for (var r = 0; r < rows.length; r++){
      var row = rows[r], t = row.dec.tier;
      if (t === 'PRIME') primes.push(row);
      else if (t === 'HIGH') highs.push(row);
      else if (t === 'WATCH') watches.push(row);
      else asides.push(row);
    }
    var byAgree = function(a, b){ return (b.dec.agree - a.dec.agree) || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0); };
    primes.sort(byAgree); highs.sort(byAgree); watches.sort(byAgree);
    var setups = primes.concat(highs);
    var extraNote = '';

    if (combined){
      /* fresh candles for the rechecked WATCH-or-better set — same bounded queue */
      var fq = await fetchCandleQueue(primes.concat(highs, watches), last.uni, stat, t0);
      /* same honesty contract as the full scan: a binding fetch cap is named */
      extraNote = fq.capNote + fq.watchNote;
      for (var sx = 0; sx < setups.length; sx++){
        if (Date.now() - t0 > TUN.scanMs){ extraNote += ' · planning timed out — some levels unavailable'; break; }
        try{
          var gotx = (setups[sx].lane === 'gold') ? await goldPlan(setups[sx], snap)
                                                  : await cryptoPlanXu(setups[sx], snap);
          setups[sx].plan = gotx.plan; setups[sx].rows = gotx.rows;
        }catch(e){ setups[sx].plan = null; setups[sx].rows = null; }
      }
    }else{
      /* legacy quick: the gate engine already holds the plans — ZERO refetch */
      var priorBySym = {};
      for (var pr = 0; pr < lastRows.length; pr++) priorBySym[lastRows[pr].sym] = lastRows[pr];
      for (var ls = 0; ls < setups.length; ls++){
        try{
          if (setups[ls].lane === 'gold'){
            var gg = await goldPlan(setups[ls], snap);
            setups[ls].plan = gg.plan; setups[ls].rows = gg.rows;
          }else{
            var prior = priorBySym[setups[ls].sym];
            setups[ls].plan = enginePlanFor(setups[ls], snap) || (prior && prior.plan) || null;
            setups[ls].rows = (prior && prior.rows) || null;
          }
        }catch(e){ setups[ls].plan = null; setups[ls].rows = null; }
      }
    }

    /* unchanged verdicts carry over with an honest AS OF age stamp */
    for (var u = 0; u < unchanged.length; u++){
      unchanged[u].ageStamp = ageOf(unchanged[u].judgedAt || last.at);
      asides.push(unchanged[u]);
    }

    /* render — same shape as a full scan */
    if (read && readWrap){
      read.textContent = marketRead(snap);
      readWrap.style.display = 'block';
    }
    cards.innerHTML = setups.map(safeCardHTML).join('');
    paintCharts(cards, setups);
    watch.innerHTML = watches.map(safeWatchRowHTML).join('');
    if (watchWrap) watchWrap.style.display = watches.length ? 'block' : 'none';
    aside.innerHTML = asides.map(safeAsideRowHTML).join('');
    if (asideWrap) asideWrap.style.display = asides.length ? 'block' : 'none';
    empty.style.display = (!setups.length && !watches.length) ? 'block' : 'none';

    /* scorecard hook — fresh PRIME/HIGH cards earn a record, unchanged never do */
    scoreRecord(setups);

    /* the quick result becomes the new baseline */
    var allRows = rows;
    for (var ar = 0; ar < unchanged.length; ar++) allRows.push(unchanged[ar]);
    __lastResult = { rows: allRows, uni: last.uni, at: Date.now() };

    stat.className = 'note';
    stat.textContent = 'quick rescan: ' + checked + ' checked · ' + unchanged.length + ' unchanged · '
      + ((Date.now() - t0) / 1000).toFixed(0) + 's' + newNote + extraNote
      + ' · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
      + watches.length + ' watch · ' + asides.length + ' aside'
      + ' · ' + new Date().toTimeString().slice(0, 5);
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'quick rescan failed: ' + (e && e.message ? e.message : e);
  }finally{
    __busy = false;
    btn.disabled = false;
    if (qbtn) qbtn.disabled = false;
  }
}

/* ---------------- WARM UP LAYERS ----------------
   One click runs every layer module's published warm hook (G.HG_warmups) in
   sequence — engine LAST, it is the deep gate scan and the slow leg — then
   auto-fires the synthesis. Per-layer results land in the deps note so the
   stat line keeps its synthesis contract; a capped layer keeps running in
   its own time and the note says so. Never throws. */
var __warming = false;
async function runWarmup(el){
  var stat = null, deps = null, warmBtn = null, runBtn = null, quickBtn = null;
  try{ stat = el.querySelector('#brainStat'); }catch(e){}
  try{ deps = el.querySelector('#brainDeps'); }catch(e){}
  try{ warmBtn = el.querySelector('#brainWarm'); }catch(e){}
  try{ runBtn = el.querySelector('#brainRun'); }catch(e){}
  try{ quickBtn = el.querySelector('#brainQuick'); }catch(e){}
  if (!stat){
    paintFatal(el, 'brain pane incomplete — #brainStat unavailable — remount the tab');
    return;
  }
  if (__warming || __busy) return;
  var hooks = [];
  try{
    var reg = Array.isArray(G.HG_warmups) ? G.HG_warmups : [];
    for (var i = 0; i < reg.length; i++){
      var h = reg[i];
      if (h && typeof h.run === 'function' && typeof h.id === 'string') hooks.push(h);
    }
  }catch(e){}
  hooks.sort(function(a, b){ return (a.id === 'engine' ? 1 : 0) - (b.id === 'engine' ? 1 : 0); });
  if (!hooks.length){
    stat.className = 'note warn';
    stat.textContent = 'no warmable layers found — layer modules did not publish warm hooks (script load order?)';
    return;
  }
  __warming = true;
  if (warmBtn) warmBtn.disabled = true;
  if (runBtn) runBtn.disabled = true;
  if (quickBtn) quickBtn.disabled = true;
  var results = [];
  try{
    for (var k = 0; k < hooks.length; k++){
      var hk = hooks[k];
      stat.className = 'note';
      stat.textContent = 'warming ' + (k + 1) + '/' + hooks.length + ' · ' + (hk.label || hk.id)
        + (hk.id === 'engine' ? ' — the deep gate scan, the slow leg' : '') + '…';
      var r;
      try{
        /* rejections are mapped to 'error:' BEFORE withTimeout sees them —
           withTimeout resolves null on a rejected promise (its timeout
           contract), which would otherwise mislabel a failed layer as
           "still running" */
        r = await withTimeout(
          Promise.resolve().then(function(){ return hk.run(); }).then(
            function(v){ return v; },
            function(e){ return 'error: ' + errMsg(e); }),
          240000); /* 4-min soft cap per layer */
        if (r === null) r = 'still running — it lands in its own time';
        else if (typeof r !== 'string') r = 'warmed';
      }catch(e){ r = 'error: ' + errMsg(e); }
      results.push((hk.label || hk.id) + ': ' + r);
      try{
        if (deps){
          deps.className = 'note';
          deps.textContent = 'warm-up · ' + results.join(' · ');
        }
      }catch(e){}
    }
  }finally{
    __warming = false;
    if (warmBtn) warmBtn.disabled = false;
    if (runBtn) runBtn.disabled = false;
    if (quickBtn) quickBtn.disabled = false;
  }
  /* auto-fire the synthesis over the warmed layers */
  try{ stat.className = 'note'; stat.textContent = 'layers warmed — running synthesis…'; }catch(e){}
  try{ await runBrain(el); }catch(e){ /* runBrain owns its failure surface */ }
}

/* mount-time notes always land somewhere visible — stat line first, then a
   note appended to the pane, then raw text. Never a silent dead button. */
function mountNote(el, msg){
  try{
    var stat = el.querySelector('#brainStat');
    if (stat){ stat.className = 'note warn'; stat.textContent = msg; return; }
  }catch(e){}
  try{ el.insertAdjacentHTML('beforeend', '<div class="note warn">' + esc(msg) + '</div>'); }
  catch(e){ try{ el.textContent = msg; }catch(e2){} }
}

function mount(el){
  if (!el) return;
  /* 1) shell paint — isolated. If even this fails, a last-resort note goes
     straight onto the pane and mount STILL never throws. */
  try{
    el.innerHTML =
      '<div class="panel">'
      + '<h2>BRAIN — meta-intelligence <span>reads every layer · evidence agreement, not scores</span></h2>'
      + '<div class="row"><button class="btn" id="brainRun">RUN SYNTHESIS</button>'
      + '<button class="btn" id="brainQuick" title="recheck the last scan’s watch set against fresh layers — cached universe, new listings judged on arrival">QUICK RESCAN</button>'
      + '<button class="btn" id="brainWarm" title="run every layer tab’s scan (news, regime, rotation, on-chain, OI flow, squeeze, engine) in sequence, then auto-run the synthesis — one click instead of eight">WARM UP LAYERS</button>'
      + '<select id="brainVenue" style="display:none" title="venue filter — combined Delta India + CoinDCX universe">'
      + '<option value="ALL">ALL VENUES</option><option value="DELTA">DELTA ONLY</option>'
      + '<option value="CDCX">COINDCX ONLY</option></select>'
      + '<span class="note" id="brainStat"></span></div>'
      + '<div class="note" id="brainDeps" style="margin-top:8px"></div>'
      + '<div class="note" style="margin-top:8px">Conviction is independent layers <b>agreeing</b>, each with a human-readable '
      + 'evidence string — never an invented number. <b>PRIME</b>: 5+ layers agree incl. structural + positioning, zero vetoes, '
      + 'news clear. <b>HIGH</b>: 4 agree, zero vetoes. <b>WATCH</b>: 3 agree or one soft disagreement. <b>ASIDE</b>: any veto, '
      + 'a tie, contested or thin — the killing reason is shown. Dark layers are named and cap the tier. '
      + 'Plans come from the gate engine, the SMART $ builder or the universal hgPlanLevels fallback only — levels are never invented. '
      + 'Universe: BTC/ETH/SOL + every Delta India + CoinDCX futures listing (combined, deduped by base, via xuniverse.js when '
      + 'present — else legacy Binance top-10). Candles are fetched lazily, only for WATCH-or-better candidates (cap 40/scan).</div>'
      + '</div>'
      + '<div class="panel" id="brainReadWrap" style="display:none;margin-top:10px"><h2>MARKET READ <span id="brainReadUni"></span></h2>'
      + '<div class="note" id="brainRead" style="font-size:12px;line-height:1.7"></div></div>'
      + '<div class="cards" id="brainCards" style="margin-top:10px"></div>'
      + '<div class="panel" id="brainWatchWrap" style="display:none;margin-top:10px"><h2>WATCH <span>one layer short of conviction</span></h2>'
      + '<div id="brainWatch"></div></div>'
      + '<div class="panel" id="brainAsideWrap" style="display:none;margin-top:10px"><h2>ASIDE <span>vetoed · tied · contested · thin — standing aside is a position</span></h2>'
      + '<div id="brainAside"></div></div>'
      + '<div class="empty" id="brainEmpty" style="display:none">No high-probability setups right now — standing aside is a position.</div>';
    __mountedEl = el;
  }catch(e){
    try{ el.textContent = 'brain mount failed: ' + errMsg(e) + ' — reload the tab'; }catch(e2){}
    try{ el.insertAdjacentHTML('beforeend', '<div class="note warn">brain mount failed: ' + esc(errMsg(e)) + ' — reload the tab</div>'); }catch(e3){}
    return;
  }
  /* 2) the click listeners — FIRST and each isolated. A dead RUN button was
     the reported bug: it used to share one big try with the deps note, so a
     throw anywhere earlier silently killed the click. If attach fails, the
     dead button is ANNOUNCED and mount retries itself once (index.html
     latches HG_MOUNTED, so the module must retry on its own). */
  var runWired = false;
  try{
    var btn = el.querySelector('#brainRun');
    if (btn) btn.addEventListener('click', function(){ runBrain(el); });
    runWired = !!btn;
  }catch(e){ runWired = false; }
  try{
    var qbtn = el.querySelector('#brainQuick');
    if (qbtn) qbtn.addEventListener('click', function(){ runQuick(el); });
    var wbtn = el.querySelector('#brainWarm');
    if (wbtn) wbtn.addEventListener('click', function(){ runWarmup(el); });
  }catch(e){}
  if (!runWired){
    mountNote(el, 'brain mount degraded: run button wiring failed — retrying…');
    setTimeout(function(){ try{ mount(el); }catch(e){} }, 100);
  }
  /* 3) venue filter — isolated */
  try{
    var vsel = el.querySelector('#brainVenue');
    if (vsel){
      vsel.value = getVenue();
      /* visible only when the combined feed is present (runBrain re-checks too) */
      vsel.style.display = (typeof G.xuUniverse === 'function') ? '' : 'none';
      vsel.addEventListener('change', function(){
        setVenue(vsel.value);
        /* explicit user action — re-run is fine, but never a first-time scan,
           and never mid-warm: a scan launched while WARM UP LAYERS is running
           reads half-warmed layers and silently eats the warm-up's auto-fire */
        if (__hasRun && !__busy && !__warming) runBrain(el);
      });
    }
  }catch(e){ mountNote(el, 'brain mount degraded: venue filter unavailable — scan still runs'); }
  /* 4) deps note — isolated; its failure used to kill the RUN listener */
  try{
    var deps = el.querySelector('#brainDeps');
    if (deps){
      var missing = depStatus();
      if (missing.length){
        deps.className = 'note warn';
        deps.textContent = 'dark layers: ' + missing.join(', ') + ' — those votes sit out and conviction is capped honestly.';
      }else{
        deps.textContent = 'all layer getters present · news + regime + rotation + on-chain + engine + oiflow + squeeze + liqs + gold lane';
      }
    }
  }catch(e){ mountNote(el, 'brain mount degraded: layer-deps note unavailable — scan still runs'); }
  /* 5) shell sanity sweep — every element the RUN path needs, verified at
     mount so a half-painted shell is announced before the user ever clicks.
     (#brainRun/#brainQuick are deliberately NOT re-queried here — the wiring
     step above owns them, and a hostile pane may ration its throws.) */
  try{
    var need = ['#brainStat', '#brainCards', '#brainWatch', '#brainAside', '#brainEmpty', '#brainWarm'];
    var gone = [];
    for (var n = 0; n < need.length; n++){
      if (!el.querySelector(need[n])) gone.push(need[n]);
    }
    if (gone.length) mountNote(el, 'brain mount degraded: ' + gone.join(', ') + ' unavailable — remount the tab');
  }catch(e){ mountNote(el, 'brain mount degraded: shell sanity check unavailable — scan may still run'); }
}

/* ---------------- registration ---------------- */
G.brainCollect = brainCollect;
G.brainDecide = brainDecide;
G.brainUniverse = brainUniverse;
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'brain', label: 'BRAIN', mount: function(el){ mount(el); }, refresh: brainRefresh });

})();
