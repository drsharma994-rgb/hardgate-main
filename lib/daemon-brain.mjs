/* Run one full BRAIN synthesis via headless browser (Puppeteer). */
const DEFAULT_URL = process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:10000/';
const SCAN_TIMEOUT_MS = +(process.env.HARDGATE_BRAIN_TIMEOUT_MS || 360000);

export async function runBrainSynthesis(siteUrl){
  siteUrl = (siteUrl || DEFAULT_URL).replace(/\/?$/, '/');
  var puppeteer;
  try{
    puppeteer = await import('puppeteer');
  }catch(e){
    return { ok: false, reason: 'puppeteer not installed — npm install puppeteer (optional) for daemon brain scans' };
  }
  var browser;
  try{
    browser = await puppeteer.default.launch({
      headless: true,
      protocolTimeout: 600000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    var page = await browser.newPage();
    await page.goto(siteUrl + '?daemon=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#brainRun', { timeout: 45000 }).catch(function(){});
    await new Promise(function(r){ setTimeout(r, 2000); });

    var result = await page.evaluate(async function(timeoutMs){
      try{
        var mods = (typeof HG_TAB_MODS !== 'undefined' && HG_TAB_MODS) ? HG_TAB_MODS : {};
        var mod = mods.brain;
        if (!mod || typeof mod.mount !== 'function'){
          return { ok: false, reason: 'brain module not registered on page' };
        }
        var pane = document.createElement('div');
        pane.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;overflow:hidden;';
        document.body.appendChild(pane);
        mod.mount(pane);
        var runBtn = pane.querySelector('#brainRun');
        if (!runBtn) return { ok: false, reason: 'brain pane missing #brainRun' };
        runBtn.click();
        var t0 = Date.now();
        var stat = '';
        while (Date.now() - t0 < timeoutMs){
          await new Promise(function(r){ setTimeout(r, 4000); });
          stat = (pane.querySelector('#brainStat') || {}).textContent || '';
          if (/^done/i.test(stat)) break;
          if (/^failed/i.test(stat)) return { ok: false, reason: 'brain synthesis failed: ' + stat };
        }
        if (!/^done/i.test(stat)){
          return { ok: false, reason: 'brain synthesis timed out — last stat: ' + stat };
        }
        var last = (typeof window.__hgBrainLast === 'function') ? window.__hgBrainLast() : null;
        if (!last || !Array.isArray(last.rows)){
          return { ok: false, reason: 'brain finished but __hgBrainLast() empty' };
        }
        return {
          ok: true,
          at: last.at,
          marketRead: last.marketRead || '',
          rows: last.rows.map(function(r){
            return {
              sym: r.sym,
              dir: r.dir,
              tier: r.tier,
              plan: r.plan,
              evidence: r.evidence,
            };
          }),
          stat: stat,
        };
      }catch(e){
        return { ok: false, reason: (e && e.message) || String(e) };
      }
    }, SCAN_TIMEOUT_MS);

    return result;
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }finally{
    if (browser) await browser.close().catch(function(){});
  }
}
