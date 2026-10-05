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
      type: 'ATR', dir: dir, entry: entry, stop: st.stop, t1: t1, t2: t2,
      rr1: Math.abs(t1 - entry) / risk,
      rr2: Math.abs(t2 - entry) / risk,
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
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'GOLDEN') continue;
    if (!r.comps || r.comps.d1Cross <= 0) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (r.gate && r.gate.veto) continue;
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: r.rows4h, rows1h: r.rows1h, entry: r.price, gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'long', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || (r.gate && r.gate.clean7)),
      freshCross: 'GOLDEN', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || (r.gate && r.gate.label),
      note: '⚡GOLDEN CROSS (EMA50/200 · ≤10 daily bars) · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + (plan.gateLabel ? ' · ' + plan.gateLabel : '')
        + (plan.entryType === 'LIMIT' ? (' · LIMIT @ 4h ' + plan.limitEma + ' · cancel if not tagged in 6×4h') : ' · entry at price, already on the 4h EMAs')
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
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'DEATH') continue;
    if (!r.comps || r.comps.d1Cross >= 0) continue;
    var dir = tmDirOf(r);
    if (dir !== 'short') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (r.gate && r.gate.veto) continue;
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: r.rows4h, rows1h: r.rows1h, entry: r.price, gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'short', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || (r.gate && r.gate.clean7)),
      freshCross: 'DEATH', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || (r.gate && r.gate.label),
      note: '⚡DEATH CROSS (EMA50/200 · ≤10 daily bars) · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + (plan.gateLabel ? ' · ' + plan.gateLabel : '')
        + (plan.entryType === 'LIMIT' ? (' · LIMIT @ 4h ' + plan.limitEma + ' · cancel if not tagged in 6×4h') : ' · entry at price, already on the 4h EMAs')
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
