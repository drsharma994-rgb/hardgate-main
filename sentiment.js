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
    conflictThreshold: 0.6,  // Min divergence to flag conflict
    boostFactor: 0.15,       // Max confidence boost from aligned sentiment
    penaltyFactor: 0.25      // Max confidence penalty from conflicting sentiment
  }
};

/* Freshness is not this file's decision to make. Every entry the engine writes
   carries its own `ttl`, and scripts/sentiment-engine.py enforces it on the
   producing side:

     def is_cache_fresh(self, symbol):
         if symbol not in self.cache: return False
         try:
             age = (utcnow() - parse(entry['timestamp'])).total_seconds()
             return age < entry.get('ttl', CACHE_TTL)
         except: return False

   The browser never implemented its half. The shipped cache is a committed
   file stamped 2026-09-13T04:56Z with ttl 300 on every row — 6.4 days old,
   1,839x its own time-to-live, and the producer's own check says False for all
   three symbols. It was being scored at full weight anyway: 25% of the
   three-layer confidence that sets a card's tier and its PROFESSIONAL-GRADE
   stamp, while the badge beside it read "bullish lean" rather than stale,
   because nothing ever set entry.stale on a row the engine wrote successfully.

   What follows is a port of is_cache_fresh, rule for rule, including its two
   False-by-default cases: a symbol with no entry, and a timestamp that will
   not parse. A reading we cannot show to be fresh is not a reading. The
   default below is the engine's own CACHE_TTL, used exactly where its
   entry.get('ttl', CACHE_TTL) uses it. No threshold here is invented. */
var SENTIMENT_TTL_DEFAULT = 300;   // scripts/sentiment-engine.py CACHE_TTL

function hgSentimentAgeSec(entry, nowMs){
  if (!entry || !entry.timestamp) return NaN;
  var t = Date.parse(entry.timestamp);
  if (!isFinite(t)) return NaN;
  var now = isFinite(nowMs) ? nowMs : Date.now();
  return (now - t) / 1000;
}

/** "43s" / "12m" / "6.4d" — one label, used by the badge, the card and the gate. */
function hgSentimentAgeLabel(sentiment){
  var a = sentiment ? sentiment.ageSec : null;
  if (a == null || !isFinite(a)) return 'age unknown';
  if (a < 60) return Math.round(a) + 's';
  if (a < 3600) return Math.round(a / 60) + 'm';
  if (a < 86400) return Math.round(a / 3600) + 'h';
  return (a / 86400).toFixed(1) + 'd';
}

function hgSentimentTtlSec(entry){
  var v = entry ? +entry.ttl : NaN;
  return (isFinite(v) && v > 0) ? v : SENTIMENT_TTL_DEFAULT;
}

/** True when ANY cached row is still inside its own ttl. */
function hgSentimentCacheFresh(nowMs){
  try{
    var c = HG_SENTIMENT.cache, k;
    for (k in c){
      if (!Object.prototype.hasOwnProperty.call(c, k)) continue;
      var age = hgSentimentAgeSec(c[k], nowMs);
      if (isFinite(age) && age < hgSentimentTtlSec(c[k])) return true;
    }
    return false;
  }catch(e){ return false; }
}

/* Load sentiment cache from sentiment.json */
/* The promise used to be memoised for the life of the page, so sentiment was
   fetched once per load and never again — in a tab built to stay open on a
   10-minute scan cycle. Now it dedupes only the in-flight request and refetches
   once the cache falls out of its own ttl, which is also the clock the reader
   below uses. Without this the freshness rule would mark everything stale five
   minutes in and never recover. */
function hgSentimentLoad(force){
  if (HG_SENTIMENT.loadPromise) return HG_SENTIMENT.loadPromise;
  if (!force && hgSentimentCacheFresh()) return Promise.resolve(HG_SENTIMENT.cache);

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
      HG_SENTIMENT.loadPromise = null;
      console.log('[sentiment] loaded', Object.keys(HG_SENTIMENT.cache).length, 'symbols');
      return HG_SENTIMENT.cache;
    })
    .catch(function(e){
      console.warn('[sentiment] load failed:', e.message);
      HG_SENTIMENT.cache = {};
      HG_SENTIMENT.loadPromise = null;
      return {};
    });

  return HG_SENTIMENT.loadPromise;
}

/* Get sentiment entry for a symbol. `score` stays the raw reading — that is
   what was read — and `stale` says whether it may be used as a live one. A
   caller that scores must check it; hgSentimentScoreSignal and
   hgSentimentGate below do, and so does the CRYPTO SCAN confidence blend. */
function hgSentimentGet(symbol, nowMs){
  var raw = HG_SENTIMENT.cache[symbol];
  var missing = !raw || typeof raw !== 'object';
  var entry = missing ? {} : raw;
  var ttl = hgSentimentTtlSec(entry);
  var age = hgSentimentAgeSec(entry, nowMs);
  var fresh = !missing && isFinite(age) && age < ttl;
  return {
    score: entry.score !== undefined ? entry.score : 0.0,
    sources: entry.sources || [],
    sourceCount: entry.source_count || 0,
    timestamp: entry.timestamp || null,
    ttl: ttl,
    ageSec: isFinite(age) ? age : null,
    missing: missing,
    fresh: fresh,
    /* the engine's own flag still forces it; everything else is the ported rule */
    stale: !fresh || !!entry.stale
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
  /* past its ttl it is not a reading, so it neither boosts nor penalises */
  if (sentiment.stale) return baseConfidence;

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
  /* A stale read must not BLOCK a trade either. This gate can push a major
     conflict into CRYPTO SCAN's quality gates, and a six-day-old headline
     score is not grounds for vetoing a setup any more than it is grounds for
     promoting one. Both directions of the asymmetry close here. */
  if (sentiment.stale){
    return {
      shouldTrade: true,
      reason: sentiment.missing
        ? 'no sentiment data'
        : 'sentiment stale (' + hgSentimentAgeLabel(sentiment) + ' old, ttl '
            + sentiment.ttl + 's) \u2014 not scored, not gating',
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

  /* No row at all is not the same thing as a row that has gone cold, and
     neither is a directional read. Both used to fall through to the score
     ladder below and come back "bullish lean" on a number the engine would
     have refused. */
  if (sentiment && sentiment.missing) return {
    cls: 'stale',
    label: '— no sentiment data',
    title: 'no sentiment row for this symbol — layer 3 contributes nothing'
  };

  if (sentiment && sentiment.stale) return {
    cls: 'stale',
    label: '⏱️ (stale · ' + hgSentimentAgeLabel(sentiment) + ')',
    title: 'sentiment ' + hgSentimentAgeLabel(sentiment) + ' old against a '
      + ((sentiment && sentiment.ttl) || SENTIMENT_TTL_DEFAULT) + 's ttl — not scored, '
      + 'waiting for engine refresh'
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

  /* the stale badge already carries the age; do not print it twice */
  if (sentiment.timestamp && !sentiment.stale){
    html += ' (' + hgSentimentAgeLabel(sentiment) + ' ago)';
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
G.HG_SENTIMENT = HG_SENTIMENT;   /* test seam: lets a harness seed the cache */
G.hgSentimentLoad = hgSentimentLoad;
G.hgSentimentGet = hgSentimentGet;
G.hgSentimentAgeLabel = hgSentimentAgeLabel;
G.hgSentimentCacheFresh = hgSentimentCacheFresh;
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
