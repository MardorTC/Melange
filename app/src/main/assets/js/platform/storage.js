import { model } from "../state/model.js";

export async function openStore() {
  if (window.window.NativeOSP) return;
  model.storeDB = await new Promise((resolve, reject) => {
    const r = indexedDB.open("projectosp-android-preview", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function readStore() {
  if (window.window.NativeOSP) {
    const raw = window.NativeOSP.read();
    if (raw.startsWith("ERROR:")) throw Error(raw.slice(6));
    return raw ? JSON.parse(raw) : null;
  }
  return await new Promise((res, rej) => {
    const r = model.storeDB
      .transaction("state")
      .objectStore("state")
      .get("current");
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

export const saveRequests = new Map();

window.nativeSaved = (id, result) => {
  const pending = saveRequests.get(id);
  if (!pending) return;
  saveRequests.delete(id);
  if (result === "OK") pending.resolve();
  else pending.reject(Error(result.replace("ERROR:", "")));
};

export async function writeStore(v) {
  if (window.window.NativeOSP) {
    if (window.NativeOSP.writeAsync) {
      await new Promise((resolve, reject) => {
        const id = ++model.saveSerial;
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
    const tx = model.storeDB.transaction("state", "readwrite");
    tx.objectStore("state").put(v, "current");
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
