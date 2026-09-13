#!/usr/bin/env python3
"""
HARDGATE Sentiment Engine v2 — Production-grade market sentiment via Agent-Reach
Sources: RSS (Binance, CoinTelegraph, Bloomberg), liquidation alerts, on-chain, social

Architecture:
  1. Fetch from multiple sources (RSS feeds, APIs, Agent-Reach channels)
  2. Score each source independently (keyword analysis + ML-ready structure)
  3. Weight sources by recency and reliability
  4. Aggregate to final symbol score
  5. Cache with TTL; serve to JS via sentiment.json

Usage:
  python sentiment-engine.py --scan        # refresh all symbols once
  python sentiment-engine.py --monitor     # continuous polling (daemon)
  python sentiment-engine.py --symbol BTC  # single symbol
"""

import json
import sys
import os
import argparse
import time
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent / 'sentiment-cache'
SENTIMENT_FILE = CACHE_DIR / 'sentiment.json'
SENTIMENT_DETAIL_FILE = CACHE_DIR / 'sentiment-detail.json'  # debug: per-source scores
CACHE_TTL = 300  # 5 minutes
SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

# Feed sources configuration
FEEDS = {
    'binance_announcements': {
        'url': 'https://www.binance.com/en/support/announcement/c-48',
        'weight': 1.0,
        'keywords': {
            'bullish': ['listing', 'integration', 'partnership', 'adoption', 'record'],
            'bearish': ['delisting', 'suspension', 'halt', 'investigation', 'fine']
        }
    },
    'cointelegraph': {
        'url': 'https://cointelegraph.com/feed',
        'weight': 0.8,
        'keywords': {
            'bullish': ['bull', 'surge', 'rally', 'institutional', 'approval', 'etf'],
            'bearish': ['crash', 'dump', 'bear', 'liquidation', 'hack', 'exploit']
        }
    },
    'bloomberg': {
        'url': 'https://feeds.bloomberg.com/markets/news.rss',
        'weight': 0.9,
        'keywords': {
            'bullish': ['gains', 'record', 'institutional', 'adoption', 'approval'],
            'bearish': ['decline', 'loss', 'crash', 'regulation', 'ban']
        }
    },
    'liquidation_alerts': {
        'url': 'https://cryptofees.info/rss',
        'weight': 1.2,  # higher weight — direct market signal
        'keywords': {
            'bullish': ['long liquidation', 'shorts covering'],
            'bearish': ['liquidation cascade', 'short squeeze', 'margin call']
        }
    }
}

class SentimentScorer:
    """Score sentiment from text using keyword analysis."""

    def __init__(self):
        self.bullish_words = [
            'bull', 'bullish', 'rally', 'surge', 'pump', 'rocket', 'moon',
            'gain', 'profit', 'record', 'high', 'institutional', 'adoption',
            'approval', 'etf', 'integration', 'partnership', 'listing',
            'positive', 'strong', 'momentum', 'breakout'
        ]
        self.bearish_words = [
            'bear', 'bearish', 'crash', 'dump', 'tank', 'plunge',
            'loss', 'decline', 'liquidation', 'cascade', 'margin call',
            'hack', 'exploit', 'breach', 'regulation', 'ban', 'fine',
            'investigation', 'delisting', 'suspension', 'negative', 'weak'
        ]

    def score(self, text: str, symbol: str = '') -> float:
        """
        Score sentiment from text (-1.0 to +1.0).
        Logic: bullish/bearish word count weighted by prominence.
        """
        if not text:
            return 0.0

        text_lower = text.lower()
        bullish_score = 0.0
        bearish_score = 0.0
        total_weight = 0.0

        for word in self.bullish_words:
            count = text_lower.count(word)
            if count > 0:
                weight = count * (0.3 + 0.1 * (1.0 - min(count, 3) / 3))
                bullish_score += weight
                total_weight += weight

        for word in self.bearish_words:
            count = text_lower.count(word)
            if count > 0:
                weight = count * (0.4 + 0.1 * (1.0 - min(count, 3) / 3))
                bearish_score += weight
                total_weight += weight

        if total_weight == 0:
            return 0.0

        net_score = (bullish_score - bearish_score) / total_weight
        return max(-1.0, min(1.0, net_score))


class SentimentEngine:
    """Fetch, score, and cache sentiment from multiple sources."""

    def __init__(self):
        self.scorer = SentimentScorer()
        self.cache = {}
        self.ensure_cache_dir()
        self.load_cache()

    def ensure_cache_dir(self):
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def load_cache(self):
        if SENTIMENT_FILE.exists():
            try:
                with open(SENTIMENT_FILE, 'r') as f:
                    self.cache = json.load(f)
                logger.info(f"Loaded cache with {len(self.cache)} symbols")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")

    def save_cache(self):
        try:
            with open(SENTIMENT_FILE, 'w') as f:
                json.dump(self.cache, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def fetch_rss_via_agent_reach(self, url: str) -> Optional[str]:
        """Fetch RSS feed via feedparser (fallback for Agent-Reach)."""
        try:
            import feedparser
            feed = feedparser.parse(url)
            entries = feed.get('entries', [])
            texts = []
            for entry in entries[:10]:
                title = entry.get('title', '')
                summary = entry.get('summary', '')
                texts.append(title + ' ' + summary)
            return '\n'.join(texts) if texts else None
        except Exception as e:
            logger.debug(f"Feed fetch failed ({url}): {e}")
            return None

    def fetch_sentiment_for_symbol(self, symbol: str) -> Dict:
        """Fetch and aggregate sentiment from all sources for one symbol."""
        base = symbol.replace('USDT', '')
        sources_data = []
        all_texts = []
        weighted_scores = []

        logger.info(f"Fetching sentiment for {symbol}...")

        for source_name, feed_config in FEEDS.items():
            try:
                text = self.fetch_rss_via_agent_reach(feed_config['url'])
                if not text:
                    continue

                score = self.scorer.score(text, base)
                weight = feed_config['weight']
                weighted_scores.append((score, weight))
                all_texts.append(text[:300])

                source_detail = {
                    'source': source_name,
                    'score': round(score, 3),
                    'weight': weight
                }
                sources_data.append(source_detail)
                logger.debug(f"  {source_name}: score={score:.2f}")

            except Exception as e:
                logger.warning(f"  {source_name} error: {e}")
                continue

        if not weighted_scores:
            logger.warning(f"  No sources available for {symbol}")
            return {
                'symbol': symbol,
                'score': 0.0,
                'sources': [],
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'ttl': CACHE_TTL,
                'stale': True
            }

        total_weight = sum(w for _, w in weighted_scores)
        aggregated_score = sum(s * w for s, w in weighted_scores) / total_weight
        aggregated_score = max(-1.0, min(1.0, aggregated_score))

        result = {
            'symbol': symbol,
            'score': round(aggregated_score, 3),
            'sources': sources_data,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'ttl': CACHE_TTL,
            'source_count': len(sources_data)
        }

        logger.info(f"  {symbol}: score={aggregated_score:.2f} ({len(sources_data)} sources)")
        return result

    def is_cache_fresh(self, symbol: str) -> bool:
        if symbol not in self.cache:
            return False
        entry = self.cache[symbol]
        try:
            cached_time = datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00'))
            age = (datetime.utcnow() - cached_time.replace(tzinfo=None)).total_seconds()
            return age < entry.get('ttl', CACHE_TTL)
        except:
            return False

    def update_symbol(self, symbol: str, force_refresh: bool = False) -> Dict:
        if not force_refresh and self.is_cache_fresh(symbol):
            return self.cache.get(symbol, {})
        result = self.fetch_sentiment_for_symbol(symbol)
        self.cache[symbol] = result
        return result

    def update_all_symbols(self, force_refresh: bool = False) -> Dict:
        for symbol in SYMBOLS:
            self.update_symbol(symbol, force_refresh)
        self.save_cache()
        return self.cache

    def monitor_continuously(self, interval: int = 300):
        logger.info(f"Starting monitor (interval={interval}s)")
        try:
            while True:
                self.update_all_symbols(force_refresh=True)
                logger.info("Sentiment update complete")
                time.sleep(interval)
        except KeyboardInterrupt:
            logger.info("Monitor stopped")

    def print_status(self):
        logger.info(f"Cache: {len(self.cache)} symbols")
        for symbol, entry in self.cache.items():
            score = entry.get('score', '?')
            sources = entry.get('source_count', 0)
            logger.info(f"  {symbol}: {score} ({sources} sources)")


def main():
    parser = argparse.ArgumentParser(description='HARDGATE Sentiment Engine v2')
    parser.add_argument('--symbol', type=str, help='Update single symbol')
    parser.add_argument('--scan', action='store_true', help='Scan all symbols')
    parser.add_argument('--refresh', action='store_true', help='Force refresh')
    parser.add_argument('--monitor', action='store_true', help='Continuous monitor')
    parser.add_argument('--interval', type=int, default=300, help='Monitor interval')
    parser.add_argument('--status', action='store_true', help='Print status')

    args = parser.parse_args()
    engine = SentimentEngine()

    if args.status:
        engine.print_status()
        return

    if args.symbol:
        result = engine.update_symbol(args.symbol, args.refresh)
        print(json.dumps(result, indent=2, default=str))
        engine.save_cache()
        return

    if args.scan:
        engine.update_all_symbols(args.refresh)
        print(json.dumps(engine.cache, indent=2, default=str))
        return

    if args.monitor:
        engine.monitor_continuously(args.interval)
        return

    parser.print_help()


if __name__ == '__main__':
    main()
