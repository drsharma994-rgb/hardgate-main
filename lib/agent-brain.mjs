/* Run AI AGENT workforce swarm via headless browser (Puppeteer). */
const DEFAULT_URL = process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:10000/';
const SWARM_TIMEOUT_MS = +(process.env.HARDGATE_AGENT_TIMEOUT_MS || 420000);

export async function runAgentSwarm(siteUrl){
  siteUrl = (siteUrl || DEFAULT_URL).replace(/\/?$/, '/');
  var puppeteer;
  try{
    puppeteer = await import('puppeteer');
  }catch(e){
    return { ok: false, reason: 'puppeteer not installed — npm install puppeteer (optional) for agent swarm' };
  }
  var browser;
  try{
    browser = await puppeteer.default.launch({
      headless: true,
      protocolTimeout: 600000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    var page = await browser.newPage();
    await page.goto(siteUrl + '?daemon=agent&' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(function(){
      return typeof window.hgAgentSwarmRun === 'function';
    }, { timeout: 90000 }).catch(function(){});

    var result = await page.evaluate(async function(timeoutMs){
      try{
        if (typeof window.hgAgentSwarmRun !== 'function'){
          return { ok: false, reason: 'hgAgentSwarmRun not registered on page' };
        }
        var mods = (typeof HG_TAB_MODS !== 'undefined' && HG_TAB_MODS) ? HG_TAB_MODS : {};
        var mod = mods.aiagent;
        if (mod && typeof mod.mount === 'function'){
          var pane = document.createElement('div');
          pane.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:700px;overflow:hidden;';
          document.body.appendChild(pane);
          mod.mount(pane);
        }
        var t0 = Date.now();
        var out = await window.hgAgentSwarmRun(true);
        if (!out || out.ok === false){
          return { ok: false, reason: (out && out.reason) || 'swarm returned not ok', ms: Date.now() - t0 };
        }
        return {
          ok: true,
          ms: Date.now() - t0,
          desk: out.desk || null,
          agents: out.agents || null,
          stat: out.stat || '',
        };
      }catch(e){
        return { ok: false, reason: (e && e.message) || String(e) };
      }
    }, SWARM_TIMEOUT_MS);

    return result;
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }finally{
    if (browser) await browser.close().catch(function(){});
  }
}
