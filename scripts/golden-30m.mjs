/* BATCH 1124 — golden Telegram every 30 minutes.
   Binance sometimes returns an error object instead of a ticker array.
   That threw tick.filter and the job died before any alert. */
import fs from 'fs';

const STATE_FILE = 'golden-alert-state.json';
const SITE = 'https://hardgate-main.onrender.com/';
const TOP_N = 24;
const SKIP = new Set(['USDC','USDT','FDUSD','TUSD','BUSD','DAI','USDP','EUR','USD']);
const FALLBACK = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','TONUSDT','TRXUSDT','LTCUSDT','BCHUSDT','NEARUSDT','SUIUSDT','DOTUSDT','APTUSDT','PEPEUSDT'];
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
      if (!r.ok){ last = host + ' HTTP ' + r.status; continue; }
      return j;
    } catch (e) {
      last = (e && e.message) || String(e);
    }
  }
  throw new Error(last);
}
async function klines(symbol, interval, limit){
  const j = await getJson('/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit);
  if (!Array.isArray(j)) throw new Error(symbol + ' ' + interval + ' not candles');
  return j.map(function(k){ return { t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }; });
}
async function universe(){
  try {
    const tick = await getJson('/api/v3/ticker/24hr');
    if (Array.isArray(tick)){
      return tick
        .filter(function(t){ return t && typeof t.symbol === 'string' && t.symbol.endsWith('USDT') && !SKIP.has(t.symbol.replace(/USDT$/, '')) && +t.quoteVolume > 2e7; })
        .sort(function(a, b){ return +b.quoteVolume - +a.quoteVolume; })
        .slice(0, TOP_N);
    }
    console.error('ticker was not a list');
  } catch (e) {
    console.error('ticker', e.message || e);
  }
  return FALLBACK.map(function(s){ return { symbol: s, quoteVolume: 0 }; });
}
function scoreOf(d1, h4){
  const c = d1.map(function(r){ return r.c; });
  const e50 = ema(c, 50), e200 = ema(c, 200);
  const i = c.length - 1;
  const d1Trend = c[i] > e200[i] ? 1 : (c[i] < e200[i] ? -1 : 0);
  const d1Cross = e50[i] > e200[i] ? 1 : (e50[i] < e200[i] ? -1 : 0);
  const ago = crossedUp(e50, e200, 10);
  const c4 = h4.map(function(r){ return r.c; });
  const e9 = ema(c4, 9), e21 = ema(c4, 21), e50h = ema(c4, 50);
  const j = c4.length - 1;
  let h4Cascade = 0;
  if (e9[j] > e21[j] && e21[j] > e50h[j]) h4Cascade = 1;
  else if (e9[j] < e21[j] && e21[j] < e50h[j]) h4Cascade = -1;
  const cloud = ichimokuAbove(d1);
  const adx = adxLast(d1, 14);
  const trendSum = d1Trend + d1Cross + h4Cascade + cloud;
  const adxPt = (adx >= 25) ? (trendSum > 0 ? 1 : (trendSum < 0 ? -1 : 0)) : 0;
  return { score: d1Trend + d1Cross + h4Cascade + cloud + adxPt, fresh: ago >= 0, ago: ago, px: c[i], e50: e50[i], e200: e200[i] };
}
function loadState(){ try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return { sent: {} }; } }
function saveState(state){ fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n'); }
async function send(text){
  const token = process.env.TELEGRAM_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chat) return { ok: false, reason: 'no token' };
  const res = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 4096), disable_web_page_preview: true })
  });
  const j = await res.json().catch(function(){ return null; });
  return { ok: !!(j && j.ok), id: j && j.result && j.result.message_id, reason: j && j.description };
}
async function main(){
  const list = await universe();
  const state = loadState();
  const sent = state.sent || {};
  const hits = [];
  for (const t of list){
    try {
      const d1 = await klines(t.symbol, '1d', 260);
      const h4 = await klines(t.symbol, '4h', 80);
      const s = scoreOf(d1, h4);
      if (!s.fresh && s.score !== 5) continue;
      if (!(s.e50 > s.e200)) continue;
      const base = t.symbol.replace(/USDT$/, '');
      hits.push({ base: base, s: s, plus5: s.score === 5, isNew: !sent[base] });
      sent[base] = { at: new Date().toISOString(), score: s.score, fresh: s.fresh, ago: s.ago };
    } catch (e) { console.error(t.symbol, e.message || e); }
  }
  state.sent = sent;
  state.lastRunAt = new Date().toISOString();
  saveState(state);
  if (!hits.length){
    console.log('no golden cross and no composite +5/5 this run');
    return;
  }
  const lines = hits.map(function(h){
    const tag = h.isNew ? 'NEW' : 'STILL LIVE';
    const cross = h.s.fresh ? ('golden cross ' + h.s.ago + ' daily bar(s) ago') : 'EMA50 above EMA200';
    const comp = h.plus5 ? 'composite +5/5 !GOLDEN' : ('composite +' + h.s.score + '/5');
    return tag + ' ' + h.base + ' LONG · ' + cross + ' · ' + comp + ' · px ' + Number(h.s.px).toFixed(4);
  });
  const text = ['HARDGATE — TREND MATRIX GOLDEN CROSS', '30-minute check · every new golden cross · composite +5/5 !GOLDEN', '', lines.join('\n'), '', SITE].join('\n');
  const r = await send(text);
  console.log('telegram', r.ok ? ('sent ' + r.id) : r.reason, 'cards', hits.length);
  if (!r.ok) process.exitCode = 1;
}
main().catch(function(e){ console.error(e); process.exit(1); });
