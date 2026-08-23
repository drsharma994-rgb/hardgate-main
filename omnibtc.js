/* =========================================================================
HARDGATE — omnibtc.js
OMNIBTC — Bitcoin only. Every house strategy and indicator bank is pointed
at BTC, then the desk keeps ONE most-probable setup.

WHY THIS TAB EXISTS. The rest of CRYPTO scans a universe. This tab answers
a narrower question: given everything HARDGATE already knows how to read,
what is the single most probable BTC setup right now?

ENGINES ACTUALLY CALLED, because this header used to name three it never
invoked (squeeze, PINE and structure were listed and never wired):
  SWING clean + near-clean ... swingTryClean / swingTryNear
  SCALP clean .............. scalpTryClean
  EDGE ..................... edgeSignal
  MEAN REVERSION ........... mrSignal
  REVERSAL SNIPER .......... rsAssess
  LIQUIDITY FLUSH .......... liqFlushSetup
  SQUEEZE .................. squeezeClassify -> squeezeGateEval -> squeezePlan
  TREND MATRIX ............. trendScore -> trendmxGateEval -> trendmxPlan
  OMNIROUTE ................ hgOmniEvaluate
  CONTRACT REPORT .......... hgContractReportRun (every gate + indicator)
  20-gate indicator bank ... hgStrategyRefine
  SMART $ / OI FLOW ........ classify + setup (omnibtc-engines.js)
  FUNDING FADE ............. swingTryFundingFade / scalpTryFundingFade
  COIL / DIV / TRAP ........ same gates as those CRYPTO tabs
  SMC ...................... pineSmcCore last-bar ChoCh
  STAR TRADER .............. stSynthesize (votes the engines above)
  ONCHAIN / TERM / CARRY ... evidence only — confirm / demote / refuse
  PINE ..................... READ ONLY. pineScan() is a snapshot the PINE tab
                             computes; this reads a BTC row when one is
                             already there and contributes nothing when it is
                             not. It never runs pine and never mints a signal
                             pine did not produce.

Extra engines never claim 7/7 CLEAN. That badge stays on swingTryClean /
scalpTryClean. APEX is alts-versus-BTC, so it is not called. BEST is the
same 7/7 swing path already run. SUPER and BRAIN need a warmed multi-asset
snap — they are not invented here from an empty board.

Structure (FVG / order blocks) is deliberately NOT listed as an engine: those
are detectors that feed the planners above, not producers of a ticket.

WHAT IT WILL NOT DO.
  - It will not invent a new BTC strategy.
  - It will not mint ENTRY / STOP / T1. Levels come from existing engines.
  - It will not promote alts or gold. Non-BTC rows are dropped before rank.
  - It will not use contract-report's "derived structure" fallback (that
    path writes numbers when no engine produced a ticket).
  - It will not loosen G1–G7.

ONE SETUP. CLEAN with real levels wins. Else the best 6/7 NEAR (watch,
not a ticket). Else WAIT. Standing aside is the position.

VENUES. Delta BTCUSD and CoinDCX B-BTC_USDT when dual-scan is on (the
house default). Both legs feed one pick — two venues, still one card.

Classic script, IIFE. Never throws at load. Every engine is feature-checked.
refresh() is async, never throws, and never launches a first-time scan on
a global hard refresh.
========================================================================= */
'use strict';

(function(){

  var W = (typeof window !== 'undefined') ? window : globalThis;
  var __obtc = { ui: null, busy: false, ran: false, snap: null, lastStat: '' };

  function gfn(name){
    return (W && typeof W[name] === 'function') ? W[name] : null;
  }
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hgObtcIsBtc(sym){
    try{
      var raw = String(sym || '');
      var s = raw.replace(/^B-/, '').replace(/_/g, '');
      if (gfn('hgIsBtcSymbol') && !W.hgIsBtcSymbol(raw)) return false;
      return /^(BTCUSD|BTCUSDT)$/i.test(s);
    }catch(e){ return false; }
  }

  function hgObtcFilterUniverse(items){
    var out = [], i, it, sym, base;
    if (!Array.isArray(items)) return out;
    for (i = 0; i < items.length; i++){
      it = items[i];
      if (!it) continue;
      sym = it.sym || it.symbol || '';
      if (!hgObtcIsBtc(sym)) continue;
      base = it.base != null ? String(it.base).toUpperCase() : '';
      if (base && base !== 'BTC') continue;
      out.push(it);
    }
    return out;
  }

  function isDerivedSource(src){
    var s = String(src || '').toLowerCase();
    if (s.indexOf('derived') < 0) return false;
    return s.indexOf('structure') >= 0 || s.indexOf('no engine') >= 0;
  }

  function hgObtcHasLevels(row){
    if (gfn('hgSetupHasLevels')) return W.hgSetupHasLevels(row);
    if (!row) return false;
    var e = fin(row.entry), s = fin(row.stop), t1 = fin(row.t1);
    return isFinite(e) && e > 0 && isFinite(s) && s > 0 && e !== s && isFinite(t1) && t1 > 0;
  }

  function hgObtcCandidateFromSignal(r, ticker, opts){
    opts = opts || {};
    if (!r || typeof r !== 'object') return null;
    var src = String(r.source || r.name || opts.engine || '');
    if (isDerivedSource(src) || isDerivedSource(r.source)) return null;
    var sym = String((ticker && (ticker.symbol || ticker.sym)) || r.sym || r.symbol || opts.sym || '');
    if (!hgObtcIsBtc(sym)) return null;
    var dir = String(r.dir || r.side || r.direction || '').toLowerCase();
    if (dir === 'buy' || dir === 'l') dir = 'long';
    if (dir === 'sell' || dir === 's') dir = 'short';
    if (dir !== 'long' && dir !== 'short') return null;
    var entry = fin(r.entry), stop = fin(r.stop), t1 = fin(r.t1);
    if (!(isFinite(entry) && entry > 0 && isFinite(stop) && stop > 0 && entry !== stop && isFinite(t1) && t1 > 0))
      return null;
    var passed = fin(r.passed != null ? r.passed : r.gatesPassed);
    var total = fin(r.total != null ? r.total : r.gatesTotal);
    if (!isFinite(total) || total <= 0) total = 7;
    var detail = String(r.detail || '');
    var clean = !!(r.clean || (isFinite(passed) && passed >= 7) || /clean/i.test(detail));
    var near = !clean && !!(r.near || r.nearClean || (isFinite(passed) && passed === 6));
    var forming = !clean && !near && !!(r.forming || (isFinite(passed) && passed >= 5));
    var t2 = fin(r.t2);
    var risk = Math.abs(entry - stop);
    var rr = fin(r.rr);
    if (!isFinite(rr) && risk > 0) rr = Math.abs(t1 - entry) / risk;
    var row = {
      sym: sym,
      dir: dir,
      entry: entry,
      stop: stop,
      t1: t1,
      venue: (ticker && (ticker.exchange || ticker.venue)) || r.venue || opts.venue || '',
      rr: rr,
      passed: isFinite(passed) ? passed : undefined,
      gatesPassed: isFinite(passed) ? passed : undefined,
      gatesTotal: total,
      engine: src || 'engine',
      strategy: src || 'engine',
      clean: clean,
      near: near,
      nearClean: near,
      forming: forming
    };
    if (isFinite(t2) && t2 > 0) row.t2 = t2;
    if (clean){ row.near = false; row.nearClean = false; row.forming = false; }
    return row;
  }

  function hgObtcCandidatesFromReport(report, ticker){
    var out = [], i, j, sec, r, c;
    if (!report) return out;
    if (report.plan && report.plan.ok && !isDerivedSource(report.plan.source)){
      c = hgObtcCandidateFromSignal(report.plan, ticker, { engine: report.plan.source });
      if (c) out.push(c);
    }
    var sections = report.sections || [];
    for (i = 0; i < sections.length; i++){
      sec = sections[i];
      if (!sec || !Array.isArray(sec.rows)) continue;
      for (j = 0; j < sec.rows.length; j++){
        r = sec.rows[j];
        if (!r || r.state !== 'signal') continue;
        c = hgObtcCandidateFromSignal(r, ticker, { engine: r.name });
        if (c) out.push(c);
      }
    }
    return out;
  }

  function hgObtcPick(cands){
    var btc = [], i, n, raw;
    for (i = 0; i < (cands || []).length; i++){
      raw = cands[i];
      n = gfn('hgNormalizeSetupRow') ? W.hgNormalizeSetupRow(raw) : (hgObtcHasLevels(raw) ? raw : null);
      if (!n || !hgObtcIsBtc(n.sym) || !hgObtcHasLevels(n)) continue;
      n.engine = raw.engine || raw.strategy || n.engine;
      n.strategy = raw.strategy || raw.engine || n.strategy;
      n.venue = raw.venue || n.venue;
      n.passed = n.passed != null ? n.passed : raw.passed;
      n.gatesPassed = n.gatesPassed != null ? n.gatesPassed : raw.gatesPassed;
      n.gatesTotal = n.gatesTotal || raw.gatesTotal || 7;
      if (gfn('hgLiveFormationApply')){
        try{
          var live = gfn('hgLiveFormationSnap') ? W.hgLiveFormationSnap(n.sym, n.dir) : null;
          var app = W.hgLiveFormationApply(n, live, { preserveLevels: true });
          if (app && app.ok === false) continue;
          if (app && app.plan) n = app.plan;
        }catch(eLive){}
      }
      if (gfn('hgObtcApplyEvidence')){
        try{
          var evApp = W.hgObtcApplyEvidence(n, raw._extra || n._extra || null);
          if (evApp && evApp.ok === false) continue;
          if (evApp && evApp.row) n = evApp.row;
        }catch(eEv){}
      }
      btc.push(n);
    }
    if (!btc.length) return null;
    var pick = gfn('hgPickMostProbableAny') ? W.hgPickMostProbableAny(btc) : { row: btc[0], tier: 'clean', source: 'clean' };
    if (!pick || !pick.row || !hgObtcIsBtc(pick.row.sym) || !hgObtcHasLevels(pick.row)) return null;
    pick.row.engine = pick.row.engine || btc[0].engine;
    pick.row.strategy = pick.row.strategy || pick.row.engine;
    return pick;
  }

  function hgObtcDefaultLegs(){
    var dual = true;
    try{ if (gfn('hgDualScanEnabled')) dual = !!W.hgDualScanEnabled(); }catch(e){}
    var delta = { exchange: 'delta', sym: 'BTCUSD', base: 'BTC' };
    var cdcx = { exchange: 'coindcx', sym: 'B-BTC_USDT', base: 'BTC' };
    if (dual) return [delta, cdcx];
    var ex = (W.S && W.S.exchange) || 'delta';
    return ex === 'coindcx' ? [cdcx] : [delta];
  }

  function tickerOf(item){
    return {
      symbol: item.sym || item.symbol || 'BTCUSD',
      fundingPct: item.fundingPct,
      mark: item.mark,
      exchange: item.exchange || item.venue || ''
    };
  }

  async function hgObtcResolveLegs(){
    var out = [];
    if (gfn('xuUniverse')){
      try{
        var uni = await W.xuUniverse();
        out = hgObtcFilterUniverse(uni);
      }catch(e){ out = []; }
    }
    if (!out.length) out = hgObtcDefaultLegs();
    return hgObtcFilterUniverse(out);
  }

  async function loadBars(item, tf, n){
    if (gfn('xuCandles')){
      try{
        var rows = await W.xuCandles(item, tf, n);
        if (Array.isArray(rows) && rows.length) return rows;
      }catch(e){}
    }
    if (gfn('getCandles')){
      try{
        var g = await W.getCandles(item.sym || item.symbol, tf, n);
        if (Array.isArray(g) && g.length) return g;
      }catch(e2){}
    }
    return [];
  }

  function pushEngine(out, name, fn, ticker){
    try{
      var hit = fn();
      if (!hit) return;
      if (hit.dir && hit.entry != null && hit.t1 == null && hit.tp != null) hit.t1 = hit.tp;
      var c = hgObtcCandidateFromSignal(hit, ticker, { engine: name });
      if (c) out.push(c);
    }catch(e){}
  }

  function hgObtcRunLocalEngines(rows4h, rows1h, rows15m, ticker, rows1d){
    var out = [];
    var mins = 120;
    try{ if (gfn('tickClock')) mins = W.tickClock(); }catch(e){}
    if (gfn('swingTryClean'))
      pushEngine(out, 'SWING clean plan', function(){ return W.swingTryClean(rows4h, ticker); }, ticker);
    if (gfn('swingTryNear')){
      try{
        var near = W.swingTryNear(rows4h, ticker);
        if (near){
          near.nearClean = true;
          if (near.passed == null) near.passed = 6;
          var nc = hgObtcCandidateFromSignal(near, ticker, { engine: 'SWING near-clean watch' });
          if (nc){ nc.clean = false; nc.near = true; nc.nearClean = true; out.push(nc); }
        }
      }catch(e2){}
    }
    if (gfn('scalpTryClean'))
      pushEngine(out, 'SCALP clean plan', function(){ return W.scalpTryClean(rows1h, rows15m, ticker, mins); }, ticker);
    if (gfn('edgeSignal'))
      pushEngine(out, 'EDGE', function(){ return W.edgeSignal(rows4h); }, ticker);
    if (gfn('mrSignal'))
      pushEngine(out, 'MEAN REVERSION', function(){ return W.mrSignal(rows4h); }, ticker);
    if (gfn('rsAssess'))
      pushEngine(out, 'REVERSAL SNIPER', function(){ return W.rsAssess(rows4h, rows1h || rows4h, ticker); }, ticker);
    if (gfn('liqFlushSetup'))
      pushEngine(out, 'LIQUIDITY FLUSH', function(){
        var flush = gfn('hgLiveLiqFlushSetup') || W.liqFlushSetup;
        var snap = gfn('liqRecoverSnap') ? W.liqRecoverSnap() : null;
        return snap ? flush(snap, rows4h) : flush(rows4h, ticker);
      }, ticker);
    /* SQUEEZE. The tab header has always claimed squeeze and never called it.
       Wired the way squeeze.js wires itself: the pure classifier gives the
       direction, the gate evaluates it, and squeezePlan mints the levels — a
       BUILDING squeeze has no direction and therefore no ticket, which is the
       module's own rule, not a new one. */
    if (gfn('squeezeClassify') && gfn('squeezePlan') && rows4h && rows4h.length){
      try{
        var cls = W.squeezeClassify(rows4h, rows1d || null);
        var sqDir = null, sqKind = null;
        if (cls && cls.state === 'FIRED_LONG'){ sqDir = 'long';  sqKind = 'fired'; }
        else if (cls && cls.state === 'FIRED_SHORT'){ sqDir = 'short'; sqKind = 'fired'; }
        else if (cls && cls.donchianBreak){
          sqDir = (cls.donchianBreak === 'LONG') ? 'long' : 'short'; sqKind = 'break';
        }
        if (sqDir){
          var sqInp = { sym: ticker.symbol, dir: sqDir, cls: cls, kind: sqKind,
                        rows4h: rows4h, rows1h: rows1h || null, tick: ticker };
          if (gfn('squeezeGateEval')) sqInp.gate = W.squeezeGateEval(sqInp, sqDir);
          pushEngine(out, 'SQUEEZE ' + sqKind, function(){ return W.squeezePlan(sqInp); }, ticker);
        }
      }catch(eSq){}
    }

    /* TREND MATRIX. trendScore is a pure read over 1d + 4h; tmDirOf turns a
       composite at or beyond the module's own majority threshold into a
       direction, and anything short of that produces no ticket. */
    if (gfn('trendScore') && gfn('trendmxPlan') && rows4h && rows4h.length){
      try{
        var tsc = W.trendScore(rows1d || null, rows4h);
        if (tsc && isFinite(tsc.score) && Math.abs(tsc.score) >= 2){
          var tmInp = { sym: ticker.symbol, score: tsc.score, comps: tsc.comps,
                        rows4h: rows4h, rows1h: rows1h || null, tick: ticker };
          var tmDir = tsc.score > 0 ? 'long' : 'short';
          if (gfn('trendmxGateEval')) tmInp.gate = W.trendmxGateEval(tmInp, tmDir);
          pushEngine(out, 'TREND MATRIX', function(){ return W.trendmxPlan(tmInp); }, ticker);
        }
      }catch(eTm){}
    }

    /* PINE. pineScan() is a SNAPSHOT reader, not a per-symbol scanner — the
       PINE tab computes it. So this reads a BTC row if one is already there
       and contributes nothing when it is not. It never runs pine itself, and
       it never invents a signal pine did not produce. */
    if (gfn('pineScan')){
      try{
        var snap = W.pineScan();
        var list = (snap && (snap.rows || snap.signals || snap.results)) || null;
        if (Array.isArray(list)){
          list.forEach(function(sig){
            var sym = sig && (sig.sym || sig.symbol);
            if (!sym || !hgObtcIsBtc(sym)) return;
            var plan = sig.plan || sig;
            pushEngine(out, 'PINE ' + (sig.kind || sig.name || 'signal'),
                       function(){ return plan; }, ticker);
          });
        }
      }catch(ePn){}
    }

    if (gfn('hgOmniEvaluate')){
      try{
        var omni = W.hgOmniEvaluate({
          sym: ticker.symbol, base: 'BTC', exchange: ticker.exchange || 'delta'
        }, rows4h, null, null);
        if (Array.isArray(omni)){
          omni.forEach(function(hit){
            var plan = hit && (hit.plan || hit);
            var c = hgObtcCandidateFromSignal(plan, ticker, { engine: (hit && hit.kind) || 'OMNIROUTE' });
            if (c) out.push(c);
          });
        }
      }catch(e3){}
    }
    return out;
  }

  function waitHtml(){
    return '<div class="note" role="status">WAIT — no house engine produced a BTC ticket with real ENTRY / STOP / T1. '
      + 'Standing aside is the position. Nothing was invented.</div>';
  }

  function detailHtml(pick){
    if (!pick || !pick.row || !hgObtcHasLevels(pick.row)) return waitHtml();
    var r = pick.row;
    var tier = String(pick.tier || 'clean').toLowerCase();
    var clean = tier === 'clean';
    var html = '<div class="card" data-obtc-winner="1">';
    html += '<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">';
    html += '<div><b>' + esc(r.sym) + '</b> ' + esc(String(r.dir || '').toUpperCase());
    html += '<div class="dim">' + esc(r.engine || r.strategy || 'engine');
    if (r.venue) html += ' · ' + esc(String(r.venue).toUpperCase());
    html += clean ? ' · ticket' : ' · watch only</div></div>';
    if (r.evidenceChips && r.evidenceChips.length){
      html += '<div class="dim" style="width:100%">' + esc(r.evidenceChips.join(' · ')) + '</div>';
    }
    if (gfn('hgBookStampChip')){
      try{ html += W.hgBookStampChip(r.sym, r.dir, { scanner: 'omnibtc', strategy: r.engine }); }catch(e){}
    }
    html += '</div>';
    if (gfn('hgStrategyTradeDetailHtml')){
      try{ html += W.hgStrategyTradeDetailHtml(r, { scanner: 'omnibtc', kind: r.engine }); }catch(e2){}
    }
    if (clean){
      html += '<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">';
      if (gfn('bookBtnHTML')){
        try{
          html += W.bookBtnHTML(r.sym, r.dir, r.entry, r.stop, r.t1, {
            scanner: 'omnibtc', strategy: r.engine || 'omnibtc', venue: r.venue, t2: r.t2
          });
        }catch(e3){}
      }
      if (gfn('hgToTradePlanOnclickAttr')){
        try{
          html += '<button type="button" class="btn" onclick="'
            + W.hgToTradePlanOnclickAttr(r.sym, r.dir, r.entry, r.stop, r.t1, {
              scanner: 'omnibtc', strategy: r.engine, venue: r.venue, t2: r.t2
            })
            + '">SEND TO TRADE PLAN →</button>';
        }catch(e4){}
      }
      html += '</div>';
    } else {
      html += '<div class="note" style="margin-top:8px">Watch only — not trade-ready until a CLEAN engine ticket prints.</div>';
    }
    html += '</div>';
    return html;
  }

  function indicatorsHtml(indicators){
    if (!indicators || !indicators.length){
      return '<div class="note">No indicator bank ran — engines were missing or candles were too thin.</div>';
    }
    var html = '<div class="cr-ind-wrap">';
    indicators.forEach(function(ind){
      html += '<div class="kv"><span class="k">' + esc(ind.label) + '</span><span class="v">'
        + esc(ind.value) + (ind.note ? ' <span class="dim">' + esc(ind.note) + '</span>' : '')
        + '</span></div>';
    });
    return html + '</div>';
  }

  function ledgerHtml(report){
    if (!report || !report.sections){
      return '<div class="note">Engine ledger empty — contract-report.js did not run.</div>';
    }
    if (gfn('hgContractReportHTML')){
      try{ return W.hgContractReportHTML(report); }catch(e){}
    }
    var html = '';
    report.sections.forEach(function(sec){
      html += '<h4 style="margin:12px 0 6px;letter-spacing:.06em">' + esc(sec.label || sec.id) + '</h4>';
      (sec.rows || []).forEach(function(r){
        html += '<div class="kv"><span class="k">' + esc(r.name) + '</span><span class="v">'
          + esc(r.state || '—') + (r.dir ? ' · ' + esc(r.dir) : '')
          + (r.detail ? ' · ' + esc(r.detail) : '')
          + '</span></div>';
      });
    });
    return html;
  }

  function paint(ui, snap){
    if (!ui) return;
    var pick = snap && snap.pick;
    if (ui.stat){
      ui.stat.textContent = snap && snap.stat ? snap.stat : '';
    }
    if (ui.cards){
      ui.cards.innerHTML = '';
      if (pick && hgObtcHasLevels(pick.row)){
        if (gfn('hgPinMostProbablePanel')) W.hgPinMostProbablePanel(ui.cards, 'omnibtc', pick);
        else if (gfn('hgMpPin')) W.hgMpPin('omnibtc', [pick.row], pick.row.dir, ui.cards);
        else if (gfn('hgMostProbablePanelHTML')) ui.cards.innerHTML = W.hgMostProbablePanelHTML('omnibtc', pick);
      }
    }
    if (ui.detail) ui.detail.innerHTML = pick ? detailHtml(pick) : waitHtml();
    if (ui.ind) ui.ind.innerHTML = indicatorsHtml(snap && snap.indicators);
    if (ui.ledger){
      var extraHtml = '';
      if (snap && snap.extraLedger && snap.extraLedger.length){
        extraHtml = '<h4 style="margin:12px 0 6px;letter-spacing:.06em">EXTRA BTC ENGINES</h4>';
        snap.extraLedger.forEach(function(r){
          extraHtml += '<div class="kv"><span class="k">' + esc(r.name) + '</span><span class="v">'
            + esc(r.state || '—') + (r.dir ? ' · ' + esc(r.dir) : '')
            + (r.detail ? ' · ' + esc(r.detail) : '')
            + '</span></div>';
        });
      }
      ui.ledger.innerHTML = extraHtml + ledgerHtml(snap && snap.report);
    }
  }

  function setStat(ui, msg){
    __obtc.lastStat = msg;
    if (ui && ui.stat) ui.stat.textContent = msg;
  }

  async function hgObtcRunScan(ui){
    ui = ui || __obtc.ui;
    if (!ui) return 'no ui';
    if (__obtc.busy) return 'busy';
    __obtc.busy = true;
    if (ui.btn) ui.btn.disabled = true;
    setStat(ui, 'scanning BTC…');
    try{
      var legs = await hgObtcResolveLegs();
      legs = hgObtcFilterUniverse(legs);
      if (!legs.length){
        var snap0 = { pick: null, legs: [], candidates: [], stat: 'no BTC contract on the venue', indicators: [], report: null };
        __obtc.snap = snap0;
        __obtc.ran = true;
        paint(ui, snap0);
        setStat(ui, snap0.stat);
        return snap0.stat;
      }
      var all = [];
      var reports = [];
      var indicators = [];
      var extraLedger = [];
      var extra = {};
      var winnerRows = null;
      var i, item, tk, r4, r1, r15, r1d, cands, rep, extraRun;
      for (i = 0; i < legs.length; i++){
        item = legs[i];
        if (!hgObtcIsBtc(item.sym || item.symbol)) continue;
        tk = tickerOf(item);
        r4 = await loadBars(item, '4h', 220);
        r1 = await loadBars(item, '1h', 180);
        r15 = await loadBars(item, '15m', 180);
        /* the 1d leg is what squeezeClassify and trendScore read for the
           higher-timeframe agreement they gate on; without it both degrade to
           an honest zero rather than a guess */
        r1d = await loadBars(item, '1d', 260);
        if (gfn('hgLiveFormationGather')){
          try{ await W.hgLiveFormationGather(tk.symbol, { ticker: tk, fetch: true }); }catch(eG){}
        }
        extra = extra || {};
        if (gfn('hgObtcGatherExtra')){
          try{ extra = await W.hgObtcGatherExtra(tk.symbol, tk) || extra; }catch(eX){}
        }
        if (gfn('hgContractReportRun')){
          try{
            rep = W.hgContractReportRun({
              sym: tk.symbol, venue: tk.exchange, ticker: tk,
              rows4h: r4, rows1h: r1, rows15m: r15
            });
            reports.push(rep);
            cands = hgObtcCandidatesFromReport(rep, tk);
            if (rep.indicators && rep.indicators.length && !indicators.length) indicators = rep.indicators;
          }catch(eRep){
            rep = null;
            cands = [];
          }
        } else {
          rep = null;
          cands = [];
        }
        cands = cands.concat(hgObtcRunLocalEngines(r4, r1, r15, tk, r1d));
        if (gfn('hgObtcRunExtraEngines')){
          try{
            extraRun = W.hgObtcRunExtraEngines(r4, r1, r15, tk, extra);
            if (extraRun && Array.isArray(extraRun.candidates))
              cands = cands.concat(extraRun.candidates);
            if (extraRun && Array.isArray(extraRun.ledger) && extraRun.ledger.length)
              extraLedger = extraLedger.concat(extraRun.ledger);
          }catch(eEx){}
        }
        cands.forEach(function(c){ c._rows = r4; c._ticker = tk; c._extra = extra; });
        all = all.concat(cands);
      }
      var pick = hgObtcPick(all);
      if (pick && pick.row && gfn('hgPostGateSetupVeto')){
        try{
          var vetoTk = (all.filter(function(c){
            return c.sym === pick.row.sym && c.dir === pick.row.dir
              && c.entry === pick.row.entry;
          })[0] || {})._ticker || { symbol: pick.row.sym };
          var vetoRows = (all.filter(function(c){
            return c.sym === pick.row.sym && c.entry === pick.row.entry;
          })[0] || {})._rows;
          var veto = await W.hgPostGateSetupVeto(vetoTk, pick.row, vetoRows, 'swing', gfn('getCandles') || gfn('xuCandles'));
          if (veto && veto.ok === false){
            all = all.filter(function(c){
              return !(c.sym === pick.row.sym && c.dir === pick.row.dir
                && c.entry === pick.row.entry && c.stop === pick.row.stop);
            });
            pick = hgObtcPick(all);
          }
        }catch(eVt){}
      }
      if (pick && pick.row && gfn('hgChartVisionAnalyze') && gfn('hgChartVisionFormationBoost')){
        try{
          var vRows = (all.filter(function(c){
            return c.sym === pick.row.sym && c.entry === pick.row.entry;
          })[0] || {})._rows;
          var analysis = await W.hgChartVisionAnalyze(Object.assign({}, pick.row, { rows: vRows, rows4h: vRows }));
          var boost = W.hgChartVisionFormationBoost(pick.row.dir, analysis);
          if (typeof boost === 'number' && boost <= -10){
            pick.row.clean = false;
            pick.row.near = true;
            pick.row.nearClean = true;
            pick.tier = 'near';
          }
        }catch(eVi){}
      }
      if (pick && pick.row){
        var match = all.filter(function(c){
          return c.sym === pick.row.sym && c.dir === pick.row.dir
            && c.entry === pick.row.entry && c.stop === pick.row.stop;
        })[0];
        winnerRows = match && match._rows;
        if (gfn('hgStrategyRefine') && winnerRows && winnerRows.length){
          try{
            W.hgStrategyRefine(pick.row, winnerRows, {
              scanner: 'omnibtc', kind: pick.row.engine || 'setup'
            });
          }catch(eRef){}
        }
      }
      var winRep = null;
      if (pick && reports.length){
        winRep = reports.filter(function(r){ return r && hgObtcIsBtc(r.sym) && r.sym === pick.row.sym; })[0] || reports[0];
        if (winRep && winRep.indicators) indicators = winRep.indicators;
      }
      var nClean = all.filter(function(c){ return c.clean; }).length;
      var stat = pick
        ? ('BTC · ' + legs.length + ' venue' + (legs.length === 1 ? '' : 's')
          + ' · ' + all.length + ' levelled read' + (all.length === 1 ? '' : 's')
          + ' · ' + nClean + ' CLEAN · one MOST PROBABLE')
        : ('BTC · ' + legs.length + ' venue' + (legs.length === 1 ? '' : 's')
          + ' · no engine produced a ticket — WAIT');
      var snap = {
        pick: pick,
        legs: legs,
        candidates: all.map(function(c){
          return { sym: c.sym, dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1, engine: c.engine, clean: !!c.clean, near: !!c.near };
        }),
        stat: stat,
        indicators: indicators,
        report: winRep,
        extraLedger: extraLedger
      };
      __obtc.snap = snap;
      __obtc.ran = true;
      paint(ui, snap);
      setStat(ui, stat);
      return stat;
    }catch(e){
      var fail = 'scan failed — nothing invented';
      setStat(ui, fail);
      if (ui.detail) ui.detail.innerHTML = waitHtml();
      return fail;
    }finally{
      __obtc.busy = false;
      if (ui.btn) ui.btn.disabled = false;
    }
  }

  function mountOmnibtc(el){
    if (!el) return;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OMNIBTC — Bitcoin only <span>every house strategy + indicator bank · one MOST PROBABLE setup</span></h2>'
      + '<div class="note" style="margin-bottom:10px">BTC is the whole universe. SWING, SCALP, EDGE, PINE, squeeze, '
      + 'mean-reversion, sniper, liquidity, SMART $, OI FLOW, funding-fade, COIL, DIV, TRAP, SMC and STAR TRADER '
      + 'all read the same coin on Delta and CoinDCX. ONCHAIN / TERM / CARRY confirm, demote or refuse — they never mint levels. '
      + 'The desk then keeps <b>one</b> setup: 7/7 CLEAN with real ENTRY / STOP / T1 wins; otherwise the nearest watch; '
      + 'otherwise WAIT. Extra engines never claim 7/7. G1–G7 stay as they are.</div>'
      + '<div class="note" id="obtcStat" aria-live="polite">idle — press SCAN BTC.</div>'
      + '<div class="row" style="margin-top:8px"><button type="button" class="btn" id="obtcRun">SCAN BTC</button></div>'
      + '<div class="cards" id="obtcCards" style="margin-top:12px"></div>'
      + '<div id="obtcDetail" style="margin-top:12px"></div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">INDICATOR BANK</h3>'
      + '<div id="obtcInd" class="note">Run a scan to read BTC.</div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">STRATEGY LEDGER</h3>'
      + '<div id="obtcLedger" class="note">Every engine that ran — including the ones that said nothing.</div>'
      + '</div>';
    var ui = {
      btn: el.querySelector('#obtcRun'),
      stat: el.querySelector('#obtcStat'),
      cards: el.querySelector('#obtcCards'),
      detail: el.querySelector('#obtcDetail'),
      ind: el.querySelector('#obtcInd'),
      ledger: el.querySelector('#obtcLedger')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __obtc.ui = ui;
    ui.btn.addEventListener('click', function(){ return hgObtcRunScan(ui); });
    if (__obtc.snap) paint(ui, __obtc.snap);
  }

  function refreshOmnibtc(){
    return Promise.resolve().then(function(){
      if (__obtc.busy) return 'busy';
      if (!__obtc.ran) return 'skipped: not run yet';
      var ui = __obtc.ui;
      if (ui) return hgObtcRunScan(ui).then(function(){ return __obtc.lastStat || 'rescanned'; });
      return __obtc.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  W.hgObtcIsBtc = hgObtcIsBtc;
  W.hgObtcFilterUniverse = hgObtcFilterUniverse;
  W.hgObtcCandidateFromSignal = hgObtcCandidateFromSignal;
  W.hgObtcCandidatesFromReport = hgObtcCandidatesFromReport;
  W.hgObtcPick = hgObtcPick;
  W.hgObtcDefaultLegs = hgObtcDefaultLegs;
  W.hgObtcRunScan = hgObtcRunScan;
  /* exported so the engine wiring is testable on its own: which engines get
     called, and — more importantly — which correctly decline */
  W.hgObtcRunLocalEngines = hgObtcRunLocalEngines;
  W.hgObtcState = function(){
    try{ return __obtc.snap ? JSON.parse(JSON.stringify(__obtc.snap)) : null; }catch(e){ return null; }
  };
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'omnibtc', label: 'OMNIBTC', mount: mountOmnibtc, refresh: refreshOmnibtc });
})();
