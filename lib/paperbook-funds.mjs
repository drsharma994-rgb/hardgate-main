/* HARDGATE — multi-fund paper book store (pure, zero deps). */
import { pbNewBook, pbSummary, PB_DEFAULTS } from './paperbook-core.mjs';

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
