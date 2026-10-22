const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-life-test-'));process.env.YIXU_DATA_DIR=tmp;const c=require('../core.cjs'),M=require('../ui/life-model.js'),media=require('../media.cjs');after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
const make=(extra={})=>c.run('habit.save',{title:'周目标',minutes:20,days:[0,1,2,3,4,5,6],...extra});
test('每周次数、最低版、累计分钟和目标调整独立计算',()=>{
 const h=make({goal:{period:'week',unit:'count',target:3}});c.run('goal.record',{id:h.id});c.run('goal.record',{id:h.id});assert.equal(M.weekly(c.read(),h,c.today()).value,2);c.run('goal.record',{id:h.id,delta:-1});
 c.run('focus.start',{id:h.id,mode:'minimum'});c.run('focus.finish',{complete:true});assert.equal(M.weekly(c.read(),h,c.today()).minimum,1);assert.equal(M.weekly(c.read(),h,c.today()).value,1);
 for(let i=0;i<2;i++){c.run('focus.start',{id:h.id});c.run('focus.finish',{complete:true});}assert.equal(M.weekly(c.read(),h,c.today()).value,3);
 const updated=c.run('habit.save',{id:h.id,goal:{period:'week',unit:'count',target:5}});assert.equal(M.weekly(c.read(),updated,c.today()).target,5);
 const m=make({goal:{period:'week',unit:'minutes',target:120}});c.run('goal.record',{id:m.id,minutes:119});c.mutate(s=>s.sessions.push({habitId:m.id,date:c.today(),seconds:59}));assert.equal(M.weekly(c.read(),m,c.today()).done,false);c.run('goal.record',{id:m.id,minutes:1});assert.equal(M.weekly(c.read(),m,c.today()).done,true);
 assert.throws(()=>c.run('goal.record',{id:m.id,minutes:-2}));
});
test('休息日停提醒但保留完成记录与累计成果',()=>{
 const d=c.today(),time=new Date().toTimeString().slice(0,5),h=make({time}),ch=c.run('checkin.save',{title:'喝水',times:[time]});c.run('record.set',{id:h.id,status:'done'});c.run('focus.start',{minutes:1});c.mutate(s=>{s.timer.startedAt=Date.now()-61000;s.alerts.push({id:'rest-alert',date:d});});
 c.run('rest.set',{date:d});assert.deepEqual(c.dueHabits(c.read(),d),[]);assert.deepEqual(c.quickReminders(),[]);assert.deepEqual(c.reminders(),[]);assert.equal(c.focusAlertDue(),null);assert.equal(c.read().alerts.length,0);const review=c.review();const row=review.habits.find(x=>x.id===h.id);assert.equal(row.cells.at(-1).status,'rest');assert.equal(row.standard,1);assert.equal(c.read().records[d][h.id].status,'done');
 c.run('rest.set',{date:d,rest:false});assert(c.dueHabits(c.read(),d).some(x=>x.id===h.id));assert(c.quickReminders().some(x=>x.id===ch.id));c.run('focus.finish',{});
});
test('工作日识别调休和节假日，恢复默认回到内置日历',()=>{
 const s=c.read(),h=make({workdaysOnly:true,skipHolidays:true});assert.equal(M.eligible(s,h,'2026-10-01'),false);assert.equal(M.eligible(s,h,'2026-10-10'),true);c.run('holiday.set',{date:'2026-10-01',kind:'work'});assert.equal(M.isWorkday(c.read(),'2026-10-01'),true);c.run('holiday.set',{date:'2026-10-01',kind:'default'});assert.equal(M.isWorkday(c.read(),'2026-10-01'),false);
});
test('提醒一次操作不会重复打卡，延后提醒与完成取消',()=>{
 const ch=c.run('checkin.save',{title:'站起来',target:3}),d=c.today();c.mutate(s=>s.alerts.push({id:'action',date:d,kind:'checkin',entityId:ch.id}));c.run('alert.act',{id:'action',operation:'complete'});c.run('alert.act',{id:'action',operation:'complete'});assert.equal(c.read().checkinRecords[d][ch.id].count,1);
 c.mutate(s=>s.alerts.push({id:'later',date:d,kind:'checkin',entityId:ch.id}));c.run('alert.act',{id:'later',operation:'snooze'});assert(!c.read().alerts.some(x=>x.id==='later'));c.mutate(s=>s.snoozedAlerts.forEach(x=>x.until=Date.now()-1));assert(c.snoozedAlertDue().some(x=>x.id==='later'));
 c.run('alert.act',{id:'later',operation:'snooze'});c.run('checkin.increment',{id:ch.id});c.run('checkin.increment',{id:ch.id});c.mutate(s=>s.snoozedAlerts.forEach(x=>x.until=Date.now()-1));assert(!c.snoozedAlertDue().some(x=>x.id==='later'));
});
test('学习保存保持版本、冲突保护、汇入日记不重复',()=>{
 const x=c.run('learning.save',{url:'https://example.com/article',title:'文章',body:'理解'});const same=c.run('learning.save',{...x,expected:x.revision});assert.equal(same.revision,x.revision);c.run('learning.toJournal',{id:x.id});c.run('learning.save',{id:x.id,body:'理解',expected:x.revision});c.run('learning.toJournal',{id:x.id});assert.equal(c.read().journals[c.today()].body.match(/来源：https:\/\/example.com\/article/g).length,1);
 const changed=c.run('learning.save',{id:x.id,body:'理解加深',expected:x.revision});assert.notEqual(changed.revision,x.revision);assert.throws(()=>c.run('learning.save',{id:x.id,body:'旧窗口',expected:x.revision}),/其他窗口/);assert.throws(()=>c.run('learning.save',{url:'javascript:alert(1)'}));
});
test('图片验证、本地图文导出和文字同步说明',()=>{
 const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII=',x=c.run('image.import',{base64});assert.equal(c.run('image.import',{base64}).id,x.id);assert.match(c.run('image.read',{id:x.id}).dataURL,/^data:image\/png;base64/);assert.throws(()=>c.run('image.import',{base64:Buffer.from('<svg></svg>').toString('base64')}));assert.throws(()=>c.run('image.read',{id:'../data.json'}));const html=media.html(tmp,'标题','<script>bad</script>'+x.markdown);assert.match(html,/data:image\/png;base64/);assert(!html.includes('<script>'));assert.match(media.cloudText(x.markdown),/保存在一序本地/);
});
test('周表拖动复制、并发防护，以及延期真正进入周表',()=>{
 const d=c.today(),w=M.week(d),e=c.run('plan.entry.save',{date:w,title:'拖动事项',category:'学习'});const id=e.id||c.read().plans[w].entries.at(-1).id;const original=c.read().plans[w].entries.find(x=>x.id===id);c.run('plan.entry.move',{date:w,id,to:M.add(w,1),category:'读书',expected:original.revision});const moved=c.read().plans[w].entries.find(x=>x.id===id);assert.equal(moved.date,M.add(w,1));assert.throws(()=>c.run('plan.entry.move',{date:w,id,to:w,category:'读书',expected:original.revision}),/已修改/);c.run('plan.entry.move',{date:w,id,to:M.add(w,2),category:'备忘',copy:true});assert.equal(c.read().plans[w].entries.filter(x=>x.title==='拖动事项').length,2);assert.throws(()=>c.run('plan.entry.move',{date:w,id,to:M.add(w,7),category:'读书'}),/仅限本周/);
 c.run('plan.task.save',{date:d,title:'反复推迟'});const t=c.read().plans[w].tasks.find(x=>x.title==='反复推迟');c.run('review.taskDecision',{date:d,id:t.id,decision:'reschedule',to:M.add(w,8),category:'学习'});const dest=c.read().plans[M.add(w,7)];assert(dest.entries.some(x=>x.date===M.add(w,8)&&x.category==='学习'&&x.title===t.title));
});
