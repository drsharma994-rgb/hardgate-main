/* =========================================================================
   HARDGATE — setup-activation.js
   Large green beaming dot on every setup whose entry is live / activated:
     • explicit triggered / inZone / MARKET-fill meta
     • price inside entry zone (hgRefineEntry)
     • open IN BOOK position
   Slots repaint on tick + book-key refresh so dots flip without rescanning.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;
var __hgActMarks = {};
var __hgActRefreshTimer = null;

function fin(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hgSetupMarkFor(sym){
  sym = String(sym || '').toUpperCase();
  try{
    if (__hgActMarks[sym] != null && isFinite(+__hgActMarks[sym])) return +__hgActMarks[sym];
    var tickers = W.wsTickers;
    if (tickers && tickers[sym] && isFinite(+tickers[sym].mark)) return +tickers[sym].mark;
    var baseFn = W.hgCryptoBase;
    var base = baseFn ? baseFn(sym) : sym;
    if (tickers){
      for (var k in tickers){
        if (!Object.prototype.hasOwnProperty.call(tickers, k)) continue;
        if (baseFn && baseFn(k) === base && tickers[k] && isFinite(+tickers[k].mark)) return +tickers[k].mark;
      }
    }
  }catch(e){}
  return NaN;
}

function hgSetupIsInBook(sym, dir, meta){
  if (!sym || (dir !== 'long' && dir !== 'short')) return false;
  var keys = W.__hgBookOpenKeys || {};
  var fundFn = W.bookResolveFund;
  var fund = (meta && meta.fund) || (fundFn ? fundFn(meta || {}) : 'main');
  var keyFn = W.bookPositionKey;
  if (keyFn){
    var k = keyFn(fund, sym, dir);
    if (keys[k]) return true;
  }
  var su = String(sym).toUpperCase();
  for (var fk in keys){
    if (!Object.prototype.hasOwnProperty.call(keys, fk)) continue;
    if (fk.indexOf(':' + su + ':' + dir) >= 0) return true;
  }
  return false;
}

function hgSetupMetaSaysActivated(meta, planText){
  meta = meta || {};
  if (meta.activated === true || meta.triggered === true || meta.inZone === true) return true;
  var st = String(meta.status || meta.entryStatus || '');
  if (/triggered|activated/i.test(st)) return true;
  if (/triggered/i.test(String(meta.entryType || ''))) return true;
  if (meta.entryGuidance && /market fill valid|TRIGGERED/i.test(String(meta.entryGuidance))) return true;
  var plan = String(planText || meta.plan || '');
  if (/TRIGGERED|market fill valid/i.test(plan)) return true;
  return false;
}

function hgSetupZoneFromMeta(meta, entry, stop){
  if (meta && meta.zone && isFinite(+meta.zone.lo) && isFinite(+meta.zone.hi)){
    return { lo: +meta.zone.lo, hi: +meta.zone.hi };
  }
  if (meta && isFinite(+meta.zoneLo) && isFinite(+meta.zoneHi)){
    return { lo: +meta.zoneLo, hi: +meta.zoneHi };
  }
  entry = fin(entry);
  stop = fin(stop);
  if (isFinite(entry) && isFinite(stop)){
    var pad = Math.abs(entry - stop) * 0.15;
    if (pad > 0) return { lo: entry - pad, hi: entry + pad };
  }
  return null;
}

function hgSetupIsActivated(sym, dir, entry, stop, meta, mark, planText){
  meta = meta || {};
  if (hgSetupMetaSaysActivated(meta, planText)) return true;
  if (hgSetupIsInBook(sym, dir, meta)) return true;
  entry = fin(entry);
  if (!isFinite(entry)) return false;
  mark = fin(mark);
  if (!isFinite(mark)) mark = hgSetupMarkFor(sym);
  if (!isFinite(mark)) return false;
  dir = String(dir || '').toLowerCase();
  var zone = hgSetupZoneFromMeta(meta, entry, stop);
  if (typeof W.hgRefineEntry === 'function'){
    var ref = W.hgRefineEntry(mark, entry, zone, dir);
    if (ref && ref.inZone) return true;
    return false;
  }
  var zLo = zone ? zone.lo : entry;
  var zHi = zone ? zone.hi : entry;
  return mark >= zLo && mark <= zHi;
}

function hgSetupActivatedDotInner(activated){
  if (!activated) return '';
  return '<span class="hg-setup-activated-dot" title="Entry activated — live fill zone" aria-label="Setup activated">'
    + '<span class="hg-setup-activated-dot-core"></span>'
    + '<span class="hg-setup-activated-dot-ring"></span>'
    + '<span class="hg-setup-activated-dot-ring hg-setup-activated-dot-ring-2"></span>'
    + '</span>';
}

function hgSetupActivationSlot(sym, dir, entry, stop, meta, planText){
  sym = String(sym || '');
  dir = String(dir || '').toLowerCase();
  meta = meta || {};
  var activated = hgSetupIsActivated(sym, dir, entry, stop, meta, NaN, planText);
  var metaAttr = '{}';
  try{ metaAttr = esc(JSON.stringify(meta)); }catch(e){}
  var entryAttr = isFinite(fin(entry)) ? String(fin(entry)) : '';
  var stopAttr = isFinite(fin(stop)) ? String(fin(stop)) : '';
  var planAttr = planText ? esc(String(planText).slice(0, 320)) : '';
  return '<span class="hg-setup-activation-slot"'
    + ' data-hg-act-sym="' + esc(sym) + '"'
    + ' data-hg-act-dir="' + esc(dir) + '"'
    + ' data-hg-act-entry="' + esc(entryAttr) + '"'
    + ' data-hg-act-stop="' + esc(stopAttr) + '"'
    + ' data-hg-act-meta="' + metaAttr + '"'
    + (planAttr ? ' data-hg-act-plan="' + planAttr + '"' : '')
    + ' data-hg-act-on="' + (activated ? '1' : '0') + '">'
    + hgSetupActivatedDotInner(activated)
    + '</span>';
}

function hgSetupActivatedDotHtml(sym, dir, entry, stop, meta, planText){
  return hgSetupActivationSlot(sym, dir, entry, stop, meta, planText);
}

function hgSetupParsePlanLevels(planHtml){
  var out = { entry: NaN, stop: NaN };
  try{
    var text = String(planHtml || '');
    var em = function(re){
      var m = text.match(re);
      return m ? fin(m[1].replace(/,/g, '')) : NaN;
    };
    out.entry = em(/MARKET\s*@\s*<b>([^<]+)<\/b>/i);
    if (!isFinite(out.entry)) out.entry = em(/ENTRY\s*<b>([^<]+)<\/b>/i);
    if (!isFinite(out.entry)) out.entry = em(/LIMIT[^<]*<b>([^<]+)<\/b>/i);
    out.stop = em(/STOP\s*<b>([^<]+)<\/b>/i);
  }catch(e){}
  return out;
}

function hgSetupCardApplyActivatedClass(card, on){
  if (!card) return;
  if (on) card.classList.add('hg-setup-activated');
  else card.classList.remove('hg-setup-activated');
}

function hgSetupActivationEnrichCards(){
  try{
    var doc = W.document;
    if (!doc || !doc.querySelectorAll) return;
    var cards = doc.querySelectorAll('.card.long, .card.short');
    for (var i = 0; i < cards.length; i++){
      var card = cards[i];
      if (card.querySelector('.hg-setup-activation-slot')) continue;
      var chead = card.querySelector('.chead');
      if (!chead) continue;
      var sym = card.getAttribute('data-hg-setup-sym')
        || (chead.querySelector('.sym') && chead.querySelector('.sym').textContent);
      var dir = card.getAttribute('data-hg-setup-dir')
        || (card.classList.contains('long') ? 'long' : (card.classList.contains('short') ? 'short' : ''));
      if (!sym || (dir !== 'long' && dir !== 'short')) continue;
      var entry = fin(card.getAttribute('data-hg-setup-entry'));
      var stop = fin(card.getAttribute('data-hg-setup-stop'));
      var planNode = card.querySelector('.plan');
      var planText = planNode ? planNode.innerHTML : '';
      if (!isFinite(entry) && planNode){
        var lv = hgSetupParsePlanLevels(planText);
        entry = lv.entry;
        stop = isFinite(stop) ? stop : lv.stop;
      }
      if (!isFinite(entry)) continue;
      var slot = hgSetupActivationSlot(sym, dir, entry, stop, {}, planText);
      chead.insertAdjacentHTML('afterbegin', slot);
      hgSetupCardApplyActivatedClass(card, hgSetupIsActivated(sym, dir, entry, stop, {}, NaN, planText));
    }
  }catch(e){}
}

function hgSetupActivationRefreshDom(){
  try{
    hgSetupActivationEnrichCards();
    var nodes = W.document ? W.document.querySelectorAll('.hg-setup-activation-slot[data-hg-act-sym][data-hg-act-dir]') : [];
    for (var i = 0; i < nodes.length; i++){
      var n = nodes[i];
      var sym = n.getAttribute('data-hg-act-sym');
      var dir = n.getAttribute('data-hg-act-dir');
      var entry = fin(n.getAttribute('data-hg-act-entry'));
      var stop = fin(n.getAttribute('data-hg-act-stop'));
      var plan = n.getAttribute('data-hg-act-plan') || '';
      var meta = {};
      try{ meta = JSON.parse(n.getAttribute('data-hg-act-meta') || '{}'); }catch(e){}
      var on = hgSetupIsActivated(sym, dir, entry, stop, meta, NaN, plan);
      var was = n.getAttribute('data-hg-act-on') === '1';
      if (on !== was || (on && !n.querySelector('.hg-setup-activated-dot')) || (!on && n.querySelector('.hg-setup-activated-dot'))){
        n.setAttribute('data-hg-act-on', on ? '1' : '0');
        n.innerHTML = hgSetupActivatedDotInner(on);
      }
      hgSetupCardApplyActivatedClass(n.closest('.card'), on);
    }
  }catch(e){}
}

function hgSetupActivationInit(){
  try{
    if (!W.document || typeof W.document.querySelectorAll !== 'function') return;
    if (typeof Store !== 'undefined' && Store && typeof Store.subscribe === 'function'){
      Store.subscribe('PRICE_UPDATE', function(d){
        try{
          if (!d || !d.symbol || !isFinite(+d.price)) return;
          __hgActMarks[String(d.symbol).toUpperCase()] = +d.price;
          hgSetupActivationRefreshDom();
        }catch(e){}
      });
    }
    hgSetupActivationRefreshDom();
    if (__hgActRefreshTimer) return;
    __hgActRefreshTimer = setInterval(function(){
      try{ hgSetupActivationRefreshDom(); }catch(e){}
    }, 2500);
    if (W.document && typeof W.document.addEventListener === 'function'){
      W.document.addEventListener('visibilitychange', function(){
        if (W.document.visibilityState === 'visible') hgSetupActivationRefreshDom();
      });
    }
  }catch(e){}
}

W.hgSetupIsActivated = hgSetupIsActivated;
W.hgSetupActivatedDotHtml = hgSetupActivatedDotHtml;
W.hgSetupActivationSlot = hgSetupActivationSlot;
W.hgSetupActivationRefreshDom = hgSetupActivationRefreshDom;
W.hgSetupActivationEnrichCards = hgSetupActivationEnrichCards;
W.hgSetupActivationInit = hgSetupActivationInit;

try{
  if (W.document){
    if (W.document.readyState === 'loading'){
      W.document.addEventListener('DOMContentLoaded', hgSetupActivationInit);
    } else {
      hgSetupActivationInit();
    }
  }
}catch(e){}

})();
