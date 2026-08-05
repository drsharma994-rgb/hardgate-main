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
var LS_LAST_RUN = 'hg_tabalert_last_run';
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

function tabAlertSourcesAll(){
  return {
    swing: true, scalp: true, brain: true, gold: true, edge: true, pine: true,
    smart: true, oiflow: true, liqs: true, squeeze: true, carry: true,
    termbasis: true, watch: true
  };
}

function tabAlertsShouldRun(root, force){
  if (force) return true;
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (!ls) return true;
    var t = parseInt(ls.getItem(LS_LAST_RUN) || '0', 10);
    return !(isFinite(t) && t > 0) || (Date.now() - t >= GAP_MS);
  }catch(e){ return true; }
}

function tabAlertsMarkRun(root){
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (ls) ls.setItem(LS_LAST_RUN, String(Date.now()));
  }catch(e){}
}

function collectCrypto(out, kind, src){
  var fn = gfn(kind === 'swing' ? 'swingScan' : 'scalpScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var cands = rowsFrom(val);
  var minRr = kind === 'swing' ? 2.5 : 2.25;
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    var rr = fin(+c.rr) ? +c.rr : (fin(+c.rr1) ? +c.rr1 : NaN);
    if (fin(rr) && rr < minRr) continue;
    pushSetup(out, src, c);
  }
}

function collectEdge(out){
  var fn = gfn('edgeScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var cands = rowsFrom(val);
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (c && fin(+c.tally) && +c.tally < 6) continue;
    if (c && fin(+c.barAge) && +c.barAge > 0) continue;
    pushSetup(out, 'EDGE', c, { tally: c && c.tally });
  }
}

function collectEdgeForming(out){
  var fn = gfn('edgeScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var forming = (val && Array.isArray(val.forming)) ? val.forming : [];
  for (var i = 0; i < forming.length; i++){
    var w = forming[i];
    if (!w || !w.sym || (w.dir !== 'long' && w.dir !== 'short')) continue;
    if (!fin(+w.level) || !fin(+w.mark)) continue;
    if (fin(+w.distAtr) && +w.distAtr > 1.25) continue;
    pushWatch(out, 'EDGE FORMING', {
      state: 'armed',
      sym: w.sym,
      dir: w.dir,
      level: +w.level,
      condition: w.note || 'SWING bias — waiting for 4H trigger',
      gatesPassed: fin(+w.distAtr) ? Math.max(0, Math.round((1.25 - +w.distAtr) * 4)) : 1
    });
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

function pinePushSignal(out, src, s, extra){
  if (!s || (!s.isNew && !s.isRecent)) return;
  extra = extra || {};
  var tier = extra.tier || 'PINE';
  if (!s.isNew) tier = tier + ' FORMING';
  pushSetup(out, src, {
    sym: s.sym, dir: s.dir,
    entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2,
    rr: s.rr
  }, Object.assign({}, extra, { prime: true, tier: tier }));
}

function collectPine(out){
  var fn = gfn('pineScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE', sigs[i], { tier: 'PINE', mlScore: sigs[i].smoothedScore });
  }
}

function collectPineMsb(out){
  var fn = gfn('pineMsbScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE MSB/OB', sigs[i], { tier: 'MSB' });
  }
}

function collectPineSqz(out){
  var fn = gfn('pineSqzScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE SQZ', sigs[i], { tier: 'SQZ', mlScore: sigs[i].momentum });
  }
}

function collectPineSmf(out){
  var fn = gfn('pineSmfScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE SMF', sigs[i], { tier: 'SMF', mlScore: sigs[i].smf });
  }
}

function collectPineHt(out){
  var fn = gfn('pineHtScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE HT', sigs[i], { tier: 'HT' });
  }
}

function collectPineSmc(out){
  var fn = gfn('pineSmcScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE SMC', sigs[i], { tier: 'SMC' });
  }
}

function collectPineCipher(out){
  var fn = gfn('pineCipherScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE CIPHER', sigs[i], { tier: 'CIPHER' });
  }
}

function collectPineRf(out){
  var fn = gfn('pineRfScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE RF', sigs[i], { tier: 'RF' });
  }
}

function collectPineNw(out){
  var fn = gfn('pineNwScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE NW', sigs[i], { tier: 'NW' });
  }
}

function collectPineAvwap(out){
  var fn = gfn('pineAvwapScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var sigs = (val && val.signals) ? val.signals : [];
  for (var i = 0; i < sigs.length; i++){
    pinePushSignal(out, 'PINE AVWAP', sigs[i], { tier: 'AVWAP' });
  }
}

function collectGoldPine(out, minScore){
  minScore = minScore !== undefined ? +minScore : 6;
  var fn = gfn('goldPineScan');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  if (!val) return;
  var kinds = [{ key: 'swing', src: 'GOLD PINE SWING' }, { key: 'scalp', src: 'GOLD PINE SCALP' }];
  for (var k = 0; k < kinds.length; k++){
    var list = val[kinds[k].key];
    if (!Array.isArray(list)) continue;
    for (var i = 0; i < list.length; i++){
      var c = list[i];
      if (!c || !fin(+c.score) || +c.score < minScore) continue;
      pushSetup(out, kinds[k].src, {
        sym: c.sym || 'XAUUSD',
        dir: c.dir,
        entry: c.entry,
        stop: c.stop,
        t1: c.t1,
        t2: c.t2,
        rr: c.rr,
        tally: c.score,
        grade: c.grade
      }, { tally: c.score, tier: c.grade || 'PINE' });
    }
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
  var srcStr = String(src || '');
  if ((srcStr.indexOf('SWING') >= 0 || srcStr.indexOf('SCALP') >= 0)
      && fin(+row.gatesPassed) && +row.gatesPassed < 6) return;
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

function collectSmart(out){
  var bag = W.__hgSmartResults;
  if (!bag || !Array.isArray(bag.results)) return;
  for (var i = 0; i < bag.results.length; i++){
    var r = bag.results[i];
    if (!r || !r.setup) continue;
    var s = r.setup;
    if (s.dir !== 'long' && s.dir !== 'short') continue;
    if (!fin(+s.entry) || !fin(+s.stop) || !fin(+s.t1)) continue;
    pushSetup(out, 'SMART $', {
      sym: r.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2, rr: s.rr1
    }, { prime: !!s.confirmed, tier: s.confirmed ? 'CONFIRMED' : 'SMART' });
  }
}

function collectOiflow(out){
  var fn = gfn('oiflowState');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var rows = (val && val.results) ? val.results : [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.setup) continue;
    var d = (r.setup.dir || (r.cls && r.cls.dir));
    if (d !== 'long' && d !== 'short') continue;
    var s = r.setup;
    if (!fin(+s.entry) || !fin(+s.stop) || !fin(+s.t1)) continue;
    pushSetup(out, 'OI FLOW', { sym: r.sym, dir: d, entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2 },
      { prime: (r.cls && fin(+r.cls.score) && +r.cls.score >= 4), tier: 'OI' });
  }
}

function collectLiqs(out){
  var fn = gfn('liqsState');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var s = val && val.setup;
  if (!s || (s.dir !== 'long' && s.dir !== 'short')) return;
  if (!fin(+s.entry) || !fin(+s.stop) || !fin(+s.t1)) return;
  pushSetup(out, 'LIQS', {
    sym: s.sym || 'FLUSH', dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2
  }, { prime: true, tier: 'LIQ FLUSH' });
}

function collectSqueeze(out){
  var fn = gfn('squeezeState');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var rows = (val && val.results) ? val.results : [];
  var planFn = gfn('squeezePlan');
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || (r.kind !== 'fired' && r.kind !== 'break')) continue;
    if (r.dir !== 'long' && r.dir !== 'short') continue;
    var p = null;
    if (planFn){
      try{ p = planFn({ sym: r.sym, dir: r.dir, cls: r.cls, rows4h: r.rows4h, rows1h: r.rows1h }); }catch(eP){}
    }
    if (!p || !fin(+p.entry) || !fin(+p.stop) || !fin(+p.t1)) continue;
    pushSetup(out, 'SQUEEZE', { sym: r.sym, dir: r.dir, entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2 },
      { prime: r.kind === 'fired', tier: r.kind === 'fired' ? 'FIRED' : 'BREAK' });
  }
}

function collectCarry(out){
  var fn = gfn('carryState');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var tc = val && val.topCard;
  if (!tc || !fin(+tc.spreadAPR) || +tc.spreadAPR < 25) return;
  var lv = tc.levels || {};
  if (!fin(+lv.entry) || !fin(+lv.stop) || !fin(+lv.t1)) return;
  pushSetup(out, 'CARRY', {
    sym: String(tc.base || 'CARRY') + 'USD',
    dir: 'short',
    entry: +lv.entry, stop: +lv.stop, t1: +lv.t1, t2: fin(+lv.t2) ? +lv.t2 : null
  }, { prime: +tc.spreadAPR >= 40, tier: 'SPREAD ' + Math.round(+tc.spreadAPR) + '% APR' });
}

function collectTermBasisWatch(out){
  var fn = gfn('termBasisState');
  if (!fn) return;
  var val = null;
  try{ val = fn(); }catch(e){ return; }
  var top = val && val.top;
  if (!top || !top.pair) return;
  var reg = String(top.regime || '').toLowerCase();
  pushWatch(out, 'TERM BASIS', {
    state: 'watch',
    sym: top.pair,
    dir: (reg.indexOf('back') >= 0) ? 'long' : 'short',
    level: fin(+top.spreadCur) ? +top.spreadCur : 0,
    condition: (top.regime || 'curve') + ' · score ' + (top.score != null ? top.score : '—')
  });
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
    collectEdgeForming(out);
    collectBrain(out);
    collectPine(out);
    collectPineMsb(out);
    collectPineSqz(out);
    collectPineSmf(out);
    collectPineHt(out);
    collectPineSmc(out);
    collectPineCipher(out);
    collectPineRf(out);
    collectPineNw(out);
    collectPineAvwap(out);
    var goldMin = GOLD_MIN_TALLY;
    try{
      var gn = parseInt((root.localStorage && root.localStorage.getItem('hgAlertGoldMin')) || '', 10);
      if (isFinite(gn) && gn >= 1 && gn <= 99) goldMin = gn;
    }catch(e){}
    collectGold(out, 'scalp', 'GOLD SCALP', goldMin);
    collectGold(out, 'swing', 'GOLD SWING', goldMin);
    collectGoldPine(out, 8);
    collectSmart(out);
    collectOiflow(out);
    collectLiqs(out);
    collectSqueeze(out);
    collectCarry(out);
    collectTermBasisWatch(out);
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
    lines.push(tag + s.sym + ' ' + s.dir.toUpperCase()
      + '\n  Tab/source: ' + s.src
      + '\n  @ ' + s.entry + ' · SL ' + s.stop + ' · TP ' + s.t1
      + (s.t2 !== null ? ' · T2 ' + s.t2 : '')
      + levHint(s.entry, s.stop) + extra);
  }
  if (!lines.length) return '';
  var hdr = fresh.length === 1
    ? (fresh[0].prime ? '🔥 HARDGATE — STRONG SETUP' : '📊 HARDGATE — SETUP')
    : (fresh.some(function(x){ return x.prime; })
        ? '🔥 HARDGATE — ' + fresh.length + ' SETUPS (incl. strong)'
        : '📊 HARDGATE — ' + fresh.length + ' SETUPS');
  return hdr
    + '\nTab: 15-min alert cycle (tabalerts.js)'
    + '\nSignal: fresh scanner hits from tabs listed per row below'
    + '\n\n' + lines.join('\n\n')
    + '\n\nlev ~Nx = stop-out ≈ 1% of account (cap 30x)'
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
  if (!tabAlertsShouldRun(root, !!opts.force)){
    return { pushed: 0, fresh: [], keys: loadKeys(root), status: 'throttled-15m' };
  }
  if (!opts.dryRun) tabAlertsMarkRun(root);
  var list = hgTabAlertsCollect(root);
  var allow = opts.sources;
  if (opts.allSources || !allow) allow = tabAlertSourcesAll();
  if (allow && typeof allow === 'object' && !Array.isArray(allow)){
    list = list.filter(function(s){
      if (s.src.indexOf('BRAIN') >= 0 && allow.brain) return true;
      if (s.src.indexOf('SWING') >= 0 && allow.swing) return true;
      if (s.src.indexOf('SCALP') >= 0 && allow.scalp) return true;
      if (s.src.indexOf('EDGE') >= 0 && allow.edge) return true;
      if (s.src.indexOf('PINE') >= 0 && allow.pine) return true;
      if (s.src.indexOf('GOLD') >= 0 && allow.gold) return true;
      if (s.src.indexOf('SMART') >= 0 && allow.smart) return true;
      if (s.src === 'OI FLOW' && allow.oiflow) return true;
      if (s.src === 'LIQS' && allow.liqs) return true;
      if (s.src === 'SQUEEZE' && allow.squeeze) return true;
      if (s.src === 'CARRY' && allow.carry) return true;
      if (s.src.indexOf('TERM BASIS') >= 0 && allow.termbasis) return true;
      if (s.watch && allow.watch) return true;
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
  return hgTabAlertsRun({ allSources: true });
};
W.hgTabAlertsRunEdge = function(opts){
  opts = opts || {};
  return hgTabAlertsRun(Object.assign({ sources: { edge: true } }, opts));
};
W.hgTabAlertsRunPine = function(opts){
  opts = opts || {};
  return hgTabAlertsRun(Object.assign({ sources: { pine: true } }, opts));
};

/* Node test / CI exports */
if (typeof module !== 'undefined' && module.exports){
  module.exports = { hgTabAlertsCollect, hgTabAlertsFresh, hgTabAlertsFormat,
    setupKey, GAP_MS, GOLD_MIN_TALLY, LS_KEYS, LS_LAST_RUN, tabAlertSourcesAll,
    tabAlertsShouldRun, tabAlertsMarkRun };
}

})();
