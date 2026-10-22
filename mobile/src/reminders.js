import { Capacitor } from "@capacitor/core";
import { LocalNotifications as N } from "@capacitor/local-notifications";
import { state, run, today, R, L } from "./model.js";
import { get, put } from "./store.js";
const nid = (x) => {
  let n = 0;
  for (const c of x) n = (n * 31 + c.charCodeAt(0)) | 0;
  return (n >>> 0) % 2147483647 || 1;
};
export async function permissions() {
  if (!Capacitor.isNativePlatform()) throw Error("请在安卓安装包里开启提醒");
  await N.requestPermissions();
  return N.checkPermissions();
}
export async function schedule() {
  if (
    !Capacitor.isNativePlatform() ||
    (await N.checkPermissions()).display !== "granted"
  )
    return;
  const old = await N.getPending();
  if (old.notifications.length)
    await N.cancel({ notifications: old.notifications });
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const d = L.add(today(), i);
    if (state.restDays[d]) continue;
    for (const h of state.checkins.filter(
      (x) =>
        x.enabled &&
        R.matches(x.recurrence, d,undefined,state) &&
        (!x.workdaysOnly || L.isWorkday(state, d)),
    )) {
      const count = state.checkinRecords[d]?.[h.id]?.count || 0;
      for (const time of (h.times || []).slice(count)) {
        const at = new Date(d + "T" + time + ":00");
        if (at > Date.now())
          rows.push({
            id: nid("checkin:" + d + h.id + time),
            title: "顺手打卡 · " + h.title,
            body: h.before || "点一下记一次",
            schedule: { at },
            actionTypeId: "checkin",
            extra: {
              id: h.id,
              date: d,
              key: "checkin:" + d + h.id + time,
              kind: "checkin",
            },
          });
      }
    }
    for (const h of state.habits.filter(
      (x) => x.enabled && L.eligible(state, x, d) && x.time,
    )) {
      const at = new Date(d + "T" + h.time + ":00");
      if (
        at > Date.now() &&
        !["done", "minimum"].includes(state.records[d]?.[h.id]?.status)
      )
        rows.push({
          id: nid("habit:" + d + h.id),
          title: "该开始了 · " + h.title,
          body: h.minimum || "先从两分钟开始",
          schedule: { at },
          actionTypeId: "habit",
          extra: { id: h.id, date: d, key: "habit:" + d + h.id, kind: "habit" },
        });
    }
  }
  const t = state.timer;
  if (t?.startedAt) {
    const at = new Date(t.startedAt + t.remainingMs);
    if (at > Date.now())
      rows.push({
        id: nid("timer:" + t.id),
        title: "专注时间到了",
        body: t.title + " · 点击回来记录收获",
        schedule: { at },
        extra: { kind: "focus", key: t.id },
      });
  }
  if (rows.length) await N.schedule({ notifications: rows.slice(0, 60) });
}
export async function setup(onChange) {
  if (!Capacitor.isNativePlatform()) return;
  await N.registerActionTypes({
    types: [
      {
        id: "checkin",
        actions: [
          { id: "complete", title: "打卡一次", foreground: true },
          { id: "later", title: "十分钟后", foreground: true },
        ],
      },
      {
        id: "habit",
        actions: [
          { id: "complete", title: "记录完成", foreground: true },
          { id: "later", title: "十分钟后", foreground: true },
        ],
      },
    ],
  });
  await N.addListener("localNotificationActionPerformed", async (e) => {
    const x = e.notification.extra;
    if (!x) return;
    try {
      if (e.actionId === "later") {
        await N.schedule({
          notifications: [
            {
              ...e.notification,
              id: nid(x.key + Date.now()),
              schedule: { at: new Date(Date.now() + 600000) },
            },
          ],
        });
        return;
      }
      if (
        (x.kind === "checkin" || x.kind === "habit") && e.actionId === "complete"
      )
        await run("notification.act", { ...x });
      await schedule();
      onChange(null,x.kind);
    } catch (error) {
      onChange(error.message);
    }
  });
}
