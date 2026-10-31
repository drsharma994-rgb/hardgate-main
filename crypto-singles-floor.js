/* HARDGATE — CRYPTO SINGLE DESKS admission floor (hg-v1434).
   ONE shared helper consulted at each single desk's mint seam, BEFORE the
   forward record, clauses keyed by desk, every clause fail-open (an
   unreadable tape abstains — third state, never a verdict), demote-not-hide:
   the card keeps its levels with the reason named and the ledger row records
   ticket=false, exactly the hg-v1432 inline-floor shape.

   Measured basis (Wave B census, desks/cryptosingles/baseline-census.json —
   12 majors, 12.1 months Binance spot, each desk's OWN entry/stop/target and
   horizon, next-open fill, stop-first, both-touch=loss, 0.20%/0.04% RT, both
   chronological halves). A clause ships ONLY where its dropped cohort settled
   negative in BOTH halves (the hg-v966 rule); every refusal is named in the
   build-stamp pack note with its numbers.

   Lever: window.HG_CSINGLES_FLOOR = false restores pre-v1434 admission
   everywhere. window.HG_CSINGLES_FLOOR_<DESK> = false retires one desk's
   clauses (key = desk name, uppercased, non-alnum -> '-'). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_CS_COST_STOP_FRAC = 4 * 0.0020;   /* 4x the 0.20% taker RT = 0.80% of entry */
var HG_CS_ER_MIN = 0.30;

/* Kaufman efficiency ratio on closes — same construction as the census. */
function hgCsErN(rows, n){
  try{
    if (!Array.isArray(rows) || rows.length < n + 1) return NaN;
    var c0 = +rows[rows.length - 1 - n].c, c1 = +rows[rows.length - 1].c, den = 0;
    for (var i = rows.length - n; i < rows.length; i++) den += Math.abs(+rows[i].c - +rows[i - 1].c);
    return den > 0 ? Math.abs(c1 - c0) / den : 0;
  }catch(e){ return NaN; }
}
function hgCsVolZ(rows, n){
  try{
    if (!Array.isArray(rows) || rows.length < n + 1) return NaN;
    var vs = rows.slice(-n - 1, -1).map(function(r){ return +r.v; });
    var m = vs.reduce(function(a, b){ return a + b; }, 0) / vs.length;
    var sd = Math.sqrt(vs.reduce(function(a, b){ return a + (b - m) * (b - m); }, 0) / vs.length);
    return sd > 0 ? (+rows[rows.length - 1].v - m) / sd : 0;
  }catch(e){ return NaN; }
}
function hgCsEmaLast(vals, n){
  if (vals.length < n) return NaN;
  var k = 2 / (n + 1), e = vals[vals.length - n];
  for (var i = vals.length - n + 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}
/* Resample the desk's own rows to the HTF (4h->1d, 15m->1h) so no desk needs
   a new fetch: close-vs-EMA50 on the resampled tape. Abstains under 55 bars. */
function hgCsHtfWith(rows, htfSec, dir){
  try{
    if (!Array.isArray(rows) || rows.length < 60 || !(htfSec > 0)) return null;
    var closes = [], curKey = null;
    for (var i = 0; i < rows.length; i++){
      var t = +rows[i].t; if (t > 1e12) t = Math.floor(t / 1000);
      var key = Math.floor(t / htfSec);
      if (key !== curKey){ curKey = key; closes.push(+rows[i].c); }
      else closes[closes.length - 1] = +rows[i].c;
    }
    if (closes.length < 55) return null;
    var e = hgCsEmaLast(closes, 50);
    if (!isFinite(e)) return null;
    var last = closes[closes.length - 1];
    return dir === 'long' ? last > e : last < e;
  }catch(e){ return null; }
}

function csStopFrac(cand){
  var entry = +(cand && cand.entry), stop = +(cand && cand.stop);
  return (isFinite(entry) && entry > 0 && isFinite(stop)) ? Math.abs(entry - stop) / entry : NaN;
}
function csDemote(out, txt){ out.demote = true; out.reasons.push(txt); }

/* The clause table. Every string names its measured cohort verbatim so the
   card, the ledger reads and the build stamp say the same sentence. */
var HG_CS_CLAUSES = {
  'STARTRADER': [
    { kind: 'costR', demote: true, txt: 'UNDER THE COST FLOOR — stop %SF% of entry < 4x the 0.20% taker round trip (cohort -0.655R/-0.644R both halves, hg-v1434)' },
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 4h rows (cohort -0.148R/-0.296R both halves, hg-v1434)' },
    { kind: 'htf', htfSec: 86400, demote: true, txt: 'COUNTER-TAPE — 1d close vs EMA50 disagrees with the direction (cohort -0.386R/-0.468R both halves, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 on a drying tape (cohort -0.106R/-0.358R both halves, hg-v1434)' }
  ],
  'BEST-NEAR': [
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 4h rows (near cohort -0.014R/-0.029R both halves; kept +0.128R, hg-v1434)' }
  ],
  'CRYPTOVERSE': [
    { kind: 'costR', demote: true, txt: 'UNDER THE COST FLOOR — stop %SF% of entry < 4x RT (cohort -0.385R/-0.289R both halves, hg-v1434)' },
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 15m rows (cohort -0.330R/-0.261R both halves, hg-v1434)' },
    { kind: 'htf', htfSec: 3600, demote: true, txt: 'COUNTER-TAPE — 1h close vs EMA50 disagrees (cohort -0.664R/-0.302R both halves, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 (cohort -0.504R/-0.279R both halves, hg-v1434)' }
  ],
  '90PERCENT': [
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 15m rows (cohort -0.203R/-0.208R both halves, hg-v1434)' },
    { kind: 'htf', htfSec: 3600, demote: true, txt: 'COUNTER-TAPE — 1h close vs EMA50 disagrees (cohort -0.004R/-0.094R both halves, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 (cohort -0.265R/-0.179R both halves, hg-v1434)' }
  ],
  'CHARTVISION-SCALP': [
    { kind: 'costR', demote: true, txt: 'UNDER THE COST FLOOR — stop %SF% of entry < 4x RT (cohort -0.648R/-1.271R both halves, hg-v1434)' },
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 15m rows (cohort -0.424R/-0.797R both halves, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 (cohort -0.327R/-0.676R both halves, hg-v1434)' }
  ],
  /* swing: ER(20) adopted marginally (-0.017R/-0.015R) — record-only mark,
     gates nothing (the hg-v1420 shape for a marginal clause). */
  'CHARTVISION-SWING': [
    { kind: 'er20', demote: false, txt: 'CHOP — ER(20) %ER% < 0.30 on the 4h rows (cohort -0.017R/-0.015R both halves, hg-v1434; mark only)' }
  ],
  'FINDER-SCALP': [
    { kind: 'costR', demote: true, txt: 'UNDER THE COST FLOOR — stop %SF% of entry < 4x RT (cohort -0.278R/-1.288R both halves, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 (cohort -0.390R/-1.346R both halves, hg-v1434)' }
  ],
  'FINDER-JUDAS': [
    { kind: 'costR', demote: true, txt: 'UNDER THE COST FLOOR — stop %SF% of entry < 4x RT (cohort -0.980R/-0.294R both halves, thin n=47, hg-v1434)' },
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 15m rows (cohort -0.479R/-0.396R both halves, thin n=47, hg-v1434)' },
    { kind: 'volz', demote: true, txt: 'STAND ASIDE — vol z %VZ% < 0 (cohort -0.593R/-0.144R both halves, thin n=47, hg-v1434)' }
  ],
  'REVERSALSNIPER': [
    { kind: 'er20', demote: true, txt: 'CHOP STAND-ASIDE — ER(20) %ER% < 0.30 on the 4h rows (cohort -0.280R/-0.043R both halves, hg-v1434)' },
    { kind: 'htf', htfSec: 86400, demote: true, txt: 'COUNTER-TAPE — 1d close vs EMA50 disagrees (cohort -0.199R/-0.099R both halves, hg-v1434)' }
  ]
};

function hgCryptoSinglesFloor(desk, cand, rows){
  var out = { demote: false, reasons: [], marks: [], abstained: [] };
  try{
    if (G.HG_CSINGLES_FLOOR === false) return out;
    var key = String(desk || '').toUpperCase().replace(/[^A-Z0-9]/g, '-');
    if (G['HG_CSINGLES_FLOOR_' + key] === false) return out;
    var clauses = HG_CS_CLAUSES[key] || [];
    var sf = NaN, er = NaN, vz = NaN, hw = null;
    for (var ci = 0; ci < clauses.length; ci++){
      var c = clauses[ci], txt = null;
      if (c.kind === 'costR'){
        if (!isFinite(sf)) sf = csStopFrac(cand);
        if (!isFinite(sf)){ out.abstained.push('costR'); continue; }
        if (sf < HG_CS_COST_STOP_FRAC) txt = c.txt.replace('%SF%', (sf * 100).toFixed(2) + '%');
      } else if (c.kind === 'er20'){
        if (!isFinite(er)) er = hgCsErN(rows, 20);
        if (!isFinite(er)){ out.abstained.push('er20'); continue; }
        if (er < HG_CS_ER_MIN) txt = c.txt.replace('%ER%', er.toFixed(2));
      } else if (c.kind === 'volz'){
        if (!isFinite(vz)) vz = hgCsVolZ(rows, 20);
        if (!isFinite(vz)){ out.abstained.push('volz'); continue; }
        if (vz < 0) txt = c.txt.replace('%VZ%', vz.toFixed(2));
      } else if (c.kind === 'htf'){
        if (hw === null) hw = hgCsHtfWith(rows, c.htfSec, (cand && cand.dir) || 'long');
        if (hw === null){ out.abstained.push('htf'); continue; }
        if (hw === false) txt = c.txt;
      }
      if (txt){ if (c.demote) csDemote(out, txt); else out.marks.push(txt); }
    }
  }catch(e){ out.demote = false; }
  return out;
}

/* Measured-expectancy banners. Paint-level honesty for the desks whose book
   stays negative even after the floors — the tab says the number, the floors
   trim the bleed, the forward ledger decides. */
var HG_CS_BANNERS = {
  'CRYPTOVERSE': 'MEASURED — the 12-major 12.1-month census of every minted CVERSE-SWEEP@V1 card: n=2317, 34.5% win, -0.260R at 0.20% RT, negative in BOTH halves (-0.383/-0.258); -0.075R even at 0.04% RT. The floors above trim the worst cohorts; the whole book is still negative. RECORD-ONLY until the forward ledger says otherwise.',
  '90PERCENT': 'MEASURED — n=415, 34.0% win, -0.211R at 0.20% RT, negative both halves (-0.216/-0.209); -0.032R at 0.04% RT. Floors trim; the book is still red at taker.',
  'CHARTVISION-SCALP': 'MEASURED — n=1406, 37.0% win, -0.585R at 0.20% RT, negative both halves (-0.421/-0.749); -0.131R at 0.04% RT. The scalp lane re-presents the Wave A scalp-near failure; crowns are READS, not tickets.',
  'FINDER-SCALP': 'MEASURED — n=135, 31.1% win, -0.710R at 0.20% RT, negative both halves (-0.220/-1.193).',
  'FINDER-JUDAS': 'MEASURED — n=47 (thin), 31.9% win, -0.319R at 0.20% RT, negative both halves (-0.445/-0.198).',
  'SYNDICATE': 'MEASURED STAND-DOWN — the kline-only relay minted 111 blueprints over 12.1 months: 17.6% win into ~2.2R targets, -4.21R at 0.20% RT, negative in BOTH halves (-5.577/-2.899). Floors were tested and refused (best kept cohort still -1.14R). Blueprints are READS for the news desk, never orders — the desk already sends none.'
};
function hgCryptoSignState(withN, against){
  if (against > 0) return 'against';
  if (withN > 0) return 'with';
  return 'unread';
}
/* hg-v1482: the three signs on a crypto setup. Technical is the desk's own
   direction. Sentiment is taker flow, funding, fear and greed, the 25-delta
   skew. Fundamental is on-chain, term structure, real rates, hashrate, NVT
   and COT. A neutral print does not vote. Unread is not agreement and is
   not a verdict — the holdout rejected treating a missing feed as a reason
   to erase the setup. A sign that printed and is against the trade is. */
function hgCryptoSigns(dir, sym, rows){
  var d = String(dir || '').toLowerCase();
  var out = {
    technical: (d === 'long' || d === 'short') ? 'with' : 'unread',
    sentiment: 'unread', fundamental: 'unread',
    sentimentNames: [], fundamentalNames: [], line: '', why: ''
  };
  if (out.technical !== 'with'){
    out.line = 'technical unread';
    return out;
  }
  var sw = 0, sa = 0, fw = 0, fa = 0;
  try{
    var last = rows && rows.length ? rows[rows.length - 1] : null;
    var vol = last ? +last.v : NaN, tb = last ? +last.tb : NaN;
    if (vol > 0 && isFinite(tb)){
      var imb = tb / vol - 0.5;
      if (Math.abs(imb) > 0.02){
        var withFlow = d === 'long' ? imb > 0 : imb < 0;
        if (withFlow) sw++; else sa++;
        out.sentimentNames.push('taker flow');
      }
    }
  }catch(eTb){}
  try{
    var fr = NaN, list = G.S && G.S.tickers, u = String(sym || '').toUpperCase();
    if (list && u){
      for (var ti = 0; ti < list.length; ti++){
        var ts = String(list[ti] && list[ti].symbol || '').toUpperCase();
        if (ts && (ts === u || ts.indexOf(u) === 0 || u.indexOf(ts) === 0) && isFinite(+list[ti].fundingPct)){
          fr = +list[ti].fundingPct; break;
        }
      }
    }
    if (isFinite(fr) && (fr >= 0.05 || fr <= -0.05)){
      var fundVote = fr >= 0.05 ? 'bear' : 'bull';
      var want = d === 'long' ? 'bull' : 'bear';
      if (fundVote === want) sw++; else sa++;
      out.sentimentNames.push('funding');
    }
  }catch(eFr){}
  try{
    if (typeof G.hgFundamentalRegime === 'function'){
      var regime = G.hgFundamentalRegime('btc', {});
      var legs = regime && regime.legs;
      var sentKeys = { fng: 1, retail: 1, toptrader: 1, funding: 1, rr25d: 1, oidiv: 1 };
      var fundKeys = { onchain: 1, term: 1, realrate: 1, hashrate: 1, nvt: 1, cot: 1 };
      var want2 = d === 'long' ? 'bull' : 'bear';
      for (var i = 0; i < (legs ? legs.length : 0); i++){
        var leg = legs[i];
        if (!leg || leg.info || leg.state !== 'checked') continue;
        if (leg.vote !== 'bull' && leg.vote !== 'bear') continue;
        var side = leg.vote === want2;
        if (sentKeys[leg.key]){
          if (leg.key === 'funding' && out.sentimentNames.indexOf('funding') >= 0) continue;
          if (side) sw++; else sa++;
          out.sentimentNames.push(leg.label || leg.key);
        } else if (fundKeys[leg.key]){
          if (side) fw++; else fa++;
          out.fundamentalNames.push(leg.label || leg.key);
        }
      }
    }
  }catch(eRg){}
  out.sentiment = hgCryptoSignState(sw, sa);
  out.fundamental = hgCryptoSignState(fw, fa);
  out.line = 'technical with · sentiment ' + out.sentiment
    + (out.sentimentNames.length ? ' (' + out.sentimentNames.join(', ') + ')' : '')
    + ' · fundamental ' + out.fundamental
    + (out.fundamentalNames.length ? ' (' + out.fundamentalNames.join(', ') + ')' : '');
  if (out.sentiment === 'against' || out.fundamental === 'against'){
    var bad = [];
    if (out.sentiment === 'against') bad.push('sentiment against');
    if (out.fundamental === 'against') bad.push('fundamental against');
    out.why = 'SIGNS — ' + bad.join('; ') + '. ' + out.line
      + '. A setup does not form against a sign that printed';
  }
  return out;
}

function hgCryptoSinglesBannerHtml(desk){
  try{
    var key = String(desk || '').toUpperCase().replace(/[^A-Z0-9]/g, '-');
    var t = HG_CS_BANNERS[key];
    if (!t) return '';
    return '<div class="note warn" style="margin:6px 0;font-size:11px"><b>' + t.split('—')[0].trim() + '</b> — ' + t.substring(t.indexOf('—') + 1).trim() + '</div>';
  }catch(e){ return ''; }
}

G.hgCryptoSinglesFloor = hgCryptoSinglesFloor;
G.hgCryptoSinglesBannerHtml = hgCryptoSinglesBannerHtml;
G.hgCryptoSigns = hgCryptoSigns;
G.HG_CS_FLOOR_VERSION = 'hg-v1434';
})();
