/* HARDGATE — RISK tab: full crypto position-sizing worksheet (Pack 18). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'risk';

function $(root, id){ return root.querySelector(id); }
function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
function fmt(n, d){
  d = d === undefined ? 2 : d;
  return isFinite(n) ? n.toFixed(d) : '—';
}

function readForm(root){
  return {
    balance: num($(root, '#rk-balance') && $(root, '#rk-balance').value),
    riskPct: num($(root, '#rk-risk') && $(root, '#rk-risk').value),
    mmr: num($(root, '#rk-mmr') && $(root, '#rk-mmr').value) / 100,
    sym: ($(root, '#rk-sym') && $(root, '#rk-sym').value) || '',
    dir: ($(root, '#rk-dir') && $(root, '#rk-dir').value) || 'long',
    entry: num($(root, '#rk-entry') && $(root, '#rk-entry').value),
    stop: num($(root, '#rk-stop') && $(root, '#rk-stop').value),
    t1: num($(root, '#rk-t1') && $(root, '#rk-t1').value),
    style: ($(root, '#rk-style') && $(root, '#rk-style').value) || 'swing'
  };
}

function paintWorksheet(root, risk){
  var out = $(root, '#rk-out');
  if (!out) return;
  if (!risk || risk.ok === false){
    out.innerHTML = '<div class="empty">' + (risk && risk.reason ? risk.reason : 'Fill entry, stop, balance, risk %') + '</div>';
    return;
  }
  var passCls = risk.pass ? 'ok' : 'bad';
  var lotLine = '—';
  if (risk.sym && typeof G.hgQtyToContracts === 'function'){
    try{
      if (typeof G.hgEnsureContractSpecs === 'function') G.hgEnsureContractSpecs();
      var lots = G.hgQtyToContracts(risk.sym, risk.positionSizeUnits);
      if (lots) lotLine = lots.lots + ' contracts (' + fmt(lots.coinActual, 6) + ' ' + (lots.unit || 'coin') + ')';
    }catch(e){}
  }
  out.innerHTML = [
    '<div class="verdict ' + passCls + '"><div class="vword">' + (risk.pass ? 'RISK PASS' : 'RISK HOLD') + '</div>',
    '<div class="vwhy">' + (risk.pass ? 'Sizing, liq clearance, and net-R clear the bar.' : ((risk.reasons || []).join(' · ') || 'Check worksheet')) + '</div></div>',
    '<div class="mini">',
    '<span class="k">Risk $</span><span>$' + fmt(risk.riskAmountUSD, 2) + '</span>',
    '<span class="k">Qty (coin)</span><span>' + fmt(risk.positionSizeUnits, 6) + '</span>',
    '<span class="k">Delta lots</span><span>' + lotLine + '</span>',
    '<span class="k">Notional</span><span>$' + fmt(risk.notionalUSD, 2) + '</span>',
    '<span class="k">Implied lev</span><span><b>' + fmt(risk.impliedLeverage, 2) + 'x</b> (derived)</span>',
    '<span class="k">Ceiling lev</span><span>' + (risk.ceilingLeverage != null ? risk.ceilingLeverage + 'x' : '—') + ' (max survivable)</span>',
    '<span class="k">Liq price</span><span>' + (risk.liqPrice != null ? fmt(risk.liqPrice, risk.liqPrice > 100 ? 2 : 4) : '—') + ' <span class="note">approx — verify in Delta</span></span>',
    '<span class="k">Liq clearance</span><span>' + (risk.liqClearance != null ? fmt(risk.liqClearance, 2) + '× stop' : '—') + '</span>',
    '<span class="k">Gross R @ T1</span><span>' + (risk.grossR != null ? fmt(risk.grossR, 2) + 'R' : '—') + '</span>',
    '<span class="k">Fee drag</span><span>' + fmt(risk.costR, 3) + 'R round trip</span>',
    '<span class="k">Net R @ T1</span><span><b>' + (risk.netR != null ? fmt(risk.netR, 2) + 'R' : '—') + '</b></span>',
    '<span class="k">Breakeven win</span><span>' + (risk.breakevenWinRate != null ? fmt(risk.breakevenWinRate * 100, 1) + '%' : '—') + '</span>',
    '<span class="k">Your ledger</span><span>' + (risk.measuredWinRate != null ? fmt(risk.measuredWinRate * 100, 1) + '% on symbol' : 'thin / n/a') + '</span>',
    '</div>',
    '<div class="note" style="margin-top:10px">Leverage is an <b>output</b> of risk-first sizing, not a dial. Trading above the ceiling means liquidation can arrive before your stop. Delta BTCUSD MMR default 0.5% — adjust if your tier differs.</div>'
  ].join('');
}

function recalc(root){
  if (typeof G.hgCryptoPositionRisk !== 'function'){
    paintWorksheet(root, { ok: false, reason: 'crypto-position-risk.js not loaded' });
    return;
  }
  var f = readForm(root);
  if (!(f.balance > 0 && f.riskPct > 0 && f.entry > 0 && f.stop > 0)){
    paintWorksheet(root, { ok: false, reason: 'Fill balance, risk %, entry, stop' });
    return;
  }
  var risk = G.hgCryptoPositionRisk({
    sym: f.sym, dir: f.dir, entry: f.entry, stop: f.stop, t1: f.t1, style: f.style
  }, { balance: f.balance, riskPct: f.riskPct, mmr: f.mmr });
  paintWorksheet(root, risk);
}

function pullFromTradePlan(root){
  try{
    var tSym = G.document && G.document.getElementById('tSym');
    var tSide = G.document.getElementById('tSide');
    var tEntry = G.document.getElementById('tEntry');
    var tStop = G.document.getElementById('tStop');
    var tT1 = G.document.getElementById('tT1');
    var tEq = G.document.getElementById('tEq');
    var tRisk = G.document.getElementById('tRisk');
    var tMmr = G.document.getElementById('tMmr');
    if (tSym && tSym.value) $(root, '#rk-sym').value = tSym.value;
    if (tSide && tSide.value) $(root, '#rk-dir').value = tSide.value;
    if (tEntry && tEntry.value) $(root, '#rk-entry').value = tEntry.value;
    if (tStop && tStop.value) $(root, '#rk-stop').value = tStop.value;
    if (tT1 && tT1.value) $(root, '#rk-t1').value = tT1.value;
    if (tEq && tEq.value) $(root, '#rk-balance').value = tEq.value;
    if (tRisk && tRisk.value) $(root, '#rk-risk').value = tRisk.value;
    if (tMmr && tMmr.value) $(root, '#rk-mmr').value = tMmr.value;
    recalc(root);
  }catch(e){}
}

function mount(el){
  if (!el) return;
  el.innerHTML = [
    '<section class="hg-tab hg-risk-tab">',
    '  <div class="hg-title">Risk Worksheet</div>',
    '  <div class="note">Pack 18 — risk-first sizing for crypto perps. Qty = risk$ ÷ stop distance. Implied leverage falls out; ceiling is max survivable only.</div>',
    '  <div class="grid2" style="margin-top:12px">',
    '    <div class="card"><h3>Inputs</h3>',
    '      <div class="formrow"><label>Symbol</label><input id="rk-sym" placeholder="BTCUSD" /></div>',
    '      <div class="formrow"><label>Direction</label><select id="rk-dir"><option value="long">Long</option><option value="short">Short</option></select></div>',
    '      <div class="formrow"><label>Style</label><select id="rk-style"><option value="swing">Swing</option><option value="scalp">Scalp</option></select></div>',
    '      <div class="formrow"><label>Balance $</label><input id="rk-balance" type="number" value="1000" step="0.01" /></div>',
    '      <div class="formrow"><label>Risk %</label><input id="rk-risk" type="number" value="1" step="0.01" /></div>',
    '      <div class="formrow"><label>MMR %</label><input id="rk-mmr" type="number" value="0.5" step="0.01" title="Maintenance margin — Delta BTCUSD default 0.5%" /></div>',
    '      <div class="formrow"><label>Entry</label><input id="rk-entry" type="number" step="any" /></div>',
    '      <div class="formrow"><label>Stop</label><input id="rk-stop" type="number" step="any" /></div>',
    '      <div class="formrow"><label>T1</label><input id="rk-t1" type="number" step="any" /></div>',
    '      <div class="actions" style="margin-top:10px">',
    '        <button type="button" class="btn primary" id="rk-calc">Calculate</button>',
    '        <button type="button" class="btn ghost" id="rk-from-trade">Pull from Trade Plan</button>',
    '      </div>',
    '    </div>',
    '    <div class="card"><h3>Worksheet</h3><div id="rk-out"><div class="empty">Enter levels and hit Calculate.</div></div></div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-risk-tab') || el;
  var calcBtn = $(root, '#rk-calc');
  if (calcBtn) calcBtn.addEventListener('click', function(){ recalc(root); });
  var pullBtn = $(root, '#rk-from-trade');
  if (pullBtn) pullBtn.addEventListener('click', function(){ pullFromTradePlan(root); });
  ['#rk-balance', '#rk-risk', '#rk-mmr', '#rk-entry', '#rk-stop', '#rk-t1'].forEach(function(sel){
    var inp = $(root, sel);
    if (inp) inp.addEventListener('change', function(){ recalc(root); });
  });
  pullFromTradePlan(root);
}

function refresh(){
  return 'ok';
}

G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: TAB_ID, label: 'RISK', title: 'Risk Worksheet', mount: mount, refresh: refresh });

})();
