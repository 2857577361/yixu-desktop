const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-alerts-'));
process.env.YIXU_DATA_DIR=tmp;
const c=require('../core.cjs');
after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('没有时间的打卡不提醒；定时打卡留下可见提醒，完成后清除',()=>{
 const day=c.today(),at='12:30',when=new Date(day+'T12:31:00');
 const x=c.run('checkin.save',{title:'喝水',target:1,times:[]});
 assert.equal(c.quickReminders(when).length,0);
 c.run('checkin.save',{id:x.id,times:[at]});
 assert.equal(c.quickReminders(when).length,1);
 assert.equal(c.quickReminders(when).length,0);
 assert.equal(c.read().alerts.filter(a=>a.kind==='checkin').length,1);
 c.run('checkin.increment',{id:x.id,date:day});
 assert.equal(c.read().alerts.filter(a=>a.kind==='checkin').length,0);
});
test('习惯提醒和计时结束都保留在 App 内，不因系统通知失败而丢失',()=>{
 const day=c.today(),h=c.run('habit.save',{title:'读书',minutes:1,time:'13:00',days:[0,1,2,3,4,5,6]});
 assert.equal(c.reminders(new Date(day+'T13:01:00')).length,1);
 assert.equal(c.read().alerts.filter(a=>a.kind==='habit').length,1);
 c.run('record.set',{id:h.id,date:day,status:'done'});
 assert.equal(c.read().alerts.filter(a=>a.kind==='habit').length,0);
 const timer=c.run('focus.start',{minutes:1});
 c.mutate(s=>{s.timer.startedAt=Date.now()-61000;});
 assert.equal(c.focusAlertDue()?.id,'focus:'+timer.id);
 assert.equal(c.focusAlertDue(),null);
 assert.equal(c.read().alerts.filter(a=>a.kind==='focus').length,1);
 c.run('focus.finish',{});
 assert.equal(c.read().alerts.filter(a=>a.kind==='focus').length,0);
});
