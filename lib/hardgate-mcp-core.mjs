/* HARDGATE — read-only MCP-style desk tools (eliza / QuantDinger observation layer). */

export const HARDGATE_MCP_TOOLS = [
  { name: 'hardgate_status', description: 'Daemon/trading halt and risk flags' },
  { name: 'hardgate_brain_summary', description: 'Last BRAIN tier counts (requires ctx)' },
  { name: 'hardgate_desk_merge', description: 'OpenBB + CCXT + Hey desk snapshot merge' },
  { name: 'hardgate_gate_replay_hint', description: 'Gate replay OOS hint from samples' },
];

export function hardgateMcpCapabilities(){
  return {
    ok: true,
    tools: HARDGATE_MCP_TOOLS,
    route: '/api/hardgate/mcp',
  };
}

export function hardgateDeskMerge(ctx){
  ctx = ctx || {};
  return {
    at: Date.now(),
    openbb: ctx.openbb || ctx.desk || null,
    ccxt: ctx.ccxt || null,
    hey: ctx.hey || null,
    fundingArb: ctx.fundingArb || null,
  };
}

export function hardgateMcpCallTool(name, args, ctx){
  args = args || {};
  ctx = ctx || {};
  switch(name){
    case 'hardgate_status':
      return {
        ok: true,
        halt: !!(process.env.HARDGATE_TRADING_HALT === '1' || process.env.HARDGATE_KILL_SWITCH === '1'),
        dryRun: process.env.HARDGATE_DAEMON_DRY_RUN === '1',
        fqsGate: process.env.HARDGATE_FQS_GATE === '1',
        edgeGate: process.env.HARDGATE_EDGE_GATE === '1',
      };
    case 'hardgate_desk_merge':
      return { ok: true, desk: hardgateDeskMerge(ctx) };
    case 'hardgate_gate_replay_hint':
      return { ok: true, note: 'Use /api/hardgate/replay-oos with gate replay samples', gate: args.gate || 'G6' };
    case 'hardgate_brain_summary':
      return { ok: true, brain: ctx.brain || { note: 'pass brain rows in server ctx' } };
    default:
      return { ok: false, reason: 'unknown tool: ' + name };
  }
}
