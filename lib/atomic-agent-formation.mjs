/* HARDGATE — full formation pipeline for server atomic scan (post-gate + hgFormTicket). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGateEngines } from './atomic-agent-gates.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let __formationLoaded = false;

function loadScript(ctx, file){
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}

function ensureFormationCtx(){
  var ctx = loadGateEngines();
  if (!__formationLoaded){
    loadScript(ctx, 'formation.js');
    __formationLoaded = true;
  }
  return ctx;
}

function setupRr(hit){
  if (!hit) return null;
  if (Number.isFinite(+hit.rr)) return +hit.rr;
  if (Number.isFinite(+hit.rr1)) return +hit.rr1;
  var e = +hit.entry, s = +hit.stop, t1 = +hit.t1;
  if (Number.isFinite(e) && Number.isFinite(s) && Number.isFinite(t1) && e !== s){
    return Math.abs(t1 - e) / Math.abs(e - s);
  }
  return null;
}

/**
 * Mirror browser runScan: hgPostGateSetupVeto → hgFormTicket.
 * Returns null when veto/formation rejects; shaped hit on success.
 */
export async function applyAtomicFormation(hit, ctx){
  ctx = ctx || {};
  try{
    if (!hit || !hit.dir) return null;
    var rows = ctx.rows;
    if (!rows || !rows.length) return null;
    var style = String(ctx.style || 'swing').toLowerCase();
    var ticker = ctx.ticker || {
      symbol: ctx.sym,
      fundingPct: ctx.fundingPct,
      mark: ctx.mark,
    };
    var G = ensureFormationCtx();

    if (typeof G.hgPostGateSetupVeto === 'function'){
      var qv = await G.hgPostGateSetupVeto(ticker, hit, rows, style, null);
      if (!qv || !qv.ok) return null;
      hit = Object.assign({}, hit, {
        flowDetail: qv.flowDetail,
        flowNA: qv.flowNA,
        flowOk: qv.flowOk,
        crossOk: qv.crossOk,
        rsEdge: qv.rsEdge,
      });
    }

    if (typeof G.hgFormTicket === 'function'){
      var fm = G.hgFormTicket(hit, {
        rows: rows,
        style: style,
        a4: hit.a4,
        m15: ctx.m15 || rows,
        ticker: ticker,
      });
      if (!fm || !fm.ok || !fm.hit) return null;
      hit = fm.hit;
    }

    var minRr = style === 'scalp' ? 2.25 : 2.0;
    var rr = setupRr(hit);
    if (rr != null && rr < minRr) return null;
    if (!Number.isFinite(+hit.entry) || !Number.isFinite(+hit.stop) || !Number.isFinite(+hit.t1)) return null;
    if (+hit.entry === +hit.stop) return null;
    return hit;
  }catch(e){
    return null;
  }
}
