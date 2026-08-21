/* =========================================================================
HARDGATE — desk-scan-universe.js
Shared full-universe loader for desk tabs (Trend Matrix, Squeeze, etc.).

Uses window.xuUniverse + window.xuCandles when present (Delta + CoinDCX +
Binance extension — no top-N cap). Falls back to binancePerpUniverse +
binanceTickers24h with the same turnover floor when xuniverse is absent.

EXPORTS (window, never throw):
  hgDeskMinTurnover() -> number ($5M default, aligned with SMART $)
  hgDeskVenueLabel(exchange) -> string
  hgDeskVenueChipHTML(item) -> string (empty when binance-only row)
  hgDeskSymLabel(item) -> string (display symbol; venue tag when non-binance)
  hgDeskVenueCounts(items) -> { delta, coindcx, binance, startrader, other }
  hgDeskLoadUniverse(opts?) -> Promise<{ items, note, source, rawLen,
      filteredLen, venueCounts }>
  hgDeskLoadDeltaCoinDCX(opts?) -> same shape, Delta + CoinDCX rows only
  hgDeskFilterVenues(items, venues?) -> filtered item[]
  hgDeskFetchKlines(item, tf, n) -> Promise<rows [{t,o,h,l,c,v}] asc>
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var DESK_MIN_TURNOVER = 5e6;

function hgDeskMinTurnover(){ return DESK_MIN_TURNOVER; }

function hgDeskVenueLabel(ex){
  ex = String(ex == null ? '' : ex).toLowerCase();
  if (ex === 'delta') return 'DELTA';
  if (ex === 'coindcx' || ex === 'cdcx') return 'COINDCX';
  if (ex === 'startrader') return 'STARTRADER';
  if (ex === 'binance') return 'BINANCE';
  return ex ? ex.toUpperCase() : '';
}

function hgDeskVenueChipHTML(item){
  try{
    if (!item || !item.exchange || item.exchange === 'binance') return '';
    var lab = hgDeskVenueLabel(item.exchange);
    if (!lab) return '';
    return ' <span class="gpip" title="venue: ' + lab + (item.alsoOn ? ' · also ' + item.alsoOn : '') + '">' + lab + '</span>';
  }catch(e){ return ''; }
}

function hgDeskSymLabel(item){
  try{
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.sym || (item.base ? item.base + 'USDT' : '');
  }catch(e){ return ''; }
}

function hgDeskVenueCounts(items){
  var c = { delta: 0, coindcx: 0, binance: 0, startrader: 0, other: 0 };
  try{
    (items || []).forEach(function(it){
      if (!it) return;
      var ex = String(it.exchange || '').toLowerCase();
      if (ex === 'delta') c.delta++;
      else if (ex === 'coindcx' || ex === 'cdcx') c.coindcx++;
      else if (ex === 'binance') c.binance++;
      else if (ex === 'startrader') c.startrader++;
      else c.other++;
    });
  }catch(e){}
  return c;
}

function numTurn(t){
  return (typeof t === 'number' && isFinite(t)) ? t : null;
}

function passesTurnover(it, minTurn, includeUnknown){
  if (!it || !it.sym) return false;
  var t = numTurn(it.turnoverUsd);
  if (t === null) return !!includeUnknown;
  return t >= minTurn;
}

function sortByTurnover(a, b){
  var ta = numTurn(a.turnoverUsd), tb = numTurn(b.turnoverUsd);
  var va = (ta === null) ? -1 : ta;
  var vb = (tb === null) ? -1 : tb;
  if (vb !== va) return vb - va;
  var sa = hgDeskSymLabel(a), sb = hgDeskSymLabel(b);
  return sa < sb ? -1 : (sa > sb ? 1 : 0);
}

function binanceItem(sym, tick){
  return {
    sym: sym,
    base: String(sym).replace(/USDT$/, ''),
    exchange: 'binance',
    turnoverUsd: tick && numTurn(tick.turnoverUsd),
    mark: tick && numTurn(tick.mark),
    fundingPct: (tick && typeof tick.fundingPct === 'number') ? tick.fundingPct : null,
    alsoOn: null
  };
}

function hgDeskFilterVenues(items, venues){
  venues = venues || ['delta', 'coindcx'];
  var allow = {};
  for (var i = 0; i < venues.length; i++){
    var v = String(venues[i] || '').toLowerCase();
    allow[v] = 1;
    if (v === 'coindcx') allow.cdcx = 1;
  }
  return (items || []).filter(function(it){
    if (!it) return false;
    var ex = String(it.exchange || '').toLowerCase();
    return !!allow[ex];
  });
}

async function hgDeskLoadDeltaCoinDCX(opts){
  var pack = await hgDeskLoadUniverse(opts);
  pack.items = hgDeskFilterVenues(pack.items, ['delta', 'coindcx']);
  pack.filteredLen = pack.items.length;
  pack.venueCounts = hgDeskVenueCounts(pack.items);
  pack.source = pack.source + '+delta-coindcx';
  return pack;
}

async function hgDeskLoadUniverse(opts){
  opts = opts || {};
  var minTurn = (opts.minTurnover !== undefined) ? opts.minTurnover : DESK_MIN_TURNOVER;
  var includeUnknown = opts.includeUnknown !== false;

  if (typeof G.xuUniverse === 'function'){
    var list = await G.xuUniverse(!!opts.force);
    list = Array.isArray(list) ? list.slice() : [];
    var rawLen = list.length;
    list = list.filter(function(it){ return passesTurnover(it, minTurn, includeUnknown); });
    list.sort(sortByTurnover);
    var note = (typeof G.xuUniverseNote === 'function') ? G.xuUniverseNote() : null;
    return {
      items: list,
      note: note,
      source: 'xu',
      rawLen: rawLen,
      filteredLen: list.length,
      venueCounts: hgDeskVenueCounts(list)
    };
  }

  if (typeof G.binancePerpUniverse !== 'function' || typeof G.binanceTickers24h !== 'function'){
    throw new Error('no universe source (xuUniverse or binancePerpUniverse unavailable)');
  }
  var perps = await G.binancePerpUniverse();
  var ticks = await G.binanceTickers24h();
  if (!Array.isArray(perps) || !perps.length || !ticks) throw new Error('Binance universe unavailable');
  var items = [];
  for (var i = 0; i < perps.length; i++){
    var s = perps[i], tk = ticks[s];
    if (!tk) continue;
    var it = binanceItem(s, tk);
    if (passesTurnover(it, minTurn, false)) items.push(it);
  }
  items.sort(sortByTurnover);
  return {
    items: items,
    note: 'xuUniverse absent — Binance USDT-M perps only',
    source: 'binance',
    rawLen: perps.length,
    filteredLen: items.length,
    venueCounts: hgDeskVenueCounts(items)
  };
}

/* item.sym is the VENUE's contract code, and only Binance's own codes mean
   anything to Binance. The Binance leg here used item.sym first and fell back
   to base+USDT only when sym was missing — so any CoinDCX row that reached it
   asked fapi for symbol=B-XRP_USDT, which Binance can never resolve. Observed
   live: B-XRP_USDT and B-SOL_USDT 4h klines, both dead on arrival.

   The venue leg is preferred and unchanged. This is the fallback taken when
   xuCandles has not loaded yet (script order) or when the row carries no
   exchange tag at all — and on that path the only symbol Binance understands
   is the one built from the base asset, exactly as xuniverse.js's
   binanceCandleFallback() already does. item.sym is used ONLY when the row is
   already a Binance row. */
function hgDeskBinanceSym(item){
  if (!item) return null;
  if (item.exchange === 'binance' && item.sym) return String(item.sym).toUpperCase();
  var base = item.base ? String(item.base).toUpperCase() : null;
  if (base) return base + 'USDT';
  /* No base tag: derive it from the venue code the same way xuniverse does
     (B-XRP_USDT -> XRP, XRPUSD -> XRP) rather than shipping the code as-is. */
  var sym = item.sym ? String(item.sym).toUpperCase() : '';
  if (!sym) return null;
  var m = sym.match(/^B-([A-Z0-9]+)_USDT$/);        /* CoinDCX futures */
  if (m) return m[1] + 'USDT';
  m = sym.match(/^([A-Z0-9]+)USDT?$/);              /* Delta / Binance shapes */
  if (m) return m[1] + 'USDT';
  return null;
}

async function hgDeskFetchKlines(item, tf, n){
  try{
    if (item && item.exchange && item.exchange !== 'binance' && typeof G.xuCandles === 'function'){
      var rows = await G.xuCandles(item, tf, n);
      return Array.isArray(rows) ? rows : [];
    }
    if (typeof G.binanceKlines === 'function'){
      var sym = hgDeskBinanceSym(item);
      if (sym){
        rows = await G.binanceKlines(sym, tf, n);
        return Array.isArray(rows) ? rows : [];
      }
    }
  }catch(e){}
  return [];
}

try{
  G.hgDeskMinTurnover = hgDeskMinTurnover;
  G.hgDeskVenueLabel = hgDeskVenueLabel;
  G.hgDeskVenueChipHTML = hgDeskVenueChipHTML;
  G.hgDeskSymLabel = hgDeskSymLabel;
  G.hgDeskVenueCounts = hgDeskVenueCounts;
  G.hgDeskLoadUniverse = hgDeskLoadUniverse;
  G.hgDeskLoadDeltaCoinDCX = hgDeskLoadDeltaCoinDCX;
  G.hgDeskFilterVenues = hgDeskFilterVenues;
  G.hgDeskFetchKlines = hgDeskFetchKlines;
  G.hgDeskBinanceSym = hgDeskBinanceSym;
}catch(e){}

})();
