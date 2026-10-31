import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0, fail = 0;
function ok(cond, msg){
  n++;
  if (!cond){ fail++; console.log('FAIL', msg); }
  else console.log('ok', msg);
}

const ctx = { console, Date, Math };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib/hg-gold-foundation.js'), 'utf8'), ctx);
const J = ctx.hgGoldFoundationJudge;
const P = ctx.hgGoldMeasuredPrefer;

ok(P('scalp', 'p6fail') && P('scalp', 'p6fail').net === 0.128, 'p6fail is the scalp prefer');
ok(P('scalp', 'asian') == null && P('scalp', 'rsidiv') == null && P('scalp', 'bosalign') == null, 'measured losers are not prefers');
ok(P('scalp', 'accurate') == null, 'the failed-sweep has no win-rate record');
ok(P('swing', 'weekly') && P('swing', 'p9volbar') && P('swing', 'fvg') == null, 'swing prefer is weekly and p9volbar only');

const prefer = J({ stratKey: 'p6fail', geometryOk: true, dir: 'long' }, { lane: 'scalp' });
ok(prefer.mayLead === true && prefer.measured === 'prefer', 'p6fail may lead');

const blocked = J({ stratKey: 'accurate', geometryOk: true, dir: 'long' }, { lane: 'scalp', preferSibling: true });
ok(blocked.mayLead === false && /measured prefer/.test(blocked.reason), 'unmeasured does not replace p6fail');

const open = J({ stratKey: 'accurate', geometryOk: true, dir: 'long' }, { lane: 'scalp', preferSibling: false, sentiment: 'short' });
ok(open.mayLead === true && open.sentiment === 'not a side', 'sentiment does not choose the side, and an empty board may still lead');

const black = J({ stratKey: 'accurate', geometryOk: true, dir: 'long' }, { lane: 'scalp', fund: { refuse: true, reason: 'macro event blackout' } });
ok(black.mayLead === false && black.measured === 'refuse', 'a red-folder blackout does not lead');

const wind = J({ stratKey: 'p6fail', geometryOk: true, dir: 'long' }, { lane: 'scalp', fund: { demote: true, reason: 'fundamental headwind 2v0' } });
ok(wind.mayLead === false && wind.measured === 'demote', 'a 2-vote headwind does not lead, even on the prefer');

const bad = J({ stratKey: 'p6fail', geometryOk: false, dir: 'long' }, { lane: 'scalp' });
ok(bad.mayLead === false && /beyond the entry/.test(bad.reason), 'wrong-side geometry does not lead');

const dark = J({ stratKey: 'accurate', geometryOk: true }, { lane: 'scalp', fund: { refuse: false, demote: false } });
ok(dark.mayLead === true, 'a dark board does not veto');

const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
const gp = fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8');
const cf = fs.readFileSync(path.join(ROOT, 'gold-confluence.js'), 'utf8');
const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
ok(/hgGoldFoundationJudge/.test(gs) && /hgGoldMeasuredPrefer/.test(gs), 'GOLD SCALP asks the measured rank before the accuracy plan leads');
ok(/Sentiment is a lagged read/.test(gs) && /Fundamental board unread/.test(gs), 'GOLD SCALP names sentiment as not a side and a dark board as not a veto');
ok(/hgFundamentalGate/.test(gp) && /A measured Pine lane already leads/.test(gp) && /Fundamental board unread/.test(gp), 'PINE GOLD does not let the unmeasured plan replace a measured lane, and it reads the fundamental gate');
ok(/result\.fundBlackout/.test(gp), 'a pine blackout does not mint a fresh accuracy lead');
ok(/win\.hgFundamentalGate/.test(cf) && /built\.ready = false/.test(cf) && /does not choose this side/.test(cf), 'CONFLUENCE stands a fresh setup aside on a fundamental refuse or headwind, and sentiment is not a side');
ok(/function hgOgLeadMeasOk/.test(og) && /c\.fundGate\.refuse === true/.test(og), 'OMNIGOLD still leads only on its own win-rate bar and still drops a fundamental refuse');

console.log(fail ? (fail + ' FAILED of ' + n) : ('PASS ' + n));
process.exit(fail ? 1 : 0);
