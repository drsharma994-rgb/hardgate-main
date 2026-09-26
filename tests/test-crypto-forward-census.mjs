/* HARDGATE — the crypto forward-log writers, driven (hg-v986).

   hg-v981 and hg-v985 fixed record blocks that had been dead or mis-dated for
   the life of the ledger (OI FLOW never wrote a record; SQUEEZE's mark never
   landed) and found them only by DRIVING the real scan with hg-forward loaded.
   A textual pin proves the shape of a record literal and nothing about whether
   the code around it reaches that literal, throws before it, or hands it a
   direction in the wrong case. This guard drives each crypto writer through
   its real scan on a synthetic tape whose last closed bar is one bar behind
   the clock, and requires ONE record dated on THAT bar with a mark.

   What is stubbed, said: DEX SCREENER's grader (hgOmniEvaluate) is stubbed to
   return a ticket, because the ledger writer records tickets only and the
   real 35-gate grader does not clear on a synthetic tape; PINE gets one
   injected script that fires FRESH, because the record block records fresh
   signals only. The writers under test are the record maps, not the graders.

   EDGE is NOT driven: edgeScanList records `found`, and on every synthetic
   tape tried the signal fires and edgeAssess declines the tally — so its
   record block stays pinned textually (hg-v981, hg-v985) and is named here as
   the one crypto writer this guard cannot reach.

   Run: node tests/test-crypto-forward-census.mjs */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const root = ROOT + '/';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read=f=>fs.readFileSync(root+f,'utf8');
const TF_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

function boot(files, extra){
  const store={};
  const s={console:{log(){},warn(){},error(){},info(){},debug(){}},Math,isFinite,isNaN,Number,String,Object,Array,JSON,Date,Intl,parseInt,parseFloat,NaN,Infinity,RegExp,Promise,Error,Set,Map,encodeURIComponent,setTimeout,clearTimeout};
  s.window=s; s.globalThis=s; s.self=s; s.HG_tabs=[]; s.HG_warmups=[]; s.HG_TAB_MODS={}; s.setInterval=()=>0; s.clearInterval=()=>{};
  s.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},innerHTML:'',appendChild(){},setAttribute(){},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}),head:{appendChild(){}},body:{appendChild(){}},documentElement:{appendChild(){}},addEventListener(){}};
  s.localStorage={getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  s.location={href:'https://x/',search:'',protocol:'https:'}; s.navigator={userAgent:'node'}; s.fetch=async()=>({ok:true,json:async()=>({})});
  if(extra)Object.assign(s,extra); vm.createContext(s);
  for(const f of files){ try{ vm.runInContext(read(f),s,{filename:f}); }catch(e){ console.log('  boot fail',f,e.message); } }
  const warns=[]; const rw=s.hgFwdWarn; s.hgFwdWarn=function(a,e){ warns.push(a+': '+(e&&e.message||e)); return rw&&rw.apply(this,arguments); }; s.__warns=warns;
  return s;
}
const mk=()=>({innerHTML:'',textContent:'',className:'',disabled:false,style:{},firstElementChild:{style:{}},_handlers:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},querySelector(){return mk();},querySelectorAll(){return [];},addEventListener(ev,fn){this._handler=fn;this._handlers[ev]=fn;}});
const stubPane=()=>{const stubs={};const pane={_html:'',set innerHTML(v){this._html=v;},get innerHTML(){return this._html;},querySelector(sel){if(!stubs[sel])stubs[sel]=mk();return stubs[sel];},querySelectorAll(){return [];}};return {pane,stubs};};
/* lastBarT: the last closed bar of the fixture the desk read; the record is
   dated on it, floored to the record's own timeframe */
const report=(name,S,tab,lastBarT)=>{
  const r=S.hgFwdRecords?S.hgFwdRecords(tab):null;
  ok(Array.isArray(r) && r.length>=1, name+' writes at least one forward record under '+tab+' ('+(r?r.length:'no ledger')+')'+(S.__warns.length?' WARNS: '+S.__warns.join(' | '):''));
  ok(S.__warns.length===0, name+': the record block threw nothing into hgFwdWarn');
  const first=r[0];
  ok(first.dir==='long'||first.dir==='short', name+': direction survives normalisation in lower case ('+first.dir+')');
  ok(typeof first.mark==='number' && isFinite(first.mark) && first.mark>0, name+': the mark rides ('+first.mark+')');
  const sec=TF_SEC[first.tf]||14400; const clockBar=Math.floor(Date.now()/1000/sec)*sec;
  if (isFinite(lastBarT)){
    const want=Math.floor(lastBarT/sec)*sec;
    ok(first.barT===want, name+': dated on the signal bar '+want+' (tf '+first.tf+'), got '+first.barT);
    ok(first.barT!==clockBar || want===clockBar, name+': not on the clock bar');
  }
  console.log('     '+name.padEnd(16)+' tab='+tab.padEnd(15)+' records='+r.length+' mark='+first.mark+' barT='+first.barT+' dir='+first.dir+' mech='+first.mechanic);
};
const now=Math.floor(Date.now()/1000);
const LAST4H=Math.floor(now/14400)*14400-14400;   /* every 4h fixture ends one closed bar before the clock */
const LAST1H=Math.floor(now/3600)*3600-3600;
function tape(n,seed,drift,sec){ const out=[]; let p=80+(seed%40), s=seed*7919+3; const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}; const t0=Math.floor(now/sec)*sec-n*sec; for(let i=0;i<n;i++){ p=p*(1+((rnd()-0.5)*0.008+drift)); const r=p*0.004*(0.5+rnd()); out.push({t:t0+i*sec,o:p-r*0.3,h:p+r,l:p-r,c:p,v:900+rnd()*300}); } return out; }
const OMNI=['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js','hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js'];

// 1 OMNIROUTE
{ const S=boot(OMNI); const UNI=[{sym:'HOTUSD',base:'HOT',exchange:'delta'},{sym:'WARMUSD',base:'WARM',exchange:'delta'},{sym:'COLDUSD',base:'COLD',exchange:'delta'}];
  S.xuUniverse=()=>Promise.resolve(UNI); S.xuUniverseNote=()=>null;
  S.xuCandles=(item,tf)=>{ const sec=tf==='1h'?3600:tf==='15m'?900:14400; return Promise.resolve(tape(181,item.sym.length*17,item.sym==='HOTUSD'?0.002:0.0003,sec)); };
  S.binanceOIHistory=()=>Promise.resolve({series:[{oi:100},{oi:110}]}); S.binanceLongShort=()=>Promise.resolve({latest:{longShortRatio:1.1}}); S.binanceTakerRatio=()=>Promise.resolve({latest:{buySellRatio:1.02}}); S.binanceDepth=()=>Promise.resolve({bids:[[1,1]],asks:[[2,1]]});
  const ui={btn:mk(),stat:mk(),warn:mk(),cards:mk(),pool:mk(),matrix:mk()}; await S.hgOmniRunScan(ui); report('OMNIROUTE',S,'OMNIROUTE',LAST4H); console.log('   stat:',String(ui.stat.textContent).slice(0,120)); }
// 2 OMNIPRESENT
{ const S=boot(OMNI.concat(['omnigold.js','omnipresent.js'])); const UNI=[]; for(let i=0;i<6;i++)UNI.push({sym:'OP'+i+'USD',base:'OP'+i,exchange:'delta'});
  function topTape(n,back){back=back||0;const out=[];let s=5;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};const t0=Math.floor(now/3600)*3600-(n+back)*3600;for(let i=0;i<n;i++){let p;const tail=n-i;if(tail>70)p=95+Math.sin(i/9)*3+(rnd()-0.5)*0.6;else if(tail>50)p=96+(70-tail)*0.72;else if(tail>40)p=110.4-(50-tail)*0.42;else if(tail>30)p=106.2+(40-tail)*0.40;else p=110.2-(30-tail)*0.06-Math.sin(i/5)*0.2;out.push({t:t0+i*3600,o:p-0.2,h:p+0.35,l:p-0.55,c:p,v:700+rnd()*200});}return out;}
  const base=topTape(360,2); const live0=base[base.length-1].c; const sh=S.opAssess(base,live0).filter(c=>c.dir==='short')[0]; console.log('   armed short?',!!sh,sh&&sh.status);
  const t0=base[base.length-1].t; const swept=sh?base.concat([{t:t0+3600,o:live0,h:sh.zone.hi+0.2,l:live0-0.3,c:sh.zone.lo+0.05,v:2400},{t:t0+7200,o:sh.zone.lo,h:sh.zone.lo+0.2,l:sh.zone.lo-1.1,c:sh.zone.lo-0.9,v:1900}]):base;
  S.xuUniverse=()=>Promise.resolve(UNI); S.xuCandles=()=>Promise.resolve(swept); const ui={btn:mk(),stat:mk(),cards:mk()}; await S.hgOpRunScan(ui); ok(!!sh && sh.status==='ARMED', 'OMNIPRESENT fixture: the base tape arms a short (the block records TRIGGERED only, so the zone is then swept)'); report('OMNIPRESENT',S,'OMNIPRESENT',swept[swept.length-1].t); console.log('   stat:',String(ui.stat.textContent).slice(0,100)); }
// 3 SUPER BEST
{ const S=boot(['hg-forward.js','super-desk-common.js','super-best.js']); S.calcTrade=(o)=>({ok:true,impliedLeverage:2,qty:10,tp:o.tpPrice||o.entry*1.02}); S.calcSafeMaxLeverage=()=>5;
  S.bestScan=()=>({at:Date.now()-60000,clean:[{sym:'BTCUSD',dir:'long',entry:100,stop:98,t1:104,rr:2,famScore:7,robScore:2,mark:100,rows:tape(60,3,0.001,14400)}]});
  const snap=S.buildSnapFromBestScan(S,{balance:1000,riskPct:1}); S.mergePublishSuperBestSnap(snap); report('SUPER BEST',S,'SUPER:BEST',LAST4H); console.log('   cands',snap.cands.length); }
// 4 SUPER SNIPER
{ const S=boot(['hg-forward.js','super-desk-common.js','super-sniper.js']); S.rsMaxSafeLev=()=>35; S.hgCryptoAttachPositionSize=(h)=>{h.positionSize={positionSizeUnits:1};h.positionRisk={pass:true};};
  S.reversalSniperScan=()=>({at:Date.now(),cands:[{id:'rs|ETH|0',sym:'ETHUSD',dir:'long',entry:100,stop:99,t1:102,conviction:5,lev:35,rr:2,rows:tape(60,4,0.001,14400)}]});
  const snap=S.buildSnapFromRsScan(S,{balance:1000,riskPct:1},{allowStale:true}); S.mergePublishSuperSniperSnap(snap); report('SUPER SNIPER',S,'SUPER:SNIPER',LAST4H); console.log('   cands',snap.cands.length); }
// 5 REVERSAL SNIPER publish
{ const S=boot(['indicators.js','indicators2.js','plans.js','meanrev.js','hg-forward.js','reversalsniper.js']);
  S.publishRsDeskSnap([{sym:'ETHUSD',item:{sym:'ETHUSD',venue:'delta'},rows:tape(120,9,-0.002,14400),setup:{entry:100,stop:99,t1:102,t2:104,rr1:2,rr2:4,conviction:5,lev:20,riskPct:1,triggers:['sweep']}}]); report('REV SNIPER',S,'REVERSALSNIPER',LAST4H); const snap=S.reversalSniperScan(); console.log('   cands',snap&&snap.cands.length); }
// 6 TRENDMX
{ const S=boot(['indicators.js','indicators2.js','setup-stack.js','desk-scan-universe.js','hg-forward.js','trendtable.js']);
  const mkRows=(closes,sec)=>{const rows=[];let prev=closes[0];const t0=Math.floor(now/sec)*sec-closes.length*sec;for(let i=0;i<closes.length;i++){const c=closes[i],o=prev;rows.push({t:t0+i*sec,o,h:Math.max(o,c)+0.3,l:Math.min(o,c)-0.3,c,v:1000});prev=c;}return rows;}; const lin=(n,a,st)=>{const r=[];for(let i=0;i<n;i++)r.push(a+i*st);return r;};
  S.binancePerpUniverse=async()=>['AAAUSDT','BBBUSDT']; S.binanceTickers24h=async()=>({AAAUSDT:{turnoverUsd:50e6},BBBUSDT:{turnoverUsd:30e6}}); const rows1d=mkRows(lin(260,100,1),86400), rows4h=mkRows(lin(120,50,0.5),14400); S.binanceKlines=async(sym,tf)=>tf==='1d'?rows1d:rows4h; S.toTrade=()=>{};
  const tab=S.HG_tabs.filter(t=>t.id==='trendmx')[0]; const nodes={}; const el={innerHTML:'',querySelector(sel){if(!nodes[sel])nodes[sel]=mk();return nodes[sel];},querySelectorAll(){return [];}}; tab.mount(el); nodes['[data-r="run"]']._handler(); const t0=Date.now(); while(Date.now()-t0<8000){const t=nodes['[data-r="status"]'].textContent||''; if(t.indexOf('scanned')>-1||t.indexOf('Scan failed')>-1)break; await new Promise(r=>setTimeout(r,25));} report('TRENDMX',S,'TRENDMX',LAST4H); console.log('   status:',String(nodes['[data-r="status"]'].textContent).slice(0,100)); }
// 7 GATES (engine)
{ const S=boot(['hg-forward.js','engine.js']);
  const mkRows=(n,lastClose,wickUp,wickDown,step)=>{step=step||0.1;const rows=[];const t0=Math.floor(now/14400)*14400-n*14400;for(let i=0;i<n;i++){const c=lastClose-step*(n-1-i);const last=i===n-1;rows.push({t:t0+i*14400,o:c-step,h:c+(last?wickUp:0.2),l:c-(last?wickDown:0.2),c,v:1000+i});}return rows;};
  S.ema=(vals,p)=>{const lc=vals[vals.length-1];const up=lc>=100;const t=up?{9:lc+4,20:lc+2,21:lc-1,50:lc-6,200:lc-16}:{9:lc-4,20:lc-2,21:lc+1,50:lc+6,200:lc+16};return vals.map(()=>t[p]);};
  S.rsi=()=>[50,58]; S.atr=(rows)=>rows.map(()=>2); S.volZ=()=>1.2;
  S.smartClassify=(d)=>d.chg24>0?{dir:'long',longEv:['trend fuel: price+OI rising'],shortEv:[],regime:['new longs entering'],score:1,total:1}:{dir:'short',longEv:[],shortEv:['trend fuel: price down, OI rising'],regime:['new shorts entering'],score:1,total:1}; S.smartSetup=(cls)=>String(cls.dir).toLowerCase()==='long'?{type:'SWING',dir:'long',entry:106,stop:101,t1:116,t2:123.5,rr1:2,rr2:3.5,riskPct:5,confirmed:true,note:''}:{type:'SWING',dir:'short',entry:94,stop:99,t1:84,t2:76.5,rr1:2,rr2:3.5,riskPct:5,confirmed:true,note:''};
  
  S.binancePerpUniverse=async()=>['BTCUSDT','ETHUSDT']; S.binanceTickers24h=async()=>({BTCUSDT:{mark:106,chg24:2,turnoverUsd:800e6},ETHUSDT:{mark:94,chg24:-2,turnoverUsd:500e6}});
  S.binanceFunding=async(sym)=>({markPrice:sym==='ETHUSDT'?94:106,fundingPct:0.01}); S.binanceOIHistory=async()=>({series:[{oi:100},{oi:103}]}); S.binanceLongShort=async()=>({latest:{longPct:50}}); S.binanceTopTraders=async()=>({latest:{longPct:55}}); S.binanceTakerRatio=async()=>({latest:{buySellRatio:1.1}});
  S.binanceKlines=async(sym,interval,limit)=>sym==='BTCUSDT'?mkRows(limit||260,106,0.25,1.0):mkRows(limit||260,94,1.0,0.25);
  const tab=S.HG_tabs.filter(t=>t.id==='execute')[0]; const {pane,stubs}=stubPane(); tab.mount(pane); stubs['#engineRun']._handler(); const t0=Date.now(); while(stubs['#engineRun'].disabled&&Date.now()-t0<8000) await new Promise(r=>setTimeout(r,25)); report('GATES',S,'EXECUTE',LAST4H); console.log('   stat:',String(stubs['#engineStat'].textContent).slice(0,120)); }
// 8 DEX
{ const S=boot(OMNI.concat(['dex-screener.js'])); const UNI=[{sym:'DOGEUSD',base:'DOGE',exchange:'delta',turnoverUsd:5e7,chg7d:3},{sym:'PEPEUSD',base:'PEPE',exchange:'delta',turnoverUsd:4e7,chg7d:2},{sym:'WIFUSD',base:'WIF',exchange:'coindcx',turnoverUsd:3e7,chg7d:1}];
  S.xuUniverse=()=>Promise.resolve(UNI); S.xuUniverseNote=()=>null; S.xuCandles=(item,tf)=>Promise.resolve(tape(181,item.sym.length*13,0.003,14400)); S.hgOmniEvaluate=(item,rows)=>{const lc=rows[rows.length-1].c;return [{sym:item.sym,dir:'long',kind:'SQUEEZE-FIRE',level:lc,plan:{entry:lc,stop:lc*0.97,t1:lc*1.06,t2:lc*1.09,rr1:2,rr2:3},grade:{ticket:true,vetoes:[],score:9},gates:[],rows4h:rows}];}; S.binanceOIHistory=()=>Promise.resolve({series:[{oi:100},{oi:110}]}); S.binanceLongShort=()=>Promise.resolve({latest:{longShortRatio:1.1}}); S.binanceTakerRatio=()=>Promise.resolve({latest:{buySellRatio:1.02}}); S.binanceDepth=()=>Promise.resolve({bids:[[1,1]],asks:[[2,1]]});
  const tab=S.HG_tabs.filter(t=>t.id==='dexscreener')[0]; const {pane,stubs}=stubPane(); tab.mount(pane); try{ await S.dexRunScan(); }catch(e){ console.log('  dex threw',e.message); } report('DEX',S,'DEX-SCREENER',LAST4H); const st=S.dexScreenerState?S.dexScreenerState():null; console.log('   state:', st?JSON.stringify(Object.keys(st)):'n/a', Object.keys(stubs).slice(0,6).join(',')); for(const k of Object.keys(stubs)) if(/stat/i.test(k)) console.log('   ',k,String(stubs[k].textContent).slice(0,120)); }
// 9 EDGE — NOT driven, and the reason is checked rather than remembered
{ const S=boot(['indicators.js','indicators2.js','meanrev.js','cryptogates.js','plans.js','hg-forward.js','edge.js']);
  /* the seed on which edgeSignal fires (EMA9 PULLBACK long); edgeAssess then declines the tally, so `found` is empty and the block is never reached */
  function seedTape(n,seed,drift,noise,pull){ const out=[]; let p=100, st=seed*7919+3; const rnd=()=>{st=(st*1103515245+12345)&0x7fffffff;return st/0x7fffffff;}; const t0=Math.floor(now/14400)*14400-n*14400; for(let i=0;i<n;i++){ let d=drift; if(i>=n-pull) d=-drift*1.2; p=p*(1+((rnd()-0.5)*noise+d)); const r=p*0.003*(0.5+rnd()); out.push({t:t0+i*14400,o:p*(1-d*0.5),h:p+r,l:p-r,c:p,v:900+rnd()*300*(i>=n-pull?0.6:1.3)}); } return out; }
  const rows=seedTape(260,8,0.001,0.012,2); const item={sym:'AAAUSDT',base:'AAA',exchange:'binance',fundingPct:0.01,turnoverUsd:5e7};
  ok(!!S.edgeSwingBias(rows), 'EDGE seed: the swing bias forms');
  const sig=S.edgeSignal(rows); ok(!!sig && /PULLBACK/.test(sig.edge||''), 'EDGE seed: the signal fires ('+(sig&&sig.edge)+')');
  ok(S.edgeAssess(rows,item,'binance')===null, 'EDGE seed: edgeAssess declines the tally — so the record block (records `found` only) is unreachable on a synthetic tape; it stays pinned textually in hg-v981 / hg-v985');
  const res=await S.edgeScanList([item], async()=>({rows,src:'binance'}), {});
  ok(res && res.found.length===0 && res.stats.tallyFail===1, 'EDGE: edgeScanList on the seed reports one tally failure and no record ('+JSON.stringify(res.stats)+')');
  ok((S.hgFwdRecords('EDGE')||[]).length===0, 'EDGE: nothing recorded, as the block\'s own rule says');
}
// 10 PINE
{ const S=boot(['pinemath.js','pinegate.js','setup-stack.js','setup-ui.js','hg-forward.js','pine.js']);
  const mkRows=(n,start,step)=>{const rows=[];let prev=start;const t0=Math.floor(now/3600)*3600-n*3600;for(let i=0;i<n;i++){const c=start+i*step;rows.push({t:t0+i*3600,o:prev,h:Math.max(prev,c)+1,l:Math.min(prev,c)-1,c,v:1000+i});prev=c;}return rows;};
  S.pineGateLive=()=>({eligible:[{sym:'BTCUSD',dir:'long',edgeTicket:true,gateHits:3}],funnel:{edge:1},missing:[]}); S.probeFresh=(rows)=>{const l=rows[rows.length-1];return {newLong:true,dir:'long',barsAgo:0,price:l.c,signal:'long'};}; S.PINE_SCRIPTS.push({id:'probe-fresh',label:'PROBE',fn:'probeFresh',minBars:30,opts:{}}); S.getCandles=async()=>mkRows(300,100,0.05); S.hgFunnelPanelHTML=(t)=>'<div>'+t+'</div>'; S.pineFunnelRows=()=>[]; S.sendTelegram=()=>{}; S.hgSetupDeskBannerHTML=()=>''; S.hgSetupInjectStyles=()=>{};
  const tab=S.HG_tabs.filter(t=>t.id==='pine')[0]; const {pane,stubs}=stubPane(); tab.mount(pane); stubs['#pineRun']._handlers.click(); const t0=Date.now(); while(Date.now()-t0<15000&&String(stubs['#pineStat'].textContent).indexOf('done')<0) await new Promise(r=>setTimeout(r,25)); const snap=S.pineScan(); ok(snap&&snap.signals&&snap.signals.some(x=>x.isNew), 'PINE fixture: the injected script fires FRESH (the block records fresh signals only)'); report('PINE',S,'PINE',LAST1H); console.log('   signals',snap&&snap.signals&&snap.signals.length,'new',snap&&snap.signals&&snap.signals.filter(x=>x.isNew).length,'stat',String(stubs['#pineStat'].textContent).slice(0,80)); }
// 11 CONTRACT REPORT
{ const ENG=['indicators.js','indicators2.js','plans.js','structure-levels.js','best-levels.js','formation.js','cryptogates.js','edge.js','squeeze.js','meanrev.js','trendtable.js','liqs.js','reversalsniper.js','pinemath.js','pine-sub.js','fixpack15-core.js','meta-label.js','hg-forward.js','scorecard.js','supersetup.js','contract-report.js'];
  const S=boot(ENG); const gen=(n,base)=>{const rows=[];let p=base;const t0=Math.floor(now/14400)*14400-n*14400;for(let i=0;i<n;i++){p=p*(1+0.001*Math.sin(i/7)+0.0004);rows.push({t:t0+i*14400,o:p*0.999,h:p*1.004,l:p*0.996,c:p,v:1000});}return rows;};
  const r4=gen(260,50000); let rep=null; try{ rep=S.hgContractReportRun({sym:'BTCUSD',rows4h:r4,rows1h:gen(260,50000),rows15m:gen(260,50000),ticker:{symbol:'BTCUSD',fundingPct:0.01,mark:r4[r4.length-1].c}}); }catch(e){ console.log('  cr threw',e.message); } ok(rep&&rep.plan&&rep.plan.ok, 'CONTRACT REPORT fixture: a plan forms'); ok(S.hgContractReportRecord(rep)===1, 'CONTRACT REPORT: the record function the shell calls writes one record'); report('CONTRACT REPORT',S,'SEARCH-REPORT',LAST4H); }

console.log('\nversion stamps');
{ const stamp=read('build-stamp.js'); const v=(stamp.match(/version:\s*'(hg-v\d+)'/)||[])[1]; ok(/^hg-v\d+$/.test(v),'build-stamp version '+v); ok(swCacheOk(read('sw.js')),'sw.js HG_CACHE matches build-stamp.js'); }
console.log('\n'+passed+' assertions passed');
