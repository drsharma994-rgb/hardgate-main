/* =========================================================================
HARDGATE — omniroute.js
OMNIROUTE — strategy ingestion desk.

WHAT THIS IS. A research bench that answers one question: "the well-known
crypto traders and influencers teach technique X — do our gates already cover
it, and if not, what would the gate look like?" It has two halves.

  HALF 1 — COVERAGE MATRIX (static, no network, always works).
    A curated ledger of the publicly documented methodologies that the most
    widely followed crypto educators actually teach (ICT liquidity model,
    Wyckoff schematics, TTM squeeze, funding/OI positioning, TSMOM, RS
    rotation, volume profile, CVD...), each mapped against HARDGATE's real
    tab/gate inventory as COVERED / PARTIAL / GAP. The GAP rows ARE the
    answer to "how do we improve ours" — they are the techniques a popular
    educator would run that our ledger currently cannot express.

  HALF 2 — SOURCE INGEST (needs the OmniRoute gateway).
    Paste a transcript / article / repo README, or give a search query, and
    the local OmniRoute LLM gateway extracts the concrete mechanical rules
    (timeframe, trigger, filters, invalidation, target) as strict JSON. Those
    rules are then mapped against the SAME gate inventory by
    hgOmniMapRules() — pure, deterministic, client-side. The model extracts;
    it never adjudicates coverage, and it never emits a trade.

WHAT THIS IS NOT. Not a signal source. Nothing here produces a ticket, a
side, or a size, and no influencer opinion is ever treated as evidence about
price. "Gates, not scores" holds: output is a coverage verdict plus a
proposed gate spec for a HUMAN to implement and backtest. An extracted rule
is a hypothesis, not a gate, until it has been coded and measured.

WHY THE GATEWAY IS CALLED DIRECTLY. /api/proxy carries a deliberate
ALLOWED_HOSTS allowlist (Delta, CoinDCX, Yahoo, ...) and 403s everything
else; widening it on a public live site to fetch arbitrary URLs would be a
real security regression, so we do not touch it. Instead the browser talks to
the OmniRoute gateway directly — it reflects Origin and allows the
Authorization header, so a cross-origin POST from the app works. The
consequence is honest and stated in the UI: the gateway lives on YOUR
machine, so ingest works when you run HARDGATE locally and is unreachable
from the deployed Render site. Half 1 is unaffected either way.

Classic script, IIFE. Exposes ONLY the pure helpers (for tests) and the
window.HG_tabs registration. Never throws at load; every global is
feature-checked; every fetch carries an AbortController timeout and resolves
null on failure.

Hard refresh (index.html hardRefreshAll): refresh() is async, NEVER throws,
returns a terse status string. It re-renders the coverage matrix (pure, cheap)
and never re-runs an LLM call — a global refresh must not spend tokens or
reach the network on its own. Before the first ingest it reports
'matrix ok · ingest not run yet'; while an ingest is in flight, 'busy'.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_omniroute_v1';
  var DEFAULT_ENDPOINT = 'http://localhost:20128';
  var DEFAULT_MODEL = 'auto/best-free';
  var LLM_TIMEOUT_MS = 90000;
  var PING_TIMEOUT_MS = 8000;

  var __omni = { ui: null, busy: false, ranIngest: false, lastSnap: null };

  /* ==================== pure core: gate inventory ==================== */
  /* HARDGATE's real capability surface, keyed by the technique it can
     express. Keep this honest — a tab listed here must actually implement
     the technique, because every coverage verdict is computed from it. */
  function hgOmniGateInventory(){
    return [
      { key:'ema_cascade',      label:'EMA cascade / trend stack',       tabs:['SWING SCAN','EDGE','TREND MATRIX'] },
      { key:'htf_alignment',    label:'higher-timeframe alignment',      tabs:['SWING SCAN','BIAS','EDGE'] },
      { key:'sweep_reclaim',    label:'liquidity sweep + reclaim',       tabs:['SCALP SCAN','LIQUIDITY TRAP','EDGE'] },
      { key:'fvg',              label:'fair value gap / imbalance',      tabs:['SMC (FVG)'] },
      { key:'order_block',      label:'order block + mitigation',        tabs:['ORDER BLOCKS'] },
      { key:'rsi_band',         label:'RSI band / guard',                tabs:['SWING SCAN','SCALP SCAN'] },
      { key:'divergence',       label:'RSI divergence',                  tabs:['DIVERGENCE'] },
      { key:'squeeze',          label:'volatility squeeze / Donchian',   tabs:['SQUEEZE','COIL WATCHLIST'] },
      { key:'compression',      label:'range compression / stored energy',tabs:['COIL WATCHLIST'] },
      { key:'funding',          label:'funding rate + crowding',         tabs:['SMART $','OI FLOW','BASIS','CARRY'] },
      { key:'open_interest',    label:'open interest regime',            tabs:['OI FLOW','SMART $'] },
      { key:'taker_flow',       label:'taker buy/sell imbalance',        tabs:['SMART $','OI FLOW'] },
      { key:'tsmom',            label:'time-series momentum',            tabs:['BIAS'] },
      { key:'cusum',            label:'CUSUM structural break',          tabs:['BIAS','SWING SCAN'] },
      { key:'rel_strength',     label:'relative strength / rotation',    tabs:['APEX (RS)'] },
      { key:'regime',           label:'market regime risk-on/off',       tabs:['REGIME'] },
      { key:'macro',            label:'macro overlay (DXY, 10Y, real rate)',tabs:['GOLD','GOLD PRO','REGIME'] },
      { key:'atr_vol',          label:'ATR / volatility-alive check',    tabs:['SCALP SCAN'] },
      { key:'structural_rr',    label:'structural R:R floor',            tabs:['SWING SCAN','EDGE','TRADE PLAN'] },
      { key:'session_killzone', label:'session / kill-zone time gating', tabs:['GOLD'] },
      { key:'portfolio_heat',   label:'portfolio heat / risk cap',       tabs:['TRADE PLAN','RISK'] }
    ];
  }

  function hgOmniInventoryKeys(){
    var inv = hgOmniGateInventory(), out = {}, i;
    for (i = 0; i < inv.length; i++) out[inv[i].key] = inv[i];
    return out;
  }

  /* ==================== pure core: the roster ==================== */
  /* Publicly documented methodologies taught by the most widely followed
     crypto/futures educators. Listed by SCHOOL, not by performance claim —
     these are techniques published in public teaching material, and nothing
     here asserts anything about anyone's track record or profitability.
     `needs` are inventory keys; coverage is COMPUTED from them, never typed
     by hand, so this table cannot drift out of sync with the inventory. */
  function hgOmniRoster(){
    return [
      { school:'ICT / smart-money liquidity model',
        taught:'liquidity sweeps of prior highs/lows, fair value gaps, order blocks, kill-zone sessions, power of three (accumulation → manipulation → distribution)',
        needs:['sweep_reclaim','fvg','order_block','session_killzone','power_of_three'] },
      { school:'Wyckoff method',
        taught:'accumulation/distribution schematics, spring and upthrust-after-distribution, volume dry-up in the range, effort vs result',
        needs:['compression','spring_utad','effort_vs_result','open_interest'] },
      { school:'TTM squeeze / volatility expansion (Carter, Bollinger lineage)',
        taught:'Bollinger-inside-Keltner compression, momentum histogram fire, Donchian breakout confirmation',
        needs:['squeeze','compression','atr_vol'] },
      { school:'Perp positioning / funding desk',
        taught:'funding z-score extremes, open-interest divergence against price, taker imbalance, long/short account ratios as a contrarian read',
        needs:['funding','open_interest','taker_flow'] },
      { school:'Quant trend following (TSMOM lineage)',
        taught:'time-series momentum over 1–12 month lookbacks, volatility targeting, structural-break detection',
        needs:['tsmom','cusum','vol_targeting'] },
      { school:'Relative strength rotation',
        taught:'rank the universe by strength against BTC/benchmark, hold leaders, rotate on rank decay',
        needs:['rel_strength','regime'] },
      { school:'Volume profile / auction market theory',
        taught:'point of control, value area high/low, naked POC revisits, initial balance, volume-at-price acceptance vs rejection',
        needs:['volume_profile','value_area'] },
      { school:'Order flow / CVD',
        taught:'cumulative volume delta, absorption at levels, delta divergence against price, liquidation cascade mapping',
        needs:['cvd','taker_flow','liquidation_map'] },
      { school:'Classical price action (Brooks lineage)',
        taught:'trend bars vs doji, measured moves, always-in direction, second-entry pullbacks',
        needs:['ema_cascade','htf_alignment','measured_move'] },
      { school:'Session / opening range',
        taught:'weekly and daily opening range, prior-session high/low as the day’s reference, Asia range breakout',
        needs:['session_killzone','opening_range'] }
    ];
  }

  /* Coverage verdict for one roster row: COVERED (every need in inventory),
     PARTIAL (some), GAP (none). Pure. */
  function hgOmniCoverage(row, inv){
    if (!row || !row.needs || !row.needs.length) return null;
    var keys = inv || hgOmniInventoryKeys();
    var have = [], miss = [], i, k;
    for (i = 0; i < row.needs.length; i++){
      k = row.needs[i];
      if (keys[k]) have.push(k); else miss.push(k);
    }
    var verdict = miss.length === 0 ? 'COVERED' : (have.length === 0 ? 'GAP' : 'PARTIAL');
    return { school: row.school, taught: row.taught, verdict: verdict, have: have, miss: miss };
  }

  function hgOmniCoverageMatrix(){
    var inv = hgOmniInventoryKeys(), roster = hgOmniRoster(), out = [], i, c;
    for (i = 0; i < roster.length; i++){
      c = hgOmniCoverage(roster[i], inv);
      if (c) out.push(c);
    }
    return out;
  }

  /* Every missing inventory key across the whole roster, with the schools
     that want it — the concrete "what to build next" list, ordered by how
     many schools independently rely on it. Pure. */
  function hgOmniGaps(){
    var m = hgOmniCoverageMatrix(), tally = {}, i, j, k;
    for (i = 0; i < m.length; i++){
      for (j = 0; j < m[i].miss.length; j++){
        k = m[i].miss[j];
        if (!tally[k]) tally[k] = { key: k, schools: [] };
        tally[k].schools.push(m[i].school);
      }
    }
    var out = [];
    for (k in tally){ if (Object.prototype.hasOwnProperty.call(tally, k)) out.push(tally[k]); }
    out.sort(function(a, b){
      if (b.schools.length !== a.schools.length) return b.schools.length - a.schools.length;
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });
    return out;
  }

  /* ==================== pure core: extraction plumbing ==================== */

  function hgOmniBuildPrompt(sourceText, kind){
    var what = kind === 'search'
      ? 'Search the web for how this trader or strategy actually works, then extract it.'
      : 'Extract the trading method described in the SOURCE below.';
    return [
      'You are a trading-strategy extractor. ' + what,
      'Return STRICT JSON only — no prose, no markdown fence. Shape:',
      '{"name":string,"timeframe":string,"trigger":string,"filters":[string],',
      '"invalidation":string,"target":string,"techniques":[string]}',
      '',
      '"techniques" MUST be chosen from exactly this vocabulary (use only what the',
      'method genuinely relies on; omit the rest):',
      hgOmniVocabulary().join(', '),
      '',
      'Rules: if the source does not state something, use the empty string —',
      'never invent a number. Do not give opinions on whether the method is good.',
      '',
      'SOURCE:',
      String(sourceText || '').slice(0, 24000)
    ].join('\n');
  }

  /* The controlled vocabulary the model must map into: every inventory key
     plus the known gap keys the roster references. Pure. */
  function hgOmniVocabulary(){
    var inv = hgOmniGateInventory(), out = [], i;
    for (i = 0; i < inv.length; i++) out.push(inv[i].key);
    var extra = ['power_of_three','spring_utad','effort_vs_result','vol_targeting',
                 'volume_profile','value_area','cvd','liquidation_map',
                 'measured_move','opening_range'];
    for (i = 0; i < extra.length; i++) if (out.indexOf(extra[i]) === -1) out.push(extra[i]);
    return out;
  }

  /* LLM output → object. Tolerates fenced blocks and leading prose; returns
     null rather than throwing on anything unparseable. Pure. */
  function hgOmniParseModelJson(text){
    if (typeof text !== 'string' || !text) return null;
    var s = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) { /* fall through to brace scan */ }
    var start = s.indexOf('{');
    if (start < 0) return null;
    var depth = 0, i, ch;
    for (i = start; i < s.length; i++){
      ch = s.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}'){
        depth--;
        if (depth === 0){
          try { return JSON.parse(s.slice(start, i + 1)); } catch (e2) { return null; }
        }
      }
    }
    return null;
  }

  /* Extracted rules → coverage verdict against the SAME inventory the matrix
     uses. Deterministic; the model never decides this. Pure. */
  function hgOmniMapRules(rules){
    if (!rules || typeof rules !== 'object') return null;
    var keys = hgOmniInventoryKeys();
    var tech = Array.isArray(rules.techniques) ? rules.techniques : [];
    var covered = [], gaps = [], unknown = [], vocab = hgOmniVocabulary(), i, t;
    for (i = 0; i < tech.length; i++){
      t = String(tech[i] || '').trim();
      if (!t) continue;
      if (keys[t]) covered.push({ key: t, label: keys[t].label, tabs: keys[t].tabs });
      else if (vocab.indexOf(t) >= 0) gaps.push(t);
      else unknown.push(t);
    }
    return {
      name: String(rules.name || 'unnamed method'),
      timeframe: String(rules.timeframe || ''),
      trigger: String(rules.trigger || ''),
      filters: Array.isArray(rules.filters) ? rules.filters.map(String) : [],
      invalidation: String(rules.invalidation || ''),
      target: String(rules.target || ''),
      covered: covered,
      gaps: gaps,
      unknown: unknown,
      verdict: gaps.length === 0 && covered.length > 0 ? 'ALREADY COVERED'
             : (covered.length === 0 ? 'NOT EXPRESSIBLE TODAY' : 'PARTIAL — ' + gaps.length + ' new gate(s) needed')
    };
  }

  /* ==================== settings ==================== */

  function hgOmniLoadCfg(){
    var cfg = { endpoint: DEFAULT_ENDPOINT, token: '', model: DEFAULT_MODEL };
    try {
      if (typeof localStorage === 'undefined') return cfg;
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return cfg;
      var j = JSON.parse(raw);
      if (j && typeof j === 'object'){
        if (j.endpoint) cfg.endpoint = String(j.endpoint);
        if (j.token) cfg.token = String(j.token);
        if (j.model) cfg.model = String(j.model);
      }
    } catch (e) { /* corrupt entry — fall back to defaults, never throw */ }
    return cfg;
  }

  function hgOmniSaveCfg(cfg){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(LS_KEY, JSON.stringify({
        endpoint: String(cfg.endpoint || ''),
        token: String(cfg.token || ''),
        model: String(cfg.model || '')
      }));
      return true;
    } catch (e) { return false; }
  }

  /* ==================== gateway I/O ==================== */

  function hgOmniFetchJson(url, opts, timeoutMs){
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
      return Promise.resolve(null);
    }
    var ctl = new AbortController();
    var timer = setTimeout(function(){ try { ctl.abort(); } catch (e) {} }, timeoutMs);
    var o = opts || {};
    o.signal = ctl.signal;
    return fetch(url, o).then(function(r){
      return r.text().then(function(t){
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        return { ok: r.ok, status: r.status, json: j, text: t };
      });
    }).catch(function(){ return null; }).then(function(v){
      clearTimeout(timer);
      return v;
    });
  }

  function hgOmniPing(cfg){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    if (!base) return Promise.resolve({ ok: false, msg: 'no endpoint set' });
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    return hgOmniFetchJson(base + '/v1/models', { method: 'GET', headers: headers }, PING_TIMEOUT_MS)
      .then(function(r){
        if (!r) return { ok: false, msg: 'unreachable — gateway not running, or this page is not on your machine' };
        if (r.status === 401 || r.status === 403) return { ok: false, msg: 'auth rejected (' + r.status + ') — token missing or wrong class' };
        if (!r.ok) return { ok: false, msg: 'HTTP ' + r.status };
        var n = (r.json && r.json.data && r.json.data.length) ? r.json.data.length : 0;
        return { ok: true, msg: 'gateway up · ' + n + ' models' };
      });
  }

  /* One attempt at the gateway. Resolves {ok:false,msg} rather than throwing.
     Note an HTTP 200 can still carry no choices: OmniRoute's free provider
     pool routes per request, and an exhausted/rejecting provider surfaces as
     a 200 with an error body. That is a retryable condition, not a bug. */
  function hgOmniCompleteOnce(cfg, prompt){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    var body = {
      model: cfg.model || DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1400,
      stream: false
    };
    return hgOmniFetchJson(base + '/v1/chat/completions', {
      method: 'POST', headers: headers, body: JSON.stringify(body)
    }, LLM_TIMEOUT_MS).then(function(r){
      if (!r) return { ok: false, msg: 'gateway unreachable or timed out', retryable: true };
      if (!r.ok){
        var em = (r.json && r.json.error && r.json.error.message) ? r.json.error.message : ('HTTP ' + r.status);
        // 401/403 is a credential problem — retrying cannot help.
        return { ok: false, msg: em, retryable: r.status !== 401 && r.status !== 403 };
      }
      var txt = '';
      try { txt = r.json.choices[0].message.content; } catch (e) { txt = ''; }
      if (!txt){
        var em2 = (r.json && r.json.error && r.json.error.message)
          ? r.json.error.message : 'provider returned no completion';
        return { ok: false, msg: em2, retryable: true };
      }
      return { ok: true, text: txt, model: (r.json && r.json.model) || '' };
    });
  }

  /* Retry once on a retryable miss. Measured on the free pool: roughly a
     third of extraction calls come back empty because auto/* re-routes to a
     provider that then rejects, so a single-shot button reads as broken when
     the gateway is fine. One retry, no backoff loop — if two independent
     provider draws both fail, the honest answer is that it failed. */
  function hgOmniComplete(cfg, prompt, onRetry){
    return hgOmniCompleteOnce(cfg, prompt).then(function(r){
      if (r.ok || !r.retryable) return r;
      if (typeof onRetry === 'function') { try { onRetry(r.msg); } catch (e) {} }
      return hgOmniCompleteOnce(cfg, prompt).then(function(r2){
        if (r2.ok) return r2;
        return { ok: false, msg: r2.msg + ' (retried once)' };
      });
    });
  }

  /* ==================== render helpers ==================== */

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pill(verdict){
    var cls = verdict === 'COVERED' ? 'ok' : (verdict === 'GAP' ? 'bad' : '');
    return '<span class="gpip ' + cls + '">' + esc(verdict) + '</span>';
  }

  function renderMatrix(){
    var m = hgOmniCoverageMatrix(), h, i, r;
    h = '<table class="tbl"><thead><tr><th>SCHOOL</th><th>WHAT THEY TEACH</th><th>OURS</th><th>MISSING</th></tr></thead><tbody>';
    for (i = 0; i < m.length; i++){
      r = m[i];
      h += '<tr>'
        + '<td><b>' + esc(r.school) + '</b></td>'
        + '<td class="dim">' + esc(r.taught) + '</td>'
        + '<td>' + pill(r.verdict) + ' <span class="dim">' + r.have.length + '/' + (r.have.length + r.miss.length) + '</span></td>'
        + '<td class="dim">' + (r.miss.length ? esc(r.miss.join(', ')) : '—') + '</td>'
        + '</tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  function renderGaps(){
    var g = hgOmniGaps(), h, i;
    if (!g.length) return '<div class="empty">no gaps — every technique in the roster maps to an existing gate.</div>';
    h = '<div class="cards">';
    for (i = 0; i < g.length; i++){
      h += '<div class="card">'
        + '<div class="ttl">' + esc(g[i].key) + ' <span class="gpip bad">GAP</span></div>'
        + '<div class="dim">wanted by ' + g[i].schools.length + ' school'
        + (g[i].schools.length === 1 ? '' : 's') + ': ' + esc(g[i].schools.join(' · ')) + '</div>'
        + '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderProposal(mapped, modelName){
    if (!mapped) return '<div class="empty">could not parse a strategy out of that source.</div>';
    var h = '<div class="panel-in">';
    h += '<h3>' + esc(mapped.name) + ' ' + pill(mapped.verdict.indexOf('ALREADY') === 0 ? 'COVERED' : (mapped.covered.length ? 'PARTIAL' : 'GAP')) + '</h3>';
    if (modelName) h += '<div class="note dim">extracted by ' + esc(modelName) + ' via OmniRoute — rules below are the model’s reading of the source, not verified fact.</div>';
    h += '<table class="tbl"><tbody>';
    if (mapped.timeframe)    h += '<tr><th>timeframe</th><td>' + esc(mapped.timeframe) + '</td></tr>';
    if (mapped.trigger)      h += '<tr><th>trigger</th><td>' + esc(mapped.trigger) + '</td></tr>';
    if (mapped.filters.length) h += '<tr><th>filters</th><td>' + esc(mapped.filters.join(' · ')) + '</td></tr>';
    if (mapped.invalidation) h += '<tr><th>invalidation</th><td>' + esc(mapped.invalidation) + '</td></tr>';
    if (mapped.target)       h += '<tr><th>target</th><td>' + esc(mapped.target) + '</td></tr>';
    h += '</tbody></table>';

    h += '<h4>maps onto our gates</h4>';
    if (mapped.covered.length){
      h += '<ul class="lst">';
      for (var i = 0; i < mapped.covered.length; i++){
        h += '<li><span class="gpip ok">HAVE</span> ' + esc(mapped.covered[i].label)
          + ' <span class="dim">→ ' + esc(mapped.covered[i].tabs.join(', ')) + '</span></li>';
      }
      h += '</ul>';
    } else {
      h += '<div class="empty">nothing in this method maps to an existing gate.</div>';
    }

    if (mapped.gaps.length){
      h += '<h4>would need new gates</h4><ul class="lst">';
      for (var j = 0; j < mapped.gaps.length; j++){
        h += '<li><span class="gpip bad">BUILD</span> ' + esc(mapped.gaps[j]) + '</li>';
      }
      h += '</ul>';
    }
    if (mapped.unknown.length){
      h += '<div class="note warn">off-vocabulary terms the model returned (ignored in the verdict): '
        + esc(mapped.unknown.join(', ')) + '</div>';
    }
    h += '<div class="note">This is a research note. Nothing here is a signal, and no rule becomes a gate until it is coded and backtested against our own data.</div>';
    h += '</div>';
    return h;
  }

  /* ==================== ingest run ==================== */

  function runIngest(ui){
    if (__omni.busy) return Promise.resolve();
    var cfg = readCfgFromUi(ui);
    var kind = ui.kind ? ui.kind.value : 'paste';
    var src = ui.src ? String(ui.src.value || '').trim() : '';
    if (!src){
      ui.stat.textContent = 'nothing to analyse — paste a transcript/article, or type a search query.';
      return Promise.resolve();
    }
    __omni.busy = true;
    ui.btn.disabled = true;
    ui.stat.textContent = 'asking the gateway…';
    ui.out.innerHTML = '';
    hgOmniSaveCfg(cfg);

    return hgOmniComplete(cfg, hgOmniBuildPrompt(src, kind), function(why){
      ui.stat.textContent = 'provider missed (' + why + ') — retrying once…';
    }).then(function(r){
      if (!r.ok){
        ui.stat.textContent = 'gateway error: ' + r.msg;
        ui.out.innerHTML = '<div class="note warn">The coverage matrix above still stands — it needs no network. '
          + 'Ingest needs the OmniRoute gateway reachable from this browser; on the deployed site it never will be, '
          + 'because the gateway runs on your own machine.</div>';
        return;
      }
      var parsed = hgOmniParseModelJson(r.text);
      if (!parsed){
        ui.stat.textContent = 'model did not return usable JSON.';
        ui.out.innerHTML = '<div class="note warn">raw reply kept below for inspection.</div>'
          + '<pre class="pre">' + esc(String(r.text).slice(0, 2000)) + '</pre>';
        return;
      }
      var mapped = hgOmniMapRules(parsed);
      __omni.lastSnap = mapped;
      __omni.ranIngest = true;
      ui.stat.textContent = 'done — ' + (mapped ? mapped.verdict : 'no verdict');
      ui.out.innerHTML = renderProposal(mapped, r.model);
    }).catch(function(){
      ui.stat.textContent = 'ingest failed.';
    }).then(function(){
      __omni.busy = false;
      ui.btn.disabled = false;
    });
  }

  function readCfgFromUi(ui){
    return {
      endpoint: ui.ep ? String(ui.ep.value || '').trim() : DEFAULT_ENDPOINT,
      token: ui.tok ? String(ui.tok.value || '').trim() : '',
      model: ui.model ? String(ui.model.value || '').trim() : DEFAULT_MODEL
    };
  }

  /* ==================== mount / refresh ==================== */

  function mountOmniroute(el){
    if (!el) return;
    var cfg = hgOmniLoadCfg();
    var gaps = hgOmniGaps();

    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniRoute — strategy ingestion <span>what the popular desks teach · vs what our ledger can express</span></h2>'
      + '<div class="note" style="margin-bottom:10px">Two halves. <b>Coverage matrix</b> is static and always works: '
      + 'the publicly documented methods the most followed crypto educators teach, scored against our real gate inventory. '
      + 'The <b>GAP</b> rows are the answer to “how do we improve ours” — ' + gaps.length
      + ' technique(s) our ledger cannot currently express. <b>Ingest</b> is optional and needs the local OmniRoute gateway: '
      + 'paste any source (transcript, article, repo README) or a search query, and the model extracts the mechanical rules — '
      + 'which are then mapped by our own deterministic code, not by the model. '
      + 'Nothing here is a trade signal; an influencer’s opinion is never evidence about price.</div>'

      + '<h3>1 · coverage matrix</h3>'
      + '<div id="omniMatrix">' + renderMatrix() + '</div>'

      + '<h3 style="margin-top:14px">2 · gaps, ranked by how many schools want them</h3>'
      + '<div id="omniGaps">' + renderGaps() + '</div>'

      + '<hr class="sep">'
      + '<h3>3 · ingest a source</h3>'
      + '<div class="row" style="gap:8px;flex-wrap:wrap">'
      +   '<label class="f">GATEWAY<input id="omniEp" type="text" size="26" value="' + esc(cfg.endpoint) + '"></label>'
      +   '<label class="f">TOKEN<input id="omniTok" type="password" size="18" value="' + esc(cfg.token) + '" placeholder="oma_live_…"></label>'
      +   '<label class="f">MODEL<input id="omniModel" type="text" size="16" value="' + esc(cfg.model) + '"></label>'
      +   '<button class="btn" id="omniPing">PING</button>'
      + '</div>'
      + '<div class="note" id="omniPingStat">gateway not tested yet.</div>'
      + '<div class="row" style="gap:8px;margin-top:8px">'
      +   '<label class="f">SOURCE<select id="omniKind">'
      +     '<option value="paste">pasted text (transcript / article / README)</option>'
      +     '<option value="search">search query (gateway does the lookup)</option>'
      +   '</select></label>'
      +   '<button class="btn" id="omniRun">ANALYSE</button>'
      + '</div>'
      + '<textarea id="omniSrc" rows="7" style="width:100%;margin-top:8px" '
      +   'placeholder="Paste a transcript, article or repo README here — or switch SOURCE to search and type e.g. &quot;how does the ICT power of three model work&quot;."></textarea>'
      + '<div class="note" id="omniStat">idle.</div>'
      + '<div id="omniOut" style="margin-top:10px"></div>'
      + '</div>';

    var ui = {
      ep: el.querySelector('#omniEp'),
      tok: el.querySelector('#omniTok'),
      model: el.querySelector('#omniModel'),
      kind: el.querySelector('#omniKind'),
      src: el.querySelector('#omniSrc'),
      btn: el.querySelector('#omniRun'),
      ping: el.querySelector('#omniPing'),
      pingStat: el.querySelector('#omniPingStat'),
      stat: el.querySelector('#omniStat'),
      out: el.querySelector('#omniOut'),
      matrix: el.querySelector('#omniMatrix'),
      gaps: el.querySelector('#omniGaps')
    };
    if (!ui.btn || !ui.stat || !ui.out || !ui.ping) return;
    __omni.ui = ui;   // latest mount wins for the hard-refresh contract

    if (typeof fetch !== 'function' || typeof AbortController !== 'function'){
      ui.btn.disabled = true;
      ui.ping.disabled = true;
      ui.stat.textContent = 'no fetch/AbortController — ingest disabled; the matrix above is unaffected.';
      return;   // half 1 still fully rendered — degrade honestly
    }

    ui.ping.addEventListener('click', function(){
      var cfg2 = readCfgFromUi(ui);
      hgOmniSaveCfg(cfg2);
      ui.pingStat.textContent = 'pinging…';
      return hgOmniPing(cfg2).then(function(p){
        ui.pingStat.textContent = p.msg;
        ui.pingStat.className = p.ok ? 'note' : 'note warn';
      });
    });
    ui.btn.addEventListener('click', function(){ return runIngest(ui); });
  }

  /* House contract: async, never throws, terse status. Re-renders the pure
     matrix only — a global refresh must never spend gateway tokens. */
  function refreshOmniroute(){
    return Promise.resolve().then(function(){
      if (__omni.busy) return 'busy';
      var ui = __omni.ui;
      if (ui && ui.matrix && ui.gaps){
        try {
          ui.matrix.innerHTML = renderMatrix();
          ui.gaps.innerHTML = renderGaps();
        } catch (e) { return 'matrix render failed'; }
      }
      var n = hgOmniGaps().length;
      return __omni.ranIngest
        ? ('matrix ok · ' + n + ' gaps · last ingest: ' + (__omni.lastSnap ? __omni.lastSnap.verdict : 'none'))
        : ('matrix ok · ' + n + ' gaps · ingest not run yet');
    }).catch(function(){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    window.hgOmniGateInventory = hgOmniGateInventory;   // pure, for tests
    window.hgOmniRoster = hgOmniRoster;
    window.hgOmniCoverage = hgOmniCoverage;
    window.hgOmniCoverageMatrix = hgOmniCoverageMatrix;
    window.hgOmniGaps = hgOmniGaps;
    window.hgOmniVocabulary = hgOmniVocabulary;
    window.hgOmniBuildPrompt = hgOmniBuildPrompt;
    window.hgOmniParseModelJson = hgOmniParseModelJson;
    window.hgOmniMapRules = hgOmniMapRules;
    window.hgOmniState = function hgOmniState(){
      try { return __omni.lastSnap ? JSON.parse(JSON.stringify(__omni.lastSnap)) : null; }
      catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omniroute', label: 'OMNIROUTE', mount: mountOmniroute, refresh: refreshOmniroute });
  }

})();
