/* =========================================================================
HARDGATE — signallog.js
SIGNAL LOG tab: a persistent signal journal that logs while the app is open.
Every 5 minutes (a single guarded setInterval, started once) AND on each
refresh() call, one snapshot round reads every currently-available signal
source and appends what it finds to a localStorage-backed ledger
('hgSignalLog', JSON array, newest first, hard-capped at 500 entries — the
oldest drop off). Nothing is fabricated: a source that is absent, throws, or
returns null records NOTHING for that round, and the header line says so
plainly ('sources live: scalp, swing · waiting: brain').

SOURCES (feature-checked with typeof, each wrapped in its own try/catch):
  1) window.__hgBrainLast()  -> brain synthesis rows (sym, dir, tier,
     evidence count, plan entry/stop/t1 when present) — tierOrGrade = tier,
     note = first evidence string, else 'N layers agree'.
  2) window.goldscalpScan()  -> scalp setups (cands: sym, dir, grade,
     strategy, entry/stop/t1) — tierOrGrade = grade, note = strategy.
  3) window.goldswingScan()  -> swing setups, likewise.
Result containers are read defensively (a bare array, or .cands / .rows /
.results / .cards / .setups — whichever is an array first). Rows without a
usable sym or a long/short direction are skipped: the journal logs
directional signals only.

ENTRY SHAPE (one object per logged signal):
  { t (ISO string), source ('brain'|'scalp'|'swing'), sym, dir
    ('long'|'short'), tierOrGrade, entry, stop, t1, note }
De-dup within a snapshot round: the same source+sym+dir logs once per round.

PERSISTENCE: localStorage 'hgSignalLog', probed softly (memory-only when
localStorage is absent or throws). Corrupt/unparseable stored JSON -> start
fresh, note 'journal reset (corrupt)' once in the UI header, never crash.
Junk rows inside an otherwise-valid array are dropped on load.

UI: a ledger table (time, source badge, symbol, LONG/SHORT colored,
tier/grade, entry, stop, TP1, note), newest first, plus a CLEAR JOURNAL
button that wipes 'hgSignalLog' and re-renders. The header states honestly:
'logs while the app is open · every 5 min + on refresh'.

TEST/DIAGNOSTIC SURFACE (never throws):
  window.signallogSnapshot() -> performs one snapshot round, returns the
    count of entries added (0 when every source is dark).
  window.signallogEntries()  -> deep-frozen copy of the journal, newest
    first ([] when empty).

Classic script, no build step, loads after the modules it reads; absence of
any module degrades honestly. Registers via
  window.HG_tabs.push({id:'signallog', label:'SIGNAL LOG', mount, refresh})
refresh(): async, never throws, 'refreshed' | 'error: …' — every refresh
performs one snapshot round.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var LS_KEY = 'hgSignalLog';
var MAX_ENTRIES = 500;
var INTERVAL_MS = 5*60*1000;             /* every 5 min */
var SOURCES = ['brain', 'scalp', 'swing', 'supergold'];

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtP(n){
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
  var a = Math.abs(n);
  var d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  return null;
}
function numOrNull(v){
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}
function normDir(d){
  var s = String(d === null || d === undefined ? '' : d).toLowerCase();
  return (s === 'long' || s === 'short') ? s : null;
}
function fmtTime(t){
  var s = String(t || '');
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? (m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ' UTC') : s;
}

/* ---------------- storage (soft probes, never throw) ---------------- */
function __lsRead(){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage.getItem(LS_KEY);
  }catch(e){ return null; }
}
function __lsWrite(s){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(LS_KEY, s);
  }catch(e){}
}
function __lsWipe(){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.removeItem(LS_KEY);
  }catch(e){}
}

/* ---------------- journal state ---------------- */
var __corrupt = false;                   /* stored JSON unreadable -> noted once in the UI */
var __journal = loadJournal();
var __live = { brain: false, scalp: false, swing: false, supergold: false };
var __snapshotted = false;
var __timer = null;                      /* setInterval handle — started once, guarded */
var __ui = null;                         /* mounted pane elements, null before mount */

function normEntry(e){
  if (!e || typeof e !== 'object') return null;
  var dir = normDir(e.dir);
  if (!dir || !e.sym) return null;
  var src = String(e.source || '');
  if (src !== 'brain' && src !== 'scalp' && src !== 'swing' && src !== 'supergold') return null;
  return {
    t: (typeof e.t === 'string' && e.t) ? e.t : '',
    source: src,
    sym: String(e.sym),
    dir: dir,
    tierOrGrade: (e.tierOrGrade === null || e.tierOrGrade === undefined) ? null : String(e.tierOrGrade),
    entry: numOrNull(e.entry),
    stop: numOrNull(e.stop),
    t1: numOrNull(e.t1),
    note: (e.note === null || e.note === undefined) ? '' : String(e.note).slice(0, 140)
  };
}
function loadJournal(){
  try{
    var raw = __lsRead();
    if (!raw) return [];
    var j = JSON.parse(raw);
    if (!Array.isArray(j)){ __corrupt = true; return []; }
    var out = [];
    for (var i = 0; i < j.length; i++){
      var e = normEntry(j[i]);
      if (e) out.push(e);
      if (out.length >= MAX_ENTRIES) break;
    }
    return out;
  }catch(e){ __corrupt = true; return []; }
}
function saveJournal(){
  try{ __lsWrite(JSON.stringify(__journal)); }catch(e){}
}

/* ---------------- source pullers (each catch-isolated) ---------------- */
function rowsFrom(val){
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object'){
    var keys = ['cands', 'rows', 'results', 'cards', 'setups'];
    for (var i = 0; i < keys.length; i++){
      if (Array.isArray(val[keys[i]])) return val[keys[i]];
    }
  }
  return [];
}
function firstEvidence(r){
  try{
    if (Array.isArray(r.evidence) && r.evidence.length && typeof r.evidence[0] === 'string' && r.evidence[0])
      return r.evidence[0];
    if (typeof r.why === 'string' && r.why) return r.why;
    var n = null;
    if (isFinite(r.agree)) n = r.agree;
    else if (isFinite(r.evidenceCount)) n = r.evidenceCount;
    else if (Array.isArray(r.layers) && r.layers.length) n = r.layers.length;
    else if (Array.isArray(r.evidence) && r.evidence.length) n = r.evidence.length;
    if (n !== null) return n + ' layer' + (n === 1 ? '' : 's') + ' agree';
  }catch(e){}
  return '';
}

/* brain: window.__hgBrainLast() -> synthesis rows (sym, dir, tier, evidence
   count, plan entry/stop/t1 when present). tierOrGrade = tier. */
function pullBrain(){
  var fn = null;
  try{ if (typeof W.__hgBrainLast === 'function') fn = W.__hgBrainLast; }catch(e){}
  if (!fn) return { live: false, rows: [] };
  var val = null;
  try{ val = fn(); }catch(e){ return { live: false, rows: [] }; }
  if (val === null || val === undefined) return { live: false, rows: [] };
  var rows = rowsFrom(val), out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || typeof r !== 'object') continue;
    var dir = normDir(r.dir);
    var sym = r.sym || r.symbol;
    if (!dir || !sym) continue;
    var plan = (r.plan && typeof r.plan === 'object') ? r.plan : r;
    out.push({
      sym: String(sym), dir: dir,
      tierOrGrade: (r.tier !== null && r.tier !== undefined) ? r.tier : r.grade,
      entry: plan.entry, stop: plan.stop, t1: plan.t1,
      note: firstEvidence(r)
    });
  }
  return { live: true, rows: out };
}

/* scalp/swing: window.goldscalpScan() / window.goldswingScan() ->
   {cands:[{sym, dir, grade, strategy, entry, stop, t1}]}. tierOrGrade = grade. */
function pullScan(fnName){
  var fn = gfn(fnName);
  if (!fn) return { live: false, rows: [] };
  var val = null;
  try{ val = fn(); }catch(e){ return { live: false, rows: [] }; }
  if (val === null || val === undefined) return { live: false, rows: [] };
  var rows = rowsFrom(val), out = [];
  for (var i = 0; i < rows.length; i++){
    var c = rows[i];
    if (!c || typeof c !== 'object') continue;
    var dir = normDir(c.dir);
    var sym = c.sym || c.symbol || c.venue;
    if (!dir || !sym) continue;
    out.push({
      sym: String(sym), dir: dir,
      tierOrGrade: (c.grade !== null && c.grade !== undefined) ? c.grade : c.tier,
      entry: c.entry, stop: c.stop, t1: c.t1,
      note: c.strategy || c.stratKey || ''
    });
  }
  return { live: true, rows: out };
}

/* super-gold: window.superGoldScan() -> enriched desk rows. */
function pullSuperGold(){
  var fn = gfn('superGoldScan');
  if (!fn) return { live: false, rows: [] };
  var val = null;
  try{ val = fn(); }catch(e){ return { live: false, rows: [] }; }
  if (val === null || val === undefined) return { live: false, rows: [] };
  var rows = rowsFrom(val), out = [];
  for (var i = 0; i < rows.length; i++){
    var c = rows[i];
    if (!c || typeof c !== 'object') continue;
    var dir = normDir(c.dir);
    var sym = c.sym || c.symbol || 'XAUUSD';
    if (!dir || !sym) continue;
    var note = c.strategy || c.scanner || '';
    if (c.minimalLossPass) note = (note ? note + ' · ' : '') + 'GRADE A PASS';
    else if (c.goldAudit && c.goldAudit.reasons && c.goldAudit.reasons.length){
      note = (note ? note + ' · ' : '') + c.goldAudit.reasons[0];
    }
    out.push({
      sym: String(sym), dir: dir,
      tierOrGrade: c.grade || (c.tier === 'clean' ? 'A' : 'B'),
      entry: c.entry, stop: c.stop, t1: c.t1 || c.tp,
      note: note
    });
  }
  return { live: true, rows: out };
}

/* ---------------- snapshot round ---------------- */
function snapshotRound(){
  var added = 0;
  try{
    var iso = '';
    try{ iso = new Date().toISOString(); }catch(eD){ iso = ''; }
    var pulls = [pullBrain(), pullScan('goldscalpScan'), pullScan('goldswingScan'), pullSuperGold()];
    var seen = {}, fresh = [];
    for (var s = 0; s < SOURCES.length; s++){
      __live[SOURCES[s]] = !!pulls[s].live;
      var rows = pulls[s].rows;
      for (var i = 0; i < rows.length; i++){
        var r = rows[i];
        var key = SOURCES[s] + '|' + r.sym + '|' + r.dir;   /* de-dup within the round */
        if (seen[key]) continue;
        seen[key] = 1;
        fresh.push({
          t: iso, source: SOURCES[s], sym: r.sym, dir: r.dir,
          tierOrGrade: (r.tierOrGrade === null || r.tierOrGrade === undefined) ? null : String(r.tierOrGrade),
          entry: numOrNull(r.entry), stop: numOrNull(r.stop), t1: numOrNull(r.t1),
          note: String(r.note || '').slice(0, 140)
        });
      }
    }
    if (fresh.length){
      __journal = fresh.concat(__journal);                  /* newest first */
      if (__journal.length > MAX_ENTRIES) __journal = __journal.slice(0, MAX_ENTRIES);   /* hard cap: drop oldest */
      saveJournal();
      added = fresh.length;
    }
    __snapshotted = true;
  }catch(e){ /* a snapshot round never throws */ }
  render();
  return added;
}

/* ---------------- renderers ---------------- */
function sourcesLine(){
  if (!__snapshotted) return 'sources: awaiting first snapshot';
  var live = [], wait = [];
  for (var i = 0; i < SOURCES.length; i++){
    if (__live[SOURCES[i]]) live.push(SOURCES[i]); else wait.push(SOURCES[i]);
  }
  var s = live.length ? ('sources live: ' + live.join(', ')) : 'sources live: none';
  if (wait.length) s += ' · waiting: ' + wait.join(', ');
  return s;
}

function tableHTML(j){
  var rows = [];
  for (var i = 0; i < j.length; i++){
    var e = j[i];
    if (!e) continue;
    rows.push('<tr>'
      + '<td class="sl-t">' + esc(fmtTime(e.t)) + '</td>'
      + '<td><span class="sl-badge ' + esc(e.source) + '">' + esc(e.source.toUpperCase()) + '</span></td>'
      + '<td class="sl-sym">' + esc(e.sym) + '</td>'
      + '<td><span class="sl-dir ' + esc(e.dir) + '">' + esc(e.dir.toUpperCase()) + '</span></td>'
      + '<td class="sl-tg">' + esc(e.tierOrGrade === null ? '—' : e.tierOrGrade) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.entry)) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.stop)) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.t1)) + '</td>'
      + '<td class="sl-note">' + esc(e.note || '—') + '</td>'
      + '</tr>');
  }
  return '<table class="sl-table"><thead><tr>'
    + '<th>TIME</th><th>SOURCE</th><th>SYMBOL</th><th>DIR</th><th>TIER/GRADE</th>'
    + '<th>ENTRY</th><th>STOP</th><th>TP1</th><th>NOTE</th>'
    + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}

function render(){
  var ui = __ui;
  if (!ui) return;
  try{
    if (ui.sources) ui.sources.textContent = sourcesLine();
    if (ui.count) ui.count.textContent = __journal.length + ' / ' + MAX_ENTRIES + ' entries · newest first';
    if (ui.corrupt) ui.corrupt.style.display = __corrupt ? 'block' : 'none';
    if (!__journal.length){
      if (ui.body) ui.body.innerHTML = '';
      if (ui.empty) ui.empty.style.display = 'block';
    } else {
      if (ui.empty) ui.empty.style.display = 'none';
      if (ui.body) ui.body.innerHTML = tableHTML(__journal);
    }
  }catch(e){ /* rendering never breaks the journal */ }
}

function setStat(t){
  try{ if (__ui && __ui.stat) __ui.stat.textContent = t; }catch(e){}
}

function clearJournal(){
  try{
    __journal = [];
    __corrupt = false;
    __lsWipe();
    setStat('journal cleared — logging continues on the next snapshot.');
    render();
  }catch(e){}
}

/* ---------------- pane-scoped styles (injected from here ONLY) ---------------- */
var SL_CSS = ''
+ '#tab_signallog .sl-wrap{overflow-x:auto;margin-top:14px}'
+ '#tab_signallog table.sl-table{width:100%;border-collapse:collapse;font-size:11px}'
+ '#tab_signallog .sl-table th{font-size:9px;letter-spacing:.18em;color:var(--mut,#8a8f98);text-align:left;'
+ 'padding:6px 8px;border-bottom:1px solid var(--line,#2a2e35);white-space:nowrap}'
+ '#tab_signallog .sl-table td{padding:6px 8px;border-bottom:1px solid rgba(42,46,53,.5);vertical-align:top;white-space:nowrap}'
+ '#tab_signallog .sl-table tbody tr:hover{background:rgba(255,255,255,.02)}'
+ '#tab_signallog .sl-t{color:var(--mut,#8a8f98);font-size:10px}'
+ '#tab_signallog .sl-sym{font-weight:700;letter-spacing:.04em}'
+ '#tab_signallog .sl-badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:9px;'
+ 'letter-spacing:.12em;font-weight:700;border:1px solid}'
+ '#tab_signallog .sl-badge.brain{color:#b48cff;border-color:rgba(180,140,255,.45);background:rgba(180,140,255,.08)}'
+ '#tab_signallog .sl-badge.scalp{color:#ffd76a;border-color:rgba(255,215,106,.45);background:rgba(255,215,106,.07)}'
+ '#tab_signallog .sl-badge.swing{color:#4ac3ff;border-color:rgba(74,195,255,.45);background:rgba(74,195,255,.07)}'
+ '#tab_signallog .sl-badge.supergold{color:#b8860b;border-color:rgba(184,134,11,.45);background:rgba(184,134,11,.08)}'
+ '#tab_signallog .sl-dir{font-weight:800;letter-spacing:.08em;font-size:10px}'
+ '#tab_signallog .sl-dir.long{color:#19e3a2}'
+ '#tab_signallog .sl-dir.short{color:#ff6b4a}'
+ '#tab_signallog .sl-tg{font-weight:700;color:var(--txt,#d7dbe0)}'
+ '#tab_signallog .sl-n{font-variant-numeric:tabular-nums}'
+ '#tab_signallog .sl-note{color:var(--mut,#8a8f98);max-width:280px;overflow:hidden;'
+ 'text-overflow:ellipsis;white-space:nowrap}';

/* ---------------- mount / refresh ---------------- */
function mount(el){
  if (!el) return;
  try{
    el.innerHTML =
      '<style>' + SL_CSS + '</style>'
      + '<div class="panel">'
      + '<h2>SIGNAL LOG <span>persistent journal of brain + scalp + swing signals · newest first · capped at 500</span></h2>'
      + '<div class="row"><button class="btn" id="slClear">CLEAR JOURNAL</button>'
      + '<span class="note" id="slStat">journal ready — snapshots run every 5 min and on refresh.</span></div>'
      + '<div class="note" style="margin-top:8px"><b>logs while the app is open · every 5 min + on refresh</b>'
      + ' · <span id="slCount"></span></div>'
      + '<div class="note" id="slSources" style="margin-top:4px">sources: awaiting first snapshot</div>'
      + '<div class="note warn" id="slCorrupt" style="display:none;margin-top:4px">journal reset (corrupt) — stored data was unreadable, started fresh.</div>'
      + '</div>'
      + '<div class="sl-wrap" id="slBody"></div>'
      + '<div class="empty" id="slEmpty" style="display:none">no signals logged yet — the journal fills while the app '
      + 'is open (every 5 min + on refresh) whenever BRAIN, GOLD SCALP or GOLD SWING have live results.</div>';

    __ui = {
      clear:   el.querySelector('#slClear'),
      stat:    el.querySelector('#slStat'),
      count:   el.querySelector('#slCount'),
      sources: el.querySelector('#slSources'),
      corrupt: el.querySelector('#slCorrupt'),
      body:    el.querySelector('#slBody'),
      empty:   el.querySelector('#slEmpty')
    };
    if (__ui.clear) __ui.clear.addEventListener('click', function(){ clearJournal(); });
    ensureTimer();
    if (!__snapshotted) snapshotRound();   /* first open this session -> an immediate honest sources line */
    render();
  }catch(e){ /* never throw at mount */ }
}

async function signallogRefresh(){
  try{
    snapshotRound();
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

/* ---------------- interval (started once, guarded) ---------------- */
function ensureTimer(){
  if (__timer !== null) return;
  try{
    if (typeof setInterval !== 'function') return;
    var iv = setInterval(function(){
      try{ snapshotRound(); }catch(e){}
    }, INTERVAL_MS);
    __timer = iv;
    try{ if (iv && typeof iv.unref === 'function') iv.unref(); }catch(e2){}   /* never hold a Node process open */
  }catch(e){}
}

/* ---------------- deep-frozen copies (diagnostic surface) ---------------- */
function frozenView(v){
  if (v === null || typeof v !== 'object') return v;
  var out = Array.isArray(v) ? [] : {};
  for (var k in v){
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    out[k] = frozenView(v[k]);
  }
  Object.freeze(out);
  return out;
}

/* ---------------- registration ---------------- */
W.signallogSnapshot = function(){
  try{ return snapshotRound(); }catch(e){ return 0; }
};
W.signallogEntries = function(){
  try{ return frozenView(__journal); }catch(e){ return []; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'signallog', label: 'SIGNAL LOG', mount: mount, refresh: signallogRefresh });
ensureTimer();
})();
