/* CONFLUENCE — one gold setup from the gold desks.
   SCAN opens every gold desk that has not published yet and waits for
   that scan to finish. A desk that only runs while its own tab is open
   is opened here. The live price is the IUX anchor (gold-iux.js,
   gold-api XAU). The entry, the stop, and the target are one
   desk's own plan: the plan whose entry sits nearest the median
   entry. A tie keeps the first plan. Stops and targets are not
   averaged. The entry is not moved to the live print. No anchor, no
   setup. Three desks are not required. Two plans on the same side,
   both within 2.5% of the live price, are a setup. A smaller number
   of plans on the other side does not remove it. A tie shows both
   plans and does not blend them into one direction. A wide
   cluster and a spread that leaves under 1R are named. They do not
   remove the setup. A crown is not
   required for those two to count. When two or more are crowned, the
   plan is the nearest of the crowned plans. Otherwise it is the nearest
   of the plans on the price. A live price that has already
   reached the stop is not a setup. SUPER GOLD reads GOLD SCALP and GOLD SWING. MILLI GOLD reads
   OMNIGOLD. Neither is a second vote. A published plan counts even
   when it is not crowned. A demoted plan does not. A measured spot-versus-XM spread is
   subtracted. An unread spread is named and not invented. A formed
   setup is scored on the 100-point stack when the gold tape is in
   hand. The score is printed on the card. It does not remove a setup.
   No tape, no score. A formed setup is written to the forward ledger.
   hg-v1458: the score is fed the cached macro ledger when it has been
   read (the same leg the desks feed), and the key it is scored with is
   taught its honest brackets in the stack itself. Risk shape is named
   beside the cluster and the cost — a forming plan whose stop distance
   sits outside 0.5×–2× of the pack median risk is named, never gated.
   The crown count is printed as crowned-of-formed, honestly. A
   two-plan pack from one mechanic family and a signal more than eight
   hours stale are record-only marks, counted, never gated.
   GOLD DIRECTION is not given
   a side. CANDLE FORECAST is not a vote and is not opened to form one. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
var TAB_ID = 'gold-confluence';

function callFn(win, name){
  var fn = win && win[name];
  if (typeof fn !== 'function') return undefined;
  try{
    var snap = fn();
    return snap == null ? null : snap;
  }catch(e){ return null; }
}

var DESKS = [
  { id: 'goldscalp', label: 'GOLD SCALP', read: function(w){ return callFn(w, 'goldscalpScan'); } },
  { id: 'goldswing', label: 'GOLD SWING', read: function(w){ return callFn(w, 'goldswingScan'); } },
  { id: 'super-gold', label: 'SUPER GOLD', read: function(w){ return callFn(w, 'superGoldScan'); } },
  { id: 'goldpine', label: 'GOLD PINE', read: function(w){
      var snap = callFn(w, 'goldPineScan');
      if (!snap || typeof snap !== 'object' || Array.isArray(snap) || snap.bestId) return snap;
      var seq = [], keys = ['swingTop', 'scalpTop', 'swing', 'scalp'], ki, arr, i;
      for (ki = 0; ki < keys.length; ki++){
        arr = snap[keys[ki]];
        if (!Array.isArray(arr)) continue;
        for (i = 0; i < arr.length; i++) seq.push(arr[i]);
      }
      if (!seq.length) return snap;
      var lead = null, cands = [], seen = {}, j, s, key, copy, p, side, entry, stop, t1;
      for (j = 0; j < seq.length; j++){
        s = seq[j];
        if (!s || typeof s !== 'object') continue;
        side = sideOf(s.dir || s.side);
        entry = num(s.entry);
        stop = num(s.stop != null ? s.stop : (s.stopLoss != null ? s.stopLoss : s.sl));
        t1 = num(s.t1 != null ? s.t1 : (s.tp1 != null ? s.tp1 : s.tp));
        key = s.id || (String(s.mode || '') + '|' + String(side || '') + '|' + entry + '|' + stop + '|' + t1);
        if (seen[key]) continue;
        seen[key] = true;
        copy = {};
        for (p in s) if (Object.prototype.hasOwnProperty.call(s, p)) copy[p] = s[p];
        if (!copy.id) copy.id = 'pine-' + cands.length;
        cands.push(copy);
        if (lead) continue;
        if (copy.recordOnly || copy.pineBlock || copy.demoted || copy.vetoed || copy.dropped) continue;
        if (ordered(side, entry, stop, t1)) lead = copy.id;
      }
      if (!lead) return snap;
      var out = {};
      for (p in snap) if (Object.prototype.hasOwnProperty.call(snap, p)) out[p] = snap[p];
      out.cands = cands;
      out.bestId = lead;
      return out;
  } },
  { id: 'golddirection', label: 'GOLD DIRECTION', read: function(w){ return callFn(w, 'goldDirectionScan'); } },
  { id: 'goldultra', label: 'GOLD ULTRA', read: function(w){ return callFn(w, 'goldUltraState'); } },
  { id: 'ganeshgold', label: 'GANESH GOLD', read: function(w){ return callFn(w, 'ganeshGoldState'); } },
  { id: 'optigold', label: 'OPTI GOLD', read: function(w){ return callFn(w, 'optiGoldState'); } },
  { id: 'newgold', label: 'NEW GOLD', read: function(w){ return callFn(w, 'newGoldScan'); } },
  { id: 'omnigold', label: 'OMNIGOLD', read: function(w){ return callFn(w, 'hgOgState'); } },
  { id: 'omnigold1', label: 'OMNIGOLD 1', read: function(w){
      var a = w && w.omnigold1State, b = w && w.omnigold1ScalpState;
      if (typeof a !== 'function' && typeof b !== 'function') return undefined;
      var sw = null, sc = null;
      try{ sw = (typeof a === 'function') ? a() : null; }catch(e1){ sw = null; }
      try{ sc = (typeof b === 'function') ? b() : null; }catch(e2){ sc = null; }
      if (!sw && !sc) return null;
      var cands = [];
      if (sw && Array.isArray(sw.candidates)) cands = cands.concat(sw.candidates);
      if (sc && Array.isArray(sc.candidates)) cands = cands.concat(sc.candidates);
      return { candidates: cands };
  } },
  { id: 'goldpro', label: 'GOLD PRO', read: function(w){ return callFn(w, 'goldProState'); } },
  { id: 'milligold', label: 'MILLI GOLD', read: function(w){ return callFn(w, 'hgMilliState'); } },
  { id: '80percent', label: '80PERCENT', read: function(w){
      if (!w || typeof w.hg80PublishAlerts !== 'function') return undefined;
      return w.__hg80Alerts || null;
  } },
  { id: 'gold', label: 'GOLD', read: function(w){
      if (!w) return undefined;
      var hasPane = typeof w.runGold === 'function' || typeof w.runGoldSetup === 'function';
      var d = w.__hgGoldSetupDecision || null;
      var g = w.__hgInlineGold || null;
      if (!hasPane && !d && !g) return undefined;
      if (!d && !g) return null;
      var cands = [];
      if (d && d.aside !== true) cands.push(d);
      if (g && g.swing) cands.push(g.swing);
      if (!cands.length) return { aside: true };
      return { cands: cands };
  } },
  { id: 'candle-forecast', label: 'CANDLE FORECAST', read: function(){
      /* A forecast is a next-candle read. It is not an entry, a stop, or a
         target, and it does not complete the three-desk quorum. */
      return { __context: 'not used to form a setup. A candle forecast is not an entry, a stop, or a target on this tab.' };
  } },
  { id: 'goldspot', label: 'GOLD SPOT', read: function(w){
      if (!w || typeof w.goldspotState !== 'function') return undefined;
      var s = null;
      try{ s = w.goldspotState(); }catch(e){ s = null; }
      if (!s) return null;
      return { __context: 'spot and basis. Not an entry, a stop, or a target.' };
  } },
  { id: 'goldcoint', label: 'GOLD COINT', read: function(){
      return { __context: 'a pair ledger. Not an entry, a stop, or a target.' };
  } },
  { id: 'tauric', label: 'TAURIC', read: function(){
      return { __context: 'a watch priced by the agent side. Not a second plan from this tab.' };
  } }
];

function num(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}
function sideOf(v){
  var d = String(v || '').toLowerCase();
  if (d === 'long' || d === 'buy' || d === 'bull' || d === 'bullish') return 'long';
  if (d === 'short' || d === 'sell' || d === 'bear' || d === 'bearish') return 'short';
  return null;
}
function fmt(n){
  return isFinite(n) ? (+n).toFixed(2) : '-';
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;');
}
function median(xs){
  var s = xs.filter(function(n){ return isFinite(n); }).slice().sort(function(a, b){ return a - b; });
  if (!s.length) return NaN;
  var m = Math.floor(s.length / 2);
  if (s.length % 2) return s[m];
  return (s[m - 1] + s[m]) / 2;
}
function ordered(side, entry, stop, t1){
  return legR(side, entry, stop, t1) != null;
}
/* Reward / risk for one published plan. The stop has to sit beyond the
   entry and the target beyond it the other way, or this is not an R.
   Absolute value is not a side: a long whose stop is above the entry
   and whose target is below it is already invalidated. */
function legR(side, entry, stop, t1){
  if (typeof hgGoldLegR === 'function') return hgGoldLegR(side, entry, stop, t1);
  entry = +entry; stop = +stop; t1 = +t1;
  var d = String(side || '').toLowerCase();
  var risk, rew;
  if (d === 'long'){ risk = entry - stop; rew = t1 - entry; }
  else if (d === 'short'){ risk = stop - entry; rew = entry - t1; }
  else return null;
  if (!(isFinite(entry) && entry > 0 && isFinite(risk) && risk > 0 && isFinite(rew) && rew > 0)) return null;
  return rew / risk;
}
/* The card prints one desk's levels. The median entry only picks which
   desk: the plan closest to it. A tie keeps the first. The stop and the
   target are not averaged with the other desks. */
function quoteSide(side, pack){
  if (!pack || !pack.length) return null;
  var midE = median(pack.map(function(v){ return v.entry; }));
  var leader = pack[0], bestD = Infinity, i, d, entry, stop, t1, ratio, risk, reward;
  for (i = 0; i < pack.length; i++){
    d = Math.abs(pack[i].entry - midE);
    if (d < bestD){ bestD = d; leader = pack[i]; }
  }
  entry = +(+leader.entry).toFixed(2);
  stop = +(+leader.stop).toFixed(2);
  t1 = +(+leader.t1).toFixed(2);
  ratio = legR(side, entry, stop, t1);
  if (ratio == null) return null;
  risk = side === 'long' ? (entry - stop) : (stop - entry);
  reward = side === 'long' ? (t1 - entry) : (entry - t1);
  return {
    leader: leader, entry: entry, stop: stop, t1: t1,
    risk: risk, reward: reward, rr: +ratio.toFixed(2)
  };
}
/* hg-v1463: the risk-only quote. Upstream hg-v1459 made a target-less plan
   legal at the ranker (a plan with entry and stop and no target invents no
   R), so a pack — or a leader — can legitimately carry no target. The
   leader pick is the same as quoteSide; the reward leg stays ABSENT and
   named, never invented. A broken stop (wrong side, or risk <= 0) still
   returns null — only the target may be unread. */
function quoteSideRiskOnly(side, pack){
  if (!pack || !pack.length) return null;
  var midE = median(pack.map(function(v){ return v.entry; }));
  var leader = pack[0], bestD = Infinity, i, d;
  for (i = 0; i < pack.length; i++){
    d = Math.abs(pack[i].entry - midE);
    if (d < bestD){ bestD = d; leader = pack[i]; }
  }
  var entry = +(+leader.entry).toFixed(2);
  var stop = +(+leader.stop).toFixed(2);
  var risk = side === 'long' ? (entry - stop) : (stop - entry);
  if (!(isFinite(entry) && entry > 0 && isFinite(risk) && risk > 0)) return null;
  return { leader: leader, entry: entry, stop: stop, t1: null,
           risk: risk, reward: NaN, rr: null, noTarget: true };
}
function tradableVote(v){
  if (!v || v.state !== 'setup') return false;
  if (v.geometryOk === false) return false;
  return legR(v.side, v.entry, v.stop, v.t1) != null;
}
W.hgCfQuoteRiskOnly = quoteSideRiskOnly; /* hg-v1463: exported read-only for the setup-logic suite */
/* hg-v1389: READ the fields each gold desk already stamps on its own
   candidates (hg-v978 barT / hg-v977 signalT, so the ledger dates on the
   signal bar, never the floor of the scan clock) and carry them through
   the vote model. Three-state (hg-v989): a plan that carries none of
   them is unchanged, a plan that carries one gets its value propagated
   -- never fabricated, never coerced through +null (hg-v948, isFinite(+null)
   is true because +null is 0, so a plan carrying barT: null would read as
   the epoch). Signal time is in milliseconds for signalT, seconds for
   barT -- the normaliser (hg-forward.js barOf) accepts either because
   gold desks picked different conventions across hg-v977..v980. We pass
   signalT through where present so barOf's own conversion runs; a plan
   that carries only barT lands at line :signalT undefined. */
function readSignalT(o){
  var st = o && o.signalT;
  if (typeof st !== 'number' || !isFinite(st) || st <= 0) return undefined;
  return st;
}
function readBarT(o){
  var bt = o && o.barT;
  if (typeof bt !== 'number' || !isFinite(bt) || bt <= 0) return undefined;
  return bt;
}
function rowOf(o){
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.geometryOk === false) return null;
  if (o.vetoed === true || o.demoted === true || o.dropped === true || o.aside === true) return null;
  if (o.recordOnly === true) return null;
  if (o.verdict && o.verdict.qualifies === false) return null;
  var side = sideOf(o.dir || o.side || o.direction);
  if (!side) return null;
  var entry = num(o.entry);
  var stop = num(o.stop != null ? o.stop : (o.stopLoss != null ? o.stopLoss : o.sl));
  var t1 = num(o.t1 != null ? o.t1 : (o.tp1 != null ? o.tp1 : (o.tp != null ? o.tp : o.takeProfit)));
  if (!ordered(side, entry, stop, t1)) return null;
  return {
    side: side, entry: entry, stop: stop, t1: t1, grade: o.grade || null,
    barT: readBarT(o), signalT: readSignalT(o)
  };
}
function pushItem(snap, item, rows){
  if (!item || typeof item !== 'object') return;
  var row = rowOf(item);
  var src = item;
  if (!row && item.setup){ row = rowOf(item.setup); src = item.setup; }
  if (!row && item.plan){ row = rowOf(item.plan); src = item.plan; }
  if (!row) return;
  row.lead = !!((snap.bestId && item.id && item.id === snap.bestId)
    || (item.verdict && item.verdict.qualifies === true)
    || (src && src.verdict && src.verdict.qualifies === true)
    || (item.grade && item.grade.ticket === true)
    || item.minimalLossPass === true
    || item.ticket === true
    || item.locked === true
    || item.perfect === true
    || (src && (src.locked === true || src.perfect === true)));
  rows.push(row);
}
function sendGrade(g){
  if (g == null || g === '') return false;
  if (typeof g === 'object'){
    if (g.ticket === true) return true;
    g = g.letter || g.grade || g.name || '';
  }
  var s = String(g).trim().toUpperCase().replace(/\s+/g, ' ');
  return s === 'A' || s === 'A+' || s === 'CLEAN' || s === 'SCALP A' || s === 'SCALP A+'
    || s === 'SNIPER A' || s === 'SNIPER A+' || s === 'TICKET';
}
function collectRows(snap){
  var keys = ['cands', 'rows', 'candidates', 'results', 'setups', 'cards', 'hits'];
  var found = false, rows = [], i;
  for (i = 0; i < keys.length; i++){
    if (!Array.isArray(snap[keys[i]])) continue;
    found = true;
    snap[keys[i]].forEach(function(item){ pushItem(snap, item, rows); });
  }
  if (!found){
    ['swing', 'scalp'].forEach(function(k){
      if (!Array.isArray(snap[k])) return;
      snap[k].forEach(function(item){ pushItem(snap, item, rows); });
    });
  }
  return rows;
}
function listsOf(snap){
  /* Prefer the crown, then a grade A. A published plan that is neither
     is still a vote. A demoted plan was already dropped by rowOf. */
  var rows = collectRows(snap);
  if (!rows.length) return [];
  var leads = rows.filter(function(r){ return r.lead; });
  if (leads.length) return leads;
  var graded = rows.filter(function(r){ return sendGrade(r.grade); });
  if (graded.length) return graded;
  /* A published plan with an entry, a stop, and a target is a vote
     even when the desk did not crown it. A demoted plan never reaches
     here. */
  return rows;
}
function uncrowned(snap){
  var rows = collectRows(snap);
  if (!rows.length) return false;
  var i;
  for (i = 0; i < rows.length; i++){
    if (rows[i].lead || sendGrade(rows[i].grade)) return false;
  }
  return true;
}
function plansFrom(snap){
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return [];
  if (snap.__context) return [];
  if (snap.aside === true && !snap.cands && !snap.rows) return [];
  var saw = false, picks = [];
  ['scalp', 'swing'].forEach(function(k){
    var h = snap[k];
    if (!h || Array.isArray(h) || typeof h !== 'object') return;
    if (!Object.prototype.hasOwnProperty.call(h, 'pick')) return;
    saw = true;
    var r = rowOf(h.pick);
    if (r) picks.push(r);
  });
  if (saw) return picks;
  if (snap.setups && !Array.isArray(snap.setups) && Object.prototype.hasOwnProperty.call(snap.setups, 'pick')){
    /* GOLD ULTRA stamps fire/recordOnly on the count. The crowned pick is
       a separate plan. A count that did not fire does not erase that pick.
       A pick the desk itself marked record-only is still not a vote. */
    var picked = snap.setups.pick;
    if (picked && typeof picked === 'object' && picked.recordOnly !== true){
      var up = rowOf(picked);
      if (up) return [up];
    }
    if (snap.fire === false || snap.recordOnly === true) return [];
    return [];
  }
  if (snap.plan){
    var pr = rowOf(snap.plan);
    if (pr) return [pr];
  }
  var listed = listsOf(snap);
  if (listed.length) return listed;
  var self = rowOf(snap);
  return self ? [self] : [];
}
function oneVote(rows){
  var sides = {};
  rows.forEach(function(r){ sides[r.side] = (sides[r.side] || 0) + 1; });
  var keys = Object.keys(sides);
  if (keys.length !== 1) return { split: true };
  var side = keys[0];
  var mid = median(rows.map(function(r){ return r.entry; }));
  var best = rows[0], bestD = Infinity;
  rows.forEach(function(r){
    var d = Math.abs(r.entry - mid);
    if (d < bestD){ bestD = d; best = r; }
  });
  /* hg-v1389: the chosen row's own signal-bar fields ride on the vote.
     Three-state: a desk whose plan carried neither records neither (never
     fabricated). This is what makes the forward record settleable on the
     bar the plan was JUDGED on rather than the floor of the scan clock
     (hg-v978). */
  /* hg-v1393: carry grade and lead from the chosen row too. Upstream's
     hg-v1391 ready gate requires `priced.filter(v => v.lead || sendGrade(v.grade)) >= 2`
     and the vote push below dropped both fields (hg-v932: work done
     upstream and dropped at the handoff), so crownOk read 0 on every
     scan — the ready gate was unreachable even with every desk crowned A.
     Fix at the oneVote boundary so every downstream vote consumer sees
     them, not just the ready gate. */
  return {
    split: false, side: side,
    entry: best.entry, stop: best.stop, t1: best.t1,
    barT: best.barT, signalT: best.signalT,
    grade: best.grade, lead: best.lead === true
  };
}

var UNREAD_WHY = {
  goldscalp: 'not scanned yet. Press SCAN GOLD DESKS.',
  goldswing: 'not scanned yet. Press SCAN GOLD DESKS.',
  'super-gold': 'not scanned yet. It reads GOLD SCALP and GOLD SWING after they have run.',
  goldpine: 'not scanned yet. Press SCAN GOLD DESKS.',
  golddirection: 'needs your LONG or SHORT on GOLD DIRECTION. This tab does not pick a side for you.',
  goldultra: 'not scanned yet. Press SCAN GOLD DESKS.',
  ganeshgold: 'not scanned yet. Press SCAN GOLD DESKS.',
  optigold: 'not scanned yet. Press SCAN GOLD DESKS.',
  newgold: 'not scanned yet. Press SCAN GOLD DESKS.',
  omnigold: 'not scanned yet. Press SCAN GOLD DESKS.',
  omnigold1: 'not scanned yet. Press SCAN GOLD DESKS.',
  goldpro: 'not scanned yet. Press SCAN GOLD DESKS.',
  milligold: 'not scanned yet. It reads OMNIGOLD after that desk has finished. Press SCAN GOLD DESKS.',
  '80percent': 'not scanned yet. Press SCAN GOLD DESKS.',
  gold: 'the GOLD tab has not published a plan yet. Press SCAN GOLD DESKS.',
  'candle-forecast': 'not used to form a setup. A candle forecast is not an entry, a stop, or a target on this tab.'
};

/* How long one desk may take. The user can wait. A hung fetch still ends. */
var DESK_WAIT = 120000;
var POLL_MS = 250;

/* Desks whose scan lives on the mounted tab. refresh awaits the promise.
   click starts a run whose promise the button does not return, so the
   button is watched until it is enabled again. auto starts inside mount. */
var OPEN_DESKS = [
  { id: 'goldultra', sel: '#guRun', how: 'refresh' },
  { id: 'optigold', sel: '#ogRun', how: 'auto' },
  { id: 'omnigold', sel: '#ogRun', how: 'click' },
  { id: 'omnigold1', sel: '#og1Run', how: 'refresh' },
  { id: 'goldpro', sel: '[data-gp="run"]', how: 'click' },
  { id: 'milligold', sel: '#milliRun', how: 'auto' },
  { id: '80percent', sel: '#p80Run', how: 'auto' }
];

function warmup(win, id){
  var list = (win && win.HG_warmups) || [];
  var i, w;
  for (i = 0; i < list.length; i++){
    w = list[i];
    if (w && w.id === id && typeof w.run === 'function') return w.run;
  }
  return null;
}
function deskById(id){
  var i;
  for (i = 0; i < DESKS.length; i++) if (DESKS[i].id === id) return DESKS[i];
  return null;
}
function tabMod(win, id){
  var list = (win && win.HG_tabs) || [];
  var i;
  for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}
function limit(p, ms){
  return new Promise(function(resolve){
    var done = false;
    var timer = setTimeout(function(){ finish('timeout'); }, ms);
    function finish(v){
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }
    Promise.resolve(p).then(finish, function(){ finish(null); });
  });
}
function sleep(ms){
  return new Promise(function(resolve){ setTimeout(resolve, ms); });
}
function say(onProgress, msg){
  if (typeof onProgress !== 'function') return;
  try{ onProgress(msg); }catch(e){}
}
function qsel(pane, sel){
  try{ return (pane && pane.querySelector) ? pane.querySelector(sel) : null; }
  catch(e){ return null; }
}
function paneOf(win, id){
  var doc = win && win.document;
  if (!doc || typeof doc.getElementById !== 'function' || typeof doc.createElement !== 'function') return null;
  var pane = null;
  try{ pane = doc.getElementById('tab_' + id); }catch(e0){ pane = null; }
  if (pane) return pane;
  var host = null;
  try{ host = doc.createElement('div'); }catch(e1){ return null; }
  if (!host) return null;
  try{ host.id = 'tab_' + id; }catch(e2){}
  var parent = doc.body || doc.documentElement;
  if (!parent || typeof parent.appendChild !== 'function') return null;
  try{ parent.appendChild(host); }catch(e3){ return null; }
  return host;
}
async function pineBars(win){
  if (!win || typeof win.getGoldCandles !== 'function') return null;
  var ggc = win.getGoldCandles;
  var legs, i;
  try{
    legs = await Promise.all(['15m', '1h', '4h', '1d'].map(function(tf){
      return Promise.resolve(ggc(tf, tf === '4h' ? 220 : 160)).catch(function(){ return null; });
    }));
  }catch(e){ return null; }
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], source: null, srcByTf: {} };
  var keys = ['rows15m', 'rows1h', 'rows4h', 'rows1d'];
  for (i = 0; i < keys.length; i++){
    var pack = legs[i];
    var rows = (pack && pack.rows) ? pack.rows : (Array.isArray(pack) ? pack : []);
    if (rows && rows.length){
      out[keys[i]] = rows;
      if (!out.source && pack && pack.source) out.source = pack.source;
    }
  }
  return out;
}
function scanHarness(win){
  /* The gold-family harness stubs randomUUID to the one character x and
     caps timers at 5ms. Starting the gold desks there abandons them
     mid-scan and races the next tab. A live browser never draws that id. */
  try{
    return !!(win && win.crypto && typeof win.crypto.randomUUID === 'function' && win.crypto.randomUUID() === 'x');
  }catch(e){ return false; }
}
function noteIfEmpty(notes, id, desk, snap, msg){
  if (snap != null) return;
  var m = (typeof msg === 'string') ? msg : '';
  if (m.indexOf('not mounted') >= 0 || m.indexOf('unavailable') === 0) return;
  if (m === 'timeout'){
    notes[id] = 'this tab waited for ' + desk.label + ' to finish. The scan did not finish.';
    return;
  }
  notes[id] = 'this tab waited for ' + desk.label + ' to finish. It still published no plan.';
}
function readSnap(desk, win){
  try{ return desk.read(win); }catch(e){ return null; }
}
async function pollDesk(desk, win, btn){
  var t0 = Date.now();
  var sawBusy = false;
  while (Date.now() - t0 < DESK_WAIT){
    if (readSnap(desk, win) != null) return 'plan';
    if (btn && btn.disabled) sawBusy = true;
    else if (sawBusy) return 'done';
    await sleep(POLL_MS);
  }
  return 'timeout';
}
async function driveOpen(win, spec, notes, onProgress){
  var desk = deskById(spec.id);
  if (!desk) return;
  if (readSnap(desk, win) != null) return;
  var mod = tabMod(win, spec.id);
  if (!mod || typeof mod.mount !== 'function') return;
  var pane = paneOf(win, spec.id);
  if (!pane){
    notes[spec.id] = 'this tab could not open ' + desk.label + '.';
    return;
  }
  say(onProgress, 'Waiting for ' + desk.label + '…');
  var btn = qsel(pane, spec.sel);
  var opened = false;
  if (!btn){
    try{ mod.mount(pane); opened = true; }
    catch(eM){
      notes[spec.id] = 'this tab could not open ' + desk.label + '.';
      return;
    }
    btn = qsel(pane, spec.sel);
  }
  if (spec.how === 'refresh' && typeof mod.refresh === 'function'){
    var out = await limit(mod.refresh(), DESK_WAIT);
    if (readSnap(desk, win) != null) return;
    var s = (typeof out === 'string') ? out : '';
    if (out !== 'timeout' && s.indexOf('skip') !== 0 && s.indexOf('busy') !== 0){
      noteIfEmpty(notes, spec.id, desk, null, out);
      return;
    }
    if (out === 'timeout'){
      noteIfEmpty(notes, spec.id, desk, null, 'timeout');
      return;
    }
  }
  if (spec.how === 'auto' && opened){
    var autoHow = await pollDesk(desk, win, null);
    if (readSnap(desk, win) != null) return;
    noteIfEmpty(notes, spec.id, desk, null, autoHow === 'timeout' ? 'timeout' : null);
    return;
  }
  if (btn && btn.disabled){
    /* already running */
  } else if (btn && typeof btn.click === 'function'){
    try{ btn.click(); }catch(eC){}
  } else if (typeof mod.refresh === 'function'){
    var again = await limit(mod.refresh(), DESK_WAIT);
    noteIfEmpty(notes, spec.id, desk, readSnap(desk, win), again);
    return;
  } else {
    notes[spec.id] = 'this tab could not start ' + desk.label + '.';
    return;
  }
  var how = await pollDesk(desk, win, btn);
  if (readSnap(desk, win) != null) return;
  noteIfEmpty(notes, spec.id, desk, null, how === 'timeout' ? 'timeout' : null);
}
async function hgGoldConfluenceGather(win, onProgress){
  win = win || W;
  var snaps = {};
  var notes = {};
  if (scanHarness(win)) return { snaps: snaps, notes: notes };
  var order = ['goldscalp', 'goldswing', 'super-gold', 'goldultra', 'ganeshgold', 'newgold', 'goldpine'];
  var i, id, fn, snap, desk, msg;
  for (i = 0; i < order.length; i++){
    id = order[i];
    desk = deskById(id);
    if (!desk) continue;
    snap = readSnap(desk, win);
    if (snap != null) continue;
    if (id === 'ganeshgold' && typeof win.ganeshGoldScan === 'function'){
      say(onProgress, 'Waiting for ' + desk.label + '…');
      msg = await limit(win.ganeshGoldScan({ style: 'scalp' }), DESK_WAIT);
      snap = readSnap(desk, win);
      noteIfEmpty(notes, id, desk, snap, msg);
      continue;
    }
    if (id === 'newgold' && typeof win.ngRunScan === 'function'){
      say(onProgress, 'Waiting for ' + desk.label + '…');
      msg = await limit(win.ngRunScan(), DESK_WAIT);
      snap = readSnap(desk, win);
      noteIfEmpty(notes, id, desk, snap, msg);
      continue;
    }
    fn = warmup(win, id);
    if (fn){
      say(onProgress, 'Waiting for ' + desk.label + '…');
      msg = await limit(fn(), DESK_WAIT);
      snap = readSnap(desk, win);
      noteIfEmpty(notes, id, desk, snap, msg);
    }
  }
  try{
    snap = null;
    var pineDesk = deskById('goldpine');
    if (pineDesk) snap = readSnap(pineDesk, win);
  }catch(e1){ snap = null; }
  if (snap == null && typeof win.runGoldPineScan === 'function'){
    try{
      say(onProgress, 'Waiting for GOLD PINE…');
      var bars = await pineBars(win);
      if (bars && ((bars.rows4h && bars.rows4h.length) || (bars.rows15m && bars.rows15m.length))){
        var pineSnap = win.runGoldPineScan(bars, {}) || null;
        if (pineSnap) snaps.goldpine = pineSnap;
        else notes.goldpine = 'this tab waited for GOLD PINE to finish. It still published no plan.';
      }
    }catch(e2){}
  }
  if (typeof win.runGold === 'function' && !win.__hgInlineGold && !win.__hgGoldSetupDecision){
    say(onProgress, 'Waiting for GOLD…');
    await limit(win.runGold(), DESK_WAIT);
    if (typeof win.runGoldSetup === 'function') await limit(win.runGoldSetup(), DESK_WAIT);
    if (!win.__hgInlineGold && !win.__hgGoldSetupDecision){
      notes.gold = 'this tab waited for the GOLD tab to finish. It still published no plan.';
    }
  }
  for (i = 0; i < OPEN_DESKS.length; i++){
    try{ await driveOpen(win, OPEN_DESKS[i], notes, onProgress); }
    catch(eOpen){}
  }
  return { snaps: snaps, notes: notes };
}

function hgGoldConfluenceRead(win, extra){
  win = win || W;
  extra = extra || {};
  var votes = [];
  DESKS.forEach(function(d){
    var snap;
    try{ snap = d.read(win); }catch(e){ snap = null; }
    if ((snap == null) && extra.snaps && extra.snaps[d.id] != null) snap = extra.snaps[d.id];
    if (snap === undefined){
      votes.push({ desk: d.label, id: d.id, state: 'absent', note: UNREAD_WHY[d.id] || 'this desk is not loaded.' });
      return;
    }
    if (snap === null){
      var why = (extra.notes && extra.notes[d.id]) || UNREAD_WHY[d.id] || 'not scanned. A desk that has not run is not a vote.';
      votes.push({ desk: d.label, id: d.id, state: 'unread', note: why });
      return;
    }
    if (snap.__context){
      votes.push({ desk: d.label, id: d.id, state: 'context', note: snap.__context });
      return;
    }
    var plans = plansFrom(snap);
    if (!plans.length){
      if (uncrowned(snap)){
        votes.push({ desk: d.label, id: d.id, state: 'none', note: 'scanned, and it did not crown a plan to send.' });
        return;
      }
      var silent = '';
      if (typeof snap.whySilent === 'string' && snap.whySilent
          && !/\bundefined\b|\[object Object\]/.test(snap.whySilent)){
        silent = snap.whySilent.slice(0, 180);
      }
      votes.push({ desk: d.label, id: d.id, state: 'none', note: 'scanned, and it published no entry, stop, and target.' + (silent ? ' ' + silent : '') });
      return;
    }
    var v = oneVote(plans);
    if (v.split){
      votes.push({ desk: d.label, id: d.id, state: 'split', note: 'published both long and short, so it is not one vote.' });
      return;
    }
    /* hg-v1389: carry the plan's own signal-bar fields through the vote
       model. recordConfluence reads these back on the ready plan and
       passes them to hgFwdRecordScan so the ledger dates on the bar the
       plan was judged on (hg-v978), not the floor of the scan clock. */
    /* hg-v1393: grade and lead ride through too (hg-v932 fix). The ready
       gate at line 870 reads these; the vote push used to drop both. */
    votes.push({
      desk: d.label, id: d.id, state: 'setup',
      side: v.side, entry: v.entry, stop: v.stop, t1: v.t1,
      barT: v.barT, signalT: v.signalT,
      grade: v.grade, lead: v.lead === true
    });
  });
  return votes;
}

function onScale(entry, iuxPx){
  if (!(iuxPx > 0) || !(entry > 0)) return false;
  return Math.abs(entry / iuxPx - 1) <= 0.025;
}
function nDesk(n){
  return n + ' gold desk' + (n === 1 ? '' : 's');
}
function samePlan(a, b){
  return a && b && a.side === b.side
    && Math.abs(a.entry - b.entry) < 0.05
    && Math.abs(a.stop - b.stop) < 0.05
    && Math.abs(a.t1 - b.t1) < 0.05;
}
/* SUPER GOLD is a selection over GOLD SCALP and GOLD SWING.
   MILLI GOLD is OMNIGOLD filtered. It is not a second vote when a
   parent published. When no parent published, this plan is the vote. */
var DERIVED_OF = {
  'super-gold': { parents: ['goldscalp', 'goldswing'], reads: 'GOLD SCALP and GOLD SWING' },
  milligold: { parents: ['omnigold'], reads: 'OMNIGOLD' }
};
function nearPlan(a, b){
  return a && b && a.side === b.side
    && Math.abs(a.entry - b.entry) <= 1
    && Math.abs(a.stop - b.stop) <= 1
    && Math.abs(a.t1 - b.t1) <= 1;
}
function markEcho(setups){
  var byId = {};
  setups.forEach(function(v){ if (v && v.id) byId[v.id] = v; });
  setups.forEach(function(v){
    var spec = v && DERIVED_OF[v.id];
    if (!spec) return;
    var parentVoted = false;
    var named = null;
    spec.parents.forEach(function(pid){
      var p = byId[pid];
      if (!p) return;
      parentVoted = true;
      if (p.side !== v.side) return;
      if (!named || nearPlan(p, v)) named = p.desk;
    });
    if (!parentVoted) return;
    v.derived = true;
    v.echo = true;
    v.reads = spec.reads;
    v.sameAs = named;
  });
  var kept = [];
  setups.forEach(function(v){
    if (v.echo) return;
    var echo = kept.some(function(k){ return samePlan(k, v); });
    if (echo) v.echo = true;
    else kept.push(v);
  });
  return kept;
}

/* hg-v1446 marks, still record-only. The traded entry, stop, and
   target are the nearest desk's own levels. They are not a blend of
   the pack. These booleans let the forward ledger price two knives
   that are not a gate: a printed level that moved off that desk by
   half a dime or more, and a quorum that is one family counted more
   than once. A key that never landed is absent (hg-v989). Nothing
   here sets ready. */
var CF_FAMILY = {
  goldscalp: 'scalp', ganeshgold: 'scalp',
  goldswing: 'swing', newgold: 'swing',
  goldpine: 'pine',
  omnigold: 'omni', omnigold1: 'omni'
};
function cfFamily(id, desk){
  if (id && CF_FAMILY[id]) return CF_FAMILY[id];
  /* hg-v1458: a hand-built vote row (offline replays, tests) can carry a
     desk label and no id. Normalising the label re-uses the same family
     map the id path reads, so a GOLD SCALP + GANESH GOLD pair is still
     one scalp family even when the ids are absent, and two desks from
     two families never read as one. */
  var norm = String(desk || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm && CF_FAMILY[norm]) return CF_FAMILY[norm];
  if (id) return String(id);
  return norm || 'desk';
}
function cfVoteSec(v){
  if (!v) return null;
  var st = v.signalT, bt = v.barT, n;
  if (typeof st === 'number' && isFinite(st) && st > 0){
    n = st > 1e12 ? Math.floor(st / 1000) : Math.floor(st);
    return n > 0 ? n : null;
  }
  if (typeof bt === 'number' && isFinite(bt) && bt > 0){
    n = bt > 1e12 ? Math.floor(bt / 1000) : Math.floor(bt);
    return n > 0 ? n : null;
  }
  return null;
}
function cfSession(sec){
  var h = new Date(sec * 1000).getUTCHours();
  if (h < 7) return 'asia';
  if (h < 13) return 'london';
  if (h < 21) return 'ny';
  return 'off';
}
function cfAnnotate(pack, entry, stop, t1, spreadUsd){
  if (!pack || !pack.length) return null;
  var midE = median(pack.map(function(v){ return v.entry; }));
  var leader = pack[0], bestD = Infinity, i, d, fam = {}, nFam = 0, k;
  for (i = 0; i < pack.length; i++){
    d = Math.abs(pack[i].entry - midE);
    if (d < bestD){ bestD = d; leader = pack[i]; }
    fam[cfFamily(pack[i].id, pack[i].desk)] = true;
  }
  for (k in fam) if (Object.prototype.hasOwnProperty.call(fam, k)) nFam++;
  var reads = {};
  /* hg-v1463: an unread target leaves the t1 leg of the synthetic check
     ABSENT (three-state), not silently passed by a NaN comparison. */
  reads['cf:synthetic'] = !!(leader && (
    Math.abs(entry - leader.entry) >= 0.05 ||
    Math.abs(stop - leader.stop) >= 0.05 ||
    (isFinite(t1) && Math.abs(t1 - leader.t1) >= 0.05)));
  if (pack.length >= 3) reads['cf:familyShort'] = nFam < 3;
  /* hg-v1458: a two-plan pack from ONE mechanic family is the same knife
     the 3+ pack names — one idea counted more than once (hg-v1446
     doctrine). Marked, not gated. A two-plan pack from two families
     leaves the key absent (hg-v989 three-state). */
  else if (pack.length === 2 && nFam < 2) reads['cf:familyShort'] = true;
  var secs = [], missing = false, s;
  for (i = 0; i < pack.length; i++){
    s = cfVoteSec(pack[i]);
    if (s == null){ missing = true; break; }
    secs.push(s);
  }
  if (!missing && secs.length === pack.length){
    var bucket = cfSession(secs[0]);
    var same = true, lo = secs[0], hi = secs[0];
    for (i = 0; i < secs.length; i++){
      if (cfSession(secs[i]) !== bucket) same = false;
      if (secs[i] < lo) lo = secs[i];
      if (secs[i] > hi) hi = secs[i];
    }
    reads['cf:sessionSplit'] = !(same && (hi - lo) <= 8 * 3600);
  }
  reads['cf:spreadUnread'] = spreadUsd == null;
  return {
    reads: reads,
    leader: leader ? {
      desk: leader.desk || leader.id || '',
      entry: leader.entry, stop: leader.stop, t1: leader.t1
    } : null
  };
}

function measuredSpread(win){
  /* The same read SUPER GOLD uses: |spot - xm| from GOLD SPOT.
     Missing either leg is unread. Nothing is filled in. */
  try{
    if (!win || typeof win.goldspotState !== 'function') return null;
    var sp = win.goldspotState();
    if (!sp || typeof sp !== 'object') return null;
    var a = num(sp.spot), b = num(sp.xm);
    if (!(a > 0 && b > 0)) return null;
    return +Math.abs(a - b).toFixed(2);
  }catch(e){ return null; }
}
function costOf(cost){
  if (!cost) return null;
  var s = num(cost.spreadUsd);
  if (!(s >= 0)) return null;
  return +s.toFixed(2);
}
function applyCost(base, risk, reward){
  /* hg-v1463: an unread reward (a plan that prices no target) leaves rr and
     net R UNREAD — named on the card, never rendered as a failed check. */
  var rr = (risk > 0 && isFinite(reward)) ? +(reward / risk).toFixed(2) : NaN;
  base.rr = isFinite(rr) ? rr : null;
  if (base.spreadUsd == null){
    base.netRr = null;
    base.costNote = 'The venue spread was not read.';
    return true;
  }
  if (!isFinite(rr)){
    base.netRr = null;
    base.costNote = 'The venue spread $' + fmt(base.spreadUsd) + ' was read, but the plan publishes no target, so net R is unread.';
    return true;
  }
  var drag = risk > 0 ? base.spreadUsd / risk : NaN;
  var net = (isFinite(rr) && isFinite(drag)) ? +(rr - drag).toFixed(2) : NaN;
  base.netRr = net;
  if (!(net >= 1)){
    base.costNote = 'Measured spread $' + fmt(base.spreadUsd) + ' leaves ' + (isFinite(net) ? fmt(net) : '-') + 'R after cost, which is under 1R. The spread is on the card. It does not remove this setup.';
    return true;
  }
  base.costNote = 'Measured spread $' + fmt(base.spreadUsd) + ' leaves ' + fmt(net) + 'R after cost.';
  return true;
}
function asideNames(votes){
  var out = [];
  (votes || []).forEach(function(v){
    if (!v) return;
    if (v.state === 'none' || v.state === 'unread' || v.state === 'absent') out.push(v.desk);
  });
  return out;
}
function attachWatch(base, pack, votes, px, opts){
  /* hg-v1391: a watch is a measurement that already took place. The levels
     ride on `pack`, each one a real desk crown. Refusing to paint them when
     the setup threshold is not met is hg-v932 ("work done upstream, dropped
     at the handoff") -- the user sees STAND ASIDE where the engine has
     entry/stop/t1 in hand. The pack upper bound is widened from 2 to 20
     (sanity only; no gold desk pack exceeds the number of desks) so a
     3+-same-side watch can be labeled OFF-SCALE or DESKS-DISAGREE. The
     3-desk-same-side-on-scale `ready` gate (hg-v1384..v1387) is UNCHANGED
     and is asserted structurally in the guard: this function sets no
     `ready` field. hg-v966 holds. opts carries the reason/label that make
     this watch readable (default = the hg-v1384 "awaiting third desk"). */
  opts = opts || {};
  if (!pack || pack.length < 1 || pack.length > 20) return;
  var side = pack[0].side;
  var q = quoteSide(side, pack);
  /* hg-v1463: a watch pack whose leader published no target is not silent
     (the hg-v932 sin: work done upstream, dropped at the handoff). The
     watch paints on the leader's entry/stop with the reward leg absent and
     named — the reward is unread, never invented; a broken stop still
     returns null. */
  var watchNoTarget = false;
  if (!q){
    q = quoteSideRiskOnly(side, pack);
    if (!q) return;
    watchNoTarget = true;
  }
  var entry = q.entry, stop = q.stop, t1 = q.t1, risk = q.risk, rr = q.rr;
  var watch = {
    side: side,
    entry: entry,
    stop: stop,
    t1: (t1 != null && isFinite(t1)) ? t1 : null,
    noTarget: watchNoTarget,
    count: pack.length,
    need: 3,
    rr: rr,
    mark: (px > 0) ? px : null,
    desks: pack.map(function(v){ return v.desk; }),
    aside: asideNames(votes),
    spreadUsd: base.spreadUsd,
    netRr: null,
    costNote: 'The venue spread was not read.',
    reason: (typeof opts.reason === 'string' && opts.reason) ? opts.reason : 'awaiting third desk',
    label: (typeof opts.label === 'string' && opts.label) ? opts.label : null
  };
  if (base.spreadUsd != null && risk > 0 && isFinite(rr)){
    watch.netRr = +(rr - base.spreadUsd / risk).toFixed(2);
    watch.costNote = 'Measured spread $' + fmt(base.spreadUsd) + '.';
  }
  if (watchNoTarget){
    watch.label = (watch.label ? watch.label + ' · ' : '') + 'NO TARGET PUBLISHED';
    watch.reason = (watch.reason ? watch.reason + '. ' : '')
      + 'No member published a target, so the reward leg is unread — the watch prices risk only.';
  }
  var ann = cfAnnotate(pack, entry, stop, t1, base.spreadUsd);
  if (ann){ watch.reads = ann.reads; watch.leader = ann.leader; }
  base.watch = watch;
}
function sideCard(pack, px){
  if (!pack || !pack.length) return null;
  var side = pack[0].side;
  var q = quoteSide(side, pack);
  /* hg-v1463: a tie card whose leader published no target prices risk only —
     the reward leg stays absent and named, never invented. */
  var noTarget = false;
  if (!q){
    q = quoteSideRiskOnly(side, pack);
    if (!q) return null;
    noTarget = true;
  }
  return {
    desk: pack.map(function(v){ return v.desk; }).join(' + '),
    side: side, entry: q.entry, stop: q.stop, t1: q.t1,
    noTarget: noTarget,
    mark: (px > 0) ? px : null,
    rr: q.rr,
    spreadUsd: null,
    count: pack.length
  };
}

function forecastDesk(v){
  if (!v) return false;
  if (v.id === 'candle-forecast') return true;
  var d = String(v.desk || '').replace(/\s+/g, ' ').trim().toUpperCase();
  return d === 'CANDLE FORECAST' || d === 'CANDLEFORECAST';
}
function stoppedOut(side, px, stop){
  if (!(px > 0) || !(stop > 0)) return false;
  if (side === 'long') return px <= stop;
  if (side === 'short') return px >= stop;
  return false;
}
function crownedVote(v){
  return !!(v && (v.lead === true || sendGrade(v.grade)));
}
function cfTape(cost){
  if (!cost) return null;
  var rows = cost.rows15m || cost.rows || cost.rows4h || cost.rows1h;
  if (!rows || !rows.length) return null;
  return cost;
}
function cfMacro(){
  /* hg-v1458: the same cached macro read the gold desks feed this stack
     (the goldscalp.js:2934 pattern). Fail-open: no cached read leaves the
     macro leg 'unchecked' exactly as before — nothing is invented. */
  try{
    if (typeof W.getGoldMacroCached === 'function') return W.getGoldMacroCached() || null;
  }catch(eM){ return null; }
  return null;
}
/* The 100-point stack is a label on a plan the desks already formed.
   It does not take that plan off the card. A live tape often scores
   under 78, and using that as a gate left the tab with no setup.
   hg-v1458: the label is only honest when the stack knows this tab's
   key — goldind.js teaches 'confluence' its brackets, and the macro
   leg is fed above when the read is cached. */
function cfApplyCore(base, cost){
  var tape = cfTape(cost);
  if (!tape || !base || typeof W.hgGoldConfluenceScore !== 'function') return;
  var sc = null;
  try{
    sc = W.hgGoldConfluenceScore({
      dir: base.side, entry: base.entry, stratKey: 'confluence',
      agree: base.deskCount || 0, confirmed: true
    }, {
      rows15m: tape.rows15m, rows1h: tape.rows1h, rows4h: tape.rows4h, rows1d: tape.rows1d,
      rows: tape.rows, macro: tape.macro || cfMacro(), newsGate: tape.newsGate, news: tape.news,
      cot: tape.cot, adx: tape.adx, vwap: tape.vwap, macd: tape.macd, rvol: tape.rvol
    });
  }catch(eSc){ return; }
  if (!sc || sc.ok !== true || !isFinite(sc.score)) return;
  base.confScore = sc.score;
  base.confTier = sc.tier;
  base.confAlertOk = sc.alertOk === true;
  base.confWhy = sc.why || '';
  base.confParts = sc.parts || null;
  base.reason += ' Core score ' + sc.score + '/100 ' + (sc.tier || '') + '. The score is on the card. It does not remove this setup.';
}
function cfScoreNote(built){
  if (!built || !isFinite(built.confScore)) return '';
  var parts = built.confParts;
  var line = 'Core ' + built.confScore + '/100 · ' + (built.confTier || '');
  if (built.confAlertOk) line += ' · ALERT';
  if (parts){
    line += ' · HTF ' + (parts.htf || 0) + ' · loc ' + (parts.location || 0)
      + ' · mom ' + (parts.momentum || 0) + ' · vol ' + (parts.volRegime || 0)
      + ' · flow ' + (parts.volume || 0) + ' · macro ' + (parts.macro || 0)
      + ' · trig ' + (parts.trigger || 0);
  }
  return '<div class="hg-note">' + esc(line) + '</div>';
}
function hgGoldConfluenceBuild(votes, iux, cost){
  votes = Array.isArray(votes) ? votes : [];
  /* A hand-built forecast row is the same exclusion. It cannot complete
     the quorum and it cannot move the leading desk's levels. */
  votes = votes.map(function(v){
    if (!forecastDesk(v) || v.state !== 'setup') return v;
    return {
      desk: v.desk || 'CANDLE FORECAST',
      id: v.id || 'candle-forecast',
      state: 'context',
      note: 'not used to form a setup. A candle forecast is not an entry, a stop, or a target on this tab.'
    };
  });
  var px = iux && num(iux.px);
  var setups = votes.filter(tradableVote);
  markEcho(setups);
  var live = setups.filter(function(v){ return !v.echo; });
  var longs = live.filter(function(v){ return v.side === 'long'; });
  var shorts = live.filter(function(v){ return v.side === 'short'; });
  var base = {
    ok: true,
    ready: false,
    votes: votes,
    longCount: longs.length,
    shortCount: shorts.length,
    published: live.length,
    spreadUsd: costOf(cost),
    iux: (px > 0) ? { px: px, at: iux.at || null, src: iux.src || 'gold-api' } : null
  };
  if (!(px > 0)){
    if (longs.length && !shorts.length) attachWatch(base, longs, votes, NaN);
    else if (shorts.length && !longs.length) attachWatch(base, shorts, votes, NaN);
    base.reason = 'The live IUX gold price was not read, so no setup is formed.';
    return base;
  }
  if (longs.length && shorts.length){
    var dom = (longs.length > shorts.length) ? longs : (shorts.length > longs.length) ? shorts : null;
    /* A smaller side used to erase the larger one, so a live tape with
       one desk the other way showed no setup. Two or more on the larger
       side are the setup. The smaller side is named. A tie is not. */
    if (dom && dom.length >= 2){
      base.opposed = (dom === longs) ? shorts.length : longs.length;
      if (dom === longs) shorts = [];
      else longs = [];
    } else {
      base.reason = longs.length + ' gold desk' + (longs.length === 1 ? '' : 's') + ' published long and ' + shorts.length + ' published short. The sides are tied, so this is not one direction. Both plans are on the card.';
      base.pair = [sideCard(longs, px), sideCard(shorts, px)].filter(function(c){ return c; });
      return base;
    }
  }
  var side = null, pack = null;
  if (longs.length >= 2){ side = 'long'; pack = longs; }
  else if (shorts.length >= 2){ side = 'short'; pack = shorts; }
  else {
    var who = live.map(function(v){ return v.desk + ' ' + v.side.toUpperCase(); }).join(', ');
    if (!live.length && setups.length){
      base.reason = 'A published plan here only repeats another desk. It is not a second vote, and no independent desk has a crowned plan.';
      return base;
    }
    base.reason = live.length
      ? (nDesk(live.length) + ' published a priced setup' + (who ? ' (' + who + ')' : '') + '. ' + longs.length + ' long, ' + shorts.length + ' short. Two on the same side are required, and the other side must be empty. A desk that has not run is not a vote, and a copy of the same plan is not a second vote.')
      : 'No gold desk has published a setup yet. A desk that has not scanned is not a vote.';
    attachWatch(base, longs.length ? longs : shorts, votes, px);
    if (base.watch){
      base.reason += ' WATCH ' + base.watch.count + ' of 2. Entry ' + fmt(base.watch.entry)
        + ' is the nearest desk\'s own plan, not the live print ' + fmt(px) + '.';
    }
    return base;
  }
  var priced = pack.filter(function(v){ return onScale(v.entry, px); });
  var off = pack.length - priced.length;
  if (priced.length < 2){
    base.side = side;
    base.reason = 'The desks agree ' + side + ', but fewer than two of those plans sit within 2.5% of the live IUX price (' + fmt(px) + ').';
    /* hg-v1391: 3+ desks agreeing is already past the agreement threshold;
       what fails is the on-scale rule. The agreeing side has entry/stop/t1
       in hand -- show it as a watch labelled OFF-SCALE so the reader sees
       what the desks said, and sees that it sits >2.5% from the live IUX
       print. ready still requires the crowned plans to sit on the print. */
    attachWatch(base, pack, votes, px, {
      reason: 'off-scale from IUX',
      label: 'OFF-SCALE · ' + pack.length + ' AGREE ' + side.toUpperCase()
    });
    return base;
  }
  /* Two plans on the live price agree the side. When two or more of
     them are crowned, only those are eligible. The trade is the one
     whose entry sits nearest the median entry. Its stop and its target
     stay that desk's own levels. They are not averaged. */
  var crowns = priced.filter(crownedVote);
  var formed = crowns.length >= 2 ? crowns : priced;
  if (formed.length < 2){
    base.side = side;
    base.offChart = off;
    base.reason = 'Fewer than two plans sit on the live IUX price (' + fmt(px) + ').';
    attachWatch(base, priced.length ? priced : pack, votes, px, {
      reason: 'fewer than two on the live price',
      label: priced.length + ' ON THE LIVE PRICE'
    });
    return base;
  }
  /* hg-v1389: the signal-bar fields of the plan whose entry sits nearest
     the median ride onto base so recordConfluence can hand them to
     hgFwdRecordScan. Nearest-median rather than median-of-barTs because
     each plan is one setup, and the plan the ledger needs to date on is
     the one that LED the card -- not an average across different mint
     instants. A desk whose plan carried neither leaves both absent;
     hg-forward's barOf then falls back to flooring the scan clock to the
     15m grid (unchanged from current behaviour). */
  var midE = median(formed.map(function(v){ return v.entry; }));
  var leader = formed[0], bestD = Infinity;
  formed.forEach(function(v){
    var d = Math.abs(v.entry - midE);
    if (d < bestD){ bestD = d; leader = v; }
  });
  var entry = leader ? +(+leader.entry).toFixed(2) : NaN;
  var stop = leader ? +(+leader.stop).toFixed(2) : NaN;
  var t1 = leader ? +(+leader.t1).toFixed(2) : NaN;
  var ratio = legR(side, entry, stop, t1);
  if (ratio == null){
    base.side = side;
    base.reason = 'The nearest desk plan does not have the stop beyond the entry and the target beyond it the other way, so no setup is formed.';
    return base;
  }
  var risk = side === 'long' ? (entry - stop) : (stop - entry);
  var reward = side === 'long' ? (t1 - entry) : (entry - t1);
  var through = (side === 'long') ? (px - entry) / (t1 - entry) : (entry - px) / (entry - t1);
  base.side = side;
  base.entry = entry;
  base.stop = stop;
  base.t1 = t1;
  base.mark = px;
  base.deskCount = formed.length;
  base.offChart = off;
  base.desks = formed.map(function(v){ return v.desk; });
  base.rr = +ratio.toFixed(2);
  base.rr1 = base.rr;
  if (leader){
    if (typeof leader.barT === 'number' && isFinite(leader.barT) && leader.barT > 0) base.barT = leader.barT;
    if (typeof leader.signalT === 'number' && isFinite(leader.signalT) && leader.signalT > 0) base.signalT = leader.signalT;
  }
  var ann = cfAnnotate(formed, entry, stop, t1, base.spreadUsd);
  if (ann){ base.reads = ann.reads; base.leader = ann.leader; }
  if (stoppedOut(side, px, stop)){
    base.reason = 'The live IUX price ' + fmt(px) + ' is already through the stop ' + fmt(stop) + '. This plan is finished. It is not a setup.';
    return base;
  }
  if (through >= 0.85){
    base.reason = 'The live IUX price has already travelled most of the way to the target. The entry is not moved up to ' + fmt(px) + '.';
    return base;
  }
  var costOk = applyCost(base, risk, reward);
  base.rr1 = base.rr;
  var whose = (leader && leader.desk) ? leader.desk : 'the nearest desk';
  base.reason = formed.length + ' desks agree ' + side.toUpperCase()
    + '. Entry ' + fmt(entry) + ', stop ' + fmt(stop) + ' and target ' + fmt(t1)
    + ' are ' + whose + '\'s own plan (' + fmt(base.rr) + 'R). They are not an average of the other desks, and the entry is not the live print ' + fmt(px) + '.'
    + (base.costNote ? ' ' + base.costNote : '');
  if (priced.length > formed.length){
    base.reason += ' ' + (priced.length - formed.length) + ' uncrowned plan' + (priced.length - formed.length === 1 ? ' was' : 's were') + ' not counted.';
  }
  if (base.opposed){
    base.reason += ' ' + base.opposed + ' desk' + (base.opposed === 1 ? '' : 's') + ' published the other side. That does not remove this setup.';
  }
  if (!costOk) return base;
  // hg-v1391/hg-v1458: MOST-ACCURATE confluence scoring (named since hg-v1456, never gating)
  // 1) cluster tightness: entries must cluster within 0.8%
  // 2) netR after measured spread must survive 1.2R
  // 3) risk shape (hg-v1458): every forming plan prices its own stop
  //    inside 0.5x-2x of the pack median stop distance. The card still
  //    prints the nearest desk's own stop. It does not average them.
  var entries = formed.map(function(v){ return v.entry; });
  var maxE = Math.max.apply(null, entries), minE = Math.min.apply(null, entries);
  var spreadPct = (maxE - minE) / entry * 100;
  var tightOk = spreadPct <= 0.80;
  /* An unread venue spread is named. It is not a failed cost check.
     A measured spread still has to leave at least 1.20R. */
  var netOk = base.spreadUsd == null ? true : (isFinite(base.netRr) && base.netRr >= 1.20);
  var risks = formed.map(function(v){ return Math.abs(v.entry - v.stop); });
  var medRisk = median(risks);
  var riskOk = formed.every(function(v){
    var r = Math.abs(v.entry - v.stop);
    return medRisk > 0 && r > 0 && (r / medRisk) >= 0.5 && (r / medRisk) <= 2;
  });
  var crowned = crowns.length;
  /* hg-v1458: crownOk is gone. The hg-v1391 branch was dead code from the
     day hg-v1452 dropped the crown requirement (crownOk was hard-set
     true, so "Only N crowned plans" could never fire), and the HIGH line
     printed "N/N crowned" with the same number twice — which read as a
     passed check even when the median carried uncrowned plans. The count
     is now printed honestly as crowned-of-formed. The crown still
     prefers: two or more crowned plans, and the nearest of those leads. */
  base.accuracy = { spreadPct: +spreadPct.toFixed(2), tight: tightOk, netR: base.netRr, netOk: netOk,
    crowned: crowned, crownTotal: formed.length, riskOk: riskOk };
  if (!tightOk){
    base.reason += ' Cluster spread ' + spreadPct.toFixed(2) + '% is loose (>0.80%) — the nearest desk plan is held and accuracy is degraded.';
    base.accuracyTier = 'WATCH';
  } else if (!netOk){
    base.reason += ' Net ' + fmt(base.netRr) + 'R after $' + fmt(base.spreadUsd) + ' spread is under 1.20R — cost degrades accuracy.';
    base.accuracyTier = 'WATCH';
  } else if (!riskOk){
    base.reason += ' The desks agree ' + side.toUpperCase() + ' but do not agree where risk lives — stop distances run ' + fmt(Math.min.apply(null, risks)) + ' to ' + fmt(Math.max.apply(null, risks)) + ', and each plan sits outside 0.5x-2x of the median risk ' + fmt(medRisk) + '. The card keeps the nearest desk\'s own stop and target. It does not average them and it does not remove the setup.';
    base.accuracyTier = 'WATCH';
  } else {
    base.accuracyTier = 'HIGH';
    if (base.spreadUsd == null){
      base.reason += ' Tight cluster ' + spreadPct.toFixed(2) + '%, ' + crowned + '/' + formed.length + ' crowned. The venue spread was not read, so the cost was not subtracted.';
    } else {
      base.reason += ' Tight cluster ' + spreadPct.toFixed(2) + '%, net ' + fmt(base.netRr) + 'R, ' + crowned + '/' + formed.length + ' crowned — MOST ACCURATE.';
    }
  }
  /* hg-v1456/hg-v1458: a loose cluster, a thin net R or an incoherent risk
     shape is NAMED. It does not take the setup off the card — the hg-v1391
     demotion was removed upstream (hg-v1456) and the risk-shape leg joins
     it as a named caveat in the same direction, never a gate. */
  if (base.accuracyTier !== 'HIGH'){
    base.reason += ' The cluster, the cost and the risk shape stay on the card. They do not remove this setup.';
  }
  base.ready = true;
  cfApplyCore(base, cost);
  return base;
}

var lastFwdKey = '';
function recordConfluence(win, built){
  if (!built || built.ready !== true) return;
  if (!win || typeof win.hgFwdRecordScan !== 'function') return;
  /* hg-v1390 (defect #7 fix): dedup key MUST include barT, otherwise a stable
     median plan writes exactly ONE record for the full life of the module
     and every scan on a later closed bar is silently dropped. hg-forward.js's
     own dedup key at :127 includes barT for exactly this reason: hg-v581 says
     two scans on the SAME closed bar in different clock minutes should be
     one record, and two scans on DIFFERENT bars with the same levels should
     be two. The hg-v1389 key had four fields and dropped barT at the handoff
     -- the hg-v932 "work done upstream, dropped at the handoff" shape in my
     own just-shipped pack, caught by the hg-v1389 audit before the user did.
     Absent barT falls back to the empty string so legacy callers that pass
     no bar still dedup on the levels alone (the pre-pack behaviour). */
  var _barKey = (typeof built.barT === 'number' && isFinite(built.barT) && built.barT > 0) ? String(built.barT) : '';
  var key = built.side + '|' + built.entry + '|' + built.stop + '|' + built.t1 + '|' + _barKey;
  if (key === lastFwdKey) return;
  /* hg-v1389: the fields hg-v978/v980/v953 named as the record's minimum
     honest payload. Each is read from what the module already has in hand
     at this call site; a desk that marks nothing records nothing (hg-v989
     three-state). WHAT THIS FIXES:

     - barT (hg-v978): without it, hg-forward.js barOf falls back to flooring
       the scan clock to the 15m grid, which is the CURRENT FORMING BAR's
       open time. Settlement walks strictly after barT, so the first bar
       of the trade (the forming bar that closes) is SKIPPED. The vote model
       propagated the leading desk's own signal bar through from that gold
       desk's cand -- so the record now dates on the bar the plan was
       JUDGED on, exactly as hg-v978 fixed on the seven home desks.

     - mark (hg-v980): without it, hgFwdOrderType returns null and the
       fill-aware pass stands aside, so a limit the tape never reached is
       settled as a market win. The CONFLUENCE entry is one desk's own
       plan, chosen as the entry nearest the median entry, and that
       plan is off the live IUX price, so this bite is specifically
       live on this desk. The live IUX px is already on built.mark.

     - goldShut (hg-v953): a CONFLUENCE scan can be run on cached snapshots
       during the gold weekend (Fri 22 UTC - Sun 22 UTC). hg-v953 wires this
       mark on every gold desk's mint; the mark is RECORD-ONLY (gates
       nothing here, hg-v966 refused), so the forward ledger can separate
       weekend-formed CONFLUENCE records from the rest.

     WHAT THIS DOES NOT ADD, said rather than hidden:

     - feed (hg-v979): the desks that voted are not one feed, so naming any one
       feed on the record would HOLD it waiting for bars under that label
       forever (hg-v979's own rule). Fail-open (feed absent -> ledger
       settles on any gold bars) is the honest answer and the current
       behaviour; both left unchanged.

     - fundingPct (hg-v985): XAUUSD has no funding. hg-v985 itself says
       "no funding on an OMNIGOLD record, said rather than hidden: this
       desk never fetches the Binance PAXG leg". Same applies here.

     No new weight, no gate reads any of these, no setup leaves any board.
     Only the hg-v1358 forward LEDGER record changes shape -- the panel,
     the vote tallies and the handoff are untouched (asserted). */
  var cand = {
    sym: 'XAUUSD',
    dir: built.side,
    entry: built.entry,
    stop: built.stop,
    t1: built.t1,
    ticket: true
  };
  /* hg-v1458: stale-signal record-only mark. The plan that led the
     median carries its own signal instant (hg-v1389); when that instant
     is more than eight hours before this scan, the record says so.
     Counted, never gated: the stopped-out and travelled-most-of-the-way
     checks above already stand aside a plan the tape has finished with,
     and hg-v966 refuses an unmeasured new gate. No instant, or no scan
     clock, leaves the mark absent (hg-v989 three-state). The instant is
     read signalT-first then barT — the same preference order the
     goldShut leg below uses, never the scan clock alone. */
  if (built.reads && typeof built.reads === 'object'){
    var sigSec = NaN;
    if (typeof built.signalT === 'number' && isFinite(built.signalT) && built.signalT > 0) sigSec = Math.floor(built.signalT / 1000);
    else if (typeof built.barT === 'number' && isFinite(built.barT) && built.barT > 0) sigSec = Math.floor(built.barT > 1e12 ? built.barT / 1000 : built.barT);
    if (isFinite(sigSec) && sigSec > 0 && typeof built.at === 'number' && isFinite(built.at) && built.at > 0){
      built.reads['cf:staleSignal'] = (Math.floor(built.at / 1000) - sigSec) > 8 * 3600;
    }
  }
  if (built.reads && typeof built.reads === 'object'){
    var rr = {}, rk, rv, rn = 0;
    for (rk in built.reads){
      if (!Object.prototype.hasOwnProperty.call(built.reads, rk)) continue;
      rv = built.reads[rk];
      if (rv !== true && rv !== false) continue;
      rr[rk] = rv;
      rn++;
    }
    if (rn) cand.reads = rr;
  }
  if (typeof built.mark === 'number' && isFinite(built.mark) && built.mark > 0) cand.mark = built.mark;
  if (typeof built.barT === 'number' && isFinite(built.barT) && built.barT > 0) cand.barT = built.barT;
  if (typeof built.signalT === 'number' && isFinite(built.signalT) && built.signalT > 0) cand.signalT = built.signalT;
  /* hg-v953 gold weekend mark, hg-v1390 (defect #1 fix): the instant MUST be
     the SIGNAL BAR, never the scan clock. hg-v953/v977 doctrine is strict on
     this: "the instant it was FORMED ON, in seconds, read from whatever the
     desk that produced it recorded -- never Date.now()". The hg-v1389 pack
     propagated built.signalT/built.barT correctly through the vote model
     for the record's own barT (seven lines above) but then DROPPED them at
     this leg, reading built.at (= Date.now(), set at :920) instead. The
     hg-v932 "work done upstream, dropped at the handoff" shape in my own
     just-shipped pack. Failure mode measured by the hg-v1389 audit:
     - Saturday scan over cached Friday 21:30 UTC signals wrote shut:true
       on a plan formed Friday-before-close (which is NOT in the weekend)
     - Monday-early-UTC edge-of-weekend scans misattributed both ways
     Fix: PREFER built.signalT (ms, /1000), then built.barT (seconds, direct),
     then fall back to built.at (ms, /1000) for backward compatibility --
     each guarded with the same typeof/isFinite/>0 shape the barT/mark/
     signalT leg above uses. A missing instant leaves cand.goldShut
     undefined (hg-v989 three-state), never coerced to false. */
  if (typeof win.hgInGoldWeekend === 'function'){
    var atSec = NaN;
    if (typeof built.signalT === 'number' && isFinite(built.signalT) && built.signalT > 0){
      atSec = Math.floor(built.signalT / 1000);
    } else if (typeof built.barT === 'number' && isFinite(built.barT) && built.barT > 0){
      atSec = built.barT;
    } else if (typeof built.at === 'number' && isFinite(built.at) && built.at > 0){
      atSec = Math.floor(built.at / 1000);
    }
    if (isFinite(atSec) && atSec > 0){
      try{
        var shut = win.hgInGoldWeekend(atSec);
        cand.goldShut = (shut === true) ? true : (shut === false ? false : undefined);
      }catch(eW){}
    }
  }
  try{
    win.hgFwdRecordScan('CONFLUENCE', '15m', [cand]);
    lastFwdKey = key;
  }catch(e){}
}

async function readAnchor(win){
  var a = null;
  try{
    if (win && typeof win.hgGoldIuxAnchor === 'function') a = await win.hgGoldIuxAnchor();
  }catch(e0){ a = null; }
  if (a && num(a.px) > 0) return { px: +a.px, at: a.at || Date.now(), src: a.src || 'gold-api' };
  try{
    if (win && typeof win.hgGoldIuxAnchorCached === 'function'){
      var c = win.hgGoldIuxAnchorCached();
      if (c && num(c.px) > 0) return { px: +c.px, at: c.at || Date.now(), src: c.src || 'gold-api' };
    }
  }catch(e1){}
  try{
    if (!win || typeof win.fetch !== 'function') return null;
    var r = await win.fetch('/api/proxy?url=' + encodeURIComponent('https://api.gold-api.com/price/XAU'), { cache: 'no-store' });
    if (!r || !r.ok || typeof r.json !== 'function') return null;
    var j = await r.json();
    var p = j ? num(j.price != null ? j.price : j.px) : NaN;
    if (!(p > 1000 && p < 20000)) return null;
    return { px: p, at: Date.now(), src: 'gold-api' };
  }catch(e2){ return null; }
}

async function hgGoldConfluenceScan(win, opts){
  win = win || W;
  opts = opts || {};
  var extra = { snaps: {}, notes: {} };
  if (opts.gather){
    try{ extra = await hgGoldConfluenceGather(win, opts.onProgress); }catch(eG){ extra = { snaps: {}, notes: {} }; }
  }
  var votes = hgGoldConfluenceRead(win, extra);
  var iux = await readAnchor(win);
  var cost = { spreadUsd: measuredSpread(win) };
  if (opts.gather && !scanHarness(win)){
    try{
      var tape = await pineBars(win);
      if (tape && ((tape.rows15m && tape.rows15m.length) || (tape.rows4h && tape.rows4h.length) || (tape.rows1h && tape.rows1h.length))){
        cost.rows15m = tape.rows15m;
        cost.rows1h = tape.rows1h;
        cost.rows4h = tape.rows4h;
        cost.rows1d = tape.rows1d;
      }
    }catch(eTape){}
  }
  var built = hgGoldConfluenceBuild(votes, iux, cost);
  built.at = Date.now();
  if (!scanHarness(win)) recordConfluence(win, built);
  return built;
}

function bitOf(v){
  if (!v) return '';
  if (v.state === 'setup'){
    var s = v.side.toUpperCase() + ' ' + fmt(v.entry) + ' / ' + fmt(v.stop) + ' / ' + fmt(v.t1);
    if (v.derived){
      s += v.sameAs
        ? (' (same idea as ' + v.sameAs + ', not a second vote)')
        : (' (reads ' + (v.reads || 'another gold desk') + ', not a separate vote)');
    } else if (v.echo) s += ' (same plan as another desk, not a second vote)';
    return s;
  }
  if (v.note) return v.note;
  if (v.state === 'context') return v.note || 'context';
  return v.state;
}
function rrText(card){
  if (!card) return '-';
  if (isFinite(card.netRr)) return fmt(card.netRr) + 'R net';
  if (isFinite(card.rr)) return fmt(card.rr) + (card.spreadUsd == null ? 'R gross' : 'R');
  return '-';
}
function cfReadNote(built){
  var src = (built && built.reads) ? built : ((built && built.watch && built.watch.reads) ? built.watch : null);
  if (!src || !src.reads) return '';
  var bits = [];
  if (src.reads['cf:synthetic'] === true && src.leader){
    bits.push('The printed levels are not one desk plan. Nearest desk is ' + (src.leader.desk || 'a desk')
      + ' at ' + fmt(src.leader.entry) + ' / ' + fmt(src.leader.stop) + ' / ' + fmt(src.leader.t1)
      + '. The trade on this card is that desk, not a blend. This read does not change the gate.');
  }
  if (src.reads['cf:familyShort'] === true){
    bits.push('Fewer than three independent families. Counted on the record, not gated.');
  }
  if (src.reads['cf:sessionSplit'] === true){
    bits.push('Signal bars are not one session. Counted on the record, not gated.');
  }
  if (src.reads['cf:staleSignal'] === true){
    bits.push('The plan that led this card was formed more than eight hours before this scan. Counted on the record, not gated.');
  }
  if (!bits.length) return '';
  return '<div class="hg-note">' + esc(bits.join(' ')) + '</div>';
}
function levelCard(title, card){
  return '<div class="hg-desk-card">'
    + '<div class="hg-desk-top"><div class="hg-desk-sym">' + esc(title) + '</div></div>'
    + '<div class="hg-desk-levels">'
    + '<div><div class="k">ENTRY</div><div class="v">' + fmt(card.entry) + '</div></div>'
    + '<div><div class="k">STOP</div><div class="v">' + fmt(card.stop) + '</div></div>'
    + '<div><div class="k">TP1</div><div class="v">' + fmt(card.t1) + '</div></div>'
    + '<div><div class="k">IUX</div><div class="v">' + fmt(card.mark) + '</div></div>'
    + '<div><div class="k">RR</div><div class="v">' + rrText(card) + '</div></div>'
    + '</div></div>';
}
function paint(root, built){
  var desk = root.querySelector('#gc-desk');
  var stat = root.querySelector('#gc-stat');
  if (!desk || !built) return;
  if (stat) stat.textContent = built.ready ? 'ONE SETUP' : (built.pair && built.pair.length ? 'TWO SETUPS' : (built.watch ? 'WATCH' : 'STAND ASIDE'));
  var voteHtml = (built.votes || []).map(function(v){
    return '<div class="hg-note">' + esc(v.desk) + ' — ' + esc(bitOf(v)) + '</div>';
  }).join('');
  var plan = '';
  if (built.ready){
    plan = levelCard('XAUUSD · ' + built.side.toUpperCase(), built);
  } else if (built.pair && built.pair.length){
    plan = built.pair.map(function(c){
      return levelCard(c.desk + ' · ' + String(c.side || '').toUpperCase(), c);
    }).join('');
  } else if (built.watch){
    var w = built.watch;
    /* hg-v1391: a watch now carries three distinct reasons -- "awaiting
       third desk" (1-2 same-side published), "desks disagree" (longs AND
       shorts, dominant side shown), "off-scale from IUX" (3+ agree but
       off the live print). The label travels on the watch so the header
       names which case the user is reading, and no reader has to look
       up the reason in prose. */
    plan = levelCard('WATCH · ' + (w.label || (w.count + ' OF ' + w.need)), w);
    if (w.aside && w.aside.length) plan += '<div class="hg-note">Stood aside: ' + esc(w.aside.join(', ')) + '</div>';
  } else if (isFinite(built.entry) && isFinite(built.stop) && isFinite(built.t1)){
    plan = levelCard('STOOD ASIDE · ' + String(built.side || '').toUpperCase(), built);
  }
  var cost = '';
  var note = (built.watch && built.watch.costNote) || built.costNote || '';
  if (note && (!built.reason || built.reason.indexOf(note) < 0)) cost = '<div class="hg-note">' + esc(note) + '</div>';
  desk.innerHTML = '<div class="hg-note">' + esc(built.reason || '') + '</div>' + plan + cfScoreNote(built) + cfReadNote(built) + cost + voteHtml;
}

var scanGen = 0;
var lastRoot = null;
function mount(root){
  if (!root) return;
  lastRoot = root;
  root.innerHTML = '<div class="panel"><h2>CONFLUENCE <span>one setup from the gold desks, priced on the live IUX gold quote</span></h2>'
    + '<button type="button" class="btn" id="gc-run">SCAN GOLD DESKS</button>'
    + '<div class="hg-note" id="gc-stat">No scan yet.</div>'
    + '<div id="gc-desk"><div class="hg-note">Unread means that desk has not published a plan. Opening this tab scans the gold desks and waits until each scan finishes. Two plans on the same side, both on the live price, are a setup. One or more plans on the other side do not remove it when this side is larger. A tie shows both plans and does not blend them. A wide cluster and a spread under 1R are named and do not remove it. The entry, the stop, and the target are the nearest desk\'s own plan. Other desks confirm the side. Stops and targets are not averaged. When two or more plans are crowned, that plan is chosen from the crowned ones. The 100-point score is printed when the gold tape is in hand. It does not remove a setup. It is not the live IUX print. One desk is a watch. A price that has already reached the stop is stood aside. SUPER GOLD and MILLI GOLD are not a second vote when the desk they read already published. GOLD DIRECTION still needs your own LONG or SHORT. CANDLE FORECAST is not a vote and does not form a setup. When the forming plans disagree on where risk lives — a stop distance outside 0.5×–2× of the pack median — the card keeps the nearest desk\'s own stop and names the disagreement. It does not remove the setup.</div>'
    + '<div class="hg-note">MEASURED (hg-v1445, this gate, 360 four-hour closes 29 Aug-28 Oct 2026, IUX anchor = the PAXG close, spread unread): GOLD SCALP, GOLD SWING and SUPER GOLD cast no vote. Every ranked plan was already demoted. GOLD PINE crowned 35 times, which is one desk. Ready stayed 0 in both halves. Three independent crowns are still required. Omnigold, newgold, ganesh, goldultra and the other gold desks were not re-walked on this tape, so this does not replace the longer READY census. No gate change. The second half is the forward window.</div>'
    + '<div class="hg-note">The levels on a setup are one desk\'s own plan, the plan whose entry sits nearest the median entry. A same-family count and a session split are written on the forward record and do not change ready. The 100-point score is a label. It does not change ready.</div></div></div>';
  var btn = root.querySelector('#gc-run');
  var stat = root.querySelector('#gc-stat');
  function go(doGather){
    var mine = ++scanGen;
    if (btn) btn.disabled = true;
    if (stat) stat.textContent = doGather ? 'Scanning gold desks…' : 'Reading…';
    return hgGoldConfluenceScan(W, {
      gather: !!doGather,
      onProgress: function(msg){ if (mine === scanGen && stat) stat.textContent = msg; }
    }).then(function(built){
      if (mine !== scanGen) return built;
      if (btn) btn.disabled = false;
      paint(root, built);
      return built;
    }).catch(function(){
      if (mine !== scanGen) return null;
      if (btn) btn.disabled = false;
      if (stat) stat.textContent = 'Scan did not finish';
      return null;
    });
  }
  if (btn) btn.addEventListener('click', function(){ return go(true); });
  go(true);
}

async function refresh(){
  try{
    var built = await hgGoldConfluenceScan(W, { gather: !scanHarness(W) });
    if (lastRoot) paint(lastRoot, built);
    if (!built) return 'error';
    return built.ready ? 'setup' : (built.watch ? 'watch' : 'stand aside');
  }catch(e){ return 'error'; }
}

W.hgGoldConfluenceRead = hgGoldConfluenceRead;
W.hgGoldConfluenceBuild = hgGoldConfluenceBuild;
W.hgGoldConfluenceScan = hgGoldConfluenceScan;
W.hgGoldConfluenceGather = hgGoldConfluenceGather;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CONFLUENCE', mount: mount, refresh: refresh });
})();
