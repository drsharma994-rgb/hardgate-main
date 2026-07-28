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
  WATCH = 3 layers agree, 2 uncontested (radar), or exactly one soft disagreement
  ASIDE = any veto / a tie / contested / thin — with the killing reason

Missing layers never fabricate conviction: every absent/unrun layer is
named in the ledger and CAPS the tier (1-2 dark layers -> cap HIGH,
3+ -> cap WATCH).

RADAR QUALITY GATES (post-decide, brainDecide itself pure): three honest
win-rate gates applied in judgeCrypto after the tier lands, cutting
low-quality radar setups with NAMED reasons — nothing is silently dropped.
  LIQUIDITY FLOOR: WATCH-or-better requires >= $5M KNOWN 24h turnover;
    below-floor candidates demote to ASIDE, reason rendered on the row
    ('below liquidity floor — $X.XM 24h turnover, slippage eats the edge').
    null turnover = unknown = never punished.
  OVEREXTENSION GUARD: the tape perp already moved >= +/-15% in the row's
    bias direction — WATCH demotes to ASIDE ('overextended +XX.X% 24h —
    chasing tops is how radar dies'); PRIME/HIGH gets an amber GUARD
    caution chip instead (multi-layer conviction, tier unchanged).
  FUNDING CROWDING: |fundingPct| >= 0.1%/8h leaning the SAME way as the
    row's bias -> GUARD caution chip ('funding crowded same-direction —
    squeeze risk'), never a veto, tier unchanged.
Demotions are tallied on the stat line ('N gated: K liquidity · M
overextended'); cautions render on the card/row they belong to.

TREND4H STRUCTURAL LAYER (post-fetch promotion): for WATCH-or-better rows
whose 4h candles the lazy fetch already landed, EMA20-vs-EMA50 alignment
PLUS the most recent swing-structure break (higher-high / lower-low from
2-bar pivots) must BOTH agree with the row's bias -> a named structural
vote ('TREND4H: 4h EMA20>EMA50 + higher-high — structural long') is pushed
and the row is RE-DECIDED through the same pure brainDecide — WATCH can
promote to HIGH and HIGH to PRIME with ZERO tier-bar changes (PRIME still
needs 5+ agreeing incl. structural + positioning, zero vetoes, news clear).
Candles missing/unfetchable/too thin -> 'trend4h' is named dark for that
symbol (existing cap logic applies); candles present but disagreeing ->
'trend4h' silent, never dark.

STRUCTURE-ANCHORED LIMIT ENTRY PLANS (combined mode): a WATCH-or-better row
whose 4h candles the lazy fetch already landed no longer has to chase the
mark — cryptoPlanXu tries a patient LIMIT at 4h structure FIRST (engine
survivor plans still win; smartSetup/hgPlanLevels stay the fallback):
  ANCHOR (LONG): the HIGHEST level among {last confirmed swing-low zone top
    (2-bar pivot, zone = pivot low up to the higher neighboring low),
    EMA20(4h), EMA50(4h), nearest UNTOUCHED bullish 4h FVG/imbalance top,
    unmitigated 4h order block top, sell-side equal-lows pool, AVWAP from the
    last swing low} sitting BELOW the last 4h close, 0.25-1.5 x ATR14(4h)
    away. SHORT mirrors (LOWEST level ABOVE, swing-high zone / EMAs /
    untouched bearish FVG / OB bottom / buy-side equal-highs pool / AVWAP
    from the last swing high). Order block / pool / AVWAP come from
    indicators.js / indicators2.js through typeof feature-checks — an absent
    module = the family sits out. Every number is rows4h math — never
    invented.
  STOP: 0.5 x ATR14(4h) beyond the anchoring structure (LONG below the zone
    bottom / line, SHORT above the zone top / line).
  TP1/TP2: the 1.5R/2.5R convention, SNAPPED to opposing 4h structure where
    it exists (nearest opposing pivot becomes TP1; the next one beyond it
    becomes TP2), else the raw multiples. The existing MIN R:R discipline
    holds: snapped TP1 under 1.5R -> the anchored plan is declined and the
    gate-engine fallback plan renders with the reason named.
  IN-ZONE: mark already inside the anchor zone -> 'price in zone — limit at
    zone edge <price> or market' (entry = the far zone edge).
  Render: 'LIMIT @ <entry> — pullback to <anchor>' / 'stop <stop> (0.5xATR
    beyond <anchor>)' / 'TP1 <t1> · TP2 <t2> · R:R <x>' / 'cancel if 4h
    closes beyond <invalidation>' / 'limit working ~24h or until structure
    breaks'; the audit ledger gains a PLAN line naming the anchor source.
  No anchor in band -> the smartSetup/hgPlanLevels plan is kept UNTOUCHED and
  honestly labeled ('no nearby 4h structure — gate-engine levels'); candles
  missing/failed/too thin -> the same honest fallback, never a fabricated
  anchor. The plan contract stays {dir, entry, stop, t1, t2} plus ADDITIVE
  fields (entryType:'limit'|'zone'|'gate', anchorName, anchorNote, cancelIf)
  — __hgBrainLast rows and the signal logger keep their exact shape.

LIMIT BOARD (BRAIN tab, under the ENTRY TICKET): every PRIME/HIGH/WATCH row
carrying a computed plan listed as its own card — the exact resting limit
(entry/stop/T1/T2/R:R/anchor/cancel-if), a live validity chip (IN ZONE /
APPROACHING / WAITING / STALE / MARK n/a from window.hgLimitState over a
zero-fetch mark: xuPositioning cache -> the row's own snapshot), and the
SEND TO TRADE PLAN handoff. Market-entry plans (gate engine / smartSetup /
hgPlanLevels) sit in a separated MARKET-ONLY group with the decline reason
named. Board rows reuse the same plan objects the ticket alerts on, so
hgalert keys (sym@entry) stay byte-stable; the board repaints on the ticket
seam after every synthesis/quick rescan, never a new fetch. The same
anchored-first precedence now covers the legacy crypto lane and the gold
lane — engine survivor plans stay verbatim everywhere.

F&G EXTREME CONTRARIAN (context): Fear & Greed <= 20 -> a named long-context
vote for BTC/ETH/SOL only ('F&G 12 extreme fear — contrarian long
context'); >= 80 -> short-context. ONE context layer only, never a tier by
itself; neutral zone 21-79 and non-majors are silent; F&G absent -> the
layer sits out entirely (never dark, never caps).

PATH TO THE NEXT TIER: every WATCH row names CONCRETELY what builds the
next tier ('path to HIGH: needs TREND4H + 1 positioning layer'), computed
from what is currently dark/silent/dissenting — never a generic string.

SIGNAL-LOGGER SEAM: window.__hgBrainLast() -> deep-frozen {at, marketRead,
rows:[{sym, dir, tier, evidence:[strings], plan:{entry,stop,t1,t2}|null}]}
of the last completed synthesis (full or quick), null before the first
scan. Never throws.

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
whose venue candle leg falls short is rerouted to Binance INSIDE
xuCandles (deliberate, same row shape, never fabricated — xuniverse.js
fallback contract); when every source fails it gets an honest
'levels unavailable'.

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
__busy. window.brainTunables = {fetchMs, scanMs, warmMs, warmColdMs} is the documented vm-test
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
var RESCUE_CAP  = 12;      /* max 1h sniper-rescue fetches per scan — the rescue is a
                              precision tool for near-misses, not a second full sweep;
                              the 4h sweep keeps its own FETCH_CAP */
var __rescueFetches = 0;   /* per-scan rescue counter, reset at every synthesis start */
var __sessionNowOverride = null;   /* test seam: when set, sessionWindow() uses this clock */
var CHUNK_SIZE  = 5;       /* candle fetches in flight per chunk */
var FETCH_MS    = 12000;   /* per-fetch + universe-feed abort timeout */
var SCAN_MS     = 150000;  /* scan-level watchdog — guarantees __busy always releases */
var XU_CACHE_MS = 15 * 60 * 1000; /* mirror of xuniverse.js CACHE_MS (its documented contract) */
/* vm-test seam: suites may shorten timeouts; production never touches this */
var TUN = { fetchMs: FETCH_MS, scanMs: SCAN_MS, warmMs: 8000, warmColdMs: 12000, engineWarmMs: 240000 };
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
  trend4h: 'structural',
  oiflow: 'positioning', liqs: 'positioning', goldbasis: 'positioning',
  news: 'context', regime: 'context', rotation: 'context', onchain: 'context',
  tape: 'context', fng: 'context', funding: 'context', guard: 'context'
};
var TIER_RANK = { ASIDE: 0, WATCH: 1, HIGH: 2, PRIME: 3 };

/* TREND4H structural layer — evaluated post-fetch on the lazily fetched 4h
   rows: EMA20 vs EMA50 alignment + the most recent swing-structure break.
   Needs enough history for an honest EMA50 seed plus confirmed pivots. */
var TREND4H_MIN_ROWS = 60;

/* STRUCTURE-ANCHORED LIMIT PLANS — entry/stop/TP geometry, all multiples of
   ATR14(4h) on the row's own fetched 4h candles. The 1.5R/2.5R convention and
   the 1.5R minimum on TP1 mirror the terminal's smartSetup discipline. */
var ANCHOR_MIN_ROWS = 60;    /* same honesty bar as TREND4H / smartSetup */
var ANCHOR_BAND_MIN = 0.25;  /* anchor must sit >= 0.25 x ATR from the mark... */
var ANCHOR_BAND_MAX = 1.5;   /* ...and <= 1.5 x ATR away (a reachable pullback) */
var ANCHOR_STOP_ATR = 0.75;  /* stop = 0.75 x ATR beyond the anchoring structure —
                                0.5 died to ordinary wicks (owner's real log, 2026-07-27);
                                0.75 keeps the R:R discipline with real breathing room */
var PLAN_TP1_R    = 1.5;     /* raw TP multiples when no opposing structure exists */
var PLAN_TP2_R    = 2.5;
var PLAN_MIN_RR1  = 1.5;     /* MIN R:R discipline — snapped TP1 below this declines */
/* LIMIT STATE bands (mark vs the resting limit, ATR multiples) — the "when
   to enter" chip vocabulary, same 0.25 zone width as the anchor band */
var LIMIT_ZONE_ATR = 0.25;   /* mark within 0.25 x ATR of entry -> IN ZONE (filling) */
var LIMIT_NEAR_ATR = 1.0;    /* 0.25-1.0 x ATR on the correct side -> APPROACHING */

/* F&G extreme contrarian thresholds — context vote for the majors only */
var FNG_FEAR = 20;   /* <= 20 extreme fear -> contrarian LONG context */
var FNG_GREED = 80;  /* >= 80 extreme greed -> contrarian SHORT context */

/* TAPE layer thresholds — 24h momentum only counts with participation behind
   it, and past the extreme band the same tape argues fade, not chase. */
var TAPE_MIN_VOL = 10e6;  /* $10M Binance 24h quote turnover — participation floor */
var TAPE_MIN_CHG = 8;     /* |24h change| % — directional momentum threshold */
var TAPE_EXTREME = 25;    /* |24h change| % — overextended: caution, never a chase vote */

/* ---- radar quality gates (post-decide, brainDecide stays pure) ----
   Win-rate gates applied in judgeCrypto AFTER the tier is decided. They cut
   low-quality radar setups using ONLY data already on the row/snapshot
   (turnover, tape, funding — nothing refetched, nothing fabricated), and
   every gate NAMES its reason on the rendered card/row + the stat tally:
     LIQUIDITY FLOOR: WATCH-or-better requires >= $5M KNOWN 24h turnover —
       below it slippage eats the edge -> demote to ASIDE. null turnover is
       unknown and is NEVER punished.
     OVEREXTENSION GUARD: the tape perp already moved >= +/-15% in the row's
       bias direction — a WATCH radar chase demotes to ASIDE; PRIME/HIGH
       conviction is multi-layer, so it earns a caution chip instead.
     FUNDING CROWDING: |fundingPct| >= 0.1%/8h leaning the SAME way as the
       row's bias -> caution chip, never a veto, tier unchanged. */
var GATE_MIN_TURNOVER = 5e6;   /* $5M 24h turnover — radar liquidity floor */
var GATE_OVEREXT_CHG  = 15;    /* |24h change| % — chasing threshold */
var GATE_FUNDING_ABS  = 0.1;   /* |funding %/8h| — same-direction crowding */

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

  /* per-layer audit ledger (click-to-audit): EVERY layer lands exactly one
     note {status, text} as it is evaluated — a vote's evidence string, the
     exact dark reason, or why the layer stayed silent. Display-only: votes /
     unavailable / silent carry today's semantics unchanged. (Named `jot` —
     the NEWS block already owns a local `note` var for the event text.) */
  var notes = {};
  function jot(layer, status, text){
    notes[layer] = { status: String(status || ''), text: String(text === null || text === undefined ? '' : text) };
  }
  function dark(layer, why){ unavailable.push(layer); jot(layer, 'DARK', why); }
  function hush(layer, why){ silent.push(layer); jot(layer, 'SILENT', why); }

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
    jot(layer, String(vote).toUpperCase(), text);
  }

  /* ---- NEWS (both lanes) — blackout / high-impact = hard veto ---- */
  if (!inp.news || typeof inp.news !== 'object'){ dark('news', 'no news-risk state — hgNewsRisk/hgNewsState unavailable or never ran'); }
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
    if (!g){ dark('goldsetup', 'GOLD tab has not published a setup decision (run GOLD once)');
             dark('golddeep', 'no 37-gate deep verdict stashed by the GOLD tab');
             dark('goldbasis', 'no goldspot basis state — goldspot layer cold'); }
    else{
      /* gold setup decision (goldSetupDecision output, stashed when GOLD ran) */
      if (!g.setup || typeof g.setup !== 'object'){ dark('goldsetup', 'GOLD tab has not published a setup decision (run GOLD once)'); }
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
      if (!g.deep || typeof g.deep !== 'object'){ dark('golddeep', 'no 37-gate deep verdict stashed by the GOLD tab'); }
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
      if (!g.basis || typeof g.basis !== 'object'){ dark('goldbasis', 'no goldspot basis state — goldspot layer cold'); }
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
    return { sym: sym, lane: lane, votes: votes, unavailable: unavailable, silent: silent, notes: notes };
  }

  /* ================= CRYPTO LANE ================= */

  /* ---- REGIME playbook ---- */
  if (!inp.regime || typeof inp.regime !== 'object'){ dark('regime', 'regime layer returned no state — cold or failed; WARM UP or open REGIME'); }
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
  if (!inp.rotation || typeof inp.rotation !== 'object'){ dark('rotation', 'rotation layer returned no state — cold or failed'); }
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
    if (!inp.onchain || typeof inp.onchain !== 'object'){ dark('onchain', 'on-chain layer returned no state — cold or failed (BTC lane only)'); }
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
  else jot('onchain', 'SILENT', 'BTC-lane layer — alts carry no on-chain read');

  /* ---- F&G EXTREME CONTRARIAN (context, majors only) ----
     Fear & Greed <= 20 -> contrarian long context; >= 80 -> contrarian short.
     ONE context layer, never a tier by itself (a lone context vote is thin
     ASIDE downstream). Neutral zone 21-79 = silent. Majors = BTC/ETH/SOL via
     the alias set (covers 'ETHUSDT' legacy syms and 'B-BTC_USDT' xu syms).
     F&G absent -> the layer sits out ENTIRELY: not a vote, not silent, NOT
     dark — it must never cap conviction across the whole universe. */
  var fng = inp.fng;
  if (fng && typeof fng === 'object' && isFinite(+fng.v)){
    var fv = +fng.v;
    if (fv <= FNG_FEAR || fv >= FNG_GREED){
      var isMajor = false;
      for (var fb = 0; fb < BASES.length; fb++){
        if (aliasSet[BASES[fb]] === 1 || aliasSet[BASES[fb] + 'USDT'] === 1){ isMajor = true; break; }
      }
      if (isMajor){
        var frd = Math.round(fv);
        if (fv <= FNG_FEAR)
          push('fng', 'long', 'F&G ' + frd + ' extreme fear — contrarian long context');
        else
          push('fng', 'short', 'F&G ' + frd + ' extreme greed — contrarian short context');
      }else hush('fng', 'extreme F&G print, but this context layer is majors-only — nothing to say for this alt');
    }else hush('fng', 'F&G ' + Math.round(fv) + ' — inside the 21-79 neutral zone, no contrarian edge');
  }
  else jot('fng', 'SILENT', 'no Fear & Greed print — the layer sits out entirely (never dark, never caps)');

  /* ---- GATE ENGINE — survivor = strong vote, rejection = veto w/ gate ---- */
  if (!inp.engine || typeof inp.engine !== 'object'){ dark('engine', 'gate engine returned no state — the deep scan has not warmed'); }
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
          /* gate-stage taxonomy (engine.js setSnapshot contract — rejected rows
             carry {sym, vetoGate, dir, gatesPassed}; dir is the G1 structure
             lean, null when no side was ever committed):
             G4 LIQUIDITY / G5 NEWS → hard veto (untradeable / dangerous — a
               kill must mean something);
             G2 MOMENTUM / G3 POSITIONING with a committed lean → NON-
               CONFIRMATION, not opposition: neutral caution, gate named;
             G0/G1 (dir null) → no clean structure: chop is information,
               not a direction, and never a kill. */
          var vg = (typeof rj.vetoGate === 'string') ? rj.vetoGate : '';
          var rdir = isDir(rj.dir) ? rj.dir : null;
          var gp = (typeof rj.gatesPassed === 'number' && isFinite(rj.gatesPassed)) ? ' (' + rj.gatesPassed + '/6 gates)' : '';
          if (vg === 'G4' || vg === 'G5'){
            push('engine', 'veto', 'engine veto @ ' + vg);
          } else if (vg === 'G2' || vg === 'G3'){
            /* G2/G3 only fire AFTER G1 committed a structure lean — even on
               legacy rows that never carried dir, the lean existed; name the
               non-confirmation, direction word when known, never a kill */
            push('engine', 'neutral',
                 (rdir ? 'engine lean ' + rdir.toUpperCase() + ' unconfirmed'
                       : 'engine momentum/positioning unconfirmed')
                 + ' — rejected @ ' + vg + gp,
                 { caution: true });
          } else {
            push('engine', 'neutral',
                 'engine: no committed structure — rejected @ ' + (vg || 'G1') + gp);
          }
          enHit = true; break;
        }
      }
    }
    if (!enHit) hush('engine', 'engine ran — this symbol was not gated (no survivor or rejection row)');
  }

  /* ---- OI FLOW / SMART classification ---- */
  if (!inp.oiflow || typeof inp.oiflow !== 'object'){ dark('oiflow', 'OI-flow layer returned no state — cold or failed'); }
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
    if (!ofHit) hush('oiflow', 'no OI-flow classification names this symbol');
  }

  /* ---- SQUEEZE ---- */
  if (!inp.squeeze || typeof inp.squeeze !== 'object'){ dark('squeeze', 'squeeze layer returned no state — cold or failed'); }
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
    if (!sqHit) hush('squeeze', 'no squeeze state names this symbol');
  }

  /* ---- TAPE — 24h momentum + participation (Binance 24h tickers map,
     {SYM:{chg24, turnoverUsd}}, app-wide cached — no extra fetch). Gives
     every Binance-overlapping candidate at least one possible evidence read;
     symbols with no Binance perp or a sub-threshold tape are silent, never
     dark. Past the extreme band the tape argues fade, not chase. ---- */
  if (!inp.tape || typeof inp.tape !== 'object'){
    if (inp.tape === undefined) dark('tape', 'no 24h ticker feed — binanceTickers24h unavailable or returned nothing');
    /* null = layer deliberately not applicable to this lane (gold) */
  }
  else{
    var tRow = null;
    for (var ak in aliasSet){
      if (!Object.prototype.hasOwnProperty.call(aliasSet, ak)) continue;
      if (inp.tape[ak] && typeof inp.tape[ak] === 'object'){ tRow = inp.tape[ak]; break; }
    }
    var tpHit = false;
    if (tRow){
      var tChg = +tRow.chg24, tVol = +tRow.turnoverUsd;
      if (isFinite(tChg) && isFinite(tVol) && tVol >= TAPE_MIN_VOL){
        var tPct = (tChg >= 0 ? '+' : '') + tChg.toFixed(1) + '%';
        var tVolTxt = ' · $' + (tVol >= 1e9 ? FMT(tVol / 1e9, 1) + 'B' : FMT(tVol / 1e6, 0) + 'M') + ' Binance turnover';
        if (Math.abs(tChg) >= TAPE_EXTREME){
          push('tape', 'neutral', 'tape ' + tPct + ' 24h — overextended, fade risk' + tVolTxt, { caution: true });
          tpHit = true;
        } else if (tChg >= TAPE_MIN_CHG){
          push('tape', 'long', 'tape ' + tPct + ' 24h — momentum with participation' + tVolTxt);
          tpHit = true;
        } else if (tChg <= -TAPE_MIN_CHG){
          push('tape', 'short', 'tape ' + tPct + ' 24h — sellers in control' + tVolTxt);
          tpHit = true;
        }
      }
    }
    if (!tpHit) hush('tape', 'no Binance perp overlap, or a sub-threshold 24h tape (needs |chg| >= 8% with >= $10M turnover)');
  }

  /* ---- LIQS flush-reversal (one market-wide setup; must name this symbol) ---- */
  if (inp.liq === undefined || inp.liq === null){
    if (inp.liq === undefined){ hush('liqs', 'no liquidation snapshot — stream-only layer cold (open LIQS once to start the socket)');
                                dark('liqs', 'no liquidation snapshot — stream-only layer cold (open LIQS once to start the socket)'); }
    else hush('liqs', 'liquidations live — no flush-reversal setup in the current window');
  }
  else if (typeof inp.liq === 'object'){
    var lf = inp.liq;
    if (isDir(lf.dir) && (!lf.sym || named(lf.sym)))
      push('liqs', lf.dir,
           'LIQS flush-reversal — ' + (lf.flushSide || '?') + ' flush'
           + (isFinite(lf.flushUsd) ? ' $' + FMT(lf.flushUsd / 1e6, 1) + 'M' : '')
           + ' · fade to ' + lf.dir.toUpperCase());
    else hush('liqs', 'a flush setup exists but does not name this symbol');
  }
  else hush('liqs', 'no liquidation setup state');

  /* trend4h is a POST-FETCH layer — ASIDE rows never earn a candle fetch, so
     their ledger says so plainly; WATCH-or-better rows get this note
     overwritten by applyTrend4h (vote / dark / silent-with-reason) */
  jot('trend4h', 'SILENT', 'awaiting the post-scan candle fetch — evaluated only for WATCH-or-better rows');

  return { sym: sym, lane: lane, votes: votes, unavailable: unavailable, silent: silent, notes: notes };
}

/* audit-note writer for post-collect stages (funding, trend4h, gate guards) —
   additive display metadata only, never touches votes/unavailable/silent */
function colNote(col, layer, status, text){
  try{
    if (!col || typeof col !== 'object') return;
    if (!col.notes || typeof col.notes !== 'object') col.notes = {};
    col.notes[layer] = { status: String(status || ''), text: String(text === null || text === undefined ? '' : text) };
  }catch(e){}
}

/* ---- FUNDING CONTRARIAN LAYER (one context vote, never a tier alone) ----
   |fundingPct| >= 0.1%/8h AGAINST the row's decided direction = the crowd is
   the fuel: a named contrarian vote ('funding -0.128%/8h — shorts crowded,
   fade fuel for longs'). SAME-direction extremes keep the radarGates caution
   chip and cast NO vote — never reward the crowded side. Sub-extreme prints
   and directionless rows: silent. Funding is NEVER dark, never caps a tier. */
function applyFunding(row){
  try{
    if (!row || row.lane !== 'crypto' || !row.dec || !row.col) return;
    var col = row.col;
    var fp = row.xu ? +row.xu.fundingPct : NaN;
    if (!isFinite(fp)){
      colNote(col, 'funding', 'SILENT', 'no funding print for this contract');
      return;
    }
    var pct = 'funding ' + (fp >= 0 ? '+' : '') + FMT(fp, 3) + '%/8h';
    if (Math.abs(fp) < GATE_FUNDING_ABS){
      colNote(col, 'funding', 'SILENT', pct + ' — inside the ±0.1%/8h band, no crowd edge');
      return;
    }
    var dir = row.dec.dir;
    if (!isDir(dir)){
      colNote(col, 'funding', 'SILENT', pct + ' — extreme, but the row has no direction to fade a crowd against');
      return;
    }
    var against = (dir === 'short' && fp > 0) || (dir === 'long' && fp < 0);
    if (against){
      var txt = pct + ' — ' + (fp > 0 ? 'longs crowded, fade fuel for shorts'
                                      : 'shorts crowded, fade fuel for longs');
      col.votes.push({ layer: 'funding', vote: dir, kind: 'context', text: txt });
      colNote(col, 'funding', dir.toUpperCase(), txt);
      /* re-decided through the same pure brainDecide — the vote agrees with the
         decided direction by construction, so the direction itself never flips */
      row.dec = brainDecide(col.votes, { unavailable: col.unavailable });
    }else{
      /* crowded WITH the row — the caution chip itself stays in radarGates */
      colNote(col, 'funding', 'CAUTION', pct + ' — crowded same-direction as the row — squeeze risk; caution only, never a reward vote');
    }
  }catch(e){}
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
RADAR QUALITY GATES — pure, post-decide (brainDecide itself is untouched).
One candidate row + the layer snapshot in; the gate verdict out. Applied in
judgeCrypto so BOTH scan modes inherit the gates; every input pass-through is
deliberate (null turnover, missing tape, non-finite funding = unknown, never
punished). Never throws — a gate failure degrades to no gate at all.
========================================================================= */
function radarGates(row, snap){
  var out = { demote: false, liquidity: false, overextended: false, reason: null, cautions: [],
              haircut: false, haircutReason: null };
  try{
    var dec = row && row.dec;
    if (!dec || !isDir(dec.dir)) return out;
    var rank = TIER_RANK[dec.tier];
    if (!(rank >= TIER_RANK.WATCH)) return out;   /* ASIDE rows need no gate */

    /* (1) LIQUIDITY FLOOR — known turnover below $5M demotes any WATCH+ tier.
       The first kill wins: one honest reason leads the row. */
    var to = row.turnoverUsd;
    if (typeof to === 'number' && isFinite(to) && to < GATE_MIN_TURNOVER){
      out.demote = true; out.liquidity = true;
      out.reason = 'below liquidity floor — $' + (to / 1e6).toFixed(1)
                 + 'M 24h turnover, slippage eats the edge';
      return out;
    }

    /* (2) OVEREXTENSION GUARD — the candidate's perp is on the tape and its
       24h move already ran >= +/-15% in the row's bias direction. WATCH radar
       demotes; PRIME/HIGH keeps its tier and takes a caution chip instead. */
    var tape = snap && snap.tape;
    if (tape && typeof tape === 'object'){
      var tRow = null;
      var aliasSet = {}; if (row.sym) aliasSet[row.sym] = 1;
      if (Array.isArray(row.aliases)){
        for (var a = 0; a < row.aliases.length; a++){
          if (typeof row.aliases[a] === 'string' && row.aliases[a]) aliasSet[row.aliases[a]] = 1;
        }
      }
      for (var k in aliasSet){
        if (!Object.prototype.hasOwnProperty.call(aliasSet, k)) continue;
        if (tape[k] && typeof tape[k] === 'object'){ tRow = tape[k]; break; }
      }
      if (tRow){
        var chg = +tRow.chg24;
        if (isFinite(chg) && ((dec.dir === 'long' && chg >= GATE_OVEREXT_CHG)
                           || (dec.dir === 'short' && chg <= -GATE_OVEREXT_CHG))){
          var oxReason = 'overextended ' + (chg >= 0 ? '+' : '') + chg.toFixed(1)
                       + '% 24h — chasing tops is how radar dies';
          if (rank === TIER_RANK.WATCH){
            out.demote = true; out.overextended = true; out.reason = oxReason;
            return out;
          }
          out.cautions.push(oxReason);   /* PRIME/HIGH: chip, tier stands */
        }
      }
    }

    /* (3) FUNDING CROWDING — |fundingPct| >= 0.1%/8h leaning the SAME way as
       the row's bias: caution chip, never a veto, tier unchanged. */
    var fp = row.xu && row.xu.fundingPct;
    if (typeof fp === 'number' && isFinite(fp) && Math.abs(fp) >= GATE_FUNDING_ABS
        && ((dec.dir === 'long' && fp > 0) || (dec.dir === 'short' && fp < 0))){
      out.cautions.push('funding crowded same-direction — squeeze risk');
    }

    /* (4) OFF-HOURS CONVICTION HAIRCUT — dead tape (Sunday / 01:00-06:30 IST,
       stamped by applySession as row.sessionDead) drops the tier ONE notch
       (PRIME->HIGH, HIGH->WATCH, WATCH->ASIDE). Thin books and worse fills
       mean the same layer agreement deserves less conviction. Runs last so a
       hard demote (liquidity/overextension) always wins. */
    if (row.sessionDead === true){
      out.haircut = true;
      out.haircutReason = 'off-hours tape (Sun / 01:00-06:30 IST) — conviction haircut: thin books, worse fills';
    }
  }catch(e){}
  return out;
}

/* OFF-HOURS CONVICTION HAIRCUT — applied per-row. Idempotent within one
   decide: dec.gatedFrom marks a tier that already took a gate/haircut, and
   the post-fetch re-decides (trend4h / mtf / volreg build fresh dec objects)
   get exactly ONE re-application via applySessionHaircut below. A liquidity/
   overextension demote (tier ASIDE, gatedFrom set) always wins. */
function sessionHaircut(row){
  try{
    if (!row || row.sessionDead !== true || !row.dec) return;
    if (row.dec.gatedFrom) return;
    if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) return;
    row.dec.gatedFrom = row.dec.tier;
    row.dec.tier = row.dec.tier === 'PRIME' ? 'HIGH' : (row.dec.tier === 'HIGH' ? 'WATCH' : 'ASIDE');
    row.dec.reasons.unshift('off-hours tape (Sun / 01:00-06:30 IST) — conviction haircut: thin books, worse fills');
    row.gated = 'session';
  }catch(e){}
}
/* pass over the judged rows after every re-decide stage — the haircut must
   survive promotions, so it is the LAST word on the tier, each time */
function applySessionHaircut(rows){
  try{
    if (!Array.isArray(rows)) return;
    for (var i = 0; i < rows.length; i++) sessionHaircut(rows[i]);
  }catch(e){}
}

/* stat-line honesty: the demotion tally, rendered only when gates bit */
function gateTally(liq, over){
  var n = liq + over;
  if (!n) return '';
  var parts = [];
  if (liq) parts.push(liq + ' liquidity');
  if (over) parts.push(over + ' overextended');
  return ' · ' + n + ' gated: ' + parts.join(' · ');
}

/* =========================================================================
Impure layer snapshot — every getter feature-checked, every call try-caught.
Returns plain data for brainCollect inputs + the market read. Never throws.
========================================================================= */
function snapshotLayers(){
  var o = { regime: undefined, rotation: undefined, onchain: undefined,
            engine: undefined, oiflow: undefined, squeeze: undefined,
            liqSnap: undefined, liqSetup: undefined, tape: undefined,
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

/* TAPE is an async app-wide cached feed (binanceTickers24h -> {SYM:{chg24,
   turnoverUsd}}) — snapshotLayers is sync by design, so the tape leg is
   filled post-snapshot under a hard 8s budget: a hung or failed feed
   degrades to unavailable('tape') — named dark — never a stalled scan.
   The legacy universe leg already fetches this same map: when uni carries a
   'ticks' key the result (map OR failure-null) is reused — the same feed is
   never paid for twice in one run. Combined mode has no ticks key -> fetch. */
async function fillTape(snap, uni){
  try{
    if (!snap || typeof snap !== 'object') return;
    if (uni && typeof uni === 'object' && ('ticks' in uni)){
      snap.tape = (uni.ticks && typeof uni.ticks === 'object') ? uni.ticks : undefined;
      return;
    }
    if (typeof G.binanceTickers24h !== 'function'){ snap.tape = undefined; return; }
    var t = await withTimeout(
      Promise.resolve().then(function(){ return G.binanceTickers24h(); }), 8000);
    snap.tape = (t && typeof t === 'object') ? t : undefined;
  }catch(e){ try{ snap.tape = undefined; }catch(e2){} }
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
   xuCandles itself reroutes short venue legs to Binance (its fallback
   contract) — rows may be Binance-sourced for thin venue listings. */
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

/* 1h rows for one candidate — same routes, same never-throws contract; the
   queue fetches this leg in parallel with the 4h leg for the MTF layer */
async function fetch1h(cand){
  try{
    if (cand.xu){
      if (typeof G.xuCandles === 'function'){
        var rx = await withTimeout(G.xuCandles(cand.xu, '1h', KLINES_1H));
        if (rx && rx.length) return rx;
      }
      return null;
    }
    if (typeof G.getCandles === 'function'){
      var rg = await withTimeout(G.getCandles(cand.sym, '1h', KLINES_1H));
      if (rg && rg.length) return rg;
    }
    if (typeof G.binanceKlines === 'function'){
      var rb = await withTimeout(G.binanceKlines(cand.sym, '1h', KLINES_1H));
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
      /* 4h + 1h legs in parallel per candidate: the 1h leg feeds the MTF
         layer and doubles as the sniper-rescue cache — one wall-clock cost */
      return Promise.all([
        fetch4h(crow).then(function(r4){ crow.rows4h = r4; },
                           function(){ crow.rows4h = null; }),
        fetch1h(crow).then(function(r1){ crow.rows1h = r1; },
                           function(){ crow.rows1h = null; }),
        fetchFunding(crow).then(function(fh){ crow.fundHist = fh; },
                               function(){ crow.fundHist = null; }),
        fetchBook(crow).then(function(bk){ crow.bookDepth = bk; },
                             function(){ crow.bookDepth = null; }),
        fetchTaker(crow).then(function(tk){ crow.taker = tk; },
                             function(){ crow.taker = null; })
      ]);
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
    tape: snap.tape, fng: snap.fng,
    liq: (snap.liqSetup === undefined ? undefined : snap.liqSetup)
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  var row = { sym: cand.sym, base: cand.base, exchange: cand.exchange,
           turnoverUsd: cand.turnoverUsd, xu: cand.xu, alsoOn: cand.alsoOn,
           aliases: cand.aliases, lane: 'crypto', col: col, dec: dec };
  /* funding contrarian layer — extreme funding AGAINST the decided direction
     becomes a named context vote before the quality gates evaluate the tier */
  applyFunding(row);
  applySession(row);
  dec = row.dec;
  /* radar quality gates — post-decide demotions + cautions (brainDecide stays
     pure). A demotion's reason LEADS the row's reasons so the ASIDE ledger
     names the kill; cautions land as GUARD chips on cards and as a named note
     on watch rows — nothing is silently dropped. */
  var g = radarGates(row, snap);
  if (g.demote){
    dec.gatedFrom = dec.tier;
    dec.tier = 'ASIDE';
    dec.reasons.unshift(g.reason);
    row.gated = g.liquidity ? 'liquidity' : 'overextended';
  }else if (g.haircut){
    sessionHaircut(row);   /* no-op when the tier is already gated */
  }
  if (g.cautions.length){
    row.cautions = (row.cautions || []).concat(g.cautions);
    for (var gc = 0; gc < g.cautions.length; gc++){
      col.votes.push({ layer: 'guard', vote: 'neutral', kind: 'context',
                       caution: true, text: g.cautions[gc] });
      colNote(col, 'guard', 'CAUTION', g.cautions[gc]);
      dec.reasons.push(g.cautions[gc]);
    }
  }
  return row;
}

function judgeGold(snap){
  var col = brainCollect({
    sym: 'XAU', lane: 'gold',
    news: newsFor('XAUUSDT'),
    tape: null, /* tape is the crypto 24h momentum read — not a gold-lane layer */
    gold: { setup: snap.goldSetup, deep: snap.goldDeep, basis: snap.goldBasis }
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  return { sym: 'XAU', base: 'XAU', exchange: null, turnoverUsd: null,
           xu: null, alsoOn: null, aliases: ['XAU', 'XAUUSDT'], lane: 'gold', col: col, dec: dec };
}

/* =========================================================================
TREND4H STRUCTURAL LAYER — evaluated AFTER the lazy candle-fetch stage on
rows that already carry rows4h. Pure candle math, never a fabricated read:
  EMA20 vs EMA50 alignment (standard EMA, SMA-seeded over the fetched closes)
  + the most recent confirmed swing-structure break (2-bar pivots: a higher
  second swing HIGH = higher-high, a lower second swing LOW = lower-low).
Both must agree with the row's bias -> a named structural vote is pushed and
the row is RE-DECIDED through the same pure brainDecide (tier bars unchanged:
PRIME still needs 5+ incl. structural + positioning, zero vetoes, news
clear). Candles missing/unfetchable/too short -> 'trend4h' is honestly dark
for that symbol (named in unavailable, the existing cap logic applies);
candles present but no agreement -> 'trend4h' silent, never dark.
========================================================================= */
function emaLast(rows, n){
  var closes = [];
  for (var i = 0; i < rows.length; i++){
    var c = +rows[i].c;
    if (isFinite(c)) closes.push(c);
  }
  if (closes.length < n) return NaN;
  var k = 2 / (n + 1), e = 0;
  for (var s = 0; s < n; s++) e += closes[s];
  e /= n;
  for (var j = n; j < closes.length; j++) e = closes[j] * k + e * (1 - k);
  return e;
}

/* confirmed 2-bar swing pivots: [value, index] ascending — the single scanner
   shared by the TREND4H structure read and the anchored-limit planner */
function pivotScan(rows){
  var hs = [], ls = [];
  for (var i = 2; i < rows.length - 2; i++){
    var h = +rows[i].h, l = +rows[i].l;
    var h1 = +rows[i-1].h, h2 = +rows[i-2].h, h3 = +rows[i+1].h, h4 = +rows[i+2].h;
    var l1 = +rows[i-1].l, l2 = +rows[i-2].l, l3 = +rows[i+1].l, l4 = +rows[i+2].l;
    if (isFinite(h) && isFinite(h1) && isFinite(h2) && isFinite(h3) && isFinite(h4)
        && h > h1 && h > h2 && h > h3 && h > h4) hs.push([h, i]);
    if (isFinite(l) && isFinite(l1) && isFinite(l2) && isFinite(l3) && isFinite(l4)
        && l < l1 && l < l2 && l < l3 && l < l4) ls.push([l, i]);
  }
  return { hs: hs, ls: ls };
}

/* confirmed 2-bar swing pivots; the most recent break wins a tie */
function structureOf(rows){
  var p = pivotScan(rows), hs = p.hs, ls = p.ls;
  var hh = hs.length >= 2 && hs[hs.length-1][0] > hs[hs.length-2][0];
  var ll = ls.length >= 2 && ls[ls.length-1][0] < ls[ls.length-2][0];
  if (hh && ll) return (hs[hs.length-1][1] >= ls[ls.length-1][1]) ? 'HH' : 'LL';
  if (hh) return 'HH';
  if (ll) return 'LL';
  return null;
}

/* -> {dir, text} when EMA alignment AND the structure break both agree on a
   direction, else null. Never throws. */
function trend4hAssess(rows){
  try{
    var e20 = emaLast(rows, 20), e50 = emaLast(rows, 50);
    if (!isFinite(e20) || !isFinite(e50) || e20 === e50) return null;
    var dir = e20 > e50 ? 'long' : 'short';
    var st = structureOf(rows);
    if (dir === 'long' && st !== 'HH') return null;
    if (dir === 'short' && st !== 'LL') return null;
    return { dir: dir,
             text: '4h EMA20' + (dir === 'long' ? '>' : '<') + 'EMA50 + '
                 + (dir === 'long' ? 'higher-high' : 'lower-low') + ' — structural ' + dir };
  }catch(e){ return null; }
}

/* post-fetch pass over the judged rows: WATCH-or-better crypto rows only
   (ASIDE rows never earned a fetch and are left untouched). Re-decides any
   row whose evidence changed so promotions land honestly. Never throws. */
function applyTrend4h(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!Array.isArray(row.rows4h) || row.rows4h.length < TREND4H_MIN_ROWS){
        /* candles missing / unfetchable / too thin — honestly dark */
        if (row.col.unavailable.indexOf('trend4h') === -1){
          row.col.unavailable.push('trend4h');
          colNote(row.col, 'trend4h', 'DARK',
            Array.isArray(row.rows4h)
              ? 'only ' + row.rows4h.length + ' 4h candles (< ' + TREND4H_MIN_ROWS + ') — too thin for an honest EMA50 seed'
              : 'no 4h candles returned — fetch failed, timed out, or the venue has no klines for this contract');
          row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
        }
        continue;
      }
      var t = trend4hAssess(row.rows4h);
      if (t && t.dir === row.dec.dir){
        row.col.votes.push({ layer: 'trend4h', vote: t.dir, kind: 'structural', text: t.text });
        colNote(row.col, 'trend4h', String(t.dir).toUpperCase(), t.text);
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else{
        row.col.silent.push('trend4h');   /* candles live, nothing to say for this direction */
        colNote(row.col, 'trend4h', 'SILENT',
          t && t.dir ? '4h structure reads ' + String(t.dir).toUpperCase() + ' — against the decided bias, no vote cast'
                     : '4h EMA20/EMA50 and swing structure show no clean trend break either way');
      }
    }
  }catch(e){}
}

/* =========================================================================
MTF ALIGN LAYER ('mtf', structural) — the conviction multiplier. A WATCH-or-
better row earns a STRUCTURAL vote only when ALL THREE timeframes agree with
the decided bias:
  1D leg  resampled from the fetched 4h candles (6 bars -> 1 day): swing
          structure (HH/LL) + close vs EMA9 side
  4H leg  the existing TREND4H read (EMA20/EMA50 + structure break)
  1H leg  the same read on the parallel-fetched 1h candles
3/3 agreement -> named structural vote, row re-decided (promotions land
through the same pure brainDecide). A 1D leg AGAINST the bias -> a named
CAUTION guard, never a silent kill. Anything else -> silent with the failing
legs named. A missing 1h leg is named, never dark-invented.
VOL REGIME LAYER ('volreg', context) — same pass, zero extra fetches: the
current ATR14's percentile rank over the fetched window. 30-80th pct =
'healthy trend vol' context vote; <20th = dead-tape CAUTION; >90th =
climax-vol CAUTION; transition bands stay silent.
SESSION LAYER ('session', context) — clock-only, negative-only by design:
off-hours tape (Sunday or 01:00-05:30 IST) earns a CAUTION guard (thin
liquidity, worse fills). It NEVER votes direction — a uniform free vote
would distort every tier at once. The current window also rides board
cards as a chip (kill-zone aware, same windows as the gold lane).
========================================================================= */
var MTF_MIN_ROWS = 60;
function resampleDaily(rows){
  var out = [];
  try{
    for (var i = 0; i + 6 <= rows.length; i += 6){
      var seg = rows.slice(i, i + 6), o = +seg[0].o, h = -Infinity, l = Infinity, c = +seg[5].c, v = 0, ok = true;
      for (var k = 0; k < 6; k++){
        var hk = +seg[k].h, lk = +seg[k].l;
        if (!isFinite(hk) || !isFinite(lk) || !isFinite(o) || !isFinite(c)){ ok = false; break; }
        if (hk > h) h = hk;
        if (lk < l) l = lk;
        v += +seg[k].v || 0;
      }
      if (ok) out.push({ t: seg[5].t, o: o, h: h, l: l, c: c, v: v });
    }
  }catch(e){}
  return out;
}
function dailySide(rows4h){
  try{
    var d = resampleDaily(rows4h);
    if (d.length < 10) return null;
    var st = structureOf(d), e9 = emaLast(d, 9), c = +d[d.length - 1].c;
    if (!isFinite(e9) || !isFinite(c)) return null;
    if (st === 'HH' && c > e9) return 'long';
    if (st === 'LL' && c < e9) return 'short';
    if (!st){
      /* monotonic trends print no 2-bar pullback pivots — fall back to the
         EMA9 side + slope, still nothing but the candles speaking */
      var e9prev = emaLast(d.slice(0, d.length - 3), 9);
      if (isFinite(e9prev) && c > e9 && e9 > e9prev) return 'long';
      if (isFinite(e9prev) && c < e9 && e9 < e9prev) return 'short';
    }
    return null;
  }catch(e){ return null; }
}
function applyMtf(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      if (!Array.isArray(row.rows4h) || row.rows4h.length < MTF_MIN_ROWS) continue;  /* trend4h owns the dark note */
      var d1 = dailySide(row.rows4h);
      var h4r = trend4hAssess(row.rows4h), h4 = h4r ? h4r.dir : null;
      var has1h = Array.isArray(row.rows1h) && row.rows1h.length >= MTF_MIN_ROWS;
      var h1r = has1h ? trend4hAssess(row.rows1h) : null, h1 = h1r ? h1r.dir : null;
      var dir = row.dec.dir;
      if (d1 === dir && h4 === dir && h1 === dir){
        row.col.votes.push({ layer: 'mtf', vote: dir, kind: 'structural',
          text: '1D+4H+1H all read ' + dir.toUpperCase() + ' — timeframe-aligned' });
        colNote(row.col, 'mtf', String(dir).toUpperCase(), '1D+4H+1H all read ' + dir.toUpperCase() + ' — timeframe-aligned');
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else if (d1 && d1 !== dir){
        var ctxt = '1D structure reads ' + String(d1).toUpperCase() + ' — against the ' + dir.toUpperCase() + ' bias, daily headwind';
        row.col.votes.push({ layer: 'mtf', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
        colNote(row.col, 'mtf', 'CAUTION', ctxt);
      }else{
        var misses = [];
        if (d1 !== dir) misses.push(d1 ? '1D reads ' + String(d1).toUpperCase() : '1D no clean structure');
        if (h4 !== dir) misses.push('4H not aligned');
        if (!has1h) misses.push('1h leg missing');
        else if (h1 !== dir) misses.push(h1 ? '1H reads ' + String(h1).toUpperCase() : '1H no clean break');
        row.col.silent.push('mtf');
        colNote(row.col, 'mtf', 'SILENT', 'not timeframe-aligned — ' + misses.join(' · '));
      }
    }
  }catch(e){}
}
/* ATR14 percentile rank of the latest value over the fetched window */
function atrPercentile(rows, p){
  try{
    if (!Array.isArray(rows) || rows.length < p * 3) return NaN;
    var series = [];
    for (var end = p + 1; end <= rows.length; end++){
      var a = atrLast(rows.slice(0, end), p);
      if (isFinite(a) && a > 0) series.push(a);
    }
    if (series.length < 10) return NaN;
    var cur = series[series.length - 1], less = 0, eq = 0;
    for (var i = 0; i < series.length; i++){
      if (series[i] < cur) less++;
      else if (series[i] === cur) eq++;
    }
    /* midrank: an all-equal (perfectly flat) series reads 50, not a fake 100 */
    return Math.round(((less + 0.5 * eq) / series.length) * 100);
  }catch(e){ return NaN; }
}
function applyVolreg(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      if (!Array.isArray(row.rows4h) || row.rows4h.length < MTF_MIN_ROWS) continue;
      var pct = atrPercentile(row.rows4h, 14), dir = row.dec.dir;
      if (!isFinite(pct)){
        row.col.silent.push('volreg');
        colNote(row.col, 'volreg', 'SILENT', 'ATR series too thin for an honest percentile');
        continue;
      }
      if (pct < 20){
        var dead = 'dead tape — ATR at the ' + pct + 'th percentile of its 20d range, trend entries starve in chop';
        row.col.votes.push({ layer: 'volreg', vote: 'neutral', kind: 'context', caution: true, text: dead });
        colNote(row.col, 'volreg', 'CAUTION', dead);
      }else if (pct > 90){
        var clim = 'climax volatility — ATR at the ' + pct + 'th percentile, late entries get wicked';
        row.col.votes.push({ layer: 'volreg', vote: 'neutral', kind: 'context', caution: true, text: clim });
        colNote(row.col, 'volreg', 'CAUTION', clim);
      }else if (pct >= 30 && pct <= 80){
        row.col.votes.push({ layer: 'volreg', vote: dir, kind: 'context',
          text: 'vol regime healthy — ATR ' + pct + 'th percentile of 20d, room to move without chaos' });
        colNote(row.col, 'volreg', String(dir).toUpperCase(), 'healthy trend vol — ATR ' + pct + 'th percentile');
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else{
        row.col.silent.push('volreg');
        colNote(row.col, 'volreg', 'SILENT', 'ATR ' + pct + 'th percentile — transition band, no edge claimed');
      }
    }
  }catch(e){}
}
/* =========================================================================
TIER-2/3 CONVICTION LAYERS — all free data, all honest degradation:
  FUNDZ ('fundz', context)   funding-rate Z-SCORE vs the symbol's own
    history (Binance /fapi/v1/fundingRate, ~30d). The absolute 0.1%/8h
    guard stays; this adds the RELATIVE read: z <= -2 behind a LONG (shorts
    crowded vs own history) votes the fade; z >= 2 behind it cautions the
    squeeze. SHORT mirrors. Endpoint absent/failed -> silent, never dark.
  BTCREL ('btcrel', context guard) BTC relative strength from the rows the
    scan already fetched (20-bar 4h return). Only speaks when BTC is TRENDING
    (|rB| >= 1%): BTC strong + alt LONG lagging >= 3% -> caution (tide
    against); alt LONG outperforming >= 5% -> RS-leader context vote (the
    APEX logic, wired in). BTC weak -> alt LONG caution, short note. Flat
    BTC -> silent everywhere. BTC row itself is the benchmark, never voted.
  DIV ('div', context)      regular RSI-14 divergence on the fetched 4h
    rows — the divergence tab's own gates (2 valid pivots, span >= 10 bars,
    newest <= 15 bars old). WITH the row's bias -> context vote; AGAINST ->
    caution; none -> silent.
  BOOK ('book', guard)      Binance top-20 depth imbalance (proxy for the
    same asset — deepest book in the world). LONG: asks >= 1.5x bids ->
    'book stacked against' caution; bids >= 1.5x asks -> supported note;
    total top-20 depth < $200k -> thin-book slippage caution. SHORT mirrors.
    Fetch failed / non-Binance listing -> silent.
========================================================================= */
function binanceSymFor(cand){
  try{
    var al = (cand && Array.isArray(cand.aliases)) ? cand.aliases : [];
    for (var i = 0; i < al.length; i++){
      if (/USDT$/.test(al[i]) && al[i].indexOf('-') === -1) return al[i];
    }
    if (cand && cand.base && /^[A-Z0-9]+$/.test(cand.base)) return cand.base + 'USDT';
  }catch(e){}
  return null;
}
async function fetchFunding(cand){
  try{
    if (typeof G.binanceFundingHist !== 'function') return null;
    var sym = binanceSymFor(cand);
    if (!sym) return null;
    var r = await withTimeout(G.binanceFundingHist(sym, 100), TUN.fetchMs);
    return (r && r.length) ? r : null;
  }catch(e){ return null; }
}
async function fetchBook(cand){
  try{
    if (typeof G.binanceDepth !== 'function') return null;
    var sym = binanceSymFor(cand);
    if (!sym) return null;
    var r = await withTimeout(G.binanceDepth(sym, 20), TUN.fetchMs);
    return (r && isFinite(+r.bidUsd) && isFinite(+r.askUsd)) ? r : null;
  }catch(e){ return null; }
}
/* taker buy/sell volume series for the CVD layer — same free endpoint the
   SMART $ tab uses, per candidate, cached by binance.js */
async function fetchTaker(cand){
  try{
    if (typeof G.binanceTakerRatio !== 'function') return null;
    var sym = binanceSymFor(cand);
    if (!sym) return null;
    var r = await withTimeout(G.binanceTakerRatio(sym, '1h', 25), TUN.fetchMs);
    return (r && Array.isArray(r.series) && r.series.length >= 8) ? r.series : null;
  }catch(e){ return null; }
}
function fundingZ(hist){
  try{
    if (!Array.isArray(hist) || hist.length < 10) return NaN;
    var n = hist.length, mean = 0, i;
    for (i = 0; i < n; i++) mean += +hist[i].rate;
    mean /= n;
    var v = 0;
    for (i = 0; i < n; i++){ var d = +hist[i].rate - mean; v += d * d; }
    var sd = Math.sqrt(v / n);
    if (!(sd > 0)) return NaN;
    return Math.round(((+hist[n - 1].rate - mean) / sd) * 100) / 100;
  }catch(e){ return NaN; }
}
function applyFundz(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      var z = fundingZ(row.fundHist), dir = row.dec.dir;
      if (!isFinite(z)){
        row.col.silent.push('fundz');
        colNote(row.col, 'fundz', 'SILENT', 'no funding history — z-score unread');
        continue;
      }
      var crowdLong = z >= 2, crowdShort = z <= -2;
      if ((dir === 'long' && crowdShort) || (dir === 'short' && crowdLong)){
        row.col.votes.push({ layer: 'fundz', vote: dir, kind: 'context',
          text: 'funding z ' + (z > 0 ? '+' : '') + z + ' — ' + (dir === 'long' ? 'shorts' : 'longs')
            + ' crowded vs own 30d history, fade fuel' });
        colNote(row.col, 'fundz', String(dir).toUpperCase(),
          'z ' + (z > 0 ? '+' : '') + z + ' vs own history — crowd on the other side');
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else if ((dir === 'long' && crowdLong) || (dir === 'short' && crowdShort)){
        var ctxt = 'funding z ' + (z > 0 ? '+' : '') + z + ' — ' + (dir === 'long' ? 'longs' : 'shorts')
          + ' crowded vs own 30d history, squeeze risk';
        row.col.votes.push({ layer: 'fundz', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
        colNote(row.col, 'fundz', 'CAUTION', ctxt);
      }else{
        row.col.silent.push('fundz');
        colNote(row.col, 'fundz', 'SILENT', 'z ' + (z > 0 ? '+' : '') + z + ' inside ±2 — no crowd extreme');
      }
    }
  }catch(e){}
}
function ret20(rows){
  try{
    var n = rows.length;
    if (n < 22) return NaN;
    var a = +rows[n - 21].c, b = +rows[n - 1].c;
    if (!isFinite(a) || !isFinite(b) || a <= 0) return NaN;
    return ((b - a) / a) * 100;
  }catch(e){ return NaN; }
}
function applyBtcrel(rows){
  try{
    var btc = null, i;
    for (i = 0; i < rows.length; i++){
      if (rows[i] && rows[i].base === 'BTC'){ btc = rows[i]; break; }
    }
    if (!btc || !Array.isArray(btc.rows4h)) return;
    var rB = ret20(btc.rows4h);
    if (!isFinite(rB) || Math.abs(rB) < 1) return;   /* flat BTC: no tide to read */
    var btcUp = rB > 0;
    for (i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir || row.base === 'BTC') continue;
      if (!Array.isArray(row.rows4h)) continue;
      var rA = ret20(row.rows4h);
      if (!isFinite(rA)) continue;
      var spread = rB - rA, dir = row.dec.dir;
      if (dir === 'long'){
        if (btcUp && spread >= 3){
          var ctxt = 'BTC +' + FMT(rB, 1) + '% vs ' + FMT(rA, 1) + '% over 80h — alts bleed against a strong BTC, longs fight the tide';
          row.col.votes.push({ layer: 'btcrel', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
          colNote(row.col, 'btcrel', 'CAUTION', ctxt);
        }else if (spread <= -5){
          row.col.votes.push({ layer: 'btcrel', vote: 'long', kind: 'context',
            text: 'outperforming BTC by ' + FMT(-spread, 1) + '% over 80h — relative-strength leader' });
          colNote(row.col, 'btcrel', 'LONG', 'RS leader — +' + FMT(-spread, 1) + '% vs BTC over 80h');
          row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
        }else{
          row.col.silent.push('btcrel');
          colNote(row.col, 'btcrel', 'SILENT', 'BTC ' + (btcUp ? '+' : '') + FMT(rB, 1) + '%, spread ' + FMT(spread, 1) + '% — no tide edge');
        }
      }else{
        if (!btcUp && -spread >= 3){
          var ctxt2 = 'BTC ' + FMT(rB, 1) + '% — falling tide lifts shorts, but ' + FMT(rA, 1) + '% own move means the easy part is done';
          colNote(row.col, 'btcrel', 'NEUTRAL', ctxt2);
        }else{
          row.col.silent.push('btcrel');
          colNote(row.col, 'btcrel', 'SILENT', 'BTC ' + (btcUp ? '+' : '') + FMT(rB, 1) + '%, spread ' + FMT(spread, 1) + '% — no tide edge');
        }
      }
    }
  }catch(e){}
}
function rsiSeries(closes, p){
  try{
    if (closes.length < p + 1) return null;
    var gains = 0, losses = 0, out = new Array(closes.length).fill(null), i;
    for (i = 1; i <= p; i++){
      var d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    var ag = gains / p, al = losses / p;
    out[p] = (al === 0) ? 100 : 100 - 100 / (1 + ag / al);
    for (i = p + 1; i < closes.length; i++){
      var d2 = closes[i] - closes[i - 1];
      ag = (ag * (p - 1) + (d2 > 0 ? d2 : 0)) / p;
      al = (al * (p - 1) + (d2 < 0 ? -d2 : 0)) / p;
      out[i] = (al === 0) ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }catch(e){ return null; }
}
function rsiDivergence(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 40) return null;
    var closes = [];
    for (var i = 0; i < rows.length; i++) closes.push(+rows[i].c);
    var rsi = rsiSeries(closes, 14);
    if (!rsi) return null;
    var piv = pivotScan(rows), n = rows.length;
    function divFor(pivots, isHigh){
      if (pivots.length < 2) return null;
      var p2 = pivots[pivots.length - 1], p1 = pivots[pivots.length - 2];
      var span = p2[1] - p1[1];
      if (span < 10) return null;
      if ((n - 1 - p2[1]) > 15) return null;
      var r1 = rsi[p1[1]], r2 = rsi[p2[1]];
      if (!isFinite(r1) || !isFinite(r2)) return null;
      if (isHigh && p2[0] > p1[0] && r2 < r1)
        return { dir: 'short', text: 'price HH + RSI LH over ' + span + ' bars — bearish regular divergence' };
      if (!isHigh && p2[0] < p1[0] && r2 > r1)
        return { dir: 'long', text: 'price LL + RSI HL over ' + span + ' bars — bullish regular divergence' };
      return null;
    }
    return divFor(piv.hs, true) || divFor(piv.ls, false);
  }catch(e){ return null; }
}
function applyDiv(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      if (!Array.isArray(row.rows4h) || row.rows4h.length < 40) continue;
      var d = rsiDivergence(row.rows4h), dir = row.dec.dir;
      if (d && d.dir === dir){
        row.col.votes.push({ layer: 'div', vote: dir, kind: 'context', text: d.text + ' on 4H' });
        colNote(row.col, 'div', String(dir).toUpperCase(), d.text);
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else if (d){
        var ctxt = d.text + ' — AGAINST the ' + dir.toUpperCase() + ' bias, momentum disagreement';
        row.col.votes.push({ layer: 'div', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
        colNote(row.col, 'div', 'CAUTION', ctxt);
      }else{
        row.col.silent.push('div');
        colNote(row.col, 'div', 'SILENT', 'no qualifying regular divergence (pivot/span/freshness gates)');
      }
    }
  }catch(e){}
}
function applyBook(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      var bk = row.bookDepth;
      if (!bk || !(+bk.bidUsd >= 0) || !(+bk.askUsd >= 0)){
        row.col.silent.push('book');
        colNote(row.col, 'book', 'SILENT', 'no Binance depth for this asset — book unread');
        continue;
      }
      var tot = +bk.bidUsd + +bk.askUsd, dir = row.dec.dir;
      if (tot < 200000){
        var thin = 'thin book — $' + FMT(tot / 1000, 0) + 'k top-20 depth, slippage on the limit fill (Binance proxy)';
        row.col.votes.push({ layer: 'book', vote: 'neutral', kind: 'context', caution: true, text: thin });
        colNote(row.col, 'book', 'CAUTION', thin);
        continue;
      }
      var ratio = (+bk.askUsd > 0) ? (+bk.bidUsd) / (+bk.askUsd) : 99;
      var against = (dir === 'long' && ratio <= 0.67) || (dir === 'short' && ratio >= 1.5);
      var supported = (dir === 'long' && ratio >= 1.5) || (dir === 'short' && ratio <= 0.67);
      if (against){
        var ctxt = 'book stacked against — ' + (dir === 'long' ? 'asks' : 'bids') + ' '
          + FMT(dir === 'long' ? 1 / ratio : ratio, 1) + 'x ' + (dir === 'long' ? 'bids' : 'asks')
          + ' (Binance proxy) — the pullback may overshoot the limit';
        row.col.votes.push({ layer: 'book', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
        colNote(row.col, 'book', 'CAUTION', ctxt);
      }else if (supported){
        colNote(row.col, 'book', 'NEUTRAL', 'book supported — ' + (dir === 'long' ? 'bids' : 'asks')
          + ' ' + FMT(dir === 'long' ? ratio : 1 / ratio, 1) + 'x ' + (dir === 'long' ? 'asks' : 'bids') + ' (Binance proxy)');
      }else{
        row.col.silent.push('book');
        colNote(row.col, 'book', 'SILENT', 'book balanced at ' + FMT(ratio, 2) + ' bid/ask — no edge claimed');
      }
    }
  }catch(e){}
}

/* CVD LAYER ('cvd', context) — cumulative volume delta from Binance's free
   taker buy/sell endpoint (the SMART $ tab's own feed). Recent 8-period
   mean ratio vs the prior 8: flow WITH the row's bias votes, flow AGAINST
   cautions — a setup fighting its own order flow is a stop-out candidate. */
function cvdAssess(series){
  try{
    if (!Array.isArray(series) || series.length < 16) return null;
    var n = series.length, recent = 0, prior = 0, i, c = 0;
    for (i = n - 8; i < n; i++){ recent += +series[i].buySellRatio || 0; c++; }
    recent /= c || 1;
    for (i = n - 16; i < n - 8; i++){ prior += +series[i].buySellRatio || 0; }
    prior /= 8;
    if (!(prior > 0) || !(recent > 0)) return null;
    if (recent >= 1.05 && recent >= prior - 0.05) return { dir: 'long', ratio: recent };
    if (recent <= 0.95 && recent <= prior + 0.05) return { dir: 'short', ratio: recent };
    return { dir: null, ratio: recent };
  }catch(e){ return null; }
}
function applyCvd(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col) continue;
      if (!(TIER_RANK[row.dec.tier] >= TIER_RANK.WATCH)) continue;
      if (!row.dec.dir) continue;
      var a = row.taker ? cvdAssess(row.taker) : null, dir = row.dec.dir;
      if (!a){
        row.col.silent.push('cvd');
        colNote(row.col, 'cvd', 'SILENT', 'no taker-flow series for this asset — CVD unread');
        continue;
      }
      if (a.dir === dir){
        row.col.votes.push({ layer: 'cvd', vote: dir, kind: 'context',
          text: 'CVD confirms — taker buy/sell ' + FMT(a.ratio, 2) + ' and ' + (dir === 'long' ? 'buyers' : 'sellers') + ' in control' });
        colNote(row.col, 'cvd', String(dir).toUpperCase(), 'flow with the bias — ratio ' + FMT(a.ratio, 2));
        row.dec = brainDecide(row.col.votes, { unavailable: row.col.unavailable });
      }else if (a.dir && a.dir !== dir){
        var ctxt = 'CVD against — taker buy/sell ' + FMT(a.ratio, 2) + ' shows '
          + (a.dir === 'long' ? 'buyers' : 'sellers') + ' in control against the ' + dir.toUpperCase()
          + ' bias — a setup fighting its own order flow is a stop-out candidate';
        row.col.votes.push({ layer: 'cvd', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
        colNote(row.col, 'cvd', 'CAUTION', ctxt);
      }else{
        row.col.silent.push('cvd');
        colNote(row.col, 'cvd', 'SILENT', 'flow balanced at ' + FMT(a.ratio, 2) + ' — no CVD edge');
      }
    }
  }catch(e){}
}

/* =========================================================================
LIQPOOL MAGNET GUARD ('liqpool', context) — the stop-hunt read. Runs AFTER
planning (it needs the plan's stop/T1) on the row's own 4h candles via
indicators.js findLiquidityPools (equal highs/lows — the pools SMC traders
actually mean; the liquidation stream carries no price levels, never
fabricated). Two honest reads, never a vote on direction:
  CAUTION   the row's STOP sits within 0.5xATR of the opposing pool
            (equal lows under a long stop / equal highs over a short one)
            — classic stop-run territory, expect a wick through
  NEUTRAL   the pool sits at T1 instead — the target IS the magnet
Absent module -> DARK note; no pool in band -> SILENT. Never throws.
========================================================================= */
function liqpoolNote(row){
  try{
    var p = row && row.plan;
    if (!p || !(+p.entry > 0) || !(+p.stop > 0) || +p.entry === +p.stop) return null;
    if (typeof G.findLiquidityPools !== 'function') return 'dark';
    var rows = (row.rows4h && row.rows4h.length >= 30) ? row.rows4h
             : (Array.isArray(row.rows) && row.rows.length >= 30) ? row.rows : null;
    if (!rows) return null;
    var lp = G.findLiquidityPools(rows);
    if (!lp) return null;
    var atr = boardAtrFor(row);
    if (!isFinite(atr) || atr <= 0) return null;
    var long = row.dec.dir === 'long', out = [];
    var stopPool = long ? lp.sellSide : lp.buySide;
    if (stopPool && isFinite(+stopPool.level)
        && Math.abs(+stopPool.level - (+p.stop)) <= 0.5 * atr){
      out.push({ kind: 'caution',
        text: 'stop sits inside the ' + (long ? 'sell-side' : 'buy-side') + ' pool at '
          + PX(+stopPool.level) + ' (' + (+stopPool.count || 2) + ' equal ' + (long ? 'lows' : 'highs')
          + ') — stop-run territory, expect a wick through' });
    }
    var t1Pool = long ? lp.buySide : lp.sellSide;
    if (t1Pool && isFinite(+t1Pool.level) && isFinite(+p.t1)
        && Math.abs(+t1Pool.level - (+p.t1)) <= 0.5 * atr){
      out.push({ kind: 'note',
        text: (long ? 'buy-side' : 'sell-side') + ' pool at ' + PX(+t1Pool.level)
          + ' sits at T1 — the target IS the magnet' });
    }
    return out.length ? out : null;
  }catch(e){ return null; }
}
function applyLiqpool(rows){
  try{
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || !row.col || !row.plan) continue;
      var ns = liqpoolNote(row);
      if (ns === 'dark'){
        colNote(row.col, 'liqpool', 'DARK', 'findLiquidityPools module absent — pool guard sits out');
        continue;
      }
      if (!ns){
        colNote(row.col, 'liqpool', 'SILENT', 'no equal-highs/lows pool within 0.5xATR of the plan levels');
        continue;
      }
      for (var k = 0; k < ns.length; k++){
        if (ns[k].kind === 'caution'){
          row.col.votes.push({ layer: 'liqpool', vote: 'neutral', kind: 'context', caution: true, text: ns[k].text });
          colNote(row.col, 'liqpool', 'CAUTION', ns[k].text);
        }else{
          colNote(row.col, 'liqpool', 'NEUTRAL', ns[k].text);
        }
      }
    }
  }catch(e){}
}

/* session window (IST, gold-lane kill zones). now injectable for tests. */
function sessionWindow(now){
  try{
    if (now === undefined && __sessionNowOverride !== null && __sessionNowOverride !== undefined)
      now = __sessionNowOverride;   /* test seam: deterministic clock */
    var d = now ? new Date(now) : new Date();
    var ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
    var mins = ist.getHours() * 60 + ist.getMinutes(), day = ist.getDay();
    var london = mins >= 750 && mins <= 930;    /* 12:30-15:30 IST */
    var ny = mins >= 1050 && mins <= 1230;      /* 17:30-20:30 IST */
    var dead = (day === 0) || (mins >= 60 && mins <= 390);  /* Sunday or 01:00-06:30 IST */
    return { dead: dead, london: london, ny: ny,
             label: dead ? 'off-hours (Sun/late-night IST)'
                  : london ? 'London kill zone'
                  : ny ? 'NY kill zone' : 'mid-session' };
  }catch(e){ return { dead: false, london: false, ny: false, label: '—' }; }
}
function applySession(row){
  try{
    var sw = sessionWindow();
    row.session = sw.label;
    row.sessionDead = sw.dead === true;
    if (sw.dead){
      var ctxt = 'off-hours tape (Sun / 01:00-06:30 IST) — thin liquidity, worse fills';
      row.col.votes.push({ layer: 'session', vote: 'neutral', kind: 'context', caution: true, text: ctxt });
      colNote(row.col, 'session', 'CAUTION', ctxt);
      row.cautions = (row.cautions || []).concat([ctxt]);
    }else{
      colNote(row.col, 'session', 'NEUTRAL', sw.label + (sw.london || sw.ny ? ' — prime liquidity window' : ''));
    }
  }catch(e){}
}

/* =========================================================================
STRUCTURE-ANCHORED LIMIT ENTRY PLANS — a WATCH-or-better row with fetched 4h
Pure rows4h math, never a fabricated level:
  ATR14(4h)   Wilder-smoothed, SMA-seeded — the terminal's own convention.
  ANCHORS     LONG: the HIGHEST of {last confirmed swing-low zone top,
              EMA20(4h), EMA50(4h), nearest untouched bullish FVG top,
              unmitigated 4h order block top, sell-side equal-lows pool,
              AVWAP from the last swing low} that sits BELOW the mark
              0.25-1.5 x ATR away; SHORT mirrors with swing-high zone / EMAs /
              nearest untouched bearish FVG bottom / OB bottom / buy-side
              equal-highs pool / AVWAP from the last swing high.
              "Untouched" = no later candle traded into the gap at all.
              OB/pool/AVWAP come from indicators.js / indicators2.js through
              typeof feature-checks — an absent module = the family sits out.
  STOP        0.5 x ATR beyond the structure (zone far edge / EMA line).
  TP1/TP2     snapped to opposing 4h pivots where they exist (nearest opposing
              pivot = TP1, the one beyond = TP2), else the raw 1.5R/2.5R
              multiples; a snapped TP1 under the 1.5R minimum DECLINES the
              anchored plan -> the caller's gate-engine fallback, reason named.
  IN-ZONE     mark already inside the anchor zone -> entry at the far zone
              edge, honestly labeled 'price in zone'.
Returns {plan, note} — plan null + an honest note when no anchor qualifies;
null + '' when the candles themselves are unreadable (silent legacy fallback).
Never throws.
========================================================================= */
/* ATR14 last value — Wilder smoothing, SMA seed (indicators.js convention) */
function atrLast(rows, p){
  try{
    var n = rows.length;
    if (n < p + 1) return NaN;
    var a = null;
    for (var i = 1; i < n; i++){
      var h = +rows[i].h, l = +rows[i].l, pc = +rows[i-1].c;
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) return NaN;
      var tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      if (a === null){
        if (i >= p){
          var s = 0;
          for (var k = i - p + 1; k <= i; k++){
            var h2 = +rows[k].h, l2 = +rows[k].l, pc2 = +rows[k-1].c;
            s += Math.max(h2 - l2, Math.abs(h2 - pc2), Math.abs(l2 - pc2));
          }
          a = s / p;
        }
      }else a = (a * (p - 1) + tr) / p;
    }
    return (a !== null && isFinite(a) && a > 0) ? a : NaN;
  }catch(e){ return NaN; }
}

/* =========================================================================
WICK-ADAPTIVE STOP BUFFER — the stop distance comes from the symbol's OWN
wick distribution, not a flat constant. For each side we measure the
adverse wick/ATR ratios over the recent 60 bars (lower wicks for longs,
upper for shorts), take the 80th percentile, and clamp it into
[ANCHOR_STOP_ATR, 1.5]. Calm symbols keep the 0.75 floor; high-wick
symbols get the buffer their own tape demands. Named on the plan
(stopBuf), never silent.
========================================================================= */
function pctile(arr, p){
  try{
    if (!Array.isArray(arr) || !arr.length) return NaN;
    var a = arr.slice().sort(function(x, y){ return x - y; });
    var i = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
    return a[i];
  }catch(e){ return NaN; }
}
function wickBuffer(rows, atr, long){
  try{
    if (!Array.isArray(rows) || rows.length < 30 || !isFinite(atr) || atr <= 0) return ANCHOR_STOP_ATR;
    var ratios = [];
    for (var i = Math.max(1, rows.length - 60); i < rows.length; i++){
      var o = +rows[i].o, h = +rows[i].h, l = +rows[i].l, c = +rows[i].c;
      if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
      var wick = long ? (Math.min(o, c) - l) : (h - Math.max(o, c));   /* the side's adverse wick */
      if (wick > 0) ratios.push(wick / atr);
    }
    if (ratios.length < 20) return ANCHOR_STOP_ATR;
    var p80 = pctile(ratios, 80);
    if (!isFinite(p80)) return ANCHOR_STOP_ATR;
    return Math.max(ANCHOR_STOP_ATR, Math.min(1.5, Math.round(p80 * 100) / 100));
  }catch(e){ return ANCHOR_STOP_ATR; }
}

/* the four anchor candidates for one direction — zones carry {lo, hi, zone},
   lines carry {level}; never invented, all straight off the candles.
   tf is a LABEL only ('4h' default, '1h' for the sniper rescue) — the math
   is identical on any candle set; names must say which timeframe fed them */
function anchorCandidates(rows, dir, piv, tf){
  tf = (tf === '1h') ? '1h' : '4h';
  var out = [], n = rows.length, long = (dir === 'long');
  /* 1) last confirmed swing pivot zone — LONG: zone = [pivot low, higher of
        the two confirmation-bar lows]; SHORT mirrors around the pivot high */
  var pivs = long ? piv.ls : piv.hs;
  if (pivs.length){
    var pv = pivs[pivs.length - 1], pi = pv[1];
    var n1 = long ? +rows[pi-1].l : +rows[pi-1].h;
    var n2 = long ? +rows[pi+1].l : +rows[pi+1].h;
    if (isFinite(n1) && isFinite(n2)){
      out.push({ name: long ? 'swing-low zone' : 'swing-high zone', zone: true,
                 lo: long ? pv[0] : Math.min(n1, n2),
                 hi: long ? Math.max(n1, n2) : pv[0] });
    }
  }
  /* 2/3) the EMA lines */
  var e20 = emaLast(rows, 20), e50 = emaLast(rows, 50);
  if (isFinite(e20)) out.push({ name: 'EMA20(' + tf + ')', zone: false, level: e20 });
  if (isFinite(e50)) out.push({ name: 'EMA50(' + tf + ')', zone: false, level: e50 });
  /* 4) nearest UNTOUCHED 4h FVG/imbalance — LONG: bullish gap [h[i-1], l[i+1]]
        below the mark; SHORT: bearish gap [h[i+1], l[i-1]] above. A later
        candle trading into the gap (partial fill included) mitigates it. */
  for (var i = n - 3; i >= 2; i--){
    var hA = +rows[i-1].h, lA = +rows[i-1].l;
    var hB = +rows[i+1].h, lB = +rows[i+1].l;
    if (!isFinite(hA) || !isFinite(lA) || !isFinite(hB) || !isFinite(lB)) continue;
    var glo = long ? hA : hB, ghi = long ? lB : lA;
    if (ghi <= glo) continue;   /* no imbalance at this bar */
    var touched = false;
    for (var j = i + 2; j < n; j++){
      var x = long ? +rows[j].l : +rows[j].h;
      if (isFinite(x) && (long ? x <= ghi : x >= glo)){ touched = true; break; }
    }
    if (!touched){
      out.push({ name: tf + ' FVG', zone: true, lo: glo, hi: ghi });
      break;   /* nearest = most recent only */
    }
  }
  /* 5) unmitigated ORDER BLOCK zone (indicators.js, feature-checked — absent
        module = the family simply sits out, never fabricated). LONG: the
        bullish OB below the mark, entry at the zone top; SHORT mirrors at
        the zone bottom. */
  try{
    if (typeof G.findOrderBlock === 'function'){
      var ob = G.findOrderBlock(rows, dir);
      if (ob && isFinite(+ob.top) && isFinite(+ob.bottom) && +ob.top > +ob.bottom){
        out.push({ name: long ? tf + ' order block top' : tf + ' order block bottom',
                   zone: true, lo: +ob.bottom, hi: +ob.top });
      }
    }
  }catch(e){}
  /* 6) equal-highs/lows LIQUIDITY POOL (indicators.js, feature-checked).
        LONG: the sell-side equal-lows cluster below the mark; SHORT: the
        buy-side equal-highs cluster above. A line anchor at the pool level. */
  try{
    if (typeof G.findLiquidityPools === 'function'){
      var lp = G.findLiquidityPools(rows);
      var pool = lp ? (long ? lp.sellSide : lp.buySide) : null;
      if (pool && isFinite(+pool.level) && +pool.level > 0){
        out.push({ name: long ? 'sell-side equal-lows pool' : 'buy-side equal-highs pool',
                   zone: false, level: +pool.level });
      }
    }
  }catch(e){}
  /* 7) ANCHORED VWAP (indicators2.js, feature-checked) from the last
        confirmed same-direction swing pivot — a real volume-weighted level
        off the candles, never a fitted line. */
  try{
    if (typeof G.hgAVWAP === 'function'){
      var apiv = long ? piv.ls : piv.hs;
      if (apiv.length){
        var av = G.hgAVWAP(rows, apiv[apiv.length - 1][1]);
        if (av && isFinite(+av.value) && +av.value > 0){
          out.push({ name: long ? 'AVWAP from the last swing low' : 'AVWAP from the last swing high',
                     zone: false, level: +av.value });
        }
      }
    }
  }catch(e){}
  return out;
}

/* pick the anchor: an in-zone mark wins outright (price is AT structure);
   otherwise the highest in-band level for LONG / lowest for SHORT */
function pickAnchor(dir, cands, mark, atr){
  var long = (dir === 'long');
  var bandLo = ANCHOR_BAND_MIN * atr, bandHi = ANCHOR_BAND_MAX * atr;
  var inz = null, i, c;
  for (i = 0; i < cands.length; i++){
    c = cands[i];
    if (!c.zone) continue;
    if (mark >= c.lo && mark <= c.hi){
      if (!inz || (long ? c.hi > inz.hi : c.lo < inz.lo)) inz = c;
    }
  }
  if (inz) return { anchor: inz, inZone: true };
  var best = null;
  for (i = 0; i < cands.length; i++){
    c = cands[i];
    var lvl = c.zone ? (long ? c.hi : c.lo) : c.level;
    if (!isFinite(lvl)) continue;
    var d = long ? (mark - lvl) : (lvl - mark);
    if (d < bandLo || d > bandHi) continue;
    if (!best || (long ? lvl > best.lvl : lvl < best.lvl)) best = { anchor: c, lvl: lvl };
  }
  return best ? { anchor: best.anchor, inZone: false } : null;
}

function anchoredLimitPlan(dir, rows, tf){
  tf = (tf === '1h') ? '1h' : '4h';   /* label only — identical math either way */
  try{
    if (!isDir(dir) || !Array.isArray(rows)) return { plan: null, note: '' };
    if (rows.length < ANCHOR_MIN_ROWS)
      return { plan: null, note: tf + ' history too thin for a structure anchor — gate-engine levels' };
    var long = (dir === 'long');
    var mark = +rows[rows.length - 1].c;
    var atr = atrLast(rows, 14);
    if (!isFinite(mark) || mark <= 0 || !isFinite(atr) || atr <= 0)
      return { plan: null, note: '' };   /* unreadable candles — silent legacy fallback */
    var piv = pivotScan(rows);
    var pick = pickAnchor(dir, anchorCandidates(rows, dir, piv, tf), mark, atr);
    if (!pick) return { plan: null, note: 'no nearby ' + tf + ' structure — gate-engine levels' };
    var a = pick.anchor, entry, structEdge;
    if (pick.inZone){
      entry = long ? a.lo : a.hi;        /* limit at the far zone edge */
      structEdge = entry;
    }else{
      entry = a.zone ? (long ? a.hi : a.lo) : a.level;
      structEdge = a.zone ? (long ? a.lo : a.hi) : a.level;
    }
    var buf = wickBuffer(rows, atr, long);
    var stop = long ? structEdge - buf * atr
                    : structEdge + buf * atr;
    /* pool-aware stop: if the opposing liquidity pool (equal lows under a
       long / equal highs over a short) sits just BEYOND the computed stop,
       the stop is stop-run bait — push it 0.25xATR past the pool instead of
       leaving it where the hunt goes. Named in the note, never silent. */
    var poolNote = '';
    try{
      if (typeof G.findLiquidityPools === 'function'){
        var lp2 = G.findLiquidityPools(rows);
        var opp2 = lp2 ? (long ? lp2.sellSide : lp2.buySide) : null;
        if (opp2 && isFinite(+opp2.level) && +opp2.level > 0){
          var beyond = long ? (stop - +opp2.level) : (+opp2.level - stop);
          if (beyond > 0 && beyond <= 1.0 * atr){
            stop = long ? +opp2.level - 0.25 * atr : +opp2.level + 0.25 * atr;
            poolNote = ' · stop widened past the ' + (long ? 'sell-side' : 'buy-side')
              + ' pool at ' + PX(+opp2.level) + ' (stop-run territory)';
          }
        }
      }
    }catch(e){}
    var risk = long ? entry - stop : stop - entry;
    if (!(risk > 0)) return { plan: null, note: '' };
    var cancelIf = structEdge;   /* a 4h close beyond the structure kills the limit */
    /* TP1 snaps to the nearest opposing pivot; TP2 to the one beyond it */
    var opp = long ? piv.hs : piv.ls, t1v = NaN, o, v;
    for (o = 0; o < opp.length; o++){
      v = opp[o][0];
      if (long ? (v > entry && (!isFinite(t1v) || v < t1v))
               : (v < entry && (!isFinite(t1v) || v > t1v))) t1v = v;
    }
    var t1, t2;
    if (isFinite(t1v)){
      var rr1 = Math.abs(t1v - entry) / risk;
      if (rr1 < PLAN_MIN_RR1)
        return { plan: null, note: 'anchored limit R:R ' + FMT(rr1, 1)
          + ' below the 1.5 minimum — gate-engine levels' };
      t1 = t1v;
      var t2v = NaN;
      for (o = 0; o < opp.length; o++){
        v = opp[o][0];
        if (long ? (v > t1 && (!isFinite(t2v) || v < t2v))
                 : (v < t1 && (!isFinite(t2v) || v > t2v))) t2v = v;
      }
      t2 = isFinite(t2v) ? t2v : (long ? entry + PLAN_TP2_R * risk : entry - PLAN_TP2_R * risk);
    }else{
      t1 = long ? entry + PLAN_TP1_R * risk : entry - PLAN_TP1_R * risk;
      t2 = long ? entry + PLAN_TP2_R * risk : entry - PLAN_TP2_R * risk;
    }
    var anchorNote = pick.inZone
      ? 'mark inside ' + a.name + ' ' + PX(a.lo) + '–' + PX(a.hi) + ' — limit at the zone edge'
      : a.name + ' ' + PX(entry)
        + (a.zone ? ' (zone ' + PX(a.lo) + '–' + PX(a.hi) + ')' : '')
        + ' · ' + FMT((long ? mark - entry : entry - mark) / atr, 2) + '×ATR '
        + (long ? 'below' : 'above') + ' mark';
    var plan = normalizePlan({
      dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, type: 'ANCHOR4H',
      entryType: pick.inZone ? 'zone' : 'limit',
      anchorName: a.name, anchorNote: anchorNote + poolNote, cancelIf: cancelIf, note: '',
      stopBuf: buf
    }, 'structure-anchored limit (' + tf + ')');
    return { plan: plan, note: '' };
  }catch(e){ return { plan: null, note: '' }; }
}

/* ---------------- staleness guard — the biggest hidden SL cause ----------
   A ticket/board painted an hour ago is a TRAP in fast tape: the user
   enters a level the market already ran through. Every 60s this checks the
   last completed synthesis age; past 10 min the age lines get a loud
   warning suffix, past 20 min a hard one. Self-clearing on the next paint.
   One guarded interval, started at mount, never throws. */
var STALE_WARN_MS = 10 * 60 * 1000, STALE_HARD_MS = 20 * 60 * 1000;
function stalenessTick(){
  try{
    var el = __mountedEl;
    if (!el || typeof el.querySelector !== 'function') return;
    var at = (__lastResult && isFinite(+__lastResult.at)) ? +__lastResult.at : 0;
    if (!at) return;
    var age = Date.now() - at;
    var ta = el.querySelector('#brainTicketAge'), ba = el.querySelector('#brainBoardAge');
    var mark = function(node, base){
      if (!node || !node.textContent) return;
      var clean = node.textContent.replace(/ · ⚠.*$/, '');
      if (age > STALE_HARD_MS){
        node.textContent = clean + ' · ⚠ STALE LEVELS (' + Math.round(age / 60000)
          + ' min old) — DO NOT ENTER from this board, RUN SYNTHESIS first';
        node.style.color = '#e4586b';
      }else if (age > STALE_WARN_MS){
        node.textContent = clean + ' · levels aging (' + Math.round(age / 60000)
          + ' min) — verify with a rescan before entering';
        node.style.color = '#d8a24a';
      }else{
        node.textContent = clean;
        node.style.color = '';
      }
    };
    mark(ta, 'ticket');
    mark(ba, 'board');
  }catch(e){}
}
var __stalenessTimer = null;
function ensureStalenessTimer(){
  if (__stalenessTimer !== null) return;
  try{
    if (typeof setInterval !== 'function') return;
    __stalenessTimer = setInterval(function(){ try{ stalenessTick(); }catch(e){} }, 60000);
    try{ if (__stalenessTimer && typeof __stalenessTimer.unref === 'function') __stalenessTimer.unref(); }catch(e){}
  }catch(e){}
}

/* 1H rescue chooser — pure: of two VALID anchored plans (same row, same
   direction, one 4h one 1h), the tighter stop-distance wins (that is what
   lifts a card over the 20x grade); a tie or wider keeps the 4h plan —
   the stronger structure. null handling is honest either way. */
function pickSniperPlan(p4, p1){
  var ok4 = !!(p4 && isFinite(+p4.entry) && isFinite(+p4.stop) && +p4.entry !== +p4.stop);
  var ok1 = !!(p1 && isFinite(+p1.entry) && isFinite(+p1.stop) && +p1.entry !== +p1.stop);
  if (ok1 && !ok4) return p1;
  if (ok1 && ok4){
    var sd4 = Math.abs(+p4.entry - +p4.stop) / +p4.entry;
    var sd1 = Math.abs(+p1.entry - +p1.stop) / +p1.entry;
    if (sd1 < sd4) return p1;
  }
  return ok4 ? p4 : null;
}

/* =========================================================================
LIMIT STATE — "when to enter": the live validity of ONE resting limit plan,
computed from a zero-fetch mark vs the plan's OWN levels (entry, cancel-if)
and the row's 4h ATR. No candle fetches, no order tracking. Pure, never
throws; exported on window.hgLimitState for the vm suites.
  IN ZONE     mark within 0.25 x ATR of the entry — the limit should be
              filling/live
  APPROACHING 0.25-1.0 x ATR away on the correct side — leave the order
              resting (single-mark read: the band measures DISTANCE, it never
              claims to see motion)
  WAITING     > 1.0 x ATR away on the correct side — the pullback hasn't come
  STALE       mark beyond the cancel-if, or crossed to the wrong side of the
              entry — the order should be pulled; the note names exactly why
  MARK n/a    no zero-fetch mark — honestly unmeasured, never guessed
========================================================================= */
function hgLimitState(plan, mark, atr){
  try{
    if (!plan || !isDir(plan.dir) || !isFinite(+plan.entry))
      return { state: 'none', label: '—', note: 'no computed plan' };
    var long = plan.dir === 'long', entry = +plan.entry;
    mark = +mark; atr = +atr;
    if (!isFinite(mark) || mark <= 0)
      return { state: 'nomark', label: 'MARK n/a',
               note: 'no zero-fetch mark available — validity unmeasured' };
    var cancel = (plan.cancelIf !== null && plan.cancelIf !== undefined && isFinite(+plan.cancelIf))
               ? +plan.cancelIf : null;   /* null/undefined cancelIf = NO cancel level — never coerces to 0 */
    if (cancel !== null && (long ? mark < cancel : mark > cancel))
      return { state: 'stale', label: 'STALE',
               note: 'mark ' + PX(mark) + ' beyond the cancel-if ' + PX(cancel)
                   + ' — pull the order' };
    var dist = Math.abs(mark - entry);
    var zone = (isFinite(atr) && atr > 0) ? LIMIT_ZONE_ATR * atr : 0;
    if (long ? (mark < entry - zone) : (mark > entry + zone))
      return { state: 'stale', label: 'STALE',
               note: 'mark crossed to the wrong side of the limit — filled or broken, '
                   + 'no order tracking; pull and reassess' };
    if (!isFinite(atr) || atr <= 0)
      return { state: 'waiting', label: 'WAITING',
               note: 'mark on the correct side — ATR unavailable, distance unmeasured' };
    if (dist <= zone)
      return { state: 'in-zone', label: 'IN ZONE',
               note: 'mark within 0.25×ATR of the limit — the order should be filling/live' };
    if (dist <= LIMIT_NEAR_ATR * atr)
      return { state: 'approaching', label: 'APPROACHING',
               note: 'mark ' + FMT(dist / atr, 2) + '×ATR from the limit — leave the order resting' };
    return { state: 'waiting', label: 'WAITING',
             note: 'mark ' + FMT(dist / atr, 2) + '×ATR away — the pullback has not come yet' };
  }catch(e){ return { state: 'nomark', label: 'MARK n/a', note: 'state unavailable' }; }
}

/* shared bucketing — used at judge time and again after TREND4H promotions */
function bucketRows(rows){
  var primes = [], highs = [], watches = [], asides = [];
  for (var r = 0; r < rows.length; r++){
    var t = rows[r] && rows[r].dec && rows[r].dec.tier;
    if (t === 'PRIME') primes.push(rows[r]);
    else if (t === 'HIGH') highs.push(rows[r]);
    else if (t === 'WATCH') watches.push(rows[r]);
    else asides.push(rows[r]);
  }
  var byAgree = function(a, b){ return (b.dec.agree - a.dec.agree) || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0); };
  primes.sort(byAgree); highs.sort(byAgree); watches.sort(byAgree);
  return { primes: primes, highs: highs, watches: watches, asides: asides };
}

/* =========================================================================
PATH TO THE NEXT TIER — every WATCH row names CONCRETELY what would build
the next tier, computed from what is currently dark/silent/dissenting:
  capped rows      -> the dark layers that must return (the cap is the wall)
  soft disagreement-> the dissenting layer that must clear (+ any agree gap)
  otherwise        -> the next agreeing layers, naming the fetch-gated
                      TREND4H first, then live-but-silent directional layers,
                      then dark ones; leftover slots name the missing kind
                      (positioning/structural) the row still lacks.
Never a generic string. Never throws.
========================================================================= */
var PATH_DIR_LAYERS = { trend4h:1, engine:1, oiflow:1, squeeze:1, liqs:1,
                        tape:1, regime:1, rotation:1, onchain:1, fng:1 };
function pathToNextTier(row){
  try{
    var dec = row && row.dec;
    if (!dec || dec.tier !== 'WATCH' || !row.col) return '';
    var un = Array.isArray(row.col.unavailable) ? row.col.unavailable : [];
    /* capped rows: the way back up is the dark layers returning */
    if (dec.cappedFrom){
      return 'path to ' + dec.cappedFrom + ': ' + un.length + ' dark layer'
        + (un.length === 1 ? '' : 's') + ' must return (' + un.join(', ') + ')';
    }
    /* a soft dissent blocks HIGH by itself — name who must clear */
    var contra = (dec.dir === 'long') ? 'short' : 'long';
    var dissent = [];
    var votes = Array.isArray(row.col.votes) ? row.col.votes : [];
    for (var i = 0; i < votes.length; i++){
      if (votes[i] && votes[i].vote === contra) dissent.push(votes[i].layer.toUpperCase());
    }
    if (dissent.length){
      var t = 'path to HIGH: ' + dissent.join(' + ') + ' dissent must clear';
      var more = 4 - dec.agree;
      if (more > 0) t += ' + ' + more + ' more agreeing layer' + (more === 1 ? '' : 's');
      return t;
    }
    var need = Math.max(1, 4 - dec.agree);
    var silent = Array.isArray(row.col.silent) ? row.col.silent : [];
    var named = [];
    if (silent.indexOf('trend4h') >= 0 || un.indexOf('trend4h') >= 0) named.push('TREND4H');
    for (var s = 0; s < silent.length; s++){
      if (PATH_DIR_LAYERS[silent[s]] && silent[s] !== 'trend4h') named.push(silent[s].toUpperCase());
    }
    for (var u = 0; u < un.length; u++){
      if (PATH_DIR_LAYERS[un[u]] && un[u] !== 'trend4h' && named.indexOf(un[u].toUpperCase()) === -1)
        named.push(un[u].toUpperCase());
    }
    var parts = [];
    for (var n = 0; n < need && n < named.length; n++) parts.push(named[n]);
    /* leftover slots: name the kind the row still lacks toward conviction */
    var saidPos = false, saidStruct = false;
    while (parts.length < need){
      if (!dec.hasPositioning && !saidPos){ parts.push('1 positioning layer'); saidPos = true; }
      else if (!dec.hasStructural && !saidStruct){ parts.push('1 structural layer'); saidStruct = true; }
      else { parts.push('1 more agreeing layer'); break; }
    }
    if (!named.length && !parts.length) parts.push('1 more agreeing layer');
    return 'path to HIGH: needs ' + parts.join(' + ');
  }catch(e){ return ''; }
}

/* =========================================================================
SNAPSHOT FOR THE SIGNAL LOGGER — window.__hgBrainLast(): a DEEP-FROZEN copy
of the last completed synthesis {at, marketRead, rows:[{sym, dir, tier,
evidence, plan}]} — never the live row objects (quick rescans keep mutating
those), never throws, null before the first scan.
========================================================================= */
var __lastSnap = null;
function deepFreeze(o){
  if (!o || typeof o !== 'object') return o;
  try{ Object.freeze(o); }catch(e){}
  for (var k in o){
    if (Object.prototype.hasOwnProperty.call(o, k)) deepFreeze(o[k]);
  }
  return o;
}
function buildSnapshot(rows, readTxt, at){
  try{
    var out = { at: at, marketRead: String(readTxt === null || readTxt === undefined ? '' : readTxt), rows: [] };
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || !r.dec) continue;
      var ev = [];
      var vs = (r.col && Array.isArray(r.col.votes)) ? r.col.votes : [];
      for (var a = 0; a < vs.length; a++){
        if (vs[a]) ev.push(vs[a].layer.toUpperCase() + ': ' + vs[a].text);
      }
      var p = r.plan;
      out.rows.push({
        sym: r.sym, dir: r.dec.dir || null, tier: r.dec.tier,
        evidence: ev,
        plan: (p && isFinite(p.entry) && isFinite(p.stop) && isFinite(p.t1))
              ? { entry: p.entry, stop: p.stop, t1: p.t1, t2: (isFinite(p.t2) ? p.t2 : null) }
              : null
      });
    }
    return deepFreeze(out);
  }catch(e){ return null; }
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
           src: src,
           /* ADDITIVE structure-anchor fields — the {dir, entry, stop, t1, t2}
              contract is untouched; 'gate' marks every classic gate-engine /
              smartSetup / hgPlanLevels plan */
           entryType: (p.entryType === 'limit' || p.entryType === 'zone') ? p.entryType : 'gate',
           anchorName: (typeof p.anchorName === 'string') ? p.anchorName : '',
           anchorNote: (typeof p.anchorNote === 'string') ? p.anchorNote : '',
           cancelIf: isFinite(p.cancelIf) ? +p.cancelIf : null };
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

/* plan for a crypto PRIME/HIGH card: engine survivor plan -> the STRUCTURE-
   ANCHORED limit over the fetched 4h rows -> smartSetup -> hgPlanLevels ->
   honest 'levels unavailable'. Same anchored-first precedence as the combined
   mode: a qualified row gets its patient LIMIT wherever real 4h structure
   sits in band; declines fall through with the reason named. */
async function cryptoPlan(row, snap){
  var ep = enginePlanFor(row, snap);
  if (ep) return { plan: ep, rows: null };
  var kl = await klineRows(row.sym);
  var rows = kl.rows4h || kl.rows1h;
  if (!rows) return { plan: null, rows: null };
  var fbNote = '';
  var ap = null;
  if (kl.rows4h){
    try{
      ap = anchoredLimitPlan(row.dec.dir, kl.rows4h);
      fbNote = (ap && ap.note) ? ap.note : '';
    }catch(e){ ap = null; fbNote = ''; }
  }
  /* 1H SNIPER RESCUE (legacy): same rule as combined — but klineRows already
     fetched the 1h leg, so this costs ZERO extra fetches */
  if ((!(ap && ap.plan) || sniperLev(ap.plan.entry, ap.plan.stop) < SNIPER_MIN_LEV)
      && kl.rows1h && kl.rows1h.length){
    try{
      var a1 = anchoredLimitPlan(row.dec.dir, kl.rows1h, '1h');
      var pick1 = pickSniperPlan(ap && ap.plan, a1 && a1.plan);
      if (pick1 && !(ap && ap.plan && pick1 === ap.plan)) return { plan: pick1, rows: kl.rows1h };
    }catch(e){ /* the 4h result stands */ }
  }
  if (ap && ap.plan) return { plan: ap.plan, rows: kl.rows4h };
  if (typeof G.smartSetup === 'function' && kl.rows4h && kl.rows4h.length >= 60){
    try{
      var agreeing = row.col.votes.filter(function(v){ return v.vote === row.dec.dir; });
      var contra   = row.col.votes.filter(function(v){ return v.vote === (row.dec.dir === 'long' ? 'short' : 'long'); });
      var cls = { dir: row.dec.dir,
                  longEv: row.dec.dir === 'long' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  shortEv: row.dec.dir === 'short' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  score: row.dec.agree, total: row.dec.agree + row.dec.disagree, regime: [] };
      var sp = G.smartSetup(cls, kl.rows4h, kl.rows1h || []);
      var np = normalizePlan(sp, sp && sp.type ? 'smartSetup ' + sp.type : 'smartSetup', fbNote);
      if (np) return { plan: np, rows: kl.rows4h };
    }catch(e){ /* fall through to hgPlanLevels */ }
  }
  if (typeof G.hgPlanLevels === 'function'){
    try{
      var pl = G.hgPlanLevels(row.dec.dir, rows);
      var hp = normalizePlan(pl, 'hgPlanLevels', fbNote);
      if (hp) return { plan: hp, rows: rows };
    }catch(e){}
  }
  return { plan: null, rows: rows };
}

/* combined-mode crypto plan: engine survivor plan first, then the STRUCTURE-
   ANCHORED limit over the lazily pre-fetched 4h rows, then the smartSetup /
   hgPlanLevels fallback — kept untouched and honestly labeled when no anchor
   qualifies. smartSetup gets [] for 1h rows — the fetch budget is 4h-only,
   an input it already tolerates. */
async function cryptoPlanXu(row, snap){
  var ep = enginePlanFor(row, snap);
  if (ep) return { plan: ep, rows: null };
  var rows = (row.rows4h && row.rows4h.length) ? row.rows4h : null;
  if (!rows) return { plan: null, rows: null };
  /* patient LIMIT at 4h structure — the row's own fetched candles, never a
     fabricated level; declines (band empty / R:R fails) fall through with
     the reason named on the fallback plan */
  var fbNote = '';
  var ap = null;
  try{
    ap = anchoredLimitPlan(row.dec.dir, rows);
    fbNote = (ap && ap.note) ? ap.note : '';
  }catch(e){ ap = null; fbNote = ''; }
  /* 1H SNIPER RESCUE (combined): when the 4h anchor declined OR its stop is
     wider than the 20x grade (stopDist > 3%), the SAME pure planner re-runs
     on 1h candles — tighter zones, tighter ATR, nearer targets. The queue
     already fetched the 1h leg for MTF; the bounded fetch (RESCUE_CAP) is
     only the fallback for a missing leg. pickSniperPlan keeps the tighter
     valid plan; the 4h plan wins ties (stronger structure). */
  if (!(ap && ap.plan) || sniperLev(ap.plan.entry, ap.plan.stop) < SNIPER_MIN_LEV){
    var r1 = (row.rows1h && row.rows1h.length) ? row.rows1h : null;
    if (!r1 && __rescueFetches < RESCUE_CAP && row.xu && typeof G.xuCandles === 'function'){
      __rescueFetches++;
      try{ r1 = await withTimeout(G.xuCandles(row.xu, '1h', KLINES_1H), TUN.fetchMs); }catch(e){ r1 = null; }
    }
    if (r1 && r1.length){
      try{
        var a1 = anchoredLimitPlan(row.dec.dir, r1, '1h');
        var pick1 = pickSniperPlan(ap && ap.plan, a1 && a1.plan);
        if (pick1 && !(ap && ap.plan && pick1 === ap.plan)) return { plan: pick1, rows: r1 };
      }catch(e){ /* the 4h result stands */ }
    }
  }
  if (ap && ap.plan) return { plan: ap.plan, rows: rows };
  if (typeof G.smartSetup === 'function' && rows.length >= 60){
    try{
      var agreeing = row.col.votes.filter(function(v){ return v.vote === row.dec.dir; });
      var contra   = row.col.votes.filter(function(v){ return v.vote === (row.dec.dir === 'long' ? 'short' : 'long'); });
      var cls = { dir: row.dec.dir,
                  longEv: row.dec.dir === 'long' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  shortEv: row.dec.dir === 'short' ? agreeing.map(function(v){ return v.text; }) : contra.map(function(v){ return v.text; }),
                  score: row.dec.agree, total: row.dec.agree + row.dec.disagree, regime: [] };
      var sp = G.smartSetup(cls, rows, []);
      var np = normalizePlan(sp, sp && sp.type ? 'smartSetup ' + sp.type : 'smartSetup', fbNote);
      if (np) return { plan: np, rows: rows };
    }catch(e){ /* fall through to hgPlanLevels */ }
  }
  if (typeof G.hgPlanLevels === 'function'){
    try{
      var hp = normalizePlan(G.hgPlanLevels(row.dec.dir, rows), 'hgPlanLevels', fbNote);
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
  /* gold rows deserve the same patient limit first: anchored at real XAU 4h
     structure when one sits in band, else the hgPlanLevels fallback with the
     decline reason named */
  var fbNote = '';
  if (rows){
    try{
      var ga = anchoredLimitPlan(row.dec.dir, rows);
      if (ga && ga.plan) return { plan: ga.plan, rows: rows };
      fbNote = (ga && ga.note) ? ga.note : '';
    }catch(e){ fbNote = ''; }
  }
  if (rows && typeof G.hgPlanLevels === 'function'){
    try{
      var hp = normalizePlan(G.hgPlanLevels(row.dec.dir, rows), 'hgPlanLevels · XAU 4h', fbNote);
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
  /* gate cautions render as amber chips — named, never silent, never a veto */
  if (v.layer === 'guard')
    return '<span class="gpip" style="color:#d8a24a;border-color:rgba(216,162,74,.5);background:rgba(216,162,74,.08)">'
      + label + ': ' + esc(v.text) + '</span>';
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
  /* structure-anchored limit: the patient-entry render — anchor, invalidation
     and working-order validity named, never a market chase */
  if (plan.entryType === 'limit' || plan.entryType === 'zone'){
    var an = esc(plan.anchorName || '4h structure');
    var limLev = sniperLev(plan.entry, plan.stop);
    var limLevCol = limLev >= SNIPER_MIN_LEV ? '#5fbf8f' : (limLev >= 10 ? '#d8a24a' : '#6d7684');
    return (plan.entryType === 'zone'
        ? 'price in zone — limit at zone edge <b>' + PX(plan.entry) + '</b> or market'
        : 'LIMIT @ <b>' + PX(plan.entry) + '</b> — pullback to ' + an)
      + ' · stop <b>' + PX(plan.stop) + '</b> (' + FMT(isFinite(plan.stopBuf) ? plan.stopBuf : 0.75, 2) + 'xATR beyond ' + an + (plan.anchorNote && plan.anchorNote.indexOf('pool') >= 0 ? ', pool-adjusted' : '') + ')'
      + ' · TP1 <b>' + PX(plan.t1) + '</b>'
      + (plan.t2 !== null ? ' · TP2 <b>' + PX(plan.t2) + '</b>' : '')
      + ' · R:R ' + FMT(plan.rr1, 1)
      + ' · <span style="font-weight:700;color:' + limLevCol + '" title="max safe leverage — floor(1 / (stop distance ×1.5 + 0.5% MMR)) — liquidation clearance ≥1.5× the stop">'
      + limLev + 'x SAFE</span>'
      + (isFinite(plan.cancelIf) ? ' · cancel if 4h closes beyond <b>' + PX(plan.cancelIf) + '</b>' : '')
      + ' · limit working ~24h or until structure breaks'
      + (plan.src ? ' — ' + esc(plan.src) : '');
  }
  var risk = Math.abs(plan.entry - plan.stop);
  var planLev = sniperLev(plan.entry, plan.stop);
  var planLevCol = planLev >= SNIPER_MIN_LEV ? '#5fbf8f' : (planLev >= 10 ? '#d8a24a' : '#6d7684');
  return 'ENTRY <b>' + PX(plan.entry) + '</b> · STOP <b>' + PX(plan.stop) + '</b>'
    + ' · T1 <b>' + PX(plan.t1) + '</b> (' + FMT(plan.rr1, 1) + 'R)'
    + (plan.t2 !== null ? ' · T2 <b>' + PX(plan.t2) + '</b> (' + FMT(plan.rr2, 1) + 'R)' : '')
    + ' · risk ' + FMT(plan.riskPct, 2) + '%'
    + ' · <span style="font-weight:700;color:' + planLevCol + '" title="max safe leverage — floor(1 / (stop distance ×1.5 + 0.5% MMR)) — liquidation clearance ≥1.5× the stop">'
    + planLev + 'x SAFE</span>'
    + (plan.src ? ' — ' + esc(plan.src) : '')
    + (plan.note ? ' · ' + esc(plan.note) : '');
}

/* =========================================================================
ENTRY TICKET — the one-glance answer to "at what EXACT price do I enter?"
After every synthesis (full or quick) the single best LONG and the single
best SHORT row carrying a real computed plan are promoted into two big
tickets pinned above the cards. The limit price renders in the largest type
on the tab, framed exactly as the order is placed:
  LONG  -> MIN ENTRY — place a limit buy down to <price> (the lowest
           probable entry the structure math supports)
  SHORT -> MAX ENTRY — place a limit sell up to <price> (the highest
           price the pullback math still validates)
plus stop, MOST PROBABLE TARGET (T1), stretch (T2), R:R, cancel-if, working
validity and a SEND TO TRADE PLAN handoff. Gate-engine (non-pullback) plans
are labeled ENTRY AT with their source named — never dressed up as limits.
When NO row on a side carries a computed plan, that side still renders: an
honest NO QUALIFIED LONG/SHORT naming the nearest plan-less candidate and
why. Levels are never invented — a ticket only ever echoes a plan the
planners already made. Never throws.
========================================================================= */
function tierRank(t){
  t = String(t || '').toUpperCase();
  return t === 'PRIME' ? 3 : t === 'HIGH' ? 2 : t === 'WATCH' ? 1 : 0;
}
function ticketCandidate(row){
  try{
    if (!row || !row.dec || !row.plan) return null;
    var p = row.plan, dir = row.dec.dir;
    if (p.dir === 'long' || p.dir === 'short') dir = p.dir; /* the plan is the truth on direction */
    if (dir !== 'long' && dir !== 'short') return null;
    if (!isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.t1)) return null;
    if (p.entry === p.stop) return null;
    return { row: row, dir: dir,
             rank: tierRank(row.dec.tier) * 1000
                 + (isFinite(row.dec.agree) ? row.dec.agree : 0) * 10
                 + Math.min(isFinite(p.rr1) ? p.rr1 : 0, 9.9) };
  }catch(e){ return null; }
}
function buildEntryTickets(rows){
  var out = { long: null, short: null, longNear: null, shortNear: null };
  try{
    rows = Array.isArray(rows) ? rows : [];
    var bestL = null, bestS = null, nearL = null, nearS = null;
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || !r.dec) continue;
      var c = ticketCandidate(r);
      if (c){
        if (c.dir === 'long' && (!bestL || c.rank > bestL.rank)) bestL = c;
        else if (c.dir === 'short' && (!bestS || c.rank > bestS.rank)) bestS = c;
        continue;
      }
      /* near miss — the highest-tier plan-less row leaning each way, named
         honestly on the empty side of the panel */
      var d = r.dec.dir, rk = tierRank(r.dec.tier);
      if (rk <= 0) continue;
      if (d === 'long' && (!nearL || rk > nearL.rank)) nearL = { row: r, rank: rk };
      else if (d === 'short' && (!nearS || rk > nearS.rank)) nearS = { row: r, rank: rk };
    }
    out.long = bestL ? bestL.row : null;
    out.short = bestS ? bestS.row : null;
    out.longNear = nearL ? nearL.row : null;
    out.shortNear = nearS ? nearS.row : null;
  }catch(e){}
  return out;
}
function ticketSymTxt(row){
  return row.lane === 'gold' ? 'XAU · GOLD' : String(row.base || row.sym || '?');
}
function ticketTradeBtn(row, dir){
  try{
    var p = row.plan;
    if (!p || typeof G.toTrade !== 'function') return '';
    return '<button class="toTrade" style="margin-top:8px" onclick="'
      + ('toTrade(' + JSON.stringify(row.lane === 'gold' ? 'XAUTUSD' : row.sym) + ','
         + JSON.stringify(dir) + ',' + p.entry + ',' + p.stop + ',' + p.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>';
  }catch(e){ return ''; }
}
function ticketHTML(row, dir){
  try{
    var p = row.plan, dec = row.dec, long = dir === 'long';
    var col = long ? '#5fbf8f' : '#e4586b';
    var limitish = (p.entryType === 'limit' || p.entryType === 'zone');
    var headline = limitish
      ? (long ? 'MIN ENTRY — LIMIT BUY DOWN TO' : 'MAX ENTRY — LIMIT SELL UP TO')
      : 'ENTRY AT';
    var subline = limitish
      ? (p.entryType === 'zone'
          ? 'price already inside the zone — limit at the zone edge or market'
          : (long ? 'lowest probable entry — pullback to ' : 'highest validated entry — pullback to ')
            + esc(p.anchorName || '4h structure'))
      : esc(p.src ? String(p.src) + ' levels' : 'gate-engine levels') + (p.note ? ' — ' + esc(p.note) : '');
    var venueStamp = (row.exchange === 'delta') ? ' · DELTA'
                   : (row.exchange === 'cdcx') ? ' · COINDCX' : '';
    return '<div style="flex:1 1 340px;border:1px solid ' + col + ';border-radius:6px;'
      + 'background:rgba(255,255,255,.02);padding:12px 14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
      + '<span style="font-size:15px;font-weight:700;letter-spacing:.04em">' + esc(ticketSymTxt(row)) + '</span>'
      + '<span style="font-size:10px;letter-spacing:.08em;color:' + col + ';font-weight:700">'
      + dir.toUpperCase() + ' TICKET · ' + esc(String(dec.tier || '').toUpperCase()) + ' · '
      + (isFinite(dec.agree) ? dec.agree : 0) + ' LAYERS' + venueStamp + '</span></div>'
      + '<div style="margin-top:8px;font-size:10px;letter-spacing:.1em;color:#9aa6b5">' + headline + '</div>'
      + '<div style="font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;color:' + col + ';line-height:1.2">'
      + PX(p.entry) + '</div>'
      + '<div style="font-size:11px;color:#c4ccd8;margin-top:2px">' + subline + '</div>'
      + '<div style="margin-top:8px;font-size:11.5px;line-height:1.8;color:#c4ccd8">'
      + 'STOP <b>' + PX(p.stop) + '</b>'
      + (limitish ? ' (' + FMT(isFinite(p.stopBuf) ? p.stopBuf : 0.75, 2) + '×ATR beyond ' + esc(p.anchorName || 'anchor') + ')' : '')
      + (isFinite(p.cancelIf) && p.cancelIf !== null ? ' · cancel if 4h closes beyond <b>' + PX(p.cancelIf) + '</b>' : '')
      + '<br>MOST PROBABLE TARGET <b style="color:' + col + '">' + PX(p.t1) + '</b>'
      + ' (R:R ' + FMT(isFinite(p.rr1) ? p.rr1 : Math.abs(p.t1 - p.entry) / Math.abs(p.entry - p.stop), 1) + ')'
      + (p.t2 !== null && isFinite(p.t2) ? ' · STRETCH <b>' + PX(p.t2) + '</b>'
        + (isFinite(p.rr2) ? ' (' + FMT(p.rr2, 1) + 'R)' : '') : '')
      + (isFinite(p.riskPct) ? '<br>risk ' + FMT(p.riskPct, 2) + '% from entry' : '')
      + (limitish ? '<br>limit working ~24h or until structure breaks' : '')
      + familyLineHTML(p)
      + '</div>'
      + ticketTradeBtn(row, dir)
      + '</div>';
  }catch(e){
    return '<div style="flex:1 1 340px;border:1px solid rgba(143,160,184,.4);border-radius:6px;padding:12px 14px">'
      + '<span style="font-size:11px;color:#9aa6b5">ticket render failed: ' + esc(errMsg(e))
      + ' — the row card below still carries the plan</span></div>';
  }
}
function noTicketHTML(dir, nearRow){
  try{
    var long = dir === 'long';
    var col = long ? '#5fbf8f' : '#e4586b';
    var near = '';
    if (nearRow && nearRow.dec){
      near = '<div style="margin-top:8px;font-size:11px;line-height:1.7;color:#c4ccd8">nearest: <b>'
        + esc(ticketSymTxt(nearRow)) + '</b> ' + esc(String(nearRow.dec.tier || '').toUpperCase())
        + ' — ' + esc(nearRow.dec.reasons && nearRow.dec.reasons[0] ? nearRow.dec.reasons[0] : 'no reason recorded')
        + (nearRow.plan ? '' : ' · levels unavailable — it never reached the candle budget or no anchor qualified')
        + '</div>';
    }
    return '<div style="flex:1 1 340px;border:1px dashed rgba(143,160,184,.4);border-radius:6px;padding:12px 14px">'
      + '<div style="font-size:10px;letter-spacing:.1em;color:#9aa6b5">' + dir.toUpperCase() + ' TICKET</div>'
      + '<div style="margin-top:8px;font-size:13px;font-weight:700;color:' + col + '">NO QUALIFIED '
      + dir.toUpperCase() + ' ENTRY</div>'
      + '<div style="margin-top:4px;font-size:11px;color:#9aa6b5">no ' + dir
      + ' row carries a computed plan this scan — the app refuses to invent a level.'
      + ' Standing aside on this side is the position.</div>'
      + near + '</div>';
  }catch(e){ return ''; }
}
function paintEntryTickets(el, rows){
  try{
    if (!el || typeof el.querySelector !== 'function') return;
    var wrap = el.querySelector('#brainTicketWrap'), box = el.querySelector('#brainTicket');
    if (!wrap || !box) return;
    var t = buildEntryTickets(rows);
    box.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + (t.long ? ticketHTML(t.long, 'long') : noTicketHTML('long', t.longNear))
      + (t.short ? ticketHTML(t.short, 'short') : noTicketHTML('short', t.shortNear))
      + '</div>';
    /* chop-regime banner: in a deadzone regime with fear sentiment, trend
       setups statistically die — say it ON the panel the user trades from.
       snap comes from the last synthesis (regime + F&G), never invented. */
    try{
      var banner = el.querySelector('#brainRegimeBanner');
      if (banner){
        var rs = (__regimeSnap && __regimeSnap.score !== null) ? __regimeSnap.score : null;
        var rlabel = (__regimeSnap && __regimeSnap.label) || '';
        var fng = (__regimeSnap && __regimeSnap.fng !== null) ? __regimeSnap.fng : null;
        var chop = (rs !== null && rs >= -3 && rs <= 3) || (fng !== null && fng <= 30);
        if (chop){
          banner.style.display = 'block';
          banner.textContent = '⚠ CHOP REGIME — ' + (rlabel || 'mixed') + (fng !== null ? ' · F&G ' + fng : '')
            + ': trend entries die in mean-reverting tape. Sniper-grade only, half size, or stand aside.';
        }else{
          banner.style.display = 'none';
        }
      }
    }catch(e){}
    var age = el.querySelector('#brainTicketAge');
    if (age) age.textContent = 'levels as of ' + new Date().toTimeString().slice(0, 8)
      + ' — refreshed by every synthesis, including the AUTO cycle';
    wrap.style.display = 'block';
    /* alert seam — publish the painted tickets and ping the alert engine
       (hgalert.js owns chime/push policy; plain data only, never awaited) */
    try{
      var tsnap = {
        at: Date.now(),
        long: t.long ? { sym: String(t.long.sym), entry: +t.long.plan.entry } : null,
        short: t.short ? { sym: String(t.short.sym), entry: +t.short.plan.entry } : null
      };
      __lastTicketSnap = tsnap;
      if (typeof G.hgAlertTicket === 'function') G.hgAlertTicket(tsnap);
    }catch(e){}
    /* LIMIT BOARD rides the same repaint seam — same rows, same plan objects
       (alert keys stay stable), zero extra fetches */
    paintLimitBoard(el, rows);
  }catch(e){ /* the ticket is additive — the scan render stands without it */ }
}

/* =========================================================================
FAMILY HIT-RATES — every board/ticket card shows how ITS OWN setup family
has actually performed in this browser's Setup Log (the honest audit:
first touch of T1 or stop on closed candles, same-bar = SL, exp excluded,
time_stop = -0.1R — the log's own grading rules, never softened).
Families: anchor-led limits (fvg / order-block / ema / swing-zone / pool /
avwap) and the engine/smartSetup/hgPlanLevels sources. Board plans are
auto-logged with the family as kind (the log's 12h sym+dir+kind dedupe
applies), so the stats build from the day this ships — an empty family
says so honestly, never a borrowed track record from another family.
========================================================================= */
function planFamily(p){
  try{
    if (!p) return 'unknown';
    var an = String(p.anchorName || '');
    if (/FVG/i.test(an)) return 'fvg-limit';
    if (/order block/i.test(an)) return 'ob-limit';
    if (/EMA\d+/i.test(an)) return 'ema-limit';
    if (/swing-(high|low)/i.test(an)) return 'swing-zone-limit';
    if (/pool/i.test(an)) return 'pool-limit';
    if (/AVWAP/i.test(an)) return 'avwap-limit';
    var src = String(p.src || '');
    if (/smartSetup\s*SCALP/i.test(src)) return 'smart-scalp';
    if (/smartSetup\s*SWING/i.test(src)) return 'smart-swing';
    if (/engine/i.test(src)) return 'engine-plan';
    if (/hgPlanLevels/i.test(src)) return 'gate-levels';
    if (/gold/i.test(src)) return 'gold-plan';
    return 'anchored-limit';
  }catch(e){ return 'unknown'; }
}
var FAMILY_LABEL = {
  'fvg-limit': 'FVG limits', 'ob-limit': 'OB limits', 'ema-limit': 'EMA limits',
  'swing-zone-limit': 'swing-zone limits', 'pool-limit': 'pool limits',
  'avwap-limit': 'AVWAP limits', 'smart-scalp': 'smart scalps',
  'smart-swing': 'smart swings', 'engine-plan': 'engine plans',
  'gate-levels': 'gate levels', 'gold-plan': 'gold plans',
  'anchored-limit': 'anchored limits', 'unknown': 'this family'
};
/* pure stats over a log array — tp = win (+rr), sl = -1R, time_stop = -0.1R,
   exp/open excluded. Returns null when no closed samples exist. */
function familyStats(log, kind){
  try{
    if (!Array.isArray(log)) return null;
    var tp = 0, sl = 0, ts = 0, sumR = 0;
    for (var i = 0; i < log.length; i++){
      var e = log[i];
      if (!e || e.kind !== kind) continue;
      if (e.status === 'tp'){ tp++; sumR += isFinite(+e.rr) ? +e.rr : 1.5; }
      else if (e.status === 'sl'){ sl++; sumR -= 1; }
      else if (e.status === 'time_stop'){ ts++; sumR += isFinite(+e.rr) ? +e.rr : -0.1; }
    }
    var n = tp + sl + ts;
    if (!n) return null;
    return { kind: kind, tp: tp, sl: sl, ts: ts, n: n,
             hitPct: Math.round((tp / n) * 100), sumR: Math.round(sumR * 10) / 10 };
  }catch(e){ return null; }
}
function familyLineHTML(p){
  try{
    var fam = planFamily(p);
    var label = FAMILY_LABEL[fam] || fam;
    var st = (typeof G.loadLog === 'function') ? familyStats(G.loadLog(), fam) : null;
    if (!st) return '<br><span style="color:#6d7684">history: no closed ' + esc(label)
      + ' in the Setup Log yet — the family record builds from here</span>';
    /* Jeffreys-smoothed win-rate estimate ((tp+0.5)/(n+1)) — a principled
       read that never screams 100% off 2 wins, plus the honest expected
       value per trade in R: est*rr1 - (1-est). No smoothing games beyond
       that, the numbers speak. */
    var est = estWinRate(st);
    var rr1 = (p && isFinite(+p.rr1)) ? +p.rr1
            : (p && isFinite(+p.entry) && isFinite(+p.stop) && isFinite(+p.t1) && +p.entry !== +p.stop
               ? Math.abs(+p.t1 - +p.entry) / Math.abs(+p.entry - +p.stop) : NaN);
    var col = st.hitPct >= 55 ? '#5fbf8f' : (st.hitPct >= 40 ? '#d8a24a' : '#e4586b');
    var evTxt = '';
    if (isFinite(rr1) && rr1 > 0){
      var ev = est * rr1 - (1 - est);
      evTxt = ' · EV <b style="color:' + (ev > 0 ? '#5fbf8f' : '#e4586b') + '">'
        + (ev > 0 ? '+' : '') + FMT(ev, 2) + 'R</b>/trade';
    }
    return '<br><span style="color:' + col + '">history: ' + esc(label) + ' '
      + st.tp + '/' + st.n + ' (' + st.hitPct + '%) · Σ'
      + (st.sumR > 0 ? '+' : '') + st.sumR + 'R'
      + (st.ts ? ' · ' + st.ts + ' time-stopped' : '')
      + ' · est win ' + FMT(est * 100, 0) + '%' + evTxt
      + ' <span style="color:#6d7684">(n=' + st.n + (st.n < 8 ? ', thin' : '') + ')</span></span>';
  }catch(e){ return ''; }
}
function estWinRate(st){
  try{
    if (!st || !isFinite(+st.n) || +st.n <= 0) return NaN;
    return (+st.tp + 0.5) / (+st.n + 1);
  }catch(e){ return NaN; }
}
/* auto-log the board's plans with the family as kind — dedupe inside
   logSetup (12h sym+dir+kind) keeps repeat scans from flooding */
function logBoardSetups(rows){
  try{
    if (typeof G.logSetup !== 'function') return;
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || !r.plan || !r.dec || (r.dec.dir !== 'long' && r.dec.dir !== 'short')) continue;
      var p = r.plan;
      if (!isFinite(+p.entry) || !isFinite(+p.stop) || !isFinite(+p.t1)) continue;
      try{ G.logSetup(String(r.sym), r.dec.dir, planFamily(p), +p.entry, +p.stop, +p.t1); }catch(e){}
    }
  }catch(e){}
}

/* =========================================================================
LIMIT BOARD — every qualified setup, one exact resting limit each. The ENTRY
TICKET answers "the single best long/short"; the board lists EVERY
PRIME/HIGH/WATCH row carrying a computed plan, sorted exactly like the ticket
ranks (tier -> agree -> R:R):
  LIMITS       rows whose plan is a structure-anchored limit ('limit'/'zone')
               — SYM, side, tier, the exact LIMIT ENTRY, stop, T1, T2, R:R,
               the anchor family named, cancel-if, a live validity chip
               (hgLimitState over a zero-fetch mark) and the trade handoff.
  MARKET-ONLY  rows whose plan is a market entry (gate engine / smartSetup /
               hgPlanLevels), separated at the bottom with the named decline
               reason — never dressed up as limits.
Rows with plan:null are NOT listed (the ticket's near-miss copy covers them).
Board rows reuse the SAME plan objects the ticket alerts on — alert keys
(sym@entry) stay byte-stable. Pure builder seam: window.__hgBrainBoard.
Never throws.
========================================================================= */
function boardCandidate(row){
  try{
    var c = ticketCandidate(row);
    if (!c || tierRank(row.dec.tier) <= 0) return null;  /* qualified rows only — ASIDE never boards */
    var et = row.plan.entryType;
    c.limit = (et === 'limit' || et === 'zone');
    c.lev = sniperLev(row.plan.entry, row.plan.stop);   /* max-safe leverage, planner formula */
    return c;
  }catch(e){ return null; }
}
function buildLimitBoard(rows){
  var out = { limits: [], marketOnly: [] };
  try{
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++){
      var c = boardCandidate(rows[i]);
      if (!c) continue;
      (c.limit ? out.limits : out.marketOnly).push(c);
    }
    var byRank = function(a, b){ return b.rank - a.rank; };
    out.limits.sort(byRank); out.marketOnly.sort(byRank);
  }catch(e){}
  return out;
}
/* zero-fetch mark for the state chip: the xuniverse positioning cache first,
   then the row's own snapshot — never a new fetch, honestly NaN otherwise */
function boardMarkFor(row){
  try{
    if (row && row.base && typeof G.xuPositioning === 'function'){
      var pos = G.xuPositioning(row.base);
      if (pos && isFinite(+pos.mark) && +pos.mark > 0) return +pos.mark;
    }
  }catch(e){}
  try{
    if (row && row.xu && isFinite(+row.xu.mark) && +row.xu.mark > 0) return +row.xu.mark;
  }catch(e){}
  try{
    if (row && isFinite(+row.mark) && +row.mark > 0) return +row.mark;
  }catch(e){}
  return NaN;
}
/* the row's own 4h ATR — candles the scan already fetched, never refetched */
function boardAtrFor(row){
  try{
    var rows = (row && Array.isArray(row.rows4h) && row.rows4h.length >= 15) ? row.rows4h
             : (row && Array.isArray(row.rows) && row.rows.length >= 15) ? row.rows : null;
    return rows ? atrLast(rows, 14) : NaN;
  }catch(e){ return NaN; }
}
var LIMIT_STATE_COL = { 'in-zone': '#5fbf8f', approaching: '#d8a24a', waiting: '#8fa0b8',
                        stale: '#e4586b', nomark: '#6d7684', none: '#6d7684' };

/* =========================================================================
SNIPER MODE — the owner's day-trade filter over the board: resting LIMIT
orders only, mark IN ZONE or APPROACHING, and a stop tight enough that the
planner's OWN auto-leverage math allows >= 20x. The leverage formula is
byte-identical to planTrade in index.html (1.5x liquidation clearance,
0.5% MMR): 20x needs stop distance <= 3.0%, 30x needs <= 1.9%. No new
indicators, no invented levels — it FILTERS what the planners already
produced and prints the max-safe leverage honestly on every card. Nothing
here (or anywhere) can promise a stop never gets hit — sniper stacks the
odds; it does not repeal risk.
========================================================================= */
var SNIPER_MIN_LEV = 20;
var SNIPER_MMR = 0.005;
function sniperLev(entry, stop, mmr){
  try{
    entry = +entry; stop = +stop;
    if (!isFinite(entry) || !isFinite(stop) || entry <= 0 || entry === stop) return 1;
    var sd = Math.abs(entry - stop) / entry;
    var lev = Math.floor(1 / (sd * 1.5 + (isFinite(+mmr) && +mmr > 0 ? +mmr : SNIPER_MMR)));
    return Math.max(1, Math.min(100, lev));
  }catch(e){ return 1; }
}
function sniperOk(c, st){
  try{
    if (!c || !c.limit) return false;   /* sniper = resting limit orders only */
    if (!(c.lev >= SNIPER_MIN_LEV)) return false;
    if (!(!!st && (st.state === 'in-zone' || st.state === 'approaching'))) return false;
    /* EV gate (owner mandate 2026-07-28): a family with a REAL record (n>=4
       closed) must be paying — est*rr1 - (1-est) > 0. No record / thin
       record = unproven, not proven-bad: passes. */
    var p = c.row && c.row.plan;
    if (p && typeof G.loadLog === 'function'){
      var fst = familyStats(G.loadLog(), planFamily(p));
      if (fst && fst.n >= 4){
        var est = estWinRate(fst);
        var rr1 = isFinite(+p.rr1) ? +p.rr1
                : Math.abs(+p.t1 - +p.entry) / Math.abs(+p.entry - +p.stop);
        if (isFinite(est) && isFinite(rr1) && (est * rr1 - (1 - est)) <= 0) return false;
      }
    }
    return true;
  }catch(e){ return false; }
}
var __sniper = (function(){   /* owner mandate 2026-07-25: SNIPER defaults ON; the toggle persists */
  try{
    if (typeof localStorage !== 'undefined' && localStorage){
      var v = localStorage.getItem('hgBrainSniper');
      if (v !== null) return v === '1';
    }
  }catch(e){}
  return true;
})();

/* SNIPER-GRADE HITS — the exact set the alerts fire on: resting LIMIT,
   mark IN ZONE or APPROACHING, stop tight enough for >=20x. Published as a
   plain snapshot after every paint (browser hgalert reads it) and pushed
   to window.hgAlertSniper when armed; the CI runner reads the same seam.
   Independent of the display toggle — the grade is computed, not shown. */
var __lastSniperHits = [];
function sniperHitsFrom(rows){
  var out = [];
  try{
    var b = buildLimitBoard(rows);
    for (var i = 0; i < b.limits.length; i++){
      var c = b.limits[i];
      if (!c || !c.row || !c.row.plan) continue;
      var st = hgLimitState(c.row.plan, boardMarkFor(c.row), boardAtrFor(c.row));
      if (!sniperOk(c, st)) continue;
      var p = c.row.plan;
      out.push({ sym: String(c.row.sym), dir: c.dir, entry: +p.entry, stop: +p.stop,
                 t1: +p.t1, lev: c.lev, state: String(st.label || '') });
    }
  }catch(e){}
  return out;
}
function boardCardHTML(c, stamp){
  try{
    var row = c.row, p = row.plan, dir = c.dir, long = dir === 'long';
    var col = long ? '#5fbf8f' : '#e4586b';
    var st = hgLimitState(p, boardMarkFor(row), boardAtrFor(row));
    var stCol = LIMIT_STATE_COL[st.state] || '#6d7684';
    var headline = c.limit
      ? (p.entryType === 'zone' ? 'LIMIT ENTRY (price in zone — zone edge)' : 'LIMIT ENTRY')
      : 'ENTRY AT (market — no limit anchor in band)';
    var subline = c.limit
      ? esc(p.anchorName || '4h structure')
      : esc((p.src ? String(p.src) + ' levels' : 'gate-engine levels') + (p.note ? ' — ' + p.note : ''));
    var rr1 = isFinite(p.rr1) ? p.rr1 : Math.abs(p.t1 - p.entry) / Math.abs(p.entry - p.stop);
    var levCol = c.lev >= SNIPER_MIN_LEV ? '#5fbf8f' : (c.lev >= 10 ? '#d8a24a' : '#6d7684');
    var sw = sessionWindow();
    var swCol = sw.dead ? '#6d7684' : (sw.london || sw.ny ? '#5fbf8f' : '#8fa0b8');
    var swTxt = sw.london ? 'LONDON KZ' : sw.ny ? 'NY KZ' : sw.dead ? 'OFF-HOURS' : 'MID-SESSION';
    return '<div style="flex:1 1 300px;max-width:420px;border:1px solid rgba(143,160,184,.35);border-left:3px solid ' + col + ';border-radius:6px;'
      + 'background:rgba(255,255,255,.02);padding:10px 12px">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
      + '<span style="font-size:13px;font-weight:700;letter-spacing:.04em">' + esc(ticketSymTxt(row)) + '</span>'
      + '<span style="font-size:9px;letter-spacing:.08em;font-weight:700;color:' + col + '">'
      + dir.toUpperCase() + '</span>'
      + '<span style="font-size:9px;letter-spacing:.08em;color:#9aa6b5">'
      + esc(String(row.dec.tier || '').toUpperCase()) + ' · ' + (isFinite(row.dec.agree) ? row.dec.agree : 0) + ' LAYERS</span>'
      + '<span style="font-size:9px;letter-spacing:.08em;font-weight:700;color:' + stCol + ';border:1px solid ' + stCol
      + ';border-radius:3px;padding:1px 5px" title="' + esc(st.note) + '">' + esc(st.label) + '</span>'
      + '<span style="font-size:9px;letter-spacing:.08em;font-weight:700;color:' + levCol + ';border:1px solid ' + levCol
      + ';border-radius:3px;padding:1px 5px" title="max safe leverage from the planner formula — floor(1 / (stop distance ×1.5 + 0.5% MMR)) — liquidation clearance ≥1.5× the stop">'
      + c.lev + 'x SAFE</span>'
      + '<span style="font-size:9px;letter-spacing:.08em;font-weight:700;color:' + swCol + ';border:1px solid ' + swCol
      + ';border-radius:3px;padding:1px 5px" title="entry timing window (IST) — gold-lane kill zones; off-hours tape means thinner books and worse fills">'
      + swTxt + '</span></div>'
      + '<div style="margin-top:6px;font-size:9px;letter-spacing:.1em;color:#9aa6b5">' + headline + '</div>'
      + '<div style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;color:' + col + ';line-height:1.25">'
      + PX(p.entry) + '</div>'
      + '<div style="font-size:10.5px;color:#c4ccd8">' + subline + '</div>'
      + '<div style="margin-top:6px;font-size:10.5px;line-height:1.7;color:#c4ccd8">'
      + 'STOP <b>' + PX(p.stop) + '</b>'
      + ' · T1 <b>' + PX(p.t1) + '</b>'
      + (p.t2 !== null && isFinite(p.t2) ? ' · T2 <b>' + PX(p.t2) + '</b>' : '')
      + ' · R:R ' + FMT(rr1, 1)
      + (isFinite(p.cancelIf) && p.cancelIf !== null ? '<br>cancel if 4h closes beyond <b>' + PX(p.cancelIf) + '</b>' : '')
      + '<br><span style="color:#9aa6b5">' + esc(st.note) + ' · as of ' + esc(stamp) + '</span>'
      + familyLineHTML(p)
      + '</div>'
      + ticketTradeBtn(row, dir)
      + '</div>';
  }catch(e){
    return '<div style="flex:1 1 300px;border:1px solid rgba(143,160,184,.4);border-radius:6px;padding:10px 12px">'
      + '<span style="font-size:11px;color:#9aa6b5">board row render failed: ' + esc(errMsg(e)) + '</span></div>';
  }
}
function paintLimitBoard(el, rows){
  try{
    if (!el || typeof el.querySelector !== 'function') return;
    var wrap = el.querySelector('#brainBoardWrap'), box = el.querySelector('#brainBoard');
    if (!wrap || !box) return;
    var b = buildLimitBoard(rows);
    var stamp = new Date().toTimeString().slice(0, 8);
    var html = '', i;
    /* SNIPER mode: resting limits only, mark IN ZONE/APPROACHING, >= 20x-safe
       stop — market-only rows sit out entirely; an empty read names the three
       requirements honestly instead of relaxing them */
    var limits = b.limits, marketOnly = b.marketOnly;
    if (__sniper){
      limits = limits.filter(function(c){
        return sniperOk(c, hgLimitState(c.row.plan, boardMarkFor(c.row), boardAtrFor(c.row)));
      });
      marketOnly = [];
    }
    if (!limits.length && !marketOnly.length){
      html = '<div class="note" style="font-size:11.5px;line-height:1.7">'
        + (__sniper
           ? 'No sniper-grade setups right now — a card must be a resting LIMIT with the mark IN ZONE or APPROACHING, '
             + 'a stop tight enough for ≥' + SNIPER_MIN_LEV + 'x (≤3% away), and a paying family record (EV > 0) when one exists. Nothing qualified; standing aside is the position.'
           : 'No qualified limit setups this scan — standing aside is the position.')
        + '</div>';
    }else{
      if (limits.length){
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
        for (i = 0; i < limits.length; i++) html += boardCardHTML(limits[i], stamp);
        html += '</div>';
      }else{
        html = '<div class="note" style="font-size:11.5px;line-height:1.7">No qualified limit setups this scan — standing aside is the position.</div>';
      }
      if (marketOnly.length){
        html += '<div style="margin-top:10px;border-top:1px dashed rgba(143,160,184,.35);padding-top:8px">'
          + '<div style="font-size:10px;letter-spacing:.1em;color:#9aa6b5;margin-bottom:6px">'
          + 'MARKET-ONLY (no limit anchor) — engine/builder market entries with the decline reason named; never dressed up as limits</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap">';
        for (i = 0; i < marketOnly.length; i++) html += boardCardHTML(marketOnly[i], stamp);
        html += '</div></div>';
      }
    }
    box.innerHTML = html;
    var age = el.querySelector('#brainBoardAge');
    if (age) age.textContent = 'levels as of ' + stamp + (__sniper ? ' · SNIPER filter ON (limits ≥' + SNIPER_MIN_LEV + 'x-safe, in/approaching zone)' : '')
      + ' — refreshed by every synthesis, including the AUTO cycle';
    wrap.style.display = 'block';
    /* family track records accrue from here: the board's plans auto-log with
       their setup family (12h dedupe) so per-card hit-rates stay honest */
    logBoardSetups(rows);
    /* sniper-grade snapshot: publish + ping the alert engine (chime/push
       policy lives in hgalert.js / the CI runner — plain data only here) */
    try{
      __lastSniperHits = sniperHitsFrom(rows);
      if (typeof G.hgAlertSniper === 'function') G.hgAlertSniper(__lastSniperHits);
    }catch(e){}
  }catch(e){ /* the board is additive — the ticket + cards stand without it */ }
}

/* =========================================================================
CLICK-TO-AUDIT LAYER BREAKDOWN — every row (PRIME/HIGH/WATCH/ASIDE/VETO,
gold lane too) carries a collapsed audit toggle. The full layer-by-layer
ledger renders LAZILY on click only — a 500-contract scan never expands 500
ledgers. Each line names the layer, its verdict (LONG/SHORT/NEUTRAL/VETO/
CAUTION/DARK/SILENT) and its one-line evidence; dark layers give the exact
dark reason. A layer with nothing recorded says 'no evidence recorded'.
Never throws.
========================================================================= */
var AUDIT_ORDER_CRYPTO = ['news','regime','rotation','onchain','fng','funding',
                          'engine','oiflow','squeeze','tape','liqs','liqpool','trend4h','mtf','volreg','fundz','btcrel','div','book','cvd','session'];
var AUDIT_ORDER_GOLD   = ['news','goldsetup','golddeep','goldbasis'];

function auditLineHTML(label, status, text){
  var st = String(status || 'SILENT').toUpperCase();
  var col = (st === 'LONG') ? '#5fbf8f'
          : (st === 'SHORT' || st === 'VETO') ? '#e4586b'
          : (st === 'CAUTION') ? '#d8a24a'
          : (st === 'DARK') ? '#8a93a3'
          : '#6d7684';
  return '<div style="display:flex;gap:8px;align-items:baseline;font-size:11px;line-height:1.7">'
    + '<span style="flex:0 0 82px;color:#9aa6b5;font-size:10px;letter-spacing:.06em">' + esc(label) + '</span>'
    + '<span style="flex:0 0 64px;color:' + col + ';font-size:10px;letter-spacing:.08em;font-weight:700">' + esc(st) + '</span>'
    + '<span style="color:#c4ccd8">' + esc(text) + '</span></div>';
}

function rowAuditHTML(row){
  try{
    if (!row || !row.col || typeof row.col !== 'object'){
      return '<div class="auditRows">'
        + auditLineHTML('AUDIT', 'SILENT', 'row no longer carries its layer ledger — rescan to audit') + '</div>';
    }
    var col = row.col, notes = col.notes || {};
    var order = (row.lane === 'gold') ? AUDIT_ORDER_GOLD : AUDIT_ORDER_CRYPTO;
    var seen = {}, out = [];
    for (var i = 0; i < order.length; i++){
      var L = order[i]; seen[L] = 1;
      var n = notes[L];
      out.push(auditLineHTML(L.toUpperCase(),
        (n && n.status) ? n.status : 'SILENT',
        (n && n.text) ? n.text : 'no evidence recorded'));
    }
    /* votes outside the canonical list (gate-guard cautions) — a guard whose
       text is the funding crowding chip is already the FUNDING line above */
    var vs = Array.isArray(col.votes) ? col.votes : [];
    for (var v = 0; v < vs.length; v++){
      var vv = vs[v];
      if (!vv || !vv.layer || seen[vv.layer]) continue;
      if (vv.layer === 'guard' && String(vv.text || '').indexOf('funding') === 0) continue;
      seen[vv.layer] = 1;
      out.push(auditLineHTML(String(vv.layer).toUpperCase(),
        vv.caution === true ? 'CAUTION' : String(vv.vote || 'neutral').toUpperCase(),
        vv.text || 'no evidence recorded'));
    }
    /* PLAN line — names the anchor source for structure-anchored limits, the
       gate-engine provenance (incl. any honest fallback label) otherwise.
       Only when the row actually carries a plan; plan-less rows stay as-is. */
    var pl = row.plan;
    if (pl && isFinite(pl.entry) && isFinite(pl.stop)){
      if (pl.entryType === 'limit' || pl.entryType === 'zone'){
        out.push(auditLineHTML('PLAN', String(pl.entryType).toUpperCase(),
          (pl.entryType === 'zone' ? 'price in zone — limit at zone edge ' : 'LIMIT @ ')
          + PX(pl.entry)
          + (pl.anchorNote ? ' — ' + pl.anchorNote : '')
          + ' · stop ' + PX(pl.stop)
          + (isFinite(pl.cancelIf) ? ' · cancel if 4h closes beyond ' + PX(pl.cancelIf) : '')));
      }else{
        out.push(auditLineHTML('PLAN', 'GATE',
          (pl.src ? String(pl.src) + ' levels' : 'gate-engine levels')
          + (pl.note ? ' — ' + pl.note : '')));
      }
    }
    return '<div class="auditRows">' + out.join('') + '</div>';
  }catch(e){
    try{
      return '<div class="auditRows">'
        + auditLineHTML('AUDIT', 'SILENT', 'audit render failed: ' + errMsg(e)) + '</div>';
    }catch(e2){ return ''; }
  }
}

function auditToggleHTML(row){
  try{
    var k = encodeURIComponent(String(row && row.sym || ''));
    if (!k) return '';
    return '<div style="margin-top:6px">'
      + '<span data-audit="' + k + '" style="cursor:pointer;user-select:none;font-size:9px;'
      + 'letter-spacing:.1em;color:#8fa0b8;border:1px solid rgba(143,160,184,.4);border-radius:3px;'
      + 'padding:1px 7px" title="layer-by-layer ledger for this row">▸ LAYER AUDIT</span>'
      + '<div data-audit-box="' + k + '" style="display:none;margin-top:6px;padding:6px 8px;'
      + 'border:1px solid rgba(143,160,184,.25);border-radius:4px;background:rgba(143,160,184,.05)"></div>'
      + '</div>';
  }catch(e){ return ''; }
}

/* delegated toggle — finds the row in the LAST completed synthesis and renders
   the ledger into that row's own box; collapsing releases the HTML again */
function auditToggleByKey(pane, key, btnEl){
  try{
    if (!pane || typeof pane.querySelector !== 'function' || !key) return;
    var box = pane.querySelector('[data-audit-box="' + key + '"]');
    if (!box) return;
    if (box.style.display === 'none'){
      var sym = decodeURIComponent(key), row = null;
      var rows = (__lastResult && Array.isArray(__lastResult.rows)) ? __lastResult.rows : [];
      for (var i = 0; i < rows.length; i++){
        if (rows[i] && rows[i].sym === sym){ row = rows[i]; break; }
      }
      box.innerHTML = row
        ? rowAuditHTML(row)
        : '<div class="auditRows">' + auditLineHTML('AUDIT', 'SILENT', 'row not in the last synthesis — rescan to audit') + '</div>';
      box.style.display = '';
      if (btnEl) btnEl.textContent = '▾ LAYER AUDIT';
    }else{
      box.style.display = 'none';
      box.innerHTML = '';   /* lazy both ways — the 500-row DOM stays lean */
      if (btnEl) btnEl.textContent = '▸ LAYER AUDIT';
    }
  }catch(e){}
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
    + auditToggleHTML(row)
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
  /* radar rows carry a plan whenever the planning pass reached them — the
     same never-invented planLine the PRIME/HIGH cards use; without one the
     row says so instead of hiding the gap */
  var plan = (row.plan && isFinite(row.plan.entry)) ? planLine(row.plan) : null;
  /* gate cautions (funding crowding etc.) are named on the row, never silent */
  var caut = (row.cautions && row.cautions.length) ? ' · ' + esc(row.cautions.join(' · ')) : '';
  /* path to the next tier — concrete layers named from what is dark/silent/
     dissenting right now, never a generic string */
  var path = pathToNextTier(row);
  return '<div class="lrow">'
    + '<span class="gid">' + esc(displaySym(row)) + '</span>'
    + '<span class="gname">' + (row.dec.dir ? row.dec.dir.toUpperCase() + ' bias — ' : '')
    + esc(row.dec.reasons[0] || '') + caut
    + (plan ? ' <span class="gdetail">' + plan + '</span>' : '')
    + '</span>'
    + '<span class="gdetail">' + row.dec.agree + ' agree' + (row.dec.disagree ? ' · ' + row.dec.disagree + ' contra' : '')
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '')
    + (path ? ' · ' + esc(path) : '') + '</span>'
    + '<span class="stamp na">WATCH</span>' + age + auditToggleHTML(row) + '</div>';
}

function asideRowHTML(row){
  var vetoed = row.dec.vetoes && row.dec.vetoes.length;
  var age = row.ageStamp ? ' <span class="stamp na">' + esc(String(row.ageStamp).toUpperCase()) + '</span>' : '';
  return '<div class="lrow">'
    + '<span class="gid">' + esc(displaySym(row)) + '</span>'
    + '<span class="gname">' + esc(row.dec.reasons[0] || 'aside') + '</span>'
    + '<span class="gdetail">' + row.dec.longCount + 'L/' + row.dec.shortCount + 'S'
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '') + '</span>'
    + '<span class="stamp ' + (vetoed ? 'veto' : 'na') + '">' + (vetoed ? 'VETO' : 'ASIDE') + '</span>' + age
    + auditToggleHTML(row) + '</div>';
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
var __busySince = 0;  /* same hung-await watchdog as engine.js: a synthesis whose
                         promise never settles (stalled fetch) would otherwise
                         freeze the BRAIN tab forever. A scan older than
                         BRAIN_BUSY_STUCK_MS is declared stuck; the guard opens. */
var BRAIN_BUSY_STUCK_MS = 8*60*1000;
function brainBusyStuck(){
  return !!__busy && __busySince > 0 && (Date.now() - __busySince) > BRAIN_BUSY_STUCK_MS;
}
var __hasRun = false;
var __mountedEl = null;
var __lastResult = null;  /* {rows, uni, at} — quick rescan rechecks this, never the wire */
var __lastTicketSnap = null; /* last painted entry tickets — alert seam snapshot */
var __regimeSnap = null;      /* {score, label, fng} from the last completed synthesis — chop banner */

async function brainRefresh(){
  try{
    if (__busy && !brainBusyStuck()) return 'busy';
    if (!__hasRun || !__mountedEl) return 'skipped: not run yet';
    await runBrain(__mountedEl);
    return 'refreshed';
  }catch(e){ return 'error'; }
}

/* ---------------- AUTO-WARM AT SYNTHESIS START ----------------
   RUN SYNTHESIS first INVOKES the same warm starters WARM UP LAYERS uses —
   one shared collection (warmHooksOrdered, engine LAST, the slow leg) so
   there is exactly ONE warm-invocation path and no layer is special-cased —
   then applies the bounded wait (Promise.race, TUN.warmColdMs, modestly
   raised for a genuinely cold start) BEFORE the layer snapshot. A cold
   layer whose scan lands inside the cap gets to VOTE instead of being
   judged dark; a layer that loses the race stays named-dark, and the stat
   line accounts honestly for both ('auto-warmed: engine, oiflow · still
   dark: regime (returned no state)'). Hooks are idempotent by contract
   ('fresh' when warm, 'busy' when their own scan is in-flight, an honest
   skip string otherwise — e.g. liqs' stream-only line, consumed without
   special-casing); a starter that throws/rejects is caught, NAMED, and its
   layer judged dark — never fatal. Skips starter invocation entirely when
   a warm pass (WARM UP or a previous synthesis) ran < 60s ago; QUICK
   RESCAN never auto-warms (it stays instant). Never blocks the scan
   indefinitely; never fabricates a warmed state. */
var __warmedAt = 0;

/* the warm starters in the button's invocation order — engine LAST (the
   deep gate scan is the slow leg). THE single collection both WARM UP
   LAYERS and the synthesis auto-warm consume. */
function warmHooksOrdered(){
  var hooks = [];
  try{
    var reg = Array.isArray(G.HG_warmups) ? G.HG_warmups : [];
    for (var i = 0; i < reg.length; i++){
      var h = reg[i];
      if (h && typeof h.run === 'function' && typeof h.id === 'string') hooks.push(h);
    }
  }catch(e){}
  hooks.sort(function(a, b){ return (a.id === 'engine' ? 1 : 0) - (b.id === 'engine' ? 1 : 0); });
  return hooks;
}

/* hook id -> snapshotLayers key for the auto-warm accounting. The SAME
   getters snapshotLayers reads, so 'warmed' means exactly 'now votes' */
var WARM_LAYER_KEY = { news: 'newsState', regime: 'regime', rotation: 'rotation',
                       onchain: 'onchain', engine: 'engine', oiflow: 'oiflow',
                       squeeze: 'squeeze' };

async function autoWarmIntoRun(stat){
  try{
    /* freshness window — a warm pass (button or previous synthesis) <60s
       ago makes starter invocation redundant; skip ENTIRELY */
    if (__warmedAt && (Date.now() - __warmedAt) < 60000) return '';
    var hooks = warmHooksOrdered();
    if (!hooks.length) return '';
    var ms = (isFinite(+TUN.warmColdMs) && +TUN.warmColdMs > 0) ? +TUN.warmColdMs
           : ((isFinite(+TUN.warmMs) && +TUN.warmMs > 0) ? +TUN.warmMs : 12000);
    var names = [];
    for (var n = 0; n < hooks.length; n++) names.push(hooks[n].id);
    try{
      if (stat){
        stat.className = 'note';
        stat.textContent = 'auto-warming layers — ' + names.join(', ')
          + ' (≤' + FMT(ms / 1000, 1) + 's)…';
      }
    }catch(e){}
    var pre = snapshotLayers();
    /* invoke every starter; per-hook containment — a sync throw or a
       rejection lands on THAT hook's record, never on the scan */
    var recs = [];
    var h;
    for (h = 0; h < hooks.length; h++) recs.push({ id: hooks[h].id, outcome: 'pending', text: '' });
    var pending = [];
    var engPending = null;
    for (h = 0; h < hooks.length; h++){
      (function(rec, run, isEng){
        try{
          var r = run();   /* hooks never throw per contract; strings pass through */
          if (r && typeof r.then === 'function'){
            var mp = r.then(
              function(v){ rec.outcome = 'value'; rec.text = (typeof v === 'string') ? v : 'warmed'; },
              function(e){ rec.outcome = 'error'; rec.text = errMsg(e); });
            pending.push(mp);
            if (isEng) engPending = mp;
          }else{
            rec.outcome = 'value'; rec.text = (typeof r === 'string') ? r : 'warmed';
          }
        }catch(e){ rec.outcome = 'error'; rec.text = errMsg(e); }
      })(recs[h], hooks[h].run, hooks[h].id === 'engine');
    }
    if (pending.length){
      var settle = (typeof Promise.allSettled === 'function')
        ? Promise.allSettled(pending)
        : Promise.all(pending.map(function(p){
            return p.then(function(v){ return { status: 'fulfilled', value: v }; },
                          function(e){ return { status: 'rejected', reason: e }; });
          }));
      /* every pending record resolves through its mapping handler above, so
         the race is the only cap the scan ever waits on */
      await Promise.race([
        settle,
        new Promise(function(res){ setTimeout(function(){ res('capped'); }, ms); })
      ]).then(null, function(){});
    }
    /* ENGINE PATIENCE: the 500-contract gate scan legitimately takes ~2 min —
      far beyond the shared 12s cap; without this extended wait a cold engine
      is dark at EVERY first synthesis and 500+ rows lose their structural
      voter (the 2026-07-25 all-ASIDE pattern). When the engine alone is
      still pending, wait on IT up to TUN.engineWarmMs; the stat line says
      so honestly. vm suites shorten via brainTunables. */
    try{
      var engRec = null;
      for (h = 0; h < recs.length; h++) if (recs[h].id === 'engine') engRec = recs[h];
      if (engPending && engRec && engRec.outcome === 'pending'){
        var engCap = (isFinite(+TUN.engineWarmMs) && +TUN.engineWarmMs > 0) ? +TUN.engineWarmMs : 240000;
        /* live progress, never a frozen-looking wait: the stat line counts
           the seconds while the gate scan works through 500+ contracts */
        var wStart = Date.now();
        while (engRec.outcome === 'pending' && (Date.now() - wStart) < engCap){
          if (stat){
            stat.textContent = 'engine gate scan running — '
              + Math.round((Date.now() - wStart) / 1000) + 's elapsed (≤'
              + FMT(engCap / 1000, 0) + 's on a cold start — the structural voter is worth the wait)…';
          }
          await new Promise(function(res){ setTimeout(res, 2000); });
        }
      }
    }catch(e){}
    /* accounting: what the auto-warm accomplished vs what stayed dark */
    var post = snapshotLayers();
    function liveAt(snap, key){
      try{ var v = snap[key]; return (v !== undefined && v !== null); }catch(e){ return false; }
    }
    var warmed = [], darkBits = [];
    for (var k = 0; k < recs.length; k++){
      var rec = recs[k];
      var key = Object.prototype.hasOwnProperty.call(WARM_LAYER_KEY, rec.id) ? WARM_LAYER_KEY[rec.id] : null;
      if (key && !liveAt(pre, key) && liveAt(post, key)){ warmed.push(rec.id); continue; }
      if (key && liveAt(pre, key)) continue;   /* already warm before we fired — nothing to claim */
      if (rec.outcome === 'error')
        darkBits.push(rec.id + ' (starter failed: ' + rec.text + ')');
      else if (rec.outcome === 'value' && rec.text.indexOf('error:') === 0)
        darkBits.push(rec.id + ' (' + rec.text + ')');
      else if (rec.outcome === 'value' && rec.text === 'busy')
        darkBits.push(rec.id + ' (already running)');
      else if (rec.outcome === 'value' && rec.text && rec.text !== 'fresh' && rec.text !== 'warmed')
        darkBits.push(rec.id + ' (' + rec.text + ')');   /* honest skip string, verbatim */
      else if (rec.outcome === 'pending')
        darkBits.push(rec.id + ' (still running — lands in its own time)');
      else if (key)
        darkBits.push(rec.id + ' (returned no state)');
      /* unmapped starters that came back fresh/warmed (gold lane etc.) say
         nothing here — their warmth shows in the deck itself */
    }
    var bits = [];
    if (warmed.length) bits.push('auto-warmed: ' + warmed.join(', '));
    if (darkBits.length) bits.push('still dark: ' + darkBits.join(' · '));
    /* the caller prefixes the accounting to the next phase's stat line, so it
       stays readable through the universe build instead of flashing past */
    return bits.join(' · ');
  }catch(e){ return ''; }
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
  if (__busy && !brainBusyStuck()) return;
  __busy = true; __busySince = Date.now();
  var t0 = Date.now();
  try{
    btn.disabled = true;
    cards.innerHTML = ''; watch.innerHTML = ''; aside.innerHTML = '';
    /* ENTRY TICKET stays up during the rescan — on the AUTO cycle a full
       synthesis can take most of the interval, and a blanked ticket would be
       invisible half the time. Stale levels with a named refresh state beat
       a hole; paintEntryTickets replaces them when the scan completes. */
    var ta0 = el.querySelector('#brainTicketAge');
    if (ta0 && ta0.textContent && ta0.textContent.indexOf('refreshing') !== 0){
      var m0 = /^levels as of (\S+)/.exec(ta0.textContent);
      ta0.textContent = 'refreshing — levels shown are as of ' + (m0 ? m0[1] : 'the last completed scan') + '…';
    }
    /* LIMIT BOARD carries the same refreshing semantics during the rescan */
    var ba0 = el.querySelector('#brainBoardAge');
    if (ba0 && ba0.textContent && ba0.textContent.indexOf('refreshing') !== 0){
      var bm0 = /^levels as of (\S+)/.exec(ba0.textContent);
      ba0.textContent = 'refreshing — levels shown are as of ' + (bm0 ? bm0[1] : 'the last completed scan') + '…';
    }
    if (read) read.textContent = '';
    empty.style.display = 'none';
    stat.className = 'note';
    __rescueFetches = 0;   /* per-scan 1h-rescue budget (RESCUE_CAP) */
    /* auto-warm: INVOKE the same starters WARM UP LAYERS uses, bounded-wait,
       account for what warmed vs what stayed dark — then judge as today */
    var warmNote = await autoWarmIntoRun(stat);
    __warmedAt = Date.now();
    /* the scan budget (TUN.scanMs) governs the SCAN — fetch + judge + plan.
       The warm phase is pre-scan work: with engine patience the warm can
       legitimately take ~3 min, and charging it to the scan budget starved
       planning of its own time ('planning timed out' right after a warm
       engine VOTED — the 09:02 run). t0 stays the honest total-wait clock
       for the done line; bt0 budgets the scan itself. */
    var bt0 = Date.now();

    stat.textContent = (warmNote ? warmNote + ' · ' : '') + 'reading every intelligence layer…';

    var snap = snapshotLayers();
    __regimeSnap = {
      score: (snap.regime && isFinite(+snap.regime.score)) ? +snap.regime.score : null,
      label: (snap.regime && snap.regime.label) ? String(snap.regime.label) : '',
      fng: (snap.fng && isFinite(+snap.fng.v)) ? +snap.fng.v : null
    };
    var uni = await buildUniverse();
    await fillTape(snap, uni);   /* legacy mode reuses the universe leg's tickers — one fetch per run */
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
    var bk = bucketRows(rows);
    var primes = bk.primes, highs = bk.highs, watches = bk.watches, asides = bk.asides;

    /* radar-gate tally — demotions are counted on the stat line, never silent */
    var gatedLiq = 0, gatedOver = 0;
    for (var gr = 0; gr < rows.length; gr++){
      if (rows[gr].gated === 'liquidity') gatedLiq++;
      else if (rows[gr].gated === 'overextended') gatedOver++;
    }
    var gateNote = gateTally(gatedLiq, gatedOver);

    var setups = primes.concat(highs);
    var capNote = '';

    if (combined){
      /* lazy, bounded candle fetching: 4h rows ONLY for crypto candidates at
         WATCH-or-better on the non-candle layers — the shared queue helper
         owns ordering, chunking, the fetch cap and the scan watchdog.
         The gold lane keeps its own candle path (goldPlan, unchanged). */
      var fq = await fetchCandleQueue(primes.concat(highs, watches), uni, stat, bt0);
      capNote = fq.capNote + fq.watchNote;
      /* TREND4H structural layer — post-fetch: EMA20/EMA50 + swing structure
         on the rows the queue already landed. A named structural vote can
         promote WATCH -> HIGH -> PRIME through the same pure brainDecide
         (bars never lowered); missing candles -> honestly dark, capped. */
      applyTrend4h(rows);
      applyMtf(rows);
      applyVolreg(rows);
      applyFundz(rows);
      applyBtcrel(rows);
      applyDiv(rows);
      applyBook(rows);
      applyCvd(rows);
      applySessionHaircut(rows);   /* off-hours haircut — last word before bucketing */
      bk = bucketRows(rows);   /* re-bucket after promotions/dark caps */
      primes = bk.primes; highs = bk.highs; watches = bk.watches; asides = bk.asides;
      setups = primes.concat(highs);
      /* plans for PRIME/HIGH first, then WATCH radar rows while the scan
         budget lasts — engine plans first, then the SMART $ / hgPlanLevels
         fallback over prefetched 4h rows. Levels are never invented; a row
         the budget or the candle cap cut simply says levels unavailable. */
      var planSet = setups.concat(watches);
      for (var sx = 0; sx < planSet.length; sx++){
        if (Date.now() - bt0 > TUN.scanMs){ capNote += ' · planning timed out — some levels unavailable'; break; }
        stat.textContent = 'planning ' + (sx + 1) + '/' + planSet.length + ' · ' + planSet[sx].sym;
        try{
          var gotx = (planSet[sx].lane === 'gold') ? await goldPlan(planSet[sx], snap)
                                                   : await cryptoPlanXu(planSet[sx], snap);
          planSet[sx].plan = gotx.plan; planSet[sx].rows = gotx.rows;
        }catch(e){ planSet[sx].plan = null; planSet[sx].rows = null; }
      }
    }else{
      /* legacy mode — today's flow, unchanged: bounded kline fetches per setup */
      for (var s = 0; s < setups.length; s++){
        if (Date.now() - bt0 > TUN.scanMs){ capNote += ' · planning timed out — some levels unavailable'; break; }
        stat.textContent = 'planning ' + (s + 1) + '/' + setups.length + ' · ' + setups[s].sym;
        try{
          var got = (setups[s].lane === 'gold') ? await goldPlan(setups[s], snap)
                                                : await cryptoPlan(setups[s], snap);
          setups[s].plan = got.plan; setups[s].rows = got.rows;
        }catch(e){ setups[s].plan = null; setups[s].rows = null; }
      }
    }

    /* LIQPOOL guard — post-plan pass: pools need the plan's stop/T1 */
    if (combined) applyLiqpool(planSet);
    else applyLiqpool(setups);

    /* render */
    var readTxt = marketRead(snap);
    if (read && readWrap){
      read.textContent = readTxt;
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
    /* ENTRY TICKET — best long + best short with computed plans, over the
       FULL row set so planned WATCH radar rows qualify too */
    paintEntryTickets(el, rows);
    watch.innerHTML = watches.map(safeWatchRowHTML).join('');
    watchWrap.style.display = watches.length ? 'block' : 'none';
    aside.innerHTML = asides.map(safeAsideRowHTML).join('');
    asideWrap.style.display = asides.length ? 'block' : 'none';
    if (!setups.length && !watches.length) empty.style.display = 'block';

    /* scorecard hook — PRIME/HIGH only, fire-and-forget, after plans land */
    scoreRecord(setups);
    /* quick-rescan baseline: full row set + universe + scan time */
    __lastResult = { rows: rows, uni: uni, at: Date.now() };
    /* signal-logger snapshot — deep-frozen copy of the completed synthesis */
    __lastSnap = buildSnapshot(rows, readTxt, Date.now());

    if (combined){
      stat.textContent = 'done · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
        + watches.length + ' watch · ' + asides.length + ' aside · universe '
        + uni.counts.total + ' (delta ' + uni.counts.delta + ' + cdcx ' + uni.counts.cdcx + ') + XAU · '
        + setups.length + ' prime/high · ' + watches.length + ' watch'
        + (uni.venue !== 'ALL' ? ' · venue ' + uni.venue : '')
        + gateNote + capNote + ' · '
        + ((Date.now() - t0) / 1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    }else{
      stat.textContent = 'done · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
        + watches.length + ' watch · ' + asides.length + ' aside · universe '
        + uni.candidates.length + ' + XAU (' + uni.note + ')'
        + (uni.xuNote ? ' · ' + uni.xuNote : '') + gateNote + capNote + ' · '
        + ((Date.now() - t0) / 1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
    }
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'brain synthesis failed: ' + (e && e.message ? e.message : e);
  }finally{
    __busy = false; __busySince = 0;
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
  if (__busy && !brainBusyStuck()) return;
  if (!__lastResult){
    stat.className = 'note warn';
    stat.textContent = 'quick rescan needs a full synthesis first — hit RUN SYNTHESIS once; '
      + 'quick mode only rechecks what the last scan already saw';
    return;
  }
  __busy = true; __busySince = Date.now();
  var t0 = Date.now();
  try{
    btn.disabled = true;
    if (qbtn) qbtn.disabled = true;
    stat.className = 'note';
    __rescueFetches = 0;   /* per-scan 1h-rescue budget (RESCUE_CAP) */
    stat.textContent = 'quick recheck — fresh layers over the last scan’s watch set…';

    var snap = snapshotLayers();
    __regimeSnap = {
      score: (snap.regime && isFinite(+snap.regime.score)) ? +snap.regime.score : null,
      label: (snap.regime && snap.regime.label) ? String(snap.regime.label) : '',
      fng: (snap.fng && isFinite(+snap.fng.v)) ? +snap.fng.v : null
    };
    await fillTape(snap);
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
    var bk = bucketRows(rows);
    var primes = bk.primes, highs = bk.highs, watches = bk.watches, asides = bk.asides;
    var setups = primes.concat(highs);
    var extraNote = '';

    /* radar-gate tally for THIS recheck pass — carried-over asides were
       counted at their own scan time, never double-counted here */
    var gatedLiq = 0, gatedOver = 0;
    for (var gq = 0; gq < rows.length; gq++){
      if (rows[gq].gated === 'liquidity') gatedLiq++;
      else if (rows[gq].gated === 'overextended') gatedOver++;
    }
    var gateNote = gateTally(gatedLiq, gatedOver);

    if (combined){
      /* fresh candles for the rechecked WATCH-or-better set — same bounded queue */
      var fq = await fetchCandleQueue(primes.concat(highs, watches), last.uni, stat, t0);
      /* same honesty contract as the full scan: a binding fetch cap is named */
      extraNote = fq.capNote + fq.watchNote;
      /* TREND4H over the freshly fetched rows — promotions re-decided, then
         re-bucketed exactly like the full scan */
      applyTrend4h(rows);
      applyMtf(rows);
      applyVolreg(rows);
      applyFundz(rows);
      applyBtcrel(rows);
      applyDiv(rows);
      applyBook(rows);
      applyCvd(rows);
      applySessionHaircut(rows);   /* off-hours haircut — last word before bucketing */
      bk = bucketRows(rows);
      primes = bk.primes; highs = bk.highs; watches = bk.watches; asides = bk.asides;
      setups = primes.concat(highs);
      /* same planning population as the full scan — WATCH radar rows keep
         their working limits across a quick rescan, never silently dropped */
      var qPlanSet = setups.concat(watches);
      for (var sx = 0; sx < qPlanSet.length; sx++){
        if (Date.now() - t0 > TUN.scanMs){ extraNote += ' · planning timed out — some levels unavailable'; break; }
        try{
          var gotx = (qPlanSet[sx].lane === 'gold') ? await goldPlan(qPlanSet[sx], snap)
                                                    : await cryptoPlanXu(qPlanSet[sx], snap);
          qPlanSet[sx].plan = gotx.plan; qPlanSet[sx].rows = gotx.rows;
        }catch(e){ qPlanSet[sx].plan = null; qPlanSet[sx].rows = null; }
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

    /* LIQPOOL guard — post-plan pass over the freshly planned set */
    applyLiqpool(combined ? qPlanSet : setups);

    /* unchanged verdicts carry over with an honest AS OF age stamp */
    for (var u = 0; u < unchanged.length; u++){
      unchanged[u].ageStamp = ageOf(unchanged[u].judgedAt || last.at);
      asides.push(unchanged[u]);
    }

    /* render — same shape as a full scan */
    var readTxt = marketRead(snap);
    if (read && readWrap){
      read.textContent = readTxt;
      readWrap.style.display = 'block';
    }
    cards.innerHTML = setups.map(safeCardHTML).join('');
    paintCharts(cards, setups);
    /* ENTRY TICKET — same contract as the full scan; the rechecked row set
       carries every freshly planned WATCH-or-better row */
    paintEntryTickets(el, rows);
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
    /* signal-logger snapshot — the quick rescan IS a completed synthesis */
    __lastSnap = buildSnapshot(allRows, readTxt, Date.now());

    stat.className = 'note';
    stat.textContent = 'quick rescan: ' + checked + ' checked · ' + unchanged.length + ' unchanged · '
      + ((Date.now() - t0) / 1000).toFixed(0) + 's' + newNote + extraNote
      + ' · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
      + watches.length + ' watch · ' + asides.length + ' aside'
      + gateNote
      + ' · ' + new Date().toTimeString().slice(0, 5);
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'quick rescan failed: ' + (e && e.message ? e.message : e);
  }finally{
    __busy = false; __busySince = 0;
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
  /* the SAME starter collection the synthesis auto-warm uses — one path */
  var hooks = warmHooksOrdered();
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
  /* auto-fire the synthesis over the warmed layers — mark the warm pass so the
     synthesis's own bounded warm-wait skips (hooks would only say 'fresh') */
  __warmedAt = Date.now();
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
      + 'news clear. <b>HIGH</b>: 4 agree, zero vetoes. <b>WATCH</b>: 3 agree, or 2 uncontested (radar — thin but nothing fights it), '
      + 'or one soft disagreement. <b>ASIDE</b>: any veto, a tie, contested or thin — the killing reason is shown. '
      + 'Engine rejections veto only at G4 liquidity / G5 news; a G2/G3 non-confirmation is named, never a kill. '
      + 'Dark layers are named and cap the tier. '
      + 'Radar quality gates cut low-quality setups with named reasons: WATCH-or-better needs ≥$5M known 24h turnover, '
      + 'a ±15%+ 24h tape move in the row’s direction kills a WATCH chase (PRIME/HIGH gets a caution chip), '
      + 'and same-direction funding ≥0.1%/8h chips a crowding caution — demotions are tallied on the stat line. '
      + 'After the candle fetch, TREND4H (4h EMA20/EMA50 + swing structure) can promote WATCH→HIGH→PRIME with a named '
      + 'structural vote; extreme F&amp;G (≤20 / ≥80) adds one contrarian context vote for the majors; '
      + 'extreme funding (≥0.1%/8h) AGAINST the row votes the crowd-fade (same-direction stays a caution chip, never a reward); '
      + 'every WATCH row names its concrete path to the next tier, and every row expands to a full layer-by-layer audit on click. '
      + 'A synthesis first waits on the layer warm hooks with a bounded cap — slow layers get a moment, '
      + 'still-dark layers are named, never fabricated. '
      + 'Plans come from the gate engine, the SMART $ builder or the universal hgPlanLevels fallback only — levels are never invented, '
      + 'and radar rows carry them whenever the candle cap reached the candidate. '
      + 'Universe: BTC/ETH/SOL + every Delta India + CoinDCX futures listing (combined, deduped by base, via xuniverse.js when '
      + 'present — else legacy Binance top-10; thin venue candle legs fall back to Binance inside xuCandles). '
      + 'Candles are fetched lazily, only for WATCH-or-better candidates (cap 40/scan). '
      + 'The TAPE layer reads 24h Binance momentum + turnover for every overlapping listing (±8% with ≥$10M behind it; ±25% flags fade, never a chase) — no extra fetch.</div>'
      + '</div>'
      + '<div class="panel" id="brainReadWrap" style="display:none;margin-top:10px"><h2>MARKET READ <span id="brainReadUni"></span></h2>'
      + '<div class="note" id="brainRead" style="font-size:12px;line-height:1.7"></div></div>'
      + '<div class="panel" id="brainTicketWrap" style="display:none;margin-top:10px">'
      + '<h2>ENTRY TICKET <span>the exact price to place your limit order at — MIN entry for the best long, MAX entry for the best short · '
      + 'stop, most-probable target, cancel-if and validity stated · levels come from the planners only, never invented — '
      + 'when a side has nothing, the ticket says so honestly</span></h2>'
      + '<div id="brainTicket"></div>'
      + '<div class="note warn" id="brainRegimeBanner" style="display:none;margin-top:8px;font-size:11.5px"></div>'
      + '<div class="note" id="brainTicketAge" style="margin-top:6px;font-size:10px"></div></div>'
      + '<div class="panel" id="brainBoardWrap" style="display:none;margin-top:10px">'
      + '<h2>LIMIT BOARD <span>every qualified setup, one exact resting limit each — sorted like the ticket '
      + '(tier · layers · R:R) · the state chip reads a zero-fetch mark, never a new candle fetch · '
      + 'market-entry plans sit separated below with the no-anchor reason named, never dressed up as limits — '
      + 'when nothing qualifies, the board says so honestly</span></h2>'
      + '<button class="btn ghost" id="brainSniper" style="margin:2px 0 6px;padding:3px 10px;font-size:10px;letter-spacing:.08em" '
      + 'title="SNIPER mode — the day-trade filter: resting LIMIT orders only, mark IN ZONE or APPROACHING, '
      + 'and a stop tight enough for ≥20x max-safe leverage (≤3% away, planner formula with 1.5× liquidation clearance). '
      + 'Stacks the odds; no filter can promise a stop never gets hit">SNIPER: ON</button>'
      + '<div id="brainBoard"></div>'
      + '<div class="note" id="brainBoardAge" style="margin-top:6px;font-size:10px"></div></div>'
      + '<div class="cards" id="brainCards" style="margin-top:10px"></div>'
      + '<div class="panel" id="brainWatchWrap" style="display:none;margin-top:10px"><h2>WATCH <span>one layer short of conviction</span></h2>'
      + '<div id="brainWatch"></div></div>'
      + '<div class="panel" id="brainAsideWrap" style="display:none;margin-top:10px"><h2>ASIDE <span>vetoed · tied · contested · thin — standing aside is a position</span></h2>'
      + '<div id="brainAside"></div></div>'
      + '<div class="empty" id="brainEmpty" style="display:none">No high-probability setups right now — standing aside is a position.</div>';
    __mountedEl = el;
    ensureStalenessTimer();   /* staleness guard ticks every 60s from first mount */
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
  /* 3b) SNIPER toggle — isolated; defaults ON (owner mandate), persists in
     localStorage; repaints the board from the LAST completed scan's rows,
     never triggers a scan itself */
  try{
    var snBtn = el.querySelector('#brainSniper');
    var snPaint = function(){
      snBtn.textContent = 'SNIPER: ' + (__sniper ? 'ON' : 'OFF');
      snBtn.style.color = __sniper ? '#5fbf8f' : '';
      snBtn.style.borderColor = __sniper ? 'rgba(95,191,143,.6)' : '';
    };
    if (snBtn){
      snPaint();
      snBtn.addEventListener('click', function(){
        try{
          __sniper = !__sniper;
          try{ if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem('hgBrainSniper', __sniper ? '1' : '0'); }catch(e){}
          snPaint();
          var lr = (__lastResult && Array.isArray(__lastResult.rows)) ? __lastResult.rows : [];
          if (lr.length) paintLimitBoard(el, lr);
        }catch(e){}
      });
    }
  }catch(e){ mountNote(el, 'brain mount degraded: sniper toggle unavailable — board still renders'); }
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
  /* 6) click-to-audit delegate — ONE listener on the pane root; every row's
     ▸ LAYER AUDIT toggle renders its ledger lazily on demand. Isolated: a
     hostile pane simply has no audit toggles, the scan still runs. */
  try{
    if (typeof el.addEventListener === 'function'){
      el.addEventListener('click', function(ev){
        try{
          var t = ev && ev.target;
          if (!t || typeof t.getAttribute !== 'function') return;
          var key = t.getAttribute('data-audit');
          if (!key && typeof t.closest === 'function'){
            var p = t.closest('[data-audit]');
            if (p) key = p.getAttribute('data-audit');
          }
          if (key) auditToggleByKey(el, key, t);
        }catch(e){}
      });
    }
  }catch(e){}
}

/* ---------------- registration ---------------- */
G.brainCollect = brainCollect;
G.brainDecide = brainDecide;
G.brainUniverse = brainUniverse;
/* structure-anchored limit seam: the pure planner — (dir, rows4h) ->
   {plan, note}; rows4h math only, never throws */
G.brainAnchorPlan = anchoredLimitPlan;
/* entry-ticket seam: the pure selector — rows -> {long, short, longNear,
   shortNear}; no DOM, no fetch, never throws */
G.__hgBrainTickets = buildEntryTickets;
/* limit-board seams: the pure builder — rows -> {limits, marketOnly} of
   ticket-ranked candidates; and the pure validity read — (plan, mark, atr)
   -> {state, label, note}. No DOM, no fetch, never throw */
G.__hgBrainBoard = buildLimitBoard;
/* sniper seam: the planner-formula max-safe leverage — (entry, stop, mmr?) ->
   1..100; pure, never throws */
G.__hgBrainSniperLev = sniperLev;
/* sniper filter predicate — (candidate, hgLimitState) -> bool; pure */
G.__hgBrainSniperOk = sniperOk;
/* 1h-rescue chooser — (plan4h, plan1h) -> the tighter valid plan; pure */
G.__hgBrainSniperPick = pickSniperPlan;
/* family seams: plan -> family tag; (log, kind) -> honest stats; pure */
G.__hgBrainPlanFamily = planFamily;
G.__hgBrainFamStats = familyStats;
G.__hgBrainEstWin = estWinRate;
/* sniper-grade seam: the current hit set (read-only; alert channels consume) */
G.hgSniperState = function(){ try{ return __lastSniperHits; }catch(e){ return []; } };
G.__hgBrainSniperHits = sniperHitsFrom;
/* Tier-1 layer seams (vm suites): pure candle/clock math, never throw */
G.__hgBrainMtf = { resampleDaily: resampleDaily, dailySide: dailySide };
G.__hgBrainAtrPct = atrPercentile;
G.__hgBrainSession = sessionWindow;
/* test seam: set/clear the synthesis clock — __hgBrainSetClock(ms|null).
   Production never calls this; scans keep using the real wall clock. */
G.__hgBrainSetClock = function(ms){ __sessionNowOverride = (ms === null || ms === undefined) ? null : ms; };
G.__hgBrainSessionHaircut = sessionHaircut;
G.__hgBrainApplySessionHaircut = applySessionHaircut;
G.__hgBrainLiqpool = liqpoolNote;
/* Tier-2/3 seams: pure math for the vm suites */
G.__hgBrainFundZ = fundingZ;
G.__hgBrainRsiDiv = rsiDivergence;
/* wick-adaptive stop + CVD seams */
G.__hgBrainWickBuf = wickBuffer;
G.__hgBrainCvd = cvdAssess;
G.hgLimitState = hgLimitState;
/* last painted ticket snapshot (alert/diagnostic seam, read-only) */
G.__hgBrainTicketNow = function(){ try{ return __lastTicketSnap; }catch(e){ return null; } };
/* click-to-audit seams: the ledger builder, the toggle, and a sym-keyed
   lookup over the last synthesis (console/debug friendly, read-only) */
G.rowAuditHTML = rowAuditHTML;
G.auditToggleByKey = auditToggleByKey;
G.__hgBrainAudit = function(sym){
  try{
    var rows = (__lastResult && Array.isArray(__lastResult.rows)) ? __lastResult.rows : [];
    for (var i = 0; i < rows.length; i++){
      if (rows[i] && rows[i].sym === sym) return rowAuditHTML(rows[i]);
    }
    return null;
  }catch(e){ return null; }
};
/* signal-logger seam: deep-frozen {at, marketRead, rows} of the LAST completed
   synthesis (full or quick), null before the first scan. Never throws. */
G.__hgBrainLast = function(){ try{ return __lastSnap; }catch(e){ return null; } };
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'brain', label: 'BRAIN', mount: function(el){ mount(el); }, refresh: brainRefresh });

})();
