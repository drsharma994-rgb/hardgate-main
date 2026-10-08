           minted tiers; anything below the NEAR floor (or a forming row with
           no majority, whose gate is null) is the house DRAFT ladder, never
           a fabricated 6/7 NEAR. */
        if (tier === 'clean') return lvl + ' - 7/7 CLEAN';
        if (tier === 'near'){
          var gates = (rr.gate && isFinite(rr.gate.gatesPassed)) ? rr.gate.gatesPassed : 0;
          return lvl + ' - ' + gates + '/7 NEAR';
        }
        return lvl + ' - DRAFT';
      }
      return 'no levels - the gates have not met';
    }
    function cell(rr){
      var dd = tmDirOf(rr);
      var lean = dd ? 0 : (+rr.score > 0 ? 1 : (+rr.score < 0 ? -1 : 0));
      var tag = dd === 'long' ? '<span class="pos">LONG</span>'
        : dd === 'short' ? '<span class="neg">SHORT</span>'
        : lean === 1 ? '<span class="pos">LONG-LEAN</span>'
        : lean === -1 ? '<span class="neg">SHORT-LEAN</span>'
        : '<span>NO LEAN</span>';
      /* hg-v1057: the FORMING column names WHY nothing formed — a choppy tape
         is CHOP (no trend to ride, whatever the lean), a clean directional
         tape with a lean but no majority is EARLY FORMING, and a mixed tape
         prints neither (no verdict). The TRENDING column is untouched: its
         rows already have a majority. */
      var formTag = '';
      if (!dd){
        var fs = trendmxChopState(rr);
        if (fs && fs.state === 'chop') formTag = ' · CHOP';
        else if (fs && fs.state === 'trend') formTag = ' · EARLY FORMING';
      }
      var lvl = (dd || lean !== 0) ? lvlLine(rr, dd || (lean === 1 ? 'long' : 'short'))
        : 'no lean - composite 0/5, no levels';
      if (rr.unread){
        return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(rr.sym) + '</b> <span>UNREAD</span>'
          + '<div style="opacity:.9;font-size:11px;margin-top:2px">CoinDCX contract on the board. No candle series, so no setup.</div></div>';
      }
      return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(rr.sym) + '</b> ' + tag
        + '<div style="opacity:.9;font-size:11px;margin-top:2px">composite ' + (rr.score > 0 ? '+' : '') + rr.score + '/5' + formTag + (rr.freshCross ? ' - !' + escH(rr.freshCross) : '') + '</div>'
        + '<div style="font-size:11px;margin-top:4px;letter-spacing:.02em">' + lvl + '</div></div>';
    }
    function col(title, cls, list, emptyTxt){
      var h = '<div class="panel" style="border-top:3px solid ' + cls + '"><h3 style="margin:0 0 8px">' + title
        + ' <span style="opacity:.6;font-weight:400">- ' + list.length + ' contract' + (list.length === 1 ? '' : 's') + '</span></h3>';
      if (!list.length) h += '<div class="empty" style="margin:6px 0">' + emptyTxt + '</div>';
      else h += list.map(cell).join('');
      return h + '</div>';
    }
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;align-items:start">'
      + col('TRENDING', '#26a69a', byStrength(trending), 'no trending CoinDCX contracts - composite below +/-2')
      + col('FORMING', '#f59e0b', byStrength(forming), 'no forming CoinDCX contracts')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1069: the grid-setup block — the OMNIBTC dual-grid treatment on
   the matrix crown: each grid stands on its own direction, tier and
   levels, and a grid that disagrees with the call is stamped, never
   hidden. */
function trendmxGridBlockHtml(title, gridLbl, s, callDir){
  try{
    if (!s || !isFinite(+s.entry) || !isFinite(+s.stop) || !isFinite(+s.t1)) return '';
    var dir = String(s.dir || '').toLowerCase();
    var against = dir && callDir && dir !== callDir;
    var risk = Math.abs(+s.entry - +s.stop);
    var rr = risk > 0 ? Math.abs(+s.t1 - +s.entry) / risk : NaN;
    var tierTxt = s.tier === 'CLEAN' ? '7/7 CLEAN' : (s.tier === 'NEAR' ? (s.gates != null ? s.gates + '/7 NEAR' : '6/7 NEAR') : 'DRAFT');
    var color = dir === 'long' ? '#26a69a' : (dir === 'short' ? '#ef5350' : '#94a3b8');
    return '<div class="panel" style="margin-top:10px;border-top:3px solid ' + color + '"><h3>' + title
      + ' <span>' + gridLbl + ' - ' + tierTxt + (s.source ? ' - ' + escH(s.source) : '') + (against ? ' - AGAINST THE CALL' : '') + '</span></h3>'
      + '<div class="kv"><span class="k">Bias</span><span class="v ' + (dir === 'long' ? 'pos' : 'neg') + '">' + dir.toUpperCase() + '</span></div>'
      + '<div class="kv"><span class="k">ENTRY</span><span class="v">' + (+s.entry).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">STOP</span><span class="v">' + (+s.stop).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">T1</span><span class="v">' + (+s.t1).toFixed(2) + (isFinite(rr) ? ' (' + rr.toFixed(1) + 'R)' : '') + '</span></div>'
      + (isFinite(+s.t2) ? '<div class="kv"><span class="k">T2</span><span class="v">' + (+s.t2).toFixed(2) + '</span></div>' : '')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1066: THE CROWN — the OMNIBTC treatment on the TREND MATRIX: a
   single bold call (the strongest majority row with a minted plan), a
   verdict line, the five-dimension complete analysis from the row's own
   reads plus the world tilt, the setup card with the automation JSON,
   and the measured-edge chip for the TRENDMX pool. Evidence, never a
   gate. */
function trendmxCrownPanelHTML(state){
  try{
    state = state || {};
    var rows = Array.isArray(state.rows) ? state.rows.slice() : [];
    if (!rows.length) return '';
    rows.sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
    var crown = null, plan = null, dir = null, i, r, d;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      d = tmDirOf(r);
      if (!d) continue;
      var p = trendmxPlan(Object.assign({}, r, { dir: d }));
      if (p){ crown = r; plan = p; dir = d; break; }
    }
    if (!crown || !plan) return '';
    var tier = trendmxRowTier(crown, plan);
    var tierTxt = tier === 'clean' ? 'TICKET' : (tier === 'near' ? 'WATCH' : 'LEADER');
    var conv = trendmxConviction(crown);
    var color = dir === 'long' ? '#26a69a' : (dir === 'short' ? '#ef5350' : '#94a3b8');
    var html = '';
    /* ---- THE CALL ---- */
    html += '<div class="panel" style="margin-top:10px;border-top:3px solid ' + color + '"><h3>THE CALL</h3>'
      + '<div style="font-size:16px;font-weight:700">' + dir.toUpperCase() + ' - ' + tierTxt
      + ' - composite ' + (crown.score > 0 ? '+' : '') + crown.score + '/5'
      + (conv ? ' - ' + conv.label : '') + '</div></div>';
    /* ---- VERDICT ---- */
    var gatesTxt = (crown.gate && isFinite(crown.gate.gatesPassed)) ? crown.gate.gatesPassed + '/7' : '?/7';
    html += '<div class="panel" style="margin-top:10px"><h3>CROWN VERDICT <span>the desk\'s complete verdict on the leading row</span></h3>'
      + '<div style="font-size:12px;letter-spacing:.03em">TREND MATRIX | ' + tierTxt
      + (crown.perfectPlus ? ' | PERFECT+' : (crown.perfect ? ' | PERFECT' : '')) + ' | gates ' + gatesTxt + '</div></div>';
    /* ---- COMPLETE ANALYSIS ---- */
    var comps = crown.comps || {};
    var pfR = crown.perfectReads || {};   /* hg-v1144: the free-resource bag from the shared-perfect pass */
    function chip(v, cls){ return '<span class="gpip' + (cls || '') + '">' + escH(v) + '</span>'; }
    function dim(title, verdict, cls, lines){
      if (!lines.length) return '';
      return '<div style="margin:8px 0 2px"><b>' + title + '</b> ' + chip(verdict, cls)
        + '<div style="font-size:11px;opacity:.9;margin-top:2px">' + lines.join(' | ') + '</div></div>';
    }
    var tech = [];
    if (comps.d200 !== undefined && comps.d200 !== null) tech.push('1D vs EMA200 ' + (comps.d200 > 0 ? 'BULL' : 'BEAR'));
    if (comps.x !== undefined && comps.x !== null) tech.push('EMA50/200 ' + (comps.x > 0 ? 'GOLDEN' : 'DEATH'));
    if (comps.h4 !== undefined && comps.h4 !== null) tech.push('4H cascade ' + (comps.h4 > 0 ? 'bull' : 'bear'));
    if (comps.cloud !== undefined && comps.cloud !== null) tech.push('cloud ' + (comps.cloud > 0 ? 'above' : 'below'));
    if (isFinite(+crown.adx)) tech.push('ADX ' + (+crown.adx).toFixed(1));
    if (isFinite(+pfR.dvolVal)) tech.push('DVOL ' + (+pfR.dvolVal).toFixed(1) + (pfR.dvolRegime ? ' ' + String(pfR.dvolRegime) : ''));
    if (pfR.pineLorKnn || pfR.pineHalfTrend || pfR.pineSqueeze || pfR.pineSmf || pfR.pineMsb){
      var pineBits = [];
      if (pfR.pineLorKnn) pineBits.push('LorKNN ' + pfR.pineLorKnn);
      if (pfR.pineHalfTrend) pineBits.push('half-trend ' + pfR.pineHalfTrend);
      if (pfR.pineSqueeze) pineBits.push('squeeze ' + pfR.pineSqueeze);
      if (pfR.pineSmf) pineBits.push('SMF ' + pfR.pineSmf);
      if (pfR.pineMsb) pineBits.push('MSB ' + pfR.pineMsb);
      tech.push('PINE ' + pineBits.join(' | '));
    }
    html += '<div class="panel" style="margin-top:10px"><h3>COMPLETE ANALYSIS <span>technical - sentimental - fundamental - macro - micro</span></h3>';
    html += dim('TECHNICAL', Math.abs(+crown.score || 0) >= 2 ? 'ALIGNED' : 'NEUTRAL', '', tech);
    var sent = [];
    if (isFinite(+crown.fundingPct)) sent.push('funding ' + (+crown.fundingPct).toFixed(4) + '%');
    if (crown.flow) sent.push('flow ' + escH(String(crown.flow)));
    html += dim('SENTIMENTAL', sent.length ? 'NEUTRAL' : 'UNREAD', '', sent);
    var fund = [];
    if (crown.fundState) fund.push(escH(String(crown.fundState)));
    html += dim('FUNDAMENTAL', fund.length ? 'NEUTRAL' : 'UNREAD', '', fund);
    var mac = [], mTilt = 'UNREAD', mCls = '';
    try{
      var wm = (typeof W.getWorldMonitorDeskCached === 'function') ? W.getWorldMonitorDeskCached() : null;
      var rg = (typeof W.regimeState === 'function') ? W.regimeState() : null;
      if (wm && wm.macro && wm.macro.verdict) mac.push('WM ' + String(wm.macro.verdict).toUpperCase());
      if (wm && wm.stress && wm.stress.label) mac.push('stress ' + String(wm.stress.label).toUpperCase());
      if (rg && rg.playbook && rg.playbook.bias) mac.push('bias ' + String(rg.playbook.bias).toUpperCase());
      if (rg && rg.dxy && (rg.dxy.trend20 || rg.dxy.trend)) mac.push('DXY ' + String(rg.dxy.trend20 || rg.dxy.trend).toUpperCase());
      if (mac.length){
        var off = (wm && wm.macro && (wm.macro.verdict === 'SELL' || wm.macro.verdict === 'AVOID'))
          || (rg && rg.playbook && rg.playbook.bias === 'STAND-ASIDE')
          || (wm && wm.stress && /HIGH|ELEVATED/i.test(String(wm.stress.label)));
        mTilt = off ? 'RISK-OFF' : ((wm && wm.macro && wm.macro.verdict === 'BUY') ? 'RISK-ON' : 'NEUTRAL');
        if (mTilt === 'RISK-OFF') mCls = ' bad';
      }
    }catch(eWm){ }
    try{
      var wmAtT = (typeof W.getWorldMonitorDeskAge === 'function') ? W.getWorldMonitorDeskAge() : null;
      if (wmAtT) mac.push('WM ' + Math.max(0, Math.round((Date.now() - wmAtT) / 60000)) + 'm old');
      if (rg && rg.at) mac.push('regime ' + Math.max(0, Math.round((Date.now() - +rg.at) / 60000)) + 'm old');
    }catch(eAge){ }
    mac.push('world tilt ' + mTilt);
    html += dim('MACRO', mTilt, mCls, mac);
    var mic = [];
    var risk = Math.abs(+plan.entry - +plan.stop);
    if (risk > 0 && isFinite(+plan.t1)) mic.push('R:R ' + (Math.abs(+plan.t1 - +plan.entry) / risk).toFixed(1) + 'R');
    if (typeof hgCryptoCostR === 'function' && isFinite(+plan.entry) && isFinite(+plan.stop)){
      var costR = hgCryptoCostR(+plan.entry, +plan.stop, 'taker', 'taker');
      if (isFinite(costR)) mic.push('cost ' + costR.toFixed(2) + 'R' + (costR > 0.25 ? ' - COST-HEAVY' : ''));
    }
    if (isFinite(+crown.price) && isFinite(+plan.entry)) mic.push('mark dist ' + (((+crown.price - +plan.entry) / +plan.entry) * 100).toFixed(1) + '%');
    if (isFinite(+pfR.venuePremiumPct)) mic.push('venue premium ' + (pfR.venuePremiumPct >= 0 ? '+' : '') + (+pfR.venuePremiumPct).toFixed(4) + '%');
    if (isFinite(+pfR.liqClusterUsd)) mic.push('liq cluster ' + (+pfR.liqClusterUsd).toFixed(0) + ' USD');
    if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 45 && typeof hgFillProbability === 'function' && isFinite(+plan.entry)){
      try{ var fp = hgFillProbability(crown.rows4h, +plan.entry, dir, null, 12); if (fp && fp.pct != null && isFinite(fp.pct)) mic.push('fill odds ' + Math.round(fp.pct) + '%'); }catch(eFp){ }
    }
    if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 45 && isFinite(+plan.entry) && isFinite(+plan.stop)){
      try{
        var rp = Math.abs(+plan.entry - +plan.stop); var sweeps = 0;
        for (var si2 = crown.rows4h.length - 40; si2 < crown.rows4h.length; si2++){
          var sb = crown.rows4h[si2]; if (!sb) continue;
          if (dir === 'long' && (+sb.l || 0) <= +plan.entry - rp) sweeps++;
          else if (dir === 'short' && (+sb.h || 0) >= +plan.entry + rp) sweeps++;
        }
        mic.push('stop sensitivity ' + sweeps + '/40');
      }catch(eSw2){ }
    }
    html += dim('MICRO', mic.length ? 'NEUTRAL' : 'UNREAD', '', mic);
    html += '</div>';
    /* ---- ANCHOR (day VWAP + Bollinger on the row's own tape) ---- */
    var anchorHtml = '';
    try{
      if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 30 && typeof hgAVWAP === 'function' && typeof bollinger === 'function'){
        var anIdx = Math.max(0, crown.rows4h.length - 6);
        var av = hgAVWAP(crown.rows4h, anIdx);
        var cArr = crown.rows4h.map(function(x){ return x.c; });
        var bb = bollinger(cArr, 20, 2);
        var lastC = +crown.rows4h[crown.rows4h.length - 1].c;
        if (av && isFinite(+av.value) && bb && bb.widthPct){
          var devPct = (lastC - +av.value) / +av.value * 100;
          var wNow = +bb.widthPct[bb.widthPct.length - 1];
          var wPrev = bb.widthPct.slice(-21, -1).filter(isFinite);
          var wAvg = wPrev.length ? wPrev.reduce(function(a, b){ return a + b; }, 0) / wPrev.length : NaN;
          var bbState = isFinite(wAvg) ? (wNow < 0.85 * wAvg ? 'SQUEEZE' : (wNow > 1.3 * wAvg ? 'EXPANSION' : 'NORMAL')) : null;
          anchorHtml = '<div class="panel" style="margin-top:10px"><h3>ANCHOR <span>day VWAP + Bollinger on the row\'s own tape - evidence, never a gate</span></h3>'
            + '<div class="kv"><span class="k">VWAP (1 day, 4h)</span><span class="v">' + (+av.value).toFixed(2) + ' - price ' + (devPct >= 0 ? '+' : '') + devPct.toFixed(2) + '% from it</span></div>'
            + '<div class="kv"><span class="k">Bollinger (20,2)</span><span class="v">' + (bbState || 'UNREAD') + (isFinite(wNow) ? ' (width ' + wNow.toFixed(2) + '% vs trailing ' + (isFinite(wAvg) ? wAvg.toFixed(2) : '--') + '%)' : '') + (bbState === 'SQUEEZE' ? ' - compression precedes expansion' : '') + '</span></div>'
            + '</div>';
        }
      }
    }catch(eAn){ }
    html += anchorHtml;
    /* ---- SETUP CARD ---- */
    var aArr = (typeof W.atr === 'function' && Array.isArray(crown.rows4h)) ? W.atr(crown.rows4h, 14) : null;
    var aV = (aArr && aArr.length) ? +aArr[aArr.length - 1] : NaN;
    var thesis = 'structure: composite ' + (crown.score > 0 ? '+' : '') + crown.score + '/5 across the 1D/4H legs'
      + (crown.freshCross ? ' with a fresh ' + crown.freshCross + ' cross' : '')
      + '; context: ' + (isFinite(+crown.adx) ? 'ADX ' + (+crown.adx).toFixed(1) : 'ADX UNREAD')
      + (isFinite(+crown.fundingPct) ? ' and funding ' + (+crown.fundingPct).toFixed(4) + '%' : '') + '.';
    var tp3Txt = isFinite(aV) ? ((dir === 'long' ? +plan.entry + 6.5 * aV : +plan.entry - 6.5 * aV).toFixed(2) + ' (EXTENSION - not graded)') : 'n/a';
    var venue = tmRowVenue(crown);
    var payload = { v: 1, id: 'TMX-' + String(crown.sym), venue: venue, symbol: crown.sym,
      side: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1, t2: isFinite(+plan.t2) ? +plan.t2 : null,
      gates: gatesTxt, formation: tier === 'clean' ? 'CLEAN' : 'WATCH_ONLY', measured: 'UNREAD',
      exitPolicy: 'scale50_t1_be_trail', ts: Math.floor(Date.now() / 1000) };
    var jsonTxt = JSON.stringify(payload, null, 2);
    html += '<div class="panel" style="margin-top:10px"><h3>SETUP CARD <span>the OMNIBTC template on the matrix crown</span></h3>'
      + '<div class="kv"><span class="k">Market Thesis</span><span class="v">' + escH(thesis) + '</span></div>'
      + '<div class="kv"><span class="k">Bias</span><span class="v ' + (dir === 'long' ? 'pos' : 'neg') + '">' + dir.toUpperCase() + '</span></div>'
      + '<div class="kv"><span class="k">Entry Zone</span><span class="v">[' + (+plan.entry).toFixed(2) + ']' + (isFinite(aV) ? ' +/- ' + (0.25 * aV).toFixed(2) : '') + '</span></div>'
      + '<div class="kv"><span class="k">Invalidation (SL)</span><span class="v">' + (+plan.stop).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">Targets (TP)</span><span class="v">TP1 ' + (+plan.t1).toFixed(2) + ' | TP2 ' + (isFinite(+plan.t2) ? (+plan.t2).toFixed(2) : 'n/a') + ' | TP3 ' + tp3Txt + '</span></div>'
      + '<div class="kv"><span class="k">Automation Blueprint</span><span class="v"><pre style="margin:4px 0;white-space:pre-wrap;font-size:10px">' + escH(jsonTxt) + '</pre>' + (tier === 'clean' ? '' : '<div class="note warn" style="margin-top:4px">formation WATCH_ONLY - the bridge must drop this payload.</div>') + '</span></div>'
      + '</div>';
    /* ---- the dual grid setups, OMNIBTC style ---- */
    var swingS = { dir: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1, t2: isFinite(+plan.t2) ? +plan.t2 : null,
      tier: tier === 'clean' ? 'CLEAN' : 'NEAR', gates: (crown.gate && isFinite(crown.gate.gatesPassed)) ? crown.gate.gatesPassed : null };
    html += trendmxGridBlockHtml('SWING SETUP', '4h grid', swingS, dir);
    var scalpS = null, altS = null;
    if (Array.isArray(crown.rows1h) && crown.rows1h.length >= 60 && typeof W.atr === 'function'){
      var a1arr = W.atr(crown.rows1h, 14);
      var a1 = (a1arr && a1arr.length) ? +a1arr[a1arr.length - 1] : NaN;
      var p1 = +crown.rows1h[crown.rows1h.length - 1].c;
      if (isFinite(a1) && a1 > 0 && isFinite(p1)){
        function tmxLadder(side){
          return { dir: side, entry: p1, stop: side === 'long' ? p1 - 1.5 * a1 : p1 + 1.5 * a1,
            t1: side === 'long' ? p1 + 3.5 * a1 : p1 - 3.5 * a1,
            t2: side === 'long' ? p1 + 4.9 * a1 : p1 - 4.9 * a1,
            tier: 'DRAFT', gates: null, source: '1h draft ladder ATR14' };
        }
        scalpS = tmxLadder(dir);
        altS = tmxLadder(dir === 'long' ? 'short' : 'long');
      }
    }
    html += trendmxGridBlockHtml('SCALP SETUP', '1h grid', scalpS, dir);
    html += trendmxGridBlockHtml('SCALP SETUP - ALT SIDE', '1h grid', altS, dir);
    /* ---- MEASURED EDGE ---- */
    try{
      if (typeof W.hgProvenEdgeVerdict === 'function'){
        var v = W.hgProvenEdgeVerdict('trendmx', 'TRENDMX', { pool: 'TRENDMX', mechanic: 'TRENDMX' });
        if (v && typeof W.hgProvenEdgeChipHtml === 'function'){
          html += '<div class="panel" style="margin-top:10px"><h3>MEASURED EDGE <span>the TRENDMX pool\'s settled record</span></h3>'
            + W.hgProvenEdgeChipHtml(v) + '</div>';
        }
      }
    }catch(eMe){ }
    return html;
  }catch(e){ return ''; }
}

/* hg-v1067: THE SHARED PERFECT EVIDENCE PASS — the SAME reads bag and
   the SAME enrichment + predicate OMNIBTC consumes (hgObtcPerfectFormation),
   fed by the SAME external data (real Binance taker flow, Binance funding,
   ATR percentile regime, EMA50/200 structure, session RVOL, the news
   calendar), applied to the matrix's strongest rows. PERFECT / PERFECT+
   on a matrix row now means byte-identically what it means on OMNIBTC.
   Evidence, never a gate. */
function tmStructureDir(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 210 || typeof W.ema !== 'function') return null;
    var c = rows.map(function(x){ return x.c; });
    var e50 = W.ema(c, 50), e200 = W.ema(c, 200);
    if (!e50 || !e200 || e50.length < 2) return null;
    var a = e50[e50.length - 1], b = e200[e200.length - 1];
    if (!isFinite(a) || !isFinite(b) || a === b) return null;
    return a > b ? 'up' : 'down';
  }catch(e){ return null; }
}

/* hg-v1187: THE CRYPTO PINE PORTS — five bar-only Pine strategies read off
   the row's own 4h tape, returned as a light mark bag. Record-only: the
   perfect predicate ignores them and the forward ledger decides whether
   any of them separates. Each unreadable signal is null (the honest
   third state). */
function trendmxPineMarks(rows){
  var out = { lor: null, ht: null, sqz: null, smf: null, msb: null };
  try{
    if (!Array.isArray(rows) || rows.length < 30) return out;
    if (typeof W.pineLorentzianKernel === 'function'){ var l = W.pineLorentzianKernel(rows, {}); if (l && l.dir) out.lor = String(l.dir).toLowerCase(); }
    if (typeof W.pineHalfTrend === 'function'){ var h = W.pineHalfTrend(rows, {}); if (h && h.dir) out.ht = String(h.dir).toLowerCase(); }
    if (typeof W.pineSqueezeMomentum === 'function'){ var s = W.pineSqueezeMomentum(rows, {}); if (s && s.dir) out.sqz = String(s.dir).toLowerCase(); }
    if (typeof W.pineSmartMoneyFlow === 'function'){ var f = W.pineSmartMoneyFlow(rows, {}); if (f && f.dir) out.smf = String(f.dir).toLowerCase(); }
    if (typeof W.pineMsbOb === 'function'){ var m = W.pineMsbOb(rows, {}); if (m && m.dir) out.msb = String(m.dir).toLowerCase(); }
  }catch(e){ }
  return out;
}

async function trendmxPerfectEvidencePass(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return rows;
    var capped = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }).slice(0, 8);
    var taker = null, binFund = null;
    try{ if (typeof W.binanceTakerRatio === 'function') taker = await W.binanceTakerRatio('BTCUSDT', '4h', 120); }catch(eT){ }
    try{ if (typeof W.binanceFunding === 'function'){ var bf = await W.binanceFunding('BTCUSDT'); binFund = (bf && isFinite(+bf.fundingPct)) ? +bf.fundingPct : null; } }catch(eB){ }
    /* hg-v1144: the free resources - Deribit options vol (public) and the
       Coinglass free-tier clusters - read once per pass, attached per row. */
    var dvol = null;
    try{ if (typeof W.deribitVolState === 'function') dvol = W.deribitVolState(); }catch(eDv){ }
    var cg = null;
    try{ if (typeof W.coinglassClusters !== 'undefined' && W.coinglassClusters) cg = W.coinglassClusters; }catch(eCg){ }
    var btcStructure = null;
    for (var bi = 0; bi < rows.length; bi++){
      var br = rows[bi];
      var bbase = String(br.base || br.sym || '').toUpperCase();
      if (bbase === 'BTC' || bbase.indexOf('BTC') === 0){
        try{ btcStructure = tmStructureDir(br.rows4h); }catch(eBs){ btcStructure = null; }
        if (btcStructure) break;
      }
    }
    trendmxMacroSet({ btcFunding: binFund, btcStructure: btcStructure });
    for (var i = 0; i < capped.length; i++){
      var r = capped[i];
      var dir = tmDirOf(r);
      if (!dir) continue;
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!plan) continue;
      var reads = {};
      if (isFinite(+r.fundingPct)){
      if (dvol && isFinite(+dvol.dvol)){ reads.dvolVal = +dvol.dvol; reads.dvolRegime = dvol.regime || null; }
      if (cg){
        try{
          var base = String(r.base || r.sym || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          var cell = cg[base] || cg[base + 'USDT'] || cg[base + 'USD'];
          var usd = cell && (isFinite(+cell.usd) ? +cell.usd : (isFinite(+cell.total) ? +cell.total : (isFinite(+cell.liqUsd) ? +cell.liqUsd : NaN)));
          if (isFinite(usd)) reads.liqClusterUsd = usd;
        }catch(eLc){ }
      }
