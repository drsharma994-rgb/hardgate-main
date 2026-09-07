/* HARDGATE /api/onchain-alt/desk — server-side on-chain alternative data desk.
   GET /api/onchain-alt/desk
   Assembles BTC exchange netflow proxy, whale transfer stubs, LTH/STH when configured.
   GLASSNODE_API_KEY optional — without it netflow returns null (honest degrade).
   CommonJS, zero deps, Node 18+ global fetch. */

const UPSTREAM_TIMEOUT_MS = 15000;
const GLASSNODE_BASE = 'https://api.glassnode.com/v1/metrics';

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(JSON.stringify(obj));
}

async function fetchGlassnodeNetflows(key){
  try{
    var url = GLASSNODE_BASE + '/transactions/transfers_volume_exchanges_net?a=BTC&i=24h&f=json&api_key=' + encodeURIComponent(key);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    var rows = await res.json();
    if (!Array.isArray(rows)) return null;
    var flows = rows.slice(-7).map(function(r){ return r && isFinite(+r.v) ? +r.v : null; }).filter(function(v){ return v !== null; });
    return flows.length >= 3 ? flows : null;
  }catch(e){ return null; }
}

async function fetchGlassnodeLth(key){
  try{
    var url = GLASSNODE_BASE + '/supply/lth_sum?a=BTC&i=24h&f=json&api_key=' + encodeURIComponent(key);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    var rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return null;
    var last = rows[rows.length - 1];
    var prev30 = rows[Math.max(0, rows.length - 31)];
    var lth = last && isFinite(+last.v) ? +last.v : null;
    var lthPrev = prev30 && isFinite(+prev30.v) ? +prev30.v : null;
    var lth30d = (lth !== null && lthPrev !== null && lthPrev > 0) ? ((lth - lthPrev) / lthPrev) * 100 : null;
    return { lthSupply: lth, lth30dChangePct: lth30d };
  }catch(e){ return null; }
}

async function fetchWhaleAlertTxs(apiKey){
  try{
    if (!apiKey) return [];
    var url = 'https://api.whale-alert.io/v1/transactions?api_key=' + encodeURIComponent(apiKey)
      + '&min_value=10000000&limit=25';
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    var j = await res.json();
    var txs = (j && j.transactions) || [];
    var now = Date.now();
    return txs.map(function(tx){
      if (!tx) return null;
      var usd = isFinite(+tx.amount_usd) ? +tx.amount_usd : null;
      var fromOwner = tx.from && tx.from.owner ? String(tx.from.owner) : '';
      var toOwner = tx.to && tx.to.owner ? String(tx.to.owner) : '';
      var fromType = tx.from && tx.from.owner_type ? String(tx.from.owner_type) : '';
      var toType = tx.to && tx.to.owner_type ? String(tx.to.owner_type) : '';
      var isDeposit = toType === 'exchange' || /binance|coinbase|kraken|okx|bybit/i.test(toOwner);
      var isWithdrawal = fromType === 'exchange' || /binance|coinbase|kraken|okx|bybit/i.test(fromOwner);
      return {
        asset: (tx.symbol || tx.blockchain || 'BTC').toString().toUpperCase(),
        usdValue: usd,
        amountUsd: usd,
        timestamp: tx.timestamp ? (+tx.timestamp * 1000) : now,
        fromLabel: fromOwner || fromType || 'unknown',
        toLabel: toOwner || toType || 'unknown',
        isExchangeDeposit: isDeposit,
        isExchangeWithdrawal: isWithdrawal
      };
    }).filter(Boolean);
  }catch(e){ return []; }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS'){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });

  var key = process.env.GLASSNODE_API_KEY;
  var whaleKey = process.env.WHALE_ALERT_API_KEY;
  var notes = [];
  var flows7d = null;
  var lth = null;
  var whaleTxs = [];

  if (key){
    flows7d = await fetchGlassnodeNetflows(key);
    if (!flows7d) notes.push('glassnode netflow unavailable');
    lth = await fetchGlassnodeLth(key);
    if (!lth) notes.push('glassnode LTH unavailable');
  } else {
    notes.push('GLASSNODE_API_KEY not configured — netflow/LTH unavailable');
  }

  whaleTxs = await fetchWhaleAlertTxs(whaleKey);
  if (!whaleKey) notes.push('WHALE_ALERT_API_KEY not configured — whale ticker empty');
  else if (!whaleTxs.length) notes.push('whale-alert returned no ≥$10M txs');

  return sendJson(res, 200, {
    ok: true,
    flows7d: flows7d,
    whaleTxs: whaleTxs,
    lth: lth ? {
      lthPct: lth.lthSupply,
      sthPct: null,
      lth30d: lth.lth30dChangePct
    } : null,
    notes: notes
  });
};
