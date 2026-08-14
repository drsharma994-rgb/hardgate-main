/* HARDGATE — super-calibrate.js
   SUPER CALIBRATE tab: gate replay + MAE/MFE calibration desk (walk-forward linked). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-calibrate';
var __hgSuperCalSnap = null;
var __sc = { mounted: false, root: null, busy: false, lastAt: 0 };

function fmt(n, d){
  d = (d === undefined) ? 2 : d;
  var x = Number(n);
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

function superCalibrateSummarize(samples){
  samples = samples || [];
  var clean = 0, settled = 0, sumR = 0, wins = 0;
  samples.forEach(function(s){
    if (!s || !s.pass) return;
    var allOk = Object.keys(s.pass).every(function(k){ return s.pass[k]; });
    if (allOk) clean++;
    if (s.r != null && isFinite(s.r)){
      settled++;
      sumR += s.r;
      if (s.r > 0) wins++;
    }
  });
  return {
    samples: samples.length,
    clean: clean,
    settled: settled,
    expR: settled ? sumR / settled : null,
    winPct: settled ? wins / settled : null
  };
}

function buildSnapFromCalibrateResult(result){
  result = result || {};
  return {
    at: Date.now(),
    summary: result.summary || null,
    panelHtml: result.panelHtml || '',
    note: result.note || '',
    stat: result.stat || 'idle — run calibration'
  };
}

function publishSuperCalibrateSnap(snap){
  __hgSuperCalSnap = snap || null;
  try{ W.HG_superCalibrateScan = snap; }catch(e){}
  return snap;
}

function superCalibrateScan(){ return __hgSuperCalSnap; }

function superCalibrateReplayInline(opts){
  opts = opts || {};
  var samples = [], scanned = 0, clean = 0;
  if (typeof W.cgGateReplay !== 'function' || typeof W.getCandles !== 'function' || typeof W.getTickers !== 'function'){
    return {
      summary: null,
      panelHtml: '',
      stat: 'No calibration data — cgGateReplay or market feed unavailable',
      note: 'Run when SWING market feed is online'
    };
  }
  return (async function(){
    var uni = [];
    try{ uni = (await W.getTickers()) || []; }catch(e0){}
    uni = uni.filter(function(t){ return t && t.symbol; }).slice(0, opts.limit || 12);
    for (var i = 0; i < uni.length; i++){
      var t = uni[i];
      try{
        var rows = await W.getCandles(t.symbol, '4h', 500);
        if (!rows || rows.length < 300) continue;
        var rp = W.cgGateReplay(rows, t, {});
        samples = samples.concat(rp.samples || []);
        clean += rp.clean || 0;
        scanned++;
      }catch(e1){}
    }
    var sum = superCalibrateSummarize(samples);
    var panelHtml = '';
    if (typeof W.cgGateReplayPanelHTML === 'function' && samples.length){
      panelHtml = W.cgGateReplayPanelHTML({
        samples: samples,
        clean: sum.clean,
        settled: sum.settled
      }, {});
    }
    var stat = scanned
      ? ('Calibrated ' + scanned + ' symbols · ' + samples.length + ' bars · '
        + sum.clean + ' CLEAN · expR ' + (sum.expR != null ? fmt(sum.expR, 3) : '—'))
      : 'No calibration data — need 300+ 4H bars from market feed';
    return {
      summary: sum,
      panelHtml: panelHtml,
      stat: stat,
      note: sum.settled >= 5
        ? ('Settled ' + sum.settled + ' · win ' + fmt((sum.winPct || 0) * 100, 1) + '%')
        : 'Need more settled replay bars for MAE/MFE confidence',
      scanned: scanned
    };
  })();
}

async function superCalibrateRunInner(opts){
  opts = opts || {};
  if (__sc.busy) return 'busy';
  __sc.busy = true;
  try{
    var result = await superCalibrateReplayInline(opts);
    if (typeof W.runGateDiagnostics === 'function'){
      try{ await W.runGateDiagnostics(); }catch(eDiag){}
      if (!result.panelHtml && result.scanned === 0){
        result.stat = 'SWING gate replay ran — market feed returned no replay bars';
      }
    }
    var snap = buildSnapFromCalibrateResult(result);
    snap.scanned = result.scanned;
    publishSuperCalibrateSnap(snap);
    __sc.lastAt = Date.now();
    if (__sc.mounted && typeof __sc.paintSnap === 'function') __sc.paintSnap(snap);
    return snap.stat || 'done';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    __sc.busy = false;
  }
}

function superCalibrateRun(opts){
  return superCalibrateRunInner(opts || {});
}

async function superCalibrateWarm(opts){
  opts = opts || {};
  if (!__sc.lastAt || opts.force) return superCalibrateRun({ force: true });
  return 'fresh';
}

function mount(el){
  if (!el) return;
  if (typeof W.hgSuperDeskInjectStyles === 'function'){
    W.hgSuperDeskInjectStyles('hg-super-calibrate-styles');
  }
  var scoreLink = (typeof W.hgSuperDeskScorecardLink === 'function')
    ? W.hgSuperDeskScorecardLink(TAB_ID) : '';
  el.innerHTML = [
    '<section class="hg-tab hg-super-desk hg-super-calibrate">',
    '  <div class="hg-title">Super Calibrate</div>',
    '  <div class="hg-note">Gate replay + walk-forward validation — same engine as SWING CALIBRATE, on a conviction desk.</div>',
    '  <div id="sc-validation"></div>',
    '  <div class="hg-card"><h3>Gate Replay</h3>',
    '    <div class="hg-note" id="sc-stat">Idle — run calibration</div>',
    '    <button type="button" class="hg-btn primary" id="sc-run" style="margin-top:8px">Run gate calibration</button>',
    '    <div id="sc-panel" style="margin-top:12px"></div>',
    '  </div>',
    '  <div class="hg-card"><h3>SCORECARD link</h3>',
    '    <div class="hg-note">Walk-forward / Monte Carlo on settled trades lives on SCORECARD.</div>',
    '    <div style="margin-top:10px">' + scoreLink + '</div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-calibrate') || el;
  __sc.root = root;
  function $(id){ return root.querySelector(id); }

  function paintSnap(snap){
    var vEl = $('#sc-validation');
    if (vEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      vEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
    snap = snap || superCalibrateScan();
    var statEl = $('#sc-stat');
    if (statEl) statEl.textContent = (snap && snap.stat) ? snap.stat : 'Idle';
    var panel = $('#sc-panel');
    if (panel){
      panel.innerHTML = (snap && snap.panelHtml) ? snap.panelHtml
        : ('<div class="hg-note">' + ((snap && snap.note) || 'Run calibration to see gate replay histogram.') + '</div>');
    }
  }

  __sc.paintSnap = paintSnap;
  __sc.mounted = true;
  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  $('#sc-run') && $('#sc-run').addEventListener('click', function(){
    var btn = $('#sc-run');
    var statEl = $('#sc-stat');
    if (btn) btn.disabled = true;
    if (statEl) statEl.textContent = 'Calibrating…';
    superCalibrateRun({ force: true }).then(function(msg){
      if (btn) btn.disabled = false;
      if (statEl) statEl.textContent = String(msg);
      paintSnap(superCalibrateScan());
    });
  });

  paintSnap(superCalibrateScan());
  superCalibrateRun({ force: true }).then(function(msg){
    var statEl = $('#sc-stat');
    if (statEl && msg) statEl.textContent = String(msg);
    paintSnap(superCalibrateScan());
  });
}

function superCalibrateRepaint(){
  if (__sc.mounted && typeof __sc.paintSnap === 'function'){
    __sc.paintSnap(superCalibrateScan());
  }
}

async function superCalibrateRefresh(){
  if (!__sc.lastAt) await superCalibrateRun({ force: true });
  superCalibrateRepaint();
  return 'refreshed';
}

W.superCalibrateSummarize = superCalibrateSummarize;
W.superCalibrateReplayInline = superCalibrateReplayInline;
W.buildSnapFromCalibrateResult = buildSnapFromCalibrateResult;
W.superCalibrateScan = superCalibrateScan;
W.superCalibrateRun = superCalibrateRun;
W.superCalibrateWarm = superCalibrateWarm;
W.superCalibrateRepaint = superCalibrateRepaint;

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-calibrate', label: 'SUPER CALIBRATE', run: superCalibrateWarm });

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER CALIBRATE',
  title: 'Super Calibrate',
  mount: mount,
  refresh: superCalibrateRefresh
});

})();
