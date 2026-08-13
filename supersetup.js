/* =========================================================================
   HARDGATE — supersetup.js
   SUPER SETUP tab (id 'super-setup'): risk-first trade builder — entry, stop,
   TP from RR, implied leverage gate, fee/slip buffer. Pure calcTrade() is
   unit-tested; mount() uses app light-theme tokens (--panel, --line, --gold).
   Registers on window.HG_tabs under STRATEGIES. refresh() re-runs the last
   calc when the tab was opened; 'skipped: not run yet' before first mount.
   Never throws at load time.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-setup';
var __ss = { mounted: false, update: null };

function fmt(n, d){
  d = (d === undefined) ? 2 : d;
  var x = Number(n);
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

/** Risk-first sizing + approval gate. Pure — never throws. */
function calcTrade(opts){
  opts = opts || {};
  var balance = Number(opts.balance);
  var riskPct = Number(opts.riskPct);
  var entry = Number(opts.entry);
  var stop = Number(opts.stop);
  var tpRR = Number(opts.tpRR === undefined ? 2 : opts.tpRR);
  var maxLeverage = Number(opts.maxLeverage === undefined ? 5 : opts.maxLeverage);
  var feePct = Number(opts.feePct === undefined ? 0.06 : opts.feePct);
  var slipPct = Number(opts.slipPct === undefined ? 0.05 : opts.slipPct);

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
  var rrDist = stopDist * tpRR;
  var tp = entry > stop ? entry + rrDist : entry - rrDist;
  var liquidationBufferOk = impliedLeverage <= maxLeverage;
  var pass = effectiveRisk <= riskDollars * 1.15 && liquidationBufferOk;

  return {
    ok: pass,
    reason: pass
      ? 'PASS'
      : !liquidationBufferOk
        ? 'Leverage too high for safe buffer'
        : 'Fees/slippage or risk buffer too high',
    riskDollars: riskDollars,
    stopDist: stopDist,
    positionUnits: positionUnits,
    notional: notional,
    impliedLeverage: impliedLeverage,
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
    '.hg-super-setup .hg-warn{color:var(--veto,#c2410c)!important}',
    '.hg-super-setup .hg-actions{display:flex;gap:10px;flex-wrap:wrap}',
    '.hg-super-setup .hg-btn{border:0;border-radius:var(--radius-sm,6px);padding:10px 14px;font:700 12px/1.2 var(--mono,monospace);cursor:pointer;letter-spacing:.04em}',
    '.hg-super-setup .hg-btn.primary{background:linear-gradient(180deg,#2563eb,#0f5cc0);color:#fff;box-shadow:0 2px 8px rgba(15,92,192,.18)}',
    '.hg-super-setup .hg-btn.secondary{background:var(--panel,#fff);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-setup .hg-note{font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-setup .hg-title{font:800 18px/1.2 var(--disp,system-ui);color:var(--txt,#172033)}',
    '@media (max-width:900px){.hg-super-setup .hg-form,.hg-super-setup .hg-out{grid-template-columns:1fr}}'
  ].join('\n');
  try{ (document.head || document.documentElement).appendChild(st); }catch(e){}
}

function mount(el){
  if (!el) return;
  try{ injectStyles(); }catch(e0){}
  el.innerHTML = [
    '<section class="hg-tab hg-super-setup">',
    '  <div class="hg-super-head">',
    '    <div>',
    '      <div class="hg-title">Super Setup</div>',
    '      <div class="hg-note">Risk-first trade builder: entry, TP/SL, leverage safety, and approval gate.</div>',
    '    </div>',
    '    <div class="hg-super-badge">Super Setup v1.0.0</div>',
    '  </div>',
    '  <div class="hg-super-grid">',
    '    <div class="hg-card"><h3>Trade Context</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-symbol">Symbol</label><input id="ss-symbol" value="BTCUSDT" /></div>',
    '      <div class="hg-field"><label for="ss-side">Direction</label><select id="ss-side"><option>Long</option><option>Short</option></select></div>',
    '      <div class="hg-field"><label for="ss-tf">Timeframe</label><input id="ss-tf" value="15m" /></div>',
    '      <div class="hg-field"><label for="ss-setup">Setup Type</label><input id="ss-setup" value="Super Setup" /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Risk Inputs</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-balance">Account Balance</label><input id="ss-balance" type="number" value="1000" step="0.01" /></div>',
    '      <div class="hg-field"><label for="ss-risk">Risk % per Trade</label><input id="ss-risk" type="number" value="1" step="0.01" /></div>',
    '      <div class="hg-field"><label for="ss-entry">Entry Price</label><input id="ss-entry" type="number" value="0" step="0.00000001" /></div>',
    '      <div class="hg-field"><label for="ss-stop">Stop Loss</label><input id="ss-stop" type="number" value="0" step="0.00000001" /></div>',
    '      <div class="hg-field"><label for="ss-rr">Take Profit RR</label><input id="ss-rr" type="number" value="2" step="0.1" /></div>',
    '      <div class="hg-field"><label for="ss-lev">Max Leverage</label><input id="ss-lev" type="number" value="5" step="0.1" /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Outputs</h3><div class="hg-out">',
    '      <div class="hg-metric"><div class="k">Risk $</div><div class="v" id="o-risk">$—</div></div>',
    '      <div class="hg-metric"><div class="k">Position Size</div><div class="v" id="o-size">—</div></div>',
    '      <div class="hg-metric"><div class="k">Implied Leverage</div><div class="v" id="o-lev">—</div></div>',
    '      <div class="hg-metric"><div class="k">TP</div><div class="v" id="o-tp">—</div></div>',
    '      <div class="hg-metric"><div class="k">RR</div><div class="v" id="o-rr">—</div></div>',
    '      <div class="hg-metric"><div class="k">Status</div><div class="v" id="o-status">—</div></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Controls</h3>',
    '      <div class="hg-actions">',
    '        <button type="button" class="hg-btn primary" id="ss-calc">Calculate</button>',
    '        <button type="button" class="hg-btn secondary" id="ss-fill">Use from chart</button>',
    '      </div>',
    '      <div class="hg-note" id="ss-note" style="margin-top:10px">Stop-loss is mandatory. The trade is blocked if leverage is unsafe or risk is exceeded.</div>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-setup') || el;
  function $(id){ return root.querySelector(id); }

  function update(){
    var res = calcTrade({
      balance: $('#ss-balance') && $('#ss-balance').value,
      riskPct: $('#ss-risk') && $('#ss-risk').value,
      entry: $('#ss-entry') && $('#ss-entry').value,
      stop: $('#ss-stop') && $('#ss-stop').value,
      tpRR: $('#ss-rr') && $('#ss-rr').value,
      maxLeverage: $('#ss-lev') && $('#ss-lev').value
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
  var fillBtn = $('#ss-fill');
  if (fillBtn) fillBtn.addEventListener('click', function(){
    try{
      var px = null;
      if (W.HG_chart && typeof W.HG_chart.lastPrice === 'number') px = W.HG_chart.lastPrice;
      else if (W.HG_chartVisionResults && typeof W.HG_chartVisionResults.lastPrice === 'number'){
        px = W.HG_chartVisionResults.lastPrice;
      }
      if (px != null && $('#ss-entry')){
        $('#ss-entry').value = px;
        update();
      }
    }catch(e){}
  });

  __ss.mounted = true;
  __ss.update = update;
  update();
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
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER SETUP',
  title: 'Super Setup',
  mount: mount,
  refresh: superSetupRefresh
});

})();
