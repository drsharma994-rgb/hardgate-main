/* BATCH 1135 — a CoinDCX cross is sent only after the daily bar has closed,
   the 4h cascade and at least 6 of 7 gates agree, and a closed 4h bar has
   tagged the nearer EMA9 or EMA21. TRADE means RSI, OBV and funding are not
   against the long and Bitcoin structure is not down for an alt. SKIP is
   sent once. A cross that is still waiting is not sent. */
import fs from 'fs';

const STATE_FILE = 'golden-alert-state.json';
const SITE = 'https://hardgate-main.onrender.com/';
const SKIP = new Set(['USDC','USDT','FDUSD','TUSD','BUSD','DAI','USDP','EUR','USD','USDE','USD1','USDD']);
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

function ema(values, len){
  const out = new Array(values.length).fill(NaN);
  if (values.length < len) return out;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += values[i];
  out[len - 1] = sum / len;
  const k = 2 / (len + 1);
  for (let i = len; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}
function crossedUp(a, b, within){
  const n = Math.min(a.length, b.length);
  const start = Math.max(1, n - within);
  for (let i = n - 1; i >= start; i--){
    if (a[i] > b[i] && a[i - 1] <= b[i - 1]) return n - 1 - i;
  }
  return -1;
}
function ichimokuAbove(rows){
  if (!rows || rows.length < 78) return 0;
  const ten = 9, kij = 26, span = 52, shift = 26;
  const i = rows.length - 1;
  const hh = (from, to) => { let h = -Infinity; for (let k = from; k <= to; k++) if (rows[k].h > h) h = rows[k].h; return h; };
  const ll = (from, to) => { let l = Infinity; for (let k = from; k <= to; k++) if (rows[k].l < l) l = rows[k].l; return l; };
  const cloudAt = i - shift;
  if (cloudAt < span) return 0;
  const tenkan = (hh(cloudAt - ten + 1, cloudAt) + ll(cloudAt - ten + 1, cloudAt)) / 2;
  const kijun = (hh(cloudAt - kij + 1, cloudAt) + ll(cloudAt - kij + 1, cloudAt)) / 2;
  const spanA = (tenkan + kijun) / 2;
  const spanB = (hh(cloudAt - span + 1, cloudAt) + ll(cloudAt - span + 1, cloudAt)) / 2;
  if (rows[i].c > Math.max(spanA, spanB)) return 1;
  if (rows[i].c < Math.min(spanA, spanB)) return -1;
  return 0;
}
function adxLast(rows, len){
  if (!rows || rows.length < len + 2) return NaN;
  const tr = [], pd = [], md = [];
  for (let i = 1; i < rows.length; i++){
    const up = rows[i].h - rows[i - 1].h;
    const dn = rows[i - 1].l - rows[i].l;
    pd.push(up > dn && up > 0 ? up : 0);
    md.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c)));
  }
  const wilder = (src) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += src[i];
    const out = [s];
    for (let i = len; i < src.length; i++) out.push(out[out.length - 1] - out[out.length - 1] / len + src[i]);
    return out;
  };
  const trS = wilder(tr), pdS = wilder(pd), mdS = wilder(md);
  const dx = [];
  for (let i = 0; i < trS.length; i++){
    if (!(trS[i] > 0)) { dx.push(0); continue; }
    const pdi = 100 * pdS[i] / trS[i];
    const mdi = 100 * mdS[i] / trS[i];
    const den = pdi + mdi;
    dx.push(den > 0 ? 100 * Math.abs(pdi - mdi) / den : 0);
  }
  if (dx.length < len) return NaN;
  let a = 0;
  for (let i = 0; i < len; i++) a += dx[i];
  a /= len;
  for (let i = len; i < dx.length; i++) a = (a * (len - 1) + dx[i]) / len;
  return a;
}
async function getJson(path){
  let last = 'no host';
  for (const host of HOSTS){
    try {
      const r = await fetch(host + path);
      const j = await r.json();
      if (!r.ok || (j && j.code && j.msg)) { last = host + ' ' + (j && j.msg ? j.msg : r.status); continue; }
      return j;
    } catch (e) { last = (e && e.message) || String(e); }
  }
  throw new Error(last);
}
async function klines(symbol, interval, limit){
  const j = await getJson('/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit);
  if (!Array.isArray(j)) throw new Error(symbol + ' not candles');
  return j.map(function(k){ return { t:+k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }; });
}
function closedBars(rows, barMs){
  if (!rows || rows.length < 2) return rows || [];
  const last = rows[rows.length - 1];
  if (!last || !Number.isFinite(last.t) || last.t + barMs > Date.now()) return rows.slice(0, -1);
  return rows;
}
function emaLast(values, len){
  const s = ema(values, len);
  const v = s.length ? s[s.length - 1] : NaN;
  return Number.isFinite(v) ? v : NaN;
}
function rsiLast(closes, len){
  len = len || 14;
  if (!closes || closes.length < len + 1) return NaN;
  let gain = 0, loss = 0;
  for (let i = 1; i <= len; i++){
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= len; loss /= len;
  for (let i = len + 1; i < closes.length; i++){
    const d = closes[i] - closes[i - 1];
    gain = (gain * (len - 1) + (d > 0 ? d : 0)) / len;
    loss = (loss * (len - 1) + (d < 0 ? -d : 0)) / len;
  }
  if (!(loss > 0)) return gain > 0 ? 100 : 50;
  return 100 - 100 / (1 + gain / loss);
}
function obvDivergesLong(rows){
  const WIN = 20;
  if (!rows || rows.length < WIN * 2) return null;
  let acc = 0, any = false;
  const obv = new Array(rows.length).fill(0);
  for (let i = 0; i < rows.length; i++){
    const v = rows[i].v > 0 ? rows[i].v : 0;
    if (v > 0) any = true;
    if (i > 0){
      if (rows[i].c > rows[i - 1].c) acc += v;
      else if (rows[i].c < rows[i - 1].c) acc -= v;
    }
    obv[i] = acc;
  }
  if (!any) return null;
  let pHi1 = -Infinity, pHi2 = -Infinity, oHi1 = -Infinity, oHi2 = -Infinity;
  const n = rows.length;
  for (let i = n - WIN * 2; i < n; i++){
    if (!(rows[i].c > 0)) continue;
    if (i >= n - WIN){
      if (rows[i].c > pHi2) pHi2 = rows[i].c;
      if (obv[i] > oHi2) oHi2 = obv[i];
    } else {
      if (rows[i].c > pHi1) pHi1 = rows[i].c;
      if (obv[i] > oHi1) oHi1 = obv[i];
    }
  }
  if (![pHi1, pHi2, oHi1, oHi2].every(Number.isFinite)) return null;
  return pHi2 > pHi1 && oHi2 < oHi1;
}
async function fundingMap(){
  const map = new Map();
  const hosts = ['https://fapi.binance.com', 'https://data-api.binance.vision'];
  for (const host of hosts){
    try {
      const r = await fetch(host + '/fapi/v1/premiumIndex', { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (!r.ok || !Array.isArray(j)) continue;
      for (const row of j){
        if (row && row.symbol && row.lastFundingRate != null && Number.isFinite(+row.lastFundingRate)){
          map.set(row.symbol, (+row.lastFundingRate) * 100);
        }
      }
      if (map.size) return map;
    } catch (e) {}
  }
  return map;
}
function btcStructureDown(h4){
  h4 = closedBars(h4, 4 * 60 * 60 * 1000);
  if (!h4 || h4.length < 210) return null;
  const c = h4.map(function(r){ return r.c; });
  const e50 = emaLast(c, 50), e200 = emaLast(c, 200);
  if (!Number.isFinite(e50) || !Number.isFinite(e200) || e50 === e200) return null;
  return e50 < e200;
}
function rsiAt(closes, len, index){
  if (index < len) return NaN;
  return rsiLast(closes.slice(0, index + 1), len);
}
function volZ(rows, look){
  look = look || 20;
  const n = rows.length;
  if (n < look + 1) return NaN;
  const vs = rows.slice(n - 1 - look, n - 1).map(function(r){ return r.v; });
  const m = vs.reduce(function(a, b){ return a + b; }, 0) / vs.length;
  const sd = Math.sqrt(vs.reduce(function(a, b){ return a + (b - m) * (b - m); }, 0) / vs.length);
  if (sd < 1e-8) return 0;
  return (rows[n - 1].v - m) / sd;
}
function cusumAgainstLong(closes){
  const w = closes.slice(-120);
  if (w.length < 30) return false;
  let mean = 0;
  for (let i = 0; i < w.length; i++) mean += w[i];
  mean /= w.length;
  let sd = 0;
  for (let i = 0; i < w.length; i++) sd += (w[i] - mean) * (w[i] - mean);
  sd = Math.sqrt(sd / w.length) || 1;
  let pos = 0, neg = 0, lastDir = null, barsAgo = 999;
  for (let i = 0; i < w.length; i++){
    const z = (w[i] - mean) / sd;
    pos = Math.max(0, pos + z);
    neg = Math.min(0, neg + z);
    if (pos > 1){ lastDir = 'long'; barsAgo = w.length - 1 - i; pos = 0; }
    if (neg < -1){ lastDir = 'short'; barsAgo = w.length - 1 - i; neg = 0; }
  }
  return lastDir === 'short' && barsAgo <= 20;
}
function gatesPass(h4, fund){
  if (!h4 || h4.length < 210) return false;
  const c = h4.map(function(r){ return r.c; });
  const i = c.length - 1;
  const e9 = emaLast(c, 9), e21 = emaLast(c, 21), e50 = emaLast(c, 50), e200 = emaLast(c, 200);
  const a = atr(h4, 14);
  const px = c[i];
  const rsi = rsiLast(c, 14);
  if (!(e9 > e21 && e21 > e50)) return false;
  let passed = 0;
  if (a > 0 && Math.abs(e21 - e50) >= 0.25 * a) passed++;
  if (px > e200) passed++;
  if (Number.isFinite(rsi) && rsi <= 70) passed++;
  const fundMissing = !Number.isFinite(fund);
  if (fundMissing || fund < 0.04) passed++;
  const bar = h4[i];
  const range = bar.h - bar.l;
  const closePos = range > 0 ? (bar.c - bar.l) / range : 0.5;
  const prev = rsiAt(c, 14, i - 3);
  const slopeOK = Number.isFinite(prev) && rsi > prev;
  const vz = volZ(h4, 20);
  if (closePos >= 0.60 && ((Number.isFinite(vz) && vz > 0.5) || slopeOK)) passed++;
  const seg = h4.slice(Math.max(0, i - 20), i);
  const swing = seg.length ? Math.min.apply(null, seg.map(function(r){ return r.l; })) : NaN;
  let stop = Number.isFinite(swing) ? swing - 0.25 * a : NaN;
  if (!(px - stop > 0 && px - stop <= 2.5 * a)) stop = px - 1.5 * a;
  const risk = px - stop;
  const rr = risk > 0 ? (a * 3.5) / risk : 0;
  if (rr >= (fundMissing ? 2.5 : 2)) passed++;
  if (!cusumAgainstLong(c)) passed++;
  return passed >= 6;
}
function crossBar(d1){
  const c = d1.map(function(r){ return r.c; });
  const e50 = ema(c, 50), e200 = ema(c, 200);
  for (let i = c.length - 1; i >= 1 && i >= c.length - 10; i--){
    if (e50[i] > e200[i] && e50[i - 1] <= e200[i - 1]) return d1[i];
  }
  return null;
}
function emaTag(h4, crossCloseMs){
  const closes = h4.map(function(r){ return r.c; });
  const e9 = ema(closes, 9), e21 = ema(closes, 21);
  const i = closes.length - 1, px = closes[i];
  const cands = [];
  if (Number.isFinite(e9[i]) && e9[i] < px) cands.push(['EMA9', e9]);
  if (Number.isFinite(e21[i]) && e21[i] < px) cands.push(['EMA21', e21]);
  if (!cands.length) return { state: 'waiting' };
  cands.sort(function(a, b){ return Math.abs(a[1][i] - px) - Math.abs(b[1][i] - px); });
  const series = cands[0][1];
  const after = [];
  for (let k = 0; k < h4.length; k++) if (h4[k].t >= crossCloseMs) after.push(k);
  let tagged = false;
  for (let n = 0; n < Math.min(6, after.length); n++){
    const k = after[n], level = series[k], bar = h4[k];
    if (bar.l <= level && bar.c > level) tagged = true;
  }
  if (tagged) return { state: 'ready', ema: cands[0][0] };
  if (after.length >= 6) return { state: 'expired' };
  return { state: 'waiting' };
}
function atr(rows, n){
  n = n || 14;
  if (!rows || rows.length < n + 1) return NaN;
  let sum = 0;
  for (let i = rows.length - n; i < rows.length; i++){
    const prev = rows[i - 1], cur = rows[i];
    sum += Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
  }
  return sum / n;
}
function planOf(h4){
  if (!h4 || h4.length < 21) return null;
  const last = h4[h4.length - 1].c;
  const a = atr(h4, 14);
  if (!(last > 0) || !(a > 0)) return null;
  const closes = h4.map(function(r){ return r.c; });
  const e9 = emaLast(closes, 9), e21 = emaLast(closes, 21);
  const cands = [];
  if (Number.isFinite(e9) && e9 < last) cands.push(['EMA9', e9]);
  if (Number.isFinite(e21) && e21 < last) cands.push(['EMA21', e21]);
  cands.sort(function(x, y){ return Math.abs(x[1] - last) - Math.abs(y[1] - last); });
  let entry = last, entryType = 'MARKET', limitEma = 'MARKET';
  if (cands.length){
    entry = cands[0][1];
    entryType = 'LIMIT';
    limitEma = cands[0][0];
  }
  const seg = h4.slice(Math.max(0, h4.length - 1 - 20), h4.length - 1);
  const swing = seg.length ? Math.min.apply(null, seg.map(function(r){ return r.l; })) : NaN;
  let stop = NaN;
  if (Number.isFinite(swing)){
    const s = swing - 0.25 * a;
    const risk0 = entry - s;
    if (risk0 > 0 && risk0 <= 2.5 * a) stop = s;
  }
  if (!Number.isFinite(stop) || !(entry > stop)) stop = entry - 1.5 * a;
  const risk = entry - stop;
  if (!(risk > 0)) return null;
  return { entry: entry, stop: stop, t1: entry + 2 * risk, t2: entry + 3.5 * risk, entryType: entryType, limitEma: limitEma };
}
function px(n){
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  const d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 6 : 8;
  return Number(n).toFixed(d);
}
function scoreOf(d1, h4){
  const c = d1.map(function(r){ return r.c; });
  const e50 = ema(c, 50), e200 = ema(c, 200);
  const i = c.length - 1;
  if (!isFinite(e50[i]) || !isFinite(e200[i])) return null;
  const d1Trend = c[i] > e200[i] ? 1 : (c[i] < e200[i] ? -1 : 0);
  const d1Cross = e50[i] > e200[i] ? 1 : (e50[i] < e200[i] ? -1 : 0);
  const ago = crossedUp(e50, e200, 10);
  const c4 = h4.map(function(r){ return r.c; });
  const e9 = ema(c4, 9), e21 = ema(c4, 21), e50h = ema(c4, 50);
  const j = c4.length - 1;
  let h4Cascade = 0;
  if (isFinite(e9[j]) && isFinite(e21[j]) && isFinite(e50h[j])){
    if (e9[j] > e21[j] && e21[j] > e50h[j]) h4Cascade = 1;
    else if (e9[j] < e21[j] && e21[j] < e50h[j]) h4Cascade = -1;
  }
  const cloud = ichimokuAbove(d1);
  const adx = adxLast(d1, 14);
  const trendSum = d1Trend + d1Cross + h4Cascade + cloud;
  const adxPt = (adx >= 25) ? (trendSum > 0 ? 1 : (trendSum < 0 ? -1 : 0)) : 0;
  return { score: d1Trend + d1Cross + h4Cascade + cloud + adxPt, fresh: ago >= 0, ago: ago, px: c[i], e50: e50[i], e200: e200[i] };
}
async function pool(items, n, fn){
  let cursor = 0;
  async function worker(){
    while (cursor < items.length){
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
}
function chunks(lines){
  const parts = [];
  let buf = '';
  for (const line of lines){
    if ((buf + '\n' + line).length > 3500){
      parts.push(buf);
      buf = line;
    } else buf = buf ? buf + '\n' + line : line;
  }
  if (buf) parts.push(buf);
  return parts;
}
async function send(text){
  const token = process.env.TELEGRAM_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chat) throw new Error('no telegram credentials');
  const res = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 4096), disable_web_page_preview: true })
  });
  const j = await res.json().catch(function(){ return null; });
  if (!j || !j.ok) throw new Error((j && j.description) || 'telegram failed');
  return j.result.message_id;
}
function loadState(){ try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return { sent: {} }; } }
async function coindcxBases(){
  const r = await fetch('https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments');
  const j = await r.json();
  if (!r.ok || !Array.isArray(j)) throw new Error('coindcx instrument list failed');
  const bases = new Set();
  for (const pair of j){
    const m = /^B-(.+)_USDT$/.exec(String(pair || ''));
    if (m && m[1] && !SKIP.has(m[1])) bases.add(m[1]);
  }
  if (!bases.size) throw new Error('coindcx returned no active USDT futures');
  return bases;
}

async function getText(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  return await r.text();
}
async function getAny(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  return await r.json();
}
function yahooUp(j){
  try {
    const q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return Number.isFinite(v); });
    if (q.length < 2) return null;
    return q[q.length - 1] > q[q.length - 2];
  } catch (e) { return null; }
}
async function stackContext(){
  const ctx = { ok: false, riskOff: false, eventBlock: false, btcDomRising: false, ethDown: false, stableFalling: false, headlines: '' };
  const names = [['dxy','DX-Y.NYB'],['us10y','%5ETNX'],['us2y','2YY%3DF'],['nq','NQ%3DF'],['spx','%5EGSPC'],['vix','%5EVIX']];
  const dirs = {};
  await Promise.all(names.map(async function(pair){
    try { dirs[pair[0]] = yahooUp(await getAny('https://query1.finance.yahoo.com/v8/finance/chart/' + pair[1] + '?interval=1d&range=5d')); }
    catch (e) { dirs[pair[0]] = null; }
  }));
  const readable = names.filter(function(pair){ return dirs[pair[0]] === true || dirs[pair[0]] === false; }).length;
  if (readable < 4) return ctx;
  let against = 0;
  if (dirs.dxy === true) against++;
  if (dirs.us10y === true) against++;
  if (dirs.us2y === true) against++;
  if (dirs.nq === false) against++;
  if (dirs.spx === false) against++;
  if (dirs.vix === true) against++;
  ctx.riskOff = against >= 3;
  try {
    const cal = await getAny('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
    if (!Array.isArray(cal)) return ctx;
    const now = Date.now();
    for (const ev of cal){
      if (!ev || ev.country !== 'USD' || String(ev.impact || '').toLowerCase() !== 'high') continue;
      const title = String(ev.title || '').toLowerCase();
      if (!/cpi|nfp|fomc|ppi|gdp|powell|unemployment|payroll|fed rate|retail sales/.test(title)) continue;
      const when = Date.parse(ev.date);
      if (Number.isFinite(when) && when - now <= 2 * 60 * 60 * 1000 && now - when <= 30 * 60 * 1000) ctx.eventBlock = true;
    }
  } catch (e) { return ctx; }
  try {
    const btc = await getAny('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2');
    const eth = await getAny('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=2');
    const chg = function(j){
      const caps = j && j.market_caps;
      if (!caps || caps.length < 2 || !(caps[0][1] > 0)) return null;
      return (caps[caps.length - 1][1] - caps[0][1]) / caps[0][1];
    };
    const b = chg(btc), e = chg(eth);
    if (b == null || e == null) return ctx;
    ctx.btcDomRising = b > 0.005 && e < b - 0.01;
    ctx.ethDown = e < 0;
  } catch (e) { return ctx; }
  try {
    const stables = await getAny('https://stablecoins.llama.fi/stablecoincharts/all');
    if (Array.isArray(stables) && stables.length >= 2){
      const a = stables[stables.length - 2], b = stables[stables.length - 1];
      const av = a && a.totalCirculatingUSD && +a.totalCirculatingUSD.peggedUSD;
      const bv = b && b.totalCirculatingUSD && +b.totalCirculatingUSD.peggedUSD;
      if (!(av > 0) || !(bv > 0)) return ctx;
      ctx.stableFalling = bv < av * 0.997;
    } else return ctx;
  } catch (e) { return ctx; }
  try {
    ctx.headlines = await getText('https://cointelegraph.com/rss') || '';
  } catch (e) { ctx.headlines = ''; }
  if (!ctx.headlines) return ctx;
  ctx.ok = true;
  return ctx;
}
async function stackOk(symbol, base, h4, ctx){
  if (!ctx || ctx.ok !== true) return 'stack unread';
  if (ctx.riskOff) return 'macro risk-off';
  if (ctx.eventBlock) return 'high-impact USD event';
  if (base !== 'BTC' && ctx.btcDomRising) return 'BTC.D rising';
  if (base !== 'BTC' && base !== 'ETH' && ctx.ethDown) return 'ETH lagging';
  if (ctx.stableFalling) return 'stablecoin liquidity falling';
  const name = base.toLowerCase();
  if (ctx.headlines.toLowerCase().indexOf(name) >= 0 && /hack|exploit|unlock|delist|lawsuit|insolven|halt/.test(ctx.headlines.toLowerCase())) return 'adverse headline';
  const closes = h4.map(function(r){ return r.c; });
  const px = closes[closes.length - 1];
  const e20 = emaLast(closes, 20), e50 = emaLast(closes, 50), e200 = emaLast(closes, 200);
  if (!(px > e20 && e20 > e50 && px > e200)) return 'EMA 20/50/200 against';
  let oi;
  try { oi = await getAny('https://fapi.binance.com/futures/data/openInterestHist?symbol=' + symbol + '&period=4h&limit=8'); } catch (e) { oi = null; }
  if (!Array.isArray(oi) || oi.length < 3) return 'OI unread';
  const oiNow = +oi[oi.length - 1].sumOpenInterest, oiPrev = +oi[oi.length - 3].sumOpenInterest;
  const pxPrev = closes[Math.max(0, closes.length - 3)];
  if (!(oiPrev > 0) || !(px > pxPrev && oiNow > oiPrev * 1.005)) return 'OI not confirming';
  let tk;
  try { tk = await getAny('https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=' + symbol + '&period=4h&limit=6'); } catch (e) { tk = null; }
  if (!Array.isArray(tk) || !tk.length || !(+tk[tk.length - 1].buySellRatio > 1)) return 'CVD not with the long';
  let m15;
  try { m15 = await klines(symbol, '15m', 80); } catch (e) { m15 = null; }
  m15 = closedBars(m15, 15 * 60 * 1000);
  if (!m15 || m15.length < 30) return '15m unread';
  let sweep = false;
  for (let i = Math.max(10, m15.length - 12); i < m15.length; i++){
    const prior = m15.slice(i - 10, i);
    const lo = Math.min.apply(null, prior.map(function(r){ return r.l; }));
    if (m15[i].l < lo && m15[i].c > lo) sweep = true;
  }
  if (!sweep) return '15m no liquidity sweep';
  return null;
}

async function main(){
  const listed = await coindcxBases();
  const tick = await getJson('/api/v3/ticker/24hr');
  if (!Array.isArray(tick)) throw new Error('ticker was not a list');
  const vol = new Map();
  for (const t of tick){
    if (t && typeof t.symbol === 'string') vol.set(t.symbol, +t.quoteVolume || 0);
  }
  const universe = Array.from(listed).map(function(base){
    return { symbol: base + 'USDT', quoteVolume: vol.get(base + 'USDT') || 0 };
  }).sort(function(a, b){ return b.quoteVolume - a.quoteVolume; });
  const state = loadState();
  const sent = state.sent || {};
  const funds = await fundingMap();
  let btcDown = null;
  try { btcDown = btcStructureDown(await klines('BTCUSDT', '4h', 260)); } catch (e) { btcDown = null; }
  const stack = await stackContext();
  const hits = [];
  await pool(universe, 6, async function(t){
    try {
      const d1 = closedBars(await klines(t.symbol, '1d', 260), 24 * 60 * 60 * 1000);
      const h4 = closedBars(await klines(t.symbol, '4h', 260), 4 * 60 * 60 * 1000);
      const s = scoreOf(d1, h4);
      if (!s || !s.fresh || !(s.e50 > s.e200)) return;
      const bar = crossBar(d1);
      if (!bar) return;
      const tagState = emaTag(h4, bar.t + 24 * 60 * 60 * 1000);
      const base = t.symbol.replace(/USDT$/, '');
      const crossDay = new Date(bar.t).toISOString().slice(0, 10);
      const prev = sent[base];
      if (tagState.state === 'waiting') return;
      if (tagState.state === 'expired'){
        sent[base] = { at: new Date().toISOString(), score: s.score, fresh: true, ago: s.ago, crossDay: crossDay, expired: true };
        return;
      }
      if (prev && prev.crossDay === crossDay && (prev.alerted || prev.expired)) return;
      const c4 = h4.map(function(r){ return r.c; });
      const e9 = emaLast(c4, 9), e21 = emaLast(c4, 21), e50h = emaLast(c4, 50);
      if (!(e9 > e21 && e21 > e50h)) return;
      const fund = funds.has(t.symbol) ? funds.get(t.symbol) : null;
      if (!gatesPass(h4, fund)) return;
      const plan = planOf(h4);
      if (!plan) return;
      const reasons = [];
      const rsi = rsiLast(d1.map(function(r){ return r.c; }), 14);
      if (Number.isFinite(rsi) && rsi < 40) reasons.push('RSI ' + rsi.toFixed(0) + ' against');
      if (obvDivergesLong(d1) === true) reasons.push('OBV diverging');
      if (fund != null && fund >= 0.04) reasons.push('funding crowded ' + fund.toFixed(3) + '%');
      if (base !== 'BTC' && btcDown === true) reasons.push('BTC structure down');
      if (reasons.length) return;
      const blocked = await stackOk(t.symbol, base, h4, stack);
      if (blocked) return;
      sent[base] = { at: new Date().toISOString(), score: s.score, fresh: true, ago: s.ago, crossDay: crossDay, alerted: true };
      hits.push({ base: base, s: s, plan: plan, grade: 'TRADE', reasons: [] });
    } catch (e) {
      console.error(t.symbol, e.message || e);
    }
  });
  hits.sort(function(a, b){
    if (a.grade !== b.grade) return a.grade === 'TRADE' ? -1 : 1;
    if (b.s.score !== a.s.score) return b.s.score - a.s.score;
    if (a.s.fresh !== b.s.fresh) return a.s.fresh ? -1 : 1;
    return a.base.localeCompare(b.base);
  });
  state.sent = sent;
  state.lastRunAt = new Date().toISOString();
  state.scanned = universe.length;
  state.cards = hits.length;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  if (!hits.length){
    const quiet = [
      'HARDGATE — NO FRESH CROSS',
      'CoinDCX active USDT futures · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      'no qualified setup · scanned ' + universe.length + ' CoinDCX contracts',
      '',
      'next check in 10 minutes',
      SITE
    ].join('\n');
    const quietId = await send(quiet);
    console.log('sent quiet', quietId, 'scanned', universe.length, 'cards', 0);
    return;
  }
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const lines = hits.map(function(h, i){
    const p = h.plan;
    const comp = h.s.score === 5 ? ' · composite +5/5 !GOLDEN' : '';
    const tag = h.grade === 'TRADE' ? 'TRADE' : ('SKIP · ' + h.reasons.join(' · '));
    const entryBit = p.entryType === 'LIMIT'
      ? ('4h ' + p.limitEma + ' tagged ' + px(p.entry))
      : ('entry ' + px(p.entry) + ' · 4h EMA tagged');
    return (i + 1) + '. ' + h.base + ' · B-' + h.base + '_USDT · LONG · NEW TREND MATRIX GOLDEN CROSS · cross ' + h.s.ago + 'd ago · +' + h.s.score + '/5' + comp + ' · ' + tag
      + '\n   ' + entryBit + ' · SL ' + px(p.stop) + ' · TP1 ' + px(p.t1) + ' (2R) · TP2 ' + px(p.t2) + ' (3.5R)';
  });
  const head = [
    'HARDGATE — NEW GOLDEN CROSS',
    'CoinDCX active USDT futures only · ' + when,
    hits.length + ' new · scanned ' + universe.length + ' CoinDCX pairs',
    'TRADE only when RSI, OBV and funding agree, and BTC structure is not down for an alt. SKIP is not a trade.'
  ].join('\n');
  const bodyParts = lines.length ? chunks(lines) : [''];
  const ids = [];
  for (let p = 0; p < bodyParts.length; p++){
    const text = [
      head + (bodyParts.length > 1 ? (' · part ' + (p + 1) + '/' + bodyParts.length) : ''),
      '',
      bodyParts[p],
      '',
      'next new cross check in 10 minutes',
      SITE
    ].join('\n');
    ids.push(await send(text));
  }
  console.log('sent', ids.join(','), 'scanned', universe.length, 'cards', hits.length);
}
main().catch(function(e){ console.error(e); process.exit(1); });
