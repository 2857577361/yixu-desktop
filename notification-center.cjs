// Keep native notifications alive and normalize Electron's old/new action events.
module.exports=function({Notification,core,refresh,open,onError=()=>{},onResult=()=>{}}){
 const active=new Map();
 function act(entry,operation){try{const result=core.run('alert.act',{id:entry.id,operation});refresh();onResult(result,entry,operation);return result;}catch(e){onError(e);return null;}}
 function notify(title,body,entry){return new Promise(resolve=>{
  if(!Notification.isSupported()){onError(Error('这台电脑暂不支持系统通知'));resolve({ok:false});return;}
  const key=entry?.id||'test:'+Date.now();let used=false,settled=false;
  const done=(ok,error='')=>{if(settled)return;settled=true;resolve({ok,error});};
  const execute=operation=>{if(used)return;const r=act(entry,operation);if(r){used=true;n.close();}};
  const n=new Notification({title,body:body+(entry?.kind==='checkin'?' · 点击通知即可打卡一次':''),...(entry?{actions:[{type:'button',text:entry.kind==='habit'?'开始专注':entry.kind==='focus'?'完成并记录':'打卡一次'},{type:'button',text:'10 分钟后'}]}:{})});
  active.get(key)?.close();active.set(key,n);if(active.size>100){const oldest=active.keys().next().value;active.get(oldest).close();active.delete(oldest);}
  n.on('action',(event,legacyIndex)=>{if(!entry)return;const index=Number.isInteger(event?.actionIndex)?event.actionIndex:legacyIndex;if(![0,1].includes(index))return;execute(index===1?'snooze':entry.kind==='habit'?'start':'complete');});
  n.on('click',()=>{if(entry?.kind==='checkin'){execute('complete');open('checkins');}else open('today');});
  n.on('failed',(_event,error)=>{onError(Error(error||'系统通知发送失败'));done(false,error);});n.on('show',()=>done(true));
  try{n.show();setTimeout(()=>done(true),1800).unref?.();}catch(e){onError(e);done(false,e.message);}
 });}
 return {notify,active};
};
