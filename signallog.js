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
    ('long'|'short'), tierOrGrade, entry, stop, t1, maeR, mfeR, note }
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
var LS_FILTERS_KEY = 'hgSignalLogFilters';   /* v655: persist filter chip state */
var MAX_ENTRIES = 500;
var INTERVAL_MS = 5*60*1000;             /* every 5 min */
/* v646 — crypto SWING/SCALP were missing from the source list.
   v648 — crypto goes FIRST so brain's 200-row batch (per-round cap below)
   can't outrun the interesting rows when the 500-cap kicks in. */
var SOURCES = ['cswing', 'cscalp', 'scalp', 'swing', 'supergold', 'brain'];

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

/* v655: filter-state persistence. Independent key so a corrupt filter
   blob can never corrupt the journal (and vice-versa). Set is serialised
   as an array so JSON survives round-trip; empty array → sources cleared
   (ALL active). Any read failure silently falls back to defaults. */
function __lsReadFilters(){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    var s = localStorage.getItem(LS_FILTERS_KEY);
    if (!s) return null;
    var o = JSON.parse(s);
    if (!o || typeof o !== 'object') return null;
    return o;
  }catch(e){ return null; }
}
function __lsWriteFilters(f){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    var out = {
      sources: (f && f.sources && f.sources.size) ? Array.from(f.sources) : null,
      dir: (f && f.dir) ? f.dir : 'all',
      q: (f && typeof f.q === 'string') ? f.q : ''
    };
    localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(out));
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
  /* v653: keep the allowlist in sync with SOURCES. Missing cswing/cscalp
     here meant persisted crypto rows were dropped on the next load. */
  var ALLOWED = { brain:1, cswing:1, cscalp:1, scalp:1, swing:1, supergold:1 };
  if (!ALLOWED[src]) return null;
  /* v653: rehydrate compact gateMeta (id/label/state only) if present */
  var gm = null;
  if (Array.isArray(e.gateMeta) && e.gateMeta.length){
    gm = e.gateMeta.map(function(g){
      if (!g || typeof g !== 'object') return null;
      var st = String(g.state || 'na');
      if (st !== 'pass' && st !== 'veto' && st !== 'na') st = 'na';
      return { id: String(g.id || ''), label: String(g.label || g.id || ''), state: st };
    }).filter(function(g){ return g && g.id; });
    if (!gm.length) gm = null;
  }
  return {
    t: (typeof e.t === 'string' && e.t) ? e.t : '',
    source: src,
    sym: String(e.sym),
    dir: dir,
    tierOrGrade: (e.tierOrGrade === null || e.tierOrGrade === undefined) ? null : String(e.tierOrGrade),
    entry: numOrNull(e.entry),
    stop: numOrNull(e.stop),
    t1: numOrNull(e.t1),
    maeR: numOrNull(e.maeR),
    mfeR: numOrNull(e.mfeR),
    note: (e.note === null || e.note === undefined) ? '' : String(e.note).slice(0, 140),
    gateMeta: gm
  };
}
function hydrateMfeMae(entry){
  try{
    if (!entry || !entry.sym || !entry.dir) return entry;
    if (entry.maeR !== null && entry.mfeR !== null) return entry;
    var recs = (typeof W.hgScoreRecords === 'function') ? W.hgScoreRecords() : [];
    if (!Array.isArray(recs) || !recs.length) return entry;
    var sym = String(entry.sym).toUpperCase();
    var dir = String(entry.dir).toLowerCase();
    for (var i = 0; i < recs.length; i++){
      var r = recs[i];
      if (!r) continue;
      var rs = String(r.sym || r.symbol || '').toUpperCase();
      var rd = String(r.dir || r.side || '').toLowerCase();
      if (rs === sym && rd === dir){
        if (entry.maeR === null && r.maeR != null) entry.maeR = numOrNull(r.maeR);
        if (entry.mfeR === null && r.mfeR != null) entry.mfeR = numOrNull(r.mfeR);
        break;
      }
    }
  }catch(e){}
  return entry;
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
    /* v647: merge cands + nearCands so NEAR (6/7) crypto rows also enter the
       log. NEAR rows are exactly where gate summaries are most useful — they
       show which single gate is blocking ("6/7 · blocked: vol+wick"). Without
       this, in most market conditions (0 CLEAN, many NEAR) the log stays
       100% BRAIN and Pack 2's whole point is invisible. */
    var out = [];
    if (Array.isArray(val.cands)) out = out.concat(val.cands);
    if (Array.isArray(val.nearCands)) out = out.concat(val.nearCands);
    if (out.length) return out;
    var keys = ['rows', 'results', 'cards', 'setups'];
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

/* PACK 2 slice 4 — gate summary consumer.
   Reads a gateMeta[] array (as published by hgGateResult in slices 1-3)
   and returns a compact string like "7/7 pass" or
   "5/7 · blocked: G2 sweep/reclaim, G6 vol+wick commit". Returns '' when
   input is not a gateMeta array so callers can concatenate safely. */
function gateSummary(meta){
  try{
    if (!Array.isArray(meta) || !meta.length) return '';
    /* v662: pair the total count with the pass loop — same bug pattern v661
       fixed in hgGateLedgerBadge. Prior to v662, total = meta.length would
       overcount when meta had null / non-object entries (the loop skipped
       them for pass/veto classification, so a shape like
       [{pass},{pass},null] produced '2/3 blocked: ...' with a phantom third
       slot the user has no way to inspect). */
    var pass = 0, total = 0, blocked = [];
    for (var i = 0; i < meta.length; i++){
      var g = meta[i];
      if (!g || typeof g !== 'object') continue;
      total++;
      if (g.state === 'pass') pass++;
      else if (g.state === 'veto'){
        var lbl = (typeof g.label === 'string' && g.label) ? g.label : (g.id || '?');
        /* strip 'G1 ' / 'EG1 ' style prefixes so the block reason reads short */
        blocked.push(lbl.replace(/^E?G\d+\s+/, ''));
      }
    }
    if (!total) return '';
    var head = pass + '/' + total + (pass === total ? ' pass' : '');
    if (!blocked.length) return head;
    /* Trim: keep the first two block reasons — note column is width-capped. */
    var top = blocked.slice(0, 2).join(', ');
    var more = blocked.length > 2 ? (' +' + (blocked.length - 2)) : '';
    return head + ' · blocked: ' + top + more;
  }catch(e){ return ''; }
}

/* PACK 2 slice 4 — EDGE veto surfacing.
   edge.js edgeSwingBias() returns null on veto but stashes the block
   reason on the function itself. Read that and format a short note. */
function edgeVetoNote(){
  try{
    var fn = null;
    try{ if (typeof W.edgeSwingBias === 'function') fn = W.edgeSwingBias; }catch(e){}
    if (!fn || !fn.lastVetoBlockedBy) return '';
    return 'EDGE blocked at ' + fn.lastVetoBlockedBy;
  }catch(e){ return ''; }
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
    /* PACK 2 slice 4: prepend gate summary to note when gateMeta is present */
    var gs = gateSummary(r.gateMeta || (plan && plan.gateMeta));
    var baseNote = firstEvidence(r);
    var note = gs ? (baseNote ? (gs + ' · ' + baseNote) : gs) : baseNote;
    out.push({
      sym: String(sym), dir: dir,
      tierOrGrade: (r.tier !== null && r.tier !== undefined) ? r.tier : r.grade,
      entry: plan.entry, stop: plan.stop, t1: plan.t1,
      note: note,
      /* v653: pass gateMeta through so the log row can render the badge */
      gateMeta: r.gateMeta || (plan && plan.gateMeta)
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
    /* PACK 2 slice 4: prepend gate summary to note when gateMeta is present */
    var gs = gateSummary(c.gateMeta);
    var baseNote = c.strategy || c.stratKey || '';
    var note = gs ? (baseNote ? (gs + ' · ' + baseNote) : gs) : baseNote;
    out.push({
      sym: String(sym), dir: dir,
      tierOrGrade: (c.grade !== null && c.grade !== undefined) ? c.grade : c.tier,
      entry: c.entry, stop: c.stop, t1: c.t1,
      note: note,
      /* v653: pass gateMeta through so the log row can render the badge */
      gateMeta: c.gateMeta
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
    var pulls = [pullScan('swingScan'),   /* cswing — v646: crypto SWING */
                 pullScan('scalpScan'),   /* cscalp — v646: crypto SCALP */
                 pullScan('goldscalpScan'),
                 pullScan('goldswingScan'),
                 pullSuperGold(),
                 pullBrain()];             /* brain last so its cap runs after crypto */
    /* v648: per-source cap so no single source (looking at you, BRAIN with
       500 identical rows per snapshot) can monopolize the log and knock out
       every crypto SWING/SCALP entry with a gate summary. Brain gets 200
       slots per round; other sources unbounded (they typically emit ≤10
       rows per scan). */
    var PER_ROUND_CAP = { brain: 200 };
    var seen = {}, fresh = [], srcCount = {};
    for (var s = 0; s < SOURCES.length; s++){
      __live[SOURCES[s]] = !!pulls[s].live;
      var rows = pulls[s].rows;
      var cap = PER_ROUND_CAP[SOURCES[s]] || Infinity;
      srcCount[SOURCES[s]] = 0;
      for (var i = 0; i < rows.length; i++){
        if (srcCount[SOURCES[s]] >= cap) break;
        var r = rows[i];
        var key = SOURCES[s] + '|' + r.sym + '|' + r.dir;   /* de-dup within the round */
        if (seen[key]) continue;
        seen[key] = 1;
        /* v653: compact gateMeta — keep id/label/state only so the persisted
           journal doesn't bloat with detail strings. Detail is only useful
           on live cards (hover tooltip); log rows show state via the dot. */
        var gm = null;
        if (Array.isArray(r.gateMeta) && r.gateMeta.length){
          gm = r.gateMeta.map(function(g){
            if (!g || typeof g !== 'object') return null;
            return {
              id: String(g.id || ''),
              label: String(g.label || g.id || ''),
              state: String(g.state || 'na')
            };
          }).filter(function(g){ return g && g.id; });
        }
        fresh.push(hydrateMfeMae({
          t: iso, source: SOURCES[s], sym: r.sym, dir: r.dir,
          tierOrGrade: (r.tierOrGrade === null || r.tierOrGrade === undefined) ? null : String(r.tierOrGrade),
          entry: numOrNull(r.entry), stop: numOrNull(r.stop), t1: numOrNull(r.t1),
          maeR: numOrNull(r.maeR), mfeR: numOrNull(r.mfeR),
          note: String(r.note || '').slice(0, 140),
          gateMeta: gm
        }));
        srcCount[SOURCES[s]]++;
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
  /* v653: render the gate ledger badge inline when the row carries gateMeta.
     Uses the same W.hgGateLedgerBadge shipped in v650/v651/v652 so log rows
     look identical to scan cards. Note text stays as a fallback / suffix. */
  var badgeFn = (typeof W !== 'undefined' && typeof W.hgGateLedgerBadge === 'function')
    ? W.hgGateLedgerBadge : null;
  for (var i = 0; i < j.length; i++){
    var e = j[i];
    if (!e) continue;
    var badge = (badgeFn && Array.isArray(e.gateMeta) && e.gateMeta.length)
      ? badgeFn(e.gateMeta) : '';
    var noteCell;
    if (badge){
      /* strip the leading "N/M · blocked: …" summary from the note when we
         already show it as a badge (avoids duplicate info); keep any trailing
         detail after the first " · ". */
      var rawNote = String(e.note || '');
      var trimmed = rawNote.replace(/^\d+\/\d+(?:\s+pass)?(?:\s+\u00b7\s+blocked:[^\u00b7]*?(?:\s+\+\d+)?)?\s*(?:\u00b7\s+)?/, '');
      noteCell = badge + (trimmed ? ' <span class="sl-note-suffix">' + esc(trimmed) + '</span>' : '');
    } else {
      noteCell = esc(e.note || '—');
    }
    rows.push('<tr>'
      + '<td class="sl-t">' + esc(fmtTime(e.t)) + '</td>'
      + '<td><span class="sl-badge ' + esc(e.source) + '">' + esc(e.source.toUpperCase()) + '</span></td>'
      + '<td class="sl-sym">' + esc(e.sym) + '</td>'
      + '<td><span class="sl-dir ' + esc(e.dir) + '">' + esc(e.dir.toUpperCase()) + '</span></td>'
      + '<td class="sl-tg">' + esc(e.tierOrGrade === null ? '—' : e.tierOrGrade) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.entry)) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.stop)) + '</td>'
      + '<td class="sl-n">' + esc(fmtP(e.t1)) + '</td>'
      + '<td class="sl-n">' + esc(e.maeR !== null ? fmtP(e.maeR) + 'R' : '—') + '</td>'
      + '<td class="sl-n">' + esc(e.mfeR !== null ? fmtP(e.mfeR) + 'R' : '—') + '</td>'
      + '<td class="sl-note">' + noteCell + '</td>'
      + '</tr>');
  }
  return '<table class="sl-table"><thead><tr>'
    + '<th>TIME</th><th>SOURCE</th><th>SYMBOL</th><th>DIR</th><th>TIER/GRADE</th>'
    + '<th>ENTRY</th><th>STOP</th><th>TP1</th><th>MAE</th><th>MFE</th><th>GATES</th>'
    + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}

function render(){
  var ui = __ui;
  if (!ui) return;
  try{
    /* v654: apply source/direction/query filters before render. The count
       chip shows filtered/total so the user always knows how much the
       filter is hiding. */
    var filtered = applyFilters(__journal);
    if (ui.sources) ui.sources.textContent = sourcesLine();
    if (ui.count){
      var lbl = __journal.length + ' / ' + MAX_ENTRIES + ' entries · newest first';
      if (filtered.length !== __journal.length){
        lbl = filtered.length + ' shown of ' + __journal.length + ' · ' + lbl;
      }
      ui.count.textContent = lbl;
    }
    /* v657: summary stats over the filtered set. Hidden when empty so we
       don't render a stat strip above an empty table. */
    if (ui.stats){
      var line = statsLine(filtered);
      if (line){
        ui.stats.textContent = line;
        ui.stats.style.display = '';
      } else {
        ui.stats.textContent = '';
        ui.stats.style.display = 'none';
      }
    }
    if (ui.corrupt) ui.corrupt.style.display = __corrupt ? 'block' : 'none';
    if (!__journal.length){
      if (ui.body) ui.body.innerHTML = '';
      if (ui.empty){
        ui.empty.style.display = 'block';
        /* v659: empty-state text was stuck at 'BRAIN, GOLD SCALP or GOLD SWING'
           since v646. Rebuild from SOURCES so it names every active source. */
        ui.empty.textContent = 'no signals logged yet — the journal fills while the app '
          + 'is open (every 5 min + on refresh) whenever any of these sources have '
          + 'live results: ' + SOURCES.map(function(s){ return s.toUpperCase(); }).join(', ') + '.';
      }
    } else if (!filtered.length){
      /* journal has rows but current filter matches none — keep the table
         area empty and show a distinct "no matches" message via #slEmpty. */
      if (ui.body) ui.body.innerHTML = '';
      if (ui.empty){
        ui.empty.style.display = 'block';
        ui.empty.textContent = 'no rows match the current filter — try widening the source chips, '
          + 'switching direction to ALL, or clearing the symbol search.';
      }
    } else {
      if (ui.empty) ui.empty.style.display = 'none';
      if (ui.body) ui.body.innerHTML = tableHTML(filtered);
    }
  }catch(e){ /* rendering never breaks the journal */ }
}

function setStat(t){
  try{ if (__ui && __ui.stat) __ui.stat.textContent = t; }catch(e){}
}

/* v660: CLEAR JOURNAL is destructive — obliterates the entire 500-row
   journal + wipes localStorage. Prior to v660 a single tap destroyed
   the journal with no confirmation, which is a real landmine on mobile
   where a stray tap on a scrolling list can catch the button. Confirm
   first, and only clear if the user explicitly agrees. Matches the
   pattern used by clearLog() at index.html line 7471 (setup log). */
function clearJournal(opts){
  try{
    var force = opts && opts.force === true;
    if (!force && typeof confirm === 'function'){
      var n = __journal.length;
      var msg = 'Delete the entire signal log' + (n ? ' (' + n + ' row'
        + (n === 1 ? '' : 's') + ')' : '') + '?\n\nThis cannot be undone. '
        + 'Export CSV first if you care about the sample.';
      if (!confirm(msg)) return false;
    }
    __journal = [];
    __corrupt = false;
    __lsWipe();
    setStat('journal cleared — logging continues on the next snapshot.');
    render();
    return true;
  }catch(e){ return false; }
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
+ '#tab_signallog .sl-badge.cswing{color:#4ac3ff;border-color:rgba(74,195,255,.6);background:rgba(74,195,255,.12)}'   /* v646 */
+ '#tab_signallog .sl-badge.cscalp{color:#ffd76a;border-color:rgba(255,215,106,.6);background:rgba(255,215,106,.12)}' /* v646 */
+ '#tab_signallog .sl-badge.supergold{color:#b8860b;border-color:rgba(184,134,11,.45);background:rgba(184,134,11,.08)}'
+ '#tab_signallog .sl-dir{font-weight:800;letter-spacing:.08em;font-size:10px}'
+ '#tab_signallog .sl-dir.long{color:#19e3a2}'
+ '#tab_signallog .sl-dir.short{color:#ff6b4a}'
+ '#tab_signallog .sl-tg{font-weight:700;color:var(--txt,#d7dbe0)}'
+ '#tab_signallog .sl-n{font-variant-numeric:tabular-nums}'
/* v653: give the note cell more room so the badge (7-10 dots) fits inline, and
   style the trailing detail text as a subtle suffix beside it. */
+ '#tab_signallog .sl-note{color:var(--mut,#8a8f98);max-width:420px;overflow:hidden;'
+ 'text-overflow:ellipsis;white-space:nowrap}'
+ '#tab_signallog .sl-note .hg-gld{margin:0;vertical-align:middle}'
+ '#tab_signallog .sl-note-suffix{color:var(--mut,#8a8f98);font-size:10px;margin-left:6px}'
/* v654: filter chip row — sits between title row and count/sources notes. */
+ '#tab_signallog .sl-filters{display:flex;flex-direction:column;gap:6px;margin-top:10px;'
+ 'padding:8px 10px;border:1px solid var(--bd,rgba(255,255,255,.08));border-radius:6px;'
+ 'background:rgba(255,255,255,.015)}'
+ '#tab_signallog .sl-filter-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}'
+ '#tab_signallog .sl-filter-lbl{color:var(--mut,#8a8f98);font-size:10px;letter-spacing:.14em;'
+ 'text-transform:uppercase;margin-right:4px;min-width:56px}'
+ '#tab_signallog .sl-chip-group{display:inline-flex;flex-wrap:wrap;gap:4px}'
+ '#tab_signallog .sl-chip{background:transparent;color:var(--mut,#8a8f98);'
+ 'border:1px solid var(--bd,rgba(255,255,255,.14));border-radius:3px;'
+ 'padding:2px 8px;font-size:10px;letter-spacing:.1em;font-weight:600;cursor:pointer;'
+ 'font-family:inherit;line-height:1.4;transition:background .15s,color .15s,border-color .15s}'
+ '#tab_signallog .sl-chip:hover{color:var(--txt,#d7dbe0);border-color:rgba(255,255,255,.28)}'
+ '#tab_signallog .sl-chip.sl-chip-on{color:#0b0d10;background:var(--txt,#d7dbe0);'
+ 'border-color:var(--txt,#d7dbe0)}'
+ '#tab_signallog .sl-search{background:rgba(0,0,0,.25);color:var(--txt,#d7dbe0);'
+ 'border:1px solid var(--bd,rgba(255,255,255,.14));border-radius:3px;padding:2px 8px;'
+ 'font:inherit;font-size:11px;letter-spacing:.04em;width:110px;outline:none}'
+ '#tab_signallog .sl-search:focus{border-color:rgba(255,255,255,.35)}'
/* v660: destructive-button styling for CLEAR JOURNAL — subtle by default,
   hover paints a clear red so intent is unambiguous before the tap lands. */
+ '#tab_signallog .sl-btn-danger{border-color:rgba(255,107,74,.35)}'
+ '#tab_signallog .sl-btn-danger:hover{background:rgba(255,107,74,.12);'
+ 'border-color:rgba(255,107,74,.7);color:#ff8b6a}'
+ '#tab_signallog .sl-btn-danger:focus-visible{outline:2px solid rgba(255,107,74,.6);outline-offset:2px}'
/* v657: summary stats strip — sits between filter row and count note. */
+ '#tab_signallog .sl-stats{margin-top:8px;padding:6px 10px;'
+ 'border:1px solid var(--bd,rgba(255,255,255,.08));border-radius:4px;'
+ 'background:rgba(74,195,255,.04);color:var(--txt,#d7dbe0);'
+ 'font-size:11px;letter-spacing:.02em;font-variant-numeric:tabular-nums;'
+ 'line-height:1.5}';

/* ---------------- mount / refresh ---------------- */
/* v654: SIGNAL LOG filters. 500 rows is too many to scan by eye without
   a way to narrow it. Three combinable filters: source (multi-toggle),
   direction (long/short/all), and symbol substring search. State lives
   on __filters; render() applies the predicate before tableHTML. */
/* v655: hydrate from localStorage so filter preferences survive reloads.
   Any bad shape is silently ignored; defaults win. */
var __filters = (function initFilters(){
  var def = { sources: null, dir: 'all', q: '' };
  try{
    var stored = __lsReadFilters();
    if (!stored) return def;
    if (Array.isArray(stored.sources) && stored.sources.length){
      /* only accept known sources so a stale storage entry from an older
         SOURCES list can't leave dead chips selected */
      var known = {};
      for (var i = 0; i < SOURCES.length; i++) known[SOURCES[i]] = 1;
      var s = new Set();
      for (var j = 0; j < stored.sources.length; j++){
        if (known[stored.sources[j]]) s.add(stored.sources[j]);
      }
      def.sources = s.size ? s : null;
    }
    if (stored.dir === 'long' || stored.dir === 'short' || stored.dir === 'all'){
      def.dir = stored.dir;
    }
    if (typeof stored.q === 'string') def.q = stored.q.slice(0, 20);
  }catch(e){}
  return def;
})();
function persistFilters(){ __lsWriteFilters(__filters); }

/* v655: CSV export of currently-filtered journal rows. Uses RFC 4180
   quoting: any field with a comma/quote/newline is wrapped in double
   quotes and internal quotes doubled. Gate ledger gets three flat
   columns (pass count / total / veto ids) so the CSV opens usefully
   in a spreadsheet without hand-parsing the badge. */
function csvEscape(v){
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (s.indexOf(',') === -1 && s.indexOf('"') === -1 && s.indexOf('\n') === -1 && s.indexOf('\r') === -1){
    return s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}
function gateColsFromEntry(e){
  var meta = (e && Array.isArray(e.gateMeta)) ? e.gateMeta : null;
  if (!meta || !meta.length) return { pass: '', total: '', vetos: '' };
  var pass = 0, veto = [];
  for (var i = 0; i < meta.length; i++){
    var g = meta[i]; if (!g) continue;
    if (g.state === 'pass') pass++;
    else if (g.state === 'veto') veto.push(g.id);
  }
  return { pass: pass, total: meta.length, vetos: veto.join(' ') };
}
function buildCsv(entries){
  var header = ['time','source','symbol','dir','tierOrGrade','entry','stop','t1',
                'maeR','mfeR','gatesPass','gatesTotal','gatesVeto','note'];
  var lines = [header.join(',')];
  for (var i = 0; i < entries.length; i++){
    var e = entries[i]; if (!e) continue;
    var g = gateColsFromEntry(e);
    lines.push([
      csvEscape(e.t),
      csvEscape(e.source),
      csvEscape(e.sym),
      csvEscape(e.dir),
      csvEscape(e.tierOrGrade === null || e.tierOrGrade === undefined ? '' : e.tierOrGrade),
      csvEscape(e.entry === null || e.entry === undefined ? '' : e.entry),
      csvEscape(e.stop === null || e.stop === undefined ? '' : e.stop),
      csvEscape(e.t1 === null || e.t1 === undefined ? '' : e.t1),
      csvEscape(e.maeR === null || e.maeR === undefined ? '' : e.maeR),
      csvEscape(e.mfeR === null || e.mfeR === undefined ? '' : e.mfeR),
      csvEscape(g.pass),
      csvEscape(g.total),
      csvEscape(g.vetos),
      csvEscape(e.note || '')
    ].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
function csvFilename(){
  var d = new Date();
  function p2(n){ return (n < 10 ? '0' : '') + n; }
  return 'hardgate-signal-log-'
    + d.getFullYear() + '-' + p2(d.getMonth()+1) + '-' + p2(d.getDate())
    + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.csv';
}
/* v657: summary stats over the currently-filtered rows. Renders one
   pipe-separated line above the count/sources notes so the user can
   immediately see the shape of what the filter selected without eyeballing
   the whole table. All values are honest (arithmetic mean; median for gates)
   and skip null/NaN cells rather than treating them as zero. */
function __fmt2(n){
  if (!isFinite(n)) return '—';
  var r = Math.round(n * 100) / 100;
  return (r > 0 ? '+' : '') + r.toFixed(2);
}
function __fmt1(n){
  if (!isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}
function computeStats(rows){
  var n = rows.length;
  var longs = 0, shorts = 0;
  var maeSum = 0, maeN = 0, mfeSum = 0, mfeN = 0;
  var gatesPassSum = 0, gatesTotalSum = 0, gatesN = 0;
  var vetoCounts = {};
  for (var i = 0; i < n; i++){
    var e = rows[i]; if (!e) continue;
    if (e.dir === 'long') longs++;
    else if (e.dir === 'short') shorts++;
    if (typeof e.maeR === 'number' && isFinite(e.maeR)){ maeSum += e.maeR; maeN++; }
    if (typeof e.mfeR === 'number' && isFinite(e.mfeR)){ mfeSum += e.mfeR; mfeN++; }
    if (Array.isArray(e.gateMeta) && e.gateMeta.length){
      /* v662: total for this row must match the pass loop's skip predicate
         (same fix pattern as v661 hgGateLedgerBadge + gateSummary above),
         otherwise avg gates X/Y in the stats strip can show phantom slots
         that the user can never inspect via the badge. */
      var pass = 0, tot = 0;
      for (var g = 0; g < e.gateMeta.length; g++){
        var gm = e.gateMeta[g]; if (!gm || typeof gm !== 'object') continue;
        tot++;
        if (gm.state === 'pass') pass++;
        else if (gm.state === 'veto') vetoCounts[gm.id] = (vetoCounts[gm.id] || 0) + 1;
      }
      if (tot){
        gatesPassSum += pass;
        gatesTotalSum += tot;
        gatesN++;
      }
    }
  }
  /* top 2 vetos by count, descending; ties broken by id for determinism */
  var vetoList = Object.keys(vetoCounts).map(function(id){
    return { id: id, n: vetoCounts[id] };
  });
  vetoList.sort(function(a, b){ return (b.n - a.n) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
  return {
    n: n,
    longs: longs,
    shorts: shorts,
    avgMae: maeN ? (maeSum / maeN) : NaN,
    avgMfe: mfeN ? (mfeSum / mfeN) : NaN,
    avgGatesPass: gatesN ? (gatesPassSum / gatesN) : NaN,
    avgGatesTotal: gatesN ? (gatesTotalSum / gatesN) : NaN,
    gatesN: gatesN,
    topVetos: vetoList.slice(0, 2)
  };
}
function statsLine(rows){
  if (!rows || !rows.length) return '';
  var s = computeStats(rows);
  var parts = [s.n + ' row' + (s.n === 1 ? '' : 's')];
  if (s.longs || s.shorts) parts.push(s.longs + ' long / ' + s.shorts + ' short');
  if (isFinite(s.avgMae)) parts.push('avg maeR ' + __fmt2(s.avgMae) + 'R');
  if (isFinite(s.avgMfe)) parts.push('avg mfeR ' + __fmt2(s.avgMfe) + 'R');
  if (s.gatesN && isFinite(s.avgGatesPass)){
    parts.push('avg gates ' + __fmt1(s.avgGatesPass) + '/' + __fmt1(s.avgGatesTotal));
  }
  if (s.topVetos.length){
    parts.push('top vetos: ' + s.topVetos.map(function(v){
      return v.id + ' (' + v.n + '×)';
    }).join(', '));
  }
  return parts.join(' · ');
}

function exportFilteredCsv(){
  try{
    var rows = applyFilters(__journal);
    if (!rows.length){
      setStat('nothing to export — the current filter matches zero rows');
      return 0;
    }
    var csv = buildCsv(rows);
    /* BOM so Excel opens UTF-8 correctly */
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    /* release the blob URL on the next tick — the browser has consumed it */
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 1500);
    setStat('exported ' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' to CSV');
    return rows.length;
  }catch(e){
    setStat('CSV export failed: ' + ((e && e.message) ? e.message : String(e)));
    return 0;
  }
}
function applyFilters(entries){
  var sources = __filters.sources;    /* null = ALL; else Set of enabled */
  var dir = __filters.dir;
  var q = String(__filters.q || '').trim().toUpperCase();
  if ((!sources || !sources.size) && dir === 'all' && !q) return entries;
  var out = [];
  for (var i = 0; i < entries.length; i++){
    var e = entries[i]; if (!e) continue;
    if (sources && sources.size && !sources.has(e.source)) continue;
    if (dir !== 'all' && e.dir !== dir) continue;
    if (q && String(e.sym || '').toUpperCase().indexOf(q) === -1) continue;
    out.push(e);
  }
  return out;
}
function rebuildFilterChips(){
  if (!__ui || !__ui.srcChips) return;
  var active = __filters.sources;
  var chips = __ui.srcChips.querySelectorAll('[data-sl-src]');
  for (var i = 0; i < chips.length; i++){
    var src = chips[i].getAttribute('data-sl-src');
    var on = (src === '__all__')
      ? (!active || !active.size)
      : (active && active.has(src));
    chips[i].classList.toggle('sl-chip-on', on);
  }
  if (__ui.dirChips){
    var dchips = __ui.dirChips.querySelectorAll('[data-sl-dir]');
    for (var d = 0; d < dchips.length; d++){
      dchips[d].classList.toggle('sl-chip-on',
        dchips[d].getAttribute('data-sl-dir') === __filters.dir);
    }
  }
}
function bindFilterHandlers(){
  if (!__ui) return;
  if (__ui.srcChips){
    __ui.srcChips.addEventListener('click', function(e){
      var t = e.target; while (t && t !== __ui.srcChips && !t.getAttribute('data-sl-src')) t = t.parentNode;
      if (!t || !t.getAttribute) return;
      var src = t.getAttribute('data-sl-src');
      if (!src) return;
      if (src === '__all__'){ __filters.sources = null; }
      else {
        if (!__filters.sources) __filters.sources = new Set();
        if (__filters.sources.has(src)) __filters.sources.delete(src);
        else __filters.sources.add(src);
        if (!__filters.sources.size) __filters.sources = null;
      }
      persistFilters();      /* v655 */
      rebuildFilterChips();
      render();
    });
  }
  if (__ui.dirChips){
    __ui.dirChips.addEventListener('click', function(e){
      var t = e.target; while (t && t !== __ui.dirChips && !t.getAttribute('data-sl-dir')) t = t.parentNode;
      if (!t || !t.getAttribute) return;
      var d = t.getAttribute('data-sl-dir');
      if (!d) return;
      __filters.dir = d;
      persistFilters();      /* v655 */
      rebuildFilterChips();
      render();
    });
  }
  if (__ui.q){
    __ui.q.addEventListener('input', function(){
      __filters.q = __ui.q.value || '';
      persistFilters();      /* v655 */
      render();
    });
  }
}

function mount(el){
  if (!el) return;
  try{
    /* v654: filter row above the table — source multi-toggle chips +
       direction 3-way + symbol search. Rebuilt from SOURCES so future
       source additions get chips automatically. */
    var srcChipsHtml = '<button type="button" class="sl-chip sl-chip-on" data-sl-src="__all__">ALL</button>';
    for (var si = 0; si < SOURCES.length; si++){
      srcChipsHtml += '<button type="button" class="sl-chip" data-sl-src="' + SOURCES[si] + '">'
        + SOURCES[si].toUpperCase() + '</button>';
    }
    var dirChipsHtml =
      '<button type="button" class="sl-chip sl-chip-on" data-sl-dir="all">ALL</button>'
      + '<button type="button" class="sl-chip" data-sl-dir="long">LONG</button>'
      + '<button type="button" class="sl-chip" data-sl-dir="short">SHORT</button>';

    el.innerHTML =
      '<style>' + SL_CSS + '</style>'
      + '<div class="panel">'
      /* v659: subtitle was stuck at 'brain + scalp + swing' — stale since v646
         when we started pulling crypto SWING/SCALP + supergold too. Rebuilt
         from SOURCES so it stays truthful on future source additions. */
      + '<h2>SIGNAL LOG <span>persistent journal of ' + SOURCES.join(' + ')
      + ' signals · newest first · capped at ' + MAX_ENTRIES + '</span></h2>'
      /* v660: CLEAR JOURNAL styled as destructive so it doesn't blend with
         the neutral EXPORT CSV button beside it. Muted border by default;
         hover paints red so intent is unambiguous before the tap lands. */
      + '<div class="row"><button class="btn sl-btn-danger" id="slClear" title="delete the entire signal log (asks to confirm first)">CLEAR JOURNAL</button>'
      + '<button class="btn" id="slExport" style="margin-left:6px">EXPORT CSV</button>'   /* v655 */
      + '<span class="note" id="slStat">journal ready — snapshots run every 5 min and on refresh.</span></div>'
      + '<div class="sl-filters" id="slFilters">'
        + '<div class="sl-filter-row"><span class="sl-filter-lbl">source</span>'
        + '<span class="sl-chip-group" id="slSrcChips">' + srcChipsHtml + '</span></div>'
        + '<div class="sl-filter-row"><span class="sl-filter-lbl">direction</span>'
        + '<span class="sl-chip-group" id="slDirChips">' + dirChipsHtml + '</span>'
        + '<span class="sl-filter-lbl" style="margin-left:14px">symbol</span>'
        + '<input type="text" class="sl-search" id="slQ" placeholder="e.g. BTC" autocomplete="off"></div>'
      + '</div>'
      + '<div class="sl-stats" id="slStats" style="display:none"></div>'   /* v657 */
      + '<div class="note" style="margin-top:8px"><b>logs while the app is open · every 5 min + on refresh</b>'
      + ' · <span id="slCount"></span></div>'
      + '<div class="note" id="slSources" style="margin-top:4px">sources: awaiting first snapshot</div>'
      + '<div class="note warn" id="slCorrupt" style="display:none;margin-top:4px">journal reset (corrupt) — stored data was unreadable, started fresh.</div>'
      + '</div>'
      + '<div class="sl-wrap" id="slBody"></div>'
      /* v659: static empty-state text also rebuilt from SOURCES for parity
         with the render() dynamic empty text above. */
      + '<div class="empty" id="slEmpty" style="display:none">no signals logged yet — the journal fills while the app '
      + 'is open (every 5 min + on refresh) whenever any of these sources have live results: '
      + SOURCES.map(function(s){ return s.toUpperCase(); }).join(', ') + '.</div>';

    __ui = {
      clear:    el.querySelector('#slClear'),
      export_:  el.querySelector('#slExport'),   /* v655 */
      stat:     el.querySelector('#slStat'),
      count:    el.querySelector('#slCount'),
      sources:  el.querySelector('#slSources'),
      corrupt:  el.querySelector('#slCorrupt'),
      body:     el.querySelector('#slBody'),
      empty:    el.querySelector('#slEmpty'),
      srcChips: el.querySelector('#slSrcChips'),
      dirChips: el.querySelector('#slDirChips'),
      q:        el.querySelector('#slQ'),
      stats:    el.querySelector('#slStats')       /* v657 */
    };
    if (__ui.clear) __ui.clear.addEventListener('click', function(){ clearJournal(); });
    if (__ui.export_) __ui.export_.addEventListener('click', function(){ exportFilteredCsv(); });   /* v655 */
    bindFilterHandlers();
    /* v655: paint chips + search box with the stored filter state on
       mount so the UI reflects what actually filters the render below. */
    if (__ui.q && __filters.q) __ui.q.value = __filters.q;
    rebuildFilterChips();
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
/* PACK 2 slice 4: publish gate consumer helpers so tabalerts, digest, and
   future consumers can format gate ledgers consistently. */
W.hgGateSummary = gateSummary;
W.hgEdgeVetoNote = edgeVetoNote;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'signallog', label: 'SIGNAL LOG', mount: mount, refresh: signallogRefresh });
ensureTimer();
})();
