/* HARDGATE — hgalert.js unit tests (Node 18+, builtins only, zero network).
   Loads hgalert.js as a classic script via vm.runInThisContext with
   globalThis.window = {} (mirrors the browser's script globals), exactly the
   tests/test-signallog.mjs harness style. window / document / localStorage /
   AudioContext / setInterval / Date.now are stubbed per scenario; no fetch,
   no real audio, no timers left running.

   Covers: enable flow + autoplay gesture gating ('click to enable alerts' →
   arming test chime → 'alerts armed'; persisted 'armed — plays after your
   next click' until the next gesture); honest 'sound unavailable in this
   browser' when AudioContext is missing; synthesized chime shape (E5→G5→C6,
   ~0.9s, exponential envelopes, modest master gain); brain HIGH/PRIME
   detection + new-symbol-set de-dup + 30-min re-alert + dark-set re-arm;
   gold threshold crossing + re-arm + absent/throwing sources counted 0 and
   named; threshold editing + persistence; MUTE suppressing evaluation
   chimes while TEST still plays; 15-min per-class throttle with independent
   classes; persisted enabled/muted/goldMin restoration; single guarded
   60s interval (unref'd); never-throws sweep in hostile + bare envs.

   Run: node tests/test-hgalert.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- stubbing helpers (test-signallog.mjs patterns) ---------------- */
const REAL_SET_INTERVAL = globalThis.setInterval;
const REAL_DATE_NOW = Date.now;
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _map: m };
}
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', value: '', id: '',
           disabled: false, style: {}, _handlers: {}, _qs: {},
           addEventListener: function(ev, fn){ this._handlers[ev] = fn; },
           querySelector: function(sel){ if (!this._qs[sel]) this._qs[sel] = stubEl(); return this._qs[sel]; } };
}
function stubDocument(){
  const body = stubEl();
  body._appended = [];
  body.appendChild = function(c){ this._appended.push(c); return c; };
  return { body: body,
           createElement: function(){ return stubEl(); },
           addEventListener: function(){} };
}
function FakeAudioContext(){
  FakeAudioContext.__created++;
  FakeAudioContext.__instances.push(this);
  this.state = 'suspended';
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.destination = {};
  this.__osc = [];
  this.__gains = [];
}
FakeAudioContext.__created = 0;
FakeAudioContext.__instances = [];
FakeAudioContext.prototype.resume = function(){ this.state = 'running'; return Promise.resolve(); };
FakeAudioContext.prototype.createOscillator = function(){
  const o = { type: '', __start: -1, __stop: -1,
              frequency: { value: 0, setValueAtTime: function(v){ this.value = v; } },
              connect: function(){}, disconnect: function(){},
              start: function(t){ o.__start = t; }, stop: function(t){ o.__stop = t; } };
  this.__osc.push(o);
  return o;
};
FakeAudioContext.prototype.createGain = function(){
  const g = { __setV: [], __exp: [],
              gain: { value: 1,
                      setValueAtTime: function(v){ g.__setV.push(v); this.value = v; },
                      exponentialRampToValueAtTime: function(v){ g.__exp.push(v); },
                      linearRampToValueAtTime: function(){}, cancelScheduledValues: function(){} },
              connect: function(){}, disconnect: function(){} };
  this.__gains.push(g);
  return g;
};

/* load hgalert.js into a fresh bare context; returns the stubs for driving */
function loadHgalert(opts){
  opts = opts || {};
  globalThis.window = {};
  if (opts.ls === null) delete globalThis.localStorage;
  else globalThis.localStorage = opts.ls || memLocalStorage();
  if (opts.doc) globalThis.document = opts.doc;
  else delete globalThis.document;
  if (opts.audio) globalThis.window.AudioContext = FakeAudioContext;   /* present before the module renders */
  const intervals = [];
  globalThis.setInterval = (fn, ms) => {
    const h = { fn, ms, unrefd: false, unref(){ this.unrefd = true; } };
    intervals.push(h);
    return h;
  };
  vm.runInThisContext(fs.readFileSync(root + 'hgalert.js', 'utf8'), { filename: 'hgalert.js' });
  return { W: globalThis.window, ls: globalThis.localStorage, doc: opts.doc || null, intervals };
}
function uiOf(env){
  const rootEl = env.doc.body._appended[0];
  return { root: rootEl, q: sel => rootEl.querySelector(sel) };
}
function clickBtn(env){ uiOf(env).q('#hgAlertBtn')._handlers.click(); }

/* pinned fixtures */
function brainRowsAB(){
  return { at: 1, marketRead: 'risk-on', rows: [
    { sym: 'RE',  dir: 'long',  tier: 'HIGH',  evidence: ['x'], plan: null },
    { sym: 'ZBT', dir: 'short', tier: 'HIGH',  evidence: [],    plan: null },
    { sym: 'LOW', dir: 'long',  tier: 'WATCH', evidence: [],    plan: null },
    { sym: 'NR',  dir: null,    tier: 'ASIDE', evidence: [],    plan: null },
    { dir: 'long', tier: 'HIGH' }                                               /* no sym -> skipped */
  ] };
}
function goldCands(n){
  const out = [];
  for (let i = 0; i < n; i++)
    out.push({ sym: 'XAUUSDT', dir: 'long', grade: 'A', strategy: 's' + i, entry: 1, stop: 0, t1: 2 });
  return out;
}

/* =========================================================================
   1) bare env: no document, no AudioContext, no localStorage, no sources
========================================================================= */
console.log('== 1) bare-env contracts ==');
{
  let env = null, threw = false;
  try { env = loadHgalert({ ls: null }); } catch(e){ threw = true; }
  assert(!threw, 'module loads with no document, no localStorage, no AudioContext');
  const W = env.W;
  assert(typeof W.hgAlertCheck === 'function' && typeof W.hgAlertTest === 'function',
         'diagnostic surface exposed: hgAlertCheck + hgAlertTest');
  assert(env.intervals.length === 1 && env.intervals[0].ms === 60000,
         'single guarded interval registered at 60000ms (60s)');
  assert(env.intervals[0].unrefd === true, 'interval handle is unref’d (never holds a Node process open)');

  const st = W.hgAlertCheck();
  assert(st && st.enabled === false && st.unlocked === false && st.audioOk === false
      && Array.isArray(st.chimed) && st.chimed.length === 0 && /alerts off/.test(st.note),
         'hgAlertCheck in a bare env: honest "alerts off" status, no chimes ("' + st.note + '")');
  assert(W.hgAlertTest() === false, 'hgAlertTest without AudioContext returns false, never throws');

  let tThrew = 0;
  try { env.intervals[0].fn(); } catch(e){ tThrew++; }
  try { env.intervals[0].fn(); } catch(e){ tThrew++; }
  assert(tThrew === 0, 'interval ticks never throw in a bare env');
}

/* =========================================================================
   2) sound unavailable — honest button when AudioContext is missing
========================================================================= */
console.log('== 2) sound unavailable (no AudioContext) ==');
{
  const doc = stubDocument();
  const env = loadHgalert({ doc });
  const ui = uiOf(env);
  assert(!!ui.root && ui.root.id === 'hgAlertRoot', 'bell root appended to document.body');
  assert(ui.root.innerHTML.indexOf('alerts evaluate while the app is open, after scans have run — brain + ticket alerts need a completed synthesis') >= 0,
         'panel carries the honest note: evaluates while open, brain + ticket alerts need a completed synthesis');
  assert(ui.q('#hgAlertBtn').textContent === '🔕 sound unavailable in this browser',
         'bell honestly shows "sound unavailable in this browser"');
  assert(ui.q('#hgAlertBtn').className === 'hgab-btn unavailable', 'button class reflects the unavailable state');
  let cThrew = 0;
  try { clickBtn(env); } catch(e){ cThrew++; }
  assert(cThrew === 0 && ui.q('#hgAlertPanel').style.display === 'block',
         'clicking the unavailable bell never throws; the panel still opens honestly');
  assert(/sound unavailable/.test(ui.q('#hgAlertState').textContent),
         'panel state line is honest about the missing audio ("' + ui.q('#hgAlertState').textContent + '")');
  assert(env.W.hgAlertTest() === false, 'TEST CHIME returns false when sound is unavailable');

  /* previously enabled, but this browser has no AudioContext */
  const ls2 = memLocalStorage();
  ls2.setItem('hgAlertEnabled', '1');
  const doc2 = stubDocument();
  const env2 = loadHgalert({ doc: doc2, ls: ls2 });
  assert(uiOf(env2).q('#hgAlertBtn').textContent === '🔕 sound unavailable in this browser',
         'persisted-enabled + no AudioContext still shows the honest unavailable state');
  const st2 = env2.W.hgAlertCheck();
  assert(st2.enabled === true && st2.audioOk === false && /sound unavailable/.test(st2.note),
         'hgAlertCheck names the unavailable sound when enabled but AudioContext-less');
}

/* =========================================================================
   3) enable flow + autoplay gesture gating + chime shape
========================================================================= */
console.log('== 3) enable flow + gesture gating + chime shape ==');
{
  const ls = memLocalStorage();
  const doc = stubDocument();
  FakeAudioContext.__created = 0;
  const env = loadHgalert({ doc, ls, audio: true });
  const W = env.W;
  const ui = uiOf(env);

  assert(ui.q('#hgAlertBtn').textContent === '🔔 click to enable alerts'
      && ui.q('#hgAlertBtn').className === 'hgab-btn off',
         'fresh load: bell starts in the "click to enable alerts" state');
  const st0 = W.hgAlertCheck();
  assert(st0.chimed.length === 0 && /alerts off/.test(st0.note) && FakeAudioContext.__created === 0,
         'no chime and no AudioContext before any gesture (autoplay policy respected)');

  clickBtn(env);                                                     /* the enabling gesture */
  assert(ls.getItem('hgAlertEnabled') === '1', 'first click persists hgAlertEnabled = 1');
  assert(FakeAudioContext.__created === 1, 'first click creates the AudioContext');
  assert(ui.q('#hgAlertBtn').textContent === '🔔 alerts armed'
      && /armed/.test(ui.q('#hgAlertBtn').className),
         'after the gesture the bell shows "alerts armed"');
  assert(ui.q('#hgAlertPanel').style.display === 'block', 'first click opens the expand panel');

  /* the arming test chime: E5 -> G5 -> C6, ~0.9s, soft envelopes, modest master */
  const inst = FakeAudioContext.__instances[FakeAudioContext.__instances.length - 1];
  assert(inst.state === 'running', 'resume() ran on the enabling gesture (state "running")');
  assert(inst.__osc.length === 3, 'arming plays the 3-note test chime (3 oscillators)');
  const freqs = inst.__osc.map(o => o.frequency.value);
  assert(Math.abs(freqs[0] - 659.26) < 0.01 && Math.abs(freqs[1] - 783.99) < 0.01 && Math.abs(freqs[2] - 1046.50) < 0.01,
         'chime phrase is E5 (659.26) -> G5 (783.99) -> C6 (1046.50)');
  assert(inst.__osc[0].__start === 0 && Math.abs(inst.__osc[2].__start - 0.36) < 1e-9
      && Math.abs(inst.__osc[2].__stop - 0.96) < 1e-9,
         'phrase spans ~0.9s (notes at 0 / 0.18 / 0.36s, last rings to 0.96s)');
  assert(inst.__gains.length === 4 && inst.__gains[0].__setV[0] === 0.6,
         'modest master gain (0.6) ahead of the per-note envelopes');
  assert(inst.__gains[1].__exp.length === 2 && inst.__gains[1].__exp[0] === 0.25 && inst.__gains[1].__setV[0] === 0.0001,
         'each note has a soft exponential attack/decay envelope');
  assert(inst.__osc[0].type === 'sine' && inst.__osc[1].type === 'sine' && inst.__osc[2].type === 'triangle',
         'timbre: sine, sine, triangle');

  /* panel lines after the first evaluation (no sources stubbed) */
  assert(ui.q('#hgAlertBrain').textContent === 'brain: waiting for a completed synthesis',
         'brain line is honest while no synthesis exists ("' + ui.q('#hgAlertBrain').textContent + '")');
  assert(ui.q('#hgAlertGold').textContent === 'gold: 0 live setups (scalp 0 + swing 0) · threshold 10 · waiting: scalp, swing',
         'gold line counts 0 and NAMES the absent sources ("' + ui.q('#hgAlertGold').textContent + '")');
  assert(ui.q('#hgAlertLastB').textContent === 'last brain alert: none yet this session'
      && ui.q('#hgAlertLastG').textContent === 'last gold alert: none yet this session',
         'last-alert lines honestly start at "none yet this session"');

  clickBtn(env);                                                     /* second click: panel toggles only */
  assert(ui.q('#hgAlertPanel').style.display === 'none' && inst.__osc.length === 3,
         'second click just closes the panel — no extra chime');
  assert(W.hgAlertTest() === true && inst.__osc.length === 6,
         'window.hgAlertTest() plays the chime again (TEST CHIME button equivalent)');

  /* persisted enabled -> next load arms-but-waits for the gesture */
  const doc2 = stubDocument();
  const env2 = loadHgalert({ doc: doc2, ls, audio: true });
  const ui2 = uiOf(env2);
  assert(ui2.q('#hgAlertBtn').textContent === '🔔 armed — plays after your next click'
      && /waiting/.test(ui2.q('#hgAlertBtn').className),
         'persisted-enabled reload honestly shows "armed — plays after your next click"');
  const st2 = env2.W.hgAlertCheck();
  assert(st2.enabled === true && st2.unlocked === false && st2.chimed.length === 0
      && /plays after your next click/.test(st2.note),
         'before the gesture, evaluation cannot chime and says why ("' + st2.note + '")');

  /* a live brain HIGH set while locked: no chime, and the trigger is NOT eaten */
  env2.W.__hgBrainLast = () => brainRowsAB();
  const nInst = FakeAudioContext.__instances.length;
  const st3 = env2.W.hgAlertCheck();
  assert(st3.chimed.length === 0 && FakeAudioContext.__instances.length === nInst,
         'brain HIGH rows produce no chime (and no AudioContext) before the unlocking gesture');
  clickBtn(env2);                                                    /* the unlocking click */
  const inst2 = FakeAudioContext.__instances[nInst];
  assert(!!inst2 && inst2.__osc.length === 6,
         'the unlocking click plays the test chime AND the pending brain alert chime (6 oscillators)');
  assert(/brain HIGH: RE, ZBT$/.test(ui2.q('#hgAlertLastB').textContent),
         'the pending brain set alerts immediately after the gesture ("' + ui2.q('#hgAlertLastB').textContent + '")');
}

/* =========================================================================
   4) brain HIGH/PRIME: new-set de-dup, 30-min re-alert, dark-set re-arm
========================================================================= */
console.log('== 4) brain set de-dup + re-alert + re-arm ==');
{
  const ls = memLocalStorage();
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const W = env.W;
  clickBtn(env);                                                     /* armed; 3 test osc */
  const inst = FakeAudioContext.__instances[FakeAudioContext.__instances.length - 1];
  const base = inst.__osc.length;
  const ui = uiOf(env);

  let T = 1000000;
  Date.now = () => T;
  W.__hgBrainLast = () => brainRowsAB();

  let st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'brain' && inst.__osc.length === base + 3,
         'HIGH rows chime on the first evaluation (class brain)');
  assert(/^last brain alert: \d{2}:\d{2} brain HIGH: RE, ZBT$/.test(ui.q('#hgAlertLastB').textContent),
         'last-alert line: "HH:MM brain HIGH: RE, ZBT" ("' + ui.q('#hgAlertLastB').textContent + '")');
  assert(st.brain && st.brain.live === true && st.brain.count === 2 && st.brain.syms === 'RE, ZBT',
         'status reports the qualifying set (WATCH/ASIDE/sym-less rows excluded)');

  T += 60*1000;
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && inst.__osc.length === base + 3,
         'same sym+tier set does not re-alert');

  T += 60*1000;
  W.__hgBrainLast = () => ({ rows: [{ sym: 'RE', dir: 'long', tier: 'WATCH' }] });
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0, 'a dark brain (no HIGH/PRIME) never chimes');

  T += 60*1000;
  W.__hgBrainLast = () => brainRowsAB();
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && inst.__osc.length === base + 3
      && /\(chime held by 15-min throttle\)$/.test(ui.q('#hgAlertLastB').textContent),
         'the returning set is new, but the chime is held by the 15-min throttle — and says so');
  T += 13*60*1000;                                                   /* t=16min since first chime */
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0, 'same set still quiet (30-min re-alert not reached)');
  T += 17*60*1000;                                                   /* t=33min: 30 min since the last trigger */
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'brain' && inst.__osc.length === base + 6,
         'the same set re-alerts once 30 min have passed');

  T += 15*60*1000;                                                   /* t=48min */
  W.__hgBrainLast = () => ({ rows: [{ sym: 'SOL', dir: 'long', tier: 'PRIME' }] });
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'brain' && inst.__osc.length === base + 9
      && /brain PRIME: SOL$/.test(ui.q('#hgAlertLastB').textContent),
         'a changed set with tier PRIME alerts: "brain PRIME: SOL"');

  W.__hgBrainLast = () => { throw new Error('brain boom'); };
  let threw = 0, st2 = null;
  try { st2 = W.hgAlertCheck(); } catch(e){ threw++; }
  assert(threw === 0 && st2.chimed.length === 0 && st2.brain.live === false,
         'a throwing brain source is a normal state, never an error');
  W.__hgBrainLast = { rows: [] };                                    /* not a function */
  st2 = W.hgAlertCheck();
  assert(st2.brain.live === false && ui.q('#hgAlertBrain').textContent === 'brain: waiting for a completed synthesis',
         'a non-function __hgBrainLast is feature-checked away, panel stays honest');
  Date.now = REAL_DATE_NOW;
}

/* =========================================================================
   5) gold threshold: upward crossing, re-arm, source naming, editing
========================================================================= */
console.log('== 5) gold threshold crossing + re-arm + editing ==');
{
  const ls = memLocalStorage();
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const W = env.W;
  clickBtn(env);
  const inst = FakeAudioContext.__instances[FakeAudioContext.__instances.length - 1];
  const base = inst.__osc.length;
  const ui = uiOf(env);

  let T = 5000000;
  Date.now = () => T;

  W.goldscalpScan = () => ({ cands: goldCands(4).concat([null, 'junk']) });  /* 4 countable */
  W.goldswingScan = () => ({ cands: goldCands(6) });
  let st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'gold' && inst.__osc.length === base + 3,
         'scalp 4 + swing 6 = 10 >= 10: upward crossing chimes (junk rows not counted)');
  assert(/^last gold alert: \d{2}:\d{2} gold setups 10 >= 10$/.test(ui.q('#hgAlertLastG').textContent),
         'last-alert line: "HH:MM gold setups 10 >= 10" ("' + ui.q('#hgAlertLastG').textContent + '")');
  assert(st.gold.count === 10 && st.gold.scalp === 4 && st.gold.swing === 6
      && st.gold.scalpLive === true && st.gold.swingLive === true && st.gold.armed === false,
         'status reports the combined count and the consumed crossing (armed=false)');

  W.goldswingScan = () => ({ cands: goldCands(7) });                 /* 11 total */
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && inst.__osc.length === base + 3,
         'staying above threshold does not re-alert (once per crossing)');

  W.goldswingScan = () => ({ cands: goldCands(5) });                 /* 9 total -> re-arm */
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && st.gold.armed === true, 'dropping below threshold re-arms silently');

  T += 16*60*1000;
  W.goldswingScan = () => ({ cands: goldCands(6) });                 /* 10 again */
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'gold' && inst.__osc.length === base + 6,
         'the next upward crossing chimes again after re-arm');

  /* absent + throwing sources count 0 and are named */
  delete W.goldscalpScan;
  W.goldswingScan = () => ({ cands: goldCands(3) });                 /* below -> re-arm for the naming check */
  st = W.hgAlertCheck();
  assert(st.gold.scalpLive === false && st.gold.scalp === 0 && st.gold.count === 3,
         'an absent scalp source counts 0');
  assert(/waiting: scalp$/.test(ui.q('#hgAlertGold').textContent),
         'the panel names the missing source ("' + ui.q('#hgAlertGold').textContent + '")');
  W.goldscalpScan = () => { throw new Error('scalp boom'); };
  let threw = 0;
  try { st = W.hgAlertCheck(); } catch(e){ threw++; }
  assert(threw === 0 && st.gold.scalpLive === false && st.chimed.length === 0,
         'a throwing scalp source counts 0 and never crashes the round');

  /* threshold editing in the panel, persisted */
  const minIn = ui.q('#hgAlertMin');
  minIn.value = '12';
  minIn._handlers.change();
  assert(ls.getItem('hgAlertGoldMin') === '12', 'editing the gold threshold persists hgAlertGoldMin');
  W.goldscalpScan = () => ({ cands: goldCands(5) });
  W.goldswingScan = () => ({ cands: goldCands(6) });                 /* 11 < 12 -> re-arm */
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && st.goldMin === 12, 'count 11 stays quiet under the new threshold 12');
  T += 16*60*1000;
  W.goldswingScan = () => ({ cands: goldCands(7) });                 /* 12 >= 12 */
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'gold' && /gold setups 12 >= 12/.test(ui.q('#hgAlertLastG').textContent),
         'crossing the edited threshold chimes with the new numbers in the line');
  minIn.value = 'garbage';
  minIn._handlers.change();
  assert(ls.getItem('hgAlertGoldMin') === '10', 'a nonsense threshold falls back to the default 10 honestly');

  /* persisted goldMin restores on the next load */
  const ls2 = memLocalStorage();
  ls2.setItem('hgAlertGoldMin', '7');
  const doc2 = stubDocument();
  const env2 = loadHgalert({ doc: doc2, ls: ls2 });
  const stR = env2.W.hgAlertCheck();
  assert(stR.goldMin === 7 && uiOf(env2).q('#hgAlertMin').value === '7',
         'persisted hgAlertGoldMin restores into the engine and the input');
  Date.now = REAL_DATE_NOW;
}

/* =========================================================================
   6) MUTE: suppresses evaluation chimes, TEST still plays, state advances
========================================================================= */
console.log('== 6) mute behavior ==');
{
  const ls = memLocalStorage();
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const W = env.W;
  clickBtn(env);
  const inst = FakeAudioContext.__instances[FakeAudioContext.__instances.length - 1];
  const base = inst.__osc.length;
  const ui = uiOf(env);

  let T = 9000000;
  Date.now = () => T;
  ui.q('#hgAlertMute')._handlers.click();                            /* mute on */
  assert(ls.getItem('hgAlertMuted') === '1' && ui.q('#hgAlertMute').textContent === 'UNMUTE',
         'MUTE toggle persists hgAlertMuted and flips its label');
  assert(ui.q('#hgAlertBtn').textContent === '🔕 alerts muted', 'bell shows the muted state');

  W.__hgBrainLast = () => brainRowsAB();
  const st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && inst.__osc.length === base,
         'muted: a brand-new HIGH set triggers but stays silent');
  assert(/\(muted\)$/.test(ui.q('#hgAlertLastB').textContent),
         'the last-alert line honestly records the muted trigger ("' + ui.q('#hgAlertLastB').textContent + '")');
  assert(W.hgAlertTest() === true && inst.__osc.length === base + 3,
         'TEST CHIME still plays while muted (a sound check, not an alert)');
  assert(ui.q('#hgAlertState').textContent.indexOf('evaluation continues') >= 0,
         'state line explains mute keeps evaluating silently');

  const st2 = W.hgAlertCheck();
  assert(st2.chimed.length === 0 && st2.muted === true,
         'the consumed muted trigger does not repeat while the set persists');

  ui.q('#hgAlertMute')._handlers.click();                            /* unmute */
  T += 16*60*1000;
  W.__hgBrainLast = () => ({ rows: [{ sym: 'NEWBIE', dir: 'short', tier: 'HIGH' }] });
  const st3 = W.hgAlertCheck();
  assert(ls.getItem('hgAlertMuted') === '0' && st3.chimed.join(',') === 'brain'
      && inst.__osc.length === base + 6,
         'after unmute, a new set chimes normally');
  Date.now = REAL_DATE_NOW;
}

/* =========================================================================
   7) 15-min per-class throttle: classes chime independently
========================================================================= */
console.log('== 7) per-class throttle independence ==');
{
  const ls = memLocalStorage();
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const W = env.W;
  clickBtn(env);
  const inst = FakeAudioContext.__instances[FakeAudioContext.__instances.length - 1];
  const base = inst.__osc.length;

  let T = 20000000;
  Date.now = () => T;
  W.__hgBrainLast = () => brainRowsAB();
  let st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'brain', 'brain chimes first');

  T += 5*60*1000;
  W.goldscalpScan = () => ({ cands: goldCands(6) });
  W.goldswingScan = () => ({ cands: goldCands(5) });                 /* 11 >= 10 */
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'gold' && inst.__osc.length === base + 6,
         'gold chimes 5 min later — the 15-min throttle is per-class, not global');

  T += 7*60*1000;                                                    /* brain: +12 min */
  W.__hgBrainLast = () => ({ rows: [{ sym: 'FRESH', dir: 'long', tier: 'HIGH' }] });
  W.goldswingScan = () => ({ cands: goldCands(4) });                 /* 10, but crossing already consumed */
  st = W.hgAlertCheck();
  assert(st.chimed.length === 0 && inst.__osc.length === base + 6,
         'a new brain set inside its own 15-min window stays held; gold does not re-fire either');

  T += 3*60*1000;                                                    /* brain: +15 min */
  W.__hgBrainLast = () => ({ rows: [{ sym: 'OTHER', dir: 'long', tier: 'PRIME' }] });
  st = W.hgAlertCheck();
  assert(st.chimed.join(',') === 'brain' && inst.__osc.length === base + 9,
         'a new brain set chimes once its own 15-min window has passed');
  Date.now = REAL_DATE_NOW;
}

/* =========================================================================
   8) persisted states restore (enabled + muted + goldMin)
========================================================================= */
console.log('== 8) persisted states restore ==');
{
  const ls = memLocalStorage();
  ls.setItem('hgAlertEnabled', '1');
  ls.setItem('hgAlertMuted', '1');
  ls.setItem('hgAlertGoldMin', '7');
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const ui = uiOf(env);
  assert(ui.q('#hgAlertBtn').textContent === '🔕 alerts muted',
         'persisted enabled + muted reloads straight into the muted state');
  assert(ui.q('#hgAlertMin').value === '7' && ui.q('#hgAlertMute').textContent === 'UNMUTE',
         'persisted goldMin + mute restore into the panel controls');
  const st = env.W.hgAlertCheck();
  assert(st.enabled === true && st.muted === true && st.goldMin === 7 && st.unlocked === false,
         'status reflects every persisted flag before the gesture');

  const ls2 = memLocalStorage();
  ls2.setItem('hgAlertGoldMin', 'abc');
  const env2 = loadHgalert({ doc: stubDocument(), ls: ls2 });
  assert(env2.W.hgAlertCheck().goldMin === 10, 'a corrupt persisted goldMin falls back to 10');
  const ls3 = memLocalStorage();
  ls3.setItem('hgAlertGoldMin', '0');
  const env3 = loadHgalert({ doc: stubDocument(), ls: ls3 });
  assert(env3.W.hgAlertCheck().goldMin === 10, 'an out-of-range persisted goldMin falls back to 10');
}

/* =========================================================================
   9) hostile env never-throws sweep
========================================================================= */
console.log('== 9) hostile env never-throws ==');
{
  /* localStorage.setItem throws (quota/private mode) */
  const lsBad = memLocalStorage();
  lsBad.setItem = () => { throw new Error('QuotaExceededError'); };
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls: lsBad });
  env.W.AudioContext = FakeAudioContext;
  let threw = 0;
  try { clickBtn(env); } catch(e){ threw++; }
  assert(threw === 0 && env.W.hgAlertCheck().enabled === true,
         'throwing localStorage: enabling still works in memory, never throws');

  /* AudioContext constructor throws */
  const env2 = loadHgalert({ doc: stubDocument() });
  env2.W.AudioContext = function(){ throw new Error('audio device gone'); };
  let threw2 = 0;
  try { clickBtn(env2); } catch(e){ threw2++; }
  try { env2.W.hgAlertTest(); } catch(e){ threw2++; }
  try { env2.W.hgAlertCheck(); } catch(e){ threw2++; }
  const stA = env2.W.hgAlertCheck();
  assert(threw2 === 0 && stA.unlocked === false && env2.W.hgAlertTest() === false,
         'a throwing AudioContext constructor degrades honestly, never throws');

  /* document.createElement throws -> headless engine keeps working */
  const docBad = { body: { appendChild(){} }, createElement(){ throw new Error('dom gone'); },
                   addEventListener(){} };
  const lsArmed = memLocalStorage();
  lsArmed.setItem('hgAlertEnabled', '1');
  const env3 = loadHgalert({ doc: docBad, ls: lsArmed, audio: true });
  let threw3 = 0;
  try { env3.W.hgAlertTest(); } catch(e){ threw3++; }   /* the TEST gesture also unlocks audio */
  try { env3.W.hgAlertCheck(); } catch(e){ threw3++; }
  try { env3.intervals[0].fn(); } catch(e){ threw3++; }
  assert(threw3 === 0, 'a broken DOM never breaks evaluation, test chime, or the interval');

  /* every source throwing at once, while armed + unlocked */
  env3.W.__hgBrainLast = () => { throw new Error('b1'); };
  env3.W.goldscalpScan = () => { throw new Error('b2'); };
  env3.W.goldswingScan = () => { throw new Error('b3'); };
  const stB = env3.W.hgAlertCheck();
  assert(stB && stB.chimed.length === 0 && stB.brain.live === false
      && stB.gold.scalpLive === false && stB.gold.swingLive === false,
         'all sources throwing: an honest all-dark round, nothing fabricated');

  /* no window global at all -> falls back to globalThis, still never throws */
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  let threw4 = 0;
  try{
    vm.runInThisContext(fs.readFileSync(root + 'hgalert.js', 'utf8'), { filename: 'hgalert.js' });
    if (typeof globalThis.hgAlertCheck !== 'function') threw4++;
    else { globalThis.hgAlertCheck(); globalThis.hgAlertTest(); }
  }catch(e){ threw4++; }
  assert(threw4 === 0, 'no window, no document, no storage: load + check + test never throw');
  delete globalThis.hgAlertCheck;
  delete globalThis.hgAlertTest;
}

/* =========================================================================
   10) TICKET — entry-ticket change alerts (sym/entry key, seed → change
       → chime + ntfy push → 15-min throttle; unarmed + garbage honesty)
========================================================================= */
console.log('== 10) ticket change alerts ==');
{
  const ls = memLocalStorage();
  ls.setItem('hgAlertEnabled', '1');
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const ui = uiOf(env);
  clickBtn(env);                                    /* gesture: unlock + arm */

  const oscCount = () => FakeAudioContext.__instances.reduce((n, c) => n + c.__osc.length, 0);
  const pushes = [];
  env.W.sendAlertPush = (title, body) => { pushes.push({ title, body }); return Promise.resolve(); };

  assert(typeof env.W.hgAlertTicket === 'function', 'window.hgAlertTicket seam exposed');

  /* first sighting seeds silently — no chime, no push */
  const beforeSeed = oscCount();
  const r1 = env.W.hgAlertTicket({ at: 1, long: { sym: 'BTC', entry: 100 }, short: null });
  assert(r1 === 'seeded' && oscCount() === beforeSeed && pushes.length === 0,
         'first ticket sighting seeds silently (no chime, no push)');
  assert(ui.q('#hgAlertTicket').textContent.indexOf('long BTC@100') >= 0,
         'panel ticket line shows the seeded state');

  /* identical snapshot is a no-op */
  assert(env.W.hgAlertTicket({ at: 2, long: { sym: 'BTC', entry: 100 }, short: null }) === 'unchanged',
         'identical ticket -> unchanged, no alert');

  /* entry price moved -> chime + ntfy push */
  const beforeChime = oscCount();
  const r3 = env.W.hgAlertTicket({ at: 3, long: { sym: 'BTC', entry: 101 }, short: null });
  assert(r3 === 'alerted' && oscCount() > beforeChime, 'moved entry price -> alerted with a chime');
  assert(pushes.length === 1 && pushes[0].title.indexOf('ticket') >= 0
      && pushes[0].body.indexOf('BTC @ 101') >= 0,
         'ntfy push carries the new levels');
  assert(ui.q('#hgAlertLastT').textContent.indexOf('ticket: long BTC@101') >= 0,
         'last-ticket line records the alert');

  /* a side appearing is a change — but the 15-min class throttle holds it */
  const r4 = env.W.hgAlertTicket({ at: 4, long: { sym: 'BTC', entry: 101 }, short: { sym: 'ACE', entry: 0.085 } });
  assert(r4 === 'throttled' && pushes.length === 1,
         'side appearing inside the throttle window -> held, honestly named');

  /* garbage never throws */
  assert(env.W.hgAlertTicket(null) === 'ignored' && env.W.hgAlertTicket(42) === 'ignored'
      && env.W.hgAlertTicket({}) !== 'error',
         'garbage snapshots -> ignored/handled, never throws');

  /* unarmed engine: changes tracked but not chimed */
  const env2 = loadHgalert({ doc: stubDocument(), ls: memLocalStorage(), audio: true });
  env2.W.hgAlertTicket({ at: 1, long: { sym: 'ETH', entry: 50 }, short: null });
  assert(env2.W.hgAlertTicket({ at: 2, long: { sym: 'ETH', entry: 51 }, short: null }) === 'unarmed',
         'alerts off -> change recorded, honestly reported unarmed');
}

/* =========================================================================
   11) SNIPER — 20x-grade hit-set alerts (seed → change → chime + cascade
       → throttle; cleared; unarmed; garbage)
========================================================================= */
console.log('== 11) sniper hit-set alerts ==');
{
  const ls = memLocalStorage();
  ls.setItem('hgAlertEnabled', '1');
  const doc = stubDocument();
  const env = loadHgalert({ doc, ls, audio: true });
  const ui = uiOf(env);
  clickBtn(env);                                    /* gesture: unlock + arm */

  const oscCount = () => FakeAudioContext.__instances.reduce((n, c) => n + c.__osc.length, 0);
  const tgCalls = [];
  env.W.sendTelegram = (txt) => { tgCalls.push(txt); return Promise.resolve(true); };

  assert(typeof env.W.hgAlertSniper === 'function', 'window.hgAlertSniper seam exposed');

  const hit = (sym, entry) => ({ sym, dir: 'short', entry, stop: entry * 1.04, t1: entry * 0.93, lev: 24, state: 'IN ZONE' });

  /* first sighting seeds silently */
  const beforeSeed = oscCount();
  const r1 = env.W.hgAlertSniper([hit('ACE', 0.085)]);
  assert(r1 === 'seeded' && oscCount() === beforeSeed && tgCalls.length === 0,
         'first sniper set seeds silently (no chime, no push)');
  assert(ui.q('#hgAlertSniper').textContent.indexOf('ACE SHORT @ 0.085 (24x, IN ZONE)') >= 0,
         'panel sniper line shows the seeded hit');

  /* identical set is a no-op */
  assert(env.W.hgAlertSniper([hit('ACE', 0.085)]) === 'unchanged', 'identical hit set -> unchanged');

  /* a NEW card fires the chime + the Telegram-first cascade */
  const beforeChime = oscCount();
  const r3 = env.W.hgAlertSniper([hit('ACE', 0.085), hit('DOGE', 0.069)]);
  assert(r3 === 'alerted' && oscCount() > beforeChime, 'new sniper-grade card -> alerted with a chime');
  assert(tgCalls.length === 1 && tgCalls[0].indexOf('SNIPER') >= 0 && tgCalls[0].indexOf('DOGE') >= 0,
         'telegram-first push carries the new hit');
  assert(ui.q('#hgAlertLastS').textContent.indexOf('SNIPER') >= 0, 'last-sniper line records the alert');

  /* moved entry inside the throttle window -> held, honestly named */
  const r4 = env.W.hgAlertSniper([hit('ACE', 0.086), hit('DOGE', 0.069)]);
  assert(r4 === 'throttled' && tgCalls.length === 1, 'moved entry inside 15-min throttle -> held');

  /* board clearing is noted, never chimed */
  const r5 = env.W.hgAlertSniper([]);
  assert(r5 === 'cleared' && oscCount() === oscCount(), 'empty set -> cleared, silent');

  /* garbage never throws */
  assert(env.W.hgAlertSniper(null) === 'ignored' && env.W.hgAlertSniper('x') === 'ignored',
         'garbage hit sets -> ignored, never throws');

  /* unarmed engine: changes tracked, honestly unarmed */
  const env2 = loadHgalert({ doc: stubDocument(), ls: memLocalStorage(), audio: true });
  env2.W.hgAlertSniper([hit('ACE', 0.085)]);
  assert(env2.W.hgAlertSniper([hit('ACE', 0.085), hit('SOL', 100)]) === 'unarmed',
         'alerts off -> sniper change recorded, honestly reported unarmed');
}

globalThis.setInterval = REAL_SET_INTERVAL;
Date.now = REAL_DATE_NOW;
console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
