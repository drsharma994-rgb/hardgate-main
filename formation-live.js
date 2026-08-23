/* =========================================================================
HARDGATE — formation-live.js
Live internet context for setup formation.

WHAT THIS IS ALLOWED TO DO.
  Confirm, demote, convert MARKET→LIMIT, widen a stop past a known
  liquidation cluster, or refuse the ticket.

WHAT THIS MUST NOT DO.
  Invent ENTRY / STOP / T1. A silent feed is UNCHECKED, never a fake
  confirm. G1–G7 stay binding. Gold min-loss is untouched (gold path
  preserves levels). Crypto live trading stays disabled.

Sources are existing house caches and public APIs already on the desk:
  OI vs price, funding + predicted funding, liquidation clusters,
  CVD/OBI, book impact, cross-venue basis, Deribit DVOL, spot-perp
  traps, stables stress, news calendar. Missing data does not vote.

Classic script, IIFE. Never throws at load. Every helper is feature-checked.
========================================================================= */
'use strict';

(function(){

  var G = (typeof window !== 'undefined') ? window : globalThis;
  var __liveCache = {};
  var LIVE_TTL_MS = 120000;
  var PX_DEADZONE = 0.5;
  var OI_DEADZONE = 2.0;
  var FUND_FLIP = 0.05;
  var FUND_CROWD = 0.10;
  var BASIS_CAUTION = 0.40;
  var BASIS_EXTREME = 1.00;
  var IMPACT_RISK_FRAC = 0.25;
  var LIQ_NEAR_ATR = 0.25;
  var LIQ_BEYOND_ATR = 0.50;
  var LIQ_MAX_RISK_MULT = 3;
  var IMPLIED_T1_MULT = 1.75;

  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function gfn(name){
    return (G && typeof G[name] === 'function') ? G[name] : null;
  }
  function normSym(sym){
    return String(sym || '').toUpperCase().replace(/^B-/, '').replace(/_/g, '');
  }
  function sameCoin(a, b){
    var x = normSym(a).replace(/USDT$/, '').replace(/USD$/, '');
    var y = normSym(b).replace(/USDT$/, '').replace(/USD$/, '');
    return !!(x && y && (x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0));
  }
  function unchecked(label, note){
    return { state: 'unchecked', align: 'neutral', label: label, detail: note || 'feed silent', score: 0 };
  }

  /* ---- OI vs price --------------------------------------------------- */

  function hgLiveOiDivergence(dir, pxChg, oiChg){
    dir = String(dir || '').toLowerCase();
    var px = fin(pxChg), oi = fin(oiChg);
    if (dir !== 'long' && dir !== 'short') return unchecked('OI vs price', 'no direction');
    if (!isFinite(px) || !isFinite(oi)) return unchecked('OI vs price');
    if (Math.abs(px) < PX_DEADZONE || Math.abs(oi) < OI_DEADZONE)
      return { state: 'unchecked', align: 'neutral', label: 'OI vs price',
        detail: 'dead zone · px ' + px.toFixed(2) + '% / OI ' + oi.toFixed(2) + '%', score: 0 };
    var up = px >= PX_DEADZONE, dn = px <= -PX_DEADZONE;
    var oiUp = oi >= OI_DEADZONE, oiDn = oi <= -OI_DEADZONE;
    var regime = '';
    if (up && oiUp) regime = 'NEW LONGS';
    else if (up && oiDn) regime = 'SHORT COVERING';
    else if (dn && oiUp) regime = 'NEW SHORTS';
    else if (dn && oiDn) regime = 'LONG FLUSH';
    var withLong = (regime === 'NEW LONGS' || regime === 'LONG FLUSH');
    var withShort = (regime === 'NEW SHORTS' || regime === 'SHORT COVERING');
    var withDir = (dir === 'long' && withLong) || (dir === 'short' && withShort);
    return {
      state: withDir ? 'confirm' : 'warning',
      align: withDir ? 'with' : 'against',
      label: 'OI vs price',
      detail: regime + ' · px ' + px.toFixed(2) + '% / OI ' + oi.toFixed(2) + '%',
      score: withDir ? 6 : -6,
      regime: regime
    };
  }

  /* ---- funding + predicted funding ---------------------------------- */

  function hgLiveFundingPredict(dir, currentPct, predictedPct){
    dir = String(dir || '').toLowerCase();
    var cur = fin(currentPct), pred = fin(predictedPct);
    if (dir !== 'long' && dir !== 'short') return unchecked('funding predict', 'no direction');
    if (!isFinite(cur) && !isFinite(pred)) return unchecked('funding predict');
    var rate = isFinite(pred) ? pred : cur;
    var payAgainst = (dir === 'long' && rate >= FUND_FLIP) || (dir === 'short' && rate <= -FUND_FLIP);
    var crowd = Math.abs(rate) >= FUND_CROWD;
    var flipped = isFinite(pred) && isFinite(cur) && (
      (dir === 'long' && cur < FUND_FLIP && pred >= FUND_FLIP) ||
      (dir === 'short' && cur > -FUND_FLIP && pred <= -FUND_FLIP)
    );
    var detail = (isFinite(pred) ? ('pred ' + pred.toFixed(4) + '%') : 'current')
      + (isFinite(cur) ? (' · now ' + cur.toFixed(4) + '%') : '');
    if (payAgainst && crowd){
      return { state: 'warning', align: 'caution', label: 'funding predict', detail: detail + ' · crowded against',
        score: -8, refuseMarket: true };
    }
    if (flipped || payAgainst){
      return { state: 'warning', align: 'caution', label: 'funding predict', detail: detail + (flipped ? ' · flip against' : ' · pays against'),
        score: -4, refuseMarket: true };
    }
    return { state: 'confirm', align: 'with', label: 'funding predict', detail: detail + ' · clean',
      score: 3, refuseMarket: false };
  }

  /* ---- liquidation-aware stop (widen only) -------------------------- */

  function hgLiveLiqStopAdjust(dir, entry, stop, clusters, atr){
    dir = String(dir || '').toLowerCase();
    entry = fin(entry); stop = fin(stop); atr = fin(atr);
    var out = { ok: true, stop: stop, moved: false, reason: '', refuse: false };
    if (dir !== 'long' && dir !== 'short') return out;
    if (!(isFinite(entry) && isFinite(stop) && entry !== stop)) return out;
    if (!Array.isArray(clusters) || !clusters.length || !(atr > 0)){
      out.reason = 'no liq clusters';
      return out;
    }
    var risk0 = Math.abs(entry - stop);
    var near = LIQ_NEAR_ATR * atr;
    var beyond = LIQ_BEYOND_ATR * atr;
    var i, c, px, hit = null;
    for (i = 0; i < clusters.length; i++){
      c = clusters[i];
      px = fin(c && (c.price != null ? c.price : c.level));
      if (!isFinite(px)) continue;
      if (Math.abs(px - stop) > near) continue;
      if (dir === 'long' && px >= entry) continue;
      if (dir === 'short' && px <= entry) continue;
      if (!hit || (dir === 'long' ? px < hit : px > hit)) hit = px;
    }
    if (hit == null){
      out.reason = 'stop clear of clusters';
      return out;
    }
    var next = dir === 'long' ? (hit - beyond) : (hit + beyond);
    var farther = dir === 'long' ? (next < stop) : (next > stop);
    if (!farther){
      out.reason = 'cluster does not require a wider stop';
      return out;
    }
    var risk1 = Math.abs(entry - next);
    if (risk0 > 0 && risk1 > risk0 * LIQ_MAX_RISK_MULT){
      out.ok = false;
      out.refuse = true;
      out.reason = 'liq cluster would force a stop >' + LIQ_MAX_RISK_MULT + '× original risk';
      return out;
    }
    if (dir === 'long' && next >= entry) return out;
    if (dir === 'short' && next <= entry) return out;
    out.stop = next;
    out.moved = true;
    out.reason = 'stop widened beyond liq cluster @ ' + hit;
    return out;
  }

  /* ---- book / impact ------------------------------------------------- */

  function hgLiveBookFillOk(dir, entry, stop, live){
    dir = String(dir || '').toLowerCase();
    entry = fin(entry); stop = fin(stop);
    live = live || {};
    var out = { ok: true, state: 'unchecked', detail: 'no book', refuse: false, score: 0 };
    if (dir !== 'long' && dir !== 'short') return out;
    if (!(isFinite(entry) && isFinite(stop))) return out;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return out;
    var impact = dir === 'long' ? fin(live.impactBuy) : fin(live.impactSell);
    var depth = fin(live.depthUsd);
    var notional = fin(live.notionalUsd);
    var spread = fin(live.spreadBps);
    if (!isFinite(impact) && !isFinite(depth) && !isFinite(spread)) return out;
    if (isFinite(impact)){
      var walk = dir === 'long' ? (impact - entry) : (entry - impact);
      if (walk > risk * IMPACT_RISK_FRAC){
        return { ok: false, state: 'warning', detail: 'impact walks ' + walk.toFixed(4) + ' (>25% of risk)',
          refuse: true, score: -8 };
      }
    }
    if (isFinite(depth) && isFinite(notional) && notional > 0 && depth < notional * 2){
      return { ok: false, state: 'warning', detail: 'book too thin for size', refuse: true, score: -6 };
    }
    if (isFinite(spread) && spread > 25){
      return { ok: true, state: 'warning', detail: 'spread ' + spread.toFixed(1) + ' bps', refuse: false, score: -3 };
    }
    return { ok: true, state: 'confirm', detail: 'book can fill', refuse: false, score: 3 };
  }

  /* ---- options implied move (DVOL) ----------------------------------- */

  function hgLiveImpliedDailyPct(dvol){
    var v = fin(dvol);
    if (!(v > 0)) return null;
    return v / Math.sqrt(365);
  }

  function hgLiveImpliedMoveOk(dir, entry, t1, dvol){
    dir = String(dir || '').toLowerCase();
    entry = fin(entry); t1 = fin(t1);
    var daily = hgLiveImpliedDailyPct(dvol);
    var out = { ok: true, state: 'unchecked', detail: 'DVOL silent', refuse: false, dropT1: false, score: 0 };
    if (dir !== 'long' && dir !== 'short') return out;
    if (!(isFinite(entry) && entry > 0 && isFinite(t1))) return out;
    if (daily == null) return out;
    var need = Math.abs(t1 - entry) / entry * 100;
    if (need > daily * IMPLIED_T1_MULT){
      return {
        ok: false, state: 'warning',
        detail: 'T1 needs ' + need.toFixed(2) + '% vs implied ~' + daily.toFixed(2) + '%/d',
        refuse: true, dropT1: true, score: -8, dailyPct: daily
      };
    }
    return { ok: true, state: 'confirm', detail: 'implied ~' + daily.toFixed(2) + '%/d covers T1',
      refuse: false, dropT1: false, score: 3, dailyPct: daily };
  }

  /* ---- CVD / OBI ----------------------------------------------------- */

  function hgLiveCvdConfirms(dir, cvdSign, obi){
    dir = String(dir || '').toLowerCase();
    var out = { state: 'unchecked', align: 'neutral', flowOk: false, score: 0, detail: 'no CVD' };
    if (dir !== 'long' && dir !== 'short') return out;
    var cvd = fin(cvdSign);
    var book = fin(obi);
    if (!isFinite(cvd) && !isFinite(book)) return out;
    var withCvd = isFinite(cvd) && ((dir === 'long' && cvd > 0) || (dir === 'short' && cvd < 0));
    var againstCvd = isFinite(cvd) && ((dir === 'long' && cvd < 0) || (dir === 'short' && cvd > 0));
    var withObi = isFinite(book) && ((dir === 'long' && book > 0) || (dir === 'short' && book < 0));
    if (withCvd || withObi){
      return { state: 'confirm', align: 'with', flowOk: true, score: 5,
        detail: (withCvd ? 'CVD with' : '') + (withCvd && withObi ? ' · ' : '') + (withObi ? 'OBI with' : '') };
    }
    if (againstCvd){
      return { state: 'warning', align: 'against', flowOk: false, score: -5, detail: 'CVD against POI' };
    }
    return out;
  }

  /* ---- basis / venue premium ---------------------------------------- */

  function hgLiveBasisCaution(dir, basisPct){
    var b = fin(basisPct);
    if (!isFinite(b)) return unchecked('venue basis');
    var abs = Math.abs(b);
    if (abs >= BASIS_EXTREME){
      return { state: 'warning', align: 'caution', label: 'venue basis',
        detail: b.toFixed(3) + '% extreme — prefer the cheaper venue', score: -5 };
    }
    if (abs >= BASIS_CAUTION){
      return { state: 'warning', align: 'caution', label: 'venue basis',
        detail: b.toFixed(3) + '% rich/cheap', score: -2 };
    }
    return { state: 'confirm', align: 'neutral', label: 'venue basis',
      detail: b.toFixed(3) + '%', score: 0 };
  }

  /* ---- spot-perp / stables / news ----------------------------------- */

  function hgLiveSpotPerpVeto(dir, spotPerp){
    dir = String(dir || '').toLowerCase();
    if (!spotPerp || typeof spotPerp !== 'object') return { refuse: false, state: 'unchecked', detail: 'spot-perp silent', score: 0 };
    if (spotPerp.veto === true && (!spotPerp.dir || String(spotPerp.dir).toLowerCase() === dir)){
      return { refuse: true, state: 'warning', detail: spotPerp.reason || 'spot-perp trap', score: -10 };
    }
    if (spotPerp.confirms === true){
      return { refuse: false, state: 'confirm', detail: spotPerp.reason || 'spot+perp aligned', score: 3 };
    }
    return { refuse: false, state: 'unchecked', detail: spotPerp.reason || 'spot-perp mixed', score: 0 };
  }

  function hgLiveStablesVeto(stables){
    if (!stables || typeof stables !== 'object') return { refuse: false, state: 'unchecked', detail: 'stables silent', score: 0 };
    if (stables.depeg === true || stables.blowout === true){
      return { refuse: true, state: 'warning', detail: stables.reason || 'stables stress', score: -12 };
    }
    return { refuse: false, state: 'unchecked', detail: 'stables calm', score: 0 };
  }

  function hgLiveEventRisk(news){
    if (!news || typeof news !== 'object') return { refuse: false, state: 'unchecked', detail: 'calendar silent', score: 0 };
    if (news.block === true){
      return { refuse: true, state: 'warning', detail: news.title || news.reason || 'high-impact window', score: -10 };
    }
    if (news.caution === true){
      return { refuse: false, state: 'warning', detail: news.title || news.reason || 'event caution', score: -3 };
    }
    return { refuse: false, state: 'unchecked', detail: 'no event block', score: 0 };
  }

  /* ---- score + apply ------------------------------------------------- */

  function hgLiveFormationScoreDelta(plan, live){
    plan = plan || {};
    live = live || {};
    var dir = String(plan.dir || live.dir || '').toLowerCase();
    var n = 0;
    var parts = [];
    function add(r){
      if (!r || r.state === 'unchecked') return;
      n += isFinite(+r.score) ? +r.score : 0;
      parts.push(r);
    }
    add(hgLiveOiDivergence(dir, live.pxChg, live.oiChg));
    add(hgLiveFundingPredict(dir, live.fundingPct, live.predictedFundingPct));
    add(hgLiveCvdConfirms(dir, live.cvdSign, live.obi));
    add(hgLiveBasisCaution(dir, live.basisPct));
    var book = hgLiveBookFillOk(dir, plan.entry, plan.stop, live);
    if (book && book.state !== 'unchecked'){ n += book.score; parts.push(book); }
    var implied = hgLiveImpliedMoveOk(dir, plan.entry, plan.t1, live.dvol);
    if (implied && implied.state !== 'unchecked'){ n += implied.score; parts.push(implied); }
    var sp = hgLiveSpotPerpVeto(dir, live.spotPerp);
    if (sp && sp.state !== 'unchecked'){ n += sp.score; parts.push(sp); }
    if (n > 18) n = 18;
    if (n < -18) n = -18;
    return { delta: Math.round(n), parts: parts };
  }

  function hgLiveFormationApply(plan, live, ctx){
    ctx = ctx || {};
    live = live || {};
    var out = { ok: true, plan: plan, chips: [], scoreDelta: 0, reason: '', tag: 'live' };
    try{
      if (!plan || typeof plan !== 'object') return { ok: false, plan: plan, chips: [], scoreDelta: 0, reason: 'no plan', tag: 'live' };
      var next = plan;
      var dir = String(next.dir || '').toLowerCase();
      var chips = [];
      var preserve = ctx.preserveLevels === true || ctx.gold === true;

      var ev = hgLiveEventRisk(live.news);
      if (ev.refuse) return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: ev.detail, tag: 'event' };
      if (ev.state === 'warning') chips.push('event · ' + ev.detail);

      var st = hgLiveStablesVeto(live.stables);
      if (st.refuse) return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: st.detail, tag: 'stables' };

      var sp = hgLiveSpotPerpVeto(dir, live.spotPerp);
      if (sp.refuse) return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: sp.detail, tag: 'spot-perp' };

      var fund = hgLiveFundingPredict(dir, live.fundingPct, live.predictedFundingPct);
      if (fund.refuseMarket && next.entryType && String(next.entryType).indexOf('MARKET') >= 0){
        next.entryType = String(next.entryType).replace(/MARKET/, 'LIMIT');
        next.liveNote = (next.liveNote ? next.liveNote + ' · ' : '') + 'predicted funding against — limit only';
        chips.push('funding · LIMIT');
      } else if (fund.state === 'warning'){
        chips.push('funding · ' + fund.detail);
      }

      if (!preserve){
        var liq = hgLiveLiqStopAdjust(dir, next.entry, next.stop, live.clusters, ctx.a4);
        if (liq.refuse) return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: liq.reason, tag: 'liq' };
        if (liq.moved && isFinite(liq.stop)){
          next.stop = liq.stop;
          next.stopNote = (next.stopNote ? next.stopNote + ' · ' : '') + liq.reason;
          next.liveStopWidened = true;
          chips.push('liq stop widened');
        }
        var book = hgLiveBookFillOk(dir, next.entry, next.stop, live);
        if (book.refuse) return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: book.detail, tag: 'book' };

        var implied = hgLiveImpliedMoveOk(dir, next.entry, next.t1, live.dvol);
        if (implied.refuse){
          return { ok: false, plan: next, chips: chips, scoreDelta: 0, reason: implied.detail, tag: 'implied' };
        }
      }

      var cvd = hgLiveCvdConfirms(dir, live.cvdSign, live.obi);
      if (cvd.flowOk) next.flowOk = true;
      if (cvd.state === 'warning') chips.push('CVD against');

      var basis = hgLiveBasisCaution(dir, live.basisPct);
      if (basis.state === 'warning') chips.push(basis.detail);

      var scored = hgLiveFormationScoreDelta(next, live);
      next.liveScoreDelta = scored.delta;
      next.liveParts = scored.parts;
      if (chips.length){
        next.evidenceChips = (next.evidenceChips || []).concat(chips);
      }
      out.plan = next;
      out.chips = chips;
      out.scoreDelta = scored.delta;
      return out;
    }catch(e){
      return { ok: true, plan: plan, chips: ['LIVE UNCHECKED'], scoreDelta: 0,
        reason: 'live apply threw: ' + ((e && e.message) || String(e)), unchecked: true, tag: 'live' };
    }
  }

  function hgLiveFormationFts(inp, dir){
    var items = [];
    try{
      var live = (inp && inp.live) || {};
      if (!live || typeof live !== 'object') return items;
      function push(r, pillar){
        if (!r || r.state === 'unchecked') return;
        items.push({
          pillar: pillar || 'sentiment',
          label: r.label || r.detail || 'live',
          detail: r.detail || '',
          align: r.align || (r.refuse ? 'veto' : (r.state === 'warning' ? 'caution' : 'neutral'))
        });
      }
      push(hgLiveOiDivergence(dir, live.pxChg, live.oiChg), 'sentiment');
      push(hgLiveFundingPredict(dir, live.fundingPct, live.predictedFundingPct), 'sentiment');
      var cvd = hgLiveCvdConfirms(dir, live.cvdSign, live.obi);
      if (cvd.state !== 'unchecked') push({ label: 'CVD / OBI', detail: cvd.detail, align: cvd.align, state: cvd.state }, 'technical');
      push(hgLiveBasisCaution(dir, live.basisPct), 'fundamental');
      var ev = hgLiveEventRisk(live.news);
      if (ev.state !== 'unchecked'){
        items.push({ pillar: 'fundamental', label: 'event risk', detail: ev.detail,
          align: ev.refuse ? 'veto' : (ev.state === 'warning' ? 'caution' : 'neutral') });
      }
      var st = hgLiveStablesVeto(live.stables);
      if (st.refuse){
        items.push({ pillar: 'fundamental', label: 'stables', detail: st.detail, align: 'veto' });
      }
    }catch(e){}
    return items;
  }

  /* ---- snapshot from existing desks --------------------------------- */

  function cacheGet(sym){
    var k = normSym(sym);
    var h = __liveCache[k];
    if (!h) return null;
    if ((Date.now() - h.at) > LIVE_TTL_MS) return null;
    return h;
  }
  function cachePut(sym, val){
    if (!val) return val;
    val.at = Date.now();
    __liveCache[normSym(sym)] = val;
    return val;
  }

  function hgLiveFormationSnap(sym, dir){
    try{
      var out = {
        sym: sym, dir: dir,
        pxChg: null, oiChg: null, fundingPct: null, predictedFundingPct: null,
        clusters: null, cvdSign: null, obi: null, basisPct: null, dvol: null,
        spotPerp: null, stables: null, news: null,
        impactBuy: null, impactSell: null, depthUsd: null, notionalUsd: null, spreadBps: null
      };
      var cached = cacheGet(sym);
      if (cached){
        Object.keys(out).forEach(function(k){
          if (cached[k] != null) out[k] = cached[k];
        });
      }
      var oi = gfn('oiflowState') ? G.oiflowState() : null;
      if (oi && Array.isArray(oi.results)){
        var row = null, i;
        for (i = 0; i < oi.results.length; i++){
          if (oi.results[i] && sameCoin(oi.results[i].sym, sym)){ row = oi.results[i]; break; }
        }
        if (row){
          if (isFinite(fin(row.pxChg))) out.pxChg = +row.pxChg;
          if (isFinite(fin(row.oiChg))) out.oiChg = +row.oiChg;
          if (isFinite(fin(row.fundingPct))) out.fundingPct = +row.fundingPct;
        }
      }
      var dv = gfn('deribitVolState') ? G.deribitVolState() : null;
      if (dv && isFinite(fin(dv.dvol))) out.dvol = +dv.dvol;
      var vp = gfn('venuePremiumState') ? G.venuePremiumState() : null;
      if (vp){
        var bps = fin(vp.premBps != null ? vp.premBps : vp.basisBps);
        if (isFinite(bps)) out.basisPct = bps / 100;
      }
      var news = gfn('hgNewsState') ? G.hgNewsState() : null;
      if (news) out.news = news;
      var liq = gfn('liqsState') ? G.liqsState() : null;
      if (liq && liq.snap && Array.isArray(liq.snap.top)){
        out.clusters = liq.snap.top.map(function(p){
          return { price: fin(p.price != null ? p.price : p.px), usd: fin(p.usd), side: p.side };
        }).filter(function(c){ return isFinite(c.price); });
      }
      if (G.S && G.S.fng) out.fng = G.S.fng;
      return out;
    }catch(e){
      return { unchecked: true, reason: (e && e.message) || 'snap failed' };
    }
  }

  async function hgLiveFormationGather(sym, opts){
    opts = opts || {};
    var live = hgLiveFormationSnap(sym, opts.dir);
    try{
      if (gfn('deribitVolSnapshot') && /BTC|ETH/i.test(String(sym || 'BTC'))){
        var cur = /ETH/i.test(String(sym)) ? 'ETH' : 'BTC';
        var dv = await G.deribitVolSnapshot(cur);
        if (dv && isFinite(+dv.dvol)) live.dvol = +dv.dvol;
      }
    }catch(e1){}
    try{
      if (opts.ticker && isFinite(+opts.ticker.fundingPct)) live.fundingPct = +opts.ticker.fundingPct;
    }catch(e2){}
    try{
      if (gfn('binanceFunding') && opts.fetch !== false){
        var twin = String(sym || '').replace(/^B-/, '').replace(/_/g, '');
        if (!/USDT$/i.test(twin) && /USD$/i.test(twin)) twin = twin.replace(/USD$/i, 'USDT');
        var f = await G.binanceFunding(twin);
        if (f){
          if (isFinite(+f.lastFundingRate)) live.fundingPct = +f.lastFundingRate * 100;
          else if (isFinite(+f.fundingPct)) live.fundingPct = +f.fundingPct;
          if (isFinite(+f.predictedFundingRate)) live.predictedFundingPct = +f.predictedFundingRate * 100;
        }
      }
    }catch(e3){}
    try{
      if (gfn('binanceOIHistory') && opts.fetch !== false){
        var twin2 = String(sym || '').replace(/^B-/, '').replace(/_/g, '');
        if (!/USDT$/i.test(twin2) && /USD$/i.test(twin2)) twin2 = twin2.replace(/USD$/i, 'USDT');
        var hist = await G.binanceOIHistory(twin2, '1h', 25);
        if (hist && Array.isArray(hist.series) && hist.series.length >= 2){
          var a = fin(hist.series[0].sumOpenInterest || hist.series[0].oi);
          var b = fin(hist.series[hist.series.length - 1].sumOpenInterest || hist.series[hist.series.length - 1].oi);
          if (a > 0 && isFinite(b)) live.oiChg = ((b - a) / a) * 100;
        }
      }
    }catch(e4){}
    return cachePut(sym, live);
  }

  async function hgLiveFormationWarm(){
    try{
      if (gfn('deribitVolSnapshot')){
        var s = await G.deribitVolSnapshot('BTC');
        return s ? ('dvol ' + (+s.dvol).toFixed(1)) : 'dvol dark';
      }
      return 'formation-live idle';
    }catch(e){ return 'formation-live dark'; }
  }

  /* ---- liqFlushSetup recovery --------------------------------------- */

  function hgLiveIsLiqSnap(x){
    return !!(x && typeof x === 'object' && !Array.isArray(x) && x.imbalance);
  }

  function hgLiveLiqFlushSetup(a, b, c){
    try{
      var flush = gfn('liqFlushSetup');
      if (!flush) return null;
      if (hgLiveIsLiqSnap(a)) return flush(a, b, c);
      var snap = null;
      if (G.__hgLiqRecoverSnap && hgLiveIsLiqSnap(G.__hgLiqRecoverSnap)) snap = G.__hgLiqRecoverSnap;
      if (!snap && gfn('liqRecoverSnap')) snap = G.liqRecoverSnap();
      if (!snap && gfn('liqsState')){
        var st = G.liqsState();
        if (st && hgLiveIsLiqSnap(st.snap)) snap = st.snap;
      }
      if (!snap) return null;
      var rows = Array.isArray(a) ? a : (Array.isArray(b) ? b : null);
      return flush(snap, rows, typeof c === 'object' ? c : undefined);
    }catch(e){ return null; }
  }

  G.hgLiveOiDivergence = hgLiveOiDivergence;
  G.hgLiveFundingPredict = hgLiveFundingPredict;
  G.hgLiveLiqStopAdjust = hgLiveLiqStopAdjust;
  G.hgLiveBookFillOk = hgLiveBookFillOk;
  G.hgLiveImpliedDailyPct = hgLiveImpliedDailyPct;
  G.hgLiveImpliedMoveOk = hgLiveImpliedMoveOk;
  G.hgLiveCvdConfirms = hgLiveCvdConfirms;
  G.hgLiveBasisCaution = hgLiveBasisCaution;
  G.hgLiveSpotPerpVeto = hgLiveSpotPerpVeto;
  G.hgLiveStablesVeto = hgLiveStablesVeto;
  G.hgLiveEventRisk = hgLiveEventRisk;
  G.hgLiveFormationScoreDelta = hgLiveFormationScoreDelta;
  G.hgLiveFormationApply = hgLiveFormationApply;
  G.hgLiveFormationFts = hgLiveFormationFts;
  G.hgLiveFormationSnap = hgLiveFormationSnap;
  G.hgLiveFormationGather = hgLiveFormationGather;
  G.hgLiveFormationWarm = hgLiveFormationWarm;
  G.hgLiveIsLiqSnap = hgLiveIsLiqSnap;
  G.hgLiveLiqFlushSetup = hgLiveLiqFlushSetup;

  G.HG_warmups = G.HG_warmups || [];
  G.HG_warmups.push({ id: 'formation-live', label: 'FORMATION LIVE', run: hgLiveFormationWarm });

})();
