/* HARDGATE — stand-down discipline banner (pure, read-only on ledger). */

export const HG_STANDDOWN_DEFAULTS = {
  maxConsecutiveLosses: 3,
  maxDailyLossR: -3,
  maxWeeklyLossR: -6,
};

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function rOf(rec){
  var rn = fin(rec && rec.rNet);
  if (rn !== null) return rn;
  return fin(rec && rec.r);
}

function dayKey(ms){
  var d = new Date(ms);
  return d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' + d.getUTCDate();
}

function weekKey(ms){
  var d = new Date(ms);
  var day = d.getUTCDay();
  var diff = (day === 0 ? -6 : 1) - day;
  var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return mon.getUTCFullYear() + '-W' + Math.floor((mon - new Date(Date.UTC(mon.getUTCFullYear(), 0, 1))) / 604800000);
}

export function hgStandDownState(records, cfg){
  cfg = Object.assign({}, HG_STANDDOWN_DEFAULTS, cfg || {});
  var list = (Array.isArray(records) ? records.slice() : [])
    .filter(function(r){ return r && r.status === 'settled'; })
    .sort(function(a, b){
      var ta = fin(a.closedAt) || fin(a.settledAt) || fin(a.at) || 0;
      var tb = fin(b.closedAt) || fin(b.settledAt) || fin(b.at) || 0;
      return tb - ta;
    });

  var consecutiveLosses = 0;
  for (var i = 0; i < list.length; i++){
    var rv = rOf(list[i]);
    if (rv === null) continue;
    if (rv < 0) consecutiveLosses++;
    else break;
  }

  var now = Date.now();
  var today = dayKey(now);
  var thisWeek = weekKey(now);
  var dayR = 0, weekR = 0;
  for (var j = 0; j < list.length; j++){
    var rec = list[j];
    var r = rOf(rec);
    if (r === null) continue;
    var tms = fin(rec.closedAt) || fin(rec.settledAt) || fin(rec.at);
    if (tms === null) continue;
    if (dayKey(tms) === today) dayR += r;
    if (weekKey(tms) === thisWeek) weekR += r;
  }

  var reasons = [];
  if (consecutiveLosses >= cfg.maxConsecutiveLosses){
    reasons.push(consecutiveLosses + ' consecutive losses');
  }
  if (dayR <= cfg.maxDailyLossR){
    reasons.push(dayR.toFixed(1) + 'R today');
  }
  if (weekR <= cfg.maxWeeklyLossR){
    reasons.push(weekR.toFixed(1) + 'R this week');
  }

  var clearsAt = null;
  if (reasons.length){
    var tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    clearsAt = tomorrow.getTime();
  }

  return {
    tripped: reasons.length > 0,
    reasons: reasons,
    consecutiveLosses: consecutiveLosses,
    dayR: Math.round(dayR * 100) / 100,
    weekR: Math.round(weekR * 100) / 100,
    clearsAt: clearsAt,
  };
}
