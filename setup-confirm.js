/* =========================================================================
   HARDGATE — setup-confirm.js
   SETUP CONFIRM tab: cross-desk confirmation before you size a trade.

   Reads published scan snapshots from crypto and gold desks and only surfaces
   setups where multiple fresh, independent desks agree on the same symbol +
   direction with real levels. Stale rows remain visible as context but cannot
   vote, supply a leader, or block a fresh direction. Hard vetoes (desk
   suppress, post-gate, macro, direction conflict, overextension) block the
   ticket. Never invents levels or fetches market data of its own.
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
var GOLD_STRUCTURAL_IDS = { goldswing: 1, goldscalp: 1, golddirection: 1 };

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

function cfIsGold(sym){
  try{
    if (gfn('hgIsGoldLaneSym')) return W.hgIsGoldLaneSym(sym) === true;
  }catch(e){}
  return /(XAU|PAXG|GOLD)/i.test(String(sym || ''));
}

function cfSymbolKey(sym){
  var raw = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  /* Keep gold instruments distinct: XAUUSD, XAUUSDT, XAUTUSD and PAXGUSDT
     have different venue bases and may not share the same ticket levels. */
  if (cfIsGold(sym)) return 'gold:' + raw;
  var base = gfn('hgCryptoBase') ? W.hgCryptoBase(sym) : raw;
  return 'crypto:' + String(base || raw);
}

function cfKey(sym, dir){
  dir = String(dir || '').toLowerCase();
  if (dir === 'buy' || dir === 'l') dir = 'long';
  if (dir === 'sell' || dir === 's') dir = 'short';
  return cfSymbolKey(sym) + '|' + dir;
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
  row.asset = meta.asset || (cfIsGold(row.sym) ? 'gold' : 'crypto');
  if (meta.clean) row.clean = true;
  if (meta.near) { row.near = true; row.clean = false; }
  if (meta.forming) { row.forming = true; row.clean = false; row.near = false; }
  row.scanner = meta.source || row.scanner;
  /* v731: SMC CONTEXT. The grade now feeds the solidity composite via
     setup-solidity.js smcPts, so it can move score and tier; blockers, needs,
     sort order and card visibility stay untouched. This desk never loads
     candles of its own — it only
     re-presents other desks' published snapshots — so the live path here is
     INHERITANCE (contract rule 8): hgNormalizeSetupRow rebuilds a fresh
     whitelist row and drops the source desk's read, so carry it across by hand.
     The enrich fallback only fires on the rare raw snap row that still carries
     its own bars. opts.tab is pinned to this file's own HG_tabs label: without
     it hgSmcEnrich falls back to row.scanner (the SOURCE desk id), which files
     this desk's reads into other tabs' buckets — 'omniroute' normalises to
     OMNIROUTE, the exact Setup Intelligence bucket omniroute.js records into,
     and the recorder's dedupe key carries no tab, so whichever tab ran first
     silently suppressed the other. COMBI also reaches cfNormRow (via
     hgConfirmHarvest) and is labelled SETUP CONFIRM here on purpose: combi.js
     tags its own cbNormRow rows 'COMBI', so the two paths stay distinct. */
  try{
    var smcHave = raw.smc || (raw.plan && raw.plan.smc) || (raw.setup && raw.setup.smc) || (raw.sig && raw.sig.smc);
    var smcRows = raw.rows || raw.candles || raw.bars || raw.ohlc || raw.rows4h;
    if (smcHave && typeof smcHave === 'object' && typeof smcHave.score === 'number'){
      row.smc = smcHave;
    } else if (Array.isArray(smcRows) && smcRows.length && gfn('hgSmcEnrich')){
      W.hgSmcEnrich(row, { rows: smcRows, tab: 'SETUP CONFIRM' });
    }
  }catch(eSmc){}
  /* Reapply solidity for the asset lane after normalization. The shared row
     normalizer defaults to crypto; a gold ticket must use the gold profile. */
  try{
    if (gfn('hgSetupSolidityApply')) W.hgSetupSolidityApply(row, { asset: row.asset });
  }catch(eSol){}
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
          smc: r.smc,   /* v729: BRAIN pins its own SMC read on the row; carry it across normalisation (record-only) */
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
  },
  /* Gold desks publish a full scan snapshot. Harvest only their already
     qualified leader/ticket; do not trigger a second market-data request. */
  { id: 'goldswing', label: 'GOLD SWING', weight: 3, freshMs: 25 * 60 * 1000,
    read: function(){ return cfGoldLedger('goldswingScan', 'goldswing', 'GOLD SWING'); }
  },
  { id: 'goldscalp', label: 'GOLD SCALP', weight: 2.5, freshMs: 25 * 60 * 1000,
    read: function(){ return cfGoldLedger('goldscalpScan', 'goldscalp', 'GOLD SCALP'); }
  },
  { id: 'golddirection', label: 'GOLD DIRECTION', weight: 3, freshMs: 35 * 60 * 1000,
    read: function(){
      var s = gfn('goldDirectionScan') ? W.goldDirectionScan() : null;
      if (!s || s.fundBlackout) return { at: s && s.at, rows: [] };
      var rows = [], hs = ['scalp', 'swing'], i, h, pick;
      for (i = 0; i < hs.length; i++){
        h = s[hs[i]];
        pick = h && h.crownedProven && h.pick;
        if (!pick || !pick.provenBy) continue;
        rows.push(cfNormRow(Object.assign({ sym: 'XAUUSD' }, pick), {
          source: 'golddirection', label: 'GOLD DIRECTION', weight: 3,
          at: s.at, clean: true, asset: 'gold'
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'goldultra', label: 'GOLD ULTRA', weight: 2.5, freshMs: 30 * 60 * 1000,
    read: function(){
      var s = gfn('goldUltraState') ? W.goldUltraState() : null;
      var p = s && s.setups && s.setups.pick;
      if (!s || s.fire !== true || s.recordOnly || !p) return { at: s && s.at, rows: [] };
      var row = cfNormRow(Object.assign({ sym: 'XAUUSD' }, p), {
        source: 'goldultra', label: 'GOLD ULTRA', weight: 2.5,
        at: s.at, clean: true, asset: 'gold'
      });
      return { at: s.at, rows: row ? [row] : [] };
    }
  },
  { id: 'omnigold1', label: 'OMNIGOLD 1', weight: 3, freshMs: 30 * 60 * 1000,
    read: function(){
      var sw = W.__hgOg1Last || null, sc = W.__hgOg1LastScalp || null;
      var at = Math.max(fin(sw && sw.now) || 0, fin(sc && sc.now) || 0);
      var runs = [{ horizon: 'SWING', r: sw }, { horizon: 'SCALP', r: sc }];
      var rows = [], i, r, candidates, j, c;
      for (i = 0; i < runs.length; i++){
        r = runs[i].r;
        var runAt = fin(r && r.now);
        if (!(runAt > 0) || runAt > Date.now() + 5 * 60 * 1000
            || Date.now() - runAt > 30 * 60 * 1000) continue;
        if (!r || !r.ok || (r.sections && r.sections.s0 && !r.sections.s0.clear)) continue;
        candidates = Array.isArray(r.candidates) ? r.candidates : [];
        for (j = 0; j < candidates.length; j++){
          c = candidates[j];
          if (!c || c.demoted === true || (c.matrix && c.matrix.held)
              || !(c.verdict && c.verdict.qualifies)) continue;
          if (!c.gradeInfo && gfn('hgOg1Grade')) c.gradeInfo = W.hgOg1Grade(c);
          if (!(c.gradeInfo && c.gradeInfo.tradeReady)) continue;
          rows.push(cfNormRow(Object.assign({ sym: 'XAUUSD' }, c), {
            source: 'omnigold1', label: 'OMNIGOLD 1 ' + runs[i].horizon,
            weight: 3, at: runAt, clean: true, asset: 'gold'
          }));
        }
      }
      return { at: at, rows: rows.filter(Boolean) };
    }
  },
  { id: 'omnigold', label: 'OMNIGOLD', weight: 3, freshMs: 35 * 60 * 1000,
    read: function(){
      var s = gfn('hgOgState') ? W.hgOgState() : null;
      if (!s || !Array.isArray(s.rows)) return { at: s && s.at, rows: [] };
      var rows = [], i, c;
      for (i = 0; i < s.rows.length; i++){
        c = s.rows[i];
        if (!c || c.vetoed || c.demoted || !(c.grade && c.grade.ticket)
            || (c.formation && c.formation.formed === false) || !c.plan) continue;
        rows.push(cfNormRow(Object.assign({ sym: 'XAUUSD' }, c, c.plan), {
          source: 'omnigold', label: 'OMNIGOLD', weight: 3,
          at: s.at, clean: true, asset: 'gold'
        }));
      }
      return { at: s.at, rows: rows.filter(Boolean) };
    }
  }
];

function cfGoldLedger(name, id, label){
  var s = gfn(name) ? W[name]() : null;
  if (!s || !Array.isArray(s.cands)) return { at: s && s.at, rows: [] };
  var c = null, i;
  for (i = 0; i < s.cands.length; i++){
    if (s.cands[i] && s.cands[i].id === s.bestId){ c = s.cands[i]; break; }
  }
  if (!c || c.demoted || c.vetoed || c.dropped) return { at: s.at, rows: [] };
  var row = cfNormRow(c, { source: id, label: label, weight: id === 'goldswing' ? 3 : 2.5,
    at: s.at, clean: true, asset: 'gold' });
  return { at: s.at, rows: row ? [row] : [] };
}

function hgCollect(snap){
  if (!snap) return [];
  return gfn('hgCollectSetupRows') ? W.hgCollectSetupRows(snap) : [];
}

function cfHarvestAll(){
  var bag = [], i, src, pack, stale, j, row;
  for (i = 0; i < CF_SOURCES.length; i++){
    src = CF_SOURCES[i];
    try{ pack = src.read(); }catch(e){ pack = { at: 0, rows: [] }; }
    var at = fin(pack.at), age = Date.now() - at;
    stale = !(at > 0) || at > Date.now() + 5 * 60 * 1000
      || age > (src.freshMs || FRESH_MS);
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
    if (!hits[i].sourceStale && hits[i].clean
        && (hits[i].asset === 'gold' ? GOLD_STRUCTURAL_IDS[hits[i].source] : STRUCTURAL_IDS[hits[i].source])) n++;
  }
  return n;
}

function cfLeaderBlockers(group){
  var blockers = [], br, news, leader = group.leader;
  var brain = gfn('__hgBrainLast') ? W.__hgBrainLast() : null;
  var brainAge = brain ? Date.now() - fin(brain.at) : NaN;
  var brainFresh = !!(brain && isFinite(brainAge) && brainAge >= 0
    && brainAge <= 30 * 60 * 1000);
  br = brainFresh ? cfBrainLookup(group.sym, group.dir) : null;
  if (br && String(br.tier || '').toUpperCase() === 'ASIDE'){
    blockers.push('BRAIN ASIDE on this symbol');
  }
  var brOpp = brainFresh ? cfBrainLookup(group.sym, group.dir === 'long' ? 'short' : 'long') : null;
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
  var sw = g.sources.swing, ed = g.sources.edge;
  var hasSwing = !!(sw && !sw.sourceStale && sw.clean);
  var hasEdge = !!(ed && !ed.sourceStale && ed.clean);
  var spine = g.asset === 'gold' ? sc >= 2 : !!(g.triple || (hasSwing && hasEdge) || sc >= 2);
  g.structuralClean = sc;
  g.needs = [];
  if (!spine){
    g.needs.push(g.asset === 'gold'
      ? '2 structural CLEAN (GOLD SWING / GOLD SCALP / GOLD DIRECTION)'
      : 'SWING+EDGE both present, TRIPLE STACK, or 2 structural CLEAN (swing/scalp/edge/best)');
  }
  if (sc < (g.asset === 'gold' ? 2 : 1)) g.needs.push(g.asset === 'gold'
    ? '2 structural desk CLEAN (GOLD SWING / GOLD SCALP / GOLD DIRECTION)'
    : 'at least 1 structural desk CLEAN (swing / scalp / edge / best)');
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
    if (r.sourceStale) continue;
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
  if (group.asset !== 'gold' && gfn('hgMacroAllowsCrypto')){
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
    base = cfSymbolKey(groups[i].sym);
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
  var clean = [], near = [], stale = [], i;
  for (i = 0; i < hits.length; i++){
    if (hits[i].sourceStale) stale.push(hits[i]);
    else if (hits[i].clean) clean.push(hits[i]);
    else if (hits[i].near || hits[i].nearClean) near.push(hits[i]);
  }
  if (gfn('hgPickMostProbable')){
    var pick = W.hgPickMostProbable(clean, near, hits[0] && hits[0].dir, null);
    if (pick && pick.row) return pick.row;
  }
  return clean[0] || near[0] || stale[0] || hits[0] || null;
}

/* =========================================================================
   hg-v1304: THE CANDLE CONTEXT READ.

   WHY THIS EXISTS. This desk's own header said it "never invents levels or
   fetches market data of its own" — it composed other desks' published
   snapshots and nothing else. So a CONFIRMED setup here meant "several desks
   agree", and NOTHING on this tab had ever looked at the tape those desks
   were reading. A group could crown while price sat mid-range after a
   volatility blow-off, and this tab could not tell.

   WHAT IT READS. The repo's ONE candle reader — `W.getCandles(sym, res, n)`,
   the same seam book.js and brain.js already use — so there is no second
   fetch path and no second cache (hg-v949). Every field is derived from those
   closed bars and every one is three-state: a real reading, an explicit
   `against`, or absent when the tape is too thin or the read fails.

   WHAT IT IS NOT. A READOUT. It adds no weight, moves no threshold, and
   cannot promote, demote or block a group: the tier logic above is untouched.
   That is deliberate — this desk's job is to CONFIRM agreement between desks,
   and letting a tape read veto that would be a different desk's decision. It
   fails open on every path: an unreadable tape stamps `read:false` and the
   card simply says so. */
var CF_CANDLE_RES = '4h';
var CF_CANDLE_N = 120;
/* the tape read must never hold the scan open: this desk's own cycle budget is
   seconds, and a cold candle fetch for a symbol no other tab has warmed can be
   slow. A timeout returns null, which the card reports as "tape unread" — an
   honest absence, never a fabricated reading. */
var CF_TAPE_MS = 6000;

/* local timeout, because brain.js's withTimeout is module-private (hg-v967: a
   second module does not reach into another's IIFE, and this is not worth
   exporting). Races the promise against a timer and never rejects on timeout. */
function cfWithTimeout(p, ms){
  return new Promise(function(resolve){
    var done = false;
    var t = setTimeout(function(){ if (!done){ done = true; resolve(null); } }, ms);
    Promise.resolve(p).then(function(v){ if (!done){ done = true; clearTimeout(t); resolve(v); } },
                            function(){ if (!done){ done = true; clearTimeout(t); resolve(null); } });
  });
}

function cfCandleContext(rows, dir){
  if (!Array.isArray(rows) || rows.length < 30) return null;
  var i, n = rows.length;
  var closes = [], highs = [], lows = [], vols = [];
  for (i = 0; i < n; i++){
    var b = rows[i];
    if (!b) return null;
    closes.push(+b.c); highs.push(+b.h); lows.push(+b.l);
    vols.push(isFinite(+b.v) ? +b.v : null);
  }
  var px = closes[n - 1];
  if (!isFinite(px)) return null;
  /* true range + ATR(14) */
  var trs = [];
  for (i = 1; i < n; i++){
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (trs.length < 20) return null;
  var atr = 0, k;
  for (k = trs.length - 14; k < trs.length; k++) atr += trs[k];
  atr = atr / 14;
  /* where price sits in the 120-bar range: 0 = at the low, 1 = at the high */
  var hi = Math.max.apply(null, highs), lo = Math.min.apply(null, lows);
  var rangePos = (hi > lo) ? (px - lo) / (hi - lo) : null;
  /* ATR expansion: the last 5 bars' ATR vs the prior 20 */
  var atrRecent = 0, atrPrior = 0, m;
  for (m = trs.length - 5; m < trs.length; m++) atrRecent += trs[m];
  atrRecent = atrRecent / 5;
  for (m = trs.length - 25; m < trs.length - 5; m++) atrPrior += trs[m];
  atrPrior = atrPrior / 20;
  var atrExpand = (atrPrior > 0) ? atrRecent / atrPrior : null;
  /* volume on the last CLOSED bar vs the prior 20-bar mean */
  var vLast = vols[n - 1], vSum = 0, vCount = 0;
  for (m = n - 21; m < n - 1; m++){ if (isFinite(vols[m])){ vSum += vols[m]; vCount++; } }
  var vMean = vCount ? vSum / vCount : null;
  var volRatio = (isFinite(vLast) && isFinite(vMean) && vMean > 0) ? vLast / vMean : null;
  /* higher-timeframe lean from the same tape: EMA21 vs EMA50 on closes */
  var ema = function(len){
    if (n < len + 2) return null;
    var kk = 2 / (len + 1), e = null, j;
    for (j = 0; j < n; j++) e = (e === null) ? closes[j] : (closes[j] * kk + e * (1 - kk));
    return isFinite(e) ? e : null;
  };
  var e21 = ema(21), e50 = ema(50);
  var lean = (isFinite(e21) && isFinite(e50)) ? (e21 > e50 ? 'up' : (e21 < e50 ? 'down' : 'flat')) : null;
  var wants = String(dir || '').toLowerCase();
  /* three-state: a FLAT tape leans neither way, so it is NOT "against" — it is
     unreckoned. Only a real up/down lean can be with or against a direction. */
  var leanWith = (lean && lean !== 'flat' && (wants === 'long' || wants === 'short'))
    ? ((wants === 'long' && lean === 'up') || (wants === 'short' && lean === 'down'))
    : null;
  /* the structural reads, each three-state */
  var rangeState = (rangePos === null) ? null
    : (rangePos >= 0.8 ? 'at the range high' : (rangePos <= 0.2 ? 'at the range low' : 'mid-range'));
  /* a long into the range high (or a short into the low) is the extension this
     read exists to disclose; it is DISCLOSED, never blocked. A degenerate tape
     (hi === lo) has no range, so this is unread rather than false. */
  var extended = (rangePos === null || (wants !== 'long' && wants !== 'short')) ? null
    : (wants === 'long' ? rangePos >= 0.8 : rangePos <= 0.2);
  /* Did the last closed bar finish with the direction? THREE-STATE: without a
     usable direction this is UNREAD, not a false claim of disagreement —
     `String(null || '')` is '', and '' === 'long' is false, which would have
     silently reported "finished against" for a row that has no direction. */
  var lastBarWith = (n >= 2 && isFinite(closes[n - 2]) && (wants === 'long' || wants === 'short'))
    ? ((wants === 'long' && closes[n - 1] > closes[n - 2]) || (wants === 'short' && closes[n - 1] < closes[n - 2]))
    : null;
  return {
    read: true,
    bars: n, res: CF_CANDLE_RES, px: px, atr: atr,
    rangePos: rangePos, rangeState: rangeState,
    hi: hi, lo: lo,
    atrExpand: atrExpand,
    volRatio: volRatio,
    lean: lean, leanWith: leanWith,
    extended: extended,
    lastBarWith: lastBarWith,
    /* the disclosed lines, in the order a reader wants them */
    lines: (function(){
      var out = [];
      out.push(n + ' closed ' + CF_CANDLE_RES + ' bars · price ' + (rangeState || 'range unread')
        + (rangePos !== null ? (' (' + Math.round(rangePos * 100) + '% of the ' + n + '-bar range)') : ''));
      if (lean) out.push('tape lean ' + lean + (leanWith === true ? ' — WITH this direction' : (leanWith === false ? ' — AGAINST this direction' : '')));
      if (atrExpand !== null) out.push('ATR ' + atrExpand.toFixed(2) + 'x its 20-bar norm'
        + (atrExpand >= 1.5 ? ' — volatility expanding' : (atrExpand <= 0.7 ? ' — volatility contracting' : '')));
      if (volRatio !== null) out.push('last-bar volume ' + volRatio.toFixed(2) + 'x the 20-bar mean'
        + (volRatio >= 1.5 ? ' — participation' : (volRatio <= 0.6 ? ' — thin' : '')));
      if (extended === true) out.push('EXTENDED — this direction is entering at the wrong end of the range');
      if (lastBarWith === true) out.push('the last closed bar finished with this direction');
      else if (lastBarWith === false) out.push('the last closed bar finished against this direction');
      return out;
    })()
  };
}

/* Read the tape for a group's leader. Never throws; null on any failure so the
   caller can say "unread" rather than inventing a reading. */
async function cfReadTape(g){
  try{
    var lead = g && (g.leader || (g.hits && g.hits[0]));
    if (!lead || !lead.sym) return null;
    var get = gfn('getCandles');
    if (!get) return null;
    var rows = await cfWithTimeout(get(lead.sym, CF_CANDLE_RES, CF_CANDLE_N), CF_TAPE_MS);
    var ctx = cfCandleContext(rows, lead.dir || g.dir);
    return ctx;
  }catch(e){ return null; }
}

function cfAggregate(bag){
  var map = {}, i, row, key, g;
  for (i = 0; i < bag.length; i++){
    row = bag[i];
    key = cfKey(row.sym, row.dir);
    if (!map[key]){
      map[key] = {
        sym: row.sym, dir: row.dir, asset: row.asset || (cfIsGold(row.sym) ? 'gold' : 'crypto'), key: key,
        hits: [], sources: {}, score: 0, cleanCount: 0, sourceCount: 0
      };
    }
    g = map[key];
    if (g.sources[row.source]) continue;
    g.sources[row.source] = row;
    g.hits.push(row);
    if (!row.sourceStale){
      g.score += cfScoreHit(row);
      if (row.clean) g.cleanCount++;
      g.sourceCount++;
    }
  }
  var out = [], k, globalBlock = cfGlobalBlockers();
  for (k in map){
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    g = map[k];
    g.blockers = cfHardBlockers(g).concat(globalBlock);
    var tripleInputsFresh = g.asset !== 'gold' && g.sources.swing && g.sources.edge && g.sources.brain
      && !g.sources.swing.sourceStale && !g.sources.edge.sourceStale && !g.sources.brain.sourceStale
      && g.sources.swing.clean && g.sources.edge.clean && g.sources.brain.clean;
    g.triple = tripleInputsFresh && gfn('hgTripleStackMatch') ? W.hgTripleStackMatch(g.sym, g.dir) : null;
    if (g.triple) g.score += 2;
    g.leader = cfPickLeader(g.hits);
    g.blockers = g.blockers.concat(cfLeaderBlockers(g));
    g.tier = cfAssignTier(g);
    g.sourceList = Object.keys(g.sources).map(function(id){
      var h = g.sources[id];
      return (h.sourceLabel || id) + (h.sourceStale ? ' STALE' : (h.clean ? ' CLEAN' : (h.near ? ' NEAR' : ' watch')));
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
  /* v729: SMC chip — pure render, never consulted by any gate. Prefer the
     leader's own read. This desk's leader is usually a structural desk
     (SWING / SCALP / EDGE), whose snapshot rows are rebuilt field-by-field by
     hgNormalizeSetupRow and so arrive with no read at all, so fall back to a
     sibling hit in the SAME symbol+direction group that does carry one — and
     name that desk, because its confluence tags were scored against ITS
     entry/stop/t1, not the leader's. */
  var smcRow = (leader && leader.smc) ? leader : null, smcFrom = '', si;
  if (!smcRow){
    for (si = 0; si < (g.hits || []).length; si++){
      if (g.hits[si] && g.hits[si].smc){
        smcRow = g.hits[si];
        smcFrom = g.hits[si].sourceLabel || g.hits[si].source || '';
        break;
      }
    }
  }
  var smcChip = '';
  try{ if (smcRow && gfn('hgSmcChipHtml')) smcChip = W.hgSmcChipHtml(smcRow) || ''; }catch(eSmc){ smcChip = ''; }
  if (smcChip && smcFrom) smcChip += '<span class="dim" style="margin-left:3px">' + esc(smcFrom) + '</span>';
  var h = '<div class="card">';
  h += '<div class="ttl">' + esc(g.sym) + ' · ' + esc(String(g.dir || '').toUpperCase()) + ' '
    + cfTierPill(g.tier) + smcChip + ' <span class="dim">score ' + g.score.toFixed(1)
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
  /* price may have walked through this plan already — the shared rule in
     hg-plan.js. This tab relays a leader row another desk produced, so the
     mark is whatever travelled with it; hgMpMarkOf reads only fields that
     mean price NOW. No mark, no verdict. */
  if (leader.entry && leader.stop && leader.t1 && gfn('hgPlanGeometryLineHtml')){
    try{
      h += W.hgPlanGeometryLineHtml(
        { dir: leader.dir, entry: leader.entry, stop: leader.stop, t1: leader.t1 },
        gfn('hgMpMarkOf') ? W.hgMpMarkOf(leader, leader, {}) : NaN,
        { cls: 'note warn', style: 'margin-top:6px' }) || '';
    }catch(eGeo){}
  }
  if (gfn('hgStrategyTradeDetailHtml') && leader.entry){
    try{ h += W.hgStrategyTradeDetailHtml(leader); }catch(eD){}
  }
  if ((g.tier === 'PRIME' || g.tier === 'CONFIRMED') && gfn('bookBtnHTML') && leader.entry){
    h += '<div class="row" style="margin-top:8px">' + W.bookBtnHTML(g.sym, g.dir, leader.entry, leader.stop, leader.t1, {
      scanner: 'setupconfirm', strategy: 'multi-desk confirm', tier: 'clean', confirmed: true
    }) + '</div>';
  } else if (g.tier !== 'PRIME' && g.tier !== 'CONFIRMED'){
    var spineText = g.asset === 'gold'
      ? '2 structural CLEAN (GOLD SWING / GOLD SCALP / GOLD DIRECTION)'
      : 'SWING+EDGE / TRIPLE STACK / 2 structural CLEAN';
    h += '<div class="note" style="margin-top:6px">Standing aside — structural spine (' + esc(spineText) + ') '
      + 'plus ' + MIN_CONFIRM_SOURCES + ' desks, ' + MIN_CONFIRM_CLEAN + ' CLEAN, score ≥ '
      + MIN_CONFIRM_SCORE + ' required before handoff.</div>';
  }
  /* hg-v1304: THE CANDLE CONTEXT. What the desks above were actually reading.
     Readout only — it is painted, never consulted by cfAssignTier or any
     blocker, so a tape note can never promote or veto a group here. */
  if (g.tape && g.tape.read){
    h += '<div class="note" data-cf-tape="1" style="margin-top:6px"><b>TAPE CONTEXT</b>'
      + ' <span class="dim">' + esc(g.tape.res) + ' · closed bars only</span><div class="dim" style="margin-top:2px">'
      + g.tape.lines.map(function(x){ return esc(x); }).join('<br>')
      + '</div></div>';
  } else {
    h += '<div class="note dim" data-cf-tape="unread" style="margin-top:6px">'
      + '<b>TAPE CONTEXT</b> — unread (no candle history returned for this symbol; '
      + 'the desks above are the only evidence here)</div>';
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
    /* hg-v1304: read the actual TAPE behind the groups that can trade. This is
       the one thing this tab never did — it composed desk agreement and never
       looked at the candles those desks read. Bounded to the tradeable head
       (PRIME / CONFIRMED, then BUILDING if there is room) so a wide board does
       not fan out into dozens of cold fetches; each read is individually
       timeout-guarded and returns null, which renders as an honest "unread". */
    var tapeable = groups.filter(function(g){ return g.tier === 'PRIME' || g.tier === 'CONFIRMED'; });
    if (tapeable.length < 6){
      tapeable = tapeable.concat(groups.filter(function(g){ return g.tier === 'BUILDING'; }));
    }
    tapeable = tapeable.slice(0, 8);
    if (tapeable.length){
      if (ui && ui.stat) ui.stat.textContent = 'reading ' + tapeable.length + ' tape(s)…';
      var reads = await Promise.all(tapeable.map(function(g){ return cfReadTape(g); }));
      for (var ti = 0; ti < tapeable.length; ti++) tapeable[ti].tape = reads[ti] || null;
    }
    var tapeRead = tapeable.filter(function(g){ return g.tape && g.tape.read; }).length;
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
      tapeRead: tapeRead,
      globalBlockers: globalBlock
    };
    __cf.ran = true;
    var show = groups.filter(function(g){
      return g.tier === 'PRIME' || g.tier === 'CONFIRMED' || g.tier === 'BUILDING';
    }).slice(0, SHOW_MAX);
    if (!show.length) show = groups.slice(0, SHOW_MAX);
    var html = '';
    if (!groups.length){
      html = '<div class="empty">No levelled desk snapshots yet — run the relevant specialist scans, then confirm from their latest results.</div>';
    } else {
      for (var i = 0; i < show.length; i++) html += cfCardHtml(show[i]);
    }
    if (ui && ui.cards){
      ui.cards.innerHTML = html;
      __cf.lastCardsHtml = html;
    }
    if (ui && ui.stat){
      ui.stat.textContent = prime.length + ' PRIME · ' + confirmed.length + ' CONFIRMED · ' + building.length
        + ' BUILDING · ' + groups.length + ' groups from ' + bag.length + ' desk rows'
        + ' · tape read on ' + tapeRead + ' of ' + tapeable.length;
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
    + '<h2>Setup Confirm <span>crypto + gold · multi-desk agreement before you size</span></h2>'
    + '<div class="note hg-lead" style="margin-bottom:10px">Cross-desk <b>confirmation gate</b> — not another scanner. Reads existing crypto and gold snapshots; only fresh, already-qualified tickets vote. Record-only rows, stale rows, and watch candidates cannot confirm a setup. A handoff needs '
    + '<b>SWING+EDGE agree</b> (or TRIPLE STACK, or 2 structural CLEAN; gold needs 2 gold structural CLEAN) plus <b>' + MIN_CONFIRM_SOURCES + '+ desks</b>, '
    + '<b>' + MIN_CONFIRM_CLEAN + '+ CLEAN</b>, score <b>≥ ' + MIN_CONFIRM_SCORE + '</b>. Blocks: desk suppress, post-gate, BRAIN aside, '
    + '±' + CHASE_CHG24 + '% 24h chase, crypto macro, news lockout, stand-down, direction conflict, and stale data. '
    + 'Gold requires two fresh structural desks; its ticket engines apply their own calendar, tape, and fundamental gates. <b>PRIME</b> = crypto TRIPLE STACK + 4 desks + 3 CLEAN. No invented levels.</div>'
    + '<div id="cfGlobal"></div>'
    + '<div class="row"><button class="btn" id="cfRun">CONFIRM SETUPS</button>'
    + '<button class="btn secondary" id="cfWarm">WARM CRYPTO DESKS</button>'
    + '<span class="note" id="cfStat">idle — reads existing desk snapshots only</span></div>'
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
W.hgConfirmGlobalBlockers = cfGlobalBlockers;
W.hgSetupConfirmScan = function(opts){ return cfRunScan(__cf.ui, opts || {}); };
W.setupConfirmState = function(){
  try{ return __cf.snap ? JSON.parse(JSON.stringify(__cf.snap)) : null; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'setupconfirm', label: 'SETUP CONFIRM', mount: mountSetupConfirm, refresh: refreshSetupConfirm });

})();
