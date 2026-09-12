/* CRYPTO SCAN — multi-symbol scanner for Delta Exchange + CoinDCX futures.
   Runs the CRYPTO ULTRA 470-read vote engine on every futures contract that
   clears the $5M turnover floor and shows setups with entry / SL / TP1 / TP2.

   Depends: desk-scan-universe.js (universe + kline fetch), cryptoultra.js
   (cryptoUltraEngine). Both must load before this file.

   ALL SETUPS ARE RECORD ONLY — the engine is measured NOT TRADABLE on BTCUSDT
   and has never been backtested on any other symbol. These are what the 470-read
   vote rule WOULD say, printed for the record so the count can be audited.     */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'cryptoscan';
var KL_15M = 320, KL_1H = 400;

var VENUE_COSTS = {
  delta:   { venue: 'Delta',   rtFrac: 0.0015 },
  coindcx: { venue: 'CoinDCX', rtFrac: 0.002  },
  cdcx:    { venue: 'CoinDCX', rtFrac: 0.002  },
  binance: { venue: 'Binance', rtFrac: 0.002  }
};

function costFor(item){
  var ex = item && item.exchange ? String(item.exchange).toLowerCase() : 'binance';
  return VENUE_COSTS[ex] || VENUE_COSTS.binance;
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n, d){ if (n == null || !isFinite(+n)) return '—'; d = d != null ? d : (Math.abs(+n) >= 100 ? 2 : Math.abs(+n) >= 1 ? 4 : 6); return (+n).toFixed(d); }
function pct(n){ return n != null && isFinite(+n) ? Math.round(+n * 100) + '%' : '—'; }

var CS_CSS = ''
  + '.cs-wrap{padding:10px;font-family:system-ui,-apple-system,sans-serif}'
  + '.cs-hdr{margin:0 0 6px;font-size:15px;font-weight:800;letter-spacing:.05em;color:#1E293B}'
  + '.cs-hdr span{font-weight:400;font-size:11px;color:#64748B;letter-spacing:0}'
  + '.cs-stat{font-size:11px;color:#64748B;margin:4px 0 8px}'
  + '.cs-bar{width:100%;height:4px;background:#E2E8F0;border-radius:2px;margin:6px 0 10px;overflow:hidden}'
  + '.cs-bar-fill{height:100%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:2px;transition:width .3s}'
  + '.cs-tbl{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0}'
  + '.cs-tbl th{text-align:left;padding:4px 6px;border-bottom:2px solid #CBD5E1;font-weight:700;letter-spacing:.06em;color:#334155;font-size:10px}'
  + '.cs-tbl td{padding:4px 6px;border-bottom:1px solid #F1F5F9;color:#475569}'
  + '.cs-tbl tr:hover td{background:rgba(37,99,235,.04)}'
  + '.cs-long{color:#166534;font-weight:700}'
  + '.cs-short{color:#DC2626;font-weight:700}'
  + '.cs-chip{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.08em;padding:1px 5px;border-radius:3px;margin-left:4px}'
  + '.cs-chip-d{background:#EDE9FE;color:#6D28D9}'
  + '.cs-chip-c{background:#FEF3C7;color:#92400E}'
  + '.cs-chip-b{background:#DBEAFE;color:#1D4ED8}'
  + '.cs-note{font-size:10px;color:#94A3B8;margin:8px 0;line-height:1.5}'
  + '.cs-count{font-size:12px;color:#1E293B;font-weight:600;margin:10px 0 4px}'
  + '.cs-empty{font-size:12px;color:#64748B;padding:20px 0}';

function venueChip(ex){
  var e = String(ex || '').toLowerCase();
  if (e === 'delta') return '<span class="cs-chip cs-chip-d">DELTA</span>';
  if (e === 'coindcx' || e === 'cdcx') return '<span class="cs-chip cs-chip-c">COINDCX</span>';
  if (e === 'binance') return '<span class="cs-chip cs-chip-b">BINANCE</span>';
  return '';
}

function symLabel(item){
  if (!item) return '—';
  if (item.base) return item.base;
  var s = String(item.sym || '');
  return s.replace(/USDT?$/, '').replace(/^B-/, '').replace(/_USDT$/, '');
}

function rr(entry, stop, t1){
  if (!isFinite(+entry) || !isFinite(+stop) || !isFinite(+t1) || +entry === +stop) return null;
  var risk = Math.abs(+entry - +stop), reward = Math.abs(+t1 - +entry);
  return risk > 0 ? +(reward / risk).toFixed(2) : null;
}

var __ui = null, __results = null, __busy = false;

function setStat(txt, bad){
  try{
    if (__ui && __ui.stat){ __ui.stat.textContent = txt; __ui.stat.style.color = bad ? '#DC2626' : ''; }
  }catch(e){}
}
function setProgress(pct){
  try{ if (__ui && __ui.bar) __ui.bar.style.width = Math.min(100, Math.max(0, pct)) + '%'; }catch(e){}
}

function renderTable(setups){
  if (!__ui || !__ui.cards) return;
  if (!setups || !setups.length){
    __ui.cards.innerHTML = '<div class="cs-empty">No setups found — no contract met all gates (≥55% agreement, regime ≠ chop, ATR valid).</div>';
    return;
  }
  var longs = setups.filter(function(s){ return s.dir === 'long'; }).length;
  var shorts = setups.length - longs;
  var h = '<div class="cs-count">' + setups.length + ' setup' + (setups.length > 1 ? 's' : '') + ' found — '
    + longs + ' LONG · ' + shorts + ' SHORT · ALL RECORD ONLY (engine measured NOT TRADABLE)</div>';
  h += '<table class="cs-tbl"><thead><tr>'
    + '<th>#</th><th>symbol</th><th>venue</th><th>dir</th><th>agree</th><th>regime</th>'
    + '<th>entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>R:R</th><th>ATR</th></tr></thead><tbody>';
  for (var i = 0; i < setups.length; i++){
    var s = setups[i], p = s.plan;
    var rrv = p ? rr(p.entry, p.stop, p.t1) : null;
    h += '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td><b>' + esc(s.label) + '</b></td>'
      + '<td>' + venueChip(s.exchange) + '</td>'
      + '<td class="' + (s.dir === 'long' ? 'cs-long' : 'cs-short') + '">' + (s.dir || '—').toUpperCase() + '</td>'
      + '<td>' + pct(s.pct) + '</td>'
      + '<td>' + esc(s.regime || '—') + '</td>'
      + '<td class="hg-num">' + (p ? fmt(p.entry) : '—') + '</td>'
      + '<td class="hg-num">' + (p ? fmt(p.stop) : '—') + '</td>'
      + '<td class="hg-num">' + (p ? fmt(p.t1) : '—') + '</td>'
      + '<td class="hg-num">' + (p ? fmt(p.t2) : '—') + '</td>'
      + '<td class="hg-num">' + (rrv != null ? rrv.toFixed(1) : '—') + '</td>'
      + '<td class="hg-num">' + fmt(s.atr) + '</td>'
      + '</tr>';
  }
  h += '</tbody></table>';
  h += '<div class="cs-note">ALL SETUPS ARE RECORD ONLY — the 470-read vote engine was backtested on BTCUSDT 15m and measured NOT TRADABLE '
    + '(all OOS trades timed out from cost floor). It has never been backtested on any other symbol. '
    + 'These are what the rule WOULD say, printed for the record. No win rates claimed. No invented thresholds.</div>';
  __ui.cards.innerHTML = h;
}

async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  var engine = W.cryptoUltraEngine;
  if (typeof engine !== 'function'){
    setStat('cryptoUltraEngine not loaded — load the CRYPTO ULTRA tab first', true);
    __busy = false;
    return 'error: engine missing';
  }
  var loadUni = W.hgDeskLoadDeltaCoinDCX || W.hgDeskLoadUniverse;
  var fetchKl = W.hgDeskFetchKlines;
  if (typeof loadUni !== 'function' || typeof fetchKl !== 'function'){
    setStat('desk-scan-universe.js not loaded — universe helpers missing', true);
    __busy = false;
    return 'error: universe missing';
  }
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat('loading universe (Delta + CoinDCX futures)…');
    setProgress(0);
    var pack = await loadUni({ minTurnover: 5e6 });
    var items = pack.items || [];
    if (!items.length){ setStat('universe empty — no contracts above $5M turnover', true); return 'error: empty universe'; }
    var vc = pack.venueCounts || {};
    setStat('scanning ' + items.length + ' contracts (Delta ' + (vc.delta || 0) + ' · CoinDCX ' + (vc.coindcx || 0) + ')…');

    var setups = [], scanned = 0, errors = 0, skipped = 0;
    var now = Date.now();

    for (var i = 0; i < items.length; i++){
      var item = items[i];
      try{
        var rows15m = await fetchKl(item, '15m', KL_15M);
        if (!rows15m || rows15m.length < 230){ skipped++; scanned++; setProgress((scanned / items.length) * 100); continue; }
        var rows1h = await fetchKl(item, '1h', KL_1H);

        var res = engine({ rows15m: rows15m, rows1h: rows1h || [], now: now, venueCost: costFor(item), allowUnverified: true });
        scanned++;
        setProgress((scanned / items.length) * 100);

        if (res.ok && res.dir && res.plan){
          setups.push({
            item: item,
            label: symLabel(item),
            sym: item.sym,
            exchange: item.exchange,
            dir: res.dir,
            pct: res.count ? res.count.pct : null,
            regime: res.regime,
            atr: res.atr,
            plan: res.plan,
            line: res.line,
            count: res.count,
            fire: res.fire,
            recordOnly: res.recordOnly,
            gates: res.gates
          });
        }

        if (scanned % 5 === 0){
          setStat('scanned ' + scanned + '/' + items.length + ' · ' + setups.length + ' setup(s) so far…');
        }
      }catch(e){
        errors++;
        scanned++;
        setProgress((scanned / items.length) * 100);
      }
    }

    setups.sort(function(a, b){
      var pa = a.pct || 0, pb = b.pct || 0;
      return pb - pa;
    });

    __results = { at: now, setups: setups, scanned: scanned, errors: errors, skipped: skipped, universe: items.length };
    renderTable(setups);
    setStat(setups.length + ' setup(s) from ' + scanned + ' scanned · ' + skipped + ' skipped (too few bars) · ' + errors + ' errors · ' + new Date().toISOString().slice(11, 19) + ' UTC', false);
    setProgress(100);
    return 'refreshed';
  }catch(e){
    setStat('scan failed: ' + ((e && e.message) || e), true);
    return 'error: ' + ((e && e.message) || e);
  }finally{
    __busy = false;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + CS_CSS + '</style>'
      + '<div class="cs-wrap">'
      + '<h2 class="cs-hdr">CRYPTO SCAN <span>· all Delta + CoinDCX futures · 470-read vote engine · record only</span></h2>'
      + '<div style="margin:8px 0"><button class="btn" id="csRun">SCAN ALL FUTURES</button> <span class="cs-stat" id="csStat">idle — scans every futures contract above $5M turnover through the CRYPTO ULTRA engine.</span></div>'
      + '<div class="cs-bar"><div class="cs-bar-fill" id="csBar" style="width:0%"></div></div>'
      + '<div id="csCards"></div>'
      + '</div>';
    var cards = el.querySelector('#csCards');
    var stat = el.querySelector('#csStat');
    var btn = el.querySelector('#csRun');
    var bar = el.querySelector('#csBar');
    __ui = { cards: cards, stat: stat, btn: btn, bar: bar };
    if (btn) btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results && __results.setups) renderTable(__results.setups);
  }catch(e){}
}

function refresh(){
  return runScan(__ui);
}

function cryptoScanState(){
  return __results || null;
}

W.cryptoScanState = cryptoScanState;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CRYPTO SCAN', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'CRYPTO SCAN', run: async function(){ if (!__ui) return 'unavailable: not mounted'; return runScan(__ui); } });

})();
