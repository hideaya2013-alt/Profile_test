import alertSvg from "../assets/icons/common/alert.svg?raw";
import checkSvg from "../assets/icons/common/check.svg?raw";
import editSvg from "../assets/icons/common/edit.svg?raw";
import syncSvg from "../assets/icons/common/sync.svg?raw";

type HistoryRange = "7d" | "14d";

export function mountTriCoachMenu(root: HTMLElement) {
  let controller: AbortController | null = null;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let healthAbort: AbortController | null = null;

  const state = {
    connected: false,
    dirty: false,
    historyRange: "7d" as HistoryRange,
    restMenuOn: false,
  };

  refresh();
  startHealthCheck();

  return () => {
    controller?.abort();
    if (healthTimer) {
      clearInterval(healthTimer);
    }
    healthAbort?.abort();
  };

  function refresh() {
    controller?.abort();
    controller = new AbortController();
    render();
    bind(controller.signal);
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
    try {
      const res = await fetch("/health", { signal: healthAbort.signal });
      const next = res.ok;
      if (next !== state.connected) {
        state.connected = next;
        refresh();
      }
    } catch {
      if (state.connected) {
        state.connected = false;
        refresh();
      }
    }
  }

  function render() {
    const syncLabel = state.dirty ? "UNSYNC" : "SYNCED";
    const syncIcon = state.dirty ? alertSvg : checkSvg;
    const syncTone = state.dirty
      ? "text-rose-300 border-rose-400/40 bg-rose-500/10"
      : "text-sky-200 border-sky-400/40 bg-sky-500/10";

    const connectedLabel = state.connected ? "CONNECTED" : "OFFLINE";
    const connectedTone = state.connected
      ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
      : "text-slate-400 border-slate-700/60 bg-slate-900/40";

    const resyncDisabled = !state.dirty;
    const resyncClass = resyncDisabled
      ? "opacity-60 cursor-not-allowed border-slate-800 text-slate-500"
      : "border-slate-700 text-slate-200 hover:border-slate-500";

    const rangeButton = (label: string, value: HistoryRange) => {
      const active = state.historyRange === value;
      return `
        <button
          type="button"
          data-range="${value}"
          class="rounded-full px-3 py-1 text-xs font-semibold transition ${
            active
              ? "border border-sky-400/60 bg-sky-500/20 text-sky-200"
              : "border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
          }"
        >
          ${label}
        </button>
      `;
    };

    root.innerHTML = `
      <div class="min-h-screen bg-slate-950 text-slate-100">
        <div class="mx-auto max-w-[520px] px-5 py-6">
          <header class="flex flex-col gap-2">
            <h1 class="text-2xl font-semibold tracking-tight">TriCoach AI</h1>
            <div class="flex flex-wrap items-center gap-3">
              <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${syncTone}">
                ${renderIcon(syncIcon, "h-4 w-4 text-current")}
                ${syncLabel}
              </div>
              <button
                type="button"
                data-resync="true"
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${resyncClass}"
                ${resyncDisabled ? "disabled" : ""}
              >
                ${renderIcon(syncSvg, "h-4 w-4 text-current")}
                Resync
              </button>
              <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${connectedTone}">
                ${renderIcon(checkSvg, "h-4 w-4 text-current")}
                ${connectedLabel}
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
                class="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm font-semibold text-slate-200 hover:border-slate-700"
              >
                ${renderIcon(editSvg, "h-4 w-4 text-slate-200")}
                Edit
              </button>
              <div class="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3">
                ${rangeButton("7 Day", "7d")}
                ${rangeButton("14 Day", "14d")}
              </div>
              <button
                type="button"
                data-restmenu="toggle"
                class="flex items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm font-semibold text-slate-200"
              >
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  ${state.restMenuOn ? "ON" : "OFF"}
                </span>
                <span class="relative inline-flex h-5 w-9 items-center rounded-full border border-slate-700 bg-slate-900/60">
                  <span class="h-4 w-4 rounded-full bg-slate-400 transition ${
                    state.restMenuOn ? "translate-x-[18px] bg-emerald-300" : "translate-x-[2px]"
                  }"></span>
                </span>
              </button>
            </div>
          </section>

          <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
            Menu items will appear here.
          </section>
        </div>
      </div>
    `;
  }

  function bind(signal: AbortSignal) {
    const resyncButton = root.querySelector<HTMLButtonElement>("[data-resync]");
    resyncButton?.addEventListener(
      "click",
      () => {
        if (!state.dirty) {
          return;
        }
        state.dirty = false;
        refresh();
      },
      { signal },
    );

    const rangeButtons = root.querySelectorAll<HTMLButtonElement>("[data-range]");
    rangeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const value = button.dataset.range as HistoryRange | undefined;
          if (!value || value === state.historyRange) {
            return;
          }
          state.historyRange = value;
          refresh();
        },
        { signal },
      );
    });

    const restButton = root.querySelector<HTMLButtonElement>("[data-restmenu]");
    restButton?.addEventListener(
      "click",
      () => {
        state.restMenuOn = !state.restMenuOn;
        refresh();
      },
      { signal },
    );
  }
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
