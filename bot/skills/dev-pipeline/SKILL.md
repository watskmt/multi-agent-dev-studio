---
name: dev-pipeline
description: 仕様から実装、レビューまでの標準ループとパイプラインツールの使い方。
---

# 開発パイプライン手順

1. `pipeline_get` — 状態確認。
2. 新しいプロジェクトなら `pipeline_update`（`reset: true`、`projectName`、`goal`）。
3. `pipeline_handoff`（`toPhase: "spec"`）→ `spec-architect`。仕様は `docs/spec/00-overview.md` と `docs/spec/M<n>-*.md` に分けさせる。
4. `pipeline_update` で `spec`（要約）と `milestones` を登録。
5. マイルストーンごとに繰り返す:
   1. `pipeline_update` の `currentMilestone` → `pipeline_handoff`（`toPhase: "implement"`）→ `implementer` に当該マイルストーンの仕様ファイルと `openIssues` を渡す。
   2. `pipeline_handoff`（`toPhase: "review"`）→ `reviewer`。
   3. `pipeline_update` の `reviewVerdict` を記録（必須）。
   4. `request_changes` → `openIssues` を更新して 5-1 へ（同じマイルストーン）。approve 系 → `completeMilestone`。
6. 全マイルストーン完了後に `toPhase: "done"`。

同じ担当を続けて呼ばない。implement の後に review を挟まずに終えない。1 マイルストーン 3 往復を超えそうならユーザーに報告する。
