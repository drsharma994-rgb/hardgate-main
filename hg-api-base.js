/* HARDGATE — pplx.app fullstack shim.
   BATCH 1124 — load SHIVA GOLD. No navigation. No worker unregister. */
(function(){
  if (typeof window === 'undefined') return;
  if (window.__hgApiBaseInstalled) return;
  window.__hgApiBaseInstalled = true;

  var host = (window.location && window.location.hostname) || '';
  var isPplx = /\.pplx\.app$/i.test(host);
  var BASE_SENTINEL = '__PORT_10000__';
  var isRewritten = BASE_SENTINEL.indexOf('__PORT_') !== 0;

  window.HG_API_BASE = (isPplx && isRewritten) ? BASE_SENTINEL : '';

  var origFetch = window.fetch && window.fetch.bind(window);
  if (!origFetch) return;

  var BASE = window.HG_API_BASE;
  if (BASE && BASE.charAt(0) !== '/') BASE = '/' + BASE;
  window.HG_API_BASE = BASE;

  function rewriteUrl(input){
    if (!window.HG_API_BASE) return input;
    if (typeof input === 'string'){
      if (input.charAt(0) === '/' && input.substr(0, 5) === '/api/'){
        return window.HG_API_BASE + input;
      }
      return input;
    }
    if (input && typeof input === 'object' && typeof input.url === 'string'){
      if (input.url.charAt(0) === '/' && input.url.substr(0, 5) === '/api/'){
        return new Request(window.HG_API_BASE + input.url, input);
      }
    }
    return input;
  }

  window.fetch = function(input, init){
    try { input = rewriteUrl(input); } catch(e){}
    return origFetch(input, init);
  };
})();
(function(){
  if (typeof document === 'undefined') return;
  function add(id, src){
    var old = document.getElementById(id);
    if (old && old.getAttribute('data-v') === '1211') return;
    if (old && old.parentNode) old.parentNode.removeChild(old);   /* hg-v1154: a detached or stubbed node has no parent */
    var s = document.createElement('script');
    s.id = id;
    s.setAttribute('data-v', '1211');
    s.src = src;
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
  }
  /* task #12/#2 fix: the ?v= here was 43 deploys stale (1124 vs the hg-v1167
     deploy) and neither file was precached — a first-visit OFFLINE client lost
     the whole Shiva desk while the stale cachebuster hid it. Both files are
     in HG_SHELL now, and the cache-bump check scans runtime literals here. */
  add('hgShivaDesk', 'shivagold.js?v=1211');
  add('hgShivaNav', 'shiva-nav.js?v=1211');
})();
