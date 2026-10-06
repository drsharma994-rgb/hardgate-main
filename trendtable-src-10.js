    var c = rows.map(function(x){ return x.c; });
    var e50 = W.ema(c, 50), e200 = W.ema(c, 200);
    if (!e50 || !e200 || e50.length < 2) return null;
    var a = e50[e50.length - 1], b = e200[e200.length - 1];
    if (!isFinite(a) || !isFinite(b) || a === b) return null;
    return a > b ? 'up' : 'down';
  }catch(e){ return null; }
}

async function trendmxPerfectEvidencePass(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return rows;
    var capped = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }).slice(0, 8);
    var taker = null, binFund = null;
    /* hg-v1144: the free resources - Deribit options vol (public) and the
       Coinglass free-tier clusters - read once per pass, attached per row. */
    var dvol = null;
    try{ if (typeof W.deribitVolState === 'function') dvol = W.deribitVolState(); }catch(eDv){ }
    var cg = null;
    try{ if (typeof W.coinglassClusters !== 'undefined' && W.coinglassClusters) cg = W.coinglassClusters; }catch(eCg){ }
    try{ if (typeof W.binanceTakerRatio === 'function') taker = await W.binanceTakerRatio('BTCUSDT', '4h', 120); }catch(eT){ }
    try{ if (typeof W.binanceFunding === 'function'){ var bf = await W.binanceFunding('BTCUSDT'); binFund = (bf && isFinite(+bf.fundingPct)) ? +bf.fundingPct : null; } }catch(eB){ }
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
        reads.venueFundingPct = +r.fundingPct;
        if (typeof hgFundingAgainstMark === 'function'){
          try{ var fam = hgFundingAgainstMark(+r.fundingPct, dir); if (fam) reads.fundingAgainst = (fam.against === true); }catch(eF){ }
        }
      }
      if (binFund != null) reads.btcFundingBinance = binFund;
      /* hg-v1144: venue premium = venue funding minus the Binance twin */
      if (isFinite(reads.venueFundingPct) && binFund != null) reads.venuePremiumPct = +reads.venueFundingPct - binFund;
      if (dvol && isFinite(+dvol.dvol)){ reads.dvolVal = +dvol.dvol; reads.dvolRegime = dvol.regime || null; }
      if (cg){
        try{
          var base = String(r.base || r.sym || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          var cell = cg[base] || cg[base + 'USDT'] || cg[base + 'USD'];
          var usd = cell && (isFinite(+cell.usd) ? +cell.usd : (isFinite(+cell.total) ? +cell.total : (isFinite(+cell.liqUsd) ? +cell.liqUsd : NaN)));
          if (isFinite(usd)) reads.liqClusterUsd = usd;
        }catch(eLc){ }
      }
      if (taker && Array.isArray(taker.series) && taker.series.length >= 30){
        try{
          var half = Math.floor(taker.series.length / 2);
          var prev = taker.series.slice(0, half).map(function(x){ return +x.buySellRatio; }).filter(isFinite);
          var last = taker.series.slice(half).map(function(x){ return +x.buySellRatio; }).filter(isFinite);
          if (prev.length && last.length){
            var pm = prev.reduce(function(a, b){ return a + b; }, 0) / prev.length;
            var lm = last.reduce(function(a, b){ return a + b; }, 0) / last.length;
            var up = lm > pm;
            reads.takerFlowVerdict = up ? (dir === 'long' ? 'with' : 'against') : (dir === 'long' ? 'against' : 'with');
          }
        }catch(eCv){ }
      }
      if (Array.isArray(r.rows4h) && r.rows4h.length >= 120 && typeof hgAtrPercentile === 'function'){
        try{ var atrP = hgAtrPercentile(r.rows4h, 14, 100); if (atrP != null){ reads.atrRegime = atrP < 20 ? 'DEAD' : (atrP > 80 ? 'BLOWOFF' : 'HEALTHY'); reads.atrPct = atrP; } }catch(eA){ }
      }
      try{ var st = tmStructureDir(r.rows4h); if (st) reads.structureTrend = st; }catch(eS){ }
      if (Array.isArray(r.rows4h) && r.rows4h.length >= 21 && typeof hgSlotMeanVol === 'function'){
        try{
          var slot = hgSlotMeanVol(r.rows4h, 20);
          var lv = +r.rows4h[r.rows4h.length - 1].v;
          if (slot && isFinite(slot.mean) && slot.mean > 0 && isFinite(lv) && lv > 0){
            var rvolW = lv / slot.mean;
            reads.volumeRvol = rvolW;
            reads.sess = rvolW >= 0.6 ? 'participating' : 'thin';
          }
        }catch(eSl){ }
      }
      try{ if (typeof W.hgNewsRisk === 'function'){ var nw = W.hgNewsRisk(r.base || 'BTC'); if (nw && nw.blackout) reads.newsRisk = 'blackout'; } }catch(eN){ }
      try{
        if (typeof W.hgObtcPerfectFormation === 'function'){
          var pick = { row: Object.assign({}, r, { entry: plan.entry, stop: plan.stop, t1: plan.t1, dir: dir }), tier: 'clean' };
          W.hgObtcPerfectFormation(pick, reads);
          r.perfect = pick.row.perfect === true;
          r.perfectPlus = pick.row.perfectPlus === true;
          r.perfectReads = pick.row.perfectReads || reads;
        }
      }catch(ePf){ }
    }
    return rows;
  }catch(e){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('trendmx', e); }catch(e2){ } return rows; }
}

/* hg-v1068: THE CROWN STATE — the strongest majority row with a minted
   plan in a light shape the alert batch and the auto-scan read. */
function trendmxCrownOfRows(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return null;
    var list = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      var dir = tmDirOf(r);
      if (!dir) continue;
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!plan) continue;
      var tier = trendmxRowTier(r, plan);
      return { sym: r.sym, dir: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1,
        t2: isFinite(+plan.t2) ? +plan.t2 : null, score: r.score, venue: tmRowVenue(r),
        gatesPassed: (r.gate && isFinite(r.gate.gatesPassed)) ? r.gate.gatesPassed : null,
        perfect: r.perfect === true, perfectPlus: r.perfectPlus === true,
        tier: tier === 'clean' ? 'clean' : 'near' };
    }
    return null;
  }catch(e){ return null; }
}

function trendmxCrownState(){
  try{
    var rows = (__tmScanSnap && Array.isArray(__tmScanSnap.rows)) ? __tmScanSnap.rows : null;
    if (!rows) return null;
    var c = trendmxCrownOfRows(rows);
    if (!c) return null;
    return { at: __tmScanSnap.at || null, crown: c };
  }catch(e){ return null; }
}

function hgPaintTrendmxFromSnap(){
  try{
    if (!__tmScanSnap || !__tmScanSnap.rows || !__tmScanSnap.rows.length || !tmTab.mountEl) return;
    var el = tmTab.mountEl;
    var refs = {
      summary: el.querySelector('[data-r="summary"]'),
      golden: el.querySelector('[data-r="golden"]'),
      death: el.querySelector('[data-r="death"]'),   /* hg-v1015 */
      cards: el.querySelector('[data-r="cards"]'),
      near: el.querySelector('[data-r="near"]'),
      forming: el.querySelector('[data-r="forming"]'),
      gateclean: el.querySelector('[data-r="gateclean"]'),   /* hg-v1018 */
      conviction: el.querySelector('[data-r="conviction"]'),  /* hg-v1018 */
      perfect: el.querySelector('[data-r="perfect"]'),        /* hg-v1022 */
      fwd: el.querySelector('[data-r="fwd"]'),                /* hg-v1039 */
      out: el.querySelector('[data-r="out"]'),
      status: el.querySelector('[data-r="status"]')
    };
    var state = { rows: __tmScanSnap.rows, golden: __tmScanSnap.goldenCross || [], death: __tmScanSnap.deathCross || [], filter: 'ALL', sortKey: 'score', sortDir: -1 };
    tmTab._state = state;
    trendmxPaintDeskSections(refs, state);
    trendmxPaintFwd(refs);
    if (refs.status && __tmScanSnap.at){
      refs.status.textContent = 'desk synced from cache · ' + trendmxSummaryLine(state.rows, state.golden)
        + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's';
    }
    if (typeof tmTab._renderMatrix === 'function') tmTab._renderMatrix();
  }catch(e){}
}
W.hgPaintTrendmxFromSnap = hgPaintTrendmxFromSnap;

function publishTrendmxSnap(rows){
  try{
    if (!rows || !rows.length){ __tmSnap = null; return; }
    __tmSnap = {
      at: Date.now(),
      rows: rows.map(function(r){
        return { sym: r.sym, score: r.score, dir: tmDirOf(r), comps: r.comps || null };
      })
    };
  }catch(e){ __tmSnap = null; }
}

/* ---------------- hg-v995: the composite as a MARK, one home ----------------
   The composite (-5..+5) is read by four consumers: this desk's own board
   (tmDirOf, majority at |2|), the PINE universe filter (aligned at |2|), the
   FTS setup stack (+1 with at |2|, STRONG at |4|) and CONTRACT REPORT. None
   of them recorded it beside an outcome, and CONTRACT REPORT handed
   trendmxClassify two candle arrays where it wants a scored row and a
   direction, so that report row read idle on every tape.

   hgTrendMatrixAlign(score, dir): the composite's stance toward a plan --
   'with' (majority in the plan's direction), 'against' (majority the other
   way), 'neutral' (short of the majority either way), undefined when the
   score is not a finite number or there is no direction. TM_MAJORITY is the
   one bar, tmDirOf's bar, stated here through tmDirOf rather than retyped.

   hgTrendMatrixRowOf(sym): this desk's last published row for a contract,
   matched on the base (BTCUSDT, BTC-PERP, BTCUSD all read the BTC row), or
   null when the desk has not scanned it. hgTrendMatrixMark(dir, sym) reads
   that row for a record at fire time: { score, align, ageMin }, every field
   NOT RECORDED when the snapshot has no row, a string score or a zero stamp
   (+null is 0, the trap), and a gold-lane symbol gets nothing, because this
   is a crypto trend desk. Nothing here gates. */
function tmBaseOf(sym){
  var s = String(sym || '').toUpperCase().replace(/[-_\/:. ]/g, '');
  s = s.replace(/(USDT|USDC|BUSD|USD|PERP)+$/, '');
  return s;
}
function hgTrendMatrixAlign(score, dir){
  var d = (typeof dir === 'string') ? dir.toLowerCase() : '';
  if (d !== 'long' && d !== 'short') return undefined;
  if (typeof score !== 'number' || !isFinite(score)) return undefined;
  var maj = tmDirOf({ score: score });
  if (!maj) return 'neutral';
  return maj === d ? 'with' : 'against';
}
function hgTrendMatrixRowOf(sym){
  try{
    if (!__tmSnap || !Array.isArray(__tmSnap.rows)) return null;
    var want = tmBaseOf(sym);
    if (!want) return null;
    for (var i = 0; i < __tmSnap.rows.length; i++){
      var r = __tmSnap.rows[i];
      if (r && tmBaseOf(r.sym) === want) return r;
    }
    return null;
  }catch(e){ return null; }
}
function hgTrendMatrixMark(dir, sym){
  var out = { score: undefined, align: undefined, ageMin: undefined };
  try{
    if (typeof W.hgIsGoldLaneSym === 'function' && W.hgIsGoldLaneSym(sym)) return out;
    var r = hgTrendMatrixRowOf(sym);
    if (!r) return out;
    /* the row's score is trendScore's own output (a number, zeroResult on failure); the one
       check on its shape is hgTrendMatrixAlign's, and the ledger door has its own. A second
       typeof here was an unkillable mutant in the first cut -- a duplicated check. */
    out.score = r.score;
    var at = __tmSnap && __tmSnap.at;
    if (typeof at === 'number' && isFinite(at) && at > 0) out.ageMin = Math.max(0, Math.round((Date.now() - at) / 60000));
    out.align = hgTrendMatrixAlign(out.score, dir);
  }catch(e){}
  return out;
}

/* refresh contract: async, NEVER throws, returns a terse status string —
   'refreshed' | 'skipped: not run yet' | 'skipped: data layer missing' |
   'busy'. Safe before mount / before the first RUN SCAN. */
async function refreshTrendMatrix(){
  try{
    if (tmTab.busy) return 'busy';
    if (tmTab.missing > 0) return 'skipped: data layer missing';
    if (!tmTab.hasRun || typeof tmTab.run !== 'function') return 'skipped: not run yet';
    await tmTab.run(); /* runScan is internally try-caught; belt-and-braces anyway */
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

function mountTrendMatrix(el){
  tmTab.mountEl = el;
  if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();

  var need = ['ema', 'adx', 'ichimokuState', 'crossOver', 'crossUnder', 'crossedRecently'];
  var missing = [];
  for (var m = 0; m < need.length; m++){
    if (typeof W[need[m]] !== 'function') missing.push(need[m]);
  }
  var hasUniverse = (typeof W.xuUniverse === 'function')
    || (typeof W.binancePerpUniverse === 'function' && typeof W.binanceKlines === 'function');
  if (!hasUniverse) missing.push('xuUniverse|binancePerpUniverse');

  var floorM = (TURNOVER_FLOOR / 1e6).toFixed(0);
  el.innerHTML =
    '<div class="panel hg-panel">' +
      '<h2>TREND MATRIX <span>advanced multi-TF desk · every active CoinDCX USDT future · other venues ≥ $' + floorM + 'M</span></h2>' +
      (typeof W.hgOmniPrincipalNoteHtml === 'function' ? (W.hgOmniPrincipalNoteHtml('trendmx') || '') : '') +
      '<div id="trendmxDesk"></div>' +
      '<div class="note">Five signed components (−1/0/+1) composite −5…+5 · 7-gate swing matrix · formation ticket cascade · golden cross Telegram every 15m.</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn" data-r="run">RUN SCAN</button>' +
        '<button class="btn sec" data-r="sync">SYNC DESK</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-f="ALL">ALL</button>' +
        '<button class="chip" data-f="CL">CLEAN 7/7</button>' +
        '<button class="chip" data-f="NR">NEAR 6/7</button>' +
        '<button class="chip" data-f="GD">⚡ GOLDEN</button>' +
        '<button class="chip" data-f="DT">⚡ DEATH</button>' +   /* hg-v1014 */
        '<button class="chip" data-f="CV">CONVICTION</button>' +
        '<button class="chip" data-f="SL">STRONG LONG</button>' +
        '<button class="chip" data-f="SS">STRONG SHORT</button>' +
        '<button class="chip" data-f="FX">FRESH CROSSES</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-v="ALL">ALL VENUES</button>' +
        '<button class="chip" data-v="delta">DELTA</button>' +
        '<button class="chip" data-v="coindcx">COINDCX</button>' +
        '<button class="chip" data-v="binance">BINANCE</button>' +
      '</div>' +
      '<div class="prog" data-r="prog"><i></i></div>' +
      '<div class="note" data-r="summary" style="margin-top:8px;font-weight:600">Idle — run a scan to build the desk.</div>' +
      '<div class="note" data-r="status" style="margin-top:4px">Press RUN SCAN to warm the full matrix + ticket desk.</div>' +
      '<div data-r="golden"></div>' +
      '<div data-r="death"></div>' +   /* hg-v1015: the bear desk stands on its own, right under the bull desk */
      '<div class="cards" data-r="cards"></div>' +
      '<div data-r="near"></div>' +
      '<div data-r="forming"></div>' +
      '<div data-r="gateclean"></div>' +   /* hg-v1018: the gate-clean class on its own desk */
      '<div data-r="conviction"></div>' +  /* hg-v1018: the composite-conviction class under it */
      '<div data-r="perfect"></div>' +     /* hg-v1022: the strictest confluence tier on its own desk */
      '<div data-r="fwd"></div>' +         /* hg-v1039: the measured book — does the crown pay */
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">COINDCX - ALL FUTURES - TRENDING / FORMING</h3>' +   /* hg-v1048 */
      '<div data-r="trendform"></div>' +
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">THE CROWN</h3>' +   /* hg-v1066 */
      '<div data-r="crown"></div>' +
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">FULL MATRIX · sortable · expandable plans</h3>' +
      '<div style="margin:4px 0 8px">' +
        '<button class="chip on" data-view="table">TABLE</button>' +
        '<button class="chip" data-view="columns">BULL / BEAR COLUMNS</button>' +
      '</div>' +
      '<div data-r="out"><div class="empty">Press RUN SCAN to build the matrix.</div></div>' +
    '</div>';

  if (typeof hgSetupPaintDesk === 'function'){
    hgSetupPaintDesk(el.querySelector('#trendmxDesk'), {
      kind: 'trendmx', tab: 'TREND MATRIX',
      note: 'CLEAN = 7/7 + plan + min R:R. The golden/death cross desks + the two limit class desks (gate-clean / conviction) promote the best rows. NEAR/FORMING are watch-only.'   /* hg-v1015 / hg-v1018 */
    });
  }

  var btn    = el.querySelector('[data-r="run"]');
  var syncBtn = el.querySelector('[data-r="sync"]');
  var prog   = el.querySelector('[data-r="prog"]');
  var summary = el.querySelector('[data-r="summary"]');
  var status = el.querySelector('[data-r="status"]');
  var out    = el.querySelector('[data-r="out"]');
  var refs = {
    summary: summary,
    golden: el.querySelector('[data-r="golden"]'),
    death: el.querySelector('[data-r="death"]'),   /* hg-v1015 */
    cards: el.querySelector('[data-r="cards"]'),
    near: el.querySelector('[data-r="near"]'),
    forming: el.querySelector('[data-r="forming"]'),
    gateclean: el.querySelector('[data-r="gateclean"]'),   /* hg-v1018 */
    conviction: el.querySelector('[data-r="conviction"]'),  /* hg-v1018 */
    perfect: el.querySelector('[data-r="perfect"]'),        /* hg-v1022 */
    fwd: el.querySelector('[data-r="fwd"]'),                /* hg-v1039: the measured book */
    trendform: el.querySelector('[data-r="trendform"]'),    /* hg-v1048: coindcx trending / forming */
    crown: el.querySelector('[data-r="crown"]'),            /* hg-v1066: the OMNIBTC-style crown */
    out: out,
    status: status
  };
  var chips  = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));
  var vChips = Array.prototype.slice.call(el.querySelectorAll('[data-v]'));

  var state = { rows: [], golden: [], death: [], filter: 'ALL', venue: 'ALL', sortKey: 'score', sortDir: -1, running: false, view: 'table' };   /* hg-v1015: death bag initialized with golden; hg-v1045: view toggle */
  tmTab._state = state;

  function setProg(f){
    if (!prog) return;
