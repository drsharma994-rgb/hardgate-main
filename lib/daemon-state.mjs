/* HARDGATE — daemon state persistence (JSON file, SQLite-free). */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = process.env.HARDGATE_STATE_FILE || 'hardgate-daemon-state.json';

export class StateDatabase {
  constructor(filePath){
    this.filePath = path.resolve(filePath || DEFAULT_FILE);
    this.state = { version: 1, convictions: [], orders: [], outcomes: [], updatedAt: null };
  }

  _read(){
    try{
      if (!fs.existsSync(this.filePath)) return;
      var raw = fs.readFileSync(this.filePath, 'utf8');
      var j = JSON.parse(raw);
      if (j && typeof j === 'object'){
        this.state = {
          version: j.version || 1,
          convictions: Array.isArray(j.convictions) ? j.convictions : [],
          orders: Array.isArray(j.orders) ? j.orders : [],
          outcomes: Array.isArray(j.outcomes) ? j.outcomes : [],
          updatedAt: j.updatedAt || null,
        };
      }
    }catch(e){ /* corrupt file — start fresh in memory */ }
  }

  _write(){
    try{
      this.state.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2) + '\n', 'utf8');
    }catch(e){ /* never throw */ }
  }

  async loadStateOnBoot(){
    this._read();
    return this.state;
  }

  saveConviction(id, setup){
    try{
      if (!id || !setup) return;
      var rec = Object.assign({ id: String(id) }, setup);
      var idx = -1;
      for (var i = 0; i < this.state.convictions.length; i++){
        if (this.state.convictions[i] && this.state.convictions[i].id === id){ idx = i; break; }
      }
      if (idx >= 0) this.state.convictions[idx] = rec;
      else this.state.convictions.push(rec);
      this._write();
    }catch(e){}
  }

  removeConviction(id){
    try{
      this.state.convictions = this.state.convictions.filter(function(c){ return c && c.id !== id; });
      this._write();
    }catch(e){}
  }

  saveOrder(order){
    try{
      if (!order || !order.orderId) return;
      this.state.orders.push(Object.assign({ at: Date.now() }, order));
      if (this.state.orders.length > 500) this.state.orders = this.state.orders.slice(-500);
      this._write();
    }catch(e){}
  }

  recordOutcome(rec){
    try{
      if (!rec || !isFinite(+rec.r)) return;
      this.state.outcomes.push({
        sym: String(rec.sym || ''),
        r: +rec.r,
        closedAt: +rec.closedAt || Date.now(),
        reason: rec.reason ? String(rec.reason) : null,
        fpKey: rec.fpKey ? String(rec.fpKey) : null,
        side: rec.side ? String(rec.side) : null,
        poiKind: rec.poiKind ? String(rec.poiKind) : null,
        regime: rec.regime ? String(rec.regime) : null,
      });
      if (this.state.outcomes.length > 500) this.state.outcomes = this.state.outcomes.slice(-500);
      this._write();
    }catch(e){}
  }

  recentOutcomes(n){
    try{
      var arr = this.state.outcomes || [];
      return arr.slice(Math.max(0, arr.length - (n || 100)));
    }catch(e){ return []; }
  }
}
