/* =========================================================================
   HARDGATE — setup-ui.js
   Unified CLEAN / NEAR / FORMING setup formation UI for every scanner tab.
   Loaded after plans.js; cryptowatch.js, index.html, pine.js, edge.js, etc.
   delegate here when helpers exist. Pure HTML + CSS inject; never throws.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var HG_SETUP_TIER = { CLEAN: 'clean', NEAR: 'near', FORMING: 'forming' };

var SU_CSS = ''
+ '.hg-setup-desk{margin:0 0 14px;padding:10px 12px;border:1px solid #E2E8F0;border-radius:10px;background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)}'
+ '.hg-setup-tier-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
+ '.hg-tier-chip{font-size:9px;letter-spacing:.12em;font-weight:800;padding:4px 8px;border-radius:6px;border:1px solid}'
+ '.hg-tier-chip.clean{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '.hg-tier-chip.near{color:#b45309;border-color:rgba(180,83,9,.45);background:rgba(251,191,36,.12)}'
+ '.hg-tier-chip.forming{color:#475569;border-color:#CBD5E1;background:#FFFFFF}'
+ '.hg-setup-desk-note{font-size:10px;color:#64748B;margin-top:8px;line-height:1.5;font-weight:500}'
+ '.card.tier-near{border-color:rgba(180,83,9,.55);box-shadow:inset 0 0 0 1px rgba(251,191,36,.15)}'
+ '.card.tier-near .dir{color:#b45309}'
+ '.card.tier-forming{border-color:#CBD5E1;opacity:.95}'
+ '.panel.tier-clean,.panel.tier-near,.panel.tier-forming{margin-bottom:12px}'
+ '.panel.tier-near{border-color:rgba(180,83,9,.45)}'
+ '.panel.tier-forming{border-style:dashed}'
+ '.hg-setup-watch,.hgwatch{margin:14px 0 18px;border:1px solid #E2E8F0;border-radius:10px;background:#F8FAFC;overflow:hidden}'
+ '.hg-setup-watch-h,.hgwatch-h{font-size:10px;letter-spacing:.18em;font-weight:800;color:#475569;padding:10px 12px;border-bottom:1px solid #E2E8F0;background:#FFFFFF}'
+ '.hg-setup-watch-h span,.hgwatch-h span{font-weight:500;letter-spacing:.04em;color:#64748B}'
+ '.hgw-row,.hg-setup-watch-row{font-size:11px;padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#334155;line-height:1.55;font-weight:500}'
+ '.hgw-row:last-child,.hg-setup-watch-row:last-child{border-bottom:0}'
+ '.hgw-row.armed,.hg-setup-watch-row.armed{background:rgba(5,150,105,.06);color:#020617;border-left:3px solid #059669}'
+ '.hgw-row.idle,.hg-setup-watch-row.idle{border-left:3px solid #E2E8F0}'
+ '.hgw-st,.hg-setup-st{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '.hgw-row.armed .hgw-st,.hg-setup-watch-row.armed .hg-setup-st{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '.hgw-row.idle .hgw-st,.hg-setup-watch-row.idle .hg-setup-st{color:#475569;border-color:#E2E8F0;background:#FFFFFF}'
+ '.hg-setup-near-h{font-size:10px;letter-spacing:.14em;font-weight:800;color:#b45309;margin:12px 0 8px;padding:8px 10px;border:1px solid rgba(180,83,9,.35);border-radius:8px;background:rgba(251,191,36,.08)}'
+ '.hg-setup-empty{padding:14px 12px;border:1px dashed #CBD5E1;border-radius:10px;color:#64748B;font-size:12px;line-height:1.55;background:#FAFAFA}';

function suEsc(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function suFmt(n, d){
  if (n === null || n === undefined || !isFinite(+n)) return '—';
  return Number(n).toFixed(d === undefined ? 2 : d);
}

function hgSetupInjectStyles(){
  try{
    if (typeof document === 'undefined') return;
    if (document.getElementById('hg-setup-ui-css')) return;
    var s = document.createElement('style');
    s.id = 'hg-setup-ui-css';
    s.textContent = SU_CSS;
    document.head.appendChild(s);
  }catch(e){}
}

function hgSetupTierLabel(tier){
  tier = String(tier || 'clean').toLowerCase();
  if (tier === 'near') return 'NEAR';
  if (tier === 'forming') return 'FORMING';
  return 'CLEAN';
}

function hgSetupTierBadge(tier, substate){
  tier = String(tier || 'clean').toLowerCase();
  var cls = tier === 'near' ? 'near' : (tier === 'forming' ? 'forming' : 'clean');
  var label = hgSetupTierLabel(tier);
  if (substate && tier === 'forming'){
    label += ' · ' + String(substate).toUpperCase();
  }
  return '<span class="hg-tier-chip ' + cls + '">' + suEsc(label) + '</span>';
}

function hgSetupDeskBannerHTML(opts){
  opts = opts || {};
  var tab = opts.tab ? String(opts.tab).toUpperCase() : 'SCANNER';
  var note = opts.note || 'CLEAN rows are tickets (7/7 + plan). NEAR and FORMING are watch-only — standing aside is a position.';
  return '<div class="hg-setup-desk" data-hg-desk="' + suEsc(opts.kind || tab) + '">'
    + '<div class="hg-setup-tier-row">'
    + hgSetupTierBadge('clean') + hgSetupTierBadge('near') + hgSetupTierBadge('forming')
    + '</div>'
    + '<div class="hg-setup-desk-note"><b>' + suEsc(tab) + '</b> · ' + suEsc(note) + '</div>'
    + '</div>';
}

function hgSetupNearHeaderHTML(count, kind){
  count = count || 0;
  kind = kind ? String(kind).toUpperCase() : '';
  return '<div class="hg-setup-near-h">NEAR CLEAN (6/7) — ' + count + ' watch-only'
    + (kind ? ' · ' + suEsc(kind) : '') + '</div>';
}

function hgFormingWatchHTML(items, opts){
  opts = opts || {};
  items = items || [];
  var title = opts.title || 'FORMING NOW';
  var sub = opts.subtitle || '≥5/7 gates, not CLEAN — watch only';
  if (!items.length){
    return '<div class="hg-setup-watch hgwatch"><div class="hg-setup-watch-h hgwatch-h">'
      + suEsc(title) + ' <span>' + suEsc(sub) + '</span></div>'
      + '<div class="hgw-row idle hg-setup-watch-row idle"><span class="hgw-st hg-setup-st">IDLE</span>'
      + suEsc(opts.idleText || 'Run SCAN — armed rows appear when ≥5/7 gates pass but the setup is not CLEAN yet.')
      + '</div></div>';
  }
  var armedN = items.filter(function(w){ return w && w.state === 'armed'; }).length;
  var rows = items.map(function(w){
    if (!w) return '';
    var st = w.state === 'armed';
    var passed = (w.gatesPassed != null && w.gatesTotal != null)
      ? ' · ' + w.gatesPassed + '/' + w.gatesTotal + ' gates' : '';
    return '<div class="hgw-row ' + (st ? 'armed' : 'idle') + ' hg-setup-watch-row ' + (st ? 'armed' : 'idle') + '">'
      + '<span class="hgw-st hg-setup-st">' + (st ? 'ARMED' : 'IDLE') + '</span>'
      + (w.unconfirmed ? '<span class="hgw-st hg-setup-st" style="color:#b45309;border-color:rgba(180,83,9,.45);background:rgba(251,191,36,.12)">UNCONFIRMED</span>' : '')
      + '<b>' + suEsc(w.sym || '?') + '</b> · ' + suEsc(w.strategy || w.scanner || '')
      + (w.condition ? ' — ' + suEsc(w.condition) : (w.reason ? ' — ' + suEsc(w.reason) : ''))
      + passed
      + (w.level !== null && w.level !== undefined ? ' · ref ' + suFmt(w.level) : '')
      + '</div>';
  }).join('');
  return '<div class="hg-setup-watch hgwatch"><div class="hg-setup-watch-h hgwatch-h">'
    + suEsc(title) + ' <span>' + armedN + ' armed · watch items, not entries</span></div>' + rows + '</div>';
}

function hgSetupEmptyHTML(opts){
  opts = opts || {};
  var title = opts.title || 'No CLEAN setups right now.';
  var body = opts.body || 'NEAR and FORMING rows below are watch-only. Expand the funnel for gate blocks.';
  return '<div class="hg-setup-empty"><b>' + suEsc(title) + '</b><br>' + suEsc(body) + '</div>';
}

function hgSetupCardHead(sym, dir, tier, extraBadges, venue){
  tier = String(tier || 'clean').toLowerCase();
  var symHtml = suEsc(sym);
  var venueHtml = venue ? '<span class="stamp na">' + suEsc(venue) + '</span> ' : '';
  var tierLabel = hgSetupTierLabel(tier);
  var badges = (extraBadges || []).join('');
  return venueHtml + '<span class="sym">' + symHtml + '</span>'
    + '<span class="dir">' + suEsc(String(dir || '').toUpperCase()) + ' · ' + tierLabel + '</span>' + badges;
}

/** Full setup card — wraps index cardHTML when present, else standalone markup. */
function hgSetupCardHTML(setup){
  setup = setup || {};
  var tier = String(setup.tier || 'clean').toLowerCase();
  var sym = setup.sym;
  var dir = setup.dir;
  var mini = setup.mini || [];
  var gates = setup.gates || [];
  var plan = setup.plan != null ? setup.plan : '';
  var entry = setup.entry;
  var stop = setup.stop;
  var t1 = setup.t1;
  var chartId = setup.chartId || '';
  var bookMeta = setup.bookMeta || {};
  bookMeta.tier = tier;

  if (typeof W.cardHTML === 'function' && tier === 'clean'){
    return W.cardHTML(sym, dir, mini, gates, plan, entry, stop, t1, chartId, bookMeta);
  }

  var tierCls = tier === 'near' ? ' tier-near' : (tier === 'forming' ? ' tier-forming' : '');
  var symHtml = suEsc(sym);
  var onclickJs = '';
  var onclickAttr = '';
  var bookBtn = '';
  if (tier === 'clean' && isFinite(entry) && isFinite(stop) && isFinite(t1)){
    onclickJs = "toTrade(" + JSON.stringify(sym) + "," + JSON.stringify(dir) + "," + entry + "," + stop + "," + t1 + ")";
    onclickAttr = onclickJs.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (typeof W.hgBookBtn === 'function'){
      bookBtn = W.hgBookBtn(sym, dir, entry, stop, t1, bookMeta);
    }
  }
  var tripleChip = (tier === 'clean' && typeof W.hgTripleStackChipHtml === 'function')
    ? W.hgTripleStackChipHtml(sym, dir) : '';
  var gateHtml = gates.map(function(g){
    var ok = (Array.isArray(g) && g.length > 1) ? !!g[1] : true;
    var lbl = Array.isArray(g) ? g[0] : g;
    return '<span class="gpip ' + (ok ? 'ok' : 'bad') + '">' + suEsc(lbl) + '</span>';
  }).join('');
  var miniHtml = mini.map(function(pair){
    return '<span class="k">' + suEsc(pair[0]) + '</span><span>' + pair[1] + '</span>';
  }).join('');
  var cid = chartId ? String(chartId).replace(/[^A-Za-z0-9_-]/g,'') : '';
  var note = setup.note ? '<div class="note warn" style="margin-top:6px">' + setup.note + '</div>' : '';
  var tradeBtn = (tier === 'clean' && onclickAttr)
    ? '<button class="toTrade" onclick="' + onclickAttr + '">SEND TO TRADE PLAN →</button>' : '';

  return '<div class="card ' + suEsc(dir) + tierCls + '">'
    + '<div class="chead">' + hgSetupCardHead(sym, dir, tier, [tripleChip], bookMeta.venue) + '</div>'
    + (miniHtml ? '<div class="mini">' + miniHtml + '</div>' : '')
    + (gateHtml ? '<div class="gates">' + gateHtml + '</div>' : '')
    + (plan ? '<div class="plan">' + plan + '</div>' : '')
    + note
    + (cid ? '<div class="hgchart" id="' + cid + '"></div>' : '')
    + tradeBtn + bookBtn
    + '</div>';
}

/** Pine / Gold Pine / strategy panel card with unified tiers. */
function hgSetupPanelHTML(sig, opts){
  opts = opts || {};
  sig = sig || {};
  var tier = 'clean';
  if (sig.isRecent || sig.tier === 'forming' || sig.edgeForming) tier = 'forming';
  else if (sig.isContext && !sig.isNew) tier = 'near';
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var tierCls = ' tier-' + tier;
  var badge = '';
  if (sig.isNew) badge = '<span class="stamp pass" style="margin-left:6px">NEW</span>';
  else if (sig.isRecent) badge = '<span class="stamp" style="margin-left:6px">RECENT −' + suEsc(sig.barsAgo) + 'b</span>';
  else if (sig.isContext) badge = '<span class="stamp" style="margin-left:6px">ALIGNED</span>';
  else if (sig.tier === 'forming') badge = '<span class="stamp" style="margin-left:6px">FORMING</span>';
  var label = opts.label || sig.scriptLabel || sig.planSrc || 'SETUP';
  var noteLine = typeof opts.noteFn === 'function' ? opts.noteFn(sig) : (opts.note || '');
  var hits = sig.edgeTicket ? ' · EDGE ticket'
    : (sig.edgeForming ? ' · EDGE forming' : (sig.gates && sig.gates.swing ? ' · SWING' : ''));
  var gateNote = sig.gates && sig.gates.regime ? suEsc(sig.gates.regime) : '';
  var pxF = typeof W.px === 'function' ? W.px : suFmt;
  var planHtml = typeof W.planBlock === 'function'
    ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
    : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1));
  var bookBtn = (tier === 'clean' && typeof W.hgBookBtn === 'function')
    ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, {
      scanner: opts.scanner || 'pine', strategy: sig.scriptId || opts.scanner || 'pine', t2: sig.t2
    }) : '';
  var tradeBtn = (tier === 'clean')
    ? '<button class="toTrade" onclick="toTrade(\'' + suEsc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    : '<div class="note warn" style="margin-top:8px">' + (tier === 'forming' ? 'FORMING — wait for NEW bar or full confluence before sizing.' : 'WATCH tier — not a ticket yet.') + '</div>';

  return '<div class="panel ' + cls + tierCls + '" style="margin-bottom:12px">'
    + '<h2>' + suEsc(sig.sym) + ' <span>' + suEsc(String(sig.dir || '').toUpperCase()) + ' · ' + suEsc(label)
    + badge + ' ' + hgSetupTierBadge(tier) + '</span></h2>'
    + '<div class="note">' + suEsc(noteLine)
    + ' · mark ' + pxF(sig.price || sig.entry) + hits
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + planHtml + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

function hgSetupPaintTabDesks(){
  try{
    if (typeof document === 'undefined') return;
    hgSetupInjectStyles();
    var desks = [
      { id: 'swingDesk', kind: 'swing', tab: 'SWING', note: '4H gates G1–G7 + EMA21 anchor. Cards = CLEAN only.' },
      { id: 'scalpDesk', kind: 'scalp', tab: 'SCALP', note: '15m trigger in 1H context. NEAR = 6/7 watch rows.' },
      { id: 'coilDesk', kind: 'coil', tab: 'COIL', note: 'Compression watchlist — expansion is manual confirm.' }
    ];
    for (var i = 0; i < desks.length; i++){
      var d = desks[i];
      var el = document.getElementById(d.id);
      if (el && !el.dataset.hgPainted){
        el.innerHTML = hgSetupDeskBannerHTML(d);
        el.dataset.hgPainted = '1';
      }
    }
  }catch(e){}
}

W.HG_SETUP_TIER = HG_SETUP_TIER;
W.hgSetupInjectStyles = hgSetupInjectStyles;
W.hgSetupTierLabel = hgSetupTierLabel;
W.hgSetupTierBadge = hgSetupTierBadge;
W.hgSetupDeskBannerHTML = hgSetupDeskBannerHTML;
W.hgSetupNearHeaderHTML = hgSetupNearHeaderHTML;
W.hgFormingWatchHTML = hgFormingWatchHTML;
W.hgSetupEmptyHTML = hgSetupEmptyHTML;
W.hgSetupCardHead = hgSetupCardHead;
W.hgSetupCardHTML = hgSetupCardHTML;
W.hgSetupPanelHTML = hgSetupPanelHTML;
W.hgSetupPaintTabDesks = hgSetupPaintTabDesks;

try{ hgSetupInjectStyles(); }catch(e){}

})();
