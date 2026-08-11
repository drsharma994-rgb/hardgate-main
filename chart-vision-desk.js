/* HARDGATE — chart vision browser bridge (formation boost + setup enrich).
   POST /api/chart-vision/analyze with OHLCV from scan candidates. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __visionCache = {};
var __visionBusy = {};
var __visionCaps = null;
var VISION_TTL = 8 * 60 * 1000;
var CAPS_TTL = 60 * 1000;

function fin(v){ return typeof v === 'number' && isFinite(v); }

function visionKey(setup){
  setup = setup || {};
  var rows = setup.rows || setup.rows4h || setup.rows15m || [];
  var lastT = rows.length ? (rows[rows.length - 1].t || rows.length) : 0;
  return [
    setup.asset || (/(XAU|XAUT|GOLD|PAXG)/i.test(String(setup.sym || '')) ? 'gold' : 'crypto'),
    setup.sym || setup.symbol || '?',
    setup.timeframe || setup.tf || setup.style || '?',
    setup.dir || '?',
    lastT,
  ].join('|');
}

function hgChartVisionFormationBoost(dir, analysis){
  if (!analysis || !dir) return 0;
  var side = String(dir).toLowerCase();
  var bias = analysis.bias ? String(analysis.bias).toLowerCase() : null;
  var c = fin(+analysis.confidence) ? +analysis.confidence : 0;
  if (!bias || c < 0.55) return 0;
  if (bias === side){
    if (c >= 0.82) return 12;
    if (c >= 0.68) return 8;
    if (c >= 0.55) return 4;
    return 0;
  }
  if (c >= 0.75) return -10;
  if (c >= 0.62) return -6;
  return -3;
}

function visionModeBadge(mode){
  mode = String(mode || 'heuristic').toLowerCase();
  if (mode.indexOf('gemini-png') >= 0) return 'GEMINI PNG';
  if (mode.indexOf('gemini') >= 0) return 'GEMINI';
  return 'HEURISTIC';
}

function hgChartVisionClientSvg(rows, plan){
  rows = rows || [];
  plan = plan || {};
  if (rows.length < 8) return '';
  var slice = rows.slice(-80);
  var w = 820, h = 420, pad = 28;
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < slice.length; i++){
    if (slice[i].l < lo) lo = slice[i].l;
    if (slice[i].h > hi) hi = slice[i].h;
  }
  if (fin(+plan.entry)){ lo = Math.min(lo, +plan.entry); hi = Math.max(hi, +plan.entry); }
  if (fin(+plan.stop)){ lo = Math.min(lo, +plan.stop); hi = Math.max(hi, +plan.stop); }
  if (fin(+plan.t1)){ lo = Math.min(lo, +plan.t1); hi = Math.max(hi, +plan.t1); }
  if (!(hi > lo)) return '';
  var span = hi - lo;
  function yPrice(v){ return pad + (hi - v) / span * (h - pad * 2); }
  function xBar(i){ return pad + i / Math.max(1, slice.length - 1) * (w - pad * 2); }
  var bw = Math.max(2, (w - pad * 2) / slice.length * 0.55);
  var body = '';
  for (var k = 0; k < slice.length; k++){
    var b = slice[k];
    var cx = xBar(k);
    var col = b.c >= b.o ? '#22c55e' : '#ef4444';
    body += '<line x1="' + cx + '" y1="' + yPrice(b.h) + '" x2="' + cx + '" y2="' + yPrice(b.l)
      + '" stroke="' + col + '" stroke-width="1"/>';
    var yo = yPrice(Math.max(b.o, b.c));
    var yc = yPrice(Math.min(b.o, b.c));
    body += '<rect x="' + (cx - bw / 2) + '" y="' + yc + '" width="' + bw + '" height="' + Math.max(1, yo - yc)
      + '" fill="' + col + '"/>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h
    + '" viewBox="0 0 ' + w + ' ' + h + '" style="background:#0d1117">' + body + '</svg>';
}

async function hgChartVisionSvgToPngBase64(svg){
  if (!svg || typeof document === 'undefined') return null;
  try{
    var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    await new Promise(function(resolve, reject){
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    var canvas = document.createElement('canvas');
    canvas.width = 820;
    canvas.height = 420;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }catch(e){ return null; }
}

async function hgChartVisionCaps(){
  if (__visionCaps && Date.now() - __visionCaps.at < CAPS_TTL) return __visionCaps.data;
  try{
    var res = await fetch('/api/chart-vision/capabilities');
    var j = await res.json();
    __visionCaps = { at: Date.now(), data: j || {} };
    return __visionCaps.data;
  }catch(e){
    return { gemini: false };
  }
}

function hgChartVisionSvgBlock(setup){
  setup = setup || {};
  var svg = setup.visionSvg;
  if (!svg || String(svg).indexOf('<svg') < 0) return '';
  var esc = function(s){
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };
  var badge = setup.visionModeBadge
    ? '<span class="gpip ' + (setup.visionMode && String(setup.visionMode).indexOf('gemini') >= 0 ? 'ok' : '') + '">'
      + esc(setup.visionModeBadge) + '</span> ' : '';
  return '<div class="hg-vision-chart" style="margin-top:8px">'
    + (badge ? '<div class="gates" style="margin-bottom:4px">' + badge + '</div>' : '')
    + '<div class="hg-vision-svg" style="max-width:100%;overflow:auto;border-radius:6px;border:1px solid rgba(148,163,184,0.25)">'
    + svg + '</div></div>';
}

function getChartVisionCached(key){
  try{
    var hit = __visionCache[key];
    if (!hit) return null;
    if (Date.now() - hit.at > VISION_TTL) return null;
    return hit;
  }catch(e){ return null; }
}

function visionPredictionLine(analysis){
  if (!analysis) return '';
  var parts = [];
  if (analysis.nextBarOpinion) parts.push(analysis.nextBarOpinion);
  if (analysis.predictedPath) parts.push(analysis.predictedPath);
  if (analysis.outcomeLean) parts.push(analysis.outcomeLean);
  if (fin(+analysis.outcomeProb)) parts.push(Math.round(+analysis.outcomeProb * 100) + '% setup edge');
  if (analysis.horizonBars) parts.push('~' + analysis.horizonBars + ' bars');
  return parts.join(' · ');
}

function visionNextBarLine(analysis){
  if (!analysis) return '';
  return analysis.nextBarOpinion || '';
}

function hgChartVisionIsConfirmed(setup){
  setup = setup || {};
  if (!setup.dir) return false;
  if (setup.demoted || setup.vetoed || setup.visionVetoed) return false;
  if (setup.confirmed === false) return false;
  if (setup.tier && String(setup.tier).toLowerCase() !== 'clean') return false;
  if (setup.clean7 || setup.clean || setup.gateClean) return true;
  if (setup.nearClean && fin(+setup.gatesPassed) && +setup.gatesPassed >= 6) return true;
  if (setup.plan && setup.plan.confirmed) return true;
  if (setup.res && setup.res.plan && setup.res.plan.confirmed) return true;
  /* 7/7 cryptogates clean hits and gold confirmed cards default true when dir present */
  return true;
}

function hgChartVisionCopyFields(target, analysis, extras){
  if (!target || !analysis) return target;
  extras = extras || {};
  target.vision = analysis;
  target.visionChip = visionChip(analysis);
  target.visionNextMove = analysis.nextMove || '';
  target.visionNextBar = visionNextBarLine(analysis);
  target.visionPrediction = visionPredictionLine(analysis);
  if (extras.svg) target.visionSvg = extras.svg;
  if (extras.visionMode){
    target.visionMode = extras.visionMode;
    target.visionModeBadge = visionModeBadge(extras.visionMode);
  }
  return target;
}

function hgChartVisionCardBlock(setup){
  setup = setup || {};
  var hasVision = setup.visionNextBar || setup.visionNextMove || setup.visionPrediction || setup.visionChip;
  var svgBlock = (typeof hgChartVisionSvgBlock === 'function') ? hgChartVisionSvgBlock(setup) : '';
  if (!hasVision && !svgBlock) return '';
  var esc = function(s){
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };
  var chip = setup.visionChip
    ? '<span class="gpip ok">' + esc(setup.visionChip) + '</span> ' : '';
  var lines = [];
  if (setup.visionNextBar) lines.push('<b>NEXT BAR:</b> ' + esc(setup.visionNextBar));
  else if (setup.visionNextMove) lines.push('<b>NEXT:</b> ' + esc(setup.visionNextMove));
  if (setup.visionPrediction && setup.visionPrediction !== setup.visionNextBar) {
    lines.push('<b>PATH:</b> ' + esc(setup.visionPrediction));
  }
  var textBlock = lines.length
    ? ('<div class="note hg-vision-line">' + lines.join('<br>') + '</div>') : '';
  return '<div class="hg-vision-block" style="margin-top:8px">'
    + (chip ? '<div class="gates">' + chip + '</div>' : '')
    + textBlock + svgBlock + '</div>';
}

function hgChartVisionPatchCardByChartId(chartId, setup){
  if (!chartId || !setup) return;
  try{
    var anchor = document.getElementById(String(chartId).replace(/[^A-Za-z0-9_-]/g, ''));
    if (!anchor) return;
    var card = anchor.closest ? anchor.closest('.card') : null;
    if (!card) return;
    var old = card.querySelector('.hg-vision-block');
    if (old) old.remove();
    var html = hgChartVisionCardBlock(setup);
    if (!html) return;
    anchor.insertAdjacentHTML('afterend', html);
    var chead = card.querySelector('.chead');
    if (chead && setup.visionChip && !/\bVISION\b/.test(chead.textContent || '')){
      chead.insertAdjacentHTML('beforeend', ' <span class="gpip ok">' + String(setup.visionChip).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>');
    }
  }catch(e){}
}

function visionChip(analysis){
  if (!analysis) return '';
  var pct = fin(+analysis.confidence) ? Math.round(+analysis.confidence * 100) : 0;
  var edge = fin(+analysis.outcomeProb) ? Math.round(+analysis.outcomeProb * 100) : null;
  if (!analysis.bias){
    return pct >= 55 ? ('VISION MIXED ' + pct + '%' + (edge != null ? ' · ' + edge + '% edge' : '')) : '';
  }
  var chip = 'VISION ' + String(analysis.bias).toUpperCase() + ' ' + pct + '%'
    + (analysis.pattern ? ' · ' + analysis.pattern : '');
  if (edge != null && edge >= 52) chip += ' · ' + edge + '% edge';
  return chip;
}

function hgChartVisionRefreshStack(setup){
  if (!setup || !setup.vision) return setup;
  try{
    if (Array.isArray(setup.tallyParts) && typeof G.hgSetupStackFromTallyParts === 'function'){
      setup.stack = G.hgSetupStackFromTallyParts(setup.tallyParts, {
        dir: setup.dir,
        sym: setup.sym,
        grade: setup.grade,
        tally: setup.tally,
        clean: setup.grade === 'A',
        nearClean: setup.grade === 'B',
        vision: setup.vision,
        asset: /(XAU|XAUT|GOLD|PAXG)/i.test(String(setup.sym || '')) ? 'gold' : 'crypto',
        style: setup.style || 'gold-scalp',
      });
      return setup;
    }
    if (typeof G.hgSetupStackAttach === 'function'){
      G.hgSetupStackAttach(setup, {
        style: setup.style,
        sym: setup.sym,
        vision: setup.vision,
      });
    }
  }catch(e){}
  return setup;
}

async function hgChartVisionAnalyze(setup){
  setup = setup || {};
  var key = visionKey(setup);
  var cached = getChartVisionCached(key);
  if (cached && cached.analysis){
    return {
      ok: true,
      analysis: cached.analysis,
      svg: cached.svg,
      visionMode: cached.visionMode,
      cached: true,
      key: key,
    };
  }

  if (__visionBusy[key]){
    try{ return await __visionBusy[key]; }catch(e){ return { ok: false, reason: (e && e.message) || String(e) }; }
  }

  var rows = setup.rows || setup.rows15m || setup.rows4h || [];
  if (!rows.length) return { ok: false, reason: 'no rows' };

  var p = (async function(){
    try{
      var caps = await hgChartVisionCaps();
      var pngBase64 = null;
      if (caps && caps.gemini && caps.clientPngAccepted !== false){
        var clientSvg = setup.visionSvg || hgChartVisionClientSvg(rows, {
          entry: setup.entry, stop: setup.stop, t1: setup.t1,
        });
        if (clientSvg) pngBase64 = await hgChartVisionSvgToPngBase64(clientSvg);
      }
      var payload = {
        asset: setup.asset || (/(XAU|XAUT|GOLD|PAXG)/i.test(String(setup.sym || '')) ? 'gold' : 'crypto'),
        symbol: setup.sym || setup.symbol,
        timeframe: setup.timeframe || setup.tf || setup.style,
        dir: setup.dir,
        rows: rows,
        entry: setup.entry,
        stop: setup.stop,
        t1: setup.t1,
        context: {
          gateClean: !!setup.clean || !!setup.clean7,
          gatesPassed: setup.gatesPassed,
          formationScore: setup.formationScore,
          entry: setup.entry,
          stop: setup.stop,
          t1: setup.t1,
          dir: setup.dir,
        },
      };
      if (pngBase64) payload.pngBase64 = pngBase64;
      var res = await fetch('/api/chart-vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var j = await res.json();
      if (!j || !j.ok || !j.analysis) return { ok: false, reason: (j && j.reason) || 'analyze failed' };
      __visionCache[key] = { at: Date.now(), analysis: j.analysis, svg: j.svg, visionMode: j.visionMode };
      return {
        ok: true,
        analysis: j.analysis,
        svg: j.svg,
        visionMode: j.visionMode,
        geminiError: j.geminiError,
        geminiModel: j.geminiModel,
        pngUsed: j.pngUsed,
        cached: !!j.cached,
        key: key,
        ms: j.ms,
      };
    }catch(e){
      return { ok: false, reason: (e && e.message) || String(e) };
    }finally{
      delete __visionBusy[key];
    }
  })();

  __visionBusy[key] = p;
  return p;
}

function hgChartVisionApply(setup, analysis, extras){
  if (!setup || !analysis) return setup;
  hgChartVisionCopyFields(setup, analysis, extras);
  if (analysis.veto){
    setup.visionVetoed = true;
    setup.demoted = true;
    setup.demoteReason = analysis.note || 'chart vision conflict';
    setup.visionChip = (setup.visionChip ? setup.visionChip + ' · ' : '') + 'VISION VETO';
    return setup;
  }
  var boost = hgChartVisionFormationBoost(setup.dir, analysis);
  if (boost && fin(+setup.formationScore)) setup.formationScore = Math.round(+setup.formationScore + boost);
  else if (boost && !fin(+setup.formationScore)) setup.formationScore = Math.max(0, boost);
  return hgChartVisionRefreshStack(setup);
}

function hgChartVisionApplyToRef(setup, ref){
  if (!ref || !setup) return ref;
  ref.vision = setup.vision;
  ref.visionChip = setup.visionChip;
  ref.visionNextMove = setup.visionNextMove;
  ref.visionNextBar = setup.visionNextBar;
  ref.visionPrediction = setup.visionPrediction;
  ref.visionSvg = setup.visionSvg;
  ref.visionMode = setup.visionMode;
  ref.visionModeBadge = setup.visionModeBadge;
  if (setup.demoted) ref.demoted = true;
  if (setup.demoteReason) ref.demoteReason = setup.demoteReason;
  return ref;
}

/** Enrich confirmed setups asynchronously (default: all clean up to limit). */
function hgChartVisionEnrichSetups(setups, getRowsFn, opts){
  opts = opts || {};
  var limit = opts.limit != null ? +opts.limit : 12;
  var confirmedOnly = opts.confirmedOnly !== false;
  var list = (setups || []).filter(function(s){
    if (!s || !s.dir || s.demoted || s.vetoed) return false;
    return confirmedOnly ? hgChartVisionIsConfirmed(s) : true;
  }).slice(0, limit);
  if (!list.length) return Promise.resolve([]);

  function enrichOne(s){
    var rows = typeof getRowsFn === 'function' ? getRowsFn(s) : (s.rows || s.rows15m || s.rows4h || []);
    if (!rows || rows.length < 21) return Promise.resolve(s);
    return hgChartVisionAnalyze(Object.assign({}, s, { rows: rows })).then(function(r){
      if (r && r.ok && r.analysis){
        hgChartVisionApply(s, r.analysis, { svg: r.svg, visionMode: r.visionMode });
        if (s.__ref) hgChartVisionApplyToRef(s, s.__ref);
        if (s.__hitRef) hgChartVisionApplyToRef(s, s.__hitRef);
        if (typeof opts.onEach === 'function') opts.onEach(s, r);
      }
      return s;
    }).catch(function(){ return s; });
  }

  if (opts.sequential){
    var seq = Promise.resolve();
    for (var i = 0; i < list.length; i++){
      (function(item){
        seq = seq.then(function(){ return enrichOne(item); });
      })(list[i]);
    }
    return seq.then(function(){ return list; });
  }

  return Promise.all(list.map(enrichOne));
}

/** SWING/SCALP scan hook — enrich all clean hits and patch cards in place. */
function hgChartVisionEnrichCryptoScan(opts){
  opts = opts || {};
  var hits = opts.cleanHits || [];
  if (!hits.length) return Promise.resolve([]);
  var isSwing = opts.kind === 'swing';
  var wraps = hits.map(function(h){
    var hit = h.hit || h;
    return {
      sym: (h.t && h.t.symbol) || hit.sym || hit.symbol,
      dir: hit.dir,
      rows: isSwing ? hit.rows : (hit.m15 || hit.rows),
      entry: hit.entry,
      stop: hit.stop,
      t1: hit.t1,
      timeframe: isSwing ? '4h' : '15m',
      style: opts.kind || 'swing',
      asset: 'crypto',
      clean7: true,
      formationScore: hit.formationScore,
      __hitRef: hit,
      __chartId: hit.__visionChartId,
    };
  }).filter(function(w){ return w.dir && w.rows && w.rows.length >= 21; });

  return hgChartVisionEnrichSetups(wraps, function(w){ return w.rows; }, {
    limit: opts.limit != null ? opts.limit : 12,
    confirmedOnly: true,
  }).then(function(){
    for (var i = 0; i < wraps.length; i++){
      var w = wraps[i];
      if (w.__chartId) hgChartVisionPatchCardByChartId(w.__chartId, w.__hitRef || w);
    }
    if (typeof opts.onDone === 'function') opts.onDone(wraps);
    return wraps;
  });
}

/** Generic desk hook: enrich + optional repaint callback. */
function hgChartVisionEnrichDeskRows(rows, getRowsFn, opts){
  opts = opts || {};
  return hgChartVisionEnrichSetups(rows, getRowsFn, opts).then(function(out){
    if (typeof opts.repaint === 'function') opts.repaint(out);
    return out;
  });
}

/** Re-render gold scan cards after async vision (guards against stale scan generations). */
function hgChartVisionRefreshGoldCards(opts){
  opts = opts || {};
  if (opts.scanSt && opts.scanGen != null && opts.scanSt.visionGen !== opts.scanGen) return;
  if (!opts.ui || !opts.ui.cards || !opts.display || !opts.display.length) return;
  if (typeof opts.cardHTML !== 'function') return;
  try{
    opts.ui.cards.innerHTML = (opts.basisHtml || '') + (typeof opts.bannerHTML === 'function' ? opts.bannerHTML(opts.displayBest, opts.display) : '')
      + opts.display.map(function(c){
        return opts.cardHTML(c, !!(opts.displayBest && c.id === opts.displayBest.id), opts.seasonNote);
      }).join('')
      + (typeof opts.formingNowHTML === 'function' ? opts.formingNowHTML(opts.armedAll || []) : '')
      + (typeof opts.rejectedHTML === 'function' ? opts.rejectedHTML(opts.rejectedAll || []) : '')
      + (typeof opts.historyHTML === 'function' ? opts.historyHTML(opts.history || []) : '');
  }catch(e){}
}

/** Enrich EXECUTE (engine.js) survivors with chart vision chips. */
function hgChartVisionEnrichEngineSurvivors(survivors, cardsEl, cardHTML, paintCharts, opts){
  opts = opts || {};
  if (!survivors || !survivors.length || typeof cardHTML !== 'function') return Promise.resolve([]);
  var wraps = survivors.map(function(r){
    var plan = r.res && r.res.plan;
    return {
      sym: r.sym,
      dir: r.res && r.res.dir,
      rows: r.rows4h,
      entry: plan && plan.entry,
      stop: plan && plan.stop,
      t1: plan && plan.t1,
      clean7: r.res && r.res.gatesPassed >= 6,
      asset: 'crypto',
      timeframe: '4h',
      __ref: r,
    };
  }).filter(function(w){ return w.dir && w.rows && w.rows.length; });
  return hgChartVisionEnrichSetups(wraps, function(w){ return w.rows; }, { limit: opts.limit != null ? opts.limit : 12, confirmedOnly: true }).then(function(){
    for (var i = 0; i < wraps.length; i++){
      var w = wraps[i];
      if (w.__ref && w.visionChip){
        hgChartVisionApplyToRef(w, w.__ref);
      }
    }
    if (cardsEl){
      cardsEl.innerHTML = survivors.map(cardHTML).join('');
      if (typeof paintCharts === 'function') paintCharts(cardsEl, survivors);
    }
    return survivors;
  });
}

G.hgChartVisionFormationBoost = hgChartVisionFormationBoost;
G.hgChartVisionEnrichEngineSurvivors = hgChartVisionEnrichEngineSurvivors;
G.hgChartVisionRefreshGoldCards = hgChartVisionRefreshGoldCards;
G.hgChartVisionRefreshStack = hgChartVisionRefreshStack;
G.getChartVisionCached = getChartVisionCached;
G.hgChartVisionAnalyze = hgChartVisionAnalyze;
G.hgChartVisionApply = hgChartVisionApply;
G.hgChartVisionEnrichSetups = hgChartVisionEnrichSetups;
G.hgChartVisionEnrichCryptoScan = hgChartVisionEnrichCryptoScan;
G.hgChartVisionEnrichDeskRows = hgChartVisionEnrichDeskRows;
G.hgChartVisionIsConfirmed = hgChartVisionIsConfirmed;
G.hgChartVisionCardBlock = hgChartVisionCardBlock;
G.hgChartVisionPatchCardByChartId = hgChartVisionPatchCardByChartId;
G.hgChartVisionChip = visionChip;
G.hgChartVisionPredictionLine = visionPredictionLine;
G.hgChartVisionSvgBlock = hgChartVisionSvgBlock;
G.hgChartVisionCaps = hgChartVisionCaps;
G.hgChartVisionSvgToPngBase64 = hgChartVisionSvgToPngBase64;
G.hgChartVisionClientSvg = hgChartVisionClientSvg;
G.hgChartVisionNextBarLine = visionNextBarLine;

})();
