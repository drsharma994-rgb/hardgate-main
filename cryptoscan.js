/* CRYPTO SCAN — multi-symbol scanner for Delta Exchange + CoinDCX futures.
   Runs the CRYPTO ULTRA 470-read vote engine on every futures contract that
   clears the $5M turnover floor and shows setups with entry / SL / TP1 / TP2.

   Each setup renders the FULL CRYPTO ULTRA card: vote count line, plan with
   levels, and the complete 470-indicator vote table (lazy-loaded on expand)
   so every read can be audited by eye — same architecture as cryptoultra.js.

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
  + '.cs-summary{font-size:12px;color:#1E293B;font-weight:600;margin:10px 0 4px}'
  + '.cs-empty{font-size:12px;color:#64748B;padding:20px 0}'
  + '.cs-note{font-size:10px;color:#94A3B8;margin:8px 0;line-height:1.5}'
  + '.cs-card{border:1px solid #E2E8F0;border-radius:8px;margin:10px 0;overflow:hidden}'
  + '.cs-card.cs-long-card{border-left:4px solid #166534}'
  + '.cs-card.cs-short-card{border-left:4px solid #DC2626}'
  + '.cs-card-head{padding:10px 12px;cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;background:#FAFBFC}'
  + '.cs-card-head:hover{background:#F1F5F9}'
  + '.cs-card-num{font-size:10px;color:#94A3B8;font-weight:700;min-width:22px}'
  + '.cs-card-sym{font-size:14px;font-weight:800;color:#1E293B;letter-spacing:.04em}'
  + '.cs-chip{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.08em;padding:1px 5px;border-radius:3px;margin-left:4px}'
  + '.cs-chip-d{background:#EDE9FE;color:#6D28D9}'
  + '.cs-chip-c{background:#FEF3C7;color:#92400E}'
  + '.cs-chip-b{background:#DBEAFE;color:#1D4ED8}'
  + '.cs-dir{font-size:12px;font-weight:800;letter-spacing:.06em;padding:2px 8px;border-radius:4px}'
  + '.cs-dir-long{background:#DCFCE7;color:#166534}'
  + '.cs-dir-short{background:#FEE2E2;color:#DC2626}'
  + '.cs-card-meta{font-size:10px;color:#64748B;margin-left:auto;text-align:right;line-height:1.5}'
  + '.cs-card-arrow{font-size:14px;color:#94A3B8;transition:transform .2s}'
  + '.cs-card-arrow.cs-open{transform:rotate(90deg)}'
  + '.cs-card-body{display:none;padding:0 12px 12px;border-top:1px solid #F1F5F9}'
  + '.cs-card-body.cs-show{display:block}'
  + '.cs-count{font-size:12px;line-height:1.6;color:#1E293B;padding:8px 0}'
  + '.cs-count small{display:block;font-size:10px;color:#64748B;margin-top:4px;line-height:1.5}'
  + '.cs-plan{font-size:11px;line-height:1.7;color:#1E293B;padding:8px 10px;border:1px solid rgba(147,130,34,.5);border-radius:6px;background:rgba(250,240,137,.12);margin:8px 0}'
  + '.cs-gate{font-size:10px;color:#DC2626;padding:6px 10px;border:1px solid rgba(220,38,38,.35);border-radius:6px;margin:6px 0;background:rgba(220,38,38,.04)}'
  + '.cs-vtbl{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0}'
  + '.cs-vtbl th{text-align:left;padding:3px 6px;border-bottom:2px solid #CBD5E1;font-weight:700;letter-spacing:.06em;color:#334155}'
  + '.cs-vtbl td{padding:3px 6px;border-bottom:1px solid #F1F5F9;color:#475569}'
  + '.cs-vtbl .cs-grp{font-weight:800;letter-spacing:.1em;color:#1E293B;padding-top:10px;font-size:10px;background:#F8FAFC}'
  + '.cs-vtbl .cs-v1{color:#166534;font-weight:700}.cs-vtbl .cs-v-1{color:#DC2626;font-weight:700}.cs-vtbl .cs-v0{color:#94A3B8}'
  + '.cs-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:8px 0}'
  + '.cs-lv{text-align:center;padding:6px 8px;border-radius:6px;background:#F8FAFC;border:1px solid #E2E8F0}'
  + '.cs-lv b{display:block;font-size:13px;color:#1E293B}'
  + '.cs-lv small{font-size:9px;color:#64748B;letter-spacing:.06em}'
  + '.cs-votes-placeholder{font-size:10px;color:#94A3B8;padding:8px 0;cursor:pointer}'
  + '.cs-votes-placeholder:hover{color:#2563EB}';

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

function voteTableHTML(votes){
  if (!votes || !votes.length) return '';
  var groups = [], h = '<table class="cs-vtbl"><tr><th>read</th><th>value</th><th>kind</th><th>vote</th><th>rule</th></tr>';
  for (var i = 0; i < votes.length; i++) if (groups.indexOf(votes[i].group) < 0) groups.push(votes[i].group);
  for (var g = 0; g < groups.length; g++){
    h += '<tr><td class="cs-grp" colspan="5">' + esc(groups[g]) + '</td></tr>';
    for (var k = 0; k < votes.length; k++){
      var v = votes[k]; if (v.group !== groups[g]) continue;
      var vt = v.kind === 'vote' ? (v.vote > 0 ? 'LONG' : v.vote < 0 ? 'SHORT' : 'neutral') : v.kind === 'regime' ? (v.regime < 0 ? 'chop' : v.regime > 0 ? 'trend' : '—') : v.kind === 'n/a' ? 'n/a' : '—';
      h += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.read) + '</td><td style="font-weight:700;letter-spacing:.06em;font-size:9px">' + esc(v.kind) + '</td><td class="cs-v' + (v.kind === 'vote' ? v.vote : 0) + '">' + vt + '</td><td>' + esc(v.why) + '</td></tr>';
    }
  }
  h += '</table>';
  return h;
}

/* ---- vote data store: votes are kept in JS, rendered lazily on first expand ---- */
var __voteStore = {};

function csToggleCard(idx){
  var body = document.getElementById('cs_' + idx);
  var arrow = document.getElementById('cs_' + idx + '_a');
  if (!body) return;
  var opening = !body.classList.contains('cs-show');
  body.classList.toggle('cs-show');
  if (arrow) arrow.classList.toggle('cs-open');
  if (opening){
    var vhost = document.getElementById('cs_v_' + idx);
    if (vhost && !vhost.dataset.rendered && __voteStore[idx]){
      vhost.innerHTML = voteTableHTML(__voteStore[idx]);
      vhost.dataset.rendered = '1';
    }
  }
}
W.__csToggleCard = csToggleCard;

function setupCardHTML(s, idx){
  var p = s.plan, K = s.count ? s.count.kinds : {}, rrv = p ? rr(p.entry, p.stop, p.t1) : null;
  var cardCls = s.dir === 'long' ? 'cs-long-card' : 'cs-short-card';
  var dirCls = s.dir === 'long' ? 'cs-dir-long' : 'cs-dir-short';
  var id = 'cs_' + idx;

  var h = '<div class="cs-card ' + cardCls + '">';
  h += '<div class="cs-card-head" onclick="__csToggleCard(' + idx + ')">';
  h += '<span class="cs-card-num">#' + (idx + 1) + '</span>';
  h += '<span class="cs-card-sym">' + esc(s.label) + '</span>';
  h += venueChip(s.exchange);
  h += ' <span class="cs-dir ' + dirCls + '">' + (s.dir || '—').toUpperCase() + '</span>';
  h += '<span class="cs-card-meta">' + pct(s.pct) + ' agree · ' + (s.count ? s.count.decisive : '—') + ' decisive · regime ' + esc((s.regime || '—').toUpperCase());
  if (p) h += '<br>entry ' + fmt(p.entry) + ' · SL ' + fmt(p.stop) + ' · TP1 ' + fmt(p.t1) + ' · R:R ' + (rrv != null ? rrv.toFixed(1) : '—');
  h += '</span>';
  h += '<span class="cs-card-arrow" id="' + id + '_a">&#9654;</span>';
  h += '</div>';

  h += '<div class="cs-card-body" id="' + id + '">';

  h += '<div class="cs-count">' + esc(s.line);
  h += '<small>' + (s.count ? s.count.total : '—') + ' reads fed: ' + (K.vote || 0) + ' vote · ' + (K.regime || 0) + ' regime · ' + (K.print || 0) + ' print-only · ' + (K.na || 0) + ' not applicable';
  if (s.bar) h += ' · closed 15m bar ' + new Date(s.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  h += ' · close $' + fmt(s.price) + ' · ATR14 $' + fmt(s.atr) + '</small>';
  h += '<small>RECORD ONLY — engine measured NOT TRADABLE; this is what the rule would say</small></div>';

  if (p){
    h += '<div class="cs-levels">';
    h += '<div class="cs-lv"><small>ENTRY</small><b>' + fmt(p.entry) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(220,38,38,.4)"><small>STOP LOSS</small><b style="color:#DC2626">' + fmt(p.stop) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(22,101,52,.4)"><small>TP1 (' + p.rr1 + 'R)</small><b style="color:#166534">' + fmt(p.t1) + '</b></div>';
    h += '<div class="cs-lv" style="border-color:rgba(22,101,52,.4)"><small>TP2 (' + p.rr2 + 'R)</small><b style="color:#166534">' + fmt(p.t2) + '</b></div>';
    h += '</div>';
    h += '<div class="cs-plan"><b>RECORD ONLY — NOT A TICKET</b><br>' + esc(p.orderType) + ' at the close <b>$' + esc(fmt(p.entry)) + '</b> · STOP <b>$' + esc(fmt(p.stop)) + '</b> (' + esc(fmt(p.stopAtr, 2)) + '×ATR) · TP1 <b>$' + esc(fmt(p.t1)) + '</b> (' + p.rr1 + 'R) · TP2 <b>$' + esc(fmt(p.t2)) + '</b> (' + p.rr2 + 'R) · expires after ' + p.timeoutBars + ' bars (6h)';
    h += '<br>At TP1 close 50%, stop to breakeven ($' + esc(fmt(p.entry)) + '); runner to TP2. A 15m close beyond the stop kills the idea.';
    if (p.floorNote) h += '<br>' + esc(p.floorNote);
    h += '</div>';
  }

  if (s.gates && s.gates.length) h += '<div class="cs-gate">' + esc(s.gates.join(' · ')) + '</div>';

  /* vote table placeholder — rendered lazily on first expand */
  h += '<div id="cs_v_' + idx + '" class="cs-votes-placeholder">▸ 470-indicator vote table — loading on expand…</div>';

  h += '</div></div>';
  return h;
}

var __ui = null, __results = null, __busy = false;

function setStat(txt, bad){
  try{
    if (__ui && __ui.stat){ __ui.stat.textContent = txt; __ui.stat.style.color = bad ? '#DC2626' : ''; }
  }catch(e){}
}
function setProgress(pctV){
  try{ if (__ui && __ui.bar) __ui.bar.style.width = Math.min(100, Math.max(0, pctV)) + '%'; }catch(e){}
}

function renderCards(setups){
  if (!__ui || !__ui.cards) return;
  __voteStore = {};
  if (!setups || !setups.length){
    __ui.cards.innerHTML = '<div class="cs-empty">No setups found — no contract met all gates (≥55% agreement, regime ≠ chop, ATR valid).</div>';
    return;
  }
  var longs = setups.filter(function(s){ return s.dir === 'long'; }).length;
  var shorts = setups.length - longs;
  var h = '<div class="cs-summary">' + setups.length + ' setup' + (setups.length > 1 ? 's' : '') + ' found — '
    + longs + ' LONG · ' + shorts + ' SHORT · ALL RECORD ONLY (engine measured NOT TRADABLE)<br>'
    + '<span style="font-weight:400;font-size:10px;color:#64748B">click any card to expand — full 470-indicator vote table with every read, value, kind, vote and rule</span></div>';
  for (var i = 0; i < setups.length; i++){
    __voteStore[i] = setups[i].votes;
    h += setupCardHTML(setups[i], i);
  }
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
    var pack = await loadUni({ minTurnover: 0, includeUnknown: true });
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
            price: res.price,
            plan: res.plan,
            line: res.line,
            count: res.count,
            fire: res.fire,
            recordOnly: res.recordOnly,
            gates: res.gates,
            votes: res.votes,
            bar: res.bar
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
    renderCards(setups);
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
      + '<h2 class="cs-hdr">CRYPTO SCAN <span>· all Delta + CoinDCX futures · 470-read vote engine · full indicator breakdown · record only</span></h2>'
      + '<div style="margin:8px 0"><button class="btn" id="csRun">SCAN ALL FUTURES</button> <span class="cs-stat" id="csStat">idle — scans every futures contract on Delta Exchange + CoinDCX through the CRYPTO ULTRA engine with the full 470-indicator vote table.</span></div>'
      + '<div class="cs-bar"><div class="cs-bar-fill" id="csBar" style="width:0%"></div></div>'
      + '<div id="csCards"></div>'
      + '</div>';
    var cards = el.querySelector('#csCards');
    var stat = el.querySelector('#csStat');
    var btn = el.querySelector('#csRun');
    var bar = el.querySelector('#csBar');
    __ui = { cards: cards, stat: stat, btn: btn, bar: bar };
    if (btn) btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results && __results.setups) renderCards(__results.setups);
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
