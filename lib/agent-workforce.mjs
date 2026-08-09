/* HARDGATE — server-side agent desk merge (API fetches + client reports). */
import { AGENT_ROSTER, agentById } from './agent-roster.mjs';
import { getAgentStateStore } from './agent-state.mjs';

function fin(v){ return typeof v === 'number' && isFinite(v); }

function scoreFindings(findings){
  var list = Array.isArray(findings) ? findings : [];
  var score = 0;
  for (var i = 0; i < list.length; i++){
    var f = list[i];
    if (!f) continue;
    if (f.clean7 || f.clean === true) score += 12;
    else if (f.nearClean) score += 6;
    else if (fin(+f.score)) score += Math.min(10, +f.score);
    else score += 2;
  }
  return score;
}

function mergeAgentReports(storedAgents, clientAgents){
  var out = {};
  var ids = {};
  var src = storedAgents || {};
  var cli = clientAgents || {};
  for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) ids[k] = true;
  for (var k2 in cli) if (Object.prototype.hasOwnProperty.call(cli, k2)) ids[k2] = true;
  for (var id in ids){
    var a = Object.assign({}, src[id] || {}, cli[id] || {});
    if (!a.agentId) a.agentId = id;
    if (!a.label){
      var meta = agentById(id);
      if (meta) a.label = meta.label;
    }
    out[id] = a;
  }
  return out;
}

function topFindings(agents, limit){
  var all = [];
  for (var id in agents){
    if (!Object.prototype.hasOwnProperty.call(agents, id)) continue;
    var ag = agents[id];
    var finds = Array.isArray(ag.findings) ? ag.findings : [];
    for (var i = 0; i < finds.length; i++){
      all.push(Object.assign({ agentId: id, agentLabel: ag.label || id }, finds[i]));
    }
  }
  all.sort(function(a, b){
    var sa = (a.clean7 ? 100 : 0) + (fin(+a.score) ? +a.score : 0) + (a.prime ? 20 : 0);
    var sb = (b.clean7 ? 100 : 0) + (fin(+b.score) ? +b.score : 0) + (b.prime ? 20 : 0);
    return sb - sa;
  });
  return all.slice(0, limit || 12);
}

export function finalizeAgentDesk(partial){
  partial = partial || {};
  var agents = partial.agents || {};
  var cryptoFinds = [];
  var goldFinds = [];
  for (var id in agents){
    if (!Object.prototype.hasOwnProperty.call(agents, id)) continue;
    var finds = Array.isArray(agents[id].findings) ? agents[id].findings : [];
    for (var i = 0; i < finds.length; i++){
      var f = finds[i];
      if (!f) continue;
      if (f.asset === 'gold' || /GOLD|XAU|XAUT|PAXG/i.test(String(f.sym || ''))) goldFinds.push(f);
      else cryptoFinds.push(f);
    }
  }
  var swarmScore = 0;
  for (var j = 0; j < AGENT_ROSTER.length; j++){
    var rid = AGENT_ROSTER[j].id;
    var rep = agents[rid];
    if (rep && rep.ok !== false) swarmScore += scoreFindings(rep.findings);
  }
  return {
    at: partial.at || new Date().toISOString(),
    source: partial.source || 'merged',
    swarmScore: Math.min(100, Math.round(swarmScore / 2)),
    agentCount: Object.keys(agents).length,
    cryptoSetups: cryptoFinds.length,
    goldSetups: goldFinds.length,
    topFindings: topFindings(agents, 12),
    agents: agents,
    serverContext: partial.serverContext || null,
  };
}

export async function fetchServerContext(baseUrl){
  baseUrl = (baseUrl || 'http://127.0.0.1:10000').replace(/\/?$/, '');
  var ctx = { wm: null, ccxt: null, hey: null, errors: [] };
  async function pull(path){
    try{
      var res = await fetch(baseUrl + path, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    }catch(e){
      ctx.errors.push(path + ': ' + ((e && e.message) || e));
      return null;
    }
  }
  var wm = await pull('/api/worldmonitor/desk');
  if (wm && wm.ok && wm.desk) ctx.wm = wm.desk;
  var ccxt = await pull('/api/ccxt/desk');
  if (ccxt && ccxt.ok && ccxt.desk) ctx.ccxt = ccxt.desk;
  var hey = await pull('/api/hey/desk');
  if (hey && hey.ok && hey.desk) ctx.hey = hey.desk;
  return ctx;
}

export function buildDeskFromStore(clientDesk){
  var store = getAgentStateStore();
  store.load();
  var stored = store.getAgents();
  var mergedAgents = mergeAgentReports(stored, clientDesk && clientDesk.agents ? clientDesk.agents : null);
  if (clientDesk && clientDesk.agents){
    for (var id in clientDesk.agents){
      if (Object.prototype.hasOwnProperty.call(clientDesk.agents, id)){
        mergedAgents[id] = Object.assign({}, mergedAgents[id] || {}, clientDesk.agents[id]);
      }
    }
  }
  return finalizeAgentDesk({
    at: (clientDesk && clientDesk.at) || store.state.updatedAt || new Date().toISOString(),
    source: clientDesk ? 'browser+store' : 'store',
    agents: mergedAgents,
    serverContext: store.state.desk && store.state.desk.serverContext ? store.state.desk.serverContext : null,
  });
}

export async function buildFullDesk(baseUrl){
  var store = getAgentStateStore();
  store.load();
  var ctx = await fetchServerContext(baseUrl);
  var desk = buildDeskFromStore(null);
  desk.serverContext = ctx;
  desk.at = new Date().toISOString();
  return desk;
}
