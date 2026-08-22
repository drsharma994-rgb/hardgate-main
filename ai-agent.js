/* =========================================================================
HARDGATE — ai-agent.js
Ruflo-inspired 24/7 agent workforce tab — multiple AI agents scan crypto +
gold setups using HARDGATE engines (gates, pine, gold, brain, funding, WM).

Classic script, IIFE. window.HG_tabs registration (TOOLS group · label AI AGENT).
Never throws at load time.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

function toEsc(s){
  if (typeof W.hgEsc === 'function') return W.hgEsc(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

function agentPx(n){
  if (!fin(+n)) return '—';
  if (typeof W.PX === 'function') return W.PX(+n);
  var x = Math.abs(+n);
  if (x >= 10000) return (+n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (x >= 100) return (+n).toFixed(2);
  if (x >= 1) return (+n).toFixed(4);
  return (+n).toFixed(6);
}

function agentPct(n, digits){
  digits = digits != null ? digits : 2;
  if (!fin(+n)) return '—';
  return (+n >= 0 ? '+' : '') + (+n).toFixed(digits) + '%';
}

function agentRr(entry, stop, t1){
  if (!fin(+entry) || !fin(+stop) || !fin(+t1) || +entry === +stop) return null;
  return Math.abs(+t1 - +entry) / Math.abs(+entry - +stop);
}

function hasSetupLevels(f){
  return f && fin(+f.entry) && fin(+f.stop) && fin(+f.t1) && +f.entry !== +f.stop;
}

function setupLevelsTag(f){
  if (!hasSetupLevels(f)) return '';
  var rr = f.rr != null && fin(+f.rr) ? +f.rr : agentRr(f.entry, f.stop, f.t1);
  var h = 'ENTRY <b class="hg-num">' + agentPx(f.entry) + '</b>'
    + ' · SL <b class="hg-num">' + agentPx(f.stop) + '</b>'
    + ' · TP1 <b class="hg-num">' + agentPx(f.t1) + '</b>';
  if (fin(+f.t2)) h += ' · TP2 <b class="hg-num">' + agentPx(f.t2) + '</b>';
  if (rr != null) h += ' · <span class="hg-num">' + rr.toFixed(2) + 'R</span>';
  return h;
}

function collectSetupsForDisplay(desk){
  var out = [];
  var seen = {};
  function add(f, extra){
    if (!f || !f.sym || !f.dir) return;
    var key = (f.agentId || f.agentLabel || '') + '|' + f.sym + '|' + f.dir + '@' + (fin(+f.entry) ? f.entry : 'na');
    if (seen[key]) return;
    seen[key] = true;
    out.push(Object.assign({}, f, extra || {}));
  }
  var top = (desk && desk.topFindings) ? desk.topFindings : [];
  for (var i = 0; i < top.length; i++) add(top[i]);
  if (desk && desk.agents){
    for (var id in desk.agents){
      if (!Object.prototype.hasOwnProperty.call(desk.agents, id)) continue;
      var finds = desk.agents[id].findings || [];
      for (var j = 0; j < finds.length; j++){
        if (!hasSetupLevels(finds[j])) continue;
        add(finds[j], { agentId: id, agentLabel: desk.agents[id].label });
      }
    }
  }
  var atomicFn = gfn('getAtomicDeskCached');
  if (atomicFn){
    try{
      var ad = atomicFn();
      var best = (ad && ad.bestSetups) ? ad.bestSetups : [];
      for (var k = 0; k < best.length; k++){
        var s = best[k];
        add({
          sym: s.sym,
          dir: s.dir,
          entry: s.entry,
          stop: s.stop,
          t1: s.t1,
          t2: s.t2,
          rr: s.rr,
          style: s.style,
          venue: s.bestVenue || s.exchange,
          exchange: s.bestVenue || s.exchange,
          clean7: !!(s.clean7 || s.clean),
          nearClean: !!s.nearClean,
          score: s.score,
          note: s.note,
          agentLabel: 'Atomic ' + (s.bestVenue || s.exchange || 'ranker'),
          src: 'ATOMIC',
        });
      }
    }catch(e1){}
  }
  var trendFn = gfn('trendmxCrossState');
  if (trendFn){
    try{
      var tx = trendFn();
      var golden = (tx && tx.goldenCross) ? tx.goldenCross : [];
      for (var ti = 0; ti < golden.length; ti++){
        var g = golden[ti];
        if (!g || !hasSetupLevels(g)) continue;
        add({
          sym: g.sym, dir: g.dir, entry: g.entry, stop: g.stop, t1: g.t1, t2: g.t2,
          rr: g.rr, score: g.score, clean7: !!g.clean7, nearClean: false,
          prime: !!g.prime, tier: g.tier || g.conviction,
          style: 'swing', agentLabel: 'Trend Matrix', src: 'TRENDMX GOLDEN',
          note: g.note || ('⚡GOLDEN · composite ' + g.score),
        });
      }
    }catch(eTx){}
  }
  applyAgentConfluence(out);
  out.sort(function(a, b){
    var la = hasSetupLevels(a) ? 1000 : 0;
    var lb = hasSetupLevels(b) ? 1000 : 0;
    var ca = (a.confluence || 0) * 50;
    var cb = (b.confluence || 0) * 50;
    var sa = la + ca + (a.clean7 ? 100 : 0) + (fin(+a.score) ? +a.score : 0) + (fin(+a.formationScore) ? +a.formationScore * 0.2 : 0);
    var sb = lb + cb + (b.clean7 ? 100 : 0) + (fin(+b.score) ? +b.score : 0) + (fin(+b.formationScore) ? +b.formationScore * 0.2 : 0);
    return sb - sa;
  });
  return out;
}

function symDirKey(f){
  return String(f && f.sym || '') + '|' + String(f && f.dir || '');
}

function applyAgentConfluence(list){
  if (!list || !list.length) return;
  var groups = {};
  for (var i = 0; i < list.length; i++){
    var f = list[i];
    if (!f || !hasSetupLevels(f)) continue;
    var k = symDirKey(f);
    if (!groups[k]) groups[k] = [];
    groups[k].push(f);
  }
  for (var gk in groups){
    if (!Object.prototype.hasOwnProperty.call(groups, gk)) continue;
    var g = groups[gk];
    if (g.length < 2) continue;
    for (var gi = 0; gi < g.length; gi++){
      g[gi].confluence = g.length;
      g[gi].score = (fin(+g[gi].score) ? +g[gi].score : 0) + (g.length - 1) * 8;
    }
  }
}

function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
}

async function warmAgentGateScans(){
  var warm = gfn('cryptoScanWarm');
  var jobs = [];
  if (warm){
    jobs.push(warm('swing').catch(function(){}));
    jobs.push(warm('scalp').catch(function(){}));
  }
  var tmWarm = gfn('trendmxWarm');
  if (tmWarm) jobs.push(tmWarm({ quiet: true }).catch(function(){}));
  if (jobs.length) await Promise.all(jobs);
}

function runTrendmxScout(){
  var finds = [];
  var crossFn = gfn('trendmxCrossState');
  var scanFn = gfn('trendmxScan');
  if (crossFn){
    try{
      var cs = crossFn();
      var golden = (cs && cs.goldenCross) ? cs.goldenCross : [];
      for (var i = 0; i < golden.length; i++){
        var g = golden[i];
        if (!g || !hasSetupLevels(g)) continue;
        finds.push(finding(g.sym, g.dir, {
          src: 'TRENDMX GOLDEN', entry: g.entry, stop: g.stop, t1: g.t1, t2: g.t2,
          rr: g.rr, score: g.score != null ? g.score : 12, clean7: !!g.clean7,
          tier: g.tier || g.conviction, prime: !!g.prime,
          note: g.note || ('⚡GOLDEN · composite ' + g.score),
        }));
      }
    }catch(e1){}
  }
  if (!finds.length && scanFn){
    try{
      var snap = scanFn({ maxAgeMs: 5 * 60 * 1000 });
      if (snap && typeof snap.then === 'function'){
        return snap.then(function(s){
          return runTrendmxScoutFromRows((s && s.rows) ? s.rows : []);
        });
      }
      return runTrendmxScoutFromRows((snap && snap.rows) ? snap.rows : []);
    }catch(e2){}
  }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' trend matrix setup(s)' };
}

function runTrendmxScoutFromRows(rows){
  var finds = [];
  var goldenFn = gfn('trendmxGoldenCrossSetups');
  if (goldenFn){
    try{
      var list = goldenFn(rows) || [];
      for (var i = 0; i < list.length; i++){
        var g = list[i];
        if (!g || !hasSetupLevels(g)) continue;
        finds.push(finding(g.sym, g.dir, {
          src: 'TRENDMX GOLDEN', entry: g.entry, stop: g.stop, t1: g.t1, t2: g.t2,
          rr: g.rr, score: g.score != null ? g.score : 12, clean7: !!g.clean7,
          tier: g.tier || g.conviction, prime: !!g.prime, note: g.note,
        }));
      }
    }catch(e){}
  }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' trend matrix golden setup(s)' };
}

var AGENTS = [
  { id: 'gate-hunter', label: 'Gate Hunter', role: 'trading-strategist', focus: 'crypto' },
  { id: 'market-analyst', label: 'Market Analyst', role: 'market-analyst', focus: 'macro' },
  { id: 'risk-analyst', label: 'Risk Analyst', role: 'risk-analyst', focus: 'risk' },
  { id: 'gold-smith', label: 'Gold Smith', role: 'trading-strategist', focus: 'gold' },
  { id: 'pine-scout', label: 'Pine Scout', role: 'trading-strategist', focus: 'crypto' },
  { id: 'strategy-lab', label: 'Strategy Lab', role: 'backtest-engineer', focus: 'crypto' },
  { id: 'funding-hunter', label: 'Funding Hunter', role: 'risk-analyst', focus: 'crypto' },
  { id: 'brain-echo', label: 'Brain Echo', role: 'trading-strategist', focus: 'all' },
  { id: 'trend-scout', label: 'Trend Scout', role: 'trading-strategist', focus: 'crypto' },
  { id: 'atomic-delta', label: 'Atomic Delta Scout', role: 'venue-scout', focus: 'delta' },
  { id: 'atomic-coindcx', label: 'Atomic CoinDCX Scout', role: 'venue-scout', focus: 'coindcx' },
  { id: 'atomic-best', label: 'Atomic Best Setup', role: 'composer', focus: 'delta+coindcx' },
];

var __agent = {
  busy: false,
  lastAt: null,
  lastDesk: null,
  reports: {},
  stat: 'idle',
};

function finding(sym, dir, extra){
  extra = extra || {};
  return Object.assign({
    sym: sym,
    dir: dir,
    asset: extra.asset || (/GOLD|XAU|XAUT|PAXG/i.test(String(sym || '')) ? 'gold' : 'crypto'),
  }, extra);
}

function runGateHunter(){
  var finds = [];
  var collect = gfn('hgTabAlertsCollect');
  if (!collect) return { ok: true, findings: [], summary: 'GATES tab not warmed — run WARM UP first' };
  var list = [];
  try{ list = collect() || []; }catch(e){ return { ok: false, findings: [], summary: 'collect failed' }; }
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    if (!s) continue;
    if (s.src.indexOf('GOLD') >= 0) continue;
    if (s.src.indexOf('SWING') < 0 && s.src.indexOf('SCALP') < 0) continue;
    if (!s.clean7 && !s.nearClean) continue;
    finds.push(finding(s.sym, s.dir, {
      src: s.src,
      entry: s.entry,
      stop: s.stop,
      t1: s.t1,
      clean7: !!s.clean7,
      nearClean: !!s.nearClean,
      tier: s.tier,
      score: s.clean7 ? 12 : 6,
      note: s.note || (s.clean7 ? '7/7 gate clean' : '6/7 near watch'),
    }));
  }
  return { ok: true, findings: finds.slice(0, 8), summary: finds.length + ' crypto gate setup(s)' };
}

function runMarketAnalyst(){
  var finds = [];
  var notes = [];
  var regimeFn = gfn('regimeState');
  if (regimeFn){
    try{
      var r = regimeFn();
      if (r){
        notes.push('regime ' + (r.label || r.regime || '—'));
        if (r.btcdPct != null) notes.push('BTC.D ' + (+r.btcdPct).toFixed(1) + '%');
        if (r.dxyTrend) notes.push('DXY ' + r.dxyTrend);
        finds.push(finding('BTCUSD', r.riskOn === false ? 'short' : 'long', {
          src: 'REGIME',
          score: 5,
          note: notes.join(' · '),
        }));
      }
    }catch(e1){}
  }
  var wmFn = gfn('getWorldMonitorDeskCached');
  if (wmFn){
    try{
      var wm = wmFn();
      if (wm && wm.macro && !wm.macro.unavailable){
        var v = String(wm.macro.verdict || '').toUpperCase();
        notes.push('WM ' + v);
        if (v === 'BUY'){
          finds.push(finding('BTCUSD', 'long', { src: 'WORLD MONITOR', score: 8, note: 'macro BUY · ' + (wm.macro.bullishCount || 0) + '/' + (wm.macro.totalCount || 0) }));
        } else if (v === 'CASH'){
          finds.push(finding('BTCUSD', 'short', { src: 'WORLD MONITOR', score: 6, note: 'macro CASH — reduce risk' }));
        }
      }
    }catch(e2){}
  }
  var rotFn = gfn('rotationState');
  if (rotFn){
    try{
      var rot = rotFn();
      if (rot && rot.leader){
        finds.push(finding(String(rot.leader), 'long', { src: 'ROTATION', score: 4, note: 'rotation leader' }));
      }
    }catch(e3){}
  }
  return { ok: true, findings: finds.slice(0, 6), summary: notes.length ? notes.join(' · ') : 'macro layers warming' };
}

function runRiskAnalyst(){
  var finds = [];
  var notes = [];
  var ccxtFn = gfn('getCcxtDeskCached');
  if (ccxtFn){
    try{
      var d = ccxtFn();
      if (d && d.assets){
        for (var i = 0; i < d.assets.length; i++){
          var a = d.assets[i];
          if (!a || a.fundingRate == null) continue;
          var fr = +a.fundingRate;
          if (Math.abs(fr) < 0.00015) continue;
          var sym = (a.symbol || 'BTC') + 'USD';
          finds.push(finding(sym, fr > 0 ? 'short' : 'long', {
            src: 'CCXT FUNDING',
            score: Math.min(10, Math.round(Math.abs(fr) * 100000)),
            note: 'funding ' + (fr * 100).toFixed(3) + '% · fade crowd',
          }));
        }
      }
      if (d && d.fundingArb && d.fundingArb.spreadBps != null){
        notes.push('arb ' + (+d.fundingArb.spreadBps).toFixed(1) + ' bps');
      }
    }catch(e1){}
  }
  var wmFn = gfn('getWorldMonitorDeskCached');
  if (wmFn){
    try{
      var wm = wmFn();
      if (wm && wm.stress && wm.stress.label){
        notes.push('stress ' + wm.stress.label);
        if (wm.stress.label === 'Critical' || wm.stress.label === 'Severe'){
          finds.push(finding('BTCUSD', 'short', { src: 'WM STRESS', score: 9, note: 'economic stress ' + wm.stress.label }));
        }
      }
    }catch(e2){}
  }
  return { ok: true, findings: finds.slice(0, 6), summary: notes.length ? notes.join(' · ') : 'risk desks warming' };
}

function runGoldSmith(){
  var finds = [];
  var collect = gfn('hgTabAlertsCollectGold');
  if (!collect){
    collect = gfn('hgTabAlertsCollect');
    if (collect){
      try{
        var all = collect() || [];
        for (var j = 0; j < all.length; j++){
          if (all[j] && all[j].src.indexOf('GOLD') >= 0) finds.push(finding(all[j].sym, all[j].dir, {
            src: all[j].src, entry: all[j].entry, stop: all[j].stop, t1: all[j].t1,
            clean7: !!all[j].clean7, score: all[j].goldConvicted ? 14 : 10,
            asset: 'gold', note: all[j].tier || 'gold setup',
          }));
        }
      }catch(e0){}
      return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' gold setup(s)' };
    }
    return { ok: true, findings: [], summary: 'GOLD tabs not warmed' };
  }
  try{
    var list = collect() || [];
    for (var i = 0; i < list.length; i++){
      var s = list[i];
      if (!s) continue;
      finds.push(finding(s.sym, s.dir, {
        src: s.src, entry: s.entry, stop: s.stop, t1: s.t1,
        clean7: !!s.clean7, goldConvicted: !!s.goldConvicted,
        score: s.goldConvicted ? 14 : (s.clean7 ? 12 : 8),
        asset: 'gold', note: s.tier || s.note || 'gold scan',
      }));
    }
  }catch(e){ return { ok: false, findings: [], summary: 'gold collect failed' }; }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' gold setup(s)' };
}

function runPineScout(){
  var finds = [];
  var scanFn = gfn('pineScan');
  if (scanFn){
    try{
      var val = scanFn();
      var sigs = (val && val.signals) ? val.signals : [];
      for (var i = 0; i < sigs.length; i++){
        var s = sigs[i];
        if (!s || (!s.isNew && !s.isRecent)) continue;
        finds.push(finding(s.sym, s.dir, {
          src: 'PINE', entry: s.entry, stop: s.stop, t1: s.t1,
          score: fin(+s.smoothedScore) ? +s.smoothedScore : 7,
          note: s.isNew ? 'fresh pine signal' : 'recent pine',
        }));
      }
    }catch(e1){}
  }
  var msbFn = gfn('pineMsbScan');
  if (msbFn && finds.length < 4){
    try{
      var msb = msbFn();
      var msigs = (msb && msb.signals) ? msb.signals : [];
      for (var j = 0; j < msigs.length && finds.length < 6; j++){
        var m = msigs[j];
        if (!m || (!m.isNew && !m.isRecent)) continue;
        finds.push(finding(m.sym, m.dir, { src: 'PINE MSB', score: 8, note: 'MSB/OB signal' }));
      }
    }catch(e2){}
  }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' pine signal(s)' };
}

function runStrategyLab(){
  var finds = [];
  var notes = [];
  var liveFn = gfn('btEmaCross');
  var klinesFn = gfn('binanceKlines');
  if (liveFn && klinesFn){
    try{
      return klinesFn('BTCUSDT', '4h', 120).then(function(rows){
        if (!rows || rows.length < 40) return { ok: true, findings: [], summary: 'insufficient bars for backtest' };
        var res = liveFn(rows);
        if (res && res.stats){
          notes.push('EMA cross WR ' + (res.stats.winRate != null ? (+res.stats.winRate * 100).toFixed(0) + '%' : '—'));
          notes.push('avgR ' + (res.stats.avgR != null ? (+res.stats.avgR).toFixed(2) : '—'));
        }
        var lvFn = gfn('sgLiveLevels');
        if (lvFn){
          var lv = lvFn('ema', rows);
          if (lv && lv.dir){
            finds.push(finding('BTCUSD', lv.dir, {
              src: 'STRATEGY LAB', score: 7,
              entry: lv.entry, stop: lv.stop, t1: lv.t1,
              note: 'EMA cross live · ' + notes.join(' · '),
            }));
          }
        }
        if (!finds.length && notes.length){
          finds.push(finding('BTCUSD', 'long', { src: 'STRATEGY LAB', score: 4, note: notes.join(' · ') }));
        }
        return { ok: true, findings: finds, summary: notes.join(' · ') || 'strategy lab scanned' };
      }).catch(function(){
        return { ok: true, findings: [], summary: 'strategy fetch skipped' };
      });
    }catch(e){}
  }
  return Promise.resolve({ ok: true, findings: [], summary: 'STRATEGY LAB / binance not ready' });
}

function runFundingHunter(){
  var finds = [];
  var notes = [];
  var carryFn = gfn('carryState');
  if (carryFn){
    try{
      var c = carryFn();
      if (c && c.rows){
        for (var i = 0; i < c.rows.length && finds.length < 4; i++){
          var r = c.rows[i];
          if (!r || r.fundingRate == null) continue;
          var fr = +r.fundingRate;
          if (Math.abs(fr) < 0.0001) continue;
          finds.push(finding(r.symbol || r.sym || 'BTCUSD', fr > 0 ? 'short' : 'long', {
            src: 'CARRY', score: 8, note: 'carry funding ' + (fr * 100).toFixed(3) + '%',
          }));
        }
      }
    }catch(e1){}
  }
  var ccxtFn = gfn('getCcxtDeskCached');
  if (ccxtFn){
    try{
      var d = ccxtFn();
      if (d && d.fundingArb){
        var arb = d.fundingArb;
        if (arb.signal){
          notes.push('arb ' + arb.signal);
          finds.push(finding('BTCUSD', String(arb.signal).indexOf('SHORT') >= 0 ? 'short' : 'long', {
            src: 'FUNDING ARB', score: 10,
            note: 'spread ' + (arb.spreadBps != null ? (+arb.spreadBps).toFixed(1) + ' bps' : '—'),
          }));
        }
      }
    }catch(e2){}
  }
  return { ok: true, findings: finds.slice(0, 5), summary: notes.length ? notes.join(' · ') : (finds.length + ' funding lead(s)') };
}

function runBrainEcho(){
  var finds = [];
  var fn = gfn('__hgBrainLast');
  if (!fn) return { ok: true, findings: [], summary: 'BRAIN not synthesized yet — run BRAIN or WARM UP' };
  var val = null;
  try{ val = fn(); }catch(e){ return { ok: false, findings: [], summary: 'brain read failed' }; }
  var rows = (val && val.rows) ? val.rows : [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.plan) continue;
    var tier = String(r.tier || '').toUpperCase();
    if (tier !== 'HIGH' && tier !== 'PRIME') continue;
    var ev = Array.isArray(r.evidence) ? r.evidence.join(' ') : '';
    var hasCleanEvidence = ev.indexOf('7/7') >= 0 || ev.indexOf('SWING CLEAN') >= 0 || ev.indexOf('SCALP CLEAN') >= 0;
    if (!hasCleanEvidence) continue;
    finds.push(finding(r.sym, r.dir, {
      src: 'BRAIN ' + tier,
      entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, t2: r.plan.t2,
      tier: tier, liveOk: r.liveOk, clean7: true,
      score: tier === 'PRIME' ? 15 : 12,
      note: (r.marketRead || val.marketRead || '').slice(0, 80),
    }));
  }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' brain tier row(s)' };
}

function atomicFindingsFromDesk(desk, venueFilter){
  var finds = [];
  if (!desk) return finds;
  var list = desk.topFindings || desk.bestSetups || [];
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    if (!s) continue;
    var v = s.bestVenue || s.venue || s.exchange;
    if (venueFilter && v !== venueFilter) continue;
    finds.push(finding(s.sym, s.dir, {
      src: 'ATOMIC ' + (v || 'ranker').toUpperCase(),
      venue: v,
      exchange: v,
      entry: s.entry,
      stop: s.stop,
      t1: s.t1,
      t2: s.t2,
      rr: s.rr,
      style: s.style,
      clean7: !!(s.clean7 || s.clean),
      score: s.score != null ? s.score : 10,
      note: s.note || ((s.style || 'setup') + ' · ' + (v || 'venue')),
    }));
  }
  return finds;
}

async function runAtomicPipelineAgent(venueFilter, summaryLabel){
  try{
    var refreshFn = gfn('refreshAtomicDesk');
    var desk = refreshFn ? await refreshFn(true) : null;
    if (!desk){
      var res = await fetch('/api/atomic/desk?refresh=1', { cache: 'no-store' });
      var j = await res.json();
      desk = j && j.desk ? j.desk : null;
    }
    if (!desk) return { ok: true, findings: [], summary: 'atomic pipeline warming — retry' };
    var finds = atomicFindingsFromDesk(desk, venueFilter);
    return {
      ok: true,
      findings: finds,
      summary: summaryLabel + ' · ' + finds.length + ' setup(s) · full universe scan · score '
        + (desk.swarmScore != null ? desk.swarmScore : '—'),
      atomicDesk: desk,
    };
  }catch(e){
    return { ok: false, findings: [], summary: 'atomic scan failed' };
  }
}

function runAtomicDelta(){ return runAtomicPipelineAgent('delta', 'Delta India atomic scout'); }
function runAtomicCoindcx(){ return runAtomicPipelineAgent('coindcx', 'CoinDCX atomic scout'); }
function runAtomicBest(){ return runAtomicPipelineAgent(null, 'Cross-venue best setup'); }

var RUNNERS = {
  'gate-hunter': runGateHunter,
  'market-analyst': runMarketAnalyst,
  'risk-analyst': runRiskAnalyst,
  'gold-smith': runGoldSmith,
  'pine-scout': runPineScout,
  'strategy-lab': runStrategyLab,
  'funding-hunter': runFundingHunter,
  'brain-echo': runBrainEcho,
  'trend-scout': runTrendmxScout,
  'atomic-delta': runAtomicDelta,
  'atomic-coindcx': runAtomicCoindcx,
  'atomic-best': runAtomicBest,
};

async function hgAgentRunOne(agentId){
  var meta = null;
  for (var i = 0; i < AGENTS.length; i++){
    if (AGENTS[i].id === agentId){ meta = AGENTS[i]; break; }
  }
  if (!meta) return { ok: false, agentId: agentId, reason: 'unknown agent' };
  var fn = RUNNERS[agentId];
  if (!fn) return { ok: false, agentId: agentId, reason: 'no runner' };
  var t0 = Date.now();
  var out = fn();
  if (out && typeof out.then === 'function') out = await out;
  return Object.assign({
    ok: out.ok !== false,
    agentId: agentId,
    label: meta.label,
    role: meta.role,
    focus: meta.focus,
    ms: Date.now() - t0,
    at: new Date().toISOString(),
  }, out);
}

function swarmScoreFromAgents(agents){
  var score = 0;
  for (var id in agents){
    if (!Object.prototype.hasOwnProperty.call(agents, id)) continue;
    var ag = agents[id];
    if (!ag || ag.ok === false) continue;
    var finds = Array.isArray(ag.findings) ? ag.findings : [];
    for (var i = 0; i < finds.length; i++){
      var f = finds[i];
      if (!f) continue;
      score += f.clean7 ? 12 : (fin(+f.score) ? +f.score : 2);
    }
  }
  return Math.min(100, Math.round(score / 2));
}

function buildDeskFromAgents(agents){
  var crypto = 0;
  var gold = 0;
  var top = [];
  for (var id in agents){
    if (!Object.prototype.hasOwnProperty.call(agents, id)) continue;
    var finds = Array.isArray(agents[id].findings) ? agents[id].findings : [];
    for (var i = 0; i < finds.length; i++){
      var f = finds[i];
      if (!f) continue;
      if (hasSetupLevels(f)){
        top.push(Object.assign({ agentId: id, agentLabel: agents[id].label }, f));
      }
      if (f.asset === 'gold' || /GOLD|XAU/i.test(String(f.sym || ''))) gold++;
      else crypto++;
    }
  }
  applyAgentConfluence(top);
  top.sort(function(a, b){
    var ca = (a.confluence || 0) * 50;
    var cb = (b.confluence || 0) * 50;
    return ((b.clean7 ? 100 : 0) + ca + (fin(+b.score) ? +b.score : 0))
         - ((a.clean7 ? 100 : 0) + ca + (fin(+a.score) ? +a.score : 0));
  });
  return {
    at: new Date().toISOString(),
    source: 'browser',
    swarmScore: swarmScoreFromAgents(agents),
    cryptoSetups: crypto,
    goldSetups: gold,
    topFindings: top.slice(0, 48),
    agents: agents,
  };
}

async function hgAgentSwarmRun(force){
  if (__agent.busy && !force) return { ok: false, reason: 'busy', stat: __agent.stat };
  __agent.busy = true;
  __agent.stat = 'swarm running…';
  var agents = {};
  try{
    if (typeof W.hgWarmLayerIds === 'function'){
      await W.hgWarmLayerIds(['regime', 'engine', 'goldscalp', 'goldswing', 'pine', 'carry', 'brain']);
    }
    await warmAgentGateScans();
    for (var i = 0; i < AGENTS.length; i++){
      var id = AGENTS[i].id;
      __agent.stat = 'agent ' + AGENTS[i].label + '…';
      agents[id] = await hgAgentRunOne(id);
      __agent.reports[id] = agents[id];
    }
    var desk = buildDeskFromAgents(agents);
    __agent.lastDesk = desk;
    __agent.lastAt = Date.now();
    __agent.stat = 'done · score ' + desk.swarmScore;
    try{
      await fetch('/api/agents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ at: desk.at, agents: agents, desk: desk }),
      });
    }catch(ePost){ /* offline ok */ }
    return { ok: true, stat: __agent.stat, desk: desk, agents: agents };
  }catch(e){
    __agent.stat = 'failed: ' + ((e && e.message) || e);
    return { ok: false, reason: __agent.stat };
  }finally{
    __agent.busy = false;
  }
}

function agentStatusChip(ag){
  if (!ag) return '<span class="note">—</span>';
  if (ag.ok === false) return '<span class="note warn">ERROR</span>';
  var n = Array.isArray(ag.findings) ? ag.findings.length : 0;
  return '<span class="note ok">' + n + ' find' + (n === 1 ? '' : 's') + '</span>';
}

function renderAgentCards(desk){
  desk = desk || __agent.lastDesk;
  var agents = (desk && desk.agents) ? desk.agents : __agent.reports;
  var h = '<div class="hg-agent-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px">';
  for (var i = 0; i < AGENTS.length; i++){
    var meta = AGENTS[i];
    var rep = agents[meta.id] || __agent.reports[meta.id] || null;
    h += '<div class="hg-panel" style="padding:10px;margin:0">'
      + '<div style="font-weight:600">' + toEsc(meta.label) + '</div>'
      + '<div class="note" style="font-size:11px;margin-top:2px">' + toEsc(meta.role) + ' · ' + toEsc(meta.focus) + '</div>'
      + '<div style="margin-top:6px">' + agentStatusChip(rep) + '</div>';
    if (rep && rep.summary){
      h += '<div class="note" style="margin-top:4px;line-height:1.4;font-size:11px">' + toEsc(rep.summary) + '</div>';
    }
    if (rep && Array.isArray(rep.findings)){
      for (var fi = 0; fi < rep.findings.length && fi < 2; fi++){
        var ff = rep.findings[fi];
        if (!hasSetupLevels(ff)) continue;
        h += '<div class="note" style="margin-top:6px;font-size:11px;line-height:1.5;border-left:2px solid var(--border);padding-left:8px">'
          + '<b>' + toEsc(ff.sym) + '</b> <span class="' + (ff.dir === 'long' ? 'pos' : 'neg') + '">' + toEsc(ff.dir) + '</span><br>'
          + setupLevelsTag(ff) + '</div>';
      }
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderSetupDetailCards(desk){
  var setups = collectSetupsForDisplay(desk);
  if (!setups.length) return '';
  var withLevels = setups.filter(hasSetupLevels);
  var h = '<div class="hg-panel__legend" style="margin-top:14px">Setup tickets · exact entry · SL · TP</div>';
  if (!withLevels.length){
    h += '<div class="note warn" style="margin-top:6px">' + setups.length + ' setup(s) found but no entry/SL/TP yet — run <b>WARM UP</b> then <b>SWARM SCAN</b> or <b>ATOMIC DELTA+CDCX</b>.</div>';
    return h;
  }
  h += '<div class="hg-agent-setups" style="display:flex;flex-direction:column;gap:10px;margin-top:8px">';
  for (var i = 0; i < withLevels.length && i < 12; i++){
    var f = withLevels[i];
    var rr = f.rr != null && fin(+f.rr) ? +f.rr : agentRr(f.entry, f.stop, f.t1);
    var riskPct = fin(+f.entry) && fin(+f.stop) ? Math.abs(+f.entry - +f.stop) / Math.abs(+f.entry) * 100 : null;
    var tier = f.clean7 ? '7/7 CLEAN' : (f.nearClean ? '6/7 NEAR' : (f.tier || 'SETUP'));
    h += '<div class="hg-panel" style="padding:12px;margin:0">'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:baseline">'
      + '<span style="font-weight:700;font-size:14px">' + toEsc(f.sym) + '</span>'
      + '<span class="' + (f.dir === 'long' ? 'pos' : 'neg') + '" style="font-weight:600">' + toEsc(String(f.dir || '').toUpperCase()) + '</span>'
      + '<span class="gpip ' + (f.clean7 ? 'ok' : '') + '">' + toEsc(tier) + '</span>'
      + (f.venue || f.exchange ? '<span class="note" style="margin:0">' + toEsc(f.venue || f.exchange) + '</span>' : '')
      + (f.style ? '<span class="note" style="margin:0">' + toEsc(f.style) + '</span>' : '')
      + (f.confluence >= 2 ? '<span class="gpip ok" title="Multiple agents agree on this sym+dir">' + f.confluence + '-agent confluence</span>' : '')
      + '</div>'
      + '<div class="note" style="margin-top:4px">' + toEsc(f.agentLabel || f.agentId || f.src || 'agent')
      + (f.score != null ? ' · score <span class="hg-num">' + f.score + '</span>' : '') + '</div>'
      + '<table class="hg-table" style="margin-top:8px;font-size:12px"><tbody>'
      + '<tr><td style="width:72px;opacity:0.75">ENTRY</td><td class="hg-num" style="font-weight:700">' + agentPx(f.entry) + '</td></tr>'
      + '<tr><td style="opacity:0.75">SL</td><td class="hg-num" style="font-weight:700;color:var(--short)">' + agentPx(f.stop) + '</td></tr>'
      + '<tr><td style="opacity:0.75">TP1</td><td class="hg-num" style="font-weight:700;color:var(--long)">' + agentPx(f.t1) + '</td></tr>';
    if (fin(+f.t2)){
      h += '<tr><td style="opacity:0.75">TP2</td><td class="hg-num" style="font-weight:700;color:var(--long)">' + agentPx(f.t2) + '</td></tr>';
    }
    h += '<tr><td style="opacity:0.75">R:R</td><td class="hg-num">' + (rr != null ? rr.toFixed(2) + 'R' : '—') + '</td></tr>';
    if (riskPct != null){
      h += '<tr><td style="opacity:0.75">Risk</td><td class="hg-num">' + riskPct.toFixed(2) + '% to SL</td></tr>';
    }
    h += '</tbody></table>';
    if (f.note) h += '<div class="note" style="margin-top:6px;font-size:11px">' + toEsc(f.note) + '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderTopFindings(desk){
  desk = desk || __agent.lastDesk;
  var top = collectSetupsForDisplay(desk);
  if (!top.length) return '<div class="note" style="margin-top:10px">No findings yet — run SWARM SCAN (WARM UP first for best coverage).</div>';
  var h = '<table class="hg-table" style="margin-top:10px;font-size:12px"><thead><tr>'
    + '<th>agent</th><th>sym</th><th>dir</th><th>entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>R:R</th><th>score</th>'
    + '</tr></thead><tbody>';
  for (var i = 0; i < top.length && i < 40; i++){
    var f = top[i];
    var rr = f.rr != null && fin(+f.rr) ? +f.rr : agentRr(f.entry, f.stop, f.t1);
    h += '<tr><td>' + toEsc(f.agentLabel || f.agentId || '—') + '</td>'
      + '<td>' + toEsc(f.sym || '—') + '</td>'
      + '<td class="' + (f.dir === 'long' ? 'pos' : 'neg') + '">' + toEsc(f.dir || '—') + '</td>'
      + '<td class="hg-num">' + (hasSetupLevels(f) ? agentPx(f.entry) : '—') + '</td>'
      + '<td class="hg-num">' + (hasSetupLevels(f) ? agentPx(f.stop) : '—') + '</td>'
      + '<td class="hg-num">' + (hasSetupLevels(f) ? agentPx(f.t1) : '—') + '</td>'
      + '<td class="hg-num">' + (fin(+f.t2) ? agentPx(f.t2) : '—') + '</td>'
      + '<td class="hg-num">' + (rr != null ? rr.toFixed(2) : '—') + '</td>'
      + '<td class="hg-num">' + (f.score != null ? f.score : '—') + '</td></tr>';
  }
  h += '</tbody></table>';
  return h;
}

function renderDesk(ui, desk){
  if (!ui.out) return;
  desk = desk || __agent.lastDesk;
  var h = '';
  if (desk){
    h += '<div class="note ok">Swarm score <span class="hg-num">' + (desk.swarmScore != null ? desk.swarmScore : '—')
      + '</span> · crypto <span class="hg-num">' + (desk.cryptoSetups != null ? desk.cryptoSetups : 0)
      + '</span> · gold <span class="hg-num">' + (desk.goldSetups != null ? desk.goldSetups : 0) + '</span></div>';
  }
  h += renderAgentCards(desk);
  h += renderSetupDetailCards(desk);
  h += '<div class="hg-panel__legend" style="margin-top:14px">All findings · levels summary</div>';
  h += renderTopFindings(desk);
  if (typeof W.hgAtomicDeskPanelHtml === 'function'){
    h += W.hgAtomicDeskPanelHtml();
  }
  h += '<div class="note" style="margin-top:10px;line-height:1.5">Workforce inspired by '
    + '<a href="https://github.com/ruvnet/ruflo" target="_blank" rel="noopener">Ruflo</a> · Atomic pipeline '
    + '<a href="https://github.com/Eigenwise/atomic-agents" target="_blank" rel="noopener">atomic-agents</a> scans the full Delta India + CoinDCX universe for gate-clean setups. '
    + 'Telegram alerts fire on the 5-min cycle when a great setup forms (ENTRY · SL · TP). Server watch runs 24/7 when TELEGRAM_* is set on Render.</div>';
  ui.out.innerHTML = h;
  try { if (typeof W.hgMpPin === 'function') W.hgMpPin('aiagent', collectSetupsForDisplay(desk), null, ui.out); } catch (eMp) {}
}

async function refreshAgentTab(ui, force){
  if (__agent.busy) return;
  if (ui.stat) ui.stat.textContent = 'loading desk…';
  try{
    if (force){
      await hgAgentSwarmRun(true);
      renderDesk(ui, __agent.lastDesk);
      if (ui.stat) ui.stat.textContent = __agent.stat;
      return;
    }
    var res = await fetch('/api/agents/desk', { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __agent.lastDesk = j.desk;
      if (j.desk.agents) __agent.reports = j.desk.agents;
    }
    if (!__agent.lastDesk || force === 'local'){
      await hgAgentSwarmRun(false);
    }
    renderDesk(ui, __agent.lastDesk);
    if (ui.stat) ui.stat.textContent = __agent.stat + (__agent.lastAt ? ' · ' + new Date(__agent.lastAt).toLocaleTimeString() : '');
  }catch(e){
    if (ui.stat) ui.stat.textContent = 'error: ' + ((e && e.message) || e);
    renderDesk(ui, __agent.lastDesk);
  }
}

function mountAiAgent(el){
  var root = el || document.getElementById('tab_aiagent');
  if (!root) return;
  root.innerHTML = ''
    + '<div class="hg-panel">'
    + '<div class="hg-panel__head"><span class="hg-panel__title">AI AGENT · workforce</span></div>'
    + '<div class="note">Specialist agents scan crypto + gold 24/7. Atomic Agents pipeline scans the <b>full Delta India + CoinDCX</b> perpetual universe (every contract, not top-18) for gate-clean setups.</div>'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    + '<button type="button" class="hg-btn" id="agentSwarmBtn">SWARM SCAN</button>'
    + '<button type="button" class="hg-btn ghost" id="agentAtomicBtn">ATOMIC DELTA+CDCX</button>'
    + '<button type="button" class="btn ghost" id="agentDeskBtn">Refresh desk</button>'
    + '</div>'
    + '<div class="note" id="agentStat" style="margin-top:6px">idle</div>'
    + '<div id="agentOut" style="margin-top:8px"></div>'
    + '</div>';

  var ui = {
    stat: root.querySelector('#agentStat'),
    out: root.querySelector('#agentOut'),
    swarm: root.querySelector('#agentSwarmBtn'),
    atomic: root.querySelector('#agentAtomicBtn'),
    desk: root.querySelector('#agentDeskBtn'),
  };

  fetch('/api/agents/capabilities', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(caps){
    if (ui.stat && caps && caps.agents){
      ui.stat.textContent = caps.agents.length + ' workforce agents + 3 atomic venue agents';
    }
  }).catch(function(){});

  async function runAtomicOnly(){
    if (ui.stat) ui.stat.textContent = 'atomic pipeline scanning Delta + CoinDCX…';
    try{
      await runAtomicBest();
      if (typeof W.refreshAtomicDesk === 'function') await W.refreshAtomicDesk(true);
      await hgAgentSwarmRun(true);
      renderDesk(ui, __agent.lastDesk);
      if (ui.stat) ui.stat.textContent = __agent.stat;
    }catch(e){
      if (ui.stat) ui.stat.textContent = 'atomic error: ' + ((e && e.message) || e);
    }
  }

  if (ui.swarm) ui.swarm.addEventListener('click', function(){ return refreshAgentTab(ui, true); });
  if (ui.atomic) ui.atomic.addEventListener('click', function(){ return runAtomicOnly(); });
  if (ui.desk) ui.desk.addEventListener('click', function(){ return refreshAgentTab(ui, false); });
  refreshAgentTab(ui, false);
}

function aiAgentState(){
  return {
    busy: __agent.busy,
    lastAt: __agent.lastAt,
    stat: __agent.stat,
    swarmScore: __agent.lastDesk && __agent.lastDesk.swarmScore,
  };
}

function getAgentDeskCached(){
  try{
    if (__agent.lastDesk) return JSON.parse(JSON.stringify(__agent.lastDesk));
    return null;
  }catch(e){ return null; }
}

async function aiAgentWarm(){
  try{
    var r = await hgAgentSwarmRun(false);
    return (r && r.ok) ? 'fresh' : (__agent.stat || 'skipped');
  }catch(e){ return 'error'; }
}

async function refreshAiAgent(){
  try{
    var r = await hgAgentSwarmRun(true);
    return (r && r.ok) ? 'fresh' : (__agent.stat || 'skipped');
  }catch(e){ return 'error'; }
}

W.hgAgentRunOne = hgAgentRunOne;
W.hgAgentSwarmRun = hgAgentSwarmRun;
W.hgAgentWorkforceCollect = function(){ return collectSetupsForDisplay(__agent.lastDesk); };
W.hgAgentWorkforceDesk = function(){ return __agent.lastDesk; };
W.getAgentDeskCached = getAgentDeskCached;
W.aiAgentState = aiAgentState;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'aiagent', label: 'AI AGENT', mount: mountAiAgent, refresh: refreshAiAgent });

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'aiagent', label: 'AI AGENT', run: aiAgentWarm });

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    hgAgentRunOne: hgAgentRunOne,
    hgAgentSwarmRun: hgAgentSwarmRun,
    buildDeskFromAgents: buildDeskFromAgents,
    AGENTS: AGENTS,
  };
}

})();
