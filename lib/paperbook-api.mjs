/* HARDGATE — paper book HTTP handler (Node 18+, zero deps). */
import fs from 'node:fs';
import path from 'node:path';
import {
  pbNewBook, pbAddIntent, pbClosePosition, pbCloseAll, pbMarkBook, pbSummary,
  pbAttribution, pbRollDay, pbPushNavHistory, pbScalePosition, pbMoveStop,
  pbApplyAutoRules, pbLpReport,
} from './paperbook-core.mjs';

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
        return sendJson(res, 200, { ok: true, book: book, summary: summary, attribution: report.attribution, navHistory: book.navHistory || [] });
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
        return sendJson(res, 200, { ok: true, position: result.position, summary: pbSummary(fin), check: result.check });
      }

      if (method === 'POST' && u.pathname === '/api/book/marks'){
        var marksBody = await readBody(req);
        var marks = (marksBody && marksBody.marks) ? marksBody.marks : {};
        var marked = pbMarkBook(book, marks);
        var autoActions = [];
        if (!marksBody || marksBody.auto !== false){
          var autoRunMarks = pbApplyAutoRules(marked, (marksBody && marksBody.rules) || {});
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
        var autoRun = pbApplyAutoRules(autoBook, (autoBody && autoBody.rules) || {});
        var finAuto = finalize(autoRun.book);
        save(finAuto);
        return sendJson(res, 200, { ok: true, book: finAuto, summary: pbSummary(finAuto), actions: autoRun.actions });
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
