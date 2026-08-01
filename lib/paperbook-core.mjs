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
  };
  pos.unrealizedUsd = pbUnrealized(pos);
  var positions = (book.positions || []).concat([pos]);
  var next = Object.assign({}, book, { positions: positions, at: Date.now() });
  return { ok: true, book: next, position: pos, check: chk };
}

export function pbUnrealizedR(p){
  if (!p || !isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.mark)) return null;
  var risk = Math.abs(p.entry - p.stop);
  if (!(risk > 0)) return null;
  var move = p.dir === 'short' ? (p.entry - p.mark) : (p.mark - p.entry);
  return move / risk;
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
    if (p.dir === 'long' && !(newStop <= p.entry)) return { ok: false, book: book, reason: 'long stop must be at or below entry' };
    if (p.dir === 'short' && !(newStop >= p.entry)) return { ok: false, book: book, reason: 'short stop must be at or above entry' };
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
