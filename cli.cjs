#!/usr/bin/env node
const fs=require('node:fs');
const core=require('./core.cjs');
async function main(){
 const [action,...args]=process.argv.slice(2);
 if(!action||['--help','help'].includes(action)){console.log(`一序 CLI — 所有结果为 JSON，与桌面共享数据。
用法：yixu <操作> [JSON对象] 或 yixu <操作> --file 参数.json

手机备份：backup.export {"path":"/绝对路径/yixu-backup.json"} | cloud.status
读取：state | today | review {"date":"YYYY-MM-DD"}
习惯：habit.save {"title":"阅读","time":"09:50","minutes":20,"days":[0,1,2,3,4,5,6]}
      habit.archive {"id":"..."}
周计划（工作、学习、读书、运动、备忘五类，独立于月历）：
      plan.pick {"date":"周内日期","day":"目标日期","category":"读书","taskId":"整体任务ID"}
      plan.carry {"date":"YYYY-MM-DD"} (carry unfinished work to next week, deduplicated)
      plan.get {"date":"YYYY-MM-DD"}
      plan.save {"date":"YYYY-MM-DD","reporter":"填写姓名","progress":"任务进展","risks":"风险","nextWeek":"下周计划","cognition":"认知迭代","expected":"旧revision"}
      plan.task.save {"date":"YYYY-MM-DD","title":"整体工作任务","target":3,"status":"pending|done|blocked"}
      plan.task.delete {"date":"周内日期","id":"...","expected":"任务revision"}
      plan.entry.save {"date":"YYYY-MM-DD","title":"每日工作安排","category":"工作","status":"pending|done|skipped"}
      plan.entry.delete {"date":"周内日期","id":"...","expected":"事项revision"}
      plan.entry.archive {"date":"周内日期","id":"..."}
      week.export {"date":"YYYY-MM-DD"} | week.sync {"date":"YYYY-MM-DD"}
生活月历：calendar.list {"month":"YYYY-MM"}
      event.save {"date":"YYYY-MM-DD","title":"跑步","color":"sage","status":"pending"}
      event.archive {"id":"..."} | event.restore {"id":"..."}
旧习惯记录：record.increment / record.set 仅操作习惯，不操作独立打卡。
日记：journal.save {"date":"YYYY-MM-DD","body":"...","mood":"平静"}
追加日记：journal.append {"body":"...","date":"YYYY-MM-DD"}
恢复便笺：note.restore {"id":"..."}
待同步重试：sync.pending
便笺：note.save {"title":"标题","body":"...","collapsed":false,"color":"sand|sage|rose|blue"} | note.archive {"id":"..."}
专注：focus.start {"id":"..."} | focus.pause | focus.resume | focus.finish {"complete":true}
学习笔记：study.save {"title":"概念","body":"文字或图片 Markdown","tags":"Go 并发"}；修改带 id/expected（revision）
      study.review {"id":"...","mode":"known|again"} | study.archive / study.restore / study.toJournal {"id":"..."}
月历选项：calendar.info       {date:"2026-10-08"}
  milestone.list      {}
  milestone.save      {title:"旅行",date:"2026-12-01",kind:"countdown"}（kind 可选 birthday / anniversary；annual、calendar 可设置）
  milestone.delete    {id,expected}
  calendar.option.save {"title":"跑步","color":"blue"} | calendar.option.delete {"id":"..."}
稍后学习（url 可留空）：learning.list | learning.save {"url":"https://...","title":"文章","body":"笔记","summary":"总结","reflection":"下一步"}
      learning.export / learning.toJournal / learning.delete {"id":"..."}
      编辑 learning.save 带 id 和 expected（revision）；同步文字先汇入日记再 sync。
图片：image.import {"path":"/绝对路径/图片.png"} 返回本地图片 Markdown，写入日记/便笺正文；图文同步需在桌面设置中登录语雀。
每周目标：habit.save {"id":"...","goal":{"period":"week","unit":"count","target":3},"workdaysOnly":false,"skipHolidays":true,"afterAction":"留一句日记"}
      goal.record {"id":"...","delta":1} 或 {"id":"...","minutes":20}；次数支持 delta:-1。
休息：rest.set {"date":"YYYY-MM-DD","rest":true}；holiday.set {"date":"YYYY-MM-DD","kind":"holiday|work|default"}
直接提醒：alert.act {"id":"提醒ID","operation":"start|complete|snooze|dismiss"}
表格移动：plan.entry.move {"date":"源周日期","id":"事项ID","expected":"revision","to":"目标日期","category":"学习","copy":false}
周调整：review.adjust {"date":"下周日期","body":"只调整一件事"}
      review.taskDecision {"date":"源周日期","id":"整体任务ID","decision":"split|reschedule|continue|abandon","to":"目标日期","category":"学习","titles":"每行一个小步骤"}
提醒：reminder.snooze {"id":"..."}
语雀：books | sync {"date":"YYYY-MM-DD"}
固定作息：timetable.get
      timetable.row.save {"start":"09:50","end":"10:10","label":"资讯阅读"}
      timetable.cell.save {"row":"时间段ID","day":1,"body":"AI 资讯","expected":"旧revision"}
      timetable.row.archive {"id":"..."} | timetable.row.restore {"id":"..."}
阅读器：reader.list
      reader.import {"path":"/绝对路径/书籍.pdf"} （PDF / MD / UTF-8 TXT）
      reader.progress {"id":"...","page":2,"total":100}
      reader.bookmark {"id":"...","page":2}
      reader.note {"id":"...","page":2,"quote":"选中的原文","body":"阅读心得"}
      reader.note.delete {"id":"书籍ID","noteId":"笔记ID"}
      reader.note.update {"id":"书籍ID","noteId":"笔记ID","type":"highlight|excerpt|comment","body":"想法","expected":"updatedAt或at"}
      reader.stats {"period":"day|week|month|year","date":"YYYY-MM-DD","id":"可选书籍ID"}
      reader.link {"id":"...","habitId":"..."}
      reader.export {"id":"..."} | reader.toJournal {"id":"..."}
      reader.archive {"id":"..."} | reader.restore {"id":"..."}
独立打卡：checkin.save {"title":"喝水","target":8,"times":["09:00","12:00"],"before":"坐下后","after":"添满水杯","recurrence":{"kind":"daily","start":"YYYY-MM-DD"}}；checkin.increment {"id":"...","date":"YYYY-MM-DD","delta":1}；checkin.delete 永久删除。
      habit.delete、note.delete、event.delete、event.series.delete 为永久删除；日历某一天的循环实例先查 calendar.list 取实例 ID。
循环：event.save / habit.save 支持 recurrence {kind:"daily"|"interval"|"weekly",interval:2,start:"YYYY-MM-DD",until:""}。
      event.series.stop {"id":"系列ID","date":"从此日期停止"}；修改日历当天使用 calendar.list 返回的实例 ID。
习惯配方：habit.save 另支持 identity、environment、backup。
设置：settings.save {"book":"用户名/知识库","autoSync":false}

旧习惯计次记录仍可用 record.increment 的 delta:-1 撤销；新的即时打卡请使用 checkin.increment。
习惯支持 cue（触发场景）和 reward（完成奖励）。focus.start 支持 mode:"minimum"（两分钟）。
更新习惯/便笺时带 id。日记/便笺可带 expected（旧 updatedAt）防止覆盖。
省略日期默认本地今天。YIXU_DATA_DIR 可指定独立数据目录。
应用运行时才能发出系统提醒；CLI 不常驻。sync 同步指定日期的习惯、生活日程、专注和日记；week.sync 单独同步工作周报，便笺保留本地。`);return;}
 const a=args[0]==='--file'?JSON.parse(fs.readFileSync(args[1],'utf8')):args[0]?JSON.parse(args.join(' ')):{};
 const result=action==='cloud.status'?require('./cloud.cjs').status():action==='backup.export'?{path:(()=>{if(!a.path)throw Error('请指定备份路径');fs.writeFileSync(a.path,JSON.stringify(core.read(),null,2),{mode:0o600});return a.path;})()}:action==='books'?await core.books():action==='sync'?await core.sync(a.date):action==='week.sync'?await core.sync(a.date,a.scope==='life'?'life-week':'week'):action==='sync.pending'?await core.flushSync(true):core.run(action,a);
 console.log(JSON.stringify(result??{ok:true},null,2));
}
main().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
