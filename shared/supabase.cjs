(function (root) {
  function validate(c) {
    const u = new URL(c.url);
    if (
      u.protocol !== "https:" ||
      !u.hostname.endsWith(".supabase.co") ||
      u.username ||
      u.password
    )
      throw Error("请输入 https://项目ID.supabase.co");
    if (
      typeof c.key !== "string" ||
      !c.key.trim() ||
      c.key.startsWith("sb_secret_")
    )
      throw Error("请使用 publishable 或 anon 公钥");
    if (c.key.split(".").length === 3) {
      try {
        const role = JSON.parse(atob(c.key.split(".")[1])).role;
        if (role === "service_role") throw Error("不能使用 service_role 密钥");
      } catch (e) {
        if (e.message.includes("service_role")) throw e;
      }
    }
    return { url: u.origin, key: c.key.trim() };
  }
  function client(config, session = {}, saveSession = async () => {}) {
    const c = validate(config);
    async function request(path, body, method = "POST", auth = true) {
      if (
        auth &&
        session.expires_at &&
        session.expires_at < Date.now() / 1000 + 90 &&
        session.refresh_token
      ) {
        const next = await request(
          "/auth/v1/token?grant_type=refresh_token",
          { refresh_token: session.refresh_token },
          "POST",
          false,
        );
        Object.assign(session, next, {
          expires_at: Math.floor(Date.now() / 1000) + next.expires_in,
        });
        await saveSession(session);
      }
      const headers = { apikey: c.key, "Content-Type": "application/json" };
      if (auth && session.access_token)
        headers.Authorization = "Bearer " + session.access_token;
      const r = await fetch(c.url + path, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(25000),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok)
        throw Error(
          data?.msg ||
            data?.message ||
            data?.error_description ||
            "云端请求失败 " + r.status,
        );
      return data;
    }
    return {
      config: c,
      session,
      async login(email, password) {
        const next = await request(
          "/auth/v1/token?grant_type=password",
          { email, password },
          "POST",
          false,
        );
        Object.assign(session, next, {
          expires_at: Math.floor(Date.now() / 1000) + next.expires_in,
        });
        await saveSession(session);
        return next.user;
      },
      async signup(email, password) {
        return request("/auth/v1/signup", { email, password }, "POST", false);
      },
      async logout() {
        if (session.access_token) await request("/auth/v1/logout", {});
        for (const k of Object.keys(session)) delete session[k];
        await saveSession(session);
      },
      async push(op) {
        return request("/rest/v1/rpc/yixu_apply", {
          p_op: op.id,
          p_key: op.key,
          p_base: op.base,
          p_kind: op.kind,
          p_value: op.value,
        });
      },
      async pull(cursor) {
        return request(
          "/rest/v1/yixu_changes?select=seq,key,value,version,kind&seq=gt." +
            cursor +
            "&order=seq.asc&limit=200",
          undefined,
          "GET",
        );
      },
      async upload(id, blob) {
        if (!session.user?.id) throw Error("请先登录");
        await request("/auth/v1/user", undefined, "GET");
        const key = session.user.id + "/" + id;
        const response = await fetch(
          c.url + "/storage/v1/object/yixu-attachments/" + key,
          {
            method: "POST",
            headers: {
              apikey: c.key,
              Authorization: "Bearer " + session.access_token,
              "Content-Type": blob.type || "application/octet-stream",
              "x-upsert": "false",
            },
            body: blob,
            signal: AbortSignal.timeout(60000),
          },
        );
        if (!response.ok && response.status !== 409) {
          const d = await response.json();
          if (!/already exists|duplicate/i.test(d.message || d.error || ""))
            throw Error("附件上传失败");
        }
        return key;
      },
      async download(id) {
        const signed = await request(
          "/storage/v1/object/sign/yixu-attachments/" +
            session.user.id +
            "/" +
            id,
          { expiresIn: 300 },
        );
        const r = await fetch(c.url + "/storage/v1" + signed.signedURL);
        if (!r.ok) throw Error("附件下载失败");
        return r.blob();
      },
      request,
    };
  }
  const api = { validate, client };
  if (typeof module !== "undefined") module.exports = api;
  else root.YixuCloud = api;
})(globalThis);
