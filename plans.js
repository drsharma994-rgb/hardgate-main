/* HARDGATE — shared setup/plan primitives (all tabs).
   Loaded after indicators.js + cryptogates.js. Pure exports, never throw. */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_STOP_BUFFER_ATR = 0.25;
var HG_STOP_CAP_DIST_ATR = 2.5;
var HG_STOP_FALLBACK_ATR = 1.5;
/* Beyond this the structure is not a stop, it is a different trade. */
var HG_STOP_MAX_DIST_ATR = 6.0;
var HG_SWEEP_STOP_ATR = 0.5;
var HG_SWEEP_RECLAIM_MAX = 3;
var HG_SWEEP_RECLAIM_BODY_ATR = 0.8;
var HG_T1_R = 2;
var HG_T2_R = 3.5;
var HG_SCALP_T1_R = 1.5;
var HG_SCALP_T2_R = 2.5;
var HG_MIN_RR_SWING = 1.5;
var HG_MIN_RR_DEFAULT = 2.0;
var HG_G5_VOLZ_MIN = 0.5;      /* MUST equal engine.js VOLZ_MIN — see tests/test-gate-parity.mjs */
var HG_SPREAD_MIN_ATR = 0.25;

function _last(arr){
  if (typeof last === 'function') return last(arr);
  return (arr && arr.length) ? arr[arr.length - 1] : NaN;
}

/* --- confirmed trend cascade (single definition for badges) --- */
function hgConfirmedCascade(rows, style){
  var out = { confirmed: false, dir: null, label: 'n/a', style: style || 'smart' };
  try{
    if (!rows || rows.length < 55 || typeof ema !== 'function') return out;
    var closes = rows.map(function(r){ return r.c; });
    var n = closes.length - 1;
    style = String(style || 'smart').toLowerCase();
    if (style === 'swing' || style === 'cryptogates'){
      var e9a = ema(closes, 9), e21a = ema(closes, 21), e50a = ema(closes, 50);
      var e9 = e9a[n], e21 = e21a[n], e50 = e50a[n];
      if (!(isFinite(e9) && isFinite(e21) && isFinite(e50))) return out;
      var dir = null;
      if (e9 > e21 && e21 > e50) dir = 'long';
      else if (e9 < e21 && e21 < e50) dir = 'short';
      var spreadOk = true;
      if (typeof atr === 'function'){
        var a = _last(atr(rows, 14));
        spreadOk = isFinite(a) && a > 0 && Math.abs(e21 - e50) >= HG_SPREAD_MIN_ATR * a;
      }
      out.dir = (dir && spreadOk) ? dir : null;
      out.confirmed = !!out.dir;
      out.label = out.confirmed ? ('SWING cascade ' + dir.toUpperCase()) : 'cascade mixed or spread thin';
      return out;
    }
    /* smart / default: EMA20/50 */
    var e20 = _last(ema(closes, 20)), e50b = _last(ema(closes, 50));
    if (!(isFinite(e20) && isFinite(e50b))) return out;
    if (e20 > e50b){ out.dir = 'long'; out.confirmed = true; out.label = 'EMA20>EMA50 long'; }
    else if (e20 < e50b){ out.dir = 'short'; out.confirmed = true; out.label = 'EMA20<EMA50 short'; }
    return out;
  }catch(e){ return out; }
}

/* --- regime filter by setup style --- */
function hgRegimeAllowsSetup(rows, style){
  try{
    if (typeof detectRegime !== 'function' || !rows || !rows.length) return { allow: true, reason: null };
    var dr = detectRegime(rows);
    if (!dr || !dr.regime) return { allow: true, reason: null };
    style = String(style || 'swing').toLowerCase();
    if (dr.regime === 'volatile' && (style === 'swing' || style === 'edge' || style === 'scalp')){
      return { allow: false, reason: dr.label + ' — volatile tape, skip trend continuation' };
    }
    if (dr.regime === 'compression' && (style === 'swing' || style === 'edge' || style === 'best')){
      return { allow: false, reason: dr.label + ' — compression chop, wait for expansion' };
    }
    if (dr.regime === 'compression' && (style === 'meanrev' || style === 'squeeze')){
      return { allow: true, reason: dr.label + ' — compression friendly for ' + style };
    }
    return { allow: true, reason: dr.label || null };
  }catch(e){
    return { allow: true, unchecked: true, reason: 'regime check threw: ' + hgErrText(e) };
  }
}

/* --- 4H tape regime label (STRONG TREND / WEAK TREND / …) for card UI --- */
function hgTapeRegimeLabel(rows){
  try{
    if (typeof detectRegime !== 'function' || !rows || rows.length < 60) return 'DATA THIN';
    var dr = detectRegime(rows);
    return (dr && dr.label) ? dr.label : 'n/a';
  }catch(e){ return 'n/a'; }
}

/* --- Binance twin funding for CoinDCX / thin tickers (G4 stays honest) --- */
async function hgEnrichTickerFundingTwin(ticker){
  try{
    if (!ticker) return ticker;
    if (ticker.fundingPct !== null && ticker.fundingPct !== undefined && isFinite(+ticker.fundingPct)) return ticker;
    var mapFn = (typeof G.biasBinanceSymbol === 'function') ? G.biasBinanceSymbol : null;
    var fundFn = (typeof G.binanceFunding === 'function') ? G.binanceFunding : null;
    if (!mapFn || !fundFn) return ticker;
    var bSym = mapFn(ticker.symbol);
    if (!bSym) return ticker;
    var bf = await fundFn(bSym);
    /* +null is 0, so a twin with no rate used to pass this guard and be
       written onto the ticker as a confident 0.0000% — this function exists
       to keep G4 honest for thin CoinDCX contracts, and it was filling the
       gap with a fabricated number instead of leaving it empty. */
    var twinPct = hgPlanNum(bf && bf.fundingPct);
    if (!isFinite(twinPct)) return ticker;
    return Object.assign({}, ticker, { fundingPct: twinPct, fundingTwin: bSym });
  }catch(e){ return ticker; }
}

function hgIsBtcSymbol(sym){
  try{
    var s = String(sym || '').replace(/^B-/, '').replace(/_/g, '');
    return /^BTC/i.test(s) || s === 'BTCUSD' || s === 'BTCUSDT';
  }catch(e){ return false; }
}

function hgBtcCandleSymbol(ticker){
  try{
    if (!ticker || !ticker.symbol) return 'BTCUSD';
    return String(ticker.symbol).indexOf('B-') === 0 ? 'B-BTC_USDT' : 'BTCUSD';
  }catch(e){ return 'BTCUSD'; }
}

/* Stale cascade with no displacement — same rule as BEST time-decay veto. */
/* A gate that could not run must never read as a gate that passed. Every exit
   that skips the actual check reports `unchecked` so the caller can say
   UNCHECKED on the card rather than presenting a clean ledger for a test that
   never happened. `veto:false` alone is not evidence of anything. */
function hgUncheckedGate(reason){
  return { veto: false, unchecked: true, uncheckedReason: reason || 'check unavailable' };
}
function hgErrText(e){
  try{ return (e && e.message) ? String(e.message) : String(e || 'error'); }catch(e2){ return 'error'; }
}

function hgStaleMomentumVeto(rows, dir, entry){
  try{
    if (!dir || !isFinite(+entry)) return hgUncheckedGate('stale-momentum: no direction/entry to test');
    if (!rows || rows.length < 60){
      return hgUncheckedGate('stale-momentum: ' + ((rows && rows.length) || 0) + ' bars, needs 60');
    }
    var c = rows.map(function(r){ return r.c; });
    var p = +c[c.length - 1];
    var a4 = (typeof last === 'function' && typeof atr === 'function') ? last(atr(rows, 14)) : NaN;
    var e9a = ema(c, 9), e21a = ema(c, 21), e50a = ema(c, 50);
    var cascadeAgeBars = 0;
    for (var b = c.length - 1; b >= 0; b--){
      if (dir === 'long' && (e9a[b] <= e21a[b] || e21a[b] <= e50a[b])) break;
      if (dir === 'short' && (e9a[b] >= e21a[b] || e21a[b] >= e50a[b])) break;
      cascadeAgeBars++;
    }
    if (!isFinite(a4) || !(a4 > 0)) return hgUncheckedGate('stale-momentum: ATR unavailable');
    if (cascadeAgeBars > 6){
      if (Math.abs(p - entry) < a4 * 1.0){
        return { veto: true, reason: 'STALE MOMENTUM: cascade ' + cascadeAgeBars + ' bars old, displacement < 1×ATR' };
      }
    }
    return { veto: false, checked: true };
  }catch(e){ return hgUncheckedGate('stale-momentum check threw: ' + hgErrText(e)); }
}

/* Map venue symbol → Binance USD-M leg for flow/funding twins (free public REST). */
function hgFlowBinanceSymbol(sym){
  try{
    if (!sym) return null;
    var s = String(sym).toUpperCase();
    if (/^XAU|^XAUT|^GOLD/.test(s.replace(/[^A-Z]/g, '')) || s.indexOf('XAU') === 0) return 'XAUUSDT';
    if (typeof G.biasBinanceSymbol === 'function'){
      var twin = G.biasBinanceSymbol(sym);
      if (twin) return twin;
    }
    if (/^B-[A-Z0-9]+_USDT$/.test(s)) return s.replace(/^B-/, '').replace('_', '');
    if (/USDT$/.test(s) && s.indexOf('B-') !== 0) return s;
    return s.replace(/[^A-Z0-9]/g, '') + 'USDT';
  }catch(e){ return null; }
}

/* Shared flow trap + Bybit cross (BEST F8 parity). */
async function hgAssessFlowTrap(sym, dir, fundingPct, tf){
  var out = { veto: false, flowOk: false, flowNA: false, flowDetail: 'FLOW N/A', crossOk: false, reason: null };
  try{
    tf = tf || '1h';
    dir = String(dir || '').toLowerCase();
    var bSym = hgFlowBinanceSymbol(sym);
    var flowFn = (typeof G.hgFlowTrapAssess === 'function') ? G.hgFlowTrapAssess : null;
    if (!bSym || !flowFn || typeof G.binanceTakerRatio !== 'function' || typeof G.binanceDepth !== 'function'){
      out.flowNA = true;
      out.flowDetail = 'FLOW N/A — no Binance twin for ' + String(sym || '—');
      return out;
    }
    var spotFn = (typeof G.binanceSpotTakerFlow === 'function') ? G.binanceSpotTakerFlow : null;
    var legs = await Promise.all([
      G.binanceTakerRatio(bSym, tf, 25).catch(function(){ return null; }),
      G.binanceDepth(bSym, 20).catch(function(){ return null; }),
      spotFn ? spotFn(bSym, tf, 25).catch(function(){ return null; }) : Promise.resolve(null)
    ]);
    var spotSeries = (legs[2] && legs[2].series) ? legs[2].series : null;
    var ft = flowFn(legs[0] && legs[0].series ? legs[0].series : null, legs[1], dir, spotSeries);
    if (ft){
      out.veto = ft.veto === true;
      out.flowOk = ft.flowOk === true;
      out.reason = ft.reason || null;
      out.flowDetail = 'CVD ' + (ft.cvdAligned ? '✓' : '✗') + ' · OBI ' + (ft.obiAligned ? '✓' : '✗')
        + ' · SPOT ' + (ft.spotPerpAligned ? '✓' : (spotSeries ? '✗' : '—'));
    }
    if (typeof G.bybitPositioningSnapshot === 'function' && typeof G.positioningCrossCheck === 'function'){
      var byb = await G.bybitPositioningSnapshot(bSym).catch(function(){ return null; });
      var cross = G.positioningCrossCheck(
        { fundingPct: fundingPct, retailLongPct: null, oiChgPct: null },
        byb
      );
      if (cross){
        if (cross.status === 'confirmed' || cross.status === 'partial'){
          out.crossOk = true;
          out.flowDetail += ' · CROSS ' + (cross.status === 'confirmed' ? '✓' : '~');
          out.flowOk = out.flowOk || out.crossOk;
        } else if (cross.status === 'conflict' && ft && !ft.veto){
          out.flowDetail += ' · CROSS conflict';
        }
      }
    }
    if (!ft && !out.crossOk){ out.flowNA = true; out.flowDetail = 'FLOW PARTIAL — legs thin'; }
    return out;
  }catch(e){ out.flowNA = true; return out; }
}

/* Post-gate vetoes — flow trap, BTC relative strength, stale momentum. Gates unchanged. */
async function hgPostGateSetupVeto(ticker, hit, rows, style, getCandles){
  try{
    style = String(style || 'swing').toLowerCase();
    if (!hit || !hit.dir) return { ok: true };
    var dir = hit.dir;
    var sym = ticker && ticker.symbol;
    var unchecked = [];
    var stale = hgStaleMomentumVeto(rows, dir, hit.entry);
    if (stale.veto) return { ok: false, reason: stale.reason, tag: 'stale' };
    if (stale.unchecked) unchecked.push(stale.uncheckedReason);
    var tf = (style === 'scalp' || style === 'gold-scalp') ? '1h' : '4h';
    var fr = (ticker && ticker.fundingPct != null && isFinite(+ticker.fundingPct)) ? +ticker.fundingPct : null;
    var flow = await hgAssessFlowTrap(sym, dir, fr, tf);
    if (flow.veto) return { ok: false, reason: flow.reason || 'flow trap', tag: 'flow', flowDetail: flow.flowDetail };
    if (flow.flowNA) unchecked.push('flow trap: ' + (flow.flowDetail || 'no flow legs'));
    var rsEdge = null;
    if (!hgIsBtcSymbol(sym) && style.indexOf('gold') < 0 && typeof hgRelStrength === 'function' && typeof getCandles === 'function'){
      var look = (typeof G.HG_RS_LOOK === 'number') ? G.HG_RS_LOOK : 30;
      var btcRows = await getCandles(hgBtcCandleSymbol(ticker), tf, look + 40);
      var rsr = hgRelStrength(rows, btcRows, dir, look);
      if (rsr.available && !rsr.ok) return { ok: false, reason: rsr.note || 'lagging BTC', tag: 'rs' };
      if (rsr.available && isFinite(rsr.edge)) rsEdge = rsr.edge;
      if (!rsr.available) unchecked.push('BTC relative strength: ' + (rsr.note || 'no BTC series'));
    }
    return {
      ok: true, flowOk: flow.flowOk, flowNA: flow.flowNA, flowDetail: flow.flowDetail,
      crossOk: flow.crossOk, rsEdge: rsEdge,
      unchecked: unchecked.length > 0, uncheckedReasons: unchecked
    };
  }catch(e){
    /* The gate threw. It did not pass — nothing was tested. Say so. */
    return { ok: true, unchecked: true, uncheckedReasons: ['post-gate threw: ' + hgErrText(e)] };
  }
}

/* Gold tabs — stale + XAUUSDT flow (no BTC RS). */
async function hgPostGateGoldVeto(cand, hit, rows15m, rows4h, style){
  try{
    style = String(style || 'gold-scalp').toLowerCase();
    if (!hit || !hit.dir) return { ok: true };
    var dir = hit.dir;
    var rows = (style === 'gold-scalp' && rows15m && rows15m.length >= 60) ? rows15m : rows4h;
    var unchecked = [];
    var stale = hgStaleMomentumVeto(rows, dir, hit.entry);
    if (stale.veto) return { ok: false, reason: stale.reason, tag: 'stale' };
    if (stale.unchecked) unchecked.push(stale.uncheckedReason);
    var sym = (cand && cand.sym) ? cand.sym : 'XAUUSDT';
    var flow = await hgAssessFlowTrap(sym, dir, null, style === 'gold-scalp' ? '1h' : '4h');
    if (flow.veto) return { ok: false, reason: flow.reason || 'flow trap', tag: 'flow', flowDetail: flow.flowDetail };
    if (flow.flowNA) unchecked.push('flow trap: ' + (flow.flowDetail || 'no flow legs'));
    return {
      ok: true, flowOk: flow.flowOk, flowNA: flow.flowNA, flowDetail: flow.flowDetail,
      unchecked: unchecked.length > 0, uncheckedReasons: unchecked
    };
  }catch(e){
    return { ok: true, unchecked: true, uncheckedReasons: ['post-gate threw: ' + hgErrText(e)] };
  }
}

/* Mark a candidate as carrying a gate that could not be evaluated. It is NOT
   demoted — an unrunnable check is not evidence against the trade — but the
   stamp travels to the card so the reader can see the ledger is incomplete. */
function hgMarkGateUnchecked(c, reasons){
  if (!c) return;
  var list = (Array.isArray(reasons) && reasons.length) ? reasons : ['post-gate could not be evaluated'];
  c.postGateUnchecked = true;
  c.postGateUncheckedReasons = (c.postGateUncheckedReasons || []).concat(list);
  var stamp = 'POST-GATE UNCHECKED';
  if (!Array.isArray(c.stamps)) c.stamps = [];
  if (c.stamps.indexOf(stamp) < 0) c.stamps = c.stamps.concat([stamp]);
}

function hgPostGateBannerHtml(c){
  if (!c || !c.postGateUnchecked || c.demoted) return '';
  var reasons = (c.postGateUncheckedReasons && c.postGateUncheckedReasons.length)
    ? c.postGateUncheckedReasons.join(' · ')
    : 'reason not recorded';
  var esc = function (s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  return '<div class="note warn" style="margin-top:6px;color:#FBBF24!important"><b>&#9888; POST-GATE UNCHECKED</b> &mdash; '
    + esc(reasons)
    + '. Quality legs were <b>not</b> cleared; they were never tested. A checked 7/7 beats this for MOST PROBABLE.</div>';
}

/* MOST PROBABLE order: tape-aligned first, then a post-gate that actually
   ran, then formation / rankBoost. An UNCHECKED or against-tape row can
   still print — it cannot steal the star while a better 7/7 exists. */
function hgCmpSetupQuality(a, b, side){
  a = a || {};
  b = b || {};
  if (side === 'long' || side === 'short'){
    var aW = String(a.dir || '').toLowerCase() === side ? 1 : 0;
    var bW = String(b.dir || '').toLowerCase() === side ? 1 : 0;
    if (aW !== bW) return bW - aW;
  }
  var aC = a.postGateUnchecked ? 0 : (a.postGateChecked ? 2 : 1);
  var bC = b.postGateUnchecked ? 0 : (b.postGateChecked ? 2 : 1);
  if (aC !== bC) return bC - aC;
  var fs = (b.formationScore || 0) - (a.formationScore || 0);
  if (fs) return fs;
  var rb = (b.rankBoost || 0) - (a.rankBoost || 0);
  if (rb) return rb;
  var rra = Number.isFinite(+a.rr) ? +a.rr : (Number.isFinite(+a.rr1) ? +a.rr1 : 0);
  var rrb = Number.isFinite(+b.rr) ? +b.rr : (Number.isFinite(+b.rr1) ? +b.rr1 : 0);
  if (rrb !== rra) return rrb - rra;
  var re = (b.rsEdge || 0) - (a.rsEdge || 0);
  if (re) return re;
  var fb = (b.flowOk ? 1 : 0) - (a.flowOk ? 1 : 0);
  if (fb) return fb;
  var ta = Number.isFinite(+a.turnoverUsd) ? +a.turnoverUsd : 0;
  var tb = Number.isFinite(+b.turnoverUsd) ? +b.turnoverUsd : 0;
  if (tb !== ta) return tb - ta;
  return String(a.sym || '').localeCompare(String(b.sym || ''));
}

function hgRankCryptoSetups(cands, side){
  var sorted = (cands || []).slice().sort(function (a, b){ return hgCmpSetupQuality(a, b, side); });
  var best = null, i, c;
  for (i = 0; i < sorted.length; i++){
    c = sorted[i];
    if (c && !c.postGateUnchecked){ best = c; break; }
  }
  if (!best && sorted.length) best = sorted[0];
  return { cands: sorted, best: best };
}

function hgSetupHasLevels(row){
  if (!row) return false;
  var e = +row.entry, s = +row.stop, t1 = +row.t1;
  return isFinite(e) && e > 0 && isFinite(s) && s > 0 && e !== s && isFinite(t1) && t1 > 0;
}

function hgMpNum(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}

/* Flatten the shapes scan tabs actually emit — {entry,stop,t1}, BEST
   {t.symbol}, SMART {setup}, OMNI {plan}, sniper {setup}, MEANREV {sig},
   sl/tp/target aliases. Drops zero-risk and missing T1. Never invents levels. */
function hgMpFirstNum(){
  var i, n;
  for (i = 0; i < arguments.length; i++){
    n = hgMpNum(arguments[i]);
    if (isFinite(n)) return n;
  }
  return NaN;
}

function hgNormalizeSetupRow(raw){
  if (!raw || typeof raw !== 'object') return null;
  var plan = (raw.plan && typeof raw.plan === 'object' && !Array.isArray(raw.plan)) ? raw.plan : null;
  var setup = (raw.setup && typeof raw.setup === 'object') ? raw.setup : null;
  var sig = raw.sig && typeof raw.sig === 'object' ? raw.sig : null;
  var nest = setup || plan || sig || {};
  var src = setup || plan || sig || raw;
  var t = raw.t && typeof raw.t === 'object' ? raw.t : null;
  var cls = raw.cls && typeof raw.cls === 'object' ? raw.cls : null;
  var sym = raw.venueSym || raw.sym || raw.symbol || raw.ticker
    || (t && (t.symbol || t.sym)) || nest.sym || nest.symbol || '';
  var dir = raw.dir || raw.side || raw.direction
    || (cls && cls.dir) || (sig && sig.dir) || nest.dir || nest.side || '';
  dir = String(dir || '').toLowerCase();
  if (dir === 'buy' || dir === 'l') dir = 'long';
  if (dir === 'sell' || dir === 's') dir = 'short';
  var entry = hgMpFirstNum(src.entry, raw.entry, nest.entry);
  var stop = hgMpFirstNum(src.stop, raw.stop, raw.sl, nest.stop, nest.sl);
  var t1 = hgMpFirstNum(src.t1, raw.t1, raw.tp, raw.tp1, raw.target, nest.t1, nest.tp, nest.tp1, nest.target);
  var t2 = hgMpFirstNum(src.t2, raw.t2, raw.tp2, nest.t2, nest.tp2);
  var row = {
    sym: String(sym || ''),
    dir: dir,
    entry: entry,
    stop: stop,
    t1: t1,
    venue: raw.venue || raw.venueTag || nest.venue,
    rr: hgMpNum(raw.rr != null ? raw.rr : (src.rr != null ? src.rr : nest.rr)),
    passed: raw.gatesPassed != null ? raw.gatesPassed : (raw.passed != null ? raw.passed : nest.passed),
    gatesPassed: raw.gatesPassed != null ? raw.gatesPassed : raw.passed,
    gatesTotal: raw.gatesTotal || nest.gatesTotal || 7,
    missing: raw.missing || nest.missing,
    nearClean: !!(raw.nearClean || nest.nearClean),
    postGateUnchecked: !!raw.postGateUnchecked
  };
  if (isFinite(t2) && t2 > 0) row.t2 = t2;
  if (!hgSetupHasLevels(row)) return null;
  var tier = String(raw.tier || nest.tier || '').toLowerCase();
  var confirmed = !!(raw.confirmed || (setup && setup.confirmed) || (raw.grade && raw.grade.ticket) || raw.ticket);
  var forming = !!(raw.forming || raw.closest || tier === 'forming' || raw.isRecent || raw.edgeForming);
  var near = !!(raw.near || raw.nearClean || tier === 'near' || raw.isContext);
  var clean = !!(raw.clean || confirmed || tier === 'clean' || tier === 'best' || raw.edgeTicket || raw.isNew);
  if (isFinite(+row.passed)){
    if (+row.passed >= 7){ clean = true; near = false; forming = false; }
    else if (+row.passed === 6){ near = true; clean = false; }
    else if (+row.passed >= 5){ forming = true; clean = false; }
  }
  if (clean && !near) row.clean = true;
  else if (near){ row.near = true; row.nearClean = true; }
  if (forming && !row.clean) row.forming = true;
  if (!row.clean && !row.near && !row.forming) row.clean = true;
  return row;
}

function hgCollectSetupRows(payload){
  if (!payload) return [];
  if (Array.isArray(payload)){
    var out = [], i, n;
    for (i = 0; i < payload.length; i++){
      n = hgNormalizeSetupRow(payload[i]);
      if (n) out.push(n);
    }
    return out;
  }
  if (typeof payload !== 'object') return [];
  var keys = ['cands', 'nearCands', 'found', 'rows', 'setups', 'results', 'clean', 'near', 'signals', 'top', 'shown'];
  var bag = [], k, arr, j;
  if (payload.closest) bag.push(payload.closest);
  for (k = 0; k < keys.length; k++){
    arr = payload[keys[k]];
    if (Array.isArray(arr)){
      for (j = 0; j < arr.length; j++) bag.push(arr[j]);
    }
  }
  if (!bag.length){
    n = hgNormalizeSetupRow(payload);
    return n ? [n] : [];
  }
  return hgCollectSetupRows(bag);
}

function hgPickMostProbableAny(payload, side){
  if (!payload) return null;
  var cands = [], near = [], closest = null, rows, r, extra, i;
  if (!Array.isArray(payload) && typeof payload === 'object'
      && (payload.cands || payload.nearCands || payload.closest || payload.near)){
    cands = hgCollectSetupRows(payload.cands || []);
    near = hgCollectSetupRows(payload.nearCands || payload.near || []);
    closest = payload.closest ? hgNormalizeSetupRow(payload.closest) : null;
    extra = hgCollectSetupRows({
      found: payload.found, rows: payload.rows, setups: payload.setups,
      results: payload.results, signals: payload.signals, top: payload.top, shown: payload.shown
    });
    for (i = 0; i < extra.length; i++){
      if (extra[i].clean) cands.push(extra[i]);
      else if (extra[i].near) near.push(extra[i]);
      else if (!closest) closest = extra[i];
    }
    return hgPickMostProbable(cands, near, side, closest);
  }
  rows = hgCollectSetupRows(payload);
  for (r = 0; r < rows.length; r++){
    if (rows[r].clean) cands.push(rows[r]);
    else if (rows[r].near) near.push(rows[r]);
    else if (rows[r].forming){ if (!closest) closest = rows[r]; }
    else cands.push(rows[r]);
  }
  return hgPickMostProbable(cands, near, side, closest);
}

/* One leader for the desk banner. CLEAN with levels wins. Else the best
   6/7 NEAR. Else a single closest ≥5/7 draft (watch-only). Never invents
   a 7/7 ticket. */
function hgPickMostProbable(cands, nearCands, side, closest){
  var ranked = hgRankCryptoSetups(cands || [], side);
  if (ranked.best && hgSetupHasLevels(ranked.best) && !ranked.best.nearClean){
    return { row: ranked.best, tier: 'clean', source: 'clean' };
  }
  var nr = hgRankCryptoSetups(nearCands || [], side);
  if (nr.best && hgSetupHasLevels(nr.best)){
    return { row: nr.best, tier: 'near', source: 'near' };
  }
  if (ranked.best && hgSetupHasLevels(ranked.best)){
    return { row: ranked.best, tier: ranked.best.nearClean ? 'near' : 'clean', source: 'clean' };
  }
  if (closest && hgSetupHasLevels(closest)){
    return { row: closest, tier: 'forming', source: 'closest' };
  }
  return null;
}

async function hgFilterGoldPostGate(ranked, venueRows, defaultRows4h, style){
  if (!Array.isArray(ranked)) return ranked;
  /* Per-candidate isolation. This loop used to sit inside ONE try: a single
     throw aborted it and every candidate after that point was returned with
     no gate run and no mark — silently reading as clean. */
  for (var i = 0; i < ranked.length; i++){
    var c = ranked[i];
    if (!c || c.demoted || c.vetoed) continue;
    try{
      var vr = venueRows ? venueRows[c.venue] : null;
      var r15 = vr && vr.rows15m;
      var r4 = (vr && vr.rows4h && vr.rows4h.length) ? vr.rows4h : defaultRows4h;
      var hit = { dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1 || c.tp1 };
      var qv = await hgPostGateGoldVeto(c, hit, r15, r4, style);
      if (!qv.ok){
        c.demoted = true;
        c.postGateVeto = qv.tag || 'quality';
        var stamp = 'POST-GATE ' + String(qv.tag || 'quality').toUpperCase();
        c.stamps = Array.isArray(c.stamps) ? c.stamps.concat([stamp]) : [stamp];
        c.demoteReason = qv.reason || stamp;
      } else {
        if (qv.flowDetail) c.flowDetail = qv.flowDetail;
        if (qv.unchecked) hgMarkGateUnchecked(c, qv.uncheckedReasons);
        else c.postGateChecked = true;
      }
    }catch(e){
      hgMarkGateUnchecked(c, ['post-gate threw: ' + hgErrText(e)]);
    }
  }
  return ranked;
}

var HG_GOLD_WEEKEND_EXCEED_MAX = 0.35;

function hgGoldWeekendConvictionDemote(cand, rows4h, atrVal, stopAtr, nowSec){
  try{
    if (!cand || cand.demoted || cand.vetoed) return false;
    if (typeof G.hgGoldWeekendReadout !== 'function') return false;
    var ro = G.hgGoldWeekendReadout(rows4h, atrVal, stopAtr, nowSec);
    if (!ro) return false;
    var demote = false, reason = '';
    if (ro.inWeekend && ro.level === 'warn'){
      demote = true;
      reason = 'WEEKEND EXPOSURE — inside spot/CME closure';
    } else if (ro.risk && ro.risk.exceedPct != null && ro.risk.exceedPct >= HG_GOLD_WEEKEND_EXCEED_MAX){
      demote = true;
      reason = 'WEEKEND GAP — ' + Math.round(ro.risk.exceedPct * 100) + '% of past closures exceeded '
        + (stopAtr || 1.5).toFixed(2) + '×ATR stop';
    } else if (ro.stats && ro.stats.p90 != null && isFinite(stopAtr) && ro.stats.p90 >= stopAtr * 0.9){
      demote = true;
      reason = 'WEEKEND HEAT — p90 closure move ' + ro.stats.p90 + '×ATR vs ' + stopAtr.toFixed(2) + '×ATR stop';
    }
    if (!demote) return false;
    cand.demoted = true;
    cand.weekendDemote = true;
    cand.stamps = Array.isArray(cand.stamps) ? cand.stamps.concat(['WEEKEND']) : ['WEEKEND'];
    cand.demoteReason = reason;
    return true;
  }catch(e){ return false; }
}

function hgApplyGoldWeekendDemotes(ranked, rows4h, atrVal, nowMs){
  try{
    if (!Array.isArray(ranked) || !rows4h || !rows4h.length) return;
    var nowSec = Math.floor((nowMs || Date.now()) / 1000);
    for (var i = 0; i < ranked.length; i++){
      var c = ranked[i];
      if (!c || c.demoted || c.vetoed || c.locked) continue;
      var entry = +c.entry, stop = +c.stop;
      var stopAtr = 1.5;
      if (isFinite(entry) && isFinite(stop) && isFinite(atrVal) && atrVal > 0){
        stopAtr = Math.abs(entry - stop) / atrVal;
      }
      hgGoldWeekendConvictionDemote(c, rows4h, atrVal, stopAtr, nowSec);
    }
  }catch(e){}
}

/* NEAR CLEAN honesty — would a hypothetical CLEAN fail post-gate checks? */
function hgNearQualityHint(hit, rows, ticker, style){
  try{
    if (!hit || !hit.dir || !rows || !rows.length) return { wouldVeto: false, lines: [] };
    var lines = [];
    var stale = hgStaleMomentumVeto(rows, hit.dir, hit.entry != null ? hit.entry : +rows[rows.length - 1].c);
    if (stale.veto) lines.push(stale.reason || 'stale momentum');
    if (typeof cgClearanceLine === 'function' && hit.margins){
      var cl = cgClearanceLine(hit);
      if (cl) lines.push('clearance: ' + cl);
    } else if (hit.bindingTotal != null && hit.tightGates && hit.tightGates.length){
      lines.push('binding gates: ' + hit.tightGates.join(', '));
    }
    if (typeof cgMacroOk === 'function' && ticker){
      var mk = cgMacroOk(ticker, hit.dir);
      if (mk && !mk.ok) lines.push('macro: ' + (mk.reason || 'blocked'));
    }
    return { wouldVeto: lines.some(function(l){ return /STALE|macro|trap/i.test(l); }), lines: lines };
  }catch(e){ return { wouldVeto: false, lines: [] }; }
}

function hgCryptoRankBoost(sym, dir, rr, vetoMeta){
  try{
    var boost = 0;
    if (vetoMeta && vetoMeta.rsEdge != null && isFinite(vetoMeta.rsEdge)) boost += Math.min(15, Math.max(-5, vetoMeta.rsEdge * 100));
    if (vetoMeta && vetoMeta.flowOk) boost += 5;
    if (vetoMeta && vetoMeta.crossOk) boost += 3;
    if (typeof G.hgProfitRankHint === 'function'){
      var pr = G.hgProfitRankHint({ sym: sym, dir: dir, tier: 'clean', rr1: rr, lane: 'crypto' });
      if (pr && isFinite(pr.boost)) boost += pr.boost;
    }
    if (typeof G.bestSessionActive === 'function' && G.bestSessionActive()) boost += 2;
    return boost;
  }catch(e){ return 0; }
}

/* --- G5 vol+wick participation (ENGINE quiet-tape parity for SWING/SCALP) --- */
function hgSwingG5OK(dir, rows, c, r14, vz){
  try{
    dir = String(dir || '').toLowerCase();
    if (!rows || !rows.length || !c || !c.length) return { ok: false, closeOK: false, quiet: false };
    var cb = rows[rows.length - 1];
    var range = (+cb.h) - (+cb.l);
    var closePos = range > 0 ? ((+cb.c) - (+cb.l)) / range : 0.5;
    var closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
    var _rA = (typeof rsi === 'function') ? rsi(c, 14) : [];
    var _rP = _rA.length >= 4 ? _rA[_rA.length - 4] : NaN;
    var slopeOK = isFinite(_rP) && isFinite(r14) ? (dir === 'long' ? r14 > _rP : r14 < _rP) : false;
    if (isFinite(vz) && vz <= -1.5 && !closeOK) return { ok: false, closeOK: closeOK, quiet: false };
    var volOK = isFinite(vz) && vz > HG_G5_VOLZ_MIN;
    /* ENGINE PARITY (engine.js G5): on a quiet tape RSI slope running with the
       trade + a strong close location stand in for volume expansion. slopeOK
       used to be computed here and thrown away, which silently rejected ~32%
       of aligned cascades that engine.js accepts. */
    var ok = closeOK && (volOK || slopeOK);
    var quiet = ok && !volOK;
    return { ok: ok, closeOK: closeOK, quiet: quiet, slopeOK: slopeOK, volOK: volOK };
  }catch(e){ return { ok: false, closeOK: false, quiet: false }; }
}

function hgRegimeRouteHint(rows){
  try{
    if (typeof detectRegime !== 'function' || !rows || rows.length < 60) return null;
    var dr = detectRegime(rows);
    if (!dr || !dr.regime) return null;
    if (dr.regime === 'compression') return dr.label + ' — trend tickets blocked · try SQUEEZE or MEAN REV';
    if (dr.regime === 'volatile') return dr.label + ' — trend continuation blocked · stand aside or size down';
    return null;
  }catch(e){ return null; }
}

function hgRegimeRouteHintHtml(rows){
  try{
    if (typeof detectRegime !== 'function' || !rows || rows.length < 60) return '';
    var dr = detectRegime(rows);
    if (!dr || !dr.regime) return '';
    if (dr.regime === 'compression'){
      return dr.label + ' — trend blocked · '
        + '<a href="#" onclick="showTab(\'squeeze\');return false" style="color:var(--gold)">SQUEEZE</a> · '
        + '<a href="#" onclick="showTab(\'meanrev\');return false" style="color:var(--gold)">MEAN REV</a>';
    }
    if (dr.regime === 'volatile'){
      return dr.label + ' — trend blocked · '
        + '<a href="#" onclick="showTab(\'scalp\');return false" style="color:var(--gold)">SCALP</a> (size down)';
    }
    if (dr.regime === 'range'){
      return dr.label + ' — '
        + '<a href="#" onclick="showTab(\'meanrev\');return false" style="color:var(--gold)">MEAN REV</a> · '
        + '<a href="#" onclick="showTab(\'div\');return false" style="color:var(--gold)">DIVERGENCE</a>';
    }
    return '';
  }catch(e){ return ''; }
}

function hgNormSym(s){
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hgCryptoBase(sym){
  try{
    sym = String(sym || '').toUpperCase();
    var dm = sym.match(/^B-([A-Z0-9]+)_USDT$/);
    if (dm && dm[1]) return dm[1];
    if (sym.endsWith('USDT')) return sym.slice(0, -4);
    return sym.replace(/USDT$/, '');
  }catch(e){ return hgNormSym(sym); }
}

function hgIsCryptoMajor(sym){
  var base = hgCryptoBase(sym);
  return base === 'BTC' || base === 'ETH' || base === 'SOL';
}

function hgBtcdPct(){
  try{
    if (typeof G.regimeState === 'function'){
      var rs = G.regimeState();
      if (rs && isFinite(+rs.btcdPct)) return +rs.btcdPct;
    }
    if (typeof G.hgBtcdPctOverride === 'number' && isFinite(G.hgBtcdPctOverride)) return G.hgBtcdPctOverride;
    return null;
  }catch(e){ return null; }
}

function hgDxyTrend(){
  try{
    if (typeof G.regimeState === 'function'){
      var rs = G.regimeState();
      if (rs && typeof rs.dxyTrend === 'string') return rs.dxyTrend;
    }
    return null;
  }catch(e){ return null; }
}

/* BTC.D + DXY macro gate for crypto alts (majors always pass; null macro = no block). */
function hgMacroAllowsCrypto(sym, dir){
  try{
    dir = String(dir || '').toLowerCase();
    if (!(dir === 'long' || dir === 'short')) return { allow: true, reason: null };
    if (hgIsCryptoMajor(sym)) return { allow: true, reason: null };
    var btcd = hgBtcdPct();
    if (btcd !== null && btcd > 55 && dir === 'long'){
      return { allow: false, reason: 'BTC.D ' + btcd.toFixed(1) + '% > 55% — risk-off for alt longs' };
    }
    var dxy = hgDxyTrend();
    if (dxy === 'UP' && dir === 'long'){
      return { allow: false, reason: 'DXY rising — USD strength headwind for alt longs' };
    }
    return { allow: true, reason: null };
  }catch(e){
    return { allow: true, unchecked: true, reason: 'macro check threw: ' + hgErrText(e) };
  }
}

function hgTripleStackMatch(sym, dir){
  try{
    sym = hgNormSym(sym);
    dir = String(dir || '').toLowerCase();
    if (!sym || !(dir === 'long' || dir === 'short')) return null;
    var swing = false, edge = false, brain = false;
    var ss = (typeof G.swingScan === 'function') ? G.swingScan() : (G.__hgSwingScan || null);
    var snap = (ss && ss.cands) ? ss.cands : [];
    for (var i = 0; i < snap.length; i++){
      var c = snap[i];
      if (c && hgNormSym(c.sym) === sym && String(c.dir).toLowerCase() === dir){ swing = true; break; }
    }
    var es = (typeof G.edgeScan === 'function') ? G.edgeScan() : null;
    var ec = (es && es.cands) ? es.cands : [];
    for (var j = 0; j < ec.length; j++){
      var e = ec[j];
      if (e && hgNormSym(e.sym) === sym && String(e.dir).toLowerCase() === dir){ edge = true; break; }
    }
    var bl = (typeof G.__hgBrainLast === 'function') ? G.__hgBrainLast() : null;
    var brows = (bl && bl.rows) ? bl.rows : [];
    for (var k = 0; k < brows.length; k++){
      var r = brows[k];
      if (!r || !r.dec || !r.dec.dir) continue;
      if (hgNormSym(r.sym) !== sym) continue;
      if (String(r.dec.dir).toLowerCase() === dir
          && r.dec.tier && String(r.dec.tier) !== 'ASIDE'){ brain = true; break; }
    }
    if (swing && edge && brain) return { swing: true, edge: true, brain: true };
    return null;
  }catch(e){ return null; }
}

function hgTripleStackChipHtml(sym, dir){
  var m = hgTripleStackMatch(sym, dir);
  if (!m) return '';
  return '<span class="stamp pass" style="margin-left:6px;background:rgba(5,150,105,.15);border:1px solid rgba(5,150,105,.45)"'
    + ' title="SWING CLEAN + EDGE tally + BRAIN tier agree on direction">TRIPLE STACK</span>';
}

function hgVenueDataNote(ticker){
  try{
    if (!ticker) return null;
    var t = ticker.turnoverUsd;
    if (t === null || t === undefined || !(t > 0)) return 'structure-only venue — no turnover/OI on this leg · size down';
    return null;
  }catch(e){ return null; }
}

function hgFunnelPanelHTML(title, rows, panelId){
  try{
    if (!rows || !rows.length) return '';
    panelId = panelId || ('hgFunnel_' + Math.random().toString(36).slice(2, 9));
    var esc = function(s){
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    };
    var body = rows.map(function(r){
      return '<div style="display:flex;gap:8px;padding:3px 0;font-size:12px">'
        + '<span style="min-width:140px;color:var(--mut)">' + esc(r.k) + '</span>'
        + '<span>' + esc(r.v) + '</span></div>';
    }).join('');
    return '<details class="hg-funnel" id="' + esc(panelId) + '" style="margin:10px 0;padding:8px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel)">'
      + '<summary style="cursor:pointer;font-size:12px">' + esc(title) + '</summary>'
      + '<div style="margin-top:8px">' + body + '</div></details>';
  }catch(e){ return ''; }
}

/* --- structure stop (shared by smartSetup fallbacks, squeeze, oiflow, trendtable) --- */
function hgStructureStop(dir, entry, rows, opts){
  opts = opts || {};
  try{
    dir = String(dir || '').toLowerCase();
    entry = +entry;
    if (!(dir === 'long' || dir === 'short') || !(isFinite(entry) && entry > 0)) return null;
    if (!rows || !rows.length || typeof atr !== 'function') return null;
    var atrLen = opts.atrLen || 14;
    var look = opts.look || ((typeof G.hgSwingLook === 'function') ? G.hgSwingLook() : 20);
    var buffer = (opts.buffer !== undefined) ? opts.buffer : HG_STOP_BUFFER_ATR;
    var capDist = (opts.capDist !== undefined) ? opts.capDist : HG_STOP_CAP_DIST_ATR;
    var fallback = (opts.fallback !== undefined) ? opts.fallback : HG_STOP_FALLBACK_ATR;
    var aArr = atr(rows, atrLen);
    var a = _last(aArr);
    if (!isFinite(a) || a <= 0) return null;
    /* When the structural stop sits further than capDist×ATR, this used to
       MOVE THE STOP IN to a flat fallback×ATR and take the trade anyway.

       Measured on gold-shaped 1h data, that fired on 65% of setups. The stop
       landed 53% closer than the level that would actually invalidate the
       idea — inside normal noise — and, because R:R is computed against the
       risk distance, the card then advertised 2.00R for a trade worth 0.96R
       against real invalidation. A 2.08x overstatement, and a stop placed
       where it will be hit.

       That is the one wrong answer available here. If a setup needs more room
       than policy allows, the honest responses are to take it at the
       structural stop and let the R:R gate judge it on true risk, or to
       decline it. Keeping the trade while falsifying the risk is neither.

       The stop now stays on structure and the R:R gate does its job: a wide
       stop with a far target still passes, a wide stop without one is
       correctly rejected for reward that no longer justifies the risk.
       Beyond maxDist×ATR the geometry is treated as unusable and declined
       outright, rather than dressed up.

       Callers that genuinely want the old tightening can ask for it with
       capMode:'tighten', which now says so on the plan instead of hiding it. */
    var maxDist = (opts.maxDist !== undefined) ? opts.maxDist : HG_STOP_MAX_DIST_ATR;
    /* DEFAULT UNCHANGED. Making 'structure' the global default re-priced every
       desk at once and broke five existing test files — the crypto desks are
       tuned around a 2.5×ATR cap and a 1.5×ATR fallback, and changing that
       under them is a different piece of work from fixing gold. Desks opt in
       per call; the gold desks now do. */
    var capMode = opts.capMode || 'tighten';
    var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, look) : NaN;
    var stop = NaN, note = '', wide = false;
    if (isFinite(sw)){
      stop = (dir === 'long') ? sw - buffer * a : sw + buffer * a;
      var risk = Math.abs(entry - stop);
      if (risk > 0 && risk <= capDist * a){
        note = 'stop: lastSwing(' + look + ') buffered ' + buffer + '×ATR' + atrLen;
      } else if (risk > capDist * a){
        /* The hard decline applies only where a desk has opted into structure
           stops. On the default path it was rejecting plans that had always
           been produced — a smooth trend has a tiny ATR and a distant swing,
           so risk/ATR is large without the setup being unusable. That was my
           addition breaking real cases, not an existing fault. */
        if (capMode !== 'tighten' && risk > maxDist * a){
          /* THE MOMENTUM STOP — the trade v381 removed, put back with its name on.

             v381 killed the silent ATR fallback because it was presented AS
             structure: the card said lastSwing, claimed 2R against risk 53%
             smaller than real invalidation, and the stop sat where it would
             be hit. The lie was the defect. But declining outright created
             its own inconsistency: the walk-forward pool's OWN stop model
             (hgOmniBtStop) falls back to 1.5xATR when structure is unusable
             — disclosed in every pool footer — so the in-sample numbers
             measure trades the live desk refuses to take, and in a runaway
             trend the desk takes nothing at all. Four sessions of "why does
             the scalp setup have no levels" were that gap.

             A volatility stop with its name on is a different instrument
             from a fake structural one. The caller must OPT IN
             (momentumOk: true — the desks grant it to continuation
             mechanics only, never fades), the note says what it is and what
             it is not, and plan.momentumStop lets the ledger flag it AGAINST
             so the compromise is on the card, not buried. */
          if (opts.momentumOk === true){
            stop = (dir === 'long') ? entry - fallback * a : entry + fallback * a;
            var mRisk = Math.abs(entry - stop);
            if (!(mRisk > 0)) return null;
            return { stop: stop, risk: mRisk, atr: a, momentumStop: true,
                     note: 'MOMENTUM STOP: ' + fallback + '×ATR' + atrLen
                         + ' — no structure within ' + maxDist + '×ATR (nearest swing '
                         + (risk / a).toFixed(1) + '×ATR away). This is a volatility stop, '
                         + 'NOT invalidation: noise can stop this trade without the idea being wrong',
                     wide: false };
          }
          return null;
        }
        if (capMode === 'tighten'){
          stop = (dir === 'long') ? entry - fallback * a : entry + fallback * a;
          note = 'stop capped: structure beyond ' + capDist + '×ATR — ' + fallback + '×ATR' + atrLen
               + ' (TIGHTENED off structure: the R:R below is measured against this reduced risk, '
               + 'so the stop sits nearer than the level that would invalidate the idea)';
        } else {
          wide = true;
          note = 'stop: lastSwing(' + look + ') buffered ' + buffer + '×ATR' + atrLen
               + ' — WIDE (' + (risk / a).toFixed(1) + '×ATR, beyond the ' + capDist
               + '×ATR guide); R:R is measured against this real invalidation';
        }
      }
    }
    if (!isFinite(stop) || (dir === 'long' ? stop >= entry : stop <= entry)){
      stop = (dir === 'long') ? entry - fallback * a : entry + fallback * a;
      note = 'stop: ' + fallback + '×ATR' + atrLen + ' (lastSwing unavailable)';
    }
    var riskF = Math.abs(entry - stop);
    if (!(riskF > 0)) return null;
    return { stop: stop, risk: riskF, atr: a, note: note, wide: wide };
  }catch(e){ return null; }
}

/* --- R-multiple plan from entry/stop --- */

/* Every plan enricher below replaces entry and/or stop and then updates the
   targets and ratios only inside a guard. When that guard fails — or updates
   some legs and not others — the plan ships new levels with ratios measured
   against the levels they replaced. This is the same defect fixed in
   formation.js, gold-best-levels.js, conviction-lock.js and omniroute.js;
   plans.js carries the rr1/rr2/riskPct field shape rather than rr/rr2/rr3,
   which is why it gets its own function instead of sharing hgSyncPlanRr.

   Rule: derive from the levels the plan actually carries, and clear what
   cannot be derived. Never inherit. */
function hgPlanNum(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }

function hgSyncPlanRatios(p){
  if (!p) return p;
  try{
    var entry = hgPlanNum(p.entry), stop = hgPlanNum(p.stop);
    var risk = (isFinite(entry) && isFinite(stop)) ? Math.abs(entry - stop) : NaN;
    var usable = isFinite(risk) && risk > 0;
    var t1 = hgPlanNum(p.t1), t2 = hgPlanNum(p.t2);
    p.rr1 = (usable && isFinite(t1)) ? Math.abs(t1 - entry) / risk : null;
    p.rr2 = (usable && isFinite(t2)) ? Math.abs(t2 - entry) / risk : null;
    if (p.rr !== undefined) p.rr = p.rr1;
    p.riskPct = (usable && isFinite(entry) && entry > 0) ? (risk / entry * 100) : null;
  }catch(e){}
  return p;
}

function hgPlanFromRisk(dir, entry, stop, opts){
  opts = opts || {};
  try{
    entry = +entry; stop = +stop;
    if (!(dir === 'long' || dir === 'short')) return null;
    if (!(isFinite(entry) && isFinite(stop))) return null;
    var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(risk > 0)) return null;
    var t1R = opts.t1R !== undefined ? opts.t1R : HG_T1_R;
    var t2R = opts.t2R !== undefined ? opts.t2R : HG_T2_R;
    var minRr = opts.minRr !== undefined ? opts.minRr : HG_MIN_RR_DEFAULT;
    var t1 = opts.t1Hint;
    var rew1 = (dir === 'long') ? (t1 - entry) : (entry - t1);
    if (!(isFinite(t1) && rew1 > 0)){
      t1 = (dir === 'long') ? entry + t1R * risk : entry - t1R * risk;
      rew1 = t1R * risk;
    }
    var rr1 = rew1 / risk;
    /* A supplied structural hint that falls short of minRr is a REJECT.
       Only the no-hint case may use the R-multiple policy target above. */
    if (rr1 < minRr) return null;
    var t2 = opts.t2Hint;
    var rew2 = (isFinite(t2)) ? ((dir === 'long') ? (t2 - entry) : (entry - t2)) : NaN;
    if (!(isFinite(t2) && rew2 > 0)){
      t2 = (dir === 'long') ? entry + t2R * risk : entry - t2R * risk;
      rew2 = t2R * risk;
    }
    return {
      dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      risk: risk, riskPct: risk / entry * 100,
      rr1: rr1, rr2: rew2 / risk,
      targetPolicy: opts.targetPolicy || 'R-multiples',
      t1R: t1R, t2R: t2R
    };
  }catch(e){ return null; }
}

/* --- universal hgPlanLevels replacement core --- */
/* THE STOP NOTE DESCRIBED A GEOMETRY THE CARD NO LONGER HAS.

   hgPlanLevelsCore builds the stop with hgStructureStop, copies its note onto
   the plan, and THEN calls hgApplyExactEntry, which moves the entry to a real
   level. The note was never recomputed, so the "N x ATR" it quotes is the
   distance from the PRE-adjustment entry while the card shows the post-
   adjustment one.

   Measured over 1,470 gold cards that printed both figures, the note and the
   card's own entry/stop agreed only 5% of the time: median 1.95x apart, worst
   4.71x. A live card read "WIDE (4.2xATR, beyond the 2.5xATR guide)" beside a
   vol-alive reading that put the same stop at 1.53xATR.

   That is not cosmetic. The WIDE clause is the card's warning that a stop sits
   outside policy, and a reader sizing off it was being told a stop was more
   than twice as wide as it is — or, in the other direction, not warned about
   one that had become wide.

   Restated here against the FINAL entry. Deliberately NOT a new decline: a
   plan already past the hgStructureStop checks is not withdrawn on
   re-measurement, because removing setups is the opposite of what this is
   for. If the adjusted geometry IS wide it says so, and if it no longer is,
   the clause goes. */
function hgRestateStopNote(note, atrVal, finalRisk, capDist){
  try{
    note = String(note || '');
    /* This restates an existing note; it does not author one. With nothing
       to restate, appending a clause would produce a note that begins
       " - WIDE (...)" and describes a stop nobody said anything about. */
    if (!note) return note;
    var a = +atrVal, r = +finalRisk;
    var cap = (typeof capDist === 'number' && isFinite(capDist)) ? capDist : HG_STOP_CAP_DIST_ATR;
    if (!isFinite(a) || a <= 0 || !isFinite(r) || r <= 0) return note;
    /* Only the structural-stop note carries this clause; a capped or
       fallback note describes something else and is left alone. */
    var WIDE_RE = / — WIDE \([\d.]+×ATR, beyond the [\d.]+×ATR guide\); R:R is measured against this real invalidation/;
    var base = note.replace(WIDE_RE, '');
    if (/stop capped|lastSwing unavailable|MOMENTUM STOP/.test(base)) return note;
    var mult = r / a;
    if (mult > cap){
      return base + ' — WIDE (' + mult.toFixed(1) + '×ATR, beyond the ' + cap
           + '×ATR guide); R:R is measured against this real invalidation';
    }
    return base;
  }catch(e){ return note; }
}

function hgPlanLevelsCore(dir, rows, entryOverride, opts){
  opts = opts || {};
  try{
    if (!(dir === 'long' || dir === 'short') || !rows || !rows.length) return null;
    var entry = (isFinite(entryOverride) && entryOverride > 0) ? +entryOverride : +rows[rows.length - 1].c;
    if (!isFinite(entry) || entry <= 0) return null;
    var st = hgStructureStop(dir, entry, rows, opts);
    if (!st) return null;
    var plan = hgPlanFromRisk(dir, entry, st.stop, {
      t1R: opts.t1R, t2R: opts.t2R, minRr: opts.minRr || HG_MIN_RR_DEFAULT,
      targetPolicy: 'R-multiples (2R/3.5R)'
    });
    if (!plan) return null;
    plan.note = st.note;
    if (st.momentumStop === true) plan.momentumStop = true;
    plan.planSrc = 'hgPlanLevels';
    plan.type = opts.type || 'SWING';
    plan.dir = dir;
    if (opts.skipExact !== true){
      var exactPl = hgApplyExactEntry(plan, rows, {
        poiLevel: (isFinite(entryOverride) && entryOverride > 0) ? entryOverride : null,
        poiLabel: opts.poiLabel,
        style: opts.style || 'swing',
        preferEdge: opts.preferEdge
      });
      if (exactPl){
        /* hgApplyExactEntry builds a FRESH plan object, which silently dropped
           the momentumStop flag — a volatility stop then rendered as
           [structure], the ledger's AGAINST never fired, and the exact
           disguise v381 removed was back through a side door. The flag and
           its note are re-attached BEFORE the restatement, whose guard skips
           MOMENTUM notes so it cannot rewrite one as WIDE-structural. */
        if (st.momentumStop === true){
          exactPl.momentumStop = true;
          if (!/MOMENTUM STOP/.test(String(exactPl.note || ''))) exactPl.note = st.note;
        }
        /* The entry has moved; the note must describe where the stop now is. */
        exactPl.note = hgRestateStopNote(exactPl.note, st.atr,
          Math.abs(+exactPl.entry - +exactPl.stop),
          (opts.capDist !== undefined) ? opts.capDist : HG_STOP_CAP_DIST_ATR);
        return exactPl;
      }
    }
    return plan;
  }catch(e){ return null; }
}

/* --- format LIMIT/MARKET entry label --- */
function hgFormatEntryType(base, label){
  try{
    base = String(base || 'LIMIT');
    label = String(label || '');
    if (!label) return base;
    if (base.indexOf('@') >= 0) return base;
    return base + ' @ ' + label;
  }catch(e){ return base || 'LIMIT'; }
}

/* --- generic POI / EMA exact entry (non-EDGE tabs) --- */
function hgEnrichGenericExact(plan, rows, opts){
  opts = opts || {};
  try{
    if (!plan || !plan.dir || !rows || !rows.length) return plan;
    if (typeof atr !== 'function') return plan;
    var dir = plan.dir;
    var n = rows.length - 1;
    var mark = isFinite(plan.mark) ? plan.mark : +rows[n].c;
    var a4 = _last(atr(rows, 14));
    if (!(isFinite(a4) && a4 > 0)) return plan;
    var tol = 0.4 * a4;
    var entry, anchor, zone, label;
    if (isFinite(opts.poiLevel) && opts.poiLevel > 0){
      entry = +opts.poiLevel;
      anchor = entry;
      label = opts.poiLabel || 'POI';
      zone = { lo: entry - tol * 0.5, hi: entry + tol * 0.25 };
    } else if (typeof ema === 'function'){
      var c4 = rows.map(function(r){ return r.c; });
      var e21 = _last(ema(c4, 21));
      var e9 = _last(ema(c4, 9));
      if (!isFinite(e21)) return plan;
      var dist21 = Math.abs(mark - e21) / a4;
      if (dist21 > 0.25){
        entry = e21; anchor = e21; label = 'EMA21';
        zone = { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 };
      } else if (isFinite(e9) && Math.abs(mark - e9) / a4 > 0.25){
        entry = (dir === 'long') ? Math.min(mark, e9) : Math.max(mark, e9);
        anchor = e9; label = 'EMA9';
        zone = { lo: e9 - tol * 0.5, hi: e9 + tol * 0.25 };
      } else {
        entry = mark; anchor = e21; label = 'EMA21';
        zone = { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 };
      }
    } else return plan;
    var ref = hgRefineEntry(mark, entry, zone, dir);
    var entryType = ref.inZone ? hgFormatEntryType('MARKET', label) : hgFormatEntryType('LIMIT', label);
    var stop = plan.stop;
    if (isFinite(entry) && isFinite(stop) && Math.abs(entry - stop) > 1.5 * a4){
      stop = (dir === 'long') ? entry - 1.5 * a4 : entry + 1.5 * a4;
      entryType += ' · ATR-capped stop';
    }
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return plan;
    var minRr = opts.minRr || (plan.type === 'SCALP' || plan.type === 'FADE' ? 1.5 : HG_MIN_RR_DEFAULT);
    var pr = hgPlanFromRisk(dir, entry, stop, {
      t1R: (plan.type === 'SCALP' || plan.type === 'FADE') ? HG_SCALP_T1_R : HG_T1_R,
      t2R: (plan.type === 'SCALP' || plan.type === 'FADE') ? HG_SCALP_T2_R : HG_T2_R,
      minRr: minRr,
      targetPolicy: plan.targetPolicy || 'R-multiples'
    });
    var out = Object.assign({}, plan, {
      entry: entry, stop: stop, anchor: anchor, zone: zone, mark: mark,
      entryType: entryType, entryGuidance: ref.guidance,
      planSrc: plan.planSrc || 'hgExactEntry'
    });
    if (pr){
      out.t1 = pr.t1; out.t2 = pr.t2; out.rr1 = pr.rr1; out.rr2 = pr.rr2; out.riskPct = pr.riskPct;
    }
    if (plan.type !== 'SCALP' && opts.style !== 'scalp'){
      var tg = hgPlanSwingTargets(dir, entry, stop, a4, {});
      if (tg){ out.t1 = tg.t1; out.t2 = tg.t2; out.rr1 = tg.rr1; out.targetPolicy = tg.targetPolicy; }
    }
    /* `out` is spread from `plan`, so it arrives with the caller's t1/t2/rr1/
       rr2 measured against the OLD entry and stop. Both blocks above are
       conditional, and the swing-targets one replaces t2 while refreshing only
       rr1 — leaving rr2 pointing at the target it just discarded. */
    hgSyncPlanRatios(out);
    return out;
  }catch(e){ return plan; }
}

/* --- scalp exact entry (15m EMA21 / sweep level) --- */
function hgEnrichScalpExact(hit, m15, opts){
  opts = opts || {};
  try{
    if (!hit || !hit.dir || !m15 || !m15.length) return hit;
    if (typeof ema !== 'function' || typeof atr !== 'function') return hit;
    var dir = hit.dir;
    var n = m15.length - 1;
    var mark = isFinite(hit.mark) ? hit.mark : m15[n].c;
    var a = isFinite(hit.a) ? hit.a : _last(atr(m15, 14));
    if (!(isFinite(a) && a > 0)) return hit;
    var tol = 0.4 * a;
    var c15 = m15.map(function(r){ return r.c; });
    var e21 = isFinite(hit.e21) ? hit.e21 : _last(ema(c15, 21));
    var entry, anchor, zone, label;
    if (hit.swept && hit.reclaimed && isFinite(hit.sweepLevel)){
      entry = hit.sweepLevel;
      anchor = entry;
      label = 'sweep level';
      zone = (dir === 'long')
        ? { lo: entry - tol * 0.25, hi: entry + tol * 0.5 }
        : { lo: entry - tol * 0.5, hi: entry + tol * 0.25 };
    } else if (isFinite(e21)){
      entry = e21; anchor = e21; label = 'EMA21';
      zone = { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 };
    } else return hit;
    var ref = hgRefineEntry(mark, entry, zone, dir);
    var entryType = ref.inZone ? hgFormatEntryType('MARKET', label) : hgFormatEntryType('LIMIT', label);
    var stop = hit.stop;
    if (!(isFinite(stop))) return hit;
    var pr = hgPlanFromRisk(dir, entry, stop, {
      t1R: HG_SCALP_T1_R, t2R: HG_SCALP_T2_R, minRr: 2.25,
      targetPolicy: 'scalp R-multiples (1.5R/2.5R)'
    });
    return Object.assign({}, hit, {
      entry: entry, stop: stop,
      t1: pr ? pr.t1 : hit.t1, t2: pr ? pr.t2 : hit.t2,
      rr1: pr ? pr.rr1 : hit.rr, rr2: pr ? pr.rr2 : hit.rr2,
      entryType: entryType, entryGuidance: ref.guidance,
      anchor: anchor, zone: zone, mark: mark, planSrc: hit.planSrc || 'scalpTryClean'
    });
  }catch(e){ return hit; }
}

/* --- unified exact entry: EDGE signal first, then style enrichers --- */
function hgApplyExactEntry(plan, rows4h, opts){
  opts = opts || {};
  try{
    if (!plan || !plan.dir || !rows4h || !rows4h.length) return plan;
    var dir = plan.dir;
    var style = String(opts.style || plan.type || 'swing').toLowerCase();
    if (opts.skipExact === true || style === 'reversal-sniper') return plan;
    var markClose = +rows4h[rows4h.length - 1].c;

    if (typeof edgeSignal === 'function' && opts.preferEdge !== false
        && style !== 'scalp' && style !== 'fade' && style !== 'meanrev' && style !== 'reversal-sniper'){
      try{
        var sig = edgeSignal(rows4h);
        if (sig && sig.dir === dir){
          var et = sig.edge
            ? ((sig.entryType === 'MARKET' ? 'MARKET @ ' : 'LIMIT @ ') + sig.edge)
            : (sig.entryType || 'LIMIT');
          return Object.assign({}, plan, {
            entry: sig.entry, stop: sig.stop, t1: sig.t1, t2: sig.t2,
            rr: sig.rr, rr1: sig.rr,
            rr2: (sig.risk > 0) ? Math.abs(sig.t2 - sig.entry) / sig.risk : plan.rr2,
            entryType: et, entryGuidance: sig.entryGuidance,
            anchor: sig.anchor, zone: sig.zone, mark: sig.mark,
            edge: sig.edge, planSrc: plan.planSrc || 'edgeSignal',
            targetPolicy: plan.targetPolicy || 'exact structure (EDGE parity)'
          });
        }
      }catch(eEdge){}
    }

    if (plan.entryType && plan.entryGuidance && isFinite(plan.entry)
        && Math.abs(plan.entry - markClose) > 1e-9){
      return plan;
    }

    if (style === 'scalp'){
      return hgEnrichScalpExact(plan, opts.m15 || rows4h, opts);
    }

    if (typeof hgEnrichSmartPlan === 'function' && (style === 'swing' || plan.type === 'SWING')){
      var sp = hgEnrichSmartPlan(Object.assign({ type: 'SWING' }, plan), rows4h);
      if (sp) return sp;
    }

    return hgEnrichGenericExact(plan, rows4h, opts);
  }catch(e){ return plan; }
}

function hgPlanMeta(plan){
  try{
    if (!plan) return {};
    return {
      entryType: plan.entryType,
      entryGuidance: plan.entryGuidance,
      targetPolicy: plan.targetPolicy
    };
  }catch(e){ return {}; }
}

function hgSweepReclaimOk(bars, r, dir, priorLevel, minBodyAtr){
  try{
    var closes = bars.closes || (bars.map ? bars.map(function(row){ return row.c; }) : null);
    if (!closes) return false;
    var cr = closes[r];
    if (!isFinite(cr)) return false;
    if (dir === 'long' && !(cr > priorLevel)) return false;
    if (dir === 'short' && !(cr < priorLevel)) return false;
    if (!(minBodyAtr > 0)) return true;
    var row = bars.rows && bars.rows[r] ? bars.rows[r] : (Array.isArray(bars) ? bars[r] : null);
    var or = row && isFinite(row.o) ? row.o : NaN;
    var atrArr = bars.atr;
    var atrr = atrArr && isFinite(atrArr[r]) ? atrArr[r] : NaN;
    if (!isFinite(or) || !isFinite(atrr) || !(atrr > 0)) return false;
    return Math.abs(cr - or) > minBodyAtr * atrr;
  }catch(e){ return false; }
}

function hgDetectLiquiditySweep(bars, i, dir, priorLevel, opts){
  opts = opts || {};
  try{
    if (!bars || !isFinite(priorLevel) || !isFinite(i)) return null;
    var maxBack = Math.min(opts.maxBars !== undefined ? opts.maxBars : HG_SWEEP_RECLAIM_MAX, i);
    var maxSpan = opts.maxBars !== undefined ? opts.maxBars : HG_SWEEP_RECLAIM_MAX;
    var minBodyAtr = (opts.minBodyAtr !== undefined) ? opts.minBodyAtr : HG_SWEEP_RECLAIM_BODY_ATR;
    var lows = bars.lows || bars.map(function(r){ return r.l; });
    var highs = bars.highs || bars.map(function(r){ return r.h; });
    var sweepBar = -1, sweepExtreme = NaN, reclaimBar = -1;
    for (var b = 0; b <= maxBack; b++){
      var j = i - b;
      if (dir === 'long'){
        if (!(isFinite(lows[j]) && lows[j] < priorLevel)) continue;
        sweepBar = j; sweepExtreme = lows[j];
        for (var r = j; r <= i && r - j <= maxSpan; r++){
          if (hgSweepReclaimOk(bars, r, 'long', priorLevel, minBodyAtr)){ reclaimBar = r; break; }
        }
        if (reclaimBar >= 0) break;
      } else {
        if (!(isFinite(highs[j]) && highs[j] > priorLevel)) continue;
        sweepBar = j; sweepExtreme = highs[j];
        for (var r2 = j; r2 <= i && r2 - j <= maxSpan; r2++){
          if (hgSweepReclaimOk(bars, r2, 'short', priorLevel, minBodyAtr)){ reclaimBar = r2; break; }
        }
        if (reclaimBar >= 0) break;
      }
    }
    if (sweepBar < 0 || reclaimBar < 0) return null;
    return { swept: true, sweepBar: sweepBar, reclaimBar: reclaimBar,
             priorLevel: priorLevel, sweepExtreme: sweepExtreme };
  }catch(e){ return null; }
}

function hgSweepStop(dir, sweepExtreme, atrVal, opts){
  opts = opts || {};
  try{
    var mult = (opts.atrMult !== undefined) ? opts.atrMult : HG_SWEEP_STOP_ATR;
    if (!isFinite(sweepExtreme) || !isFinite(atrVal)) return NaN;
    return (dir === 'long') ? sweepExtreme - mult * atrVal : sweepExtreme + mult * atrVal;
  }catch(e){ return NaN; }
}

/* --- OTE zone 62–79%, 70.5% entry --- */
function hgOteZone(impulseLo, impulseHi, dir){
  try{
    impulseLo = +impulseLo; impulseHi = +impulseHi;
    var span = impulseHi - impulseLo;
    if (!(span > 0)) return null;
    var OTE_LO = 0.62, OTE_HI = 0.79, OTE_MID = 0.705;
    if (dir === 'long'){
      return {
        lo: impulseHi - OTE_HI * span, hi: impulseHi - OTE_LO * span,
        mid: impulseHi - OTE_MID * span, entry: impulseHi - OTE_MID * span
      };
    }
    return {
      lo: impulseLo + OTE_LO * span, hi: impulseLo + OTE_HI * span,
      mid: impulseLo + OTE_MID * span, entry: impulseLo + OTE_MID * span
    };
  }catch(e){ return null; }
}

/* --- entry refinement: LIMIT vs MARKET from zone --- */
function hgRefineEntry(mark, entry, zone, dir){
  try{
    mark = +mark; entry = +entry;
    if (!isFinite(mark) || !isFinite(entry)) return { entryType: 'MARKET', inZone: false, guidance: '' };
    var zLo = zone && isFinite(zone.lo) ? zone.lo : entry;
    var zHi = zone && isFinite(zone.hi) ? zone.hi : entry;
    var inZone = mark >= zLo && mark <= zHi;
    if (inZone) return { entryType: 'MARKET', inZone: true, guidance: 'price in entry zone — market fill valid' };
    if (dir === 'long'){
      return mark < entry
        ? { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — mark below entry, order working' }
        : { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — wait for pullback to structure' };
    }
    return mark > entry
      ? { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — mark above entry, order working' }
      : { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — wait for rally into resistance' };
  }catch(e){ return { entryType: 'LIMIT', inZone: false, guidance: '' }; }
}

/* --- plan footer label for cards --- */
function hgPlanMetaLabel(plan){
  try{
    if (!plan) return '';
    var parts = [];
    if (plan.planSrc) parts.push(plan.planSrc);
    if (plan.targetPolicy) parts.push(plan.targetPolicy);
    if (plan.swingGates) parts.push('SWING ' + plan.swingGates);
    if (plan.swingClean === true) parts.push('SWING CLEAN');
    else if (plan.swingClean === false && plan.swingGates) parts.push('not SWING CLEAN');
    if (plan.entryType) parts.push(plan.entryType);
    return parts.join(' · ');
  }catch(e){ return ''; }
}

function hgScalpPostEnrichValid(hit, opts){
  opts = opts || {};
  try{
    if (!hit || !hit.dir) return null;
    var dir = hit.dir;
    var entry = +hit.entry, stop = +hit.stop;
    if (!isFinite(entry) || !isFinite(stop)) return null;
    if (dir === 'long' && stop >= entry) return null;
    if (dir === 'short' && stop <= entry) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var a = opts.a;
    if (!isFinite(a) && opts.rows && typeof atr === 'function'){
      a = _last(atr(opts.rows, 14));
    }
    if (!isFinite(a) || a <= 0) return null;
    var minRr = opts.minRr !== undefined ? opts.minRr : 2.25;
    var expectedMove = a * 2.5;
    var dynamicRR = expectedMove / risk;
    if (dynamicRR < minRr) return null;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + (a * 4) : entry - (a * 4);
    var rr1 = Math.abs(t1 - entry) / risk;
    if (rr1 < minRr) return null;
    var out = Object.assign({}, hit);
    out.entry = entry; out.stop = stop;
    out.t1 = t1; out.t2 = t2;
    out.rr = dynamicRR; out.rr1 = rr1;
    out.rr2 = Math.abs(t2 - entry) / risk;
    out.riskPct = risk / entry * 100;
    return out;
  }catch(e){ return null; }
}

/* --- post-enrichment swing ticket validation (G6 parity after enrich) --- */
function hgSwingPostEnrichValid(hit, opts){
  opts = opts || {};
  try{
    if (!hit || !hit.dir) return null;
    var dir = hit.dir;
    var entry = +hit.entry, stop = +hit.stop;
    if (!isFinite(entry) || !isFinite(stop)) return null;
    if (dir === 'long' && stop >= entry) return null;
    if (dir === 'short' && stop <= entry) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var a4 = opts.a4;
    if (!isFinite(a4) && opts.rows && typeof atr === 'function'){
      a4 = _last(atr(opts.rows, 14));
    }
    if (!isFinite(a4) || a4 <= 0) return null;
    var minRr = opts.minRr !== undefined ? opts.minRr : HG_MIN_RR_DEFAULT;
    var expMult = opts.expMult !== undefined ? opts.expMult : 3.5;
    var dynamicRR = (a4 * expMult) / risk;
    if (dynamicRR < minRr) return null;
    var tg = hgPlanSwingTargets(dir, entry, stop, a4, opts.targetOpts || {});
    if (!tg || tg.rr1 < minRr) return null;
    var out = Object.assign({}, hit);
    out.entry = entry; out.stop = stop;
    out.t1 = tg.t1; out.t2 = tg.t2;
    out.rr = dynamicRR; out.rr1 = tg.rr1; out.rr2 = tg.rr2;
    out.riskPct = risk / entry * 100;
    out.targetPolicy = out.targetPolicy || tg.targetPolicy;
    return out;
  }catch(e){ return null; }
}

function hgSwingHitToPlan(hit){
  try{
    if (!hit || !hit.dir) return null;
    var entry = +hit.entry, stop = +hit.stop, t1 = +hit.t1, t2 = +hit.t2;
    if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)) return null;
    var dir = hit.dir;
    if (dir === 'long' && stop >= entry) return null;
    if (dir === 'short' && stop <= entry) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var rr1 = isFinite(hit.rr1) ? hit.rr1 : (isFinite(hit.rr) ? hit.rr : Math.abs(t1 - entry) / risk);
    return {
      type: 'SWING', dir: dir, entry: entry, stop: stop, t1: t1, t2: isFinite(t2) ? t2 : null,
      rr1: rr1, rr2: isFinite(hit.rr2) ? hit.rr2 : (isFinite(t2) ? Math.abs(t2 - entry) / risk : null),
      riskPct: isFinite(hit.riskPct) ? hit.riskPct : risk / entry * 100,
      confirmed: true,
      note: hit.entryType || 'swingTryClean 7/7',
      entryType: hit.entryType, entryGuidance: hit.entryGuidance,
      planSrc: 'swingTryClean', targetPolicy: hit.targetPolicy,
      _swingClean: true
    };
  }catch(e){ return null; }
}

function hgSwingCleanPlan(rows, ticker, dir){
  try{
    if (typeof swingTryClean !== 'function' || !rows || !dir) return null;
    var hit = swingTryClean(rows, ticker || null);
    if (!hit || hit.dir !== dir) return null;
    return hgSwingHitToPlan(hit);
  }catch(e){ return null; }
}

/* --- swing parity from cryptogates (EXECUTE / cards) --- */
function hgSwingParity(rows, ticker, dir){
  try{
    if (typeof swingGateMatrix !== 'function' || !rows || !dir) return null;
    var m = swingGateMatrix(rows, ticker || null);
    if (!m || !m.dir || m.dir !== dir) return { aligned: false, passed: 0, gatesTotal: 7, clean: false, g6: false, g7: false };
    return {
      aligned: true, passed: m.passed, gatesTotal: m.gatesTotal, clean: m.clean === true,
      g6: m.gates[5] ? m.gates[5][1] : false,
      g7: m.gates[6] ? m.gates[6][1] : false,
      dynamicRR: isFinite(m.dynamicRR) ? m.dynamicRR : null,
      label: m.passed + '/' + m.gatesTotal + (m.clean ? ' CLEAN' : '')
    };
  }catch(e){ return null; }
}

/* --- gold swing target ladder (unified naming) --- */
var HG_GOLD_T1_R = 1.5;
var HG_GOLD_T2_R = 2.5;
var HG_GOLD_T3_R = 4.0;

/* --- unified swing targets: max(ATR excursion, R-multiple floor) --- */
function hgPlanSwingTargets(dir, entry, stop, atr, opts){
  opts = opts || {};
  try{
    entry = +entry; stop = +stop; atr = +atr;
    if (!(dir === 'long' || dir === 'short')) return null;
    if (!(isFinite(entry) && isFinite(stop) && isFinite(atr) && atr > 0)) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var expMult = opts.expMult !== undefined ? opts.expMult : 3.5;
    var maxMult = opts.maxMult !== undefined ? opts.maxMult : 4.9;
    var t1R = opts.t1R !== undefined ? opts.t1R : HG_T1_R;
    var t2R = opts.t2R !== undefined ? opts.t2R : HG_T2_R;
    var expMove = atr * expMult;
    var maxExc = atr * maxMult;
    var t1Atr = (dir === 'long') ? entry + expMove : entry - expMove;
    var t2Atr = (dir === 'long') ? entry + maxExc : entry - maxExc;
    var t1Rlv = (dir === 'long') ? entry + t1R * risk : entry - t1R * risk;
    var t2Rlv = (dir === 'long') ? entry + t2R * risk : entry - t2R * risk;
    var t1 = (dir === 'long') ? Math.max(t1Atr, t1Rlv) : Math.min(t1Atr, t1Rlv);
    var t2 = (dir === 'long') ? Math.max(t2Atr, t2Rlv) : Math.min(t2Atr, t2Rlv);
    var rr1 = Math.abs(t1 - entry) / risk;
    return {
      t1: t1, t2: t2, rr1: rr1, rr2: Math.abs(t2 - entry) / risk,
      targetPolicy: 'unified: max(ATR excursion, ' + t1R + 'R/' + t2R + 'R floor)',
      planSrc: 'swingTryClean'
    };
  }catch(e){ return null; }
}

/* --- LIMIT-first enrichment for SWING CLEAN hits --- */
function hgEnrichSwingClean(hit, rows, matrix){
  try{
    if (!hit || !hit.dir || !rows || !rows.length) return hit;
    var dir = hit.dir;
    var m = matrix || {};
    var p = isFinite(hit.mark) ? hit.mark : (isFinite(m.p) ? m.p : +rows[rows.length - 1].c);
    var e9 = m.e9, e21 = m.e21, a4 = m.a4;
    if (!(isFinite(a4) && a4 > 0) && typeof atr === 'function'){
      a4 = _last(atr(rows, 14));
    }
    var entry = hit.entry;
    var entryType = hit.entryType || 'MARKET';
    var anchor = entry;
    var zone = { lo: entry, hi: entry };
    var guidance = '';

    if (isFinite(e21) && isFinite(a4)){
      var tol = 0.4 * a4;
      var dist21 = Math.abs(p - e21) / a4;
      if (dist21 > 0.25){
        anchor = e21;
        entry = e21;
        zone = { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 };
        entryType = 'LIMIT @ EMA21';
      } else if (isFinite(e9)){
        var dist9 = Math.abs(p - e9) / a4;
        if (dist9 > 0.25){
          anchor = e9;
          entry = (dir === 'long') ? Math.min(p, e9) : Math.max(p, e9);
          zone = { lo: e9 - tol * 0.5, hi: e9 + tol * 0.25 };
          entryType = 'LIMIT @ EMA9';
        }
      }
    }

    if (typeof hgRefineEntry === 'function'){
      var ref = hgRefineEntry(p, entry, zone, dir);
      if (ref.entryType === 'MARKET') entryType = entryType.replace(/^LIMIT/, 'MARKET');
      guidance = ref.guidance || '';
      if (ref.inZone && entryType.indexOf('MARKET') < 0) entryType = 'MARKET @ ' + entryType.replace('LIMIT @ ', '');
    }

    var stop = hit.stop;
    if (typeof hgStructureStop === 'function' && rows && rows.length){
      /* Read the LIVE lookback rather than a second hardcoded 30. Pack 2 fixed
         exactly this shape once already: the matrix gated on one stop and the
         enricher then computed a different one, so the ticket you would have
         placed was never the ticket that passed. Measured on 3,000 tapes with
         the matrix at 20 and this left at 30: 14 tickets instead of 16.
         plans.js loads BEFORE cryptogates.js, so this must be read at CALL
         time off window — not captured at load, when it does not exist yet. */
      var swLook = (typeof window !== 'undefined' && window.CG_SWING_LOOK > 1)
        ? window.CG_SWING_LOOK : 30;
      var st = hgStructureStop(dir, entry, rows, { atrLen: 14, look: swLook, buffer: 0 });
      if (st && isFinite(st.stop) && (dir === 'long' ? st.stop < entry : st.stop > entry)){
        stop = st.stop;
        entryType += ' · structure stop';
        var scaleFn = (typeof G.hgLiveStopScale === 'function') ? G.hgLiveStopScale : null;
        if (scaleFn){
          var sc = scaleFn();
          if (isFinite(sc) && sc > 0 && Math.abs(sc - 1) > 0.02){
            var risk0 = Math.abs(entry - stop);
            var risk1 = risk0 * sc;
            stop = dir === 'long' ? entry - risk1 : entry + risk1;
            entryType += ' · ledger stop ×' + (Math.round(sc * 100) / 100);
          }
        }
      }
    }
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return hit;

    var tg = hgPlanSwingTargets(dir, entry, stop, a4, {});
    if (!tg) return hit;

    var out = Object.assign({}, hit, {
      entry: entry, stop: stop, t1: tg.t1, t2: tg.t2, rr: tg.rr1,
      entryType: entryType, anchor: anchor, zone: zone, mark: p,
      entryGuidance: guidance, targetPolicy: tg.targetPolicy, planSrc: tg.planSrc
    });
    return out;
  }catch(e){ return hit; }
}

/* --- SMART $ SWING plan entry refinement --- */
function hgEnrichSmartPlan(plan, rows4h){
  try{
    if (!plan || !rows4h || !rows4h.length || plan.type !== 'SWING') return plan;
    var dir = plan.dir;
    var n = rows4h.length - 1;
    var mark = rows4h[n].c;
    if (typeof ema !== 'function' || typeof atr !== 'function') return plan;
    var c4 = rows4h.map(function(r){ return r.c; });
    var e21 = _last(ema(c4, 21));
    var a4 = _last(atr(rows4h, 14));
    if (!(isFinite(e21) && isFinite(a4))) return plan;
    var tol = 0.4 * a4;
    var entry = e21;
    var zone = { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 };
    var ref = hgRefineEntry(mark, entry, zone, dir);
    plan.entry = entry;
    plan.entryType = ref.inZone ? 'MARKET' : 'LIMIT @ EMA21';
    plan.entryGuidance = ref.guidance;
    plan.anchor = e21;
    plan.planSrc = plan.planSrc || 'smartSetup';
    if (!plan.targetPolicy) plan.targetPolicy = 'R-multiples (2R/3.5R)';
    var swLook2 = (typeof window !== 'undefined' && window.CG_SWING_LOOK > 1)
      ? window.CG_SWING_LOOK : 30;
    var st = hgStructureStop(dir, entry, rows4h, { atrLen: 14, look: swLook2 });
    if (st){
      plan.stop = st.stop;
      var pr = hgPlanFromRisk(dir, entry, st.stop, { minRr: HG_MIN_RR_SWING, targetPolicy: plan.targetPolicy });
      if (pr){
        plan.t1 = pr.t1; plan.t2 = pr.t2; plan.rr1 = pr.rr1; plan.rr2 = pr.rr2; plan.riskPct = pr.riskPct;
      }
    }
    /* plan.entry was moved to the EMA21 unconditionally several lines above,
       but the stop and every target sit behind `if (st)`. With no structure
       stop the plan went on carrying its original stop, targets and ratios
       against a new entry — and this function mutates the caller's object
       rather than a copy, so the inconsistency travelled with it. */
    hgSyncPlanRatios(plan);
    return plan;
  }catch(e){ return plan; }
}

function hgTicketFinalGates(plan, ctx){
  ctx = ctx || {};
  try{
    if (!plan || !plan.dir) return { ok: true, chips: [] };
    var chips = [];
    var lane = ctx.lane || ((/(XAU|PAXG|GOLD)/i.test(String(plan.sym || ''))) ? 'gold' : 'crypto');

    if (typeof G.hgRegimeResolveState === 'function' && typeof G.hgRegimeAdjust === 'function'){
      var rs = G.hgRegimeResolveState();
      var adj = G.hgRegimeAdjust({ minRR: ctx.minRr || 2 }, rs.dark ? null : rs.score, lane);
      plan.regimeLabel = adj.regimeLabel;
      plan.regimeApplied = adj.applied;
      if (rs.dark) chips.push('regime dark');
      else chips.push('regime ' + adj.regimeLabel);
      var rr1 = isFinite(plan.rr1) ? plan.rr1 : (isFinite(plan.rr) ? plan.rr : null);
      if (rr1 !== null && rr1 < adj.thresholds.minRR){
        return {
          ok: false, tag: 'regime',
          reason: 'VETO — minRR ' + adj.thresholds.minRR.toFixed(1) + ' required in ' + adj.regimeLabel
            + ' (setup ' + rr1.toFixed(1) + 'R)',
        };
      }
      if (adj.thresholds.vetoCounterTrend && ctx.counterTrend === true){
        return { ok: false, tag: 'regime', reason: 'VETO — counter-trend blocked in ' + adj.regimeLabel };
      }
    }

    if (typeof G.hgPlanCostCheck === 'function'){
      var cc = G.hgPlanCostCheck(plan, ctx);
      if (!cc.ok) return { ok: false, tag: 'cost', reason: cc.reason || 'cost veto' };
      if (cc.chip) chips.push(cc.chip);
      if (cc.cost && cc.cost.degraded) chips.push('cost degraded');
    }

    if (ctx.volPack && typeof G.hgStopVolChip === 'function'){
      var vc = G.hgStopVolChip(plan.entry, plan.stop, ctx.volPack);
      if (vc && vc.chip) chips.push(vc.chip);
    }

    if (typeof G.hgEdgeFor === 'function' && typeof G.hgScoreRecords === 'function'){
      var edgeCand = {
        symbol: plan.sym, side: plan.dir,
        poiKind: plan.planSrc || ctx.poiKind || 'plan',
        regime: plan.regimeLabel || ctx.regime || null,
        confluence: ctx.confluence,
        atrPct: ctx.atrPct,
        ts: Date.now(),
        rr: isFinite(plan.rr1) ? plan.rr1 : plan.rr
      };
      var edgeRow = G.hgEdgeFor(edgeCand, G.hgScoreRecords());
      if (edgeRow && edgeRow.tier === 'PROVEN-BAD'){
        return { ok: false, tag: 'edge', reason: 'VETO — PROVEN-BAD archetype on your ledger' };
      }
      if (edgeRow && edgeRow.n > 0 && typeof G.hgEdgeArchetypeLine === 'function'){
        chips.push(G.hgEdgeArchetypeLine(edgeRow));
      } else if (edgeRow && edgeRow.noFingerprint > 0){
        chips.push('edge UNPROVEN — ' + edgeRow.noFingerprint + ' legacy records excluded');
      }
    }

    return { ok: true, chips: chips };
  }catch(e){
    /* Not a veto — a fault here is no evidence against the trade. But the
       ticket cannot claim it cleared the final gates, so it carries a chip
       saying they never ran. */
    return { ok: true, unchecked: true,
             uncheckedReason: 'final gates threw: ' + hgErrText(e),
             chips: ['FINAL GATES UNCHECKED'] };
  }
}

G.hgTicketFinalGates = hgTicketFinalGates;
G.hgPlanSwingTargets = hgPlanSwingTargets;
G.hgEnrichSwingClean = hgEnrichSwingClean;
G.hgEnrichSmartPlan = hgEnrichSmartPlan;
G.hgEnrichGenericExact = hgEnrichGenericExact;
G.hgEnrichScalpExact = hgEnrichScalpExact;
G.hgApplyExactEntry = hgApplyExactEntry;
G.hgPlanMeta = hgPlanMeta;
G.hgFormatEntryType = hgFormatEntryType;
G.hgConfirmedCascade = hgConfirmedCascade;
G.hgRegimeAllowsSetup = hgRegimeAllowsSetup;
G.hgMacroAllowsCrypto = hgMacroAllowsCrypto;
G.hgBtcdPct = hgBtcdPct;
G.hgIsCryptoMajor = hgIsCryptoMajor;
G.hgTapeRegimeLabel = hgTapeRegimeLabel;
G.hgEnrichTickerFundingTwin = hgEnrichTickerFundingTwin;
G.hgPostGateSetupVeto = hgPostGateSetupVeto;
G.hgPostGateGoldVeto = hgPostGateGoldVeto;
G.hgFilterGoldPostGate = hgFilterGoldPostGate;
G.hgAssessFlowTrap = hgAssessFlowTrap;
G.hgFlowBinanceSymbol = hgFlowBinanceSymbol;
G.hgNearQualityHint = hgNearQualityHint;
G.hgCryptoRankBoost = hgCryptoRankBoost;
G.hgGoldWeekendConvictionDemote = hgGoldWeekendConvictionDemote;
G.hgApplyGoldWeekendDemotes = hgApplyGoldWeekendDemotes;
G.HG_GOLD_WEEKEND_EXCEED_MAX = HG_GOLD_WEEKEND_EXCEED_MAX;
G.hgStaleMomentumVeto = hgStaleMomentumVeto;
G.hgUncheckedGate = hgUncheckedGate;
G.hgSyncPlanRatios = hgSyncPlanRatios;
G.hgMarkGateUnchecked = hgMarkGateUnchecked;
G.hgPostGateBannerHtml = hgPostGateBannerHtml;
G.hgCmpSetupQuality = hgCmpSetupQuality;
G.hgRankCryptoSetups = hgRankCryptoSetups;
G.hgSetupHasLevels = hgSetupHasLevels;
G.hgPickMostProbable = hgPickMostProbable;
G.hgNormalizeSetupRow = hgNormalizeSetupRow;
G.hgCollectSetupRows = hgCollectSetupRows;
G.hgPickMostProbableAny = hgPickMostProbableAny;
G.hgIsBtcSymbol = hgIsBtcSymbol;
G.hgBtcCandleSymbol = hgBtcCandleSymbol;
G.hgSwingG5OK = hgSwingG5OK;
G.hgRegimeRouteHint = hgRegimeRouteHint;
G.hgRegimeRouteHintHtml = hgRegimeRouteHintHtml;
G.hgTripleStackMatch = hgTripleStackMatch;
G.hgTripleStackChipHtml = hgTripleStackChipHtml;
G.hgVenueDataNote = hgVenueDataNote;
G.hgFunnelPanelHTML = hgFunnelPanelHTML;
G.hgStructureStop = hgStructureStop;
/* Exported so the restatement can be tested apart from a full plan build —
   the note it rewrites is the card's only warning about stop width. */
G.hgRestateStopNote = hgRestateStopNote;
G.hgPlanFromRisk = hgPlanFromRisk;
G.hgPlanLevelsCore = hgPlanLevelsCore;
G.hgDetectLiquiditySweep = hgDetectLiquiditySweep;
G.hgSweepStop = hgSweepStop;
G.hgOteZone = hgOteZone;
G.hgRefineEntry = hgRefineEntry;
G.hgPlanMetaLabel = hgPlanMetaLabel;
G.hgSwingParity = hgSwingParity;
G.hgSwingPostEnrichValid = hgSwingPostEnrichValid;
G.hgSwingHitToPlan = hgSwingHitToPlan;
G.hgSwingCleanPlan = hgSwingCleanPlan;
G.hgScalpPostEnrichValid = hgScalpPostEnrichValid;
G.HG_GOLD_T1_R = HG_GOLD_T1_R;
G.HG_GOLD_T2_R = HG_GOLD_T2_R;
G.HG_GOLD_T3_R = HG_GOLD_T3_R;
G.HG_T1_R = HG_T1_R;
G.HG_T2_R = HG_T2_R;
G.HG_MIN_RR_DEFAULT = HG_MIN_RR_DEFAULT;
G.HG_SWEEP_RECLAIM_MAX = HG_SWEEP_RECLAIM_MAX;

})();
