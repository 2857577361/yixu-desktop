const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-v11-'));
 const app=await electron.launch({...process.env.YIXU_TEST_EXECUTABLE?{executablePath:process.env.YIXU_TEST_EXECUTABLE}:{args:[path.resolve('.')]},env:{...process.env,YIXU_DATA_DIR:tmp}});
 try{
  const page=await app.firstWindow();await page.getByRole('heading',{name:'今天，一件一件来。'}).waitFor();
  const url='https://example.com/a/very-long-url/with-many-segments/that-should-never-stretch-the-habit-card/index.html';
  await page.evaluate(url=>window.yixu.call('record.set',{id:'test-reading',status:'done',note:'先完成一小段学习，原文：'+url}),url);
  const card=page.locator('[data-key="habit-test-reading"]');
  await card.locator('.habit-preview .habit-text-link').waitFor();
  assert.equal(await card.getByRole('button',{name:'查看详情 AI 资讯阅读'}).evaluate(el=>getComputedStyle(el).fontSize),'11px');
  assert.equal(await card.locator('.habit-preview').last().evaluate(el=>getComputedStyle(el).webkitLineClamp),'2');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert(!((await card.locator('.habit-preview').last().innerText()).includes('https://')));
  await page.screenshot({path:'screenshots/habit-card-v11.png',animations:'disabled'});
  await page.getByRole('button',{name:'查看详情 AI 资讯阅读'}).click();
  await expect(page.locator('#dialog')).toContainText('先完成一小段学习');
  await expect(page.locator('#dialog .habit-text-link')).toHaveCount(2);
  await page.screenshot({path:'screenshots/habit-detail-v11.png',animations:'disabled'});
  console.log('v0.11 UI passed: habit preview stays clipped, full note opens in details, URLs use readable link labels.');
 }finally{await app.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
