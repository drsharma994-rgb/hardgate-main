/* HARDGATE — desk-agree.js (hg-v1001): INDEPENDENT CONFIRMATION, MEASURED.

   The owner's ask, restated honestly: the setups most worth taking are the
   ones MORE THAN ONE INDEPENDENT way of reading the market is currently
   backing. Two detectors that share no logic being long the same coin at the
   same time is structurally stronger than either alone — independent errors
   multiply (two 60% desks are both wrong ~16% of the time), correlated ones
   do not, which is why a BEST card and a SWING card for the same coin count
   as ONE: BEST is the swing cascade's own top pick, not a second opinion.

   WHAT THIS MODULE IS. A per-session board of what every desk is CURRENTLY
   printing, written at the one choke point every card renderer passes
   through (cardHTML, plus smartCardHTML and the BEST card). A desk enters
   the board only with a TRADEABLE print — a near-miss or a forming row is
   not a directional claim and confirms nothing. Entries key on the BASE
   ASSET, so '[Delta India] BTCUSD', 'BTCUSDT' and 'B-BTC_USDT' are one coin;
   directions never cross.

   WHAT IT IS NOT. Not evidence, not a record, not persisted — it is the
   answer to "who else says this RIGHT NOW", so it lives in memory and every
   entry carries a 45-minute TTL: an opinion older than that is not a
   current confirmation, and a reload rebuilds the board on the next scan
   cycle. It never touches the forward ledger.

   HOW IT GATES. STACKED ONLY is an OPT-IN (hg_desk_agree_only_v1, header
   drawer, default OFF) — the inverse of the proven-edge default, and the
   reason is the anti-deadlock rule: agreement coverage depends on which
   desks have scanned lately, so defaulting it ON could mute desks the user
   never runs. When ON, a tradeable card's buttons additionally require at
   least one OTHER mechanic family currently printing the same base asset
   and direction; when OFF the chip still prints, because the agreement is
   still true. The chip appears whenever a second desk agrees, whether the
   mode is on or not.

   Classic script, IIFE, feature-checked by every caller, never throws. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

var LS_MODE = 'hg_desk_agree_only_v1';
var TTL_MS = 45 * 60 * 1000;          /* one missed auto-refresh cycle must not drop a desk; an hour-old print is not "now" */
var CAP = 400;                         /* bounded: the board is a question, not a store */

/* The board: fam|BASE|dir -> last-print time (ms). In-memory by design. */
var board = {};

/* Mechanic families — the desks whose agreement is INDEPENDENT. best merges
   into swing (same cascade, same evidence); the aliases follow the desks'
   own convention (proven-edge.js reads the same rows the same way). */
var FAMILY = { 'best': 'swing', 'divergence': 'div', 'liq-trap': 'trap', 'coil-expansion': 'coil' };
function familyOf(scanId){
  var s = String(scanId || '').toLowerCase();
  return FAMILY[s] || s;
}

/* Base-asset key: '[Delta India] BTCUSD', 'BTCUSDT', 'B-BTC_USDT' and
   'BTCUSD-PERP' must all land on one coin, or cross-venue agreement could
   never fire. CoinDCX's B- prefix keeps its boundary BEFORE the alnum strip
   ('B-BTC_USDT' -> 'BTC', not 'BBTC'). */
function baseSym(sym){
  try{
    var s = String(sym || '').toUpperCase().replace(/^\[[^\]]*\]\s*/, '').trim();
    var m = s.match(/^B-([A-Z0-9]+)_USDT$/);
    if (m && m[1]) return m[1];
    s = s.replace(/[^A-Z0-9]/g, '');
    s = s.replace(/PERP$/, '');
    s = s.replace(/(USDT|USDC|USD|INR)$/, '');
    return s;
  }catch(e){ return String(sym || ''); }
}

function now(){ return Date.now(); }

function prune(){
  try{
    var keys = Object.keys(board);
    if (keys.length <= CAP) return;
    keys.sort(function(a, b){ return (board[a] || 0) - (board[b] || 0); });
    for (var i = 0; i < keys.length - CAP; i++) delete board[keys[i]];
  }catch(e){}
}

/* A desk prints a tradeable card -> the desk backs this direction RIGHT NOW.
   Called from cardHTML / smartCardHTML / the BEST card with the RAW sym
   (venue tag stripped here again, belt-and-braces). Never throws. */
function hgDeskAgreeNote(scanId, sym, dir){
  try{
    var fam = familyOf(scanId), base = baseSym(sym);
    dir = String(dir || '').toLowerCase();
    if (!fam || !base || (dir !== 'long' && dir !== 'short')) return false;
    board[fam + '|' + base + '|' + dir] = now();
    prune();
    return true;
  }catch(e){ return false; }
}

/* Who currently agrees. Returns { total, others, desks } — total distinct
   FAMILIES with a fresh print for this base+direction, others excluding the
   asking family (a desk never confirms itself), desks the family list for
   the chip's title. Stale entries are ignored AND dropped, so the board
   cannot quietly fill with last week's opinions. */
function hgDeskAgree(sym, dir, selfScanId){
  var out = { total: 0, others: 0, desks: [] };
  try{
    var base = baseSym(sym);
    dir = String(dir || '').toLowerCase();
    if (!base || (dir !== 'long' && dir !== 'short')) return out;
    var self = familyOf(selfScanId);
    var t = now(), cutoff = t - TTL_MS;
    var seen = {}, keys = Object.keys(board), i, parts;
    for (i = 0; i < keys.length; i++){
      parts = keys[i].split('|');
      if (parts[1] !== base || parts[2] !== dir) continue;
      if ((board[keys[i]] || 0) < cutoff){ delete board[keys[i]]; continue; }
      if (seen[parts[0]]) continue;
      seen[parts[0]] = true;
      out.desks.push(parts[0]);
    }
    out.total = out.desks.length;
    out.others = (self && seen[self]) ? out.total - 1 : out.total;
    return out;
  }catch(e){ return out; }
}

/* ==================== the mode (STACKED ONLY) ==================== */
/* OPT-IN — default OFF. The agreement chip prints either way; the mode only
   decides whether the buttons answer to it. */
function hgDeskAgreeMode(){
  try{
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LS_MODE) === '1';
  }catch(e){ return false; }
}

/* Does agreement block the buttons? Only when STACKED ONLY is ON and no
   OTHER family currently confirms. A null agreement read blocks nothing —
   the same safe shape as the proven-edge gate's OFF. */
function hgDeskAgreeBlocks(ag){
  try{
    if (!hgDeskAgreeMode()) return false;
    if (!ag || typeof ag.others !== 'number') return false;
    return ag.others < 1;
  }catch(e){ return false; }
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* The chip prints whenever a second desk agrees — mode on or off, blocked or
   not, because the agreement is still true. */
function hgDeskAgreeChipHtml(ag){
  try{
    if (!ag || !(ag.others >= 1)) return '';
    var fams = ag.desks.map(function(f){ return String(f).toUpperCase(); }).join(' + ');
    return '<span class="gpip ok" title="'
      + esc('independent confirmation: ' + fams + ' currently print the same direction on this coin (last 45 min). '
          + 'Independent errors multiply; correlated ones do not — BEST and SWING count once, they are the same cascade.')
      + '">' + esc('STACK ×' + ag.total + ' DESKS') + '</span>';
  }catch(e){ return ''; }
}

/* What prints where the buttons would have been when STACKED ONLY blocks. */
function hgDeskAgreeBlockedNoteHtml(ag){
  try{
    return '<div class="note warn" style="margin-top:6px;font-size:11px"><b>STACKED ONLY</b> · '
      + 'no second desk currently confirms this direction (the board covers the last 45 min of tradeable prints). '
      + 'The card still prints and is still recorded; the buttons return when an independent desk agrees, '
      + 'or when STACKED ONLY is turned off in the header drawer.</div>';
  }catch(e){ return ''; }
}

function hgDeskAgreePaint(){
  try{
    var el = (typeof document !== 'undefined') && document.getElementById
      ? document.getElementById('deskAgreeState') : null;
    if (el) el.textContent = hgDeskAgreeMode() ? 'ON' : 'OFF';
    var chip = (typeof document !== 'undefined') && document.getElementById
      ? document.getElementById('chipDeskAgree') : null;
    if (chip) chip.title = hgDeskAgreeMode()
      ? 'STACKED ONLY is ON — a card\'s buttons also require a second, independent desk currently printing the same direction (last 45 min). Click to return to evidence-only gating.'
      : 'STACKED ONLY is OFF — cards show a STACK chip when independent desks agree, but buttons follow the proven-edge record alone. Click to require a second desk\'s confirmation.';
  }catch(e){}
}

function hgDeskAgreeToggle(){
  var on = !hgDeskAgreeMode();
  try{ if (typeof localStorage !== 'undefined') localStorage.setItem(LS_MODE, on ? '1' : '0'); }catch(e){}
  hgDeskAgreePaint();
  return on;
}

/* ==================== exports ==================== */
W.hgDeskAgreeNote = hgDeskAgreeNote;
W.hgDeskAgree = hgDeskAgree;
W.hgDeskAgreeMode = hgDeskAgreeMode;
W.hgDeskAgreeBlocks = hgDeskAgreeBlocks;
W.hgDeskAgreeChipHtml = hgDeskAgreeChipHtml;
W.hgDeskAgreeBlockedNoteHtml = hgDeskAgreeBlockedNoteHtml;
W.hgDeskAgreePaint = hgDeskAgreePaint;
W.hgDeskAgreeToggle = hgDeskAgreeToggle;
/* exported for the tests and for any desk that wants the same key */
W.hgDeskAgreeBaseSym = baseSym;
W.hgDeskAgreeFamily = familyOf;

try{
  if (typeof document !== 'undefined' && document.addEventListener){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', hgDeskAgreePaint);
    } else {
      hgDeskAgreePaint();
    }
  }
}catch(e){}

})();
