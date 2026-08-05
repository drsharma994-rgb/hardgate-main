/* HARDGATE — goldpine.js
   GOLD PINE tab: combined ported Pine math + gold session/SMC confluence.
   SWING setups on 4H (+ 1D HTF) · SCALP setups on 15m (+ 1H/4H HTF). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_15M = 280, KL_1H = 220, KL_4H = 280, KL_1D = 280;
var SWING_MIN = 10, SCALP_MIN = 8;
var PINE_GOLD_MAX = 24;
var TOP_SETUPS = 2;

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
    try{
      var legs = await Promise.all([
        ggc('15m', KL_15M).catch(function(){ return null; }),
        ggc('1h', KL_1H).catch(function(){ return null; }),
        ggc('4h', KL_4H).catch(function(){ return null; }),
        ggc('1d', KL_1D).catch(function(){ return null; })
      ]);
      if (legs[0] && legs[0].rows && legs[0].rows.length){ out.rows15m = legs[0].rows; out.source = legs[0].source; }
      if (legs[1] && legs[1].rows && legs[1].rows.length){ out.rows1h = legs[1].rows; if (!out.source) out.source = legs[1].source; }
      if (legs[2] && legs[2].rows && legs[2].rows.length){ out.rows4h = legs[2].rows; if (!out.source) out.source = legs[2].source; }
      if (legs[3] && legs[3].rows && legs[3].rows.length){ out.rows1d = legs[3].rows; if (!out.source) out.source = legs[3].source; }
    }catch(e){}
  }
  var bk = gfn('binanceKlines');
  if (bk){
    if (!out.rows15m.length){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ out.rows15m = p; out.source = out.source || 'binance-paxg'; } }catch(e5){}
    }
    if (!out.rows1h.length){
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) out.rows1h = q; }catch(e6){}
    }
    if (!out.rows4h.length){
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length){ out.rows4h = z; out.source = out.source || 'binance-paxg'; } }catch(e7){}
    }
    if (!out.rows1d.length){
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
    familyCount: evalRes.familyCount,
    layerLabel: evalRes.layerLabel || null,
    kind: evalRes.kind || 'confluence'
  };
}

function setupFromUniverseItem(item, mode, source){
  if (!item || !item.display || !item.dir) return null;
  return setupFromEval(item, mode, source);
}

function setupFromNative(c, mode, source, forming){
  if (!c || !c.dir) return null;
  var tally = fin(+c.tally) ? +c.tally : (fin(+c.agree) ? +c.agree : 0);
  var note = c.strategy || c.stratKey || 'native gold detector';
  if (forming && c.reason) note = (c.strategy || c.stratKey || 'native') + ' — ' + c.reason;
  else if (c.why) note += ' — ' + String(c.why).slice(0, 80);
  return {
    mode: mode,
    dir: c.dir,
    sym: c.sym || 'XAUUSD',
    source: source,
    grade: c.grade || '—',
    score: tally,
    maxScore: PINE_GOLD_MAX,
    factors: [{ cat: forming ? 'Forming' : 'Native', ok: true, pts: tally, note: note }],
    price: fin(+c.entry) ? +c.entry : null,
    entry: c.entry,
    stop: c.stop,
    t1: c.t1,
    t2: c.t2,
    rr: c.rr,
    planSrc: c.strategy || 'GOLD native',
    isNew: false,
    isRecent: false,
    isContext: !!forming,
    tier: forming ? 'forming' : 'native',
    atr: fin(+c.atr) ? +c.atr : null,
    familyCount: fin(+c.agree) ? +c.agree : null,
    nativeStrategy: c.strategy || c.stratKey || null,
    kind: 'native'
  };
}

function tierRank(t){
  if (t === 'primary') return 0;
  if (t === 'native') return 1;
  if (t === 'aligned') return 2;
  if (t === 'forming') return 3;
  return 4;
}

function setupKey(s){
  return (s.kind || 'x') + ':' + (s.layerLabel || s.nativeStrategy || 'conf') + ':' + s.mode + ':' + s.dir;
}

function dedupeSetups(list){
  var out = [];
  var keys = {};
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    if (!s || !s.dir) continue;
    var k = setupKey(s);
    var prev = keys[k];
    if (prev){
      if (tierRank(s.tier) < tierRank(prev.tier) || (s.tier === prev.tier && +s.score > +prev.score)){
        keys[k] = s;
        for (var j = 0; j < out.length; j++){
          if (out[j] === prev){ out[j] = s; break; }
        }
      }
      continue;
    }
    keys[k] = s;
    out.push(s);
  }
  return out;
}

function sortSetups(list){
  list.sort(function(a, b){
    var pr = probScore(b) - probScore(a);
    if (pr) return pr;
    var tr = tierRank(a.tier) - tierRank(b.tier);
    if (tr) return tr;
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
    return (b.score - a.score) || 0;
  });
  return list;
}

function gradeRank(g){
  if (g === 'A+') return 5;
  if (g === 'A') return 4;
  if (g === 'B') return 3;
  if (g === 'C') return 2;
  return 0;
}

function probScore(s){
  if (!s) return -1;
  var base = fin(+s.score) && fin(+s.maxScore) && s.maxScore > 0
    ? (+s.score / s.maxScore) * 100
    : (+s.score || 0);
  var form = 0;
  if (s.isNew) form += 30;
  else if (s.isRecent) form += 22;
  else if (s.tier === 'forming') form += 18;
  else if (s.tier === 'primary') form += 12;
  else if (s.tier === 'native') form += 8;
  var rr = fin(+s.rr) ? Math.min(+s.rr, 4) * 2 : 0;
  var fam = fin(+s.familyCount) ? +s.familyCount * 1.5 : 0;
  return base + form + gradeRank(s.grade) * 3 + rr + fam;
}

function topProbSetups(list, limit){
  limit = (limit > 0) ? limit : TOP_SETUPS;
  if (!list || !list.length) return [];
  return sortSetups(list.slice()).slice(0, limit);
}

function collectNativeScalp(bars, ctx, source){
  var out = [];
  var cached = null;
  try{ var sc = gfn('goldscalpScan'); if (sc) cached = sc(); }catch(e0){}
  if (cached && Array.isArray(cached.cands) && cached.cands.length){
    for (var ci = 0; ci < cached.cands.length && out.length < 6; ci++){
      var s0 = setupFromNative(cached.cands[ci], 'scalp', source, false);
      if (s0) out.push(s0);
    }
    if (out.length) return out;
  }
  var fn = gfn('goldScalpSetups');
  var rankFn = gfn('goldRankSetups');
  if (!fn || !bars.rows15m || bars.rows15m.length < 30) return out;
  var got = null;
  try{
    got = fn({ rows15m: bars.rows15m, rows1h: bars.rows1h, rows4h: bars.rows4h,
      now: ctx.now || Date.now(), news: ctx.news || null });
  }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  var ranked = got;
  var rejected = got.rejected || [];
  if (rankFn){
    try{
      var rk = rankFn(got, ctx);
      ranked = rk && rk.ranked ? rk.ranked : got;
      if (rk && rk.rejected) rejected = rejected.concat(rk.rejected);
    }catch(e2){}
  }
  for (var i = 0; i < ranked.length && out.length < 6; i++){
    var s = setupFromNative(ranked[i], 'scalp', source, false);
    if (s) out.push(s);
  }
  for (var r = 0; r < rejected.length && out.length < 8; r++){
    var rf = setupFromNative(rejected[r], 'scalp', source, true);
    if (rf && fin(+rf.entry) && fin(+rf.stop)) out.push(rf);
  }
  return out;
}

function collectNativeSwing(bars, ctx, source){
  var out = [];
  var cached = null;
  try{ var sw = gfn('goldswingScan'); if (sw) cached = sw(); }catch(e0){}
  if (cached && Array.isArray(cached.cands) && cached.cands.length){
    for (var ci = 0; ci < cached.cands.length && out.length < 6; ci++){
      var s0 = setupFromNative(cached.cands[ci], 'swing', source, false);
      if (s0) out.push(s0);
    }
    if (out.length) return out;
  }
  var fn = gfn('goldswingCollectCandidates');
  if (!fn || !bars.rows4h || bars.rows4h.length < 60) return out;
  var leg = { rows4h: bars.rows4h, rows1d: bars.rows1d, rows1h: bars.rows1h };
  var got = null;
  try{ got = fn(leg, ctx); }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  for (var i = 0; i < got.length && out.length < 6; i++){
    var s = setupFromNative(got[i], 'swing', source, false);
    if (s) out.push(s);
  }
  return out;
}

function collectPineUniverse(bars, mode, scanOpts, source){
  var uniFn = gfn('pineGoldUniverse');
  if (typeof uniFn !== 'function') return [];
  var rows = mode === 'swing' ? bars.rows4h : bars.rows15m;
  var htf = mode === 'swing' ? bars.rows1d : (bars.rows1h || bars.rows4h);
  var min = mode === 'swing' ? 60 : 30;
  if (!rows || rows.length < min) return [];
  var u = uniFn(rows, Object.assign({ mode: mode, htfRows: htf }, scanOpts));
  var list = [];
  (u.setups || []).forEach(function(item){
    var s = setupFromUniverseItem(item, mode, source);
    if (s) list.push(s);
  });
  return list;
}

function runGoldPineScan(bars, ctx){
  ctx = ctx || {};
  var lvFn = gfn('pineGoldLevelsFromBars');
  if (typeof gfn('pineGoldUniverse') !== 'function' && typeof gfn('pineGoldConfluence') !== 'function'){
    return { swing: [], scalp: [], error: 'pinegoldmath' };
  }

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

  swing = swing.concat(collectPineUniverse(bars, 'swing', scanOpts, source));
  scalp = scalp.concat(collectPineUniverse(bars, 'scalp', scanOpts, source));

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

function cardHTML(s, rank){
  var tier = (s.tier === 'forming' || s.isRecent) ? 'forming'
    : ((s.tier === 'aligned' || s.isContext) ? 'near' : 'clean');
  if (typeof W.hgSetupPanelHTML === 'function' && (s.tier === 'forming' || s.isRecent || s.isContext)){
    var sig = {
      sym: 'XAUUSD', dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2,
      price: s.price, planSrc: s.planSrc || 'Gold Pine', isNew: s.isNew, isRecent: s.isRecent,
      isContext: s.isContext, tier: s.tier, scriptLabel: (s.mode === 'swing' ? 'GOLD PINE SWING' : 'GOLD PINE SCALP')
    };
    var html = W.hgSetupPanelHTML(sig, { scanner: 'goldpine', label: sig.scriptLabel });
    if (rank) html = html.replace('</h2>', ' <span class="stamp pass">#' + rank + ' PICK</span></h2>');
    return html;
  }
  var cls = s.dir === 'long' ? 'long' : 'short';
  var rankBadge = rank ? '<span class="stamp pass" style="margin-left:6px">#' + rank + ' PICK</span>' : '';
  var badge = s.isNew ? '<span class="stamp pass" style="margin-left:6px">NEW</span>'
    : (s.isRecent ? '<span class="stamp" style="margin-left:6px">RECENT</span>'
      : (s.tier === 'native' ? '<span class="stamp pass" style="margin-left:6px">NATIVE</span>'
        : (s.tier === 'forming' ? '<span class="stamp" style="margin-left:6px">FORMING</span>'
          : ((s.isContext || s.tier === 'aligned') ? '<span class="stamp" style="margin-left:6px">ALIGNED</span>' : ''))));
  var tierNote = s.tier === 'primary' ? ' · PRIMARY' : (s.tier === 'native' ? ' · NATIVE'
    : (s.tier === 'forming' ? ' · FORMING' : (s.tier === 'aligned' ? ' · WATCH' : '')));
  var modeLabel = s.mode === 'swing' ? 'SWING · 4H' : 'SCALP · 15m';
  if (s.layerLabel) modeLabel += ' · ' + esc(s.layerLabel);
  else if (s.nativeStrategy) modeLabel += ' · ' + esc(s.nativeStrategy);
  var gpStack = s.stack;
  if (!gpStack && typeof W.hgSetupStackForPineSig === 'function'){
    try{
      gpStack = W.hgSetupStackForPineSig({
        sym: 'XAUUSD', dir: s.dir, isNew: s.tier === 'primary' || s.tier === 'native',
        isRecent: s.isRecent, isContext: s.isContext || s.tier === 'aligned', tier: s.tier
      }, { style: 'goldpine', asset: 'gold' });
    }catch(eGp){}
  }
  var gpStackHtml = (gpStack && typeof W.hgSetupStackMiniHtml === 'function') ? W.hgSetupStackMiniHtml(gpStack) : '';
  return '<div class="panel ' + cls + ' tier-' + tier + '" style="margin-bottom:12px">'
    + '<h2>XAUUSD <span>' + esc(s.dir.toUpperCase()) + ' · ' + modeLabel + ' · Grade ' + esc(s.grade)
    + rankBadge + badge + '</span></h2>'
    + '<div class="note">Confluence <b>' + s.score + '/' + s.maxScore + '</b>'
    + tierNote
    + ' · families <b>' + (s.familyCount != null ? s.familyCount : '—') + '</b>'
    + ' · mark ' + pxF(s.price) + ' · ' + esc(s.source)
    + (fin(+s.rr) ? (' · R:R ' + fmtF(s.rr, 2)) : '')
    + '</div>'
    + '<div class="note" style="margin-top:6px;font-size:11px">' + factorsHTML(s.factors) + '</div>'
    + gpStackHtml
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(s.dir, s.entry, s.stop, s.t1, s.t2, s.planSrc || 'Gold Pine')
      : ('ENTRY ' + pxF(s.entry) + ' · SL ' + pxF(s.stop) + ' · T1 ' + pxF(s.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'XAUUSD\',\'' + s.dir + '\',' + s.entry + ',' + s.stop + ',' + s.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn('XAUUSD', s.dir, s.entry, s.stop, s.t1, { scanner: 'goldpine', strategy: s.mode, t2: s.t2, stack: gpStack })
      : '')
    + '</div>';
}

function sectionHTML(title, setups, emptyMsg, opts){
  opts = opts || {};
  if (!setups.length){
    return '<div class="panel"><h2>' + esc(title) + '</h2>'
      + '<div class="empty">' + esc(emptyMsg) + '</div></div>';
  }
  var total = fin(+opts.total) ? +opts.total : setups.length;
  var hdr = (total > setups.length)
    ? ('Top ' + setups.length + ' of ' + total + ' · highest-probability formation')
    : (setups.length + ' setup(s)');
  return '<div class="panel"><h2>' + esc(title) + ' <span>' + hdr + '</span></h2></div>'
    + setups.map(function(s, i){ return cardHTML(s, i + 1); }).join('');
}

var __goldPineSnap = null;
var __goldPineTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>GOLD PINE <span>Pine layers + confluence + native gold detectors</span></h2>'
    + '<div class="note">Universe scan: every aligned Pine layer (NEW/RECENT/ALIGNED), HTF bias, confluence PRIMARY/ALIGNED/FORMING, '
    + 'plus native GOLD SWING/SCALP candidates. UI shows the <b>top ' + TOP_SETUPS + ' highest-probability formations</b> per section '
    + '(NEW/RECENT/FORMING weighted). '
    + '<b>PRIMARY</b> = strict (≥' + SWING_MIN + ' swing / ≥' + SCALP_MIN + ' scalp). '
    + '<b>ALIGNED</b> = per-layer or watch context. <b>NATIVE</b> = goldind strategies.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="goldPineRun">RUN GOLD PINE SCAN</button>'
    + '<span class="note" id="goldPineStat">Fetches XAU/PAXG candles then scores swing + scalp.</span>'
    + '</div>'
    + '<div class="prog" id="goldPineProg"><i></i></div>'
    + '<div id="goldPineLevels" style="margin-top:8px"></div>'
    + '<div id="goldPineDesk"></div>'
    + '<div id="goldPineOut" style="margin-top:12px"><div class="empty">Press RUN GOLD PINE SCAN.</div></div>'
    + '</div>';

  var btn = el.querySelector('#goldPineRun');
  var stat = el.querySelector('#goldPineStat');
  var prog = el.querySelector('#goldPineProg');
  var out = el.querySelector('#goldPineOut');
  var lvEl = el.querySelector('#goldPineLevels');

  try{
    var gpDesk = el.querySelector('#goldPineDesk');
    if (gpDesk && typeof W.hgSetupDeskBannerHTML === 'function'){
      gpDesk.innerHTML = W.hgSetupDeskBannerHTML({ kind: 'goldpine', tab: 'GOLD PINE', note: 'PRIMARY = ticket · ALIGNED/FORMING = watch · top picks by probability score.' });
    }
    if (typeof W.hgSetupInjectStyles === 'function') W.hgSetupInjectStyles();
  }catch(eGp){}

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
      var swingTop = topProbSetups(result.swing, TOP_SETUPS);
      var scalpTop = topProbSetups(result.scalp, TOP_SETUPS);
      result.swingTop = swingTop;
      result.scalpTop = scalpTop;
      __goldPineSnap = result;

      if (lvEl && result.levels){
        var lv = result.levels;
        lvEl.innerHTML = '<div class="note">Levels · PDH <b>' + pxF(lv.pdh) + '</b> · PDL <b>' + pxF(lv.pdl)
          + '</b> · Asia <b>' + pxF(lv.asiaLo) + '–' + pxF(lv.asiaHi) + '</b> · feed <b>' + esc(result.source) + '</b></div>';
      }

      var html = sectionHTML('GOLD PINE — SWING SETUPS (4H)', swingTop,
          'No swing formations — check gold feed (4h bars). Layers need ~280×4h for full Pine stack.',
          { total: result.swing.length })
        + sectionHTML('GOLD PINE — SCALP SETUPS (15m)', scalpTop,
          'No scalp formations — check gold feed (15m bars). Native strategies need 15m/1h/4h legs.',
          { total: result.scalp.length });

      if (out) out.innerHTML = html;
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (stat) stat.textContent = 'done · top ' + swingTop.length + '/' + result.swing.length + ' swing · top '
        + scalpTop.length + '/' + result.scalp.length + ' scalp · ' + dt + 's';
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
  setTimeout(function(){
    if (!__goldPineTab.hasRun && !__goldPineTab.busy) runScan();
  }, 150);
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
W.topProbSetups = topProbSetups;
W.goldPineProbScore = probScore;
W.GOLD_PINE_TOP_SETUPS = TOP_SETUPS;
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
