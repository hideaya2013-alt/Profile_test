export type ProfileData = {
  age: number;
  heightCm: number;
  weightKg: number;
  ftpW: number;
  vo2max: number;
};

const DB_NAME = "tria_profile_test";
const DB_VERSION = 1;
const STORE = "kv";
const KEY = "profile";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadProfile(): Promise<ProfileData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(KEY);

    req.onsuccess = () => {
      const row = req.result as { key: string; value: ProfileData } | undefined;
      resolve(row?.value ?? null);
    };
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveProfile(value: ProfileData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({ key: KEY, value });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
