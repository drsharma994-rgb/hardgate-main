/* HARDGATE — shadow book persistence (capped JSON file, never throws). */
import fs from 'node:fs';
import path from 'node:path';

export const SHADOW_MAX = 2000;

export function shadowBookPath(env){
  env = env || process.env || {};
  return path.resolve(env.HARDGATE_SHADOW_BOOK || 'data/shadow-book.json');
}

export function loadShadowBook(filePath){
  try{
    var p = filePath || shadowBookPath();
    if (!fs.existsSync(p)) return [];
    var raw = fs.readFileSync(p, 'utf8');
    var j = JSON.parse(raw);
    return Array.isArray(j) ? j : (Array.isArray(j?.rows) ? j.rows : []);
  }catch(e){ return []; }
}

export function saveShadowBook(rows, filePath){
  try{
    var p = filePath || shadowBookPath();
    var dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    var arr = Array.isArray(rows) ? rows.slice(-SHADOW_MAX) : [];
    fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n', 'utf8');
    return arr.length;
  }catch(e){ return 0; }
}

export function shadowPush(row, filePath){
  try{
    if (!row) return loadShadowBook(filePath);
    var rows = loadShadowBook(filePath);
    rows.push(Object.assign({ ts: Date.now() }, row));
    if (rows.length > SHADOW_MAX) rows = rows.slice(-SHADOW_MAX);
    saveShadowBook(rows, filePath);
    return rows;
  }catch(e){ return loadShadowBook(filePath); }
}

export function shadowFromCandidate(cand, vetoGate){
  if (!cand) return null;
  var sym = cand.symbol || cand.sym;
  var entry = cand.entry;
  var stop = cand.stop;
  var target = cand.t1 ?? cand.target;
  if (!sym || !isFinite(+entry) || !isFinite(+stop) || !isFinite(+target)) return null;
  return {
    symbol: String(sym),
    side: cand.side || cand.dir || 'long',
    entry: +entry,
    stop: +stop,
    target: +target,
    vetoGate: String(vetoGate || 'unknown'),
    ts: cand.ts || Date.now(),
    fpKey: cand.fpKey || null,
  };
}
