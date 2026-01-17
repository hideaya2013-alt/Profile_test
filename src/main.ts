import "./style.css";
import { screenOrder, screens } from "./app/registry";
import type { Cleanup, ScreenId } from "./app/types";

const navRoot = document.querySelector<HTMLDivElement>("#app-nav");
const screenRoot = document.querySelector<HTMLDivElement>("#app-screen");

if (!navRoot || !screenRoot) {
  throw new Error("app layout nodes not found");
}

let currentIndex = 0;
let currentCleanup: Cleanup | null = null;

function buttonClass(active: boolean, disabled: boolean) {
  if (disabled) {
    return "rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-sm font-medium text-slate-500 cursor-not-allowed";
  }
  if (active) {
    return "rounded-full border border-sky-500/70 bg-sky-500/15 px-3 py-1 text-sm font-medium text-sky-200 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]";
  }
  return "rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-sm font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-900";
}

function renderNav() {
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === screenOrder.length - 1;

  navRoot.innerHTML = `
  <div class="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 text-slate-100 backdrop-blur">
    <div class="mx-auto flex max-w-[900px] items-center gap-3 px-5 py-3">
      <button
        type="button"
        data-action="prev"
        ${atStart ? "disabled" : ""}
        class="${buttonClass(false, atStart)}"
      >
        Prev
      </button>

      <div class="flex flex-1 flex-wrap gap-2">
        ${screenOrder
          .map((id, index) => {
            const active = index === currentIndex;
            const screen = screens[id];
            return `
            <button
              type="button"
              data-screen="${id}"
              aria-current="${active ? "page" : "false"}"
              class="${buttonClass(active, false)}"
            >
              ${screen.title}
            </button>`;
          })
          .join("")}
      </div>

      <button
        type="button"
        data-action="next"
        ${atEnd ? "disabled" : ""}
        class="${buttonClass(false, atEnd)}"
      >
        Next
      </button>
    </div>
  </div>
  `;
}

function showScreenByIndex(index: number) {
  if (index < 0 || index >= screenOrder.length) return;

  currentCleanup?.();
  currentCleanup = null;

  const id = screenOrder[index];
  const mod = screens[id];

  screenRoot.innerHTML = "";
  const ret = mod.mount(screenRoot);
  if (typeof ret === "function") {
    currentCleanup = ret;
  }

  currentIndex = index;
  renderNav();
}

function goNext() {
  if (currentIndex < screenOrder.length - 1) {
    showScreenByIndex(currentIndex + 1);
  }
}

function goPrev() {
  if (currentIndex > 0) {
    showScreenByIndex(currentIndex - 1);
  }
}

function goTo(id: ScreenId) {
  const idx = screenOrder.indexOf(id);
  if (idx !== -1) {
    showScreenByIndex(idx);
  }
}

navRoot.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action], button[data-screen]");
  if (!button || button.disabled) {
    return;
  }

  const action = button.dataset.action;
  if (action === "prev") {
    goPrev();
    return;
  }
  if (action === "next") {
    goNext();
    return;
  }

  const screen = button.dataset.screen as ScreenId | undefined;
  if (screen) {
    goTo(screen);
  }
});

showScreenByIndex(0);

