/* =========================================================================
HARDGATE — gstack-brain.js
Garry Tan gstack thinking model for the BRAIN tab — virtual engineering
team applied to trade setup formation (not a clone of Claude Code skills).

Philosophy (from gstack ETHOS, trading-adapted):
  · Search before building — use existing HARDGATE layers first
  · Boil the ocean — complete error/rescue map on every setup ticket
  · User sovereignty — recommend only; never override brainDecide tier/dir

Sprint loop per candidate:
  THINK (office-hours) → PLAN (CEO/Eng/Design) → REVIEW (Staff/QA) → SHIP gate

Exports (window, never throw at load):
  gstackBrainApplyRows(rows) — enrich PRIME/HIGH/WATCH rows with .gstack
  gstackReadinessDashboard(rows) — ship-readiness summary for the tab
  gstackBrainRenderMini(row) / gstackBrainRenderDashboard(rows) — HTML
  gstackOfficeHours(row) / gstackSprintReview(row) — pure review objects
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var GSTACK_ETHOS = [
  'Golden Age — one desk + AI can run what took a team; judgment beats typing',
  'Boil the ocean — complete plan (entry/stop/T1/T2/rescue) or decline honestly',
  'Search before building — HARDGATE layers before inventing new signals',
  'User sovereignty — gstack recommends; you decide size and execution'
];

/* 23 gstack specialists → trading review hats (grouped by sprint phase) */
var GSTACK_ROLES = [
  { id: 'office-hours', phase: 'think', label: 'Office Hours', hat: 'Thesis interrogation' },
  { id: 'plan-ceo', phase: 'plan', label: 'CEO Review', hat: 'Conviction scope' },
  { id: 'plan-eng', phase: 'plan', label: 'Eng Manager', hat: 'Data & failure modes' },
  { id: 'plan-design', phase: 'plan', label: 'Design Review', hat: 'Plan clarity' },
  { id: 'plan-devex', phase: 'plan', label: 'DX Lead', hat: 'Trader UX path' },
  { id: 'review', phase: 'review', label: 'Staff Engineer', hat: 'Pre-trade diff' },
  { id: 'investigate', phase: 'review', label: 'Debugger', hat: 'Root cause of ASIDE' },
  { id: 'design-review', phase: 'review', label: 'Designer', hat: 'Ticket readability' },
  { id: 'qa', phase: 'test', label: 'QA Lead', hat: 'Setup verification' },
  { id: 'qa-only', phase: 'test', label: 'QA Reporter', hat: 'Health score' },
  { id: 'cso', phase: 'review', label: 'Security', hat: 'Venue & feed trust' },
  { id: 'ship', phase: 'ship', label: 'Release Engineer', hat: 'Go-live gate' },
  { id: 'canary', phase: 'ship', label: 'SRE', hat: 'Post-entry monitor' },
  { id: 'retro', phase: 'reflect', label: 'Retro', hat: 'Process learnings' }
];

function esc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function isDir(d){ return d === 'long' || d === 'short'; }
function tierRank(t){
  t = String(t || '').toUpperCase();
  return t === 'PRIME' ? 4 : t === 'HIGH' ? 3 : t === 'WATCH' ? 2 : 1;
}

/* Six forcing questions — YC office hours adapted to a setup row */
function gstackOfficeHours(row){
  var dec = row && row.dec;
  var plan = row && row.plan;
  var col = row && row.col;
  var dark = (col && col.unavailable) ? col.unavailable.length : 0;
  var agree = dec ? dec.agree : 0;
  var qs = [];

  qs.push({
    id: 'demand',
    q: 'Demand reality — would you miss this if it vanished?',
    pass: agree >= 3 && dec && dec.tier !== 'ASIDE',
    note: agree >= 3 ? (agree + ' layers agree — edge is visible on the board') : 'thin or absent agreement — no demand signal'
  });
  qs.push({
    id: 'status-quo',
    q: 'Status quo — what is the cost of standing aside?',
    pass: true,
    note: (dec && dec.tier === 'ASIDE') ? 'ASIDE is the status quo — trade adds risk without conviction' : 'Status quo = missed move if layers are right; sized entry is the wedge'
  });
  qs.push({
    id: 'specificity',
    q: 'Desperate specificity — who gets hurt if this is wrong?',
    pass: plan && isFinite(plan.stop) && isFinite(plan.entry),
    note: (plan && isFinite(plan.stop)) ? ('Stop at ' + plan.stop + ' defines the loser') : 'No stop on plan — cannot name who gets hurt'
  });
  qs.push({
    id: 'wedge',
    q: 'Narrowest wedge — smallest high-probability version?',
    pass: plan && (plan.entryType === 'limit' || plan.entryType === 'zone' || isFinite(plan.entry)),
    note: (plan && plan.entryType === 'limit') ? 'Patient limit at structure — narrow wedge' : (plan ? 'Market/gate plan — wider wedge' : 'No plan — wedge undefined')
  });
  qs.push({
    id: 'observation',
    q: 'Observation — did layers run, or are we guessing?',
    pass: dark <= 2,
    note: dark ? (dark + ' dark layer(s) — ' + (col.unavailable || []).join(', ')) : 'All critical layers ran — observation-backed'
  });
  qs.push({
    id: 'future',
    q: 'Future-fit — still valid if regime shifts?',
    pass: dec && dec.hasStructural,
    note: dec && dec.hasStructural ? 'Structural vote present — thesis survives a bar close' : 'No structural layer — thesis is context-only'
  });

  var passN = qs.filter(function(q){ return q.pass; }).length;
  return {
    questions: qs,
    passCount: passN,
    verdict: passN >= 5 ? 'BUILD' : (passN >= 3 ? 'HOLD' : 'SKIP'),
    verdictNote: passN >= 5 ? 'Thesis survives office hours — proceed to plan review' : (passN >= 3 ? 'Mixed thesis — plan review must harden rescue paths' : 'Thesis fails forcing questions — stand aside')
  };
}

function gstackCeoScope(row){
  var t = row && row.dec ? row.dec.tier : 'ASIDE';
  if (t === 'PRIME') return { mode: 'SELECTIVE EXPANSION', note: 'PRIME — hold size discipline; cherry-pick only named path items' };
  if (t === 'HIGH') return { mode: 'HOLD SCOPE', note: 'HIGH — execute plan as designed; no scope creep' };
  if (t === 'WATCH') return { mode: 'SCOPE REDUCTION', note: 'WATCH radar — half size or wait for promotion path' };
  return { mode: 'SCOPE REDUCTION', note: 'ASIDE — zero scope; log kill reason for retro' };
}

function gstackEngReview(row){
  var issues = [];
  var col = row && row.col;
  var plan = row && row.plan;
  if (col && col.unavailable && col.unavailable.length >= 3)
    issues.push({ sev: 'critical', text: '3+ dark layers — data pipeline incomplete', autoFix: false });
  if (!plan || !isFinite(plan.entry) || !isFinite(plan.stop) || !isFinite(plan.t1))
    issues.push({ sev: 'critical', text: 'Plan missing entry/stop/T1 — silent failure if shipped', autoFix: false });
  if (row.stack && row.stack.tierHint === 'forming')
    issues.push({ sev: 'medium', text: 'FTS tier forming — gate clearance tight', autoFix: true });
  if (row.dec && row.dec.cappedFrom)
    issues.push({ sev: 'medium', text: 'Tier capped from ' + row.dec.cappedFrom + ' — dark layer degradation', autoFix: false });
  return { issues: issues, architecture: 'HARDGATE layer graph → brainDecide → plan → book/execute' };
}

function gstackDesignReview(row){
  var plan = row && row.plan;
  var score = 5;
  var notes = [];
  if (plan && plan.entryType === 'limit'){ score += 2; notes.push('Limit entry labeled — trader knows order type'); }
  if (plan && isFinite(plan.cancelIf)){ score += 1; notes.push('Cancel-if invalidation stated'); }
  if (plan && isFinite(plan.rr1) && plan.rr1 >= 1.5){ score += 1; notes.push('R:R readable on ticket'); }
  if (!plan){ score = 2; notes.push('No plan — AI-slop risk: pretty tier, no actionable levels'); }
  return { score: Math.min(10, score), notes: notes };
}

function gstackQaReview(row){
  var plan = row && row.plan;
  var health = 100;
  var bugs = [];
  if (!plan){ health -= 40; bugs.push('missing plan'); }
  else{
    if (!isFinite(plan.stop)){ health -= 25; bugs.push('missing stop'); }
    if (!isFinite(plan.t1)){ health -= 20; bugs.push('missing T1'); }
    if (plan.entry === plan.stop){ health -= 30; bugs.push('zero risk geometry'); }
  }
  if (row.dec && row.dec.tier === 'WATCH' && row.gateNote)
    bugs.push('radar gate: ' + row.gateNote);
  return { healthBefore: 100, healthAfter: Math.max(0, health), bugs: bugs, ship: health >= 70 && bugs.length === 0 };
}

function gstackShipGate(row, reviews){
  var oh = reviews.officeHours;
  var qa = reviews.qa;
  var eng = reviews.eng;
  var crit = (eng.issues || []).filter(function(i){ return i.sev === 'critical'; }).length;
  var ready = oh.verdict !== 'SKIP' && qa.ship && crit === 0;
  return {
    ready: ready,
    dashboard: {
      officeHours: oh.verdict,
      ceo: reviews.ceo.mode,
      engCritical: crit,
      designScore: reviews.design.score,
      qaHealth: qa.healthAfter,
      userSovereignty: 'recommendation only — brain tier unchanged'
    }
  };
}

function gstackClassifyDecision(reviews){
  var taste = [];
  var mechanical = [];
  if (reviews.ceo.mode === 'SCOPE REDUCTION') taste.push('size reduction');
  if (reviews.design.score < 7) taste.push('plan presentation');
  (reviews.eng.issues || []).forEach(function(i){
    if (i.autoFix) mechanical.push(i.text);
    else taste.push(i.text);
  });
  return {
    mechanical: mechanical,
    taste: taste,
    userChallenge: (reviews.officeHours.verdict === 'SKIP' && reviews.qa.ship) ? ['thesis says skip but QA passed — reconcile before size'] : []
  };
}

function gstackSprintReview(row){
  var reviews = {
    officeHours: gstackOfficeHours(row),
    ceo: gstackCeoScope(row),
    eng: gstackEngReview(row),
    design: gstackDesignReview(row),
    qa: gstackQaReview(row)
  };
  reviews.ship = gstackShipGate(row, reviews);
  reviews.classification = gstackClassifyDecision(reviews);
  reviews.ethos = GSTACK_ETHOS.slice();
  reviews.rolesConsulted = GSTACK_ROLES.map(function(r){ return r.id; });
  return reviews;
}

function gstackBrainEnrichRow(row){
  try{
    if (!row || !row.dec || tierRank(row.dec.tier) < 2) return row;
    row.gstack = gstackSprintReview(row);
    row.gstackRecommend = row.gstack.ship.ready ? 'SHIP' : 'HOLD';
    row.gstackSummary = row.gstack.officeHours.verdict + ' · ' + row.gstack.ceo.mode
      + ' · QA ' + row.gstack.qa.healthAfter + ' · ' + row.gstackRecommend;
    return row;
  }catch(e){
    row.gstack = { error: String((e && e.message) || e).slice(0, 120) };
    return row;
  }
}

function gstackBrainApplyRows(rows){
  if (!rows || !rows.length) return { enriched: 0, shipReady: 0 };
  var enriched = 0, shipReady = 0;
  for (var i = 0; i < rows.length; i++){
    if (!rows[i] || !rows[i].dec) continue;
    if (tierRank(rows[i].dec.tier) < 2) continue;
    gstackBrainEnrichRow(rows[i]);
    enriched++;
    if (rows[i].gstack && rows[i].gstack.ship && rows[i].gstack.ship.ready) shipReady++;
  }
  G.__hgGstackLast = gstackReadinessDashboard(rows);
  return { enriched: enriched, shipReady: shipReady };
}

function gstackReadinessDashboard(rows){
  rows = rows || [];
  var prime = 0, high = 0, watch = 0, shipReady = 0, hold = 0, skip = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.dec) continue;
    var t = r.dec.tier;
    if (t === 'PRIME') prime++;
    else if (t === 'HIGH') high++;
    else if (t === 'WATCH') watch++;
    if (r.gstack){
      if (r.gstack.ship && r.gstack.ship.ready) shipReady++;
      else hold++;
      if (r.gstack.officeHours && r.gstack.officeHours.verdict === 'SKIP') skip++;
    }
  }
  return {
    at: Date.now(),
    ethos: GSTACK_ETHOS,
    sprint: 'THINK → PLAN → REVIEW → TEST → SHIP',
    counts: { prime: prime, high: high, watch: watch, shipReady: shipReady, hold: hold, thesisSkip: skip },
    sovereignty: 'Gstack recommends — BRAIN tier and your size decision stay yours'
  };
}

function gstackBrainRenderMini(row){
  try{
    var gs = row && row.gstack;
    if (!gs || gs.error) return '';
    var cls = gs.ship && gs.ship.ready ? 'ok' : 'warn';
    var oh = gs.officeHours.verdict;
    var lines = '<div class="note ' + cls + '" style="margin-top:6px;font-size:10px;line-height:1.55">'
      + '<b>GSTACK</b> ' + esc(gs.ship && gs.ship.ready ? 'SHIP READY' : 'HOLD')
      + ' · Office Hours <b>' + esc(oh) + '</b>'
      + ' · CEO ' + esc(gs.ceo.mode)
      + ' · Design ' + gs.design.score + '/10'
      + ' · QA health ' + gs.qa.healthAfter
      + '<br><span style="opacity:.85">' + esc(gs.officeHours.verdictNote) + '</span>';
    if (gs.classification && gs.classification.taste.length)
      lines += '<br><span style="opacity:.85">Taste: ' + esc(gs.classification.taste.join('; ')) + '</span>';
    if (gs.classification && gs.classification.userChallenge.length)
      lines += '<br><span style="color:var(--gold)">Challenge: ' + esc(gs.classification.userChallenge[0]) + '</span>';
    lines += '</div>';
    return lines;
  }catch(e){ return ''; }
}

function gstackBrainRenderDashboard(rows){
  var dash = gstackReadinessDashboard(rows);
  var c = dash.counts;
  var h = '<div class="note" style="font-size:11px;line-height:1.65">'
    + '<b>GSTACK BRAIN</b> — ' + esc(dash.sprint) + '<br>'
    + esc(dash.sovereignty) + '<br>'
    + 'PRIME ' + c.prime + ' · HIGH ' + c.high + ' · WATCH ' + c.watch
    + ' · <b style="color:var(--long)">' + c.shipReady + ' ship-ready</b>'
    + ' · ' + c.hold + ' hold · ' + c.thesisSkip + ' thesis skip</div>';
  h += '<div class="note" style="margin-top:4px;font-size:10px;opacity:.9">'
    + GSTACK_ETHOS.map(function(e){ return '· ' + esc(e); }).join('<br>') + '</div>';
  return h;
}

G.GSTACK_ETHOS = GSTACK_ETHOS;
G.GSTACK_ROLES = GSTACK_ROLES;
G.gstackOfficeHours = gstackOfficeHours;
G.gstackSprintReview = gstackSprintReview;
G.gstackBrainEnrichRow = gstackBrainEnrichRow;
G.gstackBrainApplyRows = gstackBrainApplyRows;
G.gstackReadinessDashboard = gstackReadinessDashboard;
G.gstackBrainRenderMini = gstackBrainRenderMini;
G.gstackBrainRenderDashboard = gstackBrainRenderDashboard;
G.gstackBrainThink = gstackBrainApplyRows;

})();
