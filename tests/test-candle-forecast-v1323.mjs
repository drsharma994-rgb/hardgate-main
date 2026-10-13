/* hg-v1323: Ultimate AI Confluence agrees only when both horizons agree. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };
const src = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
function lift(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(lift('hgCfUltimate'), ctx);
const u = ctx.hgCfUltimate;

function bracket(dir, formed, ticket, against) {
  return {
    ok: true, dir: dir, formed: formed, label: dir === 'BULL' ? 'LONG SETUP' : 'SHORT SETUP',
    confluenceView: { familiesWith: ticket ? 2 : 1, familiesAgainst: against || 0, ticket: !!ticket }
  };
}

const split = u(bracket('BULL', true, true, 0), bracket('BEAR', true, true, 0));
ok(split.side === 'SPLIT' && split.formed === false, 'opposite horizons are a split, not a side (' + split.why + ')');
ok(split.stop === undefined && split.entry === undefined && split.tp1 === undefined, 'a split invents no prices');

const unread = u(bracket('BULL', true, true, 0), { ok: false, tf: '4h', why: 'the 4h gold tape could not be read' });
ok(unread.side === null && unread.formed === false && /unread is not agreement/i.test(unread.why),
  'an unread swing is not agreement (' + unread.why + ')');

const neutral = u(bracket('BULL', true, true, 0), { ok: true, dir: 'NEUTRAL', formed: false });
ok(neutral.side === 'NEUTRAL' && neutral.formed === false, 'a neutral swing blocks the ultimate side');

const against = u(bracket('BULL', true, true, 0), bracket('BULL', true, true, 1));
ok(against.side === 'BULL' && against.formed === false && /nets against/.test(against.why),
  'a family against blocks the setup but still names the shared side');

const one = u(bracket('BULL', true, true, 0), bracket('BULL', false, false, 0));
ok(one.side === 'BULL' && one.formed === false, 'agreement without both setups is not an ultimate setup');

const both = u(bracket('BEAR', true, true, 0), bracket('BEAR', true, true, 0));
ok(both.formed === true && both.side === 'BEAR', 'both formed tickets on the same side are the ultimate setup');
ok(both.stop === undefined && both.tp1 === undefined && both.entry === undefined, 'the ultimate setup still has no third price');
ok(/own tapes/.test(both.why), 'it says the stops stay on their own tapes');

const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
ok(/data-cf-ultimate="1"/.test(tab), 'the card has an ultimate block');
ok(/ULTIMATE AI CONFLUENCE/.test(tab), 'the card names Ultimate AI Confluence');
ok(/window\.hgCfUltimate\(forecast\.scalp, forecast\.swing\)/.test(tab), 'the tab asks the engine after both horizons exist');
ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');
ok(/not the same risk/.test(tab), 'the scalp and swing stops are still not the same risk');

console.log('\ntest-candle-forecast-v1323: ' + pass + ' passed');
