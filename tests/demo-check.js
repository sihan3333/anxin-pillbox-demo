const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const D = require('../demo.js');
const results = [];
function test(name, fn) { D.fresh(); fn(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
const at = t => { const [h, m] = t.split(':').map(Number); D.tick(h * 60 + m); };
const am = () => D.dose('08:00');
const alerts = () => D.S.msgs.filter(m => m.type === 'alert');

test('同一时刻先播和饭一起吃的降糖药，再播饭后的降压药', () => {
  assert.deepEqual(D.medsOf(am()).map(m => m.id), ['m2', 'm1']);
  const t = D.instruction(am());
  assert.ok(t.indexOf('第一种，吃饭时吃') < t.indexOf('第二种，饭后吃'));
});
test('饭前、随餐、饭后、睡前排序；没写饭点的保持录入顺序', () => {
  const mk = (id, method) => ({ id, name: id, dose: '1片', slot: 1, box: 'blue', pill: 'white', shape: 'round', method, times: ['08:00'] });
  D.S.meds = [mk('睡前', '睡前用温水送服'), mk('饭后', '饭后吃'), mk('无1', '用温水送服'), mk('饭前', '饭前半小时空腹吃'), mk('随餐', '随餐服用'), mk('无2', '整片吞服')];
  const d = { medIds: D.S.meds.map(m => m.id) };
  assert.deepEqual(D.medsOf(d).map(m => m.id), ['饭前', '无1', '随餐', '无2', '饭后', '睡前']);
});
test('只有一种药时不说“第一种”', () => {
  D.S.meds = [D.S.meds[0]];
  assert.ok(!D.instruction({ time: '08:00', medIds: ['m1'] }).includes('第一种'));
});
test('到点只响铃提醒父母，不自动确认、不通知子女', () => {
  at('08:00');
  assert.equal(D.S.parent, 'ring'); assert.equal(D.S.ringType, 'due');
  assert.equal(am().status, 'pending'); assert.equal(alerts().length, 0);
});
test('15 分钟第 2 次响铃，仍不通知子女', () => {
  at('08:15');
  assert.equal(D.S.ringType, 'repeat'); assert.equal(alerts().length, 0);
});
test('30 分钟未确认通知子女，且只通知一次', () => {
  at('08:30'); at('08:50');
  assert.equal(alerts().length, 1); assert.equal(am().status, 'pending');
});
test('设为 60 分钟时，30 分钟不通知', () => {
  D.S.waitMin = 60; at('08:30');
  assert.equal(alerts().length, 0);
  at('09:00'); assert.equal(alerts().length, 1);
});
test('父母确认后停止后续提醒和通知', () => {
  at('08:01'); D.confirm(am(), 'self'); at('09:00');
  assert.equal(alerts().length, 0); assert.equal(D.S.ringType, 'due');
  assert.equal(D.S.msgs.filter(m => m.type === 'ok').length, 1);
});
test('父母求助立即通知子女，不用等 30 分钟', () => {
  at('08:01'); D.askHelp(am(), '找不到药');
  assert.equal(D.S.msgs.filter(m => m.type === 'help').length, 1); assert.equal(am().status, 'help');
});
test('“记不清吃没吃”提醒父母先别再吃，并提示子女先看药格', () => {
  at('08:01'); D.askHelp(am(), '记不清吃没吃');
  assert.ok(D.S.lastSpeech.includes('先不要再吃'));
  assert.ok(D.S.msgs[0].text.includes('避免重复吃药'));
});
test('子女电话后设 15 分钟再响铃，再过 15 分钟没确认会再通知', () => {
  at('08:30'); const d = am(); d.follow = D.S.min + 15;
  at('08:45'); assert.equal(D.S.ringType, 'follow'); assert.equal(alerts().length, 1);
  at('09:00'); assert.equal(alerts().length, 2);
});
test('AI 分析从记录里算出“周末早上要再提醒”的规律', () => {
  const s = D.weekStats();
  assert.equal(s.am.weekendPattern, true); assert.equal(s.am.weLate, 2);
  assert.equal(s.pm.weekendPattern, false); assert.deepEqual(s.pm.help.map(h => h.why), ['记不清吃没吃']);
});
test('记录变了，AI 分析的结论跟着变', () => {
  const saved = D.WEEK.map(x => x.am);
  D.WEEK.forEach(x => { x.am = 'ok'; });
  try { assert.equal(D.weekStats().am.weekendPattern, false); } finally { D.WEEK.forEach((x, i) => { x.am = saved[i]; }); }
});
test('AI 录入只提取原话里明确的内容', () => {
  assert.deepEqual(D.aiParse('这是降脂药，每次一片，晚上九点吃，睡前用温水送服'), { name: '降脂药', dose: '1片', times: ['21:00'], method: '睡前用温水送服' });
});
test('AI 录入不猜没说清的剂量和时刻', () => {
  const r = D.aiParse('降压药每天两次');
  assert.equal(r.dose, ''); assert.deepEqual(r.times, []);
});

fs.writeFileSync(path.join(__dirname, 'demo-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), scope: 'v3 双手机 Demo（demo.js）的提醒、通知、求助、服药顺序与规则 Mock；不代表实际服药或用户效果', passed: results.length, results }, null, 2));
console.log(`${results.length}/${results.length} passed`);
