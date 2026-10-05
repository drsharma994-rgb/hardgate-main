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


/* hg-v1085: gold tickets need a live dollar and a live 10-year, both with
   the trade. The desk files are too large to replace whole, so the gate is
   spliced into the served script. A miss on any marker serves the file
   unchanged. */
function goldLiveSource(kind, src){
  if (kind === 'goldind'){
    const anchor = '    cand.macroLock = macro;\n    if (macro.lock){';
    const gate = [
      '    cand.macroLock = macro;',
      "    if (macro && macro.lock !== true && (dir === 'long' || dir === 'short')){",
      "      var dxyWith = (dir === 'long') ? (macro.dxyBear === true) : (macro.dxyBull === true);",
      "      var tnxWith = (dir === 'long') ? (macro.tnxBear === true) : (macro.tnxBull === true);",
      '      if (!(dxyWith && tnxWith) && !(scalp && ctx.hardReject === false)){',
      '        var bits = [];',
      "        if (!dxyWith) bits.push((macro.dxyBull == null && macro.dxyBear == null) ? 'DXY unread' : ('DXY not with this gold ' + dir));",
      "        if (!tnxWith) bits.push((macro.tnxBull == null && macro.tnxBear == null) ? 'US10Y unread' : ('US10Y not with this gold ' + dir));",
      "        macro.reason = 'GOLD FEED — ' + bits.join('; ') + '. The live dollar and the live 10-year must both agree. A quiet feed is not a yes.';",
      '        macro.lock = true;',
      '      }',
      '    }',
      '    if (macro.lock){'
    ].join('\n');
    if (src.indexOf('GOLD FEED — ') < 0 && src.indexOf(anchor) >= 0) src = src.replace(anchor, gate);
    const rrAnchor = '    if (macro.lock){\n      cand.dropped = true;\n      cand.reason = macro.reason;\n      return cand;\n    }\n    if (key === \'sweep\'){';
    const rrGate = [
      '    if (macro.lock){',
      '      cand.dropped = true;',
      '      cand.reason = macro.reason;',
      '      return cand;',
      '    }',
      "    if (scalp && (dir === 'long' || dir === 'short')){",
      '      var rrM = (ctx.macro && ctx.macro.realRateMeasured) || null;',
      "      var rrT = (rrM && rrM.measured && rrM.trend) ? String(rrM.trend).toUpperCase() : '';",
      "      var rrWith = (dir === 'long') ? (rrT.indexOf('FALL') >= 0) : (rrT.indexOf('RIS') >= 0);",
      "      var rrFlat = rrT.indexOf('FLAT') >= 0;",
      '      if (rrT && !rrWith && !rrFlat){',
      '        cand.demoted = true;',
      '        if (!Array.isArray(cand.stamps)) cand.stamps = [];',
      "        if (cand.stamps.indexOf('REAL YIELD') < 0) cand.stamps.push('REAL YIELD');",
      '        var gnRr = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];',
      "        var rrWhy = rrT ? ('REAL YIELD — FRED DFII10 is ' + rrT + ', not with this gold ' + dir + '.') : 'REAL YIELD UNREAD — FRED DFII10 did not load. A missing real yield is not a tailwind.';",
      '        gnRr.push(rrWhy);',
      '        cand.gateNotes = gnRr;',
      '        cand.reason = rrWhy;',
      '      }',
      '    }',
      "    if (key === 'sweep'){"
    ].join('\n');
    if (src.indexOf('REAL YIELD') < 0 && src.indexOf(rrAnchor) >= 0) src = src.replace(rrAnchor, rrGate);
    return src;
  }
  if (kind === 'goldscalp'){
    const anchor = "    var news = null;\n    var ns = gfn('hgNewsState');\n    if (ns){ try{ news = ns(); }catch(eN){ news = null; } }";
    const gate = [
      '    var news = null;',
      '    try{',
      '      await Promise.race([',
      '        (async function(){',
      "          var nref = gfn('hgNewsRefresh');",
      '          if (nref) await Promise.race([Promise.resolve(nref(false)), new Promise(function(res){ setTimeout(res, 4000); })]);',
      "          var ns0 = gfn('hgNewsState');",
      '          if (ns0){ try{ news = ns0(); }catch(eN0){ news = null; } }',
      '          try{',
      '            if (news && news.fng && isFinite(+news.fng.value) && typeof S !== "undefined" && S && !S.fng){',
      '              S.fng = { v: +news.fng.value, c: String(news.fng.classification || "") };',
      '            }',
      '          }catch(eFg){}',
      '          try{',
      '            if (typeof S !== "undefined" && S && !S.fng && typeof fetch === "function"){',
      '              var fj = await Promise.race([',
      '                fetch("https://api.alternative.me/fng/?limit=1").then(function(r){ return r && r.ok ? r.json() : null; }),',
      '                new Promise(function(res){ setTimeout(function(){ res(null); }, 4000); })',
      '              ]);',
      '              var fd = fj && fj.data && fj.data[0];',
      '              if (fd && isFinite(+fd.value)) S.fng = { v: +fd.value, c: String(fd.value_classification || "") };',
      '            }',
      '          }catch(eFg2){}',
      '        })(),',
      '        (async function(){',
      '          if (!(typeof W !== "undefined" && W && !W.__hgGoldCot && typeof W.hgGoldCotParse === "function" && typeof W.hgGoldCotAssess === "function" && typeof fetch === "function")) return;',
      '          var cotUrl = "/api/proxy?url=" + encodeURIComponent("https://publicreporting.cftc.gov/resource/jun7-fc8e.json?$limit=160&$order=report_date_as_yyyy_mm_dd%20DESC&$where=market_and_exchange_names=%27GOLD%20-%20COMMODITY%20EXCHANGE%20INC.%27");',
      '          var cotRows = await Promise.race([',
      '            fetch(cotUrl).then(function(r){ return r && r.ok ? r.json() : null; }),',
      '            new Promise(function(res){ setTimeout(function(){ res(null); }, 6000); })',
      '          ]);',
      '          if (Array.isArray(cotRows)) W.__hgGoldCot = W.hgGoldCotAssess(W.hgGoldCotParse(cotRows));',
      '        })(),',
      '        (async function(){',
      "          var gsWarmFn = gfn('hgGoldSpotWarm');",
      '          if (gsWarmFn) await Promise.resolve(gsWarmFn());',
      '        })(),',
      '        new Promise(function(res){ setTimeout(res, 8000); })',
      '      ]);',
      '    }catch(eFeed){}',
      "    var ns = gfn('hgNewsState');",
      '    if (ns){ try{ news = ns() || news; }catch(eN){} }'
    ].join('\n');
    if (src.indexOf("hgGoldSpotWarm") < 0 && src.indexOf(anchor) >= 0) src = src.replace(anchor, gate);
    const macroAnchor = "        ctx.macro = await Promise.race([\n          Promise.resolve().then(function(){ return gm(); }),\n          new Promise(function(r){ setTimeout(function(){ r(null); }, 12000); })\n        ]);";
    const macroGate = macroAnchor + "\n        if (!ctx.macro){ var gmc = gfn('getGoldMacroCached'); if (gmc){ try{ ctx.macro = gmc() || null; }catch(eMc){ ctx.macro = null; } } }";
    if (src.indexOf("getGoldMacroCached") < 0 && src.indexOf(macroAnchor) >= 0) src = src.replace(macroAnchor, macroGate);
    const bundleAnchor = "    if (ctx.macro) scalpBundle.macro = ctx.macro;\n    if (ctx.macro && ctx.macro.us10yCandles) scalpBundle.us10yCandles = ctx.macro.us10yCandles;";
    const bundleGate = bundleAnchor + "\n    if (ctx.macro && ctx.macro.tnxRows && !scalpBundle.us10yCandles) scalpBundle.us10yCandles = ctx.macro.tnxRows;\n    if (ctx.macro && ctx.macro.dxyRows && !scalpBundle.dxyCandles) scalpBundle.dxyCandles = ctx.macro.dxyRows;\n    if (ctx.macro && ctx.macro.tnxRows && !scalpBundle.tnxRows) scalpBundle.tnxRows = ctx.macro.tnxRows;\n    if (ctx.macro && ctx.macro.dxyRows && !scalpBundle.dxyRows) scalpBundle.dxyRows = ctx.macro.dxyRows;";
    if (src.indexOf("scalpBundle.dxyRows") < 0 && src.indexOf(bundleAnchor) >= 0) src = src.replace(bundleAnchor, bundleGate);
    const mountAnchor = "function mount(el){\n  if (!el) return;\n  try{ goldscalpMountInto(el, __scan, { prefix: 'gs', showDeskNote: true }); }catch(e){ /* never throw at mount */ }\n}";
    const mountGate = [
      'function mount(el){',
      '  if (!el) return;',
      "  try{ goldscalpMountInto(el, __scan, { prefix: 'gs', showDeskNote: true }); }catch(e){}",
      '  try{',
      '    var kickN = 0;',
      '    var kick = function(){',
      '      if (!__scan || !__scan.ui) return;',
      '      if (__scan.busy && kickN < 40){ kickN++; setTimeout(kick, 400); return; }',
      '      if (!__scan.busy) runScan(__scan.ui, __scan);',
      '    };',
      '    kick();',
      '  }catch(eRun){}',
      '}'
    ].join('\n');
    if (src.indexOf('kickN') < 0 && src.indexOf(mountAnchor) >= 0) src = src.replace(mountAnchor, mountGate);
    const openAnchor = "    var gold = stRoute ? await fetchStartraderGoldKlines() : await fetchGoldKlines();";
    const openGate = openAnchor + "\n    try{\n      var gsStrip = function(rows, sec){\n        if (!rows || rows.length < 31) return rows;\n        var last = rows[rows.length - 1];\n        if (!last || !isFinite(+last.t)) return rows;\n        var t = +last.t;\n        if (t > 1e12) t = Math.floor(t / 1000);\n        if (t + sec > Math.floor(Date.now() / 1000)) return rows.slice(0, -1);\n        return rows;\n      };\n      gold.rows15m = gsStrip(gold.rows15m, 900);\n      gold.rows1h = gsStrip(gold.rows1h, 3600);\n      gold.rows4h = gsStrip(gold.rows4h, 14400);\n      gold.rows1d = gsStrip(gold.rows1d, 86400);\n    }catch(eStrip){}";
    if (src.indexOf('gsStrip') < 0 && src.indexOf(openAnchor) >= 0) src = src.replace(openAnchor, openGate);
    const accAnchor = "    if (isFinite(liveSpot) && isFinite(klineSpot) && Math.abs(klineSpot / liveSpot - 1) * 100 > 0.5){\n      goldAlignLevelsToSpot(ranked, klineSpot, liveSpot);\n    }";
    const accGate = accAnchor + `
    try{
      var gsAcc = 0;
      for (var ai = 0; ai < ranked.length; ai++){
        var ac = ranked[ai];
        if (!ac || ac.vetoed) continue;
        var whyA = [];
        var sk = String(ac.stratKey || '');
        if (sk !== 'p6fail' && sk !== 'p9volbar'){
          if (sk === 'bosalign' || sk === 'ribbon') whyA.push('ACCURACY — walk-forward did not hold, so this is not the scalp.');
          else whyA.push('ACCURACY — only a failed-break reversal or a volume-bar sweep has held up. This is not the scalp.');
        }
        var dirA = String(ac.dir || '');
        var entryA = +ac.entry, stopA = +ac.stop, t1A = +ac.t1;
        if (dirA === 'long' || dirA === 'short'){
          if (!(isFinite(entryA) && isFinite(stopA) && isFinite(t1A))) whyA.push('ACCURACY — entry, stop, or target is not a number.');
          else if (dirA === 'long' && !(stopA < entryA && t1A > entryA)) whyA.push('ACCURACY — long levels are on the wrong side of entry.');
          else if (dirA === 'short' && !(stopA > entryA && t1A < entryA)) whyA.push('ACCURACY — short levels are on the wrong side of entry.');
          else {
            var riskA = Math.abs(entryA - stopA);
            var rrA = riskA > 0 ? Math.abs(t1A - entryA) / riskA : 0;
            if (!(rrA >= 1.2)) whyA.push('ACCURACY — reward is ' + rrA.toFixed(2) + 'R, under the 1.2R scalp floor.');
          }
        }
        var mdA = ctx.macro || null;
        var dxyT = (mdA && mdA.dxy && mdA.dxy.trend20) ? String(mdA.dxy.trend20) : '';
        var tnxT = (mdA && mdA.tnxTrend) ? String(mdA.tnxTrend) : '';
        var ryT = (mdA && mdA.realRateMeasured && mdA.realRateMeasured.trend) ? String(mdA.realRateMeasured.trend).toUpperCase() : '';
        if (dirA === 'long' && dxyT === 'RISING' && tnxT === 'RISING') whyA.push('ACCURACY — dollar and 10-year are both rising. A gold long is the wrong scalp.');
        if (dirA === 'short' && dxyT === 'FALLING' && tnxT === 'FALLING') whyA.push('ACCURACY — dollar and 10-year are both falling. A gold short is the wrong scalp.');
        if (dirA === 'long' && ryT.indexOf('RIS') >= 0) whyA.push('ACCURACY — real yield is rising. A gold long is the wrong scalp.');
        if (dirA === 'short' && ryT.indexOf('FALL') >= 0) whyA.push('ACCURACY — real yield is falling. A gold short is the wrong scalp.');
        if (!whyA.length) continue;
        ac.demoted = true;
        if (!Array.isArray(ac.stamps)) ac.stamps = [];
        if (ac.stamps.indexOf('ACCURACY') < 0) ac.stamps.push('ACCURACY');
        var gnA = Array.isArray(ac.gateNotes) ? ac.gateNotes.slice() : [];
        for (var wiA = 0; wiA < whyA.length; wiA++){ if (gnA.indexOf(whyA[wiA]) < 0) gnA.push(whyA[wiA]); }
        ac.gateNotes = gnA;
        if (!ac.reason) ac.reason = whyA[0];
        gsAcc++;
      }
      if (gsAcc) legs.push('ACCURACY — ' + gsAcc + ' scalp' + (gsAcc === 1 ? '' : 's') + ' cannot lead');
    }catch(eAcc){}`;
    if (src.indexOf('walk-forward did not hold') < 0 && src.indexOf(accAnchor) >= 0) src = src.replace(accAnchor, accGate);
    const ttlAnchor = "var CONVICTION_TTL_MS = 6*60*60*1000;";
    const ttlGate = "var CONVICTION_TTL_MS = 90*60*1000;";
    if (src.indexOf(ttlGate) < 0 && src.indexOf(ttlAnchor) >= 0) src = src.replace(ttlAnchor, ttlGate);
    const relAnchor = "    var lock = applyConviction(ranked, venueRows, now, entryVeto);";
    const relGate = relAnchor + "\n    try{\n      if (lock && lock.store && lock.store.live){\n        for (var ri = 0; ri < ranked.length; ri++){\n          var rc = ranked[ri];\n          if (!rc || !rc.id) continue;\n          var accFail = Array.isArray(rc.stamps) && rc.stamps.indexOf('ACCURACY') >= 0;\n          if (!accFail) continue;\n          delete lock.store.live[rc.id];\n          if (rc.venue) delete lock.store.live[rc.venue + '|' + rc.id];\n          rc.locked = false;\n          if (!rc.reason) rc.reason = 'ACCURACY — this scalp is not valid on the closed bar.';\n        }\n        if (typeof saveConvictions === 'function') saveConvictions(lock.store);\n      }\n    }catch(eRel){}";
    if (src.indexOf('not valid on the closed bar') < 0 && src.indexOf(relAnchor) >= 0) src = src.replace(relAnchor, relGate);
    return src;
  }
  if (kind === 'goldswing'){
    const anchor = '    function push(c){\n      if (!c) return;\n      if (c.dropped){ out.rejected.push(c); return; }';
    const gate = [
      '    function push(c){',
      '      if (!c) return;',
      "      if (c.dir === 'long' || c.dir === 'short'){",
      '        var dxyT = (macro && macro.dxy && macro.dxy.trend20) || null;',
      '        var tnxT = (macro && macro.tnxTrend) || null;',
      "        var feedOk = (c.dir === 'long') ? (dxyT === 'FALLING' && tnxT === 'FALLING') : (dxyT === 'RISING' && tnxT === 'RISING');",
      '        if (!feedOk){',
      '          c.dropped = true;',
      '          var miss = [];',
      "          if (c.dir === 'long'){",
      "            if (dxyT !== 'FALLING') miss.push(dxyT ? ('DXY ' + dxyT) : 'DXY unread');",
      "            if (tnxT !== 'FALLING') miss.push(tnxT ? ('US10Y ' + tnxT) : 'US10Y unread');",
      '          } else {',
      "            if (dxyT !== 'RISING') miss.push(dxyT ? ('DXY ' + dxyT) : 'DXY unread');",
      "            if (tnxT !== 'RISING') miss.push(tnxT ? ('US10Y ' + tnxT) : 'US10Y unread');",
      '          }',
      "          c.reason = 'GOLD FEED — ' + miss.join(', ') + '. A gold ' + c.dir + ' needs the live dollar and the live 10-year both with it.';",
      '        }',
      '      }',
      '      if (c.dropped){ out.rejected.push(c); return; }'
    ].join('\n');
    if (src.indexOf('needs the live dollar') >= 0) return src;
    if (src.indexOf(anchor) < 0) return src;
    return src.replace(anchor, gate);
  }
  if (kind === 'omnigold'){
    const anchor = [
      '    if (!isFinite(dxyValue)) dxyValue = 103;   /* fallback */',
      '    if (!isFinite(correlation)) correlation = -0.92;   /* fallback */',
      '    if (!isFinite(beta)) beta = -0.95;   /* fallback */',
      '    if (!isFinite(realRate)) realRate = 2.1;   /* fallback */'
    ].join('\n');
    const gate = [
      '    if (!isFinite(dxyValue) || !isFinite(correlation) || !isFinite(beta) || !isFinite(realRate)){',
      "      return { regime: 'UNREAD', dxyValue: dxyValue, correlation: correlation, beta: beta, realRate: realRate, reason: 'DXY or real-rate feed unread. A missing internet print is not a normal gold regime' };",
      '    }'
    ].join('\n');
    if (src.indexOf('not a normal gold regime') < 0 && src.indexOf(anchor) >= 0) src = src.replace(anchor, gate);
    /* hg-v1099: the lead is this tab's own measured ledger. An engine grade,
       and a past winner sitting against today's tape, are not the crown. */
    if (src.indexOf('function hgOgLeadMeasOk') < 0){
      const pickFn = '  function hgOgPickFor(ranked, horizon, tapeDir){';
      const leadFn = [
        '  function hgOgLeadMeasOk(c){',
        '    try{',
        '      if (!c || !c.kind) return false;',
        '      var fwdPaid = null;',
        '      try { fwdPaid = hgOgForwardPaid(c.kind, c.horizon); } catch (eFp) { fwdPaid = null; }',
        "      if (fwdPaid && fwdPaid.read === 'has paid') return true;",
        '      var ev = hgOgReplayEvidence(c.kind);',
        '      if (!ev || !(fin(ev.n) >= MIN_SAMPLES)) return false;',
        '      var priced = null;',
        '      try { priced = hgOgReplayNetAtVenue(ev); } catch (ePx) { priced = null; }',
        '      var net = (priced && isFinite(fin(priced.net))) ? fin(priced.net) : NaN;',
        '      if (!(net > 0)) return false;',
        '      var hit = fin(ev.winRate), n = fin(ev.n);',
        '      if (!isFinite(hit) || !(n > 0)) return false;',
        '      var pBreak = 1 / (1 + OG_T1_R);',
        '      var se = Math.sqrt(pBreak * (1 - pBreak) / n);',
        '      var z = se > 0 ? ((hit - pBreak) / se) : 0;',
        '      return z >= hgOgFamilyZ(OG_MECHANICS.length);',
        '    }catch(eLm){ return false; }',
        '  }',
        '  function hgOgPickFor(ranked, horizon, tapeDir){'
      ].join('\n');
      if (src.indexOf(pickFn) < 0) return src;
      src = src.replace(pickFn, leadFn);
    }
    const fund = '      if (c.fundGate && (c.fundGate.refuse === true || c.fundGate.demote === true)) continue;';
    const fundGate = fund + '\n      if (!hgOgLeadMeasOk(c)) continue;';
    if (src.indexOf('if (!hgOgLeadMeasOk(c)) continue;') < 0 && src.indexOf(fund) >= 0) src = src.replace(fund, fundGate);
    src = src.replace('tapeOverride: true /* v687 omnigold-only opt-in */', 'tapeOverride: false /* v1099: a past winner against the tape is not put on top */');
    const eng = [
      '          var engineScalp = !pickScalp ? hgOgPickGoldEngineForMp(bridge, HORIZONS.scalp.label, scalpTape) : null;',
      '          var engineSwing = !pickSwing ? hgOgPickGoldEngineForMp(bridge, HORIZONS.swing.label, swingTape) : null;'
    ].join('\n');
    const engOff = [
      '          var engineScalp = null; /* v1099: the ledger is the only lead */',
      '          var engineSwing = null;'
    ].join('\n');
    if (src.indexOf(eng) >= 0) src = src.replace(eng, engOff);
    const apex = [
      '          pick = hgOgPickGoldEngineFor(bridge, hzs[i], tape,',
      '            { allowC: false, allowAgainstTape: false });'
    ].join('\n');
    const apexOff = '          pick = null; /* v1099: an engine grade is not the OmniGold lead */';
    if (src.indexOf(apex) >= 0) src = src.replace(apex, apexOff);
    const apexNote = 'no grade-A/B tape-aligned pick clears the APEX bar right now — the bar existing is the point.';
    const apexNote2 = 'A Gold Scalp or Gold Swing grade is not the OmniGold lead. The lead has to be positive after the spread, at the 2R on the card, and past the family bar.';
    if (src.indexOf(apexNote) >= 0) src = src.replace(apexNote, apexNote2);
    return src;
  }
  return src;
}

const server = http.createServer(async (req, res) => {
  try{
    baseHeaders(res);
    const u = new URL(req.url || '/', 'http://localhost');
    if (u.pathname === '/api/proxy') return proxyHandler(req, res);
    if (u.pathname === '/api/fred') return fredHandler(req, res);
    if (u.pathname === '/api/coinalyze') return coinalyzeHandler(req, res);
    if (u.pathname === '/api/coinglass') return coinglassHandler(req, res);
    if (u.pathname === '/api/onchain-alt/desk') return onchainAltHandler(req, res);
    if (u.pathname === '/api/news/calendar') return newsCalendarHandler(req, res);
    if (u.pathname === '/api/delta/perp-history') return deltaPerpHistoryHandler(req, res);
    if (u.pathname === '/api/fed-calendar') return fedCalendarHandler(req, res);
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


    /* hg-v1085: gold desks — ticket only when the live dollar and 10-year agree. */
    if (u.pathname === '/goldind.js' || u.pathname === '/goldswing.js' || u.pathname === '/omnigold.js' || u.pathname === '/goldscalp.js') {
      const gName = u.pathname.slice(1);
      const gFile = path.join(ROOT, gName);
      if (fs.existsSync(gFile)) {
        const kind = gName === 'goldind.js' ? 'goldind' : (gName === 'goldswing.js' ? 'goldswing' : (gName === 'goldscalp.js' ? 'goldscalp' : 'omnigold'));
        const shaped = goldLiveSource(kind, fs.readFileSync(gFile, 'utf8'));
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
