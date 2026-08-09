/* HARDGATE — Freqtrade edge/protection helpers for browser formation scoring.
   Mirrors lib/freqtrade-edge.mjs (pure, no deps). Loaded after formation.js. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function num(v){
  var n = +v;
  return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n;
}
function round(v, dp){
  dp = dp || 3;
  return isFinite(v) ? Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp) : null;
}

function ftExpectancy(winRate, riskRewardRatio){
  var w = num(winRate), r = num(riskRewardRatio);
  if (w === null || r === null) return null;
  w = Math.max(0, Math.min(1, w));
  return round(r * w - (1 - w));
}

function ftRiskRewardFromTrades(trades){
  var wins = 0, loss = 0, winSum = 0, lossSum = 0;
  for (var i = 0; i < (trades || []).length; i++){
    var r = num(trades[i] && (trades[i].r != null ? trades[i].r : trades[i].R));
    if (r === null) continue;
    if (r > 0){ wins++; winSum += r; }
    else if (r < 0){ loss++; lossSum += Math.abs(r); }
  }
  if (!wins || !loss) return wins && !loss ? Infinity : null;
  return round(winSum / wins / (lossSum / loss));
}

function ftEdgeRow(trades){
  var arr = (trades || []).filter(function(t){ return num(t && t.r) !== null; });
  var n = arr.length;
  if (!n) return { n: 0, winRate: null, expectancy: null, ok: false };
  var wins = 0, winSum = 0, lossN = 0, lossSum = 0;
  for (var i = 0; i < arr.length; i++){
    var r = num(arr[i].r);
    if (r > 0){ wins++; winSum += r; }
    else if (r < 0){ lossN++; lossSum += Math.abs(r); }
  }
  var winRate = wins / n;
  var rrr = ftRiskRewardFromTrades(arr);
  var exp = rrr === Infinity ? Infinity : (rrr != null ? ftExpectancy(winRate, rrr) : null);
  return {
    n: n, winRate: round(winRate, 4),
    riskRewardRatio: rrr === Infinity ? 'inf' : rrr,
    expectancy: exp === Infinity ? 'inf' : exp,
    ok: exp === Infinity || (exp != null && exp >= 0),
  };
}

function ftEdgeTableFromRecords(records, keyFn){
  keyFn = keyFn || function(r){ return String(r.sym || r.symbol || 'na').toUpperCase(); };
  var buckets = {}, all = [];
  for (var i = 0; i < (records || []).length; i++){
    var rec = records[i];
    if (!rec || rec.status !== 'settled' || !isFinite(+rec.r)) continue;
    all.push(rec);
    var k = keyFn(rec);
    if (!buckets[k]) buckets[k] = [];
    buckets[k].push(rec);
  }
  var families = [];
  for (var key in buckets){
    if (!Object.prototype.hasOwnProperty.call(buckets, key)) continue;
    families.push(Object.assign({ key: key }, ftEdgeRow(buckets[key])));
  }
  families.sort(function(a, b){
    var ea = a.expectancy === 'inf' ? 999 : (a.expectancy != null ? a.expectancy : -999);
    var eb = b.expectancy === 'inf' ? 999 : (b.expectancy != null ? b.expectancy : -999);
    return eb - ea;
  });
  return {
    global: ftEdgeRow(all),
    families: families,
    lookup: function(key){ return ftEdgeRow(buckets[key] || []); },
  };
}

function hgFtFormationBoost(plan, records){
  try{
    if (!plan) return 0;
    var sym = plan.sym || plan.symbol || plan.ticker;
    var tbl = ftEdgeTableFromRecords(records || (typeof G.hgScoreRecords === 'function' ? G.hgScoreRecords() : []),
      function(r){ return String(r.sym || sym || 'na').toUpperCase(); });
    var row = tbl.lookup(String(sym || '').toUpperCase());
    if (!row || !row.n || row.n < 3) return 0;
    var exp = row.expectancy;
    if (exp === 'inf') return 12;
    if (exp == null) return 0;
    if (exp >= 0.5) return 15;
    if (exp >= 0.25) return 10;
    if (exp >= 0) return 5;
    if (exp >= -0.15) return -3;
    return -8;
  }catch(e){ return 0; }
}

function hgFtEdgePanelHtml(records){
  try{
    var tbl = ftEdgeTableFromRecords(records);
    var h = '<div class="hg-panel__legend" style="margin-top:10px">Freqtrade edge · expectancy rank</div>';
    h += '<div class="note">GLOBAL n=' + (tbl.global.n || 0)
      + ' · win% ' + (tbl.global.winRate != null ? Math.round(tbl.global.winRate * 100) : 'n/a')
      + ' · E ' + (tbl.global.expectancy != null ? tbl.global.expectancy : 'n/a') + '</div>';
    if (tbl.families.length){
      h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>family</th><th>n</th><th>win%</th><th class="hg-right">E</th></tr></thead><tbody>';
      var show = tbl.families.slice(0, 6);
      for (var i = 0; i < show.length; i++){
        var row = show[i];
        h += '<tr><td>' + row.key + '</td><td class="hg-num">' + row.n + '</td><td class="hg-num">'
          + (row.winRate != null ? Math.round(row.winRate * 100) : '—') + '</td><td class="hg-num hg-right">'
          + (row.expectancy != null ? row.expectancy : '—') + '</td></tr>';
      }
      h += '</tbody></table>';
    } else {
      h += '<div class="note">no settled trades — Freqtrade edge fills as scorecard settles</div>';
    }
    return h;
  }catch(e){ return ''; }
}

G.ftExpectancy = ftExpectancy;
G.hgFtFormationBoost = hgFtFormationBoost;
G.hgFtEdgePanelHtml = hgFtEdgePanelHtml;
G.ftEdgeTableFromRecords = ftEdgeTableFromRecords;

})();
