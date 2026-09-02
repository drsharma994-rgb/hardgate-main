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
  const ltp = num(r.close != null ? r.close : r.spot_price);
  const funding = num(r.funding_rate);
  return {
    symbol: r.symbol || null,
    oiContracts: isFinite(oiContracts) ? oiContracts : null,
    oiUsd: isFinite(oiUsd) ? oiUsd : null,
    mark: isFinite(mark) ? mark : null,
    ltp: isFinite(ltp) ? ltp : null,
    fundingPct: isFinite(funding) ? funding : null,
    oiChangeUsd6h: isFinite(num(r.oi_change_usd_6h)) ? num(r.oi_change_usd_6h) : null,
    raw: r
  };
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

  const [priceR, oiR, fundR, markR, tickR] = await Promise.all([
    deltaGet(q(symbol), fetchImpl),
    deltaGet(q('OI:' + symbol), fetchImpl),
    deltaGet(q('FUNDING:' + symbol), fetchImpl),
    deltaGet(q('MARK:' + symbol), fetchImpl),
    deltaGet('/v2/tickers/' + encodeURIComponent(symbol), fetchImpl)
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
    statuses: {
      price: priceR.status, oi: oiR.status, funding: fundR.status,
      mark: markR.status, ticker: tickR.status
    },
    at: Date.now(),
    source: 'delta-india'
  };
}

export const DELTA_PERP_DEFAULT_SYMBOL = DEFAULT_SYMBOL;
export const DELTA_API_BASE = DELTA;
