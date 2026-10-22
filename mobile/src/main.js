import {patchRoot,icon,errorMessage} from "./ui.js";
import "./style.css";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { openStore, get, put, getAuth, saveAuth, native } from "./store.js";
import {
  state,
  meta,
  config,
  load,
  persist,
  run,
  change,
  replaceImported,
  today,
  Planner,
  L,
  R,
  Sync,
} from "./model.js";
import Hooks from "../../shared/hooks.cjs";
import HookEditor from "../../shared/hook-editor.cjs";
import "../../ui/hooks.css";
import Cloud from "../../shared/supabase.cjs";
import Streaks from "../../shared/habit-streaks.cjs";
import * as Local from "./lan.js";
import * as Reminders from "./reminders.js";
const root = document.querySelector("#app");
let page = "records",
  date = today(),
  recordTab = "journal",
  planMode = "week",
  client,
  mobileHookSource=null, busy = false, notesQuery="", foundComputers=[], drafts={}, scrollPositions={}, finishOpen=false;
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (label, act, id = "", extra = "") =>
  `<button type="button" data-act="${act}" data-id="${esc(id)}" ${extra}>${label}</button>`;
const empty = (x) => `<p class="empty">${x}</p>`;
function toast(x) {
  const e = document.querySelector("#toast");
  e.textContent = errorMessage(x);
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 3000);
}
const dateNav = () =>
  `<div class="date-nav">${button("‹", "prev")}<input id="date" type="date" value="${date}">${button("›", "next")}${button("今天", "today")}</div>`;
const textBodyBeforeHooks = (body = "") =>
  esc(body)
    .replace(
      /!\[([^\]]*)\]\(yixu-image:([^\)]+)\)/g,
      (_, alt, id) =>
        `<img class="attachment" data-image="${id}" alt="${alt}">`,
    )
    .replace(/\n/g, "<br>");
const textBody=body=>Hooks.parts(body,textBodyBeforeHooks,x=>HookEditor.widget(x,esc));
const row = (title, sub, actions, done = false) =>
  `<div class="row ${done ? "done" : ""}"><div class="row-copy"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><div class="actions">${actions}</div></div>`;
function viewKey(){return page+':'+(page==='records'?recordTab+':'+(recordTab==='journal'?date:''):page==='plan'?planMode+':'+date:'');}
function saveDrafts(){for(const f of root.querySelectorAll('form[data-form="note"],form[data-form="learning"],form[data-form="journal"]')){const k=f.dataset.form==='journal'?'journal:'+date:f.dataset.form;const value={...Object.fromEntries(new FormData(f)),id:f.dataset.id||''};if(f.dataset.form==='journal'&&value.body===(state.journals[date]?.body||''))delete drafts[k];else drafts[k]=value;}put('drafts',drafts).catch(()=>{});}
function restoreDrafts(){for(const f of root.querySelectorAll('form')){if(f.dataset.ready)continue;f.dataset.ready='true';const k=f.dataset.form==='journal'?'journal:'+date:f.dataset.form,d=drafts[k];if(d){for(const [name,value]of Object.entries(d))if(f.elements[name]&&typeof value==='string')f.elements[name].value=value;if(d.id)f.dataset.id=d.id;}}}
function render() {
 const previous=root.dataset.view,view=viewKey(),y=window.scrollY;
 if(previous)scrollPositions[previous]=y;
 const titles={records:'随手记录',plan:'周计划',checkins:'打卡',habits:'习惯',mine:'我的','hook-source':'原记录'},subtitles={records:'随时记下，回到电脑继续',plan:'查看安排，记录完成与进展',checkins:'一点就记下，累计今天的小行动',habits:'留下行动与收获，保持自己的节奏',mine:'离线保存，连接电脑自动同步','hook-source':'回到待办所在的位置'};
 const html=`<header><div><div class="brand-line"><span class="brand-mark">一</span>一序</div><h1>${titles[page]}</h1><p>${subtitles[page]}</p></div><button class="sync-icon ${busy?'syncing':''}" data-act="sync" aria-label="立即同步" title="立即同步">${icon('sync')}<span class="connection-dot ${Local.lanOnline||client?.session.user?'online':''}"></span></button></header><section id="content">${({records:recordsView,plan:planView,checkins:checkinsView,habits:habitsView,mine:mineView,'hook-source':mobileHookSourceView}[page])()}</section><nav aria-label="主要页面">${[['records','记录'],['plan','周计划'],['checkins','打卡'],['habits','习惯'],['mine','我的']].map(([key,label])=>`<button data-page="${key}" aria-current="${page===key?'page':'false'}" class="${page===key?'active':''}">${icon(key)}<span>${label}</span></button>`).join('')}</nav>`;
 const changed=patchRoot(root,html,view);restoreDrafts();prepareEditors();refreshHabitForms();refreshJournalActions();hydrateImages();tick();
 if(changed){window.scrollTo(0,scrollPositions[view]||0);root.classList.remove('arrive');void root.offsetWidth;root.classList.add('arrive');}
 else window.scrollTo(0,y);
}
function refreshJournalActions(){const f=root.querySelector('form[data-form="journal"]');if(!f)return;const old=f.querySelector('[data-act=journal-delete]');if(state.journals[date]?.body&&!old){const t=document.createElement('template');t.innerHTML=button('删除','journal-delete');f.querySelector('button.primary').before(t.content);}else if(!state.journals[date]?.body&&old)old.remove();}
function refreshHabitForms(){for(const f of root.querySelectorAll('form[data-form="habit-record"]')){if(f.dataset.dirty||f.contains(document.activeElement))continue;f.elements.note.value=state.records[date]?.[f.dataset.id]?.note||'';const editor=f.elements.note.nextElementSibling;if(editor?.classList.contains('editor'))editor.innerHTML=textBody(f.elements.note.value);}}
function more(actions,caption='更多'){return `<details class="item-more"><summary aria-label="${caption}">•••</summary><div class="more-actions">${actions}</div></details>`;}
function todayView(){const d=today(),rest=!!state.restDays[d],all=state.habits.filter(h=>h.enabled),hs=all.filter(h=>L.eligible(state,h,d)),cs=state.checkins.filter(h=>h.enabled&&R.matches(h.recurrence,d,undefined,state)&&(!h.workdaysOnly||L.isWorkday(state,d))),done=hs.filter(h=>['done','minimum'].includes(state.records[d]?.[h.id]?.status)).length,minutes=Math.round(state.sessions.filter(x=>x.date===d).reduce((n,x)=>n+(x.seconds||0),0)/60);
return `<section class="day-hero" data-key="hero"><div class="hero-top"><span>${new Date(d+'T12:00:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</span>${button(rest?'恢复安排':'今天休息','rest')}</div><h2>${rest?'今天，安心休息。':'一步一步，也是在向前。'}</h2><div class="hero-metrics"><span><b>${done}<i>/${hs.length}</i></b>习惯完成</span><span><b>${minutes}<i>分钟</i></b>今日专注</span><span class="hero-quote">${rest?'主动休息不算失败':'先做好眼前的一小步'}</span></div></section>${timerView()}<div class="section-title"><h2>习惯与专注</h2><small>${hs.length} 个小行动</small></div><article class="list-card" data-key="habits">${hs.map(h=>{const r=state.records[d]?.[h.id],w=h.goal?L.weekly(state,h,d):null,completed=w?w.done:r?.status==='done';return `<div class="row habit-card ${completed?'done':''}" data-key="habit:${h.id}"><div class="row-copy"><strong>${esc(h.title)}</strong><small>${w?`本周 ${w.value}/${w.target} ${w.unit==='minutes'?'分钟':'次'}`:`${esc(h.time||'自由安排')} · ${h.minutes||20} 分钟`}${r?.status==='minimum'?' · 最低版完成':''}</small>${w?`<div class="progress-track"><i style="width:${Math.min(100,w.value/w.target*100)}%"></i></div>`:''}</div><div class="row-main-actions">${button('开始','focus',h.id)}${button(h.goal?.unit==='count'?'+1':completed?'✓':'完成','habit-done',h.id,`class="complete-button ${completed?'is-complete':''}" aria-label="${completed?'撤销或记录完成':'完成'}${esc(h.title)}"`)}</div>${more(button('完成最低版','minimum',h.id)+button('移除习惯','habit-delete',h.id),'习惯更多操作')}</div>`;}).join('')||empty(rest?'今天已安排休息。':'从一个容易开始的小习惯出发。')}</article>${habitForm('habit')}<div class="section-title"><h2>顺手打卡</h2><small>一点记一次</small></div><article class="list-card" data-key="checkins">${rest?empty('今天暂停打卡，放心休息。'):cs.map(h=>{const n=state.checkinRecords[d]?.[h.id]?.count||0;return `<div class="row checkin-card ${n>=h.target?'done':''}" data-key="checkin:${h.id}"><div class="row-copy"><strong>${esc(h.title)}</strong><div class="checkin-count"><b>${n}</b><span>/ ${h.target} 次</span></div><div class="count-dots" aria-hidden="true">${Array.from({length:Math.min(h.target,12)},(_,i)=>`<i class="${i<n?'filled':''}"></i>`).join('')}</div></div>${button(n>=h.target?'✓':'+','check',h.id,`class="count-plus" aria-label="${esc(h.title)}打卡一次" ${n>=h.target?'disabled':''}`)}${more(`<small>${esc((h.times||[]).join(' · ')||'自由打卡，不设提醒')}</small>`+button('撤销一次','check-minus',h.id,n===0?'disabled':'')+button('移除打卡','check-delete',h.id),'打卡更多操作')}</div>`;}).join('')||empty('喝水、走动，随手记下一次。')}</article>${habitForm('checkin')}<div class="section-title"><h2>今天的安排</h2>${button('查看计划 →','plan-open')}</div><article class="list-card" data-key="today-plan">${(state.plans[L.week(d)]?.entries||[]).filter(e=>e.date===d&&!e.archived).map(e=>row(e.title,e.category,button(mark(e.status),'entry-cycle',e.id,`data-date="${d}" class="status-check status-${esc(e.status)}" aria-label="切换${esc(e.title)}完成状态"`),e.status==='done')).join('')||empty('从周计划中选一件事安排到今天。')}</article>${state.chains.filter(x=>x.date===d&&!x.done).slice(0,3).map(x=>`<article class="chain" data-key="chain:${x.id}"><div><small>顺手接下一步</small><strong>${esc(x.title)}</strong></div>${button('我来做','chain',x.id)}</article>`).join('')}`;}
function phoneRepeatDays(){return `<fieldset class="phone-repeat-days" hidden><legend>每周哪几天</legend>${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="repeatDays" value="${d}" ${d>0&&d<6?'checked':''}><span>周${'日一二三四五六'[d]}</span></label>`).join('')}</fieldset>`;}
function habitForm(kind) {
  return `<details class="add-panel" data-key="add-${kind}"><summary>＋ 添加${kind === "habit" ? "习惯" : "打卡"}</summary><form data-form="${kind}"><input name="title" placeholder="名称" required maxlength="300"><div class="two"><label>每次${kind === "habit" ? "分钟" : "次数"}<input type="number" name="amount" min="1" max="${kind === "habit" ? 240 : 100}" value="${kind === "habit" ? 20 : 1}"></label><label>重复<select name="repeat"><option value="daily">每天</option><option value="interval">每两天</option><option value="weekdays">工作日（含补班）</option><option value="selectedDays">每周选择几天</option>${kind === "habit" ? '<option value="weekly">每周次数</option><option value="minutes">每周累计分钟</option>' : ""}</select></label></div>${phoneRepeatDays()}${kind === "habit" ? '<label class="weekly-goal" hidden>每周目标<input name="goal" type="number" min="1" max="10000" value="3"></label><label>提醒时间<input type="time" name="time"></label><details class="form-more"><summary>最低版与下一步（可选）</summary><input name="minimum" placeholder="最低版，例如读两页"><input name="afterAction" placeholder="完成后，例如留一句日记"></details>' : '<label>多个提醒时间（逗号分隔）<input name="times" placeholder="09:00,11:00,14:00"></label><input name="before" placeholder="前置动作，例如吃完早餐"><input name="after" placeholder="后置动作，例如伸展一分钟">'}<button class="primary">添加</button></form></details>`;
}
function timerView(){const t=state.timer;return `<article class="focus-card" data-key="focus"><div class="focus-head"><span class="eyebrow">${t?'正在专注':'留一段专注'}</span><span class="focus-state">${t?(t.startedAt?'进行中':'已暂停'):'准备开始'}</span></div><div class="focus-center"><div class="focus-ring"><strong ${t?'id="clock"':''}>${t?'':'25:00'}</strong><small>${esc(t?.title||'只做眼前这一件事')}</small></div></div><div class="focus-actions">${t?button(t.startedAt?'暂停':'继续',t.startedAt?'pause':'resume','',`class="${t.startedAt?'secondary':'primary'}"`)+button('结束并记录','finish'):button('开始 25 分钟','focus','','class="primary"')}</div>${finishOpen&&t?'<form data-form="finish" data-key="finish-form"><textarea name="note" placeholder="留一句收获（可选）"></textarea><label class="consent"><input name="complete" type="checkbox" checked><span>同时完成习惯</span></label><div class="form-actions"><button class="primary">保存并结束</button><button type="button" data-act="finish-cancel">继续专注</button></div></form>':''}</article>`;}
function tick() {
  const t = state.timer,
    c = document.querySelector("#clock");
  if (!t || !c) return;
  const remaining = Math.max(
      0,
      t.remainingMs - (t.startedAt ? Date.now() - t.startedAt : 0),
    ),
    n = Math.ceil(remaining / 1000);
  c.textContent = `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  if (!n && t.startedAt) c.classList.add("time-up");
}
function recordForm(kind){const draft=drafts[kind],editing=!!draft?.id;return `<details class="composer" data-key="composer:${kind}" ${draft?.body||editing?'open':''}><summary><span>${editing?'编辑记录':kind==='note'?'＋ 写一条便笺':'＋ 保存学习网址'}</span><small>${kind==='note'?'随手记下，不必整理':'文章、视频和自己的思考'}</small></summary><form data-form="${kind}">${kind==='learning'?'<label>学习网址<input name="url" type="url" placeholder="粘贴文章或视频链接" required></label>':''}<input name="title" placeholder="${kind==='note'?'便笺标题':'标题（可选）'}" ><textarea name="body" id="${kind}-body" placeholder="${kind==='note'?'留住此刻的一点想法…':'摘录、笔记，或下一次从哪里继续…'}"></textarea><div class="form-actions"><label class="file-button">＋ 图片<input type="file" accept="image/*" data-image-target="${kind}-body" hidden></label><span class="save-status" data-draft-status>草稿保存在本机</span><button class="primary">${editing?'保存修改':'保存'}</button></div></form></details>`;}
function recordsView(){return `<div class="tabs" role="tablist">${['journal','notes'].map((k,i)=>`<button role="tab" aria-selected="${recordTab===k}" data-record="${k}" class="${recordTab===k?'active':''}">${['日记','便笺','稍后学习'][i]}</button>`).join('')}</div>${recordTab==='journal'?`${dateNav()}<form class="journal-paper" data-form="journal"><div class="paper-head"><span class="eyebrow">写给这一天</span><span class="save-status" id="journal-save-status">已保存本机</span></div><textarea name="body" id="journal-body" placeholder="今天发生了什么？
写下一件值得记住的小事…">${esc(state.journals[date]?.body||'')}</textarea><div class="form-actions"><label class="file-button">＋ 图片<input type="file" accept="image/*" data-image-target="journal-body" hidden></label><span class="muted">自动保存</span>${state.journals[date]?.body?button('删除','journal-delete'):''}<button class="primary">保存日记</button></div></form>`:recordTab==='notes'?`${recordForm('note')}<input id="notes-search" type="search" aria-label="搜索便笺标题" placeholder="搜索便笺标题…" value="${esc(notesQuery)}"><div class="section-title"><h2>我的便笺</h2><small>${state.notes.filter(x=>!x.archived).length} 条</small></div><div class="record-grid">${state.notes.filter(x=>!x.archived&&(!notesQuery||(x.title||'').includes(notesQuery))).map(x=>`<article class="note-card ${esc(x.color||'sand')}" data-key="note:${x.id}"><small>${esc((x.createdOn||x.updatedAt||'').slice(0,10))}</small><h3>${esc(x.title||x.body?.split('\n')[0]?.slice(0,40)||'无标题便笺')}</h3><details class="note-content"><summary>展开内容</summary><div class="body">${textBody(x.body)}</div></details><footer>${button('编辑','note-edit',x.id)}${more(button('删除便笺','note-delete',x.id),'便笺更多操作')}</footer></article>`).join('')||empty('想到什么，就留在这里。')}</div>`:`${recordForm('learning')}<div class="section-title"><h2>稍后学习</h2><small>${state.learning.filter(x=>!x.archived).length} 份内容</small></div><div class="record-grid">${state.learning.filter(x=>!x.archived).map(x=>`<article class="learning-card" data-key="learning:${x.id}"><div class="learning-source"><span>${esc(hostname(x.url))}</span><span class="status-tag ${x.status==='done'?'is-done':''}">${x.status==='done'?'已学习':'待学习'}</span></div><h3><a href="${esc(safeURL(x.url))}" target="_blank" rel="noopener">${esc(x.title||x.url)} ↗</a></h3>${x.body||x.note?`<details class="note-preview"><summary>阅读笔记</summary><div class="body">${textBody(x.body||x.note)}</div></details>`:''}<footer>${button('记笔记','learning-edit',x.id)}${button(x.status==='done'?'恢复待学':'标记已学','learn-done',x.id)}${more(button('删除内容','learning-delete',x.id),'学习更多操作')}</footer></article>`).join('')||empty('先收藏一篇想读的文章或视频。')}</div>`}`;}
function hostname(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '学习内容';}}
const mark = (s) =>
  ({ done: "✓", skipped: "✕", blocked: "✕", pending: "□" })[s] || "□";
function mobileHookSourceView(){const d=Hooks.documents(state).find(x=>Hooks.identity(x)===mobileHookSource?.source);if(!d)return empty('原记录已移除');return `${button('← 返回近期待办','hook-back')}<article><small>${esc(d.date)}</small><h2>${esc(d.title)}</h2><form data-form="hook-source"><textarea id="hook-source-body" name="body">${esc(d.body)}</textarea><button class="primary">保存原记录</button></form></article>`;}
function mobileHookRows(items){return items.map(x=>`<article class="hook-todo ${x.done?'is-complete':''}"><button class="hook-check" data-act="hook-toggle" data-source="${esc(x.source)}" data-hook-id="${x.id}" data-done="${x.done?'1':'0'}" aria-label="${x.done?'恢复':'完成'}待办 ${esc(x.title)}">${x.done?'✓':''}</button><button class="hook-jump" data-act="hook-jump" data-source="${esc(x.source)}" data-hook-id="${x.id}"><strong>${esc(x.title)}</strong><small>${esc(x.sourceTitle)} · ${x.createdOn}</small></button></article>`).join('');}
function planView(){const html=planViewBeforeHooks();if(planMode!=='week')return html;const xs=Hooks.list(state);return html+`<article id="recent-hooks" class="hook-section"><div class="section-title"><h2>近期待办</h2><small>${xs.filter(x=>!x.done).length} 项待办 · 跨周保留</small></div>${mobileHookRows(xs.filter(x=>!x.done))||empty('在记录里输入 /hook，留下下一步。')}${xs.some(x=>x.done)?`<details class="hook-completed"><summary>已完成 ${xs.filter(x=>x.done).length}</summary>${mobileHookRows(xs.filter(x=>x.done))}</details>`:''}</article>`;}
async function openMobileHook(source,id){const x=Hooks.list(state).find(x=>x.source===source&&x.id===id);if(!x){toast('原记录已移除');return;}if(x.kind==='journal'){page='records';recordTab='journal';date=x.date;render();}else if(['note','study'].includes(x.kind)){page='records';recordTab='notes';notesQuery='';render();root.querySelector('[data-act=note-edit][data-id="'+x.idOfRecord+'"]')?.click();}else if(x.kind==='habit'){page='habits';date=x.date;render();const d=root.querySelector('[data-key="habit:'+x.idOfRecord+'"] .habit-note');if(d)d.open=true;}else {mobileHookSource={source,id};page='hook-source';render();}setTimeout(()=>{const el=[...root.querySelectorAll('.hook-token')].find(e=>e.dataset.hookId===id);if(el){for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hook-located');setTimeout(()=>el.classList.remove('hook-located'),3500);}},80);}
function planViewBeforeHooks() {
  if (planMode === "calendar") return calendarView();
  const p = Planner.run(state, "plan.get", { date });
  return `<div class="tabs"><button data-act="plan-week" class="${planMode==='week'?'active':''}">周计划</button><button data-act="plan-calendar" class="${planMode==='calendar'?'active':''}">生活月历</button></div>${dateNav()}<p class="muted">${p.week} — ${L.add(p.week, 6)}</p><div class="week-strip">${p.dates.map((d, i) => `<button class="${d === date ? "selected" : ""}" data-day="${d}">周${"一二三四五六日"[i]}<b>${d.slice(8)}</b></button>`).join("")}</div>${p.categories
    .map(
      (c) =>
        `<details class="plan-category" data-key="category:${c}" ${p.entries.some(e=>!e.archived&&e.date===date&&e.category===c)?'open':''}><summary><span>${c}</span><small>${p.entries.filter(e=>!e.archived&&e.date===date&&e.category===c).length} 项 · 点击展开</small></summary><article>${
          p.entries
            .filter((e) => !e.archived && e.date === date && e.category === c)
            .map((e) =>
              row(
                e.title,
                "",
                button(
                  mark(e.status),
                  "entry-cycle",
                  e.id,
                  `data-date="${date}" class="status-check status-${esc(e.status)}"`,
                ) + more(button("编辑安排", "entry-edit", e.id)+button("删除安排", "entry-delete", e.id)),
              ),
            )
            .join("") || empty("暂无安排")
        }<form class="inline" data-form="entry" data-category="${c}"><input name="title" placeholder="写下安排，回车添加" required><button aria-label="添加安排">＋</button></form></article></details>`,
    )
    .join(
      "",
    )}<details><summary>查看完整本周表格</summary><div class="table-scroll"><table><thead><tr><th>分类</th>${p.dates.map((d) => `<th>${d.slice(5)}</th>`).join("")}</tr></thead><tbody>${p.categories
    .map(
      (c) =>
        `<tr><th>${c}</th>${p.dates
          .map(
            (d) =>
              `<td>${p.entries
                .filter((e) => e.date === d && e.category === c && !e.archived)
                .map(
                  (e) =>
                    `<div>${button(mark(e.status), "entry-cycle", e.id, `data-date="${d}" class="status-check status-${esc(e.status)}"`)} ${esc(e.title)}</div>`,
                )
                .join("")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join(
      "",
    )}</tbody></table></div></details><h2>整体计划</h2><details class="add-panel"><summary>＋ 添加整体任务</summary><form data-form="task"><input name="title" placeholder="本周要做的事" required><div class="two"><label>一周几次<input type="number" name="target" min="1" max="100" value="1"></label><label>分类<select name="category">${p.categories.map((c) => `<option>${c}</option>`).join("")}</select></label></div><button class="primary">添加整体计划</button></form></details>${p.tasks.slice().sort((a,b)=>({pending:0,progress:0,blocked:1,done:2}[a.status]??0)-({pending:0,progress:0,blocked:1,done:2}[b.status]??0)).map((t) => `<article class="task-card" data-key="task:${t.id}"><strong>${esc(t.title)}</strong><small>本周 ${t.completed}/${t.target} 次</small><div class="progress-track"><i style="width:${Math.min(100,t.completed/t.target*100)}%"></i></div><div class="actions">${button("安排到选中日", "pick", t.id, `data-category="${esc(t.category || "工作")}"`)}${button("+1", "task-plus", t.id)+more(button("编辑任务", "task-edit", t.id)+button("删除任务", "task-delete", t.id))}</div></article>`).join("")}`;
}
function mineView() {
  return connectionView()+`<details class="advanced-settings"><summary>其他连接与备份</summary>`+legacyMineView()+`</details>`;
}
function legacyMineView(){
  const week = L.week(today()),
    sessions = state.sessions.filter(
      (x) => x.date >= week && x.date <= L.add(week, 6),
    ),
    minutes = Math.round(
      sessions.reduce((n, x) => n + (x.seconds || 0), 0) / 60,
    );
  return `<article><h2>本周回顾</h2><div class="stats"><div><strong>${sessions.length}</strong><small>专注次数</small></div><div><strong>${minutes}</strong><small>专注分钟</small></div><div><strong>${Object.keys(state.restDays).filter((d) => d >= week && d <= L.add(week, 6)).length}</strong><small>主动休息</small></div></div>${sessions
    .slice(-8)
    .reverse()
    .map(
      (x) =>
        `<p>${esc(x.title)} · ${Math.round(x.seconds / 60)}分钟<br><small>${esc(x.note)}</small></p>`,
    )
    .join(
      "",
    )}</article><article><h2>手机提醒</h2><p>支持多时间打卡提醒、专注结束提醒和通知里直接打卡。首次使用需要开启通知权限。</p>${button("开启提醒", "permissions")}<small>部分安卓系统还需要允许后台运行；关闭应用后专注提醒仍由系统发送。</small></article><details class="cloud-card" data-key="cloud"><summary>云同步</summary><p class="muted">${client?.session.user ? esc(client.session.user.email) : "尚未登录"} · ${meta.outbox.length} 条待同步</p><small>${meta.lastSync ? "上次同步：" + new Date(meta.lastSync).toLocaleString() : "连接已配置。请与电脑登录同一邮箱账号。"}</small>${meta.error?`<p class="sync-error">${esc(errorMessage(meta.error))}</p>`:""}${!client?.session.user?`<form data-form="cloud"><details><summary>高级连接设置</summary><input name="url" type="url" placeholder="https://项目ID.supabase.co" value="${esc(config.url)}" required><input name="key" placeholder="publishable / anon 公钥" value="${esc(config.key)}" required></details><input type="email" name="email" placeholder="邮箱" required autocomplete="username"><input type="password" name="password" placeholder="密码" required minlength="8" autocomplete="current-password"><label class="consent"><input type="checkbox" required><span>将本机记录同步到我的私有账号</span></label><div class="actions"><button name="mode" value="login" class="primary">登录并连接</button><button name="mode" value="signup">注册账号</button></div></form>`:`<div class="form-actions">${button("立即同步","sync","","class=\"primary\"")}${button("退出账号","logout")}</div>`}</details>${Object.entries(
    meta.conflicts,
  )
    .map(
      ([k, c]) =>
        `<article><strong>有一条记录需要合并</strong><small>${esc(k)}</small><p>本机：${esc(JSON.stringify(c.local).slice(0, 400))}</p><p>云端：${esc(JSON.stringify(c.remote?.value).slice(0, 400))}</p>${button("保留本机", "conflict-local", k)}${button("采用云端", "conflict-remote", k)}</article>`,
    )
    .join(
      "",
    )}<article><h2>备份与导入</h2><div class="backup-actions">${button("导出备份", "export")}<label class="file-button">导入桌面备份<input type="file" data-import accept="application/json" hidden></label></div><p class="muted">导入前会保存手机当前数据的备份。导入将替换本机记录。</p></article><p class="muted">一序安卓 · 0.4.1 · 记录与查看</p>`;
}
function calendarView() {
  const items = R.expand(state.events, date, date,state).filter(
    (e) => e.date === date && !e.archived,
  );
  return `<div class="tabs"><button data-act="plan-week" class="${planMode==='week'?'active':''}">周计划</button><button data-act="plan-calendar" class="${planMode==='calendar'?'active':''}">生活月历</button></div>${dateNav()}<h2>这一天的生活安排</h2><article>${items.map((x) => row(x.title, R.label(x.seriesRule || x.recurrence), button(mark(x.status), "event-cycle", x.id) + more(button("删除安排", "event-delete", x.id)))).join("") || empty("给这一天留一个小安排。")}</article><details class="add-panel"><summary>＋ 添加生活安排</summary><form data-form="event"><input name="title" required placeholder="生活安排"><select name="repeat"><option value="none">仅这一天</option><option value="daily">每天</option><option value="two">每两天</option><option value="weekly">每周同一天</option><option value="workdays">工作日（含补班）</option><option value="selectedDays">每周选择几天</option></select>${phoneRepeatDays()}<button class="primary">添加安排</button></form></details>`;
}
function serialize(el) {
  let out = "";
  for (const node of el.childNodes) {
    if(node.nodeType===1&&node.classList.contains('hook-token'))out+=Hooks.mark(HookEditor.token(node));
    else if (node.nodeType === 3) out += node.textContent;
    else if (node.nodeName === "IMG" && node.dataset.image)
      out += "\n![图片](yixu-image:" + node.dataset.image + ")\n";
    else if (node.nodeName === "BR") out += "\n";
    else
      out +=
        serialize(node) + (["DIV", "P"].includes(node.nodeName) ? "\n" : "");
  }
  return out;
}
function prepareEditors() {
  for (const source of root.querySelectorAll('textarea:not([readonly])')) {
    if(source.nextElementSibling?.classList.contains("editor"))continue;
    const editor = document.createElement("div");
    editor.className = "editor";
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", source.placeholder || "记录正文");
    editor.dataset.placeholder = source.placeholder;editor.setAttribute('aria-description','输入 /hook 添加近期待办');if(source.id==='hook-source-body')source.form.dataset.expected=source.value;
    editor.innerHTML = textBody(source.value);
    source.hidden = true;
    source.after(editor);HookEditor.bind(editor,{Hooks,esc,date:today,commit:()=>{source.value=serialize(editor);source.dispatchEvent(new Event('input',{bubbles:true}));}});
    editor.addEventListener("input", () => {
      source.value = serialize(editor);
      source.dispatchEvent(new Event("input", { bubbles: true }));
    });
    editor.addEventListener("paste", async (e) => {
      const file = [...e.clipboardData.items]
        .find((x) => x.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        try {
          await attach(file, source.id);
          hydrateImages();
        } catch (err) {
          toast(err.message);
        }
      }
    });
  }
}
function safeURL(url) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
async function hydrateImages() {
  for (const img of root.querySelectorAll("[data-image]")) {
    if(img.getAttribute("src"))continue;
    const value = await get("image:" + img.dataset.image);
    if (value) img.src = value;
    else img.alt = "图片尚未同步";
  }
}
async function attach(file, target) {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024)
    throw Error("请选择15MB以内的图片");
  const bitmap = await createImageBitmap(file),
    ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = bitmap.width * ratio;
  canvas.height = bitmap.height * ratio;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.85),
    blob = await (await fetch(data)).blob(),
    bytes = await blob.arrayBuffer(),
    id =
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("") + ".jpg";
  await put("image:" + id, data);
  const input = document.getElementById(target),
    editor = input.nextElementSibling;
  if (editor?.classList.contains("editor")) {
    const image = document.createElement("img");
    image.className = "attachment";
    image.dataset.image = id;
    image.src = data;
    image.alt = "图片";
    editor.append(image);
    input.value = serialize(editor);
  } else
    input.setRangeText(
      `\n![图片](yixu-image:${id})\n`,
      input.selectionStart,
      input.selectionEnd,
      "end",
    );
  input.dispatchEvent(new Event("input", { bubbles: true }));
  toast("图片已加入，保存记录即可");
}
async function sync(silent = false) {
  if(Local.connection){saveDrafts();const ok=await Local.synchronizeLan();if(!silent)toast(ok?'已与电脑同步':Local.lanError);return;}
  if(silent)return;
  if (busy) return;
  if (
    silent &&
    (page === "records" ||
      document.activeElement?.matches("input,textarea,[contenteditable=true]"))
  )
    return;
  clearTimeout(draftTimer);
  const editor = document.querySelector("#journal-body");
  if (editor) await run("journal.save", { date, body: editor.value });
  if (!client?.session.user) {
    saveDrafts();page="mine";render();root.querySelector(".lan-card")?.scrollIntoView({behavior:"smooth",block:"center"});toast("先与电脑配对，即可自动同步");
    return;
  }
  busy = true;
  try {
    await change(() => {});
    const refs = new Set(
        JSON.stringify(state)
          .match(/yixu-image:([a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif))/g)
          ?.map((x) => x.slice(11)) || [],
      ),
      uploaded = (await get("uploaded-images:" + client.session.user.id)) || {};
    for (const id of refs) {
      const data = await get("image:" + id);
      if (data && !uploaded[id]) {
        await client.upload(id, await (await fetch(data)).blob());
        uploaded[id] = true;
        await put("uploaded-images:" + client.session.user.id, uploaded);
      }
    }
    await Sync.sync(meta, state, client, async () => {
      Planner.reconcile(state);
      await persist();
    });
    for (const ref of JSON.stringify(state).matchAll(
      /yixu-image:([a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif))/g,
    )) {
      const id = ref[1];
      if (!(await get("image:" + id))) {
        const blob = await client.download(id);
        const data = await new Promise((r, j) => {
          const f = new FileReader();
          f.onload = () => r(f.result);
          f.onerror = j;
          f.readAsDataURL(blob);
        });
        await put("image:" + id, data);
      }
    }
    if (!silent) toast("同步完成");
  } catch (e) {
    meta.error = e.message;
    await persist();
    if (!silent) toast("已保存在本机：" + e.message);
  } finally {
    busy = false;
    await Reminders.schedule();
    render();
  }
}
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.page) {
      saveDrafts();page = b.dataset.page;
      render();
      return;
    }
    if (b.dataset.record) {
      saveDrafts();recordTab = b.dataset.record;
      render();
      return;
    }
    if (b.dataset.day) {
      saveDrafts();date = b.dataset.day;
      render();
      return;
    }
    const id = b.dataset.id,
      a = b.dataset.act;
    if (!a) return;
    if(a==='hook-back'){page='plan';planMode='week';render();return;}
    if(a==='hook-toggle'){await run('hook.set',{source:b.dataset.source,id:b.dataset.hookId,done:b.dataset.done!=='1'});render();return;}
    if(a==='hook-jump'){await openMobileHook(b.dataset.source,b.dataset.hookId);return;}
    if(a==='lan-discover'){toast('正在寻找同一 Wi-Fi 的电脑…');foundComputers=await Local.discover();render();const address=root.querySelector('[name=address]'),list=root.querySelector('#lan-computers');if(address&&!address.value)address.value=foundComputers[0]?.url||'';if(list)list.innerHTML=foundComputers.map(x=>'<option value="'+esc(x.url)+'">'+esc(x.name)+'</option>').join('');if(!foundComputers.length)toast('未发现电脑，可填写电脑设置里的地址');return;}
    if(a==='lan-disconnect'){await Local.disconnect();render();return;}
    if(a==='lan-resolve'){await Local.resolveLan(id,b.dataset.choice);render();return;}
    if(a==='journal-delete'){clearTimeout(draftTimer);await run('journal.save',{date,body:''});delete drafts['journal:'+date];await put('drafts',drafts);const host=root.querySelector('#content');host.replaceChildren();render();return;}
    if(a==='habit-edit'||a==='checkin-edit'){const kind=a.split('-')[0],h=(kind==='habit'?state.habits:state.checkins).find(x=>x.id===id),f=root.querySelector('[data-form="'+kind+'"]');f.dataset.id=id;f.closest('details').open=true;for(const k of ['title','time','minimum','afterAction','before','after'])if(f.elements[k])f.elements[k].value=h[k]||'';f.elements.amount.value=kind==='habit'?h.minutes||20:h.target||1;if(f.elements.times)f.elements.times.value=(h.times||[]).join(',');if(!f.elements.repeat.querySelector('[value=keep]'))f.elements.repeat.add(new Option('保留当前安排','keep'),0);f.elements.repeat.value='keep';const selected=f.querySelector('.phone-repeat-days');if(selected){selected.hidden=true;for(const box of selected.querySelectorAll('input'))box.checked=(h.recurrence?.days||[1,2,3,4,5]).includes(Number(box.value));}const goal=f.querySelector('.weekly-goal');if(goal){goal.hidden=!h.goal;f.elements.goal.value=h.goal?.target||3;}f.scrollIntoView({block:'center',behavior:'smooth'});return;}
    if(a==='entry-edit'){const x=state.plans[L.week(date)].entries.find(x=>x.id===id),f=b.closest('.plan-category').querySelector('form');f.dataset.id=id;f.elements.title.value=x.title;f.elements.title.focus();return;}
    if(a==='habit-clear'){await run('record.delete',{id,date});const f=b.closest('.phone-habit').querySelector('form');delete f.dataset.dirty;f.reset();render();return;}
    if (busy && a !== "sync") throw Error("正在同步，请稍候再修改");
    if(a==='plan-open'||a==='focus-open'){saveDrafts();page=a==='plan-open'?'plan':'today';render();return;}
    if(a==='finish-cancel'){finishOpen=false;render();return;}
    if (a === "sync") {
      await sync();
      return;
    }
    if (a === "plan-week" || a === "plan-calendar") {
      planMode = a === "plan-week" ? "week" : "calendar";
      render();
      return;
    }
    if (a === "prev" || a === "next" || a === "today") {
      saveDrafts();date = a === "today" ? today() : L.add(date, a === "prev" ? -1 : 1);
      render();
      return;
    }
    if (a === "permissions") {
      const p = await Reminders.permissions();
      toast(p.display === "granted" ? "提醒已开启" : "未获得通知权限");
      await Reminders.schedule();
      return;
    }
    if (a === "logout") {
      await client.logout();
      render();
      return;
    }
    if (a === "export") {
      const json = JSON.stringify(state, null, 2);
      if (Capacitor.isNativePlatform()) {
        const f = await Filesystem.writeFile({
          path: "yixu-backup.json",
          data: btoa(unescape(encodeURIComponent(json))),
          directory: Directory.Cache,
        });
        await Share.share({ title: "一序备份", url: f.uri });
      } else {
        const url = URL.createObjectURL(
            new Blob([json], { type: "application/json" }),
          ),
          link = document.createElement("a");
        link.href = url;
        link.download = "yixu-backup.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }
    if (a.startsWith("conflict-")) {
      Sync.resolve(meta, state, id, a.endsWith("local") ? "local" : "remote");
      await persist();
      render();
      return;
    }
    const actions = {
      rest: () => run("rest.set", { rest: !state.restDays[today()] }),
      focus: () => run("focus.start", { id }),
      pause: () => run("focus.pause"),
      resume: () => run("focus.resume"),
      check: () => run("checkin.increment", { id,date }),
      "check-minus": () => run("checkin.increment", { id,date, delta: -1 }),
      "habit-done": () =>
        run(
          state.habits.find((h) => h.id === id)?.goal?.unit === "count"
            ? "goal.record"
            : "record.set",
          {
            id,date,
            status:
              state.records[date]?.[id]?.status === "done"
                ? "pending"
                : "done",
          },
        ),
      minimum: () => run("record.set", { id,date,status: "minimum" }),
      "habit-skip":()=>run("record.set",{id,date,status:"skipped"}),
      "entry-cycle": () => {
        const d = b.dataset.date || date,
          p = state.plans[L.week(d)],
          x = p.entries.find((x) => x.id === id);
        return run("plan.entry.save", {
          ...x,
          date: d,
          status:
            {
              pending: "done",
              done: "skipped",
              skipped: "pending",
              blocked: "pending",
            }[x.status] || "pending",
        });
      },
      "event-cycle": () => {
        const x = R.expand(state.events, date, date,state).find((x) => x.id === id);
        return run("event.save", {
          ...x,
          status: x.status === "done" ? "pending" : "done",
        });
      },
      "event-delete": () => run("event.archive", { id }),
      "entry-delete": () => run("plan.entry.delete", { id, date }),
      "task-delete": () => run("plan.task.delete", { id, date }),
      "task-plus": () => run("plan.task.record", { id, date, delta: 1 }),
      pick: () =>
        run("plan.pick", {
          taskId: id,
          date,
          day: date,
          category: b.dataset.category,
        }),
      chain: () =>
        change((s) => {
          s.chains.find((x) => x.id === id).done = true;
        }),
      "learn-done": () => run("learning.save", { id, status:state.learning.find(x=>x.id===id)?.status==='done'?'later':'done' }),
    };
    if (a === "note-edit" || a === "learning-edit") {
      const kind = a.split("-")[0],
        x = (kind === "note" ? state.notes : state.learning).find(
          (x) => x.id === id,
        ),
        f = root.querySelector('[data-form="' + kind + '"]');
      f.dataset.id = id;f.closest("details").open=true;
      for (const name of ["title", "url", "body"])
        if (f.elements[name]) f.elements[name].value = x[name] || "";
      f.querySelector(".editor").innerHTML = textBody(x.body || "");
      hydrateImages();
      saveDrafts();f.scrollIntoView({ behavior: "smooth",block:"start" });
      return;
    }
    if (a === "task-edit") {
      const t = state.plans[L.week(date)].tasks.find((t) => t.id === id),
        article = b.closest("article");
      article.dataset.editing="true";article.innerHTML = `<form data-form="task-edit" data-id="${id}"><input name="title" value="${esc(t.title)}" required><label>一周几次<input name="target" type="number" min="1" max="100" value="${t.target}"></label><textarea name="note" placeholder="进展和原因">${esc(t.note)}</textarea><button class="primary">保存修改</button></form>`;
      return;
    }
    if (a === "finish") {finishOpen=true;render();return;}
    if (a.endsWith("-delete") && !actions[a])
      await run(a.split("-")[0].replace("check", "checkin") + ".archive", {
        id,
      });
    else if (actions[a]) await actions[a]();
    await Reminders.schedule();
    render();
    if(a==='pick'){const section=[...root.querySelectorAll(".plan-category")].find(x=>x.querySelector("form")?.dataset.category===b.dataset.category);if(section){section.open=true;section.scrollIntoView({behavior:"smooth",block:"center"});}}
  } catch (error) {
    toast(error.message);
  }
});
root.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    a = Object.fromEntries(new FormData(f)),
    kind = f.dataset.form;
  if(f.dataset.saving)return;f.dataset.saving="true";const submit=e.submitter;if(submit)submit.disabled=true;
  try {
    if (busy) throw Error("正在同步，请稍候再保存");
    if (kind === "cloud") {
      const cfg = Cloud.validate(a),
        session = await getAuth();
      client = Cloud.client(cfg, session, saveAuth);
      if (e.submitter.value === "signup") {
        await client.signup(a.email, a.password);
        toast("注册已提交，请查看邮箱确认后登录");
        return;
      }
      const user = await client.login(a.email, a.password);
      if (meta.owner && meta.owner !== user.id) {
        await client.logout();
        throw Error("本机已绑定其他账号，请先导出并清空数据再切换");
      }
      meta.owner = user.id;
      Object.assign(config, cfg);
      if (!meta.seeded) {
        Sync.capture(meta, {}, { ...state });
        meta.seeded = true;
      }
      await persist();
      await sync();
      return;
    }
    if(kind==='hook-source'){await run('hook.source.save',{source:mobileHookSource.source,body:a.body,expected:f.dataset.expected});page='plan';planMode='week';render();toast('原记录已保存');return;}
    if(kind==='lan-pair'){await Local.pair(a.address,a.code);render();toast(Local.lanOnline?'已连接电脑，之后自动同步':Local.lanError);return;}
    if(kind==='habit-record'){await run('habit.record',{id:f.dataset.id,date,note:a.note,elapsedMinutes:Number(a.elapsedMinutes||0)});f.elements.elapsedMinutes.value='';delete f.dataset.dirty;render();toast('已记录');return;}
    if (kind === "journal") await run("journal.save", { date, body: a.body });
    if (kind === "note" || kind === "learning") {
      if (kind === "learning" && !safeURL(a.url))
        throw Error("请输入有效的网页链接");
      await run(kind + ".save", {
        ...a,
        id: f.dataset.id || undefined,
        title: a.title || a.url,
      });
    }
    if (kind === "habit" || kind === "checkin") {
      const times = (a.times || "").split(/[,，\s]+/).filter(Boolean);
      if (times.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))
        throw Error("提醒时间格式应为09:00");
      const existing=(kind==='habit'?state.habits:state.checkins).find(x=>x.id===f.dataset.id);
      const recurrence = {
        kind: a.repeat === "selectedDays" ? "weekdays" : a.repeat === "weekdays" ? "workdays" : a.repeat === "interval" ? "interval" : "daily",
        days:new FormData(f).getAll("repeatDays").map(Number),
        interval: a.repeat === "interval" ? 2 : 1,
        start: today(),
      };
      await run(kind + ".save", {
        id:f.dataset.id||undefined,title: a.title,
        target: kind === "checkin" ? Number(a.amount) : existing?.target||1,
        minutes: kind === "habit" ? Number(a.amount) : 20,
        time: a.time || "",
        times,
        recurrence:a.repeat==='keep'?existing?.recurrence:R.normalize(recurrence,today()),
        workdaysOnly: a.repeat==='keep'?!!existing?.workdaysOnly:a.repeat === "weekdays",
        minimum: a.minimum || "",
        afterAction: a.afterAction || "",
        before: a.before || "",
        after: a.after || "",
        goal:a.repeat==='keep'?(existing?.goal?{...existing.goal,target:Number(a.goal)}:null):null,
        ...(a.repeat === "weekly" || a.repeat === "minutes"
          ? {
              goal: {
                period: "week",
                unit: a.repeat === "weekly" ? "count" : "minutes",
                target: Number(a.goal),
              },
            }
          : {}),
      });
    }
    if (kind === "event") {
      await run("event.save", {
        date,
        title: a.title,
        recurrence: R.normalize(
          a.repeat === "none"
            ? null
            : {
                kind: a.repeat === "selectedDays" ? "weekdays" : a.repeat === "two" ? "interval" : a.repeat,
                days:new FormData(f).getAll("repeatDays").map(Number),
                interval: 2,
                start: date,
              },
          date,
        ),
      });
    }
    if (kind === "entry")
      await run("plan.entry.save", {
        date,id:f.dataset.id||undefined,
        category: f.dataset.category,
        title: a.title,
      });
    if (kind === "task-edit")
      await run("plan.task.save", {
        id: f.dataset.id,
        date,
        title: a.title,
        target: Number(a.target),
        note: a.note,
      });
    if (kind === "task") {
      const t = await run("plan.task.save", {
        date,
        title: a.title,
        target: Number(a.target),
      });
      await change(() => {
        t.category = a.category;
      });
    }
    if (kind === "finish")
      await run("focus.finish", {
        note: a.note,
        complete: a.complete === "on",
      });
    await Reminders.schedule();
    const draftKey=kind==='journal'?'journal:'+date:kind;
    delete drafts[draftKey];await put('drafts',drafts);
    if(kind==='journal'){document.querySelector('#journal-save-status').textContent='已保存本机';}
    else {f.closest('[data-editing]')?.removeAttribute('data-editing');f.reset();delete f.dataset.id;if(f.querySelector('.editor'))f.querySelector('.editor').innerHTML='';const details=f.closest('details');if(details)details.open=false;}
    const goal=f.querySelector(".weekly-goal");if(goal)goal.hidden=true;if(f.elements.repeat){f.elements.repeat.querySelector('[value=keep]')?.remove();f.elements.repeat.value='daily';}const selectedDays=f.querySelector('.phone-repeat-days');if(selectedDays)selectedDays.hidden=true;
    if(kind==='finish')finishOpen=false;
    render();toast('已保存');
  } catch (error) {
    toast(error.message);
  } finally {delete f.dataset.saving;if(submit)submit.disabled=false;}
});
root.addEventListener("change", async (e) => {
  try {
    if(e.target.name==='repeat'){const days=e.target.closest('form').querySelector('.phone-repeat-days');if(days)days.hidden=e.target.value!=='selectedDays';const goal=e.target.closest('form').querySelector('.weekly-goal');if(goal)goal.hidden=!['weekly','minutes'].includes(e.target.value);}
    if (e.target.id === "date") {
      saveDrafts();date = e.target.value;
      render();
    }
    if (e.target.dataset.imageTarget && e.target.files[0])
      await attach(e.target.files[0], e.target.dataset.imageTarget);
    if (e.target.hasAttribute("data-import") && e.target.files[0]) {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.habits) || !data.journals)
        throw Error("请选择一序JSON备份");
      root.querySelector("#content").innerHTML =
        `<article><h2>确认导入</h2><p>${data.habits.length} 个习惯，${Object.keys(data.journals).length} 篇日记。导入会替换手机本机数据，原数据会自动备份。</p><button id="confirm-import" class="primary">备份当前数据并导入</button></article>`;
      document.querySelector("#confirm-import").onclick = async () => {
        await put("pre-import-backup:" + Date.now(), state);
        await replaceImported(data);
        await Reminders.schedule();
        render();
        toast("导入完成");
      };
    }
  } catch (error) {
    toast(error.message);
  }
});
let draftTimer;
root.addEventListener("input", (e) => {
  if(e.target.id==='notes-search'){notesQuery=e.target.value;render();return;}
  const habitRecord=e.target.closest('form[data-form=habit-record]');if(habitRecord)habitRecord.dataset.dirty='true';if(e.target.closest('form'))saveDrafts();
  if (e.target.id === "journal-body") {
    const d = date,
      body = e.target.value;
    clearTimeout(draftTimer);
    const status=document.querySelector('#journal-save-status');if(status)status.textContent='正在保存…';
    draftTimer = setTimeout(async () => {
      try{await run('journal.save',{date:d,body});if(page==='records'&&recordTab==='journal'&&date===d)refreshJournalActions();if(drafts['journal:'+d]?.body===body){delete drafts['journal:'+d];await put('drafts',drafts);}if(page==='records'&&date===d){const status=document.querySelector('#journal-save-status');if(status)status.textContent='已保存本机';}}catch(error){toast(error.message);}
    }, 500);
  }
});
await openStore();
await load();
drafts=await get("drafts")||{};
const auth = await getAuth();
if (config.url && config.key) client = Cloud.client(config, auth, saveAuth);
await Reminders.setup((error,kind) => {
  if (error) toast(error);if(kind==='habit')page='habits';if(kind==='checkin')page='checkins';
  render();
});
await Local.loadLan(()=>{if(!document.activeElement?.matches('input,textarea,[contenteditable=true]')){render();const f=root.querySelector('form[data-form=journal]');if(f&&!drafts['journal:'+date]){f.elements.body.value=state.journals[date]?.body||'';f.querySelector('.editor').innerHTML=textBody(f.elements.body.value);hydrateImages();}}else hydrateImages();});
render();
setInterval(tick, 1000);
setInterval(()=>{if(document.visibilityState==='visible')Local.synchronizeLan();},5000);
Local.synchronizeLan();
if (Capacitor.isNativePlatform()) {
  App.addListener("appStateChange", async ({ isActive }) => {
    if (isActive) {
      tick();
      await Reminders.schedule();
      await handleShare();
      Local.synchronizeLan();
    } else {
      clearTimeout(draftTimer);
      const editor = document.querySelector("#journal-body");
      if (editor) await run("journal.save", { date, body: editor.value });
    }
  });
}
await Reminders.schedule();

async function handleShare() {
  try {
    const shared = await native.readSharedURL();
    const url = shared.url?.match(/https?:\/\/[^\s]+/)?.[0];
    if (url && safeURL(url)) {
      page = "records";
      recordTab = "notes";
      render();
      const form=root.querySelector('form[data-form="note"]');form.closest("details").open=true;form.elements.title.value='分享的内容';form.elements.body.value=url;form.querySelector('.editor').textContent=url;saveDrafts();form.scrollIntoView({behavior:"smooth",block:"start"});
      toast("分享的网址已放入，添加笔记后保存");
    }
  } catch {}
}
if (Capacitor.isNativePlatform()) await handleShare();

setInterval(() => {
  if (document.visibilityState === "visible" && client?.session.user)
    sync(true);
}, 60000);

// The keyboard gets the space usually reserved for navigation while writing.
let expandedViewportHeight=window.visualViewport?.height||window.innerHeight,expandedViewportWidth=window.innerWidth;
function keyboardLayout(){const height=window.visualViewport?.height||window.innerHeight;if(window.innerWidth!==expandedViewportWidth){expandedViewportWidth=window.innerWidth;expandedViewportHeight=height;}expandedViewportHeight=Math.max(expandedViewportHeight,height);const editing=document.activeElement?.matches('input:not([type=checkbox]),textarea,[contenteditable=true]');document.body.classList.toggle('keyboard-open',!!editing&&expandedViewportHeight-height>150);}
window.visualViewport?.addEventListener('resize',keyboardLayout);
document.addEventListener('focusin',keyboardLayout);document.addEventListener('focusout',()=>setTimeout(keyboardLayout,0));
window.addEventListener('orientationchange',()=>setTimeout(()=>{expandedViewportHeight=window.visualViewport?.height||window.innerHeight;keyboardLayout();},250));

function connectionView(){const c=Local.connection,m=Local.lanMeta;return `<section class="phone-intro"><span class="eyebrow">一序 · 随身记录本</span><h2>手机记下，电脑接着做。</h2><p>周计划、打卡、习惯、日记和便笺。记录先保存本机，连接后自动同步。</p></section><article class="lan-card"><div class="section-title"><h2>连接电脑</h2><span class="status-tag ${Local.lanOnline?'is-done':''}">${Local.lanOnline?'局域网已连接':c?'等待电脑':'尚未配对'}</span></div>${c?`<strong>${esc(c.name)}</strong><small>${esc(c.url)}</small><p class="muted">${m.lastSync?'最近同步 '+new Date(m.lastSync).toLocaleTimeString():'正在准备同步'} · 手机在前台时每 5 秒自动检查</p>${Local.lanError?`<p class="sync-error">${esc(Local.lanError)}，本机记录保留。</p>`:''}<div class="form-actions">${button('立即检查','sync','','class="primary"')}${button('断开电脑','lan-disconnect')}</div>`:`<p>先在电脑一序「设置 → 手机 · 局域网自动同步」点击配对手机。</p>${button('寻找同一 Wi-Fi 的电脑','lan-discover','','class="secondary"')}<form data-form="lan-pair"><label>电脑地址<input name="address" list="lan-computers" type="url" placeholder="http://192.168.1.10:47931" value="${esc(foundComputers[0]?.url||'')}" required autocomplete="off"></label><datalist id="lan-computers">${foundComputers.map(s=>`<option value="${esc(s.url)}">${esc(s.name)}</option>`).join('')}</datalist><label>电脑上的 8 位配对码<input name="code" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required placeholder="仅首次配对需要"></label><button class="primary">配对并同步</button><small>发现不到电脑时可以手动填写地址。之后 IP 变化时安卓会自动寻找同一台电脑。</small></form>`}</article>${Object.entries(m.conflicts||{}).map(([key,c])=>`<article class="lan-conflict"><h3>两端都修改了这条记录</h3><small>${esc(key)}</small><p>手机：${esc(c.local?.body||c.local?.title||JSON.stringify(c.local))}</p><p>电脑：${esc(c.remote?.body||c.remote?.title||JSON.stringify(c.remote))}</p><div class="actions">${button('保留手机','lan-resolve',key,'data-choice="local"')}${button('采用电脑','lan-resolve',key,'data-choice="remote"')}</div></article>`).join('')}<article><h2>数据与备份</h2><div class="backup-actions">${button('导出本机备份','export')}<label class="file-button">导入备份<input type="file" data-import accept="application/json" hidden></label></div><small>离开局域网仍可使用；电脑退出或休眠时暂停同步，重新连接后继续。</small></article>`;}
function checkinsView(){const hs=state.checkins.filter(h=>h.enabled&&R.matches(h.recurrence,date,undefined,state)&&(!h.workdaysOnly||L.isWorkday(state,date))),complete=hs.filter(h=>{const r=state.checkinRecords[date]?.[h.id];return r?.count>=(r?.target||h.target)}).length;return `${dateNav()}<div class="compact-summary"><b>${complete}<span> / ${hs.length}</span></b><div>这一天的打卡<small>完成目标算一个项目，喝水 8 次也算一项</small></div></div><article class="list-card">${hs.map(h=>{const r=state.checkinRecords[date]?.[h.id],count=r?.count||0,target=r?.target||h.target||1;return `<div class="row checkin-card" data-key="check:${h.id}"><div class="row-copy"><strong>${esc(h.title)}</strong><small>${esc((h.times||[]).join(' · ')||'随时记一次')}</small>${h.before||h.after?`<small>${esc([h.before,h.after].filter(Boolean).join(' → '))}</small>`:''}<div class="progress-track"><i style="width:${Math.min(100,count/target*100)}%"></i></div></div><div class="checkin-controls"><span class="checkin-count"><b>${count}</b> / ${target}</span>${button('−','check-minus',h.id,'aria-label="撤销一次"')}${button(count>=target?'✓':'＋','check',h.id,`class="primary" ${count>=target?'disabled':''} aria-label="记录一次"`)}${more(button('编辑','checkin-edit',h.id)+button('移除','check-delete',h.id))}</div></div>`;}).join('')||empty('这一天没有打卡项目。添加一个喝水、走动或其他小提醒。')}</article>${habitForm('checkin')}`;}
function habitsView(){const hs=state.habits.filter(h=>h.enabled),rest=!!state.restDays[date];return `${dateNav()}${rest?'<div class="rest-banner">这一天主动休息，连续记录不会中断。</div>':''}<div class="section-title"><h2>行动与收获</h2><small>${hs.length} 个习惯</small></div>${hs.map(h=>{const r=state.records[date]?.[h.id],x=Streaks.calculate(state,h.id,today()),w=h.goal?L.weekly(state,h,date):null,done=['done','minimum'].includes(r?.status);return `<article class="phone-habit" data-key="habit:${h.id}"><div class="section-title"><h3>${esc(h.title)}</h3>${more(button('编辑习惯','habit-edit',h.id)+button('清除当天记录','habit-clear',h.id)+button('移除习惯','habit-delete',h.id))}</div><div class="habit-badges"><span>连续 ${x.current} 天</span><span>最长 ${x.longest} 天</span>${w?`<span>本周 ${w.value} / ${w.target} ${w.unit==='minutes'?'分钟':'次'}</span>`:''}</div>${h.time?`<small>提醒 ${h.time} · ${h.minutes||20} 分钟</small>`:''}<div class="habit-choice">${button(w?.unit==='count'?'记录一次':done?'已完成 ✓':'完成','habit-done',h.id,`class="${done?'primary':'secondary'}"`)}${button('最低版','minimum',h.id,`class="${r?.status==='minimum'?'chosen':''}"`)}${button('跳过','habit-skip',h.id,`class="${r?.status==='skipped'?'chosen':''}"`)}</div>${h.minimum?`<small>最低版：${esc(h.minimum)}</small>`:''}<details class="habit-note" ${r?.note?'open':''}><summary>${r?.note?'查看与修改收获':'留一句收获 / 补记时长'}</summary><form data-form="habit-record" data-id="${h.id}"><textarea name="note" placeholder="今天的收获、原因或下一步…">${esc(r?.note||'')}</textarea><label>追加记录分钟（选填）<input name="elapsedMinutes" type="number" min="0" max="1440" placeholder="0"></label><button>保存记录</button></form></details></article>`;}).join('')||empty('创建一个小习惯，也可以先从最低版开始。')}${habitForm('habit')}`;}
