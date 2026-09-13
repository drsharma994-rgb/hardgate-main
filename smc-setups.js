/* HARDGATE — smc-setups.js — Smart Money Concepts context on every setup.

   Hooks the shared choke points every desk already passes through (solidity
   apply, solidity chip, pine signal enrich) so any row that carries its candles
   gets row.smc — structure bias, zone confluence, a grade — and an SMC_CONTEXT
   signal lands in Setup Intelligence. Record-only: solidity score and tier are
   never changed by this file. Tabs can also call hgSmcEnrich(row, { rows }). */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var DEFAULT_SWING = 10;
var seen = {}, seenCount = 0;
var ctxCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

function num(v){ var n = +v; return isFinite(n) ? n : null; }
function dirOf(row){
  var d = String(row.dir || row.direction || row.side || '').toLowerCase();
  if (d === 'long' || d === 'buy') return 'long';
  if (d === 'short' || d === 'sell') return 'short';
  return null;
}
function symOf(row){ return String(row.sym || row.symbol || row.pair || '').toUpperCase(); }
function tabOf(row, opts){
  var t = (opts && opts.tab) || row.tab || row.tabName || row.desk || row.scanner || 'UNKNOWN';
  return String(t).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'UNKNOWN';
}
function candlesOf(row, opts){
  var r = (opts && opts.rows) || row.rows || row.candles || row.bars || row.ohlc;
  return Array.isArray(r) ? r : null;
}
function swingOf(opts){
  var s = Math.floor(+((opts && opts.swingLength) || W.HG_SMC_SWING || DEFAULT_SWING));
  return (isFinite(s) && s >= 1) ? s : DEFAULT_SWING;
}
function lastT(rows){ var r = rows[rows.length - 1]; return r ? num(r.t) : null; }

function contextFor(rows, sl){
  var hit = ctxCache && ctxCache.get(rows);
  var lt = lastT(rows);
  if (hit && hit.sl === sl && hit.n === rows.length && hit.lastT === lt) return hit.ctx;
  var ctx = W.hgSmc.context(rows, { swingLength: sl });
  if (ctxCache){ try{ ctxCache.set(rows, { sl: sl, n: rows.length, lastT: lt, ctx: ctx }); }catch(e){} }
  return ctx;
}

function hgSmcEnrich(row, opts){
  if (!row || typeof row !== 'object' || !W.hgSmc || typeof W.hgSmc.context !== 'function') return row;
  try{
    var rows = candlesOf(row, opts);
    var sl = swingOf(opts);
    if (!rows || rows.length < 2 * sl + 2) return row;
    var dir = dirOf(row);
    if (!dir) return row;
    var ctx = contextFor(rows, sl);
    if (!ctx) return row;
    var t1 = row.t1 != null ? row.t1 : row.tp1;
    var conf = W.hgSmc.confluence({ dir: dir, entry: row.entry, stop: row.stop, t1: t1 }, ctx);
    row.smc = {
      version: W.hgSmc.version, swingLength: sl, lastT: ctx.lastT,
      bias: ctx.bias, structure: ctx.structure,
      score: conf.score, grade: conf.grade, tags: conf.tags,
      activeOb: ctx.ob.active.length, activeFvg: ctx.fvg.active.length, unsweptLiq: ctx.liquidity.unswept.length,
      retrace: ctx.retrace, prevHL: ctx.prevHL, sessions: ctx.sessions
    };
    record(row, dir, ctx, conf, opts);
  }catch(e){}
  return row;
}

function record(row, dir, ctx, conf, opts){
  var rec = W.setupRecording;
  if (!rec || typeof rec.recordSignal !== 'function') return;
  var sym = symOf(row);
  var key = [sym, dir, num(row.entry), ctx.lastT, conf.score].join('|');
  if (seen[key]) return;
  if (seenCount >= 2000){ seen = {}; seenCount = 0; }
  seen[key] = 1; seenCount++;
  var ids = [];
  for (var i = 0; i < conf.tags.length; i++) ids.push(conf.tags[i].id);
  rec.recordSignal(tabOf(row, opts), {
    type: 'SMC_CONTEXT', symbol: sym, direction: dir.toUpperCase(),
    entry: num(row.entry), stop: num(row.stop), t1: num(row.t1 != null ? row.t1 : row.tp1),
    bias: ctx.bias, structure: ctx.structure, score: conf.score, grade: conf.grade, tags: ids, sessions: ctx.sessions
  });
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function hgSmcChipHtml(row){
  try{
    var s = row && row.smc;
    if (!s || typeof s.score !== 'number') return '';
    var cls = s.grade === 'STRONG' ? 'pass' : (s.grade === 'WITH' ? 'ok' : (s.grade === 'AGAINST' ? 'bad' : 'warn'));
    var parts = [];
    for (var i = 0; i < (s.tags || []).length; i++){ var t = s.tags[i]; parts.push(t.id + ' ' + (t.pts > 0 ? '+' : '') + t.pts); }
    var title = 'SMC ' + s.grade + ' · bias ' + (s.bias || 'n/a') + (parts.length ? ' · ' + parts.join(', ') : ' · no zone confluence');
    return '<span class="stamp ' + cls + '" style="margin-left:6px" title="' + esc(title) + '">SMC ' + (s.score > 0 ? '+' : '') + s.score + '</span>';
  }catch(e){ return ''; }
}

function wrapOnce(name, make){
  var orig = W[name];
  if (typeof orig !== 'function' || orig.__smcWrapped) return false;
  var w = make(orig);
  w.__smcWrapped = true;
  W[name] = w;
  return true;
}
function install(){
  wrapOnce('hgSetupSolidityApply', function(orig){
    return function(row, opts){ var out = orig(row, opts); hgSmcEnrich(row, opts); return out; };
  });
  wrapOnce('hgSetupSolidityChipHtml', function(orig){
    return function(row){ var html = orig(row) || ''; return html + hgSmcChipHtml(row); };
  });
  wrapOnce('pineSubEnrichSignal', function(orig){
    return function(sig, item, res, opts){
      var out = orig(sig, item, res, opts);
      var tab = 'PINE_' + String((sig && sig.scriptId) || 'SUB');
      hgSmcEnrich(out || sig, { tab: tab });
      return out;
    };
  });
}

install();
try{
  if (W.document && typeof W.document.addEventListener === 'function') W.document.addEventListener('DOMContentLoaded', install);
}catch(e){}

W.hgSmcEnrich = hgSmcEnrich;
W.hgSmcChipHtml = hgSmcChipHtml;
W.hgSmcInstall = install;
})();
