/* HARDGATE — gold-combined.js  (hg-v1103)
   One combined read on every gold tab. It does not mint a setup, move a
   stop, or invent a number. Each pillar is WITH, AGAINST, MIXED or UNREAD
   from feeds the desk already loaded. A dark feed stays unread. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
if (W.__hgGoldCombinedBoot) return;
W.__hgGoldCombinedBoot = true;

var TABS = ['goldscalp','goldswing','omnigold','goldpro','goldpine','goldultra','golddirection','goldcoint','goldspot'];
var bag = null;
var sig = '';
var busy = false;
var painting = false;

function gfn(n){ try{ return (typeof W[n] === 'function') ? W[n] : null; }catch(e){ return null; } }
function fin(v){ var n = +v; return isFinite(n) ? n : NaN; }
function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}
function last(a){
  if (!a || !a.length) return NaN;
  for (var i = a.length - 1; i >= 0; i--) if (isFinite(a[i])) return a[i];
  return NaN;
}
function closes(rows){
  var o = [];
  for (var i = 0; i < (rows || []).length; i++){
    var c = fin(rows[i] && rows[i].c);
    if (c > 0) o.push(c);
  }
  return o;
}
function stackOf(rows){
  var ema = gfn('ema'), rsi = gfn('rsi'), atr = gfn('atr');
  var c = closes(rows);
  if (!ema || !rsi || c.length < 60) return null;
  var e20 = last(ema(c, 20)), e50 = last(ema(c, 50));
  var e200 = c.length >= 200 ? last(ema(c, 200)) : NaN;
  var px = c[c.length - 1];
  var rv = last(rsi(c, 14));
  var av = (atr && rows && rows.length > 20) ? last(atr(rows, 14)) : NaN;
  var bull = px > e20 && e20 > e50 && (!isFinite(e200) || e50 > e200);
  var bear = px < e20 && e20 < e50 && (!isFinite(e200) || e50 < e200);
  return { px: px, rsi: rv, atr: av, side: bull ? 'long' : bear ? 'short' : 'mixed', full: isFinite(e200) };
}
function chip(state){
  var cls = state === 'WITH' ? ' ok' : (state === 'AGAINST' ? ' bad' : '');
  return '<span class="gpip' + cls + '">' + esc(state) + '</span>';
}
function row(k, v){
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
}

function techRead(tf){
  if (!tf) return { state: 'UNREAD', text: 'candles not loaded' };
  var txt = tf.side.toUpperCase() + ' stack'
    + (tf.full ? ' (20/50/200)' : ' (20/50, 200 unread)')
    + (isFinite(tf.rsi) ? ' · RSI ' + tf.rsi.toFixed(0) : '')
    + (isFinite(tf.atr) ? ' · ATR ' + tf.atr.toFixed(2) : '');
  return { state: tf.side === 'mixed' ? 'MIXED' : 'WITH', text: txt + ' · ' + tf.px.toFixed(2) };
}
function techPillar(m15, h1, h4){
  var a = techRead(m15), b = techRead(h1), c = techRead(h4);
  if (!m15 && !h1 && !h4) return { state: 'UNREAD', lines: [['15m / 1h / 4h', 'UNREAD', 'no gold candles yet']] };
  var sides = [m15, h1, h4].filter(Boolean).map(function(x){ return x.side; });
  var same = sides.length && sides.every(function(s){ return s === sides[0] && s !== 'mixed'; });
  var mixed = sides.some(function(s){ return s === 'mixed'; }) || (sides.length > 1 && !same);
  return {
    state: !sides.length ? 'UNREAD' : same ? 'WITH' : mixed ? 'MIXED' : 'MIXED',
    lines: [['15m', a.state, a.text], ['1h', b.state, b.text], ['4h', c.state, c.text]]
  };
}
function fundPillar(){
  var reg = null;
  try{ if (gfn('hgFundamentalRegime')) reg = W.hgFundamentalRegime('gold'); }catch(e){ reg = null; }
  if (!reg || !reg.legs) return { state: 'UNREAD', lines: [['Real rates / COT / calendar', 'UNREAD', 'fundamental stack has not run']] };
  var lines = [];
  reg.legs.forEach(function(l){
    if (!l) return;
    var st = l.state !== 'checked' ? 'UNREAD' : (l.info ? 'INFO' : (l.vote === 'bull' ? 'WITH' : l.vote === 'bear' ? 'AGAINST' : 'MIXED'));
    lines.push([l.label, st, l.text || '']);
  });
  var state = 'UNREAD';
  if (reg.checked){
    if (reg.bulls >= 2 && reg.bears === 0) state = 'WITH';
    else if (reg.bears >= 2 && reg.bulls === 0) state = 'AGAINST';
    else state = 'MIXED';
  }
  if (reg.blackout) state = 'AGAINST';
  return { state: state, lines: lines, note: (reg.regime || '') + (reg.blackout ? ' · event blackout' : '') };
}
function sentPillar(fund, news){
  var lines = [];
  var cot = null;
  if (fund && fund.lines){
    fund.lines.forEach(function(l){ if (/COT/i.test(l[0])) cot = l; });
  }
  lines.push(cot || ['CFTC COT', 'UNREAD', 'positioning not loaded']);
  var fng = news && news.fng;
  if (fng && isFinite(fin(fng.value))){
    lines.push(['Fear & Greed', 'INFO', fin(fng.value).toFixed(0) + ' ' + (fng.classification || '') + ' — crypto weather, not a gold vote']);
  } else {
    lines.push(['Fear & Greed', 'UNREAD', 'not loaded — would be info only, never a gold vote']);
  }
  var st = cot && cot[1] !== 'UNREAD' && cot[1] !== 'INFO' ? cot[1] : 'UNREAD';
  return { state: st, lines: lines };
}
function macroPillar(m){
  if (!m) return { state: 'UNREAD', lines: [['Dollar / yields / real rate', 'UNREAD', 'getGoldMacro has not run']] };
  var lines = [];
  lines.push(['DXY', m.dxy && m.dxy.trend20 ? 'INFO' : 'UNREAD', m.dxy ? (fin(m.dxy.value).toFixed(2) + ' · ' + (m.dxy.trend20 || 'no trend')) : 'unread']);
  lines.push(['US 10Y', m.tnxTrend ? 'INFO' : 'UNREAD', isFinite(fin(m.tnx)) ? (fin(m.tnx).toFixed(2) + '% · ' + m.tnxTrend) : 'unread']);
  var ry = m.realRateMeasured;
  lines.push(['Real yield', ry && ry.measured ? 'INFO' : 'UNREAD', ry && ry.measured ? (fin(ry.level).toFixed(2) + ' · ' + (ry.trend || '')) : 'unread']);
  lines.push(['Gold/silver', isFinite(fin(m.goldSilverRatio)) ? 'INFO' : 'UNREAD', isFinite(fin(m.goldSilverRatio)) ? fin(m.goldSilverRatio).toFixed(1) : 'unread']);
  var hint = m.realRateHint || 'NEUTRAL';
  var st = hint === 'TAILWIND' ? 'WITH' : hint === 'HEADWIND' ? 'AGAINST' : (m.dxy || isFinite(fin(m.tnx)) ? 'MIXED' : 'UNREAD');
  lines.unshift(['Real-rate hint', st, hint + (m.realRateSource ? ' · ' + m.realRateSource : '')]);
  return { state: st, lines: lines };
}
function microPillar(m15){
  var kz = null;
  try{ if (gfn('goldKillzone')) kz = W.goldKillzone(Date.now()); }catch(e){ kz = null; }
  var lines = [];
  lines.push(['Session', kz && kz.label ? 'INFO' : 'UNREAD', kz && kz.label ? (kz.label + ' · weight ' + kz.weight) : 'unread']);
  if (m15 && isFinite(m15.atr) && m15.atr > 0){
    lines.push(['15m ATR', 'INFO', m15.atr.toFixed(2) + ' on the IUX spot tape']);
  } else {
    lines.push(['15m ATR', 'UNREAD', 'no 15m tape']);
  }
  lines.push(['Spread', 'UNREAD', 'live IUX bid/ask is not on this feed']);
  return { state: 'INFO', lines: lines };
}
function newsPillar(news, risk){
  var lines = [];
  if (!news && !risk) return { state: 'UNREAD', lines: [['Calendar', 'UNREAD', 'news layer not loaded']] };
  var blackout = risk && risk.blackout === true;
  lines.push(['USD calendar', risk && risk.unchecked ? 'UNREAD' : 'INFO',
    blackout ? 'BLACKOUT — ' + (risk.note || 'red-folder window') : ('risk ' + ((risk && risk.risk) || 'unread') + (risk && risk.note ? ' · ' + risk.note : ''))]);
  var evs = (news && news.events) || [];
  var shown = 0;
  for (var i = 0; i < evs.length && shown < 4; i++){
    var ev = evs[i];
    var country = String(ev.country || '').toUpperCase();
    var title = String(ev.title || '');
    if (country && country !== 'USD' && country !== 'US') continue;
    if (String(ev.impact || '').toLowerCase() === 'low') continue;
    var when = ev.t ? new Date(ev.t).toISOString().slice(5, 16).replace('T', ' ') + 'Z' : '';
    lines.push([title || 'USD event', 'INFO', (ev.impact || '') + (when ? ' · ' + when : '')]);
    shown++;
  }
  if (!shown) lines.push(['Next USD prints', risk && risk.unchecked ? 'UNREAD' : 'INFO', 'none in the loaded calendar window']);
  var heads = (news && news.headlines) || [];
  var hShown = 0;
  for (var j = 0; j < heads.length && hShown < 3; j++){
    var h = heads[j];
    if (!/gold|xau|fed|fomc|cpi|nfp|yield|dollar|dxy|treasury|powell|inflation|war|oil/i.test(h.title || '')) continue;
    lines.push(['Headline', (h.sentiment === 'bullish' ? 'WITH' : h.sentiment === 'bearish' ? 'AGAINST' : 'INFO'),
      (h.source || '') + ' — ' + (h.title || '')]);
    hShown++;
  }
  if (!hShown) lines.push(['Wires', 'INFO', 'loaded wires are crypto desks; no current headline names gold or the dollar']);
  return { state: blackout ? 'AGAINST' : (risk && !risk.unchecked ? 'INFO' : 'UNREAD'), lines: lines };
}

function htmlOf(parts){
  var order = ['Technical','Fundamental','Sentiment','Macro','Micro','News'];
  var h = '<div class="note"><b>COMBINED GOLD READ</b> · IUX XAUUSD spot'
    + '<br><span class="dim">Technical, fundamental, sentiment, macro, micro and news on one board. Evidence only. This block does not print a setup and does not override the tab\'s own gates. Unread is unread.</span></div>';
  h += '<div class="cr-ind-wrap">';
  order.forEach(function(name){
    var p = parts[name];
    h += row(name, chip(p.state) + (p.note ? ' · ' + esc(p.note) : ''));
    (p.lines || []).forEach(function(l){
      h += row(l[0], chip(l[1]) + ' · ' + esc(l[2]));
    });
  });
  return h + '</div>';
}

function paint(){
  if (painting || !bag) return;
  painting = true;
  try{
    var html = htmlOf(bag);
    for (var i = 0; i < TABS.length; i++){
      var pane = document.getElementById('tab_' + TABS[i]);
      if (!pane) continue;
      var slot = pane.querySelector('[data-hg-gold-combined]');
      if (!slot){
        slot = document.createElement('div');
        slot.setAttribute('data-hg-gold-combined', '1');
        slot.className = 'panel';
        pane.insertBefore(slot, pane.firstChild);
      } else if (slot.parentNode === pane && pane.firstChild !== slot){
        pane.insertBefore(slot, pane.firstChild);
      }
      if (slot.getAttribute('data-sig') !== sig){
        slot.innerHTML = html;
        slot.setAttribute('data-sig', sig);
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
    var m15 = null, h1 = null, h4 = null;
    if (candles){
      try{
        var a = await candles('15m', 220);
        var b = await candles('1h', 220);
        var c = await candles('4h', 220);
        m15 = stackOf(a && a.rows);
        h1 = stackOf(b && b.rows);
        h4 = stackOf(c && c.rows);
      }catch(e1){}
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
    var fund = fundPillar();
    bag = {
      Technical: techPillar(m15, h1, h4),
      Fundamental: fund,
      Sentiment: sentPillar(fund, news),
      Macro: macroPillar(macro),
      Micro: microPillar(m15),
      News: newsPillar(news, risk)
    };
    sig = JSON.stringify(bag).slice(0, 400);
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
