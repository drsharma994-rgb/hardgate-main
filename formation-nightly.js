/* HARDGATE — nightly formation overlay (browser).
   Fetches /api/formation-nightly (fallback: committed scripts/formation-nightly.json)
   and retunes OMNIROUTE / OMNIPRESENT / OMNIGOLD 1 + 19 desk tabs from the
   rolling 40-day book. Adds asides and tightens floors only. Never loosens
   G1–G7, baked demotes, or baked desk suppress. Never invents tickets. */
(function(){
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;

  function fin(x){ var n = +x; return isFinite(n) ? n : NaN; }

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
    return j;
  }

  function hgFormationNightlyBannerHtml(){
    var j = W.HG_FORMATION_NIGHTLY;
    return '<div class="note warn" data-hg-nightly-formation="1" style="display:block;margin-bottom:10px">'
      + '<b>NIGHTLY</b> — ' + String(bannerText(j)).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
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
      var id = String(tab || '').toLowerCase();
      return N.desk.byTab[id] || null;
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

  W.hgFormationNightlyApply = hgFormationNightlyApply;
  W.hgFormationNightlyBannerHtml = hgFormationNightlyBannerHtml;
  W.hgFormationNightlyLoad = hgFormationNightlyLoad;
  W.hgOmniNightlyAside = hgOmniNightlyAside;
  W.hgOmniNightlyPrefer = hgOmniNightlyPrefer;
  W.hgDeskNightlyAction = hgDeskNightlyAction;
  W.hgDeskNightlyBestKinds = hgDeskNightlyBestKinds;
  W.HG_OG1_FORM_EDGE = W.HG_OG1_FORM_EDGE || { minRisk: 5, minDisp: 0.5, gated: false, biasSide: false };

  if (typeof W.setTimeout === 'function'){
    try{ W.setTimeout(function(){ hgFormationNightlyLoad(); }, 80); }catch(eLoad){}
  }
})();
