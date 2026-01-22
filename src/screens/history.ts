import { clearActivities, deleteActivity, loadActivities, type Activity, type Sport } from "../db";
import bikeSvg from "../assets/icons/focus/bike.svg?raw";
import gymSvg from "../assets/icons/focus/gym.svg?raw";
import hrSvg from "../assets/icons/focus/hr.svg?raw";
import pwrSvg from "../assets/icons/focus/pwr.svg?raw";
import runSvg from "../assets/icons/focus/run.svg?raw";
import spdSvg from "../assets/icons/focus/spd.svg?raw";
import swimSvg from "../assets/icons/focus/swim.svg?raw";

type SportFilter = "all" | "swim" | "bike" | "run" | "other";

const filters: Array<{ id: SportFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "swim", label: "Swim" },
  { id: "bike", label: "Bike" },
  { id: "run", label: "Run" },
  { id: "other", label: "Other" },
];

export function mountHistory(root: HTMLElement) {
  let controller: AbortController | null = null;
  let disposed = false;
  const isDeveloperMode = new URLSearchParams(window.location.search).has("dev");

  const state = {
    activities: [] as Activity[],
    filter: "all" as SportFilter,
  };

  void loadAndRefresh();

  return () => {
    disposed = true;
    controller?.abort();
  };

  async function loadAndRefresh() {
    const activities = await loadActivities();
    if (disposed) {
      return;
    }
    state.activities = activities;
    refresh();
  }

  async function reloadActivities() {
    const activities = await loadActivities();
    if (disposed) {
      return;
    }
    state.activities = activities;
    refresh();
  }

  function refresh() {
    controller?.abort();
    controller = new AbortController();
    render();
    bind(controller.signal);
  }

  function render() {
    const filtered = state.activities.filter((activity) => matchesFilter(activity, state.filter));
    const sorted = [...filtered].sort(compareActivityDesc);

    const cards = sorted.length
      ? sorted.map((activity) => renderActivityCard(activity, isDeveloperMode)).join("")
      : `<div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
           No activities yet.
         </div>`;

    const filterButtons = filters
      .map((item) => {
        const active = state.filter === item.id;
        const base =
          "rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50";
        const activeClass =
          "border border-sky-500/70 bg-sky-500/15 text-sky-200 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]";
        const idleClass = "border border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700";
        return `
          <button
            type="button"
            data-filter="${item.id}"
            class="${base} ${active ? activeClass : idleClass}"
            aria-pressed="${active ? "true" : "false"}"
          >
            ${item.label}
          </button>`;
      })
      .join("");

    const devActions = isDeveloperMode
      ? `
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            data-clear="all"
            class="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-300/60"
          >
            Clear All (Dev)
          </button>
        </div>
      `
      : "";

    root.innerHTML = `
      <div class="min-h-screen bg-slate-950 text-slate-100">
        <div class="mx-auto max-w-[520px] px-5 py-6">
          <header class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">History</h1>
              <p class="mt-1 text-sm text-slate-400">Recent activities from your device</p>
            </div>
          </header>

          <section class="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg shadow-black/20">
            <div class="flex flex-wrap gap-2">
              ${filterButtons}
            </div>
          </section>

          ${devActions}

          <section class="mt-5 space-y-4">
            ${cards}
          </section>
        </div>
      </div>
    `;
  }

  function bind(signal: AbortSignal) {
    const filterButtons = root.querySelectorAll<HTMLButtonElement>("[data-filter]");
    filterButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const next = button.dataset.filter as SportFilter | undefined;
          if (!next || next === state.filter) {
            return;
          }
          state.filter = next;
          refresh();
        },
        { signal },
      );
    });

    const deleteButtons = root.querySelectorAll<HTMLButtonElement>("[data-delete]");
    deleteButtons.forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const id = button.dataset.delete;
          if (!id) {
            return;
          }
          if (!window.confirm("このアクティビティを削除しますか？")) {
            return;
          }
          await deleteActivity(id);
          await reloadActivities();
        },
        { signal },
      );
    });

    const clearButton = root.querySelector<HTMLButtonElement>("[data-clear]");
    clearButton?.addEventListener(
      "click",
      async () => {
        if (!window.confirm("全件削除しますか？")) {
          return;
        }
        await clearActivities();
        await reloadActivities();
      },
      { signal },
    );
  }
}

function renderActivityCard(activity: Activity, showJson: boolean) {
  const sportIcon = activity.sport ? getSportIcon(activity.sport) : "";
  const dateLabel = formatDateLabel(activity.startTime || activity.createdAt);
  const durationLabel = formatDuration(activity.durationSec);
  const distanceLabel = formatDistance(activity.distanceMeters);
  const avgHrLabel = formatAvgHr(activity.avgHr);
  const srpeLabel = activity.sRpe === null ? "--" : String(activity.sRpe);
  const srpeValue = activity.sRpe ?? 0;

  const sensors =
    activity.source !== "manual"
      ? `
        <div class="mt-3 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sensors</span>
          <div class="flex flex-wrap gap-2">
            ${renderSensorBadge("HR", hrSvg, activity.hasHr)}
            ${renderSensorBadge("Pwr", pwrSvg, activity.hasPower)}
            ${renderSensorBadge("Spd", spdSvg, activity.hasSpeed)}
          </div>
        </div>`
      : "";

  const notes =
    activity.source === "manual" && activity.notes
      ? `<div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
           ${escapeHtml(activity.notes)}
         </div>`
      : "";

  const jsonBlock = showJson
    ? `<details class="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
         <summary class="cursor-pointer text-slate-400">Raw JSON</summary>
         <pre class="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">${escapeHtml(
           JSON.stringify(activity, null, 2),
         )}</pre>
       </details>`
    : "";

  return `
    <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60">
            ${
              activity.sport
                ? renderIcon(sportIcon, "h-6 w-6 text-slate-200")
                : `<span class="text-xs font-semibold text-slate-500">?</span>`
            }
          </div>
            <div>
              <div class="text-sm font-semibold text-slate-100">${escapeHtml(activity.title)}</div>
              <div class="text-xs text-slate-400">${escapeHtml(dateLabel)}</div>
            </div>
          </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-delete="${activity.id}"
            class="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-rose-400/60 hover:text-rose-200"
          >
            Delete
          </button>
          <span class="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-300">
            ${activity.source === "gpx" ? "GPX" : activity.source === "tcx" ? "TCX" : "Manual"}
          </span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-900/80 bg-slate-950/60 px-3 py-2 text-center">
        ${renderMetric("Time", durationLabel)}
        ${renderMetric("Distance", distanceLabel)}
        ${renderMetric("AVG HR", avgHrLabel)}
      </div>

      ${sensors}

      <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-slate-200">Perceived Exertion (sRPE)</span>
          <span class="text-sm font-semibold text-sky-200">${srpeLabel} /10</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value="${srpeValue}"
          disabled
          class="mt-3 w-full accent-sky-400 opacity-70"
        />
        <div class="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Easy</span>
          <span>Moderate</span>
          <span>Hard</span>
          <span>Max</span>
        </div>
      </div>

      ${notes}
      ${jsonBlock}
    </div>
  `;
}

function compareActivityDesc(a: Activity, b: Activity) {
  const aStart = toMs(a.startTime) ?? -Infinity;
  const bStart = toMs(b.startTime) ?? -Infinity;
  if (aStart !== bStart) {
    return bStart - aStart;
  }
  const aCreated = toMs(a.createdAt) ?? 0;
  const bCreated = toMs(b.createdAt) ?? 0;
  if (aCreated !== bCreated) {
    return bCreated - aCreated;
  }
  return String(b.id).localeCompare(String(a.id));
}

function toMs(iso?: string | null): number | null {
  if (!iso) {
    return null;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function matchesFilter(activity: Activity, filter: SportFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "other") {
    return activity.sport === null || !["swim", "bike", "run"].includes(activity.sport);
  }
  return activity.sport === filter;
}

function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "--";
  }
  const totalSeconds = Math.round(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }
  return `${Math.round(value)} m`;
}

function formatAvgHr(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return `${Math.round(value)} bpm`;
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

function renderMetric(label: string, value: string) {
  return `
    <div>
      <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${label}</div>
      <div class="mt-1 text-sm font-semibold text-slate-100">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderSensorBadge(label: string, icon: string, active: boolean) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold";
  const activeClass = "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  const idleClass = "border-slate-800 bg-slate-900/40 text-slate-500 opacity-60";
  return `
    <span class="${base} ${active ? activeClass : idleClass}">
      ${renderIcon(icon, "h-3 w-3 text-current")}
      ${label}
    </span>
  `;
}

function getSportIcon(sport: Sport) {
  if (sport === "swim") return swimSvg;
  if (sport === "run") return runSvg;
  if (sport === "strength") return gymSvg;
  return bikeSvg;
}

function withSvgClass(svg: string, cls: string) {
  return svg.replace(/<svg\b([^>]*)>/, (match, attrs) => {
    const hasClass = /class\s*=/.test(attrs);
    if (hasClass) {
      return `<svg${attrs.replace(/class\s*=\s*"([^"]*)"/, `class="$1 ${cls}"`)}>`;
    }
    return `<svg class="${cls}"${attrs}>`;
  });
}

function renderIcon(svg: string, cls: string) {
  const sized = withSvgClass(svg, "h-full w-full");
  return `<span aria-hidden="true" class="inline-flex items-center justify-center ${cls}">${sized}</span>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
