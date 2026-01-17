import { loadProfile, saveProfile, type ProfileData } from "./db";

// ローカルSVG（Tabler）を “生文字列” として読む
import cloudCheckSvg from "./assets/icons/status/cloud-check.svg?raw";
import cloudXSvg from "./assets/icons/status/cloud-x.svg?raw";

type State = {
  isSynced: boolean;
  dirty: boolean;
  current: ProfileData;
  lastSaved: ProfileData | null;
};

const DEFAULT_PROFILE: ProfileData = {
  age: 28,
  heightCm: 182,
  weightKg: 72.5,
  ftpW: 285,
  vo2max: 58,
};

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

export async function mountProfile(root: HTMLElement) {
  // 初期ロード
  const saved = await loadProfile();
  const initial = saved ?? DEFAULT_PROFILE;

  const state: State = {
    isSynced: !!saved,
    dirty: false,
    current: { ...initial },
    lastSaved: saved ? { ...saved } : null,
  };

  // 描画
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

        <div class="mt-6">
          <button id="btnSave"
            class="w-full rounded-2xl bg-sky-500/90 py-4 font-semibold text-slate-950 hover:bg-sky-400">
            Save Configuration
          </button>

          <p id="hint" class="mt-3 text-xs text-slate-400">
            入力を触るとUNSYNCになります。SaveでSYNCEDに戻ります。ResyncはDBの値で上書きします。
          </p>
        </div>
      </section>
    </div>
  </div>
  `;

  // 参照
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

  function setFormFromProfile(p: ProfileData) {
    ageEl.value = String(p.age);
    heightEl.value = String(p.heightCm);
    weightEl.value = String(p.weightKg);
    ftpEl.value = String(p.ftpW);
    vo2El.value = String(p.vo2max);
  }

  function readProfileFromForm(): ProfileData {
    // ざっくり安全域（テスト用）
    const age = clampNum(parseNumber(ageEl, state.current.age), 10, 99);
    const heightCm = clampNum(parseNumber(heightEl, state.current.heightCm), 100, 230);
    const weightKg = clampNum(parseNumber(weightEl, state.current.weightKg), 30, 150);
    const ftpW = clampNum(parseNumber(ftpEl, state.current.ftpW), 50, 600);
    const vo2max = clampNum(parseNumber(vo2El, state.current.vo2max), 10, 90);
    return { age, heightCm, weightKg, ftpW, vo2max };
  }

  function markDirty() {
    state.dirty = true;
    state.isSynced = false;
    renderStatus();
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

  function attachDirtyHandlers() {
    [ageEl, heightEl, weightEl, ftpEl, vo2El].forEach((el) => {
      el.addEventListener("input", () => {
        state.current = readProfileFromForm();
        markDirty();
      });
    });
  }

  // 初期反映
  setFormFromProfile(initial);
  renderStatus();
  attachDirtyHandlers();

  // Save：IndexedDBへ保存 → SYNCED
  btnSave.addEventListener("click", async () => {
    state.current = readProfileFromForm();
    await saveProfile(state.current);
    state.lastSaved = { ...state.current };
    state.dirty = false;
    state.isSynced = true;
    renderStatus();
  });

  // Resync：DBから読み直し→フォームへ上書き → SYNCED
  btnResync.addEventListener("click", async () => {
    const p = await loadProfile();
    const next = p ?? DEFAULT_PROFILE;
    state.current = { ...next };
    state.lastSaved = p ? { ...p } : null;
    state.dirty = false;
    state.isSynced = !!p; // DBに無ければ“同期先が無い”のでfalseでもいいが、挙動は好みで
    setFormFromProfile(next);
    renderStatus();
  });
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
