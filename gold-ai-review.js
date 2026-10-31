/* =========================================================================
   HARDGATE — gold-ai-review.js
   Optional AI setup-review layer for the GOLD tabs.
   ========================================================================= */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;
  function fin(v){ return typeof v === 'number' && isFinite(v); }
  function loadCfg(){
    var cfg = { endpoint: 'http://localhost:20128', token: '', model: 'auto/best-free' };
    try {
      if (typeof localStorage === 'undefined') return cfg;
      var raw = localStorage.getItem('hg_omniroute_v1');
      if (!raw) return cfg;
      var j = JSON.parse(raw);
      if (j && typeof j === 'object'){
        if (j.endpoint) cfg.endpoint = String(j.endpoint);
        if (j.token) cfg.token = String(j.token);
        if (j.model) cfg.model = String(j.model);
      }
    } catch (e) {}
    return cfg;
  }
  function threshold(){ try { var v = parseInt(localStorage.getItem('hg_gold_ai_threshold'),10); if (isFinite(v) && v>=0 && v<=100) return v; } catch(e){} return 40; }
  function available(){ var c = loadCfg(); return !!(c && c.endpoint); }
  function shouldDemote(review){ if (!review) return false; if (review.verdict === 'disagree') return true; if (review.confidence != null && review.confidence < threshold()) return true; return false; }
  function px(n){ if (!fin(+n)) return '\u2014'; var x = Math.abs(+n); if (x >= 10000) return (+n).toFixed(2); if (x >= 100) return (+n).toFixed(2); if (x >= 1) return (+n).toFixed(4); return (+n).toFixed(6); }
  function buildPrompt(setup, ctx){
    ctx = ctx || {};
    var lines = [];
    lines.push('You are a senior gold (XAUUSD) trading reviewer. Review ONE setup the deterministic engine produced and return ONLY a JSON object.');
    lines.push('');
    lines.push('SETUP:');
    lines.push('  strategy: ' + (setup.strategy || setup.stratKey || 'unknown'));
    lines.push('  direction: ' + (setup.dir || '?'));
    lines.push('  symbol: ' + (setup.sym || setup.venue || 'XAUUSD'));
    lines.push('  entry: ' + px(setup.entry));
    lines.push('  stop: ' + px(setup.stop));
    lines.push('  TP1: ' + px(setup.t1) + ' (' + (fin(+setup.rr)? +setup.rr.toFixed(2) : '?') + 'R)');
    if (fin(+setup.t2)) lines.push('  TP2: ' + px(setup.t2));
    if (setup.grade) lines.push('  grade: ' + setup.grade);
    if (setup.killzone) lines.push('  killzone: ' + setup.killzone);
    if (setup.layerLabel) lines.push('  pine layer: ' + setup.layerLabel);
    if (setup.planSrc) lines.push('  plan source: ' + setup.planSrc);
    if (Array.isArray(setup.factors) && setup.factors.length){
      var fsum = setup.factors.map(function(f){ return (f && f.cat ? f.cat : '') + (f && f.ok ? '+' : '-') + (f && isFinite(+f.pts) ? f.pts : ''); }).join(', ');
      lines.push('  factors: ' + fsum.slice(0, 400));
    }
    if (setup.freeReads && typeof setup.freeReads === 'object'){
      var withN = 0, againstN = 0, tot = 0;
      for (var rk in setup.freeReads){ if (Object.prototype.hasOwnProperty.call(setup.freeReads, rk)){ tot++; if (setup.freeReads[rk] === true) withN++; else if (setup.freeReads[rk] === false) againstN++; } }
      lines.push('  confluence reads: ' + withN + ' with / ' + againstN + ' against of ' + tot);
    }
    if (setup.pineStates && typeof setup.pineStates === 'object'){
      lines.push('  pine stack: ' + (setup.pineStates.readable || 0) + ' readable, ' + (setup.pineStates.allLong || 0) + ' long, ' + (setup.pineStates.allShort || 0) + ' short');
    }
    if (setup.familyCount != null) lines.push('  family count: ' + setup.familyCount);
    if (setup.why) lines.push('  engine rationale: ' + String(setup.why).slice(0, 400));
    lines.push('');
    lines.push('MARKET CONTEXT (best-effort, may be partial):');
    if (ctx.macro) lines.push('  macro: ' + JSON.stringify(ctx.macro).slice(0, 600));
    if (ctx.news) lines.push('  news: ' + JSON.stringify(ctx.news).slice(0, 400));
    if (ctx.fng) lines.push('  fear&greed: ' + JSON.stringify(ctx.fng));
    if (ctx.spot) lines.push('  spot: ' + JSON.stringify(ctx.spot).slice(0, 300));
    lines.push('');
    lines.push('TASK: you are a senior gold (XAUUSD) trader with decades of experience. Fuse the Pine-script indicator stack, native strategy signals, fundamentals (macro/real-rates/COT), technical structure (EMA/ATR/levels) and sentiment (fear&greed, positioning, news) to judge this setup. Check: stop distance vs ATR, TP1 vs nearest structure, direction vs macro stack and confluence reads, R:R >= 1.2. Be strict: disagree when R:R < 1.2, direction fights the macro stack, or confluence reads are net against. Return a one-sentence rationale naming the deciding factor.');
    lines.push('Return ONLY this JSON (no prose, no markdown):');
    lines.push('{ "confidence": <0-100 integer>, "verdict": "agree"|"caution"|"disagree", "rationale": "<one sentence, <=160 chars>" }');
    return lines.join('\n');
  }
  async function review(setup, ctx){
    if (!setup || !available()) return null;
    var c = loadCfg();
    var base = String(c.endpoint || '').replace(/\/+$/, '');
    if (!base) return null;
    var headers = { 'Content-Type': 'application/json' };
    if (c.token) headers['Authorization'] = 'Bearer ' + c.token;
    var prompt = buildPrompt(setup, ctx || {});
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    if (ctl) timer = setTimeout(function(){ try { ctl.abort(); } catch(e){} }, 45000);
    try {
      var r = await fetch(base + '/v1/chat/completions', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ model: c.model || 'auto/best-free', messages: [{ role: 'user', content: prompt }], max_tokens: 220, stream: false }),
        signal: ctl ? ctl.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (!r) return null;
      var t = await r.text();
      var j = null; try { j = JSON.parse(t); } catch(e){}
      if (!r.ok) return null;
      var txt = '';
      try { txt = j.choices[0].message.content; } catch(e){}
      if (!txt) return null;
      txt = String(txt).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      var out = null; try { out = JSON.parse(txt); } catch(e){}
      if (!out || typeof out !== 'object') return null;
      var conf = parseInt(out.confidence, 10);
      if (!isFinite(conf)) conf = null;
      if (conf != null) conf = Math.max(0, Math.min(100, conf));
      var verdict = String(out.verdict || '').toLowerCase();
      if (verdict !== 'agree' && verdict !== 'caution' && verdict !== 'disagree') verdict = 'caution';
      var rationale = String(out.rationale || '').slice(0, 200);
      return { ok: true, confidence: conf, verdict: verdict, rationale: rationale, model: (j && j.model) || c.model };
    } catch (e) {
      if (timer) clearTimeout(timer);
      return null;
    }
  }
  function renderReview(container, review){
    if (!container || !review) return;
    if (shouldDemote(review)) { try { container.style.opacity = '0.72'; } catch(e){} } else { try { container.style.opacity = ''; } catch(e){} }
    var id = 'hg-ai-review-line';
    var old = container.querySelector('#' + id);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var col = review.verdict === 'agree' ? '#22C55E' : (review.verdict === 'disagree' ? '#EF4444' : '#F59E0B');
    var h = '<div id="' + id + '" style="margin-top:8px;padding:6px 10px;border:1px solid ' + col + ';border-radius:6px;font-size:11px;color:var(--txt)">'
      + '<b style="color:' + col + '">AI REVIEW</b> \u00b7 confidence ' + (review.confidence != null ? review.confidence + '%' : '\u2014')
      + ' \u00b7 ' + review.verdict.toUpperCase()
      + (review.rationale ? ' \u2014 ' + String(review.rationale).replace(/</g,'&lt;') : '')
      + '</div>';
    container.insertAdjacentHTML('beforeend', h);
  }
  function runAndRender(setup, ctx, container){
    if (!setup || !container || !available()) return;
    review(setup, ctx).then(function(r){
      if (!r) return;
      setup.aiReview = r;
      setup.aiDemoted = shouldDemote(r);
      try { renderReview(container, r); } catch(e){}
      if (setup.aiDemoted) try { container.setAttribute('data-ai-demoted','1'); } catch(e){}
    }).catch(function(){});
  }
  W.hgGoldAiReview = review;
  W.hgGoldAiReviewAvailable = available;
  W.hgGoldAiReviewThreshold = threshold;
  W.hgGoldAiShouldDemote = shouldDemote;
  W.hgGoldAiReviewRender = renderReview;
  W.hgGoldAiReviewRun = runAndRender;
})();
