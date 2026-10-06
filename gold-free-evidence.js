/* GOLD FREE RESOURCES (hg-v1144)
   A zero-touch evidence panel for GOLD SCALP: silver (XAG), DXY, the US
   10Y real yield + the real-rate hint, PAXG/XAUUSDT open interest and the
   Deribit options vol index - every one of them a FREE public feed the
   house already fetches. Rendered as a panel inside the GOLD SCALP pane;
   evidence, never a gate. No change to goldscalp.js itself. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
var __gfe = { snap: null, at: 0, busy: false };

async function hgGoldFreeEvidence(){
  if (__gfe.busy) return __gfe.snap;
  __gfe.busy = true;
  try{
    var out = { silverDir: null, dxyTrend: null, realYield: null, realRateHint: null, xauOi: null, dvol: null, dvolRegime: null, at: Date.now() };
    try{
      if (typeof W.getGoldMacroCached === 'function'){
        var gm = await W.getGoldMacroCached();
        if (gm){
          if (gm.dxy) out.dxyTrend = gm.dxy.trend20 || gm.dxy.trend || null;
          if (gm.silver) out.silverDir = gm.silver.dir || gm.silver.trend || gm.silverDir || null;
          if (gm.realYield != null && isFinite(+gm.realYield)) out.realYield = +gm.realYield;
          if (gm.realRateHint) out.realRateHint = String(gm.realRateHint);
        }
      }
    }catch(e1){}
    try{ if (typeof W.binanceOI === 'function'){ var oi = await W.binanceOI('XAUUSDT'); if (oi && isFinite(+oi.openInterest)) out.xauOi = +oi.openInterest; } }catch(e2){}
    try{ if (typeof W.deribitVolState === 'function'){ var dv = W.deribitVolState(); if (dv){ out.dvol = isFinite(+dv.dvol) ? +dv.dvol : null; out.dvolRegime = dv.regime || null; } } }catch(e3){}
    __gfe.snap = out; __gfe.at = Date.now();
    return out;
  }catch(e){ return __gfe.snap; }
  finally{ __gfe.busy = false; }
}

function hgGoldFreeEvidencePanelHtml(){
  try{
    var s = __gfe.snap;
    if (!s) return '';
    var rows = [];
    if (s.silverDir) rows.push('<div class="kv"><span class="k">Silver XAG (gold-api, free)</span><span class="v">' + esc(String(s.silverDir)) + '</span></div>');
    if (s.dxyTrend) rows.push('<div class="kv"><span class="k">DXY 20d (free)</span><span class="v">' + esc(String(s.dxyTrend)) + '</span></div>');
    if (s.realYield != null) rows.push('<div class="kv"><span class="k">US 10Y real yield (FRED, free)</span><span class="v">' + s.realYield.toFixed(2) + '%</span></div>');
    if (s.realRateHint) rows.push('<div class="kv"><span class="k">Real-rate hint</span><span class="v">' + esc(String(s.realRateHint)) + '</span></div>');
    if (s.xauOi != null) rows.push('<div class="kv"><span class="k">XAUUSDT open interest (Binance, free)</span><span class="v">' + s.xauOi.toFixed(0) + '</span></div>');
    if (s.dvol != null) rows.push('<div class="kv"><span class="k">DVOL options vol (Deribit, free)</span><span class="v">' + s.dvol.toFixed(1) + (s.dvolRegime ? ' - ' + esc(String(s.dvolRegime)) : '') + '</span></div>');
    if (!rows.length) return '';
    return '<div class="panel" id="hgGoldFreePanel" style="margin-top:10px"><h3>FREE RESOURCES <span>silver - DXY - real yields - gold OI - options vol: evidence, never a gate</span></h3>' + rows.join('') + '</div>';
  }catch(e){ return ''; }
}

function mountIntoGoldScalp(){
  try{
    var pane = document.getElementById('tab_goldscalp');
    if (!pane || document.getElementById('hgGoldFreePanel')) return false;
    var host = document.createElement('div');
    host.id = 'hgGoldFreeHost';
    pane.appendChild(host);
    return true;
  }catch(e){ return false; }
}
function paint(){
  try{
    var host = document.getElementById('hgGoldFreeHost');
    if (!host) return;
    var html = hgGoldFreeEvidencePanelHtml();
    if (host.innerHTML !== html) host.innerHTML = html;
  }catch(e){}
}

var ticks = 0;
var timer = setInterval(function(){
  ticks += 1;
  try{
    if (mountIntoGoldScalp()) paint();
    if (ticks % 12 === 0) hgGoldFreeEvidence().then(paint);   /* refresh every ~60s */
  }catch(e){}
  if (ticks > 200) clearInterval(timer);
}, 5000);
try{ hgGoldFreeEvidence().then(paint); }catch(e){}

W.hgGoldFreeEvidence = hgGoldFreeEvidence;
W.hgGoldFreeEvidencePanelHtml = hgGoldFreeEvidencePanelHtml;
W.hgGoldFreeEvidenceStop = function(){ try{ clearInterval(timer); }catch(e){} };   /* test seam - ends the refresh timer */
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'goldfree', label: 'GOLD FREE RESOURCES', run: hgGoldFreeEvidence });
})();
