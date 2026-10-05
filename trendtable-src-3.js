  var tkFn = (typeof W.binanceTakerRatio === 'function') ? W.binanceTakerRatio : null;
  var symFn = (typeof W.hgDeskBinanceSym === 'function') ? W.hgDeskBinanceSym : null;
  if (!cvdFn || !tkFn || !symFn || !Array.isArray(rows) || !rows.length) return Promise.resolve(out);
  var cands = [], i;
  for (i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.rows4h || !r.rows4h.length) continue;
    if (r.gate && r.gate.veto) continue;
    if (!tmDirOf(r)) continue;
    if (!(r.gate && r.gate.clean7) && !trendmxConviction(r)) continue;
    cands.push(r);
  }
  if (!cands.length) return Promise.resolve(out);
  /* the limit board's own rank, so the capped slice is the slice this desk
     promotes first rather than an arbitrary universe order — the SMC
     pass's own ordering, one rank for both reads */
  cands.sort(function(a, b){
    var ra = ((a.gate && a.gate.clean7) ? 1000 : 0) + Math.abs(a.score) * 10 + ((a.gate && a.gate.gatesPassed) || 0);
    var rb = ((b.gate && b.gate.clean7) ? 1000 : 0) + Math.abs(b.score) * 10 + ((b.gate && b.gate.gatesPassed) || 0);
    return rb - ra;
  });
  cands = cands.slice(0, TM_FLOW_MAX);
  out.read = 'taker';
  var idx = 0;
  function oneChunk(){
    var chunk = cands.slice(idx, idx + CHUNK);
    idx += CHUNK;
    return Promise.all(chunk.map(function(r){
      var dir = tmDirOf(r);
      out.scanned++;
      return Promise.resolve().then(function(){
        var bSym = symFn(r);
        if (!bSym){ r.flow = { verdict: 'unreadable', why: 'no Binance twin' }; out.unreadable++; return; }
        return tkFn(bSym, '4h', 120).then(function(tk){
          var series = (tk && Array.isArray(tk.series)) ? tk.series : null;
          if (!series || !series.length){
            r.flow = { verdict: 'unreadable', why: 'no real flow', sym: bSym }; out.unreadable++; return;
          }
          /* no signal-bar slice: a matrix row is minted by THIS scan, so the
             last closed 4h bar IS its judging bar — the windows that exist
             are the windows that had printed */
          var cv = cvdFn(r.rows4h, TM_FLOW_LOOK, { series: series });
          if (!cv || cv.source !== 'taker' || !isFinite(cv.delta) || cv.bars < TM_FLOW_MIN_WIN || cv.delta === 0){
            r.flow = { verdict: 'unreadable', why: 'no real-flow verdict', sym: bSym }; out.unreadable++; return;
          }
          var withDir = (dir === 'long') ? (cv.delta > 0) : (cv.delta < 0);
          r.flow = { verdict: withDir ? 'with' : 'against',
                     delta: Math.round(cv.delta * 100) / 100, bars: cv.bars,
                     divergence: cv.divergence || null, sym: bSym };
          if (withDir) out.with++; else out.against++;
        });
      }).catch(function(){
        try{ r.flow = { verdict: 'unreadable', why: 'fetch failed' }; out.unreadable++; }catch(e2){}
      });
    })).then(function(){
      if (idx < cands.length) return sleepMs(CHUNK_SLEEP_MS).then(oneChunk);
    });
  }
  return oneChunk().then(function(){ return out; }, function(){ return out; });
}

/* The chips — read the verdict the scan stamped, never recompute (the same
   rule as goldscalp's gsTakerFlowChipHtml). bad on AGAINST, ok on WITH,
   neutral on UNREAD (the desk looked and could not read — said, because a
   read that looked and could not speak is different from one that never
   looked), nothing when the stamp is absent (a row outside the promoted
   slice was never judged). Same stamp-with-margin markup as hgSmcChipHtml
   so the chip sits naturally beside it on every card. */
function trendmxFlowChipHtml(r){
  try{
    var f = r && r.flow;
    if (!f || !f.verdict) return '';
    var dir = tmDirOf(r) || '';
    if (f.verdict === 'against'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' reads net against this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Held off the LIMIT BOARD, never CLEAN — the row paints, the reason is named.') + '">TAKER FLOW AGAINST · HELD OFF</span>';
    }
    if (f.verdict === 'with'){
      return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' backs this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Evidence, never a composite point.') + '">TAKER FLOW WITH IT</span>';
    }
    return '<span class="stamp" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): '
      + (f.why || 'no real-flow read for this row') + ' — the read cannot speak, and what cannot speak holds nothing off') + '">TAKER FLOW UNREAD</span>';
  }catch(e){ return ''; }
}

/* FUNDING CROWDING — the fundingPct the universe already carried, read
   through the ONE house rule (hg-setup-core.js hgFundingAgainstMark — the
   G4 directional bar — so this chip can never disagree with the ledger's
   fundAgainst mark on the same row). Leaning the same way as the row's
   direction = the crowd is already stacked here = squeeze risk: a caution
   chip, never a gate, the tier unchanged — brain.js's own funding-crowding
   pattern. Absent rule, absent funding or a non-crowded read: no chip. */
function trendmxFundingChipHtml(r){
  try{
    var dir = tmDirOf(r);
    var fp = r && r.fundingPct;
    if (!dir || typeof fp !== 'number' || !isFinite(fp)) return '';
    var markFn = (typeof W.hgFundingAgainstMark === 'function') ? W.hgFundingAgainstMark : null;
    if (!markFn) return '';
    var m = markFn(fp, dir);
    if (!m || m.against !== true) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('funding crowding (hg-v1012, the one rule in hg-setup-core.js): funding '
      + fp.toFixed(4) + '%/interval leans the same way as this ' + dir
      + ' — the crowd is already stacked here, squeeze risk. A caution chip, never a gate, the tier unchanged.') + '">FUNDING CROWDED</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: SESSION PARTICIPATION — the fire bar's volume against ITS OWN
   time-of-day slot (hgSlotMeanVol, the same correction omniroute applies).
   A quiet-hours fire on a strong composite is evidence, never a gate. */
function trendmxSlotChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 21) return '';
    var slotFn = (typeof W.hgSlotMeanVol === 'function') ? W.hgSlotMeanVol : null;
    if (!slotFn) return '';
    var slot = slotFn(r.rows4h, 20);
    if (!slot || !isFinite(slot.mean) || !(slot.mean > 0)) return '';
    var lv = +r.rows4h[r.rows4h.length - 1].v;
    if (!isFinite(lv) || lv <= 0) return '';
    var rv = lv / slot.mean;
    if (rv >= 0.7) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('session participation (hg-v1042): the fire bar traded ' + rv.toFixed(2) + 'x its own time-of-day norm — quiet hours fire on thin participation. Evidence, never a gate.') + '">SESSION THIN</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: DAY-RANGE EXHAUSTION — today's range against the trailing
   20-day mean. A crown at 85%+ consumed is chasing a move already spent. */
function trendmxDayChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 30) return '';
    var days = {}, i, t, key, d;
    for (i = 0; i < r.rows4h.length; i++){
      t = +r.rows4h[i].t; if (!isFinite(t)) continue;
      key = String(Math.floor(t / 86400));
      d = days[key];
      if (!d) days[key] = { hi: r.rows4h[i].h, lo: r.rows4h[i].l };
      else { if (+r.rows4h[i].h > d.hi) d.hi = +r.rows4h[i].h; if (+r.rows4h[i].l < d.lo) d.lo = +r.rows4h[i].l; }
    }
    var keys = Object.keys(days).sort(), ranges = [], k;
    for (i = 0; i < keys.length; i++){
      var dd = days[keys[i]];
      if (dd.hi > dd.lo) ranges.push(dd.hi - dd.lo);
    }
    if (ranges.length < 5) return '';
    var prev = ranges.slice(-21, -1);
    if (!prev.length) return '';
    var mean = 0;
    for (k = 0; k < prev.length; k++) mean += prev[k];
    mean /= prev.length;
    if (!(mean > 0)) return '';
    var pct = Math.round(ranges[ranges.length - 1] / mean * 100);
    if (pct < 85) return '';
    return '<span class="stamp bad" style="margin-left:6px" title="' + escH('day-range exhaustion (hg-v1042): ' + pct + '% of the average daily range already consumed — chasing a move that may be spent. Evidence, never a gate.') + '">DAY ' + pct + '% SPENT</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: ROUND-TRIP COST — fees as R of the stop window (the house
   hgCryptoCostR). A crown whose fees eat over a quarter of its stop is
   COST-HEAVY — the gold ledger measured that cohort to bleed. Evidence,
   never a gate. */
function trendmxCostChipHtml(r, plan){
  try{
    if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop)) return '';
    var costFn = (typeof W.hgCryptoCostR === 'function') ? W.hgCryptoCostR : null;
    if (!costFn) return '';
    var costR = costFn(+plan.entry, +plan.stop, 'taker', 'taker');
    if (!isFinite(costR)) return '';
    if (costR > 0.25){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): fees eat ' + costR.toFixed(2) + 'R of the stop window — COST-HEAVY. The gold ledger measured this cohort to bleed. Evidence, never a gate.') + '">COST-HEAVY ' + costR.toFixed(2) + 'R</span>';
    }
    return '<span class="stamp ok" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): ' + costR.toFixed(2) + 'R of the stop window. Evidence, never a gate.') + '">COST ' + costR.toFixed(2) + 'R</span>';
  }catch(e){ return ''; }
}

async function trendmxScanCore(hooks){
  hooks = hooks || {};
/* Map before asking Binance — a venue code means nothing to fapi. This is the
   same defect fixed in desk-scan-universe.js (v431) and brain.js (v450);
   reuse the mapping those export rather than a fifth private copy. When it is
   unavailable the Binance leg is skipped: no usable symbol means no Binance
   data, and inventing one is how this family started. */
  var fetchK = (typeof W.hgDeskFetchKlines === 'function') ? W.hgDeskFetchKlines.bind(W)
    : function(it, tf, n){
        var bSym = (typeof W.hgDeskBinanceSym === 'function')
          ? W.hgDeskBinanceSym(typeof it === 'string' ? { sym: it } : it)
          : (typeof it === 'string' ? it : null);
        return bSym ? W.binanceKlines(bSym, tf, n) : Promise.resolve([]);
      };
  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof W.binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    throw new Error('missing universe layer (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var items = uniPack.items || [];
  /* hg-v1048/hg-v1074: ALL COINDCX FUTURES - the floored universe drops
     small CoinDCX contracts, so the matrix re-reads the universe at floor 0
     and merges in every CoinDCX future it missed (deduped on venue+sym).
     hg-v1074 reads the RAW CoinDCX leg (hgDeskLoadCoinDCXAll), not the
     deduped merged universe: xuMergeLegs tags one 'exchange' per base and
     the higher-turnover venue wins, so a CoinDCX contract also listed on
     Delta/Startrader was invisible to a ['coindcx'] filter on the merged
     list. Every CoinDCX active_instruments contract now appears regardless.
     The other venues keep their floor. */
  try{
    /* Raw CoinDCX only makes sense when a CoinDCX data source exists
       (xuniverse.js). Guarding on xuCoinDCXRows also avoids a pointless
       second universe fetch on the Binance-only fallback path. */
    if (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function'){
      var allPack = await W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true });
      var cdcxAll = Array.isArray(allPack.items) ? allPack.items : [];
      var seenU = {};
      for (var ui = 0; ui < items.length; ui++) seenU[String(items[ui].exchange || '') + '|' + String(items[ui].sym || '')] = 1;
      for (var uj = 0; uj < cdcxAll.length; uj++){
        var uitem = cdcxAll[uj];
        var uk = String(uitem.exchange || '') + '|' + String(uitem.sym || '');
        if (!seenU[uk]){ items.push(uitem); seenU[uk] = 1; }
      }
    }
  }catch(eUni){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eUni); }catch(eWu){} }
  if (!items.length) throw new Error('universe empty' + (uniPack.note ? ' — ' + uniPack.note : ''));
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return fetchK(item, '4h', 120).then(function(r4){
          if (!r4 || !r4.length) return null;
          return Promise.all([fetchK(item, '1d', 260), fetchK(item, '1h', 120)]).then(function(rr){
            var r1 = rr[0], r1h = rr[1];
            if (!r1 || !r1.length) return null;
            var ts = trendScore(r1, r4);
            var row = {
              sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
              xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
              rsi: ts.rsi,   /* hg-v1019: the momentum witness rides the row — chips/tier/collector read the stamp, never recompute */
              volDiv: ts.volDiv, volConf: ts.volConf,   /* hg-v1020: the volume witness's stamps, same seam */
              price: r1[r1.length - 1].c, rows4h: r4, rows1h: (r1h && r1h.length) ? r1h : null,
              fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
            };
            var dir = tmDirOf(row);
            row.gate = dir ? trendmxGateEval(row, dir) : null;
            return row;
          });
        }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var core = await trendmxScanCore(opts);
  var golden = trendmxGoldenCrossSetups(core.rows);
  var death = trendmxDeathCrossSetups(core.rows);   /* hg-v1014: the mirrored desk */
  tmSmcScanPass(core.rows, golden, death);
  /* hg-v1012: the evidence layer — one capped, paced pass over the promoted
     slice, AFTER the tier inputs (score/gate/conviction) exist and BEFORE
     the snap the boards read. Never throws; what it cannot read it leaves
     unstamped, and an unstamped row is an unjudged row. */
  var flow = null;
  try{ flow = await trendmxFlowScan(core.rows); }catch(eFl){ flow = null; }
  /* hg-v1067: the shared-perfect evidence pass — the OMNIBTC read stack */
  try{ await trendmxPerfectEvidencePass(core.rows); }catch(ePf3){ }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, note: core.note, source: core.source, venueCounts: core.venueCounts,
    flow: flow
  };
  publishTrendmxSnap(core.rows);
