const {app,BrowserWindow,ipcMain,shell,Notification,Tray,Menu,nativeImage,powerMonitor,dialog,session,safeStorage,globalShortcut}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const core=require('./core.cjs');
const readerAssistant=require('./reader-assistant.cjs')({dir:core.dir,safeStorage});
const chessCoach=require('./chess-coach.cjs')({dir:core.dir,safeStorage});
const tarotAssistant=require('./tarot-ai.cjs')({dir:core.dir,safeStorage});
const learningBrowser=require('./browser.cjs');
const readingRuntime=require('./reading-runtime.cjs')(core);
const lan=require('./lan.cjs')(core,{onChange:refresh});
const {pageTitle}=require('./link-title.cjs');
if(process.env.YIXU_DATA_DIR)app.setPath('userData',path.join(core.dir,'electron-profile'));
let win,tray,captureWin,quitting=false;const stickies=new Map();let busySync=false;
const ui=path.join(__dirname,'ui/index.html');
function show(){if(!win||win.isDestroyed())win=createWindow();win.show();win.focus();}
function quickCapture(){if(!captureWin||captureWin.isDestroyed()){captureWin=createWindow('capture');captureWin.on('closed',()=>{captureWin=null;});}captureWin.setAlwaysOnTop(true,'floating');captureWin.show();captureWin.focus();}
function createWindow(note){const w=new BrowserWindow({width:note==='capture'?420:note?360:1190,height:note==='capture'?520:note?390:800,minWidth:note?300:940,minHeight:note?270:640,fullscreenable:!note,maximizable:!note,title:note?'一序 · 便笺':'一序',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',autoHideMenuBar:true,icon:path.join(__dirname,'assets',process.platform==='win32'?'icon.ico':'icon.png'),backgroundColor:'#f6f5f1',alwaysOnTop:!!note,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if(!note)readingRuntime.attach(w);
 w.loadFile(ui,{query:note?{note}: {}});w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());
 if(!note)w.on('close',e=>{if(!quitting){e.preventDefault();w.hide();}});return w;}
const notifier=require('./notification-center.cjs')({Notification,core,refresh,open:dest=>{show();win.webContents.send('navigate',dest);},onError:e=>{core.run('notification.issue',{message:e.message});broadcast('notice','提醒操作未完成：'+e.message);},onResult:(r,entry,op)=>{if(r.missing)broadcast('notice','这条提醒已处理或过期，请在打卡页查看');else if(op==='complete'&&entry.kind==='checkin')broadcast('notice','已打卡一次');}});
const notify=(...args)=>notifier.notify(...args);
function broadcast(channel,data){for(const w of BrowserWindow.getAllWindows())if(w.webContents.getURL().startsWith(pathToFileURL(ui).href))w.webContents.send(channel,data);}
const yuqueWeb=require('./yuque-web.cjs').create({core,session,BrowserWindow,onProgress:p=>broadcast('sync-progress',p),onStatus:s=>broadcast('yuque-status',s)});
async function synchronize(date,kind){if(busySync)throw Error('正在同步，请稍后');busySync=true;try{return await core.sync(date,kind);}finally{busySync=false;}}
function refresh(){for(const w of BrowserWindow.getAllWindows())w.webContents.send('changed');}
async function tick(){try{if(!busySync)core.flushSync().then(r=>{if(r.synced||r.errors.length)refresh();}).catch(console.error);const habits=core.reminders(),checkins=core.quickReminders(),focus=core.focusAlertDue();for(const h of habits)void notify('该开始了 · '+h.title,`${h.minutes} 分钟 · ${h.minimum||'先从一小步开始'}`,{id:'habit:'+core.today()+':'+h.id,kind:'habit'});for(const x of checkins)void notify('顺手打卡 · '+x.title,`${x.remindAt} · 今天目标 ${x.target} 次${x.before?' · '+x.before:''}`,{id:'checkin:'+core.today()+':'+x.id+':'+x.remindAt,kind:'checkin'});if(focus)void notify(focus.title,focus.body,focus);for(const alert of core.snoozedAlertDue())void notify(alert.title,alert.body,alert);if(habits.length||checkins.length||focus)refresh();}catch(e){console.error('Reminder:',e.message);}}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',show);
 app.whenReady().then(()=>{
  const pendingChessKey=path.join(core.dir,'chess-key-pending.txt');if(require('node:fs').existsSync(pendingChessKey)){try{chessCoach.configure({key:require('node:fs').readFileSync(pendingChessKey,'utf8')});require('node:fs').unlinkSync(pendingChessKey);}catch{console.warn('棋类 AI 密钥待系统加密存储可用后保存');}}

  app.setName('一序');if(process.platform==='win32'){app.setAppUserModelId('local.yixu.desktop');if(app.isPackaged){try{const fs=require('node:fs'),programs=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');fs.mkdirSync(programs,{recursive:true});shell.writeShortcutLink(path.join(programs,'一序.lnk'),'create',{target:process.execPath,cwd:path.dirname(process.execPath),description:'一序 · 习惯、记录与学习',appUserModelId:'local.yixu.desktop',icon:process.execPath,iconIndex:0});}catch(e){console.warn('创建开始菜单入口未完成：'+e.message);}}}lan.restore();core.setImagePreparer(yuqueWeb.prepare);win=createWindow();
  const cloud=require('./cloud.cjs'),secretPath=path.join(core.dir,'cloud-auth.enc'),secretFs=require('node:fs'),safeStorage=require('electron').safeStorage;
  cloud.setSecretStore({read:async()=>{if(!secretFs.existsSync(secretPath))return {};if(!safeStorage.isEncryptionAvailable())throw Error('系统加密存储不可用');return JSON.parse(safeStorage.decryptString(secretFs.readFileSync(secretPath)));},write:async value=>{if(!safeStorage.isEncryptionAvailable())throw Error('系统加密存储不可用');secretFs.mkdirSync(core.dir,{recursive:true,mode:0o700});secretFs.writeFileSync(secretPath,safeStorage.encryptString(JSON.stringify(value)),{mode:0o600});}});
  const icon=nativeImage.createFromPath(path.join(__dirname,process.platform==='darwin'?'assets/trayTemplate.png':'assets/icon.png')).resize({width:process.platform==='darwin'?18:24,height:process.platform==='darwin'?18:24});if(process.platform==='darwin')icon.setTemplateImage(true);tray=new Tray(icon);tray.setToolTip('一序 · 今天，一件一件来');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开一序',click:show},{label:'快速记便笺',accelerator:'CommandOrControl+Shift+Space',click:quickCapture},{type:'separator'},{label:'退出一序',click:()=>app.quit()}]));tray.on('click',show);const shortcutOK=globalShortcut.register('CommandOrControl+Shift+Space',quickCapture);if(!shortcutOK)console.warn('快速捕获快捷键被占用，仍可从菜单栏打开');core.mutate(()=>{});
  ipcMain.handle('yixu',async(event,action,a={})=>{
   try{if(!event.senderFrame.url.startsWith(pathToFileURL(ui).href))throw Error('不受信任的来源');
    let result;if(action==='capture.open'){quickCapture();return {ok:true,data:{opened:true}};}if(action==='capture.status')return {ok:true,data:{registered:globalShortcut.isRegistered('CommandOrControl+Shift+Space'),shortcut:process.platform==='darwin'?'⌘⇧Space':'Ctrl+Shift+Space'}};
    if(action==='lan.status')return {ok:true,data:lan.status()};
    if(action==='lan.pair')return {ok:true,data:await lan.begin()};
    if(action==='lan.stop'){await lan.stop();return {ok:true,data:lan.status()};}
    if(action==='lan.revoke')return {ok:true,data:lan.revoke(a.id)};
    if(action==='reader.ai')return {ok:true,data:await readerAssistant.ask(a)};
    if(action==='tarot.ai')return {ok:true,data:await tarotAssistant.ask(a)};
    if(action==='chess.configure')return {ok:true,data:chessCoach.configure(a)};
    if(action==='chess.coach')return {ok:true,data:await chessCoach.coach(a)};
    if(action==='yuque.web.status')return {ok:true,data:await yuqueWeb.status()};
    if(action==='yuque.web.logout')return {ok:true,data:await yuqueWeb.logout()};
    if(action==='yuque.web.login')return {ok:true,data:yuqueWeb.login()};
    if(action==='reader.presence')return {ok:true,data:readingRuntime.presence(BrowserWindow.fromWebContents(event.sender),a)};
    if(action.startsWith('browser.'))return {ok:true,data:await learningBrowser.run(BrowserWindow.fromWebContents(event.sender),action,a)};
    if(action==='archive.export'){const picked=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'选择归档存放目录',properties:['openDirectory','createDirectory']});if(picked.canceled)return {ok:true,data:{canceled:true}};const dest=path.join(picked.filePaths[0],'一序归档-'+new Date().toISOString().replace(/[:.]/g,'-'));result=await require('./archive-job.cjs')('all',dest,{},p=>{if(!event.sender.isDestroyed())event.sender.send('archive-progress',p);});return {ok:true,data:result};}
    else if(action==='archive.import'){const picked=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'选择完整数据 JSON',properties:['openFile'],filters:[{name:'完整数据',extensions:['json']}]});if(picked.canceled)return {ok:true,data:{canceled:true}};require('./archive.cjs').validate(JSON.parse(await require('node:fs/promises').readFile(picked.filePaths[0],'utf8')));const choice=await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'question',message:'用这份归档恢复本机记录？',detail:'当前记录先自动备份，再替换为归档内容。同步账号需要重新连接。',buttons:['取消','恢复归档'],defaultId:0,cancelId:0});if(choice.response!==1)return {ok:true,data:{canceled:true}};result=await require('./archive.cjs').importAll(core,picked.filePaths[0]);refresh();return {ok:true,data:result};}
    else if(action==='image.pick'){const picked=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'添加图片',properties:['openFile','multiSelections'],filters:[{name:'图片',extensions:['png','jpg','jpeg','gif','webp']}]});result=picked.canceled?[]:picked.filePaths.map(p=>core.run('image.import',{path:p}));}
    else if(action==='document.export'){const s=core.read(),x=a.kind==='learning'?s.learning.find(x=>x.id===a.id):a.kind==='note'?s.notes.find(x=>x.id===a.id):s.journals[a.date];if(!x)throw Error('找不到要导出的内容');const title=x.title|| (a.kind==='note'?'便笺':a.date+' 日记'),body=a.kind==='learning'?require('./life.cjs').learningMarkdown(x):x.body;const dest=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'导出含图片的文档',defaultPath:title.replace(/[\\/:]/g,'-')+'.html',filters:[{name:'图文 HTML',extensions:['html']}]});if(!dest.canceled)require('node:fs').writeFileSync(dest.filePath,require('./media.cjs').html(core.dir,title,body));result={saved:!dest.canceled};}
    else if(action==='reader.import'){const picked=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'导入一本书',properties:['openFile'],filters:[{name:'电子书与文本',extensions:['pdf','epub','md','txt']}]});result=picked.canceled?null:core.run('reader.import',{path:picked.filePaths[0]});}
    else if(action==='reader.saveExport'){const book=core.read().library.find(b=>b.id===a.id);if(!book)throw Error('找不到这本书');const output=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'导出阅读笔记',defaultPath:book.title.replace(/[\\/:]/g,'-')+'-阅读笔记.md',filters:[{name:'Markdown',extensions:['md']}]});if(output.canceled)result=null;else{require('node:fs').writeFileSync(output.filePath,core.run('reader.export',{id:a.id}).markdown,'utf8');result={path:output.filePath};}}
    else if(action==='wood.assets'){const fs=require('node:fs');result={svg:fs.readFileSync(path.join(__dirname,'assets/wooden-fish.svg'),'utf8'),bytes:[...fs.readFileSync(path.join(__dirname,'assets/mokugyo.mp3'))]};}
    else if(action==='books')result=await core.books();
    else if(action==='sync')result=await synchronize(a.date);
    else if(action==='week.sync')result=await synchronize(a.date,a.scope==='life'?'life-week':'week');
    else if(action==='sync.pending')result=await core.flushSync(true);
    else if(action==='open'){await shell.openExternal(core.webURL(a.url));result={ok:true};}
    else if(action==='link.title')result={title:await pageTitle(a.url)};
    else if(action==='pin'){const n=core.read().notes.find(n=>n.id===a.id&&!n.archived);if(!n)throw Error('便笺不存在');if(stickies.has(a.id))stickies.get(a.id).focus();else{const w=createWindow(a.id);stickies.set(a.id,w);w.on('closed',()=>stickies.delete(a.id));}result={ok:true};}
    else if(action==='notification.test'){result=await notify('一序提醒测试','如果你看到这条通知，系统通知已可用。');refresh();}
    else if(action==='backup.export'){const output=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'导出手机可用的备份',defaultPath:'yixu-backup.json',filters:[{name:'一序备份',extensions:['json']}]});if(!output.canceled)require('node:fs').writeFileSync(output.filePath,JSON.stringify(require("./archive.cjs").sanitize(core.read()),null,2));result={saved:!output.canceled};}
    else if(action.startsWith('cloud.')){result=await cloud.run(action,a);}
    else {result=core.run(action,a);if(action==='settings.save'&&a.launchAtLogin!==undefined){app.setLoginItemSettings({openAtLogin:!!a.launchAtLogin});}if(action==='note.archive'&&stickies.has(a.id))stickies.get(a.id).close();}
    if(action==='note.delete'&&stickies.has(a.id))stickies.get(a.id).close();
    if(!['image.read','image.import','image.pick','learning.export','learning.list','state','today','books','open','link.title','review','plan.get','calendar.list','week.export','reader.stats','reader.list','reader.content','reader.export','timetable.get'].includes(action))refresh();
    if(!busySync)core.flushSync().then(r=>{if(r.synced||r.errors.length)refresh();}).catch(console.error);
    return {ok:true,data:result};
   }catch(e){return {ok:false,error:e.message};}
  });
  setInterval(()=>{if(core.read().cloudMeta?.signedIn)cloud.run('cloud.sync').then(()=>refresh()).catch(()=>{});},60000);
  setInterval(tick,15000);tick();powerMonitor.on('resume',tick);
  setInterval(()=>readingRuntime.tick(),5000);for(const event of ['suspend','lock-screen'])powerMonitor.on(event,()=>readingRuntime.suspend(true));for(const event of ['resume','unlock-screen'])powerMonitor.on(event,()=>readingRuntime.suspend(false));
  setInterval(()=>{refresh();},5000);
 });
 app.on('activate',show);app.on('before-quit',()=>{quitting=true;void lan.stop(false);globalShortcut.unregisterAll();readingRuntime.stop();});
}
