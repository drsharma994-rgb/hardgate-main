/* =========================================================================
HARDGATE — tauric.js
TAURIC tab (GOLD group): the TradingAgents multi-agent pipeline, run on
XAUUSD, priced by this desk and judged by this desk's rules.

WHAT THIS TAB IS

TradingAgents (TauricResearch) runs a book of LLM agents over one
instrument: four analysts (market, social, news, fundamentals), a two-sided
bull/bear research debate, a research manager, a trader, and a three-way
risk debate (aggressive / conservative / neutral) closed out by a portfolio
manager. XAUUSD is a first-class symbol there — its symbol_utils table maps
the broker ticker to Yahoo's COMEX front-month GC=F, because gold has no
spot forex pair on Yahoo.

It is Python and every agent is an LLM call, so it cannot run in this page.
It runs out of process behind /api/tauric (lib/tauric-api.mjs ->
scripts/tauric-bridge.py) and this tab renders what comes back.

WHAT IT PRODUCES, AND THE ONE THING IT DOES NOT

The pipeline's output is a FIVE-TIER RATING — Buy / Overweight / Hold /
Underweight / Sell — plus each agent's prose. It is not an entry, a stop or
a target: TradingAgents does not produce levels and nothing here invents
them. So the two halves are split the way they should be:

    TAURIC supplies the VIEW        direction and conviction, argued
    HARDGATE supplies the LEVELS    hgOgFetchRows + hgPlanLevels, the same
                                    bars and the same plan layer every
                                    other gold card is priced from

A view with no levels is not a trade, and levels with no view are not
either. Both halves are named on the card so nobody has to guess which
system said what.

WHY IT CANNOT ISSUE A TICKET, AND WHY THAT IS NOT A BUG

hg-v756 made measured-edge a HARD gate: this desk issues a ticket only for
a mechanic whose edge it has measured. TAURIC has no record in the replay —
it is not one of the 77 registered mechanics and it has never appeared in a
walk. Under the desk's own rule that makes every TAURIC call a WATCH, by
construction, however confident the agents are. Arguing otherwise would
mean exempting the newest and least-tested source on the desk from the rule
every measured one obeys.

What it CAN do is start earning a record. Every call is written to the
forward log under OMNIGOLD:TAURIC, so in time the same machinery that
judges SPRING and MMOVE can say whether a Tauric Buy on gold pays. That is
the only honest route from "the agents are confident" to "this is a trade".

Classic script + HG_tabs, like every other module.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

var TAURIC_TAB = 'OMNIGOLD:TAURIC';
var TAURIC_SYMBOL = 'XAUUSD';
/* The plan is priced at the same 2R this desk measures every gold hit rate
   against, so a TAURIC card's breakeven is the 33.3% every other card is
   read against rather than a number of its own. */
var TAURIC_T1_R = 2;
/* 4h bars: the pipeline's view is a daily one and a 4h plan is the shortest
   horizon that does not read intraday noise into a daily argument. */
var TAURIC_TF = '4h';
/* The same timeframe in seconds, declared beside it so the two cannot drift.
   The forward log dedups on the BAR a setup fired in, so a record needs its
   barT floored to this — see hgFwdRecordScan, which does exactly this and is
   the shape every other instrumented tab uses. */
var TAURIC_TF_SEC = 4 * 60 * 60;
var TAURIC_BARS = 300;

var __t = { ui: null, busy: false, ranOnce: false, pre: null, last: null };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
function fin(v){ var n = Number(v); return isFinite(n) ? n : NaN; }
function num(v, d){ return isFinite(fin(v)) ? fin(v).toFixed(d == null ? 2 : d) : '—'; }

/* ---------------------------------------------------------------------
   THE RATING IS A VIEW, NOT A DIRECTION UNTIL IT IS MAPPED

   TradingAgents returns one of five tiers, or the literal 'REVIEW' when the
   decision had no parseable rating (its own #1170). REVIEW is NOT a hold —
   it means the pipeline produced something nobody could read, and mapping
   it to flat would quietly turn a parse failure into a trading opinion.
   It gets its own state and no plan.
   --------------------------------------------------------------------- */
var TAURIC_RATINGS = {
  'BUY':          { dir: 'long',  conviction: 'high', rank: 2 },
  'OVERWEIGHT':   { dir: 'long',  conviction: 'low',  rank: 1 },
  'HOLD':         { dir: null,    conviction: 'flat', rank: 0 },
  'UNDERWEIGHT':  { dir: 'short', conviction: 'low',  rank: -1 },
  'SELL':         { dir: 'short', conviction: 'high', rank: -2 }
};

function hgTauricRating(signal){
  var key = String(signal == null ? '' : signal).trim().toUpperCase();
  if (!key) return { state: 'absent', dir: null, label: null };
  if (key === 'REVIEW'){
    return { state: 'review', dir: null, label: 'REVIEW',
             why: 'the pipeline finished but its decision carried no parseable rating — '
                + 'that is an unreadable answer, not a flat one, so no direction is taken from it' };
  }
  var hit = TAURIC_RATINGS[key];
  if (!hit) return { state: 'unknown', dir: null, label: key,
                     why: 'the pipeline returned a rating this tab does not know' };
  if (!hit.dir) return { state: 'flat', dir: null, label: key,
                         conviction: hit.conviction, rank: hit.rank,
                         why: 'a HOLD is a view with no side — there is nothing to price' };
  return { state: 'directional', dir: hit.dir, label: key,
           conviction: hit.conviction, rank: hit.rank };
}

/* ---------------------------------------------------------------------
   THE LEVELS ARE THIS DESK'S, ON THIS DESK'S BARS

   hgOgFetchRows is the same fetcher OMNIGOLD uses (XM XAUUSD, spot proxies,
   Delta XAUT, tokenised-gold fallbacks) and hgPlanLevels the same plan
   layer. Nothing here computes a stop of its own: a second stop rule on the
   same instrument is how two tabs end up disagreeing about the same trade.
   Returns null — never a guess — when either is unavailable.
   --------------------------------------------------------------------- */
function hgTauricPricePlan(dir){
  var fetchFn = W.hgOgFetchRows, planFn = W.hgPlanLevels;
  if (typeof fetchFn !== 'function' || typeof planFn !== 'function'){
    return Promise.resolve({ ok: false, why: 'this desk\'s gold bars or plan layer are not loaded' });
  }
  if (dir !== 'long' && dir !== 'short'){
    return Promise.resolve({ ok: false, why: 'no direction to price' });
  }
  return Promise.resolve().then(function(){ return fetchFn(TAURIC_TF, TAURIC_BARS); })
    .then(function(rows){
      if (!rows || !rows.length){
        return { ok: false, why: 'no gold bars came back — the plan is not priced rather than priced on nothing' };
      }
      var plan = null;
      try { plan = planFn(dir, rows, null, { minRr: TAURIC_T1_R }); } catch (e){ plan = null; }
      if (!plan || !isFinite(fin(plan.entry)) || !isFinite(fin(plan.stop))){
        return { ok: false, why: 'the plan layer declined this direction on these bars', bars: rows.length };
      }
      /* Pack 907: the bars the plan was priced on, judged for whether they
         are possible candles. Carried out with the plan rather than
         re-fetched, so the note describes the tape this plan actually
         used and not a later one. */
      var tapeNote = '';
      try{
        if (typeof W.hgGoldTapeNotes === 'function')
          tapeNote = W.hgGoldTapeNotes(rows, TAURIC_TF);
      }catch(eTs){}
      return { ok: true, plan: plan, bars: rows.length, tapeNote: tapeNote,
               lastClose: fin(rows[rows.length - 1] && rows[rows.length - 1].c) };
    })
    .catch(function(e){ return { ok: false, why: String((e && e.message) || e) }; });
}

/* The two economic checks that are about the trade itself rather than about
   a mechanic's history, so they apply to a source with no history at all.
   Both are the gold desk's own constants, read through its own helpers when
   they are loaded — never re-declared here. */
function hgTauricCostNote(plan){
  if (!plan) return null;
  var entry = fin(plan.entry), risk = Math.abs(fin(plan.entry) - fin(plan.stop));
  if (!isFinite(entry) || !(risk > 0)) return null;
  var out = { stopPct: (risk / entry) * 100 };
  try {
    if (typeof W.hgOgVenueCost === 'function'){
      var v = W.hgOgVenueCost();
      if (v && isFinite(fin(v.rtFrac))){
        out.venue = v.venue || v.name || null;
        out.costR = (entry * fin(v.rtFrac)) / risk;
      }
    }
  } catch (e){}
  return out;
}

/* ---------------------------------------------------------------------
   RECORDING IT IS THE WHOLE POINT

   A source with no measured record cannot issue a ticket here, and the only
   way it ever gets one is by accumulating settled calls. Written under its
   own mechanic key so it is judged as itself, with gateClear false — it did
   NOT clear this desk's gates, it was never put to them, and marking it
   otherwise would pollute the population that decides promotions.
   --------------------------------------------------------------------- */
function hgTauricRecord(rating, priced){
  try {
    if (typeof W.hgFwdRecord !== 'function') return { ok: false, why: 'forward log not loaded' };
    if (!rating || rating.state !== 'directional' || !priced || !priced.ok) {
      return { ok: false, why: 'nothing directional and priced to record' };
    }
    var p = priced.plan;
    /* barT: the bar this fired in, floored to the timeframe. WITHOUT IT the
       record is 'unsettleable or malformed' and is dropped — which is what
       this did when it shipped, silently, while the card said it had been
       recorded. Flooring is also the dedup rule the log is built on: re-run
       the pipeline inside the same 4h bar and it records once, not twice. */
    var barT = Math.floor((Date.now() / 1000) / TAURIC_TF_SEC) * TAURIC_TF_SEC;
    var reason = W.hgFwdRecord({
      tab: TAURIC_TAB,
      mechanic: 'TAURIC-' + String(rating.label || '').toUpperCase(),
      sym: 'XAUUSD', tf: TAURIC_TF, dir: rating.dir,
      entry: fin(p.entry), stop: fin(p.stop), t1: fin(p.t1),
      barT: barT,
      horizonBars: 30,
      ticket: false,
      /* it cleared nothing — it was never gated */
      gateClear: false,
      shown: true
    });
    /* hgFwdRecord returns a REASON STRING, not a boolean: 'recorded',
       'already recorded', or 'unsettleable or malformed'. Two of those three
       mean nothing was written, and `!!reason` called all three a success —
       so the card claimed a record the log had refused. Only one value is
       success, and the others are reported as themselves. */
    return { ok: reason === 'recorded', reason: reason,
             why: reason === 'recorded' ? null : ('the log refused it: ' + reason) };
  } catch (e){ return { ok: false, why: String((e && e.message) || e) }; }
}

/* ---------------------------------------------------------------------
   RENDERING
   --------------------------------------------------------------------- */
function blockedHtml(pre){
  var b = pre && pre.blocked;
  var head = '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #b45309;'
    + 'border-left:3px solid #b45309;border-radius:4px;background:rgba(180,83,9,0.08)">';
  if (b === 'install'){
    return head + '<b>TRADINGAGENTS IS NOT INSTALLED HERE</b><br>'
      + 'This tab runs TauricResearch/TradingAgents out of process and cannot find it. Clone it and '
      + 'create its venv, or point <code>TAURIC_PYTHON</code> at an interpreter that has it.'
      + (pre && pre.tried && pre.tried.length
          ? '<br><span class="note">looked in: ' + esc(pre.tried.slice(0, 4).join(' · ')) + '</span>' : '')
      + (pre && pre.error ? '<br><span class="note">' + esc(String(pre.error).slice(0, 200)) + '</span>' : '')
      + '</div>';
  }
  if (b === 'key'){
    return head + '<b>NO LLM KEY, SO NO AGENT CAN THINK</b><br>'
      + 'Every stage of this pipeline is an LLM call. Set one provider key in the TradingAgents '
      + '<code>.env</code> — <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, '
      + '<code>GOOGLE_API_KEY</code> or any of the other thirteen it supports — and this tab runs.'
      + (pre && pre.cwd
          ? '<br><span class="note">the <code>.env</code> is read from <code>' + esc(pre.cwd)
            + '</code> — a key anywhere else will not be seen</span>' : '')
      + (pre && pre.config && pre.config.llm_provider
          ? '<br><span class="note">configured provider: ' + esc(pre.config.llm_provider)
            + ' · ' + esc(pre.config.deep_think_llm || '?')
            + ' — a key from a DIFFERENT provider also needs '
            + '<code>TRADINGAGENTS_LLM_PROVIDER</code> set, or it will still call this one</span>' : '')
      + '</div>';
  }
  if (b === 'vendor'){
    var v = (pre && pre.vendor) || {};
    return head + '<b>THE MARKET-DATA VENDOR IS UNREACHABLE</b><br>'
      + 'The agents read prices through ' + esc((pre.config && pre.config.data_vendors
          && pre.config.data_vendors.core_stock_apis) || 'the configured vendor')
      + ', and the request did not get out'
      + (v.blocked ? ' — the gateway answered 403 to CONNECT, which is a policy denial rather than a '
                   + 'transient failure and will not clear on a retry' : '') + '.'
      + (v.vendor_symbol ? '<br><span class="note">XAUUSD resolves to ' + esc(v.vendor_symbol)
          + ' (the library\'s own mapping — gold has no spot pair on Yahoo)</span>' : '')
      + (v.detail ? '<br><span class="note">' + esc(String(v.detail).slice(0, 220)) + '</span>' : '')
      + '</div>';
  }
  if (b === 'timeout'){
    return head + '<b>THE PIPELINE DID NOT FINISH IN TIME</b><br>'
      + esc(pre.error || 'stopped by the server timeout') + '</div>';
  }
  if (b === 'busy'){
    return head + '<b>A RUN IS ALREADY IN FLIGHT</b><br>'
      + 'One at a time — a pipeline run is dozens of paid LLM calls.</div>';
  }
  if (b){
    return head + '<b>' + esc(String(b).toUpperCase()) + '</b><br>'
      + esc((pre && (pre.error || pre.reason)) || 'no detail given') + '</div>';
  }
  return '';
}

function preflightHtml(pre){
  if (!pre) return '<div class="note">checking…</div>';
  var rows = [];
  var mark = function(ok){ return ok ? '<span class="statuschip ok">OK</span>'
                                     : '<span class="statuschip bad">NO</span>'; };
  rows.push('<tr><td>package</td><td>' + mark(pre.install && pre.install.ok) + '</td><td class="note">'
    + esc(pre.install && pre.install.ok ? ('python ' + (pre.install.python || '?')
        + (pre.resolved_by ? ' · found via ' + pre.resolved_by : ''))
        : (pre.install && pre.install.error) || 'not importable') + '</td></tr>');
  rows.push('<tr><td>LLM key</td><td>' + mark(pre.keys && pre.keys.ok) + '</td><td class="note">'
    + esc(pre.keys && pre.keys.ok ? pre.keys.providers.join(', ')
        : 'no provider key set — every agent in this pipeline is an LLM call') + '</td></tr>');
  var sm = pre.symbol_map || {};
  rows.push('<tr><td>symbol</td><td>' + mark(!!sm.vendor) + '</td><td class="note">'
    + esc(sm.vendor ? (sm.input + ' → ' + sm.vendor + ' (mapped by the library, not by this tab)')
        : (sm.error || 'did not resolve')) + '</td></tr>');
  var v = pre.vendor || {};
  rows.push('<tr><td>market data</td><td>' + mark(v.ok) + '</td><td class="note">'
    + esc(v.ok ? (v.rows + ' bars · last close ' + num(v.last_close) + ' on ' + (v.last_date || '?'))
        : (v.reason || 'unreachable')) + '</td></tr>');
  return '<table class="tbl"><tr><th>component</th><th></th><th>detail</th></tr>'
    + rows.join('') + '</table>';
}

function reportHtml(label, text){
  if (!text) return '';
  var body = String(text);
  var short = body.length > 1400;
  return '<details style="margin:6px 0"><summary><b>' + esc(label) + '</b>'
    + '<span class="note"> · ' + body.length + ' chars</span></summary>'
    + '<div class="note" style="white-space:pre-wrap;margin-top:4px;max-height:420px;overflow:auto">'
    + esc(short ? body : body) + '</div></details>';
}

function verdictHtml(rating, priced, cost, rec){
  var h = '<div class="panel" style="margin-top:10px"><h3>THE TRADE</h3>';

  if (!rating || rating.state === 'absent'){
    return h + '<div class="note">The pipeline returned no rating, so there is nothing to price.</div></div>';
  }
  if (rating.state !== 'directional'){
    return h + '<div class="note"><b>' + esc(rating.label || '—') + '</b> — ' + esc(rating.why || '')
      + '<br>No entry, stop or target is shown, because none would mean anything.</div></div>';
  }

  h += '<div><b>TAURIC VIEW:</b> ' + esc(rating.label) + ' → <b>' + esc(rating.dir.toUpperCase())
    + '</b> XAUUSD <span class="note">(' + esc(rating.conviction) + ' conviction)</span></div>';

  if (!priced || !priced.ok){
    return h + '<div class="note warn" style="margin-top:6px">The view has a side but no levels: '
      + esc((priced && priced.why) || 'not priced') + '. A view without levels is not a trade, and '
      + 'this tab will not print numbers it did not get.</div></div>';
  }

  var p = priced.plan;
  h += '<table class="tbl" style="margin-top:6px">'
    + '<tr><th>entry</th><th>stop</th><th>T1 (' + TAURIC_T1_R + 'R)</th><th>risk</th><th>bars</th></tr>'
    + '<tr><td class="hg-num">' + num(p.entry) + '</td><td class="hg-num">' + num(p.stop) + '</td>'
    + '<td class="hg-num">' + num(p.t1) + '</td><td class="hg-num">' + num(p.risk)
    + '</td><td class="hg-num">' + (priced.bars || '—') + '</td></tr></table>';
  h += '<div class="note">Levels are HARDGATE\'s — the same ' + TAURIC_TF + ' bars and the same plan '
    + 'layer every other gold card is priced from. TradingAgents supplied the side, not the numbers.</div>';

  /* THE GEOMETRY VERDICT, LIKE EVERY OTHER PLAN-PUBLISHING TAB.

     A plan can be arithmetically fine and still be nonsense against where
     the market actually is — an entry already through its own stop, a
     target already reached. hgPlanGeometryLineHtml is the one place that
     rule lives, and a tab that prints a pending entry and stop owes the
     reader its answer. TAURIC is the newest source here, which makes it the
     LAST one that should get to skip the check.

     Marked against the last close the plan was priced on: the geometry
     question is "where is this trade relative to the market", and a mark is
     what makes it answerable. No mark, no verdict — never a silent pass. */
  try {
    if (typeof W.hgPlanGeometryLineHtml === 'function' && isFinite(fin(priced.lastClose))){
      h += W.hgPlanGeometryLineHtml(p, fin(priced.lastClose),
                                    { style: 'margin-top:6px' }) || '';
    }
  } catch (e){}

  if (cost){
    h += '<div class="note" style="margin-top:4px">stop ' + num(cost.stopPct) + '% of entry'
      + (isFinite(fin(cost.costR)) ? ' · round-trip cost ' + num(cost.costR) + 'R'
          + (cost.venue ? ' at ' + esc(cost.venue) : '') : '')
      + '</div>';
  }

  /* THE RULE THIS DESK APPLIES TO ITSELF, APPLIED HERE TOO. */
  h += '<div class="note warn" style="margin-top:8px;padding:6px 8px;border-left:3px solid #b45309">'
    + '<b>WATCH, NOT A TICKET.</b> hg-v756 made measured-edge a hard gate: this desk issues a ticket '
    + 'only for a mechanic whose edge it has measured. TAURIC has no record in the replay — it is not '
    + 'one of the registered mechanics and has never appeared in a walk — so every call it makes is a '
    + 'WATCH by construction, however confident the agents are. Exempting the newest source on the '
    + 'desk from the rule the measured ones obey would be the wrong way round.</div>';

  h += '<div class="note" style="margin-top:6px">'
    + (rec && rec.ok
        ? 'Recorded to the forward log under <b>' + esc(TAURIC_TAB) + '</b>. That is how it starts '
          + 'earning a record: once enough calls settle, the same machinery that judges SPRING and '
          + 'MMOVE can say whether a Tauric view on gold pays.'
        : 'NOT recorded: ' + esc((rec && rec.why) || 'unknown') + ' — so this call will not count '
          + 'towards a record either way.')
    + '</div>';

  return h + '</div>';
}

function renderRun(out){
  var ui = __t.ui;
  if (!ui || !ui.body) return;
  if (!out || out.blocked || !out.ran){
    ui.body.innerHTML = blockedHtml(out || { blocked: 'bridge', error: 'no response' })
      + preflightHtml(__t.pre);
    return;
  }

  var rating = hgTauricRating(out.signal);
  __t.last = { out: out, rating: rating };

  var h = '<div class="note">ran ' + esc(out.trade_date || '') + ' · '
    + esc((out.symbol_map && out.symbol_map.vendor) || '?') + ' · '
    + (out.elapsed_ms ? Math.round(out.elapsed_ms / 1000) + 's' : '—')
    + ' · analysts: ' + esc((out.analysts || []).join(', ')) + '</div>';

  h += '<div id="tauricVerdict"></div>';

  h += '<div class="panel" style="margin-top:10px"><h3>WHAT EACH AGENT SAID</h3>';
  var order = ['market_report', 'sentiment_report', 'news_report', 'fundamentals_report',
               'investment_plan', 'trader_investment_plan', 'final_trade_decision'];
  var any = false;
  for (var i = 0; i < order.length; i++){
    var r = out.reports && out.reports[order[i]];
    if (r && r.text){ h += reportHtml(r.label, r.text); any = true; }
  }
  if (out.debate){
    if (out.debate.bull) { h += reportHtml('Bull Researcher', out.debate.bull); any = true; }
    if (out.debate.bear) { h += reportHtml('Bear Researcher', out.debate.bear); any = true; }
    if (out.debate.judge){ h += reportHtml('Research debate — judge', out.debate.judge); any = true; }
  }
  if (out.risk){
    if (out.risk.aggressive)   { h += reportHtml('Risk — aggressive', out.risk.aggressive); any = true; }
    if (out.risk.conservative) { h += reportHtml('Risk — conservative', out.risk.conservative); any = true; }
    if (out.risk.neutral)      { h += reportHtml('Risk — neutral', out.risk.neutral); any = true; }
    if (out.risk.judge)        { h += reportHtml('Risk debate — judge', out.risk.judge); any = true; }
  }
  if (!any) h += '<div class="note">No agent produced a report.</div>';
  /* a stage that ran and said nothing is named, not quietly dropped */
  if (out.missing_reports && out.missing_reports.length){
    h += '<div class="note warn" style="margin-top:6px">Silent stages: '
      + esc(out.missing_reports.map(function(m){ return m.label; }).join(', '))
      + ' — these ran and returned nothing, which is not the same as agreeing.</div>';
  }
  h += '</div>';

  ui.body.innerHTML = h;

  /* price + record after the prose is on screen, so a slow bar fetch never
     holds up showing what the agents actually said */
  var slot = ui.body.querySelector('#tauricVerdict');
  if (slot) slot.innerHTML = '<div class="note">pricing the view on this desk\'s bars…</div>';
  hgTauricPricePlan(rating.dir).then(function(priced){
    var cost = (priced && priced.ok) ? hgTauricCostNote(priced.plan) : null;
    var rec = hgTauricRecord(rating, priced);
    __t.last.priced = priced; __t.last.rec = rec;
    /* hg-v913: this desk reads the records it writes. */
    if (slot) slot.innerHTML = (typeof W.hgGoldFwdNote === 'function' ? W.hgGoldFwdNote('tauric') : '')
      + ((priced && priced.tapeNote) || '') + verdictHtml(rating, priced, cost, rec);
  });
}

function runPreflight(){
  var ui = __t.ui;
  if (ui && ui.stat) ui.stat.textContent = 'preflight…';
  return fetch('/api/tauric/preflight?symbol=' + encodeURIComponent(TAURIC_SYMBOL),
               { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(pre){
      __t.pre = pre;
      if (ui && ui.body) ui.body.innerHTML = blockedHtml(pre) + preflightHtml(pre);
      if (ui && ui.stat){
        ui.stat.textContent = pre && pre.ok ? 'ready — press RUN PIPELINE'
                                            : 'blocked: ' + ((pre && pre.blocked) || 'unknown');
      }
      if (ui && ui.run) ui.run.disabled = !(pre && pre.ok);
      return pre;
    })
    .catch(function(e){
      __t.pre = { blocked: 'server', error: String((e && e.message) || e) };
      if (ui && ui.body) ui.body.innerHTML = blockedHtml(__t.pre);
      if (ui && ui.stat) ui.stat.textContent = 'preflight failed';
      return __t.pre;
    });
}

function runPipeline(){
  if (__t.busy) return Promise.resolve('busy');
  var ui = __t.ui;
  __t.busy = true;
  if (ui && ui.run) ui.run.disabled = true;
  if (ui && ui.stat) ui.stat.textContent = 'running the pipeline — this is minutes, not seconds…';
  if (ui && ui.body) ui.body.innerHTML = '<div class="note">Four analysts, a bull/bear debate, a '
    + 'trader and a three-way risk debate are running against your own key and quota. '
    + 'Nothing is shown until they finish.</div>';

  return fetch('/api/tauric/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: TAURIC_SYMBOL, depth: 1 })
    })
    .then(function(r){ return r.json(); })
    .then(function(out){
      renderRun(out);
      if (ui && ui.stat) ui.stat.textContent = out && out.ran
        ? ('done · ' + esc(String(out.signal || 'no rating')))
        : ('did not run: ' + ((out && out.blocked) || 'unknown'));
      __t.ranOnce = true;
      return out && out.ran ? 'ok' : 'blocked';
    })
    .catch(function(e){
      if (ui && ui.body) ui.body.innerHTML = blockedHtml({ blocked: 'server',
        error: String((e && e.message) || e) });
      if (ui && ui.stat) ui.stat.textContent = 'run failed';
      return 'error';
    })
    .finally(function(){
      __t.busy = false;
      if (ui && ui.run) ui.run.disabled = !(__t.pre && __t.pre.ok);
    });
}

function mountTauric(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>TAURIC <span>TradingAgents multi-agent pipeline · XAUUSD</span></h2>'
    + '<div class="note">Four analysts, a bull/bear research debate, a trader and a three-way risk '
    + 'debate — TauricResearch/TradingAgents, run out of process. It supplies the VIEW; this desk '
    + 'prices the LEVELS and applies its own rules to them.</div>'
    + '<div class="row" style="margin-top:8px">'
    + '<button class="btn" id="tauricRun" disabled>RUN PIPELINE</button>'
    + '<button class="btn" id="tauricPre">RE-CHECK</button>'
    + '<span class="note" id="tauricStat">preflight…</span></div>'
    + '<div id="tauricBody" style="margin-top:8px"></div></div>';

  __t.ui = { el: el,
             body: el.querySelector('#tauricBody'),
             stat: el.querySelector('#tauricStat'),
             run: el.querySelector('#tauricRun'),
             pre: el.querySelector('#tauricPre') };

  if (__t.ui.run) __t.ui.run.addEventListener('click', function(){ runPipeline(); });
  if (__t.ui.pre) __t.ui.pre.addEventListener('click', function(){ runPreflight(); });
  runPreflight();
}

/* A refresh must NEVER re-run the pipeline: the page's hard-refresh sweep
   calls every tab's refresh(), and a paid multi-agent run on a refresh
   button is how somebody burns a quota by pressing reload. Preflight only. */
function refreshTauric(){
  if (!__t.ui) return Promise.resolve('skipped: not mounted');
  return runPreflight().then(function(){ return 'ok'; });
}

W.hgTauricRating = hgTauricRating;
W.hgTauricPricePlan = hgTauricPricePlan;
W.hgTauricRecord = hgTauricRecord;
W.hgTauricCostNote = hgTauricCostNote;
W.HG_TAURIC_TAB = TAURIC_TAB;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'tauric', label: 'TAURIC', mount: mountTauric, refresh: refreshTauric });
})();
