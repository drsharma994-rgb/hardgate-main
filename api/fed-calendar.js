/* HARDGATE /api/fed-calendar — Federal Reserve official calendar.json.
   Source: https://www.federalreserve.gov/json/calendar.json (BOM-prefixed JSON).
   Used as a hard FOMC veto for gold desks. Free, official, no API key. */

const FED_URL = 'https://www.federalreserve.gov/json/calendar.json';
const CACHE_MS = 6 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 20000;

const __cache = { at: 0, body: null, ok: false };

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.end(JSON.stringify(obj));
}

/** Parse "2:30 p.m." / "8:30 a.m." → {h, m} 24h. */
function parseFedClock(timeStr){
  const s = String(timeStr || '').trim().toLowerCase();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = m[3].charAt(0);
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return { h, m: min };
}

/** Fed times are US Eastern. Approximate DST with US rules (Mar 2nd Sun–Nov 1st Sun). */
function easternOffsetHours(y, month /*1-12*/, day){
  const mar1 = new Date(Date.UTC(y, 2, 1));
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const secondSunMar = 1 + ((7 - mar1.getUTCDay()) % 7) + 7;
  const firstSunNov = 1 + ((7 - nov1.getUTCDay()) % 7);
  const afterSpring = (month > 3) || (month === 3 && day >= secondSunMar);
  const beforeFall = (month < 11) || (month === 11 && day < firstSunNov);
  return (afterSpring && beforeFall) ? 4 : 5; /* EDT=UTC-4, EST=UTC-5 */
}

function dayToken(days){
  const s = String(days == null ? '' : days).trim();
  if (!s) return null;
  /* "15-16" → use last day (decision / press typically on final day) */
  if (s.indexOf('-') >= 0){
    const parts = s.split('-').map((x) => +String(x).trim()).filter((n) => isFinite(n) && n > 0);
    return parts.length ? parts[parts.length - 1] : null;
  }
  const n = +s;
  return isFinite(n) && n > 0 ? n : null;
}

function isFomcDecision(ev){
  if (!ev) return false;
  const type = String(ev.type || '');
  const title = String(ev.title || '');
  if (type !== 'FOMC' && !/FOMC|Open Market Committee/i.test(title)) return false;
  /* Minutes are secondary — hard block is decision / press / meeting. */
  if (/minutes/i.test(title)) return false;
  return /press conference|meeting|FOMC/i.test(title) || type === 'FOMC';
}

/**
 * Normalize one Fed calendar row → {title,t,type,month,days,fomcDecision}.
 * t is epoch ms UTC (approx from Eastern clock).
 */
function normalizeFedEvent(ev){
  if (!ev) return null;
  const month = String(ev.month || '');
  const ym = month.match(/^(\d{4})-(\d{2})$/);
  if (!ym) return null;
  const y = +ym[1], mo = +ym[2];
  const day = dayToken(ev.days);
  if (!day) return null;
  const clock = parseFedClock(ev.time) || { h: 14, m: 0 };
  const off = easternOffsetHours(y, mo, day);
  const t = Date.UTC(y, mo - 1, day, clock.h + off, clock.m, 0);
  if (!isFinite(t)) return null;
  const title = String(ev.title || '').trim() || 'Fed event';
  const type = String(ev.type || '');
  const fomcDecision = isFomcDecision(ev);
  return {
    title,
    t,
    type,
    month,
    days: String(ev.days || ''),
    time: String(ev.time || ''),
    fomcDecision,
    source: 'federalreserve.gov/json/calendar.json'
  };
}

function buildBody(raw){
  const events = Array.isArray(raw && raw.events) ? raw.events : [];
  const normalized = [];
  for (let i = 0; i < events.length; i++){
    const n = normalizeFedEvent(events[i]);
    if (n) normalized.push(n);
  }
  const fomc = normalized.filter((e) => e.fomcDecision);
  return {
    ok: true,
    at: Date.now(),
    source: FED_URL,
    events: normalized,
    fomc,
    counts: { events: normalized.length, fomc: fomc.length }
  };
}

async function fetchUpstream(){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try{
    const upstream = await fetch(FED_URL, {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HARDGATE/1.0 (+https://github.com/drsharma994-rgb/hardgate-main)'
      }
    });
    let text = await upstream.text();
    if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (!(upstream.status >= 200 && upstream.status < 300) || !text){
      const err = new Error('fed calendar upstream ' + (upstream && upstream.status));
      err.status = upstream && upstream.status;
      throw err;
    }
    const raw = JSON.parse(text);
    const body = buildBody(raw);
    __cache.at = Date.now();
    __cache.body = body;
    __cache.ok = true;
    return body;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function fedCalendar(req, res){
  if (req.method === 'OPTIONS'){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });

  const age = Date.now() - __cache.at;
  if (__cache.ok && age < CACHE_MS){
    res.setHeader('X-HG-Cache', 'HIT');
    return sendJson(res, 200, __cache.body);
  }
  try{
    const body = await fetchUpstream();
    res.setHeader('X-HG-Cache', 'MISS');
    return sendJson(res, 200, body);
  }catch(e){
    if (__cache.ok && __cache.body){
      res.setHeader('X-HG-Cache', 'STALE');
      return sendJson(res, 200, Object.assign({}, __cache.body, {
        stale: true,
        error: (e && e.message) || 'upstream failed'
      }));
    }
    return sendJson(res, 502, {
      ok: false,
      error: (e && e.message) || 'fed calendar failed'
    });
  }
};

module.exports._test = {
  parseFedClock,
  easternOffsetHours,
  dayToken,
  isFomcDecision,
  normalizeFedEvent,
  buildBody,
  FED_URL
};
