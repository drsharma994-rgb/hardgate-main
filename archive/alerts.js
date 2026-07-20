/* alerts.js \u2014 alert scanning + email-trigger cycle (extracted Phase 22). sendAlertEmail() and initAlerts() intentionally remain inline because they embed EmailJS credentials/boot wiring. */

function isManualScanBusy(){
  const ids = ['bestRun','swingRun','scalpRun','goldRun','smcRun','obRun','coilRun','apexRun','trapRun','biasRun','divRun','expRun','basisRun'];
  return ids.some(function(id){ const el = document.getElementById(id); return el && el.disabled; });
}

function updateAlertChip(){
  const el = document.getElementById('alertState');
  if (el) el.textContent = S.alertsOn ? 'ON' : 'OFF';
}

async function runAlertCycle(){
  if (S.alertBusy) return;
  if (isManualScanBusy()) return;
  S.alertBusy = true;
  try{
    const exchanges = ['delta','coindcx'];
    for (const ex of exchanges){
      try{
        const clean = await silentBestScan(ex);
        const w = clean && clean.length ? clean[0] : null;
        const key = w ? (w.t.symbol + '|' + w.dir) : null;
        if (key && key !== S.lastAlertKey[ex]){
          await sendAlertEmail(w, ex);
          S.lastAlertKey[ex] = key;
        } else if (!key){
          S.lastAlertKey[ex] = null;
        }
      }catch(e){ console.error('HARDGATE alert cycle error for', ex, e); }
    }
    S.lastAlertCheck = Date.now();
  } finally {
    S.alertBusy = false;
  }
}

function toggleAlerts(){
  S.alertsOn = !S.alertsOn;
  try{ localStorage.setItem('hg_alerts_on', S.alertsOn ? '1':'0'); }catch(e){}
  updateAlertChip();
  if (S.alertsOn){
    runAlertCycle();
    S.alertTimer = setInterval(runAlertCycle, 15*60*1000);
  } else {
    if (S.alertTimer) clearInterval(S.alertTimer);
    S.alertTimer = null;
  }
}
