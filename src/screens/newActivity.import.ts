export type ImportSource = "gpx" | "tcx";
export type GpxSport = "swim" | "bike" | "run";

export type ImportDebug = {
  speedFoundAt: "TPX.Speed" | "DerivedFromDistance" | null;
  wattsFoundAt: "TPX.Watts" | null;
  sportRaw: string | null;
  samples: {
    hrAvgBpm: number | null;
    speedAvgKmh: number | null;
    wattsAvgW: number | null;
    altitudeAvgM: number | null;
    distanceTotalM: number | null;
    hrCount: number;
    speedCount: number;
    wattsCount: number;
    altitudeCount: number;
    distanceCount: number;
  };
};

export type ImportDraft = {
  id: string;
  source: ImportSource;
  fileName: string;
  fileSize: number;
  dateLabel: string;
  metrics: {
    time: string;
    distance: string;
    elev: string;
  };
  startTime: string | null;
  endTime: string | null;
  durationSec: number | null;
  distanceMeters: number | null;
  elevMeters: number | null;
  altitudeAvgM: number | null;
  hasHr: boolean;
  hasPower: boolean;
  hasSpeed: boolean;
  avgHr: number | null;
  avgPower: number | null;
  avgSpeed: number | null;
  sRpe: number | null;
  sport: GpxSport | null;
  debug: ImportDebug | null;
};

export type ImportParseResult =
  | { ok: true; draft: ImportDraft }
  | { ok: false; reason: "type" | "parse" };

type ImportMeta = {
  fileName?: string;
  fileSize?: number;
};

export function detectImportSource(fileName: string, text: string): ImportSource | null {
  const ext = getFileExtension(fileName);
  if (ext !== "gpx" && ext !== "tcx") {
    return null;
  }
  const lower = text.toLowerCase();
  const detected = lower.includes("<trainingcenterdatabase")
    ? "tcx"
    : lower.includes("<gpx")
      ? "gpx"
      : null;
  if (!detected) {
    return null;
  }
  return detected === ext ? detected : null;
}

export async function parseImportFile(file: File, detectBytes = 16384): Promise<ImportParseResult> {
  const ext = getFileExtension(file.name);
  if (ext !== "gpx" && ext !== "tcx") {
    return { ok: false, reason: "type" };
  }
  const headerText = await readTextSlice(file, 0, detectBytes);
  const detected = detectImportSource(file.name, headerText);
  if (!detected) {
    return { ok: false, reason: "type" };
  }
  try {
    const text = await file.text();
    const draft = parseToDraft(detected, text, { fileName: file.name, fileSize: file.size });
    return { ok: true, draft };
  } catch (error) {
    console.error("import parse failed", error);
    return { ok: false, reason: "parse" };
  }
}

export function parseToDraft(source: ImportSource, text: string, meta: ImportMeta = {}): ImportDraft {
  if (source === "gpx") {
    return parseGpxText(text, meta);
  }
  return parseTcxText(text, meta);
}

function parseGpxText(text: string, meta: ImportMeta): ImportDraft {
  const doc = parseXmlDocument(text);
  const trkpts = elemsByLocal(doc, "trkpt");

  let startTime: string | null = null;
  let endTime: string | null = null;
  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevAlt: number | null = null;
  let distanceSum = 0;
  let distanceSegments = 0;
  let elevGain = 0;
  let altitudeSum = 0;
  let altitudeCount = 0;
  let distanceTotal = 0;
  let distanceCount = 0;
  let hrSum = 0;
  let hrCount = 0;
  let powerSum = 0;
  let powerCount = 0;
  let speedSum = 0;
  let speedCount = 0;

  for (const trkpt of trkpts) {
    const lat = parseNumberValue(trkpt.getAttribute("lat"));
    const lon = parseNumberValue(trkpt.getAttribute("lon"));
    if (lat !== null && lon !== null) {
      if (prevLat !== null && prevLon !== null) {
        distanceSum += haversineMeters(prevLat, prevLon, lat, lon);
        distanceSegments += 1;
      }
      distanceTotal = distanceSum;
      distanceCount += 1;
      prevLat = lat;
      prevLon = lon;
    }

    const iso = normalizeIso(firstText(trkpt, "time"));
    if (iso) {
      if (!startTime) {
        startTime = iso;
      }
      endTime = iso;
    }

    const altitude = firstNum(trkpt, "ele");
    if (altitude !== null) {
      altitudeSum += altitude;
      altitudeCount += 1;
      if (prevAlt !== null && altitude > prevAlt) {
        elevGain += altitude - prevAlt;
      }
      prevAlt = altitude;
    }

    const hr = toPositiveSample(firstNum(trkpt, "hr"));
    if (hr !== null) {
      hrSum += hr;
      hrCount += 1;
    }

    const speed = toPositiveSample(firstNum(trkpt, "speed"));
    if (speed !== null) {
      speedSum += speed;
      speedCount += 1;
    }

    const power =
      toPositiveSample(firstNum(trkpt, "power")) ?? toPositiveSample(firstNum(trkpt, "watts"));
    if (power !== null) {
      powerSum += power;
      powerCount += 1;
    }
  }

  const durationSec =
    startTime && endTime && startTime !== endTime
      ? Math.max(0, Math.round((Date.parse(endTime) - Date.parse(startTime)) / 1000))
      : null;
  const distanceMeters = distanceSegments > 0 ? Math.round(distanceSum) : null;
  const elevMeters = altitudeCount > 1 ? Math.round(elevGain) : null;
  const altitudeAvgM = altitudeCount > 0 ? altitudeSum / altitudeCount : null;

  const derivedSpeedKmh =
    speedCount === 0 && distanceMeters !== null && durationSec !== null && durationSec > 0
      ? (distanceMeters / durationSec) * 3.6
      : null;
  const avgSpeedKmh = speedCount > 0 ? (speedSum / speedCount) * 3.6 : derivedSpeedKmh;

  const metrics = {
    time: formatDuration(durationSec),
    distance: formatDistance(distanceMeters),
    elev: formatElev(elevMeters),
  };

  const sport = mapImportSport(firstText(doc, "type") ?? firstText(doc, "sport"));
  const fileName = meta.fileName ?? "unknown.gpx";
  const fileSize = meta.fileSize ?? 0;

  return {
    id: `gpx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source: "gpx",
    fileName,
    fileSize,
    dateLabel: formatDateLabel(startTime),
    metrics,
    startTime,
    endTime,
    durationSec,
    distanceMeters,
    elevMeters,
    altitudeAvgM,
    hasHr: hrCount > 0,
    hasPower: powerCount > 0,
    hasSpeed: speedCount > 0,
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    avgPower: powerCount > 0 ? Math.round(powerSum / powerCount) : null,
    avgSpeed: avgSpeedKmh ?? null,
    sRpe: null,
    sport,
    debug: {
      speedFoundAt: null,
      wattsFoundAt: null,
      sportRaw: null,
      samples: {
        hrAvgBpm: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
        speedAvgKmh: speedCount > 0 ? (speedSum / speedCount) * 3.6 : null,
        wattsAvgW: powerCount > 0 ? Math.round(powerSum / powerCount) : null,
        altitudeAvgM,
        distanceTotalM: distanceCount > 0 ? Math.round(distanceTotal) : null,
        hrCount,
        speedCount,
        wattsCount: powerCount,
        altitudeCount,
        distanceCount,
      },
    },
  };
}

function parseTcxText(text: string, meta: ImportMeta): ImportDraft {
  const doc = parseXmlDocument(text);
  const activity = elemsByLocal(doc, "Activity")[0] ?? null;
  if (!activity) {
    throw new Error("No Activity");
  }

  const sportRaw =
    activity.getAttribute("Sport") ??
    activity.getAttribute("sport") ??
    (text.match(/<Activity[^>]*\bSport=\"([^\"]+)\"/i)?.[1] ?? null);
  const fileName = meta.fileName ?? "unknown.tcx";
  const fileSize = meta.fileSize ?? 0;
  const sport = mapImportSport(sportRaw) ?? mapImportSport(fileName);
  const laps = elemsByLocal(activity, "Lap");
  let startTime: string | null = null;
  let totalDuration = 0;
  let totalDistance = 0;
  let hasDuration = false;
  let hasDistance = false;

  for (const lap of laps) {
    const lapStart = normalizeIso(lap.getAttribute("StartTime"));
    if (lapStart && (!startTime || Date.parse(lapStart) < Date.parse(startTime))) {
      startTime = lapStart;
    }
    const lapDuration = firstNum(lap, "TotalTimeSeconds");
    if (lapDuration !== null) {
      totalDuration += lapDuration;
      hasDuration = true;
    }
    const lapDistance = firstNum(lap, "DistanceMeters");
    if (lapDistance !== null) {
      totalDistance += lapDistance;
      hasDistance = true;
    }
  }

  const activityId = normalizeIso(firstText(activity, "Id"));
  if (!startTime && activityId) {
    startTime = activityId;
  }

  const trackpoints = elemsByLocal(activity, "Trackpoint");
  let firstTime: string | null = null;
  let lastTime: string | null = null;
  let firstDistance: number | null = null;
  let lastDistance: number | null = null;
  let prevAlt: number | null = null;
  let elevGain = 0;
  let altitudeSum = 0;
  let altitudeCount = 0;
  let distanceTotal = 0;
  let distanceCount = 0;
  let hrSum = 0;
  let hrCount = 0;
  let speedSum = 0;
  let speedCount = 0;
  let wattsSum = 0;
  let wattsCount = 0;

  for (const trackpoint of trackpoints) {
    const iso = normalizeIso(firstText(trackpoint, "Time"));
    if (iso) {
      if (!firstTime) {
        firstTime = iso;
      }
      lastTime = iso;
    }

    const distance = firstNum(trackpoint, "DistanceMeters");
    if (distance !== null) {
      distanceCount += 1;
      distanceTotal = distance;
      if (firstDistance === null) {
        firstDistance = distance;
      }
      lastDistance = distance;
    }

    const altitude = firstNum(trackpoint, "AltitudeMeters");
    if (altitude !== null) {
      altitudeSum += altitude;
      altitudeCount += 1;
      if (prevAlt !== null && altitude > prevAlt) {
        elevGain += altitude - prevAlt;
      }
      prevAlt = altitude;
    }

    const hr = toPositiveSample(nestedNum(trackpoint, "HeartRateBpm", "Value"));
    if (hr !== null) {
      hrSum += hr;
      hrCount += 1;
    }

    const tpxSpeed = toPositiveSample(findTpxValue(trackpoint, "Speed"));
    if (tpxSpeed !== null) {
      speedSum += tpxSpeed;
      speedCount += 1;
    }

    const tpxWatts = toPositiveSample(findTpxValue(trackpoint, "Watts"));
    if (tpxWatts !== null) {
      wattsSum += tpxWatts;
      wattsCount += 1;
    }
  }

  if (!startTime && firstTime) {
    startTime = firstTime;
  }

  const durationSec = hasDuration
    ? Math.round(totalDuration)
    : startTime && lastTime
      ? Math.max(0, Math.round((Date.parse(lastTime) - Date.parse(startTime)) / 1000))
      : null;

  const distanceMeters = hasDistance
    ? Math.round(totalDistance)
    : firstDistance !== null && lastDistance !== null
      ? Math.max(0, Math.round(lastDistance - firstDistance))
      : null;

  let endTime = lastTime;
  if (!endTime && startTime && durationSec !== null) {
    endTime = new Date(Date.parse(startTime) + durationSec * 1000).toISOString();
  }

  const derivedSpeed =
    speedCount === 0 && distanceMeters !== null && durationSec !== null && durationSec > 0
      ? distanceMeters / durationSec
      : null;
  const derivedSpeedKmh = derivedSpeed !== null ? derivedSpeed * 3.6 : null;
  const avgSpeedKmh = speedCount > 0 ? (speedSum / speedCount) * 3.6 : derivedSpeedKmh;
  const speedFoundAt =
    speedCount > 0 ? "TPX.Speed" : derivedSpeed !== null ? "DerivedFromDistance" : null;
  const wattsFoundAt = wattsCount > 0 ? "TPX.Watts" : null;
  const altitudeAvgM = altitudeCount > 0 ? altitudeSum / altitudeCount : null;

  const metrics = {
    time: formatDuration(durationSec),
    distance: formatDistance(distanceMeters),
    elev: formatElev(altitudeCount > 1 ? Math.round(elevGain) : null),
  };

  return {
    id: `tcx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source: "tcx",
    fileName,
    fileSize,
    dateLabel: formatDateLabel(startTime),
    metrics,
    startTime,
    endTime,
    durationSec,
    distanceMeters,
    elevMeters: altitudeCount > 1 ? Math.round(elevGain) : null,
    altitudeAvgM,
    hasHr: hrCount > 0,
    hasPower: wattsCount > 0,
    hasSpeed: speedCount > 0 || derivedSpeed !== null,
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    avgPower: wattsCount > 0 ? Math.round(wattsSum / wattsCount) : null,
    avgSpeed: avgSpeedKmh ?? null,
    sRpe: null,
    sport,
    debug: {
      speedFoundAt,
      wattsFoundAt,
      sportRaw,
      samples: {
        hrAvgBpm: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
        speedAvgKmh: speedCount > 0 ? (speedSum / speedCount) * 3.6 : null,
        wattsAvgW: wattsCount > 0 ? Math.round(wattsSum / wattsCount) : null,
        altitudeAvgM,
        distanceTotalM: distanceCount > 0 ? Math.round(distanceTotal) : null,
        hrCount,
        speedCount,
        wattsCount,
        altitudeCount,
        distanceCount,
      },
    },
  };
}

function getFileExtension(name: string) {
  const index = name.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return name.slice(index + 1).toLowerCase();
}

async function readTextSlice(file: File, start: number, length: number) {
  const end = Math.min(file.size, start + length);
  return file.slice(start, end).text();
}

function parseXmlDocument(text: string) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid XML");
  }
  return doc;
}

type XmlParent = Document | Element;

function elemsByLocal(parent: XmlParent, local: string): Element[] {
  const byNs = Array.from(parent.getElementsByTagNameNS("*", local));
  if (byNs.length > 0) {
    return byNs;
  }
  return Array.from(parent.getElementsByTagName(local));
}

function firstElem(parent: XmlParent, local: string): Element | null {
  return elemsByLocal(parent, local)[0] ?? null;
}

function firstText(parent: XmlParent, local: string): string | null {
  const el = firstElem(parent, local);
  const text = el?.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function firstNum(parent: XmlParent, local: string): number | null {
  const text = firstText(parent, local);
  if (!text) {
    return null;
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function nestedNum(parent: XmlParent, parentLocal: string, childLocal: string): number | null {
  const parentEl = firstElem(parent, parentLocal);
  if (!parentEl) {
    return null;
  }
  return firstNum(parentEl, childLocal);
}

function findTpxValue(parent: XmlParent, local: string): number | null {
  const extensions = firstElem(parent, "Extensions");
  if (!extensions) {
    return null;
  }
  const tpx = firstElem(extensions, "TPX") ?? firstElem(extensions, "TrackPointExtension");
  if (!tpx) {
    return null;
  }
  return firstNum(tpx, local);
}

function parseNumberValue(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveSample(value: number | null) {
  if (value === null) {
    return null;
  }
  return value > 0 ? value : null;
}

function normalizeIso(value: string | null) {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function mapImportSport(value: string | null): GpxSport | null {
  if (!value) {
    return null;
  }
  const raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw.includes("swimming") || raw.includes("swim")) return "swim";
  if (raw.includes("running") || raw.includes("run")) return "run";
  if (
    raw.includes("biking") ||
    raw.includes("bike") ||
    raw.includes("cycle") ||
    raw.includes("cycling") ||
    raw.includes("ride")
  ) {
    return "bike";
  }
  return null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

function formatDuration(value: number | null) {
  if (!value || value <= 0) {
    return "--";
  }
  const totalSeconds = Math.round(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(value: number | null) {
  if (value === null) {
    return "--";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }
  return `${Math.round(value)} m`;
}

function formatElev(value: number | null) {
  if (value === null) {
    return "--";
  }
  return `${Math.round(value)} m`;
}

function formatDateLabel(iso: string | null) {
  if (!iso) {
    return "Unknown time";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  const now = new Date();
  const today = now.toDateString();
  const target = date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const label =
    target === today
      ? "Today"
      : target === yesterday.toDateString()
        ? "Yesterday"
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${label}, ${time}`;
}
