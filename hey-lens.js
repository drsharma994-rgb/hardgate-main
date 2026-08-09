/* =========================================================================
HARDGATE — hey-lens.js
Hey / Lens Protocol social desk — crypto post sentiment from Lens GraphQL
via same-origin /api/hey/* (inspired by github.com/slymnoyann/hey-1).

Classic script, IIFE. window.HG_tabs registration (TOOLS group).
Never throws at load time.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

function toEsc(s){
  if (typeof W.hgEsc === 'function') return W.hgEsc(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var __hey = { busy: false, configured: null, lastAt: null };

async function fetchCapabilities(){
  try{
    var res = await fetch('/api/hey/capabilities', { cache: 'no-store' });
    return await res.json();
  }catch(e){ return { ok: false }; }
}

function renderDesk(ui, desk){
  if (!ui.out) return;
  if (!desk){
    ui.out.innerHTML = '<div class="note warn">No desk data — check Lens API reachability</div>';
    return;
  }
  var h = '<div class="note ok">Social <span class="hg-num">' + (desk.socialRiskScore != null ? desk.socialRiskScore : '—')
    + '</span> · ' + toEsc(desk.socialLabel || 'SOCIAL-MIXED')
    + ' · BTC posts ' + (desk.btcPosts != null ? desk.btcPosts : '—')
    + ' · ETH posts ' + (desk.ethPosts != null ? desk.ethPosts : '—') + '</div>';
  if (desk.posts && desk.posts.length){
    h += '<table class="hg-table" style="margin-top:8px"><thead><tr><th>author</th><th>sent</th><th>eng</th><th>post</th></tr></thead><tbody>';
    for (var i = 0; i < desk.posts.length; i++){
      var p = desk.posts[i];
      h += '<tr><td>@' + toEsc(p.author || '—') + '</td><td class="hg-num">' + (p.sentiment != null ? p.sentiment : '—')
        + '</td><td class="hg-num">' + (p.engagement != null ? p.engagement : '—')
        + '</td><td>' + toEsc(p.text || '') + '</td></tr>';
    }
    h += '</tbody></table>';
  } else {
    h += '<div class="note" style="margin-top:8px">No crypto-tagged Lens posts in this window — widen HEY_LENS_AUTHORS on Render.</div>';
  }
  if (desk.errors && desk.errors.length){
    h += '<div class="note warn" style="margin-top:6px">' + toEsc(desk.errors.join('; ')) + '</div>';
  }
  ui.out.innerHTML = h;
}

async function refreshHeyTab(ui, force){
  if (__hey.busy) return;
  __hey.busy = true;
  if (ui.stat) ui.stat.textContent = 'fetching Lens desk…';
  try{
    var res = await fetch('/api/hey/desk' + (force ? '?refresh=1' : ''), { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      renderDesk(ui, j.desk);
      __hey.lastAt = Date.now();
      if (ui.stat) ui.stat.textContent = 'updated · ' + (j.cached ? 'cached' : j.ms + 'ms');
      if (typeof W.refreshHeyDesk === 'function') await W.refreshHeyDesk(true);
    } else if (ui.stat){
      ui.stat.textContent = 'desk fetch failed';
    }
  }catch(e){
    if (ui.stat) ui.stat.textContent = 'error: ' + ((e && e.message) || e);
  }finally{
    __hey.busy = false;
  }
}

function mountHeyLens(el){
  var root = el || document.getElementById('tab_hey');
  if (!root) return;
  root.innerHTML = ''
    + '<div class="hg-panel">'
    + '<div class="hg-panel__head"><span class="hg-panel__title">HEY · Lens social desk</span></div>'
    + '<div class="note">Crypto sentiment from Lens Protocol posts (Hey-style explore + curated authors). Feeds FTS stack + formation.</div>'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    + '<button type="button" class="hg-btn" id="heyRefresh">Refresh desk</button>'
    + '</div>'
    + '<div class="note" id="heyStat" style="margin-top:6px">loading…</div>'
    + '<div id="heyOut" style="margin-top:8px"></div>'
    + '</div>';

  var ui = {
    stat: root.querySelector('#heyStat'),
    out: root.querySelector('#heyOut'),
    refresh: root.querySelector('#heyRefresh'),
  };

  fetchCapabilities().then(function(caps){
    __hey.configured = caps && caps.ok;
    if (ui.stat && caps && caps.authors){
      ui.stat.textContent = 'Lens API · authors: ' + caps.authors.join(', ');
    }
  });

  if (ui.refresh) ui.refresh.addEventListener('click', function(){ return refreshHeyTab(ui, true); });
  refreshHeyTab(ui, false);
}

function heyLensState(){
  return { configured: __hey.configured, lastAt: __hey.lastAt, busy: __hey.busy };
}

async function refreshHeyLens(){
  try{
    if (typeof W.refreshHeyDesk === 'function') return await W.refreshHeyDesk(true);
    return 'skipped';
  }catch(e){ return 'error'; }
}

if (typeof W !== 'undefined'){
  W.heyLensState = heyLensState;
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'hey', label: 'HEY', mount: mountHeyLens, refresh: refreshHeyLens });
}

})();
