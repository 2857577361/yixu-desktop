---
name: yixu
description: 操作一序桌面 App 的周计划、生活月历、独立打卡、阅读器、计时习惯、专注、日记和便笺，通过 CLI 读写共享本地数据，并将每日记录同步到语雀。用户提到一序、记录习惯、写日记、桌面便笺或使用一序同步语雀时使用。
---

# 一序

程序目录：`<项目目录>`。
先运行 `yixu today` 或 `yixu state` 查看现有记录和真实 ID，再修改。
若 PATH 没有 yixu，使用 `<项目目录>`。

`yixu --help` 列出操作。CLI 成功返回 JSON，失败返回错误并以非零状态退出。桌面每五秒读取更新；正在编辑的文本不会因刷新而丢失。

## 工作计划与生活月历

周计划、生活月历、固定作息分别保存。周计划使用 `plans[周一].entries`，固定为工作、学习、读书、运动、备忘五类；生活月历使用 `events`；固定作息使用 `timetable`。旧版生活周计划在首次读取周计划时一次性合并，原始 `lifePlans` 保留为备份。不要把用户提供的历史范例当作当前真实安排。

- `plan.get`：date（周内任一天），返回以周一为首的七天、工作每日安排、整体 tasks、周报与 revision。
- `plan.save`：date、reporter、overview、progress、risks、nextWeek、cognition、expected（读取的计划 revision）。只传要改的字段；新周 expected 为空。
- `plan.task.save`：date、title、status（pending/done/blocked）、note；修改带 id 和 expected（任务 revision）。
- `plan.task.delete`：date、id、expected（任务 revision），永久删除整体任务。已选入表格的事项保留为独立事项。
- `plan.entry.save`：date、title、category（固定五类之一）、status（pending/done/skipped）。修改带 id、week（周一）、date 和 expected（事项 revision）。表格勾选依次为待办、完成、未完成；整体任务仍可用 blocked 受阻。
- `plan.entry.delete`：date、id、expected（事项 revision），永久删除表格事项，不删除来源整体任务。
- `plan.entry.archive`：date（周内日期）、id，移除一条工作安排。
- `week.export`：date，返回周计划 Markdown，保留七天表格、整体计划、任务进展、风险同步、下周计划、认知迭代。
- `week.sync`：date，将该周工作周报同步成独立语雀文档；不包含生活月历。
- `calendar.list`：month（YYYY-MM），只读生活事项。
- `event.save`：生活事项的 date、title、category、time、color、status、note；编辑带 id、expected（事项 revision），不能关联工作计划任务。`event.archive` / `event.restore` 传 id。
- `habit.save` 另支持 target（每日目标 1—1000）、unit（最多 10 字）、priority（0 普通、1 中、2 高）。仍需 minutes 和 days。
- `record.increment` 是旧习惯计次记录，只操作习惯。新的即时打卡用 `checkin.increment`。

`sync` 每日页包含生活事项、习惯、日记和专注；`week.sync` 是工作周报。自动同步队列也区分两者。

## 常用操作

- `review`：可选 date，返回截至该日的七天逐习惯记录、跳过原因和基于记录的建议。不把未记录视为失败。
- `journal.append`：date、body，原子追加到日记，适合追加学习笔记，保留已有正文。
- `note.restore`：id，恢复收起的便笺。
- `sync.pending`：重试当前知识库的待同步日期，遇到冲突保留双方。
- `today`：今天的安排、完成情况、每日一句。
- `state`：习惯、日记、便笺、计时与设置。不要把无关私人日记全文输出到聊天。
- `habit.save`：新增或更新习惯。参数包含 title、minutes（1—240）、time（HH:mm 或空）、days（0 为周日，1—6 为周一至六）、minimum、url、cue（触发场景）、reward（完成奖励）、nextStep（下次学习起点）；更新带 id。更新前保留其他字段。
- `habit.archive`：停用习惯。恢复用 habit.save 指定 id 和 enabled:true。
- `record.set`：id、status（done/minimum/skipped/pending）、可选 date、note 和 reason（例如时间冲突、任务太大、精力不足、主动休息）。pending 撤销打卡。
- `journal.save`：date、body、mood、expected。expected 使用读取的 updatedAt；新日记传空字符串，避免覆盖并发编辑。用户要求追加时先读原文再拼接。
- `note.save`：body、color（sand/sage/rose/blue）。编辑指定 id、expected（旧 updatedAt）。收起使用 note.archive，恢复用 note.save。
- `focus.start`：习惯 id，或 title 与 minutes；同一时间只能有一个计时。focus.pause、focus.resume、focus.finish；结束时 complete:true 才打卡，note 留下收获，nextStep 保存下次起点。focus.start 传 mode:"minimum" 开始两分钟，确认完成后记为 minimum。
- `settings.save`：book（用户名/知识库标识）、autoSync。避免在 CLI 更改 launchAtLogin，系统登录项要在桌面设置中操作。
- `books`：只读获取可用语雀个人知识库。
- `sync`：可选 date；将指定日期的习惯、已结束专注和日记写入已选知识库。便笺只保留本地。

参数可以传一个 JSON 对象；多行内容优先写到临时 JSON 文件，用 `yixu journal.save --file /绝对路径/参数.json`，避免 shell 转义破坏内容。

## 行为边界

只在用户表示完成时打卡，不把打开网页或计时到点当作完成。时间不明确时保留空时间，或询问，不擅自填满日程。
sync 会修改语雀中的应用专用每日文档；用户请求同步时执行。若云端内容冲突，保留双方并告知，不强制覆盖；认证或权限错误停止重试。
无需读取或输出 Token，CLI 自动读取既有本地语雀授权。桌面提醒依赖 App 正在运行；电脑睡眠和应用退出时不能实时提醒。
测试时设 `YIXU_DATA_DIR` 为隔离目录，不污染真实日记、习惯或打卡数据。

自动同步开启且桌面运行时，会处理 CLI 和桌面写入产生的持久化队列。网络失败最多自动尝试三次，权限错误与云端冲突暂停，用户可手动 sync.pending。未开启自动同步时只有显式 sync 才上传。

## Carry work forward

`plan.carry` accepts `date` within the source week. It copies unfinished overall work tasks to the next week, preserves the original week and notes, and deduplicates by source task ID. It never copies daily entries or life events. Use when the user requests carrying work forward.

## 图文与标注修改（0.16）

- 日记、便笺和学习笔记直接显示图片；底层 body 仍兼容 Markdown，图片可带可选标题 `"width=320"` 保存本地显示宽度。不要删改图片 ID 或把本地路径当公网地址。
- `reader.note` 新增 type：highlight / excerpt / comment；省略时根据 body 推断。
- `reader.note.update`：id（书籍 ID）、noteId、type、body、color（yellow/green/pink）、expected（笔记 updatedAt 或 at）。保留原文、页码和选区；转换类型不抹掉已有想法。不猜测 noteId。
- 源笔记更新不会改写之前已经导入日记的副本。
- 网页登录态由桌面 Electron 独立会话保存，不读取其他浏览器 Cookie，也不输出凭据。不要调用内部上传接口手工传入用户凭据。

## 阅读计时与原文笔记（0.15）

- `reader.stats`：period（day/week/month/year，默认 week）、date（YYYY-MM-DD，默认今天）、可选 id（书籍 ID）；返回期间 seconds、终身 total、days、buckets、books 和 totals（日/周/月/年）。书籍内容在前台可见时自动计时，后台/锁屏/睡眠自动暂停。不要通过 CLI 伪造计时，也不要据此自动完成习惯。
- `reader.note` 可传 quote（选中原文，最多 12000 字）、body（评论，最多 10000 字）；至少一项非空，仍需 id/page。桌面选区另存 anchor 与 color 以恢复标注。CLI 不猜测选区偏移。
- `reader.note.delete`：id（书籍 ID）、noteId（现有笔记 ID）。永久删除源笔记，不删除之前导入日记的副本。
- 原文摘录保留在 reader.export 和 reader.toJournal 中；语雀同步仍遵循用户授权。PDF 原页支持鼠标选字、⌘C；无文字层的扫描 PDF 暂无 OCR。

## 阅读器与习惯配方（0.5）

- `reader.list` 返回书架 metadata；`reader.import` 传 path（绝对路径）。支持 PDF（最大 100 MB）、Markdown / UTF-8 TXT（最大 10 MB）。保存独立副本，按文件内容去重。不递归扫描用户目录或自动导入无关文件。
- `reader.progress`：id、page、total（可省略 total 使用已保存值）。`reader.bookmark`：id、page，切换该页书签。
- `reader.note`：id、page、body，追加阅读心得。`reader.export`：id，返回笔记 Markdown。
- `reader.toJournal`：id，仅将尚未导出过的新笔记追加到今天的日记，保留原文，重复执行不重复追加。开启日记自动同步时会进入语雀同步队列。原书文件不会上传。
- `reader.link`：id、habitId（空字符串取消关联）。阅读专注用 `focus.start` 传 readerId 和可选习惯 id；结束时 complete:true 才记一次习惯行动。readerId 不会自动解析关联习惯，CLI 应先读 reader.list 取得 habitId 再传 id。
- `reader.archive` / `reader.restore`：id，收起和恢复书架条目；不删除原始文件。
- `habit.save` 另支持 identity（期望的身份）、environment（环境准备）、backup（遇到阻碍的替代方案），每项最多 300 字。仍遵守已有 cue、minimum、reward 的含义。

不把翻到末页、打开文件或计时到点当作用户已读完／已完成。PDF 文字检索与阅读在桌面内进行；`reader.content` 会返回原书数据，普通操作无需调用或向聊天输出整本书。

## 直接表格操作与固定作息（0.6）

- `plan.*`、`week.export`、`week.sync` 默认操作唯一的周计划，不要指定 `scope:"life"`。旧版 life 数据保留供回溯，不再作为新计划入口。
- `plan.get` 的 categories 固定为工作、学习、读书、运动、备忘。不要调用 `plan.category.add`；在这五类中选择分类。
- `plan.pick`：scope、date（所在周任意日期）、day（目标日期）、category、taskId。直接将整体任务内容选入某个格子，同一来源在同一格子重复选择会去重。选入后可独立修改，不是必须维护的关联字段。不要要求用户重复填写标题／日期／分类等已经由格子确定的信息。
- `timetable.get`：固定每周作息表。它不按日期重建，不自动创建月历日程，不自动打卡或提醒。
- `timetable.row.save`：start、end（HH:mm，开始早于结束，不能重叠）、label。修改带 id 和 expected（行 revision）。
- `timetable.cell.save`：row（行 ID）、day（0 周日，1—6 周一至周六）、body、expected（该格旧 revision；新格传空字符串）。
- `timetable.row.archive` / `timetable.row.restore`：id，收起／恢复时间段，保留格内文字。

桌面常用操作已改为直接输入和勾选；详细设置保留弹窗。遵循用户要求，新增功能优先采用就地编辑，不再把完成状态切换设计成填写表单。

## 循环事项与重复打卡（0.8）

`event.save` 和 `habit.save` 支持 `recurrence: {kind: "daily" | "interval" | "weekly", interval: 2, start: "YYYY-MM-DD", until: ""}`。daily 每天；interval 每隔 1—365 天，按 start 算起；weekly 每周同一天；until 可留空。习惯 recurrence 为 null 时沿用 days 星期数组，修改时不传 recurrence 保留旧规则。

日历按查询月份动态展开，不预先写入无限事项。先用 `calendar.list` 取当天实例的 id/revision，修改或归档这个 id 只影响当天。实例有 seriesId；`event.series.stop {id: seriesId, date: "YYYY-MM-DD"}` 从该天起停止未记录的后续实例，已单独记录的实例保留。不要用系列 ID 将整组标为完成。`state` 默认只展开今天前 35 天至后 42 天，查其他月份用 calendar.list。

## 独立打卡与删除（0.9）

习惯继续使用 `habits`、`records` 和计时。打卡另有 `checkins`、`checkinRecords`、`checkinReminders`，从不把打卡写进习惯记录。`checkin.save` 接受 title、target（1—100）、times（HH:mm 数组）、before、after、recurrence；修改带 id/expected。`checkin.increment` 使用 id、date、delta=1/-1。`checkin.delete` 永久删除项目和次数记录。添加喝水、起身这类即时动作时使用 checkin；学习和运动计时仍使用 habit。

`note.delete`、`habit.delete` 是永久删除；`event.delete` 删除一天，`event.series.delete` 删除整组循环。操作用户现有记录前先读取真实 ID，并区分「收起 / 暂停」与永久删除。

## 今天、稍后学习、图片与按周目标（0.14）

- `rest.set`：date、rest（默认 true）、note。整天主动休息，停止该日待办提醒，已有记录保留；rest:false 恢复安排。不要批量把事项设为 skipped 来模拟休息。
- `holiday.set`：date、kind（holiday/work/default）。包含中国大陆 2026 年官方放假与补班，default 恢复内置规则；其他年份按星期或用户指定日期，不能宣称自动包含未来年度节假日。
- `habit.save` 另支持 `goal:{period:"week",unit:"count"|"minutes",target:3}`、workdaysOnly、skipHolidays、afterAction。goal:null 恢复旧固定周期。只传要改的字段，保留原有习惯设置。
- `goal.record`：id、可选 date。次数目标传 delta:1/-1；分钟目标传 minutes（1—1440）。读取 `review.weeklyGoals` 查看每周进度、最低版、休息天数。计时分钟来自已结束专注，补记前避免重复计算同一段时间。
- `alert.act`：id、operation（start/complete/snooze/dismiss）。先读 state.alerts 的真实 ID；习惯可开始专注或完成，打卡 complete 记一次，专注 complete 确认结束，snooze 延后十分钟。同一条提醒重复操作不会重复记入。
- `chain.dismiss`：id，略过提示。下一步只提示，不擅自替用户完成；用户明确开始才调用 focus.start 等操作。
- `plan.entry.move`：date（所在周）、id、expected（事项 revision）、to（本周目标日期）、category（固定五类）、copy（默认 false）。copy:true 生成独立待办副本。
- `learning.list`：读取已保存的网页条目，不会自动访问网页。
- `learning.save`：url、title、body、summary、reflection、status（later/learning/done）。修改传 id 和 expected（revision）；未改动不会产生新版本。网页仅允许 http/https，不允许含账号密码的 URL。
- `learning.export`：id，返回完整 Markdown；`learning.toJournal`：id、date，追加到日记，同一版本不会重复。要同步语雀，先汇入日记，再按用户授权执行 sync。
- `learning.delete`：id，永久删除学习条目，不删除已经汇入的日记。
- `image.import`：path（用户指定图片绝对路径）或 base64，返回 id 与 `![图片](yixu-image:...)` Markdown；写入 journal.save/note.save/learning.save 的 body。PNG/JPEG/GIF/WebP，最多 15 MB。`image.read` 返回 dataURL，仅在需要显示时调用，不把整段 base64 输出给用户。
- 0.16 起图文同步采用独立的语雀网页登录会话上传图片，再以 Token 保存文档。用户需要在桌面「设置与连接 → 登录语雀」登录同一个账号。上传失败保留整篇本地内容和待同步队列，不再把图片替换为说明。CLI 没有网页会话，含本地图片的 sync 会提示转到桌面同步；CLI 写入及已有纯文字同步不变。桌面“导出图文”仍可离线生成内嵌图片 HTML。实际返回成功前，不说图片已同步。
- `review.adjust`：date（调整适用周内日期）、body；只保存该周一件调整。
- `review.taskDecision`：date（源周）、id（整体任务）、decision（split/reschedule/continue/abandon）。split 传 titles（每行一个步骤）；reschedule 传 to 日期与 category，会放入目标周表；continue 延续整体任务到下周，保留来源；abandon 移除整体任务，已有表格记录保留。先读任务再执行，不自动放弃用户事项。

桌面 0.26 / 安卓 0.3 支持同一局域网首次配对后自动同步，手机在前台每 5 秒检查；电脑必须运行且未休眠。手机以周计划、打卡、习惯、日记、便笺的查看和记录为主，配对与边界见 docs/mobile-pocket-0.3.md。语雀文档同步仍不是多设备数据同步，阅读数据与凭据不通过局域网交换。

## 周任务联动与回顾明细（0.17）

- plan.task.save 支持 target（1—100，每周目标次数，默认 1）。title 修改同步到来源表格安排；表格完成/撤销/删除/收起会重新计算 completed 和 status。整体目标可随时调整，已有完成次数保留。
- plan.pick 来源始终保留。一周一次只安排一条活动实例；多次任务可跨天安排，repeat:true 允许在同一格明确新增一次，否则同格去重。
- plan.task.record：date、id、delta（1/-1）、expected，增加/撤销未安排到表格的手动补记；不撤销表格勾选。读取最新 task revision 后修改。
- plan.carry 把未完成任务的剩余目标带到下周，不复制原周计数。
- review 返回 sessions、daily（records/sessions/checkins）与 habits[].seconds/sessions，包含历史暂停习惯与专注心得、nextStep。主动休息保留 actualStatus，不把未记录作为失败。
