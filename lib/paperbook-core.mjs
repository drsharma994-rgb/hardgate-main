/* HARDGATE — paper fund book (pure core, never throws on exports). */

export const PB_DEFAULTS = {
  navUsd: 1_000_000,
  maxPositions: 12,
  maxSingleNamePct: 0.15,
  maxBucketPct: 0.35,
  maxPortfolioHeatPct: 0.06,
  defaultRiskPct: 0.01,
};

export function pbNewBook(cfg){
  cfg = Object.assign({}, PB_DEFAULTS, cfg || {});
  var now = Date.now();
  return {
    version: 1,
    navUsd: cfg.navUsd,
    cashUsd: cfg.navUsd,
    positions: [],
    closed: [],
    at: now,
    openedAt: now,
  };
}

export function pbBucket(sym, klass){
  if (klass) return String(klass).toLowerCase();
  var s = String(sym || '').toUpperCase();
  if (/^(BTC|ETH|SOL|ADA|XRP|DOG|BNB)/.test(s) || s.endsWith('USD') && s.length <= 8) return 'crypto';
  return 'other';
}

export function pbRiskUsd(entry, stop, notionalUsd, dir){
  entry = +entry; stop = +stop; notionalUsd = +notionalUsd;
  if (!(isFinite(entry) && isFinite(stop) && isFinite(notionalUsd) && entry > 0 && notionalUsd > 0)) return 0;
  var pct = Math.abs(entry - stop) / entry;
  return notionalUsd * pct;
}

export function pbNotionalForRisk(navUsd, entry, stop, riskPct){
  navUsd = +navUsd; entry = +entry; stop = +stop;
  riskPct = (riskPct > 0 && riskPct < 1) ? riskPct : PB_DEFAULTS.defaultRiskPct;
  var pct = Math.abs(entry - stop) / entry;
  if (!(isFinite(navUsd) && isFinite(entry) && isFinite(stop) && pct > 0)) return 0;
  return (navUsd * riskPct) / pct;
}

export function pbExposure(book){
  var pos = (book && book.positions) || [];
  var bySym = {};
  var byBucket = {};
  var heat = 0;
  var gross = 0;
  for (var i = 0; i < pos.length; i++){
    var p = pos[i];
    var n = +p.notionalUsd || 0;
    gross += n;
    heat += +p.riskUsd || 0;
    bySym[p.sym] = (bySym[p.sym] || 0) + n;
    var b = p.bucket || pbBucket(p.sym, p.klass);
    byBucket[b] = (byBucket[b] || 0) + n;
  }
  return { gross: gross, heat: heat, bySym: bySym, byBucket: byBucket, count: pos.length };
}

export function pbUnrealized(p){
  if (!p || !isFinite(p.entry) || !isFinite(p.mark) || !(p.notionalUsd > 0)) return 0;
  var ret = (p.mark - p.entry) / p.entry;
  if (p.dir === 'short') ret = -ret;
  return p.notionalUsd * ret;
}

export function pbMarkBook(book, marks){
  marks = marks || {};
  var positions = [];
  var totalUpl = 0;
  for (var i = 0; i < (book.positions || []).length; i++){
    var p = Object.assign({}, book.positions[i]);
    if (marks[p.sym] != null && isFinite(marks[p.sym])) p.mark = +marks[p.sym];
    p.unrealizedUsd = pbUnrealized(p);
    totalUpl += p.unrealizedUsd;
    positions.push(p);
  }
  var equity = (+book.cashUsd || 0) + totalUpl;
  return Object.assign({}, book, {
    positions: positions,
    equityUsd: equity,
    unrealizedUsd: totalUpl,
    at: Date.now(),
  });
}

export function pbRiskCheck(book, intent, cfg){
  cfg = Object.assign({}, PB_DEFAULTS, cfg || {});
  var reasons = [];
  var nav = (+book.navUsd > 0) ? +book.navUsd : cfg.navUsd;
  var exp = pbExposure(book);
  var notional = intent.notionalUsd;
  if (!(notional > 0)){
    notional = pbNotionalForRisk(nav, intent.entry, intent.stop, intent.riskPct || cfg.defaultRiskPct);
  }
  var maxSym = nav * cfg.maxSingleNamePct - (exp.bySym[intent.sym] || 0);
  var bucket = intent.bucket || pbBucket(intent.sym, intent.klass);
  var maxBuck = nav * cfg.maxBucketPct - (exp.byBucket[bucket] || 0);
  var heatRoom = nav * cfg.maxPortfolioHeatPct - exp.heat;
  var stopPct = Math.abs(intent.entry - intent.stop) / intent.entry;
  var maxHeatNotional = (stopPct > 0) ? (heatRoom / stopPct) : 0;
  notional = Math.min(notional, maxSym, maxBuck, maxHeatNotional);
  var riskUsd = pbRiskUsd(intent.entry, intent.stop, notional, intent.dir);
  if (!(notional > 0) || !(riskUsd > 0)){
    return { ok: false, veto: true, reasons: ['invalid plan geometry — cannot size paper position'], notionalUsd: 0, riskUsd: 0 };
  }
  if (exp.count >= cfg.maxPositions) reasons.push('max open positions (' + cfg.maxPositions + ')');
  var symExp = (exp.bySym[intent.sym] || 0) + notional;
  if (symExp / nav > cfg.maxSingleNamePct + 1e-9){
    reasons.push('single-name cap ' + Math.round(cfg.maxSingleNamePct * 100) + '% NAV');
  }
  var buckExp = (exp.byBucket[bucket] || 0) + notional;
  if (buckExp / nav > cfg.maxBucketPct + 1e-9){
    reasons.push('bucket cap ' + bucket + ' ' + Math.round(cfg.maxBucketPct * 100) + '% NAV');
  }
  if ((exp.heat + riskUsd) / nav > cfg.maxPortfolioHeatPct + 1e-9){
    reasons.push('portfolio heat cap ' + Math.round(cfg.maxPortfolioHeatPct * 100) + '% NAV');
  }
  if (intent.newsBlackout) reasons.push('NEWS BLACKOUT — no new risk');
  var veto = reasons.length > 0;
  return { ok: !veto, veto: veto, reasons: reasons, notionalUsd: notional, riskUsd: riskUsd, bucket: bucket };
}

export function pbAddIntent(book, intent, cfg){
  var chk = pbRiskCheck(book, intent, cfg);
  if (!chk.ok) return { ok: false, book: book, check: chk };
  var id = 'pb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  var mark = isFinite(intent.mark) ? +intent.mark : +intent.entry;
  var pos = {
    id: id,
    sym: String(intent.sym),
    dir: intent.dir === 'short' ? 'short' : 'long',
    venue: intent.venue || 'paper',
    klass: intent.klass || null,
    bucket: chk.bucket,
    entry: +intent.entry,
    stop: +intent.stop,
    t1: isFinite(intent.t1) ? +intent.t1 : null,
    t2: isFinite(intent.t2) ? +intent.t2 : null,
    notionalUsd: chk.notionalUsd,
    riskUsd: chk.riskUsd,
    mark: mark,
    unrealizedUsd: 0,
    strategy: intent.strategy || intent.source || 'manual',
    tier: intent.tier || null,
    layers: Array.isArray(intent.layers) ? intent.layers.slice(0, 12) : [],
    openedAt: Date.now(),
    status: 'open',
    origStop: +intent.stop,
  };
  pos.unrealizedUsd = pbUnrealized(pos);
  var positions = (book.positions || []).concat([pos]);
  var next = Object.assign({}, book, { positions: positions, at: Date.now() });
  return { ok: true, book: next, position: pos, check: chk };
}

export function pbUnitRisk(p){
  if (!p || !isFinite(p.entry)) return 0;
  var orig = isFinite(p.origStop) ? +p.origStop : +p.stop;
  return Math.abs(p.entry - orig);
}

export function pbUnrealizedR(p){
  if (!p || !isFinite(p.mark)) return null;
  var risk = pbUnitRisk(p);
  if (!(risk > 0)) return null;
  var move = p.dir === 'short' ? (p.entry - p.mark) : (p.mark - p.entry);
  return move / risk;
}

export function pbStopAtR(p, rLock){
  rLock = +rLock;
  if (!p || !isFinite(p.entry) || !isFinite(rLock)) return null;
  var unit = pbUnitRisk(p);
  if (!(unit > 0)) return null;
  if (p.dir === 'long') return p.entry + rLock * unit;
  return p.entry - rLock * unit;
}

export function pbStopBetter(p, newStop){
  newStop = +newStop;
  if (!p || !isFinite(newStop) || !isFinite(p.stop)) return false;
  if (p.dir === 'long') return newStop > p.stop + 1e-12;
  return newStop < p.stop - 1e-12;
}

export function pbBuildLiveOrder(p){
  if (!p || !(p.notionalUsd > 0) || !(p.mark > 0)) return null;
  var bracket = { stop: p.stop, takeProfit: p.t1 };
  if (isFinite(p.t2)) bracket.takeProfit2 = p.t2;
  return {
    symbol: p.sym,
    side: p.dir,
    qty: p.notionalUsd / p.mark,
    notionalUsd: p.notionalUsd,
    bracket: bracket,
    positionId: p.id,
    source: 'hardgate-book',
    at: Date.now(),
  };
}

export function pbPushBlotter(book, row){
  var blotter = (book.blotter || []).slice();
  blotter.unshift(Object.assign({ at: Date.now() }, row || {}));
  if (blotter.length > 120) blotter = blotter.slice(0, 120);
  return Object.assign({}, book, { blotter: blotter, at: Date.now() });
}

export function pbScalePosition(book, id, scalePct, mark){
  scalePct = +scalePct;
  if (!(scalePct > 0 && scalePct <= 1)) return { ok: false, book: book, reason: 'scale pct must be 0–1' };
  if (scalePct >= 0.999) return pbClosePosition(book, id, mark);
  var positions = [];
  var closed = (book.closed || []).slice();
  var hit = null;
  var closedLeg = null;
  var found = false;
  var cash = +book.cashUsd || 0;
  for (var i = 0; i < (book.positions || []).length; i++){
    var p = book.positions[i];
    if (p.id !== id){ positions.push(p); continue; }
    found = true;
    mark = isFinite(mark) ? +mark : p.mark;
    var closeFrac = scalePct;
    var remainFrac = 1 - closeFrac;
    var closedNotional = p.notionalUsd * closeFrac;
    var remainNotional = p.notionalUsd * remainFrac;
    var partial = Object.assign({}, p, { notionalUsd: closedNotional, mark: mark });
    var realized = pbUnrealized(partial);
    cash += realized;
    closedLeg = Object.assign({}, p, {
      notionalUsd: closedNotional,
      riskUsd: (p.riskUsd || 0) * closeFrac,
      mark: mark,
      closedAt: Date.now(),
      status: 'closed',
      realizedUsd: realized,
      closeReason: 'scale_' + Math.round(closeFrac * 100),
    });
    closedLeg.unrealizedUsd = realized;
    closed.unshift(closedLeg);
    if (remainNotional > 1){
      hit = Object.assign({}, p, {
        notionalUsd: remainNotional,
        riskUsd: (p.riskUsd || 0) * remainFrac,
        mark: mark,
        scaledAt: Date.now(),
        scaleNote: 'scaled ' + Math.round(closeFrac * 100) + '%',
      });
      hit.unrealizedUsd = pbUnrealized(hit);
      positions.push(hit);
    } else if (remainNotional > 0){
      cash += pbUnrealized(Object.assign({}, p, { notionalUsd: remainNotional, mark: mark }));
    }
  }
  if (!found) return { ok: false, book: book, reason: 'position not found' };
  return {
    ok: true,
    book: Object.assign({}, book, { positions: positions, closed: closed.slice(0, 200), cashUsd: cash, at: Date.now() }),
    position: hit || closedLeg,
  };
}

export function pbMoveStop(book, id, newStop){
  newStop = +newStop;
  if (!isFinite(newStop)) return { ok: false, book: book, reason: 'stop required' };
  var positions = [];
  var hit = null;
  for (var i = 0; i < (book.positions || []).length; i++){
    var p = book.positions[i];
    if (p.id !== id){ positions.push(p); continue; }
    if (p.dir === 'long'){
      if (!(newStop < p.mark)) return { ok: false, book: book, reason: 'long stop must be below mark' };
    } else {
      if (!(newStop > p.mark)) return { ok: false, book: book, reason: 'short stop must be above mark' };
    }
    if (!pbStopBetter(p, newStop)) return { ok: false, book: book, reason: 'stop only ratchets in favor' };
    hit = Object.assign({}, p, {
      stop: newStop,
      riskUsd: pbRiskUsd(p.entry, newStop, p.notionalUsd, p.dir),
      stopMovedAt: Date.now(),
    });
    hit.unrealizedUsd = pbUnrealized(hit);
    positions.push(hit);
  }
  if (!hit) return { ok: false, book: book, reason: 'position not found' };
  return { ok: true, book: Object.assign({}, book, { positions: positions, at: Date.now() }), position: hit };
}

export function pbClosePosition(book, id, mark){
  var positions = [];
  var closed = (book.closed || []).slice();
  var hit = null;
  for (var i = 0; i < (book.positions || []).length; i++){
    var p = book.positions[i];
    if (p.id === id){
      hit = Object.assign({}, p, { mark: isFinite(mark) ? +mark : p.mark, closedAt: Date.now(), status: 'closed' });
      hit.unrealizedUsd = pbUnrealized(hit);
      hit.realizedUsd = hit.unrealizedUsd;
      closed.unshift(hit);
    } else positions.push(p);
  }
  if (!hit) return { ok: false, book: book, reason: 'position not found' };
  var cash = (+book.cashUsd || 0) + hit.realizedUsd;
  return { ok: true, book: Object.assign({}, book, { positions: positions, closed: closed.slice(0, 200), cashUsd: cash, at: Date.now() }), position: hit };
}

export function pbEquity(book){
  var upl = 0;
  for (var i = 0; i < (book.positions || []).length; i++) upl += pbUnrealized(book.positions[i]);
  var nav = (+book.navUsd > 0) ? +book.navUsd : PB_DEFAULTS.navUsd;
  return (+book.cashUsd || nav) + upl;
}

export function pbRollDay(book){
  var dayKey = new Date().toISOString().slice(0, 10);
  if (book && book.dayKey === dayKey && isFinite(book.dayStartEquityUsd)) return book;
  var eq = pbEquity(book || {});
  return Object.assign({}, book || {}, {
    dayKey: dayKey,
    dayStartEquityUsd: eq,
    dayStartAt: Date.now(),
    at: Date.now(),
  });
}

export function pbPushNavHistory(book, summary){
  summary = summary || pbSummary(book);
  var hist = (book.navHistory || []).slice();
  var last = hist.length ? hist[hist.length - 1] : null;
  if (!last || Math.abs(last.at - summary.at) > 60000 || Math.abs(last.equityUsd - summary.equityUsd) > 0.01){
    hist.push({
      at: summary.at || Date.now(),
      equityUsd: summary.equityUsd,
      navUsd: summary.navUsd,
      heatPct: summary.heatPct,
      openCount: summary.openCount,
    });
    if (hist.length > 96) hist = hist.slice(-96);
  }
  return Object.assign({}, book, { navHistory: hist, at: Date.now() });
}

export function pbSummary(book){
  book = book || { positions: [], closed: [], navUsd: PB_DEFAULTS.navUsd, cashUsd: PB_DEFAULTS.navUsd };
  book = pbRollDay(book);
  var exp = pbExposure(book);
  var upl = 0;
  for (var i = 0; i < (book.positions || []).length; i++) upl += pbUnrealized(book.positions[i]);
  var realized = 0;
  for (var j = 0; j < (book.closed || []).length; j++) realized += (+book.closed[j].realizedUsd || 0);
  var nav = (+book.navUsd > 0) ? +book.navUsd : PB_DEFAULTS.navUsd;
  var equity = pbEquity(book);
  var dayStart = isFinite(book.dayStartEquityUsd) ? book.dayStartEquityUsd : equity;
  var dayPnl = equity - dayStart;
  var bucketExposure = [];
  Object.keys(exp.byBucket).forEach(function(k){
    bucketExposure.push({ key: k, usd: exp.byBucket[k], pct: nav > 0 ? exp.byBucket[k] / nav : 0 });
  });
  bucketExposure.sort(function(a, b){ return b.usd - a.usd; });
  return {
    navUsd: nav,
    equityUsd: equity,
    cashUsd: +book.cashUsd || 0,
    unrealizedUsd: upl,
    realizedUsd: realized,
    dayPnlUsd: dayPnl,
    dayStartEquityUsd: dayStart,
    dayKey: book.dayKey || null,
    heatUsd: exp.heat,
    heatPct: nav > 0 ? exp.heat / nav : 0,
    maxHeatPct: PB_DEFAULTS.maxPortfolioHeatPct,
    grossUsd: exp.gross,
    openCount: exp.count,
    closedCount: (book.closed || []).length,
    bucketExposure: bucketExposure,
    maxBucketPct: PB_DEFAULTS.maxBucketPct,
    at: book.at || Date.now(),
  };
}

function pbAttrAdd(map, key, realized, unrealized, count){
  key = (key != null && String(key).trim()) ? String(key) : 'unknown';
  if (!map[key]) map[key] = { key: key, realizedUsd: 0, unrealizedUsd: 0, count: 0, pnlUsd: 0 };
  map[key].realizedUsd += realized;
  map[key].unrealizedUsd += unrealized;
  map[key].count += count;
  map[key].pnlUsd = map[key].realizedUsd + map[key].unrealizedUsd;
}

function pbAttrRows(map){
  return Object.keys(map).map(function(k){ return map[k]; })
    .sort(function(a, b){ return b.pnlUsd - a.pnlUsd; });
}

export function pbAttribution(book){
  book = book || { positions: [], closed: [] };
  var byStrategy = {};
  var byBucket = {};
  var byTier = {};
  var i, p, c, upl, r;
  for (i = 0; i < (book.positions || []).length; i++){
    p = book.positions[i];
    upl = pbUnrealized(p);
    pbAttrAdd(byStrategy, p.strategy, 0, upl, 1);
    pbAttrAdd(byBucket, p.bucket || pbBucket(p.sym, p.klass), 0, upl, 1);
    pbAttrAdd(byTier, p.tier || '—', 0, upl, 1);
  }
  for (i = 0; i < (book.closed || []).length; i++){
    c = book.closed[i];
    r = +c.realizedUsd || 0;
    pbAttrAdd(byStrategy, c.strategy, r, 0, 1);
    pbAttrAdd(byBucket, c.bucket || pbBucket(c.sym, c.klass), r, 0, 1);
    pbAttrAdd(byTier, c.tier || '—', r, 0, 1);
  }
  return {
    byStrategy: pbAttrRows(byStrategy),
    byBucket: pbAttrRows(byBucket),
    byTier: pbAttrRows(byTier),
    at: Date.now(),
  };
}

export function pbCloseAll(book, marks){
  marks = marks || {};
  var positions = (book && book.positions) || [];
  if (!positions.length) return { ok: true, book: book, closed: [] };
  var closed = (book.closed || []).slice();
  var closedNow = [];
  var cash = +book.cashUsd || 0;
  for (var i = 0; i < positions.length; i++){
    var pos = positions[i];
    var mark = (marks[pos.sym] != null && isFinite(marks[pos.sym])) ? +marks[pos.sym] : pos.mark;
    var hit = Object.assign({}, pos, { mark: mark, closedAt: Date.now(), status: 'closed' });
    hit.unrealizedUsd = pbUnrealized(hit);
    hit.realizedUsd = hit.unrealizedUsd;
    cash += hit.realizedUsd;
    closed.unshift(hit);
    closedNow.push(hit);
  }
  return {
    ok: true,
    book: Object.assign({}, book, {
      positions: [],
      closed: closed.slice(0, 200),
      cashUsd: cash,
      at: Date.now(),
    }),
    closed: closedNow,
  };
}

export const PB_AUTO_DEFAULTS = {
  t1Scale: true,
  t1ScalePct: 0.5,
  trailBeAtR: 1,
  trailLockHalfRAt2R: true,
  trailLock1RAt3R: true,
  atrTrail: true,
  atrTrailMult: 2,
  atrTrailMinR: 0.5,
  stopOut: true,
};

export function pbAtrTrailStop(p, atr, mult){
  atr = +atr;
  mult = (mult > 0) ? +mult : 2;
  if (!p || !isFinite(atr) || !(atr > 0) || !isFinite(p.mark)) return null;
  if (p.dir === 'long') return p.mark - mult * atr;
  return p.mark + mult * atr;
}

function pbMarkHitT1(p){
  if (!p || !isFinite(p.t1) || !isFinite(p.mark)) return false;
  return p.dir === 'long' ? p.mark >= p.t1 : p.mark <= p.t1;
}

function pbStopHit(p){
  if (!p || !isFinite(p.stop) || !isFinite(p.mark)) return false;
  return p.dir === 'long' ? p.mark <= p.stop : p.mark >= p.stop;
}

function pbStopAtBe(p){
  if (!p || !isFinite(p.entry) || !isFinite(p.stop)) return false;
  return Math.abs(p.stop - p.entry) <= Math.max(1e-9, p.entry * 1e-8);
}

function pbTagPosition(book, id, patch){
  return Object.assign({}, book, {
    positions: (book.positions || []).map(function(x){
      return x.id === id ? Object.assign({}, x, patch) : x;
    }),
    at: Date.now(),
  });
}

export function pbApplyAutoRules(book, rules){
  rules = Object.assign({}, PB_AUTO_DEFAULTS, rules || {});
  var actions = [];
  var b = book || { positions: [], closed: [] };
  for (var iter = 0; iter < 10; iter++){
    var acted = false;
    var positions = (b.positions || []).slice();
    for (var i = 0; i < positions.length; i++){
      var p = positions[i];
      if (rules.stopOut && pbStopHit(p)){
        var cl = pbClosePosition(b, p.id, p.mark);
        if (cl.ok){
          b = cl.book;
          actions.push({ action: 'stop_out', sym: p.sym, dir: p.dir, mark: p.mark });
          acted = true;
          break;
        }
      }
    }
    if (acted) continue;
    for (var j = 0; j < positions.length; j++){
      var p2 = positions[j];
      if (rules.t1Scale && rules.t1ScalePct > 0 && isFinite(p2.t1) && !p2.t1Scaled && pbMarkHitT1(p2)){
        var sc = pbScalePosition(b, p2.id, rules.t1ScalePct, p2.mark);
        if (sc.ok){
          b = sc.book;
          if (sc.position && sc.position.id){
            b = pbTagPosition(b, sc.position.id, { t1Scaled: true, autoT1At: Date.now() });
          }
          actions.push({ action: 'scale_t1', sym: p2.sym, pct: rules.t1ScalePct, mark: p2.mark });
          acted = true;
          break;
        }
      }
    }
    if (acted) continue;
    for (var t = 0; t < positions.length; t++){
      var pT = positions[t];
      var rT = pbUnrealizedR(pT);
      if (rules.trailLock1RAt3R && rT != null && rT >= 3){
        var st3 = pbStopAtR(pT, 1);
        if (st3 != null && pbStopBetter(pT, st3)){
          var mv3 = pbMoveStop(b, pT.id, st3);
          if (mv3.ok){
            b = mv3.book;
            actions.push({ action: 'trail_lock_1r', sym: pT.sym, r: rT });
            acted = true;
            break;
          }
        }
      }
    }
    if (acted) continue;
    for (var u = 0; u < positions.length; u++){
      var pU = positions[u];
      var rU = pbUnrealizedR(pU);
      if (rules.trailLockHalfRAt2R && rU != null && rU >= 2){
        var st2 = pbStopAtR(pU, 0.5);
        if (st2 != null && pbStopBetter(pU, st2)){
          var mv2 = pbMoveStop(b, pU.id, st2);
          if (mv2.ok){
            b = mv2.book;
            actions.push({ action: 'trail_lock_half', sym: pU.sym, r: rU });
            acted = true;
            break;
          }
        }
      }
    }
    if (acted) continue;
    for (var a = 0; a < positions.length; a++){
      var pA = positions[a];
      var rA = pbUnrealizedR(pA);
      var atrMap = rules.atrMarks || {};
      var atrVal = atrMap[pA.sym];
      if (rules.atrTrail && isFinite(atrVal) && rA != null && rA >= (rules.atrTrailMinR || 0.5)){
        var stA = pbAtrTrailStop(pA, atrVal, rules.atrTrailMult);
        if (stA != null && pbStopBetter(pA, stA)){
          var mvA = pbMoveStop(b, pA.id, stA);
          if (mvA.ok){
            b = mvA.book;
            actions.push({ action: 'trail_atr', sym: pA.sym, r: rA, atr: atrVal, mult: rules.atrTrailMult });
            acted = true;
            break;
          }
        }
      }
    }
    if (acted) continue;
    for (var k = 0; k < positions.length; k++){
      var p3 = positions[k];
      var r = pbUnrealizedR(p3);
      if (rules.trailBeAtR > 0 && r != null && r >= rules.trailBeAtR && !pbStopAtBe(p3)){
        var mv = pbMoveStop(b, p3.id, p3.entry);
        if (mv.ok){
          b = mv.book;
          actions.push({ action: 'trail_be', sym: p3.sym, r: r });
          acted = true;
          break;
        }
      }
    }
    if (!acted) break;
  }
  return { ok: true, book: b, actions: actions };
}

export function pbLpReport(book, monthKey){
  book = book || { positions: [], closed: [], navUsd: PB_DEFAULTS.navUsd };
  monthKey = monthKey || new Date().toISOString().slice(0, 7);
  var nav = (+book.navUsd > 0) ? +book.navUsd : PB_DEFAULTS.navUsd;
  var equity = pbEquity(book);
  var closed = (book.closed || []).filter(function(c){
    return c && c.closedAt && new Date(c.closedAt).toISOString().slice(0, 7) === monthKey;
  });
  var mtdRealized = 0;
  var wins = 0;
  for (var i = 0; i < closed.length; i++){
    var r = +closed[i].realizedUsd || 0;
    mtdRealized += r;
    if (r > 0) wins++;
  }
  var monthStart = nav;
  var hist = book.navHistory || [];
  for (var h = 0; h < hist.length; h++){
    if (hist[h] && new Date(hist[h].at).toISOString().slice(0, 7) === monthKey){
      monthStart = hist[h].equityUsd;
      break;
    }
  }
  if (book.monthEquity && book.monthEquity[monthKey] != null){
    monthStart = book.monthEquity[monthKey];
  }
  var mtdReturnPct = monthStart > 0 ? ((equity - monthStart) / monthStart) * 100 : 0;
  return {
    month: monthKey,
    navUsd: nav,
    equityUsd: equity,
    monthStartEquityUsd: monthStart,
    mtdReturnPct: mtdReturnPct,
    mtdRealizedUsd: mtdRealized,
    tradesClosed: closed.length,
    winRate: closed.length ? (wins / closed.length) : 0,
    openCount: (book.positions || []).length,
    attribution: pbAttribution(book),
    byStrategy: pbAttribution(book).byStrategy,
    at: Date.now(),
  };
}

function pbDigestClosedInRange(book, startMs){
  return (book.closed || []).filter(function(c){
    return c && c.closedAt && c.closedAt >= startMs;
  });
}

function pbDigestStrategyRows(closed){
  var by = {};
  var i, c, r, row;
  for (i = 0; i < closed.length; i++){
    c = closed[i];
    r = +c.realizedUsd || 0;
    var key = c.strategy || '—';
    if (!by[key]) by[key] = { key: key, count: 0, pnlUsd: 0 };
    by[key].count++;
    by[key].pnlUsd += r;
  }
  return Object.keys(by).map(function(k){ return by[k]; }).sort(function(a, b){ return b.pnlUsd - a.pnlUsd; });
}

function pbEquityAtOrBefore(book, atMs){
  var hist = book.navHistory || [];
  var best = null;
  for (var i = 0; i < hist.length; i++){
    if (hist[i] && hist[i].at <= atMs){
      if (!best || hist[i].at > best.at) best = hist[i];
    }
  }
  if (best && isFinite(best.equityUsd)) return best.equityUsd;
  var nav = (+book.navUsd > 0) ? +book.navUsd : PB_DEFAULTS.navUsd;
  return nav;
}

export function pbWeeklyDigest(book, period){
  book = book || { positions: [], closed: [], navUsd: PB_DEFAULTS.navUsd };
  period = period === 'month' ? 'month' : 'week';
  if (period === 'month'){
    var monthKey = new Date().toISOString().slice(0, 7);
    var lp = pbLpReport(book, monthKey);
    return Object.assign({}, lp, {
      period: 'month',
      periodKey: monthKey,
      label: 'Month ' + monthKey,
    });
  }
  var now = Date.now();
  var startMs = now - 7 * 86400000;
  var nav = (+book.navUsd > 0) ? +book.navUsd : PB_DEFAULTS.navUsd;
  var equity = pbEquity(book);
  var periodStart = pbEquityAtOrBefore(book, startMs);
  var closed = pbDigestClosedInRange(book, startMs);
  var realized = 0;
  var wins = 0;
  for (var i = 0; i < closed.length; i++){
    var r = +closed[i].realizedUsd || 0;
    realized += r;
    if (r > 0) wins++;
  }
  var returnPct = periodStart > 0 ? ((equity - periodStart) / periodStart) * 100 : 0;
  return {
    period: 'week',
    periodKey: new Date(now).toISOString().slice(0, 10) + '_7d',
    label: 'Rolling 7 days',
    startMs: startMs,
    endMs: now,
    navUsd: nav,
    equityUsd: equity,
    periodStartEquityUsd: periodStart,
    periodReturnPct: returnPct,
    periodRealizedUsd: realized,
    tradesClosed: closed.length,
    winRate: closed.length ? (wins / closed.length) : 0,
    openCount: (book.positions || []).length,
    byStrategy: pbDigestStrategyRows(closed),
    at: now,
  };
}

export function pbDigestText(d){
  d = d || {};
  var lines = [
    'HARDGATE Paper Fund — ' + (d.label || d.period || 'digest'),
    'Equity: $' + Math.round(d.equityUsd || 0).toLocaleString('en-US'),
    'Return: ' + (isFinite(d.periodReturnPct) ? d.periodReturnPct : d.mtdReturnPct || 0).toFixed(2) + '%',
    'Realized: $' + Math.round(d.periodRealizedUsd != null ? d.periodRealizedUsd : d.mtdRealizedUsd || 0).toLocaleString('en-US'),
    'Trades closed: ' + (d.tradesClosed || 0) + ' · Win rate: ' + ((d.winRate || 0) * 100).toFixed(1) + '%',
    'Open positions: ' + (d.openCount || 0),
  ];
  if (d.byStrategy && d.byStrategy.length){
    lines.push('By strategy:');
    for (var i = 0; i < d.byStrategy.length; i++){
      var s = d.byStrategy[i];
      lines.push('  ' + s.key + ': ' + s.count + ' trades · $' + Math.round(s.pnlUsd).toLocaleString('en-US'));
    }
  }
  lines.push('Generated ' + new Date(d.at || Date.now()).toISOString());
  return lines.join('\n');
}

export function pbDigestHtml(d){
  d = d || {};
  var ret = isFinite(d.periodReturnPct) ? d.periodReturnPct : d.mtdReturnPct;
  var real = d.periodRealizedUsd != null ? d.periodRealizedUsd : d.mtdRealizedUsd;
  var title = 'HARDGATE LP Digest — ' + (d.label || d.period || '');
  var stratRows = (d.byStrategy || []).map(function(s){
    return '<tr><td>' + String(s.key).replace(/[&<>"]/g, '') + '</td><td>' + s.count + '</td><td>$' + Math.round(s.pnlUsd).toLocaleString('en-US') + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title>'
    + '<style>body{font-family:system-ui;background:#0b0f14;color:#e8eaed;padding:24px}'
    + 'h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}'
    + 'td,th{border:1px solid #2a2f3a;padding:8px;text-align:left;font-size:13px}</style></head><body>'
    + '<h1>' + title + '</h1>'
    + '<p>Generated ' + new Date(d.at || Date.now()).toISOString() + '</p>'
    + '<table><tr><th>NAV</th><td>$' + Math.round(d.navUsd || 0).toLocaleString('en-US') + '</td></tr>'
    + '<tr><th>Equity</th><td>$' + Math.round(d.equityUsd || 0).toLocaleString('en-US') + '</td></tr>'
    + '<tr><th>Return</th><td>' + (isFinite(ret) ? ret.toFixed(2) : '—') + '%</td></tr>'
    + '<tr><th>Realized</th><td>$' + Math.round(real || 0).toLocaleString('en-US') + '</td></tr>'
    + '<tr><th>Trades closed</th><td>' + (d.tradesClosed || 0) + '</td></tr>'
    + '<tr><th>Win rate</th><td>' + ((d.winRate || 0) * 100).toFixed(1) + '%</td></tr>'
    + '<tr><th>Open</th><td>' + (d.openCount || 0) + '</td></tr></table>'
    + (stratRows ? '<h2 style="margin-top:20px;font-size:16px">P&amp;L by strategy</h2><table><tr><th>Strategy</th><th>Trades</th><th>P&amp;L</th></tr>' + stratRows + '</table>' : '')
    + '<p style="margin-top:24px;font-size:11px;color:#888">Paper fund simulation — not audited.</p>'
    + '</body></html>';
}

export const LP_DIGEST_DOW_UTC = 0;
export const LP_DIGEST_HOUR_UTC = 15;
export const LP_DIGEST_MIN_UTC = 37;
export const LP_DIGEST_WINDOW_MIN = 45;
export const LP_DIGEST_MIN_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

export function lpDigestDue(lastAt, now){
  now = (now == null) ? Date.now() : +now;
  var d = new Date(now);
  if (d.getUTCDay() !== LP_DIGEST_DOW_UTC) return false;
  var mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  var start = LP_DIGEST_HOUR_UTC * 60 + LP_DIGEST_MIN_UTC;
  if (!(mins >= start && mins <= start + LP_DIGEST_WINDOW_MIN)) return false;
  var t = Date.parse(lastAt || '');
  return !Number.isFinite(t) || (now - t) > LP_DIGEST_MIN_INTERVAL_MS;
}
