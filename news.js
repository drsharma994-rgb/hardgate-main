/* =========================================================================
HARDGATE — news.js
NEWS INTELLIGENCE layer: macro-event calendar + headline impact scan +
fear/greed sentiment, feeding a synchronous, cache-backed risk gate that
the rest of the terminal consumes via window.hgNewsRisk(symbol).

Sources (all free, no key, all CORS-safe):
  1) ForexFactory weekly calendar XML
       https://nfs.faireconomy.media/ff_calendar_thisweek.xml
     fetched via the same-origin /api/proxy?url=<encoded> (host allowlisted
     in api/proxy.js). High/medium-impact events are parsed; USD events flag
     ALL crypto symbols AND gold (XAU/PAXG). Times are US Eastern (ET);
     converted to UTC with the US DST rule (2nd Sun Mar -> 1st Sun Nov).
  2) alternative.me Fear & Greed  https://api.alternative.me/fng/?limit=1
     (CORS-open, fetched directly) — sentiment context only.
  3) Headline scan via proxy: cointelegraph.com + www.coindesk.com RSS,
     each headline keyword-impact-scored (hack, exploit, SEC, ETF, ban,
     liquidation cascade, Fed, CPI, Binance, lawsuit, halving, ...).

API CONTRACT (consumed by the gate engine):
  window.hgNewsRisk(symbol)  // SYNCHRONOUS — never blocks on fetch
    -> { risk:'high'|'med'|'low',
         events:[{title, when, impact}],
         blackout:boolean,
         note:string }
    Before the first successful refresh returns data: risk 'low', empty
    events, blackout false, note 'news not loaded'. Call hgNewsRefresh()
    (async, fire-and-forget) to populate the cache.

PURE EXPORTS (no DOM, vm-testable):
  window.parseFFCalendar(xml)      -> [{title, country, impact, t, allDay, tentative, forecast, previous}]
  window.parseNewsRSS(text, source)-> [{title, link, t, source}]
  window.scoreHeadline(title)      -> {score, impact:'high'|'med'|'low', sentiment:'bullish'|'bearish'|'neutral', tags:[...]}
  window.newsIsGoldSymbol(symbol)  -> boolean (XAU/PAXG/GOLD base)
  window.newsEventHitsSymbol(event, symbol) -> boolean (USD events hit everything)
  window.newsBlackout(nowMs, events, beforeMin, afterMin) -> event | null
  window.newsRiskFromEvents(symbol, events, nowMs, opts?) -> the hgNewsRisk shape
  window.hgNewsRefresh(force?)     -> Promise<state> (async, never throws)
  window.hgNewsState()             -> current cache snapshot (read-only use)

Registers via window.HG_tabs.push({id:'news', label:'NEWS', mount, refresh}).
refresh() implements the ⟳ HARD REFRESH contract: async, never throws,
returns 'refreshed' | 'busy' | 'skipped: fetch unavailable', forces a
re-fetch past the 15-min cache, busy-guarded against overlap.
Classic script, IIFE, never throws at load; every global feature-checked.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables ---------------- */
var FF_URL      = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
var FNG_URL     = 'https://api.alternative.me/fng/?limit=1';
var RSS_SOURCES = [
  { url: 'https://cointelegraph.com/rss',                          source: 'cointelegraph' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',        source: 'coindesk' }
];
var PROXY        = function(u){ return '/api/proxy?url=' + encodeURIComponent(u); };
var CACHE_MS     = 15*60*1000;     // 15 min calendar/headline cache
var FETCH_TIMEOUT_MS = 12000;
var LOOKAHEAD_MS = 48*3600e3;      // events shown/considered up to 48h out
var HIGH_RISK_MS = 24*3600e3;      // high-impact within 24h -> risk 'high'
var BLACKOUT_BEFORE_MIN = 60;      // default blackout: 1h before high-impact
var BLACKOUT_AFTER_MIN  = 60;      //                ... to 1h after
var HEADLINES_MAX = 12;            // top impact headlines kept/rendered
var GOLD_BASES = { XAU:1, PAXG:1, GOLD:1, XAUUSD:1 };

/* ---------------- module cache (the ONLY async-fed state) ---------------- */
var NEWS = {
  loaded: false,          // true once at least one calendar/headline leg landed
  at: 0,                  // Date.now() of last successful refresh
  events: [],             // parsed FF calendar events (all impacts kept; filtered later)
  headlines: [],          // scored headlines, sorted by score desc
  fng: null,              // { value, classification, t } | null
  errors: []              // honest per-leg failure notes
};
var __refreshing = null;  // in-flight refresh promise (dedupe)

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function xmlUnesc(s){
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function cdata(s){
  // unwrap <![CDATA[...]]> if present
  var m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(String(s == null ? '' : s));
  return m ? m[1] : String(s == null ? '' : s);
}
function iso(t){ try{ return new Date(t*1000).toISOString(); }catch(e){ return null; } }

/* =============== US Eastern (ET) -> UTC conversion =================
   FF calendar times are ET. US DST: 2nd Sunday of March 02:00 local ->
   1st Sunday of November 02:00 local. EDT = UTC-4, EST = UTC-5. */
function __nthSunday(year, month0, n){ // day-of-month of the n-th Sunday (1-based)
  var first = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1)*7;
}
function isUsDst(y, m0, d){ // month0: 0=Jan
  if (m0 < 2 || m0 > 10) return false;          // Dec/Jan/Feb -> EST
  if (m0 > 2 && m0 < 10) return true;           // Apr..Oct -> EDT
  if (m0 === 2)  return d >= __nthSunday(y, 2, 2);   // March: from 2nd Sunday
  return d < __nthSunday(y, 10, 1);                  // November: before 1st Sunday
}
/* date 'MM-DD-YYYY', time '8:30am' | '12:00pm' | 'All Day' | 'Tentative' | ''
   -> unix seconds UTC. All-day/tentative/unknown -> 12:00 UTC that day,
   flagged by the caller via the returned flags. */
function ffTimeToUtc(dateStr, timeStr){
  var dm = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(dateStr || '').trim());
  if (!dm) return null;
  var mo = +dm[1], dy = +dm[2], yr = +dm[3];
  if (mo < 1 || mo > 12 || dy < 1 || dy > 31) return null;
  var ts = String(timeStr || '').trim().toLowerCase();
  var tm = /^(\d{1,2}):(\d{2})\s*(am|pm)$/.exec(ts);
  if (!tm) return { t: Math.floor(Date.UTC(yr, mo - 1, dy, 12, 0)/1000), allDay: true };
  var h = +tm[1], mi = +tm[2];
  if (h < 1 || h > 12 || mi > 59) return { t: Math.floor(Date.UTC(yr, mo - 1, dy, 12, 0)/1000), allDay: true };
  if (tm[3] === 'am'){ if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  var etOff = isUsDst(yr, mo - 1, dy) ? 4 : 5; // hours ET is BEHIND UTC
  return { t: Math.floor(Date.UTC(yr, mo - 1, dy, h + etOff, mi)/1000), allDay: false };
}

/* ---------------- pure: ForexFactory weekly calendar XML ----------------
   <weeklyevents><event><title>..</title><country>USD</country>
   <date>MM-DD-YYYY</date><time>8:30am</time><impact>High</impact>
   <forecast>..</forecast><previous>..</previous></event>...</weeklyevents>
   Regex-based on purpose: runs identically in browser, Node vm and tests
   (no DOMParser dependency). Malformed input -> []. */
function parseFFCalendar(xml){
  var out = [];
  try{
    if (!xml || typeof xml !== 'string') return out;
    var blocks = xml.match(/<event>[\s\S]*?<\/event>/g);
    if (!blocks) return out;
    function field(b, tag){
      var m = new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>').exec(b);
      return m ? xmlUnesc(cdata(m[1])).trim() : '';
    }
    for (var i = 0; i < blocks.length; i++){
      var b = blocks[i];
      var title = field(b, 'title');
      var country = field(b, 'country').toUpperCase();
      var impact = field(b, 'impact');
      var dateS = field(b, 'date'), timeS = field(b, 'time');
      if (!title || !dateS) continue;
      var tt = ffTimeToUtc(dateS, timeS);
      if (!tt) continue;
      var imp = /high/i.test(impact) ? 'high' : (/medium/i.test(impact) ? 'med' : (/low/i.test(impact) ? 'low' : 'none'));
      var tentative = /tentative/i.test(timeS);
      out.push({
        title: title,
        country: country,
        impact: imp,
        t: tt.t,
        when: iso(tt.t),
        allDay: !!tt.allDay,
        tentative: tentative,
        forecast: field(b, 'forecast'),
        previous: field(b, 'previous')
      });
    }
    out.sort(function(a, b2){ return a.t - b2.t; });
  }catch(e){ /* malformed xml -> [] */ }
  return out;
}

/* ---------------- pure: RSS headline scan ---------------- */
function parseNewsRSS(text, source){
  var out = [];
  try{
    if (!text || typeof text !== 'string') return out;
    var items = text.match(/<item>[\s\S]*?<\/item>/g) || text.match(/<entry>[\s\S]*?<\/entry>/g);
    if (!items) return out;
    function field(b, tag){
      var m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>').exec(b);
      return m ? xmlUnesc(cdata(m[1])).trim() : '';
    }
    for (var i = 0; i < items.length; i++){
      var title = field(items[i], 'title');
      if (!title) continue;
      var link = field(items[i], 'link');
      var ds = field(items[i], 'pubDate') || field(items[i], 'published') || field(items[i], 'updated');
      var t = Date.parse(ds);
      out.push({ title: title, link: link, t: isNaN(t) ? null : Math.floor(t/1000), source: source || 'rss' });
    }
  }catch(e){ /* malformed feed -> [] */ }
  return out;
}

/* ---------------- pure: headline impact + sentiment scoring ----------------
   Impact keywords (weighted): catastrophic market structure words weigh most.
   Sentiment: regulatory/attack/fear words bearish; approval/adoption words
   bullish; ties/neither -> neutral. Deterministic, case-insensitive. */
var HEADLINE_WEIGHTS = [
  [/\bhack(?:ed|s)?\b|\bexploit(?:ed|s)?\b|\bbreach(?:ed)?\b|\bstolen\b|\bdrained\b/i, 5, 'security'],
  [/\bliquidation cascade\b|\bcascade(?:s|d)?\b|\bflash crash\b/i,                      4, 'liquidations'],
  [/\bsec\b|\blawsuit\b|\bsue[sd]?\b|\bindict(?:ed|ment)?\b|\bfraud\b|\bcftc\b|\bdoj\b/i, 3, 'regulation'],
  [/\bban(?:ned|s)?\b|\bcrackdown\b|\bshutdown\b|\bdelist(?:ed|ing)?\b/i,               3, 'regulation'],
  [/\bfomc\b|\bfed\b|\bfederal reserve\b|\bpowell\b|\brate (?:hike|cut|decision)\b/i,   3, 'macro'],
  [/\bcpi\b|\binflation\b|\bpce\b|\bjobs report\b|\bpayrolls?\b|\bnfp\b/i,              3, 'macro'],
  [/\betf\b|\bblackrock\b|\bspot etf\b|\binflows?\b|\boutflows?\b/i,                    2, 'etf'],
  [/\bbinance\b|\bcoinbase\b|\bkraken\b|\bbybit\b|\bftx\b/i,                            2, 'exchange'],
  [/\bhalving\b|\bupgrade\b|\bhard fork\b|\bfork\b/i,                                   2, 'network'],
  [/\bwhale\b|\bselloff\b|\bsell-off\b|\bdump(?:s|ed)?\b|\bcrash(?:es|ed)?\b|\bplunge[sd]?\b/i, 2, 'flows'],
  [/\btariff/i, 2, 'macro']
];
var HEADLINE_BULL = [/\bapprov(?:es|ed|al)\b/i, /\binflows?\b/i, /\badoption\b/i, /\brecord high\b|\ball-time high\b|\bath\b/i, /\brally\b|\brallies\b|\bsurge[sd]?\b|\bsoar(?:s|ed)?\b/i, /\bbullish\b/i, /\brate cut\b/i, /\bpartnership\b/i, /\baccumulat/i];
var HEADLINE_BEAR = [/\bhack(?:ed|s)?\b|\bexploit\b|\bstolen\b|\bbreach/i, /\bban(?:ned|s)?\b|\bcrackdown\b/i, /\blawsuit\b|\bsue[sd]?\b|\bindict|\bfraud\b/i, /\bliquidat/i, /\bcrash(?:es|ed)?\b|\bplunge[sd]?\b|\bselloff\b|\bsell-off\b|\bdump/i, /\bbearish\b/i, /\brate hike\b/i, /\bdelist/i, /\bfears?\b|\bwarning\b/i, /\boutflows?\b/i];

function scoreHeadline(title){
  var score = 0, tags = [], tagSeen = {};
  var s = String(title == null ? '' : title);
  if (!s.trim()) return { score: 0, impact: 'low', sentiment: 'neutral', tags: [] };
  for (var i = 0; i < HEADLINE_WEIGHTS.length; i++){
    var rule = HEADLINE_WEIGHTS[i];
    if (rule[0].test(s)){
      score += rule[1];
      if (!tagSeen[rule[2]]){ tagSeen[rule[2]] = 1; tags.push(rule[2]); }
    }
  }
  if (score > 10) score = 10;
  var bull = 0, bear = 0, j;
  for (j = 0; j < HEADLINE_BULL.length; j++) if (HEADLINE_BULL[j].test(s)) bull++;
  for (j = 0; j < HEADLINE_BEAR.length; j++) if (HEADLINE_BEAR[j].test(s)) bear++;
  var sentiment = (bull > bear) ? 'bullish' : (bear > bull ? 'bearish' : 'neutral');
  var impact = (score >= 5) ? 'high' : (score >= 3 ? 'med' : 'low');
  return { score: score, impact: impact, sentiment: sentiment, tags: tags };
}

/* ---------------- pure: symbol -> event mapping ----------------
   Per the brief: USD events flag ALL crypto symbols AND gold (XAU/PAXG).
   Non-USD calendar rows (EUR, GBP, JPY, CNY...) do not gate crypto/gold. */
function newsIsGoldSymbol(symbol){
  var b = String(symbol == null ? '' : symbol).toUpperCase()
        .replace(/[^A-Z]/g, '')
        .replace(/(USDT|USDC|BUSD|USD|PERP)$/, '');
  return !!GOLD_BASES[b];
}
function newsEventHitsSymbol(ev, symbol){
  if (!ev || !symbol) return false;
  return String(ev.country || '').toUpperCase() === 'USD';
}

/* ---------------- pure: blackout window math ----------------
   Blackout = now inside [t - beforeMin, t + afterMin] (inclusive) of any
   HIGH-impact event in `events`. Returns the driving event or null. */
function newsBlackout(nowMs, events, beforeMin, afterMin){
  if (!Array.isArray(events)) return null;
  beforeMin = (typeof beforeMin === 'number' && isFinite(beforeMin)) ? beforeMin : BLACKOUT_BEFORE_MIN;
  afterMin  = (typeof afterMin  === 'number' && isFinite(afterMin))  ? afterMin  : BLACKOUT_AFTER_MIN;
  for (var i = 0; i < events.length; i++){
    var ev = events[i];
    if (!ev || ev.impact !== 'high' || !(ev.t > 0)) continue;
    var lo = ev.t*1000 - beforeMin*60000;
    var hi = ev.t*1000 + afterMin*60000;
    if (nowMs >= lo && nowMs <= hi) return ev;
  }
  return null;
}

/* ---------------- pure: risk classification ----------------
   risk 'high' : blackout active now, OR a high-impact hitting event within 24h
   risk 'med'  : high-impact within 48h, OR a medium-impact within 24h
   risk 'low'  : otherwise (incl. empty input)
   opts: { beforeMin, afterMin, highRiskMs, lookaheadMs } overrides. */
function newsRiskFromEvents(symbol, events, nowMs, opts){
  opts = opts || {};
  if (!symbol || !Array.isArray(events)) {
    return { risk: 'low', events: [], blackout: false, note: 'no calendar data' };
  }
  nowMs = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
  var lookaheadMs = (typeof opts.lookaheadMs === 'number') ? opts.lookaheadMs : LOOKAHEAD_MS;
  var highRiskMs  = (typeof opts.highRiskMs  === 'number') ? opts.highRiskMs  : HIGH_RISK_MS;
  var afterPadMs  = ((typeof opts.afterMin === 'number') ? opts.afterMin : BLACKOUT_AFTER_MIN)*60000;

  var rel = [];
  for (var i = 0; i < events.length; i++){
    var ev = events[i];
    if (!ev || (ev.impact !== 'high' && ev.impact !== 'med')) continue;
    if (!newsEventHitsSymbol(ev, symbol)) continue;
    var tms = ev.t*1000;
    if (tms < nowMs - afterPadMs) continue;      // already past its blackout tail
    if (tms > nowMs + lookaheadMs) continue;     // beyond the considered horizon
    rel.push(ev);
  }
  rel.sort(function(a, b){ return a.t - b.t; });

  var bo = newsBlackout(nowMs, rel, opts.beforeMin, opts.afterMin);
  var out = {
    risk: 'low',
    events: rel.map(function(e){
      return { title: e.title, when: e.when || iso(e.t), impact: e.impact };
    }),
    blackout: !!bo,
    note: 'no high-impact USD events within ' + Math.round(lookaheadMs/3600e3) + 'h'
  };
  if (!rel.length) return out;

  var nextHigh = null, nextMed = null, k;
  for (k = 0; k < rel.length; k++){
    if (rel[k].impact === 'high' && rel[k].t*1000 >= nowMs - afterPadMs && !nextHigh) nextHigh = rel[k];
    if (rel[k].impact === 'med'  && rel[k].t*1000 >= nowMs - afterPadMs && !nextMed)  nextMed  = rel[k];
  }
  if (bo){
    out.risk = 'high';
    out.note = 'BLACKOUT: ' + bo.title + ' — within the ' +
      ((typeof opts.beforeMin === 'number') ? opts.beforeMin : BLACKOUT_BEFORE_MIN) + 'm/' +
      ((typeof opts.afterMin === 'number')  ? opts.afterMin  : BLACKOUT_AFTER_MIN) + 'm high-impact window';
    return out;
  }
  if (nextHigh && nextHigh.t*1000 - nowMs <= highRiskMs){
    out.risk = 'high';
    out.note = 'high-impact USD event ' + (nextHigh.t*1000 >= nowMs ? 'in ' + __dur(nextHigh.t*1000 - nowMs) : 'just passed') + ': ' + nextHigh.title;
    return out;
  }
  if (nextHigh){
    out.risk = 'med';
    out.note = 'high-impact USD event in ' + __dur(nextHigh.t*1000 - nowMs) + ': ' + nextHigh.title;
    return out;
  }
  if (nextMed && nextMed.t*1000 - nowMs <= highRiskMs){
    out.risk = 'med';
    out.note = 'medium-impact USD event in ' + __dur(Math.max(0, nextMed.t*1000 - nowMs)) + ': ' + nextMed.title;
    return out;
  }
  return out;
}
function __dur(ms){
  ms = Math.max(0, ms);
  var m = Math.round(ms/60000);
  if (m < 60) return m + 'm';
  var h = Math.floor(m/60);
  return h + 'h ' + (m % 60) + 'm';
}

/* ---------------- synchronous risk gate (the exported API) ---------------- */
function hgNewsRisk(symbol, opts){
  try{
    if (!NEWS.loaded){
      return { risk: 'low', events: [], blackout: false, note: 'news not loaded' };
    }
    return newsRiskFromEvents(symbol, NEWS.events, Date.now(), opts);
  }catch(e){
    return { risk: 'low', events: [], blackout: false, note: 'news error: ' + (e && e.message) };
  }
}

/* ---------------- async refresh (fire-and-forget, never throws) ---------------- */
function __fetchText(url){
  var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
    .then(function(res){
      if (!res || !res.ok) return null;
      return res.text();
    })
    .catch(function(){ return null; })
    .finally(function(){ if (timer) clearTimeout(timer); });
}
function __fetchJson(url){
  return __fetchText(url).then(function(t){
    if (!t) return null;
    try{ return JSON.parse(t); }catch(e){ return null; }
  });
}

async function hgNewsRefresh(force){
  if (typeof fetch !== 'function'){
    NEWS.errors = ['fetch unavailable in this environment'];
    return NEWS;
  }
  if (!force && NEWS.loaded && (Date.now() - NEWS.at) < CACHE_MS) return NEWS;
  if (__refreshing) return __refreshing;
  __refreshing = (async function(){
    var errors = [];
    var gotSomething = false;

    // leg 1: ForexFactory weekly calendar via the same-origin proxy
    try{
      var xml = await __fetchText(PROXY(FF_URL));
      if (xml){
        var evs = parseFFCalendar(xml);
        if (evs.length){ NEWS.events = evs; gotSomething = true; }
        else errors.push('calendar: no events parsed');
      } else errors.push('calendar: proxy fetch failed');
    }catch(e){ errors.push('calendar: ' + (e && e.message)); }

    // leg 2: alternative.me fear & greed (direct, CORS-open)
    try{
      var fj = await __fetchJson(FNG_URL);
      var d = fj && fj.data && fj.data[0];
      if (d && isFinite(+d.value)){
        NEWS.fng = { value: +d.value, classification: String(d.value_classification || ''), t: +d.timestamp || null };
        gotSomething = true;
      } else errors.push('fear/greed: unavailable');
    }catch(e){ errors.push('fear/greed: ' + (e && e.message)); }

    // leg 3: headline RSS via proxy, impact-scored — every source fails
    // independently so one broken feed never costs the other's headlines
    var all = [];
    for (var i = 0; i < RSS_SOURCES.length; i++){
      var src = RSS_SOURCES[i];
      try{
        var txt = await __fetchText(PROXY(src.url));
        if (!txt){ errors.push('rss ' + src.source + ': fetch failed'); continue; }
        all = all.concat(parseNewsRSS(txt, src.source));
      }catch(e){ errors.push('rss ' + src.source + ': ' + (e && e.message)); }
    }
    try{
      if (all.length){
        all = all.map(function(h){
          var sc = scoreHeadline(h.title);
          return { title: h.title, link: h.link, t: h.t, source: h.source,
                   score: sc.score, impact: sc.impact, sentiment: sc.sentiment, tags: sc.tags };
        }).sort(function(a, b){ return (b.score - a.score) || ((b.t || 0) - (a.t || 0)); });
        NEWS.headlines = all.slice(0, HEADLINES_MAX);
        gotSomething = true;
      } else errors.push('rss: no headlines parsed');
    }catch(e){ errors.push('rss: ' + (e && e.message)); }

    if (gotSomething){ NEWS.loaded = true; NEWS.at = Date.now(); }
    NEWS.errors = errors;
    return NEWS;
  })();
  try{ return await __refreshing; }
  finally{ __refreshing = null; }
}

function hgNewsState(){ return NEWS; }

/* ---------------- hard-refresh contract (⟳ HARD REFRESH button) ----------------
   Called by index.html's hardRefreshAll via HG_TAB_MODS['news'].refresh().
   async, NEVER throws, terse status string; busy-guarded so overlapping
   invocations don't double-fetch (reuses the __refreshing dedupe). Forces a
   re-fetch (bypasses the 15-min cache) — news legs are three light HTTP
   calls, never a full-universe scan, so a global refresh may safely run it
   even before first mount. */
async function refresh(){
  try{
    if (typeof fetch !== 'function') return 'skipped: fetch unavailable';
    if (__refreshing) return 'busy';
    await hgNewsRefresh(true);
    return 'refreshed';
  }catch(e){
    return 'refresh failed: ' + (e && e.message ? e.message : 'unknown');
  }
}

/* =============================== NEWS TAB =============================== */
function riskColor(r){ return r === 'high' ? 'var(--veto)' : (r === 'med' ? 'var(--gold)' : 'var(--pass)'); }
function fngColor(v){ return v <= 25 ? 'var(--veto)' : (v <= 45 ? 'var(--gold)' : (v <= 55 ? 'var(--mut)' : 'var(--pass)')); }

function __countdown(t, nowMs){
  var d = t*1000 - nowMs;
  if (d > 0) return 'in ' + __dur(d);
  var agoM = Math.round(-d/60000);
  return agoM < 1 ? 'now' : agoM + 'm ago';
}

function renderNews(el){
  var nowMs = Date.now();
  var html = '';

  /* ---- header row ---- */
  html += '<div class="panel">'
    + '<h2>NEWS INTELLIGENCE <span>macro calendar · headline impact · sentiment</span></h2>'
    + '<div class="row">'
    +   '<button class="btn" id="newsRun">REFRESH NEWS</button>'
    +   '<span class="note" id="newsStat">' + (NEWS.loaded
          ? 'updated ' + new Date(NEWS.at).toTimeString().slice(0, 8) + ' · cache 15m'
          : 'news not loaded — hit REFRESH (loads in background, never blocks the terminal)') + '</span>'
    + '</div>'
    + (NEWS.errors && NEWS.errors.length
        ? '<div class="note warn" style="margin-top:6px">degraded legs: ' + esc(NEWS.errors.join(' · ')) + '</div>'
        : '')
    + '<div class="note" style="margin-top:6px">Blackout rule: no new entries 1h before → 1h after high-impact USD events. '
    + 'USD events flag ALL crypto symbols and gold (XAU/PAXG). Sources: ForexFactory weekly calendar (via /api/proxy), '
    + 'alternative.me F&amp;G, CoinTelegraph/CoinDesk RSS.</div>'
    + '</div>';

  /* ---- fear & greed + watchlist risk ribbon ---- */
  html += '<div class="grid2">'
    + '<div class="panel"><h2>FEAR &amp; GREED <span>alternative.me</span></h2>';
  if (NEWS.fng && isFinite(NEWS.fng.value)){
    var v = NEWS.fng.value;
    html += '<div class="row" style="align-items:baseline">'
      + '<span class="big" style="color:' + fngColor(v) + '">' + v + '</span>'
      + '<span class="gpip' + ((v <= 25 || v >= 75) ? '' : ' ok') + '" style="font-size:11px">' + esc(NEWS.fng.classification.toUpperCase() || '—') + '</span>'
      + '</div>'
      + '<div class="prog" style="display:block;margin-top:10px"><i style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + fngColor(v) + '"></i></div>'
      + '<div class="note" style="margin-top:6px">&lt;25 extreme fear (contrarian long tail) · &gt;75 extreme greed (crowded longs). Context only — never a standalone signal.</div>';
  } else {
    html += '<div class="empty">fear/greed not loaded</div>';
  }
  html += '</div>';

  /* watchlist risk ribbon */
  html += '<div class="panel"><h2>WATCHLIST NEWS RISK <span>hgNewsRisk per symbol</span></h2>';
  var watch = null;
  try{
    if (typeof loadCoilWatch === 'function') watch = loadCoilWatch();
    if (!watch && typeof localStorage !== 'undefined') watch = JSON.parse(localStorage.getItem('hardgate_coilwatch_v1') || 'null');
  }catch(e){ watch = null; }
  if (watch && watch.list && watch.list.length){
    html += '<div class="gates" style="margin-top:2px">'
      + watch.list.map(function(sym){
          var r = hgNewsRisk(sym);
          return '<span class="gpip" style="color:' + riskColor(r.risk) + ';border-color:' + riskColor(r.risk) + '" title="' + esc(r.note) + '">'
            + esc(sym) + ' · ' + r.risk.toUpperCase() + (r.blackout ? ' ⛔' : '') + '</span>';
        }).join('')
      + '</div>'
      + '<div class="note" style="margin-top:8px">hover a chip for the driver note · ⛔ = blackout window active now</div>';
  } else {
    html += '<div class="note">no saved coil watchlist — run FIND COILS on the COIL tab first; the ribbon will map hgNewsRisk() over those symbols.</div>';
  }
  html += '</div></div>';

  /* ---- event timeline ---- */
  html += '<div class="panel"><h2>THIS WEEK — HIGH/MEDIUM IMPACT <span>ForexFactory weekly calendar · times UTC</span></h2>';
  var evs = (NEWS.events || []).filter(function(e){
    return (e.impact === 'high' || e.impact === 'med') && e.country === 'USD';
  });
  if (!NEWS.loaded){
    html += '<div class="empty">calendar not loaded — REFRESH NEWS fetches this week\'s events via the same-origin proxy.</div>';
  } else if (!evs.length){
    html += '<div class="empty">no high/medium USD events on this week\'s calendar.</div>';
  } else {
    html += '<div class="ledger">';
    for (var i = 0; i < evs.length; i++){
      var e = evs[i];
      var bo = newsBlackout(nowMs, [e], BLACKOUT_BEFORE_MIN, BLACKOUT_AFTER_MIN);
      var preBo = !bo && e.impact === 'high' && (e.t*1000 - nowMs) > 0 && (e.t*1000 - nowMs) <= BLACKOUT_BEFORE_MIN*60000 + 24*3600e3;
      var stamp = bo ? '<span class="stamp veto">BLACKOUT</span>'
               : (e.impact === 'high' ? '<span class="stamp veto">HIGH</span>' : '<span class="stamp na">MED</span>');
      var when = (e.when || iso(e.t) || '').replace('T', ' ').slice(5, 16) + ' UTC';
      html += '<div class="lrow"' + (bo ? ' style="background:rgba(228,88,107,.06)"' : '') + '>'
        + '<span class="gid">' + esc(e.country) + '</span>'
        + '<span class="gname">' + esc(e.title)
        +   (e.allDay ? ' <span class="gpip">ALL DAY</span>' : '')
        +   (e.tentative ? ' <span class="gpip">TENTATIVE</span>' : '')
        + '</span>'
        + '<span class="gdetail">' + esc(when) + ' · ' + esc(__countdown(e.t, nowMs))
        +   (e.forecast || e.previous ? ' · F ' + esc(e.forecast || '—') + ' / P ' + esc(e.previous || '—') : '')
        +   (bo ? ' · no new entries until ' + esc(__countdown(e.t + BLACKOUT_AFTER_MIN*60, nowMs)) : '')
        +   (preBo ? ' · blackout starts ' + esc(__countdown(e.t - BLACKOUT_BEFORE_MIN*60, nowMs)) : '')
        + '</span>'
        + stamp
        + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  /* ---- headlines ---- */
  html += '<div class="panel"><h2>HEADLINE IMPACT SCAN <span>cointelegraph · coindesk RSS</span></h2>';
  if (NEWS.headlines && NEWS.headlines.length){
    html += '<div class="ledger">'
      + NEWS.headlines.map(function(h){
          var impStamp = h.impact === 'high' ? '<span class="stamp veto">HIGH ' + h.score + '</span>'
                       : h.impact === 'med' ? '<span class="stamp na">MED ' + h.score + '</span>'
                       : '<span class="stamp pass">LOW ' + h.score + '</span>';
          var sentCls = h.sentiment === 'bullish' ? 'pass' : (h.sentiment === 'bearish' ? 'veto' : 'na');
          var age = h.t ? __countdown(h.t, nowMs).replace('in ', '') : '—';
          return '<div class="lrow">'
            + '<span class="gid">' + esc(h.source.slice(0, 4).toUpperCase()) + '</span>'
            + '<span class="gname">' + (h.link ? '<a href="' + esc(h.link) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(h.title) + '</a>' : esc(h.title)) + '</span>'
            + '<span class="gdetail">' + esc(age) + (h.tags.length ? ' · ' + esc(h.tags.join(', ')) : '') + '</span>'
            + '<span class="stamp ' + sentCls + '">' + h.sentiment.toUpperCase() + '</span>'
            + impStamp
            + '</div>';
        }).join('')
      + '</div>';
  } else {
    html += '<div class="empty">no headlines loaded yet — they arrive with REFRESH NEWS.</div>';
  }
  html += '</div>';

  el.innerHTML = html;

  var btn = el.querySelector('#newsRun');
  if (btn) btn.addEventListener('click', function(){
    btn.disabled = true;
    var st = el.querySelector('#newsStat');
    if (st) st.textContent = 'refreshing calendar + f&g + headlines…';
    hgNewsRefresh(true).then(function(){
      renderNews(el);
    }).catch(function(){
      if (st) st.textContent = 'refresh failed — showing cached data';
      renderNews(el);
    });
  });
}

function mount(el){
  try{
    if (!el) return;
    renderNews(el);
    // fire-and-forget: populate the cache in the background, then re-render
    if (typeof fetch === 'function'){
      hgNewsRefresh(false).then(function(){
        try{ renderNews(el); }catch(e){}
      }).catch(function(){});
    }
  }catch(e){
    try{ el.innerHTML = '<div class="panel"><div class="note warn">NEWS tab failed to render: ' + esc(e && e.message) + '</div></div>'; }catch(e2){}
  }
}

/* ---------------- exports + tab registration ---------------- */
W.parseFFCalendar     = parseFFCalendar;
W.parseNewsRSS        = parseNewsRSS;
W.scoreHeadline       = scoreHeadline;
W.newsIsGoldSymbol    = newsIsGoldSymbol;
W.newsEventHitsSymbol = newsEventHitsSymbol;
W.newsBlackout        = newsBlackout;
W.newsRiskFromEvents  = newsRiskFromEvents;
W.hgNewsRisk          = hgNewsRisk;
W.hgNewsRefresh       = hgNewsRefresh;
W.hgNewsState         = hgNewsState;
// test hook: seed the cache synchronously (used by tests only)
W.__hgNewsSeed = function(events, fng, headlines){
  NEWS.events = Array.isArray(events) ? events : [];
  NEWS.fng = fng || null;
  NEWS.headlines = Array.isArray(headlines) ? headlines : [];
  NEWS.loaded = true; NEWS.at = Date.now(); NEWS.errors = [];
  return NEWS;
};
W.__hgNewsReset = function(){
  NEWS.loaded = false; NEWS.at = 0; NEWS.events = []; NEWS.headlines = []; NEWS.fng = null; NEWS.errors = [];
};

/* BRAIN warm-up hook: force a fresh calendar/F&G/headline fetch so the
   BRAIN can warm this layer without mounting the tab. Never throws. */
async function newsWarm(){
  try{
    if (NEWS.loaded) return 'fresh';
    await hgNewsRefresh(true);
    if (NEWS.loaded) return 'warmed';
    return 'unavailable: ' + ((NEWS.errors && NEWS.errors[0]) || 'no news source reachable');
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'news', label: 'NEWS', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'news', label: 'NEWS', run: newsWarm });

})();
