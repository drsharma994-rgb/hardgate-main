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
      gatesPassed: gate ? gate.gatesPassed : undefined,
      gatesTotal: 7,
      tightCount: gate && gate.hit ? gate.hit.tightCount : undefined
    });
  }catch(e){ return null; }
}

function trendmxPlanBlock(r){
  var dir = tmDirOf(r);
  if (!dir)
    return '<div class="plan">No majority direction on this row (|score| &lt; ' + TM_MAJORITY + ') — no levels.</div>';
  if (dir === 'long' && tmAltLongBlockedByBtc(r))
    return '<div class="plan">No long. BTC structure is down, so alt longs are stood down.</div>';
  var s = trendmxPlan(Object.assign({}, r, { dir: dir }));
  /* lazy SMC read for a row the operator expanded by hand: one row per click,
     not a repaint loop, so rows outside the scan's capped slice still get a
     context when they are actually looked at. */
  if (s && !r.smc && r.rows4h && r.rows4h.length && tmSmcOn()){
    var tmSyn = { sym: r.sym, dir: dir, entry: s.entry, stop: s.stop, t1: s.t1 };
    tmSmcMark(tmSyn, r.rows4h);
    if (tmSyn.smc) r.smc = tmSyn.smc;
  }
  var tmStack = trendmxCardStack(r, dir);
  var stackHtml = (tmStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(tmStack) : '';
  var inner = '<b>' + escH(r.sym) + '</b> ' + dir.toUpperCase() + ' · '
    + (s ? trendmxPlanHTML(s)
         : 'levels unavailable — 4h history was not cached for this row or ATR' + TM_ATR_LEN + ' is not computable; nothing is estimated.');
  if (s && s.gateLabel){
    inner += ' · <span class="gpip ' + (s.clean7 ? 'ok' : (s.nearClean ? '' : '')) + '">' + escH(s.gateLabel) + '</span>';
  }
  inner += tmSmcChip(r);
  /* hg-v1012: the evidence layer beside the plan an operator expanded to
     inspect — the stamps the scan left, never recomputed here */
  inner += trendmxFlowChipHtml(r) + trendmxFundingChipHtml(r);
  var tradeOnclick = (s && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: tmStack, scanner: 'trendmx', strategy: 'trendmx' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var btn = tradeOnclick
    ? ' <button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookStamp = (s && typeof hgBookStampChip === 'function')
    ? hgBookStampChip(r.sym, s.dir, { scanner: 'trendmx', strategy: 'trendmx' }) : '';
  var bookBtn = (s && typeof bookBtnHTML === 'function')
    ? ' ' + bookBtnHTML(r.sym, s.dir, s.entry, s.stop, s.t1,
      { scanner: 'trendmx', strategy: 'trendmx', t2: s.t2, stack: tmStack }) : '';
  return '<div class="plan">' + inner + stackHtml + bookStamp + btn + bookBtn + '</div>';
}

var COLS = [
  { k: 'sym',       label: 'SYMBOL' },
  { k: 'score',     label: 'SCORE' },
  { k: 'gates',     label: 'GATES' },
  { k: 'd1Trend',   label: '1D TREND' },
  { k: 'd1Cross',   label: 'CROSS' },
  { k: 'h4Cascade', label: '4H CASCADE' },
  { k: 'cloud',     label: 'CLOUD' },
  { k: 'adx',       label: 'ADX' },
  { k: 'price',     label: 'PRICE' },
  { k: 'plan',      label: 'LEVELS', nosort: true }
];

/* ---------------- hard-refresh contract state ----------------
   tmTab mirrors the mounted pane's scan state so the HG_tabs refresh()
   (4th registration field) can re-run a scan the OPERATOR already started.
   A global hard refresh must NEVER trigger the expensive first-time
   full-universe scan on a tab that was never used — it skips honestly.
   busy mirrors runScan's own state.running guard so overlapping refresh
   invocations can't double-fetch. */
var tmTab = { run: null, busy: false, hasRun: false, missing: 0, mountEl: null };
var __tmSnap = null;
var __tmScanSnap = null;

/* hg-v1013: conviction is the STRENGTH of the majority, not its side.
   Every other reader of the composite is direction-agnostic — tmDirOf
   (|score| >= 2), the FORMING predicate (|score|), the board rank
   (|score|), the summary's strong counts (+4/-4) — while this one read
   sc >= 4 / sc >= 2, so a row at -5, the maximum bearish alignment the
   composite can print, had less standing than a row at +2. The practical
   effect: no short ever reached the LIMIT BOARD or the promoted slice
   (SMC + taker flow) except through a 7/7 clean, and the CONVICTION
   filter never showed a short. The bars do not move — 4 and TM_MAJORITY,
   exactly as before; they just stop pointing one way. Not a
   recalibration: the same numbers, applied to the side they always
   claimed to measure. The golden desk is untouched — it enforces
   dir === 'long' before conviction is ever asked. */
function trendmxConviction(row){
  var sc = (row && typeof row.score === 'number' && isFinite(row.score)) ? row.score : 0;
  var a = Math.abs(sc);
  if (a >= 4) return { tier: 'STRONG', label: 'STRONG CONVICTION', prime: true };
  if (a >= TM_MAJORITY) return { tier: 'CONVICTION', label: 'CONVICTION', prime: false };
  return null;
}

/** Rows with fresh ⚡GOLDEN (EMA50/200 cross ≤10d) + bull cross + long plan + conviction. Pure. */
function trendmxGoldenCrossSetups(rows){
  var out = [];
  out.held = { waiting: 0, grade: 0, cascade: 0, gates: 0 };
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'GOLDEN') continue;
    if (!r.comps || r.comps.d1Cross <= 0) continue;
    /* hg-v1150: an unpriceable row is not a setup. hgBestLevels can price a
       plan straight off the tape, which is right for a THIN row — but a row
       whose own published price is unreadable is corrupt, and a corrupt row
       must not mint a ticket the board would show beside a price it cannot
       print. */
    if (!isFinite(+r.price)) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (tmCascadeDir(r.rows4h) !== 1){ out.held.cascade++; continue; }
    /* hg-v1150: THE ROW-CARRIED VETO IS RESPECTED. The closed-gate recompute
       below re-derives the 7-gate matrix off the tape, but it can never
       reproduce a veto the SCAN stamped on the row (a chase block, a
       formation-edge suppression) — those live on r.gate, written by the
       upstream layers that know them. An explicit r.gate.veto holds the row
       off this desk no matter what the bare tape says; the recompute then
       serves the rows that arrive without one. */
    if (r.gate && r.gate.veto){ out.held.gates++; continue; }
    var gate = trendmxClosedGate(r, dir);
    if (!gate || gate.veto || !(gate.gatesPassed >= 6)){ out.held.gates++; continue; }
    var grade = trendmxSetupGrade(r, dir);
    if (grade.grade !== 'TRADE'){ out.held.grade++; continue; }
    var tag = trendmxEmaTag(r.rows4h, dir);
    if (!tag || tag.state !== 'ready'){ out.held.waiting++; continue; }
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: tmClosedRows(r.rows4h, 14400), rows1h: r.rows1h, entry: r.price, gate: gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'long', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || gate.clean7),
      freshCross: 'GOLDEN', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || gate.label,
      note: '⚡GOLDEN CROSS on a closed daily bar · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + ' · 4h cascade · ' + (gate.gatesPassed || 0) + '/7'
        + ' · TRADE'
        + (plan.entryType === 'LIMIT' ? (' · 4h ' + plan.limitEma + ' tagged') : ' · tagged at the 4h EMAs')
    });
  }
  return out;
}

/* hg-v1014: the mirrored desk — rows with fresh ⚡DEATH (EMA50/200 cross
   UNDER, <=10 daily bars) + bear cross + short majority + conviction +
   valid short plan. The exact mirror of the golden desk, bar for bar:
   the same freshness window, the same conviction bars (|score|, hg-v1013
   — a fresh death cross at -2 earns the standing a golden cross earns at
   +2), the same veto respect, the same plan-validity bar. A death cross
   IS a bear cross; leaving shorts off this desk was the last one-sided
   surface on the tab. Pure. */
function trendmxDeathCrossSetups(rows){
  var out = [];
  out.held = { waiting: 0, grade: 0, cascade: 0, gates: 0 };
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'DEATH') continue;
    if (!r.comps || r.comps.d1Cross >= 0) continue;
    /* hg-v1150: the mirror carries the same corrupt-row rule. */
    if (!isFinite(+r.price)) continue;
    var dir = tmDirOf(r);
    if (dir !== 'short') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (tmCascadeDir(r.rows4h) !== -1){ out.held.cascade++; continue; }
    /* hg-v1150: the row-carried veto is respected on the mirror too — the
       same rule the golden desk gained one screen up. */
    if (r.gate && r.gate.veto){ out.held.gates++; continue; }
    var gate = trendmxClosedGate(r, dir);
    if (!gate || gate.veto || !(gate.gatesPassed >= 6)){ out.held.gates++; continue; }
    var grade = trendmxSetupGrade(r, dir);
    if (grade.grade !== 'TRADE'){ out.held.grade++; continue; }
    var tag = trendmxEmaTag(r.rows4h, dir);
    if (!tag || tag.state !== 'ready'){ out.held.waiting++; continue; }
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: tmClosedRows(r.rows4h, 14400), rows1h: r.rows1h, entry: r.price, gate: gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'short', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || gate.clean7),
      freshCross: 'DEATH', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || gate.label,
      note: '⚡DEATH CROSS on a closed daily bar · composite ' + r.score + '/5'
        + ' · 4h cascade · ' + (gate.gatesPassed || 0) + '/7'
        + ' · TRADE'
        + (plan.entryType === 'LIMIT' ? (' · 4h ' + plan.limitEma + ' tagged') : ' · tagged at the 4h EMAs')
    });
  }
  return out;
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

/* ---------------- SMC context (record-only) ----------------
   hgSmcEnrich attaches .smc (structure bias, OB/FVG confluence, a grade) and
   records one SMC_CONTEXT signal. Nothing in this file reads .smc except the
   chip helper below: composite score, gate label, tier, sort order, the venue
   and quality filters and whether a card is shown are all untouched.

   Cost: the matrix holds the whole universe and every row carries its own
   120-bar 4h array, so SMC runs ONCE per scan over a capped, ranked slice of
   the rows the desk itself promotes — never from a render path, which
   repaints on every venue chip, SYNC DESK and chart-vision callback. */
var TM_SMC_MAX = 24;

function tmSmcOn(){
  try{ return !!(W && typeof W.hgSmcEnrich === 'function'); }catch(e){ return false; }
}

/* enrich a finished ticket in place; a ticket that already carries .smc, or a
   row with no cached 4h history, is left exactly as it was. */
function tmSmcMark(ticket, rows4h){
  try{
    if (!ticket || ticket.smc) return ticket;
    if (!Array.isArray(rows4h) || !rows4h.length) return ticket;
    if (W && typeof W.hgSmcEnrich === 'function') W.hgSmcEnrich(ticket, { rows: rows4h, tab: 'TREND MATRIX' });
  }catch(e){}
  return ticket;
}

function tmSmcChip(o){
  var out = '';
  try{
    if (o && o.smc && W && typeof W.hgSmcChipHtml === 'function') out = W.hgSmcChipHtml(o) || '';
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
