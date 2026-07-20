/* =========================================================================
HARDGATE — onchain.js
ON-CHAIN tab: BTC on-chain intelligence from mempool.space's free,
CORS-open, no-key REST API. Five legs, all direct (no proxy needed):

  GET /api/mempool                   -> { count, vsize, total_fee }
  GET /api/v1/fees/recommended       -> { fastestFee, halfHourFee, hourFee,
                                         economyFee, minimumFee }  (sat/vB)
  GET /api/v1/difficulty-adjustment  -> { progressPercent, difficultyChange,
                                         estimatedRetargetDate, remainingBlocks }
  GET /api/v1/mining/hashrate/1w     -> { hashrates: [{timestamp, avgHashrate}] }
  GET /api/blocks/tip/height         -> bare block height (text)

Panels:
  1) MEMPOOL — tx count, MvB backlog (~blocks), total fees waiting (BTC),
     congestion verdict EMPTY / NORMAL / BUSY / CLOGGED from vsize
     thresholds, with a backlog bar vs the clogged threshold.
  2) FEE MARKET — the four sat/vB tiers + FEE SPIKE flag:
     fastestFee >= 3x economyFee = demand surge; historically tags local
     tops / panic bidding.
  3) MINERS — difficulty retarget countdown (progress %, blocks to go,
     ETA) + change %, hashrate 1w trend. MINER CAPITULATION WATCH =
     negative difficulty change AND falling hashrate (contrarian
     accumulation zone); rising both = MINERS HEALTHY.
  4) ON-CHAIN BIAS — composite bullish / bearish / neutral with the
     evidence listed (no fabricated numeric score) and how it should
     color BTC setups ('on-chain supports longs' / 'stand aside …').

Fetch layer: Promise.allSettled over the five legs (polyfilled semantics
when missing), per-leg degradation with honest notes, 5-minute cache,
12s AbortController timeout per leg, NEVER throws. Legs that fail render
as honest empty states; nothing is ever fabricated.

PURE EXPORTS (no DOM, test-driven):
  window.onchainParseMempool(j)   -> {count, vsize, totalFee} | null
  window.onchainParseFees(j)      -> {fastestFee, halfHourFee, hourFee, economyFee} | null
  window.onchainParseDifficulty(j)-> {progressPercent, difficultyChange,
                                      estimatedRetargetDate, remainingBlocks} | null
  window.onchainParseHashrate(j)  -> {points, first, last, trendPct} | null
                                      (trendPct in % w/w; 0 when <2 points)
  window.onchainParseTipHeight(j) -> number | null
  window.onchainCongestion(vsize) -> 'empty'|'normal'|'busy'|'clogged'|null
  window.onchainBuildSnap(raw)    -> normalized snapshot {mempool, fees,
                                      difficulty, hashrate, tipHeight, notes[]}
  window.onchainSignal(snap)      -> { bias, evidence[{side,text}],
                                      flags{feeSpike, congestion, capitulation},
                                      healthyMiners, hashrateTrendPct,
                                      setupColor, note }  — never throws
  window.onchainFetch(force?)     -> async, fills the cache, never throws
  window.onchainState()           -> the cache object

REFRESH CONTRACT (house hard-refresh fix):
  refresh: async function () — never throws; returns a terse status
  string ('refreshed' | 'skipped: not run yet' | 'busy' |
  'degraded: no leg succeeded'); SKIPS when the tab has no data yet so a
  global refresh never triggers a first-time fetch; busy-guarded so
  overlapping invocations never double-fetch; re-renders if mounted.

Classic script, no build step. Never throws at load time; every global is
feature-checked. Registers via
  window.HG_tabs.push({id:'onchain', label:'ON-CHAIN', mount, refresh}).
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* ---------------- tunables ---------------- */
var API_BASE         = 'https://mempool.space/api';
var CACHE_MS         = 5 * 60 * 1000;  // 5-minute snapshot cache
var FETCH_TIMEOUT_MS = 12000;          // per-leg timeout
var FEE_SPIKE_MULT   = 3;              // fastestFee >= 3x economyFee = spike
var CONG_EMPTY_MAX   = 10e6;           // < 10 MvB backlog  = empty
var CONG_NORMAL_MAX  = 60e6;           // < 60 MvB          = normal
var CONG_BUSY_MAX    = 150e6;          // < 150 MvB         = busy, >= = clogged
var HR_FLAT_BAND_PCT = 1.0;            // |trend| <= 1% w/w = flat

/* ---------------- formatters (reuse index.html helpers when present) ---------------- */
function _fmtFb(n, d){
  d = (d === undefined) ? 2 : d;
  return (n === null || n === undefined || !isFinite(n))
    ? '—'
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
var FMT = (typeof G.fmt === 'function') ? G.fmt : _fmtFb;

function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function num(x){
  if (x === null || x === undefined || x === '') return null;
  var n = +x;
  return isFinite(n) ? n : null;
}
function fmtHash(h){
  if (!isFinite(h)) return '—';
  var a = Math.abs(h);
  if (a >= 1e18) return (h/1e18).toFixed(1) + ' EH/s';
  if (a >= 1e15) return (h/1e15).toFixed(1) + ' PH/s';
  if (a >= 1e12) return (h/1e12).toFixed(1) + ' TH/s';
  return FMT(h, 0) + ' H/s';
}
function countdown(toMs, nowMs){
  if (!isFinite(toMs)) return '—';
  var d = toMs - nowMs;
  if (d <= 0) return 'due now';
  var days = Math.floor(d / 86400e3);
  var hrs  = Math.floor((d % 86400e3) / 3600e3);
  var min  = Math.floor((d % 3600e3) / 60e3);
  if (days > 0) return 'in ' + days + 'd ' + hrs + 'h';
  if (hrs > 0)  return 'in ' + hrs + 'h ' + min + 'm';
  return 'in ' + min + 'm';
}
function isoDate(ms){
  if (!isFinite(ms)) return '—';
  try{ return new Date(ms).toISOString().replace('T', ' ').slice(5, 16) + ' UTC'; }
  catch(e){ return '—'; }
}

/* ============================ pure parsers ============================ */
/* Each parser is total: garbage in -> null out; partial input -> object
   with the usable fields and nulls elsewhere. Nothing is invented. */

function parseMempool(j){
  try{
    if (!j || typeof j !== 'object') return null;
    var out = { count: num(j.count), vsize: num(j.vsize), totalFee: num(j.total_fee) };
    if (out.count === null && out.vsize === null && out.totalFee === null) return null;
    return out;
  }catch(e){ return null; }
}

function parseFees(j){
  try{
    if (!j || typeof j !== 'object') return null;
    var out = {
      fastestFee: num(j.fastestFee),
      halfHourFee: num(j.halfHourFee),
      hourFee: num(j.hourFee),
      economyFee: num(j.economyFee)
    };
    if (out.fastestFee === null && out.halfHourFee === null &&
        out.hourFee === null && out.economyFee === null) return null;
    return out;
  }catch(e){ return null; }
}

function parseDifficulty(j){
  try{
    if (!j || typeof j !== 'object') return null;
    var eta = num(j.estimatedRetargetDate);
    if (eta !== null && eta < 1e12) eta = eta * 1000;  // seconds -> ms, defensive
    var out = {
      progressPercent: num(j.progressPercent),
      difficultyChange: num(j.difficultyChange),
      estimatedRetargetDate: eta,
      remainingBlocks: num(j.remainingBlocks)
    };
    if (out.progressPercent === null && out.difficultyChange === null &&
        out.estimatedRetargetDate === null && out.remainingBlocks === null) return null;
    return out;
  }catch(e){ return null; }
}

function parseHashrate(j){
  try{
    if (!j || typeof j !== 'object' || !Array.isArray(j.hashrates)) return null;
    var pts = j.hashrates.map(function(p){
        if (!p || typeof p !== 'object') return null;
        var h = num(p.avgHashrate), t = num(p.timestamp);
        return (h === null) ? null : { t: (t === null ? 0 : t), h: h };
      }).filter(function(p){ return p !== null; });
    if (!pts.length) return null;
    pts.sort(function(a, b){ return a.t - b.t; });
    var first = pts[0].h, last = pts[pts.length - 1].h;
    var trendPct = (pts.length >= 2 && first > 0) ? ((last - first) / first) * 100 : 0;
    return { points: pts.length, first: first, last: last, trendPct: trendPct };
  }catch(e){ return null; }
}

function parseTipHeight(j){
  try{
    if (j && typeof j === 'object') return null;  // API returns a bare number
    return num(j);
  }catch(e){ return null; }
}

function congestionOf(vsize){
  if (!isFinite(vsize) || vsize < 0) return null;
  if (vsize < CONG_EMPTY_MAX)  return 'empty';
  if (vsize < CONG_NORMAL_MAX) return 'normal';
  if (vsize < CONG_BUSY_MAX)   return 'busy';
  return 'clogged';
}

/* Combine the five raw legs into one normalized snapshot with honest
   per-leg notes. Any leg may be null — downstream code must cope. */
function buildSnap(raw){
  raw = raw || {};
  var snap = {
    mempool:    parseMempool(raw.mempool),
    fees:       parseFees(raw.fees),
    difficulty: parseDifficulty(raw.difficulty),
    hashrate:   parseHashrate(raw.hashrate),
    tipHeight:  parseTipHeight(raw.tipHeight),
    notes: []
  };
  if (!snap.mempool)          snap.notes.push('mempool leg unavailable');
  if (!snap.fees)             snap.notes.push('fee-market leg unavailable');
  if (!snap.difficulty)       snap.notes.push('difficulty leg unavailable');
  if (!snap.hashrate)         snap.notes.push('hashrate leg unavailable');
  if (snap.tipHeight === null) snap.notes.push('tip-height leg unavailable');
  return snap;
}

/* ============================ pure signal ============================ */
/* onchainSignal(snap): composite on-chain bias. Evidence-driven, no
   fabricated score: bull/bear evidence is counted, ties and missing data
   resolve to neutral. Never throws, tolerates partial/garbage snaps. */
function onchainSignal(snap){
  var out = {
    bias: 'neutral',
    evidence: [],
    flags: { feeSpike: false, congestion: null, capitulation: false },
    healthyMiners: false,
    hashrateTrendPct: null,
    setupColor: 'no on-chain edge — trade the chart',
    note: null
  };
  try{
    snap = snap || {};
    var mp   = (snap.mempool    && typeof snap.mempool    === 'object') ? snap.mempool    : null;
    var fees = (snap.fees       && typeof snap.fees       === 'object') ? snap.fees       : null;
    var diff = (snap.difficulty && typeof snap.difficulty === 'object') ? snap.difficulty : null;
    var hr   = (snap.hashrate   && typeof snap.hashrate   === 'object') ? snap.hashrate   : null;

    /* --- mempool congestion --- */
    if (mp && isFinite(mp.vsize)){
      var cong = congestionOf(mp.vsize);
      out.flags.congestion = cong;
      var mb = mp.vsize / 1e6;
      if (cong === 'clogged'){
        out.evidence.push({ side: 'bear', text: 'mempool clogged: ' + mb.toFixed(0) + ' MvB backlog — extreme fee pressure, frothy demand' });
      } else if (cong === 'busy'){
        out.evidence.push({ side: 'bear', text: 'mempool busy: ' + mb.toFixed(0) + ' MvB backlog — fees getting bid up' });
      } else if (cong === 'empty'){
        out.evidence.push({ side: 'info', text: 'mempool nearly empty: ' + mb.toFixed(1) + ' MvB backlog — no demand pressure either way' });
      } else if (cong === 'normal'){
        out.evidence.push({ side: 'info', text: 'mempool normal: ' + mb.toFixed(0) + ' MvB backlog' });
      }
    }

    /* --- fee spike: fastestFee >= 3x economyFee = demand surge --- */
    if (fees && isFinite(fees.fastestFee) && isFinite(fees.economyFee) && fees.economyFee > 0){
      if (fees.fastestFee >= FEE_SPIKE_MULT * fees.economyFee){
        out.flags.feeSpike = true;
        out.evidence.push({ side: 'bear', text: 'fee spike: fastest ' + fees.fastestFee + ' sat/vB ≥ ' + FEE_SPIKE_MULT + '× economy ' + fees.economyFee + ' sat/vB — demand surge, historically tags local tops/panic' });
      } else {
        out.evidence.push({ side: 'info', text: 'fee market calm: fastest ' + fees.fastestFee + ' sat/vB vs economy ' + fees.economyFee + ' sat/vB' });
      }
    }

    /* --- miners: capitulation needs BOTH a negative retarget AND a
           falling 1w hashrate; rising both = healthy --- */
    var hrTrend = (hr && isFinite(hr.trendPct)) ? hr.trendPct : null;
    out.hashrateTrendPct = hrTrend;
    var falling = (hrTrend !== null && hrTrend < -HR_FLAT_BAND_PCT);
    var rising  = (hrTrend !== null && hrTrend >  HR_FLAT_BAND_PCT);
    var dch = (diff && isFinite(diff.difficultyChange)) ? diff.difficultyChange : null;

    if (dch !== null && dch < 0 && falling){
      out.flags.capitulation = true;
      out.evidence.push({ side: 'bull', text: 'miner capitulation watch: retarget ' + dch.toFixed(2) + '% and hashrate ' + hrTrend.toFixed(1) + '% w/w — contrarian accumulation zone' });
    } else if (dch !== null && dch > 0 && rising){
      out.healthyMiners = true;
      out.evidence.push({ side: 'bull', text: 'miners healthy: difficulty +' + dch.toFixed(2) + '% and hashrate +' + hrTrend.toFixed(1) + '% w/w' });
    } else if (falling){
      out.evidence.push({ side: 'info', text: 'hashrate drifting lower (' + hrTrend.toFixed(1) + '% w/w) without a negative retarget — watch, not capitulation' });
    } else if (rising){
      out.evidence.push({ side: 'info', text: 'hashrate rising (+' + hrTrend.toFixed(1) + '% w/w)' });
    }

    /* --- composite: count evidence, clogged weighs double --- */
    var bull = 0, bear = 0;
    for (var i = 0; i < out.evidence.length; i++){
      if (out.evidence[i].side === 'bull') bull++;
      else if (out.evidence[i].side === 'bear') bear++;
    }
    if (out.flags.congestion === 'clogged') bear++;
    if (bull > bear) out.bias = 'bullish';
    else if (bear > bull) out.bias = 'bearish';

    if (!out.evidence.length) out.note = 'no on-chain data — fetch failed or not run yet';
    out.setupColor = (out.bias === 'bullish') ? 'on-chain supports longs'
                   : (out.bias === 'bearish') ? 'stand aside — on-chain headwind (or favor short setups)'
                   : 'no on-chain edge — trade the chart';
  }catch(e){
    out.bias = 'neutral';
    out.evidence = [];
    out.note = 'signal error: ' + (e && e.message);
  }
  return out;
}

/* ============================ state + fetch layer ============================ */
var OC = { loaded: false, at: 0, snap: null, errors: [] };
var __refreshing = null;   // in-flight fetch promise (dedupe / busy guard)
var __lastEl = null;       // last mounted element, for refresh re-render

function __allSettled(ps){
  if (typeof Promise !== 'undefined' && typeof Promise.allSettled === 'function'){
    return Promise.allSettled(ps);
  }
  return Promise.all(ps.map(function(p){
    return p.then(
      function(v){ return { status: 'fulfilled', value: v }; },
      function(r){ return { status: 'rejected', reason: r }; });
  }));
}

function __fetchLeg(url, kind){
  var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, FETCH_TIMEOUT_MS) : null;
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
    .then(function(res){
      if (!res || !res.ok) return null;
      return (kind === 'text') ? res.text() : res.json();
    })
    .then(function(body){ return (body === undefined) ? null : body; })
    .catch(function(){ return null; })
    .finally(function(){ if (timer) clearTimeout(timer); });
}

var LEGS = [
  ['mempool',    '/mempool',                    'json'],
  ['fees',       '/v1/fees/recommended',        'json'],
  ['difficulty', '/v1/difficulty-adjustment',   'json'],
  ['hashrate',   '/v1/mining/hashrate/1w',      'json'],
  ['tipHeight',  '/blocks/tip/height',          'text']
];

/* onchainFetch(force): never throws. Respects the 5-min cache unless
   forced; dedupes overlapping calls; degrades per leg with honest notes;
   marks the cache loaded only when at least one leg produced data. */
async function onchainFetch(force){
  try{
    if (typeof fetch !== 'function'){
      OC.errors = ['fetch unavailable in this environment'];
      return OC;
    }
    if (!force && OC.loaded && (Date.now() - OC.at) < CACHE_MS) return OC;
    if (__refreshing) return __refreshing;
    __refreshing = (async function(){
      var raw = {};
      try{
        var results = await __allSettled(LEGS.map(function(l){
          return __fetchLeg(API_BASE + l[1], l[2]);
        }));
        for (var i = 0; i < LEGS.length; i++){
          var r = results[i];
          raw[LEGS[i][0]] = (r && r.status === 'fulfilled') ? r.value : null;
        }
      }catch(e){
        raw = {};  // buildSnap below turns the all-null raw into honest notes
      }
      var snap = buildSnap(raw);
      var got = 0;
      if (snap.mempool) got++;
      if (snap.fees) got++;
      if (snap.difficulty) got++;
      if (snap.hashrate) got++;
      if (snap.tipHeight !== null) got++;
      OC.snap = snap;
      OC.errors = snap.notes.slice();
      if (got > 0){ OC.loaded = true; OC.at = Date.now(); }
      return OC;
    })();
    try{ return await __refreshing; }
    finally{ __refreshing = null; }
  }catch(e){
    OC.errors = ['fetch error: ' + (e && e.message)];
    return OC;
  }
}

function onchainState(){ return OC; }

/* ============================ rendering ============================ */
function kv(k, vHtml){
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
}
function feeTier(v){
  return (v === null || v === undefined || !isFinite(v)) ? '—' : FMT(v, 0) + ' sat/vB';
}

function render(el){
  var snap = OC.snap || null;
  var sig = onchainSignal(snap || {});
  var now = Date.now();
  var html = '';

  /* ---- header / controls ---- */
  var stat = OC.loaded
    ? 'live · updated ' + new Date(OC.at).toTimeString().slice(0, 8)
      + (snap && snap.tipHeight !== null ? ' · tip block ' + FMT(snap.tipHeight, 0) : '')
      + (OC.errors.length ? ' · ' + OC.errors.length + ' leg(s) degraded' : '')
    : 'not loaded — auto-fetches on open · source: mempool.space (free, no key)';
  html += '<div class="panel"><h2>ON-CHAIN INTELLIGENCE <span>BTC · mempool.space REST · no key · 5-min cache</span></h2>'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<button class="btn" id="ocRun">REFRESH ON-CHAIN</button>'
    + '<span class="note" id="ocStat">' + esc(stat) + '</span>'
    + '</div></div>';

  html += '<div class="grid2">';

  /* ---- 1) MEMPOOL ---- */
  html += '<div class="panel"><h2>MEMPOOL <span>backlog &amp; congestion</span></h2>';
  if (snap && snap.mempool){
    var mp = snap.mempool;
    html += kv('TRANSACTIONS WAITING', isFinite(mp.count) ? FMT(mp.count, 0) : '—');
    if (isFinite(mp.vsize)){
      var mb = mp.vsize / 1e6;
      var blocks = Math.max(1, Math.round(mb));
      var cong = sig.flags.congestion || 'normal';
      var congStamp = cong === 'empty'   ? '<span class="stamp pass">EMPTY</span>'
                    : cong === 'normal'  ? '<span class="stamp na">NORMAL</span>'
                    : '<span class="stamp veto">' + cong.toUpperCase() + '</span>';
      html += kv('BACKLOG', mb.toFixed(1) + ' MvB ≈ ' + FMT(blocks, 0) + ' blocks')
            + kv('CONGESTION', congStamp);
      var pct = Math.min(100, Math.round(100 * mp.vsize / CONG_BUSY_MAX));
      var barColor = (cong === 'busy' || cong === 'clogged') ? 'var(--short)'
                   : (cong === 'empty' ? 'var(--pass)' : 'var(--gold)');
      html += '<div style="height:6px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:3px;overflow:hidden;margin-top:6px">'
        + '<div style="height:100%;width:' + pct + '%;background:' + barColor + '"></div></div>'
        + '<div class="note" style="margin-top:4px">bar = backlog vs ' + (CONG_BUSY_MAX/1e6) + ' MvB clogged threshold · empty &lt; ' + (CONG_EMPTY_MAX/1e6)
        + ' · normal &lt; ' + (CONG_NORMAL_MAX/1e6) + ' · busy &lt; ' + (CONG_BUSY_MAX/1e6) + ' MvB</div>';
    } else {
      html += kv('BACKLOG', '—') + kv('CONGESTION', '—');
    }
    html += kv('TOTAL FEES WAITING', isFinite(mp.totalFee) ? (mp.totalFee / 1e8).toFixed(2) + ' BTC' : '—');
  } else {
    html += '<div class="empty">mempool leg unavailable'
      + (OC.loaded ? ' — fetch failed; other panels may still be live.' : ' — REFRESH ON-CHAIN fetches live data.')
      + '</div>';
  }
  html += '</div>';

  /* ---- 2) FEE MARKET ---- */
  html += '<div class="panel"><h2>FEE MARKET <span>sat/vB by confirmation target</span></h2>';
  if (snap && snap.fees){
    var f = snap.fees;
    html += kv('FASTEST (next block)', feeTier(f.fastestFee))
          + kv('~30 MIN',               feeTier(f.halfHourFee))
          + kv('~1 HOUR',               feeTier(f.hourFee))
          + kv('ECONOMY',               feeTier(f.economyFee));
    if (sig.flags.feeSpike){
      html += '<div style="margin-top:8px"><span class="stamp veto">FEE SPIKE — DEMAND SURGE</span></div>'
        + '<div class="note warn" style="margin-top:4px">fastestFee ≥ ' + FEE_SPIKE_MULT + '× economyFee — historically tags local tops / panic bidding. Caution on fresh longs.</div>';
    } else {
      html += '<div style="margin-top:8px"><span class="stamp pass">NO SPIKE</span></div>'
        + '<div class="note" style="margin-top:4px">spike flag = fastestFee ≥ ' + FEE_SPIKE_MULT + '× economyFee.</div>';
    }
  } else {
    html += '<div class="empty">fee-market leg unavailable'
      + (OC.loaded ? ' — fetch failed; other panels may still be live.' : ' — REFRESH ON-CHAIN fetches live data.')
      + '</div>';
  }
  html += '</div>';

  /* ---- 3) MINERS ---- */
  html += '<div class="panel"><h2>MINERS <span>difficulty retarget &amp; hashrate</span></h2>';
  var d = snap && snap.difficulty, hr = snap && snap.hashrate;
  if (d){
    var dch = d.difficultyChange;
    var dStamp = !isFinite(dch) ? '—'
      : dch > 0 ? '<span class="stamp pass">+' + dch.toFixed(2) + '%</span>'
      : dch < 0 ? '<span class="stamp veto">' + dch.toFixed(2) + '%</span>'
      : '<span class="stamp na">0.00%</span>';
    html += kv('NEXT RETARGET (est. change)', dStamp);
    if (isFinite(d.progressPercent) || isFinite(d.remainingBlocks)){
      html += kv('EPOCH PROGRESS',
        (isFinite(d.progressPercent) ? d.progressPercent.toFixed(1) + '%' : '—')
        + (isFinite(d.remainingBlocks) ? ' · ' + FMT(d.remainingBlocks, 0) + ' blocks to go' : ''));
    }
    if (isFinite(d.estimatedRetargetDate)){
      html += kv('RETARGET ETA', esc(isoDate(d.estimatedRetargetDate) + ' · ' + countdown(d.estimatedRetargetDate, now)));
    }
  } else {
    html += '<div class="note warn">difficulty leg unavailable — retarget countdown hidden.</div>';
  }
  if (hr){
    html += kv('HASHRATE (1W latest)', fmtHash(hr.last));
    html += kv('1W TREND', (hr.trendPct > 0 ? '+' : '') + hr.trendPct.toFixed(1) + '% w/w · ' + hr.points + ' pts');
  } else {
    html += '<div class="note warn">hashrate leg unavailable — 1w trend hidden.</div>';
  }
  if (sig.flags.capitulation){
    html += '<div style="margin-top:8px"><span class="stamp pass">MINER CAPITULATION WATCH</span></div>'
      + '<div class="note" style="margin-top:4px">negative retarget + falling hashrate — historically a contrarian accumulation zone, not a short trigger.</div>';
  } else if (sig.healthyMiners){
    html += '<div style="margin-top:8px"><span class="stamp pass">MINERS HEALTHY</span></div>'
      + '<div class="note" style="margin-top:4px">difficulty and hashrate both rising — no miner stress.</div>';
  } else {
    html += '<div style="margin-top:8px"><span class="stamp na">MINERS MIXED / NO SIGNAL</span></div>'
      + '<div class="note" style="margin-top:4px">capitulation watch needs BOTH a negative retarget AND a falling 1w hashrate.</div>';
  }
  html += '</div>';

  /* ---- 4) ON-CHAIN BIAS ---- */
  var biasStamp = sig.bias === 'bullish' ? '<span class="stamp pass">BULLISH</span>'
                : sig.bias === 'bearish' ? '<span class="stamp veto">BEARISH</span>'
                : '<span class="stamp na">NEUTRAL</span>';
  html += '<div class="panel"><h2>ON-CHAIN BIAS <span>composite · evidence-based, no numeric score</span></h2>'
    + kv('COMPOSITE BIAS', biasStamp)
    + kv('BTC SETUPS', esc(sig.setupColor));
  if (sig.evidence.length){
    html += '<div class="ledger" style="margin-top:8px">'
      + sig.evidence.map(function(e){
          var cls = e.side === 'bull' ? 'pass' : (e.side === 'bear' ? 'veto' : 'na');
          var tag = e.side === 'bull' ? 'BULL' : (e.side === 'bear' ? 'BEAR' : 'INFO');
          return '<div class="lrow"><span class="stamp ' + cls + '">' + tag + '</span>'
            + '<span class="gname" style="font-size:11px">' + esc(e.text) + '</span></div>';
        }).join('')
      + '</div>';
  } else {
    html += '<div class="empty" style="margin-top:8px">no evidence yet — ' + esc(sig.note || 'run REFRESH ON-CHAIN.') + '</div>';
  }
  if (sig.note && sig.evidence.length){
    html += '<div class="note warn" style="margin-top:6px">' + esc(sig.note) + '</div>';
  }
  html += '</div>';

  html += '</div>'; // .grid2

  /* ---- footer: source & freshness ---- */
  html += '<div class="panel"><h2>SOURCE &amp; FRESHNESS <span>honest degradation</span></h2><div class="note">'
    + 'mempool.space public REST — CORS-open, no API key · 5 legs: mempool, fees, difficulty, hashrate 1w, tip height'
    + ' · cached 5 min · on-chain reads are slow context (hours–days), not scalp triggers.'
    + (OC.errors && OC.errors.length
        ? '<br><span style="color:var(--gold)">degraded legs: ' + esc(OC.errors.join(' · ')) + '</span>'
        : '')
    + '</div></div>';

  el.innerHTML = html;

  var btn = el.querySelector('#ocRun');
  if (btn) btn.addEventListener('click', function(){
    btn.disabled = true;
    var st = el.querySelector('#ocStat');
    if (st) st.textContent = 'fetching 5 legs from mempool.space…';
    onchainFetch(true).then(function(){
      try{ render(el); }catch(e){}
    }).catch(function(){
      try{ render(el); }catch(e){}
    });
  });
}

function mount(el){
  try{
    if (!el) return;
    __lastEl = el;
    render(el);
    /* fire-and-forget: populate the cache in the background, then re-render.
       This user-driven fetch is what arms the tab; the house refresh()
       below deliberately skips until this has produced data. */
    if (typeof fetch === 'function'){
      onchainFetch(false).then(function(){
        try{ if (__lastEl === el) render(el); }catch(e){}
      }).catch(function(){});
    }
  }catch(e){
    try{ el.innerHTML = '<div class="panel"><div class="note warn">ON-CHAIN tab failed to render: ' + esc(e && e.message) + '</div></div>'; }catch(e2){}
  }
}

/* ============================ house refresh contract ============================ */
/* async refresh(): NEVER throws; terse status string; skips when the tab
   has no data (a global hard refresh must not trigger the first fetch);
   busy-guarded; force-refreshes past the 5-min cache; re-renders the tab
   if it is mounted. */
async function refresh(){
  try{
    if (__refreshing) return 'busy';
    if (!OC.loaded) return 'skipped: not run yet';
    await onchainFetch(true);
    if (__lastEl){ try{ render(__lastEl); }catch(e){} }
    /* onchainFetch records one honest note per failed leg; five notes =
       every leg failed and the old snapshot is still being shown. */
    if (OC.errors.length >= LEGS.length) return 'degraded: no leg succeeded';
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

/* ============================ exports + registration ============================ */
G.onchainParseMempool    = parseMempool;
G.onchainParseFees       = parseFees;
G.onchainParseDifficulty = parseDifficulty;
G.onchainParseHashrate   = parseHashrate;
G.onchainParseTipHeight  = parseTipHeight;
G.onchainCongestion      = congestionOf;
G.onchainBuildSnap       = buildSnap;
G.onchainSignal          = onchainSignal;
G.onchainFetch           = onchainFetch;
G.onchainState           = onchainState;
/* test hooks: seed/reset the cache synchronously (tests only) */
G.__onchainSeed = function(snap){
  OC.snap = snap || null;
  OC.loaded = true;
  OC.at = Date.now();
  OC.errors = (snap && Array.isArray(snap.notes)) ? snap.notes.slice() : [];
  return OC;
};
G.__onchainReset = function(){
  OC.loaded = false; OC.at = 0; OC.snap = null; OC.errors = [];
};

G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: 'onchain', label: 'ON-CHAIN', mount: mount, refresh: refresh });

})();
