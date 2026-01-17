# Frontend_DynamicIcon_StateDriven

Version: 1.0  
Scope: Frontend / UI State

## 用途
UIの状態（例: SYNCED / UNSYNC / DIRTY）に応じて、ローカルSVGアイコンの
- (a) 形状（SVGそのもの）
- (b) 色（class / currentColor）
を **分離して** 安全に動的変更する。

## 前提
- アイコンは **ローカルSVG** を使用する（`src/assets/...` など）
- **外部CDN参照は禁止**
- SVGは `innerHTML` 注入（文字列）またはコンポーネント的に扱う（Vanillaでも可）
- 「形状切替」と「色切替」は必ず分離する

## 実装方針
### (a) 形状の切替（SVG差し替え）
- 状態ごとに `cloudCheckSvg`, `cloudXSvg` のようなSVG文字列を用意して切替

### (b) 色変更（class / currentColor）
- SVG側は `stroke="currentColor"` / `fill="none"` を基本にする
- 色は `text-emerald-400` など Tailwind class で外側から指定

### 推奨ユーティリティ
- SVG文字列に class を注入する `withSvgClass(svg, className)` を用意する  
  ※ これで「形状」と「色」を分離しやすくなる

## やらないこと
- 状態遷移そのものの定義（ビジネスロジック）
- API通信の実装
- どの状態を持つべきかの最終決定

## 使用例（Vanilla TS + Tailwind）
```ts
type SyncState = "SYNCED" | "UNSYNC" | "DIRTY";

const cloudCheckSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.9A4 4 0 0 0 6 19Z"/>
  <path d="m9 12 2 2 4-4"/>
</svg>`;

const cloudXSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.9A4 4 0 0 0 6 19Z"/>
  <path d="M10 11l4 4M14 11l-4 4"/>
</svg>`;

function withSvgClass(svg: string, className: string) {
  return svg.replace(/<svg\b([^>]*)>/, (_m, attrs) => {
    if (/class=/.test(attrs)) {
      return `<svg${attrs.replace(/class="([^"]*)"/, (_m2, c) => ` class="${className} ${c}"`)}>`;
    }
    return `<svg class="${className}"${attrs}>`;
  });
}


function renderSyncIcon(el: HTMLElement, state: SyncState) {
  const shape = state === "SYNCED" ? cloudCheckSvg : cloudXSvg;
  const colorClass = state === "SYNCED" ? "text-emerald-400" : "text-rose-400";
  el.innerHTML = withSvgClass(shape, `h-5 w-5 ${colorClass}`);
}

type SyncState = "SYNCED" | "UNSYNC" | "DIRTY";

const ICON_SPEC: Record<SyncState, { svg: string; color: string }> = {
  SYNCED: { svg: cloudCheckSvg, color: "text-emerald-400" },
  UNSYNC: { svg: cloudXSvg,     color: "text-rose-400" },
  DIRTY:  { svg: cloudXSvg,     color: "text-amber-400" },
};

function renderSyncIcon(el: HTMLElement, state: SyncState) {
  const spec = ICON_SPEC[state];
  el.innerHTML = withSvgClass(spec.svg, `h-5 w-5 ${spec.color}`);
}

// Viteならこれが一番運用ラク（SVGを文字列で取り込める）
import cloudCheckSvg from "@/assets/icons/status/cloud-check.svg?raw";
import cloudXSvg from "@/assets/icons/status/cloud-x.svg?raw";
