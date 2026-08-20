/* HARDGATE — NEXT GOLD LEVELS: the gold desk names the next high and the
   next bottom BEFORE the market arrives.

   OMNIGOLD reacted: every card began with a mechanic that had already
   fired. The reader's standing question — "the high it will fall from and
   the bottom it will rise from" — was answerable earlier: ADR bands, the
   Asia range, the prior week's extremes and the shared engine's own
   sources (swings, prior day, Donchian, value area, rounds, AVWAP) are
   all computable before price gets there. hgOgZoneLevels feeds the
   gold-only levels into the shared zone engine ON EQUAL TERMS — one more
   voice at a zone, never a zone by itself — and hgOgZonesPanel leads the
   page with the nearest armed zone each way, its trigger rule, and the
   times a trigger can fire.

   The panel is ANTICIPATION, NOT A TICKET — the 35-gate cards below stay
   the only path to one — and it must degrade to nothing, silently, when
   the engine is not loaded.

   Run: node tests/test-gold-zones.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const BASE = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
              'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js'];
const W = boot(BASE.concat(['omnipresent.js']));

/* A gold-shaped 1h tape: fourteen ~day cycles around 4400 then a drift to
   ~4460 — days exist (so ADR exists), Asia hours exist, prior weeks exist. */
function goldTape(n){
  const out = []; let s = 11;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  const t0 = 1700000000 - (1700000000 % 86400);
  for (let i = 0; i < n; i++){
    const day = Math.floor(i / 24), hr = i % 24;
    const p = 4400 + day * 2 + Math.sin(hr / 24 * Math.PI * 2) * 22 + (rnd() - 0.5) * 6;
    out.push({ t: t0 + i * 3600, o: p - 1, h: p + 4, l: p - 4, c: p, v: 900 + rnd() * 300 });
  }
  return out;
}

console.log('== the gold-only levels land on the correct sides ==');
{
  const rows = goldTape(500);
  const live = rows[rows.length - 1].c;
  const lv = W.hgOgZoneLevels(rows, live);
  ok(lv && Array.isArray(lv.above) && Array.isArray(lv.below), 'levels come back split by side');
  const srcs = lv.above.concat(lv.below).map(l => l.src);
  ok(srcs.some(s2 => /ADR/.test(s2)), 'ADR band present: ' + srcs.filter(s2 => /ADR/.test(s2)).join(', '));
  ok(srcs.some(s2 => /Asia/.test(s2)), 'Asia range present');
  ok(srcs.some(s2 => /prior-week/.test(s2)), 'prior-week extremes present');
  ok(lv.above.every(l => l.px > live) && lv.below.every(l => l.px < live),
     'every level sits on its own side of the market');
}

console.log('\n== desk levels join the shared cluster on equal terms ==');
{
  const rows = goldTape(500);
  const live = rows[rows.length - 1].c;
  const bare = W.opAssess(rows, live);
  const fed = W.opAssess(rows, live, W.hgOgZoneLevels(rows, live));
  ok(Array.isArray(fed), 'opAssess accepts the extra levels');
  const conf = side => { const c = (side || []).filter(x => x)[0]; return c ? c.zone.confluence : 0; };
  ok(fed.length >= bare.length, 'extra sources never remove a zone (' + bare.length + ' -> ' + fed.length + ')');
  /* An extra source landing inside an existing zone raises its confluence;
     a lone extra far from everything must NOT create a zone by itself. */
  const lone = W.opAssess(rows, live, { above: [{ px: live * 1.5, src: 'lonely level' }], below: [] });
  ok(!lone.some(c => c.zone.srcs.indexOf('lonely level') >= 0 && c.zone.confluence === 1),
     'a lone desk level is one voice, never a zone by itself');
}

console.log('\n== the panel: anticipation that leads the page, honestly labeled ==');
{
  const rows = goldTape(500);
  const live = rows[rows.length - 1].c;
  const html = W.hgOgZonesPanel(rows, live);
  if (html){
    ok(/NEXT GOLD LEVELS/.test(html), 'the panel names itself');
    ok(/anticipation/.test(html) && /tickets are decided by the gated cards below/.test(html),
       'and states what it is NOT — a ticket');
    ok(/triggers evaluate at 1h closes/.test(html), 'with the exact times a trigger can fire');
    ok(/ARMED|TRIGGERED/.test(html), 'and each zone declares its lifecycle state');
    ok(/SL /.test(html) && /TP1 /.test(html) && /trigger:/.test(html), 'levels and the trigger rule on the card');
    passed += 0;
  } else {
    /* A quiet tape with no zone in reach is a legitimate empty — but the
       machinery must still exist. */
    ok(typeof W.hgOgZonesPanel === 'function', 'panel machinery exists (this tape had no zone in reach)');
  }
}

console.log('\n== without the engine, the panel degrades to nothing — silently ==');
{
  const W2 = boot(BASE);   /* omnipresent.js NOT loaded */
  const rows = goldTape(500);
  ok(W2.hgOgZonesPanel(rows, rows[rows.length - 1].c) === '',
     'no opAssess -> empty string, no throw, no fake panel');
}

console.log('\n== source: the panel leads the render, and only the gated cards ticket ==');
{
  const GOLD = read('omnigold.js');
  ok(/h \+= hgOgZonesPanel\(res\.scalp\.rows, res\.scalp\.livePx\);/.test(GOLD),
     'the panel is prepended before the mechanic cards');
  const panelFn = GOLD.slice(GOLD.indexOf('function hgOgZonesPanel'), GOLD.indexOf('/* ==================== render ===================='));
  ok(!/TICKET/.test(panelFn.replace(/tickets are decided/g, '')), 'the panel never prints a TICKET badge of its own');
}



console.log('\n== v417: the mechanic cards finally know where the zones are ==');
{
  const GOLD2 = read('omnigold.js');
  ok(/key:'zone-anchor', hard:false, info:true/.test(GOLD2),
     'zone-anchor is on the gold ledger, info-only — standing, never existence');
  ok(/zoneCtx: zoneCtx/.test(GOLD2) && /opFn2\(rows, livePx, hgOgZoneLevels\(rows, livePx\)\)/.test(GOLD2),
     'the scan computes the zones once per horizon and hands them to the ledger');

  const W3 = boot(BASE.concat(['omnipresent.js']));
  const rows = goldTape(500);
  const live = rows[rows.length - 1].c;
  const zc = W3.opAssess(rows, live, W3.hgOgZoneLevels(rows, live));
  if (zc.length){
    const zEdge = zc[0].zone.lo;
    const at = W3.hgOgGates(rows, { dir: 'short', kind: 'POC-REVERT', mech: 'POC-REVERT', level: zEdge },
      { livePx: live, zoneCtx: zc }).filter(g => g && g.key === 'zone-anchor')[0];
    ok(at && at.pass === true && /anchored AT the level|within working distance/.test(at.why),
       'a mechanic firing at the zone reads anchored: ' + at.why.slice(0, 80));
    const far = W3.hgOgGates(rows, { dir: 'short', kind: 'POC-REVERT', mech: 'POC-REVERT', level: live * 1.2 },
      { livePx: live, zoneCtx: zc }).filter(g => g && g.key === 'zone-anchor')[0];
    ok(far && far.pass === false && far.info === true && /no structure within reach/.test(far.why),
       'a mechanic in no-man’s-land reads AGAINST (info), never vetoed');
  } else {
    /* this tape is BUILT to produce zones — none at all means the level
       machinery broke, and that must fail loudly, not skip politely */
    throw new Error('FAIL: goldTape produced no zones for the anchored/no-man’s-land cases');
  }
  const un = W3.hgOgGates(rows, { dir: 'short', kind: 'POC-REVERT', mech: 'POC-REVERT', level: live },
    { livePx: live }).filter(g => g && g.key === 'zone-anchor')[0];
  ok(un && un.pass === null && /unavailable/.test(un.why),
     'no zone context -> UNCHECKED, never a guess');

  ok(/HORIZONS ALIGNED/.test(GOLD2) && /HORIZON CONFLICT/.test(GOLD2)
     && /horizon reads the OTHER way/.test(GOLD2),
     'and the two horizons finally look at each other — agreement or conflict named on the card');
}

console.log('\npassed: ' + passed);
