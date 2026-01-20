# Skill Registry

このフォルダは「実装パターン（Skill）」のライブラリ。
仕様書・Codex指示では、まずここからSkill名を参照し、該当Skillの `skill.md` を開く。

## Skills

- Frontend_DynamicIcon_StateDriven
  - 状態（SYNCED/UNSYNC/DIRTY等）に応じて、ローカルSVGの「形状」と「色」を分離して安全に切り替える
  - Path: `./Frontend_DynamicIcon_StateDriven/skill.md`
  - Status: ✅ MVP_0で検証済み

- Frontend_SelectablePill_WithIcon
  - 選択式ピル（タグUI）で、選択状態に応じてアイコンとスタイルを切り替える（単一/複数対応）
  - Path: `./Frontend_SelectablePill_WithIcon/skill.md`
  - Status: 🧪 実装済

- Frontend_ToggleSwitch_PeerA11y
  - checkbox（真の入力）を、見た目だけ「トグルスイッチ」に変換する。
  - ON/OFF を boolean で扱う
  - キーボード操作/アクセシビリティを壊さない（Tab/Space/Enter）
  - UIは Tailwind の peer で状態反映（peer-checked / peer-disabled）

## Conventions

- 1 Skill = 1 folder
- 本文は `skill.md`
- 付随物（SVG/スクショ/断片コード）は `assets/`
- 外部CDN参照は禁止（特にアイコン）
