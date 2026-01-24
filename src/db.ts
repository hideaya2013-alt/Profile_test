export type ProfileData = {
  age: number;
  heightCm: number;
  weightKg: number;
  ftpW: number;
  vo2max: number;
  trainingFocus: string[];
  trackSessionRpe: boolean;
};

export type Sport = "swim" | "bike" | "run" | "strength" | "other";
export type ActivitySource = "gpx" | "tcx" | "manual";

export type Activity = {
  id: string;
  source: ActivitySource;
  sport: Sport | null;
  title: string;
  startTime: string;
  endTime: string | null;
  durationSec: number | null;
  distanceMeters: number | null;
  elevMeters: number | null;
  altitudeAvgM: number | null;
  avgHr: number | null;
  avgPower: number | null;
  avgSpeed: number | null;
  hasHr: boolean;
  hasPower: boolean;
  hasSpeed: boolean;
  sRpe: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DoctrineData = {
  shortTermGoal: string;
  seasonGoal: string;
  constraints: string;
  doctrine: string;
  updatedAt: string;
};

const DB_NAME = "tria_profile_test";
const DB_VERSION = 1;
const STORE = "kv";
const KEY = "profile";
const ACTIVITIES_KEY = "activities";
const DOCTRINE_KEY = "doctrine";
const DEFAULT_TRAINING_FOCUS = ["continuity"];
const DEFAULT_TRACK_SESSION_RPE = true;

function normalizeTrainingFocus(value: unknown): string[] {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.length > 0);
    if (first) {
      return [first];
    }
  }
  return [...DEFAULT_TRAINING_FOCUS];
}

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
      if (!row?.value) {
        resolve(null);
        return;
      }
      const value = row.value as ProfileData & { trainingFocus?: unknown };
      resolve({
        ...value,
        trainingFocus: normalizeTrainingFocus(value.trainingFocus),
        trackSessionRpe: value.trackSessionRpe ?? DEFAULT_TRACK_SESSION_RPE,
      });
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

export async function loadActivities(): Promise<Activity[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(ACTIVITIES_KEY);

    req.onsuccess = () => {
      const row = req.result as { key: string; value: Activity[] } | undefined;
      if (!Array.isArray(row?.value)) {
        resolve([]);
        return;
      }
      const now = new Date().toISOString();
      const normalizeCreatedAt = (
        value: Activity & {
          createdAt?: string;
          notes?: string | null;
          comment?: string | null;
          endTime?: string | null;
          durationSec?: number | null;
          elevMeters?: number | null;
          altitudeAvgM?: number | null;
        },
      ) => {
        const createdAt = value.createdAt ?? (isValidIso(value.startTime) ? value.startTime : now);
        const notes = value.notes ?? value.comment ?? null;
        const endTime = normalizeNullableIso(value.endTime);
        const durationSec = normalizeDurationSec(value.durationSec);
        const elevMeters = normalizeNullableNumber(value.elevMeters);
        const altitudeAvgM = normalizeNullableNumber(value.altitudeAvgM);
        const { comment: _comment, ...rest } = value;
        return { ...rest, createdAt, notes, endTime, durationSec, elevMeters, altitudeAvgM };
      };
      resolve(row.value.map(normalizeCreatedAt));
    };
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

function isValidIso(value: string | null | undefined) {
  if (!value) return false;
  return Number.isFinite(Date.parse(value));
}

function normalizeNullableIso(value: string | null | undefined) {
  if (!value) return null;
  return isValidIso(value) ? value : null;
}

function normalizeNullableNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function normalizeDurationSec(value: number | null | undefined) {
  const normalized = normalizeNullableNumber(value);
  if (normalized === null || normalized <= 0) {
    return null;
  }
  return normalized;
}

export async function saveActivities(value: Activity[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({ key: ACTIVITIES_KEY, value });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDoctrine(): Promise<DoctrineData> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(DOCTRINE_KEY);

    req.onsuccess = () => {
      const row = req.result as { key: string; value: DoctrineData } | undefined;
      const now = new Date().toISOString();
      if (!row?.value) {
        resolve({
          shortTermGoal: "",
          seasonGoal: "",
          constraints: "",
          doctrine: "",
          updatedAt: now,
        });
        return;
      }
      resolve({
        shortTermGoal: row.value.shortTermGoal ?? "",
        seasonGoal: row.value.seasonGoal ?? "",
        constraints: row.value.constraints ?? "",
        doctrine: row.value.doctrine ?? "",
        updatedAt: row.value.updatedAt ?? now,
      });
    };
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDoctrine(value: DoctrineData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({ key: DOCTRINE_KEY, value });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function addActivities(value: Activity[]): Promise<void> {
  const current = await loadActivities();
  const next = current.concat(value);
  await saveActivities(next);
}

export async function deleteActivity(id: string): Promise<void> {
  const current = await loadActivities();
  const next = current.filter((entry) => entry.id !== id);
  if (next.length === current.length) {
    return;
  }
  await saveActivities(next);
}

export async function clearActivities(): Promise<void> {
  await saveActivities([]);
}
