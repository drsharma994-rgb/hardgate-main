/* =========================================================================
HARDGATE — golddirection.js
GOLD DIRECTION tab: the USER picks a side — LONG or SHORT — presses RUN
SCAN, and this tab aggregates same-direction candidates from EVERY gold
engine in the app and composes the best SCALP setup and the best SWING
setup for that side. The side is the user's call, persisted in localStorage
'hg_golddir_side'; the tab NEVER silently flips it — when the desk tape
disagrees the pick is stamped 'AGAINST DESK TAPE — your call' prominently,
and the disagreement is never hidden.

ENGINES POLLED (each feature-checked with gfn(), each catch-isolated; an
absent engine renders a named 'engine dark' line, never a throw):
  GOLD SCALP  goldScalpSetups({rows15m,rows1h,rows4h,dailyCandles,now,
              news:null}) ranked by goldRankSetups(cands, ctx) with the ctx
              carrying now/season(goldSeason)/crossVenue(goldCrossVenueMap)/
              style AND rows15m/rows1h/rows4h — the hg-v700 contract: the
              confluence scorer must be FED; rows-free it stamps CONF
              UNCHECKED and cannot verdict. Uses the .ranked output.
  GOLD SWING  goldSwingSetups({rows4h,rows1d,now,news:null}) -> {ranked}.
  OMNIGOLD    hgOgDetect(rows1h,{nowSec}) -> hgOgEvaluate(rows1h,hits,extra,
              hgOgHorizonCfg('SCALP')) and the 4h series with
              hgOgHorizonCfg('SWING'). extra mirrors omnigold.js's own
              minimal runScan pack — htf (hgOmniDailyHtf), adr (hgOgAdr),
              livePx, nowSec; live-only feeds stay undefined so those gates
              read UNCHECKED, which is their design. Every pick runs through
              hgOgFormation and formed===false is DROPPED with its reasons
              surfaced as held-back lines. hgOgEvaluate keeps levels under
              .plan — normalized here to {entry,stop,t1,t2}.
  OMNIGOLD 1  hgOg1Engine invoked once per horizon exactly as omnigold1.js's
              own runScan does (Object.assign({}, inp, {horizon})). Its
              demoted SCALP-horizon cards are EXCLUDED from crowning — they
              carry c.demoted with the measured cohort line (hg-v700).
  NEW GOLD    ngAssess per its two horizons (HORIZONS: 1h -> '1H', 4h ->
              '4H'); only FORMED fires (shared hgGoldFormation verdict, same
              call shape newgold.js's own scan makes: ngConfirmations +
              requireClasses:['session-htf']) with a full plan participate.

FEEDS: gfn('getGoldCandles') for 15m/1h/4h/1d with binanceKlines('PAXGUSDT')
fallback — the gold desks' own chain — at the desks' own depths:
15m x240, 1h x400, 4h x220, 1d x260. Every leg catch-isolated.

SELECTION (per horizon, SCALP and SWING separately), fail closed:
  - keep only candidates matching the chosen dir with finite entry/stop/t1
    and hgGoldPlanSidesOk(...).ok — wrong-side geometry is COUNTED + LISTED
    on the rejected surface, never shown as tradable;
  - dropped / suppressed / vetoed candidates NEVER appear as picks; the top
    rejected reason lines (the desks' own reason strings) render in a
    compact HELD BACK list;
  - rank: lead-eligible (non-demoted) first; then data-backed confScore desc
    (missing = -1), then solidity score if present, then tally, then rr;
  - crowned pick = FIRST lead-eligible. NONE lead-eligible on that side ->
    NO execution banner: the top demoted candidates render under an honest
    header ('no lead-eligible SCALP setup on the LONG side — closest
    candidates are demoted:') with each card's demotion reasons. None at
    all -> honest whySilent empty state naming other-side counts and dark
    engines. (The v699/v700 lead invariant, held here too: a demoted or
    vetoed card can never be the crowned pick; an all-demoted side gets NO
    execution banner.)

CARDS (house style, self-contained CSS like goldscalp GS_CSS): entry zone /
entry / stop / TP1 / TP2 with rr; TRADE MANAGEMENT line (At TP1 close 50%,
stop to breakeven, runner TP2 — the card's real values); ENTRY GUIDANCE
(price in/out of zone) when a zone exists; source-desk chip (GOLD SCALP /
GOLD SWING / OMNIGOLD / OMNIGOLD 1 / NEW GOLD) + strategy name; ALL stamps
and gateNotes visible; venue cost line via hgOgVenueCost() when present;
DESK TAPE chip via hgGoldUniformTape(rows) or
hgOgDeskTape(hgOgTapeDir(1h), hgOgTapeDir(4h)) — feature-checked — with the
prominent 'AGAINST DESK TAPE — your call' stamp when the user's side
disagrees. Nothing fabricated: levels come from the engines or not at all.

FORWARD LEDGER: after a successful scan the CROWNED PICKS ONLY are recorded
via hgFwdRecordScan('GOLDDIRECTION','1h',[...sym XAUUSD, mechanic = source
desk + stratKey], {horizonBars:24}) — feature-checked — so this tab
accumulates its own paid evidence. hgFwdResolve runs first on the bars just
fetched so a setup can never be settled by the bar it was written on.

PROVEN-ONLY CROWNING (hg-v702): the crowned pick must be lead-eligible AND
measured-proven. The proven set is built AT RUNTIME from the live
single-source surfaces — NEVER a hardcoded copy that goes stale (the
fabricated-bos-row lesson):
  (a) W.HG_GOLD_SETUP_EDGE.scalp/.swing rows with action === 'prefer'
      (goldind.js) — their n/gross/net/why are the numbers printed;
  (b) OMNIGOLD kinds where hgOgSwingPrefer(kind, horizon) answers truthy
      (omnigold.js, feature-checked) — membership only; that desk exports
      no per-kind figures, so NONE are printed for these;
  (c) hgFwdPaidKinds (hg-forward.js, feature-checked) — mechanics whose
      LIVE forward ledger reads 'has paid' at the family-wise bar, read
      for GOLDDIRECTION + OMNIGOLD:SCALP + OMNIGOLD:SWING; these can
      un-gate kinds beyond (a)/(b) and are tagged 'live-paid', with the
      hgFwdPool stats printed when that surface answers.
Lead-eligible-but-UNPROVEN candidates are never crowned — they render in a
clearly-headed 'NOT MEASURED-PROVEN — paints, not crowned' list (full
cards, no execution banner), so the board stays populated and honest. The
crowned card carries a MEASURED RECORD line sourced from the SAME row that
proved it; no number is ever printed that was not read from its source.
No strategy measures 100% — the tab says so in a fixed header note and
never claims certainty (the v536 label rule).

DIRECTION CONFIRMATION (hg-v702): picking a side ARMS it ('Direction
armed: LONG — press CONFIRM & SCAN'); the scan button is CONFIRM & SCAN
and the user's click IS the confirmation — a side persisted from a
previous session still requires a fresh confirm click this session before
the first scan (warm-up refuses instead of confirming on the user's
behalf). SWITCHING sides clears the rendered results AND the published
snapshots — no stale other-side cards ever remain on screen — and
requires confirm again. After a scan the board header states 'Direction
confirmed: LONG — every setup below is LONG-only.' The side is still
never inferred or flipped by the tab. A side switch WHILE a scan is in
flight discards that scan whole (generation-guarded): its cards are never
painted, its snapshots never published, its picks never recorded — the
board a switch cleared can never be repainted by a stale async scan.

Classic script, no build step, loads AFTER the engines it polls (all
optional). Never throws at load, mount, scan or refresh: every external
global is feature-checked (gfn), every network leg is async with its own
try/catch, localStorage is probed softly, and every failure degrades to an
honest stat line / empty state.

Registers window.HG_tabs.push({id:'golddirection', label:'GOLD DIRECTION',
mount, refresh}) — refresh(): async, never throws, 'busy' | 'skipped: not
run yet' | 'skipped: direction not confirmed this session' | 'skipped:
side switched mid-scan' | 'refreshed' | 'error: …', busy-guarded, never
triggers a first-time scan on its own.
Warm-up: window.HG_warmups.push — 'fresh' when a snapshot exists,
'unavailable: no direction selected …' when the user has not picked a side
(the tab never picks one to warm itself), 'unavailable: direction not
confirmed this session …' when a persisted side lacks this session's
CONFIRM & SCAN click (hg-v702 — warm-up never confirms for the user), else
a headless scan against inert stub elements -> 'warmed' | 'busy' |
'unavailable: …'.

DIAGNOSTIC SURFACE — window.goldDirectionScan(): last successful scan,
deep-frozen, null before the first (and nulled on a side switch — no
stale other-side picks survive):
  { side, scalp: { pick, crownedProven,
                   held: [{source,horizon,strategy,dir,reason}],
                   rejected: [{source,horizon,strategy,dir,reason}],
                   unproven: [{source,horizon,strategy,stratKey,dir,reason}],
                   otherSide },
    swing: { … same shape … }, tape, enginesDark: [names…],
    provenSet: [{key,horizon,source,n?,gross?,net?,why?,tab?,stats?}], at }
BRAIN STATE — window.goldDirectionState():
  { results: [{ dir, horizon, grade, source }], at } | null — one row per
  crowned pick, deep-frozen, failed re-runs keep the previous good snapshot.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

/* the gold desks' own depths */
var KL_15M = 240, KL_1H = 400, KL_4H = 220, KL_1D = 260;

var SIDE_KEY = 'hg_golddir_side';
var TAB_ID = 'golddirection';

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pxF(n){
  if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function'){ try{ return fmt(n, d); }catch(e){} }
  return (n === null || n === undefined || !isFinite(n)) ? '—'
       : Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  return null;
}
function fin(n){ var v = +n; return isFinite(v) ? v : NaN; }

/* ---------------- side persistence (the USER'S call, never flipped) ---------------- */
function loadSide(){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    var v = localStorage.getItem(SIDE_KEY);
    return (v === 'long' || v === 'short') ? v : null;
  }catch(e){ return null; }
}
function saveSide(s){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    if (s === 'long' || s === 'short') localStorage.setItem(SIDE_KEY, s);
  }catch(e){}
}

/* ---------------- deep-frozen snapshot views ---------------- */
var __snap = null;       /* BRAIN state */
var __scanSnap = null;   /* full diagnostic surface */
function __stateView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = __stateView(v[k]);
  }
  Object.freeze(out);
  return out;
}

/* ---------------- pane-scoped styles (injected from here ONLY) ---------------- */
var GD_CSS = ''
+ '.gdx-dirrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 4px}'
+ '.gdx-dirbtn{font-size:12px;font-weight:800;letter-spacing:.12em;padding:9px 22px;border-radius:8px;'
+ 'border:2px solid #475569;background:#0F172A;color:#CBD5E1;cursor:pointer}'
+ '.gdx-dirbtn.long.active{border-color:#059669;background:rgba(5,150,105,.16);color:#6EE7B7}'
+ '.gdx-dirbtn.short.active{border-color:#DC2626;background:rgba(220,38,38,.14);color:#FCA5A5}'
+ '.gdx-hint{font-size:11px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:7px 10px;margin:8px 0;line-height:1.5;font-weight:500}'
+ '.gdx-hzhead{font-size:11px;letter-spacing:.24em;color:#A67C12;font-weight:800;margin:18px 0 6px;border-bottom:1px dashed #FDE68A;padding-bottom:4px}'
+ '.gdx-banner{position:relative;border-radius:12px;padding:3px;margin:10px 0 14px;'
+ 'background:linear-gradient(120deg,#A67C12,#F5D77A 25%,#EA580C 50%,#E8B42A 75%,#A67C12)}'
+ '.gdx-banner-in{background:linear-gradient(180deg,#FFFFFF,#FFFBEB);border-radius:10px;padding:14px 16px;color:#020617}'
+ '.gdx-eye{font-size:10px;letter-spacing:.3em;color:#A67C12;font-weight:800}'
+ '.gdx-dir{font-size:22px;font-weight:800;letter-spacing:.06em;margin-top:4px}'
+ '.gdx-dir.long{color:#047857}'
+ '.gdx-dir.short{color:#B91C1C}'
+ '.gdx-dir span{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;color:#0F172A;margin-top:4px}'
+ '.gdx-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:10px 0 4px}'
+ '.gdx-plan>div{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px 10px}'
+ '.gdx-plan i{display:block;font-style:normal;font-size:9px;letter-spacing:.16em;color:#1E293B;font-weight:700}'
+ '.gdx-plan b{display:block;font-size:15px;color:#A67C12;font-weight:800;margin:3px 0}'
+ '.gdx-plan u{text-decoration:none;font-size:10px;color:#0F172A;font-weight:500;line-height:1.45}'
+ '.gdx-card{border:1px solid #334155;border-radius:10px;padding:12px 14px;margin:8px 0;'
+ 'background:#0F172A;color:#F1F5F9}'
+ '.gdx-card.long{border-left:4px solid #059669}'
+ '.gdx-card.short{border-left:4px solid #DC2626}'
+ '.gdx-card.crowned{box-shadow:0 0 0 2px rgba(201,146,26,.40)}'
+ '.gdx-src{font-size:9px;letter-spacing:.14em;font-weight:800;padding:3px 8px;border-radius:4px;'
+ 'border:1px solid rgba(201,146,26,.5);background:rgba(201,146,26,.12);color:#FBBF24;margin-right:6px}'
+ '.gdx-strat{color:#FBBF24;font-size:10px;font-weight:800;letter-spacing:.1em}'
+ '.gdx-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
+ '.gdx-chip{font-size:9px;letter-spacing:.04em;padding:3px 8px;border-radius:4px;border:1px solid #475569;'
+ 'background:rgba(30,41,59,.8);color:#CBD5E1;font-weight:600}'
+ '.gdx-chip.ok{color:#6EE7B7;border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.14)}'
+ '.gdx-chip.warn{color:#FCA5A5;border-color:rgba(220,38,38,.5);background:rgba(220,38,38,.10)}'
+ '.gdx-tapewarn{font-size:10px;letter-spacing:.08em;font-weight:800;color:#B91C1C;background:#FEF2F2;'
+ 'border:1px solid rgba(220,38,38,.45);border-radius:6px;padding:6px 9px;margin-top:8px}'
+ '.gdx-planline{font-size:11px;margin-top:8px;padding:7px 10px;border-radius:6px;line-height:1.6;'
+ 'background:#1E293B;border:1px solid #475569;color:#E2E8F0}'
+ '.gdx-planline b{color:#67E8F9}'
+ '.gdx-mgmt{font-size:10px;margin-top:6px;padding:6px 9px;border-radius:6px;line-height:1.55;'
+ 'color:#FDE68A;border:1px dashed rgba(201,146,26,.45);background:rgba(201,146,26,.06);font-weight:500}'
+ '.gdx-mgmt b{color:#FBBF24;letter-spacing:.12em;font-size:9px;font-weight:800}'
+ '.gdx-guide{font-size:10px;margin-top:6px;letter-spacing:.03em;line-height:1.55;font-weight:600}'
+ '.gdx-guide.in{color:#6EE7B7}'
+ '.gdx-guide.out{color:#FDBA74}'
+ '.gdx-gate{font-size:10px;color:#FDBA74;letter-spacing:.03em;margin-top:7px;line-height:1.55;'
+ 'border:1px solid rgba(234,88,12,.35);border-radius:6px;padding:6px 9px;background:rgba(234,88,12,.06)}'
+ '.gdx-gate b{letter-spacing:.1em;font-weight:800}'
+ '.gdx-why{font-size:10px;color:#CBD5E1;margin-top:6px;line-height:1.55}'
+ '.gdx-venue{font-size:9px;color:#94A3B8;margin-top:6px;letter-spacing:.04em}'
+ '.gdx-demhead{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;'
+ 'padding:8px 11px;margin:8px 0;line-height:1.55;background:#FFF7ED;font-weight:600}'
+ '.gdx-held{margin-top:10px}'
+ '.gdx-heldhead{font-size:10px;letter-spacing:.18em;color:#1E293B;margin-bottom:5px;font-weight:700}'
+ '.gdx-heldrow{font-size:10px;padding:5px 9px;border-left:3px solid #EA580C;margin-bottom:3px;color:#0F172A;line-height:1.5;font-weight:500;background:#FFF7ED}'
+ '.gdx-heldrow b{letter-spacing:.06em;font-weight:700;color:#020617}'
+ '.gdx-silent{font-size:11px;color:#9A3412;border:1px solid rgba(234,88,12,.35);border-radius:6px;'
+ 'padding:9px 11px;margin:8px 0;line-height:1.55;background:#FFF7ED;font-weight:500}'
+ '.gdx-silent b{letter-spacing:.12em;font-weight:800}'
+ '.gdx-dark{font-size:10px;color:#64748B;margin:6px 0;line-height:1.55}'
+ '.gdx-tape{font-size:10px;color:#0F172A;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;'
+ 'padding:6px 10px;margin:8px 0;line-height:1.5;font-weight:500}'
+ '.gdx-confirm{font-size:11px;letter-spacing:.08em;font-weight:800;color:#065F46;background:#ECFDF5;'
+ 'border:1px solid rgba(5,150,105,.4);border-radius:6px;padding:7px 10px;margin:8px 0;line-height:1.5}'
+ '.gdx-confirm.short{color:#991B1B;background:#FEF2F2;border-color:rgba(220,38,38,.4)}'
+ '.gdx-measured{font-size:10px;margin-top:6px;padding:6px 9px;border-radius:6px;line-height:1.55;'
+ 'color:#065F46;border:1px solid rgba(5,150,105,.35);background:rgba(5,150,105,.06);font-weight:500}'
+ '.gdx-measured b{color:#047857;letter-spacing:.12em;font-size:9px;font-weight:800}';

(function hgInjectGdCss(){
  try{
    if (typeof document === 'undefined') return;
    var id = 'hg-gdx-styles';
    if (document.getElementById(id)) return;
    var el = document.createElement('style');
    el.id = id;
    el.textContent = GD_CSS;
    (document.head || document.documentElement).appendChild(el);
  }catch(e){}
})();

/* ---------------- feeds (the gold desks' own chain, catch-isolated) ---------------- */
async function fetchGoldKlines(){
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], src: {}, source: null };
  function srcSet(tf, source, key, rows){
    if (!rows || !rows.length) return;
    out[key] = rows;
    out.src[tf] = source || null;
  }
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{ var a = await ggc('15m', KL_15M); if (a && a.rows && a.rows.length) srcSet('15m', a.source, 'rows15m', a.rows); }catch(e1){}
    try{ var b = await ggc('1h', KL_1H);  if (b && b.rows && b.rows.length) srcSet('1h', b.source, 'rows1h', b.rows); }catch(e2){}
    try{ var c = await ggc('4h', KL_4H);  if (c && c.rows && c.rows.length) srcSet('4h', c.source, 'rows4h', c.rows); }catch(e3){}
    try{ var d = await ggc('1d', KL_1D);  if (d && d.rows && d.rows.length) srcSet('1d', d.source, 'rows1d', d.rows); }catch(e4){}
  }
  var bk = gfn('binanceKlines');
  if (bk){
    if (!out.rows15m.length){ try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length) srcSet('15m', 'binance-paxg', 'rows15m', p); }catch(e5){} }
    if (!out.rows1h.length){  try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length) srcSet('1h', 'binance-paxg', 'rows1h', q); }catch(e6){} }
    if (!out.rows4h.length){  try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length) srcSet('4h', 'binance-paxg', 'rows4h', z); }catch(e7){} }
    if (!out.rows1d.length){  try{ var y = await bk('PAXGUSDT', '1d', KL_1D); if (y && y.length) srcSet('1d', 'binance-paxg', 'rows1d', y); }catch(e8){} }
  }
  out.source = out.src['15m'] || out.src['1h'] || out.src['4h'] || null;
  return out;
}

function lastClose(rows){
  if (!rows || !rows.length) return NaN;
  var lc = rows[rows.length - 1];
  return (lc && isFinite(+lc.c)) ? +lc.c : NaN;
}
function lastT(rows){
  if (!rows || !rows.length) return NaN;
  var lc = rows[rows.length - 1];
  return (lc && isFinite(+lc.t)) ? +lc.t : NaN;
}

/* ---------------- desk tape (feature-checked; '' when unread) ---------------- */
function deskTapeOf(gold){
  try{
    var uni = gfn('hgGoldUniformTape');
    if (uni){
      var rows = (gold.rows1h && gold.rows1h.length) ? gold.rows1h
               : (gold.rows15m && gold.rows15m.length) ? gold.rows15m : gold.rows4h;
      /* gold-catalog.js's hgGoldUniformTape answers 'LONG'/'SHORT' UPPERCASE
         (goldind-era stubs answered lowercase). Compare case-insensitively —
         a casing mismatch here silently hid the AGAINST DESK TAPE stamp
         whenever the omnigold fallback tape was absent. */
      var t = uni(rows);
      var tl = String(t === null || t === undefined ? '' : t).toLowerCase();
      if (tl === 'long' || tl === 'short') return tl;
      if (tl === '') return '';
    }
  }catch(e){}
  try{
    var td = gfn('hgOgTapeDir'), dk = gfn('hgOgDeskTape');
    if (td && dk){
      var d = dk(td(gold.rows1h), td(gold.rows4h));
      if (d === 'long' || d === 'short') return d;
    }
  }catch(e2){}
  return '';
}

/* ---------------- plan-sides gate (fail closed, local fallback) ---------------- */
function planSidesOk(c){
  var fn = gfn('hgGoldPlanSidesOk');
  if (fn){
    try{
      var g = fn(c);
      if (g && typeof g.ok === 'boolean') return { ok: g.ok, why: g.why || '' };
    }catch(e){}
  }
  /* local fallback — the same geometry contract: stop on the risk side,
     T1 on the reward side. Reject, never rewrite (the v681/v698 lesson). */
  var e0 = fin(c.entry), s0 = fin(c.stop), t0 = fin(c.t1);
  if (!isFinite(e0) || !isFinite(s0) || !isFinite(t0)) return { ok: false, why: 'levels not finite' };
  if (c.dir === 'long'){
    return (s0 < e0 && t0 > e0) ? { ok: true, why: '' }
      : { ok: false, why: 'plan sides invalid for a long — stop must sit below entry, T1 above' };
  }
  if (c.dir === 'short'){
    return (s0 > e0 && t0 < e0) ? { ok: true, why: '' }
      : { ok: false, why: 'plan sides invalid for a short — stop must sit above entry, T1 below' };
  }
  return { ok: false, why: 'direction not long/short' };
}

/* ---------------- candidate normalization ---------------- */
function normCand(src, horizon, c, over){
  over = over || {};
  var out = {
    source: src, horizon: horizon,
    dir: c.dir,
    strategy: over.strategy !== undefined ? over.strategy : (c.strategy || c.kind || c.stratKey || 'SETUP'),
    stratKey: over.stratKey !== undefined ? over.stratKey : (c.stratKey || c.kind || c.sid || null),
    grade: over.grade !== undefined ? over.grade : (typeof c.grade === 'string' ? c.grade : null),
    entry: fin(over.entry !== undefined ? over.entry : c.entry),
    stop: fin(over.stop !== undefined ? over.stop : c.stop),
    t1: fin(over.t1 !== undefined ? over.t1 : c.t1),
    t2: fin(over.t2 !== undefined ? over.t2 : c.t2),
    rr: fin(over.rr !== undefined ? over.rr : (isFinite(fin(c.rr)) ? c.rr : c.rr1)),
    rr2: fin(over.rr2 !== undefined ? over.rr2 : c.rr2),
    zone: (over.zone !== undefined) ? over.zone
        : ((c.zone && isFinite(fin(c.zone.lo)) && isFinite(fin(c.zone.hi))) ? { lo: +c.zone.lo, hi: +c.zone.hi } : null),
    atr: fin(c.atr),
    tally: fin(c.tally),
    confScore: fin(c.confScore),
    solidity: (c.solidity && isFinite(fin(c.solidity.score))) ? fin(c.solidity.score) : NaN,
    demoted: !!(over.demoted !== undefined ? over.demoted : c.demoted),
    demoteReasons: over.demoteReasons || [],
    stamps: Array.isArray(c.stamps) ? c.stamps.slice() : [],
    gateNotes: Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [],
    vetoed: !!c.vetoed,
    dropped: !!c.dropped,
    why: c.why || over.why || null,
    invalidates: c.invalidates || null,
    /* hg-v702: the edge row the candidate's OWN desk stamped onto it
       (hgGoldSetupEdgeApply) rides through — a 'prefer' row here IS the
       measured proof, carried with its own n/gross/net/why. Copied, never
       invented: absent stays null. */
    edge: (c.edge && typeof c.edge === 'object') ? {
      action: c.edge.action || null, n: fin(c.edge.n), gross: fin(c.edge.gross),
      net: fin(c.edge.net), why: c.edge.why ? String(c.edge.why) : ''
    } : null
  };
  if (!out.demoteReasons.length){
    if (c.demoteWhy) out.demoteReasons.push(String(c.demoteWhy));
    if (c.demoteReason) out.demoteReasons.push(String(c.demoteReason));
    if (out.demoted && !out.demoteReasons.length && out.gateNotes.length) out.demoteReasons = out.gateNotes.slice();
    if (out.demoted && !out.demoteReasons.length && out.stamps.length) out.demoteReasons = out.stamps.slice();
    if (out.demoted && !out.demoteReasons.length) out.demoteReasons.push('demoted by its own desk (reason not recorded)');
  }
  return out;
}
function heldLine(src, horizon, strategy, dir, reason){
  return { source: src, horizon: horizon, strategy: strategy || null,
           dir: dir || null, reason: reason || 'held back by its own desk' };
}

/* ---------------- engine lanes (each feature-checked + catch-isolated) ---------------- */
async function laneGoldScalp(gold, now){
  var out = { cands: [], held: [], dark: null };
  var setupsFn = gfn('goldScalpSetups');
  if (!setupsFn){ out.dark = 'GOLD SCALP engine dark — goldScalpSetups (goldind.js) not loaded'; return out; }
  if (!gold.rows15m.length){ out.held.push(heldLine('GOLD SCALP', 'SCALP', null, null, 'no 15m bars from any feed — lane skipped')); return out; }
  var cands = null;
  try{
    cands = setupsFn({ rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h,
                       dailyCandles: (gold.rows1d && gold.rows1d.length) ? gold.rows1d : undefined,
                       now: now, news: null });
  }catch(e){ out.held.push(heldLine('GOLD SCALP', 'SCALP', null, null, 'detector threw: ' + ((e && e.message) || e))); return out; }
  if (!Array.isArray(cands)) return out;
  var i, rj = cands.rejected || [];
  for (i = 0; i < rj.length; i++){
    if (rj[i]) out.held.push(heldLine('GOLD SCALP', 'SCALP', rj[i].strategy, rj[i].dir, rj[i].reason || 'failed a quality gate'));
  }
  for (i = 0; i < cands.length; i++){
    if (cands[i]){ cands[i].venue = 'GOLD DIRECTION'; cands[i].sym = 'XAUUSD'; }
  }
  var ranked = cands, rankFn = gfn('goldRankSetups');
  if (rankFn){
    /* hg-v700: the confluence scorer must be FED — rows-free it stamps
       CONF UNCHECKED and cannot verdict. */
    var ctx = { now: now, news: null, style: 'goldscalp',
                rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h };
    try{
      var seasonFn = gfn('goldSeason');
      if (seasonFn) ctx.season = seasonFn(now);
    }catch(eS){}
    try{
      var cvFn = gfn('goldCrossVenueMap');
      if (cvFn) ctx.crossVenue = cvFn(cands);
    }catch(eC){}
    var rk = null;
    try{ rk = rankFn(cands, ctx); }catch(eR){ rk = null; }
    if (rk && Array.isArray(rk.ranked)){
      ranked = rk.ranked;
      var rr = rk.rejected || [];
      for (i = 0; i < rr.length; i++){
        if (rr[i]) out.held.push(heldLine('GOLD SCALP', 'SCALP', rr[i].strategy, rr[i].dir, rr[i].reason || 'failed a quality gate'));
      }
    }
  }
  /* hg-v701 (audit major closed): the GOLD SCALP tab applies
     hgFilterGoldPostGate right after ranking (goldscalp.js ~1574) — its
     stale-momentum leg works offline and DEMOTES, so without it this tab
     could crown a card the source desk itself refuses to lead. Same
     semantics as the desk: gate the ranked set; if the whole gate THROWS,
     every candidate is marked unchecked, never silently clean. */
  var pgFn = gfn('hgFilterGoldPostGate');
  if (pgFn){
    try{
      ranked = await pgFn(ranked, { 'GOLD DIRECTION': { rows15m: gold.rows15m } }, gold.rows4h, 'gold-scalp');
    }catch(ePg){
      var mkFn = gfn('hgMarkGateUnchecked');
      var pgWhy = 'post-gate filter threw: ' + ((ePg && ePg.message) ? ePg.message : String(ePg));
      for (var pgI = 0; pgI < ranked.length; pgI++){
        if (mkFn && ranked[pgI]) mkFn(ranked[pgI], [pgWhy]);
      }
    }
    if (!Array.isArray(ranked)) ranked = [];
  }
  for (i = 0; i < ranked.length; i++){
    var c = ranked[i];
    if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
    out.cands.push(normCand('GOLD SCALP', 'SCALP', c, {}));
  }
  return out;
}

function laneGoldSwing(gold, now){
  var out = { cands: [], held: [], dark: null };
  var fn = gfn('goldSwingSetups');
  if (!fn){ out.dark = 'GOLD SWING engine dark — goldSwingSetups (goldswing.js) not loaded'; return out; }
  if (!gold.rows4h.length){ out.held.push(heldLine('GOLD SWING', 'SWING', null, null, 'no 4h bars from any feed — lane skipped')); return out; }
  var rk = null;
  try{ rk = fn({ rows4h: gold.rows4h, rows1d: gold.rows1d, now: now, news: null }); }
  catch(e){ out.held.push(heldLine('GOLD SWING', 'SWING', null, null, 'engine threw: ' + ((e && e.message) || e))); return out; }
  if (!rk || !Array.isArray(rk.ranked)) return out;
  var i, rr = rk.rejected || [];
  for (i = 0; i < rr.length; i++){
    if (rr[i]) out.held.push(heldLine('GOLD SWING', 'SWING', rr[i].strategy, rr[i].dir, rr[i].reason || 'failed a quality gate'));
  }
  for (i = 0; i < rk.ranked.length; i++){
    var c = rk.ranked[i];
    if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
    out.cands.push(normCand('GOLD SWING', 'SWING', c, {}));
  }
  return out;
}

function laneOmnigold(gold, now){
  var out = { cands: [], held: [], dark: null };
  var det = gfn('hgOgDetect'), ev = gfn('hgOgEvaluate'), cfgFn = gfn('hgOgHorizonCfg');
  if (!det || !ev || !cfgFn){ out.dark = 'OMNIGOLD engine dark — hgOgDetect/hgOgEvaluate/hgOgHorizonCfg (omnigold.js) not loaded'; return out; }
  var ogForm = gfn('hgOgFormation');
  var dailyFn = gfn('hgOmniDailyHtf');
  var adrFn = gfn('hgOgAdr');
  var legs = [ { rows: gold.rows1h, label: 'SCALP', horizon: 'SCALP' },
               { rows: gold.rows4h, label: 'SWING', horizon: 'SWING' } ];
  for (var li = 0; li < legs.length; li++){
    var leg = legs[li];
    if (!leg.rows || leg.rows.length < 60){
      out.held.push(heldLine('OMNIGOLD', leg.horizon, null, null, 'not enough ' + (leg.label === 'SCALP' ? '1h' : '4h') + ' bars for the detector — lane skipped'));
      continue;
    }
    try{
      var nowSec = lastT(leg.rows);
      var livePx = lastClose(leg.rows);
      /* omnigold.js's own minimal extra pack — live-only feeds stay
         undefined so those gates read UNCHECKED (their design) */
      var extra = {
        htf: dailyFn ? dailyFn(leg.rows) : null,
        adr: adrFn ? adrFn(leg.rows, 14) : null,
        nowSec: nowSec,
        livePx: livePx
      };
      var cfg = cfgFn(leg.label);
      var hits = det(leg.rows, { nowSec: nowSec });
      if (!hits || !hits.length) continue;
      var cands = ev(leg.rows, hits, extra, cfg);
      for (var ci = 0; ci < (cands || []).length; ci++){
        var c = cands[ci];
        if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
        /* formation verdict — the one already stamped by hgOgEvaluate when
           present, else run hgOgFormation directly; no verdict available at
           all is fail-closed NOT FORMED, never a tradable card. */
        var fm = c.formation || null;
        if (!fm && ogForm){
          try{ fm = ogForm({ kind: c.kind, horizon: leg.label, plan: c.plan, dir: c.dir }); }
          catch(eFm){ fm = { formed: false, reasons: ['formation check threw — fail closed: ' + ((eFm && eFm.message) || eFm)] }; }
        }
        if (!fm) fm = { formed: false, reasons: ['formation contract unavailable — fail closed'] };
        if (fm.formed !== true){
          out.held.push(heldLine('OMNIGOLD', leg.horizon, c.kind, c.dir,
            (Array.isArray(fm.reasons) && fm.reasons.length) ? fm.reasons.join(' · ') : 'not formed — reason not recorded (fail closed)'));
          continue;
        }
        /* hgOgEvaluate keeps levels under .plan — normalize */
        var plan = c.plan || {};
        out.cands.push(normCand('OMNIGOLD', leg.horizon, c, {
          strategy: c.kind || 'OMNIGOLD SETUP',
          stratKey: c.kind || null,
          grade: c.engineGrade || (c.grade && c.grade.letter) || null,
          entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
          rr: (isFinite(fin(plan.rr1)) ? plan.rr1 : c.rr),
          rr2: plan.rr2,
          zone: (plan.zone && isFinite(fin(plan.zone.lo)) && isFinite(fin(plan.zone.hi)))
            ? { lo: +plan.zone.lo, hi: +plan.zone.hi } : null,
          demoted: !!(fm.edgeDemote || fm.kindDemotion),
          demoteReasons: fm.edgeDemote ? [String(fm.edgeDemote.why || 'gold setup edge demote')] : [],
          why: c.why || null
        }));
      }
    }catch(eLeg){
      out.held.push(heldLine('OMNIGOLD', leg.horizon, null, null, 'lane threw: ' + ((eLeg && eLeg.message) || eLeg)));
    }
  }
  return out;
}

function laneOmnigold1(gold, now){
  var out = { cands: [], held: [], dark: null };
  var eng = gfn('hgOg1Engine');
  if (!eng){ out.dark = 'OMNIGOLD 1 engine dark — hgOg1Engine (omnigold1.js) not loaded'; return out; }
  var gradeFn = gfn('hgOg1Grade');
  var tape4h = '';
  try{
    var uni = gfn('hgGoldUniformTape');
    if (uni && gold.rows4h && gold.rows4h.length){
      /* the desk's own tape cut (omnigold1.js runScan, hg-v700 one-clock
         rule): the tape reads CLOSED 4h bars keyed on the same now the
         engine receives — never a still-forming bar. HG_GOLD7 absent ->
         raw rows stand (offline harnesses feed closed bars anyway).
         Case-normalized: hgGoldUniformTape answers UPPERCASE. */
      var rows4c = gold.rows4h;
      try{
        var g7 = W.HG_GOLD7;
        if (g7 && typeof g7.closedRows === 'function'){
          var cr = g7.closedRows(gold.rows4h, 14400, now);
          if (cr && cr.length) rows4c = cr;
        }
      }catch(e7){}
      var tR = uni(rows4c);
      var tN = String(tR === null || tR === undefined ? '' : tR).toLowerCase();
      if (tN === 'long' || tN === 'short') tape4h = tN;
    }
  }catch(eT){}
  var inp = { rows15m: gold.rows15m, rows1h: gold.rows1h, rows4h: gold.rows4h, now: now };
  if (tape4h) inp.tape = tape4h;
  var horizons = ['SWING', 'SCALP'];
  for (var hi = 0; hi < horizons.length; hi++){
    var H = horizons[hi];
    var r = null;
    try{
      var one = { horizon: H }, k;
      for (k in inp) if (Object.prototype.hasOwnProperty.call(inp, k)) one[k] = inp[k];
      r = eng(one);
    }catch(eE){
      out.held.push(heldLine('OMNIGOLD 1', H, null, null, 'engine threw: ' + ((eE && eE.message) || eE)));
      continue;
    }
    if (!r || !r.ok){
      out.held.push(heldLine('OMNIGOLD 1', H, null, null, 'DATA_UNAVAILABLE — ' + ((r && r.why) || 'engine returned nothing')));
      continue;
    }
    if (r.sections && r.sections.s0 && !r.sections.s0.clear){
      out.held.push(heldLine('OMNIGOLD 1', H, null, null, 'VETO ACTIVE — the veto stack holds this horizon; no candidates offered'));
      continue;
    }
    var list = Array.isArray(r.candidates) ? r.candidates : [];
    for (var ci = 0; ci < list.length; ci++){
      var c = list[ci];
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      if (c.matrix && c.matrix.held){
        out.held.push(heldLine('OMNIGOLD 1', H, c.sid, c.dir, 'HELD against its own tape — paints on its desk, never exported as tradable'));
        continue;
      }
      if (c.dropped){
        out.held.push(heldLine('OMNIGOLD 1', H, c.sid, c.dir, c.dropReason || 'dropped at mint'));
        continue;
      }
      var grade = null;
      if (gradeFn){ try{ var gi = gradeFn(c); grade = gi && gi.grade || null; }catch(eG){} }
      /* c.demoted rides through normCand — a demoted OMNIGOLD 1 card
         (the measured gross-negative SCALP cohort, hg-v700) is EXCLUDED
         from crowning by the lead invariant in the selector. */
      out.cands.push(normCand('OMNIGOLD 1', H, c, {
        strategy: (c.sid ? c.sid + ' ' : '') + (c.name || c.kind || 'SETUP'),
        stratKey: c.sid || null,
        grade: grade,
        rr: c.rr1, rr2: c.rr2
      }));
    }
  }
  return out;
}

function laneNewGold(gold, now){
  var out = { cands: [], held: [], dark: null };
  var ng = gfn('ngAssess');
  if (!ng){ out.dark = 'NEW GOLD engine dark — ngAssess (newgold.js) not loaded'; return out; }
  var formFn = gfn('hgGoldFormation');
  var confFn = gfn('ngConfirmations');
  var tapeFn = gfn('ngHtfTape');
  /* newgold.js HORIZONS: 1h -> '1H', 4h -> '4H' */
  var legs = [ { rows: gold.rows1h, label: '1H', horizon: 'SCALP' },
               { rows: gold.rows4h, label: '4H', horizon: 'SWING' } ];
  for (var li = 0; li < legs.length; li++){
    var leg = legs[li];
    if (!leg.rows || !leg.rows.length) continue;
    var setup = null;
    try{ setup = ng(leg.rows); }
    catch(e){ out.held.push(heldLine('NEW GOLD', leg.horizon, null, null, 'ngAssess threw: ' + ((e && e.message) || e))); continue; }
    if (!setup) continue;   /* no triple-confirmation fire — the desk's own honest silence */
    try{
      var tape = { dir: '', src: '' };
      if (tapeFn){ try{ tape = tapeFn(leg.label, gold.rows4h) || tape; }catch(eT){} }
      var confirmations = null;
      if (confFn){ try{ confirmations = confFn(setup, { tape: tape, rows: leg.rows }); }catch(eC){ confirmations = null; } }
      /* shared gold formation — the same call shape newgold.js's own scan
         makes. Fail closed: no helper -> not formed, reason named. */
      var fm;
      if (formFn){
        try{
          fm = formFn(
            { kind: setup.kind, horizon: leg.label, dir: setup.dir,
              plan: { entry: setup.entry, stop: setup.stop, t1: setup.t1, rr1: setup.rr1 },
              entry: setup.entry, stop: setup.stop, t1: setup.t1 },
            { tab: 'NEWGOLD:' + leg.label, mechanic: setup.kind || 'TRIPLE-CONF',
              confirmations: confirmations, requireClasses: ['session-htf'] });
        }catch(eFm){
          fm = { formed: false, reasons: ['shared formation threw — fail closed: ' + ((eFm && eFm.message) || eFm)] };
        }
      } else {
        fm = { formed: false, reasons: ['shared gold formation unavailable — gold-formation.js is not loaded; fail closed'] };
      }
      if (!fm || fm.formed !== true){
        out.held.push(heldLine('NEW GOLD', leg.horizon, setup.kind || 'TRIPLE-CONF', setup.dir,
          (fm && Array.isArray(fm.reasons) && fm.reasons.length) ? fm.reasons.join(' · ') : 'not formed (fail closed)'));
        continue;
      }
      if (!isFinite(fin(setup.entry)) || !isFinite(fin(setup.stop)) || !isFinite(fin(setup.t1))){
        out.held.push(heldLine('NEW GOLD', leg.horizon, setup.kind || 'TRIPLE-CONF', setup.dir, 'no full plan — fire cannot participate'));
        continue;
      }
      out.cands.push(normCand('NEW GOLD', leg.horizon, setup, {
        strategy: setup.kind || 'TRIPLE-CONF',
        stratKey: setup.kind || 'TRIPLE-CONF',
        rr: setup.rr1, rr2: setup.rr2
      }));
    }catch(eLeg){
      out.held.push(heldLine('NEW GOLD', leg.horizon, null, null, 'lane threw: ' + ((eLeg && eLeg.message) || eLeg)));
    }
  }
  return out;
}

/* ---------------- proven set (hg-v702, resolved at scan time) ----------------
   The whitelist of strategies that MEASURABLY PAID, rebuilt on every scan
   from the live single-source surfaces — never a hardcoded copy that can go
   stale (the fabricated-bos-row lesson). Every entry carries its source and
   only numbers actually read from that source. Fail closed: an absent
   surface contributes nothing, and an empty set crowns nothing. */
var FWD_PAID_TABS = ['GOLDDIRECTION', 'OMNIGOLD:SCALP', 'OMNIGOLD:SWING'];

/* the forward ledger's mechanic name for a candidate — the SAME normalization
   recordForward writes with, so the ledger's paid list can be matched back */
function fwdMechName(c){
  return String((c.source || '') + ' ' + (c.stratKey || c.strategy || 'UNKNOWN'))
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);
}

function buildProvenSet(allCands){
  var entries = [];
  function add(e){
    for (var di = 0; di < entries.length; di++){
      if (entries[di].key === e.key && entries[di].source === e.source
          && String(entries[di].horizon || '') === String(e.horizon || '')
          && String(entries[di].tab || '') === String(e.tab || '')) return;
    }
    entries.push(e);
  }
  /* (a) the live baked edge table — prefer rows only, numbers read here */
  try{
    var tbl = W.HG_GOLD_SETUP_EDGE;
    if (tbl && typeof tbl === 'object'){
      var parts = [ { t: tbl.scalp, hz: 'SCALP' }, { t: tbl.swing, hz: 'SWING' } ];
      for (var pi = 0; pi < parts.length; pi++){
        var t = parts[pi].t;
        if (!t || typeof t !== 'object') continue;
        for (var k in t){
          if (!Object.prototype.hasOwnProperty.call(t, k)) continue;
          var row = t[k];
          if (!row || row.action !== 'prefer') continue;
          add({ key: k, horizon: parts[pi].hz, source: 'replay-prefer',
                n: fin(row.n), gross: fin(row.gross), net: fin(row.net),
                why: row.why ? String(row.why) : '' });
        }
      }
    }
  }catch(eA){}
  /* (b) OMNIGOLD swing-prefer — probed per scanned OMNIGOLD kind; the desk
     exports the predicate, not per-kind figures, so no numbers ride here */
  try{
    var sp = gfn('hgOgSwingPrefer');
    if (sp && Array.isArray(allCands)){
      for (var ci = 0; ci < allCands.length; ci++){
        var c = allCands[ci];
        if (!c || c.source !== 'OMNIGOLD') continue;
        var kind = c.stratKey || c.strategy;
        if (!kind) continue;
        var hit = false;
        try{ hit = !!sp(kind, c.horizon); }catch(eS){ hit = false; }
        if (hit) add({ key: String(kind), horizon: c.horizon, source: 'omnigold-prefer',
          why: 'on OMNIGOLD’s swing-replay prefer list (hgOgSwingPrefer) — per-kind figures are not exported, so none are printed' });
      }
    }
  }catch(eB){}
  /* (c) the LIVE forward ledger — mechanics reading 'has paid' at the
     family-wise bar; stats read from hgFwdPool when that surface answers */
  try{
    var pk = gfn('hgFwdPaidKinds');
    if (pk){
      var poolFn = gfn('hgFwdPool');
      for (var ti = 0; ti < FWD_PAID_TABS.length; ti++){
        var list = null;
        try{ list = pk(FWD_PAID_TABS[ti]); }catch(eK){ list = null; }
        if (!Array.isArray(list)) continue;
        for (var li = 0; li < list.length; li++){
          if (!list[li]) continue;
          var e = { key: String(list[li]), horizon: null, source: 'live-paid', tab: FWD_PAID_TABS[ti] };
          if (poolFn){
            try{
              var pool = poolFn(FWD_PAID_TABS[ti]);
              var p = pool && pool[e.key];
              if (p && fin(p.samples) > 0){
                e.stats = { samples: fin(p.samples), wins: fin(p.wins), expR: fin(p.expR) };
              }
            }catch(eP){}
          }
          add(e);
        }
      }
    }
  }catch(eC){}
  return entries;
}

/* Is this candidate measured-proven? Returns the proving entry (source +
   the numbers read from it) or null. Never throws, never invents. */
function provenOf(c, entries){
  try{
    /* the prefer row the candidate's own desk stamped onto it — the SAME
       row, carried with its own numbers */
    if (c.edge && c.edge.action === 'prefer'){
      return { source: 'replay-prefer', key: String(c.stratKey || c.strategy || ''),
               n: fin(c.edge.n), gross: fin(c.edge.gross), net: fin(c.edge.net),
               why: c.edge.why ? String(c.edge.why) : '' };
    }
    var list = entries || [];
    var key = String(c.stratKey || '').toLowerCase();
    /* the edge-apply fn's own swing alias — table keys are evidence labels */
    if (c.horizon === 'SWING' && key === 'wkbreak') key = 'weekly';
    var i, e;
    if (key){
      for (i = 0; i < list.length; i++){
        e = list[i];
        if (e.source === 'replay-prefer' && e.horizon === c.horizon
            && String(e.key).toLowerCase() === key) return e;
      }
    }
    if (c.source === 'OMNIGOLD'){
      var kUp = String(c.stratKey || c.strategy || '').toUpperCase();
      for (i = 0; i < list.length; i++){
        e = list[i];
        if (e.source === 'omnigold-prefer' && e.horizon === c.horizon
            && String(e.key).toUpperCase() === kUp && kUp) return e;
      }
    }
    var mech = fwdMechName(c);
    var rawUp = String(c.stratKey || c.strategy || '').toUpperCase();
    for (i = 0; i < list.length; i++){
      e = list[i];
      if (e.source !== 'live-paid') continue;
      /* hg-v702 audit closeout: live-paid proof is CADENCE-SCOPED. A kind
         that has paid only on the OMNIGOLD:SCALP (1h) ledger must not crown
         a 4h SWING candidate — omnigold.js's own HG_OG_SWING_PREFER comment
         warns the same names lose across cadence in the reverse direction.
         An OMNIGOLD:SCALP entry proves SCALP candidates only, :SWING proves
         SWING only; GOLDDIRECTION's own ledger records this tab's crowned
         picks per horizon-tagged mechanic and matches by that exact name. */
      if (e.tab === 'OMNIGOLD:SCALP' && c.horizon !== 'SCALP') continue;
      if (e.tab === 'OMNIGOLD:SWING' && c.horizon !== 'SWING') continue;
      var ek = String(e.key).toUpperCase();
      if (ek === mech || (rawUp && ek === rawUp)) return e;
    }
  }catch(ePr){}
  return null;
}

/* ---------------- selection (per horizon, fail closed) ---------------- */
function rankKey(c){
  return {
    lead: c.demoted ? 1 : 0,
    conf: isFinite(c.confScore) ? c.confScore : -1,
    sol: isFinite(c.solidity) ? c.solidity : -1,
    tally: isFinite(c.tally) ? c.tally : -1e9,
    rr: isFinite(c.rr) ? c.rr : -1
  };
}
function cmpCands(a, b){
  var ka = rankKey(a), kb = rankKey(b);
  if (ka.lead !== kb.lead) return ka.lead - kb.lead;   /* lead-eligible (non-demoted) first */
  if (ka.conf !== kb.conf) return kb.conf - ka.conf;   /* data-backed confScore desc, missing -1 */
  if (ka.sol !== kb.sol) return kb.sol - ka.sol;       /* solidity score if present */
  if (ka.tally !== kb.tally) return kb.tally - ka.tally;
  return kb.rr - ka.rr;
}
function selectHorizon(all, side, horizon, provenEntries){
  var matched = [], rejected = [], otherSide = 0, i;
  for (i = 0; i < all.length; i++){
    var c = all[i];
    if (!c || c.horizon !== horizon) continue;
    if (c.dir !== side){ otherSide++; continue; }   /* the OTHER side is counted, never rendered — the user's call stands */
    if (c.vetoed || c.dropped){
      rejected.push(heldLine(c.source, horizon, c.strategy, c.dir,
        (c.vetoed ? 'vetoed by its own desk' : 'dropped by its own desk')
        + (c.why ? ' — ' + c.why : '')));
      continue;
    }
    if (!isFinite(c.entry) || !isFinite(c.stop) || !isFinite(c.t1)){
      rejected.push(heldLine(c.source, horizon, c.strategy, c.dir, 'levels incomplete — entry/stop/T1 not all finite; never tradable'));
      continue;
    }
    var sides = planSidesOk(c);
    if (!sides.ok){
      rejected.push(heldLine(c.source, horizon, c.strategy, c.dir,
        'WRONG-SIDE GEOMETRY — ' + (sides.why || 'plan sides invalid') + '; counted + listed, never shown as tradable'));
      continue;
    }
    matched.push(c);
  }
  matched.sort(cmpCands);
  /* LEAD INVARIANT (v699/v700) + PROVEN-ONLY CROWNING (hg-v702): the crowned
     pick is the FIRST lead-eligible (non-demoted, non-vetoed) card that is
     ALSO measured-proven (provenOf against the runtime-resolved set).
     Lead-eligible-but-unproven cards are NEVER crowned — they collect in
     unproven[] and render under an honest 'NOT MEASURED-PROVEN' header.
     An all-demoted side still gets NO pick and NO execution banner. */
  var pick = null, unproven = [];
  for (i = 0; i < matched.length; i++){
    var m = matched[i];
    if (m.demoted || m.vetoed) continue;
    var pv = provenOf(m, provenEntries);
    if (pv){
      m.provenBy = pv;
      if (!pick) pick = m;
    } else {
      unproven.push(m);
    }
  }
  var demotedTop = [];
  if (!pick && !unproven.length){
    for (i = 0; i < matched.length && demotedTop.length < 3; i++){
      if (matched[i].demoted) demotedTop.push(matched[i]);
    }
  }
  return { pick: pick, matched: matched, demotedTop: demotedTop, unproven: unproven,
           rejected: rejected, otherSide: otherSide };
}

/* ---------------- renderers ---------------- */
function srcChip(c){ return '<span class="gdx-src">' + esc(c.source) + '</span>'; }
function tapeStamp(c, tape){
  if ((tape !== 'long' && tape !== 'short') || c.dir === tape) return '';
  return '<div class="gdx-tapewarn">⚠ AGAINST DESK TAPE — your call. Desk tape reads ' + esc(tape.toUpperCase())
    + '; you chose ' + esc(String(c.dir).toUpperCase()) + '. The side is never flipped for you.</div>';
}
function venueCostLine(){
  try{
    var vcFn = gfn('hgOgVenueCost');
    if (!vcFn) return '';
    var vc = vcFn();
    var rt = vc ? fin(vc.rtCostPct) : NaN;
    if (!vc || !isFinite(rt)) return '';
    return '<div class="gdx-venue">venue cost — ' + esc(String(vc.venue || 'venue')) + ' ' + rt.toFixed(3) + '% round trip prices the fees on this plan</div>';
  }catch(e){ return ''; }
}
function mgmtHtml(c){
  if (!isFinite(c.t1) || !isFinite(c.t2) || !isFinite(c.entry)) return '';
  return '<div class="gdx-mgmt"><b>TRADE MANAGEMENT</b> · At TP1 $' + pxF(c.t1)
    + ': close 50%, move stop to breakeven ($' + pxF(c.entry) + '). Runner targets TP2 $' + pxF(c.t2) + '.</div>';
}
function guideHtml(c, pxNow){
  if (!c.zone || !isFinite(c.zone.lo) || !isFinite(c.zone.hi) || !isFinite(pxNow)) return '';
  var inZone = pxNow >= c.zone.lo && pxNow <= c.zone.hi;
  return '<div class="gdx-guide ' + (inZone ? 'in' : 'out') + '"><b>ENTRY GUIDANCE</b> · '
    + (inZone ? 'price in zone — market entry valid'
              : 'price outside zone — limit order at zone edge $' + pxF(pxNow > c.zone.hi ? c.zone.hi : c.zone.lo))
    + '</div>';
}
/* MEASURED RECORD line (hg-v702) — rendered on the crowned card ONLY, from
   the SAME entry that proved it. Every number printed was read from its
   source at render time; a source with no exported figures prints none. */
function measuredHtml(c){
  var pv = c.provenBy;
  if (!pv) return '';
  var txt;
  if (pv.source === 'replay-prefer'){
    var bits = [];
    if (isFinite(pv.net)) bits.push('net ' + (pv.net >= 0 ? '+' : '') + fmtF(pv.net, 2) + 'R/trade after costs');
    if (isFinite(pv.n)) bits.push('n=' + fmtF(pv.n, 0));
    if (isFinite(pv.gross)) bits.push('gross ' + (pv.gross >= 0 ? '+' : '') + fmtF(pv.gross, 2) + 'R');
    txt = esc(c.strategy) + ' — measured ' + (bits.length ? esc(bits.join(', ')) : 'in the replay bake')
        + (pv.why ? ' — ' + esc(pv.why) : '')
        + ' <i>(HG_GOLD_SETUP_EDGE prefer row, read at render)</i>';
  } else if (pv.source === 'omnigold-prefer'){
    txt = esc(c.strategy) + ' — on OMNIGOLD’s swing-replay prefer list (hgOgSwingPrefer): paid net-positive'
        + ' in that desk’s replay; per-kind figures are not exported here, so none are printed.';
  } else {
    txt = esc(c.strategy) + ' — LIVE LEDGER' + (pv.tab ? ' (' + esc(pv.tab) + ')' : '')
        + ': reads HAS PAID at the family-wise bar (hgFwdPaidKinds)';
    if (pv.stats && isFinite(pv.stats.samples)){
      txt += ' — ' + fmtF(pv.stats.samples, 0) + ' settled'
          + (isFinite(pv.stats.wins) ? ', ' + fmtF(pv.stats.wins, 0) + ' paid' : '')
          + (isFinite(pv.stats.expR) ? ', exp ' + (pv.stats.expR >= 0 ? '+' : '') + fmtF(pv.stats.expR, 2) + 'R/trade' : '')
          + ' <i>(hgFwdPool read at render)</i>';
    } else {
      txt += ' — the ledger stat surface (hgFwdPool) did not answer; no numbers printed.';
    }
  }
  return '<div class="gdx-measured"><b>MEASURED RECORD</b> · ' + txt + '</div>';
}
function cardHTML(c, tape, pxNow, crowned){
  var chips = '';
  chips += '<span class="gdx-chip">' + esc(c.horizon) + '</span>';
  if (c.grade) chips += '<span class="gdx-chip ok">GRADE ' + esc(c.grade) + '</span>';
  if (isFinite(c.confScore)) chips += '<span class="gdx-chip">conf ' + fmtF(c.confScore, 0) + '</span>';
  if (isFinite(c.tally)) chips += '<span class="gdx-chip">tally ' + (c.tally > 0 ? '+' : '') + fmtF(c.tally, 0) + '</span>';
  if (isFinite(c.solidity)) chips += '<span class="gdx-chip">solidity ' + fmtF(c.solidity, 0) + '</span>';
  if ((tape === 'long' || tape === 'short') && c.dir !== tape)
    chips += '<span class="gdx-chip warn">AGAINST DESK TAPE — your call</span>';
  else if ((tape === 'long' || tape === 'short') && c.dir === tape)
    chips += '<span class="gdx-chip ok">WITH DESK TAPE</span>';
  var si;
  for (si = 0; si < c.stamps.length; si++) chips += '<span class="gdx-chip warn">' + esc(c.stamps[si]) + '</span>';
  if (c.demoted) chips += '<span class="gdx-chip warn">DEMOTED — paints, never leads</span>';
  /* hg-v702 proven chips: lead-eligible cards say plainly whether a measured
     record backs them; demoted/vetoed cards already carry their own stamps */
  if (!c.demoted && !c.vetoed){
    if (c.provenBy) chips += '<span class="gdx-chip ok">MEASURED-PROVEN · ' + esc(c.provenBy.source) + '</span>';
    else chips += '<span class="gdx-chip warn">NOT MEASURED-PROVEN — paints, not crowned</span>';
  }
  var gates = '';
  if (c.gateNotes.length) gates += '<div class="gdx-gate"><b>GATE NOTES</b> — ' + esc(c.gateNotes.join(' · ')) + '</div>';
  if (c.demoted && c.demoteReasons.length) gates += '<div class="gdx-gate"><b>DEMOTED</b> — ' + esc(c.demoteReasons.join(' · ')) + '</div>';
  var zoneTxt = c.zone ? ('$' + pxF(c.zone.lo) + '–$' + pxF(c.zone.hi)) : ('$' + pxF(c.entry));
  return '<div class="gdx-card ' + esc(c.dir) + (crowned ? ' crowned' : '') + '">'
    + '<div>' + srcChip(c) + '<span class="gdx-strat">' + esc(c.strategy) + '</span>'
    + ' · <b>' + esc(String(c.dir).toUpperCase()) + '</b></div>'
    + '<div class="gdx-chips">' + chips + '</div>'
    + '<div class="gdx-planline">' + (c.dir === 'long' ? 'BUY' : 'SELL') + ' <b>' + zoneTxt + '</b>'
    + ' · ENTRY <b>$' + pxF(c.entry) + '</b>'
    + ' · STOP <b>$' + pxF(c.stop) + '</b>'
    + ' · TP1 <b>$' + pxF(c.t1) + '</b>' + (isFinite(c.rr) ? ' (' + fmtF(c.rr, 1) + 'R)' : '')
    + ' · TP2 <b>$' + pxF(c.t2) + '</b>' + (isFinite(c.rr2) ? ' (' + fmtF(c.rr2, 1) + 'R)' : '')
    + '</div>'
    + (crowned ? measuredHtml(c) : '')
    + mgmtHtml(c) + guideHtml(c, pxNow)
    + (c.why ? '<div class="gdx-why">' + esc(c.why) + '</div>' : '')
    + (c.invalidates ? '<div class="gdx-why"><b>INVALIDATES:</b> ' + esc(c.invalidates) + '</div>' : '')
    + gates
    + venueCostLine()
    + '</div>';
}
function bannerHTML(pick, horizon, tape){
  if (!pick) return '';
  return '<div class="gdx-banner"><div class="gdx-banner-in">'
    + '<div class="gdx-eye">BEST ' + esc(horizon) + ' SETUP — YOUR ' + esc(String(pick.dir).toUpperCase()) + ' CALL</div>'
    + '<div class="gdx-dir ' + esc(pick.dir) + '">' + esc(String(pick.dir).toUpperCase())
    + '<span>' + esc(pick.source) + ' · ' + esc(pick.strategy) + (pick.grade ? ' · GRADE ' + esc(pick.grade) : '') + '</span></div>'
    + '<div class="gdx-plan">'
    + '<div><i>' + (pick.dir === 'long' ? 'BUY ZONE' : 'SELL ZONE') + '</i><b>'
    + (pick.zone ? ('$' + pxF(pick.zone.lo) + ' – $' + pxF(pick.zone.hi)) : ('$' + pxF(pick.entry)))
    + '</b><u>entry $' + pxF(pick.entry) + '</u></div>'
    + '<div><i>STOP</i><b>$' + pxF(pick.stop) + '</b><u>a close beyond it kills the idea</u></div>'
    + '<div><i>TP1</i><b>$' + pxF(pick.t1) + '</b><u>' + (isFinite(pick.rr) ? fmtF(pick.rr, 1) + 'R — ' : '') + 'trim / de-risk</u></div>'
    + '<div><i>TP2</i><b>$' + pxF(pick.t2) + '</b><u>' + (isFinite(pick.rr2) ? fmtF(pick.rr2, 1) + 'R — ' : '') + 'runner</u></div>'
    + '</div>'
    + tapeStamp(pick, tape)
    + '</div></div>';
}
function heldListHTML(lines, title){
  if (!lines || !lines.length) return '';
  var top = lines.slice(0, 6);
  var rows = top.map(function(r){
    if (!r) return '';
    return '<div class="gdx-heldrow"><b>✕ ' + esc(r.source || 'DESK') + '</b>'
      + (r.strategy ? ' · ' + esc(r.strategy) : '')
      + (r.dir ? ' · ' + esc(String(r.dir).toUpperCase()) : '')
      + ' — ' + esc(r.reason || 'held back') + '</div>';
  }).join('');
  var more = lines.length > top.length
    ? '<div class="gdx-dark">… and ' + (lines.length - top.length) + ' more held-back line' + (lines.length - top.length === 1 ? '' : 's') + '</div>' : '';
  return '<div class="gdx-held"><div class="gdx-heldhead">' + esc(title) + ' — every reason named, nothing dropped silently</div>' + rows + more + '</div>';
}
function horizonHTML(sel, side, horizon, tape, pxNow, enginesDark){
  var h = '<div class="gdx-hzhead">BEST ' + esc(horizon) + ' — ' + esc(side.toUpperCase()) + '</div>';
  var unpr = sel.unproven || [];
  if (sel.pick){
    h += bannerHTML(sel.pick, horizon, tape);
    /* main list = matched minus the unproven cards, which render below under
       their own honest header — never mixed in as if crownable */
    h += sel.matched.filter(function(c){ return unpr.indexOf(c) < 0; })
      .map(function(c){ return cardHTML(c, tape, pxNow, c === sel.pick); }).join('');
  } else if (unpr.length){
    /* hg-v702: lead-eligible candidates exist but NONE measurably paid — NO
       execution banner; the honest unproven list below is the whole board */
    h += '<div class="gdx-demhead">no crowned ' + esc(horizon) + ' setup on the ' + esc(side.toUpperCase())
      + ' side — lead-eligible candidates exist, but none has a measured paid record (proven-only crowning):</div>';
  } else if (sel.demotedTop.length){
    /* all-demoted side: NO execution banner — honest header + demoted cards */
    h += '<div class="gdx-demhead">no lead-eligible ' + esc(horizon) + ' setup on the ' + esc(side.toUpperCase())
      + ' side — closest candidates are demoted:</div>';
    h += sel.demotedTop.map(function(c){ return cardHTML(c, tape, pxNow, false); }).join('');
  } else {
    var whyBits = ['no ' + side.toUpperCase() + ' ' + horizon + ' candidates from any engine'];
    if (sel.otherSide > 0) whyBits.push(sel.otherSide + ' candidate' + (sel.otherSide === 1 ? '' : 's') + ' on the other side (not your call this scan — the side is never flipped)');
    if (sel.rejected.length) whyBits.push(sel.rejected.length + ' rejected (reasons listed below)');
    if (enginesDark.length) whyBits.push(enginesDark.length + ' engine' + (enginesDark.length === 1 ? '' : 's') + ' dark');
    h += '<div class="gdx-silent"><b>WHY SILENT</b> — ' + esc(whyBits.join(' · ')) + '</div>';
  }
  if (unpr.length){
    /* hg-v702: the clearly-headed unproven list — full cards, no execution
       banner treatment, never crowned, never recorded to the ledger */
    h += '<div class="gdx-demhead">NOT MEASURED-PROVEN — paints, not crowned: ' + unpr.length
      + ' lead-eligible ' + esc(horizon) + ' candidate' + (unpr.length === 1 ? '' : 's')
      + ' with no measured paid record (edge-table prefer / OMNIGOLD swing-prefer / live ledger all silent on '
      + (unpr.length === 1 ? 'it' : 'them') + '). Informational only.</div>';
    h += unpr.map(function(c){ return cardHTML(c, tape, pxNow, false); }).join('');
  }
  if (sel.otherSide > 0 && (sel.pick || sel.demotedTop.length)){
    h += '<div class="gdx-dark">' + sel.otherSide + ' candidate' + (sel.otherSide === 1 ? '' : 's')
      + ' on the other side — counted, never rendered as yours.</div>';
  }
  h += heldListHTML(sel.rejected, horizon + ' REJECTED (wrong-side geometry / vetoed / incomplete)');
  return h;
}

/* ---------------- publish (BRAIN + diagnostic + forward ledger) ---------------- */
function publishState(scalpSel, swingSel){
  try{
    var rows = [];
    var picks = [scalpSel.pick, swingSel.pick];
    for (var i = 0; i < picks.length; i++){
      var p = picks[i];
      if (!p) continue;
      rows.push({ dir: p.dir, horizon: p.horizon, grade: p.grade || null, source: p.source });
    }
    __snap = { results: rows, at: Date.now() };
  }catch(e){ /* snapshotting must never break the scan */ }
}
function publishScan(side, scalpSel, swingSel, tape, enginesDark, heldAll, at, provenSet){
  try{
    function hz(sel){
      return {
        pick: sel.pick ? JSON.parse(JSON.stringify(sel.pick)) : null,
        /* hg-v702 additive: crowned pick is proven by construction; the
           lead-eligible-but-unproven list is published so the refusal to
           crown is itself auditable */
        crownedProven: !!(sel.pick && sel.pick.provenBy),
        unproven: (sel.unproven || []).map(function(c){
          return { source: c.source, horizon: c.horizon, strategy: c.strategy,
                   stratKey: c.stratKey, dir: c.dir,
                   reason: 'lead-eligible but not measured-proven — paints, not crowned' };
        }),
        held: heldAll.filter(function(r){ return r && r.horizon === sel.horizonName; })
          .map(function(r){ return { source: r.source, horizon: r.horizon, strategy: r.strategy, dir: r.dir, reason: r.reason }; }),
        rejected: sel.rejected.map(function(r){ return { source: r.source, horizon: r.horizon, strategy: r.strategy, dir: r.dir, reason: r.reason }; }),
        otherSide: sel.otherSide
      };
    }
    scalpSel.horizonName = 'SCALP';
    swingSel.horizonName = 'SWING';
    __scanSnap = { side: side, scalp: hz(scalpSel), swing: hz(swingSel),
                   tape: tape || '', enginesDark: enginesDark.slice(),
                   provenSet: JSON.parse(JSON.stringify(provenSet || [])),
                   at: at };
  }catch(e){ /* snapshotting must never break the scan */ }
}
function recordForward(scalpSel, swingSel, gold){
  /* Settle open XAUUSD records with the bars just fetched BEFORE recording,
     so a setup can never be settled by the bar it was written on. */
  try{
    if (typeof W.hgFwdResolve === 'function' && gold.rows4h && gold.rows4h.length){
      W.hgFwdResolve('XAUUSD', null, gold.rows4h);
    }
  }catch(eR){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('golddirection', eR); }catch(eW){} }
  try{
    if (typeof W.hgFwdRecordScan !== 'function') return;
    var picks = [];
    if (scalpSel.pick) picks.push(scalpSel.pick);
    if (swingSel.pick) picks.push(swingSel.pick);
    picks = picks.filter(function(c){
      return c && c.dir && isFinite(fin(c.entry)) && isFinite(fin(c.stop)) && isFinite(fin(c.t1));
    });
    if (!picks.length) return;
    W.hgFwdRecordScan('GOLDDIRECTION', '1h', picks.map(function(c){
      /* mechanic = source desk + stratKey, so the ledger judges each desk's
         crowned exports separately — fwdMechName is the ONE normalization,
         shared with the proven-set live-paid match (hg-v702) */
      return { sym: 'XAUUSD', dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
               mechanic: fwdMechName(c), ticket: true };
    }), { horizonBars: 24 });
  }catch(eF){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('golddirection', eF); }catch(eW2){} }
}

/* ---------------- scan ---------------- */
/* confirmed (hg-v702): true only after the USER's own CONFIRM & SCAN click
   this session for the currently-armed side; cleared on a side switch and
   never set by warm-up, refresh, or a persisted side from a past session.
   gen (hg-v702 audit fatal closed): a generation counter bumped on EVERY
   side pick — an in-flight scan captures it at start and discards itself
   (no render, no snapshot, no ledger record) when a pick moved it, so a
   mid-flight switch can never be repainted over by the stale scan. */
var __scan = { busy: false, hasRun: false, ui: null, side: null, confirmed: false, gen: 0 };

function setStat(ui, t, warn){
  if (!ui || !ui.stat) return;
  ui.stat.textContent = t;
  ui.stat.className = warn ? 'note warn' : 'note';
}
function setProg(ui, f){
  if (!ui || !ui.prog) return;
  ui.prog.style.display = (f === null) ? 'none' : 'block';
  if (f !== null && ui.prog.firstElementChild) ui.prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
}
var NO_SIDE_HINT = 'no direction selected — pick LONG or SHORT first. The side is YOUR call; this desk never chooses it for you.';

async function runScan(ui, scanSt){
  scanSt = scanSt || __scan;
  if (scanSt.busy) return 'busy';
  var side = scanSt.side || loadSide();
  if (side !== 'long' && side !== 'short'){
    setStat(ui, NO_SIDE_HINT, true);
    return 'skipped: no direction selected';
  }
  /* hg-v702: an armed side is not a confirmed side. The user's own
     CONFIRM & SCAN click this session is the only confirmation — a side
     persisted from a previous session never scans by itself. */
  if (!scanSt.confirmed){
    setStat(ui, 'direction ' + side.toUpperCase() + ' armed but NOT confirmed this session — press CONFIRM & SCAN (a saved side never scans by itself).', true);
    return 'skipped: direction not confirmed this session';
  }
  scanSt.busy = true;
  var t0 = Date.now();
  /* hg-v702 audit fatal closed: capture the side-pick generation at start;
     any pick while this scan is airborne moves it, and the scan then
     discards itself before touching the DOM, the snapshots or the ledger. */
  var genAtStart = (scanSt.gen | 0);
  function sideSwitchedMidScan(){ return (scanSt.gen | 0) !== genAtStart; }
  function discardStat(){
    setStat(ui, 'side switched mid-scan — the ' + side.toUpperCase() + ' scan was discarded unseen; direction '
      + String(scanSt.side || '').toUpperCase() + ' is armed — press CONFIRM & SCAN.', true);
  }
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    if (ui && ui.empty) ui.empty.style.display = 'none';
    setProg(ui, 0.1);
    setStat(ui, 'pulling gold klines 15m/1h/4h/1d…');
    var now = Date.now();
    var gold = await fetchGoldKlines();
    if (sideSwitchedMidScan()){ discardStat(); return 'skipped: side switched mid-scan'; }
    setProg(ui, 0.4);
    if (!gold.rows15m.length && !gold.rows1h.length && !gold.rows4h.length){
      /* feeds failed: nothing fabricated, previous snapshot kept */
      setStat(ui, 'feeds failed — no gold klines from any source (getGoldCandles + PAXGUSDT both quiet) · previous results, if any, stand', true);
      if (ui && ui.empty){
        ui.empty.innerHTML = '<b>WHY SILENT</b> — feeds failed: no gold klines from any source. Nothing is fabricated; re-scan when a feed answers.';
        ui.empty.style.display = 'block';
      }
      setProg(ui, null);
      return 'refreshed';
    }
    setStat(ui, 'polling every gold engine for ' + side.toUpperCase() + ' candidates…');
    var lanes = [];
    try{ lanes.push(await laneGoldScalp(gold, now)); }catch(e1){ lanes.push({ cands: [], held: [], dark: 'GOLD SCALP lane threw: ' + ((e1 && e1.message) || e1) }); }
    try{ lanes.push(laneGoldSwing(gold, now)); }catch(e2){ lanes.push({ cands: [], held: [], dark: 'GOLD SWING lane threw: ' + ((e2 && e2.message) || e2) }); }
    try{ lanes.push(laneOmnigold(gold, now)); }catch(e3){ lanes.push({ cands: [], held: [], dark: 'OMNIGOLD lane threw: ' + ((e3 && e3.message) || e3) }); }
    try{ lanes.push(laneOmnigold1(gold, now)); }catch(e4){ lanes.push({ cands: [], held: [], dark: 'OMNIGOLD 1 lane threw: ' + ((e4 && e4.message) || e4) }); }
    try{ lanes.push(laneNewGold(gold, now)); }catch(e5){ lanes.push({ cands: [], held: [], dark: 'NEW GOLD lane threw: ' + ((e5 && e5.message) || e5) }); }
    /* the scalp lane awaited (post-gate) — re-check the pick generation
       before ANYTHING is rendered, recorded or published */
    if (sideSwitchedMidScan()){ discardStat(); return 'skipped: side switched mid-scan'; }
    setProg(ui, 0.75);
    var all = [], heldAll = [], enginesDark = [], i, j;
    for (i = 0; i < lanes.length; i++){
      var ln = lanes[i];
      if (!ln) continue;
      if (ln.dark) enginesDark.push(ln.dark);
      for (j = 0; j < ln.cands.length; j++) all.push(ln.cands[j]);
      for (j = 0; j < ln.held.length; j++) heldAll.push(ln.held[j]);
    }
    var tape = '';
    try{ tape = deskTapeOf(gold) || ''; }catch(eTp){ tape = ''; }
    /* hg-v702: resolve the proven whitelist from the live sources NOW, so
       the crown site and the snapshot share one resolution per scan */
    var provenSet = [];
    try{ provenSet = buildProvenSet(all); }catch(ePv){ provenSet = []; }
    /* SELECTION — per horizon, fail closed. The chosen side is the user's;
       it is NEVER flipped here, tape agreement or not. */
    var scalpSel = selectHorizon(all, side, 'SCALP', provenSet);
    var swingSel = selectHorizon(all, side, 'SWING', provenSet);

    /* render */
    if (ui && ui.cards){
      var html = '';
      html += '<div class="gdx-confirm' + (side === 'short' ? ' short' : '') + '">Direction confirmed: '
        + esc(side.toUpperCase()) + ' — every setup below is ' + esc(side.toUpperCase()) + '-only.</div>';
      if (tape === 'long' || tape === 'short'){
        html += '<div class="gdx-tape"><b>DESK TAPE</b> — gold\'s own bars read ' + esc(tape.toUpperCase())
          + (tape === side ? ' · with your call' : ' · AGAINST your ' + esc(side.toUpperCase()) + ' call — shown, never flipped') + '</div>';
      } else {
        html += '<div class="gdx-tape"><b>DESK TAPE</b> — unread (mixed or not enough bars); no tape agreement is claimed.</div>';
      }
      var pxScalp = lastClose(gold.rows15m.length ? gold.rows15m : gold.rows1h);
      var pxSwing = lastClose(gold.rows4h.length ? gold.rows4h : gold.rows1h);
      html += horizonHTML(scalpSel, side, 'SCALP', tape, pxScalp, enginesDark);
      html += horizonHTML(swingSel, side, 'SWING', tape, pxSwing, enginesDark);
      var heldScalp = heldAll.filter(function(r){ return r && r.horizon === 'SCALP'; });
      var heldSwing = heldAll.filter(function(r){ return r && r.horizon === 'SWING'; });
      html += heldListHTML(heldScalp, 'SCALP HELD BACK (the desks’ own reasons)');
      html += heldListHTML(heldSwing, 'SWING HELD BACK (the desks’ own reasons)');
      if (enginesDark.length){
        html += '<div class="gdx-dark"><b>ENGINES DARK</b> — ' + enginesDark.map(esc).join(' · ') + '</div>';
      }
      ui.cards.innerHTML = html;
      if (ui.empty) ui.empty.style.display = 'none';
    }

    /* forward ledger — crowned picks only, feature-checked */
    recordForward(scalpSel, swingSel, gold);

    /* publish snapshots */
    publishState(scalpSel, swingSel);
    publishScan(side, scalpSel, swingSel, tape, enginesDark, heldAll, now, provenSet);

    var secs = ((Date.now() - t0) / 1000).toFixed(1);
    var statBits = [side.toUpperCase() + ' scan (confirmed by your click)',
      (all.length + ' candidate' + (all.length === 1 ? '' : 's') + ' from ' + (lanes.length - enginesDark.length) + '/' + lanes.length + ' engines'),
      ('proven set ' + provenSet.length + ' entr' + (provenSet.length === 1 ? 'y' : 'ies')
        + ' · unproven held off the crown: SCALP ' + scalpSel.unproven.length + ' / SWING ' + swingSel.unproven.length),
      'SCALP ' + (scalpSel.pick ? 'pick: ' + scalpSel.pick.source + ' ' + (scalpSel.pick.stratKey || '') : (scalpSel.demotedTop.length ? 'demoted-only (no banner)' : 'silent')),
      'SWING ' + (swingSel.pick ? 'pick: ' + swingSel.pick.source + ' ' + (swingSel.pick.stratKey || '') : (swingSel.demotedTop.length ? 'demoted-only (no banner)' : 'silent'))];
    if (enginesDark.length) statBits.push(enginesDark.length + ' engine' + (enginesDark.length === 1 ? '' : 's') + ' dark');
    statBits.push(secs + 's · ' + new Date().toISOString().slice(11, 19) + ' UTC');
    setStat(ui, statBits.join(' · '), false);
    setProg(ui, null);
    return 'refreshed';
  }catch(e){
    setStat(ui, 'scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    scanSt.busy = false;
    scanSt.hasRun = true;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
    setProg(ui, null);
  }
}

/* ---------------- mount / refresh / warm-up ---------------- */
function applySideUi(ui, side){
  try{
    if (ui.btnLong) ui.btnLong.className = 'gdx-dirbtn long' + (side === 'long' ? ' active' : '');
    if (ui.btnShort) ui.btnShort.className = 'gdx-dirbtn short' + (side === 'short' ? ' active' : '');
    if (ui.btn) ui.btn.disabled = !(side === 'long' || side === 'short');
  }catch(e){}
}
function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<style>' + GD_CSS + '</style>'
      + '<div class="panel">'
      + '<h2>GOLD DIRECTION <span>your call: LONG or SHORT · every gold engine aggregated · best SCALP + best SWING for your side</span></h2>'
      + '<div class="gdx-hint">No strategy measures 100%. Crowned setups come only from strategies that '
      + 'measurably paid after costs in the replays / live ledger; their real records are printed on each card.</div>'
      + '<div class="gdx-dirrow">'
      + '<button class="gdx-dirbtn long" id="gdLong">LONG</button>'
      + '<button class="gdx-dirbtn short" id="gdShort">SHORT</button>'
      + '<button class="btn" id="gdRun">CONFIRM &amp; SCAN</button>'
      + '<span class="note" id="gdStat"></span>'
      + '</div>'
      + '<div class="note" style="margin-top:6px">The direction is <b>your</b> call — this desk never picks or flips it. '
      + 'Picking a side ARMS it; your CONFIRM &amp; SCAN click is the confirmation, and switching sides clears the '
      + 'board until you confirm again (hg-v702). It polls GOLD SCALP, GOLD SWING, OMNIGOLD, OMNIGOLD 1 and NEW GOLD '
      + 'for candidates on your side, crowns ONLY measured-proven strategies (edge-table prefer rows, OMNIGOLD '
      + 'swing-prefer, or a live forward ledger that reads has-paid), holds the v699/v700 lead invariant (a demoted '
      + 'or vetoed card is never crowned; an all-demoted side gets no execution banner), lists every held-back '
      + 'reason, and stamps AGAINST DESK TAPE when gold’s own bars disagree with you.</div>'
      + '<div class="prog" id="gdProg"><i></i></div>'
      + '</div>'
      + '<div class="cards" id="gdCards"></div>'
      + '<div class="empty" id="gdEmpty" style="display:none">pick a side, then CONFIRM &amp; SCAN — nothing is fabricated while the desk is silent.</div>';

    var ui = {
      btn: el.querySelector('#gdRun'),
      btnLong: el.querySelector('#gdLong'),
      btnShort: el.querySelector('#gdShort'),
      stat: el.querySelector('#gdStat'),
      prog: el.querySelector('#gdProg'),
      cards: el.querySelector('#gdCards'),
      empty: el.querySelector('#gdEmpty')
    };
    __scan.ui = ui;
    __scan.side = loadSide();   /* persisted round-trip; default none-selected */
    __scan.confirmed = false;   /* hg-v702: a persisted side is ARMED, never
                                   pre-confirmed — the first scan waits for
                                   the user's own CONFIRM & SCAN click */
    applySideUi(ui, __scan.side);
    if (!__scan.side) setStat(ui, NO_SIDE_HINT, true);
    else setStat(ui, 'direction ' + __scan.side.toUpperCase() + ' (your saved call) — press CONFIRM & SCAN to confirm it this session; a saved side never scans by itself.', false);

    function pickSide(s){
      /* the user's explicit choice — persisted, never auto-flipped.
         hg-v702: picking ARMS the side; switching sides clears the rendered
         board AND the published snapshots (no stale other-side cards or
         picks ever remain) and requires a fresh confirm. */
      var switched = (__scan.side === 'long' || __scan.side === 'short') && __scan.side !== s;
      __scan.side = s;
      saveSide(s);
      __scan.confirmed = false;
      /* hg-v702 audit fatal closed: EVERY pick moves the generation, so an
         airborne scan (confirmed before this click) discards itself instead
         of repainting the board this pick just cleared. */
      __scan.gen = (__scan.gen | 0) + 1;
      if (switched){
        try{ if (ui.cards) ui.cards.innerHTML = ''; }catch(eC){}
        try{ if (ui.empty) ui.empty.style.display = 'block'; }catch(eE){}
        __scanSnap = null;
        __snap = null;
      }
      applySideUi(ui, s);
      setStat(ui, 'Direction armed: ' + s.toUpperCase() + ' — press CONFIRM & SCAN.', false);
    }
    if (ui.btnLong) ui.btnLong.addEventListener('click', function(){ pickSide('long'); });
    if (ui.btnShort) ui.btnShort.addEventListener('click', function(){ pickSide('short'); });
    if (ui.btn) ui.btn.addEventListener('click', function(){
      /* the user's own click on CONFIRM & SCAN IS the confirmation of the
         armed side — nothing else ever sets it */
      if (__scan.side === 'long' || __scan.side === 'short') __scan.confirmed = true;
      return runScan(ui, __scan);
    });

    var missing = [];
    if (!gfn('goldScalpSetups')) missing.push('GOLD SCALP (goldind.js)');
    if (!gfn('goldSwingSetups')) missing.push('GOLD SWING (goldswing.js)');
    if (!gfn('hgOgDetect') || !gfn('hgOgEvaluate') || !gfn('hgOgHorizonCfg')) missing.push('OMNIGOLD (omnigold.js)');
    if (!gfn('hgOg1Engine')) missing.push('OMNIGOLD 1 (omnigold1.js)');
    if (!gfn('ngAssess')) missing.push('NEW GOLD (newgold.js)');
    if (missing.length && ui.cards){
      ui.cards.innerHTML = '<div class="gdx-dark"><b>ENGINES DARK AT MOUNT</b> — ' + missing.map(esc).join(' · ')
        + ' · dark engines contribute nothing and are named on every scan; nothing is fabricated in their place.</div>';
    }
  }catch(e){ /* never throw at mount */ }
}

function __gdWarmShim(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           querySelector: function(){ return null; } };
}
async function goldDirectionRefresh(){
  try{
    if (__scan.busy) return 'busy';
    if (!__scan.hasRun) return 'skipped: not run yet';
    var ui = __scan.ui;
    if (!ui){
      ui = { btn: __gdWarmShim(), stat: __gdWarmShim(), prog: __gdWarmShim(),
             cards: __gdWarmShim(), empty: __gdWarmShim() };
    }
    return await runScan(ui, __scan);
  }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
}
async function gdWarm(){
  try{
    if (W.goldDirectionScan && W.goldDirectionScan()) return 'fresh';
  }catch(e0){}
  if (__scan.busy) return 'busy';
  var side = __scan.side || loadSide();
  if (side !== 'long' && side !== 'short'){
    return 'unavailable: no direction selected — LONG/SHORT is the user’s call; the tab never picks one to warm itself';
  }
  /* hg-v702: a persisted side is armed, not confirmed. The confirmation is
     the user's own CONFIRM & SCAN click this session — warm-up never
     confirms on their behalf. */
  if (!__scan.confirmed){
    return 'unavailable: direction not confirmed this session — CONFIRM & SCAN is the user’s click; the tab never confirms for itself';
  }
  if (!gfn('getGoldCandles') && !gfn('binanceKlines')) return 'unavailable: gold klines layer not loaded';
  var stubUi = { btn: __gdWarmShim(), stat: __gdWarmShim(), prog: __gdWarmShim(),
                 cards: __gdWarmShim(), empty: __gdWarmShim() };
  await runScan(stubUi, __scan);
  return (W.goldDirectionScan && W.goldDirectionScan()) ? 'warmed'
       : 'unavailable: scan did not complete (no gold klines from any source)';
}

/* ---------------- registration ---------------- */
W.goldDirectionState = function(){
  try{ return __snap ? __stateView(__snap) : null; }catch(e){ return null; }
};
W.goldDirectionScan = function(){
  try{ return __scanSnap ? __stateView(__scanSnap) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'GOLD DIRECTION', mount: mount, refresh: goldDirectionRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'GOLD DIRECTION', run: gdWarm });
})();
