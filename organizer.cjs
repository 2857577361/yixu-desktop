const {randomUUID}=require('node:crypto');
const palette=['sage','blue','sand','rose','lilac'];
const text=(v,n=20000)=>{if(typeof v!=='string'||v.length>n)throw Error('文字格式不正确或内容过长');return v;};
function run(s,action,a,today){
 if(action.startsWith('calendar.option.')){s.settings.calendarOptions||=[];const items=s.settings.calendarOptions;
  if(action==='calendar.option.delete'){const i=items.findIndex(x=>x.id===a.id);if(i<0)throw Error('选项不存在');items.splice(i,1);return {deleted:true};}
  if(action==='calendar.option.save'){let x=a.id?items.find(x=>x.id===a.id):null;if(a.id&&!x)throw Error('选项不存在');const title=text(a.title,300).trim();if(!title)throw Error('请填写选项名称');if(items.some(v=>v.id!==a.id&&v.title===title))throw Error('这个选项已经存在');const color=a.color||palette[items.length%palette.length];if(!palette.includes(color))throw Error('颜色不正确');if(!x){x={id:randomUUID()};items.push(x);}Object.assign(x,{title,color});return x;}
 }
 if(action.startsWith('study.')){s.notes||=[];let x=a.id?s.notes.find(n=>n.id===a.id&&n.kind==='study'):null;if(a.id&&!x)throw Error('笔记不存在');if(x&&a.expected!==undefined&&a.expected!==x.revision)throw Error('笔记已在其他窗口修改，草稿已保留');
 if(action==='study.save'){const body=text(a.body??x?.body??''),title=text(a.title??x?.title??'',300).trim()||body.replace(/!\[[^\]]*\]\([^)]*\)/g,'').trim().split('\n')[0].slice(0,80)||'图片笔记';if(!body.trim()&&!a.title?.trim())throw Error('写一点内容或添加图片再保存');if(!x){x={id:randomUUID(),kind:'study',color:'sage',createdAt:new Date().toISOString(),reviewCount:0,nextReview:today()};s.notes.unshift(x);}Object.assign(x,{title,body,tags:text(a.tags??x.tags??'',200),archived:false,revision:randomUUID(),updatedAt:new Date().toISOString()});return x;}
 if(!x)throw Error('请选择笔记');
 if(action==='study.archive'||action==='study.restore'){x.archived=action==='study.archive';x.revision=randomUUID();return x;}
 if(action==='study.review'){if(!['again','known'].includes(a.mode))throw Error('复习状态不正确');x.reviewCount=(x.reviewCount||0)+1;x.reviewLevel=a.mode==='again'?0:Math.min(5,(x.reviewLevel||0)+1);const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+[1,3,7,14,30,60][x.reviewLevel]);x.lastReview=today();x.nextReview=d.toISOString().slice(0,10);x.revision=randomUUID();return x;}
 if(action==='study.toJournal'){const date=today(),old=s.journals[date]||{},marker=`<!-- study:${x.id}:${x.revision} -->`;if(!(old.body||'').includes(marker))s.journals[date]={...old,body:(old.body||'')+`\n\n## ${x.title}\n${x.body}\n${marker}`,updatedAt:new Date().toISOString()};return {date};}
 }
 throw Error('未知记录操作');
}
module.exports={run,palette};
