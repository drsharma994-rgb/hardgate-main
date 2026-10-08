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
import { startFormationNightlyWatch, formationNightlyWatchStatus } from './formation-nightly-watch.mjs';
import { createFormationNightlyApi } from '../lib/formation-nightly-api.mjs';
import { createPaperbookApi } from '../lib/paperbook-api.mjs';
import { createExecuteApi } from '../lib/execute-api.mjs';
import { createNotifyApi } from '../lib/notify-api.mjs';
import { createTradeosMcpApi } from '../lib/tradeos-mcp-api.mjs';
import { createOpenbbApi } from '../lib/openbb-api.mjs';
import { createCcxtApi } from '../lib/ccxt-market-api.mjs';
import { createHeyLensApi } from '../lib/hey-lens-api.mjs';
import { createHardgateMcpApi } from '../lib/hardgate-mcp-api.mjs';
import { createWorldmonitorApi } from '../lib/worldmonitor-api.mjs';
import { hgApiRateLimit } from '../lib/rate-limit.mjs';
import { createAgentApi } from '../lib/agent-api.mjs';
import { createTauricApi } from '../lib/tauric-api.mjs';
import { createAtomicAgentApi } from '../lib/atomic-agent-api.mjs';
import { createCoindcxApi } from '../lib/coindcx-api.mjs';
import { createChartVisionApi } from '../lib/chart-vision-api.mjs';
import { createXmTraderApi } from '../lib/xm-trader-api.mjs';
import { createTradingStackApi } from '../lib/trading-stack-api.mjs';
import { hgAssertCcxtBoot } from '../lib/hardgate-executor.mjs';

const require = createRequire(import.meta.url);
const proxyHandler = require('../api/proxy.js');
const fredHandler = require('../api/fred.js');
const coinalyzeHandler = require('../api/coinalyze.js');
const coinglassHandler = require('../api/coinglass.js');
const onchainAltHandler = require('../api/onchain-alt.js');
const newsCalendarHandler = require('../api/news-calendar.js');
const deltaPerpHistoryHandler = require('../api/delta-perp-history.js');
const fedCalendarHandler = require('../api/fed-calendar.js');

const ROOT = fileURLToPath(new URL('../', import.meta.url));   /* repo root (trailing sep) */
const PORT = +(process.env.PORT || 10000);
const paperbookHandler = createPaperbookApi(ROOT);
const formationNightlyHandler = createFormationNightlyApi();
const executeHandler = createExecuteApi();
const notifyHandler = createNotifyApi();
const tradeosHandler = createTradeosMcpApi();
const openbbHandler = createOpenbbApi();
const ccxtHandler = createCcxtApi();
const heyHandler = createHeyLensApi();
const hardgateMcpHandler = createHardgateMcpApi();
const worldmonitorHandler = createWorldmonitorApi();
const agentHandler = createAgentApi();
const tauricHandler = createTauricApi();
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
  'https://yields.llama.fi',                  /* borrow-rates.js DeFi borrow APR */
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


/* hg-v1083: OmniBTC's CLEAN crown becomes a TICKET only when the reads
   already computed for that crown are positive. The desk file is too large
   to replace whole, so the gate is spliced into the served script. A miss
   on any marker serves the file unchanged. */
function omnibtcTicketSource(src){
  const anchor = '  function hgObtcTheCallHtml(pick, snap){';
  const callOld = '        hgObtcPerfectFormation(pick, pfReads);\n        pick.row.perfectReads = pfReads;   /* the ledger reads the same bag the predicate consumed */';
  const cavOld = "      if (r.measuredStandAside) caveats.push('the measured record does not pay - stand aside');";
  if (src.indexOf('function hgObtcApplyTicketShape') >= 0) return src;
  if (src.indexOf(anchor) < 0 || src.indexOf(callOld) < 0 || src.indexOf(cavOld) < 0) return src;
  const gate = [
    '  /* hg-v1083: TICKET only on a positive read. Missing evidence is not a yes. */',
    '  function hgObtcApplyTicketShape(pick){',
    '    try{',
    '      if (!pick || !pick.row) return pick;',
    "      if (String(pick.tier || 'clean').toLowerCase() !== 'clean') return pick;",
    '      var r = pick.row, reads = r.perfectReads || {};',
    "      var dir = String(r.dir || '').toLowerCase();",
    '      var why = [];',
    '      var st = reads.structureTrend;',
    "      var structOk = (dir === 'long' && st === 'up') || (dir === 'short' && st === 'down');",
    "      if (!structOk) why.push(st ? ('structure ' + st) : 'structure unread');",
    "      if (reads.atrRegime !== 'HEALTHY') why.push(reads.atrRegime ? ('ATR ' + reads.atrRegime) : 'ATR unread');",
    "      if (reads.trendQuality !== 'TREND') why.push(reads.trendQuality ? ('tape ' + reads.trendQuality) : 'tape not a trend');",
    "      var grid = /SCALP|TRAP/i.test(String(r.engine || '') + ' ' + String(r.kind || '')) ? '15m WITH' : '4h WITH';",
    "      if (!reads.tfAgree || String(reads.tfAgree).indexOf(grid) < 0) why.push(grid === '15m WITH' ? '15m cascade not with' : '4h cascade not with');",
    "      if (!(typeof reads.costR === 'number' && isFinite(reads.costR) && reads.costR <= 0.25)) why.push((typeof reads.costR === 'number' && isFinite(reads.costR)) ? ('cost ' + reads.costR.toFixed(2) + 'R') : 'cost unread');",
    "      if (reads.fundingAgainst !== false) why.push(reads.fundingAgainst === true ? 'funding crowded' : 'funding unread');",
    "      if (reads.takerFlowVerdict !== 'with') why.push(reads.takerFlowVerdict ? ('flow ' + reads.takerFlowVerdict) : 'flow unread');",
    "      if (!(typeof reads.slotRvol === 'number' && isFinite(reads.slotRvol) && reads.slotRvol >= 0.7)) why.push((typeof reads.slotRvol === 'number' && isFinite(reads.slotRvol)) ? ('RVOL ' + reads.slotRvol.toFixed(2)) : 'RVOL unread');",
    '      var e = +r.entry, s = +r.stop, t1 = +r.t1, risk = Math.abs(e - s);',
    '      var rr = (isFinite(e) && isFinite(s) && isFinite(t1) && risk > 0) ? Math.abs(t1 - e) / risk : NaN;',
    "      if (!(isFinite(rr) && rr >= 2)) why.push(isFinite(rr) ? ('R:R ' + rr.toFixed(2)) : 'R:R unread');",
    '      var tilt = reads.macroTilt;',
    "      var macroOk = (dir === 'long' && tilt === 'RISK-ON') || (dir === 'short' && tilt === 'RISK-OFF');",
    "      if (!macroOk) why.push(tilt && tilt !== 'UNREAD' ? ('macro ' + tilt) : 'macro unread');",
    "      if (reads.newsRisk === 'blackout') why.push('event blackout');",
    '      if (!why.length) return pick;',
    "      pick.tier = 'near';",
    '      r.clean = false;',
    '      r.near = true;',
    '      r.nearClean = true;',
    '      r.watchOnly = true;',
    '      r.ticket = false;',
    "      r.obtcShapeWhy = why.join(', ');",
    '      return pick;',
    '    }catch(eSh){ return pick; }',
    '  }',
    ''
  ].join('\n');
  return src
    .replace(anchor, gate + anchor)
    .replace(callOld, callOld + '\n        hgObtcApplyTicketShape(pick);')
    .replace(cavOld, cavOld + "\n      if (r.obtcShapeWhy) caveats.push('not a ticket - ' + r.obtcShapeWhy);");
}


/* hg-v1157: the hg-v1085 / v1095 / v1098 gold gates used to be spliced into
   goldind.js, goldswing.js, goldscalp.js and omnigold.js HERE, at serve time,
   so the browser ran source the suite never booted (22 of 712 guards went red
   when booted on what the browser received, hg-v1156). They live in those
   files now and the four are served as plain static files like every other
   script. omnibtc.js (hg-v1083) is the one file still rewritten at serve time. */
function readSmallBody(req, max){
  return new Promise(function(resolve, reject){
    var chunks = [];
    var n = 0;
    req.on('data', function(c){
      n += c.length;
      if (n > max){ reject(new Error('body')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function(){ resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

/* Public TradingView crypto scanner. No account: the server posts the ticker
   and the technical summary comes back. The browser cannot call this host. */
async function tvScanHandler(req, res){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST'){ res.statusCode = 405; res.end('{"error":"POST"}'); return; }
  var raw = '';
  try { raw = await readSmallBody(req, 4000); }
  catch (e) { res.statusCode = 413; res.end('{"error":"body"}'); return; }
  var body;
  try { body = JSON.parse(raw || '{}'); }
  catch (e) { res.statusCode = 400; res.end('{"error":"json"}'); return; }
  var tickers = body && body.symbols && body.symbols.tickers;
  if (!Array.isArray(tickers) || !tickers.length || tickers.length > 2){
    res.statusCode = 400; res.end('{"error":"ticker"}'); return;
  }
  for (var i = 0; i < tickers.length; i++){
    if (!/^BINANCE:[A-Z0-9]{2,15}USDT(\.P)?$/.test(String(tickers[i]))){
      res.statusCode = 400; res.end('{"error":"ticker"}'); return;
    }
  }
  try {
    const upstream = await fetch('https://scanner.tradingview.com/crypto/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Hardgate/1.0' },
      body: JSON.stringify({
        symbols: { tickers: tickers },
        columns: ['Recommend.All', 'RSI', 'EMA20', 'EMA50', 'EMA200', 'ADX']
      })
    });
    const text = await upstream.text();
    res.statusCode = upstream.ok ? 200 : 502;
    res.end(text.slice(0, 20000));
  } catch (e) {
    res.statusCode = 502;
    res.end('{"error":"tradingview"}');
  }
}

const server = http.createServer(async (req, res) => {
  try{
    baseHeaders(res);
    const u = new URL(req.url || '/', 'http://localhost');
    /* Public /api/* volume guard (task #11): generous per-IP read budget, tight
       write budget, loopback exempt, env-tunable — HG_RATE_* in docs/ENV-VARS.md.
       Answers 429 + Retry-After instead of feeding the flood. */
    if (u.pathname.indexOf('/api/') === 0 && hgApiRateLimit(req, res)) return;
    if (u.pathname === '/api/proxy') return proxyHandler(req, res);
    if (u.pathname === '/api/fred') return fredHandler(req, res);
    if (u.pathname === '/api/coinalyze') return coinalyzeHandler(req, res);
    if (u.pathname === '/api/coinglass') return coinglassHandler(req, res);
    if (u.pathname === '/api/onchain-alt/desk') return onchainAltHandler(req, res);
    if (u.pathname === '/api/news/calendar') return newsCalendarHandler(req, res);
    if (u.pathname === '/api/delta/perp-history') return deltaPerpHistoryHandler(req, res);
    if (u.pathname === '/api/fed-calendar') return fedCalendarHandler(req, res);
    if (u.pathname === '/api/tv-scan') return tvScanHandler(req, res);
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
    if (u.pathname === '/api/formation-nightly' || u.pathname.indexOf('/api/formation-nightly/') === 0){
      if (u.pathname === '/api/formation-nightly/watch'){
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 200;
        return res.end(JSON.stringify(formationNightlyWatchStatus()));
      }
      return formationNightlyHandler(req, res);
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
    /* TAURIC — the TradingAgents (TauricResearch) multi-agent pipeline for
       XAUUSD, run out of process because it is Python and LLM-driven. */
    if (u.pathname === '/api/tauric' || u.pathname.indexOf('/api/tauric/') === 0){
      return tauricHandler(req, res);
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

    /* hg-v1080: /trendtable.js on disk is a fetch+eval loader. The page
       CSP (script-src 'self' 'unsafe-inline') refuses eval, so the loader
       never registers TREND MATRIX and the tab disappears. The real source
       is trendtable-src-N.js. Serve those parts, in order, as one classic
       script. If the parts are absent, fall through to the file on disk. */
    if (u.pathname === '/trendtable.js') {
      const chunks = [];
      for (let i = 0; i < 32; i++) {
        const part = path.join(ROOT, 'trendtable-src-' + i + '.js');
        if (!fs.existsSync(part)) break;
        chunks.push(fs.readFileSync(part));
      }
      if (chunks.length) {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.statusCode = 200;
        return res.end(Buffer.concat(chunks));
      }
    }


    /* hg-v1083: serve OmniBTC with the ticket-shape gate spliced in. */
    if (u.pathname === '/omnibtc.js') {
      const obFile = path.join(ROOT, 'omnibtc.js');
      if (fs.existsSync(obFile)) {
        const shaped = omnibtcTicketSource(fs.readFileSync(obFile, 'utf8'));
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.statusCode = 200;
        return res.end(shaped);
      }
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
    /* A MIXED BUNDLE IS WORSE THAN A SLOW ONE.

       index.html and sw.js were no-cache; every other asset was
       public, max-age=300. Only seventeen script tags carry a ?v= buster, so
       for five minutes after a release a browser could hold the NEW index.html
       and an OLD binance.js at the same time — a bundle that never existed in
       any commit and was never tested as a whole. On a desk that prices trades
       off those modules, that is a correctness hazard, not a staleness one.

       Observed while verifying v460: the server served hg-v460 to curl while
       the page reported hg-v459 across two reloads, having pinned the
       unversioned files.

       no-cache does NOT mean no caching. The browser still stores the file and
       still revalidates with If-None-Match; an unchanged asset comes back 304
       with no body, so the cost is one conditional request per asset per load
       and the bytes are saved exactly as before. The service worker continues
       to serve the offline shell, which is where real offline caching belongs
       — and its HG_CACHE is versioned, so it swaps atomically rather than
       file by file. */
    /* A tab that loaded an old stamp polls build-stamp.js?fresh= and then
       refuses a second reload. For a short window, that exact request
       clears the saved copy and reloads the tab. The current page polls
       ?live= and is left alone. The window ends on its own. */
    res.setHeader('Cache-Control', 'no-store');
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
startFormationNightlyWatch();

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
