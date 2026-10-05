  }catch(e){ out = ''; }
  return out;
}

/* One pass per scan. Golden tickets carry their levels but drop their candles;
   matrix rows carry their candles but not their levels — the two are joined
   here by symbol. The matrix row is never given dir/entry/stop of its own:
   trendmxPlan reads inp.entry as an entry OVERRIDE and tmDirOf reads inp.dir,
   so writing those onto the row would change the plan the desk builds. A
   synthetic ticket is enriched instead and only .smc is copied back. */
function tmSmcScanPass(rows, golden, death){
  try{
    if (!tmSmcOn() || !Array.isArray(rows) || !rows.length) return;
    var i, r, byRows = {};
    for (i = 0; i < rows.length; i++){ if (rows[i] && rows[i].sym) byRows[rows[i].sym] = rows[i].rows4h; }
    /* hg-v1014: golden AND death tickets share the one capped envelope —
       the cap is a compute budget, not a per-desk allowance */
    var tickets = (golden || []).concat(death || []);
    for (i = 0; i < tickets.length && i < TM_SMC_MAX; i++){
      if (tickets[i]) tmSmcMark(tickets[i], byRows[tickets[i].sym]);
    }
    var cands = [];
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (!r || r.smc || !r.rows4h || !r.rows4h.length) continue;
      if (r.gate && r.gate.veto) continue;
      if (!tmDirOf(r)) continue;
      if (!(r.gate && r.gate.clean7) && !trendmxConviction(r)) continue;
      cands.push(r);
    }
    /* the limit board's own rank, so the capped slice is the slice this desk
       promotes first rather than an arbitrary universe order */
    cands.sort(function(a, b){
      var ra = ((a.gate && a.gate.clean7) ? 1000 : 0) + Math.abs(a.score) * 10 + ((a.gate && a.gate.gatesPassed) || 0);
      var rb = ((b.gate && b.gate.clean7) ? 1000 : 0) + Math.abs(b.score) * 10 + ((b.gate && b.gate.gatesPassed) || 0);
      return rb - ra;
    });
    for (i = 0; i < cands.length && i < TM_SMC_MAX; i++){
      r = cands[i];
      var dir = tmDirOf(r);
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!tmValidSetup(plan)) continue;
      var syn = { sym: r.sym, dir: dir, entry: plan.entry, stop: plan.stop, t1: plan.t1 };
      tmSmcMark(syn, r.rows4h);
      if (syn.smc) r.smc = syn.smc;
    }
  }catch(e){}
}

/* ---------------- hg-v1012: EVIDENCE LAYER — real taker flow ----------------
   The composite is five reads of the same closes (1D EMA200, the 50/200
   cross, the 4H cascade, the cloud, the ADX point): five ways to agree
   with yourself. This pass adds the read that CANNOT be derived from
   those closes — which side is aggressing the tape. A TREND MATRIX row is
   a multi-day swing claim, and a swing minted into five days of net
   aggressive selling (for a long) is a claim against the crowd that is
   actually hitting the market.

   REAL Binance taker long/short flow only, read on the row's own
   hgDeskBinanceSym twin through hgOmniCvd (omniroute.js) over the last
   TM_FLOW_LOOK 4h windows. The candle-approximated stand-in never speaks
   here — the hg-v1009 rule: it derives from the same closes the composite
   already read, so it is not independent evidence (the caller hands the
   taker series straight through; hgOmniCvd only returns source 'taker'
   when enough real windows were used).

   Flow AGAINST the row's own majority: the row is HELD OFF — capped at
   NEAR (trendmxRowTier), excluded from the LIMIT BOARD and from the
   forward record the board writes (the ledger measures what the desk
   judged tradeable WITH the evidence in hand), and the chip names why.
   Flow WITH: a chip, never a point — the composite's five points stay
   exactly what they were. Fewer than TM_FLOW_MIN_WIN readable windows
   (hg-v1009's floor), a junk ratio series, a missing Binance twin or a
   failed fetch: UNREAD, and what cannot be read demotes nothing (hg-v700).

   ONE PASS PER SCAN over the promoted slice only — the same candidates
   the SMC pass picks (a direction, no gate veto, clean7 or conviction),
   the same rank, capped at the same TM_SMC_MAX-sized slice — paced in
   CHUNK-sized chunks like the universe fetch itself. The matrix holds the
   whole universe; fetching flow for every row would be a hundred calls
   for rows the desk never promotes. Rows are stamped row.flow =
   { verdict: 'with' | 'against' | 'unreadable', delta, bars, divergence,
   sym, why? } and every render path READS the stamp — nothing recomputes
   in a paint loop. The look, the floor and the cap are stated PRIORS, not
   measurements; the forward record's new reads.takerFlowWith mark is how
   the layer earns a measured one. PURE apart from the two readers it
   calls; it reports the counts so the scan line and the tests read the
   same object the scan acted on. */
var TM_FLOW_LOOK = 30;      /* hgOmniCvd's own default look — five days of 4h flow, the horizon a swing row is judged on */
var TM_FLOW_MIN_WIN = 10;   /* hg-v1009's floor: fewer readable windows than this is UNREAD, never a verdict */
var TM_FLOW_MAX = 24;       /* the SMC pass's own cap — flow is fetched for the slice the desk promotes, never the whole universe */

function trendmxFlowScan(rows){
  var out = { with: 0, against: 0, unreadable: 0, scanned: 0, read: 'unavailable' };
  var cvdFn = (typeof W.hgOmniCvd === 'function') ? W.hgOmniCvd : null;
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

async function tmLoadCoinDcxContracts(){
  var urls = [
    '/api/coindcx/instruments',
    '/api/proxy?url=' + encodeURIComponent('https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT')
  ];
  var last = 'coindcx list failed';
  for (var i = 0; i < urls.length; i++){
    try{
      var r = await fetch(urls[i]);
