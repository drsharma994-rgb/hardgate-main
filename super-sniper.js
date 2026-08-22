/* HARDGATE — super-sniper.js
   SUPER SNIPER tab: conviction desk over REVERSAL SNIPER limit board (Pack 18 sizing). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-sniper';
var SYNC_MS = 2500;
var SCAN_INTERVAL_MS = 10 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 10 * 60 * 1000;
var MIN_CONVICTION = 4;
var __hgSuperSniperSnap = null;
var __sn = {
  mounted: false, syncTimer: null, scanTimer: null, root: null,
  selectedId: null, scanBusy: false, lastScanAt: 0, selectedHit: null,
  scanPromise: null, lastScanMsg: ''
};

function N(v){ return Number(v); }
/* The String(n) fallback rendered a missing value as the text "null".
   Absent reads as absent whether or not the shared desk formatter loaded. */
function fmt(n, d){
  if (n === null || n === undefined || n === '') return '—';
  if (typeof W.hgSuperDeskFmt === 'function') return W.hgSuperDeskFmt(n, d);
  var x = Number(n);
  return Number.isFinite(x) ? x.toFixed(d === undefined ? 2 : d) : '—';
}

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
    return { at: Date.now(), cands: [], audit: audit, stat: '0 setups — sniper scan not run yet' };
  }
  if (!allowStale && !isFreshAt(snap.at, SNAP_MAX_MS)){
    return { at: snap.at || 0, cands: [], audit: audit, stat: '0 setups — sniper snap stale' };
  }
  scanned = snap.at || Date.now();
  var rawCount = snap.cands.length;
  snap.cands.forEach(function(c){
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
  var highConv = merged.filter(function(r){ return N(r.conviction) >= MIN_CONVICTION; });
  return {
    at: scanned,
    cands: merged,
    audit: audit,
    stat: merged.length
      ? (highConv.length + ' SNIPER · ' + audit.minLoss + ' trade-ready · '
        + merged.length + ' on board · ≥' + MIN_CONVICTION + ' conviction preferred')
      : (rawCount
        ? (rawCount + ' raw sniper hits — sizing/conviction blocked all rows')
        : (snap.stat || '0 sniper setups'))
  };
}

function publishSuperSniperSnap(snap){
  __hgSuperSniperSnap = snap || null;
  /* FORWARD LOG. This desk SELECTS from a pool another tab already records,
     so these are not new trades — they are the same setups after a conviction
     filter. Recording them measures the FILTER: does the desk's pick resolve
     better than the pool it picked from? That is the most direct test of
     whether the conviction layer earns its place.
     The SUPER: prefix marks it as a selection layer so the cross-tab ledger
     can keep it out of distinct-trade totals rather than double-counting. */
  try {
    if (snap && Array.isArray(snap.cands) && snap.cands.length
        && typeof W.hgFwdRecordScan === 'function'){
      W.hgFwdRecordScan('SUPER:SNIPER', '4h', snap.cands.filter(function(c){
        return c && c.sym && c.dir
            && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1)
            && +c.entry !== +c.stop;
      }).map(function(c){
        return { sym: c.sym, dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                 mechanic: 'CONVICTION-PICK', ticket: true };
      }), { horizonBars: 20 });
    }
  } catch (eFwd) { try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('super-sniper', eFwd); } catch (eW) {} }
  try{ W.HG_superSniperScan = snap; }catch(e){}
  return snap;
}

function mergePublishSuperSniperSnap(nextSnap){
  var prev = superSniperScan() || {};
  return publishSuperSniperSnap(
    (typeof W.hgSuperDeskMergeSnap === 'function')
      ? W.hgSuperDeskMergeSnap(prev, nextSnap || {}, { emptyStatPrefixes: ['0 setups', '0 sniper'] })
      : Object.assign({}, prev, nextSnap || {})
  );
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

function autoSelectFirstSetup(snap){
  snap = snap || superSniperScan();
  if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return null;
  var hit = null, i;
  if (__sn.selectedId){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].id === __sn.selectedId){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].minimalLossPass){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit) hit = snap.cands[0];
  if (hit && hit.id) __sn.selectedId = hit.id;
  return hit;
}

function superSniperAfterScan(snap){
  snap = snap || superSniperScan();
  if (!snap) return;
  mergePublishSuperSniperSnap(snap);
  __sn.lastScanMsg = snap.stat || 'done';
  if (__sn.mounted && typeof __sn.setScanStatus === 'function') __sn.setScanStatus(__sn.lastScanMsg);
  if (__sn.mounted && typeof __sn.paintDesk === 'function') __sn.paintDesk(snap);
  if (__sn.mounted && typeof __sn.applyFirstSetup === 'function') __sn.applyFirstSetup(false);
}

async function superSniperRunScanInner(opts){
  opts = opts || {};
  __sn.scanBusy = true;
  __sn.lastScanMsg = 'Running REVERSAL SNIPER scan…';
  if (__sn.mounted && typeof __sn.setScanStatus === 'function') __sn.setScanStatus(__sn.lastScanMsg);
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
    snap.hydrated = true;
    superSniperAfterScan(snap);
    return __sn.lastScanMsg;
  }catch(e){
    __sn.lastScanMsg = 'scan error: ' + ((e && e.message) ? e.message : String(e));
    if (__sn.mounted && typeof __sn.setScanStatus === 'function') __sn.setScanStatus(__sn.lastScanMsg);
    return __sn.lastScanMsg;
  }finally{
    __sn.scanBusy = false;
  }
}

async function superSniperRunScan(opts){
  opts = opts || {};
  if (__sn.scanPromise){
    if (opts.force){
      try{ await __sn.scanPromise; }catch(e0){}
    } else {
      return __sn.scanPromise;
    }
  }
  __sn.scanPromise = superSniperRunScanInner(opts).finally(function(){ __sn.scanPromise = null; });
  return __sn.scanPromise;
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
    try { if (typeof W.hgMpPin === 'function') W.hgMpPin('super-sniper', rows, null, desk); } catch (eMp) {}
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

  function setScanStatus(msg){
    var statEl = $('#sn-scan-stat');
    if (statEl && msg) statEl.textContent = msg;
  }

  function applyFirstSetup(force){
    var snap = superSniperScan();
    paintDesk(snap);
    var hit = autoSelectFirstSetup(snap);
    if (hit) applyEvaluation(hitToEvaluation(hit));
    if (force && hit) __sn.selectedHit = hit;
  }

  function syncFromExisting(){
    var snap = syncDeskFromExisting(W, readRiskOpts());
    mergePublishSuperSniperSnap(snap);
    applyFirstSetup(true);
    return superSniperScan();
  }

  __sn.setScanStatus = setScanStatus;
  __sn.applyFirstSetup = applyFirstSetup;
  __sn.paintDesk = paintDesk;
  __sn.syncFromExisting = syncFromExisting;
  __sn.mounted = true;
  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  $('#sn-balance') && $('#sn-balance').addEventListener('input', syncFromExisting);
  $('#sn-risk') && $('#sn-risk').addEventListener('input', syncFromExisting);
  $('#sn-run-scan') && $('#sn-run-scan').addEventListener('click', function(){
    var btn = $('#sn-run-scan');
    if (btn) btn.disabled = true;
    superSniperRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(msg){
      if (btn) btn.disabled = false;
      setScanStatus(String(msg));
      applyFirstSetup(true);
    });
  });

  syncFromExisting();
  superSniperRunScan({ riskOpts: readRiskOpts() });

  __sn.syncTimer = setInterval(function(){
    try{
      var snap = buildSnapFromRsScan(W, readRiskOpts(), { allowStale: true });
      snap.scanAt = (__sn.lastScanAt || (superSniperScan() && superSniperScan().scanAt) || snap.at);
      mergePublishSuperSniperSnap(snap);
      if (__sn.mounted && typeof __sn.paintDesk === 'function') __sn.paintDesk(superSniperScan());
    }catch(e){}
  }, SYNC_MS);
  __sn.scanTimer = setInterval(function(){
    if (!__sn.scanBusy){
      superSniperRunScan({ riskOpts: readRiskOpts() });
    }
  }, SCAN_INTERVAL_MS);
}

function superSniperRepaint(){
  if (!__sn.mounted) return;
  var snap = superSniperScan();
  if (!snap || !snap.cands || !snap.cands.length){
    snap = syncDeskFromExisting(W, defaultRiskOpts());
    mergePublishSuperSniperSnap(snap);
    snap = superSniperScan();
  }
  if (typeof __sn.paintDesk === 'function') __sn.paintDesk(snap);
  if (typeof __sn.applyFirstSetup === 'function') __sn.applyFirstSetup(false);
}

async function superSniperRefresh(){
  syncDeskFromExisting(W, defaultRiskOpts());
  superSniperRepaint();
  return 'refreshed';
}

W.superSniperDeskPill = superSniperDeskPill;
W.enrichSuperSniperRow = enrichSuperSniperRow;
W.buildSnapFromRsScan = buildSnapFromRsScan;
W.mergePublishSuperSniperSnap = mergePublishSuperSniperSnap;
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
