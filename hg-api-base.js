/* HARDGATE — pplx.app fullstack shim.
   Prefixes same-origin /api/* fetches with __PORT_10000__ when running under a
   Perplexity-hosted subdomain. The publish pipeline rewrites __PORT_10000__ →
   /port/10000/ at upload, which routes to the sandbox backend.
   On Render / localhost / GitHub Pages, we leave /api/* untouched.
   Zero deps. Load BEFORE any app script. Safe if loaded twice.
   BATCH 1120 — load SHIVA GOLD and its nav chip. No navigation. */
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
  if (document.getElementById('hgShivaDesk')) return;
  function add(id, src){
    if (document.getElementById(id)) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
  }
  add('hgShivaDesk', 'shivagold.js?v=1120');
  add('hgShivaNav', 'shiva-nav.js?v=1120');
})();
