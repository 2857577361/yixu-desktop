const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('yixu',{
 platform:process.platform,
 call:async(action,args)=>{const r=await ipcRenderer.invoke('yixu',action,args);if(!r.ok)throw Error(r.error);return r.data;},
 onArchiveProgress:fn=>ipcRenderer.on('archive-progress',(_,progress)=>fn(progress)),
 onChange:fn=>ipcRenderer.on('changed',()=>fn()),
 onNavigate:fn=>ipcRenderer.on('navigate',(_,page)=>fn(page)),
 onNotice:fn=>ipcRenderer.on('notice',(_,message)=>fn(message)),
 onSyncProgress:fn=>ipcRenderer.on('sync-progress',(_,progress)=>fn(progress)),
 onYuqueStatus:fn=>ipcRenderer.on('yuque-status',(_,status)=>fn(status)),
 onBrowser:fn=>ipcRenderer.on('learning-browser',(_,state)=>fn(state))
});
