const {_electron:electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-ui-'));
 const app=await electron.launch({args:[path.resolve(__dirname,'..')],env:{...process.env,YIXU_DATA_DIR:tmp}});
 try{
  const p=await app.firstWindow();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.getByRole('heading',{name:'今天，一件一件来。'}).waitFor();
  fs.mkdirSync(path.join(__dirname,'../screenshots'),{recursive:true});
  await p.screenshot({path:path.join(__dirname,'../screenshots/today.png')});
  await p.locator('[data-page="habits"]').click();await p.locator('[data-action="habit-new"]').click();
  await p.locator('[name="title"]').fill('测试阅读');await p.locator('[name="minimum"]').fill('阅读一句');
  await p.getByRole('button',{name:'保存习惯',exact:true}).click();await p.getByRole('heading',{name:'测试阅读',exact:true}).waitFor();
  await p.locator('[data-page="journal"]').click();await p.locator('#journal-body').fill('今天测试一序的日记保存。');
  await p.getByRole('button',{name:'保存日记',exact:true}).click();
  await p.locator('[data-page="notes"]').click();await p.locator('[data-action="note-new"]').click();
  await p.locator('[name="body"]').fill('下一步：每天留一句。');await p.getByRole('button',{name:'保存便笺',exact:true}).click();
  await p.getByText('下一步：每天留一句。',{exact:true}).waitFor();
  const stickyPromise=app.waitForEvent('window');await p.getByRole('button',{name:'置顶窗口',exact:true}).click();const sticky=await stickyPromise;
  await sticky.locator('#sticky-body').fill('置顶窗口更新成功');await sticky.getByRole('button',{name:'保存',exact:true}).click();
  await p.getByText('置顶窗口更新成功',{exact:true}).waitFor();await sticky.close();
  await p.locator('[data-page="today"]').click();await p.getByRole('button',{name:'开始 25 分钟'}).click();
  await p.getByRole('button',{name:'暂停',exact:true}).click();await p.getByRole('button',{name:'继续',exact:true}).waitFor();
  await p.getByRole('button',{name:'结束并记录'}).click();await p.getByRole('button',{name:'保存并结束'}).click();
  await p.getByRole('button',{name:'完成 AI 资讯阅读',exact:true}).click();await p.getByRole('button',{name:'撤销完成 AI 资讯阅读',exact:true}).waitFor();
  await p.locator('[data-page="review"]').click();await p.getByRole('heading',{name:'每一点，都算数。'}).waitFor();
  const data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json')));assert.equal(data.notes[0].body,'置顶窗口更新成功');assert.equal(Object.values(data.journals)[0].body,'今天测试一序的日记保存。');assert.equal(data.sessions.length,1);assert.equal(errors.length,0,errors.join('\n'));
  console.log('UI smoke passed: habit, journal, sticky, focus, completion, review.');
 }finally{await app.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
