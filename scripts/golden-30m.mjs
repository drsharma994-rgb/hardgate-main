/* BATCH 1131 — every 10 minutes, Telegram reports the CoinDCX scan.
   A golden cross that just formed is sent with levels. If none formed,
   Telegram still says there were no fresh crosses. Every active CoinDCX
   USDT future is scanned. Binance-only coins are not sent. A cross
   already sent is not repeated. */
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
  return j.map(function(k){ return { o:+k[1], h:+k[2], l:+k[3], c:+k[4] }; });
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
  const entry = h4[h4.length - 1].c;
  const a = atr(h4, 14);
  if (!(entry > 0) || !(a > 0)) return null;
  const seg = h4.slice(Math.max(0, h4.length - 1 - 20), h4.length - 1);
  const swing = seg.length ? Math.min.apply(null, seg.map(function(r){ return r.l; })) : NaN;
  let stop = NaN;
  if (isFinite(swing)){
    const s = swing - 0.25 * a;
    const risk = entry - s;
    if (risk > 0 && risk <= 2.5 * a) stop = s;
  }
  if (!isFinite(stop) || !(entry > stop)) stop = entry - 1.5 * a;
  const risk = entry - stop;
  if (!(risk > 0)) return null;
  return { entry: entry, stop: stop, t1: entry + 2 * risk, t2: entry + 3.5 * risk };
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
  const hits = [];
  await pool(universe, 6, async function(t){
    try {
      const d1 = await klines(t.symbol, '1d', 260);
      const h4 = await klines(t.symbol, '4h', 120);
      const s = scoreOf(d1, h4);
      if (!s || !(s.e50 > s.e200)) return;
      if (!s.fresh && s.score !== 5) return;
      const plan = planOf(h4);
      if (!plan) return;
      const base = t.symbol.replace(/USDT$/, '');
      const crossDay = new Date(Date.now() - s.ago * 86400000).toISOString().slice(0, 10);
      const prev = sent[base];
      const formed = s.fresh && (!prev || prev.fresh === false || (prev.crossDay && prev.crossDay !== crossDay));
      if (s.fresh) sent[base] = { at: new Date().toISOString(), score: s.score, fresh: true, ago: s.ago, crossDay: crossDay };
      if (!formed) return;
      hits.push({ base: base, s: s, plan: plan });
    } catch (e) {
      console.error(t.symbol, e.message || e);
    }
  });
  hits.sort(function(a, b){
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
      'no fresh crosses · scanned ' + universe.length + ' CoinDCX contracts',
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
    return (i + 1) + '. ' + h.base + ' · B-' + h.base + '_USDT · LONG · NEW TREND MATRIX GOLDEN CROSS · cross ' + h.s.ago + 'd ago · +' + h.s.score + '/5' + comp
      + '\n   entry ' + px(p.entry) + ' · SL ' + px(p.stop) + ' · TP1 ' + px(p.t1) + ' (2R) · TP2 ' + px(p.t2) + ' (3.5R)';
  });
  const head = [
    'HARDGATE — NEW GOLDEN CROSS',
    'CoinDCX active USDT futures only · ' + when,
    hits.length + ' new · scanned ' + universe.length + ' CoinDCX pairs'
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
