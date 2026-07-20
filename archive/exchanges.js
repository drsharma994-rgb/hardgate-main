// exchanges.js \u2014 Delta/CoinDCX ticker & candle fetchers (extracted from index.html, Phase 18)
// Call-time deps stay inline/earlier: DELTA, CDCX_API, CDCX_PUB, cdcxGet, nowSec, fetch.
// Globals: loadTickersDelta, DELTA_RES, candlesDelta, loadTickersCdcx, CDCX_RES, candlesCdcx.

async function loadTickersDelta(){
  const r = await fetch(`${DELTA}/v2/tickers?contract_types=perpetual_futures`);
  const j = await r.json();
  return (j.result||[]).map(t=>({
    symbol: t.symbol,
    mark: parseFloat(t.mark_price ?? t.close),
    fundingPct: t.funding_rate!==undefined && t.funding_rate!==null ? parseFloat(t.funding_rate) : null, // Delta India: percent units per interval. NO *100.
    oiUsd: parseFloat(t.oi_value_usd ?? t.oi_value ?? 0),
    turnoverUsd: parseFloat(t.turnover_usd ?? t.turnover ?? 0),
    chg24: (isFinite(parseFloat(t.close)) && isFinite(parseFloat(t.open))) ? (parseFloat(t.close)/parseFloat(t.open)-1)*100 : null,
  })).filter(t=>isFinite(t.mark));
}
const DELTA_RES = {'15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d'};
async function candlesDelta(sym, res, count){
  const secPer = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[res];
  const end = nowSec(), start = end - secPer*(count+3);
  const r = await fetch(`${DELTA}/v2/history/candles?resolution=${DELTA_RES[res]}&symbol=${encodeURIComponent(sym)}&start=${start}&end=${end}`);
  const j = await r.json();
  const rows = (j.result||[]).map(c=>({t:c.time, o:+c.open, h:+c.high, l:+c.low, c:+c.close, v:+c.volume}));
  rows.sort((a,b)=>a.t-b.t);
  return rows;
}

async function loadTickersCdcx(){
  // Active USDT-margined futures instruments. The dedicated futures ticker detail
  // endpoints are unreliable, so we derive 24h turnover, mark price and change from
  // the public spot /exchange/ticker feed by matching each futures pair (B-XXX_USDT)
  // to its underlying spot market (XXXUSDT). Symbols with no spot match keep 0 turnover.
  const j = await cdcxGet(`${CDCX_API}/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT`);
  const list = Array.isArray(j) ? j : (j.instruments||[]);
  let tickMap = {};
  try {
    const raw = await cdcxGet(`${CDCX_PUB}/exchange/ticker`);
    if (Array.isArray(raw)) { for (const r of raw) { if (r && r.market) tickMap[r.market] = r; } }
  } catch(e) { tickMap = {}; }
  return list.map(s => {
    const symbol = (typeof s === 'string') ? s : s.symbol;
    const spotKey = String(symbol).replace(/^B-/,'').replace('_','');
    const tk = tickMap[spotKey];
    let mark = NaN, turnoverUsd = 0, chg24 = null;
    if (tk) {
      const px = parseFloat(tk.last_price);
      const vol = parseFloat(tk.volume);
      if (isFinite(px)) mark = px;
      if (isFinite(px) && isFinite(vol)) turnoverUsd = px * vol;
      const ch = parseFloat(tk.change_24_hour);
      if (isFinite(ch)) chg24 = ch;
    }
    return { symbol, mark, fundingPct: null, oiUsd: 0, turnoverUsd, chg24 };
  });
}
const CDCX_RES = {'15m':'15','1h':'60','2h':'120','4h':'240','1d':'1D'};
async function candlesCdcx(sym, res, count){
  const secPer = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[res];
  const to = nowSec(), from = to - secPer*(count+3);
  const j = await cdcxGet(`${CDCX_PUB}/market_data/candlesticks?pair=${encodeURIComponent(sym)}&from=${from}&to=${to}&resolution=${CDCX_RES[res]}&pcode=f`);
  const rows = (j.data||[]).map(c=>({t:Math.floor((c.time??c.t)/1000), o:+c.open, h:+c.high, l:+c.low, c:+c.close, v:+(c.volume??0)}));
  rows.sort((a,b)=>a.t-b.t);
  return rows;
}
