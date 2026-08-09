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

function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
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
    if (tier !== 'HIGH' && tier !== 'PRIME' && tier !== 'MEDIUM') continue;
    finds.push(finding(r.sym, r.dir, {
      src: 'BRAIN ' + tier,
      entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, t2: r.plan.t2,
      tier: tier, liveOk: r.liveOk,
      score: tier === 'PRIME' ? 15 : (tier === 'HIGH' ? 12 : 8),
      note: (r.marketRead || val.marketRead || '').slice(0, 80),
    }));
  }
  return { ok: true, findings: finds.slice(0, 6), summary: finds.length + ' brain tier row(s)' };
}

var RUNNERS = {
  'gate-hunter': runGateHunter,
  'market-analyst': runMarketAnalyst,
  'risk-analyst': runRiskAnalyst,
  'gold-smith': runGoldSmith,
  'pine-scout': runPineScout,
  'strategy-lab': runStrategyLab,
  'funding-hunter': runFundingHunter,
  'brain-echo': runBrainEcho,
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
      top.push(Object.assign({ agentId: id, agentLabel: agents[id].label }, f));
      if (f.asset === 'gold' || /GOLD|XAU/i.test(String(f.sym || ''))) gold++;
      else crypto++;
    }
  }
  top.sort(function(a, b){
    return ((b.clean7 ? 100 : 0) + (fin(+b.score) ? +b.score : 0)) - ((a.clean7 ? 100 : 0) + (fin(+a.score) ? +a.score : 0));
  });
  return {
    at: new Date().toISOString(),
    source: 'browser',
    swarmScore: swarmScoreFromAgents(agents),
    cryptoSetups: crypto,
    goldSetups: gold,
    topFindings: top.slice(0, 12),
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
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderTopFindings(desk){
  desk = desk || __agent.lastDesk;
  var top = (desk && desk.topFindings) ? desk.topFindings : [];
  if (!top.length) return '<div class="note" style="margin-top:10px">No findings yet — run SWARM SCAN (WARM UP first for best coverage).</div>';
  var h = '<table class="hg-table" style="margin-top:10px"><thead><tr><th>agent</th><th>sym</th><th>dir</th><th>score</th><th>note</th></tr></thead><tbody>';
  for (var i = 0; i < top.length; i++){
    var f = top[i];
    h += '<tr><td>' + toEsc(f.agentLabel || f.agentId || '—') + '</td>'
      + '<td>' + toEsc(f.sym || '—') + '</td>'
      + '<td class="' + (f.dir === 'long' ? 'pos' : 'neg') + '">' + toEsc(f.dir || '—') + '</td>'
      + '<td class="hg-num">' + (f.score != null ? f.score : '—') + '</td>'
      + '<td>' + toEsc(f.note || f.src || '') + '</td></tr>';
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
  h += '<div class="hg-panel__legend" style="margin-top:14px">Top findings · crypto + gold</div>';
  h += renderTopFindings(desk);
  h += '<div class="note" style="margin-top:10px;line-height:1.5">Inspired by '
    + '<a href="https://github.com/ruvnet/ruflo" target="_blank" rel="noopener">Ruflo</a> agent roles — runs natively on HARDGATE gates, pine, gold, brain, CCXT, World Monitor. '
    + 'Set <code>HARDGATE_AGENT_SWARM=1</code> on the daemon for 24/7 headless cycles.</div>';
  ui.out.innerHTML = h;
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
    + '<div class="note">Eight specialist agents scan crypto + gold 24/7 using every HARDGATE strategy layer — gates, pine, gold, brain, funding, macro.</div>'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    + '<button type="button" class="hg-btn" id="agentSwarmBtn">SWARM SCAN</button>'
    + '<button type="button" class="btn ghost" id="agentDeskBtn">Refresh desk</button>'
    + '</div>'
    + '<div class="note" id="agentStat" style="margin-top:6px">idle</div>'
    + '<div id="agentOut" style="margin-top:8px"></div>'
    + '</div>';

  var ui = {
    stat: root.querySelector('#agentStat'),
    out: root.querySelector('#agentOut'),
    swarm: root.querySelector('#agentSwarmBtn'),
    desk: root.querySelector('#agentDeskBtn'),
  };

  fetch('/api/agents/capabilities', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(caps){
    if (ui.stat && caps && caps.agents){
      ui.stat.textContent = caps.agents.length + ' agents armed · Ruflo-inspired roles';
    }
  }).catch(function(){});

  if (ui.swarm) ui.swarm.addEventListener('click', function(){ return refreshAgentTab(ui, true); });
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
