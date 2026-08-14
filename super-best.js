/* HARDGATE — super-best.js
   SUPER BEST tab: conviction desk over BEST tab CLEAN pool (7/7 + evidence stack). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-best';
var SYNC_MS = 2500;
var SCAN_INTERVAL_MS = 15 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 5 * 60 * 1000;
var __hgSuperBestSnap = null;
var __sb = {
  mounted: false, syncTimer: null, scanTimer: null, root: null,
  lastKey: '', selectedId: null, scanBusy: false, lastScanAt: 0,
  scanPromise: null, lastScanMsg: '', selectedHit: null
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
    balance: N(win.__sbDefaultBalance != null ? win.__sbDefaultBalance : 1000),
    riskPct: N(win.__sbDefaultRiskPct != null ? win.__sbDefaultRiskPct : 1),
    maxLeverage: N(win.__sbDefaultMaxLev != null ? win.__sbDefaultMaxLev : 5),
    feePct: 0.06,
    slipPct: 0.05
  };
}

function bestCandFromClean(c, at){
  if (!c || !c.dir) return null;
  return {
    id: [c.sym, c.dir, c.entry, c.stop, 'best'].join('|'),
    sym: c.sym,
    dir: c.dir,
    entry: N(c.entry),
    stop: N(c.stop),
    t1: N(c.t1),
    t2: N(c.t2),
    rr: N(c.rr),
    rows: c.rows || null,
    stack: c.stack || null,
    famScore: c.famScore,
    robScore: c.robScore,
    venueTag: c._venueLabel || (c.meta && c.meta.venue) || null
  };
}

function superBestDeskPill(row){
  if (!row) return { cls: 'block', label: 'RISK BLOCK' };
  if (row.minimalLossPass) return { cls: 'minloss', label: 'MIN LOSS PASS' };
  if (row.tier === 'near' || row.nearWatch) return { cls: 'watch', label: 'WATCH ONLY' };
  if (row.sizingPass) return { cls: 'clean', label: 'SIZE OK' };
  return { cls: 'block', label: 'RISK BLOCK' };
}

function enrichSuperBestRowLite(c, tier, riskOpts, meta){
  if (!c || !c.dir || !(N(c.entry) > 0 && N(c.stop) > 0)) return null;
  meta = meta || {};
  tier = tier || 'clean';
  riskOpts = riskOpts || defaultRiskOpts();
  var rrForCalc = N(c.rr) || 2;
  if (N(c.t1) > 0){
    var riskDist = Math.abs(c.entry - c.stop);
    if (riskDist > 0) rrForCalc = Math.abs(c.t1 - c.entry) / riskDist;
  }
  var calc = null;
  if (typeof W.calcTrade === 'function'){
    try{
      calc = W.calcTrade({
        balance: riskOpts.balance,
        riskPct: riskOpts.riskPct,
        entry: c.entry,
        stop: c.stop,
        rr: rrForCalc,
        tpPrice: N(c.t1) > 0 ? c.t1 : null,
        maxLeverage: riskOpts.maxLeverage,
        feePct: riskOpts.feePct,
        slipPct: riskOpts.slipPct
      });
    }catch(e0){}
  }
  var safeLev = (typeof W.calcSafeMaxLeverage === 'function')
    ? W.calcSafeMaxLeverage(c.entry, c.stop) : null;
  var hit = {
    id: c.id || [c.sym, c.dir, c.entry, c.stop, 'best'].join('|'),
    sym: c.sym,
    dir: c.dir,
    entry: N(c.entry),
    stop: N(c.stop),
    t1: N(c.t1),
    t2: N(c.t2),
    rr: N(c.rr) || rrForCalc,
    tp: N(c.t1),
    tier: tier,
    scanner: meta.scanner || 'best',
    famScore: c.famScore,
    robScore: c.robScore,
    stack: c.stack || null,
    rows: c.rows || null,
    venueTag: c.venueTag || null,
    sizingPass: !!(calc && calc.ok),
    impliedLev: calc && calc.impliedLeverage,
    safeMaxLev: safeLev,
    qty: calc && calc.qty,
    minimalLossPass: tier === 'clean' && !!(calc && calc.ok),
    riskReason: tier === 'clean' && calc && calc.ok ? 'PASS (lite)' : 'BEST desk lite enrich'
  };
  if (typeof W.hgCryptoAttachPositionSize === 'function'){
    try{
      W.hgCryptoAttachPositionSize(hit, riskOpts.balance, riskOpts.riskPct, { style: 'swing' });
      if (hit.positionRisk && tier === 'clean' && hit.positionRisk.pass === false){
        hit.minimalLossPass = false;
        hit.sizingPass = false;
      }
    }catch(e1){}
  }
  return hit;
}

function enrichSuperBestRow(c, tier, riskOpts, meta){
  meta = meta || {};
  var enrich = W.superSetupEnrichRow;
  if (typeof enrich === 'function'){
    var row = enrich(c, tier, riskOpts, Object.assign({}, meta, {
      refineOpts: { rejectVisionVeto: false }
    }));
    if (row) return row;
  }
  return enrichSuperBestRowLite(c, tier, riskOpts, meta);
}

function superBestSortCands(cands){
  if (!Array.isArray(cands)) return;
  cands.sort(function(a, b){
    var am = a.minimalLossPass ? 1 : 0, bm = b.minimalLossPass ? 1 : 0;
    if (bm !== am) return bm - am;
    var af = N(a.famScore) || 0, bf = N(b.famScore) || 0;
    if (bf !== af) return bf - af;
    var ar = N(a.robScore) || 0, br = N(b.robScore) || 0;
    if (br !== ar) return br - ar;
    return (N(b.rr) || 0) - (N(a.rr) || 0);
  });
}

function buildSnapFromBestScan(win, riskOpts, opts){
  win = win || W;
  riskOpts = riskOpts || defaultRiskOpts(win);
  opts = opts || {};
  var allowStale = opts.allowStale === true;
  var merged = [], scanned = 0, audit = { clean: 0, minLoss: 0 };

  var bestFn = win.bestScan;
  if (typeof bestFn !== 'function'){
    return {
      at: Date.now(), cands: [], audit: audit,
      stat: '0 setups — BEST scan not wired'
    };
  }
  var best = null;
  try{ best = bestFn(); }catch(e0){}
  if (!best || !Array.isArray(best.clean)){
    return {
      at: Date.now(), cands: [], audit: audit,
      stat: '0 setups — run BEST (FIND BEST) or wait for 15 min cycle'
    };
  }
  if (!allowStale && !isFreshAt(best.at, SNAP_MAX_MS)){
    return {
      at: best.at || 0, cands: [], audit: audit,
      stat: '0 setups — BEST snap stale; run FIND BEST'
    };
  }
  scanned = best.at || Date.now();
  best.clean.forEach(function(c){
    var raw = bestCandFromClean(c, scanned);
    if (!raw || !(raw.entry > 0 && raw.stop > 0)) return;
    var row = enrichSuperBestRow(raw, 'clean', riskOpts, { source: 'best', scanner: 'best', at: scanned });
    if (row){
      row.famScore = c.famScore;
      row.robScore = c.robScore;
      row.scanner = 'best';
      merged.push(row);
      audit.clean++;
      if (row.minimalLossPass) audit.minLoss++;
    }
  });
  superBestSortCands(merged);
  return {
    at: scanned,
    cands: merged,
    audit: audit,
    meta: best.meta || {},
    stat: merged.length
      ? (merged.length + ' BEST CLEAN · ' + audit.minLoss + ' trade-ready · fam/rob ranked')
      : '0 BEST CLEAN — run FIND BEST across Delta + CoinDCX'
  };
}

function publishSuperBestSnap(snap){
  __hgSuperBestSnap = snap || null;
  try{ W.HG_superBestScan = snap; }catch(e){}
  return snap;
}

function superBestScan(){ return __hgSuperBestSnap; }

function syncDeskFromExisting(win, riskOpts){
  var snap = buildSnapFromBestScan(win, riskOpts, { allowStale: true });
  snap.scanAt = __sb.lastScanAt || snap.at || Date.now();
  snap.hydrated = true;
  publishSuperBestSnap(snap);
  return snap;
}

function hitToEvaluation(hit){
  if (!hit || !(N(hit.entry) > 0 && N(hit.stop) > 0)){
    return { ready: false, idle: true, reason: 'No SUPER BEST setup on desk' };
  }
  return {
    ready: true, idle: false, mode: 'scanner',
    trigger: hit.trigger || 'best-clean',
    source: 'best',
    side: hit.dir === 'short' ? 'Short' : 'Long',
    sym: hit.sym,
    tf: '4h',
    entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2, rr: hit.rr,
    minimalLossPass: hit.minimalLossPass,
    minLossAudit: hit.minLossAudit,
    setupType: 'BEST CLEAN · ' + (hit.famScore != null ? hit.famScore + '/9 fam' : '7/7'),
    note: (hit.minimalLossPass ? 'MIN LOSS PASS · ' : 'BEST · ')
      + (hit.sym || '') + ' · fam ' + (hit.famScore != null ? hit.famScore : '—')
      + ' · rob ' + (hit.robScore != null ? hit.robScore : '—'),
    hit: hit
  };
}

function autoSelectFirstSetup(snap){
  snap = snap || superBestScan();
  if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return null;
  var hit = null, i;
  if (__sb.selectedId){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].id === __sb.selectedId){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].minimalLossPass){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit) hit = snap.cands[0];
  if (hit && hit.id) __sb.selectedId = hit.id;
  return hit;
}

async function superBestRunScanInner(opts){
  opts = opts || {};
  __sb.scanBusy = true;
  __sb.lastScanMsg = 'Running BEST scan…';
  if (__sb.mounted && typeof __sb.setScanStatus === 'function') __sb.setScanStatus(__sb.lastScanMsg);
  try{
    var warm = W.bestScanWarm;
    var runBestFn = W.runBest;
    if (typeof warm === 'function'){
      await warm();
    }
    var bestSnap = (typeof W.bestScan === 'function') ? W.bestScan() : null;
    if ((!bestSnap || !Array.isArray(bestSnap.clean) || !bestSnap.clean.length)
        && typeof runBestFn === 'function'){
      try{ await runBestFn({ quiet: true }); }catch(eRb){}
    }
    __sb.lastScanAt = Date.now();
    var snap = buildSnapFromBestScan(W, opts.riskOpts || defaultRiskOpts(), { allowStale: true });
    snap.scanAt = __sb.lastScanAt;
    snap.hydrated = true;
    publishSuperBestSnap(snap);
    if (typeof W.hgSuperDeskEnrichChartVision === 'function'){
      W.hgSuperDeskEnrichChartVision(snap.cands, {
        style: 'super-best', cleanOnly: true, limit: 6,
        repaint: __sb.mounted && typeof __sb.paintVision === 'function' ? __sb.paintVision : null
      });
    }
    if (__sb.mounted && typeof __sb.syncFromExistingDesks === 'function'){
      __sb.syncFromExistingDesks();
    }
    __sb.lastScanMsg = snap.stat || 'done';
    return __sb.lastScanMsg;
  }catch(e){
    __sb.lastScanMsg = 'scan error: ' + ((e && e.message) ? e.message : String(e));
    return __sb.lastScanMsg;
  }finally{
    __sb.scanBusy = false;
  }
}

function superBestRunScan(opts){
  opts = opts || {};
  if (__sb.scanPromise && !opts.force) return __sb.scanPromise;
  __sb.scanPromise = superBestRunScanInner(opts).finally(function(){ __sb.scanPromise = null; });
  return __sb.scanPromise;
}

async function superBestWarm(opts){
  opts = opts || {};
  var stale = !__sb.lastScanAt || (Date.now() - __sb.lastScanAt) >= SCAN_INTERVAL_MS;
  if (stale || opts.force) return superBestRunScan({ force: !!opts.force });
  return 'fresh';
}

function mount(el){
  if (!el) return;
  if (typeof W.hgSuperDeskInjectStyles === 'function'){
    W.hgSuperDeskInjectStyles('hg-super-best-styles');
  }
  var scoreLink = (typeof W.hgSuperDeskScorecardLink === 'function')
    ? W.hgSuperDeskScorecardLink(TAB_ID) : '';
  el.innerHTML = [
    '<section class="hg-tab hg-super-desk hg-super-best">',
    '  <div class="hg-title">Super Best</div>',
    '  <div class="hg-note">Conviction desk — BEST tab CLEAN pool only (7/7 gates + family/robustness stack).</div>',
    '  <div id="sb-validation"></div>',
    '  <div class="hg-card"><h3>BEST Universe Desk</h3>',
    '    <div class="hg-note" id="sb-scan-stat">Next scan on tab open · 15 min cycle</div>',
    '    <button type="button" class="hg-btn primary" id="sb-run-scan" style="margin-top:8px">Run BEST scan now</button>',
    '    <div class="hg-desk" id="sb-desk" style="margin-top:12px"></div>',
    '    <div id="sb-vision" style="margin-top:10px"></div>',
    '  </div>',
    '  <div class="hg-card"><h3>Trade Context</h3>',
    '    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">',
    '      <label>Symbol<input id="sb-symbol" readonly style="width:100%"/></label>',
    '      <label>Direction<input id="sb-side" readonly style="width:100%"/></label>',
    '      <label>Balance USD<input id="sb-balance" type="number" value="1000" style="width:100%"/></label>',
    '      <label>Risk %<input id="sb-risk" type="number" value="1" style="width:100%"/></label>',
    '      <label>Entry<input id="sb-entry" readonly style="width:100%"/></label>',
    '      <label>Stop<input id="sb-stop" readonly style="width:100%"/></label>',
    '      <label>T1<input id="sb-t1" readonly style="width:100%"/></label>',
    '      <label>Qty<input id="sb-size" readonly style="width:100%"/></label>',
    '    </div>',
    '    <div class="hg-note" id="sb-guidance" style="margin-top:10px"></div>',
    '    <button type="button" class="hg-btn primary" id="sb-send-trade" disabled style="margin-top:10px">Send to Trade Plan</button>',
    '    <div style="margin-top:10px">' + scoreLink + '</div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-best') || el;
  __sb.root = root;
  function $(id){ return root.querySelector(id); }

  function readRiskOpts(){
    var balance = N($('#sb-balance') && $('#sb-balance').value);
    var riskPct = N($('#sb-risk') && $('#sb-risk').value);
    return {
      balance: (Number.isFinite(balance) && balance > 0) ? balance : 1000,
      riskPct: (Number.isFinite(riskPct) && riskPct > 0) ? riskPct : 1,
      maxLeverage: 5, feePct: 0.06, slipPct: 0.05
    };
  }

  function paintValidation(){
    var vEl = $('#sb-validation');
    if (vEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      vEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
  }

  function paintVision(hit){
    var vEl = $('#sb-vision');
    if (!vEl) return;
    vEl.innerHTML = (hit && typeof W.hgSuperDeskVisionBlock === 'function')
      ? W.hgSuperDeskVisionBlock(hit) : '';
  }

  __sb.paintVision = function(){
    paintVision(__sb.selectedHit);
  };

  function applyEvaluation(ev){
    var hit = ev && ev.hit;
    __sb.selectedHit = hit || null;
    if (!ev || !ev.ready){
      if ($('#sb-send-trade')) $('#sb-send-trade').disabled = true;
      paintVision(null);
      return;
    }
    if ($('#sb-symbol')) $('#sb-symbol').value = String(ev.sym || '—');
    if ($('#sb-side')) $('#sb-side').value = String(ev.side || '—');
    if ($('#sb-entry')) $('#sb-entry').value = fmt(ev.entry, 8);
    if ($('#sb-stop')) $('#sb-stop').value = fmt(ev.stop, 8);
    if ($('#sb-t1')) $('#sb-t1').value = fmt(ev.t1, 8);
    if ($('#sb-size') && hit){
      var qty = hit.positionSize && hit.positionSize.positionSizeUnits;
      $('#sb-size').value = Number.isFinite(qty) ? String(qty) : fmt(hit.qty, 6);
    }
    if ($('#sb-guidance')) $('#sb-guidance').textContent = ev.note || '';
    paintVision(hit);
    var btn = $('#sb-send-trade');
    if (btn){
      var canSend = !!(hit && hit.minimalLossPass);
      btn.disabled = !canSend;
      btn.onclick = canSend ? function(){
        if (typeof W.hgToTradePlan === 'function'){
          W.hgToTradePlan(hit.sym, hit.dir, hit.entry, hit.stop, hit.t1 || hit.tp, {
            t2: hit.t2 || null, scanner: 'super-best', strategy: 'best',
            stack: hit.stack || null, source: 'super-best'
          });
        }
      } : null;
    }
  }

  function paintDesk(snap){
    paintValidation();
    snap = snap || superBestScan();
    var desk = $('#sb-desk');
    var statEl = $('#sb-scan-stat');
    if (statEl){
      var when = snap && snap.scanAt ? new Date(snap.scanAt).toLocaleTimeString() : '—';
      statEl.textContent = (snap && snap.stat ? snap.stat : 'No scan yet') + ' · last ' + when;
    }
    if (!desk) return;
    var rows = (snap && Array.isArray(snap.cands)) ? snap.cands : [];
    if (!rows.length){
      desk.innerHTML = '<div class="hg-note">No BEST CLEAN on desk. Run FIND BEST or wait for cycle.</div>';
      return;
    }
    desk.innerHTML = rows.map(function(r){
      var pill = superBestDeskPill(r);
      var sel = (__sb.selectedId === r.id) ? ' sel' : '';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">'
        + '<strong>' + String(r.sym || '—') + ' · ' + String(r.dir || '').toUpperCase() + '</strong>'
        + '<span><span class="hg-pill clean">BEST CLEAN</span> '
        + '<span class="hg-pill">' + (r.famScore != null ? r.famScore + '/9 fam' : '7/7') + '</span> '
        + '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span></span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px;font:600 11px var(--mono,monospace)">'
        + '<div>ENTRY<br/>' + fmt(r.entry, 6) + '</div>'
        + '<div>STOP<br/>' + fmt(r.stop, 6) + '</div>'
        + '<div>T1<br/>' + fmt(r.tp, 6) + '</div>'
        + '<div>RR<br/>' + fmt(r.rr, 2) + '</div>'
        + '<div>LEV<br/>' + fmt(r.impliedLev, 1) + 'x</div>'
        + '</div></div>';
    }).join('');
    desk.querySelectorAll('.hg-desk-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = card.getAttribute('data-id');
        __sb.selectedId = id;
        desk.querySelectorAll('.hg-desk-card').forEach(function(c){ c.classList.remove('sel'); });
        card.classList.add('sel');
        var hit = rows.find(function(r){ return r.id === id; });
        if (hit) applyEvaluation(hitToEvaluation(hit));
      });
    });
  }

  function setScanStatus(msg){
    var statEl = $('#sb-scan-stat');
    if (statEl && msg) statEl.textContent = msg;
  }

  function syncFromExistingDesks(){
    var snap = syncDeskFromExisting(W, readRiskOpts());
    paintDesk(snap);
    var hit = autoSelectFirstSetup(snap);
    if (hit) applyEvaluation(hitToEvaluation(hit));
    if (typeof W.hgSuperDeskEnrichChartVision === 'function'){
      W.hgSuperDeskEnrichChartVision(snap.cands, {
        style: 'super-best', cleanOnly: true, limit: 6, repaint: __sb.paintVision
      });
    }
    return snap;
  }

  __sb.setScanStatus = setScanStatus;
  __sb.paintDesk = paintDesk;
  __sb.syncFromExistingDesks = syncFromExistingDesks;
  __sb.mounted = true;

  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  $('#sb-balance') && $('#sb-balance').addEventListener('input', syncFromExistingDesks);
  $('#sb-risk') && $('#sb-risk').addEventListener('input', syncFromExistingDesks);
  $('#sb-run-scan') && $('#sb-run-scan').addEventListener('click', function(){
    var btn = $('#sb-run-scan');
    if (btn) btn.disabled = true;
    superBestRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(msg){
      if (btn) btn.disabled = false;
      setScanStatus(String(msg));
      syncFromExistingDesks();
    });
  });

  syncFromExistingDesks();
  superBestRunScan({ riskOpts: readRiskOpts() });

  __sb.syncTimer = setInterval(function(){
    try{
      var snap = buildSnapFromBestScan(W, readRiskOpts(), { allowStale: true });
      snap.scanAt = (__sb.lastScanAt || (superBestScan() && superBestScan().scanAt) || snap.at);
      publishSuperBestSnap(Object.assign({}, superBestScan() || {}, snap));
      if (__sb.mounted && typeof __sb.paintDesk === 'function') __sb.paintDesk(superBestScan());
    }catch(e){}
  }, SYNC_MS);

  __sb.scanTimer = setInterval(function(){
    if (!__sb.scanBusy) superBestRunScan({ riskOpts: readRiskOpts() });
  }, SCAN_INTERVAL_MS);
}

function superBestRepaint(){
  if (!__sb.mounted) return;
  if (typeof __sb.paintDesk === 'function') __sb.paintDesk(superBestScan());
}

async function superBestRefresh(){
  try{
    if (__sb.mounted && typeof __sb.paintDesk === 'function'){
      syncDeskFromExisting(W, defaultRiskOpts());
      __sb.paintDesk(superBestScan());
    }
    var stale = !__sb.lastScanAt || (Date.now() - __sb.lastScanAt) >= SCAN_INTERVAL_MS;
    if (stale) await superBestRunScan({ force: true });
    return stale ? 'scanned+refreshed' : 'refreshed';
  }catch(e){ return 'error'; }
}

W.superBestDeskPill = superBestDeskPill;
W.enrichSuperBestRow = enrichSuperBestRow;
W.enrichSuperBestRowLite = enrichSuperBestRowLite;
W.buildSnapFromBestScan = buildSnapFromBestScan;
W.superBestSyncDesk = syncDeskFromExisting;
W.superBestScan = superBestScan;
W.superBestRunScan = superBestRunScan;
W.superBestWarm = superBestWarm;
W.superBestRepaint = superBestRepaint;

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-best', label: 'SUPER BEST', run: superBestWarm });

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER BEST',
  title: 'Super Best',
  mount: mount,
  refresh: superBestRefresh
});

})();
