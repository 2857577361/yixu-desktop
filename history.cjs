const {randomUUID}=require('node:crypto');
function text(v,max=20000){if(typeof v!=='string'||v.length>max)throw Error('内容格式不正确或过长');return v;}
function run(s,action,a){if(action==='history.delete')return deleteRecord(s,a);if(action==='history.clear')return clearContent(s,a);if(action!=='history.save')throw Error('未知记录操作');if(a.kind==='focus'){const x=s.sessions.find(x=>x.id===a.id);if(!x)throw Error('专注记录不存在');const expected=x.revision||x.updatedAt||String(x.endedAt||'');if(a.expected!==expected)throw Error('记录已修改，草稿已保留');const old=x.note||'',title=text(a.title??x.title,300).trim();if(!title)throw Error('请填写专注标题');x.title=title;x.note=text(a.body,5000);if(a.nextStep!==undefined)x.nextStep=text(a.nextStep,500);x.updatedAt=new Date().toISOString();x.revision=randomUUID();const r=s.records[x.date]?.[x.habitId],latest=s.sessions.filter(v=>v.date===x.date&&v.habitId===x.habitId).sort((a,b)=>(b.endedAt||0)-(a.endedAt||0))[0];if(r&&(r.sourceSessionId===x.id||latest?.id===x.id&&r.note===old)){r.note=x.note;r.sourceSessionId=x.id;r.at=x.updatedAt;}return x;}if(a.kind==='habit'){const x=s.records[a.date]?.[a.id];if(!x)throw Error('习惯记录不存在');if(a.expected!==(x.at||''))throw Error('记录已修改，草稿已保留');const linked=require('./shared/record-links.cjs').find(s,a.date,a.id,x);x.note=text(a.body,5000);x.reason=text(a.reason??x.reason??'',200);x.at=new Date().toISOString();if(linked){x.sourceSessionId=linked.id;require('./shared/record-links.cjs').update(s,a.date,a.id,x,x.note,x.at);}return x;}if(a.kind==='study'||a.kind==='learning'){const list=a.kind==='study'?s.notes:s.learning,x=list.find(x=>x.id===a.id&&(a.kind!=='study'||x.kind==='study'));if(!x)throw Error('记录不存在');if(a.expected!==x.revision)throw Error('记录已修改，草稿已保留');const title=text(a.title??x.title,300).trim();if(!title)throw Error('请填写标题');const body=text(a.body);x.title=title;x.body=body;if(a.kind==='learning'){if(a.summary!==undefined)x.summary=text(a.summary);if(a.reflection!==undefined)x.reflection=text(a.reflection);}x.updatedAt=new Date().toISOString();x.revision=randomUUID();return x;}if(a.kind==='reading'){const b=s.library.find(b=>b.id===a.bookId),x=b?.notes.find(n=>n.id===a.id);if(!x)throw Error('读书笔记不存在');if(a.expected!==(x.updatedAt||x.at))throw Error('读书笔记已修改，草稿已保留');x.body=text(a.body,10000).trim();x.updatedAt=new Date().toISOString();return x;}if(a.kind==='note'){const x=s.notes.find(x=>x.id===a.id&&x.kind!=='study');if(!x)throw Error('随手记录不存在');if(a.expected!==x.updatedAt)throw Error('记录已修改，草稿已保留');const title=text(a.title??x.title??'',300).trim();x.title=title;x.body=text(a.body,10000);x.updatedAt=new Date().toISOString();return x;}throw Error('请选择记录类型');}
module.exports={run};

function clearContent(s,a){
 if(!['focus','habit'].includes(a.kind))throw Error('请选择专注或习惯记录');
 const x=a.kind==='focus'?s.sessions.find(v=>v.id===a.id):s.records[a.date]?.[a.id];
 if(!x)throw Error('记录不存在');
 const expected=a.kind==='focus'?(x.revision||x.updatedAt||String(x.endedAt||'')):(x.at||'');
 if(a.expected!==expected)throw Error('记录已修改，请刷新后再删除内容');
 const date=a.kind==='focus'?x.date:a.date,id=a.kind==='focus'?x.habitId:a.id,r=s.records[date]?.[id],old=x.note||'',now=new Date().toISOString();
 const linked=a.kind==='focus'?x:require('./shared/record-links.cjs').find(s,date,id,r);
 const matches=r&&linked&&require('./shared/record-links.cjs').find(s,date,id,r)?.id===linked.id;
 if(a.kind==='habit'||matches){r.note='';r.reason='';r.at=now;if(matches)r.sourceSessionId=linked.id;}
 if(a.kind==='focus'||matches){linked.note='';linked.updatedAt=now;linked.revision=randomUUID();}
 return {cleared:true};
}

function deleteRecord(s,a){
 let x,expected;
 if(a.kind==='focus'){x=s.sessions.find(v=>v.id===a.id);expected=x&&(x.revision||x.updatedAt||String(x.endedAt||''));}
 else if(a.kind==='habit'){x=s.records[a.date]?.[a.id];expected=x?.at||'';}
 else if(a.kind==='journal'){x=s.journals[a.date];expected=x?.updatedAt||'';}
 else if(a.kind==='reading'){x=s.library.find(b=>b.id===a.bookId)?.notes.find(n=>n.id===a.id);expected=x?.updatedAt||x?.at;}
 else if(['note','study','learning'].includes(a.kind)){x=(a.kind==='learning'?s.learning:s.notes).find(v=>v.id===a.id);expected=a.kind==='note'?x?.updatedAt:x?.revision;}
 else throw Error('该类型不支持删除记录');
 if(!x)throw Error('记录不存在');if(a.expected!==expected)throw Error('记录已修改，请刷新后再删除');
 if(a.kind==='focus'||a.kind==='habit'){
  const d=a.kind==='focus'?x.date:a.date,id=a.kind==='focus'?x.habitId:a.id,r=s.records[d]?.[id];
  const linked=a.kind==='focus'?x:require('./shared/record-links.cjs').find(s,d,id,r);
  const paired=r&&linked&&require('./shared/record-links.cjs').find(s,d,id,r)?.id===linked.id;
  if(a.kind==='habit'||paired)delete s.records[d][id];
  if(a.kind==='focus'||paired)s.sessions=s.sessions.filter(v=>v.id!==linked.id);
 }else if(a.kind==='journal')delete s.journals[a.date];
 else if(a.kind==='reading'){const b=s.library.find(b=>b.id===a.bookId);b.notes=b.notes.filter(n=>n.id!==a.id);}
 else if(a.kind==='learning')s.learning=s.learning.filter(v=>v.id!==a.id);
 else s.notes=s.notes.filter(v=>v.id!==a.id);
 return {deleted:true};
}
