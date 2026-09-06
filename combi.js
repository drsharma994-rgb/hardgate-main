/* =========================================================================
   HARDGATE — combi.js
   COMBI tab: merge every crypto desk snapshot into one ranked board and
   surface the single MOST PROBABLE setup across the house.

   Read-only aggregator — never invents levels. Harvests module scan snaps,
   SETUP CONFIRM sources, and inline-tab cards captured via hgMpSnapHarvest.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;

var SHOW_MAX = 20;
var AUTO_WARM_MS = 10 * 60 * 1000;
var MIN_AGREE_SOURCES = 2;

var __cb = { busy: false, ran: false, ui: null, snap: null, lastCardsHtml: '' };

function gfn(n){ return (W && typeof W[n] === 'function') ? W[n] : null; }
function fin(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cbKey(sym, dir){
  if (gfn('hgConfirmKey')) return W.hgConfirmKey(sym, dir);
  var base = gfn('hgCryptoBase') ? W.hgCryptoBase(sym) : String(sym || '').toUpperCase();
  dir = String(dir || '').toLowerCase();
  if (dir === 'buy' || dir === 'l') dir = 'long';
  if (dir === 'sell' || dir === 's') dir = 'short';
  return base + '|' + dir;
}

function cbNormRow(raw, meta){
  meta = meta || {};
  var row = gfn('hgNormalizeSetupRow') ? W.hgNormalizeSetupRow(raw) : null;
  if (!row) return null;
  row.source = meta.source || row.source || '';
  row.sourceLabel = meta.label || meta.source || '';
  row.sourceWeight = fin(meta.weight) || 1;
  row.sourceAt = meta.at || 0;
  row.sourceStale = !!meta.stale;
  if (meta.clean) row.clean = true;
  if (meta.near) { row.near = true; row.clean = false; }
  if (meta.forming) { row.forming = true; row.clean = false; row.near = false; }
  row.scanner = meta.source || row.scanner;
  return row;
}

function cbCollect(snap){
  return gfn('hgCollectSetupRows') ? W.hgCollectSetupRows(snap) : [];
}

function cbHarvestExtra(){
  var bag = [], i, j, s, rows, r, row, lv;

  if (gfn('hgObtcState')){
    try{
      s = W.hgObtcState();
      rows = (s && s.candidates) || [];
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (!r || !r.dir) continue;
        row = cbNormRow(r, {
          source: 'omnibtc', label: 'OMNIBTC', weight: 2.5, at: s.at,
          clean: !!r.clean, near: !!r.near
        });
        if (row) bag.push(row);
      }
    }catch(eOb){}
  }

  if (gfn('hgOpState')){
    try{
      s = W.hgOpState();
      rows = (s && s.rows) || [];
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (!r || !r.dir) continue;
        row = cbNormRow(Object.assign({}, r, r.plan || {}), {
          source: 'omnipresent', label: 'OMNIPRESENT', weight: 2, at: s.at,
          clean: !!(r.grade && r.grade.ticket), near: r.status === 'TRIGGERED' && !(r.grade && r.grade.ticket)
        });
        if (row) bag.push(row);
      }
    }catch(eOp){}
  }

  if (gfn('reversalSniperScan')){
    try{
      s = W.reversalSniperScan();
      rows = (s && s.results) || [];
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (!r || !r.setup || !r.setup.dir) continue;
        row = cbNormRow(Object.assign({ sym: r.sym }, r.setup), {
          source: 'reversalsniper', label: 'REV SNIPER', weight: 2, at: s.at,
          clean: !!(r.setup && r.setup.ticket), near: true
        });
        if (row) bag.push(row);
      }
    }catch(eRs){}
  }

  if (gfn('liqsState')){
    try{
      s = W.liqsState();
      if (s && s.setup && s.setup.dir){
        row = cbNormRow(s.setup, {
          source: 'liqs', label: 'LIQS', weight: 1.5, at: s.at, clean: !!s.setup.ticket
        });
        if (row) bag.push(row);
      }
    }catch(eLq){}
  }

  if (gfn('chartVisionState')){
    try{
      s = W.chartVisionState();
      rows = (s && s.results) || [];
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (!r || !r.dir) continue;
        row = cbNormRow(r, {
          source: 'chartvision', label: 'CHART VISION', weight: 1.5, at: s.at,
          clean: !!r.clean7, near: !r.clean7
        });
        if (row) bag.push(row);
      }
    }catch(eCv){}
  }

  if (gfn('carryState')){
    try{
      s = W.carryState();
      if (s && s.topCard && s.topCard.levels){
        lv = s.topCard.levels;
        row = cbNormRow({
          sym: s.topCard.pair || s.topCard.base,
          dir: lv.dir || 'short',
          entry: lv.entry, stop: lv.stop, t1: lv.t1, t2: lv.t2
        }, { source: 'carry', label: 'CARRY', weight: 1, at: s.at, clean: true });
        if (row) bag.push(row);
      }
    }catch(eCr){}
  }

  if (gfn('venuePremiumState')){
    try{
      s = W.venuePremiumState();
      if (s && s.dir && s.entry){
        row = cbNormRow(s, {
          source: 'venueprem', label: 'VENUE', weight: 1, at: s.at, clean: true
        });
        if (row) bag.push(row);
      }
    }catch(eVp){}
  }

  if (gfn('termBasisState')){
    try{
      s = W.termBasisState();
      rows = (s && s.results) || [];
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (!r || !r.plan || !r.plan.dir) continue;
        row = cbNormRow(Object.assign({ sym: r.pair || r.sym }, r.plan), {
          source: 'termbasis', label: 'TERM BASIS', weight: 1, at: s.at, clean: !!r.ticket
        });
        if (row) bag.push(row);
      }
    }catch(eTb){}
  }

  if (gfn('onchainState')){
    try{
      s = W.onchainState();
      if (s && s.setup && s.setup.dir){
        row = cbNormRow(s.setup, {
          source: 'onchain', label: 'ON-CHAIN', weight: 1, at: s.at, clean: !!s.setup.ticket
        });
        if (row) bag.push(row);
      }
    }catch(eOc){}
  }

  return bag;
}

function cbHarvestAll(){
  var bag = [], seen = {}, i, row, k;
  if (gfn('hgConfirmHarvest')){
    try{ bag = bag.concat(W.hgConfirmHarvest()); }catch(eH){}
  }
  if (gfn('hgMpSnapHarvest')){
    try{ bag = bag.concat(W.hgMpSnapHarvest()); }catch(eM){}
  }
  bag = bag.concat(cbHarvestExtra());
  var out = [];
  for (i = 0; i < bag.length; i++){
    row = bag[i];
    if (!row || !row.sym || !row.dir) continue;
    k = (row.source || '') + '|' + cbKey(row.sym, row.dir);
    if (seen[k]) continue;
    seen[k] = true;
    out.push(row);
  }
  return out;
}

function cbScoreHit(row){
  var w = fin(row.sourceWeight) || 1;
  if (row.deskEdgeAction === 'suppress') return 0;
  if (row.postGateVeto) return 0;
  if (row.clean) return w;
  if (row.near || row.nearClean) return w * 0.55;
  if (row.forming) return w * 0.25;
  return w * 0.35;
}

function cbPickLeader(hits){
  var clean = [], near = [], i;
  for (i = 0; i < hits.length; i++){
    if (hits[i].clean) clean.push(hits[i]);
    else if (hits[i].near || hits[i].nearClean) near.push(hits[i]);
  }
  if (gfn('hgPickMostProbable')){
    var pick = W.hgPickMostProbable(clean, near, hits[0] && hits[0].dir, null);
    if (pick && pick.row) return pick.row;
  }
  return clean[0] || near[0] || hits[0] || null;
}

function cbGroup(bag){
  var map = {}, i, row, key, g, out = [], k;
  for (i = 0; i < bag.length; i++){
    row = bag[i];
    key = cbKey(row.sym, row.dir);
    if (!map[key]){
      map[key] = {
        sym: row.sym, dir: row.dir, key: key,
        hits: [], sources: {}, score: 0, cleanCount: 0, sourceCount: 0
      };
    }
    g = map[key];
    if (g.sources[row.source]) continue;
    g.sources[row.source] = row;
    g.hits.push(row);
    g.score += cbScoreHit(row);
    if (row.clean) g.cleanCount++;
    g.sourceCount++;
  }
  for (k in map){
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    g = map[k];
    g.leader = cbPickLeader(g.hits);
    g.triple = gfn('hgTripleStackMatch') ? W.hgTripleStackMatch(g.sym, g.dir) : null;
    if (g.triple) g.score += 2;
    if (g.sourceCount >= 4 && g.cleanCount >= 2) g.badge = 'STRONG';
    else if (g.sourceCount >= MIN_AGREE_SOURCES) g.badge = 'AGREE';
    else g.badge = 'SOLO';
    g.sourceList = Object.keys(g.sources).map(function(id){
      var h = g.sources[id];
      return (h.sourceLabel || id) + (h.clean ? ' CLEAN' : (h.near ? ' NEAR' : ' watch'));
    });
    out.push(g);
  }
  out.sort(function(a, b){
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
    if (b.cleanCount !== a.cleanCount) return b.cleanCount - a.cleanCount;
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });
  return out;
}

function cbPickGlobal(groups, bag){
  var i, g, pick, confirmTier = null;
  if (gfn('hgConfirmAggregate')){
    try{
      var agg = W.hgConfirmAggregate(bag);
      for (i = 0; i < agg.length; i++){
        if (agg[i].tier === 'PRIME' || agg[i].tier === 'CONFIRMED'){
          if (agg[i].leader){
            return {
              row: agg[i].leader, tier: agg[i].tier === 'PRIME' ? 'clean' : 'clean',
              source: 'combi', meta: agg[i], confirmTier: agg[i].tier
            };
          }
        }
      }
    }catch(eA){}
  }
  for (i = 0; i < groups.length; i++){
    g = groups[i];
    if (g.sourceCount >= MIN_AGREE_SOURCES && g.cleanCount >= 1 && g.leader){
      return { row: g.leader, tier: g.cleanCount >= 2 ? 'clean' : 'near', source: 'combi', meta: g };
    }
  }
  if (gfn('hgPickMostProbableAny')){
    pick = W.hgPickMostProbableAny(bag, gfn('hgTapeSideFromPicture') ? W.hgTapeSideFromPicture() : null);
    if (pick && pick.row) return pick;
  }
  if (groups.length && groups[0].leader){
    return { row: groups[0].leader, tier: groups[0].cleanCount ? 'clean' : 'near', source: 'combi', meta: groups[0] };
  }
  return null;
}

function cbBadgePill(badge){
  if (badge === 'STRONG') return '<span class="gpip ok">STRONG AGREE</span>';
  if (badge === 'AGREE') return '<span class="gpip ok">MULTI-DESK</span>';
  return '<span class="gpip">SOLO</span>';
}

function cbCardHtml(g){
  var leader = g.leader || {};
  var h = '<div class="card">';
  h += '<div class="ttl">' + esc(g.sym) + ' · ' + esc(String(g.dir || '').toUpperCase()) + ' '
    + cbBadgePill(g.badge) + ' <span class="dim">score ' + g.score.toFixed(1)
    + ' · ' + g.sourceCount + ' desks · ' + g.cleanCount + ' CLEAN</span></div>';
  if (g.triple){
    h += '<div class="dim"><span class="gpip ok">TRIPLE STACK</span> SWING + EDGE + BRAIN agree</div>';
  }
  h += '<div class="dim">Desks: ' + esc(g.sourceList.join(' · ')) + '</div>';
  if (leader.entry && leader.stop && leader.t1){
    h += '<div class="plan">ENTRY ' + esc(String(leader.entry)) + ' · STOP ' + esc(String(leader.stop))
      + ' · T1 ' + esc(String(leader.t1))
      + (leader.t2 ? (' · T2 ' + esc(String(leader.t2))) : '')
      + ' · leader ' + esc(leader.sourceLabel || leader.source || 'desk') + '</div>';
  }
  if (g.sourceCount >= MIN_AGREE_SOURCES && g.cleanCount >= 1 && gfn('bookBtnHTML') && leader.entry){
    h += '<div class="row" style="margin-top:8px">' + W.bookBtnHTML(g.sym, g.dir, leader.entry, leader.stop, leader.t1, {
      scanner: 'combi', strategy: 'multi-desk combi', tier: g.cleanCount >= 2 ? 'clean' : 'near', confirmed: g.cleanCount >= 2
    }) + '</div>';
  }
  h += '</div>';
  return h;
}

async function cbWarmDesks(){
  var jobs = [];
  if (gfn('cryptoScanWarm')) jobs.push(W.cryptoScanWarm('swing'));
  if (gfn('cryptoScanWarm')) jobs.push(W.cryptoScanWarm('scalp'));
  if (gfn('bestScanWarm')) jobs.push(W.bestScanWarm());
  if (gfn('edgeWarm')) jobs.push(W.edgeWarm({ force: true }));
  if (gfn('hgBrainAutoWarm')) jobs.push(W.hgBrainAutoWarm());
  await Promise.all(jobs.map(function(p){ return Promise.resolve(p).catch(function(){}); }));
}

async function cbRunScan(ui, opts){
  opts = opts || {};
  if (__cb.busy) return;
  __cb.busy = true;
  if (ui && ui.btn) ui.btn.disabled = true;
  try{
    var stale = !__cb.snap || !__cb.snap.at || (Date.now() - __cb.snap.at > AUTO_WARM_MS);
    if (opts.warm || (stale && !opts.noWarm)) await cbWarmDesks();
    if (ui && ui.stat) ui.stat.textContent = 'merging desk snapshots…';
    var bag = cbHarvestAll();
    var groups = cbGroup(bag);
    var globalPick = cbPickGlobal(groups, bag);
    var strong = groups.filter(function(g){ return g.badge === 'STRONG'; });
    var agree = groups.filter(function(g){ return g.badge === 'AGREE' || g.badge === 'STRONG'; });
    __cb.snap = {
      at: Date.now(),
      harvested: bag.length,
      groups: groups,
      globalPick: globalPick,
      strong: strong.length,
      agree: agree.length
    };
    __cb.ran = true;
    var show = groups.slice(0, SHOW_MAX);
    var html = '';
    if (!groups.length){
      html = '<div class="empty">No desk snapshots yet — press <b>WARM DESKS</b> or run scans on SWING / EDGE / OMNIROUTE first.</div>';
    } else {
      for (var i = 0; i < show.length; i++) html += cbCardHtml(show[i]);
    }
    if (ui && ui.cards){
      ui.cards.innerHTML = html;
      __cb.lastCardsHtml = html;
    }
    if (ui && ui.stat){
      ui.stat.textContent = (globalPick && globalPick.row ? (globalPick.row.sym + ' ' + String(globalPick.row.dir || '').toUpperCase() + ' · ') : '')
        + strong.length + ' STRONG · ' + agree.length + ' multi-desk · '
        + groups.length + ' setups from ' + bag.length + ' desk rows';
    }
    if (gfn('hgPinMostProbablePanel') && globalPick && globalPick.row && ui && ui.cards){
      try{ W.hgPinMostProbablePanel(ui.cards, 'combi', globalPick); }catch(eMp){}
    }
  }catch(e){
    if (ui && ui.stat) ui.stat.textContent = 'merge failed: ' + ((e && e.message) || e);
  }finally{
    __cb.busy = false;
    if (ui && ui.btn) ui.btn.disabled = false;
  }
}

function mountCombi(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>Combi <span>all desks merged · one most probable setup</span></h2>'
    + '<div class="note hg-lead" style="margin-bottom:10px">Cross-tab <b>merger</b> — harvests every published desk snapshot (SWING, SCALP, EDGE, BEST, SMART $, '
    + 'SQUEEZE, OI FLOW, BRAIN, DEX, OMNIROUTE, OMNIBTC, OMNIPRESENT, REV SNIPER, SMC, OB, TRAP, DIV, COIL, APEX, LIQS, CARRY, …) '
    + 'and ranks by multi-desk agreement. Pins the <b>MOST PROBABLE</b> ticket at the top — prefers PRIME/CONFIRMED when SETUP CONFIRM agrees. '
    + 'No invented levels.</div>'
    + '<div class="row"><button class="btn" id="combiRun">MERGE DESKS</button>'
    + '<button class="btn secondary" id="combiWarm">WARM DESKS</button>'
    + '<span class="note" id="combiStat">idle — warm desks or merge from existing scans</span></div>'
    + '<div class="cards" id="combiCards"></div>'
    + '</div>';
  var ui = {
    btn: el.querySelector('#combiRun'),
    warm: el.querySelector('#combiWarm'),
    stat: el.querySelector('#combiStat'),
    cards: el.querySelector('#combiCards')
  };
  __cb.ui = ui;
  if (ui.btn) ui.btn.addEventListener('click', function(){ cbRunScan(ui, {}); });
  if (ui.warm) ui.warm.addEventListener('click', function(){ cbRunScan(ui, { warm: true }); });
  if (gfn('hgTabFormationDayPaint')) W.hgTabFormationDayPaint('combi');
  setTimeout(function(){
    if (__cb.busy || __cb.ran) return;
    cbRunScan(ui, {});
  }, 700);
}

function refreshCombi(opts){
  opts = opts || {};
  try{
    if (__cb.busy) return 'busy';
    if (!__cb.ran && !opts.force) return 'skipped: not run yet';
    if (__cb.ui) return cbRunScan(__cb.ui, opts).then(function(){ return 'refreshed'; });
    return 'skipped: not run yet';
  }catch(e){ return 'refreshed'; }
}

W.hgCombiHarvest = cbHarvestAll;
W.hgCombiGroup = cbGroup;
W.hgCombiPickGlobal = cbPickGlobal;
W.hgCombiScan = function(opts){ return cbRunScan(__cb.ui, opts || {}); };
W.combiState = function(){
  try{ return __cb.snap ? JSON.parse(JSON.stringify(__cb.snap)) : null; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'combi', label: 'COMBI', mount: mountCombi, refresh: refreshCombi });

})();
