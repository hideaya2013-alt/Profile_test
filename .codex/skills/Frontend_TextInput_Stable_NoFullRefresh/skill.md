## Skill: Frontend_TextInput_Stable_NoFullRefresh

Version: 1.0
Path（提案）: ./.codex/skills/Frontend_TextInput_Stable_NoFullRefresh/skill.md

### 用途

Vanilla TS（innerHTML系レンダ）でも、テキスト入力（textarea / input）を 連続入力・改行・IME変換・ペースト含めて安定させる。
入力イベントで画面全体をrefresh（DOM差し替え）しない設計に統一するためのSkill。

ねらい

1文字入力ごとの root.innerHTML = ... 等による DOM総入れ替えを禁止し、フォーカス/カーソル/IMEを壊さない。

“初回描画” と “局所更新” を分離して、今後の画面拡張でも入力バグを再発させない。

### やること

renderOnce / bindOnce / updateUI に分離

renderOnce()：DOM骨格を一度だけ生成（innerHTML はここだけ）

bindOnce()：イベント付与は一度だけ（可能ならイベント委譲）

updateUI()：状態変化は 必要箇所だけ textContent / classList / disabled / value を更新

入力イベント（input）では state 更新だけ

textarea.addEventListener("input", ...) で state.draft 更新＋dirty算出

refresh禁止（DOM再生成禁止）

overlay / modal は DOMを保持して show/hide

開閉で作り直さない（入力中に消えない）

open時に textarea.value = state.draft.xxx を流し込む

textareaは “valueプロパティ” を正として扱う

innerHTML やテンプレ文字列で value を毎回埋め直さない

グローバルkeydownがある場合は入力要素を除外

e.target が TEXTAREA/INPUT/contenteditable のときは早期return

### やらないこと

React/Vue等のフレームワーク前提の解決（このSkillはVanilla TS向け）

“全UIを仮想DOM化”などの大改修

バックエンド通信、永続化設計そのもの（入力安定化の範囲に限定）

送信ショートカット仕様の決定（Ctrl+Enter等は別Skillで扱う）

## 使用例（パターン）
### 1) 初回だけ描画 → 以降は更新
let mounted = false;

function mount(root: HTMLElement) {
  if (!mounted) {
    renderOnce(root);
    bindOnce(root);
    mounted = true;
  }
  updateUI(root);
}

function renderOnce(root: HTMLElement) {
  root.innerHTML = `
    <div>
      <button data-open-doctrine>Edit</button>

      <div data-overlay hidden>
        <textarea data-field="shortTerm"></textarea>
        <textarea data-field="season"></textarea>
        <textarea data-field="constraints"></textarea>
        <textarea data-field="principles"></textarea>
        <button data-save>Save</button>
        <button data-close>Return</button>
      </div>
    </div>
  `;
}

### 2) inputで state 更新（refresh禁止）
function bindOnce(root: HTMLElement) {
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLTextAreaElement)) return;

    const key = t.dataset.field as keyof Draft | undefined;
    if (!key) return;

    state.draft[key] = t.value;
    state.dirty = computeDirty(state.draft, state.saved);
    updateDoctrineSaveUI(root);     // overlay内だけ更新
    updateSyncUI(root);             // headerだけ更新
  });
}

### 3) overlayを保持して開閉（open時にvalue注入）
function openDoctrine(root: HTMLElement) {
  const ov = root.querySelector("[data-overlay]") as HTMLElement;
  ov.hidden = false;

  (root.querySelector('textarea[data-field="shortTerm"]') as HTMLTextAreaElement).value = state.draft.shortTerm;
  // …他フィールドも同様
}
function closeDoctrine(root: HTMLElement) {
  (root.querySelector("[data-overlay]") as HTMLElement).hidden = true;
}

### 4) グローバルkeydownがある場合の安全柵
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement | null;
  if (!t) return;
  if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || (t as any).isContentEditable) return;

  // ここから先にアプリ全体ショートカット
});

#### いつ使うべきか

refresh() が root.innerHTML = ... を含み、入力UI（textarea/input）を持つ画面で不具合が出たとき

Modal/overlayを開くUIがあり、入力中に状態更新が頻繁に走るとき

IME利用者が多い（日本語入力前提）プロジェクト

### 成功条件（受け入れ）

連続タイピングでフォーカスが飛ばない

Enterで改行できる

IME変換中に変換が途切れない

長文ペーストでも崩れない

入力中に root.innerHTML の再実行が走らない（初回renderOnceのみ）