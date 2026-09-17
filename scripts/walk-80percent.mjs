#!/usr/bin/env node
/* HARDGATE — walk the 80PERCENT strategy over real 5m gold bars.
   ==============================================================

   The tab implements the High-Momentum Trend Dip-Buyer exactly as supplied
   and states, from arithmetic alone, that 4.00 ATR risked for 0.75 ATR needs
   84.2105% to break even before cost and ~89.7% at XM after it. What it
   cannot say is what the entries ACTUALLY hit. This does that.

   ONE IMPLEMENTATION, NOT TWO. The strategy is not re-coded here. This loads
   eightypercent.js into a sandbox and calls its own hg80Scan, so the walk
   tests the thing the tab shows. A scanner with its own copy of the rules is
   a scanner that eventually measures a strategy nobody is trading.

   WHAT IS HARD ABOUT MEASURING THIS ONE

   1. THE EXIT ORDER, NOT THE FILL. Entry is the trigger candle's CLOSE, so
      the fill is never in doubt — a market print at the close precedes
      everything after it. The ambiguity is later: on any single resolution
      bar whose range covers BOTH the target and the stop, OHLC cannot say
      which was touched first. That is a different thing from this repo's
      unprovable FILL, and it is named separately on every row
      (ambiguityKind: 'exit-order') even though it is carried through the
      same interval machinery, because its effect is identical: an outcome
      the bars cannot establish.

      It matters here more than anywhere else on this desk. One ambiguous
      bar resolved the wrong way is worth 5.33 winners. So these rows are
      never guessed — they produce an INTERVAL, via lib/unprovable-fill.mjs,
      exactly as the gold book does.

   2. GAPS REMOVE AMBIGUITY AND COST MONEY. If a bar OPENS beyond the stop,
      the fill is at that open, not at the stop, and the loss is worse than
      -1R. Modelling every stop as exactly -1R is how a 4 ATR stop looks
      safer than it is — which is the precise failure mode the spec's own
      risk warning describes. The open is the bar's first print, so a gap is
      unambiguous; it is priced at the open, both ways.

   3. ONE POSITION AT A TIME. Signals fire on consecutive bars in a trend.
      Taking all of them is a record nobody could have traded. The book here
      is sequential: take a signal when flat, hold it to its own exit, count
      everything that fires meanwhile as skipped.

   4. COST IS THE WHOLE QUESTION. A 0.75 ATR target on 5m gold is a couple of
      dollars and the spread is most of one. Every number is reported gross
      AND net at both venues, because the gross number is not the one that
      decides anything.

   Run:
     node scripts/walk-80percent.mjs [--bars=N] [--horizon=N] [--refresh]
                                     [--symbol=PAXGUSDT] [--json]

   Or, with no network at all — which is the only way it has ever been able
   to run in this repo's own sandbox:

     node scripts/walk-80percent.mjs --bars-file=path/to/xauusd-5m.csv

   Add --sweep to re-price the SAME entries across a grid of target/stop
   pairs. The spec's 4.00 / 0.75 needs 84.2105% before costs and no entry
   rule can change that, so "should the exits move?" is the question worth
   measuring, and the sweep answers it on data instead of opinion. Read its
   caveat: the best cell is chosen on the same bars it is scored on.

   Writes scripts/walk-80percent-results.json.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { boundRows, winRateBounds, thresholdVsInterval } from '../lib/unprovable-fill.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const CACHE_DIR = path.join(ROOT, '.cache', 'walk-80percent');
const OUT = path.join(ROOT, 'scripts', 'walk-80percent-results.json');

const argv = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const BARS     = Math.max(600, parseInt(argOf('bars', '20000'), 10) || 20000);
/* No time stop is specified by the strategy. An unbounded hold never
   resolves some trades, so one is imposed and its expiries are reported
   SEPARATELY — never folded into wins or losses. 288 x 5m is 24 hours. */
const HORIZON  = Math.max(12, parseInt(argOf('horizon', '288'), 10) || 288);
const SYMBOL   = argOf('symbol', 'PAXGUSDT');
const REFRESH  = argv.includes('--refresh');
const JSON_OUT = argv.includes('--json');
/* bars from a file instead of the network — see readBarsFile */
const BARS_FILE = argOf('bars-file', null);
/* the geometry sweep: same entries, different target/stop pairs */
const SWEEP    = argv.includes('--sweep');
/* WHICH MECHANICS TO WALK.

   The default is the supplied spec alone, and that default is load-bearing:
   widening it would silently turn this file into a measurement of a
   different strategy than the one it has always reported.

   But the spec fires almost never. Its own census explains why — a long
   needs price above its 50 EMA while RSI says the last fourteen bars were
   net down, and those two fight each other — and on live gold it has fired
   zero times on every rung of the ladder. A walk that measures only the
   spec therefore measures nothing, and a geometry sweep over nothing is
   nothing. So the looser mechanics the tab actually produces firings under
   can be walked too, on request, and they are reported under their own
   names because that is the whole point of keeping the records apart. */
const MECHANICS = String(argOf('mechanics', 'spec')).toLowerCase();

/* Venue round trips, the same two the gold desk prices every card at. */
const VENUES = { XM: 0.00020, PAXG: 0.0026 };

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

/* ==================== 1. DATA ==================== */

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-80percent-walk/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

async function fetchKlines(symbol, target){
  const ivMs = 5 * 60 * 1000;
  let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol
            + '&interval=5m&limit=' + lim;
    if (endTime) url += '&endTime=' + endTime;
    const batch = await jget(url);
    if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out);
    endTime = batch[0][0] - 1;
    if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out
    .filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
    .sort((a, b) => a.t - b.t);
  /* the forming bar has not closed, so it is not a bar */
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  return rows;
}

async function cachedKlines(symbol, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-5m.json');
  if (!REFRESH && fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j.rows && j.rows.length >= target){
        log('  cache hit: ' + j.rows.length + ' bars ('
          + ((Date.now() - j.fetchedAt) / 3.6e6).toFixed(1) + 'h old)');
        return j.rows.slice(-target);
      }
    } catch (e) { /* refetch */ }
  }
  log('  fetching ' + symbol + ' 5m x' + target + ' ...');
  const rows = await fetchKlines(symbol, target);
  if (rows.length) fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, rows }));
  return rows;
}

/* ==================== 1b. BARS FROM A FILE ====================

   THE WALK WAS UNRUNNABLE AND THAT WAS THE WHOLE PROBLEM.

   Every number this tab shows is arithmetic on an unmeasured strategy: no
   file in data/ mentions P80, scripts/walk-80percent-results.json has never
   existed, and .cache/walk-80percent/ has never held a bar. The reason is
   one line — the only source is api.binance.com, and plenty of environments
   (this repo's own agent sandbox included) answer 403 to CONNECT and will
   never clear on a retry.

   So bars can come from a file instead. Any file: whatever a broker or
   charting package exports, in whatever column order, with whatever it
   calls its timestamp. Guessing wrong is worse than refusing, so this
   reports what it decided every column meant and refuses rather than
   assume when it cannot tell.

   Accepted:
     .json   an array of {t,o,h,l,c,v} (the repo's own shape), or an array
             of arrays in Binance kline order
     .csv    a header row naming the columns, in any order, with any of the
             usual spellings — time/date/timestamp/datetime, o/open,
             h/high, l/low, c/close, v/vol/volume. Tab, comma or semicolon.
     .txt    MT4/MT5 export: DATE,TIME,OPEN,HIGH,LOW,CLOSE,VOLUME with no
             header, which is why a headerless file is not an error.       */

const TS_KEYS   = ['t', 'time', 'timestamp', 'date', 'datetime', 'opentime', 'open_time', 'bar'];
const O_KEYS    = ['o', 'open'];
const H_KEYS    = ['h', 'high', 'max'];
const L_KEYS    = ['l', 'low', 'min'];
const C_KEYS    = ['c', 'close', 'last', 'price'];
const V_KEYS    = ['v', 'vol', 'volume', 'tickvol', 'tick_volume'];

function normKey(s){ return String(s || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, ''); }

/* Seconds, from whatever the file used to say when the bar opened. Returns
   null rather than a guess — a bar with an unreadable time is a bar that
   cannot be placed in a session window or ordered against its neighbours. */
export function parseBarTime(raw){
  if (raw == null) return null;
  if (typeof raw === 'number' && isFinite(raw)){
    /* seconds, milliseconds, or microseconds — decided by magnitude, which
       is unambiguous for any date this century */
    if (raw > 1e14) return Math.floor(raw / 1e6);
    if (raw > 1e11) return Math.floor(raw / 1e3);
    if (raw > 1e8)  return Math.floor(raw);
    return null;                                   /* too small to be a date */
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^[0-9]+$/.test(s)) return parseBarTime(Number(s));
  /* MT4/MT5 writes 2026.09.17 12:05 — dots, and no timezone. Treated as UTC
     and SAID SO in the run header, because silently reading a broker's
     server time as UTC would shift every session-window decision. */
  const mt = s.match(/^([0-9]{4})[.\-\/]([0-9]{2})[.\-\/]([0-9]{2})[ T,]+([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?/);
  if (mt){
    return Math.floor(Date.UTC(+mt[1], +mt[2] - 1, +mt[3], +mt[4], +mt[5], +(mt[6] || 0)) / 1000);
  }
  const d = Date.parse(/[zZ]|[+\-][0-9]{2}:?[0-9]{2}$/.test(s) ? s : (s.replace(' ', 'T') + 'Z'));
  return isFinite(d) ? Math.floor(d / 1000) : null;
}

function pick(headerIdx, keys){
  for (const k of keys){ if (headerIdx[k] != null) return headerIdx[k]; }
  return null;
}

function splitLine(line){
  if (line.indexOf('\t') >= 0) return line.split('\t');
  if (line.indexOf(';') >= 0 && line.indexOf(',') < 0) return line.split(';');
  return line.split(',');
}

export function parseBarsCsv(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
                    .filter(l => !l.startsWith('#'));
  if (!lines.length) return { rows: [], why: 'the file is empty' };

  const first = splitLine(lines[0]).map(normKey);
  const looksLikeHeader = first.some(h => TS_KEYS.includes(h) || C_KEYS.includes(h));
  let idx, body, mapping;

  if (looksLikeHeader){
    const headerIdx = {};
    first.forEach((h, i) => { if (headerIdx[h] == null) headerIdx[h] = i; });
    idx = { t: pick(headerIdx, TS_KEYS), o: pick(headerIdx, O_KEYS), h: pick(headerIdx, H_KEYS),
            l: pick(headerIdx, L_KEYS), c: pick(headerIdx, C_KEYS), v: pick(headerIdx, V_KEYS) };
    body = lines.slice(1);
    mapping = 'header row: ' + Object.entries(idx)
      .map(([k, i]) => k + '=' + (i == null ? 'none' : splitLine(lines[0])[i].trim())).join(' ');
    /* a header that named a date column AND a separate time column */
    const dIdx = headerIdx['date'], tIdx = headerIdx['time'];
    if (dIdx != null && tIdx != null && dIdx !== tIdx) idx.tPair = [dIdx, tIdx];
  } else {
    /* MT4/MT5 headerless: DATE,TIME,O,H,L,C,V */
    const cells = splitLine(lines[0]);
    if (cells.length >= 6 && /^[0-9]{4}[.\-\/][0-9]{2}/.test(cells[0].trim())
        && /^[0-9]{2}:[0-9]{2}/.test(cells[1].trim())){
      idx = { tPair: [0, 1], o: 2, h: 3, l: 4, c: 5, v: cells.length > 6 ? 6 : null };
      mapping = 'no header — MT4/MT5 layout (date,time,open,high,low,close,volume)';
      body = lines;
    } else {
      return { rows: [], why: 'no header row, and the first line is not the MT4/MT5 '
                            + 'date,time,o,h,l,c layout either — add a header naming the columns' };
    }
  }

  if (idx.c == null && !idx.tPair) return { rows: [], why: 'no close column found' };
  if (idx.c == null) return { rows: [], why: 'no close column found' };
  if (idx.t == null && !idx.tPair) return { rows: [], why: 'no time column found' };

  const rows = [];
  let bad = 0;
  for (const line of body){
    const cells = splitLine(line);
    const tRaw = idx.tPair ? (cells[idx.tPair[0]] + ' ' + cells[idx.tPair[1]]) : cells[idx.t];
    const t = parseBarTime(tRaw);
    const num = i => (i == null ? NaN : parseFloat(String(cells[i]).replace(/["' ]/g, '')));
    const c = num(idx.c);
    if (t == null || !isFinite(c)){ bad++; continue; }
    const o = isFinite(num(idx.o)) ? num(idx.o) : c;
    const h = isFinite(num(idx.h)) ? num(idx.h) : Math.max(o, c);
    const l = isFinite(num(idx.l)) ? num(idx.l) : Math.min(o, c);
    rows.push({ t, o, h, l, c, v: isFinite(num(idx.v)) ? num(idx.v) : 0 });
  }
  return { rows, mapping, skipped: bad };
}

export function parseBarsJson(text){
  let j;
  try { j = JSON.parse(text); } catch (e){ return { rows: [], why: 'not valid JSON: ' + e.message }; }
  const arr = Array.isArray(j) ? j : (Array.isArray(j.rows) ? j.rows : null);
  if (!arr) return { rows: [], why: 'expected an array of bars, or {rows:[...]}' };
  const rows = [];
  let bad = 0;
  for (const r of arr){
    if (Array.isArray(r)){                       /* Binance kline order */
      const t = parseBarTime(r[0]), c = parseFloat(r[4]);
      if (t == null || !isFinite(c)){ bad++; continue; }
      rows.push({ t, o: +r[1], h: +r[2], l: +r[3], c, v: +r[5] || 0 });
      continue;
    }
    if (!r || typeof r !== 'object'){ bad++; continue; }
    const lower = {};
    for (const k of Object.keys(r)) lower[normKey(k)] = r[k];
    const t = parseBarTime(lower.t != null ? lower.t
      : (lower.time != null ? lower.time : (lower.timestamp != null ? lower.timestamp
      : (lower.date != null ? lower.date : lower.datetime))));
    const c = parseFloat(lower.c != null ? lower.c : lower.close);
    if (t == null || !isFinite(c)){ bad++; continue; }
    const o = parseFloat(lower.o != null ? lower.o : lower.open);
    const h = parseFloat(lower.h != null ? lower.h : lower.high);
    const l = parseFloat(lower.l != null ? lower.l : lower.low);
    rows.push({ t, c,
                o: isFinite(o) ? o : c,
                h: isFinite(h) ? h : Math.max(isFinite(o) ? o : c, c),
                l: isFinite(l) ? l : Math.min(isFinite(o) ? o : c, c),
                v: parseFloat(lower.v != null ? lower.v : lower.volume) || 0 });
  }
  return { rows, mapping: 'json objects', skipped: bad };
}

/* The modal gap between consecutive bars. The strategy's session filter and
   its horizon are both stated in bar counts, so the walk has to know what a
   bar IS rather than assume the 5m the fetcher always gave it. */
export function detectInterval(rows){
  if (!rows || rows.length < 3) return null;
  const counts = new Map();
  for (let i = 1; i < rows.length; i++){
    const d = rows[i].t - rows[i - 1].t;
    if (d > 0) counts.set(d, (counts.get(d) || 0) + 1);
  }
  let best = null, bestN = 0;
  for (const [d, n] of counts){ if (n > bestN){ best = d; bestN = n; } }
  return best ? { sec: best, share: bestN / (rows.length - 1) } : null;
}

const TF_NAME = { 60: '1m', 300: '5m', 900: '15m', 1800: '30m',
                  3600: '1h', 7200: '2h', 14400: '4h', 86400: '1d' };
export function tfNameOf(sec){ return TF_NAME[sec] || (sec + 's'); }

/* Sorted, deduplicated, and with anything unusable named rather than
   quietly dropped. */
export function tidyBars(rows){
  const seen = new Set(), out = [];
  let dupes = 0, dropped = 0;
  for (const r of rows.slice().sort((a, b) => a.t - b.t)){
    if (!isFinite(r.t) || !isFinite(r.c) || !(r.c > 0)){ dropped++; continue; }
    if (!(r.h >= r.l)){ dropped++; continue; }
    if (seen.has(r.t)){ dupes++; continue; }
    seen.add(r.t);
    out.push(r);
  }
  return { rows: out, dupes, dropped };
}

export function readBarsFile(file){
  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  const parsed = (ext === '.json') ? parseBarsJson(text)
               : (text.trim().startsWith('[') || text.trim().startsWith('{'))
                 ? parseBarsJson(text) : parseBarsCsv(text);
  if (!parsed.rows.length){
    return { rows: [], why: parsed.why || 'no readable bars in the file' };
  }
  const tidy = tidyBars(parsed.rows);
  const iv = detectInterval(tidy.rows);
  return { rows: tidy.rows, mapping: parsed.mapping, skipped: parsed.skipped || 0,
           dupes: tidy.dupes, dropped: tidy.dropped, interval: iv };
}

/* ==================== 2. THE STRATEGY — the tab's own code ==================== */

export function loadStrategy(){
  const store = {};
  const el = () => ({ style: {}, innerHTML: '', textContent: '', className: '',
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => null, querySelectorAll: () => [], dataset: {} });
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
    Float64Array, setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; } } };
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], head: el(), body: el(), documentElement: el(),
    addEventListener(){}, readyState: 'complete' };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  /* indicators.js for ema/rsi/atr, then the tab itself */
  for (const f of ['indicators.js', 'indicators2.js', 'eightypercent.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  if (typeof ctx.hg80Scan !== 'function') throw new Error('eightypercent.js did not export hg80Scan');
  return ctx;
}

/* ==================== 3. RESOLUTION ==================== */

/* Walk bars forward from the signal and settle one position.

   Order within a bar is decided by what OHLC can actually establish:
     the OPEN is the first print, so a gap through either level is certain;
     otherwise, if only one level is inside the bar's range, that one was hit;
     if BOTH are, nothing can be established and the row is flagged.

   THE TAB OWNS THIS TOO. eightypercent.js exports hg80Resolve and its own
   STILL OPEN / RESOLVED panels call it, so the resolver lives beside the
   strategy it resolves and this file delegates rather than keeping a second
   copy. Two copies of an exit rule is how a walk ends up measuring outcomes
   the tab would never have printed — the same failure a second copy of the
   ENTRY rules would cause, and it is guarded the same way.

   The sandbox is loaded once and cached, so importing resolve() costs one
   file read and no network. */
let __ctx = null;
function strategy(){
  if (!__ctx) __ctx = loadStrategy();
  return __ctx;
}

export function resolve(rows, i, plan, horizon){
  return strategy().hg80Resolve(rows, i, plan, horizon);
}

/* ==================== 4. THE WALK ==================== */

export function wilson(wins, n, z){
  z = isFinite(z) ? z : 1.96;
  if (!(n > 0) || !(wins >= 0) || wins > n) return null;
  const p = wins / n, z2 = z * z, denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p };
}

/* HOW OFTEN EACH CONDITION HOLDS, AND HOW OFTEN THEY COINCIDE.

   Without this, a walk that returns three trades looks like a bug or a data
   problem. It is neither, and the reason is structural rather than
   incidental:

     a LONG needs close > EMA50 (price above its recent mean) AND RSI(14)
     < 45 (the last fourteen bars net DOWN). On a 5m chart those two are
     close to mutually exclusive — fourteen net-down bars usually leave the
     close below a 50-period EMA.

   So the breakdown reports each condition's own frequency, the pair
   frequency, and what INDEPENDENCE would have predicted. The ratio between
   the last two is the number that explains the trade count, and it is the
   kind of thing that should be measured on the user's real bars rather
   than argued about. */
export function conditionCensus(rows, ctx){
  const ind = ctx.hg80Indicators(rows);
  if (!ind) return null;
  const side = () => ({ trend: 0, pullback: 0, trigger: 0, trendPull: 0, three: 0, fired: 0 });
  const out = { evaluable: 0, session: 0, long: side(), short: side() };
  for (let i = 0; i < rows.length; i++){
    const s = ctx.hg80SignalAt(rows, ind, i);
    if (!s) continue;
    out.evaluable++;
    if (s.longChecks.session) out.session++;
    for (const [key, ch] of [['long', s.longChecks], ['short', s.shortChecks]]){
      const x = out[key];
      if (ch.trend) x.trend++;
      if (ch.pullback) x.pullback++;
      if (ch.trigger) x.trigger++;
      if (ch.trend && ch.pullback) x.trendPull++;
      if (ch.trend && ch.pullback && ch.trigger) x.three++;
      if (ch.trend && ch.pullback && ch.trigger && ch.session) x.fired++;
    }
  }
  const n = out.evaluable || 1;
  for (const key of ['long', 'short']){
    const x = out[key];
    x.pTrend = x.trend / n;
    x.pPullback = x.pullback / n;
    x.pTrendPull = x.trendPull / n;
    /* what you would see if trend and pullback were unrelated */
    x.pIfIndependent = x.pTrend * x.pPullback;
    x.rarerThanIndependent = x.pTrendPull > 0 ? (x.pIfIndependent / x.pTrendPull) : null;
  }
  return out;
}

export function run(rows, ctx, opts){
  const o = opts || {};
  const scanOpts = {};
  if (o.cfg) scanOpts.cfg = o.cfg;
  if (o.variants && o.variants.length) scanOpts.variants = o.variants;
  const scan = ctx.hg80Scan(rows, Object.keys(scanOpts).length ? scanOpts : undefined);
  if (!scan.ok) throw new Error(scan.why);
  const spec = ctx.HG_P80_SPEC;
  const horizon = isFinite(o.horizon) ? o.horizon : HORIZON;
  /* the geometry. Absent = the supplied spec, so a normal run is unchanged;
     the sweep supplies a pair and the plans are rebuilt by the TAB's own
     hg80Plan rather than by arithmetic repeated here. */
  const geo = o.geometry || null;

  /* sequential book: one position at a time */
  const trades = [];
  let skipped = 0, openUntil = -1;

  for (const s of scan.signals){
    if (s.i <= openUntil){ skipped++; continue; }
    const plan = geo ? ctx.hg80Plan(s, geo) : s.plan;
    if (!plan) continue;
    const res = resolve(rows, s.i, plan, horizon);
    if (!res) continue;
    openUntil = s.i + res.bars;

    const row = {
      tISO: new Date(s.t * 1000).toISOString(),
      dir: s.dir, kind: (s.mech || 'P80') + '-DIP-' + s.dir.toUpperCase(),
      mechanic: s.mech || 'P80', variant: s.variant || 'spec',
      entry: plan.entry, stop: plan.stop, t1: plan.t1,
      atr: s.atr, rsi: s.rsi, ema50: s.ema50, ema200: s.ema200,
      riskPx: Math.abs(plan.entry - plan.stop),
      rewardPx: Math.abs(plan.t1 - plan.entry),
      stopPct: (Math.abs(plan.entry - plan.stop) / plan.entry) * 100,
      /* MARKET entry at the close — the fill itself is never in doubt */
      orderType: 'MARKET',
      outcome: res.outcome, exit: res.exit, rMultiple: res.rMultiple,
      barsHeld: res.bars, exitISO: new Date(res.exitT * 1000).toISOString(),
      gapped: res.gapped,
      /* HOW FAR IT ACTUALLY TRAVELLED, both ways, in ATR and in R. Carried
         on every row so the sweep can answer the question the tab can only
         gesture at on 500 bars: was the stop the thing being measured? */
      maeAtr: res.maeAtr, mfeAtr: res.mfeAtr, maeR: res.maeR, mfeR: res.mfeR,
      /* the ambiguity here is the EXIT ORDER, not the fill. Carried on the
         repo's flag so the interval machinery works unchanged, and named
         so nobody reads it as a fill problem. */
      unprovableFill: res.ambiguous,
      ambiguityKind: res.ambiguous ? 'exit-order' : null
    };
    for (const [v, rt] of Object.entries(VENUES)){
      row['costR_' + v] = (plan.entry * rt) / row.riskPx;
      row['netR_' + v] = row.rMultiple - row['costR_' + v];
    }
    trades.push(row);
  }
  return { trades, skipped, scanned: scan.signals.length, spec,
           geometry: geo ? { tpAtr: geo.tpAtr, slAtr: geo.slAtr }
                         : { tpAtr: spec.tpAtr, slAtr: spec.slAtr },
           census: o.skipCensus ? null : conditionCensus(rows, ctx) };
}

/* See the `excursions` note in summarise(). Computed over everything that
   RESOLVED — an expiry travelled too, and excluding it would bias the
   deepest-adverse figure toward trades that ended early. */
export function excursionStats(trades, tpAtr){
  const rows = (trades || []).filter(r => Number.isFinite(r.maeAtr) && Number.isFinite(r.mfeAtr));
  if (!rows.length) return null;
  const med = a => {
    const x = a.slice().sort((p, q) => p - q), m = Math.floor(x.length / 2);
    return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
  };
  /* reduce, not a spread: Math.max applied to a spread array throws once
     the array is long enough, and this runs over whole multi-symbol books */
  const maxOf = a => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const wins = rows.filter(r => r.outcome === 'win');
  const fails = rows.filter(r => r.outcome !== 'win');
  const mae = rows.map(r => r.maeAtr);
  const out = {
    n: rows.length, nWin: wins.length, nFail: fails.length,
    deepestAdverseAtr: maxOf(mae),
    medianAdverseAtr: med(mae),
    p90AdverseAtr: (() => { const x = mae.slice().sort((p, q) => p - q);
      return x[Math.min(x.length - 1, Math.floor(0.9 * (x.length - 1)))]; })(),
    winnersWorstAtr: wins.length ? maxOf(wins.map(r => r.maeAtr)) : null,
    failuresBestAtr: fails.length ? maxOf(fails.map(r => r.mfeAtr)) : null,
    fittedSlAtr: null, fittedGrossBreakeven: null,
    fittedIsMaximumOverSample: true,
    note: 'fittedSlAtr is the winners worst adverse excursion in THIS run: a maximum over a '
        + 'sample, so it can only rise with more data and is biased tight. A diagnostic for '
        + 'whether the stop was ever the binding constraint — not a parameter to adopt. To '
        + 'test a stop, re-run the sweep at it.'
  };
  if (out.winnersWorstAtr > 0 && tpAtr > 0){
    out.fittedSlAtr = out.winnersWorstAtr;
    out.fittedGrossBreakeven = out.fittedSlAtr / (out.fittedSlAtr + tpAtr);
  }
  return out;
}

export function summarise(trades, geometry){
  const settled = trades.filter(r => r.outcome === 'win' || r.outcome === 'loss');
  const expired = trades.filter(r => r.outcome === 'expired');
  const bounds = winRateBounds(settled);

  /* THE BAR THIS CONFIGURATION HAS TO CLEAR. Taken from the geometry that
     produced these trades, not from a pair typed in here — the sweep prices
     the same entries at other multiples and each one has its own bar. A
     hard-coded 4.00 / 0.75 would have scored every swept cell against the
     spec's requirement instead of its own, which is the whole measurement
     inverted. */
  const tpAtr = (geometry && geometry.tpAtr > 0) ? geometry.tpAtr : 0.75;
  const slAtr = (geometry && geometry.slAtr > 0) ? geometry.slAtr : 4.0;
  const grossBE = slAtr / (slAtr + tpAtr);

  const out = {
    geometry: { tpAtr, slAtr },
    trades: trades.length, settled: settled.length, expired: expired.length,
    ambiguous: settled.filter(r => r.unprovableFill).length,
    gapped: settled.filter(r => r.gapped).length,
    grossBreakeven: grossBE,
    winRate: bounds,
    /* AMBIGUITY ONLY — what the bars can establish if the sample were
       infinite. Reported because it isolates one of the two uncertainties,
       NEVER as the verdict: on 9 wins and 1 loss it says 'below' (i.e.
       established above the bar), which is nonsense on ten trades. */
    verdictVsAmbiguityOnly: thresholdVsInterval(settled, grossBE),
    /* WHAT THE STOP AND THE TARGET ACTUALLY HAD TO BE.

       The win rate says what THIS geometry paid. The excursions say whether
       this geometry was the thing being measured at all — a stop is only
       risk if price goes there, and if nothing in the run ever traded
       within a third of it then the required rate above was being paid for
       risk that did not occur.

       fittedSlAtr is the winners' worst adverse excursion: the tightest
       stop that would still have held every winner IN THIS RUN. It is a
       MAXIMUM OVER A SAMPLE, so it can only rise as the sample grows — the
       error has a known sign and the number is biased tight. It is a
       diagnostic, never a parameter to adopt; the way to test a stop is to
       re-run the sweep at it, which is one flag away. */
    excursions: excursionStats(trades, tpAtr),
    byBound: {}
  };

  for (const bound of ['lower', 'point', 'upper']){
    const rs = boundRows(settled, bound);
    const w = rs.filter(r => r.outcome === 'win').length;
    const n = rs.length;
    const mean = key => n ? rs.reduce((s, r) => s + (r[key] || 0), 0) / n : null;
    out.byBound[bound] = {
      n, wins: w, hit: n ? w / n : null,
      wilson95: wilson(w, n, 1.96),
      grossR: mean('rMultiple'),
      netR_XM: mean('netR_XM'),
      netR_PAXG: mean('netR_PAXG')
    };
  }

  /* THE VERDICT COMBINES BOTH UNCERTAINTIES.

     There are two independent reasons this walk might not know the win
     rate, and either alone is not enough to decide anything:

       AMBIGUITY   bars that cannot order the target against the stop, which
                   spread the rate between a lower and an upper bound
       SAMPLING    the ordinary error of measuring a rate on n trades

     A claim in the desk's favour has to survive BOTH at their worst: the
     Wilson lower limit computed on the LOWER bound's rows. A condemnation
     has to survive both at their best. Anything else is 'not established',
     which is the answer this will almost certainly give for a long time and
     is a real answer rather than a failure.

     Using thresholdVsInterval alone here would have reported nine wins out
     of ten as an established edge. */
  const lo = out.byBound.lower, hi = out.byBound.upper;
  const loW = lo && lo.n ? wilson(lo.wins, lo.n, 1.96) : null;
  const hiW = hi && hi.n ? wilson(hi.wins, hi.n, 1.96) : null;
  out.verdict = {
    threshold: grossBE,
    worstCaseLo: loW ? loW.lo : null,
    bestCaseHi: hiW ? hiW.hi : null,
    state: (!loW || !hiW) ? 'no-data'
         : (loW.lo > grossBE) ? 'established-above'
         : (hiW.hi < grossBE) ? 'established-below'
         : 'not-established',
    why: 'the Wilson 95% lower limit on the ambiguity LOWER bound must clear '
       + (100 * grossBE).toFixed(4) + '% for an edge, and the upper limit on the UPPER '
       + 'bound must fail it for a condemnation'
  };

  /* AND THE ONE THAT ACTUALLY DECIDES. A win rate above the gross bar still
     loses money if net R is negative, which is the entire question for a
     0.75 ATR target priced against a fixed spread. */
  out.paysAtVenue = {};
  for (const v of Object.keys(VENUES)){
    out.paysAtVenue[v] = {
      lower: lo ? lo['netR_' + v] : null,
      point: out.byBound.point ? out.byBound.point['netR_' + v] : null,
      upper: hi ? hi['netR_' + v] : null,
      positiveAtEveryBound: [lo, out.byBound.point, hi]
        .every(x => x && isFinite(x['netR_' + v]) && x['netR_' + v] > 0)
    };
  }
  return out;
}

/* ==================== 4b. THE GEOMETRY SWEEP ====================

   THE BINDING CONSTRAINT IS NOT THE ENTRY.

   4.00 ATR risked for 0.75 needs 84.2105% before a penny of cost, and
   ~89.96% at XM on 5m gold after it. No pullback threshold, no session
   window and no extra mechanic moves that number — it is set by the two
   multiples alone. So the question worth measuring is what a DIFFERENT pair
   would have needed and what it would have got, on the identical entries.

   Identical is the word that matters. The signals are scanned once; each
   cell re-prices those same signals through the tab's own hg80Plan and
   re-resolves them through the tab's own hg80Resolve. Nothing about the
   entry changes between cells, so any difference is the geometry and only
   the geometry.

   The sequential book is re-run per cell rather than reused, because it
   cannot be: a wider stop holds longer, so a different set of later signals
   is skipped while the position is open. Reusing one book across cells
   would compare geometries on trade lists they would never have produced.

   WHAT THIS IS NOT: a recommendation. Read the warning the sweep prints.   */

export const SWEEP_TP = [0.75, 1.0, 1.5, 2.0, 3.0];
export const SWEEP_SL = [1.0, 1.5, 2.0, 3.0, 4.0];

export function sweepGeometry(rows, ctx, opts){
  const o = opts || {};
  const cells = [];
  for (const slAtr of SWEEP_SL){
    for (const tpAtr of SWEEP_TP){
      const geo = { tpAtr, slAtr };
      const r = run(rows, ctx, { cfg: o.cfg, horizon: o.horizon, geometry: geo,
                                 variants: o.variants, skipCensus: true });
      const sum = summarise(r.trades, geo);
      cells.push({
        tpAtr, slAtr,
        rr: slAtr / tpAtr,
        grossBreakeven: sum.grossBreakeven,
        taken: r.trades.length,
        skippedWhileInPosition: r.skipped,
        settled: sum.settled,
        expired: sum.expired,
        ambiguous: sum.ambiguous,
        hit: sum.byBound.point ? sum.byBound.point.hit : null,
        hitLo: sum.byBound.lower ? sum.byBound.lower.hit : null,
        hitHi: sum.byBound.upper ? sum.byBound.upper.hit : null,
        grossR: sum.byBound.point ? sum.byBound.point.grossR : null,
        netR_XM: sum.byBound.point ? sum.byBound.point.netR_XM : null,
        netR_PAXG: sum.byBound.point ? sum.byBound.point.netR_PAXG : null,
        verdict: sum.verdict.state,
        paysXM: sum.paysAtVenue.XM ? sum.paysAtVenue.XM.positiveAtEveryBound : null,
        paysPAXG: sum.paysAtVenue.PAXG ? sum.paysAtVenue.PAXG.positiveAtEveryBound : null
      });
    }
  }

  /* THE HONEST HEALTH WARNING, computed rather than asserted.

     Every cell is scored on the same bars. Picking the best of N and
     quoting its number is selection on noise: with N cells and a 5% test,
     the chance that at least one clears by luck alone is 1-(1-0.05)^N,
     which for this grid is most of the way to certain. So the sweep reports
     that probability, states the Sidak-adjusted per-cell level that would
     be needed to make a SINGLE claim at 95% overall, and refuses to name a
     winner.

     A cell worth believing has to be re-measured on bars this sweep never
     saw. That is a second run on a later export, not a second look at this
     one. */
  const n = cells.length;
  const familywise = 1 - Math.pow(0.95, n);
  const sidakPerCell = 1 - Math.pow(0.95, 1 / n);

  const cleared = cells.filter(c => c.verdict === 'established-above');
  return {
    grid: { tpAtr: SWEEP_TP, slAtr: SWEEP_SL, cells: n },
    cells,
    multipleComparisons: {
      cellsTested: n,
      chanceOneClearsByLuck: familywise,
      sidakPerCellAlphaFor95Overall: sidakPerCell,
      clearedAtNominal95: cleared.length,
      note: 'every cell is scored on the same bars, so the best of ' + n + ' is selected on '
          + 'noise as well as signal. At a nominal 5% test the chance that at least one cell '
          + 'clears by luck alone is ' + (100 * familywise).toFixed(1) + '%. Nothing here is a '
          + 'recommendation; a cell is worth believing only after it is re-measured on bars '
          + 'this sweep never saw.'
    }
  };
}

/* ==================== 5. MAIN ==================== */

const IS_MAIN = (() => {
  try { return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch (e){ return false; }
})();

/* Guarded so a test can import resolve() and friends without the walk
   firing a network fetch on import — the engine has to be checkable
   without the data it cannot reach. */
async function main(){
  log('80PERCENT — 5m walk');
  log('===================\n');

  let rows, sourceNote, fileInfo = null;

  if (BARS_FILE){
    /* NO NETWORK AT ALL. This is the path that makes the walk runnable
       anywhere, which is why the tab has never had a measured number. */
    let read;
    try {
      read = readBarsFile(path.isAbsolute(BARS_FILE) ? BARS_FILE : path.join(process.cwd(), BARS_FILE));
    } catch (e){
      const payload = { ok: false, ran: false, blocked: 'file',
        error: String((e && e.message) || e),
        note: 'could not read ' + BARS_FILE };
      if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
      else console.error('\n  CANNOT RUN: ' + payload.note + '\n  ' + payload.error);
      process.exit(1);
    }
    if (!read.rows.length){
      const payload = { ok: false, ran: false, blocked: 'file',
        error: read.why || 'no readable bars',
        note: 'the file was read but produced no usable bars' };
      if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
      else console.error('\n  CANNOT RUN: ' + payload.error);
      process.exit(1);
    }
    rows = read.rows.slice(-BARS);
    fileInfo = { file: BARS_FILE, mapping: read.mapping, unreadableLines: read.skipped,
                 duplicateTimestamps: read.dupes, droppedBars: read.dropped,
                 intervalSec: read.interval ? read.interval.sec : null,
                 intervalShare: read.interval ? read.interval.share : null };
    sourceNote = 'bars read from ' + BARS_FILE + '. Timestamps with no zone are read as UTC, '
      + 'which is what the 13:00-18:00 session filter is stated in — a broker export in server '
      + 'time will shift every session decision, so check the first bar\'s hour against what '
      + 'your platform showed.';
    log('  ' + read.rows.length + ' bars from ' + BARS_FILE);
    log('    ' + (read.mapping || 'columns inferred'));
    if (read.skipped) log('    ' + read.skipped + ' line(s) unreadable and skipped');
    if (read.dupes)   log('    ' + read.dupes + ' duplicate timestamp(s) dropped');
    if (read.dropped) log('    ' + read.dropped + ' malformed bar(s) dropped');
    if (read.interval){
      log('    interval ' + tfNameOf(read.interval.sec) + ' ('
        + (100 * read.interval.share).toFixed(1) + '% of gaps)');
    }
  } else {
  try {
    rows = await cachedKlines(SYMBOL, BARS);
  } catch (e){
    const msg = String((e && e.message) || e);
    const blocked = /403|CONNECT|ENOTFOUND|fetch failed|EAI_AGAIN/i.test(msg);
    const payload = { ok: false, ran: false,
      blocked: blocked ? 'network' : 'fetch',
      error: msg,
      note: blocked
        ? 'the kline host is unreachable from here (a gateway policy denial answers 403 to '
          + 'CONNECT and will not clear on a retry) — this walk needs open outbound access'
        : 'the fetch failed for a reason other than a network block' };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else {
      console.error('\n  CANNOT RUN: ' + payload.note);
      console.error('  ' + msg);
      console.error('\n  You do not need the network. Export bars from your broker or chart');
      console.error('  and pass them in:  --bars-file=path/to/xauusd-5m.csv');
    }
    process.exit(1);
  }
  sourceNote = SYMBOL + ' 5m from Binance klines.';
  }

  if (!rows || rows.length < 600){
    const payload = { ok: false, ran: false, blocked: 'data',
      error: 'got ' + (rows ? rows.length : 0) + ' bars, need at least 600',
      note: 'EMA(200) alone needs 200 bars before the first evaluable candle' };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else console.error('\n  CANNOT RUN: ' + payload.note);
    process.exit(1);
  }

  log('  ' + rows.length + ' bars  ' + new Date(rows[0].t * 1000).toISOString().slice(0, 16)
    + ' .. ' + new Date(rows[rows.length - 1].t * 1000).toISOString().slice(0, 16) + ' UTC\n');

  const ctx = loadStrategy();

  /* THE BARS DECIDE THE TIMEFRAME, not the fetcher that used to be the only
     source. A 15m export is a perfectly good thing to walk; reading it as
     5m would apply the session gate on the wrong bar length and state the
     horizon in the wrong unit. */
  const iv = detectInterval(rows);
  const tfSec = iv ? iv.sec : 300;
  const cfg = ctx.hg80Cfg({ tf: tfNameOf(tfSec), sec: tfSec });
  if (iv && iv.sec !== 300){
    log('  running as ' + tfNameOf(tfSec) + ' — session gate '
      + (cfg.session ? 'APPLIES' : 'does NOT apply') + ' at this bar length');
  }

  /* the mechanics to walk, resolved from the flag against the tab's own
     variant table so a name this file invents cannot silently match nothing */
  const ALL = ctx.HG_P80_VARIANTS || [];
  let variants = null, mechNote = 'the supplied spec only';
  if (MECHANICS === 'all'){
    variants = ALL; mechNote = 'all ' + ALL.length + ' mechanics (' + ALL.map(v => v.mech).join(', ') + ')';
  } else if (MECHANICS !== 'spec'){
    const want = MECHANICS.split(',').map(x => x.trim()).filter(Boolean);
    variants = ALL.filter(v => want.includes(v.key) || want.includes(String(v.mech).toLowerCase()));
    if (!variants.length){
      console.error('\n  CANNOT RUN: --mechanics=' + MECHANICS + ' matched nothing. Known: spec, all, '
        + ALL.map(v => v.key).join(', '));
      process.exit(1);
    }
    mechNote = variants.map(v => v.mech).join(', ');
  }
  log('  mechanics: ' + mechNote);

  const { trades, skipped, scanned, spec, census, geometry } = run(rows, ctx, { cfg, variants });
  const sum = summarise(trades, geometry);

  const sweep = SWEEP ? sweepGeometry(rows, ctx, { cfg, horizon: HORIZON, variants }) : null;

  const bake = {
    ok: true, ran: true,
    generated: new Date().toISOString(),
    symbol: BARS_FILE ? ('file:' + path.basename(BARS_FILE)) : SYMBOL,
    source: BARS_FILE ? 'file' : 'binance',
    sourceNote,
    file: fileInfo,
    note: BARS_FILE
      ? sourceNote
      : (SYMBOL + ' 5m is a proxy for XAUUSD; it prints 24/7 bars a gold broker never did, '
        + 'and its basis to spot runs 0.1-0.5%. The session filter is applied on the bar\'s '
        + 'own UTC hour, so the window is honoured, but weekend bars inside 13:00-18:00 are '
        + 'bars no broker offered.'),
    timeframe: { sec: tfSec, name: tfNameOf(tfSec), sessionApplies: cfg.session },
    spec, horizonBars: HORIZON, venues: VENUES,
    mechanics: { requested: MECHANICS, walked: mechNote,
                 keys: variants ? variants.map(v => v.key) : ['spec'] },
    window: { from: new Date(rows[0].t * 1000).toISOString(),
              to: new Date(rows[rows.length - 1].t * 1000).toISOString(), bars: rows.length },
    signals: { fired: scanned, taken: trades.length, skippedWhileInPosition: skipped },
    conditions: census,
    summary: sum,
    sweep,
    trades
  };

  fs.writeFileSync(OUT, JSON.stringify(bake, null, 2));

  if (JSON_OUT){ console.log(JSON.stringify(bake, null, 2)); return; }

  const pct = v => (v == null ? '—' : (100 * v).toFixed(2) + '%');
  const r3 = v => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(4) + 'R');

  if (census){
    const p2 = v => (100 * v).toFixed(2) + '%';
    log('  WHY THE TRADE COUNT IS WHAT IT IS');
    log('    evaluable bars ' + census.evaluable + ', of which ' + census.session
      + ' (' + p2(census.session / census.evaluable) + ') are inside 13:00-18:00 UTC');
    log('    side   trend     pullback   together   if independent   rarer by');
    for (const k of ['long', 'short']){
      const x = census[k];
      log('    ' + k.padEnd(7) + p2(x.pTrend).padEnd(10) + p2(x.pPullback).padEnd(11)
        + p2(x.pTrendPull).padEnd(11) + p2(x.pIfIndependent).padEnd(17)
        + (x.rarerThanIndependent ? x.rarerThanIndependent.toFixed(1) + 'x' : '—'));
    }
    log('    A long needs price ABOVE its 50 EMA while RSI(14) says the last fourteen bars');
    log('    were net DOWN. Those two fight each other, which is why the pair is far rarer');
    log('    than either alone — not a bug, and not a data problem.');
    log('');
  }
  log('  signals fired            ' + scanned);
  log('  taken (one at a time)    ' + trades.length + '   skipped while in a position ' + skipped);
  log('  settled / expired        ' + sum.settled + ' / ' + sum.expired);
  log('  ambiguous exit bars      ' + sum.ambiguous
    + '   (both target and stop inside one bar — OHLC cannot order them)');
  log('  gapped exits             ' + sum.gapped + '   (filled at the open, past the level)');
  log('');
  log('  THE BAR: ' + pct(sum.grossBreakeven) + ' before cost, from the spec\'s own 4.00 / 0.75.');
  log('');
  log('  bound      n      hit       Wilson 95%            gross      net XM     net PAXG');
  for (const b of ['lower', 'point', 'upper']){
    const x = sum.byBound[b];
    const w = x.wilson95;
    log('  ' + b.padEnd(9) + String(x.n).padEnd(7)
      + pct(x.hit).padEnd(10)
      + (w ? (pct(w.lo) + ' .. ' + pct(w.hi)).padEnd(22) : '—'.padEnd(22))
      + r3(x.grossR).padEnd(11) + r3(x.netR_XM).padEnd(11) + r3(x.netR_PAXG));
  }
  log('');
  const V = sum.verdict;
  log('  VERDICT (ambiguity AND sampling error, both at their worst):');
  if (V.state === 'established-above')
    log('    the win rate IS established above ' + pct(sum.grossBreakeven)
      + ' — worst-case lower limit ' + pct(V.worstCaseLo) + '.');
  else if (V.state === 'established-below')
    log('    the win rate IS established BELOW ' + pct(sum.grossBreakeven)
      + ' — best-case upper limit ' + pct(V.bestCaseHi) + '.');
  else if (V.state === 'not-established')
    log('    NOT ESTABLISHED either way — worst case ' + pct(V.worstCaseLo)
      + ', best case ' + pct(V.bestCaseHi) + ', and ' + pct(sum.grossBreakeven) + ' sits inside.');
  else log('    no settled trades to judge.');
  log('    (ambiguity alone would say: ' + (sum.verdictVsAmbiguityOnly || 'n/a')
    + ' — reported separately because on its own it ignores sample size)');
  log('');
  log('  DOES IT PAY? A win rate above ' + pct(sum.grossBreakeven)
    + ' still loses money if net R is negative.');
  for (const v of Object.keys(VENUES)){
    const p = sum.paysAtVenue[v];
    log('    ' + v.padEnd(5) + ' net R  lower ' + r3(p.lower) + '  point ' + r3(p.point)
      + '  upper ' + r3(p.upper)
      + '   -> ' + (p.positiveAtEveryBound ? 'pays at EVERY bound' : 'does NOT pay at every bound'));
  }

  if (sweep){
    log('');
    log('  GEOMETRY SWEEP — the same ' + trades.length + ' entries, re-priced at '
      + sweep.grid.cells + ' target/stop pairs');
    log('  The entry rules never change between cells, so every difference below is the');
    log('  geometry and only the geometry.');
    log('');
    log('   SL    TP     R:R    needs      taken  settled  hit      net XM      net PAXG   verdict');
    for (const c of sweep.cells){
      const spec0 = (c.tpAtr === 0.75 && c.slAtr === 4.0) ? ' <- spec' : '';
      log('  ' + c.slAtr.toFixed(2).padStart(5)
        + c.tpAtr.toFixed(2).padStart(7)
        + (c.rr.toFixed(2) + ':1').padStart(9)
        + pct(c.grossBreakeven).padStart(10)
        + String(c.taken).padStart(8)
        + String(c.settled).padStart(9)
        + (c.hit == null ? '—' : pct(c.hit)).padStart(9)
        + r3(c.netR_XM).padStart(12)
        + r3(c.netR_PAXG).padStart(12)
        + '   ' + c.verdict + spec0);
    }
    const mc = sweep.multipleComparisons;
    log('');
    log('  READ THIS BEFORE BELIEVING ANY ROW ABOVE.');
    log('    ' + mc.cellsTested + ' cells, all scored on the SAME bars. At a nominal 5% test the');
    log('    chance at least one clears by luck alone is '
      + (100 * mc.chanceOneClearsByLuck).toFixed(1) + '%. To make ONE claim at 95%');
    log('    overall a cell would need to clear at '
      + (100 * mc.sidakPerCellAlphaFor95Overall).toFixed(3) + '% per cell, not 5%.');
    log('    ' + mc.clearedAtNominal95 + ' cell(s) reached established-above at the nominal level.');
    log('    "taken" differs between cells and that is not an error: a wider stop holds longer,');
    log('    so a different set of later signals is skipped while the position is open. Each');
    log('    cell is the book that geometry would actually have produced.');
    log('    No winner is named here on purpose. A cell is worth believing only once it is');
    log('    re-measured on bars this sweep never saw — a second export, not a second look.');
  }

  log('\n  wrote ' + path.relative(ROOT, OUT));
}

if (IS_MAIN) main();
