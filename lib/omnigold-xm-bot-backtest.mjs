/* HARDGATE — OMNIGOLD XM bot backtest (pure).
   Replays what the bot would SEND, not the mechanic walk-forward:
     1. TICKET rows only (same ogXmTicketOk as live)
     2. pending fill at setup entry (BUY/SELL/LIMIT/STOP from xmOrderType)
     3. after fill, stop-first if one bar spans SL and T1
     4. unfilled ≠ loss
     5. GROSS and NET of the $0.30×2 gold round-trip
   Never POSTs to XM. Browser-safe (no node: imports). */
import { xmOrderType } from './xm-order-type.mjs';
import { ogXmTicketOk, ogXmClipLots } from './omnigold-xm-ticket.mjs';

export { ogXmTicketOk, ogXmClipLots } from './omnigold-xm-ticket.mjs';
export { xmOrderType } from './xm-order-type.mjs';

export const OG_XM_SPREAD_USD = 0.30;

function num(v){
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function skip(reason){
  return {
    state: 'skip', reason: reason || 'not an OMNIGOLD ticket',
    rGross: null, rNet: null, usdGross: null, usdNet: null,
  };
}

/** Does this bar fill a pending/market XM order at `entry`? */
export function ogXmBarTouchesEntry(typeName, dir, bar, entry){
  if (!bar) return false;
  var e = num(entry);
  if (!(e > 0)) return false;
  var name = String(typeName || '');
  if (name === 'BUY' || name === 'SELL') return true;
  var h = num(bar.h), l = num(bar.l);
  if (!isFinite(h) || !isFinite(l)) return false;
  if (name === 'BUY_LIMIT' || name === 'SELL_STOP') return l <= e;
  if (name === 'SELL_LIMIT' || name === 'BUY_STOP') return h >= e;
  return dir === 'short' ? h >= e : l <= e;
}

function usdFromR(r, risk, lots){
  if (r == null || !isFinite(r) || !(risk > 0)) return null;
  var oz = (ogXmClipLots(lots) || 0.01) / 0.01;
  return Math.round(r * risk * oz * 100) / 100;
}

/**
 * Walk one bot send: fill the pending order, then SL / T1 / open.
 * Signal bar is `signalIdx` (closed); search starts at signalIdx+1.
 */
export function ogXmBotWalkTrade(rows, signalIdx, ticket, opts){
  opts = opts || {};
  if (!ogXmTicketOk(ticket)) return skip('not an OMNIGOLD ticket');
  if (!Array.isArray(rows) || !rows.length) return skip('no bars');
  var i = signalIdx | 0;
  if (!(i >= 0 && i < rows.length - 1)) return skip('no forward bars');
  var plan = ticket.plan;
  var dir = ticket.dir === 'short' ? 'short' : 'long';
  var entry = num(plan.entry);
  var stop = num(plan.stop);
  var t1 = num(plan.t1);
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return skip('no risk');
  var livePx = num(ticket.livePx);
  if (!(livePx > 0) && rows[i]) livePx = num(rows[i].c);
  var ot = xmOrderType(dir, entry, livePx);
  var horizon = isFinite(+opts.horizon) && +opts.horizon > 0 ? (+opts.horizon | 0) : 20;
  var fillBars = isFinite(+opts.fillBars) && +opts.fillBars > 0 ? (+opts.fillBars | 0) : horizon;
  var spreadUsd = isFinite(+opts.spreadUsd) ? +opts.spreadUsd : OG_XM_SPREAD_USD;
  if (!(spreadUsd >= 0)) spreadUsd = OG_XM_SPREAD_USD;
  var lots = ogXmClipLots(opts.lots != null ? opts.lots : 0.01) || 0.01;
  var costR = (spreadUsd * 2) / risk;
  var end = Math.min(rows.length - 1, i + horizon);
  var filled = false, wait = 0, k, filledAt = null;

  function settle(state, at, rGross){
    var rNet = (rGross == null) ? null : (rGross - costR);
    return {
      state: state,
      reason: state,
      type: ot.name,
      dir: dir,
      kind: ticket.kind || '',
      horizon: ticket.horizon || '',
      signalIdx: i,
      filledAt: filledAt,
      exitAt: at,
      entry: entry,
      stop: stop,
      t1: t1,
      fillPx: filled ? entry : null,
      risk: risk,
      rGross: rGross,
      rNet: rNet,
      usdGross: usdFromR(rGross, risk, lots),
      usdNet: usdFromR(rNet, risk, lots),
      lots: lots,
      spreadUsd: spreadUsd,
    };
  }

  function hitStop(b){
    return dir === 'long' ? num(b.l) <= stop : num(b.h) >= stop;
  }
  function hitT1(b){
    return dir === 'long' ? num(b.h) >= t1 : num(b.l) <= t1;
  }

  for (k = i + 1; k <= end; k++){
    var b = rows[k];
    if (!b) continue;
    if (!filled){
      if (ogXmBarTouchesEntry(ot.name, dir, b, entry)){
        filled = true;
        filledAt = k;
      } else {
        wait++;
        if (wait >= fillBars) return settle('unfilled', k, null);
        continue;
      }
    }
    if (hitStop(b) && hitT1(b)) return settle('stop', k, -1);
    if (hitStop(b)) return settle('stop', k, -1);
    if (hitT1(b)) return settle('t1', k, Math.abs(t1 - entry) / risk);
  }
  if (!filled) return settle('unfilled', end, null);
  return settle('open', end, null);
}

function summarizeTrades(trades, opts){
  opts = opts || {};
  var lots = ogXmClipLots(opts.lots != null ? opts.lots : 0.01) || 0.01;
  var spreadUsd = isFinite(+opts.spreadUsd) ? +opts.spreadUsd : OG_XM_SPREAD_USD;
  var sent = 0, settled = 0, unfilled = 0, open = 0, skipped = 0;
  var wins = 0, losses = 0, sumGross = 0, sumNet = 0, sumUsdNet = 0;
  var i, t;
  for (i = 0; i < (trades || []).length; i++){
    t = trades[i];
    if (!t || t.state === 'skip'){ skipped++; continue; }
    sent++;
    if (t.state === 'unfilled'){ unfilled++; continue; }
    if (t.state === 'open'){ open++; continue; }
    if (t.state === 't1' || t.state === 'stop'){
      settled++;
      if (t.state === 't1') wins++;
      else losses++;
      if (t.rGross != null) sumGross += t.rGross;
      if (t.rNet != null) sumNet += t.rNet;
      if (t.usdNet != null) sumUsdNet += t.usdNet;
    }
  }
  return {
    sent: sent,
    settled: settled,
    unfilled: unfilled,
    open: open,
    skipped: skipped,
    wins: wins,
    losses: losses,
    hit: settled ? wins / settled : null,
    expGross: settled ? sumGross / settled : null,
    expNet: settled ? sumNet / settled : null,
    sumGross: sumGross,
    sumNet: sumNet,
    usdNet: sumUsdNet,
    lots: lots,
    spreadUsd: spreadUsd,
    trades: trades || [],
  };
}

export function ogXmBotSummarize(trades, opts){
  return summarizeTrades(trades, opts);
}

/** Replay an already-built signal list. Cooldown skips overlapping sends. */
export function ogXmBotBacktest(rows, signals, opts){
  opts = opts || {};
  var horizon = isFinite(+opts.horizon) && +opts.horizon > 0 ? (+opts.horizon | 0) : 20;
  var cooldown = isFinite(+opts.cooldown) && +opts.cooldown > 0 ? (+opts.cooldown | 0) : horizon;
  var list = Array.isArray(signals) ? signals.slice() : [];
  list.sort(function(a, b){ return (a && a.i) - (b && b.i); });
  var takenUntil = -1;
  var trades = [];
  var s, i, t;
  for (s = 0; s < list.length; s++){
    if (!list[s] || list[s].i == null) continue;
    i = list[s].i | 0;
    if (i <= takenUntil) continue;
    t = ogXmBotWalkTrade(rows, i, list[s].ticket, opts);
    if (!t || t.state === 'skip') continue;
    trades.push(t);
    takenUntil = i + cooldown;
  }
  return summarizeTrades(trades, opts);
}

/**
 * Walk prefixes with scanFn(prefix, i) → ticket|null.
 * After a sendable ticket, skip `cooldown` bars (one-account, no look-ahead).
 */
export function ogXmBotBacktestFromScan(rows, scanFn, opts){
  opts = opts || {};
  if (!Array.isArray(rows) || typeof scanFn !== 'function'){
    return summarizeTrades([], opts);
  }
  var warm = isFinite(+opts.warm) ? (+opts.warm | 0) : 60;
  var horizon = isFinite(+opts.horizon) && +opts.horizon > 0 ? (+opts.horizon | 0) : 20;
  var cooldown = isFinite(+opts.cooldown) && +opts.cooldown > 0 ? (+opts.cooldown | 0) : horizon;
  var signals = [];
  var i, ticket;
  for (i = warm; i < rows.length - horizon; i++){
    ticket = null;
    try { ticket = scanFn(rows.slice(0, i + 1), i); } catch (e) { ticket = null; }
    if (!ticket) continue;
    signals.push({ i: i, ticket: ticket });
    i += cooldown;
  }
  return ogXmBotBacktest(rows, signals, opts);
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtR(n){
  if (n == null || !isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + 'R';
}

function fmtUsd(n){
  if (n == null || !isFinite(n)) return '—';
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

function fmtPct(n){
  if (n == null || !isFinite(n)) return '—';
  return (n * 100).toFixed(0) + '%';
}

/** Honest readout — numbers only, no forecast language. */
export function ogXmBotBacktestHtml(sum, label){
  sum = sum || summarizeTrades([]);
  var title = label ? esc(label) : 'XM bot backtest';
  var h = '<div class="panel og-xm-bt">'
    + '<h3>' + title + '</h3>'
    + '<p class="note">IN-SAMPLE on the gold bars this scan fetched. This is the bot send path — '
    + '<b>TICKET</b> rows only, fill at the setup entry (pending), stop-first if one bar spans SL and T1. '
    + 'Unfilled pendings are not losses. Figures are <b>GROSS</b> and <b>NET</b> of a $'
    + (isFinite(sum.spreadUsd) ? (sum.spreadUsd * 2).toFixed(2) : '0.60')
    + ' round-trip gold spread ($'
    + (isFinite(sum.spreadUsd) ? sum.spreadUsd.toFixed(2) : '0.30')
    + '×2). Session/killzone read each prefix bar; macro and news use the last scan snapshot. '
    + 'Not a live XM statement, not a profit forecast.</p>'
    + '<div class="note">sent ' + sum.sent
    + ' · settled ' + sum.settled
    + ' · unfilled ' + sum.unfilled
    + ' · open ' + sum.open
    + ' · hit ' + fmtPct(sum.hit)
    + ' · GROSS ' + fmtR(sum.expGross)
    + ' · NET ' + fmtR(sum.expNet)
    + ' · ' + fmtUsd(sum.usdNet) + ' at ' + (sum.lots || 0.01) + ' lots'
    + '</div>';
  if (sum.trades && sum.trades.length){
    h += '<table class="tbl" style="margin-top:8px"><thead><tr>'
      + '<th>kind</th><th>dir</th><th>type</th><th>result</th><th>GROSS</th><th>NET</th>'
      + '</tr></thead><tbody>';
    var i, t, n = Math.min(sum.trades.length, 24);
    for (i = 0; i < n; i++){
      t = sum.trades[i];
      if (!t || t.state === 'skip') continue;
      h += '<tr><td>' + esc(t.kind || '') + '</td><td>' + esc(t.dir || '')
        + '</td><td>' + esc(t.type || '') + '</td><td>' + esc(t.state)
        + '</td><td>' + fmtR(t.rGross) + '</td><td>' + fmtR(t.rNet) + '</td></tr>';
    }
    h += '</tbody></table>';
    if (sum.trades.length > n){
      h += '<div class="dim">showing ' + n + ' of ' + sum.trades.length + ' sends</div>';
    }
  }
  h += '</div>';
  return h;
}
