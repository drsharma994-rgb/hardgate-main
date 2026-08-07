/* =========================================================================
   HARDGATE service worker — cache hg-v9
   Fresh data is sacred in trading: NETWORK-FIRST for EVERYTHING. The cache
   exists ONLY as an offline fallback for the static app shell.
   NEVER cached: /api/ and /api/proxy responses, non-GET requests, cross-origin
   market data (Delta / CoinDCX / Binance / gold feeds), and responses marked
   no-store/private. install/activate are wrapped so they never throw.
   ========================================================================= */
'use strict';

const HG_CACHE = 'hg-v189';

/* Static app shell, precached best-effort for the offline fallback. A single
   missing file must never fail install — runtime network-first backfills. */
const HG_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg', './bright.css', './mobile.css',
  './hghost.js',
  './indicators.js', './indicators2.js', './store.js', './binance.js', './spot-perp.js', './startrader.js', './bybit.js', './deribit-vol.js', './positioning.js', './cryptowatch.js', './macro.js',
  './setup-ui.js', './plans.js', './setup-stack.js', './cryptogates.js',
  './squeeze.js', './trendtable.js', './oiflow.js', './regime.js', './carry.js', './termbasis.js',
  './goldpro.js', './strats.js', './meanrev.js', './edge.js', './startradertab.js', './book-routing.js', './book.js', './execute.js', './liqs.js', './xuniverse.js',
  './engine.js', './news.js', './onchain.js', './rotation.js', './goldspot.js',
  './goldind.js', './goldscalp.js', './goldswing.js', './pinegoldmath.js', './goldpine.js', './signallog.js',
  './conviction-lock.js', './macro-feeds.js',
  './hgalert.js', './tabalerts.js', './hggateflip.js', './brainrobust.js', './braininvalidation.js', './brain.js', './scorecard.js',
  './pinemath.js', './pinegate.js', './pine.js', './pine-sub.js', './pinemsb.js', './pinesqz.js', './pinesmf.js', './pineht.js', './pinesmc.js', './pinecipher.js', './pinerf.js', './pinenw.js', './pineavwap.js'
];

/* true → the request/response must NEVER touch the cache (fresh market data
   semantics). Doubt defaults to true: a missed cache entry is cheap, a stale
   market number is not. */
function hgNeverCache(req, url){
  try{
    if (!req || req.method !== 'GET') return true;
    if (!url || url.origin !== self.location.origin) return true;  /* exchange/market APIs are cross-origin */
    const p = url.pathname || '';
    if (p === '/api' || p.indexOf('/api/') === 0) return true;     /* serverless API routes */
    if ((url.href || '').indexOf('/api/proxy') !== -1) return true;/* proxy passthroughs */
    return false;
  }catch(e){ return true; }
}
function hgIsShellRequest(url){
  try{
    if (!url || url.origin !== self.location.origin) return false;
    const p = url.pathname || '';
    const rel = (p === '/' || p === '') ? './' : ('.' + (p.endsWith('/') ? p.slice(0, -1) : p));
    for (let i = 0; i < HG_SHELL.length; i++){
      const s = HG_SHELL[i];
      if (s === rel || s === './' + p.replace(/^\//, '') || s === p) return true;
    }
    return false;
  }catch(e){ return false; }
}

self.addEventListener('install', function(ev){
  ev.waitUntil(
    caches.open(HG_CACHE)
      .then(function(c){ return c.addAll(HG_SHELL); })
      .catch(function(){ /* precache is best-effort — never fail install */ })
      .then(function(){ try{ return self.skipWaiting(); }catch(e){} })
  );
});

self.addEventListener('activate', function(ev){
  ev.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){
          if (k !== HG_CACHE) return caches.delete(k);             /* old-cache cleanup */
          return undefined;
        }));
      })
      .catch(function(){ /* cleanup failure must not block activation */ })
      .then(function(){ try{ return self.clients.claim(); }catch(e){} })
  );
});

self.addEventListener('fetch', function(ev){
  const req = ev.request;
  if (!req || req.method !== 'GET') return;                        /* non-GET → straight to network, untouched */
  let url = null;
  try{ url = new URL(req.url); }catch(e){ return; }                /* unparsable → let the browser handle it */

  const cacheable = !hgNeverCache(req, url);

  /* network-first for EVERYTHING; cache consulted only when the network fails */
  ev.respondWith(
    fetch(req).then(function(res){
      try{
        const cc = (res && res.headers && res.headers.get('cache-control')) || '';
        if (cacheable && res && res.ok && !/no-store|private/i.test(cc) && hgIsShellRequest(url)){
          const copy = res.clone();
          caches.open(HG_CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
      }catch(e){}
      return res;
    }).catch(function(netErr){
      return caches.match(req).then(function(hit){
        if (hit) return hit;                                       /* offline fallback: static shell only */
        if (req.mode === 'navigate'){
          return caches.match('./index.html').then(function(shell){
            return shell || Promise.reject(netErr);
          });
        }
        throw netErr;                                              /* honest failure — never a stale number */
      });
    })
  );
});
