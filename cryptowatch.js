/* =========================================================================
HARDGATE — cryptowatch.js
Crypto FORMING NOW watch panel — partial gate progress on SWING/SCALP
and saved COIL watchlists. Watch items are NOT entries. Pure evaluators +
HTML renderer; scans are orchestrated from index.html runScan().
========================================================================= */
'use strict';

var CW_CSS = ''
+ '#tab_swing .hgwatch,#tab_scalp .hgwatch,#tab_coil .hgwatch{margin:14px 0 18px;border:1px solid #E2E8F0;border-radius:10px;background:#F8FAFC;overflow:hidden}'
+ '#tab_swing .hgwatch-h,#tab_scalp .hgwatch-h,#tab_coil .hgwatch-h{font-size:10px;letter-spacing:.18em;font-weight:800;color:#475569;padding:10px 12px;border-bottom:1px solid #E2E8F0;background:#FFFFFF}'
+ '#tab_swing .hgwatch-h span,#tab_scalp .hgwatch-h span,#tab_coil .hgwatch-h span{font-weight:500;letter-spacing:.04em;color:#64748B}'
+ '#tab_swing .hgw-row,#tab_scalp .hgw-row,#tab_coil .hgw-row{font-size:11px;padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_swing .hgw-row:last-child,#tab_scalp .hgw-row:last-child,#tab_coil .hgw-row:last-child{border-bottom:0}'
+ '#tab_swing .hgw-row.armed,#tab_scalp .hgw-row.armed,#tab_coil .hgw-row.armed{background:rgba(5,150,105,.06);color:#020617;border-left:3px solid #059669}'
+ '#tab_swing .hgw-row.idle,#tab_scalp .hgw-row.idle,#tab_coil .hgw-row.idle{border-left:3px solid #E2E8F0}'
+ '#tab_swing .hgw-st,#tab_scalp .hgw-st,#tab_coil .hgw-st{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '#tab_swing .hgw-row.armed .hgw-st,#tab_scalp .hgw-row.armed .hgw-st,#tab_coil .hgw-row.armed .hgw-st{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '#tab_swing .hgw-row.idle .hgw-st,#tab_scalp .hgw-row.idle .hgw-st,#tab_coil .hgw-row.idle .hgw-st{color:#475569;border-color:#E2E8F0;background:#FFFFFF}'
+ '#tab_swing .hgw-row b,#tab_scalp .hgw-row b,#tab_coil .hgw-row b{font-weight:700;color:#020617}'
+ '.hgwatch-cross{font-size:10px;margin-top:6px;line-height:1.5;color:#334155}';

function cwEsc(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cwFmt(n, d){
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toFixed(d === undefined ? 2 : d);
}

function swingWatchEval(rows, ticker, opts){
  opts = opts || {};
  if (typeof swingGateMatrix !== 'function') return null;
  var m = swingGateMatrix(rows, ticker);
  if (!m) return null;
  if (m.clean) return null;
  if (!m.dir) return { state: 'idle', dir: null, strategy: 'SWING 4H', sym: ticker && ticker.symbol,
    reason: 'no aligned 4H EMA cascade (G1)', gatesPassed: 0, gatesTotal: 7, level: null,
    unconfirmed: !!opts.unconfirmed };
  var missing = m.gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
  if (m.passed >= 5){
    return { state: 'armed', dir: m.dir, strategy: 'SWING 4H · ' + m.dir.toUpperCase(), sym: ticker && ticker.symbol,
      condition: m.passed + '/7 gates pass — waiting: ' + missing.join(', '),
      gatesPassed: m.passed, gatesTotal: 7, level: m.level, unconfirmed: !!opts.unconfirmed };
  }
  return { state: 'idle', dir: m.dir, strategy: 'SWING 4H · ' + m.dir.toUpperCase(), sym: ticker && ticker.symbol,
    reason: m.passed + '/7 gates — need ≥5 to arm (' + missing.join(', ') + ')',
    gatesPassed: m.passed, gatesTotal: 7, level: m.level, unconfirmed: !!opts.unconfirmed };
}

function scalpWatchEval(h1, m15, ticker, minsToFunding, opts){
  opts = opts || {};
  if (typeof scalpGateMatrix !== 'function') return null;
  var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
  if (!m) return null;
  if (m.clean) return null;
  if (!m.dir) return { state: 'idle', dir: null, strategy: 'SCALP 15m', sym: ticker && ticker.symbol,
    reason: 'no 1H cascade (G1)', gatesPassed: 0, gatesTotal: 7, level: null, unconfirmed: !!opts.unconfirmed };
  var missing = m.gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
  if (m.passed >= 5){
    return { state: 'armed', dir: m.dir, strategy: 'SCALP 15m · ' + m.dir.toUpperCase(), sym: ticker && ticker.symbol,
      condition: m.passed + '/7 gates pass — waiting: ' + missing.join(', '),
      gatesPassed: m.passed, gatesTotal: 7, level: m.level, unconfirmed: !!opts.unconfirmed };
  }
  return { state: 'idle', dir: m.dir, strategy: 'SCALP 15m · ' + m.dir.toUpperCase(), sym: ticker && ticker.symbol,
    reason: m.passed + '/7 gates — need ≥5 to arm (' + missing.join(', ') + ')',
    gatesPassed: m.passed, gatesTotal: 7, level: m.level, unconfirmed: !!opts.unconfirmed };
}

function coilWatchItems(cw){
  if (!cw || !cw.list || !cw.list.length) return [];
  return cw.list.map(function(w){
    return { state: 'armed', dir: w.dir || 'long', strategy: 'COIL COMPRESSION', sym: w.symbol,
      condition: w.note || 'compression watch', gatesPassed: 5, gatesTotal: 7, level: w.level || null };
  });
}

function cryptoFormingNowHTML(items){
  items = items || [];
  if (!items.length){
    return '<div class="hgwatch"><div class="hgwatch-h">FORMING NOW <span>≥5/7 gates, not CLEAN — watch only</span></div>'
      + '<div class="hgw-row idle"><span class="hgw-st">IDLE</span> Run SCAN — armed rows appear when ≥5/7 gates pass but the setup is not CLEAN yet.</div></div>';
  }
  var armedN = items.filter(function(w){ return w && w.state === 'armed'; }).length;
  var rows = items.map(function(w){
    if (!w) return '';
    var st = w.state === 'armed';
    return '<div class="hgw-row ' + (st ? 'armed' : 'idle') + '">'
      + '<span class="hgw-st">' + (st ? 'ARMED' : 'IDLE') + '</span>'
      + (w.unconfirmed ? '<span class="hgw-st" style="color:#b45309;border-color:rgba(180,83,9,.45);background:rgba(251,191,36,.12)">UNCONFIRMED</span>' : '')
      + '<b>' + cwEsc(w.sym || '?') + '</b> · ' + cwEsc(w.strategy || '')
      + (w.condition ? ' — ' + cwEsc(w.condition) : (w.reason ? ' — ' + cwEsc(w.reason) : ''))
      + (w.level !== null && w.level !== undefined ? ' · ref ' + cwFmt(w.level) : '')
      + '</div>';
  }).join('');
  return '<div class="hgwatch"><div class="hgwatch-h">FORMING NOW <span>'
    + armedN + ' armed · watch items, not entries</span></div>' + rows + '</div>';
}

function cryptoWatchInjectStyles(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('hg-cryptowatch-css')) return;
  var s = document.createElement('style');
  s.id = 'hg-cryptowatch-css';
  s.textContent = CW_CSS;
  document.head.appendChild(s);
}

function cryptoNewsGate(sym){
  try{
    if (typeof hgNewsRisk === 'function'){
      var r = hgNewsRisk(sym || 'BTC');
      if (r && r.blackout) return { blackout: true, caution: true, note: r.note || 'news blackout' };
      if (r && (r.risk === 'high' || r.risk === 'med')) return { blackout: false, caution: true, note: r.note || '' };
    }
  }catch(e){}
  return { blackout: false, caution: false, note: '' };
}

function cryptoNewsBannerHTML(gate){
  if (!gate || !gate.caution) return '';
  var cls = gate.blackout ? 'warn' : 'note';
  var head = gate.blackout ? 'NEWS BLACKOUT' : 'CRYPTO NEWS';
  return '<div class="note ' + cls + '" style="margin-bottom:10px">' + head + ' — '
    + cwEsc(gate.note || (gate.blackout ? 'blackout active' : 'elevated event risk')) + '</div>';
}

if (typeof window !== 'undefined'){
  window.swingWatchEval = swingWatchEval;
  window.scalpWatchEval = scalpWatchEval;
  window.coilWatchItems = coilWatchItems;
  window.cryptoFormingNowHTML = cryptoFormingNowHTML;
  window.cryptoWatchInjectStyles = cryptoWatchInjectStyles;
  window.cryptoNewsGate = cryptoNewsGate;
  window.cryptoNewsBannerHTML = cryptoNewsBannerHTML;
}
