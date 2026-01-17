# Frontend_SelectablePill_WithIcon

# Skill: Frontend_SelectablePill_WithIcon

Version: 1.1  
Scope: Frontend / UI Component (Framework-agnostic)

## 目的
選択式のピル（タグ風ボタン）を、**状態（selected/disabled）に応じて**
- 見た目（背景/枠/文字色）
- アイコン（通常 ↔ 選択時）
を切り替え可能にする。

## 使う場面
- フィルタ（All/Swim/Bike/Run）
- モード切替（Simple/Advanced など）
- 設定（複数選択の好みタグ）
- “Focus” のような単一/複数選択UI

## やらないこと
- 項目文言・数・並びの決定
- ビジネスロジック（保存/同期/API）
- デザイン最終調整（余白・角丸・影の統一は画面側で）

## 前提（重要）
- アイコンは **ローカルSVG**（外部CDN禁止）
- SVGは原則 `stroke="currentColor"`（または `fill="currentColor"`）で
  **色はCSS/Tailwind側から渡す**
- **形状切替（SVG差替）** と **色切替（class）** を分離する

## インターフェース（最小）
### Data
```ts
type PillItem = {
  id: string;
  label: string;
  selected: boolean;
  disabled?: boolean;

  // “形状”だけを差し替える（色は currentColor + class で制御）
  baseIconSvg: string;
  selectedIconSvg: string;
};
Options
ts
コードをコピーする
type PillOptions = {
  multi: boolean;                 // false=単一選択 / true=複数選択
  disabledIds?: string[];
  onChange: (items: PillItem[]) => void; // state更新後に呼ぶ
};
振る舞い仕様
multi=false（単一選択）:

クリックされた item だけ selected=true、他は false

multi=true（複数選択）:

クリックされた item をトグル

disabled:

クリック/キー操作で変化しない

見た目は opacity などで明示

キーボード / A11y（MVP基準）
要件: Tabでフォーカス移動、Space/Enterで選択可能

実装: button を基本にして

単一/複数とも MVP は aria-pressed で運用可

厳密にやる場合のみ:

単一選択: role="radiogroup" + role="radio" + aria-checked

スタイル指針（classで制御）
非選択: “default(グレー)”（背景/枠/文字）

選択: 枠・背景を強める（例: border濃く、bg薄い発光）

状態変化のルール例:

「選択」= 枠 + 背景 + 文字 + アイコン（任意）

「未保存/Dirty」など別状態は 別Skill/画面側ロジックで上書きしてOK
（このSkillは “selected/disabled” まで）

実装レシピ（Vanilla TS 最小）
MVPでは「再描画」で十分。最適化は後で。

ts
コードをコピーする
function withSvgClass(svg: string, className: string) {
  // svg文字列にclassを注入（既にclassがあれば追記）
  if (svg.includes("class=")) return svg.replace('class="', `class="${className} `);
  return svg.replace("<svg", `<svg class="${className}"`);
}

export function renderSelectablePills(
  container: HTMLElement,
  items: PillItem[],
  opt: PillOptions
) {
  container.innerHTML = "";
  container.className = "flex flex-wrap gap-3";

  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = !!item.disabled;
    btn.setAttribute("aria-pressed", String(item.selected));

    const base =
      "inline-flex items-center gap-2 rounded-full px-4 py-2 border text-sm font-semibold transition";
    const stateClass = item.selected
      ? "bg-sky-600/15 border-sky-400 text-sky-200"
      : "bg-slate-800/40 border-slate-600 text-slate-200 hover:border-slate-400";
    const disabledClass = item.disabled ? "opacity-40 cursor-not-allowed" : "";
    btn.className = `${base} ${stateClass} ${disabledClass}`;

    const svg = item.selected ? item.selectedIconSvg : item.baseIconSvg;

    const icon = document.createElement("span");
    icon.innerHTML = withSvgClass(svg, "h-5 w-5"); // 色はbtnのtext-*を継承
    btn.appendChild(icon);

    const label = document.createElement("span");
    label.textContent = item.label;
    btn.appendChild(label);

    const toggle = () => {
      if (item.disabled) return;

      if (opt.multi) {
        item.selected = !item.selected;
      } else {
        for (const it of items) it.selected = (it.id === item.id);
      }
      opt.onChange(items);
      renderSelectablePills(container, items, opt);
    };

    btn.addEventListener("click", toggle);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    container.appendChild(btn);
  }
}
成功条件チェック（手動テスト）
 Tabで各ピルに移動できる

 Space/Enterで選択が切り替わる

 選択で「枠/背景/文字」が変わる

 選択で「アイコン形状」が変わる（SVG差替）

 disabledが操作不能で見た目も区別できる
