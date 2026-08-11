/* =========================================================================
HARDGATE — startradertab.js
STAR TRADER tab — full CFD universe (crypto · gold · oil · indices · forex)
scanned with every gate/strategy module the app already ships.

Pure exports (never throw):
  stDropForming(rows, tf)
  stSynthesize(contract, rows4h, rows1h, rows15m, ticker) -> setup | null
  stTierRank(tier)

Registers window.HG_tabs id 'startrader' label 'STAR TRADER'.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var CHUNK = 4;
var CHUNK_MS = 160;
var MIN_BARS_4H = 210;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}
function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof W.fmt === 'function') return W.fmt(n, d);
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

var TIER_RANK = { WATCH: 1, HIGH: 2, PRIME: 3 };
var ST_EDGE_TF = '4h';
var ST_EDGE_KL = 300;
var ST_EDGE_CHUNK = 4;
var ST_EDGE_CHUNK_MS = 150;

function stWin(){
  try{
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
  }catch(e){}
  return W;
}

function stEdgeCore(){
  var g = stWin();
  return {
    drop: g.edgeDropForming,
    swingBias: g.edgeSwingBias,
    signal: g.edgeSignal,
    assess: g.edgeAssess,
    backtest: g.edgeBacktest,
    scanList: g.edgeScanList,
    cardHTML: g.edgeCardHTML
  };
}

function stEdgeHasCore(api){
  api = api || stEdgeCore();
  return api && typeof api.swingBias === 'function' && typeof api.signal === 'function'
    && typeof api.assess === 'function' && typeof api.backtest === 'function';
}

function stEdgeDrop(rows, tf){
  var drop = stEdgeCore().drop;
  if (typeof drop === 'function') return drop(rows, tf);
  return stDropForming(rows, tf);
}

/* Same loop as edge.js edgeScanList — used when an older cached edge.js lacks the export. */
async function stEdgeScanList(list, fetchCandles, hooks){
  var api = stEdgeCore();
  if (!stEdgeHasCore(api)) return null;
  hooks = hooks || {};
  var setProg = hooks.setProg || function(){};
  var setStat = hooks.setStat || function(){};
  var maxN = (hooks.maxUniverse > 0) ? hooks.maxUniverse : (list ? list.length : 0);
  var minTurn = (hooks.minTurnover !== undefined) ? hooks.minTurnover : 0;
  var skipped = 0, noBias = 0, noTrig = 0, tallyFail = 0, t0 = Date.now();
  var found = [];
  list = (list || []).filter(function(it){
    if (!it || !it.sym) return false;
    var t = it.turnoverUsd;
    if (t === null || t === undefined) return true;
    return t >= minTurn;
  });
  list.sort(function(a, b){ return ((b.turnoverUsd || 0) - (a.turnoverUsd || 0)); });
  if (maxN > 0) list = list.slice(0, maxN);
  if (!list.length) return { found: [], list: [], stats: { skipped: 0, noBias: 0, noTrig: 0, tallyFail: 0, t0: t0 } };

  for (var ci = 0; ci < list.length; ci += ST_EDGE_CHUNK){
    var chunk = list.slice(ci, ci + ST_EDGE_CHUNK);
    await Promise.all(chunk.map(async function(item, idx){
      var i = ci + idx;
      setProg((i + 1) / list.length);
      setStat('scanning ' + (i + 1) + '/' + list.length + ' · ' + item.sym + ' · '
        + Math.floor((Date.now() - t0) / 1000) + 's');
      try{
        var leg = await fetchCandles(item, ST_EDGE_TF, ST_EDGE_KL);
        var rows = leg && leg.rows;
        var src = (leg && leg.src) ? leg.src : (item.exchange || 'unknown');
        rows = stEdgeDrop(rows, ST_EDGE_TF);
        if (!rows || rows.length < 210){ skipped++; return; }
        if (!api.swingBias(rows)){ noBias++; return; }
        if (!api.signal(rows)){ noTrig++; return; }
        var assessed = api.assess(rows, item, src);
        if (!assessed){ tallyFail++; return; }
        var bt = api.backtest(rows);
        found.push({
          item: item, sym: item.sym, sig: assessed.sig, plan: assessed.plan,
          enrich: assessed.enrich, tally: assessed.tally, bt: bt, candleSrc: src
        });
      }catch(e){ skipped++; }
    }));
    await sleep(ST_EDGE_CHUNK_MS);
  }
  found.sort(function(a, b){
    return (b.tally - a.tally) || (b.bt.expR - a.bt.expR) || (b.sig.rr - a.sig.rr);
  });
  return { found: found, list: list, stats: { skipped: skipped, noBias: noBias, noTrig: noTrig, tallyFail: tallyFail, t0: t0 } };
}

function stEdgeScanFn(){
  var scan = stEdgeCore().scanList;
  return (typeof scan === 'function') ? scan : stEdgeScanList;
}

function stEdgeCardFn(r){
  var card = stEdgeCore().cardHTML;
  if (typeof card === 'function') return card(r);
  var sig = r.sig || {}, p = r.plan || {}, sym = (r.item && r.item.sym) || r.sym || '—';
  var plan = (p && isFinite(p.entry) && isFinite(p.stop))
    ? ('entry ' + pxF(p.entry) + ' · stop ' + pxF(p.stop)
      + (isFinite(p.t1) ? ' · T1 ' + pxF(p.t1) : ''))
    : 'levels unavailable';
  return '<div class="card ' + esc(sig.dir || '') + '"><div class="chead"><span class="sym">' + esc(sym)
    + '</span><span class="dir">' + esc((sig.dir || '').toUpperCase()) + ' · tally ' + (r.tally || 0)
    + '</span></div><div class="cbody"><span class="k">strategy</span><span>' + esc(sig.edge || 'EDGE')
    + '</span><span class="k">plan</span><span>' + plan + '</span></div></div>';
}

function stEdgeReadyMsg(){
  if (stEdgeHasCore()) return null;
  return 'edge.js not loaded — hard refresh (Ctrl+Shift+R) to pick up the latest scanner';
}

function stTierRank(t){ return TIER_RANK[t] || 0; }

function stDropForming(rows, tf){
  try{
    var sec = { '15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400 }[tf];
    if (!rows || !rows.length || !sec) return rows || [];
    var now = Math.floor(Date.now() / 1000);
    return (now - rows[rows.length - 1].t < sec) ? rows.slice(0, -1) : rows;
  }catch(e){ return rows || []; }
}

function stMajorityDir(votes){
  var lc = 0, sc = 0;
  for (var i = 0; i < votes.length; i++){
    if (votes[i].dir === 'long') lc++;
    else if (votes[i].dir === 'short') sc++;
  }
  if (lc > sc) return 'long';
  if (sc > lc) return 'short';
  return votes.length ? votes[0].dir : null;
}

/* Draft entry/SL/TP when confluence agrees but no 7/7 CLEAN plan — reuses swingTryNear/scalpTryNear. */
function stNearPlan(contract, dir, rows4h, rows1h, rows15m, ticker){
  try{
    contract = contract || {};
    if (!dir) return null;
    var isCrypto = contract.klass === 'crypto';
    var mins = 120;
    if (isCrypto && typeof W.tickClock === 'function'){
      try{ mins = W.tickClock(); }catch(e){}
    }
    var tk = isCrypto ? (ticker || { symbol: contract.sym, fundingPct: null })
      : { symbol: contract.sym, fundingPct: null };
    var best = null;
    if (typeof W.swingTryNear === 'function' && rows4h && rows4h.length >= MIN_BARS_4H){
      var sn = W.swingTryNear(rows4h, tk);
      if (sn && sn.dir === dir && isFinite(sn.entry) && isFinite(sn.stop)){
        best = Object.assign({}, sn, { planSrc: 'SWING NEAR', planDraft: true, nearClean: true });
      }
    }
    if (!best && typeof W.scalpTryNear === 'function' && rows1h && rows15m
        && rows1h.length >= 60 && rows15m.length >= 60){
      var scn = W.scalpTryNear(rows1h, rows15m, tk, mins);
      if (scn && scn.dir === dir && isFinite(scn.entry) && isFinite(scn.stop)){
        best = Object.assign({}, scn, { planSrc: 'SCALP NEAR', planDraft: true, nearClean: true });
      }
    }
    return best;
  }catch(e){ return null; }
}

function stNearPlanNote(p){
  if (!p || !p.planDraft) return '';
  var gp = isFinite(p.gatesPassed) ? p.gatesPassed : p.passed;
  var gt = isFinite(p.gatesTotal) ? p.gatesTotal : 7;
  var miss = (p.missing && p.missing.length) ? (' · missing ' + p.missing.join(', ')) : '';
  return 'NEAR ' + (gp || '?') + '/' + gt + ' — draft levels, not trade-ready' + miss;
}

function stNewsSym(contract){
  contract = contract || {};
  if (contract.gold || contract.sym === 'XAUUSD') return 'XAUUSD';
  if (contract.klass === 'fx' || contract.klass === 'metal' || contract.klass === 'commodity'
      || contract.klass === 'oil' || contract.klass === 'index' || contract.klass === 'etf'
      || contract.klass === 'share') return contract.sym;
  return contract.sym;
}

function stIsGoldLane(contract){
  return !!(contract && (contract.gold || contract.sym === 'XAUUSD' || contract.sym === 'GLD'));
}

function stIsMacroUsd(contract){
  var k = contract && contract.klass;
  return k === 'metal' || k === 'commodity' || k === 'oil' || k === 'fx' || k === 'index'
    || k === 'etf' || k === 'share' || stIsGoldLane(contract);
}

/* Shared market context — news, regime, sentiment, gold/macro layers (sync reads). */
function stBuildContext(){
  var g = stWin();
  var ctx = {};
  try{ if (typeof g.regimeState === 'function') ctx.regime = g.regimeState(); }catch(e){}
  try{ if (typeof g.hgNewsState === 'function') ctx.newsState = g.hgNewsState(); }catch(e){}
  try{ if (typeof g.rotationState === 'function') ctx.rotation = g.rotationState(); }catch(e){}
  try{ if (typeof g.onchainState === 'function') ctx.onchain = g.onchainState(); }catch(e){}
  try{ if (typeof g.goldspotState === 'function') ctx.goldBasis = g.goldspotState(); }catch(e){}
  ctx.goldSetup = g.__hgGoldSetupDecision || null;
  ctx.goldDeep = g.__hgGoldDeepVerdict || null;
  return ctx;
}

async function stWarmContext(){
  var g = stWin();
  var tasks = [];
  if (typeof g.hgNewsRefresh === 'function'){
    tasks.push(g.hgNewsRefresh(false).catch(function(){ return null; }));
  }
  if (typeof g.regimeWarm === 'function'){
    tasks.push(g.regimeWarm().catch(function(){ return null; }));
  }
  if (tasks.length) await Promise.all(tasks);
  var ctx = stBuildContext();
  if (typeof g.getGoldMacro === 'function'){
    try{ ctx.goldMacro = await g.getGoldMacro(); }catch(e){}
  }
  return ctx;
}

function stContextVotes(contract, dir, ctx, ticker, rows4h, rows1h, rows15m){
  var votes = [];
  ctx = ctx || {};
  var g = stWin();

  if (typeof g.hgNewsRisk === 'function'){
    try{
      var nr = g.hgNewsRisk(stNewsSym(contract));
      if (nr){
        if (nr.blackout) return { veto: true, reason: nr.note || 'NEWS BLACKOUT', votes: [] };
        if (nr.risk === 'high') votes.push({ src: 'NEWS', dir: dir, pts: 0, detail: 'high-impact horizon', caution: true });
        else if (nr.risk === 'med') votes.push({ src: 'NEWS', dir: dir, pts: 0, detail: 'med-impact ahead', caution: true });
        else votes.push({ src: 'NEWS', dir: dir, pts: 1, detail: 'calendar clear' });
      }
    }catch(e){}
  }

  if (ctx.newsState && ctx.newsState.fng){
    var fng = ctx.newsState.fng;
    var fv = (fng && isFinite(fng.value)) ? fng.value : (isFinite(fng) ? fng : null);
    if (fv !== null){
      if (contract.klass === 'crypto'){
        if (fv >= 75 && dir === 'long') votes.push({ src: 'SENTIMENT', dir: 'short', pts: 1, detail: 'F&G greed ' + fv });
        else if (fv <= 25 && dir === 'short') votes.push({ src: 'SENTIMENT', dir: 'long', pts: 1, detail: 'F&G fear ' + fv });
        else votes.push({ src: 'SENTIMENT', dir: dir, pts: 1, detail: 'F&G ' + fv });
      } else {
        votes.push({ src: 'SENTIMENT', dir: dir, pts: 1, detail: 'F&G ' + fv + ' (macro mood)' });
      }
    }
  }

  if (ctx.regime && ctx.regime.playbook){
    var pb = ctx.regime.playbook;
    var rl = ctx.regime.label || 'REGIME';
    if (pb.bias === 'LONG-ONLY' && dir === 'long') votes.push({ src: 'REGIME', dir: 'long', pts: 2, detail: rl + ' · long-only' });
    else if (pb.bias === 'SHORT-ONLY' && dir === 'short') votes.push({ src: 'REGIME', dir: 'short', pts: 2, detail: rl + ' · short-only' });
    else if (pb.bias === 'STAND-ASIDE') votes.push({ src: 'REGIME', dir: dir, pts: 0, detail: rl + ' · stand-aside', caution: true });
    else if (pb.bias === 'BOTH') votes.push({ src: 'REGIME', dir: dir, pts: 1, detail: rl + ' · selective' });
  }

  if (stIsGoldLane(contract)){
    if (ctx.goldSetup && ctx.goldSetup.dir && !ctx.goldSetup.aside){
      if (ctx.goldSetup.dir === dir) votes.push({ src: 'GOLD SETUP', dir: dir, pts: 3, detail: ctx.goldSetup.reason || 'gold composite' });
      else votes.push({ src: 'GOLD SETUP', dir: ctx.goldSetup.dir, pts: 1, detail: 'gold tab disagrees' });
    }
    if (ctx.goldDeep && ctx.goldDeep.dir === dir){
      votes.push({ src: 'GOLD DEEP', dir: dir, pts: 2, detail: ctx.goldDeep.label || '37-gate deep' });
    }
    if (ctx.goldBasis && ctx.goldBasis.verdict){
      if (ctx.goldBasis.verdict === 'longs-crowding' && dir === 'short')
        votes.push({ src: 'GOLD BASIS', dir: 'short', pts: 2, detail: 'longs crowding' });
      else if (ctx.goldBasis.verdict === 'shorts-crowding' && dir === 'long')
        votes.push({ src: 'GOLD BASIS', dir: 'long', pts: 2, detail: 'shorts crowding' });
    }
    if (typeof g.goldScalpSetups === 'function' && rows15m && rows15m.length >= 30){
      try{
        var gs = g.goldScalpSetups({ rows15m: rows15m, newsState: ctx.newsState });
        if (gs && gs.length){
          var top = gs[0];
          if (top && top.dir === dir) votes.push({ src: 'GOLD SCALP', dir: dir, pts: 2, detail: top.kind || 'gold scalp' });
        }
      }catch(e){}
    }
  }

  if (ctx.goldMacro && typeof g.goldProVerdict === 'function' && stIsMacroUsd(contract)){
    try{
      var gm = ctx.goldMacro;
      var gv = g.goldProVerdict({
        goldAbove200: gm.above200, dxyTrend: gm.dxyTrend, tnxTrend: gm.tnxTrend,
        realRateHint: gm.realRateHint, corr: gm.corr
      });
      if (gv && gv.dir === dir) votes.push({ src: 'MACRO', dir: dir, pts: 2, detail: gv.label || 'DXY/yield tilt' });
      else if (gv && gv.dir && gv.dir !== dir) votes.push({ src: 'MACRO', dir: gv.dir, pts: 1, detail: 'macro leans ' + gv.dir });
    }catch(e){}
  }

  if (contract.klass === 'crypto'){
    if (ctx.onchain && ctx.onchain.bias && ctx.onchain.bias === dir){
      votes.push({ src: 'ONCHAIN', dir: dir, pts: 1, detail: 'on-chain ' + dir });
    }
    if (ctx.rotation && typeof g.rotationSignal === 'function'){
      try{
        var rot = g.rotationSignal(ctx.rotation);
        if (rot && rot.season === 'altseason' && dir === 'long' && contract.base !== 'BTC'){
          votes.push({ src: 'ROTATION', dir: 'long', pts: 1, detail: 'altseason tailwind' });
        } else if (rot && rot.season === 'btcseason' && contract.base === 'BTC' && dir === 'long'){
          votes.push({ src: 'ROTATION', dir: 'long', pts: 1, detail: 'BTC season' });
        }
      }catch(e){}
    }
    if (typeof g.cryptoNewsGate === 'function'){
      try{
        var ng = g.cryptoNewsGate(contract.sym);
        if (ng && ng.blackout) return { veto: true, reason: ng.note || 'crypto news gate', votes: [] };
        if (ng && ng.caution) votes.push({ src: 'CRYPTO NEWS', dir: dir, pts: 0, detail: ng.note || 'headline caution', caution: true });
      }catch(e){}
    }
    if (typeof g.smartClassify === 'function' && ticker){
      try{
        var cls = g.smartClassify({
          chg24: ticker.chg24, oiChgPct: ticker.oiChgPct, fundingPct: ticker.fundingPct,
          turnoverUsd: ticker.turnoverUsd, mark: ticker.mark
        });
        if (cls && cls.dir === dir) votes.push({ src: 'SMART $', dir: dir, pts: 2, detail: (cls.regime && cls.regime[0]) || 'flow read' });
        if (typeof g.smartSetup === 'function' && cls){
          var ss = g.smartSetup(cls, rows4h, rows1h);
          if (ss && ss.dir === dir) votes.push({ src: 'SMART PLAN', dir: dir, pts: 2, plan: ss, detail: ss.type || 'smart plan' });
        }
      }catch(e){}
    }
    if (typeof g.oiflowClassify === 'function' && ticker){
      try{
        var oi = g.oiflowClassify({ fundingZ: null, oiChg: ticker.oiChgPct, pxChg: ticker.chg24 });
        if (oi && oi.dir === dir) votes.push({ src: 'OI FLOW', dir: dir, pts: 1, detail: oi.regime || 'positioning' });
      }catch(e){}
    }
  }

  if (typeof g.hgStructureGate === 'function' && rows4h && rows4h.length >= 40){
    try{
      var sg = g.hgStructureGate(rows4h, dir);
      if (sg && sg.veto) return { veto: true, reason: sg.note || 'structure veto', votes: [] };
      if (sg && sg.bos) votes.push({ src: 'STRUCTURE', dir: dir, pts: 2, detail: sg.note || 'BOS aligned' });
    }catch(e){}
  }

  if (typeof g.hgStructure === 'function' && rows4h && rows4h.length >= 40){
    try{
      var hs = g.hgStructure(rows4h);
      if (hs && (hs.dir === dir || hs.trend === dir)){
        votes.push({ src: 'STRUCTURE', dir: dir, pts: 1, detail: 'swing structure agrees' });
      }
    }catch(e){}
  }

  return { veto: false, votes: votes };
}

/* Multi-strategy synthesis — pure, vm-testable; optional ctx adds news/regime/sentiment/macro */
function stSynthesize(contract, rows4h, rows1h, rows15m, ticker, ctx){
  try{
    contract = contract || {};
    ticker = ticker || { symbol: contract.sym, fundingPct: null };
    if (!rows4h || rows4h.length < MIN_BARS_4H) return null;

    var votes = [];
    var points = 0;
    var isCrypto = contract.klass === 'crypto';

    if (typeof W.swingGateMatrix === 'function'){
      var sw = W.swingGateMatrix(rows4h, ticker);
      if (sw && sw.dir){
        if (sw.clean) votes.push({ src: 'SWING', dir: sw.dir, pts: 3, detail: '7/7 swing gates' });
        else if (sw.passed >= 6) votes.push({ src: 'SWING', dir: sw.dir, pts: 1, detail: sw.passed + '/7 swing gates' });
      }
    }
    if (typeof W.swingTryClean === 'function'){
      var st = W.swingTryClean(rows4h, ticker);
      if (st) votes.push({ src: 'SWING PLAN', dir: st.dir, pts: 3, plan: st, detail: fmtF(st.rr, 2) + 'R swing' });
    }

    if (rows1h && rows15m && rows1h.length >= 60 && rows15m.length >= 60){
      var mins = 120;
      if (isCrypto && typeof W.tickClock === 'function'){
        try{ mins = W.tickClock(); }catch(e){}
      }
      if (typeof W.scalpGateMatrix === 'function'){
        var sc = W.scalpGateMatrix(rows1h, rows15m, isCrypto ? ticker : { fundingPct: null }, mins);
        if (sc && sc.dir && sc.clean) votes.push({ src: 'SCALP', dir: sc.dir, pts: 2, detail: '7/7 scalp gates' });
        else if (sc && sc.dir && sc.passed >= 5) votes.push({ src: 'SCALP', dir: sc.dir, pts: 1, detail: sc.passed + '/7 scalp' });
      }
      if (typeof W.scalpTryClean === 'function'){
        var scp = W.scalpTryClean(rows1h, rows15m, isCrypto ? ticker : { fundingPct: null }, mins);
        if (scp) votes.push({ src: 'SCALP PLAN', dir: scp.dir, pts: 2, plan: scp, detail: fmtF(scp.rr, 2) + 'R scalp' });
      }
    }

    if (typeof W.edgeSwingBias === 'function' && W.edgeSwingBias(rows4h)){
      var es = (typeof W.edgeSignal === 'function') ? W.edgeSignal(rows4h) : null;
      if (es && es.dir){
        var item = { sym: contract.sym, base: contract.base, exchange: 'startrader', turnoverUsd: ticker.turnoverUsd || null };
        if (typeof W.edgeAssess === 'function'){
          var ea = W.edgeAssess(rows4h, item, 'startrader');
          if (ea && ea.sig){
            votes.push({ src: 'EDGE', dir: ea.sig.dir, pts: (ea.tally >= 4 ? 3 : 2),
              detail: 'tally ' + ea.tally, plan: ea.plan, edge: ea });
          }
        } else {
          votes.push({ src: 'EDGE', dir: es.dir, pts: 1, detail: 'edge trigger' });
        }
      }
    }

    if (typeof W.squeezeClassify === 'function' && rows1h && rows1h.length >= 30){
      var sq = W.squeezeClassify(rows4h, rows1h);
      if (sq && sq.state === 'FIRED_LONG') votes.push({ src: 'SQUEEZE', dir: 'long', pts: 2, detail: 'TTM fire long' });
      else if (sq && sq.state === 'FIRED_SHORT') votes.push({ src: 'SQUEEZE', dir: 'short', pts: 2, detail: 'TTM fire short' });
    }

    if (typeof W.mrSignal === 'function'){
      var mr = W.mrSignal(rows4h);
      if (mr && mr.dir) votes.push({ src: 'MEAN REV', dir: mr.dir, pts: 1, detail: mr.kind || 'MR' });
    }

    if (!votes.length) return null;

    var dir = stMajorityDir(votes);
    if (!dir) return null;

    if (ctx){
      var cx = stContextVotes(contract, dir, ctx, ticker, rows4h, rows1h, rows15m);
      if (cx && cx.veto) return null;
      if (cx && cx.votes && cx.votes.length){
        for (var cv = 0; cv < cx.votes.length; cv++) votes.push(cx.votes[cv]);
      }
      dir = stMajorityDir(votes);
      if (!dir) return null;
    }

    for (var v = 0; v < votes.length; v++) points += votes[v].pts;

    var agree = votes.filter(function(x){ return x.dir === dir; });
    var agreePts = 0;
    for (var a = 0; a < agree.length; a++) agreePts += agree[a].pts;

    var kinds = {};
    for (var k = 0; k < agree.length; k++) kinds[agree[k].src.split(' ')[0]] = true;
    var kindN = Object.keys(kinds).length;

    var tier = 'WATCH';
    var hasCleanSwing = agree.some(function(x){ return x.src.indexOf('SWING') === 0 && x.pts >= 3; });
    var hasCleanScalp = agree.some(function(x){ return x.src.indexOf('SCALP') === 0 && x.pts >= 2; });
    var hasEdgeStrong = agree.some(function(x){ return x.src === 'EDGE' && x.pts >= 3; });
    var hasContext = agree.some(function(x){
      return x.src === 'REGIME' || x.src === 'MACRO' || x.src === 'GOLD SETUP' || x.src === 'NEWS';
    });

    if (agreePts >= 7 && kindN >= 3 && (hasCleanSwing || hasEdgeStrong || hasContext)) tier = 'PRIME';
    else if (agreePts >= 5 && kindN >= 2 && (hasCleanSwing || hasCleanScalp || hasEdgeStrong || hasContext)) tier = 'HIGH';

    var plan = null;
    for (var p = 0; p < agree.length; p++){
      if (agree[p].plan){ plan = agree[p].plan; break; }
    }
    if (!plan && agree[0] && agree[0].edge && agree[0].edge.plan) plan = agree[0].edge.plan;
    var planDraft = false;
    if (!plan){
      var near = stNearPlan(contract, dir, rows4h, rows1h, rows15m, ticker);
      if (near){ plan = near; planDraft = true; }
    }

    return {
      sym: contract.sym,
      label: contract.label || contract.sym,
      klass: contract.klass || 'crypto',
      dir: dir,
      tier: tier,
      points: agreePts,
      totalPts: points,
      votes: agree,
      allVotes: votes,
      plan: plan,
      planDraft: planDraft,
      rows4h: rows4h,
      rows1h: rows1h,
      mark: (ticker && isFinite(ticker.mark)) ? ticker.mark : (rows4h.length ? rows4h[rows4h.length - 1].c : null)
    };
  }catch(e){ return null; }
}

function klassChip(k){
  var labels = {
    crypto: 'CRYPTO', metal: 'METAL', commodity: 'COMMODITY', oil: 'COMMODITY',
    index: 'INDEX', fx: 'FX', etf: 'ETF', share: 'SHARE'
  };
  return labels[k] || String(k || '').toUpperCase();
}

function stCardStack(r){
  try{
    var p = r && r.plan;
    var stackFn = (typeof W.hgSetupStackForInlineScan === 'function') ? W.hgSetupStackForInlineScan : null;
    if (!p || !stackFn || !r.dir) return null;
    var asset = (String(r.klass || '').toLowerCase().indexOf('metal') >= 0) ? 'gold' : 'crypto';
    var clean = !r.planDraft && (r.tier === 'PRIME' || r.tier === 'HIGH');
    var nearClean = !!r.planDraft || p.nearClean === true;
    var gp = isFinite(p.gatesPassed) ? p.gatesPassed : (nearClean ? 6 : (r.tier === 'WATCH' ? 5 : 6));
    return stackFn({
      dir: r.dir, sym: r.sym, rows4h: r.rows4h, style: 'startrader', asset: asset,
      clean: clean, nearClean: nearClean,
      gatesPassed: gp, gatesTotal: isFinite(p.gatesTotal) ? p.gatesTotal : 7,
      positioning: { items: (r.votes || []).slice(0, 4).map(function(v){
        return { label: v.src, detail: v.detail || '', align: v.dir === r.dir ? 'with' : 'against' };
      }) }
    });
  }catch(e){ return null; }
}

function cardHTML(r){
  var p = r.plan;
  var draft = !!(r.planDraft || (p && p.planDraft));
  var entry = p && isFinite(p.entry) ? p.entry : null;
  var stop = p && isFinite(p.stop) ? p.stop : null;
  var t1 = p && isFinite(p.t1) ? p.t1 : null;
  var tierCls = r.tier === 'PRIME' ? 'prime' : (r.tier === 'HIGH' ? 'high' : 'watch');
  var voteTxt = r.votes.map(function(v){ return v.src + ' (' + v.detail + ')'; }).join(' · ');
  var planBlk = '';
  if (entry != null && stop != null && typeof W.planBlock === 'function'){
    var planLbl = draft ? stNearPlanNote(p) : (r.tier + ' multi-strategy confluence');
    planBlk = W.planBlock(r.dir, entry, stop, t1, p && p.t2, planLbl);
  } else if (entry != null && stop != null){
    planBlk = '<div class="plan">entry ' + pxF(entry) + ' · stop ' + pxF(stop)
      + (t1 != null ? ' · T1 ' + pxF(t1) : '') + '</div>';
  }
  if (draft && entry != null && stop != null){
    planBlk += '<div class="note warn" style="margin-top:6px">' + esc(stNearPlanNote(p))
      + ' — wait for PRIME/HIGH or 7/7 CLEAN before booking.</div>';
  }
  var stFund = (function(){
    var k = String(r.klass || '').toLowerCase();
    if (k === 'metal' || k === 'metals') return 'gold';
    if (k === 'fx' || k === 'index' || k === 'commodity') return 'macro';
    return 'swing';
  })();
  var stStack = stCardStack(r);
  var stackHtml = (stStack && typeof W.hgSetupStackMiniHtml === 'function') ? W.hgSetupStackMiniHtml(stStack) : '';
  var bookBtn = (!draft && entry != null && stop != null && typeof W.bookBtnHTML === 'function')
    ? W.bookBtnHTML(r.sym, r.dir, entry, stop, t1, {
      scanner: 'startrader',
      fund: stFund,
      strategy: 'startrader', tier: r.tier, klass: r.klass, venue: 'startrader',
      layers: (r.votes || []).map(function(v){ return v.src; }),
      t2: p && isFinite(p.t2) ? p.t2 : null,
      stack: stStack
    }) : '';
  var tradeOnclick = (!draft && entry != null && stop != null && (typeof W.hgToTradePlanOnclickAttr === 'function' || typeof W.toTrade === 'function'))
    ? ((typeof W.hgToTradePlanOnclickAttr === 'function')
      ? W.hgToTradePlanOnclickAttr(r.sym, r.dir, entry, stop, t1, { t2: p && isFinite(p.t2) ? p.t2 : null, stack: stStack, scanner: 'startrader', strategy: 'startrader' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(r.dir) + ',' + entry + ',' + stop + ',' + (t1 != null ? t1 : 'null') + ')'))
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var visionChip = (!draft && r.visionChip) ? ' <span class="gpip ok">' + esc(r.visionChip) + '</span>' : '';
  var visionHtml = (!draft && typeof W.hgChartVisionCardBlock === 'function') ? W.hgChartVisionCardBlock(r) : '';
  return '<div class="card ' + tierCls + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span>'
    + '<span class="gpip">' + klassChip(r.klass) + '</span>'
    + '<span class="dir">' + r.dir.toUpperCase() + ' · ' + r.tier + visionChip + '</span>'
    + (typeof W.hgBookStampChip === 'function' ? W.hgBookStampChip(r.sym, r.dir, { scanner: 'startrader', strategy: 'startrader', fund: stFund, klass: r.klass }) : '')
    + '</div>'
    + '<div class="cbody">'
    + '<span class="k">asset</span><span>' + esc(r.label) + '</span>'
    + '<span class="k">confluence</span><span>' + r.points + ' pts · ' + r.votes.length + ' reads agree</span>'
    + '<span class="k">strategies</span><span>' + esc(voteTxt) + '</span>'
    + '<span class="k">mark</span><span>' + pxF(r.mark) + '</span>'
  + '</div>' + planBlk + visionHtml + stackHtml + tradeBtn + bookBtn + '</div>';
}

var __st = { busy: false, ranOnce: false, run: null };
var __stEdge = { busy: false, ranOnce: false, run: null };
var __stGoldScalp = { section: null };
var __stGoldSwing = { section: null };

function stEdgeUniverse(contracts, tickers){
  var tmap = {};
  for (var ti = 0; ti < (tickers || []).length; ti++) tmap[tickers[ti].symbol] = tickers[ti];
  return (contracts || []).map(function(c){
    var tk = tmap[c.sym] || {};
    return {
      sym: c.sym, base: c.base, exchange: 'startrader', klass: c.klass, label: c.label,
      turnoverUsd: (tk.turnoverUsd != null) ? tk.turnoverUsd : null,
      fundingPct: (tk.fundingPct != null) ? tk.fundingPct : null,
      mark: tk.mark
    };
  });
}

function stEdgeCandleSrc(sym){
  try{
    var c = (typeof startraderContract === 'function') ? startraderContract(sym) : null;
    if (!c) return 'startrader';
    if (c.klass === 'crypto') return 'startrader-binance';
    if (c.gold) return 'startrader-gold';
    if (c.yahoo || c.klass === 'etf' || c.klass === 'share') return 'startrader-yahoo';
    return 'startrader';
  }catch(e){ return 'startrader'; }
}

function mount(el){
  el.innerHTML =
    '<div class="row st-subnav" style="margin-bottom:12px;flex-wrap:wrap;gap:6px">'
    + '<button type="button" class="btn ghost st-subtab active" data-st-pane="main">CONFLUENCE</button>'
    + '<button type="button" class="btn ghost st-subtab" data-st-pane="edge">EDGE</button>'
    + '<button type="button" class="btn ghost st-subtab" data-st-pane="goldscalp">GOLD SCALP</button>'
    + '<button type="button" class="btn ghost st-subtab" data-st-pane="goldswing">GOLD SWING</button>'
    + '</div>'
    + '<div id="stPaneMain">'
    + '<div class="panel">'
    + '<h2>STAR TRADER <span>crypto · metals · commodities · indices · forex · ETFs · shares · multi-factor confluence</span></h2>'
    + '<div class="note" style="margin-bottom:10px">Scans the full STARTRADER CFD universe with every gate the app ships: '
    + '<b>SWING</b> · <b>SCALP</b> · <b>EDGE</b> · <b>SQUEEZE</b> · <b>MEAN REV</b> plus '
    + '<b>NEWS</b> · <b>REGIME</b> · <b>SENTIMENT</b> (F&amp;G) · <b>MACRO</b> (DXY/yields for USD assets) · '
    + '<b>GOLD</b> layers on XAU/GLD · <b>STRUCTURE</b> · <b>SMART $</b> / <b>OI FLOW</b> on crypto. '
    + 'News blackout = hard veto. Crypto: Binance proxy; metals/commodities/FX/indices/ETFs/shares: Yahoo via /api/proxy. '
    + '<b>PRIME</b> = 3+ strategy families + regime/macro/gold context; <b>HIGH</b> = 2+ families with a clean plan. '
    + '<b>WATCH</b> cards may show <b>NEAR draft</b> entry/SL/TP (6/7 gates) — levels only, not bookable until CLEAN.</div>'
    + '<div class="row"><button class="btn" id="stRun">SCAN STAR TRADER</button>'
    + '<span class="note" id="stStat"></span></div>'
    + '<div class="prog" id="stProg"><i></i></div>'
    + '</div>'
    + '<div class="cards" id="stCards"></div>'
    + '<div class="empty" id="stEmpty" style="display:none">No solid STARTRADER setups right now. Standing aside is a position.</div>'
    + '</div>'
    + '<div id="stPaneEdge" style="display:none">'
    + '<div class="panel">'
    + '<h2>STAR TRADER EDGE <span>same SWING-aligned EDGE logic as the EDGE tab · full CFD universe</span></h2>'
    + '<p class="note">Runs the <b>identical EDGE scanner</b> as the main EDGE tab: 4H SWING cascade bias, pullback/sweep/range entries,'
    + ' confluence tally, backtest record, and trade-plan levels — scoped to every STARTRADER contract.'
    + ' Crypto uses Binance proxy; gold/oil/FX/indices use the same routed feeds as the confluence scan above.</p>'
    + '<div class="row"><button class="btn" id="stEdgeRun">FIND EDGE SETUPS</button>'
    + '<span class="note" id="stEdgeStat">idle — SWING-aligned · all STARTRADER contracts</span></div>'
    + '<div class="prog" id="stEdgeProg"><i></i></div>'
    + '</div>'
    + '<div class="cards" id="stEdgeCards"></div>'
    + '<div class="empty" id="stEdgeEmpty" style="display:none">No SWING-aligned EDGE entries on STARTRADER right now.</div>'
    + '</div>'
    + '<div id="stPaneGoldScalp" style="display:none"></div>'
    + '<div id="stPaneGoldSwing" style="display:none"></div>';

  function stShowPane(name){
    el.querySelectorAll('.st-subtab').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-st-pane') === name);
    });
    var panes = { main: 'stPaneMain', edge: 'stPaneEdge', goldscalp: 'stPaneGoldScalp', goldswing: 'stPaneGoldSwing' };
    Object.keys(panes).forEach(function(k){
      var pane = el.querySelector('#' + panes[k]);
      if (pane) pane.style.display = (k === name) ? '' : 'none';
    });
    if (name === 'goldscalp') stEnsureGoldScalp();
    if (name === 'goldswing') stEnsureGoldSwing();
  }

  function stEnsureGoldScalp(){
    if (__stGoldScalp.section) return;
    var host = el.querySelector('#stPaneGoldScalp');
    if (!host) return;
    if (typeof W.goldscalpMountSection !== 'function'){
      host.innerHTML = '<p class="note warn">goldscalp.js not loaded — check script order.</p>';
      return;
    }
    __stGoldScalp.section = W.goldscalpMountSection(host);
  }

  function stEnsureGoldSwing(){
    if (__stGoldSwing.section) return;
    var host = el.querySelector('#stPaneGoldSwing');
    if (!host) return;
    if (typeof W.goldswingMountSection !== 'function'){
      host.innerHTML = '<p class="note warn">goldswing.js not loaded — check script order.</p>';
      return;
    }
    __stGoldSwing.section = W.goldswingMountSection(host);
  }

  el.querySelectorAll('.st-subtab').forEach(function(btn){
    btn.addEventListener('click', function(){
      stShowPane(btn.getAttribute('data-st-pane') || 'main');
    });
  });

  var btn = el.querySelector('#stRun');
  var stat = el.querySelector('#stStat');
  var prog = el.querySelector('#stProg');
  var cards = el.querySelector('#stCards');
  var empty = el.querySelector('#stEmpty');
  var edgeBtn = el.querySelector('#stEdgeRun');
  var edgeStat = el.querySelector('#stEdgeStat');
  var edgeProg = el.querySelector('#stEdgeProg');
  var edgeCards = el.querySelector('#stEdgeCards');
  var edgeEmpty = el.querySelector('#stEdgeEmpty');

  function setProg(f){
    if (!prog) return;
    prog.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && prog.firstElementChild) prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setStat(txt, warn){
    if (!stat) return;
    stat.textContent = txt || '';
    stat.className = warn ? 'note warn' : 'note';
  }

  function setEdgeProg(f){
    if (!edgeProg) return;
    edgeProg.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && edgeProg.firstElementChild) edgeProg.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setEdgeStat(txt, warn){
    if (!edgeStat) return;
    edgeStat.textContent = txt || '';
    edgeStat.className = warn ? 'note warn' : 'note';
  }

  if (typeof startraderAllContracts !== 'function'){
    setStat('startrader.js not loaded', true);
    btn.disabled = true;
    if (edgeBtn) edgeBtn.disabled = true;
    return;
  }
  var edgeWarn = stEdgeReadyMsg();
  if (edgeWarn) setEdgeStat(edgeWarn, true);

  btn.addEventListener('click', function(){ runScan(); });
  if (edgeBtn) edgeBtn.addEventListener('click', function(){ runEdgeScan(); });

  async function runScan(){
    if (__st.busy) return 'busy';
    __st.busy = true;
    __st.ranOnce = true;
    btn.disabled = true;
    cards.innerHTML = '';
    empty.style.display = 'none';
    setProg(0);
    var t0 = Date.now();
    var skipped = 0, found = [];
    try{
      setStat('warming news · regime · macro…');
      var ctx = await stWarmContext();
      var contracts = startraderAllContracts();
      var tickers = (typeof startraderFullTickers === 'function') ? await startraderFullTickers() : [];
      var tmap = {};
      for (var ti = 0; ti < tickers.length; ti++) tmap[tickers[ti].symbol] = tickers[ti];

      for (var ci = 0; ci < contracts.length; ci += CHUNK){
        var chunk = contracts.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(c, idx){
          var i = ci + idx;
          setProg((i + 1) / contracts.length);
          setStat('scanning ' + (i + 1) + '/' + contracts.length + ' · ' + c.sym + ' · '
            + Math.floor((Date.now() - t0) / 1000) + 's');
          try{
            var h4 = stDropForming(await startraderCandles(c.sym, '4h', 280), '4h');
            var h1 = stDropForming(await startraderCandles(c.sym, '1h', 160), '1h');
            var m15 = stDropForming(await startraderCandles(c.sym, '15m', 180), '15m');
            if (!h4 || h4.length < MIN_BARS_4H){ skipped++; return; }
            var tk = tmap[c.sym] || { symbol: c.sym, fundingPct: null, mark: null };
            var setup = stSynthesize(c, h4, h1, m15, tk, ctx);
            if (setup) found.push(setup);
          }catch(e){ skipped++; }
        }));
        await sleep(CHUNK_MS);
      }

      found.sort(function(a, b){
        return stTierRank(b.tier) - stTierRank(a.tier) || b.points - a.points;
      });

      var show = found.filter(function(x){ return x.tier === 'PRIME' || x.tier === 'HIGH'; });
      if (!show.length) show = found.slice(0, 12);

      if (!show.length){
        empty.style.display = 'block';
        setStat('done — 0 setups / ' + contracts.length + ' contracts · ' + skipped + ' thin · '
          + Math.floor((Date.now() - t0) / 1000) + 's');
        return;
      }
      cards.innerHTML = show.map(cardHTML).join('');
      if (typeof W.hgChartVisionEnrichDeskRows === 'function'){
        var stWraps = show.filter(function(r){
          return !r.planDraft && r.rows4h && (r.tier === 'PRIME' || r.tier === 'HIGH');
        }).map(function(r){
          var p = r.plan || {};
          return {
            sym: r.sym, dir: r.dir, rows4h: r.rows4h,
            entry: p.entry, stop: p.stop, t1: p.t1,
            clean: true, tier: 'clean', style: 'startrader', asset: 'crypto', timeframe: '4h',
            __ref: r
          };
        });
        W.hgChartVisionEnrichDeskRows(stWraps, function(w){ return w.rows4h; }, {
          limit: 12,
          repaint: function(){ cards.innerHTML = show.map(cardHTML).join(''); }
        });
      }
      var primes = show.filter(function(x){ return x.tier === 'PRIME'; }).length;
      var highs = show.filter(function(x){ return x.tier === 'HIGH'; }).length;
      setStat('done — ' + show.length + ' shown (' + primes + ' PRIME · ' + highs + ' HIGH) / '
        + contracts.length + ' contracts · ' + Math.floor((Date.now() - t0) / 1000) + 's');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) || e), true);
    }finally{
      setProg(null);
      btn.disabled = false;
      __st.busy = false;
    }
    return 'refreshed';
  }

  __st.run = runScan;

  async function runEdgeScan(){
    if (__stEdge.busy) return 'busy';
    var edgeMsg = stEdgeReadyMsg();
    if (edgeMsg){
      setEdgeStat(edgeMsg, true);
      return 'unavailable';
    }
    var scanFn = stEdgeScanFn();
    __stEdge.busy = true;
    __stEdge.ranOnce = true;
    edgeBtn.disabled = true;
    edgeCards.innerHTML = '';
    edgeEmpty.style.display = 'none';
    setEdgeProg(0);
    try{
      var contracts = startraderAllContracts();
      var tickers = (typeof startraderFullTickers === 'function') ? await startraderFullTickers() : [];
      var uni = stEdgeUniverse(contracts, tickers);
      var res = await scanFn(uni, async function(item, tf, n){
        var rows = await startraderCandles(item.sym, tf, n);
        return { rows: rows, src: stEdgeCandleSrc(item.sym) };
      }, {
        setProg: setEdgeProg,
        setStat: setEdgeStat,
        maxUniverse: uni.length || 200,
        minTurnover: 0
      });
      var found = res.found;
      var list = res.list;
      var st = res.stats;
      if (!found.length){
        edgeEmpty.style.display = 'block';
        setEdgeStat('done — 0 setups / ' + list.length + ' · ' + st.noBias + ' no SWING bias · '
          + st.noTrig + ' no trigger · ' + st.tallyFail + ' below tally · ' + st.skipped + ' thin · '
          + Math.floor((Date.now() - st.t0) / 1000) + 's');
        return;
      }
      var longs = found.filter(function(x){ return x.sig.dir === 'long'; }).length;
      var shorts = found.length - longs;
      edgeCards.innerHTML = found.map(stEdgeCardFn).join('');
      setEdgeStat('done — ' + found.length + ' SWING-aligned (' + longs + 'L/' + shorts + 'S) / '
        + list.length + ' contracts · ' + Math.floor((Date.now() - st.t0) / 1000) + 's');
    }catch(e){
      setEdgeStat('scan failed: ' + ((e && e.message) || e), true);
    }finally{
      setEdgeProg(null);
      edgeBtn.disabled = false;
      __stEdge.busy = false;
    }
    return 'refreshed';
  }

  __stEdge.run = runEdgeScan;
}

function startraderTabRefresh(){
  try{
    if (__st.busy || __stEdge.busy) return 'busy';
    if (__stGoldScalp.section && __stGoldScalp.section.scanSt && __stGoldScalp.section.scanSt.busy) return 'busy';
    if (__stGoldSwing.section && __stGoldSwing.section.scanSt && __stGoldSwing.section.scanSt.busy) return 'busy';
    var tasks = [];
    if (__st.ranOnce && typeof __st.run === 'function') tasks.push(__st.run());
    if (__stEdge.ranOnce && typeof __stEdge.run === 'function') tasks.push(__stEdge.run());
    if (__stGoldScalp.section && __stGoldScalp.section.scanSt && __stGoldScalp.section.scanSt.hasRun
        && typeof __stGoldScalp.section.refresh === 'function'){
      tasks.push(__stGoldScalp.section.refresh());
    }
    if (__stGoldSwing.section && __stGoldSwing.section.scanSt && __stGoldSwing.section.scanSt.hasRun
        && typeof __stGoldSwing.section.refresh === 'function'){
      tasks.push(__stGoldSwing.section.refresh());
    }
    if (!tasks.length) return 'skipped: not run yet';
    return Promise.all(tasks).then(function(){ return 'refreshed'; });
  }catch(e){ return 'refreshed'; }
}

W.stDropForming = stDropForming;
W.stNearPlan = stNearPlan;
W.stNearPlanNote = stNearPlanNote;
W.stSynthesize = stSynthesize;
W.stTierRank = stTierRank;
W.stEdgeScanList = stEdgeScanList;
W.stEdgeHasCore = stEdgeHasCore;
W.stBuildContext = stBuildContext;
W.stContextVotes = stContextVotes;
W.stWarmContext = stWarmContext;
W.cardHTML = cardHTML;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'startrader', label: 'STAR TRADER', mount: mount, refresh: startraderTabRefresh });

})();
