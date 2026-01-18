# PROJECT_NOTES.md（Profile_test 固有仕様）

この文書は **本プロジェクト固有**。CODEX.md（不変契約）に反しない範囲で更新してよい。

---

## 0. 目的 / 到達点（MVPの現実ライン）
- フロントのみで動作（Vite + Vanilla TS + Tailwind）
- ローカル保存（IndexedDB）で完結
- 4画面（Profile / New Activity / History / Tri-Coach）を段階的に積み上げる
- MVP_v1 では「家のWiFiでバックエンドに繋がっているか」を Connected 表示対象とする
  - OpenAI API のオンライン表示とは分離（後で拡張）

---

## 1. Skill の利用（短縮指示のための合言葉）
- `Frontend_DynamicIcon_StateDriven` を適用する箇所：
  - Syncバッジ、Connected表示、処理状態など
- `Frontend_SelectablePill_WithIcon` を適用する箇所：
  - AI Training Focus の選択ピル（単一選択/複数選択は画面仕様に従う）
  - タグ型フィルタ等
- `Frontend_ToggleSwitch_PeerA11y`：
  - Preferences トグル等（checkbox実体 + peer + A11y）

---

## 2. データモデル（最小・本プロジェクト版）
### 2.1 Profile（例）
- age: number
- heightCm: number
- weightKg: number
- ftpW: number
- vo2max: number
- trainingFocus: string[]  // 例: ["continuity"]（単一なら配列長1）
- trainingFocus は空配列を許さない（常に1要素）
- 初期値は ["continuity"]

### 2.2 Preferences
- trackSessionRpe: boolean
  - 初期値: true
  - 既存DBにキーが無い場合: load時に true を補完して扱う

### 2.3 Activity（History用）
- id: string
- sport: "swim" | "bike" | "run" | "strength" | "other"
- startTime: string（ISO）
- durationSec?: number
- distanceM?: number
- elevM?: number
- rpe?: number
- comment?: string
- source?: "gpx" | "manual"

### 2.4 Plan（Tri-Coachの出力保存）
- id: string
- createdAt: string（ISO）
- days: Array<{
  date: string（YYYY-MM-DD）
  sessions: Array<{
    sport: string
    title: string
    durationMin?: number
    intensity?: string
    paceGuide?: string
    notes?: string
  }>
}>

---

## 3. 画面要件（要点だけ固定）
### 3.1 Profile
- Biometric入力 → Save/Resync → SYNCED/UNSYNC 変化
- Training Focus ピル（SelectablePill skill）
- Preferences トグル（trackSessionRpe）
  - 初期値は ON（true）
  - トグル変更で UNSYNC、Save で SYNCED に戻す

### 3.2 New Activity
- GPX import / Manual entry
- GPX は決め打ち（将来拡張はするがMVPはGPX中心）
- スイムHRは “枠だけ” 用意（無ければ無いでOK）

### 3.3 History
- 最新順リスト
- タップで詳細
- 編集（sport変更、コメント追記、RPE追記など）/ 削除

### 3.4 Tri-Coach（Menu + Chat）
- チャット欄（広め）
- AI返信型は 3択固定：
  - 「変更なし」
  - 「提案（plan_patch）」
  - 「回答のみ」
- plan_patch は Apply で反映（自動反映しない）
- メニュー表示は「週固定ではない」
  - 残っているメニューをスライド表示
  - 各カードに削除ボタン
- 将来 `menu` と `chat` に分割する可能性あり（ブロック増加OK）

---

## 4. アイコン配置（本プロジェクトの運用）
- 外部CDNは禁止（CODEX準拠）
- 種目アイコンは `src/assets/icons/focus/` に格納（階層は増やさない）
