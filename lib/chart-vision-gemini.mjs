/* HARDGATE — Google Gemini multimodal call for chart vision (optional). */

const DEFAULT_TIMEOUT = 32000;
const DEFAULT_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

function geminiModels(env){
  env = env || {};
  if (env.GEMINI_MODEL && String(env.GEMINI_MODEL).trim()){
    return [String(env.GEMINI_MODEL).trim()].concat(
      DEFAULT_MODELS.filter(function(m){ return m !== String(env.GEMINI_MODEL).trim(); })
    );
  }
  return DEFAULT_MODELS.slice();
}

function buildParts(opts){
  var parts = [{ text: opts.prompt || 'Analyze this chart.' }];
  if (opts.pngBase64){
    var data = String(opts.pngBase64).replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: data,
      },
    });
  } else if (opts.svg){
    parts.push({ text: 'Chart SVG (candlesticks + EMA9/21/50 + volume):\n' + String(opts.svg).slice(0, 14000) });
  }
  return parts;
}

function extractText(j){
  if (!j) return '';
  try{
    var cands = j.candidates || [];
    for (var ci = 0; ci < cands.length; ci++){
      var c = cands[ci];
      if (c.content && c.content.parts){
        return c.content.parts.map(function(p){ return p.text || ''; }).join('\n').trim();
      }
    }
  }catch(e){}
  return '';
}

function extractBlockReason(j){
  try{
    var pf = j.promptFeedback;
    if (pf && pf.blockReason) return 'blocked: ' + pf.blockReason;
    var c = (j.candidates && j.candidates[0]) || null;
    if (c && c.finishReason && c.finishReason !== 'STOP') return 'finish: ' + c.finishReason;
  }catch(e){}
  return '';
}

async function callOneModel(model, apiKey, parts, timeoutMs){
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + encodeURIComponent(model) + ':generateContent';
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
  try{
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });
    var raw = await res.text();
    if (!res.ok){
      throw new Error('Gemini HTTP ' + res.status + ' [' + model + ']: ' + raw.slice(0, 240));
    }
    var j = JSON.parse(raw);
    var text = extractText(j);
    if (!text){
      var br = extractBlockReason(j);
      throw new Error('Gemini empty response [' + model + ']' + (br ? ' — ' + br : ''));
    }
    return { text: text, model: model };
  }finally{
    clearTimeout(timer);
  }
}

export async function chartVisionGeminiCall(opts){
  opts = opts || {};
  var apiKey = opts.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  var models = opts.models || geminiModels(opts.env);
  var parts = buildParts(opts);
  var timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT;
  var t0 = Date.now();
  var lastErr = null;

  for (var mi = 0; mi < models.length; mi++){
    try{
      var out = await callOneModel(models[mi], apiKey, parts, timeoutMs);
      return { text: out.text, ms: Date.now() - t0, model: out.model };
    }catch(e){
      lastErr = e;
      /* 404 model not found → try next */
      if (String(e.message || '').indexOf('404') >= 0) continue;
      if (String(e.message || '').indexOf('not found') >= 0) continue;
      /* rate limit → try next model once */
      if (String(e.message || '').indexOf('429') >= 0) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Gemini all models failed');
}

export { geminiModels };
