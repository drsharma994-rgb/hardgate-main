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
import { hgAssertCcxtBoot } from '../lib/hardgate-executor.mjs';

const require = createRequire(import.meta.url);
const proxyHandler = require('../api/proxy.js');
const fredHandler = require('../api/fred.js');

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

/* vercel.json parity — security headers on every response */
function baseHeaders(res){
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "connect-src 'self' https://api.india.delta.exchange https://api.delta.exchange https://fapi.binance.com https://api.binance.com https://api.gold-api.com https://api.frankfurter.app https://api.alternative.me https://api.coingecko.com https://stablecoins.llama.fi https://home.treasury.gov https://api.hyperliquid.xyz https://api.worldmonitor.app wss://public-socket.india.delta.exchange wss://socket.india.delta.exchange https://ntfy.sh",
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
    /* squeeze-watch status: armed? last cycle? fires? — no secrets, counts only */
    if (u.pathname === '/api/squeeze-watch'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      return res.end(JSON.stringify(squeezeWatchStatus()));
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

server.listen(PORT, () => console.log('HARDGATE listening on :' + PORT));

hgAssertCcxtBoot().then(function(r){
  if (!r.ok) console.error('[EXEC FATAL] ' + r.reason);
}).catch(function(e){
  console.error('[EXEC FATAL] ccxt boot check failed', e && e.message);
});

/* 5-minute fired-squeeze Telegram watch (arms only with TELEGRAM_TOKEN +
   TELEGRAM_CHAT_ID in the environment; logs its status either way) */
startSqueezeWatch();

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
