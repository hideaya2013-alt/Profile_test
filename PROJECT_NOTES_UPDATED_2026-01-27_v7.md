# PROJECT_NOTES.md（Profile_test 固有仕様）

この文書は **本プロジェクト固有**。CODEX.md（不変契約）に反しない範囲で更新してよい。
## Large files policy: 
-screen files > ~800-1000 lines は “パーサ/整形/デバッグ” を別ファイルへ退避し、
 screenは mount + UI/state に寄せる
-Dependency rule: screen -> helper/dev/import の一方向依存（逆流禁止）

最終更新: 2026-01-27

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
- 指示事項に記載なくても有効と判断した場合、自由にskillを使用する。
- `Frontend_DynamicIcon_StateDriven`：
  - Syncバッジ、Connected表示、処理状態（IMPORTING/SAVED/ERROR など）
- `Frontend_SelectablePill_WithIcon`：
  - Training Focus の選択ピル
  - タグ型フィルタ等（必要になったら適用）
- `Frontend_ToggleSwitch_PeerA11y`：
  - Preferences トグル等（checkbox実体 + peer + A11y）
- `Frontend_TextInput_Stable_NoFullRefresh`:
  - Vanilla TS（innerHTML系レンダ）でも、テキスト入力（textarea / input）を 連続入力・改行・IME変換・ペースト含めて安定させる。

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

### 2.5 ChatMessage（TriCoach Chat 履歴）
- 目的：直近 2〜3 ターン（必要最小）を context pack に含め、会話の流れを維持する（将来）
- 保存：**現段階ではDBへ保存しない**（送受信ログ／payloadは保持しない）。必要になったら追加する
- 欠損は null、undefined禁止（CODEX準拠）

#### フィールド（最小）
- id: string
- role: "user" | "assistant"
- content: string
- createdAt: string（ISO）

### 2.6 PlanProgress（未消化メニュー=RestMenu のための進捗）
- RestMenu は「Plan（生成物）」そのものではなく、**消化状態**と結び付けて扱う
- まずは最小の進捗ストアを用意し、Menu画面で “消化/未消化” を管理できるようにする

#### フィールド（最小）
- sessionId: string（Plan内セッションを一意に識別するキー：例 `${planId}:${date}:${idx}`）
- planId: string
- date: string（YYYY-MM-DD）
- idx: number（その日のsessions配列index）
- isDone: boolean
- updatedAt: string（ISO）


### 2.7 ContextPackService（送信素材の束：組み立て責務）
- 目的：Chat画面のUI状態（チェック/7d-14d）と、DB（Source of Truth）から、APIへ送る **最終payload** を生成する
- 方針：生成（DB→整形）は service に集約。Chat画面は「＋」パネルの選択状態とユーザー入力だけを扱う
- /?dev は service の返り値（payload）を可視化して検証する
- HistoryRange(7d/14d) は「データが存在する“日”を7/14回ヒットするまで遡る」。
  ヒットした日については、その日のアクティビティを全件含める。

#### ファイル
- src/services/contextPackService.ts

#### 入力（UI → service：最小）
```ts
export type ContextPackOptions = {
  includeHistory: boolean;
  historyRange: "7d" | "14d";
  includeRestMenu: boolean;
  includeRecentChat: boolean;
  recentTurns: 2 | 3;
};
```

#### 出力（service → Chat）
```ts
export type ContextPackResult = {
  text: string; // 送信するコンテキスト束（入力欄に全文は出さない）
  meta: {
    chars: number;
    sections: { doctrine: boolean; history: boolean; restmenu: boolean; recentChat: boolean };
  };
  // /?dev 用（任意。通常UIでは使用しない）
  debug?: {
    doctrineText: string;
    historyText: string;
    restText: string;
    recentChatText: string;
  };
};
```

#### 生成内容（固定フォーマット）
- 見出しを固定し、将来バックエンド側でも扱いやすくする

#### ALWAYS に含める最小セット（固定）
- Profile（ユーザー基礎情報）
  - displayName（またはname）
  - 年齢/性別などは **ユーザーが明示入力したもののみ**（推測しない）
  - 競技種目・現在のフェーズ（Base/Build など）・目標レース（任意）
  - HRゾーン/FTP/閾値などの指標（入力がある場合のみ）
- AI の振る舞い規定（短い運用ルール）
- Doctrine（短期/今季/制約/方針 + updatedAt）

```
[ALWAYS]
（Profile＋短い運用規約。下の「ALWAYSに含める最小セット」を満たす）
 (Profile + Rules + Doctrine)
 
[DOCTRINE]
（短期/今季/制約/方針 + updatedAt）
 (included in ALWAYS)

[HISTORY: 7d|14d]
（数値中心サマリ。無ければ "(no data)"）

[RESTMENU]
（未消化。無ければ "(no data)"）

[CHAT: RECENT 2T|3T]
（直近ターン。長文はトリム）
```

#### 安全柵（必須）
- DBからの取得失敗は例外握りつぶし禁止（console.error + metaに反映）
- 長文化対策：
  - 1メッセージあたり上限文字数でトリム（例：400〜800）
  - pack全体も chars 上限を持つ（超えたら RecentChat から優先的に削る）


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

共通方針：
- Always（基礎情報＋運用規約＋Doctrine）は **常時送信**（ユーザー選択なし）
- Always を UI に表示しない（「Always included」等の表示も行わない）
- 画面上のフィルタ／トグルは **送信素材の選択**であり、チャット入力欄に本文を表示しない

#### 3.4.1 TriCoach Menu
- 役割：生成されたメニュー（Plan）の閲覧・消化・削除の中心
- 「Chatを開く」導線を用意（メニュー相談・調整へ遷移）
- 上段ステータス（共通ヘッダ）：UNSYNC / Resync / CONNECTED
- Doctrine 編集は “Always（常時送信）素材の編集” なので、Menu画面から編集画面を開けるボタンを置く（素材選択ではない）
- RestMenu（未消化）は **常にDBから生成可能**にしておき、送信に含めるかどうかは Chat画面の「＋」で決める


#### 3.4.2 TriCoach Chat
- 役割：相談・調整（AIは“決定主体”ではなく相談相手）
- 上段ステータス（共通ヘッダ）：UNSYNC / Resync / CONNECTED
- Doctrine 編集ボタンを配置（Always素材の編集。送信素材の選択ではない）

##### 送信素材の選択（「＋」パネル：固定）
- チャット入力欄の横に「＋」ボタンを配置し、ここから **送信に含める素材**を選ぶ
- Always（基礎情報＋運用規約＋Doctrine）は常時送信（ユーザー選択なし）
- 追加素材（チェックで送信に含める）：
  - History（ONで 7d / 14d を単一選択）
  - RestMenu（未消化メニュー）
  - Recent Chat（直近 2〜3 ターン）
  -「選択状態はチップ表示（History:7d / RestMenu / Chat:2T）を入力バー直上に表示」

##### 実装責務（破綻しない分離：固定）
- Source of Truth はDB（Profile/Doctrine/History/RestMenu）
- **送信payload(text pack)は生成して送信後に保持しない（DB保存しない）**
- 入力欄の文言・送受信ログは現段階ではDBへ保存しない（必要になったら追加）
- Chat画面は「＋」で選んだチェック状態と、Historyの 7d/14d だけを保持
- `contextPackService.ts` が、チェック状態を受け取り **DBから取得→成形→送信payload** を返す
- Chat画面は「ユーザー入力」＋「serviceが返したpayload」を送信する（入力欄にpayload全文は出さない）

##### AI返信型（契約：3択固定）
- 「変更なし」
- 「提案（plan_patch）」※ Apply で反映（自動反映しない）
- 「回答のみ」


#### 3.4.3 TriCoach 共通ヘッダ状態（固定）
- 表示は 3つ並び：UNSYNC / Resync / CONNECTED
- UNSYNC = ローカルDB差分（dirty）の有無のみを表す（通信可否とは無関係）
- CONNECTED = FastAPI backend の疎通のみを表す（差分有無とは無関係）
- Resync = 差分解消の同期アクション
  - dirty=false：Resync disabled
  - dirty=true：Resync enabled
  - 同期失敗時：dirty維持、短いエラー表示（UI責務）

#### 3.4.4 Doctrine（Training Intent / Doctrine）
目的：Alwaysに含める “方針テキスト” をユーザーが編集できるようにする。

- Doctrine は「4分割テキスト」をDBへ保存し、Always合成時に常に含める
- 編集UIは TriCoach から呼び出す（メインの5画面構成には追加しない）
  - 実装は **フルスクリーンの編集画面（内部遷移 or overlay）**として扱い、グローバルの screenOrder には含めない

##### Doctrine Edit（UI仕様：固定）
- textarea 4つ（縦積み）：
  1) Short-term goal
  2) Season goal
  3) Constraints
  4) Doctrine / Principles
- Last updated を表示（DBの updatedAt）
- Save / Return の2ボタン
  - Save：dirty=true のときのみ有効。4欄すべて空は disabled
  - Save成功：Saveボタン自体が "SAVED"（緑）に変化し 0.7s 後に "Save" に戻る
  - Save失敗：Saveボタン自体が "FAULT"（赤）に変化し 0.7s 後に "Save" に戻る
  - fault時も入力内容は保持（消さない）
  - Return：dirty=falseなら戻る / dirty=trueなら確認（Discard and Return / Stay）

##### Doctrine データ（IndexedDB）
- 単一レコード（singleton）
  - shortTermGoal: string
  - seasonGoal: string
  - constraints: string
  - doctrine: string
  - updatedAt: string(ISO)


---

## 4. アイコン配置（本プロジェクトの運用）
外部CDNは禁止（CODEX準拠）
- 共通UIアイコン：`src/assets/icons/common/`
- 種目（Swim/Bike/Run/Other等）アイコン：`src/assets/icons/focus/`（階層は増やさない）
- SVGは `currentColor` 前提（色は Tailwind class で制御）

## 5. Codex Work Summary 運用（固定）
- Codexは作業完了時に必ずリポジトリ直下 `WORK_SUMMARY.md` に追記する（追記のみ、過去改変しない）。
- 追記フォーマットは以下：

## YYYY-MM-DD (Session: TriCoach)
### Done
- ...

### Touched files
- ...

### Key diffs (high level)
- ...

### How to verify
1) ...
2) ...

### Next
- ...

---

## 6. Backend（FastAPI）MVP：疎通確認とChat中継（保存は次段）
目的：
- CONNECTED 表示は「FastAPIの疎通（家WiFiで到達できる）」のみを意味する
- 現段階では SoT はフロント（IndexedDB）のまま。Backend は中継・観測の最小に留める
- メニュー保存（Plan登録/Progress更新）は次段で追加する

### 6.1 Endpoints（固定）
- GET /health
  - 用途：CONNECTED 判定（疎通）
  - 判定：HTTP 200（res.ok）を正（JSON 形には依存しない）

- POST /v1/echo
  - 用途：Swaggerで payload(text) の受信確認（OpenAIは呼ばない）
  - Request: { text: string, options?: object, meta?: object }
  - Response: { chars, head, hasSections }

- POST /v1/chat
  - 用途：payload(text) を入力としてAI応答を返す（まずはstubでOK）
  - Request: { text: string, max_output_chars?: number }
  - Response: { replyText: string, requestId: string }

### 6.2 Non-goals（この段階ではやらない）
- Plan保存（PUT/POST）
- Activity/Profile/Doctrine のCRUD（SoTはフロントDB）
- ストリーミング（必要なら次段）

### 6.3 接続ルール（固定）
- フロントは contextPackService が生成した FULL PAYLOAD（result.text）を API に送る
- debug/meta は原則送らない（必要時のみ /v1/echo で確認に使用）
