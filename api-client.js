/* HARDGATE — browser helpers for API auth headers + HTML escaping. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

function hgEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hgApiHeaders(extra){
  var k = '';
  try { k = localStorage.getItem('hg_api_key') || ''; } catch (e) {}
  var h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  if (k) h['X-Hardgate-Key'] = k;
  return h;
}

function saveHgApiKey(){
  var el = document.getElementById('hgApiKey');
  var stat = document.getElementById('hgApiKeyStat');
  var v = el ? String(el.value || '').trim() : '';
  try {
    if (v) localStorage.setItem('hg_api_key', v); else localStorage.removeItem('hg_api_key');
    if (stat) stat.textContent = v ? 'saved' : 'cleared';
  } catch (e) {
    if (stat) stat.textContent = 'save failed';
  }
}

function initHgApiKey(){
  try {
    var v = localStorage.getItem('hg_api_key') || '';
    var el = document.getElementById('hgApiKey');
    if (el) el.value = v;
  } catch (e) {}
}

W.hgEsc = hgEsc;
W.hgApiHeaders = hgApiHeaders;
W.saveHgApiKey = saveHgApiKey;
W.initHgApiKey = initHgApiKey;
})();
