/* HARDGATE — Google Gemini multimodal call for chart vision (optional). */

const DEFAULT_TIMEOUT = 28000;

export async function chartVisionGeminiCall(opts){
  opts = opts || {};
  var apiKey = opts.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  var model = opts.model || 'gemini-2.0-flash';
  var parts = [{ text: opts.prompt || 'Analyze this chart.' }];
  if (opts.pngBase64){
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: String(opts.pngBase64).replace(/^data:image\/png;base64,/, ''),
      },
    });
  } else if (opts.svg){
    parts.push({ text: 'Chart SVG (render mentally as candlesticks):\n' + String(opts.svg).slice(0, 12000) });
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, opts.timeoutMs || DEFAULT_TIMEOUT);
  var t0 = Date.now();
  try{
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok){
      var errBody = await res.text().catch(function(){ return ''; });
      throw new Error('Gemini HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 200) : ''));
    }
    var j = await res.json();
    var text = '';
    try{
      text = j.candidates[0].content.parts.map(function(p){ return p.text || ''; }).join('\n');
    }catch(e){}
    return { text: text, ms: Date.now() - t0 };
  }finally{
    clearTimeout(timer);
  }
}
