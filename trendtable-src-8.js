    rows = allRows.filter(function(r){ return tmRowVenue(r) === state.venue; });
    var onVenue = function(g){
      for (var gi = 0; gi < allRows.length; gi++){
        if (allRows[gi].sym === g.sym && tmRowVenue(allRows[gi]) === state.venue) return true;
      }
      return false;
    };
    golden = golden.filter(onVenue);
    death = death.filter(onVenue);   /* hg-v1014 */
    golden.held = (state.golden && state.golden.held) || golden.held;
    death.held = (state.death && state.death.held) || death.held;
  }
  var vc = state.venueCounts || null;
  if (refs.summary) refs.summary.textContent = rows.length ? trendmxSummaryLine(rows, golden, vc) : 'Idle — run a scan to build the desk.';
  /* hg-v1015: two desks, two containers — each renders only its own cross */
  if (refs.golden) refs.golden.innerHTML = trendmxGoldenDeskHTML(golden);
  if (refs.death) refs.death.innerHTML = trendmxDeathDeskHTML(death);
  var clean = [], near = [], forming = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean.push(r);
    else if (tier === 'near') near.push(r);
    else if (r.freshCross || Math.abs(r.score) >= TM_MAJORITY || (r.gate && r.gate.gatesPassed >= 5)) forming.push(r);
  }
  clean.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  near.sort(function(a, b){ return (b.gate ? b.gate.gatesPassed : 0) - (a.gate ? a.gate.gatesPassed : 0); });
  forming.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  if (refs.cards){
    if (!clean.length){
      refs.cards.innerHTML = (typeof hgSetupEmptyHTML === 'function')
        ? hgSetupEmptyHTML({ title: 'No CLEAN trend tickets right now.', body: 'NEAR and FORMING rows below are watch-only. The golden and death cross desks and the limit board surface actionable rows when gates + plan align.' })   /* hg-v1015: two cross desks now */
        : '<div class="empty">No CLEAN tickets.</div>';
    } else {
      var ch = '<div class="note" style="margin:0 0 10px"><b>CLEAN TICKETS</b> — 7/7 gates + valid plan + min R:R ' + TM_MIN_RR + '.</div>';
      for (var ci = 0; ci < Math.min(clean.length, 12); ci++) ch += trendmxSetupCardHTML(clean[ci], 'clean');
      refs.cards.innerHTML = ch;
      trendmxPaintMiniCharts(refs.cards, clean);
    }
    try {
      if (typeof W.hgMpPin === 'function'){
        function tmWithPlan(row){
          var d = tmDirOf(row);
          var p = d ? trendmxPlan(Object.assign({}, row, { dir: d })) : null;
          return p ? Object.assign({}, row, p, { dir: d }) : row;
        }
        W.hgMpPin('trendmx', { cands: clean.map(tmWithPlan), nearCands: near.map(tmWithPlan), closest: forming[0] ? tmWithPlan(forming[0]) : null }, null, refs.cards);
      }
    } catch (eMp) {}
  }
  if (refs.near){
    refs.near.innerHTML = near.length
      ? ((typeof hgSetupNearHeaderHTML === 'function' ? hgSetupNearHeaderHTML(near.length, 'trendmx') : '')
        + near.slice(0, 8).map(function(r){ return trendmxSetupCardHTML(r, 'near'); }).join(''))
      : '';
  }
  if (refs.forming){
    refs.forming.innerHTML = (typeof hgFormingWatchHTML === 'function')
      ? hgFormingWatchHTML(forming.slice(0, 12).map(function(r){
          return {
            state: (r.gate && r.gate.gatesPassed >= 5) ? 'armed' : 'idle',
            sym: r.sym, strategy: 'TRENDMX',
            condition: (r.freshCross ? '⚡' + r.freshCross + ' · ' : '') + 'composite ' + (r.score > 0 ? '+' : '') + r.score + '/5',
            gatesPassed: r.gate ? r.gate.gatesPassed : null, gatesTotal: 7
          };
        }), { title: 'FORMING · TREND RADAR', subtitle: 'fresh crosses + strong composite without CLEAN ticket yet' })
      : '';
  }
  /* hg-v1018: the two limit classes, one collection, one forward record,
     two desks — each renders only its own formation class, like the cross
     desks above them (hg-v1015). */
  if (refs.trendform){
    refs.trendform.innerHTML = trendmxTrendFormHTML(rows);
  }
  if (refs.crown){
    refs.crown.innerHTML = trendmxCrownPanelHTML(state);
  }
  if (refs.gateclean || refs.conviction){
    var tmClasses = trendmxLimitClasses(rows);
    /* hg-v1019: each desk gets its OWN reason split, so its verdict names
       only the witnesses that fired on ITS class */
    if (refs.gateclean) refs.gateclean.innerHTML = trendmxGateCleanDeskHTML(tmClasses.clean, tmClasses.heldClean, tmClasses.heldWhy.clean);
    if (refs.conviction) refs.conviction.innerHTML = trendmxConvictionDeskHTML(tmClasses.conv, tmClasses.heldConv, tmClasses.heldWhy.conv);
  }
  /* hg-v1022: the PERFECT desk — the strictest confluence tier, built off the
     same rows the two limit desks just judged. Empty is policy (a perfect
     row is rare by design), not a fault — trendmxPerfectDeskHTML names it
     honestly with nothing when nothing qualifies. */
  if (refs.perfect){
    refs.perfect.innerHTML = trendmxFullStackDeskHTML(trendmxFullStackSetups(rows))
      + trendmxPerfectDeskHTML(trendmxPerfectSetups(rows));
  }
}

/* hg-v1039: THE MEASURED BOOK — the desk records every crowned CLEAN /
   PERFECT row (runScan) and this panel answers 'does the crown pay?' from
   settled forward records, including the TREND MATRIX stance split every
   other recording desk inherits. Evidence, never a gate. */
function trendmxPaintFwd(refs){
  if (!refs || !refs.fwd) return;
  try{
    if (typeof W.hgFwdPanelHTML === 'function'){
      refs.fwd.innerHTML = W.hgFwdPanelHTML('TRENDMX') || '';
    } else {
      refs.fwd.innerHTML = '<div class="note">Forward ledger absent — crowns are recorded nowhere to be measured.</div>';
    }
  }catch(e){ try{ refs.fwd.innerHTML = ''; }catch(e2){} }
}

/* hg-v1045: THE BULL / BEAR COLUMN VIEW — the full matrix regrouped into
   three columns by the row's own majority direction (composite >= +2 BULL,
   <= -2 BEAR, everything between MIXED / CHOP). Each column reuses the desk's
   own card renderer, ordered by |composite| then gates. Same rows, same
   gates, same evidence — a different reading order. */
function trendmxColumnsHTML(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return '<div class="empty">No rows to group.</div>';
    var bull = [], bear = [], mixed = [], i, r, d;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      d = tmDirOf(r);
      if (d === 'long') bull.push(r);
      else if (d === 'short') bear.push(r);
      else mixed.push(r);
    }
    function byStrength(list){
      return list.slice().sort(function(a, b){
        var pa = Math.abs(+a.score || 0), pb = Math.abs(+b.score || 0);
        if (pb !== pa) return pb - pa;
        var ga = (a.gate && isFinite(a.gate.gatesPassed)) ? a.gate.gatesPassed : -1;
        var gb = (b.gate && isFinite(b.gate.gatesPassed)) ? b.gate.gatesPassed : -1;
        return gb - ga;
      });
    }
    /* a direction-less row cannot mint levels, so the mixed column prints a
       compact honest row instead of a setup card */
    function mixedRow(r){
      try{
        if (r.unread) return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r)
          + '<div style="opacity:.75;font-size:11px;margin-top:2px">UNREAD · CoinDCX contract with no candle series · not a setup</div></div>';
        return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r)
          + '<div style="opacity:.75;font-size:11px;margin-top:2px">composite ' + (r.score > 0 ? '+' : '') + r.score + '/5 · no majority — no levels minted · ADX '
          + (isFinite(r.adx) ? (+r.adx).toFixed(1) : '—') + '</div></div>';
      }catch(e){ return ''; }
    }
    function col(title, cls, titleCls, list, emptyTxt){
      var h = '<div class="panel tm-col" style="border-top:3px solid ' + cls + '"><h3 style="margin:0 0 8px">'
        + '<span class="' + titleCls + '">' + title + '</span> <span style="opacity:.6;font-weight:400">· ' + list.length + ' row' + (list.length === 1 ? '' : 's') + '</span></h3>';
      if (!list.length) h += '<div class="empty" style="margin:6px 0">' + emptyTxt + '</div>';
      else h += list.map(function(rr){
        var dd = tmDirOf(rr);
        if (!dd) return mixedRow(rr);
        var plan = dd ? trendmxPlan(Object.assign({}, rr, { dir: dd })) : null;
        var tier = trendmxRowTier(rr, plan);
        return trendmxSetupCardHTML(rr, tier === 'clean' ? 'clean' : 'near');
      }).join('');
      return h + '</div>';
    }
    var bullS = byStrength(bull), bearS = byStrength(bear), mixedS = byStrength(mixed);
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;align-items:start">'
      + col('BULL', '#26a69a', 'pos', bullS, 'no bullish rows — composite below +2')
      + col('BEAR', '#ef5350', 'neg', bearS, 'no bearish rows — composite above -2')
      + col('MIXED / CHOP', '#94a3b8', '', mixedS, 'no mixed rows')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1048: the COINDCX TRENDING / FORMING board - every CoinDCX future
   the matrix scanned, in two columns. TRENDING = the composite has a
   majority direction (|score| >= 2); FORMING = it does not yet. Both
   print TP/SL: minted ticket levels where the plan exists (7/7 CLEAN /
   6/7 NEAR), the house DRAFT ladder where it does not. */
function trendmxTrendFormHTML(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return '<div class="empty">Run a scan to classify the CoinDCX board.</div>';
    var cdcx = [];
    for (var i = 0; i < rows.length; i++){
      if (rows[i] && String(tmRowVenue(rows[i])).toLowerCase() === 'coindcx') cdcx.push(rows[i]);
    }
    if (!cdcx.length) return '<div class="empty">No CoinDCX rows on this board.</div>';
    var trending = [], forming = [];
    for (i = 0; i < cdcx.length; i++){
      var r = cdcx[i];
      if (tmDirOf(r)) trending.push(r); else forming.push(r);
    }
    function byStrength(list){ return list.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }); }
    /* typeof guard, not bare isFinite: isFinite(null) is TRUE and +null is 0,
       so a null plan level would print a confident "0" (the null-formatting
       trap this codebase has hit five times). */
    function px(v){ return (typeof v === 'number' && isFinite(v)) ? String(v) : '--'; }
    function lvlLine(rr, dd){
      var plan = dd ? trendmxPlan(Object.assign({}, rr, { dir: dd })) : null;
      if (plan){
        var tier = trendmxRowTier(rr, plan);
        var lvl = 'ENTRY ' + px(plan.entry) + ' - STOP ' + px(plan.stop) + ' - T1 ' + px(plan.t1)
          + (isFinite(plan.t2) ? ' - T2 ' + px(plan.t2) : '');
        /* hg-v1048: the tier is the label — 7/7 CLEAN and 6/7 NEAR are the
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
