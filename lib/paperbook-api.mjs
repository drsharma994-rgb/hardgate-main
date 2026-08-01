/* HARDGATE — paper book HTTP handler (Node 18+, zero deps). */
import fs from 'node:fs';
import path from 'node:path';
import {
  pbNewBook, pbAddIntent, pbClosePosition, pbCloseAll, pbMarkBook, pbSummary,
  pbAttribution, pbRollDay, pbPushNavHistory, pbScalePosition, pbMoveStop,
  pbApplyAutoRules, pbLpReport, pbWeeklyDigest, pbDigestText, pbDigestHtml,
  pbBuildLiveOrder, pbPushBlotter,
} from './paperbook-core.mjs';
import {
  deliverLpDigest, digestChannelsReady, digestTelegramReady, digestCronAuthOk,
  loadDigestState, saveDigestState,
} from './paperbook-digest.mjs';
import { lpDigestDue } from './paperbook-core.mjs';

function liveWebhookUrl(){
  return process.env.EXECUTE_WEBHOOK_URL || process.env.DELTA_EXECUTE_URL || '';
}

function bookCapabilities(){
  return {
    liveExecute: !!liveWebhookUrl(),
    autoRules: true,
    digestWebhook: !!(process.env.LP_DIGEST_WEBHOOK_URL || ''),
    digestTelegram: digestTelegramReady(),
    digestSend: digestChannelsReady(),
    autoDigest: digestChannelsReady(),
  };
}

function autoRulesFromBody(body){
  var rules = Object.assign({}, (body && body.rules) || {});
  if (body && body.atrMarks) rules.atrMarks = body.atrMarks;
  return rules;
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

export function createPaperbookApi(rootDir){
  var dataDir = process.env.PAPERBOOK_PATH
    ? path.dirname(process.env.PAPERBOOK_PATH)
    : path.join(rootDir, 'data');
  var filePath = process.env.PAPERBOOK_PATH || path.join(dataDir, 'paperbook.json');

  function ensureDir(){
    try{ if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); }catch(e){}
  }

  function load(){
    ensureDir();
    try{
      if (fs.existsSync(filePath)){
        var j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (j && j.version === 1){
          j = pbRollDay(j);
          return j;
        }
      }
    }catch(e){}
    var b = pbNewBook();
    save(b);
    return b;
  }

  function finalize(book){
    book = pbRollDay(book);
    var summary = pbSummary(book);
    book = pbPushNavHistory(book, summary);
    return book;
  }

  function save(book){
    ensureDir();
    try{
      fs.writeFileSync(filePath, JSON.stringify(book, null, 0));
      return true;
    }catch(e){ return false; }
  }

  return async function paperbookHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();
      var book = load();

      if (method === 'GET' && u.pathname === '/api/book/capabilities'){
        return sendJson(res, 200, Object.assign({ ok: true }, bookCapabilities()));
      }

      if (method === 'GET' && u.pathname === '/api/book/digest'){
        book = finalize(book);
        save(book);
        var digestPeriod = u.searchParams.get('period') || 'week';
        var digest = pbWeeklyDigest(book, digestPeriod);
        return sendJson(res, 200, {
          ok: true,
          digest: digest,
          html: pbDigestHtml(digest),
          text: pbDigestText(digest),
          summary: pbSummary(book),
        });
      }

      if (method === 'GET' && u.pathname === '/api/book/lp'){
        book = finalize(book);
        save(book);
        var month = u.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        return sendJson(res, 200, { ok: true, lp: pbLpReport(book, month), book: book, summary: pbSummary(book) });
      }

      if (method === 'GET' && (u.pathname === '/api/book' || u.pathname === '/api/book/report')){
        book = finalize(book);
        save(book);
        var summary = pbSummary(book);
        var report = { summary: summary, attribution: pbAttribution(book) };
        if (u.pathname === '/api/book/report'){
          return sendJson(res, 200, { ok: true, book: book, navHistory: book.navHistory || [], ...report });
        }
        return sendJson(res, 200, { ok: true, book: book, summary: summary, attribution: report.attribution, navHistory: book.navHistory || [], blotter: book.blotter || [], capabilities: bookCapabilities() });
      }

      if (method === 'POST' && u.pathname === '/api/book/intent'){
        var body = await readBody(req);
        if (!body || !body.sym || !body.dir || !isFinite(body.entry) || !isFinite(body.stop)){
          return sendJson(res, 400, { ok: false, reason: 'sym, dir, entry, stop required' });
        }
        var result = pbAddIntent(book, body);
        if (!result.ok){
          return sendJson(res, 403, { ok: false, veto: true, reasons: result.check.reasons, check: result.check });
        }
        save(result.book);
        var fin = finalize(result.book);
        save(fin);
        fin = pbPushBlotter(fin, { type: 'open', sym: result.position.sym, dir: result.position.dir, notionalUsd: result.position.notionalUsd, strategy: result.position.strategy });
        save(fin);
        return sendJson(res, 200, { ok: true, position: result.position, summary: pbSummary(fin), check: result.check });
      }

      if (method === 'POST' && u.pathname === '/api/book/marks'){
        var marksBody = await readBody(req);
        var marks = (marksBody && marksBody.marks) ? marksBody.marks : {};
        var marked = pbMarkBook(book, marks);
        var autoActions = [];
        if (!marksBody || marksBody.auto !== false){
          var autoRunMarks = pbApplyAutoRules(marked, autoRulesFromBody(marksBody));
          marked = autoRunMarks.book;
          autoActions = autoRunMarks.actions;
        }
        var finM = finalize(marked);
        save(finM);
        return sendJson(res, 200, { ok: true, book: finM, summary: pbSummary(finM), autoActions: autoActions });
      }

      if (method === 'POST' && u.pathname === '/api/book/auto'){
        var autoBody = await readBody(req);
        var autoMarks = (autoBody && autoBody.marks) ? autoBody.marks : {};
        var autoBook = pbMarkBook(book, autoMarks);
        var autoRun = pbApplyAutoRules(autoBook, autoRulesFromBody(autoBody));
        var finAuto = finalize(autoRun.book);
        save(finAuto);
        return sendJson(res, 200, { ok: true, book: finAuto, summary: pbSummary(finAuto), actions: autoRun.actions });
      }

      if (method === 'POST' && u.pathname === '/api/book/live'){
        var liveBody = await readBody(req);
        if (!liveBody || !liveBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var webhook = liveWebhookUrl();
        if (!webhook) return sendJson(res, 503, { ok: false, reason: 'Set EXECUTE_WEBHOOK_URL on Render to enable live brackets' });
        var livePos = null;
        for (var li = 0; li < (book.positions || []).length; li++){
          if (book.positions[li].id === liveBody.id) livePos = book.positions[li];
        }
        if (!livePos) return sendJson(res, 404, { ok: false, reason: 'position not found' });
        var order = pbBuildLiveOrder(livePos);
        if (!order) return sendJson(res, 400, { ok: false, reason: 'invalid position for live order' });
        var liveRes = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        });
        var liveText = '';
        try{ liveText = await liveRes.text(); }catch(e){}
        var finLive = pbPushBlotter(book, {
          type: 'live_send', sym: livePos.sym, dir: livePos.dir,
          qty: order.qty, ok: liveRes.ok, status: liveRes.status, note: liveText.slice(0, 200),
        });
        save(finLive);
        return sendJson(res, liveRes.ok ? 200 : 502, {
          ok: liveRes.ok,
          order: order,
          status: liveRes.status,
          response: liveText.slice(0, 500),
          blotter: finLive.blotter,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/digest/send'){
        if (!digestCronAuthOk(req)){
          return sendJson(res, 403, { ok: false, reason: 'invalid digest cron key' });
        }
        if (!digestChannelsReady()){
          return sendJson(res, 503, { ok: false, reason: 'Set LP_DIGEST_WEBHOOK_URL and/or TELEGRAM_TOKEN+TELEGRAM_CHAT_ID on Render' });
        }
        var digestSendBody = await readBody(req);
        var digestState = loadDigestState();
        if (digestSendBody && digestSendBody.cron && !lpDigestDue(digestState.lastAt, Date.now())){
          return sendJson(res, 200, { ok: true, skipped: true, reason: 'weekly digest not due' });
        }
        book = finalize(book);
        save(book);
        var sendPeriod = (digestSendBody && digestSendBody.period) || 'week';
        var delivered = await deliverLpDigest(book, sendPeriod);
        if (delivered.ok){
          saveDigestState(Object.assign({}, digestState, { lastAt: new Date().toISOString(), period: sendPeriod }));
        }
        return sendJson(res, delivered.ok ? 200 : 502, {
          ok: delivered.ok,
          digest: delivered.digest,
          channels: delivered.channels,
          response: delivered.channels && delivered.channels.webhook ? delivered.channels.webhook.response : undefined,
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/close'){
        var closeBody = await readBody(req);
        if (!closeBody || !closeBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var closed = pbClosePosition(book, closeBody.id, closeBody.mark);
        if (!closed.ok) return sendJson(res, 404, closed);
        save(closed.book);
        var finC = finalize(closed.book);
        save(finC);
        return sendJson(res, 200, { ok: true, position: closed.position, summary: pbSummary(finC) });
      }

      if (method === 'POST' && u.pathname === '/api/book/scale'){
        var scaleBody = await readBody(req);
        if (!scaleBody || !scaleBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var pct = isFinite(scaleBody.pct) ? +scaleBody.pct : (isFinite(scaleBody.scalePct) ? +scaleBody.scalePct : NaN);
        if (!(pct > 0 && pct <= 1)) return sendJson(res, 400, { ok: false, reason: 'pct must be 0–1' });
        var scaled = pbScalePosition(book, scaleBody.id, pct, scaleBody.mark);
        if (!scaled.ok) return sendJson(res, 404, scaled);
        save(scaled.book);
        var finS = finalize(scaled.book);
        save(finS);
        return sendJson(res, 200, { ok: true, position: scaled.position, summary: pbSummary(finS) });
      }

      if (method === 'POST' && u.pathname === '/api/book/stop'){
        var stopBody = await readBody(req);
        if (!stopBody || !stopBody.id || !isFinite(stopBody.stop)) return sendJson(res, 400, { ok: false, reason: 'id and stop required' });
        var moved = pbMoveStop(book, stopBody.id, stopBody.stop);
        if (!moved.ok) return sendJson(res, 400, moved);
        save(moved.book);
        var finSt = finalize(moved.book);
        save(finSt);
        return sendJson(res, 200, { ok: true, position: moved.position, summary: pbSummary(finSt) });
      }

      if (method === 'POST' && u.pathname === '/api/book/close-all'){
        var allMarksBody = await readBody(req);
        var allMarks = (allMarksBody && allMarksBody.marks) ? allMarksBody.marks : {};
        var allClosed = pbCloseAll(book, allMarks);
        save(allClosed.book);
        var finA = finalize(allClosed.book);
        save(finA);
        return sendJson(res, 200, {
          ok: true,
          closed: allClosed.closed,
          book: finA,
          summary: pbSummary(finA),
          attribution: pbAttribution(finA),
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/reset'){
        var fresh = pbNewBook();
        save(fresh);
        var finR = finalize(fresh);
        save(finR);
        return sendJson(res, 200, { ok: true, book: finR, summary: pbSummary(finR), attribution: pbAttribution(finR) });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
