/* =========================================================================
   HARDGATE — supersetup.js
   SUPER SETUP tab (id 'super-setup'): scanner + chart-aware risk builder.
   Pulls structure from HG_chart / scanner globals (and localStorage fallbacks),
   derives entry/stop/RR when missing, gates on leverage + fee buffer.
   Pure helpers exported for tests. refresh() re-syncs live context + recalc.
   Never throws at load time.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-setup';
var SYNC_MS = 2500;
var __ss = { mounted: false, update: null, syncTimer: null, root: null };

function N(v){ return Number(v); }

function fmt(n, d){
  d = (d === undefined) ? 2 : d;
  var x = N(n);
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

function safeJson(x){
  try{ return (typeof x === 'string') ? JSON.parse(x) : x; }catch(e){ return null; }
}

var SCANNER_KEYS = ['HG_scannerOutput', 'HG_lastScan', 'HG_bestSetup', 'HG_selectedSetup',
  'HG_currentSetup', 'HG_chartSetup', 'HG_signal'];

function getScannerContext(win, storage){
  win = win || W;
  storage = storage || (win && win.localStorage);
  var sources = [
    win.HG_scannerOutput, win.HG_lastScan, win.HG_bestSetup, win.HG_selectedSetup,
    win.HG_currentSetup, win.HG_chartSetup, win.HG_signal
  ];
  var i;
  for (i = 0; i < sources.length; i++){
    if (sources[i] && typeof sources[i] === 'object') return sources[i];
  }
  if (storage && typeof storage.getItem === 'function'){
    for (i = 0; i < SCANNER_KEYS.length; i++){
      try{
        var v = safeJson(storage.getItem(SCANNER_KEYS[i]));
        if (v && typeof v === 'object') return v;
      }catch(e0){}
    }
  }
  return null;
}

function getChartContext(win){
  win = win || W;
  var c = win.HG_chart || win.chart || win.tradingChart || null;
  var lastPrice = N(c && (c.lastPrice != null ? c.lastPrice : c.price));
  if (!Number.isFinite(lastPrice)) lastPrice = N(win.HG_lastPrice != null ? win.HG_lastPrice : win.lastPrice);
  return {
    lastPrice: lastPrice,
    high: N(c && c.high != null ? c.high : win.HG_chartHigh),
    low: N(c && c.low != null ? c.low : win.HG_chartLow),
    ema21: N(c && c.ema21 != null ? c.ema21 : win.HG_ema21),
    ema50: N(c && c.ema50 != null ? c.ema50 : win.HG_ema50),
    ema200: N(c && c.ema200 != null ? c.ema200 : win.HG_ema200),
    atr: N(c && c.atr != null ? c.atr : win.HG_atr),
    swingHigh: N(c && c.swingHigh != null ? c.swingHigh : win.HG_swingHigh),
    swingLow: N(c && c.swingLow != null ? c.swingLow : win.HG_swingLow)
  };
}

function pickEntry(side, chart, scan){
  chart = chart || {};
  scan = scan || null;
  var direct = N(scan && (scan.entry != null ? scan.entry : (scan.entryPrice != null ? scan.entryPrice : (scan.setup && scan.setup.entry))));
  if (Number.isFinite(direct) && direct > 0) return direct;
  var lp = chart.lastPrice;
  var sh = chart.swingHigh;
  var sl = chart.swingLow;
  var ema21 = chart.ema21;
  var ema50 = chart.ema50;
  if (side === 'Long'){
    if (Number.isFinite(ema21) && Number.isFinite(ema50) && ema21 > ema50) return Number.isFinite(lp) ? lp : ema21;
    if (Number.isFinite(sl)) return sl * 1.001;
    if (Number.isFinite(lp)) return lp;
  } else {
    if (Number.isFinite(ema21) && Number.isFinite(ema50) && ema21 < ema50) return Number.isFinite(lp) ? lp : ema21;
    if (Number.isFinite(sh)) return sh * 0.999;
    if (Number.isFinite(lp)) return lp;
  }
  return NaN;
}

function pickStop(side, chart, scan, entry){
  chart = chart || {};
  scan = scan || null;
  entry = N(entry);
  var direct = N(scan && (scan.stop != null ? scan.stop : (scan.stopLoss != null ? scan.stopLoss : (scan.sl != null ? scan.sl : (scan.setup && scan.setup.stop)))));
  if (Number.isFinite(direct) && direct > 0) return direct;
  var atr = chart.atr;
  var swingHigh = chart.swingHigh;
  var swingLow = chart.swingLow;
  if (side === 'Long'){
    if (Number.isFinite(swingLow)) return swingLow - (Number.isFinite(atr) ? atr * 0.2 : 0);
    if (Number.isFinite(entry) && Number.isFinite(atr)) return entry - atr * 1.5;
  } else {
    if (Number.isFinite(swingHigh)) return swingHigh + (Number.isFinite(atr) ? atr * 0.2 : 0);
    if (Number.isFinite(entry) && Number.isFinite(atr)) return entry + atr * 1.5;
  }
  return NaN;
}

function pickRR(scan){
  var rr = N(scan && (scan.rr != null ? scan.rr : (scan.rR != null ? scan.rR : (scan.setup && scan.setup.rr))));
  return (Number.isFinite(rr) && rr > 0) ? rr : 2;
}

/** Risk-first sizing + approval gate. Accepts tpRR or rr. Pure — never throws. */
function calcTrade(opts){
  opts = opts || {};
  var balance = N(opts.balance);
  var riskPct = N(opts.riskPct);
  var entry = N(opts.entry);
  var stop = N(opts.stop);
  var tpRR = N(opts.tpRR != null ? opts.tpRR : (opts.rr != null ? opts.rr : 2));
  var maxLeverage = N(opts.maxLeverage != null ? opts.maxLeverage : 5);
  var feePct = N(opts.feePct != null ? opts.feePct : 0.06);
  var slipPct = N(opts.slipPct != null ? opts.slipPct : 0.05);

  if (![balance, riskPct, entry, stop, tpRR, maxLeverage].every(Number.isFinite)){
    return { ok: false, reason: 'Missing or invalid inputs' };
  }
  var riskDollars = balance * (riskPct / 100);
  var stopDist = Math.abs(entry - stop);
  if (stopDist <= 0) return { ok: false, reason: 'Stop-loss must differ from entry' };

  var positionUnits = riskDollars / stopDist;
  var notional = positionUnits * entry;
  var impliedLeverage = notional / balance;
  var feeBuffer = notional * ((feePct + slipPct) / 100);
  var effectiveRisk = riskDollars + feeBuffer;
  var tp = entry > stop ? entry + stopDist * tpRR : entry - stopDist * tpRR;
  var levOk = impliedLeverage <= maxLeverage;
  var pass = levOk && effectiveRisk <= riskDollars * 1.15;

  return {
    ok: pass,
    reason: pass ? 'PASS' : (!levOk ? 'Leverage too high' : 'Risk buffer too high'),
    riskDollars: riskDollars,
    riskUsd: riskDollars,
    stopDist: stopDist,
    positionUnits: positionUnits,
    qty: positionUnits,
    notional: notional,
    impliedLeverage: impliedLeverage,
    impliedLev: impliedLeverage,
    tp: tp,
    rr: tpRR,
    feeBuffer: feeBuffer,
    effectiveRisk: effectiveRisk
  };
}

function injectStyles(){
  if (W.__hgSuperSetupStyles) return;
  W.__hgSuperSetupStyles = true;
  var st = document.createElement('style');
  st.id = 'hg-super-setup-styles';
  st.textContent = [
    '.hg-super-setup{padding:16px;display:grid;gap:12px}',
    '.hg-super-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
    '.hg-super-badge{font:700 11px/1.2 var(--mono,monospace);padding:6px 10px;border-radius:999px;background:var(--panel2,#edf1f6);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}',
    '.hg-super-setup .hg-card{grid-column:span 12;background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);border-radius:var(--radius,8px);padding:14px;color:var(--txt,#172033);box-shadow:var(--shadow-sm,0 1px 2px rgba(23,32,51,.06))}',
    '.hg-super-setup .hg-card h3{margin:0 0 10px 0;font:700 13px/1.2 var(--disp,system-ui);color:var(--txt,#172033);letter-spacing:.06em;text-transform:uppercase}',
    '.hg-super-setup .hg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
    '.hg-super-setup .hg-field{display:grid;gap:6px}',
    '.hg-super-setup .hg-field label{font:600 11px/1.2 var(--mono,monospace);color:var(--mut,#536175);letter-spacing:.04em}',
    '.hg-super-setup .hg-field input,.hg-super-setup .hg-field select{width:100%;box-sizing:border-box;border:1px solid var(--line-strong,#aab7c8);background:var(--panel,#fff);color:var(--txt,#172033);border-radius:var(--radius-sm,6px);padding:10px 12px;font:500 13px/1.2 var(--mono,monospace)}',
    '.hg-super-setup .hg-out{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    '.hg-super-setup .hg-metric{background:var(--panel2,#edf1f6);border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);padding:10px}',
    '.hg-super-setup .hg-metric .k{font:600 11px/1.2 var(--mono,monospace);color:var(--dim,#65758c)}',
    '.hg-super-setup .hg-metric .v{margin-top:6px;font:700 15px/1.2 var(--mono,monospace);color:var(--txt,#172033)}',
    '.hg-super-setup .hg-pass{color:var(--long,#15803d)!important}',
    '.hg-super-setup .hg-fail{color:var(--short,#dc2626)!important}',
    '.hg-super-setup .hg-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}',
    '.hg-super-setup .hg-btn{border:0;border-radius:var(--radius-sm,6px);padding:10px 14px;font:700 12px/1.2 var(--mono,monospace);cursor:pointer;letter-spacing:.04em}',
    '.hg-super-setup .hg-btn.primary{background:linear-gradient(180deg,#2563eb,#0f5cc0);color:#fff;box-shadow:0 2px 8px rgba(15,92,192,.18)}',
    '.hg-super-setup .hg-btn.secondary{background:var(--panel,#fff);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-setup .hg-note{font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-setup .hg-title{font:800 18px/1.2 var(--disp,system-ui);color:var(--txt,#172033)}',
    '.hg-super-setup .hg-sync{padding:10px 12px;background:var(--panel2,#edf1f6);border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '@media (max-width:900px){.hg-super-setup .hg-form,.hg-super-setup .hg-out{grid-template-columns:1fr}}'
  ].join('\n');
  try{ (document.head || document.documentElement).appendChild(st); }catch(e){}
}

function clearSyncTimer(){
  if (__ss.syncTimer != null){
    try{ clearInterval(__ss.syncTimer); }catch(e){}
    __ss.syncTimer = null;
  }
}

function mount(el){
  if (!el) return;
  clearSyncTimer();
  try{ injectStyles(); }catch(e0){}
  el.innerHTML = [
    '<section class="hg-tab hg-super-setup">',
    '  <div class="hg-super-head">',
    '    <div>',
    '      <div class="hg-title">Super Setup</div>',
    '      <div class="hg-note">Live structure + scanner-aware trade builder. Entry, SL, TP, leverage, and safety gating.</div>',
    '    </div>',
    '    <div class="hg-super-badge">Super Setup v1.1.0</div>',
    '  </div>',
    '  <div class="hg-super-grid">',
    '    <div class="hg-card"><h3>Trade Context</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-symbol">Symbol</label><input id="ss-symbol" value="BTCUSDT" /></div>',
    '      <div class="hg-field"><label for="ss-side">Direction</label><select id="ss-side"><option>Long</option><option>Short</option></select></div>',
    '      <div class="hg-field"><label for="ss-tf">Timeframe</label><input id="ss-tf" value="15m" /></div>',
    '      <div class="hg-field"><label for="ss-setup">Setup Type</label><input id="ss-setup" value="Super Setup" /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Inputs</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-balance">Account Balance</label><input id="ss-balance" type="number" value="1000" step="0.01" /></div>',
    '      <div class="hg-field"><label for="ss-risk">Risk % per Trade</label><input id="ss-risk" type="number" value="1" step="0.01" /></div>',
    '      <div class="hg-field"><label for="ss-entry">Entry Price</label><input id="ss-entry" type="number" value="0" step="0.00000001" /></div>',
    '      <div class="hg-field"><label for="ss-stop">Stop Loss</label><input id="ss-stop" type="number" value="0" step="0.00000001" /></div>',
    '      <div class="hg-field"><label for="ss-rr">Take Profit RR</label><input id="ss-rr" type="number" value="2" step="0.1" /></div>',
    '      <div class="hg-field"><label for="ss-lev">Max Leverage</label><input id="ss-lev" type="number" value="5" step="0.1" /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Live Structure / Scanner Sync</h3>',
    '      <div class="hg-sync" id="ss-sync">Waiting for chart or scanner context…</div>',
    '      <div class="hg-actions">',
    '        <button type="button" class="hg-btn secondary" id="ss-use-chart">Use live chart structure</button>',
    '        <button type="button" class="hg-btn secondary" id="ss-use-scan">Use scanner output</button>',
    '        <button type="button" class="hg-btn primary" id="ss-calc">Calculate</button>',
    '      </div>',
    '    </div>',
    '    <div class="hg-card"><h3>Outputs</h3><div class="hg-out">',
    '      <div class="hg-metric"><div class="k">Risk $</div><div class="v" id="o-risk">$—</div></div>',
    '      <div class="hg-metric"><div class="k">Position Size</div><div class="v" id="o-size">—</div></div>',
    '      <div class="hg-metric"><div class="k">Implied Leverage</div><div class="v" id="o-lev">—</div></div>',
    '      <div class="hg-metric"><div class="k">Take Profit</div><div class="v" id="o-tp">—</div></div>',
    '      <div class="hg-metric"><div class="k">RR</div><div class="v" id="o-rr">—</div></div>',
    '      <div class="hg-metric"><div class="k">Status</div><div class="v" id="o-status">—</div></div>',
    '    </div>',
    '      <div class="hg-note" id="ss-note" style="margin-top:10px">Stop-loss is mandatory. The trade is blocked if the structure or leverage is unsafe.</div>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-setup') || el;
  __ss.root = root;
  var chart = getChartContext();
  var scan = getScannerContext();

  function $(id){ return root.querySelector(id); }

  function syncText(){
    var parts = [];
    if (Number.isFinite(chart.lastPrice)) parts.push('Chart last: ' + chart.lastPrice);
    if (Number.isFinite(chart.ema21) && Number.isFinite(chart.ema50)){
      parts.push('EMA21/50: ' + chart.ema21 + ' / ' + chart.ema50);
    }
    if (Number.isFinite(chart.swingHigh) || Number.isFinite(chart.swingLow)){
      parts.push('Swings: ' + fmt(chart.swingHigh, 8) + ' / ' + fmt(chart.swingLow, 8));
    }
    if (scan) parts.push('Scanner: ' + (scan.symbol || scan.coin || scan.ticker || 'found'));
    var syncEl = $('#ss-sync');
    if (syncEl){
      syncEl.textContent = parts.length ? parts.join(' | ') : 'No live structure found yet.';
    }
  }

  function updateFromSources(){
    chart = getChartContext();
    scan = getScannerContext();
    syncText();
    if (scan){
      var sym = scan.symbol || scan.coin || scan.ticker;
      if (sym && $('#ss-symbol')) $('#ss-symbol').value = String(sym);
      var dir = scan.dir || scan.side || (scan.setup && scan.setup.dir);
      if (dir && $('#ss-side')){
        var d = String(dir).toLowerCase();
        $('#ss-side').value = (d.indexOf('short') >= 0 || d === 'sell') ? 'Short' : 'Long';
      }
      if (scan.tf && $('#ss-tf')) $('#ss-tf').value = String(scan.tf);
    }
  }

  function fillFromSource(source){
    updateFromSources();
    var side = ($('#ss-side') && $('#ss-side').value) || 'Long';
    var scanForPick = (source === 'scan') ? scan : null;
    var entry = pickEntry(side, chart, scanForPick);
    if (!Number.isFinite(entry)) entry = pickEntry(side, chart, scan);
    var stop = pickStop(side, chart, scanForPick, entry);
    if (!Number.isFinite(stop)) stop = pickStop(side, chart, scan, entry);
    var rr = pickRR(source === 'scan' ? scan : null);
    if (Number.isFinite(entry) && $('#ss-entry')) $('#ss-entry').value = entry;
    if (Number.isFinite(stop) && $('#ss-stop')) $('#ss-stop').value = stop;
    if (Number.isFinite(rr) && $('#ss-rr')) $('#ss-rr').value = rr;
  }

  function update(){
    var res = calcTrade({
      balance: $('#ss-balance') && $('#ss-balance').value,
      riskPct: $('#ss-risk') && $('#ss-risk').value,
      entry: $('#ss-entry') && $('#ss-entry').value,
      stop: $('#ss-stop') && $('#ss-stop').value,
      rr: $('#ss-rr') && $('#ss-rr').value,
      maxLeverage: $('#ss-lev') && $('#ss-lev').value,
      feePct: 0.06,
      slipPct: 0.05
    });
    var hasNums = res && (res.ok || Number.isFinite(res.riskDollars));
    if ($('#o-risk')) $('#o-risk').textContent = hasNums ? ('$' + fmt(res.riskDollars, 2)) : '$—';
    if ($('#o-size')) $('#o-size').textContent = hasNums && Number.isFinite(res.positionUnits) ? fmt(res.positionUnits, 6) : '—';
    if ($('#o-lev')) $('#o-lev').textContent = hasNums && Number.isFinite(res.impliedLeverage) ? (fmt(res.impliedLeverage, 2) + 'x') : '—';
    if ($('#o-tp')) $('#o-tp').textContent = hasNums && Number.isFinite(res.tp) ? fmt(res.tp, 8) : '—';
    if ($('#o-rr')) $('#o-rr').textContent = hasNums && Number.isFinite(res.rr) ? ('1:' + fmt(res.rr, 2)) : '—';
    if ($('#o-status')){
      $('#o-status').textContent = res.ok ? 'PASS' : ('BLOCK: ' + res.reason);
      $('#o-status').className = 'v ' + (res.ok ? 'hg-pass' : 'hg-fail');
    }
    if ($('#ss-note')){
      $('#ss-note').textContent = res.ok
        ? 'Setup passes all safety checks.'
        : ('Setup blocked: ' + res.reason + '.');
    }
    return res;
  }

  root.querySelectorAll('input,select').forEach(function(inp){
    inp.addEventListener('input', update);
  });
  var calcBtn = $('#ss-calc');
  if (calcBtn) calcBtn.addEventListener('click', update);
  var chartBtn = $('#ss-use-chart');
  if (chartBtn) chartBtn.addEventListener('click', function(){ fillFromSource('chart'); update(); });
  var scanBtn = $('#ss-use-scan');
  if (scanBtn) scanBtn.addEventListener('click', function(){ fillFromSource('scan'); update(); });

  __ss.mounted = true;
  __ss.update = function(){
    updateFromSources();
    return update();
  };
  __ss.fillFromSource = fillFromSource;

  updateFromSources();
  fillFromSource('chart');
  update();

  __ss.syncTimer = setInterval(function(){
    try{ updateFromSources(); }catch(e){}
  }, SYNC_MS);
}

async function superSetupRefresh(){
  try{
    if (!__ss.mounted || typeof __ss.update !== 'function') return 'skipped: not run yet';
    __ss.update();
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

W.superSetupCalc = calcTrade;
W.calcTrade = calcTrade;
W.superSetupSafeJson = safeJson;
W.superSetupGetScannerContext = getScannerContext;
W.superSetupGetChartContext = getChartContext;
W.superSetupPickEntry = pickEntry;
W.superSetupPickStop = pickStop;
W.superSetupPickRR = pickRR;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER SETUP',
  title: 'Super Setup',
  mount: mount,
  refresh: superSetupRefresh
});

})();
