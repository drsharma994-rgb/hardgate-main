/* HARDGATE — super-sniper.js
   SUPER SNIPER tab: conviction desk over REVERSAL SNIPER limit board (Pack 18 sizing). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-sniper';
var SYNC_MS = 2500;
var SCAN_INTERVAL_MS = 15 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 5 * 60 * 1000;
var MIN_CONVICTION = 4;
var __hgSuperSniperSnap = null;
var __sn = {
  mounted: false, syncTimer: null, scanTimer: null, root: null,
  selectedId: null, scanBusy: false, lastScanAt: 0, selectedHit: null
};

function N(v){ return Number(v); }
function fmt(n, d){ return (typeof W.hgSuperDeskFmt === 'function') ? W.hgSuperDeskFmt(n, d) : String(n); }

function isFreshAt(at, maxMs){
  maxMs = maxMs || SNAP_MAX_MS;
  return !!(at && (Date.now() - at) < maxMs);
}

function defaultRiskOpts(win){
  win = win || W;
  return {
    balance: N(win.__snDefaultBalance != null ? win.__snDefaultBalance : 1000),
    riskPct: N(win.__snDefaultRiskPct != null ? win.__snDefaultRiskPct : 1)
  };
}

function superSniperDeskPill(row){
  if (!row) return { cls: 'block', label: 'BLOCKED' };
  if (row.minimalLossPass) return { cls: 'minloss', label: 'SNIPER PASS' };
  if (row.sniperPass) return { cls: 'clean', label: 'SIZE OK' };
  if (row.conviction >= MIN_CONVICTION) return { cls: 'watch', label: 'WATCH' };
  return { cls: 'block', label: 'LOW CONV' };
}

function enrichSuperSniperRow(c, riskOpts){
  if (!c || !c.dir || !(N(c.entry) > 0 && N(c.stop) > 0)) return null;
  var hit = Object.assign({}, c);
  hit.id = hit.id || ['rs', hit.sym, hit.entry, hit.stop].join('|');
  hit.tier = 'clean';
  hit.scanner = 'reversalsniper';
  hit.tp = N(hit.t1);
  hit.rr = N(hit.rr) || 2;

  if (typeof W.rsMaxSafeLev === 'function'){
    try{
      hit.safeMaxLev = W.rsMaxSafeLev(hit.entry, hit.stop);
    }catch(e0){}
  }

  if (typeof W.hgCryptoAttachPositionSize === 'function'){
    try{
      W.hgCryptoAttachPositionSize(hit, riskOpts.balance, riskOpts.riskPct, { style: 'scalp' });
    }catch(e1){}
  }

  var risk = hit.positionRisk;
  hit.sizingPass = !!(hit.positionSize && hit.positionRisk && hit.positionRisk.pass !== false
    && hit.positionSize.positionSizeUnits > 0);
  hit.sniperPass = hit.sizingPass && N(hit.conviction) >= MIN_CONVICTION;
  hit.minimalLossPass = hit.sniperPass && N(hit.lev) >= 30;
  hit.riskReason = hit.minimalLossPass ? 'PASS'
    : (hit.sniperPass ? 'Conviction OK — check lev clearance' : 'Pack 18 or conviction block');

  return hit;
}

function buildSnapFromRsScan(win, riskOpts, opts){
  win = win || W;
  riskOpts = riskOpts || defaultRiskOpts(win);
  opts = opts || {};
  var allowStale = opts.allowStale === true;
  var merged = [], scanned = 0, audit = { clean: 0, minLoss: 0 };

  var rsFn = win.reversalSniperScan;
  if (typeof rsFn !== 'function'){
    return { at: Date.now(), cands: [], audit: audit, stat: '0 setups — run REVERSAL SNIPER scan' };
  }
  var snap = null;
  try{ snap = rsFn(); }catch(e0){}
  if (!snap || !Array.isArray(snap.cands)){
    return { at: Date.now(), cands: [], audit: audit, stat: '0 setups — open REVERSAL SNIPER and scan' };
  }
  if (!allowStale && !isFreshAt(snap.at, SNAP_MAX_MS)){
    return { at: snap.at || 0, cands: [], audit: audit, stat: '0 setups — sniper snap stale' };
  }
  scanned = snap.at || Date.now();
  snap.cands.forEach(function(c){
    if (N(c.conviction) < MIN_CONVICTION) return;
    var row = enrichSuperSniperRow(c, riskOpts);
    if (row){
      merged.push(row);
      audit.clean++;
      if (row.minimalLossPass) audit.minLoss++;
    }
  });
  merged.sort(function(a, b){
    var am = a.minimalLossPass ? 1 : 0, bm = b.minimalLossPass ? 1 : 0;
    if (bm !== am) return bm - am;
    return (N(b.conviction) || 0) - (N(a.conviction) || 0);
  });
  return {
    at: scanned,
    cands: merged,
    audit: audit,
    stat: merged.length
      ? (merged.length + ' SNIPER · ' + audit.minLoss + ' trade-ready · ≥' + MIN_CONVICTION + ' conviction')
      : (snap.stat || '0 sniper setups')
  };
}

function publishSuperSniperSnap(snap){
  __hgSuperSniperSnap = snap || null;
  try{ W.HG_superSniperScan = snap; }catch(e){}
  return snap;
}

function superSniperScan(){ return __hgSuperSniperSnap; }

function syncDeskFromExisting(win, riskOpts){
  var snap = buildSnapFromRsScan(win, riskOpts, { allowStale: true });
  snap.scanAt = __sn.lastScanAt || snap.at || Date.now();
  snap.hydrated = true;
  publishSuperSniperSnap(snap);
  return snap;
}

function hitToEvaluation(hit){
  if (!hit || !(N(hit.entry) > 0 && N(hit.stop) > 0)){
    return { ready: false, idle: true, reason: 'No SUPER SNIPER setup on desk' };
  }
  return {
    ready: true, idle: false,
    side: 'Long',
    sym: hit.sym,
    entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2, rr: hit.rr,
    minimalLossPass: hit.minimalLossPass,
    setupType: 'SNIPER · conv ' + (hit.conviction || '—'),
    note: (hit.minimalLossPass ? 'SNIPER PASS · ' : 'SNIPER · ')
      + hit.sym + ' · conv ' + hit.conviction + ' · max-safe ' + (hit.lev || hit.safeMaxLev || '—') + '×',
    hit: hit
  };
}

async function superSniperRunScanInner(opts){
  opts = opts || {};
  __sn.scanBusy = true;
  try{
    if (typeof W.rsRunScan === 'function'){
      await W.rsRunScan({ quiet: true });
    } else {
      var mod = (W.HG_TAB_MODS && W.HG_TAB_MODS.reversalsniper) ? W.HG_TAB_MODS.reversalsniper : null;
      if (mod && typeof mod.refresh === 'function'){
        await mod.refresh();
      } else if (typeof W.rsRefresh === 'function'){
        await W.rsRefresh();
      }
    }
    __sn.lastScanAt = Date.now();
    var snap = buildSnapFromRsScan(W, opts.riskOpts || defaultRiskOpts(), { allowStale: true });
    snap.scanAt = __sn.lastScanAt;
    publishSuperSniperSnap(snap);
    return snap.stat || 'done';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    __sn.scanBusy = false;
  }
}

function superSniperRunScan(opts){
  return superSniperRunScanInner(opts || {});
}

async function superSniperWarm(opts){
  opts = opts || {};
  var stale = !__sn.lastScanAt || (Date.now() - __sn.lastScanAt) >= SCAN_INTERVAL_MS;
  if (stale || opts.force) return superSniperRunScan({ force: !!opts.force });
  return 'fresh';
}

function mount(el){
  if (!el) return;
  if (typeof W.hgSuperDeskInjectStyles === 'function'){
    W.hgSuperDeskInjectStyles('hg-super-sniper-styles');
  }
  var scoreLink = (typeof W.hgSuperDeskScorecardLink === 'function')
    ? W.hgSuperDeskScorecardLink(TAB_ID) : '';
  el.innerHTML = [
    '<section class="hg-tab hg-super-desk hg-super-sniper">',
    '  <div class="hg-title">Super Sniper</div>',
    '  <div class="hg-note">Conviction desk — REVERSAL SNIPER limit board · long bounces · Pack 18 sizing · ≥30× max-safe.</div>',
    '  <div id="sn-validation"></div>',
    '  <div class="hg-card"><h3>Sniper Limit Board</h3>',
    '    <div class="hg-note" id="sn-scan-stat">Sync from REVERSAL SNIPER · 15 min cycle</div>',
    '    <button type="button" class="hg-btn primary" id="sn-run-scan" style="margin-top:8px">Refresh sniper scan</button>',
    '    <div class="hg-desk" id="sn-desk" style="margin-top:12px"></div>',
    '  </div>',
    '  <div class="hg-card"><h3>Trade Context</h3>',
    '    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">',
    '      <label>Symbol<input id="sn-symbol" readonly style="width:100%"/></label>',
    '      <label>Direction<input id="sn-side" readonly value="Long" style="width:100%"/></label>',
    '      <label>Balance USD<input id="sn-balance" type="number" value="1000" style="width:100%"/></label>',
    '      <label>Risk %<input id="sn-risk" type="number" value="1" style="width:100%"/></label>',
    '      <label>Entry<input id="sn-entry" readonly style="width:100%"/></label>',
    '      <label>Stop<input id="sn-stop" readonly style="width:100%"/></label>',
    '      <label>T1<input id="sn-t1" readonly style="width:100%"/></label>',
    '      <label>Qty<input id="sn-size" readonly style="width:100%"/></label>',
    '    </div>',
    '    <div class="hg-note" id="sn-guidance" style="margin-top:10px"></div>',
    '    <button type="button" class="hg-btn primary" id="sn-send-trade" disabled style="margin-top:10px">Send to Trade Plan</button>',
    '    <div style="margin-top:10px">' + scoreLink + '</div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-sniper') || el;
  __sn.root = root;
  function $(id){ return root.querySelector(id); }

  function readRiskOpts(){
    var balance = N($('#sn-balance') && $('#sn-balance').value);
    var riskPct = N($('#sn-risk') && $('#sn-risk').value);
    return {
      balance: (Number.isFinite(balance) && balance > 0) ? balance : 1000,
      riskPct: (Number.isFinite(riskPct) && riskPct > 0) ? riskPct : 1
    };
  }

  function applyEvaluation(ev){
    var hit = ev && ev.hit;
    __sn.selectedHit = hit || null;
    if (!ev || !ev.ready){
      if ($('#sn-send-trade')) $('#sn-send-trade').disabled = true;
      return;
    }
    if ($('#sn-symbol')) $('#sn-symbol').value = String(ev.sym || '—');
    if ($('#sn-entry')) $('#sn-entry').value = fmt(ev.entry, 8);
    if ($('#sn-stop')) $('#sn-stop').value = fmt(ev.stop, 8);
    if ($('#sn-t1')) $('#sn-t1').value = fmt(ev.t1, 8);
    if ($('#sn-size') && hit && hit.positionSize){
      $('#sn-size').value = String(hit.positionSize.positionSizeUnits || '—');
    }
    if ($('#sn-guidance')) $('#sn-guidance').textContent = ev.note || '';
    var btn = $('#sn-send-trade');
    if (btn){
      var canSend = !!(hit && hit.minimalLossPass);
      btn.disabled = !canSend;
      btn.onclick = canSend ? function(){
        if (typeof W.hgToTradePlan === 'function'){
          W.hgToTradePlan(hit.sym, 'long', hit.entry, hit.stop, hit.t1, {
            t2: hit.t2, scanner: 'super-sniper', strategy: 'reversalsniper', source: 'super-sniper'
          });
        }
      } : null;
    }
  }

  function paintDesk(snap){
    var vEl = $('#sn-validation');
    if (vEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      vEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
    snap = snap || superSniperScan();
    var desk = $('#sn-desk');
    var statEl = $('#sn-scan-stat');
    if (statEl){
      statEl.textContent = (snap && snap.stat ? snap.stat : 'No sniper desk') + ' · '
        + (snap && snap.scanAt ? new Date(snap.scanAt).toLocaleTimeString() : '—');
    }
    if (!desk) return;
    var rows = (snap && snap.cands) ? snap.cands : [];
    if (!rows.length){
      desk.innerHTML = '<div class="hg-note">No SNIPER-grade rows. Run REVERSAL SNIPER scan first.</div>';
      return;
    }
    desk.innerHTML = rows.map(function(r){
      var pill = superSniperDeskPill(r);
      var sel = (__sn.selectedId === r.id) ? ' sel' : '';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<strong>' + String(r.sym) + ' LONG</strong> '
        + '<span class="hg-pill">conv ' + (r.conviction || '—') + '</span> '
        + '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span>'
        + '<div style="margin-top:8px;font:600 11px var(--mono,monospace)">'
        + 'E ' + fmt(r.entry, 6) + ' · S ' + fmt(r.stop, 6) + ' · T1 ' + fmt(r.t1, 6)
        + ' · lev ' + fmt(r.lev || r.safeMaxLev, 0) + '×</div></div>';
    }).join('');
    desk.querySelectorAll('.hg-desk-card').forEach(function(card){
      card.addEventListener('click', function(){
        __sn.selectedId = card.getAttribute('data-id');
        desk.querySelectorAll('.hg-desk-card').forEach(function(c){ c.classList.remove('sel'); });
        card.classList.add('sel');
        var hit = rows.find(function(r){ return r.id === __sn.selectedId; });
        if (hit) applyEvaluation(hitToEvaluation(hit));
      });
    });
  }

  function syncFromExisting(){
    var snap = syncDeskFromExisting(W, readRiskOpts());
    paintDesk(snap);
    if (snap.cands && snap.cands.length){
      var hit = snap.cands[0];
      if (!__sn.selectedId) __sn.selectedId = hit.id;
      var sel = snap.cands.find(function(r){ return r.id === __sn.selectedId; }) || hit;
      applyEvaluation(hitToEvaluation(sel));
    }
  }

  __sn.paintDesk = paintDesk;
  __sn.mounted = true;
  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  $('#sn-balance') && $('#sn-balance').addEventListener('input', syncFromExisting);
  $('#sn-risk') && $('#sn-risk').addEventListener('input', syncFromExisting);
  $('#sn-run-scan') && $('#sn-run-scan').addEventListener('click', function(){
    superSniperRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(){
      syncFromExisting();
    });
  });

  syncFromExisting();
  superSniperRunScan({ riskOpts: readRiskOpts() });

  __sn.syncTimer = setInterval(syncFromExisting, SYNC_MS);
  __sn.scanTimer = setInterval(function(){
    if (!__sn.scanBusy) superSniperRunScan({ riskOpts: readRiskOpts() });
  }, SCAN_INTERVAL_MS);
}

function superSniperRepaint(){
  if (__sn.mounted && typeof __sn.paintDesk === 'function') __sn.paintDesk(superSniperScan());
}

async function superSniperRefresh(){
  syncDeskFromExisting(W, defaultRiskOpts());
  superSniperRepaint();
  return 'refreshed';
}

W.superSniperDeskPill = superSniperDeskPill;
W.enrichSuperSniperRow = enrichSuperSniperRow;
W.buildSnapFromRsScan = buildSnapFromRsScan;
W.superSniperSyncDesk = syncDeskFromExisting;
W.superSniperScan = superSniperScan;
W.superSniperRunScan = superSniperRunScan;
W.superSniperWarm = superSniperWarm;
W.superSniperRepaint = superSniperRepaint;

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-sniper', label: 'SUPER SNIPER', run: superSniperWarm });

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER SNIPER',
  title: 'Super Sniper',
  mount: mount,
  refresh: superSniperRefresh
});

})();
