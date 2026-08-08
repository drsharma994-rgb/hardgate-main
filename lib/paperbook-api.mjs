/* HARDGATE — paper book HTTP handler (Node 18+, zero deps). */
import fs from 'node:fs';
import path from 'node:path';
import {
  pbNewBook, pbAddIntent, pbClosePosition, pbCloseAll, pbMarkBook, pbSummary,
  pbAttribution, pbRollDay, pbPushNavHistory, pbScalePosition, pbMoveStop,
  pbApplyAutoRules, pbLpReport, pbWeeklyDigest, pbDigestText, pbDigestHtml,
  pbBuildLiveOrder, pbPushBlotter, pbApplyExecuteFill, pbPositionsNeedingFillPoll, pbLatestExecForPosition,
} from './paperbook-core.mjs';
import {
  pbNormalizeStore, pbGetBook, pbSetBook, pbListFunds, pbCreateFund,
  pbResetFund, pbResolveFundId, PB_DEFAULT_FUND,
  pbConsolidatedLp, pbConsolidatedHtml, pbConsolidatedAttribution, pbConsolidatedDesk,
} from './paperbook-funds.mjs';
import {
  deliverLpDigest, deliverConsolidatedLpDigest, digestChannelsReady, digestTelegramReady, digestEmailConfigured,
  digestCronAuthOk, loadDigestState, saveDigestState, digestUseConsolidated,
} from './paperbook-digest.mjs';
import { lpDigestDue, pbBookCfgFromEnv } from './paperbook-core.mjs';
import { hgExecuteBackendTarget, hgParseExecuteFillResponse } from './execute-core.mjs';
import { hgExecuteFillPollTarget, hgPollExecuteFill } from './execute-poll.mjs';
import { checkApiAuth } from './api-auth.mjs';

function liveWebhookUrl(){
  return process.env.EXECUTE_WEBHOOK_URL || process.env.DELTA_EXECUTE_URL || '';
}

var BOOK_CFG = pbBookCfgFromEnv(process.env);

function bookCapabilities(){
  return {
    liveExecute: !!liveWebhookUrl(),
    executeProxy: !!hgExecuteBackendTarget(),
    executeFill: true,
    executeFillAuth: !!(process.env.BOOK_EXECUTE_FILL_SECRET || ''),
    fillPoll: !!hgExecuteFillPollTarget(),
    autoRules: true,
    multiFund: true,
    maxDailyLossPct: BOOK_CFG.maxDailyLossPct,
    digestWebhook: !!(process.env.LP_DIGEST_WEBHOOK_URL || ''),
    digestTelegram: digestTelegramReady(),
    digestEmail: digestEmailConfigured(),
    digestSend: digestChannelsReady(),
    autoDigest: digestChannelsReady(),
  };
}

function autoRulesFromBody(body){
  var rules = Object.assign({}, (body && body.rules) || {});
  if (body && body.atrMarks) rules.atrMarks = body.atrMarks;
  return rules;
}

function executeFillAuthOk(req){
  var legacy = process.env.BOOK_EXECUTE_FILL_SECRET || '';
  if (legacy){
    var hdr = (req.headers &&
      (req.headers['x-book-fill-secret'] || req.headers['authorization'])) || '';
    if (Array.isArray(hdr)) hdr = hdr[0];
    if (hdr === legacy || hdr === ('Bearer ' + legacy)) return true;
  }
  return checkApiAuth(req).ok;
}

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function readBody(req){
  return new Promise(function(resolve){
    var chunks = [];
    req.on('data', function(c){ chunks.push(c); });
    req.on('end', function(){
      try{
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      }catch(e){ resolve(null); }
    });
    req.on('error', function(){ resolve(null); });
  });
}

function resolveFundId(u, body, store){
  var q = u.searchParams.get('fund');
  var fromBody = body && body.fund;
  var id = fromBody || q || store.activeFund || PB_DEFAULT_FUND;
  return pbResolveFundId(store, id);
}

export function createPaperbookApi(rootDir){
  var dataDir = process.env.PAPERBOOK_PATH
    ? path.dirname(process.env.PAPERBOOK_PATH)
    : path.join(rootDir, 'data');
  var filePath = process.env.PAPERBOOK_PATH || path.join(dataDir, 'paperbook.json');

  function ensureDir(){
    try{ if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); }catch(e){}
  }

  function loadStore(){
    ensureDir();
    try{
      if (fs.existsSync(filePath)){
        var j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return pbNormalizeStore(j);
      }
    }catch(e){}
    var store = pbNormalizeStore(null);
    saveStore(store);
    return store;
  }

  function saveStore(store){
    ensureDir();
    try{
      fs.writeFileSync(filePath, JSON.stringify(store, null, 0));
      return true;
    }catch(e){ return false; }
  }

  function loadContext(fundId){
    var store = loadStore();
    var got = pbGetBook(store, fundId);
    var book = pbRollDay(got.book);
    return { store: got.store, fundId: got.fundId, book: book };
  }

  function finalize(book){
    book = pbRollDay(book);
    var summary = pbSummary(book, BOOK_CFG);
    book = pbPushNavHistory(book, summary);
    return book;
  }

  function persist(ctx, book){
    var fin = finalize(book);
    var store = pbSetBook(ctx.store, ctx.fundId, fin);
    saveStore(store);
    return { store: store, fundId: ctx.fundId, book: fin };
  }

  function bookPayload(ctx, book, extra){
    extra = extra || {};
    var summary = pbSummary(book, BOOK_CFG);
    return Object.assign({
      ok: true,
      fundId: ctx.fundId,
      activeFund: ctx.store.activeFund,
      funds: pbListFunds(ctx.store),
      book: book,
      summary: summary,
    }, extra);
  }

  async function pollApplyPositionFill(book, pos, execEvent){
    var pollRes = await hgPollExecuteFill({
      positionId: pos.id,
      idempotencyKey: execEvent && execEvent.idempotencyKey,
      sym: pos.sym,
      side: pos.dir,
      mark: pos.mark,
      notionalUsd: pos.notionalUsd,
      qty: execEvent && execEvent.qty,
    });
    if (!pollRes.ok || !pollRes.fill){
      return { ok: false, book: book, reason: pollRes.reason || 'no fill from backend', polled: true };
    }
    var applyRes = pbApplyExecuteFill(book, Object.assign({
      positionId: pos.id,
      note: pollRes.fill.note || 'broker fill poll',
    }, pollRes.fill));
    if (!applyRes.ok){
      return { ok: false, book: book, reason: applyRes.reason || 'apply failed', polled: true };
    }
    return {
      ok: true,
      book: applyRes.book,
      position: applyRes.position,
      fillPct: applyRes.position && applyRes.position.brokerFillPct,
      polled: true,
    };
  }

  return async function paperbookHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method !== 'GET' && method !== 'OPTIONS'){
        var bookAuth = checkApiAuth(req);
        if (!bookAuth.ok && !executeFillAuthOk(req)){
          return sendJson(res, bookAuth.status, { ok: false, reason: bookAuth.reason });
        }
      }

      if (method === 'GET' && u.pathname === '/api/book/capabilities'){
        return sendJson(res, 200, Object.assign({ ok: true }, bookCapabilities()));
      }

      if (method === 'GET' && u.pathname === '/api/book/funds'){
        var storeFunds = loadStore();
        return sendJson(res, 200, {
          ok: true,
          activeFund: storeFunds.activeFund,
          funds: pbListFunds(storeFunds),
          capabilities: bookCapabilities(),
        });
      }

      if (method === 'GET' && u.pathname === '/api/book/consolidated'){
        var storeCons = loadStore();
        var periodCons = u.searchParams.get('period') || 'month';
        var monthCons = u.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        var consolidated = pbConsolidatedLp(storeCons, periodCons, monthCons);
        return sendJson(res, 200, {
          ok: true,
          consolidated: consolidated,
          html: pbConsolidatedHtml(consolidated),
        });
      }

      if (method === 'GET' && u.pathname === '/api/book/attribution'){
        var storeAttr = loadStore();
        var fundQ = u.searchParams.get('fund');
        if (fundQ){
          var fundCtx = loadContext(resolveFundId(u, { fund: fundQ }, storeAttr));
          return sendJson(res, 200, {
            ok: true,
            fundId: fundCtx.fundId,
            attribution: pbAttribution(fundCtx.book),
          });
        }
        return sendJson(res, 200, {
          ok: true,
          attribution: pbConsolidatedAttribution(storeAttr),
          consolidated: true,
        });
      }

      if (method === 'GET' && u.pathname === '/api/book/desk'){
        var storeDesk = loadStore();
        return sendJson(res, 200, {
          ok: true,
          desk: pbConsolidatedDesk(storeDesk, BOOK_CFG),
          capabilities: bookCapabilities(),
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/funds'){
        var fundBody = await readBody(req);
        var storeCreate = loadStore();
        var created = pbCreateFund(storeCreate, fundBody || {});
        if (!created.ok) return sendJson(res, 400, created);
        if (fundBody && fundBody.active) created.store.activeFund = created.fundId;
        saveStore(created.store);
        return sendJson(res, 200, {
          ok: true,
          fundId: created.fundId,
          book: created.book,
          funds: pbListFunds(created.store),
          activeFund: created.store.activeFund,
        });
      }

      var ctx = loadContext(resolveFundId(u, null, loadStore()));

      if (method === 'GET' && u.pathname === '/api/book/digest'){
        var savedDig = persist(ctx, ctx.book);
        ctx = Object.assign({}, ctx, savedDig);
        var digestPeriod = u.searchParams.get('period') || 'week';
        var digest = pbWeeklyDigest(ctx.book, digestPeriod);
        return sendJson(res, 200, {
          ok: true,
          fundId: ctx.fundId,
          digest: digest,
          html: pbDigestHtml(digest),
          text: pbDigestText(digest),
          summary: pbSummary(ctx.book, BOOK_CFG),
        });
      }

      if (method === 'GET' && u.pathname === '/api/book/lp'){
        var savedLp = persist(ctx, ctx.book);
        ctx = Object.assign({}, ctx, savedLp);
        var month = u.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        return sendJson(res, 200, {
          ok: true,
          fundId: ctx.fundId,
          lp: pbLpReport(ctx.book, month),
          book: ctx.book,
          summary: pbSummary(ctx.book, BOOK_CFG),
        });
      }

      if (method === 'GET' && (u.pathname === '/api/book' || u.pathname === '/api/book/report')){
        var savedGet = persist(ctx, ctx.book);
        ctx = Object.assign({}, ctx, savedGet);
        var report = { summary: pbSummary(ctx.book, BOOK_CFG), attribution: pbAttribution(ctx.book) };
        if (u.pathname === '/api/book/report'){
          return sendJson(res, 200, Object.assign({
            fundId: ctx.fundId,
            book: ctx.book,
            navHistory: ctx.book.navHistory || [],
          }, report));
        }
        return sendJson(res, 200, {
          ok: true,
          fundId: ctx.fundId,
          activeFund: ctx.store.activeFund,
          funds: pbListFunds(ctx.store),
          book: ctx.book,
          summary: report.summary,
          attribution: report.attribution,
          navHistory: ctx.book.navHistory || [],
          blotter: ctx.book.blotter || [],
          capabilities: bookCapabilities(),
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/intent'){
        var body = await readBody(req);
        ctx = loadContext(resolveFundId(u, body, loadStore()));
        if (!body || !body.sym || !body.dir || !isFinite(body.entry) || !isFinite(body.stop)){
          return sendJson(res, 400, { ok: false, reason: 'sym, dir, entry, stop required' });
        }
        var result = pbAddIntent(ctx.book, body, BOOK_CFG);
        if (!result.ok){
          return sendJson(res, 403, { ok: false, veto: true, reasons: result.check.reasons, check: result.check });
        }
        var finIntent = persist(ctx, result.book);
        finIntent.book = pbPushBlotter(finIntent.book, {
          type: 'open', sym: result.position.sym, dir: result.position.dir,
          notionalUsd: result.position.notionalUsd, strategy: result.position.strategy,
        });
        saveStore(pbSetBook(finIntent.store, finIntent.fundId, finIntent.book));
        return sendJson(res, 200, {
          ok: true,
          fundId: finIntent.fundId,
          position: result.position,
          summary: pbSummary(finIntent.book, BOOK_CFG),
          check: result.check,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/marks'){
        var marksBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, marksBody, loadStore()));
        var marks = (marksBody && marksBody.marks) ? marksBody.marks : {};
        var marked = pbMarkBook(ctx.book, marks);
        var autoActions = [];
        if (!marksBody || marksBody.auto !== false){
          var autoRunMarks = pbApplyAutoRules(marked, autoRulesFromBody(marksBody));
          marked = autoRunMarks.book;
          autoActions = autoRunMarks.actions;
        }
        var finM = persist(ctx, marked);
        return sendJson(res, 200, bookPayload(finM, finM.book, { autoActions: autoActions }));
      }

      if (method === 'POST' && u.pathname === '/api/book/auto'){
        var autoBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, autoBody, loadStore()));
        var autoBook = pbMarkBook(ctx.book, (autoBody && autoBody.marks) ? autoBody.marks : {});
        var autoRun = pbApplyAutoRules(autoBook, autoRulesFromBody(autoBody));
        var finAuto = persist(ctx, autoRun.book);
        return sendJson(res, 200, bookPayload(finAuto, finAuto.book, { actions: autoRun.actions }));
      }

      if (method === 'POST' && u.pathname === '/api/book/execute-blotter'){
        var blBody = await readBody(req);
        if (!blBody) return sendJson(res, 400, { ok: false, reason: 'invalid json' });
        ctx = loadContext(resolveFundId(u, blBody, loadStore()));
        var finBl = persist(ctx, pbPushBlotter(ctx.book, {
          type: blBody.ok ? 'execute_ok' : 'execute_fail',
          sym: blBody.sym,
          dir: blBody.dir || blBody.side,
          qty: blBody.qty,
          ok: !!blBody.ok,
          status: blBody.status,
          note: String(blBody.note || blBody.response || blBody.reason || '').slice(0, 200),
          idempotencyKey: blBody.idempotencyKey,
          positionId: blBody.positionId,
        }));
        return sendJson(res, 200, { ok: true, fundId: finBl.fundId, blotter: finBl.book.blotter });
      }

      if (method === 'POST' && u.pathname === '/api/book/execute-fill'){
        if (!executeFillAuthOk(req)){
          return sendJson(res, 401, { ok: false, reason: 'Unauthorized — set X-Book-Fill-Secret or Authorization' });
        }
        var fillBody = await readBody(req);
        if (!fillBody || !fillBody.positionId) return sendJson(res, 400, { ok: false, reason: 'positionId required' });
        ctx = loadContext(resolveFundId(u, fillBody, loadStore()));
        var fillRun = pbApplyExecuteFill(ctx.book, fillBody);
        if (!fillRun.ok) return sendJson(res, 404, { ok: false, reason: fillRun.reason || 'fill failed' });
        var finFill = persist(ctx, fillRun.book);
        return sendJson(res, 200, {
          ok: true,
          fundId: finFill.fundId,
          position: fillRun.position,
          fillPct: fillRun.position && fillRun.position.brokerFillPct,
          blotter: finFill.book.blotter,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/poll-fills'){
        if (!hgExecuteFillPollTarget()){
          return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_BACKEND_URL or EXECUTE_FILL_POLL_URL to poll broker fills' });
        }
        var pollBody = await readBody(req) || {};
        var pollAllFunds = !!pollBody.allFunds;
        var pollStore = loadStore();
        var pollIds = pollAllFunds ? Object.keys(pollStore.funds || {}).sort() : [resolveFundId(u, pollBody, pollStore)];
        var polled = 0;
        var filled = 0;
        var pollResults = [];
        for (var pi = 0; pi < pollIds.length; pi++){
          var pollFundId = pollIds[pi];
          var pollCtx = loadContext(pollFundId);
          var pollBook = pollCtx.book;
          var needs = pbPositionsNeedingFillPoll(pollBook);
          var bookChanged = false;
          for (var ni = 0; ni < needs.length; ni++){
            var need = needs[ni];
            var pos = need.position;
            var evt = need.execEvent || {};
            polled++;
            var applyRun = await pollApplyPositionFill(pollBook, pos, evt);
            var row = {
              fundId: pollFundId,
              positionId: pos.id,
              sym: pos.sym,
              polled: true,
              ok: !!applyRun.ok,
              reason: applyRun.reason,
            };
            if (applyRun.ok){
              pollBook = applyRun.book;
              bookChanged = true;
              filled++;
              row.fillPct = applyRun.fillPct;
            }
            pollResults.push(row);
          }
          if (bookChanged){
            persist(Object.assign({}, pollCtx, { book: pollBook }), pollBook);
          }
        }
        return sendJson(res, 200, {
          ok: true,
          polled: polled,
          filled: filled,
          allFunds: pollAllFunds,
          results: pollResults,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/poll-fill'){
        if (!hgExecuteFillPollTarget()){
          return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_BACKEND_URL or EXECUTE_FILL_POLL_URL to poll broker fills' });
        }
        var singlePollBody = await readBody(req) || {};
        if (!singlePollBody.positionId) return sendJson(res, 400, { ok: false, reason: 'positionId required' });
        ctx = loadContext(resolveFundId(u, singlePollBody, loadStore()));
        var targetPos = null;
        for (var spi = 0; spi < (ctx.book.positions || []).length; spi++){
          if (ctx.book.positions[spi].id === singlePollBody.positionId) targetPos = ctx.book.positions[spi];
        }
        if (!targetPos) return sendJson(res, 404, { ok: false, reason: 'position not found' });
        var needsPoll = pbPositionsNeedingFillPoll(ctx.book);
        var needMatch = null;
        for (var nmi = 0; nmi < needsPoll.length; nmi++){
          if (needsPoll[nmi].position && needsPoll[nmi].position.id === targetPos.id){
            needMatch = needsPoll[nmi];
            break;
          }
        }
        if (!needMatch){
          return sendJson(res, 200, { ok: true, skipped: true, reason: 'no poll needed', positionId: targetPos.id });
        }
        var singleRun = await pollApplyPositionFill(ctx.book, targetPos, needMatch.execEvent || pbLatestExecForPosition(ctx.book.blotter, targetPos.id));
        if (!singleRun.ok){
          return sendJson(res, 502, { ok: false, reason: singleRun.reason || 'poll failed', positionId: targetPos.id });
        }
        var finSinglePoll = persist(ctx, singleRun.book);
        return sendJson(res, 200, {
          ok: true,
          fundId: finSinglePoll.fundId,
          positionId: targetPos.id,
          position: singleRun.position,
          fillPct: singleRun.fillPct,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/live'){
        var liveBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, liveBody, loadStore()));
        if (!liveBody || !liveBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var webhook = liveWebhookUrl();
        if (!webhook) return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_WEBHOOK_URL on Render to enable live brackets' });
        var livePos = null;
        for (var li = 0; li < (ctx.book.positions || []).length; li++){
          if (ctx.book.positions[li].id === liveBody.id) livePos = ctx.book.positions[li];
        }
        if (!livePos) return sendJson(res, 404, { ok: false, reason: 'position not found' });
        var order = pbBuildLiveOrder(livePos);
        if (!order) return sendJson(res, 400, { ok: false, reason: 'invalid position for live order' });
        var liveRes = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({}, order, { fundId: ctx.fundId })),
        });
        var liveText = '';
        try{ liveText = await liveRes.text(); }catch(e){}
        var liveBook = ctx.book;
        var liveFill = liveRes.ok ? hgParseExecuteFillResponse(liveText) : null;
        var liveFillPct = null;
        if (liveFill){
          var liveFillRun = pbApplyExecuteFill(liveBook, {
            positionId: livePos.id,
            filledQty: liveFill.filledQty,
            qty: liveFill.qty,
            avgPrice: liveFill.avgPrice,
            note: liveFill.note || 'auto from live webhook',
          });
          if (liveFillRun.ok){
            liveBook = liveFillRun.book;
            liveFillPct = liveFillRun.position && liveFillRun.position.brokerFillPct;
          }
        }
        var finLive = persist(ctx, pbPushBlotter(liveBook, {
          type: 'live_send', sym: livePos.sym, dir: livePos.dir, positionId: livePos.id,
          qty: order.qty, ok: liveRes.ok, status: liveRes.status, note: liveText.slice(0, 200),
        }));
        return sendJson(res, liveRes.ok ? 200 : 502, {
          ok: liveRes.ok,
          fundId: finLive.fundId,
          order: order,
          status: liveRes.status,
          response: liveText.slice(0, 500),
          fill: liveFill || undefined,
          fillPct: liveFillPct != null ? liveFillPct : undefined,
          blotter: finLive.book.blotter,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/digest/send'){
        if (!digestCronAuthOk(req)){
          return sendJson(res, 403, { ok: false, reason: 'invalid digest cron key' });
        }
        if (!digestChannelsReady()){
          return sendJson(res, 503, { ok: false, reason: 'Set LP_DIGEST_WEBHOOK_URL, TELEGRAM_TOKEN+TELEGRAM_CHAT_ID, and/or LP_DIGEST_EMAIL_TO + email provider on Render' });
        }
        var digestSendBody = await readBody(req);
        var digestState = loadDigestState();
        if (digestSendBody && digestSendBody.cron && !lpDigestDue(digestState.lastAt, Date.now())){
          return sendJson(res, 200, { ok: true, skipped: true, reason: 'weekly digest not due' });
        }
        var sendPeriod = (digestSendBody && digestSendBody.period) || 'week';
        var useConsolidated = digestUseConsolidated(digestSendBody || {});
        var delivered;
        if (useConsolidated){
          var storeDig = loadStore();
          delivered = await deliverConsolidatedLpDigest(storeDig, sendPeriod);
          if (delivered.ok){
            saveDigestState(Object.assign({}, digestState, {
              lastAt: new Date().toISOString(),
              period: sendPeriod,
              consolidated: true,
              fundCount: delivered.consolidated && delivered.consolidated.fundCount,
            }));
          }
          return sendJson(res, delivered.ok ? 200 : 502, {
            ok: delivered.ok,
            consolidated: true,
            fundCount: delivered.consolidated && delivered.consolidated.fundCount,
            digest: delivered.digest,
            channels: delivered.channels,
            response: delivered.channels && delivered.channels.webhook ? delivered.channels.webhook.response : undefined,
          });
        }
        var digestFund = process.env.LP_DIGEST_FUND || (digestSendBody && digestSendBody.fund) || null;
        ctx = loadContext(resolveFundId(u, Object.assign({}, digestSendBody, { fund: digestFund }), loadStore()));
        var finDig = persist(ctx, ctx.book);
        delivered = await deliverLpDigest(finDig.book, sendPeriod);
        if (delivered.ok){
          saveDigestState(Object.assign({}, digestState, {
            lastAt: new Date().toISOString(),
            period: sendPeriod,
            fundId: finDig.fundId,
            consolidated: false,
          }));
        }
        return sendJson(res, delivered.ok ? 200 : 502, {
          ok: delivered.ok,
          fundId: finDig.fundId,
          digest: delivered.digest,
          channels: delivered.channels,
          response: delivered.channels && delivered.channels.webhook ? delivered.channels.webhook.response : undefined,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/close'){
        var closeBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, closeBody, loadStore()));
        if (!closeBody || !closeBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var closed = pbClosePosition(ctx.book, closeBody.id, closeBody.mark);
        if (!closed.ok) return sendJson(res, 404, closed);
        var finC = persist(ctx, closed.book);
        return sendJson(res, 200, { ok: true, fundId: finC.fundId, position: closed.position, summary: pbSummary(finC.book, BOOK_CFG) });
      }

      if (method === 'POST' && u.pathname === '/api/book/scale'){
        var scaleBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, scaleBody, loadStore()));
        if (!scaleBody || !scaleBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var pct = isFinite(scaleBody.pct) ? +scaleBody.pct : (isFinite(scaleBody.scalePct) ? +scaleBody.scalePct : NaN);
        if (!(pct > 0 && pct <= 1)) return sendJson(res, 400, { ok: false, reason: 'pct must be 0–1' });
        var scaled = pbScalePosition(ctx.book, scaleBody.id, pct, scaleBody.mark);
        if (!scaled.ok) return sendJson(res, 404, scaled);
        var finS = persist(ctx, scaled.book);
        return sendJson(res, 200, { ok: true, fundId: finS.fundId, position: scaled.position, summary: pbSummary(finS.book, BOOK_CFG) });
      }

      if (method === 'POST' && u.pathname === '/api/book/stop'){
        var stopBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, stopBody, loadStore()));
        if (!stopBody || !stopBody.id || !isFinite(stopBody.stop)) return sendJson(res, 400, { ok: false, reason: 'id and stop required' });
        var moved = pbMoveStop(ctx.book, stopBody.id, stopBody.stop);
        if (!moved.ok) return sendJson(res, 400, moved);
        var finSt = persist(ctx, moved.book);
        return sendJson(res, 200, { ok: true, fundId: finSt.fundId, position: moved.position, summary: pbSummary(finSt.book, BOOK_CFG) });
      }

      if (method === 'POST' && u.pathname === '/api/book/close-all'){
        var allMarksBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, allMarksBody, loadStore()));
        var allMarks = (allMarksBody && allMarksBody.marks) ? allMarksBody.marks : {};
        var allClosed = pbCloseAll(ctx.book, allMarks);
        var finA = persist(ctx, allClosed.book);
        return sendJson(res, 200, {
          ok: true,
          fundId: finA.fundId,
          closed: allClosed.closed,
          book: finA.book,
          summary: pbSummary(finA.book, BOOK_CFG),
          attribution: pbAttribution(finA.book),
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/reset'){
        var resetBody = await readBody(req);
        ctx = loadContext(resolveFundId(u, resetBody, loadStore()));
        var reset = pbResetFund(ctx.store, ctx.fundId);
        saveStore(reset.store);
        var finR = persist({ store: reset.store, fundId: reset.fundId, book: reset.book }, reset.book);
        return sendJson(res, 200, {
          ok: true,
          fundId: finR.fundId,
          book: finR.book,
          summary: pbSummary(finR.book, BOOK_CFG),
          attribution: pbAttribution(finR.book),
        });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
