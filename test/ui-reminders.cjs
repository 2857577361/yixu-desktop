const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-reminder-ui-'));
 process.env.YIXU_DATA_DIR=tmp;
 const app=await electron.launch({...process.env.YIXU_TEST_EXECUTABLE?{executablePath:process.env.YIXU_TEST_EXECUTABLE}:{args:[path.resolve('.')]},env:{...process.env,YIXU_DATA_DIR:tmp}});
 try{
  const page=await app.firstWindow();await page.getByRole('heading',{name:'今天，一件一件来。'}).waitFor();
  const check=await page.evaluate(()=>window.yixu.call('checkin.save',{title:'喝水',target:2,times:[]}));
  await page.locator('[data-page=checkins]').click();
  await expect(page.getByRole('button',{name:'设置时间'})).toBeVisible();
  const time=new Date().toTimeString().slice(0,5);
  await page.evaluate(({id,time})=>window.yixu.call('checkin.save',{id,times:[time]}),{id:check.id,time});
  await page.locator('[data-page=today]').click();
  await page.evaluate(()=>window.yixu.call('focus.start',{minutes:1}));
  const core=require('../core.cjs');core.mutate(s=>{s.timer.startedAt=Date.now()-61000;});
  await expect(page.locator('.reminder-row')).toHaveCount(2,{timeout:25000});
  await expect(page.locator('.reminder-row').filter({hasText:'专注结束'})).toBeVisible();
  await expect(page.locator('.reminder-row').filter({hasText:'喝水'})).toBeVisible();
  await page.locator('.reminder-row').filter({hasText:'专注结束'}).getByRole('button',{name:'完成并记录'}).click();
  await expect(page.locator('.reminder-row')).toHaveCount(1);
  await page.locator('.reminder-row').filter({hasText:'喝水'}).getByRole('button',{name:'打卡一次'}).click();
  await expect(page.locator('.reminder-panel')).toHaveCount(0);
  assert.equal(core.read().alerts.length,0);assert.equal(core.read().checkinRecords[core.today()][check.id].count,1);
  console.log('Reminder UI passed: empty check-in time warning, due focus and check-in alerts, dismiss and completion.');
 }finally{await app.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
