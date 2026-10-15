/* CONFLUENCE — one gold setup from the gold desks that have already published one.
   A desk with no scan is not a vote. The live price is the IUX anchor
   (gold-iux.js, gold-api XAU). The entry is the median of the agreeing plans
   that sit on that price. It is not moved to the live print. No anchor, no setup.
   This tab does not fetch candles of its own. It reads published snapshots. */
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
  { id: 'goldpine', label: 'GOLD PINE', read: function(w){ return callFn(w, 'goldPineScan'); } },
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
  { id: 'candle-forecast', label: 'CANDLE FORECAST', read: function(w){ return callFn(w, 'hgCandleForecastAlertState'); } },
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
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
function median(xs){
  var s = xs.filter(function(n){ return isFinite(n); }).slice().sort(function(a, b){ return a - b; });
  if (!s.length) return NaN;
  var m = Math.floor(s.length / 2);
  if (s.length % 2) return s[m];
  return (s[m - 1] + s[m]) / 2;
}
function ordered(side, entry, stop, t1){
  if (!(entry > 0 && stop > 0 && t1 > 0) || entry === stop) return false;
  if (side === 'long') return stop < entry && entry < t1;
  if (side === 'short') return t1 < entry && entry < stop;
  return false;
}
function rowOf(o){
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.vetoed === true || o.demoted === true || o.dropped === true || o.aside === true) return null;
  if (o.recordOnly === true) return null;
  if (o.verdict && o.verdict.qualifies === false) return null;
  var side = sideOf(o.dir || o.side || o.direction);
  if (!side) return null;
  var entry = num(o.entry);
  var stop = num(o.stop != null ? o.stop : o.stopLoss);
  var t1 = num(o.t1 != null ? o.t1 : (o.tp1 != null ? o.tp1 : (o.tp != null ? o.tp : o.takeProfit)));
  if (!ordered(side, entry, stop, t1)) return null;
  return { side: side, entry: entry, stop: stop, t1: t1, grade: o.grade || null };
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
    || item.ticket === true);
  rows.push(row);
}
function listsOf(snap){
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
  var leads = rows.filter(function(r){ return r.lead; });
  return leads.length ? leads : rows;
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
    if (snap.fire === false || snap.recordOnly === true) return [];
    var up = rowOf(snap.setups.pick);
    return up ? [up] : [];
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
  return { split: false, side: side, entry: best.entry, stop: best.stop, t1: best.t1 };
}

function hgGoldConfluenceRead(win){
  win = win || W;
  var votes = [];
  DESKS.forEach(function(d){
    var snap;
    try{ snap = d.read(win); }catch(e){ snap = null; }
    if (snap === undefined){
      votes.push({ desk: d.label, id: d.id, state: 'absent' });
      return;
    }
    if (snap === null){
      votes.push({ desk: d.label, id: d.id, state: 'unread' });
      return;
    }
    if (snap.__context){
      votes.push({ desk: d.label, id: d.id, state: 'context', note: snap.__context });
      return;
    }
    var plans = plansFrom(snap);
    if (!plans.length){
      votes.push({ desk: d.label, id: d.id, state: 'none' });
      return;
    }
    var v = oneVote(plans);
    if (v.split){
      votes.push({ desk: d.label, id: d.id, state: 'split' });
      return;
    }
    votes.push({ desk: d.label, id: d.id, state: 'setup', side: v.side, entry: v.entry, stop: v.stop, t1: v.t1 });
  });
  return votes;
}

function onScale(entry, iuxPx){
  if (!(iuxPx > 0) || !(entry > 0)) return false;
  return Math.abs(entry / iuxPx - 1) <= 0.025;
}

function hgGoldConfluenceBuild(votes, iux){
  votes = Array.isArray(votes) ? votes : [];
  var px = iux && num(iux.px);
  var setups = votes.filter(function(v){ return v && v.state === 'setup'; });
  var longs = setups.filter(function(v){ return v.side === 'long'; });
  var shorts = setups.filter(function(v){ return v.side === 'short'; });
  var base = {
    ok: true,
    ready: false,
    votes: votes,
    longCount: longs.length,
    shortCount: shorts.length,
    published: setups.length,
    iux: (px > 0) ? { px: px, at: iux.at || null, src: iux.src || 'gold-api' } : null
  };
  if (!(px > 0)){
    base.reason = 'The live IUX gold price was not read, so no setup is formed.';
    return base;
  }
  if (longs.length && shorts.length){
    base.reason = longs.length + ' gold desks published long and ' + shorts.length + ' published short. A setup on the other side stands this plan aside.';
    return base;
  }
  var side = null, pack = null;
  if (longs.length >= 3){ side = 'long'; pack = longs; }
  else if (shorts.length >= 3){ side = 'short'; pack = shorts; }
  else {
    base.reason = setups.length
      ? (setups.length + ' gold desks published a setup. ' + longs.length + ' long, ' + shorts.length + ' short. Three on the same side are required, and the other side must be empty.')
      : 'No gold desk has published a setup yet. A desk that has not scanned is not a vote.';
    return base;
  }
  var priced = pack.filter(function(v){ return onScale(v.entry, px); });
  var off = pack.length - priced.length;
  if (priced.length < 2){
    base.side = side;
    base.reason = 'The desks agree ' + side + ', but fewer than two of those plans sit within 2.5% of the live IUX price (' + fmt(px) + ').';
    return base;
  }
  var entry = +median(priced.map(function(v){ return v.entry; })).toFixed(2);
  var stop = +median(priced.map(function(v){ return v.stop; })).toFixed(2);
  var t1 = +median(priced.map(function(v){ return v.t1; })).toFixed(2);
  if (!ordered(side, entry, stop, t1)){
    base.side = side;
    base.reason = 'The median entry, stop, and target are not in order, so no setup is formed.';
    return base;
  }
  var risk = Math.abs(entry - stop);
  var reward = Math.abs(t1 - entry);
  var rr = risk > 0 ? +(reward / risk).toFixed(2) : NaN;
  var through = (side === 'long') ? (px - entry) / (t1 - entry) : (entry - px) / (entry - t1);
  if (through >= 0.85){
    base.side = side;
    base.entry = entry;
    base.stop = stop;
    base.t1 = t1;
    base.reason = 'The live IUX price has already travelled most of the way to the target. The entry is not moved up to ' + fmt(px) + '.';
    return base;
  }
  base.ready = true;
  base.side = side;
  base.entry = entry;
  base.stop = stop;
  base.t1 = t1;
  base.rr = rr;
  base.mark = px;
  base.deskCount = priced.length;
  base.offChart = off;
  base.desks = priced.map(function(v){ return v.desk; });
  base.reason = priced.length + ' desks agree ' + side.toUpperCase()
    + '. Entry ' + fmt(entry) + ' is the median of their plans, not the live print ' + fmt(px) + '.';
  return base;
}

async function hgGoldConfluenceScan(win){
  win = win || W;
  var votes = hgGoldConfluenceRead(win);
  var iux = null;
  try{
    if (typeof win.hgGoldIuxAnchor === 'function'){
      var a = await win.hgGoldIuxAnchor();
      if (a && num(a.px) > 0) iux = { px: +a.px, at: a.at || Date.now(), src: a.src || 'gold-api' };
    }
  }catch(e){ iux = null; }
  var built = hgGoldConfluenceBuild(votes, iux);
  built.at = Date.now();
  return built;
}

function bitOf(v){
  if (!v) return '';
  if (v.state === 'setup') return v.side.toUpperCase() + ' ' + fmt(v.entry) + ' / ' + fmt(v.stop) + ' / ' + fmt(v.t1);
  if (v.state === 'context') return v.note || 'context';
  return v.state;
}
function paint(root, built){
  var desk = root.querySelector('#gc-desk');
  var stat = root.querySelector('#gc-stat');
  if (!desk || !built) return;
  if (stat) stat.textContent = built.ready ? 'ONE SETUP' : 'STAND ASIDE';
  var voteHtml = (built.votes || []).map(function(v){
    return '<div class="hg-note">' + esc(v.desk) + ' — ' + esc(bitOf(v)) + '</div>';
  }).join('');
  var plan = '';
  if (built.ready){
    plan = '<div class="hg-desk-card">'
      + '<div class="hg-desk-top"><div class="hg-desk-sym">XAUUSD · ' + esc(built.side.toUpperCase()) + '</div></div>'
      + '<div class="hg-desk-levels">'
      + '<div><div class="k">ENTRY</div><div class="v">' + fmt(built.entry) + '</div></div>'
      + '<div><div class="k">STOP</div><div class="v">' + fmt(built.stop) + '</div></div>'
      + '<div><div class="k">TP1</div><div class="v">' + fmt(built.t1) + '</div></div>'
      + '<div><div class="k">IUX</div><div class="v">' + fmt(built.mark) + '</div></div>'
      + '<div><div class="k">RR</div><div class="v">' + (isFinite(built.rr) ? fmt(built.rr) + 'R' : '-') + '</div></div>'
      + '</div></div>';
  }
  desk.innerHTML = '<div class="hg-note">' + esc(built.reason || '') + '</div>' + plan + voteHtml;
}

function mount(root){
  if (!root) return;
  root.innerHTML = '<div class="panel"><h2>CONFLUENCE <span>one setup from the gold desks, priced on the live IUX gold quote</span></h2>'
    + '<button type="button" class="btn" id="gc-run">READ GOLD DESKS</button>'
    + '<div class="hg-note" id="gc-stat">No read yet.</div>'
    + '<div id="gc-desk"><div class="hg-note">This tab does not invent a setup. It reads the plans the gold desks have already published. Three must agree on the side, and none of them may have published the other side. The entry is their median, and only if those prices sit on the live IUX quote.</div></div></div>';
  var btn = root.querySelector('#gc-run');
  function go(){
    if (btn) btn.disabled = true;
    return hgGoldConfluenceScan(W).then(function(built){
      if (btn) btn.disabled = false;
      paint(root, built);
      return built;
    }).catch(function(){
      if (btn) btn.disabled = false;
      return null;
    });
  }
  if (btn) btn.addEventListener('click', go);
  go();
}

async function refresh(){
  try{ return (await hgGoldConfluenceScan(W)).ready ? 'setup' : 'stand aside'; }
  catch(e){ return 'error'; }
}

W.hgGoldConfluenceRead = hgGoldConfluenceRead;
W.hgGoldConfluenceBuild = hgGoldConfluenceBuild;
W.hgGoldConfluenceScan = hgGoldConfluenceScan;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CONFLUENCE', mount: mount, refresh: refresh });
})();
