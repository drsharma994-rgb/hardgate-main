/* HARDGATE — nightly formation overlay (browser).
   Fetches /api/formation-nightly (fallback: committed scripts/formation-nightly.json)
   and retunes OMNIROUTE / OMNIPRESENT / OMNIGOLD 1 + all desk tabs from the
   rolling 40-day book. After 21:00 UTC, reloads once per UTC day and repaints
   every nav tab. Adds asides and tightens floors only. Never loosens G1–G7,
   baked demotes, or baked desk suppress. Never invents tickets. */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;

  var HG_TAB_DAY_HOSTS = {
    swing: 'swingDesk', scalp: 'scalpDesk', best: 'bestDesk',
    edge: 'edgeDay', smart: 'smartDay', squeeze: 'squeezeDay',
    reversalsniper: 'rsDay', smc: 'smcDay', ob: 'obDay', trap: 'trapDay',
    div: 'divDay', coil: 'coilDay', apex: 'apexDay', oiflow: 'oiflowDay',
    liqs: 'liqsDay', onchain: 'onchainDay', chartvision: 'chartvisionDay',
    carry: 'carryDay', venueprem: 'venuepremDay', termbasis: 'termbasisDay',
    omniroute: 'omniDay', dexscreener: 'dexDay', setupconfirm: 'cfDay', combi: 'combiDay',
    omnipresent: 'opDay', omnigold1: 'og1Day', omnibtc: 'obtcDay',
    'super-setup': 'ssDay', 'super-best': 'sbDay', 'super-sniper': 'ssnDay',
    'super-book': 'sbookDay', 'super-calibrate': 'scalDay',
    pine: 'pineDay', 'pine-msb': 'pineMsbDay', 'pine-sqz': 'pineSqzDay',
    'pine-smf': 'pineSmfDay', 'pine-ht': 'pineHtDay', 'pine-smc': 'pineSmcDay',
    'pine-cipher': 'pineCipherDay', 'pine-rf': 'pineRfDay', 'pine-nw': 'pineNwDay',
    'pine-avwap': 'pineAvwapDay',
    strats: 'stratsDay', meanrev: 'meanrevDay', formationlab: 'flabDay',
    scorecard: 'scoreDay', reliability: 'relDay',
    brain: 'brainDay', book: 'bookDay', trade: 'tradeDay', log: 'logDay',
    news: 'newsDay', bias: 'biasDay', regime: 'regimeDay', trendmx: 'trendmxDay',
    rotation: 'rotationDay', execute: 'executeDay', startrader: 'starDay',
    'super-gold': 'sgDay', omnigold: 'ogDay', goldswing: 'gswDay', goldscalp: 'gscDay',
    gold: 'goldDay', goldpro: 'gproDay', goldspot: 'gspotDay', goldcoint: 'gcointDay',
    goldpine: 'gpineDay', signallog: 'slogDay',
    risk: 'riskDay', basis: 'basisDay', search: 'searchDay', finder: 'finderDay',
    tradeos: 'tosDay', hey: 'heyDay', aiagent: 'aiDay'
  };

  var HG_TAB_DAY_PAINT_IDS = [
    'swing', 'scalp', 'best', 'edge', 'smart', 'squeeze', 'reversalsniper', 'smc', 'ob',
    'trap', 'div', 'coil', 'apex', 'oiflow', 'liqs', 'onchain', 'chartvision', 'carry',
    'venueprem', 'termbasis', 'omniroute', 'dexscreener', 'setupconfirm', 'combi', 'omnipresent', 'omnigold1', 'omnibtc',
    'super-setup', 'super-best', 'super-sniper', 'super-book', 'super-calibrate',
    'pine', 'pine-msb', 'pine-sqz', 'pine-smf', 'pine-ht', 'pine-smc', 'pine-cipher', 'pine-rf', 'pine-nw', 'pine-avwap',
    'strats', 'meanrev', 'formationlab', 'scorecard', 'reliability',
    'brain', 'book', 'trade', 'log', 'news', 'bias', 'regime', 'trendmx',
    'rotation', 'execute', 'startrader',
    'super-gold', 'omnigold', 'goldswing', 'goldscalp', 'gold', 'goldpro', 'goldspot', 'goldcoint', 'goldpine', 'signallog',
    'risk', 'basis', 'search', 'finder', 'tradeos', 'hey', 'aiagent'
  ];

  var NIGHTLY_HOUR_UTC = 21;
  var __hgNightlyScheduleBusy = false;

  /* Gold lane — OG1 nightly only. Never crypto desk-edge / OMNIROUTE swing-scalp banners. */
  var HG_GOLD_TAB_IDS = {
    'super-gold': 1, omnigold: 1, omnigold1: 1, goldswing: 1, goldscalp: 1, gold: 1,
    goldpro: 1, goldspot: 1, goldcoint: 1, goldpine: 1, signallog: 1
  };

  function fin(x){ var n = +x; return isFinite(n) ? n : NaN; }

  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function resolveDeskTab(tab){
    try{
      if (typeof W.hgDeskFormationResolveTab === 'function')
        return W.hgDeskFormationResolveTab(tab) || String(tab || '').toLowerCase();
    }catch(eR){}
    return String(tab || '').toLowerCase();
  }

  function clampOpCost(night){
    var baked = 0.12;
    var n = fin(night);
    if (!isFinite(n)) return baked;
    if (n > baked) n = baked;
    if (n < 0.06) n = 0.06;
    return n;
  }

  function clampOg1(edge){
    var e = edge || {};
    return {
      minRisk: Math.max(5, isFinite(fin(e.minRisk)) ? fin(e.minRisk) : 5),
      minDisp: Math.max(0.5, isFinite(fin(e.minDisp)) ? fin(e.minDisp) : 0.5),
      gated: e.gated === true,
      biasSide: e.biasSide === true,
      bestNamed: e.bestNamed || 'minRisk5+disp0.5',
      dayExpR: isFinite(fin(e.dayExpR)) ? fin(e.dayExpR) : null
    };
  }

  function bannerText(j){
    if (!j || !j.dayUtc) return 'NIGHTLY FORMATION: baked replay floors — no day book yet.';
    var aside = (j.omniroute && j.omniroute.dayAside) || [];
    var prefer = (j.omniroute && j.omniroute.dayPrefer) || [];
    var cost = j.omnipresent && isFinite(fin(j.omnipresent.costCeilingR))
      ? fin(j.omnipresent.costCeilingR).toFixed(2) : '0.12';
    var og = j.omnigold1 || {};
    var desk = j.desk || {};
    var tighten = desk.tighten || [];
    var deskBit = tighten.length
      ? 'desk tighten ' + tighten.map(function(id){
          var row = desk.byTab && desk.byTab[id];
          return (row && row.label ? row.label : id) + '→' + (row && row.action ? row.action : 'tighten');
        }).join(', ')
      : 'desk tighten none';
    return 'NIGHTLY FORMATION ' + j.dayUtc
      + ' — OMNIROUTE aside ' + (aside.length ? aside.join(', ') : 'none')
      + ' · prefer ' + (prefer.length ? prefer.join(', ') : 'none')
      + ' · ' + deskBit
      + ' · OMNIPRESENT cost≤' + cost + 'R'
      + (j.omnipresent && j.omnipresent.standAsideTriggered ? ' · TRIGGERED stands aside (day fade book toxic)' : '')
      + ' · OG1 ' + (og.bestNamed || 'floors')
      + ' (SL$≥' + (og.minRisk || 5) + ' · disp≥' + (og.minDisp || 0.5) + '×ATR)'
      + ' — demote/tighten only, never loosens G1–G7.';
  }

  function utcDayKey(ms){
    return new Date(ms).toISOString().slice(0, 10);
  }

  function nightlyDue(lastAt, now){
    var t = now instanceof Date ? now.getTime() : +now;
    if (!isFinite(t)) return false;
    var d = new Date(t);
    if (d.getUTCHours() < NIGHTLY_HOUR_UTC) return false;
    if (!lastAt) return true;
    var prev = Date.parse(lastAt);
    if (!isFinite(prev)) return true;
    return utcDayKey(prev) !== utcDayKey(t);
  }

  function hgCollectTabDayPaintIds(){
    var seen = {}, out = [], i, g, tabs, id;
    function add(x){
      id = String(x || '');
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(id);
    }
    for (i = 0; i < HG_TAB_DAY_PAINT_IDS.length; i++) add(HG_TAB_DAY_PAINT_IDS[i]);
    try{
      if (W.HG_NAV_GROUPS && W.HG_NAV_GROUPS.length){
        for (g = 0; g < W.HG_NAV_GROUPS.length; g++){
          tabs = W.HG_NAV_GROUPS[g] && W.HG_NAV_GROUPS[g].tabs;
          if (!tabs) continue;
          for (i = 0; i < tabs.length; i++) add(tabs[i]);
        }
      }
    }catch(eNav){}
    try{
      if (W.HG_TAB_MODS){
        for (id in W.HG_TAB_MODS) if (Object.prototype.hasOwnProperty.call(W.HG_TAB_MODS, id)) add(id);
      }
    }catch(eMods){}
    try{
      if (W.HG_tabs && W.HG_tabs.length){
        for (i = 0; i < W.HG_tabs.length; i++) add(W.HG_tabs[i] && W.HG_tabs[i].id);
      }
    }catch(eTabs){}
    return out;
  }

  function repaintAllTabDays(){
    var ids = hgCollectTabDayPaintIds(), i;
    for (i = 0; i < ids.length; i++){
      try{ hgTabFormationDayPaint(ids[i]); }catch(eP){}
    }
  }

  function hgFormationNightlyApply(j){
    if (!j || typeof j !== 'object') return null;
    W.HG_FORMATION_NIGHTLY = j;
    W.HG_OG1_FORM_EDGE = clampOg1(j.omnigold1);
    try{
      var ev = W.HG_OP_REPLAY_EVIDENCE;
      if (ev && typeof ev === 'object'){
        var copy = {};
        for (var k in ev) if (Object.prototype.hasOwnProperty.call(ev, k)) copy[k] = ev[k];
        var ct = ev.costToxic ? {} : { thresholdR: 0.12 };
        if (ev.costToxic) for (var ck in ev.costToxic) if (Object.prototype.hasOwnProperty.call(ev.costToxic, ck)) ct[ck] = ev.costToxic[ck];
        var baked = isFinite(fin(ct.thresholdR)) ? fin(ct.thresholdR) : 0.12;
        if (baked > 0.12) baked = 0.12;
        ct.thresholdR = Math.min(baked, clampOpCost(j.omnipresent && j.omnipresent.costCeilingR));
        ct.nightly = true;
        copy.costToxic = ct;
        W.HG_OP_REPLAY_EVIDENCE = copy;
      }
    }catch(eOp){}
    try{ repaintAllTabDays(); }catch(eRp){}
    return j;
  }

  function isGoldTab(tab){
    return !!HG_GOLD_TAB_IDS[String(tab || '')];
  }

  function hgFormationNightlyGoldBannerHtml(){
    var j = W.HG_FORMATION_NIGHTLY;
    if (!j || !j.dayUtc) return '';
    var og = j.omnigold1 || {};
    var op = j.omnipresent || {};
    var text = 'NIGHTLY FORMATION ' + j.dayUtc
      + ' · OG1 ' + (og.bestNamed || 'floors')
      + ' (SL$≥' + (og.minRisk || 5) + ' · disp≥' + (og.minDisp || 0.5) + '×ATR)'
      + (op.goldAside ? ' · gold perps stand aside when fade book toxic' : '')
      + ' — demote/tighten only, never loosens G1–G7.';
    return '<div class="note warn" data-hg-nightly-formation="1" style="display:block;margin-bottom:10px">'
      + '<b>NIGHTLY</b> — ' + esc(text) + '</div>';
  }

  function hgFormationNightlyBannerHtml(){
    var j = W.HG_FORMATION_NIGHTLY;
    return '<div class="note warn" data-hg-nightly-formation="1" style="display:block;margin-bottom:10px">'
      + '<b>NIGHTLY</b> — ' + esc(bannerText(j)) + '</div>';
  }

  function hgTabFormationDayHtml(tab){
    var html = '';
    var id = String(tab || '');
    try{
      html += isGoldTab(id)
        ? (hgFormationNightlyGoldBannerHtml() || '')
        : (hgFormationNightlyBannerHtml() || '');
    }catch(eN){}
    if (!isGoldTab(id)){
      try{
        if (typeof W.hgDeskFormationEdgeBannerHtml === 'function')
          html += W.hgDeskFormationEdgeBannerHtml(tab) || '';
      }catch(eD){}
    }
    return html;
  }

  function hgTabFormationDayPaint(tab){
    if (!tab || !W.document) return null;
    var id = String(tab);
    if (id === 'omnigold1') return null; /* tab renders nightly in measured block */
    var pane = W.document.getElementById('tab_' + id);
    if (!pane) return null;
    var hostId = HG_TAB_DAY_HOSTS[id] || (id + 'Day');
    var host = W.document.getElementById(hostId);
    if (!host){
      host = W.document.createElement('div');
      host.id = hostId;
      host.className = 'hg-tab-day-host';
      var panel = pane.querySelector('.panel');
      if (panel && panel.parentNode) panel.parentNode.insertBefore(host, panel.nextSibling);
      else pane.insertBefore(host, pane.firstChild);
    }
    var html = hgTabFormationDayHtml(id);
    host.innerHTML = html || '';
    return host;
  }

  function hgOmniNightlyAside(kind){
    try{
      var N = W.HG_FORMATION_NIGHTLY;
      var k = String(kind || '').toUpperCase();
      if (!k || !N || !N.omniroute || !N.omniroute.dayAside) return null;
      if (N.omniroute.dayAside.indexOf(k) < 0) return null;
      var bag = N.omniroute.dayBags && N.omniroute.dayBags[k];
      return {
        kind: k, nightly: true,
        n: bag && bag.n, netR: bag && bag.avgNet, grossR: bag && bag.avgGross,
        reasons: ['nightly day-book aside on ' + (N.dayUtc || 'UTC day') + ' — formation stands aside']
      };
    }catch(eA){ return null; }
  }

  function hgOmniNightlyPrefer(kind){
    try{
      if (typeof W.hgOmniKindDemotion === 'function' && W.hgOmniKindDemotion(kind)) return false;
      var N = W.HG_FORMATION_NIGHTLY;
      var k = String(kind || '').toUpperCase();
      return !!(N && N.omniroute && N.omniroute.dayPrefer && N.omniroute.dayPrefer.indexOf(k) >= 0);
    }catch(eP){ return false; }
  }

  function hgDeskNightlyAction(tab){
    try{
      var N = W.HG_FORMATION_NIGHTLY;
      if (!N || !N.desk || !N.desk.byTab) return null;
      var id = resolveDeskTab(tab);
      return id ? (N.desk.byTab[id] || null) : null;
    }catch(eD){ return null; }
  }

  function hgDeskNightlyBestKinds(){
    try{
      var N = W.HG_FORMATION_NIGHTLY;
      if (N && N.desk && Array.isArray(N.desk.bestConfirmKinds))
        return N.desk.bestConfirmKinds.slice();
    }catch(eB){}
    return ['AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'MMOVE', 'NR7-BREAK'];
  }

  function syncBootstrap(){
    try{
      if (W.HG_FORMATION_NIGHTLY && W.HG_FORMATION_NIGHTLY.dayUtc) return W.HG_FORMATION_NIGHTLY;
      if (W.HG_FORMATION_NIGHTLY_BOOT) return hgFormationNightlyApply(W.HG_FORMATION_NIGHTLY_BOOT);
    }catch(eS){}
    return null;
  }

  async function hgFormationNightlyLoad(){
    var urls = ['/api/formation-nightly', 'scripts/formation-nightly.json'];
    var i, lastErr = null;
    for (i = 0; i < urls.length; i++){
      try{
        var r = await fetch(urls[i], { cache: 'no-store' });
        if (!r.ok){ lastErr = 'HTTP ' + r.status; continue; }
        var j = await r.json();
        if (j && j.dayUtc){ hgFormationNightlyApply(j); return j; }
      }catch(e){ lastErr = e && e.message ? e.message : String(e); }
    }
    return { ok: false, error: lastErr || 'no nightly book' };
  }

  function hgFormationNightlyWarm(){
    return hgFormationNightlyLoad().then(function(j){
      return (j && j.dayUtc) ? 'fresh' : (j && j.error ? j.error : 'no book');
    }).catch(function(e){
      return (e && e.message) || 'nightly load failed';
    });
  }

  function hgFormationNightlyScheduleTick(){
    if (__hgNightlyScheduleBusy) return;
    try{
      var j = W.HG_FORMATION_NIGHTLY;
      var applied = (j && j.asOf) ? j.asOf : null;
      if (!nightlyDue(applied, new Date())) return;
      __hgNightlyScheduleBusy = true;
      hgFormationNightlyLoad().finally(function(){
        __hgNightlyScheduleBusy = false;
      });
    }catch(eTick){ __hgNightlyScheduleBusy = false; }
  }

  function hgFormationNightlyScheduleArm(){
    if (typeof W.setInterval !== 'function') return;
    try{ W.setInterval(hgFormationNightlyScheduleTick, 60000); }catch(eArm){}
    try{ W.setTimeout(hgFormationNightlyScheduleTick, 5000); }catch(eSoon){}
  }

  W.HG_TAB_DAY_HOSTS = HG_TAB_DAY_HOSTS;
  W.HG_TAB_DAY_PAINT_IDS = HG_TAB_DAY_PAINT_IDS;
  W.hgFormationNightlyGoldBannerHtml = hgFormationNightlyGoldBannerHtml;
  W.HG_GOLD_TAB_IDS = HG_GOLD_TAB_IDS;
  W.hgCollectTabDayPaintIds = hgCollectTabDayPaintIds;
  W.hgFormationNightlyScheduleTick = hgFormationNightlyScheduleTick;
  W.hgFormationNightlyApply = hgFormationNightlyApply;
  W.hgFormationNightlyBannerHtml = hgFormationNightlyBannerHtml;
  W.hgTabFormationDayHtml = hgTabFormationDayHtml;
  W.hgTabFormationDayPaint = hgTabFormationDayPaint;
  W.hgFormationNightlyLoad = hgFormationNightlyLoad;
  W.hgFormationNightlyWarm = hgFormationNightlyWarm;
  W.hgOmniNightlyAside = hgOmniNightlyAside;
  W.hgOmniNightlyPrefer = hgOmniNightlyPrefer;
  W.hgDeskNightlyAction = hgDeskNightlyAction;
  W.hgDeskNightlyBestKinds = hgDeskNightlyBestKinds;
  W.HG_OG1_FORM_EDGE = W.HG_OG1_FORM_EDGE || { minRisk: 5, minDisp: 0.5, gated: false, biasSide: false };

  syncBootstrap();

  W.HG_warmups = W.HG_warmups || [];
  W.HG_warmups.push({ id: 'formation-nightly', label: 'NIGHTLY FORMATION', run: hgFormationNightlyWarm });

  if (typeof W.setTimeout === 'function'){
    try{ W.setTimeout(function(){ hgFormationNightlyLoad(); }, 80); }catch(eLoad){}
  }
  if (typeof W.location !== 'undefined' && W.location){
    hgFormationNightlyScheduleArm();
  }
})();
