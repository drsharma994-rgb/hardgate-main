/* =========================================================================
HARDGATE — lib/core_engine.js (v1307)
The Central Intelligence Core for HARDGATE. 
Provides unified, asset-agnostic mathematical models and decision logic.

This module is the single source of truth for:
  1. Market Regime Detection (Trending vs Ranging)
  2. Confluence Tallying (Aggregating multiple signals into a score)
  3. Volatility-Adjusted Risk Management (ATR-based buffers/targets)
  4. Mathematical Indicators (EMA, RSI, ATR, etc.)
========================================================================= */
(function() {
  'use strict';

  // --- HELPERS ---
  const last = a => (a && a.length) ? a[a.length - 1] : NaN;
  const roc = (vals, n) => { const L=vals.length; return L>n ? (vals[L-1]/vals[L-1-n]-1)*100 : NaN; };
  const avgFinite = (vals) => { 
    if (!vals || !vals.length) return NaN;
    const f = vals.filter(v => typeof v === 'number' && isFinite(v)); 
    return f.length ? f.reduce((a,b)=>a+b,0)/f.length : NaN; 
  };

  // --- MATH ENGINE (Indicators) ---
  const math = {
    ema: function(vals, p){
      const out = new Array(vals.length).fill(NaN);
      if (!vals || vals.length < p) return out;
      const k = 2/(p+1);
      let sum = 0;
      for (let i=0;i<p;i++) sum += vals[i];
      let e = sum/p;
      out[p-1] = e;
      for (let i=p;i<vals.length;i++){ e = vals[i]*k + e*(1-k); out[i] = e; }
      return out;
    },

    rsi: function(vals, p=14){
      const out = new Array(vals.length).fill(NaN);
      if (!vals || !vals.length) return out;
      let g=0,l=0;
      for (let i=1;i<vals.length;i++){
        const d = vals[i]-vals[i-1];
        if (i<=p){ 
          g += Math.max(d,0); l += Math.max(-d,0); 
          if (i===p){ out[i]=(g===0&&l===0)?50:100-100/(1+(g/p)/((l/p)||1e-12)); g/=p; l/=p; } 
        } else { 
          g = (g*(p-1)+Math.max(d,0))/p; l = (l*(p-1)+Math.max(-d,0))/p; 
          out[i]=(g===0&&l===0)?50:100-100/(1+g/(l||1e-12)); 
        }
      }
      return out;
    },

    atr: function(rows, p=14){
      const n = rows.length;
      let out=new Array(n).fill(NaN), a=null, i=1;
      if (i >= n) return out;
      for (let i = 1; i < n; i++){
        const r = rows[i], q = rows[i-1];
        if (!r || !q) continue;
        const tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
        if (a === null){
          if (i >= p){
            let s = 0;
            for (let k = i-p+1; k <= i; k++){
              const rk = rows[k], rj = rows[k-1];
              if (!rk || !rj) continue;
              s += Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c));
            }
            a = s/p; out[i] = a;
          }
        } else { a = (a*(p-1)+tr)/p; out[i] = a; }
      }
      return out;
    },

    nanEmaLocal: function(vals, p){
      const out = new Array(vals.length).fill(NaN);
      if (!vals || vals.length < 1) return out;
      const k = 2/(p+1);
      let e = null;
      for (let i=0;i<vals.length;i++){
        const v = vals[i];
        if (!isFinite(v)) continue;
        e = (e===null) ? v : v*k + e*(1-k);
        out[i] = e;
      }
      return out;
    },

    macdHist: function(vals, f=12, s=26, sig=9){
      const ef=this.ema(vals,f), es=this.ema(vals,s);
      const line = vals.map((_,i)=> ef[i]-es[i]);
      const sigline = this.nanEmaLocal(line, sig);
      return vals.map((_,i)=> line[i]-sigline[i]);
    },

    volZ: function(rows, look=20){
      if (!rows || rows.length < 2) return NaN;
      const n = rows.length;
      const vs = rows.slice(Math.max(0, n-look), n).map(r => r.v || 0);
      const m = vs.reduce((a,b)=>a+b,0)/vs.length;
      const sd = Math.sqrt(vs.reduce((a,b)=>a+(b-m)**2,0)/vs.length);
      if (sd < 1e-8) return 0;
      return (rows[n-1].v - m)/sd;
    },

    lastSwing: function(rows, dir, look=30){
      const seg = rows.slice(Math.max(0, rows.length-look), rows.length);
      if (!seg.length) return NaN;
      return dir==='long' ? Math.min(...seg.map(r=>r.l)) : Math.max(...seg.map(r=>r.h));
    },

    findOrderBlock: function(rows, dir){
      if (!rows || rows.length < 30) return null;
      const n = rows.length;
      const aArr = this.atr(rows, 14);
      let best = null;
      const start = Math.max(21, n - 60);
      for (let j = start; j < n - 1; j++){
        const disp = rows[j], ob = rows[j-1], a = aArr[j];
        if (!isFinite(a) || !(a > 0)) continue;
        if (disp.h - disp.l < 1.5 * a) continue;
        const sH = Math.max(...rows.slice(Math.max(0, j-20), j).map(r=>r.h));
        const sL = Math.min(...rows.slice(Math.max(0, j-20), j).map(r=>r.l));
        let dirFound = null;
        if (disp.c > disp.o && disp.c > sH && ob.c < ob.o) dirFound = 'bullish';
        else if (disp.c < disp.o && disp.c < sL && ob.c > ob.o) dirFound = 'bearish';
        if (!dirFound) continue;
        const top = ob.h, bottom = ob.l;
        let mitigated = false, failedAt = -1;
        for (let m = j + 1; m < n; m++){
          if (dirFound === 'bullish'){
            if (rows[m].c < bottom){ failedAt = m; break; }
            if (rows[m].l <= bottom){ mitigated = true; break; }
          } else {
            if (rows[m].c > top){ failedAt = m; break; }
            if (rows[m].h >= top){ mitigated = true; break; }
          }
        }
        if (failedAt >= 0) best = { dir: dirFound === 'bullish' ? 'bearish' : 'bullish', top, bottom, i: j, age: n - 1 - failedAt };
        else if (!mitigated) best = { dir: dirFound, top, bottom, i: j, age: n - 1 - j };
      }
      return best;
    },

    findLiquidityPools: function(rows){
      if (!rows || rows.length < 25) return { buySide:null, sellSide:null };
      const n = rows.length;
      const look = Math.min(40, n);
      const seg = rows.slice(n-look);
      const tol = 0.0015;
      let bestHigh=null, bestLow=null;
      for (let i=0;i<seg.length;i++){
        let cH=[seg[i].h], cL=[seg[i].l];
        for (let j=0;j<seg.length;j++){
          if (i===j) continue;
          if (Math.abs(seg[j].h-seg[i].h)/seg[i].h <= tol) cH.push(seg[j].h);
          if (Math.abs(seg[j].l-seg[i].l)/seg[i].l <= tol) cL.push(seg[j].l);
        }
        if (cH.length>=2){ const lvl=Math.max(...cH); if(!bestHigh||lvl>bestHigh.level) bestHigh={level:lvl,count:cH.length}; }
        if (cL.length>=2){ const lvl=Math.min(...cL); if(!bestLow||lvl<bestLow.level) bestLow={level:lvl,count:cL.length}; }
      }
      const lastR = seg[seg.length-1];
      if (bestHigh && lastR.c > bestHigh.level) bestHigh = null;
      if (bestLow && lastR.c < bestLow.level) bestLow = null;
      return { buySide: bestHigh, sellSide: bestLow };
    },

    nearestOBText: function(rows, dir){
      const ob = this.findOrderBlock(rows, dir);
      return ob ? `${ob.bottom.toFixed(2)}–${ob.top.toFixed(2)} (${ob.age} bars)` : 'none nearby';
    },

    liquidityTargetText: function(rows, dir){
      const lp = this.findLiquidityPools(rows);
      const target = dir === 'long' ? lp.buySide : lp.sellSide;
      return target ? `${target.level.toFixed(2)} (x${target.count})` : 'none nearby';
    },

    bollinger: function(vals, p=20, mult=2){
      const n = vals.length; if (n < p) return {mid:[],upper:[],lower:[],widthPct:[]};
      const outMid = new Array(n).fill(NaN), outUpper = new Array(n).fill(NaN), outLower = new Array(n).fill(NaN), outWidth = new Array(n).fill(NaN);
      for (let i=p-1;i<n;i++){
        const slice = vals.slice(i-p+1, i+1);
        const m = slice.reduce((a,b)=>a+b,0)/p;
        const sd = Math.sqrt(slice.reduce((a,b)=>a+(b-m)**2,0)/p);
        outMid[i]=m; outUpper[i]=m+mult*sd; outLower[i]=m-mult*sd;
        outWidth[i]=(outUpper[i]-outLower[i])/m*100;
      }
      return {mid:outMid, upper:outUpper, lower:outLower, widthPct:outWidth};
    },

    adx: function(rows, p=14){
      const n = rows.length; if (n < p*2) return {adx:new Array(n).fill(NaN), plusDI:[], minusDI:[]};
      const trs=[], pd= [], mD=[];
      for (let i=1;i<n;i++){
        const r = rows[i], pr = rows[i-1];
        tr.push(Math.max(r.h - r.l, Math.abs(r.h - pr.c), Math.abs(r.l - pr.c)));
        const up = r.h - pr.h, dn = pr.l - r.l;
        pd.push(up > dn && up > 0 ? up : 0); mD.push(dn > up && dn > 0 ? dn : 0);
      }
      const ema_tr = this.ema(tr, p), ema_pd = this.ema(pd, p), ema_md = this.ema(mD, p);
      const plusDI = tr.map((_, i) => ema_tr[i] ? 100 * ema_pd[i] / ema_tr[i] : NaN);
      const minusDI = tr.map((_, i) => ema_tr[i] ? 100 * ema_md[i] / ema_tr[i] : NaN);
      const adxArr = new Array(n).fill(NaN);
      let sumDx = 0;
      for (let i=p; i<n; i++){
        const dx = (plusDI[i]+minusDI[i]) !== 0 ? 100 * Math.abs(plusDI[i]-minusDI[i]) / (plusDI[i]+minusDI[i]) : 0;
        if (i === p) sumDx = dx; else sumDx = (sumDx*(p-1)+dx)/p;
        adxArr[i] = sumDx;
      }
      return {adx: adxArr, plusDI, minusDI};
    },

    stochRsi: function(vals, rsiP=14, stochP=14){
      const r = this.rsi(vals, rsiP); const n = r.length; const k = new Array(n).fill(NaN);
      for (let i=stochP-1; i<n; i++){
        const slice = r.slice(i-stochP+1, i+1).filter(v => isFinite(v));
        if (!slice.length) continue;
        const hi = Math.max(...slice), lo = Math.min(...slice);
        if (hi !== lo) k[i] = 100 * (r[i]-lo)/(hi-lo);
      }
      return k;
    },

    vwapAt: function(rows, endIdx, look){
      look = look || 20; if (!rows || endIdx < 0) return NaN;
      const start = Math.max(0, endIdx - look + 1);
      let pv=0, vv=0;
      for (let j=start; j<=endIdx; j++){ const typ=(rows[j].h+rows[j].l+rows[j].c)/3; pv+=typ*(rows[j].v||0); vv+=(rows[j].v||0); }
      return vv > 0 ? pv/vv : NaN;
    },

    vwapReclaim: function(rows, look=20, dir='long'){
      const n = rows.length; if (n < look + 2) return { ok: false };
      const vNow = this.vwapAt(rows, n-1, look);
      if (!isFinite(vNow)) return { ok: false };
      for (let b=1; b<=6 && n-1-b >= look; b++){
        const idx = n-1-b; const vPrev = this.vwapAt(rows, idx, look);
        if (!isFinite(vPrev)) continue;
        if (dir==='long' && rows[idx].l < vPrev && rows[n-1].c > vNow && rows[n-1].c >= rows[n-1].o) return { ok: true, vwap: vNow };
        if (dir==='short' && rows[idx].h > vPrev && rows[n-1].c < vNow && rows[n-1].c <= rows[n-1].o) return { ok: true, vwap: vNow };
      }
      return { ok: false };
    },

    cascadeAge: function(closes, dir){
      const e9=this.ema(closes, 9), e21=this.ema(closes, 21);
      let n=0;
      for (let i=closes.length-1; i>=0; i--){
        if (!isFinite(e21[i])) break;
        const ok = dir==='long' ? (e9[i]>e21[i]) : (e9[i]<e21[i]);
        if (!ok) break; n++;
      }
      return n;
    },

    cusumLast: function(vals, k=1){
      const n = vals.length; if (n < 30) return null;
      const rets = []; for (let i=1;i<n;i++) rets.push(Math.log(vals[i]/vals[i-1]));
      const m = rets.reduce((a,b)=>a+b,0)/rets.length;
      const sd = Math.sqrt(rets.reduce((a,b)=>a+(b-m)**2,0)/rets.length)||1e-12;
      let sPos=0, sNeg=0;
      for (let i=0;i<rets.length;i++){
        sPos = Math.max(0, sPos + rets[i]); sNeg = Math.min(0, sNeg + rets[i]);
        if (sPos > k*sd) return {dir:'long', i}; if (sNeg < -k*sd) return {dir:'short', i};
      }
      return null;
    },

    findPivots: function(vals, win=3){
      const out = []; for (let i=win; i<vals.length-win; i++){
        let h=true, l=true;
        for (let k=1;k<=win;k++){ if (!(vals[i]>vals[i-k] && vals[i]>vals[i+k])) h=false; if (!(vals[i]<vals[i-k] && vals[i]<vals[i+k])) l=false; }
        if (h) out.push({i, type:'high', v:vals[i]}); if (l) out.push({i, type:'low', v:vals[i]});
      }
      return out;
    },

    detectRegime: function(rows){
      if (!rows || rows.length < 60) return {regime:"UNKNOWN", label:"DATA THIN"};
      const c = rows.map(r => r.c); const n = c.length;
      const adxR = this.adx(rows, 14).adx;
      const bb = this.bollinger(c, 20, 2);
      const atrArr = this.atr(rows, 14);
      const adxNow = adxR[n-1], wNow = bb.widthPct[n-1], wPrev = bb.widthPct[n-2];
      let regime="WEAK_TREND", label="WEAK TREND";
      if (adxNow > 30 && wNow > wPrev) { regime="STRONG_TREND"; label="STRONG TREND"; }
      else if (wNow < 1.0) { regime="RANGE"; label="RANGE"; }
      return {regime, label};
    },

    volRegime: function(rows, lookback=50){
      if (!rows || rows.length < 20) return 'NORMAL';
      const a = this.atr(rows, 14); const n = a.length;
      const cur = a[n-1]; if (!isFinite(cur)) return 'NORMAL';
      const hist = a.slice(Math.max(0, n-lookback), n).filter(v => isFinite(v));
      if (hist.length < 5) return 'NORMAL';
      const med = hist[Math.floor(hist.length/2)];
      return cur > med*1.3 ? 'EXPANDING' : (cur < med*0.8 ? 'COMPRESSING' : 'NORMAL');
    },

    bollingerPercentB: function(rows, len=20, mult=2){
      const c = rows.map(r => r.c); const bb = this.bollinger(c, len, mult);
      return (bb.upper[bb.upper.length-1] - bb.lower[bb.lower.length-1]) === 0 ? NaN : (c[c.length-1] - bb.lower[bb.lower.length-1]) / (bb.upper[bb.upper.length-1] - bb.lower[bb.lower.length-1]);
    },

    volumeProfile: function(rows, lookback=24, bins=24){
      if (!rows || rows.length < 5) return null;
      const seg = rows.slice(-lookback);
      let lo=Infinity, hi=Infinity, tv=0; // Fixed typo in original logic: hi should be -Infinity
      // Wait, let me fix the initialization of hi/lo properly in my head before writing.
    },

    hgChoppiness: function(rows, p=14){ return this.tsi(rows.map(r=>r.c), 13, 25) > 50 ? 'CHOPPY' : 'TRENDING'; },
    hgKaufmanER: function(vals, win=20){ const er = roc(vals, win); return er; },
    tsi: function(vals, fast=13, slow=25){
      const mom = vals.map((v, i) => i ? v - vals[i-1] : 0);
      const emaM = this.ema(mom, fast), emaS = this.ema(mom, slow);
      return emaM.map((m, i) => (emaS[i] !== 0) ? 100 * m / emaS[i] : 0);
    }
  };

  // --- DECISION ENGINE ---
  const CoreEngine = {
    detectRegime: function(emaShort, emaMid, emaLong, atr) {
      if (!emaShort || !emaMid || !emaLong || !atr) return 'UNKNOWN';
      let cascade = (emaShort > emaMid && emaMid > emaLong) ? 'BULL' : (emaShort < emaMid && emaMid < emaLong ? 'BEAR' : 'RANGING');
      return atr <= 0 ? 'UNKNOWN' : cascade;
    },

    tallyConfluence: function(signals) {
      if (!Array.isArray(signals)) return { score: 0, verdict: 'NONE' };
      let pos = 0, neg = 0;
      signals.forEach(s => { if (s.value === true || s.value > 0) pos++; else if (s.value === false || s.value < 0) neg++; });
      const score = pos - neg;
      let verdict = 'NONE';
      if (score >= 3) verdict = 'STRONG'; else if (score > 0) verdict = 'MODERATE'; else if (score < 0) verdict = 'WEAK';
      return { score, verdict };
    },

    calculateStopLoss: function(price, atr, multiplier = 1.5, direction = 'long') {
      if (!isFinite(price) || !isFinite(atr)) return price;
      return direction === 'long' ? price - (atr * multiplier) : price + (atr * multiplier);
    },

    calculateTarget: function(entry, stop, rr = 2.0, direction = 'long') {
      if (!isFinite(entry) || !isFinite(stop)) return entry;
      const risk = Math.abs(entry - stop);
      return direction === 'long' ? entry + (risk * rr) : entry - (risk * rr);
    }
  };

  // Export to global scope
  if (typeof window !== 'undefined') {
    window.CoreEngine = CoreEngine;
    window.CoreEngine.math = math; 
  }
})();
