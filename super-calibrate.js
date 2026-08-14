/* HARDGATE — super-calibrate.js
   SUPER CALIBRATE tab: gate replay + MAE/MFE calibration desk (walk-forward linked). */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-calibrate';
var DEFAULT_SYMBOLS = 24;
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

function superCalibrateReplayFromSwingAudit(){
  try{
    var swingFn = W.swingScan;
    if (typeof swingFn !== 'function') return null;
    var snap = swingFn();
    var audit = snap && snap.audit;
    if (!audit || !Array.isArray(audit.replaySamples) || !audit.replaySamples.length) return null;
    return {
      samples: audit.replaySamples.slice(),
      clean: audit.replayClean || 0,
      settled: audit.replaySettled || 0,
      source: 'swing-scan',
      scanned: audit.replaySymbols || 0
    };
  }catch(e0){ return null; }
}

function superCalibrateBuildPanel(replay, summary, scanned, note){
  var parts = [];
  replay = replay || { samples: [] };
  summary = summary || superCalibrateSummarize(replay.samples);
  scanned = scanned || 0;

  if (typeof W.hgFunnelPanelHTML === 'function'){
    parts.push(W.hgFunnelPanelHTML('SUPER CALIBRATE — gate replay summary', [
      { k: 'Symbols replayed', v: String(scanned || (replay.source === 'swing-scan' ? 'SWING cache' : '0')) },
      { k: 'Aligned bars', v: String(summary.samples || 0) },
      { k: 'CLEAN at settings', v: String(summary.clean || 0) },
      { k: 'Settled bars', v: String(summary.settled || 0) },
      { k: 'Expectancy', v: summary.expR != null ? fmt(summary.expR, 3) + 'R' : '—' },
      { k: 'Win rate', v: summary.winPct != null ? fmt(summary.winPct * 100, 1) + '%' : '—' }
    ], 'scReplaySummary'));
  }

  if (typeof W.cgGateReplayPanelHTML === 'function' && replay.samples && replay.samples.length){
    var sweepHtml = W.cgGateReplayPanelHTML({
      samples: replay.samples,
      clean: summary.clean,
      settled: summary.settled
    }, {});
    if (sweepHtml) parts.push(sweepHtml);
  }

  if (!parts.length || (parts.length === 1 && !(replay.samples && replay.samples.length))){
    parts.push('<div class="hg-note">' + (note || 'Run calibration or SWING scan to load replay bars.') + '</div>');
  }
  return parts.join('');
}

async function superCalibrateWarmTickers(limit){
  limit = limit || DEFAULT_SYMBOLS;
  try{
    if (typeof W.getTickers === 'function'){
      var uni = await W.getTickers();
      if (Array.isArray(uni) && uni.length) return uni.filter(function(t){ return t && t.symbol; }).slice(0, limit);
    }
  }catch(e0){}
  try{
    if (typeof W.S !== 'undefined' && W.S && Array.isArray(W.S.tickers) && W.S.tickers.length){
      return W.S.tickers.filter(function(t){ return t && t.symbol; }).slice(0, limit);
    }
  }catch(e1){}
  return [];
}

async function superCalibrateReplayInline(opts){
  opts = opts || {};
  var cgReplay = W.cgGateReplay;
  var getCandles = W.getCandles;
  if (typeof cgReplay !== 'function' || typeof getCandles !== 'function'){
    var cached = superCalibrateReplayFromSwingAudit();
    if (cached){
      var sumCached = superCalibrateSummarize(cached.samples);
      return {
        summary: sumCached,
        panelHtml: superCalibrateBuildPanel(cached, sumCached, cached.scanned || 0,
          'Synced from latest SWING scan replay cache'),
        stat: 'SWING replay cache · ' + cached.samples.length + ' bars · ' + sumCached.clean + ' CLEAN',
        note: sumCached.settled >= 5
          ? ('Settled ' + sumCached.settled + ' · win ' + fmt((sumCached.winPct || 0) * 100, 1) + '%')
          : 'Need more settled replay bars for MAE/MFE confidence',
        scanned: cached.scanned || 0,
        source: 'swing-scan'
      };
    }
    return {
      summary: null,
      panelHtml: superCalibrateBuildPanel(null, null, 0, 'cgGateReplay / getCandles not ready — open SWING and scan first'),
      stat: 'No calibration data — market feed unavailable',
      note: 'Run SWING scan or gate calibration when online',
      scanned: 0
    };
  }

  var samples = [], scanned = 0, clean = 0;
  var uni = await superCalibrateWarmTickers(opts.limit || DEFAULT_SYMBOLS);
  for (var i = 0; i < uni.length; i++){
    var t = uni[i];
    try{
      if (typeof W.hgScanRateOk === 'function' && !W.hgScanRateOk()) break;
      var rows = await getCandles(t.symbol, '4h', 500);
      if (!rows || rows.length < 300) continue;
      var rp = cgReplay(rows, t, {});
      samples = samples.concat(rp.samples || []);
      clean += rp.clean || 0;
      scanned++;
    }catch(e1){}
  }

  if (!samples.length){
    var swingCached = superCalibrateReplayFromSwingAudit();
    if (swingCached){
      samples = swingCached.samples;
      clean = swingCached.clean || 0;
      scanned = swingCached.scanned || scanned;
    }
  }

  var sum = superCalibrateSummarize(samples);
  var replay = { samples: samples, clean: sum.clean, settled: sum.settled };
  var note = sum.settled >= 5
    ? ('Settled ' + sum.settled + ' · win ' + fmt((sum.winPct || 0) * 100, 1) + '%')
    : 'Need more settled replay bars for MAE/MFE confidence';
  var stat = scanned
    ? ('Calibrated ' + scanned + ' symbols · ' + samples.length + ' bars · '
      + sum.clean + ' CLEAN · expR ' + (sum.expR != null ? fmt(sum.expR, 3) : '—'))
    : (samples.length
      ? ('SWING replay cache · ' + samples.length + ' bars · ' + sum.clean + ' CLEAN')
      : 'No calibration data — need 300+ 4H bars (run SWING scan)');

  return {
    summary: sum,
    panelHtml: superCalibrateBuildPanel(replay, sum, scanned, note),
    stat: stat,
    note: note,
    scanned: scanned,
    source: samples.length && !scanned ? 'swing-scan' : 'inline'
  };
}

async function superCalibrateRunInner(opts){
  opts = opts || {};
  if (__sc.busy) return 'busy';
  __sc.busy = true;
  try{
    var result = await superCalibrateReplayInline(opts);
    var snap = buildSnapFromCalibrateResult(result);
    snap.scanned = result.scanned;
    snap.source = result.source;
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
  else superCalibrateRepaint();
  return 'refreshed';
}

W.superCalibrateSummarize = superCalibrateSummarize;
W.superCalibrateReplayInline = superCalibrateReplayInline;
W.superCalibrateBuildPanel = superCalibrateBuildPanel;
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
