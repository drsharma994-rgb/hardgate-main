#!/usr/bin/env python3
"""
HARDGATE Sentiment Engine — pulls crypto market sentiment via Agent-Reach
Monitors: Binance announcements, exchange liquidations, news feeds, social signals
Output: JSON sentiment cache for JS consumption

Usage:
  python sentiment-engine.py --symbol BTCUSDT --refresh
  python sentiment-engine.py --scan  (pull all SCAN symbols)
  python sentiment-engine.py --monitor  (continuous polling)
"""

import json
import sys
import os
import argparse
import time
from datetime import datetime, timedelta
from pathlib import Path
import subprocess

# Agent-Reach channels to monitor
CHANNELS = {
    'binance_announcements': {
        'url': 'https://www.binance.com/en/support/announcement/c-48',
        'type': 'rss',
        'keywords': ['BTC', 'ETH', 'SOL', 'liquidation', 'maintenance', 'delisting'],
        'sentiment_bias': 0.0  # neutral unless keywords trigger
    },
    'crypto_news': {
        'url': 'https://feeds.bloomberg.com/markets/news.rss',  # or CoinTelegraph
        'type': 'rss',
        'keywords': ['Bitcoin', 'Ethereum', 'crypto', 'market', 'crash', 'rally'],
        'sentiment_bias': 0.0
    },
    'liquidation_alerts': {
        'url': 'https://example.com/liquidations.rss',  # placeholder
        'type': 'rss',
        'keywords': ['liquidation', 'cascade', 'bearish'],
        'sentiment_bias': -0.5  # liquidations = bearish
    }
}

SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
CACHE_DIR = Path(__file__).parent / 'sentiment-cache'
CACHE_TTL = 300  # 5 minutes between refreshes per symbol
SENTIMENT_FILE = CACHE_DIR / 'sentiment.json'

def ensure_cache_dir():
    """Create cache directory if missing."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

def load_sentiment_cache():
    """Load existing sentiment cache or return empty dict."""
    if SENTIMENT_FILE.exists():
        try:
            with open(SENTIMENT_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_sentiment_cache(data):
    """Save sentiment cache to JSON."""
    ensure_cache_dir()
    with open(SENTIMENT_FILE, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def fetch_sentiment_via_agent_reach(symbol, channel='rss'):
    """
    Fetch sentiment data via agent-reach RSS.
    Returns: { symbol: str, score: float (-1 to +1), text: str, timestamp: str, ttl: int }
    """
    try:
        # For MVP: fetch general crypto news via RSS
        # Real implementation would poll specific feeds per symbol
        query = symbol.replace('USDT', '')  # BTC, ETH, SOL, etc.

        result = subprocess.run(
            ['python', '-m', 'agent_reach', 'get', channel,
             '--url', 'https://feeds.bloomberg.com/markets/news.rss',
             '--limit', '5'],
            capture_output=True, text=True, timeout=10
        )

        if result.returncode != 0:
            # Fallback: return neutral sentiment if fetch fails
            return {
                'symbol': symbol,
                'score': 0.0,
                'text': '(sentiment data unavailable)',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'ttl': CACHE_TTL,
                'stale': True
            }

        text = result.stdout.strip()
        if not text:
            return None

        # Parse output and score sentiment
        sentiment_score = score_sentiment_text(text, query)

        return {
            'symbol': symbol,
            'score': sentiment_score,
            'text': text[:500],  # first 500 chars
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'ttl': CACHE_TTL
        }
    except subprocess.TimeoutExpired:
        print(f"  timeout fetching {symbol}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  error fetching {symbol}: {e}", file=sys.stderr)
        return None

def score_sentiment_text(text, symbol):
    """
    Score sentiment from text (-1.0 = very bearish, +1.0 = very bullish).
    Simple keyword-based scoring for MVP.
    """
    text_lower = text.lower()
    score = 0.0
    weight = 0.0

    bullish = ['bull', 'rally', 'surge', 'record', 'gain', 'pump', 'institutional', 'adoption']
    bearish = ['crash', 'liquidation', 'cascade', 'sell-off', 'bearish', 'decline', 'bear', 'dump']
    neutral = ['update', 'maintenance', 'announcement', 'change']

    for word in bullish:
        count = text_lower.count(word)
        score += count * 0.3
        weight += count

    for word in bearish:
        count = text_lower.count(word)
        score -= count * 0.4
        weight += count

    for word in neutral:
        count = text_lower.count(word)
        weight += count

    if weight == 0:
        return 0.0

    final_score = score / weight if weight > 0 else 0.0
    return max(-1.0, min(1.0, final_score))  # clamp to [-1, +1]

def is_cache_fresh(symbol, cache):
    """Check if cached sentiment for symbol is still fresh."""
    if symbol not in cache:
        return False
    entry = cache[symbol]
    if 'timestamp' not in entry or 'ttl' not in entry:
        return False
    cached_time = datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00'))
    age = (datetime.utcnow() - cached_time.replace(tzinfo=None)).total_seconds()
    return age < entry['ttl']

def update_symbol_sentiment(symbol, cache, force_refresh=False):
    """Fetch and cache sentiment for one symbol."""
    if not force_refresh and is_cache_fresh(symbol, cache):
        return cache.get(symbol)

    print(f"Fetching sentiment for {symbol}...", file=sys.stderr)
    result = fetch_sentiment_via_agent_reach(symbol)

    if result:
        cache[symbol] = result
        print(f"  {symbol}: score={result['score']:.2f}", file=sys.stderr)
    else:
        # Keep old entry but mark as stale
        if symbol in cache:
            cache[symbol]['stale'] = True

    return result

def update_all_symbols(force_refresh=False):
    """Fetch sentiment for all SCAN symbols."""
    cache = load_sentiment_cache()

    for symbol in SYMBOLS:
        update_symbol_sentiment(symbol, cache, force_refresh)

    save_sentiment_cache(cache)
    return cache

def continuous_monitor(interval=60):
    """Run sentiment updates on a schedule."""
    print(f"Starting sentiment monitor (interval={interval}s)", file=sys.stderr)
    while True:
        try:
            update_all_symbols(force_refresh=True)
            print(f"[{datetime.utcnow().isoformat()}] sentiment updated", file=sys.stderr)
            time.sleep(interval)
        except KeyboardInterrupt:
            print("Monitor stopped.", file=sys.stderr)
            break
        except Exception as e:
            print(f"Monitor error: {e}", file=sys.stderr)
            time.sleep(interval)

def main():
    parser = argparse.ArgumentParser(
        description='HARDGATE sentiment engine via Agent-Reach'
    )
    parser.add_argument('--symbol', type=str, help='Update single symbol')
    parser.add_argument('--scan', action='store_true', help='Update all SCAN symbols')
    parser.add_argument('--refresh', action='store_true', help='Force refresh cache')
    parser.add_argument('--monitor', action='store_true', help='Run continuous monitoring')
    parser.add_argument('--interval', type=int, default=60, help='Monitor interval (seconds)')
    parser.add_argument('--show', action='store_true', help='Print current cache')

    args = parser.parse_args()

    if args.show:
        cache = load_sentiment_cache()
        print(json.dumps(cache, indent=2, default=str))
        return

    if args.symbol:
        cache = load_sentiment_cache()
        update_symbol_sentiment(args.symbol, cache, args.refresh)
        save_sentiment_cache(cache)
        print(json.dumps(cache.get(args.symbol, {}), indent=2, default=str))
        return

    if args.scan:
        cache = update_all_symbols(args.refresh)
        print(json.dumps(cache, indent=2, default=str))
        return

    if args.monitor:
        continuous_monitor(args.interval)
        return

    parser.print_help()

if __name__ == '__main__':
    main()
