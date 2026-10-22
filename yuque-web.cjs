const fs=require('node:fs'),{randomUUID}=require('node:crypto'),media=require('./media.cjs');
const PARTITION='persist:yixu-yuque-images';
function parseAccount(html){for(const m of html.matchAll(/decodeURIComponent\(\s*("(?:[^"\\]|\\.)*")\s*\)/g)){try{const x=JSON.parse(decodeURIComponent(JSON.parse(m[1])));if(x.me?.id)return {id:String(x.me.id),name:x.me.name||x.me.login||'',login:x.me.login||''};}catch{}}throw Error('请在一序里登录语雀，或重新登录后重试');}
function cloudURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='cdn.nlark.com'||u.hostname.endsWith('.nlark.com')||u.hostname==='yuque.com'||u.hostname.endsWith('.yuque.com')))throw Error();return u.href;}catch{throw Error('语雀未返回有效图片地址，已保留本地图片');}}
function create({core,session,BrowserWindow,onProgress=()=>{},onStatus=()=>{}}){
 let loginWindow=null,account=null,checkedAt=0;
 const ses=()=>session.fromPartition(PARTITION);
 const host=()=>{const h=core.syncHost(),u=new URL(h);if(u.protocol!=='https:'||!(u.hostname==='yuque.com'||u.hostname.endsWith('.yuque.com')))throw Error('图片登录目前支持 yuque.com 及其团队空间');return u.origin;};
 async function request(route,options={}){try{return await ses().fetch(host()+route,{credentials:'include',redirect:'error',signal:AbortSignal.timeout(30000),...options});}catch{throw Error('语雀网页连接失败，请检查网络或重新登录');}}
 async function identify(force=false){if(!force&&account&&Date.now()-checkedAt<30000)return account;account=null;const cookies=await ses().cookies.get({url:host()});if(!cookies.some(c=>c.name==='_yuque_session'))throw Error('请先在设置中登录语雀以同步图片');const r=await request('/dashboard');if(!r.ok)throw Error('语雀登录已失效，请重新登录');account=parseAccount(await r.text());checkedAt=Date.now();return account;}
 async function status(){try{const a=await identify(true);return {connected:true,account:a.name,login:a.login,host:host()};}catch(e){return {connected:false,error:e.message};}}
 function login(){if(loginWindow&&!loginWindow.isDestroyed()){loginWindow.show();loginWindow.focus();return {opened:true};}const w=new BrowserWindow({width:960,height:760,title:'一序 · 登录语雀以同步图片',webPreferences:{partition:PARTITION,nodeIntegration:false,contextIsolation:true,sandbox:true}});loginWindow=w;w.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));w.webContents.session.setPermissionCheckHandler(()=>false);
  const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='yuque.com'||u.hostname.endsWith('.yuque.com')||u.hostname==='dingtalk.com'||u.hostname.endsWith('.dingtalk.com')||u.hostname==='alipay.com'||u.hostname.endsWith('.alipay.com'));}catch{return false;}};
  for(const event of ['will-navigate','will-redirect'])w.webContents.on(event,(e,url)=>{if(!safe(url))e.preventDefault();});w.webContents.setWindowOpenHandler(({url})=>{if(safe(url))w.loadURL(url).catch(()=>{});return {action:'deny'};});
  w.webContents.on('did-finish-load',async()=>{const s=await status();onStatus(s);});w.on('closed',()=>{loginWindow=null;void status().then(onStatus);});w.loadURL(host()+'/login').catch(()=>onStatus({connected:false,error:'登录页加载失败，请重试'}));return {opened:true};
 }
 async function prepare(body,{book}){const refs=media.imageRefs(body);if(!refs.length)return body;const who=await identify(),tokenUser=await core.syncIdentity();if(String(tokenUser.id)!==who.id)throw Error('图片登录账号与文档 Token 账号不同，请登录同一个语雀账号');
  const scope=host()+'|'+who.id+'|'+book,cache=()=>core.read().imageUploads?.[scope]||{},map={};
  for(let i=0;i<refs.length;i++){const id=refs[i];onProgress({phase:'images',done:i,total:refs.length});const old=cache()[id];if(old){map[id]=cloudURL(old.url);continue;}
   const cookies=await ses().cookies.get({url:host()}),ctoken=cookies.find(x=>x.name==='yuque_ctoken')?.value;if(!ctoken)throw Error('语雀登录缺少上传凭据，请重新登录');
   const data=fs.readFileSync(media.imagePath(core.dir,id)),ext=id.split('.').pop(),boundary='----Yixu'+randomUUID(),mime='image/'+(ext==='jpg'?'jpeg':ext);
   const bytes=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${id}"\r\nContent-Type: ${mime}\r\n\r\n`),data,Buffer.from(`\r\n--${boundary}--\r\n`)]);
   const query=new URLSearchParams({attachable_type:'User',attachable_id:who.id,type:'image',ctoken});const r=await request('/api/upload/attach?'+query,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'x-csrf-token':ctoken,'x-requested-with':'XMLHttpRequest',Referer:host()+'/dashboard',Origin:host()},body:bytes});
   if(r.status===401||r.status===403){account=null;throw Error('语雀图片上传授权失效，请重新登录');}if(!r.ok)throw Error('图片上传失败（'+r.status+'），本地内容已保留');let json;try{json=await r.json();}catch{throw Error('语雀上传响应发生变化，请重新登录后重试');}const x=json.data||json;if(json.error||json.success===false)throw Error('语雀未接受这张图片，请重试');const url=cloudURL(x.url);map[id]=url;core.mutate(s=>{s.imageUploads||={};s.imageUploads[scope]||={};s.imageUploads[scope][id]={url,at:new Date().toISOString()};});
  }
  onProgress({phase:'document',done:refs.length,total:refs.length});return media.replaceImages(body,map);
 }
 async function logout(){if(loginWindow&&!loginWindow.isDestroyed())loginWindow.close();account=null;checkedAt=0;await ses().clearStorageData();const s={connected:false,error:'图片账号已退出，本地图片和文档 Token 保留'};onStatus(s);return s;}
 return {status,login,logout,prepare};
}
module.exports={create,parseAccount,cloudURL,PARTITION};
