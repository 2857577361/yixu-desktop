const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-test-'));
process.env.YIXU_DATA_DIR=tmp;
process.env.YIXU_CREDENTIALS=path.join(tmp,'credentials.json');
const c=require('../core.cjs');
c.mutate(s=>s.habits.push({id:'test-reading',title:'测试阅读',time:'09:50',minutes:20,days:[0,1,2,3,4,5,6],minimum:'测试最低版',enabled:true},{id:'test-learning',title:'测试学习',time:'',minutes:25,days:[0,1,2,3,4,5,6],enabled:true}));
after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
test('习惯、最低版和日记并发保护',()=>{
 const h=c.run('habit.save',{title:'读书',minutes:10,time:'09:50',days:[1,2,3],url:'https://example.com'});
 c.run('record.set',{id:h.id,status:'minimum'});assert.equal(c.read().records[c.today()][h.id].status,'minimum');
 c.run('journal.save',{body:'第一版',expected:''});
 assert.throws(()=>c.run('journal.save',{body:'过期写入',expected:''}),/其他窗口/);
 assert.equal(c.read().journals[c.today()].body,'第一版');
 assert.throws(()=>c.run('habit.save',{title:'错误',minutes:5,time:'29:00',days:[1]}));
 assert.throws(()=>c.run('habit.save',{title:'危险链接',minutes:5,days:[1],url:'javascript:alert(1)'}));
});
test('暂停时不累计时间，结束只记录一次',()=>{
 c.run('focus.start',{id:'test-reading'});
 c.mutate(s=>{s.timer.startedAt=Date.now()-61000;});
 c.run('focus.pause');const rem=c.remaining(c.read().timer);assert.ok(rem<=19*60000);
 const end=c.run('focus.finish',{complete:true,note:'学会了一点'});assert.ok(end.seconds>=61);assert.equal(c.read().timer,null);
 assert.throws(()=>c.run('focus.finish',{}));assert.equal(c.read().records[c.today()]['test-reading'].status,'done');assert.equal(c.read().records[c.today()]['test-reading'].sourceSessionId,c.read().sessions.at(-1).id);
});
test('提醒按日去重，支持延后，跳过习惯不再提醒',()=>{
 c.mutate(s=>{delete s.records['2026-09-23'];});const d=new Date('2026-09-23T09:50:00');
 const first=c.reminders(d);assert.equal(first.filter(h=>h.id==='test-reading').length,1);
 assert.equal(c.reminders(d).filter(h=>h.id==='test-reading').length,0);
 c.mutate(s=>{s.reminders['2026-09-23:test-reading']={until:new Date('2026-09-23T10:00:00').getTime()};});
 assert.equal(c.reminders(new Date('2026-09-23T09:59:00')).filter(h=>h.id==='test-reading').length,0);
 assert.equal(c.reminders(new Date('2026-09-23T10:00:00')).filter(h=>h.id==='test-reading').length,1);
 c.run('record.set',{id:'test-reading',date:'2026-09-24',status:'skipped'});
 assert.equal(c.reminders(new Date('2026-09-24T09:50:00')).filter(h=>h.id==='test-reading').length,0);
});
test('多个 CLI 进程同时保存便笺不丢数据',async()=>{
 const before=c.read().notes.length;
 await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
  const ch=spawn(process.execPath,[path.join(__dirname,'../cli.cjs'),'note.save',JSON.stringify({body:'并发'+i})],{env:process.env});let err='';ch.stderr.on('data',b=>err+=b);ch.on('close',code=>code?reject(Error(err)):resolve());ch.on('error',reject);
 })));
 assert.equal(c.read().notes.length,before+8);
});
test('语雀同步可重复执行，远端改动时阻止覆盖',async()=>{
 fs.writeFileSync(process.env.YIXU_CREDENTIALS,JSON.stringify({token:'test-only',host:'https://example.com'}));
 c.run('settings.save',{book:'me/test'});
 let remote,creates=0,updates=0;
 const original=global.fetch;
 global.fetch=async(url,opts)=>{
  if(opts.method==='POST'){remote={id:42,...JSON.parse(opts.body)};creates++;}
  if(opts.method==='PUT'){Object.assign(remote,JSON.parse(opts.body));updates++;}
  return {ok:!!remote,status:remote?200:404,json:async()=>({data:remote})};
 };
 try{
  await c.sync();await c.sync();assert.equal(creates,1);assert.equal(updates,0);
  c.run('journal.save',{body:'新内容'});await c.sync();assert.equal(updates,1);
  remote.body+='\n云端手动修改';c.run('journal.save',{body:'本地再改'});
  await assert.rejects(()=>c.sync(),/语雀文档已修改/);assert.equal(updates,1);
 }finally{global.fetch=original;}
});
test('两分钟计时结束保留最低版，并记录跳过原因',()=>{
 c.run('record.set',{id:'test-reading',status:'pending'});
 c.run('focus.start',{id:'test-reading',mode:'minimum'});assert.equal(c.read().timer.minutes,2);
 c.run('focus.finish',{complete:true,note:'解释了一个概念'});assert.equal(c.read().records[c.today()]['test-reading'].status,'minimum');
 c.run('record.set',{id:'test-learning',status:'skipped',reason:'任务太大'});
 assert.ok(c.review().habits.find(h=>h.id==='test-learning').reasons.includes('任务太大'));
});
test('便笺恢复和日记追加不丢旧内容',()=>{
 const n=c.run('note.save',{body:'保留我'});c.run('note.archive',{id:n.id});c.run('note.restore',{id:n.id});assert.equal(c.read().notes.find(x=>x.id===n.id).archived,false);
 c.run('journal.save',{date:'2026-09-01',body:'旧内容'});c.run('journal.append',{date:'2026-09-01',body:'新内容'});assert.equal(c.read().journals['2026-09-01'].body,'旧内容\n\n新内容');
});
test('离线队列跨读取保留，失败最多自动尝试三次',async()=>{
 const orig=global.fetch;global.fetch=async()=>{throw Error('offline');};
 c.run('settings.save',{book:'me/offline',autoSync:true});c.run('journal.save',{date:'2026-09-02',body:'待同步'});
 try{for(let i=0;i<3;i++){c.mutate(s=>{s.pendingSync['me/offline:2026-09-02'].nextAt=0;});await c.flushSync();}
 const q=c.read().pendingSync['me/offline:2026-09-02'];assert.equal(q.attempts,3);assert.equal(q.blocked,true);await c.flushSync();assert.equal(c.read().pendingSync['me/offline:2026-09-02'].attempts,3);
 }finally{global.fetch=orig;}
});
test('同步过程中再次编辑不能错误清除待同步状态',async()=>{
 c.run('settings.save',{book:'me/race',autoSync:false});c.run('journal.save',{date:'2026-09-03',body:'第一版'});
 const orig=global.fetch;let remote;
 global.fetch=async(url,opts)=>{if(opts.method==='POST'){remote={id:77,...JSON.parse(opts.body)};c.run('journal.save',{date:'2026-09-03',body:'同步时的第二版'});}return {ok:!!remote,status:remote?200:404,json:async()=>({data:remote})};};
 try{await c.sync('2026-09-03');assert.ok(c.read().pendingSync['me/race:2026-09-03']);}finally{global.fetch=orig;}
});
