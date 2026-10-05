/* BATCH 1121 — SHIVA GOLD chip, and do not leave the badge pinned at v1111.
   No location change. No service-worker unregister. */
(function(){
  var W = (typeof window !== 'undefined') ? window : globalThis;
  if (W.__hgShivaNav === 1121) return;
  W.__hgShivaNav = 1121;

  function restoreVersion(){
    try{
      if (!W.HG_BUILD) return;
      if (W.HG_BUILD.version === 'hg-v1111') W.HG_BUILD.version = 'hg-v1112';
      var node = document.getElementById('hgVerBadge');
      if (node && /v1111|STALE/.test(node.textContent || '')){
        node.textContent = 'v1112';
        node.className = 'verbadge';
        node.title = 'hg-v1112';
      }
    }catch(e){}
  }

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
    return hit;
  }

  function ensureChip(){
    if (document.getElementById('tabB_shivagold')) return;
    var buttons = document.querySelectorAll('button');
    var anchor = null, i, t;
    for (i = 0; i < buttons.length; i++){
      t = (buttons[i].textContent || '') + ' ' + (buttons[i].getAttribute('onclick') || '');
      if (/goldscalp|GOLD SCALP|omnigold/i.test(t)){ anchor = buttons[i]; break; }
    }
    if (!anchor || !anchor.parentNode) return;
    var b = document.createElement('button');
    b.id = 'tabB_shivagold';
    b.type = 'button';
    b.className = anchor.className || '';
    b.textContent = 'SHIVA GOLD';
    b.onclick = function(){
      if (typeof W.showTab === 'function') W.showTab('shivagold');
    };
    anchor.parentNode.insertBefore(b, anchor);
  }

  var n = 0;
  var timer = setInterval(function(){
    n += 1;
    restoreVersion();
    place();
    ensureChip();
    if (n > 40 && document.getElementById('tabB_shivagold')) clearInterval(timer);
  }, 500);
  restoreVersion();
})();
