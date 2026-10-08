// Test script to create demo setups for testing Setup Intelligence Dashboard
const testSetups = [
  {
    symbol: 'GOLD',
    tabName: 'GOLD ULTRA',
    direction: 'LONG',
    pattern: 'EMA_CASCADE',
    entryPrice: 2050.0,
    stopLoss: 2040.0,
    takeProfit1: 2060.0,
    takeProfit2: 2070.0,
    confidence: 0.85,
    tier: 'HIGH_CONVICTION'
  },
  {
    symbol: 'BTC/USDT',
    tabName: 'CRYPTO ULTRA',
    direction: 'SHORT',
    pattern: 'RSI_DIVERGENCE',
    entryPrice: 42500.0,
    stopLoss: 43000.0,
    takeProfit1: 41500.0,
    takeProfit2: 40500.0,
    confidence: 0.75,
    tier: 'STANDARD'
  },
  {
    symbol: 'ETH/USDT',
    tabName: 'CRYPTO SCAN',
    direction: 'LONG',
    pattern: 'VOLUME_SPIKE',
    entryPrice: 2250.0,
    stopLoss: 2230.0,
    takeProfit1: 2270.0,
    takeProfit2: 2300.0,
    confidence: 0.65,
    tier: 'STANDARD'
  }
];

console.log('Test setups created:', testSetups);
module.exports = testSetups;
