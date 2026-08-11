/* HARDGATE — render chart SVG to PNG for Gemini multimodal vision. */

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

async function svgToPngResvg(svg){
  if (!svg || String(svg).indexOf('<svg') < 0) return null;
  try{
    var mod = await import('@resvg/resvg-js');
    var Resvg = mod.Resvg;
    var resvg = new Resvg(String(svg), {
      fitTo: { mode: 'width', value: 820 },
      background: '#0d1117',
    });
    var png = resvg.render().asPng();
    return png.toString('base64');
  }catch(e){
    return null;
  }
}

async function svgToPngPuppeteer(svg, env){
  var browser = await getBrowser(env);
  if (!browser) return null;
  var page;
  try{
    page = await browser.newPage();
    await page.setViewport({ width: 840, height: 440, deviceScaleFactor: 2 });
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
      + '<body style="margin:0;background:#0d1117">' + svg + '</body></html>';
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 12000 });
    return await page.screenshot({ type: 'png', encoding: 'base64', fullPage: false });
  }catch(e){
    return null;
  }finally{
    if (page) await page.close().catch(function(){});
  }
}

/** SVG string → base64 PNG (no data-uri prefix). Client pngBase64 skips this path. */
export async function chartVisionSvgToPng(svg, env){
  if (!svg || String(svg).indexOf('<svg') < 0) return null;
  env = env || process.env;
  if (env.CHART_VISION_PNG === '0' || env.CHART_VISION_PNG === 'false') return null;

  var fromClient = env.__clientPngBase64;
  if (fromClient) return String(fromClient).replace(/^data:image\/\w+;base64,/, '');

  var png = await svgToPngResvg(svg);
  if (png) return png;
  return svgToPngPuppeteer(svg, env);
}

export async function chartVisionRenderCapabilities(env){
  env = env || process.env;
  if (env.CHART_VISION_PNG === '0' || env.CHART_VISION_PNG === 'false'){
    return { pngVision: false, reason: 'CHART_VISION_PNG disabled' };
  }
  var hasResvg = false;
  var hasPuppeteer = false;
  try{ await import('@resvg/resvg-js'); hasResvg = true; }catch(e){}
  try{ await import('puppeteer'); hasPuppeteer = true; }catch(e){}
  if (hasResvg) return { pngVision: true, reason: 'resvg-js (server PNG)' };
  if (hasPuppeteer) return { pngVision: true, reason: 'puppeteer (lazy launch on analyze)' };
  return { pngVision: false, reason: 'install @resvg/resvg-js or puppeteer; or send pngBase64 from browser' };
}

export async function chartVisionCloseBrowser(){
  if (__browser){
    try{ await __browser.close(); }catch(e){}
    __browser = null;
    __browserInit = null;
  }
}
