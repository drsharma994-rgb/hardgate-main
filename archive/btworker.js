/* btworker.js -- Phase 9 backtest worker runner extracted from index.html
   Off-main-thread compute plumbing: module-level worker handle + __btGetWorker
   and runBacktestWorker. Self-contained; no external deps, no credentials, no
   network. Callers (runScalpBacktestUI etc.) invoke runBacktestWorker at call-time. */
// ---- Phase 9: backtest worker runner (off-main-thread compute, sync fallback) ----
let __btWorker = null, __btSeq = 0, __btPending = {};
function __btGetWorker(){
  if (__btWorker) return __btWorker;
  try {
    __btWorker = new Worker('backtest-worker.js');
    __btWorker.onmessage = function(ev){
      const d = ev.data || {}; const cb = __btPending[d.id];
      if (!cb) return; delete __btPending[d.id];
      if (d.ok) cb.resolve(d.res); else cb.reject(new Error(d.error||"worker error"));
    };
    __btWorker.onerror = function(){ /* fall back handled per-call */ };
  } catch (e){ __btWorker = null; }
  return __btWorker;
}
function runBacktestWorker(type, payload){
  return new Promise(function(resolve, reject){
    const w = __btGetWorker();
    // Fallback: no worker available (older browser / CSP) -> run synchronously.
    if (!w){
      try {
        let res;
        if (type==="scalp") res = backtestScalpTD(payload.h1, payload.m15);
        else if (type==="swing") res = backtestSwingTD(payload.c4);
        else if (type==="judas") res = backtestJudasTD(payload.d1, payload.h1, payload.m15);
        else throw new Error("unknown backtest type");
        resolve(res);
      } catch(e){ reject(e); }
      return;
    }
    const id = ++__btSeq;
    __btPending[id] = { resolve: resolve, reject: reject };
    // Safety timeout -> fall back to sync if worker never replies.
    setTimeout(function(){
      if (!__btPending[id]) return; delete __btPending[id];
      try {
        let res;
        if (type==="scalp") res = backtestScalpTD(payload.h1, payload.m15);
        else if (type==="swing") res = backtestSwingTD(payload.c4);
        else if (type==="judas") res = backtestJudasTD(payload.d1, payload.h1, payload.m15);
        resolve(res);
      } catch(e){ reject(e); }
    }, 15000);
    w.postMessage(Object.assign({ id: id, type: type }, payload));
  });
}
