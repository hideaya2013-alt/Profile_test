## 2026-01-23 (Session: TriCoach)
### Done
- 画面IDにTriCoach Menu/Chatを追加し、registry経由で5画面切替を有効化
- TriCoach Menu/ChatのUI骨格（UNSYNC/Resync/CONNECTED + 下段コントロール）を実装
- Doctrine Editのフルスクリーン編集UIをChat内オーバーレイとして実装
- DoctrineデータをIndexedDBで永続化（load/save, updatedAt反映）
- /health疎通でCONNECTED表示を更新（MVP）

### Touched files
- src/app/types.ts
- src/app/registry.ts
- src/db.ts
- src/screens/triCoachMenu.ts
- src/screens/triCoachChat.ts

### Key diffs (high level)
- ScreenIdを5画面構成へ拡張しTriCoach画面を登録
- Doctrineのsingletonデータ構造をdb.tsに追加
- Chat側でDoctrine Editのdirty/Save/Return/Last updatedを制御
- UNSYNC=dirty（差分）/ CONNECTED=疎通 / Resync=差分解消（dirty時のみ有効）
### How to verify
1) npm run dev
2) TriCoach Menu/Chatへ遷移し、ヘッダ状態と下段コントロール表示を確認
3) ChatのDOCTRINE(Edit)を開き、SaveのSAVED/FAULT挙動とLast updated更新を確認
4) /healthが不通な環境でCONNECTEDがOFFLINEになることを確認

### Next
- Chatのplan_patch検知とConfirm Update表示の実装
- Menu/Chatの履歴・メニューの実データ接続
- CONNECTED判定のendpoint/頻度の最適化

## 2026-01-24 (Session: TriCoach Chat)
### Done
- TriCoach Chatの描画をrenderOnce/bindOnce/updateUI方式に変更
- Doctrine EditのtextareaをDOM保持して入力中の再描画を防止
- dirty/Save/Resync/Connectedの更新を部分更新に切替

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- 画面全体の再描画を廃止し、状態変更は部分更新で反映
- Doctrine overlayは常設DOM＋show/hide制御に変更

### How to verify
1) npm run dev
2) TriCoach ChatでDoctrine Editを開き、IME/連続入力/ペースト時にカーソルが飛ばないことを確認
3) dirty状態でSave/Return/Resyncの状態遷移が正しいことを確認

### Next
- ChatのConfirm Update表示の実データ連携

## 2026-01-24 (Session: TriCoach Chat Env/Input)
### Done
- Chat入力をtextarea化し、Ctrl/Cmd+Enter送信とボタン送信に対応
- CONNECTED判定をVITE_API_BASE/healthのJSON statusで厳密化
- 送信時のみ入力をクリアし、入力中のDOM差し替えを回避

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- API_BASEを環境変数から参照し、/healthの判定をstatus==="ok"に限定
- 入力欄をtextareaに変更し、送信は明示操作のみ

### How to verify
1) npm run dev（.env.local変更がある場合は再起動）
2) backend停止でOFFLINE維持、起動後/healthでCONNECTEDになること
3) Enter改行、Ctrl/Cmd+Enterで送信、送信後に入力がクリアされること

### Next
- 送信ログ反映や履歴接続の実装

## 2026-01-24 (Session: TriCoach Chat UI)
### Done
- History 7/14ボタンを同一行・同幅チップに統一
- RestMenuトグルをProfileと同等のpeerスイッチに差し替え
- Doctrine Saveボタンを「✓ Saved / ✕ Fault」表示へ変更

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- 履歴レンジUIのクラス構成を見直し1行固定化
- RestMenuをcheckbox+peerの実体スイッチで統一
- Saveボタンの文言を状態に応じて切替

### How to verify
1) TriCoach Chatで7 Day / 14 Dayが1行で並ぶことを確認
2) RestMenuトグルがProfileと同じ色/挙動になることを確認
3) Doctrine EditでSave成功/失敗時にボタン文言が0.7s変化することを確認

### Next
- Chat UIの送信履歴表示の実装
## 2026-01-24 (Session: TriCoach Doctrine Save Flash)
### Done
- Doctrine Saveボタンの文言を「Save Configuration」に統一
- 成功/失敗フラッシュ時に✓/✕ラベルと色変化を適用し0.7sで復帰
- フラッシュ中はSaveボタンを無効化

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- SAVE_* クラス値をNew Activityのトーンに寄せて調整
- updateDoctrineSaveUIでフラッシュ/disabled判定を強化

### How to verify
1) Doctrine Editで保存成功時に「✓ Saved」緑表示になる
2) 保存失敗時に「✕ Fault」赤表示になる
3) 0.7s後に「Save Configuration」へ戻る

### Next
- Save中ローディング表示の検討

## 2026-01-24 (Session: TriCoach Dev Panel)
### Done
- /?dev 時のみ表示されるデバッグパネルを追加
- API_BASE/connected/health結果/コンテキスト状態/pack previewを表示
- Copy/Rebuild 操作とコピー結果の簡易表示を追加

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- devパネルをrenderOnceに常設し、updateDevPanelUIで差分更新
- /health の結果を lastHealthAt/lastHealthResult として保持

### How to verify
1) /?dev でパネルが表示され、通常URLでは非表示
2) API_BASE/connected/health結果/historyRange/restMenuOnが更新される
3) Copy Pack / Rebuild Pack が動作し、Consoleエラーが無い

### Next
- buildContextPack に本体データを追加

## 2026-01-24 (Session: TriCoach Dev Payload)
### Done
- /?dev のPACK PREVIEWを送信payloadプレビューに変更
- FULL PAYLOADの全文表示とsectionsフラグ表示を追加
- Copy Packをpayload全文コピーに変更し失敗時ログを追加

### Touched files
- src/screens/triCoachChat.ts

### Key diffs (high level)
- buildDevPayloadでALWAYS/HISTORY/RESTMENUのpayload文字列を組み立て
- devパネルのchars/preview/full表示をpayloadベースへ切替

### How to verify
1) /?dev でpayload previewとFULL PAYLOADが表示される
2) Copy Packで全文がコピーされる
3) Rebuild Packでpreview/charsが更新される

## 2026-01-25 (Session: Context Pack Service)
### Done
- DBから素材を集めてpayload textを組み立てるcontextPackServiceを新設
- ALWAYSにDoctrineを連結し、[DOCTRINE]はincluded表示に変更

### Touched files
- src/services/contextPackService.ts

### Key diffs (high level)
- buildContextPackで固定順序のpayloadを生成しトリム/メタ情報を付与
- ALWAYSにDoctrineを含め、DOCTRINEセクションはプレースホルダに変更

### How to verify
1) buildContextPackを呼び出してtext/meta/trimmedが返ること
2) ALWAYS内にDoctrine本文が含まれること

## 2026-01-25 (Session: Context Pack Service Hook)
### Done
- contextPackServiceをヒット日方式のHistory抽出＋null安全化で更新
- TriCoach Chatの/?devパネルをserviceのpayloadに接続
- payload preview/full/copyをservice結果で表示

### Touched files
- src/services/contextPackService.ts
- src/screens/triCoachChat.ts

### Key diffs (high level)
- ALWAYSにProfile+Rules+Doctrineを連結し、DOCTRINEはincluded表示
- Historyは「データがある日を7/14ヒット」方式でJSON列挙
- devパネルはbuildContextPackの結果を表示/コピー

### How to verify
1) /?dev でpayload preview/fullがDB内容を反映する
2) Historyがヒット日方式でJSON列挙される
3) Copy PackでFULL PAYLOADがコピーされる
