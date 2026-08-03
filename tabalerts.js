/* =========================================================================
HARDGATE — tabalerts.js
TELEGRAM SETUP ALERTS for tab scanners: crypto SWING, crypto SCALP, EDGE,
BRAIN (HIGH/PRIME with plans), GOLD SCALP + GOLD SWING (tally ≥ threshold).

Runs on the 15-min alert cycle (index.html runAlertCycle) after quiet scans,
and on hgalert's 60s evaluate() for live BRAIN/GOLD reads between cycles.
Dedup: one push per setup key (source:sym:dir@entry) per 15 minutes via
localStorage hg_tabalert_keys. PRIME / very-high confluence lines are tagged
🔥 in the message body.

Never throws at load or at push time. Absent scan seams degrade to empty
contributions — normal when a tab has not run yet.

TEST/DIAGNOSTIC SURFACE (Node tests import the pure helpers):
  hgTabAlertsCollect(W)  -> normalized setup rows
  hgTabAlertsFresh(prev, list, now, gapMs) -> {fresh, keys}
  hgTabAlertsFormat(fresh) -> telegram body string
  hgTabAlertsRun(W, opts)  -> async {pushed, fresh, keys}
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var LS_KEYS = 'hg_tabalert_keys';
var GAP_MS = 15 * 60 * 1000;
var GOLD_MIN_TALLY = 10;
var EDGE_STRONG_TALLY = 5;
var SITE = 'https://hardgate-main.onrender.com/';

function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

function rowsFrom(val){
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object'){
    var keys = ['rows', 'cands', 'results', 'cards', 'setups'];
    for (var i = 0; i < keys.length; i++){
      if (Array.isArray(val[keys[i]])) return val[keys[i]];
    }
  }
  return [];
}

function pushSetup(out, src, row, extra){
  if (!row || typeof row !== 'object') return;
  var sym = row.sym || row.symbol;
  var dir = row.dir;
  if (!sym || (dir !== 'long' && dir !== 'short')) return;
  var entry = row.entry, stop = row.stop, t1 = row.t1;
  if (!fin(+entry) || !fin(+stop) || !fin(+t1) || +entry === +stop) return;
  var o = {
    src: String(src || ''),
    sym: String(sym),
    dir: String(dir),
    entry: +entry,
    stop: +stop,
    t1: +t1,
    t2: fin(+row.t2) ? +row.t2 : null,
    rr: fin(+row.rr) ? +row.rr : null,
    tally: fin(+row.tally) ? +row.tally : null,
    tier: row.tier ? String(row.tier).toUpperCase() : null,
    prime: false
  };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
  if (o.tier === 'PRIME' || (o.tally !== null && o.tally >= 12)
      || (o.src.indexOf('EDGE') >= 0 && o.tally !== null && o.tally >= EDGE_STRONG_TALLY + 1)){
    o.prime = true;
  }
  out.push(o);
}

function collectCrypto(out, kind, src){
  var fn = gfn(kind === 'swing' ? 'swingScan' : 'scalpScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var cands = rowsFrom(val);
  for (var i = 0; i < cands.length; i++) pushSetup(out, src, cands[i]);
}

function collectEdge(out){
  var fn = gfn('edgeScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var cands = rowsFrom(val);
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (c && fin(+c.tally) && +c.tally < 3) continue;
    pushSetup(out, 'EDGE', c, { tally: c && c.tally });
  }
}

function collectBrain(out){
  var fn = gfn('__hgBrainLast');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var rows = rowsFrom(val);
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.plan) continue;
    var tier = String(r.tier || '').toUpperCase();
    if (tier !== 'HIGH' && tier !== 'PRIME') continue;
    pushSetup(out, 'BRAIN ' + tier, {
      sym: r.sym, dir: r.dir,
      entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, t2: r.plan.t2,
      tier: tier
    });
  }
}

function collectPine(out){
  var fn = gfn('pineScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    var s = sigs[i];
    if (!s || !s.isNew) continue;
    pushSetup(out, 'PINE ML', {
      sym: s.sym, dir: s.dir,
      entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2,
      rr: s.rr
    }, { prime: true, tier: 'PINE', mlScore: s.smoothedScore });
  }
}

function collectPineMsb(out){
  var fn = gfn('pineMsbScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    var s = sigs[i];
    if (!s || !s.isNew) continue;
    pushSetup(out, 'PINE MSB/OB', {
      sym: s.sym, dir: s.dir,
      entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2,
      rr: s.rr
    }, { prime: true, tier: 'MSB' });
  }
}

function collectGold(out, kind, src, minTally){
  var fn = gfn(kind === 'scalp' ? 'goldscalpScan' : 'goldswingScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var cands = rowsFrom(val);
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (!c || c.vetoed) continue;
    var t = fin(+c.tally) ? +c.tally : null;
    if (t === null || t < minTally) continue;
    pushSetup(out, src, c, { tally: t });
  }
}

function pushWatch(out, src, row){
  if (!row || typeof row !== 'object') return;
  if (row.state !== 'armed') return;
  var sym = row.sym;
  var dir = row.dir;
  if (!sym || (dir !== 'long' && dir !== 'short')) return;
  var lvl = fin(+row.level) ? +row.level : null;
  if (lvl === null) return;
  var stop = dir === 'long' ? lvl * 0.985 : lvl * 1.015;
  var t1 = dir === 'long' ? lvl * 1.02 : lvl * 0.98;
  out.push({
    src: String(src || 'WATCH'),
    sym: String(sym),
    dir: String(dir),
    entry: lvl,
    stop: stop,
    t1: t1,
    t2: null,
    rr: null,
    tally: row.gatesPassed || null,
    tier: 'WATCH',
    prime: false,
    watch: true,
    note: row.condition || row.reason || 'forming — not CLEAN yet'
  });
}

function collectCryptoWatch(out){
  try{
    var cw = W.__hgCryptoWatch;
    if (!cw || typeof cw !== 'object') return;
    ['swing', 'scalp'].forEach(function(kind){
      var bag = cw[kind];
      if (!bag || !Array.isArray(bag.items)) return;
      var src = kind === 'swing' ? 'SWING WATCH' : 'SCALP WATCH';
      for (var i = 0; i < bag.items.length; i++) pushWatch(out, src, bag.items[i]);
    });
  }catch(e){}
}

function hgTabAlertsCollect(win){
  var out = [];
  var root = win || W;
  var saved = W;
  if (win) W = root;
  try{
    collectCrypto(out, 'swing', 'SWING');
    collectCrypto(out, 'scalp', 'SCALP');
    collectCryptoWatch(out);
    collectEdge(out);
    collectBrain(out);
    collectPine(out);
    collectPineMsb(out);
    var goldMin = GOLD_MIN_TALLY;
    try{
      var gn = parseInt((root.localStorage && root.localStorage.getItem('hgAlertGoldMin')) || '', 10);
      if (isFinite(gn) && gn >= 1 && gn <= 99) goldMin = gn;
    }catch(e){}
    collectGold(out, 'scalp', 'GOLD SCALP', goldMin);
    collectGold(out, 'swing', 'GOLD SWING', goldMin);
  }finally{
    if (win) W = saved;
  }
  return out;
}

function setupKey(s){
  if (s.watch) return s.src + ':watch:' + s.sym + ':' + s.dir + '@' + (s.tally || s.gatesPassed || 0);
  return s.src + ':' + s.sym + ':' + s.dir + '@' + s.entry;
}

function hgTabAlertsFresh(prevKeys, list, now, gapMs){
  var keys = {}, fresh = [];
  var gap = (gapMs > 0) ? gapMs : GAP_MS;
  var cutoff = now - gap;
  var prev = prevKeys || {};
  for (var k in prev){
    if (!Object.prototype.hasOwnProperty.call(prev, k)) continue;
    var t = +prev[k];
    if (isFinite(t) && t > cutoff) keys[k] = t;
  }
  for (var i = 0; i < (list || []).length; i++){
    var s = list[i];
    var key = setupKey(s);
    if (keys[key] === undefined){
      fresh.push(s);
      keys[key] = now;
    }
  }
  return { fresh: fresh, keys: keys };
}

function levHint(entry, stop){
  var e = +entry, st = +stop;
  if (!fin(e) || !fin(st) || e <= 0) return '';
  var riskPct = Math.abs(e - st) / e;
  if (!(riskPct > 0)) return '';
  var lev = Math.max(1, Math.min(30, Math.floor(0.01 / riskPct)));
  return ' · lev ~' + lev + 'x';
}

function hgTabAlertsFormat(fresh){
  var lines = [];
  for (var i = 0; i < (fresh || []).length; i++){
    var s = fresh[i];
    var tag = s.prime ? '🔥 ' : (s.watch ? '👁 ' : '· ');
    var extra = '';
    if (s.watch && s.note) extra = ' · ' + s.note;
    if (s.tally !== null) extra += ' · tally ' + (s.tally > 0 ? '+' : '') + s.tally;
    if (s.tier) extra += ' · ' + s.tier;
    if (s.rr !== null) extra += ' · ' + Number(s.rr).toFixed(2) + 'R';
    lines.push(tag + s.sym + ' ' + s.dir.toUpperCase() + ' [' + s.src + ']'
      + ' @ ' + s.entry + ' · SL ' + s.stop + ' · TP ' + s.t1
      + (s.t2 !== null ? ' · T2 ' + s.t2 : '')
      + levHint(s.entry, s.stop) + extra);
  }
  if (!lines.length) return '';
  var hdr = fresh.length === 1
    ? (fresh[0].prime ? '🔥 HARDGATE — STRONG SETUP' : '📊 HARDGATE — SETUP')
    : (fresh.some(function(x){ return x.prime; })
        ? '🔥 HARDGATE — ' + fresh.length + ' SETUPS (incl. strong)'
        : '📊 HARDGATE — ' + fresh.length + ' SETUPS');
  return hdr + '\n' + lines.join('\n')
    + '\nlev ~Nx = stop-out ≈ 1% of account (cap 30x)'
    + '\n' + SITE;
}

function loadKeys(root){
  try{
    if (root && root.localStorage){
      var raw = root.localStorage.getItem(LS_KEYS);
      return raw ? JSON.parse(raw) : {};
    }
    var raw2 = null;
    try{ raw2 = localStorage.getItem(LS_KEYS); }catch(e){}
    return raw2 ? JSON.parse(raw2) : {};
  }catch(e){ return {}; }
}

function saveKeys(keys, root){
  try{
    var s = JSON.stringify(keys || {});
    if (root && root.localStorage) root.localStorage.setItem(LS_KEYS, s);
    else localStorage.setItem(LS_KEYS, s);
  }catch(e){}
}

async function pushTelegram(text){
  var tg = gfn('sendTelegram');
  if (!tg) return 'not-configured';
  try{
    var r = await tg(text);
    return r === true ? 'sent' : String(r);
  }catch(e){ return 'error'; }
}

async function hgTabAlertsRun(opts){
  opts = opts || {};
  var root = opts.window || W;
  var list = hgTabAlertsCollect(root);
  if (opts.sources && typeof opts.sources === 'object' && !Array.isArray(opts.sources)){
    var allow = opts.sources;
    list = list.filter(function(s){
      if (s.src.indexOf('BRAIN') >= 0 && allow.brain) return true;
      if (s.src.indexOf('SWING') >= 0 && allow.swing) return true;
      if (s.src.indexOf('SCALP') >= 0 && allow.scalp) return true;
      if (s.src === 'EDGE' && allow.edge) return true;
      if (s.src.indexOf('GOLD') >= 0 && allow.gold) return true;
      return false;
    });
  }
  var now = Date.now();
  var prev = opts.prevKeys || loadKeys(root);
  var gap = opts.gapMs || GAP_MS;
  var fr = hgTabAlertsFresh(prev, list, now, gap);
  if (!fr.fresh.length){
    return { pushed: 0, fresh: [], keys: fr.keys, status: 'none-new' };
  }
  var body = hgTabAlertsFormat(fr.fresh);
  if (!body) return { pushed: 0, fresh: [], keys: fr.keys, status: 'empty-body' };
  if (opts.dryRun) return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'dry-run', body: body };
  var push = await pushTelegram(body);
  if (push === 'sent'){
    saveKeys(fr.keys, root);
    try{
      if (typeof W.__hgLastEmail === 'object'){
        W.__hgLastEmail = { ok: true, err: null, ts: now, channel: 'telegram-tab' };
      }
    }catch(e){}
    return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'sent' };
  }
  var nt = gfn('sendAlertPush');
  if (nt){
    try{
      await nt(fr.fresh[0].prime ? 'HARDGATE STRONG SETUP' : 'HARDGATE SETUP', body,
        { priority: fr.fresh[0].prime ? 5 : 4 });
      saveKeys(fr.keys, root);
      return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'ntfy-fallback' };
    }catch(e){}
  }
  return { pushed: 0, fresh: fr.fresh, keys: prev, status: 'push-failed:' + push };
}

/* browser globals */
W.hgTabAlertsCollect = function(){ return hgTabAlertsCollect(W); };
W.hgTabAlertsRun = function(opts){ return hgTabAlertsRun(opts || {}); };
W.hgTabAlertsCheckLive = function(){
  return hgTabAlertsRun({ sources: { brain: true, gold: true, edge: true } });
};
W.hgTabAlertsRunEdge = function(opts){
  opts = opts || {};
  return hgTabAlertsRun(Object.assign({ sources: { edge: true } }, opts));
};

/* Node test / CI exports */
if (typeof module !== 'undefined' && module.exports){
  module.exports = { hgTabAlertsCollect, hgTabAlertsFresh, hgTabAlertsFormat,
    setupKey, GAP_MS, GOLD_MIN_TALLY, LS_KEYS };
}

})();
