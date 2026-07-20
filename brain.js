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
    inputs  = {sym, lane:'crypto'|'gold', news, regime, rotation, onchain,
               engine, oiflow, squeeze, liq, gold}
    vote    = {layer, vote:'long'|'short'|'neutral'|'veto', text,
               kind:'structural'|'positioning'|'context', caution?, strong?}
  window.brainDecide(votes, meta?) -> {tier, dir, agree, disagree,
    longCount, shortCount, vetoes, reasons, hasStructural, hasPositioning,
    newsCaution, cappedFrom}

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

Classic script, no build step. Loads after every module it reads; absence of
any module degrades honestly. Registers via
  window.HG_tabs.push({id:'brain', label:'BRAIN', mount, refresh})
refresh(): async, never throws, returns 'refreshed' | 'skipped: not run yet'
| 'busy' | 'error', busy-guarded, and never fires a first-time synthesis
from a global hard refresh.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables ---------------- */
var BASE_SYMS   = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];   /* always in the universe */
var TOP_ALTS    = 10;                                   /* extra alts by 24h turnover */
var KLINES_4H   = 120;
var KLINES_1H   = 120;
var PLAN_MIN_TIER = 'HIGH';                             /* plans only for PRIME/HIGH cards */
/* fiat/stable + metal perps are not alts for the rotation universe */
var ALT_BLOCK   = { USDCUSDT:1, FDUSDUSDT:1, TUSDUSDT:1, BUSDUSDT:1, USDPUSDT:1,
                    DAIUSDT:1, EURUSDT:1, GBPUSDT:1, XAUUSDT:1, PAXGUSDT:1 };

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
  var isBtc = sym.toUpperCase().indexOf('BTC') === 0;
  var votes = [], unavailable = [], silent = [];

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
      if (sv && sv.sym === sym && isDir(sv.dir)){
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
        if (rj && rj.sym === sym){
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
      if (or && or.sym === sym && isDirUp(or.dir)){
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
      if (sr && sr.sym === sym){
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
    if (isDir(lf.dir) && (!lf.sym || lf.sym === sym))
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

/* ---------------- candidate universe ---------------- */
async function buildUniverse(){
  var out = { cryptos: BASE_SYMS.slice(), ticks: null,
              note: 'BTC/ETH/SOL only — Binance turnover feed unavailable, top-10 alts skipped' };
  try{
    if (typeof G.binanceTickers24h !== 'function') return out;
    var ticks = await G.binanceTickers24h();
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
    out.cryptos = BASE_SYMS.concat(alts);
    out.ticks = ticks;
    out.note = alts.length
      ? 'BTC/ETH/SOL + top-' + alts.length + ' alts by 24h turnover + XAU gold lane'
      : 'BTC/ETH/SOL only — no alt turnover data';
    return out;
  }catch(e){ return out; }
}

/* ---------------- collect + decide for one candidate ---------------- */
function judgeCrypto(sym, snap){
  var col = brainCollect({
    sym: sym, lane: 'crypto',
    news: newsFor(sym),
    regime: snap.regime, rotation: snap.rotation, onchain: snap.onchain,
    engine: snap.engine, oiflow: snap.oiflow, squeeze: snap.squeeze,
    liq: (snap.liqSetup === undefined ? undefined : snap.liqSetup)
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  return { sym: sym, lane: 'crypto', col: col, dec: dec };
}

function judgeGold(snap){
  var col = brainCollect({
    sym: 'XAU', lane: 'gold',
    news: newsFor('XAUUSDT'),
    gold: { setup: snap.goldSetup, deep: snap.goldDeep, basis: snap.goldBasis }
  });
  var dec = brainDecide(col.votes, { unavailable: col.unavailable });
  return { sym: 'XAU', lane: 'gold', col: col, dec: dec };
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

function enginePlanFor(sym, snap){
  try{
    var en = snap.engine;
    if (!en || !Array.isArray(en.survivors)) return null;
    for (var i = 0; i < en.survivors.length; i++){
      var sv = en.survivors[i];
      /* engineState survivor plan is {entry,stop,t1,t2} — dir lives on the
         survivor record, so inject it before normalizing */
      if (sv && sv.sym === sym && sv.plan){
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
  try{ var r4 = await G.binanceKlines(sym, '4h', KLINES_4H); out.rows4h = (r4 && r4.length) ? r4 : null; }catch(e){}
  try{ var r1 = await G.binanceKlines(sym, '1h', KLINES_1H); out.rows1h = (r1 && r1.length) ? r1 : null; }catch(e){}
  return out;
}

/* plan for a crypto PRIME/HIGH card: engine survivor plan -> smartSetup ->
   hgPlanLevels -> honest 'levels unavailable'. */
async function cryptoPlan(row, snap){
  var ep = enginePlanFor(row.sym, snap);
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

/* gold lane plan: the stashed goldSetupDecision levels -> XAU 4h fallback */
async function goldPlan(row, snap){
  var gs = snap.goldSetup;
  var gp = normalizePlan(gs, 'gold setup');
  if (gp) return { plan: gp, rows: null };
  var rows = null;
  try{
    if (typeof G.getXAUCandles === 'function'){
      var h4 = await G.getXAUCandles('4h', KLINES_4H);
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
    + ' · ' + dec.agree + ' LAYER' + (dec.agree === 1 ? '' : 'S') + '</span></div>'
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

function watchRowHTML(row){
  return '<div class="lrow">'
    + '<span class="gid">' + esc(row.sym === 'XAU' ? 'XAU' : row.sym.replace(/USDT$/, '')) + '</span>'
    + '<span class="gname">' + (row.dec.dir ? row.dec.dir.toUpperCase() + ' bias — ' : '')
    + esc(row.dec.reasons[0] || '') + '</span>'
    + '<span class="gdetail">' + row.dec.agree + ' agree' + (row.dec.disagree ? ' · ' + row.dec.disagree + ' contra' : '')
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '') + '</span>'
    + '<span class="stamp na">WATCH</span></div>';
}

function asideRowHTML(row){
  var vetoed = row.dec.vetoes && row.dec.vetoes.length;
  return '<div class="lrow">'
    + '<span class="gid">' + esc(row.sym === 'XAU' ? 'XAU' : row.sym.replace(/USDT$/, '')) + '</span>'
    + '<span class="gname">' + esc(row.dec.reasons[0] || 'aside') + '</span>'
    + '<span class="gdetail">' + row.dec.longCount + 'L/' + row.dec.shortCount + 'S'
    + (row.col.unavailable.length ? ' · ' + row.col.unavailable.length + ' dark' : '') + '</span>'
    + '<span class="stamp ' + (vetoed ? 'veto' : 'na') + '">' + (vetoed ? 'VETO' : 'ASIDE') + '</span></div>';
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

/* ---------------- tab state + hard-refresh contract ---------------- */
var __busy = false;
var __hasRun = false;
var __mountedEl = null;

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
  if (!btn || !stat || !cards || !watch || !aside || !empty) return;
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

    /* collect + decide — fully synchronous once layers are snapshotted */
    var rows = [];
    for (var i = 0; i < uni.cryptos.length; i++) rows.push(judgeCrypto(uni.cryptos[i], snap));
    rows.push(judgeGold(snap));

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

    /* plans only for PRIME/HIGH — bounded kline fetches, engine plans first */
    var setups = primes.concat(highs);
    for (var s = 0; s < setups.length; s++){
      stat.textContent = 'planning ' + (s + 1) + '/' + setups.length + ' · ' + setups[s].sym;
      try{
        var got = (setups[s].lane === 'gold') ? await goldPlan(setups[s], snap)
                                              : await cryptoPlan(setups[s], snap);
        setups[s].plan = got.plan; setups[s].rows = got.rows;
      }catch(e){ setups[s].plan = null; setups[s].rows = null; }
    }

    /* render */
    if (read && readWrap){
      read.textContent = marketRead(snap);
      readWrap.style.display = 'block';
    }
    cards.innerHTML = setups.map(cardHTML).join('');
    paintCharts(cards, setups);
    watch.innerHTML = watches.map(watchRowHTML).join('');
    watchWrap.style.display = watches.length ? 'block' : 'none';
    aside.innerHTML = asides.map(asideRowHTML).join('');
    asideWrap.style.display = asides.length ? 'block' : 'none';
    if (!setups.length && !watches.length) empty.style.display = 'block';

    stat.textContent = 'done · ' + primes.length + ' PRIME · ' + highs.length + ' HIGH · '
      + watches.length + ' watch · ' + asides.length + ' aside · universe '
      + uni.cryptos.length + ' + XAU (' + uni.note + ') · '
      + ((Date.now() - t0) / 1000).toFixed(0) + 's · ' + new Date().toTimeString().slice(0, 5);
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'brain synthesis failed: ' + (e && e.message ? e.message : e);
  }finally{
    __busy = false;
    __hasRun = true;
    btn.disabled = false;
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<div class="panel">'
      + '<h2>BRAIN — meta-intelligence <span>reads every layer · evidence agreement, not scores</span></h2>'
      + '<div class="row"><button class="btn" id="brainRun">RUN SYNTHESIS</button>'
      + '<span class="note" id="brainStat"></span></div>'
      + '<div class="note" id="brainDeps" style="margin-top:8px"></div>'
      + '<div class="note" style="margin-top:8px">Conviction is independent layers <b>agreeing</b>, each with a human-readable '
      + 'evidence string — never an invented number. <b>PRIME</b>: 5+ layers agree incl. structural + positioning, zero vetoes, '
      + 'news clear. <b>HIGH</b>: 4 agree, zero vetoes. <b>WATCH</b>: 3 agree or one soft disagreement. <b>ASIDE</b>: any veto, '
      + 'a tie, contested or thin — the killing reason is shown. Dark layers are named and cap the tier. '
      + 'Plans come from the gate engine, the SMART $ builder or the universal hgPlanLevels fallback only — levels are never invented.</div>'
      + '</div>'
      + '<div class="panel" id="brainReadWrap" style="display:none;margin-top:10px"><h2>MARKET READ</h2>'
      + '<div class="note" id="brainRead" style="font-size:12px;line-height:1.7"></div></div>'
      + '<div class="cards" id="brainCards" style="margin-top:10px"></div>'
      + '<div class="panel" id="brainWatchWrap" style="display:none;margin-top:10px"><h2>WATCH <span>one layer short of conviction</span></h2>'
      + '<div id="brainWatch"></div></div>'
      + '<div class="panel" id="brainAsideWrap" style="display:none;margin-top:10px"><h2>ASIDE <span>vetoed · tied · contested · thin — standing aside is a position</span></h2>'
      + '<div id="brainAside"></div></div>'
      + '<div class="empty" id="brainEmpty" style="display:none">No high-probability setups right now — standing aside is a position.</div>';
    __mountedEl = el;
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
    var btn = el.querySelector('#brainRun');
    if (btn) btn.addEventListener('click', function(){ runBrain(el); });
  }catch(e){ /* never throw at mount */ }
}

/* ---------------- registration ---------------- */
G.brainCollect = brainCollect;
G.brainDecide = brainDecide;
G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'brain', label: 'BRAIN', mount: function(el){ mount(el); }, refresh: brainRefresh });

})();
