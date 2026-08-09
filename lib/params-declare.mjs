/* HARDGATE — declared parameter blocks for CALIBRATE / formation (QuantDinger @param style). */

const PARAM_RE = /^#\s*@param\s+(\w+)\s+([\d.]+)(?:\s*-\s*([\d.]+))?\s*(?:default:\s*([\d.]+))?/gm;

/** Parse `# @param name min-max default: x` lines from text. */
export function hgParseParamDeclare(text){
  var out = {};
  if (!text) return out;
  var m;
  PARAM_RE.lastIndex = 0;
  while ((m = PARAM_RE.exec(text)) !== null){
    var name = m[1];
    var lo = +m[2];
    var hi = m[3] != null ? +m[3] : lo;
    var def = m[4] != null ? +m[4] : lo;
    out[name] = { min: lo, max: hi, default: def, name: name };
  }
  return out;
}

/** Clamp params object to declared ranges. */
export function hgClampDeclaredParams(params, declared){
  params = Object.assign({}, params || {});
  declared = declared || {};
  for (var k in declared){
    if (!Object.prototype.hasOwnProperty.call(declared, k)) continue;
    var d = declared[k];
    if (params[k] == null) params[k] = d.default;
    var v = +params[k];
    if (!isFinite(v)) v = d.default;
    params[k] = Math.max(d.min, Math.min(d.max, v));
  }
  return params;
}

export const HG_FORMATION_PARAM_DECLARE = `
# @param fqsFloor 50 - 80 default: 62
# @param stopBufAtr 0.1 - 0.5 default: 0.25
# @param minRr 1.5 - 3.0 default: 2.0
`;

export function hgFormationDeclaredParams(){
  return hgParseParamDeclare(HG_FORMATION_PARAM_DECLARE);
}
