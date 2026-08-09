/* HARDGATE — agent workforce state (in-memory + optional JSON persistence). */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = process.env.HARDGATE_AGENT_STATE_FILE || 'hardgate-agent-state.json';

function emptyState(){
  return {
    version: 1,
    updatedAt: null,
    lastSwarmAt: null,
    lastSwarmOk: null,
    swarmBusy: false,
    agents: {},
    desk: null,
  };
}

export class AgentStateStore {
  constructor(filePath){
    this.filePath = path.resolve(filePath || DEFAULT_FILE);
    this.state = emptyState();
  }

  _read(){
    try{
      if (!fs.existsSync(this.filePath)) return;
      var raw = fs.readFileSync(this.filePath, 'utf8');
      var j = JSON.parse(raw);
      if (!j || typeof j !== 'object') return;
      this.state = Object.assign(emptyState(), j, {
        agents: j.agents && typeof j.agents === 'object' ? j.agents : {},
      });
    }catch(e){ /* corrupt — keep in-memory */ }
  }

  _write(){
    try{
      this.state.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2) + '\n', 'utf8');
    }catch(e){ /* never throw */ }
  }

  load(){
    this._read();
    return this.state;
  }

  setSwarmBusy(busy){
    this.state.swarmBusy = !!busy;
    this._write();
  }

  recordSwarmResult(result){
    this.state.lastSwarmAt = new Date().toISOString();
    this.state.lastSwarmOk = !!(result && result.ok);
    this.state.swarmBusy = false;
    if (result && result.desk) this.state.desk = result.desk;
    if (result && result.agents){
      for (var id in result.agents){
        if (Object.prototype.hasOwnProperty.call(result.agents, id)){
          this.state.agents[id] = result.agents[id];
        }
      }
    }
    this._write();
  }

  ingestReport(report){
    if (!report || typeof report !== 'object') return;
    var at = report.at || new Date().toISOString();
    if (report.agentId){
      this.state.agents[report.agentId] = Object.assign({}, report, { at: at });
    }
    if (report.desk) this.state.desk = report.desk;
    if (report.agents && typeof report.agents === 'object'){
      for (var id in report.agents){
        if (Object.prototype.hasOwnProperty.call(report.agents, id)){
          this.state.agents[id] = Object.assign({}, report.agents[id], { at: at });
        }
      }
    }
    this._write();
  }

  getDesk(){
    return this.state.desk;
  }

  getAgents(){
    return this.state.agents;
  }

  status(){
    return {
      updatedAt: this.state.updatedAt,
      lastSwarmAt: this.state.lastSwarmAt,
      lastSwarmOk: this.state.lastSwarmOk,
      swarmBusy: this.state.swarmBusy,
      agentCount: Object.keys(this.state.agents).length,
    };
  }
}

let __singleton = null;

export function getAgentStateStore(){
  if (!__singleton) __singleton = new AgentStateStore();
  return __singleton;
}
