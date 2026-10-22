const {test}=require('node:test');
const assert=require('node:assert/strict');
const {titleFromHTML,fallbackTitle,isAccessPage}=require('../link-title.cjs');

test('网页原始标题可解析实体，登录页不误当内容标题',()=>{
 assert.equal(titleFromHTML('<html><head><title>学习 &amp; 练习 &#x4E2D;&#25991;</title></head></html>'),'学习 & 练习 中文');
 assert.ok(isAccessPage('登录 · GitLab'));
 assert.ok(!isAccessPage('英语作文练习'));
});
test('需登录网页使用可读路径作为标题，不展示长编码网址',()=>{
 const url='https://pages.yc345.tv/teacher/aiclass-specs/requirements/%E8%8B%B1%E8%AF%AD%E4%BD%9C%E6%96%87AI%E6%89%B9%E6%94%B9/prototypes/index.html#practice_list';
 assert.equal(fallbackTitle(url),'英语作文AI批改 · 原型');
});
