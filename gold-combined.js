/* HARDGATE — gold-combined.js (hg-v1105)
   One setup per gold tab, formed the way gold actually trades.
   Daily structure first. CUSUM says trend or range. A liquidity sweep
   or a higher-timeframe continuation. RSI divergence, not an RSI fade.
   MACD only with the trend. ATR stop. Asia does not get a scalp continuation.
   Dollar and real yield must not oppose. A red-folder window is no setup. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
if (W.__hgGoldCombinedBoot === 1105) return;
W.__hgGoldCombinedBoot = 1105;

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
  return {
    rows: rows, px: price, rsi: rv, atr: av, adx: ax,
    side: bull ? 'long' : bear ? 'short' : 'mixed',
    regime: regime, cu: cu, macd: h0, macdPrev: h1, volZ: vz,
    sweep: sweepOf(rows), div: divOf(c, rsiArr)
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

function playOf(spec, stacks){
  var own = stacks[spec.tf];
  var map = mapOf(spec, stacks);
  var kz = sessionNow();
  var quiet = intraday(spec.tf) && (!kz || !(kz.weight > 0));
  if (!own) return { side: 'none', why: spec.tf + ' tape unread', kind: '' };
  var regime = (own.regime && own.regime.regime) || 'unknown';
  var label = (own.regime && own.regime.label) || 'REGIME UNREAD';
  var sess = kz && kz.label ? kz.label : 'session unread';

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

  var contOk = null, contWhy = '';
  if (own.side === 'long' || own.side === 'short'){
    if (quiet) contWhy = sess + ' — no continuation, Asia and off-hours are range only';
    else if (regime === 'range' || regime === 'compression') contWhy = label + ' — no trend continuation';
    else if (regime === 'volatile') contWhy = 'volatile expansion — no continuation';
    else if (regime === 'unknown') contWhy = 'regime unread';
    else if (map.side === 'mixed') contWhy = 'daily structure is mixed';
    else if (map.side !== own.side) contWhy = 'daily is ' + word(map.side) + ', not with the ' + spec.tf;
    else if (divAgainst(own, own.side)) contWhy = own.div.why;
    else if (!macdWith(own, own.side)) contWhy = 'MACD histogram is not with the trend';
    else if (cusumAgainst(own, own.side)) contWhy = 'CUSUM flipped ' + own.cu.dir + ' ' + own.cu.barsAgo + ' bars ago';
    else if (isFinite(own.volZ) && own.volZ < -0.5) contWhy = 'volume is not behind the break (z ' + own.volZ.toFixed(1) + ')';
    else {
      contOk = own.side;
      contWhy = spec.tf + ' continuation with the daily'
        + (isFinite(own.adx) ? ' · ADX ' + own.adx.toFixed(0) : '')
        + ' · ' + label
        + (isFinite(own.rsi) ? ' · RSI ' + own.rsi.toFixed(0) + ' left on (not faded)' : '')
        + (isFinite(own.volZ) ? ' · volume z ' + own.volZ.toFixed(1) : ' · volume unread');
    }
  } else contWhy = spec.tf + ' EMA stack is mixed';

  if (sweepOk) return { side: sweepOk, why: sweepWhy, kind: 'liquidity sweep', regime: label, session: sess, tape: own };
  if (contOk) return { side: contOk, why: contWhy, kind: 'HTF continuation', regime: label, session: sess, tape: own };
  var why = own.sweep ? sweepWhy : contWhy;
  if (own.sweep && contWhy) why = sweepWhy + ' · ' + contWhy;
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

function gate(spec, play, fund, sent, macro, news){
  if (play.side !== 'long' && play.side !== 'short') return { side: 'none', why: play.why, kind: '' };
  if (fund.block || news.block) return { side: 'none', why: fund.block ? fund.why : news.why, kind: '' };
  if (news.haven && play.side === 'short') return { side: 'none', why: 'safe-haven flow blocks the short', kind: '' };
  var mb = macroBlocks(macro, play.side);
  if (mb) return { side: 'none', why: mb, kind: '' };
  if ((fund.points === 'long' || fund.points === 'short') && fund.points !== play.side) return { side: 'none', why: 'fundamentals point ' + word(fund.points), kind: '' };
  if ((sent.points === 'long' || sent.points === 'short') && sent.points !== play.side) return { side: 'none', why: 'COT points ' + word(sent.points), kind: '' };
  if ((news.points === 'long' || news.points === 'short') && news.points !== play.side) return { side: 'none', why: 'news points ' + word(news.points), kind: '' };
  return { side: play.side, why: play.why, kind: play.kind };
}

function levels(spec, play){
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
  var t1 = play.side === 'long' ? entry + spec.r1 * risk : entry - spec.r1 * risk;
  var t2 = play.side === 'long' ? entry + spec.r2 * risk : entry - spec.r2 * risk;
  return { entry: entry, stop: stop, t1: t1, t2: t2 };
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
    + ' · T1 ' + px(lv.t1) + ' (' + spec.r1 + 'R) · T2 ' + px(lv.t2) + ' (' + spec.r2 + 'R)'
    + '<br><span class="dim">IUX spot, ' + esc(spec.tf) + ' close. ATR stop. Not a fill on your bid.</span></div>';
}

function htmlFor(spec, stacks, shared){
  var play = playOf(spec, stacks);
  var micro = microOf(spec, play);
  var call = gate(spec, play, shared.fund, shared.sent, shared.macro, shared.news);
  var lv = levels(spec, call.side === play.side ? play : { side: 'none' });
  var h = '<div class="note"><b>GOLD PLAYBOOK</b> · ' + esc(spec.name)
    + '<br><span class="dim">Daily structure, CUSUM regime, liquidity sweep or HTF continuation, RSI divergence, MACD with the trend, ATR stop, session, dollar and real yield. A split is no setup.</span></div>';
  h += card(spec, call, lv);
  h += '<div class="cr-ind-wrap">';
  h += '<div class="kv"><span class="k">Technical</span><span class="v">' + arrow(play.side, play.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Fundamental</span><span class="v">' + arrow(shared.fund.points, shared.fund.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Sentiment</span><span class="v">' + arrow(shared.sent.points, shared.sent.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Macro</span><span class="v">' + arrow(shared.macro.points, shared.macro.why) + '</span></div>';
  h += '<div class="kv"><span class="k">Micro</span><span class="v">' + arrow(micro.points, micro.why) + '</span></div>';
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
    var shared = {
      fund: fund,
      sent: { points: fund.cot, why: fund.cotWhy },
      macro: macroOf(macro),
      news: newsOf(news, risk)
    };
    var sig = [shared.fund.points, shared.sent.points, shared.macro.points, shared.news.points];
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
