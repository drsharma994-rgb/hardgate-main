/* HARDGATE — Hey / Lens social desk browser bridge for formation + FTS stack. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __heySnap = null;
var __heyBusy = false;
var __heyAt = 0;
var HEY_TTL = 5 * 60 * 1000;

function heySocialRiskScore(posts){
  if (!posts || !posts.length) return 0;
  var weighted = 0, weight = 0;
  for (var i = 0; i < posts.length; i++){
    var p = posts[i];
    if (!p) continue;
    var w = Math.max(1, (p.engagement || 0) + 1);
    weighted += (p.sentiment || 0) * w;
    weight += w;
  }
  if (!(weight > 0)) return 0;
  return Math.max(-100, Math.min(100, Math.round((weighted / weight) * 100)));
}

function heyDeskFormationBoost(dir, desk){
  desk = desk || __heySnap;
  if (!desk) return 0;
  var side = String(dir || 'long').toLowerCase();
  var score = desk.socialRiskScore != null ? +desk.socialRiskScore : heySocialRiskScore(desk.posts);
  if (side === 'long'){
    if (score >= 40) return 12;
    if (score >= 20) return 7;
    if (score >= 8) return 3;
    if (score <= -40) return -12;
    if (score <= -20) return -7;
    if (score <= -8) return -3;
    return 0;
  }
  if (score <= -40) return 12;
  if (score <= -20) return 7;
  if (score <= -8) return 3;
  if (score >= 40) return -12;
  if (score >= 20) return -7;
  if (score >= 8) return -3;
  return 0;
}

function getHeyDeskCached(){
  try{
    if (__heySnap) return JSON.parse(JSON.stringify(__heySnap));
    return null;
  }catch(e){ return null; }
}

async function refreshHeyDesk(force){
  if (__heyBusy) return __heySnap;
  if (!force && __heySnap && (Date.now() - __heyAt) < HEY_TTL) return __heySnap;
  __heyBusy = true;
  try{
    var res = await fetch('/api/hey/desk' + (force ? '?refresh=1' : ''), { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __heySnap = j.desk;
      if (__heySnap.socialRiskScore == null && __heySnap.posts){
        __heySnap.socialRiskScore = heySocialRiskScore(__heySnap.posts);
      }
      __heyAt = Date.now();
    }
  }catch(e){}
  finally{ __heyBusy = false; }
  return __heySnap;
}

function hgHeyDeskPanelHtml(){
  var d = getHeyDeskCached();
  if (!d) return '<div class="note">Hey Lens desk — loading…</div>';
  var h = '<div class="hg-panel__legend" style="margin-top:10px">Hey Lens · crypto social</div>';
  h += '<div class="note">Social score <span class="hg-num">' + (d.socialRiskScore != null ? d.socialRiskScore : 'n/a')
    + '</span> · ' + (d.socialLabel || 'SOCIAL-MIXED')
    + ' · posts <span class="hg-num">' + (d.postCount != null ? d.postCount : (d.posts ? d.posts.length : 0)) + '</span></div>';
  if (d.posts && d.posts.length){
    h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>author</th><th>sent</th><th>eng</th><th>snippet</th></tr></thead><tbody>';
    for (var i = 0; i < Math.min(5, d.posts.length); i++){
      var p = d.posts[i];
      h += '<tr><td>@' + (p.author || '—') + '</td><td class="hg-num">' + (p.sentiment != null ? p.sentiment : '—')
        + '</td><td class="hg-num">' + (p.engagement != null ? p.engagement : '—')
        + '</td><td>' + String(p.text || '').replace(/</g, '&lt;').slice(0, 80) + '</td></tr>';
    }
    h += '</tbody></table>';
  }
  return h;
}

G.getHeyDeskCached = getHeyDeskCached;
G.refreshHeyDesk = refreshHeyDesk;
G.heyDeskFormationBoost = heyDeskFormationBoost;
G.hgHeyDeskPanelHtml = hgHeyDeskPanelHtml;

try{
  if (typeof G.addEventListener === 'function'){
    G.addEventListener('load', function(){
      setTimeout(function(){ refreshHeyDesk(false); }, 1500);
    });
  }
}catch(e){}

})();
