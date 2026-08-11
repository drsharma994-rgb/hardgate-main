/* HARDGATE — news.js unit tests (Node 18+, builtins only).
   Loads news.js as a classic script inside a vm context with a `window`
   stub (exactly like the browser's <script> globals) and asserts:
     1) HG_tabs registration ({id:'news', label:'NEWS', mount})
     2) parseFFCalendar: FF weekly XML fixtures, ET->UTC (EDT + EST),
        All Day / Tentative rows, entity + CDATA decoding, malformed input
     3) scoreHeadline: keyword impact weights, sentiment, caps, edge cases
     4) symbol -> event mapping: BTC and XAU both flag on USD CPI; EUR doesn't
     5) blackout window math (boundaries inclusive, custom windows)
     6) hgNewsRisk: cold-cache contract ('news not loaded'), seeded risk levels
     7) hgNewsRefresh full pipeline with stubbed fetch (proxy + fng + rss)
     8) api/proxy.js allowlist contains the new hosts (and keeps the old ones)
     9) mount() smoke on a stub DOM
    10) hard-refresh contract: registration carries refresh, force bypasses
        the 15-min cache, busy dedupe, per-leg failure tolerance
   No live network. Run: node tests/test-news.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'news.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function makeCtx(extra){
  const base = {
    window: {},
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, JSON, Math
  };
  return vm.createContext(Object.assign(Object.create(null), base, extra || {}));
}
function loadModule(ctx){
  vm.runInContext(SRC, ctx, { filename: 'news.js' });
  return ctx.window;
}
function stubEl(){
  return {
    innerHTML: '', textContent: '', style: {}, disabled: false,
    firstElementChild: { style: {} },
    _kids: {},
    addEventListener(ev, fn){ this._click = fn; },
    querySelector(sel){
      if (!this._kids[sel]) this._kids[sel] = stubEl();
      return this._kids[sel];
    }
  };
}

/* ---------------- fixtures ---------------- */
const FF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<weeklyevents>
  <event>
    <title>CPI m/m</title>
    <country>USD</country>
    <date>07-15-2026</date>
    <time>8:30am</time>
    <impact>High</impact>
    <forecast>0.2%</forecast>
    <previous>0.3%</previous>
  </event>
  <event>
    <title>Non-Farm Employment Change</title>
    <country>USD</country>
    <date>01-09-2026</date>
    <time>8:30am</time>
    <impact>High</impact>
    <forecast>180K</forecast>
    <previous>256K</previous>
  </event>
  <event>
    <title>FOMC Statement &amp; Press Conference</title>
    <country>USD</country>
    <date>07-16-2026</date>
    <time>2:00pm</time>
    <impact>High</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
  <event>
    <title>Core PPI m/m</title>
    <country>USD</country>
    <date>07-16-2026</date>
    <time>8:30am</time>
    <impact>Medium</impact>
    <forecast>0.2%</forecast>
    <previous>0.1%</previous>
  </event>
  <event>
    <title>GDP q/q</title>
    <country>EUR</country>
    <date>07-17-2026</date>
    <time>9:00am</time>
    <impact>High</impact>
    <forecast>0.3%</forecast>
    <previous>0.2%</previous>
  </event>
  <event>
    <title><![CDATA[Bank Holiday: US Banks]]></title>
    <country>USD</country>
    <date>07-18-2026</date>
    <time>All Day</time>
    <impact>Low</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
  <event>
    <title>Fed Chair Powell Speaks</title>
    <country>USD</country>
    <date>07-17-2026</date>
    <time>Tentative</time>
    <impact>Medium</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
  <event>
    <title>Broken row, no date</title>
    <country>USD</country>
    <date></date>
    <time>8:30am</time>
    <impact>High</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
</weeklyevents>`;

const RSS_CT = `<?xml version="1.0"?><rss><channel>
  <item><title><![CDATA[Binance faces SEC lawsuit over token listings]]></title>
    <link>https://cointelegraph.com/news/1</link>
    <pubDate>Wed, 15 Jul 2026 10:00:00 GMT</pubDate></item>
  <item><title>Bitcoin ETF sees record inflows as price rallies</title>
    <link>https://cointelegraph.com/news/2</link>
    <pubDate>Wed, 15 Jul 2026 09:00:00 GMT</pubDate></item>
  <item><title>Minor altcoin partners with regional payments firm</title>
    <link>https://cointelegraph.com/news/3</link>
    <pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

const FNG_JSON = JSON.stringify({ data: [{ value: '18', value_classification: 'Extreme Fear', timestamp: '1783000000' }] });

/* ================================================================
   1) TAB REGISTRATION
================================================================ */
console.log('--- HG_tabs registration ---');
{
  const w = loadModule(makeCtx());
  assert(Array.isArray(w.HG_tabs) && w.HG_tabs.length === 1, 'HG_tabs created with one entry');
  const t = w.HG_tabs[0];
  assert(t.id === 'news', 'tab id is news');
  assert(t.label === 'NEWS', 'tab label is NEWS');
  assert(typeof t.mount === 'function', 'tab mount is a function');
  assert(typeof w.hgNewsRisk === 'function', 'window.hgNewsRisk exported for the gate engine');
}

/* ================================================================
   2) parseFFCalendar
================================================================ */
console.log('--- parseFFCalendar ---');
{
  const w = loadModule(makeCtx());
  const evs = w.parseFFCalendar(FF_XML);
  assert(evs.length === 7, 'parses 7 valid events (broken no-date row dropped) — got ' + evs.length);
  assert(evs.every((e, i) => i === 0 || evs[i-1].t <= e.t), 'events sorted by timestamp ascending');

  const cpi = evs.filter(e => e.title === 'CPI m/m')[0];
  assert(!!cpi, 'CPI event present');
  assert(cpi.country === 'USD' && cpi.impact === 'high', 'CPI mapped: USD + High impact');
  assert(cpi.t === Math.floor(Date.UTC(2026, 6, 15, 12, 30)/1000),
    'EDT conversion: 07-15-2026 8:30am ET -> 12:30 UTC (UTC-4)');
  assert(cpi.forecast === '0.2%' && cpi.previous === '0.3%', 'forecast/previous captured');
  assert(cpi.allDay === false && cpi.tentative === false, 'timed event flags correct');

  const nfp = evs.filter(e => e.title === 'Non-Farm Employment Change')[0];
  assert(nfp.t === Math.floor(Date.UTC(2026, 0, 9, 13, 30)/1000),
    'EST conversion: 01-09-2026 8:30am ET -> 13:30 UTC (UTC-5)');

  const fomc = evs.filter(e => e.title.indexOf('FOMC') === 0)[0];
  assert(fomc.title === 'FOMC Statement & Press Conference', 'XML entity &amp; decoded');
  assert(fomc.t === Math.floor(Date.UTC(2026, 6, 16, 18, 0)/1000),
    '2:00pm ET -> 18:00 UTC conversion');

  const hol = evs.filter(e => e.title.indexOf('Bank Holiday') === 0)[0];
  assert(hol.title === 'Bank Holiday: US Banks', 'CDATA title unwrapped');
  assert(hol.allDay === true && hol.t === Math.floor(Date.UTC(2026, 6, 18, 12, 0)/1000),
    'All Day row -> noon UTC, allDay flag set');

  const pow = evs.filter(e => e.title.indexOf('Fed Chair') === 0)[0];
  assert(pow.tentative === true && pow.allDay === true, 'Tentative row flagged, parked at noon UTC');
  assert(pow.impact === 'med', 'Medium impact normalized to med');

  assert(w.parseFFCalendar('<weeklyevents>garbage').length === 0, 'malformed XML -> []');
  assert(w.parseFFCalendar('').length === 0 && w.parseFFCalendar(null).length === 0 && w.parseFFCalendar(42).length === 0,
    'empty/null/non-string input -> []');
  assert(w.parseFFCalendar(FF_XML).length === 7, 'parser is deterministic (repeat parse identical)');
}

/* ================================================================
   3) scoreHeadline
================================================================ */
console.log('--- scoreHeadline ---');
{
  const w = loadModule(makeCtx());
  let r = w.scoreHeadline('Major exchange hack: $400M stolen in exploit');
  assert(r.impact === 'high' && r.score >= 5, 'hack/exploit headline scores high (' + r.score + ')');
  assert(r.sentiment === 'bearish', 'hack headline is bearish');
  assert(r.tags.indexOf('security') >= 0, 'security tag applied');

  r = w.scoreHeadline('SEC files lawsuit against Binance over securities violations');
  assert(r.score >= 3 && r.impact !== 'low', 'SEC+lawsuit+Binance headline at least medium impact (' + r.score + ')');
  assert(r.sentiment === 'bearish', 'lawsuit headline is bearish');
  assert(r.tags.indexOf('regulation') >= 0 && r.tags.indexOf('exchange') >= 0, 'regulation + exchange tags');

  r = w.scoreHeadline('Bitcoin ETF sees record inflows as price rallies');
  assert(r.sentiment === 'bullish', 'ETF inflows + rally is bullish');
  assert(r.score >= 2, 'ETF keyword contributes to impact');

  r = w.scoreHeadline('Fed signals rate cut as CPI inflation cools');
  assert(r.score >= 3 && r.tags.indexOf('macro') >= 0, 'Fed + CPI macro headline scores (deduped tag)');

  r = w.scoreHeadline('Liquidation cascade wipes out leveraged longs in flash crash');
  assert(r.impact === 'high', 'liquidation cascade is high impact');

  r = w.scoreHeadline('Minor altcoin partners with regional payments firm');
  assert(r.score === 0 && r.impact === 'low' && r.sentiment === 'neutral', 'benign headline scores 0 / low / neutral');

  r = w.scoreHeadline('');
  assert(r.score === 0 && r.tags.length === 0, 'empty title -> zero result');

  r = w.scoreHeadline('hack exploit stolen drained breach SEC lawsuit fraud ban crackdown Fed FOMC CPI Binance ETF halving');
  assert(r.score === 10, 'score capped at 10 under keyword pileup (got ' + r.score + ')');
}

/* ================================================================
   4) SYMBOL -> EVENT MAPPING
================================================================ */
console.log('--- symbol mapping: BTC and XAU both flag on USD ---');
{
  const w = loadModule(makeCtx());
  assert(w.newsIsGoldSymbol('XAU') === true, 'XAU is gold');
  assert(w.newsIsGoldSymbol('PAXGUSDT') === true, 'PAXGUSDT is gold (suffix stripped)');
  assert(w.newsIsGoldSymbol('XAUUSD') === true, 'XAUUSD is gold');
  assert(w.newsIsGoldSymbol('BTCUSDT') === false, 'BTCUSDT is not gold');
  assert(w.newsIsGoldSymbol('') === false, 'empty symbol not gold');

  const cpi = { title: 'CPI m/m', country: 'USD', impact: 'high', t: 1784000000 };
  const eur = { title: 'GDP q/q', country: 'EUR', impact: 'high', t: 1784000000 };
  assert(w.newsEventHitsSymbol(cpi, 'BTCUSDT') === true, 'USD CPI hits BTCUSDT');
  assert(w.newsEventHitsSymbol(cpi, 'XAU') === true, 'USD CPI hits XAU (gold)');
  assert(w.newsEventHitsSymbol(cpi, 'PAXGUSDT') === true, 'USD CPI hits PAXGUSDT');
  assert(w.newsEventHitsSymbol(eur, 'BTCUSDT') === false, 'EUR event does NOT hit BTC');
  assert(w.newsEventHitsSymbol(eur, 'XAU') === false, 'EUR event does NOT hit XAU');
  assert(w.newsEventHitsSymbol(cpi, '') === false && w.newsEventHitsSymbol(null, 'BTC') === false,
    'null/empty args -> false');
}

/* ================================================================
   5) BLACKOUT WINDOW MATH
================================================================ */
console.log('--- newsBlackout ---');
{
  const w = loadModule(makeCtx());
  const T = 1784000000; // arbitrary fixed event time (unix seconds)
  const hi = [{ title: 'FOMC', country: 'USD', impact: 'high', t: T }];
  const med = [{ title: 'PPI', country: 'USD', impact: 'med', t: T }];

  assert(w.newsBlackout(T*1000, hi, 60, 60) === hi[0], 'blackout at the event time itself');
  assert(w.newsBlackout(T*1000 - 60*60000, hi, 60, 60) === hi[0], 'lower boundary (t-60m) inclusive');
  assert(w.newsBlackout(T*1000 + 60*60000, hi, 60, 60) === hi[0], 'upper boundary (t+60m) inclusive');
  assert(w.newsBlackout(T*1000 - 61*60000, hi, 60, 60) === null, 't-61m is outside');
  assert(w.newsBlackout(T*1000 + 61*60000, hi, 60, 60) === null, 't+61m is outside');
  assert(w.newsBlackout(T*1000, med, 60, 60) === null, 'medium-impact events do NOT black out');
  assert(w.newsBlackout(T*1000 - 30*60000, hi, 15, 15) === null, 'custom 15m window: t-30m outside');
  assert(w.newsBlackout(T*1000 - 10*60000, hi, 15, 15) === hi[0], 'custom 15m window: t-10m inside');
  assert(w.newsBlackout(T*1000, null) === null && w.newsBlackout(T*1000, 'x') === null,
    'non-array events -> null');
}

/* ================================================================
   6) newsRiskFromEvents + hgNewsRisk contract
================================================================ */
console.log('--- risk classification ---');
{
  const w = loadModule(makeCtx());
  const NOW = Date.UTC(2026, 6, 15, 0, 0); // Wed Jul 15 2026 00:00 UTC
  const cpi = { title: 'CPI m/m', country: 'USD', impact: 'high', t: Math.floor(Date.UTC(2026, 6, 15, 12, 30)/1000), when: '2026-07-15T12:30:00.000Z' };
  const fomcFar = { title: 'FOMC Statement', country: 'USD', impact: 'high', t: Math.floor(Date.UTC(2026, 6, 16, 18, 0)/1000), when: '2026-07-16T18:00:00.000Z' };
  const ppiMed = { title: 'Core PPI m/m', country: 'USD', impact: 'med', t: Math.floor(Date.UTC(2026, 6, 15, 20, 0)/1000), when: '2026-07-15T20:00:00.000Z' };
  const eurGdp = { title: 'GDP q/q', country: 'EUR', impact: 'high', t: Math.floor(Date.UTC(2026, 6, 15, 13, 0)/1000), when: '2026-07-15T13:00:00.000Z' };

  let r = w.newsRiskFromEvents('BTCUSDT', [cpi], NOW);
  assert(r.risk === 'high', 'BTC: USD CPI 12.5h away -> risk high (within 24h)');
  assert(r.events.length === 1 && r.events[0].title === 'CPI m/m' && r.events[0].impact === 'high',
    'events carry {title, when, impact}');
  assert(r.blackout === false, 'not in blackout 12.5h out');

  r = w.newsRiskFromEvents('XAU', [cpi], NOW);
  assert(r.risk === 'high', 'XAU: same USD CPI flags gold too');

  r = w.newsRiskFromEvents('PAXGUSDT', [eurGdp], NOW);
  assert(r.risk === 'low' && r.events.length === 0, 'EUR-only calendar -> low for PAXG');

  r = w.newsRiskFromEvents('ETHUSDT', [fomcFar], NOW);
  assert(r.risk === 'med', 'high-impact 42h out -> med (within 48h lookahead, beyond 24h)');

  r = w.newsRiskFromEvents('ETHUSDT', [ppiMed], NOW);
  assert(r.risk === 'med', 'medium-impact within 24h -> med');

  // blackout: 30 minutes before CPI
  r = w.newsRiskFromEvents('BTCUSDT', [cpi], Date.UTC(2026, 6, 15, 12, 0));
  assert(r.risk === 'high' && r.blackout === true, '30m before high-impact -> blackout + high');
  assert(/BLACKOUT/.test(r.note), 'blackout note names the window');

  // blackout: 30 minutes after CPI
  r = w.newsRiskFromEvents('BTCUSDT', [cpi], Date.UTC(2026, 6, 15, 13, 0));
  assert(r.blackout === true, '30m after high-impact still blackout');

  // event fully past its tail -> dropped
  r = w.newsRiskFromEvents('BTCUSDT', [cpi], Date.UTC(2026, 6, 15, 14, 0));
  assert(r.risk === 'low' && r.events.length === 0, '90m after -> event drops off, risk low');

  // beyond 48h lookahead -> excluded
  const farAway = { title: 'CPI m/m', country: 'USD', impact: 'high', t: Math.floor((NOW + 72*3600e3)/1000), when: null };
  r = w.newsRiskFromEvents('BTCUSDT', [farAway], NOW);
  assert(r.risk === 'low', 'high-impact 72h out -> beyond lookahead, low');

  // no data at all
  r = w.newsRiskFromEvents('BTCUSDT', [], NOW);
  assert(r.risk === 'low' && r.blackout === false, 'empty calendar -> low');

  /* hgNewsRisk cold-cache contract */
  assert(JSON.stringify(w.hgNewsRisk('BTCUSDT')) === JSON.stringify({
    risk: 'low', events: [], blackout: false, note: 'news not loaded'
  }), 'hgNewsRisk before any data: low + note "news not loaded" (never blocks)');

  /* seeded cache drives hgNewsRisk (event placed 2h in the REAL future —
     hgNewsRisk classifies against Date.now()) */
  const liveCpi = { title: 'CPI m/m', country: 'USD', impact: 'high',
                    t: Math.floor((Date.now() + 2*3600e3)/1000), when: new Date(Date.now() + 2*3600e3).toISOString() };
  w.__hgNewsSeed([liveCpi, eurGdp], null, []);
  const rr = w.hgNewsRisk('BTCUSDT');
  assert(rr.risk === 'high' && rr.events.length === 1, 'after seed, hgNewsRisk reflects the USD event only');
  assert(rr.events[0].title === 'CPI m/m', 'seeded event surfaced with title');
  w.__hgNewsReset();
  assert(w.hgNewsRisk('BTCUSDT').note === 'news not loaded', 'reset restores the cold-cache contract');
}

/* ================================================================
   7) hgNewsRefresh pipeline (stubbed fetch, no live network)
================================================================ */
console.log('--- hgNewsRefresh pipeline ---');
{
  const fetchStub = async (url) => {
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return { ok: true, text: async () => FF_XML };
    if (url.indexOf('alternative.me') >= 0) return { ok: true, text: async () => FNG_JSON, json: async () => JSON.parse(FNG_JSON) };
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    if (url.indexOf('coindesk.com') >= 0) return { ok: false, status: 403, text: async () => '' };
    return { ok: false, status: 404, text: async () => '' };
  };
  const w = loadModule(makeCtx({ fetch: fetchStub, AbortController }));
  const st = await w.hgNewsRefresh(true);
  assert(st.loaded === true, 'refresh marks the cache loaded');
  assert(st.calendarOk === true, 'calendar leg marks calendarOk');
  assert(st.events.length === 7, 'calendar leg populated through /api/news/calendar');
  assert(st.fng && st.fng.value === 18 && st.fng.classification === 'Extreme Fear', 'fear/greed leg parsed (18, Extreme Fear)');
  assert(st.headlines.length === 3, '3 cointelegraph headlines parsed (coindesk 403 tolerated)');
  assert(st.headlines[0].title.indexOf('SEC lawsuit') >= 0 && st.headlines[0].score >= st.headlines[1].score,
    'headlines sorted by impact score (SEC lawsuit first)');
  assert(st.headlines[0].sentiment === 'bearish' && st.headlines[1].sentiment === 'bullish',
    'sentiment tags flow through the pipeline');
  assert(st.errors.some(e => e.indexOf('coindesk') >= 0), 'failed coindesk leg reported honestly, not hidden');

  // hgNewsRisk now answers from the refreshed cache
  const rr = w.hgNewsRisk('BTCUSDT');
  assert(['low', 'med', 'high'].indexOf(rr.risk) >= 0 && Array.isArray(rr.events),
    'hgNewsRisk returns the contract shape after refresh');

  // hard failure everywhere -> stays unloaded, never throws
  const w2 = loadModule(makeCtx({ fetch: async () => ({ ok: false, status: 500, text: async () => '' }), AbortController }));
  const st2 = await w2.hgNewsRefresh(true);
  assert(st2.loaded === false && st2.errors.length > 0, 'total fetch failure -> unloaded + honest errors');
  assert(w2.hgNewsRisk('BTCUSDT').note === 'news not loaded', 'failed refresh keeps the cold-cache contract');
}

/* ================================================================
   8) api/proxy.js allowlist
================================================================ */
console.log('--- proxy allowlist ---');
{
  const proxySrc = readFileSync(path.join(root, 'api', 'proxy.js'), 'utf8');
  assert(proxySrc.indexOf("'nfs.faireconomy.media'") >= 0, 'proxy allowlists nfs.faireconomy.media (FF calendar)');
  assert(proxySrc.indexOf("'cointelegraph.com'") >= 0, 'proxy allowlists cointelegraph.com (RSS)');
  assert(proxySrc.indexOf("'www.coindesk.com'") >= 0, 'proxy allowlists www.coindesk.com (RSS)');
  assert(proxySrc.indexOf("'api.coindcx.com'") >= 0 && proxySrc.indexOf("'public.coindcx.com'") >= 0
      && proxySrc.indexOf("'query1.finance.yahoo.com'") >= 0 && proxySrc.indexOf("'query2.finance.yahoo.com'") >= 0,
    'all pre-existing hosts kept');
  assert(/target\.protocol !== 'https:'/.test(proxySrc), 'https-only check retained');
  assert(/ALLOWED_HOSTS\.has\(target\.hostname\)/.test(proxySrc), 'hostname allowlist enforcement retained');
}

/* ================================================================
   9) mount() smoke
================================================================ */
console.log('--- mount smoke ---');
{
  // no fetch, no localStorage, no loadCoilWatch: must still render
  const w = loadModule(makeCtx());
  const el = stubEl();
  let threw = null;
  try{ w.HG_tabs[0].mount(el); }catch(e){ threw = e; }
  assert(!threw, 'mount does not throw with zero globals' + (threw ? ' — got: ' + threw.message : ''));
  assert(el.innerHTML.indexOf('NEWS INTELLIGENCE') >= 0, 'header panel rendered');
  assert(el.innerHTML.indexOf('id="newsRun"') >= 0, 'REFRESH NEWS button present');
  assert(el.innerHTML.indexOf('news not loaded') >= 0, 'cold-cache status shown honestly');
  assert(el.innerHTML.indexOf('fear/greed not loaded') >= 0, 'f&g empty state rendered');
  assert(el.innerHTML.indexOf('FIND COILS') >= 0, 'watchlist fallback note rendered');

  // seeded cache + saved coil watchlist -> ribbon + timeline render
  const store = { hardgate_coilwatch_v1: JSON.stringify({ at: 1, ex: 'delta', list: ['BTCUSD', 'ETHUSD'] }) };
  const localStorageStub = {
    getItem(k){ return (k in store) ? store[k] : null; },
    setItem(k, v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; }
  };
  const w2 = loadModule(makeCtx({ localStorage: localStorageStub }));
  const cpi = { title: 'CPI m/m', country: 'USD', impact: 'high',
                t: Math.floor((Date.now() + 2*3600e3)/1000), when: new Date(Date.now() + 2*3600e3).toISOString() };
  w2.__hgNewsSeed([cpi], { value: 18, classification: 'Extreme Fear', t: 1 },
                  [{ title: 'Binance hack drains hot wallet', link: '', t: null, source: 'ct',
                     score: 6, impact: 'high', sentiment: 'bearish', tags: ['security'] }]);
  const el2 = stubEl();
  try{ w2.HG_tabs[0].mount(el2); }catch(e){ threw = e; }
  assert(el2.innerHTML.indexOf('BTCUSD') >= 0 && el2.innerHTML.indexOf('ETHUSD') >= 0,
    'watchlist risk ribbon renders saved coil symbols');
  assert(el2.innerHTML.indexOf('Extreme Fear'.toUpperCase()) >= 0 && el2.innerHTML.indexOf('>18<') >= 0,
    'fear/greed gauge renders value + classification');
  assert(el2.innerHTML.indexOf('CPI m/m') >= 0 && el2.innerHTML.indexOf('HIGH') >= 0,
    'event timeline renders the high-impact USD event');
  assert(el2.innerHTML.indexOf('WATCHLIST NEWS RISK') >= 0 && el2.innerHTML.indexOf('HEADLINE IMPACT SCAN') >= 0,
    'ribbon + headline sections present');
  assert(el2.innerHTML.indexOf('Binance hack drains hot wallet') >= 0, 'impact headline rendered');

  // calendar fetch failed but headlines/fng loaded -> honest warn, not "no events"
  const w3 = loadModule(makeCtx({ fetch: async (url) => {
    if (url.indexOf('/api/news/calendar') >= 0) return { ok: false, status: 502, text: async () => '' };
    if (url.indexOf('alternative.me') >= 0) return { ok: true, text: async () => FNG_JSON };
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    return { ok: false, status: 404, text: async () => '' };
  }, AbortController }));
  await w3.hgNewsRefresh(true);
  const el3 = stubEl();
  w3.HG_tabs[0].mount(el3);
  assert(el3.innerHTML.indexOf('calendar fetch failed') >= 0, 'calendar failure shows warn, not empty-week message');
  assert(el3.innerHTML.indexOf('no high/medium USD events') < 0, 'calendar failure does not claim zero events');
}

/* ================================================================
   10) HARD-REFRESH CONTRACT (⟳ HARD REFRESH -> mod.refresh())
================================================================ */
console.log('--- hard-refresh contract ---');
{
  /* registration carries the refresh field */
  const w0 = loadModule(makeCtx());
  const t0 = w0.HG_tabs[0];
  assert(typeof t0.refresh === 'function', 'tab registration carries refresh (4th field)');
  assert(t0.id === 'news' && t0.label === 'NEWS' && typeof t0.mount === 'function',
    'id/label/mount intact alongside refresh');

  /* force bypasses the 15-min cache window */
  let calCalls = 0, fngCalls = 0, fngValue = '18';
  const countingFetch = async (url) => {
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0){ calCalls++; return { ok: true, text: async () => FF_XML }; }
    if (url.indexOf('alternative.me') >= 0){
      fngCalls++;
      const body = JSON.stringify({ data: [{ value: fngValue, value_classification: 'Fear', timestamp: '1783000000' }] });
      return { ok: true, text: async () => body };
    }
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    return { ok: false, status: 404, text: async () => '' };
  };
  const w = loadModule(makeCtx({ fetch: countingFetch, AbortController }));
  await w.hgNewsRefresh(true);
  assert(calCalls === 1 && fngCalls === 1, 'first refresh fetches calendar + fng');
  await w.hgNewsRefresh(false);
  assert(calCalls === 1 && fngCalls === 1, 'non-forced refresh inside 15-min window stays cached (no re-fetch)');
  fngValue = '42';
  const s1 = await w.HG_tabs[0].refresh();
  assert(s1 === 'refreshed', 'refresh() resolves with "refreshed"');
  assert(calCalls === 2 && fngCalls === 2, 'refresh() forces re-fetch even inside the cache window');
  assert(w.hgNewsState().fng.value === 42, 'forced refresh picks up changed data despite the cache window');

  /* busy dedupe: an in-flight refresh -> 'busy', never a second fetch */
  let resolveCal;
  const calGate = new Promise(r => { resolveCal = r; });
  const slowFetch = (url) => {
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return calGate.then(() => ({ ok: true, text: async () => FF_XML }));
    if (url.indexOf('alternative.me') >= 0) return Promise.resolve({ ok: true, text: async () => FNG_JSON });
    if (url.indexOf('cointelegraph.com') >= 0) return Promise.resolve({ ok: true, text: async () => RSS_CT });
    return Promise.resolve({ ok: false, status: 404, text: async () => '' });
  };
  const wb = loadModule(makeCtx({ fetch: slowFetch, AbortController }));
  const inflight = wb.hgNewsRefresh(true);          // starts, parks on the gated calendar leg
  const busyStatus = await wb.HG_tabs[0].refresh(); // overlaps the in-flight refresh
  assert(busyStatus === 'busy', 'refresh() during an in-flight fetch returns "busy" (no double-fetch)');
  resolveCal();
  await inflight;
  assert(wb.hgNewsState().loaded === true, 'the in-flight refresh still completes and populates the cache');
  const s2 = await wb.HG_tabs[0].refresh();
  assert(s2 === 'refreshed', 'busy guard releases: refresh() works again after the in-flight completes');

  /* per-leg failure tolerance: each leg fails independently */
  const wcal = loadModule(makeCtx({ fetch: async (url) => {
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return { ok: false, status: 500, text: async () => '' };
    if (url.indexOf('alternative.me') >= 0) return { ok: true, text: async () => FNG_JSON };
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    return { ok: false, status: 404, text: async () => '' };
  }, AbortController }));
  const scal = await wcal.hgNewsRefresh(true);
  assert(scal.loaded === true && scal.fng && scal.fng.value === 18 && scal.headlines.length === 3
      && scal.errors.some(e => e.indexOf('calendar') >= 0),
    'calendar leg dead -> fng + headlines still land, degraded-legs note names calendar');

  const wfng = loadModule(makeCtx({ fetch: async (url) => {
    if (url.indexOf('alternative.me') >= 0) throw new Error('fng boom');
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return { ok: true, text: async () => FF_XML };
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    return { ok: false, status: 404, text: async () => '' };
  }, AbortController }));
  const sfng = await wfng.hgNewsRefresh(true);
  assert(sfng.loaded === true && sfng.events.length === 7 && sfng.headlines.length === 3
      && sfng.errors.some(e => e.indexOf('fear/greed') >= 0),
    'fng leg throwing -> calendar + headlines still land, degraded-legs note names fear/greed');

  const wrss = loadModule(makeCtx({ fetch: async (url) => {
    if (url.indexOf('coindesk.com') >= 0) throw new Error('coindesk boom');
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return { ok: true, text: async () => FF_XML };
    if (url.indexOf('alternative.me') >= 0) return { ok: true, text: async () => FNG_JSON };
    if (url.indexOf('cointelegraph.com') >= 0) return { ok: true, text: async () => RSS_CT };
    return { ok: false, status: 404, text: async () => '' };
  }, AbortController }));
  const srss = await wrss.hgNewsRefresh(true);
  assert(srss.headlines.length === 3 && srss.errors.some(e => e.indexOf('coindesk') >= 0),
    'one RSS source throwing -> the other source\'s headlines survive, failed source noted');

  const wrss2 = loadModule(makeCtx({ fetch: async (url) => {
    if (url.indexOf('cointelegraph.com') >= 0 || url.indexOf('coindesk.com') >= 0) return { ok: false, status: 503, text: async () => '' };
    if (url.indexOf('/api/news/calendar') >= 0 || url.indexOf('ff_calendar_thisweek.xml') >= 0) return { ok: true, text: async () => FF_XML };
    if (url.indexOf('alternative.me') >= 0) return { ok: true, text: async () => FNG_JSON };
    return { ok: false, status: 404, text: async () => '' };
  }, AbortController }));
  const srss2 = await wrss2.hgNewsRefresh(true);
  assert(srss2.loaded === true && srss2.events.length === 7 && srss2.headlines.length === 0
      && srss2.errors.filter(e => e.indexOf('rss') >= 0).length >= 2,
    'both RSS sources dead -> calendar + fng still mark the cache loaded, both sources noted');

  /* never throws, honest status in pathological environments */
  const wall = loadModule(makeCtx({ fetch: async () => { throw new Error('total network outage'); }, AbortController }));
  let threw = null, allStatus = null;
  try{ allStatus = await wall.HG_tabs[0].refresh(); }catch(e){ threw = e; }
  assert(!threw, 'refresh() never throws even when every fetch throws' + (threw ? ' — got: ' + threw.message : ''));
  assert(typeof allStatus === 'string' && allStatus.length > 0 && allStatus.length < 64,
    'refresh() always resolves with a terse status string (got "' + allStatus + '")');
  assert(wall.hgNewsState().errors.length > 0, 'total failure still records degraded legs honestly');

  const wnf = loadModule(makeCtx()); // no fetch global at all
  const nfStatus = await wnf.HG_tabs[0].refresh();
  assert(nfStatus === 'skipped: fetch unavailable', 'no fetch in environment -> "skipped: fetch unavailable", never throws');
}

/* ---------------- summary ---------------- */
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
