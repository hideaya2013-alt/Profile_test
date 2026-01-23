# PROJECT_NOTES.md（Profile_test 固有仕様）

この文書は **本プロジェクト固有**。CODEX.md（不変契約）に反しない範囲で更新してよい。

最終更新: 2026-01-20

---

## 0. 目的 / 到達点（MVPの現実ライン）
- フロントのみで動作（Vite + Vanilla TS + Tailwind）
- ローカル保存（IndexedDB）で完結
- 画面構成（当面）：
  - Profile / New Activity / History / TriCoach Menu / TriCoach Chat
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

### 2.3 Activity（History用 / Import・Manual 共通）
- Activity は **Historyの最小単位**。Import（GPX/TCX）と Manual は同じ Activity に格納する（分離しない）
- 欠損値はすべて **null 扱い**（エラーで落とさない）
- sRPE は **必ず手動入力**（Import/Manual共通で保持する）
- trackSessionRpe の ON/OFF は「AIメニュー生成で考慮するか」のトリガであり、**Activityには常に保存する**
- 互換：過去データに `comment` が存在する場合は `notes` へ寄せて扱う（db.ts の load 正規化で吸収）

#### フィールド（最小・正規）
- id: string
- source: "gpx" | "tcx" | "manual"
- sport: "swim" | "bike" | "run" | "strength" | "other" | null
  - 自動判定できない場合は null（確認カード/編集で手入力）
- title: string（Importなら file.name を基本）
- startTime: string（ISO）
- endTime: string（ISO）
- durationSec: number
- distanceMeters: number | null

- elevMeters: number | null
  - 獲得標高（上りの合計）を基本（A案：**計算ロジック維持＋DBに保持**）
  - ただしUIの主要表示では使わない（New Activityカードの3枠目は AVG HR 固定）
- altitudeAvgM: number | null
  - 平均標高（A案：**計算ロジック維持＋DBに保持**、UIでは使わない）

- hasHr: boolean
- hasPower: boolean
- hasSpeed: boolean

- avgHr: number | null
  - 平均HR（bpm）。New Activityカード上段3枠目は **常に avgHr を表示**（swim/bike/run共通）
- avgPower: number | null
  - 平均パワー（W）
- avgSpeed: number | null
  - 平均速度（km/h）
  - 常に km/h に正規化する。
  - 速度サンプルが無い場合は distance/duration から導出してよい（特にrun）

- sRpe: number | null
  - 1〜10（常に手動入力）
- notes: string | null
  - Manualのメモ。History表示対象（コメント欄）

- createdAt: string（ISO）
- updatedAt: string（ISO）

#### Import → Activity 変換ルール（MVP）
- 共通：
  - 取れない値は **null**（undefined禁止）
  - sRPE は必ず手動入力（未入力は null）
  - has* は「その系統の有効サンプルが1つでもあったか」で決める（0は欠損扱い）

- GPX：
  - start/end: trkpt/time の先頭/末尾（無ければ null）
  - duration: start/end があれば差分、無ければ null
  - distance: サマリタグが無い場合があるため、trkpt点列から計算（取れなければ null）
  - elevMeters: trkptの標高列が取れるなら「正の増分合計」（無ければ null）
  - altitudeAvgM: trkptの標高サンプル平均（無ければ null）
  - HR: あれば取得（0は欠損扱い）
  - Power/Speed: 無いことが多い → has=false / avg=null を許容

- TCX：
  - duration/distance: Lap の TotalTimeSeconds / DistanceMeters を **全Lap合算**
  - start/end: Trackpointの時刻の先頭/末尾（無ければ startTimeだけでもOK）
  - elevMeters: Trackpoint/AltitudeMeters の列から **正の増分合計（gain）**
  - altitudeAvgM: AltitudeMeters のサンプル平均
  - HR: HeartRateBpm/Value（0は欠損扱い）
  - Power/Speed:
    - Extensions/TPX 配下を優先（prefix付きも想定）
    - 速度サンプルが無い場合は distance/duration から avgSpeed を導出してよい

#### Manual → Activity 変換ルール（MVP）
- source="manual"
- センサー値は null（hasHr/hasPower/hasSpeed=false、avg*=null）
- notes を保存し、Historyでコメント欄に表示する
- elevMeters/altitudeAvgM は null

## 2.4 Menu Plan（Tri AI Coach の出力保存）
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

---

## 3. 画面要件（要点だけ固定）
3.1 Profile
Biometric入力 → Save/Resync → SYNCED/UNSYNC 変化
Training Focus：SelectablePill（Skill）
Preferences：trackSessionRpe（ToggleSwitch Skill）
初期値 true
トグル変更で UNSYNC、Save で SYNCED に戻す

### 3.2 New Activity（Import: GPX/TCX + Manual）
- Import（GPX/TCX）と Manual entry を切替タブで提供する
- Import は **GPX/TCX 両対応**（合算で最大3件）
- 取れない値はすべて **null 扱い**（落とさない）
- sRPE は Import/Manual とも **常に手動入力して保持**する（ProfileのトグルはAI側の考慮トリガのみ）

#### Import（GPX/TCX）UI（MVP）
- ファイル投入：最大3件（GPX/TCX混在で合算3件）
- 投入口の下に「データ確認カード」を投入順に羅列
- 各カードに以下を持つ：
  - 表示：title / startTime / duration / distance / AVG HR
    - AVG HR は `avgHr`（bpm）を表示（null の場合は "--"）
  - センサー表示：HR/Pwr/Spd は `hasHr/hasPower/hasSpeed` に応じて有効/無効（無ければ "--" / false）
  - 入力：
    - sport：自動判定できない場合（sport===null）は必須手入力
    - sRPE：常に手動、必須（1〜10）
  - Remove ボタン（カード削除）
- Save:
  - 3件すべてが「sport確定（nullでない）かつ sRPE入力済み」になるまで disabled
  - 全カードで sport と sRPE が揃った時のみ有効
  - 保存成功：Saved表示→カード消える→待機に戻る
  - エラー時：赤表示（文字/枠）で復帰可能
- フリーズ回避：
  - ファイルサイズ上限を設け、超過は notice で拒否
  - 拡張子だけでなく「中身の軽い判定」も行い、不正ファイルを弾く（notice）

#### Manual entry（MVP）
- sport/date/time/duration/sRPE/notes を入力して保存
- History表示時は notes をコメント欄として表示する（Importカードにはnotes表示不要）
- 保存成功でフォーム初期化＋完了フィードバック

#### Developer Mode
- ?dev でテスト/デバッグ導線を出す（読み取り中心）
- Save挙動の可視化（disabled/saving/saved/error）も ?dev で確認可能にする（必要に応じて）

### 3.3 History
最新順リスト
タップで詳細
編集（sport変更、notes追記、sRpe追記など）/ 削除
Manual の notes は コメント表示欄として常設（GPX,TCXも notes があれば表示してよい）
センサー値が null の場合は非表示 or グレー（UI責務）

### 3.4 TriCoach（Menu / Chat 分離：確定）
TriCoach は **Menu 画面と Chat 画面を分離**して実装する（スマホ前提で同時表示のメリットが薄く、状態が複雑化するため）。

#### 3.4.1 TriCoach Menu
- 役割：生成されたメニュー（Plan）の閲覧・消化・削除の中心
- メニュー表示は「週固定ではない」
  - 残っているメニューをスライド表示（または縦リスト）
  - 各カードに削除ボタン（MVPは confirm() で誤削除防止）
- 「Chatを開く」導線を用意（メニュー相談・調整へ遷移）

#### 3.4.2 TriCoach Chat
- 役割：相談・調整（AIは“決定主体”ではなく相談相手）
- チャット入力欄には **ContextPack の本文を表示しない**
  - 代わりに「添付チップ（短文）」として表示する（解除可）
  - 例：フルコンテキスト / 残っているメニュー / 直近7日履歴 …など
- 送信ペイロードは「ユーザー入力 + 選択されたContextのみ」で構成する
  - API側は原則“会話を覚えない”前提のため、必要なら「直近チャットN件」も Context として明示的に含める
  - Developer Mode (?dev) のときだけ、実際に送る ContextPack の全文を確認できる（読み取り専用）
- AI返信型は 3択固定（既存方針維持）：
  - 「変更なし」
  - 「提案（plan_patch）」※ Apply で反映（自動反映しない）
  - 「回答のみ」
- 将来拡張：
  - Context選択UI（「＋」ボタン、選択済みチップ表示、解除）
  - Contextの種類追加（Profile / 直近履歴 / 残メニュー / 直近チャット など）体調メモは当日チャット入力で対応。

---

## 4. アイコン配置（本プロジェクトの運用）
外部CDNは禁止（CODEX準拠）
種目アイコンは src/assets/icons/focus/ に格納（階層は増やさない）
SVGは currentColor 前提（色は Tailwind class で制御）

