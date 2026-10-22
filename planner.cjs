const Recurrence=require('./ui/recurrence.js');
const {randomUUID}=require('node:crypto');
const categories=['运动','学习','读书','生活','工作'];
const colors=['sage','blue','sand','rose','lilac'];
const weeklyCategories=['工作','学习','读书','运动','备忘'];
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('日期格式应为 YYYY-MM-DD');return v;}
function addDays(date,n){const d=new Date(validDate(date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function weekStart(date){const d=new Date(validDate(date)+'T12:00:00Z');return addDays(date,-((d.getUTCDay()+6)%7));}
function plain(v,max=20000){if(typeof v!=='string'||v.length>max)throw Error('文字格式不正确或过长');return v;}
function defaultPlan(date){return {week:weekStart(date),reporter:'',overview:'',progress:'',risks:'',nextWeek:'',cognition:'',tasks:[],entries:[],revision:''};}
function ensure(s,date){const w=weekStart(date);return s.plans[w]||=defaultPlan(w);}
function bump(plan){plan.revision=randomUUID();}
function taskProgress(p,t){
 const target=Number.isInteger(t.target)?t.target:1,entries=(p.entries||[]).filter(e=>!e.archived&&(e.sourceTaskId===t.id||e.planTaskId===t.id));
 const scheduledDone=entries.filter(e=>e.status==='done').length,manualCount=Number.isInteger(t.manualCount)?t.manualCount:(t.status==='done'?Math.max(0,target-scheduledDone):0);
 return {target,scheduled:entries.length,scheduledDone,manualCount,completed:scheduledDone+manualCount};
}
function reconcile(s){for(const p of Object.values(s.plans||{})){for(const t of p.tasks||[]){const x=taskProgress(p,t);if(t.completed!==undefined&&(t.completed!==x.completed||t.scheduled!==x.scheduled||t.scheduledDone!==x.scheduledDone))t.revision=randomUUID();t.target=x.target;t.manualCount=x.manualCount;t.completed=x.completed;t.scheduled=x.scheduled;t.scheduledDone=x.scheduledDone;t.status=x.completed>=x.target?'done':t.blocked?'blocked':(t.status==='blocked'?'blocked':'pending');}}}
function run(s,action,a){
 reconcile(s);
 if(action==='plan.unify'){
  if(s.plansUnified)return {merged:false};
  s.plans||={};s.lifePlans||={};
  const category=c=>weeklyCategories.includes(c)?c:'备忘';
  for(const [week,life] of Object.entries(s.lifePlans)){
   const work=s.plans[week]||=defaultPlan(week);
   work.tasks||=[];work.entries||=[];
   const ids=new Set(work.tasks.map(t=>t.id)),remap=new Map();
   for(const task of life.tasks||[]){const copy=structuredClone(task);if(ids.has(copy.id)){const id=randomUUID();remap.set(copy.id,id);copy.id=id;}ids.add(copy.id);work.tasks.push(copy);}
   const entryIds=new Set(work.entries.map(e=>e.id));
   for(const entry of life.entries||[]){const copy=structuredClone(entry);if(entryIds.has(copy.id))copy.id=randomUUID();entryIds.add(copy.id);copy.category=category(copy.category);if(copy.category!==entry.category)copy.originalCategory=entry.category;if(remap.has(copy.sourceTaskId))copy.sourceTaskId=remap.get(copy.sourceTaskId);if(remap.has(copy.planTaskId))copy.planTaskId=remap.get(copy.planTaskId);work.entries.push(copy);}
   for(const key of ['overview','progress','risks','nextWeek','cognition'])if(life[key]?.trim()&&life[key]!==work[key])work[key]=work[key]?work[key]+'\n\n生活计划旧记录：\n'+life[key]:life[key];
   bump(work);
  }
  for(const work of Object.values(s.plans)){for(const entry of work.entries||[]){const old=entry.category;entry.category=category(old);if(old!==entry.category)entry.originalCategory=old;}work.categories=[...weeklyCategories];bump(work);}
  s.plansUnified=true;return {merged:true};
 }
 if(action==='event.delete'||action==='event.series.delete'){
  const id=a.id;
  if(action==='event.series.delete'){
   if(!s.events.some(e=>e.id===id&&e.recurrence))throw Error('找不到循环事项');
   s.events=s.events.filter(e=>e.id!==id&&e.seriesId!==id);return {deleted:true};
  }
  if(typeof id!=='string')throw Error('请选择事项');
  if(id.includes('@')&&!s.events.some(e=>e.id===id)){
   const date=id.split('@')[1];validDate(date);
   const item=Recurrence.expand(s.events,date,date,s).find(e=>e.id===id);
   if(!item)throw Error('这一天没有该事项');
   s.events.push({...item,archived:true,revision:randomUUID()});
   return {deleted:true};
  }
  const i=s.events.findIndex(e=>e.id===id);if(i<0)throw Error('找不到事项');
  if(s.events[i].seriesId){s.events[i].archived=true;s.events[i].revision=randomUUID();}
  else s.events.splice(i,1);
  return {deleted:true};
 }
 if(action==='event.series.stop'){const e=s.events.find(x=>x.id===a.id&&x.recurrence);if(!e)throw Error('循环事项不存在');const end=validDate(a.date);e.recurrence.until=addDays(end,-1);e.revision=randomUUID();return e;}
 if(action.startsWith('event.')&&a.id?.includes('@')&&!s.events.some(e=>e.id===a.id)){const date=a.id.split('@')[1];validDate(date);const item=Recurrence.expand(s.events,date,date,s).find(e=>e.id===a.id);if(!item)throw Error('这一天没有该循环事项');s.events.push(item);}

 if(a.scope!==undefined&&!['work','life'].includes(a.scope))throw Error('计划类型不正确');if(a.scope==='life'){s={...s,plans:s.lifePlans||={}};}
 if(action==='plan.get'){const w=weekStart(a.date);return {...(s.plans[w]||defaultPlan(w)),categories:s.plansUnified&&a.scope!=='life'?weeklyCategories:s.plans[w]?.categories||(a.scope==='life'?['运动','备忘','学习','读书','习惯']:['工作','学习','备忘']),dates:Array.from({length:7},(_,i)=>addDays(w,i)),events:(s.plans[w]?.entries||[]).filter(e=>!e.archived)};}
 if(action==='calendar.list'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(a.month||''))throw Error('月份格式应为 YYYY-MM');return Recurrence.expand(s.events,a.month+'-01',addDays(a.month+'-01',31),s).filter(e=>!e.archived&&e.date.startsWith(a.month));}
 if(action==='plan.carry'){const source=ensure(s,a.date),dest=ensure(s,addDays(source.week,7));let added=0;for(const t of source.tasks.filter(t=>t.status!=='done')){if(dest.tasks.some(x=>x.carriedFrom===t.id))continue;dest.tasks.push({...t,id:randomUUID(),status:'pending',blocked:false,manualCount:0,completed:0,scheduled:0,scheduledDone:0,target:Math.max(1,t.target-t.completed),carriedFrom:t.id,revision:randomUUID()});added++;}if(added)bump(dest);return {week:dest.week,added};}
 if(action==='plan.category.add'){if(s.plansUnified&&a.scope!=='life')throw Error('周计划只保留工作、学习、读书、运动、备忘五类');const p=ensure(s,a.date),name=plain(a.name,30).trim();if(!name)throw Error('分类名称不能为空');p.categories||=(a.scope==='life'?['运动','备忘','学习','读书','习惯']:['工作','学习','备忘']);if(!p.categories.includes(name))p.categories.push(name);bump(p);return p;}
 if(action==='plan.pick'){const p=ensure(s,a.date),task=p.tasks.find(t=>t.id===a.taskId);if(!task)throw Error('找不到这个整体任务');const day=validDate(a.day);if(weekStart(day)!==p.week)throw Error('请选择本周日期');p.entries||=[];const category=plain(a.category,30).trim();if(!category)throw Error('请选择分类');if(s.plansUnified&&a.scope!=='life'&&!weeklyCategories.includes(category))throw Error('请选择五类周计划分类');const old=p.entries.find(e=>!e.archived&&(e.sourceTaskId===task.id||e.planTaskId===task.id)&&(task.target===1||(e.date===day&&e.category===category&&!a.repeat)));if(old)return old;const e={id:randomUUID(),date:day,title:task.title,category,color:a.scope==='life'?'sage':'blue',status:'pending',note:task.note||'',time:'',sourceTaskId:task.id,revision:randomUUID(),archived:false};if(task.target===1&&task.manualCount>0){e.status='done';task.manualCount=0;}p.entries.push(e);bump(p);reconcile(s);return e;}
 if(action==='plan.save'){const p=ensure(s,a.date);if(a.expected!==undefined&&a.expected!==p.revision)throw Error('周报已在其他窗口修改，请重新打开后合并');for(const k of ['reporter','overview','progress','risks','nextWeek','cognition'])if(a[k]!==undefined)p[k]=plain(a[k]);bump(p);return p;}
 if(action==='plan.task.record'){const p=ensure(s,a.date),t=p.tasks.find(t=>t.id===a.id);if(!t)throw Error('计划任务不存在');if(a.expected!==undefined&&a.expected!==t.revision)throw Error('任务已被修改，请重新打开');if(![1,-1].includes(a.delta))throw Error('每次只增减一次');if(a.delta===1&&t.completed>=t.target)return t;t.manualCount=Math.max(0,t.manualCount+a.delta);t.revision=randomUUID();bump(p);reconcile(s);return t;}
 if(action==='plan.task.save'){
  const p=ensure(s,a.date);let t=a.id?p.tasks.find(t=>t.id===a.id):null;
  if(a.id&&!t)throw Error('计划任务不存在');
  if(t&&a.expected!==undefined&&a.expected!==(t.revision||''))throw Error('任务已被修改，请重新打开');
  if(a.target!==undefined&&(!Number.isInteger(a.target)||a.target<1||a.target>100))throw Error('每周次数应为 1—100');
  if(!t){t={id:randomUUID(),status:'pending',note:'',target:1,manualCount:0};p.tasks.push(t);}
  if(a.title!==undefined){t.title=plain(a.title,400).trim();if(!t.title)throw Error('请填写任务内容');for(const e of p.entries||[])if(e.sourceTaskId===t.id||e.planTaskId===t.id){e.title=t.title;e.revision=randomUUID();}}
  if(!t.title)throw Error('请填写任务内容');if(a.target!==undefined)t.target=a.target;
  if(a.status!==undefined){
   if(!['pending','done','blocked'].includes(a.status))throw Error('任务状态不正确');
   t.blocked=a.status==='blocked';t.status=a.status;
   const linked=(p.entries||[]).filter(e=>!e.archived&&(e.sourceTaskId===t.id||e.planTaskId===t.id));
   if(t.target===1&&linked.length===1&&a.status!=='blocked'){linked[0].status=a.status;linked[0].revision=randomUUID();t.manualCount=0;}
   else if(a.status==='done')t.manualCount=Math.max(0,t.target-linked.filter(e=>e.status==='done').length);
   else if(a.status==='pending')t.manualCount=0;
  }
  if(a.references!==undefined){if(!Array.isArray(a.references)||a.references.length>20)throw Error('最多引用 20 条内容');const seen=new Set();t.references=a.references.map(r=>{if(!r||!['study','note','learning'].includes(r.kind)||typeof r.id!=='string')throw Error('引用格式不正确');const items=r.kind==='learning'?s.learning:s.notes;const target=(items||[]).find(x=>x.id===r.id&&(r.kind==='learning'||(r.kind==='study'?x.kind==='study':x.kind!=='study')));if(!target&&!(t.references||[]).some(x=>x.kind===r.kind&&x.id===r.id))throw Error('引用内容不存在');const key=r.kind+':'+r.id;if(seen.has(key))throw Error('请勿重复引用');seen.add(key);return {kind:r.kind,id:r.id};});}
  if(a.note!==undefined)t.note=plain(a.note,2000);t.revision=randomUUID();bump(p);reconcile(s);return t;
 }
 if(action==='plan.task.delete'){const p=ensure(s,a.date),i=p.tasks.findIndex(t=>t.id===a.id);if(i<0)throw Error('计划任务不存在');if(a.expected!==undefined&&a.expected!==p.tasks[i].revision)throw Error('任务已被修改，请重新打开');p.tasks.splice(i,1);for(const e of p.entries||[]){if(e.sourceTaskId===a.id)delete e.sourceTaskId;if(e.planTaskId===a.id)delete e.planTaskId;}bump(p);return {deleted:true};}
 if(action==='plan.entry.delete'){const p=ensure(s,a.date),i=(p.entries||[]).findIndex(e=>e.id===a.id);if(i<0)throw Error('事项不存在');if(a.expected!==undefined&&a.expected!==p.entries[i].revision)throw Error('事项已被修改，请重新打开');p.entries.splice(i,1);bump(p);reconcile(s);return {deleted:true};}
 if(action==='event.save'||action==='plan.entry.save'){const work=action==='plan.entry.save';const owner=work?ensure(s,a.week||a.date):null;const list=work?(owner.entries||=[]):s.events;let e=a.id?list.find(x=>x.id===a.id):null;if(a.id&&!e)throw Error('事项不存在');if(e&&a.expected!==undefined&&a.expected!==e.revision)throw Error('事项已在其他窗口修改，请重新打开');const autoColor=work?'blue':(s.settings?.calendarOptions?.find(x=>x.title===a.title)?.color||s.events.find(x=>x.title===a.title)?.color||colors.find(c=>!s.events.some(x=>!x.archived&&x.date===a.date&&x.color===c))||colors[(s.events.filter(x=>!x.archived&&x.date===a.date).length)%colors.length]);const n={...(e||{id:randomUUID(),status:'pending',note:'',color:autoColor,category:'生活',time:'',archived:false}),...a};n.date=validDate(n.date);if(!work&&a.recurrence!==undefined)n.recurrence=Recurrence.normalize(n.recurrence,n.date);n.title=plain(n.title,300).trim();if(!n.title)throw Error('请填写事项名称');n.category=plain(n.category,30).trim();if(!n.category)throw Error('请填写分类');if(work&&s.plansUnified&&a.scope!=='life'&&!weeklyCategories.includes(n.category))throw Error('请选择五类周计划分类');if(!colors.includes(n.color))throw Error('颜色不正确');if(!['pending','done','blocked','skipped'].includes(n.status))throw Error('事项状态不正确');if(n.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(n.time))throw Error('时间格式应为 HH:mm');n.note=plain(n.note,3000);if(!work&&n.planTaskId)throw Error('月历事项不能关联工作计划');if(work&&weekStart(n.date)!==owner.week)throw Error('每日安排必须在本周内');if(n.planTaskId&&!s.plans[weekStart(n.date)]?.tasks.some(t=>t.id===n.planTaskId))throw Error('关联任务必须属于事项所在周；跨周移动时请重新选择任务');delete n.expected;n.revision=randomUUID();if(e)Object.assign(e,n);else list.push(n);if(owner){bump(owner);reconcile(s);}return n;}
 if(['event.archive','event.restore','plan.entry.archive'].includes(action)){const owner=action.startsWith('plan.')?ensure(s,a.date):null;const e=(owner?(owner.entries||[]):s.events).find(x=>x.id===a.id);if(!e)throw Error('事项不存在');e.archived=action!=='event.restore';e.revision=randomUUID();if(owner){bump(owner);reconcile(s);}return e;}
 throw Error('未知计划操作');
}
function md(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\|/g,'&#124;').replace(/\r?\n/g,'<br>');}
function weeklyMarkdown(s,date,scope='work'){const p=run(s,'plan.get',{date,scope}),items=p.events;const rows=[...new Set([...p.categories,...items.map(e=>e.category)])];
 const lines=[`# 周计划与复盘 · ${p.week} — ${addDays(p.week,6)}`,`记录标识：yixu:${s.instance}:${scope==='life'?'life-week':'week'}:${p.week}`,'',`汇报人：${p.reporter}`,`日期：${p.week} — ${addDays(p.week,6)}`,'','## 本周计划','| 分类 | '+p.dates.map((d,i)=>'周'+('一二三四五六日'[i])+' '+d.slice(5)).join(' | ')+' |','| --- | '+p.dates.map(()=>'---').join(' | ')+' |'];
 for(const c of rows)lines.push('| '+md(c)+' | '+p.dates.map(d=>items.filter(e=>e.date===d&&e.category===c).map(e=>`${{done:'✓',blocked:'❌',skipped:'❌',pending:'□'}[e.status]} ${e.time?e.time+' ':''}${md(e.title)}${e.planTaskId?'（计划 '+(p.tasks.findIndex(t=>t.id===e.planTaskId)+1)+'）':''}${e.note?'<br>原因/记录：'+md(e.note):''}`).join('<br><br>')).join(' | ')+' |');
 lines.push('','## 整体计划',p.overview||'');p.tasks.forEach((t,i)=>lines.push(`${i+1}. ${t.title}（${t.completed}/${t.target} 次） ${{done:'✓',blocked:'❌',pending:'□'}[t.status]}${t.note?'\n   '+t.note:''}`));
 lines.push('','## 本周重点','### 1. 任务进展',p.progress||'','### 2. 风险同步',p.risks||'','## 下周计划',p.nextWeek||'','## 认知迭代',p.cognition||'');return lines.join('\n');}
module.exports={reconcile,taskProgress,run,weekStart,addDays,weeklyMarkdown,categories,colors};
