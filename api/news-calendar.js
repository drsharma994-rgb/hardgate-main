/* HARDGATE /api/news/calendar — deduplicated ForexFactory weekly calendar fetch.
   news.js calls this instead of hammering /api/proxy?url=… on every client refresh.
   One upstream fetch per CACHE_MS per server instance; stale body served on 429. */

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const CACHE_MS = 30 * 60 * 1000;
const STALE_MAX_MS = 7 * 24 * 3600 * 1000;
const UPSTREAM_TIMEOUT_MS = 15000;

const __cache = { at: 0, text: '', ok: false };
let __inflight = null;

function sendXml(res, text, cacheTag){
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  if (cacheTag) res.setHeader('X-HG-Cache', cacheTag);
  res.statusCode = 200;
  res.end(text);
}

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function fetchUpstream(){
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(FF_URL, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/xml,text/xml,*/*',
      },
    });
    const text = await upstream.text();
    if (upstream.status >= 200 && upstream.status < 300 && text && text.indexOf('<weeklyevents>') >= 0){
      __cache.at = Date.now();
      __cache.text = text;
      __cache.ok = true;
      return __cache;
    }
    const err = new Error('calendar upstream ' + (upstream && upstream.status ? upstream.status : 'bad body'));
    err.status = upstream && upstream.status ? upstream.status : 502;
    throw err;
  }finally{
    clearTimeout(timer);
  }
}

async function ensureFresh(force){
  const age = Date.now() - __cache.at;
  if (!force && __cache.ok && age < CACHE_MS) return __cache;
  if (__inflight) return __inflight;
  __inflight = fetchUpstream().finally(function(){ __inflight = null; });
  return __inflight;
}

async function warmNewsCalendar(){
  try{
    await ensureFresh(true);
    return __cache.ok;
  }catch(e){
    return false;
  }
}

module.exports = async function newsCalendar(req, res){
  if (req.method === 'OPTIONS'){
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });

  const age = Date.now() - __cache.at;
  if (__cache.ok && age < CACHE_MS){
    return sendXml(res, __cache.text, 'hit');
  }

  try{
    await ensureFresh(false);
    return sendXml(res, __cache.text, age < CACHE_MS ? 'hit' : 'miss');
  }catch(e){
    if (__cache.ok && age < STALE_MAX_MS){
      return sendXml(res, __cache.text, 'stale');
    }
    return sendJson(res, 502, {
      error: 'calendar unavailable',
      detail: String((e && e.message) || e),
    });
  }
};

module.exports.warmNewsCalendar = warmNewsCalendar;
module.exports.__testReset = function(){
  __cache.at = 0;
  __cache.text = '';
  __cache.ok = false;
  __inflight = null;
};
