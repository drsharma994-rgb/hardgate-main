/* HARDGATE — Delta India public OHLCV + OI + funding + mark history.
   Docs (docs.delta.exchange GET /history/candles): pass symbol as
   FUNDING:${sym}, MARK:${sym}, OI:${sym} for the non-price series.
   No auth for public market data. No third-party SDKs. */

const DELTA = 'https://api.india.delta.exchange';
const DEFAULT_SYMBOL = 'XAUTUSD';
const UPSTREAM_TIMEOUT_MS = 15000;

function num(v){
  const n = +(v);
  return isFinite(n) ? n : NaN;
}

/** Normalize Delta candle rows → {t,o,h,l,c,v} sorted ascending. */
export function parseDeltaCandles(payload){
  const arr = (payload && payload.result) || (Array.isArray(payload) ? payload : []);
  const out = [];
  for (let i = 0; i < arr.length; i++){
    const c = arr[i];
    if (!c) continue;
    const t = num(c.time != null ? c.time : c.t);
    if (!isFinite(t)) continue;
    out.push({
      t: t < 1e12 ? t : Math.floor(t / 1000),
      o: num(c.open != null ? c.open : c.o),
      h: num(c.high != null ? c.high : c.h),
      l: num(c.low != null ? c.low : c.l),
      c: num(c.close != null ? c.close : c.c),
      v: num(c.volume != null ? c.volume : c.v)
    });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function parseDeltaTicker(payload){
  const r = (payload && payload.result) || payload || {};
  if (!r || typeof r !== 'object') return null;
  const oiContracts = num(r.oi_contracts != null ? r.oi_contracts : r.oi);
  const oiUsd = num(r.oi_value_usd != null ? r.oi_value_usd : r.oi_value);
  const mark = num(r.mark_price != null ? r.mark_price : (r.quotes && r.quotes.mark_price));
  /* hg-v968: THE QUOTE THE GOLD SPREAD LOCK NEEDS WAS ALREADY ON THE WIRE.

     Delta's /v2/tickers/{symbol} returns a `quotes` object, and the line above
     already reaches into it -- for mark_price only. best_bid and best_ask, the
     exact two fields hgGoldSpreadLock reads, were parsed past and dropped.

     That gate is documented in AGENTS.md as a live hard gate that kills an
     entry when the XAUUSD spread exceeds $0.25, and it had NEVER FIRED: the
     globals the desks read for it (__hgGoldQuote / __hgGoldSpreadUsd /
     __hgGoldL2Book) have nine read sites across four desks and ZERO writers
     anywhere in the repo, so the lock returned unchecked on every scan.

     The work was done and dropped on the way out -- hg-v932's finding, here in
     the gold quote path. Nullable like every other leg; a ticker without a
     quote block simply yields nulls. */
  const q = (r.quotes && typeof r.quotes === 'object') ? r.quotes : null;
  const bid = q ? num(q.best_bid != null ? q.best_bid : q.bid) : NaN;
  const ask = q ? num(q.best_ask != null ? q.best_ask : q.ask) : NaN;
  const spreadUsd = (isFinite(bid) && isFinite(ask)) ? Math.abs(ask - bid) : NaN;
  const ltp = num(r.close != null ? r.close : r.spot_price);
  const funding = num(r.funding_rate);
  return {
    symbol: r.symbol || null,
    oiContracts: isFinite(oiContracts) ? oiContracts : null,
    oiUsd: isFinite(oiUsd) ? oiUsd : null,
    mark: isFinite(mark) ? mark : null,
    ltp: isFinite(ltp) ? ltp : null,
    fundingPct: isFinite(funding) ? funding : null,
    bid: isFinite(bid) ? bid : null,
    ask: isFinite(ask) ? ask : null,
    spreadUsd: isFinite(spreadUsd) ? spreadUsd : null,
    oiChangeUsd6h: isFinite(num(r.oi_change_usd_6h)) ? num(r.oi_change_usd_6h) : null,
    raw: r
  };
}

/* hg-v970: the L2 book. Delta's /v2/l2orderbook/{symbol} returns
   result.buy / result.sell as [{ price, size, depth }]. Normalised to
   { bids:[{price,size}], asks:[{price,size}], at } -- bids best-first
   (descending), asks best-first (ascending), at most 50 levels a side -- and
   null when either side is empty or unreadable, because a one-sided book is
   not a book (the hgGoldSpreadUsd rule: one side alone is NO quote). */
export function parseDeltaL2(payload){
  const r = (payload && payload.result) ? payload.result : payload;
  if (!r || typeof r !== 'object') return null;
  const side = (arr) => {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const lv of arr){
      if (!lv) continue;
      const price = Array.isArray(lv) ? num(lv[0]) : num(lv.price);
      const size = Array.isArray(lv) ? num(lv[1]) : num(lv.size != null ? lv.size : lv.qty);
      if (isFinite(price) && isFinite(size) && price > 0 && size > 0) out.push({ price, size });
    }
    return out;
  };
  const bids = side(r.buy != null ? r.buy : r.bids).sort((a, b) => b.price - a.price).slice(0, 50);
  const asks = side(r.sell != null ? r.sell : r.asks).sort((a, b) => a.price - b.price).slice(0, 50);
  if (!bids.length || !asks.length) return null;
  const at = num(r.last_updated_at);
  return { bids, asks, at: isFinite(at) ? at : null };
}

async function deltaGet(pathQuery, fetchImpl){
  const fetchFn = fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new Error('fetch unavailable');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try{
    const res = await fetchFn(DELTA + pathQuery, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json' }
    });
    const text = await res.text();
    let json = null;
    try{ json = text ? JSON.parse(text) : null; }catch(e){ json = null; }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch price / OI / funding / mark history + live ticker for a Delta perp.
 * @param {{symbol?:string, resolution?:string, start?:number, end?:number, lookbackHours?:number, fetchImpl?:Function}} opts
 */
export async function fetchDeltaPerpHistory(opts){
  opts = opts || {};
  const symbol = String(opts.symbol || DEFAULT_SYMBOL).toUpperCase();
  const resolution = String(opts.resolution || '1h');
  const end = isFinite(+opts.end) ? Math.floor(+opts.end) : Math.floor(Date.now() / 1000);
  const lookbackH = isFinite(+opts.lookbackHours) ? +opts.lookbackHours : 168;
  const start = isFinite(+opts.start) ? Math.floor(+opts.start) : (end - Math.floor(lookbackH * 3600));
  const fetchImpl = opts.fetchImpl;

  const q = (sym) => '/v2/history/candles?resolution=' + encodeURIComponent(resolution)
    + '&symbol=' + encodeURIComponent(sym)
    + '&start=' + start + '&end=' + end;

  const [priceR, oiR, fundR, markR, tickR, l2R] = await Promise.all([
    deltaGet(q(symbol), fetchImpl),
    deltaGet(q('OI:' + symbol), fetchImpl),
    deltaGet(q('FUNDING:' + symbol), fetchImpl),
    deltaGet(q('MARK:' + symbol), fetchImpl),
    deltaGet('/v2/tickers/' + encodeURIComponent(symbol), fetchImpl),
    /* hg-v970: the sixth leg -- the book the gold DOM rule has read from a
       global nothing writes since it shipped */
    deltaGet('/v2/l2orderbook/' + encodeURIComponent(symbol), fetchImpl)
  ]);

  return {
    ok: !!(priceR.ok || oiR.ok || fundR.ok),
    symbol,
    resolution,
    start,
    end,
    price: priceR.ok ? parseDeltaCandles(priceR.json) : [],
    oi: oiR.ok ? parseDeltaCandles(oiR.json) : [],
    funding: fundR.ok ? parseDeltaCandles(fundR.json) : [],
    mark: markR.ok ? parseDeltaCandles(markR.json) : [],
    ticker: tickR.ok ? parseDeltaTicker(tickR.json) : null,
    l2: l2R.ok ? parseDeltaL2(l2R.json) : null,
    statuses: {
      price: priceR.status, oi: oiR.status, funding: fundR.status,
      mark: markR.status, ticker: tickR.status, l2: l2R.status
    },
    at: Date.now(),
    source: 'delta-india'
  };
}

export const DELTA_PERP_DEFAULT_SYMBOL = DEFAULT_SYMBOL;
export const DELTA_API_BASE = DELTA;
