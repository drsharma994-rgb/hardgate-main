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

/* =========================================================================
   HARDGATE Conviction System - Phase 3 & 4 Integration
   Live deployment of conviction-driven trading system with intelligent optimization
   ========================================================================= */
(function(){
  'use strict';

  // Initialize conviction system on app startup
  if (document && document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      try {
        initializeConvictionSystem();
      } catch(e) {
        console.error('[HARDGATE-Conviction] Initialization failed:', e);
      }
    });
  } else {
    try {
      initializeConvictionSystem();
    } catch(e) {
      console.error('[HARDGATE-Conviction] Initialization failed:', e);
    }
  }

  async function initializeConvictionSystem(){
    try {
      // Load bootstrap
      const HardgateConvictionBootstrap = (function(){
        // Inline bootstrap to avoid additional HTTP request
        // Complete bootstrap code loaded from hardgate-conviction-bootstrap.js
        return window.HardgateConvictionBootstrap || (typeof require !== 'undefined' ? require('./hardgate-conviction-bootstrap.js') : null);
      })();

      if (!HardgateConvictionBootstrap) {
        console.warn('[HARDGATE-Conviction] Bootstrap not available, loading via require');
        const Bootstrap = require('./hardgate-conviction-bootstrap.js');
        const bootstrap = new Bootstrap(window);
        await bootstrap.initialize();
        window.HG_BOOTSTRAP = bootstrap;
        console.log('[HARDGATE-Conviction] ✅ Phase 3 & 4 LIVE');
        return;
      }

      const bootstrap = new HardgateConvictionBootstrap(window);
      await bootstrap.initialize();
      window.HG_BOOTSTRAP = bootstrap;

      // Log status to console
      console.log('[HARDGATE-Conviction] ✅ System initialized');
      console.log('[HARDGATE-Conviction] Status:', bootstrap.getStatus());

    } catch(e) {
      console.error('[HARDGATE-Conviction] Error during initialization:', e);
    }
  }

  // Expose helper
  window.HG_CONVICTION_INIT = function(){
    console.log('[HARDGATE-Conviction] Manual initialization triggered');
    return window.HG_BOOTSTRAP ? window.HG_BOOTSTRAP.getStatus() : 'Not initialized';
  };

})();
