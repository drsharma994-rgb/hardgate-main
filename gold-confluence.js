/* CONFLUENCE — one gold setup from the gold desks.
   A desk with no scan is not a vote. SCAN runs the desks that can scan
   without their own tab open, then reads what they published. The live
   price is the IUX anchor (gold-iux.js, gold-api XAU). The entry is the
   median of the agreeing plans that sit on that price. It is not moved
   to the live print. No anchor, no setup. A copy of another desk plan
   is not a second vote. */
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

var UNREAD_WHY = {
  goldscalp: 'not scanned yet. Press SCAN GOLD DESKS.',
  goldswing: 'not scanned yet. Press SCAN GOLD DESKS.',
  'super-gold': 'not scanned yet. It reads GOLD SCALP and GOLD SWING after they have run.',
  goldpine: 'not scanned yet. Press SCAN GOLD DESKS.',
  golddirection: 'needs your LONG or SHORT on GOLD DIRECTION. This tab does not pick a side for you.',
  goldultra: 'scans only while GOLD ULTRA is open.',
  ganeshgold: 'not scanned yet. Press SCAN GOLD DESKS.',
  optigold: 'scans only while OPTI GOLD is open.',
  newgold: 'not scanned yet. Press SCAN GOLD DESKS.',
  omnigold: 'scans only while OMNIGOLD is open.',
  omnigold1: 'scans only while OMNIGOLD 1 is open.',
  goldpro: 'scans only while GOLD PRO is open.',
  milligold: 'reads OMNIGOLD. It has no plan until that desk has scanned.',
  '80percent': 'scans only while 80PERCENT is open.',
  gold: 'the GOLD tab has not published a plan yet. Press SCAN GOLD DESKS.',
  'candle-forecast': 'arms a bracket only after CANDLE FORECAST has run.'
};

function warmup(win, id){
  var list = (win && win.HG_warmups) || [];
  var i, w;
  for (i = 0; i < list.length; i++){
    w = list[i];
    if (w && w.id === id && typeof w.run === 'function') return w.run;
  }
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
    notes[id] = 'this tab asked ' + desk.label + ' to scan. The scan did not finish.';
    return;
  }
  notes[id] = 'this tab asked ' + desk.label + ' to scan. It still published no plan.';
}
async function hgGoldConfluenceGather(win){
  win = win || W;
  var snaps = {};
  var notes = {};
  if (scanHarness(win)) return { snaps: snaps, notes: notes };
  var order = ['goldscalp', 'goldswing', 'super-gold', 'goldultra', 'ganeshgold', 'newgold', 'goldpine'];
  var i, id, fn, snap, desk, msg;
  for (i = 0; i < order.length; i++){
    id = order[i];
    desk = null;
    for (var d = 0; d < DESKS.length; d++) if (DESKS[d].id === id) desk = DESKS[d];
    if (!desk) continue;
    try{ snap = desk.read(win); }catch(e0){ snap = null; }
    if (snap != null) continue;
    if (id === 'ganeshgold' && typeof win.ganeshGoldScan === 'function'){
      msg = await limit(win.ganeshGoldScan({ style: 'scalp' }), 25000);
      try{ snap = desk.read(win); }catch(eGan){ snap = null; }
      noteIfEmpty(notes, id, desk, snap, msg);
      continue;
    }
    if (id === 'newgold' && typeof win.ngRunScan === 'function'){
      msg = await limit(win.ngRunScan(), 25000);
      try{ snap = desk.read(win); }catch(eNg){ snap = null; }
      noteIfEmpty(notes, id, desk, snap, msg);
      continue;
    }
    fn = warmup(win, id);
    if (fn){
      msg = await limit(fn(), 25000);
      try{ snap = desk.read(win); }catch(eW){ snap = null; }
      noteIfEmpty(notes, id, desk, snap, msg);
    }
  }
  try{
    snap = null;
    var pineDesk = null;
    for (d = 0; d < DESKS.length; d++) if (DESKS[d].id === 'goldpine') pineDesk = DESKS[d];
    if (pineDesk) snap = pineDesk.read(win);
  }catch(e1){ snap = null; }
  if (snap == null && typeof win.runGoldPineScan === 'function'){
    try{
      var bars = await pineBars(win);
      if (bars && ((bars.rows4h && bars.rows4h.length) || (bars.rows15m && bars.rows15m.length))){
        var pineSnap = win.runGoldPineScan(bars, {}) || null;
        if (pineSnap) snaps.goldpine = pineSnap;
        else notes.goldpine = 'this tab asked GOLD PINE to scan. It still published no plan.';
      }
    }catch(e2){}
  }
  if (typeof win.runGold === 'function' && !win.__hgInlineGold && !win.__hgGoldSetupDecision){
    await limit(win.runGold(), 25000);
    if (typeof win.runGoldSetup === 'function') await limit(win.runGoldSetup(), 25000);
    if (!win.__hgInlineGold && !win.__hgGoldSetupDecision){
      notes.gold = 'this tab asked the GOLD tab to scan. It still published no plan.';
    }
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
    votes.push({ desk: d.label, id: d.id, state: 'setup', side: v.side, entry: v.entry, stop: v.stop, t1: v.t1 });
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
function markEcho(setups){
  var kept = [];
  setups.forEach(function(v){
    var echo = kept.some(function(k){ return samePlan(k, v); });
    if (echo) v.echo = true;
    else kept.push(v);
  });
  return kept;
}

function hgGoldConfluenceBuild(votes, iux){
  votes = Array.isArray(votes) ? votes : [];
  var px = iux && num(iux.px);
  var setups = votes.filter(function(v){ return v && v.state === 'setup'; });
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
    iux: (px > 0) ? { px: px, at: iux.at || null, src: iux.src || 'gold-api' } : null
  };
  if (!(px > 0)){
    base.reason = 'The live IUX gold price was not read, so no setup is formed.';
    return base;
  }
  if (longs.length && shorts.length){
    base.reason = longs.length + ' gold desk' + (longs.length === 1 ? '' : 's') + ' published long and ' + shorts.length + ' published short. A setup on the other side stands this plan aside.';
    return base;
  }
  var side = null, pack = null;
  if (longs.length >= 3){ side = 'long'; pack = longs; }
  else if (shorts.length >= 3){ side = 'short'; pack = shorts; }
  else {
    var who = live.map(function(v){ return v.desk + ' ' + v.side.toUpperCase(); }).join(', ');
    base.reason = live.length
      ? (nDesk(live.length) + ' published a priced setup' + (who ? ' (' + who + ')' : '') + '. ' + longs.length + ' long, ' + shorts.length + ' short. Three on the same side are required, and the other side must be empty. A desk that has not run is not a vote, and a copy of the same plan is not a second vote.')
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

async function hgGoldConfluenceScan(win, opts){
  win = win || W;
  opts = opts || {};
  var extra = { snaps: {}, notes: {} };
  if (opts.gather){
    try{ extra = await hgGoldConfluenceGather(win); }catch(eG){ extra = { snaps: {}, notes: {} }; }
  }
  var votes = hgGoldConfluenceRead(win, extra);
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
  if (v.state === 'setup'){
    var s = v.side.toUpperCase() + ' ' + fmt(v.entry) + ' / ' + fmt(v.stop) + ' / ' + fmt(v.t1);
    if (v.echo) s += ' (same plan as another desk, not a second vote)';
    return s;
  }
  if (v.note) return v.note;
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
    + '<button type="button" class="btn" id="gc-run">SCAN GOLD DESKS</button>'
    + '<div class="hg-note" id="gc-stat">No scan yet.</div>'
    + '<div id="gc-desk"><div class="hg-note">Unread means that desk has not published a plan. This tab does not invent one. SCAN GOLD DESKS runs the desks that can scan on their own, then keeps a setup only when three different plans agree. The entry is their median, not the live IUX print.</div></div></div>';
  var btn = root.querySelector('#gc-run');
  var stat = root.querySelector('#gc-stat');
  function go(doGather){
    if (btn) btn.disabled = true;
    if (stat) stat.textContent = doGather ? 'Scanning gold desks…' : 'Reading…';
    return hgGoldConfluenceScan(W, { gather: !!doGather }).then(function(built){
      if (btn) btn.disabled = false;
      paint(root, built);
      return built;
    }).catch(function(){
      if (btn) btn.disabled = false;
      if (stat) stat.textContent = 'STAND ASIDE';
      return null;
    });
  }
  if (btn) btn.addEventListener('click', function(){ return go(true); });
  go(false);
}

async function refresh(){
  try{ return (await hgGoldConfluenceScan(W)).ready ? 'setup' : 'stand aside'; }
  catch(e){ return 'error'; }
}

W.hgGoldConfluenceRead = hgGoldConfluenceRead;
W.hgGoldConfluenceBuild = hgGoldConfluenceBuild;
W.hgGoldConfluenceScan = hgGoldConfluenceScan;
W.hgGoldConfluenceGather = hgGoldConfluenceGather;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CONFLUENCE', mount: mount, refresh: refresh });
})();
