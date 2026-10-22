const fs = require("node:fs"),
  path = require("node:path"),
  Sync = require("./shared/sync-model.cjs"),
  Cloud = require("./shared/supabase.cjs"),
  media = require("./media.cjs"),
  core = require("./core.cjs");
let active = false,
  secrets;
function setSecretStore(store) {
  secrets = store;
}
function status() {
  const s = core.read(),
    m = s.cloudMeta || {};
  return {
    configured: !!s.cloudConfig?.url,
    connected: !!m.owner,
    email: m.email || "",
    url: s.cloudConfig?.url || "",
    key: s.cloudConfig?.key || "",
    pending: m.outbox?.length || 0,
    lastSync: m.lastSync || "",
    error: m.error || "",
    conflicts: m.conflicts || {},
  };
}
async function client() {
  const s = core.read();
  if (!s.cloudConfig || !secrets) throw Error("请在桌面设置中连接云同步");
  return Cloud.client(s.cloudConfig, await secrets.read(), secrets.write);
}
async function run(action, a = {}) {
  if (action === "cloud.status") return status();
  if (action === "cloud.backup") return { state: core.read() };
  if (action === "cloud.login" || action === "cloud.signup") {
    if (!secrets) throw Error("请在桌面应用连接");
    const cfg = Cloud.validate(a),
      session = {},
      c = Cloud.client(cfg, session, secrets.write);
    if (action === "cloud.signup") return c.signup(a.email, a.password);
    const user = await c.login(a.email, a.password),
      s = core.read();
    if (s.cloudMeta?.owner && s.cloudMeta.owner !== user.id) {
      await c.logout();
      throw Error("当前数据绑定其他账号，请先备份后再切换");
    }
    core.mutate(
      (s) => {
        s.cloudConfig = cfg;
        s.cloudMeta = Sync.init(s.cloudMeta);
        s.cloudMeta.owner = user.id;
        s.cloudMeta.email = user.email;
        s.cloudMeta.signedIn = true;
        if (!s.cloudMeta.seeded) {
          Sync.capture(s.cloudMeta, {}, s);
          s.cloudMeta.seeded = true;
        }
      },
      { fromCloud: true },
    );
    return status();
  }
  if (action === "cloud.logout") {
    const c = await client();
    await c.logout();
    core.mutate(
      (s) => {
        s.cloudMeta.signedIn = false;
      },
      { fromCloud: true },
    );
    return { signedOut: true };
  }
  if (action === "cloud.resolve") {
    core.mutate((s) => Sync.resolve(s.cloudMeta, s, a.key, a.choice, a.body), {
      fromCloud: true,
    });
    return status();
  }
  if (action === "cloud.sync") return sync();
  throw Error("未知云同步操作");
}
async function sync() {
  if (active) return { busy: true };
  active = true;
  try {
    const c = await client();
    if (!c.session.user) throw Error("请先登录云同步");
    const uploadedFile = path.join(
        core.dir,
        "cloud-images-" + c.session.user.id + ".json",
      ),
      uploaded = fs.existsSync(uploadedFile)
        ? JSON.parse(fs.readFileSync(uploadedFile, "utf8"))
        : {};
    const refs = new Set(
      [
        ...JSON.stringify(core.read()).matchAll(
          /yixu-image:([a-f0-9]{64}\.(?:png|jpg|gif|webp))/g,
        ),
      ].map((x) => x[1]),
    );
    for (const id of refs) {
      const p = media.imagePath(core.dir, id);
      if (fs.existsSync(p) && !uploaded[id]) {
        const ext = id.split(".").pop();
        await c.upload(
          id,
          new Blob([fs.readFileSync(p)], {
            type: "image/" + (ext === "jpg" ? "jpeg" : ext),
          }),
        );
        uploaded[id] = true;
        fs.writeFileSync(uploadedFile, JSON.stringify(uploaded), {
          mode: 0o600,
        });
      }
    }
    let iterations = 0;
    while (iterations++ < 500) {
      const m = core.read().cloudMeta,
        op = m.outbox.find((x) => !m.conflicts[x.key]);
      if (!op) break;
      op.base = m.versions[op.key] || 0;
      const result = await c.push(op);
      core.mutate(
        (s) => {
          const m = s.cloudMeta;
          if (result.conflict) {
            m.conflicts[op.key] = {
              remote: result.row,
              local: Sync.flatten(s)[op.key] ?? null,
            };
            return;
          }
          m.outbox = m.outbox.filter((x) => x.id !== op.id);
          m.versions[op.key] = result.row.version;
          if (!m.outbox.some((x) => x.key === op.key))
            Sync.apply(s, op.key, result.row.value);
          else if (op.kind === "counter") Sync.receive(m, s, result.row);
        },
        { fromCloud: true },
      );
    }
    let more = true;
    while (more) {
      const rows = await c.pull(core.read().cloudMeta.cursor);
      core.mutate(
        (s) => {
          const m = s.cloudMeta;
          for (const row of rows) {
            if (row.version > (m.versions[row.key] || 0))
              Sync.receive(m, s, row);
            m.cursor = Math.max(m.cursor, Number(row.seq));
          }
        },
        { fromCloud: true },
      );
      more = rows.length === 200;
    }
    for (const [, id] of JSON.stringify(core.read()).matchAll(
      /yixu-image:([a-f0-9]{64}\.(?:png|jpg|gif|webp))/g,
    )) {
      const p = media.imagePath(core.dir, id);
      if (!fs.existsSync(p)) {
        const b = await c.download(id),
          bytes = Buffer.from(await b.arrayBuffer());
        if (
          require("node:crypto")
            .createHash("sha256")
            .update(bytes)
            .digest("hex") !== id.split(".")[0]
        )
          throw Error("图片校验失败");
        fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
        fs.writeFileSync(p, bytes, { mode: 0o600 });
      }
    }
    core.mutate(
      (s) => {
        s.cloudMeta.lastSync = new Date().toISOString();
        s.cloudMeta.error = "";
      },
      { fromCloud: true },
    );
    return status();
  } catch (e) {
    core.mutate(
      (s) => {
        if (s.cloudMeta) s.cloudMeta.error = e.message;
      },
      { fromCloud: true },
    );
    throw e;
  } finally {
    active = false;
  }
}
module.exports = { setSecretStore, run, status };
