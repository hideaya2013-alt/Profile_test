# Skill: Frontend_ToggleSwitch_PeerA11y

## 用途
checkbox（真の入力）を、見た目だけ「トグルスイッチ」に変換する。
- ON/OFF を boolean で扱う
- キーボード操作/アクセシビリティを壊さない（Tab/Space/Enter）
- UIは Tailwind の peer で状態反映（peer-checked / peer-disabled）

## 前提
- Tailwind を使用できる
- 実体は <input type="checkbox"> を使う（divで疑似スイッチは作らない）
- ラベルで囲み、クリック領域を確保する

## やらないこと
- 永続化（IndexedDB等）や API 通信
- dirty/synced の判定ロジック（呼び出し側で持つ）
- 文言や項目の最終決定

## 実装レシピ（HTML）
- input は sr-only + peer
- 見た目は「レール」と「つまみ」の2要素
- role="switch" を付与（任意だが推奨）

```html
<label class="flex items-center justify-between gap-3">
  <div>
    <div class="text-base font-semibold">TITLE</div>
    <div class="text-sm text-slate-400">DESCRIPTION</div>
  </div>

  <input
    id="toggle-id"
    type="checkbox"
    class="sr-only peer"
    role="switch"
  />

  <div
    class="relative h-7 w-12 rounded-full bg-slate-700/80 ring-1 ring-white/10 transition
           peer-checked:bg-sky-500/80
           peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-sky-400/70
           peer-disabled:opacity-50"
  >
    <div
      class="absolute left-1 top-1 h-5 w-5 rounded-full bg-white/90 shadow transition
             peer-checked:translate-x-5"
    ></div>
  </div>
</label>
実装レシピ（TS/JS）
bind: checked を state に同期

change: state を更新し、必要なら dirty を立てて再描画

ts
コードをコピーする
const el = document.getElementById("toggle-id") as HTMLInputElement;

function setToggle(checked: boolean) {
  el.checked = checked;
}

el.addEventListener("change", () => {
  const v = el.checked; // boolean
  // state更新 + dirty反映などは呼び出し側で
});

使用例
Preferences: Track Session RPE (true/false)
Settings: Notifications, Dark Mode, Auto Sync 等

### load時の補完イメージ（例）
```ts
// loadProfile() 内など
profile.trackSessionRpe = profile.trackSessionRpe ?? true;
3) 実装でのポイント（Profile画面）
トグルを触ったら dirty → UNSYNC

Save で IndexedDB保存 → SYNCED

“初期値true” なので、初回起動でもトグルはON表示が標準