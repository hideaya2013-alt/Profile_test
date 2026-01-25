import { loadDoctrine, saveDoctrine, type DoctrineData } from "../db";
import alertSvg from "../assets/icons/common/alert.svg?raw";
import {
  buildContextPack,
  type ContextPackOptions,
  type ContextPackResult,
} from "../services/contextPackService";
import checkSvg from "../assets/icons/common/check.svg?raw";
import editSvg from "../assets/icons/common/edit.svg?raw";
import syncSvg from "../assets/icons/common/sync.svg?raw";

type HistoryRange = "7d" | "14d";
type SaveFlash = "saved" | "fault" | null;
const API_BASE_RAW = import.meta.env.VITE_API_BASE ?? "";
const API_BASE = API_BASE_RAW.replace(/\/$/, "");

const SYNCED_CLASSES =
  "text-sky-200 border-sky-400/40 bg-sky-500/10";
const UNSYNC_CLASSES =
  "text-rose-300 border-rose-400/40 bg-rose-500/10";
const CONNECTED_CLASSES =
  "text-emerald-300 border-emerald-400/40 bg-emerald-500/10";
const OFFLINE_CLASSES =
  "text-slate-400 border-slate-700/60 bg-slate-900/40";
const RESYNC_DISABLED_CLASSES =
  "opacity-60 cursor-not-allowed border-slate-800 text-slate-500";
const RESYNC_ENABLED_CLASSES =
  "border-slate-700 text-slate-200 hover:border-slate-500";
const HISTORY_BASE_CLASSES =
  "flex-1 whitespace-nowrap text-center rounded-full px-3 py-1 text-xs font-semibold transition";
const HISTORY_ACTIVE_CLASSES =
  "border border-sky-400/60 bg-sky-500/20 text-sky-200";
const HISTORY_IDLE_CLASSES =
  "border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700";
const SAVE_IDLE_CLASSES =
  "text-slate-100 border-slate-500/70";
const SAVE_SAVED_CLASSES =
  "text-emerald-400 border-emerald-400/50 " +
  "ring-2 ring-emerald-400/60 " +
  "shadow-[0_0_0_1px_rgba(16,185,129,0.25)] " +
  "cursor-not-allowed";
const SAVE_FAULT_CLASSES =
  "text-rose-400 border-rose-400/50 " +
  "ring-2 ring-rose-400/60 " +
  "shadow-[0_0_0_1px_rgba(244,63,94,0.25)] " +
  "cursor-not-allowed";
const SAVE_DISABLED_CLASSES =
  "text-slate-400 border-slate-600/60 cursor-not-allowed opacity-70";

export function mountTriCoachChat(root: HTMLElement) {
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let healthAbort: AbortController | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();
  const isDev = new URLSearchParams(location.search).has("dev");
  let devPayload: ContextPackResult | null = null;
  let devPayloadKey = "";
  let devPayloadLoading = false;
  let devPayloadError: string | null = null;

  const state = {
    connected: false,
    dirty: false,
    historyRange: "7d" as HistoryRange,
    restMenuOn: false,
    hasPlanPatch: false,
    devPanelOpen: false,
    lastHealthAt: "-" as string,
    lastHealthResult: "-" as string,
    doctrine: null as DoctrineData | null,
    draft: {
      shortTermGoal: "",
      seasonGoal: "",
      constraints: "",
      doctrine: "",
    },
    editOpen: false,
    saveFlash: null as SaveFlash,
  };

  const ui = {
    syncPill: null as HTMLDivElement | null,
    syncLabel: null as HTMLSpanElement | null,
    syncIcon: null as HTMLSpanElement | null,
    resyncButton: null as HTMLButtonElement | null,
    connectedPill: null as HTMLDivElement | null,
    connectedLabel: null as HTMLSpanElement | null,
    historyButtons: [] as HTMLButtonElement[],
    restMenuLabel: null as HTMLSpanElement | null,
    restMenuInput: null as HTMLInputElement | null,
    confirmUpdate: null as HTMLButtonElement | null,
    chatInput: null as HTMLTextAreaElement | null,
    sendButton: null as HTMLButtonElement | null,
    devPanel: null as HTMLDivElement | null,
    devToggle: null as HTMLButtonElement | null,
    devContent: null as HTMLDivElement | null,
    devApiBase: null as HTMLSpanElement | null,
    devConnected: null as HTMLSpanElement | null,
    devHealthAt: null as HTMLSpanElement | null,
    devHealthResult: null as HTMLSpanElement | null,
    devHistoryRange: null as HTMLSpanElement | null,
    devRestMenu: null as HTMLSpanElement | null,
    devPackChars: null as HTMLSpanElement | null,
    devPackPreview: null as HTMLPreElement | null,
    devPackJson: null as HTMLPreElement | null,
    devPackFull: null as HTMLPreElement | null,
    devSectionAlways: null as HTMLSpanElement | null,
    devSectionDoctrine: null as HTMLSpanElement | null,
    devSectionHistory: null as HTMLSpanElement | null,
    devSectionRest: null as HTMLSpanElement | null,
    devSectionRecent: null as HTMLSpanElement | null,
    devCopyStatus: null as HTMLSpanElement | null,
    devCopyButton: null as HTMLButtonElement | null,
    devRebuildButton: null as HTMLButtonElement | null,
    overlay: null as HTMLDivElement | null,
    overlayUpdatedAt: null as HTMLSpanElement | null,
    saveButton: null as HTMLButtonElement | null,
    returnButton: null as HTMLButtonElement | null,
    textareas: {} as Record<keyof typeof state.draft, HTMLTextAreaElement>,
  };

  renderOnce();
  bindOnce(controller.signal);
  startHealthCheck();
  void loadDoctrineData();
  updateAllUI();

  return () => {
    controller.abort();
    if (healthTimer) {
      clearInterval(healthTimer);
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    healthAbort?.abort();
  };

  async function loadDoctrineData() {
    const doctrine = await loadDoctrine();
    state.doctrine = doctrine;
    if (!state.dirty) {
      state.draft = {
        shortTermGoal: doctrine.shortTermGoal,
        seasonGoal: doctrine.seasonGoal,
        constraints: doctrine.constraints,
        doctrine: doctrine.doctrine,
      };
      if (state.editOpen) {
        updateOverlayFieldsFromDraft();
      }
    }
    updateAllUI();
  }

  function startHealthCheck() {
    void checkHealth();
    healthTimer = setInterval(() => {
      void checkHealth();
    }, 12000);
  }

  async function checkHealth() {
    healthAbort?.abort();
    healthAbort = new AbortController();
    const stamp = new Date().toISOString();
    try {
      const url = `${API_BASE}/health`;
      const res = await fetch(url, { cache: "no-store", signal: healthAbort.signal });
      const next = res.ok;
      const result = next ? "ok" : "not-ok";
      state.lastHealthAt = stamp;
      state.lastHealthResult = result;
      if (next !== state.connected) {
        state.connected = next;
        updateConnectedUI();
      }
      updateDevPanelUI();
    } catch (error) {
      console.error("health check failed", error);
      if (state.connected) {
        state.connected = false;
        updateConnectedUI();
      }
      state.lastHealthAt = stamp;
      state.lastHealthResult = "fetch-error";
      updateDevPanelUI();
    }
  }

  function computeDirty(draft: typeof state.draft, doctrine: DoctrineData | null) {
    if (!doctrine) {
      return false;
    }
    return (
      draft.shortTermGoal !== doctrine.shortTermGoal ||
      draft.seasonGoal !== doctrine.seasonGoal ||
      draft.constraints !== doctrine.constraints ||
      draft.doctrine !== doctrine.doctrine
    );
  }

  function updateDraft(field: keyof typeof state.draft, value: string) {
    state.draft = { ...state.draft, [field]: value };
    state.dirty = computeDirty(state.draft, state.doctrine);
    updateSyncUI();
    updateDoctrineSaveUI();
  }

  function openDoctrineEdit() {
    if (!state.doctrine) {
      return;
    }
    state.draft = {
      shortTermGoal: state.doctrine.shortTermGoal,
      seasonGoal: state.doctrine.seasonGoal,
      constraints: state.doctrine.constraints,
      doctrine: state.doctrine.doctrine,
    };
    state.dirty = false;
    state.editOpen = true;
    updateOverlayFieldsFromDraft();
    updateOverlayVisibility();
    updateSyncUI();
    updateDoctrineSaveUI();
  }

  function closeDoctrineEdit() {
    state.editOpen = false;
    updateOverlayVisibility();
  }

  function allFieldsEmpty() {
    const values = Object.values(state.draft).map((value) => value.trim());
    return values.every((value) => value.length === 0);
  }

  function clearSaveFlash() {
    state.saveFlash = null;
    updateDoctrineSaveUI();
  }

  async function handleDoctrineSave() {
    if (!state.doctrine || !state.dirty || allFieldsEmpty()) {
      return;
    }
    const payload: DoctrineData = {
      shortTermGoal: state.draft.shortTermGoal.trim(),
      seasonGoal: state.draft.seasonGoal.trim(),
      constraints: state.draft.constraints.trim(),
      doctrine: state.draft.doctrine.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveDoctrine(payload);
      state.doctrine = payload;
      state.dirty = false;
      state.saveFlash = "saved";
    } catch {
      state.saveFlash = "fault";
    }
    updateSyncUI();
    updateDoctrineSaveUI();
    updateOverlayUpdatedAt();
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(clearSaveFlash, 700);
  }

  function handleDoctrineReturn() {
    if (!state.dirty) {
      closeDoctrineEdit();
      return;
    }
    const ok = window.confirm("Discard changes and return?");
    if (!ok) {
      return;
    }
    if (state.doctrine) {
      state.draft = {
        shortTermGoal: state.doctrine.shortTermGoal,
        seasonGoal: state.doctrine.seasonGoal,
        constraints: state.doctrine.constraints,
        doctrine: state.doctrine.doctrine,
      };
      updateOverlayFieldsFromDraft();
    }
    state.dirty = false;
    updateSyncUI();
    closeDoctrineEdit();
  }

  function renderOnce() {
    root.innerHTML = `
      <div class="min-h-screen bg-slate-950 text-slate-100">
        <div class="mx-auto max-w-[520px] px-5 py-6 pb-24">
          <header class="flex flex-col gap-2">
            <h1 class="text-2xl font-semibold tracking-tight">TriCoach AI</h1>
            <div class="flex flex-wrap items-center gap-3">
              <div data-sync-pill class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${SYNCED_CLASSES}">
                <span data-sync-icon>${renderIcon(checkSvg, "h-4 w-4 text-current")}</span>
                <span data-sync-label>SYNCED</span>
              </div>
              <button
                type="button"
                data-resync="true"
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${RESYNC_DISABLED_CLASSES}"
                disabled
              >
                ${renderIcon(syncSvg, "h-4 w-4 text-current")}
                Resync
              </button>
              <div data-connected-pill class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${OFFLINE_CLASSES}">
                ${renderIcon(checkSvg, "h-4 w-4 text-current")}
                <span data-connected-label>OFFLINE</span>
              </div>
            </div>
          </header>

          <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg shadow-black/20">
            <div class="grid grid-cols-3 gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Doctrine</div>
              <div class="text-center">History</div>
              <div class="text-right">RestMenu</div>
            </div>
            <div class="mt-3 grid grid-cols-3 items-center gap-3">
              <button
                type="button"
                data-doctrine="open"
                class="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm font-semibold text-slate-200 hover:border-slate-700"
              >
                ${renderIcon(editSvg, "h-4 w-4 text-slate-200")}
                Edit
              </button>
              <div class="flex flex-nowrap items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3">
                <button
                  type="button"
                  data-range="7d"
                  class="${HISTORY_BASE_CLASSES} ${HISTORY_ACTIVE_CLASSES}"
                >
                  7 Day
                </button>
                <button
                  type="button"
                  data-range="14d"
                  class="${HISTORY_BASE_CLASSES} ${HISTORY_IDLE_CLASSES}"
                >
                  14 Day
                </button>
              </div>
              <label
                class="flex items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm font-semibold text-slate-200"
              >
                <span data-restmenu-label class="text-xs font-semibold uppercase tracking-wide text-slate-400">OFF</span>
                <span class="relative">
                  <input
                    data-restmenu-input
                    type="checkbox"
                    role="switch"
                    class="peer sr-only"
                  />
                  <div
                    class="h-6 w-11 rounded-full bg-slate-800 transition peer-checked:bg-sky-500/80 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950"
                  ></div>
                  <div
                    class="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-slate-200 transition peer-checked:translate-x-5 peer-checked:bg-white"
                  ></div>
                </span>
              </label>
            </div>
          </section>

          <section class="mt-6 space-y-4">
            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">TriCoach</div>
              <div class="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
                Good morning! Based on your recent sessions, I adjusted today's workout.
              </div>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">You</div>
              <div class="mt-3 rounded-2xl border border-slate-800 bg-sky-500/20 p-4 text-sm text-slate-100">
                Thanks. Should I keep the duration the same?
              </div>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">TriCoach</div>
              <div class="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
                Let's reduce the duration by 15 minutes to prioritize recovery.
              </div>
              <button
                type="button"
                data-confirm-update="true"
                class="mt-3 hidden rounded-full border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-200"
              >
                Confirm Update
              </button>
            </div>
          </section>

          <div class="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4">
            <div class="mx-auto flex max-w-[520px] items-center gap-3">
              <textarea
                data-chat-input
                rows="2"
                placeholder="Ask Coach about your plan..."
                class="flex-1 resize-none rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
              ></textarea>
              <button
                type="button"
                data-send
                class="h-11 w-11 rounded-full border border-slate-800 bg-sky-500/30 text-sky-100"
              >
                >
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        data-dev-panel
        ${isDev ? "" : "hidden"}
        class="fixed bottom-20 left-0 right-0 z-40 px-4"
      >
        <div class="mx-auto max-w-[520px] rounded-2xl border border-slate-800 bg-slate-950/95 shadow-lg shadow-black/40">
          <button
            type="button"
            data-dev-toggle
            class="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Dev Panel
            <span data-dev-toggle-icon class="text-slate-500">▾</span>
          </button>
          <div data-dev-content class="px-4 pb-4 text-xs text-slate-300">
            <div class="space-y-2 border-t border-slate-800 pt-3">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Env / Network</div>
              <div>VITE_API_BASE: <span data-dev-api-base class="text-slate-200"></span></div>
              <div>connected: <span data-dev-connected class="text-slate-200"></span></div>
              <div>lastHealthAt: <span data-dev-health-at class="text-slate-200"></span></div>
              <div>lastHealthResult: <span data-dev-health-result class="text-slate-200"></span></div>
            </div>
            <div class="mt-3 space-y-1">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Context selection</div>
              <div>Always: ON</div>
              <div>historyRange: <span data-dev-history-range class="text-slate-200"></span></div>
              <div>restMenuOn: <span data-dev-restmenu class="text-slate-200"></span></div>
            </div>
            <div class="mt-3 space-y-2">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payload preview</div>
              <div>
                chars: <span data-dev-pack-chars class="text-slate-200"></span>
              </div>
              <div class="text-[11px] text-slate-400">
                sections:
                always=<span data-dev-sec-always class="text-slate-200"></span>,
                doctrine=<span data-dev-sec-doctrine class="text-slate-200"></span>,
                history=<span data-dev-sec-history class="text-slate-200"></span>,
                restmenu=<span data-dev-sec-rest class="text-slate-200"></span>,
                recent=<span data-dev-sec-recent class="text-slate-200"></span>
              </div>
              <pre data-dev-pack-preview class="max-h-32 overflow-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-200"></pre>
              <details class="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <summary class="cursor-pointer text-[11px] font-semibold text-slate-400">FULL PAYLOAD</summary>
                <pre data-dev-pack-full class="mt-2 whitespace-pre-wrap text-[11px] text-slate-200"></pre>
              </details>
              <details class="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <summary class="cursor-pointer text-[11px] font-semibold text-slate-400">JSON</summary>
                <pre data-dev-pack-json class="mt-2 whitespace-pre-wrap text-[11px] text-slate-200"></pre>
              </details>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-dev-copy
                class="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
              >
                Copy Pack
              </button>
              <button
                type="button"
                data-dev-rebuild
                class="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
              >
                Rebuild Pack
              </button>
              <span data-dev-copy-status class="text-[11px] text-slate-400"></span>
            </div>
          </div>
        </div>
      </div>

      <div data-overlay hidden class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95">
        <div class="mx-auto max-w-[520px] px-5 py-6">
          <header>
            <h2 class="text-2xl font-semibold tracking-tight">Doctrine Edit</h2>
            <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Training Intent / Doctrine
            </p>
            <div class="mt-2 text-xs text-slate-400">
              Last updated: <span data-doctrine-updated>--</span>
            </div>
          </header>

          <div class="mt-6 space-y-5">
            ${renderDoctrineField("Short-term goal", "shortTermGoal", "Define your immediate objectives...")}
            ${renderDoctrineField("Season goal", "seasonGoal", "What is your main target for the season?")}
            ${renderDoctrineField("Constraints", "constraints", "Days off, injuries, time limits...")}
            ${renderDoctrineField("Doctrine / Principles", "doctrine", "Your guiding training philosophy...")}
          </div>

          <div class="mt-8 flex flex-col gap-3">
            <button
              type="button"
              data-doctrine-save="true"
              class="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold ${SAVE_IDLE_CLASSES}"
            >
              Save Configuration
            </button>
            <button
              type="button"
              data-doctrine-return="true"
              class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-600"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    `;

    ui.syncPill = root.querySelector("[data-sync-pill]");
    ui.syncLabel = root.querySelector("[data-sync-label]");
    ui.syncIcon = root.querySelector("[data-sync-icon]");
    ui.resyncButton = root.querySelector("[data-resync]");
    ui.connectedPill = root.querySelector("[data-connected-pill]");
    ui.connectedLabel = root.querySelector("[data-connected-label]");
    ui.historyButtons = Array.from(root.querySelectorAll("[data-range]"));
    ui.restMenuLabel = root.querySelector("[data-restmenu-label]");
    ui.restMenuInput = root.querySelector("[data-restmenu-input]");
    ui.confirmUpdate = root.querySelector("[data-confirm-update]");
    ui.chatInput = root.querySelector("[data-chat-input]");
    ui.sendButton = root.querySelector("[data-send]");
    ui.devPanel = root.querySelector("[data-dev-panel]");
    ui.devToggle = root.querySelector("[data-dev-toggle]");
    ui.devContent = root.querySelector("[data-dev-content]");
    ui.devApiBase = root.querySelector("[data-dev-api-base]");
    ui.devConnected = root.querySelector("[data-dev-connected]");
    ui.devHealthAt = root.querySelector("[data-dev-health-at]");
    ui.devHealthResult = root.querySelector("[data-dev-health-result]");
    ui.devHistoryRange = root.querySelector("[data-dev-history-range]");
    ui.devRestMenu = root.querySelector("[data-dev-restmenu]");
    ui.devPackChars = root.querySelector("[data-dev-pack-chars]");
    ui.devPackPreview = root.querySelector("[data-dev-pack-preview]");
    ui.devPackJson = root.querySelector("[data-dev-pack-json]");
    ui.devPackFull = root.querySelector("[data-dev-pack-full]");
    ui.devSectionAlways = root.querySelector("[data-dev-sec-always]");
    ui.devSectionDoctrine = root.querySelector("[data-dev-sec-doctrine]");
    ui.devSectionHistory = root.querySelector("[data-dev-sec-history]");
    ui.devSectionRest = root.querySelector("[data-dev-sec-rest]");
    ui.devSectionRecent = root.querySelector("[data-dev-sec-recent]");
    ui.devCopyStatus = root.querySelector("[data-dev-copy-status]");
    ui.devCopyButton = root.querySelector("[data-dev-copy]");
    ui.devRebuildButton = root.querySelector("[data-dev-rebuild]");
    ui.overlay = root.querySelector("[data-overlay]");
    ui.overlayUpdatedAt = root.querySelector("[data-doctrine-updated]");
    ui.saveButton = root.querySelector("[data-doctrine-save]");
    ui.returnButton = root.querySelector("[data-doctrine-return]");
    ui.textareas.shortTermGoal = root.querySelector("[data-doctrine-field=\"shortTermGoal\"]")!;
    ui.textareas.seasonGoal = root.querySelector("[data-doctrine-field=\"seasonGoal\"]")!;
    ui.textareas.constraints = root.querySelector("[data-doctrine-field=\"constraints\"]")!;
    ui.textareas.doctrine = root.querySelector("[data-doctrine-field=\"doctrine\"]")!;
  }

  function bindOnce(signal: AbortSignal) {
    ui.resyncButton?.addEventListener(
      "click",
      async () => {
        if (!state.dirty) {
          return;
        }
        await loadDoctrineData();
        state.dirty = false;
        updateSyncUI();
      },
      { signal },
    );

    ui.historyButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const value = button.dataset.range as HistoryRange | undefined;
          if (!value || value === state.historyRange) {
            return;
          }
          state.historyRange = value;
          updateHistoryUI();
        },
        { signal },
      );
    });

    ui.restMenuInput?.addEventListener(
      "change",
      () => {
        state.restMenuOn = ui.restMenuInput?.checked ?? false;
        updateRestMenuUI();
      },
      { signal },
    );

    const doctrineButton = root.querySelector<HTMLButtonElement>("[data-doctrine]");
    doctrineButton?.addEventListener(
      "click",
      () => {
        openDoctrineEdit();
      },
      { signal },
    );

    Object.entries(ui.textareas).forEach(([field, textarea]) => {
      textarea.addEventListener(
        "input",
        () => {
          updateDraft(field as keyof typeof state.draft, textarea.value);
        },
        { signal },
      );
    });

    ui.saveButton?.addEventListener(
      "click",
      () => {
        void handleDoctrineSave();
      },
      { signal },
    );

    ui.returnButton?.addEventListener(
      "click",
      () => {
        handleDoctrineReturn();
      },
      { signal },
    );

    ui.sendButton?.addEventListener(
      "click",
      () => {
        handleSend();
      },
      { signal },
    );

    ui.devToggle?.addEventListener(
      "click",
      () => {
        state.devPanelOpen = !state.devPanelOpen;
        updateDevPanelUI();
      },
      { signal },
    );

    ui.devCopyButton?.addEventListener(
      "click",
      () => {
        void handleCopyPack();
      },
      { signal },
    );

    ui.devRebuildButton?.addEventListener(
      "click",
      () => {
        updateDevPanelUI(true);
      },
      { signal },
    );

    ui.chatInput?.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") {
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleSend();
        }
      },
      { signal },
    );
  }

  function updateAllUI() {
    updateSyncUI();
    updateConnectedUI();
    updateHistoryUI();
    updateRestMenuUI();
    updateConfirmUpdateUI();
    updateOverlayVisibility();
    updateOverlayUpdatedAt();
    updateDoctrineSaveUI();
    updateDevPanelUI();
  }

  function updateSyncUI() {
    if (!ui.syncPill || !ui.syncLabel || !ui.resyncButton || !ui.syncIcon) {
      return;
    }
    const synced = !state.dirty;
    ui.syncLabel.textContent = synced ? "SYNCED" : "UNSYNC";
    ui.syncIcon.innerHTML = renderIcon(synced ? checkSvg : alertSvg, "h-4 w-4 text-current");
    ui.syncPill.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
      synced ? SYNCED_CLASSES : UNSYNC_CLASSES
    }`;
    ui.resyncButton.disabled = synced;
    ui.resyncButton.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
      synced ? RESYNC_DISABLED_CLASSES : RESYNC_ENABLED_CLASSES
    }`;
  }

  function updateConnectedUI() {
    if (!ui.connectedPill || !ui.connectedLabel) {
      return;
    }
    const connected = state.connected;
    ui.connectedLabel.textContent = connected ? "CONNECTED" : "OFFLINE";
    ui.connectedPill.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
      connected ? CONNECTED_CLASSES : OFFLINE_CLASSES
    }`;
  }

  function updateHistoryUI() {
    ui.historyButtons.forEach((button) => {
      const value = button.dataset.range as HistoryRange | undefined;
      const active = value === state.historyRange;
      button.className = `${HISTORY_BASE_CLASSES} ${
        active ? HISTORY_ACTIVE_CLASSES : HISTORY_IDLE_CLASSES
      }`;
    });
    updateDevPanelUI();
  }

  function updateRestMenuUI() {
    if (!ui.restMenuLabel || !ui.restMenuInput) {
      return;
    }
    ui.restMenuLabel.textContent = state.restMenuOn ? "ON" : "OFF";
    ui.restMenuInput.checked = state.restMenuOn;
    updateDevPanelUI();
  }

  function updateConfirmUpdateUI() {
    if (!ui.confirmUpdate) {
      return;
    }
    ui.confirmUpdate.classList.toggle("hidden", !state.hasPlanPatch);
  }

  function updateOverlayVisibility() {
    if (!ui.overlay) {
      return;
    }
    ui.overlay.hidden = !state.editOpen;
  }

  function updateOverlayFieldsFromDraft() {
    Object.entries(ui.textareas).forEach(([field, textarea]) => {
      textarea.value = state.draft[field as keyof typeof state.draft];
    });
  }

  function updateOverlayUpdatedAt() {
    if (!ui.overlayUpdatedAt) {
      return;
    }
    const updatedAt = state.doctrine?.updatedAt
      ? new Date(state.doctrine.updatedAt).toLocaleString()
      : "--";
    ui.overlayUpdatedAt.textContent = updatedAt;
  }

  function updateDoctrineSaveUI() {
    if (!ui.saveButton) {
      return;
    }
    const flashing = state.saveFlash !== null;
    const saveDisabled = flashing || !state.dirty || allFieldsEmpty();
    const label =
      state.saveFlash === "saved"
        ? "✓ Saved"
        : state.saveFlash === "fault"
          ? "✕ Fault"
          : "Save Configuration";
    const tone =
      state.saveFlash === "saved"
        ? SAVE_SAVED_CLASSES
        : state.saveFlash === "fault"
          ? SAVE_FAULT_CLASSES
          : SAVE_IDLE_CLASSES;
    const enabledClass =
      "hover:border-slate-300/70 hover:text-white " +
      "active:translate-y-[1px] " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60";
    const disabledClass = saveDisabled ? SAVE_DISABLED_CLASSES : enabledClass;
    ui.saveButton.textContent = label;
    ui.saveButton.className = `inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold ${tone} ${disabledClass}`;
    ui.saveButton.disabled = saveDisabled;
  }

  function getContextPackOptions(): ContextPackOptions {
    return {
      includeHistory: true,
      historyRange: state.historyRange,
      includeRestMenu: state.restMenuOn,
      includeRecentChat: true,
      recentTurns: 2,
    };
  }

  function updateDevPanelPayloadUI() {
    if (!ui.devPackPreview || !ui.devPackJson || !ui.devPackChars) {
      return;
    }
    if (!devPayload) {
      const fallback = devPayloadError ? `(error: ${devPayloadError})` : "(no data)";
      ui.devPackPreview.textContent = fallback;
      ui.devPackJson.textContent = fallback;
      ui.devPackChars.textContent = "0";
      if (ui.devPackFull) {
        ui.devPackFull.textContent = fallback;
      }
      if (ui.devSectionAlways) {
        ui.devSectionAlways.textContent = "true";
      }
      if (ui.devSectionDoctrine) {
        ui.devSectionDoctrine.textContent = "false";
      }
      if (ui.devSectionHistory) {
        ui.devSectionHistory.textContent = "false";
      }
      if (ui.devSectionRest) {
        ui.devSectionRest.textContent = "false";
      }
      if (ui.devSectionRecent) {
        ui.devSectionRecent.textContent = "false";
      }
      return;
    }

    const previewLimit = 1200;
    const preview =
      devPayload.text.length > previewLimit
        ? `${devPayload.text.slice(0, previewLimit)}...(trimmed)`
        : devPayload.text;
    ui.devPackPreview.textContent = preview;
    ui.devPackChars.textContent = String(devPayload.meta.chars);
    if (ui.devPackFull) {
      ui.devPackFull.textContent = devPayload.text;
    }
    if (ui.devSectionAlways) {
      ui.devSectionAlways.textContent = "true";
    }
    if (ui.devSectionDoctrine) {
      ui.devSectionDoctrine.textContent = String(devPayload.meta.sections.doctrine);
    }
    if (ui.devSectionHistory) {
      ui.devSectionHistory.textContent = String(devPayload.meta.sections.history);
    }
    if (ui.devSectionRest) {
      ui.devSectionRest.textContent = String(devPayload.meta.sections.restmenu);
    }
    if (ui.devSectionRecent) {
      ui.devSectionRecent.textContent = String(devPayload.meta.sections.recentChat);
    }

    const jsonView = {
      options: getContextPackOptions(),
      meta: devPayload.meta,
      debug: devPayload.debug ?? null,
    };
    try {
      ui.devPackJson.textContent = JSON.stringify(jsonView, null, 2);
    } catch (error) {
      console.error("dev panel stringify failed", error);
      ui.devPackJson.textContent = "(error: stringify failed)";
    }
  }

  async function rebuildDevPayload(force = false) {
    if (!isDev) {
      return;
    }
    const options = getContextPackOptions();
    const key = JSON.stringify(options);
    if (!force && devPayload && devPayloadKey === key) {
      return;
    }
    if (devPayloadLoading) {
      return;
    }
    devPayloadLoading = true;
    devPayloadKey = key;
    devPayloadError = null;
    updateDevPanelPayloadUI();
    try {
      devPayload = await buildContextPack(options);
    } catch (error) {
      console.error("dev panel buildContextPack failed", error);
      devPayload = null;
      devPayloadError = "build failed";
    } finally {
      devPayloadLoading = false;
      updateDevPanelPayloadUI();
    }
  }

  function updateDevPanelUI(forceRebuild = false) {
    if (!isDev || !ui.devPanel) {
      return;
    }
    if (!ui.devContent || !ui.devApiBase || !ui.devConnected || !ui.devHealthAt || !ui.devHealthResult) {
      return;
    }
    ui.devPanel.hidden = false;
    const expanded = state.devPanelOpen;
    ui.devContent.classList.toggle("hidden", !expanded);
    const toggleIcon = ui.devToggle?.querySelector("[data-dev-toggle-icon]");
    if (toggleIcon) {
      toggleIcon.textContent = expanded ? "▴" : "▾";
    }
    ui.devApiBase.textContent = API_BASE_RAW || "-";
    ui.devConnected.textContent = String(state.connected);
    ui.devHealthAt.textContent = state.lastHealthAt;
    ui.devHealthResult.textContent = state.lastHealthResult;
    if (ui.devHistoryRange) {
      ui.devHistoryRange.textContent = state.historyRange;
    }
    if (ui.devRestMenu) {
      ui.devRestMenu.textContent = String(state.restMenuOn);
    }

    updateDevPanelPayloadUI();
    const shouldRebuild = forceRebuild || (expanded && (!devPayload || devPayloadKey !== JSON.stringify(getContextPackOptions())));
    if (shouldRebuild) {
      void rebuildDevPayload(forceRebuild);
    }
    if (forceRebuild && ui.devCopyStatus) {
      ui.devCopyStatus.textContent = "rebuilt";
      clearCopyStatusLater();
    }
  }

  async function handleCopyPack() {
    if (!ui.devCopyStatus) {
      return;
    }
    try {
      if (!devPayload) {
        ui.devCopyStatus.textContent = "no-pack";
        clearCopyStatusLater();
        return;
      }
      await navigator.clipboard.writeText(devPayload.text);
      ui.devCopyStatus.textContent = "copied";
    } catch (error) {
      console.error("dev panel copy failed", error);
      ui.devCopyStatus.textContent = "copy-fault";
    }
    clearCopyStatusLater();
  }

  function clearCopyStatusLater() {
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    copyTimer = setTimeout(() => {
      if (ui.devCopyStatus) {
        ui.devCopyStatus.textContent = "";
      }
    }, 1200);
  }

  function handleSend() {
    if (!ui.chatInput) {
      return;
    }
    const message = ui.chatInput.value.trim();
    if (!message) {
      return;
    }
    ui.chatInput.value = "";
    ui.chatInput.focus();
  }
}

function renderDoctrineField(label: string, field: string, placeholder: string) {
  return `
    <label class="block">
      <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">${label}</div>
      <textarea
        data-doctrine-field="${field}"
        rows="4"
        class="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/60"
        placeholder="${placeholder}"
      ></textarea>
    </label>
  `;
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
