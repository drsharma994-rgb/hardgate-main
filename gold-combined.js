/* HARDGATE — gold-combined.js (hg-v1109)
   One setup per gold tab. The v1105 playbook, plus the next layer:
   USDJPY as an inverse filter, the gold/silver ratio, the 2s10s curve,
   session volume profile, Heikin Ashi, Renko and KAMA. GLD tonnage is
   unread — there is no keyless holdings feed. v1107 adds the paper-versus-physical layer that can actually be read: COMEX minus spot, and the GLD/GDX spread. Skew, lease rates, Swiss customs and the Shanghai premium stay unread. v1108 adds the gold futures curve, the gold/oil ratio, and a wider second target when a safe-haven headline is already on the tape. Dealer gamma, COMEX vault stocks, the SOFR pair and BRICS settlement stay unread. v1109 adds a corrected Hurst exponent on the daily closes, a variance-targeted GARCH(1,1) for the second target, and a pause through the London AM and PM fixes. The auction imbalance, the mine-by-mine cost curve and the order book stay unread. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
if (W.__hgGoldCombinedBoot === 1109) return;
W.__hgGoldCombinedBoot = 1109;

var TABS = {
  goldscalp:     { name: 'GOLD SCALP', tf: '15m', atrMult: 1.2, r1: 1.2, r2: 2 },
  goldswing:     { name: 'GOLD SWING', tf: '4h', atrMult: 2, r1: 2, r2: 3.5 },
  omnigold:      { name: 'OMNIGOLD', tf: '1h', atrMult: 1.5, r1: 1.5, r2: 2.5 },
  goldpro:       { name: 'GOLD PRO', tf: '1h', atrMult: 1.5, r1: 2, r2: 3 },
  goldpine:      { name: 'GOLD PINE', tf: '4h', atrMult: 1.8, r1: 2, r2: 3 },
  goldultra:     { name: 'GOLD ULTRA', tf: '15m', atrMult: 1.5, r1: 1.5, r2: 2.5 },
  golddirection: { name: 'GOLD DIRECTION', tf: '4h', atrMult: 2, r1: 2, r2: 4 },
  goldcoint:     { name: 'GOLD COINT', tf: '1d', atrMult: 1.5, r1: 2, r2: 3 },
  goldspot:      { name: 'GOLD SPOT', tf: '1h', atrMult: 1.2, r1: 1.2, r2: 2 }
};
var bag = null;
var busy = false;
var painting = false;

function gfn(n){ try{ return (typeof W[n] === 'function') ? W[n] : null; }catch(e){ return null; } }
function fin(v){ var n = +v; return isFinite(n) ? n : NaN; }
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}
function last(a){
  if (!a || !a.length) return NaN;
  for (var i = a.length - 1; i >= 0; i--) if (isFinite(a[i])) return a[i];
  return NaN;
}
function px(n){ return isFinite(n) ? n.toFixed(2) : '—'; }
function word(side){ return side === 'long' ? 'LONG' : side === 'short' ? 'SHORT' : 'NO SETUP'; }
function arrow(side, why){
  return '<b>→ ' + esc(word(side)) + '</b>' + (why ? ' · ' + esc(why) : '');
}
function clean(rows){
  var o = [], i, r, h, l, c;
  for (i = 0; i < (rows || []).length; i++){
    r = rows[i];
    if (!r) continue;
    h = fin(r.h); l = fin(r.l); c = fin(r.c);
    if (!(h > 0 && l > 0 && c > 0) || h < l) continue;
    o.push({ o: isFinite(fin(r.o)) ? fin(r.o) : c, h: h, l: l, c: c, v: fin(r.v) });
  }
  return o;
}
function intraday(tf){ return tf === '15m' || tf === '1h'; }

function sweepOf(rows){
  if (!rows || rows.length < 25) return null;
  var n = rows.length, lastBar = rows[n - 1], hi = -Infinity, lo = Infinity, i;
  for (i = n - 21; i < n - 1; i++){
    if (rows[i].h > hi) hi = rows[i].h;
    if (rows[i].l < lo) lo = rows[i].l;
  }
  if (!(hi > 0) || !(lo > 0) || hi <= lo) return null;
  if (lastBar.l < lo && lastBar.c > lo) return { side: 'long', level: lo, wick: lastBar.l };
  if (lastBar.h > hi && lastBar.c < hi) return { side: 'short', level: hi, wick: lastBar.h };
  return null;
}

function divOf(closes, rsiArr){
  var fp = gfn('findPivots');
  if (!fp || !closes || closes.length < 30 || !rsiArr) return null;
  var piv = fp(closes, 3), highs = [], lows = [], i, p, a, b;
  for (i = 0; i < piv.length; i++){
    p = piv[i];
    if (p.type === 'high') highs.push(p);
    else if (p.type === 'low') lows.push(p);
  }
  if (highs.length >= 2){
    a = highs[highs.length - 2]; b = highs[highs.length - 1];
    if (b.i >= closes.length - 8 && b.v > a.v && isFinite(rsiArr[b.i]) && isFinite(rsiArr[a.i]) && rsiArr[b.i] < rsiArr[a.i] - 2){
      return { side: 'short', why: 'bearish RSI divergence — price high, RSI did not follow' };
    }
  }
  if (lows.length >= 2){
    a = lows[lows.length - 2]; b = lows[lows.length - 1];
    if (b.i >= closes.length - 8 && b.v < a.v && isFinite(rsiArr[b.i]) && isFinite(rsiArr[a.i]) && rsiArr[b.i] > rsiArr[a.i] + 2){
      return { side: 'long', why: 'bullish RSI divergence — price low, RSI did not follow' };
    }
  }
  return null;
}


function haSide(rows){
  if (!rows || rows.length < 3) return 'none';
  var prevO = (rows[0].o + rows[0].c) / 2, prevC = (rows[0].o + rows[0].h + rows[0].l + rows[0].c) / 4;
  var o, c, i, last = 'none', prev = 'none';
  for (i = 1; i < rows.length; i++){
    c = (rows[i].o + rows[i].h + rows[i].l + rows[i].c) / 4;
    o = (prevO + prevC) / 2;
    prev = last;
    last = c >= o ? 'long' : 'short';
    prevO = o; prevC = c;
  }
  if (last === prev) return last;
  return 'mixed';
}
function kamaLast(closes, n, fast, slow){
  n = n || 10; fast = fast || 2; slow = slow || 30;
  if (!closes || closes.length < n + 2) return NaN;
  var fastSC = 2 / (fast + 1), slowSC = 2 / (slow + 1);
  var kama = closes[n], i, j, change, vol, er, sc;
  for (i = n + 1; i < closes.length; i++){
    change = Math.abs(closes[i] - closes[i - n]);
    vol = 0;
    for (j = i - n + 1; j <= i; j++) vol += Math.abs(closes[j] - closes[j - 1]);
    er = vol > 0 ? change / vol : 0;
    sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    kama = kama + sc * (closes[i] - kama);
  }
  return kama;
}
function vwapLast(rows){
  var fn = gfn('vwapAt');
  if (!fn || !rows || !rows.length) return NaN;
  try{ return +fn(rows, rows.length - 1, 30); }catch(e){ return NaN; }
}
function profileCore(rows){
  if (!rows || rows.length < 20) return null;
  var vols = [], sumV = 0, lo = Infinity, hi = -Infinity, i, v, tp;
  for (i = 0; i < rows.length; i++){
    v = fin(rows[i].v);
    if (!(v > 0)) v = 0;
    vols.push(v); sumV += v;
    if (rows[i].l < lo) lo = rows[i].l;
    if (rows[i].h > hi) hi = rows[i].h;
  }
  if (!(sumV > 0) || !(hi > lo)) return null;
  var bins = 24, w = (hi - lo) / bins, hist = [], b;
  for (i = 0; i < bins; i++) hist.push(0);
  for (i = 0; i < rows.length; i++){
    tp = (rows[i].h + rows[i].l + rows[i].c) / 3;
    b = Math.min(bins - 1, Math.max(0, Math.floor((tp - lo) / w)));
    hist[b] += vols[i];
  }
  var pocI = 0;
  for (i = 1; i < bins; i++) if (hist[i] > hist[pocI]) pocI = i;
  var need = sumV * 0.7, got = hist[pocI], loI = pocI, hiI = pocI, left, right;
  while (got < need && (loI > 0 || hiI < bins - 1)){
    left = loI > 0 ? hist[loI - 1] : -1;
    right = hiI < bins - 1 ? hist[hiI + 1] : -1;
    if (right >= left){ hiI++; got += hist[hiI]; }
    else { loI--; got += hist[loI]; }
  }
  return { poc: lo + (pocI + 0.5) * w, val: lo + loI * w, vah: lo + (hiI + 1) * w };
}
function profileOf(rows){
  if (!rows || rows.length < 30) return null;
  var recentN = Math.min(80, rows.length);
  var cur = profileCore(rows.slice(rows.length - recentN));
  if (!cur) return null;
  var older = rows.slice(Math.max(0, rows.length - Math.min(160, rows.length)), rows.length - recentN);
  var naked = NaN;
  if (older.length >= 20){
    var prev = profileCore(older);
    if (prev){
      var touched = false, i, bar;
      var recent = rows.slice(rows.length - recentN);
      for (i = 0; i < recent.length; i++){
        bar = recent[i];
        if (bar.l <= prev.poc && bar.h >= prev.poc){ touched = true; break; }
      }
      if (!touched) naked = prev.poc;
    }
  }
  cur.naked = naked;
  return cur;
}
function renkoSide(rows, brick){
  if (!rows || rows.length < 5 || !(brick > 0)) return 'none';
  var lastPx = rows[0].c, bricks = [], i, c;
  for (i = 1; i < rows.length; i++){
    c = rows[i].c;
    while (c >= lastPx + brick && bricks.length < 400){ lastPx += brick; bricks.push(1); }
    while (c <= lastPx - brick && bricks.length < 400){ lastPx -= brick; bricks.push(-1); }
  }
  if (bricks.length < 2) return 'none';
  var a = bricks[bricks.length - 1], b = bricks[bricks.length - 2];
  if (a === 1 && b === 1) return 'long';
  if (a === -1 && b === -1) return 'short';
  return 'mixed';
}
function seasonNow(){
  var m = new Date().getUTCMonth();
  if (m === 0 || m === 1) return { mode: 'q1', why: 'Q1 physical bid — January and February favor gold longs' };
  if (m === 5 || m === 6) return { mode: 'summer', why: 'summer doldrums — June and July are range trades, not trends' };
  if (m === 8) return { mode: 'sept', why: 'September — the volatility window is open' };
  return { mode: 'none', why: 'outside Q1 and the summer doldrums' };
}

function tapeOf(rows){
  var ema = gfn('ema'), rsiFn = gfn('rsi'), atrFn = gfn('atr');
  rows = clean(rows);
  if (!ema || !rsiFn || !atrFn || rows.length < 60) return null;
  var c = [], i;
  for (i = 0; i < rows.length; i++) c.push(rows[i].c);
  var e20 = last(ema(c, 20)), e50 = last(ema(c, 50));
  var e200 = c.length >= 200 ? last(ema(c, 200)) : NaN;
  var price = c[c.length - 1];
  var rsiArr = rsiFn(c, 14);
  var rv = last(rsiArr);
  var av = last(atrFn(rows, 14));
  var bull = price > e20 && e20 > e50 && (!isFinite(e200) || e50 > e200);
  var bear = price < e20 && e20 < e50 && (!isFinite(e200) || e50 < e200);
  var regime = null, cu = null, hist = null, vz = NaN, ax = NaN;
  try{ if (gfn('detectRegime')) regime = W.detectRegime(rows); }catch(e1){ regime = null; }
  try{ if (gfn('cusumLast')) cu = W.cusumLast(c, 1); }catch(e2){ cu = null; }
  try{ if (gfn('macdHist')) hist = W.macdHist(c); }catch(e3){ hist = null; }
  try{ if (gfn('volZ')) vz = W.volZ(rows, 20); }catch(e4){ vz = NaN; }
  try{ if (gfn('adx')) ax = last(W.adx(rows, 14).adx); }catch(e5){ ax = NaN; }
  var h0 = hist ? last(hist) : NaN;
  var h1 = (hist && hist.length > 1) ? hist[hist.length - 2] : NaN;
  var vw = vwapLast(rows);
  return {
    rows: rows, px: price, rsi: rv, atr: av, adx: ax,
    side: bull ? 'long' : bear ? 'short' : 'mixed',
    regime: regime, cu: cu, macd: h0, macdPrev: h1, volZ: vz,
    sweep: sweepOf(rows), div: divOf(c, rsiArr),
    ha: haSide(rows), kama: kamaLast(c, 10, 2, 30), vwap: vw, profile: profileOf(rows)
  };
}

function sessionNow(){
  try{ if (gfn('goldKillzone')) return W.goldKillzone(Date.now()); }catch(e){}
  return null;
}

function mapOf(spec, stacks){
  var daily = stacks['1d'];
  if (spec.tf === '1d') return { tf: '1d', side: stacks['1d'] ? stacks['1d'].side : 'none' };
  if (daily && (daily.side === 'long' || daily.side === 'short' || daily.side === 'mixed')) return { tf: '1d', side: daily.side };
  return { tf: null, side: 'none' };
}

function macdWith(tape, side){
  if (!isFinite(tape.macd)) return true;
  if (side === 'long') return tape.macd > 0;
  if (side === 'short') return tape.macd < 0;
  return false;
}
function cusumAgainst(tape, side){
  return !!(tape.cu && tape.cu.barsAgo <= 8 && tape.cu.dir && tape.cu.dir !== side);
}
function divAgainst(tape, side){
  return !!(tape.div && tape.div.side && tape.div.side !== side);
}

function playOf(spec, stacks, season){
  var own = stacks[spec.tf];
  var map = mapOf(spec, stacks);
  var kz = sessionNow();
  var quiet = intraday(spec.tf) && (!kz || !(kz.weight > 0));
  if (!own) return { side: 'none', why: spec.tf + ' tape unread', kind: '' };
  var regime = (own.regime && own.regime.regime) || 'unknown';
  var label = (own.regime && own.regime.label) || 'REGIME UNREAD';
  var sess = kz && kz.label ? kz.label : 'session unread';
  var summer = season && season.mode === 'summer';
  var q1 = season && season.mode === 'q1';

  var sweepOk = null, sweepWhy = '';
  if (own.sweep){
    var ss = own.sweep.side;
    var fadeTrend = (map.side === 'long' || map.side === 'short') && map.side !== ss && (regime === 'trend' || regime === 'weak_trend');
    if (fadeTrend) sweepWhy = 'sweep is against the daily trend';
    else if (divAgainst(own, ss)) sweepWhy = own.div.why;
    else if (own.atr > 0 && Math.abs(own.px - own.sweep.wick) > own.atr * 4) sweepWhy = 'sweep wick is too far for an ATR stop';
    else {
      sweepOk = ss;
      sweepWhy = spec.tf + ' swept ' + px(own.sweep.level) + ' and closed back'
        + (map.side === ss ? ' · daily agrees' : (map.side === 'mixed' ? ' · daily is mixed' : ''))
        + ' · ' + label;
    }
  }

  var fade = null;
  var prof = own.profile;
  if (prof && own.atr > 0 && regime !== 'trend'){
    var above = own.px > prof.vah, below = own.px < prof.val;
    var accepted = isFinite(own.volZ) && own.volZ >= 1;
    var rangeOk = summer || regime === 'range' || regime === 'compression' || regime === 'weak_trend';
    if ((above || below) && !accepted && rangeOk){
      var fs = above ? 'short' : 'long';
      var against = (map.side === 'long' || map.side === 'short') && map.side !== fs && regime === 'weak_trend' && !summer;
      var risk = spec.atrMult * own.atr;
      var room = Math.abs(own.px - prof.poc);
      if (!against && !divAgainst(own, fs) && room >= spec.r1 * risk){
        fade = { side: fs, why: spec.tf + ' closed ' + (above ? 'above VAH ' + px(prof.vah) : 'below VAL ' + px(prof.val))
          + ' without volume acceptance · fade toward POC ' + px(prof.poc) + ' · ' + label };
      }
    }
  }

  var contOk = null, contWhy = '';
  var brick = (spec.tf === '15m' || spec.tf === '1h') ? 2 : Math.max(2, (own.atr || 2) * 0.5);
  var rk = renkoSide(own.rows, brick);
  if (own.side === 'long' || own.side === 'short'){
    if (summer) contWhy = 'summer doldrums — continuation stands aside';
    else if (q1 && own.side === 'short') contWhy = 'Q1 physical bid — no short continuation';
    else if (quiet) contWhy = sess + ' — no continuation, Asia and off-hours are range only';
    else if (regime === 'range' || regime === 'compression') contWhy = label + ' — no trend continuation';
    else if (regime === 'volatile') contWhy = 'volatile expansion — no continuation';
    else if (regime === 'unknown') contWhy = 'regime unread';
    else if (map.side === 'mixed') contWhy = 'daily structure is mixed';
    else if (map.side !== own.side) contWhy = 'daily is ' + word(map.side) + ', not with the ' + spec.tf;
    else if (divAgainst(own, own.side)) contWhy = own.div.why;
    else if (!macdWith(own, own.side)) contWhy = 'MACD histogram is not with the trend';
    else if (cusumAgainst(own, own.side)) contWhy = 'CUSUM flipped ' + own.cu.dir + ' ' + own.cu.barsAgo + ' bars ago';
    else if (isFinite(own.volZ) && own.volZ < -0.5) contWhy = 'volume is not behind the break (z ' + own.volZ.toFixed(1) + ')';
    else if (own.ha !== own.side) contWhy = 'Heikin Ashi is not with the trend';
    else if (rk !== 'none' && rk !== own.side) contWhy = 'Renko is not with the trend';
    else if (isFinite(own.kama) && ((own.side === 'long' && own.px < own.kama) || (own.side === 'short' && own.px > own.kama))) contWhy = 'price is on the wrong side of KAMA';
    else if (isFinite(own.vwap) && ((own.side === 'long' && own.px < own.vwap) || (own.side === 'short' && own.px > own.vwap))) contWhy = 'price is on the wrong side of VWAP';
    else {
      contOk = own.side;
      contWhy = spec.tf + ' continuation with the daily'
        + (isFinite(own.adx) ? ' · ADX ' + own.adx.toFixed(0) : '')
        + ' · ' + label
        + ' · Heikin and Renko agree'
        + (q1 ? ' · Q1 physical bid' : '')
        + (isFinite(own.rsi) ? ' · RSI ' + own.rsi.toFixed(0) + ' left on (not faded)' : '')
        + (isFinite(own.volZ) ? ' · volume z ' + own.volZ.toFixed(1) : ' · volume unread');
    }
  } else contWhy = spec.tf + ' EMA stack is mixed';

  if (sweepOk) return { side: sweepOk, why: sweepWhy, kind: 'liquidity sweep', regime: label, session: sess, tape: own };
  if (fade) return { side: fade.side, why: fade.why, kind: 'value-area fade', regime: label, session: sess, tape: own };
  if (contOk) return { side: contOk, why: contWhy, kind: 'HTF continuation', regime: label, session: sess, tape: own };
  var why = sweepWhy || (fade && fade.why) || contWhy;
  if (sweepWhy && contWhy) why = sweepWhy + ' · ' + contWhy;
  return { side: 'none', why: why, kind: '', regime: label, session: sess, tape: own };
}

function fundOf(reg){
  if (!reg || !reg.legs) return { points: 'none', why: 'fundamental stack has not run', cot: 'none', cotWhy: 'COT unread' };
  if (reg.blackout) return { points: 'none', why: 'NFP, CPI or FOMC window — stand aside', cot: 'none', cotWhy: 'event blackout', block: true };
  var cot = 'none', cotWhy = 'COT unread', i, leg;
  for (i = 0; i < reg.legs.length; i++){
    leg = reg.legs[i];
    if (!leg || !/COT/i.test(leg.label || '')) continue;
    if (leg.state !== 'checked' || leg.info){ cotWhy = leg.text || 'COT unread'; break; }
    cot = leg.vote === 'bull' ? 'long' : leg.vote === 'bear' ? 'short' : 'none';
    cotWhy = leg.text || (cot === 'none' ? 'COT neutral' : 'COT ' + word(cot));
    break;
  }
  if (!reg.checked) return { points: 'none', why: 'no checked fundamental vote', cot: cot, cotWhy: cotWhy };
  if (reg.bulls > reg.bears) return { points: 'long', why: reg.bulls + ' bull / ' + reg.bears + ' bear', cot: cot, cotWhy: cotWhy };
  if (reg.bears > reg.bulls) return { points: 'short', why: reg.bears + ' bear / ' + reg.bulls + ' bull', cot: cot, cotWhy: cotWhy };
  return { points: 'none', why: 'fundamental votes are tied', cot: cot, cotWhy: cotWhy };
}

function macroOf(m){
  if (!m) return { points: 'none', why: 'dollar and real yield unread', unread: true };
  var hint = m.realRateHint || 'NEUTRAL';
  var dxy = (m.dxy && m.dxy.trend20) || '';
  var bit = '';
  if (m.dxy && isFinite(fin(m.dxy.value))) bit += 'DXY ' + fin(m.dxy.value).toFixed(2) + ' ' + (dxy || '');
  if (isFinite(fin(m.tnx))) bit += (bit ? ' · ' : '') + 'US10Y ' + fin(m.tnx).toFixed(2) + '% ' + (m.tnxTrend || '');
  var measured = (m.dxy && isFinite(fin(m.dxy.value))) || isFinite(fin(m.tnx)) || hint === 'TAILWIND' || hint === 'HEADWIND';
  if (!measured) return { points: 'none', why: 'dollar and real yield unread', unread: true };
  if (hint === 'TAILWIND' && dxy !== 'RISING') return { points: 'long', why: 'real-rate tailwind, dollar not rising' + (bit ? ' · ' + bit : ''), hint: hint, dxy: dxy };
  if (hint === 'HEADWIND' && dxy !== 'FALLING') return { points: 'short', why: 'real-rate headwind, dollar not falling' + (bit ? ' · ' + bit : ''), hint: hint, dxy: dxy };
  if (hint === 'TAILWIND' && dxy === 'RISING') return { points: 'none', why: 'yields help gold but the dollar is rising' + (bit ? ' · ' + bit : ''), mixed: true, hint: hint, dxy: dxy };
  if (hint === 'HEADWIND' && dxy === 'FALLING') return { points: 'none', why: 'yields hurt gold but the dollar is falling' + (bit ? ' · ' + bit : ''), mixed: true, hint: hint, dxy: dxy };
  return { points: 'none', why: 'real rate ' + hint.toLowerCase() + (dxy ? ', dollar ' + dxy.toLowerCase() : '') + (bit ? ' · ' + bit : ''), hint: hint, dxy: dxy };
}

function macroBlocks(macro, side){
  if (!macro || macro.unread) return 'dollar and real yield unread';
  if (macro.mixed) return macro.why;
  if (side === 'long' && (macro.hint === 'HEADWIND' || macro.dxy === 'RISING' || macro.points === 'short')) return 'macro is against the long';
  if (side === 'short' && (macro.hint === 'TAILWIND' || macro.dxy === 'FALLING' || macro.points === 'long')) return 'macro is against the short';
  return '';
}

function microOf(spec, play){
  var tape = play.tape;
  if (!tape || !(tape.atr > 0)) return { points: 'none', why: spec.tf + ' ATR unread' };
  var why = play.regime + ' · ' + play.session + ' · ATR ' + tape.atr.toFixed(2) + ' · stop ' + spec.atrMult + '×ATR';
  if (play.kind === 'liquidity sweep') why += ' · stop sits past the sweep wick';
  if (play.side === 'long' || play.side === 'short') return { points: play.side, why: why };
  return { points: 'none', why: why };
}

function newsOf(news, risk){
  if (risk && risk.blackout) return { points: 'none', why: 'NFP, CPI or FOMC window — stand aside', block: true };
  var heads = (news && news.headlines) || [];
  var j, h, title, haven = null, hit = null;
  for (j = 0; j < heads.length; j++){
    h = heads[j];
    if (!h) continue;
    title = h.title || '';
    if (!haven && /war|invasion|missile|airstrike|sanction|banking crisis|bank run|default|safe[- ]haven|geopolit/i.test(title)) haven = h;
    if (!hit && /gold|xau|fed|fomc|cpi|nfp|yield|dollar|dxy|treasury|powell|inflation/i.test(title) && (h.sentiment === 'bullish' || h.sentiment === 'bearish')) hit = h;
  }
  if (haven){
    return { points: 'long', why: 'safe-haven — ' + (haven.source || 'wire') + ' — ' + haven.title, haven: true };
  }
  if (hit){
    return { points: hit.sentiment === 'bullish' ? 'long' : 'short', why: (hit.source || 'wire') + ' — ' + hit.title };
  }
  if (risk && risk.unchecked) return { points: 'none', why: 'calendar unread' };
  return { points: 'none', why: 'calendar is clear — news does not pick the side' };
}

function gate(spec, play, fund, sent, macro, news, inter, inst, term, mem){
  if (play.side !== 'long' && play.side !== 'short') return { side: 'none', why: play.why, kind: '' };
  if (mem && mem.paused) return { side: 'none', why: mem.pauseWhy, kind: '' };
  if (mem && mem.state === 'random') return { side: 'none', why: 'Hurst ' + mem.h.toFixed(2) + ' — random walk, no trade', kind: '' };
  if (mem && mem.state === 'trend' && (play.kind === 'value-area fade' || play.kind === 'liquidity sweep')) return { side: 'none', why: 'Hurst ' + mem.h.toFixed(2) + ' is trending — the fade is off', kind: '' };
  if (mem && mem.state === 'fade' && play.kind === 'HTF continuation') return { side: 'none', why: 'Hurst ' + mem.h.toFixed(2) + ' is mean-reverting — the continuation is off', kind: '' };
  if (fund.block || news.block) return { side: 'none', why: fund.block ? fund.why : news.why, kind: '' };
  if (news.haven && play.side === 'short') return { side: 'none', why: 'safe-haven flow blocks the short', kind: '' };
  var mb = macroBlocks(macro, play.side);
  if (mb) return { side: 'none', why: mb, kind: '' };
  if (inter && play.side === 'long' && inter.opposeLong) return { side: 'none', why: 'USDJPY is rising — the inverse filter blocks the long', kind: '' };
  if (inter && play.side === 'short' && inter.opposeShort) return { side: 'none', why: 'USDJPY is falling — the inverse filter blocks the short', kind: '' };
  if (inst && play.side === 'long' && inst.blockLong) return { side: 'none', why: inst.longWhy, kind: '' };
  if (inst && play.side === 'short' && inst.blockShort) return { side: 'none', why: inst.shortWhy, kind: '' };
  if (term && play.side === 'short' && term.blockShort) return { side: 'none', why: term.shortWhy, kind: '' };
  if ((fund.points === 'long' || fund.points === 'short') && fund.points !== play.side) return { side: 'none', why: 'fundamentals point ' + word(fund.points), kind: '' };
  if ((sent.points === 'long' || sent.points === 'short') && sent.points !== play.side) return { side: 'none', why: 'COT points ' + word(sent.points), kind: '' };
  if ((news.points === 'long' || news.points === 'short') && news.points !== play.side) return { side: 'none', why: 'news points ' + word(news.points), kind: '' };
  var extra = '';
  if (inter && play.side === 'long' && inter.ratio && inter.ratio.trend === 'FALLING') extra += ' · gold/silver falling, silver is leading';
  if (inter && play.side === 'long' && inter.curve && inter.curve.state === 'STEEPENING') extra += ' · 2s10s is steepening';
  if (inter && inter.usd && ((play.side === 'long' && inter.usd.trend === 'FALLING') || (play.side === 'short' && inter.usd.trend === 'RISING'))) extra += ' · USDJPY confirms';
  if (inst && inst.confirm && ((play.side === 'long' && inst.points !== 'short') || (play.side === 'short' && inst.points !== 'long'))) extra += ' · ' + inst.confirm;
  if (term && play.side === 'long' && term.confirm) extra += ' · ' + term.confirm;
  if (mem && mem.floor && play.side === 'long') extra += ' · spot is on the miner cost floor';
  return { side: play.side, why: play.why + extra, kind: play.kind };
}

function levels(spec, play, gpr, volRatio){
  var tape = play.tape;
  if (!tape || !(tape.px > 0) || !(tape.atr > 0)) return null;
  if (play.side !== 'long' && play.side !== 'short') return null;
  var mult = spec.atrMult * ((tape.regime && tape.regime.regime === 'volatile') ? 1.25 : 1);
  var risk = mult * tape.atr;
  if (play.kind === 'liquidity sweep' && tape.sweep){
    var past = Math.abs(tape.px - tape.sweep.wick) + 0.25 * tape.atr;
    if (past > risk) risk = past;
  }
  var entry = tape.px;
  var stop = play.side === 'long' ? entry - risk : entry + risk;
  var r2 = spec.r2 + ((gpr && play.side === 'long') ? 0.5 : 0);
  var volNote = '';
  if (volRatio >= 1.25){
    r2 = Math.round(r2 * 1.15 * 100) / 100;
    volNote = 'T2 widened — GARCH vol is clustered';
  } else if (volRatio > 0 && volRatio <= 0.8){
    var shrunk = Math.round(r2 * 0.9 * 100) / 100;
    if (shrunk >= spec.r1 + 0.3){
      r2 = shrunk;
      volNote = 'T2 tightened — GARCH vol is quiet';
    }
  }
  var t1 = play.side === 'long' ? entry + spec.r1 * risk : entry - spec.r1 * risk;
  var t2 = play.side === 'long' ? entry + r2 * risk : entry - r2 * risk;
  return { entry: entry, stop: stop, t1: t1, t2: t2, r2: r2, widened: !!(gpr && play.side === 'long'), volNote: volNote };
}

function card(spec, call, lv){
  if (call.side !== 'long' && call.side !== 'short'){
    return '<div class="note warn"><b>' + esc(spec.name) + ' · NO SETUP</b> · ' + esc(call.why || 'nothing lines up') + '</div>';
  }
  if (!lv){
    return '<div class="note warn"><b>' + esc(spec.name) + ' · NO SETUP</b> · ATR unread, so there is no price</div>';
  }
  return '<div class="note"><b>' + esc(spec.name) + ' SETUP · ' + word(call.side) + '</b> · ' + esc(call.kind)
    + '<br>' + esc(call.why)
    + '<br>Entry ' + px(lv.entry) + ' · Stop ' + px(lv.stop)
    + ' · T1 ' + px(lv.t1) + ' (' + spec.r1 + 'R) · T2 ' + px(lv.t2) + ' (' + lv.r2 + 'R)' + (lv.widened ? ' · T2 widened — geopolitical headlines' : '') + (lv.volNote ? ' · ' + lv.volNote : '')
    + '<br><span class="dim">IUX spot, ' + esc(spec.tf) + ' close. ATR stop. Not a fill on your bid.</span></div>';
}

function profileLine(play){
  var p = play.tape && play.tape.profile;
  if (!p) return { points: 'none', why: 'volume profile unread — candle volume is missing' };
  var why = 'POC ' + px(p.poc) + ' · VAL ' + px(p.val) + ' · VAH ' + px(p.vah);
  if (isFinite(p.naked)) why += ' · naked POC ' + px(p.naked);
  if (play.tape.px > p.vah) why += ' · price is above value';
  else if (play.tape.px < p.val) why += ' · price is below value';
  else why += ' · price is inside value';
  if (play.kind === 'value-area fade') return { points: play.side, why: why + ' · fade back toward the POC' };
  return { points: 'none', why: why };
}
function noiseLine(spec, play){
  var tape = play.tape;
  if (!tape) return { points: 'none', why: 'tape unread' };
  var brick = (spec.tf === '15m' || spec.tf === '1h') ? 2 : Math.max(2, (tape.atr || 2) * 0.5);
  var rk = renkoSide(tape.rows, brick);
  var why = 'Heikin ' + (tape.ha || 'unread') + ' · Renko ' + rk + ' · KAMA ' + px(tape.kama) + ' · VWAP ' + px(tape.vwap);
  var side = 'none';
  if ((tape.ha === 'long' || tape.ha === 'short') && (rk === tape.ha || rk === 'none')) side = tape.ha;
  return { points: side, why: why };
}
function htmlFor(spec, stacks, shared){
  var play = playOf(spec, stacks, shared.season);
  var micro = microOf(spec, play);
  var call = gate(spec, play, shared.fund, shared.sent, shared.macro, shared.news, shared.inter, shared.inst, shared.term, shared.mem);
  var lv = levels(spec, call.side === play.side ? play : { side: 'none' }, !!(shared.news && shared.news.haven), shared.mem ? shared.mem.volRatio : 0);
  var prof = profileLine(play);
  var noise = noiseLine(spec, play);
  var seasonSide = shared.season && shared.season.mode === 'q1' ? 'long' : 'none';
  var h = '<div class="note"><b>GOLD PLAYBOOK</b> · ' + esc(spec.name)
    + '<br><span class="dim">Daily structure, sweep or value-area fade or HTF continuation, Heikin Ashi, Renko, KAMA, USDJPY, gold/silver, 2s10s, futures basis, GLD/GDX, the gold curve, gold/oil, daily Hurst and GARCH. The London fix pauses new trades. The order book is unread. A split is no setup.</span></div>';
  h += card(spec, call, lv);
  h += '<div class="cr-ind-wrap">';
  h += '<div class="kv"><span class="k">Technical</span><span class="v">' + arrow(play.side, play.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Profile</span><span class="v">' + arrow(prof.points, prof.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Noise</span><span class="v">' + arrow(noise.points, noise.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Intermarket</span><span class="v">' + arrow(shared.inter.points, shared.inter.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Institutional</span><span class="v">' + arrow(shared.inst.points, shared.inst.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Curve</span><span class="v">' + arrow(shared.term.points, shared.term.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Memory</span><span class="v">' + arrow(shared.mem.points, shared.mem.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Fundamental</span><span class="v">' + arrow(shared.fund.points, shared.fund.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Sentiment</span><span class="v">' + arrow(shared.sent.points, shared.sent.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Macro</span><span class="v">' + arrow(shared.macro.points, shared.macro.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Micro</span><span class="v">' + arrow(micro.points, micro.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Season</span><span class="v">' + arrow(seasonSide, shared.season.why) + '</span></div>';
  h += '<div class="kv"><span class="k">News</span><span class="v">' + arrow(shared.news.points, shared.news.why) + '</span></div>';
  return h + '</div>';
}

function paint(){
  if (painting || !bag) return;
  painting = true;
  try{
    var id, pane, slot, spec, html;
    for (id in TABS){
      if (!Object.prototype.hasOwnProperty.call(TABS, id)) continue;
      pane = document.getElementById('tab_' + id);
      if (!pane) continue;
      spec = TABS[id];
      html = htmlFor(spec, bag.stacks, bag.shared);
      slot = pane.querySelector('[data-hg-gold-combined]');
      if (!slot){
        slot = document.createElement('div');
        slot.setAttribute('data-hg-gold-combined', '1');
        slot.className = 'panel';
        pane.insertBefore(slot, pane.firstChild);
      } else if (pane.firstChild !== slot){
        pane.insertBefore(slot, pane.firstChild);
      }
      if (slot.getAttribute('data-sig') !== bag.sig + '|' + id){
        slot.innerHTML = html;
        slot.setAttribute('data-sig', bag.sig + '|' + id);
      }
    }
  }catch(e){}
  painting = false;
}


function isoDay(d){ return d.toISOString().slice(0, 10); }
async function loadUsdJpy(){
  var end = new Date();
  var start = new Date(end.getTime() - 80 * 86400000);
  var span = isoDay(start) + '..' + isoDay(end);
  var urls = [
    'https://api.frankfurter.app/' + span + '?from=USD&to=JPY',
    'https://api.frankfurter.dev/v1/' + span + '?base=USD&symbols=JPY'
  ];
  var i, r, j, dates, a, b, chg;
  for (i = 0; i < urls.length; i++){
    try{
      r = await fetch(urls[i]);
      if (!r.ok) continue;
      j = await r.json();
      dates = Object.keys(j.rates || {}).sort();
      if (dates.length < 8) continue;
      a = +j.rates[dates[0]].JPY; b = +j.rates[dates[dates.length - 1]].JPY;
      if (!(a > 0) || !(b > 0)) continue;
      chg = (b / a - 1) * 100;
      return { last: b, chg: chg, trend: chg > 0.4 ? 'RISING' : (chg < -0.4 ? 'FALLING' : 'FLAT') };
    }catch(e){}
  }
  return null;
}
function csvCells(line){
  var out = [], cur = '', q = false, i, ch;
  for (i = 0; i < line.length; i++){
    ch = line.charAt(i);
    if (q){
      if (ch === '"'){ if (line.charAt(i + 1) === '"'){ cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ','){ out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
async function loadCurve(){
  var year = new Date().getUTCFullYear();
  var url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/'
    + year + '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + year + '&page&_format=csv';
  var r = await fetch(url);
  if (!r.ok) return null;
  var text = await r.text();
  var lines = text.split(/\r?\n/);
  if (lines.length < 5) return null;
  var header = csvCells(lines[0]);
  var i2 = -1, i10 = -1, i;
  for (i = 0; i < header.length; i++){
    var h = header[i].trim().toLowerCase();
    if (h === '2 yr') i2 = i;
    if (h === '10 yr') i10 = i;
  }
  if (i2 < 0 || i10 < 0) return null;
  var rows = [];
  for (i = 1; i < lines.length; i++){
    if (!lines[i] || !lines[i].trim()) continue;
    var cells = csvCells(lines[i]);
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(cells[0] || '').trim());
    var y2 = parseFloat(cells[i2]), y10 = parseFloat(cells[i10]);
    if (!m || !isFinite(y2) || !isFinite(y10)) continue;
    rows.push({ t: Date.UTC(+m[3], (+m[1]) - 1, +m[2]), spread: y10 - y2 });
  }
  rows.sort(function(a, b){ return a.t - b.t; });
  if (rows.length < 8) return null;
  var last = rows[rows.length - 1].spread;
  var prev = rows[Math.max(0, rows.length - 21)].spread;
  var chg = last - prev;
  var state = chg >= 0.08 ? 'STEEPENING' : (chg <= -0.08 ? 'INVERTING' : 'FLAT');
  return { spread: last, chg: chg, state: state, inverted: last < 0 };
}
function ratioFrom(goldTape, silverGot, macro){
  var series = [], sm = {}, i, r, sc, day;
  var srows = silverGot && silverGot.rows;
  if (goldTape && goldTape.rows && srows && srows.length){
    for (i = 0; i < srows.length; i++){
      r = srows[i];
      if (r && r.c > 0 && isFinite(+r.t)) sm[Math.floor(+r.t / 86400)] = +r.c;
    }
    for (i = 0; i < goldTape.rows.length; i++){
      r = goldTape.rows[i];
      day = Math.floor(+r.t / 86400);
      sc = sm[day];
      if (sc > 0 && r.c > 0) series.push(r.c / sc);
    }
  }
  if (series.length >= 8){
    var lastR = series[series.length - 1];
    var prevR = series[Math.max(0, series.length - 21)];
    var chgR = (lastR / prevR - 1) * 100;
    return { last: lastR, chg: chgR, trend: chgR <= -2 ? 'FALLING' : (chgR >= 2 ? 'RISING' : 'FLAT') };
  }
  if (macro && isFinite(+macro.goldSilverRatio) && +macro.goldSilverRatio > 0){
    return { last: +macro.goldSilverRatio, trend: '' };
  }
  return null;
}
function intermarket(usd, ratio, curve){
  var bits = [], opposeLong = false, opposeShort = false;
  if (!usd) bits.push('USDJPY unread');
  else {
    bits.push('USDJPY ' + usd.last.toFixed(2) + ' ' + usd.trend.toLowerCase() + ' ' + (usd.chg >= 0 ? '+' : '') + usd.chg.toFixed(2) + '%');
    if (usd.trend === 'RISING') opposeLong = true;
    if (usd.trend === 'FALLING') opposeShort = true;
  }
  if (!ratio) bits.push('gold/silver unread');
  else if (!ratio.trend) bits.push('gold/silver ' + ratio.last.toFixed(1) + ' — trend unread');
  else bits.push('gold/silver ' + ratio.last.toFixed(1) + ' ' + ratio.trend.toLowerCase() + (ratio.trend === 'FALLING' ? ' — silver leading' : ''));
  if (!curve) bits.push('2s10s unread');
  else bits.push('2s10s ' + curve.spread.toFixed(2) + (curve.inverted ? ' inverted' : '') + ' ' + curve.state.toLowerCase());
  bits.push('GLD tonnage unread');
  var points = 'none';
  if (opposeLong && !opposeShort) points = 'short';
  else if (opposeShort && !opposeLong) points = 'long';
  return { points: points, why: bits.join(' · '), opposeLong: opposeLong, opposeShort: opposeShort, usd: usd, ratio: ratio, curve: curve };
}


async function yahooCloses(sym){
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=6mo';
  var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
  if (!r.ok) return null;
  var j = await r.json();
  var q = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].indicators && j.chart.result[0].indicators.quote && j.chart.result[0].indicators.quote[0];
  if (!q || !q.close) return null;
  return q.close.length ? q.close : null;
}
function lastFinite(arr){
  var i, c;
  if (!arr) return null;
  for (i = arr.length - 1; i >= 0; i--){
    c = +arr[i];
    if (c > 0) return c;
  }
  return null;
}
function ols(y, x){
  var n = y.length, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
  for (i = 0; i < n; i++){ sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  var den = n * sxx - sx * sx;
  if (!den) return null;
  var b = (n * sxy - sx * sy) / den;
  var a = (sy - b * sx) / n;
  return { a: a, b: b };
}
function adfT(resid){
  var n = resid.length - 1;
  if (n < 40) return null;
  var y = [], x = [], i;
  for (i = 1; i < resid.length; i++){ y.push(resid[i] - resid[i - 1]); x.push(resid[i - 1]); }
  var fit = ols(y, x);
  if (!fit) return null;
  var ss = 0, e;
  for (i = 0; i < n; i++){ e = y[i] - (fit.a + fit.b * x[i]); ss += e * e; }
  var s2 = ss / (n - 2);
  var mean = 0;
  for (i = 0; i < n; i++) mean += x[i];
  mean /= n;
  var sxx = 0;
  for (i = 0; i < n; i++) sxx += (x[i] - mean) * (x[i] - mean);
  if (!(sxx > 0) || !(s2 > 0)) return null;
  return fit.b / Math.sqrt(s2 / sxx);
}
function pairRead(gld, gdx){
  if (!gld || !gdx) return null;
  var n = Math.min(gld.length, gdx.length);
  var y = [], x = [], i, a, b;
  for (i = 0; i < n; i++){
    a = +gld[gld.length - n + i];
    b = +gdx[gdx.length - n + i];
    if (a > 0 && b > 0){ y.push(Math.log(a)); x.push(Math.log(b)); }
  }
  n = y.length;
  if (n < 60) return null;
  var fit = ols(y, x);
  if (!fit) return null;
  var e = [], mean = 0;
  for (i = 0; i < n; i++){ e.push(y[i] - (fit.a + fit.b * x[i])); mean += e[i]; }
  mean /= n;
  var sd = 0;
  for (i = 0; i < n; i++) sd += (e[i] - mean) * (e[i] - mean);
  sd = Math.sqrt(sd / (n - 1));
  if (!(sd > 0)) return null;
  var tstat = adfT(e);
  return { z: (e[n - 1] - mean) / sd, t: tstat, cointegrated: tstat !== null && tstat < -2.89, n: n };
}
async function loadInstitutional(spot, usd){
  var fut = null, gld = null, gdx = null, eur = null;
  try{ fut = lastFinite(await yahooCloses('GC=F')); }catch(e1){ fut = null; }
  try{ gld = await yahooCloses('GLD'); }catch(e2){ gld = null; }
  try{ gdx = await yahooCloses('GDX'); }catch(e3){ gdx = null; }
  try{
    var r = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (r.ok){ var j = await r.json(); eur = j && j.rates ? +j.rates.EUR : null; }
  }catch(e4){ eur = null; }
  var basis = (fut > 0 && spot > 0) ? { fut: fut, spot: spot, basis: fut - spot } : null;
  var pair = pairRead(gld, gdx);
  var cross = null;
  if (spot > 0 && ((eur > 0) || (usd && usd.last > 0))){
    cross = {
      eur: eur > 0 ? spot * eur : NaN,
      jpy: (usd && usd.last > 0) ? spot * usd.last : NaN
    };
  }
  return institutional(basis, pair, cross);
}
function institutional(basis, pair, cross){
  var bits = ['25-delta skew unread — no keyless COMEX options feed', 'lease rate and GOFO unread — LBMA no longer publishes them'];
  var blockLong = false, blockShort = false, longWhy = '', shortWhy = '', confirm = '';
  if (!basis) bits.push('EFP basis unread');
  else {
    var b = basis.basis;
    var txt = 'EFP futures−spot ' + (b >= 0 ? '+' : '') + b.toFixed(1);
    if (b < -1){
      blockShort = true;
      shortWhy = 'EFP is backwardated — physical bid blocks the short';
      confirm = 'EFP backwardation';
      txt += ' backwardation';
    } else txt += ' contango — not physical scarcity';
    bits.push(txt);
  }
  if (!pair || pair.t === null) bits.push('GLD/GDX unread');
  else if (!pair.cointegrated) bits.push('GLD/GDX ADF t ' + pair.t.toFixed(2) + ' — not cointegrated, spread z ' + pair.z.toFixed(2) + ' is not a signal');
  else {
    var pz = 'GLD/GDX z ' + pair.z.toFixed(2) + ' · ADF t ' + pair.t.toFixed(2);
    if (pair.z >= 2){
      blockLong = true;
      longWhy = 'GLD is rich versus GDX (z ' + pair.z.toFixed(2) + ') — the pair blocks a fresh gold long';
      pz += ' — gold rich versus miners';
    } else if (pair.z <= -2){
      blockShort = true;
      shortWhy = shortWhy || ('gold is cheap versus miners (z ' + pair.z.toFixed(2) + ') — the pair blocks the short');
      if (!confirm) confirm = 'gold cheap versus miners';
      pz += ' — gold cheap versus miners';
    } else pz += ' — inside the band';
    bits.push(pz);
  }
  if (cross && isFinite(cross.eur)) bits.push('XAU/EUR ' + cross.eur.toFixed(1) + ' implied — not a separate quote');
  else bits.push('XAU/EUR unread');
  if (cross && isFinite(cross.jpy)) bits.push('XAU/JPY ' + Math.round(cross.jpy) + ' implied — not a separate quote');
  else bits.push('XAU/JPY unread');
  bits.push('Swiss customs unread');
  bits.push('Shanghai premium unread');
  var points = 'none';
  if (blockShort && !blockLong) points = 'long';
  else if (blockLong && !blockShort) points = 'short';
  return { points: points, why: bits.join(' · '), blockLong: blockLong, blockShort: blockShort, longWhy: longWhy, shortWhy: shortWhy, confirm: confirm };
}


function goldCurveSymbols(date){
  var months = [2, 4, 6, 8, 10, 12];
  var letters = { 2: 'G', 4: 'J', 6: 'M', 8: 'Q', 10: 'V', 12: 'Z' };
  var y = date.getUTCFullYear();
  var m = date.getUTCMonth() + 1;
  var list = [], yy, i, mon;
  for (yy = y; yy <= y + 2 && list.length < 6; yy++){
    for (i = 0; i < months.length && list.length < 6; i++){
      mon = months[i];
      if (yy === y && mon <= m) continue;
      list.push('GC' + letters[mon] + String(yy).slice(2) + '.CMX');
    }
  }
  return { front: list[0] || null, deferred: list[3] || null };
}
function alignedDiff(a, b){
  if (!a || !b) return [];
  var n = Math.min(a.length, b.length), s = [], i, x, y;
  for (i = 0; i < n; i++){
    x = +a[a.length - n + i];
    y = +b[b.length - n + i];
    if (x > 0 && y > 0) s.push(x - y);
  }
  return s;
}
function zLast(vals){
  if (!vals || vals.length < 40) return null;
  var i, mean = 0;
  for (i = 0; i < vals.length; i++) mean += vals[i];
  mean /= vals.length;
  var sd = 0;
  for (i = 0; i < vals.length; i++) sd += (vals[i] - mean) * (vals[i] - mean);
  sd = Math.sqrt(sd / (vals.length - 1));
  if (!(sd > 0)) return null;
  return { z: (vals[vals.length - 1] - mean) / sd, last: vals[vals.length - 1] };
}
function termRead(cal, oil){
  var bits = [
    'dealer gamma unread — the GLD options chain is blocked',
    'COMEX registered stock unread',
    'SOFR versus the gold calendar unread',
    'BRICS settlement unread'
  ];
  var blockShort = false, shortWhy = '', confirm = [];
  if (!cal) bits.push('gold calendar unread');
  else {
    var txt = cal.front.replace('.CMX', '') + ' minus ' + cal.deferred.replace('.CMX', '') + ' ' + (cal.spread >= 0 ? '+' : '') + cal.spread.toFixed(1);
    if (cal.spread > 0){
      blockShort = true;
      shortWhy = 'the gold curve is backwardated — that blocks the short';
      confirm.push('curve backwardation');
      txt += ' backwardation';
    } else {
      txt += ' contango';
      if (cal.chg >= 8){
        confirm.push('front month tightening');
        txt += ', tightened ' + cal.chg.toFixed(1) + ' over 20 sessions';
      } else txt += ', 20-session change ' + (cal.chg >= 0 ? '+' : '') + cal.chg.toFixed(1);
    }
    bits.push(txt);
  }
  if (!oil) bits.push('gold/oil unread');
  else {
    var ot = 'gold/oil ' + oil.last.toFixed(1) + ' · z ' + oil.z.toFixed(2);
    if (oil.z >= 2){ confirm.push('gold/oil breakout'); ot += ' — above its 6-month band'; }
    else ot += ' — inside its 6-month band';
    bits.push(ot);
  }
  return {
    points: blockShort ? 'long' : 'none',
    why: bits.join(' · '),
    blockShort: blockShort,
    shortWhy: shortWhy,
    confirm: confirm.join(', '),
    spread: cal ? cal.spread : 0
  };
}
async function loadTerm(){
  var sym = goldCurveSymbols(new Date());
  if (!sym.front || !sym.deferred) return termRead(null, null);
  var front = null, back = null, gold = null, oil = null;
  try{ front = await yahooCloses(sym.front); }catch(e1){ front = null; }
  try{ back = await yahooCloses(sym.deferred); }catch(e2){ back = null; }
  try{ gold = await yahooCloses('GC=F'); }catch(e3){ gold = null; }
  try{ oil = await yahooCloses('CL=F'); }catch(e4){ oil = null; }
  var series = alignedDiff(front, back);
  var cal = null;
  if (series.length >= 25){
    var last = series[series.length - 1];
    var prev = series[Math.max(0, series.length - 21)];
    cal = { front: sym.front, deferred: sym.deferred, spread: last, chg: last - prev };
  }
  var ratios = [];
  if (gold && oil){
    var n = Math.min(gold.length, oil.length), i, g, o;
    for (i = 0; i < n; i++){
      g = +gold[gold.length - n + i];
      o = +oil[oil.length - n + i];
      if (g > 0 && o > 0) ratios.push(g / o);
    }
  }
  return termRead(cal, ratios.length ? zLast(ratios) : null);
}


function expectedRS(n){
  var sum = 0, i;
  for (i = 1; i < n; i++) sum += Math.sqrt((n - i) / i);
  return ((n - 0.5) / n) * Math.pow(n * Math.PI / 2, -0.5) * sum;
}
function hurstOf(closes){
  var r = [], i;
  for (i = 1; i < closes.length; i++){
    if (closes[i] > 0 && closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (r.length < 80) return null;
  var lags = [8, 16, 32, 64];
  var xs = [], ys = [], k, n, chunks, c, mean, cum, mx, mn, v, sd, rs, avg, ers;
  for (k = 0; k < lags.length; k++){
    n = lags[k];
    chunks = Math.floor(r.length / n);
    if (chunks < 2) continue;
    rs = 0;
    for (c = 0; c < chunks; c++){
      mean = 0;
      for (i = 0; i < n; i++) mean += r[c * n + i];
      mean /= n;
      cum = 0; mx = -Infinity; mn = Infinity; sd = 0;
      for (i = 0; i < n; i++){
        v = r[c * n + i];
        cum += v - mean;
        if (cum > mx) mx = cum;
        if (cum < mn) mn = cum;
        sd += (v - mean) * (v - mean);
      }
      sd = Math.sqrt(sd / n);
      if (sd > 0) rs += (mx - mn) / sd;
    }
    avg = rs / chunks;
    ers = expectedRS(n);
    if (avg > 0 && ers > 0){ xs.push(Math.log(n)); ys.push(Math.log(avg / ers)); }
  }
  if (xs.length < 3) return null;
  var fit = ols(ys, xs);
  if (!fit || !isFinite(fit.b)) return null;
  return 0.5 + fit.b;
}
function garchOf(closes){
  var r = [], i;
  for (i = 1; i < closes.length; i++){
    if (closes[i] > 0 && closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (r.length < 80) return null;
  var u = 0;
  for (i = 0; i < r.length; i++) u += r[i] * r[i];
  u /= r.length;
  if (!(u > 0)) return null;
  var alphas = [0.02, 0.05, 0.08, 0.12, 0.18];
  var betas = [0.75, 0.82, 0.88, 0.94];
  var best = null, bestNll = Infinity, ai, bi, alpha, beta, omega, sig, nll, t;
  for (ai = 0; ai < alphas.length; ai++){
    for (bi = 0; bi < betas.length; bi++){
      alpha = alphas[ai];
      beta = betas[bi];
      if (alpha + beta >= 0.995) continue;
      omega = (1 - alpha - beta) * u;
      sig = u;
      nll = 0;
      for (t = 0; t < r.length; t++){
        if (!(sig > 1e-12)){ nll = Infinity; break; }
        nll += Math.log(sig) + (r[t] * r[t]) / sig;
        sig = omega + alpha * r[t] * r[t] + beta * sig;
      }
      if (nll < bestNll) bestNll = nll, best = { alpha: alpha, beta: beta, next: sig };
    }
  }
  if (!best || !(best.next > 0)) return null;
  var tail = 20, rr = 0, from = r.length - tail;
  for (i = from; i < r.length; i++) rr += r[i] * r[i];
  var realized = Math.sqrt(rr / tail);
  if (!(realized > 0)) return null;
  return { ratio: Math.sqrt(best.next) / realized, alpha: best.alpha, beta: best.beta };
}
function fixWindow(date){
  var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  var hh = 0, mm = 0, i;
  for (i = 0; i < parts.length; i++){
    if (parts[i].type === 'hour') hh = +parts[i].value;
    if (parts[i].type === 'minute') mm = +parts[i].value;
  }
  var mins = hh * 60 + mm;
  var paused = (mins >= 625 && mins <= 640) || (mins >= 895 && mins <= 915);
  var label = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ' London';
  return { paused: paused, label: label };
}
function memoryOf(closes, spot, date){
  var h = hurstOf(closes);
  var g = garchOf(closes);
  var fix = fixWindow(date || new Date());
  var state = 'unread';
  if (h !== null){
    if (h >= 0.60) state = 'trend';
    else if (h <= 0.35) state = 'fade';
    else state = 'random';
  }
  var bits = [];
  if (h === null) bits.push('Hurst unread');
  else bits.push('Hurst ' + h.toFixed(2) + ' corrected R/S' + (state === 'trend' ? ' persistent' : state === 'fade' ? ' anti-persistent' : ' random walk'));
  if (!g) bits.push('GARCH unread');
  else bits.push('GARCH next-day vol ' + g.ratio.toFixed(2) + 'x the last 20 sessions');
  bits.push(fix.paused ? ('LBMA fix ' + fix.label + ' — new trades paused') : ('outside the LBMA fix (' + fix.label + ')'));
  var floor = false;
  if (!(spot > 0)) bits.push('AISC distance unread');
  else {
    var gap = spot - 1539;
    var txt = '2026 average AISC estimate 1539, spot is ' + gap.toFixed(0) + ' above it';
    if (spot <= 1539 * 1.15){ floor = true; txt += ' — on the cost floor'; }
    else txt += ' — not a supply squeeze';
    bits.push(txt);
  }
  bits.push('90th percentile cost curve unread');
  bits.push('order book and icebergs unread — no Level 3 feed');
  bits.push('LBMA auction imbalance unread');
  return {
    h: h,
    state: state,
    paused: fix.paused,
    pauseWhy: 'LBMA fix window (' + fix.label + ') — new execution is paused',
    floor: floor,
    volRatio: g ? g.ratio : 0,
    points: floor ? 'long' : 'none',
    why: bits.join(' · ')
  };
}

async function refresh(){
  if (busy) return;
  busy = true;
  try{
    var candles = gfn('getGoldCandles');
    var stacks = {};
    if (candles){
      var tfs = ['15m', '1h', '4h', '1d'], i, got;
      for (i = 0; i < tfs.length; i++){
        try{
          got = await candles(tfs[i], 260);
          stacks[tfs[i]] = tapeOf(got && got.rows);
        }catch(e1){ stacks[tfs[i]] = null; }
      }
    }
    var macro = null;
    try{
      if (gfn('getGoldMacro')) macro = await W.getGoldMacro();
      else if (gfn('getGoldMacroCached')) macro = W.getGoldMacroCached();
    }catch(e2){ macro = gfn('getGoldMacroCached') ? W.getGoldMacroCached() : null; }
    var news = null;
    try{
      if (gfn('hgNewsRefresh')) news = await W.hgNewsRefresh(false);
      else if (gfn('hgNewsState')) news = W.hgNewsState();
    }catch(e3){ news = gfn('hgNewsState') ? W.hgNewsState() : null; }
    var risk = null;
    try{ if (gfn('hgNewsRisk')) risk = W.hgNewsRisk('XAUUSD'); }catch(e4){ risk = null; }
    var reg = null;
    try{ if (gfn('hgFundamentalRegime')) reg = W.hgFundamentalRegime('gold'); }catch(e5){ reg = null; }
    var fund = fundOf(reg);
    var usd = null, curve = null, silver = null;
    try{ usd = await loadUsdJpy(); }catch(eU){ usd = null; }
    try{ curve = await loadCurve(); }catch(eC){ curve = null; }
    try{ if (gfn('getSilverCandles')) silver = await W.getSilverCandles('1d', 40); }catch(eS){ silver = null; }
    var ratio = ratioFrom(stacks['1d'], silver, macro);
    var inter = intermarket(usd, ratio, curve);
    var season = seasonNow();
    var spot = (stacks['1d'] && stacks['1d'].px) || (macro && +macro.goldPx) || NaN;
    var inst = null;
    try{ inst = await loadInstitutional(spot, usd); }catch(eI){ inst = null; }
    if (!inst) inst = institutional(null, null, null);
    var term = null;
    try{ term = await loadTerm(); }catch(eT){ term = null; }
    if (!term) term = termRead(null, null);
    var daily = stacks['1d'] && stacks['1d'].rows;
    var closes = [], ci;
    if (daily){ for (ci = 0; ci < daily.length; ci++) if (daily[ci].c > 0) closes.push(daily[ci].c); }
    var mem = memoryOf(closes, spot, new Date());
    var shared = {
      fund: fund,
      sent: { points: fund.cot, why: fund.cotWhy },
      macro: macroOf(macro),
      news: newsOf(news, risk),
      inter: inter,
      season: season,
      inst: inst,
      term: term,
      mem: mem
    };
    var sig = [shared.fund.points, shared.sent.points, shared.macro.points, shared.news.points, inter.points, season.mode, inst.points, inst.why, term.points, String(Math.round((term.spread || 0) * 10)), mem.state, mem.h === null ? "na" : mem.h.toFixed(2), mem.paused ? "fix" : "open"];
    var tf;
    for (tf in stacks){
      if (!stacks[tf]) continue;
      sig.push(tf + stacks[tf].side + (stacks[tf].sweep ? stacks[tf].sweep.side : '') + String(Math.round(stacks[tf].px * 10)));
    }
    bag = { stacks: stacks, shared: shared, sig: sig.join('|') };
    paint();
  }catch(e){}
  busy = false;
}

function boot(){
  var main = document.querySelector('main');
  if (main && typeof MutationObserver === 'function'){
    var obs = new MutationObserver(function(){ if (!painting) paint(); });
    obs.observe(main, { childList: true, subtree: true });
  }
  refresh();
  setInterval(refresh, 120000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
