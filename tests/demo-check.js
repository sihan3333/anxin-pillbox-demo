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
test('“记不清吃没吃”提醒父母先别再吃，并提示子女先看药盒格子', () => {
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
test('大模型结果逐项核对原文：依据都对得上时原样保留', () => {
  const text = '这是降脂药，每次一片，晚上九点吃，睡前用温水送服';
  const r = D.groundCheck(text, { name: '降脂药', dose: '1片', times: ['21:00'], method: '睡前用温水送服',
    evidence: { name: '降脂药', dose: '每次一片', times: ['晚上九点'], method: '睡前用温水送服' } });
  assert.deepEqual([r.name, r.dose, r.times, r.method, r.dropped], ['降脂药', '1片', ['21:00'], '睡前用温水送服', []]);
});
test('大模型把「一日三次」编成具体时刻、把剂量写错时，规则层去掉', () => {
  const r = D.groundCheck('阿莫西林胶囊，一次2粒，一日3次', { name: '阿莫西林胶囊', dose: '3粒', times: ['08:00', '12:00', '18:00'], method: '饭后',
    evidence: { name: '阿莫西林胶囊', dose: '一次2粒', times: ['一日3次'], method: '饭后' } });
  assert.equal(r.name, '阿莫西林胶囊'); assert.equal(r.dose, ''); assert.deepEqual(r.times, []); assert.equal(r.method, '');
  assert.deepEqual(r.dropped, ['每次吃多少', '具体几点', '怎么吃']);
});
test('剂量写成中文数字（一片、半片）时同样能核对通过', () => {
  const r = D.groundCheck('降压药每天早上八点吃一片，饭后吃', { name: '降压药', dose: '一片', times: ['08:00'], method: '饭后',
    evidence: { name: '降压药', dose: '一片', times: ['早上八点'], method: '饭后' } });
  assert.deepEqual([r.dose, r.times, r.dropped], ['一片', ['08:00'], []]);
  assert.equal(D.groundCheck('安眠药睡前吃半片', { dose: '0.5片', evidence: { dose: '半片' } }).dose, '0.5片');
});
test('只说时段的"吃法"（早上吃、早晨服用、晨服）被去掉，真正的吃法保留', () => {
  const g = (t, m) => D.groundCheck(t, { method: m, evidence: { method: m } }).method;
  assert.equal(g('降压药两片，早上吃', '早上吃'), '');
  assert.equal(g('硝苯地平 30mg 每日一次 早晨服用', '早晨服用'), '');
  assert.equal(g('氢氯噻嗪 25mg qd 晨服', '晨服'), '');
  assert.equal(g('降糖药晚饭时吃一片', '晚饭时吃'), '晚饭时吃');
  assert.equal(g('降脂药晚上睡前吃', '睡前'), '睡前');
});
test('剂量给的是范围（1~2片、一到两粒）时去掉，留给子女决定', () => {
  assert.equal(D.groundCheck('一次1~2片，一日3次', { dose: '1~2片', evidence: { dose: '一次1~2片' } }).dose, '');
  assert.equal(D.groundCheck('布洛芬吃一到两粒', { dose: '1-2粒', evidence: { dose: '一到两粒' } }).dose, '');
  assert.equal(D.groundCheck('阿莫西林一次2粒', { dose: '2粒', evidence: { dose: '一次2粒' } }).dose, '2粒');
});
test('依据不是原文里的话（模型自己编的）时，规则层去掉', () => {
  const r = D.groundCheck('降压药早晚各一次', { name: '降压药', dose: '1片', times: ['08:00', '20:00'], method: '',
    evidence: { name: '降压药', dose: '每次1片', times: ['早上8点', '晚上8点'] } });
  assert.equal(r.dose, ''); assert.deepEqual(r.times, []); assert.deepEqual(r.dropped, ['每次吃多少', '具体几点']);
});
test('补药：确认吃了才按每次用量扣减，按每天次数推算还够几天', () => {
  const [m1, m2] = D.S.meds;
  assert.equal(D.daysLeft(m2), 8);
  at('08:01'); D.confirm(am(), 'self');
  assert.equal(m1.stock, 29); assert.equal(m2.stock, 15); assert.equal(D.daysLeft(m2), 7);
});
test('补药：没确认、求助“记不清吃没吃”都不扣药量', () => {
  at('09:00'); D.askHelp(am(), '记不清吃没吃');
  assert.deepEqual(D.S.meds.map(m => m.stock), [30, 16]);
});
test('补药：降到提醒天数时通知子女一次，不抢“已吃药”的横幅', () => {
  const refill = () => D.S.msgs.filter(m => m.type === 'refill');
  at('08:01'); D.confirm(am(), 'self');
  assert.equal(refill().length, 1); assert.equal(refill()[0].read, false);
  assert.ok(refill()[0].text.includes('约够吃 7 天'));
  assert.equal(D.S.msgs.find(m => m.type === 'ok').title, '✅ 妈妈已经吃药了');
  at('20:01'); D.confirm(D.dose('20:00'), 'self');
  assert.equal(refill().length, 1);
});
test('补药：补上药量后不再算“快吃完”，提醒标记重置', () => {
  const m2 = D.S.meds[1];
  at('08:01'); D.confirm(am(), 'self');
  D.restock(m2, 30); assert.equal(D.daysLeft(m2), 22); assert.equal(m2.refillWarned, false);
});
test('补药：半片能算，单位不是片/粒或没填药量时不推算', () => {
  const base = { times: ['08:00', '20:00'] };
  assert.equal(D.perDose({ ...base, dose: '半片' }), 0.5);
  assert.equal(D.daysLeft({ ...base, dose: '半片', stock: 10 }), 10);
  assert.equal(D.perDose({ ...base, dose: '两粒' }), 2);
  assert.equal(D.daysLeft({ ...base, dose: '5mg', stock: 30 }), null);
  assert.equal(D.daysLeft({ ...base, dose: '1片', stock: null }), null);
});

fs.writeFileSync(path.join(__dirname, 'demo-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), scope: '双手机 Demo（demo.js）的提醒、通知、求助、服药顺序与规则统计；不代表实际服药或用户效果', passed: results.length, results }, null, 2));
console.log(`${results.length}/${results.length} passed`);
