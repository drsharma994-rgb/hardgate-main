/* HARDGATE — TradeOS MCP query router (pure, vm-testable).
   Maps natural-language prompts + Hardgate presets to TradeOS MCP tool calls.
   Never throws. */

export const TRADEOS_MCP_URL = 'https://ai.tradeos.xyz/api/agent/mcp/mcp-call';

export const TRADEOS_PRESETS = {
  crypto_btc_eth: {
    label: 'BTC / ETH',
    lane: 'crypto',
    tool: 'technical_analysis',
    description: 'Multi-timeframe TA for BTC and ETH with Hardgate regime context',
  },
  gold_xau: {
    label: 'XAUUSD Gold',
    lane: 'gold',
    tool: 'technical_analysis',
    description: 'Precious metals trend, momentum, and volatility on XAUUSD',
  },
  spread_btc_eth: {
    label: 'BTC / ETH spread',
    lane: 'crypto',
    tool: 'technical_analysis',
    description: 'Relative strength ratio chart — BTC vs ETH leadership',
  },
  spread_rank: {
    label: 'Multi-asset rank',
    lane: 'mixed',
    tool: 'bloomberg-oracle-terminal',
    description: 'Rank BTC, ETH, and XAUUSD by trend, momentum, and volatility',
  },
  macro_news: {
    label: 'Macro / news',
    lane: 'mixed',
    tool: 'bloomberg-oracle-terminal',
    description: 'Macro narrative and catalyst context for crypto and gold',
  },
};

const TA_DEFAULTS = {
  mainWindow: '1D',
  extraWindows: ['1W', '4W', '240'],
  strategy: 'Trend-Analysis',
  indicators: [
    'Moving Average',
    'Moving Average Convergence Divergence',
    'Relative Strength Index',
    'Bollinger Bands',
    'Average True Range',
  ],
};

/** @returns {boolean} */
export function tradeosConfigured(){
  return !!(process.env.TRADEOS_ACCESS_TOKEN && String(process.env.TRADEOS_ACCESS_TOKEN).trim());
}

/** Build a Hardgate context block appended to TradeOS userQuestion / query. */
export function buildHardgateContextBlock(context){
  if (!context || typeof context !== 'object') return '';
  var lines = [];
  try{
    var r = context.regime;
    if (r && r.label != null){
      lines.push('REGIME: ' + r.label + (r.score != null ? ' (score ' + r.score + ')' : ''));
      if (r.playbook && r.playbook.bias) lines.push('REGIME BIAS: ' + r.playbook.bias);
    }
    var rot = context.rotation;
    if (rot && rot.season) lines.push('ROTATION: ' + rot.season);
    var b = context.brain;
    if (b){
      if (b.marketRead) lines.push('BRAIN MARKET READ: ' + b.marketRead);
      if (b.topSym) lines.push('BRAIN TOP: ' + b.topSym + ' ' + (b.topTier || ''));
    }
    if (context.goldSource) lines.push('GOLD FEED: ' + context.goldSource);
    if (context.goldBasisPct != null && isFinite(+context.goldBasisPct)){
      lines.push('GOLD BASIS: ' + (+context.goldBasisPct).toFixed(2) + '% vs spot');
    }
  }catch(e){}
  if (!lines.length) return '';
  return '\n\nHardgate terminal context (align your answer with this desk state):\n- ' + lines.join('\n- ');
}

/** Classify free-text query -> tool name. */
export function classifyTradeosQuery(query){
  var q = String(query || '').toLowerCase();
  if (!q.trim()) return 'technical_analysis';
  if (/\b(search|find ticker|lookup|symbol|resolve)\b/.test(q)) return 'search_tickers';
  if (/\b(news|macro|headline|fed|why did|policy|catalyst|narrative)\b/.test(q)) return 'bloomberg-oracle-terminal';
  if (/\b(agent|my agent|customize)\b/.test(q)) return 'customize-agent';
  return 'technical_analysis';
}

/** Extract ticker hint from query for ad_hoc TA. */
export function extractTickerHint(query, preset){
  if (preset === 'gold_xau') return 'C:XAUUSD';
  if (preset === 'spread_btc_eth') return 'X:BTCUSD / X:ETHUSD';
  if (preset === 'crypto_btc_eth') return 'X:BTCUSD';
  var q = String(query || '');
  if (/\bxau|gold\b/i.test(q)) return 'C:XAUUSD';
  if (/\beth\b/i.test(q) && /\bbtc\b/i.test(q) && /\bspread|ratio|vs\b/i.test(q)) return 'X:BTCUSD / X:ETHUSD';
  if (/\beth\b/i.test(q)) return 'X:ETHUSD';
  if (/\bbtc\b/i.test(q)) return 'X:BTCUSD';
  return 'X:BTCUSD';
}

/**
 * Route a user query to { tool, arguments, preset, lane }.
 * @param {{ query?: string, preset?: string, context?: object }} input
 */
export function routeTradeosQuery(input){
  var query = String((input && input.query) || '').trim();
  var preset = String((input && input.preset) || '').trim();
  var context = (input && input.context) || null;
  var ctxBlock = buildHardgateContextBlock(context);
  var meta = { preset: preset || null, lane: 'mixed', tool: null };

  if (preset && TRADEOS_PRESETS[preset]){
    var p = TRADEOS_PRESETS[preset];
    meta.lane = p.lane;
    meta.tool = p.tool;
    if (p.tool === 'technical_analysis'){
      var ticker = extractTickerHint(query, preset);
      var userQuestion = query || defaultPresetQuestion(preset);
      userQuestion += ctxBlock;
      if (preset === 'crypto_btc_eth'){
        userQuestion += '\n\nAlso summarize ETH (X:ETHUSD) trend and momentum in the same answer.';
      }
      return {
        tool: 'technical_analysis',
        arguments: {
          action: 'ad_hoc',
          ad_hoc: Object.assign({}, TA_DEFAULTS, {
            ticker: ticker,
            userQuestion: userQuestion.slice(0, 4000),
          }),
        },
        meta: meta,
      };
    }
    if (p.tool === 'bloomberg-oracle-terminal'){
      var bq = query || defaultPresetQuestion(preset);
      bq += ctxBlock;
      return {
        tool: 'bloomberg-oracle-terminal',
        arguments: { query: bq.slice(0, 2000) },
        meta: meta,
      };
    }
  }

  var tool = classifyTradeosQuery(query);
  meta.tool = tool;

  if (tool === 'search_tickers'){
    return {
      tool: 'search_tickers',
      arguments: { q: query.slice(0, 200), limit: 10 },
      meta: meta,
    };
  }
  if (tool === 'bloomberg-oracle-terminal'){
    return {
      tool: 'bloomberg-oracle-terminal',
      arguments: { query: (query + ctxBlock).slice(0, 2000) },
      meta: meta,
    };
  }
  if (tool === 'customize-agent'){
    return {
      tool: 'customize-agent',
      arguments: { action: 'list' },
      meta: meta,
    };
  }

  var hint = extractTickerHint(query, '');
  meta.lane = /\bxau|gold\b/i.test(query) ? 'gold' : 'crypto';
  return {
    tool: 'technical_analysis',
    arguments: {
      action: 'ad_hoc',
      ad_hoc: Object.assign({}, TA_DEFAULTS, {
        ticker: hint,
        userQuestion: (query + ctxBlock).slice(0, 4000),
      }),
    },
    meta: meta,
  };
}

function defaultPresetQuestion(preset){
  if (preset === 'crypto_btc_eth'){
    return 'Analyze BTC and ETH by trend, momentum, and volatility on the daily chart. ' +
      'List key support/resistance, regime (trend vs range), and relative strength between BTC and ETH.';
  }
  if (preset === 'gold_xau'){
    return 'Analyze XAUUSD (gold) by trend, momentum, and volatility. ' +
      'Key levels, hedge-demand read, and whether gold is leading or lagging risk assets.';
  }
  if (preset === 'spread_btc_eth'){
    return 'Analyze the X:BTCUSD / X:ETHUSD spread ratio for trend, momentum, and volatility. ' +
      'Score 0-100 (0 = strong ETH leadership, 100 = strong BTC leadership). Summarize bias: long spread, short spread, or neutral.';
  }
  if (preset === 'spread_rank'){
    return 'Rank BTC, ETH, and XAUUSD (gold) by trend strength, momentum, and volatility. ' +
      'Compare crypto vs precious metals leadership. Include macro catalysts affecting each leg.';
  }
  if (preset === 'macro_news'){
    return 'Summarize macro and news catalysts affecting BTC, ETH, and gold (XAUUSD) today. ' +
      'Include Fed, DXY, yields, and geopolitical drivers relevant to a crypto + metals desk.';
  }
  return 'Analyze the requested asset by trend, momentum, and volatility.';
}

/** Parse MCP tool result content into { ok, text, raw }. Never throws. */
export function parseTradeosToolResult(result){
  try{
    if (!result) return { ok: false, text: null, raw: null, reason: 'empty result' };
    var parts = [];
    var content = result.content;
    if (Array.isArray(content)){
      for (var i = 0; i < content.length; i++){
        var c = content[i];
        if (c && c.type === 'text' && c.text) parts.push(String(c.text));
      }
    }
    var text = parts.join('\n\n').trim();
    if (!text && result.structuredContent){
      try{ text = JSON.stringify(result.structuredContent, null, 2); }catch(e){}
    }
    if (!text) return { ok: false, text: null, raw: result, reason: 'no text in tool result' };
    return { ok: true, text: text, raw: result, reason: null };
  }catch(e){
    return { ok: false, text: null, raw: null, reason: (e && e.message) || 'parse failed' };
  }
}
