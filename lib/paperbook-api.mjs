/* HARDGATE — paper book HTTP handler (Node 18+, zero deps). */
import fs from 'node:fs';
import path from 'node:path';
import {
  pbNewBook, pbAddIntent, pbClosePosition, pbCloseAll, pbMarkBook, pbSummary, pbAttribution,
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
        if (j && j.version === 1) return j;
      }
    }catch(e){}
    var b = pbNewBook();
    save(b);
    return b;
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

      if (method === 'GET' && (u.pathname === '/api/book' || u.pathname === '/api/book/report')){
        var summary = pbSummary(book);
        var report = { summary: summary, attribution: pbAttribution(book) };
        if (u.pathname === '/api/book/report'){
          return sendJson(res, 200, Object.assign({ ok: true, book: book }, report));
        }
        return sendJson(res, 200, { ok: true, book: book, summary: summary, attribution: report.attribution });
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
        return sendJson(res, 200, { ok: true, position: result.position, summary: pbSummary(result.book), check: result.check });
      }

      if (method === 'POST' && u.pathname === '/api/book/marks'){
        var marksBody = await readBody(req);
        var marks = (marksBody && marksBody.marks) ? marksBody.marks : {};
        var marked = pbMarkBook(book, marks);
        save(marked);
        return sendJson(res, 200, { ok: true, book: marked, summary: pbSummary(marked) });
      }

      if (method === 'POST' && u.pathname === '/api/book/close'){
        var closeBody = await readBody(req);
        if (!closeBody || !closeBody.id) return sendJson(res, 400, { ok: false, reason: 'id required' });
        var closed = pbClosePosition(book, closeBody.id, closeBody.mark);
        if (!closed.ok) return sendJson(res, 404, closed);
        save(closed.book);
        return sendJson(res, 200, { ok: true, position: closed.position, summary: pbSummary(closed.book) });
      }

      if (method === 'POST' && u.pathname === '/api/book/close-all'){
        var allMarksBody = await readBody(req);
        var allMarks = (allMarksBody && allMarksBody.marks) ? allMarksBody.marks : {};
        var allClosed = pbCloseAll(book, allMarks);
        save(allClosed.book);
        return sendJson(res, 200, {
          ok: true,
          closed: allClosed.closed,
          book: allClosed.book,
          summary: pbSummary(allClosed.book),
          attribution: pbAttribution(allClosed.book),
        });
      }

      if (method === 'POST' && u.pathname === '/api/book/reset'){
        var fresh = pbNewBook();
        save(fresh);
        return sendJson(res, 200, { ok: true, book: fresh, summary: pbSummary(fresh), attribution: pbAttribution(fresh) });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
