(function (root) {
  const clone = (x) => JSON.parse(JSON.stringify(x)),
    uid = () => globalThis.crypto.randomUUID();
  const lists = [
    "habits",
    "checkins",
    "notes",
    "sessions",
    "events",
    "learning",
    "milestones",
    "habitAchievements",
  ];
  const maps = ["journals", "records", "restDays", "holidays", "holidayLabels", "adjustments"];
  function flatten(s) {
    const out = {};
    for (const k of lists)
      for (const x of s[k] || []) out[k + ":" + x.id] = clone(x);
    for (const k of maps)
      for (const [id, x] of Object.entries(s[k] || {})) {
        if (k === "records") {
          for (const [h, r] of Object.entries(x))
            out["records:" + id + ":" + h] = clone(r);
        } else out[k + ":" + id] = clone(x);
      }
    for (const [w, p] of Object.entries(s.plans || {})) {
      const { tasks, entries, revision, ...meta } = p;
      out["plans:" + w] = clone(meta);
      for (const t of tasks || []) {
        const { completed, scheduled, scheduledDone, revision, ...value } = t;
        out["tasks:" + w + ":" + t.id] = clone(value);
      }
      for (const e of entries || [])
        out["entries:" + w + ":" + e.id] = clone(e);
    }
    for (const [d, rs] of Object.entries(s.checkinRecords || {}))
      for (const [id, r] of Object.entries(rs))
        out["checkinRecords:" + d + ":" + id] = clone(r);
    return out;
  }
  function apply(s, key, value) {
    const [type, id, sub] = key.split(":");
    if (lists.includes(type)) {
      s[type] ||= [];
      const i = s[type].findIndex((x) => x.id === id);
      if (value === null) {
        if (i >= 0) s[type].splice(i, 1);
      } else if (i >= 0) s[type][i] = clone(value);
      else s[type].push(clone(value));
    } else if (maps.includes(type)) {
      s[type] ||= {};
      if (type === "records") {
        s[type][id] ||= {};
        if (value === null) delete s[type][id][sub];
        else s[type][id][sub] = clone(value);
      } else if (value === null) delete s[type][id];
      else s[type][id] = clone(value);
    } else if (type === "checkinRecords") {
      s.checkinRecords ||= {};
      s.checkinRecords[id] ||= {};
      if (value === null) delete s.checkinRecords[id][sub];
      else
        s.checkinRecords[id][sub] = {
          ...clone(value),
          count: Math.max(0, value.count || 0),
        };
    } else if (["plans", "tasks", "entries"].includes(type)) {
      s.plans ||= {};
      s.plans[id] ||= {
        week: id,
        reporter: "",
        tasks: [],
        entries: [],
        overview: "",
        progress: "",
        risks: "",
        nextWeek: "",
        cognition: "",
        revision: uid(),
      };
      const p = s.plans[id];
      if (type === "plans") {
        if (value === null) delete s.plans[id];
        else Object.assign(p, clone(value));
      } else {
        const k = type === "tasks" ? "tasks" : "entries";
        const i = p[k].findIndex((x) => x.id === sub);
        if (value === null) {
          if (i >= 0) p[k].splice(i, 1);
        } else if (i >= 0) p[k][i] = { ...clone(value), revision: uid() };
        else p[k].push({ ...clone(value), revision: uid() });
      }
      if (s.plans[id]) s.plans[id].revision = uid();
    }
  }
  function init(meta = {}) {
    meta.version ||= 1;
    meta.deviceId ||= uid();
    meta.cursor ||= 0;
    meta.versions ||= {};
    meta.outbox ||= [];
    meta.conflicts ||= {};
    return meta;
  }
  function capture(meta, before, after) {
    init(meta);
    const a = flatten(before),
      b = flatten(after);
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
      const value = b[key] ?? null;
      if (key.startsWith("checkinRecords:") && value !== null) {
        const delta = (value.count || 0) - (a[key]?.count || 0);
        if (delta)
          meta.outbox.push({
            id: uid(),
            key,
            base: meta.versions[key] || 0,
            kind: "counter",
            value: { delta, target: value.target || 1 },
          });
      } else
        meta.outbox.push({
          id: uid(),
          key,
          base: meta.versions[key] || 0,
          kind: "set",
          value,
        });
    }
  }
  function receive(meta, state, row) {
    const pending = meta.outbox.some((x) => x.key === row.key);
    if (pending && row.kind !== "counter") {
      meta.conflicts[row.key] = {
        remote: clone(row),
        local: clone(flatten(state)[row.key] ?? null),
      };
      return;
    }
    apply(state, row.key, row.value);
    if (row.kind === "counter") {
      const waiting = meta.outbox
        .filter((x) => x.key === row.key && x.kind === "counter")
        .reduce((n, x) => n + x.value.delta, 0);
      const v = flatten(state)[row.key];
      if (v)
        apply(state, row.key, {
          ...v,
          count: (row.value?.count || 0) + waiting,
        });
    }
    meta.versions[row.key] = row.version;
  }
  async function sync(meta, state, transport, save) {
    init(meta);
    for (const op of [...meta.outbox]) {
      if (meta.conflicts[op.key]) continue;
      op.base = meta.versions[op.key] || 0;
      const result = await transport.push(op);
      if (result.conflict) {
        meta.conflicts[op.key] = {
          remote: result.row,
          local: clone(flatten(state)[op.key] ?? null),
        };
        await save();
        continue;
      }
      meta.outbox = meta.outbox.filter((x) => x.id !== op.id);
      meta.versions[op.key] = result.row.version;
      const next = meta.outbox.find((x) => x.key === op.key);
      if (next) next.base = result.row.version;
      if (!next) apply(state, op.key, result.row.value);
      else if (op.kind === "counter") receive(meta, state, result.row);
      await save();
    }
    let more = true;
    while (more) {
      const rows = await transport.pull(meta.cursor);
      for (const row of rows) {
        if (row.version > (meta.versions[row.key] || 0))
          receive(meta, state, row);
        meta.cursor = Math.max(meta.cursor, Number(row.seq));
      }
      more = rows.length === 200;
      await save();
    }
    meta.lastSync = new Date().toISOString();
    meta.error = "";
    await save();
    return meta;
  }
  function resolve(meta, state, key, choice, body) {
    const c = meta.conflicts[key];
    if (!c) throw Error("找不到冲突记录");
    meta.outbox = meta.outbox.filter((x) => x.key !== key);
    meta.versions[key] = c.remote.version;
    if (choice === "remote") apply(state, key, c.remote.value);
    else {
      const value = choice === "merge" ? { ...(c.local || {}), body } : c.local;
      apply(state, key, value);
      meta.outbox.push({
        id: uid(),
        key,
        base: c.remote.version,
        kind: "set",
        value,
      });
    }
    delete meta.conflicts[key];
  }
  const api = { flatten, apply, init, capture, receive, sync, resolve };
  if (typeof module !== "undefined") module.exports = api;
  else root.YixuSync = api;
})(globalThis);
