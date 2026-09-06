/* =========================================================================
   HARDGATE — setup-confirm.js
   SETUP CONFIRM tab: cross-desk confirmation before you size a trade.

   Reads published scan snapshots (SWING, SCALP, EDGE, BEST, SMART $, SQUEEZE,
   OI FLOW, BRAIN, DEX SCREENER, OMNIROUTE) and only surfaces setups where
   multiple independent desks agree on the same symbol + direction with real
   levels. Hard vetoes (desk suppress, post-gate, macro, direction conflict,
   overextension) block the ticket. Never invents levels.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;

var FRESH_MS = 25 * 60 * 1000;
var AUTO_WARM_MS = 10 * 60 * 1000;
var MIN_CONFIRM_SOURCES = 3;
var MIN_CONFIRM_CLEAN = 2;
var MIN_CONFIRM_SCORE = 8;
var CHASE_CHG24 = 15;
var SHOW_MAX = 18;
var STRUCTURAL_IDS = { swing: 1, scalp: 1, edge: 1, best: 1 };

var __cf = { busy: false, ran: false, ui: null, snap: null, lastCardsHtml: '' };

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

function cfKey(sym, dir){
  var base = gfn('hgCryptoBase') ? W.hgCryptoBase(sym) : String(sym || '').toUpperCase();
  dir = String(dir || '').toLowerCase();
  if (dir === 'buy' || dir === 'l') dir = 'long';
  if (dir === 'sell' || dir === 's') dir = 'short';
  return base + '|' + dir;
}

function cfNormRow(raw, meta){
  meta = meta || {};
  var row = gfn('hgNormalizeSetupRow') ? W.hgNormalizeSetupRow(raw) : null;
  if (!row) return null;
  row.source = meta.source || row.source || '';
  row.sourceLabel = meta.label || meta.source || '';
  row.sourceWeight = fin(meta.weight) || 1;
  row.sourceAt = meta.at || 0;
  row.sourceStale = !!meta.stale;
  row.brainTier = meta.brainTier || '';
  if (meta.clean) row.clean = true;
  if (meta.near) { row.near = true; row.clean = false; }
  if (meta.forming) { row.forming = true; row.clean = false; row.near = false; }
  row.scanner = meta.source || row.scanner;
  return row;
}

var CF_SOURCES = [
  { id: 'swing', label: 'SWING', weight: 3, freshMs: 20 * 60 * 1000,
    read: function(){
      var s = gfn('swingScan') ? W.swingScan() : null;
      return { at: s && s.at, rows: hgCollect(s) };
    }
  },
  { id: 'scalp', label: 'SCALP', weight: 2.5, freshMs: 20 * 60 * 1000,
    read: function(){
      var s = gfn('scalpScan') ? W.scalpScan() : null;
      return { at: s && s.at, rows: hgCollect(s) };
    }
  },
  { id: 'edge', label: 'EDGE', weight: 3, freshMs: 14 * 60 * 1000,
    read: function(){
      var s = gfn('edgeScan') ? W.edgeScan() : null;
      return { at: s && s.at, rows: hgCollect(s) };
    }
  },
  { id: 'best', label: 'BEST', weight: 2.5, freshMs: 20 * 60 * 1000,
    read: function(){
      var s = gfn('bestScan') ? W.bestScan() : null;
      if (!s) return { at: 0, rows: [] };
      var rows = (s.clean || []).map(function(c){
        return cfNormRow(c, { source: 'best', label: 'BEST', weight: 2.5, at: s.at, clean: true });
      }).filter(Boolean);
      return { at: s.at, rows: rows };
    }
  },
  { id: 'smart', label: 'SMART $', weight: 2, freshMs: 20 * 60 * 1000,
    read: function(){
      var s = W.__hgSmartResults || null;
      if (!s || !s.results) return { at: s && s.at, rows: [] };
      var rows = [], i, r, setup;
      for (i = 0; i < s.results.length; i++){
        r = s.results[i];
        setup = r && r.setup;
        if (!setup || setup.confirmed !== true || !setup.dir) continue;
        rows.push(cfNormRow(Object.assign({}, setup, {
          sym: r.sym || setup.sym, dir: setup.dir,
          clean: true, confirmed: true
        }), { source: 'smart', label: 'SMART $', weight: 2, at: s.at, clean: true }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'squeeze', label: 'SQUEEZE', weight: 1.5, freshMs: 8 * 60 * 1000,
    read: function(){
      var s = gfn('squeezeState') ? W.squeezeState() : (W.HG_squeezeResults || null);
      if (!s || !s.results) return { at: s && s.at, rows: [] };
      var rows = [], i, r;
      for (i = 0; i < s.results.length; i++){
        r = s.results[i];
        if (!r || !r.dir) continue;
        rows.push(cfNormRow(r, {
          source: 'squeeze', label: 'SQUEEZE', weight: 1.5, at: s.at,
          clean: r.kind === 'fired', near: r.kind === 'break'
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'oiflow', label: 'OI FLOW', weight: 1.5, freshMs: 8 * 60 * 1000,
    read: function(){
      var s = gfn('oiflowState') ? W.oiflowState() : (W.HG_oiflowResults || null);
      if (!s || !s.results) return { at: s && s.at, rows: [] };
      var rows = [], i, r;
      for (i = 0; i < s.results.length; i++){
        r = s.results[i];
        if (!r || !r.dir) continue;
        rows.push(cfNormRow(r, {
          source: 'oiflow', label: 'OI FLOW', weight: 1.5, at: s.at,
          clean: !!r.confirmed, near: !r.confirmed
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'brain', label: 'BRAIN', weight: 2.5, freshMs: 30 * 60 * 1000,
    read: function(){
      var s = gfn('__hgBrainLast') ? W.__hgBrainLast() : null;
      if (!s || !s.rows) return { at: s && s.at, rows: [] };
      var rows = [], i, r, tier;
      for (i = 0; i < s.rows.length; i++){
        r = s.rows[i];
        if (!r || !r.dir) continue;
        tier = String(r.tier || '').toUpperCase();
        if (tier === 'ASIDE') continue;
        rows.push(cfNormRow({
          sym: r.sym, dir: r.dir,
          entry: r.plan && r.plan.entry, stop: r.plan && r.plan.stop,
          t1: r.plan && r.plan.t1, t2: r.plan && r.plan.t2,
          clean: tier === 'PRIME' || tier === 'HIGH',
          near: tier === 'WATCH', tier: tier
        }, {
          source: 'brain', label: 'BRAIN', weight: 2.5, at: s.at,
          clean: tier === 'PRIME' || tier === 'HIGH',
          near: tier === 'WATCH', brainTier: tier
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'dexscreener', label: 'DEX', weight: 1.5, freshMs: 30 * 60 * 1000,
    read: function(){
      var s = gfn('dexScreenerState') ? W.dexScreenerState() : null;
      if (!s || !s.rows) return { at: s && s.at, rows: [] };
      var rows = [], i, c;
      for (i = 0; i < s.rows.length; i++){
        c = s.rows[i];
        if (!c || !c.dir) continue;
        rows.push(cfNormRow(Object.assign({}, c, c.plan || {}), {
          source: 'dexscreener', label: 'DEX', weight: 1.5, at: s.at,
          clean: !!(c.grade && c.grade.ticket), near: !(c.grade && c.grade.ticket)
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'omniroute', label: 'OMNIROUTE', weight: 2, freshMs: 60 * 60 * 1000,
    read: function(){
      var s = gfn('hgOmniState') ? W.hgOmniState() : null;
      if (!s || !s.rows) return { at: s && s.at, rows: [] };
      var rows = [], i, c;
      for (i = 0; i < s.rows.length; i++){
        c = s.rows[i];
        if (!c || !c.dir || !(c.grade && c.grade.ticket)) continue;
        rows.push(cfNormRow(Object.assign({}, c, c.plan || {}), {
          source: 'omniroute', label: 'OMNIROUTE', weight: 2, at: s.at, clean: true
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  }
];

function hgCollect(snap){
  if (!snap) return [];
  return gfn('hgCollectSetupRows') ? W.hgCollectSetupRows(snap) : [];
}

function cfHarvestAll(){
  var bag = [], i, src, pack, stale, j, row;
  for (i = 0; i < CF_SOURCES.length; i++){
    src = CF_SOURCES[i];
    try{ pack = src.read(); }catch(e){ pack = { at: 0, rows: [] }; }
    stale = pack.at && (Date.now() - pack.at > (src.freshMs || FRESH_MS));
    for (j = 0; j < (pack.rows || []).length; j++){
      row = pack.rows[j];
      if (!row || !row.sym || !row.dir) continue;
      row.source = row.source || src.id;
      row.sourceLabel = row.sourceLabel || src.label;
      row.sourceWeight = fin(row.sourceWeight) || src.weight;
      row.sourceAt = pack.at || 0;
      row.sourceStale = stale;
      bag.push(row);
    }
  }
  return bag;
}

function cfTapeChg24(sym){
  try{
    var want = gfn('hgNormSym') ? W.hgNormSym(sym) : String(sym || '').toUpperCase();
    var base = gfn('hgCryptoBase') ? W.hgCryptoBase(sym) : want;
    var lists = [];
    if (W.S && Array.isArray(W.S.tickers)) lists.push(W.S.tickers);
    if (W.S && W.S.state && Array.isArray(W.S.state.tickers)) lists.push(W.S.state.tickers);
    if (Array.isArray(W.tickers)) lists.push(W.tickers);
    var li, i, t, rawSym, chg;
    for (li = 0; li < lists.length; li++){
      for (i = 0; i < lists[li].length; i++){
        t = lists[li][i];
        if (!t) continue;
        rawSym = String(t.symbol || t.sym || '').toUpperCase();
        if (gfn('hgNormSym') && W.hgNormSym(rawSym) === want) chg = fin(t.chg24 != null ? t.chg24 : t.change24h);
        else if (gfn('hgCryptoBase') && W.hgCryptoBase(rawSym) === base) chg = fin(t.chg24 != null ? t.chg24 : t.change24h);
        else if (rawSym === want || rawSym === base) chg = fin(t.chg24 != null ? t.chg24 : t.change24h);
        if (isFinite(chg)) return chg;
      }
    }
  }catch(e){}
  return null;
}

function cfBrainLookup(sym, dir){
  var bl = gfn('__hgBrainLast') ? W.__hgBrainLast() : null;
  if (!bl || !bl.rows) return null;
  var want = gfn('hgNormSym') ? W.hgNormSym(sym) : String(sym || '').toUpperCase();
  var i, r;
  for (i = 0; i < bl.rows.length; i++){
    r = bl.rows[i];
    if (!r || !r.dir) continue;
    if (gfn('hgNormSym') && W.hgNormSym(r.sym) !== want) continue;
    if (dir && String(r.dir).toLowerCase() !== String(dir).toLowerCase()) continue;
    return r;
  }
  return null;
}

function cfGlobalBlockers(){
  var blockers = [];
  if (gfn('hgStandDownState')){
    try{
      var recs = gfn('hgScoreRecords') ? W.hgScoreRecords() : [];
      var sd = W.hgStandDownState(recs);
      if (sd && sd.tripped){
        blockers.push('STAND DOWN — ' + ((sd.reasons || []).join(' · ') || 'drawdown limit'));
      }
    }catch(eSd){}
  }
  if (gfn('superBookScan')){
    try{
      var sb = W.superBookScan();
      if (sb && sb.deskMeta && sb.deskMeta.dailyLossHalt){
        blockers.push('SUPER BOOK daily-loss halt — no new risk today');
      }
    }catch(eSb){}
  }
  return blockers;
}

function cfStructuralClean(hits){
  var n = 0, i;
  for (i = 0; i < hits.length; i++){
    if (hits[i].clean && STRUCTURAL_IDS[hits[i].source]) n++;
  }
  return n;
}

function cfLeaderBlockers(group){
  var blockers = [], br, news, leader = group.leader;
  br = cfBrainLookup(group.sym, group.dir);
  if (br && String(br.tier || '').toUpperCase() === 'ASIDE'){
    blockers.push('BRAIN ASIDE on this symbol');
  }
  var brOpp = cfBrainLookup(group.sym, group.dir === 'long' ? 'short' : 'long');
  if (brOpp && (brOpp.tier === 'PRIME' || brOpp.tier === 'HIGH')){
    blockers.push('BRAIN favours the opposite side (' + String(brOpp.tier) + ')');
  }
  if (gfn('hgNewsRisk')){
    try{
      news = W.hgNewsRisk(group.sym);
      if (news && news.lockout) blockers.push('news lockout — ' + (news.reason || 'event window'));
    }catch(eN){}
  }
  if (leader && String(leader.strategyConfirm || '').toUpperCase() === 'ADVERSE'){
    blockers.push('strategy context ADVERSE on leader plan');
  }
  if (leader && leader.postGateVeto){
    blockers.push('post-gate veto on leader plan');
  }
  return blockers;
}

function cfAssignTier(g){
  if (g.blockers.length) return 'BLOCKED';
  var sc = cfStructuralClean(g.hits);
  var hasSwing = !!g.sources.swing;
  var hasEdge = !!g.sources.edge;
  var spine = !!(g.triple || (hasSwing && hasEdge) || sc >= 2);
  g.structuralClean = sc;
  g.needs = [];
  if (!spine){
    g.needs.push('SWING+EDGE both present, TRIPLE STACK, or 2 structural CLEAN (swing/scalp/edge/best)');
  }
  if (sc < 1) g.needs.push('at least 1 structural desk CLEAN (swing / scalp / edge / best)');
  if (g.sourceCount < MIN_CONFIRM_SOURCES) g.needs.push(MIN_CONFIRM_SOURCES + '+ independent desks');
  if (g.cleanCount < MIN_CONFIRM_CLEAN) g.needs.push(MIN_CONFIRM_CLEAN + '+ CLEAN tickets');
  if (g.score < MIN_CONFIRM_SCORE) g.needs.push('score ≥ ' + MIN_CONFIRM_SCORE);
  if (!spine || sc < 1){
    if (g.sourceCount >= 2 && g.score >= 4) return 'BUILDING';
    return 'WATCH';
  }
  if (g.sourceCount >= MIN_CONFIRM_SOURCES && g.cleanCount >= MIN_CONFIRM_CLEAN && g.score >= MIN_CONFIRM_SCORE){
    if (g.triple && g.sourceCount >= 4 && g.cleanCount >= 3) return 'PRIME';
    return 'CONFIRMED';
  }
  if (g.sourceCount >= 2 && g.score >= 4) return 'BUILDING';
  return 'WATCH';
}

function cfScoreHit(row){
  var w = fin(row.sourceWeight) || 1;
  if (row.deskEdgeAction === 'suppress') return 0;
  if (row.postGateVeto) return 0;
  if (row.clean) return w;
  if (row.near || row.nearClean) return w * 0.55;
  if (row.forming) return w * 0.25;
  return w * 0.35;
}

function cfHardBlockers(group){
  var blockers = [], i, r, dirs = {}, cleanDirs = {};
  for (i = 0; i < group.hits.length; i++){
    r = group.hits[i];
    if (r.deskEdgeAction === 'suppress'){
      blockers.push('desk-edge suppress on ' + (r.sourceLabel || r.source));
      break;
    }
    if (r.postGateVeto){
      blockers.push('post-gate veto on ' + (r.sourceLabel || r.source));
      break;
    }
    dirs[r.dir] = (dirs[r.dir] || 0) + 1;
    if (r.clean) cleanDirs[r.dir] = (cleanDirs[r.dir] || 0) + 1;
  }
  if (dirs.long && dirs.short){
    blockers.push('direction conflict — desks disagree LONG vs SHORT');
  }
  if (gfn('hgMacroAllowsCrypto')){
    try{
      var macro = W.hgMacroAllowsCrypto(group.sym, group.dir);
      if (macro && macro.allow === false && macro.reason) blockers.push(macro.reason);
    }catch(eM){}
  }
  if (gfn('hgTripleStackMatch')){
    /* bonus only — absence is not a blocker */
  }
  var freshSources = {};
  for (i = 0; i < group.hits.length; i++){
    if (!group.hits[i].sourceStale) freshSources[group.hits[i].source] = true;
  }
  if (Object.keys(freshSources).length < 2){
    blockers.push('stale — fewer than 2 fresh desk scans (run SWING / EDGE / BRAIN)');
  }
  var chg = cfTapeChg24(group.sym);
  if (chg !== null){
    if (group.dir === 'long' && chg >= CHASE_CHG24){
      blockers.push('overextended +' + chg.toFixed(1) + '% 24h');
    } else if (group.dir === 'short' && chg <= -CHASE_CHG24){
      blockers.push('overextended ' + chg.toFixed(1) + '% 24h');
    }
  }
  return blockers;
}

function cfApplySymConflicts(groups){
  var bySym = {}, base, list, i, g, hasLong, hasShort;
  for (i = 0; i < groups.length; i++){
    base = gfn('hgCryptoBase') ? W.hgCryptoBase(groups[i].sym) : groups[i].sym;
    if (!bySym[base]) bySym[base] = [];
    bySym[base].push(groups[i]);
  }
  for (base in bySym){
    if (!Object.prototype.hasOwnProperty.call(bySym, base)) continue;
    list = bySym[base];
    hasLong = false;
    hasShort = false;
    for (i = 0; i < list.length; i++){
      if (list[i].dir === 'long' && list[i].cleanCount > 0) hasLong = true;
      if (list[i].dir === 'short' && list[i].cleanCount > 0) hasShort = true;
    }
    if (hasLong && hasShort){
      for (i = 0; i < list.length; i++){
        g = list[i];
        if (g.blockers.indexOf('direction conflict — LONG and SHORT desks both fired CLEAN') < 0){
          g.blockers.push('direction conflict — LONG and SHORT desks both fired CLEAN');
        }
        g.tier = 'BLOCKED';
      }
    }
  }
}

function cfPickLeader(hits){
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

function cfAggregate(bag){
  var map = {}, i, row, key, g;
  for (i = 0; i < bag.length; i++){
    row = bag[i];
    key = cfKey(row.sym, row.dir);
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
    g.score += cfScoreHit(row);
    if (row.clean) g.cleanCount++;
    g.sourceCount++;
  }
  var out = [], k, globalBlock = cfGlobalBlockers();
  for (k in map){
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    g = map[k];
    g.blockers = cfHardBlockers(g).concat(globalBlock);
    g.triple = gfn('hgTripleStackMatch') ? W.hgTripleStackMatch(g.sym, g.dir) : null;
    if (g.triple) g.score += 2;
    g.leader = cfPickLeader(g.hits);
    g.blockers = g.blockers.concat(cfLeaderBlockers(g));
    g.tier = cfAssignTier(g);
    g.sourceList = Object.keys(g.sources).map(function(id){
      var h = g.sources[id];
      return (h.sourceLabel || id) + (h.clean ? ' CLEAN' : (h.near ? ' NEAR' : ' watch'));
    });
    out.push(g);
  }
  cfApplySymConflicts(out);
  out.sort(function(a, b){
    var rank = { PRIME: 4, CONFIRMED: 3, BUILDING: 2, WATCH: 1, BLOCKED: 0 };
    var ta = rank[a.tier] || 0, tb = rank[b.tier] || 0;
    if (tb !== ta) return tb - ta;
    if (b.score !== a.score) return b.score - a.score;
    return b.cleanCount - a.cleanCount;
  });
  return out;
}

function cfTierPill(tier){
  if (tier === 'PRIME') return '<span class="gpip ok">PRIME CONFIRM</span>';
  if (tier === 'CONFIRMED') return '<span class="gpip ok">CONFIRMED</span>';
  if (tier === 'BUILDING') return '<span class="gpip" style="color:#b45309;border-color:rgba(180,83,9,.45)">BUILDING</span>';
  if (tier === 'BLOCKED') return '<span class="gpip bad">BLOCKED</span>';
  return '<span class="gpip">WATCH</span>';
}

function cfCardHtml(g){
  var leader = g.leader || {};
  var h = '<div class="card">';
  h += '<div class="ttl">' + esc(g.sym) + ' · ' + esc(String(g.dir || '').toUpperCase()) + ' '
    + cfTierPill(g.tier) + ' <span class="dim">score ' + g.score.toFixed(1)
    + ' · ' + g.sourceCount + ' desks · ' + g.cleanCount + ' CLEAN</span></div>';
  if (g.triple){
    h += '<div class="dim"><span class="gpip ok">TRIPLE STACK</span> SWING + EDGE + BRAIN agree</div>';
  }
  h += '<div class="dim">Desks: ' + esc(g.sourceList.join(' · ')) + '</div>';
  if (g.needs && g.needs.length && g.tier !== 'PRIME' && g.tier !== 'CONFIRMED'){
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
  if ((g.tier === 'PRIME' || g.tier === 'CONFIRMED') && gfn('bookBtnHTML') && leader.entry){
    h += '<div class="row" style="margin-top:8px">' + W.bookBtnHTML(g.sym, g.dir, leader.entry, leader.stop, leader.t1, {
      scanner: 'setupconfirm', strategy: 'multi-desk confirm', tier: 'clean', confirmed: true
    }) + '</div>';
  } else if (g.tier !== 'PRIME' && g.tier !== 'CONFIRMED'){
    h += '<div class="note" style="margin-top:6px">Standing aside — structural spine (SWING+EDGE / TRIPLE STACK / 2 structural CLEAN) '
      + 'plus ' + MIN_CONFIRM_SOURCES + ' desks, ' + MIN_CONFIRM_CLEAN + ' CLEAN, score ≥ '
      + MIN_CONFIRM_SCORE + ' required before handoff.</div>';
  }
  h += '</div>';
  return h;
}

async function cfWarmDesks(){
  var jobs = [];
  if (gfn('cryptoScanWarm')) jobs.push(W.cryptoScanWarm('swing'));
  if (gfn('cryptoScanWarm')) jobs.push(W.cryptoScanWarm('scalp'));
  if (gfn('bestScanWarm')) jobs.push(W.bestScanWarm());
  if (gfn('edgeWarm')) jobs.push(W.edgeWarm({ force: true }));
  if (gfn('hgBrainAutoWarm')) jobs.push(W.hgBrainAutoWarm());
  await Promise.all(jobs.map(function(p){ return Promise.resolve(p).catch(function(){}); }));
}

async function cfRunScan(ui, opts){
  opts = opts || {};
  if (__cf.busy) return;
  __cf.busy = true;
  if (ui && ui.btn) ui.btn.disabled = true;
  try{
    var stale = !__cf.snap || !__cf.snap.at || (Date.now() - __cf.snap.at > AUTO_WARM_MS);
    if (opts.warm || (stale && !opts.noWarm)) await cfWarmDesks();
    if (ui && ui.stat) ui.stat.textContent = 'reading desk snapshots…';
    var globalBlock = cfGlobalBlockers();
    if (ui && ui.global){
      ui.global.innerHTML = globalBlock.length
        ? '<div class="note warn" style="margin-bottom:8px"><b>HOUSE HALT</b> — ' + esc(globalBlock.join(' · ')) + '</div>'
        : '';
    }
    var bag = cfHarvestAll();
    var groups = cfAggregate(bag);
    var prime = groups.filter(function(g){ return g.tier === 'PRIME'; });
    var confirmed = groups.filter(function(g){ return g.tier === 'CONFIRMED'; });
    var building = groups.filter(function(g){ return g.tier === 'BUILDING'; });
    __cf.snap = {
      at: Date.now(),
      harvested: bag.length,
      groups: groups,
      prime: prime.length,
      confirmed: confirmed.length,
      building: building.length,
      globalBlockers: globalBlock
    };
    __cf.ran = true;
    var show = groups.filter(function(g){
      return g.tier === 'PRIME' || g.tier === 'CONFIRMED' || g.tier === 'BUILDING';
    }).slice(0, SHOW_MAX);
    if (!show.length) show = groups.slice(0, SHOW_MAX);
    var html = '';
    if (!groups.length){
      html = '<div class="empty">No desk snapshots yet — press <b>WARM DESKS</b> or run SWING / EDGE / BRAIN scans first.</div>';
    } else {
      for (var i = 0; i < show.length; i++) html += cfCardHtml(show[i]);
    }
    if (ui && ui.cards){
      ui.cards.innerHTML = html;
      __cf.lastCardsHtml = html;
    }
    if (ui && ui.stat){
      ui.stat.textContent = prime.length + ' PRIME · ' + confirmed.length + ' CONFIRMED · ' + building.length
        + ' BUILDING · ' + groups.length + ' groups from ' + bag.length + ' desk rows';
    }
    var tradeable = prime.length ? prime : confirmed;
    if (gfn('hgPinMostProbablePanel') && tradeable.length && tradeable[0].leader){
      try{
        var lead = tradeable[0].leader;
        W.hgPinMostProbablePanel(ui.cards, 'setupconfirm', {
          row: lead, tier: 'clean', source: 'setup-confirm'
        });
      }catch(eMp){}
    }
  }catch(e){
    if (ui && ui.stat) ui.stat.textContent = 'scan failed: ' + ((e && e.message) || e);
  }finally{
    __cf.busy = false;
    if (ui && ui.btn) ui.btn.disabled = false;
  }
}

function mountSetupConfirm(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>Setup Confirm <span>multi-desk agreement before you size · stop chasing single-tab noise</span></h2>'
    + '<div class="note hg-lead" style="margin-bottom:10px">Cross-desk <b>confirmation gate</b> — not another scanner. Reads published snaps and only hands off when '
    + '<b>SWING+EDGE agree</b> (or TRIPLE STACK, or 2 structural CLEAN) plus <b>' + MIN_CONFIRM_SOURCES + '+ desks</b>, '
    + '<b>' + MIN_CONFIRM_CLEAN + '+ CLEAN</b>, score <b>≥ ' + MIN_CONFIRM_SCORE + '</b>. Blocks: desk suppress, post-gate, BRAIN aside, '
    + '±' + CHASE_CHG24 + '% 24h chase, macro, news lockout, stand-down, direction conflict, stale data. '
    + '<b>PRIME</b> = TRIPLE STACK + 4 desks + 3 CLEAN. Auto-warms stale desks on confirm. No invented levels.</div>'
    + '<div id="cfGlobal"></div>'
    + '<div class="row"><button class="btn" id="cfRun">CONFIRM SETUPS</button>'
    + '<button class="btn secondary" id="cfWarm">FORCE WARM</button>'
    + '<span class="note" id="cfStat">idle — warm desks or confirm from existing scans</span></div>'
    + '<div class="cards" id="cfCards"></div>'
    + '</div>';
  var ui = {
    btn: el.querySelector('#cfRun'),
    warm: el.querySelector('#cfWarm'),
    stat: el.querySelector('#cfStat'),
    cards: el.querySelector('#cfCards'),
    global: el.querySelector('#cfGlobal')
  };
  __cf.ui = ui;
  if (ui.btn) ui.btn.addEventListener('click', function(){ cfRunScan(ui, {}); });
  if (ui.warm) ui.warm.addEventListener('click', function(){ cfRunScan(ui, { warm: true, noWarm: false }); });
  if (gfn('hgTabFormationDayPaint')) W.hgTabFormationDayPaint('setupconfirm');
  setTimeout(function(){
    if (__cf.busy || __cf.ran) return;
    cfRunScan(ui, {});
  }, 600);
}

function refreshSetupConfirm(opts){
  opts = opts || {};
  try{
    if (__cf.busy) return 'busy';
    if (!__cf.ran && !opts.force) return 'skipped: not run yet';
    if (__cf.ui) return cfRunScan(__cf.ui, opts).then(function(){ return 'refreshed'; });
    return 'skipped: not run yet';
  }catch(e){ return 'refreshed'; }
}

W.hgConfirmHarvest = cfHarvestAll;
W.hgConfirmAggregate = cfAggregate;
W.hgConfirmKey = cfKey;
W.hgConfirmTapeChg24 = cfTapeChg24;
W.hgConfirmAssignTier = cfAssignTier;
W.hgSetupConfirmScan = function(opts){ return cfRunScan(__cf.ui, opts || {}); };
W.setupConfirmState = function(){
  try{ return __cf.snap ? JSON.parse(JSON.stringify(__cf.snap)) : null; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'setupconfirm', label: 'SETUP CONFIRM', mount: mountSetupConfirm, refresh: refreshSetupConfirm });

})();
