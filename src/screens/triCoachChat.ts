import { loadDoctrine, saveDoctrine, type DoctrineData } from "../db";
import alertSvg from "../assets/icons/common/alert.svg?raw";
import checkSvg from "../assets/icons/common/check.svg?raw";
import editSvg from "../assets/icons/common/edit.svg?raw";
import { buildContextPack, composeFinalText } from "../services/contextPackService";
import {
  applyMockProposal,
  initDevPanel,
  renderDevPanelHtml,
  type DevPanelController,
} from "./triCoachChat.dev";
import syncSvg from "../assets/icons/common/sync.svg?raw";

type HistoryRange = "7d" | "14d";
type SaveFlash = "saved" | "fault" | null;
type RecentChatOverride = {
  turn1?: string;
  turn2?: string;
};
type Sport = "swim" | "bike" | "run";
type MenuProposalCard = {
  id: string;
  date: string;
  primarySport: Sport;
  summary: string;
  detail: string;
};
type MenuProposalV1 = {
  type: "menu";
  version: 1;
  cards: MenuProposalCard[];
};
type Proposal = MenuProposalV1;
type ChatResponse = {
  replyText: string;
  proposal: Proposal | null;
};
type ChatTurn = {
  id: string;
  userText: string;
  replyText: string;
  createdAt: string;
};
type ContextOptionState = {
  includeHistory: boolean;
  includeRestMenu: boolean;
  includeRecentChat: boolean;
  historyRange: HistoryRange;
  recentTurns: 2;
  recentChatOverride?: RecentChatOverride;
};
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
const CHAT_TURNS_KEY = "tricoach_chat_turns_v1";
const CHAT_TURNS_VERSION = 1;
const CHAT_TURNS_LIMIT = 5;
const CHAT_TEXT_LIMIT = 800;

export function mountTriCoachChat(root: HTMLElement) {
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let healthAbort: AbortController | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();
  const isDev = new URLSearchParams(location.search).has("dev");
  let devPanel: DevPanelController | null = null;

  const state = {
    connected: false,
    dirty: false,
    historyRange: "7d" as HistoryRange,
    includeHistory: false,
    includeRestMenu: false,
    includeRecentChat: false,
    recentTurns: 2 as 2,
    plusPanelOpen: false,
    sending: false,
    lastSentUserText: null as string | null,
    lastSentAssistantText: null as string | null,
    cachedTurns: loadRecentTurns(),
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
    plusToggle: null as HTMLButtonElement | null,
    plusPanel: null as HTMLDivElement | null,
    plusClose: null as HTMLButtonElement | null,
    plusHistoryRange: null as HTMLSpanElement | null,
    plusRecentTurns: null as HTMLSpanElement | null,
    plusIncludeHistory: null as HTMLInputElement | null,
    plusIncludeRestMenu: null as HTMLInputElement | null,
    plusIncludeRecentChat: null as HTMLInputElement | null,
    plusChips: null as HTMLDivElement | null,
    confirmUpdate: null as HTMLButtonElement | null,
    chatInput: null as HTMLTextAreaElement | null,
    sendButton: null as HTMLButtonElement | null,
    chatLog: null as HTMLElement | null,
    chatCached: null as HTMLDivElement | null,
    chatProposal: null as HTMLDivElement | null,
    overlay: null as HTMLDivElement | null,
    overlayUpdatedAt: null as HTMLSpanElement | null,
    saveButton: null as HTMLButtonElement | null,
    returnButton: null as HTMLButtonElement | null,
    textareas: {} as Record<keyof typeof state.draft, HTMLTextAreaElement>,
  };

  renderOnce();
  devPanel = initDevPanel({
    root,
    isDev,
    apiBaseRaw: API_BASE_RAW,
    signal: controller.signal,
    getState: () => ({
      connected: state.connected,
      historyRange: state.historyRange,
      restMenuOn: state.includeRestMenu,
      devPanelOpen: state.devPanelOpen,
      lastHealthAt: state.lastHealthAt,
      lastHealthResult: state.lastHealthResult,
    }),
    setDevPanelOpen: (next) => {
      state.devPanelOpen = next;
    },
    getContextPackOptions: () => ({
      includeHistory: state.includeHistory,
      historyRange: state.historyRange,
      includeRestMenu: state.includeRestMenu,
      includeRecentChat: state.includeRecentChat,
      recentTurns: state.recentTurns,
      recentChatOverride: buildRecentChatOverride(),
    }),
  });
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
    healthAbort?.abort();
    devPanel?.dispose();
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
      devPanel?.update();
    } catch (error) {
      console.error("health check failed", error);
      if (state.connected) {
        state.connected = false;
        updateConnectedUI();
      }
      state.lastHealthAt = stamp;
      state.lastHealthResult = "fetch-error";
      devPanel?.update();
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
            <div class="grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Doctrine</div>
              <div class="text-center">History</div>
            </div>
            <div class="mt-3 grid grid-cols-2 items-center gap-3">
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
            </div>
          </section>

          <section data-chat-log class="mt-6 space-y-4">
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
            <div data-chat-cached class="space-y-4"></div>
            <div data-chat-proposal class="space-y-4"></div>
          </section>

          <div class="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4">
            <div class="mx-auto flex max-w-[520px] items-end gap-3">
              <div class="relative">
                <button
                  type="button"
                  data-plus-toggle
                  aria-label="Select context"
                  aria-expanded="false"
                  class="h-11 w-11 rounded-full border border-slate-800 bg-slate-900/60 text-slate-100 hover:border-slate-700"
                >
                  +
                </button>

                <div
                  data-plus-panel
                  hidden
                  class="absolute bottom-14 left-0 w-72 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-lg shadow-black/40"
                >
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Send context
                  </div>

                  <div class="mt-2 space-y-2 text-sm">
                    <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
                      <div class="flex flex-col">
                        <span class="font-semibold text-slate-100">History</span>
                        <span class="text-[11px] text-slate-400">
                          range: <span data-plus-history-range class="text-slate-200">7d</span>
                        </span>
                      </div>
                      <input type="checkbox" data-plus-include-history class="h-4 w-4 accent-sky-500" />
                    </label>

                    <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
                      <div class="flex flex-col">
                        <span class="font-semibold text-slate-100">RestMenu</span>
                        <span class="text-[11px] text-slate-400">unscheduled items</span>
                      </div>
                      <input type="checkbox" data-plus-include-restmenu class="h-4 w-4 accent-sky-500" />
                    </label>

                    <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
                      <div class="flex flex-col">
                        <span class="font-semibold text-slate-100">Recent Chat</span>
                        <span class="text-[11px] text-slate-400">
                          turns: <span data-plus-recent-turns class="text-slate-200">2</span>
                        </span>
                      </div>
                      <input type="checkbox" data-plus-include-recentchat class="h-4 w-4 accent-sky-500" />
                    </label>
                  </div>

                  <div class="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      data-plus-close
                      class="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <textarea
                data-chat-input
                rows="2"
                placeholder="Ask Coach about your plan..."
                class="flex-1 resize-none rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
              ></textarea>
              <button
                type="button"
                data-send
                class="h-11 w-11 rounded-full border border-slate-800 bg-sky-500/30 text-sky-100 disabled:opacity-50"
              >
                >
              </button>
            </div>
            <div data-plus-chips class="mx-auto mt-2 flex max-w-[520px] flex-wrap gap-2 text-xs text-slate-200"></div>
          </div>
        </div>
      </div>

      ${renderDevPanelHtml(isDev)}

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
    ui.plusToggle = root.querySelector("[data-plus-toggle]");
    ui.plusPanel = root.querySelector("[data-plus-panel]");
    ui.plusClose = root.querySelector("[data-plus-close]");
    ui.plusHistoryRange = root.querySelector("[data-plus-history-range]");
    ui.plusRecentTurns = root.querySelector("[data-plus-recent-turns]");
    ui.plusIncludeHistory = root.querySelector("[data-plus-include-history]");
    ui.plusIncludeRestMenu = root.querySelector("[data-plus-include-restmenu]");
    ui.plusIncludeRecentChat = root.querySelector("[data-plus-include-recentchat]");
    ui.plusChips = root.querySelector("[data-plus-chips]");
    ui.confirmUpdate = root.querySelector("[data-confirm-update]");
    ui.chatInput = root.querySelector("[data-chat-input]");
    ui.sendButton = root.querySelector("[data-send]");
    ui.chatLog = root.querySelector("[data-chat-log]");
    ui.chatCached = root.querySelector("[data-chat-cached]");
    ui.chatProposal = root.querySelector("[data-chat-proposal]");
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

    ui.plusToggle?.addEventListener(
      "click",
      () => {
        state.plusPanelOpen = !state.plusPanelOpen;
        updatePlusPanelUI();
      },
      { signal },
    );

    ui.plusClose?.addEventListener(
      "click",
      () => {
        state.plusPanelOpen = false;
        updatePlusPanelUI();
      },
      { signal },
    );

    ui.plusIncludeHistory?.addEventListener(
      "change",
      () => {
        state.includeHistory = ui.plusIncludeHistory?.checked ?? false;
        updatePlusPanelUI();
      },
      { signal },
    );

    ui.plusIncludeRestMenu?.addEventListener(
      "change",
      () => {
        state.includeRestMenu = ui.plusIncludeRestMenu?.checked ?? false;
        updatePlusPanelUI();
      },
      { signal },
    );

    ui.plusIncludeRecentChat?.addEventListener(
      "change",
      () => {
        state.includeRecentChat = ui.plusIncludeRecentChat?.checked ?? false;
        updatePlusPanelUI();
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
        void handleSend();
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
          void handleSend();
        }
      },
      { signal },
    );
  }

  function updateAllUI() {
    updateSyncUI();
    updateConnectedUI();
    updateHistoryUI();
    updateConfirmUpdateUI();
    updateOverlayVisibility();
    updateOverlayUpdatedAt();
    updateDoctrineSaveUI();
    updatePlusPanelUI();
    updateChipsUI();
    updateSendUI();
    updateCachedTurnsUI();
    devPanel?.update();
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
    updateSendUI();
  }

  function updateHistoryUI() {
    ui.historyButtons.forEach((button) => {
      const value = button.dataset.range as HistoryRange | undefined;
      const active = value === state.historyRange;
      button.className = `${HISTORY_BASE_CLASSES} ${
        active ? HISTORY_ACTIVE_CLASSES : HISTORY_IDLE_CLASSES
      }`;
    });
    updatePlusPanelUI();
    updateChipsUI();
    devPanel?.update();
  }
  
  function updatePlusPanelUI() {
    if (!ui.plusPanel || !ui.plusToggle) {
      return;
    }
    ui.plusPanel.hidden = !state.plusPanelOpen;
    ui.plusToggle.setAttribute("aria-expanded", state.plusPanelOpen ? "true" : "false");
    if (ui.plusHistoryRange) {
      ui.plusHistoryRange.textContent = state.historyRange;
    }
    if (ui.plusRecentTurns) {
      ui.plusRecentTurns.textContent = String(state.recentTurns);
    }
    if (ui.plusIncludeHistory) {
      ui.plusIncludeHistory.checked = state.includeHistory;
    }
    if (ui.plusIncludeRestMenu) {
      ui.plusIncludeRestMenu.checked = state.includeRestMenu;
    }
    if (ui.plusIncludeRecentChat) {
      ui.plusIncludeRecentChat.checked = state.includeRecentChat;
    }
    updateChipsUI();
    devPanel?.update();
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

  function updateChipsUI() {
    if (!ui.plusChips) {
      return;
    }
    const chips: string[] = [];
    if (state.includeHistory) chips.push(`History:${state.historyRange}`);
    if (state.includeRestMenu) chips.push("RestMenu");
    if (state.includeRecentChat) chips.push(`Chat:${state.recentTurns}T`);
    ui.plusChips.innerHTML = chips
      .map(
        (label) => `
        <span class="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1">
          ${escapeHtml(label)}
        </span>
      `,
      )
      .join("");
  }

  function updateCachedTurnsUI() {
    if (!ui.chatCached) {
      return;
    }
    ui.chatCached.innerHTML = state.cachedTurns
      .map((turn) => renderChatTurn(turn))
      .join("");
  }

  function updateProposalUI(proposal: Proposal | null) {
    if (!ui.chatProposal) {
      return;
    }
    if (!proposal || proposal.cards.length === 0) {
      ui.chatProposal.innerHTML = "";
      return;
    }
    ui.chatProposal.innerHTML = renderProposalCard(proposal.cards[0]);
  }

  function renderChatTurn(turn: ChatTurn) {
    const userCard = renderChatMessage("You", "bg-sky-500/20", turn.userText);
    const assistantCard = renderChatMessage("TriCoach", "bg-slate-900/60", turn.replyText);
    return `${userCard}${assistantCard}`;
  }

  function renderChatMessage(label: string, bubbleClass: string, text: string) {
    const escaped = escapeHtml(text);
    return `
      <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</div>
        <div class="mt-3 rounded-2xl border border-slate-800 ${bubbleClass} p-4 text-sm text-slate-100 whitespace-pre-wrap">
          ${escaped}
        </div>
      </div>
    `;
  }

  function renderProposalCard(card: MenuProposalCard) {
    const summary = card.summary?.trim() || "(no summary)";
    return `
      <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          ${renderIcon(checkSvg, "h-4 w-4 text-slate-300")}
          MENU PROPOSAL
        </div>
        <div class="mt-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
          ${escapeHtml(summary)}
        </div>
      </div>
    `;
  }

  function updateSendUI() {
    if (!ui.sendButton) {
      return;
    }
    const disabled = !state.connected || state.sending;
    ui.sendButton.disabled = disabled;
  }

  function getContextOptions(): ContextOptionState {
    return {
      includeHistory: state.includeHistory,
      historyRange: state.historyRange,
      includeRestMenu: state.includeRestMenu,
      includeRecentChat: state.includeRecentChat,
      recentTurns: state.recentTurns,
      recentChatOverride: buildRecentChatOverride(),
    };
  }

  function buildRecentChatOverride(): RecentChatOverride | undefined {
    const turn1 = state.lastSentUserText?.trim() ?? "";
    const turn2 = state.lastSentAssistantText?.trim() ?? "";
    if (!turn1 && !turn2) {
      return undefined;
    }
    return {
      turn1: turn1 || undefined,
      turn2: turn2 || undefined,
    };
  }

  async function handleSend() {
    if (!ui.chatInput || state.sending) {
      return;
    }
    if (!state.connected) {
      return;
    }
    const userText = ui.chatInput.value.trim();
    if (!userText) {
      return;
    }
    state.sending = true;
    updateSendUI();
    try {
      const payload = await buildContextPack(getContextOptions());
      const finalText = composeFinalText(payload.text, userText);
      const res = await fetch(`${API_BASE}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText, max_output_chars: 1200 }),
      });
      if (!res.ok) {
        throw new Error(`chat send failed: ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      const response = applyMockProposal(normalizeChatResponse(data));
      const replyText = response.replyText;
      state.lastSentUserText = userText;
      state.lastSentAssistantText = replyText;
      state.cachedTurns = appendTurn(state.cachedTurns, userText, replyText);
      saveRecentTurns(state.cachedTurns);
      updateCachedTurnsUI();
      updateProposalUI(response.proposal);
      devPanel?.update();
      ui.chatInput.value = "";
      ui.chatInput.focus();
    } catch (error) {
      console.error("chat send failed", error);
    } finally {
      state.sending = false;
      updateSendUI();
    }
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeChatResponse(value: unknown): ChatResponse {
  const replyText =
    value &&
    typeof value === "object" &&
    typeof (value as { replyText?: unknown }).replyText === "string"
      ? (value as { replyText: string }).replyText
      : "(no reply)";
  const proposalValue =
    value && typeof value === "object" ? (value as { proposal?: unknown }).proposal : null;
  const proposal = isMenuProposal(proposalValue) ? proposalValue : null;
  return { replyText, proposal };
}

function isMenuProposal(value: unknown): value is Proposal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proposal = value as { type?: unknown; version?: unknown; cards?: unknown };
  if (proposal.type !== "menu" || proposal.version !== 1 || !Array.isArray(proposal.cards)) {
    return false;
  }
  if (proposal.cards.length === 0) {
    return false;
  }
  const first = proposal.cards[0] as Partial<MenuProposalCard> | undefined;
  if (!first || typeof first.summary !== "string") {
    return false;
  }
  return true;
}

function loadRecentTurns(): ChatTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_TURNS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as { v?: number; turns?: ChatTurn[] };
    if (parsed?.v !== CHAT_TURNS_VERSION || !Array.isArray(parsed.turns)) {
      console.error("chat turns: invalid format");
      return [];
    }
    const turns = parsed.turns.filter((turn) => {
      return (
        turn &&
        typeof turn.id === "string" &&
        typeof turn.userText === "string" &&
        typeof turn.replyText === "string" &&
        typeof turn.createdAt === "string"
      );
    });
    return turns.slice(-CHAT_TURNS_LIMIT);
  } catch (error) {
    console.error("chat turns: load failed", error);
    return [];
  }
}

function saveRecentTurns(turns: ChatTurn[]) {
  try {
    const payload = {
      v: CHAT_TURNS_VERSION,
      turns,
    };
    localStorage.setItem(CHAT_TURNS_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("chat turns: save failed", error);
  }
}

function appendTurn(turns: ChatTurn[], userText: string, replyText: string) {
  const now = new Date().toISOString();
  const next: ChatTurn = {
    id: generateId(),
    userText: trimText(userText, CHAT_TEXT_LIMIT),
    replyText: trimText(replyText, CHAT_TEXT_LIMIT),
    createdAt: now,
  };
  return turns.concat(next).slice(-CHAT_TURNS_LIMIT);
}

function trimText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...(trimmed)`;
}

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
