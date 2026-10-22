import { Capacitor, registerPlugin } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
const native = registerPlugin("YixuNative");
let db, idb;
export async function openStore() {
  if (Capacitor.isNativePlatform()) {
    const conn = new SQLiteConnection(CapacitorSQLite);
    db = await conn.createConnection("yixu", false, "no-encryption", 1, false);
    await db.open();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY,value TEXT NOT NULL);",
    );
  } else {
    idb = await new Promise((resolve, reject) => {
      const req = indexedDB.open("yixu-mobile", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
export async function get(key) {
  if (db) {
    const r = await db.query("SELECT value FROM kv WHERE key=?", [key]);
    return r.values?.length ? JSON.parse(r.values[0].value) : null;
  }
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("kv"),
      r = tx.objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
export async function put(key, value) {
  return putMany({ [key]: value });
}
export async function putMany(values) {
  if (db) {
    await db.executeSet(
      Object.entries(values).map(([key, value]) => ({
        statement: "INSERT OR REPLACE INTO kv(key,value) VALUES(?,?)",
        values: [key, JSON.stringify(value)],
      })),
      true,
    );
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("kv", "readwrite");
    for (const [k, v] of Object.entries(values)) tx.objectStore("kv").put(v, k);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function getAuth() {
  if (Capacitor.isNativePlatform())
    return JSON.parse((await native.readSecret()).value || "{}");
  return JSON.parse(sessionStorage.getItem("yixu-session") || "{}");
}
export async function saveAuth(value) {
  if (Capacitor.isNativePlatform())
    await native.writeSecret({ value: JSON.stringify(value) });
  else sessionStorage.setItem("yixu-session", JSON.stringify(value));
}
export { native };
