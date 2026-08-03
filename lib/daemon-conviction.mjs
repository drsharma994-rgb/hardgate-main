/* Load conviction-lock.js ConvictionLockManager in Node (no browser). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

export function loadConvictionLockManager(){
  var ctx = vm.createContext({ console: console });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  var src = fs.readFileSync(path.join(ROOT, 'conviction-lock.js'), 'utf8');
  var script = new vm.Script(src, { filename: 'conviction-lock.js' });
  script.runInContext(ctx);
  var Mgr = ctx.ConvictionLockManager;
  if (typeof Mgr !== 'function') throw new Error('ConvictionLockManager not exported from conviction-lock.js');
  return Mgr;
}

export function hydrateConvictionManager(mgr, state){
  if (!mgr || !state || !Array.isArray(state.convictions)) return mgr;
  for (var i = 0; i < state.convictions.length; i++){
    var rec = state.convictions[i];
    if (rec && rec.id) mgr.hydrateFromRecord(rec, rec.id);
  }
  return mgr;
}
