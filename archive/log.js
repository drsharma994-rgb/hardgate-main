/* log.js \u2014 Setup log persistence, outcome grading, and rendering.
 * Extracted from index.html (Phase 13). Loads after idb.js (uses idbGet/idbSet).
 * Functions become globals via script scope: loadLog, saveLog, logSetup,
 * checkOutcomes, renderLog, exportLog, clearLog, renderLogBadge, plus LOG_KEY.
 * Runtime deps resolved at call-time from inline blocks: S, nowSec, $, getCandles, fmt.
 */
/* =============================================================================
   SETUP LOG \u2014 every CLEAN setup auto-logs; outcomes graded from candle history.
   Conservative same-bar rule: stop and target in one bar counts as SL.
   localStorage only; EXPORT before clearing browser data.
   ============================================================================= */
const LOG_KEY='hardgate_log_v1';
function loadLog(){ try{ return JSON.parse(localStorage.getItem(LOG_KEY)||'[]'); }catch(e){ return []; } }
/* IndexedDB durability layer \u2014 localStorage stays the synchronous source of truth,
   IDB is a durable mirror (localStorage caps ~5MB and can be evicted). */
(async function(){ try{ if((JSON.parse(localStorage.getItem(LOG_KEY)||'[]')).length===0){ const backup=await idbGet(LOG_KEY); if(Array.isArray(backup)&&backup.length){ localStorage.setItem(LOG_KEY, JSON.stringify(backup)); if(typeof renderLogBadge==='function') renderLogBadge(); } } }catch(e){} })();
function saveLog(l){ try{ if (l.length>1000) l = l.slice(l.length-1000); localStorage.setItem(LOG_KEY, JSON.stringify(l)); idbSet(LOG_KEY, l); }catch(e){} }
function logSetup(sym,dir,kind,entry,stop,t1){
  if (!(isFinite(entry)&&isFinite(stop)&&isFinite(t1)&&Math.abs(entry-stop)>0)) return;
  const l=loadLog();
  const cut=nowSec()-12*3600;
  if (l.some(e=>e.sym===sym&&e.dir===dir&&e.kind===kind&&e.ts>cut)) return; // dedupe: same setup within 12h
  l.push({ id:Date.now().toString(36)+Math.floor(Math.random()*1e4), ts:nowSec(), ex:S.exchange,
           sym, dir, kind, entry, stop, t1, rr:Math.abs(t1-entry)/Math.abs(entry-stop), status:'open' });
  saveLog(l); renderLogBadge();
}
async function checkOutcomes(){
  const l=loadLog(); const btn=$('logCheck'); btn.disabled=true; $('logStat').textContent='checking\u2026';
  let checked=0, skipped=0;
  for (const e of l){
    if (e.status!=='open') continue;
    if (e.ex!==S.exchange){ skipped++; continue; }
    try{
      const age = nowSec()-e.ts;
      const res = age<2*86400 ? '15m' : age<12*86400 ? '1h' : '4h';
      const secPer = {'15m':900,'1h':3600,'4h':14400}[res]; const maxBars = 24; const maxTimeAllowed = e.ts + (maxBars * secPer);
      const rows = (await getCandles(e.sym,res,Math.min(300,Math.ceil(age/secPer)+5))).filter(r=>r.t>=e.ts);
      for (const b of rows){
        const hitSL = e.dir==='long' ? b.l<=e.stop : b.h>=e.stop;
        const hitTP = e.dir==='long' ? b.h>=e.t1  : b.l<=e.t1; if (hitSL && hitTP && res!=='15m'){ try{ const sub = await candlesRangeRaw(e.sym, '15m', b.t, b.t+secPer); let rS=null, rT=null; for (const sb of sub){ const subSL = e.dir==='long' ? sb.l<=e.stop : sb.h>=e.stop; const subTP = e.dir==='long' ? sb.h>=e.t1 : sb.l<=e.t1; if (subSL){ rS='sl'; rT=sb.t; break; } if (subTP){ rS='tp'; rT=sb.t; break; } } if (rS){ e.status=rS; e.doneTs=rT; break; } }catch(err){} }
        if (hitSL){ e.status='sl'; e.doneTs=b.t; break; }   // same-bar ambiguity \u2192 SL, always
        if (hitTP){ e.status='tp'; e.doneTs=b.t; break; } if (b.t >= maxTimeAllowed && e.status==='open'){ e.status='time_stop'; e.doneTs=b.t; e.rr=-0.1; break; }
      }
      if (e.status==='open' && age>14*86400) e.status='exp';
      checked++;
    }catch(err){ /* symbol delisted or fetch failed \u2014 stays open */ }
    await sleep(60);
  }
  saveLog(l); renderLog();
  $('logStat').textContent = `checked ${checked} open${skipped?` \u00B7 ${skipped} skipped (other exchange)`:''}`;
  btn.disabled=false;
}
function renderLog(){
  const l=loadLog().slice().sort((a,b)=>b.ts-a.ts);
  const tp=l.filter(e=>e.status==='tp').length, sl=l.filter(e=>e.status==='sl').length,
        op=l.filter(e=>e.status==='open').length, ex=l.filter(e=>e.status==='exp').length; const tsStop = l.filter(e=>e.status==='time_stop').length;
  const closed=tp+sl;
  const sumR=l.reduce((a,e)=> a + (e.status==='tp' ? (e.rr||2) : e.status==='sl' ? -1 : e.status==='time_stop' ? (e.rr||-0.1) : 0), 0);
  $('logSummary').innerHTML = `logged <b>${l.length}</b> \u00B7 open <b>${op}</b> \u00B7 TP <b class="pos">${tp}</b> \u00B7 SL <b class="neg">${sl}</b> \u00B7 expired <b>${ex}</b> \u00B7 time-stop <b>${tsStop}</b> \u00B7 hit rate <b>${closed?fmt(tp/closed*100,1)+'%':'\u2014'}</b> \u00B7 \u03A3R <b class="${sumR>=0?'pos':'neg'}">${fmt(sumR,2)}R</b>${closed>0&&closed<30?' \u00B7 <span style="color:var(--gold)">n='+closed+' closed \u2014 far too small to call an edge</span>':''}`;
  $('logTable').innerHTML = l.length ? `<table><tr><th>time IST</th><th>sym</th><th>kind</th><th>dir</th><th>entry</th><th>stop</th><th>T1</th><th>R:R</th><th>status</th></tr>${
    l.map(e=>{
      const d=new Date((e.ts+19800)*1000).toISOString().slice(5,16).replace('T',' ');
      const st=e.status==='tp'?'<b class="pos">TP</b>':e.status==='sl'?'<b class="neg">SL</b>':e.status==='exp'?'<span style="color:var(--dim)">EXP</span>':e.status==='time_stop'?'<span style="color:var(--dim)">TIME_STOP</span>':'open';
      return `<tr><td>${d}</td><td>${e.sym}</td><td>${e.kind}</td><td>${e.dir.toUpperCase()}</td><td>${px(e.entry)}</td><td>${px(e.stop)}</td><td>${px(e.t1)}</td><td>${fmt(e.rr,2)}</td><td>${st}</td></tr>`;
    }).join('')}</table>` : '<div class="empty">Nothing logged yet. Run any scan \u2014 every CLEAN setup lands here automatically.</div>';
}
function exportLog(){
  const blob=new Blob([JSON.stringify(loadLog(),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='hardgate-log.json'; a.click();
}
function clearLog(){ if (confirm('Delete the entire setup log? Export first if you care about the sample.')){ saveLog([]); renderLog(); renderLogBadge(); } }
function renderLogBadge(){ const b=$('tabB_log'); if(b){ const n=loadLog().length; b.textContent = n?`LOG (${n})`:'LOG'; } }
