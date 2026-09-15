/* ============================================================================
   HARDGATE — desktop shell metrics
   ----------------------------------------------------------------------------
   The desktop shell (hardgate-desktop-shell.css) fixes the chrome to the
   viewport and flows the content inside it. Two offsets decide where the
   content starts:

     --hg-chrome-h   height of the fixed header (title bar + tool strip)
     --hg-groups-h   height of the group list, which the tab list sits under

   Both change with the viewport, with font size, and when the header is
   minimized (` key / MIN button), so they are measured rather than guessed.
   The CSS ships fallback values, so a failure here leaves a laid-out page
   rather than a broken one.

   Nothing else in the app is touched: no DOM is moved, no handler wrapped.
   ========================================================================= */
(function(){
  'use strict';

  var DESKTOP = 861;          /* below this, mobile.css owns the layout */
  var root    = document.documentElement;

  function elementHeight(el){
    /* getBoundingClientRect keeps sub-pixel heights, so the sidebar does not
       drift a pixel away from the header on fractional-DPI displays */
    if (!el) return 0;
    try{
      var r = el.getBoundingClientRect();
      return (r && r.height) ? r.height : (el.offsetHeight || 0);
    }catch(e){ return el.offsetHeight || 0; }
  }

  function measure(){
    try{
      if (!root || !root.style || typeof root.style.setProperty !== 'function') return;

      /* Outside the desktop breakpoint the variables are unused. Clear them
         so a resize back down to phone width cannot leave a stale offset. */
      var wide = (window.innerWidth || root.clientWidth || 0) >= DESKTOP;
      if (!wide){
        root.style.removeProperty('--hg-chrome-h');
        root.style.removeProperty('--hg-groups-h');
        return;
      }

      var header = document.querySelector('header.hg-header') || document.querySelector('header');
      var groups = document.getElementById('navGroups');

      /* A hidden group row (chrome-min) measures 0, which is exactly right:
         the tab list then starts directly under the header. */
      root.style.setProperty('--hg-chrome-h', Math.round(elementHeight(header)) + 'px');
      root.style.setProperty('--hg-groups-h', Math.round(elementHeight(groups)) + 'px');
    }catch(e){ /* fallbacks in CSS keep the shell usable */ }
  }

  /* re-measure on anything that can change the chrome's height */
  function watch(){
    try{
      measure();

      if (typeof ResizeObserver === 'function'){
        var ro = new ResizeObserver(measure);
        var header = document.querySelector('header.hg-header');
        var groups = document.getElementById('navGroups');
        if (header) ro.observe(header);
        if (groups) ro.observe(groups);
      }

      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);

      /* the ` key and the MIN button toggle html.hg-chrome-min, and the
         group row is rendered after the tabs are known — both land here */
      if (typeof MutationObserver === 'function'){
        new MutationObserver(measure).observe(root, {
          attributes: true, attributeFilter: ['class']
        });
        var groupsEl = document.getElementById('navGroups');
        if (groupsEl){
          new MutationObserver(measure).observe(groupsEl, { childList: true });
        }
      }

      /* fonts land after first paint and can nudge the chrome a pixel */
      if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function'){
        document.fonts.ready.then(measure).catch(function(){});
      }
      window.addEventListener('load', measure);
    }catch(e){}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
