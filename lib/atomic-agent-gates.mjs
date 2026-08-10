/* HARDGATE — load cryptogates swing/scalp engines for server atomic scan. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let __loaded = false;
let __ctx = null;

function loadScript(ctx, file){
  var src = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

export function loadGateEngines(){
  if (__loaded && __ctx) return __ctx;
  __ctx = vm.createContext({
    window: {},
    globalThis: {},
    console: console,
  });
  __ctx.window = __ctx;
  __ctx.globalThis = __ctx;
  loadScript(__ctx, 'indicators.js');
  loadScript(__ctx, 'indicators2.js');
  loadScript(__ctx, 'plans.js');
  loadScript(__ctx, 'cryptogates.js');
  __loaded = true;
  return __ctx;
}

export function trySwingClean(rows, ticker){
  var ctx = loadGateEngines();
  if (typeof ctx.swingTryClean !== 'function') return null;
  try{
    return ctx.swingTryClean(rows, ticker);
  }catch(e){
    return null;
  }
}

export function tryScalpClean(rows1h, rows15m, ticker){
  var ctx = loadGateEngines();
  if (typeof ctx.scalpTryClean !== 'function') return null;
  try{
    return ctx.scalpTryClean(rows1h, rows15m, ticker);
  }catch(e){
    return null;
  }
}

export function trySwingNear(rows, ticker){
  var ctx = loadGateEngines();
  if (typeof ctx.swingTryNear !== 'function') return null;
  try{
    return ctx.swingTryNear(rows, ticker);
  }catch(e){
    return null;
  }
}
