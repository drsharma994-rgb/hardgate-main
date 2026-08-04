/* HARDGATE — hosting mode helper (static GitHub Pages vs full Node origin). */
(function(){
  'use strict';
  function hgHostingMode(){
    try{
      var h = (window.location && window.location.hostname) || '';
      if (h.indexOf('github.io') >= 0) return 'static';
      if (h.indexOf('onrender.com') >= 0 || h === 'localhost' || h === '127.0.0.1') return 'full';
      return 'unknown';
    }catch(e){ return 'unknown'; }
  }
  function hgApiAvailable(){ return hgHostingMode() === 'full'; }
  async function hgProbeProxy(){
    try{
      var r = await fetch('/api/proxy?url=' + encodeURIComponent('https://api.coindcx.com/exchange/v1/markets_details'), { method: 'GET', cache: 'no-store' });
      return r && r.ok;
    }catch(e){ return false; }
  }
  async function hgStaticHostBanner(){
    if (hgHostingMode() !== 'static') return;
    var ok = false;
    try{ ok = await hgProbeProxy(); }catch(e){}
    if (ok) return;
    var el = document.getElementById('hgHostBanner');
    if (!el){
      el = document.createElement('div');
      el.id = 'hgHostBanner';
      el.className = 'note warn';
      el.style.cssText = 'margin:8px 12px;padding:10px 12px;border-radius:8px';
      var hdr = document.querySelector('header');
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(el, hdr.nextSibling);
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML = '<b>Static mirror.</b> CoinDCX proxy, paper BOOK, and some macro legs need the full server — use '
      + '<a href="https://hardgate-main.onrender.com/" target="_blank" rel="noopener">hardgate-main.onrender.com</a> for full functionality.';
  }
  window.hgHostingMode = hgHostingMode;
  window.hgApiAvailable = hgApiAvailable;
  window.hgProbeProxy = hgProbeProxy;
  window.hgStaticHostBanner = hgStaticHostBanner;
  if (document && document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ hgStaticHostBanner(); });
  }else{
    try{ hgStaticHostBanner(); }catch(e){}
  }
})();
