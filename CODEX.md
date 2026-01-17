# CODEX.md（不変の契約事項）

この文書は **不変の契約事項**。
以後の実装は、ここを破らず「追加」で進める。
変更が必要になった場合は、必ず理由と影響範囲を明記し、version を上げる。

version: 0.2

---

## 0. 目的 / 到達点（MVPの現実ライン）
- フロントのみで動作（Vite + Vanilla TS + Tailwind）
- ローカル保存（IndexedDB）で完結
- 4画面（Profile / New Activity / History / Tri-Coach）を段階的に積み上げる
- MVP_v1 では「家のWiFiでバックエンドに繋がっているか」を Connected 表示対象とする
  - OpenAI API のオンライン表示とは分離（後で拡張）

---

## 1. 不変の契約事項（最重要）
### 1.1 Source of Truth
- **DB（IndexedDB）が常に正（唯一の正）**
- UIのフォーム/表示は DB の写像（ミラー）
- ContextPack は DB から生成される派生物であり、直接編集しない

### 1.2 スキーマ互換（壊さない）
- 既存のキー名・型・意味を変更しない（rename禁止）
- 追加は OK（後方互換）
- 迷ったら “新キーを足す” を優先

#### 契約：永続化フィールド追加時の互換性（必須）
- 新フィールドを追加した場合、**既存DB（古いレコード）にはキーが存在しない**前提で扱う。
- `loadProfile()` / `loadPreferences()` 等の **load系で必ず補完・正規化**してから UI に渡す。
- UIは補完後の値を表示し、保存時に以後の永続化形式を確定する（undefined を残さない）。

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

### 2.2 Context Sync（ContextPack vs DB）
- DIRTY: DB更新後に ContextPack が再生成されていない
- Resync（=Rebuild ContextPack）: DBから ContextPack を再生成して DIRTY を解消

※ Storage Sync と Context Sync は概念として分離する（画面によって必要な方だけ使う）。

---

## 3. Skill の利用（短縮指示のための合言葉）
- `Frontend_DynamicIcon_StateDriven` を適用する箇所：
  - Syncバッジ、Connected表示、処理状態など
- `Frontend_SelectablePill_WithIcon` を適用する箇所：
  - AI Training Focus の選択ピル（単一選択/複数選択は画面仕様に従う）
  - タグ型フィルタ等

（スキル実装詳細は `.codex/skills/*/skill.md` を参照）

---

## 4. データモデル（最小）
### 4.1 Profile（例）
- age: number
- heightCm: number
- weightKg: number
- ftpW: number
- vo2max: number
- trainingFocus: string[]  // 例: ["continuity"]（単一なら配列長1）
- trainingFocus は空配列を許さない（常に1要素）
- 初期値は ["continuity"]

### 4.2 Preferences
- trackSessionRpe: boolean
  - 初期値: true
  -指示プロンプトに前提条件が記載があればプロンプトに従う
  - 既存DBにキーが無い場合: load時に true を補完して扱う

### 4.3 Activity（History用）
- id: string
- sport: "swim" | "bike" | "run" | "strength" | "other"
- startTime: string（ISO）
- durationSec?: number
- distanceM?: number
- elevM?: number
- rpe?: number
- comment?: string
- source?: "gpx" | "manual"

### 4.4 Plan（Tri-Coachの出力保存）
- id: string
- createdAt: string（ISO）
- days: Array<{
  date: string（YYYY-MM-DD）
  sessions: Array<{
    sport: string
    title: string
    durationMin?: number
    intensity?: string
    paceGuide?: string  // 例: "6:00–7:00/km"
    notes?: string
  }>
}>

---

## 5. 画面要件（要点だけ固定）
### 5.1 Profile
- Biometric入力 → Save/Resync → SYNCED/UNSYNC 変化
- Training Focus ピル（SelectablePill skill）
- Preferences トグル（trackSessionRpe）
  - 初期値は ON（true）
  - トグル変更で UNSYNC、Save で SYNCED に戻す

### 5.2 New Activity
- GPX import / Manual entry
- GPX は決め打ち（将来拡張はするがMVPはGPX中心）
- スイムHRは “枠だけ” 用意（無ければ無いでOK）

### 5.3 History
- 最新順リスト
- タップで詳細
- 編集（sport変更、コメント追記、RPE追記など）/ 削除

### 5.4 Tri-Coach
- チャット欄（広め）
- AI返信型は 3択固定：
  - 「変更なし」
  - 「提案（plan_patch）」
  - 「回答のみ」
- plan_patch は Apply で反映（自動反映しない）
- メニュー表示は「週固定ではない」
  - 残っているメニューをスライド表示
  - 各カードに削除ボタン

---

## 6. 実装ルール（ブレないための作法）
- フレームワークは使わない（React等は使わない）
- 依存追加は最小（必要なら理由を書く）
- `src/` 配下で責務分離（例：db.ts / profile.ts / ui/*.ts）
- 既存の入力・出力仕様を壊さずに追加していく（後方互換）

---

## 7. 変更手順（どうしても契約を変える時）
- “なぜ必要か” / “影響範囲” / “移行方針” を書く
- version を上げる
- 破壊的変更は原則しない（やるなら別ブランチ）

## Architecture Rule: 依存しないブロック設計（1機能=1ブロック）

このプロジェクトでは「画面/機能をブロック化」し、ブロック間の依存を極小化する。
目的は、変更の波及を防ぎ、AI実装でも壊れにくい構造を維持すること。

### 1) ブロックの定義
- 1画面 = 1ブロック（例: Profile / New Activity / History / Tri AI Coach など）
- 各ブロックは `src/screens/<screen>.ts` に配置し、`mount(root)` を export する。
- ブロックは引数 `root` 配下だけを操作し、DOMや状態を外へ漏らさない。

### 2) 依存禁止ルール（最重要）
- screens/* は **他の screens/* を import してはいけない**（画面間依存は禁止）
- ブロック内の補助関数は export しない（ファイル内 private）
- 共通化したくなる関数が出ても、原則「重複OK」でブロック内に閉じる
  - ※共通化は最終段階で必要になった場合のみ検討する

### 3) 共有を許可する“境界”は最小限
- screens/* が import してよいのは次のみ：
  - `src/db.ts`（IndexedDB I/O のみ）
  - `src/types.ts`（データ型のみ）
  - `src/services/*`（コンテキストパック生成など。UIロジックは置かない）
- DBアクセスは `db.ts` 経由に統一し、DB処理の重複は避ける（データ破損防止）

### 4) main.ts の責務
- `src/main.ts` はルーター/ナビゲーションのみ担当する
- 画面固有のロジックやDOM生成は持たない（各 screens に委譲）
- 画面追加は「screensにファイル追加 + registryに登録」で完結させる

### 5) クリーンアップ（イベント残留防止）
- 画面が addEventListener / timer を使う場合、画面切替時に解除できるようにする
  - mount が cleanup 関数を返す、または unmount を用意して main.ts が呼ぶ

### 6) 実装スタイルの優先順位
- 「壊れない」>「DRY（共通化）」>「美しさ」
- まず動く最小ブロックを作り、必要になった時だけ段階的に共通化する

### 7) Profile_testプロジェクト内のみ有効
- Tri AI Coach は将来 `menu` と `chat` に分割する可能性があるため、ブロックは増やしてよい（依存禁止ルールは維持）
