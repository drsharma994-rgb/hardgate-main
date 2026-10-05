/* HARDGATE — gold-combined.js (hg-v1104)
   Every pillar names the setup it supports. The tab prints one setup only
   when those sides agree. No invented price. A dark feed does not vote. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
if (W.__hgGoldCombinedBoot === 1104) return;
W.__hgGoldCombinedBoot = 1104;

var TABS = {
  goldscalp:     { name: 'GOLD SCALP', tf: '15m', atrMult: 1.2, r1: 1.2, r2: 2, scalp: true },
  goldswing:     { name: 'GOLD SWING', tf: '4h', atrMult: 2, r1: 2, r2: 3.5, scalp: false },
  omnigold:      { name: 'OMNIGOLD', tf: '1h', atrMult: 1.5, r1: 1.5, r2: 2.5, scalp: false },
  goldpro:       { name: 'GOLD PRO', tf: '1h', atrMult: 1.5, r1: 2, r2: 3, scalp: false },
  goldpine:      { name: 'GOLD PINE', tf: '4h', atrMult: 1.8, r1: 2, r2: 3, scalp: false },
  goldultra:     { name: 'GOLD ULTRA', tf: '15m', atrMult: 1.5, r1: 1.5, r2: 2.5, scalp: true },
  golddirection: { name: 'GOLD DIRECTION', tf: '4h', atrMult: 2, r1: 2, r2: 4, scalp: false },
  goldcoint:     { name: 'GOLD COINT', tf: '1d', atrMult: 1.5, r1: 2, r2: 3, scalp: false },
  goldspot:      { name: 'GOLD SPOT', tf: '1h', atrMult: 1.2, r1: 1.2, r2: 2, scalp: false }
};
var HTF = { '15m': '4h', '1h': '4h', '4h': '1d', '1d': null };
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
function closes(rows){
  var o = [], i, c;
  for (i = 0; i < (rows || []).length; i++){
    c = fin(rows[i] && rows[i].c);
    if (c > 0) o.push(c);
  }
  return o;
}
function px(n){ return isFinite(n) ? n.toFixed(2) : '—'; }
function word(side){ return side === 'long' ? 'LONG' : side === 'short' ? 'SHORT' : 'NO SETUP'; }
function arrow(side, why){
  return '<b>→ ' + esc(word(side)) + '</b>' + (why ? ' · ' + esc(why) : '');
}

function stackOf(rows){
  var ema = gfn('ema'), rsiFn = gfn('rsi'), atrFn = gfn('atr');
  var c = closes(rows);
  if (!ema || !rsiFn || c.length < 60) return null;
  var e20 = last(ema(c, 20)), e50 = last(ema(c, 50));
  var e200 = c.length >= 200 ? last(ema(c, 200)) : NaN;
  var price = c[c.length - 1];
  var rv = last(rsiFn(c, 14));
  var av = (atrFn && rows && rows.length > 20) ? last(atrFn(rows, 14)) : NaN;
  var bull = price > e20 && e20 > e50 && (!isFinite(e200) || e50 > e200);
  var bear = price < e20 && e20 < e50 && (!isFinite(e200) || e50 < e200);
  return { px: price, rsi: rv, atr: av, side: bull ? 'long' : bear ? 'short' : 'mixed', full: isFinite(e200) };
}

function techOf(spec, stacks){
  var own = stacks[spec.tf];
  var higher = HTF[spec.tf] ? stacks[HTF[spec.tf]] : null;
  if (!own) return { points: 'none', why: spec.tf + ' tape unread' };
  if (own.side === 'mixed') return { points: 'none', why: spec.tf + ' EMA stack is mixed' + (isFinite(own.rsi) ? ' · RSI ' + own.rsi.toFixed(0) : '') };
  if (own.side === 'long' && isFinite(own.rsi) && own.rsi >= 75) return { points: 'none', why: 'RSI ' + own.rsi.toFixed(0) + ' is stretched — not a long' };
  if (own.side === 'short' && isFinite(own.rsi) && own.rsi <= 25) return { points: 'none', why: 'RSI ' + own.rsi.toFixed(0) + ' is washed out — not a short' };
  if (higher && higher.side !== 'mixed' && higher.side !== own.side){
    return { points: 'none', why: spec.tf + ' wants ' + word(own.side) + ' but ' + HTF[spec.tf] + ' is ' + word(higher.side) };
  }
  var why = spec.tf + ' continuation' + (own.full ? ' · 20/50/200' : ' · 20/50') + (isFinite(own.rsi) ? ' · RSI ' + own.rsi.toFixed(0) : '');
  if (higher && higher.side === own.side) why += ' · ' + HTF[spec.tf] + ' agrees';
  return { points: own.side, why: why };
}

function fundOf(reg){
  if (!reg || !reg.legs) return { points: 'none', why: 'fundamental stack has not run', cot: 'none', cotWhy: 'COT unread' };
  if (reg.blackout) return { points: 'none', why: 'USD event blackout — stand aside', cot: 'none', cotWhy: 'calendar blackout', block: true };
  var cot = 'none', cotWhy = 'COT unread', i, l;
  for (i = 0; i < reg.legs.length; i++){
    l = reg.legs[i];
    if (!l || !/COT/i.test(l.label || '')) continue;
    if (l.state !== 'checked' || l.info){ cotWhy = l.text || 'COT unread'; break; }
    cot = l.vote === 'bull' ? 'long' : l.vote === 'bear' ? 'short' : 'none';
    cotWhy = l.text || (cot === 'none' ? 'COT neutral' : 'COT ' + word(cot));
    break;
  }
  if (!reg.checked) return { points: 'none', why: 'no checked fundamental vote', cot: cot, cotWhy: cotWhy };
  if (reg.bulls > reg.bears) return { points: 'long', why: reg.bulls + ' bull / ' + reg.bears + ' bear', cot: cot, cotWhy: cotWhy };
  if (reg.bears > reg.bulls) return { points: 'short', why: reg.bears + ' bear / ' + reg.bulls + ' bull', cot: cot, cotWhy: cotWhy };
  return { points: 'none', why: 'fundamental votes are tied', cot: cot, cotWhy: cotWhy };
}

function macroOf(m){
  if (!m) return { points: 'none', why: 'dollar and yields unread' };
  var hint = m.realRateHint || 'NEUTRAL';
  var bit = '';
  if (m.dxy && isFinite(fin(m.dxy.value))) bit += 'DXY ' + fin(m.dxy.value).toFixed(2) + ' ' + (m.dxy.trend20 || '');
  if (isFinite(fin(m.tnx))) bit += (bit ? ' · ' : '') + 'US10Y ' + fin(m.tnx).toFixed(2) + '% ' + (m.tnxTrend || '');
  if (hint === 'TAILWIND') return { points: 'long', why: 'real-rate tailwind' + (bit ? ' · ' + bit : '') };
  if (hint === 'HEADWIND') return { points: 'short', why: 'real-rate headwind' + (bit ? ' · ' + bit : '') };
  return { points: 'none', why: 'real-rate is neutral' + (bit ? ' · ' + bit : '') };
}

function microOf(spec, stacks, tech){
  var own = stacks[spec.tf];
  if (!own || !(own.atr > 0)) return { points: 'none', why: spec.tf + ' ATR unread', block: false };
  var kz = null;
  try{ if (gfn('goldKillzone')) kz = W.goldKillzone(Date.now()); }catch(e){ kz = null; }
  if (spec.scalp && kz && !(kz.weight > 0)){
    return { points: 'none', why: (kz.label || 'off session') + ' — scalp stands aside', block: true };
  }
  if (tech.points !== 'long' && tech.points !== 'short'){
    return { points: 'none', why: 'no execution side until the ' + spec.tf + ' stack picks one', block: false };
  }
  var why = spec.tf + ' ATR ' + own.atr.toFixed(2) + ' · stop ' + spec.atrMult + '×ATR';
  if (kz && kz.label) why += ' · ' + kz.label;
  return { points: tech.points, why: why, block: false };
}

function newsOf(news, risk){
  if (risk && risk.blackout) return { points: 'none', why: 'red-folder window — stand aside', block: true };
  var heads = (news && news.headlines) || [];
  var j, h, hit = null;
  for (j = 0; j < heads.length; j++){
    h = heads[j];
    if (!h || !/gold|xau|fed|fomc|cpi|nfp|yield|dollar|dxy|treasury|powell|inflation/i.test(h.title || '')) continue;
    if (h.sentiment === 'bullish' || h.sentiment === 'bearish'){ hit = h; break; }
  }
  if (hit){
    return { points: hit.sentiment === 'bullish' ? 'long' : 'short', why: (hit.source || 'wire') + ' — ' + hit.title, block: false };
  }
  if (risk && risk.unchecked) return { points: 'none', why: 'calendar unread', block: false };
  return { points: 'none', why: 'calendar is clear — news does not pick the side', block: false };
}

function crown(spec, tech, fund, sent, macro, micro, news){
  var voters = [tech, fund, sent, macro];
  var side = tech.points;
  if (side !== 'long' && side !== 'short') return { side: 'none', why: 'technical has no setup' };
  var i, v, agree = 1, oppose = 0;
  for (i = 1; i < voters.length; i++){
    v = voters[i];
    if (!v || v.points === 'none') continue;
    if (v.points === side) agree++;
    else oppose++;
  }
  if (micro.block) return { side: 'none', why: micro.why };
  if (news.block || fund.block) return { side: 'none', why: (news.block ? news.why : fund.why) };
  if (news.points === 'long' || news.points === 'short'){
    if (news.points !== side) return { side: 'none', why: 'news points ' + word(news.points) };
    agree++;
  }
  if (oppose > 0) return { side: 'none', why: 'the pillars do not agree' };
  if (agree < 2) return { side: 'none', why: 'only the tape points ' + word(side) + ' — nothing else confirms' };
  return { side: side, why: agree + ' reads point ' + word(side), agree: agree };
}

function levels(spec, stacks, side){
  var own = stacks[spec.tf];
  if (!own || !(own.px > 0) || !(own.atr > 0) || (side !== 'long' && side !== 'short')) return null;
  var risk = spec.atrMult * own.atr;
  var entry = own.px;
  var stop = side === 'long' ? entry - risk : entry + risk;
  var t1 = side === 'long' ? entry + spec.r1 * risk : entry - spec.r1 * risk;
  var t2 = side === 'long' ? entry + spec.r2 * risk : entry - spec.r2 * risk;
  return { entry: entry, stop: stop, t1: t1, t2: t2, risk: risk };
}

function card(spec, call, lv){
  if (call.side !== 'long' && call.side !== 'short'){
    return '<div class="note warn"><b>' + esc(spec.name) + ' · NO SETUP</b> · ' + esc(call.why) + '</div>';
  }
  if (!lv){
    return '<div class="note warn"><b>' + esc(spec.name) + ' · NO SETUP</b> · ' + word(call.side) + ' is the side, but ATR is unread so there is no price</div>';
  }
  return '<div class="note"><b>' + esc(spec.name) + ' SETUP · ' + word(call.side) + '</b>'
    + ' · ' + esc(call.why)
    + '<br>Entry ' + px(lv.entry) + ' · Stop ' + px(lv.stop)
    + ' · T1 ' + px(lv.t1) + ' (' + spec.r1 + 'R) · T2 ' + px(lv.t2) + ' (' + spec.r2 + 'R)'
    + '<br><span class="dim">IUX spot, ' + esc(spec.tf) + ' close. Market. Not a fill on your bid.</span></div>';
}

function htmlFor(spec, stacks, shared){
  var tech = techOf(spec, stacks);
  var micro = microOf(spec, stacks, tech);
  var call = crown(spec, tech, shared.fund, shared.sent, shared.macro, micro, shared.news);
  var lv = levels(spec, stacks, call.side);
  var h = '<div class="note"><b>COMBINED GOLD READ</b> · ' + esc(spec.name)
    + '<br><span class="dim">Each line is the setup that analysis supports. The card above is this tab\'s setup, and only when the sides agree. Unread does not vote.</span></div>';
  h += card(spec, call, lv);
  h += '<div class="cr-ind-wrap">';
  h += '<div class="kv"><span class="k">Technical</span><span class="v">' + arrow(tech.points, tech.why) + '</span></div>';
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
      var tfs = ['15m', '1h', '4h', '1d'];
      for (var i = 0; i < tfs.length; i++){
        try{
          var got = await candles(tfs[i], 260);
          stacks[tfs[i]] = stackOf(got && got.rows);
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
      if (stacks[tf]) sig.push(tf + stacks[tf].side + String(Math.round(stacks[tf].px * 10)));
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
