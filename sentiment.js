/* =========================================================================
   HARDGATE Sentiment v2 — Production-grade market sentiment enrichment

   Integrates real-time sentiment from Agent-Reach feeds (RSS, liquidations, social).
   Adjusts signal confidence and gates trades on sentiment conflicts.

   Public API:
   - hgSentimentLoad() → Promise<cache>
   - hgSentimentGet(symbol) → {score, sources, stale?, timestamp}
   - hgSentimentScoreSignal(symbol, confidence, direction) → adjusted confidence
   - hgSentimentGate(symbol, direction, confidence) → {shouldTrade, reason}
   - hgSentimentBadge(sentiment) → {cls, label, title}
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_SENTIMENT = {
  cache: {},
  lastUpdate: null,
  loadPromise: null,
  config: {
    loadThreshold: 0.3,      // Min age to reload cache (seconds)
    conflictThreshold: 0.6,  // Min divergence to flag conflict
    boostFactor: 0.15,       // Max confidence boost from aligned sentiment
    penaltyFactor: 0.25      // Max confidence penalty from conflicting sentiment
  }
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
      if (!res || !res.ok) throw new Error('sentiment: HTTP ' + (res && res.status));
      return res.json();
    })
    .then(function(data){
      HG_SENTIMENT.cache = data || {};
      HG_SENTIMENT.lastUpdate = Date.now();
      console.log('[sentiment] loaded', Object.keys(HG_SENTIMENT.cache).length, 'symbols');
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
    score: entry.score !== undefined ? entry.score : 0.0,
    sources: entry.sources || [],
    sourceCount: entry.source_count || 0,
    timestamp: entry.timestamp || null,
    stale: !!entry.stale
  };
}

/**
 * Adjust signal confidence based on sentiment alignment.
 *
 * Logic:
 * - LONG signal + bullish sentiment (score > 0.3): boost confidence
 * - LONG signal + bearish sentiment (score < -0.3): reduce confidence
 * - SHORT signal + bearish sentiment (score < -0.3): boost confidence
 * - SHORT signal + bullish sentiment (score > 0.3): reduce confidence
 *
 * Magnitude of boost/penalty scales with:
 * - Sentiment strength (|score|)
 * - Base confidence (higher = more room to boost)
 */
function hgSentimentScoreSignal(symbol, baseConfidence, direction){
  var sentiment = hgSentimentGet(symbol);
  if (!sentiment || sentiment.score === undefined) return baseConfidence;

  var score = sentiment.score;
  var adjusted = baseConfidence;
  var alignment = 0;  // -1 to +1: how aligned sentiment is with signal

  if (direction === 'long'){
    alignment = score;  // positive = aligned
  } else if (direction === 'short'){
    alignment = -score;  // negative sentiment = aligned
  } else {
    return baseConfidence;
  }

  /* Apply boost or penalty based on alignment */
  if (alignment > 0.3){
    /* Aligned sentiment: boost */
    var boostMagnitude = Math.min(alignment, 1.0);  /* 0.3-1.0 */
    var boostAmount = baseConfidence * HG_SENTIMENT.config.boostFactor * boostMagnitude;
    adjusted += boostAmount;
  } else if (alignment < -0.3){
    /* Conflicting sentiment: penalize */
    var penaltyMagnitude = Math.min(Math.abs(alignment), 1.0);  /* 0.3-1.0 */
    var penaltyAmount = adjusted * HG_SENTIMENT.config.penaltyFactor * penaltyMagnitude;
    adjusted -= penaltyAmount;
  }

  return Math.max(0.0, Math.min(1.0, adjusted));
}

/**
 * Gate trades based on sentiment conflicts.
 * Returns: {shouldTrade: bool, reason: string, conflictLevel: 'none'|'minor'|'major'}
 */
function hgSentimentGate(symbol, direction, confidence){
  var sentiment = hgSentimentGet(symbol);
  if (!sentiment || sentiment.score === undefined){
    return {
      shouldTrade: true,
      reason: 'no sentiment data',
      conflictLevel: 'none'
    };
  }

  var score = sentiment.score;
  var isConflict = (direction === 'long' && score < -0.5) ||
                    (direction === 'short' && score > 0.5);
  var conflictMagnitude = Math.abs(score);  /* 0.0-1.0 */

  if (!isConflict){
    return {
      shouldTrade: true,
      reason: 'sentiment aligned (' + score.toFixed(2) + ')',
      conflictLevel: 'none'
    };
  }

  /* Conflict detected */
  if (confidence >= 0.85){
    /* High confidence overrides sentiment conflict */
    return {
      shouldTrade: true,
      reason: 'high confidence overrides ' + direction + ' vs sentiment ' + score.toFixed(2),
      conflictLevel: 'minor'
    };
  }

  if (confidence < 0.70 && conflictMagnitude > 0.7){
    /* Low confidence + strong conflict = BLOCK */
    return {
      shouldTrade: false,
      reason: 'SENTIMENT CONFLICT: ' + direction + ' signal (' + Math.round(confidence * 100) + '%) vs strong ' +
              (score > 0 ? 'bullish' : 'bearish') + ' sentiment (' + score.toFixed(2) + ')',
      conflictLevel: 'major'
    };
  }

  /* Medium conflict: warn but allow */
  return {
    shouldTrade: true,
    reason: 'caution: ' + direction + ' signal conflicts with sentiment (' + score.toFixed(2) + ')',
    conflictLevel: 'minor'
  };
}

/* Generate sentiment badge for UI display */
function hgSentimentBadge(sentiment){
  var score = (sentiment && sentiment.score) || 0;
  var stale = sentiment && sentiment.stale;

  if (stale) return {
    cls: 'stale',
    label: '⏱️ (updating)',
    title: 'sentiment data stale — waiting for engine refresh'
  };

  if (score > 0.6) return {
    cls: 'bullish',
    label: '🟢 strong bullish',
    title: 'strong bullish sentiment (' + score.toFixed(2) + ') — market favorable for longs'
  };
  if (score > 0.2) return {
    cls: 'mildly-bullish',
    label: '🟡 bullish lean',
    title: 'mild bullish sentiment (' + score.toFixed(2) + ') — watch for reversal'
  };
  if (score < -0.6) return {
    cls: 'bearish',
    label: '🔴 strong bearish',
    title: 'strong bearish sentiment (' + score.toFixed(2) + ') — high risk, liquidation risk'
  };
  if (score < -0.2) return {
    cls: 'mildly-bearish',
    label: '🟠 bearish lean',
    title: 'mild bearish sentiment (' + score.toFixed(2) + ') — wait for confirmation'
  };
  return {
    cls: 'neutral',
    label: '⚪ neutral',
    title: 'neutral sentiment (' + score.toFixed(2) + ') — no directional bias'
  };
}

/* Format sentiment for card display */
function hgSentimentCardHTML(symbol){
  var sentiment = hgSentimentGet(symbol);
  var badge = hgSentimentBadge(sentiment);

  var html = '<div class="sentiment-badge sentiment-' + badge.cls + '" title="' + (badge.title || '') + '">';
  html += badge.label;

  if (sentiment.timestamp){
    var age = Math.round((Date.now() - new Date(sentiment.timestamp)) / 1000);
    var ageLabel = age < 60 ? age + 's' : (age < 3600 ? Math.round(age / 60) + 'm' : Math.round(age / 3600) + 'h');
    html += ' (' + ageLabel + ' ago)';
  }

  if (sentiment.sourceCount && sentiment.sourceCount > 0){
    html += ' · ' + sentiment.sourceCount + ' sources';
  }

  html += '</div>';
  return html;
}

/* CSS for sentiment badges (light/dark aware) */
function hgSentimentStyles(){
  return `
    .sentiment-badge {
      display: inline-block;
      padding: 3px 10px;
      margin: 2px 0;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: help;
      border: 1px solid;
    }
    .sentiment-bullish {
      background: rgba(76, 175, 80, 0.15);
      color: #166534;
      border-color: #86EFAC;
    }
    .sentiment-mildly-bullish {
      background: rgba(250, 204, 21, 0.15);
      color: #92400E;
      border-color: #FCD34D;
    }
    .sentiment-bearish {
      background: rgba(239, 68, 68, 0.15);
      color: #DC2626;
      border-color: #FECACA;
    }
    .sentiment-mildly-bearish {
      background: rgba(249, 115, 22, 0.15);
      color: #EA580C;
      border-color: #FDBA74;
    }
    .sentiment-neutral {
      background: rgba(100, 116, 139, 0.15);
      color: #64748B;
      border-color: #CBD5E1;
    }
    .sentiment-stale {
      background: rgba(79, 70, 229, 0.1);
      color: #4F46E5;
      border-color: #A5B4FC;
      font-style: italic;
    }
  `;
}

/* Initialize on page load */
function hgSentimentInit(){
  try{
    hgSentimentLoad().then(function(){
      console.log('[sentiment] ready');
    }).catch(function(e){
      console.warn('[sentiment] init error:', e);
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
G.hgSentimentGate = hgSentimentGate;
G.hgSentimentBadge = hgSentimentBadge;
G.hgSentimentCardHTML = hgSentimentCardHTML;
G.hgSentimentStyles = hgSentimentStyles;
G.hgSentimentInit = hgSentimentInit;

if (G.document && G.document.readyState === 'loading'){
  G.document.addEventListener('DOMContentLoaded', hgSentimentInit);
} else if (G.document){
  hgSentimentInit();
}
