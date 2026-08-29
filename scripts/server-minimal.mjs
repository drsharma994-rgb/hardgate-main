/* HARDGATE minimal proxy server for the pplx.app sandbox.
   pplx.app serves the static bundle from S3; this Node process handles only
   the same-origin API routes the browser needs (CoinDCX especially — it does
   NOT send `Access-Control-Allow-Origin`, so direct browser fetches 404 in
   effect). Zero deps, no filesystem writes, no external SDKs.

   Deliberately minimal: only proxies read-only market data.
   Mutating routes (/api/book, /api/execute, /api/xm/*) are NOT mounted here —
   they never should have been callable from a published static site anyway. */

import http from 'node:http';
import { createRequire } from 'node:module';
import { createCoindcxApi } from '../lib/coindcx-api.mjs';

const require = createRequire(import.meta.url);
const proxyHandler = require('../api/proxy.js');
const fredHandler = require('../api/fred.js');
const newsCalendarHandler = require('../api/news-calendar.js');

const coindcxHandler = createCoindcxApi();
const PORT = +(process.env.PORT || 8420);

function notFound(res){
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'not found' }));
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    const p = u.pathname;

    /* Preflight: this server responds to same-origin fetches, but pplx.app
       may proxy from a different edge origin. Be permissive on OPTIONS. */
    if (req.method === 'OPTIONS'){
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hardgate-Key, Authorization');
      res.statusCode = 204;
      return res.end();
    }

    if (p === '/api/proxy')                 return proxyHandler(req, res);
    if (p === '/api/fred')                  return fredHandler(req, res);
    if (p === '/api/news/calendar')         return newsCalendarHandler(req, res);
    if (p.startsWith('/api/coindcx/'))      return coindcxHandler(req, res);

    /* Health check for the sandbox — pplx.app's runtime polls SOMETHING to
       decide the backend is ready. Also nice for manual curl. */
    if (p === '/' || p === '/healthz'){
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, service: 'hardgate-minimal-proxy', routes: ['/api/proxy', '/api/fred', '/api/news/calendar', '/api/coindcx/*'] }));
    }

    return notFound(res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'server error', message: String(e && e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log('[hardgate-minimal] listening on :' + PORT);
});
