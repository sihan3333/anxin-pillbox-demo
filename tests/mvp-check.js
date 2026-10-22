const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const M = require('../mvp/mvp.js');
const results = [];
function test(name, fn) { fn(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
const cfg = { v: 1, mom: '妈妈', child: '女儿', phone: '13800000000', meds: [
  { name: '降压药', dose: '1片', times: ['08:00'], method: '早饭后，用温水送服', slot: '1', look: '蓝色盒子' },
  { name: '降糖药', dose: '1片', times: ['08:00', '20:00'], method: '和饭一起吃', slot: '2', look: '' }
] };

test('配置写进链接再读出来，中文不乱码', () => assert.deepEqual(M.decode(M.encode(cfg)), cfg));
test('链接里的配置只用网址安全字符', () => assert.match(M.encode(cfg), /^[A-Za-z0-9_-]+$/));
test('坏掉的链接返回空，不报错', () => assert.equal(M.decode('%%%not-base64'), null));
test('同一时刻先说和饭一起吃的，再说饭后的', () => {
  const d = M.doses(cfg).find(x => x.time === '08:00');
  assert.deepEqual(d.meds.map(m => m.name), ['降糖药', '降压药']);
  const t = M.instruction(d);
  assert.ok(t.indexOf('第一种，吃饭时吃') < t.indexOf('第二种，饭后吃'));
});
test('只有一种药时不说“第一种”', () => assert.ok(!M.instruction(M.doses(cfg).find(x => x.time === '20:00')).includes('第一种')));
test('到点后 3 小时内显示这一顿', () => assert.equal(M.currentDose(M.doses(cfg), M.toMin('08:40')).time, '08:00'));
test('超过 3 小时显示下一顿', () => assert.equal(M.currentDose(M.doses(cfg), M.toMin('12:00')).time, '20:00'));
test('最后一顿之后显示明天第一顿', () => assert.equal(M.currentDose(M.doses(cfg), M.toMin('23:59')).time, '08:00'));
test('短信链接带上手机号和正文', () => {
  const s = M.smsLink('13800000000', '吃好了 08:03');
  assert.ok(s.startsWith('sms:13800000000?&body=')); assert.equal(decodeURIComponent(s.split('body=')[1]), '吃好了 08:03');
});

fs.writeFileSync(path.join(__dirname, 'mvp-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), scope: '人工模拟版 MVP 的共用逻辑（mvp/mvp.js）；不代表真实使用效果', passed: results.length, results }, null, 2));
console.log(`${results.length}/${results.length} passed`);
