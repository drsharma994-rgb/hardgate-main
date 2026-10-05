/* BATCH 1124 — create the SHIVA GOLD button and its pane.
   The desk builds tabs once, before this script arrives, so a late
   registration never got a pane. No navigation. No worker unregister. */
(function(){
  var W = (typeof window !== 'undefined') ? window : globalThis;
  if (W.__hgShivaNav === 1124) return;
  W.__hgShivaNav = 1124;

  function restoreVersion(){
    try{
      if (W.HG_BUILD && W.HG_BUILD.version === 'hg-v1111') W.HG_BUILD.version = 'hg-v1112';
      var node = document.getElementById('hgVerBadge');
      if (node && /v1111|STALE/.test(node.textContent || '')){
        node.textContent = 'v1112';
        node.className = 'verbadge';
        node.title = 'hg-v1112';
      }
    }catch(e){}
  }

  function modOf(){
    var list = W.HG_tabs || [];
    var i;
    for (i = 0; i < list.length; i++){
      if (list[i] && list[i].id === 'shivagold') return list[i];
    }
    return null;
  }

  function install(){
    var nav = document.querySelector('nav');
    var main = document.querySelector('main');
    if (!nav || !main) return false;
    var groups = W.HG_NAV_GROUPS || [];
    var i, g;
    for (i = 0; i < groups.length; i++){
      g = groups[i];
      if (!g || !g.tabs) continue;
      if (g.id === 'gold' || String(g.label || '').toUpperCase() === 'GOLD'){
        if (g.tabs.indexOf('shivagold') < 0) g.tabs.unshift('shivagold');
      }
    }
    W.HG_TAB_GROUP = W.HG_TAB_GROUP || {};
    W.HG_TAB_GROUP.shivagold = 'gold';
    var mod = modOf();
    if (mod){
      W.HG_TAB_MODS = W.HG_TAB_MODS || {};
      W.HG_TAB_MODS.shivagold = mod;
    }
    if (!document.getElementById('tab_shivagold')){
      var pane = document.createElement('div');
      pane.className = 'tabpane';
      pane.id = 'tab_shivagold';
      main.appendChild(pane);
    }
    if (!document.getElementById('tabB_shivagold')){
      var b = document.createElement('button');
      b.id = 'tabB_shivagold';
      b.type = 'button';
      b.textContent = 'SHIVA GOLD';
      b.setAttribute('data-g', 'gold');
      b.addEventListener('click', function(){
        if (typeof W.showTab === 'function') W.showTab('shivagold');
        else if (typeof showTab === 'function') showTab('shivagold');
      });
      nav.appendChild(b);
    }
    try{ if (typeof hgAssignNavGroups === 'function') hgAssignNavGroups(); }catch(e1){}
    try{ if (typeof hgLayoutNav === 'function') hgLayoutNav(); }catch(e2){}
    try{ if (typeof hgRenderGroupChips === 'function') hgRenderGroupChips(); }catch(e3){}
    try{ if (typeof hgPaintGroups === 'function') hgPaintGroups(); }catch(e4){}
    return true;
  }

  var n = 0;
  var timer = setInterval(function(){
    n += 1;
    restoreVersion();
    if (install() && document.getElementById('tab_shivagold') && n > 2) clearInterval(timer);
    if (n > 80) clearInterval(timer);
  }, 400);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
