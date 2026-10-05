/* HARDGATE — pplx.app fullstack shim.
   Prefixes same-origin /api/* fetches with __PORT_10000__ when running under a
   Perplexity-hosted subdomain. The publish pipeline rewrites __PORT_10000__ →
   /port/10000/ at upload, which routes to the sandbox backend.
   On Render / localhost / GitHub Pages, we leave /api/* untouched.
   Zero deps. Load BEFORE any app script. Safe if loaded twice.
   BATCH 1116 — a v1111 tab marked STALE (1 behind) was not loading. The
   reload lock is cleared and the current stamp is fetched. SHIVA GOLD is loaded. */
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
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try{
    var ss = window.sessionStorage;
    if (ss){
      var i, k;
      for (i = ss.length - 1; i >= 0; i--){
        k = ss.key(i);
        if (k && (k.indexOf('hg_build_reload_') === 0 || k === 'hg_sw_reload')) ss.removeItem(k);
      }
    }
  }catch(e0){}
  try{
    if (window.caches && window.caches.keys){
      window.caches.keys().then(function(keys){
        keys.forEach(function(k){ window.caches.delete(k); });
      });
    }
  }catch(e1){}
  try{
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
      navigator.serviceWorker.getRegistrations().then(function(rs){
        rs.forEach(function(r){ r.unregister(); });
      });
    }
  }catch(e2){}
  function add(id, src){
    if (document.getElementById(id)) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
  }
  add('hgStampNow', 'build-stamp.js?v=1116');
  add('hgShivaDesk', 'shivagold.js?v=1116');
  add('hgShivaNav', 'shiva-nav.js?v=1116');
  var q = window.location && window.location.search || '';
  if (q.indexOf('bust=1116') < 0){
    try{
      var url = window.location.pathname + '?bust=1116';
      window.location.replace(url);
    }catch(e3){}
  }
})();
