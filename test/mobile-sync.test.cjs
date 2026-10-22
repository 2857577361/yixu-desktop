const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  S = require("../shared/sync-model.cjs");
const initial = () => ({
  habits: [],
  checkins: [],
  notes: [],
  journals: {},
  records: {},
  sessions: [],
  checkinRecords: {},
  plans: {},
});
function server() {
  const records = {},
    ops = {},
    changes = [];
  return {
    records,
    async push(o) {
      if (ops[o.id]) return ops[o.id];
      let row = records[o.key] || { version: 0, value: null };
      if (o.kind === "set" && row.version !== o.base)
        return { conflict: true, row: { ...row, key: o.key } };
      const value =
        o.kind === "counter"
          ? {
              count: (row.value?.count || 0) + o.value.delta,
              target: o.value.target,
            }
          : o.value;
      row = {
        key: o.key,
        value,
        version: row.version + 1,
        kind: o.kind,
        seq: changes.length + 1,
      };
      records[o.key] = row;
      changes.push(row);
      return (ops[o.id] = { conflict: false, row });
    },
    async pull(cursor) {
      return changes.filter((r) => r.seq > cursor).slice(0, 200);
    },
  };
}
test("two offline devices add to one check-in without losing increments", async () => {
  const srv = server(),
    a = initial(),
    b = initial(),
    ma = S.init(),
    mb = S.init();
  a.checkinRecords["2026-09-30"] = { water: { count: 1, target: 8 } };
  b.checkinRecords["2026-09-30"] = { water: { count: 2, target: 8 } };
  S.capture(ma, initial(), a);
  S.capture(mb, initial(), b);
  await S.sync(ma, a, srv, async () => {});
  await S.sync(mb, b, srv, async () => {});
  await S.sync(ma, a, srv, async () => {});
  assert.equal(a.checkinRecords["2026-09-30"].water.count, 3);
  assert.equal(b.checkinRecords["2026-09-30"].water.count, 3);
});
test("diary conflict preserves both bodies until explicit selection", async () => {
  const srv = server(),
    a = initial(),
    b = initial(),
    ma = S.init(),
    mb = S.init();
  a.journals["2026-09-30"] = { body: "电脑记录" };
  b.journals["2026-09-30"] = { body: "手机记录" };
  S.capture(ma, initial(), a);
  S.capture(mb, initial(), b);
  await S.sync(ma, a, srv, async () => {});
  await S.sync(mb, b, srv, async () => {});
  assert.equal(b.journals["2026-09-30"].body, "手机记录");
  assert.equal(
    mb.conflicts["journals:2026-09-30"].remote.value.body,
    "电脑记录",
  );
  S.resolve(mb, b, "journals:2026-09-30", "merge", "电脑记录\n手机记录");
  await S.sync(mb, b, srv, async () => {});
  assert.equal(
    srv.records["journals:2026-09-30"].value.body,
    "电脑记录\n手机记录",
  );
});
test("retry after network failure reuses operation ID", async () => {
  const srv = server(),
    s = initial(),
    m = S.init();
  s.notes = [{ id: "a", body: "note" }];
  S.capture(m, initial(), s);
  let failed = false;
  const original = srv.push;
  srv.push = async (o) => {
    const r = await original(o);
    if (!failed) {
      failed = true;
      throw Error("offline");
    }
    return r;
  };
  await assert.rejects(S.sync(m, s, srv, async () => {}));
  await S.sync(m, s, srv, async () => {});
  assert.equal(srv.records["notes:a"].version, 1);
  assert.equal(m.outbox.length, 0);
});
test("physical deletion transfers as a tombstone; local timer never transfers", () => {
  const s = initial(),
    m = S.init();
  s.notes = [{ id: "a", body: "note" }];
  const after = { ...s, notes: [], timer: { secret: "local" } };
  S.capture(m, s, after);
  assert.equal(m.outbox.length, 1);
  assert.equal(m.outbox[0].value, null);
  S.apply(s, "notes:a", null);
  assert.equal(s.notes.length, 0);
});
test("desktop edits persist outbox alongside data; remote apply does not echo changes", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    os = require("node:os"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "yixu-mobile-outbox-"));
  process.env.YIXU_DATA_DIR = dir;
  const core = require("../core.cjs");
  try {
    core.mutate(
      (s) => {
        s.cloudMeta = S.init();
      },
      { fromCloud: true },
    );
    core.run("journal.save", { date: "2026-09-30", body: "桌面记录" });
    let s = core.read();
    assert.equal(
      s.cloudMeta.outbox.filter((x) => x.key === "journals:2026-09-30").length,
      1,
    );
    assert.equal(s.cloudMeta.outbox[0].value.body, "桌面记录");
    const count = s.cloudMeta.outbox.length;
    core.mutate(
      (s) => S.apply(s, "notes:remote", { id: "remote", body: "手机便笺" }),
      { fromCloud: true },
    );
    assert.equal(core.read().cloudMeta.outbox.length, count);
    assert.equal(
      core.read().notes.find((x) => x.id === "remote").body,
      "手机便笺",
    );
    assert.ok(
      !Object.keys(S.flatten(core.read())).some((k) =>
        /settings|cloud|timer/.test(k),
      ),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
