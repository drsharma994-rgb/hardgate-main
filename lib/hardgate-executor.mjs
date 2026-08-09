/* HARDGATE — CCXT live execution engine (Node 18+, optional ccxt package).
   HardgateExecutor: limit entry + bracket SL/TP on Bybit / Binance / Delta. */
import { hgCcxtExchangeOptions } from './ccxt-config.mjs';
import { hgTwapExecute } from './twap-executor.mjs';

export function hgCalculateOrderSize(accountBalanceUSD, entryPrice, stopLossPrice, riskPercent, precision){
  try{
    var bal = +accountBalanceUSD, riskPct = +riskPercent;
    var entry = +entryPrice, stop = +stopLossPrice;
    if (!isFinite(bal) || !(bal > 0) || !isFinite(riskPct) || !(riskPct > 0)
        || !isFinite(entry) || !(entry > 0) || !isFinite(stop)){
      return { error: 'Invalid inputs' };
    }
    var riskAmountUSD = bal * (riskPct / 100);
    var priceRiskPerUnit = Math.abs(entry - stop);
    if (!(priceRiskPerUnit > 0)) return { error: 'Entry and Stop Loss cannot be the same.' };
    var raw = riskAmountUSD / priceRiskPerUnit;
    var dp = (isFinite(precision) && precision >= 0) ? Math.floor(precision) : 3;
    var factor = Math.pow(10, dp);
    return {
      riskAmountUSD: riskAmountUSD,
      stopDistanceUSD: priceRiskPerUnit,
      positionSizeUnits: Math.round(raw * factor) / factor,
    };
  }catch(e){ return { error: (e && e.message) || 'Invalid inputs' }; }
}

export function hgNormalizeCcxtSymbol(sym, markets){
  try{
    if (!sym) return sym;
    var s = String(sym).trim();
    if (markets && markets[s]) return s;
    var delta = /^B-([A-Z0-9]+)_USDT$/i.exec(s);
    if (delta){
      var lin = delta[1] + '/USDT:USDT';
      if (markets && markets[lin]) return lin;
      var spot = delta[1] + '/USDT';
      if (markets && markets[spot]) return spot;
      return lin;
    }
    if (/USDT$/i.test(s) && s.indexOf('/') < 0){
      var base = s.replace(/USDT$/i, '');
      lin = base + '/USDT:USDT';
      if (markets && markets[lin]) return lin;
      spot = base + '/USDT';
      if (markets && markets[spot]) return spot;
      return lin;
    }
    if (/USD$/i.test(s) && s.indexOf('/') < 0 && !/USDT$/i.test(s)){
      base = s.replace(/USD$/i, '');
      lin = base + '/USD:USD';
      if (markets && markets[lin]) return lin;
      return base + '/USD';
    }
    return s;
  }catch(e){ return sym; }
}

function hgSideToCcxt(side){
  var d = String(side || '').toLowerCase();
  if (d === 'long' || d === 'buy') return 'buy';
  if (d === 'short' || d === 'sell') return 'sell';
  return d;
}

function hgAmountPrecision(market){
  try{
    if (!market || !market.precision) return 3;
    if (typeof market.precision.amount === 'number') return market.precision.amount;
    if (market.limits && market.limits.amount && isFinite(market.limits.amount.min)){
      var min = +market.limits.amount.min;
      if (min >= 1) return 0;
      var s = String(min);
      var dot = s.indexOf('.');
      return dot >= 0 ? s.length - dot - 1 : 3;
    }
  }catch(e){}
  return 3;
}

export class HardgateExecutor {
  constructor(exchangeId, apiKey, secret, options){
    this.exchangeId = String(exchangeId || '').toLowerCase();
    this.apiKey = apiKey || '';
    this.secret = secret || '';
    this.options = options || {};
    this.exchange = null;
    this.ccxt = null;
  }

  async init(){
    if (this.exchange) return this.exchange;
    var mod = await import('ccxt');
    this.ccxt = mod.default || mod;
    var Ex = this.ccxt[this.exchangeId];
    if (!Ex) throw new Error('Unsupported CCXT exchange: ' + this.exchangeId);
    var cfg = {
      apiKey: this.apiKey,
      secret: this.secret,
      enableRateLimit: true,
      options: hgCcxtExchangeOptions(this.exchangeId, this.options.exchangeOptions || {}),
    };
    if (this.options.password) cfg.password = this.options.password;
    if (this.options.sandbox) cfg.sandbox = true;
    this.exchange = new Ex(cfg);
    await this.exchange.loadMarkets();
    return this.exchange;
  }

  async calculateOrderSize(symbol, entryPrice, stopLossPrice, riskPercent){
    var ex = await this.init();
    await ex.loadMarkets();
    var sym = hgNormalizeCcxtSymbol(symbol, ex.markets);
    var market = ex.markets[sym];
    var bal = await ex.fetchBalance();
    var usdt = (bal.total && (bal.total.USDT != null ? bal.total.USDT : bal.total.usdt)) || 0;
    if (!(usdt > 0) && bal.total){
      var keys = Object.keys(bal.total);
      for (var i = 0; i < keys.length; i++){
        var v = +bal.total[keys[i]];
        if (isFinite(v) && v > 0){ usdt = v; break; }
      }
    }
    var sized = hgCalculateOrderSize(usdt, entryPrice, stopLossPrice, riskPercent, hgAmountPrecision(market));
    if (sized.error) throw new Error(sized.error);
    if (ex.amountToPrecision){
      sized.positionSizeUnits = parseFloat(ex.amountToPrecision(sym, sized.positionSizeUnits));
    }
    sized.equityUSDT = usdt;
    sized.symbol = sym;
    return sized;
  }

  async fetchOrderBookForPlan(plan, depth){
    var ex = await this.init();
    var sym = hgNormalizeCcxtSymbol(plan.symbol || plan.sym, ex.markets);
    depth = Math.max(5, Math.min(50, +(depth || 20)));
    var ob = await ex.fetchOrderBook(sym, depth);
    return { bids: ob.bids || [], asks: ob.asks || [], symbol: sym };
  }

  async executeTrade(plan){
    try{
      var ex = await this.init();
      var sym = hgNormalizeCcxtSymbol(plan.symbol || plan.sym, ex.markets);
      var side = hgSideToCcxt(plan.side || plan.dir);
      var entry = isFinite(plan.entry) ? +plan.entry
        : (isFinite(plan.limitPrice) ? +plan.limitPrice : NaN);
      var stop = plan.bracket ? +plan.bracket.stop : +plan.stop;
      var t1 = plan.bracket ? +plan.bracket.takeProfit : +plan.t1;
      var amount = +(plan.qty || plan.amount || 0);
      var riskPct = isFinite(plan.riskPercent) ? +plan.riskPercent
        : (isFinite(this.options.riskPercent) ? +this.options.riskPercent : 1.0);

      if (!(amount > 0) && isFinite(entry) && isFinite(stop)){
        var sized = await this.calculateOrderSize(sym, entry, stop, riskPct);
        amount = sized.positionSizeUnits;
      }
      if (!(amount > 0)) return { success: false, error: 'Could not size order — qty missing and risk sizing failed' };
      if (!isFinite(stop) || !isFinite(t1)){
        return { success: false, error: 'Bracket stop and takeProfit (t1) required' };
      }

      var lev = +(plan.leverage || plan.lev || 0);
      if (lev > 0 && typeof ex.setLeverage === 'function'){
        try{ await ex.setLeverage(Math.floor(lev), sym); }catch(e){ /* venue may set on order */ }
      }

      amount = ex.amountToPrecision ? parseFloat(ex.amountToPrecision(sym, amount)) : amount;
      if (!isFinite(entry)){
        var ticker = await ex.fetchTicker(sym);
        entry = ticker && (ticker.last || ticker.close || ticker.bid);
      }
      if (!isFinite(entry) || !(entry > 0)){
        return { success: false, error: 'Entry price required for limit bracket' };
      }
      entry = ex.priceToPrecision ? parseFloat(ex.priceToPrecision(sym, entry)) : entry;
      stop = ex.priceToPrecision ? parseFloat(ex.priceToPrecision(sym, stop)) : stop;
      t1 = ex.priceToPrecision ? parseFloat(ex.priceToPrecision(sym, t1)) : t1;

      var params = {
        stopLoss: { triggerPrice: stop, type: 'market' },
        takeProfit: { triggerPrice: t1, type: 'limit' },
      };
      if (isFinite(plan.bracket && plan.bracket.takeProfit2 ? plan.bracket.takeProfit2 : plan.t2)){
        var t2 = plan.bracket ? +plan.bracket.takeProfit2 : +plan.t2;
        if (isFinite(t2)) params.takeProfit2 = { triggerPrice: ex.priceToPrecision(sym, t2), type: 'limit' };
      }

      var order = await ex.createOrder(sym, 'limit', side, amount, entry, params);
      var orderId = order && (order.id || order.orderId);
      var fillQty = order && (order.filled != null ? +order.filled : null);
      var avgPrice = order && (order.average != null ? +order.average : null);
      if (orderId && typeof ex.fetchOrder === 'function' && (!fillQty || !avgPrice)){
        try{
          var polled = await ex.fetchOrder(orderId, sym);
          if (polled){
            if (polled.filled != null) fillQty = +polled.filled;
            if (polled.average != null) avgPrice = +polled.average;
            order = polled;
          }
        }catch(e){ /* best-effort */ }
      }
      return {
        success: true,
        orderId: orderId,
        size: amount,
        symbol: sym,
        side: side,
        entry: entry,
        stop: stop,
        t1: t1,
        fill: {
          filledQty: fillQty != null && isFinite(fillQty) ? fillQty : amount,
          qty: amount,
          avgPrice: avgPrice != null && isFinite(avgPrice) ? avgPrice : entry,
          note: fillQty > 0 ? 'ccxt bracket filled/partial' : 'ccxt bracket submitted',
        },
      };
    }catch(error){
      return { success: false, error: (error && error.message) || String(error) };
    }
  }

  /** Limit order with price chase toward market (Hummingbot order_executor pattern). */
  async createLimitChase(plan, chaseOpts){
    chaseOpts = chaseOpts || {};
    var maxSteps = Math.max(1, +(chaseOpts.maxSteps || plan.chaseMaxSteps || 5));
    var stepBps = +(chaseOpts.stepBps || plan.chaseStepBps || 5);
    var last = null;
    for (var step = 0; step < maxSteps; step++){
      var run = await this.executeTrade(plan);
      last = run;
      if (run && run.success) return run;
      try{
        var ex = await this.init();
        var sym = hgNormalizeCcxtSymbol(plan.symbol || plan.sym, ex.markets);
        var ticker = await ex.fetchTicker(sym);
        var side = hgSideToCcxt(plan.side || plan.dir);
        var px = side === 'buy' ? (ticker.ask || ticker.last) : (ticker.bid || ticker.last);
        if (!isFinite(px)) break;
        var adj = px * (stepBps / 10000) * (side === 'buy' ? 1 : -1);
        plan = Object.assign({}, plan, { entry: ex.priceToPrecision ? parseFloat(ex.priceToPrecision(sym, px + adj)) : (px + adj) });
      }catch(e){ break; }
    }
    return last || { success: false, error: 'limit chase exhausted' };
  }

  async cancelOrder(symbol, orderId){
    try{
      var ex = await this.init();
      var sym = hgNormalizeCcxtSymbol(symbol, ex.markets);
      await ex.cancelOrder(orderId, sym);
      return { success: true, orderId: orderId, symbol: sym };
    }catch(error){
      return { success: false, error: (error && error.message) || String(error) };
    }
  }

  async closePosition(plan){
    try{
      var ex = await this.init();
      var sym = hgNormalizeCcxtSymbol(plan.symbol || plan.sym, ex.markets);
      var side = hgSideToCcxt(plan.side || plan.dir);
      var closeSide = side === 'buy' ? 'sell' : 'buy';
      var amount = +(plan.qty || plan.amount || plan.size || 0);

      if (typeof ex.closePosition === 'function'){
        try{
          var closed = await ex.closePosition(sym, undefined, { side: closeSide });
          return {
            success: true,
            orderId: closed && (closed.id || closed.orderId),
            symbol: sym,
            size: amount || null,
            fill: { note: 'ccxt closePosition' },
          };
        }catch(e){ /* fall through to reduce-only market */ }
      }

      if (!(amount > 0) && typeof ex.fetchPositions === 'function'){
        var positions = await ex.fetchPositions([sym]);
        for (var i = 0; i < positions.length; i++){
          var pos = positions[i];
          if (!pos) continue;
          var contracts = Math.abs(+(pos.contracts != null ? pos.contracts : pos.amount || 0));
          if (contracts > 0){
            amount = contracts;
            if (pos.side === 'short') closeSide = 'buy';
            else if (pos.side === 'long') closeSide = 'sell';
            break;
          }
        }
      }
      if (!(amount > 0)) return { success: false, error: 'No open position size to close' };

      amount = ex.amountToPrecision ? parseFloat(ex.amountToPrecision(sym, amount)) : amount;
      var params = { reduceOnly: true };
      var order = await ex.createOrder(sym, 'market', closeSide, amount, undefined, params);
      return {
        success: true,
        orderId: order && (order.id || order.orderId),
        symbol: sym,
        size: amount,
        side: closeSide,
        fill: { filledQty: amount, qty: amount, note: 'reduce-only market close' },
      };
    }catch(error){
      return { success: false, error: (error && error.message) || String(error) };
    }
  }
}

let __singleton = null;

export function hgCcxtExecutorFromEnv(){
  var exchangeId = process.env.EXECUTE_CCXT_EXCHANGE || '';
  var apiKey = process.env.EXECUTE_CCXT_API_KEY || '';
  var secret = process.env.EXECUTE_CCXT_SECRET || process.env.EXECUTE_CCXT_API_SECRET || '';
  if (!exchangeId || !apiKey || !secret) return null;
  if (__singleton && __singleton.exchangeId === exchangeId) return __singleton;
  __singleton = new HardgateExecutor(exchangeId, apiKey, secret, {
    password: process.env.EXECUTE_CCXT_PASSWORD || undefined,
    sandbox: process.env.EXECUTE_CCXT_SANDBOX === '1' || process.env.EXECUTE_CCXT_SANDBOX === 'true',
    riskPercent: process.env.EXECUTE_RISK_PCT ? +process.env.EXECUTE_RISK_PCT : 1.0,
    exchangeOptions: process.env.EXECUTE_CCXT_DEFAULT_TYPE
      ? { defaultType: process.env.EXECUTE_CCXT_DEFAULT_TYPE }
      : hgCcxtExchangeOptions(exchangeId),
  });
  return __singleton;
}

export async function hgCcxtExecutePayload(payload){
  var exec = hgCcxtExecutorFromEnv();
  if (!exec) return { ok: false, reason: 'CCXT executor not configured' };
  try{
    var plan = Object.assign({}, payload, {
      entry: payload.entry || payload.limitPrice,
      riskPercent: payload.riskPercent || process.env.EXECUTE_RISK_PCT || 1.0,
    });
    var slices = +(payload.twapSlices || process.env.EXECUTE_TWAP_SLICES || 0);
    var result;
    if (slices > 1){
      result = await hgTwapExecute(exec, plan, {
        slices: slices,
        intervalMs: +(payload.twapIntervalMs || process.env.EXECUTE_TWAP_INTERVAL_MS || 5000),
        chase: payload.chase !== false,
      });
    } else if (payload.chase === true || payload.chase === '1'){
      result = await exec.createLimitChase(plan, payload);
    } else {
      result = await exec.executeTrade(plan);
    }
    if (!result.success){
      return { ok: false, reason: result.error || 'execution failed' };
    }
    return {
      ok: true,
      orderId: result.orderId,
      size: result.size,
      symbol: result.symbol,
      fill: result.fill,
      response: JSON.stringify({ orderId: result.orderId, size: result.size, symbol: result.symbol, twap: slices > 1 }),
    };
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

export async function hgAssertCcxtBoot(){
  var key = process.env.EXECUTE_CCXT_API_KEY || '';
  var secret = process.env.EXECUTE_CCXT_SECRET || process.env.EXECUTE_CCXT_API_SECRET || '';
  if (!key || !secret) return { ok: true };
  try{
    await import('ccxt');
    return { ok: true };
  }catch(e){
    return { ok: false, reason: 'EXECUTE_CCXT_* configured but ccxt import failed: ' + ((e && e.message) || e) };
  }
}
