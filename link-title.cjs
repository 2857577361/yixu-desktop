const {isIP}=require('node:net');

function safeURL(value){
 if(typeof value!=='string'||value.length>2048)throw Error('链接格式不正确');
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('只支持网页链接');
 const host=url.hostname.toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||isIP(host))throw Error('不读取本地网页标题');
 return url;
}
function fallbackTitle(value){
 const url=safeURL(value),parts=url.pathname.split('/').filter(Boolean).map(x=>{try{return decodeURIComponent(x);}catch{return x;}});
 if(/^index\.(html?|php)$/i.test(parts.at(-1)||''))parts.pop();
 let name=parts.at(-1)||url.hostname.replace(/^www\./,'');
 if(parts.length>1&&/[\u3400-\u9fff]/.test(parts.at(-2))&&/^(?:prototypes?|pages?|docs?)$/i.test(name))name=parts.at(-2)+' · '+({prototypes:'原型',prototype:'原型',pages:'页面',page:'页面',docs:'文档'}[name.toLowerCase()]||name);
 return name.length>55?name.slice(0,52)+'…':name;
}
function decodeEntities(value){return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity)=>{
  if(entity[0]==='#'){const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[entity.toLowerCase()]||'';
 });}
function titleFromHTML(html){const match=html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);if(!match)return '';return decodeEntities(match[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).slice(0,160);}
function isAccessPage(title){return /^(登录|登陆|sign in|log in|login|access denied|forbidden|not found|404|403)(?:\b|\s|[·|—-])/i.test(title);}
const cache=new Map();
async function pageTitle(value){
 const url=safeURL(value),key=url.href,old=cache.get(key);
 if(old&&Date.now()-old.at<24*60*60*1000)return old.title;
 const fallback=fallbackTitle(key);
 try{
  let current=url,response;
  for(let i=0;i<4;i++){
   response=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Accept:'text/html,application/xhtml+xml'}});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('location');if(!location)break;
   current=safeURL(new URL(location,current).href);
  }
  if(!response?.ok||!/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('content-type')||''))throw Error('无法读取网页标题');
  const reader=response.body?.getReader();if(!reader)throw Error('网页正文不可读');
  let buffer=Buffer.alloc(0);
  while(buffer.length<131072){const {done,value}=await reader.read();if(done)break;buffer=Buffer.concat([buffer,Buffer.from(value)]);if(/<\/title\s*>/i.test(buffer.toString('utf8')))break;}
  await reader.cancel().catch(()=>{});
  const title=titleFromHTML(buffer.toString('utf8'));
  const result=title&&!isAccessPage(title)?title:fallback;
  cache.set(key,{title:result,at:Date.now()});return result;
 }catch{cache.set(key,{title:fallback,at:Date.now()});return fallback;}
}
module.exports={pageTitle,fallbackTitle,titleFromHTML,isAccessPage};
