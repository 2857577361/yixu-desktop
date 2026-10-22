/* One record index powers history, review and global search. Local reading stays local. */
(function(root){
const Links=typeof module!=='undefined'?require('./record-links.cjs'):root.RecordLinks;
const add=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),week=d=>add(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));
const dateOf=v=>{if(!v)return '';const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(d):'';};
const labels={focus:'专注',habit:'习惯记录',habitDefinition:'习惯',note:'随手一句 / 便笺',study:'我的笔记',learning:'稍后学习',reading:'读书笔记',journal:'日记',event:'生活日程',task:'周计划',milestone:'重要日子',book:'书籍'};
const positive=r=>['done','minimum'].includes(r?.status)||Number(r?.minimumCount)>0;
function index(s){const out=[],push=x=>{x.key=x.kind+':'+(x.date||'')+':'+x.id;out.push(x);};
for(const x of s.sessions||[])push({kind:'focus',id:x.id,date:x.date,title:x.title,body:x.note||'',seconds:x.seconds||0,nextStep:x.nextStep||'',expected:x.revision||x.updatedAt||String(x.endedAt||'')});
for(const [date,rs] of Object.entries(s.records||{}))for(const [id,x]of Object.entries(rs))push({kind:'habit',id,date,title:s.habits?.find(h=>h.id===id)?.title||'习惯记录',body:x.note||'',reason:x.reason||'',status:x.status,expected:x.at||''});
for(const x of s.habits||[])push({kind:'habitDefinition',id:x.id,date:x.createdOn||dateOf(x.createdAt)||'',title:x.title,body:[x.minimum,x.cue,x.afterAction,x.identity].filter(Boolean).join(' · ')});
for(const [date,x]of Object.entries(s.journals||{}))push({kind:'journal',id:date,date,title:date+' 日记',body:x.body||'',expected:x.updatedAt});
for(const x of s.notes||[])push({kind:x.kind==='study'?'study':'note',id:x.id,date:x.recordDate||dateOf(x.createdAt||x.updatedAt),title:x.title||'随手一句 / 便笺',body:x.body||'',tags:x.tags||'',archived:x.archived,expected:x.kind==='study'?x.revision:x.updatedAt});
for(const x of s.learning||[])push({kind:'learning',id:x.id,date:x.createdOn||dateOf(x.createdAt||x.updatedAt),title:x.title,body:x.body||'',summary:x.summary||'',reflection:x.reflection||'',url:x.url||'',expected:x.revision});
for(const b of s.library||[]){push({kind:'book',id:b.id,date:dateOf(b.createdAt||b.importedAt||b.addedAt),title:b.title,body:'书籍 · '+(b.page||1)+' 页'});for(const n of b.notes||[])push({kind:'reading',id:n.id,bookId:b.id,date:dateOf(n.at||n.createdAt),title:b.title+' · 第 '+n.page+' 页',body:n.body||'',quote:n.quote||'',noteType:n.type,expected:n.updatedAt||n.at});}
for(const e of s.searchEvents||s.events||[])if(!e.archived)push({kind:'event',id:e.id,date:e.date,title:e.title,body:e.note||'',status:e.status});
for(const [date,p]of Object.entries(s.plans||{}))for(const t of p.tasks||[])if(!t.archived)push({kind:'task',id:t.id,date,title:t.title,body:t.note||'',status:t.status});
for(const m of s.milestones||[])push({kind:'milestone',id:m.id,date:m.date,title:m.title||m.name,body:[m.note,m.kind,m.calendar].filter(Boolean).join(' · ')});
return out.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.key.localeCompare(b.key));}
function search(items,q='',type='all',date=''){const term=q.trim().normalize('NFKC').toLowerCase();return items.filter(x=>(type==='all'||x.kind===type)&&(!date||x.date===date)&&[x.date,x.title,x.body,x.reason,x.nextStep,x.summary,x.reflection,x.quote,x.tags,x.url].filter(Boolean).join(' ').normalize('NFKC').toLowerCase().includes(term));}
function range(period,end){if(period==='months'){const d=new Date(end+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-11,1);return {start:d.toISOString().slice(0,10),end,grain:'month'};}return {start:add(end,period==='weeks'?-27:-6),end,grain:period==='weeks'?'week':'day'};}
function activeDates(s){return [...new Set([...Object.keys(s.records||{}).filter(d=>Object.keys(s.records[d]).length),...(s.sessions||[]).map(x=>x.date),...Object.keys(s.journals||{}),...Object.keys(s.checkinRecords||{}).filter(d=>Object.values(s.checkinRecords[d]).some(x=>x.count>0)),...Object.keys(s.reading?.days||{}).filter(d=>Object.values(s.reading.days[d]).some(x=>x>0)),...(s.notes||[]).map(x=>x.recordDate||dateOf(x.createdAt||x.updatedAt)),...(s.learning||[]).map(x=>x.createdOn||dateOf(x.createdAt||x.updatedAt)),...(s.library||[]).flatMap(b=>(b.notes||[]).map(x=>dateOf(x.at||x.createdAt)))])].filter(Boolean).sort();}
function checkinTarget(s,id,r){return Math.max(1,Number(r.target||s.checkins?.find(x=>x.id===id)?.target||1));}
function checkinDone(s,id,r){return (r.count||0)>=checkinTarget(s,id,r);}
function totals(s,start,end){let completed=0,checkins=0,focus=0,reading=0,journals=0;for(const [d,rs]of Object.entries(s.records||{}))if(d>=start&&d<=end)completed+=Object.values(rs).filter(positive).length;for(const x of s.sessions||[])if(x.date>=start&&x.date<=end)focus+=x.seconds||0;for(const [d,bs]of Object.entries(s.reading?.days||{}))if(d>=start&&d<=end)reading+=Object.values(bs).reduce((n,x)=>n+x,0)/1000;for(const d of Object.keys(s.journals||{}))if(d>=start&&d<=end&&s.journals[d].body?.trim())journals++;for(const [d,rs]of Object.entries(s.checkinRecords||{}))if(d>=start&&d<=end)checkins+=Object.entries(rs).filter(([id,x])=>checkinDone(s,id,x)).length;return {completed,focus:Math.round(focus/60),reading:Math.round(reading/60),journals,checkins,activeDays:activeDates(s).filter(d=>d>=start&&d<=end).length};}
function review(s,period='days',end=s.today){const r=range(period,end),length=Math.round((Date.parse(end)-Date.parse(r.start))/86400000)+1,prevEnd=period==='months'?(()=>{const d=new Date(end+'T12:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10);})():add(r.start,-1),prevStart=period==='months'?(()=>{const d=new Date(r.start+'T12:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10);})():add(r.start,-length),active=activeDates(s),first=active[0],comparable=!!first&&first<=prevStart;const buckets=new Map();for(let d=r.start;d<=end;d=add(d,1)){const key=r.grain==='month'?d.slice(0,7):r.grain==='week'?week(d):d;if(!buckets.has(key))buckets.set(key,{date:key,start:d,end:d});buckets.get(key).end=d;}
const prevBuckets=new Map();for(let d=prevStart;d<=prevEnd;d=add(d,1)){const key=r.grain==='month'?d.slice(0,7):r.grain==='week'?week(d):d;if(!prevBuckets.has(key))prevBuckets.set(key,{start:d,end:d});prevBuckets.get(key).end=d;}const previous=[...prevBuckets.values()];const chart=[...buckets.values()].map((b,i)=>({...b,...totals(s,b.start,b.end),previous:comparable?totals(s,previous[i]?.start||prevStart,previous[i]?.end||prevEnd).focus:null}));let continuousWeeks=0,w=week(end);const ws=new Set(active.map(week));if(!ws.has(w))w=add(w,-7);while(ws.has(w)){continuousWeeks++;w=add(w,-7);}return {...r,prevStart,prevEnd,comparable,current:totals(s,r.start,end),previous:totals(s,prevStart,prevEnd),chart,continuousWeeks};}

const historyKinds=new Set(['focus','habit','note','study','learning','reading','journal']);
function displayIndex(s){
 const rows=index(s).filter(x=>x.kind!=='journal'||(x.body||'').trim()),hidden=new Set();
 for(const h of rows.filter(x=>x.kind==='habit')){
  const record=s.records?.[h.date]?.[h.id];
  const session=Links.find(s,h.date,h.id,record);
  const focus=session&&rows.find(x=>x.kind==='focus'&&x.id===session.id);
  if(focus){focus.body=h.body||focus.body;focus.reason=h.reason;focus.habitStatus=h.status;hidden.add(h.key);}
 }
 return rows.filter(x=>!hidden.has(x.key));
}
function historyIndex(s){return displayIndex(s).filter(x=>historyKinds.has(x.kind));}
const api={checkinTarget,checkinDone,displayIndex,historyIndex,historyKinds,add,week,dateOf,index,search,labels,positive,range,totals,review,activeDates};if(typeof module!=='undefined')module.exports=api;else root.Insights=api;
})(typeof window==='undefined'?globalThis:window);
