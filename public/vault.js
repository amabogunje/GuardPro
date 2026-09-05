let db, key, account;
const enc = new TextEncoder(),
  dec = new TextDecoder();
function open() {
  return new Promise((resolve, reject) => {
    let r = indexedDB.open("guard-private-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("vaults");
    r.onsuccess = () => {
      db = r.result;
      resolve();
    };
    r.onerror = () => reject(r.error);
  });
}
function read(k) {
  return new Promise((resolve, reject) => {
    let r = db.transaction("vaults").objectStore("vaults").get(k);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function write(k, v) {
  return new Promise((resolve, reject) => {
    let t = db.transaction("vaults", "readwrite");
    t.objectStore("vaults").put(v, k);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Device storage full"));
  });
}
export async function unlock(email, password) {
  await open();
  account = email.toLowerCase();
  let existing = await read(account),
    salt = existing?.salt || crypto.getRandomValues(new Uint8Array(16)),
    base = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
  key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  if (existing?.data) {
    try {
      return JSON.parse(
        dec.decode(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: existing.iv },
            key,
            existing.data,
          ),
        ),
      );
    } catch {
      throw new Error(
        "Cannot unlock saved work. Use the original password; do not clear browser data.",
      );
    }
  }
  await write(account, { salt });
  return { state: null, queue: [], draft: null };
}
let saving = Promise.resolve();
export function save(value) {
  let snapshot = JSON.stringify(value);
  const saveKey = key,
    saveAccount = account;
  const task = async () => {
    if (!key || key !== saveKey || account !== saveAccount)
      throw new Error("Device locked");
    let old = await read(saveAccount),
      iv = crypto.getRandomValues(new Uint8Array(12)),
      data = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        saveKey,
        enc.encode(snapshot),
      );
    await write(saveAccount, { salt: old.salt, iv, data });
  };
  saving = saving.catch(() => {}).then(task);
  return saving;
}
export async function lock(revoke = true) {
  try {
    sessionStorage.removeItem(SESSION);
  } catch {}
  try {
    if (revoke) localStorage.setItem(EPOCH, crypto.randomUUID());
  } catch {}
  await saving.catch(() => {});
  key = null;
  account = null;
  db?.close();
  db = null;
}
export async function fileData(file) {
  if (file.size > 4 * 1024 * 1024)
    throw new Error(
      "This file is too large (4 MB maximum). Choose a smaller photo or record a shorter message.",
    );
  return new Promise((resolve, reject) => {
    let r = new FileReader();
    r.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        data: r.result,
        mime: file.type,
        name: file.name || "recording",
      });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
export async function blobFrom(file) {
  let bytes = atob(file.data.split(",")[1]);
  return new Blob([Uint8Array.from(bytes, (c) => c.charCodeAt(0))], {
    type: file.mime,
  });
}

export const SESSION = "guard-tab-session-v1";
export const EPOCH = "guard-session-epoch";
export async function remember(expiresAt = Date.now() + 12 * 3600000) {
  if (!key || !account) throw Error("Sign in first");
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const epoch = crypto.randomUUID();
  localStorage.setItem(EPOCH, epoch);
  sessionStorage.setItem(
    SESSION,
    JSON.stringify({
      account,
      key: btoa(String.fromCharCode(...raw)),
      expiresAt,
      epoch,
      view: { page: "home" },
    }),
  );
}
export function rememberView(view) {
  const text = sessionStorage.getItem(SESSION);
  if (!text) return;
  const session = JSON.parse(text);
  session.view = view;
  sessionStorage.setItem(SESSION, JSON.stringify(session));
}
export async function restore() {
  try {
    const text = sessionStorage.getItem(SESSION);
    if (!text) return null;
    const session = JSON.parse(text);
    if (
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() ||
      session.epoch !== localStorage.getItem(EPOCH)
    ) {
      await lock(false);
      return null;
    }
    await open();
    account = session.account;
    key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(session.key), (c) => c.charCodeAt(0)),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
    const saved = await read(account);
    if (!saved?.data) throw Error("No saved session");
    const value = JSON.parse(
      dec.decode(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: saved.iv },
          key,
          saved.data,
        ),
      ),
    );
    if (!value.state?.user) throw Error("No saved account");
    return { value, view: session.view || { page: "home" } };
  } catch {
    await lock(false);
    return null;
  }
}
