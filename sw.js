/* =========================================================================
   HARDGATE service worker — cache hg-v9
   Fresh data is sacred in trading: NETWORK-FIRST for EVERYTHING. The cache
   exists ONLY as an offline fallback for the static app shell.
   NEVER cached: /api/ and /api/proxy responses, non-GET requests, cross-origin
   market data (Delta / CoinDCX / Binance / gold feeds), and responses marked
   no-store/private. install/activate are wrapped so they never throw.
   ========================================================================= */
'use strict';

const HG_CACHE = 'hg-v439';

/* Static app shell, precached best-effort for the offline fallback. A single
   missing file must never fail install — runtime network-first backfills. */
const HG_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './bright.css', './hg-icons.css', './vendor/base-themes/tokens-data-dense-light.css', './mobile.css', './annunciator.css',
  './build-stamp.js',
  './hghost.js',
  './indicators.js', './indicators2.js', './store.js', './binance.js', './spot-perp.js', './startrader.js', './xm-trader.js', './bybit.js', './deribit-vol.js', './positioning.js', './cryptowatch.js', './macro.js', './openbb-desk.js', './ccxt-desk.js', './trading-stack.js', './worldmonitor-desk.js', './chart-vision-desk.js', './chartvision-tab.js', './hey-desk.js', './atomic-agent-desk.js', './ai-agent.js', './agent-alerts.js',
  './setup-ui.js', './plans.js', './setup-stack.js', './gate-replay-oos.js', './cryptogates.js',
  './squeeze.js', './trendtable.js', './oiflow.js', './regime.js', './carry.js', './hg-forward.js', './hg-mechanics.js', './hg-gates.js', './hg-plan.js', './omniroute.js', './omnigold.js', './omnipresent.js', './contract-report.js', './termbasis.js',
  './goldpro.js', './strats.js', './meanrev.js', './supersetup.js', './super-desk-common.js', './super-gold.js', './super-best.js', './super-sniper.js', './super-book.js', './super-calibrate.js', './reversalsniper.js', './edge.js', './startradertab.js', './book-routing.js', './api-client.js', './tradeos.js', './hey-lens.js', './book.js', './execute.js', './liqs.js', './xuniverse.js', './desk-scan-universe.js',
  /* Vendored third-party libraries. Previously loaded from unpkg/jsdelivr, so
     the offline shell covered 126 local files and then broke on charts. */
  './vendor/lightweight-charts-4.2.0.js', './vendor/emailjs-browser-4.4.1.js',
  './engine.js', './news.js', './onchain.js', './rotation.js', './goldspot.js',
  './goldind.js', './goldscalp.js', './goldswing.js', './pinegoldmath.js', './goldpine.js', './signallog.js',
  './conviction-lock.js', './macro-feeds.js', './venuepremium.js',
  './hgalert.js', './tabalerts.js', './hggateflip.js', './brainrobust.js', './braininvalidation.js', './gstack-brain.js', './brain.js', './scorecard.js', './fixpack13-core.js', './fixpack14-core.js', './fixpack15-core.js', './fixpack16-core.js', './fixpack17-core.js', './crypto-position-risk.js', './risk-tab.js', './reliability.js', './goldcoint.js', './structure-levels.js', './formation.js', './freqtrade-formation.js', './best-levels.js', './gold-best-levels.js', './walkforward-ui.js', './formation-instr-ui.js', './meta-label.js', './tear-sheet.js', './purged-cv.js', './agent-debate.js', './formation-lab.js',
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

/* PER-FILE, not addAll.

   cache.addAll() is ATOMIC by specification: if any one request fails, the
   returned promise rejects and NOTHING is written to the cache. The shell
   above is 125 files and the comment on it promises that "a single missing
   file must never fail install" — which is exactly what addAll does not
   provide. One renamed or mistyped entry and the whole offline shell was
   silently empty, because the .catch() below swallowed the rejection and
   install completed looking healthy.

   Each file is now added on its own, so one 404 costs one file. The count is
   reported to any client that asks, so a shell that is quietly half-cached
   can be seen rather than guessed at. */
function hgSwPrecache(cache, urls){
  var okCount = 0, failed = [];
  return Promise.all((urls || []).map(function(u){
    return cache.add(u).then(function(){ okCount++; },
                             function(){ failed.push(u); });
  })).then(function(){
    self.__hgPrecache = { cached: okCount, failed: failed, total: (urls || []).length };
    return self.__hgPrecache;
  });
}

self.addEventListener('install', function(ev){
  ev.waitUntil(
    caches.open(HG_CACHE)
      .then(function(c){ return hgSwPrecache(c, HG_SHELL); })
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
