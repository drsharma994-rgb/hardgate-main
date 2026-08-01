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
  window.hgHostingMode = hgHostingMode;
  window.hgApiAvailable = function(){ return hgHostingMode() === 'full'; };
})();
