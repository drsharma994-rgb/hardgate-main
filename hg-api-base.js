/* HARDGATE — pplx.app fullstack shim.
   Prefixes same-origin /api/* fetches with __PORT_10000__ when running under a
   Perplexity-hosted subdomain. The publish pipeline rewrites __PORT_10000__ →
   /port/10000/ at upload, which routes to the sandbox backend.
   On Render / localhost / GitHub Pages, we leave /api/* untouched.
   Zero deps. Load BEFORE any app script. Safe if loaded twice. */
(function(){
  if (typeof window === 'undefined') return;
  if (window.__hgApiBaseInstalled) return;
  window.__hgApiBaseInstalled = true;

  var host = (window.location && window.location.hostname) || '';
  var isPplx = /\.pplx\.app$/i.test(host);
  /* The sentinel is intentionally the LITERAL string — the upload pipeline
     rewrites it. On live it becomes '/port/10000'; on preview it also becomes
     '/port/10000'; anywhere else it stays literal and we treat that as "off". */
  var BASE_SENTINEL = '__PORT_10000__';
  var isRewritten = BASE_SENTINEL.indexOf('__PORT_') !== 0;   /* after rewrite */

  window.HG_API_BASE = (isPplx && isRewritten) ? BASE_SENTINEL : '';

  var origFetch = window.fetch && window.fetch.bind(window);
  if (!origFetch) return;

  /* Ensure the base always starts with a slash so the result is absolute. */
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
