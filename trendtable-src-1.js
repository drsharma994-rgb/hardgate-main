         byte-identical, so every recorded tmScore stays on its own scale
         (the hg-v1012 rule). rsi missing -> NaN, and NaN holds nothing off
         (hg-v700 honest degradation). */
      if (typeof rsi === 'function'){
        var r1d = rsi(c1, 14);
        out.rsi = (r1d && r1d.length) ? r1d[r1d.length - 1] : NaN;
      }
      /* hg-v1020: THE VOLUME WITNESS rides the same 1D tape — OBV
         divergence as EVIDENCE, the momentum witness's own seam. Never a
         composite leg (the hg-v1012 rule); a tape that cannot speak stamps
         nulls, and nulls hold nothing off. */
      var vw1020 = tmVolWitness(rows1d);
      out.volDiv = vw1020.div;
      out.volConf = vw1020.conf;
      var trendSum = out.comps.d1Trend + out.comps.d1Cross +
                     out.comps.h4Cascade + out.comps.cloud;
      if (isFinite(out.adx) && out.adx >= 25) out.comps.adxPt = sgn(trendSum);
    }

    out.score = out.comps.d1Trend + out.comps.d1Cross + out.comps.h4Cascade +
                out.comps.cloud + out.comps.adxPt;
  }catch(e){
    return zeroResult(); // never throw to UI
  }
  return out;
}

/* ---------------- hg-v1154: the free positioning feeds, through the rules that already read them ----------------
   SWING, whose 7/7 gates this desk borrows, has run every CLEAN hit through
   hgPostGateSetupVeto since hg-v197 -- flow trap (Binance taker ratio · depth
   imbalance · spot taker flow · Bybit positioning cross), BTC relative
   strength, stale momentum, regime overlay, on-chain alt gate, calibration --
   all public, free feeds the data layer already fetches and caches. And G4 on
   a contract whose venue reports no funding read nothing unless the ticker
   carried the Binance twin (hgEnrichTickerFundingTwin, hg-v197). This desk
   did neither, so a TM "7/7 CLEAN" was a weaker claim than SWING's under the
   same label. The hg-v1012 flow witness below reads the taker ratio on its
   own; the shared rule is the SWING policy in full and is called, not
   restated. A vetoed row is the FIFTH witness hold-off (counted and named per
   class like the other four), keeps its levels, moves to the watch tier (the
   shared card prints no handoff there), and -- unlike the other witnesses --
   is still RECORDED with ticket:false and reads['postgate:veto'] = true, so
   the ledger can ask whether the veto separates on this desk; a passed row
   records false; unchecked or un-run records nothing. Runs only on rows with
   a gate hit. With the shared rule absent the board reads as before. */
function tmGetCandlesFn(){
  if (typeof W.getCandles === 'function') return function(sym, tf, n){ return W.getCandles(sym, tf, n); };
  if (typeof W.binanceKlines === 'function') return function(sym, tf, n){ return W.binanceKlines(sym, tf, n); };
  return null;
}
async function tmEnrichFunding(row){
  var ticker = trendmxTicker(row);
  if (typeof W.hgEnrichTickerFundingTwin !== 'function') return ticker;
  try{
    var t2 = await W.hgEnrichTickerFundingTwin(ticker);
    if (t2 && typeof t2.fundingPct === 'number' && isFinite(t2.fundingPct)){
      row.fundingPct = t2.fundingPct;
      if (t2.fundingTwin) row.fundingTwin = t2.fundingTwin;
    }
  }catch(e){}
  return trendmxTicker(row);
}
function tmPostGateRead(qv){
  if (!qv || typeof qv !== 'object') return undefined;
  if (qv.ok === false){
    return { state: 'veto', reason: qv.reason || 'post-gate veto', tag: qv.tag || null, flowDetail: qv.flowDetail || null };
  }
  if (qv.unchecked === true){
    return { state: 'unchecked', reasons: Array.isArray(qv.uncheckedReasons) ? qv.uncheckedReasons.slice() : [], flowDetail: qv.flowDetail || null };
  }
  return { state: 'pass', flowDetail: qv.flowDetail || null, rsEdge: (typeof qv.rsEdge === 'number' && isFinite(qv.rsEdge)) ? qv.rsEdge : null };
}
async function tmFeedRow(row, dir, rows4h){
  var ticker = await tmEnrichFunding(row);
  row.gate = trendmxGateEval(row, dir);
  if (!row.gate || !row.gate.hit || typeof W.hgPostGateSetupVeto !== 'function') return;
  try{
    var qv = await W.hgPostGateSetupVeto(ticker, row.gate.hit, rows4h, 'swing', tmGetCandlesFn());
    row.postGate = tmPostGateRead(qv);
    if (qv && qv.ok && typeof W.hgApplyCryptoPostGate === 'function') W.hgApplyCryptoPostGate(row.gate.hit, qv);
  }catch(e){
    row.postGate = { state: 'unchecked', reasons: ['post-gate threw: ' + ((e && e.message) || e)], flowDetail: null };
  }
}
function tmPostGateVeto(r){ return !!(r && r.postGate && r.postGate.state === 'veto'); }

/* hg-v1159: THE WITNESSES AND THE LEGS, RECORDED AS THREE-STATE MARKS.
   Four witnesses have held rows off the class desks since hg-v1012 / v1019 /
   v1020 / v1034 and the record map only ever saw the rows they let through,
   marked `true` — so the ledger could compare WITH against SILENT and never
   against AGAINST, and what the hold-offs remove was unmeasurable by
   construction (the hg-v966 trap, four times). The composite rode every
   record as one number (tmScore, hg-v995) and never as its five legs. This
   is the one home for the reads bag both record sites hand the ledger:
     takerFlowWith · momWith · volWith · fundWith · trendQualityWith
        true  = the witness backed the row (WITH / TREND)
        false = it stood against (AGAINST · REFUSE · CHOP)
        absent = it abstained or could not read (FLAT / UNREAD — never a
                 guessed false, hg-v989's third state)
     tm:d1Trend · tm:cross · tm:cascade · tm:cloud · tm:adx
        each leg of trendScore's composite, true when its sign is the row's
        direction, false when it opposes, absent at zero
     tm:adxStrong — the ADX >= 25 strength bar itself, true / false / absent
     tm:freshCross — a GOLDEN / DEATH cross inside 10 bars, true with the
        row's direction, false against, absent when none
     postgate:veto — the hg-v1154 SWING post-gate verdict, unchanged
   Marks only: nothing here moves a tier, a plan or a desk. The ledger's read
   split asks, out of sample, which of them separates. */
function tmLegReads(r, dir){
  var out = {};
  if (!r || (dir !== 'long' && dir !== 'short')) return out;
  var sgn = (dir === 'long') ? 1 : -1;
  var c = (r.comps && typeof r.comps === 'object') ? r.comps : null;
  function leg(key, v){
    if (typeof v !== 'number' || !isFinite(v) || v === 0) return;
    out[key] = (v * sgn) > 0;
  }
  if (c){
    leg('tm:d1Trend', c.d1Trend); leg('tm:cross', c.d1Cross); leg('tm:cascade', c.h4Cascade);
    leg('tm:cloud', c.cloud); leg('tm:adx', c.adxPt);
  }
  if (typeof r.adx === 'number' && isFinite(r.adx)) out['tm:adxStrong'] = r.adx >= 25;
  if (r.freshCross === 'GOLDEN') out['tm:freshCross'] = (dir === 'long');
  else if (r.freshCross === 'DEATH') out['tm:freshCross'] = (dir === 'short');
  return out;
}
function tmRecordReads(r, dir){
  var rd = {};
  if (!r) return undefined;
  dir = dir || tmDirOf(r);
  if (r.flow && r.flow.verdict === 'with') rd.takerFlowWith = true;
  else if (r.flow && r.flow.verdict === 'against') rd.takerFlowWith = false;
  var ms = trendmxMomState(r, dir);
  if (ms === 'with') rd.momWith = true; else if (ms === 'against') rd.momWith = false;
  var vs = trendmxVolState(r, dir);
  if (vs === 'with') rd.volWith = true; else if (vs === 'against') rd.volWith = false;
  var fs = trendmxFundState(r, dir);
  if (fs === 'with') rd.fundWith = true; else if (fs === 'against' || fs === 'refuse') rd.fundWith = false;
  var cs = trendmxChopState(r);
  if (cs && cs.state === 'trend') rd.trendQualityWith = true; else if (cs && cs.state === 'chop') rd.trendQualityWith = false;
  var pgr = tmPostGateReads(r);
  if (pgr) rd['postgate:veto'] = pgr['postgate:veto'];
  var legs = tmLegReads(r, dir), k;
  for (k in legs){ if (Object.prototype.hasOwnProperty.call(legs, k)) rd[k] = legs[k]; }
  return Object.keys(rd).length ? rd : undefined;
}
/* hg-v1159: the TICKET claim on a record is the board's own CLEAN tier — the
   one rule (trendmxRowTier) that already caps a row at NEAR under every
   witness and the post-gate veto. The crown recorder (hg-v1039) claimed
   ticket:true on every 7/7 row the board itself showed as NEAR; both sites
   read this now. */
function tmTicketClaim(r, plan){
  return trendmxRowTier(r, plan) === 'clean';
}
/* hg-v1160: WHICH READS SEPARATE, ON THIS DESK'S OWN REPLAY. HG_TM_FACTOR_SEP
   is written by scripts/trendmx-factor-separation.mjs off the walk that
   scripts/backtest-trendmx.mjs leaves (the hg-v921 rule: a generated thing
   writes itself) -- the same walk-then-judge shape OMNIROUTE (hg-v987) and
   OMNIPRESENT (hg-v988) carry, on the reads this desk has recorded since
   hg-v1159. Rendered through OMNIROUTE's one renderer (hgOmniFactorSepHtml)
   so there is one panel for three desks. While the walk has not run the
   literal reads measured:false and the panel SAYS so in place of a table,
   because an empty table is not a clean bill (hg-v955); three reads are
   forward-only (no bar archive carries them) and are named as such. Nothing
   here gates anything: the literal is read by tmFactorSepHtml and by nothing
   else. */
/* --- BEGIN GENERATED HG_TM_FACTOR_SEP (scripts/trendmx-factor-separation.mjs) ---
     Re-derive with `node scripts/trendmx-factor-separation.mjs --write`. Do not
     hand-edit — generated literals write themselves (hg-v921). Every figure is
     read off backtest-trendmx-results.json; the guard re-runs the generator and fails on drift. */
  var HG_TM_FACTOR_SEP = {
    artifact: "backtest-trendmx-results.json", n: 0, windows: 4, minSide: 20,
    span: null,
    measured: false,
    tab: "TRENDMX",
    forwardOnly: ["takerFlowWith","fundWith","postgate:veto"],
    reads: [],
    bound: "no bound: nothing walked",
    note: "scripts/backtest-trendmx-results.json does not exist: the TREND MATRIX replay (scripts/backtest-trendmx.mjs) has not run on a machine that can fetch bars. Every read this desk records (hg-v1159) is unmeasured against its complement until it does; the forward ledger is the only evidence this desk has.",
    verdicts: [],
    leans: [],
    inSampleVerdicts: [],
    rows: [

    ]
  };
  /* --- END GENERATED HG_TM_FACTOR_SEP --- */
function tmFactorSepHtml(T){
  try{
    T = (T === undefined) ? HG_TM_FACTOR_SEP : T;   /* the OMNIROUTE renderer's own seam: a harness hands a literal in */
    if (!T) return '';
    if (T.measured !== true || !Array.isArray(T.rows) || !T.rows.length){
      return '<div class="note" data-tm-replay="unmeasured"><b>REPLAY · NOT YET MEASURED.</b> ' + escH(T.note || 'the walk has not run')
        + ((Array.isArray(T.forwardOnly) && T.forwardOnly.length) ? ' <span class="dim">Forward-only reads, measurable in the ledger above and nowhere else: ' + T.forwardOnly.map(escH).join(', ') + '.</span>' : '')
        + '</div>';
    }
    if (typeof W.hgOmniFactorSepHtml !== 'function') return '';
    return W.hgOmniFactorSepHtml(T) || '';
  }catch(e){ return ''; }
}
function tmPostGateReads(r){
  var pg = r && r.postGate;
  if (!pg) return undefined;
  if (pg.state === 'veto') return { 'postgate:veto': true };
  if (pg.state === 'pass') return { 'postgate:veto': false };
  return undefined;   /* unchecked: nothing was tested, nothing is recorded */
}
function tmPostGateLabel(r){
  var pg = r && r.postGate;
  if (!pg) return '';
  if (pg.state === 'veto') return 'POST-GATE VETO · ' + String(pg.reason || 'veto');
  if (pg.state === 'pass') return 'POST-GATE PASS';
  return 'POST-GATE UNCHECKED';
}
function tmPostGateChip(r){
  var pg = r && r.postGate;
  if (!pg) return '';
  if (pg.state === 'veto') return ' <span class="gpip bad" title="' + escH(pg.reason || '') + '">PG VETO</span>';
  if (pg.state === 'pass') return ' <span class="gpip ok">PG ✓</span>';
  return ' <span class="gpip">PG ?</span>';
}

/* ---------------- tab UI ---------------- */

var TURNOVER_FLOOR = (typeof W.hgDeskMinTurnover === 'function') ? W.hgDeskMinTurnover() : 5e6;
var CHUNK = 10;              // one visible batch: 10 coins, then the board updates
var CHUNK_SLEEP_MS = 40;

function tmVenueChip(item){
  return (typeof W.hgDeskVenueChipHTML === 'function') ? W.hgDeskVenueChipHTML(item) : '';
}
function tmSymLabel(row){
  if (!row) return '';
  return (typeof W.hgDeskSymLabel === 'function') ? W.hgDeskSymLabel(row) : (row.sym || '');
}
function tmRowVenue(row){
  return row && row.exchange ? String(row.exchange).toLowerCase() : 'binance';
}

function sleepMs(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function pxFmt(n){
  if (typeof px === 'function') return px(n); // index.html adaptive formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}

function fmtN(n, d){
  if (typeof fmt === 'function') return fmt(n, d); // index.html formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

function escH(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ---------------- universal trade plan (SL/TP levels) ---------------- */
var TM_STOP_ATR = 1.5, TM_T1_R = 2, TM_T2_R = 3.5, TM_ATR_LEN = 14;
var TM_MAJORITY = 2;   // |composite| >= 2 = the row's own majority signal
var TM_MIN_RR = (typeof W.CG_SWING_RR_MIN === 'number') ? W.CG_SWING_RR_MIN : 2.0;

/* majority direction from the row's own composite score; an explicit
   lowercase/uppercase dir always wins over the score. */
function tmDirOf(inp){
  var dir = (inp && typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
  if (dir === 'long' || dir === 'short') return dir;
  var sc = (inp && typeof inp.score === 'number' && isFinite(inp.score)) ? inp.score : 0;
  if (sc >= TM_MAJORITY) return 'long';
  if (sc <= -TM_MAJORITY) return 'short';
  return null;
}

function tmFallbackStop(dir, entry, a, rows){
  var stopOpts = (typeof hgStructureStopOpts === 'function') ? hgStructureStopOpts({ atrLen: TM_ATR_LEN }) : { atrLen: TM_ATR_LEN, look: 20 };
  if (typeof hgStructureStop === 'function'){
    var st = hgStructureStop(dir, entry, rows, stopOpts);
    if (st) return { stop: st.stop, note: st.note };
  }
  var look = stopOpts.look || 20;
  var stop = NaN, note = '';
  var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, look) : NaN;
  if (isFinite(sw)){
    var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
    var r = (dir === 'long') ? entry - s : s - entry;
    if (r > 0 && r <= 2.5 * a){ stop = s; note = 'stop: lastSwing(4h,' + look + ') structure buffered 0.25×ATR' + TM_ATR_LEN; }
    else if (r > 2.5 * a) note = 'stop capped: structure beyond 2.5×ATR — ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' used';
  }
  if (!isFinite(stop)){
    stop = (dir === 'long') ? entry - TM_STOP_ATR * a : entry + TM_STOP_ATR * a;
    if (!note) note = 'stop: ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' (lastSwing unavailable)';
  }
  return { stop: stop, note: note };
}

function tmValidSetup(s){
  if (!s || !isFinite(s.entry) || s.entry <= 0 || !isFinite(s.stop) || !isFinite(s.t1)) return false;
  if (Math.abs(s.entry - s.stop) <= 0) return false;
  var rr = isFinite(s.rr1) ? s.rr1
    : Math.abs(s.t1 - s.entry) / Math.abs(s.entry - s.stop);
  return isFinite(rr) && rr >= TM_MIN_RR - 1e-9;
}

function trendmxTicker(inp){
  inp = inp || {};
  var mark = isFinite(inp.price) ? inp.price
    : (inp.rows4h && inp.rows4h.length ? inp.rows4h[inp.rows4h.length - 1].c : null);
  return { symbol: inp.sym, fundingPct: inp.fundingPct, mark: mark };
}

function trendmxClassify(inp, dir){
  var c = (inp && inp.comps) ? inp.comps : {};
  var longEv = [], shortEv = [];
  if (c.d1Trend > 0) longEv.push('1D above EMA200');
  else if (c.d1Trend < 0) shortEv.push('1D below EMA200');
  if (c.d1Cross > 0) longEv.push('EMA50>EMA200');
  else if (c.d1Cross < 0) shortEv.push('EMA50<EMA200');
  if (c.h4Cascade > 0) longEv.push('4H cascade bull');
  else if (c.h4Cascade < 0) shortEv.push('4H cascade bear');
  if (c.cloud > 0) longEv.push('above cloud');
  else if (c.cloud < 0) shortEv.push('below cloud');
  if (c.adxPt > 0) longEv.push('ADX strength bull');
  else if (c.adxPt < 0) shortEv.push('ADX strength bear');
  var regime = '';
  try{
    if (typeof hgTapeRegimeLabel === 'function' && inp.rows4h && inp.rows4h.length)
      regime = hgTapeRegimeLabel(inp.rows4h) || '';
  }catch(e){}
  return {
    dir: dir,
    longEv: longEv,
    shortEv: shortEv,
    regime: regime,
    score: Math.abs((inp && inp.score) || 0),
    total: 5
  };
}

/* cryptogates parity for the row's trend direction — never throws */
function trendmxGateEval(inp, dir){
  try{
    if (!dir || !inp || !inp.rows4h || !inp.rows4h.length) return null;
    var ticker = trendmxTicker(inp);
    var out = {
      gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false,
      hit: null, label: 'trend only', veto: null
    };
    if (typeof swingTryClean === 'function'){
      var clean = swingTryClean(inp.rows4h, ticker);
      if (clean && clean.dir === dir){
        out.hit = clean;
        out.clean7 = clean.clean === true || (+clean.passed >= 7);
        out.gatesPassed = clean.passed != null ? +clean.passed : 7;
        out.label = out.clean7 ? '7/7 CLEAN' : (out.gatesPassed + '/7');
        out.nearClean = !out.clean7 && out.gatesPassed >= 6;
        return out;
      }
    }
    if (typeof swingTryNear === 'function'){
      var near = swingTryNear(inp.rows4h, ticker);
      if (near && near.dir === dir){
        out.hit = near;
        out.nearClean = true;
        out.gatesPassed = near.passed != null ? +near.passed : 6;
        out.label = out.gatesPassed + '/7 NEAR';
        return out;
      }
    }
    if (typeof hgSwingParity === 'function'){
      var par = hgSwingParity(inp.rows4h, ticker, dir);
      if (par && par.aligned){
        out.gatesPassed = par.passed || 0;
        out.clean7 = par.clean === true;
        out.nearClean = !par.clean && par.passed >= 6;
        out.label = par.label || (par.passed + '/7');
      }
    } else if (typeof swingGateMatrix === 'function'){
      var m = swingGateMatrix(inp.rows4h, ticker);
      if (m && m.regimeVeto){ out.veto = 'regime'; out.label = 'regime veto'; return out; }
      if (m && m.structureVeto){ out.veto = 'structure'; out.label = 'CHoCH veto'; return out; }
      if (m && m.dir === dir){
        out.gatesPassed = m.passed || 0;
        out.clean7 = m.clean === true;
        out.nearClean = !m.clean && m.passed >= 6;
        out.label = (m.passed || 0) + '/7' + (m.clean ? ' CLEAN' : (m.passed >= 6 ? ' NEAR' : ''));
      } else if (m && m.dir){
        out.label = 'gates ' + m.dir + ' vs trend';
      }
    }
    return out;
  }catch(e){ return null; }
}

function trendmxAttachMeta(plan, gate, extra){
  if (!plan) return plan;
  if (gate){
    plan.gatesPassed = gate.gatesPassed;
    plan.clean7 = gate.clean7;
    plan.nearClean = gate.nearClean;
    plan.gateLabel = gate.label;
  }
  if (extra && extra.formationScore != null) plan.formationScore = extra.formationScore;
  /* WHERE PRICE IS, carried with the plan. trendmxTicker already derives
     exactly this — inp.price, else the last 4h close — for the gate
     evaluation; the plan just never kept it, so the card could not tell
     whether price had already walked through the levels it was drawing.
     Positive finite only: an unknown mark stays absent and renders no
     verdict rather than a wrong one. */
  if (plan.mark == null && extra){
    var tmMark = isFinite(+extra.price) ? +extra.price
      : ((extra.rows4h && extra.rows4h.length) ? +extra.rows4h[extra.rows4h.length - 1].c : NaN);
    if (isFinite(tmMark) && tmMark > 0) plan.mark = tmMark;
  }
  if (!plan.planSrc) plan.planSrc = 'trendmx';
  if (typeof W.hgOmniPrincipalApply === 'function'){
    try{
      W.hgOmniPrincipalApply(plan, {
        tab: 'trendmx', rows: extra && extra.rows4h, strategy: 'trendmx', dir: plan.dir
      });
      if (plan.demoted || plan.deskEdgeAction === 'suppress') plan.omniDemoted = true;
    }catch(eOm){}
  }
  return plan;
}

/* window.trendmxPlan({dir?|score?, cls?, rows4h, rows1h?, entry?}) -> plan|null.
   Pure: no DOM, no network, every global feature-checked, never throws.
   window.smartSetup (index.html) is preferred when available; otherwise the
   house fallback: entry = last 4h close, stop = lastSwing(4h,30) structure
   within 2.5xATR else 1.5xATR against dir, T1 = 2R, T2 = 3.5R. null when
   there is no majority direction or levels cannot be computed honestly. */

function tmBaseOf(inp){
  var b = String((inp && (inp.base || inp.sym)) || '').toUpperCase();
  return b.replace(/^B-/, '').replace(/_USDT$/, '').replace(/USDT$/, '');
}
function tmAltLongBlockedByBtc(inp){
  if (tmBaseOf(inp) === 'BTC') return false;
  return !!((__tmMacro && __tmMacro.btcStructure === 'down'));
}
function trendmxStampBtcStructure(rows){
  var st = null;
  if (Array.isArray(rows)){
    for (var i = 0; i < rows.length; i++){
      if (tmBaseOf(rows[i]) !== 'BTC') continue;
      try{ st = tmStructureDir(rows[i].rows4h); }catch(eSt){ st = null; }
      if (st) break;
    }
  }
  var prev = __tmMacro || {};
  trendmxMacroSet({ btcFunding: prev.btcFunding != null ? prev.btcFunding : null, btcStructure: st });
  return st;
}
function tmAtrLast(rows){
  try{
    if (!rows || typeof atr !== 'function') return NaN;
    var a = atr(rows, 14);
    if (!a || !a.length) return NaN;
    var v = a[a.length - 1];
    return isFinite(v) ? v : NaN;
  }catch(e){ return NaN; }
}
function tmEmaLast(closes, len){
  if (typeof ema !== 'function' || !closes) return NaN;
  var series = ema(closes, len);
  if (!series || !series.length) return NaN;
  var v = series[series.length - 1];
  return isFinite(v) ? v : NaN;
}
/* A fresh cross is not filled at the print. The order is a limit at the
   nearer 4h EMA that price has to come back to. If price is already through
   both, the pullback has happened and the last close is the entry. The
   limit dies if it is not tagged within 6 four-hour bars. */
function trendmxApplyCrossLimit(plan, inp, dir){
  if (!plan) return null;
  var kind = inp && inp.freshCross;
  if (kind !== 'GOLDEN' && kind !== 'DEATH') return plan;
  var rows = inp.rows4h;
  if (!rows || rows.length < 21) return plan;
  var closes = rows.map(function(r){ return r ? r.c : NaN; });
  var px = closes[closes.length - 1];
  var e9 = tmEmaLast(closes, 9), e21 = tmEmaLast(closes, 21);
  if (!isFinite(px)) return plan;
  var cands = [];
  if (dir === 'long'){
    if (isFinite(e9) && e9 < px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 < px) cands.push(['EMA21', e21]);
  } else {
    if (isFinite(e9) && e9 > px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 > px) cands.push(['EMA21', e21]);
  }
  var entry = px, emaName = 'MARKET', entryType = 'MARKET';
  if (cands.length){
    cands.sort(function(a, b){ return Math.abs(a[1] - px) - Math.abs(b[1] - px); });
    entry = cands[0][1];
    emaName = cands[0][0];
    entryType = 'LIMIT';
  }
  var stop = plan.stop;
  var a = tmAtrLast(rows);
  if (dir === 'long' && !(entry > stop) && isFinite(a) && a > 0) stop = entry - 1.5 * a;
  if (dir === 'short' && !(stop > entry) && isFinite(a) && a > 0) stop = entry + 1.5 * a;
  var risk = dir === 'long' ? entry - stop : stop - entry;
  if (!(risk > 0)) return plan;
  var bit = entryType === 'LIMIT'
    ? ('LIMIT @ 4h ' + emaName + ' · cancel if not tagged in 6×4h')
    : 'price already at the 4h EMAs';
  return Object.assign({}, plan, {
    entry: entry, stop: stop,
    t1: dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
    t2: dir === 'long' ? entry + 3.5 * risk : entry - 3.5 * risk,
    rr1: 2, rr2: 3.5, riskPct: risk / entry * 100,
    entryType: entryType, limitEma: emaName,
    note: (plan.note ? plan.note + ' · ' : '') + bit
  });
}

function trendmxPlan(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    if (dir === 'long' && tmAltLongBlockedByBtc(inp)) return null;
    var plan = null;
    if (typeof hgBestLevels === 'function'){
      var gate = inp.gate || trendmxGateEval(inp, dir);
      var bl = hgBestLevels(Object.assign({}, inp, {
        tab: 'trendmx', style: 'swing', dir: dir, gate: gate,
      }));
      if (bl && bl.ok && bl.plan && tmValidSetup(bl.plan)){
        plan = trendmxAttachMeta(bl.plan, bl.gate || gate, { formationScore: bl.formationScore, rows4h: inp.rows4h, price: inp.price });
      } else if (bl && bl.veto) return null;
    }
    if (!plan) plan = trendmxPlanLegacy(inp);
    return trendmxApplyCrossLimit(plan, inp, dir);
  }catch(e){ return null; }
}

function trendmxPlanLegacy(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    var rows = inp.rows4h;
    if (!Array.isArray(rows) || !rows.length) return null;
    var lastBar = rows[rows.length - 1];
    if (!lastBar) return null;
    var ticker = trendmxTicker(inp);
    var gate = inp.gate || trendmxGateEval(inp, dir);

    /* 1) gate-clean hit + unified formation ticket (same as GATES scan) */
    if (gate && gate.hit && !gate.veto && typeof hgFormTicket === 'function'){
      try{
        var fm = hgFormTicket(gate.hit, {
          rows: rows, style: 'swing', a4: gate.hit.a4,
          rows1h: inp.rows1h, ticker: ticker
        });
        if (fm && fm.ok && fm.hit && tmValidSetup(fm.hit)){
          return trendmxAttachMeta(fm.hit, gate, { formationScore: fm.formationScore, rows4h: rows, price: inp.price });
        }
      }catch(eForm){}
    }

    /* 2) swing clean plan from cryptogates */
    if (typeof hgSwingCleanPlan === 'function'){
      try{
        var sc = hgSwingCleanPlan(rows, ticker, dir);
        if (tmValidSetup(sc)) return trendmxAttachMeta(sc, gate, { rows4h: rows, price: inp.price });
      }catch(eSc){}
    }

    /* 3) structure-based hgPlanLevels with min R:R */
    if (typeof hgPlanLevelsCore === 'function'){
      try{
        var pl = hgPlanLevelsCore(dir, rows, null, { minRr: TM_MIN_RR, style: 'swing', type: 'TRENDMX' });
        if (tmValidSetup(pl)) return trendmxAttachMeta(pl, gate, { rows4h: rows, price: inp.price });
      }catch(ePl){}
    }

    /* 4) SMART $ builder with trend-derived evidence */
    if (typeof smartSetup === 'function'){
      try{
        var cls = trendmxClassify(inp, dir);
        var s = smartSetup(cls, rows, inp.rows1h);
        if (tmValidSetup(s)){
          if (typeof hgApplyExactEntry === 'function'){
            s = hgApplyExactEntry(s, rows, { rows1h: inp.rows1h, style: s.type || 'swing', preferEdge: true }) || s;
          }
          return trendmxAttachMeta(s, gate, { rows4h: rows, price: inp.price });
        }
      }catch(eSmart){}
    }

    /* 5) house fallback — structure stop + structure targets when available */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, TM_ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = tmFallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    var t1 = (dir === 'long') ? entry + TM_T1_R * risk : entry - TM_T1_R * risk;
    var t2 = (dir === 'long') ? entry + TM_T2_R * risk : entry - TM_T2_R * risk;
    var runner = tmRunnerR(rows);
    var t3 = runner == null ? NaN : ((dir === 'long') ? entry + runner * risk : entry - runner * risk);
    if (typeof hgStructureTargets === 'function'){
      try{
        var tg = hgStructureTargets(dir, entry, st.stop, rows, a, { minRr: TM_MIN_RR, style: 'swing' });
        if (tg && isFinite(tg.t1)){
          t1 = tg.t1;
          if (isFinite(tg.t2)) t2 = tg.t2;
        }
      }catch(eTg){}
    }
    var fb = {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop, t1: t1, t2: t2, t3: t3,
      rr1: Math.abs(t1 - entry) / risk,
      rr2: Math.abs(t2 - entry) / risk,
      trailBe: (dir === 'long') ? entry + 0.35 * a : entry - 0.35 * a,
      riskPct: risk / entry * 100,
      confirmed: null, note: st.note, planSrc: 'trendmx-fallback'
    };
    if (!tmValidSetup(fb)) return null;
    return trendmxAttachMeta(fb, gate, { rows4h: rows, price: inp.price });
  }catch(e){ return null; }
}

/* plan line, same markup as oiflow.js:
   ENTRY <b>..</b> · STOP <b>..</b> · T1 <b>..</b> (xR) · T2 <b>..</b> (xR) · risk ..% */
function trendmxPlanHTML(s){
  if (!s) return '';
  var risk = (isFinite(s.entry) && isFinite(s.stop)) ? Math.abs(s.entry - s.stop) : NaN;
  var rr1 = isFinite(s.rr1) ? s.rr1 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t1 - s.entry) / risk : NaN);
  var rr2 = isFinite(s.rr2) ? s.rr2 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t2 - s.entry) / risk : NaN);
  return 'ENTRY <b>' + pxFmt(s.entry) + '</b> · STOP <b>' + pxFmt(s.stop) + '</b>'
    + ' · T1 <b>' + pxFmt(s.t1) + '</b> (' + fmtN(rr1, 1) + 'R)'
    + ' · T2 <b>' + pxFmt(s.t2) + '</b> (' + fmtN(rr2, 1) + 'R)'
    + (isFinite(s.t3) ? (' · T3 <b>' + pxFmt(s.t3) + '</b> (' + (Math.abs(s.t3 - s.entry) / Math.abs(s.entry - s.stop)).toFixed(1) + 'R)') : '')
    + (isFinite(s.trailBe) ? (' · after T1, example stop <b>' + pxFmt(s.trailBe) + '</b>') : '')
    + (function(){ var ex = tmExampleSize(s.entry, s.stop); return ex ? (' · example 1% of $10,000 is ' + ex.units.toFixed(4) + ' units ($' + ex.notional.toFixed(0) + '), not an order') : ''; })()
    + (isFinite(s.riskPct) ? ' · risk ' + fmtN(s.riskPct, 2) + '%' : '')
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(s.entry, s.stop) : '')
    + (s.note ? ' — ' + escH(s.note) : '')
    /* price may have walked through this plan already — the shared rule in
       hg-plan.js, judged against the mark trendmxAttachMeta carried over */
    + ((typeof W !== 'undefined' && W && typeof W.hgPlanGeometryLineHtml === 'function')
      ? (W.hgPlanGeometryLineHtml({ dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1 },
                                  s.mark, { cls: 'note warn', style: 'margin-top:6px' }) || '') : '')
    /* the shared 14-gate indicator read attached by hgBestLevels */
    + ((typeof hgStrategyConfirmChipHtml === 'function')
      ? hgStrategyConfirmChipHtml(s.strategyConfirm, s.strategyWith, s.strategyAgainst) : '')
    + (s.contextRead ? '<div class="dim">' + escH(s.contextRead)
        + (s.contextWarn ? ' — context AGAINST this direction' : '') + '</div>' : '')
    + ((typeof hgStrategyTradeDetailHtml === 'function')
      ? hgStrategyTradeDetailHtml(s, { skipChip: true }) : '');
}

/* expandable-row block for one matrix row; uses the scan-cached 4h rows —
   never refetches. */
function trendmxCardStack(r, dir){
  try{
    if (!dir) return null;
    var gate = r.gate || trendmxGateEval(r, dir);
    var ticker = trendmxTicker(r);
    if (gate && gate.hit && typeof hgSetupStackFromHit === 'function'){
      var hit = Object.assign({}, gate.hit, { sym: r.sym });
      if (typeof hgSetupStackAttach === 'function'){
        hgSetupStackAttach(hit, {
          sym: r.sym, style: 'swing', rows4h: r.rows4h, rows1h: r.rows1h, ticker: ticker
        });
        return hit.stack || null;
      }
    }
    if (typeof hgSetupStackForInlineScan !== 'function') return null;
    return hgSetupStackForInlineScan({
      dir: dir, sym: r.sym, rows4h: r.rows4h, rows1h: r.rows1h,
      style: 'swing', asset: 'crypto', ticker: ticker,
      clean: !!(gate && gate.clean7),
      nearClean: !!(gate && gate.nearClean),
