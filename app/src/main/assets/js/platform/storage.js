let storeDB;
let saveSerial = 0;

export async function openStore() {
  if (window.NativeOSP) return;
  storeDB = await new Promise((resolve, reject) => {
    const r = indexedDB.open("projectosp-android-preview", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function readStore() {
  if (window.NativeOSP) {
    const raw = window.NativeOSP.read();
    if (raw.startsWith("ERROR:")) throw Error(raw.slice(6));
    return raw ? JSON.parse(raw) : null;
  }
  return await new Promise((res, rej) => {
    const r = storeDB.transaction("state").objectStore("state").get("current");
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

const saveRequests = new Map();

window.nativeSaved = (id, result) => {
  const pending = saveRequests.get(id);
  if (!pending) return;
  saveRequests.delete(id);
  if (result === "OK") pending.resolve();
  else pending.reject(Error(result.replace("ERROR:", "")));
};

export async function writeStore(v) {
  if (window.NativeOSP) {
    if (window.NativeOSP.writeAsync) {
      await new Promise((resolve, reject) => {
        const id = ++saveSerial;
        saveRequests.set(id, { resolve, reject });
        window.NativeOSP.writeAsync(JSON.stringify(v), id);
      });
    } else {
      const r = window.NativeOSP.write(JSON.stringify(v));
      if (r !== "OK") throw Error(r.replace("ERROR:", ""));
    }
    return;
  }
  await new Promise((res, rej) => {
    const tx = storeDB.transaction("state", "readwrite");
    const objects = tx.objectStore("state");
    const old = objects.get("current");
    old.onsuccess = () => {
      if (old.result?.state?.schemaVersion < v.state.schemaVersion) {
        const key = "migration-v" + old.result.state.schemaVersion;
        const backup = objects.get(key);
        backup.onsuccess = () => {
          if (!backup.result) objects.put(old.result, key);
          objects.put(v, "current");
        };
      } else objects.put(v, "current");
    };
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

export async function writeRecoveryStore(value) {
  if (window.NativeOSP) {
    if (!window.NativeOSP.writeRecovery) return writeStore(value);
    const result = window.NativeOSP.writeRecovery(JSON.stringify(value));
    if (result !== "OK") throw Error(result.replace("ERROR:", ""));
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = storeDB.transaction("state", "readwrite");
    const objects = tx.objectStore("state");
    const old = objects.get("current");
    old.onsuccess = () => {
      if (old.result !== undefined)
        objects.put(
          old.result,
          "recovery-backup:" + Date.now() + ":" + ++saveSerial,
        );
      objects.put(value, "current");
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function readFormDraft(key) {
  if (window.NativeOSP) {
    if (!window.NativeOSP.readFormDraft) return null;
    const raw = window.NativeOSP.readFormDraft(key);
    if (raw.startsWith("ERROR:")) throw Error(raw.slice(6));
    return raw ? JSON.parse(raw) : null;
  }
  return new Promise((resolve, reject) => {
    const r = storeDB
      .transaction("state")
      .objectStore("state")
      .get("form-draft:" + key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function writeFormDraft(key, value) {
  const json = value ? JSON.stringify(value) : "";
  if (new TextEncoder().encode(json).length > 256 * 1024)
    throw Error(
      "El borrador es demasiado grande. Reduce el formulario antes de cerrar.",
    );
  if (window.NativeOSP) {
    if (!window.NativeOSP.writeFormDraft)
      throw Error(
        "Esta versión nativa no guarda borradores. Mantén el formulario abierto.",
      );
    const result = window.NativeOSP.writeFormDraft(key, json);
    if (result !== "OK") throw Error(result.replace("ERROR:", ""));
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = storeDB.transaction("state", "readwrite"),
      objects = tx.objectStore("state");
    if (value) objects.put(value, "form-draft:" + key);
    else objects.delete("form-draft:" + key);
    // Bound this private cache independently from the financial book/history.
    const cursor = objects.openCursor(),
      drafts = [];
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        if (typeof c.key === "string" && c.key.startsWith("form-draft:"))
          drafts.push({ key: c.key, date: c.value?.date || 0 });
        c.continue();
      } else {
        drafts.sort((a, b) => b.date - a.date || b.key.localeCompare(a.key));
        for (const d of drafts.slice(20)) objects.delete(d.key);
      }
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
