# CODEX.md（不変の契約事項）

この文書は **不変の契約事項**。
以後の実装は、ここを破らず「追加」で進める。
変更が必要になった場合は、必ず理由と影響範囲を明記し、version を上げる。

version: 0.3

---

## 1. 不変の契約事項（最重要）
### 1.1 Source of Truth
- **DB（永続化ストア）が常に正（唯一の正）**
- UIのフォーム/表示は DB の写像（ミラー）
- 派生データ（ContextPack等）は DB から生成される派生物であり、直接編集しない

### 1.2 スキーマ互換（壊さない）
- 既存のキー名・型・意味を変更しない（rename禁止）
- 追加は OK（後方互換）
- 迷ったら “新キーを足す” を優先

#### 契約：永続化フィールド追加時の互換性（必須）
- 新フィールドを追加した場合、**既存DB（古いレコード）にはキーが存在しない**前提で扱う
- `load*()` 等の **load系で必ず補完・正規化**してから UI に渡す
- UIは補完後の値を表示し、保存時に以後の永続化形式を確定する（undefined を残さない）

### 1.3 アイコンポリシー
- **外部CDN禁止**
- アイコンは **ローカルSVG同梱**のみ
- 色は `currentColor` + Tailwind class で制御（SVGの塗り替えで対応しない）
- 形状変更は SVG差し替え（状態ごとに別SVG）

### 1.4 Developer Mode
- 通常UIで JSON生表示はしない
- **Developer Mode のときだけ** JSON/デバッグ情報を表示できる（トグル or クエリパラメータ等）
- デバッグのための表示は “読み取り専用” を基本とする

### 1.5 反映方式（自動更新しない）
- AI提案や plan_patch は **Apply を押して初めて反映**
- 自動でDBを書き換えない（誤爆防止）

---

## 2. 状態モデル（UIの共通語彙）
### 2.1 Storage Sync（フォーム vs DB）
- SYNCED: 画面の入力値 == DB
- UNSYNC: 画面の入力値 != DB（ユーザーが触って未保存）
- Save: DBへ書き込み、SYNCEDへ戻す
- Resync: DBの値で画面を上書きし、SYNCEDへ戻す

### 2.2 Context Sync（派生物 vs DB）
- DIRTY: DB更新後に派生物（ContextPack等）が再生成されていない
- Resync（=Rebuild）: DBから派生物を再生成して DIRTY を解消
※ Storage Sync と Context Sync は概念として分離する

---

## 3. UI実装の定石（Screen内完結 / 壊れにくい）
- 各Screenは `mount(root)` の中で `render()` と `bind()` を持つ
- `render()`：state から `root.innerHTML` を生成（DOM差分管理はしない）
- `bind()`：描画後のDOMに対してイベントを登録
- イベントは AbortController を使い、cleanupで `abort()` して残留を防ぐ
- state更新は最小なら `render(); bind();` でOK（必要になったら部分更新へ）
- 画面遷移後にイベント二重発火が起きないことを必ず確認する
- `bind()` のたびに controller を作り直す／前のを abort する

---

## 4. Architecture Rule: 依存しないブロック設計（1機能=1ブロック）
### 4.1 ブロックの定義
- 1画面 = 1ブロック
- 各ブロックは `src/screens/<screen>.ts` に配置し、`mount(root)` を export
- ブロックは引数 `root` 配下だけを操作し、DOMや状態を外へ漏らさない

### 4.2 依存禁止ルール（最重要）
- screens/* は **他の screens/* を import してはいけない**（画面間依存は禁止）
- ブロック内の補助関数は export しない（ファイル内 private）
- 共通化は急がない：
  - 同一ブロック内：private関数化はOK
  - 別ブロック間：原則重複OK。共通化は「3回目以降」か「明確に純粋関数」に限定して検討

### 4.3 共有を許可する“境界”は最小限
- screens/* が import してよいのは次のみ：
  - `src/db.ts`（永続化 I/O のみ）
  - `src/types.ts`（データ型のみ）
  - `src/services/*`（派生物生成・通信など。UIロジックは置かない）
- DBアクセスは `db.ts` 経由に統一（地雷の散在防止）

### 4.4 main.ts の責務
- `src/main.ts` はルーター/ナビゲーションのみ担当
- 画面固有のロジックやDOM生成は持たない

---

## 5. Rule: Frontend と Backend（FastAPI）は別扱い（流儀を混ぜない）
- Frontend（Vite/TS/Tailwind/IndexedDB）の “1画面=1ブロック” ルールを Backend に適用しない
- Backend（FastAPI）は APIキー保管・外部APIプロキシ・重い処理の置き場
- Frontend からは `src/services/*` を境界にして呼ぶ（差し替え可能な薄いAPIにする）

---

## 6. 変更手順（どうしても契約を変える時）
- “なぜ必要か” / “影響範囲” / “移行方針” を書く
- version を上げる
- 破壊的変更は原則しない（やるなら別ブランチ）