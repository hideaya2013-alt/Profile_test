import {
  buildContextPack,
  type ContextPackOptions,
  type ContextPackResult,
} from "../services/contextPackService";

export type DevPanelState = {
  connected: boolean;
  historyRange: "7d" | "14d";
  restMenuOn: boolean;
  devPanelOpen: boolean;
  lastHealthAt: string;
  lastHealthResult: string;
};

export type DevPanelDeps = {
  root: HTMLElement;
  isDev: boolean;
  apiBaseRaw: string;
  signal: AbortSignal;
  getState: () => DevPanelState;
  setDevPanelOpen: (next: boolean) => void;
  getContextPackOptions: () => ContextPackOptions;
};

export type DevPanelController = {
  update: (forceRebuild?: boolean) => void;
  dispose: () => void;
};

type DevPanelUI = {
  panel: HTMLDivElement | null;
  toggle: HTMLButtonElement | null;
  content: HTMLDivElement | null;
  apiBase: HTMLSpanElement | null;
  connected: HTMLSpanElement | null;
  healthAt: HTMLSpanElement | null;
  healthResult: HTMLSpanElement | null;
  historyRange: HTMLSpanElement | null;
  restMenu: HTMLSpanElement | null;
  packChars: HTMLSpanElement | null;
  packPreview: HTMLPreElement | null;
  packJson: HTMLPreElement | null;
  packFull: HTMLPreElement | null;
  sectionAlways: HTMLSpanElement | null;
  sectionDoctrine: HTMLSpanElement | null;
  sectionHistory: HTMLSpanElement | null;
  sectionRest: HTMLSpanElement | null;
  sectionRecent: HTMLSpanElement | null;
  copyStatus: HTMLSpanElement | null;
  copyButton: HTMLButtonElement | null;
  rebuildButton: HTMLButtonElement | null;
};

export function renderDevPanelHtml(isDev: boolean) {
  return `
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
  `;
}

export function initDevPanel(deps: DevPanelDeps): DevPanelController {
  const ui: DevPanelUI = {
    panel: deps.root.querySelector("[data-dev-panel]"),
    toggle: deps.root.querySelector("[data-dev-toggle]"),
    content: deps.root.querySelector("[data-dev-content]"),
    apiBase: deps.root.querySelector("[data-dev-api-base]"),
    connected: deps.root.querySelector("[data-dev-connected]"),
    healthAt: deps.root.querySelector("[data-dev-health-at]"),
    healthResult: deps.root.querySelector("[data-dev-health-result]"),
    historyRange: deps.root.querySelector("[data-dev-history-range]"),
    restMenu: deps.root.querySelector("[data-dev-restmenu]"),
    packChars: deps.root.querySelector("[data-dev-pack-chars]"),
    packPreview: deps.root.querySelector("[data-dev-pack-preview]"),
    packJson: deps.root.querySelector("[data-dev-pack-json]"),
    packFull: deps.root.querySelector("[data-dev-pack-full]"),
    sectionAlways: deps.root.querySelector("[data-dev-sec-always]"),
    sectionDoctrine: deps.root.querySelector("[data-dev-sec-doctrine]"),
    sectionHistory: deps.root.querySelector("[data-dev-sec-history]"),
    sectionRest: deps.root.querySelector("[data-dev-sec-rest]"),
    sectionRecent: deps.root.querySelector("[data-dev-sec-recent]"),
    copyStatus: deps.root.querySelector("[data-dev-copy-status]"),
    copyButton: deps.root.querySelector("[data-dev-copy]"),
    rebuildButton: deps.root.querySelector("[data-dev-rebuild]"),
  };

  let devPayload: ContextPackResult | null = null;
  let devPayloadKey = "";
  let devPayloadLoading = false;
  let devPayloadError: string | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  ui.toggle?.addEventListener(
    "click",
    () => {
      const next = !deps.getState().devPanelOpen;
      deps.setDevPanelOpen(next);
      update();
    },
    { signal: deps.signal },
  );

  ui.copyButton?.addEventListener(
    "click",
    () => {
      void handleCopyPack();
    },
    { signal: deps.signal },
  );

  ui.rebuildButton?.addEventListener(
    "click",
    () => {
      update(true);
    },
    { signal: deps.signal },
  );

  function update(forceRebuild = false) {
    if (!deps.isDev || !ui.panel) {
      return;
    }
    if (!ui.content || !ui.apiBase || !ui.connected || !ui.healthAt || !ui.healthResult) {
      return;
    }
    ui.panel.hidden = false;
    const state = deps.getState();
    const expanded = state.devPanelOpen;
    ui.content.classList.toggle("hidden", !expanded);
    const toggleIcon = ui.toggle?.querySelector("[data-dev-toggle-icon]");
    if (toggleIcon) {
      toggleIcon.textContent = expanded ? "▴" : "▾";
    }
    ui.apiBase.textContent = deps.apiBaseRaw || "-";
    ui.connected.textContent = String(state.connected);
    ui.healthAt.textContent = state.lastHealthAt;
    ui.healthResult.textContent = state.lastHealthResult;
    if (ui.historyRange) {
      ui.historyRange.textContent = state.historyRange;
    }
    if (ui.restMenu) {
      ui.restMenu.textContent = String(state.restMenuOn);
    }

    updateDevPanelPayloadUI();
    const shouldRebuild =
      forceRebuild || (expanded && (!devPayload || devPayloadKey !== JSON.stringify(deps.getContextPackOptions())));
    if (shouldRebuild) {
      void rebuildDevPayload(forceRebuild);
    }
    if (forceRebuild && ui.copyStatus) {
      ui.copyStatus.textContent = "rebuilt";
      clearCopyStatusLater();
    }
  }

  function updateDevPanelPayloadUI() {
    if (!ui.packPreview || !ui.packJson || !ui.packChars) {
      return;
    }
    if (!devPayload) {
      const fallback = devPayloadError ? `(error: ${devPayloadError})` : "(no data)";
      ui.packPreview.textContent = fallback;
      ui.packJson.textContent = fallback;
      ui.packChars.textContent = "0";
      if (ui.packFull) {
        ui.packFull.textContent = fallback;
      }
      if (ui.sectionAlways) {
        ui.sectionAlways.textContent = "true";
      }
      if (ui.sectionDoctrine) {
        ui.sectionDoctrine.textContent = "false";
      }
      if (ui.sectionHistory) {
        ui.sectionHistory.textContent = "false";
      }
      if (ui.sectionRest) {
        ui.sectionRest.textContent = "false";
      }
      if (ui.sectionRecent) {
        ui.sectionRecent.textContent = "false";
      }
      return;
    }

    const previewLimit = 1200;
    const preview =
      devPayload.text.length > previewLimit
        ? `${devPayload.text.slice(0, previewLimit)}...(trimmed)`
        : devPayload.text;
    ui.packPreview.textContent = preview;
    ui.packChars.textContent = String(devPayload.meta.chars);
    if (ui.packFull) {
      ui.packFull.textContent = devPayload.text;
    }
    if (ui.sectionAlways) {
      ui.sectionAlways.textContent = "true";
    }
    if (ui.sectionDoctrine) {
      ui.sectionDoctrine.textContent = String(devPayload.meta.sections.doctrine);
    }
    if (ui.sectionHistory) {
      ui.sectionHistory.textContent = String(devPayload.meta.sections.history);
    }
    if (ui.sectionRest) {
      ui.sectionRest.textContent = String(devPayload.meta.sections.restmenu);
    }
    if (ui.sectionRecent) {
      ui.sectionRecent.textContent = String(devPayload.meta.sections.recentChat);
    }

    const jsonView = {
      options: deps.getContextPackOptions(),
      meta: devPayload.meta,
      debug: devPayload.debug ?? null,
    };
    try {
      ui.packJson.textContent = JSON.stringify(jsonView, null, 2);
    } catch (error) {
      console.error("dev panel stringify failed", error);
      ui.packJson.textContent = "(error: stringify failed)";
    }
  }

  async function rebuildDevPayload(force = false) {
    if (!deps.isDev) {
      return;
    }
    const options = deps.getContextPackOptions();
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

  async function handleCopyPack() {
    if (!ui.copyStatus) {
      return;
    }
    try {
      if (!devPayload) {
        ui.copyStatus.textContent = "no-pack";
        clearCopyStatusLater();
        return;
      }
      await navigator.clipboard.writeText(devPayload.text);
      ui.copyStatus.textContent = "copied";
    } catch (error) {
      console.error("dev panel copy failed", error);
      ui.copyStatus.textContent = "copy-fault";
    }
    clearCopyStatusLater();
  }

  function clearCopyStatusLater() {
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    copyTimer = setTimeout(() => {
      if (ui.copyStatus) {
        ui.copyStatus.textContent = "";
      }
    }, 1200);
  }

  return {
    update,
    dispose: () => {
      if (copyTimer) {
        clearTimeout(copyTimer);
      }
    },
  };
}
