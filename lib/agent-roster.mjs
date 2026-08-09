/* HARDGATE — Ruflo-inspired agent workforce roster (role templates, zero-deps). */
export const AGENT_ROSTER = [
  {
    id: 'gate-hunter',
    role: 'trading-strategist',
    label: 'Gate Hunter',
    focus: 'crypto',
    strategies: ['swing 7/7', 'scalp 7/7', 'near 6/7 watch'],
    indicators: ['G1–G7 gates', 'R:R', 'MOST PROBABLE rank'],
    cycleMin: 15,
  },
  {
    id: 'market-analyst',
    role: 'market-analyst',
    label: 'Market Analyst',
    focus: 'crypto+macro',
    strategies: ['regime', 'rotation', 'world monitor macro'],
    indicators: ['BTC.D', 'DXY', 'QQQ/XLP', 'F&G'],
    cycleMin: 15,
  },
  {
    id: 'risk-analyst',
    role: 'risk-analyst',
    label: 'Risk Analyst',
    focus: 'crypto+gold',
    strategies: ['funding stress', 'perp crowding', 'economic stress'],
    indicators: ['HL funding', 'VIX', '10Y-2Y', 'CCXT carry'],
    cycleMin: 15,
  },
  {
    id: 'gold-smith',
    role: 'trading-strategist',
    label: 'Gold Smith',
    focus: 'gold',
    strategies: ['gold scalp', 'gold swing', 'gold pine'],
    indicators: ['SMC/ICT', 'tally', 'conviction lock'],
    cycleMin: 15,
  },
  {
    id: 'pine-scout',
    role: 'trading-strategist',
    label: 'Pine Scout',
    focus: 'crypto',
    strategies: ['pine signals', 'MSB/OB', 'SQZ', 'SMF'],
    indicators: ['pine math', 'ML score', 'fresh bar'],
    cycleMin: 15,
  },
  {
    id: 'strategy-lab',
    role: 'backtest-engineer',
    label: 'Strategy Lab',
    focus: 'crypto',
    strategies: ['EMA cross', 'Connors RSI2', 'Donchian'],
    indicators: ['backtest R', 'win rate', 'live levels'],
    cycleMin: 30,
  },
  {
    id: 'funding-hunter',
    role: 'risk-analyst',
    label: 'Funding Hunter',
    focus: 'crypto',
    strategies: ['carry', 'funding arb', 'basis'],
    indicators: ['CCXT funding', 'term basis', 'arb spread'],
    cycleMin: 15,
  },
  {
    id: 'brain-echo',
    role: 'trading-strategist',
    label: 'Brain Echo',
    focus: 'crypto+gold',
    strategies: ['brain synthesis', 'HIGH/PRIME tiers'],
    indicators: ['layer votes', '7/7 evidence', 'liveOk'],
    cycleMin: 15,
  },
];

export function agentById(id){
  return AGENT_ROSTER.filter(function(a){ return a.id === id; })[0] || null;
}

export function agentCapabilities(env){
  env = env || {};
  return {
    ok: true,
    inspiredBy: 'https://github.com/ruvnet/ruflo',
    attribution: 'Ruflo-inspired role templates · HARDGATE native engines',
    swarmEnabled: env.HARDGATE_AGENT_SWARM === '1' || env.HARDGATE_AGENT_SWARM === 'true',
    agents: AGENT_ROSTER,
    routes: {
      capabilities: '/api/agents/capabilities',
      desk: '/api/agents/desk',
      report: '/api/agents/report',
      swarm: '/api/agents/swarm',
      status: '/api/agents/status',
    },
  };
}
