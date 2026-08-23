/* HARDGATE — Render web service: static app + same-origin /api/proxy.
   Replaces the Vercel hosting 1:1: every static file served from the repo
   root, and the existing CommonJS proxy handler mounted unchanged (it already
   supports a plain Node req/res — see its manual url-parse fallback).
   Zero deps, Node 18+ global fetch. Never throws at load. */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startSqueezeWatch, squeezeWatchStatus } from './squeeze-watch.mjs';
import { startAgentWatch, agentWatchStatus } from '../lib/agent-watch.mjs';
import { startGhDispatch, ghDispatchStatus } from './gh-dispatch.mjs';
import { startBookDigestWatch, bookDigestWatchStatus } from './book-digest-watch.mjs';
import { createPaperbookApi } from '../lib/paperbook-api.mjs';
import { createExecuteApi } from '../lib/execute-api.mjs';
import { createNotifyApi } from '../lib/notify-api.mjs';
import { createTradeosMcpApi } from '../lib/tradeos-mcp-api.mjs';
import { createOpenbbApi } from '../lib/openbb-api.mjs';
import { createCcxtApi } from '../lib/ccxt-market-api.mjs';
import { createHeyLensApi } from '../lib/hey-lens-api.mjs';
import { createHardgateMcpApi } from '../lib/hardgate-mcp-api.mjs';
import { createWorldmonitorApi } from '../lib/worldmonitor-api.mjs';
import { createAgentApi } from '../lib/agent-api.mjs';
import { createAtomicAgentApi } from '../lib/atomic-agent-api.mjs';
import { createCoindcxApi } from '../lib/coindcx-api.mjs';
import { createChartVisionApi } from '../lib/chart-vision-api.mjs';
import { createXmTraderApi } from '../lib/xm-trader-api.mjs';
import { createTradingStackApi } from '../lib/trading-stack-api.mjs';
import { hgAssertCcxtBoot } from '../lib/hardgate-executor.mjs';

const require = createRequire(import.meta.url);
const proxyHandler = require('../api/proxy.js');
const fredHandler = require('../api/fred.js');
const newsCalendarHandler = require('../api/news-calendar.js');

const ROOT = fileURLToPath(new URL('../', import.meta.url));   /* repo root (trailing sep) */
const PORT = +(process.env.PORT || 10000);
const paperbookHandler = createPaperbookApi(ROOT);
const executeHandler = createExecuteApi();
const notifyHandler = createNotifyApi();
const tradeosHandler = createTradeosMcpApi();
const openbbHandler = createOpenbbApi();
const ccxtHandler = createCcxtApi();
const heyHandler = createHeyLensApi();
const hardgateMcpHandler = createHardgateMcpApi();
const worldmonitorHandler = createWorldmonitorApi();
const agentHandler = createAgentApi();
const atomicHandler = createAtomicAgentApi();
const coindcxHandler = createCoindcxApi();
const chartVisionHandler = createChartVisionApi();
const xmTraderHandler = createXmTraderApi();
const tradingStackHandler = createTradingStackApi();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

/* THE ONE connect-src ALLOWLIST.

   Every host the browser is allowed to reach. It lived as one long inline
   string here and a second hand-maintained copy in vercel.json, and the two
   drifted: server.mjs gained api.hyperliquid.xyz, api.worldmonitor.app and
   generativelanguage.googleapis.com, vercel.json never did — so the same
   commit worked on Render and lost three feeds on Vercel, silently, because
   a CSP block is a console message and not a failed test.

   It is a list now, one host per line with the module that needs it, and
   tests/test-csp-allowlist.mjs asserts vercel.json carries exactly the same
   set. Adding a host to one file and not the other fails the suite. */
const CONNECT_SRC = [
  "'self'",
  'https://api.emailjs.com',                  /* alerts.js — email pushes */
  'https://api.india.delta.exchange',         /* xuniverse.js, positioning.js */
  'https://api.delta.exchange',
  'https://fapi.binance.com',                 /* binance.js */
  'https://api.binance.com',
  'https://www.deribit.com',                  /* deribit-vol.js — DVOL implied-vol regime */
  'https://mempool.space',                    /* onchain.js — five BTC on-chain legs */
  'https://api.bybit.com',                    /* bybit.js — v5 linear perp OI + tickers */
  'https://api.twelvedata.com',               /* macro.js — XAU/XAG gold fallback */
  'https://api.gold-api.com',                 /* macro.js gold spot */
  'https://api.frankfurter.app',              /* macro.js FX */
  'https://api.frankfurter.dev',
  'https://api.alternative.me',               /* regime.js Fear & Greed */
  'https://api.coingecko.com',                /* regime.js global cap */
  'https://stablecoins.llama.fi',             /* regime.js stablecoin supply */
  'https://home.treasury.gov',                /* macro.js yield curve */
  'https://api.hyperliquid.xyz',              /* worldmonitor-desk.js */
  'https://api.worldmonitor.app',
  'https://generativelanguage.googleapis.com',/* chart-vision-desk.js — Gemini */
  'wss://public-socket.india.delta.exchange', /* delta live ticks */
  'wss://socket.india.delta.exchange',
  'wss://fstream.binance.com',                /* liqs.js — !forceOrder liquidation tape */
  'https://ntfy.sh',                          /* tabalerts.js push */
].join(' ');

/* vercel.json parity — security headers on every response */
function baseHeaders(res){
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    /* No third-party script host. lightweight-charts and @emailjs/browser were the
       only two, and they are vendored under ./vendor now — so a CDN can no longer
       execute code in this page, and a future edit that re-adds a CDN tag fails
       loudly here instead of silently working. */
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "connect-src " + CONNECT_SRC,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '));
}

const server = http.createServer(async (req, res) => {
  try{
    baseHeaders(res);
    const u = new URL(req.url || '/', 'http://localhost');
    if (u.pathname === '/api/proxy') return proxyHandler(req, res);
    if (u.pathname === '/api/fred') return fredHandler(req, res);
    if (u.pathname === '/api/news/calendar') return newsCalendarHandler(req, res);
    /* squeeze-watch status: armed? last cycle? fires? — no secrets, counts only */
    if (u.pathname === '/api/squeeze-watch'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      return res.end(JSON.stringify(squeezeWatchStatus()));
    }
    if (u.pathname === '/api/agent-watch'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      return res.end(JSON.stringify(agentWatchStatus()));
    }
    /* gh-dispatch status: armed? last dispatch result? — no secrets, counts only */
    if (u.pathname === '/api/gh-dispatch'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      return res.end(JSON.stringify(ghDispatchStatus()));
    }
    if (u.pathname === '/api/book-digest-watch'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      return res.end(JSON.stringify(bookDigestWatchStatus()));
    }
    if (u.pathname === '/api/book' || u.pathname.indexOf('/api/book/') === 0){
      return paperbookHandler(req, res);
    }
    if (u.pathname === '/api/notify' || u.pathname === '/api/notify/capabilities'){
      return notifyHandler(req, res);
    }
    if (u.pathname === '/api/execute' || u.pathname.indexOf('/api/execute/') === 0){
      return executeHandler(req, res);
    }
    if (u.pathname === '/api/tradeos' || u.pathname.indexOf('/api/tradeos/') === 0){
      return tradeosHandler(req, res);
    }
    if (u.pathname === '/api/openbb' || u.pathname.indexOf('/api/openbb/') === 0){
      return openbbHandler(req, res);
    }
    if (u.pathname === '/api/ccxt' || u.pathname.indexOf('/api/ccxt/') === 0){
      return ccxtHandler(req, res);
    }
    if (u.pathname === '/api/hey' || u.pathname.indexOf('/api/hey/') === 0){
      return heyHandler(req, res);
    }
    if (u.pathname === '/api/hardgate' || u.pathname.indexOf('/api/hardgate/') === 0){
      return hardgateMcpHandler(req, res);
    }
    if (u.pathname === '/api/worldmonitor' || u.pathname.indexOf('/api/worldmonitor/') === 0){
      return worldmonitorHandler(req, res);
    }
    if (u.pathname === '/api/agents' || u.pathname.indexOf('/api/agents/') === 0){
      return agentHandler(req, res);
    }
    if (u.pathname === '/api/atomic' || u.pathname.indexOf('/api/atomic/') === 0){
      return atomicHandler(req, res);
    }
    if (u.pathname === '/api/coindcx' || u.pathname.indexOf('/api/coindcx/') === 0){
      return coindcxHandler(req, res);
    }
    if (u.pathname === '/api/xm' || u.pathname.indexOf('/api/xm/') === 0){
      return xmTraderHandler(req, res);
    }
    if (u.pathname === '/api/trading-stack' || u.pathname.indexOf('/api/trading-stack/') === 0){
      return tradingStackHandler(req, res);
    }
    if (u.pathname === '/api/chart-vision' || u.pathname.indexOf('/api/chart-vision/') === 0){
      return chartVisionHandler(req, res);
    }

    /* static: resolve safely inside ROOT, index.html at '/', cleanUrls-style
       .html fallback (/x -> /x.html), no directory listings */
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()){
      if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
      else { res.statusCode = 404; return res.end('not found'); }
    }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    /* the service worker + entry html must always revalidate; everything else
       gets a short cache, mirroring the proxy's s-maxage spirit */
    res.setHeader('Cache-Control',
      (ext === '.html' || p.endsWith('/sw.js')) ? 'no-cache' : 'public, max-age=300');
    fs.createReadStream(file).pipe(res);
  }catch(e){
    try{ res.statusCode = 500; res.end('server error'); }catch(e2){}
  }
});

server.listen(PORT, function(){
  console.log('HARDGATE listening on :' + PORT);
  if (typeof newsCalendarHandler.warmNewsCalendar === 'function'){
    setTimeout(function(){
      newsCalendarHandler.warmNewsCalendar().then(function(ok){
        console.log('[news] calendar warm ' + (ok ? 'ok' : 'deferred (will retry on first tab open)'));
      }).catch(function(){});
    }, 1200);
  }
});

hgAssertCcxtBoot().then(function(r){
  if (!r.ok) console.error('[EXEC FATAL] ' + r.reason);
}).catch(function(e){
  console.error('[EXEC FATAL] ccxt boot check failed', e && e.message);
});

/* 5-minute fired-squeeze Telegram watch (arms only with TELEGRAM_TOKEN +
   TELEGRAM_CHAT_ID in the environment; logs its status either way) */
startSqueezeWatch();

startAgentWatch();

/* GitHub cron replacement: fires alert-notify.yml via workflow_dispatch every
   13 min (arms only with GH_DISPATCH_TOKEN in the environment; logs either way) */
startGhDispatch();

startBookDigestWatch();

/* Optional co-located daemon (dev / single-service): HARDGATE_DAEMON_AUTOSTART=1 */
if (process.env.HARDGATE_DAEMON_AUTOSTART === '1' || process.env.HARDGATE_DAEMON_AUTOSTART === 'true'){
  try{
    var daemonPath = fileURLToPath(new URL('../app.js', import.meta.url));
    var child = fork(daemonPath, [], { stdio: 'inherit', env: process.env });
    child.on('exit', function(code){
      console.warn('[daemon] exited with code ' + code);
    });
    console.log('[daemon] autostart forked — app.js (set HARDGATE_DAEMON_AUTOSTART=0 to disable)');
  }catch(e){
    console.warn('[daemon] autostart failed:', (e && e.message) || e);
  }
}

/* keep-alive self-ping — on Render free tier the service sleeps after ~15 min idle.
   Paid plans stay always-on; the ping is harmless and keeps squeeze-watch + gh-dispatch
   alive on any plan. Uses Render's injected RENDER_EXTERNAL_URL; override with
   SELF_PING_URL if ever needed. Honest no-op outside Render. */
(function keepAlive(){
  const base = process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL;
  if (!base){ console.log('[keep-alive] disabled — no RENDER_EXTERNAL_URL in the environment'); return; }
  const url = base.replace(/\/+$/, '') + '/api/squeeze-watch';
  const ping = async () => {
    try{ const r = await fetch(url); console.log('[keep-alive] ping ' + r.status); }
    catch(e){ console.warn('[keep-alive] ping failed (next in 10 min): ' + ((e && e.message) || e)); }
  };
  setTimeout(ping, 60000).unref?.();              /* first ping 1 min after boot */
  const t = setInterval(ping, 10 * 60 * 1000);    /* then every 10 min (< 15 min sleep threshold) */
  try{ t.unref(); }catch(e){}
  console.log('[keep-alive] armed — self-ping every 10 min → ' + url);
})();
