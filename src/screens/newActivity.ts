import iconBike from "../assets/icons/focus/bike.svg";
import iconGym from "../assets/icons/focus/gym.svg";
import iconRun from "../assets/icons/focus/run.svg";
import iconSwim from "../assets/icons/focus/swim.svg";

type SportOption = "Swim" | "Bike" | "Run" | "Gym";
type EntryMode = "gpx" | "manual";

const sportOptions: Array<{ value: SportOption; label: string; icon: string }> = [
  { value: "Swim", label: "Swim", icon: iconSwim },
  { value: "Bike", label: "Bike", icon: iconBike },
  { value: "Run", label: "Run", icon: iconRun },
  { value: "Gym", label: "Gym", icon: iconGym },
];

const modeTabs: Array<{ id: EntryMode; label: string }> = [
  { id: "gpx", label: "GPX Import" },
  { id: "manual", label: "Manual Entry" },
];

export function mountNewActivity(root: HTMLElement) {
  let controller: AbortController | null = null;

  const state = {
    mode: "manual" as EntryMode,
    sport: "Swim" as SportOption,
    srpe: 7,
    notes: "",
    gpxFile: null as File | null,
  };

  refresh();

  return () => {
    controller?.abort();
  };

  function refresh() {
    controller?.abort();
    controller = new AbortController();
    render();
    bind(controller.signal);
  }

  function render() {
    const gpxName = state.gpxFile ? escapeHtml(state.gpxFile.name) : "No file selected";
    const clearHidden = state.gpxFile ? "" : "hidden";
    const saveLabel = state.mode === "gpx" ? "Import GPX (coming soon)" : "Save Activity (coming soon)";

    const tabButtons = modeTabs
      .map((tab) => {
        const active = state.mode === tab.id;
        const baseClass =
          "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";
        const activeClass =
          "bg-slate-900 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.2)]";
        const idleClass = "text-slate-400 hover:text-slate-200";
        return `
          <button
            id="tab-${tab.id}"
            type="button"
            role="tab"
            data-mode="${tab.id}"
            aria-selected="${active ? "true" : "false"}"
            aria-controls="panel-${tab.id}"
            class="${baseClass} ${active ? activeClass : idleClass}"
          >
            ${tab.label}
          </button>`;
      })
      .join("");

    const manualPanel = `
      <div id="panel-manual" role="tabpanel" aria-labelledby="tab-manual">
        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-slate-200">Sport</legend>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${sportOptions
              .map((option) => {
                const checked = state.sport === option.value;
                return `
                <label class="flex flex-col">
                  <input
                    type="radio"
                    name="sport"
                    value="${option.value}"
                    class="peer sr-only"
                    ${checked ? "checked" : ""}
                  />
                  <div
                    class="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-sm font-medium text-slate-300 transition
                           peer-checked:border-sky-400 peer-checked:bg-sky-500/20 peer-checked:text-sky-200
                           focus-within:ring-2 focus-within:ring-sky-500/40"
                  >
                    <div
                      class="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 transition
                             peer-checked:border-sky-400 peer-checked:bg-slate-950/60"
                    >
                      <img src="${option.icon}" alt="" class="h-8 w-8 opacity-80 transition peer-checked:opacity-100" />
                    </div>
                    <span class="text-sm font-semibold">${option.label}</span>
                  </div>
                </label>`;
              })
              .join("")}
          </div>
        </fieldset>

        <div class="mt-5 grid grid-cols-2 gap-4">
          <label class="block">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-slate-200">Date</span>
            </div>
            <input
              type="date"
              class="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-base text-slate-100 outline-none
                     focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
            />
          </label>

          <label class="block">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-slate-200">Start Time</span>
            </div>
            <input
              type="time"
              class="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-base text-slate-100 outline-none
                     focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
            />
          </label>

          <label class="block">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-slate-200">Duration (min)</span>
            </div>
            <input
              inputmode="decimal"
              class="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-base text-slate-100 outline-none
                     focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
              placeholder="45"
            />
          </label>
        </div>

        <div class="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-slate-200">Session Effort (sRPE)</span>
            <span id="srpeValue" class="text-sm font-semibold text-sky-200">${state.srpe} /10</span>
          </div>
          <input
            id="srpeRange"
            type="range"
            min="1"
            max="10"
            step="1"
            value="${state.srpe}"
            class="mt-4 w-full accent-sky-400"
          />
          <div class="mt-3 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Easy</span>
            <span>Moderate</span>
            <span>Hard</span>
            <span>Max</span>
          </div>
        </div>

        <label class="mt-5 block">
          <div class="mb-2 text-sm font-medium text-slate-200">How did it feel?</div>
          <textarea
            id="notes"
            rows="5"
            class="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 outline-none
                   placeholder:text-slate-600 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
            placeholder="Add notes about fatigue, nutrition, or weather..."
          >${escapeHtml(state.notes)}</textarea>
        </label>
      </div>
    `;

    const gpxPanel = `
      <div id="panel-gpx" role="tabpanel" aria-labelledby="tab-gpx">
        <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-slate-200">GPX Import</div>
              <div class="text-xs text-slate-400">Upload your activity file (coming soon).</div>
            </div>
            <button
              id="btnClearGpx"
              type="button"
              class="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-slate-700 ${clearHidden}"
            >
              Clear
            </button>
          </div>

          <input
            id="gpxFile"
            type="file"
            accept=".gpx,.xml,application/gpx+xml,text/xml"
            class="mt-4 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200
                   file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800/80 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200
                   hover:file:bg-slate-700"
          />

          <div class="mt-2 text-xs text-slate-400">
            Selected: <span id="gpxName" class="text-slate-200">${gpxName}</span>
          </div>
        </div>
      </div>
    `;

    root.innerHTML = `
      <div class="min-h-screen bg-slate-950 text-slate-100">
        <div class="mx-auto max-w-[520px] px-5 py-6">
          <header class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">New Activity</h1>
              <p class="mt-1 text-sm text-slate-400">Quick entry (temporary UI)</p>
            </div>
          </header>

          <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg shadow-black/20">
            <div
              role="tablist"
              aria-label="Entry mode"
              class="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/50 p-1"
            >
              ${tabButtons}
            </div>

            <div class="mt-5">
              ${state.mode === "gpx" ? gpxPanel : manualPanel}
            </div>

            <div class="mt-6">
              <button
                type="button"
                class="w-full rounded-2xl bg-slate-800/70 py-4 font-semibold text-slate-300"
                disabled
              >
                ${saveLabel}
              </button>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function bind(signal: AbortSignal) {
    const modeButtons = root.querySelectorAll<HTMLButtonElement>("[data-mode]");
    modeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const next = button.dataset.mode as EntryMode | undefined;
          if (next && next !== state.mode) {
            state.mode = next;
            refresh();
          }
        },
        { signal },
      );
    });

    if (state.mode === "manual") {
      const sportInputs = root.querySelectorAll<HTMLInputElement>('input[name="sport"]');
      const srpeRange = root.querySelector<HTMLInputElement>("#srpeRange");
      const srpeValue = root.querySelector<HTMLSpanElement>("#srpeValue");
      const notes = root.querySelector<HTMLTextAreaElement>("#notes");

      sportInputs.forEach((input) => {
        input.addEventListener(
          "change",
          () => {
            if (input.checked) {
              state.sport = input.value as SportOption;
            }
          },
          { signal },
        );
      });

      if (srpeRange && srpeValue) {
        srpeRange.addEventListener(
          "input",
          () => {
            const next = Number(srpeRange.value);
            if (Number.isFinite(next)) {
              state.srpe = next;
              srpeValue.textContent = `${state.srpe} /10`;
            }
          },
          { signal },
        );
      }

      if (notes) {
        notes.addEventListener(
          "input",
          () => {
            state.notes = notes.value;
          },
          { signal },
        );
      }
      return;
    }

    const gpxInput = root.querySelector<HTMLInputElement>("#gpxFile");
    const gpxName = root.querySelector<HTMLSpanElement>("#gpxName");
    const gpxClear = root.querySelector<HTMLButtonElement>("#btnClearGpx");

    if (gpxInput && gpxName && gpxClear) {
      gpxInput.addEventListener(
        "change",
        () => {
          const file = gpxInput.files?.[0] ?? null;
          state.gpxFile = file;
          updateGpxStatus(gpxName, gpxClear, file);
        },
        { signal },
      );

      gpxClear.addEventListener(
        "click",
        () => {
          gpxInput.value = "";
          state.gpxFile = null;
          updateGpxStatus(gpxName, gpxClear, null);
        },
        { signal },
      );
    }
  }
}

function updateGpxStatus(
  nameEl: HTMLSpanElement,
  clearBtn: HTMLButtonElement,
  file: File | null,
) {
  if (file) {
    nameEl.textContent = file.name;
    clearBtn.classList.remove("hidden");
    return;
  }
  nameEl.textContent = "No file selected";
  clearBtn.classList.add("hidden");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
