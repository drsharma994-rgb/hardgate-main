/* HARDGATE — render chart SVG to PNG for Gemini multimodal vision (Puppeteer). */

let __browser = null;
let __browserInit = null;

async function getBrowser(env){
  env = env || process.env;
  if (env.CHART_VISION_PNG === '0' || env.CHART_VISION_PNG === 'false') return null;
  if (__browser) return __browser;
  if (__browserInit) return __browserInit;
  __browserInit = (async function(){
    try{
      var puppeteer = await import('puppeteer');
      __browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return __browser;
    }catch(e){
      __browserInit = null;
      return null;
    }
  })();
  return __browserInit;
}

/** SVG string → base64 PNG (no data-uri prefix). Returns null when Puppeteer unavailable. */
export async function chartVisionSvgToPng(svg, env){
  if (!svg || String(svg).indexOf('<svg') < 0) return null;
  env = env || process.env;
  var browser = await getBrowser(env);
  if (!browser) return null;
  var page;
  try{
    page = await browser.newPage();
    await page.setViewport({ width: 820, height: 360, deviceScaleFactor: 2 });
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
      + '<body style="margin:0;background:#0d1117">' + svg + '</body></html>';
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 12000 });
    var buf = await page.screenshot({ type: 'png', encoding: 'base64', fullPage: false });
    return buf || null;
  }catch(e){
    return null;
  }finally{
    if (page) await page.close().catch(function(){});
  }
}

export async function chartVisionRenderCapabilities(env){
  env = env || process.env;
  if (env.CHART_VISION_PNG === '0' || env.CHART_VISION_PNG === 'false'){
    return { pngVision: false, reason: 'CHART_VISION_PNG disabled' };
  }
  try{
    await import('puppeteer');
    return { pngVision: true, reason: 'puppeteer available (lazy launch on analyze)' };
  }catch(e){
    return { pngVision: false, reason: 'puppeteer not installed' };
  }
}

export async function chartVisionCloseBrowser(){
  if (__browser){
    try{ await __browser.close(); }catch(e){}
    __browser = null;
    __browserInit = null;
  }
}
