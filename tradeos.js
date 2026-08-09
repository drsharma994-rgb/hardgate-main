/* =========================================================================
HARDGATE — tradeos.js
TradeOS MCP desk — Bloomberg-grade multi-asset NL analysis bridged through
the same-origin /api/tradeos/* proxy (TRADEOS_ACCESS_TOKEN stays server-side).

Presets align with Hardgate lanes:
  crypto — BTC/ETH TA + BTC/ETH spread ratio
  gold   — XAUUSD precious metals
  mixed  — multi-asset rank + macro/news

Hardgate context (regime, BRAIN, rotation, gold basis) is injected into every
query so TradeOS answers align with the terminal's gate-driven desk state.

Classic script, IIFE. window.HG_tabs registration (TOOLS group).
Never throws at load time.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

function toEsc(s){
  if (typeof W.hgEsc === 'function') return W.hgEsc(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdLite(text){
  var s = toEsc(String(text || ''));
  s = s.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

function collectHardgateContext(){
  var ctx = {};
  try{
    if (typeof W.regimeState === 'function'){
      var r = W.regimeState();
      if (r) ctx.regime = { label: r.label, score: r.score, playbook: r.playbook };
    }
    if (typeof W.rotationState === 'function'){
      var rot = W.rotationState();
      if (rot) ctx.rotation = { season: rot.season, altPct: rot.altPct };
    }
    if (typeof W.__hgBrainLast === 'function'){
      var b = W.__hgBrainLast();
      if (b){
        ctx.brain = { marketRead: b.marketRead || null };
        if (b.rows && b.rows[0]){
          ctx.brain.topSym = b.rows[0].sym;
          ctx.brain.topTier = b.rows[0].tier;
        }
      }
    }
    if (typeof W.S !== 'undefined' && W.S){
      if (W.S.goldDataSource) ctx.goldSource = W.S.goldDataSource;
      if (W.S.goldBasisPct != null && isFinite(+W.S.goldBasisPct)) ctx.goldBasisPct = +W.S.goldBasisPct;
    }
    if (typeof W.getDeskMacroCached === 'function'){
      var desk = W.getDeskMacroCached();
      if (desk){
        ctx.desk = { riskOnScore: desk.riskOnScore, riskOnLabel: desk.riskOnLabel,
          spxTrend: desk.spx && desk.spx.trend20, vix: desk.vix && desk.vix.last };
      }
    }
  }catch(e){}
  return ctx;
}

var __tradeos = { busy: false, configured: null, presets: [], lastAt: null, lastPreset: null };

async function fetchCapabilities(){
  try{
    var res = await fetch('/api/tradeos/capabilities', { cache: 'no-store' });
    var j = await res.json();
    __tradeos.configured = !!(j && j.configured);
    __tradeos.presets = (j && j.presets) ? j.presets : [];
    return j;
  }catch(e){
    __tradeos.configured = false;
    return null;
  }
}

async function runTradeosQuery(ui, opts){
  if (__tradeos.busy) return 'busy';
  var query = String((opts && opts.query) || '').trim();
  var preset = String((opts && opts.preset) || '').trim();
  if (!query && !preset){
    if (ui.stat) ui.stat.textContent = 'enter a question or pick a preset';
    return 'empty';
  }
  __tradeos.busy = true;
  if (ui.btn) ui.btn.disabled = true;
  if (ui.stat) ui.stat.textContent = 'TradeOS analyzing… (chart TA can take up to 2 min)';
  if (ui.out) ui.out.innerHTML = '<div class="note">working…</div>';
  if (ui.prog) ui.prog.style.display = 'block';

  var injectCtx = ui.ctxChk ? !!ui.ctxChk.checked : true;
  var body = {
    query: query,
    preset: preset || undefined,
    context: injectCtx ? collectHardgateContext() : undefined,
  };

  try{
    var res = await fetch('/api/tradeos/query', {
      method: 'POST',
      headers: (typeof W.hgApiHeaders === 'function') ? W.hgApiHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var j = await res.json();
    __tradeos.lastAt = Date.now();
    __tradeos.lastPreset = preset || null;

    if (!j || !j.ok){
      var reason = (j && j.reason) ? j.reason : ('HTTP ' + res.status);
      if (ui.stat) ui.stat.textContent = 'failed — ' + reason;
      if (ui.out) ui.out.innerHTML = '<div class="note warn">' + toEsc(reason) + '</div>';
      return 'failed: ' + reason;
    }

    var toolLine = j.tool ? (' · tool: ' + j.tool) : '';
    var msLine = j.ms ? (' · ' + j.ms + 'ms') : '';
    if (ui.stat) ui.stat.textContent = 'done' + toolLine + msLine;

    var html = '<div class="panel hg-panel"><h2>TradeOS response</h2>';
    if (j.meta && j.meta.lane){
      html += '<div class="note">lane: ' + toEsc(j.meta.lane) + (j.meta.preset ? ' · preset: ' + toEsc(j.meta.preset) : '') + '</div>';
    }
    html += '<div class="ledger tradeos-out">' + mdLite(j.text || '') + '</div></div>';
    if (ui.out) ui.out.innerHTML = html;
    return 'done';
  }catch(e){
    var msg = (e && e.message) ? e.message : String(e);
    if (ui.stat) ui.stat.textContent = 'error — ' + msg;
    if (ui.out) ui.out.innerHTML = '<div class="note warn">' + toEsc(msg) + '</div>';
    return 'error: ' + msg;
  }finally{
    __tradeos.busy = false;
    if (ui.btn) ui.btn.disabled = false;
    if (ui.prog) ui.prog.style.display = 'none';
  }
}

async function checkHealth(ui){
  if (ui.healthStat) ui.healthStat.textContent = 'checking…';
  try{
    var res = await fetch('/api/tradeos/health', { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok){
      if (ui.healthStat) ui.healthStat.textContent = 'connected';
      if (ui.healthStat) ui.healthStat.className = 'note ok';
    }else{
      var r = (j && j.reason) ? j.reason : ('HTTP ' + res.status);
      if (ui.healthStat) ui.healthStat.textContent = r;
      if (ui.healthStat) ui.healthStat.className = 'note warn';
    }
  }catch(e){
    if (ui.healthStat) ui.healthStat.textContent = 'health check failed';
    if (ui.healthStat) ui.healthStat.className = 'note warn';
  }
}

function renderPresets(ui){
  if (!ui.presets) return;
  var presets = __tradeos.presets || [];
  if (!presets.length){
    ui.presets.innerHTML = '';
    return;
  }
  var html = presets.map(function(p){
    return '<button type="button" class="chip tradeos-preset" data-preset="' + toEsc(p.id) + '" title="' + toEsc(p.description || '') + '">' + toEsc(p.label) + '</button>';
  }).join('');
  ui.presets.innerHTML = html;
  ui.presets.querySelectorAll('.tradeos-preset').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pid = btn.getAttribute('data-preset') || '';
      if (ui.query) ui.query.value = '';
      runTradeosQuery(ui, { preset: pid, query: '' });
    });
  });
}

function mountTradeos(el){
  if (!el) return;
  var hostNote = (typeof W.hgHostingMode === 'function' && W.hgHostingMode() === 'static')
    ? ' Static host — TradeOS requires Render with TRADEOS_ACCESS_TOKEN.'
    : '';

  el.innerHTML =
    '<div class="panel hg-panel">'
    + '<h2>TradeOS MCP <span>Bloomberg-grade multi-asset analysis · crypto · gold · spreads</span></h2>'
    + '<div class="note" style="margin-bottom:8px">Natural-language queries routed through the server-side TradeOS MCP bridge. '
    + 'Hardgate regime, BRAIN, and rotation context can be injected so answers align with this desk.'
    + hostNote + '</div>'
    + '<div class="row" style="align-items:center;gap:12px;margin-bottom:8px">'
    + '<span class="note" id="tradeosHealthStat">checking config…</span>'
    + '<button type="button" class="btn sm" id="tradeosHealthBtn">CHECK CONNECTION</button>'
    + '</div>'
    + '<div class="note" id="tradeosStat">idle</div>'
    + '<div class="row chips" id="tradeosPresets" style="margin:10px 0;flex-wrap:wrap;gap:6px"></div>'
    + '<label class="f" style="display:block;margin-bottom:8px">QUESTION<textarea id="tradeosQuery" rows="3" placeholder="e.g. Rank BTC and ETH vs XAUUSD by trend and momentum" style="width:100%;max-width:720px"></textarea></label>'
    + '<label class="f" style="margin-bottom:10px"><input type="checkbox" id="tradeosCtxChk" checked> Inject Hardgate context (regime · BRAIN · rotation · gold basis)</label>'
    + '<div class="row"><button class="btn" id="tradeosRun">RUN ANALYSIS</button></div>'
    + '<div class="prog" id="tradeosProg" style="display:none;margin-top:8px"><i></i></div>'
    + '<div id="tradeosOut" style="margin-top:12px"></div>'
    + '</div>';

  var ui = {
    btn: el.querySelector('#tradeosRun'),
    stat: el.querySelector('#tradeosStat'),
    out: el.querySelector('#tradeosOut'),
    prog: el.querySelector('#tradeosProg'),
    query: el.querySelector('#tradeosQuery'),
    ctxChk: el.querySelector('#tradeosCtxChk'),
    presets: el.querySelector('#tradeosPresets'),
    healthBtn: el.querySelector('#tradeosHealthBtn'),
    healthStat: el.querySelector('#tradeosHealthStat'),
  };

  fetchCapabilities().then(function(cap){
    if (!cap || !cap.configured){
      if (ui.stat) ui.stat.textContent = 'TradeOS not configured on server — set TRADEOS_ACCESS_TOKEN on Render';
      if (ui.healthStat){ ui.healthStat.textContent = 'not configured'; ui.healthStat.className = 'note warn'; }
      if (ui.btn) ui.btn.disabled = true;
    }else{
      if (ui.stat) ui.stat.textContent = 'ready — pick a preset or type a question';
      if (ui.healthStat){ ui.healthStat.textContent = 'configured'; ui.healthStat.className = 'note ok'; }
    }
    renderPresets(ui);
  });

  if (ui.healthBtn) ui.healthBtn.addEventListener('click', function(){ return checkHealth(ui); });
  if (ui.btn){
    ui.btn.addEventListener('click', function(){
      return runTradeosQuery(ui, { query: ui.query ? ui.query.value : '', preset: '' });
    });
  }
  if (ui.query){
    ui.query.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)){
        ev.preventDefault();
        runTradeosQuery(ui, { query: ui.query.value, preset: '' });
      }
    });
  }
}

function tradeosState(){
  try{
    return {
      configured: __tradeos.configured,
      lastAt: __tradeos.lastAt,
      lastPreset: __tradeos.lastPreset,
      busy: __tradeos.busy,
    };
  }catch(e){ return null; }
}

async function refreshTradeos(){
  try{
    if (__tradeos.busy) return 'busy';
    return 'skipped: query on demand';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

if (typeof W !== 'undefined'){
  W.tradeosState = tradeosState;
  W.tradeosCollectContext = collectHardgateContext;
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'tradeos', label: 'TRADEOS', mount: mountTradeos, refresh: refreshTradeos });
}

})();
