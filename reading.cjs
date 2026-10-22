const {randomUUID}=require('node:crypto');
const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shift=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return day(x);};
function init(s){
 s.reading||={days:{},sessions:{},legacyImported:false};
 if(!s.reading.legacyImported){
  for(const x of s.sessions||[])if(x.readerId&&x.seconds>0){s.reading.days[x.date]||={};s.reading.days[x.date][x.readerId]=(s.reading.days[x.date][x.readerId]||0)+x.seconds*1000;}
  s.reading.legacyImported=true;
 }
}
function record(s,a){
 init(s);if(!s.library.some(b=>b.id===a.id))throw Error('找不到这本书');
 if(typeof a.sessionId!=='string'||a.sessionId.length>100||!a.sessionId)throw Error('阅读会话无效');
 if(!Number.isFinite(a.from)||!Number.isFinite(a.to)||a.to<a.from||a.to-a.from>60000)throw Error('阅读时间段无效');
 const old=s.reading.sessions[a.sessionId];if(old&&old.bookId!==a.id)throw Error('阅读会话不属于这本书');
 let from=Math.max(a.from,old?.through||a.from);if(from>=a.to)return;
 for(let at=from;at<a.to;){const date=day(new Date(at)),midnight=new Date(at);midnight.setHours(24,0,0,0);const end=Math.min(a.to,midnight.getTime());s.reading.days[date]||={};s.reading.days[date][a.id]=(s.reading.days[date][a.id]||0)+end-at;at=end;}
 s.reading.sessions[a.sessionId]={bookId:a.id,through:a.to};
 // Checkpoints only deduplicate the active process's recent sessions; daily totals are permanent.
 const ids=Object.keys(s.reading.sessions);if(ids.length>2000)for(const id of ids.slice(0,ids.length-1500))delete s.reading.sessions[id];
}
function range(period,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||day(new Date(date+'T12:00:00'))!==date)throw Error('日期无效');
 const d=new Date(date+'T12:00:00');let start=date,end=date;
 if(period==='week'){start=shift(date,-((d.getDay()+6)%7));end=shift(start,6);}
 else if(period==='month'){start=date.slice(0,7)+'-01';end=day(new Date(d.getFullYear(),d.getMonth()+1,0));}
 else if(period==='year'){start=date.slice(0,4)+'-01-01';end=date.slice(0,4)+'-12-31';}
 else if(period!=='day')throw Error('请选择日、周、月或年');return {start,end};
}
function stats(s,a={}){
 init(s);const date=a.date||day(new Date()),period=a.period||'week',{start,end}=range(period,date);
 const sum=(from,to,id=a.id)=>Object.entries(s.reading.days).filter(([d])=>d>=from&&d<=to).reduce((n,[,bs])=>n+(id?(bs[id]||0):Object.values(bs).reduce((x,y)=>x+y,0)),0)/1000;
 const total=sum('0000','9999'),days=[];for(let d=start;d<=end;d=shift(d,1))days.push({date:d,seconds:sum(d,d)});
 const buckets=period==='year'?Array.from({length:12},(_,i)=>{const month=date.slice(0,4)+'-'+String(i+1).padStart(2,'0');return {date:month,seconds:days.filter(x=>x.date.startsWith(month)).reduce((n,x)=>n+x.seconds,0)};}):days;
 const books=s.library.map(b=>({id:b.id,title:b.title,archived:b.archived,seconds:sum(start,end,b.id),total:sum('0000','9999',b.id),notes:b.notes.length})).filter(b=>!a.id||a.id===b.id).sort((a,b)=>b.seconds-a.seconds||b.total-a.total);
 const totals=Object.fromEntries(['day','week','month','year'].map(p=>{const r=range(p,date);return [p,sum(r.start,r.end)];}));
 return {period,date,start,end,total,seconds:sum(start,end),activeDays:days.filter(x=>x.seconds>0).length,days,buckets,books,totals};
}
class ReadingClock{
 constructor(write,now=()=>Date.now(),mono=()=>performance.now()){this.write=write;this.now=now;this.mono=mono;this.active=null;}
 update(bookId){if(this.active?.bookId===bookId)return;this.flush();this.active=bookId?{bookId,sessionId:randomUUID(),at:this.now(),mono:this.mono()}:null;}
 flush(){const x=this.active;if(!x)return;const now=this.now(),mono=this.mono(),elapsed=mono-x.mono,gap=now-x.at;
  if(elapsed>0&&elapsed<=20000&&gap>=0&&Math.abs(gap-elapsed)<2000)this.write({id:x.bookId,sessionId:x.sessionId,from:x.at,to:now});
  x.at=now;x.mono=mono;
 }
}
module.exports={init,record,stats,range,ReadingClock};
