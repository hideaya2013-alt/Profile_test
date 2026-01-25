import {
  loadActivities,
  loadDoctrine,
  loadProfile,
  type Activity,
  type DoctrineData,
  type ProfileData,
} from "../db";

export type ContextPackOptions = {
  includeHistory: boolean;
  historyRange: "7d" | "14d";
  includeRestMenu: boolean;
  includeRecentChat: boolean;
  recentTurns: 2 | 3;
};

export type ContextPackResult = {
  text: string;
  meta: {
    chars: number;
    sections: {
      doctrine: boolean;
      history: boolean;
      restmenu: boolean;
      recentChat: boolean;
    };
    trimmed: boolean;
  };
  debug?: {
    doctrineText: string;
    historyText: string;
    restText: string;
    recentChatText: string;
  };
};

type SectionKey = "always" | "doctrine" | "history" | "restmenu" | "recentChat";

type SectionData = {
  title: string;
  body: string;
  enabled: boolean;
};

type LoadErrors = {
  profile: boolean;
  doctrine: boolean;
  history: boolean;
};

const MAX_MESSAGE_CHARS = 600;
const MAX_TOTAL_CHARS = 6000;

export async function buildContextPack(opts: ContextPackOptions): Promise<ContextPackResult> {
  const errors: LoadErrors = { profile: false, doctrine: false, history: false };
  let trimmed = false;

  const profile = await safeLoadProfile(errors);
  const doctrine = await safeLoadDoctrine(errors);
  const activities = await safeLoadActivities(errors);

  const doctrineBody = buildDoctrineBody(doctrine, errors.doctrine);
  const alwaysBody = `${buildAlwaysBody(profile, errors.profile)}\n\n${doctrineBody}`;
  const historyBody = opts.includeHistory
    ? buildHistoryBody(activities, toHistoryCount(opts.historyRange), errors.history, (value) => {
        const next = trimMessage(value, MAX_MESSAGE_CHARS);
        if (next.trimmed) trimmed = true;
        return next.text;
      })
    : "(no data)";
  const restMenuBody = opts.includeRestMenu ? "(no data)" : "(no data)";
  const recentChatBody = opts.includeRecentChat
    ? buildRecentChatBody(opts.recentTurns, (value) => {
        const next = trimMessage(value, MAX_MESSAGE_CHARS);
        if (next.trimmed) trimmed = true;
        return next.text;
      })
    : "(no data)";

  const sections: Record<SectionKey, SectionData> = {
    always: {
      title: "ALWAYS",
      body: alwaysBody,
      enabled: true,
    },
    doctrine: {
      title: "DOCTRINE",
      body: "(included in ALWAYS)",
      enabled: true,
    },
    history: {
      title: `HISTORY: ${opts.historyRange}`,
      body: historyBody,
      enabled: opts.includeHistory,
    },
    restmenu: {
      title: "RESTMENU",
      body: restMenuBody,
      enabled: opts.includeRestMenu,
    },
    recentChat: {
      title: "RECENT CHAT",
      body: recentChatBody,
      enabled: opts.includeRecentChat,
    },
  };

  let text = assembleSections(sections);
  if (text.length > MAX_TOTAL_CHARS) {
    trimmed = true;
    const removalOrder: SectionKey[] = ["recentChat", "restmenu", "history"];
    for (const key of removalOrder) {
      if (!sections[key].enabled) {
        continue;
      }
      sections[key].enabled = false;
      text = assembleSections(sections);
      if (text.length <= MAX_TOTAL_CHARS) {
        break;
      }
    }
    if (text.length > MAX_TOTAL_CHARS) {
      text = `${text.slice(0, MAX_TOTAL_CHARS)}...(trimmed)`;
    }
  }

  return {
    text,
    meta: {
      chars: text.length,
      sections: {
        doctrine: sections.doctrine.enabled,
        history: sections.history.enabled,
        restmenu: sections.restmenu.enabled,
        recentChat: sections.recentChat.enabled,
      },
      trimmed,
    },
    debug: {
      doctrineText: doctrineBody,
      historyText: historyBody,
      restText: restMenuBody,
      recentChatText: recentChatBody,
    },
  };
}

async function safeLoadProfile(errors: LoadErrors): Promise<ProfileData | null> {
  try {
    return await loadProfile();
  } catch (error) {
    console.error("context pack: loadProfile failed", error);
    errors.profile = true;
    return null;
  }
}

async function safeLoadDoctrine(errors: LoadErrors): Promise<DoctrineData | null> {
  try {
    return await loadDoctrine();
  } catch (error) {
    console.error("context pack: loadDoctrine failed", error);
    errors.doctrine = true;
    return null;
  }
}

async function safeLoadActivities(errors: LoadErrors): Promise<Activity[]> {
  try {
    return await loadActivities();
  } catch (error) {
    console.error("context pack: loadActivities failed", error);
    errors.history = true;
    return [];
  }
}

function buildAlwaysBody(profile: ProfileData | null, loadError: boolean) {
  const lines: string[] = [];
  lines.push("Profile:");
  if (loadError) {
    lines.push("(error: loadProfile failed)");
  } else if (!profile) {
    lines.push("(no data)");
  } else {
    lines.push(`age: ${safeTrim(profile.age)}`);
    lines.push(`heightCm: ${safeTrim(profile.heightCm)}`);
    lines.push(`weightKg: ${safeTrim(profile.weightKg)}`);
    lines.push(`ftpW: ${safeTrim(profile.ftpW)}`);
    lines.push(`vo2max: ${safeTrim(profile.vo2max)}`);
    const focus = Array.isArray(profile.trainingFocus) ? profile.trainingFocus.join(", ") : "";
    lines.push(`trainingFocus: ${safeTrim(focus) || "(no data)"}`);
    lines.push(`trackSessionRpe: ${profile.trackSessionRpe ? "true" : "false"}`);
  }
  lines.push("");
  lines.push("Rules:");
  lines.push("- Source of truth is DB.");
  lines.push("- Missing values are null.");
  return lines.join("\n");
}

function buildDoctrineBody(doctrine: DoctrineData | null, loadError: boolean) {
  if (loadError) {
    return "(error: loadDoctrine failed)";
  }
  if (!doctrine) {
    return "(no data)";
  }
  const items: Array<[string, string]> = [
    ["Short-term goal", safeTrim(doctrine.shortTermGoal)],
    ["Season goal", safeTrim(doctrine.seasonGoal)],
    ["Constraints", safeTrim(doctrine.constraints)],
    ["Doctrine / Principles", safeTrim(doctrine.doctrine)],
  ];
  const nonEmpty = items.filter(([, value]) => value.length > 0);
  if (nonEmpty.length === 0) {
    return "(no data)";
  }
  return nonEmpty.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function buildHistoryBody(
  activities: Activity[],
  range: number,
  loadError: boolean,
  trimLine: (value: string) => string,
) {
  if (loadError) {
    return "(error: loadActivities failed)";
  }
  if (!activities.length) {
    return "(no data)";
  }
  const grouped = groupActivitiesByDay(activities);
  const orderedDays = Array.from(grouped.values())
    .sort((a, b) => (b.latestMs ?? -Infinity) - (a.latestMs ?? -Infinity))
    .slice(0, range);
  if (orderedDays.length === 0) {
    return "(no data)";
  }
  const lines: string[] = [];
  orderedDays.forEach((group, index) => {
    if (index > 0) {
      lines.push("");
    }
    lines.push(group.dayKey);
    group.items.forEach((activity) => {
      const json = safeStringify(activity);
      lines.push(trimLine(json));
    });
  });
  return lines.join("\n");
}

function buildRecentChatBody(turns: 2 | 3, trimLine: (value: string) => string) {
  const placeholder = "(no data)";
  const lines = Array.from({ length: turns }, (_, index) =>
    trimLine(`- turn ${index + 1}: ${placeholder}`),
  );
  return lines.join("\n");
}

function groupActivitiesByDay(activities: Activity[]) {
  const map = new Map<string, { dayKey: string; latestMs: number | null; items: Activity[] }>();
  activities.forEach((activity) => {
    const ms =
      parseIso(activity.startTime) ??
      parseIso(activity.createdAt) ??
      parseIso(activity.updatedAt);
    const dayKey = ms ? new Date(ms).toISOString().slice(0, 10) : "unknown";
    const current = map.get(dayKey);
    const latestMs = ms ?? current?.latestMs ?? null;
    const nextLatest =
      latestMs === null ? ms : ms === null ? latestMs : Math.max(latestMs, ms);
    if (current) {
      current.items.push(activity);
      current.latestMs = nextLatest ?? current.latestMs;
    } else {
      map.set(dayKey, { dayKey, latestMs: nextLatest ?? null, items: [activity] });
    }
  });
  return map;
}

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function toHistoryCount(range: "7d" | "14d") {
  return range === "14d" ? 14 : 7;
}

function trimMessage(value: string, limit: number) {
  if (value.length <= limit) {
    return { text: value, trimmed: false };
  }
  return { text: `${value.slice(0, limit)}...(trimmed)`, trimmed: true };
}

function assembleSections(sections: Record<SectionKey, SectionData>) {
  const order: SectionKey[] = ["always", "doctrine", "history", "restmenu", "recentChat"];
  return order
    .filter((key) => sections[key].enabled)
    .map((key) => `[${sections[key].title}]\n${sections[key].body || "(no data)"}`)
    .join("\n\n");
}

function safeTrim(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, (_key, val) => (val === undefined ? null : val));
  } catch (error) {
    console.error("context pack: stringify failed", error);
    return "(error: stringify failed)";
  }
}
