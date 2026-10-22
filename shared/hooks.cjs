/* Hooks live in their source text, so editing, backup and existing sync preserve anchors. */
(function(root){
const Links=typeof module!=='undefined'?require('./record-links.cjs'):root.RecordLinks;
const pattern=()=>/\[([^\]\n]{1,300})\]\(yixu-hook:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}):([01]):(\d{4}-\d{2}-\d{2})\)/gi;
const label=v=>String(v||'').trim().replace(/[\[\]\r\n]/g,' ').slice(0,300);
function mark(x){const title=label(x.title);if(!title)throw Error('请写下待办内容');return `[${title}](yixu-hook:${x.id}:${x.done?1:0}:${x.createdOn})`;}
function parse(body){return [...String(body||'').matchAll(pattern())].map(m=>({id:m[2],title:m[1],done:m[3]==='1',createdOn:m[4],offset:m.index,raw:m[0]}));}
function parts(body,text,hook){body=String(body||'');let out='',at=0;for(const x of parse(body)){out+=text(body.slice(at,x.offset))+hook(x);at=x.offset+x.raw.length;}return out+text(body.slice(at));}
const plain=body=>parts(body,x=>x,x=>(x.done?'☑ ':'☐ ')+x.title);
const dateOf=v=>{if(!v)return '';if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(d):'';};
const get=(s,path)=>path.reduce((x,k)=>x?.[k],s);
function documents(s){const out=[];function add(path,kind,id,date,title,fields,extra={}){const owner=get(s,path);if(!owner)return;for(const field of fields)if(typeof owner[field]==='string'&&owner[field].includes('yixu-hook:'))out.push({source:JSON.stringify([...path,field]),path:[...path,field],kind,id,date:date||'',title:title||'未命名记录',field,body:owner[field],...extra});}
 for(const [d,x]of Object.entries(s.journals||{}))add(['journals',d],'journal',d,d,d+' 日记',['body']);
 for(const [i,x]of (s.notes||[]).entries())add(['notes',i],x.kind==='study'?'study':'note',x.id,dateOf(x.recordDate||x.createdAt||x.updatedAt),x.title||'便笺',['body']);
 for(const [i,x]of (s.learning||[]).entries())add(['learning',i],'learning',x.id,x.createdOn,x.title,['body','summary','reflection']);
 for(const [i,x]of (s.sessions||[]).entries())add(['sessions',i],'focus',x.id,x.date,x.title,['note','nextStep']);
 for(const [d,rs]of Object.entries(s.records||{}))for(const [id,r]of Object.entries(rs)){const linked=Links.find(s,d,id,r);add(['records',d,id],'habit',id,d,s.habits?.find(x=>x.id===id)?.title,['note','reason'].filter(f=>f!=='note'||!linked||linked.note!==r.note));}
 for(const [i,b]of (s.library||[]).entries())for(const [j,n]of (b.notes||[]).entries())add(['library',i,'notes',j],'reading',n.id,dateOf(n.at||n.createdAt),b.title+' · 第 '+n.page+' 页',['body'],{bookId:b.id,page:n.page});
 for(const [i,e]of (s.searchEvents||s.events||[]).entries())if(!e.archived)add([s.searchEvents?'searchEvents':'events',i],'event',e.id,e.date,e.title,['note']);
 for(const [d,p]of Object.entries(s.plans||{})){add(['plans',d],'report',d,d,'本周记录与复盘',['overview','progress','risks','nextWeek','cognition']);for(const name of ['tasks','entries'])for(const [i,x]of (p[name]||[]).entries())if(!x.archived)add(['plans',d,name,i],name==='tasks'?'task':'entry',x.id,x.date||d,x.title,['note'],{week:d});}
 return out;}
// Array indices are transient. The identity used by the UI contains stable record IDs.
const identity=x=>JSON.stringify([x.kind,x.id,['journal','habit','report'].includes(x.kind)?x.date:'',x.bookId||'',x.field]);
function list(s){return documents(s).flatMap(d=>parse(d.body).map(h=>({...h,source:identity(d),kind:d.kind,idOfRecord:d.id,date:d.date,sourceTitle:d.title,field:d.field,bookId:d.bookId,page:d.page,week:d.week}))).sort((a,b)=>Number(a.done)-Number(b.done)||b.createdOn.localeCompare(a.createdOn)||a.source.localeCompare(b.source)||a.offset-b.offset);}
function write(s,d,body){const owner=get(s,d.path.slice(0,-1)),old=d.body,now=new Date().toISOString();owner[d.field]=body;owner.updatedAt=now;if(d.kind==='habit')owner.at=now;else if(!['journal','note','reading'].includes(d.kind))owner.revision=globalThis.crypto.randomUUID();if(d.kind==='habit'&&d.field==='note')Links.update(s,d.date,d.id,owner,body,now);if(d.kind==='focus'&&d.field==='note'){const r=s.records?.[owner.date]?.[owner.habitId];if(r&&(r.sourceSessionId===owner.id||r.note===old&&Math.abs(Date.parse(r.at)-Number(owner.endedAt))<5000)){r.note=body;r.sourceSessionId=owner.id;r.at=now;}}return {changed:true};}
function set(s,a){if(typeof a.done!=='boolean')throw Error('待办状态无效');const d=documents(s).find(x=>identity(x)===a.source);if(!d)throw Error('原记录已移除或待办已删除');const h=parse(d.body).find(x=>x.id===a.id);if(!h)throw Error('待办已在原文中移除');if(h.done===a.done)return {changed:false};return write(s,d,d.body.slice(0,h.offset)+mark({...h,done:a.done})+d.body.slice(h.offset+h.raw.length));}
function update(s,a){const d=documents(s).find(x=>identity(x)===a.source);if(!d)throw Error('原记录已移除');if(d.body!==a.expected)throw Error('原记录已在其他位置修改，请重新打开后再保存');const max=d.field==='reason'?200:d.field==='nextStep'?500:d.kind==='journal'?50000:['focus','habit'].includes(d.kind)?5000:d.kind==='reading'?10000:20000;if(typeof a.body!=='string'||a.body.length>max)throw Error('记录内容过长');return write(s,d,a.body);}

const api={pattern,label,mark,parse,parts,plain,documents,identity,list,set,update};if(typeof module!=='undefined')module.exports=api;else root.Hooks=api;
})(typeof window==='undefined'?globalThis:window);
