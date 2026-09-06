/* =========================================================================
   HARDGATE — combi.js
   COMBI tab: merge every crypto desk snapshot into one ranked board and
   surface the single MOST PROBABLE setup across the house.

   Read-only aggregator — never invents levels. Harvests module scan snaps,
   SETUP CONFIRM sources, and inline-tab cards captured via hgMpSnapHarvest.
   Ranks with structural spine + confirm tiers; blocks chase / suppress /
   direction conflict before pinning MOST PROBABLE.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;

var SHOW_MAX = 20;
var AUTO_WARM_MS = 10 * 60 * 1000;
var MIN_AGREE_SOURCES = 2;
var MIN_BOOK_SOURCES = 2;
var MIN_BOOK_CLEAN = 1;
var CHASE_CHG24 = 15;
var STRUCTURAL_IDS = { swing: 1, scalp: 1, edge: 1, best: 1 };
var TIER_RANK = { PRIME: 7, CONFIRMED: 6, STRONG: 5, AGREE: 4, BUILDING: 3, WATCH: 2, SOLO: 1, BLOCKED: 0 };
var CB_POPULATE_IDS = [
  'swing', 'scalp', 'edge', 'best', 'smart', 'squeeze', 'oiflow', 'brain',
  'omniroute', 'dexscreener', 'omnibtc', 'omnipresent', 'reversalsniper',
  'smc', 'ob', 'trap', 'div', 'coil', 'apex',
  'liqs', 'chartvision', 'carry', 'venueprem', 'termbasis', 'onchain'
];
var CB_POPULATE_CHUNK = 4;

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

function cbRowOk(row){
  if (!row || !row.sym || !row.dir) return false;
  if (row.deskEdgeAction === 'suppress' || row.deskEdgeAction === 'demote') return false;
  if (row.postGateVeto || row.dropped) return false;
  if (gfn('hgSetupHasLevels') && !W.hgSetupHasLevels(row)) return false;
  return true;
}

function cbHarvestExtra(){
  var bag = [], i, s, rows, r, row, lv;

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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
        if (row && cbRowOk(row)) bag.push(row);
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
    if (!cbRowOk(row)) continue;
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

function cbStructuralClean(hits){
  var n = 0, i;
  for (i = 0; i < hits.length; i++){
    if (hits[i].clean && STRUCTURAL_IDS[hits[i].source]) n++;
  }
  return n;
}

function cbHasSpine(g){
  return !!(g.triple || (g.sources.swing && g.sources.edge) || cbStructuralClean(g.hits) >= 2);
}

function cbPickLeader(hits, sym, dir){
  var clean = [], near = [], i, side;
  for (i = 0; i < hits.length; i++){
    if (hits[i].clean) clean.push(hits[i]);
    else if (hits[i].near || hits[i].nearClean) near.push(hits[i]);
  }
  side = gfn('hgTapeSideFromPicture') ? W.hgTapeSideFromPicture() : (dir || null);
  if (gfn('hgRankCryptoSetups')){
    var ranked = W.hgRankCryptoSetups(clean.concat(near), side);
    if (ranked && ranked.best) return ranked.best;
  }
  if (gfn('hgPickMostProbable')){
    var pick = W.hgPickMostProbable(clean, near, dir, null);
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
    g.leader = cbPickLeader(g.hits, g.sym, g.dir);
    g.triple = gfn('hgTripleStackMatch') ? W.hgTripleStackMatch(g.sym, g.dir) : null;
    if (g.triple) g.score += 2;
    g.structuralClean = cbStructuralClean(g.hits);
    g.spine = cbHasSpine(g);
    if (g.spine) g.score += 1.5;
    if (g.sourceCount >= 4 && g.cleanCount >= 2 && g.spine) g.badge = 'STRONG';
    else if (g.sourceCount >= MIN_AGREE_SOURCES && g.cleanCount >= 1) g.badge = 'AGREE';
    else g.badge = 'SOLO';
    g.sourceList = Object.keys(g.sources).map(function(id){
      var h = g.sources[id];
      return (h.sourceLabel || id) + (h.clean ? ' CLEAN' : (h.near ? ' NEAR' : ' watch'));
    });
    out.push(g);
  }
  return cbEnrich(out, bag);
}

function cbEnrich(groups, bag){
  var confirmMap = {}, i, g, cf, agg;
  if (gfn('hgConfirmAggregate')){
    try{
      agg = W.hgConfirmAggregate(bag);
      for (i = 0; i < agg.length; i++) confirmMap[agg[i].key] = agg[i];
    }catch(eA){}
  }
  for (i = 0; i < groups.length; i++){
    g = groups[i];
    cf = confirmMap[g.key];
    if (cf){
      g.confirmTier = cf.tier;
      g.blockers = (cf.blockers || []).slice();
      g.needs = (cf.needs || []).slice();
      g.structuralClean = cf.structuralClean != null ? cf.structuralClean : g.structuralClean;
      g.spine = !!(cf.triple || g.spine);
      if (cf.tier === 'PRIME' || cf.tier === 'CONFIRMED') g.badge = cf.tier;
      else if (cf.tier === 'BLOCKED') g.badge = 'BLOCKED';
      else if (cf.tier === 'BUILDING' && g.badge === 'SOLO') g.badge = 'BUILDING';
    } else {
      g.blockers = [];
      g.needs = [];
      g.confirmTier = g.badge;
    }
    g.combiTier = (g.blockers && g.blockers.length) ? 'BLOCKED' : (g.confirmTier || g.badge);
    g.tradeable = cbIsTradeable(g);
  }
  return cbSort(groups);
}

function cbIsTradeable(g){
  if (!g || g.blockers && g.blockers.length) return false;
  if (g.combiTier === 'BLOCKED') return false;
  if (g.combiTier === 'PRIME' || g.combiTier === 'CONFIRMED') return true;
  if (g.badge === 'STRONG' && g.spine && g.cleanCount >= MIN_BOOK_CLEAN) return true;
  if (g.sourceCount >= MIN_BOOK_SOURCES && g.cleanCount >= MIN_BOOK_CLEAN && g.spine) return true;
  if (g.combiTier === 'BUILDING' && g.spine && g.sourceCount >= MIN_AGREE_SOURCES && g.cleanCount >= 1) return true;
  if (g.badge === 'AGREE' && g.spine && g.cleanCount >= 1) return true;
  return false;
}

function cbSort(groups){
  return groups.sort(function(a, b){
    var ta = TIER_RANK[a.combiTier] || TIER_RANK[a.badge] || 0;
    var tb = TIER_RANK[b.combiTier] || TIER_RANK[b.badge] || 0;
    if (tb !== ta) return tb - ta;
    if (b.tradeable !== a.tradeable) return (b.tradeable ? 1 : 0) - (a.tradeable ? 1 : 0);
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
    if (b.cleanCount !== a.cleanCount) return b.cleanCount - a.cleanCount;
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });
}

function cbPickGlobal(groups, bag){
  var i, g, tradeable = [];
  for (i = 0; i < groups.length; i++){
    g = groups[i];
    if (!g.tradeable || !g.leader) continue;
    if (g.combiTier === 'PRIME') return { row: g.leader, tier: 'clean', source: 'combi', meta: g, confirmTier: 'PRIME' };
    tradeable.push(g);
  }
  for (i = 0; i < tradeable.length; i++){
    g = tradeable[i];
    if (g.combiTier === 'CONFIRMED') return { row: g.leader, tier: 'clean', source: 'combi', meta: g, confirmTier: 'CONFIRMED' };
  }
  for (i = 0; i < tradeable.length; i++){
    g = tradeable[i];
    if (g.badge === 'STRONG' && g.spine && g.cleanCount >= MIN_BOOK_CLEAN){
      return { row: g.leader, tier: 'clean', source: 'combi', meta: g };
    }
  }
  for (i = 0; i < tradeable.length; i++){
    g = tradeable[i];
    if (g.sourceCount >= MIN_BOOK_SOURCES && g.cleanCount >= MIN_BOOK_CLEAN && g.spine){
      return { row: g.leader, tier: g.cleanCount >= 2 ? 'clean' : 'near', source: 'combi', meta: g };
    }
  }
  return null;
}

function cbPickBestAvailable(groups){
  var i, g, best = null, bestScore = -1, s;
  for (i = 0; i < groups.length; i++){
    g = groups[i];
    if (g.blockers && g.blockers.length) continue;
    if (g.combiTier === 'BLOCKED') continue;
    if (!g.leader) continue;
    if (gfn('hgSetupHasLevels') && !W.hgSetupHasLevels(g.leader)) continue;
    s = g.score + g.sourceCount * 2 + g.cleanCount * 3 + (g.spine ? 4 : 0) + (g.triple ? 3 : 0);
    if (s > bestScore){ bestScore = s; best = g; }
  }
  if (!best) return null;
  return {
    row: best.leader,
    tier: best.cleanCount >= MIN_BOOK_CLEAN ? 'near' : 'forming',
    source: 'combi',
    meta: best,
    fallback: true
  };
}

function cbPickLeaderCombined(groups, bag){
  var pick = cbPickGlobal(groups, bag);
  if (pick && pick.row) return pick;
  return cbPickBestAvailable(groups);
}

function cbTierPill(g){
  var tier = g.combiTier || g.badge || 'SOLO';
  if (tier === 'PRIME') return '<span class="gpip ok">PRIME</span>';
  if (tier === 'CONFIRMED') return '<span class="gpip ok">CONFIRMED</span>';
  if (tier === 'STRONG') return '<span class="gpip ok">STRONG AGREE</span>';
  if (tier === 'AGREE') return '<span class="gpip ok">MULTI-DESK</span>';
  if (tier === 'BUILDING') return '<span class="gpip" style="color:#b45309;border-color:rgba(180,83,9,.45)">BUILDING</span>';
  if (tier === 'BLOCKED') return '<span class="gpip bad">BLOCKED</span>';
  if (tier === 'WATCH') return '<span class="gpip">WATCH</span>';
  return '<span class="gpip">SOLO</span>';
}

function cbCardHtml(g){
  var leader = g.leader || {};
  var rr = '';
  if (isFinite(fin(leader.rr))) rr = ' · RR ' + fin(leader.rr).toFixed(1);
  else if (leader.entry && leader.stop && leader.t1){
    var risk = Math.abs(fin(leader.entry) - fin(leader.stop));
    var rew = Math.abs(fin(leader.t1) - fin(leader.entry));
    if (risk > 0 && isFinite(rew)) rr = ' · RR ' + (rew / risk).toFixed(1);
  }
  var h = '<div class="card' + (g.combiTier === 'BLOCKED' ? ' tier-blocked' : '') + '">';
  h += '<div class="ttl">' + esc(g.sym) + ' · ' + esc(String(g.dir || '').toUpperCase()) + ' '
    + cbTierPill(g) + ' <span class="dim">score ' + g.score.toFixed(1)
    + ' · ' + g.sourceCount + ' desks · ' + g.cleanCount + ' CLEAN' + rr + '</span></div>';
  if (g.triple){
    h += '<div class="dim"><span class="gpip ok">TRIPLE STACK</span> SWING + EDGE + BRAIN agree</div>';
  } else if (g.spine){
    h += '<div class="dim"><span class="gpip ok">STRUCTURAL SPINE</span> swing/edge/best structural agreement</div>';
  }
  h += '<div class="dim">Desks: ' + esc(g.sourceList.join(' · ')) + '</div>';
  if (g.needs && g.needs.length && !g.tradeable){
    h += '<div class="dim">Needs: ' + esc(g.needs.join(' · ')) + '</div>';
  }
  if (gfn('hgStrategyConfirmChipHtml') && leader.strategyConfirm){
    h += '<div style="margin-top:4px">' + W.hgStrategyConfirmChipHtml(leader.strategyConfirm, leader.strategyWith, leader.strategyAgainst) + '</div>';
  }
  if (g.blockers && g.blockers.length){
    h += '<div class="note warn" style="margin-top:6px"><b>BLOCKED</b> — ' + esc(g.blockers.join(' · ')) + '</div>';
  }
  if (leader.entry && leader.stop && leader.t1){
    h += '<div class="plan">ENTRY ' + esc(String(leader.entry)) + ' · STOP ' + esc(String(leader.stop))
      + ' · T1 ' + esc(String(leader.t1))
      + (leader.t2 ? (' · T2 ' + esc(String(leader.t2))) : '')
      + ' · leader ' + esc(leader.sourceLabel || leader.source || 'desk') + '</div>';
  }
  if (gfn('hgStrategyTradeDetailHtml') && leader.entry){
    try{ h += W.hgStrategyTradeDetailHtml(leader); }catch(eD){}
  }
  if (g.tradeable && gfn('bookBtnHTML') && leader.entry){
    h += '<div class="row" style="margin-top:8px">' + W.bookBtnHTML(g.sym, g.dir, leader.entry, leader.stop, leader.t1, {
      scanner: 'combi', strategy: 'multi-desk combi', tier: g.cleanCount >= 2 ? 'clean' : 'near',
      confirmed: g.combiTier === 'PRIME' || g.combiTier === 'CONFIRMED'
    }) + '</div>';
  } else if (!g.tradeable && g.combiTier !== 'BLOCKED'){
    h += '<div class="note" style="margin-top:6px">Standing aside — need structural spine + '
      + MIN_BOOK_SOURCES + '+ desks, ' + MIN_BOOK_CLEAN + '+ CLEAN, or SETUP CONFIRM PRIME/CONFIRMED.</div>';
  }
  h += '</div>';
  return h;
}

function cbGlobalBlockers(){
  if (gfn('hgConfirmGlobalBlockers')){
    try{ return W.hgConfirmGlobalBlockers(); }catch(e){}
  }
  return [];
}

async function cbPopulateDesks(ui){
  var scanFn = gfn('hgScanOneTab') ? W.hgScanOneTab : null;
  var i, chunk, slice, done = 0;
  if (!scanFn){
    await cbWarmDesks();
    return 0;
  }
  for (i = 0; i < CB_POPULATE_IDS.length; i += CB_POPULATE_CHUNK){
    chunk = CB_POPULATE_IDS.slice(i, i + CB_POPULATE_CHUNK);
    if (ui && ui.stat){
      ui.stat.textContent = 'populating desks ' + Math.min(i + CB_POPULATE_CHUNK, CB_POPULATE_IDS.length)
        + '/' + CB_POPULATE_IDS.length + '…';
    }
    await Promise.all(chunk.map(function(id){
      return Promise.resolve(scanFn(id, { quiet: true })).catch(function(){ return 'error'; });
    }));
    done += chunk.length;
  }
  return done;
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
    var needsPopulate = !!(opts.populate || opts.warm || !__cb.ran || stale);
    if (needsPopulate){
      if (ui && ui.stat) ui.stat.textContent = 'populating desk snapshots…';
      await cbPopulateDesks(ui);
    }
    if (ui && ui.stat) ui.stat.textContent = 'merging desk snapshots…';
    var bag = cbHarvestAll();
    if (!bag.length && needsPopulate){
      await cbWarmDesks();
      bag = cbHarvestAll();
    }
    var groups = cbGroup(bag);
    var globalBlock = cbGlobalBlockers();
    if (ui && ui.global){
      ui.global.innerHTML = globalBlock.length
        ? '<div class="note warn" style="margin-bottom:8px"><b>HOUSE HALT</b> — ' + esc(globalBlock.join(' · ')) + '</div>'
        : '';
    }
    var globalPick = globalBlock.length ? null : cbPickLeaderCombined(groups, bag);
    var tradeable = groups.filter(function(g){ return g.tradeable; });
    var prime = groups.filter(function(g){ return g.combiTier === 'PRIME'; });
    var confirmed = groups.filter(function(g){ return g.combiTier === 'CONFIRMED'; });
    var strong = groups.filter(function(g){ return g.badge === 'STRONG' || g.combiTier === 'STRONG'; });
    __cb.snap = {
      at: Date.now(),
      harvested: bag.length,
      groups: groups,
      globalPick: globalPick,
      tradeable: tradeable.length,
      prime: prime.length,
      confirmed: confirmed.length,
      strong: strong.length,
      globalBlockers: globalBlock,
      populated: needsPopulate
    };
    __cb.ran = true;
    var show = groups.slice(0, SHOW_MAX);
    var html = '';
    if (!groups.length){
      html = '<div class="empty">No desk snapshots yet — press <b>POPULATE DESKS</b> to warm SWING / EDGE / OMNIROUTE and merge again.</div>';
    } else {
      if (globalPick && globalPick.fallback){
        html += '<div class="note" style="margin-bottom:8px">Best available leader pinned — desks populated; PRIME/CONFIRMED agreement still building on weaker names.</div>';
      } else if (!tradeable.length && !globalPick){
        html += '<div class="note warn" style="margin-bottom:8px">No leader yet — press <b>POPULATE DESKS</b> to warm all crypto tabs, then merge again.</div>';
      }
      for (var i = 0; i < show.length; i++) html += cbCardHtml(show[i]);
    }
    if (ui && ui.cards){
      ui.cards.innerHTML = html;
      __cb.lastCardsHtml = html;
    }
    if (ui && ui.stat){
      ui.stat.textContent = (globalPick && globalPick.row ? (globalPick.row.sym + ' ' + String(globalPick.row.dir || '').toUpperCase() + ' · ') : '')
        + prime.length + ' PRIME · ' + confirmed.length + ' CONFIRMED · ' + tradeable.length + ' tradeable · '
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
    + '<div class="note hg-lead" style="margin-bottom:10px">Cross-tab <b>merger</b> — harvests every published desk snapshot, ranks by structural spine '
    + '(SWING+EDGE / TRIPLE STACK / 2 structural CLEAN) + multi-desk agreement, and applies SETUP CONFIRM blockers '
    + '(±' + CHASE_CHG24 + '% chase, suppress, direction conflict, BRAIN aside, news lockout). '
    + 'Pins <b>MOST PROBABLE</b> when PRIME / CONFIRMED / STRONG+spine; auto-populates all crypto desks on open. No invented levels.</div>'
    + '<div id="combiGlobal"></div>'
    + '<div class="row"><button class="btn" id="combiRun">MERGE DESKS</button>'
    + '<button class="btn secondary" id="combiWarm">POPULATE DESKS</button>'
    + '<span class="note" id="combiStat">idle — auto-populates on open</span></div>'
    + '<div class="cards" id="combiCards"></div>'
    + '</div>';
  var ui = {
    btn: el.querySelector('#combiRun'),
    warm: el.querySelector('#combiWarm'),
    stat: el.querySelector('#combiStat'),
    cards: el.querySelector('#combiCards'),
    global: el.querySelector('#combiGlobal')
  };
  __cb.ui = ui;
  if (ui.btn) ui.btn.addEventListener('click', function(){ cbRunScan(ui, { populate: true }); });
  if (ui.warm) ui.warm.addEventListener('click', function(){ cbRunScan(ui, { warm: true, populate: true }); });
  if (gfn('hgTabFormationDayPaint')) W.hgTabFormationDayPaint('combi');
  setTimeout(function(){
    if (__cb.busy || __cb.ran) return;
    cbRunScan(ui, { populate: true });
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
W.hgCombiEnrich = cbEnrich;
W.hgCombiPickGlobal = cbPickGlobal;
W.hgCombiPickBestAvailable = cbPickBestAvailable;
W.hgCombiPickLeader = cbPickLeaderCombined;
W.hgCombiPopulate = cbPopulateDesks;
W.hgCombiIsTradeable = cbIsTradeable;
W.hgCombiScan = function(opts){ return cbRunScan(__cb.ui, opts || {}); };
W.combiState = function(){
  try{ return __cb.snap ? JSON.parse(JSON.stringify(__cb.snap)) : null; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'combi', label: 'COMBI', mount: mountCombi, refresh: refreshCombi });

})();
