/* HARDGATE — multi-fund paper book store (pure, zero deps). */
import { pbNewBook, pbSummary, PB_DEFAULTS, pbLpReport, pbWeeklyDigest, pbAttribution, pbDigestExecuteSummary, pbMonthStartMs } from './paperbook-core.mjs';

export const PB_STORE_VERSION = 2;
export const PB_DEFAULT_FUND = 'main';

export const PB_FUND_PRESETS = {
  main: { label: 'Master fund', navUsd: PB_DEFAULTS.navUsd },
  gold: { label: 'Gold sleeve', navUsd: 500_000 },
  swing: { label: 'Swing desk', navUsd: 500_000 },
  macro: { label: 'Macro book', navUsd: 250_000 },
};

export function pbSanitizeFundId(id){
  id = String(id || '').trim().toLowerCase();
  id = id.replace(/[^a-z0-9_-]/g, '');
  if (!id || id.length > 32) return '';
  return id;
}

export function pbNormalizeStore(raw){
  if (!raw || typeof raw !== 'object'){
    return pbNewStore();
  }
  if (raw.version === PB_STORE_VERSION && raw.funds && typeof raw.funds === 'object'){
    var active = pbSanitizeFundId(raw.activeFund) || PB_DEFAULT_FUND;
    if (!raw.funds[active]) active = Object.keys(raw.funds)[0] || PB_DEFAULT_FUND;
    return {
      version: PB_STORE_VERSION,
      activeFund: active,
      funds: raw.funds,
      at: raw.at || Date.now(),
    };
  }
  if (raw.version === 1 && Array.isArray(raw.positions)){
    return {
      version: PB_STORE_VERSION,
      activeFund: PB_DEFAULT_FUND,
      funds: { main: raw },
      at: Date.now(),
    };
  }
  return pbNewStore();
}

export function pbNewStore(activeFund){
  activeFund = pbSanitizeFundId(activeFund) || PB_DEFAULT_FUND;
  var book = pbNewBook(PB_FUND_PRESETS[activeFund] || {});
  return {
    version: PB_STORE_VERSION,
    activeFund: activeFund,
    funds: (function(){
      var o = {};
      o[activeFund] = book;
      return o;
    })(),
    at: Date.now(),
  };
}

export function pbResolveFundId(store, fundId){
  store = pbNormalizeStore(store);
  fundId = pbSanitizeFundId(fundId) || store.activeFund || PB_DEFAULT_FUND;
  if (!store.funds[fundId]){
    var preset = PB_FUND_PRESETS[fundId];
    store.funds[fundId] = pbNewBook(preset || {});
    store.at = Date.now();
  }
  return fundId;
}

export function pbGetBook(store, fundId){
  store = pbNormalizeStore(store);
  fundId = pbResolveFundId(store, fundId);
  var book = store.funds[fundId];
  if (!book.fundId) book = Object.assign({}, book, { fundId: fundId });
  return { store: store, fundId: fundId, book: book };
}

export function pbSetBook(store, fundId, book){
  store = pbNormalizeStore(store);
  fundId = pbResolveFundId(store, fundId);
  store.funds[fundId] = Object.assign({}, book, { fundId: fundId });
  store.activeFund = fundId;
  store.at = Date.now();
  return store;
}

export function pbListFunds(store){
  store = pbNormalizeStore(store);
  var ids = Object.keys(store.funds || {}).sort();
  return ids.map(function(id){
    var book = store.funds[id];
    var preset = PB_FUND_PRESETS[id] || {};
    var summary = pbSummary(book);
    return {
      id: id,
      label: book.label || preset.label || id,
      navUsd: summary.navUsd,
      equityUsd: summary.equityUsd,
      openCount: summary.openCount,
      active: id === store.activeFund,
    };
  });
}

export function pbCreateFund(store, spec){
  store = pbNormalizeStore(store);
  var id = pbSanitizeFundId(spec && spec.id);
  if (!id) return { ok: false, reason: 'invalid fund id (a-z 0-9 _ -, max 32)' };
  if (store.funds[id]) return { ok: false, reason: 'fund already exists: ' + id };
  var preset = PB_FUND_PRESETS[id] || {};
  var navUsd = (spec && isFinite(+spec.navUsd) && +spec.navUsd > 0) ? +spec.navUsd : (preset.navUsd || PB_DEFAULTS.navUsd);
  var book = pbNewBook({ navUsd: navUsd });
  book.label = (spec && spec.label) ? String(spec.label).slice(0, 48) : (preset.label || id);
  book.fundId = id;
  store.funds[id] = book;
  store.at = Date.now();
  return { ok: true, store: store, fundId: id, book: book };
}

export function pbResetFund(store, fundId){
  store = pbNormalizeStore(store);
  fundId = pbResolveFundId(store, fundId);
  var preset = PB_FUND_PRESETS[fundId] || {};
  var prev = store.funds[fundId] || {};
  var navUsd = (+prev.navUsd > 0) ? +prev.navUsd : (preset.navUsd || PB_DEFAULTS.navUsd);
  var fresh = pbNewBook({ navUsd: navUsd });
  fresh.label = prev.label || preset.label || fundId;
  fresh.fundId = fundId;
  store.funds[fundId] = fresh;
  store.at = Date.now();
  return { ok: true, store: store, fundId: fundId, book: fresh };
}

export function pbActiveFundBook(store){
  var got = pbGetBook(store, store.activeFund);
  return got.book;
}

function attrMergeRows(map, rows){
  rows = rows || [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    var key = r.key;
    if (!map[key]) map[key] = { key: key, realizedUsd: 0, unrealizedUsd: 0, count: 0, pnlUsd: 0 };
    map[key].realizedUsd += r.realizedUsd || 0;
    map[key].unrealizedUsd += r.unrealizedUsd || 0;
    map[key].count += r.count || 0;
    map[key].pnlUsd = map[key].realizedUsd + map[key].unrealizedUsd;
  }
}

function attrMapToRows(map){
  return Object.keys(map).map(function(k){ return map[k]; })
    .sort(function(a, b){ return b.pnlUsd - a.pnlUsd; });
}

export function pbConsolidatedAttribution(store){
  store = pbNormalizeStore(store);
  var ids = Object.keys(store.funds || {}).sort();
  var byStrategy = {};
  var byBucket = {};
  var byTier = {};
  var byFund = [];
  var strategyMatrix = {};
  var fundLabels = {};

  for (var i = 0; i < ids.length; i++){
    var id = ids[i];
    var book = store.funds[id];
    var preset = PB_FUND_PRESETS[id] || {};
    var label = book.label || preset.label || id;
    fundLabels[id] = label;
    var attr = pbAttribution(book);
    var summary = pbSummary(book);
    attrMergeRows(byStrategy, attr.byStrategy);
    attrMergeRows(byBucket, attr.byBucket);
    attrMergeRows(byTier, attr.byTier);

    var fundReal = 0;
    var fundUnreal = 0;
    var fundCount = 0;
    for (var s = 0; s < attr.byStrategy.length; s++){
      var row = attr.byStrategy[s];
      fundReal += row.realizedUsd || 0;
      fundUnreal += row.unrealizedUsd || 0;
      fundCount += row.count || 0;
      if (!strategyMatrix[row.key]) strategyMatrix[row.key] = { key: row.key, total: 0, cells: {} };
      strategyMatrix[row.key].cells[id] = row.pnlUsd || 0;
      strategyMatrix[row.key].total += row.pnlUsd || 0;
    }
    byFund.push({
      id: id,
      label: label,
      equityUsd: summary.equityUsd,
      realizedUsd: fundReal,
      unrealizedUsd: fundUnreal,
      pnlUsd: fundReal + fundUnreal,
      count: fundCount,
      openCount: summary.openCount || 0,
    });
  }

  return {
    fundCount: ids.length,
    fundIds: ids,
    fundLabels: fundLabels,
    byFund: byFund.sort(function(a, b){ return b.pnlUsd - a.pnlUsd; }),
    byStrategy: attrMapToRows(byStrategy),
    byBucket: attrMapToRows(byBucket),
    byTier: attrMapToRows(byTier),
    strategyByFund: Object.keys(strategyMatrix).map(function(k){ return strategyMatrix[k]; })
      .sort(function(a, b){ return b.total - a.total; }),
    at: Date.now(),
  };
}

export function pbConsolidatedDesk(store){
  store = pbNormalizeStore(store);
  var ids = Object.keys(store.funds || {}).sort();
  var funds = pbListFunds(store);
  var totalEquity = 0;
  var totalNav = 0;
  var totalHeat = 0;
  var totalOpen = 0;
  var totalGross = 0;
  var totalDayPnl = 0;
  var totalDayStart = 0;
  var byFund = [];
  var execOk = 0;
  var execFail = 0;
  var execPending = 0;
  var startMs = Date.now() - 7 * 86400000;
  for (var i = 0; i < ids.length; i++){
    var id = ids[i];
    var book = store.funds[id];
    var s = pbSummary(book);
    var ex = pbDigestExecuteSummary(book, startMs);
    execOk += ex.ok || 0;
    execFail += ex.fail || 0;
    execPending += ex.pending || 0;
    totalEquity += s.equityUsd || 0;
    totalNav += s.navUsd || 0;
    totalHeat += s.heatUsd || 0;
    totalOpen += s.openCount || 0;
    totalGross += s.grossUsd || 0;
    totalDayPnl += s.dayPnlUsd || 0;
    totalDayStart += s.dayStartEquityUsd || s.equityUsd || 0;
    byFund.push({
      id: id,
      label: (book.label || (PB_FUND_PRESETS[id] || {}).label || id),
      equityUsd: s.equityUsd,
      navUsd: s.navUsd,
      heatUsd: s.heatUsd,
      heatPct: s.heatPct,
      openCount: s.openCount,
      dayPnlUsd: s.dayPnlUsd,
    });
  }
  var lossPct = PB_DEFAULTS.maxDailyLossPct;
  var deskLossLimit = totalDayStart * lossPct;
  var dailyLossHalt = lossPct > 0 && totalDayPnl <= -deskLossLimit;
  return {
    fundCount: ids.length,
    activeFund: store.activeFund,
    equityUsd: totalEquity,
    navUsd: totalNav,
    heatUsd: totalHeat,
    heatPct: totalNav > 0 ? totalHeat / totalNav : 0,
    openCount: totalOpen,
    grossUsd: totalGross,
    dayPnlUsd: totalDayPnl,
    dayStartEquityUsd: totalDayStart,
    dailyLossHalt: dailyLossHalt,
    dailyLossLimitUsd: deskLossLimit,
    maxDailyLossPct: lossPct,
    funds: byFund,
    execute: { ok: execOk, fail: execFail, pending: execPending, total: execOk + execFail, period: '7d' },
    at: Date.now(),
  };
}

export function pbConsolidatedLp(store, period, monthKey){
  store = pbNormalizeStore(store);
  period = period === 'month' ? 'month' : 'week';
  monthKey = monthKey || new Date().toISOString().slice(0, 7);
  var ids = Object.keys(store.funds || {}).sort();
  var byFund = [];
  var totalNav = 0;
  var totalEquity = 0;
  var totalStart = 0;
  var totalRealized = 0;
  var totalOpen = 0;
  var tradesClosed = 0;
  var winSum = 0;
  var execOk = 0;
  var execFail = 0;
  var execPending = 0;
  var startMs = period === 'month' ? pbMonthStartMs() : (Date.now() - 7 * 86400000);
  for (var i = 0; i < ids.length; i++){
    var id = ids[i];
    var book = store.funds[id];
    var preset = PB_FUND_PRESETS[id] || {};
    var label = book.label || preset.label || id;
    var rep = period === 'month' ? pbLpReport(book, monthKey) : pbWeeklyDigest(book, 'week');
    var startEq = period === 'month' ? rep.monthStartEquityUsd : rep.periodStartEquityUsd;
    var real = period === 'month' ? rep.mtdRealizedUsd : rep.periodRealizedUsd;
    var ret = period === 'month' ? rep.mtdReturnPct : rep.periodReturnPct;
    totalNav += rep.navUsd || 0;
    totalEquity += rep.equityUsd || 0;
    totalStart += startEq || 0;
    totalRealized += real || 0;
    totalOpen += rep.openCount || 0;
    tradesClosed += rep.tradesClosed || 0;
    winSum += Math.round((rep.winRate || 0) * (rep.tradesClosed || 0));
    var ex = rep.execute || pbDigestExecuteSummary(book, startMs);
    execOk += ex.ok || 0;
    execFail += ex.fail || 0;
    execPending += ex.pending || 0;
    byFund.push({
      id: id,
      label: label,
      navUsd: rep.navUsd,
      equityUsd: rep.equityUsd,
      startEquityUsd: startEq,
      returnPct: ret,
      realizedUsd: real,
      openCount: rep.openCount,
      tradesClosed: rep.tradesClosed,
      winRate: rep.winRate,
    });
  }
  var returnPct = totalStart > 0 ? ((totalEquity - totalStart) / totalStart) * 100 : 0;
  return {
    period: period,
    month: monthKey,
    label: period === 'month' ? ('Month ' + monthKey + ' · all funds') : 'Rolling 7 days · all funds',
    fundCount: ids.length,
    navUsd: totalNav,
    equityUsd: totalEquity,
    startEquityUsd: totalStart,
    returnPct: returnPct,
    realizedUsd: totalRealized,
    tradesClosed: tradesClosed,
    winRate: tradesClosed ? (winSum / tradesClosed) : 0,
    openCount: totalOpen,
    byFund: byFund,
    execute: { ok: execOk, fail: execFail, pending: execPending, total: execOk + execFail },
    at: Date.now(),
  };
}

export function pbConsolidatedDigestText(c){
  c = c || {};
  var lines = [
    'HARDGATE Consolidated LP — ' + (c.label || 'all funds'),
    'Funds: ' + (c.fundCount || 0),
    'Total equity: $' + Math.round(c.equityUsd || 0).toLocaleString('en-US'),
    'Return: ' + (isFinite(c.returnPct) ? c.returnPct.toFixed(2) : '—') + '%',
    'Realized: $' + Math.round(c.realizedUsd || 0).toLocaleString('en-US'),
    'Trades closed: ' + (c.tradesClosed || 0) + ' · Win rate: ' + ((c.winRate || 0) * 100).toFixed(1) + '%',
    'Open positions: ' + (c.openCount || 0),
  ];
  if (c.execute && (c.execute.ok || c.execute.fail || c.execute.pending)){
    lines.push('Brackets: ' + c.execute.ok + ' OK · ' + c.execute.fail + ' fail · '
      + c.execute.pending + ' open without bracket');
  }
  var funds = c.byFund || [];
  if (funds.length){
    lines.push('By fund:');
    for (var i = 0; i < funds.length; i++){
      var f = funds[i];
      lines.push('  ' + (f.label || f.id) + ' (' + f.id + '): $'
        + Math.round(f.equityUsd || 0).toLocaleString('en-US') + ' · '
        + (isFinite(f.returnPct) ? f.returnPct.toFixed(2) : '—') + '% · '
        + (f.openCount || 0) + ' open');
    }
  }
  lines.push('Generated ' + new Date(c.at || Date.now()).toISOString());
  return lines.join('\n');
}

export function pbConsolidatedHtml(c){
  c = c || {};
  var rows = (c.byFund || []).map(function(f){
    return '<tr><td>' + String(f.label).replace(/[&<>"]/g, '') + ' (' + f.id + ')</td>'
      + '<td>$' + Math.round(f.equityUsd || 0).toLocaleString('en-US') + '</td>'
      + '<td>' + (isFinite(f.returnPct) ? f.returnPct.toFixed(2) : '—') + '%</td>'
      + '<td>$' + Math.round(f.realizedUsd || 0).toLocaleString('en-US') + '</td>'
      + '<td>' + (f.openCount || 0) + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HARDGATE Consolidated LP</title>'
    + '<style>body{font-family:system-ui;background:#0b0f14;color:#e8eaed;padding:24px}'
    + 'h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}'
    + 'td,th{border:1px solid #2a2f3a;padding:8px;text-align:left;font-size:13px}</style></head><body>'
    + '<h1>HARDGATE Consolidated LP Report</h1>'
    + '<p>' + (c.label || '') + ' · ' + (c.fundCount || 0) + ' funds</p>'
    + '<table><tr><th>Total equity</th><td>$' + Math.round(c.equityUsd || 0).toLocaleString('en-US') + '</td></tr>'
    + '<tr><th>Return</th><td>' + (isFinite(c.returnPct) ? c.returnPct.toFixed(2) : '—') + '%</td></tr>'
    + '<tr><th>Realized</th><td>$' + Math.round(c.realizedUsd || 0).toLocaleString('en-US') + '</td></tr>'
    + '<tr><th>Open</th><td>' + (c.openCount || 0) + '</td></tr>'
    + (c.execute && (c.execute.ok || c.execute.fail || c.execute.pending)
      ? '<tr><th>Brackets</th><td>' + c.execute.ok + ' OK · ' + c.execute.fail + ' fail · '
        + c.execute.pending + ' open w/o bracket</td></tr>' : '')
    + '</table>'
    + (rows ? '<h2>By fund</h2><table><tr><th>Fund</th><th>Equity</th><th>Return</th><th>Realized</th><th>Open</th></tr>' + rows + '</table>' : '')
    + '</body></html>';
}
