/* HARDGATE — desk formation edge (hg-v609).
   Maps SWING / SCALP / EDGE / SMART $ / SQUEEZE / SNIPER / SMC / OB / TRAP /
   DIV / COIL / APEX / OI FLOW / LIQS / ON-CHAIN / CHART VISION / CARRY /
   VENUE / TERM BASIS onto the OMNIROUTE v531 measured book and the five
   BEST kinds (AVWAP-RECLAIM, CUSUM-SHIFT, DONCHIAN-DRIVE, MMOVE, NR7-BREAK).

   Demote / suppress / prefer only. Never loosens G1–G7. Never invents
   direction or tickets. House extras with no baked row fail-open.
   Reports expectancy in R — never a win-rate claim. */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;

  var BEST_KINDS = ['AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'MMOVE', 'NR7-BREAK'];
  var SRC = 'scripts/backtest-omniroute-v531-results.json';

  /* Ranked tightness. Higher = more restrictive. */
  var RANK = { prefer: 1, watch: 2, demote: 3, suppress: 4 };

  var ALIAS = {
    swing: 'swing', 'swing-scalp': 'swing', 'SWING-CLEAN': 'swing', 'SWING-NEAR': 'swing',
    scalp: 'scalp', 'SCALP-CLEAN': 'scalp', 'SCALP-NEAR': 'scalp',
    edge: 'edge', EDGE: 'edge',
    smart: 'smart',
    squeeze: 'squeeze', 'HOUSE-SQUEEZE': 'squeeze', 'SQUEEZE-FIRE': 'squeeze',
    reversalsniper: 'reversalsniper', REVERSALSNIPER: 'reversalsniper', sniper: 'reversalsniper', SNIPER: 'reversalsniper',
    smc: 'smc', SMC: 'smc',
    ob: 'ob', 'order-blocks': 'ob', 'orderblocks': 'ob',
    trap: 'trap', 'liq-trap': 'trap', TRAP: 'trap',
    divergence: 'divergence', div: 'divergence', 'RSI-DIVERGE': 'divergence',
    coil: 'coil', COIL: 'coil',
    'coil-expansion': 'coil-expansion',
    apex: 'apex',
    oiflow: 'oiflow', OIFLOW: 'oiflow',
    liqs: 'liqs',
    onchain: 'onchain',
    chartvision: 'chartvision',
    carry: 'carry',
    venueprem: 'venueprem', venue: 'venueprem',
    termbasis: 'termbasis',
    'fund-fade': 'fund-fade'
  };

  var DESKS = {
    swing: {
      label: 'SWING SCAN', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: '7/7 cascade is not HTF-PULLBACK. Fail-open; BEST kinds rank-boost only.'
    },
    scalp: {
      label: 'SCALP SCAN', ticket: true, bestConfirmBoost: true,
      analogues: [{ kind: 'NR7-BREAK', n: 150, gross: 0.1356, net: 0.0522, action: 'prefer' }],
      note: 'NR7-BREAK is the only net-positive scalp analogue at scale.'
    },
    edge: {
      label: 'EDGE', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'No baked house-EDGE row. Fail-open; BEST kinds rank-boost only.'
    },
    smart: {
      label: 'SMART $', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'Positioning desk. No v531 row. BEST kinds rank-boost only.'
    },
    squeeze: {
      label: 'SQUEEZE', ticket: true, bestConfirmBoost: true,
      analogues: [{ kind: 'SQUEEZE-FIRE', n: 50, gross: -0.0398, net: -0.0989, action: 'watch' }],
      note: 'SQUEEZE-FIRE is near-even (gross > −0.05). Forms, does not prefer.'
    },
    reversalsniper: {
      label: 'REVERSAL SNIPER', ticket: true, bestConfirmBoost: true,
      analogues: [
        { kind: 'PIN-REJECT', n: 115, gross: -0.4783, net: -1.0284, action: 'demote' },
        { kind: 'EXHAUST-REVERT', n: 26, gross: -0.1197, net: -0.1683, action: 'watch' }
      ],
      note: 'PIN-REJECT lost −1.03R at n=115. Bounce tickets never lead.'
    },
    smc: {
      label: 'SMC (FVG)', ticket: true, bestConfirmBoost: false,
      analogues: [{ kind: 'FVG-FILL', n: 184, gross: -0.0833, net: -0.1902, action: 'suppress' }],
      note: 'FVG-FILL n=184 net −0.19R — trade-ready FVG tickets stand aside.'
    },
    ob: {
      label: 'ORDER BLOCKS', ticket: false, bestConfirmBoost: true,
      analogues: [],
      note: 'No crypto OB book. Stay watch. BEST kinds stamp only.'
    },
    trap: {
      label: 'LIQUIDITY TRAP', ticket: true, bestConfirmBoost: true,
      analogues: [
        { kind: 'SWEEP-RECLAIM', n: 120, gross: -0.2496, net: -0.3085, action: 'demote' },
        { kind: 'EQH-SWEEP', n: 119, gross: -0.1335, net: -0.3604, action: 'demote' },
        { kind: 'EQL-SWEEP', n: 111, gross: -0.0984, net: -0.2903, action: 'demote' }
      ],
      note: 'Sweep family lost −0.29R to −0.36R at scale. Never MOST PROBABLE.'
    },
    divergence: {
      label: 'DIVERGENCE', ticket: true, bestConfirmBoost: false,
      analogues: [{ kind: 'RSI-DIVERGE', n: 58, gross: -0.2759, net: -0.6224, action: 'suppress' }],
      note: 'RSI-DIVERGE n=58 net −0.62R — among the worst v531 books. Watch only.'
    },
    coil: {
      label: 'COIL WATCHLIST', ticket: false, bestConfirmBoost: true,
      analogues: [{ kind: 'COMPRESSION-BREAK', n: 16, gross: -0.3126, net: -0.3742, action: 'watch' }],
      note: 'Compression-break is under the n=50 floor. Coil stays forming.'
    },
    'coil-expansion': {
      label: 'COIL EXPANSION', ticket: true, bestConfirmBoost: true,
      analogues: [{ kind: 'NR7-BREAK', n: 150, gross: 0.1356, net: 0.0522, action: 'prefer' }],
      note: 'Expansion maps to NR7-BREAK — the only net-positive break book.'
    },
    apex: {
      label: 'APEX (RS)', ticket: false, bestConfirmBoost: true,
      analogues: [],
      note: 'Context desk. No baked book. BEST kinds stamp only.'
    },
    oiflow: {
      label: 'OI FLOW', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'No v531 OI-DIVERGE row. Fail-open; BEST kinds rank-boost only.'
    },
    liqs: {
      label: 'LIQS', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'Flush tape has no settled book. BEST kinds rank-boost only.'
    },
    onchain: {
      label: 'ON-CHAIN', ticket: false, bestConfirmBoost: true,
      analogues: [],
      note: 'Context only. Never invents a ticket.'
    },
    chartvision: {
      label: 'CHART VISION', ticket: false, bestConfirmBoost: true,
      analogues: [],
      note: 'Live veto already exists. BEST kinds stamp only.'
    },
    carry: {
      label: 'CARRY', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'Funding-arb is not an OMNIROUTE mechanic. Fail-open.'
    },
    venueprem: {
      label: 'VENUE', ticket: false, bestConfirmBoost: false,
      analogues: [],
      note: 'Diagnostic card. No setup book.'
    },
    termbasis: {
      label: 'TERM BASIS', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'Basis curve has no v531 row. Fail-open; BEST kinds stamp only.'
    },
    'fund-fade': {
      label: 'FUND-FADE', ticket: true, bestConfirmBoost: true,
      analogues: [],
      note: 'House extra. No baked row. Fail-open.'
    }
  };

  function fin(x){ var n = +x; return isFinite(n) ? n : NaN; }
  function up(s){ return String(s || '').toUpperCase(); }
  function low(s){ return String(s || '').toLowerCase(); }

  function resolveTab(tab, kind){
    var a = ALIAS[tab] || ALIAS[String(tab || '')] || ALIAS[up(tab)] || ALIAS[low(tab)];
    if (a) return a;
    var k = ALIAS[kind] || ALIAS[up(kind)] || ALIAS[low(kind)];
    return k || '';
  }

  function tighter(a, b){
    var ra = RANK[a] || 0, rb = RANK[b] || 0;
    return rb >= ra ? b : a;
  }

  function analogueAction(row){
    if (!row) return 'watch';
    if (row.action) return row.action;
    if (row.n >= 50 && isFinite(fin(row.gross)) && fin(row.gross) <= -0.05) return 'suppress';
    if (row.n >= 50 && isFinite(fin(row.gross)) && fin(row.gross) < 0
        && isFinite(fin(row.net)) && fin(row.net) <= -0.20) return 'suppress';
    if (row.n >= 50 && isFinite(fin(row.net)) && fin(row.net) > 0
        && isFinite(fin(row.gross)) && fin(row.gross) > 0) return 'prefer';
    return 'watch';
  }

  function forwardPaid(kind){
    try{
      var fn = (typeof W.hgOmni20xForwardPaid === 'function')
        ? W.hgOmni20xForwardPaid
        : (typeof W.hgOmniReplayForwardPaid === 'function' ? W.hgOmniReplayForwardPaid : null);
      if (!fn) return false;
      var v = fn({ kind: String(kind || ''), fwdTab: 'OMNIROUTE' });
      return !!(v && v.read === 'has paid');
    }catch(e){ return false; }
  }

  function nightlyAside(kind){
    try{
      if (typeof W.hgOmniNightlyAside === 'function'){
        return !!W.hgOmniNightlyAside(kind);
      }
    }catch(e){}
    return false;
  }

  function hgDeskFormationBestConfirm(rows, dir){
    var out = { ok: false, kinds: [], catalogAgree: false };
    var d = low(dir);
    if (d !== 'long' && d !== 'short') return out;
    try{
      var detect = (typeof W.hgMechRunAll === 'function') ? W.hgMechRunAll
        : (typeof W.hgOmniDetect === 'function') ? W.hgOmniDetect : null;
      if (detect && rows && rows.length){
        var hits = detect(rows) || [];
        var i, h, k;
        for (i = 0; i < hits.length; i++){
          h = hits[i];
          if (!h) continue;
          k = up(h.kind || h.mechanic || h.name);
          if (BEST_KINDS.indexOf(k) < 0) continue;
          if (low(h.dir || h.side) !== d) continue;
          if (out.kinds.indexOf(k) < 0) out.kinds.push(k);
        }
      }
    }catch(eDet){}
    try{
      if (typeof W.hgCryptoCatalogFeed === 'function' && typeof W.hgCryptoCatalogTally === 'function' && rows && rows.length){
        var feed = W.hgCryptoCatalogFeed(rows, { dir: d, desk: 'OMNIROUTE' });
        var tally = feed ? W.hgCryptoCatalogTally(feed, d) : null;
        if (tally && isFinite(fin(tally.net)) && fin(tally.net) > 0) out.catalogAgree = true;
      }
    }catch(eCat){}
    out.ok = out.kinds.length > 0 || out.catalogAgree === true;
    return out;
  }

  function stamp(cand, name){
    if (!cand) return;
    if (!Array.isArray(cand.stamps)) cand.stamps = [];
    if (cand.stamps.indexOf(name) < 0) cand.stamps.push(name);
  }

  function hgDeskFormationEdgeLookup(tab, kind){
    var id = resolveTab(tab, kind);
    var desk = id ? DESKS[id] : null;
    if (!desk) return null;
    var action = 'watch';
    var analogue = null;
    var i, row, act;
    for (i = 0; i < (desk.analogues || []).length; i++){
      row = desk.analogues[i];
      act = analogueAction(row);
      if (nightlyAside(row.kind)) act = tighter(act, 'suppress');
      if (act === 'suppress' && forwardPaid(row.kind)) act = 'demote';
      if (!analogue || (RANK[act] || 0) >= (RANK[action] || 0)){
        analogue = row;
        action = act;
      }
    }
    return {
      tab: id,
      label: desk.label,
      action: action,
      analogue: analogue,
      ticket: !!desk.ticket,
      bestConfirmBoost: !!desk.bestConfirmBoost,
      note: desk.note || '',
      src: SRC,
      bestKinds: BEST_KINDS.slice()
    };
  }

  function hgDeskFormationEdgeApply(cand, opts){
    try{
      if (!cand || typeof cand !== 'object') return cand;
      opts = opts || {};
      var tab = opts.tab || cand.scanner || cand.tab || cand.desk || '';
      var kind = opts.kind || cand.kind || cand.mechanic || cand.strategy || '';
      var looked = hgDeskFormationEdgeLookup(tab, kind);
      if (!looked) return cand;
      var rows = opts.rows || cand.rows || null;
      var dir = low(cand.dir || opts.dir || '');
      var best = { ok: false, kinds: [], catalogAgree: false };
      if (looked.bestConfirmBoost || looked.action === 'prefer'){
        best = hgDeskFormationBestConfirm(rows, dir);
      }
      var action = looked.action;
      /* BEST confirm never un-suppresses a toxic analogue. It only boosts
         fail-open / prefer / demote-watch ranks. */
      if (action === 'watch' && best.ok) action = 'prefer';
      cand.deskEdgeTab = looked.tab;
      cand.deskEdgeAction = action;
      cand.deskEdgeAnalogue = looked.analogue ? looked.analogue.kind : null;
      cand.deskEdgeBest = best.ok;
      cand.deskEdgeBestKinds = best.kinds.slice();
      var why = looked.note;
      if (looked.analogue){
        why = looked.analogue.kind + ' n=' + looked.analogue.n
          + ' net ' + (isFinite(fin(looked.analogue.net)) ? fin(looked.analogue.net).toFixed(2) : 'n/a')
          + 'R — ' + action;
      }
      if (best.ok) why += ' · BEST confirm ' + (best.kinds.length ? best.kinds.join(', ') : 'catalog');
      cand.deskEdgeWhy = why;

      if (action === 'suppress'){
        cand.dropped = false;
        cand.demoted = true;
        cand.nearClean = true;
        cand.formationOk = false;
        cand.ticket = false;
        if (cand.tier === 'clean') cand.tier = 'near';
        stamp(cand, 'REPLAY SUPPRESS');
      } else if (action === 'demote'){
        cand.demoted = true;
        cand.nearClean = true;
        if (cand.tier === 'clean') cand.tier = 'near';
        stamp(cand, 'REPLAY DEMOTE');
      } else if (action === 'prefer'){
        cand.edgeBoost = true;
        cand.rankBoost = (fin(cand.rankBoost) || 0) + 8;
        stamp(cand, best.ok ? 'BEST CONFIRM' : 'REPLAY PREFER');
      } else if (best.ok){
        cand.edgeBoost = true;
        cand.rankBoost = (fin(cand.rankBoost) || 0) + 4;
        stamp(cand, 'BEST CONFIRM');
      }
      return cand;
    }catch(e){ return cand; }
  }

  function hgDeskFormationEdgeTradeable(cand, was){
    if (!cand) return false;
    if (cand.deskEdgeAction === 'suppress' || cand.deskEdgeAction === 'demote') return false;
    if (cand.demoted && (cand.deskEdgeAction === 'suppress' || cand.deskEdgeAction === 'demote')) return false;
    return !!was;
  }

  function hgDeskFormationEdgeBannerHtml(tabOrCand){
    var looked = null;
    var why = '';
    if (tabOrCand && typeof tabOrCand === 'object'){
      why = tabOrCand.deskEdgeWhy || '';
      looked = hgDeskFormationEdgeLookup(tabOrCand.deskEdgeTab || tabOrCand.scanner || tabOrCand.tab, tabOrCand.kind);
    } else {
      looked = hgDeskFormationEdgeLookup(tabOrCand, '');
    }
    var label = (looked && looked.label) || 'DESK';
    var body = why || (looked && looked.note) || 'OMNIROUTE v531 floors apply. Demote/tighten only.';
    return '<div class="note warn" data-hg-desk-edge="1" style="display:block;margin-bottom:10px">'
      + '<b>OMNIROUTE BEST</b> — ' + String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      + ': ' + String(body).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      + ' Prefer ' + BEST_KINDS.join(', ')
      + ' (v531 prefer-only +0.10R vs overall −0.24R). Never loosens G1–G7.</div>';
  }

  W.HG_DESK_FORMATION_EDGE = {
    src: SRC,
    bestKinds: BEST_KINDS.slice(),
    desks: DESKS,
    preferOnlyNetR: 0.1019,
    overallNetR: -0.2424
  };
  W.hgDeskFormationEdgeLookup = hgDeskFormationEdgeLookup;
  W.hgDeskFormationBestConfirm = hgDeskFormationBestConfirm;
  W.hgDeskFormationEdgeApply = hgDeskFormationEdgeApply;
  W.hgDeskFormationEdgeTradeable = hgDeskFormationEdgeTradeable;
  W.hgDeskFormationEdgeBannerHtml = hgDeskFormationEdgeBannerHtml;
  W.hgDeskFormationResolveTab = resolveTab;
})();
