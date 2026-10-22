const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
function book(s,id){const b=s.library.find(b=>b.id===id);if(!b)throw Error('找不到这本书');return b;}
function integer(v,min,max){if(!Number.isInteger(v)||v<min||v>max)throw Error('页码或进度不正确');return v;}
function string(v,max){if(typeof v!=='string'||v.length>max)throw Error('文字格式不正确或过长');return v;}
function filePath(dir,b){if(!/^[a-f0-9]{64}$/.test(b.hash)||!['pdf','txt','md','epub'].includes(b.format))throw Error('书籍索引损坏');return path.join(dir,'library',b.hash+'.'+b.format);}
function content(s,dir,id){const b=book(s,id);let data;try{data=fs.readFileSync(filePath(dir,b));}catch{throw Error('本地书籍文件缺失，请重新导入原文件');}if(b.format==='epub')return require('./epub.cjs').unpack(data);return b.format==='pdf'?{format:b.format,bytes:new Uint8Array(data)}:{format:b.format,text:new TextDecoder('utf-8',{fatal:true}).decode(data)};}
function markdown(b){return '# '+b.title+' · 阅读笔记\n\n'+b.notes.map(n=>`## 第 ${n.page} 页\n${n.quote?'> '+n.quote.replace(/\n/g,'\n> ')+'\n\n':''}${n.body||''}`).join('\n\n');}
function run(s,dir,action,a,today){s.library||=[];
 if(action==='reader.list')return s.library;
 if(action==='reader.export')return {markdown:require('./shared/hooks.cjs').plain(markdown(book(s,a.id)))};
 if(action==='reader.import'){
  if(typeof a.path!=='string'||!path.isAbsolute(a.path))throw Error('请选择本地文件');const format=path.extname(a.path).slice(1).toLowerCase();if(!['pdf','txt','md','epub'].includes(format))throw Error('支持 PDF、EPUB、Markdown 和 UTF-8 TXT 文件');const stat=fs.statSync(a.path);if(!stat.isFile()||stat.size>(['pdf','epub'].includes(format)?100:10)*1024*1024)throw Error('PDF / EPUB 最大 100 MB，文本最大 10 MB');const data=fs.readFileSync(a.path);if(!data.length)throw Error('文件为空');if(format==='pdf'&&!data.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('文件不是有效的 PDF');if(format==='epub')require('./epub.cjs').unpack(data);if(!['pdf','epub'].includes(format)){try{new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw Error('请将文本保存为 UTF-8 编码再导入');}}
  const hash=createHash('sha256').update(data).digest('hex'),existing=s.library.find(b=>b.hash===hash&&b.format===format);const b=existing||{id:randomUUID(),hash,format,title:path.basename(a.path,path.extname(a.path)),page:1,total:0,bookmarks:[],notes:[],exportedNotes:[],addedAt:new Date().toISOString()};fs.mkdirSync(path.join(dir,'library'),{recursive:true,mode:0o700});const dest=filePath(dir,b);if(!fs.existsSync(dest))fs.writeFileSync(dest,data,{flag:'wx',mode:0o600});b.archived=false;if(!existing)s.library.unshift(b);return b;
 }
 const b=book(s,a.id);
 if(action==='reader.navigation.save'){
  if(a.offset!==undefined)b.pageOffset=integer(a.offset,-100000,100000);
  if(a.entries!==undefined){if(!Array.isArray(a.entries)||a.entries.length>2000)throw Error('目录最多 2000 项');b.manualToc=a.entries.map(x=>({title:string(x.title,300).trim(),page:integer(x.page,1,b.total||1000000),level:integer(x.level||0,0,6)}));if(b.manualToc.some(x=>!x.title))throw Error('章节名称不能为空');}
  if(a.bookmarkPage!==undefined){const p=integer(a.bookmarkPage,1,b.total||1000000);b.bookmarkLabels||={};b.bookmarkLabels[p]=string(a.label||'',120).trim();}
  return b;
 }
 if(action==='reader.link'){if(a.habitId&&!s.habits.some(h=>h.id===a.habitId))throw Error('找不到关联习惯');b.habitId=a.habitId||'';return b;}
 if(action==='reader.progress'){const total=a.total===undefined?b.total:integer(a.total,1,1000000);const page=integer(a.page,1,total||1000000);b.page=page;b.total=total;b.lastReadAt=new Date().toISOString();return b;}
 if(action==='reader.bookmark'){const p=integer(a.page,1,b.total||1000000);if(b.bookmarks.includes(p))b.bookmarks=b.bookmarks.filter(x=>x!==p);else b.bookmarks.push(p);b.bookmarks.sort((a,b)=>a-b);return b;}
 if(action==='reader.note'){const body=string(a.body||'',10000).trim(),quote=string(a.quote||'',12000);if(!body&&!quote.trim())throw Error('先选择文字或写一点阅读心得');const page=integer(a.page,1,b.total||1000000);let anchor=null;if(a.anchor){const {start,end}=a.anchor;if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>1000000)throw Error('选区位置无效');anchor={start,end};}const note={id:randomUUID(),page,body,quote,anchor,type:['highlight','excerpt','comment'].includes(a.type)?a.type:body?'comment':'excerpt',color:['yellow','green','pink'].includes(a.color)?a.color:'yellow',at:new Date().toISOString()};b.notes.push(note);return note;}
 if(action==='reader.note.update'){const n=b.notes.find(n=>n.id===a.noteId);if(!n)throw Error('笔记不存在');if(a.expected!==undefined&&a.expected!==(n.updatedAt||n.at))throw Error('笔记已修改，请重新打开后编辑');if(a.type!==undefined){if(!['highlight','excerpt','comment'].includes(a.type))throw Error('请选择划线、摘录或想法');n.type=a.type;}if(a.body!==undefined)n.body=string(a.body,10000).trim();if(a.color!==undefined){if(!['yellow','green','pink'].includes(a.color))throw Error('标注颜色无效');n.color=a.color;}n.updatedAt=new Date().toISOString();return n;}
 if(action==='reader.note.delete'){const n=b.notes.find(n=>n.id===a.noteId);if(!n)throw Error('笔记不存在');b.notes=b.notes.filter(n=>n.id!==a.noteId);return {deleted:true};}
 if(action==='reader.toJournal'){const fresh=b.notes.filter(n=>!(b.exportedNotes||[]).includes(n.id));if(!fresh.length)return {added:0};const date=today(),old=s.journals[date];const text=markdown({...b,notes:fresh});s.journals[date]={body:(old?.body?old.body+'\n\n':'')+text,mood:old?.mood||'',updatedAt:new Date().toISOString()};b.exportedNotes=[...(b.exportedNotes||[]),...fresh.map(n=>n.id)];return {added:fresh.length,date};}
 if(action==='reader.archive'||action==='reader.restore'){b.archived=action==='reader.archive';return b;}
 throw Error('未知阅读器操作');
}
module.exports={run,content};
