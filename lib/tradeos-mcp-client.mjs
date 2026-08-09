/* HARDGATE — TradeOS MCP HTTP client (server-side only).
   Connects to TradeOS Streamable HTTP via @modelcontextprotocol/sdk.
   Token from TRADEOS_ACCESS_TOKEN — never sent to browser. */

import { TRADEOS_MCP_URL, tradeosConfigured, parseTradeosToolResult } from './tradeos-mcp-core.mjs';

const TOOL_TIMEOUT_MS = 120000;
let _client = null;
let _connectPromise = null;

async function loadClient(){
  if (!tradeosConfigured()) return null;
  if (_client) return _client;
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async function(){
    var token = String(process.env.TRADEOS_ACCESS_TOKEN || '').trim();
    var mod = await import('@modelcontextprotocol/sdk/client/index.js');
    var transportMod = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    var Client = mod.Client;
    var StreamableHTTPClientTransport = transportMod.StreamableHTTPClientTransport;
    var transport = new StreamableHTTPClientTransport(new URL(TRADEOS_MCP_URL), {
      requestInit: { headers: { Authorization: 'Bearer ' + token } },
    });
    var client = new Client({ name: 'hardgate', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    _client = client;
    return client;
  })();

  try{
    return await _connectPromise;
  }catch(e){
    _connectPromise = null;
    _client = null;
    throw e;
  }
}

export async function tradeosListTools(){
  var client = await loadClient();
  if (!client) return { ok: false, tools: [], reason: 'TradeOS not configured — set TRADEOS_ACCESS_TOKEN on the server' };
  try{
    var res = await client.listTools({});
    var tools = (res && res.tools) ? res.tools.map(function(t){
      return { name: t.name, description: t.description || '' };
    }) : [];
    return { ok: true, tools: tools, reason: null };
  }catch(e){
    return { ok: false, tools: [], reason: (e && e.message) || 'listTools failed' };
  }
}

export async function tradeosCallTool(name, args){
  var client = await loadClient();
  if (!client){
    return { ok: false, text: null, reason: 'TradeOS not configured — set TRADEOS_ACCESS_TOKEN on the server' };
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, TOOL_TIMEOUT_MS);
  try{
    var result = await client.callTool({ name: String(name), arguments: args || {} });
    var parsed = parseTradeosToolResult(result);
    if (!parsed.ok) return { ok: false, text: null, reason: parsed.reason || 'empty tool response' };
    return { ok: true, text: parsed.text, raw: parsed.raw, reason: null };
  }catch(e){
    var msg = (e && e.name === 'AbortError') ? 'TradeOS tool timeout (' + (TOOL_TIMEOUT_MS / 1000) + 's)' : ((e && e.message) || 'callTool failed');
    if (/unauthorized|401|403/i.test(msg)){
      msg = 'TradeOS unauthorized — refresh TRADEOS_ACCESS_TOKEN (run: npx -y @tradeos/tradeos-mcp oauth)';
    }
    return { ok: false, text: null, reason: msg };
  }finally{
    clearTimeout(timer);
  }
}

export async function tradeosHealth(){
  return tradeosCallTool('mcp_health', {});
}

export function resetTradeosClient(){
  _client = null;
  _connectPromise = null;
}
