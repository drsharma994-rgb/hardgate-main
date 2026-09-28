/* =========================================================================
HARDGATE — regime-stack.js
THE HOUSE GOLD REGIME — one shared read of what the 4h gold tape is DOING,
so every desk answers the same question the same way (hg-v1007).

WHY THIS EXISTS
---------------
A breakout rule and a mean-reversion rule have OPPOSITE expectancy in the
same market, and gold ranges most of the time intraday but trends violently
on macro days. Until this pack every gold desk ran its one style in all
weather: OPTI GOLD placed break-of-structure limits in a compressed tape
(the population where breaks fade), and no desk could say "the house regime
is against my style" because there was no house regime.

regime.js answers a DIFFERENT question — market-wide risk appetite from BTC,
liquidity, DXY and yields — and stays untouched. This module reads the GOLD
TAPE ITSELF: is XAU trending, ranging, compressed or exploding right now,
and in which direction.

WHAT IT IS BUILT FROM (all indicators.js primitives, reused, never re-derived)
------------------------------------------------------------------------------
  detectRegime(rows)  the house's existing volatility/structure read:
                      VOLATILE EXPANSION / COMPRESSION / STRONG TREND /
                      RANGE / WEAK TREND / DATA THIN
  adx(rows, 14)       Wilder ADX; the trend state uses detectRegime's own
                      strong-trend bar (30), not a new number
  ema(closes, 50)     direction: the close beyond EMA-50 with EMA-50
                      sloping the same way over 5 bars (the same span the
                      hg-v1006 confirmation floor uses)
  cascadeAge          how long the 9/21/50 ribbon has held alignment,
                      reported as evidence, never as a gate of its own

THE CONTRACT
------------
  hgGoldRegime(rows4h)      pure: rows in, regime read out; never throws,
                            never fabricates — thin tapes and absent
                            libraries return state 'unreadable' with why
  hgRegimePosture(style, regime, dir)
                            pure map: a desk STYLE x the regime x the
                            setup's direction -> favored / neutral /
                            caution / against / unreadable, with the
                            reason in plain words. Only 'against' may ever
                            bar a setup from a headline slot, and desks
                            keep the setup rendering regardless — the same
                            demote-don't-hide rule as hg-v1005/v1006.
  hgRegimeScanCands(cands, {style, regime})
                            stamps c.regime on every candidate that has a
                            direction — the seam the house-wide rollout
                            rides (the hgFundamentalScanCands analog).
  hgRegimeChipHtml(posture) the card chip; hgRegimePanelHtml(regime) the
                            board panel above the desk's scan output.

hg-v1007 wires the BREAKOUT style into OPTI GOLD (the desk whose breaks
fade most reliably in a ranging tape). Desks of other styles adopt the
shared read when their pack lands — one definition, zero drift.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}

/* The pure read. 4h rows in — the house's swing reference tape. Every
   primitive is resolved at CALL time and feature-checked: an absent
   indicator library is an unreadable regime, never a fabricated one. */
function hgGoldRegime(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 60){
      return { state: 'unreadable', dir: null,
               why: 'thin tape — fewer than 60 closed 4h bars, no regime is inferred' };
    }
    var _adx = (typeof adx === 'function') ? adx : null;
    var _ema = (typeof ema === 'function') ? ema : null;
    var _cascade = (typeof cascadeAge === 'function') ? cascadeAge : null;
    var _detect = (typeof detectRegime === 'function') ? detectRegime : null;
    if (!_adx || !_ema || !_cascade || !_detect){
      return { state: 'unreadable', dir: null,
               why: 'indicator library not loaded — no regime is inferred' };
    }
    var n = rows.length;
    var closes = rows.map(function(r){ return +r.c; });
    var dr = _detect(rows) || { regime: 'unknown', label: 'UNREADABLE' };

    var adxArr = _adx(rows, 14);
    var adxNow = (adxArr && adxArr.adx) ? adxArr.adx[n - 1] : NaN;

    var e50 = _ema(closes, 50);
    var eNow = e50[n - 1], ePrev = e50[n - 6];
    var cNow = closes[n - 1];
    var dir = null;
    if (isFinite(eNow) && isFinite(ePrev) && isFinite(cNow)){
      if (cNow > eNow && eNow > ePrev) dir = 'up';
      else if (cNow < eNow && eNow < ePrev) dir = 'down';
    }
    var caL = _cascade(closes, 'long'), caS = _cascade(closes, 'short');

    /* the state: detectRegime's structure read first (it owns volatility
       and compression), then the trend bar it uses itself — ADX 30 with a
       readable direction. Everything between is honestly 'weak'. */
    var state;
    if (dr.regime === 'volatile') state = 'volatile';
    else if (dr.regime === 'compression') state = 'compression';
    else if (dr.regime === 'range') state = 'range';
    else if (isFinite(adxNow) && adxNow >= 30 && dir) state = 'trend';
    else state = 'weak';

    var label = state === 'trend' ? ('TREND ' + dir.toUpperCase())
      : state === 'range' ? 'RANGE'
      : state === 'compression' ? 'COMPRESSION'
      : state === 'volatile' ? 'VOLATILE EXPANSION'
      : 'WEAK / NO DECISIVE REGIME';
    var line = label + ' — 4h structure read: ' + esc(dr.label || 'n/a')
      + ' · ADX ' + (isFinite(adxNow) ? adxNow.toFixed(0) : 'n/a')
      + ' · EMA-50 ' + (dir ? (dir === 'up' ? 'rising with price above it' : 'falling with price below it') : 'without a readable direction')
      + ' · ribbon aligned ' + Math.max(caL, caS) + ' bar(s) ' + (caL >= caS ? 'long' : 'short');
    return { state: state, dir: dir, adx: isFinite(adxNow) ? adxNow : null,
             ema50: isFinite(eNow) ? eNow : null, cascadeLong: caL, cascadeShort: caS,
             structure: dr.label || null, label: label, line: line };
  }catch(e){
    return { state: 'unreadable', dir: null, why: 'the regime read failed — nothing is inferred' };
  }
}

/* The posture map. PURE and deliberately small: only the BREAKOUT style is
   mapped, because OPTI GOLD is the desk wired in this pack — other styles
   land with their desks, and an unmapped style reads UNREADABLE rather than
   guessing. 'against' is the ONLY posture a desk may use to bar a headline
   slot; 'caution' and 'neutral' inform, they never bar. */
function hgRegimePosture(style, regime, dir){
  try{
    if (style !== 'breakout'){
      return { posture: 'unreadable', why: 'no posture map for the ' + String(style || 'unknown') + ' style yet' };
    }
    if (!regime || !regime.state || regime.state === 'unreadable'){
      return { posture: 'unreadable', why: (regime && regime.why) || 'the house regime could not be read' };
    }
    var d = (dir === 'long') ? 'up' : (dir === 'short') ? 'down' : null;
    switch (regime.state){
      case 'trend':
        if (d && regime.dir === d) return { posture: 'favored', why: 'the 4h house regime is TREND ' + regime.dir.toUpperCase() + ' and this break runs WITH it' };
        if (d && regime.dir && regime.dir !== d) return { posture: 'caution', why: 'a break against the 4h TREND ' + regime.dir.toUpperCase() + ' is a reversal attempt, not a continuation — the house informs, it does not bar' };
        return { posture: 'neutral', why: 'trending tape without a readable direction' };
      case 'range':
        return { posture: 'against', why: 'the 4h tape is RANGING — the population where breaks fade; this setup never takes a TOP PICK slot' };
      case 'compression':
        return { posture: 'against', why: 'the 4h tape is COMPRESSED — breaks printed here starve for range; this setup never takes a TOP PICK slot' };
      case 'volatile':
        return { posture: 'caution', why: 'VOLATILITY EXPANSION on the 4h tape — stops get run in this regime; informed, not barred' };
      default:
        return { posture: 'neutral', why: 'no decisive 4h regime — the regime does not speak for or against' };
    }
  }catch(e){ return { posture: 'unreadable', why: 'posture read failed' }; }
}

/* The scan seam — the hgFundamentalScanCands analog. Stamps c.regime on
   every candidate that carries a direction; candidates without one pass
   through untouched rather than acquiring a fabricated verdict. */
function hgRegimeScanCands(cands, opts){
  try{
    if (!Array.isArray(cands) || !opts || !opts.regime) return 0;
    var stamped = 0;
    for (var i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      c.regime = hgRegimePosture(opts.style, opts.regime, c.dir);
      stamped++;
    }
    return stamped;
  }catch(e){ return 0; }
}

/* The card chip. Only the postures that SPEAK wear one — neutral says
   nothing, and an unreadable regime says nothing on the card (the panel
   above the board carries that once, not once per card). */
function hgRegimeChipHtml(r){
  try{
    if (!r || !r.posture) return '';
    if (r.posture === 'favored') return '<span class="stamp ok">REGIME WITH IT</span>';
    if (r.posture === 'caution') return '<span class="stamp warn">REGIME CAUTION</span>';
    if (r.posture === 'against') return '<span class="stamp bad">REGIME AGAINST — never a TOP PICK</span>';
    return '';
  }catch(e){ return ''; }
}

/* The board panel — one line above the desk's scan output, beside the
   fundamental board. Honest when unreadable rather than absent. */
function hgRegimePanelHtml(regime){
  try{
    if (!regime) return '';
    if (regime.state === 'unreadable'){
      return '<div class="note" style="margin-bottom:10px;padding:8px 10px;border-left:3px solid #6b7280">'
        + '<b>HOUSE REGIME UNREADABLE</b> — ' + esc(regime.why || 'the 4h tape could not be read')
        + '. No setup is favored or barred on regime grounds.</div>';
    }
    var cls = regime.state === 'trend' ? '#166534'
      : (regime.state === 'range' || regime.state === 'compression') ? '#b45309'
      : '#6b7280';
    return '<div class="note" style="margin-bottom:10px;padding:8px 10px;border-left:3px solid ' + cls + '">'
      + '<b>HOUSE REGIME (4h)</b> — ' + esc(regime.line || regime.label || '')
      + '. Breakout desks answer to it: with-trend breaks are favored, breaks in a ranging or '
      + 'compressed tape never take a TOP PICK slot.</div>';
  }catch(e){ return ''; }
}

W.hgGoldRegime = hgGoldRegime;
W.hgRegimePosture = hgRegimePosture;
W.hgRegimeScanCands = hgRegimeScanCands;
W.hgRegimeChipHtml = hgRegimeChipHtml;
W.hgRegimePanelHtml = hgRegimePanelHtml;

})();
