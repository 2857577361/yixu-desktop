import RecordLinks from "../../shared/record-links.cjs";
import Hooks from "../../shared/hooks.cjs";
import CloudConfig from '../../shared/cloud-config.json';
import Planner from "../../planner.cjs";
import Sync from "../../shared/sync-model.cjs";
import Streaks from "../../shared/habit-streaks.cjs";
import R from "../../ui/recurrence.js";
import L from "../../ui/life-model.js";
import { get, putMany } from "./store.js";
export { Sync, R, L, Planner };
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const uid = () => crypto.randomUUID();
export const fresh = () => ({
  version: 1,
  instance: uid(),
  habits: [],
  records: {},
  journals: {},
  notes: [],
  sessions: [],
  events: [],
  checkins: [],
  checkinRecords: {},
  learning: [],
  plans: {},
  plansUnified: true,
  restDays: {},
  holidays: {},
  adjustments: {},
  goalSnapshots: {},
  chains: [],
  timer: null,
});
export let state, meta, config;
let writes = Promise.resolve(), persistenceExtras=()=>({});
export function setPersistenceExtras(fn){persistenceExtras=fn;}
export async function load() {
  state = (await get("state")) || fresh();
  meta = Sync.init((await get("meta")) || {});
  config = {...CloudConfig,...((await get("config")) || {})};
  Planner.reconcile(state);
  // Preserve records created by the old client with a missing/duplicate ID.
  const before = structuredClone(state); let repaired = false;
  for (const name of ["notes", "learning"]) {
    const seen = new Set();
    for (const item of state[name] || []) {
      if (typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)) { item.id = uid(); repaired = true; }
      seen.add(item.id);
    }
  }
  if (repaired) {
    Sync.capture(meta, before, state);
    await putMany({ ["pre-id-repair:" + Date.now()]: before, state, meta });
  }
}
export async function persist() {
  await putMany({ state, meta, config,...persistenceExtras() });
}
export function change(fn) {
  const task = writes.then(async () => {
    const before = structuredClone(state),
      m = structuredClone(meta);
    try {
      const result = await fn(state);
      Planner.reconcile(state);
      Streaks.reconcile(state,today());
      Sync.capture(meta, before, state);
      await persist();
      return result;
    } catch (e) {
      state = before;
      meta = m;
      throw e;
    }
  });
  writes = task.catch(() => {});
  return task;
}
export async function run(action, a = {}) {
  let result, error;
  await change((s) => {
    try {
      result = domain(s, action, a);
    } catch (e) {
      error = e;
      throw e;
    }
  });
  if (error) throw error;
  return result;
}
function domain(s, action, a) {
  if(action==='hook.set')return Hooks.set(s,a);
  if(action==='hook.source.save')return Hooks.update(s,a);
  a=Object.fromEntries(Object.entries(a).filter(([,v])=>v!==undefined));
  const date = a.date || today();
  if (!R.validDate(date)) throw Error("日期不正确");
  if (action.startsWith("plan.")) return Planner.run(s, action, { ...a, date });
  if (action === "notification.act") {
    s.notificationHandled ||= {};
    if (s.notificationHandled[a.key]) return;
    if (a.kind === "checkin") domain(s, "checkin.increment", a);
    else if (a.kind === "habit") domain(s, "record.set", {...a,status:"done"});
    s.notificationHandled[a.key] = true;
    return;
  }
  if (action === "rest.set") {
    if (a.rest === false) delete s.restDays[date];
    else
      s.restDays[date] = {
        note: a.note || "主动休息",
        at: new Date().toISOString(),
      };
    return;
  }
  if (action === "checkin.increment") {
    if (date > today()) throw Error("不能提前打卡");
    const h = s.checkins.find((x) => x.id === a.id);
    if (!h) throw Error("打卡不存在");
    s.checkinRecords[date] ||= {};
    const old = s.checkinRecords[date][a.id] || { count: 0, target: h.target };
    old.count = Math.max(0, Math.min(old.target, old.count + (a.delta || 1)));
    s.checkinRecords[date][a.id] = old;
    return old;
  }
  if(action==='record.delete'){const r=s.records[date]?.[a.id];if(r?.sourceSessionId)s.sessions=s.sessions.filter(x=>x.id!==r.sourceSessionId);if(s.records[date])delete s.records[date][a.id];return;}
  if(action==='habit.record'){if(date>today())throw Error('不能提前记录');const h=s.habits.find(x=>x.id===a.id);if(!h)throw Error('习惯不存在');const minutes=Number(a.elapsedMinutes||0);if(!Number.isFinite(minutes)||minutes<0||minutes>1440)throw Error('分钟数应为0—1440');domain(s,'record.set',{...a,status:a.status||s.records[date]?.[a.id]?.status||'done'});if(minutes>0){const id=uid();s.sessions.push({id,habitId:h.id,date,title:h.title,seconds:Math.round(minutes*60),note:a.note||'',endedAt:Date.now(),manual:true});s.records[date][h.id].sourceSessionId=id;}return;}
  if (action === "record.set") {
    if (date > today()) throw Error("不能提前完成");
    const h = s.habits.find((x) => x.id === a.id);
    if (!h) throw Error("习惯不存在");
    s.records[date] ||= {};
    const old = s.records[date][a.id] || {};
    const linked=RecordLinks.find(s,date,a.id,old);if(linked)old.sourceSessionId=linked.id;
    if(a.status==='pending'){delete s.records[date][a.id];return;}
    if(!['done','minimum','skipped','progress'].includes(a.status))throw Error('状态不正确');
    s.records[date][a.id] = {
      ...old,
      status: a.status,
      count: h.goal?(a.status==='done'?Math.max(old.count||0,1):old.count||0):a.status === "done" ? old.target || h.target || 1 : 0,
      minimumCount:h.goal?Math.max(old.minimumCount||0,a.status==='minimum'?1:0):old.minimumCount,
      target: old.target || h.target || 1,
      note: a.note ?? old.note ?? "",
      reason: a.reason ?? old.reason ?? "",
      at: new Date().toISOString(),
    };
    RecordLinks.update(s,date,a.id,s.records[date][a.id],s.records[date][a.id].note);
    if (["done", "minimum"].includes(a.status) && h.afterAction)
      s.chains.unshift({ id: uid(), title: h.afterAction, date });
    return;
  }
  if (action === "goal.record") {
    const h = s.habits.find((x) => x.id === a.id);
    if (!h?.goal) throw Error("请设置每周目标");
    s.records[date] ||= {};
    const old = s.records[date][h.id] || {},
      count = Math.max(0, (old.count || 0) + (a.delta || 1));
    s.records[date][h.id] = {
      ...old,
      count,
      status: count ? "done" : "pending",
      target: 1,
      at: new Date().toISOString(),
    };
    if ((a.delta || 1) > 0 && h.afterAction)
      s.chains.unshift({ id: uid(), title: h.afterAction, date });
    return;
  }
  if (action === "focus.start") {
    if (s.timer) throw Error("先结束当前专注");
    const h = s.habits.find((x) => x.id === a.id);
    const minutes = Number(a.minutes || h?.minutes || 25);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)
      throw Error("专注时长应为1—240分钟");
    s.timer = {
      id: uid(),
      habitId: h?.id || null,
      date,
      title: h?.title || a.title || "专注",
      minutes,
      remainingMs: minutes * 60000,
      startedAt: Date.now(),
    };
    return;
  }
  if (action === "focus.pause") {
    const t = s.timer;
    if (t?.startedAt) {
      t.remainingMs = Math.max(0, t.remainingMs - (Date.now() - t.startedAt));
      t.startedAt = null;
    }
    return;
  }
  if (action === "focus.resume") {
    if (s.timer && !s.timer.startedAt) s.timer.startedAt = Date.now();
    return;
  }
  if (action === "focus.finish") {
    const t = s.timer;
    if (!t) throw Error("没有专注");
    const remain = t.remainingMs - (t.startedAt ? Date.now() - t.startedAt : 0);
    const h = s.habits.find((x) => x.id === t.habitId);
    s.sessions.push({
      id: t.id,
      habitId: t.habitId,
      date: t.date,
      title: t.title,
      seconds: Math.round(
        Math.min(t.minutes * 60000, t.minutes * 60000 - remain) / 1000,
      ),
      note: a.note || "",
      nextStep: a.nextStep || "",
      endedAt: Date.now(),
    });
    if (a.complete && h)
      domain(s, h.goal?.unit === "count" ? "goal.record" : "record.set", {
        id: h.id,
        date: t.date,
        status: "done",
        note: a.note,
      });
    if(a.complete&&h&&s.records[t.date]?.[h.id])s.records[t.date][h.id].sourceSessionId=t.id;
    if (!a.complete || !h?.afterAction)
      s.chains.unshift({
        id: uid(),
        title: h?.afterAction || "站起来走两分钟",
        date: today(),
      });
    s.timer = null;
    return;
  }
  if (action === "journal.save") {
    if(!a.body?.trim()){delete s.journals[date];return;}
    s.journals[date] = {
      ...s.journals[date],
      body: a.body,
      mood: a.mood || s.journals[date]?.mood || "",
      updatedAt: new Date().toISOString(),
    };
    return;
  }
  if (action === "note.save" || action === "learning.save") {
    const list = action === "note.save" ? s.notes : s.learning;
    let x = list.find((x) => x.id === a.id);
    if (!x) {
      x = {
        id: uid(),
        createdOn: date,
        at: new Date().toISOString(),
        color: "sand",
        status: "later",
      };
      list.unshift(x);
    }
    const fields = { ...a };
    if (!fields.id) delete fields.id;
    Object.assign(x, fields, {
      updatedAt: new Date().toISOString(),
      revision: uid(),
    });
    return x;
  }
  if (action === "habit.save" || action === "checkin.save") {
    if (!a.title?.trim()) throw Error("请填写名称");
    if (
      a.target !== undefined &&
      (!Number.isInteger(a.target) || a.target < 1 || a.target > 100)
    )
      throw Error("次数应为1—100");
    const list = action === "habit.save" ? s.habits : s.checkins;
    let h = list.find((x) => x.id === a.id);
    if (!h) {
      h = {
        id: uid(),
        enabled: true,
        minutes: 20,
        time: "",
        times: [],
        days: [0, 1, 2, 3, 4, 5, 6],
        target: 1,
      };
      list.push(h);
    }
    Object.assign(h, a, { revision: uid() });
    if(action==='habit.save'&&a.goal===null)delete h.goal;
    return h;
  }
  if (action === "event.save") {
    if (a.id?.includes("@") && !s.events.some((e) => e.id === a.id)) {
      const x = R.expand(s.events, date, date,s).find((e) => e.id === a.id);
      if (x) s.events.push(x);
    }
    let e = s.events.find((x) => x.id === a.id);
    if (!e) {
      e = {
        id: a.id || uid(),
        category: "生活",
        color: "sage",
        status: "pending",
        time: "",
        note: "",
        archived: false,
      };
      s.events.push(e);
    }
    Object.assign(e, a, { date, revision: uid() });
    return;
  }
  if (
    action === "event.archive" &&
    a.id?.includes("@") &&
    !s.events.some((e) => e.id === a.id)
  ) {
    const x = R.expand(s.events, date, date,s).find((e) => e.id === a.id);
    if (x) s.events.push({ ...x, archived: true });
    return;
  }
  if (action.endsWith(".archive")) {
    const name = {
        note: "notes",
        habit: "habits",
        checkin: "checkins",
        learning: "learning",
        event: "events",
      }[action.split(".")[0]],
      x = s[name]?.find((x) => x.id === a.id);
    if (!x) throw Error("记录不存在");
    if (name === "habits" || name === "checkins") x.enabled = false;
    else x.archived = true;
    return;
  }
  throw Error("不支持的操作");
}
export async function replaceImported(data) {
  if (!data || !Array.isArray(data.habits) || !data.journals || !data.records)
    throw Error("这不是一序备份");
  await change((s) => {
    for (const k of Object.keys(fresh()))
      if (data[k] !== undefined && k !== "timer")
        s[k] = structuredClone(data[k]);
    s.plansUnified = true;
  });
}
