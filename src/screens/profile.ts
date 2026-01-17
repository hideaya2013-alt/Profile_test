import { loadProfile, saveProfile, type ProfileData } from "../db";

// 繝ｭ繝ｼ繧ｫ繝ｫSVG・・abler・峨ｒ 窶懃函譁・ｭ怜・窶・縺ｨ縺励※隱ｭ繧
import cloudCheckSvg from "../assets/icons/status/cloud-check.svg?raw";
import cloudXSvg from "../assets/icons/status/cloud-x.svg?raw";
import continuitySvg from "../assets/icons/focus/continuity.svg?raw";
import injurySvg from "../assets/icons/focus/injury.svg?raw";
import fatigueSvg from "../assets/icons/focus/fatigue.svg?raw";
import checkSvg from "../assets/icons/common/check.svg?raw";

type State = {
  isSynced: boolean;
  dirty: boolean;
  current: ProfileData;
  lastSaved: ProfileData | null;
};

const DEFAULT_TRAINING_FOCUS = ["continuity"];

function normalizeTrainingFocus(value?: string[] | null) {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.length > 0);
    if (first) {
      return [first];
    }
  }
  return [...DEFAULT_TRAINING_FOCUS];
}

function cloneProfile(p: ProfileData): ProfileData {
  return {
    ...p,
    trainingFocus: [...normalizeTrainingFocus(p.trainingFocus)],
    trackSessionRpe: p.trackSessionRpe ?? true,
  };
}

const DEFAULT_PROFILE: ProfileData = {
  age: 28,
  heightCm: 182,
  weightKg: 72.5,
  ftpW: 285,
  vo2max: 58,
  trainingFocus: [...DEFAULT_TRAINING_FOCUS],
  trackSessionRpe: true,
};

const focusOptions = [
  { key: "continuity", label: "Continuity", icon: continuitySvg },
  { key: "injury", label: "Injury Prevention", icon: injurySvg },
  { key: "fatigue", label: "Fatigue Mgmt", icon: fatigueSvg },
] as const;

function withSvgClass(svg: string, cls: string) {
  return svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    const hasClass = /class\s*=/.test(attrs);
    if (hasClass) {
      return `<svg${attrs.replace(/class\s*=\s*"([^"]*)"/, `class="$1 ${cls}"`)}>`;
    }
    return `<svg class="${cls}"${attrs}>`;
  });
}


function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function parseNumber(input: HTMLInputElement, fallback: number) {
  const v = Number(input.value);
  return Number.isFinite(v) ? v : fallback;
}

export function mountProfile(root: HTMLElement) {
  const abort = new AbortController();
  void mountProfileInner(root, abort.signal);
  return () => {
    abort.abort();
  };
}

async function mountProfileInner(root: HTMLElement, signal: AbortSignal) {
  // 蛻晄悄繝ｭ繝ｼ繝・
  const saved = await loadProfile();
  if (signal.aborted) {
    return;
  }
  const initial = saved ?? DEFAULT_PROFILE;

  const state: State = {
    isSynced: !!saved,
    dirty: false,
    current: cloneProfile(initial),
    lastSaved: saved ? cloneProfile(saved) : null,
  };

  // 謠冗判
  if (signal.aborted) {
    return;
  }
  root.innerHTML = `
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto max-w-[520px] px-5 py-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Profile Settings</h1>
          <p class="mt-1 text-sm text-slate-400">Athlete Biometrics (MVP Test)</p>
        </div>

        <div class="flex items-center gap-2">
          <div id="statusPill" class="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
            <span id="statusIcon" class="inline-flex"></span>
            <span id="statusText" class="font-medium"></span>
          </div>

          <button id="btnResync"
            class="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-900">
            Resync
          </button>
        </div>
      </header>

      <section class="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg shadow-black/20">
        <div class="grid grid-cols-2 gap-4">
          ${field("Age", "age", "yrs")}
          ${field("Height", "heightCm", "cm")}
          ${field("Weight", "weightKg", "kg")}
          ${field("FTP", "ftpW", "w")}
          <div class="col-span-2">${field("VO2max", "vo2max", "ml/kg/min", true)}</div>
        </div>

        <div class="mt-6 border-t border-slate-800/80 pt-5">
          <h2 class="text-lg font-semibold tracking-tight">AI Training Policy</h2>
          <p class="mt-1 text-sm text-slate-400">
            Select the primary drivers for your upcoming training block.
          </p>
          <div
            id="focusGroup"
            role="radiogroup"
            aria-label="AI Training Policy"
            class="mt-4 flex flex-wrap gap-3"
          ></div>
        </div>

        <div class="mt-6 border-t border-slate-800/80 pt-5">
          <h2 class="text-lg font-semibold tracking-tight">Preferences</h2>
          <label
            class="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-4"
          >
            <div>
              <div class="text-sm font-medium text-slate-100">Track Session RPE</div>
              <div class="text-xs text-slate-400">Prompt for exertion after workouts.</div>
            </div>
            <div class="relative">
              <input
                id="trackSessionRpe"
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
            </div>
          </label>
        </div>

        <div class="mt-6">
          <button id="btnSave"
            class="w-full rounded-2xl bg-sky-500/90 py-4 font-semibold text-slate-950 hover:bg-sky-400">
            Save Configuration
          </button>

          <p id="hint" class="mt-3 text-xs text-slate-400">
            蜈･蜉帙ｒ隗ｦ繧九→UNSYNC縺ｫ縺ｪ繧翫∪縺吶４ave縺ｧSYNCED縺ｫ謌ｻ繧翫∪縺吶３esync縺ｯDB縺ｮ蛟､縺ｧ荳頑嶌縺阪＠縺ｾ縺吶・
          </p>
        </div>
      </section>
    </div>
  </div>
  `;

  // 蜿ら・
  const ageEl = root.querySelector<HTMLInputElement>("#age")!;
  const heightEl = root.querySelector<HTMLInputElement>("#heightCm")!;
  const weightEl = root.querySelector<HTMLInputElement>("#weightKg")!;
  const ftpEl = root.querySelector<HTMLInputElement>("#ftpW")!;
  const vo2El = root.querySelector<HTMLInputElement>("#vo2max")!;

  const btnSave = root.querySelector<HTMLButtonElement>("#btnSave")!;
  const btnResync = root.querySelector<HTMLButtonElement>("#btnResync")!;
  const statusIcon = root.querySelector<HTMLSpanElement>("#statusIcon")!;
  const statusText = root.querySelector<HTMLSpanElement>("#statusText")!;
  const statusPill = root.querySelector<HTMLDivElement>("#statusPill")!;
  const focusGroup = root.querySelector<HTMLDivElement>("#focusGroup")!;
  const trackSessionRpeEl = root.querySelector<HTMLInputElement>("#trackSessionRpe")!;
  const eventOptions = { signal };

  function setFormFromProfile(p: ProfileData) {
    ageEl.value = String(p.age);
    heightEl.value = String(p.heightCm);
    weightEl.value = String(p.weightKg);
    ftpEl.value = String(p.ftpW);
    vo2El.value = String(p.vo2max);
    trackSessionRpeEl.checked = p.trackSessionRpe ?? true;
  }

  function readProfileFromForm(): ProfileData {
    // 縺悶▲縺上ｊ螳牙・蝓滂ｼ医ユ繧ｹ繝育畑・・
    const age = clampNum(parseNumber(ageEl, state.current.age), 10, 99);
    const heightCm = clampNum(parseNumber(heightEl, state.current.heightCm), 100, 230);
    const weightKg = clampNum(parseNumber(weightEl, state.current.weightKg), 30, 150);
    const ftpW = clampNum(parseNumber(ftpEl, state.current.ftpW), 50, 600);
    const vo2max = clampNum(parseNumber(vo2El, state.current.vo2max), 10, 90);
    const trainingFocus = normalizeTrainingFocus(state.current.trainingFocus);
    const trackSessionRpe = trackSessionRpeEl.checked;
    return { age, heightCm, weightKg, ftpW, vo2max, trainingFocus, trackSessionRpe };
  }

  function markDirty() {
    state.dirty = true;
    state.isSynced = false;
    renderStatus();
    renderSaveButton();
    renderFocusPills();
  }

  function renderStatus() {
    const synced = state.isSynced && !state.dirty;

    if (synced) {
      statusPill.className =
        "flex items-center gap-2 rounded-full border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm";
      statusIcon.innerHTML = withSvgClass(cloudCheckSvg, "h-5 w-5 text-emerald-400");
      statusText.textContent = "SYNCED";
    } else {
      statusPill.className =
        "flex items-center gap-2 rounded-full border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm";
      statusIcon.innerHTML = withSvgClass(cloudXSvg, "h-5 w-5 text-rose-400");
      statusText.textContent = "UNSYNC";
    }
  }

  function renderSaveButton() {
    const synced = state.isSynced && !state.dirty;
    btnSave.disabled = synced;
    btnSave.className = synced
      ? "w-full rounded-2xl bg-slate-800/70 py-4 font-semibold text-slate-400 cursor-not-allowed"
      : "w-full rounded-2xl bg-sky-500/90 py-4 font-semibold text-slate-950 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";
  }

  function renderFocusPills() {
    const synced = state.isSynced && !state.dirty;
    const active = normalizeTrainingFocus(state.current.trainingFocus)[0];

    focusGroup.innerHTML = focusOptions
      .map((option) => {
        const selected = option.key === active;
        const iconSvg = synced && selected ? checkSvg : option.icon;
        const iconClass = selected ? "h-5 w-5 text-sky-300" : "h-5 w-5 text-slate-400";
        const buttonClass = selected
          ? "group inline-flex items-center gap-2 rounded-full border border-sky-500/70 bg-sky-500/10 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_0_0_1px_rgba(14,165,233,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
          : "group inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30";

        return `
        <button
          type="button"
          data-focus="${option.key}"
          role="radio"
          aria-checked="${selected ? "true" : "false"}"
          class="${buttonClass}"
        >
          ${withSvgClass(iconSvg, iconClass)}
          <span>${option.label}</span>
        </button>`;
      })
      .join("");
  }

  function attachDirtyHandlers() {
    [ageEl, heightEl, weightEl, ftpEl, vo2El].forEach((el) => {
      el.addEventListener(
        "input",
        () => {
          state.current = readProfileFromForm();
          markDirty();
        },
        eventOptions,
      );
    });

    trackSessionRpeEl.addEventListener(
      "change",
      () => {
        state.current = readProfileFromForm();
        markDirty();
      },
      eventOptions,
    );
  }

  function attachFocusHandlers() {
    focusGroup.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>("button[data-focus]");
        if (!button) {
          return;
        }
        const next = button.dataset.focus;
        if (!next || state.current.trainingFocus[0] === next) {
          return;
        }
        state.current.trainingFocus = [next];
        markDirty();
      },
      eventOptions,
    );

    focusGroup.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== " ") {
          return;
        }
        const target = event.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>("button[data-focus]");
        if (!button) {
          return;
        }
        event.preventDefault();
        button.click();
      },
      eventOptions,
    );
  }

  // 蛻晄悄蜿肴丐
  setFormFromProfile(initial);
  renderStatus();
  renderSaveButton();
  renderFocusPills();
  attachDirtyHandlers();
  attachFocusHandlers();

  // Save・唔ndexedDB縺ｸ菫晏ｭ・竊・SYNCED
  btnSave.addEventListener(
    "click",
    async () => {
      state.current = readProfileFromForm();
      await saveProfile(state.current);
      if (signal.aborted) {
        return;
      }
      state.lastSaved = cloneProfile(state.current);
      state.dirty = false;
      state.isSynced = true;
      renderStatus();
      renderSaveButton();
      renderFocusPills();
    },
    eventOptions,
  );

  // Resync・咼B縺九ｉ隱ｭ縺ｿ逶ｴ縺冷・繝輔か繝ｼ繝縺ｸ荳頑嶌縺・竊・SYNCED
  btnResync.addEventListener(
    "click",
    async () => {
      const p = await loadProfile();
      if (signal.aborted) {
        return;
      }
      const next = p ?? DEFAULT_PROFILE;
      state.current = cloneProfile(next);
      state.lastSaved = p ? cloneProfile(p) : null;
      state.dirty = false;
      state.isSynced = !!p;
      setFormFromProfile(next);
      renderStatus();
      renderSaveButton();
      renderFocusPills();
    },
    eventOptions,
  );
}

function field(label: string, id: keyof ProfileData, unit: string, full = false) {
  const col = full ? "" : "";
  return `
  <label class="${full ? "" : ""} block">
    <div class="mb-2 flex items-center justify-between">
      <span class="text-sm font-medium text-slate-200">${label}</span>
      <span class="text-xs text-slate-400">${unit}</span>
    </div>
    <input
      id="${id}"
      inputmode="decimal"
      class="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-base text-slate-100 outline-none
             focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
      placeholder="${label}"
    />
  </label>`;
}
