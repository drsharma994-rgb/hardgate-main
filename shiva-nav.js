/* BATCH 1115 — SHIVA GOLD was registered but not in the GOLD chip list, so the tab never showed. */
(function(){
  var W = (typeof window !== 'undefined') ? window : globalThis;
  if (W.__hgShivaNav === 1115) return;
  W.__hgShivaNav = 1115;
  function place(){
    var groups = W.HG_NAV_GROUPS;
    if (!groups || !groups.length) return false;
    var i, g, hit = false;
    for (i = 0; i < groups.length; i++){
      g = groups[i];
      if (!g || !g.tabs) continue;
      if (g.id === 'gold' || String(g.label || '').toUpperCase() === 'GOLD'){
        if (g.tabs.indexOf('shivagold') < 0) g.tabs.unshift('shivagold');
        hit = true;
      }
    }
    W.HG_TAB_GROUP = W.HG_TAB_GROUP || {};
    W.HG_TAB_GROUP.shivagold = 'gold';
    if (typeof W.hgRenderGroupChips === 'function'){
      try{ W.hgRenderGroupChips(); }catch(e){}
    }
    if (typeof W.hgLayoutNav === 'function'){
      try{ W.hgLayoutNav(); }catch(e2){}
    }
    return hit;
  }
  var n = 0;
  var t = setInterval(function(){
    n += 1;
    if (place() || n > 60) clearInterval(t);
  }, 400);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
