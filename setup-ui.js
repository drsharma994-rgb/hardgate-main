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
+ '.hg-setup-empty{padding:14px 12px;border:1px dashed #CBD5E1;border-radius:10px;color:#64748B;font-size:12px;line-height:1.55;background:#FAFAFA}'
+ '.hg-mp{margin:0 0 12px;padding:12px 14px;border:1px solid #CBD5E1;border-radius:10px;background:#FFFFFF}'
+ '.hg-mp[data-tier="clean"]{border-color:rgba(5,150,105,.45);box-shadow:inset 0 0 0 1px rgba(5,150,105,.10)}'
+ '.hg-mp[data-tier="near"]{border-color:rgba(180,83,9,.45);background:rgba(251,191,36,.06)}'
+ '.hg-mp[data-tier="forming"]{border-style:dashed;border-color:#94A3B8}'
+ '.hg-mp-eye{font-size:10px;letter-spacing:.16em;font-weight:800;color:#475569;margin:0 0 6px}'
+ '.hg-mp-head{font-size:16px;font-weight:800;color:#020617;letter-spacing:.02em}'
+ '.hg-mp-head span{font-size:11px;font-weight:600;color:#64748B;margin-left:8px;letter-spacing:0}'
+ '.hg-mp-note{font-size:11px;color:#64748B;margin:6px 0 10px;line-height:1.5}'
+ '.hg-mp-chips{font-size:10px;letter-spacing:.04em;font-weight:700;color:#0F766E;margin:-4px 0 10px;line-height:1.45}'
+ '.hg-mp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}'
+ '.hg-mp-grid div{border:1px solid #E2E8F0;border-radius:8px;padding:8px 10px;background:#F8FAFC}'
+ '.hg-mp-grid i{display:block;font-style:normal;font-size:9px;letter-spacing:.12em;font-weight:800;color:#64748B;margin-bottom:4px}'
+ '.hg-mp-grid b{display:block;font-size:14px;font-weight:800;color:#020617}'
+ '.hg-mp-grid u{display:block;margin-top:2px;font-size:10px;color:#64748B;text-decoration:none}'
+ '@media (max-width:720px){.hg-mp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';

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

function hgMpPx(n){
  if (typeof W.px === 'function'){
    try{ return W.px(n); }catch(e){}
  }
  n = +n;
  if (!isFinite(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1000) return n.toFixed(2);
  if (a >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function hgMostProbablePanelHTML(kind, pick){
  try{
    if (!pick || !pick.row) return '';
    var row = pick.row;
    if (typeof W.hgSetupHasLevels === 'function' && !W.hgSetupHasLevels(row)) return '';
    var e = +row.entry, s = +row.stop, t1 = +row.t1, t2 = +row.t2;
    if (!(isFinite(e) && isFinite(s) && e !== s && isFinite(t1))) return '';
    var tier = String(pick.tier || 'clean').toLowerCase();
    if (tier !== 'near' && tier !== 'forming') tier = 'clean';
    var tab = kind ? String(kind).toUpperCase() : 'SCAN';
    var dir = String(row.dir || '').toLowerCase();
    var dirLbl = dir ? dir.toUpperCase() : '—';
    var risk = Math.abs(e - s);
    var rr = isFinite(+row.rr) ? +row.rr : (risk > 0 ? Math.abs(t1 - e) / risk : NaN);
    var rr2 = isFinite(t2) && risk > 0 ? Math.abs(t2 - e) / risk : NaN;
    var venue = row.venue || row.venueTag || '';
    var passed = row.gatesPassed != null ? row.gatesPassed : row.passed;
    var total = row.gatesTotal || 7;
    var missing = Array.isArray(row.missing) ? row.missing.join(', ') : '';
    var grade, note;
    var cryptoDesk = kind === 'swing' || kind === 'scalp' || kind === 'edge' || kind === 'best';
    if (tier === 'clean'){
      if (isFinite(passed))
        grade = passed + '/' + total + ' CLEAN';
      else
        grade = cryptoDesk ? '7/7 CLEAN' : 'LEADER';
      note = 'This is the ranked leader on ' + tab + '. Levels are the live ticket.';
    } else if (tier === 'near'){
      grade = (isFinite(passed) ? (passed + '/' + total + ' NEAR') : '6/7 NEAR') + ' — watch only · not a ticket';
      note = 'No 7/7 CLEAN on this scan. Closest gated row still prints ENTRY / STOP / T1 / T2 so you can see the plan. Do not trade it until all seven hard gates pass.';
    } else {
      grade = (isFinite(passed) ? (passed + '/' + total + ' CLOSEST') : 'CLOSEST') + ' — not a ticket';
      note = 'No CLEAN or 6/7 NEAR. This is the nearest cascade with draft levels. Standing aside is the position.';
    }
    if (missing) note += ' Waiting: ' + missing + '.';
    var chipLine = '';
    if (Array.isArray(row.evidenceChips) && row.evidenceChips.length)
      chipLine = '<div class="hg-mp-chips">' + suEsc(row.evidenceChips.join(' · ')) + '</div>';
    var t2Cell = isFinite(t2)
      ? ('<div><i>T2</i><b>' + suEsc(hgMpPx(t2)) + '</b><u>' + (isFinite(rr2) ? suFmt(rr2, 1) + 'R runner' : 'runner') + '</u></div>')
      : '<div><i>T2</i><b>—</b><u>not set</u></div>';
    return '<section class="hg-mp" data-hg-mp="' + suEsc(kind || tab) + '" data-tier="' + tier + '" aria-label="Most probable setup">'
      + '<div class="hg-mp-eye">MOST PROBABLE' + (tier === 'clean' ? ' SETUP' : (tier === 'near' ? ' WATCH' : ' DRAFT')) + '</div>'
      + '<div class="hg-mp-head">' + suEsc(row.sym || '?') + ' ' + suEsc(dirLbl)
      + '<span>' + suEsc(tab) + (venue ? ' · ' + suEsc(venue) : '') + ' · ' + suEsc(grade) + '</span></div>'
      + '<div class="hg-mp-note">' + suEsc(note) + '</div>'
      + chipLine
      + '<div class="hg-mp-grid">'
      + '<div><i>ENTRY</i><b>' + suEsc(hgMpPx(e)) + '</b><u>' + suEsc(dir === 'short' ? 'SELL ZONE' : 'BUY ZONE') + '</u></div>'
      + '<div><i>STOP</i><b>' + suEsc(hgMpPx(s)) + '</b><u>invalidation</u></div>'
      + '<div><i>T1</i><b>' + suEsc(hgMpPx(t1)) + '</b><u>' + (isFinite(rr) ? suFmt(rr, 1) + 'R take profit' : 'take profit') + '</u></div>'
      + t2Cell
      + '</div></section>';
  }catch(e){ return ''; }
}

function hgPinMostProbablePanel(host, kind, pick){
  try{
    if (!host) return null;
    hgSetupInjectStyles();
    var old = host.querySelector ? host.querySelector('[data-hg-mp]') : null;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var html = hgMostProbablePanelHTML(kind, pick);
    if (!html) return null;
    if (host.insertAdjacentHTML) host.insertAdjacentHTML('afterbegin', html);
    else host.innerHTML = html + (host.innerHTML || '');
    return pick;
  }catch(e){ return null; }
}

var HG_MP_HOST = {
  swing: 'swingCards', scalp: 'scalpCards', edge: 'edgeCards', best: 'bestOut',
  coil: 'coilCards', apex: 'apexCards', trap: 'trapCards', 'liq-trap': 'trapCards',
  smc: 'smcCards', ob: 'obCards', div: 'divCards', divergence: 'divCards',
  smart: 'smartCards', basis: 'basisCards', search: 'searchOut', finder: 'finderOut',
  gold: 'goldSetupOut', 'gold-setup': 'goldSetupOut',
  squeeze: 'sqCards', reversalsniper: 'rsCards',
  omnipresent: 'opCards', omniroute: 'omniCards', omnigold: 'ogCards',
  omnibtc: 'obtcCards',
  oiflow: 'oiflowCards', carry: 'carryCards', termbasis: 'tbCards',
  venueprem: 'hgVenueCards', brain: 'brainCards', startrader: 'stCards',
  meanrev: 'mrCards', chartvision: 'cvCards', pine: 'pineOut',
  'pine-msb': 'pineMsbOut', 'pine-sqz': 'pineSqzOut', 'pine-smf': 'pineSmfOut',
  'pine-ht': 'pineHtOut', 'pine-smc': 'pineSmcOut', 'pine-cipher': 'pineCipherOut',
  'pine-rf': 'pineRfOut', 'pine-nw': 'pineNwOut', 'pine-avwap': 'pineAvwapOut',
  engine: 'engineCards', execute: 'engineCards',
  'super-best': 'sb-desk', 'super-sniper': 'sn-desk', 'super-gold': 'sg-desk',
  'super-setup': 'ss-desk', goldpine: 'goldPineOut', liqs: 'liqsSetups',
  aiagent: 'agentOut', strats: 'sgOut',
  trendmx: '#tab_trendmx [data-r="cards"]',
  goldpro: '#tab_goldpro [data-gp="out"]',
  goldspot: '#tab_goldspot [data-gs="out"]',
  rotation: '#tab_rotation [data-rot="out"]',
  goldcoint: 'gcointBody'
};

function hgMpHost(kind){
  try{
    if (typeof document === 'undefined') return null;
    var spec = HG_MP_HOST[kind];
    var el = null;
    if (typeof spec === 'function') el = spec();
    else if (typeof spec === 'string'){
      if (spec.indexOf(' ') >= 0 || spec.charAt(0) === '#' || spec.charAt(0) === '[')
        el = document.querySelector(spec);
      else el = document.getElementById(spec);
    }
    if (el) return el;
    el = document.getElementById(kind + 'Cards')
      || document.getElementById(kind + 'Out')
      || document.getElementById(kind + '-desk');
    if (el) return el;
    var pane = document.getElementById('tab_' + kind);
    if (pane){
      return pane.querySelector('.cards, .hg-desk, [id$="Cards"], [id$="Out"], [data-r="cards"], [data-gp="out"]');
    }
    return null;
  }catch(e){ return null; }
}

function hgMpPin(kind, payload, side, host){
  try{
    var pick = (typeof W.hgPickMostProbableAny === 'function')
      ? W.hgPickMostProbableAny(payload, side) : null;
    host = host || hgMpHost(kind);
    if (!host) return pick;
    if (!pick){
      var old = host.querySelector ? host.querySelector('[data-hg-mp]') : null;
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return null;
    }
    hgPinMostProbablePanel(host, kind, pick);
    return pick;
  }catch(e){ return null; }
}

var __hgMpNotes = {};
var __hgMpFlushT = {};
var HG_MP_SKIP_AUTO = {
  swing: 1, scalp: 1, edge: 1, best: 1,
  goldscalp: 1, goldswing: 1, 'gold-scalp': 1, 'gold-swing': 1
};

function hgMpCanonKind(scanner){
  var k = String(scanner || '').replace(/-near$/, '');
  if (k === 'liq-trap') return 'trap';
  if (k === 'divergence') return 'div';
  if (k === 'coil-expansion') return 'coil';
  if (k.indexOf('gold-') === 0) return 'gold';
  if (k.indexOf('finder') === 0) return 'finder';
  return k;
}

function hgMpNoteCard(sym, dir, entry, stop, t1, bookMeta){
  try{
    bookMeta = bookMeta || {};
    var raw = bookMeta.scanner;
    if (!raw) return;
    var kind = hgMpCanonKind(raw);
    if (HG_MP_SKIP_AUTO[kind] || HG_MP_SKIP_AUTO[raw]) return;
    var row = {
      sym: sym, dir: dir, entry: entry, stop: stop, t1: t1, t2: bookMeta.t2,
      venue: bookMeta.venue, tier: bookMeta.tier,
      passed: bookMeta.passed, gatesPassed: bookMeta.gatesPassed,
      confirmed: bookMeta.confirmed, clean: bookMeta.clean, near: bookMeta.near
    };
    if (typeof W.hgSetupHasLevels === 'function' && !W.hgSetupHasLevels(row)) return;
    if (!__hgMpNotes[kind]) __hgMpNotes[kind] = [];
    __hgMpNotes[kind].push(row);
    if (typeof setTimeout === 'function'){
      if (__hgMpFlushT[kind]) clearTimeout(__hgMpFlushT[kind]);
      __hgMpFlushT[kind] = setTimeout(function(){ hgMpFlush(kind); }, 0);
    }
  }catch(e){}
}

function hgMpFlush(kind){
  try{
    var rows = __hgMpNotes[kind] || [];
    __hgMpNotes[kind] = [];
    __hgMpFlushT[kind] = null;
    return hgMpPin(kind, rows);
  }catch(e){ return null; }
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

function hgSetupCardHead(sym, dir, tier, extraBadges, venue, bookMeta){
  tier = String(tier || 'clean').toLowerCase();
  var symHtml = suEsc(sym);
  var venueHtml = venue ? '<span class="stamp na">' + suEsc(venue) + '</span> ' : '';
  var tierLabel = hgSetupTierLabel(tier);
  var badges = (extraBadges || []).join('');
  var bookStamp = (bookMeta && typeof W.hgBookStampChip === 'function')
    ? W.hgBookStampChip(sym, dir, bookMeta) : '';
  var confirmChip = (typeof W.hgStrategyConfirmChipHtml === 'function')
    ? W.hgStrategyConfirmChipHtml(bookMeta && bookMeta.strategyConfirm, bookMeta && bookMeta.strategyWith,
        bookMeta && bookMeta.strategyAgainst)
    : '';
  return venueHtml + '<span class="sym">' + symHtml + '</span>'
    + '<span class="dir">' + suEsc(String(dir || '').toUpperCase()) + ' · ' + tierLabel + '</span>'
    + bookStamp + badges + confirmChip;
}

/** Conviction mesh chip — agree / oppose / dark / silent layer counts. */
function hgSetupConvictionMeshHtml(mesh){
  try{
    if (!mesh || typeof mesh !== 'object') return '';
    var a = +mesh.agree || 0, d = +mesh.disagree || 0, dk = +mesh.dark || 0, s = +mesh.silent || 0;
    if (!(a + d + dk + s)) return '';
    var esc = function(x){ return String(x == null ? '' : x); };
    return '<div class="mini hg-conviction-mesh" style="margin-top:4px">'
      + '<span class="k">conviction mesh</span><span>'
      + '<b class="pos">' + esc(a) + ' agree</b>'
      + (d ? ' · <b class="neg">' + esc(d) + ' oppose</b>' : '')
      + (dk ? ' · <span style="color:var(--dim)">' + esc(dk) + ' dark</span>' : '')
      + (s ? ' · <span style="color:var(--dim)">' + esc(s) + ' silent</span>' : '')
      + '</span></div>';
  }catch(e){ return ''; }
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
  if (!bookMeta.strategyConfirm && setup.strategyConfirm){
    bookMeta.strategyConfirm = setup.strategyConfirm;
    bookMeta.strategyWith = setup.strategyWith;
    bookMeta.strategyAgainst = setup.strategyAgainst;
  } else if (!bookMeta.strategyConfirm && setup.plan && setup.plan.strategyConfirm){
    bookMeta.strategyConfirm = setup.plan.strategyConfirm;
    bookMeta.strategyWith = setup.plan.strategyWith;
    bookMeta.strategyAgainst = setup.plan.strategyAgainst;
  }

  if (typeof W.cardHTML === 'function' && tier === 'clean'){
    return W.cardHTML(sym, dir, mini, gates, plan, entry, stop, t1, chartId, bookMeta);
  }

  var tierCls = tier === 'near' ? ' tier-near' : (tier === 'forming' ? ' tier-forming' : '');
  var symHtml = suEsc(sym);
  var onclickJs = '';
  var onclickAttr = '';
  var bookBtn = '';
  if (tier === 'clean' && isFinite(entry) && isFinite(stop) && isFinite(t1)){
    onclickJs = hgToTradePlanOnclickJs(sym, dir, entry, stop, t1, {
      t2: bookMeta.t2, stack: setup.stack, scanner: bookMeta.scanner, strategy: bookMeta.strategy,
      venue: bookMeta.venue
    });
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
  var stackHtml = (setup.stack && typeof W.hgSetupStackMiniHtml === 'function') ? W.hgSetupStackMiniHtml(setup.stack) : '';
  var visionHtml = (typeof W.hgChartVisionCardBlock === 'function') ? W.hgChartVisionCardBlock(setup) : '';
  var meshHtml = (setup.convictionMesh && typeof hgSetupConvictionMeshHtml === 'function')
    ? hgSetupConvictionMeshHtml(setup.convictionMesh) : '';
  var tradeBtn = (tier === 'clean' && onclickAttr)
    ? '<button class="toTrade" onclick="' + onclickAttr + '">SEND TO TRADE PLAN →</button>' : '';

  return '<div class="card ' + suEsc(dir) + tierCls + '">'
    + '<div class="chead">' + hgSetupCardHead(sym, dir, tier, [tripleChip], bookMeta.venue, bookMeta) + '</div>'
    + (miniHtml ? '<div class="mini">' + miniHtml + '</div>' : '')
    + (gateHtml ? '<div class="gates">' + gateHtml + '</div>' : '')
    + stackHtml
    + meshHtml
    + (plan ? '<div class="plan">' + plan + '</div>' : '')
    + ((typeof W.hgStrategyTradeDetailHtml === 'function') ? W.hgStrategyTradeDetailHtml(bookMeta, { skipChip: true }) : '')
    + visionHtml
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
  if (sig.isNew || sig.edgeTicket) tier = 'clean';
  else if (sig.isRecent || sig.tier === 'forming' || sig.edgeForming) tier = 'forming';
  else if (sig.isContext) tier = 'near';
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var tierCls = ' tier-' + tier;
  var badge = '';
  if (sig.isNew) badge = '<span class="stamp pass" style="margin-left:6px">NEW</span>';
  else if (sig.isRecent) badge = '<span class="stamp" style="margin-left:6px">RECENT −' + suEsc(sig.barsAgo) + 'b</span>';
  else if (sig.isContext) badge = '<span class="stamp" style="margin-left:6px">ALIGNED</span>';
  else if (sig.tier === 'forming') badge = '<span class="stamp" style="margin-left:6px">FORMING</span>';
  var label = opts.label || sig.scriptLabel || sig.planSrc || 'SETUP';
  var noteHtml = typeof opts.noteFn === 'function' ? opts.noteFn(sig) : suEsc(opts.note || '');
  var hits = sig.edgeTicket ? ' · EDGE ticket'
    : (sig.edgeForming ? ' · EDGE forming' : (sig.gates && sig.gates.swing ? ' · SWING' : ''));
  var gateNote = sig.gates && sig.gates.regime ? suEsc(sig.gates.regime) : '';
  var pxF = typeof W.px === 'function' ? W.px : suFmt;
  var planHtml = typeof W.planBlock === 'function'
    ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
    : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1));
  var stack = sig.stack;
  if (!stack && typeof W.hgSetupStackForPineSig === 'function'){
    try{ stack = W.hgSetupStackForPineSig(sig); }catch(eSt){}
  }
  var stackHtml = (stack && typeof W.hgSetupStackMiniHtml === 'function') ? W.hgSetupStackMiniHtml(stack) : '';
  var bookBtn = (tier === 'clean' && typeof W.hgBookBtn === 'function')
    ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, {
      scanner: opts.scanner || 'pine', strategy: sig.scriptId || opts.scanner || 'pine', t2: sig.t2,
      stack: stack
    }) : '';
  var tradeOnclick = hgToTradePlanOnclickJs(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, {
    t2: sig.t2, stack: stack, scanner: opts.scanner || 'pine', strategy: sig.scriptId || opts.scanner || 'pine'
  }).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var tradeBtn = (tier === 'clean')
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>'
    : '<div class="note warn" style="margin-top:8px">' + (tier === 'forming' ? 'FORMING — wait for NEW bar or full confluence before sizing.' : 'WATCH tier — not a ticket yet.') + '</div>';

  return '<div class="panel ' + cls + tierCls + '" style="margin-bottom:12px">'
    + '<h2>' + suEsc(sig.sym) + ' <span>' + suEsc(String(sig.dir || '').toUpperCase()) + ' · ' + suEsc(label)
    + badge + ' ' + hgSetupTierBadge(tier)
    + ((typeof W.hgBookStampChip === 'function')
      ? W.hgBookStampChip(sig.sym, sig.dir, { scanner: opts.scanner || 'pine', strategy: sig.scriptId || opts.scanner || 'pine' })
      : '')
    + '</span></h2>'
    + '<div class="note">' + noteHtml
    + ' · mark ' + pxF(sig.price || sig.entry) + hits
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + stackHtml
    + '<div class="plan">' + planHtml + '</div>'
    + ((typeof W.hgStrategyTradeDetailHtml === 'function') ? W.hgStrategyTradeDetailHtml(sig) : '')
    + tradeBtn + bookBtn
    + '</div>';
}

/** Build onclick JS for SEND TO TRADE PLAN — carries FTS stack when helper exists. */
function hgToTradePlanOnclickJs(sym, dir, entry, stop, t1, meta){
  meta = meta || {};
  if (typeof W.hgToTradePlan === 'function'){
    return 'hgToTradePlan(' + JSON.stringify(sym) + ',' + JSON.stringify(dir) + ','
      + entry + ',' + stop + ',' + t1 + ',' + JSON.stringify(meta) + ')';
  }
  return 'toTrade(' + JSON.stringify(sym) + ',' + JSON.stringify(dir) + ','
    + entry + ',' + stop + ',' + t1 + ')';
}

/** HTML-escaped onclick attr for SEND TO TRADE PLAN buttons. */
function hgToTradePlanOnclickAttr(sym, dir, entry, stop, t1, meta){
  return hgToTradePlanOnclickJs(sym, dir, entry, stop, t1, meta)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Cache FTS stack + scanner meta, then hand off to TRADE PLAN tab. */
function hgToTradePlan(sym, dir, entry, stop, t1, meta){
  meta = meta || {};
  try{
    W._hgTradeHandoff = {
      sym: sym, dir: dir, entry: +entry, stop: +stop, t1: +t1,
      t2: meta.t2, stack: meta.stack || null,
      scanner: meta.scanner || null, strategy: meta.strategy || null,
      venue: meta.venue || null, source: meta.source || null, at: Date.now()
    };
    W._hgTradeHandoffPending = true;
  }catch(e){
    W._hgTradeHandoff = null;
    W._hgTradeHandoffPending = false;
  }
  if (typeof W.toTrade === 'function'){
    W.toTrade(sym, dir, entry, stop, t1, meta.t2);
  }
}

/** Return active handoff when form fields match a recent card send. */
function hgTradeHandoffFor(sym, dir, entry, stop){
  var h = W._hgTradeHandoff;
  if (!h || !h.at) return null;
  if (Date.now() - h.at > 600000) return null;
  if (String(h.sym) !== String(sym || '')) return null;
  if (String(h.dir) !== String(dir || '')) return null;
  if (isFinite(h.entry) && isFinite(+entry) && Math.abs(h.entry - +entry) > 1e-6) return null;
  if (isFinite(h.stop) && isFinite(+stop) && Math.abs(h.stop - +stop) > 1e-6) return null;
  return h;
}

/** Minimal FTS row for open book positions (layers + strategy). */
function hgTradeStackFromBookPosition(p){
  p = p || {};
  var layers = Array.isArray(p.layers) ? p.layers.filter(Boolean) : [];
  var strat = p.strategy ? String(p.strategy) : '';
  if (!layers.length && !strat) return null;
  var label = layers.length ? layers.slice(0, 4).join(' · ') : strat;
  return { summary: 'BOOK · ' + label, tierHint: 'clean', vetoes: [] };
}

/** MANAGE button → TRADE PLAN with book position context. */
function hgToTradePlanFromBook(p){
  if (!p || !p.sym || !p.dir) return;
  var scanner = (p.layers && p.layers.length) ? p.layers[0] : (p.strategy || 'book');
  var meta = {
    t2: p.t2,
    stack: hgTradeStackFromBookPosition(p),
    scanner: scanner,
    strategy: p.strategy || 'book',
    venue: p.venue || null,
    source: 'book'
  };
  hgToTradePlan(p.sym, p.dir, p.entry, p.stop, p.t1, meta);
}

/** Map positioning-tab confirmed flag → CLEAN / NEAR tier. */
function hgSetupTierFromConfirmed(confirmed){
  return confirmed ? HG_SETUP_TIER.CLEAN : HG_SETUP_TIER.NEAR;
}

/** Map BRAIN verdict tier → unified setup tier (PRIME/HIGH = CLEAN, WATCH = FORMING). */
function hgBrainSetupTier(decTier){
  var t = String(decTier || '').toUpperCase();
  if (t === 'PRIME' || t === 'HIGH') return HG_SETUP_TIER.CLEAN;
  if (t === 'WATCH') return HG_SETUP_TIER.FORMING;
  return HG_SETUP_TIER.FORMING;
}

/** Paint one desk slot by element id or node — safe to call from tab mount(). */
function hgSetupPaintDesk(elOrId, opts){
  try{
    if (typeof document === 'undefined') return;
    hgSetupInjectStyles();
    var el = (typeof elOrId === 'string') ? document.getElementById(elOrId) : elOrId;
    if (!el || el.dataset.hgPainted) return;
    el.innerHTML = hgSetupDeskBannerHTML(opts || {});
    el.dataset.hgPainted = '1';
  }catch(e){}
}

/** Gold swing/scalp armed rows → shared FORMING watch panel. */
function hgGoldFormingWatchHTML(armed, opts){
  opts = opts || {};
  var items = (armed || []).map(function(w){
    if (!w) return null;
    return {
      state: w.state,
      sym: w.venue || 'GOLD',
      strategy: w.strategy || 'SETUP',
      condition: w.state === 'armed'
        ? (w.condition || 'watching')
        : (w.reason || w.condition || 'no trigger in range'),
      level: w.level
    };
  }).filter(Boolean);
  return hgFormingWatchHTML(items, {
    title: opts.title || 'FORMING NOW',
    subtitle: opts.subtitle || 'armed setups are watch items, not entries',
    idleText: opts.idleText || 'Run SCAN — armed rows appear when a strategy trigger is in range but has not yet qualified as a CLEAN ticket.'
  });
}

/** BRAIN WATCH-tier rows on the limit board → shared FORMING watch panel. */
function hgBrainWatchDeskHTML(rows, symFn){
  try{
    rows = Array.isArray(rows) ? rows : [];
    var items = [], i;
    for (i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || !r.dec || String(r.dec.tier || '').toUpperCase() !== 'WATCH' || !r.dec.dir) continue;
      var sym = (typeof symFn === 'function') ? symFn(r) : (r.sym || '?');
      items.push({
        state: 'armed',
        sym: sym,
        strategy: 'BRAIN · ' + String(r.dec.dir).toUpperCase(),
        condition: (r.dec.reasons && r.dec.reasons[0]) ? r.dec.reasons[0] : 'forming',
        reason: (isFinite(r.dec.agree) ? r.dec.agree : 0) + ' layers agree'
      });
    }
    if (!items.length) return '';
    items.sort(function(a, b){
      var ra = String(a.reason || ''), rb = String(b.reason || '');
      return rb.localeCompare(ra);
    });
    items = items.slice(0, 12);
    return hgFormingWatchHTML(items, {
      title: 'FORMING · WATCH DESK',
      subtitle: 'layers still missing — not executable; limit cards above qualify on their own'
    });
  }catch(e){ return ''; }
}

var HG_SETUP_DESKS = [
  { id: 'swingDesk', kind: 'swing', tab: 'SWING', note: '4H gates G1–G7 + EMA21 anchor. Cards = CLEAN only.' },
  { id: 'scalpDesk', kind: 'scalp', tab: 'SCALP', note: '15m trigger in 1H context. NEAR = 6/7 watch rows.' },
  { id: 'coilDesk', kind: 'coil', tab: 'COIL', note: 'Compression watchlist — expansion is manual confirm.' },
  { id: 'brainDesk', kind: 'brain', tab: 'BRAIN', note: 'PRIME/HIGH = CLEAN tickets with plans. WATCH = FORMING radar — standing aside is a position.' },
  { id: 'gwDesk', kind: 'goldswing', tab: 'GOLD SWING', note: 'Grade-A 4h/1d candidates = CLEAN. FORMING NOW = armed strategy watches, not entries.' },
  { id: 'gsDesk', kind: 'goldscalp', tab: 'GOLD SCALP', note: 'Grade-A 15m candidates = CLEAN. FORMING NOW = armed ICT watches, not entries.' },
  { id: 'sqDesk', kind: 'squeeze', tab: 'SQUEEZE', note: 'FIRED + Donchian break = CLEAN direction tickets. BUILDING = FORMING — no direction yet.' },
  { id: 'oiflowDesk', kind: 'oiflow', tab: 'OI FLOW', note: 'CONFIRMED cascade = CLEAN. UNCONFIRMED positioning edge = NEAR watch-only.' },
  { id: 'smartDesk', kind: 'smart', tab: 'SMART $', note: 'CONFIRMED 4H cascade = CLEAN. UNCONFIRMED evidence majority = NEAR watch-only.' },
  { id: 'divDesk', kind: 'div', tab: 'DIVERGENCE', note: 'Qualifying divergence + plan = CLEAN. Context-only reads = FORMING watch.' },
  { id: 'apexDesk', kind: 'apex', tab: 'APEX', note: 'Relative-strength leaders with manual macro confirm = CLEAN context cards.' },
  { id: 'trapDesk', kind: 'trap', tab: 'TRAP', note: 'Liquidation snapback with plan = CLEAN fade ticket.' },
  { id: 'smcDesk', kind: 'smc', tab: 'SMC', note: 'Unmitigated FVG tap aligned with HTF = CLEAN POI watch.' },
  { id: 'obDesk', kind: 'ob', tab: 'ORDER BLOCKS', note: 'OB retest at liquidity pool = CLEAN institutional POI.' },
  { id: 'trendmxDesk', kind: 'trendmx', tab: 'TREND MATRIX', note: 'CLEAN = 7/7 + plan. Golden cross desk + limit board promote the best rows. NEAR/FORMING are watch-only.' }
];

function hgSetupPaintTabDesks(){
  try{
    if (typeof document === 'undefined') return;
    hgSetupInjectStyles();
    for (var i = 0; i < HG_SETUP_DESKS.length; i++){
      hgSetupPaintDesk(HG_SETUP_DESKS[i].id, HG_SETUP_DESKS[i]);
    }
  }catch(e){}
}

W.HG_SETUP_TIER = HG_SETUP_TIER;
W.hgSetupInjectStyles = hgSetupInjectStyles;
W.hgSetupTierLabel = hgSetupTierLabel;
W.hgSetupTierBadge = hgSetupTierBadge;
W.hgSetupDeskBannerHTML = hgSetupDeskBannerHTML;
W.hgSetupNearHeaderHTML = hgSetupNearHeaderHTML;
W.hgMostProbablePanelHTML = hgMostProbablePanelHTML;
W.hgPinMostProbablePanel = hgPinMostProbablePanel;
W.HG_MP_HOST = HG_MP_HOST;
W.hgMpHost = hgMpHost;
W.hgMpPin = hgMpPin;
W.hgMpNoteCard = hgMpNoteCard;
W.hgMpFlush = hgMpFlush;
W.hgMpCanonKind = hgMpCanonKind;
W.hgMpPx = hgMpPx;
W.hgFormingWatchHTML = hgFormingWatchHTML;
W.hgSetupEmptyHTML = hgSetupEmptyHTML;
W.hgSetupCardHead = hgSetupCardHead;
W.hgSetupCardHTML = hgSetupCardHTML;
W.hgSetupConvictionMeshHtml = hgSetupConvictionMeshHtml;
W.hgSetupPanelHTML = hgSetupPanelHTML;
W.hgSetupTierFromConfirmed = hgSetupTierFromConfirmed;
W.hgBrainSetupTier = hgBrainSetupTier;
W.hgSetupPaintDesk = hgSetupPaintDesk;
W.hgGoldFormingWatchHTML = hgGoldFormingWatchHTML;
W.hgBrainWatchDeskHTML = hgBrainWatchDeskHTML;
W.hgSetupPaintTabDesks = hgSetupPaintTabDesks;
W.hgToTradePlanOnclickJs = hgToTradePlanOnclickJs;
W.hgToTradePlanOnclickAttr = hgToTradePlanOnclickAttr;
W.hgToTradePlan = hgToTradePlan;
W.hgTradeHandoffFor = hgTradeHandoffFor;
W.hgTradeStackFromBookPosition = hgTradeStackFromBookPosition;
W.hgToTradePlanFromBook = hgToTradePlanFromBook;

try{ hgSetupInjectStyles(); }catch(e){}

})();
