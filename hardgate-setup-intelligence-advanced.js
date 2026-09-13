/* =========================================================================
   HARDGATE Setup Intelligence - Advanced Analytics

   Extends the base setup intelligence system with:
   - Market condition detection (trending, ranging, volatile, calm)
   - Anomaly detection (outlier trades using z-score)
   - Confidence level analysis (which confidence thresholds work?)
   - Risk/Reward optimization
   - Pattern correlation analysis
   ========================================================================= */
'use strict';

class HardgateSetupIntelligenceAdvanced {
  constructor(setupIntelligence) {
    this.engine = setupIntelligence;
    this.analysis = {
      marketConditions: {},
      anomalies: [],
      confidenceLevels: {},
      riskRewardOptimal: null,
      patternCorrelations: {}
    };
  }

  /* ===== MARKET CONDITION DETECTION ===== */

  /**
   * Detect current market condition based on recent closed setups
   * Returns: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, CALM
   */
  detectMarketCondition(lookbackSetups = 20) {
    const closedSetups = this.engine.getClosedSetups().slice(-lookbackSetups);

    if (closedSetups.length < 5) {
      return 'INSUFFICIENT_DATA';
    }

    // Calculate metrics
    const longWins = closedSetups.filter(s => s.direction === 'LONG' && s.outcome && s.outcome.includes('TP')).length;
    const shortWins = closedSetups.filter(s => s.direction === 'SHORT' && s.outcome && s.outcome.includes('TP')).length;
    const totalWins = longWins + shortWins;
    const winRate = totalWins / closedSetups.length;

    // Calculate volatility (std dev of R/R ratios)
    const riskRewards = closedSetups.map(s => s.riskReward || 1);
    const meanRR = riskRewards.reduce((a, b) => a + b) / riskRewards.length;
    const variance = riskRewards.reduce((sum, rr) => sum + Math.pow(rr - meanRR, 2), 0) / riskRewards.length;
    const stdDev = Math.sqrt(variance);

    // Classify condition
    if (winRate > 0.70 && longWins > shortWins * 1.5) {
      return 'TRENDING_UP';
    }
    if (winRate > 0.70 && shortWins > longWins * 1.5) {
      return 'TRENDING_DOWN';
    }
    if (Math.abs(longWins - shortWins) < closedSetups.length * 0.2) {
      return 'RANGING';
    }
    if (stdDev > meanRR * 0.5) {
      return 'VOLATILE';
    }

    return 'CALM';
  }

  /**
   * Get market condition history
   */
  getMarketConditionHistory(windowSize = 10) {
    const allSetups = this.engine.getClosedSetups();
    const conditions = [];

    for (let i = 0; i < allSetups.length; i += windowSize) {
      const window = allSetups.slice(i, i + windowSize);
      if (window.length >= 3) {
        const longWins = window.filter(s => s.direction === 'LONG' && s.outcome && s.outcome.includes('TP')).length;
        const shortWins = window.filter(s => s.direction === 'SHORT' && s.outcome && s.outcome.includes('TP')).length;
        const winRate = (longWins + shortWins) / window.length;

        let condition = 'UNKNOWN';
        if (winRate > 0.70 && longWins > shortWins) condition = 'TRENDING_UP';
        else if (winRate > 0.70 && shortWins > longWins) condition = 'TRENDING_DOWN';
        else if (Math.abs(longWins - shortWins) < window.length * 0.2) condition = 'RANGING';
        else condition = 'CALM';

        conditions.push({
          startIndex: i,
          endIndex: i + windowSize,
          setups: window.length,
          condition: condition,
          winRate: (winRate * 100).toFixed(1) + '%'
        });
      }
    }

    return conditions.slice(-10); // Last 10 windows
  }

  /* ===== ANOMALY DETECTION ===== */

  /**
   * Detect outlier trades using z-score analysis
   * Returns: setup objects with z-scores above threshold (default 2.5)
   */
  detectAnomalies(threshold = 2.5) {
    const closedSetups = this.engine.getClosedSetups();

    if (closedSetups.length < 10) {
      return [];
    }

    // Calculate z-scores for multiple metrics
    const pnls = closedSetups.map(s => Math.abs(s.pnl || 0));
    const rrs = closedSetups.map(s => s.riskReward || 1);
    const durations = closedSetups.map(s => s.duration || 0);

    const anomalies = [];

    closedSetups.forEach(setup => {
      const pnlZScore = this.calculateZScore(Math.abs(setup.pnl || 0), pnls);
      const rrZScore = this.calculateZScore(setup.riskReward || 1, rrs);
      const durationZScore = this.calculateZScore(setup.duration || 0, durations);

      const maxZScore = Math.max(pnlZScore, rrZScore, durationZScore);

      if (maxZScore > threshold) {
        anomalies.push({
          setupId: setup.id,
          symbol: setup.symbol,
          pattern: setup.pattern,
          outcome: setup.outcome,
          pnl: setup.pnl,
          riskReward: setup.riskReward,
          duration: setup.duration,
          anomalyScores: {
            pnl: pnlZScore.toFixed(2),
            rr: rrZScore.toFixed(2),
            duration: durationZScore.toFixed(2)
          },
          maxAnomalyScore: maxZScore.toFixed(2),
          type: this.classifyAnomaly(pnlZScore, rrZScore, durationZScore)
        });
      }
    });

    return anomalies.sort((a, b) => parseFloat(b.maxAnomalyScore) - parseFloat(a.maxAnomalyScore));
  }

  calculateZScore(value, population) {
    const mean = population.reduce((a, b) => a + b) / population.length;
    const variance = population.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / population.length;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : Math.abs((value - mean) / stdDev);
  }

  classifyAnomaly(pnlZScore, rrZScore, durationZScore) {
    if (pnlZScore > 2.5) return 'EXTREME_PNL';
    if (rrZScore > 2.5) return 'EXTREME_RISK_REWARD';
    if (durationZScore > 2.5) return 'EXTREME_DURATION';
    return 'ANOMALY';
  }

  /* ===== CONFIDENCE LEVEL ANALYSIS ===== */

  /**
   * Analyze win rate by confidence level
   * Returns: performance breakdown by confidence buckets
   */
  analyzeByConfidenceLevel() {
    const buckets = {
      veryLow: { range: [0.0, 0.4], total: 0, wins: 0, patterns: {} },
      low: { range: [0.4, 0.6], total: 0, wins: 0, patterns: {} },
      medium: { range: [0.6, 0.75], total: 0, wins: 0, patterns: {} },
      high: { range: [0.75, 0.9], total: 0, wins: 0, patterns: {} },
      veryHigh: { range: [0.9, 1.0], total: 0, wins: 0, patterns: {} }
    };

    const closedSetups = this.engine.getClosedSetups();

    closedSetups.forEach(setup => {
      const conf = setup.confidence || 0.5;
      let bucket = null;

      if (conf < 0.4) bucket = 'veryLow';
      else if (conf < 0.6) bucket = 'low';
      else if (conf < 0.75) bucket = 'medium';
      else if (conf < 0.9) bucket = 'high';
      else bucket = 'veryHigh';

      buckets[bucket].total++;
      if (setup.outcome && setup.outcome.includes('TP')) {
        buckets[bucket].wins++;
      }

      // Track patterns within confidence level
      const pattern = setup.pattern || 'UNKNOWN';
      if (!buckets[bucket].patterns[pattern]) {
        buckets[bucket].patterns[pattern] = { total: 0, wins: 0 };
      }
      buckets[bucket].patterns[pattern].total++;
      if (setup.outcome && setup.outcome.includes('TP')) {
        buckets[bucket].patterns[pattern].wins++;
      }
    });

    // Calculate rates
    const analysis = {};
    Object.entries(buckets).forEach(([key, bucket]) => {
      if (bucket.total > 0) {
        const winRate = (bucket.wins / bucket.total * 100).toFixed(1);
        const topPattern = Object.entries(bucket.patterns)
          .map(([pat, stats]) => ({ pattern: pat, winRate: stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : 0 }))
          .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))[0];

        analysis[key] = {
          range: bucket.range,
          totalSetups: bucket.total,
          closedSetups: bucket.total,
          winRate: winRate + '%',
          topPattern: topPattern?.pattern || 'N/A',
          topPatternWinRate: topPattern?.winRate + '%'
        };
      }
    });

    return analysis;
  }

  /**
   * Get optimal confidence threshold for this trader/tab
   */
  getOptimalConfidenceThreshold() {
    const analysis = this.analyzeByConfidenceLevel();
    let optimalBucket = null;
    let maxWinRate = 0;

    Object.entries(analysis).forEach(([bucket, stats]) => {
      const winRate = parseFloat(stats.winRate);
      if (winRate > maxWinRate) {
        maxWinRate = winRate;
        optimalBucket = bucket;
      }
    });

    if (!optimalBucket) {
      return { threshold: 0.5, reasoning: 'insufficient data' };
    }

    const thresholds = {
      veryLow: 0.3,
      low: 0.5,
      medium: 0.675,
      high: 0.825,
      veryHigh: 0.95
    };

    return {
      threshold: thresholds[optimalBucket],
      bucket: optimalBucket,
      winRate: maxWinRate.toFixed(1) + '%',
      recommendation: `Only trade setups with confidence >= ${thresholds[optimalBucket]}`
    };
  }

  /* ===== RISK/REWARD OPTIMIZATION ===== */

  /**
   * Find optimal risk/reward configuration
   */
  analyzeRiskReward() {
    const closedSetups = this.engine.getClosedSetups();

    if (closedSetups.length < 10) {
      return { status: 'insufficient_data', dataPoints: closedSetups.length };
    }

    // Group by R/R buckets
    const buckets = {};
    closedSetups.forEach(setup => {
      const rr = Math.round(setup.riskReward * 2) / 2; // Round to 0.5
      if (!buckets[rr]) {
        buckets[rr] = { total: 0, wins: 0 };
      }
      buckets[rr].total++;
      if (setup.outcome && setup.outcome.includes('TP')) {
        buckets[rr].wins++;
      }
    });

    // Calculate stats for each bucket
    const analysis = {};
    Object.entries(buckets).forEach(([rr, stats]) => {
      if (stats.total >= 3) { // Only analyze with 3+ samples
        analysis[rr] = {
          rrRatio: parseFloat(rr),
          totalSetups: stats.total,
          winRate: (stats.wins / stats.total * 100).toFixed(1) + '%',
          expectation: (parseFloat(rr) * (stats.wins / stats.total) - 1).toFixed(2)
        };
      }
    });

    // Find optimal
    let optimalRR = null;
    let maxExpectation = -999;

    Object.entries(analysis).forEach(([_, stats]) => {
      const expect = parseFloat(stats.expectation);
      if (expect > maxExpectation) {
        maxExpectation = expect;
        optimalRR = stats.rrRatio;
      }
    });

    return {
      optimalRiskReward: optimalRR,
      expectationValue: maxExpectation.toFixed(2),
      allBuckets: analysis,
      recommendation: optimalRR ? `Favor setups with ${optimalRR}:1 risk/reward ratio` : 'Insufficient data'
    };
  }

  /* ===== PATTERN CORRELATION ===== */

  /**
   * Analyze which patterns work together (consensus)
   */
  analyzePatternConsensus() {
    const today = this.engine.getTodaySetups();
    const bySymbol = {};

    today.forEach(setup => {
      if (!bySymbol[setup.symbol]) {
        bySymbol[setup.symbol] = [];
      }
      bySymbol[setup.symbol].push(setup.pattern);
    });

    const consensus = [];
    Object.entries(bySymbol).forEach(([symbol, patterns]) => {
      if (patterns.length > 1) {
        consensus.push({
          symbol: symbol,
          patterns: [...new Set(patterns)],
          agreement: patterns.length,
          uniquePatterns: new Set(patterns).size
        });
      }
    });

    return {
      consensusSignals: consensus.length,
      signals: consensus,
      description: `${consensus.length} symbols with multiple pattern agreement today`
    };
  }

  /* ===== COMPREHENSIVE ANALYSIS ===== */

  /**
   * Generate complete advanced analysis report
   */
  generateAdvancedReport() {
    return {
      timestamp: new Date().toISOString(),

      // Market condition
      currentMarketCondition: this.detectMarketCondition(),
      marketHistory: this.getMarketConditionHistory(),

      // Anomalies
      detectedAnomalies: this.detectAnomalies(),
      anomaliesCount: this.detectAnomalies().length,

      // Confidence analysis
      confidenceAnalysis: this.analyzeByConfidenceLevel(),
      optimalConfidenceThreshold: this.getOptimalConfidenceThreshold(),

      // Risk/Reward
      riskRewardAnalysis: this.analyzeRiskReward(),

      // Pattern consensus
      patternConsensus: this.analyzePatternConsensus(),

      // Recommendations
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  generateRecommendations() {
    const recommendations = [];

    // Market condition recommendation
    const condition = this.detectMarketCondition();
    if (condition === 'TRENDING_UP') {
      recommendations.push('Market trending up: favor LONG setups, avoid shorting');
    } else if (condition === 'TRENDING_DOWN') {
      recommendations.push('Market trending down: favor SHORT setups, avoid longs');
    } else if (condition === 'RANGING') {
      recommendations.push('Market ranging: set tighter stops, expect reversals at levels');
    } else if (condition === 'VOLATILE') {
      recommendations.push('High volatility: widen stops, increase position sizing caution');
    }

    // Confidence recommendation
    const confThreshold = this.getOptimalConfidenceThreshold();
    recommendations.push(`Confidence filter: ${confThreshold.recommendation}`);

    // Risk/Reward recommendation
    const rrAnalysis = this.analyzeRiskReward();
    if (rrAnalysis.optimalRiskReward) {
      recommendations.push(`Risk/Reward: ${rrAnalysis.recommendation}`);
    }

    // Anomaly recommendation
    const anomalies = this.detectAnomalies();
    if (anomalies.length > 0) {
      const extremeCount = anomalies.length;
      recommendations.push(`Detected ${extremeCount} anomalous trades - review for pattern improvements`);
    }

    return recommendations;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligenceAdvanced;
}

if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligenceAdvanced = HardgateSetupIntelligenceAdvanced;
}
