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
