/* HARDGATE — goldpine.js
   GOLD PINE tab: combined ported Pine math + gold session/SMC confluence.
   SWING setups on 4H (+ 1D HTF) · SCALP setups on 15m (+ 1H/4H HTF). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_15M = 240, KL_1H = 200, KL_4H = 220, KL_1D = 260;
var SWING_MIN = 10, SCALP_MIN = 8;
var PINE_GOLD_MAX = 24;

function esc(s){
  return String(s || '').replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}
function fin(v){ return typeof v === 'number' && isFinite(v); }
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
}
function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!fin(+n)) return '—';
  return String(+n);
}
function fmtF(n, d){
  if (typeof W.fmt === 'function') return W.fmt(n, d);
  if (!fin(+n)) return '—';
  return (+n).toFixed(d === undefined ? 2 : d);
}

var SRC_LABEL = { 'binance-xau': 'BINANCE XAUUSDT', 'binance-paxg': 'BINANCE PAXGUSDT',
  'twelvedata': 'TWELVE DATA', 'yahoo': 'YAHOO GC=F' };

async function fetchGoldBars(){
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], source: null };
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length){ out.rows15m = a.rows; out.source = a.source; } }catch(e){}
    try{ var b = await ggc('1h', KL_1H);  if (b && b.rows && b.rows.length){ out.rows1h = b.rows; if (!out.source) out.source = b.source; } }catch(e2){}
    try{ var c = await ggc('4h', KL_4H);  if (c && c.rows && c.rows.length){ out.rows4h = c.rows; if (!out.source) out.source = c.source; } }catch(e3){}
    try{ var d = await ggc('1d', KL_1D);  if (d && d.rows && d.rows.length){ out.rows1d = d.rows; if (!out.source) out.source = d.source; } }catch(e4){}
  }
  if (!out.rows15m.length){
    var bk = gfn('binanceKlines');
    if (bk){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ out.rows15m = p; out.source = 'binance-paxg'; } }catch(e5){}
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) out.rows1h = q; }catch(e6){}
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) out.rows4h = z; }catch(e7){}
      try{ var y = await bk('PAXGUSDT', '1d', KL_1D);  if (y && y.length) out.rows1d = y; }catch(e8){}
    }
  }
  return out;
}

function setupFromEval(evalRes, mode, source){
  if (!evalRes || !evalRes.display) return null;
  return {
    mode: mode,
    dir: evalRes.dir,
    sym: 'XAUUSD',
    source: source,
    grade: evalRes.grade,
    score: evalRes.score,
    maxScore: evalRes.maxScore,
    factors: evalRes.factors,
    price: evalRes.price,
    entry: evalRes.entry,
    stop: evalRes.stop,
    t1: evalRes.t1,
    t2: evalRes.t2,
    rr: evalRes.rr,
    planSrc: evalRes.planSrc,
    isNew: evalRes.isNew,
    isRecent: evalRes.isRecent,
    isContext: evalRes.isContext,
    tier: evalRes.tier || 'primary',
    atr: evalRes.atr,
    familyCount: evalRes.familyCount
  };
}

function setupFromNative(c, mode, source){
  if (!c || !c.dir) return null;
  var tally = fin(+c.tally) ? +c.tally : (fin(+c.agree) ? +c.agree : 0);
  var note = c.strategy || c.stratKey || 'native gold detector';
  if (c.why) note += ' — ' + String(c.why).slice(0, 80);
  return {
    mode: mode,
    dir: c.dir,
    sym: c.sym || 'XAUUSD',
    source: source,
    grade: c.grade || '—',
    score: tally,
    maxScore: PINE_GOLD_MAX,
    factors: [{ cat: 'Native', ok: true, pts: tally, note: note }],
    price: fin(+c.entry) ? +c.entry : null,
    entry: c.entry,
    stop: c.stop,
    t1: c.t1,
    t2: c.t2,
    rr: c.rr,
    planSrc: c.strategy || 'GOLD native',
    isNew: false,
    isRecent: false,
    isContext: false,
    tier: 'native',
    atr: fin(+c.atr) ? +c.atr : null,
    familyCount: fin(+c.agree) ? +c.agree : null,
    nativeStrategy: c.strategy || c.stratKey || null
  };
}

function tierRank(t){
  if (t === 'primary') return 0;
  if (t === 'native') return 1;
  if (t === 'aligned') return 2;
  return 3;
}

function dedupeSetups(list){
  var out = [];
  var keys = {};
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    if (!s || !s.dir) continue;
    var k = s.mode + ':' + s.dir;
    var prev = keys[k];
    if (prev){
      var atr = fin(+s.atr) ? +s.atr : (fin(+s.price) ? s.price * 0.008 : 2);
      var gap = Math.abs(+s.entry - +prev.entry);
      if (fin(gap) && gap <= 0.35 * atr){
        if (tierRank(s.tier) < tierRank(prev.tier) || (s.tier === prev.tier && +s.score > +prev.score)){
          keys[k] = s;
          for (var j = 0; j < out.length; j++){
            if (out[j] === prev){ out[j] = s; break; }
          }
        }
        continue;
      }
    }
    keys[k] = s;
    out.push(s);
  }
  return out;
}

function sortSetups(list){
  list.sort(function(a, b){
    var tr = tierRank(a.tier) - tierRank(b.tier);
    if (tr) return tr;
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
    return (b.score - a.score) || 0;
  });
  return list;
}

function collectNativeScalp(bars, ctx, source){
  var out = [];
  var fn = gfn('goldScalpSetups');
  var rankFn = gfn('goldRankSetups');
  if (!fn || !bars.rows15m || bars.rows15m.length < 40) return out;
  var got = null;
  try{
    got = fn({ rows15m: bars.rows15m, rows1h: bars.rows1h, rows4h: bars.rows4h,
      now: ctx.now || Date.now(), news: ctx.news || null });
  }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  var ranked = got;
  if (rankFn){
    try{
      var rk = rankFn(got, ctx);
      ranked = rk && rk.ranked ? rk.ranked : got;
    }catch(e2){}
  }
  for (var i = 0; i < ranked.length && out.length < 4; i++){
    var s = setupFromNative(ranked[i], 'scalp', source);
    if (s) out.push(s);
  }
  return out;
}

function collectNativeSwing(bars, ctx, source){
  var out = [];
  var fn = gfn('goldswingCollectCandidates');
  if (!fn || !bars.rows4h || bars.rows4h.length < 60) return out;
  var leg = { rows4h: bars.rows4h, rows1d: bars.rows1d, rows1h: bars.rows1h };
  var got = null;
  try{ got = fn(leg, ctx); }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  for (var i = 0; i < got.length && out.length < 4; i++){
    var s = setupFromNative(got[i], 'swing', source);
    if (s) out.push(s);
  }
  return out;
}

function runGoldPineScan(bars, ctx){
  ctx = ctx || {};
  var confFn = gfn('pineGoldConfluence');
  var lvFn = gfn('pineGoldLevelsFromBars');
  if (typeof confFn !== 'function') return { swing: [], scalp: [], error: 'pinegoldmath' };

  var levels = lvFn ? lvFn(bars.rows1d, bars.rows15m) : {};
  var source = SRC_LABEL[bars.source] || bars.source || 'GOLD';
  var macro = ctx.macro || null;
  var spot = ctx.spot || null;
  try{
    if (!spot){
      var gs = gfn('goldspotState');
      if (gs) spot = gs();
    }
  }catch(e){}

  var swing = [];
  var scalp = [];
  var scanOpts = { macro: macro, spot: spot, levels: levels };

  if (bars.rows4h && bars.rows4h.length >= 60){
    var sw = confFn(bars.rows4h, Object.assign({ mode: 'swing', htfRows: bars.rows1d }, scanOpts));
    if (sw.long && sw.long.display) swing.push(setupFromEval(sw.long, 'swing', source));
    if (sw.short && sw.short.display) swing.push(setupFromEval(sw.short, 'swing', source));
  }

  if (bars.rows15m && bars.rows15m.length >= 40){
    var sc = confFn(bars.rows15m, Object.assign({ mode: 'scalp', htfRows: bars.rows1h || bars.rows4h }, scanOpts));
    if (sc.long && sc.long.display) scalp.push(setupFromEval(sc.long, 'scalp', source));
    if (sc.short && sc.short.display) scalp.push(setupFromEval(sc.short, 'scalp', source));
  }

  var scanCtx = { macro: macro, spot: spot, now: Date.now(), news: null };
  try{
    var ns = gfn('hgNewsState');
    if (ns) scanCtx.news = ns();
  }catch(eN){}
  swing = swing.concat(collectNativeSwing(bars, scanCtx, source));
  scalp = scalp.concat(collectNativeScalp(bars, scanCtx, source));

  swing = sortSetups(dedupeSetups(swing.filter(Boolean)));
  scalp = sortSetups(dedupeSetups(scalp.filter(Boolean)));

  return { swing: swing.filter(Boolean), scalp: scalp.filter(Boolean), levels: levels, source: source, at: Date.now() };
}

function factorsHTML(factors){
  if (!factors || !factors.length) return '';
  var byCat = {};
  factors.forEach(function(f){
    if (!f.ok) return;
    byCat[f.cat] = byCat[f.cat] || [];
    byCat[f.cat].push(f.note);
  });
  var parts = [];
  Object.keys(byCat).forEach(function(cat){
    parts.push('<b>' + esc(cat) + '</b>: ' + esc(byCat[cat].join(' · ')));
  });
  return parts.join('<br>');
}

function cardHTML(s){
  var cls = s.dir === 'long' ? 'long' : 'short';
  var badge = s.isNew ? '<span class="stamp pass" style="margin-left:6px">NEW</span>'
    : (s.isRecent ? '<span class="stamp" style="margin-left:6px">RECENT</span>'
      : (s.tier === 'native' ? '<span class="stamp pass" style="margin-left:6px">NATIVE</span>'
        : (s.isContext || s.tier === 'aligned' ? '<span class="stamp" style="margin-left:6px">ALIGNED</span>' : '')));
  var tierNote = s.tier === 'primary' ? ' · PRIMARY' : (s.tier === 'native' ? ' · NATIVE' : (s.tier === 'aligned' ? ' · WATCH' : ''));
  var modeLabel = s.mode === 'swing' ? 'SWING · 4H' : 'SCALP · 15m';
  if (s.nativeStrategy) modeLabel += ' · ' + esc(s.nativeStrategy);
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>XAUUSD <span>' + esc(s.dir.toUpperCase()) + ' · ' + modeLabel + ' · Grade ' + esc(s.grade)
    + badge + '</span></h2>'
    + '<div class="note">Confluence <b>' + s.score + '/' + s.maxScore + '</b>'
    + tierNote
    + ' · families <b>' + (s.familyCount != null ? s.familyCount : '—') + '</b>'
    + ' · mark ' + pxF(s.price) + ' · ' + esc(s.source)
    + (fin(+s.rr) ? (' · R:R ' + fmtF(s.rr, 2)) : '')
    + '</div>'
    + '<div class="note" style="margin-top:6px;font-size:11px">' + factorsHTML(s.factors) + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(s.dir, s.entry, s.stop, s.t1, s.t2, s.planSrc || 'Gold Pine')
      : ('ENTRY ' + pxF(s.entry) + ' · SL ' + pxF(s.stop) + ' · T1 ' + pxF(s.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'XAUUSD\',\'' + s.dir + '\',' + s.entry + ',' + s.stop + ',' + s.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn('XAUUSD', s.dir, s.entry, s.stop, s.t1, { scanner: 'goldpine', strategy: s.mode, t2: s.t2 })
      : '')
    + '</div>';
}

function sectionHTML(title, setups, emptyMsg){
  if (!setups.length){
    return '<div class="panel"><h2>' + esc(title) + '</h2>'
      + '<div class="empty">' + esc(emptyMsg) + '</div></div>';
  }
  return '<div class="panel"><h2>' + esc(title) + ' <span>' + setups.length + ' setup(s)</span></h2></div>'
    + setups.map(cardHTML).join('');
}

var __goldPineSnap = null;
var __goldPineTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>GOLD PINE <span>Pine + goldind SMC · primary + aligned + native</span></h2>'
    + '<div class="note">10 ported Pine layers cross-scored with native gold detectors: BOS/CHoCH, premium/discount, OB retest, '
    + 'Sweep V2, FVG+HVN, session VWAP, Asian range, RSI div, macro real-rate, PAXG basis, OU exhaustion, chop veto. '
    + '<b>PRIMARY</b> = strict gate (≥' + SWING_MIN + ' swing / ≥' + SCALP_MIN + ' scalp, ≥2 families, R:R ≥1.2). '
    + '<b>ALIGNED</b> = relaxed watch tier (≥6 swing / ≥5 scalp). '
    + '<b>NATIVE</b> = top ranked GOLD SWING / GOLD SCALP detector candidates merged here.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="goldPineRun">RUN GOLD PINE SCAN</button>'
    + '<span class="note" id="goldPineStat">Fetches XAU/PAXG candles then scores swing + scalp.</span>'
    + '</div>'
    + '<div class="prog" id="goldPineProg"><i></i></div>'
    + '<div id="goldPineLevels" style="margin-top:8px"></div>'
    + '<div id="goldPineOut" style="margin-top:12px"><div class="empty">Press RUN GOLD PINE SCAN.</div></div>'
    + '</div>';

  var btn = el.querySelector('#goldPineRun');
  var stat = el.querySelector('#goldPineStat');
  var prog = el.querySelector('#goldPineProg');
  var out = el.querySelector('#goldPineOut');
  var lvEl = el.querySelector('#goldPineLevels');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(){
    if (__goldPineTab.busy) return 'busy';
    __goldPineTab.busy = true;
    __goldPineTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.05);
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Fetching gold candles + macro…';
      var bars = await fetchGoldBars();
      var macro = null;
      try{
        var mg = gfn('getGoldMacro');
        if (mg) macro = await mg();
      }catch(eM){}
      setProg(0.35);
      if (!bars.rows4h.length && !bars.rows15m.length){
        if (out) out.innerHTML = '<div class="empty">No gold candle data — check network / macro.js feeds.</div>';
        if (stat) stat.textContent = 'failed · no data';
        return 'failed';
      }
      if (stat) stat.textContent = 'Scoring Pine + gold confluence…';
      var result = runGoldPineScan(bars, { macro: macro });
      setProg(0.9);
      __goldPineSnap = result;

      if (lvEl && result.levels){
        var lv = result.levels;
        lvEl.innerHTML = '<div class="note">Levels · PDH <b>' + pxF(lv.pdh) + '</b> · PDL <b>' + pxF(lv.pdl)
          + '</b> · Asia <b>' + pxF(lv.asiaLo) + '–' + pxF(lv.asiaHi) + '</b> · feed <b>' + esc(result.source) + '</b></div>';
      }

      var html = sectionHTML('GOLD PINE — SWING SETUPS (4H)', result.swing,
          'No swing setup — primary needs ≥2 families, score ≥' + SWING_MIN + '; aligned watch ≥6; native swing detectors also scanned.')
        + sectionHTML('GOLD PINE — SCALP SETUPS (15m)', result.scalp,
          'No scalp setup — primary needs killzone/sweep or score ≥' + (SCALP_MIN + 2) + ' off-session; aligned watch ≥5; native scalp detectors also scanned.');

      if (out) out.innerHTML = html;
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (stat) stat.textContent = 'done · ' + result.swing.length + ' swing · ' + result.scalp.length
        + ' scalp · ' + dt + 's';
      setProg(null);
      return 'refreshed';
    }catch(e){
      if (stat) stat.textContent = 'error: ' + ((e && e.message) || e);
      if (out) out.innerHTML = '<div class="empty">Scan failed: ' + esc(String(e && e.message || e)) + '</div>';
      return 'error';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __goldPineTab.busy = false;
    }
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __goldPineTab.run = runScan;
}

async function goldPineRefresh(){
  try{
    if (__goldPineTab.busy) return 'busy';
    if (!__goldPineTab.hasRun || typeof __goldPineTab.run !== 'function') return 'skipped: not run yet';
    return await __goldPineTab.run();
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.runGoldPineScan = runGoldPineScan;
W.goldPineScan = function(){
  try{ return __goldPineSnap; }catch(e){ return null; }
};
W.goldPineState = function(){
  try{
    if (!__goldPineSnap) return null;
    var rows = [];
    (__goldPineSnap.swing || []).forEach(function(s){
      rows.push({ sym: 'XAUUSD', dir: s.dir, mode: 'swing', grade: s.grade, score: s.score });
    });
    (__goldPineSnap.scalp || []).forEach(function(s){
      rows.push({ sym: 'XAUUSD', dir: s.dir, mode: 'scalp', grade: s.grade, score: s.score });
    });
    return { results: rows, at: __goldPineSnap.at };
  }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldpine', label: 'GOLD PINE', mount: mount, refresh: goldPineRefresh });

})();
