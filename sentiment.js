/* =========================================================================
   HARDGATE Sentiment Module — enriches signals with market sentiment context
   Fetches from sentiment-cache/sentiment.json (populated by sentiment-engine.py)

   Public API:
   - hgSentimentLoad() → Promise
   - hgSentimentGet(symbol) → {score, text, timestamp, stale?}
   - hgSentimentScoreSignal(symbol, baseConfidence) → adjustedConfidence
   - hgSentimentBadge(sentiment) → {cls, label, title}
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_SENTIMENT = {
  cache: {},
  lastUpdate: null,
  loadPromise: null
};

/* Load sentiment cache from sentiment.json */
function hgSentimentLoad(){
  if (HG_SENTIMENT.loadPromise) return HG_SENTIMENT.loadPromise;

  HG_SENTIMENT.loadPromise = Promise.resolve()
    .then(function(){
      return fetch('./scripts/sentiment-cache/sentiment.json', {
        method: 'GET',
        cache: 'no-store'
      });
    })
    .then(function(res){
      if (!res || !res.ok) throw new Error('sentiment fetch failed: ' + (res && res.status));
      return res.json();
    })
    .then(function(data){
      HG_SENTIMENT.cache = data || {};
      HG_SENTIMENT.lastUpdate = Date.now();
      return HG_SENTIMENT.cache;
    })
    .catch(function(e){
      console.warn('[sentiment] load failed:', e.message);
      HG_SENTIMENT.cache = {};
      return {};
    });

  return HG_SENTIMENT.loadPromise;
}

/* Get sentiment entry for a symbol */
function hgSentimentGet(symbol){
  var entry = HG_SENTIMENT.cache[symbol] || {};
  return {
    score: entry.score || 0.0,
    text: entry.text || '',
    timestamp: entry.timestamp || null,
    stale: entry.stale || false,
    confidence: entry.confidence || 0.5
  };
}

/* Adjust signal confidence based on sentiment alignment
   Returns: adjusted confidence score (0.0 to 1.0)

   Logic:
   - If signal is LONG and sentiment is bullish (+0.5 to +1.0): boost +10-20%
   - If signal is LONG and sentiment is bearish (-0.5 to -1.0): reduce -20-30%
   - If signal is SHORT and sentiment is bearish: boost +10-20%
   - If signal is SHORT and sentiment is bullish: reduce -20-30%
*/
function hgSentimentScoreSignal(symbol, baseConfidence, signalDir){
  var sentiment = hgSentimentGet(symbol);
  if (!sentiment || sentiment.score === undefined) return baseConfidence;

  var score = sentiment.score;
  var adjusted = baseConfidence;

  /* Direction: 'long' | 'short' */
  if (signalDir === 'long'){
    if (score > 0.5) adjusted += (baseConfidence * 0.15 * (score - 0.5) / 0.5);  /* boost */
    else if (score < -0.5) adjusted -= (adjusted * 0.25 * (Math.abs(score) - 0.5) / 0.5);  /* reduce */
  } else if (signalDir === 'short'){
    if (score < -0.5) adjusted += (baseConfidence * 0.15 * (Math.abs(score) - 0.5) / 0.5);  /* boost */
    else if (score > 0.5) adjusted -= (adjusted * 0.25 * (score - 0.5) / 0.5);  /* reduce */
  }

  return Math.max(0.0, Math.min(1.0, adjusted));  /* clamp */
}

/* Generate sentiment badge for UI display */
function hgSentimentBadge(sentiment){
  var score = (sentiment && sentiment.score) || 0;
  var stale = sentiment && sentiment.stale;

  if (stale) return { cls: 'stale', label: '(old)', title: 'sentiment data stale — sentiment-engine not running' };
  if (score > 0.6) return { cls: 'bullish', label: '🟢 bullish', title: 'strong bullish sentiment — market favorable' };
  if (score > 0.2) return { cls: 'mildly-bullish', label: '🟡 mixed↑', title: 'mild bullish lean — caution advised' };
  if (score < -0.6) return { cls: 'bearish', label: '🔴 bearish', title: 'strong bearish sentiment — high risk' };
  if (score < -0.2) return { cls: 'mildly-bearish', label: '🟡 mixed↓', title: 'mild bearish lean — wait for confirmation' };
  return { cls: 'neutral', label: '⚪ neutral', title: 'neutral sentiment — watch for direction' };
}

/* Recommend whether to trade based on sentiment conflict
   Returns: { shouldTrade: bool, reason: string } */
function hgSentimentGate(symbol, signalDir, confidence){
  var sentiment = hgSentimentGet(symbol);
  if (!sentiment || sentiment.score === undefined) return { shouldTrade: true, reason: 'no sentiment data' };

  var score = sentiment.score;
  var isConflict = (signalDir === 'long' && score < -0.5) || (signalDir === 'short' && score > 0.5);

  if (isConflict && confidence < 0.8){
    return {
      shouldTrade: false,
      reason: 'SENTIMENT CONFLICT: ' + signalDir + ' signal vs ' + score.toFixed(2) + ' sentiment; confidence ' + Math.round(confidence * 100) + '% too low'
    };
  }

  return {
    shouldTrade: true,
    reason: isConflict ? 'against-sentiment (high confidence override)' : 'sentiment aligned'
  };
}

/* Format sentiment for display on a card */
function hgSentimentCardText(symbol){
  var sentiment = hgSentimentGet(symbol);
  var badge = hgSentimentBadge(sentiment);

  var html = '<div class="sentiment-badge sentiment-' + badge.cls + '" title="' + (badge.title || '') + '">';
  html += badge.label;

  if (sentiment.timestamp){
    var age = Math.round((Date.now() - new Date(sentiment.timestamp)) / 1000);
    var ageLabel = age < 60 ? age + 's' : (age < 3600 ? Math.round(age / 60) + 'm' : Math.round(age / 3600) + 'h');
    html += ' (' + ageLabel + ' ago)';
  }

  html += '</div>';
  return html;
}

/* CSS for sentiment badges */
function hgSentimentStyles(){
  return `
    .sentiment-badge {
      display: inline-block;
      padding: 2px 8px;
      margin: 2px 0;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
      cursor: help;
    }
    .sentiment-bullish {
      background: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
      border: 1px solid #4CAF50;
    }
    .sentiment-mildly-bullish {
      background: rgba(255, 193, 7, 0.2);
      color: #FFC107;
      border: 1px solid #FFC107;
    }
    .sentiment-bearish {
      background: rgba(244, 67, 54, 0.2);
      color: #F44336;
      border: 1px solid #F44336;
    }
    .sentiment-mildly-bearish {
      background: rgba(255, 152, 0, 0.2);
      color: #FF9800;
      border: 1px solid #FF9800;
    }
    .sentiment-neutral {
      background: rgba(158, 158, 158, 0.2);
      color: #9E9E9E;
      border: 1px solid #9E9E9E;
    }
    .sentiment-stale {
      background: rgba(96, 125, 139, 0.2);
      color: #607D8B;
      border: 1px dashed #607D8B;
      font-style: italic;
    }
  `;
}

/* Initialize on page load */
function hgSentimentInit(){
  try{
    hgSentimentLoad().then(function(){
      console.log('[sentiment] initialized with', Object.keys(HG_SENTIMENT.cache).length, 'symbols');
    });
  }catch(e){
    console.warn('[sentiment] init failed:', e);
  }
}

/* Export */
G.HG_SENTIMENT = HG_SENTIMENT;
G.hgSentimentLoad = hgSentimentLoad;
G.hgSentimentGet = hgSentimentGet;
G.hgSentimentScoreSignal = hgSentimentScoreSignal;
G.hgSentimentBadge = hgSentimentBadge;
G.hgSentimentGate = hgSentimentGate;
G.hgSentimentCardText = hgSentimentCardText;
G.hgSentimentStyles = hgSentimentStyles;
G.hgSentimentInit = hgSentimentInit;

if (G.document && G.document.readyState === 'loading'){
  G.document.addEventListener('DOMContentLoaded', hgSentimentInit);
} else if (G.document){
  hgSentimentInit();
}
