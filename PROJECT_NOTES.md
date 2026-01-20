# PROJECT_NOTES.md（Profile_test 固有仕様）

この文書は **本プロジェクト固有**。CODEX.md（不変契約）に反しない範囲で更新してよい。

最終更新: 2026-01-20

---

## 0. 目的 / 到達点（MVPの現実ライン）
- フロントのみで動作（Vite + Vanilla TS + Tailwind）
- ローカル保存（IndexedDB）で完結
- 4画面（Profile / New Activity / History / Tri AI Coach）を段階的に積み上げる
- MVP_v1 では「家のWiFiでバックエンドに繋がっているか」を Connected 表示対象とする  
  - OpenAI API のオンライン表示とは分離（後で拡張）

---

## 1. Skill の利用（短縮指示のための合言葉）
- `Frontend_DynamicIcon_StateDriven`：
  - Syncバッジ、Connected表示、処理状態（IMPORTING/SAVED/ERROR など）
- `Frontend_SelectablePill_WithIcon`：
  - Training Focus の選択ピル
  - タグ型フィルタ等（必要になったら適用）
- `Frontend_ToggleSwitch_PeerA11y`：
  - Preferences トグル等（checkbox実体 + peer + A11y）

---

## 2. データモデル（本プロジェクト確定版）

> すべての永続化は `src/db.ts` 経由。  
> 欠損はエラーではなく **null**（DBに undefined を残さない）。（CODEX準拠）

### 2.1 Profile
- age: number
- heightCm: number
- weightKg: number
- ftpW: number
- vo2max: number
- trainingFocus: string[]
  - 空配列を許さない（常に1要素以上）
  - 初期値: ["continuity"]

### 2.2 Preferences
- trackSessionRpe: boolean
  - 初期値: true
  - 既存DBにキーが無い場合: load時に true を補完して扱う
  - 注意：この値は「メニュー生成で sRPE を考慮するか」のトリガであり、Activity の保存・表示・計算には影響しない（CODEX準拠）

### 2.3 Activity（History の最小単位 / GPX・Manual 共通）
- GPX Import / Manual Entry の両方を **Activity 1本**に格納する（分離しない）

```ts
export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'other'; 
/** 2026.1.20改訂 Other は swim/bike/run 以外の sport をすべて含む（strength/other 等。Gym UIは strength などに寄せる）
- 表示順は全フィルタ共通で compareActivityDesc（startTime→createdAt→id の降順）を使用し、決定的にする */
export type ActivitySource = 'gpx' | 'manual';

export interface Activity {
  id: string;

  source: ActivitySource;

  /** GPXから取得できない場合は null（確認セルで手入力） */
  sport: Sport | null;

  /** 表示用タイトル（GPX: ファイル名 / Manual: 任意 or 固定文言） */
  title: string;

  /** ISO文字列（タイムゾーン付き推奨） */
  startTime: string;
  endTime: string;

  /** 秒（表示・計算の基準単位） */
  durationSec: number;

  /** 欠損は null（エラーにしない） */
  distanceMeters: number | null;
  elevMeters: number | null;

  /** センサー代表値（欠損は null） */
  avgHr: number | null;
  avgPower: number | null;
  avgSpeed: number | null;

  /** UI用（アイコン表示判定） */
  hasHr: boolean;
  hasPower: boolean;
  hasSpeed: boolean;

  /** sRPE（1〜10）。GPXには無いので必ず手動入力。未入力は null */
  sRpe: number | null;

  /** Manual のメモ／コメント。GPXでも必要なら入れてよい。欠損は null */
  notes: string | null;

  createdAt: string;
  updatedAt: string;
}
GPX → Activity 変換ルール（MVP）
sport 自動判定（取れなければ null）

<type> の例：swimming/cycling/running → swim/bike/run（マッピング）

sRpe は必ず null（後で確認セルで入力）

HR/Power/Speed は「存在すれば平均を算出」、存在しなければ null

hasX は「データが1点でも存在」で true、それ以外 false

欠損はエラーではない（nullで保存）

Manual → Activity 変換ルール（MVP）
source = "manual"

sport は UI 選択で決める（基本 null にしない）

センサー値は基本 null（hasX=false）

notes は履歴表示対象（コメント欄）

sRpe は必ず保存（未入力なら null でも可）

2.4 Plan（Tri AI Coach の出力保存）
ts
コードをコピーする
export interface Plan {
  id: string;
  createdAt: string; // ISO
  days: Array<{
    date: string; // YYYY-MM-DD
    sessions: Array<{
      sport: string;
      title: string;
      durationMin?: number;
      intensity?: string;
      paceGuide?: string;
      notes?: string;
    }>;
  }>;
}
3. 画面要件（要点だけ固定）
3.1 Profile
Biometric入力 → Save/Resync → SYNCED/UNSYNC 変化

Training Focus：SelectablePill（Skill）

Preferences：trackSessionRpe（ToggleSwitch Skill）

初期値 true

トグル変更で UNSYNC、Save で SYNCED に戻す

3.2 New Activity
GPX import / Manual entry

GPX は MVP の主導線（将来拡張はするが、まず GPX→History のループ完成を優先）

スイムHRは “枠だけ” 用意（無ければ無いでOK：avgHr=null / hasHr=false）

GPX Import UI（MVP）
最大3件まで投入可能（種目問わず）

投入口の下に「データ確認セル」を投入順に羅列

各セルの編集項目：

sport（自動取得できない場合は必須入力。取得できていても変更可能にして良い）

sRpe（常に手動。必須だが未入力は null で保存可）

各セルに削除ボタン（該当 Activity を削除）

欠損値はすべて null 扱いで落ちないこと（HRなし等）

Manual Entry（MVP）
notes（コメント）入力あり（履歴で表示）

sRPE は入力して保存（Profileの on/off に関わらず保持）

3.3 History
最新順リスト

タップで詳細

編集（sport変更、notes追記、sRpe追記など）/ 削除

Manual の notes は コメント表示欄として常設（GPXも notes があれば表示してよい）

センサー値が null の場合は非表示 or グレー（UI責務）

3.4 Tri AI Coach（Menu + Chat）
チャット欄（広め）

AI返信型は 3択固定：

「変更なし」

「提案（plan_patch）」

「回答のみ」

plan_patch は Apply で反映（自動反映しない）

メニュー表示は「週固定ではない」

残っているメニューをスライド表示

各カードに削除ボタン

将来 menu と chat に分割する可能性あり（ブロック増加OK） /**2026.1.20改訂 menuとchatを分離に決定*/

4. アイコン配置（本プロジェクトの運用）
外部CDNは禁止（CODEX準拠）

種目アイコンは src/assets/icons/focus/ に格納（階層は増やさない）

SVGは currentColor 前提（色は Tailwind class で制御）

