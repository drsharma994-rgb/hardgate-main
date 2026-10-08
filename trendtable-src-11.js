    perfect: el.querySelector('[data-r="perfect"]'),        /* hg-v1022 */
    fwd: el.querySelector('[data-r="fwd"]'),                /* hg-v1039: the measured book */
    trendform: el.querySelector('[data-r="trendform"]'),    /* hg-v1048: coindcx trending / forming */
    crown: el.querySelector('[data-r="crown"]'),            /* hg-v1066: the OMNIBTC-style crown */
    out: out,
    status: status
  };
  var chips  = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));
  var vChips = Array.prototype.slice.call(el.querySelectorAll('[data-v]'));

  var state = { rows: [], crypto: [], golden: [], death: [], filter: 'ALL', venue: 'ALL', sortKey: 'score', sortDir: -1, running: false, view: 'table' };   /* hg-v1015: death bag initialized with golden; hg-v1045: view toggle */
  tmTab._state = state;

  function setProg(f){
    if (!prog) return;
    prog.style.display = (f === null) ? 'none' : 'block';
    if (f !== null) prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setStatus(txt, warn){
    status.className = warn ? 'note warn' : 'note';
    status.textContent = txt;
  }

  if (missing.length){
    setStatus('Missing globals: ' + missing.join(', ') + ' — tab cannot scan until the data/indicator scripts load.', true);
    btn.disabled = true;
  }

  chips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.filter = ch.getAttribute('data-f');
      chips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderMatrix();
    });
  });
  vChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.venue = ch.getAttribute('data-v');
      vChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderAll();
    });
  });
  var vwChips = Array.prototype.slice.call(el.querySelectorAll('[data-view]'));
  vwChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.view = ch.getAttribute('data-view');
      vwChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderMatrix();
    });
  });
  btn.addEventListener('click', runScan);
  if (syncBtn) syncBtn.addEventListener('click', function(){ renderAll(); setStatus('desk repainted from latest scan.'); });
  /* the measured book renders on mount too — records from previous sessions
     are the point of an accumulating ledger (OMNIBTC's hg-v1011 pattern). */
  trendmxPaintFwd(refs);

  function sortVal(r, k){
    if (k === 'sym')   return r.sym;
    if (k === 'score') return r.score;
    if (k === 'gates') return (r.gate && isFinite(r.gate.gatesPassed)) ? r.gate.gatesPassed : -1;
    if (k === 'adx')   return isFinite(r.adx) ? r.adx : -Infinity;
    if (k === 'price') return r.price;
    return r.comps[k] || 0;
  }
  function passVenue(r){
    if (!state.venue || state.venue === 'ALL') return true;
    return tmRowVenue(r) === state.venue;
  }
  function passFilter(r){
    if (!passVenue(r)) return false;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (state.filter === 'CL') return tier === 'clean';
    if (state.filter === 'NR') return tier === 'near';
    if (state.filter === 'GD') return r.freshCross === 'GOLDEN';
    if (state.filter === 'DT') return r.freshCross === 'DEATH';   /* hg-v1014 */
    if (state.filter === 'CV') return !!trendmxConviction(r);
    if (state.filter === 'SL') return r.score >= 4;
    if (state.filter === 'SS') return r.score <= -4;
    if (state.filter === 'FX') return !!r.freshCross;
    return true;
  }
  function tri(v, up, dn){
    if (v > 0) return '<span class="pos">' + up + '</span>';
    if (v < 0) return '<span class="neg">' + dn + '</span>';
    return '<span>—</span>';
  }
  function cloudCell(v){
    if (v > 0) return '<span class="pos">ABOVE</span>';
    if (v < 0) return '<span class="neg">BELOW</span>';
    return '<span>INSIDE</span>';
  }

  function renderMatrix(){
    if (!state.rows.length){
      out.innerHTML = '<div class="empty">No results — run a scan.</div>';
      return;
    }
    var rows = state.rows.filter(passFilter);
    if (!rows.length){
      out.innerHTML = '<div class="empty">No symbols match this filter.</div>';
      return;
    }
    if (state.view === 'columns'){
      out.innerHTML = trendmxColumnsHTML(rows);
      return;
    }
    rows.sort(function(a, b){
      var va = sortVal(a, state.sortKey), vb = sortVal(b, state.sortKey);
      var c = (typeof va === 'string') ? va.localeCompare(vb) : (va - vb);
      return state.sortDir * c;
    });

    var h = '<table class="hg-table"><thead><tr>';
    h += '<th>COMP</th>';
    COLS.forEach(function(col){
      var arrow = (!col.nosort && state.sortKey === col.k) ? (state.sortDir > 0 ? ' ▲' : ' ▼') : '';
      h += col.nosort
        ? '<th>' + col.label + '</th>'
        : '<th data-k="' + col.k + '" style="cursor:pointer">' + col.label + arrow + '</th>';
    });
    h += '</tr></thead><tbody>';

    rows.forEach(function(r){
      var sc = r.score;
      var scls = sc > 0 ? 'pos' : (sc < 0 ? 'neg' : '');
      var xcls = r.comps.d1Cross > 0 ? 'pos' : (r.comps.d1Cross < 0 ? 'neg' : '');
      var xtxt = r.comps.d1Cross > 0 ? 'BULL' : (r.comps.d1Cross < 0 ? 'BEAR' : '—');
      var fx = r.freshCross
        ? ' <b class="' + (r.freshCross === 'GOLDEN' ? 'pos' : 'neg') + '">⚡' + r.freshCross + '</b>' : '';
      var adxTxt = isFinite(r.adx) ? r.adx.toFixed(1) : '—';
      var adxMark = r.comps.adxPt > 0 ? ' <span class="pos">▲</span>'
                  : (r.comps.adxPt < 0 ? ' <span class="neg">▼</span>' : '');
      var gate = r.gate;
      var gateTxt = gate ? gate.label : '—';
      var gateCls = gate && gate.clean7 ? 'ok' : (gate && gate.veto ? 'bad' : '');
      var pdir = tmDirOf(r);
      h += '<tr>' +
        '<td>' + trendmxCompPipsHtml(r.comps) + '</td>' +
        '<td><b>' + r.sym + '</b>' + tmVenueChip(r) + '</td>' +
        '<td class="' + scls + '"><b>' + (sc > 0 ? '+' : '') + sc + '</b></td>' +
        '<td><span class="gpip ' + gateCls + '">' + escH(gateTxt) + '</span>' + tmPostGateChip(r) + '</td>' +
        '<td>' + tri(r.comps.d1Trend, '▲ UP', '▼ DOWN') + '</td>' +
        '<td><span class="' + xcls + '">' + xtxt + '</span>' + fx + '</td>' +
        '<td>' + tri(r.comps.h4Cascade, '▲ ALIGN', '▼ INVERSE') + '</td>' +
        '<td>' + cloudCell(r.comps.cloud) + '</td>' +
        '<td>' + adxTxt + adxMark + '</td>' +
        '<td>' + pxFmt(r.price) + '</td>' +
        '<td>' + (pdir
          ? '<button class="chip tmPlanBtn" data-sym="' + escH(r.sym) + '">' + pdir.toUpperCase() + ' PLAN ▸</button>'
          : '<span class="note">—</span>') + '</td>' +
      '</tr>' +
      '<tr class="tmPlanRow" data-sym="' + escH(r.sym) + '" style="display:none"><td colspan="' + (COLS.length + 1) + '"></td></tr>';
    });
    h += '</tbody></table>';
    out.innerHTML = h;

    Array.prototype.slice.call(out.querySelectorAll('th[data-k]')).forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-k');
        if (state.sortKey === k) state.sortDir = -state.sortDir;
        else { state.sortKey = k; state.sortDir = (k === 'sym') ? 1 : -1; }
        renderMatrix();
      });
    });
    Array.prototype.slice.call(out.querySelectorAll('.tmPlanBtn')).forEach(function(b){
      b.addEventListener('click', function(){ togglePlan(b.getAttribute('data-sym')); });
    });
  }
  tmTab._renderMatrix = renderMatrix;

  function renderAll(){
    trendmxPaintDeskSections(refs, state);
    trendmxPaintFwd(refs);
    renderMatrix();
  }

  function togglePlan(sym){
    var row = out.querySelector('tr.tmPlanRow[data-sym="' + sym + '"]');
    if (!row) return;
    var btnEl = out.querySelector('.tmPlanBtn[data-sym="' + sym + '"]');
    var open = row.style.display !== 'none';
    if (open){
      row.style.display = 'none';
      if (btnEl) btnEl.textContent = btnEl.textContent.replace('▾', '▸');
      return;
    }
    var r = null;
    for (var i = 0; i < state.rows.length; i++){ if (state.rows[i].sym === sym){ r = state.rows[i]; break; } }
    var td = row.querySelector('td');
    if (td && r) td.innerHTML = trendmxPlanBlock(r);
    row.style.display = '';
    if (btnEl) btnEl.textContent = btnEl.textContent.replace('▸', '▾');
  }

  async function runScan(){
    if (state.running || missing.length) return;
    state.running = true;
    tmTab.busy = true;
    btn.disabled = true;
    var t0 = Date.now();
    try{
      setProg(0.05);
      setStatus('Scanning in batches of 10...');
      var snap = await trendmxScan({
        force: true,
        setProg: setProg,
        onBatch: function(info){
          state.rows = info.rows;
          /* hg-v1150: THE PARTIAL BOARD IS THE PUBLISHED BOARD for as long as
             it is the one on screen. renderAll() paints the desks and the
             desks write the forward record (trendmxLimitClasses) — and the
             record's tmScore / tmAlign / tmAgeMin marks are read off the
             PUBLISHED snapshot (hgTrendMatrixMark). The full publish happens
             only at the end of trendmxScan, so every mid-scan batch painted
             its record against a stale-or-null snapshot: tmScore undefined on
             records whose row sat on the board with a perfectly readable
             composite. Publish the partial rows here so a mid-scan record
             always carries the composite of the exact row it was minted
             from — the same row the operator saw. */
          try { publishTrendmxSnap(info.rows); } catch (ePub) {}
          try {
            trendmxStampBtcStructure(state.rows);
            state.golden = trendmxGoldenCrossSetups(state.rows);
            state.death = trendmxDeathCrossSetups(state.rows);
          } catch (eB) {}
          renderAll();
          setProg(info.total ? info.done / info.total : 0);
          var more = info.done < info.total;
          setStatus('Batch ' + info.batch + ' of ' + info.batches + ' · ' + info.done + ' / ' + info.total + ' coins on the board'
            + (more ? ' · next 10 starting' : ' · checking setups'));
        }
      });
      var results = (snap && snap.rows) ? snap.rows : [];
      var failed = (snap && snap.failed) ? snap.failed : 0;
      var symsLen = (snap && snap.scanned) ? snap.scanned : results.length;
      var uniLen = (snap && snap.uniLen) ? snap.uniLen : symsLen;
      var vc = (snap && snap.venueCounts) ? snap.venueCounts : {};

      state.rows = results;
      state.crypto = (snap && snap.cryptoSetups) ? snap.cryptoSetups : [];
      state.golden = (snap && snap.goldenCross) ? snap.goldenCross : [];
      state.death = (snap && snap.deathCross) ? snap.deathCross : [];   /* hg-v1014 */
      state.venueCounts = vc;
      renderAll();
      /* hg-v1039: THE CROWN JOINS THE FORWARD BOOK — the desk has crowned
         CLEAN / PERFECT rows for its whole life and never recorded one, so
         'does the trend-matrix crown pay?' could never be asked. Each 7/7
         gate-clean row with a valid plan is recorded (max 10, strongest
         |composite| first); the ledger dedups on the bar and settles on
         bars the desk already fetched. Evidence, never a gate. */
      try{
        if (typeof W.hgFwdRecordScan === 'function'){
          var recRows = [];
          var cands = state.rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
          for (var ri = 0; ri < cands.length && recRows.length < 10; ri++){
            var cr = cands[ri];
            var cdir = tmDirOf(cr);
            if (!cdir || !cr.gate || !cr.gate.clean7 || cr.gate.veto) continue;
            var cplan = trendmxPlan(Object.assign({}, cr, { dir: cdir }));
            if (!cplan || !isFinite(+cplan.entry) || !isFinite(+cplan.stop) || !isFinite(+cplan.t1)) continue;
            var crh4 = cr.rows4h;
            if (!Array.isArray(crh4) || !crh4.length) continue;
            var cLast = crh4[crh4.length - 1];
            recRows.push({
              sym: cr.sym, dir: cdir,
              entry: +cplan.entry, stop: +cplan.stop, t1: +cplan.t1,
              signalT: (cLast && cLast.t != null) ? cLast.t : undefined,
              mark: (cLast && cLast.c != null) ? +cLast.c : undefined,
              rows4h: crh4,
              fundingPct: (typeof cr.fundingPct === 'number' && isFinite(cr.fundingPct)) ? cr.fundingPct : undefined,
              mechanic: trendmxPerfectState(cr) ? 'PERFECT' : 'CLEAN',
              /* hg-v1154 / hg-v1159: the ticket claim is the board's own CLEAN tier here too — a
                 7/7 row the board caps at NEAR under a witness is recorded and is NO ticket */
              ticket: tmTicketClaim(cr, cplan),
              reads: tmRecordReads(cr, cdir)
            });
          }
          if (recRows.length) W.hgFwdRecordScan('TRENDMX', '4h', recRows, { horizonBars: 20 });
        }
      }catch(eRec){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('trendmx', eRec); }catch(eW){} }
      if (typeof globalThis !== 'undefined' && typeof globalThis.hgChartVisionEnrichDeskRows === 'function'){
        var tmClean = state.rows.filter(function(r){
          var d = tmDirOf(r);
          if (!d || !r.rows4h) return false;
          var plan = trendmxPlan(Object.assign({}, r, { dir: d }));
          return trendmxRowTier(r, plan) === 'clean';
        });
        globalThis.hgChartVisionEnrichDeskRows(tmClean, function(r){ return r.rows4h; }, {
          limit: 12,
          repaint: function(){ renderAll(); }
        });
      }
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var venNote = ' · Δ' + (vc.delta || 0) + ' CDX' + (vc.coindcx || 0) + ' BN' + (vc.binance || 0);
      setStatus('raw ' + uniLen + ' · scanned ' + symsLen + venNote
                + ' (≥ $' + floorM + 'M) · ' + results.length + ' ok / ' + failed +
                ' failed · ' + dt + 's' + (snap && snap.note ? ' · ' + snap.note : '')
                /* hg-v1012: name the evidence pass the same way the board does */
                + ((snap && snap.flow && snap.flow.read === 'taker' && (snap.flow.with + snap.flow.against) > 0)
                  ? ' · taker flow: ' + snap.flow.with + ' with / ' + snap.flow.against + ' held off' : ''),
                results.length === 0);
      if (!results.length){
        out.innerHTML = '<div class="empty">All symbol fetches failed — check connection.</div>';
      }
    }catch(e){
      setStatus('Scan failed: ' + ((e && e.message) || e), true);
      if (!state.rows.length) out.innerHTML = '<div class="empty">Scan could not complete.</div>';
    }finally{
      state.running = false;
      tmTab.busy = false;
      tmTab.hasRun = true;
      btn.disabled = missing.length > 0;
      setProg(null);
    }
  }

  tmTab.run = runScan;
  tmTab.missing = missing.length;

  if (__tmScanSnap && __tmScanSnap.rows && __tmScanSnap.rows.length &&
      __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < (5 * 60 * 1000)){
    state.rows = __tmScanSnap.rows;
    state.crypto = __tmScanSnap.cryptoSetups || [];
    state.golden = __tmScanSnap.goldenCross || [];
    state.death = __tmScanSnap.deathCross || [];   /* hg-v1014 */
    tmTab.hasRun = true;
    renderAll();
    setStatus('restored from cache · ' + trendmxSummaryLine(state.rows, state.golden)
      + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's');
  }
}

/* ---------------- exports + tab registration ---------------- */

W.trendmxSetupGrade = trendmxSetupGrade;
W.tmValueState = tmValueState;
W.tmBodyCommit = tmBodyCommit;
W.tmExampleSize = tmExampleSize;
W.tmSynergy = tmSynergy;
W.tmDisplacementFvg = tmDisplacementFvg;
W.tmParkinsonHot = tmParkinsonHot;
W.tmHurst = tmHurst;
W.tmTurtleReclaim = tmTurtleReclaim;
W.tmPocShift = tmPocShift;
W.tmFundingSpike = tmFundingSpike;
W.tmSettlementFreeze = tmSettlementFreeze;
W.tmLiquidityRoom = tmLiquidityRoom;
W.tmEffortTrap = tmEffortTrap;
W.tmStalled = tmStalled;
W.tmRunnerR = tmRunnerR;
W.tmAsiaChop = tmAsiaChop;
W.tmChandelier = tmChandelier;
W.tmWaveOk = tmWaveOk;
W.tmKernel = tmKernel;
W.tmSuperTrend = tmSuperTrend;
W.tmCmf = tmCmf;
W.tmSqueezeHigh = tmSqueezeHigh;
W.tmQqe = tmQqe;
W.tmHullRising = tmHullRising;
W.tmVfi = tmVfi;
W.tmWtDiverging = tmWtDiverging;
W.tmFreshOb = tmFreshOb;
W.tmUtBot = tmUtBot;
W.tmTrendMagic = tmTrendMagic;
W.tmAlpha = tmAlpha;
W.tmRangeFilter = tmRangeFilter;
W.tmLorentz = tmLorentz;
W.tmHalfTrend = tmHalfTrend;
W.tmWae = tmWae;
W.tmSqueezeMom = tmSqueezeMom;
W.tmDamiani = tmDamiani;
W.tmAroon = tmAroon;
W.tmElder = tmElder;
W.tmVwmaSide = tmVwmaSide;
W.tmCvdSlope = tmCvdSlope;
W.tm15Confirm = tm15Confirm;
W.trendScore = trendScore;
W.tmDirOf = tmDirOf;
W.trendmxGateEval = trendmxGateEval;
W.trendmxClassify = trendmxClassify;
W.hgTrendMatrixAlign = hgTrendMatrixAlign;   /* hg-v995 */
W.hgTrendMatrixRowOf = hgTrendMatrixRowOf;
W.hgTrendMatrixMark = hgTrendMatrixMark;
W.tmPostGateRead = tmPostGateRead;     /* hg-v1154 */
W.tmPostGateReads = tmPostGateReads;   /* hg-v1154 */
W.trendmxPlan = trendmxPlan;
W.trendmxPlanHTML = trendmxPlanHTML;
W.trendmxPlanBlock = trendmxPlanBlock;
W.trendmxConviction = trendmxConviction;
/* hg-v1012: the evidence layer's seams — the pass, the chips, and the two
   pre-existing readers the layer's behavior lives through (no export cap
   on this desk; the tests read these rather than re-deriving behavior) */
W.trendmxFlowScan = trendmxFlowScan;
W.trendmxFlowChipHtml = trendmxFlowChipHtml;
W.trendmxMomState = trendmxMomState;       /* hg-v1019: the momentum witness */
W.trendmxMomChipHtml = trendmxMomChipHtml;
W.trendmxSetupCardHTML = trendmxSetupCardHTML;   /* hg-v1019: the matrix card — where a held row's chip must paint (the NEAR section) */
W.trendmxVolState = trendmxVolState;       /* hg-v1020: the volume witness */
W.trendmxVolChipHtml = trendmxVolChipHtml;
W.trendmxFundGate = trendmxFundGate;       /* hg-v1034: the fundamental + sentiment witness */
W.trendmxColumnsHTML = trendmxColumnsHTML; /* hg-v1045: the bull / bear column view */
W.trendmxTrendFormHTML = trendmxTrendFormHTML; /* hg-v1048: the coindcx trending / forming board */
W.trendmxCrownPanelHTML = trendmxCrownPanelHTML; /* hg-v1066: the OMNIBTC-style crown */
W.trendmxPerfectEvidencePass = trendmxPerfectEvidencePass; /* hg-v1067: the OMNIBTC evidence stack */
W.trendmxCrownOfRows = trendmxCrownOfRows;   /* hg-v1068: the crown, pure and testable */
W.trendmxCrownState = trendmxCrownState;     /* hg-v1068: the alert seam */
W.trendmxFundState = trendmxFundState;
W.trendmxFundChipHtml = trendmxFundChipHtml;
W.trendmxChopState = trendmxChopState;      /* hg-v1057: the trend-quality witness */
W.trendmxChopChipHtml = trendmxChopChipHtml;
W.trendmxFivePillars = trendmxFivePillars;
W.trendmxFullStackSetups = trendmxFullStackSetups;
W.trendmxPillarHtml = trendmxPillarHtml;
W.trendmxPerfectState = trendmxPerfectState;       /* hg-v1022: the perfect predicate */
W.trendmxPerfectSetups = trendmxPerfectSetups;     /* hg-v1022: the perfect bag collector */
W.trendmxPerfectDeskHTML = trendmxPerfectDeskHTML; /* hg-v1022: the perfect desk renderer */
W.trendmxAtrRegime = trendmxAtrRegime;             /* hg-v1022: the volatility regime read */
W.trendmxAtrRegimeChipHtml = trendmxAtrRegimeChipHtml;
W.tmVolWitness = tmVolWitness;             /* the pure 1D-tape read, exported for the tests */
W.trendmxFundingChipHtml = trendmxFundingChipHtml;
W.trendmxRowTier = trendmxRowTier;
W.tmLegReads = tmLegReads;                 /* hg-v1159: the composite's legs as marks */
W.tmRecordReads = tmRecordReads;           /* hg-v1159: the one reads bag both record sites hand the ledger */
W.tmTicketClaim = tmTicketClaim;           /* hg-v1159: the ticket claim is the board's clean tier */
W.tmValidSetup = tmValidSetup;             /* hg-v1160: the replay harness asks the desk's own plan validity rule */
W.HG_TM_FACTOR_SEP = HG_TM_FACTOR_SEP;     /* hg-v1160: read by the panel, the drift guard and nothing else */
W.tmFactorSepHtml = tmFactorSepHtml;       /* hg-v1160: the replay panel, measured or not */
/* hg-v1018: the mixed board is superseded by the two class desks — the
   collector and both renderers are the desk's behavior, exported the same
   way (the tests read them rather than re-deriving behavior) */
W.trendmxLimitClasses = trendmxLimitClasses;
W.trendmxGateCleanDeskHTML = trendmxGateCleanDeskHTML;
W.trendmxConvictionDeskHTML = trendmxConvictionDeskHTML;
W.trendmxLimitDeskHTML = trendmxLimitDeskHTML;
W.trendmxSummaryLine = trendmxSummaryLine;
W.trendmxGoldenCrossSetups = trendmxGoldenCrossSetups;
W.trendmxDeathCrossSetups = trendmxDeathCrossSetups;   /* hg-v1014 */
W.tmSmcScanPass = tmSmcScanPass;   /* hg-v1014: the shared ticket cap is desk behavior — the tests read it, never re-derive it */
W.trendmxGoldenDeskHTML = trendmxGoldenDeskHTML;   /* hg-v1015 */
W.trendmxDeathDeskHTML = trendmxDeathDeskHTML;   /* hg-v1015 */
W.trendmxPaintDeskSections = trendmxPaintDeskSections;   /* hg-v1015: the desk routing is desk behavior too */
W.trendmxScan = trendmxScan;
W.trendmxWarm = trendmxWarm;
W.trendmxCrossState = function(){
  try{
    if (!__tmScanSnap) return null;
    return {
      at: __tmScanSnap.at,
      scanned: __tmScanSnap.scanned,
      goldenCross: (__tmScanSnap.goldenCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      }),
      /* hg-v1014: the mirrored half — the alert cycle reads both */
      deathCross: (__tmScanSnap.deathCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      })
    };
  }catch(e){ return null; }
};
W.trendmxState = function(){
  try{ return __tmSnap ? JSON.parse(JSON.stringify(__tmSnap)) : null; }catch(e){ return null; }
};
/* hg-v1150: THE SCAN ROWS, SYNC AND FULL. trendmxState() publishes the LIGHT
   mark snapshot ({sym, score, dir, comps} — the ledger reads it) and the
   cross state publishes the held tickets; but the desk's own last scan
   holds FULL rows (tape · gate · witnesses · freshCross), and consumers
   that re-run the builders on them — the AI workforce's rows fallback —
   had no sync seam to reach them. Same rows trendmxScan returned; null
   before the first scan. */
W.trendmxScanRows = function(){
  try{ return (__tmScanSnap && Array.isArray(__tmScanSnap.rows) && __tmScanSnap.rows.length) ? __tmScanSnap.rows : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'trendmx', label: 'TREND MATRIX', run: trendmxWarm });

})();
