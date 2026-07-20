/* =========================================================================
HARDGATE — goldspot.js
GOLD SPOT tab: spot-vs-perp basis monitor.

  SPOT   api.gold-api.com/price/XAU (free, no key, CORS-open). Direct fetch
         first; if that fails, the same-origin /api/proxy?url=<encoded>
         fallback (api.gold-api.com is allowlisted in api/proxy.js).
  PERP   XAUUSDT perp mark via the feature-checked binance.js helper
         binanceFunding(symbol) -> {fundingPct, markPrice, nextFundingTime}.
         Degrades to PAXGUSDT, then to an honest 'perp unavailable'.
  BASIS  basisPct = (perp/spot - 1) * 100. Verdict thresholds (documented in
         goldBasisSignal below): premium > +0.15% = leveraged longs crowding
         (fade risk for longs); discount < -0.15% = shorts crowding (squeeze
         fuel); inside = balanced. A perp's carry is realized through funding,
         so the funding rate (per interval, interval from binanceFundingInfo
         when reachable, else assumed 8h) is annualized as the carry proxy —
         that is the "annualized-ish" context; raw perp basis itself is
         instantaneous and NOT annualizable.

Classic script, loaded after binance.js / index.html's inline bundle. Never
throws at load or run time: every global is feature-checked, every fetch
carries an AbortController timeout, Promise.allSettled legs degrade
independently, results cached 5 minutes.

Exports (and ONLY these): window.goldBasisSignal (pure basis classifier),
window.goldFundingAnnualized (pure funding annualizer), plus the
window.HG_tabs registration below (house refresh contract: async, never
throws, skips before first run, busy-guarded, status string).

BRAIN STATE CONTRACT — after each SUCCESSFUL run (fresh fetch with a spot or
perp leg, or a live cache hit) the last window.goldBasisSignal result is
cached in a module-local snapshot and exposed as window.goldspotState() for
the BRAIN meta-engine. Zero-arg, NEVER throws (try-catch -> null), returns
null before the first successful run, otherwise a DEEP-FROZEN deep copy:
  { basisPct, verdict, evidence: [strings], at: <epochMs> }
(i.e. the goldBasisSignal result PLUS `at`). A failed re-run (spot and perp
both down) keeps the PREVIOUS good snapshot with its original `at` — good
data is never replaced by a failed run.
========================================================================= */
(function(){
'use strict';

var GOLD_API_URL = 'https://api.gold-api.com/price/XAU';
var CACHE_MS     = 5*60*1000;
var FETCH_TO     = 12000;
/* basis verdict thresholds (percent) — premium > +0.15% = longs crowding,
   discount < -0.15% = shorts crowding */
var BASIS_PREMIUM = 0.15, BASIS_DISCOUNT = -0.15;

/* ============================ tiny helpers ============================ */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fnum(n, dp){
  dp = (dp === undefined) ? 2 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (+n).toFixed(dp);
}
function signed(n, dp){
  dp = (dp === undefined) ? 1 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : ((+n >= 0 ? '+' : '') + (+n).toFixed(dp));
}
function kv(k, vHtml){
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
}
function setNote(ui, msg, warn){
  if (!ui || !ui.note) return;
  ui.note.textContent = msg;
  ui.note.className = warn ? 'note warn' : 'note';
}
/* feature-checked global lookup (binance helpers land on window/globalThis
   as classic-script top-level functions; absent when binance.js unloaded) */
function gfn(name){
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  try{ if (typeof window !== 'undefined' && window && typeof window[name] === 'function') return window[name]; }catch(e){}
  return null;
}

/* fetch JSON with timeout; null on any failure (never throws) */
async function fetchJson(url, timeoutMs){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs || FETCH_TO);
  try{
    var res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if (!res || !res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/* ============================ pure logic (exported) ============================ */

/* Funding annualizer, PURE. fundingPct is in PERCENT units per funding
   interval (binance.js convention). intervalHours: actual perp interval when
   known (binanceFundingInfo); anything missing/invalid -> assumed 8h and the
   result is flagged assumed=true so callers label it '(assumed 8h)'.
   -> {perIntervalPct, intervalHours, assumed, annualizedPct} | null. */
function goldFundingAnnualized(fundingPct, intervalHours){
  try{
    if (fundingPct === null || fundingPct === undefined || fundingPct === '') return null;
    var f = +fundingPct;
    if (!isFinite(f)) return null;
    var h = +intervalHours;
    var assumed = !(isFinite(h) && h > 0);
    if (assumed) h = 8;
    return {
      perIntervalPct: f,
      intervalHours: h,
      assumed: assumed,
      annualizedPct: f * (24 / h) * 365
    };
  }catch(e){ return null; }
}

/* Spot-vs-perp basis classifier, PURE.
   inp = { spot:number, perp:number, funding:number|{fundingPct,intervalHours}|null }
   basisPct = (perp - spot)/spot * 100 (null when spot/perp invalid).
   verdict: 'longs-crowding'  basis > +0.15%  (perp premium: leveraged longs
                                               crowding — fade risk for longs)
            'shorts-crowding' basis < -0.15%  (perp discount: shorts crowding
                                               — squeeze fuel)
            'balanced'        inside the band
            'unavailable'     basis cannot be computed
   evidence[]: terse human text; funding mapped via goldFundingAnnualized
   (perp carry is realized through funding, so annualized funding is shown as
   the carry proxy — the raw perp basis itself is instantaneous).
   Never throws. */
function goldBasisSignal(inp){
  try{
    inp = inp || {};
    var spot = +inp.spot, perp = +inp.perp;
    if (!isFinite(spot) || !(spot > 0) || !isFinite(perp) || !(perp > 0)){
      return { basisPct: null, verdict: 'unavailable',
               evidence: ['spot or perp price missing/invalid — basis cannot be computed'] };
    }
    var basisPct = Math.round(((perp - spot) / spot * 100) * 10000) / 10000;
    var verdict, evidence = [];
    if (basisPct > BASIS_PREMIUM){
      verdict = 'longs-crowding';
      evidence.push('perp premium ' + signed(basisPct, 3) + '% > +' + BASIS_PREMIUM
        + '% threshold — leveraged longs crowding; fade risk for fresh longs');
    } else if (basisPct < BASIS_DISCOUNT){
      verdict = 'shorts-crowding';
      evidence.push('perp discount ' + signed(basisPct, 3) + '% < ' + BASIS_DISCOUNT
        + '% threshold — shorts crowding; squeeze fuel for a bounce');
    } else {
      verdict = 'balanced';
      evidence.push('basis ' + signed(basisPct, 3) + '% inside ±' + BASIS_PREMIUM
        + '% band — no leveraged crowding edge');
    }
    var fRaw = inp.funding;
    var fPct = null, fHours = null;
    if (typeof fRaw === 'number') fPct = fRaw;
    else if (fRaw && typeof fRaw === 'object'){
      fPct = (fRaw.fundingPct === undefined ? null : fRaw.fundingPct);
      fHours = fRaw.intervalHours;
    }
    var ann = goldFundingAnnualized(fPct, fHours);
    if (ann){
      evidence.push('funding ' + signed(ann.perIntervalPct, 4) + '% / ' + ann.intervalHours + 'h'
        + (ann.assumed ? ' (assumed 8h)' : '')
        + ' ≈ ' + signed(ann.annualizedPct, 1) + '%/yr — '
        + (ann.perIntervalPct > 0 ? 'longs pay shorts (long carry costly)'
         : (ann.perIntervalPct < 0 ? 'shorts pay longs (short carry costly)' : 'flat carry')));
    } else {
      evidence.push('funding unavailable — carry context incomplete');
    }
    return { basisPct: basisPct, verdict: verdict, evidence: evidence };
  }catch(e){
    return { basisPct: null, verdict: 'unavailable',
             evidence: ['signal error: ' + ((e && e.message) ? e.message : String(e))] };
  }
}

/* ============================ data legs ============================ */
/* gold-api.com spot XAU: direct first (CORS-open), /api/proxy fallback.
   -> {price, updatedAt, via:'direct'|'proxy'} | null */
async function fetchSpotXau(){
  function parse(j){
    var p = j && +j.price;
    if (!isFinite(p) || !(p > 0)) return null;
    return { price: p, updatedAt: (j && j.updatedAt) || null };
  }
  var direct = parse(await fetchJson(GOLD_API_URL));
  if (direct){ direct.via = 'direct'; return direct; }
  var viaProxy = parse(await fetchJson('/api/proxy?url=' + encodeURIComponent(GOLD_API_URL)));
  if (viaProxy){ viaProxy.via = 'proxy'; return viaProxy; }
  return null;
}

/* XAUUSDT perp mark + funding via binance.js helpers; degrade PAXGUSDT.
   -> {symbol, mark, fundingPct|null, nextFundingTime|null, degraded} | null
   {unavailable:true, reason} when the binance layer is absent entirely. */
async function fetchPerpMark(){
  var bf = gfn('binanceFunding');
  if (!bf) return { unavailable: true, reason: 'binance helpers missing (binance.js not loaded)' };
  function norm(r, sym, degraded){
    var m = r && +r.markPrice;
    if (!isFinite(m) || !(m > 0)) return null;
    var f = +r.fundingPct;
    return {
      symbol: sym,
      mark: m,
      fundingPct: isFinite(f) ? f : null,
      nextFundingTime: isFinite(+r.nextFundingTime) ? +r.nextFundingTime : null,
      degraded: degraded === true
    };
  }
  try{ var a = norm(await bf('XAUUSDT'), 'XAUUSDT', false); if (a) return a; }catch(e){}
  try{ var b = norm(await bf('PAXGUSDT'), 'PAXGUSDT', true); if (b) return b; }catch(e){}
  return null; // perp unavailable
}

/* actual funding interval map (binanceFundingInfo); null when unreachable */
async function fetchFundingIntervals(){
  var fi = gfn('binanceFundingInfo');
  if (!fi) return null;
  try{ var m = await fi(); return (m && typeof m === 'object') ? m : null; }catch(e){ return null; }
}

/* ============================ renderers ============================ */
function renderBasisPanel(data, sig){
  var h = '<div class="panel"><h2>SPOT vs PERP <span>gold-api.com XAU spot vs Binance perp mark · basis monitor</span></h2>';
  var spot = data.spot, perp = data.perp;

  h += '<div class="row">'
     + '<span class="statuschip">spot src <b>' + (spot ? esc('GOLD-API ' + spot.via.toUpperCase()) : '—') + '</b></span>'
     + '<span class="statuschip">perp <b>' + (perp && perp.symbol ? esc(perp.symbol) + (perp.degraded ? ' (fallback)' : '') : '—') + '</b></span>'
     + '</div><div style="margin-top:8px">';

  h += kv('SPOT XAU (gold-api.com)', spot ? ('<b>' + fnum(spot.price, 2) + '</b>') : 'unavailable');
  if (spot && spot.updatedAt) h += kv('spot updated', esc(String(spot.updatedAt).replace('T', ' ').slice(0, 19)) + ' UTC');

  if (!perp){
    h += kv('PERP mark', '<span class="neg">perp unavailable</span>');
    var reason = (data.perpInfo && data.perpInfo.reason) || 'XAUUSDT and PAXGUSDT marks both unreachable';
    h += '</div><div class="note warn" style="margin-top:6px">perp unavailable — ' + esc(reason)
       + '. Basis cannot be computed; spot leg shown alone.</div></div>';
    return h;
  }
  h += kv('PERP mark (' + perp.symbol + ')', '<b>' + fnum(perp.mark, 2) + '</b>');
  h += kv('perp funding', perp.fundingPct === null ? 'unavailable' : signed(perp.fundingPct, 4) + '% / interval');
  if (perp.nextFundingTime){
    try{ h += kv('next funding', esc(new Date(perp.nextFundingTime).toISOString().slice(11, 19)) + ' UTC'); }catch(e){}
  }
  h += '</div>';

  if (!spot){
    h += '<div class="note warn" style="margin-top:6px">spot unavailable (gold-api.com direct AND /api/proxy both failed) — perp mark shown alone, basis cannot be computed.</div></div>';
    return h;
  }

  /* both legs present: basis + verdict */
  var bCls = sig.basisPct === null ? '' : (sig.basisPct > BASIS_PREMIUM ? 'neg' : (sig.basisPct < BASIS_DISCOUNT ? 'pos' : ''));
  h += '<div class="row" style="margin-top:10px"><span class="big ' + bCls + '">' + signed(sig.basisPct, 3) + '%</span>'
     + '<span class="statuschip">basis <b>' + esc(sig.verdict.toUpperCase().replace('-', ' ')) + '</b></span></div>';
  var vCls = sig.verdict === 'longs-crowding' ? 'short' : (sig.verdict === 'shorts-crowding' ? 'long' : 'aside');
  var vWord = sig.verdict === 'longs-crowding' ? 'PERP PREMIUM — LONGS CROWDING'
            : (sig.verdict === 'shorts-crowding' ? 'PERP DISCOUNT — SHORTS CROWDING' : 'BALANCED BASIS');
  h += '<div class="verdict ' + vCls + '"><span class="vword" style="font-size:15px">' + esc(vWord) + '</span>'
     + '<span class="vwhy">' + esc(sig.evidence.join(' ')) + '</span></div>';
  h += '<div class="note" style="margin-top:8px">premium &gt; +' + BASIS_PREMIUM + '% = leveraged longs crowding (fade risk for longs) · '
     + 'discount &lt; ' + BASIS_DISCOUNT + '% = shorts crowding (squeeze fuel) · a perp has no expiry, so carry is realized '
     + 'through funding — the annualized funding above is the carry proxy, not the instantaneous basis.</div>';
  return h + '</div>';
}

/* ============================ scan orchestrator ============================ */
var __gs = { cache: null, busy: false, ranOnce: false, ui: null, stateSnap: null };

/* BRAIN state snapshot (window.goldspotState): the last goldBasisSignal
   result + `at`, cached only on SUCCESSFUL runs — a failed re-run keeps the
   previous good snapshot with its original `at`. The getter hands out
   DEEP-FROZEN deep copies and never throws. */
function setGsSnapshot(sig){
  try{
    if (!sig || typeof sig !== 'object') return;
    __gs.stateSnap = {
      basisPct: (typeof sig.basisPct === 'number' && isFinite(sig.basisPct)) ? sig.basisPct : null,
      verdict: sig.verdict,
      evidence: Array.isArray(sig.evidence) ? sig.evidence.slice() : [],
      at: Date.now()
    };
  }catch(e){ /* snapshotting must never break the scan */ }
}
function gsStateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = gsStateView(v[k]);
  }
  Object.freeze(out);
  return out;
}

async function runGoldSpot(ui, opts){
  if (__gs.busy) return 'busy';
  __gs.busy = true;
  var status = 'refreshed';
  try{
    opts = opts || {};
    ui = ui || __gs.ui;
    var force = opts.force === true;
    var data = null;
    if (!force && __gs.cache && (Date.now() - __gs.cache.at) < CACHE_MS){
      data = __gs.cache.val;
    } else {
      setNote(ui, 'fetching gold-api.com spot + Binance perp mark/funding…');
      var legs = await Promise.allSettled([fetchSpotXau(), fetchPerpMark(), fetchFundingIntervals()]);
      var spot = (legs[0].status === 'fulfilled') ? legs[0].value : null;
      var perpLeg = (legs[1].status === 'fulfilled') ? legs[1].value : null;
      var finfo = (legs[2].status === 'fulfilled') ? legs[2].value : null;
      var perp = (perpLeg && perpLeg.unavailable) ? null : perpLeg;
      data = { spot: spot, perp: perp, perpInfo: perpLeg, finfo: finfo, at: Date.now() };
      if (spot || perp) __gs.cache = { at: Date.now(), val: data };
      else status = 'failed: spot and perp both unavailable';
    }
    __gs.ranOnce = true;

    if (ui && ui.out){
      if (!data.spot && !data.perp){
        var why = (data.perpInfo && data.perpInfo.reason) ? (' Perp: ' + data.perpInfo.reason + '.') : '';
        ui.out.innerHTML = '<div class="empty">No gold basis data available — gold-api.com spot (direct and via /api/proxy) '
          + 'and the Binance perp mark both failed.' + esc(why) + ' Check network, then re-run.</div>';
        setNote(ui, 'all sources unavailable — showing empty state.', true);
      } else {
        /* funding interval for the live perp symbol (else assumed 8h) */
        var funding = null;
        if (data.perp && data.perp.fundingPct !== null){
          var hrs = null;
          try{
            if (data.finfo && data.finfo[data.perp.symbol] && isFinite(+data.finfo[data.perp.symbol].intervalHours))
              hrs = +data.finfo[data.perp.symbol].intervalHours;
          }catch(e){}
          funding = { fundingPct: data.perp.fundingPct, intervalHours: hrs };
        }
        var sig = goldBasisSignal({
          spot: data.spot ? data.spot.price : null,
          perp: data.perp ? data.perp.mark : null,
          funding: funding
        });
        if (status === 'refreshed') setGsSnapshot(sig); /* BRAIN: only a successful run overwrites the snapshot */
        var degraded = [];
        if (!data.spot) degraded.push('spot');
        if (!data.perp) degraded.push('perp');
        if (data.perp && data.perp.degraded) degraded.push('XAUUSDT (using PAXGUSDT)');
        if (data.perp && data.perp.fundingPct !== null && (!data.finfo || !data.finfo[data.perp.symbol]))
          degraded.push('funding interval (assumed 8h)');
        ui.out.innerHTML = renderBasisPanel(data, sig);
        setNote(ui, 'done · ' + new Date().toISOString().slice(11, 19) + ' UTC'
          + (degraded.length ? ' — degraded: ' + degraded.join(', ') : ''), degraded.length > 0);
      }
    }
  }catch(e){
    status = 'error: ' + ((e && e.message) ? e.message : String(e));
    try{ setNote(ui, 'unexpected error: ' + ((e && e.message) ? e.message : String(e)), true); }catch(_){}
  }finally{
    __gs.busy = false;
  }
  return status;
}

/* ============================ tab registration ============================ */
function mount(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>GOLD SPOT <span>spot vs perp basis · funding carry</span></h2>'
    + '<div class="row">'
    + '<button class="btn" data-gs="run">RUN GOLD SPOT</button>'
    + '<span class="chip on" data-gs="srcchip">SRC: GOLD-API + BINANCE</span>'
    + '</div>'
    + '<div class="note" data-gs="note">idle — pulls gold-api.com XAU spot (direct, /api/proxy fallback) and the XAUUSDT perp '
    + 'mark/funding (PAXGUSDT fallback). Free APIs, no key; results cached 5 min.</div>'
    + '<div data-gs="out"></div>'
    + '</div>';

  var ui = {
    btn:  el.querySelector('[data-gs="run"]'),
    note: el.querySelector('[data-gs="note"]'),
    out:  el.querySelector('[data-gs="out"]')
  };
  __gs.ui = ui;
  var missing = [];
  if (typeof fetch !== 'function') missing.push('fetch');
  if (!gfn('binanceFunding')) missing.push('binanceFunding(binance.js) — perp leg will report unavailable');
  if (missing.length) setNote(ui, 'degraded environment: ' + missing.join(' · ') + '.', true);
  if (ui.btn) ui.btn.addEventListener('click', function(){ return runGoldSpot(ui); });
}

/* House refresh contract: async, NEVER throws, terse status string, busy
   guard, and no first-time scan from a global refresh — skip instead. */
async function refreshGoldSpot(){
  try{
    if (__gs.busy) return 'busy';
    if (!__gs.ranOnce) return 'skipped: not run yet';
    return await runGoldSpot(__gs.ui, { force: true }); // hard refresh bypasses the 5-min cache
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

if (typeof window !== 'undefined'){
  window.goldBasisSignal = goldBasisSignal;
  window.goldFundingAnnualized = goldFundingAnnualized;
  window.goldspotState = function(){
    try{ return __gs.stateSnap ? gsStateView(__gs.stateSnap) : null; }catch(e){ return null; }
  };
  window.HG_tabs = window.HG_tabs || [];
  window.HG_tabs.push({ id: 'goldspot', label: 'GOLD SPOT', mount: mount, refresh: refreshGoldSpot });
}
})();
