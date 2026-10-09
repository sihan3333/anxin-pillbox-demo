const assert=require('node:assert/strict'),fs=require('node:fs'),f=require('../src/family');
function base(){const p=f.make('2030-01-01',[{name:'样例',dose:'1片',times:['08:00'],slot:'1号',appearance:'虚构外观',method:'虚构吃法'}],'核对人');p.consent=true;return p;}
const results=[];function test(name,fn){fn();results.push({name,status:'pass'});console.log('PASS '+name);}
test('位置或吃法不明确阻断启用',()=>assert.throws(()=>f.make('2030-01-01',[{name:'A',dose:'1片',times:['08:00'],slot:'',appearance:'圆',method:''}],'家人')));
test('到点只提醒父母不自动确认',()=>{const p=base();p.clock='2030-01-01T08:00:00';f.evaluate(p);assert.equal(p.reminders.length,1);assert.equal(p.notifications.length,0);assert.equal(p.tasks[0].status,'pending');});
test('十五分钟再次提醒但未升级',()=>{const p=base();p.clock='2030-01-01T08:15:00';f.evaluate(p);assert.equal(p.reminders.length,2);assert.equal(p.notifications.length,0);});
test('三十分钟未确认通知子女且不重复',()=>{const p=base();p.clock='2030-01-01T08:30:00';f.evaluate(p);f.evaluate(p);assert.equal(p.notifications.length,1);assert.equal(p.notifications[0].type,'overdue');assert.equal(p.tasks[0].status,'pending');});
test('六十分钟设置不会三十分钟升级',()=>{const p=base();p.waitMinutes=60;p.clock='2030-01-01T08:30:00';f.evaluate(p);assert.equal(p.notifications.length,0);p.clock='2030-01-01T09:00:00';f.evaluate(p);assert.equal(p.notifications.length,1);});
test('错误药格不能作为确认依据',()=>{const p=base();p.clock='2030-01-01T08:01:00';assert.equal(f.open(p,p.tasks[0].id,'错误'),false);assert.throws(()=>f.confirm(p,p.tasks[0].id));});
test('未到点阻断服药确认',()=>{const p=base();f.open(p,p.tasks[0].id,'1号');assert.throws(()=>f.confirm(p,p.tasks[0].id));});
test('正常确认生成一次有依据短信且停止升级',()=>{const p=base();p.clock='2030-01-01T08:01:00';f.open(p,p.tasks[0].id,'1号');f.confirm(p,p.tasks[0].id);f.confirm(p,p.tasks[0].id);p.clock='2030-01-01T09:00:00';f.evaluate(p);assert.equal(p.notifications.length,1);assert.equal(p.notifications[0].type,'confirmed');assert.equal(f.issues(p).length,0);});
test('没有授权不生成子女短信或摘要',()=>{const p=base();p.consent=false;p.clock='2030-01-01T09:00:00';f.evaluate(p);assert.equal(p.notifications.length,0);assert.deepEqual(f.issues(p),[]);assert.equal(f.summary(p),'父母未授权分享。');});
test('设备离线暂停逐药超时推断',()=>{const p=base();p.online=false;p.clock='2030-01-01T09:00:00';f.evaluate(p);assert.equal(p.notifications.length,1);assert.equal(p.notifications[0].type,'offline');assert.equal(p.reminders.length,0);assert.equal(f.issues(p)[0].id,'offline');});
test('找不到药立即通知无需等半小时',()=>{const p=base();f.help(p,p.tasks[0].id,'missing');assert.equal(p.notifications[0].type,'help');assert.equal(f.issues(p).length,1);});
test('打开对应药格不会自动写成已服药',()=>{const p=base();f.open(p,p.tasks[0].id,'1号');assert.equal(p.tasks[0].status,'pending');assert.equal(p.notifications.length,0);});
fs.writeFileSync(require('node:path').join(__dirname,'family-results.json'),JSON.stringify({testedAt:new Date().toISOString(),scope:'新版B用药指引及通知规则；不代表实际服药或用户效果',passed:results.length,results},null,2));
